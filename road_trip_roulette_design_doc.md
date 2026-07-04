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
