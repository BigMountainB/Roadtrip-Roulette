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

  // state: idle | splash | ringing | speaking | finishing | done
  //   splash  — the vertical title screen is up, waiting for the first tap
  //             (owner 2026-09-05: the title shows on EVERY open now).
  //   ringing — first open only: the tap promoted the title into the
  //             incoming Club Manager call; the ringtone loops until
  //             Accept/Decline.
  let state = 'idle';
  let audio = null;
  let usingFallback = false;
  let warned = false;
  let startedAt = 0;
  let raf = 0;
  let titleShown = false;

  // ── Synthesized phone ringtone — RECEIVER side (owner 2026-09-05) ───────
  // NOT the caller's ringback buzz (a smooth 440+480 Hz pair — the first
  // cut); this is the classic electromechanical BELL you hear when YOUR
  // phone rings: two detuned gong tones (~1000 + ~1320 Hz, triangle for a
  // metallic edge) rapidly warbled by a ~20 Hz clapper tremolo, in ring
  // bursts (1.6 s ring / 1.6 s gap).  Its own AudioContext so music
  // suppression/gain never touches it; started from the title tap (a valid
  // iOS audio-activation gesture).  No recording ships — drop a file in and
  // swap start() for an <audio loop> to replace it.
  const ring = (() => {
    let ctx = null, master = null, tone = null, o1 = null, o2 = null,
        lfo = null, lfoGain = null, cad = 0, dead = false;
    const RING_S = 1.6, GAP_S = 1.6;
    const burst = () => {
      if (dead || !ctx || !master) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(1, t + 0.02);          // strike on
      master.gain.setValueAtTime(1, t + RING_S - 0.04);
      master.gain.exponentialRampToValueAtTime(0.0001, t + RING_S);   // damp off
    };
    return {
      start() {
        if (ctx) return;
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          dead = false;
          ctx = new AC();
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
          tone = ctx.createGain(); tone.gain.value = 0.06; tone.connect(master);
          o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 1000;
          o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 1320;
          o1.connect(tone); o2.connect(tone);
          // Clapper warble — a 20 Hz tremolo on the tone gain: the rapid
          // two-bell strike that makes this read as a RINGING PHONE, not a
          // ringback tone.
          lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 20;
          lfoGain = ctx.createGain(); lfoGain.gain.value = 0.05;
          lfo.connect(lfoGain); lfoGain.connect(tone.gain);
          o1.start(); o2.start(); lfo.start();
          burst();
          cad = setInterval(burst, (RING_S + GAP_S) * 1000);
        } catch (_) { ctx = null; }
      },
      stop() {
        dead = true;
        try { clearInterval(cad); } catch (_) {}
        try { o1?.stop?.(); o2?.stop?.(); lfo?.stop?.(); } catch (_) {}
        try { ctx?.close?.(); } catch (_) {}
        ctx = master = tone = o1 = o2 = lfo = lfoGain = null;
      },
    };
  })();

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
  // play-and-pause inside that gesture.  The bless runs MUTED (owner
  // 2026-09-07: "the voicemail should not play until, and only if, ANSWER is
  // selected") — the old audible play() leaked the manager's voice under the
  // ring until the play promise settled.  If accept() has already fired by
  // the time the promise resolves, the bless unmutes and leaves it running.
  const UNLOCK_EVENTS = ['touchend', 'pointerup', 'click'];
  const unlockAudio = () => {
    try {
      if (!audio || audio._unlocked) return;
      if (state !== 'speaking') audio.muted = true;   // silent bless
      const settle = () => {
        audio._unlocked = true;
        if (state !== 'speaking') { audio.pause(); audio.currentTime = 0; }
        audio.muted = false;
      };
      const pr = audio.play();
      if (pr?.then) pr.then(settle, () => { try { audio.muted = false; } catch (_) {} });
      else settle();
    } catch (_) { try { audio.muted = false; } catch (_) {} }
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
        // Unblocking the context must not re-roll the song (see
        // AudioSystem.resumePlayback); only start fresh if nothing is current.
        a._enablePlayback?.();
        if (!a.resumePlayback?.()) a.play?.();
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
    ring.stop();                          // ringtone ends the moment it's answered
    root.classList.add('oc-answered');
    suppressMusic(true);

    // START AUDIO SYNCHRONOUSLY. This runs inside the pointerup/keydown that
    // accepted the call, which is the only reason iOS will allow it.  The
    // element itself was created (and its download kicked off) back in
    // start(), so play() finds a warm buffer; the fresh-construction branch
    // is only the belt-and-suspenders for a start() whose construction threw.
    try {
      if (!audio) { audio = new Audio(AUDIO_SRC); audio.preload = 'auto'; }
      audio.muted = false;   // a silent bless may still be in flight — this play is the real one
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

  /** DECLINE — no voicemail, no title beat: straight to the phone menu
   *  (owner 2026-08-31).  Marks the intro done (teardown), so it won't
   *  ring again; menu music still comes up under the fade. */
  function decline() {
    if (state !== 'ringing') return;
    state = 'finishing';
    ring.stop();                         // silence the ring on decline
    root.classList.add('oc-answered');   // buttons fade out immediately
    cancelAnimationFrame(raf);
    startMusicAfterCall();
    try { window.__phoneMenu?.open?.(); } catch (_) {}
    requestAnimationFrame(() => {
      root.style.transition = `opacity ${fadeMs()}ms ease`;
      root.style.opacity = '0';
      setTimeout(teardown, fadeMs() + 40);
    });
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
    disarmOrientation();                 // never leave a rotate listener behind
    ring.stop();                         // never leave the ringtone running
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


  // ── Orientation dismissal, gated on first-launch completion ─────────────
  // A RETURNING launch dismisses the vertical title when the phone is turned to
  // landscape, exactly as a tap would.  The FIRST launch after a fresh install
  // does NOT: the title/call onboarding owns the screen until the player taps,
  // so rotating can never skip it.
  //
  // introDone() (rtr_intro_call_done) is the ONLY input.  Deliberately not
  // liveRun, crash state, build id or app updates — none of those may influence
  // whether the title can be dismissed.
  let orientMQ = null;      // MediaQueryList, while armed
  let onOrient = null;      // handler ref, so teardown can always detach it

  function isLandscape() {
    try { return !!window.matchMedia?.('(orientation: landscape)')?.matches; }
    catch (_) { return false; }
  }

  /** Detach every orientation listener.  Safe to call repeatedly, and called
   *  from teardown + the tap path so a listener can never leak or fire twice. */
  function disarmOrientation() {
    if (onOrient) {
      try { orientMQ?.removeEventListener?.('change', onOrient); } catch (_) {}
      try { orientMQ?.removeListener?.(onOrient); } catch (_) {}   // older WebKit
      try { window.removeEventListener('orientationchange', onOrient); } catch (_) {}
    }
    orientMQ = null;
    onOrient = null;
  }

  /** Arm landscape-dismiss for the splash.  No-op on a first install. */
  function armOrientationDismiss() {
    disarmOrientation();                  // never two live listeners
    if (!introDone()) return;             // first install → onboarding owns it

    onOrient = () => {
      if (state !== 'splash') return disarmOrientation();   // already left
      if (!introDone() || !isLandscape()) return;
      disarmOrientation();                // one-shot
      dismissToMenu();
    };

    try {
      orientMQ = window.matchMedia?.('(orientation: landscape)') ?? null;
      if (orientMQ?.addEventListener) orientMQ.addEventListener('change', onOrient);
      else orientMQ?.addListener?.(onOrient);                // older WebKit
    } catch (_) { orientMQ = null; }
    // orientationchange as a backstop for WebViews that don't fire the MQ.
    try { window.addEventListener('orientationchange', onOrient); } catch (_) {}

    // Returning launch that is ALREADY landscape: dismiss once the splash has
    // painted, rather than never firing because no change event ever arrives.
    if (isLandscape()) setTimeout(() => onOrient?.(), 0);
  }

  // ── Title splash → (first open) ring the call, or (returning) menu ───────

  /** The vertical title screen — shown on EVERY open (owner 2026-09-05).
   *  A tap decides what happens next: a FIRST open rings the Club Manager
   *  (beginCall); a returning open goes straight to the iPhone menu
   *  (dismissToMenu).  Either way the title is the first thing seen. */
  function startTitleSplash() {
    if (state !== 'idle' && state !== 'done') return;
    state = 'splash';
    titleShown = true;
    usingFallback = false;
    warned = false;
    root.style.display = 'block';
    root.style.opacity = '1';
    root.removeAttribute('aria-hidden');
    root.classList.remove('oc-answered');
    document.body.classList.add('opening-call-active');
    // Title only: the call artwork + call UI stay hidden until a first-open
    // tap promotes this into the ringing call.
    callArt.style.display = 'none';
    ui.style.display = 'none';
    ui.setAttribute('aria-hidden', 'true');
    titleArt.style.transition = 'none';
    titleArt.style.opacity = '1';
    // Hold the music until the tap so the tap is what "starts" it (and is a
    // valid iOS audio-activation gesture, whichever branch it takes).
    suppressMusic(true);

    const onTap = (ev) => {
      if (state !== 'splash') return;
      ev?.preventDefault?.();
      root.removeEventListener('pointerup', onTap);
      root.removeEventListener('click', onTap);
      disarmOrientation();                // tap wins; rotate must not re-fire
      if (introDone()) dismissToMenu();   // returning open → straight to menu
      else beginCall(ev);                 // first open → ring the manager
    };
    root.addEventListener('pointerup', onTap);
    root.addEventListener('click', onTap);
    // Returning launches may also dismiss by rotating to landscape; a first
    // install ignores rotation entirely (see armOrientationDismiss).
    armOrientationDismiss();
  }

  /** Returning open: tap on the title starts the menu music and reveals the
   *  real iPhone menu, then fades the splash off it. */
  function dismissToMenu() {
    if (state === 'finishing' || state === 'done') return;
    state = 'finishing';
    startMusicAfterCall();                 // the tap is the gesture that starts it
    try { window.__phoneMenu?.open?.(); } catch (_) {}
    requestAnimationFrame(() => {
      root.style.transition = `opacity ${fadeMs()}ms ease`;
      root.style.opacity = '0';
      setTimeout(teardown, fadeMs() + 40);
    });
  }

  /** First open: the title tap promotes the splash into the incoming Club
   *  Manager call — the ringtone loops from THIS gesture until Accept /
   *  Decline, and the existing accept()/decline() state machine takes over. */
  function beginCall() {
    state = 'ringing';
    titleShown = false;
    ring.start();                          // rings until accept()/decline() stop it
    // Reveal the call artwork under the title, then fade the title off it.
    callArt.style.display = '';
    callArt.style.transition = 'none';
    callArt.style.opacity = '1';
    titleArt.style.transition = `opacity ${fadeMs()}ms ease`;
    titleArt.style.opacity = '0';
    ui.style.display = '';
    ui.style.transition = `opacity ${fadeMs()}ms ease`;
    ui.style.opacity = '1';
    ui.removeAttribute('aria-hidden');
    armUnlock();
    // PRELOAD the voicemail while the phone rings (owner report 2026-08-14:
    // fetching it inside accept() raced the answer and opened with dead air).
    // Only the download starts here — play() stays inside the accept gesture,
    // which is what iOS autoplay policy requires.
    if (!audio) {
      try {
        audio = new Audio(AUDIO_SRC);
        audio.preload = 'auto';
        audio.load();
      } catch (_) { audio = null; }
    }
    // Focus ANSWER so a keyboard-only player can pick up immediately.
    try { answerBtn.focus({ preventScroll: true }); } catch (_) {}
  }

  // Dev-only replay: clears the completion flag and runs it again WITHOUT
  // touching game progress — nothing else in the save is read or written.
  // With the flag cleared the title tap will ring the call, like a first open.
  window.__replayOpeningCall = () => {
    markIntroDone(false);
    try { window.__phoneMenu?.close?.(); } catch (_) {}
    musicStarted = false;                // a replay gets its music cue back
    ring.stop();
    state = 'idle';
    startTitleSplash();
    return 'replaying opening call';
  };

  // ?intro=1 forces a first-open flow (owner 2026-08-29): the call is
  // once-per-device, so a device that ever completed it never rings again,
  // which read as "the audio doesn't play".  The param clears the flag so
  // the title tap rings the call like a first open.
  let force = false;
  try { force = new URLSearchParams(location.search).has('intro'); } catch (_) {}
  if (force) markIntroDone(false);
  // The title screen is the first thing on EVERY cold open (owner 2026-09-07)
  // — a fresh boot, a first-open call, or a boot with a live run saved.  There
  // is deliberately no resume bypass here: a resumable run is offered on the
  // title behind this splash (GameScene sets _titleResumeSnap), so it can no
  // longer start underneath the overlay.  Do not add an exception.
  startTitleSplash();
}
