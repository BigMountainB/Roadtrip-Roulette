import Phaser from 'phaser';
import { SCREEN_W, SCREEN_H, VICE_CONFIG, VICES, HUD_OFFSET_X } from '../constants.js';
import { getInstalled } from '../systems/UpgradeSystem.js';
import { UPGRADE_SLOTS, getSlotTiers } from '../data/upgrades.js';
import { ENDING_PLATES, activeEndingGenre, loadEndingArt, placeEndingCar } from '../data/endingArt.js';
import { selectTip, tipContext, isFailureCause } from '../data/endingTips.js';
import { showNextRunPanel } from '../ui/NextRunPanel.js';

// Per-vice unlock hints shown for any vice the player hasn't unlocked yet.
// Order here drives the row order on the run-summary panel.
const VICE_ORDER = [
  VICES.SUSHI, VICES.BURRITO, VICES.ENERGY, VICES.GUMMIES, VICES.HOTDOG,
  VICES.COMBO,  VICES.COLDBREW,   VICES.COMA, VICES.SLUSHIE, VICES.CAFFEINE,
];

const UNLOCK_HINTS = {
  [VICES.ENERGY]:  'Drive 100 total miles.',
  [VICES.GUMMIES]:  'Reach Cle Elum (mile 84).',
  [VICES.HOTDOG]:      'Reach Ellensburg (mile 109).',
  [VICES.COMBO]:   'Drive past 20% of the route.',
  [VICES.COLDBREW]:       'Crash into 50 NPC cars across your runs.',
  [VICES.COMA]: 'Clear Snoqualmie Pass once.',
  [VICES.SLUSHIE]: 'Drink 40 Cold Brews across your runs.',
  [VICES.CAFFEINE]:     'Wreck 50 cars across your runs.',
};

const IMPACT = 'Impact, "Arial Black", Arial, sans-serif';
const CX = SCREEN_W / 2;
const CY = SCREEN_H / 2;

// `image` is the LEGACY baked plate (old webp, typography and button faces
// painted in).  It is only reached now if the new photographic plate in
// ENDING_PLATES fails to load — see _createPlateEnding.
const CAUSE = {
  busted: {
    headline: 'BUSTED',
    color:    '#35A7FF',
    subtitle: 'NOT WORTH THE RISK.',
    image:    'ui_end_busted_screen',
  },
  passed_out: {
    headline: 'PASSED OUT',
    color:    '#FF3BAF',
    subtitle: 'ONE DECISION. A LIFETIME OF CONSEQUENCES.',
    image:    'ui_end_passed_out_neon',
  },
  crash: {
    headline: 'CRASHED',
    color:    '#FF3BAF',
    subtitle: 'ONE BAD DECISION. ONE LAST RIDE.',
    image:    'ui_end_crashed_neon',
  },
  finish: {
    headline: 'YOU MADE IT',
    color:    '#44FF88',
    subtitle: 'Pullman, WA — what a road.',
    image:    null,
  },
  // Pullman finish causes handed over by GameScene._endGame (were falling
  // through to the BUSTED meta because only the 'finish' key existed).
  finish_on_time: {
    headline: 'YOU MADE IT',
    color:    '#44FF88',
    subtitle: 'Pullman, WA — right on time. What a road.',
    image:    null,
  },
  finish_late: {
    headline: 'YOU MADE IT',
    color:    '#FFCC44',
    subtitle: 'Pullman, WA — late to the party, but you made it.',
    image:    null,
  },
  // Demo build (web): finished West Seattle → Snoqualmie.
  demo_complete: {
    headline: 'DEMO COMPLETE',
    color:    '#44FF88',
    subtitle: 'You made it to Snoqualmie — the full drive to Pullman awaits.',
    image:    null,
  },
};

// Full game, deployed alongside the demo on the same Pages project (see
// website/fully/ + Overview.md Chapter 2). Relative so it resolves correctly
// on both the production domain and any preview-deployment alias.
const FULL_GAME_URL = '/fully/';

export class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOver' }); }

  init(data) {
    this.finalScore     = data?.score      ?? 0;
    // GameScene now passes mileage already converted to miles.
    this.finalMiles     = data?.distanceMi ?? 0;
    this.cause          = data?.cause      ?? 'busted';
    // Net wallet change for the drive that just ended (earnings minus
    // fines/bail/penalties — may be negative).  Null on older call paths.
    this.runEarned      = data?.runEarned  ?? null;
    // Why the run ended, recorded at the gameplay trigger site. Absent on old
    // saves / existing call sites -> selectTip falls back to a generic tip.
    this.failReason     = data?.reason     ?? null;
    this.deathVice      = data?.vice       ?? null;
    this.charge         = data?.charge     ?? 'RECKLESS DRIVING';
    this.losses         = data?.losses     ?? 0;
    this.runTimeSec     = data?.runTimeSec ?? 0;
    this.lastCheckpoint = data?.lastCheckpoint ?? null;
    this.viceSummary    = data?.viceSummary ?? null;
    // Per-trip stat breakdown (owner 2026-07-29 directive) — a StatsTracker
    // .summarize() snapshot taken at trip-end, before any future run's
    // tripStart() could reset the session counters out from under this scene.
    this.tripSummary    = data?.tripSummary ?? null;
  }

  create() {
    // Defensive: explicitly enable input + bring this scene to the
    // top of the scene stack.  Some crash-recovery transitions from
    // GameScene have left input disabled on the new scene.
    try { this.input?.setTopOnly?.(false); } catch (_) {}
    try { if (this.input && this.input.enabled === false) this.input.enabled = true; } catch (_) {}
    try { this.scene?.bringToTop?.(); } catch (_) {}

    // Decoupled-width: center the fixed 800-wide results layout in the (possibly
    // wider) canvas.  Set BEFORE the ending-branch early returns so every path
    // (neon / baked / standard) inherits it.  Re-applied on resize.  No-op when 0.
    const _applyVP = () => { try { this.cameras.main.setViewport(HUD_OFFSET_X, 0, SCREEN_W, SCREEN_H); } catch (_) {} };
    _applyVP();
    this.scale.on('resize', _applyVP, this);
    this.events.once('shutdown', () => this.scale.off('resize', _applyVP, this));

    const meta = CAUSE[this.cause] ?? CAUSE.busted;
    // Photographic plate + the player's genre car (owner 2026-08-04).  Every
    // ending with authored plate art routes here; the legacy baked-webp
    // builders below are now only the fallback when the plate can't load.
    const plate = ENDING_PLATES[this.cause];
    if (plate) {
      this._createPlateEnding(meta, plate);
      return;
    }
    if (this.cause === 'passed_out') {
      this._createNeonEnding(meta);
      return;
    }
    if (this.cause === 'busted' || this.cause === 'crash') {
      this._createBakedButtonEnding(meta);
      return;
    }
    if (this.cause === 'demo_complete') {
      this._createDemoComplete(meta);
      return;
    }

    // ── Background ─────────────────────────────────────────────────────
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000).setOrigin(0);

    // Crash artwork (collision OR passing out) covering the upper half so
    // the player has visual context for the cause.
    if (meta.image && this.textures.exists(meta.image)) {
      const img = this.add.image(CX, CY - 40, meta.image).setOrigin(0.5);
      // Fit image to ~70% of screen height while preserving aspect ratio.
      const tex = this.textures.get(meta.image)?.source?.[0];
      const baseW = tex?.width  || SCREEN_W;
      const baseH = tex?.height || SCREEN_H;
      const fit = Math.min((SCREEN_W * 0.95) / baseW, (SCREEN_H * 0.55) / baseH);
      img.setDisplaySize(baseW * fit, baseH * fit).setAlpha(0.85);
    }

    // Dark scrim over the lower portion so text reads cleanly.
    this.add.rectangle(0, SCREEN_H * 0.52, SCREEN_W, SCREEN_H * 0.48, 0x000000, 0.78).setOrigin(0);
    if (this.cause === 'crash') this._drawWreckedGlass();

    // ── Headline ───────────────────────────────────────────────────────
    this.add.text(CX, 28, meta.headline, {
      fontSize: '48px', fontFamily: IMPACT,
      color: meta.color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5, 0);

    // ── Subtitle / "why they died" ─────────────────────────────────────
    let subtitle = meta.subtitle;
    if (this.cause === 'passed_out' && this.deathVice) {
      const label = VICE_CONFIG[this.deathVice]?.label ?? this.deathVice;
      subtitle = `${label} got you. ${meta.subtitle}`;
    }
    this.add.text(CX, 86, subtitle, {
      fontSize: '13px', fontFamily: 'Arial', color: '#DDDDDD',
      stroke: '#000', strokeThickness: 2, align: 'center',
      wordWrap: { width: SCREEN_W * 0.86 },
    }).setOrigin(0.5, 0);

    // ── Cash + distance summary (bottom half, on the dark scrim) ───────
    this.add.text(CX, SCREEN_H * 0.58, `CASH  $${this.finalScore.toLocaleString()}`, {
      fontSize: '22px', fontFamily: IMPACT,
      color: '#FFCC44', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.add.text(CX, SCREEN_H * 0.58 + 30, `DISTANCE  ${this.finalMiles.toFixed(2)} mi`, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#AACCFF',
    }).setOrigin(0.5, 0);

    // ── Restart buttons ───────────────────────────────────────────────
    // Built from a clean Rectangle-with-Text combo (instead of a Text
    // with backgroundColor + heavy stroke) so the labels render crisp
    // — the previous strokeThickness on small text was producing the
    // "blurry" look the player flagged.
    const cp   = this.lastCheckpoint;
    const btnY = SCREEN_H - 76;

    if (cp?.position != null) {
      this._makeButton(
        CX - 110, btnY, 200, 50,
        `Start at\n${cp.name}`,
        0x88FFCC, 0x000000,
        () => this._restartAtCheckpoint(cp.position),
      );
    }
    this._makeButton(
      CX + 110, btnY, 200, 50,
      'Start Over',
      0x993322, 0xFFFFFF,
      () => this._startOver(),
    );

    // (Main Menu link removed — MenuScene was vestigial and never reached
    // at runtime, so the link target no longer exists.)

    // Vice-log toggle in the top-right.  Pops a full-screen panel listing
    // every vice — what you peaked, what you ignored, and hints for the
    // ones still locked.
    if (this.viceSummary) {
      this._makeButton(
        SCREEN_W - 70, 24, 120, 28,
        '📋 VICE LOG',
        0x222244, 0xFFFFFF,
        () => this._openViceLog(),
      );
    }
    // Trip-summary tabbed recap (owner 2026-07-29) — only on a genuine
    // Pullman arrival, where there's a full trip's worth of missions/
    // money/road data to show, not a mid-run bust/crash/pass-out.
    if (this.tripSummary
        && (this.cause === 'finish' || this.cause === 'finish_on_time' || this.cause === 'finish_late')) {
      this._makeButton(
        SCREEN_W - 70, 58, 120, 28,
        '📊 SUMMARY',
        0x224422, 0xFFFFFF,
        () => this._openTripSummary(),
      );
    }

    // Keyboard shortcuts.
    this.input.keyboard?.once('keydown-SPACE', () => this._retrySameSettings());
    this.input.keyboard?.once('keydown-ENTER', () => this._startOver());
    this.input.keyboard?.on('keydown-L', () => this._openViceLog());
    this.input.keyboard?.on('keydown-T', () => { if (this.tripSummary) this._openTripSummary(); });
  }

  /**
   * Photographic ending plate + the player's genre car (owner 2026-08-04).
   *
   * The plate is a full-bleed 800x450 photo with NO typography or button faces
   * in it — unlike the old baked webp art — so the headline and buttons are
   * drawn for real here, over a gradient scrim that keeps them readable on the
   * wet-road plates.
   *
   * Plate + car are fetched at this moment rather than at boot (six plates is
   * ~3.5 MB of art the player sees once), so they arrive a frame or two late
   * and fade in.  If the plate can't load at all, this hands off to the legacy
   * baked-webp builder — an ending that never draws would strand the player.
   */
  _createPlateEnding(meta, spec) {
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x03050F).setOrigin(0);
    // Holding headline so the screen is never blank while the plate loads.
    const holding = this.add.text(CX, 24, meta.headline, {
      fontSize: '44px', fontFamily: IMPACT,
      color: meta.color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5, 0).setDepth(10);

    const genre = activeEndingGenre(this);
    loadEndingArt(this, spec, genre, (plateReady, carKey) => {
      // Bail only if the player already moved on — i.e. the scene is shutting
      // down or destroyed.  NOT isActive(): when the plate + car are already
      // in the texture cache (any SECOND same-cause ending in one browser
      // session) loadEndingArt calls back SYNCHRONOUSLY, while create() is
      // still running and the scene status is CREATING — isActive() is false
      // there, and bailing consumed the loader watchdog too, stranding the
      // player on the bare holding headline with no buttons (owner report
      // 2026-08-26: black screen, pink "CRASHED", nowhere to go).
      const _st = this.sys?.settings?.status;
      if (_st != null && _st >= Phaser.Scenes.SHUTDOWN) return;
      if (!plateReady) {
        // No plate — fall back to whatever the old art path was for this cause.
        holding.destroy();
        if (this.cause === 'demo_complete')  { this._createDemoComplete(meta); return; }
        if (this.cause === 'passed_out')     { this._createNeonEnding(meta);   return; }
        if (this.cause === 'busted' || this.cause === 'crash') {
          this._createBakedButtonEnding(meta);
          return;
        }
        // Pullman finish has no legacy art — keep the holding headline and
        // draw the normal UI over black.
      } else {
        const bg = this.add.image(CX, CY, spec.texture)
          .setOrigin(0.5).setDisplaySize(SCREEN_W, SCREEN_H).setDepth(0).setAlpha(0);
        this.tweens.add({ targets: bg, alpha: 1, duration: 220 });
        const car = placeEndingCar(this, carKey, spec.car, 1);
        if (car) { car.setAlpha(0); this.tweens.add({ targets: car, alpha: 1, duration: 220, delay: 60 }); }
      }
      holding.destroy();
      this._buildPlateUI(meta);
    });
  }

  /** Headline / stats / buttons drawn over an ending plate. */
  _buildPlateUI(meta) {
    const D = 10;
    // Bottom scrim — a soft gradient rather than a hard box, so the photo
    // still reads under the labels.
    const scrim = this.add.graphics().setDepth(D - 1);
    scrim.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.88, 0.88);
    scrim.fillRect(0, 300, SCREEN_W, SCREEN_H - 300);
    // Top scrim for the headline — much lighter, the sky carries most of it.
    const top = this.add.graphics().setDepth(D - 1);
    top.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0);
    top.fillRect(0, 0, SCREEN_W, 96);

    this.add.text(CX, 20, meta.headline, {
      fontSize: '44px', fontFamily: IMPACT,
      color: meta.color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5, 0).setDepth(D);

    let subtitle = meta.subtitle;
    if (this.cause === 'passed_out' && this.deathVice) {
      const label = VICE_CONFIG[this.deathVice]?.label ?? this.deathVice;
      subtitle = `${label} got you. ${meta.subtitle}`;
    }
    this.add.text(CX, 70, subtitle, {
      fontSize: '13px', fontFamily: 'Arial', color: '#DDDDDD',
      stroke: '#000', strokeThickness: 3, align: 'center',
      wordWrap: { width: SCREEN_W * 0.86 },
    }).setOrigin(0.5, 0).setDepth(D);

    this.add.text(CX, 326, `CASH  $${this.finalScore.toLocaleString()}`, {
      fontSize: '24px', fontFamily: IMPACT,
      color: '#FFCC44', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(D);
    // What THIS drive added to the wallet (owner 2026-08-26) — earnings net
    // of fines/bail/crash penalty, so a run that lost money reads negative.
    const hasEarned = this.runEarned != null;
    if (hasEarned) {
      const e = Math.round(this.runEarned);
      this.add.text(CX, 357,
        `${e >= 0 ? '+' : '−'}$${Math.abs(e).toLocaleString()}  THIS DRIVE`, {
          fontSize: '14px', fontFamily: IMPACT,
          color: e >= 0 ? '#66E28A' : '#FF6677',
          stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(D);
    }
    this.add.text(CX, hasEarned ? 378 : 362, `DISTANCE  ${this.finalMiles.toFixed(2)} mi`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#AACCFF',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(D);

    // The demo's whole job is selling the full game — keep the pitch.
    if (this.cause === 'demo_complete') {
      this.add.text(CX, 104,
        'The full 293-mile drive to Pullman —\nmore towns, vices, weapons, missions & mayhem.', {
          fontSize: '14px', fontFamily: 'Arial', color: '#9FE8B5', align: 'center',
          stroke: '#000', strokeThickness: 3, lineSpacing: 4, wordWrap: { width: SCREEN_W * 0.84 },
        }).setOrigin(0.5, 0).setDepth(D);
    }

    const btnY   = SCREEN_H - 34;
    const isWin  = this.cause === 'finish' || this.cause === 'finish_on_time'
                || this.cause === 'finish_late' || this.cause === 'demo_complete';
    // _makeButton already lands at depth 50/51, clear of the scrim.
    const mk = (x, w, label, fill, txt, cb) =>
      this._makeButton(x, btnY, w, 40, label, fill, txt, cb);

    if (this.cause === 'demo_complete') {
      mk(CX - 150, 250, 'GET THE FULL GAME', 0x44FF88, 0x000000,
         () => { try { window.open(FULL_GAME_URL, '_blank'); } catch (_) {} });
      mk(CX + 150, 230, 'PLAY DEMO AGAIN', 0x2A4A6A, 0xFFFFFF, () => this._startOver());
    } else if (isWin) {
      mk(CX, 240, 'DRIVE IT AGAIN', 0x44AA55, 0xFFFFFF, () => this._startOver());
    } else {
      // Same three actions the baked plates offered, now with real faces.
      const cp = this.lastCheckpoint;
      mk(CX - 250, 210, 'RESTART', 0xFF39AF, 0xFFFFFF, () => this._retrySameSettings());
      mk(CX, 210, cp?.position != null ? 'CONTINUE' : 'RESTART RUN', 0x39A8FF, 0xFFFFFF, () => {
        if (cp?.position != null) this._restartAtCheckpoint(cp.position);
        else this._retrySameSettings();
      });
      mk(CX + 250, 210, 'MENU', 0xF4F7FF, 0x000000, () => this._returnToTitle());
    }

    if (this.viceSummary) {
      this._makeButton(SCREEN_W - 70, 24, 120, 28, '📋 VICE LOG', 0x222244, 0xFFFFFF,
                       () => this._openViceLog());
    }
    if (this.tripSummary && isWin) {
      this._makeButton(SCREEN_W - 70, 58, 120, 28, '📊 SUMMARY', 0x224422, 0xFFFFFF,
                       () => this._openTripSummary());
    }

    this._buildNextRunPanel();

    this.input.keyboard?.once('keydown-SPACE', () => this._retrySameSettings());
    this.input.keyboard?.once('keydown-ENTER', () => this._returnToTitle());
    this.input.keyboard?.on('keydown-L', () => this._openViceLog());
    this.input.keyboard?.on('keydown-T', () => { if (this.tripSummary) this._openTripSummary(); });
  }

  /**
   * "NEXT RUN" advice panel — why this run ended and what to do differently.
   * Losses only; a Pullman finish has nothing to advise. Anchored per plate
   * (ENDING_PLATES[cause].tips) so it never covers the player's car, drawn
   * BELOW the buttons' depth and never made interactive, so it can't swallow a
   * tap meant for RESTART / CONTINUE / MENU.
   */
  _buildNextRunPanel() {
    if (!isFailureCause(this.cause)) return;
    const spec = ENDING_PLATES[this.cause];
    if (!spec?.tips) return;
    const tip = selectTip(this.failReason, this.cause, tipContext(this));
    if (!tip) return;
    showNextRunPanel(this, tip, { ...spec.tips, depth: 20, delay: 420 });
  }

  /** Demo build end screen — celebratory "made it to Snoqualmie" + a button
   *  to the full game at /fully. Reuses _makeButton / _startOver (a fresh run
   *  re-enters the demo since DEMO_MODE is still on). */
  _createDemoComplete(meta) {
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x03050F).setOrigin(0);
    // Subtle neon frame to feel like a "win" card, not a fail screen.
    const frame = this.add.graphics();
    frame.lineStyle(3, 0x44FF88, 0.9);
    frame.strokeRoundedRect(18, 18, SCREEN_W - 36, SCREEN_H - 36, 8);
    frame.lineStyle(1, 0x39A8FF, 0.5);
    frame.strokeRoundedRect(24, 24, SCREEN_W - 48, SCREEN_H - 48, 6);

    this.add.text(CX, 42, meta.headline, {
      fontSize: '46px', fontFamily: IMPACT, color: meta.color, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5, 0);
    this.add.text(CX, 102, meta.subtitle, {
      fontSize: '15px', fontFamily: 'Arial', color: '#DDEEFF', stroke: '#000', strokeThickness: 2,
      align: 'center', wordWrap: { width: SCREEN_W * 0.84 },
    }).setOrigin(0.5, 0);

    this.add.text(CX, SCREEN_H * 0.40, `CASH  $${this.finalScore.toLocaleString()}`, {
      fontSize: '24px', fontFamily: IMPACT, color: '#FFCC44', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.add.text(CX, SCREEN_H * 0.40 + 32, `DISTANCE  ${this.finalMiles.toFixed(2)} mi`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#AACCFF',
    }).setOrigin(0.5, 0);

    this.add.text(CX, SCREEN_H * 0.56,
      'The full 293-mile drive to Pullman —\nmore towns, vices, weapons, missions & mayhem.', {
      fontSize: '14px', fontFamily: 'Arial', color: '#9FE8B5', align: 'center',
      stroke: '#000', strokeThickness: 2, lineSpacing: 4, wordWrap: { width: SCREEN_W * 0.84 },
    }).setOrigin(0.5, 0);

    const btnY = SCREEN_H - 76;
    this._makeButton(CX - 110, btnY, 200, 50, 'GET THE FULL GAME', 0x44FF88, 0x000000,
      () => { try { window.open(FULL_GAME_URL, '_blank'); } catch (_) {} });
    this._makeButton(CX + 110, btnY, 200, 50, 'Play Demo Again', 0x2A4A6A, 0xFFFFFF,
      () => this._startOver());

    this.input.keyboard?.once('keydown-SPACE', () => this._startOver());
    this.input.keyboard?.once('keydown-ENTER', () => this._startOver());
  }

  _createBakedButtonEnding(meta) {
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x03050F).setOrigin(0);
    const hasPlate = this.textures.exists(meta.image);
    if (hasPlate) {
      this.add.image(CX, CY, meta.image)
        .setOrigin(0.5)
        .setDisplaySize(SCREEN_W, SCREEN_H);
    }

    // (Portable checkpoint codes removed — CONTINUE resumes the local
    // checkpoint on this device; cross-device transfer awaits account login.)

    // The authored Crashed and Busted plates already contain their full
    // typography and button faces (RESTART / CONTINUE / MENU — plate art
    // still shows the old RETRY / LOAD SAVE / MAIN MENU faces until the
    // PNGs are re-exported).  Hit zones trace those buttons:
    //   RESTART  → fresh run from mile 0, skip title (same settings)
    //   CONTINUE → resume at last checkpoint (falls back to fresh run
    //              if no checkpoint exists this run)
    //   MENU     → back to the title screen
    const cp = this.lastCheckpoint;
    this._makeImageButtonZone([
      { x: 139, y: 400 }, { x: 150, y: 361 },
      { x: 296, y: 361 }, { x: 285, y: 400 },
    ], 0xFF39AF, () => this._retrySameSettings());
    this._makeImageButtonZone([
      { x: 306, y: 400 }, { x: 317, y: 361 },
      { x: 467, y: 361 }, { x: 456, y: 400 },
    ], 0x39A8FF, () => {
      if (cp?.position != null) this._restartAtCheckpoint(cp.position);
      else this._retrySameSettings();
    });
    this._makeImageButtonZone([
      { x: 474, y: 400 }, { x: 485, y: 361 },
      { x: 647, y: 361 }, { x: 636, y: 400 },
    ], 0xF4F7FF, () => this._returnToTitle());

    // FALLBACK — the authored plate art carries the baked-in headline AND the
    // visible button FACES; the zones above are INVISIBLE.  If that art ever
    // fails to load, the screen is just black with un-seeable buttons, which
    // traps the player on Game Over.  When the plate is missing, draw a visible
    // headline + labeled buttons over the exact same hit zones so a run is
    // always restartable.
    if (!hasPlate) {
      this.add.text(CX, 70, meta.headline, {
        fontSize: '48px', fontFamily: IMPACT,
        color: meta.color, stroke: '#000', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(42);
      const fbBtn = (cx, label, color) => {
        const g = this.add.graphics().setDepth(42);
        g.fillStyle(0x0A0F1E, 0.96);
        g.fillRoundedRect(cx - 74, 363, 148, 36, 5);
        g.lineStyle(2, color, 1);
        g.strokeRoundedRect(cx - 74, 363, 148, 36, 5);
        this.add.text(cx, 381, label, {
          fontSize: '13px', fontFamily: IMPACT, color: '#FFFFFF',
        }).setOrigin(0.5).setDepth(43);
      };
      fbBtn(217, 'RESTART',  0xFF39AF);   // x-zone 139–296
      fbBtn(386, 'CONTINUE', 0x39A8FF);   // x-zone 306–467
      fbBtn(560, 'MENU',     0xF4F7FF);   // x-zone 474–647
    }

    this.input.keyboard?.once('keydown-SPACE', () => this._retrySameSettings());
    this.input.keyboard?.once('keydown-ENTER', () => this._returnToTitle());
  }

  _createNeonEnding(meta) {
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x03050F).setOrigin(0);
    if (this.textures.exists(meta.image)) {
      this.add.image(CX, CY, meta.image)
        .setOrigin(0.5)
        .setDisplaySize(SCREEN_W, SCREEN_H);
    }

    const isBust = this.cause === 'busted';
    const accent = isBust ? 0x2D9BFF : 0xFF2AAB;
    const accentCss = isBust ? '#39A8FF' : '#FF39AF';
    const secondCss = isBust ? '#FF39AF' : '#39A8FF';
    const g = this.add.graphics();
    g.fillStyle(0x02040D, 0.60);
    g.fillRect(0, 0, SCREEN_W, 125);
    g.fillStyle(0x02040D, 0.78);
    g.fillRect(0, 232, SCREEN_W, SCREEN_H - 232);
    g.lineStyle(2, accent, 0.85);
    g.lineBetween(102, 113, SCREEN_W - 102, 113);

    // Offset neon glow beneath a pale chrome-looking headline.
    this.add.text(CX + 3, 15, meta.headline, {
      fontSize: '64px', fontFamily: IMPACT,
      color: accentCss, stroke: accentCss, strokeThickness: 8,
    }).setOrigin(0.5, 0).setAlpha(0.52);
    this.add.text(CX, 11, meta.headline, {
      fontSize: '64px', fontFamily: IMPACT,
      color: '#EAF2FF', stroke: '#152250', strokeThickness: 6,
      shadow: { offsetX: 1, offsetY: 2, color: accentCss, blur: 8, fill: true },
    }).setOrigin(0.5, 0);
    this.add.text(CX, 88, meta.subtitle, {
      fontSize: '17px', fontFamily: IMPACT,
      color: accentCss, stroke: '#070A18', strokeThickness: 3,
    }).setOrigin(0.5, 0);

    const panelX = 24;
    const panelY = 244;
    const panelW = 398;
    const panelH = 113;
    const panel = this.add.graphics();
    panel.fillStyle(0x040711, 0.90);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    panel.lineStyle(2, accent, 0.92);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);
    panel.lineStyle(1, 0xE4EEFF, 0.40);
    panel.lineBetween(panelX + 15, panelY + 30, panelX + panelW - 15, panelY + 30);

    this.add.text(panelX + 16, panelY + 9, 'RUN REPORT', {
      fontSize: '12px', fontFamily: IMPACT, color: '#EAF2FF',
      letterSpacing: 2,
    });

    const viceLabel = VICE_CONFIG[this.deathVice]?.label ?? null;
    const rows = isBust
      ? [
          ['CHARGE', this.charge || 'RECKLESS DRIVING'],
          ['DISTANCE / TIME', `${this.finalMiles.toFixed(2)} MI   ${this._formatRunTime()}`],
          ['BAIL LOSSES', `-$${Math.max(0, this.losses).toLocaleString()}`],
        ]
      : [
          ['CAUSE', viceLabel ? `${viceLabel} BLACKOUT` : 'PASSED OUT'],
          ['DISTANCE / TIME', `${this.finalMiles.toFixed(2)} MI   ${this._formatRunTime()}`],
          ['CASH', `$${this.finalScore.toLocaleString()}`],
        ];
    rows.forEach(([label, value], idx) => {
      const y = panelY + 38 + idx * 17;
      this.add.text(panelX + 16, y, `${label}:`, {
        fontSize: '11px', fontFamily: IMPACT, color: idx % 2 ? secondCss : accentCss,
      });
      this.add.text(panelX + 162, y, value, {
        fontSize: '11px', fontFamily: IMPACT, color: '#FFFFFF',
      });
    });

    // Right-side action column — centred in the space to the RIGHT of the
    // RUN REPORT panel (panel ends at x=422) so the buttons + crisis-support
    // text no longer overlap it.  611 = midpoint of [422, SCREEN_W=800], so
    // the 242-wide buttons clear the panel with equal margins each side.
    const RIGHT_CX = 611;
    const cp = this.lastCheckpoint;
    this._makeNeonButton(RIGHT_CX, 263, 242, 39, 'RESTART', accent, () => this._retrySameSettings());
    this._makeNeonButton(RIGHT_CX, 310, 242, 39, 'START OVER', 0x2D9BFF, () => this._startOver());

    this.add.text(RIGHT_CX, 365, 'NEED SUPPORT?', {
      fontSize: '12px', fontFamily: IMPACT, color: accentCss,
    }).setOrigin(0.5, 0);
    this.add.text(RIGHT_CX, 383, 'CALL OR TEXT 988  |  CRISIS SUPPORT', {
      fontSize: '11px', fontFamily: IMPACT, color: '#FFFFFF',
    }).setOrigin(0.5, 0);
    this.add.text(RIGHT_CX, 400, 'SAMHSA: 1-800-662-HELP (4357)', {
      fontSize: '10px', fontFamily: IMPACT, color: '#D6E8FF',
    }).setOrigin(0.5, 0);
    this.add.text(CX, 432, isBust
      ? "IT'S NOT JUST YOUR LIFE. IT'S EVERYONE ELSE'S."
      : 'HELP IS AVAILABLE. YOU DO NOT HAVE TO DO THIS ALONE.', {
      fontSize: '10px', fontFamily: IMPACT, color: '#A9B7CC',
      letterSpacing: 1,
    }).setOrigin(0.5);

    if (this.viceSummary) {
      this._makeNeonButton(SCREEN_W - 68, 20, 114, 25, 'VICE LOG', accent, () => this._openViceLog());
    }
    this.input.keyboard?.once('keydown-SPACE', () => this._retrySameSettings());
    this.input.keyboard?.once('keydown-ENTER', () => this._startOver());
    this.input.keyboard?.on('keydown-L', () => this._openViceLog());
  }

  _formatRunTime() {
    const total = Math.max(0, Math.floor(this.runTimeSec ?? 0));
    const min = Math.floor(total / 60).toString().padStart(2, '0');
    const sec = (total % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  /** Fully broken windshield laid above the wreck artwork, below the UI text. */
  _drawWreckedGlass() {
    // Created after the artwork/scrim and before labels/buttons, so default
    // display order gives glass-over-scene without cracking the UI itself.
    const g = this.add.graphics();
    const hubs = [
      [638, 104, 94, 7], [172, 162, 112, 8],
      [534, 282, 126, 8], [286, 76, 104, 7],
    ];
    for (const [cx, cy, radius, arms] of hubs) {
      g.lineStyle(3, 0x111820, 0.42);
      for (let pass = 0; pass < 2; pass++) {
        g.lineStyle(pass === 0 ? 3 : 2, pass === 0 ? 0x111820 : 0xEAF6FF, pass === 0 ? 0.42 : 0.92);
        for (let i = 0; i < arms; i++) {
          const ang = i * (Math.PI * 2 / arms) + cx * 0.002;
          const bend = Math.sin(i * 7.3 + cy) * 0.24;
          const mx = cx + Math.cos(ang) * radius * 0.54;
          const my = cy + Math.sin(ang) * radius * 0.54;
          const ex = cx + Math.cos(ang + bend) * radius;
          const ey = cy + Math.sin(ang + bend) * radius;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(mx, my);
          g.lineTo(ex, ey);
          g.strokePath();
          if ((i % 2) === 0) {
            g.beginPath();
            g.moveTo(mx, my);
            g.lineTo(mx + Math.cos(ang + 1.05) * radius * 0.28, my + Math.sin(ang + 1.05) * radius * 0.28);
            g.strokePath();
          }
        }
      }
      g.fillStyle(0xF2FAFF, 0.90);
      g.fillCircle(cx, cy, 3);
    }
  }

  /** Pop a modal overlay listing every vice's run status + unlock hints. */
  _openViceLog() {
    if (this._viceLogOpen) return;
    this._viceLogOpen = true;

    const layer = this.add.container(0, 0).setDepth(100);

    // Dim scrim — full-screen, click anywhere outside the panel to close.
    const scrim = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 0.85)
      .setOrigin(0).setInteractive();
    layer.add(scrim);

    // Title
    const title = this.add.text(CX, 22, 'VICE LOG — THIS RUN', {
      fontSize: '20px', fontFamily: IMPACT,
      color: '#FFCC44', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    layer.add(title);

    // Two-column rows — ONLY unlocked vices are listed.  Locked ones are
    // hidden entirely so which (and how many) remain is a surprise (per
    // user); their unlock method is revealed only AFTER they're unlocked.
    const COL_X    = [SCREEN_W * 0.04, SCREEN_W * 0.52];
    const COL_W    = SCREEN_W * 0.44;
    const ROW_H    = 60;
    const TOP_Y    = 60;

    const unlockedVices = VICE_ORDER.filter(id => !!(this.viceSummary[id]?.unlocked));

    unlockedVices.forEach((id, fIdx) => {
      const col = fIdx % 2;
      const row = (fIdx / 2) | 0;
      const x   = COL_X[col];
      const y   = TOP_Y + row * ROW_H;

      const cfg     = VICE_CONFIG[id] ?? {};
      const summary = this.viceSummary[id] ?? {};
      const peakPct = Math.round((summary.maxReached ?? 0) * 100);
      const picks   = summary.pickupCount ?? 0;

      // Status string + colour.  "Used" includes any path that left a
      // detectable footprint on the bar — pickups, rest-stop restocks,
      // and dealer buys all push maxReached above 0.  Counting just
      // pickupCount missed restock-bought vices (rest-stop RESTOCK refills
      // every unlocked bar to 60% without incrementing pickupCount).
      const usedAny = picks > 0 || peakPct > 0;
      let status, statusColor;
      if (!usedAny) {
        status      = '⊕ UNLOCKED — never used';
        statusColor = '#88CCFF';
      } else {
        const pickupLabel = picks > 0 ? `   ${picks}× pickup` : '';
        status      = `✓ PEAK ${peakPct}%${pickupLabel}`;
        statusColor = '#88FF88';
      }

      const label = this.add.text(x, y, cfg.label ?? id, {
        fontSize: '15px', fontFamily: IMPACT,
        color: cfg.hexCss ?? '#FFFFFF', stroke: '#000', strokeThickness: 2,
      });
      const stat = this.add.text(x, y + 18, status, {
        fontSize: '11px', fontFamily: 'Arial',
        color: statusColor, wordWrap: { width: COL_W },
      });
      layer.add([label, stat]);

      // How it was unlocked — revealed now that it IS unlocked.  Starter
      // vices (Sushi / Burrito) have no unlock method, so the line is omitted.
      if (UNLOCK_HINTS[id]) {
        const how = this.add.text(x, y + 34, `🔓 ${UNLOCK_HINTS[id]}`, {
          fontSize: '10px', fontFamily: 'Arial',
          color: '#CCCCCC', fontStyle: 'italic',
          wordWrap: { width: COL_W },
        });
        layer.add(how);
      }
    });

    // Count-free teaser when undiscovered vices remain — signals there's
    // more to find WITHOUT revealing which or how many (keeps the surprise).
    if (unlockedVices.length < VICE_ORDER.length) {
      const gridRows = Math.ceil(unlockedVices.length / 2);
      const teaseY = TOP_Y + gridRows * ROW_H + 4;
      const tease = this.add.text(CX, teaseY, '🔒 More to discover — keep driving…', {
        fontSize: '12px', fontFamily: IMPACT,
        color: '#9A8CCB', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0);
      layer.add(tease);
    }

    // Close button — bottom centre + scrim click + Esc key.
    const closeBtn = this._makeButton(
      CX, SCREEN_H - 30, 160, 36,
      'CLOSE  (Esc)',
      0x884444, 0xFFFFFF,
      () => this._closeViceLog(layer),
    );
    layer.add([closeBtn.bg, closeBtn.txt]);
    scrim.on('pointerdown', () => this._closeViceLog(layer));
    this.input.keyboard?.once('keydown-ESC', () => this._closeViceLog(layer));

    this._viceLogLayer = layer;
  }

  _closeViceLog(layer) {
    if (!this._viceLogOpen) return;
    this._viceLogOpen = false;
    layer?.destroy();
    this._viceLogLayer = null;
  }

  // ── Trip summary (owner 2026-07-29 directive) ─────────────────────────
  // Tabbed recap shown only on a Pullman arrival: score/money/missions/road/
  // rest-stop breakdowns pulled from the StatsTracker session snapshot
  // GameScene captured right before ending the trip (this.tripSummary).

  _fmtMoney(n) { return `$${Math.round(n ?? 0).toLocaleString()}`; }

  _fmtDuration(sec) {
    const total = Math.max(0, Math.round(sec ?? 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  _openTripSummary() {
    if (this._summaryOpen) return;
    this._summaryOpen = true;

    const layer = this.add.container(0, 0).setDepth(110);
    const scrim = this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x000000, 0.90)
      .setOrigin(0).setInteractive();
    layer.add(scrim);

    layer.add(this.add.text(CX, 14, 'TRIP SUMMARY — PULLMAN, WA', {
      fontSize: '18px', fontFamily: IMPACT, color: '#88FF88', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0));

    const TABS = [
      { key: 'overview',  label: 'OVERVIEW' },
      { key: 'money',     label: 'MONEY' },
      { key: 'missions',  label: 'MISSIONS' },
      { key: 'road',      label: 'ROAD' },
      { key: 'reststops', label: 'REST STOPS' },
    ];
    const TAB_Y = 42, TAB_H = 24;
    const tabW = Math.min(150, (SCREEN_W - 24) / TABS.length);
    const tabBtns = {};
    this._summaryTab = this._summaryTab ?? 'overview';

    const redrawTabs = () => {
      TABS.forEach((t, i) => {
        const bg = tabBtns[t.key].bg;
        bg.setFillStyle(t.key === this._summaryTab ? 0x2A6A3A : 0x14202A, 1);
      });
    };

    TABS.forEach((t, i) => {
      const tx = 12 + tabW * i + tabW / 2;
      const bg = this.add.rectangle(tx, TAB_Y, tabW - 4, TAB_H, 0x14202A, 1)
        .setStrokeStyle(1, 0x448866).setInteractive({ useHandCursor: true }).setDepth(111);
      const txt = this.add.text(tx, TAB_Y, t.label, {
        fontSize: '10px', fontFamily: IMPACT, color: '#EAF8EE',
      }).setOrigin(0.5).setDepth(112);
      bg.on('pointerdown', (ptr) => { ptr.event?.stopPropagation?.(); this._summaryTab = t.key; redrawTabs(); drawContent(); });
      layer.add([bg, txt]);
      tabBtns[t.key] = { bg, txt };
    });
    redrawTabs();

    const contentLayer = this.add.container(0, 0).setDepth(111);
    layer.add(contentLayer);

    const CONTENT_X = 24;
    const CONTENT_Y = 76;
    const CONTENT_W = SCREEN_W - 48;

    const row = (y, label, value, color = '#FFFFFF') => {
      const l = this.add.text(CONTENT_X, y, label, { fontSize: '12px', fontFamily: 'Arial', color: '#9FC9FF' });
      const v = this.add.text(CONTENT_X + CONTENT_W, y, value, { fontSize: '12px', fontFamily: IMPACT, color }).setOrigin(1, 0);
      contentLayer.add([l, v]);
      return y + 18;
    };
    const heading = (y, text) => {
      const h = this.add.text(CONTENT_X, y, text, {
        fontSize: '13px', fontFamily: IMPACT, color: '#88FF88', stroke: '#000', strokeThickness: 2,
      });
      contentLayer.add(h);
      return y + 20;
    };

    const EARN_LABELS = {
      distance: 'Distance driven', collision: 'Collision cash', hitchhiker: 'Hitchhikers',
      completionBonus: 'Completion bonus', restStopBonus: 'Rest-stop bonus', girlParty: 'Companionship',
      pickup: 'Roadside pickups', mission: 'Mission payouts', other: 'Other',
    };
    const SPEND_LABELS = {
      vices: 'Vices', weapons: 'Weapons', vehicles: 'Vehicles', accessories: 'Accessories',
      gas: 'Gas', repairs: 'Repairs', upgrades: 'Upgrades', services: 'Services',
    };
    const MISSION_LABELS = {
      delivery: 'Delivery', passenger: 'Passenger', timed: 'Rush', heat: 'Lost the tail', weather: 'Dare run', unknown: 'Other',
    };

    const drawContent = () => {
      contentLayer.removeAll(true);
      const s = this.tripSummary ?? {};
      let y = CONTENT_Y;

      if (this._summaryTab === 'overview') {
        y = row(y, 'FINAL SCORE', this._fmtMoney(this.finalScore));
        y = row(y, 'DISTANCE', `${this.finalMiles.toFixed(1)} mi`);
        y = row(y, 'TRIP TIME', this._fmtDuration(this.runTimeSec));
        y = row(y, 'TOP SPEED', `${Math.round(s.topSpeed ?? 0)} mph`);
        y = row(y, 'MISSIONS COMPLETED', `${s.missions?.completedTotal ?? 0}`);
        y = row(y, 'COPS DIVERTED', `${(s.copsDiverted?.weapon ?? 0) + (s.copsDiverted?.distance ?? 0)}`);
      }

      if (this._summaryTab === 'money') {
        y = heading(y, 'EARNED');
        const bySource = s.earnedBySource ?? {};
        const srcKeys = Object.keys(bySource).filter(k => bySource[k] > 0);
        if (!srcKeys.length) y = row(y, 'Nothing earned this trip', '');
        for (const k of srcKeys) y = row(y, EARN_LABELS[k] ?? k, this._fmtMoney(bySource[k]), '#88FF88');
        y = row(y, 'TOTAL EARNED', this._fmtMoney(s.earned ?? 0), '#88FF88');
        y += 8;
        y = heading(y, 'SPENT');
        const byCat = s.spentByCategory ?? {};
        const catKeys = Object.keys(byCat).filter(k => byCat[k] > 0);
        if (!catKeys.length) y = row(y, 'Nothing spent this trip', '');
        for (const k of catKeys) y = row(y, SPEND_LABELS[k] ?? k, this._fmtMoney(byCat[k]), '#FF8888');
        y = row(y, 'TOTAL SPENT', this._fmtMoney(s.spent ?? 0), '#FF8888');
      }

      if (this._summaryTab === 'missions') {
        const byType = s.missions?.byType ?? {};
        const typeKeys = Object.keys(byType);
        y = row(y, 'TOTAL COMPLETED', `${s.missions?.completedTotal ?? 0}`);
        y += 6;
        if (!typeKeys.length) {
          y = row(y, 'No missions completed this trip', '');
        } else {
          for (const k of typeKeys) {
            const t = byType[k];
            y = row(y, `${MISSION_LABELS[k] ?? k}  (×${t.count})`, this._fmtMoney(t.payout), '#88FF88');
          }
        }
      }

      if (this._summaryTab === 'road') {
        y = row(y, 'CARS HIT', `${s.npcHits ?? 0}`);
        y = row(y, 'DAMAGE TAKEN', `${Math.round(s.damageTaken ?? 0)} HP`);
        y = row(y, 'TOP SPEED', `${Math.round(s.topSpeed ?? 0)} mph`);
        y += 8;
        y = heading(y, 'COPS');
        y = row(y, 'Diverted — weapon', `${s.copsDiverted?.weapon ?? 0}`);
        y = row(y, 'Diverted — outran', `${s.copsDiverted?.distance ?? 0}`);
        y += 8;
        y = heading(y, 'ENCOUNTERS');
        y = row(y, 'Hitchhikers picked up', `${s.hitchhikers ?? 0}  (${s.hitchhikersGood ?? 0} good / ${s.hitchhikersBad ?? 0} bad)`);
        if ((s.robberies ?? 0) > 0) y = row(y, 'Times robbed', `${s.robberies} — ${this._fmtMoney(s.robbedAmount)} lost`, '#FF8888');
      }

      if (this._summaryTab === 'reststops') {
        y = row(y, 'TIME AT REST STOPS', this._fmtDuration(s.pitstopSec ?? 0));
        y += 8;
        // % of the upgrade catalog installed — one shared vehicle record
        // across every genre skin (owner 2026-07-29: "each vehicle's
        // upgrades are identical"), so this is a single global number.
        try {
          const save = this.registry?.get?.('save');
          const vehicleId = s.vehicleId ?? 'beater';
          const installed = save ? getInstalled(save, vehicleId) : {};
          let owned = 0, total = 0;
          for (const slot of UPGRADE_SLOTS) {
            const tiers = getSlotTiers(slot);
            if (!tiers.length) continue;
            total += tiers.length;
            const curId = installed[slot];
            const curLvl = curId ? (tiers.find(t => t.id === curId)?.level ?? 0) : 0;
            owned += Math.min(curLvl, tiers.length);
          }
          const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
          y = heading(y, 'GARAGE');
          y = row(y, 'Upgrade levels owned', `${owned}/${total}  (${pct}%)`);
        } catch (_) { /* best-effort — save/upgrade data may be unavailable */ }
      }
    };
    drawContent();

    const closeBtn = this._makeButton(
      CX, SCREEN_H - 26, 160, 34,
      'CLOSE  (Esc)',
      0x884444, 0xFFFFFF,
      () => this._closeTripSummary(layer),
    );
    layer.add([closeBtn.bg, closeBtn.txt]);
    scrim.on('pointerdown', () => this._closeTripSummary(layer));
    this.input.keyboard?.once('keydown-ESC', () => this._closeTripSummary(layer));

    this._summaryLayer = layer;
  }

  _closeTripSummary(layer) {
    if (!this._summaryOpen) return;
    this._summaryOpen = false;
    layer?.destroy();
    this._summaryLayer = null;
  }

  _makeNeonButton(cx, cy, w, h, label, neonColor, onClick) {
    const g = this.add.graphics().setDepth(50);
    const draw = (hover = false) => {
      g.clear();
      g.fillStyle(0x050812, hover ? 0.97 : 0.90);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 5);
      g.lineStyle(hover ? 3 : 2, neonColor, 1);
      g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 5);
    };
    draw(false);
    g.setInteractive(
      new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    g.input.cursor = 'pointer';
    const css = `#${neonColor.toString(16).padStart(6, '0')}`;
    const txt = this.add.text(cx, cy, label, {
      fontSize: label.length > 17 ? '12px' : '15px',
      fontFamily: IMPACT,
      color: '#EEF5FF',
      stroke: css,
      strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5).setDepth(51);
    g.on('pointerover', () => draw(true));
    g.on('pointerout', () => draw(false));
    g.on('pointerdown', () => onClick?.());
    return { bg: g, txt };
  }

  _makeImageButtonZone(points, neonColor, onClick) {
    // Use a real Rectangle GAME OBJECT (invisible) as the hit target —
    // this gives Phaser a proper sized + positioned interactive object,
    // not a Graphics with a custom hit area.  Polygon hit tests on
    // Graphics fail on touch in Phaser 3.  A Rectangle game object
    // gets correct touch + click + pointerdown handling everywhere.
    //
    // A separate Graphics object draws the angled hover outline so the
    // visual affordance still matches the artwork.
    let minX =  Infinity, minY =  Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const outline = this.add.graphics().setDepth(50);
    const draw = (active = false) => {
      outline.clear();
      if (!active) return;
      outline.lineStyle(3, neonColor, 1);
      outline.strokePoints(points, true);
    };
    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setDepth(49)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', (ptr) => {
      ptr?.event?.stopPropagation?.();
      draw(true);
      onClick?.();
    });
    return hit;
  }

  /** Build a clean rectangle button with crisply-rendered text on top.
   *  Bumped depth to 50 so it sits above any later-added overlays (e.g.
   *  the vice-log scrim) and listens to BOTH pointerdown and pointerup
   *  so a touch that lifts on the button still counts as a click. */
  _makeButton(cx, cy, w, h, label, fillColor, textColor, onClick) {
    const bg = this.add.rectangle(cx, cy, w, h, fillColor, 1)
      .setOrigin(0.5).setStrokeStyle(2, 0x000000).setDepth(50)
      .setInteractive({ useHandCursor: true });
    const css = `#${textColor.toString(16).padStart(6, '0')}`;
    const txt = this.add.text(cx, cy, label, {
      fontSize: '16px',
      fontFamily: 'Arial Black, Arial, sans-serif',
      color: css,
      align: 'center',
      resolution: 2,
    }).setOrigin(0.5).setDepth(51);
    bg.on('pointerover', () => bg.setFillStyle(fillColor, 0.85));
    bg.on('pointerout',  () => bg.setFillStyle(fillColor, 1));
    let armed = false;
    bg.on('pointerdown', () => { armed = true; });
    bg.on('pointerup',   () => { if (armed) { armed = false; onClick?.(); } });
    bg.on('pointerout',  () => { armed = false; });
    return { bg, txt };
  }

  _restartAtCheckpoint(position) {
    const restartData = { resumeFromPosition: position };
    if (this.cause === 'busted') {
      // Busted already displayed/applied its bail loss before this screen.
      restartData.checkpointRestartScore = this.finalScore ?? 0;
    } else {
      // Wreck/pass-out checkpoint retries use the existing half-cash consequence.
      restartData.crashRestartScore = this.finalScore ?? 0;
    }
    this.scene.start('Game', restartData);
  }

  /** Retry the run with the same difficulty + steering settings —
   *  skip the title screen, preserve vice unlocks/progress, just drop
   *  the player straight into a fresh Seattle start.  Used by the
   *  RETRY button on the Crashed / Busted plate. */
  _retrySameSettings() {
    this.scene.start('Game', { skipTitle: true });
  }

  _startOver() {
    // Mirror the pause-menu Start Over wipe: clear persistent vice
    // unlocks, vice-progress, last-rest-stop pointer, and any leftover
    // Custom-mode opt-ins so a Custom run can't bleed `noPolice` /
    // `noNpcDamage` / starting stars into the fresh launch.  Without
    // this wipe, this scene's "START OVER" was semantically a "From
    // Checkpoint stripped of stars" — same persisted state, just zeroed
    // score.  GameScene.init() rebuilds scene-instance state from
    // registry, so wiping registry + save is enough here.
    this.registry?.remove?.('viceUnlocks');
    this.registry?.remove?.('viceProgress');
    const save = this.registry?.get?.('save');
    save?.set?.('lastRestStop', null);
    this.scene.start('Game', {});
  }

  _returnToTitle() {
    // Exit the ended run without wiping persistent saves/unlocks; a new
    // Game scene with no resume data presents the normal title screen.
    this.scene.start('Game', {});
  }
}
