# Road Trip Roulette — Project Overview

Single consolidated reference for the **Road Trip Roulette** game (commercial fork of DUI).
This file merges every project `.md` into one navigable document. Use the Table of Contents
to jump straight to the chapter you need to read or change.

- **Live build:** https://roadtrip-roulette.pages.dev (auto-deploys on push to `main`)
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

---

# Chapter 1 — Status & Changelog

**Project:** Road Trip Roulette — a dark-comedy Seattle→Pullman arcade driving roguelite,
forked from DUI on **2026-07-04** into its own repo and Cloudflare Pages site. Reframes DUI
into an App-Store-safe survival road trip and adds the commercial glue (encounters, part
upgrades, survival + heat/fuel pressure).

## Current snapshot (as of 2026-07-17)

**Built & deployed:** rest-stop encounter system (dialogue trees + npcMemory) · **MISSION SYSTEM
complete (Ch. 8, all 7 phases — 5 types, rep ladder ×1/×2.5/×5, 123 tests)** · car stats layer ·
part-upgrade system + garage UI · upgrades/buffs hooked into handling · survival rework
(Alertness/Bladder/Drinks/Food + restrooms/AM-BM + rest-stop mini bars; over-eating past 75% now
fills the bladder) · engine overheating · analog E↔F gas gauge (75-mi tank, 1:1 burn, reserve-tank
upgrades) · 🎆 fireworks weapon (spikes removed) · phone-menu notification dots · Hatton rest stop ·
**SOUNDTRACK CULTURE PACKS shipped** (per-plate genre reskin — vice + starter-vehicle art per genre,
music-menu picker, tutorial genre pick, rotate-to-play prompt) · custom iOS motion-permission
explainer · **all weapons cap at 3** (rolling coal 1/pickup) · **rolling-coal cop = touch-cloud →
60 mph/30 s slow** · HUD-layout editor with a COPY-to-export button.

**Superseded vs the original design doc:** "DUI" framing removed (speeding stops only, reckless
heat) · portable save/checkpoint codes removed (local LAST/SAVED kept) · sex worker → Hot Springs
soak (PG-13) · party-clock HUD hidden (mechanics intact — arrival-status direction, see changelog).

**Not yet built / pending:** economy balance w/ real playtest data (mission `recordEarn` tagging
ready; pickups+distance income the suspected inflators) · Steam-demo cut + wishlist/tutorial (Ch3
§13/§22) · real NPC portrait art · **bake owner's custom HUD layout as the shipped default** (waiting
on the COPY'd `controlsLayout` JSON — editor has the export button) · **genre earn/buy GATING**
(deferred to post-dev-mode; every genre is freely selectable for now) · **Reggaeton dedicated music**
(still borrowing the 9 hip-hop tracks; no `reggaeton/` folder yet) · texting-relationship layer
(pinned idea) · SAVE tile replacement (owner deciding).

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

## How to deploy

**Pushing to `origin/main` triggers the GitHub Action → Cloudflare Pages auto-deploy.** No CLI,
no manual build.

```bash
cd "/Users/brendanbaughn/Documents/Claude/Road trip roulette"
git add -A                 # or stage specific paths
git commit -m "Short description of what changed"
git push origin main       # GitHub Action builds + deploys to Cloudflare Pages
```

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
- **`dist/` is build output** — never edit or commit it; CI runs `npm run build` itself.
- **`ios/App/App/public/`** is the Capacitor sync target (`npx cap sync ios`) — don't hand-edit.
- **`Images/`** at the repo root is a local-only art archive (large PSDs) — don't ship it; keep it gitignored so `git pack-objects` doesn't choke on push.
- **Old code in production after a deploy** = browser cache. Hard-refresh (Cmd+Shift+R) or reopen the saved-to-home-screen PWA.


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
