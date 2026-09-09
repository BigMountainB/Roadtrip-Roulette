// ── Launch invariants: title-first + one-shot tutorial highlights ─────────
// Run: node tests/launch.test.mjs   (also `npm test`)
//
// Two absolute rules the owner has had to restate repeatedly (2026-09-07):
//
//   1. assets/ui/title_screen_vertical.png shows on EVERY cold launch — a save
//      or live run may only be OFFERED after the player dismisses it.  No
//      exception for crashes, autosaves, returning players, orientation or app
//      updates.
//   2. A Tutorial button's highlight is permanent one-shot state.  Once touched
//      it never re-lights — not on reload, not on a new build.
//
// Rule 1 lives inside scene init / DOM bootstrap, which can't be constructed
// headlessly, so it is guarded by SOURCE invariants: each test asserts the
// specific bypass mechanism that used to defeat it cannot come back. Rule 2 is
// pure functions, so it is tested behaviourally against the real code.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { btnSeen, setBtnSeen, BTN_SEEN_KEY, TUT_BUTTONS }
  from '../src/systems/TutorialSystem.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(ROOT + p, 'utf8');

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log(`  ✗ FAIL: ${name}`); } };

/** Minimal SaveSystem stand-in: get(key, default) / set(key, value). */
const mkStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    get: (k, d = undefined) => (m.has(k) ? m.get(k) : d),
    set: (k, v) => m.set(k, v),
    /** Serialise the way SaveSystem persists, for a "reload" round-trip. */
    dump: () => JSON.parse(JSON.stringify(Object.fromEntries(m))),
  };
};

const indexHtml   = read('index.html');
const openingCall = read('src/ui/OpeningCallSequence.js');
const gameScene   = read('src/scenes/GameScene.js');
const mainJs      = read('src/main.js');
const saveSystem  = read('src/systems/SaveSystem.js');

// Comments legitimately mention the removed mechanisms (they document WHY the
// exception must not return), so strip comments before asserting on code.
const stripComments = (s) => s
  .replace(/<!--[\s\S]*?-->/g, '')      // HTML
  .replace(/\/\*[\s\S]*?\*\//g, '')     // block
  .replace(/^\s*\/\/.*$/gm, '');        // line

const indexCode  = stripComments(indexHtml);
const callCode   = stripComments(openingCall);
const sceneCode  = stripComments(gameScene);
const mainCode   = stripComments(mainJs);
const saveCode   = stripComments(saveSystem);

// ── 1. Cold launch with NO save → vertical title visible ──────────────────
check('title art is the splash image',
  indexHtml.includes('assets/ui/title_screen_vertical.png'));
check('#opening-call overlay still exists',
  indexHtml.includes('id="opening-call"'));
check('initOpeningCall reaches startTitleSplash() unconditionally',
  /startTitleSplash\(\);\s*\}?\s*$/m.test(callCode.trimEnd())
  || callCode.includes('startTitleSplash();'));
check('phone menu cannot paint over the splash',
  indexHtml.includes('body.opening-call-active #phone-menu'));

// ── 2. Cold launch WITH an active liveRun → vertical title still visible ──
// The two mechanisms that used to suppress it are gone, in code (not comments).
check('no pre-paint guard reads liveRun from localStorage in index.html',
  !/localStorage\.getItem\([^)]*rtr\.save/.test(indexCode)
  || !indexCode.includes('liveRun'));
check('index.html never sets __introSkipForResume',
  !/__introSkipForResume\s*=/.test(indexCode));
check('index.html never hides #opening-call at boot',
  !/getElementById\(\s*['"]opening-call['"]\s*\)[\s\S]{0,80}display\s*=\s*['"]none['"]/.test(indexCode));
check('OpeningCallSequence has no __introSkipForResume bypass',
  !callCode.includes('__introSkipForResume'));
check('cold boot offers the run (sets _titleResumeSnap)',
  sceneCode.includes('this._titleResumeSnap = lr.snap;'));
check('cold boot never auto-resumes from the liveRun branch',
  !/crashed\s*\|\|\s*lr\.manual/.test(sceneCode));
// The in-session explicit resume (Save -> From Checkpoint) is NOT a cold launch
// and must keep working.
check('in-session explicit resume still assigns _resumeLive',
  sceneCode.includes('data.resumeLiveSnapshot'));

// ── 3. Touch Tutorial, reload → no highlight ──────────────────────────────
// Highlight shows only when the durable flag is false.
for (const which of TUT_BUTTONS) {
  const store = mkStore();
  check(`${which}: highlights before first touch`, btnSeen(store, which) === false);
  setBtnSeen(store, which);
  check(`${which}: flag set on touch`, btnSeen(store, which) === true);
  // "Reload" — persist, then rehydrate into a fresh store.
  const reloaded = mkStore(store.dump());
  check(`${which}: still marked after reload → no highlight`,
    btnSeen(reloaded, which) === true);
}

// Marking one button must not mark the others (independent one-shot lives).
{
  const store = mkStore();
  setBtnSeen(store, 'phone');
  const reloaded = mkStore(store.dump());
  check('phone touch does not mark game_menu', btnSeen(reloaded, 'game_menu') === false);
  check('phone touch does not mark gameplay',  btnSeen(reloaded, 'gameplay')  === false);
  check('phone stays marked',                  btnSeen(reloaded, 'phone')     === true);
}

// The flag must survive the save round-trip: these keys were once routed to
// slot.global but not copied back, so every reload wiped them.
check('tutorialBtnSeen is a persisted global key',
  saveCode.includes("'tutorialBtnSeen'"));
check('tutorialBtnSeen is copied in _sanitizeGlobal',
  saveCode.includes('g.tutorialBtnSeen'));

// ── 4. Touch Tutorial, change build ID, reload → no highlight ─────────────
// Nothing may clear the map on a build change: the key that tracked it and the
// resetter that read it are both deleted.
check('no tutorialBtnSeenBuild key in SaveSystem', !saveCode.includes('tutorialBtnSeenBuild'));
check('main.js has no _armBlinkReset',             !mainCode.includes('_armBlinkReset'));
check('main.js never references a build-id reset', !mainCode.includes('tutorialBtnSeenBuild'));
check('nothing nulls the btn-seen map',            !mainCode.includes('BTN_SEEN_KEY, null'));
check('no timestamp-driven tutorial reset',        !/tutorialBtnSeen[\s\S]{0,40}Date\.now/.test(mainCode));

{
  // Simulate: touch → persist → app updates (build id changes) → relaunch.
  const store = mkStore();
  setBtnSeen(store, 'phone');
  setBtnSeen(store, 'game_menu');
  const persisted = store.dump();

  // A build change is just a different __BUILD_ID__ at boot; with the resetter
  // gone, boot touches nothing, so the map rehydrates intact.
  const afterUpdate = mkStore(persisted);
  check('phone still marked after build change',     btnSeen(afterUpdate, 'phone') === true);
  check('game_menu still marked after build change', btnSeen(afterUpdate, 'game_menu') === true);
  check('untouched gameplay still highlights',       btnSeen(afterUpdate, 'gameplay') === false);
  check('build change did not null the map',
    afterUpdate.get(BTN_SEEN_KEY, null) !== null);
}

// ── 5. REAL SaveSystem storage routing (not a fake store) ────────────────
// The fake-store tests above pass even when the flag is routed to a throwaway
// bucket, which is exactly how the Custom-mode sandbox bug survived them: all
// three tutorial keys were in SANDBOX_KEYS, and _rootFor() checks the sandbox
// BEFORE GLOBAL_KEYS, so during a Custom run reads saw an unseeded {} and
// writes were discarded with it.  These tests drive the real SaveSystem against
// a real localStorage shim and assert the durable JSON, so a routing
// regression fails here even if every unit test above still passes.

// In-memory localStorage, installed before SaveSystem is constructed.
globalThis.localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
})();

const { SaveSystem } = await import('../src/systems/SaveSystem.js');
const STORAGE_KEY = 'rtr.save.v3';

/** Durable value straight out of the persisted JSON — no SaveSystem in between. */
const rawGlobal = (key) => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  const d = JSON.parse(raw);
  return d?.slots?.[d.activeSlot]?.global?.[key];
};

// Extract the SANDBOX_KEYS block itself rather than searching the whole file:
// these key names legitimately appear in GLOBAL_KEYS and in the schema
// defaults, so a file-wide `includes` cannot tell correct membership from the
// bug and would either always pass or always fail.
const sandboxBlock = (() => {
  const i = saveCode.indexOf('const SANDBOX_KEYS = new Set([');
  return i < 0 ? '' : saveCode.slice(i, saveCode.indexOf(']);', i));
})();
const globalBlock = (() => {
  const i = saveCode.indexOf('const GLOBAL_KEYS = new Set([');
  return i < 0 ? '' : saveCode.slice(i, saveCode.indexOf(']);', i));
})();

check('SANDBOX_KEYS block was located', sandboxBlock.length > 0);
check('GLOBAL_KEYS block was located',  globalBlock.length > 0);
for (const k of ['tutorialBtnSeen', 'tutorialIntroSeen', 'tutorialRead']) {
  check(`${k} is NOT in SANDBOX_KEYS`, !sandboxBlock.includes(`'${k}'`));
  check(`${k} IS in GLOBAL_KEYS`,       globalBlock.includes(`'${k}'`));
}
// Guard the guard: run-progress keys must still be sandboxed, so the block
// extraction is demonstrably reading real membership rather than empty text.
check('SANDBOX_KEYS still contains run progress (money)',
  sandboxBlock.includes("'money'"));
check('SANDBOX_KEYS still contains run progress (liveRun)',
  sandboxBlock.includes("'liveRun'"));

// ── 5a. Normal (non-Custom) mode: the baseline must persist ───────────────
{
  localStorage.clear();
  const sv = new SaveSystem();
  setBtnSeen(sv, 'phone');
  check('normal mode: durable JSON has global.tutorialBtnSeen.phone === true',
    rawGlobal('tutorialBtnSeen')?.phone === true);
}

// ── 5b. Custom / sandbox mode: the actual reported bug ────────────────────
{
  localStorage.clear();
  const sv = new SaveSystem();
  sv.setSandbox(true);                       // Custom run active
  check('sandbox: button reads unseen before touch', btnSeen(sv, 'phone') === false);

  setBtnSeen(sv, 'phone');                   // player touches Tutorial

  check('sandbox: pulse stops immediately (in-session read is true)',
    btnSeen(sv, 'phone') === true);
  check('sandbox: durable JSON has global.tutorialBtnSeen.phone === true',
    rawGlobal('tutorialBtnSeen')?.phone === true);

  // Full restart: drop the sandbox and reconstruct from localStorage.
  sv.setSandbox(false);
  const restarted = new SaveSystem();
  check('sandbox: flag survives setSandbox(false)', btnSeen(sv, 'phone') === true);
  check('sandbox: flag survives a full SaveSystem restart',
    btnSeen(restarted, 'phone') === true);
  check('sandbox: restarted instance still shows no highlight',
    btnSeen(restarted, 'phone') === true);
  check('sandbox: untouched buttons still highlight after restart',
    btnSeen(restarted, 'game_menu') === false);
}

// ── 5c. The other two tutorial keys route durably under sandbox too ───────
{
  localStorage.clear();
  const sv = new SaveSystem();
  sv.setSandbox(true);
  sv.set('tutorialIntroSeen', true);
  sv.set('tutorialRead', { some_entry: true });
  check('sandbox: tutorialIntroSeen persists', rawGlobal('tutorialIntroSeen') === true);
  check('sandbox: tutorialRead persists',      rawGlobal('tutorialRead')?.some_entry === true);
  const restarted = new SaveSystem();
  check('sandbox: tutorialIntroSeen survives restart',
    restarted.get('tutorialIntroSeen', false) === true);
  check('sandbox: tutorialRead survives restart',
    restarted.get('tutorialRead', {})?.some_entry === true);
}

// ── 5d. Run progress MUST still be sandboxed (no over-correction) ─────────
// Removing the tutorial keys must not leak actual Custom-run progress into the
// durable save — that was the 2026-07-23 bug SANDBOX_KEYS exists to prevent.
{
  localStorage.clear();
  const sv = new SaveSystem();
  const before = rawGlobal('money');
  sv.setSandbox(true);
  sv.set('money', 999999);
  check('sandbox: money still routes to the throwaway bucket',
    rawGlobal('money') === before);
  sv.setSandbox(false);
  check('sandbox: Custom money never reached the durable save',
    sv.get('money', 0) !== 999999);
}

// ── 6. Orientation dismissal, gated on first-launch completion ───────────
// Fresh install: rotating must NOT dismiss the title (onboarding owns it).
// Every later launch: rotating to landscape dismisses it, like a tap.
// introDone() is the ONLY input — never liveRun / crash / build id.
{
  const arm = (() => {
    const i = callCode.indexOf('function armOrientationDismiss');
    return i < 0 ? '' : callCode.slice(i, i + 1400);
  })();

  check('armOrientationDismiss exists', arm.length > 0);
  check('first install is gated on introDone()', /if\s*\(\s*!introDone\(\)\s*\)\s*return/.test(arm));
  check('landscape is what triggers it',        arm.includes('orientation: landscape'));
  check('it dismisses via dismissToMenu',       arm.includes('dismissToMenu()'));
  check('handler re-checks introDone before dismissing', /!introDone\(\)\s*\|\|\s*!isLandscape\(\)/.test(arm));
  check('already-landscape returning launch is handled', /if\s*\(\s*isLandscape\(\)\s*\)/.test(arm));
  check('listeners are cleared before arming',  arm.includes('disarmOrientation();'));

  // The decision must not consider run/build state.
  for (const forbidden of ['liveRun', 'crashed', '__BUILD_ID__', 'tutorialBtnSeenBuild']) {
    check(`orientation gate ignores ${forbidden}`, !arm.includes(forbidden));
  }

  // No leak, no double-fire.
  check('teardown disarms orientation',
    /function teardown\(\)[\s\S]{0,300}disarmOrientation\(\)/.test(callCode));
  check('tap path disarms orientation',
    /removeEventListener\('click', onTap\);[\s\S]{0,120}disarmOrientation\(\)/.test(callCode));
  // `[^\n]*` tolerates a trailing comment on the disarm line — stripComments
  // only removes whole-line comments, not end-of-line ones.
  check('handler is one-shot (disarms before dismissing)',
    /disarmOrientation\(\);[^\n]*\n\s*dismissToMenu\(\);/.test(callCode));
  check('handler bails once the splash is gone',
    /state !== 'splash'[\s\S]{0,60}disarmOrientation/.test(callCode));
  check('splash arms the listener', callCode.includes('armOrientationDismiss();'));
}

// ── 7. Phone-tile startup race: bridge exists before the save ────────────
// window.__tut is assigned during main.js module execution; the SaveSystem
// only reaches the registry in BootScene. The tile used to read through the
// bridge in that window, get a hard `false` for a missing store, apply
// tut-flash, and never re-check — which is why the phone button kept pulsing
// while the title/HUD buttons (built inside GameScene, after the save) did not.

/** The bridge exactly as main.js defines it: tri-state, null = save not up. */
const mkBridge = (registry) => ({
  save:    () => registry.get('save'),
  btnSeen: (which) => {
    const save = registry.get('save');
    return save ? !!btnSeen(save, which) : null;
  },
});

/** The FIXED tile-pulse: waits for the save, treats null as unknown. */
const mkPulse = (bridge, tile) => function pulse() {
  const B = bridge;
  const save = B?.save?.();
  if (!B || !save) { tile.deferred++; return; }
  const seen = B.btnSeen('phone');
  if (seen == null) { tile.deferred++; return; }
  tile.flash = !seen;
  tile.synced++;
};

{
  const registry = new Map();
  const bridge = mkBridge(registry);
  const tile = { flash: false, deferred: 0, synced: 0 };
  const pulse = mkPulse(bridge, tile);

  // ── Boot instant: bridge up, save NOT yet registered ──
  check('race: bridge exists before the save', !!bridge && !registry.get('save'));
  check('race: btnSeen reports null (not false) with no save',
    bridge.btnSeen('phone') === null);
  pulse();
  check('race: pulse defers instead of deciding', tile.deferred === 1);
  check('race: tile is NOT highlighted while state is unknown', tile.flash === false);
  check('race: no sync recorded yet', tile.synced === 0);

  // ── BootScene registers a save whose phone flag is already true ──
  localStorage.clear();
  const sv = new SaveSystem();
  setBtnSeen(sv, 'phone');
  registry.set('save', sv);

  check('race: btnSeen now answers true', bridge.btnSeen('phone') === true);
  pulse();
  check('race: tile syncs once the save lands', tile.synced === 1);
  check('race: button is NOT highlighted for an already-seen flag',
    tile.flash === false);

  // Re-running (menu open / slot switch) must stay correct.
  pulse(); pulse();
  check('race: repeat syncs stay unhighlighted', tile.flash === false);
}

{
  // Inverse: a genuinely unseen button must still light up once known.
  const registry = new Map();
  const bridge = mkBridge(registry);
  const tile = { flash: false, deferred: 0, synced: 0 };
  const pulse = mkPulse(bridge, tile);
  localStorage.clear();
  registry.set('save', new SaveSystem());
  pulse();
  check('race: untouched button DOES highlight once state is known',
    tile.flash === true);
  // …and stops for good after the touch.
  setBtnSeen(registry.get('save'), 'phone');
  pulse();
  check('race: highlight clears after the touch', tile.flash === false);
}

{
  // `!null` is TRUE — coercing the unknown state would re-light the button.
  // This is the trap the fix must not fall into.
  check('race: !null would wrongly highlight (guard is required)', !null === true);
}

// Source invariants: the real tile-pulse must wait on the save, not the bridge.
{
  const pulseSrc = (() => {
    const i = indexCode.indexOf('const tutmTilePulse');
    return i < 0 ? '' : indexCode.slice(i, i + 700);
  })();
  check('tutmTilePulse exists', pulseSrc.length > 0);
  check('tutmTilePulse waits for the actual save', /B\?\.save\?\.\(\)/.test(pulseSrc));
  check('tutmTilePulse defers when the save is missing', /!B\s*\|\|\s*!save/.test(pulseSrc));
  check('tutmTilePulse treats null as unknown', /seen == null/.test(pulseSrc));
  check('tutmTilePulse never toggles on a null', !/toggle\([^)]*!B\.btnSeen/.test(pulseSrc));
  check('tile sync is exposed for re-runs', indexCode.includes('window.__tutmTileSync = tutmTilePulse'));

  check('bridge btnSeen returns null when the save is absent',
    /save \? !!Tut\.btnSeen\(save, which\) : null/.test(mainCode));
  check('phone-menu open re-syncs the tile',
    /open:[\s\S]{0,400}__tutmTileSync/.test(mainCode));
  check('slot switch re-syncs the tile', sceneCode.includes('window.__tutmTileSync?.()'));
}

// ── 10. Boot texture budget — RATCHET ────────────────────────────────────
// The iPhone restart symptom is an OS memory termination (no JS error, so the
// crash overlay never fires).  BootScene.preload() queues the WHOLE manifest:
// 347 entries, 244 MB compressed but ~830 MB DECODED, because a texture costs
// w x h x 4 regardless of how well its file compresses.
//
// The fix is an on-demand asset lifecycle, which is not built yet — so this is
// a RATCHET, not the bound the notes ultimately want: it passes at today's
// number and fails if boot grows.  A test that merely confirmed every manifest
// file loads would preserve the bug, which is exactly what the notes warn
// against.  Lower BOOT_ENTRY_CEILING as assets move behind the off-ramp
// boundary; never raise it.
{
  const { flattenManifest, bootManifest, restStopManifest, REST_STOP_GROUPS } =
    await import('../src/systems/AssetManifest.js');
  const { decodedBytes, MOBILE_BUDGET_MB } = await import('../src/systems/TextureBudget.js');

  // Ratchet DOWN only.  Raising it is a DELIBERATE re-baseline that must be
  // justified here, never a reflex to make the suite green:
  //   347  measured 2026-09-07 (244 MB compressed / 830 MB decoded)
  //   348  +ui_top_btn_rewind — a 150x150 button plate, 90 KB decoded.
  //        Re-baselined because it is a UI icon, not route/story art; it does
  //        not move the decoded total that this guard exists to protect.
  //   315  2026-09-09 off-ramp split: npc + npcBusinesses + shopfronts (33
  //        entries, ~200 MB decoded) moved behind the rest-stop boundary —
  //        BootScene now loads bootManifest(), RestStopScene preloads the rest.
  // Anything that would add a full-size scene, story or vehicle image belongs
  // behind the off-ramp boundary instead of in this number.
  const BOOT_ENTRY_CEILING = 315;
  const n = bootManifest().length;
  console.log(`      → boot manifest: ${n} entries (ceiling ${BOOT_ENTRY_CEILING}; ${restStopManifest().length} deferred to the off-ramp)`);

  check('boot manifest has not grown', n <= BOOT_ENTRY_CEILING);
  check('boot manifest is non-empty', n > 0);
  check('BootScene queues the SPLIT manifest, not the full one',
    readFileSync(ROOT + 'src/scenes/BootScene.js', 'utf8').includes('bootManifest()'));

  // The off-ramp split itself: the deferred set is real, disjoint from boot,
  // and RestStopScene actually preloads it.
  check('rest-stop groups are declared', REST_STOP_GROUPS.length >= 3);
  check('deferred set is non-empty', restStopManifest().length >= 30);
  const bootKeys = new Set(bootManifest().map(e => e.key));
  check('deferred set is disjoint from boot',
    restStopManifest().every(e => !bootKeys.has(e.key)));
  check('boot + deferred = full manifest',
    bootManifest().length + restStopManifest().length === flattenManifest().length);
  check('RestStopScene preloads the deferred set',
    readFileSync(ROOT + 'src/scenes/RestStopScene.js', 'utf8').includes('restStopManifest()'));

  // The probe that makes the reduction measurable must stay wired.
  const bootSrc = readFileSync(ROOT + 'src/scenes/BootScene.js', 'utf8');
  check('texture probe is installed at boot', bootSrc.includes('installTextureProbe'));
  check('post-boot texture total is logged', bootSrc.includes('logTextureReport'));

  // decodedBytes is the whole point: compression does not reduce texture memory.
  check('decodedBytes is w*h*4', decodedBytes(1672, 941) === 1672 * 941 * 4);
  // 1672*941*4 = 6,293,408 B = 6.00 MiB.
  check('a 1672x941 panel costs ~6.0 MB decoded',
    Math.abs(decodedBytes(1672, 941) / 1048576 - 6.0) < 0.05);
  check('mobile budget is documented', MOBILE_BUDGET_MB > 0 && MOBILE_BUDGET_MB <= 400);

  // Story panels must NOT be in the boot manifest — they load at the stop.
  const storyInBoot = bootManifest().filter(e => /storylines\//.test(e.path));
  check('Ch.18 story art is not queued at boot', storyInBoot.length === 0);
}

// ── 11. On-demand story art must be released ─────────────────────────────
// The tile loads panel art at runtime; without release it grows the resident
// set every rest stop — the same retention class as the boot manifest.
{
  const tileSrc = readFileSync(ROOT + 'src/ui/StoryTile.js', 'utf8');
  check('tile tracks the panel textures it loads', tileSrc.includes('loadedArtKeys.add(url)'));
  check('tile releases them on finish', /finish = \(\)[\s\S]{0,400}textures\.remove\(k\)/.test(tileSrc));
  check('release happens after teardown',
    /teardown\(\);[\s\S]{0,200}textures\.remove/.test(tileSrc));
}

console.log(`\nlaunch tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
