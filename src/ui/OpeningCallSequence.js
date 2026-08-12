/**
 * OpeningCallSequence — the one-time incoming call that opens a new game.
 *
 * A full-portrait overlay that sits ABOVE both Phaser and the phone menu:
 *
 *   1. `incoming_call_club_manager.png` with an iPhone-style call UI over it.
 *      The player slides to answer (pointer, touch, or Enter/Space).
 *   2. Answering starts the manager's voicemail FROM THE GESTURE — iOS only
 *      permits playback that begins inside a real user event, so `play()` is
 *      called synchronously in the accept handler, never from a timer.
 *   3. At t=10s the call art crossfades to `title_screen_vertical.png` while
 *      the audio keeps running underneath.
 *   4. When the audio ends (or at t=20s on the fallback clock) the title
 *      crossfades away to reveal the REAL phone menu — `window.__phoneMenu`,
 *      not a copy of it.
 *
 * The artwork is used exactly as supplied. Nothing here crops, recolours or
 * regenerates it: the stage is locked to the assets' own 853:1844 ratio, so on
 * the target portrait viewports (390x844 = 0.462, 430x932 = 0.461, art = 0.4626)
 * it fills the glass with no visible crop and no stretching whatsoever.
 *
 * MISSING AUDIO IS A SUPPORTED STATE, not an error path bolted on: if
 * `club_manager_offer.mp3` is absent the whole sequence still runs on a
 * wall-clock fallback with one console warning. It never blocks startup and
 * never substitutes speech synthesis.
 */

const AUDIO_SRC   = 'assets/audio/club_manager_offer.mp3';
const SAVE_KEY    = 'settings.introCallDone';
const LS_KEY      = 'rtr_intro_call_done';

/** Seconds from answering to the title crossfade. */
const TITLE_AT_S  = 10;
/** Seconds from answering to the end, when running without audio. */
const FALLBACK_S  = 20;
/** Fraction of the track the knob must cross before the call is accepted. */
const ANSWER_AT   = 0.65;

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
};

/** Crossfade duration. Reduced-motion users get a near-cut instead. */
const fadeMs = () => (reduceMotion() ? 120 : 620);

// ── Completion state ──────────────────────────────────────────────────────
// The save is the real home; localStorage is only the fallback for a boot
// where the registry isn't up yet. Both are written on completion so the
// answer is the same whichever one is readable next time.

function saveObj() {
  try { return window.__phaserGame?.registry?.get?.('save') ?? null; }
  catch (_) { return null; }
}

function introDone() {
  const s = saveObj();
  try { if (s?.get?.(SAVE_KEY, false)) return true; } catch (_) {}
  try { return localStorage.getItem(LS_KEY) === '1'; } catch (_) { return false; }
}

function markIntroDone(done) {
  const s = saveObj();
  try { s?.set?.(SAVE_KEY, !!done); s?.save?.(); } catch (_) {}
  try {
    if (done) localStorage.setItem(LS_KEY, '1');
    else localStorage.removeItem(LS_KEY);
  } catch (_) {}
}

export function initOpeningCall() {
  const root = document.getElementById('opening-call');
  if (!root) return;                      // markup absent — nothing to do

  const callArt  = root.querySelector('.oc-art-call');
  const titleArt = root.querySelector('.oc-art-title');
  const ui       = root.querySelector('.oc-ui');
  const track    = root.querySelector('.oc-track');
  const knob     = root.querySelector('.oc-knob');
  if (!callArt || !titleArt || !ui || !track || !knob) return;

  let state = 'idle';   // idle | ringing | speaking | finishing | done
  let audio = null;
  let usingFallback = false;
  let warned = false;
  let startedAt = 0;
  let raf = 0;
  let titleShown = false;
  let dragId = null;    // pointerId of the drag that owns the knob
  let dragFrom = 0;
  let knobAt = 0;       // 0..1

  // ── Music suppression ───────────────────────────────────────────────────
  // setMusicPaused HOLDS the music (stops the scheduler and any real track)
  // rather than merely ducking it, which is what we want while the manager
  // talks. Restoring is guarded by `musicWasPaused` so we never un-pause music
  // that the player themselves had paused in the Music app.
  let musicWasPaused = null;
  let musicStarted = false;
  const suppressMusic = (on) => {
    const a = window.__audio;
    if (!a?.setMusicPaused) return;
    try {
      if (on) {
        if (musicWasPaused === null) musicWasPaused = !!a.musicPaused;
        a.setMusicPaused(true);
      } else if (musicWasPaused === false) {
        a.setMusicPaused(false);          // only if WE paused it
        musicWasPaused = null;
      } else {
        musicWasPaused = null;            // player had it paused; leave alone
      }
    } catch (_) {}
  };

  /**
   * Bring the menu music up once the manager has finished talking.
   *
   * Releasing the hold is not enough on a fresh boot: if the browser blocked
   * autoplay there was never any playback to resume, so the menu would sit
   * silent. Answering the call IS the user gesture that makes playback legal,
   * so this kicks it the same way the game does after an autoplay block
   * (GameScene ~23398: `_enablePlayback()` then `play()`).
   *
   * Guarded twice against double-playing: `musicStarted` makes it once-only,
   * and it only calls play() when the audio context is not already running —
   * i.e. only when nothing is sounding. If the player had music paused in the
   * Music app, suppressMusic(false) leaves it paused and this stays silent.
   */
  const startMusicAfterCall = () => {
    if (musicStarted) return;
    musicStarted = true;
    suppressMusic(false);
    const a = window.__audio;
    if (!a) return;
    try {
      if (a.musicPaused) return;          // player's own pause — respect it
      // Radio-scan hold music (owner 2026-08-11): after the voicemail the
      // radio surfs the dial on a seamless loop until the player picks a
      // genre (station action) or starts a run (default genre takes over).
      if (a.playRadioScan) { a.playRadioScan(); return; }
      if (a._ctx?.state !== 'running') {
        a._enablePlayback?.();
        a.play?.();
      }
    } catch (_) {}
  };

  // ── Knob ────────────────────────────────────────────────────────────────

  const maxTravel = () => Math.max(1, track.clientWidth - knob.offsetWidth - 8);

  const setKnob = (t, animate) => {
    knobAt = Math.max(0, Math.min(1, t));
    knob.style.transition = animate
      ? `transform ${reduceMotion() ? 90 : 260}ms cubic-bezier(.22,.9,.28,1)`
      : 'none';
    knob.style.transform = `translateX(${knobAt * maxTravel()}px)`;
    // Hint text fades out as the knob travels, like the real control.
    const hint = root.querySelector('.oc-slide-hint');
    if (hint) hint.style.opacity = String(Math.max(0, 1 - knobAt * 2.2));
    knob.setAttribute('aria-valuenow', String(Math.round(knobAt * 100)));
    root.classList.toggle('oc-dragging', knobAt > 0.02);
  };

  const releaseKnob = () => {
    dragId = null;
    if (knobAt >= ANSWER_AT) accept();
    else setKnob(0, true);                // spring back
  };

  knob.addEventListener('pointerdown', (e) => {
    if (state !== 'ringing') return;
    // Repeated / multi-touch pointerdowns must not hijack an in-flight drag.
    if (dragId !== null) return;
    dragId = e.pointerId;
    dragFrom = e.clientX - knobAt * maxTravel();
    try { knob.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    e.stopPropagation();
  });

  knob.addEventListener('pointermove', (e) => {
    if (state !== 'ringing' || e.pointerId !== dragId) return;
    setKnob((e.clientX - dragFrom) / maxTravel(), false);
    e.preventDefault();
  });

  const endDrag = (e) => {
    if (e.pointerId !== dragId) return;
    try { knob.releasePointerCapture(e.pointerId); } catch (_) {}
    releaseKnob();
    e.preventDefault();
  };
  knob.addEventListener('pointerup', endDrag);
  knob.addEventListener('pointercancel', endDrag);

  // Keyboard: no dragging required — Enter or Space answers outright, with the
  // knob animating across so the action still reads visually.
  knob.addEventListener('keydown', (e) => {
    if (state !== 'ringing') return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopPropagation();
      setKnob(1, true);
      accept();
    }
  });

  // ── Accept ──────────────────────────────────────────────────────────────

  function accept() {
    if (state !== 'ringing') return;      // repeated events are inert
    state = 'speaking';
    root.classList.add('oc-answered');
    suppressMusic(true);

    // START AUDIO SYNCHRONOUSLY. This runs inside the pointerup/keydown that
    // accepted the call, which is the only reason iOS will allow it.
    try {
      audio = new Audio(AUDIO_SRC);
      audio.preload = 'auto';
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', onAudioMissing, { once: true });
      const p = audio.play();
      if (p?.catch) p.catch(onAudioMissing);
    } catch (_) {
      onAudioMissing();
    }

    startedAt = performance.now();
    tick();
  }

  function onAudioMissing() {
    if (usingFallback) return;
    usingFallback = true;
    if (!warned) {
      warned = true;
      // FALLBACK TIMER — exactly one warning, as specified.
      console.warn(
        `[OpeningCallSequence] ${AUDIO_SRC} missing or unplayable — running the ` +
        `${FALLBACK_S}s FALLBACK TIMER. The sequence is fully functional; drop the ` +
        `recording in to replace the timer.`);
    }
    try { audio?.pause?.(); } catch (_) {}
    audio = null;
  }

  // ── Timeline ────────────────────────────────────────────────────────────
  // Driven by the audio's own clock when it is playing, and by wall clock
  // otherwise. Wall clock keeps advancing while a tab is hidden, so a
  // backgrounded intro resumes at the right place instead of stalling.

  function elapsed() {
    if (audio && !usingFallback && Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
      return audio.currentTime;
    }
    return (performance.now() - startedAt) / 1000;
  }

  function tick() {
    if (state !== 'speaking') return;
    const t = elapsed();
    if (!titleShown && t >= TITLE_AT_S) showTitle();
    if (usingFallback && t >= FALLBACK_S) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  function showTitle() {
    if (titleShown) return;
    titleShown = true;
    titleArt.style.transition = `opacity ${fadeMs()}ms ease`;
    titleArt.style.opacity = '1';
    // The call UI belongs to the call, not the title.
    ui.style.transition = `opacity ${fadeMs()}ms ease`;
    ui.style.opacity = '0';
    ui.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (state !== 'idle') ui.style.display = 'none'; }, fadeMs());
  }

  function finish() {
    if (state === 'finishing' || state === 'done') return;
    state = 'finishing';
    cancelAnimationFrame(raf);
    try { audio?.pause?.(); } catch (_) {}

    // The title may not have appeared yet if the recording is short — make
    // sure the sequence never ends on the call artwork.
    showTitle();

    // Music comes up as the voicemail ends (owner), so it is already playing
    // under the crossfade into the phone menu rather than arriving after it.
    startMusicAfterCall();

    // Open the REAL phone menu underneath, then fade this overlay off it, so
    // the menu is revealed rather than reconstructed.
    try { window.__phoneMenu?.open?.(); } catch (_) {}

    requestAnimationFrame(() => {
      root.style.transition = `opacity ${fadeMs()}ms ease`;
      root.style.opacity = '0';
      setTimeout(teardown, fadeMs() + 40);
    });
  }

  function teardown() {
    state = 'done';
    cancelAnimationFrame(raf);
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('opening-call-active');
    startMusicAfterCall();               // no-op if finish() already did it
    markIntroDone(true);
    try { audio?.pause?.(); } catch (_) {}
    audio = null;
  }

  // ── Interruptions ───────────────────────────────────────────────────────

  document.addEventListener('visibilitychange', () => {
    if (state !== 'speaking' || !audio) return;
    if (document.hidden) { try { audio.pause(); } catch (_) {} }
    else { try { audio.play()?.catch?.(() => {}); } catch (_) {} }
  });

  // Orientation / resize only re-seats the knob; the sequence itself is
  // unaffected and must never restart.
  window.addEventListener('resize', () => {
    if (state === 'ringing') setKnob(knobAt, false);
  });

  // ── Start / replay ──────────────────────────────────────────────────────

  function start() {
    if (state !== 'idle' && state !== 'done') return;
    state = 'ringing';
    titleShown = false;
    usingFallback = false;
    warned = false;
    knobAt = 0;
    root.style.display = 'block';
    root.style.opacity = '1';
    root.removeAttribute('aria-hidden');
    root.classList.remove('oc-answered');
    document.body.classList.add('opening-call-active');
    titleArt.style.transition = 'none';
    titleArt.style.opacity = '0';
    ui.style.display = '';
    ui.style.transition = 'none';
    ui.style.opacity = '1';
    ui.removeAttribute('aria-hidden');
    setKnob(0, false);
    suppressMusic(true);
    // Focus the control so a keyboard-only player can answer immediately.
    try { knob.focus({ preventScroll: true }); } catch (_) {}
  }

  // Dev-only replay: clears the completion flag and runs it again WITHOUT
  // touching game progress — nothing else in the save is read or written.
  window.__replayOpeningCall = () => {
    markIntroDone(false);
    try { window.__phoneMenu?.close?.(); } catch (_) {}
    musicStarted = false;                // a replay gets its music cue back
    state = 'idle';
    start();
    return 'replaying opening call';
  };

  if (!introDone()) start();
  else suppressMusic(false);
}
