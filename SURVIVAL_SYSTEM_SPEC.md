# Survival System — Build Spec (v1)

Replaces the drug/vice-effect model with a **3-bar road-trip survival system**:
**Tiredness · Hunger (Fullness) · Thirst (Hydration)**. Every legacy visual
effect is re-homed to a meaningful bar state. Numbers are v1 — tune in playtest.

Bars are stored 0–100 (internally 0–1 is fine; this doc uses 0–100).

---

## 1. The three bars

| Bar | 0 means | 100 means | Baseline drift/mile | Sweet spot |
|---|---|---|---|---|
| **Tiredness** | fully alert | asleep → crash | **+1.5 / mi** (rises) | keep < 50 |
| **Fullness** (Hunger) | starving | stuffed | **−2 / mi** (falls, get hungry) | 35–65 |
| **Hydration** (Thirst) | dehydrated | bursting bladder | **−2 / mi** (falls, get thirsty) | 35–65 |

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

| Item | Category | Tiredness | Hydration | Fullness | Notes |
|---|---|---|---|---|---|
| **Water** | hydration | −5 | **+25** | — | overshoot → bladder |
| **Cold Brew** | caffeine (mild) | **−18** | −8 (diuretic) | — | **no addiction** — the safe starter |
| **Caffeine Pills** | caffeine (strong) | **−30** | −12 (diuretic) | — | **builds addiction** (§4) |
| **Slushie** | sugar | −22 spike | +15 | +8 | **sugar crash** ~40s later: Tiredness +30, brain-freeze stagger on drink |
| **Gummies** | sugar | −18 spike | — | +6 | crash ~40s: Tiredness +25; saturation/rainbow visual while high |
| **Sushi** | food | −6 (bite) | — | **+25** | ~**1/12 "bad fish"** → Hydration/Bladder → ~90 + nausea flash |
| **Burrito** | food | −6 (bite) | — | **+35** | heavier → hits food-coma faster |
| **Dramamine** | medicine | **+25** (drowsy) | — | — | **cures Nausea** |
| **Quad Shot** | power-up | **→ 0** (clears bar) | — | — | inventory item (was Emergency Espresso) |
| **Redneck Rage** | power-up | — | — | — | 1-mi invincible bulldoze + red spectacle (unchanged) |
| **Sleep** (rest-stop nap) | action | **→ 0** | — | — | costs party-clock time (~3–8 min) |

**Design contrast:** Sugar = fast pep + hard crash · Caffeine = lasting alertness
+ dehydration (+ addiction on Pills) · Water = small honest reset · Food = fills
but sedates the fuller you get · Dramamine = fixes stomach but sedates.

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
