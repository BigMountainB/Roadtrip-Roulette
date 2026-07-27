// ── Rest-Stop Encounter System (data) ────────────────────────────────────
//
// Data-driven character encounters shown when the player pulls into a rest
// stop.  A portrait card pops with a line (and optional local fact), then 2–3
// choices whose effects touch cash / fuel / damage / heat / time / buffs /
// upgrades.  RestStopScene reads this file; it contains NO scene logic so the
// content stays easy to author and extend.
//
// NOTE (owner 2026-07-26): every NPC-spoken line, local fact, and follow-up
// `dialogue` is written in light rhyming couplets — NPCs "talk in rhyme" for
// chance opportunities.  Player-facing choice `label`s stay plain/functional
// so the action is scannable.  Keep the rhyme when editing content.
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
//   hydration   +/- Thirst bar 0–100 (a drink raises it)
//   fullness    +/- Hunger bar 0–100 (food raises it)
//   tiredness   +/- Tiredness 0–100 (caffeine LOWERS it → more awake)
//   coolEngine  degrees of engine temperature removed (coolant/fan)
//   generous    true = a generous act; ~30% chance of a random karma reward
//   dialogue    follow-up line shown after the choice resolves
//
// A choice may resolve randomly via `chance: [{ p, effects, dialogue }, …]`
// (probabilities should sum to ~1).  `cost` is sugar for effects.cash = -cost.
//
// ── Dialogue trees (multi-node conversations) ────────────────────────────
// A card MAY carry a `nodes` map instead of a flat line/choices — the scene
// walks the tree in the same split-screen card (renderer only; effects still
// resolve through resolveChoice/applyEncounterEffects when a choice is picked):
//   npcId      stable id for npcMemory (recurring NPCs); omit = no memory
//   startNode  entry node id, OR a function (mem) => nodeId so a recurring
//              NPC can greet a returning player differently
//   nodes      { [nodeId]: { line, speaker?, fact?, choices[] } }
// Node choices extend the flat-choice shape with:
//   next        id of the node to show after the choice resolves, OR
//   end: true   close the conversation (EVERY node choice must declare one —
//               no implicit closes; validateEncounterTrees enforces it, plus
//               a reachable free/unconditional polite exit from every node)
//   conditions  { minCash, hasBuff, memory: { key: value|true } } — failing
//               choices render grayed out (or hidden with hideWhenLocked)
//   setMemory   { key: value } merged into npcMemory[npcId] when chosen
// Legacy flat cards (no `nodes`) keep today's behavior untouched.

export const REST_STOP_ENCOUNTERS = [
  // ── Seattle (S) — urban intro ──────────────────────────────────────────
  {
    id: 'seattle_intro_weirdo',
    stopId: 'S', intro: true, once: true,
    portrait: 'street_weirdo', speaker: 'Street Weirdo',
    line: "Pullman by night? In THIS old heap? That mountain eats such rides for cheap.",
    fact: "I-90 lifts from Seattle's sea-level shore to three thousand feet where the Pass-winds roar.",
    choices: [
      { label: "Ask about the pass", effects: { revealHazard: 'snow', dialogue: "\"Past North Bend it's chains or a prayer — pick one, pal, and climb up there.\"" } },
      { label: "Give him a buck", cost: 1, effects: { generous: true, dialogue: "\"A giver! How noble, how dumb — you'll die as humble as you've become.\"" } },
      { label: "Just drive", effects: {} },
    ],
  },

  // ── North Bend (N) — chains before the pass (dialogue tree) ─────────────
  {
    id: 'north_bend_chain_guy',
    stopId: 'N', weight: 3,
    portrait: 'chain_guy', speaker: 'Chain Guy',
    fact: "Snoqualmie's mood can turn and bite 'twixt North Bend's calm and the summit's white.",
    startNode: 'greet',
    nodes: {
      greet: {
        line: "The pass turns cruel, the snow won't quit — chains beat a physics class dug in a pit.",
        choices: [
          { label: "Buy chains ($80)", cost: 80, conditions: { minCash: 80 }, effects: { buff: 'snow_chains', revealHazard: 'snow', generous: true }, end: true },
          { label: "Eighty bucks? Let's talk.", next: 'haggle' },
          { label: "How bad is it up there, really?", next: 'passInfo' },
          { label: "Thanks anyway — I'll risk it", effects: {}, end: true },
        ],
      },
      haggle: {
        line: "Fifty-five cash — no receipt, no refund, no eye; that's my whole pitch, so buy or say bye.",
        choices: [
          {
            label: "Deal ($55)",
            cost: 55, conditions: { minCash: 55 },
            chance: [
              { p: 0.65, effects: { buff: 'snow_chains' } },
              { p: 0.35, effects: { dialogue: "He sold you chains that just look tough. Society rolls on, unbothered enough." } },
            ],
            end: true,
          },
          { label: "Back to full price", next: 'greet' },
          { label: "Walk away", effects: {}, end: true },
        ],
      },
      passInfo: {
        line: "Bad enough I'm here and not in bed — whiteout up top, and the plows are losing, it's said.",
        choices: [
          { label: "Fine. The chains.", next: 'greet', effects: { revealHazard: 'snow' } },
          { label: "Thank him and leave", effects: { revealHazard: 'snow' }, end: true },
        ],
      },
    },
  },

  // ── Snoqualmie Pass (SP) — ski bum warning ──────────────────────────────
  {
    id: 'pass_ski_bum',
    stopId: 'SP', weight: 2,
    portrait: 'ski_bum', speaker: 'Ski Bum',
    line: "Past the tunnel it's whiteout, thick and dread — slow is smooth, and smooth is not-yet-dead.",
    fact: "Snoqualmie's summit, three-oh-one-five high, is the lowest I-90 Cascade pass you'll spy.",
    choices: [
      { label: "Buy his thermos ($15)", cost: 15, effects: { buff: 'warm', timeSec: +10, tiredness: -18, generous: true, dialogue: "Coffee so strong it could strip a door — you're wide awake and craving more." } },
      { label: "Ask the safe line", effects: { revealHazard: 'whiteout' } },
      { label: "Wave and go", effects: {} },
    ],
  },

  // ── Vantage (V) — crosswind history ─────────────────────────────────────
  {
    id: 'vantage_wind_trucker',
    stopId: 'V', weight: 3,
    portrait: 'long_haul_mike', speaker: 'Long-Haul Mike',
    line: "The Vantage wind flings semis like carts astray — two hands on the wheel, or you'll blow away.",
    fact: "At Vantage the Columbia's crossing runs wide, with bare, hard crosswinds on every side.",
    choices: [
      { label: "Take the wind tip", effects: { buff: 'wind_ready', revealHazard: 'crosswind', dialogue: "\"Lean in, don't fight it — that's the trick; out here you bend, or the wind hits quick.\"" } },
      {
        label: "Split his fuel run ($30)",
        cost: 30,
        effects: { generous: true },
        chance: [
          { p: 0.7, effects: { fuelMi: +40 } },
          { p: 0.3, effects: { fuelMi: +15, dialogue: "Half the diesel he swore he'd hand — that's trucker math, you understand." } },
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
    line: "Real station's far — a hike, a slog; I've a jerry can out back… don't mind the color or the smog.",
    fact: "Round Othello the Basin's irrigated and wide — long dark stretches, no service, no guide.",
    choices: [
      {
        label: "Buy the can ($40)",
        cost: 40,
        effects: { generous: true },
        chance: [
          { p: 0.8, effects: { fuelMi: +55 } },
          { p: 0.2, effects: { fuelMi: +25, hp: -3, dialogue: "That was NOT just gas, it's plain — the engine coughs and bucks in pain." } },
        ],
      },
      { label: "Ask about the road ahead", effects: { revealHazard: 'farm_equipment', dialogue: "\"Watch for tractors dark as pitch — they own these nights, and every ditch.\"" } },
      { label: "Risk it on empty", effects: {} },
    ],
  },

  // ── Bellevue (B) — tech-money hustle ────────────────────────────────────
  {
    id: 'bellevue_traffic_app',
    stopId: 'B', weight: 2,
    portrait: 'biz_founder', speaker: 'Startup Founder',
    line: "Our app dodges every trap clear to Pullman's gate — freemium, of course; the free tier's the letdown you'll hate.",
    fact: "Bellevue rose from a sleepy suburb's hush to glass-tower tech in two decades' rush.",
    choices: [
      {
        label: "Buy premium ($60)",
        cost: 60,
        effects: { generous: true },
        chance: [
          { p: 0.7, effects: { heatStars: -1, timeSec: +30, dialogue: "It actually works — two traps glide by unseen; she's already pitching a Series B, it seems." } },
          { p: 0.3, effects: { dialogue: "\"Servers are scaling!\" she chirps — then the app falls flat; and so does your sixty, just like that." } },
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
    line: "I need a pass-bound lift, that's true — cash up front, no chit-chat too; best offer you'll hear the whole day through.",
    fact: "Issaquah rests where the Cascades rear up, the last place the suburbs finally give up.",
    choices: [
      {
        label: "Pick her up",
        effects: { generous: true },
        chance: [
          { p: 0.6, effects: { cash: +40, dialogue: "She pays, reads the curves better than your GPS could, then's gone at the summit — a passenger good." } },
          { p: 0.4, effects: { heatStars: +1, dialogue: "Turns out she's on some watch-list, it seems — now you're right beside it, in the cops' bad dreams." } },
        ],
      },
      { label: "Take gas money, no ride", effects: { cash: +20, dialogue: "\"Cold. Respect,\" she says, unfazed — hands you a twenty and walks off unamazed." } },
      { label: "Drive on", effects: {} },
    ],
  },

  // ── Cle Elum (C) — elk country ranger ───────────────────────────────────
  {
    id: 'cleelum_ranger',
    stopId: 'C', weight: 2,
    portrait: 'park_ranger', speaker: 'Park Ranger',
    line: "Elk cross at dusk and don't check their blind side — and neither, it seems, do you when you ride.",
    fact: "The wooded Cle Elum run, foothill-lined, is prime elk country of the roaming kind.",
    choices: [
      { label: "Heed the warning", effects: { buff: 'elk_ready', revealHazard: 'elk', generous: true, dialogue: "\"Slow at the tree lines, mind your speed — they're bigger than your car's whole creed.\"" } },
      { label: "Point her at a 'lost hiker' up the road", effects: { heatStars: -1, dialogue: "She radios it in, thrown off the scent — your record breathes; the heat's misspent." } },
      { label: "Nod and leave", effects: {} },
    ],
  },

  // ── Ellensburg (E) — rodeo-town diner (recurring NPC via npcMemory) ──────
  {
    id: 'ellensburg_diner',
    stopId: 'E', weight: 3,
    portrait: 'diner_waitress', speaker: 'Diner Waitress',
    fact: "Ellensburg's a rodeo-college town, Kittitas' pride, roughly the halfway point of your statewide ride.",
    npcId: 'diner_waitress',
    // She remembers you — return visits open on a different greeting.
    startNode: (mem) => (mem?.met ? 'greetReturn' : 'greetFirst'),
    nodes: {
      greetFirst: {
        line: "Rodeo's in, so the coffee's fresh and the regulars are wild; you look on the run from something, child — pie?",
        choices: [
          { label: "Coffee & pie ($12)", cost: 12, conditions: { minCash: 12 }, setMemory: { met: true, hadPie: true }, effects: { hp: +4, timeSec: +15, fullness: +16, tiredness: -12, generous: true, dialogue: "Best call you've made the whole trip long — low bar, sure, but it's not wrong." }, end: true },
          { label: "What's ahead of me?", next: 'roadTalk', setMemory: { met: true } },
          { label: "Just the check, thanks", setMemory: { met: true }, effects: {}, end: true },
        ],
      },
      greetReturn: {
        line: "Well, look who survived the road's mean tricks — same booth's free, and you're getting pie; don't fight it, that's the fix.",
        choices: [
          { label: "The usual ($12)", cost: 12, conditions: { minCash: 12 }, setMemory: { hadPie: true }, effects: { hp: +4, timeSec: +15, fullness: +16, tiredness: -12, generous: true, dialogue: "\"Knew it,\" she grins; the pie appears before you've sat, allaying fears." }, end: true },
          { label: "Any news up the road?", next: 'roadTalk' },
          { label: "Just passing through — take care", effects: {}, end: true },
        ],
      },
      roadTalk: {
        line: "Past Vantage the wind will part your hair through the screen — all morning the truckers came in white and green.",
        choices: [
          { label: "Better fuel up on pie then ($12)", cost: 12, conditions: { minCash: 12 }, setMemory: { hadPie: true }, effects: { hp: +4, fullness: +16, tiredness: -12, revealHazard: 'wind', generous: true, dialogue: "\"Smart — nobody fights the wind and wins when their stomach's thin.\"" }, end: true },
          { label: "Thank her and hit the road", effects: { revealHazard: 'wind' }, end: true },
        ],
      },
    },
  },

  // ── Hatton (H) — the loneliest rest stop (dialogue tree) ────────────────
  {
    id: 'hatton_grandma',
    stopId: 'H', weight: 3,
    portrait: 'grandma', speaker: 'Roadside Grandma',
    fact: "Hatton's a speck on WA-26's thread, 'twixt Othello and Washtucna, sparse and spread.",
    startNode: 'greet',
    nodes: {
      greet: {
        line: "Few stop in Hatton, dear, it's true — I keep gas for the ones who do, and cookies… but the gas is safer for you.",
        choices: [
          { label: "Buy her gas ($35)", cost: 35, conditions: { minCash: 35 }, effects: { fuelMi: +50, generous: true, dialogue: "\"Drive safe, or don't, my dear — either way, the news'll reach my ear.\"" }, end: true },
          { label: "Safer? What's in the cookies?", next: 'cookies' },
          { label: "Why Hatton, of all places?", next: 'whyHatton' },
          { label: "Politely flee", effects: {}, end: true },
        ],
      },
      cookies: {
        line: "Butter and sugar and a recipe old — one the county begged me to leave untold; one won't hurt you… or so I'm told.",
        choices: [
          {
            label: "Take a cookie",
            chance: [
              { p: 0.7, effects: { hp: +3, fullness: +14, dialogue: "Strangely restoring, warm to the bone — you feel watched, but not alone." } },
              { p: 0.3, effects: { fullness: +14, timeSec: -20, dialogue: "You blink, and twenty minutes have flown — that's one fine cookie you've been thrown." } },
            ],
            end: true,
          },
          { label: "Maybe the gas instead", next: 'greet' },
          { label: "Decline politely and leave", effects: {}, end: true },
        ],
      },
      whyHatton: {
        line: "Somebody must watch this stretch, my dear; the road claims the careless who wander near — I just tidy the mess they leave here.",
        choices: [
          { label: "…About that gas", next: 'greet' },
          { label: "Thank her and back away slowly", effects: {}, end: true },
        ],
      },
    },
  },

  // ── Washtucna (W) — the tow driver who's seen things ────────────────────
  {
    id: 'washtucna_tow',
    stopId: 'W', weight: 2,
    portrait: 'tow_driver', speaker: 'Tow Driver',
    line: "Three wrecks a week I haul from this bend — business is good, which should worry you, friend.",
    fact: "Washtucna's a thin wheat-country line, with long, long gaps 'twixt help and sign.",
    choices: [
      { label: "Prepay a tow discount ($50)", cost: 50, effects: { buff: 'tow_insurance', generous: true, dialogue: "\"Crash, and I'll judge you — but only a bit; call it a discount on your fit.\"" } },
      { label: "Have her bang out a dent ($40)", cost: 40, effects: { hp: +12, dialogue: "A mallet, a grunt, a whack, a tad — and your car looks marginally less sad." } },
      { label: "Wave her off", effects: {} },
    ],
  },

  // ── Ellensburg (E) — coolant before the desert (engine-heat hook) ────────
  {
    id: 'ellensburg_coolant',
    stopId: 'E', weight: 2,
    portrait: 'desert_mechanic', speaker: 'Shade-Tree Mechanic',
    line: "Basin-bound? Top your coolant off right here — past Vantage the shade quits and the gauge climbs, I fear.",
    fact: "East of the Cascades the road drops to high desert's face — long, hot, and shadeless, the Columbia Basin's embrace.",
    choices: [
      { label: "Top off the coolant ($25)", cost: 25, effects: { coolEngine: 55, generous: true, dialogue: "He fills the radiator, spins the fan with care: \"That'll hold — probably. Say a prayer.\"" } },
      { label: "Fill your jug from his hose", effects: { hydration: +15, dialogue: "Warm hose water — not cold, but wet; he waves off your coins, no debt." } },
      { label: "I'll risk it", effects: {} },
    ],
  },

  // ── Othello (O) — Basin heat, the only lemonade for 50 miles (thirst) ────
  {
    id: 'othello_lemonade',
    stopId: 'O', weight: 2,
    portrait: 'lemonade_kids', speaker: 'Lemonade Kids',
    line: "Ice-cold lemonade, mister — best in the Basin, we swear! (It's also the ONLY one anywhere.)",
    fact: "The Columbia Basin bakes and reels each summer's turn — past the Saddle Mountains, triple digits burn.",
    choices: [
      { label: "Buy the whole pitcher ($5)", cost: 5, effects: { hydration: +35, generous: true, dialogue: "Worth every cent you're giving — your parched tongue rejoins the living." } },
      { label: "Just one cup ($1)", cost: 1, effects: { hydration: +18, dialogue: "Cold and impossibly sweet, that sip — you smack your lips and resume the trip." } },
      { label: "Wave and go", effects: {} },
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
  // "Generous" choices (tip, give a buck, help for free) occasionally pay karma
  // back — a RANDOM reward, ~30% of the time, not every time.
  if (effects.generous) {
    delete effects.generous;
    if (rng() < 0.30) {
      const rewards = [
        { e: { cash: +45 },    d: "Karma pays fast — what a break: forty-five in the visor, for kindness' sake." },
        { e: { cash: +80 },    d: "Miles on, a stranger picks up your tab: 'Pay it forward' — no need to grab." },
        { e: { fuelMi: +45 },  d: "Someone waves you in and fills your tank at large — free to the brim, and not a charge." },
        { e: { hp: +9 },       d: "A trucker knocks your dent out clean and spare — 'saw you help,' he says, 'back there.'" },
        { e: { timeSec: +45 }, d: "The road opens wide, every light turns green — you claw back time, the smoothest you've seen." },
      ];
      const pick = rewards[Math.floor(rng() * rewards.length)];
      for (const [k, v] of Object.entries(pick.e)) effects[k] = (effects[k] ?? 0) + v;
      dialogue = pick.d;
    }
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
  // Survival bars (0–100): a drink raises hydration, food raises fullness,
  // caffeine lowers tiredness (negative = more awake).
  if (effects.hydration   != null) ctx.addSurvival?.('hydration', effects.hydration);
  if (effects.fullness    != null) ctx.addSurvival?.('fullness',  effects.fullness);
  if (effects.tiredness   != null) ctx.addSurvival?.('tiredness', effects.tiredness);
  // Engine heat: positive coolEngine = degrees of temperature removed.
  if (effects.coolEngine  != null) ctx.coolEngine?.(effects.coolEngine);
}

// ── Dialogue-tree helpers (renderer-side; NO effect resolution here) ──────

/** True when a card is a multi-node dialogue tree. */
export function isDialogueTree(enc) {
  return !!(enc?.nodes && typeof enc.nodes === 'object');
}

/** Entry node id for a tree — `startNode` may be a function of the NPC's
 *  memory (recurring greeting) or a plain id.  Falls back to the first key. */
export function getStartNode(enc, mem = {}) {
  const s = typeof enc.startNode === 'function' ? enc.startNode(mem) : enc.startNode;
  if (s && enc.nodes?.[s]) return s;
  return Object.keys(enc.nodes ?? {})[0] ?? null;
}

/** Fetch a node, or a legacy view of a flat card (line/choices lifted into a
 *  synthetic single node whose choices all end) so one renderer serves both. */
export function getEncounterNode(enc, nodeId) {
  if (isDialogueTree(enc)) return enc.nodes[nodeId] ?? null;
  return {
    line: enc.line, speaker: enc.speaker, fact: enc.fact,
    choices: (enc.choices ?? [{ label: 'Continue', effects: {} }]).map(c => ({ ...c, end: true })),
  };
}

/** Evaluate a choice's `conditions` against { cash, buffs, memory }.
 *  Returns null when unlocked, else a short reason string for the gray-out. */
export function choiceLocked(choice, ctx = {}) {
  const c = choice?.conditions;
  if (!c) return null;
  if (c.minCash != null && (ctx.cash ?? 0) < c.minCash) return 'cash';
  if (c.hasBuff && !(ctx.buffs ?? []).includes(c.hasBuff)) return 'item';
  if (c.memory) {
    const mem = ctx.memory ?? {};
    for (const [k, want] of Object.entries(c.memory)) {
      if (want === true ? !mem[k] : mem[k] !== want) return 'memory';
    }
  }
  return null;
}

/** Author-time sanity check for every dialogue tree: valid startNode, every
 *  choice declares exactly next-or-end pointing at a real node, and every
 *  node keeps a reachable FREE unconditional exit (the polite way out).
 *  Returns an array of problem strings (empty = all good). */
export function validateEncounterTrees(list = REST_STOP_ENCOUNTERS) {
  const problems = [];
  for (const enc of list) {
    if (!isDialogueTree(enc)) continue;
    const ids = Object.keys(enc.nodes);
    const start = getStartNode(enc, {});
    if (!start) { problems.push(`${enc.id}: no resolvable startNode`); continue; }
    // Nodes from which a free (no cost/conditions) `end` is reachable.
    const safe = new Set();
    for (const id of ids) {
      for (const ch of enc.nodes[id].choices ?? []) {
        const hasNext = typeof ch.next === 'string';
        const hasEnd  = ch.end === true;
        if (hasNext === hasEnd) problems.push(`${enc.id}.${id}: choice "${ch.label}" must declare exactly one of next / end:true`);
        if (hasNext && !enc.nodes[ch.next]) problems.push(`${enc.id}.${id}: choice "${ch.label}" → unknown node "${ch.next}"`);
        if (hasEnd && !ch.cost && !ch.conditions) safe.add(id);
      }
    }
    // Propagate: a node is safe if a free unconditional choice leads to a safe node.
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of ids) {
        if (safe.has(id)) continue;
        for (const ch of enc.nodes[id].choices ?? []) {
          if (!ch.cost && !ch.conditions && typeof ch.next === 'string' && safe.has(ch.next)) {
            safe.add(id); grew = true; break;
          }
        }
      }
    }
    for (const id of ids) if (!safe.has(id)) problems.push(`${enc.id}.${id}: no free polite exit path`);
  }
  return problems;
}
