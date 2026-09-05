/**
 * OpeningCallSequence — the one-time incoming call that opens a new game.
 *
 * A full-portrait overlay that sits ABOVE both Phaser and the phone menu:
 *
 *   1. `incoming_call_club_manager.png` with an iPhone-style call UI over it.
 *      ANSWER / DECLINE buttons (owner 2026-08-31 — the slide was unreliable
 *      on iOS: drags ending in pointercancel neither answered nor counted as
 *      an audio gesture; a tap's `click` is exactly what iOS honors).
 *   2. Answering starts the manager's voicemail FROM THE GESTURE — `play()`
 *      is called synchronously in the click handler, never from a timer.
 *      DECLINE skips the voicemail and goes straight to the phone menu
 *      (the intro still counts as done).
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
  const answerBtn  = root.querySelector('.oc-answer');
  const declineBtn = root.querySelector('.oc-decline');
  if (!callArt || !titleArt || !ui || !answerBtn || !declineBtn) return;

  let state = 'idle';   // idle | ringing | speaking | finishing | done
  let audio = null;
  let usingFallback = false;
  let warned = false;
  let startedAt = 0;
  let raf = 0;
  let titleShown = false;

  // ── Music suppression ───────────────────────────────────────────────────
  // setMusicPaused HOLDS the music (stops the scheduler and any real track)
  // rather than merely ducking it, which is what we want while the manager
  // talks. Restoring is guarded by `musicWasPaused` so we never un-pause music
  // that the player themselves had paused in the Music app.
  let musicWasPaused = null;
  let musicStarted = false;

  // ── iOS audio unlock (owner 2026-08-31, round 2) ────────────────────────
  // iOS grants media activation on finger-LIFT events (touchend / click /
  // pointerup) — NOT on pointerdown, which is why the first fix didn't take.
  // Any lift anywhere while the phone is ringing blesses the element with a
  // play-and-pause inside that gesture (including a touch BEFORE the drag —
  // the owner's own suggestion — and the lift that ends the answer slide,
  // whose capture listener runs before the button's own handler).  If accept()
  // has already fired, the bless leaves the playback running.
  const UNLOCK_EVENTS = ['touchend', 'pointerup', 'click'];
  const unlockAudio = () => {
    try {
      if (!audio || audio._unlocked) return;
      const pr = audio.play();
      if (pr?.then) {
        pr.then(() => {
          audio._unlocked = true;
          if (state !== 'speaking') { audio.pause(); audio.currentTime = 0; }
        }, () => {});
      } else {
        audio._unlocked = true;
        if (state !== 'speaking') { audio.pause(); audio.currentTime = 0; }
      }
    } catch (_) {}
  };
  const armUnlock = () => {
    for (const ev of UNLOCK_EVENTS)
      document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
  };
  const disarmUnlock = () => {
    for (const ev of UNLOCK_EVENTS)
      document.removeEventListener(ev, unlockAudio, { capture: true });
  };
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

  // ── Answer / Decline ────────────────────────────────────────────────────
  // Bound on pointerup AND click (the tilt-explainer pattern): the game's
  // global tap handler preventDefault()s touches, which SUPPRESSES the
  // synthetic click on mobile — pointerup still fires and is a valid iOS
  // media-activation gesture, so accept()'s play() stays legal.  click is
  // the desktop/keyboard fallback (<button> fires it for Enter/Space); the
  // state machine ('ringing' guards in accept/decline) absorbs double-fires.
  const bindTap = (btn, cb) => {
    const handler = (ev) => { ev?.preventDefault?.(); cb(); };
    btn.addEventListener('pointerup', handler);
    btn.addEventListener('click', handler);
  };
  bindTap(answerBtn, () => accept());
  bindTap(declineBtn, () => decline());

  // ── Accept ──────────────────────────────────────────────────────────────

  function accept() {
    if (state !== 'ringing') return;      // repeated events are inert
    state = 'speaking';
    root.classList.add('oc-answered');
    suppressMusic(true);

    // START AUDIO SYNCHRONOUSLY. This runs inside the pointerup/keydown that
    // accepted the call, which is the only reason iOS will allow it.  The
    // element itself was created (and its download kicked off) back in
    // start(), so play() finds a warm buffer; the fresh-construction branch
    // is only the belt-and-suspenders for a start() whose construction threw.
    try {
      if (!audio) { audio = new Audio(AUDIO_SRC); audio.preload = 'auto'; }
      audio.addEventListener('ended', finish, { once: true });
      // A 404/decode failure during the ring phase has already fired 'error'
      // (this late listener would miss it) — but that also makes play()
      // reject, so the promise catch below still routes to the fallback.
      audio.addEventListener('error', onAudioMissing, { once: true });
      const p = audio.play();
      if (p?.catch) p.catch(() => {
        // Autoplay rejection (an iOS drag that ended in pointercancel, or a
        // lift the browser didn't credit).  Retry on EVERY lift event until
        // one lands — each is a fresh gesture — and stop once we're audible
        // or the sequence ends.  The wall-clock timeline runs underneath, so
        // the sequence never stalls; a late success just brings the voice in.
        const retry = () => {
          if (state !== 'speaking' || !audio || !audio.paused) { stopRetry(); return; }
          try {
            const pp = audio.play();
            if (pp?.then) pp.then(() => { usingFallback = false; stopRetry(); }, () => {});
          } catch (_) {}
        };
        const stopRetry = () => {
          for (const ev of UNLOCK_EVENTS)
            document.removeEventListener(ev, retry, { capture: true });
        };
        for (const ev of UNLOCK_EVENTS)
          document.addEventListener(ev, retry, { capture: true, passive: true });
        setTimeout(() => {
          if (audio && audio.paused && !usingFallback) onAudioMissing();
        }, 4000);
      });
    } catch (_) {
      onAudioMissing();
    }

    startedAt = performance.now();
    tick();
  }

  /** DECLINE — no voicemail: straight through the title beat to the phone
   *  menu.  Marks the intro done (teardown), so it won't ring again. */
  function decline() {
    if (state !== 'ringing') return;
    state = 'speaking';                 // finish() requires a live sequence
    usingFallback = true;               // no audio will drive the timeline
    startedAt = performance.now();
    finish();
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
    // The element is KEPT (2026-08-31): a later lift-event retry can still
    // bring the voice in mid-sequence; elapsed() ignores it while paused.
  }

  // ── Timeline ────────────────────────────────────────────────────────────
  // Driven by the audio's own clock when it is playing, and by wall clock
  // otherwise. Wall clock keeps advancing while a tab is hidden, so a
  // backgrounded intro resumes at the right place instead of stalling.

  function elapsed() {
    const wall = (performance.now() - startedAt) / 1000;
    if (audio && !usingFallback && !audio.paused
        && Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
      // A late-unlocked voice must not rewind the visual timeline.
      return Math.max(audio.currentTime, Math.min(wall, TITLE_AT_S - 0.01));
    }
    return wall;
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
    disarmUnlock();
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


  // ── Start / replay ──────────────────────────────────────────────────────

  function start() {
    if (state !== 'idle' && state !== 'done') return;
    state = 'ringing';
    titleShown = false;
    usingFallback = false;
    warned = false;
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
    suppressMusic(true);
    armUnlock();
    // PRELOAD the recording while the phone rings.  It used to be fetched
    // inside accept(), so on the deployed site the ~300 KB download raced the
    // player's slide-to-answer and the manager opened with dead air (owner
    // report 2026-08-14).  Only the download starts here — play() stays inside
    // the accept gesture, which is what iOS autoplay policy requires.  No
    // wasted fetch on normal boots: start() only runs when the intro will
    // actually show.
    if (!audio) {
      try {
        audio = new Audio(AUDIO_SRC);
        audio.preload = 'auto';
        audio.load();
      } catch (_) { audio = null; }
    }
    // Focus the control so a keyboard-only player can answer immediately.
    try { answerBtn.focus({ preventScroll: true }); } catch (_) {}
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

  // ?intro=1 forces a replay (owner 2026-08-29): the sequence is once-per-
  // device, so a device that ever completed it — including during the old
  // dead-air era — never shows it again, which reads as "the audio doesn't
  // play".  The param clears the flag and runs it like a first open.
  let force = false;
  try { force = new URLSearchParams(location.search).has('intro'); } catch (_) {}
  if (force) markIntroDone(false);
  if (!introDone()) start();
  else suppressMusic(false);
}
