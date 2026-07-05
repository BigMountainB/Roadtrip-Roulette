import Phaser from 'phaser';
import { SCREEN_W, SCREEN_H, HUD_OFFSET_X } from '../constants.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { flattenManifest } from '../systems/AssetManifest.js';
import { Wallet } from '../economy/Wallet.js';
import { StatsTracker } from '../systems/StatsTracker.js';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }); }

  preload() {
    const manifest = flattenManifest();
    // _failedKeys tracks ONLY keys that genuinely errored (404, decode
    // failure).  Previously we used _missingKeys = everything-not-yet-
    // -completed, which the safety timer could trip on while real loads
    // were still in flight — triggering placeholder generation that
    // then collided with the late-arriving real texture ("Texture key
    // already in use" spam in console).  loaderror is the authoritative
    // signal; only those keys deserve placeholders.
    this._failedKeys = new Set();

    // Decoupled-width: center the loading screen in the (possibly widened)
    // canvas from the FIRST frame.  The loading UI is built HERE in preload(),
    // before create(), and applyOrientation() widens the canvas via a rAF while
    // assets load — so without insetting the viewport now, the art sits
    // left-of-centre with black on the right.  Re-applied on resize.  No-op when
    // HUD_OFFSET_X=0.
    this._applyVP = () => { try { this.cameras.main.setViewport(HUD_OFFSET_X, 0, SCREEN_W, SCREEN_H); } catch (_) {} };
    this._applyVP();
    this.scale.on('resize', this._applyVP, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._applyVP, this));

    this._buildProgressBar();

    // Safety net for a genuinely STALLED loader (all-404 batch, dead
    // connection, a hung request).  It force-completes the boot only after
    // STALL_MS of ZERO load activity — and resets on every progress /
    // filecomplete / loaderror tick.  So a slow-but-advancing cold load (200+
    // assets over a sluggish dev server) is NEVER cut short; it waits as long
    // as bytes keep arriving, then Phaser's own load-complete fires create().
    // (Replaces a fixed 20s timer that tripped mid-load on slow servers and
    // left half the textures as green missing-texture placeholders.)
    const STALL_MS = 10000;
    const armStallTimer = () => {
      clearTimeout(this._safetyTimer);
      this._safetyTimer = setTimeout(() => {
        if (!this._createDone) {
          this._setProgress(1);
          try { this.create(); } catch (e) { console.error('[Boot safety]', e); }
        }
      }, STALL_MS);
    };

    this.load.on('progress', v => { this._setProgress(v); armStallTimer(); });
    this.load.on('filecomplete', key => {
      if (key === 'ui_loading_screen') this._mountLoadingBackdrop();
      armStallTimer();
    });
    this.load.on('loaderror', (file) => {
      if (file?.key) this._failedKeys.add(file.key);
      armStallTimer();   // a 404 is still activity — keep waiting for the rest
    });

    // Queue the splash first so it appears while heavier gameplay art
    // continues loading behind the progress bar.
    const loadingSplash = manifest.find(asset => asset.key === 'ui_loading_screen');
    if (loadingSplash) this.load.image(loadingSplash.key, loadingSplash.path);
    for (const { key, path } of manifest) {
      if (key === loadingSplash?.key) continue;
      this.load.image(key, path);
    }

    armStallTimer();   // arm initially in case the loader never even starts
  }

  create() {
    if (this._createDone) return;
    this._createDone = true;
    if (this._safetyTimer) clearTimeout(this._safetyTimer);

    // Re-assert the centered viewport (set up in preload along with the resize
    // listener) now that create() runs, in case the canvas widened between.
    this._applyVP?.();

    try {
      this._doCreate();
    } catch (e) {
      console.error('[BootScene.create] FAILED:', e);
      // Show error on screen so the player isn't stuck guessing.
      this.add.text(SCREEN_W / 2, SCREEN_H / 2 + 60, 'BOOT ERROR — check console', {
        fontSize: '14px', color: '#FF4444', backgroundColor: '#000',
      }).setOrigin(0.5);
    }
  }

  _doCreate() {
    // Legacy procedural textures still used by current GameScene code paths.
    // (Removed the orange 'player_car' fallback 2026-06-23 per user — the player
    //  car now renders its real per-vehicle art or NOTHING, never the orange box.)
    this._makeCarTexture('traffic_car', 0x4488FF, 0x3366CC);
    this._makeCarTexture('cop_car',     0x2244BB, 0x1133AA);
    // White-bodied car so NPC tint comes through clean (tint multiplies the
    // texture; tinting an orange body just gives muddy orange).
    this._makeCarTexture('npc_car_white', 0xFFFFFF, 0xDDDDDD);

    // For any manifest key whose PNG is missing, synthesize a placeholder
    // so downstream code can reference manifest keys safely.
    this._fillMissingPlaceholders();

    // (Removed: vice_energy procedural override.  The user is shipping a
    // real cocaine sprite under public/assets/drugs/cocaine.webp now and
    // the override was clobbering it on every boot.)

    // Shared singletons live on the registry.  (Garage / UpgradeShop /
    // BodyShop / TimeOfDay / MissionManager were here previously but
    // never read by any scene — vestigial from the abandoned hub-mode
    // design.  Removed in cleanup pass.)
    const save = new SaveSystem();
    // Align save profile with the user's current steering-mode pick BEFORE
    // Wallet reads `save.profile.money` — otherwise Wallet binds to the
    // default 'tap' profile, then any mode change leaves Wallet pointing
    // at the wrong slot.
    const mode = this.registry?.get?.('steeringMode')
              ?? (this.registry?.get?.('tiltSteerEnabled') ? 'tilt' : 'tap');
    save.setMode(mode);
    const wallet = new Wallet(save);
    // Career stats — lifetime counters that feed the stats menu + leaderboards.
    // Reads/writes the GLOBAL save bucket, so it's mode-agnostic.
    const stats = new StatsTracker(save);

    // AudioSystem is registered in main.js before the game even
    // boots so the iPhone-menu music app sees stations instantly.
    // Only create one here as a fallback if main.js didn't.
    if (!this.registry.get('audio')) {
      this.registry.set('audio', new AudioSystem());
    }
    this.registry.set('save',         save);
    this.registry.set('wallet',       wallet);
    this.registry.set('stats',        stats);

    // Apply the player's chosen default radio station (Music app) on boot.
    const _defStation = save.get('settings.radio', 0);
    if (Number.isInteger(_defStation) && _defStation > 0) {
      this.registry.get('audio')?.setStation?.(_defStation);
    }
    this.registry.get('audio')?.setBackgroundRadioEnabled?.(
      save.get('settings.backgroundRadio', true) !== false,
    );

    // Boot straight into GameScene — its own title overlay handles the
    // pre-start intro, so the road style is identical to gameplay (same
    // Road class, same painted asphalt) with no jarring scene transition.
    this.scene.start('Game');
  }

  _buildProgressBar() {
    this.cameras.main.setBackgroundColor('#03050D');
    this.add.rectangle(SCREEN_W / 2, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x03050D)
      .setDepth(-2);

    const w = 390, h = 10;
    const x = (SCREEN_W - w) / 2;
    const y = SCREEN_H - 32;

    this._loadingText = this.add.text(SCREEN_W / 2, y - 29, 'LOADING', {
      fontFamily: 'Impact, "Arial Black", Arial, sans-serif',
      fontSize: '22px',
      letterSpacing: 5,
      color: '#F4F7FF',
      stroke: '#FF39AF',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3)
      .setShadow(0, 0, '#FF39AF', 10, true, true);

    this._barBg = this.add.graphics();
    this._barBg.setDepth(3);
    this._barBg.fillStyle(0x040916, 0.90);
    this._barBg.fillRoundedRect(x - 7, y - 7, w + 14, h + 14, 10);
    this._barBg.lineStyle(4, 0x152E51, 0.55);
    this._barBg.strokeRoundedRect(x - 6, y - 6, w + 12, h + 12, 9);
    this._barBg.lineStyle(2, 0x39A8FF, 1);
    this._barBg.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 7);

    this._barGlow = this.add.graphics().setDepth(3);
    this._barFill = this.add.graphics().setDepth(4);
    this._barX = x;
    this._barY = y;
    this._barW = w;
    this._barH = h;
  }

  _setProgress(v) {
    if (!this._barFill) return;
    const fillW = this._barW * Math.max(0, Math.min(1, v));
    this._barGlow.clear();
    this._barFill.clear();
    if (fillW <= 0) return;
    this._barGlow.fillStyle(0x39A8FF, 0.14);
    this._barGlow.fillRoundedRect(this._barX - 3, this._barY - 3, fillW + 6, this._barH + 6, 6);
    this._barFill.fillGradientStyle(0x39D9FF, 0xFF39AF, 0x39D9FF, 0xFF39AF, 1);
    this._barFill.fillRoundedRect(this._barX, this._barY, fillW, this._barH, 4);
    this._barFill.fillStyle(0xFFFFFF, 0.45);
    this._barFill.fillRoundedRect(this._barX + 2, this._barY + 1, Math.max(0, fillW - 4), 2, 1);
  }

  _mountLoadingBackdrop() {
    if (this._loadingBackdrop || !this.textures.exists('ui_loading_screen')) return;
    this._loadingBackdrop = this.add.image(SCREEN_W / 2, SCREEN_H / 2, 'ui_loading_screen')
      .setDisplaySize(SCREEN_W, SCREEN_H)
      .setDepth(-1)
      .setAlpha(0);
    this.tweens.add({ targets: this._loadingBackdrop, alpha: 1, duration: 180 });
  }

  _fillMissingPlaceholders() {
    // Only generate placeholders for keys that explicitly errored
    // (loaderror).  Falling back on "anything not-yet-loaded" would
    // race the in-flight network/decode work and clobber real
    // textures with a placeholder, then Phaser warns about the
    // duplicate when the real image arrives.
    const failed = this._failedKeys ?? new Set();
    for (const key of failed) {
      if (this.textures.exists(key)) continue;
      this._makePlaceholder(key);
    }
  }

  _makePlaceholder(key) {
    if (key.startsWith('car_'))    return this._makeCarPlaceholder(key);
    if (key.startsWith('hooker_')) return this._makeHookerPlaceholder(key);
    if (key.startsWith('vice_'))   return this._makeDrugPlaceholder(key);
    if (key.startsWith('cop_'))    return this._makeCopPlaceholder(key);
    if (key.startsWith('ui_'))     return this._makeUIPlaceholder(key);
    if (key.startsWith('powerup_')) return this._makePowerupPlaceholder(key);
    if (key.startsWith('npc_'))     return this._makeNpcPlaceholder(key);
    this._makeBlank(key, 32, 32, 0xFF00FF);
  }

  /** Colored-bust placeholder for a rest-stop NPC portrait, so encounters are
   *  playable before real art exists.  Tint is derived from the key so each
   *  character reads as distinct. */
  _makeNpcPlaceholder(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xFFFFFF;
    const tint = (h | 0x404040) & 0xBFBFBF;   // keep it mid-toned, never too dark/bright
    const w = 200, ht = 220;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x0A0F1A, 1); g.fillRoundedRect(0, 0, w, ht, 10);
    g.fillStyle(tint, 1);
    g.fillCircle(w / 2, ht * 0.36, 46);
    g.fillEllipse(w / 2, ht * 1.02, 150, 120);
    g.fillStyle(0xFFFFFF, 0.14); g.fillCircle(w / 2 - 16, ht * 0.30, 12);
    g.lineStyle(4, 0x39A8FF, 0.7); g.strokeRoundedRect(2, 2, w - 4, ht - 4, 10);
    g.generateTexture(key, w, ht);
    g.destroy();
  }

  /** Procedural placeholder for power-up pickups, distinct from the circular
   *  drug baggies.  Steroid = gold syringe on a red roundel; Narcan = a
   *  blue rescue vial with a white medical cross.  Replaced by real art when
   *  the .webp is added. */
  _makePowerupPlaceholder(key) {
    if (key === 'powerup_espresso') return this._makeNarcanSprite(key);
    // Redneck Rage placeholder — a red energy CAN (no drug-styled art), shown
    // until redneck_rage.png is dropped into public/assets/vices/.
    const size = 56;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x000000, 0.35); g.fillCircle(size / 2 + 2, size / 2 + 2, size / 2 - 2);
    g.fillStyle(0xCC1133, 1);    g.fillCircle(size / 2,     size / 2,     size / 2 - 4);
    // Can body.
    g.fillStyle(0xB0202A, 1); g.fillRoundedRect(20, 12, 16, 32, 3);
    g.fillStyle(0x7A1620, 1); g.fillRect(20, 16, 16, 4);   // top band
    g.fillStyle(0xFFD23D, 1); g.fillRect(22, 24, 12, 4);   // label stripe
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Narcan rescue kit — a blue roundel + white nasal-spray vial with a red
   *  medical cross, reading clearly as "emergency medicine", not a drug. */
  _makeNarcanSprite(key) {
    const size = 56;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Blue roundel with soft shadow.
    g.fillStyle(0x000000, 0.35); g.fillCircle(size / 2 + 2, size / 2 + 2, size / 2 - 2);
    g.fillStyle(0x1565C0, 1);    g.fillCircle(size / 2,     size / 2,     size / 2 - 4);
    g.fillStyle(0x42A5F5, 1);    g.fillCircle(size / 2,     size / 2,     size / 2 - 9);
    // White vial body (upright nasal-spray bottle).
    g.fillStyle(0xFFFFFF, 1); g.fillRoundedRect(22, 22, 12, 22, 3);
    g.fillStyle(0xE0E0E0, 1); g.fillRect(24, 16, 8, 8);     // nozzle/cap
    // Red medical cross on the vial.
    g.fillStyle(0xE53935, 1);
    g.fillRect(27, 28, 2, 10);
    g.fillRect(24, 31, 8, 2.5);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  _makeCarPlaceholder(key) {
    const palette = {
      car_beater:      [0x886655, 0x554433],
      car_muscle:      [0xCC2222, 0x881111],
      car_sports:      [0xFFCC00, 0xCC9900],
      car_lowrider:    [0x9944CC, 0x661199],
      car_interceptor: [0x111133, 0x000022],
      car_van:         [0xFFFFFF, 0xCCCCCC],
    };
    const [body, roof] = palette[key] ?? [0x888888, 0x555555];
    this._makeCarTexture(key, body, roof);
  }

  _makeHookerPlaceholder(key) {
    const palette = {
      hooker_kimono:     [0xFF66AA, 0xFFCCDD],
      hooker_schoolgirl: [0x4488FF, 0xFFFFFF],
      hooker_club:       [0xFF2244, 0x222222],
      hooker_street:     [0xCC44FF, 0x441166],
    };
    const [primary, secondary] = palette[key] ?? [0xFF66AA, 0xFFCCDD];
    const w = 28, h = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xFFCC99); g.fillCircle(w / 2, 8, 6);
    g.fillStyle(primary);  g.fillRect(8, 14, w - 16, 28);
    g.fillStyle(secondary); g.fillRect(10, 38, w - 20, 18);
    g.fillStyle(0x111111); g.fillRect(11, 56, 4, 8); g.fillRect(w - 15, 56, 4, 8);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  _makeDrugPlaceholder(key) {
    // Neutral colored-disc placeholder per vice, shown until the real art is
    // dropped into public/assets/vices/.  (No drug-styled art — food/fatigue
    // theme; colors mirror DRUG_CONFIG.)
    const palette = {
      vice_sushi:     0x9ACD32,
      vice_burrito:   0xC8862B,
      vice_energy:    0x3AC8FF,
      vice_gummies:   0xFF5FA2,
      vice_hotdog:    0xD2691E,
      vice_combo:     0xE8A33D,
      vice_coldbrew:  0x8B5A2B,
      vice_coma:      0xB0303A,
      vice_slushie:   0x3AA0FF,
      vice_caffeine:  0xE8E8E8,
    };
    const color = palette[key] ?? 0xFFFFFF;
    const size = 48;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x000000, 0.4); g.fillCircle(size / 2 + 2, size / 2 + 2, size / 2 - 2);
    g.fillStyle(color, 1);       g.fillCircle(size / 2,     size / 2,     size / 2 - 4);
    g.fillStyle(0xFFFFFF, 0.5);  g.fillCircle(size / 2 - 6, size / 2 - 6, 4);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** Custom cocaine sprite — clear plastic baggie of white powder with a
   *  pinched red zip-tie at the top. Far more "drug pickup" than the plain
   *  white circle the procedural fallback was producing. */
  _makeCocaineSprite(key) {
    const w = 64, h = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Drop shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(w / 2, h - 6, w * 0.7, 6);

    // Baggie body — slightly translucent grey-blue to read as plastic.
    // Trapezoid shape (narrower at the top where the zip is pinched).
    g.fillStyle(0xC8DCEA, 0.35);
    g.fillPoints([
      { x: w * 0.18, y: h * 0.32 },
      { x: w * 0.82, y: h * 0.32 },
      { x: w * 0.92, y: h * 0.92 },
      { x: w * 0.08, y: h * 0.92 },
    ], true);

    // White powder filling the bottom 65% of the baggie (settled at base)
    g.fillStyle(0xFFFFFF, 1);
    g.fillPoints([
      { x: w * 0.22, y: h * 0.42 },
      { x: w * 0.78, y: h * 0.42 },
      { x: w * 0.88, y: h * 0.88 },
      { x: w * 0.12, y: h * 0.88 },
    ], true);

    // Powder texture — soft highlight + lump
    g.fillStyle(0xF4F4F4, 1);
    g.fillEllipse(w * 0.36, h * 0.62, w * 0.30, h * 0.16);
    g.fillStyle(0xE6E6E6, 1);
    g.fillEllipse(w * 0.62, h * 0.74, w * 0.22, h * 0.10);

    // Top edge of the powder line (slightly curved, gives volume)
    g.lineStyle(2, 0xCCCCCC, 0.7);
    g.strokeRect(w * 0.22, h * 0.42, w * 0.56, 1);

    // Plastic highlight running down the right side of the bag
    g.fillStyle(0xFFFFFF, 0.45);
    g.fillRect(w * 0.74, h * 0.36, 3, h * 0.50);

    // Pinched neck at the top
    g.fillStyle(0xC8DCEA, 0.6);
    g.fillRect(w * 0.34, h * 0.18, w * 0.32, h * 0.16);

    // Red zip-tie / twist closure
    g.fillStyle(0xC8141C, 1);
    g.fillRect(w * 0.30, h * 0.18, w * 0.40, h * 0.06);
    g.fillStyle(0xFF3344, 1);
    g.fillRect(w * 0.30, h * 0.18, w * 0.40, 2);

    // Tiny shine on the zip
    g.fillStyle(0xFFFFFF, 0.6);
    g.fillRect(w * 0.34, h * 0.20, w * 0.06, 1);

    // Outline so it pops against any background
    g.lineStyle(1, 0x111111, 0.85);
    g.strokePoints([
      { x: w * 0.18, y: h * 0.32 },
      { x: w * 0.82, y: h * 0.32 },
      { x: w * 0.92, y: h * 0.92 },
      { x: w * 0.08, y: h * 0.92 },
    ], true, true);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  _makeCopPlaceholder(key) {
    // Only cop_police is shipped as a real PNG now; everything else
    // falls back to the generic black blank.
    this._makeBlank(key, 64, 40, 0x000000);
  }

  _makeUIPlaceholder(key) {
    this._makeBlank(key, 32, 32, 0xFFFFFF);
  }

  _makeBlank(key, w, h, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  _makeCarTexture(key, bodyColor, roofColor) {
    const w = 64, h = 40;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(bodyColor);
    g.fillRect(4, 12, w - 8, 20);

    g.fillStyle(roofColor);
    g.fillRect(14, 4, w - 28, 14);

    g.fillStyle(0x88BBFF, 0.7);
    g.fillRect(16, 5, w - 32, 12);

    g.fillStyle(0x111111);
    g.fillEllipse(14, 32, 16, 12);
    g.fillEllipse(w - 14, 32, 16, 12);

    g.fillStyle(key === 'player_car' ? 0xFFFF88 : 0xFF4444);
    g.fillRect(4,  14, 6, 8);
    g.fillRect(w - 10, 14, 6, 8);

    g.generateTexture(key, w, h);
    g.destroy();
  }
}
