# Road Trip Roulette — Working Notes for Claude

This file is a durable handoff between the owner, Codex, and Claude. Keep it beside `Road Trip Roulette Overview.md` and update it when a listed issue is investigated or fixed.

## Owner requirements

Treat these as product requirements, not suggestions.

## Memory audit implementation — 2026-09-09 (Claude, same day as the diagnosis below)

Owner approved working the list; status per finding (verify on a real iPhone per the
plan below before calling any of it closed):

- **Finding 1 (boot manifest) — PARTIALLY FIXED.** Off-ramp split implemented:
  `npc` + `npcBusinesses` + the 10 `shop_bg_*` storefronts (33 entries) moved out of
  boot into `REST_STOP_GROUPS` (`AssetManifest.bootManifest()` / `restStopManifest()`).
  BootScene loads the split manifest; RestStopScene.preload() loads whatever is
  missing behind the off-ramp fade (loading card + progress bar, first stop only);
  `_beginExitCommit` warms the HTTP cache during the exit cinematic.  Measured
  headless: post-boot **617 MB decoded / 314 textures** (was ~830 MB / 347).  The
  `biz_*` placards + sign pieces stay in boot — GameScene's roadside services signs
  compose from them.  STILL OVER the 250 MB budget: scenery (257 MB), cars (96 MB),
  buildings (93 MB) remain boot-loaded — the next split candidates.  The launch.test
  ratchet is lowered to 315 boot entries and asserts the split stays disjoint+complete.
- **Finding 2 (rotation resize storm) — FIXED.** One cancellable settle sequence
  (`scheduleOrientationSettle` in main.js): every trigger (resize, orientationchange,
  visualViewport, ResizeObserver) REPLACES the pending rAF+timer ladder instead of
  stacking another.  `applyOrientation` also skips the whole Phaser scale block when
  the rounded #game-root box is unchanged.
- **Finding 3 (duplicate refresh) — FIXED.** The explicit `game.scale.refresh()` after
  `setParentSize()` is removed (verified in Phaser 3.90 source: setParentSize returns
  refresh()).
- **Finding 4 (healthy-context GPU rebuild) — FIXED.** The >30s-hidden recovery now
  probes first: `gl.isTexture()` on up to 8 live texture wrappers; rebuild runs ONLY
  when a dead handle is found (Safari's silent eviction) — a healthy context does
  nothing, so no transient GPU duplication spike.
- **Finding 5 (police texture retention) — FIXED.** `_ensurePoliceAssets` now evicts an
  agency's textures once its last region band is >25 mi behind (margin over
  COMBO.REWIND_MILES=3) and no live cop wears it; WSP + the shared extras never evict.
  Safe: every cop frame resolves through `resolvePoliceSprite` with a live `has()`
  check, so stragglers fall back to generic art.  A re-entered region re-queues.
- **Tunnel facades — DOWNSCALED.** `tunnel_mt_baker_full` 5644×841 → 2400×357,
  `tunnel_mercer_full` 4080×807 → 2400×474 (≈23 MB decoded saved); baked aspects in
  TunnelFaceMesh updated; originals parked in `Archive/tunnel_fullres_2026-09-09/`.
- **Findings 6/7** — comic/PDF work was already done 2026-09-07; DOM-image accounting
  untouched this pass.

## iPhone restart / rotation memory audit — DIAGNOSED 2026-09-09, NOT FIXED

### Owner report and scope

- The locally hosted Road Trip Roulette build still restarts frequently on iPhone.
- A restart happens on roughly 50% of phone rotations.
- Loading/caching work was recently attempted, but the symptom remains.
- This pass was a **read-only diagnosis**. No code was changed and none of the items below should be marked fixed without implementation plus a real-device test.

### Bottom line

The strongest explanation is **iOS terminating and relaunching the WebKit page because of memory pressure**, not an intentional game restart, JavaScript exception, service-worker refresh, or Vite hot reload. The game already retains an extremely large decoded texture set. Rotation then causes a burst of Phaser scaling, canvas, layout, and WebGL work that can push the process over iOS's device-dependent memory limit.

Evidence against the other reset mechanisms:

- Vite HMR is explicitly disabled in `vite.config.js` (`server.hmr: false`), so a dropped/reconnected dev-server WebSocket should not force a page reload.
- No service worker, Workbox registration, Cache Storage handler, or other application reload mechanism was found.
- The only explicit page navigation in `src/main.js` is the deliberate `?wipe` recovery path.
- The global `error` and `unhandledrejection` handlers should display an on-screen crash overlay for ordinary JavaScript failures. An iOS WebContent memory termination kills the process without allowing those handlers to run, matching the unexplained full restart symptom.

### Finding 1 — the full asset manifest still loads at boot (critical)

`BootScene.preload()` calls `flattenManifest()` and queues essentially every entry:

```js
const manifest = flattenManifest();
for (const { key, path } of manifest) {
  if (key === loadingSplash?.key) continue;
  this.load.image(key, genreArtPath(key, _genre) ?? path);
}
```

Measured directly from the current files using each image's actual dimensions:

- 348 manifest entries.
- 345 present image files and 3 missing entries.
- Approximately **845.4 MiB decoded RGBA memory** before dynamic story/comic and jurisdiction-police art.
- The declared target in `src/systems/TextureBudget.js` is **250 MiB**, so boot alone is about **3.4× over the project's own mobile budget**.
- `public/assets` is approximately 1.2 GB on disk. Disk/network compression does not reduce decoded texture memory; a texture is approximately `width × height × 4` bytes after decode.

Measured manifest breakdown:

| Manifest group | Images | Approx. decoded memory |
|---|---:|---:|
| Biomes | 27 | 135.0 MiB |
| Cars | 72 | 117.8 MiB |
| Buildings | 70 | 92.8 MiB |
| Businesses | 27 | 92.0 MiB |
| UI | 37 | 79.3 MiB |
| NPCs | 12 | 72.0 MiB |
| Business NPCs | 11 | 66.0 MiB |
| Ground textures | 12 | 48.0 MiB |
| Tunnel faces | 3 | 36.2 MiB |
| North Bend scenery | 5 | 25.6 MiB |
| Rural scenery | 13 | 22.4 MiB |
| Other listed groups | 76 | about 63 MiB |

Largest individual decoded textures include:

- `tunnel_face_mt_baker`, 5644×841: approximately 18.1 MiB.
- `tunnel_face_mercer_lid`, 4080×807: approximately 12.6 MiB.
- Numerous 1672×941 screens/scenes: approximately 6.0 MiB each.
- Numerous 1086×1448 NPC images: approximately 6.0 MiB each.

Important distinction: `TextureBudget.js` currently **reports** the problem through `window.__texReport()` and `window.__texTop()`. Its own header says it never frees anything and never runs in the hot path. Adding that instrumentation did not reduce the 845.4 MiB boot set. Similarly, limiting the comic-art cache improves one later allocation source but does not alter the full Phaser manifest already held from boot.

### Finding 2 — one rotation produces a resize storm (critical)

The orientation system in `src/main.js` listens to four overlapping sources:

1. `window.resize`
2. `window.orientationchange`
3. `window.visualViewport.resize`
4. A `ResizeObserver` on `#game-root`

Every call to `onOrientationChange()` performs an animation-frame resize and schedules four more passes at 120, 300, 550, and 900 ms:

```js
requestAnimationFrame(applyOrientation);
for (const ms of [120, 300, 550, 900]) setTimeout(applyOrientation, ms);
```

iOS commonly emits several `resize` and `visualViewport.resize` events during one rotation. Each one creates a new four-timer ladder; the timers are neither coalesced nor cancelled. A single physical rotation can therefore invoke `applyOrientation()` dozens of times.

The comments call `applyOrientation()` "idempotent + cheap," but it is not cheap in its current form. Each pass reads layout, changes Phaser scale state, refreshes it, emits Phaser resize events, and can resize the actual game canvas when an intermediate aspect ratio produces a different `targetW`.

This explains why rotation is such a reliable trigger: it is not necessarily the root allocation, but it creates a concentrated burst of memory and GPU work while the process is already carrying the oversized texture set.

### Finding 3 — every apply pass refreshes Phaser twice (high)

At the end of `applyOrientation()`:

```js
game.scale.setParentSize(r.width, r.height);
game.scale.refresh();
```

Phaser's `ScaleManager.setParentSize()` already calls and returns `refresh()`. The following explicit `refresh()` performs the operation a second time and emits a second `Phaser.Scale.Events.RESIZE` event.

If `targetW` changed, `setGameSize()` also resizes `canvas.width`/`canvas.height` and performs its own refresh first. One `applyOrientation()` can therefore produce as many as three Phaser refresh/resize cycles. Multiplied by the uncancelled orientation timer ladders, this becomes a large amount of redundant work per phone rotation.

### Finding 4 — healthy-context GPU "recovery" can recreate the whole allocation (critical/high)

After the page has been hidden for at least 30 seconds, the `visibilitychange` handler in `src/main.js` walks every Phaser WebGL wrapper and calls `createResource()` even when:

- `renderer.gl` exists,
- `renderer.contextLost` is false, and
- the WebGL context reports itself healthy.

Phaser's wrapper `createResource()` calls `gl.createTexture()` / `gl.createBuffer()` and replaces the wrapper's reference. It does not first delete the old healthy resource. Phaser normally runs this sequence only after a genuine context restoration, where the old context's resources are already gone.

On a healthy context this manual recovery can temporarily duplicate a very large portion of the GPU allocation and re-upload all textures. Old handles may eventually be garbage-collected, but they are not synchronously deleted before the new allocation. With an approximately 845 MiB boot texture set, the transient peak alone can terminate WebKit. Returning from a background period and then rotating would make the restart appear rotation-related even when the recovery spike created the immediate memory danger.

### Finding 5 — jurisdiction police textures accumulate and are never evicted (high)

`GameScene._ensurePoliceAssets()` correctly streams jurisdiction art for the current and upcoming regions, but `_polWanted` is a lifetime ledger of every requested key. Loaded regions are never removed from Phaser's game-level TextureManager.

Current jurisdiction inventory:

- 9 agencies.
- 81 present texture files.
- Approximately **121.5 MiB decoded** if the player travels far enough to load every region.

These load on top of the approximately 845.4 MiB boot manifest. Comments in the code explicitly say eviction was deferred because pooled sprites and live effects may hold texture keys. That is a valid implementation concern, but it means the current streaming system limits network timing, not session-long texture retention.

### Finding 6 — story/comic/PDF work can add transient memory on top (medium)

The recent comic-reader cache work is directionally correct:

- Normal panel art uses a six-image LRU (roughly 36 MiB for 1672×941 panels).
- Closing/unmounting the reader calls `releaseComicArt()`.
- PDF export loads page art one page at a time and trims the art cache between pages.

However, none of this reduces Phaser's 845.4 MiB boot set. PDF export also keeps the generated JPEG byte array for every output page in `out` until `buildPdf()` packages the entire document, and then creates the final PDF bytes/blob as another allocation. This is a separate transient peak worth testing, though it does not explain ordinary rotation resets by itself.

### Finding 7 — browser image memory is additional to the Phaser report (medium)

`TextureBudget.textureReport()` walks only Phaser's TextureManager. It does not count:

- `<img>` elements used by the portrait phone menu and opening-call/title overlay.
- Dynamically created garage, genre, business, story, and comic images.
- Canvas backing stores and temporary render textures.
- JavaScript heap, audio buffers/elements, decoded music, Phaser objects, or WebGL driver overhead.
- Temporary duplicate resources during canvas resizing or GPU recovery.

Therefore 845.4 MiB is not a whole-process measurement; it is a large lower-bound estimate for the boot texture sources alone.

### Why the recent loading/caching work did not stop the resets

The recent changes addressed narrower retention paths, particularly comic art and region-timed police loading, and added useful measurement. They did **not** split the main manifest into boot/current-region/on-demand groups. `BootScene` still queues every manifest category. Browser HTTP caching prevents re-downloading files but does not solve decoded CPU/GPU memory retention; in fact, keeping decoded textures in Phaser is the dominant problem here.

### Recommended implementation order (nothing below is implemented yet)

1. **Split the boot manifest.** Load only title/menu plus the minimum assets needed for the active vehicle and first playable region. Load later biomes, businesses, NPCs, rest stops, and other region art on demand.
2. **Give streamed textures an ownership/eviction lifecycle.** Keep current region plus a small look-ahead/look-behind window; remove textures only after all sprites/effects that reference them are retired.
3. **Coalesce orientation work.** One cancellable settle sequence per physical rotation; new viewport events replace the pending sequence rather than adding another ladder.
4. **Remove the redundant scale refresh.** `setParentSize()` already refreshes. Also skip the entire scale operation when rounded parent dimensions and target game width have not changed.
5. **Do not recreate healthy WebGL resources.** Recovery should be driven by a genuine context-loss/restoration signal or a narrowly proven failed-resource condition. Never re-upload the whole texture inventory merely because 30 seconds elapsed while hidden.
6. **Set and enforce a real mobile texture budget.** Fail a development test/report when the boot set exceeds the agreed threshold; measure current-region and worst-case session peaks separately.
7. **Run the final verification on the oldest supported iPhone.** Desktop emulation cannot reproduce iOS WebContent termination thresholds or GPU behavior.

### Real-device verification plan

Record the iPhone model, iOS version, Safari versus Home Screen/Capacitor mode, and whether the phone is warm or other memory-heavy apps are open. For each build:

- Cold-launch and record the post-boot `__texReport()` value.
- Rotate portrait ↔ landscape at least 30 times without entering gameplay.
- Repeat 30 rotations during active gameplay in early, middle, and late regions.
- Background for less than 30 seconds, return, and rotate.
- Background for more than 30 seconds, return, and rotate; this specifically exercises the current GPU-recovery path.
- Drive far enough to stream all jurisdiction sets, record `__policeTexStats()`, then repeat rotation testing.
- Open/close the comic repeatedly and export a long volume separately from ordinary rotation testing.
- Note whether a JavaScript crash overlay appeared. A silent return to the opening title strongly supports WebKit process termination.

### Priority assessment

1. Whole-manifest boot loading — **critical and confirmed**.
2. Rotation event/timer multiplication plus duplicate Phaser refresh — **critical trigger and confirmed in code**.
3. Healthy-context full GPU resource recreation — **critical/high transient-risk path and confirmed in code**.
4. Jurisdiction texture lifetime retention — **high, confirmed in code and measured**.
5. Comic/PDF and DOM/canvas transient allocations — **secondary contributors; test independently**.

The first three together readily explain the owner's report that approximately half of rotations cause a full restart.

### Vertical opening title

- `public/assets/ui/title_screen_vertical.png` must be the first web content visible on every cold launch.
- On the first launch after a fresh installation, rotating the phone must **not** dismiss the title/onboarding.
- On later launches, rotating to landscape must dismiss the vertical title and proceed just as dismissing it normally would.
- The returning-launch decision must use only the durable first-launch completion flag (`introDone()` / `rtr_intro_call_done`). A live run, crash, build ID, deployment, or app update must not change this rule.

### Tutorial-button highlighting

- Each Tutorial button highlights only until that specific button has been touched once.
- After the first touch, its seen state must persist permanently across game closes, launches, Custom mode, and app updates.
- The phone-menu, title-menu, and gameplay Tutorial buttons currently have independent flags: `phone`, `game_menu`, and `gameplay`.
- Tutorial read history and Tutorial-button seen state are different pieces of state. Seeing previously read entries does not prove the button-seen flag was loaded correctly.

## Confirmed tutorial findings

### Fixed/changed in the current working tree

- The production-build timestamp reset for `tutorialBtnSeen` was removed.
- `tutorialRead`, `tutorialIntroSeen`, and `tutorialBtnSeen` were removed from `SANDBOX_KEYS`. They must remain durable `slot.global` UI state.

### Phone-menu startup race — FIXED 2026-09-07

Confirmed exactly as described. `window.__tut` is assigned in `main.js` during module execution; the `SaveSystem` only reaches the registry in `BootScene`, strictly later. Applied:

- `tutmTilePulse()` now waits on `B?.save?.()`, not merely the bridge, and re-polls every 300 ms while the answer is unknown.
- The bridge's `btnSeen` is tri-state: `true` / `false` / `null` when the save is absent. **`!null` is `true`**, so callers must never coerce it — that would light the button harder than the original bug. The pulse checks `seen == null` explicitly.
- Exposed as `window.__tutmTileSync`, re-run from `__phoneMenu.open()` and from `selectAndRefresh()` on slot switch (tutorial flags are per-slot).
- Regression tests added in `tests/launch.test.mjs` (95 checks).

Coverage limit worth knowing: the behavioural race tests drive a replica of the pulse logic, because that function is inline in an `index.html` script tag and cannot be imported. Source invariants are what actually pin the real code — reverting the fix fails 5 of them. The `SaveSystem` half of the suite is genuinely behavioural.

### Original description of the race

The phone Tutorial button differs from the two Phaser buttons. In `index.html`, `tutmTilePulse()` waits for `window.__tut`, but `window.__tut` can exist before Phaser has registered the real `SaveSystem`.

If that happens:

1. `window.__tut` exists.
2. `game.registry.get('save')` is still absent.
3. `btnSeen('phone')` is interpreted as false.
4. `tut-flash` is applied.
5. The one-shot startup function never corrects the class after the save becomes available.

Required correction:

```js
const tutmTilePulse = () => {
  const B = window.__tut;
  const save = B?.save?.();
  if (!B || !save) {
    setTimeout(tutmTilePulse, 300);
    return;
  }
  qhit('tutorial')?.classList.toggle('tut-flash', !B.btnSeen('phone'));
};
```

Unknown/uninitialized save state must never be treated as unseen. While state is unknown, keep the pulse off. Synchronize the class again whenever the phone menu opens or the active player slot changes.

Add a regression test in which `window.__tut` exists before the save registry, then the save appears with `tutorialBtnSeen.phone === true`. The final button state must not contain `tut-flash`.

## Audio stability audit

The audio fixes below must not change driving physics, scoring, difficulty, encounters, missions, controls, or progression. The intended user-visible changes are limited to stable music playback, correct resume behavior, and persistent audio preferences.

### 1. Recovery currently starts a different song — FIXED 2026-09-07

Confirmed: `_refreshStationPlayback()` picks a track with `Math.random()`, and `play()` calls it unconditionally. Three callers meant "unblock playback" — their own comments read *"resume after an autoplay block"* — so clearing an autoplay block re-rolled the song.

Added `AudioSystem.resumePlayback()`: resumes the context, the current element and the watchdog, restarts procedural scheduling, and **can never select a track**. It returns `true`/`false` so *selection stays with the caller* — the three sites now read `if (!a.resumePlayback?.()) a.play?.()`, preserving "start something if nothing was playing" without putting selection inside resume.

Call sites updated: `GameScene._kickRadio` (title/menu + gameplay recovery) and `OpeningCallSequence`.

Worth recording: **`_handleVisibilityChange` was already correct** — it explicitly never starts audio on a visibility event and only resumes the existing element. Background/foreground was not the offender; the autoplay-block recovery paths were.

Coverage is behavioural: the tests call the real `AudioSystem.prototype.resumePlayback` against a hand-built receiver, with `_refreshStationPlayback` stubbed to count calls. It must stay at zero across every state (normal, muted, paused, music-paused, scan-active, trackless, repeated). Making resume select a track fails 7 checks, 6 of them behavioural.

### 1b. Original description

`AudioSystem.play()` calls `_refreshStationPlayback()`, which randomly chooses and starts a song. Some recovery paths in `GameScene._kickRadio()` call `play()` as if it meant “resume.”

Required correction:

- Separate `resumePlayback()` from `startStation()`.
- `resumePlayback()` may resume the AudioContext, current HTMLAudioElement, and watchdog only.
- Lifecycle, foreground, orientation, and pause recovery must not select or replace a song.
- Only an explicit station/track choice, natural track completion, playlist advance, or deliberate initial start may replace the track.

### 2. Stale audio elements can advance the current song — FIXED 2026-09-07

Confirmed: both handlers were unguarded, so a late event from a replaced element advanced whatever song is current now. Applied the `advanceIfCurrent` guard (element identity + start generation) to `ended` and `error`, and carried the same guard into two paths the note didn't list:

- **Retry exhaustion** in `tryPlay` checked generation but not element identity — now checks both.
- **The construction-failure `catch`** called `_onTrackEnded()` with no guard at all, so a `MediaElementSource` throw could skip the track that had already superseded it. Now generation-guarded.

Covered by `tests/audio.test.mjs`. Source-pinned rather than behavioural: `_startTrack` needs a real `AudioContext` + `MediaElementSource`, so it cannot run headlessly.

### 2b. Original description

Every created audio element has unconditional `ended` and `error` handlers that call `_onTrackEnded()`. A delayed event from a replaced element can therefore replace the new current song.

Guard both handlers by element identity and generation:

```js
const advanceIfCurrent = () => {
  if (el !== this._trackEl) return;
  if (myGen !== this._startGen) return;
  this._onTrackEnded();
};
```

The retry-exhaustion path must use the same current-element/current-generation guard.

### 3. Gesture unlock creates excessive buffers

`_armCtxUnlock()` registers listeners on both `window` and `document` for several overlapping gesture events. Every callback creates a one-second silent buffer. One physical touch can invoke several callbacks and cause unnecessary allocation/garbage collection on iPhone.

Required correction:

- Use one capture target, preferably `document`.
- Run only while the AudioContext is not running.
- Debounce overlapping events from one physical gesture.
- Use a one-sample silent buffer rather than a one-second buffer.
- Disarm after the context reaches `running`; re-arm only after a real suspension that requires a gesture.

### 4. Station sanitizer rejects Metal — FIXED 2026-09-07

Confirmed, and the cause is recent: `finiteInt(src.radio, -1, -1, 9)` was correct while there were 10 stations (METAL sat at index 9). Adding POP took index 9 and pushed METAL to 10, so every saved METAL reloaded as POP. The literal was introduced-by-omission when the station was added — my change, not a pre-existing bug.

`AudioSystem` now exports `STATION_COUNT = STATIONS.length`, and the sanitizer bounds against `STATION_COUNT - 1`. No dependency cycle: neither module had any imports, and `AudioSystem`'s module scope is pure data (verified import-safe headlessly), so a separate catalogue module wasn't needed.

Fully behavioural coverage in `tests/audio.test.mjs`: every valid index round-trips through a real `SaveSystem`, out-of-range values still clamp, and unflagged stations still reset to `-1`. Reverting the literal fails 6 checks, 4 of them behavioural.

### 4b. Original description

There are 11 stations with indices 0–10, but `_sanitizeSettings()` clamps `settings.radio` to a maximum of 9. METAL (index 10) therefore reloads as index 9.

Required correction: validate against the actual station count rather than a stale literal. If importing the catalogue would create a dependency cycle, centralize the station count/IDs in a dependency-safe module.

### 5. Mute and volume do not persist consistently — FIXED 2026-09-07

Confirmed, and worse than described: `settings.muted` existed in the schema but `BootScene` never applied it, and **`volume` was not in the schema at all**. Two screens (Settings app, Music app) each had their own copy of the write logic, neither persisted, and the copies had already drifted — both fell back to `0.32` while the real runtime default was `0.50`.

Applied:

- `AudioSystem` exports `DEFAULT_VOLUME` as the single source of truth; the schema seeds from it and both bridges fall back to it.
- `settings.volume` added to the schema and preserved in `_sanitizeSettings`.
- Canonical `_audioPrefs.setMuted` / `setVolume` in `main.js`; all four writers route through them. Persistence lives there, **not** in `AudioSystem` — `SaveSystem` imports `AudioSystem`, so the reverse dependency would close an import cycle.
- `BootScene` now applies both. Note `toggleMute()` is a **toggle**: applying a saved preference by calling it unconditionally would *invert* it, so both `BootScene` and the canonical setter compare current state first. There is a test asserting that specifically.

**A real bug surfaced while writing the tests:** `JSON.stringify` serialises `NaN`/`Infinity` as `null`, and `Number(null)` is `0` — which *is* finite, so `finiteNum` happily accepted it. A corrupted volume would have persisted as `0` and booted the game silent, reading as "audio is broken". The sanitizer now requires an actual finite `number` type and otherwise keeps the default.

Fully behavioural coverage: real `SaveSystem` round-trips for both preferences, clamping, and the corrupt-value path. Dropping volume from the sanitizer fails 6 checks, all behavioural.

### 5b. Original description

The live Settings and Music bridges modify `AudioSystem`, but mute/volume are not consistently saved and restored. `settings.muted` exists but is not applied by `BootScene`; volume is not fully represented in the durable settings schema.

Required correction:

- Save `settings.muted` and `settings.volume` on every user change.
- Preserve both in `_sanitizeSettings()`.
- Apply both to the existing AudioSystem in `BootScene` without toggling accidentally.
- Route the Music screen and general Settings screen through the same canonical setters.

### 6. Partial initialization can leak resources

If `AudioSystem.init()` throws after creating an AudioContext but before `ready = true`, later calls can retry without closing the partial context or removing installed listeners.

Required correction: make initialization transactional or clean up every partially created context, node, timer, and listener in the catch path before allowing a retry.

### 7. Page lifecycle can permanently remove the watchdog

`lifecycleStop()` clears `_skipWatchdog`. Resuming an existing audio element does not always recreate it.

Required correction: canonical foreground/resume logic must re-arm the watchdog whenever a current track should be playing.

## Audio refactor constraints

- Keep one `AudioSystem` instance per page lifetime.
- Keep at most one current HTMLAudioElement.
- Every delayed callback must prove that its element and generation are current before mutating playback.
- Starting, replacing, pausing, resuming, and stopping are separate idempotent operations.
- Do not use a page reload or Phaser scene restart as an audio recovery mechanism.
- Do not restart a song merely because the phone rotated, the app returned to foreground, or the AudioContext was suspended.
- Missing/unplayable tracks should fail softly without a rapid retry loop.

## Verification checklist

Legend: `[x]` verified by automated test · `[~]` implemented, needs a real-device pass · `[ ]` not started.

- [x] Phone Tutorial button remains unlit after touch → close app → reopen. *(real SaveSystem round-trip)*
- [x] Phone Tutorial button remains unlit in and after Custom mode. *(sandbox round-trip; was the `SANDBOX_KEYS` bug)*
- [x] Phone Tutorial startup waits for the real SaveSystem. *(source-pinned; see coverage limit above)*
- [~] First-install rotation does not dismiss onboarding. *(gated on `introDone()`; source-pinned)*
- [~] Returning-launch rotation dismisses the vertical title. *(incl. already-landscape launch)*
- [~] Background/foreground resumes the same song at approximately the same position. *(resume can no longer select; position accuracy still needs a device pass)*
- [~] Portrait/landscape rotation does not choose another song. *(same fix; verify on device)*
- [x] A stale `ended` or `error` event cannot advance the current track. *(source-pinned + guard predicate)*
- [ ] Rapid track selections leave exactly one audible/current audio element.
- [x] Mute and volume survive a full app restart. *(real SaveSystem round-trips, incl. clamping + corrupt values)*
- [x] METAL remains selected after a full app restart. *(every station index round-trips)*
- [ ] Unlock listeners do not allocate buffers while the context is already running.
- [ ] Audio initialization failure leaves no leaked AudioContext or listeners.
- [ ] Existing automated test suite passes.
- [ ] Real-device iPhone test passes after repeated rotation, backgrounding, phone locking, and reopening.

## Test status

Current: **2,008 passing, 0 failing**, build clean. Added since this file was written: `tests/audio.test.mjs` (92 checks), wired into `npm test`.

Still true, and worth restating: nothing here simulates a real iOS `AudioContext`/`HTMLAudioElement` lifecycle. Audit items **3 and 6 are untouched**, **7 is partial**, and passing tests do not rule them out.

### What "covered" means per item

Two different strengths of test are in play, and they are not interchangeable:

- **Behavioural** — drives real objects (`SaveSystem` against a `localStorage` shim). Catches real bugs. This is what caught the `SANDBOX_KEYS` and station-clamp regressions when deliberately reverted.
- **Source-pinned** — asserts the guard exists in the code. Catches deletion of a fix, not misbehaviour. Used only where the code cannot run headlessly (`_startTrack` needs a live `AudioContext`; `tutmTilePulse` is inline in `index.html`).

Every fix above was verified by reverting it and confirming the suite fails, then restoring. That check is cheap and worth repeating for the remaining items.

## Remaining work, in suggested order

1. **Audit #7 — watchdog re-arm** after `lifecycleStop()`. Partly done: `resumePlayback()` re-arms it whenever it resumes a real track. What remains is `_handleVisibilityChange`'s `_bgContinuing` branch, which resumes the element directly without calling `_startSkipWatchdog` — so an opt-in background track can return to the foreground with no stall protection. Small and self-contained.
2. **Audit #3 — gesture-unlock buffers.** One capture target, one-sample buffer, disarm once running, re-arm only after a real suspension. Contained, but hard to cover headlessly — likely source-pinned plus a device pass.
3. **Audit #6 — transactional `init()`.** Cleanup-on-throw for every partially created context, node, timer and listener. Lowest user-visible impact.

None of the three is blocking; the two the player would actually notice (recovery restarting songs, preferences resetting) are done.

Blocked, unrelated to audio: native launch-screen art needs an `ios/` project (none exists), and `capacitor.config.json` still carries DUI's `appId`/`appName` — that must change before any RTR iOS build.

## Chapter 18 story-art mapping audit

Chapter 18 names `public/assets/storylines/STORY_ART_INTEGRATION.md` as the authoritative mapping contract and `STORY_ART_CHECKLIST.md` as the physical-art status list. `src/data/comicPanels.js` currently has 60 mappings, and all 60 referenced files exist. However, most cannot currently be selected by the game.

Audit result:

- 60 total `PANEL_META` mappings.
- Only 11 are node-level keys directly reachable through the current recorder.
- 17 are valid choice-level keys but are unreachable because choice commits do not store a choice-level `panelKey`.
- 32 are transitions, reactions, evaluated outcomes, or special beats requiring explicit emission or panel-key selection; most of those emission paths are absent.

### Mapping contract — IMPLEMENTED 2026-09-07

`resolvePanelKey()` in `comicPanels.js` implements the five-step order. Steps 1 and 3 (explicit `choice.panelKey` / `node.panelKey`) are **terminal**: an authored key whose art is missing yields a placeholder, never a fall-through to a different picture. Step 5 returns `null`.

- `commitChoice()` resolves once and **persists** `panelKey` on the ledger entry, same discipline as `dialogueKeys`.
- `ComicSystem.record()` runs the same resolver for legacy events lacking a key.
- Mercer bridged with `choice.panelKey: 'country.mercer_fork.ride'` on the Hip-Hop `ride` choice. Ledger identity stays `hiphop`.
- `StoryTile` shows the **establishing** node panel while choosing, then `setPanelKey()` swaps to the committed panel before the tile enters the comic.

**Reachability: 11 → 29 of 60 keys**, 17 choice-level panels now reachable.

Two findings the audit didn't have:

1. **The Mercer symptom was not a mapping fault.** `hiphop.mercer_fork` was already mapped to the right file, and that file is correct (Brittney in the Gas-N-Sip uniform). `StoryTile` simply never read `meta.art` — it drew a rest-stop **NPC portrait** as stand-in, which is where the unrelated character came from. That import is now gone entirely, so no portrait can stand in for story art again.
2. **A coordinate-space mismatch.** `PANEL_META` rects are authored against the **16:9** panel, but the live tile is **20:9**, and the old code mapped them onto the whole tile (`b.x * TILE_W`). Balloons were structurally misplaced even with correct art, and cover-fitting would crop ~16% vertically — enough to push `mercer_fork`'s `y: 0.05` balloon off the top. The art is now **contain-fitted** into a centred 16:9 box and every authored coordinate maps to *that* box, so measured anchors land exactly. Side bars show the panel gradient. If a full-bleed tile is preferred, that is an owner call and needs the anchors re-measured for 20:9.

One deliberate refinement to the spec: `resolvePanelKey()` returns `null` per step 5, but the **persistence** layer stores `?? panelKeyFor(storyId, nodeId)` as a stable identifier. An unmapped key still resolves to no art (placeholder), and recording it means art authored at that node key later is picked up by books already on disk. Without it, existing comic events lose their key entirely.

### Root defect (as originally described)

`StorySystem.commitChoice()` does not put a `panelKey` on its ledger entry. `ComicSystem.record()` consequently falls back to `${storyId}.${nodeId}`. It ignores `${storyId}.${nodeId}.${choiceId}` even when an approved mapping exists. The live `StoryTile` also starts from node-only artwork and does not switch to the chosen response image before sliding into the comic.

Currently unreachable normal-choice mappings include:

```text
hiphop.seattle_offer.carry
hiphop.seattle_offer.pass
hiphop.mercer_fork.keepJob
hiphop.bellevue_founder.sell
hiphop.bellevue_founder.refuse
hiphop.issaquah_kyle.handOver
hiphop.northbend_dom.promise
hiphop.northbend_dom.delay
hiphop.northbend_dom.bagman
classicRock.vantage_diner.east
classicRock.othello_cover.pay
classicRock.othello_show.hearBoth
classicRock.othello_show.payingOnly
classicRock.othello_show.reject
classicRock.hatton_nan.take
classicRock.hatton_nan.refuse
classicRock.hatton_nan.demand
```

### Cross-story Mercer mismatch

The Country route begins from Hip-Hop node `hiphop.mercer_fork`, choice `ride`, so the committed event naturally has the key `hiphop.mercer_fork.ride`. The approved art is mapped as `country.mercer_fork.ride`. That image needs an explicit authored override such as `choice.panelKey: 'country.mercer_fork.ride'`. Do not change ledger story identity merely to locate artwork.

### Required mapping contract

Support optional `node.panelKey` and `choice.panelKey`. Resolve committed-choice art in this order:

1. Explicit `choice.panelKey`.
2. Existing `${storyId}.${nodeId}.${choiceId}` mapping.
3. Explicit `node.panelKey`.
4. Existing `${storyId}.${nodeId}` mapping.
5. Placeholder.

Persist the resolved stable key in the ledger entry. Apply the same deterministic resolver to old events that lack `panelKey`. The live tile must show node/establishing art before selection and then switch to the chosen reaction/response art before it enters the comic.

### Special beats

Mappings such as `.intro`, `.arrival`, `.performance`, `.pressing`, `.loaded`, `.locked_phone`, `.side_ram`, `.boxed_in`, evaluated Cle Elum outcomes, `hatton_nan.herCall.stay/leave`, and the Pullman kiss are separate authored beats. They require explicit, idempotent `recordBeat()` calls or an explicitly resolved choice `panelKey` at the correct narrative moment. Merely placing them in `PANEL_META` does not make them reachable.

### Missing art policy

The visible checklist still reports missing main-story art, particularly most of Country and later Classic Rock branches. Never substitute a reference sheet, rejected-costume panel, or semantically nearby image to eliminate a placeholder. A correct placeholder is preferable to the wrong story image.

### Required tests

Covered by `tests/storyart.test.mjs` (42 checks), wired into `npm test`.

- [x] Every consequential choice resolves to its approved choice image when one exists. *(sweep over real story data; 17 found, 0 wrong)*
- [x] The Mercer `ride` choice resolves to `country.mercer_fork.ride`. *(resolver + a real `commitChoice`, incl. save round-trip)*
- [x] Live tile uses establishing art before selection and response art afterward.
- [ ] Every special mapped beat has a reachable, idempotent emission site. **← main remaining work**
- [ ] Outcome-specific images select the evaluated outcome. *(blocked on the same emission sites)*
- [x] Every mapped path exists on disk. *(all 60)*
- [x] No `UNWIRED / REJECTED` image or reference sheet is mapped as production art.
- [~] Every `PANEL_META` key is tested as reachable or explicitly labeled future/unwired. *(29/60 reachable and asserted; the other 31 are the special beats below and are not yet labelled)*
- [x] Missing approved art renders a placeholder instead of an incorrect substitute.

Note on the UNWIRED check: status is authored in `STORY_ART_CHECKLIST.md`, **not** in filenames. A first attempt that pattern-matched filenames flagged three legitimate panels (`bellevue_03_reject_bribe`, `othello_08_rejects_propositions…`, `hatton_07_reject_nan_sploosh`) — the player *rejecting* something is story content. The test now parses the checklist, which is the authority, and finds 14 files marked UNWIRED/REJECTED, none of them mapped.

### Tile pacing — player-driven 2026-09-07

A conversation tile used to hand off on a fixed timer (1700 ms with a reply, 900 ms without), which cut long replies off mid-read and rushed short ones. The tile now HOLDS until the player taps, with a pulsing `TAP TO CONTINUE` prompt.

- `awaitTapThen(fn)` gates both branches — advancing to the next node *and* closing the conversation — so the final tile persists too.
- **A drag is not a tap.** The strip is scrubbable back through earlier tiles (18.3 step 7), so a pointer that moved >12 px is ignored; browsing never advances the story.
- The gate needs a matching `pointerdown` first, so a stray release can't trigger it, and it is one-shot with its listeners detached on cleanup.
- Two timers remain and both are deliberate: 650 ms for the reply to land, and a short arm delay so the prompt doesn't appear over the arriving reply and the choice tap can't carry through and skip the beat it just created.

### Remaining: special-beat emission

The 31 unreachable keys are `.intro`, `.arrival`, `.performance`, `.pressing`, `.loaded`, `.locked_phone`, `.side_ram`, `.boxed_in`, the evaluated Cle Elum outcomes, `hatton_nan.herCall.stay/leave`, and the Pullman kiss. These need explicit idempotent `recordBeat()` calls at the right narrative moments — the resolver cannot reach them because nothing emits them. That is authored-emission work, not a mapping change, and is the next piece.

---

## Game restart / iPhone memory audit (2026-09-07)

### Conclusion

The audio fixes were valid, but they do not address the dominant restart risk. `BootScene.preload()` currently calls `flattenManifest()` and queues **the entire image manifest** on every launch. Local measurement found 347 manifest entries (344 image files), about **244 MB compressed on disk** and approximately **830 MB after image decoding** (`width × height × 4`). That estimate excludes Phaser/canvas objects, framebuffers, browser overhead, audio, dynamically loaded images, and possible CPU/GPU duplication. An iPhone WebView can therefore be terminated by the operating system and relaunched without producing a normal JavaScript crash.

This fits the reported symptom: the game appears to restart frequently, while ordinary error handlers do not identify a cause. An OS memory termination cannot run the existing `window.error`/`unhandledrejection` crash overlay.

### Direct evidence in current code

- `src/scenes/BootScene.js`: `preload()` gets `flattenManifest()` and calls `this.load.image(...)` for every entry.
- Several normal 1672×941 backgrounds decode to roughly 6 MB each even if their PNG/WebP file is much smaller.
- The largest individual manifest images decode to roughly 12–18 MB.
- The 60 mapped Chapter 18 story images alone are about 131 MB compressed and roughly **360 MB decoded**.
- `src/ui/ComicReader.js`: module-level `artCache` retains loaded `HTMLImageElement`s. `preloadArt(pages)` loads all artwork for all selected comic pages at once, creating a second major memory spike during reading/export.

### Required fix — this should not alter gameplay

1. Make the boot manifest small: title/loading art and only assets needed for the immediately entered scene.
2. Load biome, rest-stop, vehicle, culture/genre, ending, and story assets on demand. Keep an explicit small shared set for genuinely global UI.
3. Unload scene/biome-specific Phaser textures when their owning scene or route segment is finished. Use ownership/reference tracking or a bounded LRU cache so an asset still in use is never removed.
4. Downscale source images to their real maximum display size (allowing an intentional 2× mobile density where warranted). File compression alone is not a memory fix; decoded dimensions determine most texture memory.
5. Change `ComicReader` to retain only the visible page plus a small neighbor window. Clear image references when the reader closes. For PDF export, render pages sequentially and release each page's art instead of preloading the entire volume.
6. Keep launch/title/tutorial/save behavior unchanged while doing this work. This is asset lifecycle work, not a game-state rewrite.

A conservative first mobile budget is **under 150–250 MB of estimated decoded textures at any one time**, followed by testing on the oldest supported iPhone. Do not treat this range as an Apple hard limit; actual termination thresholds vary by device and system pressure.

### Instrumentation needed to prove the fix

- In development, report Phaser texture count and estimated decoded bytes by image dimensions after Boot, Game, Rest Stop, phone menu, comic reader, and PDF export.
- Log `webglcontextlost` and `webglcontextrestored`.
- Persist a lightweight session heartbeat plus orderly shutdown/background markers. On the next launch, distinguish a caught JS failure from an unexplained terminated session. Treat that only as evidence of a likely OS/process termination, not absolute proof.
- Add a test/assertion that the Boot preload allowlist stays bounded; a test that merely confirms every manifest file loads would preserve the bug.
- Repeat launch → drive → rest stop → comic → background/foreground loops on a real iPhone while watching the counters.

### Independently verified 2026-09-07 — audit confirmed

Re-measured from `flattenManifest()` with real image dimensions. The audit's numbers are exact:

| | audit | measured |
|---|---|---|
| manifest entries | 347 | **347** |
| image files | 344 | **344** (3 missing) |
| compressed | ~244 MB | **244.1 MB** |
| decoded (w×h×4) | ~830 MB | **830.2 MB** |

Decoded by folder — where the reduction has to come from:

| decoded | files | folder | deferrable to the off-ramp? |
|---|---|---|---|
| 256.7 MB | 50 | `scenery` | partly — biome/route-segment specific |
| 138.0 MB | 23 | `npc` | **yes — rest-stop only** |
| 96.4 MB | 64 | `cars` | partly — genre/owned vehicles |
| 92.8 MB | 70 | `buildings` | partly |
| 92.0 MB | 27 | `businesses` | **yes — rest-stop only** |
| 81.7 MB | 46 | `ui` | mostly global, keep |

Two corrections to the picture:

1. **Story art is not in that 830 MB.** No `storylines/` folder appears in the manifest — the Ch.18 panels load separately, so their ~360 MB decoded is *additional*. Peak exposure is nearer 1.2 GB, not 830 MB.
2. **Two of the largest single items are tunnel facades**, not story art: `tunnel_mt_baker_full.png` is 5644×841 → **18.1 MB decoded** from a 7.2 MB file, and `tunnel_mercer_full.png` is 4080×807 → 12.6 MB. Those two alone are 30.7 MB and are prime downscale candidates (audit item 4).

### Off-ramp loading boundary (owner idea, 2026-09-07)

The owner's suggestion — show the horizontal loading screen when the player takes a freeway exit — is the right seam, and the machinery already exists:

- `GameScene.js` fades out for 380 ms and only starts `RestStop` on `camerafadeoutcomplete`. A real boundary already sits there.
- `ui_loading_screen` is already a manifest asset, and `BootScene` already has `_mountLoadingBackdrop()` + `_buildProgressBar()` to render it.

So rest-stop-only assets (`npc` 138 MB + `businesses` 92 MB + the run's story panels) can move behind that fade with no pop-in and no gameplay change. That is ~230 MB off boot before touching scenery or downscaling.

### Done so far

- **Instrumentation** (`src/systems/TextureBudget.js`): `decodedBytes()`, `textureReport()`, `logTextureReport()`, and `installTextureProbe()` → `window.__texReport()` / `window.__texTop(n)`. `BootScene` installs it and logs the post-boot total, so every claim about the reduction is measured.
- **Ratchet test** (`tests/launch.test.mjs`): boot manifest entry count cannot grow past 347, story art must never enter the boot manifest, and the probe must stay wired. Deliberately a ratchet, not the final bound — lower the ceiling as assets move behind the off-ramp. A test that merely confirmed every manifest file loads would have preserved the bug.
- **Fixed a retention path I introduced.** The new `StoryTile` on-demand panel loading never released its textures — ~6.0 MB decoded each, accumulating every stop. Now tracked in `loadedArtKeys` and removed after teardown. `ComicReader` keeps its own `HTMLImageElement` cache, so the book is unaffected.

### Comic memory — item 5 DONE 2026-09-07

The persistence half was **already correct** and needed no change: `ComicSystem.record()` saves only a compact event (ids, `panelKey`, dialogue keys + fallback copy, mile, cash). No image or screenshot is stored, and the reader rebuilds each page from `panelKey` → installed file. Snapshotting panels would have duplicated artwork and complicated save migration for no gain.

What leaked was the **decoded** side, all in `ComicReader`:

- `artCache` was an unbounded module-level `Map`. Now a **bounded LRU** (`ART_CACHE_MAX = 6`, ≈36 MB at 1672×941), evicting by clearing `img.src` so the bitmap can be collected.
- Every page called `draw()` on open, so opening a volume decoded its whole art set. Now **windowed** via `IntersectionObserver` with a one-page `rootMargin` — current page ± 1. Canvases are pre-sized, so layout doesn't reflow.
- Switching volumes and closing the reader now call `releaseComicArt()`. Wired through `window.__comic.unmount()` from the generic phone-app close handler.
- **PDF export** was the single largest spike: `preloadArt(pages)` decoded the entire volume before rendering anything. Now `loadPageArt()` per page, render, `artTrim(1)`, then `artTrim(0)` at the end.

Only decoded bitmaps are dropped. The comic history, the saved events and the installed image files are all untouched.

### Not started

Manifest split (items 1–3) and downscaling (item 4). Item 4's clearest targets are the two tunnel facades (30.7 MB decoded between them).

Also still open from the comic work: **exit-time preload of the small set of likely upcoming panels**, which pairs directly with the off-ramp boundary above — load the candidate panels for the stop being entered, then release the unchosen alternatives once the choice commits. `StoryTile` already loads on demand and releases at `finish()`, so this is a prefetch-during-fade optimisation, not a correctness gap.

### Important instruction to Claude

Do not keep tuning music in hopes of fixing this restart symptom until the boot texture load is reduced and measured. Also do not solve it by raising the loader timeout: the problem is the quantity and decoded size of retained assets, not simply load duration.

---

## Comic reconciliation pass — 2026-09-09 (Claude, after the owner's Q&A on these notes)

Owner decisions taken in the same sitting: **these notes win everywhere** over the V2
artifact page (the page is now stamped as a discussion aid and its lettering table was
corrected to match); implementation order = **fix the four diagnosed reader findings first,
then produce the six-category panel review list** before any metadata is baked; dialogue
font = **show Patrick Hand and Kalam side by side at phone size first** (done on the V2
page, decision pending); the Classic Rock passenger is **Mykenzie** (renamed from
"Mykenzee" in code/data/checklists; the "McKenna" spelling in these notes was a drift).

Findings under "Image loading and existing-comic correctness" — all four CONFIRMED in code
and fixed (see `git log` 2026-09-09):

1. **Observer root** — `ComicReader` observed pages against `.cr-body` (non-scrolling); now
   `el.closest('.pa-body')` (the real scroller), viewport fallback.  Only current ±1 pages draw.
2. **StoryTile loader race** — `drawArt()` now takes a per-call request token; a shared-loader
   `complete` whose token is stale is ignored, so establishing art can no longer overwrite
   the chosen-response art after `setPanelKey()`.
3. **Saved-key migration** — `ComicSystem.resolveEvent()` upgrades ONLY the generic
   `story.node` default to `story.node.choice` when choice-level art is mapped (render-time,
   deterministic, save untouched).  An explicit non-default stored key is never replaced.
4. **Lettering** — `drawBalloon` no longer shrinks type; size = 3.2% of panel width
   (9–15 px), **25-word cap** with sentence-end split into a linked balloon, box may grow
   (×1.6 / ×2.6 linked); elision last resort.  The live tile still uses the older
   `balloon()` path and inherits the notes' rules in the strip rebuild (steps 4–6).

Not started from this section: inclusion flag / storyRole / transition roles, the live
fixed-height strip, timing state machine, translucent tray, page composition from ordered
panels, relationship montage, hold-to-zoom.  Next deliverable = the six-category review list.

## Comic system — OWNER-APPROVED DIRECTION 2026-09-09 (design specification; not yet an implementation claim)

This section supersedes older comic-layout and tile-pacing proposals wherever they conflict. In particular, the older `Tile pacing — player-driven 2026-09-07` note describes the current/previous tap-gated behavior, **not** the approved target below. Do not mark any item in this section done merely because a prototype page demonstrates it. Verify the actual game code and behavior independently.

### Product concept: one panel language, two placements

There are two presentations of the same story panels:

1. **Live conversation strip during gameplay** — a horizontal, left-to-right miniature Sunday-comic strip in which dialogue is revealed as the conversation happens.
2. **Finished comic book in the phone menu** — the saved, edited account of the run, arranged into rows and pages.

These are not two unrelated layout systems. They must share:

- The same source artwork.
- The same narrative panel order.
- The same authored panel aspect ratio.
- The same face/focus/protect metadata.
- The same speaker, mouth-anchor, balloon-tone, caption, and sound-effect metadata.
- The same dialogue and chosen player response.
- The same border and visual vocabulary unless a presentation-specific override is necessary.

They differ primarily in **placement**. The live version places panels in one horizontally scrollable strip. The finished book composes those same panels, in the same order and at the same ratios, into rows and pages. Do not generate a screenshot of the live UI and use it as the comic page; persist compact event/metadata records and render each presentation from those records.

### Core geometry of the live strip

- Every live tile has the same displayed height.
- Tile width varies according to the panel's authored aspect ratio.
- Preserve the aspect ratio that panel will occupy in the finished comic.
- A wide or exceptionally important panel may occupy approximately one entire iPhone viewport width.
- Two ordinary panels may be visible within one screen.
- Three narrow/vertical panels may be visible within one screen.
- Panels must visually touch the same continuous strip through consistent gutters and baseline alignment; they must not look like disconnected UI cards.
- The active strip reads left to right. Completed panels remain to the left and can be manually revisited.
- Manual horizontal scrolling must never commit a response or accidentally advance the story.
- A drag and a tap are different gestures. Use a movement threshold rather than treating every pointer release as a tap.
- When advancing automatically, slide only far enough to compose the next active panel sensibly; do not blindly center every tile if doing so destroys the one-, two-, or three-panel rhythm.

The goal is for gameplay to feel like the comic is being authored in front of the player. Panels that will enter the finished book should be introduced in their eventual narrative order and intended aspect ratios from the beginning.

### Live dialogue and advancement sequence

The tile must **not move while the game is waiting for the player to select a response**. The player must be allowed to read the prompt and their possible answers without time pressure.

Approved sequence:

1. The current illustrated tile enters the strip.
2. Any opening NPC dialogue is revealed in the tile.
3. The response-choice tray appears over the lower portion of the artwork.
4. The strip remains stationary until the player chooses.
5. The selected response becomes the player's balloon inside the current tile.
6. The unselected responses disappear and the response tray retracts/fades so the completed artwork can be seen.
7. If the player's balloon is the last dialogue assigned to that tile, hold the completed tile for **3 seconds**.
8. If one or more NPC responses follow the player's answer in the same tile, reveal them in authored order. After the final NPC response appears, hold the completed tile for **6 seconds**, extended for long final responses as described below.
9. A deliberate tap during a completed-tile hold skips the remaining pause and advances.
10. At the end of the hold, slide the strip left and activate the next tile.
11. The player may scroll backward at any time to review completed panels.

Timing begins only after the newly added balloon has finished appearing. The response-choice tap that created the player balloon must not carry through and skip its reading pause.

#### Reading-time rule

- Final player response with no subsequent line in the tile: **3,000 ms**.
- Final NPC response after the player's response: **6,000 ms**.
- If the final newly revealed response exceeds 10 words, add **175 ms per word beyond 10**.
- Cap the automatic reading hold at **9,000 ms** unless a specifically authored dramatic pause overrides it.
- A deliberate tap advances immediately.
- Beginning a horizontal review drag pauses/cancels automatic advancement until the active panel is restored.
- Accessibility/reduced-motion behavior must not make the story unreadable. VoiceOver or an equivalent accessibility mode should disable automatic advancement and provide an explicit continue action.

Examples:

- An 8-word final player response with no NPC follow-up: 3.0 seconds.
- A 9-word final NPC follow-up: 6.0 seconds.
- A 20-word final NPC follow-up: 7.75 seconds.
- Anything long enough to exceed the cap: 9.0 seconds unless author-overridden.

### Response choices: translucent verbal-response tray

The artwork should use the entire available screen height, top to bottom. Do not reserve a permanent opaque UI band beneath it. Response choices appear in a **translucent tray over the lower portion of the artwork**.

Target behavior and styling:

- Dark smoked-glass background at approximately **75–85% effective opacity**.
- A restrained background blur where supported; provide a performant non-blur fallback for older iPhones.
- The tray should normally occupy no more than the lower **30–35%** of the viewport and should shrink when fewer choices are present.
- Respect the iPhone safe-area inset at the bottom.
- Choice labels remain real readable controls with sufficiently large touch targets; the comic styling must not reduce usability.
- Use the comic dialogue typeface, sentence case, dark ink text, warm off-white/cream choice surfaces, and subtly hand-inked borders.
- The controls should feel like potential spoken sentences, but should not masquerade as balloons already spoken by the character.
- A small quotation or tail motif may reinforce that these are verbal responses.
- When chosen, the selected sentence should visually transition or “lift” from its choice control into the player's balloon.
- Unselected choices fade promptly.
- The tray then retracts/fades for the reading hold, exposing the complete panel.

The lower tray region is a **temporary obstruction**, not a permanent crop. Panel composition metadata must therefore protect faces, mouths, hands, phones, vehicles, impact areas, clues, and other story-critical objects from being placed exclusively behind it. Prefer crops/compositions that keep essential content above or beside the tray while choices are visible.

Do not rely on blur alone for contrast. The tray/control text needs explicit foreground/background contrast, and very bright or busy art must receive additional scrim strength.

### Dialogue capacity and conversational rhythm

- **Absolute target maximum: 20–25 words per balloon. Never use 28 as the standard.**
- Most balloons should contain approximately **5–10 words**.
- Do not shrink lettering to force an overlong line into a balloon. Edit, split, or move dialogue to another balloon/tile.
- A tile may contain a short exchange of approximately **4–5 balloons** if the artwork and reading order support it.
- Multi-balloon exchanges should leapfrog down the panel: left, right, left, right, with each later utterance clearly lower than the previous one.
- Keep approximately **6–10 design units** of vertical separation between successive balloon anchors (see scalable geometry below).
- Tails must not cross each other, faces, text, or earlier balloons.
- If five balloons cannot fit without obscuring the story image or becoming ambiguous, split the exchange across consecutive panels. Panel clarity outranks a desire to keep a whole conversation in one image.
- Dialogue is only required to be comfortably readable at gameplay size. The finished phone-menu comic may display smaller type because it will support hold-to-zoom, but it must remain recognizable enough at rest to invite reading.

### Narrative editorial rule: what belongs in the permanent comic

Do **not** equate `choice.consequential` with “deserves a permanent comic panel.” Consequential is a gameplay/state concept. Comic inclusion is a narrative/editorial decision and needs its own field or derived classification, such as `comic: true/false`, `storyRole`, and `priority`.

A moment belongs in the finished comic when it does one or more of the following:

- Changes the direction or stakes of the trip.
- Records a meaningful player decision and its consequence.
- Reveals character rather than merely maintaining a meter.
- Changes trust, affection, suspicion, rivalry, loyalty, or power in a meaningful relationship.
- Introduces, escalates, or resolves danger.
- Establishes or changes passenger, cargo, vehicle, route, performance, ownership, or partnership status.
- Sets up something that is paid off later.
- Pays off an earlier decision, joke, threat, promise, or relationship beat.
- Marks a major set piece, reveal, reversal, climax, or ending.
- Supplies a purposeful absurd cutaway or reaction that improves comic timing.

Routine hunger, thirst, bathroom, flirt, reassurance, or meter-maintenance exchanges should usually **not** receive standalone permanent panels merely because they changed a stat. They may still appear in the live conversation strip to keep the player active and the relationship alive.

### Relationship strips apply to all important recurring characters

The condensed relationship device is not exclusive to Brittney. It should cover nearly all major storyline NPCs whose relationship with the player develops.

Known priorities:

- **Brittney** — long-duration passenger relationship; may recur at meaningful phase changes.
- **Mykenzie** — long-duration passenger relationship; may recur at meaningful phase changes.
- **Malik** — recurring relationship with developing trust/obligation/loyalty.
- **Dominique** — recurring relationship with developing trust/attitude/loyalty.
- Audit the complete story roster for other recurring characters whose later behavior, help, opposition, affection, or ending changes because of accumulated interaction. Do not invent importance from mere screen time; verify actual story recurrence and consequences.

There are two useful forms:

1. **Passenger relationship strip** — may recur when a long car relationship changes phase.
2. **Recurring-NPC relationship strip** — appears at a meaningful turning point or payoff, not after every encounter.

Condense ordinary relationship maintenance into a short montage strip rather than giving every exchange a full panel. An approved caption model is:

> …HOW DID THEY HANDLE THE LONG CAR RIDE?

The exact content of the montage should be derived from the player's actual saved interactions and relationship result. It can read as broadly good, mixed, deteriorating, awkward, affectionate, or hostile. Do not fabricate a happy montage when the player's choices produced the opposite. Similar character-specific captions may be authored for non-passenger relationships.

### Tone and story progression

Target tone is an **adult animated-sitcom road comedy** with grounded character relationships and strategically absurd cutaways. This is a tonal target, not an instruction to imitate any living creator's exact style.

- Approximately **75% grounded character story**: cause and effect, decisions, travel complications, danger, relationship changes, reactions, and payoffs.
- Up to **25% absurd cutaway/reaction material**: exaggerated interpretations, fantasy inserts, flashbacks, visual non sequiturs, or side-story beats.
- A cutaway must launch from a specific line, thought, fear, boast, misunderstanding, or object in the grounded scene.
- Most cutaways should last **1–3 panels**.
- Return to the exact conversational beat or visual setup that launched the cutaway.
- Do not use cutaways merely to reach a percentage. They must sharpen a joke, reveal character, foreshadow a consequence, or create a later payoff.
- Avoid allowing cutaways to crowd out decisions or consequences. The player should still be able to reconstruct why the trip ended as it did.

### Finished comic pages and chapter rhythm

- Pages normally contain **3–5 panels**.
- Six-panel pages are allowed for deliberately quick dialogue, montage, or escalating action, but should be exceptional.
- A major beat normally receives the largest panel on the page; it is not automatically isolated.
- Use approximately **6–12 pages per chapter** as a flexible editorial range, based on actual story density rather than padding.
- Chapter transitions should use a location/time/mile caption, a visual travel bridge, a changed passenger/vehicle state, or a purposeful page turn.
- Do not repeat the same page template mechanically. Layout must express dramatic function: establishment, setup, decision, consequence, chase, cutaway, emotional beat, or ending.
- Normal gutters remain consistent enough to unify the book. Narrow gutters can accelerate an ambush/chase sequence; wider gutters can create a pause or location transition.

#### Full-page treatment — maximum 1–2 per entire comic

There should be **only one or two full-page moments in the entire completed comic**, not one or two per chapter.

There are currently no dedicated portrait/full-page illustrations. Do not enlarge or crop a landscape source into a compromised portrait image merely to satisfy a “splash page” template. “Full-page moment” may instead be constructed from existing art as:

- A wide cinematic hero panel dominating the page with smaller reaction/caption panels beneath it.
- A landscape image spanning the page width with a deliberate, non-destructive crop.
- A composite page using the main landscape image plus one or two face-safe insets.

On a horizontally held iPhone, do not shrink an entire portrait page until the important art and dialogue become tiny. The menu reader may present the dominant wide panel directly, then allow vertical movement to the subordinate panels. Full-page treatment describes narrative emphasis, not a requirement to produce a portrait bitmap.

### Page/panel transitions

Author a transition role rather than choosing layouts randomly:

- `establish` — location, time, vehicle, passengers, and immediate situation.
- `setup` — creates an expectation, problem, promise, or joke premise.
- `decision` — presents or records a meaningful player choice.
- `consequence` — shows what the choice caused; must not be omitted when it changes the story.
- `reaction` — face/body response that controls emotional or comedic timing.
- `relationship` — condensed development or a turning point between player and NPC.
- `cutaway` — brief absurd departure launched by the grounded scene.
- `return` — re-enters the exact beat that launched the cutaway.
- `travel` — compresses distance/time and bridges locations.
- `escalation` — accelerates danger or argument.
- `climax` — decisive high-stakes action/reveal.
- `aftermath` — gives the outcome room to land.
- `ending` — resolves this run's central promise and preserves the player's authored result.

Important choices should normally form at least a decision → consequence pair, even when that pair shares a single tile through multiple balloons. A page turn may separate them when the reveal benefits from suspense or comedy.

### Balloon vocabulary and scalable construction geometry

Use normalized geometry so balloons scale consistently across wide, ordinary, and narrow tiles.

Define:

`U = min(panelWidth, panelHeight) / 100`

All values below are design targets. Enforce practical screen minimums so strokes do not disappear on high-density phones.

#### Normal speech

- White or warm-white organic oval/rounded balloon.
- Outline: **0.75U**, with a minimum rendered stroke of approximately **2 CSS px** at gameplay size.
- Horizontal padding: **3.5U**.
- Vertical padding: **2.5U**.
- Tail length: **14–22U**, depending on distance to mouth.
- Tail base width: **6–9U**.
- Tail should point toward the authored mouth anchor but stop short of touching the face.
- Avoid perfect computer-generated ellipses; introduce restrained organic asymmetry without harming text fit.

#### Player speech

- Remains visually related to normal speech but must be immediately distinguishable.
- Use a warm cream fill and subtly boxier rounded silhouette.
- Do not use color alone as the distinction.
- The chosen response inserted from the tray uses this treatment consistently.

#### Whisper / quiet aside

- Mixed case or restrained italic lettering; never reduce contrast until it becomes illegible.
- Outline: **0.65U** with round dash caps.
- Dash length: **2.5U**.
- Gap length: **1.75U**.
- Maintain approximately a **1.4:1 dash-to-gap ratio** as the balloon scales.
- At a common gameplay scale this will be roughly a 2 px stroke, 8 px dash, and 5.5–6 px gap.
- Tail may use a small dashed or tapered treatment, but it must still identify the speaker unambiguously.

#### Phone / radio / electronic speech

- Squared or lightly rounded balloon body.
- Zig-zag/lightning tail total length: **16–24U**.
- Tail base width: **7–9U**.
- Use **3 bends**, with 4 only when required by routing.
- Each straight leg between bends: **4–7U**.
- Bend angles: approximately **35–55 degrees**.
- Keep a consistent zig-zag amplitude; do not produce tiny decorative teeth that disappear at phone size.
- Tail should be filled white/cream and outlined like the balloon, not drawn as a thin lightning icon.
- A small electronic marker may be used, but the shape/tail must carry the voice treatment without depending on an emoji.

#### Shout / alarm

- Jagged burst with approximately **18–28 spikes**, scaled to balloon size.
- Spike depth: **2–4U**.
- Outline: approximately **1U**.
- Reserve for actual shouting, collision reactions, pursuit, panic, or similarly elevated speech.
- Do not classify every line ending in an exclamation mark as a shout automatically; allow authored tone overrides.

#### Distress / trembling speech

- Wavy outline amplitude: **0.7–1.2U**.
- Wavelength: **5–7U**.
- Use for fear, sickness, crying, or unstable voice, not as a generic decorative alternative.

#### Thought

- Clouded body with two or three diminishing thought bubbles aimed toward the thinker.
- Protect sufficient whitespace around the trailing bubbles so they cannot be mistaken for ellipsis punctuation.

#### Sarcasm / deadpan

- This is an RTR house convention, not a universal comic rule.
- Prefer restrained boxiness, a subtle double-line or dry caption-like treatment, and lettering posture rather than exaggerated decoration.
- Use sparingly; writing and reaction art should carry most of the joke.

#### Captions

- Use for place, mile, time, status change, chapter/travel transition, and occasional narrator-style comedy.
- Keep separate from speaker balloons.
- Gold/cream caption boxes may carry RTR identity; dark variants may be used on night/ambush pages when contrast requires them.
- Do not dump every live game statistic into the permanent comic. Include only numbers that clarify stakes, cause, or payoff.

#### Sound effects

- Free-floating, hand-integrated lettering for meaningful impacts, engines, sirens, crashes, and physical comedy.
- Typical rotation: approximately **6–10 degrees** in the direction of action.
- Typical size: **10–16% of panel width**, adjusted for the event.
- May overlap a border into the gutter when that improves impact, but must not cover faces, essential action, or dialogue.
- Use selectively. Repeating sound effects on every vehicle action will flatten their impact.

### Balloon placement and reading order

Automatic placement is an assistant, not the final art director. It should generate candidates and score them, but authored overrides must always be possible.

Protect more than faces. Metadata should distinguish:

- `faces`
- `mouths` / speaker anchors
- `focus` crop box
- `protect` objects: hands, phones, vehicles, cargo, weapons, road signs, impact areas, clues, or any story-critical object
- temporary `trayRisk` region for the lower live-choice overlay

Placement requirements:

- Speech order controls vertical reading order: the first utterance is highest; later utterances descend.
- For alternating speakers, leapfrog left/right while continuing downward.
- Never allow tails to cross balloons, text, faces, or other tails.
- Avoid covering more than a small incidental portion of a protect box. A simple fixed “12% is acceptable” rule is not sufficient for small but critical objects such as a phone.
- Prefer shorter tails only after reading order and story visibility are satisfied.
- If no safe position exists, use a gutter-hanging balloon, alter the crop using the authored focus box, select an alternate aspect-ratio export if available, or split the exchange into another tile.
- Do not silently make type smaller to resolve placement failure.
- Comedy may require manual overrides for pauses, reaction reveals, withheld information, and visual irony. Preserve explicit authored `balloons[]` positions over automatic guesses.

### Suggested metadata contract

Exact names may adapt to existing code, but the model must support these concepts:

```js
'hiphop.seattle_offer.intro': {
  art: 'assets/storylines/hiphop/seattle/seattle_02_crew_confrontation.png',
  comic: true,
  storyRole: 'setup',
  priority: 'major',
  transition: 'establish',
  aspect: 'wide',
  focus: { x: 0.10, y: 0.05, w: 0.80, h: 0.90 },
  faces: [
    { id: 'malik', x: 0.06, y: 0.10, w: 0.30, h: 0.38 },
    { id: 'player', x: 0.62, y: 0.08, w: 0.30, h: 0.40 }
  ],
  mouths: {
    malik: { x: 0.24, y: 0.36 },
    player: { x: 0.76, y: 0.34 }
  },
  protect: [
    { kind: 'phone', x: 0.45, y: 0.36, w: 0.10, h: 0.18 }
  ],
  balloons: [
    { speaker: 'malik', tone: 'speech', order: 1, placement: 'auto' },
    { speaker: 'player', tone: 'player', order: 2, placement: 'auto' }
  ],
  sfx: null
}
```

Additional event-level data should preserve the selected dialogue text/key, any subsequent NPC responses in order, relationship outcome, mile/location/time if narratively useful, and the stable panel key. Old saved events lacking new fields need a deterministic migration/fallback path; do not invalidate existing comic histories.

### Lettering

The earlier V2 artifact contains contradictory font assignments: its table says Comic Neue dialogue + Barlow captions, while its owner-decisions section says Patrick Hand/Kalam dialogue + Comic Neue non-dialogue. Do not implement both. Resolve the actual bundled font choice visually before coding the final mapping.

Functional requirements regardless of face:

- Dialogue face must remain readable at small gameplay scale and have a convincing hand-lettered character.
- Use sentence case for normal dialogue unless a deliberate shout/style calls for caps.
- Caption/page/chapter lettering must be clearly distinct from character speech.
- Never size dialogue from balloon height alone. Base it on tile/panel scale, available measure, and tested phone readability.
- Gameplay dialogue should target approximately **13 CSS px minimum** under expected display conditions, subject to actual device testing.
- Finished comic at-rest dialogue may target approximately **11–12 CSS px**, because hold-to-zoom is available, but it must not become an indecipherable texture.
- Bundle fonts locally so phone rendering and PDF export are stable and do not depend on a network font request.

### Phone-menu comic: hold-to-zoom

Implement a rearview-mirror-like hold interaction adapted so it does not fight scrolling:

- Hold threshold: approximately **280 ms**.
- Movement greater than **8 px** before activation cancels the hold and preserves normal scrolling.
- Activated zoom: approximately **2.25×**.
- Keep the touched point visually under the finger as zoom begins.
- While held, dragging pans the enlarged page/panel.
- On release, animate back to 1× over approximately **140 ms**.
- Optional pinch zoom range: **1×–4×** if it can coexist cleanly with hold-to-zoom.
- Provide a brief first-use hint such as “Hold a panel to enlarge.” Do not show it permanently.
- Zoom should operate on the rendered panel/page without forcing the entire volume's images into memory.

### Image loading and existing-comic correctness — diagnosed, not fixed here

The following issues were identified during the 2026-09-09 read-only review and must be checked before blaming missing source art:

1. All **73** currently referenced `PANEL_META` art files were found on disk at audit time, so the observed missing/wrong display is not explained simply by those files being absent.
2. `ComicReader` uses an `IntersectionObserver` configured with `.cr-body` as its root, while the actual scrolling container appears to be `.pa-body`. If confirmed in the current code, the observer can treat too many pages as visible, draw many canvases together, thrash the six-image LRU, and produce delayed/blank/wrong-looking pages plus unnecessary iPhone memory pressure.
3. `StoryTile.drawArt` uses the shared Phaser scene loader and waits on a whole-loader `complete` event. Overlapping establishment/choice swaps or unrelated queued loads may race, leaving a loading placeholder or allowing stale establishing art to overwrite the selected-response art. Verify with request/version tokens or another deterministic ownership mechanism before changing behavior.
4. Existing saved comic records may retain an old `panelKey`. `ComicSystem` currently trusts a saved key, so a book created before choice-level mapping corrections may not self-heal. Migration must be deterministic and must not replace a deliberate explicit key with an unrelated “nearby” image.
5. The live tile should begin with the establishing/node art when appropriate, then switch to the selected response/consequence art before that event becomes part of the permanent comic. Special beats still require actual emission sites; merely mapping an image does not make the beat occur.

Do not “fix” a missing panel by substituting a semantically nearby file, reference sheet, or rejected/unwired image. A truthful placeholder is preferable to incorrect story history.

### Known editorial coverage gap

At audit time, approximately **60 consequential choices** existed, but only **39** had direct art mappings and approximately **21** did not. Several missing mappings are narratively important, especially in later Classic Rock branches. This is a coverage/curation problem separate from the renderer.

Examples needing editorial review include:

- Hip-hop: `dom_tape.take` (probably minor) and `cleelum_store.deliver` (ending-level importance).
- Country: `brittney_aux.give/keep`.
- Classic Rock: `othello_watch.jealous`, `washtucna_show.solo/equal/giveAll`, `setlist.hers/mine`, `lacrosse_show.solo/duet`, `lacrosse_after.partner`, `colfax_deal.fifty/sixty/flat/refuse`, `colfax_name.hers/together/mine`, and `pullman_final.play`.

Do not assume all 21 deserve unique art, and do not assume unmapped means unimportant. Apply the narrative editorial rule above, identify the decisions required to understand the player's run, and distinguish:

- Needs dedicated art.
- Can share an establishing image plus distinct dialogue/consequence.
- Belongs in a relationship montage.
- Live-only maintenance; exclude from permanent comic.
- Ending/payoff that must never be omitted.

### Acceptance criteria before calling the comic system complete

- A live conversation can contain 4–5 short leapfrogging balloons without ambiguous reading order.
- The strip never advances while awaiting player input.
- Player-last tiles hold 3 seconds; NPC-after-player tiles hold 6 seconds plus the long-response extension; tap skips only after the new balloon has landed.
- The response tray overlays the full-height art, retracts after selection, respects safe areas, and remains readable over bright and dark panels.
- One, two, and three-panel viewport compositions all look like one continuous comic strip rather than cards.
- Dragging backward reviews earlier panels without committing or advancing anything.
- Panels enter live play in the same narrative order and ratios used by the finished comic.
- The finished comic filters live-only maintenance while retaining decisions, consequences, relationship turns, set pieces, and endings.
- Brittney, Mykenzie, Malik, Dominique, and any other verified recurring relationship receive appropriate development/payoff treatment without turning every meter interaction into a full panel.
- The 75/25 grounded-to-absurd target is perceptible across the complete comic without mechanically inserting cutaways.
- No more than 1–2 full-page moments appear in the entire comic, and neither requires destructive portrait cropping of existing landscape art.
- Hold-to-zoom works without stealing ordinary scroll gestures.
- Old saved comics still open and resolve deterministically.
- Blank/missing panels are tested on a real iPhone with cache/LRU/observer instrumentation, not judged only in desktop preview.
- Opening, scrolling, zooming, closing, and reopening the comic does not cause unbounded decoded-image growth or worsen the already documented iPhone restart risk.

### Instruction to Claude: implementation order

Do not attempt a single monolithic rewrite. Recommended order:

1. Reconcile current code with the diagnosed loading, observer-root, saved-key, and tile-race findings; write focused failing tests or instrumentation first.
2. Separate narrative comic inclusion from gameplay `consequential` state.
3. Define the shared panel/event metadata contract and deterministic legacy fallbacks.
4. Implement the live fixed-height/variable-width strip and safe manual review behavior.
5. Implement balloon sequencing and the approved timing state machine.
6. Redesign response controls as the translucent overlay tray.
7. Implement aspect-ratio-preserving finished-page composition from the same ordered panels.
8. Add relationship montage selection and grounded/cutaway editorial roles.
9. Add hold-to-zoom and verify touch conflicts.
10. Validate memory and rendering on a real iPhone before expanding art coverage.

Keep implementation commits separable. Do not claim the design is complete based solely on the V2 artifact page; that page is a useful proposal and visual discussion aid, not proof that the production reader or gameplay strip behaves this way.

### Claude: request design input instead of silently guessing

As you inventory and implement the comic, tell the owner and ChatGPT/Codex when you need additional visual direction. Do not force automatic balloon placement, reuse unsuitable art, or quietly omit an important story beat merely to make the renderer complete.

Please produce a concrete review list containing:

1. **Balloon-placement questions** — panels where the automatic placement cannot preserve reading order while also protecting faces, mouths, hands, phones, cars, impact areas, clues, and the live response-tray region.
2. **Speaker-anchor questions** — panels where the speaker, mouth location, off-panel voice, thought owner, or order of speech is uncertain.
3. **Crop/aspect-ratio questions** — panels whose current landscape image cannot safely serve the intended wide, ordinary, or narrow tile without losing essential content.
4. **Additional-image recommendations** — meaningful decisions, consequences, relationship turns, cutaways, payoffs, climaxes, or endings that do not have suitable art and would materially improve the story if new artwork were created.
5. **Alternate-export recommendations** — existing images that are narratively correct but would benefit from a separate square, tall, close-up, or wider composition instead of an aggressive crop.
6. **Editorial questions** — uncertain events that may belong in the permanent comic, a relationship montage, or live gameplay only.

For every item, provide:

- Story, node, choice, or stable panel key.
- Current art path, if any.
- The exact dialogue or story beat being represented.
- Intended panel role and aspect ratio.
- What specifically conflicts or is missing.
- Your recommended solution.
- Whether the issue is blocking, important, or merely polish.
- A small annotated screenshot/mockup when words alone do not clearly communicate the problem.

For proposed new artwork, also provide a concise art brief: characters present, location/time, action, emotion, camera framing, required negative space for balloons, objects that must remain visible, intended tile ratio, and why existing art cannot tell the beat honestly. Group related recommendations so the owner can commission a useful set rather than receive scattered one-off requests.

Ask these questions **before** baking questionable guesses into dozens of metadata records. Straightforward panels may still be pre-filled automatically, but flag low-confidence `focus`, `faces`, `mouths`, `protect`, tone, and balloon-position guesses for visual review. The owner is happy to supply style/story direction, and ChatGPT/Codex can help art-direct exact balloon geometry and placement once you identify the difficult panels.
