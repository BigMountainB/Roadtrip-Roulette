# Road Trip Roulette — Project Overview

Single consolidated reference for the **Road Trip Roulette** game (commercial fork of DUI).
This file merges every project `.md` into one navigable document. Use the Table of Contents
to jump straight to the chapter you need to read or change.

- **Live site:** https://roadtrip-roulette.pages.dev — the marketing site (as of 2026-07-27)
- **Live game:** https://roadtrip-roulette.pages.dev/fully — the FULL game, free + public
- **Demo embed:** https://roadtrip-roulette.pages.dev/demo — 25-mile browser demo
- ✅ **CI deploys `website/` as of 2026-08-10** (was `dist`, which would have clobbered all three) — see Chapter 2 “Deploy conflict”
- **Repo:** `BigMountainB/Roadtrip-Roulette`
- **Local path:** `/Users/brendanbaughn/Documents/Claude/Road trip roulette/`

> **How this doc is organized.** Chapters 1–2 are living project docs (status + deploy).
> Chapters 3–5 are the authoritative design/build specs. Chapter 6 is dated work history.
> Chapter 7 is the pre-fork DUI engine reference, kept for the shared systems but partly
> superseded — trust Chapters 1/3/4 where they disagree.

---

## Table of Contents

- **[Chapter 1 — Status & Changelog](#chapter-1--status--changelog)** — current snapshot, dated change log (newest first), what's not built yet
- **[Chapter 2 — Deployment & Build](#chapter-2--deployment--build)** — Cloudflare Pages pipeline, `npm run build`, gotchas
- **[Chapter 3 — Commercial Design Document](#chapter-3--commercial-design-document)** — the full game design spec
  - §0 Purpose · §0.1 Implementation Status · §1 Foundation to reuse · §2 Commercial positioning
  - §3 Core loop · §4 Version strategy · §5 Game modes · §6 Route & zones · §7 Encounter system
  - §8 Portraits · §9 Local facts · §10 Upgrade philosophy · §11 Handling/traction stats · §12 Upgrade catalog
  - §13 Economy · §14 Vehicles · §15 Police & heat · §16 Weather & hazards · §17 Missions
  - §18 Rest-stop shops · §19 Art · §20 Audio · §21 UI/UX · §22 MVP scope · §23 Full v1 scope
  - §24 Roadmap · §25 Claude build-prompt pack · §26 Revenue · §27 Steam page · §28 Risks
  - §29 Immediate next steps · §30 Final recommendation
- **[Chapter 4 — Survival System Spec](#chapter-4--survival-system-spec)** — 3 bars (Awake/Hunger/Thirst), item table, thresholds, unlock ladder
- **[Chapter 5 — Tree Asset Brief](#chapter-5--tree-asset-brief)** — roadside tree/shrub art keys by region, dimensions, manifest keys
- **[Chapter 6 — Work History (DUI lineage, pre-fork)](#chapter-6--work-history-dui-lineage-pre-fork)** — dated session notes carried from DUI
- **[Chapter 7 — Legacy Engine & Systems Reference](#chapter-7--legacy-engine--systems-reference-dui-era-partly-superseded)** — pre-fork DUI overview (shared engine, partly stale)
- **[Chapter 8 — Mission System Plan](#chapter-8--mission-system-plan-locked-2026-07-13-rev-b-after-external-review)** — "Favors": dialogue-tree offers, 5 types + terms modifiers, rep ladder (×1/×2.5/×5), 7 build phases
- **[Chapter 9 — Ground Tile Art Spec](#chapter-9--ground-tile-art-spec)** — the 8 per-biome overhead ground textures (1024×1024, seamless both axes), scale/resolution rules, which are done vs. outstanding
- **[Chapter 10 — Biome Band Art Spec](#chapter-10--biome-parallax-band-art-spec)** — the 24 horizon-silhouette images (8 biomes × 3 parallax layers), tiling/transparency rules, per-biome subject notes
- **[Chapter 11 — NPC Dialogue Reference](#chapter-11--npc-dialogue-reference)** — every rest-stop encounter, mission passenger/contact, and crowd-chatter line, verbatim; companion spreadsheet `npc_dialogue.csv` in the repo root; rewrite-in-progress toward "edgier, funnier"
- **[Chapter 12 — Dead Code Inventory](#chapter-12--dead-code-inventory)** — audited 2026-08-03: orphaned files (`src/cops/`, `CarPhysics.js`, the stale `Road 2.js`), the vice-bar layer stranded by the survival migration, dead methods/constants/asset keys, and a suggested order of work
- **[Chapter 13 — Ending Plate Art Spec](#chapter-13--ending-plate-art-spec)** — the 6 photographic 800×450 ending plates + 3 car views × 10 genres, file naming, the trimmed-bbox placement rule, per-plate anchors, and how to add a genre or re-export art
- **[Chapter 14 — Player Car Steering & Pose](#chapter-14--player-car-steering--pose)** — the rules the player sprite obeys: no body roll, ground-anchored on the tire contacts, turn art keyed to steering INTENT, per-mode timings, and the G diagnostic
- **[Chapter 15 — Storefront Confirm Modal Restyle](#chapter-15--storefront-confirm-modal-restyle)** — ENDGAME ONLY: gritty neon metal panel + INSTALL/CANCEL buttons for `_confirmBuyPopup`; flags that it is Phaser today (not HTML/CSS) and serves every shop item, not just parts
- **[Chapter 16 — Rest-Stop Exit / Off-Ramp System](#chapter-16--rest-stop-exit--off-ramp-system)** — authoritative spec: shared `ExitPath.js` plan (150 ft taper / 1000 ft lane 5 / 100 ft gore / 82° curve), no-button lane-5 commitment (lock-in at 500 ft OR gore window), nose-only braking, painting topology, post-commit protection, `_exitArtFor` ladder, QA handles

---

# Chapter 1 — Status & Changelog

**Project:** Road Trip Roulette — a dark-comedy Seattle→Pullman arcade driving roguelite,
forked from DUI on **2026-07-04** into its own repo and Cloudflare Pages site. Reframes DUI
into an App-Store-safe survival road trip and adds the commercial glue (encounters, part
upgrades, survival + heat/fuel pressure).

## ⚠️ FILE RULES (owner, 2026-08-12 — every session, read first)

1. **NO duplicate files without explicit owner approval.** Never create copies of source files
   as backups or scratch space — no `GameScene 2.js`, `main 2.js`, `*_old.js`, `*_backup.js`,
   `*.bak`. Git history IS the backup. Stray `<name> 2.<ext>` duplicates have appeared in
   `src/` twice (2026-08-11) and had to be diff-verified and deleted; if you find one, verify it
   holds nothing unique, then delete it.
2. **ONE Markdown file.** All notes, specs, art briefs, and plans go in THIS file
   ("Road Trip Roulette Overview.md") as a chapter or changelog entry — never a new standalone
   .md. (Existing violations `CLAUDE_GARAGE_STORE_UI_PROMPT.md`, `ENDING_ART_SPEC.md`,
   `TUNNEL_FACE_ART_SPEC.md` predate this note; fold them in here before adding to them.)

## Current snapshot (as of 2026-07-19 — rest-stop / dialogue lines refreshed 2026-08-10)

**Built & deployed:** rest-stop encounter system (dialogue trees + npcMemory) · **MISSION SYSTEM
complete (Ch. 8, all 7 phases — 5 types, rep ladder ×1/×2.5/×5, 123 tests)** · car stats layer ·
**part-upgrade system + garage UI (shops as-built: Ch3 §18)** · upgrades/buffs hooked into handling · survival rework
(Alertness/Bladder/Drinks/Food + restrooms/AM-BM + rest-stop mini bars; over-eating past 75% now
fills the bladder) · engine overheating · analog E↔F gas gauge (75-mi tank, 1:1 burn, reserve-tank
upgrades) · 🎆 fireworks weapon (spikes removed) · phone-menu notification dots · Hatton rest stop ·
**SOUNDTRACK CULTURE PACKS shipped** (per-plate genre reskin — vice + starter-vehicle art per genre,
music-menu picker, tutorial genre pick, rotate-to-play prompt) · custom iOS motion-permission
explainer · **all weapons cap at 3** (rolling coal 1/pickup) · **rolling-coal cop = touch-cloud →
60 mph/30 s slow** · HUD-layout editor with a COPY-to-export button ·
**genre-car ENDING PLATES** (Ch. 13 — six photographic 800×450 plates, each composited with the
player's genre car; OUT OF GAS is now a three-way decision card instead of an automatic tow) ·
**NEXT RUN advice panels** (2026-08-09 — a failed run explains what killed it and what to do
differently, keyed to the real cause and personalised against what the player already owns) ·
**steering pose rules** (Ch. 14 — the car no longer rolls, it's ground-anchored on its tire
contacts, and the turn art keys off steering intent) ·
**REST-STOP CARDS ARE CONVERSATIONS** (2026-08-05 — a question is answered inside the card and the
list stays open; only an exit choice closes it and opens the storefront. Choice labels are spoken
player sentences, all 62 town facts are web-verified, and NPCs QUOTE prices that the shop then
charges rather than selling to you on the spot).

**Superseded vs the original design doc:** "DUI" framing removed (speeding stops only, reckless
heat) · portable save/checkpoint codes removed (local LAST/SAVED kept) · sex worker → Hot Springs
soak (PG-13) · party-clock HUD hidden (mechanics intact — arrival-status direction, see changelog).

**Backdrop / ground open items (opened 2026-08-10 - 11, none blocking):**
- ~~`seattle_ground_1024.png` is NOT seamless~~ — **WRONG, retracted 2026-08-11. Every ground tile
  loops correctly, including Seattle.** The original claim came from a broken test: it compared the
  two opposite edge columns for IDENTITY. In a seamless tile those columns are *neighbours*, so they
  should differ by about as much as any two adjacent columns — not be identical. Judged that way,
  Seattle scores **1.28 L/R / 1.26 T/B** against a 2.0 threshold and `pnw_roadside` 0.96/0.97; both
  loop fine. **See "How to actually test a tile for seams" below before re-running this check.**
- **`east_cascades` palette spans two different grounds.** The Vantage basalt tile is dark grey
  `rgb(59,57,52)` (correct — it is scree) but shares `east_cascades`, whose `grass2` is olive-tan
  `rgb(122,116,43)`. Delta **87**, the only ground handoff still measuring "visible" — and slightly
  WORSE than the 74 it had before per-biome tiles landed. Fix is a Colors.js split (a Vantage
  sub-region with a basalt-toned `grass2`), not new art. May be moot now that the ground textures
  run to the draw cap; re-check before spending time on it.
- ~~Band texture guard is dead~~ — **FIXED 2026-08-11 (pt 8)**, now tests `displayTexture.key`.
  Original finding kept for context:
  `_renderBiomeBackdrop` tests `ts.texture.key !== key`, but on a TileSprite `ts.texture` is Phaser's
  internally generated fill-pattern texture and its key is a UUID — never equal to `bio_*`. The
  right field is `displayTexture`. Visually harmless (the correct art always shows, which is why it
  went unnoticed), but it rebuilds the tile pattern 6x per frame. One-line fix:
  `ts.displayTexture?.key !== key`.
- **Watch for a black horizon strip.** The ground now textures to the full 76,000-unit draw cap with
  only `FEATHER_Z = 6000` of fade. The original 18k fade existed because the last rows can sample
  outside the useful mip footprint at grazing angles. If a black line ever shows at the horizon,
  widen `FEATHER_Z` in `GroundPlane.js` — that is the knob.
- **Not verified visually.** Everything in the 08-10/08-11 backdrop work is confirmed by runtime
  probes (depths, geometry, alphas, tile keys), NOT by screenshot. Seven capture approaches failed:
  the title-screen DOM overlays the canvas, `renderer.snapshot` hangs under software GL, and
  `gl.readPixels` returns the title art. The LOOK still needs a human playtest.

**Not yet built / pending:** economy balance w/ real playtest data (mission `recordEarn` tagging
ready; pickups+distance income the suspected inflators) · Steam-demo cut + wishlist/tutorial (Ch3
§13/§22) · real NPC portrait art · **bake owner's custom HUD layout as the shipped default** (waiting
on the COPY'd `controlsLayout` JSON — editor has the export button) · **genre earn/buy GATING**
(deferred to post-dev-mode; every genre is freely selectable for now) · **Reggaeton dedicated music**
(still borrowing the 9 hip-hop tracks; no `reggaeton/` folder yet) · texting-relationship layer
(pinned idea) · SAVE tile replacement (owner deciding) · **9-column garage toolbar art** (the current
strip is 7 columns sliced by index — BODY and NITRO tabs are art-blocked, not code-blocked; see
Ch3 §18 "AS BUILT") · **`busted_late` still has no ending card** (TOO LATE + 5★ ends the run but
jumps straight to the checkpoint-restart modal — the only run-ender left without a plate, Ch. 13) ·
**ending-plate layout tuning** (Pullman comic puts its stats/button over the busy middle panel; the
demo van's wheels sit behind the button row) · **`public/assets/ui/endings/source/` is 64 MB and
ships in `dist/`** (keyed working art — should be parked outside `public/`, see Ch. 13) ·
**STRIP THE DEV AIDS BEFORE RELEASE** — the `G` steering diagnostic (Ch. 14.5) and the `Y` yaw-spike
toggle are both live in the shipped build · **playtest confirmations owed**: whether steering still
reads as a turn now the body roll is gone, the `G` overlay on a real curve, and the OUT OF GAS
card's advice panel (that one is geometry- and code-verified only — every attempt to screenshot a
live GameScene headless either wrecked the car mid-capture or hit a node OOM).

**Open from the rest-stop conversation pass (2026-08-05, all owner-decidable):**
- **The three fuel offers still transact in conversation** — Grandma's $35, the Farm Worker's $50
  rocket fuel, Mike's $100 diesel split. The plan routed them to Huff's `refuel`, but none of them is
  *pump gas* (Mike siphons his own tank; the Farm Worker's whole joke is that his mix is **not** what
  a station sells), so sending them to a counter deletes the fiction. Awaiting a call.
- **Chain Guy's 65/35 "these only LOOK tough" gamble is gone** — lost when the chains moved to a shop
  row, because a store item can't resolve a `chance` table today. The haggled price survived; the
  risk of being fleeced didn't.
- **`warm` and `elk_ready` are inert buffs.** Empty `effects`, no `special`, and nothing anywhere
  reads `BUFF_EFFECTS.label` — granting either is a no-op. Flagged in `buffs.js`, not deleted,
  because `label` implies a planned buff readout in the HUD. Wire that up or cut them.
- **Weather is a pure function of mileage** (`Weather.state`: fog 14–25, rain 30–40, snow 40–88,
  difficulty-gated), so it is identical on every run. That's why `revealHazard` was deleted — there
  was never hidden information to reveal. If asking NPCs about the road should ever *matter*, the fix
  is upstream: make which hazards go live a per-run roll. Then "how bad is it up there" is real
  intel and the $150 chains are a real bet.

## 📌 PINNED — Soundtrack Culture Packs (SHIPPED 2026-07-17)

**The pitch (Brendan's):** choosing your music genre is a *loadout decision* that reskins the
whole run. Picking a soundtrack changes every sprite's ART (never its effect — same bars, same
values, pure cosmetics) AND the starting vehicle, to match that music's culture:

- **Final ten cultures:** Hip-Hop / Phonk · Pop-Punk / Emo · Norteño · Reggaeton ·
  Classic Rock · EDM / Rave · Country · Reggae · K-Pop · Metal.
- Each culture has 14 fixed-ID vice badges plus a matching front/back starter vehicle under
  `public/assets/culture/<culture>/`. Gameplay category colors remain invariant at distance:
  blue hydration, orange food, yellow caffeine, red special/high-risk.
- Metal's vehicle is the battered black tour van from its menu art (roof amp wall, touring
  lights, chains, grille skull), stored at `public/assets/culture/metal/vehicles/starter_*.png`.
- The portrait Music screen uses ten dedicated edge-to-edge, vehicle-led scene overlays under
  `public/assets/ui/music_genres/`. These are complete scenes—not vice-sprite collages—and are
  clipped under the existing star, checkmark, title, count, border, and hit target.

Snacks and drinks that genuinely resonate with each musical culture — the parody brand names are
part of the joke. Rolling-coal-style flavor (e.g. a smoke weapon reading as diesel ROLLING COAL)
lands best in the truck/country pack, which is what sparked the idea.

**Why it's strong:** the music picker already exists (6 stations, 78 tracks), sprites are
data-driven (`VICE_CONFIG` + manifest keys), and vehicles are data-driven — so this is mostly
an art-keying layer (sprite-skin per pack) + a big art order, not new systems. It converts
"radio station" from ambience into identity/replayability — pick your culture, drive its run.

**Prior art:** no mainstream game does exactly this. Closest: Brütal Legend (whole world themed
to one genre, not selectable), GTA radio stations (set tone, change nothing), Crypt of the
NecroDancer / Audiosurf / Beat Hazard (music drives *mechanics*, not culture skins), cosmetic
skin packs (no music link). Genre-as-selectable-culture-reskin looks genuinely novel — a
marketable hook.

**Implementation:** [index.html](index.html) renders
`assets/ui/music_genres/${culture}.png`; [AudioSystem.js](src/systems/AudioSystem.js) must expose
each station's `culture` id. Station indices remain stable for saves via `trackKey`. Slot mapping:
PHONK→HIP-HOP / PHONK, ARCADE→POP-PUNK / EMO, SYNTHWAVE→NORTEÑO, old HIP-HOP→REGGAETON;
EDM is relabeled EDM / RAVE. Existing audio remains attached to those slots until music is moved.

**Deployment status: SHIPPED & verified live 2026-07-17** (pushes `3a4d020` → `b98d2bc` → `fbc6ee3`).
`AudioSystem` exposes each station's `culture`, `public/assets/ui/music_genres/` + the full
`public/assets/culture/<genre>/` art are committed, and genre is now stored **per license plate**
(save slot → `rtr.genre` mirror; BootScene reads it at boot). The tutorial's Music step forces a real
genre pick, and a "Rotate Phone to Enter Game Play" prompt follows. Remaining: earn/buy GATING for any
genre past the first (deferred to post-dev-mode — see the pending list above).

## Changelog (newest first)

### 2026-08-31 (pt 11) — Opening-call audio unlock, round 2: LIFT events

Owner: pt-10's fix didn't take on the phone.  The flaw: the bless ran on `pointerdown`,
but iOS grants media activation on finger-LIFT events (touchend / pointerup / click) —
never on finger-down.  Rebuilt:
- Document-level capture listeners on all three lift events while the phone rings; ANY
  lift blesses the element with an in-gesture play-and-pause (owner's own observation —
  "you touch something before the call screen" — now actually banks that gesture).  The
  lift that ends the answer slide blesses via capture BEFORE the knob handler accepts.
- accept()'s rejection path retries on EVERY lift until one lands (each is a fresh
  gesture), un-fallbacks on success; `onAudioMissing` no longer nulls the element so a
  late gesture can still bring the voice in mid-sequence.
- `elapsed()` hardened: paused audio never drives the clock, and a late-unlocked voice
  can't rewind the visual timeline past the title beat.
Probed: stray tap blesses (unlocked, parked at 0), slide then plays from the top.
Awaiting on-phone confirm at /fully/?intro=1.

### 2026-08-31 (pt 4) — Zero-HP immortality fixed; close cops fill the rear-view mirror

- **Immortality at 0 HP (gameplay-breaking, owner hit it live):** a save
  written at/after the moment of death — a pagehide/visibility autosave
  FLUSH racing the crash cinematic — persisted hp 0 into `liveRun`.
  Resuming it parked DamageModel at 0, where `takeDamage`'s "already
  wrecked — no-op" guard made the car unkillable: drive forever at 0 HP
  with a cracked windshield.  Three-layer fix: (1) `setDurability` floors
  to 1 (a restore is always reviving a LIVE car; 0 is a wrecked state);
  (2) `_autosaveRun` bails if `isWrecked()`/`_endingCine` so a dead car is
  never snapshotted; (3) a per-frame zero-HP WATCHDOG ends the run via the
  crash cinematic if durability ever sits at 0 in live play (belt-and-
  suspenders for any future 0-without-transition path).  Verified: a
  forced setDurability(0) floors to 1 and stays killable; a real hit at
  1 HP wrecks and ends the run.
- **Rear-view mirror cops too small when close (owner):** the mirror
  capped cop sprite height at a flat 20 px, so a cruiser right on the
  bumper drew barely bigger than one far up the road.  The near cap is now
  ~80% of the glass on a `depthT^1.25` curve (far floor unchanged, masked
  so the spill crops like a real mirror).  Measured: a cop 300 units
  behind the car now fills 79% of the glass (was ~42%).
- Forward-view cop size (owner: "seem larger… could just be placement")
  left as-is — it passed the 08-29 pipeline-review size validation.

### 2026-08-31 (pt 10) — Opening-call audio: iOS gesture unlock + rejection retry

Owner: voicemail silent on the phone, fine on desktop.  Root cause class: iOS only
permits playback that BEGINS inside a real user activation, and a slide-to-answer can end
in `pointercancel` (edge swipe / system gesture) — not an activation context — so
`audio.play()` in accept() could reject and the sequence ran its SUPPORTED silent
fallback with no visible error.  Desktop mouse drags always end in `pointerup`, hence the
split.  Two-layer fix in OpeningCallSequence:
1. **Gesture bless**: the knob's `pointerdown` (always a gesture) does a play-and-pause
   on the element, unlocking later programmatic play() regardless of how the drag ends.
2. **Rejection retry**: if accept()'s play() still rejects, the NEXT `pointerdown`
   anywhere retries (fresh gesture); only after that fails — or 4 s with no touch — does
   the silent fallback engage.  The wall-clock timeline runs underneath either way.
Desktop path regression-probed (strict autoplay policy, real slide): plays from 0:00.
Needs an on-phone confirm with /fully/?intro=1.

### 2026-08-31 (pt 3) — Rotation/menu wedge: forced-open menu now pauses, toast taps armed, iOS clear hardened

- Owner: "can't rotate into the game menu since your last edit."  Could not
  reproduce a clean-rotation failure in emulation, but the investigation
  exposed real defects in the shipped tappable-toast feature that can wedge
  the rotate/menu state machine on a device:
  1. `__openTextThread`'s pause NEVER STUCK — its own layout `resize`
     dispatch re-ran applyOrientation, which resumed the scene it had just
     paused (landscape + menu-locked wasn't a pause condition).  The game
     drove on blind under the forced-open menu.  `applyOrientation` now
     counts `menu-locked` in shouldPause; the desktop `__phoneMenu.close`
     resumes the scene directly (no eaten click).
  2. Text toasts sit bottom-center between the touch pedals for 5.2 s — a
     driving thumb could force-open the phone the instant one appeared.
     Taps now arm 350 ms after the toast shows.
  3. `_clearTextForce` (the rotate-up leg that clears the forced state) ran
     one rAF after orientationchange — iOS updates innerWidth/Height late,
     so a missed clear left `menu-locked` stuck.  Now double-rAF, and a
     stale `__textThreadForced` flag retires itself if the lock is already
     gone.
- Verified headless (touch-emulated): clean rotate up/down, toast tap →
  menu forced open WITH the scene paused, rotate up clears, rotate down
  resumes on tap, repeat rotations clean; desktop bridge opens paused and
  closes resumed.  All suites + build green.

### 2026-08-31 (pt 2) — Game pause HOLDS the music in place

- Owner: "when the game pauses, pause the music too — pause in place, don't
  just mute it."  `AudioSystem.setPaused` only DUCKED the master gain while
  the track element kept advancing, so resuming skipped everything that had
  "played" silently under the overlay.  Now a game pause also pauses the
  element itself (`_heldByGamePause`), and resume picks the song up at the
  exact same spot.  Applies everywhere setPaused routes: the PAUSED overlay,
  garage/map modals, the out-of-gas card.
- Guardrails: a Music-app pause (`_musicPaused`) or mute set by the player is
  never overridden by the game-pause resume; an explicit song play clears the
  hold flag (`_enablePlayback`); the pause-menu volume-slider bookkeeping
  (duck snapshot/restore) is unchanged.  Headless-verified: currentTime
  frozen across a 2 s pause, resume continues from the same timestamp,
  app-pause survives a game pause/resume cycle.

### 2026-08-31 (pt 9) — Player steering frames: 7° 20% later, 12° 20% quicker

Owner retune of the STEER_POSE ladder: ENGAGE_7 0.18 → 0.216 (+20%, the first angled
frame holds off longer on light steering) and ENGAGE_12 0.78 → 0.624 (−20%, the second
frame arrives sooner on a committed turn).  RELEASE_7 0.10 → 0.12 and RELEASE_12
0.60 → 0.48 scale with their engage thresholds — leaving RELEASE_12 at 0.60 under a
0.624 engage would shrink that hysteresis band to 0.024 and flicker between frames on
steering noise.  Rates unchanged.

### 2026-08-31 (pt 8) — Genre-car speed table: per-difficulty cruise/top (owner table)

All 10 genre cars re-speeded from the owner's table.  Traits store the REGULAR column
(topSpeedMph/cruiseMph); `speedForDifficulty(mph, mode)` derives the rest at read time —
**Easy = Regular − 5** (the owner's Easy column is uniformly −5), **Hard = Regular × 1.1
rounded** (owner: "10% more than Regular").  Braking floor stays 60 mph everywhere.
Regular (top/cruise): Reggae 95/75 · Metal 100/80 · Country 105/85 · Pop Punk 110/88 ·
Norteño 112/90 · Reggaeton 115/92 · Hip-Hop 118/95 · K-Pop 120/98 · Classic Rock 122/100 ·
EDM 125/105.  Consumers: `_baselineCruiseMph`, `_updatePlayer` boost/cruise bases, the
garage row + dealer row mph displays.  Boosts (energy/caffeine/coffee/NOS/engine %) still
stack on top, clamped at SPEED_CAP_MPH 160 (owner choice).  Perk thresholds rescaled
proportionally with their genre's top change: Reggaeton drinks-above threshold 110 → 100
(top 126→115) + text; Classic Rock cash text 120 → 115 mph (the code rule is cruise×1.15
= 100×1.15); Reggae's below-100 band unchanged (still spans its whole range).
genreTraits.test: new tables + 7 difficulty asserts (185 total).
NOTE (owner Q&A): non-genre cars were requested REMOVED — already true since 2026-07-19:
VEHICLES holds only the beater CHASSIS that genre cars ride on; dealers sell genre cars
only.  The chassis' fallback speeds (cruise 90/top 120) apply only pre-genre-pick.

### 2026-09-04 — PURSUIT text readout removed (mirror is the signal)
Owner: *"Remove it. I think having the cops appear in the rear view mirror earlier, even if small helps
with this."* The "◀ PURSUIT — N ft behind" text had already been retired from normal play on
2026-08-27 in favour of the mirror pursuit glow (it survived only under the permanently-off colorblind
flag), which is why it read as a ghost when the tutorial's placeholder showed it. Now gone entirely:
`hudRearCop` object, the colorblind text branch, editor group `rearCop`, its placeholder, the
DEFAULT_HUD_LAYOUT slot (saved `rearCop` keys dropped on load), the bounds map entry, the legacy tour
step, and registry entry `gameplay.rearCop` → **39 entries (11/5/23)**. Mirror ranges for reference:
cars draw to `MIRROR_FAR_Z` 36 000 units, the pursuit glow starts at `MIRROR_GLOW_RANGE` 45 000.

### 2026-09-04 — Phone: hub/progress page REMOVED; tile = mode + description card
Owner: *"This tutorial progress screen should not be available anywhere. Numbers are for internal
stats for the achievement. Each screen has a tutorial button so this screen is confusing. On iPhone
menu, click the tutorial button and the description of the tutorial comes up, while all of the buttons
throb with the gold border."* `tutmHub()` deleted (+ its `.tm-hub` CSS, + the `__tut.openGameplay /
openGameMenu` bridge shortcuts and `_tutTitleModeOpen`, all only the hub used). Tile tap now =
`tutmOpen()` (every tile throbs) **and** `tutmIntro()` (the description card in the top sheet), every
time; GOT IT / ✕ drop the card and the mode stays; tapping the tile again exits. Progress counts still
exist in `TutorialSystem.progress()` for Road Scholar only — no UI shows them. Probe: tile → mode on +
card + 11 pulsing; GOT IT → card down, mode on; tile → off; tile → on + card again.

### 2026-09-04 — Tutorial Mode un-paused on every tap; Genre corner; polygon rings
Owner (deploy 0c600bc): *"I click GOT IT and the tutorial continues, however so does gameplay… most
buttons have multiple outlines that flash… but pause, ff, genre, map and mute do not… an additional
corner on the Genre button."*
- **Un-pause**: the scene-level `pointerdown` treats a body tap while `_paused` as RESUME unless
  `_anyModalOpen()`. Tutorial Mode was never a modal there, so GOT IT — and every entry tap below
  y 64 — flipped the run back on (my probes called the handlers directly and skipped this path).
  `_anyModalOpen()` now includes `_tutMode` and `_tutIntroDone`. Probe: `input.emit('pointerdown',
  {x:400,y:300})` in the mode → still paused, odometer frozen.
- **Genre corner**: `top_btn_genre.png` has a stray 1-px opaque black column down x=0 (alpha 255, then
  0 until the glass at x≈20). `_texQuad`'s span now needs a ≥3-px opaque run → TL corner 21%, like its
  siblings. The art itself is untouched — worth cleaning in the PNG when convenient.
- **Rings**: polygons get the same solid→transparent ring set as the rectangles, stepping INWARD from
  the glass edge (insets 0/3/6/9 px about the centroid) so nothing crosses the 1-px gap to a neighbour.
- Open question for the owner: the PURSUIT readout (`hudRearCop`, "◀ PURSUIT — 120 ft behind") is still
  a live gameplay element (shown during 1–2★ pursuits) and the mode shows its placeholder; owner
  "thought we got rid of that" — remove from the game, or just from the tutorial?

### 2026-09-04 — Top-row buttons: hit area + tutorial outline = the visible glass (parallelogram)
Owner: *"make the buttons match the visible pixels of the image… more like a parallelogram instead of a
square. The highlighted border would also be a lot smaller and not overlap other buttons."*
`_texQuad(texKey)` samples each 150×150 tile's alpha (opaque span at 15% / 85% of the content height,
extrapolated to the content top/bottom so rounded corners don't pinch) → 4 normalised corners, cached
per texture, full-square fallback. `_setTopRowHitArea()` installs `Phaser.Geom.Polygon` +
`Polygon.Contains` from BOTH placement passes (`_applyControlLayout`, `_applyTopRowHandedness`), so the
creation-time squares are replaced on the first frame — no creator edits. `_hudElementBounds('btn_*')`
now carries `poly`; `_drawTourGlow[Into]` draws tight polygon rings (7/4.5/2.5 px, ~3 px halo) + fill,
the cyan selection ring follows the glass, `_tutModeTap`'s `inside()` is polygon-aware; box placement
and the PREV/✕/NEXT chips keep the enclosing rect. Measured quads (u,v %): pause TL(21,8) TR(99,8)
BR(77,91) BL(0,91) — Genre's top edge runs to u=0 (its icon art reaches the tile edge). Probe: tap at the
square's corner → nothing; centre → the entry; "?" → closes.

### 2026-09-04 — Intro card pauses the run; GOT IT lands IN Tutorial Mode (all three menus)
Owner: *"When I first click on the tutorial button, the message comes up… but the game keeps playing in
the background. The game should pause and after the message is closed, the game should remain in the
tutorial mode."* + *"GOT IT should drop into tutorial mode on all menus."* `_tutShowIntro()` now sets
`_paused` immediately for the in-run card (odometer verified frozen while the card is up) and its GOT
IT calls `_tutModeOpen('gameplay' | 'game_menu')`; the phone's GOT IT calls `tutmOpen()`. Probes:
in-run card → paused, no movement; GOT IT → mode on with 24 entries, still paused; close → unpaused.
Phone GOT IT → capture on, all 11 tiles pulsing. `_tutIntroDone` is the probe hook for the card.

### 2026-09-03 — In-game Tutorial outlines were one layout offset off their buttons
Owner screenshot (left-handed HUD, mode open): every top-row outline (Pause/FF/Genre/Mute/Map/?) sat
beside its button. Reproduced headless (`hud_probe.cjs`, 932×430, `_leftHanded=true`): bounds vs art
differed by exactly the saved layout `dx` (pause −45 vs 4, genre 52 vs 118, mute 694 vs 626). Cause:
`_applyTopRowHandedness()` placed the art at the BARE base slot (no layout offset/scale), and with the
run paused the per-frame `_applyControlLayout` never ran to move it back — so opening the mode (which
calls the handedness pass to light the "?") shoved every button off its own hit rect. Same latent bug
for the pause menu / mute toggle while paused. Fix: the handedness pass now uses the identical
placement (`base + _ctrlOff dx/dy`, `size × scale`) and publishes `_lx/_ly/_lsz` itself. Verified: all
six buttons bounds == art.
Also: the cold-engine gauge is hidden unless the controls editor / legacy tour forces it, so
`gameplay.engine` had NO bounds in the mode (unreachable → would block Road Scholar for anyone whose
engine never ran hot). `_renderHUD` does not run while paused, so `_tutModeOpen` now renders ONE armed
HUD frame (`_tutArming`) before freezing — the gauge draws its warm placeholder and publishes bounds.

### 2026-09-03 — Pull-over requires the BRAKE (1–2★ comply flow)
Owner: *"I pulled off the road and was pulled over, without hitting the brakes. You should only get into
a traffic stop if your brakes are on."* The stop latched on speed alone (< 8 mph for 0.8 s with the tail),
and the 2026-08-31 shoulder rule auto-brakes the car to 0 on the grass — so shoulder → auto-stop → stop.
Owner's pick (tap-to-choose): **brake required, shoulder still slows**. `_isBrake()` is now part of the
dwell condition; `_pursuitStopping` (grass auto-brake) is unchanged, so you can sit on the shoulder at 0
without a stop until you hold the brake. Steering back onto the road still releases everything.

**Steering turn frames (same conversation):** owner saw "only one angled image" on Classic Rock. Normal
steering uses exactly two frames — `starter_back_turn_007.png` (tap) and `starter_back_turn_012.png`
(held) — and the 30–150° spins are PIT-only. On Classic Rock the two exports differ by ~8 px of yaw per
side, so they read as one image. Owner will re-export the **012** frame with more yaw (per genre:
`public/assets/culture/<genre>/vehicles/starter_back_turn_012.png`, 1024×1024, alpha-measured tire
anchor). No code change.

### 2026-09-03 — Contextual Tutorial Mode (replaces the three linear tours)

**Pt 2 (same day) — art in, Garage off the HUD, per-button pulse lives.** ChatGPT's follow-up brief
plus owner rulings: *"Get rid of the garage button on the HUD"*, *"the upper left corner of the title
screen is open… above the plates"*, *"every tutorial button will pulse until each is selected for the
first time, each having its own pulse life."*
- **Art**: the four finished 150×150 PNGs copied to `public/assets/ui/` (`top_btn_tutorial[_active]`
  = skewed black-glass HUD tile; `menu_btn_tutorial[_active]` = standalone caution sign, dark face /
  neon-yellow "?" normal, filled-yellow face active). Manifest keys `ui_top_btn_tutorial[_active]`,
  `ui_menu_btn_tutorial[_active]`; `ui_top_btn_garage` unregistered (the PNG stays on disk, unused);
  the canvas placeholder generator `_ensureTutorialTextures` and the Garage vector fallback deleted.
- **HUD**: Garage button REMOVED from the top row; the "?" takes its slot (`mapX + 56 + 1`). Garage
  remains reachable only from the Phone GARAGE tile (`openGarage`, unchanged). `DEFAULT_HUD_LAYOUT`
  key `btn_garage` → `btn_tutorial`; on load any saved `btn_garage` offset is copied to `btn_tutorial`
  (only if that is unset) and the stale key deleted — non-destructive, no layout-version bump needed
  since the slot is identical. Registry entry `gameplay.btn_garage` dropped → **40 entries (11/5/24)**.
- **Title screen**: real `?` image at design (16,16) 56 px (`TUT_TITLE_BTN`), depth d+12, UI camera
  only, in the `_setTitleVisible` and fade lists; `_tutTitleToggle()` → intro card on first-ever
  press, else `_tutModeOpen('game_menu')`. Active state swaps to the filled-yellow sign; closing
  swaps back. The DEMO badge moved right to x124 to clear it.
- **Pulse lives**: new save key `tutorialBtnSeen = { phone, game_menu, gameplay }` (whitelisted in
  SaveSystem; `Tut.btnSeen/setBtnSeen`; bridge `__tut.btnSeen/setBtnSeen`). Each button throbs gold
  until ITS first selection, never while active. Phone tile: `tutmTilePulse()` polls for the bridge
  then toggles `.tut-flash` off the flag; first tap also calls the legacy `markTutorialSeen()` so the
  phone's notification dot clears. HUD "?": `_tutModeUpdate` first-run block now reads the flag.
  Title "?": `_tutTitleGlowUpdate()` is event-driven (build / toggle / open / close / visibility).
  `tutorialIntroSeen` still gates the ONE intro card, shared across all three buttons.
- **Forced tour retired**: the phone's boot-time `tryForce → tutStart(true)` block is gone and the
  tile no longer falls back to `tutStart(false)`. The ~300-line legacy tour body (`tutStart`,
  `TUT_TOUR`, `_startTitleTutorial`, `_buildHudTour`) is now unreachable and is the next cleanup —
  left in place this pass so the removal can be reviewed on its own.
- Tests: tutorial.test 38 (was 30) — counts re-baselined to 40/24, +9 pulse-life checks (per-button
  independence, idempotence, unknown button, junk repair, intro flag ≠ button flag).
**Pt 3 (same day) — first on-device playtest (owner screenshots, title screen).** Rulings: *"an X in the
text box will close the text, but not the tutorial. The Tutorial button closes the tutorial. Maybe add
some 'close' text after the button in the Game menu, but all others no text"*; *"I don't want the text
box to cover any highlighted buttons, HUD, or text"*; *"Yellow is unselected"*; Reduce Motion is OFF.
- **Root cause of "nothing throbs"**: `_renderHUD`'s per-frame HUD alpha sweep (`obj.alpha = _alpha`
  for every `_hudObjects` entry — the fentanyl fade / caffeine flicker) was pinning every tutorial
  glow to alpha 1, killing the tween. Tutorial chrome now goes through `_tutUi(objs)` which flags
  `_noHudAlpha` and the sweep skips it. (The legacy title tour pushed its glow the same way and would
  have had the same bug.)
- **Phantom "button" upper-right**: the HUD "?" first-run glow drawn from its bounds while the HUD row
  is hidden on the title (owner is left-handed → that slot is top-right). Now gated on `lbl.visible`.
- **Title sign swapped**: filled-yellow `menu_btn_tutorial_active.png` is IDLE; dark face + neon "?"
  `menu_btn_tutorial.png` is ON. A small `CLOSE` label appears right of it only while on (title only).
- **Box placement avoids everything**: `_placeTourBox(…, { avoid })` — pass 1 finds the largest font,
  in band order, at an alignment (centre/start/end × anchor-first y) that clears every rect in
  `avoid` = all other highlighted bounds + the "?" (+70 px for CLOSE on the title) + the banner; pass 2
  = old first-fit. So PLATES now lands in the open art to the right instead of over the four cards.
- **Footer chips**: `‹ PREV · ✕ · NEXT ›` are real Phaser text chips with padded hit rects (generic
  labels — the old "next-entry name" footer read as broken buttons). ✕ = `_tutModeHideBox()` (text
  only). Panel body swallows taps.
- **Phone sheet → TOP** over the status strip (weather / location / time — not targets):
  `tutmFitSheet()` spans the tile columns (`tutorial` left → `maps` right), top = art top or the notch
  inset, `max-height` capped above the first tile row (599 art px, tile 233 wide → scale). Nav are real
  `<button>`s via `addTap` (iOS was not delivering `click` to the spans). ✕ = `tutmHideSheet()` (text
  only). Banner hides while the sheet is up. This also ends the Safari-bottom-bar clipping.
- Banner dropped flush to the bottom edge (`SCREEN_H - 3`): at −14 it grazed the START/LOAD frames.
- **Verified headless** (Playwright probe, scratchpad `tut_probe.cjs`): frames 300 ms apart differ in the
  glow region with the mode off AND on (throb live); PLATES box → (177,10) 613×283 right of the plates,
  START box → centred art area, neither touches a card; ✕ leaves `_tutMode` set; close → yellow sign,
  CLOSE label hidden. Phone: hub → PHONE → sheet at the top (bottom 241 px vs tile row 292 px), NEXT →
  Maps, ✕ hides the sheet with the capture layer still on. Harness gotchas: `#tilt-explainer.on` pops
  over the hub ~1 s after the phone opens (drop its `on` class); Playwright's own `click()` never
  reached the tiles — dispatch pointerdown/up + click at `elementFromPoint` instead; scene handle for
  probes = `window.__tut._scene()`.
- **Intro card in the sheet too** (owner: *"say the same thing as it currently does, but without going
  to a new page"*): `tutmIntro()` now renders the intro text + GOT IT in the same top sheet; no
  `openApp` page. GOT IT → `tutorialIntroSeen`, sheet hides; the next tile tap opens the hub (still an
  app page — owner has not asked to move the hub). Sheet is now `display:flex; column` with a
  scrolling `.tm-body` and a PINNED `.tm-nav`, because in the narrow desktop phone frame the content
  overran the cap and GOT IT scrolled out of reach (probe caught it: the tap landed on a tile).
- ⚠️ The owner's 2026-09-03 evening screenshots (dark "?", phantom top-right glow, bottom sheet with
  entry-name Prev/Next) are the PREVIOUS build — none of Pt 2/Pt 3 is deployed yet.

**Pt 4 (same day, after deploy 7f4644d) — phone taps landed one card RIGHT.** Owner: *"When I click on
driving type, the load save description comes up… the plates are not selectable and neither is the
tutorial button after I selected the first time."* Cause: `_tutModeTap` compared raw `ptr.x` (canvas
space) against HUD-space bounds, but `_uiCam` is scrolled −HUD_OFFSET_X on the widened phone canvas
(975 wide at 932×430 → scrollX −87.5). Fix = the pause-menu volume-slider conversion:
`px = ptr.x + _uiCam.scrollX`. Desktop probes never caught it because there the offset is 0. Verified
with a phone-aspect Playwright run (`offset_probe.cjs`): plates/start/diff/drive/load each resolve to
themselves and the "?" closes the mode. (Note: the slider comment "no-op on mobile" is stale — mobile
IS widened.) Also owner: *"the images for the tutorial button are swapped"* → back to the brief's
mapping: dark face + neon "?" idle, filled-yellow sign while ON.
- **Pt 5 — LOAD/SAVE box buried the plates** (owner screenshot after 1165c84). `_placeTourBox` only
  tried a panel as wide as the free band, so above the LOAD card the panel spanned the whole width and
  could never clear the plates → fell back to first-fit. Pass 1 now also tries 0.78 / 0.6 / 0.48 band
  widths (same font first, then shrink) at each alignment. Phone-aspect probe (`overlap_probe.cjs`):
  all five title boxes clear every other highlight + "?" + banner (LOAD → x182 w608, right of plates).
- Image viewing in this Claude session works again (screenshots ≤ 2000 px).

- **Name collision found by the headless smoke** (`B.btnSeen is not a function`): the legacy tour's
  music-menu hooks were ALSO published as `window.__tut`, so the two scripts clobbered each other
  depending on load order. Legacy object renamed `window.__tutLegacy` (5 consumer calls in
  index.html + one `__tutLegacy?.active?.()` guard in GameScene). `window.__tut` is now ONLY the
  contextual-tutorial bridge from `src/main.js`.

**Owner brief:** optional Tutorial Mode — tap any button / icon / readout to learn what it does, in
any order, with read/unread progress that persists; a "?" caution-sign toggle on each screen; a hub
with per-category progress; a **Road Scholar** achievement at 100%.

**Registry — `src/systems/TutorialSystem.js`** (no Phaser, no DOM). **41 entries** with stable ids
`<category>.<element>`: 11 `phone.*`, 5 `game_menu.*`, 25 `gameplay.*`. The element half is the
SAME key the live resolvers already use (`_hudElementBounds`, the phone's `qhit`, the new
`_titleElementBounds`), so an entry finds its own UI object with no lookup table. Progress is an
id→true map under save key **`tutorialRead`** (per plate, whitelisted in SaveSystem beside
`radarDetector`); **never by index**, so reordering or inserting entries cannot corrupt it.

**Live bounds, not hotspots.** Stage 2 (HUD tour) already resolved from live objects — `_lx/_ly/_lsz`
carry the player's customized position/size — and that is reused unchanged. The title screen's five
hand-typed rects are gone: `titleRectShape()` now returns `rect` and `makeTitleZone()` stamps it on the
zone as `_tutRect`, so the outline comes from the SAME geometry the hit-test uses. Plates = union of
`_plateSlotObjs`.

**The "?" button.** In-game it takes **Garage's slot** in the top row and Garage shifts one slot right
(owner: "this is a replacement"; Garage relocated, never removed). Toggle: normal art off, inverse art
on (`_applyTopRowHandedness` lights it via `_tutMode`). Until the PNGs land, `_ensureTutorialTextures()`
generates 150×150 caution-sign placeholders under the FINAL keys, so dropping the art in is a
manifest-only change. First run: gold throb on the button until the intro card is acknowledged
(`tutorialIntroSeen`). ESC closes the mode.

**In-game / title mode** (`_tutModeOpen(cat)`): scrim owns every tap so no normal action fires;
gameplay pauses (title does not); every UNREAD entry gets the throbbing gold border redrawn **each
frame from live bounds** (`_tutModeUpdate` is called from `_applyControlLayout`), so custom layouts,
resize and handedness flips keep borders glued on. Tap any entry, read or unread → title + description
via `_placeTourBox` (never overlaps its target); viewed → read → border clears → Road Scholar check.
Panel left/right thirds = Prev/Next (optional, never required). Reduced motion → gentle 0.8↔1 breathe.

**Phone** (`index.html`): the tile is now a HUB (3 categories with N/M + Overall) and a toggle. "iPhone"
enters phone Tutorial Mode (unread hotspots `tut-flash`, capture layer, bottom sheet, Prev/Next, ✕);
"Game Menu"/"In Game" close the phone and open the matching Phaser mode through **`window.__tut`**
(main.js), the single DOM↔Phaser seam. The inverse tile art overlays the painted icon at (42,599); if
the file is missing it falls back to a CSS inversion so the toggle state always reads. **`tutStart`
(the old linear tour) is no longer called from anywhere** — dead code, remove once the mode is confirmed.

**Road Scholar** — `AchievementSystem.awardUntiered()` (new): not a run, so the mode-gated tiered
`award()` was wrong for it (Custom refuses, Easy would call it bronze). Denominator = entries whose
`applies(ctx)` passes; **latched** — once in `achievements` it never re-evaluates, so future entries
cannot revoke it.

**Tests** — `tests/tutorial.test.mjs` (wired into `npm test`): 41/ids unique/format, category counts,
element keys match `_hudElementBounds`, read/idempotent/unknown-id, save round-trip, positional
independence, progress + completion, applies() exclusion, latch.

**Copy audit — all 41 rewritten** (Title / one sentence / optional second), `audited: true` on every
entry. Four old claims the code did NOT confirm were dropped from the text and kept as `review:`
on the entry for the owner to rule on:
- `game_menu.diff` — "Custom unlocks after completing the drive": no such gate found.
- `gameplay.hp` — "Food & Drink add health on Easy": no heal path found.
- `gameplay.pedalGas` — "+20 mph": boost is a per-car base × traits, not a fixed bump.
- `gameplay.pedalBrake` — "under 100 mph you're losing money": the cash bonus gates at **15% above
  the car's cruise baseline**, not a fixed mph. (The brake itself does drop you to 60 mph — verified.)

**Copy audit (spot checks):** `stars` was incomplete — `clearStarsAtStateLine()` gives ZERO reduction
at 4★+ (weapon-earned heat is immune); fixed. `weapons` "3 max each" verified (`canCarryMore`).
`pedalGas` "+20 mph" could NOT be verified — flagged, not guessed. Stage 1b copy was developer voice.

**ART NEEDED (owner producing):** `assets/ui/top_btn_tutorial.png` + `_active.png` (150×150, the
`top_btn_pause`/`_active` convention) and `assets/ui/phone_app_tutorial_active.png` (230×360, inverse
of the icon painted at (42,599) on `iphone_menu_bg.png`). Then add the two `ui_top_btn_tutorial*`
manifest keys; the placeholder generator steps aside automatically.

**Open:** phone/title modes verified by build + inline-script parse only — needs a hand playtest; the
`?dev=1` bar has no tutorial knobs yet; the old `TUT_TOUR`/`_startTitleTutorial`/`_buildHudTour` code
is now reachable only from legacy flags and should be retired with the owner's OK.

### 2026-08-31 (pt 7) — Pursuit hold pinned in the physics step (no creep, no drive-out)

Owner: the car still crept during a 1-2★ traffic stop and could be driven out mid-hold.
The hold zeroed speed/steer in the UPDATE loop — after cruise easing had already re-added
a step of speed each frame (the creep) and without ever freezing steering (the escape).
Now identical to the trap hold: `_pursuitStopHold` joins the `targetSpeed = 0` pin inside
`_updatePlayer` AND freezes `p.x` at `_pursuitStopHoldX` (latched when the hold begins).
Real-input probe (held ArrowUp+ArrowLeft 3 s mid-hold): creep 0 units, dx 0, speed 0,
hold intact.  Probe gotcha: writing `player.speed` directly from an interval bypasses the
targetSpeed pin and fakes an escape no real input can do — escape probes must use keys.

### 2026-08-31 (pt 6) — "PULL OVER" now works by actually pulling over

Owner: "HUD says Pull Over, I do, but nothing happens — car keeps driving 60 over the
grass."  Two causes:
- **Speed-trap flow**: the commit chord required BRAKE HELD + x > 1.2 (deep grass) — just
  steering onto the shoulder (the natural read of "PULL OVER") never committed, so the
  30 s window always expired into "+1★ failed to pull over".  The brake requirement is
  dropped and `COP_TRAP_SHOULDER_X` is 1.2 → 1.06 (just past the rumble strip).  Abort
  by steering back inside 0.9 unchanged.
- **1-2★ comply flow** had NO shoulder detection at all (near-stop only).  New
  `_pursuitStopping`: armed + right shoulder (x > 1.06) → `_updatePlayer` targets 0 (the
  cruise floor is 60, so the assist is what makes stopping possible), the near-stop dwell
  then latches the hold as usual; steering back releases it.  Cleared during the hold and
  on eligibility loss.
- Complying is now penalty-free for the whole 1-2★ sequence too: `trafficStop` (the
  slow-driving + off-road cash-penalty suppressor) includes `_pursuitStopping` and
  `_pursuitStopHold`.
Probe: 1★ tail, armed, steer to x=1.25 at ~60 mph → assist engages, car brakes itself,
hold latches at 0 mph.

### 2026-08-31 — HOTFIX: garage crash on the second rest-stop visit

- Owner hit an uncaught error on the LIVE build opening Les Schwasted at the
  Bellevue stop: `_updateScrollbar → setSize` on a destroyed rectangle.
  Phaser reuses the RestStop scene instance across visits; the shop
  scrollbar's lazily-created track/thumb were destroyed with the previous
  visit's display list but the stale refs survived on `this`, so the SECOND
  stop's first garage-category select threw.  Same destroyed-GameObject
  class as the GameScene pause-button gotcha — the guard is now
  `!obj || !obj.scene` (destroy nulls `.scene`), rebuilding the pair per
  visit and resetting `_sbGeom`/`_sbDrag`.
- Verified headless on the real path: Mercer Island stop → garage + scroll →
  hit the road → Bellevue stop → garage + scroll; zero page errors.

### 2026-08-31 (pt 5) — Road Rage bulldozes EVERY cop on contact

Owner: during rage, pursuit nudges and the parked speed-trap trooper still affected the
player.  `_onCopCollision` now opens with an all-kinds rage guard (ABOVE `registerBump()`,
so rage contact never feeds bust counters): any cop the player touches — rear pursuit,
oncoming, SWAT, barricade cruiser, the parked trap trooper — explodes and is gone with
zero effect on the player, matching the 08-27 roadblock/barricade rule.  Touching the
trap trooper also resets the whole traffic-stop machinery (`endTrapPursuit` + the six
`_trap*` fields + light flash) so the SLOW DOWN/PULL OVER sequence can't wait on a
cruiser that no longer exists.  The barricade branch's own (now unreachable) rage guard
was removed.  Probe: committed lunge ram during rage → tagged cruiser despawned, HP and
BUMPS tally unchanged.  (Probe gotcha: the anti-pass clamp snaps a teleported cop back to
station before contact — only a committed lunge (`_lungeT`) can reach the bumper.)

### 2026-08-31 (pt 4) — Restart button names the place it actually restarts at; EAT/DRINK verbs

- **"Start over said North Bend, delivered Seattle"** (owner, out-of-gas screen): when a
  run is RESUMED after a page reload the registry has lost `runStartSnap`, so the latch
  rebuilds it mid-run — position correctly pinned to 0, but `locName` came from
  `_lastCheckpoint` (North Bend).  The name now follows the same branch as the position:
  daily stages use their stage city, everything else pins to 'Seattle, WA'.  (Restarts
  themselves always went to mile 0 — only the label lied.)
- **Confirm verbs, round 2** (owner): free popcorn says **EAT** ("you don't USE free
  popcorn"), free drinks say **DRINK** (payload `survivalDelta.hydration > 0` when free),
  restroom stays USE, paid items stay BUY/INSTALL/FILL/etc.  Probe-verified all four.

### 2026-08-31 (pt 3) — Free items say USE, never BUY

Owner: the free restroom's confirm asked to "buy" it.  `_confirmBuyPopup`'s verb chain now
ends `shown > 0 ? 'BUY' : 'USE'` (specific verbs INSTALL/FILL/REPAIR/TAKE/PICK UP still
win), and a heading whose item label already leads with the verb no longer stutters
("USE RESTROOM?", not "USE USE RESTROOM?").  The affirmative button tracks the same verb.
Probe: restroom "USE RESTROOM? / FREE / USE", popcorn "USE FREE POPCORN?", burrito still
"BUY BURRITO? / $12", parts still "INSTALL …".

### 2026-08-31 (pt 2) — HOTFIX: crash on every part purchase ("game restarts a lot")

The 08-31 shop rework deleted `_applyDealerTierGate` and its two known call sites but
MISSED a third inside `_unlockTier` — which runs after EVERY upgrade purchase.  Each buy
threw `TypeError: not a function` → main.js's uncaught-error handler marked a crash →
reload + auto-resume, i.e. the game "restarting a lot".  The call is replaced with the
plain `_buttonRefresh` repaint (all the gate's exit path still did).  Probe: `_unlockTier`
runs clean, next rung unlocks, zero page errors.  Lesson recorded: when deleting a method,
grep the WHOLE file for call sites, not just the ones found on the first pass.

### 2026-08-31 — Traction Tires deleted; per-shop level-3 exclusives replace the Lord gate

Owner spec (Q&A settled the particulars):
- **Traction Tires accessory DELETED, full removal, no refund**: redundant with Snow Tires
  (tires lvl 3) + Snow Chains.  Removed everywhere — shop row, purchase handlers (both the
  legacy `tractionTires` payload and `vehicleAccessory:'traction'`), the flat 0.40
  penReduction term in the slide math (4x4 keeps 0.60; 4x4 + Snow Tires + Chains still
  reaches a full 1.0 cancel; non-4x4 tops out ~0.5), the custom-mode SNO-TIRE sandbox
  toggle (radar shifted into its slot), `_vehicleAccessories()`, the phone-garage ❄️
  badge (index.html) + card field (main.js), VehicleStats grip bonus, the UpgradeSystem
  legacy `tractionTires` bridge, and SaveSystem serialization (stale save flags are
  silently discarded on load).  The mile-39 "TRACTION TIRES ADVISED" road sign stays —
  real-world WSDOT flavor that now points at Snow Tires/Chains.
- **`_applyDealerTierGate` DELETED** (the blanket "level 3 needs a Lord Motors at this
  stop" rule).  Level 3 now has one home per part, ungated beyond the normal
  install-the-previous-tier ladder locks:
  - Les Schwasted — Snow Tires + Big Brake Kit + Lowering Kit (chassis, owner: a tire
    shop does brakes/suspension)
  - Finesse (FAP) — ECU Tune, High-Flow + Aux Fan, Reserve Gas Tank (internal)
  - Lord Motors — NEW parts counter on its ACCESSORIES screen (`SECTIONS.dealer_acc`,
    previously empty) selling the Bash Bar (body lvl 3); body 1-2 stay at FAP services
  - Park & Ride + Sam's — police lvl 3, RENAMED "Fresh Plates" (paint dropped from label
    and desc — the car's color never changes); both plate-sellers list it, ladder-locked
    behind the Police Scanner
  Untabbed slots (body/police) now surface their lvl-3 rung ALWAYS (lockable 🔒 row at
  its exclusive home) while keeping next-tier-only listing at FAP for lvls 1-2.
- Verified headless at Cle Elum (garages, no Lord: lvl-3 rows present with only ladder
  locks, no Lord gate, no traction row) and Bellevue (Park & Ride + Sam's list Fresh
  Plates, Lord's counter lists Bash Bar, no "Paint" wording).  Full suite green (police
  suite included).

### 2026-08-29 — Opening-call audio: diagnosis + ?intro=1 replay param

Owner report: "club manager audio doesn't play on first open, multiple devices."  Traced,
NOT an audio bug — verified end-to-end (fresh profile, real slide gesture, strict autoplay
policy) on localhost AND deployed /fully/: overlay shows, mp3 plays, clock advances, no
errors; the file itself is healthy (12.5 s, −17.6 dBFS RMS, −1.7 dBFS peak).  Actual
causes for the report:
- **The sequence is once-per-device** (`settings.introCallDone` + `rtr_intro_call_done`),
  so any device that ever completed it — including during the pre-2026-08-14 "dead air"
  era — silently skips it forever.
- **The root deployed URL is the LANDING PAGE**, not the game — no call there ever; the
  game (and the intro) live at /fully/ (and /demo/).
Added `?intro=1`: clears the completion flag at boot and replays the call like a first
open (probe-verified on a flagged-done profile).  `window.__replayOpeningCall()` remains
the console equivalent.  iPhone testing caveat: the hardware ring/silent switch can mute
web audio — check it before judging silence on iOS.

### 2026-08-28 (pt 2) — Lightbar lamps: two rect bulbs + oval haze; player taillights found in the art

**LIGHTBAR READ AS ONE BULB CHANGING COLOUR** (owner). It was exactly that — the dark
low-profile path drew a SINGLE ellipse over the whole strip, flipping red/blue:

    bar.fillStyle(cop.flash ? 0xFF3333 : 0x2255FF, ...);
    bar.fillEllipse(whole.x, whole.y, whole.w, whole.h);

Now two lenses that SWAP: at any instant one end is red and the other blue, so colour rotates
across the bar instead of the whole strip changing at once.

Every path also drew the bulb itself as an **ellipse**. A lightbar is a strip of rectangular
lenses, so the lit element is a `fillRect` sized to the lens the art paints, wrapped in a
two-stage bloom **2.6× wider than tall** — a bar throws a horizontal smear, not a circle.

All **four** paths were converted (measured red/blue lenses, dark low-profile bar, legacy flat
art, and both colourblind variants) through one `_lightbarLamp()` helper — 11 call sites, zero
`fillEllipse` bulbs left in the block. Four inline copies would have drifted, and department art
genuinely varies (Seattle blue-left, Pullman red-left, Snoqualmie/Adams no baked lenses at all).
Bulb size comes from the **measured lens boxes** in the frame metadata where they exist.

**PLAYER TAILLIGHTS — found in the art, not guessed.** Owner reported them too high, then too
low. Three separate bugs underneath:

1. **Wrong lamps first.** `_renderHeadlights` (traffic/cop only) was lowered 0.50→0.36; the
   owner was looking at the PLAYER's fog taillights, a different draw entirely.
2. **My regression.** That draw used `displayHeight * 0.34 - 12`, and the player-sprite rescale
   (pt 13) increased displayHeight, pushing the lamps up.
3. **Canvas vs content, again.** displayHeight is the whole SQUARE 1024×1024 canvas while the car
   fills 53% of it on edm_rave and 87% on country — so `0.34 of canvas` came out as **64% of car
   height** on edm_rave, up by the roofline.

Fixed by scanning each texture for the lamps the art actually paints (`_texLampSpots`, cached like
`_texContentBox`) and mapping source px → screen through the tire-contact origin.

⚠️ **A NAIVE COLOUR SCAN DOES NOT WORK — several cars are RED.** Averaging red pixels returns the
centroid of the bodywork (country: 50,514 red px, lopsided 7.9k/4.8k). Approaches that failed:

| approach | failure |
|---|---|
| average red pixels | red cars → centre of the body |
| brightness threshold | still fooled norteno (71k px), reggaeton (59k) |
| outermost blobs | picked stray specks |
| two largest blobs | reggaeton returned both at dead centre |

What works is **pair matching**: two compact, similarly-sized, lamp-bright blobs, level with each
other, symmetric about the car's centre, ≥0.30 of width apart. Detects **9/10 genres**
(`classic_rock` has no lamp-bright red and falls back to `lampFrac()`, which is the guard working).
Country scores 0.0013 — two identical 336 px blobs at u 0.059/0.941.

Also: traffic tail lamps 0.50→0.36 (0.55→0.42 tall vehicles), and that value now lives in ONE
`lampFrac()` helper because it had been copied inline into two render passes.

⚠️ **IMAGES COULD NOT BE VIEWED THIS ENTIRE SESSION.** The API rejects images once several
oversized ones are in context — phone shots are 4032×3024, and after the first few bounced even a
760 px / 31 KB copy was refused. Resizing does NOT help; only a fresh session clears it. Uploads DO
land on disk, so everything above was MEASURED with Python (PIL → threshold → connected components
→ pair scoring). **If this recurs: analyse the file, do not try to view it.**

**Still open:** the 1-2★ pull-over regression. `12f292f` clears `_pursuitStopArmed` whenever
eligibility lapses (e.g. the tail drifting past `PURSUIT_STOP_NEAR`), but the flag can only be SET
above 20 mph — so slowing down to pull over wipes it permanently and the stop never fires. The
dispatch pacing added the same day makes it easier to hit, since cops now sit further back.

### 2026-08-30 — Speed traps keep off the exit lanes

- Owner report: a parked trooper sat ON an exit lane.  Root cause: the
  corridor-aware trap placement (2026-08-14) keys off `_exitCorridorRight`,
  but that flag was only ever set in the narrow SIGN windows — the exit
  plan's actual painted ramp (taper→parallel→divergence→departure, ~1 mi,
  tagged `exitInfo`/`rampStrength` by ExitPath.js) was unflagged, and the
  1.20-1.45 shoulder offset lands exactly on the widening exit lane.
- Fix (RouteData, just before trap placement): one backwards sweep flags
  every plan-painted segment + a ~0.15 mi approach margin as exit corridor;
  the existing re-roll/left-shoulder fallback then avoids the whole ramp
  area.  Verified over 4 live route builds: 7,845/7,845 ramp segments
  flagged, zero right-side traps inside any ramp or corridor segment
  (left-shoulder fallbacks observed working).  All suites + build green.

### 2026-08-29 (pt 5) — Police pipeline review: 9-item repair (Codex findings, owner-directed)

Owner pasted a Codex review of the police rendering pipeline; every claim was
verified against live code before repair.  Ch.17's implementation notes are
updated to match.  Root causes + fixes:
1. **Light-bar metadata**: the red/blue lens scan mis-locked onto taillights,
   the Adams red "7" unit number, and Othello's blue livery stripe.  New
   `scripts/policeLightbarSheet.mjs` renders per-agency contact sheets with
   every effective box drawn on the art (tmp/police_lightbar_sheets/);
   hand-reviewed corrections live in `src/data/policeSpriteOverrides.js`
   (survives builder reruns; merged at load in policeAgencies.js).  All 27
   Snoqualmie/Adams/Othello frames overridden to WSP roof-bar geometry
   remapped through SOLID body boxes, dark whole-bar flash, no per-color
   lenses.  Visually verified on the sheets.
2. **One shared render transform**: `place()` now returns the cop body's
   FINAL geometry (tunnel 0.88, flee-exit sink, synth seat, caps, fades,
   depth) — cached as `cop._renderGeom`; the light-bar pass consumes it
   instead of rebuilding ~40 lines of projection (bars no longer detach in
   tunnels).  GOTCHA: gate is `lightsKind === 'cop'` (vehicleKind carries
   the colorSet).
3. **Spin scaling + FULL 360 (owner: "a full 360 or more")**: `_spawnCopSpinFx`
   now reuses the resolver's solid-height normalization (constant tire-to-roof,
   width grows naturally at broadside) with a per-frame TIRE-BASELINE origin —
   validated 0.0% height spread / 0.0 px baseline drift.  New `SPIN_360_WRECK`
   / `SPIN_360_PIT` ladders play 0→180 then the RETURN leg (ping-pong) for a
   full revolution with zero mirroring; genuine 210-330° art would replace the
   return leg 1:1 (Ch.17 art gaps).
4. **Diverted spin**: one-shot to 180° then HOLD while the flee exit slides
   it away — the modulo cycle's 180→0 snap is gone.
5. **No mirrored markings**: the 08-28 left-turn mirror is REVERTED.  Resolver
   takes `dir`; left turns use dedicated `<prefix>_spin_007/012_left.png` art
   when it exists (builder auto-measures, loader auto-fetches) and the straight
   0° frame until then.  `flipX` is always false for marked vehicles.
6. **Helicopter**: fuselage REGISTRATION from measured solid-body boxes
   (alpha≥235 excludes rotor blur; frames were misaligned up to 7% of canvas)
   — constant fuselage height + center anchor; 3-frame rotor at ~11 fps (was
   18); facing hysteresis (±18 of ±60 sway) kills the center flicker; the
   whole-body red/blue TINT is replaced by two small belly glow lamps
   (fuselage keeps natural paint; colorblind amber/blue + 5★ tag kept).
7. **Loader states**: per-key `_polTex` states (loading/failed/gone) with
   3×-retry exponential backoff — the old `_polLoading` set marked keys
   forever on first attempt.  `_polWanted` ledger sweeps every ~2 s; no
   per-frame requests.
8. **Texture memory**: instrumentation first (`_policeTexStats`, logged per
   region queue + `window.__policeTexStats()`): ~121 MiB decoded if all 81
   jurisdiction frames load.  EVICTION DEFERRED deliberately — pooled sprites
   and live fx hold texture keys; a safe retention policy (current + previous
   + upcoming region) needs a reference sweep.  Documented in Ch.17.
9. **Art audit** (contact sheets + numbers): tire baselines are excellent
   (≤0.002 spread) but per-frame CAR SCALE varies up to ~40% within a set
   (7°/12° drawn small, 120° large — worst: Adams, Pullman, Seattle); the
   solid-height normalization corrects it at render.  `sy0` (first
   antenna-free body row) added to the meta so whip antennas can't distort
   the normalization.
Validation: both suites green repeatedly — validate_police.mjs (21 checks)
and NEW validate_police_v2.mjs (18 motion checks: scale-pop/baseline watch,
left/right steering, one-shot diverted hold, full-revolution PIT with 0.0%
drift, tunnel geometry, 3 simultaneous cruisers, boundary agency stability,
3-frame heli both facings, natural fuselage color, mobile viewport 844×390).
Harness lessons: probes must clear `_awaitingFirstGameTap` (frozen gameTime
freezes pose clocks), pin probe cops (position/hp getters), freeze autonomous
spawns, and tag+find probe entities — the wanted system otherwise pollutes
`cops[0]`.  All 9 unit suites green (police 678) + build clean.

### 2026-08-29 (pt 4) — Owner corrections: drag-scroll restored, restart keeps money only, tilt cue ½ mi

Three second-pass corrections on today's batch (each supersedes its earlier form):
- **Shops scroll on drag. Period.** (supersedes pt 2's scrollbar-only design):
  dragging anywhere in the list scrolls it again (`DRAG_SLOP` 10 px arms
  `_dragScrolling`); the scrollbar stays as an indicator that can also be
  dragged/track-tapped.  "No selection on drag" is enforced in MetalUI.dress:
  while `scene._dragScrolling` holds, rows under the moving finger show NO
  hover/press lift, and the buy handlers' TAP_MAX_DRIFT gate already blocks
  the release — a clean, motionless tap is the only thing that selects.
- **Restart keeps the MONEY; all purchases go back** (supersedes pt 3's
  full-verbatim snapshot): inventory/stats/position/upgrades reset to
  `runStartSnap`, but the wallet stays at its PRE-penalty value at the ending
  (pre-bail; `prePenaltyCash` re-added).  Removed purchases are NOT refunded —
  the run consumed that money.  Bail/half-cash still bite only CONTINUE.
  GameOverScene's walletStore rewind now writes the kept figure.  42 outcome
  tests green.
- **TILT TO STEER shows ≤ ½ mile**: 0.35 mi full + 0.15 mi fade (was 1 + 0.4);
  still pink + flashing; the other snow/wind cues keep the 1-mile arc.

### 2026-08-29 (pt 3) — Restart = run-start snapshot VERBATIM (supersedes pt 2's cash rule)

- Owner refinement: "a restart takes away upgrades on that run — a snapshot of
  the player's inventory, money and stats, taken at the start of every game,
  is the reset point if restart is chosen."  The registry `runStartSnap`
  (latched once per fresh run since 08-27: cash, position 0, HP, fuel, stars,
  vices, F12 weapons, coal, vehicle, upgrade/tempUpgrade/accessory maps) IS
  that snapshot — RESTART now restores it verbatim.  pt 2's "never at a cash
  loss" max() rule was REMOVED (`prePenaltyCash` plumbing deleted): mid-run
  earnings reset along with mid-run purchases, and the ending's bail/half-cash
  penalties still bite only CONTINUE.
- Leak sealed: `_endGame` banks the ending wallet into `walletStore` before
  the choice screen, so `_applyRestartOutcome` now rewinds the bank to the
  snapshot figure too — quitting to title mid-restarted-run can no longer
  resurrect the pre-restart wallet.
- outcomes tests rewritten to the reset-point semantics (41 total, all green).

### 2026-08-29 (pt 2) — Owner playtest batch: tutorial stars, shop scrollbar, restart cash, pass cue, snow bumps, wipers, HUD genre, tappable texts

Eight owner requests, all clarified via Q&A before building:
- **Tutorial genre stars** (index.html): during the tutorial's Music step every
  default ☆ pulses (`#phone-music.tut-star-wait` + `tutStarPulse`) until one is
  tapped, and the menu CANNOT be quit before then — ✕/CLOSE pop a "⭐ Tap a star
  to pick your genre first!" toast (`__tut.awaitingStar` gate; `tutGenreStarred`
  latched by `genrePicked`).  `closeMusicForGameplay` doesn't advance the tour,
  so it needed no guard.
- **Storefront scrolling** (RestStopScene): list dragging NO LONGER scrolls —
  it was ambiguous with selection.  A dedicated scrollbar (track + thumb,
  `_updateScrollbar`/`_sbGeom`) sits right of the storefront column / inside
  the sign menus' right edge; drag the thumb or tap the track to jump; wheel
  unchanged; bar presses eat the tap (`_eatenTapAt`) so a track-tap can't buy
  the row underneath.  Only shows when content overflows.
- **Restart = no cash loss** (endingOutcomes + GameScene): RESTART's penalty is
  starting the drive over, so its cash is now the BETTER of the drive-start
  snapshot and the PRE-penalty wallet at the ending (`prePenaltyCash`, stashed
  pre-bail in `_onArrested`).  The bail/half-cash penalties now bite only on
  CONTINUE.  +4 outcome tests (40 total).
- **Pass steering cue**: "📱 TILT TO STEER" is now PINK (#FF7AD9) and flashes
  (~1.2 Hz alpha pulse) while shown; the 1-mile show/fade lifecycle is kept.
- **Snow cop bumps**: rear rams/bumps multiply their lateral shove by up to
  2.2× with `_snowSteerRamp` — the car visibly slides on the pass; dry
  pavement untouched.
- **Wipers at 50% speed, visual-only** (GameScene cycleSec 0.5→1.0): every
  per-sweep effect in EffectsSystem doubled (WIPE_WEAR 0.2→0.4, streak build
  0.45→0.9, thinning factors squared) so clearing per SECOND is unchanged.
- **HUD genre delay** (AudioSystem): `_startTrack` now syncs `currentStation`
  to whichever station owns the starting track — custom playlists/shuffle
  used to leave the index (and the HUD label) a whole song behind.
- **Tappable "📱 New text — X" toast** (GameScene + index.html): tapping it
  opens the phone straight into that Messages thread even in landscape
  (`_popupTextCid` → `window.__openTextThread` → menu-locked + scene pause +
  `__openThread(cid)`); resuming takes the normal rotate-up-then-back-down
  cycle (`__textThreadForced` clears on the portrait leg).  Desktop uses the
  `__phoneMenu` bridge.  Only text toasts are tappable — every other popup
  clears the cid and keeps its input disabled.
All suites green (40/256/25/178/37/52/3/187/664) + build clean.  Not yet
playtested on device.

### 2026-08-29 — Website: missing images/music fixed (sync-assets was never run here)

- Owner report: images + music missing from the RTR website.  Root cause: the
  Genres page builds its car sprites, genre art and soundtrack previews from
  SITE-ROOT `assets/culture|music|genre_art|ui` — and `website/assets/` is
  GITIGNORED + DERIVED, populated only by `website/sync-assets.sh`.  That sync
  had never been run on this machine, so the 08-28 deploy shipped the site
  without ~360 files (music 323M, culture 120M, genre_art, ui) and every
  dynamically-built URL fell through to the 200-with-404-page fallback —
  which is also why simple status-code checks passed.  Detection that works:
  byte-compare `size_download` against the local file.
- Fixes: ran the sync; `scripts/deploy.sh` now runs `sync-assets.sh` FIRST on
  every deploy so this cannot recur; removed dead `cargo.png` from the sync
  list (CarGo cut 2026-07-28 — its missing art hard-stopped the whole sync
  under `set -e`, which may be exactly why it was never run).
- Redeployed + live-verified: all 138 Genres-page assets exist locally and a
  30-URL live sample matches local byte sizes exactly (music mp3s included).

### 2026-08-28 — Cop pose frames: height-normalized sizing + left-turn mirroring

Owner reports on the jurisdiction steering frames, both fixed in `resolvePoliceSprite`:
- **Size pop on angled frames**: sizing was pixel-content based (policeSpriteMeta bounds,
  not canvas) but normalized content WIDTH to a constant — wrong for yaw: a turning car
  keeps its HEIGHT and legitimately widens.  Width-normalizing shrank the whole car ~18%
  at 7° / ~28% at 12%.  Now each frame scales so its content HEIGHT matches its set's 000
  frame (`widthScale = cls × ch000 / (cw000 × ch)`, reduces to the old `cls/cw` at 0°);
  fallback chain carries a `ref` key per set.  Probe: widthScale×chFrac identical (1.1442)
  across 0/7/12°.
- **One-direction art**: the steering set is native RIGHT-turn only (confirmed by reading
  the sprite: nose recedes image-right), so left-drifting units read backwards.  The old
  "NEVER mirror" rule is now scoped: STEERING frames (7/12°) mirror for left turns —
  `_copSteerAngle` latches `ent._poseDir` from `_latV` sign as a pose engages (held while
  non-zero, so latV noise can't flip mid-gesture), `_resolveCopFrame` passes `flip`, and
  the lightbar lens anchors mirror with the frame (`lensAt` x flips; red/blue sides swap
  with the body, as a mirror would).  Spin/PIT ladders and 0°/180° still never mirror
  (big lettering).  Door/trunk decals at 7-12° are small enough to pass.

### 2026-08-27 (pt 13) — Player-car scale from source pixels; tail lamps lowered

Two sizing fixes, both from owner playtest reports. Committed inside `1a5c380` and the pt 11/12
batches.

**PLAYER CAR LOOKED SMALLER THAN NPC CARS.** Owner's report, with NPCs level with the player —
so depth was never involved. The cause was the sizing chain keying off CANVAS width:

    const f0 = bw / bSrc.width;        // bw = 78 (+/-2), bSrc = the CANVAS

The exports share no canvas or padding convention, and the 90-150° spin frames have wildly
different canvases from the rear view, so the car resized whenever the frame changed. The spin
ladder inherited `f0`, propagating the canvas dependence through every pose.

`PLAYER_CAR_SCALE` (0.088) is now ONE factor multiplying each frame's own **trimmed content**.
Canvas plays no part. Real differences between vehicles therefore survive — a genuinely wider car
has more content pixels and renders wider, a taller one taller.

| genre | was | now |
|---|---|---|
| hiphop_phonk | 64 px | **72 px** |
| edm_rave | 70 px | 79 px |
| metal | 71 px | 80 px |
| country | 73 px | 83 px |
| *NPC level with the player* | — | ~66 px |

Spin frames still match the BASE frame's content HEIGHT, so a turntable yaw keeps roof height
steady while visible width grows toward the side view — that was already right, it was just being
handed a canvas ratio.

⚠️ **Two things I got wrong first, recorded so they are not re-chased.** (1) The ~15% spread
between genres is NOT a defect — all ten already shared 80/1024, so those differences are the art
and are meant to survive. (2) I chased perspective/depth before re-reading the report; the owner
had already said the NPCs were level with the player.

**TAIL LAMPS SAT TOO HIGH.** Were `0.50` of car height above the tire line (`0.55` trucks/SUVs) —
dead mid-body, which reads as lamps floating on the glasshouse rather than seated in the rear
panel. Now `0.36` / `0.42`; real taillights sit around a third of body height.

The value existed as inline copies in **two** render passes (`_renderHeadlights` and the fog-night
placement). Both now call one `lampFrac()` helper — two copies of one tuning number is how they
end up disagreeing after someone adjusts one. Headlights untouched: separately tuned, not flagged.

These lamps are drawn for **traffic and cop cars only** (`_renderHeadlights` iterates traffic), so
they do not interact with the player's license-plate anchor at 0.51.

**Dev knobs** (`?dev=1` bar): `car −/+` → `window.__carScale`, `lamp −/+` → `window.__lampFrac`.
Both values above are calibrated, NOT eyeballed — bake whatever the owner lands on into
`PLAYER_CAR_SCALE` / `LAMP_FRAC.tail`.

⚠️ **Screenshots could not be viewed this session.** The API rejects images once several
oversized ones are in context — even a 760 px, 31 KB copy was refused, so resizing does not help;
a fresh session clears it. Uploads DO land on disk, so they were measured with Python instead
(`PIL` → cluster red pixels → lamp centres, separation, implied car width). That is how the lamp
positions above were derived. Useful fallback: **analyse the file, don't try to view it.**

### 2026-08-27 (pt 12) — Playtest fixes: pull-over hijack, translucent cops, angled approach

(Renumbered from a duplicate "pt 10" — a parallel session logged pt 10 (garage card) and
pt 11 (jurisdiction police) the same evening; this entry is the newest of the three and
also fixes the pt-11 art's angled-approach read.)

Owner playtest reports ("game resetting a lot", "cops translucent", "car slows to almost 0",
"cops come in at an angle"), all traced and fixed:
- **Pull-over hijack** (the resets + 0-mph reports): the 1-2★ hold fired off "speed < 8 mph
  with a tail within 30k" alone, so a cruiser spawning onto an already-slow car (store exit,
  post-crash, gridlock) pinned it to 0 for 8-15 s — and traffic could still hit the pinned
  car (deaths → respawns read as "resetting").  Fixes: `_pursuitStopArmed` — dwell only
  counts after the player has DRIVEN > 20 mph with the tail present (disarmed on hold start
  / eligibility loss); i-frames also block dwell; and `_checkCollisions` now skips entirely
  during `_pursuitStopHold`, same as `_trapStopHeld`.
- **Translucent cops**: pt-5's pack-formation `STATION_JITTER` (0-500 units) parked some
  cruisers at camera-rel ~1600 — inside `_rearCopForwardFade`'s 1500→1900 hand-off band —
  so they held station at ~25% alpha.  Jitter cut to 200 (worst station = the solid line).
- **Angled approach**: the jurisdiction steering ladder (parallel session, 3fd5098) read
  `_latV` during the whole chase; a CLOSING cruiser lane-tracks continuously, so it wore
  7/12° frames all the way in.  `_resolveCopFrame` now forces 0° while `kind==='rear' &&
  !_onStation && !lunging` and restarts the ladder on arrival — steering frames are for
  on-station work (lunges, PIT, shuffles).
- 90 s soak (2-3★, wipers, snow warp): 0 errors / 0 reloads / 0 restarts.  Probes: no
  hijack on slow spawn, 0° while closing, armed-then-slow still pulls over, station alpha
  solid.  NOTE for playtesting: localhost:3000 hard-reloads on every source save from any
  session — use `npx vite preview --port 4173` (static dist) for uninterrupted runs.

### 2026-08-27 (pt 11) — Jurisdiction police art: 9 agencies × 9 angles, SWAT/heli renders, measured lightbars

- **One data home:** `src/data/policeAgencies.js` — agency table (prefix, vehicle class,
  route regions in CHECKPOINT miles), weighted `agencyPoolAt(mile)` / `pickAgencyId`,
  and the single `resolvePoliceSprite({agencyId, angle, has})` resolver with the
  fallback chain *jurisdiction angle → jurisdiction 000 → generic angle → generic back*
  (a missing file can never lose a cruiser).  `src/data/policeSpriteMeta.js` is
  GENERATED by `scripts/buildPoliceSpriteMeta.mjs` (sharp alpha-scan): per-frame
  content bounds + lightbar lens boxes, including SEPARATE red/blue lens boxes
  (which side is red varies by department — Seattle blue-left, Pullman red-left).
  Snoqualmie/Adams run blacked-out bars: their anchors are remapped from a sibling
  Explorer set and flagged `dark:1` (off-phase draws nothing).
- **Boundaries (miles):** Seattle 0-10 · Bellevue 10-25 · Snoqualmie-North Bend 25-44 ·
  Kittitas Sheriff 52-103 + 117-132 · Ellensburg 103-117 · Adams Sheriff 132-235 ·
  Othello 178-197 · Pullman 272-293 · WSP whole route w1.3, boosted 38-55 + 235-272.
  Agency is stamped ONCE at spawn (`cop.agencyId`, CopSystem `_stampAgency` on all
  three spawn paths) — a chase never changes department mid-pursuit.
- **Angle selection:** rear pursuit runs the 000/007/012 steering ladder off a
  smoothed per-cop lateral velocity (`cop._latV`, set in CopSystem.update) with
  hysteresis + 160 ms hold (`_copSteerAngle`); `_pitArmed` forces ≥030 (sliding into
  position); oncoming/barricade = 180 front; coal/donut spin-outs cycle 0→180.
  GOTCHA: `getCopsForRender` returns per-frame COPIES — every persistent field
  (agencyId, pose state, spin clock) lives on the record's `ent` backref, never the
  record.  Frames ride place()'s existing spikeFrame contract ({key, widthScale,
  groundFrac}): CONTENT width is class-scaled (sedan 0.97 / suv 1.04 / swat 1.24 ×
  proj.sw) so canvas padding never resizes a car, and content-bottom seats the tires.
- **PIT/crash spin:** the PIT handler, ram-kill and side-swipe smash now call
  `_spawnCopSpinFx` — a wreck-fx entry (`copFrames`) stepping the agency's OWN
  frames at ~85 ms (PIT: 60→180; wrecks: 30→180), content-center origin, ZERO canvas
  rotation and NO mirroring (lettering must never read backwards; ladder stops at 180).
- **Lightbars:** the overlay loop reads the SAME resolved frame as the body pass and
  pulses the measured red/blue lens boxes in place (foreshortening comes free from
  the per-frame measurements); colorblind mode keeps amber/blue + white blink; the
  fog 'cop' bloom and the rear-view mirror bar also use the measured anchors.  The
  mirror shows the pursuer's own 180° front (content-aware sizing — placeSprite's
  raw canvas math would render padded frames at ~45%).
- **Loading:** `_ensurePoliceAssets` streams each region's 9 frames (~2.3 MB/set) for
  the current + next 12 mi, plus the generic/SWAT/heli extras once, via plain
  `Image()` + `textures.addImage` — NOT `this.load`: the scene LoaderPlugin sits in a
  stuck LOADING state after `scene.restart()` (verified headless; queued files never
  hit the network).  Never load `jurisdictions/sources/` (contact sheets — parked in
  `Archive/police_jurisdiction_sources_2026-08-27/` with the stray `*_back.png`
  concepts so they don't deploy).
- **SWAT/heli:** rendered SWAT set (back/turn/spin/090/front) supersedes
  `car_back_swat` (kept as fallback); helicopter uses `heli_police_rendered_1/2`
  (+ separately-rendered `_flip` files, never runtime-mirrored), display re-pinned
  172×68 after every setTexture; a `heli_police_rendered_3.png` (+_flip) joins the
  rotor cycle automatically if it ever lands in assets/cops/.
- **Validation:** `tests/police.test.mjs` (664 checks, in npm test) + headless
  `scripts/validate_police.mjs` (all 9 agencies in-region, steer ladder, PIT frames,
  SWAT, oncoming-front, heli both facings at stable size, pause; screenshots in
  tmp/police_validation/).  KNOWN ART ISSUE: `wsp_spin_180.png` wears a "NEVADA
  HP 725" license plate.  Speed-trap note: right-shoulder traps use the local
  090 profile; LEFT-shoulder traps keep the legacy generic nose-left art (mirroring
  the 090 would reverse the livery).

### 2026-08-27 (pt 10) — Garage current-car card replaces Used Sedan row; genre 4x4

- The phone Garage's top box was still rendering the `ownedVehicles` catalog rows — dead
  since the 2026-07-19 one-vehicle rework, so it only ever showed "Used Sedan · 25 HP ·
  75 mi · 100 mph · 2WD · gas".  Replaced with a single display-only card for the ACTIVE
  genre car: culture `starter_back.png`, trait `vehicleName`, accessory badges
  (🛡/⚡/❄️ — still keyed off the beater vehicleId), and a derived stat line
  **HP · range mi · top mph · drivetrain** (HP = 25 × `maxHpMult`, range = 75 ×
  `fuelRangeMult` ÷ `fuelBurnMult`, top speed = trait `topSpeedMph`).  Fuel type dropped
  from the line (owner).  The old `.row` tap-to-select handler went with the rows; ride
  swapping remains the MY RIDES `.g-ride` grid only.
- Genre traits gain a top-level `drive` field — `'4x4'` on **Mud Truck (country), War Van
  (metal), Custom Pickup (norteño)**, everything else defaults 2WD (owner pick).  Real
  gameplay, not display: GameScene's snow-relief gate now reads
  `_activeGenreTrait()?.drive` before falling back to `VEHICLES.drive`, so those three get
  the 0.60 4x4 `penReduction` (stacks with traction tires).
- Mud Truck's `hazardSteeringPenaltyMult` 0.50 REMOVED (owner: "the −50% penalty WAS the
  4x4") — the real drivetrain relief replaces it rather than stacking on top; its strengths
  line now reads "4x4 — holds its line in snow & wind".  Don't re-add the modifier.
- All tests pass.  Committed locally, not pushed.

### 2026-08-27 (pt 9) — Stock blades smear: streaks + residue in the blade path

- Owner clarified the blade-tier split: old wipers should "leave some rain and streaks in
  the shape of the blade path", not clear like new ones.  Both tiers keep the ⅕-per-wipe
  rule; STOCK (`wiperPower < 1`) now differs by RESIDUE, not speed:
  - **Smear survivors**: on a drop/flake's clearing (5th) pass, stock rubber leaves it on
    the glass with probability `(1−wp)×0.55` — knocked back to wear 0.55, dimmed — so the
    arc stays visibly filmy; fresh rubber squeegees it gone.
  - **Streak marks**: `_wiperStreak` builds `+0.45×(1−wp)` per stock sweep, decays 0.05/s
    (rain rinses them off ~20 s); rendered as 5 concentric arc strokes per pivot tracing
    the swept sector (radii 0.30–0.90 × blade length, angles −95°…−5°, stable per-zone
    jitter).  Drawn AFTER the rain/snow/fog else-chain — regression caught mid-edit: the
    first placement broke the chain so the snow-melt `else` ran during rain; the chain's
    final else must stay intact.
  - GameScene now passes `ctx.wiperZones` even with the wipers OFF, so streak residue
    persists on the glass after the motor stops.
  This resolves the pt-7 open flag — the New Wiper Blades upgrade matters again (clean
  sweep vs smear), no change to wipe-count.  Probe: stock after sweeps → streak 1.0, arc
  217 drops (3 mid-smear); upgraded → streak 0, arc 145, no marks.  Screenshots
  tmp/wiper_stock_smear.png / tmp/wiper_upgraded_clean.png.

### 2026-08-27 (pt 8) — Device-wide windshield weather + Finesse SERVICES tab

- **Weather fills every device's borders** (owner): the canvas widens to WORLD_W on wide
  phones (main camera scrolled −HUD_OFFSET_X), but rain/snow only covered the 800 design
  band, leaving dry side margins. EffectsSystem now derives `wxLeft/wxRight/wxW` from
  `SCREEN_W + 2×HUD_OFFSET_X` (live binding) and spawns windshield drops, big runners,
  stuck snowflakes, falling streaks AND falling flakes across the whole widened canvas;
  all particle targets/counts scale by `wxScale = wxW / SCREEN_W` so density stays
  constant per screen area (drop cap 380→380×scale, snow flake target likewise).
  Verified at aspect 2.66 (canvas 1197): drops span −217…1018, flakes −198…1028.
- **Finesse SERVICES tab** (owner picked option A): `SHOP_CATEGORIES.fap` now leads with a
  synthetic `'services'` category — NOT in `GARAGE_CATEGORIES` (the toolbar strip has no
  8th frame), so RestStopScene code-draws the tab (`tab_services_gen` render-texture:
  dark plate, steel-blue frame, 🔧 + SERVICES label) and unshifts it leftmost.
  `_selectGarageCategory` gains per-shop semantics: at a shop stocking 'services', rows
  with `category == null` (repair / paint / coolant, bumper, body/police slots) file
  under SERVICES instead of pinning above every parts tab; Les Schwasted keeps the old
  pinned behavior (popcorn/water/chains). FAP opens on SERVICES by default (stocked[0]).
  Probe-verified: services shows exactly repair/paint/coolant/armor/up_body_1/up_police_1;
  ENGINE shows only nos_1-3 + up_engine_1-3.
- Probe gotcha for future sessions: never stub `Math.random` to a CONSTANT around scene
  creation (it broke RestStop create mid-way with misleading downstream nulls) — stub the
  specific gate instead (`rs._maybeShowEncounter = noop` on the scene instance BEFORE
  `scene.start`, instances are reused).

### 2026-08-27 (pt 7) — Wiper-path-only clearing, Easy need-based pickups, fatigue snowball

- **Path-only wiping** (owner): running the wipers no longer suppresses/clears rain or snow
  across the whole screen. GameScene passes `ctx.wiperZones` (the two blades' swept sectors:
  pivots at (125, SCREEN_H+6) chase / (125|410, 392) cockpit, radius = blade length, atan2
  angles −100°…0° — derived from the +90°→−10° rotation sweep) into `EffectsSystem.update`.
  A sweep pulse wears ONLY particles inside those sectors: `wipe += 0.2` per pass (⅕ per
  wipe → **5 wipes clear built-up glass**), shrinking r/alpha each pass, removal at wear 1.
  Rain drizzle/runner spawn rates lost their wiper-on `wOn()` suppression and snow coverage
  is no longer knocked back globally — **buildup continues outside the wiper path**.
  Wipers drawn **10% bigger** (chase arm 405→446, cockpit displayH 340→374). NOTE: the
  ⅕-per-wipe rate is flat per the owner spec — `wiperPower` (New Wiper Blades upgrade) no
  longer changes clearing; flagged to owner for a call on re-differentiating stock blades.
- **Easy need-based pickup bias** (owner): on Easy, `_assignPendingViceTypes` reweights by
  live survival bars — Drinks < 25% → water+slushie ×1.3; Food > 75% → burrito/sushi/gummies
  ×0.7; Alertness < 20% → cold brew ×1.3. Verified statistically headless (4000-draw samples:
  water+slushie share 39%→45%, food 46%→36%, coldbrew 7.7%→10.6%).
- **Fatigue snowball** (owner "alertness degrades quicker the closer to 0"): SurvivalSystem
  tiredness drift gains `× (1 + (tiredness/100)²)` — ×1 fresh, ramping quadratically to ×2
  at the edge of sleep. All difficulties (pure survival-model change).

### 2026-08-27 (pt 6) — Pursuit redesign: mirror glow, +10 mph cap, 1-2★ comply-or-escalate

- **Mirror pursuit glow** replaces the "◀ PURSUIT — N ft behind" HUD text: unseen pursuit now
  strobes red/blue in the rear-view glass (`hudMirrorLights`, masked to the mirror), a full-glass
  wash + a hot core low in the glass, both growing with proximity (`MIRROR_GLOW_RANGE` 45000,
  synced to `cops.lightFlash`). The text readout survives ONLY in colorblind mode.
- **+10 mph closing cap** (CopSystem): a rear-chase cruiser's speed is now
  `min(COP_TOP_UNITS, laggedPlayerSpeed + MAX_SPEED×(10/120))` — it closes at most 10 mph faster
  than the player and the APPROACH_BAND easing bleeds that surplus off near station, so it
  visibly slows as it arrives, then follows. Supersedes the 2026-07-31 "cruiser runs at cruiser
  pace" rule (comment documents this).
- **1-2★ comply-or-escalate ladder** (GameScene block after the trap sign): at 1-2★ with a rear
  pursuer within 30k units, a blue PULL OVER blink invites compliance. Holding < 8 mph for 0.8 s
  = pulling over → `_pursuitStopHold`: car pinned, trap-stop light show, "PULLED OVER Ns" sign.
  1★ = normal ticket + 8 s wait; 2★ = **triple** ticket + 15 s wait (`_resolvePursuitStop`,
  same $300-cap formula as trap tickets ×mult, no warning roll, then `clearArrest()` slate-wipe).
  Ignore the tail and stars escalate by DISTANCE followed: 2 mi at 1★ / 5 mi at 2★ → +1★
  ("FAILING TO YIELD" popup). 1★ never rams (existing RAM_MIN_STARS=2); a 2★ tail now rams every
  ~15 s while following (tier-2 lunge cadence: FIRST_HOLD/GAP_MIN 15.0 s).
- Validation: chase.test 52/52 (new cadence + reaction-lag ranges), 21/21 headless probe checks
  (glow drawn + text hidden, 8 s/15 s holds, ×1/×3 fines exact, slate wipes, 2-mi escalation),
  full suite + build green.

### 2026-08-27 (pt 5) — Five pursuit/traffic-QoL fixes (owner batch)

- **Complying at a traffic stop wipes the slate**: after the held stop resolves (ticket or
  warning), `cops.clearArrest()` runs — all stars gone, pursuers despawned, counters zeroed.
  Runs AFTER the ticket so the warning-chance roll still reads the real wanted level.
- **Redneck Rage bulldozes police roadblocks**: both the route `cop_roadblock` hazard and 5★
  `barricade` cruisers now explode-and-pass-through during rage — no damage, no flat tire, no
  slow, no star (mirrors the existing rage rule for traffic/cop collisions).
- **Roadblocks spawn in random lanes**: RouteData's `cop_roadblock` offset now snaps to the
  four lane centres (was ±0.12 — effectively always mid-road).
- **3 s of i-frames on freeway re-entry from a rest stop** (owner: "my car is mid-accident the
  moment I return to the road") — set in the `_resumeFromStop` create branch, shown by the
  existing i-frame blink.
- **Pursuit reaction re-tuned to a "pack" model** (owner: cops read as a hive mind): per-
  PURSUIT base lag 1.4-2.2 s + per-UNIT jitter ±0.25 s (floor 0.8) replaces the flat 1.5-4 s
  roll — every cruiser clearly trails the player's inputs while units differ from each other
  by fractions of a second.  Each cruiser also holds its OWN station gap (TAILGATE_GAP + up to
  500 units, `STATION_JITTER`), so a pack on station sits in a loose staggered line instead of
  one rigid clamp plane mirroring every player speed change in lockstep.  chase.test updated
  (52 asserts) + headless probes for all five behaviors.

### 2026-08-27 (pt 4) — Mile-0 restarts, continue-regression fix, ITEMS COLLECTED, Easy-bust cinematic

Four owner items in one pass:

- **RESTART DRIVE always returns to mile 0** (owner directive).  The snapshot is now
  RUN-level: latched once per fresh run, banked in the registry (`runStartSnap`), and REUSED by
  every resumed drive — so any number of continues later, restart still rewinds to the run's
  true start.  It now also snapshots the save's `upgrades`/`tempUpgrades`/`accessories` maps +
  vehicleId and restores them on restart, so a mid-run part purchase can't survive while its
  cost is refunded.  The accounting block ("CASH BEFORE DRIVE") reads from the same snapshot,
  so it always equals the RESTART button.  Applies to the ending screens AND the out-of-gas
  card's START OVER.
- **BUG: continue could offer a checkpoint BEHIND the last resume point** (owner repro:
  resumed at 4.00 mi, next crash's Continue said 2.00 mi at 13 HP for half the cash).  The
  pt-3 checkpoint re-derivation snapped to the nominal town boundary; it now pins
  `_lastCheckpoint.position` to the RESUME POSITION itself (banked ground), keeping the
  nearest town's name for display.
- **VICE LOG → ITEMS COLLECTED** (owner request): button renamed, modal retitled, and two new
  count sections above the food grid — WEAPONS (💨/🎆/🍩 with ×N from a new per-drive
  `_runItemCounts` tally in `_onCollect`) and SPECIAL (🤠 Redneck Rage / ☕ Quad Shot), '—'
  when empty.  Food & Drink keeps the existing unlocked-vice grid (peaks, pickup counts,
  unlock hints, discovery teaser).
- **Easy-mode bust no longer teleports with no explanation** (owner report: cops beat you
  below 0 HP → instant respawn, no cut screen).  Easy busts now play the same BUSTED takedown
  cinematic; the finalizer then RESTARTS the scene at the checkpoint reproducing the old
  release exactly (docked bail, full repair, stars cleared, vices/fuel/weapons preserved)
  plus a "🚔 BUSTED — released at X · −$Y bail" arrival banner.  The run still never ends.
- Harness (`scripts/validate_endings.mjs`) grew scenarios: mile-0 restart, upgrade-purchase
  revert, continue-never-regresses, items-modal counts (container-aware text probe), and the
  Easy-bust cinematic-respawn flow.  All green + full tests + build.

### 2026-08-27 (pt 3) — Ending screens: RESTART/CONTINUE outcome buttons + drive accounting

The failure endings (CRASHED / BUSTED / PASSED OUT) now let the player compare both choices
without leaving the screen, and RESTART gained real rewind semantics:

- **One source of truth** — `src/data/endingOutcomes.js` (pure, tested):
  `computeEndingOutcomes()` builds `restart` / `cont` objects in `_endGame`; the buttons render
  FROM them and the handlers apply THE SAME objects (`_applyRestartOutcome` /
  `_applyContinueOutcome`), so the previewed cash/mileage/HP can never diverge from the applied
  state.  `checkpointRestartScore` carries the already-computed post-choice cash verbatim, so
  the engine's crash-halving can't double-apply.
- **RESTART DRIVE = restore the drive-start snapshot.**  `_driveStartSnap` latches on the first
  post-title frame (same spot as `_runStartWallet`): cash, position, checkpoint name, HP, fuel,
  wanted stars, vice levels, weapon stash (f12Tokens + coalAmmo).  Applying it routes through
  the existing checkpoint-respawn branch plus a new `restartSnapExtras` payload.  Repeated
  restarts re-latch identical values — no duplication, no stacking losses.  (Previously RESTART
  was a fresh run that silently KEPT the failed drive's losses.)
- **CONTINUE = existing rules, now printed:** busted keeps post-bail cash; wreck/pass-out
  checkpoint retries keep the shipped half-cash rule, now surfaced as
  "Includes $X recovery · HP 13" instead of being silent.  Respawn HP (50% of base) shown.
  No checkpoint → greyed "NO CHECKPOINT AVAILABLE", not clickable.
- **Buttons** are three-line (title / prominent cash / place · mi, small note), pink/blue
  identity kept, MENU stays secondary.  **Accounting block** replaces the single CASH line on
  failures: CASH BEFORE DRIVE / LOST(red) or EARNED(green) THIS DRIVE / CASH REMAINING(yellow)
  + DISTANCE.  Long names truncate with …; money always comma-formatted.
- **Fix folded in:** the `resumeFromPosition` create-branch never re-derived checkpoint/rest-
  stop progress, so after any mid-route continue the NEXT ending offered Seattle.  It now
  mirrors the live-resume derivation (`_passedCheckpoints`/`_passedRestStops`/`_lastCheckpoint`
  from the resume position, `scoreAtCP = score`).
- **OUT OF GAS card**: TOW and START OVER buttons carry outcome sub-lines
  ("→ $2,514 · the last stop"), and START OVER now restores the drive-start snapshot too.
- Tests: `tests/outcomes.test.mjs` (36 asserts, wired into npm test).  Harness:
  `scripts/validate_endings.mjs` — real runs through crash/busted/OOG at easy/normal/hard,
  repeat-restart/continue integrity, no-checkpoint, applied-equals-previewed probes, and
  desktop + mobile screenshots into tmp/ending_validation/ (all reviewed).  The ending-
  cinematic flows run inside it, replacing the lost scratchpad regression harness.

### 2026-08-27 (pt 2) — Steering mirror fix: the angle set is uniformly NOSE-RIGHT

Owner report: "pressing right shows the car image that should display when turning left."
Root cause was in yesterday's `nat` metadata, not the input code: the claim that the 7°/12°
frames rotate nose-LEFT rested on backwards flank geometry — a car yawing away from you
exposes the flank on the side it's turning TOWARD's opposite... concretely, a car veering
LEFT ahead of you shows its LEFT side, so art showing the RIGHT flank is a NOSE-RIGHT pose.
Verified empirically (ArrowRight → `_steerIntent +1`, `p.x` increases): the whole export set
— 7°/12°, all spins, legacy `back_turn` — is uniformly nose-right.  All POSE_LADDER `nat`
entries are now `1` (the per-frame mechanism stays for future re-exports), so RIGHT steering
shows the native frames and LEFT the mirrors; this also un-mirrors the automated exit turn
(it was rendering every frame flipped) and corrects the pose-aware plate's tail-side pick at
7-12°.  NOTE: the old shipped `back_turn` comment ("art depicts turning toward SCREEN-LEFT")
made the same geometry error — legacy steering art had been mirror-inverted all along, just
too subtle to notice at the old single-frame 7-ish°.  `scripts/validate_pose.mjs`
expectations updated (LEFT = mirrored, RIGHT = native); full suite green.

### 2026-08-27 — Vehicle visual-orientation controller: full 9-frame angle sets everywhere

The complete per-genre angle sets (0°/7°/12°/30°/60°/90°/120°/150°/180° —
`starter_back`, `starter_back_turn_007/_012`, `starter_spin_030…150`, `starter_front`) now
drive EVERY player-car pose through ONE controller in GameScene:

- **`POSE_LADDER` + `_applyPoseFrame(angleDeg, dir)`** — gameplay systems request a visual
  angle + direction; the controller picks the nearest LOADED frame (one dev warning per
  missing frame, legacy `back_turn` stands in near 7-12°, never another genre's car), mirrors
  at render time (no duplicate art), folds angles past 180° back down the mirrored ladder so a
  continuous 0→360 value plays a full revolution, sizes by trimmed car content, and re-pins
  the tire-contact ground anchor.  dir −1 = nose screen-left, +1 = nose screen-right.
- **⚠️ MIXED SOURCE CONVENTIONS (measured from the shipped art, full-size review):** the
  7°/12° steering exports rotate nose-LEFT natively, the 30-150° spin exports nose-RIGHT.
  Per-frame `nat` metadata in POSE_LADDER lets the controller mirror per-frame so a spin never
  visibly flips direction at the 12°→30° seam.  If art is re-exported to one convention,
  update `nat`.
- **Normal steering** (`_updateSteerPose`): 0↔7↔12° tier ladder (STEER_POSE constants) off the
  wheel-load accumulator, with hysteresis and a slewed continuous angle so engage/release
  always pass THROUGH the 7° frame (12→7→0, no snap).  Tap ≈ 7°, sustained hold ≈ 12°.  The
  ladder reads load IN the latched direction, so a reversal unwinds through centre and
  re-engages mirrored (|load| alone couldn't tell a reversal from a hold).
- **Gameplay PIT spin** rewritten as a continuous out-and-back rotation (~140-160° peak);
  **BUSTED/CRASH cinematic poses** route through the controller (busted can settle on the
  front view; a fatal vehicle hit ≥60 % top speed carries a full extra 360°); **exit turns**
  (`_applyExitPose`) map the ExitPath heading straight onto the ladder (7→90° as it departs) —
  replacing the old wished-for `_turn_r`/`_profile_r` keys that never existed.
- **Robust art measurement**: `_texContentBox` now takes the LARGEST CONNECTED mass (edge
  matte bars + detached neighbouring-frame slivers in some exports would stretch the box —
  e.g. classic_rock 120° carries a second partial car at its left edge);
  `_groundAnchorFor` constrains its tire scan to that box and falls back to content-bottom
  (not canvas-bottom) when only one contact blob is found.  Caches rebuilt per create AND
  after a live genre-art swap.
- **Pose-aware license plate** (owner: "can it change angles with the vehicle?"):
  `_updateRearPlate` follows the mounted face through the ladder — slides toward the tail and
  foreshortens (cos θ) as the car yaws, disappears edge-on at 90°, and reappears on the NOSE
  (bumper height) for 120-180° — WA issues front plates.  True 3-D skew isn't possible on
  Phaser Images; at ~23 px the slide+squash reads as attached.
- New manifest/GENRE_ART keys `codex_beater_back_turn_007/_012`; ALL `codex_beater_*` art
  URLs bumped to `v=angleset-1` (whole set re-exported in place).
- **Validation harness kept**: `scripts/validate_pose.mjs` (dev server on :3000 → per-genre
  angle sweeps w/ size/anchor/mirroring checks + live-input steering ladder + PIT directions;
  screenshots to tmp/pose_validation/).  Headless-testing gotchas discovered: the first-run
  HUD tour AND contextual tour tips PAUSE gameplay (stub `_startHudTour`/`_showTourTip`), and
  a leftover live-run autosave turns START into the resume prompt (`_clearLiveRun()` first).
  npm test + build green; norteno/classic_rock/metal validated visually.

### 2026-08-26 (pt 3) — Stranded-GameOver fix, "THIS DRIVE" earnings line, spin-frame sizing

Three fixes from the owner's first live session with the ending cinematics:

- **Stranded "CRASHED" screen (black + headline, no buttons).**  Repro: any SECOND same-cause
  ending in one browser session.  The plate + genre car are then already in the texture cache,
  so `loadEndingArt` calls back SYNCHRONOUSLY — while `GameOverScene.create()` is still running
  and the scene status is CREATING — and `_createPlateEnding`'s `!this.scene.isActive()` guard
  (meant for "player already moved on") false-positived, bailed before drawing the UI, and
  consumed the loader watchdog with it.  Guard now bails only on status ≥ `Phaser.Scenes.SHUTDOWN`.
  Pre-existing bug; the cinematics just made endings frequent enough to hit it.
- **Ending screens show the run's net earnings** (owner request): `GameScene` latches
  `_runStartWallet` on the first post-title frame (after every resume path has written its
  starting score), `_endGame` passes `runEarned = finalScore − start`, and `_buildPlateUI`
  renders "+$X THIS DRIVE" (green) / "−$X" (red) between CASH and DISTANCE on every plate
  ending.  Net of fines/bail/crash penalty, so a losing run reads negative.
- **Car shrank on the 90° spin frame** (owner report).  The spin-frame canvases share NO
  convention (classic_rock: 861×863 at 30/60°, 391×793 at 90/120/150°, different again per
  genre) and `_applyPlayerSpriteDisplaySize` pinned the CANVAS to 78 px — the same bug class
  the turn-art special case documents.  New `_texContentBox` (runtime alpha scan, cached per
  create, scan INSET ~1% from canvas edges because the 90°+ exports carry fully-opaque 2-3 px
  matte bars top/bottom that defeat any trim) sizes every spin frame so the trimmed CAR matches
  the straight art's content height, and moves the sprite origin to the content's bottom-centre
  (flip-aware) so the ground anchor survives arbitrary padding.  Fixes the gameplay PIT spin
  too.  The rear plate now hides during spin poses (its anchor fractions assume the straight
  rear framing).  NOTE for the art pass: the 90/120/150 exports are also horizontally
  edge-clipped (nose/tail touch the canvas) and carry those matte bars — worth re-exporting.

### 2026-08-26 (pt 2) — Fatal CRASH cinematic + shared ending-cinematic controller

The zero-HP counterpart to the BUSTED cinematic, and a refactor that merges both into ONE
controller (spec requirement: extend, don't build a competing system).  `this._bustedCine`
became **`this._endingCine`** with a `kind` field; shared across both endings: start guards,
gameplay lockout (the single `update()` early-return), HUD hide, overlay/blackout objects,
skip input (`_ecTrySkip`, per-kind guard windows in `ec.T`, SFX handles in `ec.stopOnSkip`
fade on skip), the aftershock train, dip-to-black, **`_finalizeEndingCinematic`** (one
`_endGame(ec.cause, ec.extra)`, guarded by `ec.finalized`) and idempotent
**`_endingCineCleanup`** (finalizer + scene-shutdown hook).  Per-kind: choreography
(`_ecUpdateBusted` / `_ecUpdateCrash`), pose (`_bcApplyPlayerPose` / `_ccApplyPlayerPose`,
sharing `_ecSpinFrameKey`), timing tables (BC / CC constants).

**CRASH sequence (~2.25 s; CC constants + CC_VARIANTS table):** the damage `wreck` handler's
non-cop branch now calls `_startCrashCinematic({}, {source})` instead of `_endGame('crash')`.
Impact (0–0.15 s): `sfx_crash_fatal_impact`, the game's heaviest shake + directional kick from
the shove side, haptic, 70 ms white flash, +5% car "punch toward camera", oversized
explosion/smoke at the impact point, glass-and-debris burst (`_ccSpawnDebris`, tweened rects —
no gore).  Violent motion (→0.85 s): `sfx_crash_glass` + `sfx_crash_scrape` (contact
variants), variant-shaped yaw via the spin frames, lateral shove w/ barrier rebound, speed
collapse, skid marks, struck NPC keeps its crash spin briefly.  Daze (0.45→): `sfx_crash_ring`,
desaturating wash + 3-band edge vignette (never a white screen).  Aftermath (1.30→):
`sfx_crash_aftermath`, ring fades, edges darken before the 1.95 s dip to black → the unchanged
photographic CRASHED plate.  Variants (choreography-only, one system): headOn (recoil+yaw),
vehicle (spin), scenery (abrupt stop + rebound + scrape), guardrail (long slide + scrape),
**water** (structural exception: sink anim already played, so the car stays hidden underwater
and it's a short muffled hold, `CC.WATER_FADE_AT`).

**Crash context:** collision sites stash `this._lastImpactCtx = {at, side, sx, sy, sw, type}`
(NPC handler + `_triggerSceneryRespawn`); `_classifyCrash` trusts it only if written the same
frame (`at` freshness ≤ 0.25 s) and otherwise falls back to the wreck `source` tag + safe
defaults, so older/attrition call sites still produce a valid crash.  Post-fatal guards
(`if (this._endingCine) return`) stop the head-on/scenery/water recovery snaps from
teleporting the wreck after the cinematic latched.  Cop-delivered killing blows still route
to BUSTED; survivable collisions, busted_late, pass-out, finish, out-of-gas all untouched.

Verified headless (playwright): BUSTED regression, fatal head-on after survivable hits,
scenery crash + skip across consecutive runs, cop killing blow → BUSTED, blocked
`crash_fatal_impact.wav`, `prefers-reduced-motion`, water dunk — `_endGame` exactly once in
every path, zero SFX voices after scene exit.  `npm test` + `vite build` green.

### 2026-08-26 — BUSTED arrest cinematic (in-engine PIT → spinout → 5-cruiser containment → stamp)

A run-ending arrest no longer cuts straight to the ending screen.  `_onArrested`'s non-Easy path
now routes through **`_startBustedCinematic(extra)`** — a ~4.8 s in-world sequence on one clock
(`this._bustedCine.t`, phase bands in the `BC` constants near the top of GameScene):

1. **PIT (0–0.30 s)** — the nearest live pursuit cruiser (or one staged below the projection
   floor, fading in via `_rearCopForwardFade`) lunges into the rear quarter: `sfx_busted_pit`,
   looping `sfx_busted_sirens`, heavy shake + directional camera kick, `HapticSystem.crash()`
   (new, strongest one-shot), 70 ms white flash, sparks/smoke.
2. **Spinout (→1.55 s)** — the genre's own `codex_beater_spin_030…150` frames eased to a
   150–175° rest, speed decays to 0, lateral sprite slide, tire smoke + fading screen-space skid
   streaks (`sfx_busted_spinout`).
3. **Convergence (1.35–3.15 s)** — the PIT car brakes back into the REAR blocker slot; front
   blocker + fifth diagonal arrive nose-on from far ahead (kind `barricade`), driver/passenger
   side cars climb from the fade band.  Staggered arrivals, per-car `sfx_busted_brake` with
   pitch/volume variation + stereo pan from the projection, settle tremors.  Cinematic cruisers
   are plain records in `cops.cops` tagged `_cine` so the EXISTING render pipeline (bodies, light
   bars, near-field seat synth) draws them — CopSystem.update/collisions never run (the whole
   gameplay loop is parked behind the `_bustedCine` early-return in `update()`).
4. **Containment (3.0–4.05 s)** — `sfx_busted_rumble` + `sfx_busted_radio`, sirens ducked for
   contrast, restrained 2 Hz red/blue full-scene wash riding the same light-bar clock.
5. **Stamp (4.05 s)** — sirens cut, `sfx_busted_stamp`, UI-camera `BUSTED` in the ending-screen
   blue (#35A7FF) slammed 1.35→1.0 with a white edge ghost, second haptic hit; ~0.45 s hold,
   0.28 s dip to black, then **`_endGame('busted', originalExtra)` exactly once** (bail was
   already docked in `_onArrested`; `bc.finalized` guards the deferral).

**Skip**: any fresh key press / tap after a 0.55 s post-impact guard (`ev.repeat` rejected) jumps
the same clock to a 0.6 s tableau before the stamp — skip and natural completion share the one
finalizer.  **Cleanup**: `_bustedCineCleanup()` is idempotent, runs from the finalizer AND a
scene-shutdown hook — stops every SFX voice, removes listeners, splices `_cine` cops.
**Reduced motion** (`prefers-reduced-motion`): softer shakes/kick, no light wash, no stamp tilt.

**Audio plumbing (AudioSystem)**: new fail-soft SFX bus — `loadSfx()` (fetch, `encodeURI` for the
`sound Effects` folder space) → `decodeAudioData` → `playSfx(key, {volume, rate, pan, loop})` on a
**dedicated gain wired straight to the destination**, so `setPaused`/`setMusicPaused` (which zero
`_master`) duck the radio without muting the cinematic; full mute still silences everything via
ctx suspend.  `stopAllSfx()` on teardown.  Missing/blocked WAVs log one warning and the sequence
plays silently — the BUSTED screen can never be lost to audio.

`busted_late` (TOO LATE + 5★ technical loss) untouched — still the checkpoint-slider modal.
Easy-mode busts untouched (respawn, no cinematic).  Verified headless (playwright): full run,
skip, two arrests across restarts, retry navigation, blocked-audio run — `_endGame` once each,
no sirens or `_cine` cops surviving the scene.  Known compromises: skid marks are cinematic-local
screen-space streaks (no persistent decal system exists); no spotlight/headlight aim at the
player (renderer has no forward cop-beam support); rear blocker reads "under" the player per the
pseudo-3D near-field convention rather than literally behind.

### 2026-08-22 — Pursuit AI reverted; genre research; dispatch pacing; bump/PIT tiers

**THE REVERT.** The independent-pursuit refactor (2026-08-13 pt 2) is gone. Owner's verdict after
playtest: *"their behavior now is baaaaad. They stack on top of eachother, they die in what appears
to be one hit, they can't keep up with the player car."*

`CopSystem.js` and `tests/chase.test.mjs` restored to `24f9bf0`; `src/cops/CopProfiles.js`,
`CopDriver.js`, `PursuitDirector.js` and `tests/pursuit.test.mjs` deleted; the collision-intent
branch removed from `GameScene._onCopCollision`. Back in force: the `TAILGATE_GAP` clamp, the
`FORM` formation offsets, `reactSpd + closing`, `SPEED_CAP_BY_STAR`.

**KEPT on top of the old code** (owner-requested, independent of the driving AI):
one pursuer per star (`cap = _starLevel`), and SWAT gated to 5★.

**WHY IT FAILED — read this before ever attempting it again.** Research across the genre
(NFS Most Wanted / Heat / Unbound, GTA V, Driver) found that these games **rubber-band cop speed to
the player deliberately**. The documented failure mode is not rubber-banding itself — it is
rubber-banding *as the only adaptive tool*: "opponents ought to have a variety of ways to adapt."
The prescribed fix is **more tactics, not more simulation**. The refactor removed the speed coupling
and added per-cop physics — the wrong axis, and precisely why cops could not keep up. If cop variety
is ever wanted again, the lever is corridor tactics (spike strips, rolling roadblocks, boxing in),
NOT per-cop acceleration curves.

**Genre reference table** (escalation is expressed as CAPABILITY, not just count):

| ★ | NFS | GTA V |
|---|---|---|
| 1 | patrol, chase only, out-runnable | patrol, arrest on sight |
| 2 | roadblocks | backup, aggressive driving |
| 3 | faster interceptors / light SUVs | roadblocks, spike strips, helicopter |
| 4 | heavy SUVs, spike strips, helicopter | NOOSE, 2nd helicopter |
| 5 | federal / SWAT, all tactics | all units ram relentlessly |

NFS Heat draws the sharpest line: at heat 1-3 units are *"not authorised to use direct intervention
or intentional force"* — deliberate contact is a 4★ capability. GTA V escape cooldowns scale
30/45/60/75/90 s by star. NFS Heat holds reinforcements **60 s** after dispatch.

**DISPATCH PACING (fixes the "stacking" complaint at its root).** The old cooldown was
`max(0.8, (5.5 - stars*0.9) / mults)` — ~1 s at 5★, 2.8 s at 3★. With one pursuer per star that
dumped the whole roster on you in seconds, arriving as a clump. Now `REINFORCE_SEC_BY_STAR =
[0, 14, 13, 11, 9, 7]`, divided by the difficulty/night multiplier as before. Measured dispatch:

    2★  0.0s, 18.6s
    3★  0.0s, 15.7s, 31.4s
    5★  0.0s, 10.0s, 20.0s, 30.0s, 40.0s

The first responder is still immediate — not by a special case, but because `_spawnCooldown` has
already expired when a star is freshly gained. ⚠️ My first cut DID special-case it, keyed off the
pursuer count taken BEFORE the spawn, so cop #2 still arrived 2.1 s behind cop #1. Whoever comes
next is by definition a reinforcement.

⚠️ `copEscalationMul()` defaults to **0.7**, so it *stretches* these waits ~43% rather than
shortening them. The table is tuned against that divisor.

**BUMP vs PIT TIERS** (owner: *"who cares about pressure? I want another level of difficulty for
each star"*):

| | 2★ | 3★+ |
|---|---|---|
| rear contact | **1-2 HP** light bump, small shove, light shake | 1-2.8 HP full ram |
| PIT | not available | **3-5 HP** |

`MIN_STARS_PIT` 2 → 3. The chase test asserting PIT arms at 2★ was updated to check 1★/2★ never arm
and 3★ does — keep it in step with the constant.

**PIT SPIN.** A landed PIT plays the genre's own spin frames so the maneuver reads as YOUR car being
put sideways rather than a damage number. `codex_beater_spin_030…_150` registered per genre; all 10
genres have all 5 frames. Purely cosmetic — damage, arrest counters and physics come from the
collision path that triggers it, so a missing frame costs the look and nothing else.

> **Note (2026-08-27):** a later session folded `_updatePitSpin` into its `POSE_LADDER` visual-
> orientation controller (0/7/12/30/60/90/120/150/180° with per-frame mirroring). The PIT spin is now
> one of several posers feeding that pipeline rather than a standalone system — see the 08-27 entry.

**Still open:** cops "die in one hit". NOT caused by the refactor — `git diff` across the whole
police work shows no `hp` changes. Cop HP is `swat ? 20 : 10`, chipped 1 per ram, but the SAME pool
is chipped by NPC traffic crashes (`_updateVehicleCrashes`), so a cruiser that has been smashing
through traffic arrives nearly dead and pops on first contact. Predates all of this.

### 2026-08-17 — Deploy script was re-syncing 1.3 GB to iCloud; nosync symlinks restored (`ad29087`)
Owner asked whether the disposable build copies need saving (`dist/`, `website/demo|fully/`).
Answer: NO — all gitignored, regenerated wholesale by `npm run deploy`; the only protected things
are `src/`, `index.html`, `public/assets/`, and this file (tracked + pushed).  The question exposed
a regression: `9114a5d` (08-14) had moved every regenerable dir (+ `node_modules`, `.git`) to
`~/Library/Application Support/RoadTripRoulette-nosync` with symlinks, because the repo lives under
iCloud-synced `~/Documents` and iCloud losing sync races mid-rebuild is the TRUE origin of every
`name 2.ext` conflict copy.  But `build-fully.sh` ran `rm -rf website/fully` / `rm -rf dist` —
deleting the SYMLINK nodes — so the next deploy rematerialized 1.3 GB as real synced folders and
the conflict copies returned (two more appeared in `website/fully/` on 08-16).  `build-demo.sh`
only ever cleared contents, which is why demo's symlink survived.  Fix: both delete steps are now
`find <dir>/ -mindepth 1 -delete` (contents only; vite's own `emptyOutDir` is symlink-safe too);
fresh builds moved into the vault, stale vault copies replaced, all three symlinks verified.  Net:
~2.9 GB of regenerable material no longer uploads; `checkDuplicates.js` in `npm test` stays as the
tripwire.  **Rule for future scripts: never `rm -rf` one of these dir nodes — empty it.**

### 2026-08-16 (pt 2) — Exit tuning from live playtest: longer lane, lock-in, nose-only braking (uncommitted)

*(Current-state spec for the whole exit system: **Chapter 16**.)*

Three owner-driven adjustments to the 08-15 exit rebuild, from actually driving it:

- **Parallel exit lane 500 → 1000 ft** (`ExitPath.js EXIT_FEET.PARALLEL`).  500 ft was ~3.4 s
  at full valley-floor speed — fast exits (North Bend 32) were blowing past while slow climbs
  (Pass 52/53) felt fine.  The dry-placement fallback ladder is now 1000→500→350→250→150;
  headless check confirms **all 19 stops still place the full 1000 ft** with zero wet segments.
- **Lock-in at 500 ft of lane-5 driving** (`plan.zLock`, GameScene `_updateExitApproach`).
  Hold lane 5 for the first 500 ft of the parallel section and the exit COMMITS there — the
  capture no longer waits for the gore.  The first 500 ft remain cancellable by steering out;
  the late-swerve gore-window catch (08-15 pt 2) is retained for divider-hoppers.
- **Speed slowdown starts AT the gore nose, not before** (owner: "speed slowdown should happen
  just at the nose of the turnoff").  A lock-in commitment can start the cinematic hundreds of
  feet back; through that stretch the car now HOLDS its highway speed and the ease toward
  ~35 mph begins the moment the car crosses `plan.zDiverge` — braking on the ramp, not on the
  freeway.  Headless-verified at SQ: locked in at 95 mph, still 95 at the last pre-nose frame,
  82→60→47→41 through gore/curve/departure; hand-off state still bit-exact, single launch.

All three uncommitted (riding with the working tree).  Everything else from the 08-15 rebuild
entry below is unchanged.

### 2026-08-16 — Wildlife hazards; tilt/snow steering rescue; fog-light saga; rails + traps
One session's multi-day thread, all committed (latest `5893813`); deployed through `c4ad3f2`
(deployment `b037301e`) — everything after that awaits the next push.

**Wildlife road hazards (`6245c52`, superseding the same-day roadside pass `1d9ca26`).** The
2026-08-13 wildlife art is finally live: FIVE encounter sites per run, 2-3 animals each (≤15
total), mostly IN the roadway on the player's side — elk at Snoqualmie ~60.5, deer at Cle Elum
~81, Ellensburg ~112, Washtucna ~231, Colfax ~270.5, each ±0.4 mi per-run jitter, placed after
all cull passes (trap-cop rule), sites avoid ramps/lakes/tunnels/the mile-65 overpass. Hit one:
**15 HP** + crash recovery, a ~22-chunk tweened gore burst ("explodes into a bloody mess" —
owner), and a permanent world-anchored blood decal painted by Road.js. Traffic: same-direction
NPCs ease to ~40% and glide to the site's clear lane (`targetLaneOffset`); spawn cap drops to
35% within 0.6 mi so sites sit in light traffic. `*_crossing` plates still unwired. Verified by
headless `buildRoute()` smoke run. Sizing knobs live in SCENERY_IMAGE_PROFILES.

**Tilt/snow steering rescue (`5893813` + settings row `bdd53b3`).** Root cause of the owner's
"no permission prompt at start, then snow is impossible to turn": the remembered-grant fast path
attached `deviceorientation` WITHOUT re-calling `requestPermission()` — which iOS requires EVERY
page load (it resolves silently when already granted) — so `_tiltAttached` was true with a
silent sensor, and snow's force-tilt rule stranded the player. Three layers: the fast path now
silently re-requests per load and attaches on resolve; `_tiltEventSeen` distinguishes "attached"
from "delivering data"; `_activeSteeringMode` only forces snow-tilt (or honors a tilt pick) when
data actually flows — dead sensor = buttons keep working, always. Plus Settings → Accessibility
"📐 Tilt steering access" (iOS only): RE-ENABLE fires `requestPermission` from the tap's gesture
via `window.__tiltRetry` (clears the session denied-flag, skips the explainer); hard OS denials
get the real recovery steps instead of a dead button.

**Fog-light saga (4 passes, owner screenshots each round).** (1) `89f51e7` far end pinned to the
fixed horizon (old 55000-unit road sample pitched the fan down on descents); (2) `bc00e39` the
graduated fade now bottoms out at a **0.40 residual** instead of zero so clearing visibly ARRIVES;
(3) `4d00bcd` the anchor became the road's LIVE vanishing point — sampled at full draw distance
(76000), smoothed — because descents show MORE road and converge ABOVE the fixed horizon line;
(4) `93554ae` fog lights also reveal VEHICLES: sprites are alpha-faded per-sprite by
`Weather.fogFade` (they really are transparent), so with the upgrade vehicles fade on a
longer-reach curve (near-clear ×2, dissolve ×1.6); roadside scenery keeps the stock fade — that
contrast is what makes the beam read.

**Also this thread:** shore-lake guardrails painted (`24f9bf0` — Keechelus/Easton/Elliott Bay had
a hard physics rail since the fork but NO visible barrier; the bridge Jersey-barrier renderer now
draws the water side of one-sided shore segments); trap cops park corridor-aware (`7ed0215` —
placement moved after the culls, `_exitCorridorRight` flags + 12 re-rolls then left-shoulder
fallback, so no city silently loses its speed trap and the Friend's warnings are final at
placement); wildlife art wired (`1d9ca26`); full-tree deploy `c4ad3f2` → `b037301e`. Mystery
solved en route: the recurring `"X 2.js"` duplicates are **iCloud Drive conflict copies** — the
new `checkDuplicates` gate in `npm test` catches them (two more removed from `website/fully/`).

### 2026-08-15 (pt 2) — Exit commitment is a window, not a frame

First live playtest (owner, North Bend): swerved right AT the gore — one frame past the old
single-frame commit test — got marked missed, sailed into the grass wedge, crashed. Fix in
`_updateExitApproach`: commitment now stays open through the WHOLE 100 ft divergence (the
wedge is under a lane wide, physically reachable), and "in lane 5" is x ≥ 0.90 (straddling
the divider with intent counts; the car is ~0.22 u wide). Only when the curve begins does
staying left become the silent MISS. Late-swerve capture + miss regression re-validated
headless.

### 2026-08-15 — Rest-stop exits rebuilt as real off-ramp sequences (committed aa8d7d4)

*(Historical — phase lengths and commitment rules were retuned 08-16 pt 2 (parallel 500→1000 ft,
`zLock` lock-in, nose-only braking). The authoritative current spec is **Chapter 16**.)*

Owner spec (final): every exit is now a complete taper → parallel exit lane → gore divergence
→ ~90° right curve → offscreen departure, replacing the old rampStrength trapezoid + "swerve
right past x>1.5" instant scene-swap.

- **ONE shared path** — new `src/road/ExitPath.js`. `buildExitPlan()` places each stop's
  sequence on fully dry road (slides earlier/later around bridges; Mercer/Bellevue place clean
  with 0-seg offset) and tags `seg.exitInfo`; `sampleExitPlan(plan, absZ)` returns phase /
  lane-5 center / edges / gore gap / heading for ANY consumer. Road.js paints from it,
  GameScene guides + drives from it — the painted lane and the driven path cannot disagree.
  World units: derived 60.76 u/ft; phases 150 ft taper, 500 ft parallel, 100 ft divergence,
  100 ft curve ARC (≈56 ft of Z — heading is integrated to 82° in a build-time table because
  x(z) can't express a true 90° in this projection).
- **Marking topology** — right-edge band (fog line, shoulder tone, rumble, grit) shifts
  outboard with the taper (`extRF/extRN` in `_drawSegment`); the old fog-line alignment
  becomes the dashed lane-4/5 divider; at the gore the mainline edge returns to x=1.0 and the
  ramp carries its own two edge lines from the nose. Lane count comes from `seg.lanes + 1`
  (nothing hard-codes 5). Worn-paint right-turn arrows (34 ft, world-anchored, projected
  through the boundary surface cache, snow-buried raggedly) — `Road._drawExitArrows`.
- **Sidewalk root-cause fix** — the urban walkway/curb band painted at fixed `x±(w+rumble)` on
  roadGfx (1.5) while ramp asphalt sat on roadBaseGfx (1.35), so the band always won. The
  right band (fill, tone, curb, slab joints) now shifts by `swExt*` — it terminates at the
  taper and wraps the OUTSIDE of lane 5 / the departing ramp, never between freeway and ramp.
  Rural: same shift for the shoulder bands; right-side pasture fences break around the window
  (`seg._exitFenceRightOff`).
- **State machine** (GameScene) — NONE→AVAILABLE→GUIDED→COMMITTED→CURVING→DEPARTING→
  TRANSITIONING | MISSED. No button (owner): driving lane 5 IS taking the exit; a bounded 1.7
  lane-u/s centring assist never fights a left steer, so steering out cancels. Commitment at
  the exact gore start (car-visual Z, not physics Z): controls end, `_exitAuto` owns the car —
  eases to ~35 mph, follows the spline centre (Z advance scales with cos-heading, floored 12%
  so scenery keeps rolling), art via `_exitArtFor()` ladder (`_turn_r`/`_turn_hard_r`/
  `_profile_r` per-genre keys when the new art lands; today falls back to the mirrored
  `_turn` — dedicated right-facing art always beats the mirror so plates never flip).
  Camera lateral view FROZEN at commit (`_exitCamX`) — the car curves away through the right
  edge of the existing view. Departure completes when `playerSprite.getBounds().left >
  SCREEN_W + HUD_OFFSET_X + 24 px` — live viewport, any aspect. MISSED = silent mark, freeway
  unchanged (also covers resume-past-gore).
- **Protection after commit** — `_applyDamage` no-ops, collision/fuel/survival/arrest passes
  don't run, `cops.arrestPending` cleared each frame, pursuers aimed at the mainline; traffic
  keeps flowing. HP/gas/stars/score verified preserved bit-exact into RestStopScene (no heal,
  no drain, exactly ONE launch — `_takingExit` guard + snapshot/grading unchanged in
  `_takeRestStopExit`, which is now purely the final hand-off).
- Old exit affordances removed: rampStrength painting block, 2.8→6.5 ramp clamp opening (right
  clamp is a flat 2.8; lane 5 is inside it), dead `_touchExitArmed`, dead `code` var in
  `_saveRestStop`'s CloudSave call. `seg.rampStrength` still set (0→1 across taper) for the
  scenery-clearance consumers. Dev: `window.__rtrScene` handle (dev-gated, alongside
  `__rtrWarp`) for scripted QA.
- **Validated headless** (Playwright + `?dev=1`, screenshots in session scratchpad):
  SQ take/miss/cancel/pause-mid-curve, urban S, rain N, snow SP (blanket buries arrows &
  divider correctly), wide-viewport 1290 px + 2★ pursuit carry-through. Tests all green
  (missions 256, coal 25, genreTraits 179, vices 37, chase 50, pursuit, upgrades 3,
  encounters 187); `vite build` clean. NOT play-tested by hand yet; night-time exit lighting
  unverified (uses the same nightMul path as the existing fog line).

### 2026-08-16 — "Pillars/starbursts" root-caused: they're the STOCK WINDSHIELD CHIPS · screenshot harness WORKS now

**The white spiky starbursts the owner kept reporting (snow mi 65, port, Mercer) are not world
objects — they are the stock-windshield rock chips + hairline crack** (`_drawStockGlassChips` /
`_drawRockChip`, GameScene ~17196, owner-specced 2026-07-21 "~5× bigger", always drawn until the
New Windshield upgrade). Proven by layer elimination: hiding `_damageGlassGfx` removes them;
every other layer leaves them. That's why they appear in every biome and sit "through" the road.
Do NOT chase them as scenery bugs again.

**Screenshot harness finally works** (the "7 failed approaches" blocker was the intro-call DOM
overlay + the driver-plate modal, not the canvas): Playwright `channel:'chrome'` →
`addInitScript` set `localStorage rtr_intro_call_done=1` → `Difficulty.set('custom')` +
`_fireTitleCursor()` → `window.__plate.set(...)` + force `#plate-modal` classList remove 'open'
→ `s._devEnabled=true; s._warpToMile(m)` → `canvas.screenshot()`. Working scripts in this
session's scratchpad (`probe_pillars2.mjs`, `probe_layers.mjs` — layer-toggle differential).

**Mercer "pillars" ROOT-CAUSED AND FIXED (same session):** they were the UNDER-BRIDGE pier
columns/pontoons — the second, separate pier system in `_drawSegment` ("Under-bridge structure…
repeating paired supports", pale 0x9C988E trapezoids every 8–10 bridge/water segs, up to
4.8×segH tall) — which had NO camera gate, so the East Channel span painted its piers through
the approach's crest rows on structG/roadBase (1.35), which no terrain layer can occlude.
Ruled out first by harness elimination: Jersey rails (already off-span-gated), utility poles,
fence posts, road paint, groundPlane, biome bands. Fix: the whole under-bridge structure block
is now gated `&& this._camOnSpan` — on the span it still tucks under the deck as designed.
Harness-verified before/after at mi 9.525: picket row gone, clean water edge. This closes the
"pillars through the road" family: flank piers (removed pt 2, 08-14), off-span rails (pt 4,
08-14), under-deck piers (this). Probe tip: warping near mi 9.53 triggers an instant speed-trap
bust — set `s._customFlags = { noNpcDamage:true, noPolice:true }` before warping.

### 2026-08-14 (pt 4) — Bridge rails no longer drawn off-span (uncommitted)

Owner (screenshot mi 9.52 Mercer Island): pale "pillars" — the East Channel bridge's guardrail
faces/posts (mi 9.8-10.2) — visible through the road/grass on the descending approach. Third
strike for this artifact family (08-04 `_camOnBridge` gate, 08-05 structG→roadBase drop). The
structural hole: bridge geometry draws on roadBase (1.35) while roadside grass lives at 1.0-1.3
(terrainGfx/GroundPlane), so terrain can NEVER occlude a distant span's rails; on a curved or
descending approach they paint over crest-culled rows.

Fix per owner ("remove them"): the guardrail block in Road.js `_drawSegment` now skips ALL
rail/post painting when `(seg.bridge || seg.water) && !this._camOnSpan` — no off-span rails, so
nothing to show through, on every span (WSB, Murrow, East Channel, Vantage). Rails appear when
the player rolls onto the span, where the 08-13 Keechelus invisible-wall rule needs the paint;
one-sided shore rails (waterLeft/Right land segs, e.g. Keechelus/Easton/Elliott) keep drawing —
they are near-player and were never part of the artifact. Watch-item: the far DECK still draws
off-span at 1.35 and can in principle float over grass the same way; if a floating gray wedge
gets reported on an approach, that is the remaining half of this family.

### 2026-08-14 (pt 3) — Wildlife-crossing walls are now a hard crash (uncommitted)

Owner (screenshot at mi 65.00, van inside the facade art): "the player can drive through the
wildlife crossing bridge without damage. if the player hits the wall, it should stop the car with
a crash and reload them in the middle of the lane." Root cause: wildlife segs are `seg.tunnel`,
so the crossing's concrete only got the tunnel treatment — a 3 HP/s scrape + soft clamp at
±1.18 — and entering on the shoulder just snapped the car inside through the drawn flank wall.

GameScene tunnel-clamp block now branches on `seg.wildlife`: past ±1.18 → full crash handshake
(`_applyDamage(10, 'wildlife_wall')`, "🧱 WALL CRASH" popup, 2 s i-frame, 1 s hold, rolling
restart, `p.x = _postCrashLaneX()` = the owner's "reload in the middle of the lane"). The same
check fires on the FIRST wildlife segment, which is the facade plane — so driving into the wall
face on the shoulder crashes at the entrance instead of passing through. While i-framed from a
prior crash the wall still blocks (hard clamp, no pass-through), it just doesn't re-crash.
Mt Baker / Mercer tunnels keep the scrape untouched; the median/pier soft barrier stays soft by
design (2026-08-12 decision). `wildlife_wall` added to the daily-objective barrier classification.

### 2026-08-14 (pt 2) — WSB concrete piers removed (uncommitted)

Owner: "get rid of the 'pillars' showing through the roadway… maybe they can just be removed."
Confirmed via option pick these were the GRAY VERTICAL POSTS (not the white starburst objects,
which are untouched and still unidentified). They were the West Seattle span's decorative
concrete support piers — Road.js `_drawSegment`, every 10th `seg.bridge` segment, two flared
trapezoids flanking the deck + a foot shadow. Being tall verticals painted inside the
per-segment loop, their extent crossed rows owned by other segments, so they stroked over the
roadway — the artifact prior sessions fought repeatedly. Deleted outright (no collision or
gameplay reads them); tombstone comment at the site says any future bridge supports need their
own depth-sorted pass, not the segment loop.

### 2026-08-14 — Opening-call voicemail preloads during the ring (uncommitted)

Owner: "don't hear the voicemail… on desktop it took a while to load." Root causes found were
three separate things; only the preload was approved for fixing:
1. **Phone silence is the once-per-device flag working as designed** (`rtr_intro_call_done` /
   `settings.introCallDone` — the call never replays after the first completion; use
   `__replayOpeningCall()` to hear it again).
2. **The 08-11 re-encode truncated the recording 27.3 s → 12.4 s** (rode batch commit `f9be9e0`;
   original recoverable from `b8ff6f4`). Owner declined a restore for now — flagged here so the
   short file isn't rediscovered as a mystery.
3. **Fixed: no preload** — the MP3 only started downloading inside `accept()`, so the ~300 KB
   fetch raced the slide-to-answer on the deployed site. `OpeningCallSequence.start()` now
   constructs the Audio element and calls `load()` when the RINGING screen appears; `accept()`
   reuses it, keeping `play()` synchronous inside the gesture (iOS requirement). No wasted fetch:
   `start()` only runs when the intro will actually show.

### 2026-08-13 (pt 2) — Police pursuit AI rewritten; storefront metal buttons; tunnel composites

> ⚠️ **REVERTED 2026-08-22 — everything in this "Police — independent pursuit"
> section is NO LONGER IN THE GAME.** `src/cops/CopProfiles.js`, `CopDriver.js`
> and `PursuitDirector.js` were deleted and `CopSystem.js` was restored to its
> pre-refactor state (`24f9bf0`). Owner's report: cops stacked, died in one hit,
> and could not keep up. The one-pursuer-per-star cap and the SWAT-at-5★ gate
> were re-applied on top of the OLD pursuit code and DO still ship. See the
> 2026-08-22 entry for why, and do not rebuild this without reading it first.

**Police — independent pursuit.** Cops no longer derive their speed from the player's.
The old rear path assigned `reactSpd + closing`, `playerSpeed * 0.80` and
`reactSpd * SETTLE_SPEED_MULT`, and a positional clamp pinned each cruiser at
`TAILGATE_GAP`. Lagging the input made the copying *late, not absent* — every unit
converged on one speed and one distance, which is what read as a hive mind.

Three Phaser-free modules (plain state in, commands out, testable with no scene):

| file | does |
|---|---|
| `src/cops/CopProfiles.js` | 6 bounded archetypes (PATIENT / AGGRESSIVE / INTERCEPTOR / CAUTIOUS / ERRATIC / HEAVY), seedable `makeProfile()`, `integrateSpeed()`. accel & brake are fractions of each cop's OWN cap. |
| `src/cops/CopDriver.js` | observation refreshed at each cop's `reactionTime`, persistent 1–4 s intentions, gap-control target speed, smooth steering, SETUP → TELEGRAPH → COMMIT → RECOVER. |
| `src/cops/PursuitDirector.js` | one striker token with rotation, star-gated wing/pass permissions, cop-to-cop spacing bias. |

Removed from CopSystem's rear path: the closing formula, `SPEED_CAP_BY_STAR`,
`SETTLE_SPEED_MULT`, and the `cop.position = _limit` clamp. Only a narrow anti-overlap
nudge remains. Scripted exits (coal, donut, divert, parked, oncoming, barricade) are
untouched — they carry no profile and take none of it.

`_pitArmed` is now **commit-gated**. It used to arm from sustained lateral proximity during
ordinary following, which is why PITs read as ambient unavoidable damage.

**ONE PURSUER PER STAR** (owner): 2★=2, 3★=3, 4★=4, 5★=5. Old cap was
`ceil(stars * 1.35 * difficulty * night)` — five cars at 3★, so the star rating told you
little. Difficulty and night now scale spawn **rate**, not the ceiling. The cap counts
pursuers only; barricades and oncoming are hazards, and counting them starved the 5★ roster.

**SWAT moved 4★ → 5★** (owner). The helicopter was already 5★-gated (`stars >= 4.75`) and
wired to GameScene — nothing was added. `src/cops/Helicopter.js` and `SWATVan.js` are
*separate unused* implementations, not the live ones.

⚠️ **`stars` is a decaying float that sits just UNDER its integer** — a 5★ chase reads
`4.9997`. `Math.floor()` gave a cap one below the displayed star, and an `s < 5` gate
swallowed the whole 5★ tier so SWAT never spawned. Both now key off `_starLevel` / the
`4.75` threshold. **Any new star gate must use `_starLevel`, not `stars`.**

*Still open:* the legacy `_lungeT` scheduler runs alongside the new ram phases — both
produce strikes, so it works, but it is two mechanisms doing one job. And `addStar()` leaves
`_starLevel` a frame behind `stars`, so a star gain applies one frame late (flagged, not
fixed — it is a wanted-level rule).

**Tests.** 8 superseded chase cases rewritten — they encoded the clamp, the proximity-PIT
and the never-ahead guard this removes; each carries a comment saying what changed and why.
One (`a strike lands`) was ~40% flaky because a striker must now win the token, close to a
readable distance, *and* roll ram-or-PIT. New `tests/pursuit.test.mjs` covers the brief's 16
requirements in 29 deterministic cases (seeded mulberry32). Wired into `npm test`.

**Storefront metal buttons.** New `src/ui/MetalUI.js` — charcoal chamfered plates, banded
gradients, one deterministic 64×64 noise tile, magenta/cyan edge glow, 2 px hover lift and
click depress. Applied to the buy-confirm panel (now **INSTALL / CANCEL** with a per-item verb
and the price beneath), shop rows, and HIT THE ROAD / BACK. Category tabs deliberately left.
The interactive Rectangles are kept as hit areas and only made transparent, so every
`_eatTap` / `_tapBlocked` / `_gateTaps` drift-gate path is untouched.

⚠️ **Depth rule for dressed buttons:** the plate sits AT the button's depth and the *labels*
are raised to `+1`. Do not sink the plate below — a negative depth drops a shop row's skin
under the storefront background (also depth 0) and the button vanishes.

**Tunnel composites.** Mt Baker and Mercer now ship as single authored plates
(`tunnel_mt_baker_full.png` 5644×841, `tunnel_mercer_full.png` 4080×807) with walls and berms
composed in, replacing the runtime assembly of face + 2 wing walls + 2 berms. `openL/openR/openT`
traced from each PNG's alpha; neither opening is plate-centred (u ≈ 0.480), so the fit registers
on `openL/openR` rather than assuming centre. Per-plate `aspect` — the shared `900/1600` would
have drawn them ~3.8× too tall. `naturalFit` makes the ART define the mouth height and the
tunnel register to it; `legs/span/above` are gone. Shell `H_CEIL` follows 4500 → 7490 while a
composite draws, or sky shows through the top of the portal. `WINGS = {}`; the 8 wing asset keys
are unloaded.

*Note:* the wing/berm renderer in `TunnelFaceMesh.js` is now dead code, left in place until the
composites are confirmed on the road.

**Mercer lid approach (7.3–7.4 mi)** cleared of trees/shrubs/buildings — the lid's structures sit
at the portal's distance and nearer island scenery drew straight over them. Filtered at the single
point where a segment's sprites are finalised, not at the four places that plant them.

### 2026-08-13 — Tunnel facades ON for everyone; full-tree deploy
Committed & pushed (`f9be9e0` batch + `1cacd9b` gate), deployed to Cloudflare (`f19fa180`).

`tunnelArtEnabled()` (constants.js) now returns **true everywhere** — owner validated the plates
on the live site via `?tunnelart=1` and flipped the gate. `?tunnelart=0` stays as the A/B kill
switch; `?tunnelart=1` kept inert so old test links work. The flip turns on both the facade mesh
AND the ~4 MB plate download (one shared gate, by design). `f9be9e0` batch-committed the parallel
session's in-flight tree per the owner's new standing rule: **"push" = commit ALL working-tree
changes + git push + Cloudflare deploy** — no committed-vs-uncommitted scope questions.

### 2026-08-12 (pt 2) — Garage tile shows the default genre's car (front pose)
Committed `05b9b59` (tilted pose), not pushed. **Same-day owner revision (uncommitted): pose
swapped from the rear-three-quarter turn to the FRONT view** — `starter_back_turn.png` →
`starter_front.png` in both `syncGarageTileCar()` URLs (template + fallback). All 10 genre packs
carry a `starter_front.png` (verified); aspect ratios vary 1.1–1.65 but the img is
`object-fit: contain`, so no distortion. Everything below otherwise still applies.

The phone menu's GARAGE tile — whose background art is literally
`iphone_menu_bg_empty_garage.png`, an empty waterfront bay — now shows the **active/default
genre's starter** (originally the rear-three-quarter "turn" pose,
`assets/culture/<genre>/vehicles/starter_back_turn.png`, the same RGBA art the in-game steering
pose uses). Implementation: a `data-px`-positioned
`<img id="phone-garage-car" data-px="324 775 210 130">` overlay (PNG-pixel coords track the
artwork at any scale; that string is the position/size knob, `?calibrate` logs tap coords) parked
between the GARAGE label and the trip clock, `pointer-events: none` and declared before the hit
zones so the garage tap passes through, with a scale-tracking drop shadow.

Sync: `syncGarageTileCar()` (index.html) reads `window.__genre.get()` (default station IS the
genre; hard fallback `'hiphop_phonk'` = `DEFAULT_GENRE` for the pre-registry boot window, plus an
onerror fallback to the hip-hop art). It runs at the top of `setPhoneMenuBg` — **before** that
function's early-return, which otherwise always fires now that the bg URL is constant — and in
`syncMenuBg`, covering boot retries, GameScene's car reskin (`__syncMenuBg`), the garage picker,
and the music-app genre star in one chokepoint. The img carries no `src` attribute until the first
sync (`:not([src]) { display:none }`), so there's no broken-image flash on load.

### 2026-08-12 (pt 1) — Snow ground plates visible: whiteout fade removed, roadside hold matched to the road blanket

Owner: the pass "and beyond" was the one region with no ground plates. Diagnosis: the four-stage
roadside snow accumulation (GroundPlane `snowAmountAt`/`snowGroundAt`, landed in `cba522b`) was
already correct, but Road.js still carried the pre-snow-tile whiteout rule
`groundTexFade = (1 − snowI)^0.6`, which faded the ENTIRE GroundPlane layer out as the road blanket
built (40→55) and held it at zero through mile 86 — erasing the snow tiles exactly where they
accumulate. Two changes:

- **Road.js — `groundTexFade` deleted** (`pushRow` back to default alpha 1). Safe on the weather
  gate: `Weather.state()` returns `'clear'` whenever `Difficulty.weather()` is off, so blanket and
  roadside tiles share one gate — whenever the blanket is up, the tiles themselves are the snow art.
  The flat `SNOW_WHITE` grass lerp stays (it's the beyond-fade/failsafe base under the texture).
- **GroundPlane.js — roadside window now mirrors the road blanket:** `SNOW_MI_HOLD` 58 → **86**,
  `SNOW_MI_END` 68 → **88** (matching `snowBlanketAt`'s full-to-86, ease-out 86–88). The old 68
  melt-out left bare Easton dirt beside a still-solid-white road for 18 miles (the owner's own
  08-11 screenshot at mi 68.79 shows it). Regime handoffs (dust ↔ snow-owned base at a = 0.35) land
  at ~mi 41.5 climbing and ~mi 87.2 melting, both away from biome boundaries.

Build 36→50 unchanged (patches in the verge from 36, ~2 mi before the road turns snowy). Not
screenshot-verified (harness still doesn't exist — see 08-10 entry); verified by code path + syntax
check; owner to playtest with `__warpTo(45/55/70/87)`.

### 2026-08-12 (pt 0, 00:19) — Wildlife crossing: real roof, arch-shaped shade, snow accumulation
Committed & pushed `cba522b`. (Entry backfilled — the commit carried Ch. 15 notes but no changelog
entry of its own.)

The crossing read as a **black hole on approach and a roofless gap up close** — four separate
causes, none of them the dim value:
1. **Interior shade** was a per-segment trapezoid from the flat ceiling plane at 0.62 alpha: the
   arch tops got no shade, snow washed through, the pier was ignored, and from INSIDE (stencil
   full-screen) it stacked on the tunnel dim → the blackout. Now ONE mask-clipped fill per frame in
   `renderTunnelOverlay`, approach only.
2. **Stencil vs plate arch mismatch** — stencil was Road's procedural sine arches while the plate
   fitted with tunable `legs`; both leaked light (87% vs 84% width at half height, pier 13.3% vs
   10%). Openings are now **traced from the PNG's alpha channel** and projected through the SAME
   transform as the mesh vertices, so they can't drift again.
3. **`EMB_MIN_DIST` cut the facade off 30 segments out** (a gate meant for mountain embankments) —
   open sky where the bridge should be on final approach. Exempted; mask checks published arches
   BEFORE the close-approach full-screen case so the shell can't paint over the deck.
4. **Shell ceiling used the bore's `H_CEIL`** (4500), cutting a false soffit — the crossing's crown
   sits 1.087·w2 above the road (~6950).

Dim 0.12 → 0.30 (owner: 70% transparent). Plate baked `top 0.80 / legs 0.75 / span 1.00`. Also in
this commit: progressive Snoqualmie roadside snow (4 stages, world-anchored repeating UVs,
noise-masked dissolve, accumulation-keyed handoff — the fade bug the pt-1 snow entry above then
fixed) and the three `snoqualmie_ground_*_1024.png` plates.

### 2026-08-11 (pt 11) — Radio-scan hold music; city landmarks scaled up; cross-shop buy-once fix
All committed & pushed (`165f3c9`, `fd579f6`; shop fix rode an earlier commit this session).

**Radio-scan hold music (`fd579f6`).** After the intro voicemail, the menu no longer starts the
default station — it plays `assets/music/rtr_radio_scan.mp3`, a **3:04 seamless loop** of the radio
surfing the dial: 17 ten-second slices (every genre at least once, all 17 tracks unique, no genre
twice in a row) with crackly band-limited static between stations. The file **ends on a static burst
and opens on a station** and carries no master fade in/out, so the `loop` wrap reads as one more
station change — the loop seam sits at the same near-silent handoff as every internal transition,
which also swallows the MP3 decoder gap. Generated with ffmpeg from the shipped music folders
(slices from the 20–70% band of each song, loudnorm to −14 LUFS; static = hiss + bit-crushed
13 Hz-tremolo crackle layer). Wiring: `AudioSystem.playRadioScan()/stopRadioScan()`; the scan rides
the normal `_trackEl` machinery so mute/volume/music-pause/visibility/watchdog all apply. It ends at
exactly two chokepoints — any real `_startTrack` that isn't the scan URL (covers station pick /
genre star / track pick / playlist / shuffle) and `_refreshStationPlayback` (covers trackless
stations); `GameScene._kickRadio` stops it on run start, with a new branch that starts the default
station when the scan was the only thing sounding (ctx already running → no other branch would).
`_persistPlaybackState` skips while scanning so the loop is never resumed as a "song".

**Seattle/Bellevue skyscraper sprites ×4, stadiums ×6 + closer, Space Needle ×3 (`165f3c9`).**
All 11 downtown Seattle + 9 Bellevue tower profiles quadrupled (`heightMult` + caps), with
`FOG_PROFILE_MULTS` mirrored ×4 so spawn centers push outboard. **Near edges stay pinned by the
painted-edge invariant** (`roadEdgeGapCars`), so growth extends away from the road — owner's explicit
constraint. Stadiums went ×3 then "2x bigger": now `widthMult` 33.9/34.5 with offsets recomputed for
a ~4.0-lane near edge, `renderDepth: 1.7` (under cranes 2.0, over needle 1.5), joined the crane-style
far-perspective set so they grow from horizon specks instead of popping in at the horizon clamp
("appearing in the sky"), and `clearStadiumTrees(1.55, 2.35)` strips left-side foliage (never cranes)
from the approach. Space Needle heightMult 9 → 27 with offset −1.5 → −2.12 so its near edge — and
road clearance; it's a collidable landmark — is unchanged.

**Buy-once parts now sync across storefronts.** The reinforced bumper is shelved as separate row
objects at Finesse AND Sam's (windshield/headlights/wipers L1 likewise at Sam's); buying at one left
the sibling row live, so a second $4k tap bought nothing. The purchase commit now sweeps
schwasted/fap/sam_acc and flips **every row with the same item id** to ✓ OWNED. Same-visit hole
only — next-visit rebuild already filtered owned parts. Also same session: steering pose re-keyed
from instant intent to a **wheel-load accumulator** (pose at 35% load ≈ 0.14 s of real hold,
release below 20%, all modes incl. flappy — quick taps no longer flash the turn art), documented in
the Ch.6 steering-pose section.

### 2026-08-11 (pt 10) — Tunnel facades are painted artwork, drawn as projected meshes
Tests 737 green, `vite build` clean. **Local-host only so far** — see the gate below.

**What shipped.** The three 1600×900 facade plates (Mt Baker, Mercer lid, wildlife crossing) render
as UV-mapped `Phaser.GameObjects.Mesh` grids, 6×4 = 48 triangles, built once and mutated in place.
New `src/road/TunnelFaceMesh.js`; hooks in `Road._drawTunnelFacade()` (rectangular mouths) and in the
wildlife twin-arch branch. Road **passes the live projected geometry in** rather than the mesh
re-deriving it — two copies of the facade maths would drift, and the day they drifted the painted
opening would silently stop matching the mouth.

Why a mesh and not an Image: an Image has one x/y/scale, so it scales about a single point while the
road beneath it shears. The painted opening slides off the real mouth the moment the road curves.

**Plate geometry is MEASURED, not from the spec.** A throwaway canvas probe read each PNG's alpha
channel. The spec's approximations were close horizontally and **silent on the vertical**, which was
the value that mattered most:

| plate | opening (u) | opening ceiling (v) | column profile |
|---|---|---|---|
| mt_baker | 0.2687–0.7319 | 0.6011 | flat |
| mercer_lid | 0.2087–0.7887 | 0.7411 | flat |
| wildlife | 0.2469–0.7531, pier 0.4662–0.5337 | 0.7867 | genuinely curved |

**The core problem: the art and the geometry disagree by a fixed 1.85×.** The painted opening is
h/w 0.484 (a tall arch); the procedural mouth is h/w ≈ 0.262 (a wide letterbox). `stretch=0.54`
appeared *identically at every distance* in the owner's readouts — constant, so not a projection
error. Fitting width only left the arch floating; fitting both squashed the concrete to 54%.

Resolved with the owner's own suggestion — tie many points, don't scale a rigid rectangle — applied
as a **piecewise vertical fit**. The plate is cut at the opening's ceiling and the halves map
independently: the opening band is pinned to the mouth (mostly transparent, so stretching it moves
almost no visible pixels), and everything above keeps the art's true scale. Three live knobs
(`?devtools=1` → `top` / `legs` / `span`) let the remaining slack be dialled on the real approach
instead of guessed. **Mt Baker is dialled in and baked: `top 1.00 / legs 0.55 / span 0.85`.**

**Six real bugs found on the way — all of them only visible in-game.** Worth recording because four
are general traps in this codebase:
1. **Bare `Phaser.WEBGL` with no import.** Phaser is a module import everywhere here, never a global.
   Threw a ReferenceError *from the constructor, before the feature flag was read*, erasing the whole
   Mt Baker face — artwork and procedural. Default-off protected the pixels, not the code path.
2. **`addVertices()` de-indexes.** A 6×4 grid does not keep 35 shared corners; it makes one Vertex per
   index entry — 144. Writing 35 of them left 109 at the origin and drew the facade as slivers to the
   top-left corner. Vertices are now driven off each vertex's own `u`/`v`, which is immune to
   ordering and topology.
3. **`setScrollFactor(0)`.** `GameScene` scrolls the main camera by `-HUD_OFFSET_X`, so every world
   object takes that transform. Pinning the mesh to the screen made it the one thing that didn't move
   with the road — offset ~95px, which ALSO made the bridge face look missing (the concrete was
   displaced off the opening).
4. **Hardcoded depth.** `renderTunnelFacade()` recomputes depth per frame as
   `9.5 - min(1, relZ/76000) * 2.5 - 0.05`; that formula IS the occlusion contract. A fixed `9.82` sat
   above the 9.5 scenery ceiling, so the facade drew in front of every building on the route.
5. **State left behind on early-exit paths — twice.** `renderTunnelFacade()` returns early when the
   camera is inside a tunnel or there's no projection, so a hide placed further down never runs on the
   frames that matter. The plate froze at its last vertices and rode along for a mile past the portal.
   Fixed by asserting visibility once per frame at the single entry point rather than remembering to
   clean up on each of five exits. The status readout had the same disease and now clears itself.
6. **Mesh has NO canvas renderer** in Phaser 3.90 (`MeshCanvasRenderer.js` is an empty stub) and the
   game boots `Phaser.AUTO`. Canvas devices permanently get the procedural face — the fallback is
   load-bearing, not politeness.

**Gate: `constants.tunnelArtEnabled()`.** ON for a local dev host, OFF in production, overridable
with `?tunnelart=1` / `?tunnelart=0`. **Both** the renderer and `AssetManifest.tunnelFaces` read the
same function, so "can it draw" and "is the texture downloaded" can never disagree — and production
doesn't pay 4.0 MB of boot for pixels it won't show. Flip by deleting the host check and the
manifest ternary.

**Also added `?devtools=1`** (`src/main.js`): an on-screen console mirroring `console.*` and uncaught
errors, warp pedals sized like the brake/gas for touch, `Mt Baker` / `Mercer` jump buttons, a live
mile readout, the facade tuning knobs, and an `outline` overlay (magenta = plate, green = its
opening) for telling artwork apart from the real scenery overpass at Mt Baker. Dependency-free, no
CDN. Warps now answer to `?devtools=1` as well as `?dev=1` — they're pure position changes, and
stacking a second flag was friction for no safety gain.

**Still open.** Mercer and the wildlife crossing are wired and drawing but **not yet dialled** —
Mercer's profile is much lower and wider (openT 0.7411) so it will want its own numbers. The
`?mile=` warp + headless screenshot harness was never built, which is why this took a dozen
screenshot round-trips; worth building before the next visual feature. The Seattle→forest ground
cross-fade (custom pipeline, owner's pick) is not started.

### 2026-08-11 (pt 9) — Bands stop collapsing on descents; night tint + sky for the stars
Tests: 550 green, `vite build` clean.

**Owner:** *"as you travel through the biome, the 3 images in the back slowly lower until they are
all overlapping and lined up at the bottom border"* — and *"when the sun goes down we need more sky
involved so we can see the stars ... if night is a dark layer, add it over the biome images."*

**It was not distance through the biome — it was PITCH.** `ts.y` adds
`pitchOff * (0.55 - depthT * 0.35)`, giving 0.27 for far, 0.363 for ridge, 0.55 for near. Against the
±70 `pitchOff` clamp that 0.28 differential is **19.6 px of relative movement**, which very nearly
cancels the 26 px `yOff` spread — near rises almost twice as fast as far, and it starts lowest.
Measured through kittitas: spread 35.7 px at pitchOff +9.5, 21.5 at -41, and **6.4 px at the -70
clamp**, all three effectively on one line. Long descents are common, so it reads as a slow drift.
- **Differential bounded 0.35 -> 0.10.** Near terrain does genuinely shift more than distant terrain,
  so the lag is kept — just capped at ~7 px of squeeze instead of 19.6. **Verified: spread now holds
  20.4 px at the -70 clamp** (was 6.4) and 23.9 at -50.7 (was 18.8).

**Night, two separate problems, both from the bands being day-lit sprites at depth 1.15 while the
star field paints into `skyGfx` at depth 0:**
1. **They were never darkened.** There is no dark overlay to inherit — the sky lerps its own colours
   toward `NIGHT_TOP`/`NIGHT_FOG` — so full-brightness daylight mountains sat against a night sky.
   Bands now tint toward `0x39496B` by `TimeOfDay.darkness`. A blue shift, not a brightness cut:
   dimming toward black reads as fog, a blue shift reads as moonlight.
2. **They covered the stars.** A full star field already exists (Milky Way, named stars, planets,
   moon) but the bands reaching y 32-70 left almost no sky for it. Target height now scales by
   `1 - 0.32 * darkness`, standing the bands ~1/3 shorter at full night.

**Verified:** tint `0xffffff` day -> `0xbdc2ce` dusk -> `0x39496b` full dark; sky above the bands goes
from **61 px in daylight to 99-107 px at night**.


### 2026-08-11 (pt 8) — Bands scale from MEASURED content height; north_bend vertical tiling fixed
Tests: 550 green, `vite build` clean.

Replaces the shared `BAND.zoom` multiplier, which could never work: each biome's silhouette fills a
different share of its 640 px canvas (Easton's far layer 200 rows, Seattle's ~397), so any value tall
enough for the short-art biomes clipped the tall-art ones off the top of the screen. `far` was pinned
at 1.35 by the worst case, leaving the short-art biomes low.

- **`BAND.target = { far: 165, ridge: 100, near: 85 }`** — the desired on-screen HEIGHT of each
  layer's painted content. The renderer divides by that band's own measured content height, so every
  biome lands on target regardless of how its art is packed. `zoom` survives only as the fallback.
- **`_bandContentTop(key)`** measures the topmost non-transparent row off the texture, sampling every
  8th pixel, cached per key and computed lazily the first time a biome paints. **Deliberately not a
  baked table** — the band art was re-exported three times on 2026-08-11 alone and any table would
  have gone stale the same day. Re-exported art now self-corrects.
- **Band height now comes from the TEXTURE, not `BIOME_OVERRIDES.h`.** north_bend declares `h: 1280`
  while its art is 640, so the sprite was sized to double the texture — which made the band **tile
  vertically**, stacking a second copy of Mount Si above the first with its hard bottom edge reading
  as a bar across the range. That was the very first bug found in this whole backdrop thread and it
  had survived every fix since. Under content-height scaling it also threw north_bend's layers to
  y -140, off the top of the screen. The override was written for 1280-tall art that was never made.
- **Dead texture guard fixed** (the one-liner logged in the pending list): `ts.texture` on a
  TileSprite is Phaser's internal fill-pattern texture with a UUID key, so `ts.texture.key !== key`
  was always true and `setTexture` ran every frame on all six bands. Now tests `displayTexture.key`.

**Verified in-engine, all 9 biomes:** no clipping, **no vertical tiling anywhere**, content tops
far 32-70 / ridge 109-164 / near 134-216, spread 102-146 px through the sky. north_bend went from
far y -140 to y 53, in line with every other biome.


### 2026-08-11 (pt 7) — Bands spread into the sky: far-dominant zoom, wider base spread
Tests: 550 green, `vite build` clean.

**Owner:** *"they need to be spaced out; near, far, ridge, through most of the sky"* — far highest —
then *"the spread should be closer to 20px or maybe 30, as long as there's no uncovered pixels."*

The painted silhouette inside each band is bottom-anchored and fills only the lower part of its
640 px canvas (Easton's far layer is rows 440-640 — 200 of 640). At zoom 1 that rendered ~78 px
tall, so all three layers topped out between y 138 and y 163 on a 450 px screen: a 25 px huddle with
the entire upper third empty sky.

- **`zoom` far 1 -> 1.35, ridge 1 -> 1.2**, near unchanged at 1.18. Far dominant, so size now carries
  the depth cue as well as position — big mass distant, low treeline near.
- **`yOff` 16/22/30 -> 16/28/42**, widening the base spread from 14 px to **26 px**. `far` deliberately
  stays at 16: it is the highest-seated layer, so it alone decides whether the ~14 px `skyFogMix`
  strip under the horizon stays hidden. **It must never drop to 14 or below** — that is the
  "no uncovered pixels" constraint. ridge and near are free to sit lower, since bands are at depth
  1.15 and real ground (GroundPlane 1.3, road 1.5) paints over anything below the ground line.

**Verified in-engine:** base spread 28.4 px at mi 5, 25.7 at mi 30, 24.8 at mi 250 — inside the
requested 20-30 window, all three layers up at every mile sampled. It is NOT constant: mi 96 reads
45.6 px and mi 50 only 6.4 px, because `ts.y` also carries `pitchOff * (0.55 - depthT * 0.35)` and
that pitch lag differs per layer, so slopes stretch or compress the spread. Flat ground is where the
tuned value lands.

#### Known limit: one zoom cannot serve every biome

`far` is capped at 1.35 by the WORST case, not the best. Each biome's art fills a different amount of
its canvas — Easton's far layer is 200 rows, Seattle's ~397 — so a single multiplier cannot suit
both. At 2.2 the tall-art biomes clipped off the top of the screen (`seattle_hills` y -102,
`kittitas` -108, `palouse` -123); 1.35 is the most that keeps every crown on screen, which leaves the
short-art biomes (Easton, columbia) sitting lower than ideal.

**The real fix** is per-layer scale derived from each band's MEASURED content height rather than one
shared number, targeting a desired on-screen height. That needs a content-top figure per band —
either baked into a table (which will DRIFT: the band art was re-exported three times on 2026-08-11
alone) or measured at load. Not attempted; flagged here so the cap is understood as a workaround
rather than a tuned value.


### 2026-08-11 (pt 6) — Seamless biome band art; and the seam test that was wrong
Tests: 550 green, `vite build` clean.

Third band-art pass of the day, and this one **tiles infinitely** — owner: *"a new wave of biome
images landed that can be an infinite loop!"* Confirmed: **all 27 bands loop**, worst ratio 1.77
against a 2.0 threshold, with `kittitas_far` and all three `seattle_hills` at a literal 0.00.
Structurally clean too — 2048x640, none blank, none near-empty.

#### How to actually test a tile for seams

The obvious test is wrong, and it produced a wrong entry in the pending list that stood for hours.

**Wrong:** compare column 0 against column W-1 and expect them to be identical. They never are.
In a correctly seamless tile those two columns sit *next to each other* when it repeats, so they
should differ by exactly as much as any other adjacent pair. Natural art always has some
column-to-column variation, so this test flags every organic texture as broken.

**Right:** measure the wrap difference as a RATIO against the tile's own typical adjacent-column
difference, sampled across the interior. Ratio near 1.0 means the seam is indistinguishable from
ordinary internal variation. Above ~2.0 is a real seam.

Under the wrong test, 19 of 27 bands "failed" and `seattle_ground_1024.png` was logged as needing an
art re-export. Under the right one, **everything passes and no re-export was ever needed.** If a
seam check is ever re-run, use the ratio method.


### 2026-08-11 (pt 5) — Ground tiles now run to the draw cap
Uncommitted. Tests: 550 green, `vite build` clean.

**Owner:** *"lets make it so the ground tiles extend to the horizon."*

The ground texture faded 52k -> 70k against a **76,000-unit draw cap**, so the last **6,000 units of
road that were actually being drawn carried no ground texture at all**, and 18k units before that
handed off to the flat terrain fill. That handoff is the entire seam family chased through 2026-08-10
and -11: the flat fill is `grass2` blended toward `skyFogMix`, so wherever it disagreed with the tile
it read as a coloured bar that tracked the sky. Texturing to the cap removes the handoff instead of
trying to colour-match across it.

- `FADE_Z0` 52,000 -> **70,000**, `FADE_Z1` 70,000 -> **76,000**, both now DERIVED from
  `DRAW_DIST * SEG_LENGTH` rather than hardcoded — so raising the draw distance carries the ground
  with it instead of silently re-opening a gap.
- `FEATHER_Z = 6000` keeps a short fade at the very end. The original 18k fade existed because at
  grazing-angle compression the last rows can sample outside the useful mip footprint and flash a
  pure-black horizon strip. **If a black line ever appears at the horizon, widen this** — it is the
  only reason not to run flat to the cap.

**Verified in-engine:** farthest textured row now at Z ~75,800 (was capped at 70,000), landing at or
above the horizon line at mi 5 / 30 / 96 / 158 / 250 — mile 158 puts it 0.7 px off the horizon.

> **Not a bug:** miles ~58-78 report ZERO ground rows. `groundTexFade = (1 - snowI)^0.6` and full snow
> coverage lands at mile 55, so the tile is deliberately faded out under the snow blanket — exactly
> what the Ch.9 spec means by "no snow variants, the engine applies it." Unrelated to this change.


### 2026-08-11 (pt 4) — Seattle ground tile wired
Uncommitted. Tests: 550 green, `vite build` clean.

`seattle_ground_1024.png` arrived, closing the last colour mismatch: the urban miles were falling
back to `ground_pnw_roadside` (olive `rgb(69,64,38)`) against downtown's pavement-grey `grass2`.

- Registered as `ground_seattle` in `AssetManifest.groundTextures`, mapped `seattle_hills ->
  ground_seattle` in `GROUND_TILES`.
- Validated: 1024x1024 power-of-two, fully opaque, average `rgb(53,55,29)`.
- Colour match across all five region palettes the biome crosses (mi 0-20): seattle_urban 37,
  downtown_seattle 28, mercer_island 40, eastside_urban 34, eastside 42 — all under the ~45
  no-visible-seam threshold. The two "faint" readings (69) are `lake_washington`, which is the
  floating-bridge spans where roadside ground is barely on screen.
- Verified in-engine: mi 1.61 / 6 / 12 / 18 all on `ground_seattle` with GL_REPEAT active, handing
  over to `ground_pnw_roadside` at 22 and `ground_north_bend` at 30.

> **⚠ It is NOT seamless, and that is a Ch.9 rule-2 violation.** Measured wrap error (avg per-channel
> difference between opposite edges):
>
> | Tile | L/R | T/B |
> |---|---|---|
> | the 7 Archive tiles | **0.0** | **0.0** |
> | pnw_roadside | 15.3 | 16.3 |
> | **seattle** | **21.3** | **22.4** |
>
> The seven tiles restored from `Archive/` wrap perfectly. `seattle` is the worst of the set, so at
> `TILE_FT = 48` (~2030 px of screen per tile) expect a repeating grid line roughly every 2000 px.
> Re-exporting it seamless is an art fix, not a code one — nothing else needs to change.


### 2026-08-11 (pt 3) — Procedural city silhouettes switched off
Uncommitted. Tests: 550 green, `vite build` clean.

**Owner:** *"I think we need to get rid of the building silhouettes. The biomes look so much
better."* Turned OFF rather than deleted, at the owner's request — one line to bring back.

`DRAW_CITY_SILHOUETTES = false` at the top of `Road.js` gates the pseudo-random rectangle layer
drawn into `cityBackdropGfx`: the stepped far-hill ridgeline, the blocky building shapes and their
warm window dots. Everything it needs is still present and still correct (`cityGap`, `_citySilFade`,
`_clipBottom`, the block loop), so flipping the flag restores it exactly.

It went redundant the moment `seattle_hills` landed — miles 0-20 now carry real three-layer biome
bands, so the urban horizon has actual terrain instead of generated blocks.

**This does NOT touch the real building sprites.** `codex_*` art (Columbia Center, Space Needle, the
Bellevue glass towers) is scenery placed from `RouteData`, a completely separate system. Verified
still drawing: 14 sprites at mile 1.61, 11 through Bellevue at mile 12.

**Verified in-engine:** silhouette layer emits **0 draw commands** at miles 1.61 / 5 / 9 / 12 / 18 /
30, while bands stay 3/3 at every one.


### 2026-08-11 (pt 2) — Skyline re-depthed; horizon clamp gone; Seattle biome closes the last gap
Shipped. Tests: 550 green, `vite build` clean.

**Owner:** *"Don't clip them on the horizon!! Let them fall behind the roadway."* Correct, and the
reasoning was too — *"they should not be over the road or ground. Why would they be?"* They were only
over it because `cityBackdropGfx` sat at depth **6.9**, above every road/fog/ground pass. The
`horizonY` clamp in `_clipBottom` existed purely to stop them stamping on the roadway from up there.

- **Silhouettes 6.9 -> 0.9** — below terrain (1), ground tile (1.3) and road (1.5), above sky (0).
  They now can't paint over the world, so nothing needs to clamp them.
- **Horizon clamp removed.** `_clipBottom` no longer takes `min(horizonY, ...)`. The skyline's base
  is decided by where real, perspective-correct ground covers it, which follows the terrain instead
  of a ruler-straight line at the `CAM.horizonY` constant. It still needs a finite bottom (the values
  become fillRect heights and `_roadTopAt` is Infinity off-pavement), so `CITY_SKIRT = 30` px is how
  far a block may fall before the ground takes over.
- **Soft top edge on the below-horizon patch (`SOFT = 20`).** The `_cityBack` fill starts at a
  dead-flat `H()`. With the skyline now underneath it, a hard opaque start would slice every building
  at exactly the height the old clamp did — same cut, different layer holding the knife. Alpha now
  ramps in over 20 px so buildings dissolve into the ground. The bridge blend went 10 px/5 steps ->
  30 px/15 steps for the same reason.

**Region coverage verified in-engine** (every 3rd mile, 1-292): all 8 biomes carry three bands AND
their own ground tile — westside 16-43, north_bend 28-37, pass_alpine 46-55, easton 58-76, kittitas
79-121, vantage 124-139, columbia 142-208, palouse 211-292.

**Gap closed the same day — `seattle_hills`.** The urban stretch had no bands at all (`biomeAt`
returned null below `URBAN_UNTIL = 16`) on the grounds that "a forest ridge behind downtown would
look absurd" — a fair objection to the WRONG ART, not an argument for a bare horizon. Purpose-made
`bio_seattle_hills_{far,ridge,near}` arrived, so:
- New biome `seattle_hills`, miles **0-20**. `URBAN_UNTIL` 16 -> **0**; the route is now painted end
  to end with no unpainted horizon anywhere.
- `biomeAt`'s fade-up span is now zero-width, which would have divided by zero and NaN'd every
  band's alpha. Guarded — verified 0 NaN alphas across the route.
- **Silhouettes 0.9 -> 1.18**, revised within the hour. The bands are at 1.15, so at 0.9 the new
  Seattle hills would have painted IN FRONT of downtown. 1.18 puts the skyline ahead of the hills
  and still behind GroundPlane (1.3) and the road (1.5) — and it is strictly better than 0.9,
  because terrainGfx (1, the flat below-horizon patch) now sits BELOW the buildings and cannot cut
  them at all. Only perspective-correct ground can.

**Coverage re-verified every 3rd mile, 1-292: NO mile is missing a band.** seattle_hills 1-19,
westside 22-43, north_bend 28-37, pass_alpine 46-55, easton 58-76, kittitas 79-121, vantage 124-139,
columbia 142-208, palouse 211-292.

> **Residual:** `seattle_hills` has no ground tile of its own and falls back to `ground_pnw_roadside`
> (olive) while downtown's `grass2` is pavement grey — the same class of mismatch that caused the
> Royal City seam, just milder. A `seattle_ground_1024.png` to the Ch.9 spec would close it.


### 2026-08-11 — The ground was ONE tile for all 9 biomes (the "water" band, finally)
Uncommitted. Tests: 550 green, `vite build` clean.

**Owner:** *"Why can't we use the ground tiles we have?"* — then, on being shown the history,
*"You're right, it looks like it was just using one for the whole thing."* Correct on both counts.

**The band the owner had been reporting for three rounds was a ground-texture mismatch.**
`GROUND_TILES` held exactly one entry, `_default: 'ground_pnw_roadside'`, and `GroundPlane.setTile()`
— which already existed, complete with GL_REPEAT re-binding and a missing-texture guard — was
**never called from anywhere**. So all 293 miles laid a wet Pacific-Northwest roadside over every
palette. `GroundPlane` fades out from Z 52,000 to 70,000 and hands off to the flat per-segment fill;
where the PNW tile's `rgb(69,64,38)` dark olive met Royal City's `grass2` of `rgb(156,134,54)` bright
tan, that handoff was a hard horizontal seam. It appeared to track the sky because the flat fill is
blended toward `skyFogMix` — brown at dusk, blue-grey in snow at Easton, blue-green at Thorp.

**Why three earlier fixes missed it.** `GroundPlane` is at depth **1.3**; the parallax bands are at
1.15. Every previous attempt (moving the plate, staggering the bands, raising them above the terrain
haze) worked below 1.3 and so could never cover it. Two of my diagnoses were wrong before this one:
the sky's 14 px `skyFogMix` strip is real but small, and the pitch-divergence gap I predicted turned
out to affect **1 of 55 sampled miles** (max 9.3 px) — not the persistent band.

**The art already existed and had been archived for being unused.** All seven non-PNW tiles were
authored to the Ch.9 spec, shipped to `public/` in `12291f6`, then swept into the gitignored
`Archive/` by `422fc2d "Archive 99 unused asset files (~153MB)"`. That cleanup was right by its own
metric — nothing referenced them — but the missing `setTile` call is *why* nothing referenced them,
so the sweep made the condition permanent.

**Fix (all engine wiring; zero new art):**
- Copied the 7 tiles back into `public/assets/scenery/ground_textures/final/`. Validated each:
  1024x1024 power-of-two, fully opaque, and average colours that sit on their regions' `grass2`
  (kittitas tile `rgb(144,128,106)` vs flat fill `rgb(140,126,64)`) — which is what kills the seam.
- Registered all 8 in `AssetManifest.groundTextures`.
- Filled `GROUND_TILES` with a biome-keyed entry each, plus `groundTileFor()` resolving unknown or
  urban miles to the PNW default.
- `_renderBiomeBackdrop` now calls `groundPlane.setTile()` on the **dominant** biome, before the
  urban early-return so miles 0-16 still resolve a tile. Hard cut, per `setTile`'s own contract.

**Verified in-engine** at 9 miles: mi 10/22 pnw · 30 north_bend · 50 pass_alpine · 65 easton ·
96 kittitas · 130 vantage_basalt · 158.96 columbia · 250 palouse — every one with GL_REPEAT active.
Still not verified by screenshot (7 capture approaches have failed; see the 08-10 entry).


### 2026-08-10 (pt 2) — Backdrop: bands lifted above the terrain haze · depth stagger · near-layer zoom
**Shipped in `add53be` and DEPLOYED LIVE** (2026-08-11, deployment `f6ea91ca`). Tests: 550 green,
`vite build` clean.

**Owner, two screenshots (Easton mi 68.79 in snow, Thorp mi 96.14):** *"Are they all stacked on top
of each other? I think they should be spread out more. Something to cover the water looking body in
the middle."* Then, after the first attempt: *"It needs to be on top of the blue/green-brown layer."*

**They WERE all on one baseline.** Every band PNG is bottom-anchored to row 640, and the renderer
gave each a height of `(640 - yCrop) x s` with `setOrigin(0, 1)`, all positioned at `ts.y = horizon`.
So all three cropped bottom edges landed on the same line. Content heights barely differ either
(Easton: far 200 px, ridge 280, near 220) — three similar silhouettes rooted at one baseline, which
is why the backdrop read as a flat painted wall instead of receding terrain. `yCrop` never staggered
them; it only trims the taller layers so their bases don't bury the layer behind.

**The "water" was TWO stacked culprits, and the second is the one that mattered.**
1. The sky gradient runs to `H() + 14` (`skyH`, Road.js) and ends in `skyFogMix` — a ~14 px flat
   fog-toned strip painted full-width just under the horizon.
2. The real offender: the terrain **distance-haze ramp**, `lerpColor(palette.grass2, skyFogMix, mix)`
   (Road.js ~1263), which fades the ground toward fog colour approaching the horizon. It is drawn
   into **terrainGfx at depth 1**, and the bands sat at **0.5** — so it painted OVER them. Seating
   the bands lower could never cover it; that was the failed first attempt.

**Fixes (all whole-route, per owner):**
- **Bands 0.5 -> 1.15.** Above `terrainGfx` (1) so they cover the haze ramp, below the landmark peaks
  (1.2), `GroundPlane` (1.3) and `roadGfx` (1.5) — so the textured ground and road still paint over
  each band's hard cropped bottom edge, and hero peaks are never occluded.
- **`BAND.yOff = { far: 16, ridge: 22, near: 30 }`** — screen px each layer's base is seated below
  the horizon. Does double duty: the depth stagger, and every value is >14 so the farthest layer
  already covers the sky-fog strip.
- **`BAND.zoom = { far: 1, ridge: 1, near: 1.18 }`** — owner: *"zoom in a little on the near biome to
  cover more area."* Near only; magnifying the far ridges would flatten the depth cue the stagger
  creates. Folded into `s` so band height and the `tilePositionX` divide stay consistent — parallax
  speed is unchanged, because on-screen scroll is `tilePositionX * tileScale` and the two cancel.
- **North Bend plate 0.45 -> 1.1.** It was moved to 0.45 earlier the same day (below the bands, per
  the owner's rule). That put it under the haze ramp, which would have painted the same strip across
  Mount Si. 1.1 keeps it the lowest backdrop image — plate 1.1 -> bands 1.15 -> peaks 1.2 — while
  lifting it clear of the ramp.

**Final depth order:** sky 0 -> nb plate 1.1 -> terrain 1 -> **bands 1.15** -> peaks 1.2 ->
GroundPlane 1.3 -> road 1.5. Verified in-engine: bases staggered at every biome
(Easton 223.8 / 232.5 / 245.8), near tileScale 0.461 vs 0.391 for far, all alphas 1.00.

**Not verified visually.** Six attempts at an automated screenshot failed — the title-screen DOM
overlays the canvas and `renderer.snapshot` hangs under software GL. Geometry and depth order are
confirmed by runtime probe; the LOOK still needs a playtest.


> **Commit attribution:** `4a5e4eb` is titled *"Genre-car ending plates + OUT OF GAS
> decision card"*, but it is a **sweep commit** — a parallel session committed the entire working
> tree at once. It therefore also carries the **chase-realism pass** and the **whole rest-stop
> dialogue rewrite**. Searching the git log by message for either of those finds nothing.

### 2026-08-10 — Backdrop: North Bend plate moved below the mountain bands · biome blend 4 mi → 320 ft
**Shipped in `d0d814d`.** Tests: 550 green (`npm test`), `vite build` clean.

**Owner report (screenshot, mile 25.18):** *"I like how North Bend is looking, but I don't like the
horizon background on top of the mountain layer. And I don't think any layer should be transparent."*
Both traced to the same place.

**The pale strip across the range = the base plate, drawn semi-transparent, over the bands.**
`north_bend_transition_east.png` (`nb_base_plate`) is pinned `setOrigin(0.5, 0.55)` so its own horizon
lands on the camera horizon. Measured on the art: it is fully transparent down to row ~380, and
**100% opaque across the full width from row ~507** of 941 — i.e. its opaque region starts about
12 px *above* the horizon. At depth **1.25** that sat above the biome bands (0.5), so it cut the
bottom off the mountain range. And `_renderNorthBend` draws the plate at `setAlpha(w)` where `w` is
the biome cross-fade weight — so mid-blend the covering region was see-through and the range ghosted
through it. That is the pale horizontal band in the screenshot, not a separate "horizon background".

**Plate → depth 0.45, below the bands** (owner's call, picked over a crop-split and over raising the
bands). The mountains now draw in front of the plate's horizon instead of being sliced by it. What it
gives up: at 1.25 the plate's ground outranked `terrainGfx` (1) and replaced the flat grass fill.
In practice that was **already** lost — `GroundPlane` paints the textured ground at **1.3**, above
where the plate sat, even though `GroundPlane`'s own header comment still claims the `1.1` slot it
was written for. The plate now contributes hills and the valley notch; the ground comes from
`GroundPlane`.

**`BLEND_MILES` 4 → 0.06** (≈320 ft, ~2 s at highway speed). Four miles meant a *quarter* of the
westside-forest stretch ran with two mountain ranges stacked, the incoming one at partial alpha — at
mile 25.18 North Bend was painting at **79%** over the forest. Measured across the route, miles with
two layers drawn drop from ~11% to **0.14%**. The old width existed so boundaries wouldn't read as a
hard cut (Easton's drying-out especially); that trade is now reversed deliberately. Do not widen it
back without re-checking the overlap — transparency is proportional to how long two biomes co-exist.

**Fog fade kept** (owner) — `fogFade` still fades distant layers first in real fog weather. That is
atmosphere, not the ghosting.

**Verified** by driving the built game headless (Chrome + playwright-core) and warping to mile 30:
`plateDepth 0.45 · plateAlpha 1.00 · bands a = far/ridge/near all 1.00 · set b entirely off`. No
screenshot — the title-screen DOM overlays the canvas and four approaches to dismiss it failed, so
the *look* still wants a human playtest.

**Two open items found while in here, NOT fixed:**
- **`bio_westside_forest_far.png` is completely blank** — `maxAlpha = 0`, every pixel transparent.
  The westside forest runs on two of its three depth layers. It is the only empty one of the 24.
- **The urban fade-up is still a 4-mile transparency.** `biomeAt` returns `alpha` ramping 0→1 across
  miles 16→20, so the first range is see-through against sky for four miles. Different mechanism from
  the biome blend, left alone deliberately — say the word and it narrows the same way.

### 2026-08-10 (pt 4) — Deployed the 5-commit backlog · dev-server/iOS testing notes (Ch. 2)
Deployed. Tests 737 green, build clean.

**Live** at roadtrip-roulette.pages.dev — NEXT RUN advice panels, both steering fixes, Chapter 14,
and the marketing-site icons/manifest. Verified by byte size and by grepping the deployed bundle for
`WHY IT ENDED` and `_steerIntent` (status codes are useless here — see Ch. 2).

**UNRESOLVED — dev server on the phone.** Mid-session the iPhone stopped loading the game from the
LAN dev server: white screen from a home-screen save, then "network connection lost", then "server
not found", and finally the game shell rendering with an empty music list. Owner's position, which
outweighs the inference: **it had worked for a month up to this point**, so this is a regression in
the setup, not an iOS limitation.

Changes made to that server during the session, all mine and all suspect:
1. switched `npm run dev` (http) -> `npm run dev:https`, introducing a self-signed cert into a flow
   that never had one;
2. deleted `node_modules/.vite`, forcing a full dep re-optimization;
3. flipped protocols repeatedly, re-triggering that optimization each time.

`vite.config.js` itself hasn't changed since 2026-07-20, so the config is not the regression.
**Server has been restored to exactly the prior setup** — `npm run dev` on http, verified booting
over `http://192.168.86.180:3000/` under an iPhone user-agent (Phaser up, audio registered, 10
stations, canvas present, no failed requests). Owner is investigating.

New in Ch. 2: the http-vs-https dev scripts and why it matters on a phone, the three separate iOS
restrictions that make self-signed https painful on device, the noisy-but-harmless
`docs/retired/press-kit-page.html` dep-scan error, and **a decoder for "Music is taking longer than
usual to load"** — that message means `src/main.js` never executed, NOT that audio is slow, and it
is the same fault as a blank game canvas.

### 2026-08-10 (pt 3) — Marketing site had no icons at all · Pages returns 200 for missing files
Committed, NOT yet deployed.

**Saving the site to an iPhone home screen gave a screenshot, not an icon** — because the root
marketing site declared none. All 9 pages had viewport / title / description / stylesheet / Twitter
cards and **no favicon, no apple-touch-icon, no manifest**, and there was no `website/icons/` at all.
(`/fully` and `/demo` were always fine — vite rewrites them to relative `./icons/...` and they serve
the real 43,960-byte icon.)

Now installable: `website/icons/` (apple-touch-icon 180x180, favicon-32, icon-512, all alpha-free
as iOS wants), `website/manifest.webmanifest` (`display: standalone`, scope `/`, sunset-orange
`#ff7a1a` theme on the site's `#0b0d12` background), and favicon + apple-touch-icon + manifest +
theme-color + `apple-mobile-web-app-title` in all 9 page heads. The game's own manifest is scoped
`/fully/`, so the root manifest's `/` scope doesn't collide.

**⚠️ THIS PAGES PROJECT RETURNS HTTP 200 FOR MISSING FILES.** A nonexistent path serves the
4,680-byte 404 page *with a 200 status*: `curl /this-does-not-exist-xyz.png` → `200`. **Any deploy
check that only reads the status code is worthless here.** That is how the 2026-08-04 "signs are
live" verification passed while actually fetching the 404 page — the plates and car art in that same
check were size-compared against local bytes and were genuinely fine, but `sign_M.png` was not.
**Verify deployed assets by BYTE SIZE against the local file**, e.g.

    lsz=$(stat -f%z "public/$f"); rsz=$(curl -s -o /dev/null -w "%{size_download}" "$URL/$f")

Re-verified the current deploy that way: `sign_blank`, `sign_plaque`, `aok.png` and
`starter_back_turn.png` all match local exactly.

**Unrelated but worth recording:** the home-screen icon also won't appear when saving from the
**dev server**, because Safari won't trust the self-signed `@vitejs/plugin-basic-ssl` cert for the
icon fetch. Nothing to fix — test icons against a real cert (`/fully`).

### 2026-08-10 (pt 2) — Turn art now keys off steering INTENT, not lateral velocity
Committed. Tests 737 green, build clean. All eight pose behaviours verified frame-by-frame in-engine.

**Two complaints, one root cause.** "Still a little too slow", and "when I switch from left to right
the car is driving the opposite direction it's facing."

The pose was keyed to `p.steerVelocity` — the car's RESULTING lateral velocity, which is the last
link in a three-stage lag chain: the 0.33 s input weight ramp (`STEER_RAMP_ENGAGE = 3.0`), then
grip-limited lateral acceleration, then a `|lean| >= 0.30` gate held for 55 ms. The 55 ms debounce
that got trimmed on 08-09 was the SMALLEST term — tuning it further could never have fixed this.

The reversal bug fell out of the same design: the old machine had to fully RELEASE before it could
engage the opposite side, so coming out of a left turn `lean` had to climb from −0.8 through the
−0.14 release threshold, sit there 110 ms, then reach +0.30 for 55 ms. **Through that entire window
the sprite showed LEFT art while the car was already travelling right.**

**Now driven by `_steerIntent`** — the raw pre-ramp steering input, captured in `_updatePlayer`
before the weight ramp. Known the frame the player presses; flips sign instantly on reversal.
Inversion is applied when capturing it, so under a vice that inverts steering the art still follows
where the car actually GOES rather than which key is down.

Owner's calls, all verified:
- **Engage instantly** — digital modes pose on frame 1. Tilt keeps a 0.18 deadzone + 30 ms debounce
  because it's a real analog axis with wrist jitter.
- **Reversal shows exactly ONE straight frame**, then the far side.
- **Release holds through a drift** — no intent AND lateral velocity settled, ~100 ms. Letting go
  mid-slide keeps the three-quarter view rather than snapping upright while visibly sideways.
- **Flappy is always posed**, mirroring on each tap, since its input never reports neutral.

Verified traces (`-` straight, `L`/`R` = pose + mirror):

| case | trace |
|---|---|
| hold LEFT | `LLLLLL` (frame 1) |
| hold RIGHT | `RRRRRR` |
| reverse L->R | `LLLL-RRRRR` (one straight frame) |
| release mid-drift | `LLLLLLLLLLL` (holds) |
| release settled | `LLLLLLLLL----` (~100 ms) |
| tilt jitter 0.1 | `------` (deadzone) |
| tilt real 0.6 | `--RRRR` (~33 ms) |
| flappy taps | `LLL-RR` |

Lateral velocity still has one job: HOLDING a pose through a slide. It no longer decides when one
starts.

### 2026-08-10 — Steering read as the car TIPPING; body roll removed, sprite re-anchored to the tires
Committed. Tests 737 green, build clean. Verified numerically in-engine (angle, anchor drift and
tire-baseline tilt probed per pose); overlay screenshot still owed — see below.

**The cause.** `_updatePlayer` rotated the whole sprite by `leanDir * 6`, clamped at ±1.4 — up to
**±8.4° of body roll driven straight off steering input**. Rotating about the PNG centre lifted one
rear tire off the ground line and tilted the roofline, so a lane change read as the car banking.
The rear-three-quarter turn art already carries its own drawn perspective, so the rotation was
double-counting the turn. **Now pinned at 0.** If a real suspension/body-roll effect is ever wanted
it belongs in that spot, driven by something physical rather than raw steering input, and capped
around 0.25-0.75° (1° absolute ceiling).

**The shadow followed.** It tilted `-leanDir * 4°` as the "body leans in, wheels stay planted"
counter-cue. With no body roll there's nothing to counter and a rotating puddle under a level car
reads as detached, so it's flat now too.

**The art is level — no asset fix needed.** Measured straight off the alpha channel:
`starter_back.png` puts both contact patches at y=355; `starter_back_turn.png` at y=355 and y=354.
**1 px across a 410 px span = 0.14°**, which is the perspective drawn into a 3/4 view, not a
crooked export. Runtime compensation would have been the wrong fix.

**But the anchor was wrong.** The sprite was anchored at the PNG's bottom-centre (origin 0.5, 1),
which is NOT the tire-contact midpoint. On the turn art that midpoint sits at x=320 of 611 —
**14.5 px right of centre** — so every straight->turn swap slid the car sideways, and mirroring the
pose threw the offset the other way, a ~4 px jump of the point that is supposed to be nailed to the
road. Now anchored at the measured contact midpoint, with the origin set to `1-u` when mirrored so
the same physical point stays put. Measured per texture from the alpha at runtime, not hard-coded,
because the car art is PER GENRE — ten bodies, each framed differently.

**Verified per pose** (contact midpoint vs the anchor the sprite is pinned to):

| pose | originX | anchor drift | tire-baseline tilt | sprite angle |
|---|---|---|---|---|
| straight | 0.4995 | 0.00 px | 0.00° | 0 |
| turn | 0.5233 | 0.00 px | 0.14° (art perspective) | 0 |
| turn mirrored | 0.4767 | 0.00 px | 0.14° | 0 |

**Bug found while validating:** `_playerSpriteFramePoint` had `flipX` backwards — Phaser renders
texture-u at FRAME position (1-u), so the offset is `((1-u) - originX)`, not `(originX - u)`. It
reported a phantom 4.3 px drift on the mirrored pose, and since the rear licence plate is
positioned through the same helper, the plate itself would have sat 4 px off when mirrored.

**Rear plate** now resolves its bottom-centre through that helper instead of assuming the origin is
the PNG bottom, so it didn't move when the anchor did.

**TEMPORARY diagnostic — press G** (`_drawSteerDiagnostic`): green tire-contact baseline with a dot
on each contact, amber ground anchor, pink screen vertical through the car, blue road lane-direction
ray. On a straight road both dots must sit on one horizontal line; on a curve the car may travel
along the lane ray but the baseline must stay horizontal. **Strip it with the other dev aids before
release.**

**Not captured:** a screenshot of the overlay on the road. Headless, an unsteered car wrecks in ~4 s
(destroying the sprite mid-capture) and a paused pre-run scene sits behind the title art. The
diagnostic runs without error and its numbers are the table above, but it wants an eyeball in a real
playtest.

### 2026-08-09 → 10 — 55 ms turn-in · iOS silent-GPU-eviction recovery · bonus weapons crest the horizon
Tests green (7 files), `vite build` clean.  **All three LOCAL ONLY — not yet deployed.**  One
`npm run deploy` ships the batch to /demo + /fully.

- **Steering-pose turn-in trimmed 80 → 55 ms** (owner: "a tad too slow") — engage timer only in
  `_updateSteerPose`; release hold (110 ms) and the 0.30/0.14 hysteresis band unchanged.
- **"Came back after an hour and every image was the car" — iOS silent GPU eviction.**  Diagnosed
  by reproducing context loss locally (WEBGL_lose_context): a NORMAL lose→restore recovers
  perfectly, so Phaser 3.90's event path is fine.  Safari's failure mode is different: it can
  evict a backgrounded tab's GPU textures WITHOUT firing webglcontextlost — dead texture handles,
  no rebuild, every sprite samples whatever binds (the car).  Fix in main.js: on visibilitychange
  → visible after ≥30 s hidden, re-create every wrapped GL resource from its retained source
  (textures → buffers → framebuffers → programs → locations, mirroring Phaser's own
  contextRestoredHandler) + createTemporaryTextures + pipelines.restoreContext, then drop the
  Road/GroundPlane raw-GL caches (`_ready`/`_ok`) so REPEAT/mipmaps/anisotropy re-apply.
  Safety-verified: the rebuild is a visual no-op on a healthy context (frame-diff = live traffic
  only), and the true lose/restore path still recovers.  Console logs `[resume] GPU resources
  rebuilt after Ns hidden` when it fires — check that if the salad ever reappears.
- **Bonus weapon pickups popped in mid-road** — `_injectBonusWeapon` (the 4★+ keep-them-armed
  drip) spawned 30-80 segments ahead = 10-20 % of the 380-segment draw distance, materialising on
  open roadway and swelling on approach.  Now 310-365 segments out, just inside the draw cap where
  the distance fog owns the sprite — it crests the horizon like every route-built pickup.
  Route-built weapon placement was never affected; this spawner only fires at 4★+.


### 2026-08-08 → 09 — Player steering poses: rear-¾ turn sprites · shrink fix (art normalization + pixel-factor sizing) · 55 ms turn-in
Tests green (7 files), `vite build` clean.  **Deployed to /demo + /fully** through the shrink fix
(verified live by content: 611×359 art + `turnfit-1` in the served bundles).  **Local only:** the
55 ms engage trim.

- **Steering pose system** (`GameScene._updateSteerPose`, ~45 lines).  The genre starter swaps
  between `starter_back.png` and the new rear-three-quarter `starter_back_turn.png` while
  steering.  Driven by resolved lateral velocity (`steerVelocity / TURN_SPEED`) so touch, keys and
  tilt behave identically by construction.  Art depicts a SCREEN-LEFT turn and steer input is −1
  for left → left = unflipped, right = flipX (verified by probe: sv sign, p.x drift, capture grid).
  Hysteresis 0.30-engage / 0.14-release; 80 ms turn-in (→ 55 ms, see below), 110 ms release hold;
  direction reversals pass through straight.  `setTexture`/`setFlipX` only on state change; flip
  touches only the car art — plate overlay stays unmirrored.  One texture key
  (`codex_beater_back_turn`) + ONE `GENRE_ART` line covers boot loading AND live genre swaps.
  Gated on the starter art key, so garage/codex vehicles are untouched.  Cockpit skips.
- **"Car shrinks when turning" — root cause was the ART, not the sprite code.**  All 10 turn PNGs
  matched their straight twin's CANVAS but drew the car 8–31 % smaller inside it (phonk worst,
  ×1.311) and floated the tire baseline 15–46 px high.  Frame-pinning canvas width to 78 px made
  the smaller car-in-canvas render smaller.  Fix in two halves:
  1. `scripts/buildTurnSprites.mjs` (repeatable; originals preserved per genre as
     `starter_back_turn_raw.png`): uniform-scales each turn car by straightVisH/turnVisH — height
     is the yaw-invariant landmark; width is deliberately NOT force-matched (the visible side
     legitimately widens) — then re-composites with the straight art's bottom padding, bbox
     centred.  Canvas WIDTH grows where the scaled car no longer fits (8 of 10 genres; cropping
     bodywork was not an option).  All ΔX corrections measured ZERO (art was pre-centred <1 px);
     no per-genre metadata needed.
  2. `_applyPlayerSpriteDisplaySize`: the TURN pose is sized by the STRAIGHT art's px-per-source-px
     factor instead of re-pinning the turn canvas to 78 — the build contract (equal
     pixels-per-car-unit + equal bottom pad) makes one shared factor keep rear face, tire baseline
     and centre fixed.  Probe-verified: factor byte-identical across poses (phonk .1511, country
     .179, reggae .1325, norteno .118), baseline ±1.5 px, transitions
     straight→L→release→R→direct-reverse all stable.  Cache-rev `turnfit-1` forces installed PWAs
     to re-fetch the corrected art.
- **Turn-in trimmed 80 → 55 ms** (owner: "a tad too slow") — engage timer only; release hold and
  hysteresis unchanged.  NOT yet deployed.
- **Art notes:** k_pop and metal turn sprites read as barely 3–5° vs the ~12–15° of the rest —
  pose effect is subtle on those two; re-render if consistency matters.  Two iCloud conflict
  copies in `website/fully` (caught by the new checkDuplicates build guard) verified
  identical/empty and removed.


### 2026-08-09 — NEXT RUN advice panels on the failure endings
Committed. Tests 737 green, build clean. Screenshots reviewed for every reason at wide (1280x720)
and narrow (740x420); ownership matrix probed in-engine.

**What it is.** A run that ends badly now says WHY, and what to do about it, on the ending plate —
Phaser text over the artwork, never baked into the PNGs. Keyed to the ACTUAL cause, not a random
tip. Three pieces, deliberately separate:
- **Classification** — `GameScene`, at the sites that already know what happened.
- **Selection** — `src/data/endingTips.js`: reason -> copy, plus the personalisation pass.
- **Rendering** — `src/ui/NextRunPanel.js`, which knows nothing about causes.

**Reasons** (`FAIL_REASON`): `busted_pursuit`, `busted_speed_trap`, `busted_failed_stop`,
`crashed_major_impact`, `crashed_accumulated_damage`, `out_of_gas`, `passed_out`, plus
`busted_generic` / `crashed_generic` for anything unclassified (old saves, existing call sites).

**How each is decided.**
- Bust: a live trap encounter (`_trapPursuitActive || _trapStopHeld`) -> speed trap; else the
  `_trapIgnored` flag set when `promoteTrapPursuit` fires -> failed to pull over; else pursuit.
  `_trapIgnored` clears when heat hits zero, since by then it's just a chase.
- Crash: the killing blow's size against max HP. >= 30% is one big impact; below that is attrition.
  Needed `_lastHitAmount` (recorded on the `damage` event) and a new `DamageModel.getMax()`.

**Personalisation.** Nothing installed -> buy tier 1. Partly upgraded -> buy the NEXT tier. Maxed ->
never sold anything, gets a usage line instead ("REPAIR IT: top the car up at a garage"). Radar
detector likewise: unowned -> buy it at CowBella; owned -> "LISTEN: faster beeps mean the trap is
closer." All names come from `UPGRADE_CATALOG` (Zip-Tied Bumper, Reinforced Bumper, Jerry Can Rack,
Radar Detector), never invented.

**Bug found while validating:** `tipContext` resolved `vehicleId` to null on the ending screen —
that scene has no `player`, and the registry key can be unset by then — so `getInstalled()` returned
`{}` for everyone and a player with a maxed Body was still told to buy the $25 Zip-Tied Bumper.
Now resolves registry -> player -> `'beater'`, the same order GameScene uses.

**Also hardened:** `loadEndingArt` got a 2.5 s watchdog. The load callback is what draws the
headline and buttons, so a loader that never reports back leaves the player on a blank screen with
no way to restart — seen once under rapid scene restarts.

**Layout.** 800x450 design space, same as the rest of the ending screen. Panel anchored per plate
(`ENDING_PLATES[cause].tips`) so it never covers the car: right of it on busted / passed-out /
out-of-gas, LEFT on crashed, where the wreck sits right of centre. Fill `#050812` at 90%, amber
`#FFCC44` border with a 3-pass neon glow, cyan `#4FD8FF` Impact headings at 13px, 11.5px body with
a heavy black stroke, 12px padding. Fades and slides in over 280 ms after a 420 ms delay so it
never steps on the ending reveal. **Nothing in the panel is interactive**, so it cannot intercept a
tap meant for RESTART / CONTINUE / MENU.

**Not reachable:** a speed trap on its own never busts you — complying gives a ticket or a warning,
ignoring it adds a star and becomes an ordinary pursuit. `busted_speed_trap` is therefore only
reached when a trooper takes you down while the trap encounter is still live. Copy exists and is
correct if that path widens.

### 2026-08-05 — Rest-stop cards are CONVERSATIONS · NPCs quote prices, shops take the money
**Shipped in `4a5e4eb`** — ⚠️ that commit is titled *"Genre-car ending plates + OUT OF GAS decision
card"*, because a parallel session swept this whole working tree into its own commit. **Searching the
git log for the dialogue work by commit message will find nothing.** `4a5e4eb` is the one: it carries
`encounters.js` (+321), `townFacts.js` (+149), `RestStopScene.js` (+336), `MissionSystem.js` (+38)
and the new `tests/encounters.test.mjs` (+92).

Tests at time of writing: chase 50, coal 25, missions 256, genreTraits 179, dose 37, upgrades 3,
**encounters 181 (new file, wired into `npm test`)** — all green. `vite build` clean.
Re-verified 2026-08-10 against the current tree: **encounters 187**, whole suite still green.

**The complaint.** *"Only some of the responses should go on to the next screen. If the NPC has a
response show that in the NPC convo menu. Player must select a sentence that moves off the
conversation to get to the storefront."* Every choice used to call `dismiss()` and throw the reply up
as a 2.6-second floating toast over a torn-down card — so you got exactly ONE interaction per NPC,
and the answer to your question was the same tap that ended the conversation.

**How a card works now.** A choice either ANSWERS or EXITS:
- **Answers** — the reply replaces the NPC's line *in the same card*, the question is struck off the
  list, and the card stays up. `convo.consumed` is keyed `nodeId::label`, so walking to another node
  and back doesn't resurrect a spent question (and nothing repeatable can be farmed).
- **Exits** — the card closes, and for a shop greeter *this* is what finally opens the storefront.
  The parting line still plays as the old toast: the card is closing by definition, so there's
  nothing left to print it into.

**The rule is inferred, not hand-tagged** — `isExitChoice()` in `encounters.js`. *Words are free;
resources cost you the conversation.* A `cost`, a `chance` gamble, or any effect moving
cash/HP/fuel/heat/a survival bar exits. Effects that are only talk — `dialogue`, `revealHazard`, a
prep `buff`, the `generous` karma flag — stay open. The one thing inference can't see is a *leave*
line ("Time to dip", "Walk away"): it carries nothing but a parting `dialogue` and is otherwise
identical to a question, so those 20 carry an explicit `exit: true`. Safety net: if a node has no
free unconditional exit left, the renderer appends *"That's all I needed. Thanks."*, so the player
can never be trapped behind a price they can't pay.

**Every card has a question now** (verified by assertion, not by eye). Nine had one already —
Weirdo/pass, Ski Bum/safe route, Mike/road ahead, Farm Worker/road ahead, Founder/fog,
Hitchhiker/rain, Ranger/elk advice, Swimsuit Girl/the mill, and every shop greeter's road question.
The three that didn't were all-transactions-and-goodbyes, so they still played like the old
vending-machine card; each got one authored question that teaches a real system:
- **Tow Driver** — *"Three a week? What's actually putting them in the ditch?"* → the straight dark
  road and the Tiredness bar.
- **Lemonade Kids** — *"Is there anything at all between here and the next town?"* → the Basin's
  service gap. *"Dad says buy two. We only sell one."*
- **Shade-Tree Mechanic** — *"What am I actually watching for — the gauge, or something else?"* →
  engine heat, and that the smell beats the needle.

**`revealHazard` DELETED — the whole verb.** It was written to `_purchases` and read by nothing, and
the reason it was never wired up is structural: `Weather.state(mile)` is a **pure function of
mileage** — fog 14–25, rain 30–40, snow 40–88, gated only on difficulty. Identical on every run. There
is no hidden information for an NPC to reveal, so a "reveal" could never be worth anything; the
warning the NPC speaks aloud IS the whole payload, and it costs nothing to deliver. Gone from the
effect vocabulary, `applyEncounterEffects`, the `INFO_ONLY_EFFECTS` set, the RestStopScene ctx hook
and all 14 call sites. Classification is unaffected — those choices are now `dialogue`-only, which the
same rule still reads as a question.
- **If you ever want asking to matter, the fix is upstream:** make which hazards go live a per-run
  roll. Then "how bad is it up there" is real intel and the $150 chains are a real bet. Logged, not built.
- **Fallout: two buffs are now provably inert.** `warm` and `elk_ready` have empty `effects`, no
  `special`, and nothing anywhere reads `BUFF_EFFECTS.label` — `aggregateBuffEffects` and
  `hasSpecialBuff` are the table's only consumers. Granting either is a no-op. Flagged in
  `buffs.js`, not deleted, because `label` implies a planned buff readout in the HUD. The other
  three are real: `snow_chains` (snowGrip +0.28, topMph −4), `wind_ready` (stability +0.10),
  `tow_insurance` (halves the wreck loss).

**Balance is unchanged on purpose.** Because every transaction exits, one NPC still pays out one
resource per visit, exactly as when you only got one tap.

**NPCs quote prices; shops take the money.** Owner: *"any discounted items should be priced in the
store, not sold at that moment."* New effect verb `storeOffer: { shop, item, price, note }` →
`_applyStoreOffer()`, which reprices a row **in place**, this stop only, and refuses to go *above*
list. Repricing rather than injecting a row is load-bearing: shop buttons are built once in
`create()` into pre-rendered containers, long before any encounter card exists, so a brand-new row
would simply never be drawn. Every routed product is therefore something the shop **always stocks**:
- **SNOW CHAINS** — $200 list at every Les Schwasted. Chain Guy quotes $150, or $120 haggled.
- **COOLANT TOP-OFF** — $40 list at every Finesse. The Shade-Tree Mechanic quotes $25.

Two new purchase channels carry them: `payload.encounterBuff` (a buff bought over a counter, routed
through the same `encounterBuffs` array the cards already use, so GameScene needs no new case) and
`payload.coolEngine` (absolute temperature drop — the pint of oil's `coolEngineFrac` is the
proportional one).

**What deliberately still changes hands in conversation**, because there's no counter to walk to: the
tow-insurance prepay ($50) and the traffic app ($100) are buffs no shop sells; the cookie, lemonade,
pie, thermos and motel room are consumables with no SKU; and the **Washtucna dent knock-out** stays
roadside because Washtucna is the one stop where an NPC's offer has no matching shop in town (no
Finesse, no Sam's) — she has a mallet in the truck, so she does it herself.

**Gamble lost in the move.** Routing chains to a counter dropped Chain Guy's 65/35 "these only LOOK
tough" outcome — a shop row can't resolve a chance table today. The haggled price survives; the risk
of being fleeced doesn't. Worth revisiting if that trade-off matters.

**Still open — the three fuel offers.** Grandma's $35, the Farm Worker's $50 rocket fuel and Mike's
$100 diesel split were mapped to Huff's `refuel` in the plan, and all three are still transacting in
the conversation. Reason: none of them is *pump gas*. Mike siphons from his own tank, the Farm Worker
is explicit that his mix is **not** what a station sells ("You can fill up at any fuel stop. But I've
got a mix that makes your mileage pop"), and Grandma keeps cans at the house. Routing them to a
Huff's counter deletes both the joke and the fiction, so they're left as-is pending a call.

### 2026-08-05 — Bridge-entry bleed root-caused (two stages) · encounter cards resized · cop-array crash fix · fireworks down the chopper · cold-load black bar · storefront back button
Tests 546 green, `vite build` clean.  **Deployed to roadtrip-roulette.pages.dev:** the encounter-card
split tiers and stage 1 of the bridge fix.  **Local only, NOT yet deployed:** bridge fix stage 2, the
cop-array crash fix, the helicopter kill, the cold-load fit, and the back-button rework.

- **Bridge-entry "images under the road" (owner screenshots, two rounds).**  Bridge segments route
  deck + guardrails to bridgeFrontGfx (depth 4, the crane-occlusion overlay) — during the APPROACH
  nothing on the normal road layers could ever paint over them, so far rails bled through the
  near roadway.  Stage 1 (deployed): route to the overlay only while the CAMERA is on the span
  (`_camOnBridge`, from the player's segment).  Stage 2 (local): that alone still leaked, because
  since the road-texture split the nearer normal road's asphalt base lives on roadBaseGfx (1.35) —
  rails re-routed to roadGfx (1.5) still floated over it.  Off-span, ALL bridge/water structure
  (deck, rails, fascia, piers) now draws into the BASE layer (`structG`), where far→near painter
  order occludes it like any other distant geometry.  On-span routing unchanged (cranes still
  occluded).  Capture-verified at mile 0.94: rails only at the actual deck edge.
- **Encounter-card split tiers (deployed).**  The NPC dialogue card sized dialogue AND choices from
  ONE type tier; five sentence-length choice buttons failed the fit test at every big tier and
  dragged the whole card to the smallest pre-2026-07-15 sizes — tiny text plus a dead mid-card gap
  (owner screenshot, Marcy card).  The bottom block (speaker/fact/choices) now takes the largest
  tier that leaves room for at least a smallest-tier dialogue, then the dialogue independently takes
  the largest tier that fits what actually remains.  Fact-drop pressure valve preserved.
- **Cop-array crash (owner screenshot: `_checkCollisions` cop.parked on undefined).**
  `endTrapPursuit()` and the sub-3.5★ SWAT drop did `this.cops = this.cops.filter(...)` — REPLACING
  the array.  Landing inside a collision handler mid-loop, `_checkCollisions` kept indexing the new
  shorter array with its old index → undefined.  Both filters now splice IN PLACE, the bust-reset
  uses `length = 0`, and the loop guards a vanished index.  Rule for the future: never replace
  `cops`, mutate it.
- **Fireworks now take out the 5★ helicopter** — the one unit the wipe couldn't touch.  CopSystem
  grounds it (`_heliDownT = 30`, gate on `helicopterActive`), GameScene detonates at the overlay's
  live sway/bob position ~0.9 s in (timed to the first shell) with a CHOPPER DOWN popup + shake.
  Relaunches only after the downtime, and only at true 5★.
- **Cold-load black bar (landscape first load; rotating away/back cured it).**  Rotation runs a
  settle ladder of re-fits, but a page loaded ALREADY in landscape got exactly one rAF fit — before
  iOS resolves safe-area insets / collapses the toolbar, which doesn't reliably fire `resize`.
  Boot now runs the same ladder (120 ms→1.6 s), plus a ResizeObserver on #game-root and a
  visualViewport resize listener, so any later box change re-fits without a rotation.
- **Storefront back button ("ignores my tap, worse in some shops").**  Two causes: 80×26 px ≈
  39×13 pt on device (under half Apple's 44 pt minimum), and no depth — full-bleed shop art created
  later in the display list stacked over it (the per-storefront variance).  Now 112×32 visual with
  a padded input rect (~136×52 effective), 16 px label, depth 60.
- **Scanner Q&A (no code change):** the pre-dispatch noise is the Scanner upgrade's two-tone
  descending chirp (`playScannerChirp`), fired when the live cop count RISES (new pursuit /
  roadblock units entering the world), 6 s cooldown — the radar detector's blip is single + rising.


### 2026-08-04 — Road/material + fog-light + storefront batch DEPLOYED · phonk default car · `npm run deploy` rewired to RTR
**DEPLOYED to https://roadtrip-roulette.pages.dev (root · /demo · /fully)** — first deploy since
2026-07-31, so everything below is now live in the demo.  Tests 546 green, `vite build` clean.

- **Road texture camera-scroll fix (the "texture missing on half the road" bug).**  RoadPlane and
  GroundPlane use custom WebGL pipelines that apply only `camera.matrix` — camera SCROLL is a
  per-object factor Phaser applies in each object's renderer, so both planes drew HUD_OFFSET_X px
  left of every scrollFactor-1 Graphics.  On the road tile that uncovered a flat band down the
  right side of every carriageway, sized by device aspect (~70 px on a 940 canvas, wider on
  phones); the ground tile had carried the same bug invisibly since it was written (seamless grass
  has no reference edges).  Both pipelines now subtract `camera.scrollX/Y` before the matrix.
  Diagnosed by column-scan + live-geometry probe after two wrong theories (distance fade, ghost
  pass) — the giveaway was the band's constant width and device-dependence.
- **Bridge lane markings (two independent causes, both fixed).**  (1) A dash spans 3 segments; on
  long flat sightlines ~5 segments collapse into one pixel row (relZ ~75k), so per-segment dash
  slivers went sub-pixel VERTICALLY and vanished while the every-segment double-yellow survived.
  Dashes are now emitted as ONE quad spanning the dash's full world length (16-slot far-boundary
  ring cache in the far→near render loop; crest-culled fallback degrades to per-segment).  (2)
  `paintFade` blended paint 62% toward pavement starting at relZ 5000 — retuned to a two-term
  curve: ≤14% atmospheric blend through ~90% of the visible road (`PAINT_BASE_MAX`, owner-tuned
  down from 25% after on-device review), full dissolve only past `PAINT_KNEE` 0.90; dash width
  floored at 0.55 px.  Validated on the West Seattle + Lake Washington decks.
- **Black horizon line on bridges** was a genuinely unpainted 3-px gap (pure 0x000000, ~450 px
  wide) — the water/bridge branch of Road.render never had the land branch's fail-safe world
  fill.  One opaque haze-toned backstop under everything that branch draws makes the gap
  structurally impossible.
- **Double-vision ghost no longer repaints the road.**  ghostGfx (1.55) sits above the asphalt
  texture (1.42) and road (1.5); its untextured 62%-alpha carriageway repaint erased the aggregate
  whenever drowsiness/Sushi kicked in.  The ghost now draws markings/edges/sprites only.
- **Fog lights rebuilt as a BEAM (owner-directed, many iterations).**  The 2026-07-22 global
  50%-thinning is GONE — fog is full density with or without the upgrade (`setFogClarity(1)`
  always; note this also removed the upgrade's hidden see-sprites-sooner benefit).  The upgrade
  now clears a headlight-shaped fan in the EffectsSystem haze: apex at the car's nose (top third
  of the sprite, computed from origin/height), symmetric on the car's own x (NO road-sample lean
  — that read as off-axis), widening 42→150 px half-width, clearing 65% of haze alpha
  (`BEAM_CLEAR 0.35`), far end anchored to the road surface's projected height (`sampleSurface`
  sy only) so the fan keeps one apparent pitch over crests/climbs, extending to just below the
  horizon with a graduated dissolve (full strength through ~half the reach).  Knobs live in one
  block in EffectsSystem.js: hwNear/hwFar, BEAM_CLEAR, fade span 0.48, throw 55000.
- **Road-paint art pass**: centre yellow desaturated/darkened (0x988949/0x776C40), dashes ~20%
  thinner + warmer grey (0xD2CCBE), subtle road-crown gradient bounded by each segment's own
  projection, guardrail reflectors every ~9 segments with per-cell jitter (was uniform %6).
- **Storefronts**: item column starts at y=98 so the survival bars (y 44–92) are never covered
  (garages FAP/Les Schwasted keep their own layout); bottom band reclaimed (84→52) so the list is
  taller.  NEW purchase-confirm popup — "You'd like a(n) X?" YES/NO — wraps the commit half of
  every buy; guards (afford/disabled/customers-only) still run first and never open a popup.
- **Vehicle sizing**: width pin refined to 78±2 by art aspect (≥0.86 → 80 px for the tall mud
  truck, ≤0.72 → 76 px for low sleek cars); height ALWAYS follows the art's aspect — runtime
  verified scaleY/scaleX = 1.0, nothing is flattened.
- **Default car is the hip-hop/phonk starter** (`DEFAULT_GENRE` in constants.js) — every genre
  fallback (boot art, `__genre.get`, plate-switch revert, dealership self-heal ownership) resolves
  to phonk instead of base-beater art.  An explicit country pick still gets the mud truck.
- **`npm run deploy` REWIRED to RTR** — it was still the DUI fork's script deploying `dist` to the
  DUI Pages project (would have overwritten the DUI game).  It now runs the Chapter-2 manual path:
  build-demo.sh + build-fully.sh + `wrangler pages deploy website --project-name
  roadtrip-roulette`, creds from local `.cloudflare.env` or `../DUI/.cloudflare.env`.  Verified
  end-to-end.  (Superseded 2026-08-10: CI is no longer clobber-wired — it deploys `website/` now. The token is still dead, so pushing still does not deploy; see Chapter 2.)


### 2026-08-04 — Rest-stop dialogue rewrite: every conversation in the owner's voice · all 62 town facts web-verified
**Shipped in `4a5e4eb`**, together with the 2026-08-05 conversation pass above — see the warning
there about that commit's misleading title. Tests at time of writing: chase 50, coal 25, missions
256, genreTraits 179, dose 37, upgrades 3 — all green. `validateEncounterTrees()` clean.
`vite build` clean.

**The brief.** Owner rewrote nine encounter NPCs by hand (Street Weirdo, Chain Guy, Ski Bum,
Long-Haul Mike, Farm Worker, Startup Founder, Hitchhiker, Park Ranger, Diner Waitress) and asked for
that style applied to everything else at a rest stop: *"the others were lame and the facts weren't
unique or even facts at times."*

**The style, made explicit.** Three things separate the new voice from the old:
1. **Choice labels are what the PLAYER says**, in quotes, in the player's own voice, often rhyming
   back at the NPC — not terse menu verbs. `"Ask about the pass"` → `"Any idea what the weather is
   doing up at the pass?"`. The old labels made every conversation read as a vending machine.
2. **Every choice earns a response.** No branch dead-ends in silence any more, including the polite
   exits — the "no thanks" option is now where a lot of the best jokes live.
3. **Facts are real.** Specific, checkable, and preferring the strange true thing over the tidy
   summary.

**Two structural discoveries that had to be fixed first.**
- *The facts nobody could see.* `_showEncounterCard` resolves `this._townFact ?? node.fact ?? enc.fact`,
  and all 18 stops have entries in `townFacts.js` — so **every `fact:` written on an encounter card was
  unreachable**. The real fact surface is `townFacts.js`, and that is where the weak lines lived
  ("Snoqualmie Pass weather can change fast", "Thorp is little more than a fruit stand" — neither is a
  fact). All 62 facts were rewritten and **web-verified individually** against HistoryLink, city/park
  sources, and the relevant museums. Card `fact:` fields are kept as the documented fallback and held
  in sync.
- *Buttons that couldn't hold a sentence.* Choice buttons were fixed-height slabs (`t.bh`), and the
  type-tier fitter measured the dialogue, the fact and the deal panel but **never the labels** — a
  wrapped two-line label spilled straight out of its box. Buttons now size to their wrapped label
  (`measureChoiceHeights`, `chHeights`), and that height feeds the tier fitter, so a tall choice stack
  correctly pushes the type down a tier instead of overflowing.

**Content rewritten.**
- **14 encounter cards.** The owner's 9 applied verbatim (text *and* the new economy — see below),
  plus the 5 that had never been touched: Roadside Grandma (Hatton), Tow Driver (Washtucna),
  Shade-Tree Mechanic (Ellensburg alt), Lemonade Kids (Othello alt), Swimsuit Girl (Thorp).
- **11 shop greeters.** All 11 shared one verbatim line — `"Welcome in! What can I help you with?"`,
  the single most-repeated string in the game. Each brand now gets one couplet in its own voice.
  Filler in *function* (once-only, terminal, zero mechanics) is not the same as filler in *voice*;
  the three player choices stay shared so the action reads identically at every counter.
- **Mission contacts** (5 tiers incl. the failure ack) and **7 passenger quirk sets** (ask / pickup /
  mid-route / drop-off).
- **33 crowd-chatter lines.** Deliberately NOT rhyming — the couplets belong to NPCs you actually
  talk to; chatter is half a conversation you walk past. Each line is now either a joke or
  information; the ones that were neither were cut.

**Economy changes carried in from the owner's sheet** (his costs, applied as given): chains
$80 → **$150** (haggle $55 → **$120**), traffic app $60 → **$100** (+30s → **+90s**), Mike's fuel split
$30 → **$100**, farm gas can $40 → **$50**, diner $12 → **$40**, thermos +10s → **+100s**. Hitchhiker
payout 60% +$40 → **+$80**, and the 40% bad branch now still pays +$20 alongside the wanted star.

**One new effect verb.** `fullnessFloor` — raises Hunger *up to* a value and no-ops if already higher,
per the owner's note that the diner should set fullness to 60% "if lower, don't adjust if higher".
A flat `+16` wasted the whole $40 on a player who had just eaten. Implemented as
`raiseSurvivalTo(bar, target)` in `RestStopScene`, reading the entry snapshot plus everything banked
this visit so two meals in one stop can't double-count.

**Judgement calls flagged for the owner** (all reversible, all in one place):
- Chain Guy's haggle: his line says **$120** but the sheet's cost column still said $55 (unedited from
  the old file). Priced at **$120** to match what he says out loud.
- Two of his labels were written in the *seller's* voice ("You can pay full price here, or up there")
  — kept the words, moved them to his response, and put a player line on the button.
- Diner "I'll take the usual" → **"Who are you?"** was read as a *joke* (she doesn't remember you at
  all) rather than a placeholder, and given a rhyming turn: *"The usual," she repeats. "Who ARE you?"
  — then the plate lands hot, like she always knew.* Say the word if it was a placeholder.
- Two truncated labels completed: `"Here's a dollar, pal. I hope you…"` → `…spend it fair.` and
  `"Let me grab one of those thermoses…"` → `…off you.`
- `revealHazard` is **written but never read anywhere in the codebase** — the ids (`fog`, `rain`, new
  here) are pure flavor until something consumes them.

### 2026-08-04 — Garage rework: NOS re-buy exploit fixed · full tier ladders · two distinct garage lanes
**Shipped in `2bb8520`.** Tests: chase 50, coal 25, missions 256, genreTraits 179, dose 37, upgrades 3 — all green. `vite build` clean.

**The NOS re-buy bug (owner report).** The buy handler in `RestStopScene._makeButton` greyed a row
out after purchase for `refuel` / `repair` / `upgradeInstall` / genre cars but had **no case for
`vehicleAccessory`** — the payload NOS, the reinforced bumper and traction tyres all use. Those rows
stayed live for the whole visit. Worse than a cosmetic repeat: the NOS price was frozen at
scene-build time (`NOS_PRICES[_vNosTier]`) while `_applyPurchase` blind-incremented the tier, so
tapping "LV 1" three times bought **tier 3 for $15k instead of $30k**. Bumper/traction re-buys just
burned money for nothing. Fixed three ways — the row disables itself (`_markRowOwned`), each NOS row
names the exact tier it installs (`payload.nosTier`, applied with a `Math.max` ratchet), and NOS is
now three separate rows rather than one mutating "next tier" row.

**Full tier ladders in every category tab.** Each slot listed only its NEXT tier, so every tab held
exactly one row and the shop read as empty — the owner's actual complaint ("only 1 thing in each
part category"). All tiers now list together: `✓ owned` (inert, priced "OWNED"), `🔩` the one buyable
tier, `🔒 locked` (**still quotes its real price** so you can save toward it). Buying a rung flips it
to ✓ and unlocks the one below it *in place* via `_unlockTier`, so Lv1→Lv2 in one visit works.
- Replaces the 2026-07-28 fade-the-row-out receipt: that made sense when only the next tier showed,
  but in a ladder it left a hole between `✓ Lv1` and `🔒 Lv3`. Rows stay put and flip state.
- `_makeButton` gained two optional item fields — `showCost` (a disabled row still prints its price)
  and `disabledCostText` ("OWNED") — plus `item._ui`, the row's text handles, so a purchase can
  retitle the row *below* it.
- **Untabbed slots (body, police) are deliberately exempt** and keep next-tier-only. They render as
  uncategorized SERVICES, which `_selectGarageCategory` pins above the parts on *every* tab —
  laddering them would stack 6 permanent rows over whatever tab you opened. They get ladders when
  the toolbar art grows BODY / POLICE tabs (see below).

**Two garages, two lanes** (`SHOP_CATEGORIES`). Finesse stocked all seven categories while Les
Schwasted stocked three of the same ones — Schwasted was a strict *subset*, so there was no reason
to ever stop there except the free popcorn. Now zero overlap:
- **Les Schwasted** — tyres, brakes, suspension (+ traction tyres). Cheap, common.
- **Finesse (FAP)** — engine (**NOS moved here**, `category: 'engine'`, same trick traction uses to
  sit under TIRES), fuel, coolant, wipers/lights/windshield, plus the untabbed body/police slots and
  repair/paint/bumper. Expensive, rare.
- **Sam's** unchanged: entry-tier windshield/headlights/wipers/bumper, no tabs.
- Coverage check across the 19 stops: Schwasted at 10, Finesse at 9, both at 4, neither at 4 — no
  slot becomes unbuyable over a full run.

**Still art-blocked.** `assets/ui/garage_upgrade_toolbar.png` is ONE 1672×220 strip sliced into
seven equal columns *by index*, so BODY and NITRO tabs cannot be added in code alone — the strip has
to be re-cut to nine columns first. That constraint is why NOS went under ENGINE and body stayed a
Finesse service.

### 2026-08-04 — Chase realism pass · near-field cop projection · skyline/tunnel layering · weapon-exit tuning · challenge-mission crash
**Shipped in `4a5e4eb`** (swept into `4a5e4eb` — see the attribution note at the top of the changelog). Tests: chase **50** (13 new), coal 25, missions 256, genreTraits 179, vices 26, upgrades 3 — all green.

**Chase rebuilt around the owner's model of a real pursuit** (`CopSystem.js`). Aggression is now
star-scaled instead of uniform:
- **1★ is a TAIL** — the lone cruiser closes, holds station, and **never strikes**. Drive clean and
  it follows indefinitely; shake it with the existing 1.5-mi escape.
- **Backup calls** — a pursuer within `EYES_ON_FT` (1000 ft) *witnesses* erratic driving and radios
  it in: **+1 whole star, capped at 3★** (weapons stay the only path to 4-5★). Triggers: a civilian
  collision (instant, hooked in `_applyDamage`), or ~2 s sustained at 90+ mph / across the
  double-yellow. 15 s cooldown, and the reinforcement spawn is forced so backup visibly arrives.
  Owner chose **erratic-acts-only** over a timer — you can be tailed forever if you behave.
- **Strikes begin at 2★**, cadence by tier (2★ holds 5 s / rams every ~5-8.5 s; 3★ holds 2.5 s /
  every ~3.5-5.7 s). **PIT gate moved 4★ → 2★** (owner call): an alongside rear-quarter tap is a
  pursuit manoeuvre, exempt from the no-lead rule — *blocking/overtaking* still needs
  `MIN_STARS_AHEAD` 4. Reachable only mid-lunge, so a 1★ tail can never arm one.
- **One striker at a time** — units rotate attacks instead of mobbing the bumper.
- **Wanted decay PAUSES while a cop has eyes on you.** You can't wait out a star mid-chase.
- **Formation lanes** — every guarded unit clamped at the same depth *and* converged on the
  player's lane, stacking three cruisers into one sprite. Now the primary tracks your bumper and
  wingmen hold flanking slots (±0.42, ±0.8): "if 3 police are chasing, show 3 full police cars."
- **Reaction lag (1.5-4 s, per unit)** — owner: *"I can speed up or slow down and the cops don't
  seem to lose or gain 1 ft."* `CopSystem` keeps a 4.5 s history of player speed; every
  throttle-following decision reads it **lagged**. Three places had made the gap rigid — the
  closing rate, GUARD 1's ceiling, and the real culprit, **the station clamp, which re-synced the
  cop to the player's exact throttle every frame it touched**. Deliberately NOT lagged: position
  math (the cop can *see* you), the anti-pass clamp (owner law), and a committed lunge (drives off
  live speed so strikes land when you're accelerating).

**Near-field cop projection — "cops sit on the player"** (`GameScene._nearSynthProj`).
`getVehicleProjection` returns nothing usable below ~4400 units from the camera, and a pursuit cop
lives at **2100-3000** — *all* of its life is under the floor, so it drew at the player's own
screen height, beside the car. Now the projection is clamped at the floor and extrapolated down
with real perspective: width ∝ 1/distance, lateral offset scaled to match, seat-Y fitted through
two known-good anchors (the floor projection and the player's own seat at `PLAYER_VIRTUAL_Z`).
The cruiser seats **bigger and lower**, tucked behind the bumper, growing as it lunges.
- **Owner chose cop-over-player** (depth 9.96-9.98, world-z gated) over the standing no-crossover
  rule — it is between the camera and your car, so perspective says it overlaps you. Civilian
  traffic ahead still paints under 9.95. Light bars got their own layer at 9.985.
- **Flee continuity** — owner: *"the cop jumps on the player's car when I select rolling coal."*
  Every flee path (coal / donut / fireworks) now keeps the **same** synthetic seat; flipping to the
  raw below-floor projection on the frame a weapon landed was teleporting the cruiser onto the
  player. No sudden movement on deploy — it recedes from exactly where it stood.
- Removed the stale `[depthdbg2]` TEMP console probe (its bug was fixed weeks ago).

**Weapon exits retuned** (owner 2026-08-04): **donuts 3× faster** (keep-pace 0.8 → 0.4, so the
diverted cruiser clears screen in a third of the time) and **rolling coal 3× slower** (0.45 → 0.82)
**plus a spin-out**: the smoked cop's sprite flashes rear↔front at ~2.8 flips/s — the same trick
crashed traffic uses — reading as a car spinning out in the smoke. This supersedes the 2026-07-21
"donut flees ease back GENTLY" call.

**Layering fixes.**
- **City silhouette vs. the road** (`Road.js`) — the layer paints at depth 6.9, necessarily above
  `roadGfx` (1.5), so wherever pavement rose above the flat horizon line it stamped over the
  roadway. The projection pass now builds a per-8px-column **road-top map**, read one frame stale
  by the painter (invisible at horizon distance) to clip hills, blocks and window dots. Ground/water
  rows span the full screen width, so a risen row clips **every** column — that's the floating-bridge
  "buildings on the water" case the owner caught after the first pass.
- **Skyline pop at the tunnel approach** — it was a hard on/off switch (`_upcomingTunnelClose`),
  visible as silhouettes present at 6.78 mi and gone at 6.80. Replaced with `_citySilFade`, a
  distance-driven alpha on the whole layer, dissolving over the same ~600-segment stretch where the
  real embankment hill grows in.
- **Tunnel walls vs. pickups** — the wall shell (9.82) swallowed on-road pickups (max 9.5). Pickups
  now get the same in-tunnel lift cars have (9.83, halos 9.825) **but run the wall-occlusion test
  first**, so a pickup around the bend stays hidden. Owner's rule: *"walls not seen through, but
  don't cover images that should be visible."*

**PURSUIT chevron** now hides once the cruiser is actually on screen (car-rel −1500, where the
forward view starts drawing it) — it only tracks pursuit you can't see yet.

**Crash fix — challenge missions had no destination.** Owner hit
`TypeError: Cannot read properties of null (reading 'toUpperCase')` in `_drawMissionChip` mid-drive.
Challenges are built with `targetName`/`targetMile` **null by design**, but three call sites assumed
every job has a destination: the HUD chip (crashed the whole HUD update), the rest-stop JOBS list
(printed `null · NaN MI`), and the accept popup ("Job taken — 3 fireworks to **null**"). All three
now branch on `targetName == null` → `🎯 NAME · $PAY`, and null distance sorts as ∞ so a real
delivery always wins the chip over a dare. **This is very likely the unreproduced "crash just
before mile 3" from the 2026-07-31 session.**

**Two pre-existing flaky tests hardened** (surfaced, not caused, by this work): the 5★ token check
now measures max-over-time (also the stronger pool guarantee) rather than a single end frame; the
3★ clamp sweep now filters to rear pursuers — 3★ star-spawns roll ~45% oncoming, which is ahead
*by design*, making that assertion a coin flip. Also fixed an unbounded `do/while` in the barricade
gap picker that the decay-pause change exposed (it never terminated with `Math.random` pinned).

### 2026-08-04 (pt 3) — Shopping signs move in-engine (and stop lying about what's at the stop)
Committed. Tests 737 green, build clean. Verified in-engine by screenshotting composed signs.

**Why the signs were deleted.** Owner deleted all 19 `sign_*.png` because most looked broken —
and they were, in two ways. `scripts/buildShoppingSigns.js` drew a fixed 2×3 grid of six white
plaques and filled only as many as the stop had businesses, so a 3-shop stop shipped with three
empty white boxes. Worse, the script carried its **own inline copy of the rest-stop list**, that
copy had gone stale, and the signs were advertising the wrong businesses — Mercer Island's sign
offered camping while the live stop sells Gas-N-Sip / Lord Motors / Park & Ride. The script also
couldn't be re-run at all: its blank template and logo art lived in `Archive/Images/`, which is
gitignored and no longer exists.

**Now composed at runtime** (`src/data/shoppingSign.js`, `ensureStopSign`). Each stop's placard is
built into a RenderTexture on first sight, from `REST_STOPS` + the `biz_*` logo textures the game
already loads for the rest-stop landing placards, and saved under the same `sign_<id>` key the
renderer always used. **The drift bug is now structurally impossible** — there is no baked artifact
that can disagree with the data. 19 baked PNGs (2.4 MB) → 2 shipped inputs (~30 KB):
`sign_blank.png` (border + header + flat blue) and `sign_plaque.png` (one empty slot with its
bevel), both extracted from the original authored art so the blue (`rgb 27,47,180`), header
typography and plaque bevel are unchanged. VRAM is a wash — 19 composed textures cost what 19
loaded PNGs did — and they're lazy, so only the stops a run reaches are paid for.

**Logo sizing** (owner: "the logos look smaller than I'd like"). Two causes, both fixed:
- **Aspect mismatch.** Most brand logos are WIDE — FAP 3.3:1, Les Schwasted 3.0:1 — against a
  1.37:1 plaque, so width binds first and a uniform pad wasted horizontal room while leaving
  vertical dead space. Padding is now asymmetric (5% x, 10% y): wide logos run nearly edge to edge,
  near-square ones like Huff's stay clear of the rounded corners. Les Schwasted went 26% → 36% of
  its plaque, FAP 24% → 34%, AOK 35% → 49%.
- **Plaques grew 20%.** Slot centres stay put so the grid still reads as the authored layout; the
  plaques grow into the gutters, which drop from ~61×50 px to ~25×24 px.

**`LOGO_BBOX`.** Several logo PNGs carry heavy transparent padding (park-and-ride 283×129, FAP
197×126). The baked pipeline got this for free from sharp's `trim()`; in-engine it has to be
measured, so the opaque box of each logo is a generated table — same pattern as `ENDING_CAR_BBOX`.
Without it those logos would render visibly smaller than the rest and off-centre.

Deleted: the 19 baked PNGs, `scripts/buildShoppingSigns.js`, the `build:signs` npm script, the
now-dead `signKey` sprite field and the `STOPS_WITHOUT_BAKED_SIGN` gate (there is no longer such a
thing as a stop whose art hasn't been baked).

### 2026-08-04 (pt 2) — Ending plates: genre-car endings, and OUT OF GAS becomes a decision
**Shipped in `4a5e4eb`** (swept into `4a5e4eb` — see the attribution note at the top of the changelog) — `src/data/endingArt.js` new, plus `GameOverScene.js`, `GameScene.js`, `constants.js`.
Tests 550 green, build clean. BUSTED / CRASHED / PASSED OUT / DEMO / Pullman verified in-engine
by screenshot; the OUT OF GAS card is build-verified only and still needs a playtest.

**Which run-enders had no ending card (the audit that started this).** BUSTED (arrest *and* a cop
landing the killing blow), CRASHED (HP 0 non-cop) and PASSED OUT (vice OD or asleep at the wheel)
all had art already. Missing: **out of gas** — which turned out not to end the run at all, just a
2.2 s toast then an automatic tow; **`busted_late`** (TOO LATE + 5★, `GameScene.js` ~5161) which
ends the run but goes straight to the checkpoint-restart modal with no card *(still open)*; and
the **Pullman finish** + **demo complete**, both `image: null` — every way to lose looked better
than winning.

**New art pipeline** (`src/data/endingArt.js`). Six photographic 800×450 plates — exactly the game
canvas, so plate coordinates are 1:1 with screen space — each with the player's **genre car**
composited on top, matching whatever they were driving when the run ended (`window.__genre.get()`).
Two views per genre: `_rear3q` parked, `_rear3q_crashed` wrecked-and-smoking (CRASHED only).

- **Cars are placed by their TRIMMED content box, not their frame.** All 30 PNGs are 560×400, but
  the vehicle inside isn't: a classic-rock coupe trims to 472×217, a metal van to 453×339, with
  different padding again. Scaling the raw frame floats or sinks cars at random. `ENDING_CAR_BBOX`
  (generated from the art — regen command is in the file header) holds every trimmed box, and each
  plate anchors the car by its wheels' contact point.
- **Anchors** (x, y = contact point; w = on-plate car width), set by compositing the real art
  offline and eyeballing each ground plane: busted 360/268/300 · crashed 450/262/300 ·
  passed_out 300/330/330 · out_of_gas 330/300/300 · demo 250/414/292 · pullman 112/318/145
  (left comic panel, x 8-262, so it stays small).
- **Loaded on demand, not at boot.** Six plates is ~3.5 MB of art seen once per run; the plate and
  its one car (~850 KB) are fetched when the ending appears and faded in. If the plate fails to
  load, the old baked-webp builders still run — an ending that never draws would strand the player.
- **The new plates carry no typography or button faces**, unlike the old baked webp art whose
  headline AND button faces were painted in with invisible hit zones traced over them. So headline,
  stats and buttons are now drawn for real, over a bottom gradient scrim (`_buildPlateUI`).

**OUT OF GAS is a decision, not an automatic tow** (owner 2026-08-04). Running dry now opens the
plate with three choices: **TOW — $1,500** (flat fee, back to the last rest stop, tank full, run
continues), **START OVER**, **LOAD SAVE** (reuses `_titleLoadSave`). Can't afford the tow → the
button greys out reading `NEED $340 MORE` and the only ways out are start over or load. The old
rule is gone entirely: 50% of cash (which punished a rich run far harder than a broke one for the
same mistake), the repo-to-Beater, and the free-tow-if-broke mercy case. `TOW_COST_USD` in
`constants.js` is the knob.

**Known rough edges, pending a look:** the Pullman comic's stats and button land over the middle
(stage) panel, which is the busiest one; and the demo van's wheels sit behind the bottom button
row. Both are anchor/layout numbers, not structure.

### 2026-08-03 (pt 2) — Rest-stop menus: one tap was firing on two screens
**Shipped in `e35f9bf`** (`RestStopScene.js`). Tests 550 green, build clean — no test covers scene input, so
this is a playtest-verified fix, not a test-verified one.

Owner: "if I click an option it often times also clicks the next screen behind that option."
**Two separate causes, both real:**

1. **Down/up straddle.** The menus mix event types *by design* — placards, dealer cards and dialog
   choices act on pointer**DOWN**; shop buy buttons act on pointer**UP** (2026-07-29, so a scroll
   swipe can't buy what sits under the finger at the start of the drag). So one tap on a business
   tile fired DOWN → the shop screen built instantly → that same tap's UP landed on whatever buy
   button the new screen had just placed under the finger. Instant unwanted purchase.
2. **The scrims never blocked anything.** `_showEncounterCard`'s full-screen scrim was commented
   "eats clicks to the shop underneath" — it did not. `setInteractive()` alone doesn't stop Phaser;
   Phaser dispatches to *every* interactive object under the pointer, depth-sorted. The existing
   `pointer.event.stopPropagation()` calls stop the **DOM** event, which is unrelated to Phaser's
   own dispatch — that takes Phaser's event object, the **4th arg** of a game-object handler.
   So a tap on a dialog choice also hit the shop button behind the dialog.

**The fix** — three small helpers on the scene, `MENU_GATE_MS = 300`:
- `_eatTap(ptr, ev)` — stops the tap in the DOM *and* in Phaser (`ev.stopPropagation()`).
- `_gateTaps(ms)` — called on every screen swap and popup open/close. Locks menu input for 300 ms
  and, if the finger is still down, records `pointer.downTime` so the arriving screen refuses that
  press's release. Keyed on `downTime` (unique per press) so it self-clears and doesn't depend on
  Phaser's handler ordering.
- `_tapBlocked(ptr)` — guard at the top of every menu handler.
- `_swallowTaps(obj, onTap)` — makes a scrim genuinely eat both halves of a tap.

Wired into `_showLanding` / `_showDealerChooser` / `_showSection` (so `_popScreen` is covered),
the landing tiles, dealer chooser, garage tabs, mission-collect rows, BACK, HIT THE ROAD, the buy
button's pointerup, encounter-card choices, leave-confirm, `_drainMenuPopup` and the payoff banner.
300 ms was chosen over the owner's suggested 1 s: the straddle is now impossible by construction,
so the timer only has to cover double-taps — one constant to raise if a ghost click ever survives.

### 2026-08-03 — Caffeine/energy speed bonuses were never firing · coffee+energy flat on/off · all OD terminology purged · dead-code audit
Committed as `f4d340d` (flat caffeine) and the follow-up OD/live-path commit. Tests 546 green, build clean.

**The bonuses were wired to code the game never runs.** Owner: "I've been consuming caffeine
and not noticing increase in speed." The mechanism was fine — it just never executed.
`getCaffeineSpeedBonusMPH()` / `getEnergySpeedBonusMPH()` read dose ledgers that only
`ViceSystem.pickup()` fills, and **`pickup()` has had no production caller since vice pickups
moved to the survival model** (`GameScene._onCollect` → `survival.applyItem`). Proved it by
instrumenting the live path: it ran (Tiredness moved), `pickup()` was called zero times, bonus
stayed 0. Two prior tuning passes (2026-07-31 +2 mph, 2026-08-03 flat-no-fade) were both
editing dead code. **Verification lesson:** those passes "verified" by calling
`vices.pickup()` directly from Playwright — the one path the game doesn't use. Always drive
the real entry point (`_onCollect`), not the system method underneath it.
Fixed with `noteCaffeinePickup()` / `noteEnergyPickup()` on their own dose ledgers (the coffee
pattern), called from `_onCollect`. Verified end-to-end: 1 pill 94→96.8 mph, 4 pills + a shot
→ 108.8, holding flat.

**Coffee and energy are now ON or OFF, never fading** (owner rule), matching caffeine's flat
+2/cap-20 from earlier the same day. Coffee was the only one of the three that already worked,
since it comes through the rest-stop purchase channel rather than road pickups.

**"There are no OD's in the game — this isn't DUI."** Swept all 77 overdose references to 0.
Player-facing text already read "PASSED OUT"; the DUI vocabulary survived in internals:
`canOD`→`canPassOut`, `odThreshold`→`passOutThreshold`, `checkOD`→`checkPassOut`,
`_onOverdose`→`_onPassOut`, end-cause `'overdose'`→`'passed_out'`, `noOD`→`noPassOut`,
`onlyODVices`→`onlyPassOutVices`, tracker `.odd`→`.passedOut`, asset key **and file**
`end_overdose_neon.webp`→`end_passed_out_neon.webp` (re-verified HTTP 200 + texture loads at
boot), plus ~35 comment/prose fixes. The retired pass-out branch was dropped from `pickup()`'s
return.

**Dead-code audit → new [Chapter 12](#chapter-12--dead-code-inventory).** The finding above
prompted a full sweep. Headlines: `src/cops/` (4 files, ~800 lines) and `src/car/CarPhysics.js`
are never imported; `src/road/Road 2.js` (4,458 lines) is **back** after being deleted in
`bf00890` and is untracked; the whole vice-bar layer is stranded by the survival migration
(and `tests/vices.test.mjs` largely tests it); ~40 dead methods incl. `_maxSpeedWithBoost`
(which was still being maintained — it got a `coffeeBonus` term on 08-01 that can never run);
3 dead constants; 9 dead asset keys costing boot bandwidth; and a `refuelMi` payload flag that
does nothing. Nothing deleted yet — Ch.12 has the inventory and a suggested order of work.

### 2026-08-01 → 08-03 — Speed-rules overhaul: F5 debugger, zero drug references, 160 mph hard cap, car ladder retune, overheat-at-full-gauge
Committed as `77bbb3c`/`4045172`/`ebdc853`/`6338154`/`558fb09`/`b8b8e50`/`2debf87`/`bf00890` (07-31),
`17e2714` (08-01), `dfc24db` (08-02), `2c818f2` (08-03). All tests + build green at each commit.

**F5 speed debugger (dev mode).** New overlay showing the exact per-frame speed math:
cur/target mph, cruise/boost bases, every flat mph bonus one decimal each, speedMult with
per-vice breakdown, grade, engine temp, and a `⛔CAP 160` flag when the limiter is pinning
the target. `_updatePlayer` stashes the raw numbers into `this._speedDbg` every frame (the
overlay only formats — it can never drift from what actually drove the car). Built to answer
the owner's "top speed jumped 150→177 and nothing was picked up" — which turned out to be
EffectsSystem's invisible ×1.55 energy-bar multiplier (since removed, see below).

**ZERO drug references (owner directive — standing rule).** All drug-era terminology purged
from the codebase: identifiers, comments, dialogue, achievement keys. `alc/weed/shrooms/lsd/
hero/fent/ket/rx` locals → `sushi/burrito/gummies/hotdog/combo/coma/slushie/coldbrew` across
EffectsSystem, ViceSystem, AudioSystem, Road.js, constants, GameScene (~200+ renames);
`alcoholHoldover`→`sushiHoldover`, `shroomPhase`→`gummiesPhase` (cross-file contract — the
rename exposed and fixed a real bug where GameScene still wrote the old key and Road.js read 0
every frame). Dead `maxed_heroin`-family achievement keys renamed (confirmed never awarded —
no save risk). Deliberately UNCHANGED: `'permastoned'` achievement key and `methPhase1`/
`cocainePeak` fallbacks in `hydrateProgress()` (persisted save-schema ids; renaming silently
drops player progress). GameScene has ~100 more scattered references in mission/encounter/UI
text NOT yet swept — needs its own pass; blanket sed is unsafe there (`weed` = tumbleweed
props, `rx` = rect-x layout vars).

**Consumable speed bonuses — final owner rules, all dose-based, all visible in F5:**
- Caffeine pill: **+2 mph each, cap +20, FLAT for the pill's entire 60 s** then off (`f4d340d`
  08-03; the original fading version averaged +1/pill and the owner couldn't feel it —
  "I've been consuming caffeine and not noticing increase in speed").
- Coffee (rest-stop item): **+1 mph per cup, cap +10, fades over 30 s** — the old
  `coffee: true` payload flag was completely dead; now counted in `_applyPurchase` →
  `coffeeCount` → `ViceSystem.noteCoffeePurchase()` on resume (clocks start when you're
  back on the road, not while browsing the shop).
- Energy shot: **a SINGLE +4 mph fading over 30 s — never stacks.** A new shot RESTARTS the
  clock. Replaced the unbounded `energyPickupCount × 4 × bar` formula AND deleted the ×1.55
  energy speedMult in EffectsSystem (same shot counted twice; the multiplier was the mystery
  speed climb). Speedball combo (energy+combo) keeps its post-clamp speedMult kick as that
  combo's identity — the 160 cap contains it.

**160 mph hard cap + car ladder retune (owner: "game gets hard past 140").**
`SPEED_CAP_MPH = 160` clamps the FINAL target speed after every bonus and multiplier —
nothing escapes it, and >160 is reserved as a deliberate future punishment mechanic (lift the
clamp on purpose, never by accident). All 10 genre cars shifted down keeping their spread:
EDM 165→150, Classic Rock 150→140, K-Pop 145→135, Hip-Hop 140→130, Reggaeton 135→126,
Norteño 130→122, Pop-Punk 125→117, Country 120→112, Metal 110→104, Reggae 100→95; cruise
moved with each car's gap; plain beater boost 130→120 (`topMph` 110→100). EDM+ECU = 165 raw
rides the limiter at 160 — the only car that can touch the cap on hardware alone. Verified
live headless: forced +300 mph of bonuses → target pins at exactly 160.0, `capped` flag set.

**Engine never limps until the temp gauge reads FULL (owner 2026-08-03).**
`ENGINE_LIMP_TEMP` 92→105, `ENGINE_LIMP_CLEAR` 78→90 (~15° hysteresis kept). The HUD bar's
scale is now DERIVED from `ENGINE_LIMP_TEMP` (fill hits 100% exactly at the limp trigger)
instead of the hardcoded /85 that topped out at 115° while limp fired at 92° — i.e.
"OVERHEATING" with a quarter of the bar empty. Balance effect: flat-ground flooring in the
cool west (heat target ≈85°) can no longer limp at all; overheating now requires the eastern
desert and/or a sustained climb while flogging it. Warn (`ENGINE_WARN_TEMP` 80) unchanged =
~⅔ of the new bar. Verified live: no limp ≤100°, engages ≥105°, holds to 90°, clears below.

**Tests:** vices.test.mjs grew to 31 (energy no-stack/restart/fade, caffeine 2 mph + 20 cap,
coffee 1 mph + 10 cap + 30 s fade); genreTraits.test.mjs speed tables updated to the new
ladder (179 green).

**⚠ Two-session workflow note.** This session ran in parallel with the cop-chase-realism
session in the same working tree. GameScene.js commits used the surgical
`git hash-object`/`update-index` technique to commit ONLY this session's hunks. One near-miss
to not repeat: a `git stash push --keep-index` probe silently swept BOTH sessions' uncommitted
work into a stash; `git stash pop` restored everything intact — never stash in this tree while
the other session is live.
Local + test-passing (515) + builds clean. Uncommitted.

**Missions were unreachable in Custom — the one mode they get playtested in.** Owner reported
"no offers or missions were generated"; the storefront staffer greeted and the shop opened, but
no work was ever pitched. Three INDEPENDENT gates were switching it off:
`_pendingMissionCard = Difficulty.noScore() !== true` (RestStopScene), the `_readyJobs` drop-off
list, and the pull-in `gradeArrivals` block in GameScene. All three now run in every mode.

Progression is withheld instead of content: `MissionSystem._sandbox()` (true when
`Difficulty.noScore()`) makes `_bumpRep` / `_bumpStat` no-ops, so a sandbox run can complete and
be PAID but can never inflate `missionRep` / `missionStats` / tier. Tested both directions —
Custom banks neither, Normal still banks both, and a road-paid CHALLENGE obeys the same rule.
**NPC contact memory is deliberately still written in Custom**: it is flavour, not progression,
and a contact who forgets you mid-sandbox reads as a bug.

**Shop menu-column scrim is now FAP-only.** `_shopScrim` is a dark rect over the left third at
FULL screen height, but the menu column stops `bottomBand` (84 px) short of the bottom — so its
tail showed as a bare black block under the last row in every storefront ("it's covering some of
the menu"). Gated to `chromeKey === 'fap'`, which keeps the dark bed its 7-tab toolbar needs.
Watch for legibility on the brightest daylight storefronts now that the bed is gone elsewhere.

**Crash hunt — NOT reproduced.** Owner hit a repeatable crash approaching mile 3 in Custom while
warping to Seattle. Built a headless repro (`tmp/repro.mjs`, playwright-core, drives
`window.__phaserGame` directly): Custom mode → warp → drive through mile 3.3 → `_takeRestStopExit`
→ RestStop opens, zero JS errors, twice. Two things learned worth keeping:
- **The windshield tip AMBUSHES a warp.** Warping past mile 0.25 fires it immediately, and it
  sets `_paused = true` and waits for a tap. Frozen car, frozen HUD — indistinguishable from a
  hang if the tap doesn't land. Strong candidate for what "kept crashing" actually was. NOT yet
  gated (owner hasn't picked a fix); the obvious ones are "never within N seconds of a warp" and
  "never in Custom".
- **`main.js` already paints a full-screen crash overlay** with message + stack for any uncaught
  throw (see its `window.addEventListener('error')` block). If a crash recurs, that overlay IS
  the diagnostic — screenshot it rather than guessing. A black screen / "Aw, Snap" / self-reload
  instead means it is NOT a JS exception and points elsewhere.

**Two reported "bugs" that are working as built** (no change made): only some shops greet you
because `SHOP_GREETERS` entries are `once: true` — one per shop per SAVE, so previously-met shops
open straight to the menu; and the greeter DOES answer the road/weather question, with a canned
"Same as it's been — watch your speed" that ignores live conditions, so it reads as no answer.
Weather/heat/time-aware greeter dialogue is an unbuilt content pass.

**⚠ Parallel-session change to know about:** mission offers are now reachable ONLY through the
stop's mission shop (`_missionShopKeyFor` picks one amenity per stop deterministically →
`_showShopGreeter` → `_buildMissionEncounter`). The old automatic HIT THE ROAD exit pitch
(`_tryExitMissionCard`) was REMOVED per owner directive. Consequence for playtesting: if the
first shop you enter opens straight to its menu, that stop's contact is in a DIFFERENT shop.

### 2026-07-31 — Mercer Island approach: floating "building" silhouette fixed
Local, uncommitted.

**Owner report: "the image layering going into Mercer Island looks really bad — building
silhouettes showing over the roadway, trees floating on the tunnel."** Reproduced live by
scripting a headless Chromium against the running dev server (`playwright-core`, already a
devDependency): loaded the title screen, warped via `scene._warpToMile()` to mile 6.6-7.4
(the Lacey V. Murrow Bridge approach to the Mercer Island Lid Tunnel), froze the car
(`player.speed = 0`), and screenshotted. Confirmed a flat dark rectangle sitting disconnected
above the tan tunnel-embankment hill, matching the owner's screenshot almost exactly.

**Root cause: two independent "fake horizon" layers that don't know about each other.**
`Road.js` procedurally paints a generic downtown-skyline silhouette (random flat rectangles,
`_cityBack` block) across the FULL screen width for the whole "urban stretch" (mile 0–12.5),
completely independent of the road's curve/perspective. Separately, the real Mt Baker / Mercer
Island Lid Tunnel embankment hill (`_drawTunnelFacade`) IS curve- and perspective-correct, but
only covers a limited footprint around the tunnel mouth. Approaching a tunnel, both render at
once — generic skyline blocks land outside the real hill's silhouette (since they don't track
the curve) and read as buildings floating disconnected above/beside the actual hillside and
roadside trees. Ruled out the per-segment sprite pool and the biome parallax backdrop first by
instrumenting a live dump of `road.segments[].sprites` and `scene._sceneSpritePool` — neither
had anything near the screen position of the artifact, which is what pointed at the procedural
skyline block instead.

**Fix:** added a bounded lookahead in `Road.js` (`_upcomingTunnelClose`, peeking
`DRAW_DIST + 600` segments — the same window the embankment hill's own far-out projection
already uses) that switches the generic skyline off once a real tunnel embankment is close
enough to own that stretch of horizon. Verified live: mile 6.88 (the reported spot) now
clean; mile 1.66 (West Seattle, far from any tunnel) still shows the normal skyline — the
fix is scoped to tunnel proximity, not a global suppression; mile 4.72 (Mt Baker tunnel
approach, same underlying issue, not previously reported) also clean.

### 2026-07-31 — Tap-mode steering fix + unused-asset archive
Local + test-passing + builds clean. Committed as `422fc2d`, `8f240ff`.

**Tap steering snapped too fast side to side in the Vantage crosswind (owner report).**
Traced the wind-pull code and found it's a complete no-op in tap ("flappy") mode: tap's
steerIn is already pinned to full ±1 with no ramp before the wind's left-nudge ever runs,
so there's nothing left to nudge. The lateral-velocity settle rate for tap had been bumped
from classic's baseline of 8 up to 14 specifically to fix an earlier "feels sluggish
fighting the wind" complaint — but since wind never actually touched tap's steering to
begin with, that fix was chasing the wrong cause. It just made every tap-mode swing,
everywhere on the route (not just in wind), snap at ~1.75× the classic rate — most
noticeable in the wind zone specifically because that's where the player corrects almost
continuously, so every release is a full whiplash snap. Backed the settle rate off to 10
(`GameScene.js` — the `_baseSettle` constant near the lateral-velocity settle code) — still
snappier than classic/tilt (tap's whole identity), just less jarring. Owner may want it
tuned further after testing; the fix is a single constant.

**Archived 99 unused asset files (~153MB) out of `public/assets/` into `Archive/`** (already
gitignored, not pushed — moved rather than deleted so anything can be restored by path).
Cross-referenced every file on disk against actual usage: the manifest (imported directly
in Node via `flattenManifest()` so computed/templated paths — e.g. the biome-band template
literals — resolve correctly rather than being regex-guessed), the per-genre culture-art
system expanded across all 10 genres, literal paths in the handful of files that load
assets outside the manifest, and `index.html`'s own inline dynamic path construction
(phone-menu skins, business logos, music-genre icons). Checked candidates against
`website/sync-assets.sh` too so nothing the marketing site still uses got swept up.

Mostly one thing: a full superseded generation of North Bend / Cascades landmark /
Snoqualmie-spike scenery art from before the current biome system, left behind after the
rework instead of cleaned up — the single biggest chunk, and very likely why the earlier
demo/embed staleness investigation (2026-07-30) found the neon-grid missing-texture bug in
the first place. Also: the removed CarGo business's art, superseded storefront art
versions, "previous_police" car art (explicitly named as superseded), 7 of 8
`iphone_menu_bg_<vehicle>.png` variants (dead since the purchasable-vehicle system was
removed 2026-07-19), an orphaned JPG tutorial slideshow superseded by the current in-game
tutorial, and a stray VSCode `.code-workspace` file that had ended up inside the art
folder. Verified zero regressions: full test suite green, clean build, and a headless
Playwright pass driving actual gameplay across 4 genre switches with zero new
missing-texture warnings. Refreshed `website/demo/` afterward too — dropped from 401MB to
267MB as a side effect.

**Confirmed the biome parallax backdrop system is fully built and correctly layered**
(owner question: "wouldn't they be one of the furthest layers down?"). Yes — `depth 0.5`,
explicitly documented as above the sky (depth 0) and below everything else (terrain at
1.3, then road/buildings/trees/traffic). Verified live by warping through several mile
markers: distinct art renders correctly per biome (blue-grey pine ridgeline at North Bend,
golden wheat hills at Palouse), nothing missing or misordered. No code changes needed —
this was a verification pass, not a build.

### 2026-07-30 (pt 4) — Trip-summary screen, cop-diverted tracking, upgrade-wipe bug fix
Local + test-passing (upgrades.test.mjs new, 3/3) + builds clean. Committed as `2da19bb`,
`20a4ac5`, `9177283`.

**Trip summary (owner 2026-07-29 directive, closes the last open gap).** GameOverScene
now shows a 📊 SUMMARY button on a genuine Pullman arrival (`finish` /
`finish_on_time` / `finish_late` only — not busted/crash/OD/demo) that opens a 5-tab
modal: Overview, Money, Missions, Road, Rest Stops. Fed by a `StatsTracker.summarize()`
snapshot GameScene takes at the exact moment the trip ends and threads through the
`scene.start('GameOver', ...)` payload as `tripSummary`, so it can't be disturbed by a
later run's `tripStart()` resetting the live session. Verified end-to-end with a
headless Playwright harness driving the real `_openTripSummary()` / tab-switch code
against injected data — all 5 tabs render, no console errors, button correctly absent
on non-completion endings.

**StatsTracker gap:** several fields added across this feature's earlier slices
(`spent.{gas,repairs,upgrades}`, `earned.bySource`, `missions.byType`, `copsDiverted`)
lived only on the LIFETIME `stats` object, not the per-trip `session` — so the summary
screen would have shown all-time totals instead of "this trip." Added session-scoped
mirrors (`spentByCategory`, `earnedBySource`, `missions`, `copsDiverted`) and dual-write
in every recorder; `summarize()` now exposes all four.

**Cop-diverted tracking (the last real gap from the trip-summary spec).** CopSystem
counts two distinct outcomes: a WEAPON dismissal (coal smoke-out, donut lure, fireworks
kill — found via reading `useF12Token` fresh that its `victims`/`removeAll` array is
actually dead code no current weapon populates; the real per-weapon hook points are
`_coalSmokeOut`, `_donutDivert`, and the fireworks `deferred` array) and a DISTANCE
escape (the existing `carDist < -COP_ESCAPE_UNITS` cull-loop splice). Plain counters on
CopSystem, drained once/frame by GameScene into `StatsTracker.recordCopOutcome` — no
new coupling into the chase logic itself.

**Upgrade-data-loss bug, found while tracing a different report.** Investigating the
"shop may re-sell installed upgrades" lead in `project_rtr_wallet_upgrade_bugs`
(owner-reported, triaged 2026-07-28) turned up a worse bug than suspected:
`buyUpgrade()`'s "clear the other tier map" step ran unconditionally, so writing to
`tempUpgrades` — ANY Custom-sandbox purchase, or a normal-run buy of a
`persistent:false` item like Coolant Flush — silently DELETED the player's real
permanent upgrade in that same slot. Reproduced with a plain harness (own `eng_3`
permanently, buy any engine part in Custom mode, `eng_3` vanishes from the save).
Fixed: only a PERMANENT purchase retires a temp patch now, never the reverse. Added
`tests/upgrades.test.mjs` guarding all three directions. The separate "shop-vs-road
wallet drift" report was traced end-to-end (GameScene ↔ RestStopScene is a direct
scene-data pass, no stale-read window exists) — no live bug found; likely already
fixed by the 2026-07-23 wallet-persistence commit, which predates the triage note.

All three landed on a shared working tree with a second, actively-running session mid-
edit on `GameScene.js` / `RestStopScene.js` (the business-missions build below). Commits
were staged surgically — `git hash-object` + `git update-index --cacheinfo` to commit
only the specific hunks authored here, leaving the other session's uncommitted work
untouched in the working tree throughout (confirmed via diff before every commit).

### 2026-07-30 (pt 5) — BUSINESS MISSIONS slice 3: the CHALLENGE class (31/51 live)
Local + test-passing (509) + builds clean. Uncommitted.

The owner's canonical dare finally works: **Fireworks Frenzy** — "I'll load you to three. Burn all
three inside forty-five seconds and there's $250 in it." Plus Sugar Rush (hold 100+ for 30s),
Test Drive (hold the 70-80 BAND for 60s), Dyno Dash (20 cumulative boost seconds).

**A challenge is structurally unlike every other type**, and that drove the design:
- **No destination.** It's explicitly skipped by `gradeArrivals` and `checkMissedTargets`, both of
  which assume a target stop exists.
- **It pays ON THE ROAD.** Every other type is active → ready (graded at pull-in) → collect (paid
  at the stop); a dare has no stop to pull into, so `_completeChallenge()` closes the ledger
  itself and GameScene banks the cash where the player is standing. It still writes `_outcomes`,
  so a checkpoint rewind can't un-pay or re-pay it (covered by a test).
- **Its clock is REAL seconds, not party-clock seconds.** A 45-second dare on the 4×-compressed
  party clock would be an 11-second dare.
- **The clock starts on the ROAD, not at acceptance** (`armChallenges()` on the first road tick),
  so the timer can't burn while the player is still shopping.
- **The kit is handed over at acceptance** through the same `_purchases.f12` channel a shop
  purchase uses — GameScene's resume path needed no new case.

**Bug caught by its own test:** `sec` was doing two jobs — the goal AMOUNT for `boostSeconds` and
the DEADLINE for the others — so a 20-second boost goal was also a 20-second fuse and killed
itself while the player wasn't boosting. Split into `limitSec` (the fuse, optional — omit it and
the dare is untimed) vs the goal fields. Item-burning dares are asserted to always carry a fuse,
since without one they could never be failed.

Semantics worth keeping straight: `speedBand` is a CONTINUOUS hold (drop out and it resets — that
IS the challenge) while `boostSeconds` is CUMULATIVE (let off whenever). Both are tested.

12 challenge offers generate across the route at a sample seed.

### 2026-07-30 (pt 3) — BUSINESS MISSIONS slice 2: condition clauses (27/51 templates now live)
Local + test-passing (472) + builds clean. Uncommitted.

Eleven clauses, in two kinds — the distinction is the design, not an implementation detail:
- **FAIL clauses** kill the job on violation: `noEating` (eat anything off the road and the
  Munchie Mule haul is void), `pacifist` (fire anything and the quiet run is dead), `speedFloor` /
  `speedCap` (with a **grace budget** — a few seconds outside the band, repaid by time back
  inside, so ordinary traffic or a corner can't auto-fail a clean run), and the arrival checks
  `fuelFloor` / `alertFloor` / `cashExact`, judged at pull-in.
  **Grace scales with difficulty** (owner 2026-07-30): `Difficulty.speedGraceMul()` — Hard ×1.0
  (the raw authored `graceSec` IS the Hard budget), Normal ×1.4, Easy ×2.0, Custom inheriting from
  its sub-difficulty like every other gameplay multiplier. The mph BAND never moves with
  difficulty — only how long you may sit outside it. Note for test authors: the module default
  mode is Easy, so any test written against a raw `graceSec` must pin the difficulty (two slice-2
  tests silently got 2× their intended budget until they did).
- **EFFECT clauses** change the drive or the pay and never fail on their own: `heatCarried` (the
  Armored Run rides with its own star floor — applied BEFORE the star-cap buy, so you can pay off
  heat you EARNED but not the heat in your trunk), `survivalDrain` (a full car drains food/water
  2×), `damageDock` (every HP costs you part of the fee, floored at 25% — a zeroed payout reads as
  a bug), `tipBySpeed` (tip scales with how far under par the leg landed).

Wired into GameScene at the existing choke points: the pickup-consume path, the single
`_useTopF12` fire path (disguise / paint-bomb exempt, matching the cop-escalation carve-out), the
per-tick mission feed for speed sampling, and the pull-in grader, which now takes an arrival ctx
(`fuelPct`, `alertPct`, `cash`, `clockSec`). Missing ctx fields SKIP their clause rather than
failing the job, so any older caller stays safe. Leg timing is per-mission (`acceptedClockSec` off
the party clock), not a scene-level timer. Collect pays through `payoutFor()` so the dock and the
tip land, with the genre trait still multiplying on top. Every clause has offer-card copy in both
the prose catch and the scannable row, and a `TERM_BONUS` premium priced by how much it fights the
way the game wants you to play (pacifist 70 > fuelFloor 35).

**Offer coverage fixed along the way.** Distinct DESTINATIONS were a nice-to-have inherited from
the old 2–3-offer era, and they were starving the three-category promise: a used target could drop
a stop to one job. Backfill now reuses a destination rather than pitching fewer jobs, and a
**sparse-basin fallback** covers the eastern gap where a Rookie window can be genuinely empty
(Ellensburg's next neighbour is 28 mi out, past the 22 mi cap) by falling back to the nearest stop
ahead. Result: every stop on the route now pitches 3 categories at every seed tested, with Pullman
correctly still payoff-only.

**Still waiting on later slices (24 templates):** the challenge class (Fireworks Frenzy, Sugar
Rush, Test Drive, Dyno Dash, Stud Test, Decoy Deploy, Wolf Scare, Recall Notice, Meter Maid) plus
world-entity clauses — `npcFlee`, `npcRescue`, `escort`, `carSwap`, `multiDrop`, `hpLock`,
`brakePenalty`, `steerPenalty`, `wetPaint`, `decayHeat`, `smelly`, `duskTimer`, `bustOnSpeed`,
`cashAdvance`, `vicePayout`.

### 2026-07-30 (pt 2) — BUSINESS MISSIONS slice 1: per-business pools, run rotation, chain runs, one job per stop
Local + test-passing (433, up from 379) + builds clean. Uncommitted.

The owner's 50-mission pool (10 businesses × 5, drafted 2026-07-28) is now **captured as data** in
`src/data/businessMissions.js` — recovered from that session's transcript rather than re-invented,
since the owner had already seen and reacted to the list.

**The staged-build contract (the important part).** Every template declares the condition clauses
it `needs`; a template is offerable only when all of them are in `IMPLEMENTED_CLAUSES`. That is
why all 50 can live in the file from day one while only ~13 are live: the rotation draws from what
the engine can actually ENFORCE, and each clause a later slice adds widens the live pool with no
edit to the data file. Shipping a watered-down version of a mission whose catch isn't implemented
would be worse than not offering it — "Bear Canister" without the smell mechanic is just another
fragile crate, so it waits.

**What slice 1 built:**
- **Work is sourced from BUSINESSES, not stops.** Offers are drawn from the businesses a stop
  actually has (`REST_STOPS.amenities`), so the amenity map finally drives content.
- **Per-run rotation** — `ACTIVE_PER_BUSINESS = 2` of each pool, seeded Fisher-Yates off the run
  seed, stable all run and across reloads (the seed serializes), different every new run.
- **Three offers per stop, one per CATEGORY, one hire per stop** (owner 2026-07-30). The contact
  pitches three types; `accept()` refuses a second job at a stop that has already hired, and the
  ledger serializes so a checkpoint rewind can't re-hire. Passed-over jobs are NOT burned — they
  stay in the rotation and can resurface later. A generic backfill tops a thin stop up to three
  distinct categories so the contact always has a spread.
- **CHAIN RUNS (owner 2026-07-30: "make a lot of the deliveries business to like business").**
  `destBiz: 'same'|'<key>'` aims a haul at the NEXT branch of that business — "Take this package
  to my brother. He's at the next AM/BM. Don't look inside. He'll know." (owner's line, verbatim,
  now `ambm_brother`). Chain runs deliberately **ignore the rep-tier mileage window** — the branch
  is where it is — so they run long and pay for it: per-mile rate plus `TERM_BONUS.chain`. Eight
  of the ready deliveries are chain runs; the card names the destination as a business
  ("AM/BM in Cle Elum"), not just a town.

**Verified by generating real offers**, not just unit tests — e.g. seed 42 at Cle Elum pitches
Gas-N-Sip Restock → Thorp (17 mi, chain) and Huff's Price War → Ellensburg (25 mi, chain); reseeding
produces a different spread.

**Test contract changes** (9 pre-existing tests updated, all intentional): the Phase-4 "slot 0 is
always a delivery" anchor rule is retired (there is no anchor type now, only distinct categories);
timed budgets may be AUTHORED per template (Price War 4 min, Hot Springs Water 2 min) as well as
derived from miles; and any test holding several actives at once now hires at several DIFFERENT
stops, because one-job-per-stop is real. One sub-test ("a later success repairs the fail-ack")
moved to a fresh run, since a stop can no longer hire twice.

**Open / next:**
- **Passenger offers are nearly all generic backfill** — only ONE passenger template is currently
  implementable (`gas_hitcher`), and few stops carry `gas`. Slice 2's `alertFloor` / `multiDrop` /
  `survivalDrain` clauses fix this.
- **Payouts look hot at Rookie** ($800–2,300 once the chain bonus lands on top of the mission
  formula's own `PAYOUT_MULT = 5`). Wants a tuning pass with real play data before release.
  NOTE (owner 2026-07-30): `PAYOUT_MULT` is a MISSION-ONLY scalar inside `computePayout` — the
  game's score multiplier (`GameScene._scoreMult`, survival conditions + wanted stars) does NOT
  apply to mission pay. Collect pays `(payout + tip) × _payMultFor(type)`, i.e. only the genre
  trait multipliers (`cargoPayMult` / `timedPayMult` / `passengerPayMult`; heat is fixed at 1).
  Don't reason about mission balance as if the HUD multiplier stacks on it.
- Slice 2 = condition clauses (noEating, speedFloor/Band, pacifist, fuelFloor, cashExact,
  heatCarried…). Slice 3 = the challenge class (Fireworks Frenzy et al). Slice 4 = author the
  remaining templates onto that vocabulary + payout tuning.
- Storefront greeter NPCs + shop "deals" (owner is generating the art) are a separate slice —
  the shop NPC sells, the road NPC hires.

### 2026-07-29 → 30 — INVISIBLE COPS root-caused (mirror parallax), cops kept BEHIND the player, tutorial chrome, rest-stop message cards
Test-passing (379) + builds clean. Not deployed.

**Commit state:** the GameScene + CopSystem half (items 1-6) is COMMITTED — it landed in HEAD via
the parallel session's commits (`6874eca` → `b943405`, 2026-07-29 22:59-23:47), which also
**stripped the `_copDebug` trace overlay** described below once it had done its job. The
RestStopScene half (items 7-8) is UNCOMMITTED in the working tree alongside that session's
encounters / npcPortraits / AssetManifest edits. Nothing is pushed.

⚠️ **Two sessions were editing this repo simultaneously on 2026-07-29.** Check `git log` and
`git status` before assuming your working tree is yours alone.

**1. "PURSUIT — 2 ft behind" with no cruiser anywhere — ROOT CAUSE: mirror lateral parallax.**
The long-standing report was NOT the cull, the near plane, or the standoff. The cop was being
drawn every frame, correctly textured, `visible=true`, `alpha=1` — at **x258 against a glass
spanning 274-526**, i.e. 16 px outside the mirror, where the geometry mask clipped it.

`GameScene` shifted the whole mirror road by a **constant** `-playerLane * glassW * 0.55` at every
depth — up to 55% of the glass width, vanishing point included — and then `projectRear` applied
the player's lateral offset a SECOND time, depth-scaled. Near sprites survived because the second
term is small up close; far sprites (dT 0.14 here) rode almost entirely on the constant and slid
off the edge. Worst exactly when a cop was far enough away to be small, which is why it read as
"cops never appear."

Fixed by making the shift depth-scaled — `lateralShiftAt(depthT) = -playerLane * (roadHalfW *
depthT + 4)` — so a laterally-offset camera moves the NEAR road but never the vanishing point,
which is what actually happens. The road slices and `projectRear` now share that one term (and
`projectRear` no longer subtracts `playerLn` again; `mb._playerLane` deleted). Same cop now lands
at x≈379, mid-glass. Mirror cop sprites also got a `minH` floor — `max(6, glassH * 0.13)` — since
one 76 ft back was drawing 4 px in a 26 px-tall road band.

**The old KNOWN-OPEN note blaming a camera-vs-player origin mismatch was stale** and had been
sending sessions down the wrong path: `getCopsForRender(camPos)` already passes the camera origin
and both the mirror and the chevron measure from `p.position + PLAYER_VIRTUAL_Z`. Corrected below.

Found with a purpose-built trace (`_drawCopDebug`, since removed) printing per cop: ft-behind,
mirror vz, cull verdict, projected x/y/depthT, pool slot, sprite visibility, forward relZ + screen
Y. Three sessions of static reasoning had produced wrong answers; the trace produced the right one
in one run. **If an "invisible / wrong-looking sprite" mystery recurs, re-add a readout — do not
reason from screenshots.**

Two process traps cost most of the time here, both worth remembering:
- The game was being tested at **`roadtrip-roulette.pages.dev`** (deployed, weeks stale) while
  every fix landed in local source, so no instrumentation could ever have appeared. **Confirm the
  URL before debugging.** `curl localhost:3000/src/... | grep` proves what the dev server serves;
  it does not prove what the browser loaded.
- A key-toggle and a `?flag=1` URL param both failed silently for the same reason. When
  instrumenting, prefer **forced-on** output that needs no interaction to appear.

**2. Cops are the same size as every other car.** `COP_VISUAL_SCALE = 1` replaces the 1.4×
("imposing") / 1.5× parked inflation and the 1.3×-player-width hard cap is gone — traffic has
never needed one. Body and light bar both derive from the constant so they can't drift. Size
differences are now honest perspective: a pursuer sits nearer the camera than the player sprite,
so it draws slightly larger closing from behind and converges as it comes level.

**3. Cops stay BEHIND the player — and the forward view can't show that, by design.** The camera
sits `PLAYER_VIRTUAL_Z` (3000, ~49 ft) behind the player's car sprite, so anything genuinely
behind you still projects in FRONT of the camera: lower on screen and larger than you, which
reads as "driving alongside me". No standoff fixes it — pushing them back only drives them lower
and bigger until they cross the camera plane. So:
- **Rear pursuers are mirror-only.** `_rearCopForwardFade()` fades a rear unit out over ~8 ft as
  it drops behind the player's car. Parked/roadside cruisers you drive PAST, oncoming units,
  barricades and fleeing cops (own exit animation) are exempt, and cops that legitimately LEAD
  (4-5★ overtakes, onramp reinforcements) are ahead of the camera so they still draw.
- **Standoff 600 → 1800 units** (~10 ft → ~30 ft), about two car lengths.
- **Rams became LUNGES.** The real "alongside" mechanism wasn't the gap — it was a *permanent*
  exemption: any cop within a flat `RAM_STRIKE_Z` (2000) of the bumper could ignore the standoff,
  so it closed to the player's exact depth and parked there. Raising that constant re-creates the
  bug. Replaced with an intermittent commit: hold the standoff, lunge every 3.5-7 s for 2.5 s,
  fall back. A lunge is exempt from GUARD 1's speed ceiling (a 1★ cap of 1.03× the player makes
  the strike take ~6 s and never land); GUARD 2 still bars passing. `RAM_STRIKE_Z` deleted.
- **`endLunge()` on a landed ram** — fixes a real bug: a cop pinned at the player's depth was
  re-registering a rear ram EVERY FRAME it sat there.

**4. Star line + custom-mode wanted control.** RAM / HEAD-ON / PIT tallies dropped from the star
line (they pushed the glyphs left into the weapon cells, unreadable); stars alone now centre on
the line's own anchor. In Custom the empty `☆☆☆☆☆` row stays on screen and is **drag-to-set**,
matching the vice and status bars: press a star to set that level, drag to scrub 0-5, drag off the
left edge for 0. Steering is suppressed during the drag. Live cops are deliberately NOT wiped on a
drop to 0 — they break off normally instead of vanishing every time a scrub passes through zero.

**5. Tutorial chrome.** Both tours (title-screen Stage 1b and the in-game HUD tour) used a single
3px stroked rectangle as the "highlight", which read as a flat yellow bar next to the phone
menu's CSS `box-shadow` bloom. `_drawTourGlow()` stacks six concentric rounded strokes with
distance falloff (0.05 → 1.0) plus a 0.10 interior wash — the Phaser equivalent of `@keyframes
tutFlash`. `_placeTourBox()` now guarantees the copy never covers what it's describing: picks a
band that clears the highlight (below → above → right → left) and steps the font down (×0.88,
floor 15px) until it fits. This retires the title tour's hand-authored `box:{x,y,w}` coords (the
plates step placed a 720px box at x590 and the clamp dragged it back over the plate column) and
the HUD tour's "opposite half" rule (a tall box still reached back over its target).

**Genre descriptions were on the wrong elements** and are swapped: `radio` (the station-name
readout, display-only) now reads "Shows you what you're jamming to"; `btn_genre` (the note button,
whose handler is `audio.nextStation()` — it CHANGES the station) gets the "plenty more to earn"
copy.

**6. First-drive windshield nudge.** At 0.25 mi the game freezes and shows, in the tutorial's own
chrome: *"The first upgrade I recommend is replacing this busted ass windshield. Keep an eye out
for the next rest stop."* Once ever (`rtr_tutWindshield`), stands down while any tour / the title
screen / an existing pause is up, and the dismissing tap can't fall through into a steer (resume
is deferred a tick). Re-testing onboarding means clearing `rtr_tutorialSeen`, `rtr_tutStage1/2`
and `rtr_tutWindshield`.

**7. TAKE A SNOOZE moved to AOK Camp.** Dropped from the shared `viceItems()` list, which removes
it from AM/BM *and* Gas-N-Sip in one edit. At camp it REPLACES the free ad-gated `NAP IT OFF`.
Owner call was a straight replacement; the snooze payload **keeps the nap's full Alertness
restore** (`reduceVices: 0` + `tiredness: -100`) so the campground still has an alertness reset
and you don't sleep off every drug only to wake up drowsy — flagged to the owner, revert to
vices-only on request. Nothing sets `sleep`/`sleepAdMs` any more; GameScene's consumer was left
intact for a future ad-gated item.

**8. Rest-stop outcomes are tap-to-dismiss cards.** `_showMenuPopup()` (scrim + panel + TAP TO
CONTINUE, depth 600, above the encounter card's 500, queued). Now on cards: every purchase
confirmation, robbed-at-the-pump (now naming the amount), hot-springs bonus HP, radar detector
installed, and all five job-accept lines (reflowed — the player has time to read the terms).
Still fading toasts: "Need $X more", "CUSTOMERS ONLY", "Not available" — rejections shouldn't cost
a tap per mis-click. Outcomes that used to fire their own toast now stash into `_buyOutcomeMsg`
and REPLACE the generic "✓ BOUGHT X" line, so one purchase never stacks two cards. The job-accept
path's special 5s status hold is deleted — the card holds until dismissed. **Menu-only:** on the
road, GameScene's `_showPopup` transient text is untouched.

### 2026-07-28 (pt 2) — Custom mode: real pickups, real prices, unlimited wallet
Local + test-passing (348) + builds clean. Not deployed.

Owner spec: Custom keeps food/drink/caffeine pickups on the road (cull nothing), items COST
money, but the custom wallet never depletes.

**1. Vice pickups restored.** Custom suppressed them in TWO places — the renderer (they never
drew) and the collection scan (they couldn't be picked up), both reasoning "the slider already
set the bars". Both guards removed; pickups now behave identically to every other mode.

**2. Vice bars no longer frozen.** `ViceSystem.update()` skipped all decay when
`Difficulty.noScore()` — i.e. in Custom. That had to go with #1: a frozen bar plus working
pickups is a **one-way ratchet**, levels could only climb with no way to sober up. The slider now
sets the STARTING levels and the run simulates normally. `Difficulty` is no longer imported by
ViceSystem at all, and `_updateDoses`' `frozen` parameter went with it.

Bars stay **draggable mid-run** — that already existed (`_draggingViceId` for vices,
`_draggingSurvKey` for Food/Drinks/Alertness/Bladder, both gated on custom); the freeze is what
made it pointless, since a dragged bar just sat there. A drag is an external write to
`levels[id]`, which the per-dose reconciliation in `_updateDoses` (see pt 4 below) absorbs — so
dragging caffeine to 80% now gives you 80% that then decays on the normal schedule.

**3. Every vice unlocked in Custom.** `ViceSystem.pickup()` bails on a locked vice, and the
fresh-start block only unlocked vices the slider left ABOVE zero — so a vice you zeroed rendered
a pickup you could drive through forever. Now unlocked unconditionally, and moved into
`_applyCustomGrants()` so resumed custom runs get it too, not just fresh starts.

**4. Items cost money.** `freeMode` in `RestStopScene` (which zeroed every price in Custom) is
gone. Prices are real, displayed, and charged to spend-stats; the genre-trait repair discount
still applies.

**5. The wallet never depletes.** One rule, one place: **`GameScene._cashLoss(amount)`** returns
0 in Custom and the rounded amount otherwise. Every drain routes through it — the four
hitchhiker/stranger robberies (−$500/$250/$600/$1200), the AAA call-out, speeding fines, arrest
bail, and the `busted_late` penalty (the last three were yesterday's inline guards, now unified
onto the helper). Shop side mirrors it with `RestStopScene._infiniteMoney()`: the purchase is
fully real (price charged to stats, business unlocked, item applied) but the subtraction is
skipped. NPC-encounter `addCash` takes gains and ignores losses. Gas-station robbery skipped.

**Route ALL future `score -=` sites through `_cashLoss()`** rather than adding another mode
check — that's the whole point of the helper.

Note: money is unearnable in Custom (`_scoreMult()` returns 0) and now unloseable, so the
balance sits at exactly the $100,000 seed. OD stays enabled in Custom per owner ("we don't
really OD any more, it's falling asleep or throwing up").

### 2026-07-28 — Custom mode: $0 and no weapons after a crash-load
Local + test-passing (348) + builds clean. Not deployed.

Owner report: played Custom, crashed, loaded back in with **$0 and no weapons** instead of
$100,000 and a full rack.

**The weapons symptom identified the bug.** `useF12Token` skips every decrement when the mode
is custom (`CopSystem.js:499-508`) — weapons are literally unspendable there. An empty rack
therefore *cannot* be depletion; it proves the seeding never ran.

**Defect 1 — the grants lived in the one method every resume path skips.** `$100,000` and the
weapon inventory were seeded inline in `_startGameplay()`, which only runs on the START tap or
when `_freshStart` is set. Crash auto-resume, LOAD SAVE and checkpoint respawn all bypass it —
the code says so itself ("resume + checkpoint respawn skip `_startGameplay`"). Any of those
doors = a Custom run with no money and no guns.

Fixed by extracting **`_applyCustomGrants()`** — idempotent, **top-up only** (owner's call):
`score = max(score, 100_000)`, each weapon slot topped back to a full stack of 3 rather than
reset, so a resumed run holding more keeps it. Called from three places, all no-ops outside
custom: `_startGameplay()`, the end of `_applyResumeSnapshot()` (must run *after* the snapshot
overwrites score/weapons), and the end of `_doCreate()` as the catch-all so no future entry
point can be missed the way `_startGameplay` alone was.

**Defect 2 — a Custom run's autosave is written to a bucket that never reaches disk.**
`'liveRun'` is in `SANDBOX_KEYS` (`SaveSystem.js:59-67`) and Custom turns the sandbox on, so
`_autosaveRun()`'s `save.set('liveRun', …)` lands in `_sandboxStore` — and `save()` only
serializes `this.data`. The snapshot dies with the reload. Worse, `init()` reads `liveRun`
*before* `_doCreate` enables the sandbox, so the crash boot read the **real profile's** liveRun
(a leftover from the last *scored* run) and, with the crash marker set, auto-resumed that —
dropping the player into another run's wallet while they believed they were still in Custom.
Note the inconsistency that set the trap: `_saveCurrentRun()` refuses in custom ("Custom games
don't save"), but `_autosaveRun()` had no such guard and wrote silently into the void.

**Fix (owner's call): Custom never auto-resumes.** `init()` now checks the persisted difficulty
(read straight off the save — `Difficulty.hydrate()` hasn't run yet at init time, and
`'difficulty'` is not a sandbox key) and skips the resume entirely for custom. On a genuine
**crash** it sets `_reopenCustomSetup`, and `_doCreate` reopens the **Custom setup menu** over
the title so the player re-picks their settings or backs out. A clean boot that merely has
Custom selected just shows the title. Required extracting the setup modal out of the title
START closure into **`_openCustomSetupModal()`**, now shared by both entry points.

**Defect 3 — direct `score -=` sites bypassed the no-score gate.** Every normal money path
collapses to zero in Custom via `_scoreMult()`, but four places subtracted cash directly, so
tickets and bail were quietly eating the $100k with no crash required. Gated on
`Difficulty.noScore()`: speeding fines, arrest bail, the `busted_late` cash penalty, and the
gas-station robbery roll in `RestStopScene`. (The crash/overdose wallet settlement was already
mode-gated and is unchanged.)

### 2026-07-27 (pt 5) — Lake Easton held 75 ft back from the roadway
Local + test-passing (348) + builds clean. Not deployed.

A lake used to be one of two things: `'shore'` (water plane starts at the pavement edge, with
guardrail and dunk) or `'distant'` (horizon-only, unreachable). Easton was `'shore'`, so the
lake rendered hard against the rumble strip. It should sit 50–100 ft off the road.

**New third option: `setbackFt` on a `'shore'` lake** (`src/road/RouteData.js`, LAKES table).
Easton is `setbackFt: 75`; every other lake omits it and is byte-for-byte unchanged.

Lateral distances are `p.x` road half-widths — `p.x ±1` is the pavement edge and the road is
4 lanes ≈ 50 ft edge to edge, so **one half-width ≈ 25 ft** (`FT_PER_HALF_WIDTH`). 75 ft
therefore puts the waterline at `|p.x| = 4.0`, published once as `seg.lakeWaterEdgeX` so the
three consumers can never disagree about where the shore is:

1. **Render** (`Road.js`, both flanks) — water fill starts at `x2 ± lakeWaterEdgeX * w2`
   instead of the pavement+rumble edge. The terrain pass already painted that flank, so simply
   starting the fill further out is what leaves real ground showing. Clamped so a setback can
   never pull the waterline back *inside* the rumble strip.
2. **Dunk** (`GameScene.js`) — `DUNK_THRESH` becomes `seg.lakeWaterEdgeX ?? 1.15`. You can no
   longer drown standing on dry ground 75 ft from the lake.
3. **Scenery** — `'shore'` used to delete *every* sprite on the water flank so trees wouldn't
   render standing in the lake. Now it deletes only sprites at `|offset| >= waterEdgeX`;
   anything inside the setback is on genuine dry ground and survives, which is what puts a
   shoreline strip back at Easton. Collectibles still always survive.

**⚠️ THE GUARDRAIL WAS NOT MOVED — this was the owner's explicit call, don't "fix" it later.**
The rail stays a solid wall at `BRIDGE_RAIL` (0.95) on every `waterRight` segment, exactly as
before. Consequence, accepted knowingly: the 75 ft strip is **unreachable** and the relocated
dunk at 4.0 effectively cannot fire at Easton. The setback is a visual/geographic correction,
not new drivable ground. The barrier is worth more intact than the sink is worth reachable —
see the `feedback_never_touch_walls` standing rule.

Related: `SINK_EDGE` (1.15) in the rail-rescue exception previously carried a "keep equal to
DUNK_THRESH below" comment. That invariant is now deliberately broken — comment corrected, no
behaviour change. Also noted while in here: `src/road/Road 2.js` is a stale unimported
duplicate of `Road.js` (nothing references it); left in place, but it's dead.

### 2026-07-27 (pt 4) — Stimulants get PER-DOSE timers (the "200 mph Lowrider" fix)
Local + test-passing (348). Not built, not deployed.

**The report.** The reggaeton Lowrider was doing 150 mph cruising and 200 boosting, against a
data table that says 115 / 135 (`src/data/genreVehicleTraits.js`).

**Root cause — it was never a speed bug, it was a *duration* bug.** `ViceSystem.update()`
modelled each vice as ONE shared scalar draining at a flat `cfg.decayRate`, so every additional
pickup extended the whole bar's lifetime instead of running its own clock. Four caffeine pills
(25% each) filled the bar to 100% and then took **204 seconds** to drain — not ~51 s apiece.
A full caffeine bar feeds `EffectsSystem`'s `speedMult` at `1 + caffeine × 0.45` = **×1.45**,
which multiplies the genre car's base in `GameScene._updatePlayer`. So `115 × 1.45 = 167 mph`
*without touching the accelerator*, sustained for over three minutes, and the player read that
as "the car goes 200".

**The fix.** The three stimulants are now DOSE-TRACKED (`DOSE_SECONDS` in `ViceSystem.js`).
Every pickup becomes its own `{amt, t, dur}` entry whose clock starts the instant it's
collected; the bar level is the SUM of the live doses' remaining fractions. Stacking now raises
the bar **higher**, never **longer** — dose #4 expires on its own schedule no matter what doses
#1–3 are doing.

| Vice | Fill | Per-dose life |
|---|---|---|
| 💊 Caffeine | 25% → **10%** | **60 s** |
| 🧋 Cold Brew | 18% → **10%** | **45 s** |
| ⚡ Energy | 10% (unchanged) | **30 s** |

Net: peak caffeine `speedMult` from a realistic 4-pill stack drops **×1.45 → ×1.18**, and it
lasts under a minute instead of 3½. Lowrider peak 196 → 159 mph. The other 8 vices keep the
shared-drain model — alcohol/weed/opioids need per-dose durations designed from scratch (a
naive conversion would gut a beer down to ~12 s) and that's a separate pass.

**Reconciliation matters.** GameScene writes `vices.levels[id]` directly in ~13 places
(rest-stop "reduce vices" buys, Narcan opioid flush, save restore, dev slider, and the
cross-vice drops inside `pickup()`). `_updateDoses` compares the current level against what it
last wrote and, on mismatch, rescales the live doses to the externally-set total — preserving
their individual clocks. **Those 13 call sites were not touched and must not need to be.**
`tests/vices.test.mjs` covers all three write shapes (zero / halve / set-from-nothing).

**Deliberately NOT done** (considered and passed on):
- No absolute mph clamp in `_updatePlayer`. Without one, ECU (×1.10) + downhill (×1.15) are
  structurally ×1.27, so a 135 base still reaches ~171 with a full stack. Acceptable for now;
  revisit if playtest still reads too fast.
- Genre base-speed table untouched (all 10 cars keep their current cruise/top).
- `EffectsSystem` speedMult coefficients untouched (energy 0.55 / caffeine 0.45, clamp 1.8).
- Caffeine `odThreshold` still 1.0001 — at 10% a dose that now needs **11 live doses inside
  60 s**, so caffeine OD is effectively unreachable. Drop it to ~0.5 if OD should stay in play.

### 2026-07-27 (pt 3) — SITE LIVE: marketing site at root, full game moved to `/fully`, desktop-bridge + phone-UI fixes, link previews
Website went public and the Pages project now serves **two things**. Game changes are local +
test-passing (327); website changes are deployed and verified live.

**⚠️ Read Chapter 2 “Deploy conflict” before the next `git push`.** The GitHub Action still
deploys `dist` (the game) to the root of this same Pages project, so the next push to `main`
will wipe the marketing site and `/fully`. Nothing is lost — Pages keeps every deployment and
rollback is one click — but the workflow needs rewiring before pushing.

**Phone-UI sizing bug (game).** Every modal inside `#phone-menu` sized itself in `vmin`, which
measures the WINDOW. In a browser there's no phone to rotate, so the desktop bridge reframes the
menu as a small portrait card (`width: calc(100svh * 853 / 1844)`) — and `vmin` then measured
something ~7x larger than the frame. The reset-player confirm wrapped one word per line and
pushed its buttons off the bottom. Fix: `#phone-menu` declares `container-type: inline-size` and
121 rules (314 values) moved `vmin` → `cqw`. On a real phone the frame IS the viewport, so
`cqw === vmin` — mobile renders pixel-identically (verified: 47 differing pixels out of 329,160,
max delta 1/255, all backdrop-blur dither in one corner).

**Desktop bridge (game).** Three dead ends for browser players:
- **Title screen had no route into the phone menu at all** — `_togglePause()` returns early while
  `_awaitingStart`, so the pause overlay (where the only "iPHONE MENU" button lived) never opens
  there. Added a desktop-only `📱 iPHONE MENU` button under the driver plates (art-checked: sits
  on dark water, 9px clear of the START card). It joins `_titleDifficultyBtns`, which is what
  hands it to `_setTitleVisible` + the UI-camera ignore lists.
- **The portrait tutorial's last step was a trap.** It shows the rotate prompt with
  `pointerEvents:'none'` (taps deliberately ignored) and only advances on an
  orientationchange/resize landing in landscape. A desktop window is *already* landscape and fires
  neither, so the tour could never finish and `#tut-capture` kept swallowing clicks — escape was
  resizing the browser. In the demo it fires EVERY session (`markTutorialSeen()` never persists
  when `window.__DEMO`). Now clickable on desktop, reading "Click to Enter Game Play".
- **Copy that described impossible actions.** The green button said "Rotate phone to enter
  gameplay" though its CSS only ever shows it under `body.is-desktop`; now "▶ Enter Gameplay".
  The bottom bar of the menu art is baked "ROTATE PHONE TO ENTER GAME PLAY" in
  `iphone_menu_bg.png` *and all 8 car-skin variants*, so it can't be reworded — a desktop-only
  opaque panel (`#phone-desk-play`, `data-px="36 1558 782 160"`) covers it and offers the click.
  Unlike the hit zone removed 2026-06-19, it calls `__phoneMenu.close()` (resumes in place)
  rather than returning to the title, so no run is lost.

**Website.** Hero rebuilt as full-bleed key art with the copy in a bottom-left panel; new
headline "293 Miles. One Goal."; Explore section removed; the three "drive is the game" cards are
now whole-card links (Walkthrough / Genres / Route Map) with Walkthrough first; nav reordered to
Story · Genres · Businesses · Walkthrough · Route Map · Leaderboard · FAQ.

**Press Kit retired.** Page deleted; its sprite gallery moved to Genres as a final
**"Additional Artwork"** tab (31 sprites: law, traffic, weapons, locals, smashables). A copy of
the old page (fact sheet / description / features / history — the non-art content) sits at
`docs/retired/press-kit-page.html`; it's also in git history at commit `4375424`.

**Sprite scale correction.** The gallery renders every sprite at natural-size ÷ 6, which assumes
one export scale — but the cruiser is a 768px source while the semi is 283px and the helicopter
384px, so they read wildly different. `SPRITE_SCALE` (in the genres.html module) now multiplies
the odd ones: cruiser ×0.875, SWAT ×1.25, heli ×1.85, semi ×2.15 → 112/104/118/101px.
**That script writes `img.style.width` after layout, so it beats any CSS rule** — size tweaks go
in the map, never in `site.css`. (Cost an hour finding this; a correct, matching CSS rule and
even an inline `style="width:…"` both lost to it.)

**Button system.** `.btn-primary` and `.btn-invert` are exact inverses (accent fill + dark text ⇄
dark fill + accent text/ring) and each takes the other's look on hover, so a pair previews itself.
Ring is an INSET box-shadow, not a border — these buttons are auto-width, so a border would grow
the box and make them jump. `.btn-ghost` deleted (no users left). Landing: Learn the Legend /
Play Demo. Story outro: Choose Your Vibe / Play Demo. Nav CTA matches at nav scale.

**Story caption timing.** Opacity was a triangle (`1 - 2·distance`) that hit 1.0 only at the exact
centre of each third — readable ~10% of its window. Now a plateau with short fades (`CAP_FADE`),
and the first/last captions extend past the pinned window (`CAP_LEAD`/`CAP_TAIL` = 0.15 each,
≈21vh) since they have no neighbour on that side. Readable at ≥90% opacity: 10% → 73%. Inner
edges must stay flush — the three captions are stacked, so overlap double-exposes them.

**Hero art is a web-only derivative.** `assets/hero/key_art.png` is the loading screen with the
baked "LOADING…" line inpainted out (correct in-game, wrong on a marketing page). It lives in
`assets/hero/`, **not** `assets/ui/`, because `sync-assets.sh` overwrites `assets/ui/` from
`public/assets` and that folder is gitignored.

**Link previews.** `assets/hero/link-preview.jpg` (1200×630, 240KB) + Open Graph/Twitter tags on
all 9 pages, each with its own title/description. Written as real markup — preview crawlers don't
run the JS that injects the nav, so these can't be generated at runtime.

### 2026-07-27 (pt 2) — SCENERY OVERHAUL: sky/terrain/road layer split, 7-biome parallax backdrop, distance-projected landmarks, lakes, Cascade tree density — LOCAL, mostly UNVERIFIED in motion
Large scenery session. Everything below **builds clean and passes all 327 tests**, but only
parts have been seen running — treat the visual side as unverified.

**Renderer: sky / terrain / road split (structural).** `roadGfx` used to hold sky *and* road at
one depth, so nothing could be layered between ground and tarmac. Now three layers:
```
skyGfx     0     sky, stars, skylines, lake horizon, far shore
bands      0.5   biome parallax
landmarks  0.46  hero peaks (see below)
terrainGfx 1     ground fills
roadGfx    1.5   road surface, markings, water, tunnels
ghostGfx   1.55
```
`Road.render()` takes `terrainG` and `skyG` as OPTIONAL trailing args — omit them and every fill
falls back to `g`, restoring the original single-layer behaviour exactly. Only two draw sites are
terrain: the per-segment grass rect and the fail-safe world fill. Safe because hill occlusion uses
`if (curr.screenY < maxScreenY) continue` (segments behind a crest are skipped outright) and never
relied on grass overpainting road.

**Biome backdrop (`src/road/Biomes.js`, `scripts/buildBiomeBands.js`).** Replaced the single
procedural Cascade range, which scaled by mile and hit zero past mile 70 — leaving 223 of 293 miles
against bare sky. Now 7 biomes x 3 layers with 4-mile cross-fades: westside_forest 20-26,
north_bend 26-40, westside_forest 40-45, pass_alpine 45-58, easton_transition 58-78,
kittitas_foothills 78-122, vantage_basalt 122-142, columbia_irrigated 142-210, palouse_hills
210-293. **Snow exists in exactly one biome (pass_alpine)** — snow east of Snoqualmie is a bug.
Placeholder art; real bands drop in at the same 21 filenames (2048x640, bottom-anchored).

**Parallax now keys off accumulated road heading** (`seg.heading`, summed from `seg.curve` in
RouteData), not `player.x`. Tracking lateral position alone meant the backdrop slid on lane changes
but froze through bends — the tell that it was a painted wall. Measured 23x more swing through the
Cascades than the flat basin. Bands also ride a damped `pitchOff` so they rise with grade.

**Landmarks (`src/road/Landmarks.js`) — new system.** Six hero peaks, miles 28-54, each placed by
mile / lateral-miles / height and projected independently. Cannot use the sprite pipeline: that
culls at 76,000 units and a mile is ~320,800, i.e. it sees a QUARTER MILE. Lateral motion uses the
BEARING `atan2(lateral, dz)`, not `lateral/dz` — the ratio explodes near dz=0 and made peaks whip
off in a mile. Bearing is bounded, continuous through dz=0, and lets a peak recede while shrinking.
Real art wired for McClellan / Granite-Bandera / Snoqualmie-Guye (one plate covers both, so they are
ONE landmark). Mount Si cropped from the North Bend plate. Mount Washington still placeholder.

**North Bend (miles 26-40).** Base plate `north_bend_transition_east.png` (ground + side hills +
valley notch) at depth 1.25, overscanned 1.45x and following the vanishing point at only 0.22 —
tracking it 1:1 dragged the whole landscape sideways on bends. The three north_bend *bands* are
emitted transparent (superseded by the plate); `JOBS_ART` in `buildNorthBendBands.js` preserves the
layered path if ever revisited.

**Lakes.** `LAKES` table in RouteData, keyed off I-90 EXIT numbers. Two modes: `shore` (near water,
guardrails, dunk, roadside scenery suppressed on the water flank) for Keechelus 54.5-58 and Easton
70-72; `distant` (horizon only, NO rail/dunk, normal scenery in front) for Sammamish 14-18 and
Kachess 59.5-62 — neither alignment actually touches the water. Added the missing `waterRight`
renderer: the flag had guardrail + dunk handling since the DUI fork but nothing drew it, so a
waterRight segment would have drowned you in invisible water. Block runs LAST in `buildRoute` so
bridge/tunnel flags exist and every sprite pass has finished.

**Tree density.** `cascades` said "heaviest forest on the route" while setting 30 slots/mile —
sparser than downtown Seattle. Raised to 520 + `_denseStreetTrees` + 1.45x height boost; `eastside`
past mile 25 likewise. North Bend now ~1,600/mi with ~1,400 of those within offset 3.0 (vs Seattle's
120). Separately, `downtown_seattle` reverted 600 -> 120 slots/mile (owner: ~90 trees per skyscraper
through SoDo and the elevated West Seattle Bridge).

**Bug fixes.** Rest-stop mission card: speaker label overlapped the deal panel (top- vs
bottom-anchored, never reconciled) and the town fact ghosted under it (equal depth, later creation
order); the tier-fitting loop also accepted the smallest tier via `|| last` even when it did not fit
— now drops the town fact as the pressure valve. Messages app: contacts sort by recency (on `mile`,
not the `time` label, which wraps across the day/night cycle) and threads render newest-first, both
on COPIES so append/cap logic and the tail-read previews still work. Weapons no longer fire on
unpause — HUD cells keep live input zones behind the pause overlay, so a tap selected AND queued the
shot; guarded at `_fireWeaponByType` to cover every entry path.

**Yaw-billboard spike (earlier, same day).** Traffic cars get per-angle sprite frames; press **Y**
in-game to A/B. Traffic yaw is dominated by PARALLAX (`atan2(carX-camX, carZ-camZ)`), not steering.
Placeholder frames only; never playtested.

**KNOWN OPEN — see `project_rtr_session_handoff` memory:**
- Textured scrolling ground NOT built. Tile is registered (`ground_pnw_roadside`, seamless top-down
  1024px) but nothing draws it; ground is still the flat `palette.grass1` fill.
- ~~**Cop near-cull origin mismatch**: traffic uses camera-relative `relZ`, cops use
  player-relative `cop.relativePos`, so a cop *behind* you is culled while the pursuit HUD counts
  down to 1.~~ **WRONG DIAGNOSIS — CLOSED 2026-07-29.** The origins already agreed
  (`getCopsForRender(camPos)`); the cop was drawn OUTSIDE the mirror glass by a double-counted,
  non-depth-scaled lateral parallax term. See the 2026-07-29 → 30 changelog entry.
- **HP starts at 100 on an un-upgraded beater** (base is 25, so `_upgradeFx.hp` is contributing +75).
- **Unexplained green bar** at the horizon. Guessed the North Bend plate's ground band twice, wrong
  both times, both reverted. Isolate layers rather than guessing again.


### 2026-07-31 — /demo AND /fully both found stale + fixed + redeployed; CI root cause diagnosed; website/fully untracked from git

- User reported "the demo game on the main site is missing images." Root cause: **both** `/demo`
  and `/fully` were stale — each hand-built once on 2026-07-27 and never refreshed since (CI can't
  deploy — see below), so 15 commits of shop-greeter portraits, storefront fixes, and biome art
  never reached the live site. Verified with a headless-browser console-error sweep (playwright-core
  launched from inside the RTR `node_modules`, listening for Phaser's `"Failed to process file"`
  console errors), not just curl — a URL can return 200 while the browser still fails to decode the
  image under load, so a single curl check isn't proof; re-ran the sweep 3x to separate real
  404-class misses from transient decode noise before trusting the result.
- Rebuilt + redeployed both. Wrote **`website/build-fully.sh`** (new — this is the script the
  "Deploy conflict" fix below already called for) which builds the full game fresh and re-applies
  the `<base href="/fully/">` + `manifest.webmanifest` patches that a plain `vite build` loses, the
  same way `website/build-demo.sh` already did for the demo.
- **CI root cause found (previously mis-stated as "the token expired" — corrected):** a
  non-expiring replacement token (`rtr-dui-deploys`, created 2026-07-26, lives in
  `DUI/.cloudflare.env`) already exists and works — it's what manual deploys use. But the GitHub
  Actions secret `CF_PAGES_API_TOKEN` was never actually updated to it: `gh secret list` shows it
  untouched since 2026-07-04, still holding the token that expired 2026-07-22. `gh run list`
  confirms the exact split — every run through 07-22 succeeded, every run 07-23 onward fails with
  `Authentication error [code: 10000]`. **Still an owner TODO** (unchanged from 07-27, Claude is
  blocked from writing repo secrets): paste the `rtr-dui-deploys` token into GitHub → Settings →
  Secrets for BOTH `BigMountainB/Roadtrip-Roulette` and `BigMountainB/DUI`.
  ⚠️ **Do not fix the token without also rewiring `cloudflare-pages.yml`** per "Deploy conflict"
  below — fixing only the token makes CI green again, and a green CI run still runs
  `wrangler pages deploy dist`, which clobbers `/fully` and the marketing site on the very next push. **FIXED 2026-08-10 — it deploys `website/` now; see Chapter 2.**
- `website/fully/` had been tracked in git this whole time — 601MB of build output, unlike
  `website/demo/` which was correctly gitignored from the start. Almost certainly why past pushes
  in this repo have been huge and slow (one earlier push this arc uploaded 584MB). Added it to
  `.gitignore` and `git rm -r --cached` to untrack (local files kept) — both `/demo` and `/fully`
  are now pure build output, deployed straight via `wrangler`, never committed.
- `GameOverScene.js`'s demo-complete end screen still had a dead App-Store-era CTA
  (`APP_STORE_URL` was `''`, so it showed "Full game coming soon to the App Store" with no link
  anywhere) — leftover from before the 2026-07-26 pivot to web-first monetization. Now shows
  "GET THE FULL GAME", opens `/fully/` in a new tab.
- Also flagged, not yet acted on: the 11 shop-staff portrait PNGs
  (`public/assets/npc/businesses/*.png`) are 3.2–3.5MB each for a 1086×1448 image — compressing to
  PNG/WebP should get each well under 500KB with no visible quality loss. Owner hasn't confirmed
  they want this done.

### 2026-07-27 — Game DEPLOYED to CF Pages (local wrangler); GitHub-Actions deploy still broken until secret update
Committed + pushed the whole accumulated batch (4375424: website, worker entitlements, trait
rebalances, parallel-session save batch). **Root cause of the stale live site**: RTR deploys via
`.github/workflows/cloudflare-pages.yml` using GitHub secret `CF_PAGES_API_TOKEN` — that secret holds
the token that EXPIRED 2026-07-22, so every push-deploy since failed (verified: last green run
2026-07-22, the expiry day). Worked around with a clean local build + `npx wrangler@3 pages deploy
dist --project-name=roadtrip-roulette` → live at roadtrip-roulette.pages.dev (culture sprites verified
serving). **⚠️ OWNER TODO: update `CF_PAGES_API_TOKEN` in GitHub repo settings for BOTH
BigMountainB/Roadtrip-Roulette and BigMountainB/DUI** (classifier blocks Claude from writing repo
secrets) — until then push-to-deploy stays red and deploys must be run locally. Note: the pages
project serves the GAME build only; the marketing `website/` is still undeployed (needs its own
CF Pages project).

### 2026-07-26b — BETA MONETIZATION design locked + worker entitlements BUILT; CF token EXPIRED blocks deploys
Owner pivoted the demo into an à-la-carte beta ("web is the product; Steam later as premium bundle"):
- **Pricing ladder (owner-approved)**: GUEST plate = FREE to North Bend (mi 32) · **$1 custom plate =
  full route + leaderboard identity + 1 starter genre** · **$3/genre** (alternative to $25k in-game
  dealer buy) · **$1/plate per save slot, $3 = all three WA/OR/ID slots** (state plates ARE the 3 save
  slots — GameScene `PLATE_KEYS`, not cosmetics) · **$10 all-in beta deal** (everything).
- **Worker entitlements BUILT** ([worker/src/index.js](worker/src/index.js), [worker/schema.sql](worker/schema.sql)):
  `entitlements` table (player_id, sku) · `GET /api/entitlements?playerId=` · `POST /api/grant`
  (gated by `GRANT_SECRET` wrangler secret; accepts atomic skus + bundles `starter`/`all_access`,
  expanded server-side so the client only checks atomic skus). Payment webhook will reuse `grantSkus()`.
- **Payments**: undecided. Fee table shown to owner; recommendation = Stripe w/ checkout upsells +
  $10 all-in front-and-center (PayPal micropayments 4.99%+9¢ is the only <30%-on-$1 option). Apple/
  Google Pay = wallet buttons on top of Stripe et al, not standalone processors. iOS Capacitor build
  must NOT link to web purchases (App Store IAP rule).
- **✅ WORKER DEPLOYED 2026-07-26**: `https://roadtrip-api.brendanbaughn.workers.dev` (the exact URL
  CloudSave.js expects) — D1 `rtr` created (id `d3e421f9-ccb1-40ad-ba25-643a8ab17d05`, in
  wrangler.toml), schema applied (players/leaderboard/entitlements), `GRANT_SECRET` set (local copy in
  gitignored `worker/.dev.vars`). Smoke-tested live: plate check, leaderboard, entitlements, grant
  (bad secret → 403; `starter`+country → route_full+plate_custom+genre_country; test rows deleted).
  **Plate uniqueness + cloud saves + world leaderboard are now LIVE for the game**; the site's
  leaderboard page reads real (currently empty) data. Redeploy after worker edits:
  `cd worker && set -a && . ../../DUI/.cloudflare.env && set +a && npx wrangler deploy`.
- **CF token REPLACED** (old one expired 2026-07-22): new token `rtr-dui-deploys`, NO expiry,
  scopes Workers Scripts/D1/Pages Edit, lives in gitignored `DUI/.cloudflare.env` (shared by DUI
  Pages deploys and RTR worker; RTR has no separate env file). Wrangler works fine with it on this
  setup (d1 create/execute + deploy + secret put all succeeded first try).
- **Deleted dead `server/`** (stale DUI worker copy carried by the fork; superseded by `worker/`).
- **Game-side gating: plan APPROVED, build deferred to NEXT SESSION** (owner). Design owed: ONE
  master kill-switch `BETA_GATES_LIVE` (GENRE_LOCK_LIVE pattern; false = all gates inert), additive
  only — new `src/systems/Entitlements.js` (boot-fetch `/api/entitlements`, localStorage mirror OUTSIDE
  the save, `has(sku)`), GUEST plate free→North Bend wall on rest-stop depart at stop N (mi 32),
  custom-plate claim gated on `plate_custom` (slots 2/3 = own skus, $3 all three), entitled genres
  merge into `__genre.owned()` beside the $25k dealer path, localhost dev ungated (CloudSave guard).

### 2026-07-26 — Marketing WEBSITE built at `website/` (9 pages, static, no framework) — LOCAL, not deployed
Owner-approved plan: story = **broke touring musician** (Pullman gig = the big break); demo =
**Seattle→North Bend, 2 genres (country + hiphop_phonk)**; soundtrack plays **FULL tracks**; leaderboard
reads the REAL worker (deploy approved, push still gated). Pages: `index / story / genres / walkthrough /
map / leaderboard / faq / press / demo`.
- **Data-driven from the game**: [website/js/data.js](website/js/data.js) hand-extracted from
  AudioSystem STATIONS (names/colors/bpm), genreVehicleTraits (10 vehicles + strengths/weaknesses +
  top/cruise mph), constants REST_STOPS + pass-throughs (23 route entries), townFacts (trimmed), and the
  actual mp3 filenames (108 tracks). `musicDir` mapping: `edm_rave→edm`, `k_pop→kpop`.
- **Assets are DERIVED + GITIGNORED** (`website/assets/`, 342 MB): run
  [website/sync-assets.sh](website/sync-assets.sh) to copy music, culture starter sprites, genre art,
  title/loading screens from `public/assets` (source of truth per DUI/RTR asset rule). `website/demo/`
  also ignored (future demo build output).
- **Genres page**: tab per genre (station color), starter front/back sprites, trait boxes, full-track
  audio player (one `Audio` at a time). **Leaderboard page**: fetches
  `GET {API_BASE}/api/leaderboard?metric=score|miles|time` — worker CORS is already `*`, NO new endpoint
  needed; graceful "unreachable" fallback until the worker is deployed. **Demo page**: placeholder that
  auto-swaps to an iframe when `website/demo/index.html` exists.
- **Still open**: (1) DEMO_MODE game build (route cap at North Bend mi 32, 2-genre lock, buy-wall) —
  needs owner sign-off on approach before touching game code; (2) worker deploy (`worker/README.md`
  steps) — owner approved doing it, but actual wrangler push awaits explicit go per push rule;
  (3) site itself not deployed anywhere yet (likely its own CF Pages project, NOT the `dui` one).
- **Story page is now CINEMATIC SCROLL (2026-07-26c, revised same night)**: owner's 6 panoramas in
  `website/assets/story/origin-0N-*.png` (~3:1 = 3 panels each) pan left→right while pinned — pan
  progress runs over the PINNED window only, so each image STARTS with its left border on the
  screen's left edge (owner spec). Text = owner's 18 captions VERBATIM (3 per scene, one per image
  third) crossfading in sync with which third is on screen, at 52.5px (3× old body — owner spec);
  scene height 240vh (~2.4 screens/scene, replaced the earlier 1.5-screen pacing to give 3 captions
  room). Desktop = full-bleed art, caption low over scrim; portrait phones = art as top-52% band,
  captions in the dark area under it, font capped clamp(21px,6vw,49.5px) to physically fit (only
  deviation from the 3× spec). prefers-reduced-motion = static art + all captions stacked.
  Implementation: sticky `.scene-frame` + rAF handler in [website/story.html](website/story.html),
  site.css §Story scenes. Captions later shrunk 40% (31.5px) + set in **Dinofans** (Gradia Light
  fallback; both embedded in `website/fonts/` from ~/Library/Fonts). ⚠️ **Khurasan commercial font
  license must be purchased BEFORE commercial sales go live** (owner: "when we commercially sell,
  I'll grab the license") — add to release checklist. `.gitignore` narrowed to only SYNCED asset subfolders
  (music/culture/genre_art/ui) so `assets/story/` is COMMITTED.
- Local preview: `cd website && python3 -m http.server 8090`.

### 2026-07-23 (parallel session) — Progression → PLATE profile, save-whitelist drops (upgrades/manualSave), START resume prompt, server newest-wins load, Rage/Espresso rename, dev cheats behind `?dev=1` — LOCAL (unpushed)
The "parallel session" referenced by the entry below. Save-architecture + resume/UX batch.
- **PROGRESSION now belongs to the PLATE, not the steering type** (owner: "change the storing rules to
  plate profile instead of steering type profile"). `ownedCars / currentCar / upgrades / tempUpgrades /
  accessories / viceInventory / missionProgress / lastRestStop / restStopSaves / liveRun / manualSave /
  survivalState / activeBuffs / controlsLayout(+Ver)` all moved into `GLOBAL_KEYS` + `DEFAULT_GLOBAL` and
  are sanitized in `_sanitizeGlobal`. Money was already global. **Per-mode `profiles` buckets are now
  vestigial** (kept only to read + lift legacy saves). Switching driving type keeps everything; saves are
  one-per-plate, so `latestLiveRun` reads global directly instead of scanning three buckets.
  [SaveSystem.js](src/systems/SaveSystem.js)
- **Migration `liftProgressionToGlobal` (idempotent, best-effort keep)** — runs every load, **merges**
  rather than overwrites so re-running is safe: owned cars / upgrades / accessories **unioned**; vice
  inventory + mission progress **max**; liveRun / manualSave / lastRestStop **newest by ts**; restStopSaves
  unioned by code; `currentCar` adopts the **richest (most-money) mode's** car so migration can't silently
  drop you back into the Beater; controls layout adopts the most-customized mode (never downgrades a null
  → baked-default layout to an empty `{}`). Clears the moved keys from the vestigial profiles afterward.
  Verified by a **22-case node harness** (union, save→reload idempotency, fresh-slot defaults).
- **Two more save-whitelist drops fixed** (same class as the audit below): `manualSave` and
  `upgrades`/`tempUpgrades` were written but never copied in `_sanitizeProfile`, so **every reload wiped
  them**. Symptoms: "NO SAVE FOUND" after Save→reload; and **all purchased upgrades wiped → max HP stuck at
  the Beater base 25** (plus every other upgrade effect — grip/speed/range — silently lost).
  ⚠️ Upgrades bought before this fix were never persisted and can't be recovered — re-buy once.
- **START now looks for a save and asks** (owner: "ask the player, based on wallet amount"). New
  `_buildSavePrompt` — a 3-button modal (**RESUME / NEW RUN / CANCEL**) showing the save's **wallet $ +
  location + mile** so the choice is made with the money in view. Triggers off the LOCAL save only, so
  START stays instant; no save → starts fresh exactly as before. Fixes the footgun where START silently
  began a new run and the rolling autosave overwrote an in-progress trip.
- **LOAD SAVE = newest-wins (local vs server)** — snapshots now carry a `savedAt` stamp (the Worker's GET
  returns no timestamp of its own), and `_resolveNewestSave` compares the local save against
  `CloudSave.get(playerId)`, resuming whichever is fresher. Degrades cleanly to local when the API is
  unreachable. NOTE: CloudSave is disabled on `localhost` by design, so the server half only exercises on
  the deployed build — deliberately NOT tied to `?dev=1`, since that would write test data to production
  every dev session.
- **Resume fidelity fixes** — (a) the snapshot now records the **actual driving type** (`steering`);
  resume was inferring it from the storage bucket, and DEFAULT steering saves into the `'tap'` bucket, so
  every resume **forced TAP**. (b) Resume max HP = **larger of** the current persistent-upgrade cap
  (`_runMaxHp`) **vs** the snapshot's `hpMax`, so upgrades bought since the save are honored instead of
  being capped by a stale value.
- **Steroid/Narcan → Rage/Espresso rename** (owner: "change any code that refers to steroids or Narcan").
  All identifiers renamed across [GameScene.js](src/scenes/GameScene.js) / [BootScene.js](src/scenes/BootScene.js) /
  [CopSystem.js](src/systems/CopSystem.js) — `_rageUntilMile`, `_updateRage`, `_startRedneckRage`,
  `_espressoCount`, `_tryEspresso`, `_makeEspressoSprite`, collectible types `'rage'`/`'espresso'`. Sprite
  keys/art/HUD text were already reskinned; this closes the loop (zero `steroid`/`narcan` left).
  **Rage invincibility 1 mi → 2 mi.**
- **Dev cheats gated behind `?dev=1`** (beta-safety): DEV WARP digits 1–9, back/forward warp (B/N), F3
  debug overlay, F4 camera toggle, K cockpit-calibration, and `__daily.all()`'s "Test any run" Calendar
  list are all inert on a plain URL — testers can't trigger them by accident, owner keeps them with the
  flag. `V` (first/third-person view) left ungated as a real player feature.
- **Wiper works in ALL weather** (owner: "get the windshield wiper to work all the time") — the button was
  already permanent, but `_wiperMode` was force-parked to 0 every frame outside rain/snow, so a tap did
  nothing when dry. Force-park removed; blades keep whatever state the player set.
- **Rock chips reworked** — the two tiny stock chips replaced with big star-break impacts (crystalline pit
  + faint bullseye stress rings + tapered splinters with a few long light-catching glints, matching the
  owner's reference photos), ~5× bigger and relocated to clear **centre glass** (≈335,216 / 500,274) so
  they no longer sit behind the survB Drinks/**Food** bars. The long bottom crack is untouched; positions
  are a tunable array at the top of the block in `_drawStockGlassChips`.

### 2026-07-23 — Wallet persistence root fix, save-whitelist audit, Custom sandbox, fog lights visible, 5★ barricade pacing, town-line stars — LOCAL (unpushed)
Full-day batch on top of yesterday's push (`90fcdc7`).  Parallel session concurrently moved ALL
progression keys to the plate-global bucket (per-mode profiles now vestigial) + `upgrades`/`manualSave`
whitelisting — this entry covers this session's work.
- **Wallet $0-on-START root fix**: the save sanitizer's whitelist DROPPED the per-profile `wallet` key on
  every load, wiping banked money each session.  All four bank sites (run-start read, rest-stop bank,
  game-end bank ×2) now use the plate-global `walletStore.money`; loader salvages any surviving legacy
  `wallet` value into it.  [SaveSystem.js](src/systems/SaveSystem.js) + [GameScene.js](src/scenes/GameScene.js)
  + [RestStopScene.js](src/scenes/RestStopScene.js).
- **Save-whitelist AUDIT (owner-requested full scan)**: found 7 more keys persisted-then-wiped every boot —
  `genre` (per-plate culture; global rtr.genre mirror masked it as one shared genre), `girlTexts/
  girlResponded/girlSkips/girlGone` (friend arc reset; "gone" resurrected), `coldBrewCount`,
  `encountersSeen` (once-only encounters replayed), `factRotation`.  All whitelisted in _sanitizeProfile.
- **Default-radio unset state**: sanitizer materialized `settings.radio: 0` → after any reload every
  player "chose" HIP-HOP.  Now `-1` = unset + a `radioSet` flag marks deliberate stars; unflagged legacy
  values reset to unset (weighted-random start restored).  Deliberate pre-existing HIP-HOP stars must be
  re-set once.
- **Custom mode = throwaway SANDBOX** (owner: custom upgrades leaked into Easy): while a Custom run is
  active, all run-progress keys (`SANDBOX_KEYS` — upgrades/accessories/radar/vices/money/saves/…) route to
  an in-memory bucket: fresh start, session-only purchases, discarded on exit, real profile untouched.
  Armed in create() + _startGameplay (title switches mode without a restart).  Phone Save in Custom now
  toasts **"Custom games don't save"** instead of a false "✓ Game saved".  Owner note: existing leaked
  upgrades left in place (owner will delete the plate profile if wanted).
- **Coal-lull phantom PULL OVER fixed (option b)**: a trap tripped during coal's 30 s lull now CLOCKS you
  quietly (+1★, "📸 Trap clocked you through the smoke") — no comply window, no phantom/teleported
  trooper.  `_spawnRearFromEncounter` returns its cop (null when gated) so `_spawnTrapPursuit` can never
  blind-tag `cops[last]` again.
- **Fog lights actually visible**: the old hook only thinned NPC-sprite fades.  New central
  `Weather.setFogClarity(0.5)` (installed = 50% per owner spec) thins ALL fog visuals together — the
  EffectsSystem screen haze/veil/wisps, Road.js distance fog, and every fogParams consumer.  Physics
  (grip via Weather.intensity) untouched.
- **5★ barricades drivable**: rows now 0.1 mi apart (owner spec; was ~0.03 mi ≈ impossible slalom) and the
  maze spawns just BEYOND the 76k draw distance (~78k) so rows come over the horizon instead of
  materializing mid-screen (~3.5 s + ~1.4 s/row at 100 mph).
- **Radar detector quiet at 3★+** (owner: "just an annoyance" mid-pursuit); re-arms below 3★.
- **Town-line star cooldown = TOWN list** (owner): −1★ keys off CHECKPOINTS (the HUD label), not palette
  regions — West Seattle→Seattle drop now lands at the label change (mile 2), and the lake's 4-boundaries-
  in-5-miles star melt is gone.  Dead `_regionIndex` + unused Colors imports removed.
- **Custom status-bar drag**: in Custom, press+drag any survival bar (Drinks/Food/Alertness/Bladder,
  horizontal) to set it; degradation + bladder pipeline keep running from the set value.  Never steers,
  yields to vice-bar drags + the controls editor.
- **Vomit slide-off 2× slower** (1.6 s → 3.2 s; oozes off, same fade curve).
- **Title cards**: dark `dynamicFill` boxes removed from DIFFICULTY / DRIVING TYPE (values sit on the
  baked art); value text centered on measured card centers (343 / 502).
- **Wallet-multiplier explained** (no code change): it's a straight count — Drinks 25-75, Food 25-75,
  Alertness>75, Bladder<25, each +1, wanted stars stack; NO base 1×.  Zero conditions = 0× earnings.
  Sweet-spot is strict (exactly 25 doesn't count).  Owner may want a base-1× or HUD breakdown later.
- **Genre dealership PLANNED (do not delete dealer_cars code)**: dealers to sell genre/culture cars at
  $25k (soundtrack + ride + sprite art) — memory saved; RestStopScene dealer machinery deliberately kept.

### 2026-07-22 (pt 2) — NPC-over-player ROOT CAUSE fixed (UI-cam double-draw), Coal smoke-out, title-zone alignment, one-tap LOAD SAVE, 50/50 tap steering, resume-music fix — SHIPPED 2026-07-22
- **Title bottom-menu zones traced to the baked art** (owner: "buttons should match the image"): all four
  zones (START / DIFFICULTY / DRIVING TYPE / LOAD SAVE) now use art-measured rects via `titleRectShape`
  (slanted `titlePanelShape` deleted) — START (18,345 237×74), DIFF (265,346 157×75), DRIVE (429,346
  146×75), LOAD SAVE (585,345 193×74, owner-nudged) — so the full plate is tappable and the hover outline
  hugs the frame.  Tutorial highlight rects match.  Plate bounds measured from title_screen.png (1672×941,
  2.09× the 800-space) by scanning the dark inter-plate gaps.
- **LOAD SAVE = one-tap resume, NEVER the code popup** (owner): phone-menu Save now also writes a durable
  per-profile `manualSave` (rolling autosaves can't clobber it), and `_titleLoadSave` resumes priority
  manualSave → autosave (`latestLiveRun(key)`) → lastRestStop → red "NO SAVE FOUND" toast.  The wheel's
  'saved' branch routes the same way.  Pause-menu FROM CHECKPOINT keeps its code-modal last resort
  (different flow, untouched).
- **Tap steering: line down the middle** (owner): classic/THUMBS halves were 30%/70% — the middle 40% was
  dead (top part a hidden center-tap weapon shortcut).  Now sx < SCREEN_W/2 = left, else right, on tap AND
  drag; center-tap F12 shortcut removed (weapons fire from their buttons; F key still works).
- **Resume runs had NO music** (owner: "music isn't playing by default"): `_kickRadio` only fired in
  `_startGameplay` (fresh runs) — LOAD SAVE / auto-resume / checkpoint boots skipped it, so a session
  booted into a resume stayed silent.  Both resume dispatchers now kick inside their tap's gesture frame
  + a first-input fallback on any non-title boot.  Also registered 7 unregistered metal tracks
  (arcade_renegades, concrete_animal, crystal_speedway, mall_riot_summer, nitro_saints, perms_pistols,
  powder_vision) → 108 tracks, all verified on disk.
- Also in this batch (parallel session): phone-menu safe-area bottom inset CSS, `?dev=1` gating for dev
  affordances (Calendar "Test any run" list empty for beta testers), GameOver plate/save tweaks.
- **NPC-over-player layering — REAL root cause** (owner confirmed FIXED after repro): NOT a depth/sort
  problem.  GameScene splits rendering across two cameras (main = world, `_uiCam` = HUD); every world
  object must be listed in `_worldObjects` so `_uiCam.ignore()` skips it.  **`_carOutlinePool` (the
  enlarged same-texture outline-rim copy of every car) and `_npcHeadlightGfxPool` were missing from that
  list** → the UI camera re-drew each car's outline copy ON TOP of the whole world.  Pixel-aligned with
  the body, so invisible everywhere EXCEPT where the car should be occluded — i.e. overlapping the player
  ("car in front renders on top of my car", present since the DUI fork; same bug class as the old
  tire-shadow/headlight double-draw fixed in the comment right above).  Fix = the two missing entries in
  the `_worldObjects` block ([GameScene.js](src/scenes/GameScene.js) ~L2323).  Diagnosis trail: earlier
  screen-Y crossover removal (pt 1, still correct) → temp on-screen depth probe showed depths/list order
  CORRECT while pixels inverted → camera-level re-draw was the only remaining mechanism → `_uiCam.ignore`
  audit found the gap.  Probe was temporary and is REMOVED.  **⚠ DUI has the same bug** (outline pool +
  camera split predate the fork) — port the two-line fix there.
- **Rolling Coal reworked to SMOKE-OUT (Option 1 — coal ENDS the chase)**: a cop caught in the cloud (at
  fire, or driving into it within its life) now BREAKS PURSUIT via the existing `_fleeNoSwerve` flee
  (keep pace 1.5 s → sink straight back into the smoke → despawn).  Replaces the 60 mph/30 s slow-cap,
  which kept the cop visibly chasing — at player speeds ≤60 it read as "the first cop withstood the coal"
  (owner's report; the FIRST cop of a run comes off the first speed trap at low speed).  Coal during the
  PULL OVER comply window now QUIETLY cancels the civil stop (no "+1★ failed to pull over" after a landed
  smokescreen); a HELD stop stays non-cancelable.  Metal's "Weapons last +25%" (weaponDurationMult) now
  stretches cloud life (5→6.25 s) + spawn lull (30→37.5 s) since its old consumer (the slow timer) is
  gone.  coal.test.mjs rewritten to smoke-out semantics incl. a 55-mph regression case (25 tests).
  KNOWN REMAINING (owner deferred): trap tripped DURING the 30 s coal lull mis-tags a random cop as trap
  pursuer (`_spawnTrapPursuit` grabs `cops[last]` after the lull-gated spawn silently no-ops) → phantom
  PULL OVER window.

### 2026-07-22 — Rest-stop business map, dealer split, EV-charging removal, NPC depth fix, plate mandatory + uniqueness Worker — SHIPPED 2026-07-22
Batch pushed together with the 4 earlier local commits (money double-spend fix `eb1a625`, plate defer `a7b79c5`,
plate mandatory + worker scaffold `397c335`/`8ee00fb`).
- **Per-stop business list (owner table)**: all 19 `REST_STOPS.amenities` in [constants.js](src/constants.js)
  now carry the exact businesses the owner specified per stop (e.g. Seattle = CarGo·Lord·Sam's·Park&Ride·
  Gas-N-Sip·AM/BM; Hatton = Huff's·AM/BM). Amenity keys: `gas`(Huff's) `cargo`(CarGo) `hunting`(CowBella)
  `camp`(AOK) `lord` `suck` `parkride` `vices`(Gas-N-Sip) `ambm`.
- **Dealers split into two businesses**: `lord` (Lord Motors) + `suck` (Sam's Used Car Kingdom) are separate
  landing placards — a stop can have either or BOTH (Seattle/Bellevue have both). Both tiles open the shared
  ACCESSORIES menu; header titles itself with the tapped brand (`_activeDealerBrand` in
  [RestStopScene.js](src/scenes/RestStopScene.js)). Regional `dealer` key kept only as vestigial fallback.
  Owner then added Lord Motors to Cle Elum (west side, mile 84). Phone-map `BIZ_LOGO` in [index.html](index.html)
  switched to the explicit per-amenity mapping (isWest now unused).
- **EV charging REMOVED** (car is always gas): FAST CHARGE/NO CHARGER item, `hasCharger()`, the `charge`
  buy-handler + its ad path (`chargeAdMs`), `SHOP_VICES.charge` pool, and `CHARGE_COST_FACTOR`/
  `CHARGE_AD_SECONDS` constants all deleted. CarGo tab = gig hub (hitchhikers past mi 18) + bottled water
  (water added so the tab is never empty at early west stops). Gas refuel untouched. NOTE: Lord Motors still
  *branded* EV (`carFuel: 'electric'` metadata on the vestigial dealer path) — cosmetic only.
- **NPC-over-player layering FIX** (owner: "in-front cars display on top of the player, persisted since the
  DUI fork"): removed the 2026-07-20 screen-Y painter's crossover in `_renderVehicles`
  ([GameScene.js](src/scenes/GameScene.js) ~L13160). The forward pass culls everything behind the player
  (`relZ < nearCull`), so every car it draws is AHEAD in world space — the crossover's "bumper below player's
  bumper ⇒ behind ⇒ paint over (depth 9.96+)" misfired on close tailgated cars + downhill-compressed
  projections. NPC bodies now always ≤9.83 < player 9.95; behind-cars exist only in the mirror pass. Verified
  outline rim (depth−0.005), ghost (−0.01), headlight gfx (5), cop lights (9.75) all sit under the player.
  TEMP tailgate console-log probe deleted. **Playtest check: tailgate closely + follow a car downhill.**
- **Plate mandatory**: `showPlateModal({required:true})` (CANCEL hidden, Escape/backdrop blocked) at first-run
  START + tutorial plate step — no blank/default name can reach a run. Settings rename stays dismissible.
- **Plate-uniqueness backend scaffold** in `worker/`: CF Worker + D1 (`plate_norm` UNIQUE = uppercase
  alphanumeric ≤8) matching the CloudSave.js contract (save/plate/leaderboard). **NOT deployed** — saved
  Pages token can't do Workers/D1 (auth error 10000); owner must `wrangler login` + follow worker/README.md,
  or drop a scoped token in worker/.cloudflare.env. Until then uniqueness is NOT enforced.
- **Music files renamed on disk** to lowercase/snake_case (`Norteno/Almas de la Orilla.mp3` →
  `norteno/almas_de_la_orilla.mp3`, 39 files); AudioSystem paths verified to match, no stale refs.
- Also in this push from earlier sessions: missions pay 5× (`PAYOUT_MULT`), donut-cop slower recede, gas-light
  icon on analog gauge, upgrade rebalance HP wiring, speed-bonus band (cruise ±15%), road-rage at alertness 0,
  Lawyer/Plug removal, coffee/caffeine rename, tutorial reorder, wiper-next-to-accel, HUD layout v9.

### 2026-07-19 (pt 5) — One-vehicle model + explicit speed table + survival reworks — LOCAL (unpushed, commit `55d8914`)
Owner batch during traits playtest. **The game now has ONE vehicle — the beater** — whose look + traits come
from the SELECTED genre; you "choose" a car by choosing/unlocking a genre and you upgrade that single car.
- **Purchased vehicles REMOVED**: the 7 buyable types (`suv4x4`, `usedTruck`, `newTruck`, `evTruck`,
  `sportsCar`, `bestlaRoadster`, `playdoutS3X`) deleted from `VEHICLES` (only `beater` remains). The rest-stop
  Dealer no longer sells cars — its tile opens **ACCESSORIES/upgrades** (`dealer_acc`) directly instead of the
  old Cars/Accessories chooser. `dealerVehicleItems()` build + `_showDealerChooser` are now unreachable (inert
  dead code, left for a focused sweep). GameScene `create()` migrates old saves: any `vehicleId`/`ownedVehicles`
  pointing at a deleted car resets to `beater` (garage `list()` already `.filter(Boolean)`s, picker uses
  `Object.keys(VEHICLES)` = `['beater']`). This also fixed the owner's "220/250 mph classic-rock" report — that
  was the roadster (a purchased car), not the genre beater.
- **Explicit top + cruise speeds** (owner table): each genre trait now carries BOTH `topSpeedMph` (pedal-DOWN
  max, no caffeine) and `cruiseMph` (no-pedal cruise) — no more 75%/boost-delta approximation. Values: EDM
  165/145 · Classic-Rock 150/135 · K-Pop 145/125 · Hip-Hop 140/120 · Reggaeton 135/115 · Norteño 130/110 ·
  Pop-Punk 125/105 · Country 120/100 · Metal 110/90 · Reggae 100/80. Speed model reads `_gvt.cruiseMph`/
  `_gvt.topSpeedMph`; caffeine + upgrades stack on both. Garage panel + trait popup show **TOP / CRUISE**.
  (Brake speed is still a flat 60-mph floor for every car — `slowMph=60`; `brakingMult` only changes decel rate.
  Per-car brake floors await an owner column.) **180 genre tests** (added cruise + cruise<top checks).
- **Bladder = digestion-driven**: fills over the miles by +40% of the food-bar drop + 20% of the drink-bar drop
  each frame (SurvivalSystem `update()`), NOT at the moment of eating. Consume-time fill + `_bladderGain()`
  removed; bad-fish emergency + diuretic claw-back retained (the claw-back feeds the drink-drop).
- **Gas-station water → +3%** hydration (was +15%): a bottle is a sip, not a tank.
- **Overheat tied to the ACCELERATOR**: engine-temp target now = accel-pedal load (boost=1.0 / coast=0.40 /
  brake=0, analog in tilt) × speed, + ambient + topography (climbLoad) + cooling upgrades (coolFactor) — the
  four inputs the owner named. Replaces the old speed²+boost `speedLoad`.

### 2026-07-19 (pt 4) — Genre Vehicle Traits system + playtest fixes — LOCAL (unpushed)
Data-driven gameplay identity for the 10 culture STARTER vehicles (the re-skinned beater); purchased
non-culture vehicles keep normal VEHICLES stats.
- **Config** `src/data/genreVehicleTraits.js`: each of the 10 with explicit modifier fields (neutral
  defaults), 2–3 strengths, 1–2 weaknesses, a unique top-speed, player-facing name. `genreTraitFor(genre,
  vehicleId)` resolves ONLY on the beater with a culture set (else null); `traitMods()/mult()` read with
  neutral fallbacks. Trait is DERIVED (never stored) so it can't double-apply on resume/restart. Accessor
  in GameScene: `_activeGenreTrait()` / `_traitMod(field)`.
- **Integrated so far**: top-speed (pedal-DOWN top; caffeine/upgrades stack; cruise one boost-delta below),
  accel/brake/steering mults, snow-steering penalty (hazard × snow), damage (all × collision/scenery),
  fuel (burn × 1/range), max-HP, wanted-decay (pushed to CopSystem), ticket surcharge, driving cash (flat ×
  bonus-earnings × hi-speed>gate × low-HP<gate), reggae low-speed full-earn, survival drains (general ×
  <100mph × boosting via ctx), engine "ignore first overheat / leg" (per-leg flag, resets on region change
  + restart), metal weapon bonus-use (rng-injectable helper). Tests: 148 (config, resolution, top-speeds,
  multiplier math, bonus-use RNG).
- **Now also integrated** (pt3–pt6, commits `39b4a27`→`942eef4`): mission payouts (passenger/timed/cargo,
  cross-scene via a registry-published `genreTraitMods`), weapon effect duration (coal slow), survival
  BENEFITS (reggae over-fill penalty, edm caffeine boost, reggaeton drink/caffeine hi-speed boost via an
  `applyItem` mods param), pickup radius (widened collect window), hazard instability (crosswind pull), edm
  ACCEL boost strength + duration (accel-charge drain), norteño cargo collision shield (consume-once,
  restart-reset, `cargoShieldAbsorbs` helper + 7 tests). **155 genre tests.**
- **Repair/upgrade discount (pop-punk) — DONE**: RestStopScene repairs discount `effectiveCost` (display +
  affordability + charge stay consistent); garage part-upgrades discount in the `__upgrades` bridge
  (`slots()` display + `buy()` charge), reading the published `repairUpgradeCostMult`.
- **First-violation instant star (reggaeton) — DONE**: the FIRST moving violation (speeding / crossed the
  double-yellow while clocked) lands a wanted star instantly, skipping the 0★ civil-stop grace. Per-run flag
  resets on restart → no double-apply.
- **Police warnings + reggae no-warning — DONE (owner 2026-07-19)**: a low-level traffic stop (≤1★) now has
  a **25% chance of a WARNING** (no fine) instead of a ticket (`policeWarningChance` helper + 5 tests).
  Reggae's `noPoliceWarning` trait zeroes that chance, so it always eats the ticket — the trait finally has
  something to suppress. **40/40 modifiers integrated.**
- **Playtest fixes (shipped in the same batch of commits)**: region gold-pulse (dropped NOW ENTERING),
  gold invincibility flash, coal first-fire slow, donut in-lane 1s hold + straight recede, one NPC per rest
  stop, invisible pedals w/ gold throbbing glow, "COP HIT +1 ⭐" + lowered Pursuit/cop-hit HUD.

### 2026-07-19 (pt 3) — Vendors, CarGo rework, mission dialogue, editor reset — SHIPPED 2026-07-19
- **Gas at Gas-N-Sip + AM/BM** (`RestStopScene`): both convenience stops now offer the same REFUEL as the
  gas tab (shared item ⇒ topping off anywhere fills the tank once). CarGo/Huff's already sold gas.
- **$10 water at every gas vendor**: gas tab dropped $15→$10; Gas-N-Sip + AM/BM each get a $10 water.
- **Huff's = universal gas; CarGo = its own vendor** (owner: "no CarGo without Huff's"). Huff's pumps gas
  at every gas stop. New `cargo` amenity/brand/tab at the same 4 west stops (Seattle, North Bend,
  Snoqualmie Pass, Cle Elum). CarGo no longer sells gas — the **EV FAST CHARGE moved** off the gas tab into
  CarGo, and past **Issaquah (mi>18)** CarGo adds the **hitchhiker** pickup. (Ready drop-offs still collect
  via their own panel — callout added but the collect UI wasn't relocated; the job-offer NPC is still
  roaming, not pinned to CarGo — both easy follow-ups.)
- **Mission dialogue**: opener is a **10-line pool** picked stably per stop (was the same "doesn't ask
  questions" line everywhere); reply buttons are now **statements, not questions** (fixes the irony);
  cargo/passenger offers **name the drop-off** — "the CarGo in <city>" when the destination has a CarGo lot.
- **Donut hold**: 1.5s → **2s** on-screen before the cop peels off.
- **Controls-editor RESET** (`_resetControlsLayout`): now restores the **shipped `DEFAULT_HUD_LAYOUT`** (the
  layout the game starts with), not the empty/base layout it used to snap to.
- **Lowered 3 HUD elements ~10px** in the default (`LAYOUT_VER` 4→5, so it's both the start default and the
  reset target): Pursuit warning (`rearCop`), Pickup/Text alerts (`popup`), Damage-taken flash (`hpDamage`).

### 2026-07-19 (pt 2) — Fixes from on-device testing — SHIPPED 2026-07-19
Follow-up batch, all committed locally, awaiting push.
- **Plate modal no longer forced pre-tutorial** (`GameScene` `_startGameplay`): a run starting mid-tutorial
  (a Calendar "Test any run" PLAY → `__daily.start` → scene restart → `_startGameplay`) auto-popped the
  first-run DRIVER PLATE modal before the tutorial's own plate step. Guarded so it stays quiet while any
  guided stage is active (`__tut.active`, `rtr_tutStage1/2`, `_titleTut`); normal first runs still prompt.
- **Genre-change crash fixed** (`_applyGenreArt`): changing genre mid-run removed+re-added each genre
  texture key (destroys the Texture OBJECT), but only the player sprite was re-pointed → every other live
  user (pickups, weapons, headlight bitmap-masks, pooled cars) rendered a dead texture →
  `get`/`batchSprite`/`drawBitmapMask` WebGL crash. Now walk the display list to collect every live user of
  each swapped key, swap, then re-point them all (preserving on-screen size). Owner chose "swap everything
  live." Bitmap masks follow once their masking sprite is re-pointed.
- **All vehicles = the beater's visible width** (`_applyPlayerSpriteDisplaySize`): a prior "pin frame width
  to 78" shrank the new/genre cars (their art has big transparent margins). Reverted to visible-body sizing
  referenced to the **beater's** own opaque-fill fraction (beater = natural size, others scale up to match).
  `_opaqueFillFrac` now only caches a REAL measurement, so a car sized before its texture loaded self-corrects.
- **Donut 1.5s hold** (`CopSystem`): after the donut box is thrown, affected cops hold on-screen for 1.5s
  (keep pace with the player, veer toward the donuts) before the recede off-screen kicks in.
- **Menu art −3px per side** (`index.html` `recomputeCover`, `EDGE` 15→18): the iPhone rotate strip still
  tucked under the home-indicator bar; added 3px of margin per side to the CONTAIN fit.
- **Local test URL**: `http://192.168.86.180:3000` (vite dev, `server.host:true`; iOS tilt needs the HTTPS
  variant).

### 2026-07-19 — Menu-size revert + HUD relayout + tutorial polish — SHIPPED 2026-07-19
Batch off owner feedback (iPhone menu shot: `docs/screenshots/2026-07-19-iphone-menu-overcrop.png`
— WEST SEATTLE header + rotate strip clipped by the 2026-07-18 height-pin fill).
- **Menu size REVERTED** (`index.html` `recomputeCover`): back to CONTAIN (`Math.min` + 15px margin,
  centered) — the height-pinned "fill" enlarged the art and cropped it. Kept ONLY the **−5px** upward
  shift the owner actually asked for (a pure translation; scale untouched).
- **HUD default relayout** (`DEFAULT_HUD_LAYOUT`, `LAYOUT_VER` 3→4): reinstalled the owner's fresh
  editor export — score/mult/stars/mission/rearCop placed, engine repositioned, and the **wiper dragged
  to the bottom-left (left of the coal weapon)**. Bumping the version reinstalls it over the old default.
- **Wiper = permanent fixture** (`GameScene`): no longer rain/snow-gated — always on the HUD in gameplay
  (hidden on title / when HUD hidden), label reads OFF when there's nothing to wipe. Still editor-movable.
- **Tutorial boxes 20% transparent**: DOM `#tut-quote` + Phaser title-tutorial & HUD-tour boxes → bg
  alpha 0.8.
- **Tutorial handoff extra-tap fixed** (`main.js` `applyOrientation`): rotating from the portrait tour to
  landscape left the Game scene paused (tap-to-resume), eating the first tap so the plate highlight didn't
  show. On the TITLE screen (`_awaitingStart`) we now resume immediately — no throwaway tap.
- **All vehicles same width** (`_applyPlayerSpriteDisplaySize`): pin every driving sprite to one fixed
  width (78), height scales to each art's aspect. Dropped the visible-fill normalization (+ dead
  `_opaqueFillFrac`). 147 tests pass.

### 2026-07-18 — Responsive layout: menu fill + gameplay HUD safety — LOCAL (unpushed)
Two device-size fixes from the iPad screenshots (bottom red line clipped; gameplay HUD cut on both sides).
- **Phone menu** (`index.html` `recomputeCover`): was CONTAIN (`Math.min` + 15px margin → letterboxed all
  four sides). Now **height-pinned fill** (`scale = vh / ch`): the visible content box always fills the
  viewport top-to-bottom, so the weather widget (top) and rotate strip (bottom) are NEVER cropped —
  pinning the height *is* the crop cap that keeps tablet aspect correct. The crop budget goes to WIDTH:
  modern phones (aspect ~0.46) COVER edge-to-edge (~8px side crop), wider/tablet aspects letterbox the
  sides only. Whole composite (art + hit zones share `coverState`) lifts **5px** so the bottom red line
  clears the edge/Safari bar; the near-black bottom dead-border trails below to fill the vacated 5px (no
  visible gap). Verified via math at SE/15/Pro Max/iPad-portrait.
- **Gameplay canvas** (`src/constants.js` `setWorldWidth`): the HUD is an 800-wide band centered via
  `HUD_OFFSET_X`, but edge controls bleed past it (brake x−39, accel x834, **garage x854 ≈ 54px past**).
  `WORLD_W` floored at `SCREEN_W`=800, so a 4:3 iPad (aspect floors WORLD_W at 800) had `HUD_OFFSET_X`=0 =
  ZERO margin → the bleed clipped off both edges. New **`HUD_SAFE_FLOOR = 940`** (800 band + 70px/side)
  keeps the full HUD on-canvas everywhere; sub-2.09 aspect screens trade a little top/bottom letterbox for
  it. Modern phones (≥2.09 aspect) unaffected (0 letterbox). NOTE it's the fixed-width HUD *bleeding past
  its band*, not a scale bug — Phaser FIT was already correct. 147 tests pass.

### 2026-07-18 — Full guided tutorial (Stages 1 + 2) — LOCAL
Extends the portrait tour into the title screen and the first run.
- **Stage 1a — rotate-wait bridge** (index.html): after the genre pick, a LOCKED golden "Rotate Phone to
  Enter Game Play" prompt; taps do nothing, only rotating to landscape advances (sets `rtr_tutStage1`).
- **Stage 1b — title tutorial** (`_startTitleTutorial`): golden highlights walk Plates (pick + name via
  the existing modal, poll advances) → Difficulty → Driving Type → Load/Save (read + tap) → START. Text
  boxes placed clear of each highlight. START forces the first run to **Easy + Default** and sets
  `rtr_tutStage2`.
- **Stage 2 — paused HUD tour** (`_startHudTour`): the first run freezes on start (no pause menu) and
  cycles all ~25 movable elements (owner-approved descriptions) with a golden highlight + a box on the
  opposite half so it never covers the target. Ends on the **Pause** button — tapping it resumes. Bounds
  come from `_hudElementBounds` (readouts via `_boundsOfTextObj`, controls via the editor's bound fields;
  engine bounds enabled via `_hudTourActive`; empty weapon stash + transient toasts get fallbacks).
- Steering/difficulty forced picks use a new `_titleForceWheels`. Build clean, 123+24 tests.

### 2026-07-18 (later) — Title driving-type: no descriptions + permission→L/R (LOCAL, not pushed)
- **Removed the DIFFICULTY / DRIVING TYPE description blurbs** ("Less Cars, Less Cops", "Auto: shifts
  with weather", …) — they overflowed the cards. The value word (EASY / DEFAULT) is now centered on its
  own (font 20→22).
- **DEFAULT / TILT now ask for motion permission when selected** (new `_titleSteerPermission`): cycling
  onto them shows the explainer → native orientation gate. **Denied → driving type snaps to L/R (classic)**
  with a "→ LEFT / RIGHT STEERING" note. Cycling back onto DEFAULT re-asks (caveat: iOS won't re-show its
  OWN prompt once denied — OS limitation; the explainer still re-appears).
- ⚠️ These two are committed LOCALLY only — **not pushed** (owner reaffirmed: no Cloudflare pushes without
  an explicit say-so).

### 2026-07-18 — Vehicle sizing, trophy re-theme + cash rewards
- **Genre vehicles no longer drive too small.** The driven car is fixed to a target on-screen WIDTH, but
  the genre starter PNGs have big transparent margins (car fills ~64% metal / ~76% k-pop vs ~94% on the
  default cars), so they rendered small. `_applyPlayerSpriteDisplaySize` now scans each texture's opaque
  fill once (cached) and sizes by the VISIBLE body, so every vehicle drives at the default's width.
- **Trophies fully re-themed off drugs → consumables** (`AchievementSystem`): LIQUID COURAGE→RAW DEAL,
  WHITE LINE FEVER→WIRED, NODDING OFF→VALUE MEAL COMA, DEATH'S DOOR→FOOD COMA, K-HOLE→BRAIN FREEZE,
  TWEAKER→THE SHAKES, PERMASTONED→THE ITIS, STONE COLD SOBER→CLEAN EATING, MAXED COKE/HEROIN/…→MAXED
  ENERGY/COMBO/…, etc. Names + descriptions + unlock hints all reworded; mechanics (and stable ids) kept.
- **Trophies now pay cash** (`TIER_REWARD`): Easy $5 / Normal $25 / Hard $50, paid on earning/upgrading a
  trophy, added to the score and shown as `+$X` on the toast.
- ⚠️ Still open: the Difficulty/Driving-type buttons overflow (need a screenshot), and the full HUD-layout
  bake (owner's second COPY export arrived TRUNCATED mid-`popup`).

### 2026-07-18 — HUD default-layout pipeline (seeded, PARTIAL)
- Added `DEFAULT_HUD_LAYOUT` (GameScene) — owner's baked `{dx,dy,scale}` deltas, applied ONLY to
  profiles that never customized (non-destructive; existing custom layouts untouched). The version gate
  now installs it instead of an empty layout.
- ⚠️ **PARTIAL:** the owner's COPY export only contained 6 dragged elements (garage/map/mute buttons,
  Drinks/Food bars, speed readout, damage popup) — NOT the big target-image redesign (no hp / score /
  mult / mission-readout). The editor only records elements you actually drag, and the layout clears on
  RESET / new run / profile switch, so the full arrangement was lost. To finish: re-arrange EVERYTHING in
  one editor sitting → SAVE → reopen editor → COPY → paste the fuller JSON to replace the constant.

### 2026-07-17 (batch 7) — Genre-pick crash + tutorial fixes
- **FIXED the genre-select crash** (`Uncaught` WebGL: `get → batchSprite → drawBitmapMask → endMask →
  postRenderWebGL`). `_applyGenreArt` was calling `textures.remove(key)` then reloading
  ASYNCHRONOUSLY, so the key was MISSING for many render frames → renderer crash. Now each new image
  loads into a **temp key** (the current texture keeps rendering during the fetch), then swaps
  **synchronously** on complete (remove + `addImage` in one tick, no render between). Player sprite is
  re-pointed via `_applyVehicleSwap` after the swap.
- **FIXED the tutorial Music step not opening the genre menu.** The music button uses `addLongTap`
  (tap/hold), which ignores the synthetic `click` the tutorial dispatched — so the submenu never
  opened and the step hung. Extracted `openMusicModal()` and call it directly for the genre step.
- **FIXED "Hold to Skip" showing too early.** Skip is no longer shown during the forced "tap Tutorial"
  prompt — it appears only once the tour is underway (`tutGotoHighlight`, tutIdx ≥ 0).

### 2026-07-17 (batch 6) — Tilt explainer fix + reword
- **Fixed the tilt-steering pop-up getting stuck.** Its buttons used `onclick`, but the game's global
  touch handler `preventDefault()`s the touch, which suppresses the synthetic click — so nothing
  dismissed it. Rebound to `pointerup` (+ `click` desktop fallback) with a `done` guard, matching the
  confirm-modal pattern already used elsewhere. The **Continue** tap still fires the native orientation
  gate (`requestPermission`).
- **Reworded:** title "Game Feature Opportunity" · body "If you would like to experience unique gameplay,
  press Continue and Allow Motion for Tilt Steering in situations." · primary button "Allow Motion" →
  **Continue**.


### 2026-07-17 (batch 5) — Asset deploys held back from batch 4 (build+tests clean)
The three asset changes deliberately excluded from `b98d2bc`, now shipped:
1. **Vices reskin** — the 14 default (non-genre) `vices/*.png` sprites updated to their current art.
2. **Music folder reorg → `hiphop_phonk/`.** The old `phonk/` (8) + `rap/` (9) folders are consolidated
   into one `assets/music/hiphop_phonk/` (17 tracks). `AudioSystem` rewired: the **HIP-HOP / PHONK**
   station (`trackKey 'PHONK'`) now plays the full 17-track merged list; the **REGGAETON** station
   (`trackKey 'HIP-HOP'`) keeps its same 9 tracks, repointed into the new folder so it doesn't 404.
   Folder renamed off "Hip-Hop Phonk" (space) to `hiphop_phonk` for URL-safety + sibling/culture-key
   consistency. `phonk/` + `rap/` deleted (fully redundant, nothing else referenced them; verified no
   `music/rap|phonk` strings survive in the bundle). ⚠️ Reggaeton still borrows the hip-hop tracks — it
   has no dedicated music yet; revisit if it should get its own.
3. **Icon/webp cleanup** — deleted the dead `ui/loading_screen.webp`, `ui/title_screen.webp`, and the
   stale favicon/icon variants (the manifest loads the `.png` versions).


### 2026-07-17 (batch 4) — Genre UX, motion explainer, weapon caps (build+tests clean)
⚠️ **Correction after deployment audit:** a prior local note claimed commit `3a4d020` shipped and
verified the illustrated menu. Do not rely on that claim. In this checkout, `HEAD`/the local
`origin/main` tracking ref is `e333ed2`, `AudioSystem.js` still contains unstaged genre mappings,
and the ten `public/assets/ui/music_genres/*` files remain untracked. The observed live menu is also
still the old version. Treat the illustrated menu and Metal starter-van pair as **LOCAL / NOT DEPLOYED**
until a commit containing the exact assets + mappings is visible on GitHub and Cloudflare reports
that same SHA. A redundant Cloudflare "Workers Builds" integration may still paint a red ❌, but the
authoritative delivery path is the GitHub Action described in Chapter 2.

Then the genre/UX batch (this entry):
- **Custom motion-permission explainer** (`#tilt-explainer` + `window.__tiltExplainer`, index.html) shows
  ONCE before the bare iOS "Access Motion and Orientation" prompt (whose wording is OS-locked and can't be
  changed). Its "Allow Motion" tap is the user-gesture that fires the real `requestPermission`.
  `GameScene._armTiltPrefetch` split the request into `_doTiltRequest()` so the explainer can front it.
- **Genre = per license plate.** Genre now stored in the active save slot (`save.set('genre', …)`) and
  mirrored to `localStorage 'rtr.genre'` (BootScene reads it at boot). Switching profiles on the title
  screen (`_onPlateSlotTap`) calls `window.__genre.syncActive()` → re-mirrors that plate's genre and
  reskins live. `_applyGenreArt(null)` now REVERTS to base art (new `genreDefaultPath()` in AssetManifest)
  for a plate with no genre yet.
- **Tutorial Music step now requires a real genre pick.** `pickGenre:true` on the Music tour step lets
  taps fall through the tut overlays (`.pass` = pointer-events:none) to the actual genre grid; tapping a
  genre's ☆ (which sets `__genre`) calls `window.__tut.genrePicked()` → completes the tour.
- **"Rotate Phone to Enter Game Play"** blinking prompt (`#rotate-play-prompt` + `window.__rotatePrompt`)
  shows on the portrait menu after the genre pick; dismisses on rotate-to-landscape (gameplay entry) or tap.
- **All weapons cap at 3 each.** Rolling coal was the outlier (6 per pickup, cap 18) — now **1 per road
  sprite, cap 3** like everything else (`CopSystem` + every resume/restore clamp: `18→3`). Rest-stop
  **DIESEL TUNE** now grants +3 (fills to cap, `f12Count:3`) and is relabeled "+3 clouds". Coal test
  updated + a cap assertion added (coal.test now 29).
- **Fireworks ROCKET bodies 2× bigger** (`_drawFireworks`): head streak 2→4px, tail 3→6px, head dot
  2.2→4.4r. (The bursts were already doubled in batch 3; this is the launched rocket sprite itself.)
- **Asset deploy with this push:** committed the full `public/assets/culture/` (all 10 genres' vice +
  vehicle art — REQUIRED for the genre reskin to not 404) and `public/assets/ui/sickness/` (the 10 vomit
  sprites — the vomit feature shipped earlier but its art was never committed, so it was 404ing live).
  NOT included (separable, left local): the `vices/*.png` default reskin, the `music/Hip-Hop Phonk/`
  rename (AudioSystem still points at `music/rap/`, so those mp3s must NOT be deleted yet), and the stale
  icon/webp deletions.
- **Bladder from over-eating** (`SurvivalSystem.applyItem`): once fullness is past 75%, every additional
  FOOD sprite (`fx.f > 0`) adds a flat +2% bladder (the bladder was filling too slowly).
- **Rolling-coal cop rework → TOUCH + slow** (replaces the instant flee/despawn). Firing now lays a
  world-anchored smoke cloud behind the car (`CopSystem._coalCloud`, region backZ = pos-10000 … frontZ =
  pos+1500, lives ~5 s). A cop is only affected once it DRIVES INTO the cloud, then its top speed is
  capped at **60 mph for 30 s** (`coalSlowT`) — it keeps chasing, just slow enough that the player pulls
  away. Barricades immune; the 30 s spawn lull + arrest-counter clear stay. Visually the smoke now sits
  low (puff cy `−r*0.55`→`−r*0.1`) and the bottom soot lingers (~3.5 s fade) so the cloud fills to the
  screen bottom as it blows back down the road. coal.test rewritten for the new model (24 assertions).
- **HUD-editor EXPORT button:** the DRAG-TO-MOVE panel now has a 4th **COPY** button (`_copyHudLayout`)
  that copies the saved `controlsLayout` JSON to the clipboard (+ a prompt() fallback for iOS). Flow:
  arrange your HUD → COPY → paste the JSON to me → I bake it into a shipped `DEFAULT_HUD_LAYOUT`. (The
  bake itself is PENDING the owner's pasted JSON.)
- **DEFERRED (post-dev-mode, per owner):** earn/buy GATING for any genre past the first. Right now every
  genre is freely selectable in the picker. Revisit when dev mode is turned off for release.

### 2026-07-17 (batch 3) — Coal/donut render, speed-trap+fireworks size, energy/water (DEPLOYED)
Pushes `4d38920`..`e367607` (+ a TEMP on-screen FPS/error/perf-toggle overlay in index.html for a
live glitch hunt — REMOVE once FPS is resolved). Build clean, 123+27 tests.
- **Rolling Coal cop** finally receding right: the renderer now drives the bottom-edge sink from the
  cop's OWN `relativePos`, clamped at the real projection floor (~1500) — NOT the far 4400 hold that
  teleports a close cop forward (the "jump up + shrink") and then lets it vanish. Added a `coalFlee`
  flag on the render list; CopSystem just does keep-pace(1.5s)→slow physics + despawn. It now slows
  and drops straight off the lower frame the way it entered.
- **Speed-trap parked cop 2× larger** (`sizeMult` 1.6→3.2; on-screen caps 0.306→0.612).
- **Donuts** land then **slide off the bottom quickly** (recede with the road) instead of lingering
  and fading in place.
- **Fireworks 2× bigger**: burst spread (spd), spark size, and crackle-ring radius all doubled.
- **ENERGY** vice had **no `ITEM_FX` entry** → did nothing; added `energy: {t:-8,h:+1.5,diuretic:2.5}`
  so it's a big Alertness jolt.
- **Rolling-coal SMOG** now rolls up from the very bottom edge (a gradient over the lower ~45% of the
  screen), instead of a thin bottom band.
- **WATER** sold at **gas stations ($15)** and **AOK camp ($7)** (new `waterItem` factory).
- **Gas refuel**: verified — cost already = perGal × gallons-to-full (`GAS_USD_PER_MI`=0.50 → $15/gal),
  and `refuelToFull` fills the tank. A $20 charge = a ~85%-full tank top-up, not a bug.
- **PERF**: driving ~12-13 FPS, rest stop 60 FPS, `creates`=1 (no restart loop), no JS error — so
  it's render cost in the driving scene, NOT a logic regression (audio/lifecycle untouched). Awaiting
  the tap-toggle result (effects/sprites/mirror) to find the hog.

### 2026-07-17 (later) — Reskin cleanup, shop balance/layout, donut+coal visual fixes (DEPLOYED)
Push `fe2c47f`. Build clean, 123 mission + 27 coal tests green.
- **DUI drug references scrubbed** (player-visible): snooze desc "wipes all vice bars"
  → "Sleep it all off — every buzz back to zero"; Othello vignette "They had cocaine"
  → "the good energy drinks". Swept all src string literals — vice items, brand names
  (Gas-N-Sip / CowBella / AM/BM / etc.) were already reskinned; only these two were live.
- **Coffee vs caffeine rebalanced**: coffee Alertness −25 → **−15** (moderate, cheap $10);
  **CAFFEINE PILLS** are now a special-cased premium item — **$18 (~1.8× coffee), +28
  Alertness** — so the rare pills are the pricey-strong option and coffee the cheap-moderate
  one (fixes "coffee gives more AND costs less"). Road caffeine pickup ITEM_FX unchanged.
- **Two-column menus** extended to `gas`, `hunting`, `ambm`, `parkride` (were stretching
  buttons full-width) via a `TWO_COL` set in `_buildTabContent`.
- **Gas REFUEL** fills the tank fully (already did) and is now **single-use** — greys out +
  relabels "TANK FULL" after one buy. Made `item.disabled` a LIVE read in the button
  refresh/handler so a purchase can flip it.
- **Prices**: Fireworks $1000 → **$500**; Diesel Tune $800 → **$350**.
- **Donuts render fixed** (was invisible): rebuilt as a **screen-space parabolic toss** —
  box flies out the driver window, arcs onto the road, sits + fades. The world-anchored
  version sat in the engine's un-projectable sub-1400 depth band behind the car (same zone
  that forced the fleeing-cop synthetic-exit hack), so nothing drew.
- **Rolling Coal cop exit fixed**: the time-driven `_fleeExit` synthetic bottom-slide made
  the cop "jump up, shrink, and float to the bottom". Replaced with pure positional recede —
  **keeps pace ~1.5s (`COAL_PACE_SEC`), then slows to 0.45× and drops off the bottom the same
  way it drove in**; `_fleeExit` stays 0, `FLEE_MAX_SEC` timer covers the player-stopped case.
  Coal unit tests rewritten to the positional spec.

### 2026-07-16/17 — Playtest batch #2 + world clock / donut render / town facts (DEPLOYED)
Two pushes (`6119d0e`, `f258694`). Build clean, 123 mission + 28 coal tests green.

**Feel / weather:**
- **Rain steering** de-sluggished — was `0.25 × intensity × severity` (severity rides to 4.8 in
  the North Bend storm wall → grip clamped near 0, felt dead). Now a flat **~18% slide** at full
  intensity; severity still ramps the VISUALS but no longer the steering grip loss.
- **Rain windshield visual** reverted to the pre-storm-wall look (owner: today's change made a
  "linear wall of ~600 drops creeping up in unison"). `EffectsSystem` `sevT` clamp `min(2)→min(1)`;
  `GameScene` falling-streak `eff` rain cap `4.8→2.4`. Builds gradually again like the snow layer.
- **Snow tilt** — force TILT-to-steer for everyone in snow when the sensor's attached (it had been
  silently gated to `default`-pick only). Banner now reads `📱 TILT TO STEER` (dropped the "SNOW —"
  prefix) and a dismissal guard stops it re-firing every ~1.4 mi (that's what read as "permanent").

**Rest stops:**
- **Nap It Off + Coffee** are alertness-only now — stripped the vice-cut AND the party-clock
  penalty from both copy and mechanic (nap = full alertness via `tiredness -100`, coffee = partial).
- **Customers-only restroom** is per-BUSINESS/visit — `_boughtSomething` (one global flag) → a
  `_boughtAt` Set keyed by section, threaded through `_makeButton(bizKey)`. Buying at AM/BM no
  longer unlocks Gas-N-Sip's restroom.
- **Cowbellas** (hunting) sells hunting gear only — dropped the vice/food append (`SHOP_VICES.hunting = []`).
- **Restroom copy** bladder-only + funny ("Piss in bliss"); Park & Ride = "Nasty, but free."
- **Town facts** — new `src/data/townFacts.js`: **3-5 facts for all 19 stops**, one rotates in per
  visit via `nextTownFact` (per-stop index in save's `factRotation`). Shown on the **job/mission
  card too**, so stops with no NPC encounter (e.g. Mercer Island) still surface a fact.

**Cop weapons:**
- **Rolling Coal** cop now KEEPS PACE (~0.88× player, no swerve) then fades to 0 alpha + slides
  down past the bottom edge over `COAL_FADE_SEC` (1.8s) — time-driven "lost in the black" instead
  of dropping back at 0.35×. Coal unit tests rewritten to the new spec.
- **Donuts** — cops break pursuit and VEER toward the drop (`_donutLure` lane on the flee), then
  peel off; short 6s no-spawn window (was a flat 15s freeze-in-place). A pink bakery box is tossed
  out the driver window, arcs onto the road, and stays as projected debris ~9s
  (`_throwDonutBox`/`_updateDonutDebris`/`_drawDonutDebris`, modeled on the coal-cloud projection).

**Systems:**
- **World clock** (phone-menu `#phone-clock`) rebuilt: was mapping the party-clock COUNTDOWN to
  2→8 PM (felt like real time). Now driven by **MILES DRIVEN** — the 293-mi route spans **2:00 PM →
  7:00 PM** (5 in-world hrs), plus rest-stop/shop time at a **compressed rate** (`STOP_CLOCK_SCALE
  = 300/45 ≈ 6.67×`), so arrival varies by how long you dawdle. `_worldClockMinutes()` /
  `_worldClockLabel()` in GameScene; `_restStopClockMin` persisted in the live snapshot;
  `restStopVisitSec` passed back from `RestStopScene._continue`. **Texts timestamped** with the
  clock ("4:37 PM"), old threads fall back to `~mile N`.
- **Job/Task HUD** plate 65% more transparent (fill `0.8→0.28`, text/border untouched).
- **Map fast-travel** gated to Custom only (`tappable = inCustom`) — no Easy/Normal/Hard teleport.
- **Combo banners** removed entirely (drug-themed "BEER RUN"/"TRACK MARKS"/… no longer fit the reskin).
- **Bladder pull-over** — brake + shoulder while "gotta go" (bladder ≥ 75) → 30s held stop (reuses
  the trap-stop pin) → bladder emptied. Distinct from the involuntary soiling at ≥90.

**Tuning knobs flagged for playtest:** `STOP_CLOCK_SCALE` (arrival drift from stops), donut box
size/arc in `_drawDonutDebris`, coal `0.88×`/`1.8s`, rain `0.18` slide. **Not done:** #1 Mercer
NPC/charitable choice (owner unsure — skipped, not invented). Mile-based clock does NOT tick while
idling parked on the road (only miles + stop-time advance it) — confirm that's desired.

### 2026-07-16 — Big playtest batch (18 items, no agents per owner)
- **Survival persistence ROOT CAUSE**: 'survivalState' was read on resume but NEVER written —
  every rest stop silently reset food/drink/alertness to fresh-run values (also why shop food
  seemed to do nothing).  Now written at rest-stop entry + whitelisted in SaveSystem.  Encounter
  BUFFS (snow chains, wind-ready, tow insurance) had the same scene-restart amnesia — persisted
  the same way (chains now actually survive to the snow).
- **Rest-stop menu accumulation ROOT CAUSE**: SECTIONS is module-level and was mutated per visit —
  restrooms/shop items DUPLICATED across visits (AOK's "3 restroom options") and a camp-repair
  disabled at one stop stayed disabled forever (Easton's missing repair at 6 HP).  Pristine
  per-visit reset added.  Crowded menus (>6 items) now lay out in 2 columns w/ taller buttons.
- **Missions**: drive past a destination → "❌ MISSION FAILED — you passed X" popup, slot freed;
  3 fails of a type per run = that type stops being offered (rep gate).  Mission chip tap no
  longer fires the top weapon (it sat in the center tap-fire band).  Welcome NPC now also
  presents the job offers (no character swap mid-stop).  JOBS list → lower-right corner.
- **Economy**: sprites $5; coffee $10 ("Raises your Alertness"); gas-station food/drink $25 at
  HALF road-bite fill; TOP UP ALL removed; refuel shows "X gal @ $Y.YY/gal" w/ per-stop price
  drift (±14%), robbery chance hidden ("You were robbed when counting your cash" on hit);
  710 Oil → ADD PINT OF OIL $20 = −5% engine heat.
- **World/feel**: rain WALLS at mid-North Bend (severity up to 4.8 past mile 32 — wipers or
  blind); snow wander halved; tilt/steering cues 2× size, show 1 mile then fade, "🛞 NORMAL
  STEERING" handoff prompt when the zone ends; soiling yourself drains only 40% of the bladder;
  map teleport double-gated to Custom; caffeine pills much rarer than water (weighted vice
  spawns: food/drink > caffeinated > meds) + violet tint so they stop reading as water.
- **Answered (working as designed)**: "gas auto-refilled" = the out-of-gas TOW (AAA takes 50%
  of cash, tows you BACK to the previous stop with a full tank — popup can be missed at speed);
  "+9 HP from just a restroom" = the generous-karma encounter reward (30% roll on a generous
  choice: one prize is +9 HP).


### 2026-07-14 (later) — Playtest round 3 (DEPLOYED)
- **Rolling coal realism rework**: puffs are now WORLD-anchored (dropped at the road spot where
  released, billow in place, recede behind the car — swerving mid-burst paints a curved trail);
  lifecycle light-gray → near-black over ~1s while expanding, fade over ~4s; cloud renders in the
  REAR-VIEW MIRROR (non-flipped frame); smoked cops fade/shrink into the cloud instead of popping.
  Earlier same day: coal zone fixed to cover the bumper/alongside rammer (it only smoked distant
  tail cops) + fleeing cops can no longer land a ram; 14-check regression test (tests/coal.test.mjs).
- **Fireworks tune**: ~1.7s longer show (5–7 rockets over ~3s), 180° launch fan, bursts ~22%
  bigger, ground-wipe detonations re-spread across the longer show.
- **Barricade maze**: 3 staggered rows (Easy: 2 rows, wider gap) spanning the road, gap lane never
  repeats between rows — forced zigzag; same trigger/damage/flat-tire rules.
- **Traffic-stop fixes**: trooper parked at a road depth that projected below the screen (never
  drew) — now parks in view; Easy's 0.5× star multiplier no longer halves announced whole-star
  events; trap-light flash + rain/snow/crack/soot overlays span the full wide-phone canvas.
- **Phone menu, ENDGAME**: standalone iOS under-reports visualViewport/innerHeight by ~62px
  (proven with the new on-device diagnostics — 5 fast taps top-left toggles a live readout);
  standalone now uses the 100lvh container height. Final layout per owner: BOTTOM-FLUSH — all
  letterbox slack goes above (under the status bar), rotate strip sits on the screen's bottom
  edge, 15px sides. Menu-art skins carry an invisible ~95px black filler below the rotate strip
  (and 36–106px dead borders) — fit uses the measured VISIBLE box (rows 106–1711, cols 41–813).
- **Survival tuning**: Alertness starts at 75%; food/drink drain +15% (fullness −4.14/mi,
  hydration −4.6/mi); bites ×1.5 with bladder pace held at original. Unlocks moved: Sushi mile 34,
  Gummies mile 70, Slushie mile 100 (Dramamine 55, Caffeine Pills 40 cold brews unchanged).


### 2026-07-14 — Playtest round 2 (DEPLOYED)
- Fireworks = full screen wipe (staggered explosions take out cops, traps AND traffic — old
  rocket behavior with the aerial show on top; +1★ unchanged).
- Food/drink bites: ×2.5 was too much → **×1.5 of original**; bladder coefficients compensated
  (÷1.5) so bladder pace stays ORIGINAL. Gas: 75-mi tank at true 1:1 burn.
- Wide-phone overlay coverage bugs (same class as the vignette): food-coma/nausea/withdrawal
  washes now span the full canvas (right-edge light band fixed); phone-menu container sized to
  100lvh (iOS fixed inset:0 stops ~50px short of the glass even with toolbars hidden) and the
  centering box uses the measured VISIBLE art bounds (rows 106–1711 — skins carry ~95px of
  invisible black filler below the rotate strip).
- Rest-stop shop screens: survival mini bars moved to upper-left (were clipping offscreen),
  title/quote overlap fixed, sub-screens titled with the SHOP name (CowBella, Gas-N-Sip, …);
  landing keeps the location name.
- Notification dots: 22px, main-screen only, Messages dot requires actual thread content;
  per-thread dots right of the name; contact chevrons 3×. Garage text 3× + oval pills.
- Title screen: MPH sublabel hidden; DIFFICULTY/DRIVING TYPE headers removed. Game-over
  fallback buttons: RESTART / CONTINUE / MENU (plate art re-export still pending).
- License plates accept special characters (HTML-hazard chars blocked + render-site escaping).
- Traffic-stop fixes: the officer WAS there but parked at a road depth that projects below the
  screen (never drew) — park spot moved into view; Easy's 0.5× star multiplier no longer halves
  announced whole-star events (popup said +1★, HUD floor() showed nothing); trap-light flash +
  rain/snow washes/spawn ranges + windshield-crack haze + coal soot bands all extended to the
  full wide-phone canvas.


### 2026-07-13/14 — Mission system (all 7 phases) + fireworks/gauge/HUD batch (both DEPLOYED)
**Deploy 1 — Mission system complete (Ch. 8 rev. B, built by a 7-agent relay):**
- P1 dialogue trees (node schema, conditions, npcMemory→GLOBAL) · P2 MissionSystem.js + Delivery
  (persisted offers, one-active-per-type, payout `(30+mi×3.5+risk+terms)×rep ×1/×2.5/×5`,
  rewind-safe paid ledger) · P3 movable HUD chip + "+N JOBS" + JOBS list + drop-off cue ·
  P4 Timed (party-clock budget) + Passenger (6 riders w/ nervous/carsick/fugitive/thrill quirks) ·
  P5 Heat-escape + authored weather corridors (pass run, wind run, Legend no-chains dare) ·
  P6 tier-up banners, REP readout, contact memory greetings incl. fail acknowledgment ·
  P7 exploit hunt (rush clock-floor farm fixed; pay-clear halving built then REMOVED — owner call:
  paid star-clears cost enough, escapes always pay full) + balance sim (`tests/balance_sim.mjs`;
  mission $ on-target, pickups+distance gross-outearn missions — revisit w/ real playtest data).
- Tests: `npm test` → tests/missions.test.mjs (109 passing).
- Also: survival vignette centered/feathered/under-HUD; phone menu button-block auto-scale.

**Deploy 2 — fireworks / gas gauge / HUD / notifications:**
- Spike strip REMOVED everywhere (incl. SPIKED JACKS shop item — also kills the Legend heat-farm
  loophole). 🎆 FIREWORKS in its slot: staged procedural show (rockets→bursts→crackle rings,
  flash, shake, whistle/boom/crackle WebAudio), clears ALL on-screen cops, +1★ spectacle.
- Analog E↔F gas gauge (ticking needle, red wedge, blinks near empty; movable id `gas`).
  Beater tank = 75 mi at TRUE 1:1 burn (climb/boost/overheat still add). Fuel slot → reserve-tank
  path: Jerry Can +25 / Aux Fuel Cell +50 / Reserve Gas Tank +100 ($120/$500/$900).
- Survival bars reordered Alertness/Bladder/Drinks/Food, split into TWO movable editor units
  (`survA`/`survB`); Alertness recolored to the caffeine-halo purple 0x9A5FE8 (drinks/food already
  matched their pickup glows); compact unlabeled live-updating bars added to the rest-stop menu.
- Party clock HIDDEN (`SHOW_PARTY_CLOCK=false`, mechanics intact; multiplier took its spot).
  Future direction (owner): clock only surfaces as arrival status; bonuses from achievements,
  jobs, friendships, texting relationships — texting app idea pinned alongside Soundtrack Packs.
- Slow-motion start FIXED: Phaser `fps.smoothStep` off + world pre-rendered behind the 3.2s intro
  as GPU warm-up. Vignette corner-blob bug fixed (created positioned/hidden + camera-ignored;
  hidden in controls editor). Music starts on a random song across all 78 tracks (station pick
  weighted by track count; saved default respected).
- Phone menu: art contain-fits with ≥15px margin every edge (no cropping — the rotate-phone strip
  was getting cut). RED NOTIFICATION DOTS on Tutorial/Calendar/Trophies/Garage/Maps/Messages
  (`rtr.notif.v1` store + `window.__notif` bridge; clear-on-open, messages clear per-thread on
  read). SAVE tile (old START OVER art): KEEP AS-IS for now — owner deciding its replacement
  (autosave every 3s makes manual save redundant; slot candidates: Texting app, Jobs app).

### 2026-07-11 — Docs consolidation
- Merged all project `.md` files into this single overview with a table of contents (Chapters 1–7).

### 2026-07-10 — Deploy verified + design-doc status
- Confirmed the Cloudflare auto-deploy pipeline healthy; added an implementation-status section to the design doc (now Ch3 §0.1).

### 2026-07-07 — Heat/fuel, PG-13, encounter hooks
- **Engine overheating + aggressive fuel** (Ch3 §15/§16): `engineTemp` from desert heat + climbs + speed; Cooling stat mitigates; >92° = limp mode (Easy = limp only, Normal/Hard also bleed HP); HUD temp gauge + hood steam. Fuel burns 1.5× base, worse on climbs/boost/overheat. Tunables in `constants.js` (`ENGINE_*`, `FUEL_BURN_*`).
- **Sex worker removed (PG-13)** → Hot Springs Soak camp service (same +10 bonus-HP heal); removed "Sex workers" stat + `hooker_` placeholder art.
- **Encounter effect hooks**: new verbs `hydration`/`fullness`/`tiredness` (survival bars) + `coolEngine`; retrofit thermos/coffee/cookie; added Ellensburg coolant + Othello lemonade cards.
- **Generous-karma reward**: `effects.generous:true` → ~30% random reward; tagged one generous choice on **every** card.

### 2026-07-06 — Survival rework live, DUI + codes removed
- **Survival system built & deployed** (Ch4): 3 bars replace the drug model; effect bridge drives legacy visuals from bar tiers; save-persisted unlock ladder; asleep = terminal fail.
- **Bars finalized**: relabeled **Awake/Hunger/Thirst**, all empty as they deplete, start at 25%, 2× bigger + movable in Customize Controls; over-75 food-coma/bladder penalties.
- **Restroom / AM-BM system**: second trash-gas-station tab + restrooms (~50% customers-only; Camp/Park&Ride free); bladder emergency = squirm 2 mi → forced pull-over (−30s); 8% "epic deuce" +1★.
- **DUI removed entirely**: no sobriety stops (speeding tickets only), no repeat-DUI bust; wanted stars from reckless driving; all `DUI`/drug identifiers renamed, localStorage `dui.*`→`rtr.*` (with migration); leftover drug physics (acid steering-flip, drunk lurch/drift, coke star-mult) neutralized.
- **Checkpoint/save codes removed**: local LAST/SAVED resume kept; route-map warp still works.

### 2026-07-05 — Reskin
- Reskin pass 1 (`DRUGS`→`VICES` enum + ids/assets) shipped; then approved the **Level-2 "junk food + fatigue"** reframe that the survival system implements.

### 2026-07-04 — Fork + commercial systems
- Forked DUI → Road Trip Roulette; GitHub repo + Cloudflare Pages auto-deploy.
- Built: encounter system v1 (→ 11 cards), NPC portrait registry, `VehicleStats.js`, part-upgrade system + `UpgradeSystem.js`, garage UI, `buffs.js`, upgrades/buffs hooked into driving.

> Earlier (pre-fork) DUI history is preserved in **Chapter 6**.

---

# Chapter 2 — Deployment & Build

Road Trip Roulette deploys to **Cloudflare Pages**, not Netlify (the old `Netlify.md` was DUI's
and is superseded by this chapter).


> ## ⚠️ Deploy conflict (2026-07-27) — READ FIRST
>
> This Pages project now serves the **marketing site at the root** and the **full game at
> `/fully`**, deployed manually from `website/`. But `.github/workflows/cloudflare-pages.yml`
> still runs `wrangler pages deploy dist` — the GAME build — to the same project on every push
> to `main`. **The next push replaces the site with the game at the root and deletes `/fully`.**
>
> Nothing is destroyed: Cloudflare keeps every deployment and rollback is one click in the
> dashboard (or the `/deployments/{id}/rollback` API). But until the workflow is rewired, either
> don't push to `main`, or expect to redeploy the site afterwards.
>
> **The fix** is to make CI reproduce what was done by hand: build the game into
> `website/fully`, then deploy `website` instead of `dist`. Two post-build patches must move into
> a script first — they're applied to generated files and a plain rebuild wipes them:
> 1. Inject `<base href="/fully/">` into `website/fully/index.html`. Vite builds with
>    `base: './'`, so at `/fully` **without** a trailing slash every asset resolves against the
>    site root and 404s. The base tag makes it work either way.
> 2. Rewrite `website/fully/manifest.webmanifest` — `start_url`, `scope` and the icon `src` are
>    root-absolute (`/`, `/icons/...`) and point at nothing under `/fully`.
>
> Manual deploy actually used (credentials sourced from `../DUI/.cloudflare.env`, which is
> account-scoped despite older notes claiming it was project-scoped):
> ```bash
> cd "/Users/brendanbaughn/Documents/Claude/Road trip roulette"
> set -a; . ../DUI/.cloudflare.env; set +a
> npx --yes wrangler@3 pages deploy website --project-name roadtrip-roulette \
>   --branch main --commit-dirty=true
> ```
> Site is ~1.2 GB / 1,422 files — inside the 20,000-file and 25 MiB-per-file caps. Uploads are
> fast after the first because Pages dedupes by content hash.
>
> **Status update (2026-07-31):** the two post-build patches described above are no longer manual —
> `website/build-fully.sh` applies both automatically (see "How to deploy" below). `website/fully/`
> and `website/demo/` are both gitignored build output now, never committed. **The workflow file
> itself is still unfixed** — `.github/workflows/cloudflare-pages.yml` still runs
> `wrangler pages deploy dist`, so this whole conflict is still live; only the manual path is safe.
> Also: CI is currently failing outright regardless (dead `CF_PAGES_API_TOKEN` — see the
> 2026-07-31 changelog entry above), which has been *accidentally* preventing the clobber. Fixing
> the token without also rewiring this workflow will make the clobber start happening again.
>
> **Re-tested live 2026-08-11.** Pushed 33 commits to `main` and watched what happened, rather than
> trusting that CI was still dead. The workflow DID wake (run `31446448644`) and failed at
> `Authentication error [code: 10000]` — the same dead token — *before* reaching the deploy step, so
> the site survived untouched: `/` still the marketing site, `/fully` and `/demo` both 200 serving
> the game. The clobber risk is therefore **still armed and still only defused by a broken token**.
> Anyone fixing that token must rewire `.github/workflows/cloudflare-pages.yml` in the same change.
>
> ## ✅ DISARMED 2026-08-10 — the workflow now deploys `website/`
>
> Owner call: stop relying on a broken credential as the safety mechanism. The workflow's last line
> went from `pages deploy dist` to **`pages deploy website`**, and its `npm run build` step was
> replaced by the same two scripts `scripts/deploy.sh` runs — `website/build-demo.sh` and
> `website/build-fully.sh` — so CI and the manual path now produce identical output. Adding the
> `CF_PAGES_API_TOKEN` / `CF_ACCOUNT_ID` secrets is **safe now**, and turns push-to-main into a real
> auto-deploy of the live site rather than a site-wipe.
>
> The file carries a long header comment explaining the `dist` vs `website` distinction, because the
> failure mode is entirely invisible from the diff: both are valid paths and both "work", but a Pages
> deploy REPLACES the project instead of merging, so shipping `dist` silently deletes the landing
> page, `/faq`, `/genres`, `/story`, `/map`, `/walkthrough`, `/leaderboard`, `/businesses`, `/demo`
> and `/fully`. **Keep the workflow and `scripts/deploy.sh` in step — they must not drift.**
>
> Size check taken at the same time, since CI now uploads the whole thing: `website/` is **1,623
> files / ~1.5 GB**, against Cloudflare's caps of 20,000 files and 25 MiB per file — comfortably
> inside both, with no single file anywhere near the per-file limit. Expect a slow upload, not a
> failing one. (Also noted: eight `* 2` iCloud conflict directories under `website/demo` and
> `website/fully` are all **0 bytes and empty**, so they cost nothing and wrangler won't upload them.
> `scripts/checkDuplicates.js` does scan `website/`; it tests files, not empty directories.)

## How to deploy

**In theory**, pushing to `origin/main` triggers the GitHub Action → Cloudflare Pages auto-deploy,
no CLI or manual build needed. **In practice, as of 2026-07-31, CI is broken** (dead token, see the
Deploy conflict callout above) — the only path that currently reaches the live site is the manual
one below. Check `gh run list` before trusting a push alone to have deployed anything.

```bash
cd "/Users/brendanbaughn/Documents/Claude/Road trip roulette"
git add -A                 # or stage specific paths
git commit -m "Short description of what changed"
git push origin main       # GitHub Action builds + deploys to Cloudflare Pages (currently broken)
```

**The actual working deploy — now one command (2026-08-04):**
```bash
cd "/Users/brendanbaughn/Documents/Claude/Road trip roulette"
npm run deploy        # = scripts/deploy.sh: build-demo.sh + build-fully.sh + wrangler → roadtrip-roulette
```
`scripts/deploy.sh` was the DUI fork's script until 2026-08-04 — it deployed `dist` to the **DUI**
Pages project and would have overwritten the DUI game.  It now runs exactly the manual sequence
below (kept for reference / partial deploys):
```bash
cd "/Users/brendanbaughn/Documents/Claude/Road trip roulette"
cd website && sh build-demo.sh   # refreshes /demo — only if game source changed
cd website && sh build-fully.sh  # refreshes /fully — only if game source changed
cd "/Users/brendanbaughn/Documents/Claude/Road trip roulette"
set -a; . ../DUI/.cloudflare.env; set +a
npx --yes wrangler@3 pages deploy website --project-name roadtrip-roulette --branch main --commit-dirty=true
```
Both build scripts do a full `rm -rf` + rebuild every time — they can't drift silently stale again
the way the old hand-curated `/demo` and `/fully` did (each went 4+ days stale before anyone noticed,
see the 2026-07-31 changelog entry). Run them before every manual deploy if game source changed
since the last one; skip them if you're only touching marketing-site pages (`website/*.html`, `css/`).

- Live URL: **https://roadtrip-roulette.pages.dev**
- Build typically lands in ~45–60s. Watch runs with `gh run list`.
- Commit-message footer convention: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Configuration (already set)

- **Build command:** `npm run build` (Vite → `dist/`)
- **CI:** `.github/workflows/cloudflare-pages.yml` on push to `main`
- **Secrets:** `CF_PAGES_API_TOKEN` + `CF_ACCOUNT_ID` (shares DUI's Cloudflare account)
- **Repo remote:** `origin = https://github.com/BigMountainB/Roadtrip-Roulette.git`

## Gotchas (inherited from DUI, still true)

- **`git push` sends commits only.** Before announcing a deploy, run `git status --short` and
  explicitly stage every new binary-asset directory. Generated PNGs are commonly `??` (untracked)
  and are invisible to GitHub/Cloudflare until `git add` + `git commit`. For the illustrated Music
  menu, the minimum deployment set is:
  `src/systems/AudioSystem.js` + `public/assets/ui/music_genres/`. Add
  `public/assets/culture/metal/vehicles/starter_front.png` and `starter_back.png` for the Metal van.
- **Verify the deployed SHA, not just a green/successful push.** After pushing, confirm the new
  commit appears on GitHub, confirm the GitHub Actions Pages job built that exact SHA, and request
  one known new asset URL (for example
  `/assets/ui/music_genres/metal.png?v=vehicle-scenes-1`) before marking the work live.
- **Music-menu dependency:** committed `index.html` already expects `s.culture`; if the matching
  `AudioSystem.js` mapping is missing, `cultureArt` is empty even when the HTML/CSS deployed cleanly.
  If the PNG directory is missing, the mapping exists but image requests 404. Ship both together.
- **`dist/`, `website/demo/`, and `website/fully/` are all build output** — never edit or commit
  them (all three are gitignored). `dist/` comes from CI's `npm run build`; the other two come
  from `website/build-demo.sh` / `website/build-fully.sh` and must be rebuilt by hand before a
  manual deploy if game source changed.
- **`ios/App/App/public/`** is the Capacitor sync target (`npx cap sync ios`) — don't hand-edit.
- **`Images/`** at the repo root is a local-only art archive (large PSDs) — don't ship it; keep it gitignored so `git pack-objects` doesn't choke on push.
- **Old code in production after a deploy** = browser cache. Hard-refresh (Cmd+Shift+R) or reopen the saved-to-home-screen PWA.
- **⚠️ THIS PAGES PROJECT SERVES MISSING FILES AS HTTP 200.** A path that doesn't exist returns the
  4,680-byte 404 page *with a 200 status* — `curl /this-does-not-exist-xyz.png` → `200`. **A deploy
  check that reads only the status code proves nothing here.** Verify by BYTE SIZE against the local
  file:

      lsz=$(stat -f%z "public/$f")
      rsz=$(curl -s -o /dev/null -w "%{size_download}" "https://roadtrip-roulette.pages.dev/fully/$f")
      [ "$lsz" = "$rsz" ] && echo OK || echo MISMATCH

  This is how a 2026-08-04 "the signs are live" check passed while actually fetching the 404 page.
- **Right after a deploy, the edge can serve the OLD file for a minute.** Seen twice: an `index.html`
  still pointing at the previous bundle hash, and a freshly-uploaded favicon returning the 404 page
  on first request and the correct bytes on retry. Re-request before concluding a deploy failed.

## Local dev server & on-device (iPhone) testing

Two scripts, and **which one you use matters on a phone**:

| script | serves | notes |
|---|---|---|
| `npm run dev` | **http** (`DUI_HTTP=1`) | what on-device testing has historically used |
| `npm run dev:https` | https via `@vitejs/plugin-basic-ssl` | self-signed cert |

- **`localhost` is meaningless from the phone** — it means the phone. Use the Mac's LAN IP
  (`ipconfig getifaddr en1`, currently `192.168.86.180`), e.g. `http://192.168.86.180:3000/`.
- **Switching between the two scripts re-optimizes deps every time** — vite's resolved config
  differs (the ssl plugin), so it logs `Re-optimizing dependencies because vite config has changed`
  and does one automatic page reload on first load. Harmless, but don't mistake it for a fault.
- **Self-signed https + iOS is a minefield** (why 2026-08-10 went sideways):
  - iOS home-screen apps run in their own context and do **NOT** inherit the certificate exception
    accepted in Safari — a standalone launch of a self-signed URL just fails.
  - "Add to Home Screen" also won't use the declared `apple-touch-icon` through an untrusted cert;
    it falls back to a screenshot thumbnail.
  - A standalone web app needs its own **Local Network** permission for a LAN IP, and there's no
    prompt for it outside Safari.
  Prefer plain `npm run dev` over http for device testing; use the deployed URL when a real
  certificate is actually needed (secure-context APIs like device-orientation/tilt).
- **Known noisy startup error, non-fatal:** the dep scanner crawls
  `docs/retired/press-kit-page.html`, which imports a `js/site.js?v=3` that doesn't exist, and
  throws during scanning. Optimization still completes (`✨ new dependencies optimized: phaser`
  lands right after). Worth excluding via `optimizeDeps.entries` eventually.

### Decoding "Music is taking longer than usual to load."

**That message does not mean the mp3s are slow.** It renders when `window.__music.list()` returns an
empty station list for 3 s (`index.html`, `_renderMusicNow`), and `list()` just reads
`registry.get('audio')`. `src/main.js` registers the AudioSystem **before Phaser boots**, precisely so
the phone menu sees stations instantly — so an empty list means **`src/main.js` never executed at
all**.

The phone menu still renders because it's inline in `index.html`, independent of the game module. So
this message and a **blank game canvas are the same fault**, not two: the module bundle didn't run.
When it appears, look at why the JS failed to load, not at the audio system.

---

# Chapter 3 — Commercial Design Document

# Commercial Game Design Document
# Working Title: Road Trip Roguelite Built from DUI

## 0. Purpose

This document reframes the existing **DUI** project into a more commercially focused, replayable, Steam-first / mobile-later arcade driving roguelite while reusing as much of the current Phaser 3 codebase, route data, art pipeline, phone-menu work, rest stops, vehicle systems, cops, weather, audio, and UI as possible.

The goal is not to throw away DUI. The goal is to turn DUI from a one-route shock-comedy arcade game into a stronger commercial product with:

- More replayability
- More rest stop / gas station encounters
- More player choice
- Smaller car upgrades instead of only whole-car purchases
- Clearer stats that affect driving feel
- Better monetization potential
- Lower app-store/platform risk
- A realistic path toward a $50,000 revenue target

This should be treated as a design direction and Claude build spec, not a dreamy feature graveyard. Dreamy feature graveyards are where indie projects go to become “learning experiences,” which is what people call failures when they’re trying to sound emotionally regulated.

---

## 0.1 Implementation Status — updated 2026-07-10

The project has been **forked** out of DUI into its own repo (`BigMountainB/Roadtrip-Roulette`) and auto-deploys on every push to `main` via GitHub Actions → Cloudflare Pages. **Live build: https://roadtrip-roulette.pages.dev**. Package renamed `road-trip-roulette`; title/PWA/plate rebranded to "Road Trip Roulette".

### Built and deployed

- **Rest-stop encounter system (§7) — DONE.** Data-driven cards in `src/data/encounters.js` (13 cards across S/N/SP/V/O/B/I/C/E/H/W) with portrait card UI in `RestStopScene` (big cover-fit NPC image, white-text choices), `src/data/npcPortraits.js` registry (procedural placeholder busts until real art). Effect vocab: `cash / fuelMi / hp / heatStars / timeSec / buff / revealHazard / hydration / fullness / tiredness / coolEngine / generous`. First-visit intro guaranteed, ~60% later, once-seen persisted. **Every card has one `generous` choice → ~30% random karma reward.** (Note: encounter `grantUpgrade` is defined but NOT yet consumed in GameScene.)
- **Player-facing car stats (§11) — DONE.** `src/systems/VehicleStats.js` → 8 stats (Grip/Steering/Stability/Braking/Durability/Cooling/Visibility/Range) as 0–5 bars.
- **Part-upgrade system + Garage UI (§10–12, §18) — DONE.** `src/data/upgrades.js` (9 slots × 3 tiers, real tradeoffs) + `src/systems/UpgradeSystem.js` (save-persisted, temp vs permanent, legacy-accessory bridge). Garage panel in `index.html` shows stat bars + per-slot buy/preview. Upgrades hooked into handling via `_recomputeUpgradeFx` (topMph, grip/steer/stability, offroad, range, weather-contextual snow/rain grip). Encounter buffs (`src/data/buffs.js`) restore per-run.
- **Heat & fuel pressure (§15 cooling, §16 heat/climb) — DONE (2026-07-07).** Engine overheating: `engineTemp` 0–100 driven by ambient desert heat (Columbia Basin ~mi 137–245), climbs (`gradePct`), and speed/boost; the **Cooling stat** lowers it. >92 = limp mode (top speed ×0.60); **Easy = limp only, Normal/Hard also bleed HP.** HUD temp gauge + hood steam. **Aggressive fuel:** 1.5× base burn, worse on climbs/boost/overheat; Fuel-System upgrades enlarge the tank. Tunables in `constants.js` (`ENGINE_*`, `FUEL_BURN_*`). Numbers are first-pass — awaiting playtest.
- **Survival rework — DONE (replaces the drug model; see `SURVIVAL_SYSTEM_SPEC.md`).** Three bars **Awake / Hunger / Thirst** (empty = danger), start at 25%, drain by distance. Over-75 penalties (food-coma dim, bladder). Restroom system: **AM/BM** second trash-gas-station tab + Gas-N-Sip restrooms (~50% customers-only), Camp/Park&Ride free; bladder emergency = squirm 2 mi → forced pull-over (−30s). Encounters can now move these bars (lemonade/food/coffee) and cool the engine (coolant).
- **Hatton rest stop (§ Prompt 6) — DONE** (carried from DUI, mile 205).

### Superseded / changed vs this doc

- **"DUI" framing fully REMOVED (Risk 2 / §1 reframe).** No sobriety stops — speed traps issue a plain **speeding** ticket only; the repeat-DUI suspended-license bust is gone. Wanted stars come from **reckless driving** (NPC wrecks), not impairment. GameOver charge → RECKLESS DRIVING. All player-facing + internal `DUI`/drug identifiers renamed (localStorage keys migrated `dui.*`→`rtr.*`). Leftover drug *physics* (acid steering-flip, drunk lurch/drift, cocaine star-mult) neutralized.
- **Portable save/checkpoint CODES REMOVED** (contradicts §1 "save codes" / Prompt 6 wiring). Same-device **LAST / SAVED** local resume kept; cross-device deferred to a future account/Facebook login. Route-map tap-to-warp still works (`restStopSaves` now keyed by stop id).
- **Sex worker REMOVED (PG-13).** Replaced by a **Hot Springs Soak** camp service (same +10 bonus-HP heal).

### Not yet built (next candidates)

- **Mission system (§17)** — delivery/passenger/timed/heat-escape/weather. Not started.
- **Economy balance + Steam demo cut + wishlist/tutorial screen (§13, §22, Prompt 7).** Not started.
- Real NPC portrait art (procedural placeholders in place) and real survival-item art.

---

## 1. Current DUI Foundation to Reuse

The existing DUI project already has a lot of usable bones.

### Existing engine and tech

Reuse:

- Phaser 3 pseudo-3D arcade road engine
- Vite build pipeline
- Capacitor/iOS wrapper potential
- Existing phone tilt support
- Existing keyboard/touch control systems
- Existing road rendering architecture
- Existing weather/day-night systems
- Existing save/profile architecture
- Existing HUD and neon UI style
- Existing phone-as-menu portrait overlay
- Existing music/radio systems
- Existing route data and rest stop/checkpoint structure

Do not rebuild this in Unity or Godot unless the current project becomes completely unmanageable. The existing code may be messy, but it is messy in the useful way: it already runs, already has route identity, and already contains many systems a new project would spend months recreating.

### Existing route

Reuse the Seattle to Pullman route as the main campaign spine:

1. Seattle / West Seattle start
2. Mercer Island / Lake Washington bridge section
3. Bellevue / Eastside
4. Issaquah
5. North Bend
6. Snoqualmie Pass
7. Cle Elum
8. Ellensburg
9. Vantage / Columbia River
10. Othello
11. Hatton
12. Washtucna
13. Pullman

The current project already models the route as approximately 293 miles, with a real I-90 / WA-26 / US-195 / WA-270 topology, named exits, rest stops, tunnels, bridges, weather zones, and route segments. Keep that. That is one of the most marketable pieces of the game.

### Existing gameplay systems worth keeping

Keep and refine:

- Arcade driving
- Auto-cruise / boost / brake flow
- Tap, L/R, and tilt controls
- Damage / HP
- Cops and wanted stars
- Rest stops
- Checkpoints
- Wallet / cash system
- Vehicles
- Vehicle accessories
- Weather
- Day/night cycle
- Route map
- Garage
- Music app
- Ending screens
- Difficulty modes
- Achievements
- Save codes / rest-stop saves

### Existing systems to reduce or reframe

The current project is branded around drugs, weapons, cops, overdose, and explicit DUI framing. That is funny, but commercially dangerous and probably harder to sell cleanly on mobile.

Do not delete the adult comedy. Do reframe the product so the platform-facing description is:

> A dark-comedy arcade road-trip roguelite across Washington, where your car, the weather, the cops, and terrible decisions try to keep you from reaching Pullman before the party starts.

This keeps the flavor but makes the game less platform-radioactive.

---

## 2. New Commercial Positioning

### Genre

**2D pseudo-3D arcade driving roguelite**

### Player fantasy

You are trying to survive a chaotic Pacific Northwest road trip from Seattle to Pullman in a barely trustworthy car before the party starts.

The player is not just “driving fast.” They are managing a run:

- Fuel
- Damage
- Police heat
- Weather
- Car condition
- Money
- Bad choices
- Weird passengers
- Rest stop events
- Upgrades
- Route hazards

### Elevator pitch

A dark-comedy arcade driving roguelite where every run is a Seattle-to-Pullman disaster. Dodge traffic, survive mountain weather, pull into strange gas stations, meet roadside weirdos, upgrade your terrible car one part at a time, and try to reach Pullman before the party clock hits zero.

### Design pillars

1. **Fast and readable driving**
   - The game should feel immediately playable.
   - The player should understand why they crashed, got busted, ran out of fuel, or lost time.

2. **One more run**
   - Every failure should make the player want to retry with a better upgrade, better route choice, or better rest stop decision.

3. **Washington identity**
   - This game should feel like Seattle, North Bend, Snoqualmie Pass, Vantage, Othello, and Pullman.
   - The gas station encounters and local history bits should strengthen this.

4. **Comedy through consequences**
   - Funny quips, bad advice, odd NPCs, strange roadside events, and escalating absurdity.
   - Not random nonsense every five seconds. The comedy should reinforce the route and mechanics.

5. **Small upgrades, big feel**
   - Instead of only buying entire cars, the player should gradually improve their current vehicle.
   - A better tire, radiator, headlight, fuel filter, or bumper should matter.

6. **Finishable scope**
   - Keep the first commercial version tight.
   - Use existing DUI systems where possible.
   - No online multiplayer.
   - No giant open world.
   - No 400 hand-written quests unless someone invents a day with 43 hours.

---

## 3. Core Gameplay Loop

### Ten-second loop

The player:

- Steers through traffic and hazards
- Reacts to weather, road curves, cops, and obstacles
- Grabs cash / supplies / pickups
- Avoids damage and heat
- Chooses whether to stay fast or drive safer

### One-minute loop

The player:

- Enters a new route mood or hazard pocket
- Deals with a random event or roadside opportunity
- Manages fuel, damage, heat, and speed
- Sees upcoming rest stop / exit signage
- Decides whether to push forward or pull off

### One-run loop

The player:

1. Starts in Seattle with a chosen car and upgrade loadout.
2. Drives through route segments.
3. Pulls into rest stops and gas stations.
4. Encounters NPCs, quips, local facts, offers, scams, buffs, and risks.
5. Repairs / refuels / buys small upgrades.
6. Reaches Pullman on time, late, busted, crashed, broke, or not at all.
7. Keeps some progress and unlocks.
8. Starts another run with better knowledge and gear.

---

## 4. Recommended Version Strategy

### Do not abandon DUI

The existing project should become the foundation of the commercial version.

### Rename for commercial release

Possible names:

- **Bad Decisions: Road Trip**
- **Last Exit to Pullman**
- **Road Trip: Pullman or Bust**
- **Party Run 293**
- **Gas Station Saints**
- **Westbound Bad Ideas**
- **Seattle to Pullman: Bad Choices Edition**

Best current recommendation:

## Last Exit to Pullman

It sounds like a game, not a legal confession. Humanity survives another naming meeting.

### Platform strategy

#### Phase 1: Web/Steam demo
Build and test a polished demo first.

#### Phase 2: Steam Early Access or full launch
Use a $9.99–$12.99 launch price if there is enough content.

#### Phase 3: Mobile port
Use mobile only after the game loop has proven itself.

Mobile-first is risky because the current adult content and “DUI” title will create review/monetization headaches. Steam is more tolerant of weird adult comedy, as long as the page is honest and the game is not exploitative or illegal-instruction garbage.

---

## 5. Game Modes

### 5.1 Main Run

The core Seattle-to-Pullman campaign.

Goal:

- Reach Pullman before the party clock expires.
- Avoid catastrophic damage, police busts, and total financial collapse.

This mode reuses the existing party clock, checkpoints, route, cops, weather, damage, and finish evaluation.

### 5.2 Daily Run

Same route, but with a seeded modifier set.

Examples:

- Snow tires disabled
- Gas prices doubled
- Every cop is bored and angry
- Wind warning from Vantage onward
- All rest stop mechanics are shady
- No repair shops after Ellensburg
- One-hit windshield crack mode

Daily Run should be local-only at first. Do not build online leaderboards until the base game has value. Online leaderboard infrastructure is a trap with blinking lights.

### 5.3 Endless Road

After Pullman, continue into a randomized Palouse road loop.

This is optional for v1. It can be added later as a retention feature.

### 5.4 Custom Run

Keep the existing Custom mode idea:

- No leaderboard / no score eligibility
- Player can tune difficulty
- Useful for testing and casual play

### 5.5 Tutorial

A short drive from Seattle to Mercer Island that teaches:

- Steering
- Boost/brake
- Traffic
- Damage
- Gas
- Rest stops
- Upgrade choices
- Police heat

Do not make the tutorial too clever. Players need to learn, not experience a community theater production about torque.

---

## 6. Route Structure and Zone Design

The existing route should be divided into commercial-friendly zones.

| Zone | Miles | Primary feel | Core hazards | Rest/gas encounter tone |
|---|---:|---|---|---|
| Seattle / West Seattle | 0–10 | Urban chaos | Traffic, bridges, tunnels, cops | Street weirdos, city rumors |
| Bellevue / Eastside | 10–25 | Polished suburb pressure | Traffic, ramps, expensive repairs | Tech money, luxury scams |
| Issaquah / North Bend | 25–40 | Rainy foothills | Rain, fog, elk, curves | Locals, mountain warnings |
| Snoqualmie Pass | 40–75 | Mountain survival | Snow, chains, visibility, trucks | Truckers, ski bums, chain advice |
| Cle Elum / Ellensburg | 75–120 | Dry transition | Speed traps, wind, fatigue | Rodeo/college/truck stop energy |
| Vantage / Columbia | 120–155 | Big descent, wind, heat | Crosswind, overheating, bridge | History, desert oddballs |
| Othello / Basin | 155–205 | Dark open roads | Fatigue, farm equipment, low gas | Farm-town encounters |
| Hatton / Washtucna | 205–250 | Sparse survival | Empty road, cops, fuel anxiety | Strange rest stops, bleak comedy |
| Pullman approach | 250–293 | Final push | Police heat, darkness, traffic | Party escalation, final choices |

### Hatton should be added

The existing project overview already identifies Hatton, WA around mile 205 as an approved rest stop gap-fill. Build it. The route has a large gap between Othello and Washtucna, and Hatton gives the player a strategic decision point before the final act.

---

## 7. Gas Station and Rest Stop Encounter System

This is the biggest improvement to the game.

The current rest stops are functional. They should become the heart of the roguelite.

### Player experience

When the player pulls off at a rest stop or gas station:

1. The driving view pauses.
2. A character portrait pops up.
3. The character says a quip, warning, offer, or local history fact.
4. The player gets 1–3 choices.
5. Choices affect stats, cash, heat, time, fuel, repairs, upgrades, or route risk.

### Encounter types

#### 1. Local history fact

Small fact, small reward, small flavor.

Example:

> **Old man in a Seahawks windbreaker:**  
> “You know they moved entire roads around this pass just to keep people from dying up here. Didn’t work on the ones texting.”

Possible effect:
- +$20 “local knowledge bonus”
- Unlocks route trivia entry
- Reveals next hazard

#### 2. Mechanic offer

A repair or upgrade with a risk.

Example:

> **Gas station mechanic:**  
> “I can fix that radiator for $80 or I can ‘fix’ it for $25. Different verbs, same spelling.”

Choices:
- Proper fix: -$80, +15 cooling
- Cheap fix: -$25, +5 cooling, 20% chance of later leak
- Leave

#### 3. Hitchhiker / passenger

A person wants a ride.

Example:

> **Hiker with one boot:**  
> “I only need a ride to the next exit. Don’t ask about the other boot. That’s between me and the mountain.”

Choices:
- Pick them up: possible reward, possible heat/time/risk
- Decline: safe
- Ask for gas money: small cash, chance they walk away annoyed

#### 4. Rumor / route intel

Character warns about upcoming hazards.

Example:

> **Truck driver:**  
> “Vantage wind’s pushing semis around like shopping carts. Keep both hands on the wheel unless you’re busy ruining your life.”

Effect:
- Shows wind warning
- Temporary handling buff if player follows advice
- Unlocks “wind correction” tutorial tip

#### 5. Scam / bad deal

A roadside offer that seems useful but may backfire.

Example:

> **Guy selling ‘performance chips’:**  
> “Adds 40 horsepower. Or removes 40 dollars. Depends how spiritual you are.”

Choices:
- Buy chip: small speed buff, chance engine heat penalty
- Haggle: lower cost, chance no effect
- Ignore

#### 6. Emergency decision

Time pressure or route risk.

Example:

> **State patrol radio leak:**  
> “They’re setting up ahead. You can wait it out, take the frontage road, or act like consequences are for other families.”

Choices:
- Wait: -3 min, -heat
- Detour: +distance, lower cops, more fuel cost
- Push through: no time loss, higher heat

### Encounter UI layout

Reuse RestStopScene, but add a portrait card.

Suggested layout:

- Top: location name + mile marker + time
- Left: character portrait
- Right: dialogue bubble
- Bottom: 2–3 large choice buttons
- Footer: current car state summary

Display car state:

- Fuel
- Damage
- Heat
- Cash
- Time remaining
- Tire condition
- Engine temp risk
- Headlight condition if night

### Encounter data shape

Claude should implement encounters as data, not hard-coded scene spaghetti.

```js
export const REST_STOP_ENCOUNTERS = [
  {
    id: 'north_bend_chain_guy_01',
    stopId: 'north_bend',
    zone: 'north_bend',
    weight: 3,
    once: false,
    portrait: 'npc_chain_guy',
    speaker: 'Chain Guy',
    line: "Pass is getting ugly. Chains now are cheaper than learning physics in a ditch.",
    facts: ["Snoqualmie Pass weather can change quickly between North Bend and the summit."],
    choices: [
      {
        label: "Buy chains",
        cost: 80,
        effects: { tractionSnow: +12, snowSlip: -0.10 },
      },
      {
        label: "Ask for a discount",
        cost: 55,
        chance: [
          { p: 0.65, effects: { tractionSnow: +8 } },
          { p: 0.35, effects: { tractionSnow: +3, dialogue: "He sold you decorative chains. Society continues." } }
        ]
      },
      {
        label: "Skip it",
        effects: {}
      }
    ]
  }
];
```

### Encounter frequency

Not every stop should drown the player in dialogue.

Suggested:

- First visit to a rest stop: guaranteed location intro encounter
- Later visits: 60% chance of character encounter
- Gas-only quick stop: optional “skip dialogue” button
- Hard mode: fewer safe encounters, more tradeoffs

### Number of encounters for v1

Minimum viable:

- 3 encounters per major rest stop
- 12–15 rest stops
- 36–45 total encounter cards

Commercial full version:

- 6 encounters per major rest stop
- 17–18 stops
- 100+ total encounters

Start with 45. Do not write 300 unless the game loop already works. This is a game, not a municipal archive.

---

## 8. Character Portrait System

### Portrait purpose

Characters should make rest stops feel alive without requiring animated cutscenes.

Each portrait is:

- Static PNG or WebP
- Waist-up or bust portrait
- Slightly exaggerated but realistic enough to fit the neon/dark-comedy style
- Reusable across multiple encounters with expression variants later

### Character categories

- Tired trucker
- Gas station clerk
- Chain installer
- Ski bum
- Local old-timer
- State patrol sympathizer
- Nervous college student
- Conspiracy guy
- Roadside mechanic
- Hitchhiker
- Farm worker
- Tow truck driver
- Tourist
- Party messenger
- Weather-obsessed local

### Portrait implementation

Use a simple portrait registry:

```js
export const NPC_PORTRAITS = {
  clerk_01: {
    texture: 'npc_clerk_01',
    name: 'Night Clerk',
    defaultMood: 'tired',
  },
  trucker_01: {
    texture: 'npc_trucker_01',
    name: 'Long-Haul Mike',
    defaultMood: 'warning',
  }
};
```

Do not require lip sync, animation, or branching character memory for v1. That way lies madness with a loading bar.

---

## 9. Local Fact System

The user specifically likes characters offering historic or area-specific facts. Good. This gives the route personality and makes the game feel researched.

> **AS BUILT (2026-08-04) — read this before editing any fact.** The live fact list is
> `src/data/townFacts.js`, 3-5 per stop, rotating on repeat visits. It **overrides** the `fact:` field
> on an encounter card (`_showEncounterCard` resolves `_townFact ?? node.fact ?? enc.fact`, and all 18
> stops have town facts), so **a fact written on a card will never reach the player** — put it in
> `townFacts.js` or it doesn't exist. All 62 entries were rewritten and web-verified individually on
> 2026-08-04; the bar is a *specific checkable claim* — a date, a number, a name, an event. "Weather
> here can change fast" is not a fact. Prefer the strange true thing (Yesler raffling his sawmill and
> keeping the money; the whaling fleet wintering in Bellevue) over the tidy summary.

### Rules for facts

Facts should be:

- Short
- Area-specific
- Delivered in character voice
- Optional flavor, not homework
- Mechanically useful when possible

Example structure:

```js
{
  factId: 'vantage_wind_01',
  area: 'Vantage',
  fact: 'The Columbia River crossing near Vantage is known for strong winds and exposed driving conditions.',
  npcLine: "Wind out here doesn’t blow. It files paperwork against your lane position.",
  effect: { revealHazard: 'crosswind' }
}
```

### Fact categories

- Road history
- Town history
- Weather
- Geography
- Bridges/tunnels
- Agriculture
- Local hazards
- Regional weirdness
- Pullman / WSU culture
- Mountain pass survival

### Important warning

Use real facts only after verification. Let Claude draft them, but do not trust Claude’s facts without checking. It will confidently invent a 1912 elk mayor of Snoqualmie if you let it.

---

## 10. Car Upgrade Philosophy

The user prefers smaller upgrades instead of only upgrading the entire car. This is the correct move.

Whole-car upgrades can still exist, but they should not be the main progression.

### Desired feeling

The player should think:

> “My car is still a piece of junk, but now it has better snow tires, a patched radiator, and headlights that don’t look like two dying candles.”

That is more fun than simply replacing the car.

### Upgrade slots

Each car should have slots:

1. Tires
2. Brakes
3. Suspension
4. Engine
5. Cooling
6. Fuel system / battery
7. Body / bumper
8. Headlights
9. Wipers
10. Radar / police scanner
11. Storage
12. Comfort / fatigue reduction

### Upgrade levels

Use 3 levels per part:

- Level 0: stock / busted
- Level 1: cheap improvement
- Level 2: decent
- Level 3: premium / specialized

Example:

| Slot | L1 | L2 | L3 |
|---|---|---|---|
| Tires | Used all-seasons | Good all-seasons | Snow/performance set |
| Cooling | Stop-leak | New radiator | High-flow cooling |
| Brakes | New pads | Performance pads | Big brake kit |
| Headlights | Used bulbs | LED swap | Rally light bar |
| Body | Zip-tied bumper | Reinforced bumper | Bash bar |
| Fuel | Clean filter | Bigger tank | Efficient tune |

### Upgrade permanence

Recommended:

- Some upgrades persist between runs.
- Some cheap repairs are temporary.
- Damage can reduce upgrade effectiveness until repaired.

Example:

- Bought snow tires: persistent
- Tire condition: can degrade
- Radiator upgrade: persistent
- Radiator damage: temporary condition

This gives both long-term progression and in-run maintenance.

---

## 11. Handling and Traction Stats Explained

The user is unsure how handling and traction should look. Good instinct. Abstract stats can feel fake if they are just numbers.

### Do not show raw physics garbage

Do not show:

- `steerVelDamping = 0.087`
- `lateralGripScalar = 1.12`
- `snowSlipCoef = 0.78`

That is how you make a garage screen only an engineer could love, and even they would be lying.

### Show player-facing stats

Use simple labeled bars:

1. **Grip**
   - How well the car holds the road.
   - Helps in rain, snow, dirt, and high-speed curves.

2. **Steering**
   - How quickly the car responds to input.
   - Higher means sharper lane changes.

3. **Stability**
   - How much the car resists fishtailing, wind shove, and crash spin.

4. **Braking**
   - How quickly the car slows and recovers control.

5. **Durability**
   - How much damage the car can take.

6. **Cooling**
   - Resistance to overheating on long climbs, hard boost, and desert sections.

7. **Visibility**
   - Headlights, wipers, fog/rain/night readability.

8. **Range**
   - Fuel/electric distance before needing a stop.

### Under-the-hood mapping

#### Grip

Affected by:
- Tires
- Road surface
- Weather
- Speed
- Damage
- Vehicle weight

Gameplay effect:
- Reduces slide on curves
- Reduces snow/rain drift
- Reduces off-road penalty
- Improves recovery after bump

Possible code mapping:

```js
effectiveGrip =
  baseGrip
  + tireGripBonus
  + tractionAccessoryBonus
  - weatherGripPenalty
  - damageGripPenalty;
```

#### Steering

Affected by:
- Suspension
- Steering rack upgrade
- Vehicle type
- Speed

Gameplay effect:
- Changes how quickly `player.x` responds to input
- Improves lane changes
- Too much steering without stability can feel twitchy

Possible code mapping:

```js
steerResponse =
  baseSteer
  + suspensionBonus
  + steeringUpgradeBonus
  - highSpeedPenalty;
```

#### Stability

Affected by:
- Suspension
- Weight
- tires
- wind
- crash impulse

Gameplay effect:
- Reduces fishtail after collisions
- Reduces crosswind shove
- Reduces wobble after leaving road
- Makes tilt steering less twitchy

Possible code mapping:

```js
xImpulse *= (1 - stabilityRecovery * dt);
windPush *= (1 - stabilityBonus);
crashSpin *= (1 - stabilityBonus);
```

#### Braking

Affected by:
- Brakes
- Tires
- road condition
- damage

Gameplay effect:
- Stronger deceleration
- Shorter panic recoveries
- Less sliding when braking in snow/rain

#### Cooling

Affected by:
- Radiator
- coolant
- boost use
- hill grade
- desert heat
- engine damage

Gameplay effect:
- Too much heat reduces top speed
- Severe heat causes engine damage
- Cooling upgrades let players use boost longer

#### Visibility

Affected by:
- headlights
- wipers
- fog lights
- windshield damage

Gameplay effect:
- More visible road ahead at night/fog/snow
- Better warning timing for obstacles
- Reduced screen effects during storms

### Garage UI example

Instead of showing numbers alone:

```
USED SEDAN

Grip        ███░░
Steering    ████░
Stability   ██░░░
Braking     ██░░░
Durability  ██░░░
Cooling     █░░░░
Visibility  ██░░░
Range       ███░░
```

When selecting an upgrade:

```
USED SNOW TIRES
+$120

Grip       +2 in snow / +1 rain
Stability  +1 on pass roads
Top Speed   -2 mph

"Ugly, loud, and technically round."
```

### Upgrade tradeoffs

Avoid upgrades that are pure improvements every time.

Examples:

- Snow tires: better snow grip, slightly worse top speed
- Rally lights: better visibility, slightly higher police attention at night
- Bash bar: more durability, slightly worse handling
- Bigger tank: more range, slightly heavier
- Cheap engine tune: more speed, more heat
- Low suspension: better steering, worse off-road recovery

Tradeoffs create decisions. Pure upgrades create shopping chores.

---

## 12. Recommended Upgrade Catalog

### Tires

1. Used all-seasons
   - Cheap
   - Small grip boost
   - Wears faster

2. Good all-seasons
   - Balanced
   - Rain improvement

3. Snow tires
   - Big snow/pass grip boost
   - Slight dry speed penalty

4. Performance tires
   - Great dry steering
   - Weak snow durability

5. Off-road tires
   - Better shoulder/dirt recovery
   - Worse top speed

### Brakes

1. New pads
2. Slotted rotors
3. Big brake kit
4. Sketchy race pads
   - Strong braking
   - Worse in cold/rain until warmed

### Suspension

1. Fresh shocks
2. Rally springs
3. Stability kit
4. Lowering kit
   - Better steering
   - Worse off-road/water approach risk

### Engine

1. Tune-up
2. Intake
3. Cheap turbo
4. Real turbo
5. ECU tune

### Cooling

1. Coolant flush
2. New radiator
3. High-flow radiator
4. Auxiliary fan
5. Desert cooling kit

### Fuel / battery

1. Fuel filter
2. Efficient tune
3. Larger tank
4. EV battery conditioning
5. Emergency gas can / battery reserve

### Body

1. Zip-tied bumper
2. Reinforced bumper
3. Bash bar
4. Skid plate
5. Door armor

### Visibility

1. Wiper blades
2. LED bulbs
3. Fog lights
4. Rally light bar
5. Heated windshield

### Police avoidance

1. Radar detector
2. Scanner
3. Plate flipper gag item
4. Decoy stickers
5. Paint job

Keep the joke items, but make their effects simple.

---

## 13. Economy

### Cash sources

- Road pickups
- Clean driving streaks
- Near-miss bonuses
- Deliveries / missions
- Hitchhiker rewards
- Local knowledge bonuses
- On-time finish
- Daily challenge payout
- Achievement payouts
- Rest stop gambles

### Cash sinks

- Fuel
- Repairs
- Upgrades
- Bribes / legal fees
- Shortcut tolls
- Tow fees
- Temporary buffs
- Vehicle unlocks
- Cosmetic upgrades

### Keep cash readable

The existing project already converted score to dollars. Good. Keep it.

### Suggested run economy

A single normal run should produce enough money to buy:

- 1 major upgrade, or
- 2–3 minor repairs/upgrades, or
- Save for a vehicle

Do not make players grind 20 runs for tires. That is not progression. That is unpaid labor with sound effects.

---

## 14. Vehicles

Keep the current vehicle catalog, but make whole cars secondary to part upgrades.

### Vehicle identity

Each car should have a personality and base stats:

- Beater sedan: cheap, balanced, fragile
- SUV: stable, decent snow, okay range
- Used truck: durable, poor steering
- New truck: stronger, expensive, fuel-hungry
- EV truck: good torque, battery anxiety
- Sports car: fast, bad in snow/off-road
- Electric roadster: very fast, expensive, fragile-ish
- Premium EV sedan: strong all-around, late-game

### Commercial recommendation

For v1, only ship 4–5 fully tuned cars if necessary:

1. Beater Sedan
2. Used 4x4
3. Used Truck
4. Sports Car
5. EV Roadster

Keep the other vehicles in data if they already work, but don’t promise them on the Steam page until polished.

---

## 15. Police and Heat System

Keep the wanted star idea, but make it more legible.

### Heat should come from visible events

Examples:

- Hit cop
- Drive through roadblock
- Get reported at rest stop
- Illegal shortcut
- Suspicious cargo/event choice
- Aggressive weapon use
- Reckless high-speed town crossing

Avoid invisible heat creep. The project overview already notes that the system moved away from per-second heat trickle. Good. Keep that direction.

### Five-star behavior

At five stars:

- Heat should not vanish just because the player passes through town.
- Escape should require an explicit action:
  - Disguise
  - Paint job
  - Hide at rest stop
  - Bribe contact
  - Take risky detour
  - Special NPC outcome

### Police 2.0 v1 scope

Do not fully redesign cops immediately.

First build:

- Pursuit cops stay engaged after passing player
- Roadblocks are clearer
- Helicopter spotlight at night
- SWAT appears only at high heat
- Heat removal through rest stop choices

---

## 16. Weather and Road Hazards

Reuse existing weather and road systems.

### Current useful pieces

- Rain around mile 30–40
- Snow past mile 40 on Normal+
- Day/night cycle
- Grade signs
- Chains Required warning signs
- Real route slope/grade data
- Road-scale and regional visual traits

### Add hazard modifiers tied to upgrades

| Hazard | Affected by |
|---|---|
| Rain | Tires, wipers, visibility |
| Snow | Snow tires, chains, stability |
| Fog | Fog lights, speed, local warnings |
| Wind | Stability, vehicle weight, suspension |
| Darkness | Headlights, windshield damage |
| Heat/desert | Cooling system |
| Long climbs | Cooling, engine tune |
| Traffic | Brakes, steering |
| Farm equipment | Visibility, reaction time |
| Semi turbulence | Stability, vehicle weight |

### Important design principle

Weather should not just be visual. It should make upgrades matter.

---

## 17. Mission System

The existing overview says missions are planned but not started. Build a simple version.

### Mission types

1. Delivery
   - Carry item from one rest stop to another.
   - Reward on completion.
   - Penalty if busted/crashed.

2. Passenger
   - Pick up hitchhiker.
   - Drop them at a later stop.
   - They may help or hurt.

3. Timed errand
   - Reach next stop before timer.
   - Bonus cash.

4. Heat escape
   - Lose stars before next town.
   - Reward from shady contact.

5. Weather challenge
   - Cross pass without chains.
   - Risky, high payout.

### Mission UI

Keep mission display minimal:

- HUD chip with active mission
- Rest stop card with offer
- Completion popup

Do not build a giant quest log for v1.

---

## 18. Rest Stop Upgrades and Shops

Rest stops should not all sell the same things.

### Shop categories

1. Fuel
2. Repairs
3. Tires/chains
4. Cooling
5. Body work
6. Police avoidance
7. Rumors/intel
8. Hitchhiker/passenger
9. Temporary buffs
10. Permanent upgrades

### Regional inventory

| Region | Common upgrades |
|---|---|
| Seattle/Bellevue | Expensive electronics, radar, cosmetic |
| North Bend | Chains, tires, wipers, mountain advice |
| Snoqualmie Pass | Snow gear, emergency repairs |
| Cle Elum/Ellensburg | Cooling, trucker intel, tires |
| Vantage | Cooling, wind/stability upgrades |
| Othello/Hatton | Fuel, patch repairs, farm-road intel |
| Washtucna/Pullman | Last-chance repairs, heat reduction, party items |

### AS BUILT (2026-08-04) — what the shops actually are

Everything above this line is the original design intent. This is the shipped structure; where the
two disagree, this wins.

**Three parts vendors, distinct lanes.** The two garages carry ZERO overlapping categories, so which
one a stop has decides what you can buy there (`SHOP_CATEGORIES` in `src/data/upgrades.js`):

| Vendor | Stocks | Character |
|---|---|---|
| **Les Schwasted** | tires · brakes · suspension (+ traction tires, free popcorn/water) | Cheap, common — 10 of 19 stops |
| **Finesse (FAP)** | engine (incl. NOS) · fuel · coolant · wipers/lights/windshield · body · police · repair · paint · bumper | Expensive, rare — 9 of 19 stops |
| **Sam's Used Car Kingdom** | entry-tier windshield/headlights/wipers/bumper only | No tabs; a budget parts counter, not a garage |

4 stops carry both garages, 4 carry neither. Finesse used to stock all seven categories, which made
Schwasted a strict *subset* of it — there was no reason to ever stop there except the popcorn.

**Tier ladders.** Each category tab lists ALL of a slot's tiers at once, not just the next one:

| Row | State | Price shown |
|---|---|---|
| `✓ TIRES — Used All-Seasons` | owned, inert (no payload — can't charge or re-gate) | `OWNED` |
| `🔩 TIRES — Good All-Seasons` | the one buyable tier | real price |
| `🔒 TIRES — Snow Tires` | needs its predecessor installed | **real price** — you can see what you're saving toward |

Installing a rung flips it to ✓ and unlocks the one below it *in place* (`_unlockTier`), so Lv1→Lv2
in a single visit works. There is no fade-out receipt: a bought part stays visible as an ✓ OWNED
rung, because in a ladder removing it leaves a hole between `✓ Lv1` and `🔒 Lv3`.

**Untabbed slots are exempt.** `body` and `police` have no toolbar tab, so they render as
uncategorized SERVICES — and `_selectGarageCategory` pins services above the parts on *every* tab.
Laddering them would stack 6 permanent rows over whatever tab you opened, so they keep next-tier-only
listing until they get tabs of their own.

**The art constraint.** `assets/ui/garage_upgrade_toolbar.png` is ONE 1672×220 strip sliced into
seven equal columns **by index** — the labels are baked into the pixels. Adding a BODY or NITRO tab
is not a code change; the strip must be re-cut to nine columns first, and `GARAGE_CATEGORIES` order
must keep matching the art left-to-right or every tab silently mislabels. This is the whole reason
NOS sits under ENGINE (`category: 'engine'`) rather than owning a NITRO tab, and why body work is a
Finesse service rather than a category.

**Level 3 is Lord Motors exclusive** (`_applyDealerTierGate`) — a stop without a Lord Motors gates
every level-3 part, re-evaluated whenever a garage screen opens.

---

## 19. Art Direction

### Keep

- Neon UI
- 80s chrome style
- Pseudo-3D road
- Phone overlay
- Weather effects
- Regional scenery
- Characterful end screens
- Real-world-ish route identity

### Add

- NPC portrait cards
- Gas station interior/backdrop cards
- Rest stop signs / place cards
- Upgrade icons
- Condition icons
- Character encounter frames

### Portrait style

Best direction:

- Semi-realistic illustrated character portraits
- Slightly exaggerated expressions
- Dark-comedy / roadside America mood
- Consistent lighting and framing

Avoid:

- Random AI styles per character
- Overly cartoony mobile-game look
- Hyper-real portraits that clash with the road art

---

## 20. Audio Direction

Reuse existing radio system.

### Add later

- DJ chatter
- Area intros
- Rest stop stingers
- Police scanner chatter
- Weather warnings
- Mechanic voice clips

For v1, text-only encounters are enough. Voice clips can become DLC/polish later.

### Radio as monetization/content

A soundtrack/radio pack is plausible later if the base game works.

---

## 21. UI / UX Recommendations

### Main HUD

Show:

- Cash
- HP / damage
- Fuel / range
- Heat stars
- Speed
- Region
- Time to party
- Current weather/hazard
- Active mission

### Garage UI

Show:

- Car portrait
- Stats bars
- Upgrade slots
- Current condition
- Upgrade preview
- Cost
- Tradeoff text

### Rest Stop UI

Show:

- Location
- Character portrait
- Dialogue
- Choice buttons
- Car state strip
- Shop tabs

### Phone-as-menu

Keep it. It is distinctive.

Fix priority:

1. Music / garage / maps / start-over / checkpoint buttons
2. Clean up steering selection
3. Add upgrade/garage clarity
4. Add codex/facts later

---

## 22. MVP Scope

The minimum commercial prototype should include:

### Route

- Seattle to Snoqualmie Pass only, or Seattle to Vantage if already stable
- 3–5 rest stops
- Weather transition from rain to snow
- At least one strong visual landmark per zone

### Driving

- Existing core driving
- Traffic
- Damage
- Cops
- Fuel
- Weather
- Checkpoint/rest save

### Upgrades

At minimum:

- Tires
- Brakes
- Cooling
- Headlights/wipers
- Bumper/body
- Fuel/range

### Encounters

- 15 total encounter cards
- 3 per rest stop
- 6 character portraits minimum

### Economy

- Cash rewards
- Repair costs
- Fuel costs
- Upgrade costs

### Ending

- Reach demo endpoint
- Crash
- Busted
- Out of fuel
- Too late if party clock is active

---

## 23. Full v1 Scope

### Route

- Full Seattle to Pullman route
- 17–18 rest stops including Hatton
- Finish cinematic at Pullman Party House

### Encounters

- 45–60 encounter cards
- 12–18 NPC portraits
- Local facts integrated by region

### Upgrades

- 8–10 upgrade categories
- 3 levels each
- Car condition/damage affects stats

### Vehicles

- 5 polished vehicles minimum
- 8 if current catalog is stable

### Modes

- Main Run
- Custom Run
- Daily Run local seed
- Tutorial

### Progression

- Persistent upgrades
- Achievements
- Unlockable vehicles
- Unlockable encounter chains
- Optional cosmetics

---

## 24. Development Roadmap

### Phase 1: Stabilize existing DUI

Goal: stop active breakage and protect existing value.

Tasks:

- Fix phone-menu buttons
- Fix critical render/layer issues
- Add Hatton rest stop
- Fix rest-stop save/continue flow
- Remove or guard dev warp for release builds
- Confirm build works on web and iOS

### Phase 2: Reframe product shell

Goal: make the game commercially presentable.

Tasks:

- Choose release title
- Rewrite title screen framing
- Reduce “DUI” front-facing branding
- Add Steam-friendly description language
- Create intro/tutorial text
- Make one clean demo route

### Phase 3: Build encounter system

Goal: make rest stops interesting.

Tasks:

- Create encounter data format
- Add portrait card UI
- Add choice effects
- Add first 15 encounter cards
- Add local fact support
- Add encounter conditions

### Phase 4: Build part upgrade system

Goal: move from whole-car upgrade focus to part-by-part progression.

Tasks:

- Define player-facing stats
- Add upgrade slots to vehicle save data
- Add garage UI upgrade preview
- Add tires/brakes/cooling/body/visibility/fuel upgrades
- Add weather/stat hooks

### Phase 5: Commercial demo

Goal: playable demo that can collect wishlists or user feedback.

Tasks:

- Polish Seattle to Snoqualmie Pass or Seattle to Vantage
- Add 5–8 portraits
- Add 15–25 encounters
- Add 20 upgrades
- Add trailer capture points
- Add Steam page copy
- Add feedback form / Discord link if desired

### Phase 6: Full route completion

Goal: full v1 game.

Tasks:

- Fill all rest stops
- Add Hatton
- Build Pullman finish cinematic
- Add final route difficulty ramp
- Add Daily Run
- Balance economy
- Optimize performance

---

## 25. Claude Build Prompt Pack

Use these one at a time. Do not paste the whole universe into Claude and ask it to “build the game.” That creates code shaped like a raccoon nest.

### Prompt 1: Encounter system design

```text
Read PROJECT_OVERVIEW.md and inspect RestStopScene.js, constants.js, SaveSystem.js, Wallet.js, and GameScene.js.

Design and implement a data-driven Rest Stop Encounter system.

Requirements:
- Encounters are defined in a new data file, not hard-coded in RestStopScene.
- Each encounter has id, stopId, region, speaker, portrait, line, optional fact, choices, conditions, and effects.
- RestStopScene displays a portrait card with dialogue and 2-3 choices.
- Choices can affect cash, fuel, damage, heat stars, time, temporary buffs, and upgrades.
- Add a skip/continue path so rest stops remain fast.
- Add at least 5 sample encounters across Seattle, North Bend, Snoqualmie Pass, Vantage, and Othello.
- Do not break existing shop tabs.
- Keep the implementation minimal and easy to extend.
```

### Prompt 2: Player-facing car stats

```text
Inspect the current vehicle, damage, accessory, weather, and driving physics code.

Create a player-facing car stats layer with these stats:
- Grip
- Steering
- Stability
- Braking
- Durability
- Cooling
- Visibility
- Range

Do not replace the existing physics all at once. Add a translation layer that computes these stats from current vehicle base stats, accessories, damage, and upgrades.

Expose a function getVehicleDisplayStats(vehicleId, saveState) that returns 0-5 bar values and short text descriptions.

Add no UI yet except console/debug output.
```

### Prompt 3: Part upgrade data model

```text
Create a data-driven part upgrade system.

Requirements:
- Upgrade slots: tires, brakes, suspension, engine, cooling, fuel, body, visibility, police.
- Each upgrade has id, slot, level, label, cost, description, effects, and tradeoffs.
- Upgrades persist per vehicle in the existing save architecture.
- Temporary repairs and permanent upgrades must be separate.
- Add functions buyUpgrade(vehicleId, upgradeId), hasUpgrade(vehicleId, upgradeId), getInstalledUpgrade(slot), and getUpgradeEffects(vehicleId).
- Do not remove existing vehicle accessory support yet. Bridge the new system to the old accessories where possible.
```

### Prompt 4: Garage upgrade UI

```text
Update the Garage UI to show part upgrades.

Requirements:
- Show selected vehicle.
- Show player-facing stat bars: Grip, Steering, Stability, Braking, Durability, Cooling, Visibility, Range.
- Show upgrade slots.
- Selecting an upgrade previews stat changes before purchase.
- Show cost, tradeoff, and short flavor text.
- Keep current vehicle picker working.
- Use simple UI first. Do not over-design.
```

### Prompt 5: Hook stats into weather/handling

```text
Hook the player-facing stats into gameplay gradually.

Requirements:
- Grip affects rain/snow slide and off-road recovery.
- Steering affects lateral response.
- Stability affects wind shove, crash impulse recovery, and fishtail.
- Braking affects deceleration and recovery.
- Cooling affects engine heat risk on climbs, boost, and desert sections.
- Visibility affects fog/night warning distance or screen obstruction intensity.
- Keep values subtle at first.
- Add debug readout for effective stat values during gameplay.
```

### Prompt 6: Hatton rest stop

```text
Implement the approved Hatton, WA rest stop at approximately mile 205.

Wire it into:
- REST_STOP definitions
- Checkpoints/town windows
- Route map
- RestStopScene
- Encounter system
- Save/checkpoint codes

Use the existing route/rest stop patterns. Do not invent a new rest stop architecture.
```

### Prompt 7: Steam demo cut

```text
Create a Steam-demo build mode.

Requirements:
- Demo route ends at Snoqualmie Pass or Vantage.
- Include a demo end screen asking players to wishlist the full game.
- Disable dev warp unless in debug builds.
- Keep save data separate from full game save data.
- Add a visible version label.
- Make sure the build can run from a static host.
```

---

## 26. Revenue Strategy

### Target

$50,000 revenue target.

### Recommended pricing

Steam:

- $9.99 base price if modest v1
- $12.99 if full route + upgrades + encounters feel polished
- 10–15% launch discount

### Sales math

At $9.99:

- 5,000 copies = about $50,000 gross
- Realistic net after platform cut, refunds, discounts, taxes, and regional pricing requires more like 8,000–15,000 copies depending on assumptions

At $12.99:

- Fewer copies needed
- Higher expectations
- Better if game has full route and strong replayability

### Best path to $50k

1. Steam page early
2. Demo
3. Short trailer showing chaos, route, upgrades, and encounters
4. Post clips on TikTok/YouTube Shorts/Reddit
5. Lean into Washington/I-90 identity
6. Avoid making the game look like a generic mobile ad clone
7. Add local humor and route-specific encounters
8. Launch only when the first 20 minutes feel good

---

## 27. Steam Page Positioning

### Store short description

A dark-comedy arcade driving roguelite across Washington. Survive the road from Seattle to Pullman, manage your terrible car, dodge cops and weather, meet gas station weirdos, upgrade one broken part at a time, and try to make the party before time runs out.

### Tags

- Arcade
- Driving
- Roguelite
- Comedy
- Racing
- Action
- Singleplayer
- Retro
- 2D
- Difficult
- Replay Value

### Trailer must show

1. Fast road gameplay
2. Rain/snow/night
3. Rest stop character encounter
4. Upgrade screen
5. Cops escalating
6. Vantage wind or Snoqualmie snow
7. Pullman goal / party clock
8. Funny failure screen

### Screenshots

- Seattle bridge/tunnel
- North Bend rain/fog
- Snoqualmie Pass snow
- Vantage wind/desert
- Gas station encounter portrait
- Garage upgrades
- Police chase
- Phone menu/map
- Pullman finish

---

## 28. Major Risks

### Risk 1: Scope explosion

Mitigation:
- Build encounter system with 15 cards first
- Build 6 upgrade categories first
- Demo route before full route

### Risk 2: Platform content issues

Mitigation:
- Reframe from “DUI simulator” to “dark-comedy road-trip roguelite”
- Keep adult content optional or stylized
- Avoid presenting impaired driving as instruction or endorsement
- Use satire and consequences

### Risk 3: Current codebase complexity

Mitigation:
- Add systems as data-driven layers
- Avoid rewriting GameScene unless needed
- Keep feature branches small
- Make Claude inspect files before edits
- Test after each system

### Risk 4: Upgrades do not feel meaningful

Mitigation:
- Make weather and hazards respond to stats
- Show upgrade previews clearly
- Use tradeoffs
- Add immediate feedback after purchase

### Risk 5: Encounters become annoying

Mitigation:
- Allow fast skip
- Keep text short
- Make choices matter
- Avoid repeating the same card too often
- Use location-specific encounters

---

## 29. Recommended Immediate Next Steps

1. Fix the broken phone-menu buttons.
2. Add Hatton rest stop.
3. Create encounter data format.
4. Add a single portrait-card encounter to one rest stop.
5. Add 5 test encounters.
6. Create player-facing car stats.
7. Create part upgrade data.
8. Hook tires into rain/snow behavior.
9. Hook cooling into heat/boost/grade behavior.
10. Build a short demo route and playtest the first 15 minutes repeatedly.

---

## 30. Final Recommendation

The strongest version of this project is not a total redesign. It is:

## A dark-comedy Seattle-to-Pullman arcade driving roguelite with gas station encounters and part-by-part car upgrades.

Reuse DUI’s existing route, pseudo-3D engine, cops, weather, damage, phone menu, wallet, rest stops, vehicles, and neon identity.

Add the missing commercial glue:

- Rest stop character encounters
- Local fact cards
- Meaningful part upgrades
- Clear car stats
- Better route pacing
- Steam demo framing
- Reduced platform-risk branding

The current project already has enough systems to become interesting. The job now is to stop adding random cool stuff and make the existing cool stuff form a loop that players understand, replay, and maybe pay for. Disgustingly practical, but that is how games ship.


---

# Chapter 4 — Survival System Spec

# Survival System — Build Spec (v1)

Replaces the drug/vice-effect model with a **3-bar road-trip survival system**:
**Tiredness · Hunger (Fullness) · Thirst (Hydration)**. Every legacy visual
effect is re-homed to a meaningful bar state. Numbers are v1 — tune in playtest.

Bars are stored 0–100 (internally 0–1 is fine; this doc uses 0–100).

---

## 1. The three bars

| Bar | 0 means | 100 means | Baseline drift/mile | Sweet spot |
|---|---|---|---|---|
| **Tiredness** | fully alert | asleep → crash | **+0.7 / mi** (rises) | keep < 50 |
| **Fullness** (Hunger) | starving | stuffed | **−0.9 / mi** (falls) start 62 | 35–65 |
| **Hydration** (Thirst) | dehydrated | bursting bladder | **−1.0 / mi** (falls) start 68 | 35–65 |

**Interlock accelerators on Tiredness gain:**
- Dehydrated (Hydration < 25): ×1.5
- Stuffed (Fullness > 75): ×1.4
- Caffeine withdrawal active: ×1.25
(Multipliers stack.)

**Nausea** is a *sub-state* (0–100, not a bar): rises on winding/curvy road and
on some Sushi; cured by Dramamine. Effect: green tint + queasy blur + focus wobble.

**Caffeine dependence** is a hidden counter (see §4).

---

## 2. Effect thresholds (what each bar does)

### Tiredness (the master → the only terminal fail)
- **0–50** fine
- **50–70 Drowsy:** eyelid vignette closing, screen dim, slower steering; double-vision from ~65 (reuse alcohol/sushi double-vision)
- **70–85 Highway Hypnosis:** time distortion (speedo pegs ~60, world flies — reuse LSD time-warp) + hallucination visuals blend in (reuse shrooms saturation + LSD geometry). **Worse on long empty straights** (few curves, no traffic/landmarks — Basin/Palouse); a twisty or busy road suppresses it.
- **85–95 Micro-sleep:** brief control blackouts / input drops
- **95–100 Asleep at the wheel:** crash → run ends ("YOU FELL ASLEEP")

### Hydration
- **0–25 Dehydrated:** tunnel vision (edge vignette / FOV narrow), headache pulse, tiredness ×1.5, steering "cramp" micro-stutters
- **25–75** fine
- **75–100 Bladder:** screen jiggle + "🚻" nags; **≥90 forces a rest-stop** (or squirming steering penalty until you go)

### Fullness (Hunger)
- **0–25 Starving/hangry:** camera tremor (reuse coke/meth jitter), weak acceleration, dimming, slow reactions
- **25–75** fine (small handling/reaction bonus 40–65)
- **75–100 Food coma:** sluggish, tiredness ×1.4, mild top-speed drag

### Cop tie-in
Any impaired state (drowsy / dehydrated / hangry / bladder / nausea) = erratic
driving → wanted-star gain / "Wellness Check" pull-over. This replaces the old
DUI/reckless trigger with a coherent, non-drug reason.

---

## 3. Item roster & exact effects

8 consumables + 2 power-ups. `+`/`−` are applied on pickup unless noted.

**GLOBAL RULES (2026-07-06):** No consumable grants a **wanted-star**, a
**speed/damage/combat bonus**, or a **delayed crash/rebound**. Consumables ONLY
move the survival bars (immediate, fixed amounts). (Caffeine *addiction* in §4 is
a kept dependence system, not a "crash".)

| Item | Category | Tiredness | Hydration | Fullness | Notes |
|---|---|---|---|---|---|
| **Water** | hydration | −5 | **+25** | **+7** | overshoot → bladder |
| **Cold Brew** | caffeine (mild) | **−18** | −8 (diuretic) | **+10** | **no addiction** — the safe starter |
| **Caffeine Pills** | caffeine (strong) | **−30** | −12 (diuretic) | — | **builds addiction** (§4) |
| **Slushie** | sugar drink | **−10** | **+15** | **+10** | no crash |
| **Gummies** | sugar snack | **−6** | — | **+4** | **1/20 = "Odd Gas Station Gummies"** → max shroom trip (wavy road + rainbow); otherwise a tiny sugar pep |
| **Sushi** | food (risky) | **+5** | — | **+10** | ~**1/12 "bad fish"** → Bladder → ~90 + nausea. **No other effects** (no double-vision/drift) |
| **Burrito** | food (heavy) | **+20** | — | **+20** | **No other effects** (no permastoned lock) |
| **Dramamine** | medicine | **+25** (drowsy) | — | — | **cures Nausea AND sushi sickness** |
| **Quad Shot** | power-up | **→ 0** (clears bar) | **−15** (diuretic) | **+10** | inventory item (was Emergency Espresso) |
| **Redneck Rage** | power-up (energy drink) | — | **+10** | **+10** | 1-mi invincible bulldoze + red spectacle |
| **Sleep** (rest-stop nap) | action | **→ 0** | — | — | costs party-clock time (~3–8 min) |

**Design contrast:** Caffeine = alertness + dehydration (+ addiction on Pills) ·
Water = small honest reset · Food = fills but *sedates* (Sushi +5 tired/bite,
Burrito +20) · Dramamine = fixes stomach but sedates · Sugar = minor snack/drink
(Gummies rare trip, Slushie a drink). Both sugar's crash and all speed/combat
bonuses are gone per the global rules.

**Nausea sources (kept simple):** (1) winding/curvy road (motion sickness —
Snoqualmie Pass + mountain curves), (2) **bad Sushi** ("bad fish"). Dramamine
cures both. That's it unless we add more later.

**"More food = quicker sedation":** the higher Fullness is, the stronger the
food-coma tiredness multiplier ramps (×1.0 at 75 → ×1.4 at 100).

---

## 4. Caffeine addiction (Caffeine Pills only, ~50% of old alcohol, earlier onset)

- Hidden `caffeineDependence` 0–100. Each Caffeine Pill: **+8**; decays **−1/mi**.
- **Onset earlier** than old alcohol addiction (dependence effects begin ~15, vs ~30).
- **Magnitude ~50%** of old alcohol addiction at cap.
- **Withdrawal** (dependence > onset AND no caffeine in system): headache pulse +
  Tiredness gain ×1.25 + a craving nudge (Caffeine Pills weighted to spawn a bit
  more). Satisfied by any caffeine. Cold Brew never builds dependence.

---

## 5. Availability — meta-unlock ladder (persisted in save, across runs)

**Start kit (always):** Water · Burrito · Cold Brew.

| Item | Unlock trigger |
|---|---|
| Gummies | 100 total miles driven |
| Sushi | Reach **Cle Elum** (mi 84) once |
| Slushie | Reach **Ellensburg** (mi 109) once |
| Caffeine Pills | Drink **40 Cold Brews** lifetime |
| Dramamine | Clear **Snoqualmie Pass** once |
| Quad Shot | First time you **fall asleep at the wheel** |
| Redneck Rage | Wreck **50 cars** lifetime |

Retire the per-run `_checkUnlocks` gates → replace with a save-persisted
`unlockedVices` set + trigger checks wired to StatsTracker/AchievementSystem.

---

## 6. Code to retire / re-home

- **`_checkUnlocks`** drug-escalation gates → save-persisted unlock set (§5).
- **Overdose / OD system** (no lethal items now) → terminal fail is Tiredness-crash only.
- **Full-bar drunk "drift"** on Sushi (GameScene ~L13033 `drunkDrift`, sign/steer wander) → **removed**.
- **Permastoned** weed lock (Burrito) → removed; Burrito is plain heavy food.
- **Cross-drug** bar interactions, **cocaine wanted-star mult**, **meth +1 crash** → removed/re-homed to bar states.
- **Speed-bonus** systems (`getCocaineSpeedBonusMPH`/`getMethSpeedBonusMPH`) → removed; caffeine gives alertness, not raw MPH.
- **Drug-drift pickup magnetism** (`_updateViceDrift`) → keep or remove per Easy-mode call.

## 7. New systems to build
1. Three bars + nausea + caffeineDependence in ViceSystem (or new SurvivalSystem), with per-mile drift + accelerators.
2. EffectsSystem: drive visuals from **bar states** (thresholds in §2) instead of per-vice levels.
3. HUD: three bar readouts (Tiredness / Hunger / Thirst) + nausea/bladder indicators.
4. Item pickups apply §3 deltas; Sushi bad-fish roll; sugar-crash timers; Dramamine nausea cure; Quad Shot bar-clear.
5. Save-persisted unlock ladder (§5).
6. Highway-hypnosis road-monotony input (curvature/traffic/landmark density → suppression).

---
*Locked 2026-07-06. This is the build contract for the survival rework.*


---

# Chapter 5 — Tree Asset Brief

# Tree Asset Brief — Western & Eastern WA Roadside Pass

Target consumer: Codex (image generation). Drop generated PNGs into the listed paths; AssetManifest.js + GameScene.js + RouteData.js are already wired to reference these keys.

## Global rules (apply to every asset below)

- **Format:** transparent PNG. No background fill, no shadow plate, no ground disk under the trunk.
- **Crop:** trunk base centered on the bottom edge of the canvas. The renderer anchors trees bottom-center, so any empty pixels below the trunk push the tree into the air.
- **Padding:** ≤ ~6% transparent margin on each side. Tighter is better; collision width fraction is 0.40 of the rendered sprite, so excessive side padding makes the hitbox feel wrong.
- **Perspective:** straight-on / slightly-below eye level (the player is in a car looking out the side window). Not aerial, not isometric.
- **Lighting:** flat-to-moderate Pacific Northwest overcast light. No hard rim-lights, no neon, no stylized cartoon outlines. These need to read alongside the existing photo-realistic Codex buildings — not against them.
- **Variants:** at least 2 per species so the scenery loop doesn't visibly repeat. Variant differences should be silhouette-level (lean, branch density, height proportion), not just color swaps.

## Reference dimensions

Existing trees on disk and the size band they hit. Match these so new species sit visually consistent.

| File | Pixels (W × H) | Aspect | Notes |
|---|---|---|---|
| trees/hemlock1.png | 1740 × 2654 | 0.66 | Tall conifer reference. Aim near this for full-grown species. |
| trees/cedar2.png | 894 × 1582 | 0.57 | Mid-sized conifer reference. |
| trees/hemlock2.png | 635 × 768 | 0.83 | Smaller / squatter variant. |

**Target spec for new tall conifers:** ~1500–1800 px wide × ~2400–2800 px tall, transparent PNG.
**Target spec for shorter pines / shrubs:** ~900–1400 px wide × ~1100–1700 px tall.

## Urban broadleaves (mile 0–14) — West Seattle homes, downtown Seattle, Mercer Island, Bellevue

These are the planted-street / front-yard / park trees that fill in the gaps between the photo buildings. They're shorter than the wild conifers and have wider crowns.

### A. Bigleaf Maple — `tree_bigleaf_maple_1`, `tree_bigleaf_maple_2`
- Path: `public/assets/trees/bigleaf_maple_1.png`, `public/assets/trees/bigleaf_maple_2.png`
- Reference: *Acer macrophyllum* — the iconic Pacific Northwest maple. Massive lobed leaves (~12 inches), broad rounded crown, often moss-draped lower limbs.
- Silhouette: wider than tall — crown spreads ~1.2× the height. Smooth gray bark on the trunk, branches forking irregularly.
- Color: deep green summer foliage. (Fall variant optional but not required.)
- Target px: ~1600 × 1800 (slightly wider than tall — opposite aspect from conifers).
- Variant 2: more weathered specimen, denser canopy, slight lean.

### B. Vine Maple — `tree_vine_maple_1`
- Path: `public/assets/trees/vine_maple_1.png`
- Reference: *Acer circinatum* — multi-trunked understory maple, smaller (15–25 ft in life).
- Silhouette: clumpy, multi-stem, smaller-than-conifer footprint. Good for yard infill.
- Target px: ~1100 × 1300.

## Western Washington (mile 14–88) — Bellevue → Issaquah → Snoqualmie Pass

Mature wet-side conifers. Dense, deep-green, often moss-tinged.

### 1. Douglas Fir — `tree_douglas_fir_1`, `tree_douglas_fir_2`
- Path: `public/assets/trees/douglas_fir_1.png`, `public/assets/trees/douglas_fir_2.png`
- Reference: *Pseudotsuga menziesii*, the signature Pacific NW tree.
- Silhouette: tall, slightly tapered conical-but-irregular crown, drooping lower branches, dark green needles with a slight blue tint.
- Trunk: visible bark column on the lower third — coarse, deeply furrowed, reddish-brown.
- Variant 2: leaner, slightly windward-tilted; ~10% shorter; bottom branches more uneven.

### 2. Western Hemlock (Tsuga) — `tree_hemlock_3` (NEW variant)
- Path: `public/assets/trees/hemlock3.png`
- Reference: *Tsuga heterophylla*, droopy leader (the top bends over), fine soft needles.
- Existing `hemlock1.png` / `hemlock2.png` cover this species but only 2 variants — add ONE more to break the repeat cycle in dense `cascades` segments. Make it slightly younger / narrower than hemlock1, with a more pronounced bent leader.

### 3. Western Red Cedar — `tree_red_cedar_1`, `tree_red_cedar_2`
- Path: `public/assets/trees/red_cedar_1.png`, `public/assets/trees/red_cedar_2.png`
- Reference: *Thuja plicata*. Flat-spray scale-like foliage, often draping in fronds, broad pyramidal silhouette.
- Trunk: shaggy reddish-brown fibrous bark, often slightly buttressed at the base.
- Variant 2: older specimen — broader crown, some dead branches at the bottom showing through, slightly fluted trunk.
- The existing `cedar1.avif` / `cedar2.png` may be retired or kept as additional variants. Match these new ones to the photo-realistic style of the buildings.

## Eastern Washington (mile 88–195) — Cle Elum → Ellensburg → Vantage → Columbia Basin

Dry-side conifers. Sparser, redder bark, more open crowns. Mixed with sage shrubland after Vantage.

### 4. Ponderosa Pine — `tree_ponderosa_1`, `tree_ponderosa_2`
- Path: `public/assets/trees/ponderosa_1.png`, `public/assets/trees/ponderosa_2.png`
- Reference: *Pinus ponderosa*. Tall, straight, open crown, very visible orange/cinnamon plated bark (the "jigsaw-puzzle" pattern), long bundled needles.
- Silhouette: less full than a doug fir — bare lower trunk, foliage concentrated in the upper third to half.
- Variant 2: shorter (younger) specimen with denser mid-crown, foliage starting lower.

### 5. Western White Pine — `tree_white_pine_1`, `tree_white_pine_2`
- Path: `public/assets/trees/white_pine_1.png`, `public/assets/trees/white_pine_2.png`
- Reference: *Pinus monticola*. Slender, regular whorled branches, softer blue-green needles than ponderosa, slightly more conical.
- Silhouette: cleaner, more uniform tiering of branches than the irregular ponderosa.
- Variant 2: storm-damaged / slightly asymmetric crown — adds visual variety in scattered placements.

### 6. Shrub — Sagebrush / Rabbitbrush — `shrub_sage_1`, `shrub_sage_2`, `shrub_rabbitbrush_1`
- Path: `public/assets/trees/sage_1.png`, `public/assets/trees/sage_2.png`, `public/assets/trees/rabbitbrush_1.png`
- Reference: *Artemisia tridentata* (sage — silvery-gray, low and round, ~3–5 ft tall in life) and *Ericameria nauseosa* (rabbitbrush — taller, yellowish-green with bright yellow flower tops in late summer).
- Silhouette: low, round, irregular mounds. NOT tree-shaped.
- Target px: ~900 × 700 (wider than tall — these are squat).
- The renderer applies a 0.50 collision width fraction to `'shrub'` sprites (vs 0.40 for `'tree'`), so a slightly wider canvas read is fine.
- Variant 2 (sage_2): smaller / more weathered specimen.

## Filename + manifest keys summary

These keys are already (or will be) registered in `src/systems/AssetManifest.js`:

```
tree_douglas_fir_1     assets/trees/douglas_fir_1.png
tree_douglas_fir_2     assets/trees/douglas_fir_2.png
tree_hemlock3          assets/trees/hemlock3.png        (added — new variant)
tree_red_cedar_1       assets/trees/red_cedar_1.png
tree_red_cedar_2       assets/trees/red_cedar_2.png
tree_ponderosa_1       assets/trees/ponderosa_1.png
tree_ponderosa_2       assets/trees/ponderosa_2.png
tree_white_pine_1      assets/trees/white_pine_1.png
tree_white_pine_2      assets/trees/white_pine_2.png
shrub_sage_1           assets/trees/sage_1.png
shrub_sage_2           assets/trees/sage_2.png
shrub_rabbitbrush_1    assets/trees/rabbitbrush_1.png
```

## When the assets land

1. Drop the PNGs at the listed paths.
2. `npm run dev` — Phaser preloads them via the existing manifest.
3. Trees will spawn automatically in their region bands per RouteData.js wiring (see `regionalTreePool` / `_regionTreePool` helper).
4. If a tree reads too small/tall, tune the `heightMult` / `maxH` values in `SCENERY_IMAGE_PROFILES` (top of `src/scenes/GameScene.js`). Existing conifer profile baseline: `{ heightMult: 2.4, maxW: 220, maxH: PLAYER_CAR_VISUAL_H * 4.2, minOffset: 1.85, groundDrop: 0.010 }`.


---

# Chapter 6 — Work History (DUI lineage, pre-fork)

> Historical DUI-era session notes carried over at the fork (2026-07-04). Parts are superseded — see Chapter 1.

# DUI — Work History

## Session — 2026-07-01 (Drug sprite refresh)

### Assets created
- Added `public/assets/drugs/narcan.png` and `public/assets/drugs/steroids.png`.
- Both are 256×256 RGBA PNG badges with transparent corners.
- Narcan uses a gold/orange field and nasal-spray device; steroids uses a purple field with an amber vial and gold flexed-arm emblem.

### Existing sprites refreshed
- Rebuilt all ten original drug badges with smoother, higher-detail artwork, larger subjects, complete circular borders, and stronger foreground/background contrast.
- Final palette:
  - weed — warm orange
  - fentanyl — red
  - meth — midnight navy
  - Rx — cyan
  - beer — royal blue
  - LSD — purple
  - ketamine — coral red
  - mushrooms — hot pink
  - heroin — bright caramel/gold
  - cocaine — deep teal
- Updated files remain at their existing paths under `public/assets/drugs/`; cocaine remains WebP and the others remain PNG.
- Every shipping sprite is 256×256 with transparency outside the complete badge circle.

### Backup and cache handling
- Pre-refresh originals are preserved in `public/assets/drugs/_pre_refresh_backup_2026-07-01/`.
- Updated drug paths in `src/systems/AssetManifest.js` from `?v=badge-zoom-1` to `?v=badge-refresh-2` so cached clients fetch the new artwork.

### Verification
- Visually checked the full 12-sprite set together at game-asset size.
- Confirmed expected PNG/WebP formats, 256×256 dimensions, alpha transparency, complete rings, and readable subjects.
- `npm run build` passes. Vite still reports only the pre-existing large-chunk advisory.

---

## Session — 2026-05-15 (West Seattle art / port cranes / revert note)

### What was worked on
- Reviewed the West Seattle building/crane setup after the port cranes were showing visually through or across the bridge road.
- Confirmed the crane spawn logic lives in [src/road/RouteData.js](src/road/RouteData.js), not only in the image folder:
  - Bellevue, Issaquah, Seattle, and West Seattle building image keys are referenced from route/scenery data.
  - The actual image files live under `public/assets/buildings/codex/` for the newer Codex-generated art.
- Reviewed West Seattle bridge crane rendering in [src/scenes/GameScene.js](src/scenes/GameScene.js) and bridge/railing drawing in [src/road/Road.js](src/road/Road.js).

### Art/assets created or discussed
- West Seattle art direction was adjusted toward higher-quality, more realistic scenery to match the Bellevue and Issaquah assets.
- Port/shipping-container crane direction:
  - two crane color families requested: orange/rust and white/gray
  - left/right variants requested so cranes match road perspective
  - shipping-container stacks requested as one combined PNG-style asset
- Seattle building order was discussed for a south-to-north pass:
  - stadium/SODO elements first
  - downtown south towers next
  - denser central/waterfront skyline after that

### Code review notes from this session
- The biggest visible issue is not the crane art itself; it is scenery placement/rendering:
  - cranes are very wide/tall scenery sprites
  - they are spawned close enough that their screen footprint can cross the road deck
  - normal roadside-building rules are not ideal for port cranes
- Best future fix would be to treat West Seattle cranes as special port-background scenery:
  - push them farther from the road
  - reduce clustering/repeat density
  - cap their rendered size lower than normal skyline objects
  - cull or shift them if their inner edge overlaps the drivable road
  - keep road/bridge/railing occlusion consistent

### Change made and reverted
- I changed the West Seattle crane `renderDepth` in [src/road/RouteData.js](src/road/RouteData.js) from `2.0` to `-0.5` while trying to make the road/bridge draw over crane bases.
- I also added a related comment in [src/road/Road.js](src/road/Road.js).
- That was not what was wanted at that point, so it was reverted.

### Current state after revert
- West Seattle crane `renderDepth` is back to `2.0`.
- The Road.js comment about cranes rendering below the road was removed.
- No crane placement, sizing, artwork, or render-loop behavior was changed after the revert.

---

# DUI — Build Notes

## Session — 2026-05-12 (Phone-as-Menu + per-vehicle art + warps)

### Phone-as-menu (HTML overlay)
- **CSS-driven portrait overlay** ([index.html](index.html)) — `#phone-menu` shows in portrait via media query, hides in landscape. Phaser game pauses underneath.
- **Tap-to-unpause** after rotating back to landscape — first pointerdown anywhere resumes the run. Skipped when lock-pause is on.
- **Lock-pause chip** (🔓 / 🔒) — overlaid in the upper-right blank widget tile. Tap toggles `window.__phoneLock` which the orientation watcher checks before auto-resuming.
- **Trophy chip** (🏆) — upper-left blank widget tile. Click placeholder for future trophy page.
- **In-world phone clock** — overlaid on the Calendar widget's lower band, formats elapsed party-clock fraction over 2:00 PM → 8:00 PM (6-hour window). Updates every second.
- **Map modal** ([SVG vertical map of Seattle → Pullman](index.html)) — opens on Maps tap. Pulses red dot at player's live mileage, shows named rest-stop pins.
- **Garage modal** — opens on Garage tile tap. Lists every owned vehicle with thumbnail (loads from `/assets/cars/*.png`), label, stats line, and accessory badges (🛡 Bumper / ⚡ NOS L1-3 / ❄️ Traction) above the thumbnail. Tap row to switch vehicle (restarts scene).
- **Music app** — Spotify-style modal. Genre grid → song list. Shuffle All + Shuffle Genre. Tap song to play. AudioSystem got `getStations()`, `setStation()`, `playSpecificTrack()`, `shuffleAllTracks()` to support it.
- **Checkpoint button** — warps the run to `_lastCheckpoint` (mid-run) or `save.lastRestStop` (between runs); no-op flash if neither exists.
- **Steering selection stroke** — Tap / Tilt / L/R buttons get a 4-px inset black stroke when matching `steeringMode` registry value. Defensive sweep clears `.selected` from every hit zone before applying.

### Hit-zone auto-positioning (no more % retuning!)
- Hit zones declare `data-px="x y w h"` in **PNG pixel coordinates**.
- JS reads `bgImg.naturalWidth/Height`, applies `object-fit:cover` math, positions each zone in viewport-pixel coordinates. Zones auto-track on every device — no per-aspect calibration.
- **`?debug` URL param** flashes red dashed boxes with labels on every hit zone.
- **`?calibrate` URL param** — tap any spot, get a chip showing the PNG pixel coord. Walk the icons, send the numbers, paste into `data-px`.

### Per-vehicle art (no more procedural placeholder!)
- Six vehicle PNG pairs (front + back) wired:
  - `beater` → white (relabeled **"Used Sedan"**)
  - `suv4x4` → blue
  - `usedTruck` → truck blue
  - `evTruck` → orange
  - `bestlaRoadster` → green (relabeled **"Electric Roadster"**)
  - `playdoutS3X` → blue2 (relabeled **"Bestla Play'dOut"**, fuel `gas` → `electric`)
- Player sprite reads `_veh.spriteBack`. Falls back to procedural `car_player` + tint for vehicles without PNG.
- Aspect-preserving sizing: width fixed at 90 px, height = `90 * (sourceH / sourceW)` so each car keeps its true proportions.

### Title screen overhaul
- **Wheel flipped to RIGHT side**, START button on LEFT — then START removed entirely. Tap a difficulty panel = immediate launch.
- Uniform 2-px white stroke on all wheel panels (yellow active highlight + ▶ marker removed).
- Tap Custom → drug-slider modal, now also has **gameplay sub-difficulty picker** (Easy/Normal/Hard) — Custom inherits the chosen sub's damage / cops / traffic multipliers while keeping noScore + 40-min clock.

### Warp + gas mechanic
- **Forward warps drain gas** equal to the trip distance. `init({ warpForward: true })` flag + new logic in the `resumeFromStop` branch deducts `rs.mileage` from the tank. Map-modal Custom warp sets the flag when destination is ahead of current position.
- **Custom-mode warp** stays free of $ and trophies (sandbox).

### Per-difficulty respawn lane
- New `_postCrashLaneX()` helper. Picks recovery lane based on difficulty (Custom reads its sub):
  - Easy → **+0.75** (far-right, safest)
  - Normal → **+0.25** (your-direction inner)
  - Hard → **−0.25** (oncoming inner — into traffic)
- Wired into all four crash-reset paths: scenery, NPC head-on, cop head-on, checkpoint-warp-after-death.

### Damage tuning
- **Tunnel wall slams = 3 HP** (was 10) — `_triggerSceneryRespawn(proj, damage=10)` now takes a damage param.
- **Global 10-HP cap removed** — Hard mode scenery is back to 15 HP (10 × 1.5 damageMul).
- **Floating "-X" damage popup** — red 19-px text next to HP, shows for 1.5 s after each hit. Positions dynamically against the live HP text bounds.

### Camp-repair guard
- 65% repair item flagged `disabled: true` when current HP ≥ target. Shows **"N/A"** with friendly status message instead of taking $.

### Rest-stop UX
- BACK button moved to top-left corner so it stops covering SAVE CODE.
- Mileage rounded in signs — no more "Exit 9.5" / "Mile 9.5", now "EXIT 10" / "MILE 10".

### Sign placement
- Tunnel guard: signs landing inside tunnels now **walk BACKWARD** until they clear the mouth, so the player sees them on approach.
- Applied to mileage_signs, grade_signs, and the exit_sign_green findDrySeg helper.

### Party clock fixes
- **Reset on difficulty change** — tapping E/N/H/Custom re-seeds `_partyClockSec` from the new mode's `Difficulty.partyClockSec()` so the timer always matches the chosen run length.
- Stored `_partyClockSecMax` alongside `_partyClockSec` for the phone-menu clock UI.

### Rear-view mirror
- Draw distance extended **9k → 36k units** so cars shrink to the vanishing point before disappearing.
- Traffic-array despawn extended `-2000 → -35000` so cars don't get culled before the mirror sees them.

### HUD layout
- **Default handedness flipped to LEFT** — weapons / HP / gas / speed column on the left, drug bars on the right (most players are right-handed; right thumb on the wheel side of the phone).
- Shift+L toggles. Persisted in `settings.handedness`.
- HP / Mi text moved inboard to clear the weapon column. Gas icon moved to the CENTER side of the gas text (dynamic positioning per frame).
- Music genre font 17 → 22 px.
- Weapon icon cells +15% size, stack pushed down 10 px.
- Score + party clock follow drug bars in handedness flip (top-right in left-handed mode).

### Map-modal close bug
- Closing the title-screen map modal (or trophy / garage) was firing the scene-level "any tap" handler and starting a race. Fixed with `_*ModalJustClosed` flags + a 50ms grace window in the cursor-fire handler.

### Vehicle gameplay
- **Drug bar OD only triggers at > 100%** (strict greater-than, 100% is safe).
- **Damage event payload** flows through `_applyDamage` with a generous "no-double-pause" gate.

---

## What's new since you went to bed

### Phase 4 — Achievements (essentially complete)
- **AchievementSystem** module ([src/systems/AchievementSystem.js](src/systems/AchievementSystem.js)) — registry, persistent earned-set on SaveSystem, Bronze/Silver/Gold tiers (Easy/Normal/Hard).
- **In-game toast** is now compact — tier label + name only. The full description text lives on the Achievements page (per your direction).
- **Achievements page** — new 🏆 button top-right of the title screen opens a modal grid showing every achievement with its highest tier earned (greyed-out if locked) plus the description text.
- **10 per-drug "first-hit" achievements** with mechanic descriptions — fire on first pickup of each drug.
- **Run-state achievements live**:
  - Untouchable 1m / 2m / 3m / 5m (timer resets on damage)
  - 5★ Survivor (peak then escape to 0)
  - Permastoned (10-mile weed lock-in)
  - Full Tank (any drug bar ≥ 99% without OD)
  - Stone Cold Sober / Crystal Clean / Iron Bladder / Untouchable / Trifecta (all fire on Pullman finish)
  - Connoisseur (every named combo this run)
  - Snowblind (cleared mile 40-88 snow zone with **zero HP lost** — strict per your spec)
  - On Time (Pullman finish before clock runs out)

### Phase 7 — Story finale + party clock (complete)
- **Party clock HUD** — top-center under the radio name, format `⏱ MM:SS`. Starts at:
  - Easy: 50 min
  - Normal: 40 min
  - Hard: 30 min
  - Custom: 40 min (no bonus on time)
  - Color shifts: white > 10 min, yellow 5–10 min, red < 5 min, "TOO LATE" tag at 0
- **Pullman finish branches**:
  - **ON TIME** (clock > 0): cash bonus 2× Hard / 1.5× Normal / 1× Easy; "🎉 YOU MADE IT!" popup; On-Time achievement
  - **TOO LATE** (clock = 0, < 5★): no bonus; "😞 TOO LATE" popup; normal game-over
  - **TOO LATE + 5★** (technical loss): cash penalty + 50% of post-checkpoint score; opens the **drug-slider restart modal**
- **30 NPC vignettes** wired into [RestStopScene.js](src/scenes/RestStopScene.js). Three lines per stop, randomly picked when the player enters. Lines I wrote (placeholder voice — feel free to replace):
  - Bellevue, Issaquah, North Bend, Cle Elum, Ellensburg, Vantage, Royal City, Othello, Washtucna, La Crosse all have 3 lines each. Scan for `VIGNETTES = {` to edit.

### Custom Mode (new — replaces NG+ from the original plan)
- **All three difficulty buttons unlocked from the start** (was already true).
- **CUSTOM MODE button** — new chip just above the difficulty row on title.
- Tapping CUSTOM opens the **drug-slider modal**:
  - 10 horizontal sliders (one per drug), click+drag 0–100%
  - START launches the run with those starting bar levels
  - **No score awarded** for the entire custom run (Difficulty.noScore() flag flows through `_scoreMult()` returning 0)
  - All drugs auto-unlocked if you set them above 0 so the bars render
- **TOO LATE + 5★ technical-loss restart** uses the **same slider modal**, but in restart mode it adds a checkpoint-picker row (Seattle start / each rest stop). Pick checkpoint + drug levels → run restarts there.
- Slider UI is one reusable function `_buildDrugSliderModal({ mode, onConfirm })` — `mode: 'custom'` or `mode: 'restart'`.

### Visual / world fixes
- **LSD rainbow** moved from `overlayGfx` (top of stack) into `Road.js` immediately after the sky bands — sits **behind** road, scenery, NPCs, drug overlays. Per your request.
- **Achievement toast trimmed** — name + tier only, no description text. ~40% smaller chip.

### Difficulty system extensions
- New fields: `partyClockSec`, `onTimeBonusMul`, `noScore`. Custom mode shipped with `noScore: true` and `onTimeBonusMul: 1.0`.

---

## Code audit — safe fixes applied

Two parallel agents scanned the codebase. I applied these:

| File | Fix |
|---|---|
| [DrugSystem.js](src/systems/DrugSystem.js) | Removed dead fields `shrooomsMax` (typo'd 3 'o's), `heroinMax`, `lsdMax` — never read |
| [DrugSystem.js](src/systems/DrugSystem.js) | Initialized `_comboActivatedAt = {}` in constructor instead of lazy-init in `getActiveCombos()` |

Other audit "safe fixes" turned out to NOT be bugs after verification:
- `_f12Texts` IS used (lines 4440+) — agent missed it
- `_passedRestStops` lazy-init at line 1379 covers all use cases — no actual crash path

---

## RISKY ISSUES — review these in the morning

These are real but need your judgment before fixing.  **None of them are crashing the game right now**.

### 1. CopFleet.js:46 — Pit cooldown design choice
```js
entry.pitCooldown = Math.max(entry.pitCooldown, PIT_COOLDOWN);
```
While a cop is in 'recovering' state (1.5s), the pitCooldown is held at full `PIT_COOLDOWN` every frame, then ticks down only after recovery exits.

Audit suggested:
```js
if (entry.pitCooldown <= 0) entry.pitCooldown = PIT_COOLDOWN;
```

**Tradeoff:** Current = total cool-off ≈ PIT_COOLDOWN + recovery; suggested = total = PIT_COOLDOWN. The current behavior is likely intentional ("after a successful pit, full cooldown counts from the end of recovery"). Suggestion would shorten total cool-off by ~1.5s per pit. Tune-time decision.

### 2. GameScene.js:3984 — Title-letter tweens on `repeat: -1`
The D-U-I letter sway/bob/fade tweens run forever and aren't explicitly killed when the title overlay is destroyed (line 849 in `_updateIntro`). Phaser destroys the Graphics object but the tweens may still try to animate destroyed targets.

In practice, scene restarts have been stable, so this hasn't crashed. But it's a leak — every scene start adds 9 tweens (3 per letter) that never end.

**Fix would be:** add `tween.stop()` calls on the title letters when fading out. Need to track them in `_titleLetterTweens[]`.

### 3. GameScene.js:65 — `_f12Texts = null` reset is necessary
Despite the audit's claim, this IS used. The reset at scene-restart time is correct — Phaser reuses the scene instance, and the previous run's references would point to destroyed Text objects. **Leave alone.**

### 4. DrugSystem.js:81–88 — `hydrateProgress()` order dependency
`_methPhase1` is read at line 245 (`if (this._methPhase1)`), but only set if `hydrateProgress()` was called. If the method was never called (e.g. fresh save with no stored progress), `_methPhase1` stays undefined. `!!undefined = false`, so it works, but the code is fragile.

**Fix would be:** initialize `this._methPhase1 = false` in constructor. Cheap and safe — just need to verify it doesn't break the meth-unlock state machine.

### 5. RouteData.js:504–550 — Modulo loop bounds
```js
for (let i = tunnelStart; i !== tunnelEnd; i = (i + 1) % count) { ... }
```
If `tunnelStart === tunnelEnd` (data error / segment-boundary collision), the loop is infinite. Currently safe because real tunnels don't have zero-length, but if route data ever changes and produces matching start/end, the build hangs.

**Fix would be:** add `if (tunnelStart === tunnelEnd) continue;` guard. Cheap.

### 6. EffectsSystem.js — defensive optional-chaining
Pattern: `this.audio?.setPaused?.()`. The audio system is always set up (BootScene → registry), so these `?.` chains are unnecessary CPU. Fix is widespread (touches dozens of lines). Style/perf, not a bug.

### 7. Console.log statements
Two console.logs in [GameScene.js:111 and :114](src/scenes/GameScene.js) (init logs) and one in weapon-fire flow. Audit flagged these as production noise. Removing them is safe but they're useful for debugging — **let me know if you want them gone**.

### 8. GameScene.js:2152 — Slider `pointerup` listeners
The drug-slider modal attaches a `pointerup` listener per row. The cleanup at modal-close runs `this.input.off(...)` for each. **But** if the modal is open during a scene restart, the listeners leak. Edge case (you'd have to scene-restart with a modal open), but noted.

---

## Files changed this session

**New:**
- `src/systems/AchievementSystem.js`

**Modified:**
- [src/scenes/GameScene.js](src/scenes/GameScene.js) — bulk of additions: party clock, achievement system wiring, custom mode + slider modal, achievements page modal, technical-loss restart flow, Snowblind tracker
- [src/scenes/RestStopScene.js](src/scenes/RestStopScene.js) — 30 NPC vignettes
- [src/systems/Difficulty.js](src/systems/Difficulty.js) — partyClockSec, onTimeBonusMul, noScore, custom mode descriptor
- [src/systems/DrugSystem.js](src/systems/DrugSystem.js) — dead-field cleanup + combo-tracker init
- [src/systems/EffectsSystem.js](src/systems/EffectsSystem.js) — rainbow removed (moved to Road)
- [src/road/Road.js](src/road/Road.js) — rainbow draws after sky / before road

---

## What's NOT done

- **Phase 5 — DJ chatter (skipped per your direction)** — no MP3s yet, no point shipping the wiring
- **Phase 6 — Daily challenges + leaderboard (deferred)** — could ship local-only versions next session
- **Phase 6 — Ghost replay** — needs the position-recording infra; deferred
- **Mission system (Phase 2)** — never picked up; "Job Done" achievement is wired but won't fire until missions ship
- **Connoisseur achievement** — fires once you trigger every named combo. With 14 combos, this is brutal. Probably needs balancing.
- **No-score-in-custom edge cases** — `_scoreMult()` returns 0 in custom, but a couple of additive sites bypass `_scoreMult` (line 1327 Pullman bonus, line 2732 hitchhiker tip). With score = 0 they round to 0 anyway, but worth a sweep next session.

---

## Suggested next-session priority (ranked)

### Tier 1 — high impact, low risk (30 min each)
1. **Sweep custom-mode score leaks** — wrap the two non-multiplied add sites in a `Difficulty.noScore()` guard.
2. **Fix `_methPhase1` init** — one-line constructor add. Eliminates a hydration fragility.
3. **Add tunnelStart===tunnelEnd guard** in RouteData.
4. **Stop title-letter tweens** on intro skip.

### Tier 2 — gameplay polish
5. **Daily challenge system (local-only)** — ship the `ChallengeSystem.js` + UTC-day-rolled constraint + a tile on title screen. Finish-line checks the constraint and awards a bonus. Half-day's work.
6. **Local leaderboard** — top-10 per mode, saved to localStorage. Two hours of work, easy parallel to challenges.
7. **Connoisseur balance** — current spec needs every named combo. Maybe split into "Connoisseur" (5 combos) and "Mixologist" (every combo).

### Tier 3 — bigger features (multi-session)
8. **Mission system (Phase 2 of original plan)** — drug-delivery / hitchhiker / cop-evasion / combo-race / run-cars-off-road missions. Lots of UI + NPC behavior work.
9. **Ghost replay** — record best run's positions, replay translucent ghost car alongside.
10. **DJ chatter pipeline** — once you record voice clips, the trigger wiring is straightforward (~1 hour).

### Tier 4 — out of scope (still)
- Photo mode, in-game settings menu beyond pause, accessibility toggles, online leaderboard.

---

## Quick test plan for the morning

1. **Reload page** → title shows D U I + plot blurb + 4-button row + 🏆 + CUSTOM MODE chip
2. **Tap 🏆** → see achievements grid with greyed-out entries
3. **Tap CUSTOM MODE** → drag some sliders → START → check the bars come up filled
4. **Tap CUSTOM MODE → set heroin to 50% → START** → verify no score accumulates over miles
5. **Pick Hard, drive carefully** → drive ~30 min real-time → reach Pullman before clock → verify 2× cash bonus + "YOU MADE IT" popup + On Time achievement
6. **Pick Normal → drive recklessly → hit 5★ → run out of clock → arrive Pullman with 5★** → technical-loss popup → cash penalty → slider modal opens with checkpoint picker
7. **Drug-tour run** — pick up beer, weed, coke in sequence → see three first-hit achievement toasts (one per drug, with description in the page later)
8. **Hold weed at 100% for 10 mi** → Permastoned popup + achievement toast
9. **Cross mile 38–88 in Normal** without taking damage → Snowblind achievement at exit
10. **Code resume**: enter a code like `EN000` (Ellensburg, Normal) → resume clock starts at 40 min still

---

Have a good night. If anything blew up, open dev console, paste the error here in the morning, and I'll triage first thing.


---

# Chapter 7 — Legacy Engine & Systems Reference (DUI-era, partly superseded)

> Snapshot of the DUI project overview at fork time. Kept for shared-engine reference (road / cops / weather / route / vehicles). Anything about drugs, DUI stops, or save codes is SUPERSEDED — see Chapters 1, 3, and 4.

# DUI — Project Overview

A single-doc orientation for anyone (human or AI) joining the project mid-flight. Combines the long-running memory notes, the active overhaul plan, and the most recent build sessions.

---

## ⚠️ PRE-RELEASE CLEANUP — strip dev/test aids before the final deploy (2026-07-21)

> **UPDATE 2026-07-23 (RTR):** these are now **gated behind `?dev=1`** rather than deleted — on a plain
> URL every item below is inert, so a beta build is already safe to hand to testers while the owner keeps
> the tools via the flag. `GameScene._devEnabled` (parsed from the URL) guards DEV WARP, back/forward warp
> (B/N), F3 debug overlay, F4 camera toggle and K cockpit-calibration; `window.__DEV` guards
> `__daily.all()` (the Calendar's dev section already hides on an empty list). The `V` first/third-person
> toggle is a real player feature and is intentionally NOT gated. TEST SPEED TRAP is not present in RTR.
> For a FINAL release build, deleting them outright is still the belt-and-braces move.

The release deploy is scheduled for **July 21, 2026**. These dev/testing conveniences MUST be removed before cutting that build:

- **Daily-Challenge "Test any run" dev list** — `window.__daily.all()` in [main.js](src/main.js) + the "▶ Test any run (dev)" section in the Calendar handler in [index.html](index.html). (Search: `Test any run`, `__daily.all`.) Removing it restores **Mon–Fri-only** daily access.
- **DEV WARP** — the digit 1–9 mile-warp cheat in [GameScene.js](src/scenes/GameScene.js). (Search: `DEV WARP`.)
- **TEST SPEED TRAP** — the planted test speed-trap near mile ~2.3. (Search: `TEST SPEED TRAP`.)
- **Other dev hotkeys** — camera-mode / cockpit-calibration toggles and any other debug key handlers. (Search: `Cockpit calib`, `Camera:`.)

Do a sweep for these — plus any new dev-only affordance added during a build — right before the release build.

---

## 1. What is DUI?

**DUI** is a Phaser-3 pseudo-3D arcade racing game in the spirit of Outrun / Rad Racer. The player drives Seattle → Pullman (~293 mi, I-90 → WA-26 → US-195 → WA-270) collecting drugs, picking up weapons, evading cops, and managing damage on a real-route topology with named exits, rest stops, and weather zones. Tone is mature dark-comedy ("like GTA 1 was shocking").

**Goal:** ship a paid arcade game on iOS (Capacitor wrap, TestFlight). Revenue funds a v2 with hired art/dev.

---

## 2. Tech stack & how to run

- **Phaser 3.60** (pseudo-3D rendered via Graphics.fillPoints trapezoids, far→near per frame)
- **Vite 5** dev server (port 3000)
- **Capacitor 5** for iOS shipping (`npm run cap:sync && npm run cap:open`)
- Assets in `public/assets/` (cars, drugs, weapons, buildings, trees, music MP3s, UI PNGs)
- Procedural music — 10-station radio via Web Audio API + real-track MP3s in `public/assets/music/`

**Run:**
```
cd DUI/
npm install
npm run dev        # https://localhost:3000 + HTTPS LAN IP for phone tilt testing
npm run build      # → dist/ for deploys
```

**Tilt steering trap:** phone/browser motion APIs require a secure context on real devices. Use the HTTPS Vite URL, including on LAN (`https://<LAN-IP>:3000`). Chrome/Safari may expose the permission gate on either `DeviceOrientationEvent.requestPermission` **or** `DeviceMotionEvent.requestPermission`; support both.

**Recurring trap:** Vite HMR sometimes serves stale module exports after edits. Fix: `pkill -9 -f "node.*vite" && rm -rf node_modules/.vite && npm run dev`.

---

## 3. Game mechanics — at a glance

### Route
- **`TOTAL_ROUTE_MILES = 293`**, `ROUTE_SEGS = 470000` (≈ 1604 segs/mile)
- 17 named rest stops from Seattle (mile 5) to Pullman (mile 289) — see `_REST_STOP_DEF` in [src/constants.js](src/constants.js)
- Real-world I-90 corridor: Mt Baker Tunnel (mi 6–7) + Mercer Island Lid Tunnel (mi 8.5–9) + Lake Washington floating bridges + Snoqualmie Pass + Cascades + Palouse
- Weather zones: rain mi 30–40, snow past mi 40 (Normal+ only)

### Driving
- **Cruise:** auto-accel at 120 mph; UP boost to 140; DOWN brake to 60.
- **Phone controls:** click-toggle ACCEL/BRAKE pedals (not press-and-hold). Steering via Tap (Flappy-style, default), L/R buttons, or Tilt (Capacitor accelerometer).
- **Bounce/crash on collision** — both player and NPC/cop can wreck each other.
- **HP system:** 100-max DamageModel. Damage values per source:
  - Tunnel wall slam: **3 HP**
  - Tree / building / parked car: **10 HP** (× difficulty mult — Hard = 15)
  - Head-on NPC: 3–7.65 HP (impact-severity scaled)
  - Side-swipe / corner clip: 1–2 HP
  - Cop head-on / PIT / ram: similar scale, × damageMul
  - Off-road bleed: 0.5 HP/sec
- **Crash recovery lane** depends on difficulty (Custom inherits sub-difficulty):
  - Easy → far-right (+0.75)
  - Normal → your-direction inner lane (+0.25)
  - Hard → oncoming inner lane (−0.25)

### Drugs (10)
Alcohol, Weed, Cocaine, Shrooms, LSD, Heroin, Rx, Fentanyl, Ketamine, Meth.

**Unlock chain** (persists across arrest/death via `drugUnlocks` registry):
- Alcohol + Weed: start unlocked
- Cocaine: 30s drunk
- Shrooms: both alcohol + weed ever ingested
- LSD: shrooms ever ≥ 0.50
- Heroin: 20% route progress
- Rx: 50 NPC car crashes (lifetime)
- Fentanyl: heroin ever ≥ 0.50
- Ketamine: LSD ever ≥ 0.40
- Meth: cocaine peaked ≥ 0.40 then dropped to 0 for 30s

**OD:** triggers strictly above 100% (100% itself is safe).

**Combos (Snow-Cone, A-Bomb, Cross-Faded, …):** purely cosmetic labels, no multiplier bonus.

**Score multiplier:** purely additive. Base 1.0 + 0.5 per drug ≥5% / ≤50% + 1.0 per drug >50% + 1.0 per cop star. Snapped to 0.5.

### Cops (CopSystem)
- Kinds: rear pursuit, oncoming, parked roadside, barricade, helicopter (5★), SWAT van (4★+, 2× damage)
- **No per-second heat trickle** — star changes are all static event additions:
  - 1st star = (alcohol ≥ ⅓ OR weed ≥ ½) AND ≥3 NPC crashes since first drink, OR 20 NPC bumps with any drug ≥30%
  - Rear-end cop: +0.2 · Head-on: +0.5 · Sideswipe oncoming: +0.2 · Roadblock: +0.33 · Drug pickup during probation: +1.0
- BUSTED: 1 PIT · 5 rear bumps · 3 head-ons
- Town crossings reduce stars graduated (5★→0, 4★→1, others →2), filter SWAT only when stars drop below 3.5
- Any reset of the game clears stars to 0
- OD warps to last checkpoint with 0 stars + drug bars 0 (no game over)

### Difficulty (single source of truth: [src/systems/Difficulty.js](src/systems/Difficulty.js))
| Mode | damageMul | copMul | trafficMul | partyClock | dayNight | weather | onTimeBonus | noScore |
|---|---|---|---|---|---|---|---|---|
| Easy | 0.7 | 0.7 | 1.0 | 50 min | ✓ | — | 1.0 | — |
| Normal | 1.0 | 1.0 | 1.0 | 40 min | ✓ | ✓ | 1.5 | — |
| Hard | 1.5 | 1.5 | 1.10 | 30 min | ✓ | ✓ | 2.0 | — |
| Custom | inherits sub | inherits sub | inherits sub | 40 min | ✓ | ✓ | 1.0 | ✓ |

Custom mode inherits gameplay multipliers from a chosen sub-difficulty (Easy/Normal/Hard) but stays no-score and at 40-min clock.

### Vehicles
8 player-buyable cars with PNG art + per-vehicle stats:
| ID | Label | HP | Range | Top mph | Fuel | Sprite |
|---|---|---|---|---|---|---|
| beater | Used Sedan | 50 | 150 mi | 110 | gas | car_back_white |
| suv4x4 | Used 4x4 SUV | 70 | 300 | 115 | gas | car_back_blue |
| usedTruck | Used Truck | 90 | 350 | 117 | gas | car_back_truck_blue |
| newTruck | New Truck | 100 | 100 | 120 | gas | (tint only) |
| evTruck | Electric Truck | 85 | 120 | 118 | electric | car_back_orange |
| sportsCar | Sports Car | 75 | 500 | 165 | gas | (tint only) |
| bestlaRoadster | Electric Roadster | 85 | 250 | 200 | electric | car_back_green |
| playdoutS3X | Bestla Play'dOut | 125 | 250 | 190 | electric | car_back_blue2 |

Per-vehicle accessories (bumper / NOS L1-3 / traction) persist per (steering, difficulty, vehicle) slot.

### Save architecture
Per-mode save profiles: 3 steering modes × 4 difficulties = 12 wallets. Each wallet contains 8 vehicle states (HP, accessories, weapons, checkpoint tiers earned). Achievements + settings + checkpoint tiers are **global** (cross-mode).

### Weapons (F12 items)
Gun · Spike strip · Paint bomb · Rocket (fwd/rear) · Grenade · Disguise. Road collectibles + rest-stop purchases. Tap-to-fire per icon, Q cycles, count badge per cell. Spawned mid-route at 4★+.

---

## 4. The phone-as-menu (portrait UX)

Rotating the iPhone to portrait pauses the game and reveals an iOS-mockup home screen (HTML/CSS overlay over the Phaser canvas).

### Layout
- **Weather widget** (North Bend, decorative)
- **2×2 of empty white tiles** with overlays:
  - Trophy 🏆 (upper-left — opens trophy page, placeholder)
  - Lock-pause 🔓 ↔ 🔒 (upper-right — locks rotation-resume)
  - Other two: open for future apps
- **Calendar widget** with in-world clock overlay (2 PM → 8 PM, driven by `_partyClockSec`)
- **Garage tile** (large, opens vehicle picker w/ accessories badges)
- **2×2 of app icons:** Maps · Tilt Steer · L/R Steer · Tap Steer
- **Dock:** Music · Start Over · Checkpoint · Menu

### Behaviors
- Rotate to portrait: **pauses** game.
- Rotate back to landscape: game **stays paused, waits for first tap anywhere** to resume (unless locked).
- Lock 🔒: blocks auto-resume on rotation; player must unlock + rotate or tap in-game pause button.
- Black stroke wraps the **selected** steering app (Tap/Tilt/L/R) so player sees which scheme is active.
- Tap a steering app → switches mode + restarts scene with the new save profile.
- Maps app → vertical SVG route map with live player-position dot.
- Garage tile → modal w/ owned vehicles + thumbnails + accessory badges (🛡 / ⚡ NOS Lx / ❄️).
- Music app → Spotify-style genre grid → song list. Shuffle all / shuffle genre.
- Checkpoint dock → warps to `_lastCheckpoint` (mid-run) or `save.lastRestStop` (between runs).

### Hit-zone auto-positioning
- Hit zones use `data-px="x y w h"` in **PNG-pixel coordinates** (not viewport %)
- JS reads `bgImg.naturalWidth/Height`, applies `object-fit:cover` math, positions each zone in viewport-pixel coords. Auto-tracks on every device.
- `?debug` URL param: red dashed boxes + labels on every hit zone.
- `?calibrate` URL param: tap an icon, chip shows that point's PNG-pixel coord. Use to find exact icon positions.

---

## 5. File map

### Core scenes
- [src/scenes/BootScene.js](src/scenes/BootScene.js) — preload + procedural-texture fallbacks + scene routing
- [src/scenes/GameScene.js](src/scenes/GameScene.js) — main loop, collisions, HUD, title overlay, pause menu (~7,500 lines, the monolith)
- [src/scenes/RestStopScene.js](src/scenes/RestStopScene.js) — 4-tab shop (Drugs / Garage / Company / Road), 4-digit save codes, vehicle dealership, accessory shop
- [src/scenes/GameOverScene.js](src/scenes/GameOverScene.js) — crash / OD / TOO LATE end-states

### Road & route
- [src/road/Road.js](src/road/Road.js) — pseudo-3D renderer + ramp painting + bridge guardrails + tunnel cover + weather particles + LSD rainbow layer
- [src/road/RouteData.js](src/road/RouteData.js) — segment generation, elevation, sign placement, random cop placements
- `src/road/routeGeo.json` — real lat/lon waypoints

### Systems
- [src/systems/DrugSystem.js](src/systems/DrugSystem.js) — 10 drugs + unlock chain + combos
- [src/systems/EffectsSystem.js](src/systems/EffectsSystem.js) — per-drug visual/physics effects
- [src/systems/CopSystem.js](src/systems/CopSystem.js) — rear/oncoming/parked/barricade/heli/SWAT cops, star economy
- [src/systems/AudioSystem.js](src/systems/AudioSystem.js) — 10-station radio (procedural + MP3)
- [src/systems/HapticSystem.js](src/systems/HapticSystem.js) — iOS haptics wrapper
- [src/systems/Difficulty.js](src/systems/Difficulty.js) — E/N/H/Custom multipliers + Custom sub-difficulty
- [src/systems/AchievementSystem.js](src/systems/AchievementSystem.js) — registry + Bronze/Silver/Gold tiers
- [src/systems/SaveSystem.js](src/systems/SaveSystem.js) — per-mode profiles + global achievements/settings
- [src/world/TimeOfDay.js](src/world/TimeOfDay.js) — mileage-based day/night cycle
- [src/world/Weather.js](src/world/Weather.js) — region-based rain/snow

### Constants & data
- [src/constants.js](src/constants.js) — `DRUG_CONFIG`, `DRUG_COMBOS`, `REST_STOPS`, `CHECKPOINTS`, `VEHICLES`, all magic numbers
- [src/car/DamageModel.js](src/car/DamageModel.js) — HP cap + damage events
- [src/economy/Wallet.js](src/economy/Wallet.js) — $ source of truth (integer-cent precision)

### UI / phone-menu
- [index.html](index.html) — phone-as-menu HTML/CSS overlay + modals (Maps / Garage / Music)
- [src/main.js](src/main.js) — Phaser game bootstrap + orientation watcher + window globals for phone-menu (`__phoneLock`, `__steeringMode`, `__garage`, `__music`, `__checkpoint`)

### Dead / vestigial (kept for reference, NOT live):
- `src/scenes/MenuScene.js` — BootScene starts 'Game' directly now
- `src/scenes/HubScene.js`, `src/missions/MissionManager.js`, `src/world/District.js`, `src/world/RoadGraph.js` — hub-mode infra never reached
- `src/economy/Garage.js`, `BodyShop.js`, `UpgradeShop.js`, `Dealer.js` — hub-mode shops (Wallet IS used)
- `this.hookers` (HookerSystem) — instantiated but never updated/rendered

---

## 6. Active overhaul plan (locked design decisions)

Plan file: `/Users/brendanbaughn/.claude/plans/lets-do-a-major-parallel-widget.md`. Phases 0-7. Summary:

### Phase 0 — Score → Cash (DONE)
Replace `PTS_*` abstract points with `$` dollars. HUD reads `$X,XXX`.

### Phase 1 — Story framing + Difficulty (DONE)
- Plot blurb on title: *"You drove to Seattle to score for a party in Pullman. The party starts soon. Don't get arrested. Don't OD. Don't be late."*
- Difficulty: Easy / Normal / Hard / Custom (tap-to-launch on title)

### Phase 2 — Missions (NOT STARTED)
Drug-delivery / hitchhiker / cop-evasion / combo-race / run-cars-off-road markers. Auto-accept on pickup, HUD chip tracks progress.

### Phase 3 — Day/night + weather (PARTIAL)
- Day/night cycle by mileage (mile 0 morning → mile 180 night)
- Rain mile 30–40, snow past 40 (Normal+)
- "CHAINS REQUIRED" warning signs (DONE)

### Phase 4 — Achievements (DONE)
- AchievementSystem with Bronze/Silver/Gold tiers based on difficulty earned
- 10 per-drug first-hit achievements
- Run-state: Stone Cold Sober, Crystal Clean, Iron Bladder, Untouchable (1m/2m/3m/5m), 5★ Survivor, Permastoned, Snowblind, Connoisseur, Trifecta, On Time, Full Tank, Job Done

### Phase 5 — DJ chatter (DEFERRED — no MP3s yet)
Pre-rendered per-station persona clips on song-end events.

### Phase 6 — Replayability meta-layer (DEFERRED)
Daily challenges (UTC-rolled), local leaderboard, ghost replay, NG+.

### Phase 7 — Story finale + party clock (DONE)
- Party clock 50/40/30 min by difficulty
- Pullman finish: ON TIME (cash bonus 1×/1.5×/2×) / TOO LATE (no bonus) / TOO LATE+5★ (cinematic arrest + drug-slider restart modal)
- 30 NPC vignettes wired into rest stops (3 per stop)

### Warp system (DONE — per design discussion)
| Action | Timer | $ Cost | Trophies |
|---|---|---|---|
| Start Over (Mile 0) | Resets to 0:00 | Free | All normal trophies |
| Backward Warp | Continues ticking | ½ $ | All normal trophies |
| Forward Warp | Jumps to `(mile/293) × 40min` | Free | **Cheater Complete only** 🕶️ |
| Custom mode | No clock | Free, $100k starter | None possible |

Forward warps **drain gas** equal to trip distance. Hard mode disallows warping entirely.

---

## 7. Pending build-outs (in priority-ish order)

### Tier 0 — Pre-ship blockers
- **DELETE THE DEV WARP** — digit-keys 1-9 mile-warp cheat in [src/scenes/GameScene.js](src/scenes/GameScene.js), bracketed by `// ── DEV WARP — REMOVE BEFORE RELEASE ──`. **Must be deleted before shipping.**
- **DELETE THE TEST SPEED TRAP** — a guaranteed parked speed trap at ~mile 2.3 in [src/road/RouteData.js](src/road/RouteData.js), bracketed by `// ── TEST TRAP — REMOVE BEFORE RELEASE ──`. Added so the 0★ pull-over flow is testable seconds into a run; **delete before shipping** (the real traps are the 5–7 randomized city ones).

### Tier 1 — Active features the user has flagged
- **Murrow skyline sinks into Lake Washington (proper fix, diagnosed)** — on the Murrow floating bridge onto Mercer Island the distant skyline silhouette (which exists to COVER a charcoal "junk" backdrop band) gets overpainted by the per-segment lake-water fills drawn AFTER it in the same `roadGfx` layer, so it looks like it sinks into the lake. The `SKYLINE_SHORE_LIFT` band-aid was reverted (it exposed the junk). Proper fix is a DRAW-ORDER / layer change: render the silhouette ABOVE the per-segment water fills but BEHIND the cranes (e.g. its own depth between road and scenery sprites), keeping it LOW so it still covers the junk. Awaiting user go-ahead (delicate layering change).
- **Build the Hatton, WA rest stop — DONE 2026-06-05.** Full rest stop at mile 205 (id `H`, WA-26, amenities camp+gas), filling the route's biggest gap. The data wiring (`_REST_STOP_DEF`, `_CP_RAW`, map waypoint at [GameScene.js](src/scenes/GameScene.js) ~L8118, Maps app in [index.html](index.html), terrain/frontage in [RouteData.js](src/road/RouteData.js)) was already present; the only missing piece was the **baked amenities placard** — `sign_H.png` (the per-stop brand-logo preview sign). Baked via the new single-stop mode of [scripts/buildShoppingSigns.js](scripts/buildShoppingSigns.js) (`node scripts/buildShoppingSigns.js H`), registered in [AssetManifest.js](src/systems/AssetManifest.js), and `STOPS_WITHOUT_BAKED_SIGN` is now empty. See §8 2026-06-05.
- **Large trucks in Eastern Washington traffic** — user wants visibly larger truck NPCs (semis, hauler trailers) populating Vantage → Pullman stretches. The existing NPC vehicle pool uses `npc_car_*` textures sized via texture aspect; the same path could pull from a `truck_*` texture set with a wider lane footprint, slower base speed, and longer body. Requires new art OR reusing the existing player-vehicle truck PNGs at NPC scale.
- **Finish cinematic — park in front of Pullman Party House — DONE 2026-06-05.** Crossing the mile-289 finish now starts a ~3s park cinematic (`FINISH_PARK_SEC`) instead of cutting straight to Game Over: input locks, the car eases to a stop (`targetSpeed = 0`) while drifting left to `FINISH_PARK_X = -1.35` toward the house (the landmark spawns on the LEFT, `sign=-1` in [RouteData.js](src/road/RouteData.js) ~L1522), then `_endGame(_finishCause)` opens the panel. Applies to **both on-time and late** finishes; the TOO-LATE+5★ technical loss (`busted_late`) stays instant. State: `_finishCinematic`/`_finishCineT`/`_finishCause`/`_finishCineEnded`. See §8 2026-06-05.
- **NPC headlights/tail lights in the rear-view mirror** — the night-lighting pass painted lights on the main world view but the mirror reflection (rendered separately via `_mirrorCarPool` in GameScene.js) doesn't carry them. Needs the same dot/beam logic applied to the mirror render path so a car catching up from behind shows its headlights in the mirror glass and same-direction traffic ahead shows tail lights.
- **Sex Worker / prostitute interaction expansion** — currently a 1-in-10 "dirt on a politician" buff. Add more outcomes, recurring NPCs, and quest hooks; investigate spawning visible sidewalk NPCs near towns/rest stops so the mechanic exists in the driving world rather than only in menus.
- **Hitchhiker expansion** — basic random good/bad outcome works (70/30 split, drug-bar-to-90% added). Add more variety and story hooks; investigate roadside/sidewalk hitchhiker sprites the player can see and choose to approach or pick up.
- **Police 2.0 / five-star behavior correction — BUILT 2026-06-03** (see §8). 1–3★ from cops witnessing reckless driving (speed traps + double-yellow/oncoming), 4–5★ only from weapons on cops (escalate + 3–5 mi grace), no passive DUI heat, killing a cop never reduces heat. The 0★ speed-trap *ticket* layer below is the next extension.
- **Speed-trap traffic stops (0★ police layer) — ALL 3 STAGES BUILT (Stage 1 2026-06-03; Stages 2-3 2026-06-05).** Extends the built Police 2.0. Makes "clean" (0★) speeding near towns a real risk: you get pulled over, ticketed, and DUI-checked. **3-stage build plan:** (1) trap placement + trigger + pursuit + 30s comply timer — **DONE**; (2) scripted pull-over auto-stop + traffic-stop UI + 30s ticket pause — **DONE**; (3) ticket math + lawyer + bust/suspension rules + stats hooks — **DONE** (see §8 2026-06-05). The spec below (lines on placement/trigger/ticket/bust/lawyer/stats) is the as-shipped behavior.
  - **Stage 1 as built:** trap placement is now `Math.random`-seeded **per play** ([RouteData.js](src/road/RouteData.js), replaced the old every-15-30-mi cop loop) — 3–5 random cities + permanent Issaquah/Colfax = 5–7 parked traps; the old ambient `cop_random_driving` cops were dropped. `COP_TRAP_SPEED_MPH` 70→80 ([constants.js](src/constants.js); also new `COP_TRAP_COMPLY_SEC`/`PULLOVER_MPH`/`SHOULDER_X`). Trap-witness block in [GameScene.js](src/scenes/GameScene.js) `update`: at 0★ → spawn pursuer + open 30s window (no star yet); comply = speed < 25 mph AND `player.x > 1.2` (right shoulder) → `cops.endTrapPursuit()`; timer expires → `cops.promoteTrapPursuit()` + `addStar(1,3)`. At ≥1★ → trap cop just joins pursuit (no civil offer). New `_trapPursuitActive`/`_trapComplyTimer` state reset on init, `_wipeWantedState`, and dev-warp. CopSystem helpers: `_spawnTrapPursuit`/`endTrapPursuit`/`promoteTrapPursuit`. **Stage-1 stubs:** comply currently just shows "Pulled over (traffic stop coming next build)" — no auto-stop cinematic, no ticket, no bust math, no live HUD countdown (all Stage 2-3).
  - **Placement:** **5–7 traps per playthrough** — parked cops in random spots of cities. **Issaquah and Colfax are permanent**; the rest are randomized each play from the **full city pool** (no minimum spacing — RNG can cluster them, that's fine since both are avoidable by braking).
  - **Trigger:** pass within ~200 ft of a trap doing **>80 mph** → cop gives chase (150 mph, may drop roadblocks to slow you). Under 80 mph → safe pass. A buddy text warns ~60% of the time (existing). You *can* outrun it with a fast car / a beater on cocaine, but roadblocks make pulling over the safer play.
  - **Comply window (at 0★): 30 s** to slow + pull to the right shoulder.
    - **Auto-stop assist:** once *committed* (pursuit active + speed below ~25 mph + in the right-shoulder zone) the car eases to a full stop and holds (reuse the planned Pullman finish-cinematic pattern). **Dry, non-bridge/non-tunnel segments only**; never push the car through a shoulder barrier (hard rule).
    - **Pull over in time → traffic stop**, with a **separate 30 s pause** to receive the ticket.
    - **Ignore for 30 s → +1★** (enters the 1–3★ wanted system). NOTE: this replaces the old *immediate* "+1★ on speeding past a trap"; the trap speed threshold also moves **70 → 80 mph**.
  - **Party clock keeps ticking** through both the 30 s comply window and the 30 s ticket pause (~60 s of real time cost if you comply).
  - **The ticket** (msg: *"30-second pause to receive a ticket for speeding… I hope you're not intoxicated. Bigger penalties for that."*):
    - **Under the limit → $400** speeding ticket.
    - **Over the limit → $1,500 "DUI" + earnings ×0.75 for the next 50 mi.**
    - **Limit:** `alcohol < 20%` AND **each** other drug `< 50%`. Exception: if **4+ drugs are active at once**, **every drug *including alcohol* must be `< 10%`**. (Money = persisted score, so the fine subtracts from score.)
  - **Bust conditions:**
    - **Can't afford the fine → busted.**
    - **2 DUIs (the $1,500 intoxicated stops) within 50 mi → busted** ("two DUIs = suspended license"). **Only intoxicated stops count** — sober $400 speeding tickets do NOT.
    - **Already ≥1★ (a warrant):** the trap cop simply **joins the pursuit — NO civil stop is offered**; if the player pulls over anyway → **busted**.
  - **Lawyer on retainer ($15k):** **speeding tickets dropped ($0)**; **DUI tickets halved ($750)** and the suspension threshold rises to **3 DUIs within 50 mi**. (Existing: lawyer also halves arrest fines.) Can't-afford bust can still fire on the $750 DUI if score < $750.
  - **Stats:** track tickets (count + $ paid) and DUIs for the Stats / Leaderboard apps.

### Tier 2 — Plan phases not yet done
- **Phase 2 — Mission system** (Job Done achievement is wired but waiting on missions).
- **Phase 5 — DJ chatter** (record MP3s; wiring is straightforward).
- **Phase 6 — Daily challenge** (half-day's work). *(Local leaderboard portion DONE 2026-06-05 — see §8 House Leaderboard.)*

### Tier 3 — Bigger features
- Mission system full build-out
- Ghost replay (record best run positions, play translucent ghost)
- **World leaderboard — stand up a server (the remaining leaderboard work).** Local cross-player House Leaderboard shipped 2026-06-05 (§8); what's left is the **online/global** layer: a backend to receive and serve run records, remote score submission on trip-end, and the "World Records" board fed from it (currently a placeholder footnote in the LEADERBOARD app). The record shape (`{score, miles, timeSec, completed, ts}` + plate) is already remote-ready, so the client change is mostly a submit call + a fetch-and-render; the real work is **server setup** (host, store, anti-cheat/validation, rate limiting, privacy of plate handles).
- **Smashable roadside objects** — lightweight collidable cones, cardboard boxes, trash cans, and construction barrels that swap to a broken/knocked-over sprite plus impact sound when struck. Reuse the existing scenery collision and sprite pools rather than adding physics/debris simulation. Consider pedestrians only as a separately designed, non-graphic consequence mechanic if it fits the game's tone.

### Tier 4 — Out of scope (still)
Photo mode, in-game settings menu, accessibility toggles.

---

## 8. Major build-history (newest first)

### 2026-06-23→27 — Drug-effect fade, fill bumps, Easy law rework, Steroid + Narcan power-ups, pickup glow

All in this session. Dev hot-reload edits — **NOT yet `npm run build`/`cap sync`/deploy'd** (build passes; see PENDING note at bottom of §8).

**Drug effects fade with the live bar.** Per "if it leaves your system, so do the effects": the three permanent pickup-count gameplay effects in [DrugSystem.js](src/systems/DrugSystem.js) now scale by the current bar level — `getCocaineSpeedBonusMPH` (`bags×4×cokeBar`), `getMethSpeedBonusMPH` (`×methBar`), `getRxNpcSpeedShiftMPH` (`×rxBar`). Fixes the ">200 mph after the cocaine bar wore off" report (speed was never tied to the bar before, only lifetime pickups). Shroom/LSD pickup-count *visuals* left alone — already hard-gated to vanish <5% bar, so they don't linger.

**`PICKUP_AMOUNTS` bumps** (realism-researched ratios): meth 0.10→**0.25**, cocaine 0.10→**0.22**, rx 0.085→**0.18**, ketamine 0.10→**0.15** (others already realistic, untouched). Note: OD fires when overfilling a maxed bar, so bigger fills = fewer hits to OD (~6 lines for coke). User said leave OD until playtest; a per-drug "grace overfill hits" buffer was speced but NOT built.

**Guaranteed first line on unlock.** New `_firstLineQueue` + `_unlock()` helper in DrugSystem (all 8 unlock sites routed through it); GameScene drains it after `drugs.update()` and drops **1–2 sprites** of the freshly unlocked drug ahead (was going to be a full line, user wanted smaller). Fixes "unlocked cocaine but never saw it" (spawn is a random beer-biased pool, ~1-in-5; short runs starve it).

**Easy-mode law rework** ([Difficulty.js](src/systems/Difficulty.js) + [CopSystem.js](src/systems/CopSystem.js) + GameScene HUD): added per-mode `arrest` thresholds + `starGainMul`. Easy now = rear-ram bust **7** / head-on **5** / PIT **5** (was 5/3/3 global), **0.5× wanted-star gain**, and **a cop-ram bust respawns you at the last checkpoint/rest stop** (Seattle/start if none) keeping the cash dock, instead of game over (`_onArrested` Easy branch: clearArrest + damage.reset + re-baseline checkpoint). The repeat-DUI traffic-stop bust (`_bustBackToStart`, full restart to mile 0) was left unchanged on all difficulties — open question whether to unify it.

**Steroid power-up (Mario star) — BUILT.** Invincible for **1 mile of road** (distance-based off `_odometer`, so faster = more ground). Zero damage (`_applyDamage` early-return), **bulldozes traffic + cops** (knock-out + score, no slow/heat/tally — branch at top of `_onVehicleCollision`), wanted-star gain zeroed while active; **walls/water still block & sink** (immunity only waives HP). Rare standalone drop (~2.5–4.5 min via `_steroidSpawnTimer`), HUD readout above stars line + activation/expiry popups. Procedural placeholder sprite (`powerup_steroid`, gold syringe on red roundel in [BootScene.js](src/scenes/BootScene.js)) — drop `public/assets/powerups/steroid.webp` to replace. New `powerups` section in AssetManifest. NO sound cue (audio API is music-only) and NO full-screen tint — both flagged as optional follow-ups.

**Pickup glow + bob (readability).** Problem: pickups hard to tell from cars at distance. Fix is pickup-side only (cars untouched, preserves realism): repurposed the dead `_drugHaloGfx` layer (was created/cleared but never drawn) into a **pulsing gold/amber glow halo** behind EVERY collectible (3 concentric translucent circles), depth dropped 8.4→**6.9** to sit behind the z-banded pickups. Plus a **bob (±12% vert) + tilt (±~6°)** hover with per-sprite phase. NOTE: briefly tuned "less feathered, brighter" then **REVERTED at user request** (harder to see) — current shipping values are the originals: base radius 0.72, outer 1.30, alphas 0.10/0.16/0.22, pulse 0.30–0.90. Tunable one-liners in the pickup render loop in GameScene.

**Narcan power-up — BUILT.** Inventory item (max **3**) that auto-reverses an **opioid** OD (fentanyl/heroin/rx ONLY — realism + original spec; cocaine/meth OD still kills). Both OD paths (`drugs.checkOD()` frame check ~L3689 + pickup-OD ~L8898) route through new `_tryNarcan(drugId)`: if opioid + count>0 → consume one, `cameras.main.flash` red, "💉 NARCAN USED" popup, flush all opioid bars to 0, cancel OD. Rare standalone drop (~2.5–4.5 min via `_narcanSpawnTimer`/`_injectNarcan`), collected in `_onCollect` (`type==='narcan'` → `_narcanCount++`). HUD readout "💉 NARCAN ×N" above the steroid line (dedicated text, NOT integrated into the movable weapon-icon column). Procedural placeholder = blue vial + red cross (`powerup_narcan`, `_makeNarcanSprite` in BootScene); drop `public/assets/powerups/narcan.webp` to replace. New manifest entry. **Caveat: `_narcanCount` is run-level — NOT in the save snapshot, so it doesn't survive rest-stop save/resume.**

**Still on the table:** make Narcan save ANY OD (currently opioid-only — one-line change if wanted); persist Narcan count in the save snapshot; Narcan as a real weapon-column cell. Steroid sound/tint polish. OD grace-hit buffer. Unify traffic-stop bust with Easy respawn.

### 2026-06-21→23 — Finish-freeze fix, bigger trucks, beer buzz, iOS audio mixing

**Finish-cinematic terminal freeze** (ChatGPT-flagged, all 3 verified real). Added an early `update()` guard on `_gameFinished` ([GameScene.js](src/scenes/GameScene.js)) — once the Pullman finish is crossed (on-time/late park cinematic OR too-late+5★ technical loss), collisions/cops/OD/drains are all skipped; only the park animation runs. Added `_gameFinished`/`_restartModalOpen` to the `_autosaveRun` guard (no stale save post-finish). Merged the on-time + Crush finish popups into one so neither is clobbered. (Built + synced.)

**Bigger / more semis.** `visualScale` 1.35→1.45 (both the normal + paired-partner semi spawns) and semi spawn share +~15% in every mileage band (taken from `car`; E.WA semi ~22%→~25%). Comments updated. (Built + synced.)

**Beer "keep the buzz" fix.** After the 2026-06-20 decay rebalance, alcohol (decay 0.0154, ~65s bar) was too hard to maintain from sparse pickups (4-beer line every 80–100s, beer ~25–75% of lines). Per user pick = "bigger sips only": `PICKUP_AMOUNTS.alcohol` 0.07→**0.18** (decay unchanged) in [DrugSystem.js](src/systems/DrugSystem.js). A 4-beer line now spikes ~0.72 and holds a buzz ~1 min. (Dev hot-reload only — **NOT yet built/synced**.)

**iOS audio mixing** — fixes "can't listen to my podcast while playing." [AppDelegate.swift](ios/App/App/AppDelegate.swift) now sets `AVAudioSession` to `.playback` + `.mixWithOthers` at launch and re-asserts on `applicationDidBecomeActive` (WKWebView can reset it). Game audio now mixes instead of seizing the session; mute the game and the podcast plays alone. (Native — **needs an Xcode rebuild**, no new target files.)

**Backlog cleanup (§7):** removed Exit-32/North Bend feel, title-screen stoplight redesign, and the (stale) phone-menu nav-buttons-broken item per user.

**🚗 Deleted the orange fallback player car (2026-06-23).** User: "I'd rather have no car than that shitty orange car." That car was the procedural `player_car` texture (orange 0xFF4400) generated in [BootScene.js](src/scenes/BootScene.js), used as the LAST-resort fallback when the beater's real rear art (`codex_beater_back`, a detailed silver sedan) wasn't loaded at sprite-creation. Root cause of users seeing it = stale cached bundle (BootScene eagerly loads all art, so the real sedan is normally ready). Fix: (a) removed the `_makeCarTexture('player_car', …)` line; (b) [GameScene.js](src/scenes/GameScene.js) player sprite now mounts the real `spriteBack` or an INVISIBLE `__WHITE` 1×1 (never orange) with a `_playerArtPending` flag; (c) new `_ensurePlayerArtReady()` called each frame swaps the real texture in + reveals it the instant it loads ("just wait for it," per user). Gated on `_playerArtPending` (not visibility) so cockpit-view hiding isn't disturbed.

**🌐 DEPLOYED to Cloudflare (2026-06-23):** ran `npm run deploy` (wrangler did NOT hang this time) — live at **dui-8hb.pages.dev**. This pushed EVERYTHING accumulated: finish-freeze, bigger trucks, beer 0.18, no-orange-car, LOAD SAVE/save-resume/menu-contain/red-border, CloudSave dev-guard, AND the parallel-chat drug changes (all in source). Immutable build URL was `f852cf0c.dui-8hb.pages.dev` (use immutable URLs to bypass browser cache when verifying). **The live WEB is now current.**

**Note:** cocaine/rx/ketamine/meth `PICKUP_AMOUNTS` bumps + cocaine/meth speed-bonus now scaled by the live bar (so the boost wears off as the bar empties) were done in a PARALLEL chat 2026-06-23 — already in DrugSystem.js, in the deploy.

**⚠️ STILL PENDING — iOS app only:** the app is behind the web. Run `npx cap sync ios` + Xcode rebuild to get beer/trucks/finish-freeze/no-orange-car + AppDelegate audio mixing + alt-icons onto the iPad. The Worker hardening still needs its separate dashboard paste. (Web is deployed + current.)

### 2026-06-20 (PM) — iOS device run, alt app icons, menu contain-fit, drug rebalance

**Ran on a real iPad** (after simulator). Device-build gauntlet (all fixed, all persist):
- **`CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = NO`** added to the Podfile `post_install` — Cordova's double-quoted framework-header includes are errors on device builds (not simulator). Re-ran `pod install`.
- **`ENABLE_USER_SCRIPT_SANDBOXING = NO`** on the App target (Build Settings) — Xcode 15+ default sandboxes run-script phases → `[CP] Embed Pods Frameworks` fails "Operation not permitted." This was THE fix for the PhaseScriptExecution error. (The project also lives under `~/Documents` which is TCC-protected, a secondary "Operation not permitted" source — Full Disk Access for Xcode is a fallback, but the sandboxing toggle was the real cause.)
- On-device: needs **Developer Mode** (Settings → Privacy & Security, appears after first Xcode run), **pairing** (Window → Devices), and **Trust** (Settings → General → VPN & Device Management). iPhone is MDM-locked (blocked); iPad worked.

**Custom app icon + in-game alternate-icon switcher.** The asset-catalog primary icon now uses `icon-512` (upscaled 1024) so the home screen shows the real icon, not Capacitor's placeholder. Added a **native Capacitor plugin** `ios/App/App/AppIconPlugin.swift` + `.m` (`@objc(AppIconPlugin)`, methods setIcon/current/supported via `UIApplication.setAlternateIconName`). Alt icon files `AppIcon-Alt@2x/@3x` (+ `-ipad@2x`) at the App bundle root; `Info.plist` got `CFBundleIcons` + `CFBundleIcons~ipad` (primary `AppIcon`, alternate `AltIcon`). Settings → **Appearance → App icon** toggles DEFAULT↔ALT (iOS-only, `window.Capacitor.registerPlugin('AppIcon')`, persisted in `dui_appIcon`). **MANUAL STEP if the iOS project is ever regenerated:** the 5 files (swift/m + 3 pngs) must be added to the App target in Xcode (cap sync won't add native files).

**Portrait menu → contain-fit (fixes iPad clipping).** [index.html](index.html) `#phone-menu img.bg` is now `object-fit:contain` and `recomputeCover()` uses `scale = min(vw/imgW, vh/imgH)` with centered offX/offY (was width-fit/top-anchored, which ran the bottom rows off-screen on the iPad's wider aspect). Now the WHOLE menu (every button + rotate bar) shows, centered, black letterbox on the extra space. Hit zones track it. `#phone-menu` bg is `#000` (was `#6CC8E8`).

**Multiplier layer-above-wallet:** `hudMult` depth `d → d+1` so it sits above `hudScore` ($) when overlapped in the HUD editor. (Multiplier-in-editor was also fixed earlier today — see below.)

**Removed the drug over-stack red border.** [EffectsSystem.js](src/systems/EffectsSystem.js) "apocalypse combo" pulsing red (CB: amber+triangles) screen border (4+ drugs >30%) deleted per user — intrusive. `_comboApocalypse` flag still computed (state only).

**⭐ Drug rebalance (decay + OD) — researched real durations.** [constants.js](src/constants.js) DRUG_CONFIG `decayRate`s retuned to match REAL relative duration-of-effects order, compressed to ~30s–4min (cocaine shortest → LSD longest; meth went from 2nd-shortest to 2nd-longest, matching reality). New full-lives: coke 0:30, ket 0:36, fent 0:42, beer/weed 1:05, heroin 1:52, shrooms 2:03, rx 2:15, meth 3:24, lsd 4:00. **OD: all 6 OD-capable drugs (coke/heroin/rx/fent/ket/meth) → `odThreshold 1.0001`** = OD only when a pickup OVERFILLS a maxed bar. [DrugSystem.js](src/systems/DrugSystem.js) pickup OD check now tests UNCAPPED `prev+amount >= odThr` (stored bar caps at 1.0); `checkOD()` per-frame is now a dead safety-net (can't reach 1.0001). Alcohol/weed/shrooms/lsd stay canOD:false. Dose tuning lever = `PICKUP_AMOUNTS` in DrugSystem.

**⚠️ Web build now well ahead of deployed Pages site** (index.html, constants, systems, capacitor.config all changed today). To sync live web: `npm run build` → drag-drop `dist`. iOS current via cap sync. See [[project_dui_ios_build]].

### 2026-06-20 (AM) — iOS first-run on simulator: fixes + false alarms

**iOS app now builds, installs, and RUNS on the iPhone 17 Pro simulator** (landscape gameplay + portrait menu both working). Fixes made while bringing it up:
- **`contentInset: "always"` → `"never"`** in [capacitor.config.json](capacitor.config.json) — `always` made the WKWebView reserve safe-area margins → black bars on the sides/bottom AND a touch-coordinate offset (the "tap dead-zone"). `never` makes the WebView fill edge-to-edge and keeps touch aligned. **This was the fix for both the letterbox and the dead-zone.** (cap sync to apply.)
- **Asset-copy collision** — running `cap add ios` twice (minimatch repair) split the web assets into `assets` + `assets 2` folders, so `index.html` couldn't find the menu background (broken-image "?"). Fix: `rm -rf ios/App/App/public && npx cap copy ios`. Watch for `assets 2` after any double add/sync.
- **Portrait menu "misalignment" — FALSE ALARM.** Looked like all hit zones + text overlays were shifted, but the Web Inspector diagnostic showed the transform is correct (clientW 402 = renderedW 402, naturalW 853, scale 0.471) and `document.body.classList.add('debug')` confirmed every red hit-zone box lines up with its tile. The bad screenshot was the layout caught mid-settle (cold-launch viewport). **No coordinate change needed.** (Diagnostic path for next time: Safari → Develop → Simulator → DUI webview → Console → `document.body.classList.add('debug')`.)
- **Blue sliver at menu bottom — fixed.** `#phone-menu` background was `#6CC8E8` (old app color) showing below the width-fit art on tall aspects. Changed to `#000` in [index.html](index.html).

**iOS rebuild loop:** `npm run build && npx cap sync ios` → Run in Xcode. Device run still needs Signing→Team (Apple ID) + on-device Trust + (iPad/iOS16+) Developer Mode. Brendan's iPhone is work MDM-managed (Trust/Dev Mode blocked by policy) — simulator or a personal device is the path; TestFlight (paid acct) is the way onto managed phones. See [[project_dui_ios_build]].

**⚠️ Web build is now AHEAD of the deployed Pages site** (index.html + capacitor.config.json changed today). To sync live web: `npm run build` → drag-drop `dist`. iOS is current via cap sync.

### 2026-06-20 — Crash-vs-quit resume, LOAD SAVE rework, server hardening, iOS project created — ALL LOCAL, NOT DEPLOYED

**⚠️ DEPLOY STATE:** everything below is on disk only. To ship: (a) `npm run build` then drag-drop `DUI/dist` into the dui Pages project (web); (b) re-paste `server/worker.js` into the dashboard Worker → Deploy (server hardening); (c) open the new Xcode project + Run for iOS (see morning directions). Nothing here is live yet.

**Crash vs. clean-quit resume.** [main.js](src/main.js) error/unhandledrejection handlers now stamp `localStorage['dui_crashed']`. [GameScene.js](src/scenes/GameScene.js) boot (~L375): a valid `liveRun` + crash flag (or a `manual` save) → auto-resume into the drive + "sorry we lost you" modal (old behavior). A clean swipe-close / background / iOS discard fires no error → no flag → **goes to the TITLE** with the run stashed in `_titleResumeSnap` (no modal). Per Brendan's pick: title + resume, NOT silent auto-resume.

**LOAD SAVE = LAST / SAVED / code.** [_promptForCode](src/scenes/GameScene.js) reworked: type `last` → resume in-progress run at exact spot; `saved` → last rest-stop checkpoint; anything else → portable code. **Blank RESUME defaults to LAST** when a live run exists. Popup shows a green hint with each source's location (town · mile). Title `LOAD: LAST, SAVED, OR A CODE?`, placeholder `blank = LAST · or type SAVED / a code`.

**Bug fixed (Brendan's diagnosis, exact):** the boot reset block (~L490) wiped persistent per-run save fields (`girlResponded`, `girlTexts`, `lawyerRetained`, `dealerOrders`, …) whenever `!_resumeLive` — which is true on a clean-quit TITLE boot, so they got cleared out from under the later LAST resume. Added `&& !this._titleResumeSnap` to the guard so a pending title-resume is treated like the other resumes.

**Multiplier movable in HUD editor.** `hudMult` is hidden (empty text) when the live multiplier ≤1, so it had no bounds to grab in the frozen editor. [_showEditorPopupPlaceholders](src/scenes/GameScene.js) now gives it placeholder text + forces visible; [_renderHUD](src/scenes/GameScene.js) only re-hides it when `!_ctrlEditMode`. (Clock `hudPartyClock` was already movable.)

**☁️ Server hardening — `server/worker.js` (env-gated, NOT pasted to dashboard yet).** (1) structural anti-cheat on score PUT — `miles` capped at ROUTE_MILES(293)+12 (reject `bad-miles`), `completed` forced 0 unless miles≥285; (2) per-player submit rate limit (`SUBMIT_COOLDOWN_SEC`, default 8s → 429 `rate`); (3) Cloudflare Turnstile bot-check — **DECIDED OFF** (friends-only board), inert unless `TURNSTILE_SECRET` set; (4) plate-rename cooldown (`RENAME_COOLDOWN_SEC`, default off) + rename propagation (UPDATE scores+saves). (5) **Leaderboard GET fixed** — was mixing `MAX()`/`MIN()` with bare columns (fragile SQLite quirk → could show best score w/ wrong miles/time); now a `ROW_NUMBER() OVER (PARTITION BY player_id ...)` subquery selects the actual winning row, deterministic created_at tie-break. See [[project_dui_cloud_server]].

**CloudSave dev guard.** [CloudSave.js](src/systems/CloudSave.js): cloud writes now DISABLED on localhost/LAN dev origins (http/https + private host) so playtests don't write real saves/leaderboard. iOS (`capacitor://localhost`) + prod stay ENABLED (keys off protocol + `window.Capacitor`). `window.__DUI_API_BASE` re-enables anywhere.

**📱 iOS project CREATED.** Ran `npm run build` → `npx cap add ios` → `npx cap sync ios`. The native Xcode project now exists at **`ios/App/App.xcworkspace`** (CocoaPods installed, @capacitor/haptics plugin wired, `dist` copied to `ios/App/App/public`). Gotcha hit: `node_modules/minimatch` was corrupted (`index-cjs.js` missing) — fixed via `rm -rf node_modules/minimatch && npm install minimatch@9 --no-save`. App id `com.dui.game`, name DUI (capacitor.config.json).

### 2026-06-19 — ⭐ BIG SESSION (cloud server + many fixes) — ALL LOCAL, NOT YET DEPLOYED

**⚠️ DEPLOY STATE:** everything below is on disk + verifiable on the Vite **dev server** only. The live Cloudflare Pages site + iOS app DO NOT have any of it yet. The last attempted `npm run deploy` carried ONLY the cloud-save client and even that didn't finish (wrangler hung — see below). **When Brendan says go: run ONE final `vite build`, then drag-drop `DUI/dist` into the dui Pages project** (game is static-only again, so drag-drop works), and rebuild the Capacitor iOS app. The cloud **Worker is already deployed + live** (separate from the game).

**☁️ CLOUD SERVER (Phases 1-3 of plate-as-username + cloud saves) — see [[project_dui_cloud_server]] memory.**
  - **Standalone Worker** `dui-api` at `https://dui-api.brendanbaughn.workers.dev`, source `DUI/server/worker.js` (one file: `/api/save`, `/api/plate`, `/api/leaderboard`, `/api/health`), bound to D1 `dui_saves` as `DB`. **Deployed via the dashboard (Quick Edit paste)** because local `wrangler pages deploy` HANGS on this machine (stuck on an api.cloudflare.com request — confirmed wrangler v3 AND v4, sandbox on/off; the documented "fetch failed" issue). Dashboard drag-drop can't deploy Pages Functions, so the API became a Worker. The old `functions/` dir was DELETED (game is pure-static again). D1 tables (`saves`, `players`, `scores`) created + verified live.
  - **Client** `src/systems/CloudSave.js` — absolute URL (works web + iOS + dev), all best-effort/offline-safe. Wired: rest-stop save → cloud push; FROM CHECKPOINT pulls newest of cloud/local (exact-spot OR rest-stop) → resume; plate modal claims name on submit (blocks "taken", allows offline); trip-end submits score (ranked only).
  - **Plate = username (Phase 1, [[project_dui_plate_username]]):** per-slot stable `playerId` in [SaveSystem.js](src/systems/SaveSystem.js) (sanitizer-preserved); `__plate.validate/claim` (min 2, reserved + profanity, normalized); modal reframed "DRIVER PLATE"/username + inline errors; editable in Settings → Profile.
  - **World leaderboard tab** added to the in-game LEADERBOARD app ([index.html](index.html)) — 🌐 World section under House board, same Score/Time/Miles tabs, best-per-player, your row highlighted, async best-effort.

**🎮 PHONE-MENU SAVE BUTTON.** The phone-menu "Start Over" tile is repurposed to **SAVE** (the new art labels it SAVE w/ a floppy icon): `_saveCurrentRun()` snapshots the EXACT spot (position + full state + clock) to local `liveRun` + cloud, shows a "✓ Game saved" toast, stays in the game (no reset). Resume via boot auto-resume (same device) or FROM CHECKPOINT (cross-device, exact spot, clean continue via new `_resumeFromLiveSnapshot` + `data.resumeLiveSnapshot` → `_resumeLive` with `_resumeLiveExplicit` skipping the "lost you" modal). `window.__saveRun` bridge.

**📱 MENU ART + HIT ZONES (Brendan updated the skins).** Copied 8 new per-car skins (+ generic) from `Archive/Images/iphone menu/` into `public/assets/ui/iphone_menu_bg_*.png`. Content shifted DOWN **+74px** (measured by row-profile cross-correlation, uniform). Shifted ALL `data-px` hit zones +74 (tiles + the 4 top weather readouts loc/clock/temp/wx). **Removed the bottom "menu" bar** hit zone + handler (art reads "ROTATE PHONE TO ENTER GAME PLAY" but it returned-to-title and lost the run — confusing). Default skin now beater (set earlier) — fixes truck-on-first-open.

**🚗 DRIVING / FX FIXES (all [GameScene.js](src/scenes/GameScene.js) / [EffectsSystem.js](src/systems/EffectsSystem.js)):**
  - **Vantage WIND → TAP steering (the documented "wind→tap" that was never wired).** `_activeSteeringMode` now returns `'flappy'` in the wind zone for DEFAULT mode (mirrors snow→tilt) — hold-to-fight-the-wind tap driving. Cue banner "💨 CROSSWIND — HOLD TO FIGHT IT" (extended `_updateSnowSteerCue` to cover wind). NOTE: switch flips at windStrength>0 (mile ~131), slightly before the gust peaks — gate higher if entry feels abrupt.
  - **Snappier TAP** — flappy lateral settle 8→14 (`_baseSettle`), classic/tilt unchanged. Fixes the ~½s tap-to-pull delay.
  - **Heroin nod = BLIND** — deep nods now black the screen out (`closeAlpha` on every nod, full-close cycles → pure black) per "how would you see with your eyes closed?".
  - **Custom drug-tap fix** — the drug-bar drag handler now converts canvas→scene (`- HUD_OFFSET_X`) like `overDrugBar`, so boost zones sit under the (editor-moved) icons; steering taps no longer boost.
  - **Genre/station text** depth 20→64 (above the genre button).
  - Earlier this session (already noted below in 2026-06-18 round): autosave+auto-resume, centerline drug-pickup camera-basis fix, code-entry touch/keyboard + RESUME-stays-open + copy fixes, snow cue + no-trap.

**⏳ STILL PENDING (specs captured, NOT built):** overdose-screen difficulty-tiered Retry/Start-Over (Easy: Retry=full keep+clock continues, Start Over=Seattle half-money; Normal: Retry=lose half / Start Over=lose all; Hard: no Retry) — awaiting build. Menu tile relabel only matters if Brendan reverts the art. World "World tab" UI is built but unverified vs live data. Anti-cheat/Turnstile = future Phase 4.

### 2026-06-18 — Codex addendum: background radio bridge

**Background radio — web best-effort + native-wrapper ready.** [AudioSystem.js](src/systems/AudioSystem.js) now has a `backgroundRadio` mode for real MP3 stations. When the page is hidden and a real track is playing, the audio layer stops only synthetic/game scheduling and does **not** voluntarily suspend the AudioContext; browser/PWA playback may still be suspended by iOS/Android policy, but the app no longer stops itself. Muting or Music-app pause still releases/stops audio normally.
  - Added Music app checkbox: **Background radio** in [index.html](index.html), wired through `window.__music`.
  - Persisted setting via `settings.backgroundRadio` and save-load sanitizer in [SaveSystem.js](src/systems/SaveSystem.js); applied on boot in [BootScene.js](src/scenes/BootScene.js).
  - Native wrapper hook: AudioSystem emits payloads to `window.webkit.messageHandlers.duiAudio.postMessage(payload)` plus `window.DUINativeAudio` / `window.duiNativeAudio` bridge fallbacks. Payload includes event type, track URL, current time, duration, volume, mute/pause state, and whether native should play. iOS wrapper can use this to hand off MP3 playback to AVAudioSession/background audio later.
  - Verification: `node --check src/systems/AudioSystem.js src/main.js src/scenes/BootScene.js src/systems/SaveSystem.js` passed individually. Needs real iPhone app-switch/PWA test.

### 2026-06-17 — Codex addendum: save-load hardening + rearview mirror lights

Session: picked up from the 2026-06-16 active handoff. Changes are local/uncommitted on top of the existing uncommitted editor work unless committed separately.

**Save-load hardening — DONE.** [SaveSystem.js](src/systems/SaveSystem.js) now sanitizes loaded/migrated save data at the SaveSystem boundary instead of shallow-spreading whatever was in `localStorage`. This is the insurance item that was carried as "Harden the save load" after the drug-drift NaN/localStorage brick.
  - Added helpers (`isObj`, `finiteNum`, `finiteInt`, `cleanJson`, etc.) plus bucket sanitizers for global/profile data.
  - Repairs/clamps: `activeSlot` (invalid → 0, preserving old behavior), money (finite non-negative int), settings (`radio`, `shake`, `units`, `handedness`, etc.), checkpoint tiers, leaderboard runs, drug inventory, owned/current car, dealer orders, accessories (`nos` 0-3), rest-stop snapshots/maps, and `controlsLayout` (`dx/dy` finite, `scale` clamped `[0.3,4]`).
  - Legacy v1/v2 migrations now pass through the same sanitizers; v2 plate lifting reads the raw profile's `licensePlate` before sanitizing.
  - If v3 data is repaired, constructor writes the cleaned save back once (`_loadRepaired` → `save()`).
  - Verification: `node --check src/systems/SaveSystem.js` passed. A targeted Node smoke test with deliberately corrupted fake `localStorage` passed (bad slot, bad money/settings, bad layout/accessories/rest-stop save all self-healed). `npm run build` reached Vite's production bundle phase but hung for several minutes in the known heavy/minify stretch; stopped manually, no code error surfaced.

**Rearview mirror lights — DONE, needs visual playtest.** [GameScene.js](src/scenes/GameScene.js) mirror rendering already had a light pass, but the visible lamp dots were drawn into `hudMirrorGlass` behind the mirror car sprites, so the car PNGs could hide the actual bulbs. Added a dedicated masked `hudMirrorLights` graphics layer above `_mirrorCarPool`.
  - Created `hudMirrorLights` in `_buildHUD` after `_mirrorMask` exists; depth `d - 3.25`, masked with the same mirror mask.
  - Cleared `hudMirrorLights` each mirror frame and when mirror rendering is skipped (`_perf.noMirror` / missing mirror).
  - Moved mirror NPC headlight/tail-light bulb dots to `hudMirrorLights`; road cones/splashes stay in `hudMirrorGlass` behind sprites.
  - Added live mirror police strobe/headlight dots for rear cops so pursuit cars read in the tiny mirror view, especially at night/fog.
  - **Rearview fog added after Brendan test:** mirror paints its own rear scene and did not inherit main-world fog, so fog driving showed a clean mirror. Added masked `hudMirrorFog` at depth `d - 3.30`, above mirror cars/scenery but below `hudMirrorLights`. First pass had a ruler-straight fog shelf; revised to a faint full-glass wash plus stacked low-alpha wavy bands and soft ovals around the horizon/road so the fog feathers in instead of cutting on a straight line.
  - Verification: `node --check src/scenes/GameScene.js` passed. Browser/local visual verification was not completed: local page loaded with no console errors but stayed on the loading art, then the browser automation action was blocked by browser policy. **Next person should visually test in fog: mirror scene should be hazy/milky, but mirror headlights/tail lights should still glow through.**

**Fog vehicle lights — adjusted after screenshot feedback, needs visual playtest.** This is the **main forward-view fog path**, not Claude's clear-night/Eastern WA `_renderHeadlights()` work. [GameScene.js](src/scenes/GameScene.js) `_renderVehicles().place()` / `_fogGlowGfx` now treats fog lights as diffused bloom instead of crisp shine.
  - Preserved Claude's clear-night/Eastern WA notes/behavior in `_renderHeadlights()` (oncoming headlight housings + cones/splash, same-direction mid-height red tail lights, road reflectors).
  - Fog-only change: reduced the hard core (`coreA` down), increased/widened haze (`hazeA`/`hazeR` up), and drew layered ellipses before a tiny muted bulb. Oncoming fog headlights are warmer/softer (`0xFFD36A`); same-direction fog tails are broader, less laser-dot.
  - Follow-up: fog now has its own per-car light probability — **85% lit / 15% dark** via `t._fogLightsOff`, independent of the clear-weather/night `t._lightsOff` roll. When fog is active, crisp NPC clear-night beams/dots are suppressed (`_renderHeadlights` NPC pass gated by fog density; `_drawNpcForwardBeams` skipped) so fog cars use only the hazy `_fogGlowGfx` treatment. Oncoming fog headlight haze was bumped slightly (`hazeMul 1.35`, `hazeScale 1.18`) so incoming cars don't read unlit.
  - Follow-up after Brendan test: same-direction fog tail-light cores were brightened (`0xFF2A14`, `coreMul 1.32`, `coreScale 0.30`) while haze was not increased (`hazeMul 1.00`, `hazeScale 0.92`). Intent: tails remain barely visible at distance through `Weather.fogFade`, become readable as cars approach, then lose the red mist near the player because `nearF` fades haze to zero at the bottom of the screen.
  - Follow-up on oncoming fog headlights: warmed/brightened the lamp core (`0xFFE2A0`) and then doubled the fog headlight intensity after Brendan's device test (`coreMul 2.16`, `hazeMul 2.50`, `coreScale 0.27`, `hazeScale 1.08`). Intent: incoming cars should read lit sooner through fog, while still looking like hazy lamps rather than clear-night beams/cones.
  - Near-player headlight follow-up: oncoming fog headlights now draw a small sharp bulb overlay (`headSharpA`, pale `0xFFF4C8`) as `relZ` drops under ~6500. The haze still fades out near the player, but the lamps remain visibly ON instead of disappearing with the bloom.
  - Placement follow-up: fog glow now borrows the clear-night `_renderHeadlights()` lamp placement rules instead of using one generic mid-height point. Headlights use car/truck vertical fractions (`0.50` / `0.65`) and grille-edge spacing; tail lights use rear fractions (`0.50` / `0.55`) and rear-corner spacing. The fog pass applies those rules to the actual rendered sprite size (`targetW`/`targetH`, including semis/tractors scale) while still merging the paired haze at distance. `codex_suv4x4` fog headlights are nudged lower (`headFrac 0.56`) because the generic SUV/truck height sat too high on that art.
  - Mile 15-23 follow-up: oncoming fog headlights now get their own longer light-carry fade (`headCarry = exp(-relZ / 22000)`) instead of relying only on the car body's thick-fog `Weather.fogFade`. This keeps the vehicle body dissolving into Issaquah fog, but lets headlight glow remain visible earlier/longer as a faint warm haze. Tail-light fade was left on the previous tuning.
  - Intent: in Issaquah-style fog, lights should read as glow/mist through haze, while Eastern WA night still keeps the sharper clear-air light treatment.
  - Verification: `node --check src/scenes/GameScene.js` passed. **Needs Brendan visual test in fog** against the screenshot case: oncoming cars should show soft amber glows; same-direction cars should show red fog blooms without crisp shiny dots.

**Updated next-step status:** save-load hardening is no longer TODO. Rearview mirror *zoom* was already built; rearview mirror *lights* now have a code fix but still need Brendan/device visual confirmation.

### 2026-06-16 — ⭐ ACTIVE HANDOFF / PICK UP HERE — supersedes 2026-06-14

Session: fog car-light refinement (done) + **Task 4 "decoupled-width / full-bleed scenery" (VERIFIED) + title-black-bg / pause-film-removal / music-skip-watchdog (done) + Part 2 "Customize Controls" drag editor (mostly working; ONE persisting bug).**  Checkpoint commit `f25cf67` is the decouple only (**local, NOT pushed**); substantial editor + Cancel-fix work sits UNCOMMITTED on top.  Lines drift — search by symbol.

**(Resolved) white-screen scare:** a "white screen on phone load" was a **transient network / dev-server hiccup, NOT code** — loaded fine on retry.  (`?sizedbg` diagnostic has been removed from [main.js](src/main.js).)

— — — — — — — — — —
**PART 1 — DECOUPLE / FULL-BLEED (✅ VERIFIED by Brendan: car centered, black title bg works, pause film gone, HUD shows, scenery edge-to-edge). Committed `f25cf67` (local).**
  - [constants.js](src/constants.js): live bindings `WORLD_W` / `WORLD_CX` / `HUD_OFFSET_X` + `setWorldWidth(w)` (clamps `[800, 1600]`).  HUD stays fixed `SCREEN_W=800`/`SCREEN_H=450`.  Road imports `* as C` and reads `C.WORLD_W`/`C.HUD_OFFSET_X` **live** (set at boot — never snapshot).
  - [main.js](src/main.js): canvas boots at 800 (NOT fixed); `applyOrientation()` (~899) measures `#game-root` box and in landscape calls `setWorldWidth(450*aspect)` + `game.scale.setGameSize(targetW,450)` so FIT fills the container.
  - [index.html](index.html): `#game-root` is **full-bleed** (`inset:0`, was `env(safe-area-inset-*)` — that box was the black chunk).  ⚠️ HUD could go under the notch on NARROW phones — deferred (inset UI cam by safe-area).
  - [GameScene.js](src/scenes/GameScene.js): `_applyDecoupledCameras()` (called every frame at top of `_renderFrame`) scrolls `cameras.main` by `−HUD_OFFSET_X` (world still drawn centered at scene-x 400 — projection UNCHANGED) and sets `_uiCam` to **full-canvas** `(0,0,WORLD_W,450)` scrolled `−HUD_OFFSET_X` (so the fixed 800 HUD lands centered).  **Double-vision/two-shadows fix:** `_tireShadowGfx`,`headlightGfx`,`headlightFixtureGfx` were missing from `_worldObjects`, so the HUD cam re-painted them on top — added to `_worldObjects` (~1945).  (Real alcohol `doubleVision` >0.45 alc is a SEPARATE intended effect.)
  - [Road.js](src/road/Road.js): render `MARGIN` and `_drawSegment` local `M` = `150 + ceil(HUD_OFFSET_X)`; all grass/flank/water/fog/cover fills + sprite culls use `M`/`SCREEN_W+M`.  Removed dead `HALF_W`.
  - Menu scenes ([BootScene](src/scenes/BootScene.js)/[RestStopScene](src/scenes/RestStopScene.js)/[GameOverScene](src/scenes/GameOverScene.js)): `setViewport(HUD_OFFSET_X,0,800,450)` on create+resize (sides letterbox — deferred to fill).

**ALSO DONE THIS SESSION (verified / safe):**
  - **Title screen = solid black bg:** `_titleBlackout` rect (`_buildHUD` ~13798), in `_worldObjects`, depth 50, visible only while `_awaitingStart`; toggled in `_setTitleVisible`.
  - **Pause screen:** removed the dark-grey film fillRect (`_togglePause` ~9038).
  - **Music-skip watchdog:** [AudioSystem.js](src/systems/AudioSystem.js) `_startSkipWatchdog()` (1s interval, from `init()`): if the track element isn't paused/ended/muted/`_musicPaused` and ctx is running but `currentTime` isn't advancing (<0.05), first retry `el.play()`, else `_onTrackEnded()` (skip to next).  ⚠️ Needs a real background→return phone test.
  - **Fog car-lights:** `place()` NPC glow — distant lights exponentially attenuate via `Weather.fogFade` (smudge→gone), haze persists to just-behind-player (`nearF`), middle bulb 65% (`baseR*0.39`); player tail-light dimmed (`a=0.55`, bulb `*0.78`, `r*0.455`) + broad fog-bloom veil.
  - **Title "low then pops" on rotate-back (UNVERIFIED):** the title art is at fixed HUD coords — it wasn't moving; the CANVAS FIT was stale.  iOS often fires NO final `resize` after the rotation animation settles, so `applyOrientation`'s single rAF re-fit to a MID-rotation size and the canvas stayed letterboxed-low until a stray event (a tap) snapped it.  Fix: [main.js](src/main.js) `onOrientationChange` now also re-runs `applyOrientation` at +120/300/550 ms to catch the settled size (idempotent + cheap, mirrors the existing menu-lock defer at ~50/250 ms).

— — — — — — — — — —
**PART 2 — "CUSTOMIZE CONTROLS" DRAG EDITOR (Settings → EDIT button).**  Replaces the old "Hide HUD" toggle.  Drag any control/readout, pinch-to-scale (Instagram-sticker style), per-profile save, Reset + Undo.

**Architecture:**
  - Per-profile layout: `this._hudLayout = _save.get('controlsLayout', {})` (~650), `_hudUndoStack=[]`.  `_saveHudLayout()` persists via `_save.set('controlsLayout', ...)`.
  - `_hudMovableGroups()` returns named groups `[['score',[hudScore]],['speed',[hudSpeed,_mphSub]],['gas',[hudGas]],['gasIcon',[hudGasIcon]],['dist',[hudDist]],['region',[hudRegion]],['radio',[hudRadio]],['hp',[hudHP]],['clock',[hudPartyClock,hudMult]],['stars',[hudStars]]]` — each group moves/scales as a UNIT (MPH sub rides with speed, multiplier with clock).
  - `_applyHudLayout()` (end of `_renderHUD()`): captures `obj._hudBaseX/Y/SX/SY` once; for moved groups, anchor = `objs[0]`, sets `obj.x = ax+dx+(base-ax)*s` etc + `setScale(baseSX*s, baseSY*s)` → group scales around its anchor (fixes MPH overlapping the scaled number).
  - Pinch (Instagram): `_updateControlsEditor()` — if `p1.isDown && p2.isDown && _dragGroup`, scale that held group by `dist/_pinchStartDist * _pinchStartScale` clamped `[0.3,4]` (one finger holds, second finger ANYWHERE scales).
  - `_uiCam` is full-canvas, so `_onHudDrag` maps the pointer via `_uiCam.getWorldPoint`, clamps to `[-HUD_OFFSET_X+4, SCREEN_W+HUD_OFFSET_X-4]×[4,SCREEN_H-4]` (can move PAST original 800×450 dims), stores anchor-relative dx/dy.
  - `_enterControlsEditor`: hides title if awaiting, makes group members `setInteractive({draggable})` (depth→65, base depth captured), registers drag/dragstart/dragend, disables `this._hudObjects` inputs (so live buttons aren't usable in edit), builds CENTERED panel (320×90 at screen center) with **RESET (pink 0xFF39AF) / UNDO (green 0x2BC44E) / DONE (blue 0x39A8FF)**.
  - `_exitControlsEditor`: clears drag/pinch, offs listeners, restores depth + `disableInteractive`, re-enables `_editorDisabledInputs`, saves, destroys panel, restores title.
  - Entry/arming: [index.html](index.html) EDIT handler (~2800) calls `window.__customizeControls.start()` then on phone shows the rotate popup (`showConfirm`).  [main.js](main.js) `window.__customizeControls = {start, cancel}` (~672): `start()` clean-slates (`_exitControlsEditor` if already in) + sets `s._editorArmed=true`; `cancel()` sets `_editorArmed=false` + unconditional `_exitControlsEditor` + `applyOrientation` re-sync.  `update()` arm-check (~3049): `if(_editorArmed){_editorArmed=false;_enterControlsEditor()}` then if `_ctrlEditMode` runs the editor render loop and returns.

**✅ Working in Part 2:** text readouts drag + scale + group correctly, move past original dims, persist per profile; centered RESET/UNDO/DONE panel; pinch-to-scale; weapons/drugs show in editor (removed the `_awaitingStart` gate via `&& !_ctrlEditMode`).

**ALL CONTROLS NOW MOVABLE+SCALABLE (2026-06-16 round 2 — UNVERIFIED, all-at-once per Brendan).**  Extended the editor beyond readouts to every control.  Two clean subsystems:
  - **Readouts** (unchanged): real-object drag + `_applyHudLayout`.
  - **Non-readout controls** (NEW): top buttons (pause/ff/genre/mute/map/garage), pedals (brake/accel), mirror, weapon column, drug grid, disguise.  Each reads its custom `{dx,dy,scale}` from `_ctrlOff(id)` and BAKES it into its own native positioning/draw so the hit-zone stays glued to the visual.  `_applyControlLayout()` (every frame after `_applyHudLayout` in `_renderHUD`, + on pinch) positions buttons (lbl + `bg.input.hitArea` + displaySize), pedals (+ `_pedalHitZones`), mirror (`_applyMirrorOffset` → offset via `_mirrorGeom` mx/my, scale folded into the hold-zoom path; redraws frame+mask only on change).  Weapons/drugs read offset+scale in their per-frame draws (`_drawF12Inventory`/`_renderF12Cell` gained a `scale` param + publishes `_weaponClusterBounds`; `_drawDrugIcons` scales the grid + publishes `_drugClusterBounds`).  Bases RECOMPUTED from handedness each frame (never captured) → a moved control is pinned, an un-moved one keeps normal placement.  Brendan: *"this gets rid of the need for handedness toggle"* — handedness now drives only the DEFAULT base; custom offsets pin on top.
  - **Editor handles:** transparent draggable proxy rects (`_buildControlProxies` on enter / `_destroyControlProxies` on exit) at depth 64 — ABOVE all controls (mirror 15, pedals 21, weapons 24, buttons 62-63) so they intercept the grab, BELOW readout draggables (65) + panel (70).  `_onCtrlProxyDrag` updates `_hudLayout[id]` (id keys: `btn_<id>`, `pedalBrake`/`pedalGas`, `mirror`, `weapons`, `drugs`, `disguise`); pinch reuses `_dragGroup`.  Steer-exclusion follows moved buttons (live `_lx/_ly/_lsz` boxes) + the live weapon cluster box.  Reset/undo rebuild proxies.
  - **Known gaps:** wiper button NOT movable yet (stays default).  **TEST:** drag+pinch each control; verify hit-zones follow (a moved pause/weapon/pedal FIRES, doesn't steer); verify a never-customized player sees an IDENTICAL HUD (offset=identity, so `_applyControlLayout` reproduces the old layout exactly).

**ROUND 3 (2026-06-16, UNVERIFIED) — feedback fixes on the above:**
  - **Genre/station text (`hudRadio`) acted as a button in the editor** (changed the station on tap, wouldn't drag): its `pointerdown` now bails `if (this._ctrlEditMode)` so it's a pure drag handle in edit mode.
  - **Weapons were one locked cluster → now 4 INDEPENDENT cells.**  `_drawF12Inventory` reads `_ctrlOff('weapon_<id>')` per cell (gun/spike_strip/paint_bomb/rocket), publishes `_weaponCellBounds[id]`; steer-exclusion + proxies are per-cell.
  - **Disguise was glued to Mute → now INDEPENDENT** (id `disguise`): default anchors under Mute's *base* (handedness) spot, not Mute's moved box, so moving Mute no longer drags it.
  - **Drugs were one cluster → now 10 INDEPENDENT cells, ALWAYS shown.**  `_drawDrugIcons` renders all 10 (was unlocked/custom-only); per-drug `_ctrlOff('drug_<id>')` + `_drugCellBounds[id]`.  Undiscovered/locked drugs draw as a **black semi-translucent block** (icon hidden) per Brendan.  ⚠️ side effect: all 10 drug slots now show during normal play even at 0 unlocks (intended — his request).
  - **Pinch now grows the proxy handle** (`_proxyBaseW/H` × scale in `_updateControlsEditor`) so scaling reads consistently (was: image grew, handle didn't).

**ROUND 4 (2026-06-17, UNVERIFIED) — more feedback fixes:**
  - **Handles didn't grow/track the scaled controls** ("buttons aren't growing with the images"): the round-3 fix used `rect.setSize()`, which on a Phaser Rectangle changes the LOGICAL size but does NOT re-render the shape — so the blue handle stayed put while the art grew.  Replaced with **`_syncControlProxies()`** — called every editor frame (update edit-branch + on pinch) — which glues each proxy to its control's LIVE bounds (`btn._lx/_ly/_lsz`, `_pedalHitZones`, `_mirrorBaseBounds`, `_weaponCellBounds`, `_drugCellBounds`) via `displayWidth/Height` (rescales the rendered rect + its hit area).  Removed the `setSize` hack + now-unused `_proxyBaseW/H`.
  - **Game clock + multiplier were one group → split** into `clock` (`hudPartyClock`) and `mult` (`hudMult`) in `_hudMovableGroups()`, so each moves independently.  (NOTE: old saves that moved the combined `clock` group now move only the timer; the multiplier resets to default — fine, they're re-editing.)

**ROUND 5 (2026-06-17, UNVERIFIED) — more feedback:**
  - **Loading screen skewed LEFT (black on the right):** the BootScene loading UI is built in `preload()`, but the decoupled-width viewport centering (`_applyVP` → `setViewport(HUD_OFFSET_X,0,800,450)`) only ran in `create()` — so while assets loaded and `applyOrientation` widened the canvas, the art sat left-of-centre.  Moved `_applyVP` + the `scale 'resize'` listener into `preload()` ([BootScene.js](src/scenes/BootScene.js)); `create()` just re-asserts it.
  - **Editor declutter (Brendan picked "outline only the item I'm touching"):** control proxies are now created INVISIBLE (`fill alpha 0`, `stroke alpha 0`) but still fully interactive (input ignores alpha); `_syncControlProxies` lights up ONLY the proxy whose id == `_dragGroup` (fill 0.18 + 2.5px stroke).  So the screen shows just the controls; the blue box appears only on the handle you're dragging.
  - **Title settle tail extended** to `[120,300,550,900]ms` in `onOrientationChange` (iOS rotations can run ~600ms; the title "tilt/off when first rotated" is the OS rotation animation — these re-fits land it centered once it settles).
  - **Wiper:** it's the windshield-wiper / weather button (`hudWiperBtn`, beside BRAKE) that ONLY appears in RAIN or SNOW.  Brendan picked **"always show it in the editor"** → now movable+scalable (id `wiper`): `_enterControlsEditor` force-shows it (`setVisible(true)`), `_exitControlsEditor` restores weather-driven visibility.  Its icon is drawn at absolute coords, so move+scale is applied as a **Graphics transform** in `_applyControlLayout` (`setScale(o.s)` + `setPosition(o.dx + bl*(1-s), …)`) which carries the local hitArea + the label; bounds published in `_wiperLiveBounds`.  Steer-exclusion (`overWiper`) added, gated on `hudWiperBtn.visible` so there's no dead zone in clear weather.

**ROUND 6 (2026-06-17, UNVERIFIED) — two-finger gesture rewrite (Brendan's spec, "all movable items"):**  Replaced the drag-event + simple-pinch handling with a per-frame **gesture state machine** in `_updateControlsEditor`, applied uniformly to readouts AND control proxies.  Flow: **finger 1 grabs+moves** the item; **finger 2 anywhere scales** by the inter-finger distance (apart = grow, together = shrink); **lift finger 1 while finger 2 is down → finger 2 takes over movement** (place precisely without your finger covering the item); lift all = committed.  Implementation:
  - Grab on **`gameobjectdown`** (press, NO movement needed — so finger 1 can hold still while finger 2 scales).  New `_onHudGrab(pointer,obj)` sets `_dragGroup` + `_posPointer` (+ `_pushUndo`); ignores a 2nd finger landing on another item (it's the scaler, not a re-grab).
  - `_updateControlsEditor` polls `pointer1/pointer2`: picks the **position finger** (keeps it until it lifts, then hands off to the remaining finger, **re-anchoring** so there's no jump — `_posAnchor` = {pointerWorld, dx, dy}); **scale finger** = the other finger while both down (`_scaleAnchor` = {dist, scale}).  Sets `_hudLayout[id]={dx,dy,scale}` → `_applyHudLayout`+`_applyControlLayout`+`_syncControlProxies`.  Move uses anchor-delta in `_uiCam` world space; clamped to the widened screen.
  - **Removed** `_onHudDragStart/_onHudDrag/_onHudDragEnd/_onCtrlProxyDrag`, the `dragstart/drag/dragend` listeners, `_pinchStart*`, and the now-dead proxy `_ctrlBaseCX/CY`/`_proxyBaseW/H`.  Proxies still `setInteractive` (for `gameobjectdown`); position/size driven by `_syncControlProxies` from live bounds.

**ROUND 7 (2026-06-17) — STALE DEV-SERVER triage + two hardening fixes.**  Brendan hit a cluster of flakiness while editing: HUD sliding LEFT (off-screen/under-notch) repeatedly, the music app playing an "old MIDI" then CRASHING, "could it overload the system?"  **Root cause: the Vite dev server had been up 5½ DAYS** with heavy HMR churn + an accumulated stale browser cache.  Symptoms unified: (a) a module reload reset the module-level `HUD_OFFSET_X` to 0 while the canvas stayed wide → HUD left-aligns; (b) a stale/failed MP3 load fell back to the **legacy procedural Web-Audio synth** (the "old MIDI" — the current code has ZERO `.mid`; all 78 tracks are MP3) which then crashed.  **Killed the stale server + started fresh** (`npm run dev`; 39 s cold rebuild confirmed stale deps).  Code hardening:
  - **Synth removed (per Brendan):** [AudioSystem.js](src/systems/AudioSystem.js) `_startScheduler()` is now a no-op (`_stopScheduler()` only) so the procedural generator NEVER runs; the `_startTrack` catch now `_onTrackEnded()` (skip to next MP3) instead of "synth still runs."  Stations only ever play MP3s; a failed/empty load goes silent or skips.  (The ~600 lines of oscillator/scheduler synth code are now dead but left in place — safe to delete later; oscillators are NOT used for SFX.)
  - **HUD self-heal:** [GameScene.js](src/scenes/GameScene.js) `_applyDecoupledCameras()` now re-derives `WORLD_W`/`HUD_OFFSET_X` from the LIVE `this.scale.gameSize.width` if they've drifted (`C.setWorldWidth(gw)`), so a module reset can't slide the HUD off-screen.  No-op in production (no HMR).
  - **Lesson:** restart the dev server periodically during long sessions; a multi-day Vite instance drifts (HMR module state + stale cache) and produces exactly this kind of phantom flakiness.

**ROUND 8 (2026-06-18, UNVERIFIED — NOT yet redeployed to Cloudflare):**
  - **Music "goes silent & stays silent" — FIXED.** Regression from round-7's synth removal + the stall-watchdog: on the LIVE Cloudflare site MP3s buffer slower than localhost, so the watchdog misread buffering as a stall and skip-cascaded; after 6 quick skips the fail-brake `_stopTrack()`'d permanently with no synth fallback → dead silence.  [AudioSystem.js](src/systems/AudioSystem.js): (a) watchdog now ignores buffering (`el.readyState < 3` → not a stall) and only skips after ~5 genuine stall-seconds; (b) the FAIL_LIMIT brake now schedules a **6 s auto-retry** (`_recoverTimer` → `_refreshStationPlayback`, gated on not-muted/paused) instead of going silent forever.
  - **Spike strip did NOTHING on speed-trap cops — FIXED.** Root cause: during a traffic stop, GameScene slides the trap trooper to `playerPos + 600` (AHEAD-left, [GameScene.js](src/scenes/GameScene.js) ~3630 `-1800 → +600`), but the spike only caught `rel < 0` (strictly behind) → missed it, while gun (fires forward) + donuts (all) hit it.  [CopSystem.js](src/systems/CopSystem.js) spike case now uses `rel < SPIKE_FWD_REACH (2500)` — catches behind + the immediate ~1-car-length-ahead band (covers the parked trooper) without reaching far-ahead traffic/barricades.  NOTE: spiking a trooper still ESCALATES (weaponOnTrooper, like a gun) — donuts remain the only non-escalating trap option.
  - **Rest-stop HP readout — ADDED.** [RestStopScene.js](src/scenes/RestStopScene.js): top-right (under the score), `🔧 HP {cur}/{max}` = `_durabilityAtEntry` vs `VEHICLES[id].hp`, green/amber/red by fraction.  Static (entry value; repairs apply on resume).
  - **iOS reloads the LIVE game** (Brendan: "cloudflare game just reset"): production has NO hot-reload, so a reset there = iOS discarding/reloading the heavy WebGL tab under memory pressure or brief backgrounding (lock/notification).  Browser limit, not a code crash.  Mitigations if frequent: trim the 1,900-sprite startup pool; run as a Home-Screen PWA.

**ROUND 9 (2026-06-18, UNVERIFIED — NOT yet built into a deploy; Brendan said "Deploy when I decide"):**
  - **AUTOSAVE + AUTO-RESUME — the data-loss fix.** A reload mid-drive used to lose the whole run (money/position/drugs/weapons/car/HP/stars/gas).  Now the run is autosaved and auto-resumed.  Brendan picked **auto-drop back into the run** + a **"sorry, we lost you…" OK modal** on resume.
    - **Store:** new per-profile `liveRun` key = `{ snap: <_collectSaveSnapshot(null)>, ts }`.  CRITICAL gotcha handled: [SaveSystem.js](src/systems/SaveSystem.js) rebuilds each profile from a whitelist on load (`_sanitizeProfile`), so any new persisted key VANISHES on the exact reload we're surviving unless explicitly copied — added `liveRun` to `DEFAULT_PROFILE` + `p.liveRun = this._sanitizeLiveRun(...)` + `_sanitizeLiveRun()` (JSON-clean snap + numeric ts).
    - **Snapshot:** reuses the rest-stop snapshot shape ([GameScene.js](src/scenes/GameScene.js) `_collectSaveSnapshot`, now also carries `partyClockSec` + `gameTime` — extra fields are ignored by the bit-packed code path, which only reads fixed fields, so cross-device codes are untouched; this just stops a reload-to-refresh-the-clock exploit).
    - **Write cadence:** `_autosaveRun()` every 3 s in `update()` + on `pagehide`/`visibilitychange(hidden)` (the iOS discard moments), bound once via `_autosaveBound`.  No-op unless actually mid-drive (position > 50, not title/editor/ending).
    - **Resume:** `init()` detects a fresh `liveRun` (position > 50, < 12 h old) ONLY on a clean boot (no resume/skip/daily/mission data) → `_resumeLive`.  New create branch restores position + full snapshot via `_applyResumeSnapshot`, reseeds passed stops/checkpoints, restores clock/timer, skips title, `_steerLockUntilTap`, and sets `_awaitingResumeOk` (frozen world until OK).  `update()` paints a frozen frame while `_awaitingResumeOk`.  `_showLostYouPopup()` = "SORRY, WE LOST YOU…" + OK; OK lifts the freeze (car then coasts until first steer tap, like every resume path). **2026-06-19 fix:** auto-resume now applies `liveRun.snap.difficulty/customSub` before the scene builds so a custom snapshot cannot come back under normal/easy rules (the "$100k but pickups/earnings still active" symptom). Manual Save now stores `liveRun.manual=true`; clean manual resumes skip the "lost you" modal, while rolling autosaves remain `manual:false`. `SaveSystem._sanitizeLiveRun()` preserves that manual flag across real reloads. Live/manual/rest-stop snapshots now also carry per-run Contacts state (`messageState`: buddy threads, Crush thread/pending/streak, trap-warning set, random text timer) so returning from a save/reload/rest stop doesn't make texts look reset from the beginning. Follow-up audit added `runState` for non-inventory consequences/trophies: DUI stop history + DUI earnings penalty, flat-tire/probation timers, no-damage timer/milestones, peak/ever-hit stars, 5-star-survivor fired flag, ever-used-rest-stop, and bonus-line spawn timers.
    - **Clear `liveRun`** so it never auto-resumes a dead/finished trip: `_endGame` (all crash/OD/busted/finish endings, in the `_statsTripEnded` guard); [main.js](src/main.js) `__startOver` + `__mainMenu` clear it BEFORE restarting (deliberate returns show the title, not a yank back).
    - **MODAL-TRAP BUGFIX (2026-06-18):** Brendan got stuck on the FROM CHECKPOINT save-code screen — in LANDSCAPE he could type but couldn't tap CANCEL/RESUME ("leave + return horizontal makes the button show"). Root cause: the DOM code-entry popup (`_buildCodeEntryPopup`) was vertically CENTERED + auto-focuses the input → the iOS landscape keyboard fills the bottom half and covers the buttons (which sit below the input). Fix: anchor the card to the TOP (`align-items:flex-start` + top padding + `overflow:auto`) so the keyboard can never cover the buttons. Applied the SAME fix to the first-run license-plate modal ([index.html](index.html) ~1210 `#plate-modal`), which had the identical centered+autofocus pattern. (He only reached the code screen because Start Over was looping — see next bullet — but the landscape-keyboard trap was a real independent bug.) ALSO per Brendan's suggestion: both modals' buttons now INVERT color while pressed (`pointerdown`→neon fill on the code-entry DOM buttons; `:active` on the plate modal) so a registered tap is visible — and a non-flip points at the touch not reaching the button (vs. "is it the button or my phone?").
    - **ROOT-CAUSE FOLLOW-UP (2026-06-18):** from the START menu the code modal still had no keyboard + dead buttons (they inverted but their click never fired). Cause: `_blockGameTouch` ([main.js](src/main.js) ~150) `preventDefault`s ALL document touches except inside `#phone-menu, #plate-modal` — and the save-code modal is `#dui-code-entry`, which was NOT exempt, so it swallowed the input's focus (no keyboard) and the buttons' synthesized `click` (pointerdown/invert still fired, which is why they looked alive but did nothing). Fix: added `#dui-code-entry` to the exemption selector (same fix the comment says was needed for `#plate-modal`). RESUME→valid code loads the checkpoint, invalid→"CODE NOT FOUND", CANCEL closes — all already in `_promptForCode`; they just couldn't receive taps.
    - **CODE-ENTRY RESUME polish (2026-06-18):** invalid code now pops a tap-to-dismiss DOM ALERT layered above the code modal (inside `#dui-code-entry`, z 100000) with an OK button that keeps the modal open for re-entry — the old `_showPopup('CODE NOT FOUND')` rendered on the canvas and hid behind the pause menu. Modal only closes on a VALID code now.
    - **SAVE-CODE COPY FIX (2026-06-18):** Brendan: "copy acted like it worked but wouldn't paste anywhere." Cause: on the HTTP dev server `navigator.clipboard` is undefined (Clipboard API is HTTPS-only), so [RestStopScene.js](src/scenes/RestStopScene.js) fell to an `execCommand` path that (a) used an off-screen `opacity:0` textarea + bare `.select()` which silently FAILS on iOS, and (b) flashed "COPIED!" unconditionally. Fix: `copyCode` now uses `navigator.clipboard` only in a secure context (production HTTPS), else a proper iOS `execCommand` (real Range selection + `setSelectionRange`), and only says "COPIED!" on genuine success; if copy is blocked it opens a `#dui-copy` SHEET (touch-exempt) with the code in a pre-selected readonly field + COPY/CLOSE so the player can always long-press → Copy. (Live HTTPS site copies in one tap; dev server uses the sheet.)
  - **SNOW STEERING — cue + no-trap (2026-06-18):** Brendan (default steering): "snow is hard, can't tell if it's tilt at mile 45 or I'm still tapping, sometimes nothing registers." Root cause: `'default'` mode auto-switches to TILT in snow ([GameScene.js](src/scenes/GameScene.js) `_activeSteeringMode` ~2673, `if (_tiltAttached && _snowSteerRamp()>0) return 'tilt'`), and tilt mode IGNORES taps (`_isLeftRaw/_isRightRaw` ~2577 force touch=false) — but the switch was SILENT, so the player kept tapping into a void; and if tilt wasn't attached (perm denied/unsupported) they were stuck in classic WITH snow's intentional twitchiness (wander + `DIGITAL_SNOW_SENS` oversensitivity) and no escape. Fix (Brendan picked "cue + no-trap"): (1) `_tiltCoax = !!this._tiltAttached` now gates BOTH the snow wander (~4568) and the digital oversensitivity (`_snowSensMul` ~4706) — when tilt is unavailable, L/R+tap stay responsive in snow (icy GRIP loss still applies for realism, tilt still tames it when active). (2) new `_updateSnowSteerCue()` (called in the weather block ~3493) shows a persistent HUD banner in the snow zone: "📱 SNOW — TILT TO STEER" when tilt is the live scheme, or "❄️ SNOW — SLIPPERY" when tilt isn't available. Doubles as a tilt-permission diagnostic (which banner shows = whether tilt attached).
  - **PLATE = USERNAME, PHASE 1 (2026-06-18, local-only; see [[project_dui_plate_username]] memory):** (1) SaveSystem: stable per-slot `playerId` minted once + sanitizer-preserved + `activePlayerId`/`playerIdOf` accessors (immutable owner anchor for the future online leaderboard; rename won't reassign run history). (2) [main.js](src/main.js) `__plate.validate()` — shared rules: min 2 chars, reserved set (ADMIN/STAFF/SYSTEM…), profanity/slur blocklist, all on a space-stripped NORM form (`DUI 4 LYF`==`dui4lyf`, mirrors planned server `plate_name_norm`); `set()` routes through it; `playerId()` exposed. (3) plate modal reframed "YOUR PLATE"→"DRIVER PLATE" + "public username" copy + inline error line (rejected names explain why). (4) Settings → new Profile section shows current plate + EDIT (editable any time, not just first launch). Phases 2-4 (CF Worker+D1 uniqueness, leaderboard identity, Turnstile) NOT started.
    - **BUGFIX (2026-06-18, post-first-build):** the IN-GAME pause-menu START OVER ([GameScene.js](src/scenes/GameScene.js) ~1424) is a SEPARATE path from `window.__startOver` and was NOT clearing `liveRun` — so every Start Over auto-resumed the run it was trying to abandon ("sorry, we lost you…" every time), AND money climbed each attempt (after OK the car coasts → `this.score += _distEarn` → autosave captures the higher score → next resume restores the bigger number). Fix: that handler now also `save.set('liveRun', null)` + `this._resumeLive = null` alongside the existing `lastRestStop` clear. (GameOver Start Over/Retry are safe — `_endGame` already cleared `liveRun`; daily restart is excluded by the `_dailyStage` init guard; the Shift+L handedness `scene.restart()` intentionally resumes.)
    - **Verify on device:** (a) drive a while, force-reload the tab → "lost you" modal, tap OK, resume exactly where you were with all money/drugs/weapons/HP/stars/clock; (b) Start Over + Main Menu still go to a fresh title (no resume); (c) finishing/dying then reloading shows the title, not a dead run.
  - **DRUG PICKUPS ON THE CENTERLINE NOT COLLECTING — FIXED (camera-basis mismatch).** Brendan: "drove over some sprites on the double-yellow line (mostly weed) and they didn't pick up." Root cause (confirmed, ChatGPT-assisted): the drug RENDERER (`_renderDrugSprites`, [GameScene.js](src/scenes/GameScene.js) ~13045) projects from `_renderCamPos()` = `player.position + CAM.eyeForwardZ`, but the pickup-COLLISION scan (~5989) walked segments from the RAW `player.position`. **In cockpit view `CAM.eyeForwardZ = 4500` ([constants.js](src/constants.js) ~116) ≈ 22 segments** (SEG_LENGTH 200), so the sprite you SAW touching the bumper was ~22 segments away from where collision looked — collision only caught it "late," and at the `di≤14` edge / at speed / on the centerline it was missed entirely. Chase view has `eyeForwardZ 0`, so it behaved there (→ intermittent, view-dependent). **Fix:** the drug-collection loop now derives its start segment from `_renderCamPos()` (new local `camSegIdx`) so collision projects from the SAME basis the renderer draws from; scan widened `di≤14→16`. `segIdx` (raw) left untouched for the separate scenery-collision loop just below. No-op in chase view. Pre-baked drug sprites span `offset −0.55..0.55` ([RouteData.js](src/road/RouteData.js) ~2012) so they legitimately sit on the double-yellow; nothing centerline-special, that's just where Brendan noticed. **Verify on device: drive over centerline weed pickups in COCKPIT view at speed — they should now collect on visual contact.**
**🐞 EDITOR-ENTRY LIFECYCLE BUG — ROOT CAUSE FOUND + FIXED (UNVERIFIED).**  It was NEVER a Cancel bug.  Brendan's clinching clues: *"the Customize-Controls path only works once — even without pressing Cancel"* and *"if I hit START it takes me to the editor."*  **Root cause:** `_editorArmed` is a sticky latch.  Tapping EDIT sets `s._editorArmed=true` ([main.js](src/main.js) `__customizeControls.start`); the ONLY thing that turns it into the editor is the generic check at the TOP of `update()` ([GameScene.js](src/scenes/GameScene.js) ~3049: `if(_editorArmed){…_enterControlsEditor()}`).  That check fires the first time `update()` runs in landscape — which on a phone is *the first tap after rotating*, i.e. the SAME tap the player reads as "Start the game."  So an armed flag silently hijacks Start → dumps you in the editor.  And the flag was never cleared on backing out, so it lurked and triggered later ("works once, then random").  Compounded by the two pause systems (Phaser `scene.pause('Game')` via orientation vs `gs._paused` overlay) making entry timing nondeterministic.

**FIX (Brendan picked "enter on rotate"):**  (1) [main.js](src/main.js) `applyOrientation` resume branch — when `_editorArmed` && rotated to landscape, **resume the Game scene immediately** (no `pendingTapResume` tap) so the editor opens *on rotation*, never on an ambiguous Start tap.  (2) Same fn, on the running→paused EDGE (leaving the game for the menu) clear a stale `_editorArmed` — safe because EDIT is tapped while ALREADY paused, so a fresh arm is never clobbered.  (3) [GameScene.js](src/scenes/GameScene.js) `_startGameplay` clears `_editorArmed` when a real run begins (belt-and-suspenders).  Net: deterministic entry on rotate, self-cleaning flag, cycle-2+ works, Start can't be hijacked (stale arm self-heals into one editor visit then clears).  **UNVERIFIED — Brendan to retest: (a) EDIT→rotate opens editor every time incl. 2nd/3rd cycle; (b) tapping START goes to the game, not the editor.**

**CODE MAP (for reference):** [index.html](index.html) ~2800 EDIT handler + ~1576 `showConfirm`/`__activeConfirmClose`; [main.js](src/main.js) ~672 `__customizeControls.start/cancel`, ~898 `applyOrientation` (resume branch = the fix), ~976 `tapResumeHandler`, ~988 `onOrientationChange`; [GameScene.js](src/scenes/GameScene.js) ~3049 arm-check, ~16812 `_startGameplay` (clears arm), ~16391 `_enterControlsEditor`, ~16485 `_exitControlsEditor`.

— — — — — — — — — —
**NEXT STEPS (updated 2026-06-17 — reconciled with rounds 2-5 + Codex addendum):**
  - ✅ **DONE (awaiting Brendan's device playtest):** editor-entry "enter on rotate" fix; ALL controls movable+scalable incl. buttons/pedals/mirror/wiper/per-weapon/per-drug/disguise/clock-mult-split (rounds 2-5); steering LEFT-turn dead zone (`sx = p.x − HUD_OFFSET_X`, Brendan confirmed fixed); loading-screen skew (BootScene viewport in `preload`); title rotate-settle re-fit; weapons-lost-at-rest-stop (Codex); save-load hardening (Codex); rearview mirror lights + zoom (Codex).
  - ✅ **DONE (awaiting test) — editor pop-ups:** transient pop-ups now movable.  Added `popup` (`hudPopup` — pickups + `_fireBuddyText` phone texts), `hpDamage` (`hudHPDamage`), `rearCop` (`hudRearCop`) to `_hudMovableGroups()` (readout-style drag).  `_showEditorPopupPlaceholders()` shows example text on enter (`📱 +$8 PICKUP / TEXT`, `-15`, `◀ PURSUIT — 120 ft behind`); `_renderHUD` is guarded `if (_ctrlEditMode)` (3 spots: rearCop, hudPopup visible/alpha, hudHPDamage timer-hide) so the live timer/cop logic can't re-hide them mid-edit; `_hideEditorPopupPlaceholders()` on DONE returns them to transient.  Caveat: `hudPopup` base-Y is view-mode-dependent (chase vs cockpit) — saved offset is relative to whichever view first captured the base; the editor's chase-view drag compensates.  **← THE EDITOR IS NOW FEATURE-COMPLETE.**
  - ⏳ **OPEN — bug:** cars render THROUGH house/building sprites (depth/z-order).  ⚠️ Tangled with the long-documented **sprite draw-order architecture limit** (see "Hill-crest floating — UNRESOLVED" + "do NOT use `visible`-based hill occlusion for sprites").  Needs a real layered fix, not a band-aid — scope before touching.
  - ⏳ **OPEN — follow-ups:** menu scenes fill their sides; inset HUD by safe-area for narrow phones (notch); music-skip watchdog still needs a real background→return phone test.

### 2026-06-14 — supersedes 2026-06-12

Session: portable-save shrink + entry/display UI, sprite-drift model correction, and the full ChatGPT bug-list pass (#4-#8 + 2 extras).  **Uncommitted, NOT deployed.**  Lines drift — search by symbol.

**SPRITE-DRIFT MODEL CHANGED (supersedes the 2026-06-12 "20 mph RELATIVE" note).**  `_updateDrugDrift` now moves drug/f12 pickups at an ABSOLUTE cap: `advance = Math.min(player.speed, MAX_SPEED*20/120) * rawDt`.  The pickup is a slow object on the road — its own top speed is 20 mph, so at 100 mph you close on it at ~80; if you stop, it stops.  (Was `player.speed − 20` = a 20 mph *relative* closing, which made the sprite physically barrel downroad at 80 — Brendan saw that as "way faster than 20.")  Still **Easy-mode only** ([GameScene.js](src/scenes/GameScene.js) `_updateDrugDrift`, gated `Difficulty.mode()!=='easy'`).  If Brendan wants the cap in all difficulties, drop that gate.

**PORTABLE SAVE — shrunk ~58 → ~32 chars + new entry/display UI.**  `_encodeSnapshot`/`_decodeSnapshot` rewritten from dot-delimited base36 to a bit-packed **base64url** buffer (case-SENSITIVE — copy/paste flow, so fine) with a 12-bit checksum via new `_bitChecksum(bits)`.  Field widths are fixed; `owned`/`unlk` bitfields are sized dynamically off `Object.keys(VEHICLES).length` (8) / `Object.values(DRUGS).length` (10), so adding a vehicle/drug won't break it.  Round-trip + tamper-rejection verified by standalone node test.  `_saveChecksum` (old base36 3-char) REMOVED.  Entry popup `_buildCodeEntryPopup` is now a **DOM `<input>`** (paste-friendly, `autocapitalize/autocorrect=off`, NO uppercase — base64url is case-sensitive; both `submit()` and `_promptForCode` no longer `.toUpperCase()`).  RestStop save-code DISPLAY ([RestStopScene.js](src/scenes/RestStopScene.js) ~L572) now wraps at 13px monospace + **tap-to-copy** (clipboard w/ textarea fallback, "COPIED!" flash).  Same-device recall still uses the local `restStopSaves[code]` map; the long code / server is ONLY for cross-DEVICE transfer (explained to Brendan — local profile save already works same-device).

**CHATGPT BUG LIST — ALL RESOLVED:**
- **#4 "No Police" still ticketed** — trap witnessing now gated `!this._customFlags?.noPolice` ([GameScene.js](src/scenes/GameScene.js) ~L3338); the noPolice suppression block also drops in-flight trap state.  Friend's "speed trap ahead" texts KEPT (flavor — Brendan: "they can text you, there just don't have to be police there").
- **#5 slow vehicles taxed for being slow** — slow-driving score penalty threshold moved hardcoded **120 → 80 mph** for ALL vehicles ([GameScene.js](src/scenes/GameScene.js) ~L3650; `dispMph < 80`, ramp `(80-dispMph)/60`).  Slowest car tops at 110, so none is perpetually penalized.  (`_displayMPH` was already correct per-vehicle.)
- **#6 meth = instant death on scrapes** — meth's `+1` now only on DISCRETE crashes, not the 6 per-frame continuous scrapes (`isContinuousScrape` = `startsWith('offroad') || endsWith('_rail') || water_shoulder || tunnel_wall`), in `_applyDamage` ~L7628.  (Was +1/frame ≈ +60 HP/s on a rail.)
- **#7 fentanyl/cocaine never OD** — both OD checks (`pickup()` ~L365 + `checkOD()` ~L471 in [DrugSystem.js](src/systems/DrugSystem.js)) changed `>` → `>=`, so a maxed bar (threshold 1.0) ODs.  Fent (55%/hit) = 2 hits; cocaine ODs at full bar.  Heroin/meth/ket/rx unchanged (sub-1.0).  Alcohol/weed stay `canOD:false`.
- **#8 trap consumed without acting** — `sp.triggered=true` moved out of the unconditional top into each ACTING branch ([GameScene.js](src/scenes/GameScene.js) ~L3366); a parked trap blown past at 0★ while a prior civil stop is active is left un-consumed so it can still act after.
- **route length 293 hardcoded** — [main.js](src/main.js) `__playerMileFrac` now divides by `TOTAL_ROUTE_MILES` (was literal 293; dead `const TOTAL` removed).  No behavior change today.
- **1,900-sprite startup pool** — LEFT AS-IS.  Brendan: slow startup on localhost but fine on Cloudflare → it's the Vite dev server (unbundled modules), not the pool (identical runtime in both).

**Also fixed earlier this run:** #1 stars-on-resume (−1★ unless 5★, cops chase on sight), #2/#3 save cross-device + full state (the bit-packed code above).

**CONTINUED SAME SESSION (also shipped-but-UNPLAYTESTED):**
- **Task 1 steering retune** — `_steerRamp` (classic/default-dry only): ENGAGE `5→3.0` (slow load → a quick tap moves ≈ a quarter lane, not half), RELEASE `3.2→5.0` (fast unwind → drifts less). `TURN_SPEED` left at 2.8 so full-lock authority + the drunk beer-gravity counter-steer balance (GameScene ~L4903) are intact.  (Brendan first asked "20% lighter," then reversed: undo lighter, smaller per-tap move + less drift.)
- **Weapons now hit PARKED speed-trap / ambient cops.**  They were road ENCOUNTER sprites (`copEncounter` in seg.sprites), never in `this.cops`, so weapons passed through.  `useF12Token` refactored to a unified pool where every entry carries `pos`/`lane`/`isCop`/`src`; GameScene's new `_collectEncounterCops()` scans ±window around the player and passes them in (each with its home seg.sprites array as `src`), so a gun/rocket/spike destroys the trooper + escalates heat (`isCop:true` → escalateForCopKill) exactly like a cruiser.  Hit sprites are spliced out of the road.
- **Mute now FREES the audio session** (so the player can run their own Spotify/Apple Music).  `toggleMute` SUSPENDS the AudioContext (+ pauses the radio track) instead of only zeroing gain; unmute resumes.  Guarded every other resume site (`visibilitychange`, `play()`, `_enablePlayback`) with `!this.muted` so a refocus/START-tap can't re-grab the session while muted.  ⚠️ iOS caveat: full background-music MIXING also wants the native audio-session category set to mix-with-others — that lives in the `ios/` native project (generated by Capacitor, NOT in this tree), so do it next time you run `npx cap`.  (User picked "just fix mute," not a full Spotify integration / new setting.)

**CONTINUED 2026-06-14 (round 2 — playtest tweaks + radar feature):**
- **Cop density cut hard** — `_spawnTraffic` ambient-cop chance `stars*0.18 → min(0.25, stars*0.05)` (1★≈5%, was 18%).  AND the **−50% same-direction traffic cull was REMOVED entirely** (GameScene ~L5499) — Brendan: "there should be no culling of cars."  (That cull came from his own earlier "reduce same-direction NPC 50%" request; it was always-on, not 1★-tied.)  Full civilian density is back.
- **Music starts at 50%** — `AudioSystem` `this.volume = 0.20 → 0.50`.
- **Task 1 steering retune** (from round 1): `_steerRamp` ENGAGE `5→3.0`, RELEASE `3.2→5.0` (smaller per-tap move + less drift; TURN_SPEED untouched).
- **⭐ RADAR DETECTOR (new feature, fully built):**
  - **Acquire:** buy-once GLOBAL gadget, $1500, in the **HUNTING** shop (alongside NEW PASSPORT).  Injected/removed from `SECTIONS.hunting.items` in RestStopScene.create() based on ownership; `_applyPurchase` `p.radar` → `save.set('radarDetector', true)`.
  - **Persistence:** new global save key `radarDetector` (SaveSystem `GLOBAL_KEYS` + `DEFAULT_GLOBAL`).  Also added to the portable save code — **snapshot format bumped v1→v2** (1 radar bit after drugs); decoder accepts BOTH v1 (radar=false) and v2.  Round-trip re-verified (still 32 chars).  `_applyResumeSnapshot` is additive (a code with radar arms+persists it, never strips a device's own).
  - **Behavior:** `GameScene._updateRadar(rawDt)` (called after `_updateDrugDrift`).  When owned + not pre-start + not custom-noPolice: finds the nearest trap mile AHEAD within 0.5 mi (`road.segments.trapMiles`), and ALWAYS pings (no speed gate — Brendan: "people will always be speeding").  Escalating blip cadence (0.55s far → 0.10s at trap) via new `AudioSystem.playRadarBeep(intensity)` + a blinking red dashboard dot (`_radarGfx` at ~52,100) and "SPEED TRAP" label (`_radarLabel`).
  - Tunables: WINDOW 0.5mi, cadence 0.55→0.10s, beep pitch 760→1320Hz, dot pos (52,100).

**STILL TODO / NEXT (all of this batch is shipped-but-UNPLAYTESTED):**
1. **Playtest this batch** — drug-drift crawl, no-police ticket-free, slow-car penalty, meth-on-rail survivable, fent/coke OD at full, save code copy→paste on a 2nd device.
2. ~~**Harden the save load**~~ — ✅ DONE 2026-06-17. SaveSystem now sanitizes/repairs loaded v3 + migrated v1/v2 data and writes repaired v3 data back once. See 2026-06-17 addendum above.
3. Task 1 steer-ramp feel-test; Task 4 letterbox-fill (specs in older §8 entries).

---

### 2026-06-12 — earlier handoff (superseded by 2026-06-14 above; drug-drift note here is OUTDATED — see above)

Big multi-session run (2026-06-11→12).  Task 2 from the old handoff is DONE; lots more shipped; one near-disaster (corrupted save) recovered.  **Read this whole entry before touching anything.**  Lines drift — search by symbol name.

**BUILD / DEPLOY STATE (read first):**
- Working tree has LOTS of uncommitted changes (this + prior runs).  NOT committed, NOT deployed.
- Dev server: `npm run dev` = **HTTP :3000** (`DUI_HTTP=1`, **NO tilt** — iOS deviceorientation needs HTTPS).  `npm run dev:https` = **HTTPS :3000** (tilt works; self-signed cert → accept once).  BOTH now use :3000 with `--strictPort`, so only ONE runs at a time (changed dev:https 3001→3000 per Brendan).
- **`?wipe` URL param** (main.js) clears the localStorage save + reloads — RECOVERY for a corrupted profile.  **On-screen crash overlay** (main.js) prints uncaught JS errors (pink-on-dark) since Phaser swallows scene create/update throws into a silent black screen.  **KEEP both.**
- Deploy: `npm run deploy` (Cloudflare "dui" / dui-8hb.pages.dev) — confirm with Brendan first. [[ask_before_push]] [[project_dui_deploy]]
- Installed `playwright-core` (devDep) to capture console errors headless — but it loads past BootScene too slowly in software rendering to be useful here.  Remove if undesired.

**✅ DRUG-DRIFT RE-ENABLED 2026-06-12 — AWAITING Brendan's live-test.**  In GameScene `update()` the call is now LIVE again: `this._updateDrugDrift(rawDt);`.  The method `_updateDrugDrift` is the SAFE (accumulator) rewrite.  Its FIRST version did `sp.position += advance` — but **drug sprites have NO position field** (they're positioned purely by which segment's `seg.sprites` array they live in; both `_renderDrugSprites` and the pickup-collision project from the segment index, NOT sp.position) → `NaN` → threw in `update()` → corrupted Brendan's save → bricked the game (the disaster below).  The rewrite: per-sprite `_driftAccum += (playerSpeed − 20mph)*rawDt`, hops the sprite FORWARD whole segments (re-homes it in `seg.sprites`) so it closes on the player at a steady ~20 mph RELATIVE (Easy-mode + drug-type sprites only — no `sp.position`, can't NaN).  **LIVE-TEST:** Easy mode + drive >20 mph past drug pickups → they should creep toward you instead of holding still; watch for the crash overlay (should never fire).

**SHIPPED THIS RUN (don't redo):**
- **Grenade removed → 4 weapons** (gun/spike/donuts/rocket) + disguise.  Weapon column = 4 cells on the dominant-thumb edge; **DISGUISE is its OWN button on the OPPOSITE edge, under the Mute button** (auto-mirrors handedness via `_topRowButtons` mute anchor).  New `_renderF12Cell()` helper.  Old-hippie hitchhiker now gives 🍩 Donuts (was grenade).  Grenade also stripped from CopSystem (`useF12Token` case + comments) + AssetManifest (`weapon_grenade`).
- **Pedals raised** to clear the drug column (Brendan's Option B): `PEDAL_BASELINE_Y = 401` (gas top ~297, just under the 5-row drug grid bottom ~291); wiper baseline moved with it.  **Removed the bottom no-steer guard** (`PEDAL_BAND_TOP` — def + pointerdown + pointermove).  Added `overPedals` + `overDisguise` steering exclusions; `overWeaponCol` bounded to the 4-cell column height (`p.y > 50 && p.y < 314`) so the empty road BELOW the column steers (was blocking the whole lower edge).
- **MONEY now per-PLATE** (BUG: was per-(slot × steering-mode), so money changed when you switched tap/classic/tilt).  Moved to the slot GLOBAL bucket — SaveSystem `liftMoneyToGlobal()` one-time migration (lifts max per-mode balance up; runs in `_fillSlot`/`_fromV1`/`_fromV2`) + `get walletStore()`; Wallet.js reads/writes `walletStore.money`.  DEFAULT_GLOBAL deliberately omits `money` so the `undefined` check drives the one-time migrate.
- **Easy is the DEFAULT difficulty** (`Difficulty.js` `DEFAULT_MODE='easy'`).
- **Easy car speeds** (`_spawnTraffic`, Easy only): same-dir 80±5 (75-85), oncoming 50±5.  (Same-dir cars kept ≈as-is per Brendan; the real "20 mph" ask became the DRUGS → drug-drift above.)
- **Message popups +3s**: `_showPopup(text,color,holdSec=2.2)`; 📱 phone-texts + CHECKPOINT banners → 5.2s; pickup IDs stay 2.2s.
- **Driving WEIGHT = steer-INPUT ramp (option B)** — `_steerRamp` eases digital L/R toward the pressed dir (engage 5.0/~0.20s, release 3.2/~0.31s); classic/default-dry only (tilt+flappy untouched).  The earlier velocity-settle `weightScale` was REVERTED (he didn't feel it).  **AWAITING Brendan's feel-test/tuning.**
- **Car rim outline**: per-car LIGHT rim (`_carOutlinePool` built in the sprite-pool loop, drawn in `_renderVehicles`; tunables at top of `_renderVehicles`: `CAR_OUTLINE_COLOR=0xF2F5FF`, alpha .85, PX .045).  (Dark `0x0A0A0A` read "too dark".)
- **Traffic-stop hold → 15s** (`COP_TRAP_HOLD_SEC=15`, was 30).
- **iOS MENU-INPUT STRAND BUG fixed everywhere** — tapping a menu button that re-renders via `innerHTML` destroyed the touched node mid-touchend → iOS stranded the touch → DEAD game input (steering + buttons) after rotating back to gameplay.  Fix = DEFER the re-render one frame (`requestAnimationFrame`) so the node survives the gesture; the action stays synchronous.  Applied in index.html to: Crush "Text", Messages (contact rows / `msg-back` ×4 / Lawyer / Dealer), Leaderboard metric tabs, Music app (`renderMusic`→`_renderMusicNow` + `const renderMusic = () => requestAnimationFrame(_renderMusicNow)`), Garage car-select.  Settings toggles / Calendar / Achievements / Map were already safe (in-place / display-only / async).
- **GameOver robustness**: `GameOverScene._createBakedButtonEnding` now draws a visible fallback headline + RETRY/LOAD SAVE/MAIN MENU buttons when the plate art (`ui_end_busted_screen`/`ui_end_crashed_neon`) is missing — the real buttons are INVISIBLE hit-zones traced on that art, so a missing plate = black screen with un-tappable buttons (a trap).

**THE DISASTER (resolved, but note the lesson):** drug-drift v1 NaN crash froze `update()` and corrupted the localStorage save → game bricked (booted to BUSTED / black on retry, survived hard reload because the bad state lived in the save, not the code).  `?wipe` cleared the save and fixed it.  **Code is sound on a fresh save.**  Lesson: a thrown error in a Phaser scene = silent black screen; the `?wipe` + crash overlay are the tools.

**WHAT'S NEXT (Brendan to pick; recommended order):**
1. ~~**Harden the save load**~~ — ✅ DONE 2026-06-17. Self-heals corrupt/invalid save buckets instead of bricking; targeted corrupted-localStorage smoke test passed. See 2026-06-17 addendum above.
2. ~~**Re-enable drug-drift**~~ — ✅ DONE 2026-06-12 (call uncommented; see the DRUG-DRIFT callout above).  Code is live; **awaiting Brendan's 20 mph crawl live-test.**
3. ~~**Task 3 — rearview mirror touch-and-HOLD → zoom 150%**~~ — ✅ BUILT 2026-06-12.  `_setMirrorZoom(z)` recomputes `_mirrorBounds` from base size via the new shared `_mirrorGeom(mw,mh)` helper, redraws the frame (`_drawMirrorFrame`), and re-fills the SAME geometry-mask shape (`_refillMirrorMask` — never recreates `_mirrorMask`, so pool sprites keep their reference); the per-frame glass render + sprite pools follow `_mirrorBounds` automatically.  Press = hit-test the **base** mirror bounds (`_mirrorBaseBounds`, in the no-steer top band) → `_setMirrorZoom(1.5)`; global `pointerup`/`pointerupoutside` → `_setMirrorZoom(1)`.  **Awaiting device verify** (hold the top-center mirror → it grows to 1.5×, release snaps back; steering must stay unaffected).
4. **Task 1 feel-test** — drive Classic/Default, react to the steer-input-ramp weight (heavier/lighter; tune `STEER_RAMP_ENGAGE`/`_RELEASE`).
5. **Task 4** — zoom the world to fill the L/R letterbox bars (less sky, keep car gap, move no buttons) — architectural; scope with Brendan first (spec in 2026-06-10 entry below).

---

### 2026-06-10 — TASK QUEUE (Task 2 DONE; Tasks 3 & 4 specs below still current — superseded as the handoff by 2026-06-12 above)

Brendan restarted VS Code + opened a NEW chat to clear context. This is the pick-up point. **Do the four pending tasks in THIS ORDER: 2 → 3 → 4 → 1.** Specs + code pointers below. (Lines drift — search by the symbol names.)

**BUILD / DEPLOY STATE (read first):**
- Working tree has LOTS of uncommitted changes (this whole multi-session run). Not committed, not deployed.
- `dist/` is an **UNMINIFIED** build (phaser ~7 MB / index ~1.1 MB). The minified `vite build` **OOM-kills (exit 137)** under system memory pressure — it is NOT terser (vite.config uses the default esbuild minifier), purely low-RAM. **Free RAM (close apps/tabs) before a real build, and do NOT deploy the unminified dist.**
- Deploy (only after a clean minified build + Brendan's OK): `npx wrangler@3 pages deploy dist --project-name dui --branch main` → Cloudflare "dui" / dui-8hb.pages.dev. No wrangler login was found locally (whoami = not authenticated); needs `CLOUDFLARE_API_TOKEN` env or `wrangler login`. We have NOT saved any token. (Git push to `main` also auto-deploys via the GH Action — see [[project_dui_deploy]].)
- Dev server (`npm run dev`, HTTP :3000, LAN) may still be running. Phaser scene / index.html edits need a FULL reload (HMR won't hot-swap scenes).

**ALREADY SHIPPED THIS RUN (don't redo) — in src/ + index.html:** Donuts (15s cop-freeze, rear-only), steering rework + DEFAULT adaptive mode (out-of-box default), 1★ single-car pursuit, cop-ram→BUSTED, semis immovable, Custom-menu fixes (SNO-TIRE, dynamic damage text, FENTANYL/KETAMINE), menu MAPS app + all towns + Washtucna, full-bleed TUTORIAL carousel (JPGs in `assets/ui/tutorial_slides/JPG/`), iPhone-menu bg width-fit, safe-area FIT into #game-root (main.js applyOrientation re-fit), Vantage crosswind full-strength pull, cop on-screen size HARD-CAP (≈1.3× player width — `place()` maxW; lightbar matched), cops skip the drunk double-vision ghost, **TUTORIAL tile flashes gold on first-ever play until opened (`dui_tutorialSeen`)**, **trap cruiser survives 10 rams before it's wrecked (`cop._rams`, GameScene `_onCopCollision` rear branch)**.

---
**TASK 2 — Remove the GRENADE → 4 weapons + propose a clean HUD layout.**
- Keep 4 weapons: gun, spike_strip, paint_bomb (= "Donuts"), rocket — PLUS disguise. Grenade gone everywhere.
- Search `grenade` / `f12_grenade` / `weapon_grenade` and strip it from: GameScene `WEAPON_CYCLE` (static getter), `_baseWeaponType`, `_defaultSlotFor`, `_weaponLabels`, the firing-popup `labels` map, `isBomb` (becomes just `rocket`), `_drawF12Inventory` TYPES array; RestStopScene shop items; CopSystem `useF12Token` case + TOKEN_MAP; Road.js f12 icon draw; RouteData.js random-pickup table; AssetManifest.js texture; GameScene pickup-label map.
- Then LAYOUT: weapon icons live in `_drawF12Inventory` (TYPES order + `iconW/iconH/rowGap/xLeft/xRight/yTop`). Brendan's instruction was cut off — he said "On the LEFT side, move the disguise UP; on the RIGHT side, move ___ (unfinished)" and chose "you propose a 4-weapon layout." So: lay out the 4 weapons + disguise cleanly with disguise raised, free the vacated slot for thumb room, and ASK Brendan to confirm the right-side move. Don't move other HUD buttons.

**TASK 3 — Rearview mirror: touch-and-HOLD → zoom 150% (release = back).**
- Mirror built in GameScene ~`_buildHUD` (search `_mirrorBounds`): `mw=260, mh=56, mx=SCREEN_W/2-130, my=2`; `hudMirrorBg` (static frame), `hudMirrorGlass` (interior, redrawn each frame), `_mirrorMask` (geometry mask from `_mirrorMaskShape`), car/building pools. Render at ~`if (this.hudMirrorGlass && this._mirrorBounds ...)` reads `_mirrorBounds` every frame via `projectRear`.
- Approach: store BASE geometry; add `_setMirrorZoom(z)` that recomputes `_mirrorBounds` (×z, stay centered at top), redraws `hudMirrorBg`, and re-fills `_mirrorMaskShape` (clear→fillRect at the new glass rect; the geometry mask follows it). Add an interactive rect over the BASE mirror bounds: pointerdown→`_setMirrorZoom(1.5)`, global pointerup→`_setMirrorZoom(1)` ("as long as you hold it"). IMPORTANT: the steering pointerdown handler (~search `overTopButtons`) must NOT also steer when you press the mirror — verify the top-center mirror area is in the no-steer zone (it checks `overTopButtons || overWeaponCol`); add a mirror exclusion if needed.

**TASK 4 — Zoom the WORLD to fill the L/R black bars (the hard one).**
- The black bars are the **FIT letterbox**: the game canvas is 800×450 (SCREEN_W/H, constants.js) and FIT pillarboxes the sides on a wider phone (main.js scale = FIT into #game-root). A world-camera zoom alone fills vertical (less sky) but CANNOT fill the L/R letterbox (it's outside the canvas).
- Brendan wants: "driving/road visuals zoom in and fill the black space, showing LESS SKY, KEEP the current gap between the player car and the lower frame, and DON'T move any buttons." So two parts: (a) camera zoom-in (raise horizon / less sky) — see CAM in constants.js (`horizonY=225` etc.) + Road.js `getVehicleProjection`/`sampleSurface`; (b) fill the L/R bars — needs the WORLD to render wider than 800 while the HUD stays anchored to a central 800 region (an aspect/responsive-width change in main.js scale + how the road projects across the wider width). This brushes the 2026-06-07 safe-area FIT work. RECOMMEND: investigate first, then likely CONFIRM scope with Brendan (full responsive-width world vs. just camera-zoom + accept thin bars), because filling the letterbox without moving the HUD is architectural.

**TASK 1 — Driving feel: add WEIGHT / INERTIA.** (Brendan picked this over "gentler easing" / "less responsive.")
- Goal: the car takes a brief beat to START turning AND to SETTLE back to center — momentum-y, heavy (friend said it felt "too responsive and linear").
- Code: GameScene `_updatePhysics` grip-based lateral model (search `desiredLateral` / `TURN_SPEED`): the actual lateral velocity settles toward `desiredLateral` — slow that approach rate (engage delay) AND the return-to-center rate on release (settle delay). Also CarPhysics.js `_steerVel` lerp (`~0.12s` ramp to target / `~0.45s` bleed to 0) — lengthen for weight. TUNE SMALL and let Brendan feel it; this sits on top of the DEFAULT-mode steering rework + Vantage wind pull — don't break those.

---

### 2026-06-10 — PROPOSAL (NOT BUILT): Tutorial slide review — fill the "new player doesn't get the point" gap

Reviewed all 5 current V2 slides (read the art + text). Verdict: thematically solid and rest stops ARE already covered (slide 4) — so the original "needs to talk about rest stops" worry is mostly handled. BUT there's one big gap that likely explains "my friends don't get the point": **no slide teaches the actual CONTROLS / core verbs.** A new player can be told the fantasy without ever learning how to *steer, accelerate, or deploy a weapon*.

**Current 5 slides (one-line each):**
1. **THE RUN & THE BANKROLL** — goal (Seattle→Pullman, 293 mi), drugs fuel the run, pickups/chaos/risky driving pay cash, bank it for upgrades/repairs/lawyers.
2. **THE HIGH, THE LIMIT & THE MULTIPLIER** — each substance fills a meter + bends the drive; riding the edge pumps your score multiplier; max a meter = OVERDOSE.
3. **THE HEAT & THE LAW** — speeding ticket vs DUI, lawyer cuts fines, cops ram you, spikes/donuts as survival tools, 5★ → only Disguise/Paint Job/Passport cools you down.
4. **THE ROAD, REST STOPS & SURVIVAL** — weather (fog/rain/snow→tilt, wind→tap), hitchhikers, "every exit is different: shops, rest stops, fuel, repairs, upgrades, garage, supplies," mind gas+health, reach Pullman.
5. **YOUR PHONE, MISSION CONTROL** — the phone apps (Weather/Garage/Maps/Trophies/Calendar/Stats/Messages/Music).

**Gaps a brand-new player still won't know:**
- **CONTROLS (the #1 gap):** ACCEL/BRAKE pedals (bottom-right), the steering scheme they picked (THUMBS=L/R · TAP=one-button · TILT=lean · DEFAULT=auto-by-weather), and — critically — **tap a weapon icon in the side column to DEPLOY it** (gun/spikes/donuts/rocket/disguise). Nothing currently says "tap the icon to use it."
- **The party clock** (HUD timer, e.g. 38:50): what is it, is there a deadline? Never explained.
- **Pulling over at a speed trap:** the PULL-OVER / comply-vs-flee choice (brake to comply = ticket; run = +★). Slide 3 implies cops but not the action.
- **Save codes:** rest stops hand you a 5-char code to resume later — worth one line (it's how you continue a run).

**Recommendation:** worth a light revision — add ONE new slide + two one-line tweaks, rather than rewriting everything.

**PROPOSED NEW SLIDE — "HOW TO DRIVE" (insert as slide 2, right after the overview):**
> Text: *"Two pedals, one job: **ACCEL** and **BRAKE**, bottom-right. Steer with your pick — **Thumbs** (left/right), **Tap** (one button), **Tilt** (lean the phone), or **Default** (the road picks for you). Your stash of tricks lives in the side column — **tap a weapon to deploy it**: guns, spikes, donuts, rockets, a disguise. Cops on you? Brake to **pull over** and take the ticket, or floor it and wear the star. You're never out of moves."*
> Image idea: cockpit/chase shot with glowing callout arrows pointing at (a) the ACCEL/BRAKE pedals, (b) the weapon side-column with one icon mid-deploy (spikes dropping / donut smoke), (c) a small inset of the four steering icons. Neon-arrow "tutorial" styling like the existing slides.

**PROPOSED TWEAKS (existing slides, one line each):**
- Slide 1 or 4: add the **party clock** — *"The clock is your party in Pullman — it's always ticking, so every detour costs you."*
- Slide 4: add **save codes** — *"Every rest stop hands you a 5-char SAVE CODE — punch it in later to pick the run back up."*

**Open question for next session:** does the new slide warrant its own art (Brendan to generate, 1320×2868), or fold the controls callouts into an annotated version of an existing screenshot? Order would become: Run&Bankroll → How to Drive → High/Limit/Multiplier → Heat&Law → Road/RestStops → Phone (6 slides).

### 2026-06-07 — Session: power-line rewrite, daily-challenge objectives, desktop menu bridge, safe-area scaling, deploy tooling

- **Power-line wires rewritten** ([GameScene.js](src/scenes/GameScene.js) `_renderUtilityLines`). A power line is NOT a fence rail: the old pass sampled the road densely (`WIRE_STEP=14`) so the wire "followed the road surface like the fence rail" — it bent toward the road between poles and dove to the ground near the camera. Now wires span **pole-to-pole** in a SINGLE pass at the real pole pitch (`SPACING=61`): each pole's crossarm is an anchor (`wireA=p.sy−poleH·0.94`, `wireB=p.sy−poleH·0.90`), a straight line joins consecutive **same-side** anchors, and a side-switch / bridge / tunnel / water gap breaks the run. **Near-end continuation** extends from the nearest pole along the last span's perspective SLOPE, but **floored at the crossarm** (rises with perspective, never dives — that was the original bug + the user's whole complaint). **Pole-height cap raised `190 → SCREEN_H·4`** so a nearing pole keeps GROWING (top off the top, base off the bottom) like the rest of the roadside scenery instead of freezing at 190 px and sliding down the screen. (Iterated live with the user against a hand-drawn red reference line; `constant-Y` and `slope-extrapolate` were both tried and rejected before the floored-slope landed.)
- **Daily-Challenge OBJECTIVE LAYER built** ([GameScene.js](src/scenes/GameScene.js) `_dailyTracker` + `_gradeDailyObjective()`; imports `DAILY_BASE_REWARD`). Per-frame telemetry (peak drug, max stars, combo continuity) + event hooks (NPC-car hits, drug pickups + distinct types, OD flag in `_onOverdose`, barrier/off-road scrape classified in `_applyDamage`, cop takedowns in all 7 `_onCopCollision` splice sites). Graded at the end city for 14 objective types — `peak_drug` · `all_meters_zero_at_end` · `combo_whole_segment` · `hit_cars` · `never_starred` · `reach_stars` · `no_drugs` · `no_collisions` · `one_drug_only` · `no_barrier_scrape` · `kill_cops` · `survive_cities` · `all_available_drugs` · `crush_quarrel`(stub). PASS → flat **$5,000** added to score + "✓ CHALLENGE PASSED" popup; FAIL → reason popup; then auto-restart to title. **STILL TODO (next increments):** attempt-decay payout + per-profile completion save (lights the Calendar ✓ dots) · harder modifiers (OD-only drug filter, pickup ×N / NPC ×N density, rotating speed traps) · proper pass/fail result-screen UI. Stage launch + start-mods (start ★, pre-loaded drug levels) were already wired last session.
- **Desktop pause ↔ iPhone-menu bridge** (phones rotate to cross between gameplay and the menu; desktop can't). (1) `window.__isDesktop` + `body.is-desktop` via `matchMedia('(hover:hover) and (pointer:fine)')` ([main.js](src/main.js)). (2) `window.__phoneMenu.open()/close()` bridge that reuses the scene's `_togglePause` so audio/HUD side-effects match a SPACE pause. (3) Desktop-only green **"iPHONE MENU"** button in the PAUSED overlay ([GameScene.js](src/scenes/GameScene.js), via `_buildPauseButton`) → `open()`. (4) Desktop-only **"🔄 Rotate phone to enter gameplay"** button (`#phone-enter-gameplay` in [index.html](index.html), a body-level sibling of `#phone-menu` so its fixed pos isn't trapped by the menu's transform) → `close()`. (5) On desktop the menu renders as a **centered portrait phone frame** (`body.is-desktop.menu-locked #phone-menu` = `width:100svh·853/1844`, dim surround) instead of full-bleed; hit-zone math re-lays-out on open. (6) `__startOver` / `__mainMenu` also clear `menu-locked` so the overlay can't linger. All pieces gated behind `is-desktop` → phones untouched.
- **Safe-area auto-scaling** (fixes Android/Razr "can't see all the buttons"). The game already auto-scales (Phaser `FIT` — verified it can't crop, only letterbox), so the cause was edge hardware (camera cutouts / rounded corners / nav-gesture bar) overlapping the top HUD + bottom pedals. Canvas now mounts in **`#game-root`** ([index.html](index.html)) — a fixed box inset by `env(safe-area-inset-*)` — with Phaser `scale.parent:'game-root'` + `expandParent:false` ([main.js](src/main.js)). FIT now fits into the USABLE screen so edge buttons stay clear. Notch-less screens report 0 insets → byte-identical to before. iPhone gains tiny notch/home-indicator margins (user-approved "all devices").
- **Deploy tooling** — one-command **`npm run deploy`** → [scripts/deploy.sh](scripts/deploy.sh): sources gitignored **`.cloudflare.env`** (CF token + account id), `rm -rf dist && vite build`, then `wrangler pages deploy`. Token is now SAVED locally (gitignored, untracked) per user request — no more re-pasting. Deploys to **dui-8hb.pages.dev**.

### 2026-06-06 — Session: Donuts, steering rework, 1★ pursuit, semi fix, map towns, tutorial slides

Gameplay + UI pass across `index.html` / `src/`. **dist rebuilt UNMINIFIED** (system OOM at minify — see bottom).

- **iPhone menu bg** (`#phone-menu img.bg`): center-cover → **width-fit + top-anchored** (`width:100%; height:auto; top:0`; bottom clips). Hit-zone math + `?calibrate` handler switched to `scale = vw/imgW`, offX/offY = 0.
- **Paint Bomb → DONUTS** (rename + new behavior). No longer removes cars; now **freezes ALL cops for 15 s** — `CopSystem._donutPauseTimer` set in the `paint_bomb` `useF12Token` case, ticked in `update()`, per-cop freeze branch in the cop loop, proactive spawns suppressed while active. No kills / no heat (added to `isHeatlessWeapon`, removed from `isBomb`). **Rear-only, non-directional** single cycle slot (`paint-bwd`). Popup "🍩 DONUTS DEPLOYED!". Internal ids stay `paint_bomb`/`f12_paint`/`weapon_paint_bomb` (the art is already a donut box). All spelling unified to "Donuts".
- **Vantage crosswind pull** (`_updatePhysics`): now **full strength (−1 = a held left arrow)** and **reaches full within the first mile (131→132)**, held to 177, eased by 183. Decoupled from `_windStrength` so tree-sway/tumbleweed VISUALS keep the original 6-mi ramp.
- **Steering**: `_activeSteeringMode()` now **honors the player's pick** — `classic`/`flappy`/`tilt` **lock** that scheme (no weather switching); **`default`** = adaptive "switches with the weather" (snow→tilt when the sensor's attached, classic otherwise). DEFAULT added to BOTH pickers (Custom DRIVING TYPE — now 4 buttons, 60px/64-step — and the title wheel), made the **first button + out-of-box default** (`_steeringMode` fallback, title idx 0, Custom `drivingType` fallback all → `default`). `_setSteeringMode` handles `default` without tearing down an attached tilt sensor. **Game-start alert** in `_startGameplay` (fresh runs only): "🎮 <TYPE> STEERING — Handling changes with your control type".
- **Custom menu**: accessory **WINTER → SNO-TIRE**; **damage description toggles** "PLAYER CAR TAKES DAMAGE" ↔ "…NO DAMAGE" with the ON/OFF button; drug rows show full **FENTANYL / KETAMINE** (custom-menu `shortLabels` only — HUD bars keep Fent/Ket).
- **Cops**: rear-pursuit now starts at **1★ (a single car, cap=1)** — `_pickKind` `s<1`, spawn gate `stars>=1`, `cap = stars<2 ? 1 : …`. **Cop-ram to 0 HP → BUSTED** (wreck handler branches on `cop_*` damage source → `_onArrested`; non-cop → `crash`). `_onArrested` made **idempotent** (`_arrestHandled`, reset each init) so a ram that also trips the 5th rear-bump can't double-charge bail.
- **Semis immovable on rear-end/head-on** (`_onVehicleCollision` `rear-end` branch): added an `isSemi` exemption matching the sideswipe/corner branches — player bounces/scrubs to 60 mph (head-on still spins the PLAYER to the recovery lane), but the semi is **never spun/flipped/destroyed**. Fixes "hitting a semi knocks it over."
- **Maps**: confirmed Hatton is **geographically accurate** (real ~17 mi from Othello vs ~45 from La Crosse; mileages 184/205/253 agree) — left as-is. **Menu MAPS app** STOPS: added **Washtucna** + the other missing towns (Mercer Island, Bellevue, Snoqualmie, Easton, Thorp, Royal City) so it lists the full route; **Hatton synced to mile 205** + added its real waypoint `[205, 46.759, -118.825]`; added greedy label de-confliction for the Seattle cluster.
- **Tutorial app**: replaced "Coming soon." with a **full-bleed swipeable slide carousel** — V2 with-text JPGs in `assets/ui/tutorial_slides/JPG/` (user renamed the folder and moved the ~66 MB of unused PNG/variant exports out). `tut-mode` strips the app chrome: slides are **top-pinned + width-fit to the phone edges** (like the menu bg, bottom clips), floating close + dots, **"TUTORIAL" title hidden**.

**Build/deploy state:** minified `vite build` **OOM-kills (exit 137)** under system memory pressure (esbuild minify of Phaser — config uses the default minifier, NOT terser). Current `dist/` is an **UNMINIFIED** build (phaser 7 MB / index 1.1 MB) — functional but **do NOT deploy as-is**; run a normal minified build (needs more free RAM — close apps/tabs) before the Cloudflare `wrangler pages deploy`. **NOT deployed** (user deferred). Killed the 3 stale `vite --port` dev servers (didn't free meaningful RAM — the pressure is from other apps).

### 2026-06-06 — Daily Challenges / "Run of the Day" (Calendar app) — DESIGN SPEC (pre-build)

**Status:** registry + Calendar preview BUILT; stage runner / objectives / reward NOT yet. Build order: **foundation + Threshold → challenges 2–4 → the rest → Calendar UI.**

**Refined post-review (2026-06-06):** Canonical challenge data is now `src/systems/DailyChallenges.js` (15 challenges) — refer to it for exact segments/mods/objectives (the per-challenge lists below are the original sketch). Changes since the initial sketch: segments **redistributed across the whole route** so the eastern Palouse is covered (Othello→Hatton · Hatton→Washtucna · Washtucna→La Crosse · La Crosse→Colfax · Royal City→Othello · Colfax→Pullman); **only Bumper Cars** keeps Bellevue→Issaquah. **Crosswind** also forbids off-roading (not just barrier scrapes); **Collector** pickups **×0.8** (sparser); **Purist** = pick up **5+ of one kind** (that kind only). BUILT so far: `window.__daily` bridge (main.js) + a read-only **Calendar app** preview (index.html — no longer "Coming soon"); Play activates when the stage runner lands.

**Concept.** The phone's **Calendar** app becomes a daily-challenge hub. Each day = a **short stage** of **2–5 city "stops" (NOT the full 293-mi route)** with one trophy-style **objective**, set in a fitting region (region supplies weather/terrain/cops). Short stages = fast retries, which makes the attempt-decay economy feel fair.

**Reward economy (locked).** Unlimited tries; payout depends on the attempt you COMPLETE on:
`payout = max(0, 5000 − 1000 × (attempt − 1))` → try1 **$5,000** · try5 $1,000 · **try6+ $0 (still completes)**. Complete all **5** weekday dailies (Mon–Fri) → **+$5,000 weekly bonus**. Per-profile; cash banks like normal score. Even $0 completions still count toward the weekly.

**Decisions (locked):** unlimited tries (decay) · per-profile progress+rewards · catch-up allowed within the current week (resets Mon) · 5 dailies Mon–Fri · **v1 = objective-only** (no run-modifier spice, **no seeded route** — "lite"; route still randomizes per attempt) · **local** daily leaderboard now (per-profile) / global later (records already remote-ready).

**Architecture — 4 layers, ALL gated behind "daily-stage mode" so normal & custom runs stay 100% untouched (no balance / barrier / water disturbance):**
1. **Stage runner** — `{ startCity, endCity }`: reuse custom-mode start-at-city (CHECKPOINTS picker / `_resumeFromPosition`) + a NEW **stage-complete trigger** at the end city (instead of driving to Pullman).
2. **Modifier layer** — per-stage spawn overrides: drug density ×N + drug-set filter (OD-capable / all / one) + **pre-load a meter** (e.g. alcohol 95%); NPC-car density; speed-trap count + rotation; start ★; start HP/gas.
3. **Objective layer** — detection + completion trigger, reusing `drugSummary` (maxReached / canOD / pickupCounts), `CopSystem.stars`, a collision counter, combo-active tracker, crush state. Each objective defines its own trigger (mid-run vs reach-end-city).
4. **Reward layer** — attempt-decay payout + weekly bonus + per-profile storage (date → {completed, attempts, payout}; weekly-claimed flag).

**Cities (stops):** West Seattle(0) · Seattle(2) · Mercer Island(7) · Bellevue(10) · Issaquah(17) · Snoqualmie(26) · North Bend(32) · Snoqualmie Pass(45) · Easton(65) · Cle Elum(78) · Thorp(95) · Ellensburg(105) · Vantage(132) · Royal City(150) · Othello(180) · Hatton(200) · Washtucna(225) · La Crosse(250) · Colfax(272) · Pullman(279).

**BUILD GROUP 1 (first):**
1. **Threshold** — *Cle Elum → Ellensburg (3 stops)* — peak one drug to **90%** & reach the end with **no OD**. Mod: spawn **OD-capable drugs only**.
2. **Sober by the Line** *(Comedown)* — *Issaquah → North Bend (2 stops)* — **start with alcohol at 95%**; arrive at the end city with **all meters at 0%** (let it decay). Mod: pre-load alcohol = 0.95.
3. **Cocktail** *(Speedball)* — *Bellevue → Issaquah (2 stops)* — keep a **2-drug combo active the whole segment**. Mod: **drug density ×1.3** + combo-active tracking.
4. **Bumper Cars** — *Bellevue → Issaquah (2 stops)* — **total 15 NPC cars** & reach the end alive/un-busted. Mod: **NPC density up**; **DO NOT tune hit damage — leave collision damage as-is (per user)** + collision counter.

**BUILD GROUP 2 (the rest):**
- **Ghost** — *Ellensburg → Vantage (3 stops)* — clear it with **no cop ever hitting 1★**. Mod: **3 rotating speed traps**.
- **Outrun** — **start at 5★, survive 2 cities** (no death, no bust). Mod: set start ★ = 5.
- **Lover's Quarrel** — *Seattle → Snoqualmie (~5 stops)* — **ignore the Crush's texts for 3 stops** (ride annoyed→angry→silent), then **win her back with 2 texts** before the end. Uses crush state.
- **Crosswind Crucible** — *the Vantage gust stretch (2–3 stops)* — hold your lane through the wind with **no barrier scrapes** (tap-steering test).
- **+ Trophy-derived** (originals, each scoped to a 2–3 stop window with the needed mod): Teetotaler (no drugs), Defensive Driver (no cars hit), Collector (all available drugs — mod: more pickups), Purist (one drug type only), Most Wanted (hit 5★), Cop Killer (destroy 5 police — mod: more cops).

**CUT:** Strangers (hitchhikers), Last Drop (fuel/gas).

**Engine mods needed (additive, gated to daily-stage mode):** drug spawn density-mult + drug-set filter + meter pre-load · NPC spawn density-mult · rotating speed-trap spawner (count) · start-★ setter · start-HP/gas · stage start/end bounds · collision counter · combo-active tracker · crush-arc detection.

**Calendar UI (build last):** month grid; today lit with its challenge tag + live attempt # / current payout; week-completion dots + weekly-bonus progress; past days show result; future locked; (optional) practice-replay of past days (no board credit).

### 2026-06-06 — Utility powerline straight-span fix

- **Final powerline rule:** utility wires are **not fence rails**. Do **not** draw them with dense terrain samples (`WIRE_STEP=14`) or make them follow roadside curvature/elevation between poles. That old approach made the wires bend mid-span and dive toward the road near the camera.
- [GameScene.js](src/scenes/GameScene.js) `_renderUtilityLines()` now uses a single real pole-spacing pass (`SPACING = 61`, about 200 ft). Each projected pole crossarm is the wire anchor; straight line segments connect consecutive anchors. Side changes, rural fences, bridges, tunnels, and water break the run so wires never span across invalid regions.
- Pole height now keeps growing near the camera (`poleH = clamp(p.sw * 3.35, 4, SCREEN_H * 4)`) instead of freezing at the old 190 px cap. The old cap made a near pole's base continue downscreen while the crossarm stopped rising, which read as the wire lowering itself off the pole.
- Near-edge continuation starts from the nearest pole's crossarm and extrapolates only upward/flat toward the screen edge: `Math.min(prev.wireY, extrapolatedY)` floors the continuation at the pole height so it never drops below the pole it leaves. This keeps the wire attached and high as it exits frame.
- Keep fence rails separate: fences may sample terrain densely and follow the road surface; powerlines must remain pole-to-pole spans.

### 2026-06-05 (session 4) — weather pass (rain/fog/wipers), tumbleweed cross rework, heroin blackout, tunnel dim

On `steering-overhaul`; every change syntax-checked green (`node --check`), not full-built or pushed (held per user).

- **Heavier rain on the windshield** ([EffectsSystem.js](src/systems/EffectsSystem.js) rain branch). The persistent windshield-drop pool now obscures more: drop target ~244→~360 at storm peak, cap 260→380, spawn ~39→~60/s, body opacity 0.55→0.62 — so deep in the storm it's genuinely hard to see without wipers (still scales with `weatherInt`/severity so light rain stays light). Added a class of **big "runner" drops** — fat beads that race UP the glass trailing a tapering rivulet — on their **own spawn cadence** (a few/sec) so they appear independent of the drizzle.
- **Wipers ON now actually clears the glass** (same rain branch, keyed on `ctx.wiperActive`). The drizzle target/spawn are gutted while wiping (×0.12 / ×0.30) and each wiper sweep removes ~80% (was 45%) + shrinks survivors harder — so turning wipers on makes it *much* easier to see and keeps it clear. The big runners still spawn on their own cadence (×0.7 while wiping) so you keep seeing the occasional one streak through. (Wipe pulse only fires while wipers run, so wipers-OFF is untouched.)
- **Thicker fog (mile 14–25), thin-out at 25 unchanged** ([EffectsSystem.js](src/systems/EffectsSystem.js) fog branch + [Road.js](src/road/Road.js) distance fog). Screen-space horizon haze peak 0.60→0.80, milky veil 0.08→0.15, reach extended up the sky + down over the near road (UP 150→170, DN 240→300), mist wisps nudged up; Road distance fog pulled in a touch (exp 2.8→2.5, near-wash floor 0.12→0.20, kept gentle to avoid step-lines). Weather.js envelope untouched, so it still eases in 14–17, holds 17–22, lifts out 22–25.
- **Tumbleweeds finally cross the road, ~3 s, on a diagonal** ([GameScene.js](src/scenes/GameScene.js) `_renderTumbleweeds`). Root cause: weeds were world-anchored far out and rolled laterally on a fixed *time* basis, but the player closes ~10k Z in well under a second — so they were culled on the right shoulder before crossing. Reworked to a **~3-second life timer** (`crossSec` 2.7–3.5 s, `u`: 0→1) that drives BOTH the depth-approach (relZ spawn→car plane) and the lateral cross (right shoulder→left), so the cross always takes ~3 s at any speed and never gets cut short. Because the weed closes slower than the player advances, its world-Z rises with the car ⇒ it also drifts **downroad in the player's direction** (the diagonal), and it finishes/culls at the car plane so it never rolls behind. Texture cycle changed to **1→3→2** (reads as a smoother tumble). (Iterated from a distance-mapped first attempt that "flew by too fast".)
- **Heroin full-close blackout → fully opaque** ([EffectsSystem.js](src/systems/EffectsSystem.js) vignette block). At the peak of a full-close nod the center black fill was only 0.92, so high-contrast world objects (a passing tumbleweed) bled through during the "blackout". Now `min(1, closeAlpha*1.25)` ⇒ pure black across the top of the nod, still ramping in/out. (Note: heroin is a NOD cycle — full blackouts on the full-close nods, tunnel-vision between; not a constant blackout.)
- **Tunnel ambient dim — ~40%, quick fade** ([GameScene.js](src/scenes/GameScene.js) new `tunnelDimGfx` + `_renderFrame` ease). A dedicated full-screen black layer at depth **9.85** (above the tunnel shell 9.82 so it dims walls/ceiling/pavement, below the player car 9.95 + HUD/vignette 11+ so those stay lit) eases its alpha toward 0.40 when `road._cameraInTunnel`, 0 when not, over ~0.3 s — so entering/exiting a tunnel is a quick fade, not a lighting flip. Replaced an earlier masked 25% fill in `renderTunnelOverlay` (which snapped on/off with the mask). Applies to both road tunnels (Mt Baker ~mi 5, Mercer Island Lid mi 7). Knobs: `TUNNEL_DIM_MAX` / `FADE_SEC`.

### 2026-06-05 (session 3) — local House Leaderboard (cross-player, switchable metrics)

On `steering-overhaul`; syntax/parse-checked green (`node --check` on main.js, all 3 inline `<script>` blocks in index.html parse), not full-built or pushed (held per user).

- **House Leaderboard — the 3 player profiles ranked against each other on-device** ([main.js](src/main.js), [index.html](index.html)). The LEADERBOARD phone-app already showed the active player's Personal Bests + their top-10 Your Runs; the old **"World Records — coming soon"** stub at the bottom is replaced with a real cross-player board.
  - **Data:** new `window.__stats.house()` getter reads **all three save slots directly** (`save.data.slots`) **without switching the active slot**. One row per profile with `bestScore` / `fastestCompletionSec` / `mostMilesRun`, sourced from each slot's `global.stats.records` (StatsTracker keeps it current) with a defensive fallback to that slot's `leaderboard.runs`. Only created players (non-empty plate) plus the active slot are included; returns fresh plain objects so the menu can't mutate save state.
  - **UI:** three metric tabs — **Score / Time / Miles** — re-rank the board in place (tap handlers re-bind every render because `openApp` rebuilds `innerHTML`). Rows ranked `#1…#3` by license plate; the active player's row is highlighted (`lb-me`) and tagged `(you)`. Profiles with no data for the selected metric drop to the bottom dimmed with "—" (e.g. a player who's never *completed* a run shows "—" on Time but still ranks on Score). Personal Best + Your Runs sections unchanged; the global-coming-soon line stays as a footnote.
  - **CSS:** pill tabs (`.lb-tab`/`.lb-tab.on`) + active-row highlight (`.pa-row.lb-me`) in the existing blue `.pa-*` palette.
  - **Still local-only** — the *world/global* leaderboard (server + remote submit) remains on the pending list (Tier 3); the record shape was already designed remote-ready, so flipping the backend won't touch the save buckets.

### 2026-06-05 (session 2) — cop/ticket rebalance, speed-trap UI, finish-loop fix, scenery floats, Space Needle, tumbleweeds, music, icons

All on `steering-overhaul`; every change syntax-checked green (`node --check`), not yet full-built or pushed (held per user).

- **Wanted-level rebalance** ([CopSystem.js](src/systems/CopSystem.js)). (1) **City-line decay softened**: `clearStarsAtStateLine()` now `reduction = cur >= 4 ? 0 : 1` — crossing a town drops 1★ at 1-3★ and is FULLY IMMUNE at 4★ AND 5★ (was graduated 2/1/0). (2) **Cop-kill rule changed to +1★ PER cop killed** (two cruisers in one blast = +2★), capped at 5 — SUPERSEDES the old "weapon kill jumps to min 4★". The inline escalation is now reusable `escalateForCopKill(playerPos, kills)`. (3) **Weapon pulled during a 0★ parked speed-trap stop = flat 2★** (user-picked) via new `weaponPulledAtTrap()` — un-parks the trap pursuer to a live chaser and SETS stars to 2 (set, not add, so spikes "killing" the trooper-behind can't double-stack).
- **Traffic-stop fines → % of cash with $ caps; DUI bust → restart, not game-over** ([GameScene.js](src/scenes/GameScene.js) `_issueTrafficTicket`, [constants.js](src/constants.js)). Fine = fraction of current score capped at a ceiling: **speeding 50% up to $300** (`COP_TICKET_SPEEDING_FRAC`/`_CAP`), **DUI 100% up to $10,000** (`COP_TICKET_DUI_FRAC`/`_CAP`); lawyer waives speeding, halves DUI. (History: flat $400/$1500/$750 → briefly 10%/30% → now this.) The **"can't afford the fine" bust is REMOVED** (a % is always payable). The **suspended-license bust (2 DUIs / 50 mi) no longer ends the game** → `_bustBackToStart()`: shows the BUSTED screen 5 s then `scene.start('Game', { skipTitle: true })` = fresh rolling run at mile 0 (resets cash/HP/mileage; `_bustingToStart` flag freezes `update()` during the hold).
- **Speed-trap on-screen UI — below-mirror sign, no emojis** ([GameScene.js](src/scenes/GameScene.js) `_trapSign`). Comply window → alternating **SLOW DOWN** (red) / **PULL OVER** (blue) every 0.5 s; pulled over → **TRAFFIC STOP** + seconds remaining only. Replaced the old one-shot popups (trigger / "30s pause" / per-second banner) and stripped emojis from the remaining trap notifications (warrant / slipped / failed). The sign + flashing cop-light bands are cleared on pause-entry (`_togglePause`) so a stop pauses to a clean PAUSED screen instead of freezing the visuals on top.
- **End-of-route loop FIXED** ([GameScene.js](src/scenes/GameScene.js) `_updatePlayer`). Player position was `% (ROUTE_SEGS*SEG_LENGTH)` — modulo-wrapping past mile 293 looped the run back to mile 0 (car rolling, HP intact) whenever the mile-289 finish trigger was missed (e.g. a lag spike). Changed to `Math.min(routeEnd, …)` (clamp) so the finish fires instead of restarting.
- **Scenery float / poke-through (Issaquah/Preston cluster homes)** ([RouteData.js](src/road/RouteData.js), [GameScene.js](src/scenes/GameScene.js)). Mile 13.25-25 suburban cluster now draws from `CODEX_ISSAQUAH_BUILDINGS` (right-sized eastside art + float-tuned per-texture `groundDrop`) instead of the oversized `WEST_SEATTLE_HOMES`. Added `codex_issaquah_*` to the `usesFarPerspective` set so they shrink/reposition past `DRAW_DIST` instead of pinning to the horizon (the swap had dropped them out of it → they floated worse). Added a **crest cull for structures**: `if (isStructure && proj.visible === false) continue;` — `allowClipped` is kept (so far/curve rows don't blink) but crest-hidden buildings no longer render THROUGH hills. (Diagnosis credit: user.)
- **Horizon haze band removed** ([Road.js](src/road/Road.js) ~L900). The 14px `palette.horizon` @0.82 strip just above the horizon was redundant (the sky gradient already paints down to `H()+14`) and cut a hard "shelf" seam across distant homes/trees in West Seattle and Vantage. Deleted; clean sky→ground horizon remains.
- **Parked speed-trap cop sprite** ([GameScene.js](src/scenes/GameScene.js), scoped to `cop_random_parked`). Now faces the road (`flipX` on both shoulders) and is **1.7× bigger** (`sizeMult` 1.4→2.38, max-size cap 0.18→0.306 of screen). Ambient/driving cops unaffected.
- **Space Needle** ([RouteData.js](src/road/RouteData.js), [GameScene.js](src/scenes/GameScene.js) profile). Offset `-3.0 → -1.5` AND profile `minOffset 4.80 → 1.5` (the 4.80 floor was clamping it to -4.80, so the offset change alone did nothing); bigger (`heightMult` 6→9, caps scaled). Still at mile 1.85.
- **Tumbleweeds** ([GameScene.js](src/scenes/GameScene.js) `_renderTumbleweeds`). (1) **Freeze/crash fix**: the pool held `this.add.image()` objects destroyed by the `scene.start('Game')` rest-stop restart but the array survived on the reused instance → `setTexture` on a dead Image threw "reading 'sys' of undefined" and froze the game on the first Vantage frame after a rest stop. Now nulled in create() so it rebuilds. (2) Weeds now roll **in front of** the car — killZ moved to the player-car Z plane (`PLAYER_VIRTUAL_Z − eyeForwardZ`) instead of the camera eye, so chase-cam weeds don't roll past/behind the car.
- **710 Oil rest-stop top-up: +15 → +2 HP** ([RestStopScene.js](src/scenes/RestStopScene.js)). The menu said "+10" but the code added 15; now a consistent +2 everywhere.
- **Music: genre playlists advance to the next genre** ([AudioSystem.js](src/systems/AudioSystem.js) `_onTrackEnded` / new `_advanceToNextGenre`). Each genre plays through all its tracks (no repeats) then rolls to the next station (wraps after the last). Manual station/track controls + the custom cross-genre playlist are unchanged.
- **Dead-code / asset cleanup.** Deleted stray `src/scenes/GameScene 2.js` + `GameScene 3.js` (unreferenced backup copies). Removed dead `ui_title_d/u/i` manifest entries ([AssetManifest.js](src/systems/AssetManifest.js)) that pointed at deleted files (caused "Failed to process file" + WebGL errors). **Icons slimmed to 512 + 32**: dropped the 16px favicon and the 192px manifest icon ([index.html](index.html) + [manifest.webmanifest](public/manifest.webmanifest)), deleted `favicon-16.png` + `icon-192.png`. Added a compressed **alternative logo** set from the stray 1024 source (now deleted): `public/icons/icon-512-alt.png` (490 KB) + `favicon-32-alt.png` — standalone, not yet wired in.

### 2026-06-05 — PHONK radio station, plate-modal width fix, reset-player music fix, speed-trap Stage 2-3 (ticket/DUI/bust), Hatton sign

- **Text fields vs. game keyboard (plate name "missing letters" fix).** Typing a plate handle dropped any letter that's also a hotkey — W/A/S/D/F/M/R/Q (Phaser `addKeys`/`addKey` capture → `preventDefault`), and digits/Shift+L etc. fired their on('keydown') game handlers mid-type. Fix in [main.js](src/main.js): global `focusin`/`focusout` on INPUT/TEXTAREA/contenteditable **suspends Phaser's keyboard** (`clearCaptures()` + `keyboard.enabled=false`) while a field is focused and restores it (`addCaptures()` + enabled) on blur — so every key reaches the field and no game action fires while typing. Covers the plate modal, code entry, and any future text input.
- **License-plate art — save slots + car rear.** 3 US state plates (WA/OR/ID) shipped at 480×218 (source 827×374 RGBA, originals in `Archive/runtime-image-originals/.../plates/`) at `public/assets/ui/plates/plate_{wa,or,id}.png`, manifest keys `plate_wa/or/id`. Slot 0/1/2 → WA/OR/ID (`PLATE_KEYS` in [GameScene.js](src/scenes/GameScene.js)). Title-screen "WHO'S DRIVING?" slots show the state plate art at the art's **true aspect (≈2.21:1)** — slots resized **137×62** (taller than the old 158×44 buttons, GAP 6) so 3 stack unstretched; the stack is **vertically centered between the top music/FF dock (~56) and the START/difficulty panel (350)** → Y0 = 104 (computed), shifted up from 150. **Every slot always shows its fixed plate** (used → handle in the number band, unused → "NEW"), gold-glow border on the active player. Handle text (title slots + car rear) has a **white contrasting stroke** (thickness 3) so it reads over busy plate art. (Iterated: first cut was aspect-fit-centred, then full-width-stretched per "as big as the buttons", then user asked for true aspect → taller slots.) Car rear: `_rearPlateImg` (the active slot's plate) sized to the painted plate area (`a.w` of car width, aspect-correct) behind the handle text (now fit to ~72% width = the number band; cream text background removed). Both registered on the world camera. Text-band offsets are first-pass — may need visual tuning.
- **Crush (the Girl) redesigned — relationship, not a cash faucet.** Old model: reply once + text every ~12 mi for +$1000 each (free money, no downside). New model (per user): texting is **free + once per town** (a town == a CHECKPOINT window); text her each town to keep her **warm**, skip a town and she cools to **"…"**, skip more than `GIRL_MAX_SKIPS` (4) towns **total** across the run and she **finds someone else** (gone for the run). Reward is **no per-text cash** — instead a **party payoff** (`GIRL_PARTY_BONUS = 15000`) at the Pullman finish if you arrive still together (not gone, texted ≥ once). Logic centralized on GameScene (`_girlStatus` / `_girlText` / `_girlOnNewTown`, hooked in the checkpoint loop + finish block; `_girlTextPending` per-run flag); `window.__girl` is now a thin pass-through (old `respond()` + cash constants removed). Save keys (`girlResponded` / `girlTexts` / `girlSkips` / `girlGone`) reset on a **fresh** run only (`!_resumeFromStop && _resumeFromPosition == null`, i.e. New / Start Over / Retry — NOT a checkpoint/rest-stop resume, which continues the same trip). **2026-06-05 refine:** the crush is now **gender-neutral** ("The Crush", they/them — all player-facing text; internal `_girl*`/`girl*` names kept for back-compat). Added an incoming **message thread** (`_girlThread`, shown in the Messages app + road notifications): skip 1 → annoyed text, skip 2 → angry text, skip 3-4 → silent "…" bubbles, skip 5 → gone; and a **3-town texting streak** (`_girlStreak`) earns a miss-you reply ("people keep asking me to go to their party instead"). Buddy threads (`_buddyThreads`: friend/ex/mom/boss/unknown/spam) already reset every `init()`, and traps re-randomize per game (`new Road()` → `buildRoute()` → unseeded `Math.random`), so **the Friend already repopulates with this run's new cop/trap locations** — verified, no change needed there. **2026-06-05 follow-up:** per user, the **Lawyer retainer** (`lawyerRetained`) and **Dealer orders** (`dealerOrders`) now reset on the same fresh-run guard too (re-hire the $15k lawyer / unfilled orders don't carry over — fits the per-run economy). Both are per-slot save keys with no stale cache (`RestStopScene` re-seeds `_dealerOrders` from the save in its own `create()`).
- **METAL genre added (10th station) + two singles.** 6 Metal tracks (`Archive/Music/Metal/`) compressed to the house spec (96 kbps CBR / 44.1 kHz / stereo, album art stripped) into `public/assets/music/metal/`, originals archived under `Archive/runtime-audio-originals/.../metal/`. Wired `METAL` into `STATION_TRACKS` + **appended** a METAL station to `STATIONS` (index 9, color `#9FB2C4`, 150 bpm, silent procedural fallback) — appended last so PHONK stays index 0 (default) and no other indices shift. Also added two singles (same compression): **Party Run** → `phonk/party_run.mp3` (PHONK now 8 tracks), **Siren's Call** → `classic_rock/sirens_call.mp3` (CLASSIC ROCK now 8). Note: the Metal folder's own `Siren's Call.mp3` is a *different* song from the Classic-Rock `Siren's Call (Classic).mp3` — both shipped to their respective genre folders. Genre grid is data-driven, so METAL appears automatically. The radio is now the "10-station" set the overview references.
- **Floating-houses — PER-SPRITE CREST CLIP (the real fix, 2026-06-05 session 4).** Replaces every prior screen-space-band attempt. Instead of painting terrain *over* the sprites (which always cut a horizontal band), each structure sprite now **clips its own bottom to the hill silhouette in front of it** — the part behind the crest is simply not drawn, so a house beyond a crest reads as poking over the hill instead of floating. Three pieces, all keyed off the existing surface-sample cache:
  - **[Road.js](src/road/Road.js)** — new `_crestMinY` Float32Array (constructor) + a per-frame **prefix-min of terrain silhouette screen-Y**: `crestMin[n]` = highest painted ground (min `screenY`) among VISIBLE, **flat-or-climbing** samples strictly nearer than boundary `n`. Built right after the `_surfaceSamples` visibility pass.
  - **Grade guard reused:** only segments with `gradePct > CREST_MIN_GRADE (-0.004)` contribute to the silhouette — a steep **descent** (West Seattle hilltop) gets a downhill pitch-boost that projects nearer road *above* far road (a looking-down artifact, not a hill), and letting it in would slice the bases of houses down the slope (the old reverted bottom-crop failure). Descents never occlude.
  - **`crestClipY(relativeZ)`** returns that silhouette Y for any depth (O(1) lookup).
  - **[GameScene.js](src/scenes/GameScene.js) `_renderSceneSprites`** — for each structure (skipping authored far-perspective art: cranes / Space Needle / city skyline), if `crestClipY(relZ) < proj.sy − 6` (a nearer crest clearly above the true ground line), crop the texture to keep only the TOP via `setCrop(0,0,baseW,visibleTexH)`; with the bottom-centre origin (0.5,1) the visible bottom edge lands exactly on the crest line (the sink-crop "flies up" behaviour, used here on purpose → no compensating shift). Whole-sprite-behind-crest → `setVisible(false)`. The existing `proj.visible===false` full-cull (fully-hidden bases) is untouched; this only fixes the visible-but-floating remainder.
  - **Why this is allowed despite the old "do NOT use visible-based hill occlusion" rule:** that rule was about *band/painting* approaches and naive crops that sliced flat-ground bases. This clips per-sprite against a real, grade-guarded silhouette and only when the crest is genuinely above the ground line, so flat/climbing terrain never triggers it. Awaiting in-game verify across West Seattle / Preston (~mi23.5) / Vantage (~mi132).
- **Floating-houses foreground-occluder attempt — TRIED & REVERTED 2026-06-05 (superseded by the per-sprite clip above).** Replayed the near-crest segment geometry (road+sidewalks+terrain) into `crestFrontGfx` at depth 7.8 (below cars) to occlude distant houses behind crests. In practice it **masked the houses' lower halves → "roofs floating"** (a band at the crest's screen-Y can't read as a hill in front of the whole sprite). Root cause found later: `_drawSegment` paints a full-width grass rect with a **60px minimum** (`grassH = Math.max(60, segH)`), so replaying any far crest segment stamped a 60px full-width band over the houses. Fully reverted (and the whole green-rect crest-occluder system was removed). Lesson that stuck: **do NOT solve this with a screen-space band** — clip per-sprite instead (done above). (Depth IS distance-based: `9.5 − relZ/76000·2.5`.)
- **Phantom green horizon band fixed (crest occluder grade guard).** The dark/green band cutting across distant houses at **West Seattle (mile ~0.18)** and **Vantage (~135)** was the **crest occluder layer** (`crestFrontGfx`, depth **9.65** — the one layer ABOVE scenery sprites, so it genuinely paints over houses), not the ground/house art. `renderCrestOccluder()` paints a full-width opaque grass rect ([Road.js](src/road/Road.js) ~L4293) for each entry in `_crestBands`. Those bands were emitted purely from screen-space culling ([Road.js](src/road/Road.js) ~L1313); on a steep **descent** (West Seattle hilltop 350→290 ft over mile 0-0.6; the Ryegrass→Vantage drop) perspective trips the cull and emits a phantom band. Fix: added a **grade guard** — only emit a crest band when the crest segment is flat-or-climbing (`curr.seg.gradePct > CREST_MIN_GRADE = -0.004`); descents never emit. Real over-crests (Snoqualmie summit, Palouse rollers) still occlude correctly. (Diagnosis credit: user.) A first attempt that faded the distant ground into the horizon was reverted — wrong layer.
- **Semi-truck collisions — heavy + immovable.** In `_onVehicleCollision` ([GameScene.js](src/scenes/GameScene.js)): semis (`vClass === 'semi'`) deal **1.5× damage** (`classDmgMul`, alongside tractor's 2×). On a **corner clip or sideswipe** the semi is now **immovable** — it is NOT destroyed/shoved off-road; instead the player bounces away (larger `xImpulse` away from the rig) and is scrubbed down to **60 mph** (`SEMI_BOUNCE_SPEED = MAX_SPEED * 0.5`). Rear-ends into a semi keep the existing big-crash behavior (semi destroyed) but now at 1.5× damage — flag if you want rear-ends to be immovable too.
- **Finish cinematic.** Mile-289 finish parks the car in front of the Pullman Party House (~3s, input locked, eases to a stop while drifting left toward the house) before Game Over — on-time and late finishes both; `busted_late` technical loss stays instant. Constants `FINISH_PARK_SEC`/`FINISH_PARK_X`/`FINISH_PARK_LERP` in [constants.js](src/constants.js); logic in [GameScene.js](src/scenes/GameScene.js) (`_finishCinematic` state, speed/steer override in `_updatePlayer`, timer→`_endGame` in `update`).
- **Per-car phone-menu skins.** The portrait iPhone-menu now swaps its background art to match the selected vehicle. 8 skins (one per car) live at `public/assets/ui/iphone_menu_bg_<carId>.png` (sources in `Archive/Images/iphone menu/`, all **853×1844** — same icon/dock layout, different art, so the pixel-mapped hit-zones stay aligned per the §516 rule). [index.html](index.html): `setPhoneMenuBg(id)` swaps the `<img class="bg">` src (fallback to the shared `iphone_menu_bg.png` for any car missing a skin) and re-runs `layoutHitZones` on load; `syncMenuBg()` reads the current vehicle from `window.__garage.list()`. Hooked on garage **select** (instant re-skin), garage **open**, an initial best-effort sync, and **every in-scene vehicle swap** via `_applyVehicleSwap` → `window.__syncMenuBg()` (covers **custom-mode** car picks + mid-run unlocks). `syncMenuBg` resolves the driven car from `window.__garage.current()` (reads `registry.vehicleId` directly) so custom sandbox cars — which aren't in the OWNED list — resolve correctly (the first cut derived the car from the owned list and always fell back to the beater in custom mode). Loaded via the HTML `<img>` directly — no AssetManifest entries needed (those skins aren't Phaser textures). **To add/replace a car's skin:** drop an 853×1844 PNG at that path; if a NEW car id is added, that's the only filename to match.
- **Hatton rest stop finished.** Everything but the amenities placard was already wired (the §7 item was stale). The bake script [scripts/buildShoppingSigns.js](scripts/buildShoppingSigns.js) had its own inline REST_STOPS copy that **omitted Hatton**, so `sign_H.png` was never generated and Hatton sat in `STOPS_WITHOUT_BAKED_SIGN` (blank placard). Fixes: added Hatton to the inline list; repointed the script's source dir from `Images/` (moved) to **`Archive/Images/`**; added an optional **single-stop CLI arg** (`node scripts/buildShoppingSigns.js H`) so adding one stop doesn't regenerate the other 18; baked `public/assets/businesses/sign_H.png` (AOK camp + Huff's gas); registered `sign_H` in [AssetManifest.js](src/systems/AssetManifest.js); emptied `STOPS_WITHOUT_BAKED_SIGN`. Build green; sign present in `public/` + `dist/`.

- **PHONK radio station added + made default.** 7 source tracks from `Archive/Music/Phonk/` compressed to the house spec (96 kbps CBR / 44.1 kHz / stereo, album-art stripped) into `public/assets/music/phonk/`; full-quality renamed originals archived under `Archive/runtime-audio-originals/.../phonk/`. Wired `PHONK` into `STATION_TRACKS` + inserted it as **STATIONS index 0** in [AudioSystem.js](src/systems/AudioSystem.js) (color `#E11D48`, 145 bpm, silent procedural fallback like ARCADE). Index 0 is the default everywhere (`settings.radio` default, constructor `currentStation`, GameScene start-gate, ★ display), so PHONK is the default genre with no other changes; all other stations shifted +1. Realizes the §soundtrack "future PHONK station" note.
- **Plate-name modal width fix** ([index.html](index.html)) — the box was capped in px (`640px`) while its contents were `vmin`, so on large screens the text + CANCEL/DONE buttons scaled past the box and clipped. Box now `min(94vw,92vmin)` — scales with its contents at any size.
- **Reset-player no longer kills the music** ([main.js](src/main.js) `__settings.resetProgress`) — was a hard `location.reload()` (tears down the AudioContext → autoplay-blocked → silent). Now a soft `scene.start('Game', {})` (same path as `__mainMenu`) + `stats.reload()` + reset registry `vehicleId`; the AudioSystem lives on the registry and survives a scene restart so the radio keeps playing. SaveSystem slot getters mean Wallet/plate/leaderboard re-read the wiped slot for free.
- **Speed-trap Stages 2 & 3 — Stage 2 was already built; Stage 3 (the consequences) shipped today.** The held traffic stop previously just said "Ticket issued. Drive safe." with no effect. Now [GameScene.js](src/scenes/GameScene.js) `_assessTrafficStop()` snapshots the offense from the drug bars **at the moment of pulling over**, and `_issueTrafficTicket()` (at hold-end) applies it per the §7 spec: sober = $400 speeding ticket; intoxicated = $1,500 DUI + earnings ×0.75 for 50 mi (via `_scoreMult()` debuff). Limit = alcohol <20% AND each other drug <50%, or (4+ drugs active) every drug <10%. **Lawyer on retainer:** speeding → $0, DUI → $750, suspension threshold 2→3. **Busts → GameOver('busted'):** can't-afford-the-fine, or repeat-DUI (rolling 50-mi window, sober tickets don't count). New constants in [constants.js](src/constants.js) (`COP_TICKET_*`, `COP_DUI_*`); new `police` stat bucket + `recordTrafficStop()` in [StatsTracker.js](src/systems/StatsTracker.js) (auto-fills existing saves via deepFill) surfaced in the Stats app Lifetime section. Note: at ≥1★ no civil stop is offered (trap cop just joins pursuit), so the spec's "pull over with a warrant → busted" sub-case is moot by design. Build green.

### 2026-06-03 (continuation) — Career stats + leaderboard, Police 2.0 (built), Park & Ride + dealer/lawyer, settings suite, plus float / ramp / plate-picker fixes

All on `steering-overhaul`, build green, **not pushed** (held per user). This supersedes several §7 items that were actually built below (Police 2.0, phone-menu buttons, settings/leaderboard).

**Career stats system** ([src/systems/StatsTracker.js](src/systems/StatsTracker.js), registry `'stats'`)
- Canonical schema in the **global** save bucket (survives Start Over): lifetime npcHits / damage / miles / drive-time / trips / wrecks / gross-earned / total-spent / drugs+weapons collected; `earned.bySource` + `fromMultiplier`; `spent` by category & per-drug/weapon; `perVehicle`; `restStops`; `records` (best score, fastest trip, most miles, longest no-damage, top speed); encounter tallies (`hitchhikers{good,bad}`, `sexWorkers{total,bribes}`, `robberies{count,amount}`); `totalGameplaySec`.
- Hot-path methods mutate in memory; `flush()` persists at checkpoints (never per frame). Hooks wired across GameScene + RestStopScene.
- **Custom/sandbox** (`tripStart({ranked:false})`) accrues ONLY `totalGameplaySec`; everything else no-ops.
- **Money = persisted `GameScene.score`** via checkpoint snapshots; the `Wallet`/`profile.money` class is **vestigial** — don't "fix" it thinking earnings are broken.

**Phone-menu redesign** ([index.html](index.html), [src/main.js](src/main.js) bridges)
- New bg art `public/assets/ui/iphone_menu_bg.png` (853×1844); all hotspots `data-px`-calibrated. Steering-type selection **removed** from the menu.
- Apps: **Leaderboard** (personal best from `stats.records` + world-record placeholder), **Stats** (sectioned This-Trip / Lifetime / Records / by-source / spending / per-vehicle / rest-stops), **Settings** (volume, mute, units MPH↔KM/H, screen-shake, HUD toggle, haptics, **colorblind**, **Reset Progress** — wipes money/cars/checkpoints but KEEPS lifetime stats/leaderboard/trophies), **Get Help / Addiction** (real resources + donate, played straight — verify helpline numbers before ship), **Music** (neon restyle, default-station ★, working pause/play), **Messages = Contacts** (Lawyer / Dealer).
- Top weather widget: location name + simulated temp + weather symbol + game clock (corner). Unified ✕ close circle on every modal.
- Bridges added: `window.__stats`, `__settings`, `__location`, `__lawyer`, `__dealer`.

**Phone contacts** — **The Lawyer**: phone CALL, $15k retainer halves all future "busted" fines. **The Dealer**: order a drug (pay now from score), pick it up **FREE** at a Park & Ride.

**Park & Ride** ([src/scenes/RestStopScene.js](src/scenes/RestStopScene.js)) — new location at 6 spread stops (Mercer Is, North Bend, Ellensburg, Othello, Colfax, Pullman), NOT every stop; the Dealer meets you here (prepaid pickup). Brand `Metro Park & Ride` (logo key `biz_parkride` — needs art, blue fallback for now).

**Police 2.0 — BUILT** ([src/systems/CopSystem.js](src/systems/CopSystem.js), GameScene). Replaces the §7 "Police 2.0 / five-star" pending item.
- No passive DUI heat (an impairment-heat attempt was built then reverted per user).
- **1–3★ = a cop WITNESSING reckless driving**: roadside speed traps trigger +1★ when passed speeding (`> COP_TRAP_SPEED_MPH` = 70) or over the double-yellow/oncoming; brake under 70 & stay in lane → spared. Buddy texts a ~60% advance warning. All driving/collision star sources capped at 3★.
- **4–5★ = weapons on cops ONLY**: any cop kill escalates to 4–5★ (donuts/paint = neutral distraction) and grants a **3–5 mi pursuit grace** to reach a rest stop for disguise/paint/Park-&-Ride. Killing a cop never reduces heat. Cops already do 145 mph + slow-to-ram.

**Playtest fixes** — pause disabled on the title/ready screen; exit + amenities signs now collide for 10 dmg (dedicated hit-test mirroring the sign renderer); **snow windshield = real flake accumulation to whiteout, NEVER a flat white fill** (corrected twice); rain+snow fill full screen; road rain→snow transition gradual (~6 mi); NPC collision now fires when the debug boxes touch (player hit-test uses the sprite trapezoid).

**Float / ramp / picker fixes (latest)**
- **Homes no longer float (#2)** — measured per-PNG bottom-alpha padding (new `scripts/measure_grounddrop.mjs`, sharp) and set real `groundDrop` for every eastern/Issaquah home: weathered_house 0.179, barn 0.174, cle_elum 0.118, ellensburg 0.104, doublewides ~0.04, issaquah/fenced ~0.03. Full-bleed PNGs correctly stay at 0.010. Finishes the per-texture job previously done only for West Seattle homes. Render + collision share `groundDrop` so the hitbox base moves with the art.
- **Exit ramps Y off the mainline** ([Road.js](src/road/Road.js)) — the gore gap now grows with `rampStrength` (was frozen at full → detached "dead-end" strip). Width stays full/drivable (honors the 2026-05-30 "no taper" call). AND the ramp pavement only opens over the **last ~0.5 mi** ([RouteData.js](src/road/RouteData.js) `RAMP_TAIL_SEG`) so it peels off near the exit, not behind the mile-out green sign. After-exit merge untouched.
- **Mercer exit "too big"** — confirmed ramp params (1.25w width / 2.05w gore) are GLOBAL; nothing Mercer-specific. The Y-fix + late-open should shrink the apparent slab; awaiting playtest before any per-stop override.
- **License-plate picker lockup FIXED** ([src/main.js](src/main.js) `_blockGameTouch`, [index.html](index.html) `#plate-modal`) — root cause: native touch was `preventDefault`'d everywhere except `#phone-menu`, so on a touch device the plate input never focused (no keyboard → "can't type") and DONE was swallowed → looked frozen. Exempted `#plate-modal`, **added a CANCEL button**, bumped modal to z-index 10000.

**Soundtrack (creative, text-only)** — two original Phonk lyric sets for a future in-game PHONK station: **"I-90 DEMON"** (drift phonk, collecting the drug sprites across WA) and **"SMOKE & SPARKS"** (trap-metal phonk, the car falling apart stage-by-stage). Drop files in `public/assets/music/phonk/` then wire the station.

**Deploy state** — repo on `steering-overhaul` (not main); has `netlify.toml`, **no Cloudflare config**. Pushing triggers whatever's wired to the GitHub repo. Held pending user go-ahead + branch/platform confirmation.

### 2026-06-01→03 — Steering-overhaul branch: crosswind + tumbleweeds, phone-app pass (map / contacts / leaderboard / music), license-plate handle

Big multi-day session. Started with a **building-placement / floating cleanup** on `main`, committed a checkpoint (`d9a771f`) and **pushed → Cloudflare**, then branched **`steering-overhaul`** for everything after. All work below the checkpoint is on that branch and **NOT yet merged to main**.

**Building placement & floating cleanup** (on `main`, pre-branch)
- **Eastern WA home setback → 2.25** ([RouteData.js](src/road/RouteData.js) ~1517, `gapCars = isBusiness ? 1.18 : 2.25`) — fixes Royal City / Hatton homes *floating* at far perspective (the artifact was a near-edge-on-fog-line read, not a vertical lift). See memory `project_dui_eastern_home_setback_floating`.
- **West Seattle groundDrop right-sized per-texture** ([GameScene.js](src/scenes/GameScene.js)) — per-PNG `groundDrop` (0.102/0.086/0.010/0.010/0.086/0.096) so each home sits on its visible base, plus collision band `_bandBaseY = proj.sy + targetH*groundDrop` reaches the painted base, and homes set **≥0.5 car-widths behind the sidewalk line** (user's exact spec).
- **FOG_PROFILE_MULTS corrected** ([RouteData.js](src/road/RouteData.js)) — silos 3.20, freeway_sign_wind 4.20, doublewides 8.55.
- **Issaquah** — tree density boost in the mi14–25 corridor (200 vs 22 + bigBoost) and **anti-overlap spacing** for corridor homes/stores (`_lastCorridorStoreSeg`/`_lastCorridorHomeSeg`/`CORRIDOR_MIN_GAP_SEGS` ~0.15mi; `homeSlotsPerMile` 40→22) — fixes "Issaquah home inside a West Seattle home." User framed it simply as "space them out."
- **Shoulder-ribbon white-triangle fix** ([Road.js](src/road/Road.js) `_drawShoulderRibbons`) — rewritten to emit one filled polygon per contiguous-visible run, killing the white triangle slivers on hill crests / curves.
- **Removed dead procedural-homes branch** in RouteData (moot code).
- **Hill-crest floating — UNRESOLVED, all attempts REVERTED.** Preston (~mi23.5) and Vantage (~mi132) homes float above the crest. Tried cull-on-occlusion (whole house vanished), screen-bottom clamp (slammed down), bottom-crop (sliced WS building bases) — **every attempt reverted to baseline.** Established with the user that this is a **draw-order / architecture limitation**: ground renders at depth 0, scenery sprites at depth 7–9.5, so a sprite can't be occluded by the hill in front of it ("if a car drove in front of the house, would I see the house through the car?"). **Rule: do NOT use `visible`-based hill occlusion for sprites.** Left at baseline float pending a real layered fix.

**Steering overhaul** (branch `steering-overhaul`) ([GameScene.js](src/scenes/GameScene.js))
- **Default = classic L/R** (`_activeSteeringMode()` returns `'classic'`). Title-screen mode picker deferred (see the stoplight redesign in Pending).
- **Vantage crosswind** — `_windStrength(mile)` envelope (ramp-up mile 131, full by 137, holds ~40 mi). In `_updatePhysics` a leftward `_windPull` is applied **only when the player is not actively steering right** (`effectiveSteerDir <= 0.01`), so per the user **the right arrow completely overtakes the wind** — it is NOT a mode switch, just a lateral bias.
- **Tumbleweeds** (`_renderTumbleweeds`) — world-anchored, roll across the road **slow→fast** (sqrt cadence: ~1-every-5–7 s at onset → 1.5–3 s at full wind), round-robin through all 3 art frames (Tumbleweed1/2/3) to break monotony, **no spawns on bridges**, **0.25 damage** on hit.
- **Tree sway** (`_treeSwayRot`) applied at sprite finalize to tree sprites only.
- **Wind freeway sign moved to mile 132** ([RouteData.js](src/road/RouteData.js)).
- *(Deferred: snow → tilt / mouse-follow steering + device-detect + iPad permission prompt.)*

**Dev server HTTP/HTTPS split**
- [package.json](package.json): `dev` now `DUI_HTTP=1 vite --port 3000 --strictPort` (HTTP, default); `dev:https` → port 3001 (keeps `@vitejs/plugin-basic-ssl` for tilt testing).
- `~/Desktop/DUI Dev.command` rewritten to **prompt which server** (1 HTTP / 2 HTTPS / 3 Both) with LAN-IP detection; the `.app` delegates to it. (HTTPS is only needed for device-tilt, which requires a secure context.)

**Phone-menu app pass** ([index.html](index.html))
- **Map** — mileage label next to the player marker; **red-N compass needle** (replaced the old arrow); **NEXT REST STOP** panel on the right edge showing that stop's **business logos** stacked vertically under an underlined title, pulled from `public/assets/businesses/*.png` via a `BIZ_LOGO()` map (gas→cargo/huffs, hunting→cowbellas, camp→aok, dealer→lord/suck, drugs→pharmabros). `window.__restStops` bridge added in [main.js](src/main.js).
- **Contacts redesign (list → detail)** — replaced the flat Messages list. Rows: **The Girl**, **The Lawyer**, **The Plug**. The Lawyer is a **phone CALL** (📞), not a text thread (fixed from the earlier mistake of putting him in Messages). Dealer renamed **"The Plug."** **The Girl** invited you to the party: you must **reply** to her, and **texting her along the way pays a bonus** (`window.__girl` bridge — `GIRL_TEXT_BONUS`/`GIRL_REPLY_BONUS` 1000 each, every ~12 mi; persists `girlResponded`/`girlTexts`/`girlLastTextMile`).
- **Leaderboard** — added a **"Your Runs"** ranked section + **"#N of M"** on Best Score. Backed by **run-recording**: `StatsTracker.recordRun({score,miles,timeSec,completed})` now fires from `tripComplete` (completed) and `tripEnd` (bust), pushing into the `leaderboard:{runs:[]}` save (sorted by score, capped 50, gated by `ranked`). NOTE: this key was previously an **unused stub** — local rank works going forward; pre-existing saves start empty.
- **Music scrubber** — `#phone-music-now` time/progress bar with a draggable knob (`AudioSystem.trackProgress()` / `seekTrackFrac()` over the HTMLAudio element's `currentTime`/`duration`; `pmnTick` @250 ms; pointer-drag → `window.__music.seek(frac)`).

**License-plate name entry** ([index.html](index.html) `#plate-modal`, [main.js](src/main.js) `window.__plate`, [GameScene.js](src/scenes/GameScene.js) `_startGameplay`)
- On the **first-ever run**, just after START, a license-plate-styled popup asks the player for a plate — this is their **handle for the future global leaderboard**. Sanitized to uppercase `[A-Z0-9 ]`, max 8 chars, saved to save key `licensePlate`. `window.__plate` = `get`/`needsEntry`/`set`; the modal (`window.showPlateModal()`) shows once when `needsEntry()` is true. Enter or DONE submits; empty re-focuses.

**Discussed / deferred (not built)**
- **Global leaderboard** — plan is **Cloudflare Pages Functions** (serverless API in `/functions`) + **D1** (SQLite); user's part is ~3–4 setup commands. Deferred. License plate is the username groundwork.
- **"President Grump"** — agreed next game after DUI ships (rogue-assassin satire; fictional named character, legally fine). Saved to memory; remind when DUI is done.

### 2026-05-31 — App icon / PWA manifest + mountain treeline removal + drug-icon fixes

**PWA app icon + web manifest (home-screen install)** ([index.html](index.html) `<head>`, [public/manifest.webmanifest](public/manifest.webmanifest), [public/icons/](public/icons/))
- The site previously had **no** favicon / `apple-touch-icon` / manifest, so "Add to Home Screen" gave a generic/screenshot icon. Now wired end-to-end.
- Generated the icon set from `Archive/Images/Cars multipack_files/DUI App Icon.png` (1254², **opaque** synthwave art) via `sips`: `apple-touch-icon.png` (180), `icon-192/512.png`, `favicon-16/32.png` → `public/icons/`.
- `manifest.webmanifest`: name "DUI", `display:standalone`, theme/background `#000000`, 192+512 icons (purpose `any`).
- `<head>` adds favicon links, `apple-touch-icon`, `manifest`, `theme-color`, and `apple-mobile-web-app-title` "DUI".
- Decision: **synthwave art used everywhere**; the 2nd candidate (`App Icon.png`, a pre-rounded squircle WITH alpha) left unused — an opaque square is the correct `apple-touch-icon` source since iOS rounds corners itself. Vite copies `public/` → dist root on build; verified icons + manifest land in `dist/` and the built `index.html` references them. Not yet deployed (push triggers Netlify).

**Mountain treeline band removed (Snoqualmie Pass)** ([Road.js](src/road/Road.js) `drawPeak` ~864)
- The green "vegetation" wedge painted over each near peak's lower 18% (mile 45–70, `vegAmt`) overlapped into a continuous **green band on the horizon** at the pass. Per user, removed the wedge so each peak's base color (snowy `nearColor`/`farColor`) extends straight to the horizon — "mountains extend down further." Also deleted the now-unused `vegAmt` unlock var. Snow caps / outcrops / shading / pass-gap parting all unchanged. Only the mile 45–70 window is affected.

**Drug-icon load race — self-healing upgrade** ([GameScene.js](src/scenes/GameScene.js) `_drawDrugIcons`)
- Icons were lazily created **once**; if a drug texture wasn't ready at first draw (slow/cold phone load, or the 20s [BootScene](src/scenes/BootScene.js#L47) safety-timer force-start), a text-dot `•` fallback was cached **permanently** and never became the real logo. Symptom: intermittent missing drug logos, a *different subset each load*.
- Fix: per-frame **upgrade** — if a slot is still the dot fallback and `textures.exists(texKey)` is now true, destroy the dot and build the real image (extracted `buildDrugImage` helper; keeps `_hudObjects`/camera-ignore consistent).
- **NOT covered:** a genuine `loaderror` (iOS dropping a request under load) → BootScene substitutes a placeholder circle and never retries. A boot-loader retry / timeout placeholder-fill was offered but **not applied** (sensitive boot path — awaiting user go-ahead).

**Drug icons vanish after buying a car (custom mode)** ([GameScene.js](src/scenes/GameScene.js) init ~429)
- Rest-stop "continue" (including after a car purchase) does `scene.start('Game', …)`; Phaser reuses the scene instance, destroys all GameObjects and resets `_hudObjects = []`, but **`_drugIcons` kept pointing at the dead icon objects**. The lazy-create guard (`if (!this._drugIcons[id])`) then treated them as "already created" and never rebuilt them → invisible icons (the trailing `setVisible(false)` on dead objects is why it failed silently, not with a crash).
- Fix: reset `this._drugIcons = {}` on every (re)create, alongside `_hudObjects`. This matches the existing pattern for the other persistent keyed HUD caches — `_f12Texts` (reset to `null` @299) and `_drugGhostPool` (reset to `[]` @780); `_drugIcons` was the lone omission.
- Scope note: this actually affected **all** rest-stop resumes in custom mode, not just car purchases — buying a car is just where the user caught it.

### 2026-05-30 (latest+1) — Painted-edge invariant for buildings + ramp-clearance bypass

Continuation of the "Long thrash on roadside building parallax" session below. After ruling out the far-perspective `proj.sx` re-anchor (A/B-tested with `_isStructureForPerspective = false`), the user prescribed a precise render-time invariant: **the painted road-facing edge of every building/house must remain a fixed projected gap outside the projected road edge every frame, regardless of approach, steering, PNG padding, or per-region `roadScale`**. Sprite center is no longer the authority — it's *back-solved* from the desired painted edge.

- **`STRUCTURE_BBOX` lookup table** ([GameScene.js](src/scenes/GameScene.js):159 top-of-file) — `{ leftFrac, rightFrac }` per texture key, baked from PNG alpha-channel analysis (40 non-full-bleed entries from 75 textures scanned). Full-bleed PNGs (content ≥ 99.5 %) fall through to a `{ leftFrac: 0, rightFrac: 1 }` default. Generated by `/tmp/measure_bboxes.py`; regeneratable.

- **Painted-edge invariant** ([GameScene.js](src/scenes/GameScene.js) `_renderSceneSprites` ~10125) — opt-in via `sp.roadEdgeGapCars` AND `!sp.rampClearance`:
  ```
  centerX           = proj.sx − proj.roadHalfW × visualOffset
  roadEdgeX         = centerX + sign × proj.roadHalfW
  gapPx             = proj.sw × sp.roadEdgeGapCars
  desiredInnerEdgeX = roadEdgeX + sign × gapPx
  innerEdgeFrac     = sign≥0 ? leftFrac : (flipped ? 1−leftFrac : rightFrac)
  spriteCenterX     = desiredInnerEdgeX − (innerEdgeFrac − 0.5) × targetW
  ```
  The sprite is rendered at `spriteCenterX` (not `proj.sx`). Result: the painted edge is anchored to the projected road edge by a fixed gap measured in `proj.sw` units (i.e., car-widths at the building's depth). Per-frame motion of the painted edge tracks the road edge by construction; the per-PNG content fraction is baked into the spawn-time anchor; per-region `roadScale` divergences are absorbed because the gap is computed from the SAME projection that produces the road edge.

- **Collision rect synced** ([GameScene.js](src/scenes/GameScene.js):~4435) — when the invariant is active, `spL`/`spR` derive from `desiredInnerEdgeX ± paintedWidth` (painted bbox × targetW). Authority is the projected road edge, not `proj.sx`. The hand-tuned `collisionWidthFraction` (0.22 for `house`, 0.70 for `west_seattle_*`, etc.) becomes the legacy fallback path for non-structures.

- **`roadEdgeGapCars` set on every cycle-spawn building** ([RouteData.js](src/road/RouteData.js):1349) — was only set on `isResidentialFrontage` sprites; for Bellevue / downtown Seattle skyline buildings it was `undefined`, so the invariant's default of `1.0` was placing the painted edge ~3 car-widths closer to the road than the spawn intended. This was the **"building tracks toward the car HARD"** symptom in the earlier Bellevue screenshots. Fixed by always setting `roadEdgeGapCars: gapCars`.

- **All `_left` / `_right` suffix exceptions stripped** ([GameScene.js](src/scenes/GameScene.js):10028, 10121, 12248) — per user convention, **every scenery PNG is authored as a right-side building**. The `_left` / `_right` suffix in filenames is purely cosmetic. The renderer now flips any building/house with `sp.offset < 0` unconditionally; the painted-edge invariant's `flipped` flag is exactly `autoFlipLeft` with no exception branch.

- **Rest-stop ramp-clearance bypass** ([GameScene.js](src/scenes/GameScene.js):10133, 4514, 8938) — identified via the G-dump diagnostic (see below): inside the 1.3-mi ramp window around each rest stop (mile 9.5 Mercer, mile 12.5 Bellevue, etc.), the existing ramp-clearance block at `_renderSceneSprites` ~9957 mutates `visualOffset` from `~2.56 → ~5.42` to shove the building past the ramp gore. The painted-edge invariant uses this mutated `visualOffset` to compute `centerX = proj.sx − proj.roadHalfW × visualOffset`, which is mathematically consistent but anchors to a road edge that's far outside the viewport. The buildings end up off-screen (`renderX = 1257` on an 800-px screen) AND the invariant's frame of reference is wrong for the ramp gore geometry. Fix: skip the invariant when `sp.rampClearance` is true; the legacy ramp-push handles those sprites' positioning. Gated at all three sites — render, live collision, F3 overlay.

- **F2 painted-edge overlay (independent of F3)** ([GameScene.js](src/scenes/GameScene.js):641 + `_renderSceneSprites` per-sprite block) — dedicated `_paintedEdgeGfx` layer at depth 19, cleared per-frame, drawn into directly from inside the painted-edge invariant block using the SAME values the renderer applies. Lines:
  - **Yellow** — projected road edge at the building's depth
  - **Cyan** — actual painted inner edge (drawn taller, pokes out top/bottom)
  - **Magenta** — desired painted inner edge (drawn on top; if invariant holds, magenta sits dead-centre over cyan and you only see magenta in the middle)
  - **Dim cyan** — outer painted edge (back of the building's painted footprint)
  Toggles independently of F3 so the user can view only the lines, no blue frames / red boxes / labels. F2 was initially nested under F3; user pointed out this was wrong and the refactor split it out onto its own graphics layer.

- **G — telemetry dump** ([GameScene.js](src/scenes/GameScene.js):994 + `_renderSceneSprites` end-of-loop) — one-shot console.table dump of every visible structure's painted-edge math when the user presses G. Each row: `tex, sp_off, vis_off, sign, flipped, proj_sx, roadHalfW, centerX, roadEdgeX, gapCars, gapPx, desiredInner, targetW, bboxL, bboxR, innerFrac, renderX, n`. This is what bridges the **"I wish you could play this and see what I see"** asymmetry — the user pauses, hits G, pastes the table into chat, and I have exactly the per-frame numeric state needed to diagnose. The Mercer ramp-clearance bug above was identified in ~10 seconds from a single dump (rows showed `sp_off=2.562, vis_off=5.423` — 2.86-lane mutation traced to the ramp-push block).

- **B-key conflict** — initially bound as F2 fallback "in case some OS captures F2"; turned out the user had B mapped to game-go-back and it was clobbering. Removed; F2 is the only painted-edge toggle.

- **Verified behaviors per the G-dump**: for normal (non-ramp) Mercer left-side homes at varying depths, `desiredInnerEdgeX` is always strictly LEFT of `roadEdgeX` by exactly `gapPx`, depth-independent in lane units. For right-side: always RIGHT by `gapPx`. The "magenta in the road" perception remaining for distant left-side buildings is the natural perspective compression — at far depths the left road edge projects near the screen vanishing point (inside the near-road area from the player's viewpoint), so the line geometrically belongs at the road edge *at that depth* even though it visually overlaps the near road.

**Open**: the user reports the *near-distance* invariant holds well (residual motion is much reduced, no more crowding/encroachment, no ramp overlap), but perceives some remaining "movement" — likely the natural perspective effect of building scale growth on approach (outer edge expansion away from road) which the invariant intentionally does NOT lock. The horizon-backdrop approach remains the only path to a fully static row, with the tradeoffs of lost collision and lost approach depth.

### 2026-05-31 — Long session: pass-through city signs, NPC freight + farm equipment, HUD/signage overhaul, scenery polish, launcher app

**Signage pass.**
- New `PASS_THROUGH_CITIES` table in [constants.js](src/constants.js) — Preston (Exit 22), Kittitas (Exit 115), George (Exit 149), Endicott Rd. Starter set with a comment block listing more candidates the user can append. Spawned in [RouteData.js](src/road/RouteData.js) right after the rest-stop loop using `exit_sign_green` with `passThrough: true` — no `stopId`, no ramp paint, no amenities placard.
- Render diverged from rest-stop signs via `sp.passThrough`: yellow REST STOP plaque in Road.js gated off, "REST STOP" text in GameScene gated off, exit label switched to `MILE XX` (game mile) for pass-throughs / `Exit XX` (real WSDOT number or game mile) for rest stops.
- Non-I-90 rest stops swapped from highway-name labels (WA-262, WA-17, Airport Rd, US-195 S, WA-271 E) to `Exit <mileage>` — the shield badge already shows the highway so the text was duplicating it.
- `exit_sign_green` baseW/baseH bumped 4800×6600 → **6400×8800** with offset 2.0 → **2.4** to keep the wider face off the right travel lane. Font multipliers dropped ~20 % so PRESTON / EXIT 22 etc. fit inside the bigger frame.
- Town text raised: single-word at `signH * 0.45`, multi-line at `0.37 / 0.53` (centered between EXIT row and bottom border instead of sagging at the bottom).
- Highway shield nudged left (`padX 0.04 → 0.015`) to sit tight against the white border.
- Sign text threshold dropped `signW < 3` → `< 0.25` so green-sign text populates the moment the frame becomes visible, not after a "blank green rectangle on horizon" stage.
- Grade signs (TRUCKS USE LOWER GEAR / STEEP GRADE / etc.) bumped 2800×3400 → 4400×5400 for legibility at 120 mph.
- "NEXT EXITS" placard spawn suppressed — render code retained for legacy save compatibility, no sprites of this type spawned.
- Removed the per-segment EXIT chevron triangle and the right-shoulder delineator posts in Road.js — at game scale they stacked into white-hash-mark artifacts across consecutive segments instead of reading as discrete chevrons/posts.
- Off-ramp width is now **constant** within the window — `t = 1` always inside `if (seg.rampStrength > 0)`. Removed the smoothstep narrow→wide pull-out animation. Ramp opens at full divergence (1.25 lanes × 2.05-lane gore wedge) the moment rampStrength > 0 and stays that size through the after-window taper.

**Wind sign at Vantage (mile 137).**
- New asset `freeway_sign_wind.png` (1263×864 cantilever composite — pole on right, sign body hangs left over the road). Profiled in SCENERY_IMAGE_PROFILES + FOG_PROFILE_MULTS with widthMult 4.20.
- Spawned as a `building` sprite with `collidable: false` (the sign body over the road would otherwise crash the car); segment carries `windSignPoleSide: 1`.
- Pole-base collision mirrors `utility_pole` exactly — −10 HP, 1.5 s cooldown, crash-recovery handshake — with a separate `WIND SIGN POLE` popup. Logic block added in [GameScene.js](src/scenes/GameScene.js) right under the utility-pole check.

**Hatton multi-fix.**
- Asset `sign_H.png` does NOT exist on disk; amenities placard was rendering as a blank white frame. Introduced `STOPS_WITHOUT_BAKED_SIGN = new Set(['H'])` — skips the amenities-sign spawn for stops in the set. Green exit sign + ramp still spawn normally.
- Hatton exit label changed `WA-26` → `Exit 205` (the badge already shows WA-26).
- Hatton added to `_CP_RAW` (CHECKPOINTS) — the custom-mode location picker filters CHECKPOINTS, not REST_STOPS, so Hatton was visible on the in-game map but not in the start menu.
- Hatton added to `GEO_WAYPOINTS` at real lat/lon (46.759, -118.825) — previously it was being interpolated on the straight Othello→Washtucna line.

**HUD city label — last sign passed.**
- New `getLastSignTown(currentMile)` in [constants.js](src/constants.js) — scans REST_STOPS + PASS_THROUGH_CITIES for the latest sign whose `mileage − 1` is ≤ currentMile, returns that town name.
- GameScene's bottom-center label switched from `getLocationName(progress)` → `getLastSignTown(mileNow) || getLocationName(progress)`. Pass-through city signs now drive the HUD too — pass Preston's sign at mile 21 and the label reads "Preston" until Snoqualmie's sign at mile 24.

**Custom-mode location picker tail fix.** Denominator was `CHECKPOINTS.length - 1` but the picker filters out the `isFinish` entry, leaving a dangling line tail past the last dot suggesting more stops. Switched to `customStartCities.length - 1` so the last dot (Pullman) lands exactly at `mapRight` under the PULLMAN label.

**Issaquah / Snoqualmie scenery cleanup.**
- `RESIDENTIAL_FRONTAGE_GAP_CARS` bumped 1.25 → **2.75** — eastside homes were crowding the sidewalk and the tall codex_issaquah_highlands silhouette read as "floating" at far perspective because its near-edge sat almost on the fog line. (For reference: Mercer 3.00, West Seattle 3.50.)
- `addExitScenery` strip restricted to Seattle rest stop only. The Issaquah strip texture was spawning at every rest stop past Bellevue — at Snoqualmie (mile 25) it appeared as the apartment building "still blocking the exit". Per the prior `project_dui_bellevue_issaquah_swap` memory ("Issaquah fully bare"), it shouldn't have been there at all.
- **`rampClearance` push de-gated.** Was `if (rs > 0.30)` at three sites (renderer, live collision, F3 overlay). A home spawned at mile 24.14 sits in a segment whose own rampStrength is 0.14 — below threshold — so the push never fired and the home stayed at spawn offset all the way through the approach. Now always pushes to the FULL ramp extent (`1 + 3.30 = 4.30`) the moment a rampClearance sprite is rendered.

**E. WA Silos — hand-placed Vantage→Pullman.** 5 deterministic spots: mile 165 (Royal slope) R, 195 (Hatton coulee) L, 232 (Washtucna) R, 260 (Endicott) L, 280 (Colfax) R. Texture `codex_east_wa_silos` (1388×779) registered with widthMult 3.20.

**Doublewide tripled.** `widthMult 2.85 → 8.55`, `maxW 320 → 960`, `maxH multiplier 1.85 → 5.55` for both tan and white variants. Matched in FOG_PROFILE_MULTS so spawn placement uses the same effective width.

**NPC traffic — Eastern WA freight + farm equipment.** New assets in [AssetManifest.js](src/systems/AssetManifest.js): `car_back_codex_semi`, `car_front_codex_semi_red/green` (shared back, two front colors), `car_back_codex_tractor` (back-only, same-direction only), `car_back/front_codex_white_truck`, `car_back/front_codex_work_truck`. Full rewrite of vehicle-class selection in `_spawnTraffic`:

| Mile | car / white_truck / work_truck / semi / tractor |
|---|---|
| < 17 | car 100 |
| 17–52 | 90 / 6 / 3 / 1 |
| 53–69 | 82 / 8 / 6 / 4 |
| 70–136 | 70 / 10 / 8 / 12 |
| 137+ | 50 / 10 / 9 / 22 / 9 |

- **Semi**: 70 ± 10 mph same-dir, 60 ± 8 oncoming, `visualScale 1.35` (renders ~lane-wide). 50/50 red/green front. **Pair-spawn**: when a same-dir semi spawns east of Vantage, 35 % chance an oncoming semi also spawns within ±1500 units of the same Z — the "almost impossible to drive between" scenario.
- **White truck** / **Work truck**: highway speed vs 45 ± 5 mph slow contractor pace.
- **Tractor**: same-direction only (we only have a Back PNG — player always overtakes), 30 ± 3 mph, spawns at fog line (`laneOffset 0.95`), drifts sinusoidally between 0.95 and 0.75 every ~16 s. **Throttled by 10-mile cooldown** via `this._lastTractorMile` — a tractor roll inside the window downgrades to a semi. **2x damage multiplier** on all crash types (`classDmgMul = car.vClass === 'tractor' ? 2 : 1`) — hitting one is like slamming a small bulldozer.

**70 ft NPC follow distance.** `FOLLOW_DIST` bumped 1800 → **4250** units (≈ 70 ft at 60.76 units/ft). Spawn-conflict gate matched to 4250 so freshly-spawned cars can't appear closer than the in-traffic gap rule allows.

**Bush stick-and-roll-off.** Replaces the old "car blows through with light damage" shrub behavior. `_sceneryGlance` now sets `this._bushStuckUntil = now + 3000` and pops `🌿 BUSH STUCK!`. New cap in `_updatePlayer` (same shape as flat-tire cap) clamps `targetSpeed` to 40 mph while the timer is live. Lateral nudge + sprite kick stay the same.

**Snow windshield accumulation.** Two-layer model in [EffectsSystem.js](src/systems/EffectsSystem.js):
- `_wsSnowCoverage` (0–1) — opaque white pack covering the windshield rect, grows `0.20 × weatherInt × (0.6 + 0.4 × sevSnT)` per mile. Full intensity + peak severity → 5 mi to opaque (user spec).
- Wiper sweep removes 0.40 additive (3 sweeps clear a fully-covered windshield).
- Decorative `_wsSnow` flake particle layer kept for visual texture, scaled by `flakeFade = 1 − coverage` so flakes fade out as the pack thickens.
- Drains 6 %/frame outside snow zones; mile-tracker reset on exit so the next snow band restarts the 5-mi clock at 0.

**Power poles + wire treated like fog/fence line.**
- Pole offset 2.42 → **2.0** — close enough to read as shoulder, far enough that the closest visible pole doesn't appear to drop into the road as it nears the bottom edge.
- Per-pole scale `[0.93, 1.04, 0.97, 1.08]` + rotation `[0.010, -0.012, 0.007, -0.009]` variation mirroring the fence-post render, so poles read as natural wooden posts.
- Wire rendering split into two passes: **continuous ribbon at WIRE_STEP=14** (same cadence as fence rail) sampling the surface densely so the wire follows the road's curve exactly, plus pole sprites at the real-world **SPACING=61** (~200 ft) pitch. Resolved the "wire drops down at screen exit" — the single-pass 61-spacing draw cut straight-line shortcuts across road curves.
- Edge continuation: hold Y constant past the closest visible wire sample (matches fence rail continuation) so the wire still doesn't dive into the road at the screen edge.

**Phone-menu fixes ([index.html](index.html)).**
- Root cause for the "music / garage / maps / start-over / checkpoint / menu buttons do nothing" bug: `public/assets/ui/iphone_menu_bg.png` had been compressed from the original **1408×2641** to **819×1536**, but every `data-px` hit-zone coordinate was still authored against the 1408×2641 image. Bottom-row Y=2317 projected to off-screen dead space. Restored the original from `Archive/runtime-image-originals/`.
- The `data-action="menu"` button had no handler at all (separate latent bug). Added `window.__mainMenu` in [main.js](src/main.js) (uses `scene.start('Game', {})` the same way GameOverScene's "MAIN MENU" does); wired the hit zone with a confirmation prompt.
- Stale 819×1536 comment in index.html updated to 1408×2641 with a warning so a future image-compression pass doesn't clobber the alignment again.

**Amenities sign decal fade removed.** Threshold dropped `signW < 2` → `< 0.5`, decalAlpha forced to 1. Shield/brand logos now appear at the same instant the white frame does, eliminating the "white sign → blue sign with logos" pop on approach.

**Mac launcher app.** `~/Desktop/DUI Dev.app` bundle + `~/Desktop/DUI Dev.command` shell script. Double-click → opens Terminal, runs `npm run dev`, polls `https://localhost:3000/` every 0.5 s, opens the browser the moment Vite responds, leaves logs visible. Custom icon: melted pink steering wheel dripping into a cyan-bordered "DUI:LOCAL" server rack. Source SVG + iconset live under [scripts/](scripts/) — `dui-icon.svg`, `DUI.iconset/`, `DUI.icns`.

**Tunable hot-spots left in the working tree (callouts for future iteration):**
- Wind sign sprite offset `-0.30` — adjust if the pole base isn't landing exactly on the right shoulder.
- Semi `visualScale: 1.35` — bump if "almost a lane wide" reads too narrow.
- Spawn-class % tables — first big-volume drive will tell whether Eastern WA feels too truck-heavy.
- Silo offsets `±3.20` per placement.

### 2026-05-30 (latest) — Water-sink decoupled from guardrails (the working model)

**Design rule (locked):** the guardrails and the water-sink are TWO SEPARATE SYSTEMS and must stay decoupled. Never modify a barrier to make sinking work. The intended behavior: **bridges have guardrails (you cannot drive or get knocked off the bridge deck), but you CAN drive into the water on the open approaches BEFORE the rails, and the car sinks.**

**Guardrail = gap-less hard wall via `_preMoveX`** ([GameScene.js](src/scenes/GameScene.js) lateral-physics block, ~3490 capture + ~3560 rail block)
- Capture `const _preMoveX = p.x` at the END of last frame, before this frame's steering/impulse integration.
- The rail snap gates on `_preMoveX`, NOT the current landed `p.x`: `railsRightSide && p.x > BRIDGE_RAIL && _preMoveX <= SINK_EDGE` → snap to +0.95 (mirror left with `_preMoveX >= -SINK_EDGE`). If the car was ON the road last frame and tries to cross, it is BLOCKED no matter how fast it steered or how hard it was hit. There is no gap to slip through — you can't drive or get knocked off a railed bridge.
- If `|_preMoveX| > SINK_EDGE`, the car was ALREADY deep in the lake last frame (only possible by arriving off a NON-railed land approach, e.g. driving off Mercer Island onto the lake apron). The snap is skipped → scrape-damage → the dunk below sinks it. The rail never rescues a car that is already in the water.

**Dunk / sink** ([GameScene.js](src/scenes/GameScene.js) ~3730) — unchanged trigger: sink when on water past `DUNK_THRESH = 1.15`. `_bothSidedWater = seg.water || seg.bridgeWaterChannel`; plus `waterLeft` / `waterRight`. `SINK_EDGE` in the rail block must stay equal to `DUNK_THRESH` so the hand-off is seamless. A `!this._sinkState` guard skips the rail while the sink animation plays so it can't yank the sinking car.

**Geometry** ([Colors.js](src/utils/Colors.js) `REGION_ORDER`, [RouteData.js](src/road/RouteData.js)) — only the floating-bridge stretches are `lake_washington` (water:true → railed): Murrow 5.7–7.2, East Channel 9.8–10.2. Between them 7.2–9.8 is `mercer_island` LAND (no rail). A 0.10 mi `seg.water` apron is flagged before/after each bridge (~2318) — that apron is the unrailed water the player can drive into off the Mercer land approach and sink.

**Approaches that were tried and REVERTED (do not re-add):**
- Hard-rail every water segment → car couldn't sink (rail "replaced it on the bridge").
- Latched crash "punch-through" the rail (`p.punchThrough`, `PUNCH_IMPULSE`) — coupled the systems; removed.
- Band-gated snap `[0.95, 1.15]` keyed on current `p.x` — left a GAP: a fast steer/crash jumps past 1.15 in one frame, skips the snap, drives off the bridge. Replaced by the `_preMoveX` gate.
- `seg.shoreWall` — a both-sided hard wall on the land approaches behind the houses. Blocked ALL off-road exit on the approach; the approach is meant to stay drivable-into-water. Fully removed. If a barrier is ever wanted there it must be water-side ONLY and set out past the shoulder, never both-sided at the lane edge.

### 2026-05-30 (later session) — Long thrash on roadside building parallax, collision fidelity, headlight clamp, water dunk

Single very long session. Mostly successful, but the roadside-building work hit a dead-end and the root cause was only identified at the end — the proper fix is teed up but **not yet applied**.

**Milky Way visuals** ([Road.js](src/road/Road.js) `render`)
- Reshaped the band: galactic core via Gaussian at `CORE_T = 0.78` with `mwBright(t)` and `mwGirth(t)` curves so the band fattens 3–5× through the core and tapers to thin star-rich tails. Added a 150-blob low-alpha "cohesion wash" *underneath* the granular 1000-blob layer for the old continuous-cloud feel, plus 380-puff core plume with mild swirl, dust rivers as 3 meandering Bezier streams, and brighter cluster knots.
- **Real bug**: `azAlt()` had a leftover `H() * HORIZON_Y_FRAC (0.80)` from when `H()` meant SCREEN HEIGHT — now `H()` is the horizon-Y itself, so altitude=0° was projecting 20 % of horizon-Y ABOVE the horizon, putting the band mid-sky instead of rising from the ground. Fixed `azAlt` so altitude=0° lands on `H()` exactly. Moon path benefits too.
- **Rotation anchored to reveal**: Milky-Way-only rotation now zeros at mile 215 (first reveal) and the rate is scaled to `MW_ROT_SCALE = 0.20` so it doesn't lap multiple times over the visible window. Field stars use the original `skyRot`.

**Custom-start menu** ([GameScene.js](src/scenes/GameScene.js) `_buildSliderModal`)
- "PICK A CITY. SET YOUR CHAOS. THEN DRIVE." prompt replaced with a small `Location:` label sitting just left of the dynamic city readout (`cityReadout`) so they read together as one line.

**Bellevue building audit** (multi-agent workflow `bellevue-building-audit`)
- 26 agents (4 mappers, 12 diagnostics, 9 adversarial verifiers, 1 synthesizer). 4 of 12 candidate failure modes survived adversarial review.
- Applied 4 of 5 punch-list fixes in [RouteData.js](src/road/RouteData.js):
  - **De-duped right pool** (was 8 entries with `residential_cluster` listed twice; now 7) so pool lengths are coprime with the 8-entry left pool — combined L+R cycle stretches from 0.8 mi to ~5.6 mi.
  - **Hash-mixed picker + recent-key window** — replaced the modulo walk with an xorshift index + per-side rolling window of last `floor(len/2)` picks, so the same building can't reappear within a few slots.
  - **Halved skyline slot density** (20/mi → 10/mi) and bumped vacant-slot skip 0.20 → 0.35 — old pitch produced overlapping projected widths.
  - **Reduced eastside_urban heightBoost** 3.0 → 2.2 so projected widths fit inside the new slot pitch. Seattle downtown unchanged.
- Skipped Fix 5 (per-distance sprite fog blend) as out-of-scope for the Bellevue complaint.

**Shrubs no longer stop the car** ([GameScene.js](src/scenes/GameScene.js) `_sceneryGlance`)
- **Long-standing bug, finally fixed.** Sage bushes used to scrub speed to 40 mph and reapply every 200 ms while inside the bush volume — read as "the car won't go through this bush." Now: 1 HP damage, light lateral nudge, **`sp.collidable = false`** marks the specific shrub flattened so it can't damage twice, **no speed cap**. Hit a bush at 90 mph, you take 1 HP, hear the thump, keep going at 90.

**Space Needle moved to the opening mile** ([RouteData.js](src/road/RouteData.js), [GameScene.js](src/scenes/GameScene.js))
- From mile 3.5 → **mile 1.85** (just past the crane stretch, 1.05–1.75), offset −1.6 → **−3.0** (far left horizon landmark). Visibility lookahead bumped to `DRAW_DIST * 9` (~2.1 mi) so the Needle pops in at game start when the cranes do.

**Drunk double-vision suppressed during debug overlay** ([GameScene.js](src/scenes/GameScene.js))
- F3 debug mode now zeros `doubleVision` and `shroomMelt` at the render call (3 sites: road, cars/cops, drug pickups). Underlying effect values untouched — only the rendering pass sees zeros. User was rightly annoyed that "beer shouldn't affect debugger tools." Single ghost copy removed when debug is on.

**Collision tunneling at high closing speeds** ([GameScene.js](src/scenes/GameScene.js) `_checkCollisions`)
- `aabbHit` gained a motion-aware swept window: `sweep = |p.speed − entitySpeed| × frameDt × 0.60`, so the `|Δz| < CAR_LEN_Z` threshold expands proportionally to closing speed. Without this, Rx-boosted player + oncoming traffic could step from `Δz = +600` to `Δz = −500` in a single frame and pass through each other.
- **Dual gate for vehicle collisions**: a hit fires if EITHER `aabbHit` (world-space lane proximity) OR `classifyHit` (screen-space rectangle overlap of the rendered sprites) passes. Both traffic and cop loops now use this. Catches NPCs that visually overlap but were outside the lane-offset gate.

**Tunnel lane clamp removed** ([GameScene.js](src/scenes/GameScene.js) `_renderVehicles`)
- The line `const tunnelLaneOffset = inTunnel ? clamp(laneOffset, -0.48, 0.48) : laneOffset` was pulling the **sprite** for outer-lane cars to ±0.48 visually while the **collision** stayed at the real ±0.75. Cars rendered on the hash marks between oncoming lanes, collision rects off to the side. Removed the clamp; tunnel walls sit outside the road shoulder so cars at ±0.75 are still on the pavement.

**Building fade-in clock bug — `gameTime` → `this.time.now`** ([GameScene.js](src/scenes/GameScene.js:9806](src/scenes/GameScene.js#L9806))
- **Long-standing "buildings only appear after I press L/R" bug.** Fade-in used `this.gameTime` as its clock, but gameTime is gated on first L/R/tap input (the ready-state freeze). Every building's `_fadeInStart` got stamped to 0, `elapsed = 0`, `fadeAlpha = 0` → **buildings were rendered but invisible until the first input**. Pressing L/R or pause/unpause (SPACE) cleared the ready state, gameTime started ticking, fade resolved to 1, and the user perceived "buildings appearing." Switched to `this.time.now` (Phaser's monotonic clock).

**Tunnel cull: see homes through the exit** ([Road.js](src/road/Road.js):1329, [GameScene.js](src/scenes/GameScene.js):9468)
- `_cameraInTunnel` + `_tunnelExitN` now published from `Road.render()`. Scenery renderer uses `tunnelExitN` as the cull boundary while inside (or `-1` = no cull) so homes past the exit render through the bright mouth opening, exactly the way trees already did. The old past-tunnel cull only fired on `type === 'building' || 'house'`, so trees showed and buildings didn't — that asymmetry is gone.

**Headlight beam vertical-clamp** ([GameScene.js](src/scenes/GameScene.js):8198 `_renderHeadlights`)
- On steep grades the original `roadTipY = HORIZON_Y + max(40, …)` formula was free to drag the beam tip up to the horizon line (or above when the camera pitched), giving the "cones shooting straight up into the sky" look. Threw out the formula entirely: **`roadTipY = beamBaseY − 55`** (hard-anchored 55 px above the base, period). Cones now stay a stubby forward pool just ahead of the bumper regardless of road tilt. Tunable — the `55` is the single dial.

**Water dunk now actually fires** ([GameScene.js](src/scenes/GameScene.js):3445, 3614)
- Comment block said "Plain `water` segments have no clamp" but the code condition `onWaterAnySide = !!(seg?.bridge || seg?.water)` included plain water — so the car was pinned at ±0.95 on lake-adjacent segments and could never reach the ±1.5 dunk threshold. **Drove off the bridge → respawned without sinking.**
- Fix: clamp only on `seg.bridge`. Plain water + `waterLeft`/`waterRight` get *damage* on shoulder scrape but no positional snap. Dunk threshold dropped 1.5 → **1.15** so even moderate drift fires the sink.

**Roadside building parallax — long dead-end with the real cause finally identified**
- Spent the session attempting several fixes for "houses crowd the roadway when far, back off when close" perception. All rejected:
  - Bumped/uniform `widthMultOverride = 9.0` in `fogLineOffset` (reverted; pushed narrow variants further back, made things worse).
  - 40 % parallax dampening on building sprite positions (reverted; broke road↔building alignment).
  - 100 % anti-parallax (`+ playerX × roadHalfW`) — locked sprites to fixed screen positions but caused the "fly outward" effect as you approach (`screenW × L` grows with depth).
  - Massive setback bumps (gap 3.5 → 7.0, skyline 4.0 → 8.0) — user rejected, "no way to crash into a house."
  - All reverted to baseline parallax.
- **Per user's analytical prompt, did the actual math:** sprite half-width in lane units is `(825 × mult × aspect) / 7200` — a **constant in lane units regardless of depth**. Gap from sprite inner edge to road edge is invariant in lane units, linear in pixels with depth. Projection math does NOT cause sprite width to outpace setback. Concluded the cause is elsewhere.
- **Applied (correctly identified user-suggested fixes, kept):**
  - `usesFarPerspective` in `_renderSceneSprites` extended to include `sp.type === 'building' || 'house'` so every structure gets the `1/n` perspective falloff + vanishing-point pull.
  - **Unified scaling** for all structures: forced through the height-led path (`targetH = proj.sw × unifiedMult`, `targetW = targetH × baseW/baseH`), converting `widthMult` to an equivalent on the fly. Removes the height-led vs width-led split that made adjacent variants expand at different rates.
  - **Skipped the `shrink` cap** for all structures (was only skipped for `roadEdgeGapCars` sprites). Different assets hitting `maxW` vs `maxH` first was producing mismatched effective scales per depth.
  - **Bypassed the dynamic clearance push** (`proj = shifted` reassignment) for `sp.type === 'building' || 'house'` in BOTH the render path ([line 9753](src/scenes/GameScene.js#L9753)) AND the matching collision-side mirror ([line 4306](src/scenes/GameScene.js#L4306)). Buildings now honor their spawn-time `fogLineOffset` lateral position end-to-end.

- **Root cause found at end of session, fix not yet applied:** PNG transparent-padding ratio varies dramatically across the West Seattle home pool:

  | PNG | Frame | Content | Content / Frame |
  |---|---|---|---|
  | ws_3 / ws_4 | full-bleed RGBA | — | **~99.9 %** |
  | ws_2 | 768×576 palette | 720 | **93.8 %** |
  | ws_5 | 768×512 palette | 703 | **91.5 %** |
  | ws_1 | 768×512 palette | 680 | **88.5 %** |
  | ws_6 | 768×512 palette | 653 | **85.0 %** |

  `fogLineOffset()` computes the half-width in lane units from the **frame** dimensions (`heightMult × baseW/baseH`), not the **content** dimensions. So when the slot cycler picks different variants at adjacent slots, the **visible building edge** lands at different lane offsets even though every sprite center is correctly anchored. The visible inner edge for ws_3/ws_4 (full-bleed) sits at lane ~1.69; for ws_6 (15 % padding) it sits at lane ~1.97 — a swing of ~0.30 lane units variant-to-variant. THIS is the "the closer I get, the further they move" / "houses wobble" perception.

  **TODO — proposed fix is teed up:** in `fogLineOffset()`, multiply `halfW` by a per-PNG **content fraction** (new `FOG_CONTENT_FRAC` lookup) so the *visible* building edge — not the frame edge — lands at the designed gap. ws_6 spawns ~0.155 lane units closer to road; ws_3 spawns at the current position; every variant's visible facade ends up at the same fog-line offset. No renderer changes, no asset re-export, no spawn-loop changes. Awaiting user direction to implement.

- **Lessons:** stop reaching for math-level rewrites when the cause is asset-level inconsistency. The user's analytical framing ("does sprite width growth outpace setback growth?") forced the precise dimensional check that ruled out projection and pointed at the PNGs.

### 2026-05-30 — Wildlife overpass TWIN-ARCH rebuild (mile 65)

Rebuilt the Snoqualmie Pass wildlife crossing from real reference photos (I-90 overcrossing) after the bundled workflow reshape below broke. Built **one verified step at a time** (each gated to wildlife so Mt Baker / Mercer lid are untouched). It is a short, low cement **hill over a divided road** — two arches, a solid center pier on the median, a low earthen mound sloping to the forest on each side.

- **Twin-arch facade** ([Road.js](src/road/Road.js) `_drawTunnelFacade`, dedicated `isWildlifeFacade` early-return branch) — two segmental arches (one per carriageway) flanking a SOLID central pier, under a low flat-ish mound that slopes down on the outer flanks so sky/forest shows to the sides. Drawn as two solid concave pieces split at the centerline (each carves one arch + half the pier). **Geometry numerically pre-validated** for non-self-intersection across the perspective range (`/tmp/twin_arch_proto.py`) before writing — no more blind breakage. Knobs: pier half-width `mouthW*0.05`, arch rise `archHalf*0.92`, deck band, flank `mouthW*0.32`.
- **Two-opening mask** ([Road.js](src/road/Road.js) publishes `_tunnelMouthShapes`; [GameScene.js](src/scenes/GameScene.js) `_updateTunnelMask`) — the interior stencil is now the TWO arch polygons (not a single rect), so the interior shows through both arches while the solid center pier stays opaque. The geometry mask (a Graphics shape, not a hard rect) made this feasible. Non-wildlife facades set `_tunnelMouthShapes = null` → fall back to the rect.
- **Road split** — RouteData tags a **median zone** (mile 64.93–65.07, `seg.medianZone` + `seg.medianW` 0→1→0 taper). [GameScene.js](src/scenes/GameScene.js) barrier block adds a **soft pier collision** (nudges the player off the median to whichever side they lean — can't drive through the pillar, but still free to pick left OR right; never a crash). [Road.js](src/road/Road.js) `_drawSegment` draws a **visible raised concrete median curb** down the centerline (scales with `medianW`).
- **Bore** — lengthened to **~100 ft** (`WILDLIFE_OVERPASS_RANGE [65.00, 65.0189]`) and the interior **shaded dark** in `_drawTunnelShell` (a `0.62`-alpha overlay, sodium ceiling lights skipped for wildlife) so the openings read as a shaded recess you drive UNDER, not a bright see-through hole.
- User confirmed the facade shape + median read right; shade/length/proportions are single-number dials for further tuning. Generators/protos in `/tmp` (`twin_arch_proto.py`).

### 2026-05-29 (latest+3) — Wildlife overpass reshape (mile 65, multi-agent workflow) — ⛔ REVERTED

**This whole reshape was REVERTED** (superseded by the 2026-05-30 twin-arch rebuild above). In play it broke: cutting `W_FLANK` to 1800 left the facade too thin → holes → see-through to the sky ("abstract art installment"), and the 16-strip `sin` vault read as "fishbone" striped walls instead of solid. Lesson logged: big bundled blind facade changes break; the rebuild was done one verified step at a time. Original (now-reverted) approach for reference:

Designed + adversarially verified via the `wildlife-overpass-redesign` workflow (4 agents), then applied (12 patches, all gated on `isWildlifeFacade`/`seg.wildlife` so Mt Baker + Mercer lid render byte-for-byte unchanged).
- **Facade: wall → land-bridge** ([Road.js](src/road/Road.js) `_drawTunnelFacade`) — the old wildlife branch built one screen-filling sine half-dome (`W_FLANK=160000`) that read as the Great Wall. Replaced with a low FLAT-TOPPED earthen deck: `W_FLANK` cut to 1800 (modest abutment embankments, sky to the sides further back), arch springer lowered (`WL_H_OPEN=2300` vs the 4500 highway ceiling) and made SEGMENTAL (`WL_RISE_FRC=0.45` — keeps the liked arch shape but shorter), with a thin earthen deck band (`WL_DECK_THK=1100`) above the crown. crestY/dropY re-pointed to the deck top (only inside the wildlife branch). Ring/shadow/jamb edits follow the new segmental arch.
- **Bore: rectangular → arched vault** ([Road.js](src/road/Road.js) `_drawTunnelShell`) — wildlife ceiling raised (`H_CEIL` 4500→9000) and a `sin(π·t)` arched vault underside drawn as 16 trapezoid strips springing from the inside wall tops. Gated on `seg.wildlife`.
- **Verify caught a blocker:** the facade mask patch referenced `mouthRadius` before its `const` declaration (temporal-dead-zone ReferenceError, would crash every frame the overpass was visible) — applied the corrected inlined version.
- **Known eyeball caveats** (flagged by verify, for iteration): at the nearest render distance (n=30) the deck still spans full width — side sky only opens at n≥40; the facade deck silhouette is bare concrete + rim band (the grass/dirt/trees live in the BORE renderer, not the facade, so the deck has no painted greenery yet); the arched bore crown coincides with the raised flat ceiling (reads as a curved ceiling, not a deep cathedral vault).

### 2026-05-29 (latest+2) — Mercer/Seattle scenery fixes (multi-agent workflow)

Diagnosed + adversarially verified via a 6-agent workflow (`mercer-scenery-fixes`), then applied.
- **Mercer homes pop-in past the lid tunnel** ([GameScene.js](src/scenes/GameScene.js) `_renderSceneSprites`) — buildings/houses now fade in 0→1 over 450ms via a per-sprite `sp._fadeInStart` stamp instead of snapping to full opacity. The past-tunnel cull stamps `-1` while a structure is occluded so it re-fades the instant it's uncovered at the mouth. Generalizes to all structures entering draw range (smooths route-wide pop-in). Tunnel stays opaque (facade at depth 9.82 draws over sprites regardless of alpha); mirror pool + night-tint unaffected.
- **Mercer homes crowding the road** ([RouteData.js](src/road/RouteData.js)) — root cause: the `mercer_island` region had no case in the cycle-spawn `carWidthsPastFog` switch, so it fell through to `default: 0.90` car-widths (~0.21 normalized gap). Added explicit `case 'mercer_island': return MERCER_FRONTAGE_GAP_CARS` (=3.00, ~0.69 gap). Scoped exactly — Mercer was the only CYCLE_POOLS region hitting the default; West Seattle homes (separate path, 3.50) and eastern scenery untouched.
- **Bellevue/Seattle skyline sinking into Lake Washington** — first attempt (`SKYLINE_SHORE_LIFT=4`, lifting the silhouette base above the waterline) was **REVERTED**: the user clarified the skyline silhouette exists specifically to COVER a charcoal "junk" backdrop band on the bridge crossings, so lifting it just exposed that junk (visible as a dark band on the West Seattle bridge). Correct understanding: the silhouette must stay LOW (covering the charcoal), and the real bug on the Murrow floating bridge is a DRAW-ORDER problem — the per-segment lake-water fills are painted into the same roadGfx layer AFTER the silhouette, so they overpaint its lower edge ("sinks into the lake"). Proper fix (TODO) is a layer/draw-order change (silhouette above the water fills, behind the cranes), NOT a vertical lift.
- **Process note:** a diagnosis subagent overstepped and applied the tunnel-popin edit to GameScene.js directly during the workflow; the change was independently verified correct and kept.

### 2026-05-29 (latest+1) — Weather storm-build + seamless rain→snow, curve de-wiggle

**Weather** ([Weather.js](src/world/Weather.js), [EffectsSystem.js](src/systems/EffectsSystem.js))
- **Seamless rain→snow** (was a clear-weather gap): rain `intensity` no longer fades out over mile 38-40 and snow no longer fades in over 40-42 — both hold full at the mile-40 boundary, so rain hands directly to snow with no "it cleared up then snow started" gap.
- **Rain strong by mile 35**: rain `severity` ramp steepened (`(mile-30)/7`) → ~2.0 by mile 35, peak 2.4 by 37. Falling-streak `COUNT` and opacity now scale with `sevT` (`110·int·(1+1.4·sevT)`), so it builds into a wipers-needed downpour.
- **Windshield build-up** (was instant whole-glass fill): removed the 60-drops/sec bulk pre-fill; drops now accrue at a gentle severity-scaled rate (`5+34·sevT`/sec) and spawn in the lower 45% of the glass, so the windshield fills bottom-to-top over a few seconds and rebuilds after each wipe.

**Curves de-wiggled** ([routeGeo.json](src/road/routeGeo.json))
- Local feedback: Snoqualmie Pass "felt a lot curvier than I recall" — the GPS regen had rapid mile-to-mile S-curves. Regenerated with a wider curvature window (DELTA 0.30→0.50 mi) + 2 moving-average smoothing passes (calibration re-normalizes peak magnitude). North Bend→Pass direction-flips dropped from many to 2; reads as long sweeps now. Side benefit: the Mercer Island crowding-bend softened +0.0106→+0.0064. Bridges still verify straight. Generator: `/tmp/gen_curves_gps.py`.

### 2026-05-29 (latest) — Real GPS+DEM elevation (route no longer flat)

**Root cause of the flatness** ([routeGeo.json](src/road/routeGeo.json), [RouteData.js](src/road/RouteData.js))
- `routeGeo.json` had real `curves[]` (350 samples) but an **empty `hills[]`**, so `HAS_REAL_HILLS` was false and ALL elevation fell back to ~48 hand-typed keyframes in `I90_ELEV_FT`. In the east those keyframes are 15–25 mi apart, Catmull-Rom smoothed into featureless ramps — the Palouse rolling hills rendered as a flat tilt.

**Fix: populate hills[] from real road geometry + USGS DEM**
- Pulled the actual road polyline (4,286 vertices, 296.6 mi) for the Seattle→Pullman corridor from OSRM (OpenStreetMap routing), forced onto I-90 → WA-26 → US-195 → WA-270 via Vantage/La Crosse waypoints.
- Sampled 350 points along the **true roadbed** (not straight chords — earlier hand-waypoint attempts cut over Cascade peaks, producing a fake 4,600-ft summit flanking a valley) and queried elevation from OpenTopoData `ned10m` (USGS 10m DEM), converted m→ft, stored as feet-above-start in `hills[]`.
- **Rubber-sheet alignment**: pinned each town's real road-location to its game checkpoint mile (piecewise-linear game_mile→real_distance map) so terrain features land on their signs despite the 296.6→293 mi compression.
- Result verified against reality: summit peak 3030 ft @ mile 51, Vantage gorge drop to 589 ft, Ryegrass 2430, Cle Elum 1916, Washtucna coulee 1042, Pullman 2362 — all within ~30–80 ft of real. Generator script at `/tmp/gen_hills_gps.py` (reads `/tmp/osrm.json`).
- `I90_ELEV_FT` keyframes are now a **fallback only** (used if `hills[]` is ever cleared). Also corrected the Hyak/Keechelus ordering in that fallback array (summit before the lake; Hyak named once).
**Curves regenerated from the same GPS too (accurate turns)**
- The existing `curves[]` was "hand-keyframed I-90 data" — a sign cross-check showed it correlated ~−0.09 with reality (i.e. not geographically real). Regenerated from the OSRM polyline as signed curvature (bearing-change per arc length), using the **same rubber-sheet alignment** so turns and hills agree.
- Sign convention from Road.js (`screenDX += seg.curve` → positive = bends right). **Scale-calibrated to the existing curves' 90th-percentile magnitude** so turn *intensity/feel* matches today's tuning while turns land in real places/directions. Only ~2% of samples hit the ±0.022 clamp (isolated at the start + post-finish Pullman approach).
- Turns now fall on the genuinely curvy stretches: Yakima River Canyon (mile ~96, sharpest), the Cascade climb (~36), the Palouse / US-195 Colfax jog (~240–276); the Columbia Basin stays straight. Bridge/tunnel curve-flattening in `buildRoute` still overrides on those segments. Generator: `/tmp/gen_curves_gps.py`.

**Alignment fix (start point + curved-bridge bug)**
- First pass anchored game-mile 0 to the *Seattle* coordinate and pulled an OSRM route that started at Seattle — so the whole mile 0–13 urban corridor (WS Bridge, Mt Baker, Murrow, East Channel) was shifted ~5 mi relative to the hand-placed bridges/tunnels. Re-pulled OSRM **starting at West Seattle** (301.9 mi) and added correct dense anchors (West Seattle=0, Seattle=5, Mercer=9.5, Bellevue=12.5). Curve sign cross-check went −0.09 → **+0.92**; hills start now reads the real 324-ft West Seattle hilltop descending to the floating bridge.
- **Curved-bridge bug**: `smooth(rawCurves, 0.04)` ran AFTER the bridge-zeroing, so a real GPS curve adjacent to a straight bridge bled onto it (visible as a curved East Channel bridge leaving Mercer). Refactored to `applyStructureCurves(arr, pad)` called **twice** — pre-smooth with a 0.10-mi pad (approaches ramp cleanly to 0) and post-smooth with pad 0 (exact straight cores). Verified: WS/Mt Baker/Murrow/East Channel/Vantage bridges all `max|curve|=0.00000`; Mercer Lid keeps its intentional 0.012 right bend.

**Hybrid hills — urban keyframes + open-road DEM**
- DEM returns *terrain*, but the mile 0-13 urban corridor is packed with engineered structures whose roadbed is off the terrain: the WS high bridge decks OVER the Duwamish, the Mt Baker + Mercer-lid tunnels run UNDER ridges, and the Murrow + East Channel FLOATING bridges sit on the lake surface. Raw DEM floated the Murrow bridge at 135 ft. Fixed in the generator: hand roadbed keyframes (RouteData `I90_ELEV_FT`) through mile 12, crossfade to DEM over mile 12-16, DEM beyond. Verified roadbed: Murrow 21 ft / East Channel 28 ft (lake), Mercer lid 70 ft (ridge), WS bridge 236 ft (deck); open route unchanged (summit 3030, Vantage 572). Curves don't need this — bridge curve-flattening already forces them straight.

### 2026-05-29 (later) — Left-side off-road dead-zone closed (asymmetric clamp)

**Asymmetric lateral clamp** ([GameScene.js](src/scenes/GameScene.js) ~3699)
- The lateral clamp `_maxX = 2.8 + rampStrength * 3.7` opened the drivable corridor **symmetrically** to ±6.5 on exit-ramp segments. Since all off-ramps are right-side only, this exposed an empty off-road dead-zone on the LEFT near every exit — the player could drift far left into a space with no scenery, NPCs, or cops (the old "±5.5 tree wall in a space nobody should drive" problem).
- Split into `_maxXRight = 2.8 + rampStrength * 3.7` (unchanged — exits still work) and `_maxXLeft = 2.3` (hard wall, never opens). The ±5.5 tree-wall crash is left intact as a backstop (the left clamp now prevents the car from ever reaching it).
- Left-side off-road deterrent: past `x = -1.5` (half a lane beyond the ±1.0 fog line) the car bleeds **1 HP/sec** until it returns toward the road, up to the 2.3 wall. No crash/recovery-warp; the i-frame absorbs it so it won't stack onto a crash recovery. Right side gets no penalty (exit territory).
- Decision: chose a soft clamp + graduated bleed over decorating the dead space with visible trees — the player shouldn't be out there at all, so walling it off beats signposting it.

### 2026-05-29 (late) — Mirror lights, oncoming-car headlights, beam cleanup, Vite 6

**Rearview mirror lighting** ([GameScene.js](src/scenes/GameScene.js))
- Same-direction NPCs behind the player (facing the player in the mirror) get the full forward-view oncoming treatment: yellow lamp halos at headlight housings (cars `0.50`, trucks/SUVs `0.65` of sprite height), two cones meeting at the centerline at the bottom, bottom-half yellow splash whose flat top kisses the cone bottoms. Brightened ~1.5× in the mirror only (`MIRROR_HL_BOOST = 1.5`) so the tiny sprites still read at night.
- Oncoming-then-passed NPCs (going AWAY from the player in the mirror) now show their `car_back_*` texture and get simple red brake-light halos at the tail-light housings (cars `0.50`, trucks `0.55`), outer edge of the halo aligned with the outer edge of the sprite. No cones/splash — brake lights are emissive only, they don't project beams onto the road.
- Mirror near-cull bumped to `vz > PLAYER_VIRTUAL_Z` for both `carsBehind` and `copsBehind` — cars only appear in the rearview once they've truly slipped past the player's physical position, so big sprites on the main screen no longer "double-show" enormous in the mirror.

**Oncoming-car headlights, forward view** ([GameScene.js](src/scenes/GameScene.js))
- The OG `drawHeadlights` helper at line ~8995 was painting bright yellow halos at `ly = sy - w * 0.10` (inside the wheel base) for every oncoming car since before this work — those have been disabled. The OG same-direction tail-light pair at the wheel base is also disabled; proper mid-height tail lights come from `_renderHeadlights` instead (cars `0.50`, trucks `0.55`, halo outer edge at `targetW * 0.50 - haloR` so it touches the sprite outer edge).
- New oncoming-car lighting in `_renderHeadlights`: yellow lamp halos at the headlight housings (cars `0.50`, trucks `0.65`), two cones meeting at the centerline at the bottom (outer corners reach the splash equator tips), bottom-half yellow splash whose flat top sits at `coneEndY` (= the widest line of a would-be full ellipse). No upper half = no ADD-blend overlap brightening at the seam.

**Player car beam cleanup** ([GameScene.js](src/scenes/GameScene.js))
- `drawBeamQuad` now clamps each beam's inner toe-in to at most `hubOffset` so left and right halos can't cross the car centerline and create an ADD-blend brighter triangular stripe at the tip.
- Outer halo tip width is sized so each beam's outer-tip edge lands exactly on the road-patch oval's outer edge: `outerOvalHalf = max(outerTipHalf * 0.5, outerTipHalf * 1.2 * patchBoost - hubOffset)`.
- Inner cores now stop at the oval's bottom edge instead of running through it — `drawBeamQuad` takes an optional `tipYOverride`, inner-core calls pass `coreTipY = roadTipY + 4 + 11 * patchBoost`.
- Inner cores thinned: `innerTipHalf = 24 * profile.width` (was `30`).
- Beater's mismatched left bulb gets a cool tint: `asymInner = 0xC0D0DC` (was warm pale yellow `0xE8E2A0`, then briefly the colder `0xB8D0E8`).
- Road shoulder reflectors moved from `±1.25` lane units (outboard in the gravel) onto the fog line itself at `±1.0`.

**Vite 6 upgrade** ([package.json](package.json))
- `vite` `^5.0.0` → `^6.0.0` (resolves to 6.4.2); `@vitejs/plugin-basic-ssl` `^1.2.0` → `^2.0.0` (resolves to 2.3.0) since the 1.x branch only supports Vite 5. Build verified, no behavioral changes — bundle sizes ~480 kB app, ~1.48 MB Phaser.

### 2026-05-29 — Night lighting pass, astronomy model, audio polish, audit cleanup, roadside barriers, finish-line move

**Night lighting pass (multi-day arc on tip)** ([GameScene.js](src/scenes/GameScene.js), [src/utils/Colors.js](src/utils/Colors.js), [src/road/Road.js](src/road/Road.js), [src/road/RouteData.js](src/road/RouteData.js))
- Palette tweaks: Ellensburg grass pushed yellower; new `late_palouse` region (mile 240→293) tweens golden wheat into dried late-summer brown. `REGION_TRAITS.late_palouse` mirrors `palouse` traits so the road geometry doesn't break at the visual boundary.
- Scenery sprites tinted by `TimeOfDay.darkness()` × 55%, with a slight cool bias on the blue channel for moonlight cast. Full night = 45% sprite brightness with a blue lean.
- **Player headlight cones** rebuilt from the ground up over ~10 iterations: two-layer beam (outer halo + inner core) with a road-tip illumination ellipse, origin at mid-sprite (`carY - carH × 0.50`), tip lands on pavement not horizon. Final occlusion uses a `Phaser.Display.Masks.BitmapMask` from the player sprite with `invertAlpha = true` — body silhouette occludes the beam, transparent PNG areas show it through. Depth-ordering alone wasn't enough because the player PNGs have subtle semi-transparency throughout the body.
- **Per-vehicle headlight profiles** in `_vehicleHeadlightProfile(id)`: brightness (0.30 beater → 0.70 playdoutS3X), tip width, central road-pool boost (EVs get wider middle), inner/outer colors (warmer for EVs, neutral for ICE), `asymInner` for the beater's barely-mismatched bulb tint on the left side.
- **NPC same-direction headlights** use a parallel pool of 36 masked Graphics objects, one per `_carSpritePool` slot, each `BitmapMask`-occluded by its NPC sprite. `_drawNpcForwardBeams(slotIdx, t)` is called from inside `_renderVehicles.place()` so the beam Graphics tracks its NPC's mask. NPC peak alpha capped at 0.10 (below the beater's 0.145 core) so the player's beams always dominate.
- **NPC traffic dots** (in shared `headlightGfx`): warm-white halos + cores for oncoming traffic (with a minimum-size floor so distant lights remain visible), red mid-height corner-positioned tail lights for same-direction traffic. Lights cull at `proj.sw < 8` and match the vehicle render's `nearCull` (cockpit 100 / chase 1950) so no orphan glows after a car despawns.
- **Road shoulder reflectors** drawn additively in the headlight gfx, white dots both sides every ~22 segments (~120 ft), darkness-gated.
- **Headlight + reflector + dim-tint together** kick in around mile 130 (start of dusk) and ramp to full at mile 180.

**Astronomical model — moon + Milky Way** ([src/road/Road.js](src/road/Road.js))
- Replaced left-to-right linear arc with proper azimuth/altitude projection assuming east-facing observer.
- **Moon at 3× real speed**: rises ESE (azimuth 110°, altitude 0°) at mile 160, transits Due South at mile 184 (peak altitude 55°), sets West at mile 208. The phase calc starts at -0.10 (mile ~155) with negative altitude so the disc physically rises through the horizon line — ground/landscape graphics drawn after the sky naturally clip the lower half.
- **Milky Way** comes out at mile 215 (7-mile gap after moon set), fades in over 10 miles. Bezier band starts as a low flat NNE→SE arch (faint NNE end at azimuth 22°, bright Sagittarius core at SE/135°). Over the 75 miles to Pullman the core sweeps toward Due South while the band tilts up — implemented as time-varying bezier control points + a midpoint that bulges higher as `mwSky` advances. Core-brightening Gaussian moved from `t=0.55` (middle) to `t=0.88` (near SE/S end) so the bright cluster reads where the spec puts it.

**Audio polish** ([src/systems/AudioSystem.js](src/systems/AudioSystem.js), [src/main.js](src/main.js), [src/scenes/GameScene.js](src/scenes/GameScene.js), [index.html](index.html))
- **Page-level audio unlock via inline `<script>` in index.html `<head>`**: runs before Vite even fetches the module bundle. First user gesture (touchstart / pointerdown / touchend / pointerup / click / mousedown / keydown / keyup on `window` or `document`) creates ONE throwaway AudioContext, plays a 1-second silent buffer, calls `resume()`. iOS Safari + Chrome iOS need the silent-buffer trick — `resume()` alone snaps back to suspended. After success the listeners self-detach, and `window.__audio.init()` boots music immediately so the user hears something even on their first tap.
- **Pause-music ducking**: `setPaused(true)` clamps `audio.volume` DOWN to `PAUSE_DUCK_CEILING = 0.15` (only if it was higher — never raises). Slider always reads `audio.volume`, so the visible position matches what plays (WYSIWYG). User dragging during pause marks `_userTouchedVolumeWhilePaused`; on resume the pre-pause volume restores only if the user didn't override.
- **Perceptual volume curve**: `AudioSystem.volumeToGain(v) = v * v` quadratic. Linear slider feels logarithmic to the ear so 50% sounds like half (not "nearly max").
- **Default volume lowered** 0.32 → 0.20 to address "game runs loud."
- **`_applyMasterGain()` helper** is the single source of truth for the master node — every `_master.gain.value =` write was redirected through it.
- **AudioSystem track-error infinite-recursion safeguard**: `_onTrackEnded()` was synchronously calling `_startTrack()` which re-attached the error handler → tight loop on a bad URL. Added a consecutive-failure counter that bails after 6 fast failures within 1.5s, with the `playing` event resetting the counter on success.

**Roadside crash barriers** ([GameScene.js](src/scenes/GameScene.js))
- Three concentric barriers fire in the speed-math update, after the bridge-rail block:
  - **±2.35 utility pole** — one-shot −10 HP + crash recovery (2s i-frame, 1s hold, ramp to 60), 1.5s cooldown. Active inside `seg.utilityLineSide` runs.
  - **±2.00 fence rail** — sustained −3 HP/sec while in contact, bounces back. Active inside `seg.ruralFence` segments.
  - **±5.50 outer treeline wall** — full crash (−10 HP + recovery, `_postCrashLaneX()` reset). Active past mile 14. **Fires unconditionally regardless of water/bridge flags** so the previous Vantage exploit (water-tagged segment let players drive infinitely off-road on grass) is closed.
- `_applyDamage` already absorbs HP during i-frames, but the lane-clamp and crash-recovery setup fire anyway — so even mid-blink the player gets yanked back to the recovery lane.

**Bushes / shrubs as glances** ([GameScene.js](src/scenes/GameScene.js))
- Shrub collision now goes through `_sceneryGlance(proj, damage, sp)` instead of `_triggerSceneryRespawn`. No crash, no smoke, no respawn. Small HP nick (0.5–1.0), strong lateral push (`xImpulse = ±0.18`), speed clamps to 40 mph through the brush, 200ms i-frame to prevent retrigger.
- Bush sprite stamps with `sp.kickDir` and `sp.kickUntil` — renderer in `_renderSceneSprites` applies `kickPx = (sp.kickDir) * targetW * 0.12 * remain` over 400ms so the shrub visibly leans away from the car then settles back.

**Pullman finish line moved to mile 289** ([src/constants.js](src/constants.js), [src/scenes/GameScene.js](src/scenes/GameScene.js), [src/road/RouteData.js](src/road/RouteData.js))
- Was at mile 279 (`Pullman` city limit) which auto-busted players with 5★+late-clock at the wrong time. Split into two checkpoints: `Pullman` (city limit, mile 279) for the label, and `Pullman, WA` (`isFinish: true`, mile 289) for the actual finish + bust evaluation.
- HARD-mode autocheckpoint gate: at line ~2740 in `GameScene.js`, passing a `CHECKPOINT` marker no longer auto-sets `_lastCheckpoint` when `Difficulty.mode() === 'hard'`. Only pulling off at a rest stop counts as a save point on HARD.
- Pullman Party House landmark relocated from `EASTERN_TOWN_WINDOWS` mile 271-272 to a fresh window at 288.4-289.0 with `homes: 0` so just the landmark spawns next to the finish.
- Mile-279 bust path retained for the case the user IS already at 5★+late when crossing the actual finish at 289 — `_endGame('busted_late')`.

**Crash screen rebuild** ([src/scenes/GameOverScene.js](src/scenes/GameOverScene.js))
- Buttons rewired to match the baked artwork labels: leftmost pink polygon → `_retrySameSettings()` (was `_startOver()`), middle blue → `_restartAtCheckpoint(cp.position)` falling back to retry if no checkpoint (was `_retrySameSettings()`), rightmost white → `_returnToTitle()` (unchanged). Visible labels (RETRY / LOAD SAVE / MAIN MENU) now do what they say.
- Polygon hit zones on Graphics objects → invisible Rectangle game objects sized to the polygon bounding box. Phaser polygon hit testing on Graphics is unreliable on touch (especially iOS Chrome); rectangle hit zones on dedicated game objects are bulletproof.
- Defensive scene-input setup at the top of `create()`: `this.input.setTopOnly(false)`, `this.input.enabled = true`, `this.scene.bringToTop()`. Recovers from edge cases where scene transitions left input disabled on the new scene.

**Bug + dead-code + perf audit pass** (3 parallel agents)
- **Deleted**: `src/road/Road 2.js`, `src/road/Road 3.js` (Finder backup duplicates); lifecycle `console.log` spam in `BootScene.js` and `GameScene.js`; all `.DS_Store` files in `public/assets/**`; the `_stateDebugTxt` debug overlay (was running every frame); the `[F12]` per-init console log.
- **`DEV_WARP` removed then RESTORED** — initially deleted by the audit, then restored after the user clarified that "Release" means actual public/App Store release, not Netlify deploys or beta. Memory note `feedback-dui-skip-ci-does-not-work` and `project-dui-dev-warp-removal` updated to reflect that the cheats stay through every Netlify deploy and the entire beta phase; only strip them for actual ship.
- **Tilt SHUTDOWN reset**: `_tiltShutdownHooked = false` now resets in `init()` so the `events.once(SHUTDOWN, …)` cleanup re-arms across scene-instance reuse. Without this the second-and-later restarts after the first crash left the orient listener leaking.
- **HUD setText diffing**: every per-frame setText on `hudScore / hudHP / hudGas / hudDist / hudSpeed / hudRegion / hudStars / hudRadio / hudPartyClock` now compares `obj.text !== str` before calling setText. Avoids forcing Phaser to rebuild the Text texture each frame when the string hasn't changed. Same diff applied to color setters on HP / gas / party clock.

**Driving-type carousel color-tinted** ([GameScene.js](src/scenes/GameScene.js))
- Title screen "DRIVING TYPE" value label now colors by mode: **THUMBS pink** (`#FF39AF`), **TAP blue** (`#39A8FF`), **TILT red** (`#FF2244`), matching the in-game palette. Stroke and blurb stay unchanged.

**East WA building profiles + utility-run alignment** ([GameScene.js](src/scenes/GameScene.js), [src/road/RouteData.js](src/road/RouteData.js))
- Added rendering profiles for `codex_east_wa_doublewide_tan/_white` and `codex_east_wa_fenced_house_tan/_white` (they were spawning but falling through to the default profile). Doublewides use `widthMult: 2.85` with a low `maxH` so they read as flat single-stories; fenced houses use `heightMult: 2.80–2.85`.
- Two new `EASTERN_UTILITY_RUNS` entries (mile 94.6–96.8 and 270.6–277.0) and extended-end edits on four others so every eastern town window now has a power-line corridor overlapping it. Existing runs gained `nearHomes: true` where they overlap a town so transformer cadence tightens around frontages.

---

### 2026-05-28 — phone-menu tilt fix, steering mode normalization

**Tilt steering from phone menu** ([GameScene.js](src/scenes/GameScene.js), [index.html](index.html), [src/main.js](src/main.js))
- Final root cause: mobile browser motion permission is not consistently exposed on `DeviceOrientationEvent.requestPermission`. Chrome/iOS paths can expose the permission prompt on `DeviceMotionEvent.requestPermission` instead. Checking only `DeviceOrientationEvent` made Tilt appear selected while the browser never delivered useful tilt events.
- `_armTiltPrefetch()` now selects the permission API in this order:
  - `DeviceOrientationEvent.requestPermission`
  - `DeviceMotionEvent.requestPermission`
  - no permission gate → attach `deviceorientation` directly
- The prefetch listener now watches `touchstart`, `pointerdown`, `pointerup`, and `mousedown` on both the Phaser canvas and `document`. This matters because the phone-menu confirm modal is HTML and uses pointer handlers; listening only on the canvas / only to touch could miss the Continue gesture.
- The phone-menu Tilt button writes `titleThumbsPick = 'tilt'` before showing the confirm modal, then restores the prior pick if canceled. This lets the native DOM prefetch know the next gesture is intended to authorize Tilt.
- `window.__steeringMode.set()` now routes live scene changes through `GameScene._setSteeringMode()` instead of only writing `registry.steeringMode`. The direct registry write skipped `_enableTiltSteer()` and could leave the UI selected but no orientation listener attached.
- `_setupTilt()` now reattaches the orientation listener when a scene starts and persisted `steeringMode` is already `tilt`. Without this, a restart/cold-load could have mode=`tilt` with no listener.
- `_setSteeringMode('tilt')` is allowed to run again if mode is already `tilt` but `_tiltAttached` is false. This fixes the “stuck selected, cannot re-arm” state after a failed permission attempt.
- `_tiltSteerAmt` is reset on setup/disable so stale analog input cannot bleed between modes.

**Steering vocabulary cleanup** ([index.html](index.html), [src/main.js](src/main.js), [GameScene.js](src/scenes/GameScene.js), [SaveSystem.js](src/systems/SaveSystem.js))
- Gameplay mode names are:
  - `classic` = L/R two-thumb steering
  - `flappy` = one-thumb tap steering
  - `tilt` = motion steering
- The phone UI previously sent `lr` for L/R while gameplay expected `classic`; the save system also accepted storage names `tap/classic/tilt` while UI/game used `flappy/classic/tilt`. This caused UI highlight, runtime mode, and save-profile selection to drift.
- Phone menu now maps L/R to `classic`. `main.js` and `GameScene._steeringMode()` normalize old values (`lr → classic`, `tap → flappy`). `SaveSystem.setMode()` aliases `flappy → tap` and `lr → classic` for backward-compatible profile buckets.

**Retest notes**
- Use a hard refresh after editing tilt code; stale Vite/client state can keep old registry values around.
- Test Tilt via `https://<LAN-IP>:3000`, not plain `http://`.
- If Tilt appears selected but behaves like L/R, inspect whether `_tiltAttached` is true and whether `steeringMode` is actually `tilt`; the likely failure is permission/listener attachment, not the analog steering branch.

### 2026-05-27 — HUD restructure, crash-recovery rolling start, iOS tilt permission fix, asset cleanup, building auto-flip

**HUD layout overhaul** ([GameScene.js](src/scenes/GameScene.js))
- Restructured the top-of-screen readouts into two mirror-adjacent clusters instead of edge-anchored singletons:
  - **Left cluster** (right-of-mirror in default LH mode): Time + Multiplier (top row, multiplier sits to the right of the clock), Cash, HP.
  - **Right cluster** (left-of-mirror in default LH mode): Speed, MPH, Gas-miles.
- Top-row buttons (Pause / FF / Genre / Mute / Map / Garage) pushed outward by `READOUT_W=95` so the new clusters fit beside the mirror.
- Per-frame handedness mirror handler at `_doCreate()` rebuilt to mirror the *new* cluster layout (previously snapped HP / Gas back to the old weapon-column position on scene start — the cause of repeated "HP/Gas not below Cash/MPH" reports).
- HP color now always pink `#FF39AF` (the "-X" damage popup still does the took-damage feedback).
- Gas color: blue `#39A8FF` (full) → amber → red blink (nearly empty). Dropped the orange-on-near-exit strobe that was reading as flicker.
- Cash color: neon green `#39FF8A` (was yellow).
- Multiplier moved next to the timer, font 11→16 px (~45% bigger).
- Speed + MPH + the title-screen "DIFFICULTY" label now share a per-difficulty palette: **Easy pink / Normal blue / Hard red / Custom purple** (matches the title-screen "DRIVE" + "IMPROVISE" chrome).
- Gas pump PNG (24×24, swaps `ui_gas_full` ↔ `ui_gas_empty` below 30 mi) repositioned to sit OUTWARD of the Speed number (away from the mirror), vertically centered on Speed.
- ACCEL pedal recolored neon blue (`0x39A8FF` stroke / `0x0F2A4A` active fill); label flipped to `▲\nACCEL` so the arrow sits above the word and mirrors BRAKE's `BRAKE\n▼`. Both pedal labels bumped to 16 / 17 px.
- Accel charge bar's "full" color flipped from green → neon blue to match the pedal.
- FPS / SPR diagnostic readout removed.
- FF button no longer starts the run when tapped on the title (was the secondary unintended launch path).

**Crash recovery — "rolling start" auto-pilot** ([GameScene.js](src/scenes/GameScene.js))
- Added `_crashRecoveryUntil` field separate from `_invincibleUntil`. Set by NPC head-on / cop head-on / scenery-crash recoveries (not the 200 ms bush nudge).
- Each major crash now resets the player to `MAX_SPEED * 0.18` (≈22 mph) at the difficulty's recovery lane.
- During the i-frame blink, the speed update forces `targetSpeed = 60 mph` regardless of input. The existing ACCEL ramp brings the car up to 60 over ~0.7 s and holds, so the blink ends with a controlled rolling re-entry instead of a near-stop.

**Drug HUD bars — drag UX** ([GameScene.js](src/scenes/GameScene.js))
- The cell fills vertically (bottom = empty, top = full); drag was previously reading horizontal pointer X. Swapped to VERTICAL drag with `frac = 1 - (py - hit.y) / hit.h`.
- Added 12 px touch padding around each cell so an off-by-a-bit tap still grabs it. Once grabbed, the finger can leave the cell and the level still tracks (clamped 0..1).

**Custom mode modal — vehicle + accessories + spacing** ([GameScene.js](src/scenes/GameScene.js))
- Added a VEHICLE picker (single wide button cycling all 8 entries in `VEHICLES`) and an ACCESSORIES row with Bumper / Traction / NOS (0–3) toggles. Custom is treated as a sandbox — every vehicle and every accessory is selectable regardless of ownership / install state.
- New `_applyVehicleSwap(vid)` helper mirrors the Garage modal's live-swap pattern. Accessory choice rides on `this._customStartAccessories`; `_vehicleAccessories()` returns the override when present so persisted save state is untouched.
- Layout: Vehicle row y=222 (gap 11 px below Drive Type), Accessories row y=262 (gap 12 px below Vehicle), location bar lowered to mapY=357, "CUSTOM RUNS DO NOT SCORE" font 16→14 px so it clears the lowered map.

**Game Over → RETRY = same-settings skip-title** ([GameOverScene.js](src/scenes/GameOverScene.js), [GameScene.js](src/scenes/GameScene.js))
- New `_retrySameSettings()` method calls `scene.start('Game', { skipTitle: true })`.
- `GameScene.init()` accepts `data.skipTitle`; `_awaitingStart` short-circuits to false when set. Persisted difficulty / steering / drug unlocks carry through; only START OVER wipes them.
- Wired into the baked Crashed/Busted plate button, the standalone RETRY button, and the SPACE keyboard shortcut.

**iOS tilt permission — first-tap acceptance** ([GameScene.js](src/scenes/GameScene.js))
- Root cause: Phaser's queued pointer dispatch was dropping the iOS user-gesture context before `DeviceOrientationEvent.requestPermission()` ran, so the request rejected and the old fallback popup ("TAP ANYWHERE TO ENABLE TILT") forced a second tap.
- Fix: new `_armTiltPrefetch()` installs a `capture: true` native DOM listener (`touchstart` / `mousedown`) on the canvas that calls `requestPermission()` synchronously inside the gesture frame. Self-cleans once permission is granted. No-op on Android / desktop where `requestPermission` doesn't exist.
- `_enableTiltSteer()` rewritten to queue the caller's callback for the prefetch to flush instead of trying to call `requestPermission` itself.
- Title-screen carousel and custom-modal Drive Type buttons now persist `titleThumbsPick` to the registry **immediately on tap** so the prefetch listener on the next tap (e.g. START) sees the chosen mode.

**Asset cleanup pass** ([AssetManifest.js](src/systems/AssetManifest.js), `public/assets/`, `Images/`)
- Audited `public/assets/` against `AssetManifest.js` — 0 broken refs, ~35 orphan files.
- Moved orphans to `Images/` (flat) and `Images/_badge_source_originals/` (drug pre-zoom source PNGs, collision-avoidance):
  - 9 from `buildings/codex/` (old crane variants, PSD source files, files with literal spaces in name)
  - 7 from `buildings/` (duplicate space_needle.png + west_seattle_1.png–6.png — the codex/ versions are the live ones)
  - 10 drug source originals
  - 2 hookers/ sprites (HookerSystem was already deleted)
  - 3 props/ (hitchhiker PNGs + overhead_powerlines_long.png, all unloaded)
  - 7 ui/ SVG button sources
  - The runtime copies of `ui/crash_collision.png` + `ui/crash_overdose.png` (user had already moved them to Images/)
- Removed two dead manifest entries (`ui_crash_collision`, `ui_crash_overdose`).
- Deleted 27 empty folders — `public/assets/cars/codex/cockpit/source` plus the macOS Finder dup folders (`cops 2`, `props 3`, `ui 3`, `buildings 2`, `music 2`, `assets 2`, etc.) in `dist/` and `ios/App/App/public/`. Intentionally left the three Xcode-managed empty folders alone (`Pods/Headers`, two `xcshareddata/swiftpm/configuration`).
- Memory note saved at `project_dui_asset_workflow.md` documenting source-of-truth (`public/assets/`), derived folders, the music-loaded-dynamically exception, and the sanity-check `comm -23` / `comm -13` commands.

**Building auto-flip rule** ([GameScene.js](src/scenes/GameScene.js))
- Convention: every building/house PNG in `public/assets/buildings/codex/` (and the top-level `buildings/`) is authored as **right-side-of-road** appearance.
- Both render passes (forward scene sprites + rear-view mirror building pool) compute `autoFlipLeft = (sp.type === 'building' || sp.type === 'house') && sp.offset < 0 && !/_left|_right/.test(useTexKey)` and pass it through `setFlipX(!!sp.flipX || autoFlipLeft)`.
- Texture names ending in `_left` / `_right` (PSE office pair, ws crane pairs, west_seattle_horizon pair) are skipped — the spawn code already picks the directional variant per side and a second flip would double-mirror them.
- Result: a single right-side authored PNG covers both shoulders; if a building looks mirrored on the right, the source PNG itself is authored wrong (NOT a code bug) — fix the file.

---

### 2026-05-27 (earlier) — Neon UI art pass, Custom menu overhaul, eastern WA business scenery

**Main menu / loading / Custom menu theme pass** ([GameScene.js](src/scenes/GameScene.js), [BootScene.js](src/scenes/BootScene.js), [AssetManifest.js](src/systems/AssetManifest.js))
- Start-screen button hover/tap highlights were reworked to follow the slanted/parallelogram button shapes instead of rectangular outlines. `LOAD SAVE` was brought closer to Start-button height and its small subtext was removed per art direction.
- Boot/loading screen now uses the neon rainy DUI theme (`ui_loading_screen`) with a gradient-style progress bar.
- Custom mode screen was rebuilt around the neon loading-screen background, a semi-transparent options panel, larger fonts, city-selection emphasis, and button-style toggles instead of checkboxes.
- Custom menu behavior now includes: city start selection, Drive Type selection, Police on/off, Damage on/off, star-outline selector, and a clearer warning that Custom runs do not score.
- Custom start-city selection is applied when gameplay starts; custom no-damage now covers player damage generally, not just NPC damage.

**Top-row HUD button art** ([GameScene.js](src/scenes/GameScene.js), [AssetManifest.js](src/systems/AssetManifest.js), `public/assets/ui/`)
- Replaced generated/vector approximations with the user's actual button PNGs from `Images/`:
  - `button - genre.png`
  - `button - Vol Mute.png`
  - `button - Vol UnMute.png`
  - `button - Map.png`
  - `button - Garage.png`
  - `button - FF.png`
  - `button - FFtap.png`
  - `button - Unpause.png`
  - `button - Pause.png`
- Runtime copies live under `public/assets/ui/top_btn_*.png` and are loaded via `AssetManifest`.
- FF is momentary: outline image normally, solid/tapped image while pressed, resets on `pointerup`, `pointerupoutside`, or `pointerout`.
- Pause is latched: normal/unpaused image until paused, then solid Pause image until unpaused.
- Mute swaps between the user's mute/unmute images based on `audio.muted`; handedness redraw preserves the correct mute state.
- Important gotcha from this pass: Phaser `load.image` showed SVG button attempts as black/blank textures in-game, so these HUD buttons should stay as PNG runtime assets unless the loader path is changed deliberately.
- Genre source art is `150×130`; the runtime copy was padded to `150×150` with transparent space so `setDisplaySize(56, 56)` does not stretch it vertically.

**Eastern Washington scenery expansion** ([RouteData.js](src/road/RouteData.js), [GameScene.js](src/scenes/GameScene.js), [AssetManifest.js](src/systems/AssetManifest.js))
- Added repeatable Cle Elum / Ellensburg style business fronts generated as real raster assets, not temporary vector placeholders:
  - `east_wa_main_street_storefront.webp` — hardware/feed style storefront
  - `east_wa_cafe_storefront.webp` — cafe/diner storefront
  - `east_wa_auto_parts_store.webp` — auto parts/repair storefront
  - `east_wa_market_storefront.webp` — market/general store
- Source sheet archived at `Images/Codex_Concepts/Eastern_WA_Businesses_v1/east_wa_business_sheet.png`.
- Added two simple double-wide/mobile-home style assets:
  - `east_wa_doublewide_tan.webp`
  - `east_wa_doublewide_white.webp`
- Added limited-use landmark / accent assets from existing concepts:
  - `east_wa_vantage_truck_stop.webp`
  - `east_wa_ritzville_diner_motel.webp`
  - `east_wa_palouse_farm_store.webp`
  - `east_wa_pullman_party_house.webp`
- Route logic now separates repeatable business fronts from landmark-style buildings:
  - `EASTERN_BUSINESS_TEXTURES` contains plainer storefronts appropriate for repeated Cle Elum/Ellensburg frontage.
  - Ritzville / Palouse / Pullman showpiece assets are explicit landmark entries in later route windows so they do not repeat as generic filler.
  - `EASTERN_HOME_TEXTURES` rotates weathered houses, abandoned bungalows, and double-wides for dry-side town homes.

**Verification**
- `npm run build` passed after the UI asset wiring and after the eastern WA scenery additions. Vite still reports the existing large-chunk warning.

### 2026-05-27 (late) — Drug HUD grid, pedal repositioning, macOS audio gitignore fix

**Drug HUD — weapon-style icon stack with progress fill** ([GameScene.js](src/scenes/GameScene.js))
- Replaced the legacy text-labeled drug bars with a weapon-style icon stack on the side opposite the weapons (mirrors with handedness). Each cell renders the drug pickup sprite scaled into a `46×42` rectangle with a colored bottom-up fill rising as the bar fills, `alpha = bar level`, and no text label.
- After the first 5-stack overflowed the screen, the layout was promoted to a **2-column grid** so all 10 drugs fit: `5 rows × 2 cols`, outer column populated first (`slotIdx % 2 === 0`), inner column second. Cells are `46×42` with `colGap = 4`, `rowGap = 4`, anchored at `yTop = 65`. Total stack height ≈ 230 px.
- Fill order: `(outer, row 0), (inner, row 0), (outer, row 1), (inner, row 1) …`. Order in `Object.values(DRUGS)` controls which drug lands where.
- Fixed `Phaser.Rectangle.setSize` NPE at `_drawDrugIcons` ~10017 by removing a redundant per-frame `setSize` call (Phaser version edge-case).

**Pedals & wiper repositioned to off-weapon edge** ([GameScene.js](src/scenes/GameScene.js))
- `_applyPedalHandedness()` (~5686): `PEDAL_X = leftHanded ? (SCREEN_W - PEDAL_W/2 - 4) : (PEDAL_W/2 + 4)` — ACCEL / BRAKE now share the off-weapons screen edge with the drug column so the drug grid has the entire weapons-side strip free.
- Wiper button (~8728) mirrored to the same side as the pedals so the entire control column reads as a single unit.

**Title-screen polish — gesture safety, persistence, 18+ disclaimer** ([GameScene.js](src/scenes/GameScene.js))
- Removed tap-anywhere-to-start. Only the green Start button launches the run; other taps on the title surface change the live difficulty / thumbs widgets without consuming the gesture.
- "You should probably be 18+" disclaimer placed next to the Start button.
- Title blurb fade-out scheduled at `3.5 s` via Phaser Tweens (post-load fluff doesn't linger over the artwork).
- Title selections (`titleThumbsPick`, `titleDiffPick`) persist across sessions via the save registry — survives tilt-unsupported fallbacks.
- Tilt iOS permission flow hardened: `requestPermission()` fires from a fresh Start-button gesture, with a DOM-level `touchend` / `click` fallback armed if the initial prompt doesn't surface (Chrome iOS / WKWebView gesture loss). Permission denial preserves `titleThumbsPick` so the player isn't dumped back to "0 thumbs" silently.

**Audio fix — macOS case-folded gitignore** ([.gitignore](.gitignore))
- The 63 MP3s in `public/assets/music/` were being silently skipped by git because `.gitignore` matched `Music/` against `music/` on the case-insensitive macOS filesystem, so Netlify only had the procedural / fallback tracks.
- Fixed by anchoring the pattern to the repo root: `Music/` → `/Music/`. The actual scratch `/Music/` folder at the project root is still excluded; the deployed `public/assets/music/` is now tracked. All MP3s committed in the same change.

**Shrub damage + hot keys** ([GameScene.js](src/scenes/GameScene.js))
- Confirmed shrub glancing-sideswipe cost is `0.5 – 1.0 HP` (per `RouteData.js` spawn metadata) with lateral push only — no warp-to-center.
- `B` warps player position back `0.25 mi`, `N` warps forward `0.25 mi` (clamped at final mile). Companions to existing 1-9 mile warps. All three blocks marked `// REMOVE BEFORE RELEASE`.

**Other small fixes**
- `ghostOffset is not defined` (double-vision pass at [GameScene.js:6985](src/scenes/GameScene.js#L6985)) — variable was renamed to `ghostOffsetBase`; a tire-shadow ref still pointed at the old name. Re-derived `ghostOffset` inline at the call site.
- Powerline wire that abruptly stopped when the closest pole passed the camera now extrapolates horizontally past the closest visible pole using `previous − secondPrev`. Mid-span sag removed entirely (straight 2-point line) per user feedback.

### 2026-05-27 — Title polish, new infrastructure, route content, physics tweaks
A long mixed session — major buckets:

**Title screen overhaul** ([GameScene.js](src/scenes/GameScene.js), [AssetManifest.js](src/systems/AssetManifest.js))
- `_setHudVisible` now also hides HP / gas / accel bar / gas icon / HP damage popup / party clock / drug-bar labels / F12 weapon icons. `_drawDrugBars` and `_drawF12Inventory` early-return when `_awaitingStart`.
- Replaced the title-over-live-road presentation with the authored neon rainy Seattle artwork from `Images/DUI Title Screen.png`; the runtime game loads a compact `800x450` WebP version at `public/assets/ui/title_screen.webp` (about `91 KB`).
- Interactive hit regions align with the artwork's bottom cards: `START`, live `DIFFICULTY`, live `DRIVING TYPE`, and `LOAD SAVE`. Difficulty and driving type repaint only their interior value area so selections can change without disturbing the composed scene.
- Title defaults: Thumbs `2` (classic) and Difficulty `Normal` on first-ever load. Subsequent runs restore the player's last picks from a dedicated `titleThumbsPick` / `titleDiffPick` registry slot — survives even when the underlying steering subsystem falls back (e.g., tilt unsupported).
- Difficulty + steering only commit on the green Start tap so the iOS tilt permission prompt fires from a fresh user gesture. DOM-level `touchend`/`click` fallback armed if the initial `requestPermission()` doesn't surface the prompt (Chrome iOS / WKWebView gesture loss).

**Neon ending screens** ([GameOverScene.js](src/scenes/GameOverScene.js), [GameScene.js](src/scenes/GameScene.js), [AssetManifest.js](src/systems/AssetManifest.js))
- `OVERDOSED` uses a compact `800x450` rainy-Seattle neon background plate (`end_overdose_neon.webp`, about `60 KB`); the full generated PNG source is archived under `Archive/generated-source/ui/`.
- `BUSTED` now uses the authored `Images/DUI Busted Screen.png` artwork through a compact runtime copy (`end_busted_screen.webp`, about `61 KB`). Its baked parallelogram buttons remain visually untouched; transparent shaped hit zones add hover outlines and map `RETRY` to start over, `LOAD SAVE` to the current checkpoint, and `MAIN MENU` to the title screen. A small neon readout above the buttons displays the last saved checkpoint code. The superseded generated Busted runtime plate was moved out of `public/` into `Archive/generated-source/ui/`.
- `CRASHED` now uses the authored `Images/DUI Crashed Screen.png` artwork through a compact runtime copy (`end_crashed_neon.webp`, about `60 KB`). Its baked parallelogram buttons remain visually untouched; transparent shaped hit zones add hover outlines and map `RETRY` to start over, `LOAD SAVE` to the current checkpoint, and `MAIN MENU` to the title screen. It shares the checkpoint-code readout.
- `OVERDOSED` uses an 80s chrome/neon live UI layer with run-report fields for cause, distance/time, losses, and checkpoint code, plus crisis/treatment support lines.
- Ordinary police arrest thresholds now enter the `BUSTED` ending instead of silently resetting into gameplay. Bail loss is assessed once before the ending report; retrying from the checkpoint preserves the post-bail balance rather than applying an additional crash penalty.
- The top-row HUD controls (pause, skip, station, mute, map, and garage) now draw as angled dark-glass neon cells so gameplay and ending screens share the same UI style.

**Tilt steering**
- Proportional analog steering for tilt mode: lower threshold (10° → 3°), `_tiltSteerAmt` value in `[-1, 1]` (full lock at ±20°), used directly as `steerIn` in tilt mode. Lets the player feather the lane line.
- Tilt mode now ignores `_touchLeft / _touchRight` so a player on tilt isn't accidentally also tap-steering.

**Difficulty / speed**
- Fentanyl no longer hard-caps speed to 30%. Proportional `-10 mph per 10% bar` via `baseSpeedMult -= fent * (10/12)` — at 100% fent the top speed lands around 20 mph (from 120).

**Vehicle/water physics — guardrails, dunk, sink animation**
- Guardrail clamp (`0.95`, 3 HP/sec scrape) now fires on every water-adjacent segment: `seg.bridge`, `seg.water` (bridge aprons), `seg.waterLeft` (left-only rail), `seg.waterRight` (right-only rail).
- Water dunk threshold raised `1.05 → 1.5`. Sinking only triggers when a violent impulse (head-on, glitched i-frame) punches the car past the rail. Normal drift just scrapes.
- Multi-stage sink animation: tire shadow disappears first, then progressive sprite crop (tires → lower body → roof) with sprite Y shifted down so the visible bottom stays at the water line. After 1.5 s: -10 HP + warp to road center + 1.5 s cooldown.

**Hot keys**
- `B` warps player position back `0.25 mi` (companion to existing `1-9` mile warps).
- `N` warps forward `0.25 mi` (clamped at final mile).
- All three blocks marked `// REMOVE BEFORE RELEASE` and search-able by `DEV WARP` / `BACK-WARP HOTKEY` / `FORWARD-WARP HOTKEY`.

**Tunnels & overpasses**
- **Wildlife crossing at mile 65.00–65.03** (Snoqualmie Pass). Implemented as a `seg.tunnel = true` + `seg.wildlife = true` short tunnel. Walls are 1/6 of Mercer Island's (`wallW = w × 0.13`). Facade flank polygon is TWO sine-curve mounds (one each side of the arch, peak at mid-flank height = `dropY`) with a semicircular arch + concrete arch ring between them. Dirt + grass band + tree silhouettes paint ON TOP of the ceiling. `H_HILL = 20000`, `W_FLANK = 40000` for wildlife (vs `25000` / `337500` for normal highway tunnels). Normal tunnels (Mt Baker, Mercer Island) keep the original single-peak mountain + rectangular lintel mouth — guarded by `isWildlifeFacade` branches.
- **I-405 freeway overpass at mile 11.45–11.47** marking exists in [RouteData.js](src/road/RouteData.js) but is commented out — held for redesign. The `_drawOverpasses` renderer remains in [Road.js](src/road/Road.js) ready for a future flat-deck implementation.

**Vantage suspension bridge** ([RouteData.js](src/road/RouteData.js), [Road.js](src/road/Road.js))
- New 0.5-mi suspension bridge at mile 134.55–135.05. Middle 50% of segments (`suspT 0.25–0.75`) get `seg.water = true` so the canyon abutments stay on land. `seg.suspension = true` + `bridgeTowerStart` / `bridgeTowerEnd` on the two endpoints + `suspT` (0..1 along span) per segment.
- `_drawSuspensionBridge` in Road.js paints two pylons (with crossbeam + finial dot) at the tower segments, then a catenary cable polyline on each side of the road (sag formula `1 − 4t(1−t)`) connecting tower tops, plus vertical hangers every 4 segments.

**Route content / scenery**
- Sparse-store corridor mile 14–25 — `1.4 buildings/mi`, alternating sides (`makeOne(slot % 2 === 0 ? -1 : +1, ...)`).
- Suburban Bellevue / Issaquah home clusters past mile 13.25 — sine-cadence: clusters every 0.4 mi in the 13.25–14.5 dense window, 0.5 mi past that. 4 homes per cluster at 40 slots/mi packed close. Cluster side alternates per bucket. `_homeClusterSign` tracked into `SPAWN_TREE` so the OPPOSITE side gets trees, never both sides at the same segment.
- Tree density mile 14–25 bumped 22 → 120 slots/mi (was 80) with 20% giant-boost in the eastern stretch.
- Vantage area (mile 128–145) gets 3× vegetation: east_cascades trees 32 → 96/mi, shrubs 40 → 120/mi. Columbia Basin tail (138–145) keeps tripled shrub density (210/mi).
- Rolling-hills overlay (mile 128–145): sinusoidal `hills[]` modulation with two wavelengths (1.2 mi + 0.45 mi) under a sine envelope. Macro grade unaffected.
- Lake Sammamish — painted as a horizontal water band on the LEFT horizon during mile 14.9–16.2 (fades in/out), with a thin dark shoreline silhouette and white glint stripe.
- Milky Way gating — sky band only fades in from mile 200 → 210 (was 110–120). Matches real astronomical darkness; field stars + moon still ramp during dusk.
- Bellevue downtown skyscrapers end firmly at mile 13 (`eastside_urban` excluded from cycle-pool spawn past mile 13).
- Mercer Island homes restored — `isMercerForestOnly = false`. Cycle-pool spawn now drops West Seattle home photos along mile 7.2–9.8 (residential rate of 80 slots/mi). Dense forest behind still fills via the regional tree pass.
- Right-side tree ramp guard — within 1 mi of any rest stop, right-side trees shift to offset 5.0–6.5 (past the ramp's outer edge) so the post-pass ramp clearance doesn't strip them.
- West Seattle home pool walk uses an xorshift mix + anti-repeat step (no more strict A→B→C→D→E→F cycle).
- Cycle-pool same-texture-both-sides bug fixed — right-pool walk offset is `floor(len/2)` with an explicit `if (leftKey === rightKey) rightIdx++`, eliminating mirrored stores across the road in any city.

**Cockpit elevation**
- `ELEV_MULT = CAM.mode === 'cockpit' ? 0.5 : 1.0`. Applied to `seg.y` at `project()` call sites in [Road.js](src/road/Road.js) AND to the segY portion of `cameraY`. Chase mode unaffected. Vantage's steep descent reads much flatter through the windshield.

**Powerlines** ([GameScene.js](src/scenes/GameScene.js))
- Wire extrapolated past the closest visible pole using `previous − secondPrev` X delta (Y locked to `previous.wireA/B`). Wire continues OFF-screen horizontally instead of stopping mid-air when the camera passes a pole.
- Wire sag removed — `connectWire` is now a straight `moveTo / lineTo`. The mid-span sag made the wire appear to dip into the road as a pole approached.

**Shrubs vs other scenery**
- Trees, buildings, cows, landmarks → `_triggerSceneryRespawn` (full crash → recover-lane warp). Cows added to `SCENERY_TYPES` (collidable per spec).
- Shrubs → new `_sceneryGlance(proj, damage)` with light damage (0.5–1 HP per `RouteData.js` spawn), strong lateral push (`xImpulse = pushDir × 0.18`), zeroed inbound steerVelocity, 200 ms i-frame. NO speed cut, NO warp, NO "CRASH" popup. The bush gives way.

**Other gameplay fixes**
- Trees made collidable everywhere: regional Mercer trees, dense-forest far rows, the East WA barn, livestock — all had `collidable: false` that's been removed.
- Double-vision green-ground bug fixed: ghost-road pass (`_drawSegment(ghostG, ..., isGhost=true)`) skips full-width grass / water / bridge / tunnel-wall fills so the offset ghost doesn't overlay green grass on top of the player's road.
- Ghost lateral offset scaled by perspective (`proj.sw / 200`) — far ghosts no longer fling halfway across the screen.
- Tire-shadow suppression when sink animation is active (shadow vanishes before tires submerge).

### 2026-05-27 — Wiper controls/animation and eastern WA utility lines
**Windshield wipers** ([GameScene.js](src/scenes/GameScene.js), [AssetManifest.js](src/systems/AssetManifest.js))
- Replaced the ambiguous wiper-button glyph with a conventional windshield/single-blade icon and moved the button directly beside `BRAKE`; it mirrors with the pedal column when handedness changes.
- Cockpit view now reuses two copies of `beater_wiper_arm.png`: a left-mounted blade and a center-mounted blade, both parked pointing right and sweeping together through `0° -> 100°`.
- Corrected stretched/thin blade rendering by preserving the source aspect ratio, then lengthened/spread the pair so the high sweep approaches the rear-view mirror.
- Third-person view now uses the same paired image-based blade effect instead of thin procedural lines.
- Fixed the weather-exit state bug: when the rain/snow wiper button disappears, active wipers immediately shut off and park so the player cannot be stuck with no OFF control.

**Eastern Washington utility lines** ([RouteData.js](src/road/RouteData.js), [GameScene.js](src/scenes/GameScene.js), [AssetManifest.js](src/systems/AssetManifest.js))
- Added two compact transparent utility-pole runtime assets: `east_wa_utility_pole_plain.webp` and `east_wa_utility_pole_transformer.webp` (`256x512`, roughly `38 KB` combined). Full generated PNG sources remain archived under `Archive/generated-source/eastern-scenery/`.
- Added a memory-conscious projected utility-line renderer: a small reusable pole sprite pool plus procedural sagging wires, rather than dense route sprites or long strip images.
- Utility lines currently appear around Cle Elum and Ellensburg, plus selected farther-east open stretches; fenced pasture runs, bridges/tunnels/water, and rest-stop ramp corridors suppress pole placement.
- Pole spacing is calibrated to approximately `200.7 ft`. Plain poles are the default; transformer poles occur more often near Cle Elum/Ellensburg home frontage and every fifth pole in open-country runs.

**Verification**
- `npm run build` passes. Vite's existing large Phaser-chunk warning remains informational.

### 2026-05-26 (late) — Cockpit POV pass, Netlify deploy, trophy threshold
**Cockpit POV overhaul** ([GameScene.js](src/scenes/GameScene.js), [src/constants.js](src/constants.js), [src/utils/Helpers.js](src/utils/Helpers.js))
- Default view is now **3rd-person chase**; V toggles into cockpit. `_buildCockpit()` is followed by `_leaveCockpitView()` at scene start.
- Mutable `CAM = { height, depth, eyeForwardZ, horizonY, mode }` profile. Cockpit values: `horizonY: 130`, `depth: 0.92`, `eyeForwardZ: 4500`, `height: 1200`.
- Shared horizon: `project()` now takes optional `horizonY` so road polygons AND sprite/NPC samples converge to the same vanishing Y.
- NPCs use `_renderCamPos` so cockpit and chase share one camera basis — fixed "tiny cars next to me" by aligning sprite scale to the unified projection.
- Near-cull is view-aware: relZ < 100 in cockpit, < 1950 in chase, so cars exit screen sides instead of disappearing under the dashboard.
- HUD popup Y depends on `_cockpitActive` — popups land on the dashboard (not below the rear-view mirror) in cockpit.
- Pedal handedness: `_applyPedalHandedness()` mirrors ACCEL/BRAKE to the opposite side from weapons; both buttons moved fully to the screen edge.

**Bridge & tunnel visuals** ([src/road/Road.js](src/road/Road.js))
- West Seattle Bridge: water charcoal `0x0E1014` (was blue), foam/glints suppressed on bridge segments. Distant treeline silhouette painted on water/floating-bridge segments to break the "cranes in water" read. `bridgeFrontGfx` occluder at depth 4 re-paints WSB guardrails above cranes (`renderDepth: 2`) — **don't merge back into roadGfx**.
- Mercer Island tunnel facade: board-form lines on lintel, pour seam, mouth-shadow border, hillside weathering streaks.

**Tree density** ([src/road/RouteData.js](src/road/RouteData.js))
- Downtown Seattle: 120 → 600 slots/mi, `_treeHeightBoost: 1.5`. Added `SEATTLE_STREET_TREES` (deciduous-weighted).
- Mercer Island: 60 → 400 slots/mi with `_denseStreetTrees`, `_treeBigBoostChance: 0.35`, big-boost 2.0–3.0×. Forest-lot rows 72 → 130 with outer rows scaled 2.1× and 20-30% giants.
- `SPAWN_TREE.pushOne` now accepts a regional `heightBoost` (or random big-boost roll).
- Mercer Island house setback pushed 1.25 → 2.75 car-widths past fog.
- Removed "west" tag after the first bridge.

**iPhone-menu chip recalibration** ([index.html](index.html)) — trophy `108 505 120 120`, lock `275 505 120 120`, hand `108 680 120 120`.

**Trophy threshold: 100% → 99%** for maxed-drug achievements ([GameScene.js](src/scenes/GameScene.js) ~5216, [AchievementSystem.js](src/systems/AchievementSystem.js) 117-122). 100% sits at the OD edge ("dead"); 99% reads as "maxed out" without forcing the player to a one-pickup-from-death brink. All 6 descriptions updated ("Hit 99% …").

**Web shipping path** ([netlify.toml](netlify.toml), [package.json](package.json))
- Pivoted from TestFlight to **Netlify web distribution** (no Apple Developer enrollment).
- GitHub repo set up; Netlify auto-deploys on push to main.
- Resolved repeated Netlify build failures:
  - **Rollup native binary missing** on Linux: pinned `@rollup/rollup-linux-x64-gnu` (plus darwin-arm64/x64) in `optionalDependencies`. Also held `NODE_VERSION = "18"` so npm 9 ships (avoids npm 10's optional-deps bug).
  - **"Unrecognized Git contributor"** on Netlify private-repo gate: user set `brendanbaughn@gmail.com` as primary on GitHub, switched git author email, pushed empty commit to re-trigger.
- iOS tilt-steer + accelerometer permission flow works against the live Netlify HTTPS URL.

### 2026-05-26 — Mercer/tunnel fixes, eastern WA rural scenery, OD/damage polish
**Damage and endings**
- Critical HP now adds progressive procedural windshield cracks in all view modes, starting at roughly 10 HP and worsening toward `WRECKED`.
- Low-HP smoke is visible in cockpit view as well as chase view.
- `WRECKED` has a shattered-windshield overlay; overdose now freezes the final road frame, fades to black, then presents the `OVERDOSED` ending.
- Fixed a restart freeze after overdose: `_odEnding` survived Phaser scene reuse and kept a Vantage/checkpoint restart permanently frozen. `GameScene.init()` now clears it on every new run.

**Drug rule update**
- Beer now removes `5` percentage points from every other drug bar only when that bar is above `45%`.
- Example: heroin `60% -> 55%`, while heroin `45%` remains `45%`.
- Updated the beer description in `AchievementSystem.js` to match the implemented rule.

**Mercer Island and tunnels**
- Mercer Island roadside housing was replaced with forest-only lots using reused tree assets for a lower-memory wooded look.
- Tunnel rendering was iterated to prevent cars, blue sky gaps, and portal/background scenery from showing through tunnel walls or curved sightlines.
- Tunnel mouth/facade masking and wall occlusion behavior now live in `Road.js`; visually drive-check Mercer entrance, interior curve, traffic occlusion, and exit angles before considering this fully closed.

**Eastern Washington scenery after Vantage**
- Added compact transparent WebP runtime assets for dry-side buildings:
  - `cle_elum_general_store.webp`, `ellensburg_main_street_shops.webp`
  - `east_wa_weathered_house.webp`, `east_wa_abandoned_bungalow.webp`, `east_wa_barn.webp`
  - `east_wa_two_story_brick_shop.webp` and `east_wa_block_repair_shop.webp`
- The original raised-sign dilapidated market repeated the same general-store silhouette too closely; it is no longer actively loaded and is retained at `Archive/retired-runtime/eastern-scenery/east_wa_faded_market.webp`.
- Source originals remain under `Archive/generated-source/eastern-scenery/`; runtime uses cropped/compressed WebPs.
- Eastern town windows now place one business plus only `4-6` homes, then transition into farm/brush country. Post-Vantage businesses alternate flat-roof silhouettes instead of repeating the same store.
- Columbia Basin/Palouse dressing was shifted toward shrubs with sparse pines, so brush outweighs trees.

**Fences and cattle**
- Added one reusable fence-post WebP (`east_wa_fence_post.webp`, under `1 KB`) with procedural rail lines and pooled post rendering.
- Fence posts are route-anchored and move toward/past the player while driving rather than being camera-fixed.
- Short fenced pasture runs recur every few miles after Vantage; only alternating fenced runs contain cattle.
- Added three reusable, horizontally flippable cow-group assets (`east_wa_herd_3_cows.webp`, `east_wa_herd_5_cows.webp`, `east_wa_herd_6_cows.webp`). Final artwork is cows-only with spacing/perspective variety and no steer imagery.

**Other**
- ACCEL/BRAKE controls were moved to the side opposite weapon controls.
- Added a TODO for lightweight smashable roadside objects: cones, boxes, barrels, and trash cans; pedestrians remain a separate design choice.
- Mushroom “melt” projection was introduced for high shrooms and reduced from its stronger experimental amplitude to the current moderated maximum.
- `npm run build` passes. Vite's existing large Phaser-chunk warning remains informational and unrelated to the added image assets.

### 2026-05-25 — Mercer Island ramp polish + 21-bug audit sweep
**Ramp clearance for Mercer Island homes:** Right-side WEST_SEATTLE_HOMES near rest stops were sitting in the off-ramp gore wedge. Added a `rampClearance` flag on right-side cycle-spawned buildings within `(rs.mileage − 1.0, rs.mileage + 0.3)` (only the right side — there is no left-side off-ramp). Renderer + collision pass both:
- Push the home past the ramp's outer edge via `visualOffset = ±(rampOuterEdge + 0.30)` when `rampStrength > 0.30` (was 0.40 — the lower threshold catches the rs=0.30–0.40 band where the ramp paint already touches a 2.05-offset home).
- Apply a +80 px screen-x nudge (sign-aware) and a 0.88× shrink so the home reads as set back without flying into horizon-distance.
- The earlier 0.35-mi pre-exit corridor wipe (`RouteData.js:1521`) was deleting `rampClearance` homes from mile ~9.15 forward; added an early-return so they survive.
- The dynamic `SCENERY_ROAD_CLEARANCE` re-sample (renderer + collision) now skips `rampClearance` sprites so the +80 px shift isn't wiped by a second `sampleSurface` call.

**Parallel four-agent code audit:** spawned drug/HP, cops/wanted, road/scenery/collision, and rest-stops/UI/save-state agents in parallel. Consolidated findings into a 21-bug ranked list and fixed all of them, plus polish:

**Critical state-corruption fixes**
1. **`_customFlags` leak through Start Over** — pause Start Over now wipes `_customFlags` / `_customStartStars` / `_customStartLevels`; `init()` also unconditionally resets them (was `??`-preserved, so a Custom run's `noPolice` silently disabled cops in the next Normal launch). [GameScene.js:303-308](src/scenes/GameScene.js#L303), [:795-815](src/scenes/GameScene.js#L795)
2. **Save-code length** — popup bumped 4→5 chars (Easy/Hard codes were silently downgrading to Normal). Custom mode now emits `customSub`'s letter (E/N/H) instead of unparseable 'C'. [GameScene.js:8855-8875](src/scenes/GameScene.js#L8855), [:9098-9145](src/scenes/GameScene.js#L9098)
3. **OD check** now uses `cfg.odThreshold` per drug — heroin OD at 0.88, meth 0.85, ket 0.90, rx 0.97 (was hard-coded `> 1.0`, unreachable because pickup clamps at 1.0). Alcohol/weed/coke/fent stay safe via their 1.0 threshold. [DrugSystem.js:354-365](src/systems/DrugSystem.js#L354), [:451-466](src/systems/DrugSystem.js#L451)
4. **GameOver Start Over** now mirrors the pause-menu registry wipe (`drugUnlocks`, `drugProgress`, `lastRestStop`) — was just `scene.start('Game')` with no cleanup. [GameOverScene.js:288-302](src/scenes/GameOverScene.js#L288)
5. **RESTOCK chain-unlock** — `refillAll` no longer writes to `maxReached`; it was silently chain-unlocking LSD/fentanyl whenever the shrooms/heroin bar got refilled. [DrugSystem.js:99-115](src/systems/DrugSystem.js#L99)
6. **L/R texture sides swapped** — Bellevue `*_left` directional facades were placed on the right side of the road. Spawn now correctly does `makeOne(-1, leftKey, false); makeOne(+1, rightKey, onRamp)`. [RouteData.js:888-925](src/road/RouteData.js#L888)

**Visible / impactful**

7. **Meth speed bonus** now also applies to cruise + boost + `_maxSpeedWithBoost` (was only on the displayed speedometer — car never actually accelerated to it). [GameScene.js:2403-2414](src/scenes/GameScene.js#L2403), [:9303-9311](src/scenes/GameScene.js#L9303)
8. **Hitchhiker PARTY FAVOR** now bumps `maxReached`, increments `pickupCounts`, runs `_checkUnlocks`, AND mixes in a cash bonus alongside the drug fill (was a silent direct level-set that bypassed every side effect). [GameScene.js:4900-4925](src/scenes/GameScene.js#L4900)
9. **REPAIR CAR** fills to `VEHICLES[id].hp` (125 for playdoutS3X), not flat 100. [RestStopScene.js:1009-1014](src/scenes/RestStopScene.js#L1009)
10. **Disguise** zeroes all four bump counters (rear / head-on / pit / general) — was leaving rear/head-on/pit intact, so one more bump after disguise = instant BUSTED. [CopSystem.js:470-484](src/systems/CopSystem.js#L470)
11. **Heat penalty** now skips disguise + spike_strip (the cleanse weapon was rolling 25% to re-add a star on the same tap that zeroed them). [GameScene.js:5414-5425](src/scenes/GameScene.js#L5414)
12. **Arrest** now resets `_drugBumpFired` / `_drugBumpCount` / `_npcCrashesPostDrink` — without this, the Path-B drug-bump star gate was permanently disabled after the first arrest. [GameScene.js:9374-9384](src/scenes/GameScene.js#L9374)
13. **Hitbox parity** — collision pass now mirrors the renderer's `SCENERY_ROAD_CLEARANCE` push (Bellevue/general buildings used to crash at the unshoved offset while painted further away). [GameScene.js:3275-3300](src/scenes/GameScene.js#L3275)
14. **F12 double-fire gate** — `_useTopF12` checks `_f12FiredThisFrame`, reset each `update()` (tap-icon + hold-F was burning two tokens per intent). [GameScene.js:1749-1752](src/scenes/GameScene.js#L1749), [:5432-5439](src/scenes/GameScene.js#L5432)
15. **gameTime + party clock** pause until first tap in fresh ready-state (contradicted the documented behavior). [GameScene.js:1856-1864](src/scenes/GameScene.js#L1856)

**Edge cases**

16. `rampClearance` threshold tightened 0.40→0.30 (see ramp polish above). [GameScene.js:6437-6448](src/scenes/GameScene.js#L6437)
17. `rampClearance` sprites skip the dynamic road-clearance re-sample so the +80 px screen shift isn't dropped. [GameScene.js:6471-6482](src/scenes/GameScene.js#L6471)
18. **Helicopter lock** threshold tightened 4.5→4.75 — stars stuck at exactly 4.5 used to lock out decay forever. [CopSystem.js:548-557](src/systems/CopSystem.js#L548)
19. **Custom death-respawn stars** — `_customStartStars` now re-applies in `_resumeFromPosition` (was only consumed in `_startGameplay`, so Custom respawn dropped to 0★). [GameScene.js:982-989](src/scenes/GameScene.js#L982)
20. **Unified modal flag check** — added `_anyModalOpen()` helper covering `_modalOpen` + `_mapModalOpen` + `_garageModalOpen` + `_sliderModalOpen` + `_achievementsModalOpen`; scene-level pointer handlers now read through it. [GameScene.js:5050-5065](src/scenes/GameScene.js#L5050)
21. **Rx NPC shift sign-aware** — Rx shift now applied in the direction of NPC travel (oncoming slows toward 0, never flips). Previously ≥ 15 Rx pickups would reverse-direction slow oncoming traffic. [GameScene.js:2899-2920](src/scenes/GameScene.js#L2899), [:2942-2954](src/scenes/GameScene.js#L2942)

**Polish**
- **MPH display** ceil-clamped so cars rolling < 1 mph read as "1" not "0" ([GameScene.js:8048-8050](src/scenes/GameScene.js#L8048))
- **Addiction weighting** switched from linear (`count × 0.4`) to sqrt-scaled (`√count × 1.6`) so 30+ pickups no longer permanently lock out other drugs at 13:1 odds ([DrugSystem.js:415-422](src/systems/DrugSystem.js#L415))
- **Scene sprite pool exhaustion counter** — `_sceneSpritePoolExhausted` increments when the 400-slot pool fills, for future F3-overlay surfacing ([GameScene.js:6413-6420](src/scenes/GameScene.js#L6413))

**West Seattle phantom-crash fix:** Photo-based homes (West Seattle / Mercer Island) spawn as `type: 'building'` but share the same wide padded PNGs as Mercer Island houses. The 0.22 narrow `collisionWidthFraction` only triggered for `type === 'house'`, so West Seattle homes used the default 0.65 — extending the hitbox ~30% into transparent PNG padding. ~25% of West Seattle drive-bys felt like "home pulls away at the last second but I still crash." Fixed by detecting `texKey.startsWith('west_seattle_')` and applying 0.22 there too (collision pass + debug overlay). [GameScene.js:3310-3322](src/scenes/GameScene.js#L3310), [:5846-5856](src/scenes/GameScene.js#L5846)

### 2026-05-14 — Scenery cleanup + new sprite assets
**Roadside scenery cleanup:** Disabled the generic per-segment tree/shrub scenery pass in [RouteData.js](src/road/RouteData.js). The repeated natural sprites were reading as shrub piles and adding clutter; route identity now comes from authored buildings, long roadside strips, and sparse skyline.

**Rest-stop exit strips:** Added long transparent roadside strips for exit/rest-stop approach scenery:
- `public/assets/buildings/codex/bellevue_roadside_strip.png`
- `public/assets/buildings/codex/issaquah_roadside_strip_perspective.png`

Those are registered in [AssetManifest.js](src/systems/AssetManifest.js), profiled in [GameScene.js](src/scenes/GameScene.js), and placed near rest-stop exits in [RouteData.js](src/road/RouteData.js). They are non-collidable scenery and intended to replace repeated tiny homes/shops/shrubbery near exit lanes.

**Drug sprite remake:** Replaced all ten drug pickup sprites in `public/assets/drugs/` with more detailed arcade-style transparent assets using the existing filenames/manifest keys: beer, weed, cocaine, shrooms, LSD, heroin, Rx, fentanyl, ketamine, meth. No code path change needed; the existing manifest still loads them.

**NPC / prop art generated and stored:** Added new transparent PNG assets:
- `public/assets/hookers/sex_worker_1.png`
- `public/assets/hookers/sex_worker_2.png`
- `public/assets/props/hitchhiker_1.png`
- `public/assets/props/hitchhiker_2.png`
- `public/assets/props/overhead_powerlines_long.png` (4096×1024 long strip)

These are stored only as assets so far; the hitchhiker/sex-worker art is not yet wired into gameplay rendering, and the powerline strip is ready for a future scenery pass.

**Validation:** Syntax checks passed for [RouteData.js](src/road/RouteData.js), [GameScene.js](src/scenes/GameScene.js), and [AssetManifest.js](src/systems/AssetManifest.js).

### 2026-05-12 — Phone-as-Menu + per-vehicle art + warps
**Phone-as-menu (HTML overlay):** CSS-driven portrait overlay, tap-to-unpause after rotation, lock-pause chip, trophy chip, in-world clock on Calendar, Map modal (SVG vertical route + live player dot), Garage modal (vehicle picker with accessory badges), Music app (genre → song picker, shuffle all/genre), Checkpoint dock-tap warps, steering-app selection stroke. PNG-pixel hit-zones with JS auto-positioning + `?debug` / `?calibrate` URL modes.

**Per-vehicle art:** Six vehicle PNG pairs (front+back) wired: Used Sedan (white) · Used 4x4 SUV (blue) · Used Truck (truck blue) · Electric Truck (orange) · Electric Roadster (green) · Bestla Play'dOut (blue2). Aspect-preserving sizing at 90 px wide.

**Title screen:** Wheel flipped to right, START button removed (tap-to-launch). Uniform 2-px white stroke on all panels. Custom mode picker adds Easy/Normal/Hard gameplay sub-difficulty.

**Warps:** Forward warps drain gas equal to trip distance. Custom-mode warp sets `warpForward` flag. Per-difficulty respawn lane.

**Damage tuning:** Tunnel slam 3 HP, scenery 10 HP (× difficulty mult). Floating "-X HP" popup next to HP for 1.5 s. Camp-repair "N/A" guard when HP ≥ 65% target.

**Signs:** Round decimal mileages. Tunnel-landing signs walk backward to just before tunnel mouth.

**Rest-stop UX:** BACK button moved to top-left corner so it stops covering SAVE CODE.

**Party clock fixes:** Reset on difficulty pick. `_partyClockSecMax` stored alongside `_partyClockSec` for phone-menu clock UI.

**Rear-view mirror:** Draw distance extended 9k → 36k units. Traffic-array despawn extended to -35k so cars survive long enough to be visible to the horizon.

**HUD layout:** Default handedness flipped to LEFT (weapons on left). Shift+L toggles. HP / Mi text inboard of weapon column. Gas icon center-side of gas text (dynamic positioning per frame). Music genre 17 → 22 px. Weapon cells +15% size. Score + clock follow drug bars in handedness flip.

**Modal-close bug:** Map / trophy / garage close was firing the title's "any tap" handler. Fixed with `_*ModalJustClosed` flags + 50 ms grace.

### Earlier "Overnight Build Notes" — Achievements + party clock + custom mode
- **Phase 4 — Achievements:** Full AchievementSystem with tiered toasts and Achievements page modal.
- **Phase 7 — Party clock + Pullman finish:** Color-shifting HUD clock, ON TIME / TOO LATE / TOO LATE+5★ branches, NPC vignettes.
- **Custom Mode:** Drug-slider modal at run start, no score awarded.
- **LSD rainbow** moved into Road.js (behind road instead of top of stack).
- **Code audit:** Removed dead `shrooomsMax` / `heroinMax` / `lsdMax` fields. Initialized `_comboActivatedAt` in DrugSystem constructor.

### Risky issues flagged for review (still open)
1. **CopFleet pit cooldown** — design decision: total cool-off ≈ PIT_COOLDOWN + recovery vs PIT_COOLDOWN. Tune-time.
2. **Title-letter tweens on `repeat: -1`** — leak ~9 tweens per scene start, not yet killed on title destroy. Stable in practice.
3. **`_methPhase1` init order** — works (undefined coerces to false) but fragile. Easy one-line constructor fix.
4. **RouteData modulo loop** — `for (let i = tunnelStart; i !== tunnelEnd; i = (i + 1) % count)` will infinite-loop if start === end. Add guard.
5. **EffectsSystem optional chaining** — unnecessary `?.` calls on always-present `this.audio`. Style/perf, not bug.
6. **Console.logs** in init + weapon-fire — production noise; keep for debugging or delete.
7. **Slider `pointerup` listeners** — leak if modal is open during scene restart. Edge case.

### 2026-04-30 session — Tunnel embankment + pause menu + per-victim FX
- Mt-Baker tunnel embankment (concrete hillside above tunnel mouth + side pillars)
- Pause menu Start Over + From Checkpoint buttons moved below player car
- Per-victim weapon FX (windshield star, victim spin/roll instead of vanish)
- HUD radio polish (mute / music-note buttons)
- Sign sizing bumps
- Drunk drift gate (sign text "floats" only when alcohol ≥ 1.0)
- Topography scale bump (ELEV_SCALE 80 → 140)
- **Open from that session:** doubled sign-text at 0% alcohol; user wants thinner sign font (currently Impact); user message ended mid-sentence with "As for Start Over..." — never followed up

---

## 9. Important traps & gotchas

### Phaser scene-reuse hazard
`scene.start('Game')` reuses the **same instance**. Stateful flags (`_takingExit`, `_continuing`, drug-bump counters, HUD cache refs `_f12Texts`/`_drugLabels`) MUST be explicitly reset in `init()`. Otherwise prior-run state silently breaks the next visit.

### Vite HMR cache
Edits sometimes serve a stale module export (`SCREEN_H not exported`, `Wallet not exported`, etc.). Source is always fine. Fix:
```
pkill -9 -f "node.*vite"
rm -rf node_modules/.vite
npm run dev
```

### Difficulty change without scene restart
Party clock is initialised in `_doCreate()`. Tapping E/N/H on title now resets `_partyClockSec` + `_partyClockSecMax` explicitly so the clock matches the chosen mode.

### Modal-close vs "any tap" handler
Title screen's scene-level `pointerdown` handler fires AFTER any modal's close handler destroys its buttons. Use a `_*ModalJustClosed` flag with `setTimeout(50)` to prevent the closing tap from launching a race.

### iPhone Safari toolbar (NOT in PWA mode)
In regular Safari tab mode, the bottom toolbar reserves ~50 px of viewport. PWA mode (Add to Home Screen) removes the toolbar; the menu reaches the home-indicator gesture area. Use `viewport-fit=cover` + `top/right/bottom/left:0` + `min-height: 100svh` for full coverage.

### Image aspect calibration
Phone-menu PNG is 1408×2641 (aspect 0.533). `object-fit: cover` scales to fill, cropping the wider dimension. JS computes `scale = max(vw/imgW, vh/imgH)` and `offX/offY = (viewport - scaled) / 2`. Hit-zone `data-px` is in PNG-pixel coords so positioning auto-tracks on every device.

### Bridge occluder layer (West Seattle Bridge)
`bridgeFrontGfx` is a separate Graphics layer at depth 4 that re-paints the WSB guardrails **above** the port cranes (cranes render at `renderDepth: 2`). Do **not** consolidate this back into `roadGfx` — the cranes would visibly punch through the railings again.

---

## 10. Controls reference

### Keyboard
- Arrows / WASD: steer · UP boost · DOWN brake
- F: fire selected weapon · Q: cycle weapon
- R: cycle radio station · M: mute
- SPACE: pause/resume · ENTER: confirm/start
- Shift+L: toggle handedness
- 1-9: **DEV WARP — REMOVE BEFORE SHIP**

### Touch
- Steering modes:
  - **Tap (Flappy, default):** constant left pull; right input fights it; left input does nothing
  - **L/R buttons:** classic taps on left/right thirds of screen
  - **Tilt:** Capacitor accelerometer
- Bottom corners: BRAKE pedal (left) · ACCEL pedal (right) — both **toggle**, mutually exclusive
- Top-right: pause chip · mute · skip-track · note (cycle station) · wiper (rain only)
- Each weapon icon is its own tap-to-fire hit zone
- **Rotate phone vertical** → phone-as-menu pauses game

---

## 11. Quick-start for a new contributor

1. `cd DUI && npm install && npm run dev`
2. Open `http://localhost:3000/` (or `?debug` to see hit zones)
3. Read this file
4. Skim [GameScene.js](src/scenes/GameScene.js) (the monolith) — it's where 80% of edits land
5. Test the route by playing through OR using the DEV WARP digit keys (just remember to delete it before ship)
6. Latest session work is at the top of this file's **Major build-history** section.

**If something blew up:** check Vite cache first. Then re-read this file for traps. Then dig in.

---

# Chapter 8 — Mission System Plan (locked 2026-07-13, rev. B after external review)

Design locked with Brendan; incorporates ChatGPT review feedback (2026-07-13). Presented
to players as "Favors" / "Side Work" — shady character-driven roadside deals, not quests.

## Locked design decisions

- **Offer surface: NPC conversations** (dialogue trees). Every actionable stop BEFORE
  Pullman always has at least one persisted offer (the stop's NPC always has a "Need
  anything?" branch). Pullman = payoff-only (final deliveries, callbacks, epilogues).
- **Concurrency: ONE ACTIVE PER TYPE** (5 theoretical / ~3 practical). NPCs acknowledge
  occupied types ("You're already hauling for Marcy…").
- **Rep multipliers: Rookie (0–2) ×1 → Known (3–7) ×2.5 → Legend (8+) ×5** (Brendan's
  override of reviewer's ×1.3/×1.7 — justified by the 2026-07-13 realistic upgrade
  reprice: Legend jobs ≈ $900–1,500 vs $1,200 snow tires / $1,800 brakes).
- **Payout formula:** `base + routeMiles×$/mi + riskBonus + conditionBonus`, then × rep
  multiplier. Scale by ACTUAL MILES + corridor risk (snow/wind/sparse/police), not stop
  count (gaps range 3–28 mi). Tier widens the mileage window: Rookie 6–22 mi, Known
  15–45, Legend 25–75 (often crossing a hazard corridor).
- **Failure: no payout only.** Rep NEVER decreases; `missionStats` (accepted/completed/
  failed) + `npcMemory` drive short-term skeptical dialogue that later successes repair.
- **Variety via TERMS (modifiers), not more types.** V1 terms: fragile (HP-damage cap),
  perishable (deadline), illegal (+wanted gain while carrying). Later: leaking, oversized,
  do-not-open, nonstop, no-repairs, double-or-nothing, rival courier…
- **Offer anatomy:** the ask · the destination · the catch · the money — with
  interrogation choices ("What's in it?", "Make it worth my time" haggling that trades
  payout against terms).

## Type-specific rules

- **Delivery** — cargo = a terms bundle; wreck/busted = fail; fail survives checkpoint
  rewind (terminal state).
- **Timed leg** — deadline stored as a PARTY-CLOCK value (`deadline = currentPartyClockSec
  − budget`) so it survives pause/rest stops/reload; arrival measured at the target EXIT.
- **Passenger** — temperament + one gameplay concern (nervous/fugitive/carsick/thrill-
  seeker…), base fare + optional tip condition, ~3 mileage-triggered comments through the
  existing message machinery.
- **Heat escape** — offered only at 2+ stars, target ≥20 mi, arrive at 0 stars. Two terms
  at offer: "lose them naturally $X" vs "any trick you want $X/2" (paid heat-clearing
  services allowed but halve it — a choice, not an invisible ban). Busted = fail.
- **Weather run** — AUTHORED corridor contracts only: North Bend(32)→Cle Elum(84) pass
  contract; Ellensburg(109)→Othello(184) Vantage-wind contract. Conditions like "≤15 HP
  damage" / "keep cargo intact"; "no chains" is a Legend dare with a big bonus, never the
  default. Spawn only before the corridor + when the hazard is active.

## Architecture

- **Dialogue trees:** explicit `nodes` map + `startNode`; EVERY choice declares `next` or
  `end:true` (no implicit close inside trees — data omissions must be visible). Legacy
  single-step cards (top-level line/choices) keep current behavior. `missionOffer` nodes
  instantiate + PERSIST the offer on first display (no reroll on reopen); declined offers
  stay declined for the run; acceptance is idempotent (double-tap safe).
- **Mission state:** stable instances `{ id, templateId, type, originStopId, targetStopId,
  acceptedAtMile, targetMile, payout, status, terms{}, progress{}, paid }`. The `paid`
  flag guards double-award across scene transitions/autosave/resume.
- **Save routing (critical):** `missionRep`, `missionStats`, `npcMemory` → add to
  SaveSystem GLOBAL_KEYS (slot-global; otherwise they would silently be per-steering-
  mode). `activeMissions` + persisted offers = run state → include in
  `_collectSaveSnapshot()` + rest-stop/live-run snapshots. Terminal failures survive
  checkpoint rewind. Custom mode: missions unranked (no pay/rep) or disabled.
- **HUD:** ONE tracked mission chip (auto-priority: expiring timer → nearest target →
  manual; tap to cycle) + a "+N JOBS" badge; full list in the phone. Chip shows only
  decision-relevant info (`📦 VANTAGE · 14 MI · $185` / `FRAGILE — 9/15 DMG`). Arrival
  cue near the target exit.
- **NPC memory / continuity (the secret weapon):** lightweight `npcMemory[npcId] =
  { jobsCompleted, jobsFailed, lastOutcome }` driving authored callbacks (waitress
  comments on the pie's condition; tow driver knows you wrecked her job).

## Build phases (rev. B)

1. **Dialogue foundation** — node renderer (separate from effect resolution), explicit
   exits, offer persistence, legacy compat; retrofit 3 cards incl. one recurring callback.
2. **Mission lifecycle** — MissionSystem, canonical state, acceptance guards, snapshot
   support, stats; ship DELIVERY first.
3. **HUD + arrival experience** — tracked chip, phone list, approach cue, payout
   idempotency, NPC re-encounter lines.
4. **Timed + Passenger** — party-clock deadlines, temperaments, comments, tips.
5. **Heat + Weather** — star integration, paid-clear detection, corridor contracts,
   damage/chains checks.
6. **Reputation + authored continuity** — tier dialogue, npcMemory chains, Legend
   contracts.
7. **Balance & abuse testing** — income per run by source (recordEarn tags), offer/accept/
   complete rates, checkpoint-reload duplication tests. Sprite/distance income revisited
   HERE with real data (sprites stay $10×mult until then).

---

# Chapter 9 — Ground Tile Art Spec

# Road Trip Roulette — roadside ground tile spec

**This is NOT the same as the biome parallax bands** (see Chapter 10). Those are distant
mountain silhouettes on the horizon, seen edge-on. These are the **ground surface itself** —
the dirt, grass and gravel immediately beside the road — seen from **straight above**.

The renderer takes this flat overhead tile and applies the road's own perspective to it per
segment, so it tracks hills and curves. Which means:

> **Do not draw any perspective into the tile.** No vanishing point, no
> receding ground, no horizon. If perspective is baked in, it gets applied
> twice and the ground shears.

Finished PNGs go in `public/assets/scenery/ground_textures/final/`.

---

## Non-negotiable technical rules

1. **1024 × 1024 px PNG. Power-of-two is mandatory.**
   The tile is uploaded with `GL_REPEAT`, which on WebGL1 requires
   power-of-two dimensions. A non-POT tile makes the code disable the whole
   ground layer and log a warning — it will not render at all. 1024 is the
   proven size; 512 or 2048 also work. 1000 or 1200 do **not**.

2. **Seamless in BOTH axes.** It tiles infinitely left-right *and*
   forward-back. Check by assembling a 2×2 and looking for edges or a cross.

3. **Straight-down orthographic view.** Camera directly overhead, no tilt,
   no perspective, no horizon.

4. **Flat, even, directionless lighting.**
   No cast shadows, no sun direction, no vignette, no darkened corners. Baked
   lighting repeats visibly across the tile grid and fights the game's own
   time-of-day and headlight system. Ambient, overcast, shadowless.

5. **Fully opaque.** No alpha channel needed.

6. **No dominant hero feature.** One distinctive boulder, log or bush will
   reappear on a regular grid and instantly read as wallpaper. Keep it evenly
   busy — many small features, no focal point.

---

## Scale — the thing that got this wrong the first time

Each tile covers roughly **48 feet of real ground** (`TILE_FT` in
`src/road/GroundPlane.js`). At 1024 px that is about **21 px per foot**:

| Real feature | Size in the tile |
|---|---|
| 3 ft grass clump | ~64 px |
| 1 ft weed tuft | ~21 px |
| 6 in stone | ~11 px |
| 2 in gravel | ~4 px |

Aim for detail at that scale. The first tile was authored assuming ~6 ft per
tile, which made every feature roughly 8× too small — the game renders at
940 × 450 internally, so it all averaged out to a flat olive wash with no
visible texture at all. **Err on the side of larger, bolder features.**

---

## The tiles

One per biome. **All 8 exist and are wired as of 2026-08-11** (see the changelog entry
that day). Historical note, because it cost real debugging time: the seven non-PNW tiles
were authored and shipped in `12291f6`, but nothing ever called `GroundPlane.setTile`, so
`422fc2d "Archive 99 unused asset files"` swept them into the gitignored `Archive/` for
being unreferenced — which made them permanently unreferenced. The whole route rendered a
wet Pacific-Northwest roadside over desert palettes for two weeks.

Naming: `<name>_ground_1024.png`, registered as texture key `ground_<name>`.

| File | Biome / miles | What it should be |
|---|---|---|
| `pnw_roadside_ground_1024.png` ✅ | West Side forest, mi 20–45 | Wet PNW roadside: mossy dirt, patchy grass, pine needles, small dark stones |
| `north_bend_ground_1024.png` ✅ | North Bend, mi 26–40 | Same wet greenery but coarser — fir needle litter, moss, damp gravel shoulder |
| `pass_alpine_ground_1024.png` ✅ | Snoqualmie Pass, mi 45–58 | Coarse alpine gravel, sparse tough grass, granite chips, bare wet rock. **No snow — the engine adds that.** |
| `easton_ground_1024.png` ✅ | Easton transition, mi 58–78 | Drying out: pine needles over dusty soil, sparse bunchgrass, more bare dirt |
| `kittitas_ground_1024.png` ✅ | Kittitas foothills, mi 78–122 | Dry tan bunchgrass, cracked pale soil, sage twigs, scattered pebbles |
| `vantage_basalt_ground_1024.png` ✅ | Vantage, mi 122–142 | Dark basalt scree and angular broken rock, sparse dry grass between |
| `columbia_ground_1024.png` ✅ | Columbia Basin, mi 142–210 | Irrigated-farm shoulder: silty pale soil, sparse green weeds, tyre-flattened grass |
| `palouse_ground_1024.png` ✅ | Palouse, mi 210–293 | Golden wheat stubble and dry straw over dark loess soil |

### Not needed

- **Snow variants — DECISION REVERSED 2026-08-12.** The 08-11 "leave it"
  (accept ~31 flat-white miles) was superseded by the owner the next day:
  three snow-stage tiles now exist (`snoqualmie_ground_light/partial/_1024`,
  keys `ground_snoq_light/partial/full`) and `GroundPlane.snowGroundAt()`
  cross-fades alpine → light → partial → full by weather-driven mile — exactly
  the "switch on snow intensity, not biome" shape this entry predicted. The
  `groundTexFade = (1 - snowI)^0.6` fade-out in Road.js was REMOVED (it erased
  the new tiles under the blanket); the roadside now stays textured through
  the whole 36–88 snow window. See the 2026-08-12 changelog entry.
- **No road surface.** The tarmac, lane lines and rumble strip are drawn
  procedurally. These tiles are the ground *beside* the road only.

---

## Delivery

PNG, 1024 × 1024, opaque, seamless both axes, overhead, flat lighting.
Drop into `public/assets/scenery/ground_textures/final/` — then it's one line
per tile in the `GROUND_TILES` table in `src/road/GroundPlane.js` to wire up.

Live scale check once a tile is in: `localhost:3000/?dev=1&tile=48` — change
the number to preview the tile at a different real-world size without a
rebuild.

---

# Chapter 10 — Biome Parallax Band Art Spec

# Road Trip Roulette — biome parallax band art spec

24 images. These replace the procedural placeholders generated by
`scripts/buildBiomeBands.js`. Drop the finished PNGs into
`public/assets/biomes/` using the **exact filenames** below — nothing in code
needs to change.

---

## Non-negotiable technical rules

These four are what make or break the art. Everything else is taste.

1. **2048 × 640 px PNG with a real alpha channel.**
   Not JPG. Not a white background. Transparency is load-bearing.

2. **Horizontal tiling — DON'T try to solve this in the art.**
   Each band scrolls sideways forever, so it ultimately has to loop. But
   generative tools do not reliably produce a seamless loop no matter how the
   prompt is phrased, and burning attempts on it wastes everyone's time.

   **Instead: draw a straight panorama, wider than 2048 if convenient, and
   hand it over as-is.** The looping is a mechanical post-process (offset by
   half the width, heal the join) and is done on the code side. Just don't
   put anything unique or eye-catching hard against the left or right edge —
   the join lands there.

3. **Bottom-anchored silhouette, transparent sky.**
   The terrain is drawn UP from the bottom edge of the canvas. Everything
   above the ridgeline must be fully transparent. **Do not draw sky, clouds,
   sun, gradient, or ground plane** — the game supplies all of that. Each
   band is a cutout that gets seated on the horizon line.

4. **No horizon line, no foreground, no road.**
   Just the landform. The road, roadside and weather are rendered separately
   and drawn on top.

Authoring at 2048 px wide is deliberate: bands are scaled DOWN to an 800 px
game viewport, so detail needs headroom.

### Three layers per biome

Each biome is three bands at different parallax speeds. Treat them as
receding depth planes and apply **aerial perspective** — the far layer should
be the palest, haziest, lowest-contrast; the near layer the darkest and most
saturated.

| Layer   | Scroll rate | Role |
|---------|-------------|------|
| `far`   | 0.06 (slowest) | Distant range on the horizon, heavy atmospheric haze |
| `ridge` | 0.14 | Mid-distance hills, some form and shading |
| `near`  | 0.30 (fastest) | Closest treeline / bluffs, darkest, most detail |

The `near` layer is seated 26 px lower than `far`, so only its crowns clear
the horizon. Don't fill the whole canvas height on `near` — a band roughly
1/3 the canvas height is right.

---

## The 24 files

Route is I-90 from Seattle to Vantage (mile 132), then **WA-26** east across
the Columbia Basin to Pullman. Eastern I-90 scenery (Moses Lake, Sprague) is
**not** on this route.

### 1. `westside_forest` — miles 20–26 and 40–45

Wet, enclosed Douglas fir forest west of the Cascades. Dense, dark, green.
You cannot see any distant range from in here — that is the point.

| File | Notes |
|---|---|
| `bio_westside_forest_far.png` | **FULLY TRANSPARENT — draw nothing.** An enclosed wet forest has no visible distant range. A low flat shape here renders as a dead-straight rule across the horizon, which is worse than nothing. |
| `bio_westside_forest_ridge.png` | Soft conifer-covered hills, muted blue-green haze |
| `bio_westside_forest_near.png` | Dense fir treeline, very dark green, irregular crown heights |

### 2. `north_bend` — miles 26–40

North Bend / Mount Si country. Steep forested walls of the Snoqualmie valley,
one dominant rocky-faced peak. Green and wet, not alpine.

| File | Notes |
|---|---|
| `bio_north_bend_far.png` | Distant valley walls, pale blue-grey haze |
| `bio_north_bend_ridge.png` | Steep timbered ridge with one prominent rocky summit shoulder |
| `bio_north_bend_near.png` | Close fir treeline, deep green |

### 3. `pass_alpine` — miles 45–58  *(the only biome with snow)*

Snoqualmie Pass. **Important:** at 3,015 ft this is the *lowest* major I-90
crossing of the Cascades — broad, rounded, heavily timbered ridges with
conifers nearly to the summits and bare rock only on a few high faces.
It is **not** the Alps, Tetons or Sawtooths. Avoid razor spires and uniform
sawtooth peaks; that was exactly what was wrong with the placeholder.

Deep winter: the road is a total whiteout here, so the range should read as
substantially snow-covered, with the snowline wandering with terrain and
aspect rather than cutting flat across.

| File | Notes |
|---|---|
| `bio_pass_alpine_far.png` | Broad snow-capped ridges, 1–2 dominant summits with long shoulders, cool blue-grey rock, heavy snow above an irregular snowline |
| `bio_pass_alpine_ridge.png` | Mid ridges, snow-dusted timber, grey-green |
| `bio_pass_alpine_near.png` | Snow-laden fir treeline, near-black green |

### 4. `easton_transition` — miles 58–78

The rain shadow crossing. Forest thins and dries out — fir gives way to
ponderosa pine, green shifts toward olive and straw.

| File | Notes |
|---|---|
| `bio_easton_transition_far.png` | Rounded drying hills, grey-green |
| `bio_easton_transition_ridge.png` | Open pine slopes, olive |
| `bio_easton_transition_near.png` | Sparse ponderosa treeline, gaps between trees |

### 5. `kittitas_foothills` — miles 78–122

Dry Kittitas valley foothills. Treeless, tan and gold grass hills with
occasional rimrock benches. Big open sky country.

| File | Notes |
|---|---|
| `bio_kittitas_foothills_far.png` | Smooth bare tan ridges |
| `bio_kittitas_foothills_ridge.png` | Grass hills with low rimrock steps, dusty gold |
| `bio_kittitas_foothills_near.png` | Low sage bluffs, near-flat, brown-gold |

### 6. `vantage_basalt` — miles 122–142  *(route landmark)*

The Columbia River gorge at Vantage. **Flat-topped basalt benches and
columnar cliffs** — stacked horizontal terraces, vertical column striation in
the rock faces. This silhouette is the most recognisable on the whole route;
it must read as terraced plateau, not as generic brown hills.

| File | Notes |
|---|---|
| `bio_vantage_basalt_far.png` | Distant flat-topped mesa rim, pale tan |
| `bio_vantage_basalt_ridge.png` | Basalt cliff with visible vertical columns, warm grey-brown |
| `bio_vantage_basalt_near.png` | Close columnar basalt bench, dark brown-grey |

### 7. `columbia_irrigated` — miles 142–210 (WA-26)

Irrigated Columbia Basin farmland. Almost flat — circle-pivot fields, the
occasional windbreak, a distant low rim. Green crops against dry ground.

| File | Notes |
|---|---|
| `bio_columbia_irrigated_far.png` | Near-level distant rim, very low relief, pale |
| `bio_columbia_irrigated_ridge.png` | Low rolling field edges, muted green |
| `bio_columbia_irrigated_near.png` | Flat crop line with occasional tree windbreaks, deeper green |

### 8. `palouse_hills` — miles 210–293

The Palouse into Pullman. Famously smooth, steep, dune-like wheat hills —
rounded, sensuous, no trees, contour-farmed stripes. Gold and tan.

| File | Notes |
|---|---|
| `bio_palouse_hills_far.png` | Soft rolling wheat hills, pale gold |
| `bio_palouse_hills_ridge.png` | Steeper dune-like hills, contour stripes, gold |
| `bio_palouse_hills_near.png` | Close wheat hill shoulders, deeper amber |

---

## Delivery note

Deliver whatever the tool produces most naturally — these are all fixed on
the code side, so none of them are worth a retry:

- **No alpha?** Put the terrain on **flat magenta (#FF00FF)**. Keys out cleanly.
- **Bands stacked in one image?** Fine, they get sliced.
- **Wrong size?** Fine, they get resized to 2048 × 640.
- **Not seamlessly tiling?** Expected — the loop is made in post (see rule 2).

The only things that genuinely have to be right in the source, because they
cannot be recovered afterwards:

1. **Straight-down framing with no sky** — the band is a cutout seated on the
   horizon, so a photo with sky, sun or clouds baked in is unusable.
2. **No perspective ground plane or road** in the image.
3. **Correct subject** — right landform for the right biome (see the table).
4. **Nothing unique jammed against the left or right edge** — that's where
   the loop join gets made.

---

# Chapter 11 — NPC Dialogue Reference

# Road Trip Roulette — NPC Dialogue Reference

**Companion spreadsheet: `npc_dialogue.csv` in the repo root** — same content, long/tidy
format (one row per quote/fact/choice, filterable `Category` column), opens directly in
Excel/Numbers/Sheets. **Status as of 2026-07-29: rewrite in progress.** The owner is editing
both toward "edgier, funnier" and will hand back edits to paste into the actual data files
(`src/data/encounters.js`, `src/systems/MissionSystem.js`, `src/scenes/RestStopScene.js`) —
this chapter is the reference snapshot, not necessarily what's live in code by the time it's
read.

Three separate systems, all rest-stop only (nothing pops up while driving):

1. **Encounter cards** (`src/data/encounters.js`) — 14 named NPCs with a portrait, a quote, a real-world "fact" line, and 2-4 dialogue choices. One shows per pull-in, weighted by rarity. This is the meat — rewrite these.
2. **Mission passengers & contacts** (`src/systems/MissionSystem.js`) — a separate system entirely. 6 named riders you can accept as a paid "Favor" job (ask/pickup/mid-route/dropoff lines), plus 8 generic job-giver names with tiered greeting lines that scale with how many jobs you've run for them.
3. **Vignette lines** (`src/scenes/RestStopScene.js`) — one throwaway line of "party crowd" chatter per stop, no choices, no portrait. 3 variants per stop, picked at random. Lowest priority.

---

## 1. Encounter cards

### Street Weirdo — `seattle_intro_weirdo`
Seattle, mile 4. **Guaranteed on your very first pull-in, never repeats.**
> "Pullman by night? In THIS old heap? That mountain eats such rides for cheap."

*Fact: I-90 lifts from Seattle's sea-level shore to three thousand feet where the Pass-winds roar.*

- **Ask about the pass** → reveals the snow hazard ahead
  - *"Past North Bend it's chains or a prayer — pick one, pal, and climb up there."*
- **Give him a buck** ($1)
  - *"A giver! How noble, how dumb — you'll die as humble as you've become."*
- **Just drive** — no effect

---

### Chain Guy — `north_bend_chain_guy`
North Bend, mile 32. **3-node branching dialogue.**

**greet:**
> "The pass turns cruel, the snow won't quit — chains beat a physics class dug in a pit."

- **Buy chains** ($80) → grants snow-chains buff, reveals snow hazard, ends
- **Eighty bucks? Let's talk.** → goes to *haggle*
- **How bad is it up there, really?** → goes to *passInfo*
- **Thanks anyway — I'll risk it** — no effect, ends

**haggle:**
> "Fifty-five cash — no receipt, no refund, no eye; that's my whole pitch, so buy or say bye."

- **Deal** ($55) → 65% chains buff / 35%: *"He sold you chains that just look tough. Society rolls on, unbothered enough."*
- **Back to full price** → returns to *greet*
- **Walk away** — no effect, ends

**passInfo:**
> "Bad enough I'm here and not in bed — whiteout up top, and the plows are losing, it's said."

- **Fine. The chains.** → returns to *greet*, reveals snow hazard
- **Thank him and leave** → reveals snow hazard, ends

---

### Ski Bum — `pass_ski_bum`
Snoqualmie Pass, mile 53. *(Same face reappears as a mission passenger — see §2. Same portrait art, different context: a one-off roadside chat here vs. a paid ride-along there.)*
> "Past the tunnel it's whiteout, thick and dread — slow is smooth, and smooth is not-yet-dead."

*Fact: Snoqualmie's summit, three-oh-one-five high, is the lowest I-90 Cascade pass you'll spy.*

- **Buy his thermos** ($15) → warm buff, +10s, alertness up
  - *"Coffee so strong it could strip a door — you're wide awake and craving more."*
- **Ask the safe line** → reveals whiteout hazard
- **Wave and go** — no effect

---

### Long-Haul Mike — `vantage_wind_trucker`
Vantage, mile 137.
> "The Vantage wind flings semis like carts astray — two hands on the wheel, or you'll blow away."

*Fact: At Vantage the Columbia's crossing runs wide, with bare, hard crosswinds on every side.*

- **Take the wind tip** → wind-ready buff, reveals crosswind hazard
  - *"Lean in, don't fight it — that's the trick; out here you bend, or the wind hits quick."*
- **Split his fuel run** ($30) → 70%: +40 mi fuel / 30%: +15 mi fuel
  - *"Half the diesel he swore he'd hand — that's trucker math, you understand."*
- **Head out** — no effect

---

### Farm Worker — `othello_farm_gas`
Othello, mile 184.
> "Real station's far — a hike, a slog; I've a jerry can out back… don't mind the color or the smog."

*Fact: Round Othello the Basin's irrigated and wide — long dark stretches, no service, no guide.*

- **Buy the can** ($40) → 80%: +55 mi fuel / 20%: +25 mi fuel and −3 HP
  - *"That was NOT just gas, it's plain — the engine coughs and bucks in pain."*
- **Ask about the road ahead** → reveals farm-equipment hazard
  - *"Watch for tractors dark as pitch — they own these nights, and every ditch."*
- **Risk it on empty** — no effect

---

### Startup Founder — `bellevue_traffic_app`
Bellevue, mile 12.5.
> "Our app dodges every trap clear to Pullman's gate — freemium, of course; the free tier's the letdown you'll hate."

*Fact: Bellevue rose from a sleepy suburb's hush to glass-tower tech in two decades' rush.*

- **Buy premium** ($60) → 70%: −1 wanted star, +30s
  - *"It actually works — two traps glide by unseen; she's already pitching a Series B, it seems."*
  - 30%: *"'Servers are scaling!' she chirps — then the app falls flat; and so does your sixty, just like that."*
- **Ask for the free version** → reveals speed-trap hazard
- **Keep your data** — no effect

---

### Hitchhiker — `issaquah_hitcher`
Issaquah, mile 18. *(Same face reappears as a mission passenger — see §2.)*
> "I need a pass-bound lift, that's true — cash up front, no chit-chat too; best offer you'll hear the whole day through."

*Fact: Issaquah rests where the Cascades rear up, the last place the suburbs finally give up.*

- **Pick her up** → 60%: +$40
  - *"She pays, reads the curves better than your GPS could, then's gone at the summit — a passenger good."*
  - 40%: +1 wanted star — *"Turns out she's on some watch-list, it seems — now you're right beside it, in the cops' bad dreams."*
- **Take gas money, no ride** → +$20
  - *"'Cold. Respect,' she says, unfazed — hands you a twenty and walks off unamazed."*
- **Drive on** — no effect

---

### Park Ranger — `cleelum_ranger`
Cle Elum, mile 84.
> "Elk cross at dusk and don't check their blind side — and neither, it seems, do you when you ride."

*Fact: The wooded Cle Elum run, foothill-lined, is prime elk country of the roaming kind.*

- **Heed the warning** → elk-ready buff, reveals elk hazard
  - *"Slow at the tree lines, mind your speed — they're bigger than your car's whole creed."*
- **Point her at a "lost hiker" up the road** → −1 wanted star
  - *"She radios it in, thrown off the scent — your record breathes; the heat's misspent."*
- **Nod and leave** — no effect

---

### Swimsuit Girl — `thorp_motel_pool` — NEW, built 2026-07-29
Thorp, mile 101.
> "Thorp gets so quiet once the interstate clears — but the pool's still warm, and so are the beers."

*Fact: Thorp's a speck by the Yakima's bend, home to a century-old grist mill, my friend.*

- **Rent the room** ($40) → −40 tiredness, +45s (costs time — the "big rest" option)
  - *"She flips you the key with a wink, sly and slow — 'Shower's hot, bed's made… take it slow.'"*
- **Take a poolside drink** (free) → +10 hydration
  - *"She hands you a glass, ice clinking with cheer — 'On the house, cowboy. Long roads breed thirst, I hear.'"*
- **Politely decline and go** — no effect

---

### Diner Waitress — `ellensburg_diner`
Ellensburg, mile 109. **3-node dialogue, remembers if you've met her before.**

**greetFirst** (first visit):
> "Rodeo's in, so the coffee's fresh and the regulars are wild; you look on the run from something, child — pie?"

- **Coffee & pie** ($12) → +4 HP, +15s, fullness up, alertness up
  - *"Best call you've made the whole trip long — low bar, sure, but it's not wrong."*
- **What's ahead of me?** → goes to *roadTalk*
- **Just the check, thanks** — no effect

**greetReturn** (subsequent visits):
> "Well, look who survived the road's mean tricks — same booth's free, and you're getting pie; don't fight it, that's the fix."

- **The usual** ($12) → same as above
  - *"Knew it," she grins; the pie appears before you've sat, allaying fears.*
- **Any news up the road?** → goes to *roadTalk*
- **Just passing through — take care** — no effect

**roadTalk:**
> "Past Vantage the wind will part your hair through the screen — all morning the truckers came in white and green."

- **Better fuel up on pie then** ($12) → same food buffs, reveals wind hazard
  - *"Smart — nobody fights the wind and wins when their stomach's thin."*
- **Thank her and hit the road** → reveals wind hazard

---

### Roadside Grandma — `hatton_grandma`
Hatton, mile 205. **3-node dialogue.** *(Same face reappears as a mission passenger — see §2.)*

**greet:**
> "Few stop in Hatton, dear, it's true — I keep gas for the ones who do, and cookies… but the gas is safer for you."

- **Buy her gas** ($35) → +50 mi fuel
  - *"Drive safe, or don't, my dear — either way, the news'll reach my ear."*
- **Safer? What's in the cookies?** → goes to *cookies*
- **Why Hatton, of all places?** → goes to *whyHatton*
- **Politely flee** — no effect

**cookies:**
> "Butter and sugar and a recipe old — one the county begged me to leave untold; one won't hurt you… or so I'm told."

- **Take a cookie** → 70%: +3 HP, fullness up
  - *"Strangely restoring, warm to the bone — you feel watched, but not alone."*
  - 30%: fullness up, but lose 20s — *"You blink, and twenty minutes have flown — that's one fine cookie you've been thrown."*
- **Maybe the gas instead** → returns to *greet*
- **Decline politely and leave** — no effect

**whyHatton:**
> "Somebody must watch this stretch, my dear; the road claims the careless who wander near — I just tidy the mess they leave here."

- **…About that gas** → returns to *greet*
- **Thank her and back away slowly** — no effect

---

### Tow Driver — `washtucna_tow`
Washtucna, mile 228.
> "Three wrecks a week I haul from this bend — business is good, which should worry you, friend."

*Fact: Washtucna's a thin wheat-country line, with long, long gaps 'twixt help and sign.*

- **Prepay a tow discount** ($50) → tow-insurance buff
  - *"Crash, and I'll judge you — but only a bit; call it a discount on your fit."*
- **Have her bang out a dent** ($40) → +12 HP
  - *"A mallet, a grunt, a whack, a tad — and your car looks marginally less sad."*
- **Wave her off** — no effect

---

### Shade-Tree Mechanic — `ellensburg_coolant`
Ellensburg, mile 109 (alternate to the Diner Waitress at the same stop).
> "Basin-bound? Top your coolant off right here — past Vantage the shade quits and the gauge climbs, I fear."

*Fact: East of the Cascades the road drops to high desert's face — long, hot, and shadeless, the Columbia Basin's embrace.*

- **Top off the coolant** ($25) → cools the engine
  - *"He fills the radiator, spins the fan with care: 'That'll hold — probably. Say a prayer.'"*
- **Fill your jug from his hose** → hydration up
  - *"Warm hose water — not cold, but wet; he waves off your coins, no debt."*
- **I'll risk it** — no effect

---

### Lemonade Kids — `othello_lemonade`
Othello, mile 184 (alternate to the Farm Worker at the same stop).
> "Ice-cold lemonade, mister — best in the Basin, we swear! (It's also the ONLY one anywhere.)"

*Fact: The Columbia Basin bakes and reels each summer's turn — past the Saddle Mountains, triple digits burn.*

- **Buy the whole pitcher** ($5) → hydration up a lot
  - *"Worth every cent you're giving — your parched tongue rejoins the living."*
- **Just one cup** ($1) → hydration up a little
  - *"Cold and impossibly sweet, that sip — you smack your lips and resume the trip."*
- **Wave and go** — no effect

---

## 2. Mission passengers & contacts

Separate system, offered as paid "Favor" jobs at rest stops — accept one, drive them to their drop-off. Each has 4 lines routed through the popup machinery at pickup / mid-route / drop-off, plus the pitch line ("ask") shown when the job is offered.

### Nervous Student
Quirk: **nervous** (a single hard crash and they bail).
- **Ask:** "I missed the last bus and my finals won't wait — I can pay; just drive like my mom's at the gate."
- **Pickup:** "Seatbelt. Both hands. Great. Perfect. Love it."
- **Mid-route:** "You're doing great. I'm saying that for both of us."
- **Dropoff:** "We lived! Here — take it before I count it."

### Hitchhiker
Quirk: **thrill-seeker** (tips extra if the ride got spicy). *Same portrait as the Issaquah encounter NPC.*
- **Ask:** "Need a lift up the road a spell — I chip in for gas, don't scream, ride well, and tip good coin for a story you tell."
- **Pickup:** "Music's yours, pedal's yours. Impress me."
- **Mid-route:** "Is that all this thing does? Kidding. Mostly."
- **Dropoff:** "Decent run. Here's the fare."

### Desert Oddball
Quirk: **fugitive** (bails at the next stop if you hit 2+ wanted stars).
- **Ask:** "I need to be gone from here, and swift — and skip any cops, if you catch my drift."
- **Pickup:** "If anyone asks, I've been asleep since Tuesday."
- **Mid-route:** He checks the mirror more than you do.
- **Dropoff:** "You never saw me. The money saw you, though."

### Roadside Grandma (passenger)
Quirk: **carsick** (cumulative crash damage runs her out of patience). *Same portrait as the Hatton encounter NPC.*
- **Ask:** "My grandson never calls or drives me a lick — you look sturdy, dear; smooth roads, and no tricks."
- **Pickup:** "I get queasy, dear. Pretend you're carrying soup."
- **Mid-route:** "My late husband drove like this. He's late for a reason."
- **Dropoff:** "A gentleman. Or close enough. Here you are, dear."

### Ski Bum (passenger)
Quirk: **nervous**. *Same portrait as the Snoqualmie Pass encounter NPC.*
- **Ask:** "Board's waxed, but my ride just fell right through — get me up the road and the lift-ticket money's for you."
- **Pickup:** "Powder day, man. Every minute counts. But like, safely."
- **Mid-route:** "Whoa. Okay. The mountain isn't going anywhere, right?"
- **Dropoff:** "Righteous. Here's the cash — first run's for you."

### Old-Timer
Quirk: **carsick**.
- **Ask:** "Truck died. There's a doctor waiting down the way, and my gut's older than your car — go easy, I pray."
- **Pickup:** "Drove this road before it had lines painted on it."
- **Mid-route:** "Mind the bumps, son. Breakfast is negotiating."
- **Dropoff:** "Smoother than my nephew, and he does it for a living."

### Mission contacts (generic job-givers)
Every stop's plain delivery/rush/heat/weather jobs are labeled with one of **8 names, picked deterministically per stop**: Marcy, Dale, Rhonda, Gus, Pep, Lorna, Sal, Tick. No individual personality — just a name on the offer — but the greeting scales with your history:

- **After a failed job:** "Heard how the last one hit the wall — cargo's gone, we'll square it all; clean slate, driver, no more said, if you're still rolling on ahead."
- **1 job completed:** "You delivered last time, I recall — got more to move, if you're up for the haul."
- **2-7 jobs completed:** "Back again? That's [N] runs you've made — I'm saving the sweetest jobs for your trade."
- **8+ jobs completed:** "There's my legend, come to call — the big runs go to you, that's all; nobody else gets word of these, so take your pick of them with ease."

---

## 3. Rest-stop crowd chatter (vignette lines)

One-liners shown on entry, no choices. 3 per stop, one picked at random each visit.

**Bellevue:** "Tell Mike I'll be there as soon as I find my keys." · "Bellevue Square parking lot, 11pm — bring the good stuff." · "My ex works at the bank — no, the OTHER bank."

**Issaquah:** "Saw two cops at the QFC on 17th. Take the back roads." · "Did you grab the salmon? It's a Pullman tradition." · "My cousin's couch is open if you blow the clock."

**North Bend:** "Twin Peaks reruns at the diner — order pie, not the coffee." · "Snow chains on sale next door. Just sayin'." · "The pass is closing in three hours. MOVE."

**Cle Elum:** "You driving?? You're WASTED." · "Bakery's got those salted-caramel things. Ten minutes max." · "My truck broke down. Five star, no luck."

**Ellensburg:** "WSU rivalry game tonight — half of Pullman is on this road already." · "Coffee's on. You look like hell." · "Watch for state troopers around Kittitas. They love a quota."

**Vantage:** "The bridge view is unreal. Don't crash into it." · "Last gas before the basin. I'm serious." · "Wind's up — mind the trailer."

**Royal City:** "Free apples in the orchard, just don't get caught." · "My uncle says the cops here all play poker on Friday nights." · "It's gonna be a desert sunset. Floor it."

**Othello:** "Mexican food at the truck stop — life-changing." · "You missed Royal? They had the good energy drinks." · "Watch for combines on 26 — those things are rolling roadblocks."

**Washtucna:** "Population: 200. Cop: 1. Don't test him." · "My grandma made cookies for the party. Don't eat them all." · "Last shower in 50 miles. Fair warning."

**La Crosse:** "Almost there. Don't blow it now." · "Everyone's asking where the f— you are." · "Pullman's lit up like a Christmas tree tonight."

---

## Loose ends worth knowing

- **4 registered NPCs still have zero dialogue anywhere:** `night_clerk`, `patrol_sympath` (Off-Duty Deputy), `chip_seller` (Chip Guy), `hiker_one_boot` (Hiker, One Boot). Say the word and draft encounters or passenger jobs for them.
- **Most portraits now have real art, not placeholders.** 13 of the 14 encounter NPCs render actual artwork (`public/assets/npc/*.png`) — only **Shade-Tree Mechanic** and **Lemonade Kids** still fall back to a color-tinted name placeholder. Verify current state with `ls public/assets/npc/` before trusting this claim — it goes stale fast (this doc said "no portrait art exists yet" for several days after it stopped being true).
- **Three characters share a portrait across both systems, deliberately:** Ski Bum, Hitchhiker, and Roadside Grandma each appear once as a rest-stop encounter and once as a hireable mission passenger, using the *same* portrait art both times — same face, two different situations, not a naming collision.
- Nothing here is HUD or vice-bar code, so this is safe to edit freely.

## 4. Shop-staff greeters (`SHOP_GREETERS`) — built 2026-07-30, revised same day

Separate from the two systems above — these gate the shop screen itself, not a rest-stop
pull-in. `public/assets/npc/businesses/` holds one staff portrait per shop brand, each a
close-up of the SAME character already visible in that shop's storefront background art.
First time you tap a shop placard, that brand's staffer greets you on the same portrait-card
UI the roadside encounters use; picking any choice closes the card and opens the actual shop
(item list + storefront photo). `once: true` — a shop you've already met opens straight to the
menu on every visit after the first.

**First draft gave all 11 unique personality lines — the owner walked that back same-day as
scope creep.** Only 1-2 shops per stop are meant to be real content; everywhere else is
deliberately generic. Every shop now uses the SAME template unless it's today's mission shop
(below):

> *"Welcome in! What can I help you with?"* — plus the rotating town fact, and exactly 3
> choices: **"Let me see what you have"** / **"Just window shopping today"** / **"Any idea
> what the road's like up ahead?"** (the last two carry a short flavor-only reply, no
> mechanical effects — this fires on every first shop ENTRY, not as a rare gamble, so giving it
> real economic stakes would make bouncing between shops farmable).

### The mission shop — "it's up to the player to find them"

One shop per STOP (not per brand) is that stop's real mission contact — reusing the EXISTING
mission system unchanged (the same 8-name contact pool, same job-offer cards, same portrait
pool `long_haul_mike`/`tow_driver`/`farm_worker`/`street_weirdo` already used by the exit-pitch
card). Nothing new was authored for this — it's the pre-existing `_buildMissionEncounter()`,
now ALSO reachable by walking into the right shop, not just by hitting the road.

- **Which shop:** `RestStopScene._missionShopKeyFor(stopId)` — deterministic hash of the stop
  id (same pattern as the existing per-stop contact-name pick), restricted to shop keys this
  stop's `amenities` actually include. Owner's spec: **"switch it up"** — varies stop to stop
  (North Bend landed on Les Schwasted in testing), not a fixed brand, and stable for the whole
  visit (doesn't reshuffle while you're standing there).
- **One shared gate, both discovery paths:** finding the contact in their shop and the old
  exit-pitch (HIT THE ROAD) both consume the SAME `_pendingMissionCard` flag — whichever
  happens first for this visit is the only one that fires. The exit pitch was NOT removed;
  this is additive. (Flagged to the owner as an open question: whether the exit pitch should go
  away now that shops are discoverable, or intentionally stay as a catch-all for missing it.)
- **Fallback:** if the mission system has no open offers for this stop when the mission shop is
  entered (e.g. Custom/no-score mode), it falls through to the ordinary generic greeter rather
  than leaving the shop looking broken.

| Shop key | Brand | Generic speaker |
|---|---|---|
| `gas` | Huff's Gas | Huff's Attendant |
| `cargo` | CarGo | CarGo Dispatcher |
| `hunting` | CowBella | CowBella Shopkeeper |
| `camp` | AOK Camp | AOK Camp Host |
| `lord` | Lord Motors | Lord Motors Manager |
| `suck` | Sam's Used Car Kingdom | Sam's Owner |
| `vices` | Gas-N-Sip | Gas-N-Sip Clerk |
| `ambm` | AM/BM | AM/BM Clerk |
| `parkride` | Metro Park & Ride | Park & Ride Courier |
| `schwasted` | Les Schwasted | Les Schwasted Tech |
| `fap` | Finesse Autobody & Performance | Finesse Technician |

**Status:** built and verified end-to-end in a live browser — generic greeter renders
correctly on a non-mission shop, the mission shop correctly shows a real contact (Dale, 4 open
jobs, in the North Bend test) instead of the generic line, dismissing either opens the shop
behind it, and a second visit to an already-met shop skips straight through. Data lives in
`SHOP_GREETERS` in `src/data/encounters.js`; the gate and the mission-shop pick are both in
`RestStopScene.js` (`_showShopGreeter()`, `_missionShopKeyFor()`).

---

# Chapter 12 — Dead Code Inventory

**Audited 2026-08-03.** Method-level scan of `src/` (definitions vs. real call sites), plus
module-import, exported-constant, asset-key and shop-payload passes. Framework callbacks
(Phaser `renderWebGL` / `renderCanvas` / `preload` / `create` / `update`) and dynamically
built keys (`` `vomit_${n}` ``, `` `tumbleweed_${n}` ``, `car_back_<set>` / `car_front_<set>`
from `CAR_COLOR_SETS`, `vice_<id>`) were verified and are NOT dead — they are excluded below.

This is the list to work from. **Item 1 (`Road 2.js`) is DONE as of 2026-08-04 — see 12.6.**
Everything else is still on disk, unremoved.

## 12.1 Fully orphaned files (never imported)

| Path | Lines | Notes |
|---|---|---|
| `src/cops/` — `CopAI.js`, `CopFleet.js`, `Helicopter.js`, `SWATVan.js` | ~800 | Already banner-marked **"⚠️ SUPERSEDED — NOT WIRED INTO THE GAME (verified 2026-07-29)"**. The live police AI is `src/systems/CopSystem.js` + `src/systems/Deployables.js`. Every remaining mention of `CopAI`/`Helicopter` is a cross-reference *inside this dead directory*. Kept deliberately as a role/state design sketch. |
| `src/car/CarPhysics.js` | 160 | Zero references anywhere, and no banner. Real car physics is inline in `GameScene._updatePlayer`. |
| ~~`src/road/Road 2.js`~~ | ~~4458~~ | ✅ **RESOLVED 2026-08-04 — deleted, cause found, guard added. See 12.6.** |

## 12.2 The vice-bar layer is orphaned by the survival migration

The biggest live-code finding, and the root cause of the 2026-08-03 caffeine bug (see the
changelog entry): **`ViceSystem.pickup()` has no production caller.** Road vice pickups run
`GameScene._onCollect` → `survival.applyItem()` (the survival model). Anything reachable only
through `pickup()` is therefore dead in a real run:

- `ViceSystem.pickup()` — called **only by `tests/vices.test.mjs`**. Much of that suite is
  therefore testing code the game never executes.
- `ViceSystem.checkPassOut()` — never called (pass-out from vices is retired; the only
  terminal is "fell asleep at the wheel" from Tiredness).
- `ViceSystem.isPermastoned()`, `ViceSystem.isOn()`
- `VICE_CONFIG`'s `canPassOut` / `passOutThreshold` — now read only by the near-max HUD
  border warning in `GameScene`, not by any terminal logic.
- `GameScene._onPassOut()` — never called. The live "PASSED OUT" ending is reached from the
  fell-asleep branch via `_endGame('passed_out', { charge: 'FATIGUE' })`.
- `GameScene._tryEspresso()` — never called. The espresso *pickup* still works (clears
  Tiredness); only its pass-out-reversal role is orphaned.
- Daily-challenge `noPassOut` objective + `onlyPassOutVices` mod (`DailyChallenges.js`) —
  `onlyPassOutVices` is never consumed at all, and `noPassOut` is now trivially satisfied
  because nothing can set the tracker's `passedOut` flag.

**Decision needed:** either delete this layer, or re-wire the parts worth keeping. Do not
leave it half-live — this is exactly the shape that produced a bonus that silently never fired.

## 12.3 Dead methods (defined, never called)

`GameScene.js` — `_maxSpeedWithBoost` · `_tryEspresso` · `_drawViceIcons` ·
`_drawViceBarsOld_disabled` · `_projectVehicle` · `_buildAchievementsModal` ·
`_setVehicleAccessories` · `_drawTopRowIcon` · `_groupUnderPoint` · `_onPassOut`

> ⚠️ `_maxSpeedWithBoost` is dead **and was still being maintained** — it got a `coffeeBonus`
> term on 2026-08-01 that can never run. Dead code that looks live attracts edits; this one
> duplicates the mph-bonus formula, so it also reads as a second source of truth that isn't.

Other modules — `DamageModel`: `getStage`, `isWrecked`, `getStageVisuals`, `getRepairCost`
(file *is* imported, these four are not) · `AchievementSystem.earnedTier` ·
`StatsTracker.recordTopSpeed`, `recordSexWorker` · `UpgradeSystem.hasUpgrade` ·
`SaveSystem.resetProfile`, `hasSave` · `DailyChallenges.rewardForAttempt`, `weekKey` ·
`Difficulty.allModes`, `customMode` · `CloudSave.checkPlate` · `CopSystem.countOf`,
`_closestCop` · `AudioSystem._runScheduler` · `Colors.hexToPhaser` ·
`VehicleStats.debugPrintVehicleStats` · `Road.renderVehicle`, `roadScreenYAtDepth` ·
`GroundPlane.setTile` · `encounters.validateEncounterTrees` ·
`businessMissions.allTemplates` (`templateReady` is test-only) · `Wallet.getLog`

## 12.4 Dead constants, asset keys, payload flags

- **Constants:** `COP_SPAWN_Z` (`constants.js`), `VICE_PRICE` (`RestStopScene.js`),
  `UNTABBED_SLOTS` (`data/upgrades.js`) — exported, no consumer.
- **Asset manifest keys (9)** — loaded at boot, never used: the seven
  `codex_*_front` player-vehicle arts left behind when purchased vehicles were removed
  2026-07-19 (`codex_suv4x4_front`, `codex_used_truck_front`, `codex_new_truck_front`,
  `codex_ev_truck_front`, `codex_sports_car_front`, `codex_bestla_roadster_front`,
  `codex_playdout_s3x_front`), plus `tree_generic` and `ui_phone_menu_bg`. These cost real
  download + VRAM on every boot. (Related: the known "23 dead car-art entries" item.)
- **Payload flag:** `refuelMi` — set on the gas item's payload in `RestStopScene.js:599`,
  never read. Same class of bug as the `coffee: true` flag that did nothing until 2026-08-01;
  `refuel: true` is what actually drives the refuel.

## 12.5 Suggested order of work

1. ~~**`Road 2.js`**~~ — ✅ **DONE 2026-08-04, see 12.6.**
2. **Decide the vice-bar layer's fate** (§12.2) — it's the only cluster that has already
   caused a real gameplay bug, and it invalidates part of the test suite.
3. **9 dead asset keys** — trivial to remove, immediate boot-time win.
4. **`src/car/CarPhysics.js`** — delete; unlike `src/cops/` it isn't marked as a keeper.
5. Dead methods/constants — safe cleanup, no behaviour change.

## 12.6 `Road 2.js` — RESOLVED 2026-08-04 (cause: iCloud Drive)

**What was recreating it: iCloud Drive conflict copies.** This repo lives under `~/Documents`, and
`~/Library/Mobile Documents/com~apple~CloudDocs/` contains both `Desktop` and `Documents` — macOS
"Desktop & Documents Folders" syncing is **on**, so the whole project is inside iCloud Drive. When
iCloud cannot reconcile two versions of a file it does not warn or merge; it silently writes the
loser beside the winner as `name 2.ext`.

The evidence that settled it: `Road 2.js` was correctly deleted in `bf00890` on **2026-07-31**, yet
sat on disk afterwards with an mtime of **2026-07-27** — four days *older* than the commit that
removed it. Nothing recreated it from newer edits; iCloud restored a stale copy it had been holding.
It was **untracked**, which is why no diff, no commit and no clean `git status` ever mentioned it.

**Verified safe before deleting.** Line-level diffing is useless here (indentation churn made 177
lines look "unique"), so the check was on method names: three existed only in the duplicate —
`_drawShoulderRibbons`, `drawSide`, `flush`. All three were present in `Road.js` at `12291f6`
(2026-07-28) and were removed after it by the scenery/biome-backdrop overhaul. So the duplicate was a
pre-overhaul snapshot of superseded code, and that history lives in git regardless.

**Deleted** (all untracked, all unimported):
- `src/road/Road 2.js` (212 KB) · `src/systems/CopSystem 2.js` (100 KB — same story, zero unique
  methods, stale against a `CopSystem.js` that had moved on)
- 11 zero-byte conflict copies in `dist/`, including a duplicate `phaser-*.js` and `index 2.html`,
  which were being **uploaded to Cloudflare Pages on every deploy**.
- Left alone: `Archive/assets/culture/hiphop_phonk/vices/slushie 2.png` — `Archive/` is a deliberate
  parking lot and is gitignored.

**The guard: `scripts/checkDuplicates.js`.** Deleting is not a fix — iCloud can write another copy
back tomorrow, and git structurally cannot catch an untracked file. The script scans `src`,
`scripts`, `tests`, `public`, `website` for `name 2.ext` / `name copy.ext` and exits 1 with the exact
`rm` commands. It is wired into **both `npm run build` and `npm test`**, so a conflict copy fails
loudly the next time anyone touches the project instead of lurking for a week. `npm run check:dupes`
runs it alone. The regex requires a **space** before the digit, so legitimately numbered files
(`icon-512.png`, `favicon-32.png`) don't trip it — verified clean against the current tree.

> **Note on `.gitignore`:** it already carried `package-lock 2.json` ("Duplicate package-lock created
> by some npm runs") — the same iCloud symptom, patched narrowly a while back. Resist the urge to
> ignore the pattern globally: ignoring conflict copies *hides* them, which is exactly how this one
> survived for a week. Failing the build is the behaviour you want.

**If this keeps happening,** the real fix is moving the repo out of iCloud-synced `~/Documents` (e.g.
`~/dev/`). That's a bigger call — the guard makes the current setup survivable.

---

# Chapter 13 — Ending Plate Art Spec

*Written 2026-08-04, when the plates + per-genre car art landed. Code: `src/data/endingArt.js`
(placement data + loader), `GameOverScene._createPlateEnding` / `_buildPlateUI` (the ending
screens), `GameScene._showOutOfGasCard` (the mid-run gas card).*

## 13.1 What an ending plate is

A **plate** is a photographic **800×450 PNG** — exactly the game canvas (`SCREEN_W` × `SCREEN_H`),
so every coordinate in this chapter is 1:1 with screen space, no scaling maths anywhere. The plate
is a *scene with a hole in it*: the composition deliberately leaves an empty stretch of road or lot
where the player's car gets composited at runtime.

Plates carry **no typography and no button faces**. This is the hard break from the old baked webp
endings (`end_busted_screen.webp` etc.), which had the headline AND the RESTART/CONTINUE/MENU
button faces painted into the art, with invisible hit zones traced over them in code. That coupled
the art to the layout — re-exporting a plate meant re-tracing zones. Headline, stats and buttons
are now drawn for real over a bottom gradient scrim. **Do not paint text or buttons into a plate.**

The old webp trio is still loaded and still wired as the fallback: if a new plate fails to load,
`_createPlateEnding` hands off to the legacy builder rather than leave the player on a blank Game
Over screen with no way to restart.

## 13.2 The six plates

| Cause | File (`public/assets/ui/endings/`) | Run-ender? |
|---|---|---|
| `busted` | `end_busted_dynamic_plate.png` | yes — arrest, or a cop landing the killing blow |
| `crash` | `end_crashed_dynamic_plate.png` | yes — HP 0 from anything non-cop |
| `passed_out` | `end_passed_out_dynamic_plate.png` | yes — vice OD, or asleep at the wheel |
| `out_of_gas` | `end_out_of_gas_plate.png` | **no** — decision card, run continues (§13.6) |
| `demo_complete` | `end_demo_complete_plate.png` | yes — demo build reached Snoqualmie |
| `finish` / `finish_on_time` / `finish_late` | `end_pullman_comic_plate.png` | yes — Pullman arrival |

`busted_late` (TOO LATE + 5★) is the one run-ender with **no plate** — it still routes straight to
the checkpoint-restart slider modal. Its popup already says "BUSTED", so pointing it at the busted
plate is a small change whenever that's wanted.

## 13.3 The car art

Under `public/assets/ui/endings/cars/`, three views per genre, all **560×400 PNG with alpha**:

| File | Used by |
|---|---|
| `endcar_<genre>.png` | head-on rear — **currently unused by any plate** |
| `endcar_<genre>_rear3q.png` | busted · passed_out · out_of_gas · demo · pullman |
| `endcar_<genre>_rear3q_crashed.png` | crashed only (damage + smoke) |

Ten genres, matching `GENRE_VEHICLE_TRAITS` keys exactly: `classic_rock`, `country`, `edm_rave`,
`hiphop_phonk`, `k_pop`, `metal`, `norteno`, `pop_punk_emo`, `reggae`, `reggaeton`. Which one draws
comes from `window.__genre.get()` at the moment the run ended — the car on the ending screen is the
car they were driving.

`source/` holds the pre-key working files. **It is 64 MB and currently ships in `dist/`** — vite
copies `public/` wholesale — which lands on Cloudflare Pages and in the iOS bundle. It belongs
outside `public/`, parked like the `Images/` folder.

## 13.4 Why cars are placed by their trimmed box

Every car PNG is 560×400, but **the vehicle inside that frame is not a consistent size**:

```
endcar_classic_rock_rear3q   472 × 217   (low coupe)
endcar_metal_rear3q          453 × 339   (tall van)
endcar_country_rear3q        499 × 362
```

…and the transparent padding around each differs again. Anchoring by the frame would leave some
cars hovering above the road and others sunk into it, per genre, with no pattern.

So placement uses the **trimmed content box**: scale the car so its *trimmed* width matches the
plate's target width, then offset so the *trimmed* bottom-centre — the wheels' contact point —
lands on the plate's anchor. `ENDING_CAR_BBOX` in `endingArt.js` holds all 30 measured boxes.

**That table is generated from the art, not hand-written.** Re-export a car and it must be
regenerated (the command lives in the `endingArt.js` header comment):

```
node -e "const sharp=require('sharp'),fs=require('fs');const d='public/assets/ui/endings/cars';
(async()=>{for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.png')).sort()){
const{info}=await sharp(d+'/'+f).trim({threshold:1}).toBuffer({resolveWithObject:true});
console.log(f,-info.trimOffsetLeft,-info.trimOffsetTop,info.width,info.height);}})()"
```

## 13.5 Per-plate anchors

`x, y` = where the car's contact point sits on the 800×450 plate. `w` = on-plate width of the
trimmed car. Set by compositing the real art offline and eyeballing each ground plane.

| Plate | View | x | y | w | Reads as |
|---|---|---|---|---|---|
| busted | `rear3q` | 360 | 268 | 300 | pulled over ahead of the cruiser |
| crashed | `rear3q_crashed` | 450 | 262 | 300 | in the gap it punched through the guardrail |
| passed_out | `rear3q` | 300 | 330 | 330 | parked on the wet overlook |
| out_of_gas | `rear3q` | 330 | 300 | 300 | dead on the shoulder beside the gas can |
| demo_complete | `rear3q` | 250 | 414 | 292 | parked at the sunset overlook |
| pullman | `rear3q` | 112 | 318 | 145 | on the street in the comic's **left panel** |

The Pullman comic is a triptych — the left panel spans roughly x 8–262, so its car has to stay
small and inside that border or it breaks the panel gutter.

## 13.6 OUT OF GAS is a decision, not an ending

Running the tank dry does **not** end the run. It opens the out-of-gas plate as a modal over a
paused game (`GameScene._showOutOfGasCard`) with three choices:

- **TOW — $1,500** — flat fee, dragged back to the **previous** rest stop (never forward, so a tow
  can't advance the run), tank full, run continues. `TOW_COST_USD` in `constants.js` is the knob.
- **START OVER** — fresh run from mile 0, same vehicle; drops the `liveRun` autosave first so the
  new run doesn't immediately auto-resume the dead one.
- **LOAD SAVE** — newest save, local or server, via the title screen's `_titleLoadSave`.

Can't afford the tow → that button greys out reading `NEED $340 MORE`, leaving START OVER and LOAD
SAVE. Being broke on an empty tank is the fail state.

**The old rule is gone entirely** (owner 2026-08-04): the 50%-of-cash charge — which punished a
rich run far harder than a broke one for the same mistake — plus the repo-to-Beater when broke and
the free-tow-if-broke mercy case.

## 13.7 Loading

Plate + car are fetched **when the ending appears**, not at boot: six plates is ~3.5 MB of art seen
once per run, and only ever one plate and one car (~850 KB) are needed. They fade in over ~220 ms.
`loadEndingArt()` always invokes its callback — including on load failure — because an ending
screen that never draws would strand the player with no way to restart.

## 13.8 Adding a genre, or re-exporting art

1. Drop `endcar_<genre>_rear3q.png` and `endcar_<genre>_rear3q_crashed.png` (560×400, alpha) into
   `public/assets/ui/endings/cars/`.
2. Add the genre key to `ENDING_CAR_GENRES` in `endingArt.js`. A genre missing from that list
   renders the plate alone rather than the wrong car — a safe degrade, not a crash.
3. Regenerate `ENDING_CAR_BBOX` (§13.4).
4. Check the grounding on every plate — a much taller or lower vehicle than the existing ten may
   want its own anchor tweak.

A new **plate** additionally needs an entry in `ENDING_PLATES` (texture key, filename, car view +
anchor) and, if it's a new run-ending cause, a `CAUSE` entry in `GameOverScene.js` for its
headline / colour / subtitle.


---

# Chapter 14 — Player Car Steering & Pose

*Written 2026-08-10 after two rounds of "it looks wrong when it turns". Code:
`GameScene._updateSteerPose` (when the turn art shows), `_groundAnchorFor` /
`_applyPlayerGroundAnchor` (where the car is pinned), `_playerSpriteFramePoint`
(anything positioned against the sprite), `_drawSteerDiagnostic` (the overlay).*

These are RULES, not tuning values. Each one exists because breaking it produced a specific
visible bug, noted alongside.

## 14.1 The car does not roll

The sprite's rotation is **0**. It is not rotated to communicate steering, lane changes, or
anything else.

It used to rotate by `leanDir * 6` (clamped ±1.4, so up to **±8.4°**) straight off steering input.
Rotating about the PNG centre lifted a rear tire off the ground line and tilted the roofline, so a
lane change read as the car TIPPING rather than turning. The rear-three-quarter turn art already
carries its own drawn perspective, so the rotation was double-counting the turn on top of it.

If a deliberate suspension/body-roll effect is ever wanted, it belongs at that spot in
`_updatePlayer`, driven by something physical (camber, weight transfer) rather than raw steering
input, and capped around **0.25-0.75°, 1° absolute ceiling**. Anything more re-creates the tipping.

The tire shadow is flat for the same reason — it used to counter-tilt at `-leanDir * 4°` as the
"body leans in, wheels stay planted" cue, and a rotating puddle under a level car reads as detached.

## 14.2 The car is anchored on its tires, not on its PNG

The sprite origin is the **midpoint between the rear tire contact points**, measured from the
texture's alpha channel, not the canvas centre or bottom.

It used to sit at the PNG's bottom-centre (origin 0.5, 1). That is NOT the same point: the turn art
is a three-quarter view whose contact midpoint sits **14.5 px right of centre** (320 of 611). So
every straight->turn swap slid the car sideways, and mirroring the pose threw the offset the other
way — a ~4 px jump of the one point that is supposed to be nailed to the road.

- **Measured at runtime, not hard-coded.** The car art is PER GENRE
  (`assets/culture/<genre>/vehicles/`) — ten different bodies, each framed differently, plus
  whatever ships later. `_groundAnchorFor` scans the alpha once per texture and caches it.
- **Mirroring sets the origin to `1 - u`.** Phaser's `flipX` renders texture-u at FRAME position
  `(1 - u)`, so putting the origin at `1 - u` keeps the same physical point under the sprite's x/y.
- **Anything positioned against the sprite must go through `_playerSpriteFramePoint(u, v)`**, which
  accounts for both the origin and the mirror. The rear licence plate does. Assuming "the origin is
  the PNG bottom" is what put the plate 4 px off when mirrored.
- Falls back to the old bottom-centre behaviour if a texture can't be measured (one contact blob,
  tainted canvas), so a new car with odd art degrades rather than breaks.

## 14.3 The turn art keys off INTENT, not velocity

`_updateSteerPose` reads `_steerIntent` — the raw steering input captured in `_updatePlayer`
**before** the weight ramp — never `p.steerVelocity`.

Velocity is the last link in a three-stage lag chain: the **0.33 s input weight ramp**
(`STEER_RAMP_ENGAGE = 3.0`), then grip-limited lateral acceleration, then a magnitude gate. A pose
keyed to it always arrived visibly late, and the per-frame debounce — the term that kept getting
tuned — was the smallest of the three. **If the pose ever feels slow again, look at the chain, not
at the debounce.**

The same design caused a worse bug: the old machine had to fully RELEASE before it could engage the
opposite side, so through a left->right reversal the sprite kept showing LEFT art while the car was
already travelling right.

**Steering inversion is applied when capturing intent**, so under a vice that inverts steering the
art follows where the car actually GOES. Matching raw input there would face the car opposite its
own travel — the same bug, drug-flavoured.

Per mode:

| mode | input | engage | notes |
|---|---|---|---|
| classic | digital ±1 | frame 1 | no debounce needed — the input is already clean |
| tilt | analog axis | 0.18 deadzone + 30 ms | it's a real accelerometer; wrist jitter would flicker it |
| flappy | never neutral | always posed | mirrors on each tap (owner's call) |

- **Reversal shows exactly ONE straight frame**, then the far side.
- **Release** needs no intent AND lateral velocity settled (`DRIFT_HOLD` 0.12, ~100 ms). Letting go
  mid-slide holds the three-quarter view rather than snapping upright while visibly sideways.
- Lateral velocity's only remaining job is HOLDING a pose through a drift. It never starts one.

Direction mapping: the turn art depicts the car turning toward **screen-LEFT**, so `dir < 0` renders
it unflipped and `dir > 0` mirrors it.

## 14.4 The art itself is level — check before compensating

Measured off the alpha, `starter_back.png` puts both contact patches at y=355;
`starter_back_turn.png` at y=355 and y=354. **1 px across a 410 px span = 0.14°**, which is the
perspective drawn into a three-quarter view, not a crooked export.

If a future car looks tilted, measure the PNG first. Correct the ASSET; do not add runtime rotation
to compensate — that is how the body-roll bug in §14.1 would come back through the side door.

Regen command for the contact measurement is in the 2026-08-10 changelog entry.

## 14.5 The G diagnostic (TEMPORARY)

Press **G** in-game to overlay:

1. green horizontal line through both rear tire contact points, with a dot on each
2. amber ground anchor — the point pinned to the road
3. pink screen vertical through the car's centre
4. blue road lane-direction ray

On a straight road both dots must sit on one horizontal line and the vertical must stand upright.
On a curve the car may travel laterally along the lane ray, but **the baseline must stay
horizontal** — if it tilts, something is rotating the body again.

**Strip this with the rest of the dev aids before release** (see the pending list in Ch. 1).

---

# Chapter 15 — Storefront Confirm Modal Restyle

**Status: NOT BUILT — endgame / pre-release polish only** (owner, 2026-08-12: "These are
notes for endgame"). Do not start this during feature work; it is presentation-only and
touches a path that every purchase in the game runs through.

Sibling brief: `CLAUDE_GARAGE_STORE_UI_PROMPT.md` (garage store *layout* redesign — a
different job in the same screen; still an un-folded orphan .md, see Ch. 1 file rules).

## Where it lives today

`RestStopScene._confirmBuyPopup()` — `src/scenes/RestStopScene.js`. Tapping a storefront row
opens it; YES runs the exact buy path the tap used to run directly, NO closes and charges
nothing. Affordability / disabled / customers-only guards run BEFORE it, so an unbuyable row
keeps its red-flash and never opens a popup.

Current look: a 400×158 `0x102038` rectangle with a `0x66AAFF` 2 px stroke, `IMPACT`
(`'Impact, "Arial Black", Arial, sans-serif'`), and two 150×44 rectangles — `0x2E7D32` YES,
`0x8B2635` NO.

## Owner's target

Gritty neon automotive-shop, matching the storefront artwork.

- Near-black charcoal **metal panel** in place of the flat blue.
- Subtle brushed-metal / noise texture, an inset shadow, and a faint **magenta-and-cyan edge
  glow**.
- **Clipped or chamfered corners** — not rounded.
- Buttons **dark metallic by default**, not solid green and red.
- Restrained accent colors only: muted green/cyan for the affirmative, muted crimson for the
  cancel.
- Hover = brighter edge, slight glow, 1–2 px **upward** movement. Click = depress.
- The same condensed industrial typeface already used elsewhere in the interface.
- **Shorter modal.** Heading rewritten as `INSTALL NEW WINDSHIELD?` with the **price beneath
  it**.
- Match the interface's thin cyan outlines, deep shadows, magenta highlights.
- Strong contrast and a clearly visible **keyboard focus state**.
- Built from layered CSS gradients, borders, pseudo-elements, shadows and a small reusable
  noise texture. No generic Bootstrap-style buttons, no baked button images.

**Button labels: `INSTALL` / `CANCEL`, not YES / NO** (owner, 2026-08-12).

## Two things that make this bigger than a restyle — settle them before starting

1. **It is not HTML/CSS today.** The brief says "keep the controls as HTML/CSS", but
   `_confirmBuyPopup` is drawn with Phaser GameObjects (`this.add.rectangle`,
   `this.add.text`) on the scene's display list at depth 900. Every effect in the list above
   (gradients, pseudo-elements, inset shadow, noise, hover lift, focus ring) is a DOM/CSS
   feature that Phaser Graphics has no equivalent for. So this is a **port to DOM**, not a
   repaint — which brings in: z-order against the Phaser canvas, the widened-canvas
   `HUD_OFFSET_X` margins the current full-screen dim deliberately covers, the `_eatTap`
   drift-gate discipline that stops taps falling through to the shop behind, and iOS
   WKWebView behaviour (see `GameScene.js` ~2006 — `window.confirm` freezes it, which is why
   this popup exists at all). Decide DOM-port vs. Phaser-approximation first.
2. **One modal serves every shop item.** The heading is generated —
   `` `You'd like ${art} ${name}?` `` from the row label. `INSTALL NEW WINDSHIELD?` only fits
   parts; food, drink, fuel, hitchhikers and vehicles all come through here. Needs a
   per-item verb (INSTALL / BUY / FILL / HIRE …) driven off the item, with a fallback, and
   the button label should track it. Price is available on the item and is not shown today.

---

# Chapter 16 — Rest-Stop Exit / Off-Ramp System

**Authoritative current-state spec** (consolidated 2026-08-16 from the 08-15 / 08-15 pt 2 /
08-16 pt 2 changelog entries — read those for the build/debug history; this chapter is what
the system IS today). Status: geometry + tuning **uncommitted** in the working tree on top of
`aa8d7d4`; headless-validated, **not hand-playtested**; night exit lighting unverified.

## 16.1 Concept

Every rest stop's exit is a complete freeway off-ramp driven from ONE shared geometry plan —
there is **no exit button**: driving in lane 5 IS taking the exit. Road.js paints from the
plan, GameScene guides and auto-drives from the same plan, so the painted lane and the driven
path cannot disagree. Replaces the pre-08-15 `rampStrength` trapezoid + "swerve past x>1.5"
instant scene-swap.

## 16.2 Geometry & placement (`src/road/ExitPath.js`)

| Phase | Length | Notes |
|---|---|---|
| Taper | 150 ft | lane 5 grows from zero width |
| Parallel | **1000 ft** | full-width exit-only lane (was 500 — too short at valley-floor speed, owner 08-16) |
| Divergence (gore) | 100 ft | wedge opens to `GORE_GAP_X` 1.10 x-units; commitment window |
| Curve | 100 ft ARC | heading integrated to 82° in a build-time table (~56 ft of Z) |

- Units: 60.76 world-u/ft (`UNITS_PER_FOOT`). Lane count from `seg.lanes + 1` — nothing hard-codes 5.
- `buildExitPlan(segments, rs)` places the sequence on **fully dry road** (never bridge/tunnel/
  water): slides the whole approach earlier in 0.02-mi steps to −1.2 mi, then later to +0.3 mi,
  then shrinks the parallel lane down the ladder **1000→500→350→250→150 ft** as a last resort.
  Null plan = no exit painted (warned in console). Headless check 2026-08-16: all 19 stops
  place the full 1000 ft, worst repositioning −1 seg.
- **`plan.zLock`** = `zParallel + 500 ft` (clamped to the gore if the lane shrank): the lock-in
  point. Plan carries: `zTaper/zParallel/zLock/zDiverge/zCurve/zCurveEnd`, lane metrics,
  `curveTable`, `departSlope`, `arrowZs` (3 worn right-turn arrows at 18/55/88% of the lane),
  `parallelFeet`, `repositionedSegs`.
- `sampleExitPlan(plan, absZ)` → phase / lane-5 centre / edges / gore gap / heading for ANY
  consumer.

## 16.3 Taking the exit (GameScene)

State machine: `NONE → AVAILABLE → GUIDED → COMMITTED → CURVING → DEPARTING → TRANSITIONING`,
or `MISSED`. Decisions key off the CAR's visual Z (`p.position + PLAYER_VIRTUAL_Z`).

- **"In lane 5"** = `p.x ≥ 0.90` (car is ~0.22 u wide — straddling the divider with intent counts).
- **Announce**: one-shot popup at the taper (`➡️ EXIT — <town> / USE RIGHT LANE`).
- **GUIDED**: in lane 5 with the lane >35% grown — bounded 1.7 lane-u/s centring assist that
  never fights a left steer; steering out cancels.
- **Commitment — two ways** (both call `_beginExitCommit`, irreversible):
  1. **Lock-in**: in lane 5 at `carZ ≥ plan.zLock` (500 ft into the lane). First 500 ft cancellable.
  2. **Gore window**: in lane 5 anywhere in the 100-ft divergence (late-swerve catch — the
     wedge is under a lane wide, physically reachable).
- **MISS**: still left of the divider when the curve begins — silent mark
  (`_passedRestStops`), freeway continues; also covers resume-past-gore.
- **Speed — nose-only braking** (owner: "slowdown just at the nose"): after a lock-in commit
  the cinematic HOLDS highway speed through the remaining lane; the ease toward ~35 mph starts
  only when the car crosses `plan.zDiverge`. Braking happens on the ramp, never on the freeway.
- **Cinematic**: `_exitAuto` owns the car — spline-centre capture (0.5-s smoothstep blend from
  the held lane position), Z advance scales with cos(heading) floored at 12% so scenery keeps
  rolling, camera lateral view FROZEN at commit (`_exitCamX`). Departure completes when the
  sprite's left bound clears the LIVE viewport (`SCREEN_W + HUD_OFFSET_X + 24 px`, any aspect).
- **Protection after commit**: `_applyDamage` no-ops; collision/fuel/survival/arrest passes
  skipped; `cops.arrestPending` cleared each frame; pursuers aimed at the mainline; HP/gas/
  stars/score preserved bit-exact into RestStopScene; exactly ONE launch (`_takingExit` guard —
  `_takeRestStopExit` is purely the final hand-off).

## 16.4 Painting (Road.js)

- Right-edge band (fog line, shoulder tone, rumble, grit) shifts outboard with the taper
  (`extRF/extRN`); the old fog-line x becomes the dashed lane-4/5 divider; at the gore the
  mainline edge returns to x=1.0 and the ramp carries its own two edge lines from the nose.
- Urban sidewalk band + rural shoulder band shift by `swExt*` — they terminate at the taper
  and wrap the OUTSIDE of lane 5 / the ramp, never between freeway and ramp. Right-side
  pasture fences break across the window (`seg._exitFenceRightOff`).
- Worn right-turn arrows: `Road._drawExitArrows`, 34 ft, world-anchored, snow-buried raggedly.
- `seg.rampStrength` (0→1 across taper) still set — scenery-clearance / lateral-clamp
  consumers only; the paint no longer uses it. Right lateral clamp is a flat 2.8 (lane 5 is
  inside it).

## 16.5 Art hooks (pending per-genre exit art)

`_exitArtFor(headingDeg)` resolves by naming ladder off the current rear-view key:
`<base>_profile_r` (≥62°) → `<base>_turn_hard_r` (≥28°) → `<base>_turn_r` (≥8°) → base.
Dedicated right-facing keys always beat the mirrored generic `_turn` (mirroring flips plates);
until the art ships everything falls back to the mirror. Sprites normalize on measured visible
bounds + tire contacts, never stretched.

## 16.6 QA / dev

- Dev handle: `window.__rtrScene` (dev-gated, with `__rtrWarp`) for scripted runs.
- Headless validation (Playwright `?dev=1`): take/miss/cancel/pause-mid-curve, urban/rain/snow,
  wide viewport + 2★ carry-through, bit-exact hand-off, single RestStop launch; speed profile
  95 mph held to the nose then 82→60→47→41. Full suite green (737 tests).
- Open items: hand playtest (esp. exit 32 at speed), night exit lighting, per-genre `_r` art.

---

# Chapter 17 — Police, Sheriff, SWAT & Helicopter Artwork

**Art handoff consolidated 2026-08-28.** The assets described below exist in the project.

**STATUS: INTEGRATED AND SHIPPED 2026-08-27/28** — see changelog pt 11 (core integration,
commit `3fd5098`), pt 12 (playtest fixes), pt 13 (player scale/lamps), and the 08-28
"Cop pose frames" entry (height-normalized sizing + scoped left-turn mirroring).  This
chapter remains the ART CONTRACT (filenames, angle meanings, canvas/anchor conventions);
the implementation notes below are where the code actually landed:

- **Data home:** `src/data/policeAgencies.js` (agency table + route regions + the single
  `resolvePoliceSprite` resolver and fallback chain) and `src/data/policeSpriteMeta.js`
  (GENERATED — per-frame content bounds + red/blue lightbar lens boxes; regenerate with
  `node scripts/buildPoliceSpriteMeta.mjs` after ANY police art re-export, never hand-edit).
- **Scene glue:** GameScene `_ensurePoliceAssets` (region streaming via `Image()` +
  `textures.addImage` — the scene LoaderPlugin jams after `scene.restart()`, do not switch
  back to `this.load`), `_copSteerAngle` / `_resolveCopFrame` (steering ladder + pose),
  `_spawnCopSpinFx` (PIT/crash frame ladders), measured-anchor lightbar overlay + fog
  bloom + mirror branch; CopSystem `_stampAgency` (agency picked ONCE at spawn) and the
  `ent` backref on `getCopsForRender` records (they are per-frame COPIES — persistent cop
  state must live on `ent`).
- **Mirroring rule as shipped:** spin/PIT ladders and 0°/180° never mirror (large
  lettering); the small 7°/12° STEERING frames DO mirror for left turns with lens anchors
  swapped (08-28 entry) — the art is native right-turn only.
- **Parked speed traps:** right-shoulder traps wear the local `_spin_090` profile via
  content-aware `SCENERY_IMAGE_PROFILES` entries; LEFT-shoulder traps still use the legacy
  generic nose-left art (no nose-left jurisdiction profile exists — see 17.10).
- **Validation:** `tests/police.test.mjs` (in `npm test`) + headless
  `scripts/validate_police.mjs` (dev server on :3000; screenshots →
  `tmp/police_validation/`).
- **Sources parked:** `jurisdictions/sources/` contact sheets + the concept `*_back.png`
  files were moved to `Archive/police_jurisdiction_sources_2026-08-27/` so they never
  load or deploy — do not move them back into `public/`.

## 17.10 Known art gaps (owner action — updated 2026-08-29 pipeline review)

- `wsp_spin_180.png` wears a **"NEVADA HP 725" license plate** — needs a WA re-export.
- No **nose-LEFT profile** exists, so left-shoulder speed traps keep the legacy generic
  side art (mirroring a jurisdiction 090 would reverse the livery).
- **LEFT-turn steering frames**: a left-drifting cruiser currently shows the straight
  0° frame (mirroring is forbidden).  Render `<prefix>_spin_007_left.png` +
  `<prefix>_spin_012_left.png` per agency, drop them in the jurisdictions folder, and
  run `node scripts/buildPoliceSpriteMeta.mjs` — the loader + resolver pick them up
  with no code change.
- **Full-revolution spin frames**: the crash/PIT spin plays 0→180 then returns down the
  same ladder (ping-pong) to fake the far half.  Genuine `_spin_210/240/270/300/330`
  renders with readable markings would replace the return leg 1:1 (`SPIN_360_*` in
  policeAgencies.js).
- **Per-frame car scale drifts inside sets** (worst: Adams, Pullman, Seattle — the
  7°/12° cars are drawn up to ~40% smaller than 0°, the 120° cars largest).  The
  renderer's solid-height normalization corrects it, but re-exports at one camera
  distance would remove the correction entirely.  Tire baselines are excellent
  everywhere (≤0.2% spread) — keep that.
- Rendered heli frames are not identically framed (fuselage shifts up to ~7% of
  canvas between frames) — code compensates via measured body boxes; a re-export
  on one locked camera would simplify that.
- Validate ANY police re-export with `node scripts/buildPoliceSpriteMeta.mjs` +
  `node scripts/policeLightbarSheet.mjs` (boxes-on-art contact sheets in
  tmp/police_lightbar_sheets/), and hand-fix scanner mistakes in
  `src/data/policeSpriteOverrides.js` — never in the generated meta.

## 17.1 Jurisdiction vehicle sets

Finished transparent sprites live in:

`public/assets/cars/jurisdictions/`

Nine agencies are represented:

| Agency ID | Filename prefix | Vehicle class | Suggested territory |
|---|---|---|---|
| `seattle_police` | `seattle_police` | sedan | Seattle / West Seattle |
| `bellevue_police` | `bellevue_police` | SUV | Bellevue / eastside urban area |
| `snoqualmie_police` | `snoqualmie_police` | SUV | North Bend / Snoqualmie |
| `washington_state_patrol` | `wsp` | SUV | Entire interstate; overlaps local agencies |
| `kittitas_county_sheriff` | `kittitas_sheriff` | SUV | Rural Kittitas County |
| `ellensburg_police` | `ellensburg_police` | sedan | Ellensburg urban area |
| `adams_county_sheriff` | `adams_sheriff` | SUV | Adams County / rural Columbia Basin |
| `othello_police` | `othello_police` | SUV | Othello and immediate area |
| `pullman_police` | `pullman_police` | SUV | Pullman / destination area |

Every set has nine standardized 768×512 transparent PNGs:

```text
{prefix}_spin_000.png
{prefix}_spin_007.png
{prefix}_spin_012.png
{prefix}_spin_030.png
{prefix}_spin_060.png
{prefix}_spin_090.png
{prefix}_spin_120.png
{prefix}_spin_150.png
{prefix}_spin_180.png
```

Angle intent:

- `000`: centered rear pursuit view.
- `007`: barely perceptible normal steering.
- `012`: stronger but still ordinary steering.
- `030`, `060`, `090`: PIT setup, sliding and broadside rotation.
- `120`, `150`, `180`: continued crash rotation through centered front view.

All angled frames expose the same side and progress in one direction. Do not mechanically
mirror jurisdiction sprites to extend a spin: department names, badges and markings would be
backwards. A 0→180° crash animation is sufficient until separately rendered 180→360° frames
exist.

The standardized `_spin_000.png` file is the gameplay rear view. A few earlier `*_back.png`
concept files remain but should not replace the standardized frame. Original generation sheets
are preserved under `public/assets/cars/jurisdictions/sources/` and must never be loaded by the
game.

## 17.2 Jurisdiction selection rules

Agency selection should be centralized and data-driven, using existing mile/location/biome/
checkpoint data — never a second route-location system or scattered mile checks.

- WSP may appear anywhere on the interstate and may overlap a local agency's territory.
- Local police should dominate inside their city/area; sheriffs should dominate rural county
  territory.
- Store a stable agency ID on each spawned police entity. A pursuit keeps the agency selected
  when it began even if the player crosses a jurisdiction boundary.
- Missing-asset fallback order: requested jurisdiction angle → jurisdiction `000` → generic
  equivalent angle → `car_back_police.png`.

The territory labels above are intent, not final hard boundaries. Resolve the exact ranges from
the game's authoritative route data during integration and record them here afterward.

## 17.3 Generic police fallback art

Located in `public/assets/cars/`:

```text
car_back_police.png
car_front_police.png
car_left_police.png
car_right_police.png
car_back_police_turn_007.png
car_back_police_turn_012.png
car_back_police_spin_030.png
car_back_police_spin_060.png
```

Use these only where a jurisdiction is unavailable or an angle is missing. Normal visual angle
selection is `back/000` while straight, `007` for mild lateral intent, and `012` for stronger
ordinary lane movement. Use hysteresis/minimum frame hold so the art does not flicker.

## 17.4 SWAT replacement art

New rendered SWAT files in `public/assets/cars/`:

```text
car_back_swat_rendered.png
car_front_swat_rendered.png
car_back_swat_turn_007.png
car_back_swat_turn_012.png
car_back_swat_spin_030.png
car_back_swat_spin_060.png
car_back_swat_spin_090.png
```

These supersede `car_back_swat.png` and `car_front_swat.png`, which remain fallbacks. SWAT must
render visibly larger/heavier than police SUVs and sedans. Use `007/012` for steering and
`030/060/090` for PIT or crash motion.

## 17.5 Helicopter three-frame animation

New helicopter files live in `public/assets/cops/`:

```text
heli_police_rendered_1.png
heli_police_rendered_2.png
heli_police_rendered_3.png
heli_police_rendered_1_flip.png
heli_police_rendered_2_flip.png
heli_police_rendered_3_flip.png
```

Animate `1 → 2 → 3 → 1` at roughly **9–12 FPS** (about 10 Hz is the intended starting point).
The body stays stable while the baked main- and tail-rotor phases change. The `_flip` files are
separately rendered opposite-direction frames with readable `POLICE` markings; do not replace
them with runtime mirroring. The old `heli_1/2` files remain fallbacks only.

At the helicopter's ~170 px gameplay size, baked rotor phases are preferred to a separate rotor
layer: they avoid pivot metadata through sway/bob/scale transforms and look more convincing for
the nearly edge-on main rotor.

## 17.6 PIT and crash-spin visual contract

Integrate the new angles with the existing pursuit/contact/crash system — do not invent a
parallel collision system.

Suggested police visual sequence:

`000 → 007 → 012 → 030 → 060 → 090 → 120 → 150 → 180`

Starting timing for crash-only steps is about 50–90 ms per frame, tuned by speed and severity.
During the animation, retain the exact agency/vehicle, keep road-space positioning authoritative,
stop direction-frame oscillation, respect pause/restart/game-over, and cancel timers when an
entity is removed. Existing damage, wanted level, arrest, collision and PIT eligibility should
remain unchanged unless a narrowly scoped bug is found.

If matching player-car crash angles exist, animate player and police together. Never substitute
police art for the player's genre vehicle.

## 17.7 Scale, anchoring and emergency lights

Canvas dimensions are not physical vehicle size. Keep one stable world/display scale per entity:

- SWAT is largest.
- Police/sheriff SUVs are taller and heavier than sedans.
- Seattle and Ellensburg sedans are lower but not toy-sized.
- Frame changes must not shrink, grow, jump vertically or shift laterally.

Anchor all ground vehicles bottom-center/on tire contact, not by changing opaque bounds or using
each frame's natural size independently.

Flashing lights must align with the lightbar actually drawn in every sprite. Store normalized
per-agency/per-angle lightbar anchors (x, y, width, height and optional rotation) inside the same
transformed vehicle container. The effect must follow scale, road perspective, steering, PIT
rotation and camera motion. Illuminate the existing lenses rather than drawing large floating
red/blue blobs. Generic police and SWAT require their own anchors.

## 17.8 Loading and implementation shape

- Preload/cache current-region and immediately upcoming-region agencies; never preload source
  contact sheets.
- Cache decoded images/textures so frame changes do not create new `Image` objects or requests.
- Prefer one `POLICE_AGENCIES` configuration and one resolver such as
  `resolvePoliceSprite({ agencyId, angle, maneuverState })`.
- Follow the project's existing modules and rendering architecture. Do not create another Road,
  police or chase renderer.

## 17.9 Required validation after integration

Run the build/tests and visually validate each agency in its intended area, WSP overlap, SWAT,
both helicopter directions, the three-frame rotor loop, gentle `007/012` steering, PIT motion
through 180°, night lights, pause, restart and checkpoint behavior.

Specifically confirm:

- no clipping or source-sheet rendering;
- stable scale/baseline through every angle;
- `007` is smaller than `012`, and `090/180` are true profile/front views;
- department lettering is never mirrored;
- light flashes remain attached to the drawn lightbars;
- a chase never changes agency halfway through;
- missing art falls back without making an entity disappear;
- gameplay collision, damage, arrest and steering behavior did not regress.
