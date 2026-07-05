// ── Rest-Stop Encounter System (data) ────────────────────────────────────
//
// Data-driven character encounters shown when the player pulls into a rest
// stop.  A portrait card pops with a line (and optional local fact), then 2–3
// choices whose effects touch cash / fuel / damage / heat / time / buffs /
// upgrades.  RestStopScene reads this file; it contains NO scene logic so the
// content stays easy to author and extend.
//
// ── Encounter shape ──────────────────────────────────────────────────────
//   id        unique string
//   stopId    rest-stop id it belongs to (see REST_STOPS: 'S','M','N','SP',
//             'V','O','H',…).  Omit / 'any' to allow at any stop in `regions`.
//   regions   optional array of region tags for `any`-stop encounters
//   weight    relative pick weight (default 1)
//   intro     true = a first-visit "location intro" (guaranteed on first pull-in)
//   once      true = never repeats once seen this save
//   conditions optional predicate data: { minMile, maxMile, night, minHeat, … }
//   portrait  key into NPC_PORTRAITS
//   speaker   display name override (else portrait name)
//   line      the spoken line
//   fact      optional local-fact string (flavor; VERIFY before shipping as true)
//   choices[] { label, cost?, effects?, chance? }
//
// ── Effect vocabulary (plain data; applyEncounterEffects maps to systems) ──
//   cash        +/- dollars
//   fuelMi      +/- fuel measured in miles of range (player.gasMi)
//   hp          +/- car durability
//   heatStars   +/- wanted stars
//   timeSec     +/- party-clock seconds
//   buff        string id of a temporary buff (applied when buff system lands)
//   grantUpgrade upgrade id (applied when upgrade system lands)
//   revealHazard hazard id to surface in the HUD/next-zone hint
//   dialogue    follow-up line shown after the choice resolves
//
// A choice may resolve randomly via `chance: [{ p, effects, dialogue }, …]`
// (probabilities should sum to ~1).  `cost` is sugar for effects.cash = -cost.

export const REST_STOP_ENCOUNTERS = [
  // ── Seattle (S) — urban intro ──────────────────────────────────────────
  {
    id: 'seattle_intro_weirdo',
    stopId: 'S', intro: true, once: true,
    portrait: 'street_weirdo', speaker: 'Street Weirdo',
    line: "Pullman by tonight? In THIS? Buddy, the mountain eats cars like yours for a light snack.",
    fact: "I-90 climbs from sea level in Seattle to about 3,000 ft at Snoqualmie Pass.",
    choices: [
      { label: "Ask about the pass", effects: { revealHazard: 'snow', dialogue: "\"Chains or prayers past North Bend. Your call.\"" } },
      { label: "Give him a buck", cost: 1, effects: { dialogue: "\"A philanthropist. You'll die humble.\"" } },
      { label: "Just drive", effects: {} },
    ],
  },

  // ── North Bend (N) — chains before the pass ─────────────────────────────
  {
    id: 'north_bend_chain_guy',
    stopId: 'N', weight: 3,
    portrait: 'chain_guy', speaker: 'Chain Guy',
    line: "Pass is getting ugly. Chains now are cheaper than learning physics in a ditch.",
    fact: "Snoqualmie Pass weather can change fast between North Bend and the summit.",
    choices: [
      { label: "Buy chains ($80)", cost: 80, effects: { buff: 'snow_chains', revealHazard: 'snow' } },
      {
        label: "Haggle him down",
        cost: 55,
        chance: [
          { p: 0.65, effects: { buff: 'snow_chains' } },
          { p: 0.35, effects: { dialogue: "He sold you decorative chains. Society continues." } },
        ],
      },
      { label: "Skip it", effects: {} },
    ],
  },

  // ── Snoqualmie Pass (SP) — ski bum warning ──────────────────────────────
  {
    id: 'pass_ski_bum',
    stopId: 'SP', weight: 2,
    portrait: 'ski_bum', speaker: 'Ski Bum',
    line: "Summit's whiteout past the tunnel. Slow is smooth, smooth is not-dead.",
    fact: "The Snoqualmie Pass summit sits at 3,015 ft — the lowest major I-90 crossing of the Cascades.",
    choices: [
      { label: "Buy his thermos ($15)", cost: 15, effects: { buff: 'warm', timeSec: +10, dialogue: "Coffee that could strip paint. You feel alert." } },
      { label: "Ask the safe line", effects: { revealHazard: 'whiteout' } },
      { label: "Wave and go", effects: {} },
    ],
  },

  // ── Vantage (V) — crosswind history ─────────────────────────────────────
  {
    id: 'vantage_wind_trucker',
    stopId: 'V', weight: 3,
    portrait: 'long_haul_mike', speaker: 'Long-Haul Mike',
    line: "Vantage wind's pushing semis around like shopping carts. Both hands on the wheel unless you're busy ruining your life.",
    fact: "The Columbia River crossing at Vantage is known for strong, exposed crosswinds.",
    choices: [
      { label: "Take the wind tip", effects: { buff: 'wind_ready', revealHazard: 'crosswind', dialogue: "\"Lean into it, don't fight it. Same as everything out here.\"" } },
      {
        label: "Split his fuel run ($30)",
        cost: 30,
        chance: [
          { p: 0.7, effects: { fuelMi: +40 } },
          { p: 0.3, effects: { fuelMi: +15, dialogue: "Half the diesel he promised. Trucker math." } },
        ],
      },
      { label: "Head out", effects: {} },
    ],
  },

  // ── Othello (O) — dark basin, low gas ───────────────────────────────────
  {
    id: 'othello_farm_gas',
    stopId: 'O', weight: 2,
    portrait: 'farm_worker', speaker: 'Farm Worker',
    line: "Nearest real station's a ways. I got a jerry can out back if you're not picky about color or smell.",
    fact: "The Columbia Basin around Othello is heavy irrigated farmland — long dark stretches between services.",
    choices: [
      {
        label: "Buy the can ($40)",
        cost: 40,
        chance: [
          { p: 0.8, effects: { fuelMi: +55 } },
          { p: 0.2, effects: { fuelMi: +25, hp: -3, dialogue: "That was NOT just gas. The engine coughs." } },
        ],
      },
      { label: "Ask about the road ahead", effects: { revealHazard: 'farm_equipment', dialogue: "\"Watch for tractors with no lights. They own the night out here.\"" } },
      { label: "Risk it on empty", effects: {} },
    ],
  },

  // ── Bellevue (B) — tech-money hustle ────────────────────────────────────
  {
    id: 'bellevue_traffic_app',
    stopId: 'B', weight: 2,
    portrait: 'biz_founder', speaker: 'App Founder',
    line: "Our app reroutes you around every speed trap to Pullman. Freemium. The free part is the disappointment.",
    fact: "Bellevue grew from a quiet suburb into a glass-tower tech hub in barely two decades.",
    choices: [
      {
        label: "Buy premium ($60)",
        cost: 60,
        chance: [
          { p: 0.7, effects: { heatStars: -1, timeSec: +30, dialogue: "It actually works — you glide past two traps. She's already pitching a Series B." } },
          { p: 0.3, effects: { dialogue: "\"Servers are scaling,\" she says, as the app crashes. So does your $60." } },
        ],
      },
      { label: "Ask for the free version", effects: { revealHazard: 'speed_trap' } },
      { label: "Keep your data", effects: {} },
    ],
  },

  // ── Issaquah (I) — hitchhiker toward the pass ───────────────────────────
  {
    id: 'issaquah_hitcher',
    stopId: 'I', weight: 2,
    portrait: 'hiker_woman', speaker: 'Hitchhiker',
    line: "I need a lift toward the pass. Gas money up front, zero small talk. Best offer you'll get today.",
    fact: "Issaquah sits at the foot of the Cascades, where the suburbs finally give up.",
    choices: [
      {
        label: "Pick her up",
        chance: [
          { p: 0.6, effects: { cash: +40, dialogue: "She pays, navigates the curves better than your GPS, and vanishes at the summit. Ideal passenger." } },
          { p: 0.4, effects: { heatStars: +1, dialogue: "Turns out she's on a list. Now you're adjacent to it." } },
        ],
      },
      { label: "Take gas money, no ride", effects: { cash: +20, dialogue: "\"Cold. Respect.\" She hands you a twenty and walks on." } },
      { label: "Drive on", effects: {} },
    ],
  },

  // ── Cle Elum (C) — elk country ranger ───────────────────────────────────
  {
    id: 'cleelum_ranger',
    stopId: 'C', weight: 2,
    portrait: 'park_ranger', speaker: 'Park Ranger',
    line: "Elk move at dusk through here, and they do not check their blind spots. Neither do you, apparently.",
    fact: "The forested Cle Elum stretch is prime elk country in the Cascade foothills.",
    choices: [
      { label: "Heed the warning", effects: { buff: 'elk_ready', revealHazard: 'elk', dialogue: "\"Slow at the tree lines. They're bigger than your car's opinions.\"" } },
      { label: "Point her at a 'lost hiker' up the road", effects: { heatStars: -1, dialogue: "She radios it in, distracted. Your record breathes a little easier." } },
      { label: "Nod and leave", effects: {} },
    ],
  },

  // ── Ellensburg (E) — rodeo-town diner ───────────────────────────────────
  {
    id: 'ellensburg_diner',
    stopId: 'E', weight: 3,
    portrait: 'diner_waitress', speaker: 'Diner Waitress',
    line: "Rodeo's in town so the coffee's fresh and the regulars are feral. You look like you're running from something. Pie?",
    fact: "Ellensburg is Kittitas County's rodeo-and-college town, roughly halfway across the state.",
    choices: [
      { label: "Coffee & pie ($12)", cost: 12, effects: { hp: +4, timeSec: +15, dialogue: "Best decision you've made all trip. Low bar, but still." } },
      { label: "Ask what's ahead", effects: { revealHazard: 'wind', dialogue: "\"Wind past Vantage'll part your hair through the windshield.\"" } },
      { label: "Just the check", effects: {} },
    ],
  },

  // ── Hatton (H) — the loneliest rest stop ────────────────────────────────
  {
    id: 'hatton_grandma',
    stopId: 'H', weight: 3,
    portrait: 'grandma', speaker: 'Roadside Grandma',
    line: "Not many stop in Hatton, dear. I keep gas for the ones who do. And cookies. The gas is safer.",
    fact: "Hatton is a tiny spot on WA-26, in the sparse country between Othello and Washtucna.",
    choices: [
      { label: "Buy her gas ($35)", cost: 35, effects: { fuelMi: +50, dialogue: "\"Drive safe. Or don't. I'll hear about it either way.\"" } },
      {
        label: "Take a cookie",
        chance: [
          { p: 0.7, effects: { hp: +3, dialogue: "Weirdly restorative. You feel watched, but nourished." } },
          { p: 0.3, effects: { timeSec: -20, dialogue: "You blink and twenty minutes are gone. Really good cookie." } },
        ],
      },
      { label: "Politely flee", effects: {} },
    ],
  },

  // ── Washtucna (W) — the tow driver who's seen things ────────────────────
  {
    id: 'washtucna_tow',
    stopId: 'W', weight: 2,
    portrait: 'tow_driver', speaker: 'Tow Driver',
    line: "I pull three wrecks a week off this stretch. Business is good, which should worry you.",
    fact: "The Washtucna area is sparse wheat-country highway — long gaps between help.",
    choices: [
      { label: "Prepay a tow discount ($50)", cost: 50, effects: { buff: 'tow_insurance', dialogue: "\"Crash and I'll only judge you a little.\"" } },
      { label: "Have her bang out a dent ($40)", cost: 40, effects: { hp: +12, dialogue: "A mallet, a grunt, and your car is marginally less sad." } },
      { label: "Wave her off", effects: {} },
    ],
  },
];

/** Deterministic-ish weighted pick without Math.random (pass an rng()->[0,1)).
 *  Filters by stopId, first-visit intro priority, once-seen, and conditions. */
export function pickEncounterForStop(stopId, ctx = {}, rng = Math.random) {
  const { firstVisit = false, seenIds = new Set(), mile = 0, night = false, heat = 0 } = ctx;

  const eligible = REST_STOP_ENCOUNTERS.filter(e => {
    if ((e.stopId ?? 'any') !== 'any' && e.stopId !== stopId) return false;
    if (e.once && seenIds.has(e.id)) return false;
    const c = e.conditions;
    if (c) {
      if (c.minMile != null && mile < c.minMile) return false;
      if (c.maxMile != null && mile > c.maxMile) return false;
      if (c.night === true && !night) return false;
      if (c.minHeat != null && heat < c.minHeat) return false;
    }
    return true;
  });
  if (!eligible.length) return null;

  // First visit → prefer the intro card if one exists for this stop.
  if (firstVisit) {
    const intro = eligible.find(e => e.intro);
    if (intro) return intro;
  }
  const pool = eligible.filter(e => !e.intro);
  const list = pool.length ? pool : eligible;

  let total = 0;
  for (const e of list) total += e.weight ?? 1;
  let r = rng() * total;
  for (const e of list) {
    r -= e.weight ?? 1;
    if (r <= 0) return e;
  }
  return list[list.length - 1];
}

/** Resolve a chosen option into a concrete { effects, dialogue }.  Handles the
 *  `cost` sugar and random `chance` tables. */
export function resolveChoice(choice, rng = Math.random) {
  if (!choice) return { effects: {}, dialogue: null };
  let effects = { ...(choice.effects ?? {}) };
  let dialogue = effects.dialogue ?? null;

  if (Array.isArray(choice.chance) && choice.chance.length) {
    let r = rng();
    let picked = choice.chance[choice.chance.length - 1];
    for (const branch of choice.chance) {
      r -= (branch.p ?? 0);
      if (r <= 0) { picked = branch; break; }
    }
    effects = { ...effects, ...(picked.effects ?? {}) };
    dialogue = picked.dialogue ?? dialogue;
  }
  if (choice.cost) effects.cash = (effects.cash ?? 0) - choice.cost;
  return { effects, dialogue };
}

/** Apply resolved effects to game systems via a decoupled context of setters.
 *  ctx = { addCash, addFuelMi, addHp, addHeat, addTimeSec, addBuff,
 *          grantUpgrade, revealHazard } — each optional; missing ones are
 *  skipped so this works before the upgrade/buff systems exist. */
export function applyEncounterEffects(effects = {}, ctx = {}) {
  if (effects.cash        != null) ctx.addCash?.(effects.cash);
  if (effects.fuelMi      != null) ctx.addFuelMi?.(effects.fuelMi);
  if (effects.hp          != null) ctx.addHp?.(effects.hp);
  if (effects.heatStars   != null) ctx.addHeat?.(effects.heatStars);
  if (effects.timeSec     != null) ctx.addTimeSec?.(effects.timeSec);
  if (effects.buff)                ctx.addBuff?.(effects.buff);
  if (effects.grantUpgrade)        ctx.grantUpgrade?.(effects.grantUpgrade);
  if (effects.revealHazard)        ctx.revealHazard?.(effects.revealHazard);
}
