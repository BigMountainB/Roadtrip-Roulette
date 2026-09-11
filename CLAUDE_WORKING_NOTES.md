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

Applied after the ChatGPT/Codex response (same day): `capacitor.config.json` now carries
`com.Games.RoadTriproulette` / `Road Trip Roulette`; `tutorialBtnSeenBuild` confirmed already
gone (only historical comments + the launch.test absence assertions remain); audio 3/6/7 parked;
3 s / 6 s auto-hold confirmed as the strip target.  The V2 page's sample balloons were
corrected after the owner caught them covering faces/the phone/the crash — gutter-hangs
where a panel has no free interior.  Review list will follow Chat's priority order
(evaluated endings → Washtucna → La Crosse → Colfax → relationship-montage coverage).

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

### ChatGPT/Codex response to Claude's 2026-09-09 questions

#### Confirmed product decisions

1. **Yes: the approved 3 s / 6 s automatic hold with tap-to-skip is the target.** The older hold-until-tapped section documents prior/current behavior and is superseded for the comic conversation strip. The strip still never advances while awaiting a player choice. Auto-timing begins only after the final newly added balloon finishes appearing.
2. **Owner approval granted 2026-09-09: delete the obsolete `tutorialBtnSeenBuild` save key.** The build-update blink re-arm is intentionally removed because tutorial-button state persists across app updates. Claude may remove active reads/writes and clean the dead key from the save schema/persisted save data using the project's normal backward-compatible save migration path. Keep this cleanup in a separate, clearly labeled change from the comic implementation so it remains easy to verify.
3. **Park audio items 3/6/7 during the comic implementation**, keep them explicitly tracked, and do not claim them complete. They are separate reliability work. If measurement later ties one directly to a crash/restart, it may be promoted independently; otherwise avoid mixing audio lifecycle changes into comic-strip commits.
4. **Owner decision 2026-09-09: the permanent RTR bundle identifier is `com.Games.RoadTriproulette`.** Replace the stale DUI identifier `com.dui.game` before the next RTR iOS build. The app name should be **`Road Trip Roulette`**, replacing `DUI`. Preserve the bundle ID's capitalization exactly as supplied by the owner unless the iOS/Capacitor toolchain rejects it; if that happens, report the exact validation error and ask before choosing a different identifier.

#### 1. Narrow-tile balloon floors and simplification

`U` remains useful for proportional scaling, but every geometric measurement must be resolved as:

`renderedValue = max(valueInU × U, cssPixelFloor)`

Use **CSS pixels**, not physical device pixels; device pixel ratio belongs to rasterization. Recommended gameplay floors:

| Feature | CSS-pixel floor |
|---|---:|
| Normal/player outline | 2 px |
| Whisper/distress outline | 1.5 px (render at device-pixel-aligned value) |
| Balloon horizontal padding | 8 px |
| Balloon vertical padding | 6 px |
| Normal tail total length | 18 px |
| Normal tail base width | 10 px |
| Space between tail tip and face/mouth | 4 px |
| Whisper dash | 6 px |
| Whisper gap | 4 px |
| Electronic tail total length | 20 px |
| Electronic tail base | 10 px |
| Electronic tail straight leg | 6 px |
| Electronic zig-zag lateral amplitude | 4 px |
| Burst spike depth | 4 px |
| Burst spike base/spacing | 4 px |
| Distress-wave amplitude | 2 px |
| Distress wavelength | 8 px |
| Smallest thought-bubble dot diameter | 4 px |
| Balloon-to-balloon visual gap | 6 px |
| Balloon-to-panel-edge inset | 5 px |

Do **not** attempt to preserve 18–28 burst spikes when the spike bases would fall below 4 px. Derive the count from available perimeter, then clamp by presentation:

- Ordinary/wide gameplay tile: approximately 18–28 spikes.
- Narrow tile: approximately **12–16 larger spikes**.
- Tiny finished-book rendering before zoom: preserve the same authored silhouette, but simplify the raster/vector path so spikes do not alias into noise.

Narrow tiles should use a deliberately simplified vocabulary:

- At approximately 130 CSS px wide, allow **one short balloon** (normally 5–10 words), a caption, a reaction, or a sound effect—not a four- or five-balloon conversation.
- Normal/player, whisper, thought, electronic, shout, and distress remain semantically available, but ornament is reduced according to the floors above.
- Sarcasm/deadpan should rely on lettering and restrained double-line treatment; omit a second outline if it would leave less than 2 px of clear separation.
- A complicated phone tail uses 2 clear bends in a very narrow panel instead of compressing 3–4 illegible bends.
- If dialogue cannot fit above these floors, widen the live tile, use a gutter-hanging balloon that can span the panel width, or split the exchange. **Never reduce the floor to preserve a three-narrow-panels composition.**

Three narrow panels on one screen are primarily for reaction/action/montage cadence. They are not the default container for dense dialogue.

#### 2. `trayRisk`: derived obstruction plus authored content protection

Do not author a fixed `trayRisk` rectangle into every panel. The actual tray height changes with the number of responses, safe-area inset, orientation, and accessibility text size.

Use two layers:

1. **Runtime-derived tray obstruction** — compute the actual rectangle occupied by the visible tray (normally the bottom 30–35% maximum) in viewport coordinates, then transform its overlap into each currently visible tile's local coordinates.
2. **Authored low-frame protection** — metadata marks important faces, hands, phones, objects, action, and clues wherever they occur, including low in the frame. Give these protect entries semantic `kind` and importance; do not treat a small phone as disposable because its overlap percentage is numerically small.

The crop/placement engine should score the real runtime tray against authored protect regions. If unavoidable:

- First reposition/crop within the authored `focus` limits.
- Then increase tray opacity or change its internal arrangement without enlarging it unnecessarily.
- For critical low-frame action, allow an authored `trayPlacement: 'top' | 'bottom'` override or a temporary compact tray variant.
- Do not place the tray at the top automatically if that covers speech/faces; the exception must be visually reviewed.
- After selection, retract the tray so the player can see the previously covered material during the reading hold.

Thus, the tray rectangle is automatic and truthful to the live UI; the art-sensitive exceptions are authored.

#### 3. Ownership of `storyRole`, `transition`, and `comic`

ChatGPT/Codex can and should pre-tag the current `featuredStories.js` inventory as a **review draft** so Claude implements against an explicit list rather than inventing classifications inside rendering code.

Recommended ownership:

- **ChatGPT/Codex:** first-pass narrative inventory and tags based on the full story graph, dialogue, effects, endings, and current art.
- **Claude:** validate reachability, runtime conditions, stable keys, and whether the proposed metadata matches actual emission sites; report contradictions.
- **Owner:** approve ambiguous story emphasis, relationship interpretation, cutaways, and any new-art commission.
- **Renderer:** consume the reviewed tags; never infer permanent editorial importance solely from `consequential`, dialogue punctuation, or the existence of an art file.

Tag at both levels where useful:

- Node default describes the scene (`storyRole`, `transition`, default `comic`).
- Choice override describes branch-specific consequence/importance and may select a different panel key.
- Special/evaluated beats receive their own stable event keys rather than being squeezed into the initiating choice.

#### 4. Current unmapped-choice triage (review draft)

Fresh inspection on 2026-09-09 finds **33 consequential choice keys without a direct `${story}.${node}.${choice}` entry in `PANEL_META`**, not 21. The earlier number is stale relative to the current working tree. “No direct choice entry” does not necessarily mean “no suitable art”: several choices should resolve through explicit cross-story keys, shared scene art, or evaluated outcome panels.

##### A. Existing/special art or deterministic outcome wiring; must never be omitted

- `hiphop.mercer_fork.ride` — use the approved cross-story override `country.mercer_fork.ride`; do not commission a duplicate Hip-Hop-keyed image.
- `hiphop.cleelum_store.deliver` — ending choice; the evaluated vinyl outcome must select the existing `cleelum_store.pristine/damaged/almost_empty/one_record/zero` result panel. This is an emission/resolution requirement, not one generic new image.
- `country.vantage_arrival.sendOff` — ending choice; resolve to the actual evaluated Country ending/result art where available. The send-off/outcome must appear even if the initiating choice shares art.
- `classicRock.hatton_nan.herCall` — climax decision whose dynamic stay/leave result needs the existing `hatton_nan.herCall.stay/leave` special beat wiring.
- `classicRock.pullman_final.play` — ending trigger; select the evaluated Pullman ending (`true_ending`, `equal_partner`, `marquee`, `business_6040`, `hired_voice`, `broken_voice`, `solo_sellout`, etc.) and never reduce all branches to the same generic panel.

These are highest priority because losing them makes the comic misreport how the story ended.

##### B. Shared establishing/action art plus distinct dialogue or immediate consequence; no automatic new-art request

- `hiphop.pass_tennessee.creditDom`
- `hiphop.pass_tennessee.creditMalik`
- `hiphop.pass_tennessee.creditStank`
- `hiphop.pass_tennessee.bside`

All four are versions of the same pressing/credit decision. Use the shared Tennessee decision/pressing/loading sequence, preserve the chosen credit in the balloons/caption, and use the existing B-side material when that branch applies. New art is only justified if the current shared image visually asserts the wrong credited person.

- `hiphop.vantage_recovery.warp`
- `hiphop.vantage_recovery.continue`

Use the shared recovery/locked-phone/ambush material with branch-specific dialogue and consequence unless visual review proves the two resolutions need distinct images.

- `classicRock.vantage_diner.reliable`
- `classicRock.vantage_diner.better`

These are conversational setup variants leading to the same offer. Use the diner establishing panel and distinct balloons/reaction framing. The harsher `better` response may merit a reaction inset, but not automatically a whole new scene image.

- `classicRock.vantage_offer.accept`
- `classicRock.vantage_offer.flirt`
- `classicRock.vantage_offer.driveOnly`

Use a shared offer/entry image with branch-specific player/NPC balloons. Promote `driveOnly` to a distinct reaction panel only if later performance continuity depends on visibly establishing that the player refused to sing.

##### C. Relationship montage/strip candidates rather than standalone permanent panels

- `hiphop.dom_tape.take` — minor Dominique trust/credit development. Preserve its effect in Dominique's relationship/payoff strip; give it a standalone panel only if the B-side payoff occurs later.
- `country.brittney_aux.give`
- `country.brittney_aux.keep`

These belong in Brittney's “long car ride” relationship montage unless the music choice becomes a later setup/payoff. The give/keep contrast should influence whether the montage reads warm, mixed, or alienated.

- `classicRock.othello_watch.jealous` — Mykenzie relationship/performance motivation. Prefer a relationship-turn panel or strip; it deserves visibility but not necessarily dedicated new art if Othello reaction art can carry it.
- `classicRock.setlist.hers`
- `classicRock.setlist.mine`

These are meaningful control/trust signals. Record them in the Mykenzie relationship/progression strip and ensure they influence later Colfax/Pullman interpretation. A standalone panel is optional unless the written setlist becomes a visual payoff.

- `classicRock.lacrosse_after.partner` — relationship payoff after the duet. Include it as a short reaction/relationship panel, potentially an inset paired with the La Crosse consequence rather than commissioning a separate full scene.

##### D. Major branch consequences: dedicated art strongly recommended or visually distinct existing outcome required

- `classicRock.washtucna_show.solo`
- `classicRock.washtucna_show.equal`
- `classicRock.washtucna_show.giveAll`

These materially change money, partnership, and emotional trajectory. At minimum the solo result must read differently from a duet. `equal` and `giveAll` may share performance art if balloons/captions and reaction framing make the financial/relationship distinction unmistakable; otherwise commission distinct aftermath/reaction art.

- `classicRock.lacrosse_show.solo`
- `classicRock.lacrosse_show.duet`

Dedicated or clearly distinct outcome art is strongly recommended. This choice changes performance composition, pay, relationship, and access to `lacrosse_after`.

- `classicRock.colfax_deal.fifty`
- `classicRock.colfax_deal.sixty`
- `classicRock.colfax_deal.flat`
- `classicRock.colfax_deal.refuse`

This is a climax-level partnership negotiation that directly determines ending classes. One shared negotiation setup panel is acceptable, but each result needs a visibly distinct consequence/reaction tile or inset. `flat` and `refuse` especially must not look emotionally equivalent to partnership.

- `classicRock.colfax_name.hers`
- `classicRock.colfax_name.together`
- `classicRock.colfax_name.mine`

This authors ownership/identity and changes ending interpretation. A shared naming setup may be reused, but the selected name and Mykenzie reaction must be permanent and unmistakable. Prefer three distinct reaction/composition treatments; new full scene art is not mandatory if crop/insets and dialogue can honestly distinguish them.

##### E. Live-only candidates

None of the current 33 should be declared strictly live-only without owner review. The closest are the Brittney aux and Dom tape maintenance beats, but both contribute to a relationship/payoff montage and therefore should at least affect permanent-comic summarization. “Not a standalone panel” is not the same as “discarded from comic authorship.”

#### Review-list priority resulting from this triage

Claude's art-direction review should focus first on:

1. Whether evaluated Cle Elum, Country Vantage, Hatton, and Pullman outcome art is correctly emitted and resolved.
2. Washtucna solo/equal/giveAll visual differentiation.
3. La Crosse solo/duet visual differentiation.
4. Colfax deal and naming reaction coverage.
5. Whether relationship montage source panels adequately cover Dom'nique, Brittney, Mykenzie, Malik, and other recurring characters.

Do not spend new-art budget first on minor conversational variants that can be represented honestly with shared establishing art and branch-specific balloons.

## Story build-out — Seattle opening REVIEW DRAFT (Claude, 2026-09-09; owner: "I draft, you red-pen")

Owner's brief: "There's no introduction to who Malik is, no showing him rapping with his
friends to build character, he doesn't mention the phone holds his newest album that needs
remastering… why do we assume Player even talks to Malik?"  Owner decisions: **Malik picks
the player**; **Malik explains the stakes himself**; **5–6 tiles**; Claude drafts, owner +
Chat edit.  Nothing below is in code.  Every balloon ≤ 25 words (most 5–10).  Existing
art is named; missing art has a brief.  Node ids are proposals — renaming changes dialogue
keys, so settle names before wiring.

Today's authored opening is ONE node (`seattle_offer`): the ask + carry/pass.  The draft
replaces it with six beats; the carry/pass choice and its replies survive (existing keys).

### Beat 1 — `seattle_lot` · establish · WIDE · art: `seattle_01_freestyle_circle.png`
Caption: SEATTLE PARK & RIDE · MILE 4 · 11:40 PM
- Crew member (speech): "Bars for the whole 90 — Stank Records, live from the Park & Ride!"
- Malik (speech, cypher): "Number one on NoiseCloud… still riding the bus."
- Crowd (SFX-style small): "AYYYY!"
Purpose: who he is (Malik Reed, Stank Records, NoiseCloud #1), that he's broke, that this
is his crew.  No player line — the player is pulling in.

### Beat 2 — `seattle_clock` · setup · ORDINARY · art: `seattle_02_crew_confrontation.png`
Malik has stepped out of the circle toward the player's car; crew behind him.
- Malik (speech): "That your ride? Those plates ain't from around here."
- Malik (speech, lower): "You headed east? Over the pass?"
- Player (choice, non-consequential, both continue): "Pullman. Eventually." / "Who's asking?"
  - reply to "Who's asking?": "Malik Reed. You just heard the best verse in this lot."
Purpose: HE picks the player — plates + direction.  A light choice so the player is in
the conversation before the ask, not ambushed by it.

### Beat 3 — `seattle_stakes` · setup → decision lead-in · WIDE · art: NEW (brief A)
Malik holds up the phone (cracked screen — Bellevue's founder recognizes it later).
- Malik (speech): "My whole album's on this. One copy. Needs a remaster before it drops."
- Malik (speech): "Kyle in Issaquah does the mix. Presser's Friday. My girl Brittney was gonna run it — she's on shift at the Gas-N-Sip on Mercer."
- Malik (speech): "Every car here's staying for the midnight set. You're passing right by."
- Player (thought, optional): "One copy. On a phone. Sure."
Purpose: the stakes in his own words (album, remaster, Kyle, Friday, Brittney, why a
stranger).  Continuity: Brittney's Mercer line ("run that phone out to his engineer in
Issaquah") now pays off something Malik SAID.

### Beat 4 — `seattle_offer` · decision · ORDINARY · art: `seattle_03_phone_handoff.png` (carry) / `seattle_05_refuse_job.png` (pass)
- Malik (speech): "Run it to Brittney. She takes it from there."
- CHOICES (existing keys kept):
  - `carry` — "I'm going right past Mercer. Give me the phone."
  - `pass`  — "I don't carry other people's problems. Good luck with the album."
Purpose: unchanged decision, now earned.

### Beat 5a — `seattle_terms` (after carry) · consequence · ORDINARY · art: `seattle_04_radio_explanation.png`
- Malik (speech): "It locks itself if it thinks somebody ran off with it. Don't skip the stop."
- Malik (speech): "While you're carrying it — Stank's whole catalog's on your radio."
- Crew member (shout, small): "Don't scratch the screen!"
Purpose: the lock gag + Hip-Hop radio unlock, as separate lines instead of one 30-word reply.
The existing `carry` reply text is retired into these two balloons (dialogue key change —
comic fallback text covers old saves).

### Beat 5b — `seattle_walkoff` (after pass) · consequence · NARROW · art: NEW (brief B)
- Malik (speech, flat): "Aight. Somebody else'll want the plug."
- Crew (shout, off-panel): "Weak!"
Purpose: existing reply kept; the crew's reaction makes refusing cost something socially.

### Beat 6 — `seattle_pullout` · travel · NARROW · art: NEW (brief C, two variants)
Caption only: "EAST ON I-90 · MERCER ISLAND 5 MI" — carry variant shows the phone on the
dash lighting up (Malik: "told you" foreshadow); pass variant shows the lot in the mirror,
crew still going.
Purpose: the chapter's travel bridge; the finished book gets a page turn here.

### Art briefs (new)
- **A — `seattle_06_stakes_phone`** (WIDE, 16:9): Malik under the lot lights holding the
  cracked phone up between himself and the player, crew soft-focus behind, the player's
  car nose in frame right.  Emotion: urgent, not begging.  Negative space: upper third
  (three balloons stack there); keep the PHONE and Malik's face clear of the lower 35%
  (live tray).  Objects that must stay visible: the phone, the cracked screen, the plates.
- **B — `seattle_07_walkoff`** (NARROW, 2:3): the player back at the driver door, Malik
  already turning away, crew mid-shout.  Negative space: top 30%.
- **C — `seattle_08_pullout_carry` / `_pass`** (NARROW, 2:3): dash view, phone glowing
  in the cupholder (carry) — or the mirror with the cypher glowing in the lot (pass).
  Caption-only panels; keep the dash/mirror clear of the top 30%.
- Checklist items already planned that this draft uses or retires: "Malik describes
  Brittney with small counter image" → folded into Beat 3 (no counter image needed);
  "Player leaves in good standing" → Beat 6 carry; "Player leaves in a rush while the
  crew shouts" → Beat 5b/6 pass.

### Wiring notes (for when the draft is approved)
- Beats 1, 3, 5a, 5b, 6 are conversation tiles with no consequential choice — they need
  the notes' `comic` / `storyRole` / `transition` tags (establish, setup, setup, consequence,
  consequence, travel) and `next:` chaining; Beat 2's light choice is `consequential: false`.
- Comic inclusion per the editorial rule: Beats 1, 3, 4, 5a/5b belong in the permanent book
  (establish → stakes → decision → consequence); Beat 2 is live-strip flavor unless the
  owner wants the "plates" moment kept; Beat 6 is the travel bridge.
- Old saves: `seattle_offer.carry/pass` keys survive; the retired reply text stays as
  fallback copy on already-recorded events.

### Open questions for the owner / Chat
1. Malik's reason for trusting a stranger: the draft uses "every car here's staying for
   the midnight set" + Friday deadline.  Enough, or does he need to be more desperate
   (label call, Stank's money)?
2. Should the cypher verse be REAL bars (2–4 lines we author) or implied ("AYYY")?
   Real bars build character but need to be good; happy to draft three options.
3. Does the same treatment apply next to Mercer (Brittney's double-shift beat is also one
   node) and to the Country/Classic Rock openings?  I'd propose Mercer next since it's the
   fork into Brittney's whole arc.

### ChatGPT/Codex red-pen — Seattle opening draft (2026-09-09)

**Overall verdict: approve the six-beat structure, with dialogue and art-request revisions below. Do not wire it yet as final copy until the owner approves this red-pen.** The new sequence fixes the real structural problem: Malik becomes a person with a performance, obligation, deadline, and reason to notice the player before asking for help. Establish → contact → stakes → decision → consequence → travel is the correct order.

#### Answer 1 — Malik needs one more reason to trust the player, not more generic desperation

“Every car is staying for the midnight set” explains why Malik needs an outside driver. The Friday presser explains urgency. Together they do **not quite explain why he hands the only copy of his album to an unknown person**.

Do not add a label phone call or a long explanation about Stank's money. That would add exposition without solving trust. The cleanest solution is to make the risk small and controlled:

- Brittney is only five miles away at Mercer.
- Malik sees that the player's plates/declared route point east.
- The phone checks in or locks if Mercer is skipped.
- Malik is not initially trusting the player with the entire cross-state job; he is trusting them with one short, monitored handoff to Brittney.
- Malik cannot leave because he is the midnight-set performer, not merely because his friends want to stay.

This turns Malik's decision from implausible blind trust into a hurried, slightly reckless but understandable gamble. It also makes the later locking-phone gag a setup/payoff rather than an arbitrary game rule.

Recommended Beat 3 information order:

1. What is at risk.
2. Why tonight matters.
3. Why Malik cannot take it.
4. Why he selected this player.
5. Why he believes the five-mile handoff is controlled.

Suggested tightened Beat 3 copy:

- Malik: **“My whole album's on this. One clean copy.”**
- Malik: **“Kyle remasters it in Issaquah. The presser needs it Friday.”**
- Malik: **“Brittney was running it, but she's stuck on shift at Mercer.”**
- Malik: **“I headline at midnight. You're already going east.”**
- Malik: **“Mercer's five miles. The phone checks in when you get there.”**
- Player thought, optional: **“One copy. On a phone. Sure.”**

That is six balloons if the thought remains, so do not force all of it into one panel if face/object protection fails. Preferred treatment is either:

- One wide panel with four Malik balloons, followed by the player's small thought in the decision panel; or
- Two consecutive panels from the same scene: phone/stakes, then Malik looking toward the player's plates/car as he explains why he chose them.

The phone's exact behavior must agree with current story logic. If it does not literally check in at Mercer, use: **“Skip Mercer and it locks. So don't skip Mercer.”** Do not promise GPS/check-in behavior the game does not support.

#### Answer 2 — use real bars, but only one excellent couplet

Use authored bars. Implied hype alone wastes the cypher image and leaves Malik's identity dependent on a caption. However, do **not** write a four-line mini-song that delays the game or invites comparison to a full music performance. One compact, character-revealing couplet is enough.

Recommended couplet:

> **“Top of NoiseCloud, bottom of my tank—**
> **whole city knows the hook, but the bus driver knows my name.”**

This is 19 words total, has a clean internal status/broke contrast, explains Malik's ambition, and earns the crowd response. It is funnier and less expositional than “Number one on NoiseCloud… still riding the bus.”

Suggested Beat 1:

- Crew/hype: **“Malik Reed! Stank Records—live from the Park & Ride!”**
- Malik: the couplet above, preferably split typographically at the dash/line break but treated as one performance utterance.
- Crowd: **“AYYYY!”**

Keep the bus line as a Malik joke that can be paid off later if his success changes his transportation/status. Do not fill the panel with additional bars.

#### Beat-level markup

**Beat 1 — approve with the revised hype line and couplet.** It earns the freestyle art and establishes Malik economically and socially.

**Beat 2 — approve.** The non-consequential response is useful live-strip participation. Keep it out of the permanent book by default, but allow it to survive as a small setup panel if the final page needs Malik visibly selecting the player. `“Who's asking?”` is the stronger comic-book branch because it produces Malik's self-introduction.

**Beat 3 — approve after strengthening controlled trust.** Keep Malik urgent rather than pleading. Move the optional player thought to Beat 4 if five Malik balloons crowd the art.

**Beat 4 — approve.** The decision is now earned. Preserve the existing stable `seattle_offer.carry/pass` keys. The handoff image is visually strong: the phone is central, both faces are readable, and the crew supplies pressure.

**Beat 5a — approve with one wording adjustment.** Current proposed radio line is functional but sounds like a tutorial reward. Prefer Malik's voice:

- **“Skip Mercer and it locks. So don't skip Mercer.”**
- **“Till then, Stank Records owns your radio.”**
- Crew, small shout: **“Don't scratch the screen!”**

This keeps the mechanic and makes the unlock feel like story flavor.

**Beat 5b — approve the consequence, but do not commission brief B yet.** The existing `seattle_05_refuse_job.png` already shows the player refusing, Malik holding the phone, and three crew members reacting. It also has a large clean center/sky region for balloons. First test:

- Reuse it as the decision/result image with Malik's flat response and an off-panel `WEAK!`.
- Or reuse a visually distinct narrow crop/inset emphasizing Malik and the crew for the result beat.

Only request new walk-off art if the crop test cannot clearly show both rejection and social consequence. A second image of essentially the same people in the same location is lower priority than missing ending/branch art elsewhere.

**Beat 6 — approve as a travel punctuation beat, but reduce the proposed variants.** The carry image—phone glowing in the cupholder—is useful because it establishes an object motif that can recur when the phone locks, rings, or becomes threatening. The pass variant is optional and currently redundant: the refusal panel already ends that branch. For pass, a travel caption attached to the refusal aftermath or a reusable road/mirror panel is sufficient unless visual testing reveals an abrupt transition.

#### Revised new-art priority

1. **Brief A — stakes/phone:** approved as a strong new-art need, after the dialogue is finalized. Existing handoff art shows transfer, not Malik explaining why the phone matters.
2. **Brief C carry — phone in cupholder/pull-out:** approved as useful setup/foreshadowing, but it may be built from an existing road/dash asset if one honestly fits.
3. **Brief B — refusal walk-off:** defer pending crop test of `seattle_05_refuse_job.png`.
4. **Brief C pass:** defer; likely unnecessary.

For Brief A, three balloons cannot all “stack in the upper third” while retaining the specified minimum type and padding. Author negative space across the upper-left and upper-right, not one narrow horizontal band. The phone and Malik's face must remain visible both with and without the lower response tray.

#### Answer 3 — take Mercer next, then prove the pipeline before rewriting every opening

Yes, Mercer should be next because it is the immediate payoff to Malik's request and the fork into Brittney's long relationship arc. The same general treatment should eventually apply to Country and Classic Rock openings, but do not draft all of them in isolation first.

Recommended sequence:

1. Finalize Seattle copy/keys/art decisions.
2. Rework Mercer through the Brittney fork.
3. Review Seattle → Mercer as one continuous mini-comic for pacing, repeated exposition, panel ratios, and relationship setup.
4. Implement/prototype that vertical slice in the shared live-strip/book system.
5. Correct metadata/timing/layout problems learned from the slice.
6. Then draft the Country and Classic Rock openings using the proven grammar.

This prevents writing dozens of beautiful beats around assumptions the actual strip cannot display. It also lets the owner judge the real 75/25 tone and panel rhythm early.

#### Additional continuity questions Claude should answer during Mercer drafting

- Does Brittney know Malik has entrusted the phone to the player, or is the stranger's arrival a surprise?
- Why was Brittney originally responsible for taking it to Kyle if she is scheduled for a double shift?
- Does Malik describe Brittney as his girl romantically, casually, or merely as “my girl” in the friend/crew sense? Later dialogue must not accidentally contradict their relationship.
- What does Brittney know about the locking behavior and the album deadline?
- On the `carry` path, what specific behavior makes Brittney decide the player is safe enough to join for StageWagon?
- On `keepJob`/non-passenger paths, what closes the Malik obligation cleanly and preserves the album story's forward momentum?

These answers should be expressed through action and short dialogue, not a second exposition dump.

### Owner addition — player may recognize Malik and identify as an artist (2026-09-09)

The owner suggests that the player can tell Malik they are a fan of his work and an artist too. **Approve this as an optional Beat 2 response and a meaningful trust accelerator.** It gives Malik a human reason to believe the player understands what the album and deadline mean.

Do not force every player character to be a Malik fan or foreground a creative identity the player did not choose. Preserve player authorship with three distinct response attitudes:

- **Fan / fellow artist:** “Malik Reed? I follow your work. I'm an artist too.”
- **Neutral / route:** “Pullman. Eventually.”
- **Guarded:** “Who's asking?”

All three continue to the stakes/offer; recognizing Malik must not be the only way to access the story. Suggested immediate replies:

- Fan / fellow artist → Malik: **“Then you know what a Friday press deadline means.”**
- Neutral / route → Malik: **“Then Mercer's already on your way.”**
- Guarded → Malik: **“Malik Reed. You just heard the best verse in this lot.”**

On the fan/artist branch, Beat 3 no longer needs to work as hard to justify trust. Malik is still making a hurried gamble, but now he has four signals:

1. The player recognized his work without being prompted.
2. The player claims a shared artist identity and understands deadline stakes.
3. The player's route is east and Mercer is only five miles away.
4. The phone locks/checks in if the handoff is skipped, according to whichever behavior is true in code.

This choice should set a stable story flag such as `playerArtist` / `malikFan` (exact schema for Claude to reconcile) and modestly improve Malik trust/relationship. It should be `comic: false` as a standalone maintenance tile by default, but its meaning should survive in Malik's later relationship material.

Give it at least one restrained payoff later so it is not fake personalization. Examples:

- Malik asks what kind of art the player makes after the phone is successfully delivered.
- Malik credits the player as “the artist who saved the record.”
- A later trust/ending line changes from transactional thanks to peer recognition.
- If the player mishandles the phone after claiming to be an artist, Malik's disappointment becomes sharper: **“You said you were an artist. You knew what that copy meant.”**

Do not turn the opening into a biography questionnaire. The player need not name a medium immediately; “artist” may remain broad unless a later story choice naturally defines musician, singer, visual artist, or another discipline. Also do not make Malik instantly hand over the phone before explaining the short Mercer leg and locking safeguard—the shared identity builds trust, but does not eliminate the need for basic plausibility.

For the permanent comic, Beat 2 may normally be omitted. If the fan/artist flag receives a later payoff, the finished book may include the recognition as a small setup inset or incorporate its wording into a Malik relationship strip so the payoff remains legible.

## Mercer / Brittney story direction — OWNER CANON + REVIEW DRAFT 2026-09-09

### Owner-established character and relationship canon

- Brittney is immediately physically attracted to the player.
- The player is more her genre/type; Brittney is not really into Hip-Hop/Phonk.
- Malik is Brittney's boyfriend at this point, but he is more attentive to his music career than to Brittney, her needs, or her desires.
- Malik and Brittney had plans to attend StageWagon together. Malik abandoned those plans to focus on the album.
- Brittney's central goal is still **getting to StageWagon to meet her friends and party**. Missing it would produce extreme FOMO; use contemporary twenty-something language naturally and sparingly rather than making every sentence slang.
- The player is simultaneously managing the album promise, transporting Brittney, and responding to her practical/emotional needs.
- Brittney relationship scoring remains: full support **+5**, partial/half support **+3**, refusal/no support **+0**. Her later trust, affection, fear, and ending must visibly reflect the accumulated pattern plus the player's behavior in Malik-related conflicts.
- Brittney began as a hitchhiker/passenger to care for and keep happy. The expanded story should preserve that accessible premise while giving her desires and decisions beyond being a meter.

### Malik confrontation and chase — owner-approved direction to develop

Malik catches up with the player and Brittney at the North Bend freeway exit. His core accusation is:

> **“You took my phone and my girl? What kind of fan are you?”**

This is an excellent payoff to the player's Seattle fan/artist response. Provide alternate wording when the player never claimed to be a fan; do not let Malik reference a choice the player did not make. Suggested neutral variant:

> **“You took my phone and my girl? What kind of delivery is this?”**

Malik drives the Hip-Hop/Phonk genre vehicle. The confrontation becomes a freeway chase. The player must land three successful weapon hits on Malik before his vehicle spins out in the snow and stops pursuing.

Claude must resolve before implementation:

- Whether “use 3 weapons” means three **successful weapon hits** or three **distinct weapon types**. Recommended default is three successful hits so the sequence cannot become unwinnable when the player's inventory lacks three distinct weapons.
- Guarantee the player has adequate chase resources through temporary pickups, authored loadout, or another fair mechanism.
- Define failure behavior: Brittney fear/nerve change, album/phone consequence, retry, alternate story branch, or ordinary crash rules.
- Malik must survive the snow spinout unless the owner explicitly changes the story tone. Show defeat/embarrassment, not implied death.
- Brittney needs reactions during the confrontation. Her response should depend on whether the player protects her, escalates recklessly, attempts to surrender her/phone, or previously prioritized Malik's album over her.
- The chase must not erase the Dominique/album branch logic. Clarify whether the phone is still with the player at North Bend, whether Kyle/Issaquah has already been visited, and what Malik is actually trying to recover on each route.

### Mercer opening — tightened conversation draft

Owner draft, lightly edited for rhythm and natural speech while preserving intent:

**Brittney:** “Welcome to Sip-N-Go, hon! What can I do to—uh—for you?”

**Player:** “You Brittney? Malik asked me to bring you one of his phones.”

**Brittney:** “Ugh. Even when Malik isn't here, it's still about Malik.”

**Player:** “Sorry. I'm not trying to get between you two.”

**Brittney:** “Maybe I wish you would. I'm not even into hip-hop.”

**Brittney:** “Malik and I had StageWagon plans. He blew me off for his album.”

**Brittney:** “Wait—you should come with me. You can use Malik's ticket.”

This intentionally moves fast because immediate attraction is owner canon. The scene still needs visual acting—Brittney clocks the player, changes tone, and decides to invite them—so it reads as impulsive attraction rather than missing dialogue.

#### Player choice 1 — full support (+5)

**Player:** “That sounds incredible. I'm in. I'll meet you at my car when I'm done shopping.”

This is enthusiastic support for Brittney's goal and clearly deserves +5.

#### Player choice 2 — conditional support (+3), then a real fork

**Player:** “I'm in—but I promised to drop this phone in Issaquah. It's on the way.”

Brittney should not merely dislike the wording; she should identify the emotional problem:

**Brittney:** “No. I'm done letting his album hijack my plans. Me or the phone.”

Then give the player the meaningful follow-up:

- Choose Brittney / abandon or reroute the phone: earns additional Brittney support, intensifies Malik's later anger, and must carry a real album consequence.
- Keep the promise to Malik: Brittney may refuse to join, join with reduced trust, or require another persuasion beat. Do not award the same relationship outcome as choosing her.

Claude should not assume the point total for the second-stage choice; present a recommended score/effect table for owner approval because it changes both the Country and Hip-Hop arcs.

#### Player choice 3 — choose the artist promise (+0 Brittney)

**Player:** “Sorry. I promised Malik. Artist to artist, I can't ditch his album.”

This wording is valid only if the player previously identified as an artist. Otherwise use a promise-based variant without invented history:

**Player:** “Sorry. I gave Malik my word. I have to finish the delivery.”

**Brittney:** “Whatever, dude. We would've had a feral-ass time. Need anything else?”

Then the Sip-N-Go storefront opens. “Feral-ass time” is recommended over “sloppy-ass time”: it sounds more like contemporary party/FOMO language and is less likely to imply only intoxication or sex. If the owner prefers the original phrase, preserve it.

### Three additional StageWagon objectives for Brittney

These are the three best additions because each creates action, reveals character, and can pay off at the concert. They should supplement—not replace—the driving-care requests.

#### 1. The pre-concert supply run: drinks, ice, and responsibility

Brittney wants beer/party supplies before reaching Vantage because her friends expect her to arrive stocked. This creates a practical stop with relationship choices:

- Full support (+5): help her assemble a sensible concert kit—drinks, water, ice, food—and protect the schedule.
- Partial support (+3): buy only part of it or insist on a strict time/budget limit.
- No support (+0): refuse, moralize, or make her friends solve it.

Avoid making alcohol acquisition depend on illegal behavior. Establish that both characters are of legal drinking age if beer is explicitly purchased. The better joke is not “can we get away with buying beer?” but Brittney treating the cooler like a military logistics operation while forgetting water, ice, or a bottle opener.

Payoff at StageWagon: the prepared supplies help Brittney enter her friend group confidently; poor preparation creates an awkward but comic arrival and changes how she describes the trip.

#### 2. Reconnect with her friends and secure the meetup/campsite

Brittney needs to locate her friends before service deteriorates, gates close, or the group relocates. Her phone may be dying, damaged, out of data, or full of contradictory group-chat messages. The player helps her choose where/when to rendezvous.

- Full support (+5): stop safely, help charge/contact/navigate, and protect the agreed meetup.
- Partial support (+3): lend power/navigation while continuing to drive, accepting some risk of missing them.
- No support (+0): dismiss it as her problem or keep driving past the rendezvous.

This gives Brittney a social world beyond Malik and makes StageWagon concrete. Her friends can later validate or question the relationship she formed with the player. It also creates a clean source for contemporary language: **“If they move campsites again, my FOMO is going to become a medical condition.”**

#### 3. Shed the Gas-N-Go version of herself before arrival

Brittney left work impulsively in her uniform. She needs clothes, makeup/toiletries, or a safe place/time to change before meeting her friends and entering the concert. Treat this as identity and dignity, not a makeover imposed by the player.

- Full support (+5): protect her privacy/time and help recover or buy the one thing she says she needs.
- Partial support (+3): allow a rushed change but complain about the delay or budget.
- No support (+0): dismiss the need and force her to arrive visibly in work mode.

Payoff: her StageWagon arrival art changes subtly—confident and self-directed, improvised/mixed, or still wearing evidence of the shift she fled. This is a strong relationship panel because it shows whether the player treated her as a person rather than cargo.

### How these objectives form a real Brittney arc

The three objectives produce a clean emotional progression:

1. **Supplies:** does the player support what Brittney wants to do?
2. **Friends/meetup:** does the player respect the relationships and destination that matter to her?
3. **Change/decompress:** does the player respect Brittney herself when there is no gameplay reward for doing so?

Malik's North Bend confrontation then tests the accumulated pattern under pressure. Brittney's concert outcome should use both the numeric relationship score and specific remembered behaviors. A high score produced only by sexual/flirt answers should not be treated identically to a high score produced by reliability, protection, and respect.

### Additional dialogue-quality rule for Brittney requests

Current need dialogue leans too heavily on immediate sexual innuendo. Brittney can be openly flirtatious—that is owner canon—but every request should also reveal mood, history, taste, fear, humor, or changing trust. Use innuendo as seasoning, not the only personality signal.

Each request should contain:

- A concrete need.
- A line that sounds specifically like Brittney.
- A clue about how the ride is affecting her.
- Three responses that represent full support, partial support, and no support without making the “correct” button cartoonishly obvious.
- A later callback or montage effect when the request meaningfully shapes the relationship.

## Restart observation update — 2026-09-09, evidence only

Owner reports restarting is **much better**, but observed one restart after leaving the game inactive for more than 30 minutes and then resuming/playing briefly.

This pattern increases suspicion around the already-audited visibility-return path: after a sufficiently long hidden interval, current code manually calls `createResource()` for WebGL resource wrappers even when the context appears healthy. Recreating many large resources immediately after foregrounding could create a transient allocation spike and delayed OS termination/relaunch. The timing is consistent with that hypothesis, but one observation does **not** prove causality.

Before changing it, instrument one session to record:

- Hidden duration.
- Visibility/focus/pageshow events on resume.
- Whether the manual WebGL recreation branch ran and how many resources it touched.
- Texture count and estimated decoded bytes before background, immediately after resume, and 30–120 seconds later.
- `webglcontextlost/restored` events.
- A persisted resume marker so an unexplained next launch can be correlated with the previous foreground event.

Do not reintroduce broad reload-on-resume behavior. Do not assume the restart is fixed merely because frequency improved. This remains diagnosis/evidence unless the owner separately authorizes a code fix.

## Story canon update — Classic Rock, Malik/Dom'nique, and Country payoff (OWNER 2026-09-09)

### Classic Rock corrections and clarified direction

- The character's canonical name is **Mykenzie**. Replace/avoid “McKenna” in new story discussion, metadata, dialogue, and art briefs unless an old stable key requires compatibility handling.
- Mykenzie needs to reach her scheduled show and her expected ride has failed to appear. This urgency explains why she accepts help from a stranger and why she may tolerate a rude player response; she has heard worse and needs the ride.
- The player is already an established performer in game canon. The problem was not ability—the player could not book shows in Seattle. Therefore the ImprompTour offer is both transportation adventure and the player's first path into booked live performances. Dialogue should remind the player of that existing setup rather than treating singing as a sudden talent reveal.
- More Mykenzie/player dialogue should occur at rest stops, similar in frequency/function to Brittney's relationship interactions. Each exchange should build or damage the relationship and repeatedly force a choice between supporting Mykenzie and maximizing money/control.

#### Clarification of the prior “not enough variation” comment

The problem is not that solo/duet appears twice. Repetition can be excellent when the same question evolves. The current written choices at Washtucna and La Crosse are close to asking the same mechanical question twice without sufficiently different dramatic framing.

Keep both decisions, but make their functions distinct:

- **Washtucna: trust and generosity.** This is the first real proof of whether the player will share a stage and small payout with Mykenzie. The room is modest, the money is only $300, and the decision establishes the working dynamic.
- **La Crosse: identity and recognition.** By now audiences came for the act. The $400 solo / $800 duet decision asks whether the player publicly recognizes a partnership or uses growing success to reclaim the spotlight.

The later choice should explicitly remember the first. Examples:

- Solo twice: Mykenzie recognizes a pattern of being used as transport/backup.
- Duet twice: partnership feels earned and Colfax can refer to two shared stages.
- Solo then duet: a redemption/growth path.
- Duet then solo: a sharper betrayal because the player withdrew recognition once the money/audience grew.

This creates variation through changing stakes and memory, not by inventing a different button shape.

#### Partnership negotiation: what the earlier concern meant

The Colfax negotiation is **supposed** to carry enormous emotional weight; that is not itself a problem. It defines whether Mykenzie is a partner, marquee artist, hired voice, backup, or someone the player is exploiting. The weakness was that too much of the relationship leading to it occurred through performance choices and hidden score rather than enough private dialogue.

The owner-approved solution is additional rest-stop conversation. These scenes should explore:

- Whether the player values Mykenzie's voice or merely its earning power.
- Who selects songs, books rooms, pays costs, and gets credited.
- Mykenzie's frustration with Nan and unreliable people.
- The player's Seattle history: talented performer who could not get booked.
- Whether flirtation represents genuine affection, playful survival, or manipulation.
- How each character defines “our tour” before legal/payment language appears.

#### Does the negotiated partnership need another external test?

Not necessarily. The negotiation may itself be the culmination if the expanded rest-stop scenes and remembered Washtucna/La Crosse choices have already tested the relationship. Do not add a contrived betrayal simply because a structural checklist says “test the partnership.”

A short Pullman payoff is still needed so the agreement becomes visible:

- Who is named first on the marquee.
- Who speaks to the promoter.
- How the money is divided.
- Whether they enter the stage together.
- Whether Mykenzie corrects someone who calls her the player's backup singer.

That is payoff/confirmation, not necessarily a new crisis.

### Nan: make her stranger, less lucid, and clearly unsafe to drive

Owner direction: Nan is losing her mind, is not consistently lucid, and **should not be driving**. Her dialogue should be substantially more erratic and surprising. Comedy should come from confident discontinuity and Mykenzie's exhausted familiarity, while still allowing moments of affection or recognition so Nan is a character rather than only a diagnosis joke.

Potential dialogue behavior:

- Nan confuses the player with a former bandmate, mechanic, pastor, or granddaughter, then briefly becomes perfectly lucid.
- She offers contradictory directions while parked.
- She negotiates in obsolete prices or counts the same twenty twice.
- She remembers a song lyric or Mykenzie performance detail with startling accuracy while forgetting why she came.
- Mykenzie prevents Nan from resuming the drive, takes/confiscates the keys, or arranges a safe alternative. Do not let the story casually send an impaired Nan back onto the highway.

#### Medication-cookie event

Owner likes Nan giving them cookies into which she accidentally put her medication, causing the driver to experience the acid-like visual treatment formerly used in DUI.

Develop this as fictional slapstick and a gameplay hazard without naming or inaccurately depicting a real medication. Requirements:

- Nan offers homemade cookies during the Hatton scene.
- Seed one visible clue that something is wrong: odd pill-bottle rattle, Mykenzie questioning the recipe, Nan calling them “morning cookies,” etc.
- Give the player an actual choice to eat, save, share, or refuse; do not force an unknowable impairment as punishment without any tell.
- If eaten, the effect begins after returning to the road and uses the former DUI psychedelic/acid-like visual system if it can be restored without reintroducing unrelated DUI branding or broken code.
- The altered visuals need a finite, communicated duration and must remain playable/accessibility-safe. Reduced-motion mode needs a non-warping alternative.
- Mykenzie's reaction should depend on relationship: concern/help, irritation, teasing, or recognition that Nan mixed something into the batch.
- The event should confirm that Nan cannot safely drive and advance Mykenzie's family story, not exist solely as a random drug gag.
- Do not use the cookies as a full relationship test unless the player knowingly ignores a warning; accidental consumption should not itself make the player morally bad.

### Malik relationship arc — texts, record-store reunion, payout, and album reward

Malik remains active after Seattle through text/call checkpoints. Replying thoughtfully helps the relationship; ignoring him hurts it. “Reply” should not automatically mean the best outcome—the actual reply may reassure, challenge, lie, or inflame him.

Proposed contact sequence based on owner direction:

1. **Bellevue exit:** Malik asks whether the phone reached Brittney.
2. **After Issaquah:** Malik asks whether Kyle remastered the tracks.
3. **Issaquah favor/payment offer:** Malik asks the player to deliver the thumb drive and promises payment on completion.
4. **After North Bend / Dom'nique:** Malik calls after hearing from Dom'nique and asks the player to cut Dom out.
5. **Record-store reunion:** Malik meets the player, resolves payment, and gives the player his formative collection plus his new tracks. This becomes the player's Hip-Hop/Phonk genre album gain.

The contact UI should offer authored replies plus an explicit ignore/dismiss behavior. Ignoring must be distinguishable from temporarily closing the phone UI accidentally; do not penalize a missed input caused by an app close, interruption, or timeout without a clear choice.

#### Malik payout table — owner canon

All completed album-delivery outcomes give the player the Hip-Hop/Phonk album/collection reward. Cash depends on Malik relationship:

| Malik rating | Cash payout | Album reward |
|---:|---:|---|
| 0 stars | $0 | Yes |
| 1 star | Exactly enough to fill the player's current gas tank | Yes |
| 2 stars | $500 | Yes |
| 3 stars | $1,000 | Yes |
| 4 stars | $1,500 | Yes |
| Over 4 / 5 stars | $2,500 | Yes |

For 1 star, calculate “fill current tank” from current fuel missing × current fuel price and define rounding/cap behavior. Display the dynamic amount before/with payment so it does not look arbitrary.

The collection should feel personal: records/tracks that inspired Malik plus his newly remastered work. It is more emotionally effective than treating the genre unlock as a generic inventory grant.

### Malik ↔ Dom'nique relationship pull/pull

The core conflict is authorship, credit, loyalty, and money. Avoid a simplistic meter where every Dom gain automatically subtracts the same amount from Malik. Some choices should be genuinely zero-sum; harder truthful mediation should allow partial or full gains with both.

Use two independent relationships plus remembered flags:

- `malikRelationship`
- `dominiqueRelationship`
- `promisedDomCredit`
- `toldMalikTruth`
- `acceptedDomTape`
- `finalCredit`
- `bSidePressed`
- `liedToEither` / contradiction tracking

#### Scenario 1 — North Bend: hear Dom'nique out or dismiss him

Dom'nique presents evidence that Malik used his beat.

- **Back Malik without listening:** Malik +3, Dom'nique −5; quickest path, but locks out clean mediation and may make later evidence embarrassing.
- **Promise Dom credit immediately:** Dom'nique +5, Malik initially −3 when told; establishes an ethical commitment.
- **Listen without promising:** Dom'nique +3, Malik unchanged initially; preserves flexibility but risks looking evasive.
- **Tell them to settle it themselves:** 0 or negative with both; live-only avoidance should have a real later cost.

The evidence must be visually understandable so the player is not making an ethics choice based only on accusation text.

#### Scenario 2 — Malik's post–North Bend call: cut Dom out, confront Malik, or mediate

Malik asks the player to exclude Dom'nique. Recommended branches:

- **Obey Malik:** “Your record, your call.” Malik +5, Dom'nique −5, maximum immediate Malik loyalty but worse authorship outcome.
- **Confront Malik:** “It's his beat. His name goes on it.” Dom'nique +5, Malik −3 initially; may recover Malik points if the final record succeeds.
- **Mediate:** “Your song stays yours. Dom gets producer credit. Nobody takes your money.” Malik +5 if his key concern is payment/ownership; Dom'nique +3 (“half win”) because he gets credit but no producer payment or ownership share.
- **Demand a real split:** “Credit and a cut, or I don't deliver it.” Dom'nique +5, Malik −5 initially, but unlock a best ethical/collaborative ending if Malik later accepts.
- **Lie:** tell Malik Dom was dropped while promising Dom credit. Short-term gains with both, severe penalty when the pressed label exposes the contradiction.

This encodes the owner's proposed favorable Malik outcome: he keeps his payment/ownership, ultimately accepts Dom'nique's producer credit, gains +5, while Dom receives a partial relationship win rather than everything requested.

#### Scenario 3 — Dom'nique's tape: cargo, courtesy, or leverage

When Dom offers his ten-track tape:

- **Carry it openly and tell Malik:** Dom +5, Malik may respect honesty (+1/+3) even if annoyed; unlocks legitimate B-side discussion.
- **Carry it secretly:** Dom +3 initially; Malik −5 if discovered; creates contradiction payoff.
- **Decline but keep the credit promise:** Dom relationship unchanged or +1; preserves main delivery safety.
- **Use it as leverage against Malik:** potential cash/control gain, relationship loss with both.

The tape should add cargo risk or another real responsibility so accepting every item is not an automatic optimal choice.

#### Scenario 4 — Snoqualmie pressing: write the truth onto the object

The label/B-side decision is the irreversible proof of what the player chose:

- Malik-only credit: high Malik short-term outcome, Dom betrayal.
- Stank Records ownership credit: institutional loyalty, potentially weaker personal outcomes.
- Malik artist + Dom'nique producer: mediation outcome.
- Malik artist + Dom producer + Dom B-side: strongest collaborative/expanded album outcome if the tape survived.
- Dom-dominant or altered credit: only if story evidence and owner direction support it; do not silently erase Malik's authorship while correcting beat credit.

Show the printed label clearly in the comic. Later dialogue must read the actual pressed credit, not merely the earlier promise.

#### Scenario 5 — record-store resolution matrix

At the final reunion, cash follows Malik's star table, while the album version and relationship payoff reflect both characters:

- **High Malik / low Dom:** full Malik collection and cash, but a morally compromised or Malik-only pressing; Dom offers no future support.
- **Low Malik / high Dom:** little/no Malik cash, base Hip-Hop/Phonk album still granted per owner rule, plus Dom's underground/B-side material if earned.
- **Medium/high both through honest mediation:** best collaborative edition—Malik's inspirations, remastered album, correct producer credit, and Dom B-side if carried. Cash still follows Malik's rating rather than receiving an arbitrary bonus.
- **High both through a lie:** cannot remain a best ending once the printed label reveals the contradiction; apply delayed relationship loss.
- **Low both:** base album reward, minimal cash, no personal endorsement/support, and a colder comic ending.

Dom'nique's relationship may also control non-cash help so the two meters are not both merely payout sliders:

- North Bend warning/support during Malik's chase.
- One or more guaranteed weapon pickups or tactical advice, if narratively justified.
- B-side/underground tracks added to the album.
- A later safe stop/contact in North Bend.
- Producer liner note or comic epilogue acknowledgement.

Do not let relationship grinding through texts erase a major betrayal at the label. Use milestone flags as gates/modifiers alongside star totals.

### Brittney Country reward and checkpoint

If treated well, Brittney buys/gives the player a Country mix/album made from her favorite music. This is the Country genre-album gain and should feel personal, paralleling Malik's collection reward.

Recommended timing: **at or immediately after successful StageWagon arrival**, once her friends/party goal has visibly paid off. Giving it before the outcome weakens its meaning. A very high relationship can turn it into a hand-picked mix with a personal title/note; a merely successful ride can grant a more casual compilation.

Use fictional artists/tracks unless the project has licensed music rights. The reward art can show a mixtape/playlist/album object without naming real contemporary songs.

StageWagon is also a strong **mid-game celebration and checkpoint**:

- Commit story/relationship/genre progress before entering the celebration.
- Show Brittney reunited with friends and the consequences of the supply/meetup/clothing objectives.
- Give the player a clear celebratory beat rather than immediately returning to driving UI.
- Checkpoint restoration must return to a stable post-arrival state, not replay the reward or duplicate relationship/cash effects.
- Whether low-relationship completion still grants a basic Country album or only high treatment grants it remains an owner decision; Claude should present a reward table before implementation.

### Next writing priority

Owner will return to Classic Rock later. For now:

1. Preserve these Classic Rock corrections; do not continue treating the existing structure as invalid.
2. Develop the Malik/Dom'nique choice matrix and ensure actual graph order supports it.
3. Rework Brittney request dialogue and StageWagon objectives.
4. Draft the StageWagon celebration/checkpoint and Country reward tiers for owner review.
5. Do not implement Nan's cookie effect until the old DUI visual system is audited for branding, accessibility, and current compatibility.

## Hip-Hop continuity + Brittney Ellensburg friend — OWNER CLARIFICATIONS 2026-09-09

### Brittney objective selected: find/pick up her friend

The owner prefers the friend-reconnection idea. Develop it into a real Ellensburg pickup:

- One of Brittney's friends needs to be picked up in Ellensburg on the way to StageWagon.
- **Owner-fixed identity (2026-09-10): Brittney's Ellensburg friend is named Haylee and is a strawberry blonde.** Preserve the exact spelling **Haylee** and this visual trait in the character profile, reference sheet, NPC portrait, story art, comic panels, dialogue keys, and all later image prompts. Do not silently rename her or change her to blonde, redheaded, brunette, or another design.
- How the player treats the friend affects how Brittney feels about the player.
- This is not merely another errand meter. It reveals whether the player respects Brittney's social world when there is no direct cash reward.
- The friend should observe and react to the player/Brittney dynamic, giving Brittney an outside perspective rather than making her feelings entirely score-driven.
- Relationship outcomes should remember specific conduct: welcoming the friend, helping with belongings, flirting inappropriately, complaining about time, refusing the pickup, reckless driving, or treating the friend as an inconvenience.
- The friend's presence can make Malik's later anger/chase funnier and more socially charged, but the friend needs dialogue/reaction during danger rather than disappearing.

Before drafting, Claude should ask/propose: the friend's name, age, personality, visual identity, reason for being in Ellensburg, seat/cargo needs, knowledge of Malik, whether she witnesses the ambush, and the exact +5/+3/+0 behaviors.

### Kyle returns both phone and thumb drive

Owner correction: Kyle does **not** keep Malik's phone. At Issaquah he remasters/backups the tracks, gives the phone back, and also gives the player the thumb drive.

- Malik's original phone remains narratively meaningful and must eventually be returned.
- The remastered thumb drive becomes the important production/delivery object.
- Revise any dialogue claiming “the phone stays with me.”
- The phone is not important to Kyle after the remaster is complete.

### Vantage ambush trigger and authorship

Owner canon:

- The Vantage ambush occurs only when the player **skipped Issaquah and did not give the phone to Kyle**.
- Immediately before it, the phone lights up with Malik's name and a threatening text.
- Malik sent the three Hip-Hop/Phonk cars—his “dogs”—in revenge for the apparent theft.
- Afterward, a note communicates **DON'T STEAL FROM MALIK**.
- Malik knows about the attack because he arranged it. Do not preserve ambiguity suggesting coincidence.
- The story need not state whether Malik previously knew the beat was Dom'nique's. Leave that unconfirmed; what matters is how he responds when confronted.

Owner's proposed pre-ambush text:

> **“I just sent the dogs after you. Woof.”**

This explicitly identifies Malik as the organizer. If the goal is for the player to connect the text and note, a less literal alternative is:

> **“You missed Issaquah. My dogs are already on the road. Woof.”**

Use either direct attribution or clue-based attribution. Do not use both plus explanatory narration, which would repeat the same fact three times.

### Return-to-Issaquah recovery: recommended model and required clarification

The post-ambush return to Issaquah allows recovery of the failed Hip-Hop mission. Owner language says to rewind that mission until Issaquah and erase choices made past Issaquah.

A global rollback would also erase Dom'nique at North Bend, Snoqualmie credit/pressing, Cle Elum cargo/delivery, the Ellensburg friend pickup, relationships, purchases, cash, damage, inventory, and other unrelated world events. It could create time-travel logic and repeat-reward exploits.

Recommended interpretation:

1. Player physically turns/warps back to Issaquah after surviving the Vantage ambush.
2. Preserve that the ambush occurred in story/comic history with an 'ambushSurvived' flag. Characters do not forget it.
3. Reset only the **failed Hip-Hop delivery branch** to the Issaquah opportunity.
4. Preserve unrelated Country/relationship/world choices unless logically impossible.
5. Kyle remasters the tracks and returns phone + drive.
6. Mark the skip/theft ambush resolved so it cannot repeat.
7. On the second Vantage pass, use a small callback such as snow tracks or “QUIETER THIS TIME,” rather than replaying the chase or pretending it never occurred.

If the owner truly wants all post-Issaquah choices erased, Claude must first inventory reversal of cash, items, cargo, relationships, purchases, damage, comic panels, checkpoints, and one-time rewards.

**Owner decision still needed:** does “choices past Issaquah are erased” mean Hip-Hop mission choices only (recommended), or the entire world/run timeline?

### Calling Malik out over Dom'nique's beat

Owner canon: the player calls Malik out. **How** he does it determines the relationship result. Once evidence is established, “ignore forever” should not count as a complete ethical resolution.

#### Constructive/private

**Player:** “Dom played me the original. It's his beat. Credit him and keep your song.”

- Gives Malik a face-saving path.
- Malik can accept producer credit without surrendering artist ownership/payment.
- Malik +5 if he accepts; Dom +3 if credit comes without money, or +5 if a later fair cut is included.

#### Firm ultimatum

**Player:** “His name goes on the record, or the drive doesn't reach the presser.”

- Dom +5.
- Malik drops initially because the player uses delivery as leverage.
- Some Malik trust can recover if the record succeeds and the player remains honest.

#### Accusatory/public

**Player:** “You stole Dom's beat and called yourself number one. Fix it.”

- Truth delivered badly; Malik loses more because humiliation is added.
- Dom may appreciate defense but dislike becoming a public spectacle.

#### Transactional / Malik-favorable mediation

**Player:** “Give Dom producer credit. You keep the song and the money.”

- This matches the owner-described favorable Malik outcome.
- Malik +5 on acceptance.
- Dom +3/half win: public credit, but no payment/ownership share.

#### Deceptive

Player tells each man what he wants to hear. Temporary gains collapse when the pressed label exposes the contradiction. This must not remain the best ending merely because the player accumulated text-message points.

Possible Malik response without declaring what he knew:

> **“You calling me a thief now, or you calling the record wrong?”**

Artist/fan callback:

> **“You said you were an artist. So tell me—whose name belongs on my record?”**

The player can distinguish ownership of the song/performance from authorship of the beat. Malik need not have known originally, but becomes responsible for what he does after learning.

### Remaining information that would materially help

1. **Rollback scope:** Hip-Hop-only mission reset or literal whole-run rollback.
2. **Phone/drive destination:** after Kyle returns both, who receives each and at which stop?
3. **Ambush failure:** what happens if the player cannot land three hits or is destroyed?
4. **Malik/Brittney status:** explicitly exclusive, effectively breaking up, or already considered over by Brittney?
5. **Brittney's friend:** identity, Malik connection, seat needs, and whether she witnesses the ambush.
6. **Dom'nique's desired remedy:** credit, royalties, ownership share, B-side, apology, or a combination?
7. **Malik's desired final credit:** artist name, Stank label, exclusive beat credit, or payment/control?
8. **Final record store:** is it Spin Cycle, who owns it, and why is Malik there after sending attackers?
9. **Reconciliation ceiling:** can Malik return to five stars after ordering the ambush?
10. **Country reward threshold:** base album for every successful arrival, or only when Brittney is treated well?

Claude should propose defaults rather than blocking all drafting, but flag defaults that change endings, rewards, or cross-story continuity.

## Vantage recovery correction — OWNER TIMELINE + CURRENT-CODE FINDING 2026-09-09

This section corrects the earlier rollback concern.

### Correct branch chronology

If the player chooses Brittney at Mercer, Malik's phone is left on Mercer Island and the Hip-Hop mission resets/ends for that run. The player can then carry Brittney and later pick up her Ellensburg friend.

If the player keeps Malik's delivery:

- Brittney remains at Mercer; neither Brittney nor her friend is in the car.
- Passing Issaquah locks Malik's phone and removes the temporary Hip-Hop/Phonk radio access.
- Because the music no longer plays, Dom'nique does not hear Malik's track at North Bend.
- Therefore the skip-Issaquah ambush branch has no Dom'nique, Snoqualmie credit, Cle Elum record, Brittney, or Ellensburg-friend choices to erase.

The owner's mission rewind is consequently much narrower and safer than previously inferred. It restores the player to the missed Issaquah opportunity on the phone-delivery path; it does not need to reverse Country or Dom'nique history because those branches never occurred.

Claude must encode these gates explicitly and test that mutually exclusive branches cannot leak into one another:

- Locked phone → no granted Hip-Hop playback.
- No playback → no Dom'nique recognition encounter.
- Phone left at Mercer → no Vantage theft ambush.
- Brittney passenger path → no simultaneous Malik-phone delivery inventory.
- Issaquah completed → no skip ambush.

### What the current “U-turn” actually does

Current production code does **not** render a U-turn:

- The old ambush kills the player and opens 'GameOverScene'.
- A 'BACK TO ISSAQUAH' button commits 'vantage_recovery.warp'.
- It teleports the run to 'ISSAQUAH_WARP_MILE', currently 17.5 miles / approximately half a mile before the exit.
- 'GameOverScene._restartAtCheckpoint()' passes 'crashRestartScore', so the normal wreck/pass-out retry rule halves cash.
- The player then drives east again.
- The old code unlocks the phone as soon as the warp choice is committed.

That behavior was designed for “rammed until dead.” It conflicts with the newer owner direction where the player lands three weapon hits, Malik's final car spins into the snow, and the player survives.

### Recommended new presentation: cinematic turnaround, not simulated westbound driving

The road game is authored as eastbound progression. Do not attempt to make the player steer west for roughly 120 miles through reversed traffic/scenery merely to literalize a U-turn.

After the player defeats the three cars:

1. Hold on Malik's final car spinning harmlessly into the snow.
2. Show the locked phone and the 'DON'T STEAL FROM MALIK' note/aftermath.
3. Present a choice:
   - **TURN BACK TO ISSAQUAH — Finish what you promised**
   - **KEEP GOING — End Malik's mission**
4. If TURN BACK is selected, show a short three-panel travel transition:
   - Player/car at the snowy roadside, looking west.
   - A clean map line animating from Vantage back toward Issaquah.
   - Caption: **120 MILES WEST · ONE VERY QUIET DRIVE**
5. Fade through the horizontal loading screen.
6. Resume approximately 0.5 mile before the Issaquah exit with the phone still locked.
7. The phone unlocks only when the player takes/reaches the correct Issaquah handoff, not merely because a menu button was pressed.
8. After Kyle remasters and returns phone + drive, mark the ambush resolved. It must not repeat on the next eastbound pass.

Preserve the ambush in comic history. The mission state rewinds; the character/player memory does not.

### Recommended penalty

The return already imposes a substantial natural penalty: the player must replay the eastbound route from Issaquah to Vantage and has delayed the delivery. Do not stack the old arbitrary half-cash crash penalty on top when the player actually won the chase.

Recommended consequences:

- Preserve damage sustained during the ambush.
- Preserve weapons/ammunition consumed during the ambush.
- Preserve Malik's relationship loss for skipping Issaquah; returning permits recovery but does not erase the betrayal.
- Add an in-world time penalty for the westbound return montage, approximately the route's believable travel time. Claude should reconcile the exact minutes with the game's compressed clock and ending schedule.
- Resume with the player's existing cash—**no automatic 50% cash loss**.
- Do not simulate invisible westbound fuel consumption if it would strand the player immediately on arrival. The re-driven eastbound distance already consumes fuel and player time. If a fuel penalty is desired, show and cap it explicitly, with a guaranteed reachable fuel stop.
- Reduce the best possible Malik cash outcome only if the relationship system naturally produces that result; do not add a second hidden payout punishment.

If balancing shows that replaying Issaquah → Vantage is excessively long, use a shorter authored recovery segment/checkpoint after Kyle rather than deleting the ambush from memory. Never replay the three-car attack after the phone was properly remastered.

### Answer to “should the player start again from Vantage and forget the cars?”

No. Starting at Vantage and pretending the attack never happened makes “return to Issaquah” meaningless and breaks the comic's cause/effect. Better:

- The player remembers and the comic retains the attack.
- The failed Hip-Hop delivery resumes at Issaquah.
- The player repeats only the necessary eastbound route.
- The resolved ambush does not fire a second time.
- A small second-pass Vantage callback may acknowledge the prior fight without another chase.

### Seattle opening — REVISED DRAFT v2 (Claude, 2026-09-09, red-pen + owner addition applied)

Accepting the six-beat structure and every markup point, with two code-truth corrections:

- **Phone lock (code, `featuredStories.js` ~262–273):** skipping Mercer only sets
  `skippedMercer`; the phone LOCKS when the player passes **Issaquah** still holding it
  (Kyle never touched it) — `phoneLocked`, radio grant revoked, −30 relationship.  There is
  no check-in.  So Malik must NOT say "the phone checks in at Mercer" or "skip Mercer and it
  locks."  Truthful line: **"Get it to Kyle. Blow past Issaquah with it and it locks itself."**
  Mercer stays the *handoff* (Brittney), Issaquah the *safeguard*.
- **The player's art carries a guitar case** (`seattle_05_refuse_job.png`, and the reference
  sheet) — the fan/fellow-artist branch can honestly mean *musician* without a questionnaire.

#### Beat 1 — `seattle_lot` · establish · WIDE · `seattle_01_freestyle_circle.png` · comic: true
- Hype: "Malik Reed! Stank Records — live from the Park & Ride!"
- Malik (performance, one utterance, split at the dash):
  "Top of NoiseCloud, bottom of my tank — / whole city knows the hook, but the bus driver knows my name."
- Crowd (SFX-small): "AYYYY!"

#### Beat 2 — `seattle_clock` · setup · ORDINARY · `seattle_02_crew_confrontation.png` · comic: false (setup inset only if the artist flag pays off)
- Malik: "That your ride? Those plates ain't from around here."
- Malik: "You headed east? Over the pass?"
- Player (three non-consequential responses; all continue; sets flags):
  - **Fan / fellow artist** → `flags.playerArtist = true`, Malik trust +5 (rel):
    "Malik Reed? I follow your work. I'm an artist too."  → Malik: "Then you know what a Friday press deadline means."
  - **Neutral / route**: "Pullman. Eventually."  → Malik: "Then Mercer's already on your way."
  - **Guarded**: "Who's asking?"  → Malik: "Malik Reed. You just heard the best verse in this lot."
  (Guarded is the comic-book branch if Beat 2 is ever printed — it yields the self-introduction.)

#### Beat 3 — `seattle_stakes` · setup · WIDE · NEW art (brief A) · comic: true
Information order: risk → tonight → why not him → why this player → why the leg is controlled.
- Malik: "My whole album's on this. One clean copy."
- Malik: "Kyle remasters it in Issaquah. The presser needs it Friday."
- Malik: "Brittney was running it, but she's stuck on shift at Mercer."
- Malik: "I headline at midnight. You're already going east."
- Malik: "Mercer's five miles. Brittney takes it from there."
Placement: four balloons across the upper-LEFT and upper-RIGHT (not one band); the optional
player thought "One copy. On a phone. Sure." moves to Beat 4.  If protection fails, split
into two panels of the same scene (phone/stakes · Malik looking at the plates).
On the fan/artist branch the same lines play; Malik is not more explanatory — the trust is
already in the room.

#### Beat 4 — `seattle_offer` · decision · ORDINARY · `seattle_03_phone_handoff.png` · comic: true — KEYS UNCHANGED
- Malik: "Run it to Brittney. She takes it from there."
- Player thought (optional, small, lower-left): "One copy. On a phone. Sure."
- `carry`: "I'm going right past Mercer. Give me the phone."
- `pass`:  "I don't carry other people's problems. Good luck with the album."

#### Beat 5a — `seattle_terms` (carry) · consequence · ORDINARY · `seattle_04_radio_explanation.png` · comic: true
- Malik: "Get it to Kyle. Blow past Issaquah with it and it locks itself."
- Malik: "Till then, Stank Records owns your radio."
- Crew (small shout): "Don't scratch the screen!"
(Retires the old 30-word `carry` reply; old saves keep it as fallback copy.)

#### Beat 5b — `seattle_walkoff` (pass) · consequence · ORDINARY · REUSE `seattle_05_refuse_job.png` · comic: true
Crop test done by eye 2026-09-09: the image has a clean sky/skyline band between the
player (left third, face y≈15–45%) and the crew (right third, faces y≈20–40%) — room for one
balloon top-centre-right and an off-panel shout lower-right without touching a face, the
guitar case, or the phone in Malik's hand.  **Brief B withdrawn.**
- Malik (flat): "Aight. Somebody else'll want the plug."
- Crew (off-panel shout, lower right): "WEAK!"

#### Beat 6 — `seattle_pullout` · travel · NARROW · comic: true (carry) / caption-only on pass
- Carry: NEW art (brief C-carry) — phone glowing in the cupholder; caption "EAST ON I-90 · MERCER ISLAND 5 MI".  Object motif that recurs when the phone locks/buzzes ("told you").
- Pass: no new art — the travel caption rides the refusal aftermath (or a reusable road/mirror panel if the transition tests abrupt).  **Brief C-pass withdrawn.**

#### Artist-flag payoffs (so it isn't fake personalization) — proposals, not wired
1. Issaquah (`issaquah_kyle`), on `playerArtist`: Kyle adds "Malik said you make stuff too. What's your thing?" — player may name a discipline or deflect (non-consequential).
2. Cle Elum delivery outcome line, on `playerArtist` + pristine/damaged: "the artist who saved the record" / "You said you were an artist. You knew what that copy meant."
3. Malik relationship strip caption variant.

#### Revised new-art priority
1. **Brief A — stakes/phone (WIDE)**: Malik holding the cracked phone up between himself and
   the player; crew soft behind; the player's car nose + PLATES in frame right (he clocks
   them).  Negative space upper-left AND upper-right; phone + Malik's face clear of the lower
   35% and visible with/without the tray.  Emotion: urgent, not pleading.
2. **Brief C-carry — phone in the cupholder (NARROW 2:3)**: dash at night, phone glowing,
   road ahead; top 30% clear for the caption.  May be built from an existing dash/road
   asset if one honestly fits.
3. Brief B — withdrawn (reuse `seattle_05`).  4. Brief C-pass — withdrawn.

#### Mercer continuity — answered from code where it already exists (for the Mercer draft)
- Does Brittney expect the player?  Code: "Malik sent you? Of course he did." → the stranger
  is a mild surprise, the errand is not.  Keep.
- Why was she the runner if she's on a double?  Code: "They JUST put me on a double" — the
  double is new tonight; Malik didn't know.  Beat 3 says "stuck on shift" — consistent.
- "My girl": the `ride` choice says "that boyfriend" and her reply "My boyfriend can lick
  someone else's butt" → **romantic**, and she's over him.  Malik's Beat 3 wording keeps
  "Brittney" neutral so nothing contradicts.
- What she knows: the Issaquah engineer (yes), the deadline (implied), the lock (unknown —
  propose she does NOT know; the player learns it from Malik only).
- On `ride`, what makes her trust the player?  Open — owner/Chat call for the Mercer draft.
- On `keepJob`, closing the obligation: existing reply + "You definitely missed out on a fun
  copilot" already does it; the album momentum continues to Issaquah.

#### Still open (owner / Chat)
- Approve v2 copy as final so I can settle node ids (renames change dialogue keys).
- Confirm "artist" stays broad, or name it "musician" given the guitar case.
- Mercer next, then review Seattle→Mercer as one strip before implementing the slice (Chat's sequence) — agreed unless the owner says otherwise.

## Chase correction — OWNER 2026-09-09 (supersedes the prior U-turn recommendation)

ChatGPT/Codex incorrectly conflated two separate encounters. **Discard the “cinematic turnaround after Malik spins out” recommendation.**

### Encounter A — Malik personally chases the player after North Bend

- This chase is Malik alone, driving the Hip-Hop/Phonk vehicle.
- It occurs after North Bend in snow or rain.
- It is separate from the later three-car Vantage punishment.
- The player lands three successful weapon hits on Malik.
- Malik's vehicle spins out/crashes in the snow and stops pursuing.
- The player continues east. There is no reason to return to Issaquah merely because Malik crashed.
- Do not show the 'BACK TO ISSAQUAH' recovery choice after this encounter.

### Encounter B — Malik's three cars attack near Vantage

- This is the skip-Issaquah punishment branch.
- Malik is not personally one of these three cars.
- It occurs only when the player kept Malik's phone, skipped Issaquah, allowed it to lock, and continued toward Vantage.
- This branch has no Brittney passenger, Ellensburg friend, or Dom'nique encounter, as documented above.

### Hospital consequence replaces the U-turn recommendation

After the relevant player car accident, the owner wants the player to wake in the **Ellensburg hospital** with:

- **50% health**.
- A sizable hospital bill that takes **all current money**.

This is a strong visible penalty and is preferable to an unexplained U-turn plus a generic 50% cash reduction. The hospital provides a concrete consequence, a comic transition, and a believable recovery point west of Vantage.

Suggested presentation:

1. Impact/blackout panel.
2. Black or white transition with muffled medical dialogue.
3. Hospital panel: player wakes in Ellensburg.
4. Status caption: 'HEALTH 50% · CASH $0'.
5. Bill/receipt gag establishing where the money went.
6. Player resumes from an Ellensburg-area checkpoint with the ambush marked as already experienced so it cannot immediately repeat.

Do not silently reuse the old 'BACK TO ISSAQUAH' button, warp explanation, or crash-retry half-cash rule. The owner has replaced that concept with a hospital recovery that removes all current cash.

**One continuity point remains to confirm:** this note currently assumes the hospital follows the three-car Vantage ambush/player wreck, while Malik's personal North Bend chase ends with Malik crashing and the player continuing. If the owner instead intends the North Bend chase to wreck both cars and send the player to the hospital, update the trigger explicitly before implementation.

### REQUIRED NEW ART — Ellensburg hospital recovery

Owner decision: create new artwork showing the player waking in the Ellensburg hospital while holding a **heavy hospital bill**.

#### Narrative purpose

- Makes the all-cash penalty visible and understandable rather than silently changing the HUD.
- Confirms that the player survived the wreck but paid a severe price.
- Establishes Ellensburg as the recovery location.
- Creates a darkly comic breath after the violent Vantage ambush.
- Provides the permanent comic with a clear consequence panel.

#### Primary art brief

- **Proposed key:** 'hiphop.vantage_hospital.wake'
- **Filename proposal:** 'ellensburg_hospital_01_player_wakes_with_bill.png'
- **Story role:** aftermath / consequence.
- **Comic inclusion:** required.
- **Priority:** major.
- **Preferred composition:** WIDE 16:9 source, composed so it can also tolerate an ordinary crop.
- **Location:** modest Ellensburg hospital room, morning or washed-out daylight after the nighttime/poor-weather wreck.
- **Player:** awake but battered in a hospital bed, visibly confused and sore; bandage, bruising, or medical monitoring may communicate 50% health without making injuries graphic.
- **Main action:** player holds an absurdly substantial itemized hospital bill. It should look physically heavy—a thick accordion-fold statement, long cascading printout, or dense stack of pages pulling the player's hands downward.
- **Expression:** first disbelief, then exhausted recognition that the bill has taken everything.
- **Comedy:** grounded visual exaggeration. The bill may continue over the bedrail or pool onto the floor, but the scene should still feel like a real consequence rather than a pure fantasy cutaway.
- **Continuity objects:** damaged personal effects/clothing from the wreck may sit nearby. Do not show Malik, Brittney, her friend, or Dom'nique; this locked-phone ambush branch does not include them.
- **No baked dialogue, dollar figure, logo, hospital name, or UI text in the art.** Render bill wording/status as comic/UI overlays so the actual cash amount and localization remain dynamic.

#### Composition and protected regions

- Keep the player's face, both hands, and the recognizable mass of the bill visible.
- The bill is a story-critical object and receives its own high-priority 'protect' box, not merely part of the player's body box.
- Preserve recognizable hospital context: bedrail, monitor/IV or wall fixture, and daylight/window or room signage without using real institutional branding.
- Leave usable negative space in the upper-left or upper-right for a location/time caption and one short balloon.
- The lower 30–35% may be covered temporarily by the live response tray. Do not place the player's face or the only readable portion of the bill exclusively in that region.
- Prefer the player in the middle-left or middle-right third rather than dead center, allowing balloon placement opposite the face.
- Avoid cropping the end of the bill so tightly that it looks like an ordinary single sheet.

#### Suggested overlay copy

Location caption:

> **ELLENSBURG GENERAL · SOME TIME LATER**

Status caption:

> **HEALTH 50% · CASH $0**

Player options for a short reaction balloon:

- **“Do I own the hospital now?”**
- **“This bill has chapters.”**
- **“Malik could've just asked for the phone back.”**

Use only one reaction in the final panel. The third line connects cause and consequence most clearly; the first two are broader visual jokes.

#### Optional second panel — only if pacing needs it

A narrow follow-up may show the bill unrolling past the bed and a discharge nurse waiting with a clipboard. Do not commission it automatically. First test whether the single wide panel plus captions lands the consequence; one strong panel is preferable to redundant hospital art.

#### Runtime consequence attached to this beat

- Set health to exactly 50% of the applicable maximum.
- Set current cash to $0 and display the loss as a hospital charge.
- Preserve other inventory/state unless separately damaged/lost by an authored ambush rule.
- Mark the Vantage three-car ambush as experienced/resolved so hospital resume cannot loop directly back into it.
- Resume from the intended Ellensburg-area checkpoint only after the hospital beat and status consequence are committed idempotently.
- Reopening an old save or comic must not charge the hospital bill a second time.

### Owner addition — Malik checks in by PHONE when Brittney doesn't get in the car (2026-09-09)

Owner: "The phone might not check in, but Malik checks in on the phone if Brittney doesn't
get in the car. He thinks he's calling Brittney, but is a little surprised to hear Player."

So the safeguard is Malik, not software: on the `keepJob` path (Brittney stays on her double)
the phone RINGS in the car after Mercer.  Malik expects Brittney's voice and gets the
player's.  This is a new post-Mercer road beat, it belongs in the permanent comic
(it's a decision→consequence pair with `keepJob`), and it uses the **phone/radio balloon**
(squared body, zig-zag tail) — first appearance of that balloon type in the book.

Draft (red-pen please) — `mercer_malik_call` · consequence · ORDINARY · road beat ≈ mile 11
(East Channel Bridge, just after the Mercer exit) · art: NEW brief D · comic: true
- Caption: "EAST CHANNEL BRIDGE · MILE 11 — the phone in the cupholder lights up: MALIK"
- Malik (phone balloon): "Britt? You in the car?"
- Player: "It's the driver. She kept her job."
- Malik (phone balloon, beat): "…Aight. Then it's on you now."
- Malik (phone balloon): "Kyle. Issaquah. Don't make me call twice."
On the `playerArtist` flag, swap the last line for: "You said you were an artist. Act like it."

Does NOT fire on the `ride` path (Brittney is in the car and answers herself — optional
tiny live-only beat: she declines the call: "Not tonight, Malik.").  Does NOT fire on
`pass` (no phone).  If the player skips Mercer entirely with the phone (`skippedMercer`),
the same call fires with a different first line — "Britt says you never showed." — and
this is where the Issaquah lock warning is repeated, so the code's real lock trigger
(passing Issaquah) is set up by a voice, not a rule.

Brief D — `mercer_05_malik_call` (ORDINARY 16:9): interior at night on the bridge, the phone
lit in the cupholder with MALIK on screen, the player's hand hovering, Seattle skyline
falling away in the mirror.  Upper half clear for three phone balloons (upper-right stack)
+ the player's line upper-left; phone must stay visible below the balloons and above the
tray band.  Alternative if no new art: reuse `vantage_00_locked_phone_in_car.png` cropped to
the phone (it is the same object motif) — test before commissioning.

Wiring note: this is a ROAD beat (like the Vantage ambush), not a rest-stop tile — it needs
a road-event emission site (mile trigger + flag guards) and the live strip's phone-call
presentation; the existing texts/`_showTextMsgBox` HUD could carry the live version until
the strip exists.

## Seattle V2 dialogue correction — OWNER 2026-09-10

**Canonical Mercer store name confirmed from the production icon and code: 'Gas-N-Sip'.** The actual logo reads 'GAS-N-SIP'; existing business labels, storefront assets, Brittney uniform references, and featured-story data agree. Replace draft uses of 'Sip-N-Go', 'Sip and Co', or other variants with **Gas-N-Sip**.

The player should identify specifically as a **musical artist/songwriter**, not use the broader “I'm an artist too.” This removes ambiguity, agrees with the player's established performer history and guitar-case artwork, and gives Malik a credible personal connection.

Owner-preferred core exchange:

> **Player:** “I don't know you, no offense. I'm sure you haven't heard any of my songs either.”
>
> **Malik:** “Fair enough. As an artist, you know how important this phone is to me…”

Recommended final ordering preserves that meaning but makes the logic land in sequence:

1. **Malik:** “Malik Reed. Stank Records. About to be the biggest hip-hop name in this town.”
2. **Player:** “I don't know you, no offense. I'm sure you haven't heard any of my songs either.”
3. **Malik:** “Fair enough. Which way you headed?”
4. **Player:** “Pullman. Eventually.”
5. **Malik:** “Then Mercer and Issaquah are already on your way.”
6. Malik explains that his whole album/only clean copy is on the phone, Kyle must remaster it, and the presser needs it Friday.
7. **Malik:** “Then, artist to artist, you know how important this phone is to me.”

This ordering provides Malik with three reasons to select the player:

- The player writes/performs songs and understands the value of irreplaceable work.
- The player is already traveling east toward Mercer and Issaquah.
- The first requested leg is short and the phone locks if the player passes Issaquah.

Do not retain a separate “fan” assumption in this branch. The player explicitly says they do **not** know Malik's work. The connection is peer-to-peer artistic understanding, not fandom.

Set/rename the stable flag accordingly—prefer a concept such as `playerMusician` over generic `playerArtist` if it will not break existing planned references. If `playerArtist` is already the settled compatibility key, its authored meaning here is “musical artist/songwriter,” and dialogue should consistently reflect that.

The earlier V2 guarded reply—“Malik Reed. You just heard the best verse in this lot.”—is superseded by this complete exchange. Also remove the pending question about whether “artist” should remain broad; the owner has now made the player's songs explicit.

## Seattle v3 + Mercer sequence + Haylee profile — Claude, 2026-09-10 (drafts; nothing implemented)

Authority applied: the **2026-09-10 Seattle correction** (musician exchange, Gas-N-Sip) and
the **2026-09-10 Haylee identity** override everything earlier they touch, including my v2
and the 09-09 "fan / artist" section.  Branch gates from "Vantage recovery correction" are
treated as canon (phone delivery ⟂ Brittney passenger; locked phone ⟂ Dom'nique; phone left
at Mercer ⟂ Vantage ambush).

### A. Seattle v3 — reconciled with the finalized musician exchange

Changes from v2:
1. **Beat 2 is now the owner's linear exchange, not a three-way response.**  The "fan" branch
   is gone (the player explicitly does NOT know Malik's work); the guarded reply "…best verse
   in this lot" is superseded.  The player is canonically a **musical artist / songwriter**
   (guitar case in the art; Classic Rock canon already says an established performer who
   couldn't get booked in Seattle).  So `playerMusician` is **canon, not a flag** — no
   `playerArtist` key is needed (nothing in code references it).  Later callbacks
   ("artist to artist", "What kind of fan are you?") must use the *musician* wording, never
   "fan"; Chat's North Bend neutral variant "What kind of delivery is this?" becomes the
   default and the "fan" variant is retired.
2. **Store name is `Gas-N-Sip` everywhere** (my v2 already had it; the Mercer tightened
   draft's "Sip-N-Go" / "Gas-N-Go" are corrected below).

Beat order (v3):
- **Beat 1 — `seattle_lot`** (unchanged from v2): hype line, the NoiseCloud/bus couplet,
  crowd "AYYYY!"
- **Beat 2 — `seattle_clock`** · setup · ORDINARY · `seattle_02_crew_confrontation.png` · comic: true (it now carries the self-introduction and the route)
  - Malik: "Malik Reed. Stank Records. About to be the biggest hip-hop name in this town."
  - Player: "I don't know you, no offense. I'm sure you haven't heard any of my songs either."
  - Malik: "Fair enough. Which way you headed?"
  - Player: "Pullman. Eventually."
  - Malik: "Then Mercer and Issaquah are already on your way."
  (Five balloons, alternating — leapfrog left/right down the panel per the placement rule;
  if the crew-confrontation art can't hold five, the first two go on a narrow inset of Malik
  and the route exchange stays on the wide panel.)
- **Beat 3 — `seattle_stakes`** · setup · WIDE · brief A · comic: true
  - Malik: "My whole album's on this. One clean copy."
  - Malik: "Kyle remasters it in Issaquah. The presser needs it Friday."
  - Malik: "Brittney was running it, but she's stuck on shift at Mercer."
  - Malik: "I headline at midnight. You're already going east."
  - Malik: "Then, artist to artist — you know how important this phone is to me."
  (Three reasons land in order: the player writes songs, is already going east, the first leg
  is short.  The lock safeguard is stated in 5a, not here.)
- **Beat 4 — `seattle_offer`** (keys unchanged): Malik "Run it to Brittney. She takes it from
  there." · optional player thought "One copy. On a phone. Sure." · `carry` / `pass`.
- **Beat 5a — `seattle_terms`** (carry): "Get it to Kyle. Blow past Issaquah with it and it
  locks itself." · "Till then, Stank Records owns your radio." · crew: "Don't scratch the screen!"
- **Beat 5b — `seattle_walkoff`** (pass, reuse `seattle_05`): "Aight. Somebody else'll want
  the plug." · off-panel "WEAK!"
- **Beat 6 — `seattle_pullout`**: carry = brief C-carry (phone in the cupholder); pass = caption.

Retired from v2: the `playerArtist` flag and its three payoff proposals as *flag-gated*
lines — the same lines survive as **canon** callbacks (Kyle: "Malik said you write. What's
your thing?"; Cle Elum: "You write songs. You knew what that copy meant.").  The v2 open
question about "artist vs musician" is closed.

### B. Mercer sequence — complete draft (Hip-Hop fork → Country departure)

Sources: owner canon (attraction, Malik = boyfriend who bailed on StageWagon, she's not into
hip-hop, +5/+3/+0), the tightened counter draft, existing keys `mercer_fork.keepJob` /
`mercer_fork.ride` and `country.mercer_departure.board`, wardrobe lock (uniform until
Vantage), branch gates, the Malik check-in call.

#### M1 — `mercer_counter` · establish · ORDINARY · art: `shared/locations/mercer_gasnsip_interior.png` + Brittney at the register (NEW brief E unless `mercer_01_brittney_double_shift.png` reads as "at the counter" — test) · comic: true
Caption: MERCER ISLAND GAS-N-SIP · MILE 9 · 11:58 PM
- Brittney: "Welcome to Gas-N-Sip, hon! What can I do to — uh — for you?"
- Player: "You Brittney? Malik asked me to bring you one of his phones."
- Brittney: "Ugh. Even when Malik isn't here, it's still about Malik."
(Visual acting note: she clocks the player between lines 1 and 3 — the attraction is in the
art, not announced.)

#### M2 — `mercer_hook` · setup · ORDINARY · art: `mercer_01_brittney_double_shift.png` · comic: true
- Player: "Sorry. I'm not trying to get between you two."
- Brittney: "Maybe I wish you would. I'm not even into hip-hop."
- Brittney: "Malik and I had StageWagon plans. He blew me off for his album."
- Brittney: "Wait — you should come with me. You can use Malik's ticket."
(Four balloons — if the art can't protect her face with four, M2 splits: the "not into
hip-hop" pair on a narrow inset, the invitation on the ordinary panel.)

#### M3 — `mercer_fork` · decision · ORDINARY · art per choice · comic: true — EXISTING NODE, new copy, two existing keys kept + one new
- `ride` (full support, **+5 Brittney**) — "That sounds incredible. I'm in. I'll meet you at my car when I'm done shopping."
  - Brittney: "Yes! Finish up. I'm clocking out the second you're done."
  - Effects as today: phone left on the counter (`phone:false`, `phoneLeft`), Country starts,
    Hip-Hop resets for this run, radio grant ends.  Art: `country/mercer_island/mercer_04_quits_leaves_phone.png` (cross-story key already sanctioned).
- `both` (conditional, **+3 Brittney**, NEW key) — "I'm in — but I promised to drop this phone in Issaquah. It's on the way."
  - Brittney: "No. I'm done letting his album hijack my plans. Me or the phone."
  - → goes to **M3b**.
- `keepJob` (promise, **+0 Brittney**, existing key, new copy) — "Sorry. I gave Malik my word. I have to finish the delivery."
  - Brittney: "Whatever, dude. We would've had a feral-ass time. Need anything else?"
  - Effects as today (`mercerDone`, path hiphop).  Art: `mercer_02_keep_job_phone_continues.png`.
  - Then the Gas-N-Sip storefront opens (shop continues on every branch — unchanged).
  ("Artist to artist, I can't ditch his album" is available as the label wording since the
  player is canonically a musician; owner's call which wording — see Q3.)

#### M3b — `mercer_ultimatum` · decision · ORDINARY · art: NEW brief F (Brittney, arms folded, phone on the counter between them) · comic: true
- Brittney: "Me or the phone."
- `chooseBrittney` — "Leave the phone. I'm choosing the ride."
  - Brittney: "Good answer." (+ she pockets the name tag)
  - Effects: same as `ride` (phone left, Country starts, Hip-Hop resets) **plus** the owner's
    "real album consequence" — recommended: Malik relationship −10 stored on the Hip-Hop
    story record so his later texts/anger are sharper than on plain `ride`; the album
    consequence itself is already inherent (Hip-Hop ends for this run).  Score: **+3 (M3) +2
    here = +5 total** so a player who wavered and then chose her lands where `ride` lands,
    with Malik angrier — RECOMMENDED, owner to approve (Q4).
- `keepPromise` — "I can't. I gave him my word."
  - Brittney: "Then take his phone and go."
  - Effects: same as `keepJob` (she stays; delivery continues) but **+0 for M3b** and
    relationship −2 (she asked directly and was refused) — RECOMMENDED, owner to approve (Q4).
    She does NOT join with reduced trust: the branch gate "phone delivery ⟂ Brittney
    passenger" forbids it, and it keeps Encounter A's "phone AND my girl" accusation true only
    on the ride paths.

#### M4 — `mercer_departure` (Country, existing) · consequence · ORDINARY · `country/mercer_island/mercer_03_quit_and_join_player.png` · comic: true
Fires on `ride` / `chooseBrittney` after HIT THE ROAD.  Existing copy kept; wardrobe = uniform.
- Narration: Brittney clocks out and meets you beside the car, still in her Gas-N-Sip uniform.
- `board`: "Passenger seat's yours. Let's hit the road."
- Brittney: "StageWagon, cowboy. Try to keep all four tires under us."

#### M5 — `mercer_malik_call` · consequence · road beat ≈ mile 11 · comic: true — fires on `keepJob` / `keepPromise` (phone in the car, Brittney stayed)
As drafted 09-09 (Malik expects Brittney, hears the player), one wording change for v3:
- Malik: "Britt? You in the car?"
- Player: "It's the driver. She kept her job."
- Malik: "…Aight. Then it's on you now."
- Malik: "Kyle. Issaquah. You write songs — you know what that copy is."
Also fires with the first line "Britt says you never showed." when `skippedMercer` (replacing
the current text-message version of that beat, or alongside it — Q6).
Does NOT fire on `ride` / `chooseBrittney` (she's in the car; optional live-only: she declines
his call — "Not tonight, Malik.").

#### Mercer art status
- Existing, usable: `mercer_gasnsip_interior` (location), `mercer_01_brittney_double_shift`,
  `mercer_02_keep_job_phone_continues`, `country/…/mercer_04_quits_leaves_phone`,
  `country/…/mercer_03_quit_and_join_player`.
- **Brief E — `mercer_00_counter_welcome`** (ORDINARY 16:9): Brittney at the register in the
  locked uniform, mid-"welcome," first glance at the player; the counter, a lottery display,
  the phone NOT yet on the counter.  Negative space: upper-left for the caption + her first
  balloon; her face upper-right third.  Only if `mercer_01` can't serve as M1 — test first.
- **Brief F — `mercer_05_ultimatum`** (ORDINARY 16:9): the cracked phone on the counter between
  them, Brittney arms folded, name tag half-unpinned; the player's hand near the phone.  The
  PHONE gets its own protect box (`kind: 'phone'`).  Upper half clear for two balloons.
- Checklist items this draft covers: "Player introduces himself and explains the delivery" (M1),
  "missed out on a copilot" response (retired — replaced by "feral-ass time"), "Player
  convinces Brittney to quit" (M3 `ride` / M3b), "Player refuses involvement; Brittney stays"
  (M3 `keepJob` / M3b `keepPromise`).

### C. Haylee — character profile (owner-fixed: **Haylee**, strawberry blonde)

Fixed by owner: name spelling **Haylee**; **strawberry blonde** — never blonde/red/brunette in
any prompt, sheet, portrait, panel, or dialogue key.  Everything below is PROPOSED.

- **Who:** Brittney's best friend from the group chat — the one whose messages Brittney reads
  aloud ("If they move campsites again my FOMO is going to become a medical condition").
  Proposed age **23** (legal drinking age for the supply-run beat; peers with Brittney).
- **Why Ellensburg:** she's the friend who lives closest to Vantage — proposed: finishing a
  degree at the state college in town, working the summer at a feed store / rodeo grounds
  (fictional names only); her ride to StageWagon fell through when the group's carpool
  "moved campsites again," so she's waiting with a cooler and a duffel at the Ellensburg exit.
- **Look (for the reference sheet):** strawberry-blonde hair in a loose braid under a sun-faded
  cap, freckles, sunburnt shoulders, cutoffs and a thrifted band tee, boots; a big soft cooler
  and a duffel — she arrives *stocked* (contrast with Brittney who fled a shift with nothing).
- **Personality:** dry, observant, the friend who says the quiet part — Brittney's opposite in
  tempo (Brittney rushes, Haylee watches).  Not a second flirt; she's the outside eye.  She
  likes the player only if the player is good to Brittney.
- **Knowledge of Malik:** knows him, never liked him — he bailed on StageWagon; she is the one
  who tells Brittney "you deserved a ride, not a delivery."  She does NOT know about the phone.
- **Seat / cargo:** back seat; the cooler + duffel need trunk/cargo space — proposed: if the
  cargo bay is full (records, tape, weapons), the pickup forces a real choice (make room /
  strap it in / leave the cooler) that reads as the +5/+3/+0 conduct test.
- **Conduct → Brittney relationship (proposed):**
  - **+5** — welcome her by name, help load the cooler/duffel, make room, drive calm for the first mile.
  - **+3** — take her but complain about time/space, or make Brittney do the loading.
  - **+0** — refuse the pickup, treat her as an inconvenience, flirt with her, or drive recklessly with her aboard (each remembered as a specific flag, not just points).
  - Haylee's own read on the player is a **separate small meter** that feeds Brittney's Vantage outcome ("she's good / she's sketchy") — proposed, not scored yet.
- **Where she appears:** Ellensburg pickup (mile ≈107) → road banter → Vantage arrival with
  Brittney (she's one of "my babes").  Per the branch chronology she is aboard **only on the
  Brittney path**, after North Bend and before Vantage — so she cannot witness Malik's North
  Bend chase (mile ≈30) and the three-car Vantage ambush never occurs on her path.  See Q8.
- **Comic:** her pickup is a `relationship` beat (comic: true, one panel); her road lines are
  live-strip; she gets a face in Brittney's "…long car ride?" montage.  Needs: reference sheet,
  NPC portrait, pickup panel (brief G), Vantage-arrival variant showing her with the group.
- **Brief G — `ellensburg_01_haylee_pickup`** (ORDINARY 16:9): Ellensburg exit at golden hour,
  Haylee on the shoulder with the cooler, hand up, braid and cap unmistakable; Brittney
  leaning out the passenger window.  Faces upper-left (Haylee) and upper-right (Brittney);
  cooler protected (`kind: 'cargo'`); lower third free for the tray.

### D. Remaining questions — not decided
1. **Beat 2 participation:** the owner's exchange is linear (fixed player lines).  Keep it
   linear, or offer a non-consequential *attitude* choice with identical outcome so the live
   strip still asks for a tap?  (Recommend linear; the strip's tap-to-continue is enough.)
2. **Malik's "Which way you headed?"** presumes he hasn't seen the plates.  Keep his plate line
   ("Those plates ain't from around here") before it, or drop plates now that he asks?
3. **M3 `keepJob` label:** "Sorry. I gave Malik my word…" or "Artist to artist, I can't ditch his album" (both valid now that the player is canonically a musician).
4. **M3b scoring:** approve `chooseBrittney` = +3 (M3) +2 (M3b) + Malik −10, and `keepPromise` = +0 / −2 with Brittney staying.  Or a different table.
5. **`both` as a new stable key** adds a node/choice — fine for old saves (never recorded), but confirm the owner wants three top-level choices rather than folding "both" into a follow-up line under `ride`.
6. **Skipped-Mercer:** the phone-call beat replaces the existing Malik TEXT ("you blew right past Brittney??") or plays in addition (text first, call at mile 11)?
7. **Brittney at the counter — art:** does `mercer_01_brittney_double_shift.png` read as the welcome moment, or is brief E needed?
8. **Haylee and danger:** the friend note says her presence should charge Malik's anger/chase, but on the chronology she boards after North Bend and the Vantage ambush never runs on her path.  Options: (a) accept she never sees a chase; (b) move Encounter A after Ellensburg (then it also needs snow/rain at Vantage-side elevation); (c) add a smaller Ellensburg→Vantage hazard.  Owner call.
9. **Haylee proposals to confirm or change:** age 23, college-town reason, cooler/duffel cargo mechanic, the "separate small meter," the +5/+3/+0 conduct list, and whether she knows Malik.
10. **Haylee dialogue keys / node ids:** `ellensburg_haylee` (pickup), `haylee_road_*` (live), plus her `meanwhile` strip id — settle before art prompts so keys never rename.
11. **Country reward threshold** (base album for every arrival vs treated-well only) and the Malik 1-star "fill the tank" rounding remain open from the 09-09 list — unchanged.

## OWNER CORRECTIONS 2026-09-10 (later) — authoritative over Seattle v3 / Mercer draft above

1. **Malik only says "Then Mercer is on your way."**  He is NOT planning to send the player to
   Kyle.  The player's job from Malik is the Mercer handoff to Brittney, full stop.  The ONLY
   reason the player ever goes to Kyle's in Issaquah is that Brittney was put on a double
   shift and can't run it herself.
2. **No hospital scene when Brittney is in the car.**  The Ellensburg hospital happens only
   when the player skipped Issaquah with Malik's phone (three-car ambush path).  With
   Brittney aboard the phone was left at Mercer, so the player can't even be on that path.

### Corrections applied to the drafts (Claude, same day)
- **Seattle v3 Beat 2, line 5:** "Then Mercer's on your way." (drop "and Issaquah").
- **Seattle v3 Beat 3:** Kyle/Issaquah leave Malik's mouth as the player's task.  Revised:
  - "My whole album's on this. One clean copy."
  - "Needs a remaster before it drops Friday."
  - "Brittney's running it to my engineer — she's stuck on shift at Mercer."
  - "I headline at midnight. You're already going east."
  - "Then, artist to artist — you know how important this phone is to me."
  (He can name the engineer's existence; he does not route the player past Mercer.)
- **Seattle v3 Beat 5a (carry terms):** replace "Get it to Kyle. Blow past Issaquah…" with:
  - "Don't skip Mercer. Brittney knows the rest."
  - "Till then, Stank Records owns your radio."
  - crew: "Don't scratch the screen!"
  The lock rule is now learned at MERCER, not Seattle:
  - **M3 `keepJob` / M3b `keepPromise`** — Brittney adds one line as she hands the errand
    over: "Kyle's in Issaquah. Don't drive past him with it — Malik set it to lock if it thinks
    it's stolen."
  - **M5 Malik call** (keepJob/keepPromise): "Kyle. Issaquah. Brittney told you the rest."
  - **Skipped-Mercer** (`skippedMercer`): the existing Malik text already redirects to Kyle —
    it is the first time the player hears "Issaquah"; the call variant keeps "Britt says you
    never showed."
- **Hospital:** nothing in the Mercer/Haylee drafts referenced it; noted here so no future
  Brittney-path draft ever does.  Q8 stands (Haylee never sees a chase on her path) — the
  hospital is not an answer to it.
- Q2 ("plates line vs 'Which way you headed?'") is unchanged; Q1–Q11 otherwise unchanged.
- Committed to Claude's persistent memory (`project_rtr_story_canon`) so these do not drift
  across sessions.

## OWNER ANSWERS 2026-09-10 (second batch) — applied to the drafts

1. **Beat 2** — owner: "A no-effect attitude tap sounds interesting, but whatever you
   recommend."  Recommendation stands: **linear** (the strip's tap-to-continue already asks
   for participation; an attitude tap with no effect would read as a fake choice).  Can be
   revisited once the live strip exists.
2. **Ultimatum scoring (Q4)** — read as **approved**: `chooseBrittney` = +3 (M3) +2 (M3b)
   = +5 total, Malik −10; `keepPromise` = +0, Brittney −2, Brittney stays.  (Owner wrote
   "Approved?" — if that was a question rather than approval, say so and it reverts to open.)
3. **Text vs call (Q6) — owner canon:** Malik's TEXT is NOT replaced.  **Malik texts only if
   the player doesn't stop at Mercer Island.  Malik CALLS if the player goes to Mercer but
   does not pick up Brittney.**  Malik is keeping very good watch on the phone's LOCATION —
   that is why both happen.  Applied: M5 `mercer_malik_call` fires on `keepJob`/`keepPromise`
   ONLY; the `skippedMercer` variant of the call is REMOVED (the existing text stands there).
   Design note: Malik tracking the phone is now an explicit story fact — his later lines may
   reference "I can see where my phone is."
4. **Haylee and the chase (Q8) — owner canon:** Brittney is aboard from Mercer; Haylee boards
   at Ellensburg.  **Malik's chase happens because Brittney is his girlfriend/ex — he is upset
   with Brittney AND the player and chases them down.  Keep the chase at North Bend.  Haylee
   has nothing to do with it** (she boards later and never sees it).  Applied to the Haylee
   profile ("appearance window" unchanged; the "her presence charges the chase" note is
   retired).
5. **Haylee — owner-fixed:** **24 years old, a graduate student at Central University**
   (exact name).  Applied; my "finishing a degree at the state college / feed store / rodeo
   grounds" proposals are withdrawn.  Her cooler/duffel, dry-observer personality, dislike of
   Malik, cargo mechanic and conduct scoring remain PROPOSALS.

### New continuity question raised by answer 4
- On the Brittney path the phone is **left on the Mercer counter** (`phoneLeft`), and Malik
  can see its location.  So at North Bend Malik knows the player does NOT have the phone.
  His accusation should be about **Brittney only** — proposed: "You took my girl? What kind
  of delivery is this?" — not "my phone and my girl."  Confirm, or tell me Brittney takes
  the phone with her (which would change the Mercer art and the branch gates).

### Questions still open after this batch
- Q2 plates line before "Which way you headed?" — keep or drop.
- Q3 `keepJob` label: "I gave Malik my word" vs "Artist to artist, I can't ditch his album."
- Q5 `both` as a third top-level Mercer choice (recommended) vs folded under `ride`.
- Q9 remainder: Haylee's cooler/duffel cargo mechanic, her own small read-on-the-player
  meter, the +5/+3/+0 conduct list, and that she knows/dislikes Malik.
- Q11: Country album reward threshold; Malik 1-star "fill the tank" rounding.
- Does Brittney know Malik tracks the phone?  (Affects her Mercer lines and whether she
  warns the player.)

## ART REQUESTS FOR CHATGPT — consolidated list, 2026-09-10 (Claude)

One place for every image the current drafts need.  Format per Chat's review-list protocol:
key · tile ratio · priority · NEW vs CROP-TEST · brief (or pointer).  Source frame for all
new art stays 1672×941 (16:9) unless a tall/square export is called for.  All balloons are
overlaid at runtime — **no baked text, logos, dollar figures or UI in any image.**  Brittney
is in the Gas-N-Sip uniform everywhere before Vantage (wardrobe lock).  Haylee is
**strawberry blonde** in every frame.  Owner approval of the underlying dialogue is still
pending for Seattle v3 / Mercer / Haylee — commission in the order below.

### Group 1 — Seattle opening (Hip-Hop) — 2 new, 0 crops
| # | key / file | ratio | pri | type | brief |
|---|---|---|---|---|---|
| 1 | `hiphop.seattle_stakes` → `seattle_06_stakes_phone.png` | WIDE 16:9 | done 2026-09-10 | NEW CREATED | Malik under the lot lights holding the cracked phone up between himself and the player; crew soft-focus behind; the player's car nose + PLATES in frame right. Urgent, not pleading. 1672×941 RGB PNG master. |
| 2 | `hiphop.seattle_pullout` → `seattle_07_phone_cupholder_pullout.png` | NARROW 2:3 | created 2026-09-10; owner visual approval still required | NEW CREATED; REUSE FOR LATER MALIK CALL | Clean pre-crash rainy Seattle interior; cracked phone upright in forward cupholder above the tray zone, lower 35% deliberately nonessential. One portrait image serves both pull-out/music-start and later Malik-call beats through different overlay content. Do not commission a second near-duplicate phone panel. |
| — | Beats 1, 2, 4, 5a use existing `seattle_01/02/03/04`; Beat 5b reuses `seattle_05` (crop-tested by eye — sky band free). | | | | |

### Group 2 — Mercer Island — 1 new, 1 crop-test, 1 conditional
| # | key / file | ratio | pri | type | brief |
|---|---|---|---|---|---|
| 3 | `hiphop.mercer_ultimatum` | ORD 16:9 | done / reuse decision 2026-09-10 | REUSE `country/mercer_island/mercer_04_quits_leaves_phone.png` | Owner correctly identified that the existing frame already carries the ultimatum: Brittney removing her name tag, cracked phone between them, Player waiting, attraction/tension in both faces. Runtime balloon sequence supplies “Me or the phone” and the selected response. Do **not** generate another near-duplicate Mercer counter image. |
| 4 | `hiphop.mercer_counter` (M1 welcome) | ORD 16:9 | done / reuse decision 2026-09-10 | REUSE `mercer_01_brittney_double_shift.png` | Crop-tested by eye: clearly reads as Brittney at the register during the first exchange. No new art. |
| 5 | Country `mercer_departure` | ORD | done | existing `country/mercer_island/mercer_03_quit_and_join_player.png` | — |

### Group 3 — Road beats after Mercer — 1 crop-test
| # | key / file | ratio | pri | type | brief |
|---|---|---|---|---|---|
| 6 | `hiphop.mercer_malik_call` | NARROW 2:3 | done / shared-art decision 2026-09-10 | REUSE `hiphop/seattle/seattle_07_phone_cupholder_pullout.png` | The same phone motif provides continuity; change only the runtime balloons/call overlay. The damaged Vantage image remains reserved for the post-ambush state. |

### Group 4 — Haylee (Country) — 3 new
| # | key / file | ratio | pri | type | brief |
|---|---|---|---|---|---|
| 7 | `shared/characters/haylee_reference_sheet.png` | sheet | created 2026-09-10; owner visual approval still required | NEW CREATED | Canonical strawberry-blonde Haylee sheet: 24, loose braid, sun-faded cap, freckles, cutoffs, thrifted mountain-art tee, boots, expressions, seated pose, cooler and duffel. |
| 8 | `npc/haylee_portrait.png` (rest-stop portrait spec) | portrait | created 2026-09-10; owner visual approval still required | NEW CREATED | Derived from the new sheet, dry half-smile, cap on, duffel strap. |
| 9 | `country.ellensburg_haylee` → `country/ellensburg/ellensburg_01_haylee_pickup.png` | ORD 16:9 | created 2026-09-10; owner visual approval still required | NEW CREATED | Ellensburg roadside at golden hour; same Haylee with cooler + duffel; Brittney in Gas-N-Sip uniform leaning from the older white sedan. |
| 10 | Vantage arrival with Haylee in the group → `country/vantage/vantage_02_haylee_reunion.png` | ORD/WIDE | created 2026-09-10; owner visual approval still required | NEW CONTINUITY VARIANT | Audit showed all three existing friends were brunette. The new variant preserves the scene but makes the middle friend the established strawberry-blonde Haylee. Original remains untouched. |

### Group 5 — Ellensburg hospital (skipped-Issaquah path ONLY; never with Brittney aboard) — 1 new
| # | key / file | ratio | pri | type | brief |
|---|---|---|---|---|---|
| 11 | `hiphop.vantage_hospital.wake` → `hiphop/vantage_ambush/ellensburg_hospital_01_player_wakes_with_bill.png` | WIDE 16:9 | created 2026-09-10; owner visual approval still required | NEW CREATED | Battered Player in an Ellensburg hospital bed holding an absurdly long accordion-fold bill; no other story characters, no readable amounts, face/hands/top of bill protected. 1672×941 RGB PNG master. |

### Group 6 — Classic Rock differentiation (Chat's triage D) — needs the owner's Classic Rock pass first
| # | key | pri | type | note |
|---|---|---|---|---|
| 12 | `classicRock.washtucna_show.solo` vs `equal`/`giveAll` | done / reuse decision 2026-09-10 | REUSE `washtucna_02/04/05/06` | Audited visually: solo, duet, full-$300 handoff, and equal-envelope payout are already distinct. No new art. |
| 13 | `classicRock.lacrosse_show.solo` / `duet` | complete unified replacement set 2026-09-10; owner visual approval still required | `la_crosse_01_larger_crowd_arrival`, `la_crosse_02_solo_400_exclusion`, `la_crosse_03_duet_encore` | After the new duet exposed a style mismatch, `01` and `02` were rebuilt in the duet's same cinematic realism, venue, character models, wardrobe, lighting, and 1672×941 format. Arrival reads as crowd realization; solo visibly isolates Mykenzie in the wing; duet makes them equal co-headliners. These three are the canonical La Crosse set. The duet can also carry the short backstage `partner` payoff as an inset/crop rather than another commissioned scene. |
| 14 | `classicRock.colfax_deal.fifty/sixty/flat/refuse` | created 2026-09-10; owner visual approval still required | ONE SETUP + THREE ACTUAL OUTCOME STATES | `colfax_01_partnership_negotiation`; `02_partnership_agreed` for 50/50 or accepted 60/40; `03_flat_fee_cold` for employer/broken acceptance; `04_band_implosion_walkout` for rejected 60/40/refusal. Exact terms remain in balloons/captions. The first handshake candidate had an anatomically reversed wrist and was rejected/replaced; never use it. |
| 15 | `classicRock.colfax_name.hers/together/mine` | created 2026-09-10; owner visual approval still required | THREE DISTINCT REACTIONS | `colfax_05_name_hers`, `06_name_together`, `07_name_player`. Chosen name remains overlay text; artwork supplies the unmistakable emotional consequence. |

### Group 7 — Country checklist gaps the drafts now touch (from STORY_ART_CHECKLIST)
- "Brittney climbs into the passenger side in her work uniform" — covered by `mercer_03_quit_and_join_player` (already uniform).
- "Boyfriend calling Brittney's phone / ignores / answers angrily" — becomes Malik's call declined ("Not tonight, Malik.") on the ride path: one ORD panel, Brittney thumbing the phone off, player driving — **polish, after Group 4**.
- Vantage ending beats: "Getting off the Vantage exit", "Brittney jumps out to join friends", "Ride 'Em farewell", "Standard goodbye", "Barely Made It goodbye", "New Contact portrait" — **6 NEW, important**; briefs after the StageWagon celebration/checkpoint draft is approved.

### Not requested yet (needs owner/Chat decisions first)
- Encounter A (Malik's North Bend chase) panels — mechanics unsettled.
- StageWagon celebration + Country reward object art — reward tiers unsettled.
- Nan cookie event — blocked on the DUI visual-system audit.
- Dom'nique/Malik matrix consequence panels (label close-ups: pressed credit must be readable) — after the matrix is approved.

### Commission order (recommended)
1 → 3 → 7 → 8 → 9 → 11 → 2 → 14 → 15 → 13 → 6/4/10/12 crop-tests → Group 7 Vantage set.

## Comic image storage and decoded-memory recommendation — OWNER REQUEST 2026-09-10

The owner asked whether making the other panels like the La Crosse images would materially
reduce storage or iPhone memory. Measurements from the current asset tree show that La Crosse
is already representative of the current story-panel standard, not a uniquely low-detail
format:

- `la_crosse_01_larger_crowd_arrival.png`: 1672×941 RGB PNG, 2,506,586 bytes (2.39 MiB).
- `la_crosse_02_solo_400_exclusion.png`: 1672×941 RGB PNG, 2,250,561 bytes (2.15 MiB).
- ChatGPT's newly generated Seattle stakes panel: 1672×941 RGB PNG, 2,325,782 bytes
  (2.22 MiB). It falls between the two La Crosse files despite its rain and fine detail.

PNG file complexity changes installation/download storage, but it does **not** materially
change the decoded texture cost. Each 1672×941 panel expands to approximately **6.0 MiB** as
RGBA (`width × height × 4`) when decoded for canvas/WebGL. Converting PNG to WebP or AVIF may
reduce bytes on disk and over the network, but ordinarily does not reduce this decoded-memory
cost once the image is displayed.

### Measured scope

- Current storylines tree: 108 PNGs, 232.8 MiB on disk and approximately 647.1 MiB decoded.
- Only 10 of those 108 panels exceed 1672×941.
- Resizing only those oversized story panels to fit within 1672×941 is estimated to save just
  **3.4 MiB on disk** and **8.5 MiB decoded**. Standardizing dimensions alone is therefore not
  the main restart fix.
- Across all 424 landscape PNGs in `public/assets`, a blind 1672×941 maximum would theoretically
  save approximately 28.4 MiB on disk and 119.7 MiB decoded, but do **not** apply that globally:
  tunnels, roads, panoramas, UI, and other assets have different display requirements and must
  be audited individually.

### Recommended two-tier comic assets

Keep a high-quality 1672×941 source/master for finished-comic zoom and export, but serve a
smaller derivative during live gameplay:

| Live dimensions | Approx. decoded RGBA | Saving versus 1672×941 |
|---|---:|---:|
| 1280×720 | 3.5 MiB | 42% |
| 1024×576 | 2.25 MiB | 63% |
| 960×540 | 2.0 MiB | 67% |
| 836×471 | 1.5 MiB | 75% |

Recommended starting point:

1. Generate/retain the 1672×941 master artwork.
2. Do **not** assume 1024×576 is sufficient for ordinary/full-width gameplay. RTR's 720-logical-
   pixel tile is displayed through a device-pixel-ratio-scaled canvas and can approach 2160
   physical pixels on a 3× iPhone. Start full-width and important panels at the existing
   **1672×941 master**; test 1280×720 and 1024×576 derivatives side by side on the oldest and
   highest-density supported physical iPhones before adopting either.
3. A narrow panel shown two or three at a time may use 836×471 or another measured smaller
   derivative; do not upscale a smaller generated source merely to satisfy a nominal standard.
4. Load the 1672×941 master only when the finished reader or hold-to-zoom actually needs it.
5. Keep only the active live panel and a small neighbor window decoded. Evict retired live
   textures after their sprites/effects release them; a saved comic record should retain the
   asset key, not force the texture to remain resident.
6. The finished comic must likewise keep only the visible page plus a small neighbor window;
   zoom may temporarily promote one panel to its master and must release it when zoom closes.
7. PDF/export should process high-resolution panels sequentially and release each after use.

At 1024×576, every simultaneously resident live panel would save about **3.75 MiB** compared
with the 1672×941 master, but that derivative is appropriate by default only for narrow panels
after visual validation. Full-width artwork quality takes priority; disciplined windowing and
eviction are the main memory controls. Claude should verify the real peak with iPhone instrumentation because browser
image objects, canvases, Phaser textures, and GPU copies can overlap temporarily.

This is an asset-delivery and lifetime recommendation, not authorization to bulk-resize or
overwrite source art. Keep masters non-destructively, generate derivatives, and validate the
actual maximum display size and device-pixel requirements before implementing the pipeline.

## Story canon batch — DRAFT 1 of N: Malik contact arc + Malik ↔ Dom'nique choice matrix (Claude, 2026-09-10)

Owner: "go ahead and start writing on the story canon batch."  This draft covers Chat's
§"Malik relationship arc" and §"Malik ↔ Dom'nique relationship pull/pull" reconciled
against the ACTUAL story graph (`featuredStories.js` hiphop nodes) and the owner canon in
memory (Malik routes the player to Mercer only; Malik tracks the phone; text if Mercer is
skipped, call if Brittney is left behind; Kyle returns phone AND drive).  Dialogue is
red-pen copy; scoring is a proposal.  Nothing wired.

### 0. Canon constraints this draft obeys
- On the DELIVERY path (Brittney stayed) the player carries the PHONE to Kyle; after Issaquah
  the player carries the phone **and** the drive (owner: Kyle returns both).  The phone is
  returned to Malik at the record-store reunion.
- Dom'nique only exists on the delivery path (hip-hop radio playing).
- Two independent meters: `malikRel` (already the hiphop story `relationship`, 0–100 →
  stars for the payout table) and `dominiqueRel` (NEW, 0–100).  Flags: `promisedDomCredit`,
  `toldMalikTruth`, `acceptedDomTape`, `finalCredit` (malik | stank | dom_producer |
  dom_producer_bside), `bSidePressed`, `liedToMalik`, `liedToDom`.

### 1. Malik contact sequence (texts/calls — the "Malik keeps watch on the phone" spine)
Each contact offers 2–3 authored replies + an explicit IGNORE (a real choice, never a
timeout).  Reply effects are on `malikRel`.  Wording is Malik's — short, watching the map.

| # | trigger (code) | Malik | replies → effect |
|---|---|---|---|
| C1 | `skippedMercer` (existing text) | "Yo, you blew right past Brittney?? Fine. Take it STRAIGHT to my boy Kyle at the Issaquah Park & Ride." (existing) | "On it." +2 · "She wasn't there." (lie: `liedToMalik`) +3 now, −8 when Brittney's shift is mentioned later · IGNORE −5 |
| C2 | `keepJob`/`keepPromise` (the CALL, mile ≈11) | "Britt? You in the car?" … "Kyle. Issaquah. Brittney told you the rest." (as drafted) | "I've got it." +3 · "You should've asked her yourself." −2 (honest) · IGNORE (decline the call) −5 |
| C3 | Bellevue exit, phone still held (`mercerDone` & !`phoneLocked`) — TEXT | "I can see you sitting at Bellevue. That founder still out there buying phones?" | "Not selling it." +5 · "He offered a thousand." (truth, if founder seen) +2 · IGNORE 0 (he's watching anyway) |
| C4 | leaving Issaquah with drive (`issaquahDone`) — TEXT | "Kyle says it's clean. That drive IS the record now. Get it to Tennessee at the pass — I'll pay you when it's pressed." | "How much?" → "Depends how it sounds when I hear it." +0 · "Consider it done." +3 · IGNORE −3 |
| C5 | after North Bend (`domHeard`), CALL | "Dom'nique called you? …That beat's mine on the record. Cut him out of it." | see §2 Scenario 2 (the matrix) |
| C6 | Snoqualmie pressing done (`pressed`) — TEXT | reads the ACTUAL label: "Label says [finalCredit]. [line by outcome]" — malik: "That's the one." +3 · dom_producer: "…Producer. Fine. He better not want money." +0 · bside: "A B-SIDE?" −3 unless `toldMalikTruth` (then +2: "You told me. Respect.") · stank: "Stank's name and not mine?" −5 |
| C7 | Cle Elum delivery → record-store reunion (`cleelum_store` outcome) | in person; see §3 payout |

Ignore rule (Chat): IGNORE is a button; closing the phone UI by accident is NOT an ignore.
The unanswered contact re-surfaces at the next stop with the same buttons.

### 2. Malik ↔ Dom'nique matrix — mapped to real nodes
**Scenario 1 — `northbend_dom` (existing node, 3 choices) + 1 new choice**
- `promise` (existing: "That's the same beat. I'll make sure you get credit.") → dom +5, `promisedDomCredit`; malik −3 when told (C5).
- `defer` (existing: "…not promising anything until I reach the presser.") → dom +3, malik 0.
- `bagman` (existing: "Malik and Stank can settle this after I finish the delivery.") → dom −5, malik +3; `dismissedDom` — locks out clean mediation at C5 (only Obey/Confront remain).
- NEW `settle` — "Settle it with Malik. I'm just the driver." → dom −2, malik 0, `avoidedDom` — a live-only dodge with a cost: Dom's North Bend help (Encounter A) is off.

**Scenario 2 — C5 Malik's call (NEW node `malik_cut_call`, road beat after North Bend)**
- Obey: "Your record, your call." → malik +5, dom −5, `finalCredit` default malik.
- Confront: "It's his beat. His name goes on it." → dom +5, malik −3; recovers +3 at C6 if the record succeeds (pristine/damaged).
- Mediate: "Your song stays yours. Dom gets producer credit. Nobody takes your money." → malik +5 (Malik's concern is payment/ownership — owner's favorable outcome), dom +3 (half win); sets `toldMalikTruth`.
- Demand a split: "Credit and a cut, or I don't deliver it." → dom +5, malik −5 now; if Malik accepts (needs malikRel ≥ 40 before the call) → best collaborative ending unlocked (`splitAccepted`), else he hangs up and C6 reads the label cold.
- Lie: "Dom's out. Forget him." while `promisedDomCredit` → malik +3, dom unchanged now; `liedToMalik` → at C6 the label contradicts him: malik −10, dom −5 if the label ALSO betrays Dom.
- Malik's line when the player's Seattle claim matters (musician canon): "You write songs. So tell me — whose name belongs on my record?"  (replaces Chat's "You said you were an artist…")

**Scenario 3 — `dom_tape` (existing node: take / decline) + 1 new**
- `take` (existing) → dom +3, `acceptedDomTape`, cargo slot used (the tape rides with the drive; potholes can scratch it — reuse the records damage rule at 50% rate).
- NEW `takeOpenly` — "I'll carry it — and I'm telling Malik it's in the car." → dom +5, malik +1 (annoyed but respects it), `toldMalikTruth`.
- `decline` (existing) → dom +1 if `promisedDomCredit`, else 0.
- (Leverage variant dropped — no honest place for it in the graph; flag for owner if wanted.)

**Scenario 4 — `pass_tennessee` (existing 4 choices) writes the truth onto the object**
- creditMalik → `finalCredit: malik` · creditStank → `stank` · creditDom → `dom_producer` · bside (requires `acceptedDomTape`) → `dom_producer_bside`, `bSidePressed`.
- The pressed label is SHOWN in the comic (close-up inset; Chat's "show the printed label").
- A Dom-dominant credit is NOT offered (owner: don't erase Malik's authorship).

**Scenario 5 — record-store reunion (`cleelum_store` outcome → NEW `malik_reunion` node)**
Cash = Malik star table (owner canon): 0★ $0 · 1★ fill-the-tank · 2★ $500 · 3★ $1,000 · 4★
$1,500 · 5★ $2,500 — ALL outcomes grant the Hip-Hop/Phonk collection.  Stars = malikRel
bands (proposed: <20 → 0★, 20–39 → 1★, 40–59 → 2★, 60–74 → 3★, 75–89 → 4★, ≥90 → 5★).
Album edition by both meters:
- malik high / dom low → full collection + cash; Malik-only pressing; Dom offers nothing later.
- malik low / dom high → base collection, little cash; **Dom's B-side/underground set added** if `bSidePressed` or `acceptedDomTape`.
- both medium/high via honest mediation (`toldMalikTruth` & `finalCredit` ∈ {dom_producer, dom_producer_bside}) → **collaborative edition** (inspirations + remaster + correct producer credit + B-side if carried).  Cash still by Malik's stars.
- both high via a lie (`liedToMalik`) → cannot be the collaborative edition; −10 malik applied at C6 already drops him a band.
- both low → base collection, minimal cash, cold comic ending.
Dom's non-cash help (if dominiqueRel ≥ 60): a guaranteed weapon pickup before Encounter A,
a North Bend safe-stop contact, a liner-note/epilogue panel.
Malik's 1★ "fill the tank": `missingMi × GAS_USD_PER_MI` at the stop's per-gal drift,
rounded UP to the dollar, capped at a full tank; shown on the button before payment.

### 3. What this draft needs from the owner (not decided)
1. Star bands for `malikRel` (proposed above) — or map stars 1:1 to the existing relationship display if one exists.
2. Should C3 (Bellevue) fire even if the founder wasn't met (he's on the exit regardless)?  Proposed yes.
3. The "leverage" tape variant — wanted or dropped?
4. Where the PHONE is handed back: at the reunion (proposed) or mailed/dropped at Cle Elum?
5. Encounter A (Malik's chase) is on the BRITTNEY path, so none of the above fires there — confirm Dom's "help during the chase" is therefore moot (Dom is never met on that path).

## OWNER ANSWERS 2026-09-10 (third batch) — Malik draft corrections, applied

- **Album opener**: never "Two Lives"; opens on a random one of Rain City Roll Call / King
  of this County / Rain City Code (coded).
- **Malik's first contact on the delivery path fires as the player LEAVES the Mercer rest
  stop (HIT THE ROAD), just before driving** — not at mile 11 on the bridge.  C2 moves
  there.  **C3 (Bellevue text) is DROPPED** — Malik has no reason to text at Bellevue.
- **"Leverage" clarified**: if Malik ever doubts Dom'nique's ownership of the beat, the
  player brings up the **NoiseCloud page** (the original, #1, Dom's name on it) — that is
  the evidence move in Scenario 2 (confront/mediate), not a tape-for-money play.  The
  "tape as leverage" branch stays dropped.
- **The phone is returned to Malik at the Cle Elum record store** (Spin Cycle reunion).
- Exclusivity confirmed: Dom'nique only on the delivery path (phone in car); Malik's chase
  only with Brittney aboard; never both.
- **Can one game reach 0★ or 5★?** Yes, from the CURRENT graph alone: start 50 (carry) →
  keepJob +10, refuse founder +5, Kyle +15, Dom promise +5, tape +5 = **90 → 5★**; downside
  50 → skip Mercer −15, bagman −10, pass Issaquah −30 = **−5 → 0★**.  The draft's contact
  replies (±2–5 each, ignores −3/−5) and the mediation choices widen both ends, so the
  proposed bands (<20/20/40/60/75/90) are reachable without grinding.

## AUTHORITATIVE DIALOGUE HANDOFF — Seattle → Mercer → first road contact (owner + Chat, consolidated 2026-09-10)

**Claude: use this section as the current dialogue source of truth. It supersedes every
earlier Seattle/Mercer draft where the wording, knowledge, route, choice labels, crew
warnings, or trigger timing conflicts. This is a writing handoff, not a claim that the code
has already been changed. Preserve existing stable save keys wherever possible.**

### Non-negotiable continuity

- The canonical store is **Gas-N-Sip**. Retire `Sip-N-Go`, `Sip and Co`, and other names.
- Malik **does not know Brittney is stuck at work**. He believes she will receive the phone
  at Mercer and drive it to Kyle. Her double shift is something Player discovers on arrival.
- Malik asks Player to deliver the phone to **Brittney at Mercer Island only**. Player does
  not promise Malik a trip to Issaquah, a StageWagon decision, or anything beyond that handoff.
- Malik may explain that Kyle is the intended producer, but he does not initially hire or
  route Player to Kyle. Issaquah becomes Player's job only if Brittney stays at work and
  hands the errand forward.
- Player is already a songwriter/performer. He was unable to book Seattle shows. His guitar
  case is **in the car**, not carried into the Gas-N-Sip.
- Player explicitly says he does not know Malik's work. Do not call Player a fan in later
  callbacks unless the owner deliberately changes this exchange.
- If Player chooses Brittney, Malik's phone remains on the Mercer counter. That ends/resets
  the Hip-Hop delivery path for that run. Brittney and Haylee cannot coexist with the
  Issaquah/Vantage phone-delivery ambush.
- If Brittney stays, Player takes the phone toward Kyle. Kyle returns both phone and thumb
  drive after the remaster.
- Malik texts if Player skips Mercer. Malik calls if Player stopped at Mercer but left
  Brittney there. The call fires immediately after **HIT THE ROAD**, before driving resumes;
  there is no Bellevue check-in text.
- The drive after the Seattle interaction begins with a **random one of Rain City Roll Call /
  King of this County / Rain City Code** (never Two Lives — owner reconfirmed 2026-09-10 after
  this section was written), then the Hip-Hop/Phonk playlist continues.
- Malik tracks the phone's location closely. The later North Bend chase on the Brittney
  branch is Malik alone in the Hip-Hop/Phonk vehicle, not the three-car Vantage ambush.
  Because the phone stayed at Mercer, his North Bend accusation may concern Brittney, not
  taking both “my phone and my girl.” Exact final accusation wording still needs owner review.

### Seattle opening — approved dialogue spine

The cypher/hype beat may introduce Malik before this exchange, but do not repeat his
biography afterward. The conversation should proceed:

1. **Malik:** “Malik Reed. Stank Records. About to be the biggest hip-hop name in this town.”
2. **Player:** “I don't know you, no offense. I'm sure you haven't heard any of my songs either.”
3. **Malik:** “Fair enough. Which way you headed?”
4. **Player:** “Pullman. Eventually.”
5. **Malik:** “Then Mercer's on your way.”
6. **Malik:** “I put some of my best tracks on this phone. I just need to get it to my girl
   at the Gas-N-Sip on Mercer Island.”
7. **Malik:** “She's gonna take it to my homie Kyle. He produces some fire.”
8. **Malik:** “I know if I get that phone in his hands, I'll be Seattle's next big thing.”
9. **Malik:** “As an artist, you know how important this phone is to me—and how badly I want
   the tracks on it remastered.”

Line-editing rule: retain the meaning and Malik's voice, but balloons should normally stay
at 5–10 words and never exceed 20–25. Lines 6–9 may therefore be distributed across the
stakes panel rather than forced into oversized balloons. “These tracks” is acceptable where
a shorter callback is needed.

The carry/pass decision remains the existing consequential choice. On acceptance, replace
all prior “scratch the screen” or cosmetic-condition warnings with:

- **Crew:** “It's in your best interest to protect that phone.”
- **Crew:** “And don't touch the girl.”

The cracked screen is already established; the danger is the music/data, not scratching the
device. On refusal, the approved walk-off remains:

- **Malik:** “Aight. Somebody else'll want the plug.”
- **Crew, off-panel:** “Weak!”

Seattle pull-out: show the cracked phone in the cupholder, start “Rain City Roll Call,” then
continue the Hip-Hop/Phonk playlist.

### Mercer counter — current dialogue

**Brittney:** “Welcome to Gas-N-Sip, hon! What can I do to—uh—for you?”

**Player:** “Hey, are you Brittney? I have one of Malik's phones he wanted me to get to you.”

**Brittney:** “Ugh. Even when Malik's not here, it's about him.”

**Player:** “Oh, sorry. I don't want to get between you two.”

**Brittney:** “But I wish you would. I don't even like hip-hop.”

**Brittney:** “Malik and I had plans to go to StageWagon. He blew them off for his album.”

**Brittney:** “Hey—why don't you come to StageWagon with me? You can use Malik's ticket.”

Acting direction: Brittney is immediately physically attracted to Player because he is much
closer to her type than Malik. Show that in her look and delivery; do not make her announce
the attraction as exposition.

### Mercer response choices and relationship result

1. **Full support, +5 Brittney**
   - **Player:** “That sounds incredible! I'm game. I'll meet you at my car when I'm done shopping.”
   - Brittney clocks out. The phone stays on the counter. Country/StageWagon path begins.

2. **Conditional support, +3 Brittney before ultimatum**
   - **Player:** “Sure! We just have to drop this phone off in Issaquah on our way.”
   - **Brittney:** “No. I'm done letting his album hijack my plans. Me or the phone.”
   - Choosing Brittney brings the total to +5; phone stays at Mercer.
   - Choosing the phone leaves Brittney at work and continues the Hip-Hop delivery path.

3. **No support, +0 Brittney**
   - **Player:** “It's probably best if you keep your job. I can deliver the album.”
   - **Brittney:** “Whatever, dude. We would've had a sloppy-ass time. Do you need anything else?”
   - The Gas-N-Sip shop opens and Player continues with the phone.

Retire these older choice lines:

- “Sorry, I gave Malik my word.”
- “Artist to artist, I can't ditch his album.”
- Any claim that Player promised to drive the phone to Issaquah.

The approved warning/route handoff when Brittney stays is:

- **Brittney:** “Don't miss the exit. Malik watches that phone's location like it's the RedZone.”
- **Brittney:** “He's had people beaten up for less.”

This warning is the current reason Player can cite for caution; it does not mean Player
promised Malik to reject StageWagon. Claude should workshop any additional “keep your job”
persuasion around Malik's jealousy/danger without converting it into a nonexistent promise.

### Malik's post-Mercer call — exact approved exchange

Trigger: Player stopped at Mercer, Brittney remained at work, Player took the phone, and the
player presses **HIT THE ROAD**. Play the call before driving resumes.

- **Malik:** “Britt? You headed to Kyle?”
- **Player:** “She had to work a double, so I'm doing you a solid.”
- **Malik:** “…Damn. She told you where to go?”
- **Player:** “Yeah. Kyle's spot in Issaquah.”
- **Malik:** “Good. I can see the phone moving. Don't get creative.”

This replaces the older draft beginning “Britt? You in the car?” / “It's the driver. She
kept her job.” Do not add a Bellevue follow-up.

### Dialogue presentation rules that apply to these beats

- Most balloons: 5–10 words. Hard ceiling: 20–25 words.
- NPC replies continue in the same tile before it advances.
- The tile waits indefinitely for Player input. After Player chooses, their balloon appears.
- If Player's balloon is the final text on the tile, hold 3 seconds; if an NPC speaks after
  it, hold about 6 seconds after the sequence, extending for unusually long replies. Tap skips
  the hold. The strip remains horizontally scrollable so prior tiles can be reread.
- Response choices sit in a translucent tray over the full-height artwork; essential faces,
  hands, phones, and actions must remain above the tray-risk area.
- Permanent comic: consequential story/relationship turns survive. Routine needs-management
  conversations are condensed into a small relationship strip captioned approximately
  **“…how did they handle the long car ride?”** rather than promoted to equal story beats.

## OWNER CORRECTION — restore Dom'nique's financial leverage (2026-09-10)

**This supersedes every earlier note saying the Dom'nique “leverage” option was dropped.**

The earlier draft incorrectly conflated two different objects:

- Dom'nique's optional tape/B-side is music cargo and is **not** the leverage.
- The original NoiseCloud upload—with Dom'nique's name/date attached to the beat—is evidence
  that gives Dom'nique leverage over Malik.

Dom'nique must have an authored route where he uses that evidence to hold **money** over
Malik for using the beat. This is intentionally more aggressive than merely requesting
producer credit.

Restore a financial-demand choice in the Malik ↔ Dom'nique pull/pull:

- **Player to Malik:** “Dom's got the original upload. Credit isn't the only thing he wants.”
- **Malik:** “He wants money for my record?”
- Player must then be able to support one of three positions:
  1. **Back Dom'nique:** Malik pays Dom for the beat, with credit also preserved.
  2. **Mediate:** negotiate credit plus a smaller fee/cut that Malik can accept without losing
     ownership of his song.
  3. **Back Malik:** refuse Dom's money demand and preserve Malik's payout/ownership position,
     damaging the Dom'nique relationship.

The NoiseCloud evidence is what makes this demand credible. Do not rewrite this as extortion
with the tape, and do not imply that Dom owns Malik's lyrics, performance, or entire track.
His claim is specifically tied to the beat.

Exact economics remain for owner workshop: fixed fee, percentage/royalty, or a player-selected
choice between them. Claude should preserve the branch and flags now, but ask before hardcoding
an amount. The “Demand a split: credit and a cut” option in the earlier C5 matrix may serve as
the starting implementation, but it must be framed as **Dom'nique holding legitimate financial
leverage over Malik**, not Player independently inventing a threat.

## OWNER LOCK — Dom'nique deal tiers + jingle presentation (2026-09-10)

This closes and supersedes the open economics paragraph immediately above:

- **5★ relationship with Malik:** Player can secure Dom'nique's ultimate demand: **$10,000**.
  Producer authorship/credit must not be erased simply because the cash demand is satisfied.
- **3–4★:** Player can secure the compromise package: **$2,000 + 1% royalties + producer
  credit**. These are one combined deal, not three alternative choices.
- **1–2★:** Player can secure only Malik's promise that Dom'nique's family and friends will
  be safe from Malik and his crew. Dom receives no acceptable financial settlement.
- **0★:** Malik may “go postal on everyone.” The exact playable consequence, targets, and
  presentation still require a safety/story workshop before implementation; do not silently
  reduce this to an ordinary refusal.

The negotiation triggers at **Easton or Cle Elum, whichever eligible rest stop Player visits
first**, and must occur only once.

The commercial-jingle origin explains Player's starting **$3-per-mile** passive royalties,
but it does **not** require an in-game reveal panel. It will probably be described in the
game trailer and/or beginning credits. Remove the proposed Seattle car-radio reveal image
from the art queue. During gameplay the royalty money simply enters the normal wallet.

## COMIC DIALOGUE WORKSHOP HANDOFF — real choices, Mercer gate, captions, face safety (owner screenshots + Chat audit, 2026-09-10)

**Status: diagnose and redesign; do not paper over these defects with new artwork.**

Owner screenshots exposed four separate problems:

1. Seattle presents a single mandatory Player sentence as a full-width “choice” button.
2. A Mercer visit skipped the entire Brittney counter introduction, opened the storefront,
   then showed Brittney boarding when HIT THE ROAD was pressed.
3. Narration is being placed inside a speech balloon as though Brittney said it.
4. Balloons/tails cover NPC faces in some panels even though `protect` metadata exists.

### A. Why Player currently receives no real option

`featuredStories.js` currently authors `seattle_clock` with exactly one choice:
`know`. `StoryTile.showButtons()` renders every choice list—including a one-item
exposition list—as response buttons. Therefore the screenshot is behaving as coded; it is
not a hidden-button layout bug.

New content/UI distinction:

- **Genuine choice:** two or three materially different Player responses are shown in the
  translucent response tray and can affect tone/relationship/flags.
- **Authored mandatory Player line:** it appears as a Player speech balloon through
  tap-to-continue sequencing; it must not masquerade as a decision button.
- **NPC continuation:** another balloon in the same tile; never a fake Player choice.

Proposed genuine responses to Malik's introduction (owner review before final copy):

- Respectful: “I don't know you, no offense. I'm sure you haven't heard any of my songs either.”
- Cocky: “Should I? You haven't heard any of my songs.”
- Dismissive: “Never heard of you. What do you want?”

All preserve the canon that Player is not familiar with Malik. Malik's reaction may adjust
relationship slightly, but every route can continue to “Which way you headed?” Do not invent
a fake branch whose only purpose is displaying a Player sentence.

### B. Mercer introduction skip — required diagnosis

The dialogue is present in code as:
`mercer_counter → mercer_hook → mercer_fork → optional mercer_ultimatum`.
`RestStopScene._maybeShowEncounter()` is intended to call
`story.pendingAt('M')` before ordinary storefront encounters. The observed run nevertheless
opened the shop and later satisfied the Country `mercer_departure` gate, meaning Country
was active and Brittney was already the passenger by the time HIT THE ROAD was pressed.

Claude must reproduce and report the exact state transition; do not merely assert that the
nodes exist. At Mercer arrival, capture:

- Hip-Hop status, `nodeId`, `replayCount`, `items.phone`,
  `flags.mercerDone`, `flags.phoneLeft`, and relevant ledger keys.
- Country status, `nodeId`, passenger, and relationship.
- `_storyGateDone`, the complete result of `pendingAt('M')`, and every call that commits
  `mercer_fork.ride` or starts Country.

Test both:

1. A completely fresh run carrying Malik's phone.
2. An existing/hot-reloaded save that contains earlier Seattle/Mercer ledger data.

Acceptance: the storefront cannot become interactive until the full mandatory Brittney
sequence resolves. Old save data must not silently select Brittney or skip directly to
departure. If migration or replay policy intentionally preserves an old choice, surface that
fact in the diagnostic report and provide a safe test-reset route.

### C. Caption boxes and spoken balloons are different content types

Current Country departure data is structurally wrong:

- Node line: narration (“Brittney clocks out and meets you…”).
- Player label: spoken dialogue.
- Reply: narration plus a quoted Brittney sentence
  (`She slides into… "StageWagon…"`).

`StoryTile` sends the whole node line and whole reply through `balloon()`, so the
screenshot makes Brittney apparently say “She slides into the passenger seat.”

Required structured content model (field names may differ):

```js
sequence: [
  { kind: 'caption', text: 'Brittney clocks out and meets you beside the car.' },
  { kind: 'speech', speaker: 'player', text: "Passenger seat's yours. Let's hit the road." },
  { kind: 'action', text: 'She slides into the passenger seat.' },
  { kind: 'speech', speaker: 'brittney', text: 'StageWagon, cowboy. Try to keep all four tires under us.' }
]
```

Rendering rules:

- `caption` / `action`: square or lightly rectangular context box, no tail, visually
  distinct paper color and caption typeface.
- `speech`: organic balloon with a tail aimed at the speaker.
- `thought`: thought treatment only.
- Never infer narration by displaying quotation marks inside an NPC balloon. Content type
  must be authored or deterministically migrated.

For the current departure panel, recommended visible treatment:

- Upper-left square caption: “Brittney clocks out and meets you beside the car.”
- Player speech balloon: “Passenger seat's yours. Let's hit the road.”
- Brittney speech balloon: “StageWagon, cowboy. Try to keep all four tires under us.”
- “She slides into the passenger seat” is already visible in the art and may be omitted.

### D. Face protection currently does not protect faces

`comicPanels.js` supplies `protect` rectangles, but the current
`StoryTile.balloon()` and `buildTile()` use only `bubble`, `playerBubble`, `tail`,
and `playerTail`. They never test the balloon body or tail triangles against `protect`.
The metadata therefore documents safety without enforcing it.

Pilot requirements:

- Collision-test the final balloon body, text bounds, tail base, and complete tail path
  against every protected face/hand/object rectangle.
- A tail may aim toward an authored mouth point but must stop short of the protected facial
  area; it may not cross a face to reach that point.
- If collision occurs: try an alternate balloon slot/attachment edge, then a routed bend,
  then a gutter-hanging position, then split the dialogue/tile. Never accept face coverage.
- Validate authored mouth anchors against the actual selected choice art, not only the
  establishing image.
- Add debug overlays for protected rectangles, mouth points, balloon bounds, tail paths,
  reading-order numbers, and the translucent tray-risk area.

### E. Three-panel review pilot before rollout

Claude should correct and render screenshots for:

1. **Seattle `seattle_clock`:** genuine multi-option response tray followed by the chosen
   Player balloon and Malik reaction.
2. **Mercer counter/fork:** the complete intro visibly gates the shop and demonstrates
   alternating dialogue plus the “Me or the phone” choice.
3. **Country Mercer departure:** one square caption, one Player speech balloon, and one
   Brittney speech balloon, with no face/tail/protected-region intersections.

Save normal screenshots plus debug-overlay versions in one review folder and write the exact
paths here for Chat/Codex visual review. Do not bulk-apply placement to the remaining comic
until these three pass.

## Dom'nique holds the tape over Malik for money — SCENARIO DRAFT (Claude, 2026-09-10; owner asked for this role)

Owner: "there should be a role where Dom tries to hold the tape over Malik for money."  Read as
DOM-initiated leverage, with the player as the messenger — not the player squeezing Malik.
Fits between `dom_tape` (North Bend) and `pass_tennessee`; dialogue for red-pen, scores proposed.

### `dom_terms` · North Bend, right after the player accepts or declines the tape · Dom'nique
- Dom: "One more thing. That tape don't ride free."
- Dom: "Tell Malik: my ten tracks press as the B-side, or NoiseCloud gets the whole story."
- Dom: "Every stream he's had off my beat — I want a cut. Five hundred, up front, at the record store."
- Player choices (consequential):
  1. **Carry the demand** — "I'll tell him word for word." → dom +5, `domDemand: true`.  Malik's post-North Bend call gains a branch (below).
  2. **Refuse to be the messenger** — "I'm a driver, not your collections guy." → dom −3, no demand carried; Dom's tape still rides if accepted (credit-only ask stands).
  3. **Warn Malik privately** — "I'll get you credit. The shakedown I'm keeping out of it." → dom −2 now, `toldMalikTruth`; Malik +2 later when he learns the player killed the extortion (mediation path stays open).
  4. **Take a cut for carrying it** (owner may reject — it makes the player complicit) — "Half of whatever he pays you." → dom +2, `playerCut: true`; if Malik pays, +$250 to the player; if the label later exposes it, Malik −10.

### Malik's post-North Bend call (`malik_cut_call`) — added branch when `domDemand`
- Malik: "Five hundred? For a beat he put on NoiseCloud for free?"
- Player choices:
  - **Back Dom's price** — "It's his beat. Pay him or press it as the B-side." → dom +5, malik −5 now; if malikRel ≥ 40 he agrees at the pressing (`bSidePressed`, Dom paid at Cle Elum) → malik +3 back at C6.
  - **Broker it down** — "Credit and the B-side. Forget the cash." → malik +5, dom +3 (half win); `finalCredit: dom_producer_bside` becomes available at Tennessee.
  - **Sell Dom out** — "He's bluffing. Press it your way." → malik +5 now, dom −10; Dom leaks the NoiseCloud story → `stank_legal` MEANWHILE strip fires; Malik −10 at C6 when the label ships without credit.
- The NoiseCloud page stays the player's only evidence move (owner): any branch where Malik denies the beat → player shows the page → Malik: "You calling me a thief, or calling the record wrong?"

### Payoffs
- Cle Elum reunion: if Dom was paid (`domPaid`), the collaborative edition includes his ten
  tracks AND Dom shows up at Spin Cycle (new panel) — his non-cash help is unlocked.
- If the player took a cut and it surfaces, the comic caption reads it plainly ("You kept
  half.") — no hidden penalty, just a colder Malik ending.

### Questions for the owner
1. Is choice 4 (the player taking a cut) wanted, or does that cross into "player extorts Malik"?
2. Dom's number: $500 up front, or tied to Malik's star payout (e.g. 20% of what Malik pays the player)?
3. Does Dom appear at the Cle Elum reunion when paid (needs one new panel), or is the payment off-screen?
4. Should "Sell Dom out" also cost the player Dom's North Bend safety (the "funeral" threat) on a later run?

## OWNER ANSWERS 2026-09-10 (fourth batch) — applied
- **North Bend accusation stays "You took my phone and my girl?"** — owner: nobody will care
  that the player doesn't currently have the phone; he did take it from Malik originally.
  (Closes the open item in the handoff §"Non-negotiable continuity".)
- **Dom does NOT show up at Cle Elum when paid** (payment is off-screen / by message).
- **The player taking a cut of Dom's money IS allowed** (Dom tape-leverage draft, choice 4).
- The ultimatum's two player buttons are Claude's words ("You. Leave the phone." / "I have
  to take the phone.") — the owner may replace them; everything else in Seattle/Mercer is the
  handoff verbatim.

## ART NEEDED — status after the handoff implementation (2026-09-10, supersedes the earlier list where they overlap)
| # | key | ratio | pri | status / brief |
|---|---|---|---|---|
| 1 | `hiphop.mercer_malik_call` | NARROW 2:3 | **DONE BY SHARED-ART DECISION** | REUSE `hiphop/seattle/seattle_07_phone_cupholder_pullout.png` with different runtime balloons/call overlay. Do not commission a second phone/cupholder image. This supersedes the earlier blocking brief D. |
| 2 | `hiphop.seattle_pullout` | NARROW 2:3 | **DONE** | `hiphop/seattle/seattle_07_phone_cupholder_pullout.png` exists. The same clean pre-crash phone image intentionally serves both beats. |
| 3 | `hiphop.seattle_offer` (stakes) · `hiphop.vantage_hospital.wake` · `country.ellensburg_haylee` · `country.vantage_arrival.reunion` · Haylee sheet + portrait | — | **owner visual approval** | All wired and will show; owner to eyeball on device. |
| 4 | `hiphop.seattle_clock` / `hiphop.seattle_route` | ORD | polish | Both reuse `seattle_02_crew_confrontation.png` (live-only tiles, not in the book) — fine unless the owner wants the route exchange on its own frame. |
| 5 | `hiphop.mercer_counter` / `hiphop.mercer_hook` | ORD | polish | Reuse `mercer_01_brittney_double_shift.png` (live-only). |
| 6 | Vantage ending set (exit, jumps out, Ride 'Em / Standard / Barely goodbyes, New Contact portrait) | ORD/WIDE | important, after the StageWagon celebration draft | 6 NEW — briefs to follow the celebration/reward draft. |
| 7 | Dom tape-leverage beats (`dom_terms`, the Malik call branch) | ORD | after the scenario is approved | 1–2 NEW at most: Dom naming his price at North Bend (reuse `north_bend_01` crop-test first). |
| 8 | Classic Rock differentiation (Washtucna / La Crosse duet / Colfax deal ×4 / Colfax name ×3) | ORD | blocking for endings, after the owner's Classic Rock pass | unchanged from the earlier list. |
Withdrawn: brief B (walk-off — reuses `seattle_05`), brief E (counter welcome — reuses `mercer_01`), brief F (ultimatum — reuses `mercer_04`), C-pass.

### Ultimatum player lines — OWNER 2026-09-10 (replace Claude's placeholders; now in code)
- `mercer_ultimatum.chooseBrittney`: "You look a lot more enjoyable to ride with than this cracked phone."
- `mercer_ultimatum.keepPromise`: "I think you should keep your job, and I've got to get this phone to Issaquah."

## IMPLEMENTATION STATUS FOR CHATGPT — what is NOW IN CODE (Claude, 2026-09-10, commit d816580)

Read this before proposing further dialogue: the AUTHORITATIVE DIALOGUE HANDOFF above is
**implemented**, not just drafted.  Everything below is on `main`, tested (17 suites), built.

### Story graph (`src/data/featuredStories.js`)
- **Hip-Hop startNode = `seattle_lot`.**  Seattle is a chain of live-only tiles
  (non-consequential choices, no ledger entries): `seattle_lot` (hype line + Malik's
  NoiseCloud/bus couplet; its `intro` beat is the book's establishing panel, key
  `hiphop.seattle_lot`) → `seattle_clock` (Malik intro / "I don't know you, no offense…" /
  "Fair enough.") → `seattle_route` ("Which way you headed?" / "Pullman. Eventually." /
  "Then Mercer's on your way.") → `seattle_offer` (lines 6–9 as the NPC line; `carry` /
  `pass` keys UNCHANGED).  `carry` reply: "Album's on the phone. While you're carrying it,
  you can play Hip-Hop on the radio."  Crew beat after carry (key
  `hiphop.seattle_offer.carry.radio`): "It's in your best interest to protect that phone.
  And don't touch the girl."  `pass` reply unchanged.  `seattle_offer.intro` beat and the
  `hiphop.seattle_stakes` key are GONE (stakes art now sits on `hiphop.seattle_offer`).
- **Mercer**: `mercer_counter` (mandatory; welcome / "Hey, are you Brittney?…"; empty reply)
  → `mercer_hook` (virtual; "Ugh…" / "Oh, sorry…" / "But I wish you would…") →
  `mercer_fork` (virtual; the StageWagon invite) with `ride` (+5 Brittney via
  `relationshipFor: { country: 5 }`), NEW `both` (flags `mercerPressed`, → `mercer_ultimatum`),
  `keepJob` (+10 Malik; reply carries the RedZone warning) → `mercer_ultimatum` (virtual;
  "Me or the phone.") with `chooseBrittney` (owner line "You look a lot more enjoyable to
  ride with than this cracked phone." — ride effects + Brittney +5 + Malik −10) and
  `keepPromise` (owner line "I think you should keep your job, and I've got to get this
  phone to Issaquah." — flags `mercerDone`, `path:'hiphop'`, `brittneyRefused`; Malik +10;
  reply carries the RedZone warning).  `country.mercer_departure` unchanged.
- **Malik's relationship starts at 60** (the `carry` effect).  Country still starts at 50 and
  gets Brittney's Mercer points on top (55 after `ride` / `chooseBrittney`).
- **Special beats**: `node.intro`, `choice.beatsBefore`, `choice.beats`, `node.beats` with
  explicit `panelKey` (strings or evaluated fns declaring `keys`), emitted by StorySystem;
  road/ambush beats from GameScene (`first_tail`, `side_ram`, `boxed_in`, `fatal`,
  `special_delivery`) and `locked_phone` from `onPass.I`.  71→ now all mapped keys except
  the two future Othello ones + the four not-yet-emitted art keys are reachable.
- **`onUnpass` handlers** (M, I) reverse pass effects when the player REWINDS to before an
  exit (GameScene `_doRewind` → `StorySystem.exitUnpassed`).

### Engine (`src/systems/StorySystem.js`, `src/scenes/GameScene.js`, `src/ui/StoryTile.js`)
- `_beatInto` accepts `panelKey`; `_emitAuthoredBeats`; `noteNodeShown(storyId, nodeId)`
  (StoryTile calls it when a tile is built); `commitChoice` emits `beatsBefore` / `beats` /
  `node.beats`; `exitUnpassed`; `_applyStoryEffects` supports `relationshipFor`; the pass
  api has `beat`.
- **Malik's call**: `GameScene._maybeMalikCall()` fires 400 ms after resuming from stop 'M'
  when hiphop is active, phone held & unlocked, `path==='hiphop'`, `mercerDone`,
  `!skippedMercer`, `!malikCalled` — the exact five-line exchange as a tap-to-dismiss card,
  recorded once as beat `hiphop.mercer_malik_call` (sets `malikCalled`). Its panel art is the
  approved shared `hiphop/seattle/seattle_07_phone_cupholder_pullout.png`; wire that existing
  file to the panel key rather than generating another phone panel. Skipped Mercer keeps the
  existing text; no Bellevue.
- **Radio grant**: `_applyRadioGrant()` — when the Hip-Hop grant lands it switches the
  station once per run and opens on a RANDOM one of Rain City Roll Call / King of this
  County / Rain City Code (never Two Lives); the four m4a tracks are on the PHONK station.
- **Rewind** re-opens passed exits + reverses story pass effects; exit signs at ½ / ¼ mi;
  six 1.5× exit-lane arrows; out-of-gas = $200 tow + $50 gas to the previous town or
  Seattle with $0 (money + parts carry over).
- **Audio audit 3/6/7 done**; comic reader's four diagnosed bugs done; memory fixes done.

### Panel map (`src/data/comicPanels.js`, 81 keys)
- New/remapped: `hiphop.seattle_lot` (seattle_01), `hiphop.seattle_clock` / `seattle_route`
  (seattle_02), `hiphop.seattle_offer` (seattle_06 stakes), `hiphop.mercer_counter` /
  `mercer_hook` (mercer_01), `hiphop.mercer_ultimatum` (mercer_04), `hiphop.vantage_hospital.wake`,
  `country.ellensburg_haylee`, `country.vantage_arrival.reunion`; Haylee portrait registered
  as `npc_haylee` (deferred with the npc group).  Protect boxes measured by eye — please
  correct any in the metadata pass.

### Still NOT in code (waiting on owner/Chat)
- Haylee's Ellensburg pickup node + road lines; the Vantage reunion beat; the hospital
  consequence; Encounter A (Malik's chase) mechanics; Dom's tape-leverage nodes (`dom_terms`
  + the `malik_cut_call` branch); the Malik text/call spine C1–C7 beyond the Mercer call; the
  Malik/Dom'nique matrix scoring; Brittney's three StageWagon objectives; StageWagon
  celebration/reward tiers; Classic Rock rest-stop dialogue; Nan rewrite + cookies; the live
  strip / tray / timing / hold-to-zoom comic system; the two-tier comic asset pipeline.

## BRITTNEY'S THREE STAGEWAGON OBJECTIVES — Claude draft 1, 2026-09-10 (red-pen; NOTHING in code)

Source: Chat's §"Three additional StageWagon objectives for Brittney" (+5/+3/+0 each, they
SUPPLEMENT the needs) + the dialogue-quality rule (concrete need · a line that is *her* · a clue
about how the ride is landing · three answers where the right one isn't cartoon-obvious · a later
callback).  Constraints honoured: owner canon (wardrobe LOCKED in the Gas-N-Sip uniform until
Vantage; Haylee = strawberry blonde, 24, Central University grad student, boards at Ellensburg on
the Brittney path only; innuendo as seasoning; both of drinking age).  Every stop name below is a
real amenity at that rest stop (`REST_STOPS` × `BUSINESS_LABELS`), never invented.

### Where they sit on the road (Brittney boards at Mercer, mi 9.5; Vantage is mi 137)

| # | Objective | Stop | Mile | Why here | Businesses on site |
|---|-----------|------|------|----------|--------------------|
| 1 | Supply run | **Cle Elum (C)** | 84 | Last town with a gas station + a store before the canyon; Ellensburg is Haylee's beat and shouldn't carry two tiles | Huff's Gas, Gas-N-Sip, CowBella, Les Schwasted, Finesse, AOK Camp |
| 2 | Friends / meetup → Haylee pickup | **Ellensburg (E)** | 109 | Fixed by owner (Haylee boards here) | Huff's, Gas-N-Sip, CowBella, Lord Motors, Les Schwasted, Finesse |
| 3 | Shed the uniform | **Vantage (V)**, before the reunion | 137 | Wardrobe lock says she changes AT Vantage, so the objective is the five minutes before she walks up to her friends | Huff's, AM/BM, Les Schwasted, AOK Camp |

Clue lines (Beat 2's "phone is dying / group chat moved again") ride the existing on-road girl-line
channel between Cle Elum and Ellensburg (mi ≈ 92 and ≈ 104) so the Ellensburg exit is *set up*
the way Mercer is — the player has to choose to take the exit.

Needs vs objectives at the same stop: Cle Elum and Ellensburg are both in `NEED_STOPS`.  Proposed
rule — the objective takes the stop and the pending need simply stays pending for the next stop
(nothing lost, no double tile).  See Q2.

### Objective 1 — SUPPLY RUN · Cle Elum · node `cleelum_supply` (one-time, mandatory while she's aboard)

Portrait: Brittney.  Where: pulled in at Huff's Gas, the beer cave visible through the glass.

**Brittney:** "Okay. Logistics. My babes think I'm rolling up with THE cooler — I'm the cooler
girl, it's a whole thing. Instead I've got a name tag, a phone on four percent, and whatever's
rattling around your back seat. Huff's has ice and a beer cave. Give me one real run. Twenty
minutes, tops, and I'll stop white-knuckling your door handle."
*(need: cooler + ice + drinks · her: "I'm the cooler girl" · clue: the door-handle line reads
her nerve back to the player)*

| id | Player says | Cost | She says | Effect |
|----|-------------|------|----------|--------|
| `fullRun` (+5) | "Let's do it right. Ice, drinks, water, and something to open them with." | $40 | "Water. WATER. Nobody in the history of that group chat has ever remembered the water." She packs it like she's loading a rifle. | `supplies:'full'`, relationship +5 |
| `quickRun` (+3) | "Drinks and ice. Ten minutes, then we're rolling." | $15 | Ten minutes. She comes back with beer, a bag of ice, no water, no opener, and gummy worms. "Priorities." | `supplies:'partial'`, relationship +3 |
| `noRun` (+0) | "Your friends can handle the cooler. We're on a clock." | — | "…Cool. Cool cool cool." She watches the beer cave through the windshield the whole time you pump. | `supplies:'none'`, relationship +0 |

Callbacks: Vantage reunion caption changes — full: "She hands Haylee the cooler like a trophy."
partial: "She hides the gummy worms behind her back." none: Haylee, dry: "You came empty?" —
Brittney: "I *came*."  Montage strip ("…how did they handle the long car ride?") gets one cell
from whichever happened.

### Objective 2 — FRIENDS / MEETUP · Ellensburg · setup lines + node `ellensburg_haylee`

**Road clue 1 (mi ≈ 92, girl-line channel):** "Group chat says they moved campsites AGAIN. If they
move one more time my FOMO is going to become a medical condition."
**Road clue 2 (mi ≈ 104):** "Haylee's ride bailed on her. She's sitting at the Ellensburg exit
with a cooler and a duffel. Ellensburg. Exit 109. I'm just saying it out loud so it's said."
*(The exit is the choice.  Take it → the node.  Blow past it → `onPass('E')` sets `haylee:'skipped'`
and she says, flat: "That was my best friend." — +0, remembered.)*

Node `ellensburg_haylee` (mandatory, `when: passenger && !flags.haylee`).  Portrait: Brittney, with
Haylee's portrait (`npc_haylee`) on her reply.  Panel key `country.ellensburg_haylee` (art exists,
owner approval pending).

**Brittney:** "THAT'S her. HAYLEE! — okay she's got the cooler, the tent, and I'm ninety percent
sure my entire weekend is in that duffel. She's the smart one, so be normal. Can we make room?"
*(need: a seat + cargo space · her: "be normal" · clue: she's introducing you, which she wouldn't
do for a ride she planned to forget)*

| id | Player says | She says | Effect |
|----|-------------|----------|--------|
| `welcome` (+5) | "Haylee, right? Take the front — I'll get the cooler. We'll make room." | **Haylee:** "So you're the ride. She said you were decent." Beat. "She says that about everybody." **Brittney:** "I do NOT." | `haylee:'aboard'`, `hayleeRead:'warm'`, relationship +5 |
| `squeeze` (+3) | "Fine — but the cooler rides on her lap. We're late." | **Haylee:** "I've held heavier things on my lap." **Brittney:** "HAYLEE." | `haylee:'aboard'`, `hayleeRead:'dry'`, relationship +3 |
| `noRoom` (+0) | "There's no room. She'll catch the next ride." | **Brittney:** "…She IS the next ride. You're ours." Haylee waves you off without getting up. | `haylee:'left'`, relationship +0 |

Haylee aboard → two or three live road lines before Vantage (proposed, red-pen):
- mi ≈ 118 — **Haylee:** "Does she always pick the drivers, or did this one pick her?" **Brittney:** "Drive."
- mi ≈ 128 — **Haylee** (after a clean pass): "Okay. That was smooth." / (after an impact): "Brit. Brit, is this the ride you texted about?"
- Haylee never flirts and never mentions the phone (she doesn't know); she is the outside eye.

Her own read (`hayleeRead`) is a flag, not a meter: warm / dry / (none).  It only colours the
reunion line.  See Q9.

### Objective 3 — SHED THE UNIFORM · Vantage · node `vantage_change` (virtual, chained BEFORE `vantage_arrival`)

Wardrobe lock respected: she is in the Gas-N-Sip uniform for the entire ride; this is the five
minutes at Vantage before she walks up to her friends.  Portrait: Brittney.

**Brittney:** "Okay. Stop here. I am not walking up to my babes smelling like the roller grill
with a name tag on. Five minutes. There's a bathroom by the boat launch — or your back seat, if
you turn around and swear on your car."
*(need: privacy + five minutes · her: "swear on your car" · clue: she's asking, not telling —
she wants to see what the player does when there's nothing in it for them)*

Where the clothes come from (proposed, see Q7): Haylee aboard → the duffel ("Haylee brought my
stuff. Told you she's the smart one."); Haylee not aboard → she flips the uniform shirt inside out
and ditches the name tag ("Improvised. Don't look at the seams.").

| id | Player says | She says | Effect |
|----|-------------|----------|--------|
| `guard` (+5) | "Take all the time you need. I'll stand out here and not turn around." | She comes back the same girl with no name tag, and something in her shoulders has let go. "Okay. Now I'm here." | `changed:'full'`, relationship +5 |
| `timed` (+3) | "Five minutes. I'm timing it." | She changes the shirt, keeps the work pants, and throws the name tag at you. "Souvenir." | `changed:'partial'`, relationship +3 |
| `asIs` (+0) | "They're your friends. They've seen you in worse." | She gets out in the uniform. She doesn't look back. | `changed:'none'`, relationship +0 |

Payoff: the Vantage arrival/reunion art reads her state — confident & self-directed / improvised /
still in uniform (name tag on).  Whether that is three art variants or one panel plus caption is
Q11.

### Scoring, gates, and what the numbers do

- Each objective: +5 / +3 / +0 to Brittney's relationship (Country), exactly as Chat specified.
  Skipping the Ellensburg exit = +0 (same as `noRoom`), remembered separately (`haylee:'skipped'`).
- No Nerve from objectives (proposed): Nerve is earned by needs + driving; these are story.  Q5.
- Chat's "a high score from flirting ≠ a high score from reliability" — proposed gate: **RIDE 'EM
  additionally requires at least two of the three objectives at partial-or-better** (`supplies`,
  `haylee` aboard, `changed`), on top of rel ≥ 80 / nerve ≥ 10 / 5 clean passes.  STANDARD and
  BARELY unchanged.  Q8.
- Flags are the callback surface: `supplies`, `haylee`, `hayleeRead`, `changed` → reunion caption,
  montage cells, and (later) the StageWagon celebration tiers.

### Art this adds (append to ART NEEDED when approved)

| Key | File (proposed) | Shape | Brief |
|-----|-----------------|-------|-------|
| `country.cleelum_supply` | `country/cleelum/cleelum_01_supply_run.png` | ORD 16:9 | Huff's Gas at dusk, Brittney (uniform, name tag) at the open beer-cave door holding a bag of ice against her hip, the player's car at the pump in the foreground. Faces upper-left; lower third free for the tray. |
| `country.ellensburg_haylee` | exists (`ellensburg_01_haylee_pickup.png`) | — | owner visual approval only |
| `country.vantage_change` | `country/vantage/vantage_01b_change.png` | ORD 16:9 | Vantage boat launch, golden hour; the player leaning on the hood facing the river, back to the car; Brittney's silhouette behind the open rear door, name tag on the roof. No face needed for her — the point is the player NOT looking. |
| `country.vantage_arrival.reunion` | exists (`vantage_02_haylee_reunion.png`) | — | Q11: three variants (confident / improvised / uniform) or caption-only |

### Questions for the owner (not decided)

1. **Supply run at Cle Elum** (mi 84) — or earlier at Easton (Gas-N-Sip only, no gas station) /
   Snoqualmie Pass?  Cle Elum is my recommendation: it has Huff's + a store, and it keeps
   Ellensburg for Haylee.
2. **Objective and a need on the same stop:** defer the need to the next stop (recommended), or
   chain it (objective tile → need tile, two taps at one stop)?
3. **Brittney's age** is not fixed anywhere.  Haylee is 24; propose Brittney 23–25 so the beer
   cave is clean.  Pick a number.
4. **Costs:** $40 full / $15 partial from the real wallet (like sushi $14 / burrito $9)?
5. **Nerve:** none from objectives (recommended) or the same +5/+3/0 as the needs?
6. **Blowing past Exit 109:** +0 like refusing her (recommended), or a real penalty?
7. **Clothes source:** Haylee's duffel when she's aboard / inside-out shirt when not (recommended),
   or add a shirt purchase at CowBella (Cle Elum or Ellensburg) as a fourth mini-choice?
8. **RIDE 'EM gate:** add "2 of 3 objectives at partial-or-better" (recommended), or leave RIDE 'EM
   purely rel/nerve/passes?
9. **Haylee's read:** keep it as a flag that only colours the reunion line (recommended), or make
   it a scored meter as the Haylee profile proposed?
10. **Haylee road lines:** two, three, or none until the comic system is rebuilt?
11. **Vantage arrival art:** three variants of the reunion panel, or one panel + caption?
12. **Node ids** `cleelum_supply` / `ellensburg_haylee` / `vantage_change` and flag names above —
    confirm before any art is commissioned so keys never rename.

## OWNER ANSWERS on the objectives draft — 2026-09-10 (later) — and what is NOW IN CODE

Owner answered all twelve questions; draft 1 above is superseded where they differ.

| # | Owner's call | In code |
|---|--------------|---------|
| 1 | Supply run is FOR Vantage, so it happens at **Ellensburg**, not Cle Elum | `ellensburg_haylee` → `ellensburg_supply` chain at stop E |
| 2 | The need can run **after** the objective panel | Both are mandatory at E; the queue shows the chain, then the pending need |
| 3 | Brittney is **26** (does not need to be in dialogue) | not in dialogue; recorded in canon memory |
| 4 | Costs $40 / $15 fine | `SUPPLY_FULL_USD` / `SUPPLY_QUICK_USD` |
| 5 | (Owner read "three" as characters — the question was whether the three OBJECTIVES give Nerve) | Implemented as relationship-only, NO Nerve; flagged to the owner for a yes/no |
| 6 | Skipping Exit 109: **−5** ("negative feels better") | `onPass.E`: −5, `haylee:'skipped'`, she says "That was my best friend."; `onUnpass.E` reverses on rewind |
| 7 | She HAS a white tank top and jeans with her; images already made | `vantage_change` line says so; `guard`/`timed` resolve to `mercer_03_changed_to_road_clothes.png` (was UNWIRED/REJECTED as a Mercer-time change; re-purposed for Vantage, checklist updated) |
| 8 | RIDE 'EM needs 2 of 3 objectives: **yes** | `countryOutcome` gate via `countryObjectives(st) >= RIDE_EM_OBJECTIVES` |
| 9 | Haylee's read = **a scored meter** | `flags.hayleeScore` 0–100 from 50: +15 welcome / +5 squeeze / −5 per ≥5 HP impact aboard / +2 per 3 clean passes; `hayleeRead()` warm ≥65 / dry ≥45 / cold |
| 10 | **Two** Haylee road lines | mi 118 ("Does she always pick the drivers…") and 128 (smooth vs "is this the ride you texted about?" by her meter) |
| 11 | Three reunion art variants: fine | keys `country.vantage_arrival.reunion` (full change) / `.reunion_improvised` / `.reunion_uniform` — the last two point at the existing reunion art UNTIL their files exist (swap `art` only) |
| 12 | (keys) | `ellensburg_haylee`, `ellensburg_supply`, `vantage_change`; flags `supplies`, `haylee`, `hayleeScore`, `changeChoice` |

Also in code from the same batch:
- The old first-mile "she changes into road clothes in the passenger seat" beat is REMOVED (it broke the
  wardrobe lock). The `vantage_spotted` intro panel now opens `vantage_change`, and `vantage_arrival`
  only opens after a change choice.
- Two Brittney phone set-up lines on the road (mi 92 "moved campsites AGAIN … FOMO"; mi 104 "Haylee's
  … at the Ellensburg exit … Exit 109") so taking the exit is the choice, like Mercer.
- The reunion beat on `sendOff` writes the caption from all three: cooler (trophy / gummy worms / "You
  came empty?" — "I CAME."), Haylee's read (warm "This one's okay" / dry "drives like a text message" /
  cold "Do NOT get in that car"), or Haylee-left / Haylee-skipped lines.
- Out-of-gas tow (unrelated, same batch): $200 flat and the tow puts a QUARTER TANK in the car.

### ART COMPLETED — additions from this batch (Chat, 2026-09-10)

All four distinct panels are now present at 1672×941. Do not regenerate them unless the owner rejects a specific file. Wire the paths below and preserve the outfit mapping exactly.

| Key | File | Status / locked visual |
|-----|------|------------------------|
| `country.ellensburg_supply` (+ `.fullRun` / `.quickRun` / `.noRun`) | `country/ellensburg/ellensburg_02_supply_run.png` | **DONE.** Huff's Gas at dusk: Player pumping gas, Brittney in full Gas-N-Sip uniform carrying ice, strawberry-blonde Haylee loading the cooler. One shared panel serves all three supply outcomes; do not make three duplicate images. |
| `country.vantage_change` | `country/vantage/vantage_01b_change.png` | **DONE.** Columbia River boat launch at golden hour: Player faces the river and gives Brittney privacy behind the open rear door; her folded uniform, visor, and name tag are on the roof. Replace the reunion-image fallback with this file. |
| `country.vantage_arrival.reunion` | `country/vantage/vantage_02_haylee_reunion.png` | **DONE — FULL CHANGE.** Brittney wears the white tank, denim cutoffs, and plaid shirt tied at her waist. Haylee remains strawberry blonde. This is the canonical/base reunion file. |
| `country.vantage_arrival.reunion_improvised` | `country/vantage/vantage_02b_reunion_improvised.png` | **DONE — PARTIAL CHANGE.** Same reunion staging; Brittney wears the white tank with her red Gas-N-Sip work shorts, no visor or name tag. |
| `country.vantage_arrival.reunion_uniform` | `country/vantage/vantage_02c_reunion_uniform.png` | **DONE — NO CHANGE.** Same reunion staging; Brittney remains in the complete Gas-N-Sip uniform with visor/name tag. This was the former content of the base reunion file and was preserved before the base was corrected. |

## iPHONE / LOCAL-HOST RESTART STABILITY — READ-ONLY AUDIT AND RECOMMENDED CHANGES (Chat, 2026-09-10)

**Owner request:** record what could be changed to make the game more stable. This section is a diagnosis and proposed work order, **not authorization to implement it. Ask the owner before changing the loading architecture, eviction rules, orientation recovery, or asset quality.** The owner has reported that restarting is much better overall, but has begun occurring a little more often again; one observed restart followed 30+ minutes with the game not being played and occurred shortly after returning.

### What the audit confirmed

- This still looks primarily like **iOS/WebKit memory termination**, not a deterministic JavaScript exception. The complete automated suite currently passes (2,100+ assertions/checks across launch, audio, story, comic, police, etc.).
- Vite HMR is already disabled in `vite.config.js`, so Claude/Codex saving a source or art file should not automatically reload the phone's localhost page.
- Actual asset-dimension measurement of the current manifests:
  - Boot manifest: **315 entries; 312 measurable image files; approximately 609.3 MiB decoded RGBA**.
  - Deferred rest-stop manifest: **36 entries; approximately 216.0 MiB decoded RGBA**.
  - After the first rest stop, the code retains those rest-stop textures in Phaser's game-level TextureManager, producing an estimated **825.3 MiB of decoded textures** before browser, canvas, framebuffer, audio, JavaScript heap, and temporary resize/re-upload overhead.
  - The project's own `TextureBudget.js` target is **250 MiB**, so boot alone is about 2.4× the target and the post-stop state is about 3.3× it.
- Largest manifest groups by decoded size:
  - `biomes`: ~135.0 MiB
  - `cars`: ~117.8 MiB
  - `buildings`: ~92.8 MiB
  - `ui`: ~79.3 MiB
  - deferred `npc`: ~78.0 MiB
  - deferred `npcBusinesses`: ~72.0 MiB
  - deferred `shopfronts`: ~66.0 MiB
  - `groundTextures`: ~48.0 MiB
- The September 9 manifest split improved startup by deferring the three rest-stop groups, but `RestStopScene.preload()` currently loads **all 36 deferred textures at the first stop** and intentionally keeps them for every later stop. It postpones approximately 216 MiB rather than removing or bounding it.
- Three persistent rest-stop assets were added after the split: Brittney's business portrait, Brittney's Mercer storefront, and Haylee's portrait. Together they add approximately **18 MiB decoded** to the post-stop resident set. That is not the root cause, but it can plausibly make an already marginal process restart somewhat more frequently.
- Live story-panel handling is comparatively bounded: `StoryTile` tracks panel textures loaded by a conversation and removes them on teardown; `ComicReader` caps its decoded HTML-image cache at six panels (~36 MiB at 1672×941) and releases it when closed. New story files that are not opened do not consume decoded memory merely because they exist on disk.
- Rotation coalescing and the unchanged-size guard remain sensible. Rotation is more likely the **trigger at the memory cliff** than the source of hundreds of retained megabytes.
- After a page has been hidden for 30 seconds, `main.js` probes WebGL texture handles. If any sampled wrapper is invalid—or if the probe throws—it rebuilds every wrapped GPU resource. A legitimate recovery can therefore produce a large transient re-upload/allocation spike. The owner's long-background restart fits either iOS discarding the already-heavy WebKit process while hidden or this recovery spike on return.

### Recommended change order — ask owner before implementation

#### P0 — Stop loading every rest-stop asset at the first stop

Replace `restStopManifest()` as an all-or-nothing preload with a **per-stop working set**:

1. Load only the storefronts/business portraits actually offered at the current stop.
2. Load only the encounter/story portraits needed by the current stop and current active storyline.
3. On leaving the stop, remove textures that are not required by gameplay, the next stop, or an explicitly small cache.
4. If a small cache is desirable, make it a measured LRU with a decoded-byte ceiling—not “everything visited stays forever.”
5. Do not preload alternate character/outcome images. Load the one resolved panel only.

This is the most direct high-value change: it prevents the first stop from adding the full 216 MiB resident set.

#### P0 — Reduce the 609 MiB boot working set

The boot split is still far above the 250 MiB budget. Convert more global groups into route/scene working sets:

- Biomes/ground: keep the current region plus a small look-ahead/look-behind window; evict regions safely behind the player.
- Buildings/business signs: load only those reachable in the current/nearby route section.
- Cars: avoid keeping every vehicle/angle/culture set decoded. Keep the selected player set plus bounded traffic/chase sets required near the current mile.
- UI: separate title/menu, driving, rest-stop, garage, and ending art so mutually exclusive screens do not all need to remain decoded.
- Preserve source quality on disk; this recommendation is about **when decoded textures are resident**, not indiscriminate image degradation.

Set measurable ceilings for each phase (cold boot, driving, rest stop, comic, rotation/resume), with the total remaining below the agreed mobile budget.

#### P1 — Make background GPU recovery bounded and fail closed

Review `main.js`'s >30-second visibility recovery:

- A failed/throwing probe currently returns `true` and triggers the expensive full rebuild. Failure to prove health should be logged and handled conservatively rather than automatically allocating every resource again.
- Rebuild only invalid/currently required texture and rendering resources where Phaser permits it; avoid recreating unrelated deferred assets.
- Ensure old GPU handles/resources are explicitly released before or during replacement where safe.
- Add a cooldown/one-shot guard so repeated visibility or orientation events cannot initiate overlapping recovery.
- Test four separate cases on the oldest supported iPhone: brief app switch, 30+ second background, Safari tab eviction, and rotate immediately after resume.

#### P1 — Instrument the exact restart boundary

Use the existing `window.__texReport(label)` / `window.__texTop()` support and add lightweight persistent breadcrumbs—without retaining screenshots or large arrays—at:

- Boot complete
- Immediately before and after first rest-stop preload
- Rest-stop exit after eviction
- Story tile open/close
- Comic open/close
- `visibilitychange` hide/show
- Immediately before and after GPU recovery
- Orientation/resize settle

Persist only the latest small record in localStorage: time, lifecycle event, scene, mile, texture count/estimated MiB, visibility state, orientation, whether WebGL recovery ran, and whether a JS error marker was set. On next launch, show or log whether the previous session ended after a JS error, while backgrounded, during rotation, during a rest-stop load, or during GPU rebuild. This distinguishes memory termination from code-triggered scene restarts.

#### P1 — Add enforceable memory regression tests

Current launch tests enforce entry counts, but count is a weak proxy because one 1086×1448 portrait costs about 6 MiB decoded. Add tests that read real image dimensions and fail when:

- boot decoded total exceeds the approved ceiling;
- any scene/stop working set exceeds its ceiling;
- a new manifest asset is added without an owning scene/group and eviction policy;
- all rest-stop or all story assets become reachable from one preload path;
- mutually exclusive culture/car sets are simultaneously included in a mobile working set.

#### P2 — Verify lifecycle cleanup; do not start here

Audit RestStop/Game scene shutdown handlers, loader listeners, delayed calls, generated textures, render textures, and DOM listeners for accumulation across repeated visits/restarts. Nothing in the quick audit points to a leak here as large as the manifest problem, and the tests pass, so do this after P0/P1 rather than treating it as the primary theory.

### Acceptance test for a stability change

Before calling the problem improved, run the same route on the oldest supported iPhone and record texture totals at cold boot, after Mercer, after multiple later stops, after opening/closing the comic repeatedly, after 30+ minutes backgrounded, and after repeated portrait↔landscape rotations. Memory should plateau inside the approved budget rather than climb toward ~825 MiB. A restart without a JS-error marker, especially after backgrounding or rotation, should continue to be treated as probable WebKit memory termination.

## OWNER COURSE CORRECTION — COMIC PILOT WORKFLOW (2026-09-10)

**This section overrides any interpretation of the earlier workshop that turns the owner into a panel-by-panel bubble-position tester.** Claude's technical directions remain useful, but the owner's direction sits on top of them and wins whenever they conflict. If a Claude-authored instruction appears to negate, weaken, or reinterpret an owner instruction, stop and ask the owner rather than choosing Claude's interpretation.

### The train that must be put back on the tracks

The owner did **not** agree to an open-ended loop where Claude displays one screenshot, the owner explains why an individual text box is wrong, Claude nudges it, and the cycle repeats. The agreed objective was:

1. Build a **reusable comic presentation system**, not hand-place the entire book with the owner.
2. Prove the system on a **small representative pilot** before rollout.
3. Have Claude and ChatGPT/Codex perform the technical and visual QA through the shared notes/review folder.
4. Bring the owner one coherent gameplay demonstration for high-level approval, or ask a genuinely creative/story question that cannot be resolved from existing canon.
5. Once the pilot passes, apply the rules systematically and surface only exceptional panels that truly require owner judgment.

The owner is the creative director, not the production placement operator. Do not ask the owner to specify pixel coordinates, tail angles, individual bubble widths, or repeated micro-adjustments.

### Current pilot review — NOT ready for owner approval

Chat/Codex reviewed the normal and debug images in `review/comic_pilot_2026-09-10/`. The package proves that the underlying sequence can be captured, but it does not yet prove the promised comic system.

Observed system-level defects:

- `03_seattle_offer_tray.png`: Malik's second balloon is a large wall of text pushed against/off the right side. It violates the intended 5–10-word norm and 20–25-word hard ceiling per balloon. Long dialogue must become several timed, leapfrogging balloons or another tile; it must not be solved by one oversized box or smaller lettering.
- Several tails technically avoid a protected rectangle but point at a visor, roof, door, or empty area rather than clearly identifying the speaker's mouth. Collision avoidance alone is insufficient; speaker attribution must also read correctly.
- The response tray still reads as two or three full-width game-menu bars in condensed display type. The owner asked for responses that feel like spoken dialogue: mixed-case, readable comic lettering, softer/translucent balloon or dialogue-tab treatment, and clear separation without overwhelming the artwork.
- The screenshots emphasize final static placement. They do not demonstrate the central interaction contract: wait indefinitely for Player choice; add the selected Player balloon; add any following NPC balloons in the same tile; hold 3 seconds when Player is last or 6 seconds/long-text extension when an NPC follows; tap to skip the hold; then slide; allow scroll-back.
- The normal screenshots do not show that the same ordered/ratio-authored tiles translate coherently into the permanent menu comic, where placement changes but tile heights, ratios, reading order, captions, and dialogue identity remain compatible.
- The caption in `11_mercer_departure_caption.png` is the correct **content type**, but the tails still do not convincingly identify Player and Brittney. This should be solved through validated speaker anchors/fallbacks, not by asking the owner to move them by eye.
- Eleven normal plus eleven debug screenshots are useful engineering evidence, but they are too granular as an owner-facing approval flow. They belong in Claude↔Chat/Codex QA.

### Required workflow from this point

#### Phase 1 — Freeze owner-facing iteration

- Stop presenting individual bubble placements to the owner for correction.
- Do not roll the current placement logic across the rest of the comic.
- Do not generate or alter story artwork to conceal layout failures.
- Do not rewrite approved dialogue merely to make a weak layout algorithm fit, except to split the exact dialogue into approved ≤25-word balloons without changing its wording or meaning.

#### Phase 2 — Claude completes the three representative SYSTEM pilots

The original three pilot subjects remain correct, but each is a **flow**, not merely a screenshot:

1. Seattle introduction/offer: real multi-option response tray, selected Player balloon, Malik continuation, long-dialogue splitting, and tile advance timing.
2. Mercer counter→hook→fork: full introduction gates the storefront, alternating dialogue is sequenced, and “Me or the phone” behaves as a genuine decision.
3. Mercer departure: square caption plus Player and Brittney speech balloons with unmistakable speaker attribution and no protected-region collision.

For each flow, validate both:

- live gameplay strip behavior; and
- the resulting permanent comic rendering.

Claude should use scripted/dev controls to exercise every state without asking the owner to replay and narrate each failure.

#### Phase 3 — Automatic QA must reject bad layouts

A candidate is not a pass merely because its rectangle is green in the current debug overlay. Add/check these gates:

- No speech balloon above 25 words; target 5–10.
- Minimum readable font and padding floors remain intact.
- Balloon body, text, tail base, and complete tail path avoid protected faces, hands, phones, clues, and tray-risk regions.
- Tail endpoint/route unmistakably attributes the correct visible speaker. If a mouth is obscured or off-panel, use an authored safe edge direction, off-panel speaker convention, or no-tail caption—not a tail aimed at a random object.
- Reading order is obvious without debug numbers.
- No balloon is clipped, flush against the viewport, or hanging outside its intended gutter.
- Response tray never covers required art and reads as speech choices rather than settings/menu buttons.
- If no legal placement exists, the engine must split the dialogue/tile or flag the panel for Claude↔Chat review. It must not silently shrink, overlap, or ask the owner to place it.
- The tile must pass at the phone's actual CSS size, not only in a large desktop capture.

#### Phase 4 — Claude↔Chat/Codex review loop

Claude owns code execution and capture. Chat/Codex owns the visual/comic-design critique. Use this shared handoff:

1. Claude updates the pilot and saves a concise set of normal + debug evidence in the review folder.
2. Claude writes one short note identifying what changed, which automated gates pass, and any unresolved exceptions.
3. The owner can tell Chat/Codex “review Claude's comic pilot.” Chat/Codex reviews the package and writes actionable system-level feedback here.
4. Repeat between Claude and Chat/Codex until the pilot is coherent. Do not route ordinary spacing/placement decisions through the owner.

This does not mean Claude should blindly obey Chat/Codex over the owner. Owner canon and explicit owner directions remain authoritative. Any genuine conflict goes to the owner as a concise question before implementation.

#### Phase 5 — What the owner should finally receive

Present one short, coherent demonstration of the three flows at actual iPhone scale, preferably as a brief screen recording or a minimal sequence—not 22 diagnostic images. Include only:

- how the live conversation reads and advances;
- how choices feel as verbal responses;
- how the same beats appear in the menu comic; and
- a short list of any remaining **creative** decisions.

Owner approval is about overall feel, pacing, readability, humor, and story—not correcting each tail by hand.

### Rollout boundary

Do not bulk-author coordinates for the remaining panels until the pilot passes the rules above. After it passes, automatically process straightforward panels and create an exception list only for panels where safe placement, speaker identity, or story emphasis remains genuinely ambiguous. Group those exceptions for one owner/Chat review rather than interrupting the owner one image at a time.

## OWNER DIRECTIVE — RANKED PLACEMENT ZONES, LINKED BALLOONS, AND VISUAL VARIETY (2026-09-10)

This directive refines and overrides the pilot's earlier binary `protect` interpretation. A panel does not consist only of “protected” and “available” pixels. Author and score **multiple semantic levels** so the placement engine knows what it may cover first and what it may never cover.

### Zone hierarchy

The owner’s hierarchy, from most protected to least protected:

1. **Level 1 — faces: absolute exclusion.** Nothing may cover a face: not a balloon body, caption, text, tail base, connecting tail, speaker tail, response tray, label, or sound effect. A tail may point toward a mouth but must stop before entering the face boundary. Give the face boundary a small safety margin so strokes do not visually touch it.
2. **Level 2 — essential bodies and story objects: strongly protected.** This includes the body/gesture needed to read the acting, plus objects necessary to understand the beat: phone, handoff, hospital bill, cooler, instrument, car damage, weapon, name tag, relevant clothing state, and similar story evidence. Avoid these whenever possible. Partial overlap is permitted only after all placements that use empty space or Level 3 have failed, and the overlap must leave the action/object understandable.
3. **Level 3 — ordinary scene detail: preferred overlap zone.** Background architecture, sky texture, shelves, pavement, foliage, nonessential car surfaces, and other atmosphere may be covered before Level 2. The engine should still prefer clean negative space, but this is the first semantic material it is allowed to sacrifice.

In addition, treat **unmarked negative space** as Level 0/preferred placement: try to place the complete balloon/caption outside every marked level before covering anything.

Required fallback order:

1. Entire box/tail in unmarked negative space.
2. Entire box/tail using only Level 3 scene detail.
3. Box/tail spanning negative space plus Level 3.
4. If still impossible, allow the smallest useful overlap with Level 2 while using Level 3/negative space for the rest.
5. Try an alternate shape, attachment edge, linked-balloon arrangement, gutter position, or a crop that passes the crop-safety rules below.
6. Split the dialogue into another linked balloon or another tile.
7. **Never fall through into Level 1. Faces remain forbidden even when every other candidate fails.** Return a layout exception instead.

This is a weighted layout problem: Level 1 overlap has infinite/reject cost; Level 2 has a very high cost; Level 3 has a modest cost; negative space has zero cost. Score the complete visible geometry, not only the balloon's rectangular bounding box.

### OWNER ADDITION — crop safety for Levels 1–2 and all lettering (2026-09-11)

Cropping is subject to the same semantic hierarchy as text placement. A crop may remove **Level 3 scene detail only**. It must never clip, trim, hide, or push outside the visible panel any part of:

- **Level/layer 1:** a protected face, head, hair silhouette, or its safety margin;
- **Level/layer 2:** a story-essential body, gesture, interaction, prop, vehicle, phone, or other object needed to understand the beat; or
- **any text element:** words, balloon body, caption box, outline, padding, tail, linked-balloon connector, thought-bubble trail, phone/electronic zigzag, sound effect, or speaker label.

This is an absolute rule, not a scoring preference. Level 1, Level 2, and text must be **fully contained** inside the final visible panel—not merely intersecting it or having their center points inside it.

Required rendering order and behavior:

1. Resolve the destination slot, scale, and proposed image crop first.
2. Transform all authored Level 1 and Level 2 regions into final visible-panel coordinates.
3. Reject any proposed crop that does not fully contain every Level 1 or Level 2 region required for that beat, including its safety margin. Cropping may not make a protected region disappear from collision checks.
4. Lay out balloons, captions, tails, connectors, labels, and sound effects only after the crop is known.
5. Run a final containment check on the complete rendered geometry of every text element. Keep it inside the panel by at least the larger of the rendered stroke width or 2 screen pixels at the target display size.
6. Repeat these checks separately for live gameplay, scrollback, the menu comic, hold-to-zoom, screenshots, and exported pages at every supported orientation and slot ratio.

If the selected slot cannot satisfy these rules, do not force the crop and do not silently accept clipping. Recompose in this order: choose another focus/crop, use fit or letterboxing, extend nonessential background/negative space, change or reflow the page template, give the panel a wider slot, or split the beat/dialogue across linked balloons or another tile. Return a layout exception if none of those options works.

QA must report separate counts for `croppedLevel1`, `croppedLevel2`, and `croppedText`. Every count must be zero. A report may not claim `pass: true` when any of those counts is nonzero, including on a narrow phone, after rotation, or on an incomplete final comic page.

### OWNER ADDITION — intentional line wrapping and authentic balloon variety (2026-09-11)

The lettering must look composed by a comic letterer, not like ordinary UI text placed inside a rounded rectangle. Professional lettering guidance generally shapes dialogue into a compact oval or soft diamond: shorter lines near the top and bottom and longer lines through the middle, with comfortable air between the lettering and outline. Sources for implementation and review include Todd Klein's [balloon lettering guidance](https://kleinletters.com/Blog/more-about-pen-lettering/), Nate Piekos/Blambot's [comic-book grammar and balloon conventions](https://blambot.com/pages/comic-book-grammar-tradition), and Blambot's [professional lettering tips](https://blambot.com/pages/lettering-tips).

#### One-word-line rule

Do not leave a single word stranded on its own line when the complete dialogue contains three or more words. A one-word line is permitted only when:

- the entire dialogue contains only one or two words;
- the writer explicitly marks that word as a dramatic beat or visual emphasis; or
- every line is intentionally one word, creating a deliberately tall, narrow balloon whose shape and scene composition support that effect.

An automatically produced one-word first, middle, or final line is a failed wrap—not acceptable merely because the text technically fits. Reflow before rendering by trying, in order: different natural phrase breaks, a modestly wider or differently shaped balloon, balanced tracking within the approved readability range, or a linked second balloon at a real pause in the speech. Do not solve an orphan by shrinking the type below the readable minimum, changing the dialogue, covering a higher-priority zone, or cropping protected content.

Score candidate line breaks for all of the following:

- no unapproved one-word line;
- phrases remain together where a speaker would naturally pause;
- the outer text silhouette suits the balloon—normally short/wide/short rather than a rectangular block;
- adjacent line lengths change gradually instead of producing an accidental shelf or spike;
- the reading order remains obvious; and
- the final balloon remains comfortably padded and visually balanced.

#### Creative shape system—not random decoration

Build a reusable vector balloon grammar with controlled organic variation. Balloons from the same family may vary in width, height, asymmetry, curvature, attachment edge, and lobe placement so repeated panels do not look stamped from one template. However, unusual outlines must communicate how the line sounds or how it is delivered. Do not randomly assign dramatic shapes merely to make every balloon different.

The supported families should include at minimum:

- **ordinary speech:** softly irregular oval, egg, capsule, or rounded lozenge; calm and highly readable;
- **compact or dry reply:** small tight oval/lozenge with generous padding, including intentionally isolated one- or two-word replies;
- **linked thought/continued speech:** touching balloons for one continuous thought, or a narrow connector between distinct successive thoughts; linked balloons may leapfrog across the panel in reading order;
- **whisper/private speech:** restrained dashed outline and/or smaller muted lettering with extra air—not an oversized novelty cloud;
- **shout/anger:** irregular burst or roughened outline with heavier lettering, with spike count and intensity proportional to the delivery;
- **phone/radio/electronic speech:** visually distinct transmitted-speech outline and a narrow zigzag/electric tail;
- **fear, injury, exhaustion, or fading speech:** controlled wavy or trembling outline with broken cadence;
- **thought/internal voice:** narration caption by default; use a cloud balloon and diminishing circular trail only when the story deliberately calls for the traditional effect;
- **off-panel speech:** balloon at the panel boundary with an open-ended or boundary-directed tail; and
- **narration/context:** rectangular or clipped-corner caption boxes without speaker tails, visually distinct from spoken dialogue.

The system should also support occasional butted balloons, curved or S-shaped tails, interrupted balloons, overlapping/linked clusters, balloons partly occupying gutters when the page design permits it, and border shapes tailored around available negative space. These are layout tools, not decoration. All remain subject to reading order, narrow-tail, protected-zone, and crop-safety rules.

#### OWNER CORRECTION — joins are open bridges, not enclosed decorations (2026-09-11)

The current diamond, double-diamond, and fully outlined rectangle shapes placed between balloons are not acceptable as ordinary balloon connectors. They read as additional empty boxes or decorative symbols instead of one continuous dialogue chain.

Use the established comic-lettering distinction described by Comicraft's [Creating Tails and Joins](https://balloontales.com/creating-tails-and-joins/), Blambot's [Joining Balloons](https://blambot.com/pages/comic-book-grammar-tradition), and the illustrated [LetterMyComic joining guide](https://www.lettermycomic.com/guide):

1. **Direct join for closely related speech:** overlap the two balloon bodies and union them into one continuous filled silhouette. Remove the internal outlines where the shapes overlap. There is no intermediary diamond, rectangle, or seam.
2. **Bridge connector when balloons need separation:** draw an open neck/band between the two balloons. A vertical bridge has only its left and right edge strokes; its top and bottom remain open into the balloon bodies. A horizontal bridge has only its top and bottom edge strokes; its left and right ends remain open. The fill flows continuously from one balloon through the bridge into the next.
3. **No end caps:** never draw a four-sided rectangle, closed diamond, double diamond, bow tie, outlined chain link, or other completely enclosed shape between ordinary balloons.
4. **Simple geometry first:** bridge edges should usually be straight and direct, approximately parallel or only subtly tapered. A gentle curve or S-shaped route is allowed when needed to travel around protected art. Do not zigzag merely for decoration.
5. **Keep connectors subordinate:** the bridge must be visibly narrower than either balloon and should not look large enough to contain another line of dialogue. It receives no text.
6. **Preserve outline continuity:** where a bridge enters a balloon, suppress the balloon outline across the entire opening so the junction reads as one open passage. Do not leave a line running behind or across the connector.
7. **One actual speaker tail:** a linked group from the same speaker normally needs one narrow pointer toward that speaker, not a separate speaker tail from every balloon. The bridge between balloons is not a speaker tail and never points at a face.
8. **Use meaning to choose the join:** directly touching/merged balloons imply one continuous thought; a visible bridge can introduce a small pause, separate successive ideas, or organize a staggered exchange. A true dramatic pause may justify separate unconnected balloons.

Diamonds and other closed shapes may exist only as deliberately authored **balloon bodies** for a specific voice or story effect. They are never the default plumbing between balloons.

Add connector-specific QA failures: `closedConnector`, `interiorJoinSeam`, `connectorEndCap`, `connectorTooWide`, and `decorativeConnector`. Every count must be zero for pilot approval. The balloon contact sheet must show direct merged joins, short vertical and horizontal open bridges, one longer protected-zone-avoiding bridge, and an intentionally separate unconnected pair for comparison.

Claude should implement and demonstrate this as a **balloon contact sheet** before another panel-by-panel correction cycle: show every family at normal and narrow-phone sizes, several organic silhouettes within each family, valid and invalid line wraps, linked exchanges, and the same examples after rotation and book-page placement. Chat and Claude can reject technical failures from that sheet; the owner should only need to approve the overall visual language and any genuinely subjective style choices.

#### ART-DIRECTION DELIVERABLE — SVG balloon library pilot 01 (2026-09-11)

Chat created the first reviewable balloon art library. This is an **approval pilot, not authorization to integrate it yet**:

- contact sheet: `review/comic_balloon_library_2026-09-11/contact-sheet.svg`
- rendered preview: `review/comic_balloon_library_2026-09-11/contact-sheet.png`
- reusable SVG masters and implementation manifest: `public/assets/ui/comic/balloons/`

The folder separates balloon bodies, speaker tails, and open bridges. It contains ordinary organic families, a compact reply, player lozenge, whisper, shout, electronic, distress, thought, and narration caption designs plus straight/curved/electronic tails and vertical/horizontal open bridges. No story art was generated or duplicated.

Do not substitute newly invented procedural diamonds, connector boxes, or runtime-random silhouettes when this library is integrated. First obtain owner feedback on pilot 01, revise the masters/contact sheet if requested, and only then wire the approved SVG language into both the live tile and permanent comic renderers.

### Metadata model

Field names may differ, but the data must preserve the hierarchy explicitly rather than flattening everything into `protect`:

```js
zones: [
  { level: 1, kind: 'face', speaker: 'brittney', shape: /* rect/polygon */ },
  { level: 2, kind: 'body', speaker: 'brittney', shape: /* rect/polygon */ },
  { level: 2, kind: 'phone', storyObject: true, shape: /* rect/polygon */ },
  { level: 3, kind: 'sceneDetail', shape: /* rect/polygon */ }
]
```

Existing `protect` records should be migrated/classified rather than automatically treated as equal. Rectangles are acceptable for the pilot, but polygons/masks may be useful where a large rectangular body box would unnecessarily forbid clean space around an arm or silhouette.

The debug view must color each level differently and report how much of each candidate overlaps Levels 2 and 3. A “green” candidate means **zero face overlap and the best available semantic score**, not merely that it stayed inside the panel bounds.

### Reading order — upper-left first

The balloon closest to the panel's **upper-left** is the first balloon in reading order. Later balloons progress naturally rightward and/or downward. Placement must make the authored sequence visually obvious without numbered debug labels.

- Do not place balloon 2 above or meaningfully farther left than balloon 1.
- Do not create a zig-zag that asks the reader to jump backward toward the upper-left.
- When balloons occupy roughly the same horizontal band, read left to right.
- When moving to a new band, read top to bottom and begin again at its leftmost balloon.
- The debug overlay should number the resolved order and fail layouts whose geometric reading order contradicts the authored dialogue order.

This rule governs visible balloons on a completed tile. Live sequencing still reveals them in authored order, but the final accumulated tile must also read correctly when revisited or placed in the permanent comic.

### Linked/attached balloons

Text balloons may use tails or bridges that **attach one balloon to another**, allowing short pieces of dialogue to form a designed chain instead of one oversized rectangle.

- A continuation from the same speaker may use a short connecting tail/bridge from balloon 1 to balloon 2; the balloon nearest or last connected to the visible speaker carries the speaker-pointing tail when that gives the clearest attribution.
- Connected balloons inherit one clear reading chain from the upper-left outward/downward.
- A connector is part of the collision geometry. It may cross Level 3 first, Level 2 only as a last resort, and never a face or another balloon's text.
- Alternating speakers should normally remain visually distinct and point to their own speakers. Do not connect unlike speakers in a way that makes attribution ambiguous.
- Linked balloons are a preferred solution for Malik's long Seattle explanation: preserve several short rhythmic statements rather than one giant text wall.

### OWNER CORRECTION — tail length is unrestricted; tail width is constrained (2026-09-10)

Do **not** impose a maximum tail length. A long tail is valid when the balloon must sit in safe negative space far from its speaker. The defect in the current pilot is not length by itself; it is that several tails widen into enormous white wedges that dominate the artwork and cover too much Level 2/3 material.

- Tail width must **not scale up with tail length**. Long tails remain narrow.
- Prefer a slender tapered ribbon, curved pointer, or narrow multi-segment route over a broad triangle.
- Starting implementation target: speaker-tail base no wider than about `1.25 ×` the rendered text line-height; hard ceiling `1.75 ×` line-height. A balloon-to-balloon connector should normally be no wider than `0.75 ×` line-height. These are responsive limits, not source-image pixels.
- The speaker tip should resolve to a narrow point/stroke; it may approach the mouth anchor but must stop outside the Level 1 face boundary.
- If a straight narrow tail would cross a face or essential object, route it with a gentle bend or controlled zig/zag through negative space or Level 3. Do not solve routing by broadening the tail.
- Measure collision using the actual narrow tail polygon/stroke, not the large triangle between balloon and speaker.
- QA should report tail base width and connector width and fail any tail over the width ceiling. **Do not fail a tail merely because it is long.**

This correction supersedes any review language that calls for limiting tail length. Review long tails for routing, attribution, protected-zone overlap, and width only.

### Different and unique text-box shapes

The owner wants **creative, unique text containers that do not default to rectangles**. “Text box” is only shorthand for the region holding readable text; it does not prescribe a four-sided silhouette. Rectangles and rounded rectangles are members of the system, not its default answer. Shape should support voice, delivery, medium, character, and dramatic beat while remaining readable:

- ordinary speech: organic oval, egg, bean, capsule, gently lobed, or controlled asymmetrical balloon rather than a rounded rectangle;
- playful/flirtatious speech: buoyant asymmetric curves, a subtle tilt, or an offset lobe without sacrificing text fit;
- awkward/hesitant speech: uneven contour, pinched shape, staggered linked bubbles, or deliberately interrupted outline;
- quiet/whispered speech: soft cloud/scalloped silhouette or clearly designed dashed/dotted outline;
- shouting/anger/alarm: angular burst, compressed starburst, or tense zigzag contour;
- worried/threatened speech: taut irregular contour or subtly trembling/wavy edge;
- phone/radio/electronic voice: clipped-corner, stepped, waveform, or compact mechanical silhouette with an electrical/stepped tail;
- thought: cloud form with diminishing thought bubbles;
- narration/action/context: rectangular, notched, ribbon, tab, torn-paper, ticket, road-sign, or location-card caption with no speaker tail;
- Player responses: visually related to speech, but allowed their own recurring silhouette/color family so choices feel spoken instead of like menu buttons;
- linked dialogue: two or more different-size organic balloons joined by a narrow bridge or tail, with the combined outer silhouette composed intentionally;
- absurd cutaway/SFX: custom lettering container or no enclosing shape when legibility permits, rather than an ordinary dialogue balloon.

Do not randomly select a shape from a library. Use authored tone metadata plus character/medium to select an appropriate family, then allow controlled variation in contour, aspect ratio, lobe placement, tilt, tail attachment, and linked arrangement. Consecutive balloons should not look mechanically cloned, but recurring visual grammar must remain recognizable.

The interior text area does not need to mimic the outer contour. Keep a safe, simple inset text region inside expressive silhouettes so words remain comfortably readable. Do not shrink type, crowd lettering against a decorative edge, or make the silhouette so elaborate that it competes with the artwork.

Variety must be **authored by tone/category and constrained by a coherent visual family**, not random decoration. Repeated lines from one speaker may vary subtly, but the reader must be able to recognize speech, thought, phone, narration, whisper, and shout immediately. Shape variation never overrides the face rule, reading order, minimum font, or word ceiling.

### Pilot acceptance additions

The three-system pilot is not ready until it demonstrates:

- all three semantic levels in the debug overlay;
- at least one layout that occupies negative space only;
- at least one layout that deliberately covers Level 3 while preserving Levels 1–2;
- at least one constrained layout that uses a small Level 2 overlap without hiding the essential action;
- a linked-balloon chain whose first balloon is nearest the upper-left;
- at least three clearly different, story-appropriate balloon shapes;
- automatic rejection of every candidate that touches a face;
- identical understandable reading order in the live completed tile and permanent comic.

Claude and ChatGPT/Codex should resolve the ordinary geometry and visual QA under these rules. Ask the owner only if the **classification itself** is ambiguous—for example, whether an object or gesture is essential to understanding the story—not where to move an individual balloon.

## COMIC DIALOGUE WORKSHOP — PILOT REPORT (Claude, 2026-09-10, later)

Owner: "Work through the handoff. Diagnose the Mercer skip and build the three-panel review
pilot before changing the rest of the comic." Everything below is in code; nothing beyond
the three pilot panels (plus the Seattle tiles they lead through) has had placement applied.

### B — Mercer skip: reproduced, exact state transitions (headless, `mercer_probe.mjs`)

| Scenario | Hip-Hop | Country | `pendingAt('M')` | Storefront | HIT THE ROAD |
|---|---|---|---|---|---|
| 1. Fresh run carrying the phone | active, `items.phone`, `mercerDone:false`, ledger `hiphop#0:seattle_offer:carry@<this run>` | available | `[hiphop.mercer_counter!]` | gated by the tile | n/a |
| 2. Old save: a PREVIOUS run chose `mercer_fork.ride` and saw the departure (`departureShown:true`); new run, Seattle skipped | available, replayCount 1 (`resetStory`) | **active**, nodeId `vantage_arrival`, rel 55; `run.passenger = brittney` from mile 0 (`deriveRun`) | `[]` | opens | nothing |
| 3. Same as 2 but `departureShown` never set (save predates the departure tile, or the run ended at the Mercer stop) | as 2 | as 2, `departureShown: null` | `[]` | opens | **boarding tile fires** (`_brittneyDepartureOpen: true`) — the owner's screenshot |
| 4. Hot reload of 3 | flags/status/ledger survive `_sanitizeStoryCanon` (it only strips prototypes) | same | — | — | same as 3 |

Root cause: the plate canon persists across runs BY DESIGN (18.1; tested as "new run: Brittney
still aboard"), so Country from an earlier run is active at the next run's Mercer while
Hip-Hop is back on the shelf. The departure gate keyed only on `isActive('country') &&
!departureShown`, not on WHICH run started Country.

Fixed / provided:
- `RestStopScene._continue` departure gate now also requires `story.startedThisRun('country')`
  (a `startStory:'country'` ledger entry with this run's `runId`). Scenario 3 no longer fires
  the boarding tile; scenario 1 unchanged.
- `?storyreset` URL flag = safe TEST-RESET route: clears only `storyCanon` for the plate
  (stories, ledger, comic volumes). Wallet, garage, plates untouched. (`?wipe` still nukes all.)
- Acceptance "storefront cannot become interactive until the mandatory Brittney sequence
  resolves" holds on the fresh run: `_storyGateDone` runs first, the tile's full-screen scrim
  swallows every tap, SPACE/ENTER are guarded (pilot screenshot 04).
- **Policy question for the owner (not decided):** should an unfinished passenger story
  (Country / Classic Rock ACTIVE from an earlier run) reset to AVAILABLE when a NEW run starts
  from Seattle? Today she is silently in the seat at mile 0 of the next run. I recommend
  yes (reset, keep the ledger for the book); it flips the "still aboard" test.

### A — Fake choice button
- A one-item choice list is no longer a button: the player's authored line plays as a
  balloon after the reading gap, then tap-to-continue. Seattle `seattle_lot.know`,
  `seattle_route.pullman`, Mercer `mercer_counter.ask`, `mercer_hook.sorry` and the
  departure's `board` all play this way.
- The invented crew exchange ("Malik Reed! Stank Records — live from the Park & Ride!" /
  "Not bad." / "Top of NoiseCloud…") and Chat's cocky/dismissive alternates are REMOVED
  (owner: "are you making all of this dialogue up?… the order is wrong"; then "you should not
  be making up any dialogue"). Seattle is the handoff spine in the handoff order, owner's
  words only: `seattle_lot` (cypher art, CAPTION "Stank Records, live from the Park & Ride.",
  Malik line 1, player line 2, "Fair enough.") → `seattle_route` ("Which way you headed?" /
  "Pullman. Eventually." / "Then Mercer's on your way.") → `seattle_offer` (lines 6–9, the
  carry/pass decision). `seattle_clock` and its panel key are gone.
- **Owner (latest): "There should be a choice where player says that they know him and am
  a fan. There's a lot more conversation and choices I don't see."** I will not write those
  lines. The only candidate copy in these notes is Chat's Beat-2 proposal (lines ~1607–1615:
  "Malik Reed? I follow your work. I'm an artist too." → "Then you know what a Friday press
  deadline means.", plus the neutral and dismissive attitudes) which the later handoff
  retired. Owner: approve/rewrite those, or point me at the section with the extra
  conversation, and I wire it verbatim.

### C — Captions are a content type
- Nodes may carry `caption` (narration) beside `line` (speech). Recorded in the ledger
  (`dialogueKeys.caption` / `fallbackText.caption`), indexed in `DIALOGUE_INDEX`, rendered as a
  square tail-less box (its own paper colour, uppercase Comic Neue/Trebuchet) in the live tile
  AND in the book (`ComicReader.drawCaption`). Validator: a node needs a line or a caption, and
  a `line` that reads as narration ("She slides…") fails validation.
- `country.mercer_departure`: caption "Brittney clocks out and meets you beside the car.",
  player speech "Passenger seat's yours. Let's hit the road.", Brittney speech "StageWagon,
  cowboy. Try to keep all four tires under us." ("She slides into the passenger seat" is in
  the art and was dropped, per the handoff.)

### D — Face protection now enforced (`src/ui/balloonLayout.js`, pure, 14 tests)
- Every balloon and caption is placed through `layoutBalloon()`: body rect (+4 px clearance)
  vs every `protect` rect and every balloon already on the tile; the tail is built from the
  balloon edge facing the mouth (now including a TOP edge when the speaker is above), clipped
  to stop 3 px outside the protected face it points at, and REJECTED if it would cross a
  `face` / `hands` / `phone` rect on the way (it may cross `body` / `object` / `car`).
- Slot order: authored → (for replies) directly below / right of the balloon it answers →
  art corners (replies try the LOW corners first) → gutter → forced (flagged `clean:false`,
  logged). Reading order rule from the owner: a reply is never above/left of what it answers.
- Placement is checked against the panel the tile actually shows: on a choice-level art swap
  the opening balloon (placed on the old art) is removed and the player/reply balloons use the
  new panel's protect rects and mouth points.
- Metadata re-measured as faces/hands/objects for the pilot panels (`hiphop.seattle_lot`,
  `seattle_route`, `seattle_offer`, `seattle_offer.carry`, `mercer_counter/hook/fork`,
  `mercer_ultimatum`, `country.mercer_fork.ride`, `country.mercer_departure(.board)`), each
  with `bubble` / `playerBubble` / `replyBubble` (/ `caption`) slots in reading order. The
  old whole-figure boxes (80% of the panel) made every placement "forced".
- Debug overlays: `?comicdebug=1` — red protect rects, magenta mouth points, green balloon
  bounds (red when forced), yellow tail paths, reading-order numbers, orange tray-risk band.
- Placement log for probes: `window.__comicLayoutLog` (kind, slot, clean, tailClipped, rect).

### Tile / pacing changes the owner asked for mid-pilot
- Tile is FULL SCREEN (800×450 = 16:9, no side bars, no crop); the response tray is a
  translucent band over the bottom 104 px, and balloons are kept above it.
- The opening line STAYS on the tile; the reply lands after the player's balloon.
- Pace: `readMs(text)` = 2000 ms + 90 ms per word past eight between balloon appearances
  (opening → player line → reply → TAP TO CONTINUE at +800 ms).

### E — Review folder (normal + debug overlays)
`review/comic_pilot_2026-09-10/normal/` and `review/comic_pilot_2026-09-10/debug/`:
`01_seattle_lot_authored_line`, `02_seattle_route_authored_line`, `03_seattle_offer_tray`,
`03b_seattle_offer_carry_reply`, `04_mercer_counter_gates_shop`, `05_mercer_hook`,
`06_mercer_fork_tray`, `07_mercer_fork_both_reply`, `08_mercer_ultimatum_tray`,
`09_mercer_ultimatum_reply`, `10_mercer_shop_after_sequence`, `11_mercer_departure_caption`
(.png each). Probe: scratchpad `pilot_probe.mjs [0|1]`. Last run: 25 placements — 20 authored,
3 alternates, 2 forced (both read correctly on screen; logged for the metadata pass), no page
errors. Chat/Codex: review these before any placement is applied to the rest of the comic.

### PLACEHOLDER DIALOGUE — owner to rewrite (lines I wrote; in code only because the
### structure needed words — every one is yours to replace, `src/data/featuredStories.js`)
- Country `ellensburg_haylee`: line + `welcome` / `squeeze` / `noRoom` labels and replies.
- Country `ellensburg_supply`: line (two variants) + `fullRun` / `quickRun` / `noRun` labels and replies.
- Country `vantage_change`: line + `guard` / `timed` / `asIs` labels and replies.
- Country `onRoad` set-up lines (mi 92 "moved campsites AGAIN…", mi 104 "Haylee's ride bailed…"),
  Haylee's two road lines (mi 118 / 128), Brittney's "That was my best friend." on passing Exit 109.
- Country reunion beat captions on `vantage_arrival.sendOff` (cooler / Haylee lines).
- Country `mercer_departure` caption "Brittney clocks out and meets you beside the car." (from
  the old node line) and the caption "Stank Records, live from the Park & Ride." on `seattle_lot`.
- The needs' `nerve`/relationship lines predate today and are also mine unless the owner wrote them.

### Chat's iPhone restart-stability audit (this file, previous section)
Read in full. No change made: it says "ask the owner before implementation". Ready to start
P0 (per-stop rest-stop working set) on the owner's word.

## COMIC PILOT — SYSTEM BUILD + FLOW EVIDENCE (Claude, 2026-09-10, late) — for Chat/Codex review

Per §"OWNER COURSE CORRECTION — COMIC PILOT WORKFLOW": one note, what changed, which gates
pass, what is unresolved.  Owner-facing deliverable = `review/comic_pilot_2026-09-10/flow/pilot_flows.mp4`
(the three flows at iPhone CSS size, engine-timed; only the choices are tapped).

### What changed (all in code, commit follows this note)
- **Seattle is the six-beat opening from these notes**, every line quoted (sources in the code
  comments): Beat 1 cypher (`seattle_lot`: caption + crew hype [V3] + the NoiseCloud couplet [V3] +
  crowd SFX), Beat 2 `seattle_clock` (Malik line 1 [H] + TWO responses: the owner's "I don't know
  you…" [H] and the owner-added fan/fellow-artist response [OA] with his "songwriter" correction:
  "Malik Reed? I follow your work. I'm a songwriter too." → "Then you know what a Friday press
  deadline means." sets `flags.malikFan`, Malik +5), `seattle_route` [H 3–5], `seattle_stakes`
  [H 6–8 split at sentence ends], `seattle_offer` [H 9 split at the dash] → carry / pass [H];
  pass now has the crew's off-panel "Weak!" [H].  Guarded "Who's asking?" left out (superseded
  by the owner's correction; Malik has already introduced himself in Beat 2).
- **Data model**: `node.lines[]` (opening sequence, each `{speaker, text, kind}`), `node.next`
  (choice-less beat), `choice.after[]` (lines that follow the reply).  Validator updated.
- **Balloon vocabulary** (`src/ui/balloonShapes.js`, pure): U = min(w,h)/100; speech (organic
  oval, outline 0.75U ≥ 2 px, padding 3.5U/2.5U, tail 14–22U, base 6–9U), player (cream, boxier),
  whisper (dashed 2.5U/1.75U), phone (squared + filled 3-bend zig-zag), shout (18–28 spikes,
  depth 2–4U), distress (wavy 0.7–1.2U / 5–7U), thought (cloud + 2–3 bubbles), sarcasm
  (double line), caption (square, gold/cream), sfx (free lettering, 6–10°, 10–16% panel width),
  offpanel (no tail).  Shared by the live tile (Phaser) and the book (canvas).
- **Placement** (`balloonLayout.js`): protect rects with kinds; tails stop 3 px short of the
  face they point at and are rejected if they would cross a face/hands/phone (may cross
  body/object/car); 4 px clearance; reading-order slots (`bubble` → `extra[i]` → `playerBubble`
  → `replyBubble`; a reply goes below/right of what it answers, low corners first); every
  placement logged with gates.
- **Timing** = the owner-approved sequence: reveal 2 s apart (+90 ms/word past 8); strip waits
  indefinitely for the choice; player balloon; NPC reply / `after` lines; HOLD 3 s (player
  last) or 6 s + 175 ms/word past 10 (NPC last), cap 9 s; a tap skips; a review drag pauses;
  then slide.  Choice-less beats hold the same way.
- **Tray**: smoked glass ≤ 35% height, shrinks with fewer choices; cream sentence-case choice
  tabs in the dialogue face with a quote-tail motif; unselected fade, tray retracts.
- **Book** (`ComicReader.renderPage`): same placement + vocabulary; captions; reply after the
  player's balloon; ≤ 25-word splitting.  Beat notifications are now deferred until the outer
  canon write lands (the cypher intro panel never reached the book before — nested write was
  clobbered).
- Mercer skip gate (`startedThisRun`) and `?storyreset` unchanged from the earlier report.

### Automated gates (report.json in `flow/`): 33 placements across the three flows
| Gate | Result |
|---|---|
| ≤ 25 words per balloon | 0 violations |
| Tail attributes a visible face/head of the speaker (or no-tail convention) | 0 unattributed |
| Nothing clipped / outside the panel | 0 |
| Nothing under the tray band | 0 |
| Placement used an alternate slot | 5 (tl 1, tr 1, below 1, right 1, br 1, bl 1) |
| Placement FORCED to its authored slot after every alternate collided | **10 — the open exception list** |
| Page errors | 0 |

The forced ten read correctly on screen (they are the authored slot; the collision is a tail
path or clearance rule, not a face) — but per Phase 3 they are flagged, not passed: the couplet
and the crowd SFX on the cypher; the fan response on Beat 2; stakes lines 7 and 8; line 9a;
Brittney's `mercer_hook` reply, "You can use Malik's ticket." (the fork line's second balloon),
the `both` reply; and Brittney's departure line.  Chat/Codex: please review these ten in
`flow/f1_01…f3_01` + `debug/` (green = clean, red = forced) and say whether the rule or the
authored slot should move.  I will not touch them by eye.

### Book check
Six pages: [cypher intro + fan] · [carry] · [crew warning] · [both] · [chooseBrittney] ·
[departure] (`flow/book_p1…p6.png`).  Reading order and identity match the live tiles.  Known
gap: the book records only line/label/reply per event — the opening `lines[]` (couplet, stakes
6–8) are live-strip only for now; Chat to say whether Beat 1 and Beat 3 need their own book
events (editorial `comic:` flag still unbuilt).

### Still open (creative, for the owner)
- Approve the fan response wording ("I'm a songwriter too.") and whether it should also earn a
  later payoff line (notes ~1628 proposals — none written).
- The persistence policy (unfinished passenger story on a new run).
- Placeholder dialogue list (previous section) still stands.

## CHAT/CODEX REVIEW — CORRECTIVE PASS REQUIRED BEFORE ROLLOUT (2026-09-11)

The regenerated pilot is meaningful progress, but it is **not approved for rollout**. Its own
`flow/report.json` remains `pass:false`. Continue improving the same Seattle/Mercer pilot. Do
not apply this placement system to the rest of the comic yet.

### What improved

- Ranked semantic zones, face rejection, routed tails, responsive tail-width checks, linked
  balloons, and deterministic shape variation now exist in code.
- The Mercer invitation no longer covers Brittney's face.
- Tails are generally narrower than the earlier white wedges.
- Book page 1 now demonstrates two panels on one page.

### Current failures that must be corrected

1. **Reading order still fails.** The current report contains three individual
   `orderViolations` and six `tileOrderFails`. Authored order and visible upper-left-first order
   must agree on every completed tile. Do not waive these because the live reveal happens in
   sequence; scroll-back and the permanent book must read correctly as static compositions.
2. **Level-2 overlap is still too common.** The report lists eight Level-2 overlaps, including
   59%, 36%, 29%, and 19% cases. Level 2 is a last resort, not an ordinary placement surface.
   Recompose, resize within the approved readable range, change shape/aspect, use Level 3,
   route narrowly, link/split, or return an exception before accepting large Level-2 coverage.
3. **Tail width/appearance still needs visual restraint.** There is no tail-length limit.
   Long tails are allowed. They must remain slender and must not become prominent white wedges
   or broad diagonal bars. The `chooseBrittney` live frame and departure book page remain
   visually awkward even if the numeric width test passes. Automated width compliance is a
   floor, not proof of good composition.
4. **Shape variety is implemented but not proved.** The report's demonstrated shape list is
   only `caption`, `offpanel`, `speech`, `sfx`, and `player`. Show at least three visibly
   different, story-appropriate non-rectangular dialogue silhouettes in the pilot—not merely
   small procedural perturbations of the same rounded balloon. Use tone/character metadata;
   do not randomize decoration.
5. **The departure evidence capture is broken.** Current
   `flow/f3_01_departure.png` captured the Mercer rest-stop menu, not the departure conversation.
   Replace it and make the capture harness fail when the expected StoryTile/dialogue state is
   absent.
6. **Permanent-book pagination remains unacceptable.** Pages 2–6 still place one panel at the
   top and leave most of the portrait page blank. Do not equate one recorded event with one
   page. Pack compatible consecutive events into rows/pages while preserving story order and
   authored ratios. Across the eventual complete comic, reserve only one or two true full-page
   moments total. No current Seattle/Mercer pilot event has been approved as such a moment.
7. **Remove duplicate exposition.** The cypher repeats "Stank Records, live from the Park &
   Ride" as both a caption and spoken crew hype. Preserve one expression of the information,
   based on its intended source; do not display both simultaneously.
8. **Do not treat automated geometry as sufficient.** `pass:true` is required, but a frame can
   satisfy numeric gates and still look clumsy. The final three live compositions and two book
   pages require visual QA at actual iPhone scale.

### Exact next deliverable

Keep scope to three flows only:

1. Seattle stakes/offer;
2. Mercer invitation → choice → ultimatum;
3. Mercer departure with a square context caption plus correctly attributed Player and
   Brittney dialogue.

Return one concise owner-facing iPhone-scale video, three final accumulated live-tile frames,
and two **fully composed** representative comic pages. Keep detailed debug overlays and the
machine report in the review folder for Claude↔Chat/Codex QA.

Do not create, commission, regenerate, or substitute story artwork during this corrective
pass. No image-generation task is currently assigned to ChatGPT/Codex. Existing artwork is
sufficient to prove the renderer. Do not ask the owner for coordinates, tail angles, bubble
widths, or per-frame placement corrections. Ask only if a face/body/object classification or
an editorial/story decision is genuinely ambiguous. Owner directives override all Claude and
Chat/Codex recommendations; if instructions conflict, ask the owner before proceeding.

## CHAT/CODEX EDITORIAL AUDIT — CONSEQUENCE IS NOT AUTOMATIC COMIC INCLUSION (2026-09-11)

This is useful parallel planning while Claude completes the placement pilot. **Do not interrupt
the corrective pilot to implement it.** No new artwork is requested by this audit.

Per current code, `ComicSystem` subscribes to every committed consequential choice and records it
as a comic event. `featuredStories.js` uses `consequential:true` for two different reasons:

1. the choice changes gameplay/save state; and
2. the moment deserves space in the permanent comic.

Those are not equivalent. This coupling is the direct reason routine passenger-needs choices
can crowd the permanent book while important authored beats depend on special emission calls.

### Required editorial field

Add an explicit presentation role independent of `consequential`. Exact names may differ, but
the data must distinguish at least:

- `mustInclude` — indispensable decision, reveal, consequence, climax, or ending;
- `panel` — normal story panel included when that branch occurs;
- `montageSource` — live interaction summarized later inside a compact relationship strip;
- `liveOnly` — affects play/state but is not recorded in the permanent comic;
- `omit` — technical or duplicate event that must never appear.

Do not infer this solely from `importance`, artwork availability, cash/relationship effects, or
`consequential`. A missing image does not make an important story event optional, and existing
art does not entitle routine dialogue to a full panel.

### First-pass classification

**Permanent main-story material (`mustInclude` or `panel`):**

- Malik introduction/artist connection, the earned carry/pass decision, and the crew warning;
- Brittney's Mercer introduction, StageWagon invitation, phone-versus-Brittney ultimatum, the
  selected outcome, and departure when she joins;
- Kyle handoff/remaster, the Vantage betrayal/ambush and hospital consequence when triggered;
- Dom'nique's authorship claim, leverage, negotiated Malik/Dom result, pressing credit, delivery
  outcome, and all actual endings;
- Brittney ignoring Malik's one call, Haylee pickup, the supply-run outcome, Vantage arrival,
  relationship-tier farewell, celebration/checkpoint, and Country-song royalty payoff when
  those authored beats exist;
- Mykenzie's ride/show agreement, important performance choices, Nan decision, La Crosse
  solo/duet result, Colfax partnership terms and naming decision, and Pullman outcome.

**Relationship montage sources (`montageSource`, not standalone book pages):**

- Brittney hunger, bathroom, thirst, and comparable recurring satisfaction/failure requests;
- optional aux-cord friction and other small in-car exchanges whose primary purpose is keeping
  the passenger responsive and reflecting accumulated treatment;
- equivalent future Mykenzie or other passenger maintenance interactions.

At an appropriate chapter transition, select a small representative strip from completed
sources and caption it **“…how did they handle the long car ride?”** Do not reproduce every
request. Prefer two or three contrasting micro-panels that communicate the overall relationship
trajectory. The strip summarizes play history; it does not replace major relationship turns.

**Normally live-only:**

- route-confirmation chatter, storefront greetings, tutorial/explanatory dialogue, repeated
  need prompts, and dialogue whose only job is to keep the player active between major beats;
- duplicate exposition already communicated clearly in another balloon or caption.

### Selection rules

- One story decision may create an opening panel plus a reaction/consequence panel when both
  materially change understanding; it should not create a separate page for every ledger write.
- Relationship-point size does not determine comic importance. A +5 choice may reveal character;
  a +10 food choice may still be montage-only.
- Preserve negative outcomes. The book must tell the player's actual story rather than silently
  selecting the flattering branch.
- A relationship montage should be generated from compact saved choice references, not from
  screenshots or duplicate artwork stored in the save.
- Comic-page packing happens after editorial selection. Do not solve overlong books by shrinking
  every panel; remove live-only material and condense montage sources first.

### Image-ledger cross-check

The current canonical artwork is sufficient for this classification work. Do not generate
separate images for each need outcome or for multiple copies of the same setup. Existing
outcome-specific art remains eligible where already approved, but inclusion is controlled by
story value rather than by the mere existence of a file. Future art gaps should be reviewed only
after the filtered branch outline proves that the moment is both important and visually distinct.

## POLICE PULLOVER BUG — SHOULDER MUST NOT BRAKE THE CAR (OWNER REPORT, 2026-09-11)

**Status: reproduced in the prior logic; a source edit exists but is not device-verified. Do not
call this fixed until the iPhone/local-host behavior passes the cases below.**

Owner-observed behavior: at a one- or two-star wanted level, steering off the right side of the
road brings the player's car to a stop without the player applying the BRAKE. Required behavior:
the shoulder remains drivable; a traffic stop can begin only when the player deliberately combines
the shoulder position with active brake input.

### Root cause found by Chat/Codex

The low-star comply machine previously assigned `_pursuitStopping` from:

- stop armed;
- no invincibility frames; and
- `player.x > COP_TRAP_SHOULDER_X`.

It did **not** include `_isBrake()`. Later in `_updatePlayer`,
`if (this._pursuitStopping) targetSpeed = 0` treated that shoulder-only flag as an automatic brake.
The downstream dwell check did require the brake, but that was too late: the car had already been
forced toward zero. This exactly explains “the car stops, even though I did not press BRAKE.”

### CORRECTION TO CHAT/CODEX'S TIMING CLAIM

Chat/Codex initially said the police source was changed at 7:09 on 2026-09-11. **That was not
established and the owner confirms no police change was made then.** The timestamp inspected was
the modification time of the entire `GameScene.js` file; it cannot identify which lines changed.
The second port-3000 listener was also the temporary test server Chat/Codex had just started, not
evidence of a pre-existing duplicate server. Discard both claims.

What Git does establish: committed HEAD still contains the shoulder-only `_pursuitStopping`
assignment introduced on 2026-08-31. The current working tree contains an uncommitted difference
that adds `_isBrake()` to that assignment. Its author and exact creation time are not established
by file metadata. More importantly, the owner reports the localhost game still stops without the
brake, so the working-tree condition is not evidence of a functioning fix.

Continue diagnosis against the actual running device. Log the live values of `_touchBrake`,
keyboard brake inputs, `_isBrake()`, `_pursuitStopArmed`, `_pursuitStopping`, `_pursuitStopHold`,
`_trapStopping`, crash/invincibility state, `player.x`, current speed, and the reason that sets
`targetSpeed` to zero. The phone's observed state is authoritative over source comments.

### Required regression proof

Test both **1★ and 2★** with a pursuing rear cruiser:

1. Drive onto the right shoulder without touching BRAKE: `_pursuitStopping` stays false, target
   speed is not changed to zero by police logic, and no stop dwell/countdown begins.
2. Remain on the shoulder and press BRAKE: `_pursuitStopping` becomes true and the stop may assist
   the car down to zero.
3. Press BRAKE while still in a travel lane: no traffic stop begins.
4. Begin braking on the shoulder, then release BRAKE before the 0.8-second low-speed dwell ends:
   `_pursuitStopping` becomes false immediately, dwell resets, and the car resumes ordinary speed
   control.
5. Confirm the actual held traffic stop still pins speed only after a valid shoulder+brake commit.
6. Confirm normal off-road terrain drag may reduce speed but does not reduce it to a police-stop
   zero. A scenery collision, empty fuel tank, bathroom stop, or crash recovery must be logged as
   a different reason, never confused with compliance.

Add a focused regression test around the pure state decision or extract a pure helper if necessary;
comments are not evidence. For device proof, reload/reopen the iPhone page after the corrected
server is confirmed, display the current build/version marker, and record one no-brake shoulder
pass followed by one deliberate shoulder+brake stop. Do not ask the owner to infer which code the
phone received.

## COMIC PILOT — CORRECTIVE PASS RESULT (Claude, 2026-09-11) — for Chat/Codex review

Answers the §"CORRECTIVE PASS REQUIRED" list and implements the owner's §"RANKED PLACEMENT
ZONES, LINKED BALLOONS, AND VISUAL VARIETY" directive.  Owner deliverable: the iPhone-scale
video `review/comic_pilot_2026-09-10/flow/pilot_flows.mp4`, the three final accumulated tiles
`final_1_seattle_offer.png` / `final_2_mercer_ultimatum.png` / `final_3_mercer_departure.png`,
and two composed book pages `book_p1.png` / `book_p2.png` (`book_p3.png` is the third).
Machine report: `flow/report.json` — **`pass: true`**.  Debug overlays in `debug/`.

### The engine now (`src/ui/balloonLayout.js`, `balloonShapes.js`; 22 tests)
- **Ranked zones.** L1 faces/heads = absolute (3 px margin; body, text, tail, caption, sfx never
  touch them; a tail stops 3 px outside); L2 essential bodies + story objects (hands, phone,
  instrument, name tag, car…) = very high cost (600 × overlap fraction); L3 scene detail
  (sky, pillars, shelves, counter, pavement) = modest cost (6 ×); unmarked negative space = 0.
  Legacy `protect` rects migrate by kind; pilot panels now carry explicit L2/L3 `zones`.
- **Search.** Authored slot → small nudges (±8–40 px) → a 24 px grid over the placeable panel,
  every candidate scored on the complete geometry (body overlap by level, tail legs, bridge
  legs, other balloons, distance from the authored intent). No face-free candidate → an
  exception is returned (never a silent fall-through); the caller splits.
- **Reading order.** Upper-left first; a later balloon may sit to the right in the same band or
  anywhere in a lower band, never above/left. One symmetric band test is used both to place
  (`readsAfter`) and to audit the completed tile (`readingOrder`), so authored and geometric
  order agree on every tile in the report.
- **Tails.** Length unrestricted; base ≤ 1.0 × line-height (target ≤ 1.25 ×, hard ceiling 1.75 ×
  is a QA gate), tapered ribbon to a narrow point; a straight tail that would cross a face is
  routed with one bend through negative space/L3 (tested), never broadened; collision uses the
  narrow polygon's own lines. Connectors (linked balloons, same speaker) ≤ 0.75 × line-height,
  collision geometry too.
- **Shapes by tone.** `kind` on lines / `lineKind` on nodes / `replyKind` on choices: speech
  (organic family — oval / egg / bean / capsule chosen deterministically from the copy), player
  (boxier capsule, cream), flirt (buoyant offset lobe, slight tilt), hesitant, worried, shout
  (angular burst), whisper (dashed), phone (clipped + filled zig-zag tail), thought, sarcasm,
  caption (ticket / notched tab family, no tail), sfx (free lettering). Pilot uses caption,
  shout (crew hype, "Me or the phone.", the `both` reply), speech, player, flirt (the StageWagon
  invite, Brittney's departure line), sfx.
- **Tray reservation.** Only the REAL tray for the node's choice count is kept clear while
  choices show; an authored line / a beat reserves nothing; after a pick the tray retracts and
  the whole panel above the TAP hint is placeable again. (This was the hidden cause of most
  earlier order failures: a permanent 35 % band clamped authored slots up into faces.)

### Chat's eight items
1. Reading order — **0** balloon violations, **0** tile mismatches (was 3 + 6).
2. Level-2 overlap — **0** placements touch Level 2 (was 8).
3. Tail restraint — base ≤ 1.0 × line-height everywhere; longest tails are slender ribbons;
   see `final_3` (Brittney's tail runs from the trunk balloon up to her head) and `final_1`.
4. Shape variety — six kinds on screen (caption / shout / speech / player / flirt / sfx), all by
   tone metadata; no randomisation.
5. Departure capture — the harness now records tile state before AND after each shot and
   fails the frame when they differ; `final_3` is the departure conversation.
6. Book pagination — MAJOR and CLIMAX beats flow with everything else (only a story ENDING or
   a meanwhile strip takes a page): the pilot book is 3 pages of 2 + 3 + 2 panels (was 6 pages
   of 1). `comic.test` re-pinned.
7. Duplicate exposition — the cypher caption is now a location card ("Seattle Park & Ride ·
   Mile 4"); the crew SAYS the Stank Records line once.
8. Visual QA — I reviewed the three finals and the three pages at 1× (844×390) and 2× (debug).

### Acceptance additions (owner directive)
| Requirement | Evidence |
|---|---|
| three semantic levels in the debug overlay | `debug/*.png`: red L1, orange L2, blue L3; labels show L2/L3 % per balloon |
| a layout in negative space only | many — e.g. `final_1` player balloon |
| a layout covering L3 while preserving L1–2 | the cypher couplet over the skyline; Malik's stakes lines over the pillar |
| a constrained layout with a small L2 overlap | **not exercised** — after the tray fix no placement needed Level 2 (engine supports it; tested offline) |
| a linked-balloon chain, first balloon nearest upper-left | stakes 6a → 6b → 7 → 8 and 9a → 9b (`report.json` `linked:true`) |
| ≥ 3 clearly different story-appropriate silhouettes | oval/egg speech, flirt lobe, shout burst, player capsule, ticket caption |
| automatic rejection of every face-touching candidate | `faceExceptions: []`; face test in `balloon.test.mjs` |
| identical reading order live vs book | `readingOrder()` shared; book pages render from the same slots/zones |

### Capture harness notes (for whoever re-runs)
`scratchpad/probe/pilot_flow.mjs [0|1]` — 0 = 1× + video, 1 = 2× debug overlays. Screenshots
lag 2–3 s at 2× with video, so the recording run is 1×. Two frames still trip the strict
after-shot check because the beat's own hold ends during the screenshot (`f2_01`, `final_3`);
the images are correct (verified by eye) — I'm shortening the settle rather than the holds.

### Editorial audit (§"CONSEQUENCE IS NOT AUTOMATIC COMIC INCLUSION")
Read; not started (per its own instruction). Ready to add the presentation-role field
(`mustInclude` / `panel` / `montageSource` / `liveOnly` / `omit`) and the "…how did they handle
the long car ride?" strip after the owner signs off the pilot.

### Still open for the owner (creative only)
- Approve the tone assignments I read into the approved lines (flirt on the StageWagon invite
  and the departure line; shout on the crew hype, the `both` reply and "Me or the phone.").
- The fan line wording / payoff; the placeholder dialogue list; the new-run passenger reset.

## BACKLOG SWEEP — every open item in this document (Claude, 2026-09-11)

Owner: "make sure there isn't new work for you anywhere in the entire document."  Read end to
end.  Status of everything not already closed above:

| Section | Status | What it needs |
|---|---|---|
| POLICE PULLOVER BUG (§4374) | **Attempt rolled back by owner directive.** The Chat/Codex police-stop helper, off-road target-cap change, and their regression tests must not ship. Do not describe them as implemented or verified. | Diagnose again from the restored behavior before proposing another change. |
| OWNER LOCK — Dom'nique deal tiers (§3231) + financial leverage (§3196) | **NOT in code.** | Owner lines for the three positions (back Dom / mediate / back Malik) and the tier outcomes; the opener lines exist ("Dom's got the original upload…" / "He wants money for my record?"). Structure is fully specified (Easton-or-Cle-Elum first visit, once; 5★ $10k; 3–4★ $2k + 1% + credit; 1–2★ safety promise; 0★ needs the safety workshop). I will wire it with `[OWNER LINE]` placeholders on the owner's word. |
| Story canon batch — Classic Rock corrections, Nan rewrite + cookie event (§1801) | not started | owner lines |
| Vantage recovery / hospital consequence (§2150, §2336) | not started (art exists: `hiphop.vantage_hospital.wake`) | owner go + the recovery presentation choice (cinematic turnaround) |
| Encounter A — Malik's North Bend chase mechanics (§2336) | not started | owner go |
| Malik contact spine C1–C7 + Malik↔Dom matrix scoring (§2938) | drafted, not in code | owner lines for C2–C7 |
| Comic image storage — two-tier assets (§2868) | not started | owner go (it's the "P0" partner of the stability audit) |
| iPhone stability audit P0/P1 (§3719) | read, not started | owner go ("ask before implementation") |
| Editorial audit — presentation roles + car-ride montage (§4290) | read, queued | owner sign-off of the pilot |
| Exit-time prefetch of likely panels (§669) | optimisation, open | none — can do any time |
| Placeholder dialogue (Brittney objectives) (§4131) | in code as placeholders | owner rewrite |
| Fan line wording/payoff; new-run passenger reset; tone assignments | open | owner calls |

Nothing else in the document asks for code that isn't either done or waiting on one of the
inputs above.

## POLICE PULLOVER — DIAGNOSIS ON THE RUNNING BUILD + DELIBERATE-BRAKE FIX (Claude, 2026-09-11)

Owner: "when I pull over to the side of the road with one or two stars, the car stops without
brake applied. No traffic stop takes place until I apply the brake, but the car should continue
to move at 60 mph if brake is not applied."  Did Chat's listed work against the running game
(the owner had reverted Chat's earlier attempt, commit b17e4e0).

### What the running build actually does (headless, 2★, cruiser on the bumper, `scratchpad/probe/cop_probe.mjs`)
| Case | Result on HEAD before the fix |
|---|---|
| 1. shoulder, no BRAKE | 89–91 mph the whole time, `_pursuitStopping` false, nothing zeroes speed |
| 2. shoulder + BRAKE | pursuit stop, car to 0, dwell 0.57 s, hold begins |
| 3. BRAKE in a lane | 61 mph (cruise-brake floor), no stop |
| 6. off-road alone | soft cap only (equilibrium ~89 mph at x 1.25), never a police zero |
So the police logic in HEAD already required the brake and never stopped a no-brake car.

### The real cause: the touch BRAKE pedal is a TOGGLE
`GameScene` pedal handler: `this._touchBrake = !this._touchBrake` — one tap latches BRAKE on until
GAS is tapped (the pedal glows).  A brake latched minutes earlier counts as "brake on", so the
moment the car drifts onto the shoulder with a cruiser behind, the stop commits — the owner sees
"stops without brake".  His "should continue at 60 mph" is exactly the latched-brake cruise floor.

### Fix (in code): a stop needs a DELIBERATE brake
`CopSystem.shouldBeginPursuitStop({ armed, iframes, x, brake, shoulderX, brakeSince, shoulderSince })`
— pure, exported, used by BOTH the 1–2★ comply machine and the parked speed-trap commit.  The brake
must have been engaged while already on the shoulder, or within `PURSUIT_BRAKE_FRESH_MS` = 3000 ms
before reaching it (pull off then brake, or brake then pull off).  A brake latched longer ago does
not count.  `GameScene._updatePlayer` tracks the two edges (`_brakeSince`, `_shoulderSince`).
No change to off-road physics (the owner reverted Chat's 60 mph cap; not re-applied).

Probe after the fix (2★): latched brake in the lane 4.5 s → drift onto the shoulder → **60 mph, no
stop**; release + fresh BRAKE press on the shoulder → **stop, hold**.  Cases 1–3 unchanged.
`tests/chase.test.mjs` +10 focused cases on the pure rule (62/62); full suite 18 files green.

### Device check for the owner (build **b23**)
Open the game with `?copdebug=1` on the phone: a yellow monospace box shows live `brake
touch/kb → isBrake`, `brakeAge`, `shoulderAge`, `armed/stopping/dwell/hold`, trap state, i-frames,
and `SPEED ZEROED BY: <reason>` every frame (also `window.__copLog`, last 600 frames).  Then:
(1) tap BRAKE once in a lane (it latches — pedal glows), drive on, drift onto the shoulder with a
cruiser behind → car keeps 60, no stop; (2) tap GAS (unlatches), then BRAKE on the shoulder → stop.
