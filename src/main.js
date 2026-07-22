import Phaser from 'phaser';
import { BootScene }    from './scenes/BootScene.js';
import { GameScene }    from './scenes/GameScene.js';
import { RestStopScene } from './scenes/RestStopScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { SCREEN_W, SCREEN_H, VEHICLES, getLocationName, TOTAL_ROUTE_MILES, REST_STOPS, setWorldWidth } from './constants.js';
import { Weather } from './world/Weather.js';
import { GENRE_VEHICLE_TRAITS } from './data/genreVehicleTraits.js';
import { AchievementSystem } from './systems/AchievementSystem.js';
import { getVehicleDisplayStats } from './systems/VehicleStats.js';
import {
  getInstalled, getUpgradeEffects, buyUpgrade as installUpgrade,
} from './systems/UpgradeSystem.js';
import {
  UPGRADE_SLOTS, SLOT_LABELS, getSlotTiers, getUpgradeById,
} from './data/upgrades.js';
import { AudioSystem }       from './systems/AudioSystem.js';
import { CloudSave }         from './systems/CloudSave.js';
import { challengeForDate, weekDailies, DAILY_WEEKLY_BONUS, stageConfigFor, challengeById, DAILY_CHALLENGES } from './systems/DailyChallenges.js';

// Audio unlock is installed by an inline <script> at the top of
// index.html so the listener is in place BEFORE the module bundle is
// even fetched.  See window.__audioUnlockCount / __audioUnlockedRunning
// / __audioUnlockDiag for runtime state.

// ── Recovery + crash diagnostics ───────────────────────────────────────
// `?wipe` clears the local save (recover from a corrupted profile that
// boots the game into a broken/black state), then reloads clean.
try {
  if (/[?&]wipe\b/.test(window.location.search)) {
    try { localStorage.clear(); } catch (_) {}
    window.location.replace(window.location.pathname);
  }
} catch (_) {}

// On-screen crash overlay.  Phaser does NOT surface an uncaught throw in a
// scene's create()/update() — it just leaves a silent black screen.  Catch
// real JS errors and print the message + stack so they're diagnosable on a
// phone with no console.  (Add ?wipe to the URL to reset the save.)
(() => {
  let shown = false;
  const show = (label, err) => {
    if (shown) return; shown = true;
    const msg = (err && (err.stack || err.message)) || String(err);
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0a0012f2;color:#FF9FD0;'
      + 'font:12px/1.45 monospace;padding:18px;overflow:auto;white-space:pre-wrap;'
      + '-webkit-user-select:text;user-select:text;';
    d.textContent = '⚠ ' + label + '\n\n' + msg + '\n\n(add  ?wipe  to the URL to reset your save)';
    document.body.appendChild(d);
  };
  // Stamp a one-shot crash marker so the next boot can tell a genuine JS
  // crash apart from a deliberate quit (swipe-up close) or an iOS background
  // discard — only a real exception fires these handlers.  GameScene reads +
  // clears it: crash → auto-resume + "we lost you"; clean exit → title + a
  // RESUME button instead.
  const markCrash = () => { try { localStorage.setItem('rtr_crashed', '1'); } catch (_) {} };
  window.addEventListener('error', (e) => { if (e.error) { markCrash(); show('Uncaught error', e.error); } });
  window.addEventListener('unhandledrejection', (e) => { markCrash(); show('Unhandled rejection', e.reason); });
})();

// ── Decoupled world width (Task 4) ───────────────────────────────────────
// Boot at the safe 800 design width; applyOrientation() (called on the first
// rAF and on every resize/rotation) measures the ACTUAL #game-root box — which
// is inset by the device safe-area, so it's narrower than the raw window — and
// widens the canvas to that box's aspect via setGameSize so FIT fills it
// edge-to-edge with no side/bottom bars.  Sizing the canvas from the window
// instead over-estimates the width and reintroduces letterboxing, so this MUST
// derive from the rendered container, not window.innerWidth.
const config = {
  type: Phaser.AUTO,
  width:  SCREEN_W,
  height: SCREEN_H,
  backgroundColor: '#000000',
  scale: {
    // Mount inside #game-root (inset to the device safe area in index.html),
    // not the raw <body>, so FIT scales the game into the USABLE screen and
    // edge buttons clear camera cutouts / rounded corners / the nav bar on
    // every phone.  expandParent:false keeps Phaser from overriding the
    // container's safe-area sizing.  The canvas is WORLD_W×450 sized to the
    // device's landscape aspect, so FIT fills the width edge-to-edge (no side
    // letterbox) on wide phones; the full design is always visible.
    parent:          'game-root',
    expandParent:    false,
    mode:            Phaser.Scale.FIT,
    autoCenter:      Phaser.Scale.CENTER_BOTH,
    zoom: window.devicePixelRatio || 1,
  },
  input: {
    activePointers: 3,
  },
  // Raw frame deltas.  Phaser's default 10-frame delta smoothing seeds at
  // 60fps, so the startup jank window (texture uploads / shader compiles)
  // simulated less time than actually passed — the whole world ran in slow
  // motion for the first seconds, then "sped up".  Raw deltas keep sim time
  // true to wall time; the jank itself is hidden behind the intro warm-up.
  fps: { smoothStep: false },
  render: {
    antialias:        true,
    pixelArt:         false,
    roundPixels:      false,
    powerPreference: 'high-performance',
  },
  scene: [BootScene, GameScene, RestStopScene, GameOverScene],
};

// Run as soon as the DOM is parsed — was previously gated on
// `window.load` which only fires after every image/font has finished
// downloading.  On a slow connection that's seconds during which
// `window.__music` (and the registry) didn't exist, so the iPhone-
// menu music app saw an empty station list and showed "Loading…"
// indefinitely.  DOMContentLoaded is the right trigger — by then
// the body element exists and Phaser can mount its canvas.
const _boot = () => {
  const game = new Phaser.Game(config);

  // ── Text-entry vs. game keyboard ─────────────────────────────────────
  // The game binds driving / hotkeys (W A S D F M R Q, Space, Enter, arrows)
  // through Phaser's keyboard, which CAPTURES them (preventDefault) globally
  // and also runs on('keydown') handlers (dev-warp digits, Shift+L handedness,
  // etc.).  While the player is typing in an HTML field (the license-plate name
  // box, code entry…) that swallows those letters and can trigger game actions
  // mid-type.  So: suspend Phaser's keyboard (handlers + key captures) whenever
  // a text field is focused, and restore it on blur.
  let _savedKeyCaptures = null;
  const _gameKb = () => game.scene?.getScene?.('Game')?.input?.keyboard;
  const _isTextField = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  const _suspendGameKeys = () => {
    const k = _gameKb();
    if (!k || _savedKeyCaptures !== null) return;   // already suspended
    try {
      _savedKeyCaptures = k.getCaptures?.() ?? [];
      k.clearCaptures?.();          // stop preventDefault — let letters reach the input
    } catch (_) { _savedKeyCaptures = []; }
    k.enabled = false;              // stop driving/hotkey handlers from firing
  };
  const _resumeGameKeys = () => {
    const k = _gameKb();
    if (k) {
      k.enabled = true;
      try { if (_savedKeyCaptures && _savedKeyCaptures.length) k.addCaptures?.(_savedKeyCaptures); } catch (_) {}
    }
    _savedKeyCaptures = null;
  };
  document.addEventListener('focusin',  (e) => { if (_isTextField(e.target)) _suspendGameKeys(); });
  document.addEventListener('focusout', (e) => { if (_isTextField(e.target)) _resumeGameKeys(); });

  // Register the AudioSystem on the registry IMMEDIATELY so the
  // iPhone-menu music app can read stations without waiting for
  // Phaser's BootScene to finish preloading assets.  BootScene later
  // checks for an existing instance instead of overwriting this one,
  // so save/wallet still get wired up the same way.
  if (!game.registry.get('audio')) {
    const _audio = new AudioSystem();
    game.registry.set('audio', _audio);
    // Expose so the inline unlock script can boot music as soon as
    // iOS lets us — regardless of which button the user tapped first.
    window.__audio = _audio;
    if (window.__audioUnlockedRunning) {
      try { _audio.init?.(); } catch (_) {}
    }
  }

  // Block native touch behavior everywhere EXCEPT inside the
  // phone-menu HTML overlay.  The overlay's modals (music list,
  // trophy list, volume slider) need native scroll + drag, so those
  // touches pass through.  Everything else (the game canvas, the
  // landscape title screen, pause menu) gets preventDefault so
  // Phaser's input pipeline isn't competing with iOS scroll/zoom.
  const _blockGameTouch = (e) => {
    // The phone-menu overlay AND the license-plate modal need native
    // touch (scroll, input focus, the on-screen keyboard, button taps),
    // so their touches pass through untouched.  Everything else (game
    // canvas, landscape title screen) gets preventDefault so iOS
    // scroll/zoom doesn't fight Phaser's input pipeline.  Without the
    // #plate-modal exemption the plate input never focused (no keyboard,
    // so "can't change the name") and the DONE/CANCEL taps were swallowed
    // — the whole picker looked frozen.
    // #rtr-load (the "load game" modal) needs the same exemption as
    // #plate-modal — without it the input never focuses (no keyboard) and the
    // CANCEL/RESUME taps are swallowed (buttons invert on touch but their click
    // never fires), which looked frozen from the title.
    if (e.target?.closest?.('#phone-menu, #plate-modal, #rtr-load')) return;
    e.preventDefault();
  };
  document.addEventListener('touchstart', _blockGameTouch, { passive: false });
  document.addEventListener('touchmove',  _blockGameTouch, { passive: false });
  document.addEventListener('touchend',   _blockGameTouch, { passive: false });

  // Phone-as-menu pause/resume.
  // Flow:
  //   portrait → pause Game/RestStop, show HTML menu overlay (CSS does
  //   the visibility flip).
  //   landscape → game stays PAUSED on a "tap anywhere to resume" hold
  //   until the player's first pointerdown.  Lock-pause skips the
  //   tap-resume entirely (player must tap the in-game pause button or
  //   unlock from the portrait menu).
  // iOS dispatches orientationchange BEFORE window.innerWidth/Height
  // update, so the check is deferred to the next animation frame.
  const SCENES_TO_PAUSE = ['Game', 'RestStop'];
  let lockedByPhone = false;
  let pendingTapResume = false;

  // Desktop detection — a fine pointer + hover capability (a mouse) marks a
  // desktop.  Phones/tablets cross between the portrait iPhone menu and
  // landscape gameplay by ROTATING the device; on desktop you can't rotate,
  // so we expose explicit buttons instead (the "iPHONE MENU" button in the
  // pause overlay + the "enter gameplay" button on the menu, both wired
  // through window.__phoneMenu below).  The body class drives desktop-only CSS.
  const IS_DESKTOP = !!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;
  window.__isDesktop = IS_DESKTOP;
  document.body.classList.toggle('is-desktop', IS_DESKTOP);

  // DOM-side handles for the menu overlay JS (lock button, steering
  // mode highlight, player-position dot on the map).
  window.__phoneLock = {
    get: () => lockedByPhone,
    set: (v) => {
      lockedByPhone = !!v;
      // Try the Screen Orientation API first.  Lock the iPhone menu
      // to portrait (the menu's design orientation) using the shorthand
      // 'portrait' literal — iOS Safari is more reliable with the
      // shorthand than with 'portrait-primary'.  Logs failures so the
      // user can verify behavior via Safari remote debug.
      try {
        if (lockedByPhone) {
          const p = screen.orientation?.lock?.('portrait');
          if (p && typeof p.then === 'function') {
            p.then(()  => console.log('[Lock] portrait lock OK'))
             .catch(e => console.warn('[Lock] portrait lock rejected:', e?.message ?? e));
          }
        } else {
          screen.orientation?.unlock?.();
        }
      } catch (e) {
        console.warn('[Lock] orientation API threw:', e?.message ?? e);
      }
      // CSS fallback — body class lets the stylesheet rotate the menu
      // back to a portrait look when iOS won't physically lock the
      // device (Safari outside PWA standalone, older iOS, etc.).
      document.body.classList.toggle('phone-locked', lockedByPhone);
      // While locked we want the game paused even if the player is
      // currently landscape — re-evaluate to enforce it.
      requestAnimationFrame(() => applyOrientation());
    },
  };
  // Desktop-only bridge between the in-game pause overlay and the iPhone
  // menu.  On a phone you rotate the device to cross between gameplay and the
  // menu; on desktop these two calls stand in for that rotation.  Both reuse
  // the scene's own _togglePause so the audio / HUD side-effects stay
  // identical to a normal SPACE-key pause/resume.
  //   open()  — show the iPhone menu over the (already-paused) game.
  //   close() — hide the menu and resume the run ("enter gameplay").
  window.__phoneMenu = {
    open: () => {
      const gs = game.scene.getScene('Game');
      // The pause overlay (where the PHONE MENU button lives) is already
      // paused; guard anyway so opening from anywhere leaves us paused.
      if (gs && !gs._paused && !gs._awaitingStart) gs._togglePause();
      document.body.classList.add('menu-locked');     // force the menu visible
      // It was display:none until now, so its hit zones never laid out
      // against a real box — recompute once it's on screen.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    },
    close: () => {
      document.body.classList.remove('menu-locked');
      const gs = game.scene.getScene('Game');
      if (gs && gs._paused) gs._togglePause();         // resume gameplay
    },
  };
  window.__phaserGame = game;          // for the menu's map renderer
  window.__restStops  = REST_STOPS;    // for the phone-map "Next Rest Stop" panel
  // Daily Challenges ("Run of the Day") bridge — read by the phone Calendar
  // app.  Data comes from the DailyChallenges registry; per-profile completion
  // from the save.  `start()` is stubbed until the stage runner lands, so the
  // Calendar shows a full read-only preview now (Play flips on next increment).
  // Dev/QA flag — `?dev=1` in the URL enables dev-only affordances (the
  // Calendar's "Test any run" launcher, in-game route warps, debug overlay).
  // Beta testers on a plain URL never see them.  Single source of truth,
  // read here and by the inline Calendar script in index.html.
  try { window.__DEV = new URLSearchParams(window.location.search).get('dev') === '1'; }
  catch (_) { window.__DEV = false; }
  window.__daily = {
    today() {
      const c = challengeForDate();
      return c ? { id: c.id, name: c.name, blurb: c.blurb, from: c.from, to: c.to } : null;
    },
    week() {
      const prog = game.registry.get('save')?.get?.('dailyChallenges', {}) ?? {};
      return weekDailies().map(({ dateKey: dk, challenge }, i) => ({
        dateKey: dk,
        dow: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
        id:   challenge?.id   ?? null,
        name: challenge?.name ?? null,
        done: !!prog[dk]?.completed,
        payout: prog[dk]?.payout ?? 0,
      }));
    },
    weeklyBonus: DAILY_WEEKLY_BONUS,
    // DEV-only: full challenge list for the Calendar's "Test any run" launcher
    // (lets us play any challenge regardless of the weekday).  Gated behind
    // `?dev=1` (window.__DEV) so it's empty for beta testers; the index.html
    // Calendar section keys off the same flag.
    all() {
      if (!window.__DEV) return [];
      return DAILY_CHALLENGES.map(c => ({ id: c.id, name: c.name, from: c.from, to: c.to }));
    },
    playable: true,
    start(id) {
      const cfg = stageConfigFor(challengeById(id));
      if (!cfg) return false;
      try {
        // Restart the Game scene into daily-stage mode — mirrors __startOver's
        // restart + reapply so the phone menu/settings are handled for us.
        game?.scene?.getScene?.('Game')?.scene?.restart?.({ dailyStage: cfg });
        reapplyAfterRestart();
      } catch (_) { return false; }
      return true;
    },
  };
  // License plate = the ACTIVE player slot's handle (their leaderboard name).
  // Each of the 3 title-screen slots is a full independent save; this bridge
  // always reads/writes whichever slot is currently selected.
  // Any printable ASCII character is allowed (2026-07-13) EXCEPT the handful
  // that are dangerous in HTML contexts (< > & " ' ` \) — plates are rendered
  // into leaderboard innerHTML, so those stay out as defense-in-depth even
  // though render sites also escape.
  const _sanitizePlate = (v) =>
    String(v || '').toUpperCase()
      .replace(/[^\x20-\x7E]/g, '')      // printable ASCII only
      .replace(/[<>&"'`\\]/g, '')        // HTML/JS-context hazards
      .trim().slice(0, 8);
  // Normalized form for collision / blocklist checks — letters+digits only so
  // "ROAD TRIP", "R.O.A.D-TRIP" and "roadtrip" all compare equal (mirrors the
  // future server's plate_name_norm column).
  const _normPlate = (s) => _sanitizePlate(s).replace(/[^A-Z0-9]/g, '');
  // Names that can't be claimed (impersonation / confusion).  The AUTHORITATIVE
  // filter lives server-side in Phase 2 (Worker + D1); this is the local
  // first-pass so obvious cases never even reach the server.
  const _RESERVED = new Set([
    'ADMIN', 'STAFF', 'MOD', 'MODERATOR', 'SYSTEM', 'SERVER', 'OFFICIAL',
    'NULL', 'NONE', 'UNDEFINED', 'NAN', 'ANON', 'ANONYMOUS', 'PLAYER',
    'GUEST', 'OWNER', 'ROOT', 'DEV', 'TEST', 'YOU', 'ME',
  ]);
  // Substring blocklist (normalized).  Starter set — expand as needed; the
  // server-side filter (Phase 4) is the real gate.
  const _BANNED = ['FUCK', 'SHIT', 'CUNT', 'FAGGOT', 'NIGGER', 'NIGGA', 'RAPE', 'NAZI'];
  // Returns {ok, plate} or {ok:false, reason}.  Single place both the modal and
  // the slot-picker validate through, so the rules can't drift.
  const _validatePlate = (raw) => {
    const plate = _sanitizePlate(raw);
    const norm  = _normPlate(raw);
    if (norm.length < 2)     return { ok: false, reason: 'Too short — use at least 2 letters or numbers.' };
    if (_RESERVED.has(norm))  return { ok: false, reason: 'That name is reserved — pick another.' };
    for (const b of _BANNED) if (norm.includes(b)) return { ok: false, reason: 'Please choose a different name.' };
    return { ok: true, plate };
  };
  window.__plate = {
    get:        () => game.registry.get('save')?.activePlate ?? '',
    playerId:   () => game.registry.get('save')?.activePlayerId ?? '',
    needsEntry: () => !((game.registry.get('save')?.activePlate ?? '').trim()),
    // Validate WITHOUT committing — the modal calls this to show inline errors.
    validate:   (v) => _validatePlate(v),
    set: (v) => {
      const res = _validatePlate(v);
      if (!res.ok) return res;
      game.registry.get('save')?.setActivePlate?.(res.plate);
      return { ok: true, plate: res.plate };
    },
    // Async validate + reserve the name on the SERVER (Phase 2 uniqueness).
    // Local rules first; then a best-effort claim.  If the server says the
    // name is TAKEN we block; if the server is unreachable (offline / not yet
    // deployed) we allow the local name and it can re-sync on a later claim.
    claim: async (v) => {
      const res = _validatePlate(v);
      if (!res.ok) return res;
      const save = game.registry.get('save');
      const playerId = save?.activePlayerId;
      const c = await CloudSave.claimPlate(playerId, res.plate);
      if (c.reachable && !c.ok && c.taken) {
        return { ok: false, reason: 'That name is taken — pick another.' };
      }
      return { ok: true, plate: res.plate };
    },
  };
  // World leaderboard bridge — the inline phone-menu script (index.html) can't
  // import ES modules, so expose the CloudSave fetch here.  Returns [] on any
  // failure so the Leaderboard app falls back to the local/house board.
  window.__leaderboard = {
    world: (metric = 'score', limit = 20) => CloudSave.leaderboard(metric, limit),
  };
  // Manual SAVE (phone-menu "Save" button) — save the current run in place
  // (exact spot, local + cloud) without ending it.  Returns { ok }.
  window.__saveRun = () => {
    try { return game.scene.getScene('Game')?._saveCurrentRun?.() ?? { ok: false }; }
    catch (_) { return { ok: false }; }
  };
  window.__playerMileFrac = () => {
    const s = game.scene.getScene('Game');
    if (!s?.player) return 0;
    // Phone-map progress = live odometer mile / total route length.  Use the
    // TOTAL_ROUTE_MILES constant (not a hardcoded 293) so extending the route
    // can't desync the map.  (293 equals it today — no visible change now.)
    return Math.max(0, Math.min(1, (s._odometer ?? 0) / TOTAL_ROUTE_MILES));
  };
  window.__steeringMode = {
    get: () => game.registry.get('steeringMode') ?? 'flappy',
    set: (m) => {
      m = m === 'lr' ? 'classic' : m;
      // Route through GameScene._setSteeringMode when the scene is
      // live — that's the path that calls _enableTiltSteer() (so the
      // deviceorientation listener actually attaches on desktop and
      // the iOS permission prompt fires through the user-gesture
      // prefetch).  The direct registry.set used previously skipped
      // all of that, leaving tilt mode "selected" but never wired up.
      const scene = game.scene.getScene('Game');
      const restart = () => {
        try { scene?.scene?.restart(); } catch (e) {}
      };
      if (scene && typeof scene._setSteeringMode === 'function') {
        scene._setSteeringMode(m, restart);
      } else {
        // No live scene yet — just persist for the next boot.
        game.registry.set('steeringMode', m);
        const save = game.registry.get('save');
        save?.setMode?.(m);
        restart();
      }
    },
  };

  // Achievements — flat list of every definition + earned tier (or null
  // if not yet unlocked) for the trophy modal in the phone menu.
  window.__achievements = {
    list: () => {
      const viceDefs = AchievementSystem.viceDefs();
      const runDefs  = AchievementSystem.runDefs();
      const earned   = AchievementSystem.earned(game.registry);
      const rows = [];
      // Per-vice "first-hit" achievements.
      for (const viceKey of Object.keys(viceDefs)) {
        const d = viceDefs[viceKey];
        rows.push({
          id:    d.id,
          label: d.label,
          icon:  d.icon,
          desc:  earned[d.id] ? d.desc : (d.unlockHint || ''),
          tier:  earned[d.id] ?? null,
        });
      }
      // Run-tracking achievements.
      for (const id of Object.keys(runDefs)) {
        const r = runDefs[id];
        rows.push({
          id,
          label: r.label,
          icon:  r.icon,
          desc:  r.desc,
          tier:  earned[id] ?? null,
        });
      }
      return rows;
    },
  };

  // Garage data — list of owned vehicles + accessories for the phone
  // menu's Garage modal.  Reads from registry + the active save profile.
  // The asset path for a vehicle's PNG isn't always derivable from its
  // texture key (car_back_truck_blue → car_truck_back_blue.png), so
  // map it explicitly here.
  const VEHICLE_IMG_URL = {
    car_back_white:       'assets/cars/car_back_white.png',
    car_back_blue:        'assets/cars/car_back_blue.png',
    car_back_truck_blue:  'assets/cars/car_truck_back_blue.png',
    car_back_orange:      'assets/cars/car_back_orange.png',
    car_back_green:       'assets/cars/car_back_green.png',
    car_back_blue2:       'assets/cars/car_back_blue2.png',
    codex_beater_back:          'assets/cars/codex/codex_beater_back.png',
    codex_suv4x4_back:          'assets/cars/codex/codex_suv4x4_back.png',
    codex_used_truck_back:      'assets/cars/codex/codex_used_truck_back.png',
    codex_new_truck_back:       'assets/cars/codex/codex_new_truck_back.png',
    codex_ev_truck_back:        'assets/cars/codex/codex_ev_truck_back.png',
    codex_sports_car_back:      'assets/cars/codex/codex_sports_car_back.png',
    codex_bestla_roadster_back: 'assets/cars/codex/codex_bestla_roadster_back.png',
    codex_playdout_s3x_back: 'assets/cars/codex/bestla_playdout_s3x_back.png',
  };
  window.__garage = {
    // The vehicle actually being driven (registry truth) — independent of
    // the OWNED list, so custom-mode sandbox cars (not owned) resolve too.
    // The phone-menu skin sync reads this.
    current: () => game.registry.get('vehicleId')
      ?? (game.registry.get('ownedVehicles') ?? ['beater'])[0],
    list: () => {
      const owned = game.registry.get('ownedVehicles') ?? ['beater'];
      const current = game.registry.get('vehicleId') ?? owned[0];
      const save = game.registry.get('save');
      const accMap = save?.get?.('accessories', {}) ?? {};
      return owned.map(id => {
        const v = VEHICLES[id];
        if (!v) return null;
        const a = accMap[id] ?? {};
        return {
          id,
          label:    v.label,
          hp:       v.hp,
          rangeMi:  v.rangeMi,
          topMph:   v.topMph,
          fuel:     v.fuel,
          drive:    v.drive,
          imageUrl: v.spriteBack ? VEHICLE_IMG_URL[v.spriteBack] : null,
          tint:     v.tint ?? 0xCCCCCC,
          current:  id === current,
          accessories: {
            bumper:   !!a.bumper,
            nos:      a.nos ?? 0,
            traction: !!a.traction,
          },
        };
      }).filter(Boolean);
    },
    select: (id) => {
      if (!VEHICLES[id]) return;
      game.registry.set('vehicleId', id);
      try { game.scene.getScene('Game')?.scene?.restart(); } catch (e) {}
    },
  };

  // Part-upgrade + player-facing-stats bridge for the phone-menu garage.
  // cash lives on the live GameScene (score); upgrades persist in the save.
  // Genre-vehicle upgrade discount (pop-punk −25%): applies to garage part-
  // upgrade prices while the pop-punk starter is the active vehicle. Reads the
  // trait mods GameScene publishes to the registry; ×1 for every other vehicle.
  const _upgradeDiscountCost = (c) => {
    const m = game.registry.get('genreTraitMods');
    const mult = (m && m.repairUpgradeCostMult) ? m.repairUpgradeCostMult : 1;
    return Math.max(0, Math.round((c ?? 0) * mult));
  };
  // Money source of truth (owner 2026-07-21): while a rest stop is open it owns
  // the LIVE cash (RestStopScene._score) — the GameScene is stopped with a stale
  // .score.  Garage (iPhone menu) spends must hit whichever is live, or the same
  // dollars can be spent again in the rest-stop store (double-earn exploit).
  const _moneyCtx = () => {
    const rest = game.scene.getScene('RestStop');
    if (rest && rest.scene?.isActive?.() && typeof rest._score === 'number') {
      return {
        get:   () => Math.max(0, Math.round(rest._score ?? 0)),
        spend: (c) => { rest._score = Math.max(0, (rest._score ?? 0) - c); try { rest._refreshScore?.(); } catch (_) {} },
      };
    }
    const gs = game.scene.getScene('Game');
    return {
      get:   () => Math.max(0, Math.round(gs?.score ?? 0)),
      spend: (c) => { if (gs) gs.score = Math.max(0, (gs.score ?? 0) - c); },
    };
  };
  // Human-readable effect summary for the read-only garage tier browser.
  const _EFFECT_LABELS = {
    grip: 'Grip', rainGrip: 'Wet grip', snowGrip: 'Snow grip', braking: 'Braking',
    stability: 'Stability', steer: 'Steering', offroad: 'Off-road', cooling: 'Cooling',
    hp: 'Durability', rangeMi: 'Range', topMphPct: 'Top speed', accelPct: 'Acceleration',
  };
  const _PCT_KEYS = new Set(['grip','rainGrip','snowGrip','braking','stability','steer','offroad','cooling','topMphPct','accelPct']);
  const _fmtEffects = (eff) => Object.entries(eff ?? {})
    .filter(([k]) => _EFFECT_LABELS[k])
    .map(([k, v]) => {
      const sign = v > 0 ? '+' : '';
      const val = _PCT_KEYS.has(k) ? `${sign}${Math.round(v * 100)}%`
                : k === 'rangeMi'  ? `${sign}${v} mi`
                : k === 'hp'       ? `${sign}${v} HP`
                : `${sign}${v}`;
      return `${_EFFECT_LABELS[k]} ${val}`;
    }).join(' · ');

  window.__upgrades = {
    cash: () => _moneyCtx().get(),

    // Read-only tier browser for the GARAGE (owner 2026-07-21): the garage no
    // longer BUYS — it studies. Returns every slot with ALL its tiers, each
    // tagged installed / current / next, plus a human benefit line + the price
    // to save toward. Buying happens only at the rest-stop car shop.
    browse: (vehicleId) => {
      const save = game.registry.get('save');
      const installed = getInstalled(save, vehicleId);
      return UPGRADE_SLOTS.map(slot => {
        const tiers  = getSlotTiers(slot);
        const curId  = installed[slot];
        const curUp  = curId ? tiers.find(t => t.id === curId) : null;
        const curLvl = curUp?.level ?? 0;
        return {
          slot,
          slotLabel:      SLOT_LABELS[slot] ?? slot,
          installedLevel: curLvl,
          installedLabel: curUp?.label ?? null,
          maxLevel:       tiers.length,
          tiers: tiers.map(t => ({
            id: t.id, level: t.level, label: t.label,
            cost: _upgradeDiscountCost(t.cost),
            benefit: _fmtEffects(t.effects),
            desc: t.desc ?? '', tradeoff: t.tradeoff ?? '',
            installed: t.level <= curLvl,   // this tier is on the car (or surpassed)
            isCurrent: t.level === curLvl,  // the exact tier currently fitted
          })),
        };
      });
    },

    // 8 player-facing stats as { key: {bars, note} } for the current build.
    stats: (vehicleId) => {
      const save = game.registry.get('save');
      return getVehicleDisplayStats(vehicleId, {
        accessories:    save?.get?.('accessories', {}) ?? {},
        upgradeEffects: getUpgradeEffects(save, vehicleId),
      });
    },

    // Per-slot install state + the next purchasable tier (or null if maxed).
    slots: (vehicleId) => {
      const save = game.registry.get('save');
      const installed = getInstalled(save, vehicleId);
      return UPGRADE_SLOTS.map(slot => {
        const tiers   = getSlotTiers(slot);
        const curId   = installed[slot];
        const curUp   = curId ? tiers.find(t => t.id === curId) : null;
        const curLvl  = curUp?.level ?? 0;
        const next    = tiers.find(t => t.level === curLvl + 1) ?? null;
        return {
          slot,
          slotLabel:      SLOT_LABELS[slot] ?? slot,
          installedLabel: curUp?.label ?? null,
          installedLevel: curLvl,
          maxLevel:       tiers.length,
          next: next ? {
            id: next.id, label: next.label, cost: _upgradeDiscountCost(next.cost),
            tradeoff: next.tradeoff ?? '', desc: next.desc ?? '',
          } : null,
        };
      });
    },

    // Buying moved OUT of the garage (owner 2026-07-21): the car shop is the
    // single purchase path, so the same dollars can't be spent in two wallets.
    // Kept as a hard no-op in case any stale caller still invokes it.
    buy: () => ({ ok: false, reason: 'buy-at-car-shop', cash: _moneyCtx().get() }),
  };

  // Checkpoint warp — restart the live run at the player's last reached
  // rest stop.  Prefers the in-memory _lastCheckpoint (covers mid-run
  // dies) and falls back to the persisted save.lastRestStop.
  // After scene.restart()/start() the new scene comes online RUNNING,
  // which would let the car drive forward while the player is still in
  // the portrait menu.  Defer applyOrientation by a tick so the
  // freshly created scene immediately gets paused (portrait) and the
  // tap-to-resume gate arms when the player rotates back to landscape.
  const reapplyAfterRestart = () => {
    setTimeout(() => applyOrientation(), 50);
    setTimeout(() => applyOrientation(), 250);
  };

  // Handedness — left- or right-handed HUD layout (weapon column,
  // gas/HP/Mi positions, steering dead-zone edge).  Stored on the
  // active save profile so it survives across runs.  Live update —
  // does NOT restart the game; the player's run continues.  Per-frame
  // render code (weapons, gas icon, steering input zone) reads the
  // flag every tick so it flips on next paint; static HUD labels
  // built once in create() keep their position until the next run
  // start, which is an acceptable trade-off for keeping run progress.
  window.__handedness = {
    get: () => {
      const save = game.registry.get('save');
      return save?.get?.('settings.handedness', 'left') ?? 'left';
    },
    set: (v) => {
      const save = game.registry.get('save');
      const next = (v === 'right') ? 'right' : 'left';
      save?.set?.('settings.handedness', next);
      const gs = game.scene.getScene('Game');
      if (gs) gs._leftHanded = (next !== 'right');
    },
    toggle: () => {
      const cur = window.__handedness.get();
      window.__handedness.set(cur === 'left' ? 'right' : 'left');
    },
  };

  // Start Over — restart the run from mile 0 with the same vehicle,
  // fresh HP / vices / party clock.  Phaser scene.restart() re-runs
  // init+create with no carry-over data; the vehicleId lives on the
  // registry so it survives the restart.  Scene is then re-paused so
  // the car waits at mile 0 until the player rotates to landscape.
  window.__startOver = () => {
    try {
      document.body.classList.remove('menu-locked');   // desktop: drop the overlay
      // Deliberate restart — drop the live-run autosave so the fresh run
      // doesn't immediately auto-resume the old one.
      try { game?.registry?.get?.('save')?.set?.('liveRun', null); } catch (_) {}
      game?.scene?.getScene?.('Game')?.scene?.restart?.();
      reapplyAfterRestart();
    } catch (_) {}
  };

  // Main Menu — exit the active run and return to the title screen.
  // Mirrors GameOverScene._returnToTitle: starting Game with no resume
  // data presents the normal title overlay (difficulty picker etc.).
  // Persistent saves / unlocks stay intact.
  window.__mainMenu = () => {
    try {
      document.body.classList.remove('menu-locked');   // desktop: drop the overlay
      // Deliberate exit to the title — clear the live-run autosave so the
      // title boot doesn't auto-resume the run the player just left.
      try { game?.registry?.get?.('save')?.set?.('liveRun', null); } catch (_) {}
      game?.scene?.start?.('Game', {});
      reapplyAfterRestart();
    } catch (_) {}
  };

  window.__checkpoint = {
    warpToLast: () => {
      const scene = game.scene.getScene('Game');
      const lc    = scene?._lastCheckpoint;
      if (lc?.position != null) {
        scene.scene.restart({
          resumeFromPosition: lc.position,
          resumeScore: lc.scoreAtCP ?? 0,
        });
        reapplyAfterRestart();
        return true;
      }
      const save = game.registry.get('save');
      const snap = save?.get?.('lastRestStop');
      if (snap?.id) {
        game.scene.start('Game', {
          resumeFromStop: snap.id,
          resumeScore:    snap.score ?? 0,
          resumeStars:    0,
        });
        reapplyAfterRestart();
        return true;
      }
      return false;
    },
  };

  // Free teleport to any route mile — driven by tapping a stop on the
  // in-game iPhone Map.  Gated to CUSTOM difficulty only: Custom is the
  // no-score sandbox, so a free warp can't inflate the scored leaderboard.
  // Returns { ok, reason } so the map UI can give feedback.
  window.__warpTo = (mile) => {
    const scene = game.scene.getScene('Game');
    if (!scene || typeof mile !== 'number') return { ok: false, reason: 'no-run' };
    // Belt-and-suspenders: registry AND save must BOTH say custom — a stale
    // registry value from a prior custom run must not leak teleport into
    // scored modes (2026-07-16 owner report: warped on Easy).
    const mode  = game.registry.get('difficulty');
    const saved = game.registry.get('save')?.get?.('difficulty');
    if (mode !== 'custom' || saved !== 'custom') return { ok: false, reason: 'not-custom' };
    const ok = scene._warpToMile?.(mile);
    return { ok: !!ok, reason: ok ? '' : 'failed' };
  };

  // Career stats snapshot for the phone-menu Leaderboard + Stats apps.
  // Returns a plain-object copy so the menu can't mutate live state.
  window.__stats = {
    // Lifetime/persisted career stats (records, earned/spent, vices, etc.).
    get: () => {
      const stats = game.registry.get('stats');
      if (!stats?.stats) return null;
      try { return JSON.parse(JSON.stringify(stats.stats)); }
      catch (_) { return stats.stats; }
    },
    // Current-trip (session) counters — for the Stats app's "This Trip" tab.
    session: () => {
      const stats = game.registry.get('stats');
      if (!stats?.session) return null;
      try { return JSON.parse(JSON.stringify(stats.session)); }
      catch (_) { return stats.session; }
    },
    // Local run history (this device), already sorted best-score first — for
    // the Leaderboard app's "Your Runs" ranking.
    runs: () => {
      const save = game.registry.get('save');
      const lb = save?.get?.('leaderboard', { runs: [] }) || { runs: [] };
      return (lb.runs || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    },
    // Cross-player HOUSE leaderboard — one row per player profile slot on this
    // device.  Reads every slot's records/leaderboard directly (does NOT switch
    // the active slot).  Includes only created players (a non-empty plate) plus
    // the active slot.  The UI re-sorts by score / time / miles.  records is the
    // primary source (StatsTracker keeps it current); runs is a defensive
    // fallback so a slot with history but no records still ranks.
    house: () => {
      const save = game.registry.get('save');
      const slots = save?.data?.slots;
      if (!Array.isArray(slots)) return [];
      const active = save.activeSlot | 0;
      const out = [];
      slots.forEach((slot, i) => {
        const plate = (slot?.plate ?? '').toString().trim();
        const isActive = i === active;
        if (!plate && !isActive) return;          // skip empty, non-active slots
        const rec  = slot?.global?.stats?.records ?? {};
        const runs = (slot?.global?.leaderboard?.runs) ?? [];
        const bestScore = rec.bestScore   || runs.reduce((m, r) => Math.max(m, r.score || 0), 0);
        const mostMiles = rec.mostMilesRun || runs.reduce((m, r) => Math.max(m, r.miles || 0), 0);
        let fastest = rec.fastestCompletionSec || 0;
        if (!fastest) {
          const done = runs.filter(r => r.completed && r.timeSec > 0).map(r => r.timeSec);
          if (done.length) fastest = Math.min(...done);
        }
        out.push({
          index:                i,
          plate:                plate || (isActive ? '' : '—'),
          active:               isActive,
          bestScore,
          mostMilesRun:         mostMiles,
          fastestCompletionSec: fastest || 0,
          hasRuns:              runs.length > 0,
        });
      });
      return out;
    },
  };

  // Settings app — volume / mute / haptics.  Sound routes through the
  // AudioSystem (so it works from the portrait start menu, no pause
  // needed); haptics persists to the save and is pushed to the live
  // scene (GameScene also reads it on create).
  window.__settings = {
    get: () => {
      const audio = game.registry.get('audio');
      const save  = game.registry.get('save');
      return {
        muted:   !!audio?.muted,
        volume:  audio?.volume ?? 0.32,
        haptics: save?.get?.('settings.haptics', true) !== false,
      };
    },
    setMuted: (v) => {
      const audio = game.registry.get('audio');
      if (audio && !!audio.muted !== !!v) audio.toggleMute?.();
    },
    setVolume: (v) => {
      const audio = game.registry.get('audio');
      if (!audio) return;
      audio.volume = Math.max(0, Math.min(1, Number(v) || 0));
      audio._applyMasterGain?.();
    },
    setHaptics: (v) => {
      game.registry.get('save')?.set?.('settings.haptics', !!v);
      game.scene.getScene('Game')?.haptics?.setEnabled?.(!!v);
    },
    // Speedometer / distance units: 'mph' | 'kmh'.
    getUnits: () => game.registry.get('save')?.get?.('settings.units', 'mph'),
    setUnits: (u) => {
      const uu = (u === 'kmh') ? 'kmh' : 'mph';
      game.registry.get('save')?.set?.('settings.units', uu);
      const s = game.scene.getScene('Game'); if (s) s._unitsKmh = (uu === 'kmh');
    },
    // Screen-shake intensity 0..1 (1 = full).
    getShake: () => game.registry.get('save')?.get?.('settings.shake', 1),
    setShake: (v) => {
      const t = Math.max(0, Math.min(1, Number(v) || 0));
      game.registry.get('save')?.set?.('settings.shake', t);
      const s = game.scene.getScene('Game'); if (s) s._shakeMult = t;
    },
    // HUD visible (true) / hidden (false).
    getHud: () => game.registry.get('save')?.get?.('settings.hud', true) !== false,
    setHud: (vis) => {
      game.registry.get('save')?.set?.('settings.hud', !!vis);
      const s = game.scene.getScene('Game');
      if (s) { s._hudHidden = !vis; s._setHudVisible?.(!s._awaitingStart); }
    },
    // Reset PROGRESS — fully blanks the ACTIVE player slot (plate, lifetime
    // stats, leaderboard, achievements, money, cars, every mode's progress),
    // leaving the other players untouched.  Frees the plate so it can be
    // renamed.
    //
    // This used to end with a hard `location.reload()` for a guaranteed-clean
    // reboot, but a page reload tears down the AudioContext and the browser
    // then blocks autoplay until the next user tap — so the radio went silent
    // on reset.  Instead we soft-restart into the title (same path as
    // __mainMenu): the AudioSystem lives on the registry and survives a scene
    // restart, so the music keeps playing.  SaveSystem resolves the slot via
    // getters, so Wallet / plate / leaderboard re-read the wiped slot for
    // free; the only stale state is StatsTracker's live `stats` reference
    // (reload re-points it) and the registry vehicleId (may point at a
    // now-unowned car — drop it back to the starter).
    resetProgress: () => {
      game.registry.get('save')?.resetProgress?.();
      game.registry.get('stats')?.reload?.();
      game.registry.set('vehicleId', 'beater');
      try {
        game?.scene?.start?.('Game', {});
        reapplyAfterRestart();
      } catch (_) {}
    },
  };

  // Controls-layout editor.  Settings (portrait) arms it; the player rotates to
  // landscape — or, on desktop, closing the menu returns to the already-
  // landscape game — and GameScene drops into drag-to-reposition edit mode.
  window.__customizeControls = {
    start: () => {
      const s = game.scene.getScene('Game');
      if (!s) return;
      // Clean slate EVERY tap so a prior Cancel can never block re-entry.
      if (s._ctrlEditMode) { try { s._exitControlsEditor?.(); } catch (_) {} }
      s._ctrlEditMode = false;
      s._editorArmed  = true;
      // DESKTOP ONLY: close the menu to drop back into the (landscape) game
      // where edit mode activates.  On a PHONE we must NOT close — close()
      // resumes the scene while still in portrait, which enters/tangles the
      // editor behind the menu (and broke re-opening after a Cancel).  The
      // phone player simply rotates to landscape and the armed flag enters it.
      if (window.__isDesktop) { try { window.__phoneMenu?.close?.(); } catch (_) {} }
    },
    // Cancel: full reset so a Cancel can NEVER leave a half-state that blocks
    // re-opening.  Un-arm and force the editor closed (idempotent — safe even
    // if it never opened), then re-sync orientation/pause in case the editor's
    // freeze left the scene paused or armed across a rotation.
    cancel: () => {
      const s = game.scene.getScene('Game');
      if (!s) return;
      s._editorArmed = false;
      pendingTapResume = false;
      try { s._exitControlsEditor?.(); } catch (_) {}
      requestAnimationFrame(() => applyOrientation());
    },
  };

  // Location widget — current town + live weather + a simulated temperature
  // for the phone-menu top bar (name by the GPS arrow, temp + symbol upper
  // right).  Temp is faked from a lowland→Cascade-pass gradient, capped by
  // the active weather so snow reads cold and rain reads cool.
  window.__location = {
    get: () => {
      const scene = game.scene.getScene('Game');
      const mile  = Math.max(0, scene?._odometer ?? 0);
      const name  = getLocationName(mile / TOTAL_ROUTE_MILES);
      let weather = 'clear';
      try { weather = Weather.state(mile); } catch (_) {}
      // Coldest at the Snoqualmie Pass summit (~mile 50), warm in the lowlands.
      const passCold = Math.max(0, 1 - Math.abs(mile - 50) / 45);
      let tempF = 70 - passCold * 33;
      if (weather === 'snow')      tempF = Math.min(tempF, 31);
      else if (weather === 'rain') tempF = Math.min(tempF, 52);
      return { name, weather, tempF: Math.round(tempF) };
    },
  };

  // Flavor contacts (The Ex / Mom / The Boss / The Unknown) — pure-tone texters.
  // GameScene logs their messages per run; the Messages app reads the threads.
  window.__buddytexts = {
    threads: () => game.scene.getScene('Game')?._buddyThreads ?? { ex: [], mom: [], boss: [], unknown: [] },
  };

  // The Crush (phone → Contacts).  Gender-neutral (they/them) — they invited
  // you to the party in Pullman.  Texting is FREE and once per town — keep them
  // warm each town or they cool off ("…", with annoyed/angry texts) and
  // eventually find someone else.  Reward is a party payoff at the finish, NOT
  // per-text cash.  All logic lives on GameScene (it owns the per-town /
  // checkpoint loop); this is a thin pass-through for the UI.
  window.__girl = {
    status: () => game.scene.getScene('Game')?._girlStatus?.()
      ?? { gone: false, responded: false, sent: 0, everTexted: false, canText: false, skips: 0, skipsLeft: 4, thread: [] },
    text:   () => game.scene.getScene('Game')?._girlText?.() ?? { ok: false },
  };

  // Genre / culture art — the chosen genre reskins the vice + starter-vehicle
  // art (owner 2026-07-17). Genre is PER LICENSE PLATE: stored in the active
  // save slot ('genre') and mirrored to localStorage 'rtr.genre', which
  // BootScene reads at boot. set() swaps it live; syncActive() re-mirrors when
  // the active profile/plate changes.
  // Genre Vehicle Traits bridge for the DOM (phone-menu Music long-hold popup +
  // Garage panel). Returns the trait for a culture's STARTER vehicle, or null.
  window.__vehTraits = {
    forGenre: (g) => (g && GENRE_VEHICLE_TRAITS[g]) ? GENRE_VEHICLE_TRAITS[g] : null,
    current:  () => {
      const g = (() => { try { return window.__genre?.get?.(); } catch (_) { return null; } })();
      return (g && GENRE_VEHICLE_TRAITS[g]) ? GENRE_VEHICLE_TRAITS[g] : null;
    },
  };
  window.__genre = {
    get: () => {
      const g = game.registry.get('save')?.get?.('genre', null);
      if (g) return g;
      try { return localStorage.getItem('rtr.genre') || null; } catch (_) { return null; }
    },
    set: (culture) => {
      if (!culture) return;
      try { game.registry.get('save')?.set?.('genre', culture); } catch (_) {}  // per-plate
      try { localStorage.setItem('rtr.genre', culture); } catch (_) {}          // boot mirror
      const s = game.scene?.getScene?.('Game');
      try { s?._applyGenreArt?.(culture); } catch (_) {}
    },
    // Profile/plate switched → mirror that plate's stored genre to rtr.genre and
    // reskin live (null genre reverts to base art).
    syncActive: () => {
      const g = game.registry.get('save')?.get?.('genre', null) || null;
      try {
        if (g) localStorage.setItem('rtr.genre', g);
        else   localStorage.removeItem('rtr.genre');
      } catch (_) {}
      const s = game.scene?.getScene?.('Game');
      try { s?._applyGenreArt?.(g); } catch (_) {}
      return g;
    },
  };

  // Music app — list stations and play specific tracks.
  window.__music = {
    list: () => {
      const audio = game.registry.get('audio');
      return audio?.getStations?.() ?? [];
    },
    current: () => {
      const audio = game.registry.get('audio');
      return audio ? { name: audio.currentName, index: audio.currentStation } : null;
    },
    playStation: (idx) => {
      const audio = game.registry.get('audio');
      audio?.setStation?.(idx);
    },
    playTrack: (url) => {
      const audio = game.registry.get('audio');
      audio?.playSpecificTrack?.(url);
    },
    playPlaylist: (urls) => {
      const audio = game.registry.get('audio');
      audio?.playPlaylist?.(urls);
    },
    shuffleAll: () => {
      const audio = game.registry.get('audio');
      audio?.shuffleAllTracks?.();
    },
    nextTrack: () => {
      const audio = game.registry.get('audio');
      audio?.skipTrack?.();
    },
    // Scrubber: { time, duration, name } or null when nothing's playing.
    progress: () => game.registry.get('audio')?.trackProgress?.() ?? null,
    seek: (frac) => game.registry.get('audio')?.seekTrackFrac?.(frac) ?? false,
    isMuted: () => {
      const audio = game.registry.get('audio');
      return !!audio?.muted;
    },
    // Default station (genre) that auto-plays on boot — persisted in the
    // save's settings.radio.  Setting it also switches to it now as feedback.
    getDefaultStation: () => game.registry.get('save')?.get?.('settings.radio', 0),
    setDefaultStation: (idx) => {
      const i = parseInt(idx, 10) || 0;
      game.registry.get('save')?.set?.('settings.radio', i);
      game.registry.get('audio')?.setStation?.(i);
    },
    toggleMute: () => {
      const audio = game.registry.get('audio');
      audio?.toggleMute?.();
    },
    getVolume: () => {
      const audio = game.registry.get('audio');
      return audio?.volume ?? 0.32;
    },
    setVolume: (v) => {
      const audio = game.registry.get('audio');
      if (!audio) return;
      const t = Math.max(0, Math.min(1, Number(v) || 0));
      audio.volume = t;
      // While paused, mark this as a user-initiated change so the
      // resume path doesn't snap back to the pre-pause level — the
      // player explicitly set this volume.
      if (audio.paused) audio._userTouchedVolumeWhilePaused = true;
      // All gain writes go through the perceptual-curve helper so
      // the slider feels linear to the ear.
      audio._applyMasterGain?.();
    },
    isPaused: () => {
      const audio = game.registry.get('audio');
      return !!audio?.paused;
    },
    // Pre-warm — called when the music modal opens so the
    // AudioContext + reverb/buffer/compressor graph is built BEFORE
    // the user taps a song.  Saves ~50–200 ms off the first-song
    // startup latency.  Safe to call any number of times; init()
    // bails after the first run.
    warmup: () => {
      const audio = game.registry.get('audio');
      if (!audio) return;
      if (!audio.ready) audio.init?.();
      try { if (audio._ctx?.state === 'suspended') audio._ctx.resume(); } catch (_) {}
    },
    togglePaused: () => {
      const audio = game.registry.get('audio');
      if (!audio) return;
      audio.setPaused?.(!audio.paused);
    },
    // Music app's ⏸/▶ button — truly HOLDS the music (stops the procedural
    // scheduler AND any real track) until un-paused, unlike togglePaused()
    // which is the game-pause volume duck.
    isMusicPaused: () => !!game.registry.get('audio')?.musicPaused,
    toggleMusicPaused: () => {
      const a = game.registry.get('audio');
      a?.setMusicPaused?.(!a.musicPaused);
    },
    isBackgroundRadioEnabled: () => !!game.registry.get('audio')?.getBackgroundRadioEnabled?.(),
    setBackgroundRadioEnabled: (v) => {
      const a = game.registry.get('audio');
      a?.setBackgroundRadioEnabled?.(!!v);
      game.registry.get('save')?.set?.('settings.backgroundRadio', !!v);
    },
    toggleBackgroundRadio: () => {
      const a = game.registry.get('audio');
      const next = !a?.getBackgroundRadioEnabled?.();
      a?.setBackgroundRadioEnabled?.(next);
      game.registry.get('save')?.set?.('settings.backgroundRadio', next);
      return next;
    },
    nowPlayingUrl: () => {
      const audio = game.registry.get('audio');
      // _trackEl is the live HTMLAudioElement; its src is the current track url
      return audio?._trackEl?.src ?? null;
    },
  };

  const applyOrientation = () => {
    const isPortrait = window.innerHeight > window.innerWidth;
    // Locked = the phone-menu CSS override keeps the menu open even in
    // landscape, so the game must also stay paused regardless of
    // rotation.
    const shouldPause = isPortrait || lockedByPhone;
    if (shouldPause) {
      pendingTapResume = false;       // portrait/locked taps belong to the menu, never to gameplay resume
    }
    for (const key of SCENES_TO_PAUSE) {
      const scene = game.scene.getScene(key);
      if (!scene || !scene.scene) continue;
      // Skip scenes that haven't actually been started yet — calling
      // pause() on them logs "Cannot pause non-running Scene" noise.
      if (!game.scene.isActive(key) && !game.scene.isPaused(key)) continue;
      const paused  = game.scene.isPaused(key);
      const visible = game.scene.isVisible(key);
      if (shouldPause && visible && !paused) {
        game.scene.pause(key);
        // Leaving the game for the menu (running→paused edge) cancels any
        // stale controls-editor arm so it can't hijack a later Start.  EDIT is
        // tapped while ALREADY paused (menu up in portrait), so this fires only
        // on the real running→paused transition — never on a fresh arm.
        if (key === 'Game' && scene._editorArmed) scene._editorArmed = false;
      } else if (!shouldPause && paused) {
        // Controls editor: if the player armed it (Settings → Customize →
        // EDIT) and has now rotated to landscape, RESUME immediately so the
        // editor opens on rotation — never on an ambiguous "first tap" (which
        // would otherwise read as "Start the game" and dump the player into the
        // editor when they meant to play).  Every other case keeps the
        // "first tap unpauses" hold.
        if (key === 'Game' && scene._editorArmed) {
          game.scene.resume(key);
          pendingTapResume = false;
        } else if (key === 'Game' && scene._awaitingStart) {
          // TITLE screen: there's no run to "resume", so the tap-to-unpause
          // hold makes no sense here — it just eats the first tap. Rotating in
          // should make the title (and the guided title tutorial) immediately
          // live, so the plate highlight shows WITHOUT an extra tap (owner
          // 2026-07-19: "the vertical→horizontal handoff needs an extra tap
          // before the plates highlight").
          game.scene.resume(key);
          pendingTapResume = false;
        } else {
          // Don't resume immediately — arm a "first tap unpauses" hold.
          pendingTapResume = true;
        }
      }
    }
    // Re-fit the canvas to #game-root's CURRENT box.  The device safe-area
    // insets resolve only AFTER first layout (and change on rotation), so
    // without an explicit re-measure Phaser keeps FIT-fitting to the full
    // window — and #game-root's overflow:hidden then clips the TOP + BOTTOM
    // of the game (the reported crop).  setParentSize re-fits into the inset
    // box so the whole 800×450 design stays visible (letterboxed, not cropped).
    const root = document.getElementById('game-root');
    if (root && game.scale?.setParentSize) {
      const r = root.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        // Decoupled width (Task 4): size the CANVAS to the container's aspect
        // so FIT fills it edge-to-edge (no side/bottom bars) and scenery can
        // run to the screen edge.  Only in LANDSCAPE — portrait is the
        // rotate-to-play overlay and would yield a tall (cropped) canvas, so
        // we keep the last landscape width through a rotation.  setWorldWidth
        // updates HUD_OFFSET_X *before* setGameSize fires the scene 'resize',
        // so each scene re-centers its cameras against the fresh value.
        if (r.width >= r.height) {
          const targetW = setWorldWidth(SCREEN_H * (r.width / r.height));
          if (game.scale.gameSize.width !== targetW) {
            game.scale.setGameSize(targetW, SCREEN_H);
          }
        }
        game.scale.setParentSize(r.width, r.height);
        game.scale.refresh();
      }

    }
  };

  // First pointerdown after rotation-to-landscape resumes the run.
  // Ignored while locked or while in portrait.
  const tapResumeHandler = () => {
    if (!pendingTapResume) return;
    if (window.innerHeight > window.innerWidth) return;   // still portrait
    if (lockedByPhone) return;
    for (const key of SCENES_TO_PAUSE) {
      if (game.scene.isPaused(key)) game.scene.resume(key);
    }
    pendingTapResume = false;
  };
  window.addEventListener('pointerdown', tapResumeHandler, { capture: true });
  window.addEventListener('touchstart',  tapResumeHandler, { capture: true });

  const onOrientationChange = () => {
    // Close any open rotate-reminder popup on every rotation so it can never
    // linger over the menu/editor (a lingering modal made the iPhone menu
    // unreachable after a Cancel + turn).
    try { window.__activeConfirmClose?.(); } catch (_) {}
    requestAnimationFrame(applyOrientation);
    // iOS quirk: the rotation animation updates the viewport WHILE turning but
    // often fires NO final 'resize' once it settles — so the rAF above re-fit
    // the canvas to a MID-rotation size, leaving the title/HUD letterboxed low
    // until the next stray event (a tap) snapped it ("low, then pops").  Re-fit
    // a few times across the animation's settle window so it lands correctly on
    // its own.  applyOrientation is idempotent + cheap, so extra calls are free.
    for (const ms of [120, 300, 550, 900]) setTimeout(applyOrientation, ms);
  };
  window.addEventListener('resize',            onOrientationChange);
  window.addEventListener('orientationchange', onOrientationChange);
  requestAnimationFrame(applyOrientation);
};

// If DOM is already parsed (modules execute after DOMContentLoaded
// fires by default), boot immediately.  Otherwise wait for the event.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _boot, { once: true });
} else {
  _boot();
}
