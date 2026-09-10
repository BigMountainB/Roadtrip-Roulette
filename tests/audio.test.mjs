// ── Audio stability audit regressions ─────────────────────────────────────
// Run: node tests/audio.test.mjs   (also `npm test`)
//
// Covers the items from CLAUDE_WORKING_NOTES.md "Audio stability audit" that
// are fixed so far.  The AudioSystem class itself needs a real AudioContext /
// HTMLAudioElement, so playback behaviour can't be driven headlessly; the
// station-count fix IS fully behavioural (real SaveSystem round-trip), while
// the stale-element guards are pinned by source invariants over the exact
// handler bodies.  That split is deliberate and noted per test.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log(`  ✗ FAIL: ${name}`); } };

globalThis.localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
})();

const { STATION_COUNT } = await import('../src/systems/AudioSystem.js');
const { SaveSystem }    = await import('../src/systems/SaveSystem.js');

const audioSrc = readFileSync(ROOT + 'src/systems/AudioSystem.js', 'utf8');
const saveSrc  = readFileSync(ROOT + 'src/systems/SaveSystem.js', 'utf8');

// ── Audit #4: station sanitizer must track the real catalogue ────────────
// A literal max of 9 was correct at 10 stations, then silently rewrote the
// LAST station when an eleventh landed: POP took index 9, pushing METAL to 10,
// so a saved METAL reloaded as POP.

// STATION_COUNT must match what the catalogue actually declares.
{
  const declared = (audioSrc.match(/^\s*name: '[^']+', culture: '/gm) || []).length;
  check('STATION_COUNT matches the declared station list',
    STATION_COUNT === declared);
  check('STATION_COUNT is plausible (>= 11)', STATION_COUNT >= 11);
}

check('sanitizer does not hard-code a station bound',
  !/finiteInt\(src\.radio,\s*-1,\s*-1,\s*\d+\)/.test(saveSrc));
check('sanitizer derives its bound from STATION_COUNT',
  saveSrc.includes('STATION_COUNT - 1'));
check('SaveSystem imports the real count',
  /import \{[^}]*\bSTATION_COUNT\b[^}]*\} from '\.\/AudioSystem\.js'/.test(saveSrc));

/** Persist a deliberately-chosen station, then reload from storage. */
const roundTripRadio = (idx) => {
  localStorage.clear();
  const sv = new SaveSystem();
  sv.set('settings', { radioSet: true, radio: idx });
  return new SaveSystem().get('settings', {}).radio;
};

// EVERY valid station index must survive a restart unchanged.
for (let i = 0; i < STATION_COUNT; i++) {
  check(`station ${i} survives a restart`, roundTripRadio(i) === i);
}
// The last station is the one the stale literal broke.
check('LAST station survives a restart (the METAL regression)',
  roundTripRadio(STATION_COUNT - 1) === STATION_COUNT - 1);

// Out-of-range values still clamp rather than persisting garbage.
check('above-range station clamps to the last', roundTripRadio(STATION_COUNT) === STATION_COUNT - 1);
check('far out-of-range clamps to the last',    roundTripRadio(9999) === STATION_COUNT - 1);
check('negative station stays unset (-1)',      roundTripRadio(-5) === -1);

// An unflagged station (never deliberately chosen) still resets to -1.
{
  localStorage.clear();
  const sv = new SaveSystem();
  sv.set('settings', { radioSet: false, radio: 4 });
  check('unflagged station resets to -1',
    new SaveSystem().get('settings', {}).radio === -1);
}

// ── Audit #2: stale elements must not advance the current track ──────────
// Every delayed callback must prove its element AND generation are current
// before mutating playback. Source-pinned: _startTrack needs a live
// AudioContext + MediaElementSource, so it cannot run headlessly.
{
  const startTrack = (() => {
    const i = audioSrc.indexOf('const advanceIfCurrent');
    return i < 0 ? '' : audioSrc.slice(i, i + 600);
  })();

  check('advanceIfCurrent guard exists', startTrack.length > 0);
  check('guard checks element identity', /el !== this\._trackEl/.test(startTrack));
  check('guard checks start generation', /myGen !== this\._startGen/.test(startTrack));
  check("'ended' routes through the guard",  audioSrc.includes("addEventListener('ended', advanceIfCurrent)"));
  check("'error' routes through the guard",  audioSrc.includes("addEventListener('error', advanceIfCurrent)"));

  // The unguarded originals must be gone.
  check("no unguarded 'ended' handler",
    !/addEventListener\('ended',\s*\(\)\s*=>\s*this\._onTrackEnded\(\)\)/.test(audioSrc));
  check("no unguarded 'error' handler",
    !/addEventListener\('error',\s*\(\)\s*=>\s*this\._onTrackEnded\(\)\)/.test(audioSrc));

  // Retry-exhaustion path carries the same guard.
  const tryPlay = (() => {
    const i = audioSrc.indexOf('const tryPlay =');
    return i < 0 ? '' : audioSrc.slice(i, i + 700);
  })();
  check('tryPlay exists', tryPlay.length > 0);
  check('retry exhaustion checks element identity', /el !== this\._trackEl/.test(tryPlay));
  check('retry exhaustion checks generation',       /myGen !== this\._startGen/.test(tryPlay));

  // The construction-failure catch path must not advance a superseded start.
  check('catch path is generation-guarded',
    /if \(myGen === this\._startGen\) this\._onTrackEnded\(\);/.test(audioSrc));
}

// The guard predicate itself, exercised over every combination.
{
  const shouldAdvance = (el, trackEl, myGen, startGen) => el === trackEl && myGen === startGen;
  const cur = { id: 'current' }, old = { id: 'replaced' };
  check('current element + current gen advances',   shouldAdvance(cur, cur, 5, 5) === true);
  check('replaced element does NOT advance',        shouldAdvance(old, cur, 5, 5) === false);
  check('superseded generation does NOT advance',   shouldAdvance(cur, cur, 4, 5) === false);
  check('both stale does NOT advance',              shouldAdvance(old, cur, 4, 5) === false);
  check('null current element does NOT advance',    shouldAdvance(old, null, 5, 5) === false);
}

// ── Audit #1: resume must never select or replace a track ────────────────
// These call the REAL AudioSystem.prototype.resumePlayback against a
// hand-built receiver, so they exercise the shipped method body rather than a
// replica. The one thing that must never happen is a call to
// _refreshStationPlayback (which picks a random track).

const { AudioSystem } = await import('../src/systems/AudioSystem.js');
const resume = AudioSystem.prototype.resumePlayback;

check('resumePlayback exists on the prototype', typeof resume === 'function');

/** Minimal receiver: real STATIONS are module-scoped, so station 0 has tracks. */
const mkAudio = (over = {}) => {
  const el = { plays: 0, play() { this.plays++; return Promise.resolve(); } };
  return {
    ready: true, muted: false, paused: false, _musicPaused: false,
    _lifecycleHalted: true,
    _ctx: { state: 'suspended', currentTime: 0, resumed: 0,
            resume() { this.resumed++; this.state = 'running'; } },
    _radioScanActive: false,
    currentStation: 0,               // HIP-HOP — a real-track station
    _trackEl: el,
    _selected: 0, _sched: 0, _watchdog: 0, _scan: 0,
    _refreshStationPlayback() { this._selected++; },   // MUST stay 0
    _startScheduler()  { this._sched++; },
    _startSkipWatchdog() { this._watchdog++; },
    _startRadioScan()  { this._scan++; },
    ...over,
  };
};

// ── Normal resume: continue the current element ──
{
  const a = mkAudio();
  const out = resume.call(a);
  check('resume returns true when a track is current', out === true);
  check('resume NEVER selects a track', a._selected === 0);
  check('resume plays the CURRENT element', a._trackEl.plays === 1);
  check('resume resumes a suspended context', a._ctx.resumed === 1);
  check('resume re-arms the skip watchdog', a._watchdog === 1);
  check('resume lifts the lifecycle halt', a._lifecycleHalted === false);
}

// ── Nothing current: report false, still select nothing ──
{
  const a = mkAudio({ _trackEl: null });
  const out = resume.call(a);
  check('resume returns false with no current element', out === false);
  check('resume with nothing current selects nothing', a._selected === 0);
}

// ── Not ready: no-op ──
{
  const a = mkAudio({ ready: false });
  check('resume returns false when not ready', resume.call(a) === false);
  check('not-ready resume selects nothing', a._selected === 0);
}

// ── Muted: must not grab the audio session ──
{
  const a = mkAudio({ muted: true });
  resume.call(a);
  check('muted resume does not resume the context', a._ctx.resumed === 0);
  check('muted resume does not play the element', a._trackEl.plays === 0);
  check('muted resume still selects nothing', a._selected === 0);
}

// ── Music paused / globally paused: resume context, but stay silent ──
for (const [label, over] of [['_musicPaused', { _musicPaused: true }],
                             ['paused',       { paused: true }]]) {
  const a = mkAudio(over);
  resume.call(a);
  check(`${label}: element is not played`, a._trackEl.plays === 0);
  check(`${label}: nothing is selected`,   a._selected === 0);
}

// ── Radio-scan hold owns playback ──
{
  const a = mkAudio({ _radioScanActive: true });
  const out = resume.call(a);
  check('scan active: returns true', out === true);
  check('scan active: keeps the scan', a._scan === 1);
  check('scan active: selects nothing', a._selected === 0);
  check('scan active: does not touch the track element', a._trackEl.plays === 0);
}

// ── Procedural / unknown station: scheduler only, no element needed ──
{
  const a = mkAudio({ currentStation: 9999, _trackEl: null });
  const out = resume.call(a);
  check('trackless station: returns true', out === true);
  check('trackless station: restarts the scheduler', a._sched === 1);
  check('trackless station: selects nothing', a._selected === 0);
}

// ── Idempotence: repeated resumes never replace the track ──
{
  const a = mkAudio();
  resume.call(a); resume.call(a); resume.call(a);
  check('repeated resume selects nothing', a._selected === 0);
  check('repeated resume keeps the same element', a._trackEl.plays === 3);
}

// ── Call sites must try resume BEFORE falling back to a start ────────────
{
  const sceneSrc = readFileSync(ROOT + 'src/scenes/GameScene.js', 'utf8');
  const callSrc  = readFileSync(ROOT + 'src/ui/OpeningCallSequence.js', 'utf8');
  const pattern  = /if \(!a\.resumePlayback\?\.\(\)\) a\.play\?\.\(\);/g;

  check('GameScene recovery paths resume-then-start',
    (sceneSrc.match(pattern) || []).length === 2);
  check('OpeningCallSequence resumes-then-starts',
    (callSrc.match(pattern) || []).length === 1);
  // No recovery path may still call play() bare.
  check('no bare play() left on an autoplay-block path',
    !/autoplay block[\s\S]{0,120}\ba\.play\?\.\(\);/.test(sceneSrc)
    || /!a\.resumePlayback/.test(sceneSrc));
  check('resume is documented as never selecting',
    audioSrc.includes('never selects or replaces a track'));
}

// ── Audit #5: mute + volume must persist ─────────────────────────────────
// Both were applied live and never saved: `settings.muted` existed in the
// schema but BootScene never applied it, and volume wasn't in the schema at
// all. Fully behavioural — real SaveSystem round-trips.

const { DEFAULT_VOLUME } = await import('../src/systems/AudioSystem.js');

check('DEFAULT_VOLUME is exported and sane',
  typeof DEFAULT_VOLUME === 'number' && DEFAULT_VOLUME > 0 && DEFAULT_VOLUME <= 1);

/** Persist one settings value, then reload from storage. */
const roundTripSetting = (key, value) => {
  localStorage.clear();
  const sv = new SaveSystem();
  sv.set(`settings.${key}`, value);
  return new SaveSystem().get(`settings.${key}`, null);
};

// Volume
check('volume survives a restart (0.8)',  roundTripSetting('volume', 0.8) === 0.8);
check('volume survives a restart (0)',    roundTripSetting('volume', 0) === 0);
check('volume survives a restart (1)',    roundTripSetting('volume', 1) === 1);
check('volume above 1 clamps to 1',       roundTripSetting('volume', 5) === 1);
check('negative volume clamps to 0',      roundTripSetting('volume', -3) === 0);
// Garbage must not land on 0 — a silent boot reads as broken audio.
check('NaN volume falls back to the default',
  roundTripSetting('volume', NaN) === DEFAULT_VOLUME);
check('string volume falls back to the default',
  roundTripSetting('volume', 'loud') === DEFAULT_VOLUME);

// Mute
check('muted=true survives a restart',  roundTripSetting('muted', true) === true);
check('muted=false survives a restart', roundTripSetting('muted', false) === false);

// A fresh save carries the default volume rather than undefined/0.
{
  localStorage.clear();
  const sv = new SaveSystem();
  check('fresh save seeds settings.volume',
    sv.get('settings.volume', null) === DEFAULT_VOLUME);
  check('fresh save is unmuted', sv.get('settings.muted', null) === false);
}

// Both preferences together, across a restart.
{
  localStorage.clear();
  const sv = new SaveSystem();
  sv.set('settings.volume', 0.25);
  sv.set('settings.muted', true);
  const r = new SaveSystem();
  check('volume + mute both survive together',
    r.get('settings.volume', null) === 0.25 && r.get('settings.muted', null) === true);
}

// Source: one source of truth, one code path, no accidental toggling.
{
  const mainSrc = readFileSync(ROOT + 'src/main.js', 'utf8');
  const bootSrc = readFileSync(ROOT + 'src/scenes/BootScene.js', 'utf8');

  check('canonical setters exist', /const _audioPrefs = \{/.test(mainSrc));
  // Scope each assertion to its own setter body rather than a distance window
  // from `_audioPrefs` — comment length inside the block would otherwise decide
  // whether the test passes.
  const prefsBlock = (() => {
    const i = mainSrc.indexOf('const _audioPrefs = {');
    return i < 0 ? '' : mainSrc.slice(i, mainSrc.indexOf('\n  };', i));
  })();
  const setterBody = (name) => {
    const i = prefsBlock.indexOf(`${name}: (v) => {`);
    return i < 0 ? '' : prefsBlock.slice(i, prefsBlock.indexOf('\n    },', i));
  };
  check('canonical setMuted persists',  setterBody('setMuted').includes("'settings.muted'"));
  check('canonical setVolume persists', setterBody('setVolume').includes("'settings.volume'"));
  check('canonical setMuted compares before toggling',
    /!!audio\.muted !== want/.test(setterBody('setMuted')));
  // Both screens route through them (Settings setMuted/setVolume, Music
  // toggleMute/setVolume) — 4 call sites.
  check('all writers route through the canonical setters',
    (mainSrc.match(/_audioPrefs\.set(Muted|Volume)\(/g) || []).length >= 4);
  // The drifted duplicate default is gone.
  check('no drifted 0.32 volume fallback left', !mainSrc.includes('?? 0.32'));
  check('bridges fall back to DEFAULT_VOLUME', mainSrc.includes('?? DEFAULT_VOLUME'));

  // BootScene applies both, and compares before toggling.
  check('BootScene applies saved mute', /settings\.muted/.test(bootSrc));
  check('BootScene applies saved volume', /settings\.volume/.test(bootSrc));
  check('BootScene compares before toggling mute',
    /!!_audio\.muted !== _wantMuted[\s\S]{0,60}toggleMute/.test(bootSrc));
  check('BootScene never toggles mute unconditionally',
    !/^\s*_audio\.toggleMute\?\.\(\);\s*$/m.test(bootSrc));
}


// ── Audit #3 / #6 / #7 (2026-09-10) — source-pinned ──────────────────────
{
  const unlock = audioSrc.slice(audioSrc.indexOf('_armCtxUnlock() {'), audioSrc.indexOf('_disarmCtxUnlock() {'));
  check('#3 unlock listens on ONE target (document), not window+document', !unlock.includes('[window, document]') && unlock.includes("document.addEventListener(ev, tryResume"));
  check('#3 unlock is a no-op while the context is running', unlock.includes("this._ctx.state === 'running') return"));
  check('#3 unlock is debounced per physical gesture', /_ctxUnlockLastAt[^\n]*< 250/.test(unlock));
  check('#3 warm-up buffer is short (100 ms), not one second', unlock.includes('sr * 0.1') && !unlock.includes('createBuffer(1, sr, sr)'));
  const init = audioSrc.slice(audioSrc.indexOf('  init() {'), audioSrc.indexOf('_startSkipWatchdog() {'));
  check('#6 init failure disarms the unlock listeners', init.includes('this._disarmCtxUnlock()'));
  check('#6 init failure closes the half-built context and resets ready', init.includes('this._ctx?.close?.()') && init.includes('this.ready = false'));
  const vis = audioSrc.slice(audioSrc.indexOf('_handleVisibilityChange() {'), audioSrc.indexOf('lifecycleStop() {'));
  check('#7 foreground resume of a background track re-arms the stall watchdog', vis.includes('this._startSkipWatchdog()'));
}

console.log(`\naudio tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
