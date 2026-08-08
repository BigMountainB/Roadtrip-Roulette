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
// chance opportunities.  Keep the rhyme when editing content.
//
// REVISED (owner 2026-08-04): choice `label`s are no longer terse verbs
// ("Ask about the pass").  They are what the PLAYER says out loud, in quotes,
// in the player's own voice — often rhyming back at the NPC.  The old labels
// read as menu commands and made every conversation feel like a vending
// machine.  Every choice now also earns a `dialogue` response, so no branch
// dead-ends in silence.  Two consequences to respect when editing:
//   • Labels are SENTENCES now — RestStopScene sizes each choice button to its
//     wrapped label height.  Long is fine; endless still overflows the pane.
//   • `fact` on a card is effectively DEAD — RestStopScene prefers the
//     rotating `_townFact`, and every stop has town facts.  Real facts live in
//     townFacts.js; the `fact` lines below are kept only as the per-card
//     fallback and are held in sync with that file.
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
//   hydration   +/- Thirst bar 0–100 (a drink raises it)
//   fullness    +/- Hunger bar 0–100 (food raises it)
//   fullnessFloor raise Hunger UP TO this value; no-op if already higher
//   tiredness   +/- Tiredness 0–100 (caffeine LOWERS it → more awake)
//   coolEngine  degrees of engine temperature removed (coolant/fan)
//   generous    true = a generous act; ~30% chance of a random karma reward
//   dialogue    follow-up line shown after the choice resolves
//   storeOffer  { shop, item, price, note? } — the NPC does NOT sell you the
//               thing; he QUOTES you a price and it's waiting on that shop's
//               menu, this stop only (owner 2026-08-05: "any discounted items
//               should be priced in the store, not sold at that moment").
//               Merchandise only — a buff or a service with no counter to walk
//               to (tow insurance, the traffic app, a cookie) still changes
//               hands in the conversation.
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
    fact: "Pike Place Market opened in 1907 because onions had gone from a dime a pound to a dollar and farmers were done splitting the take with middlemen.",
    choices: [
      { label: "\"Any idea what the weather is doing up at the pass?\"", effects: { dialogue: "\"Past North Bend it's chains or a prayer — I hear it's a whiteout up there.\"" } },
      { label: "\"Here's a dollar, pal. I hope you spend it fair.\"", cost: 1, effects: { generous: true, dialogue: "\"A giver! How noble, chum — I need fifty, yet you've provided one.\"" } },
      { label: "\"This is not the establishment for me. Time to dip.\"", exit: true, effects: { dialogue: "He salutes you with a cup he found on the ground — \"Safe travels, moneybags. Try not to drown.\"" } },
    ],
  },

  // ── North Bend (N) — chains before the pass (dialogue tree) ─────────────
  {
    id: 'north_bend_chain_guy',
    stopId: 'N', weight: 3,
    portrait: 'chain_guy', speaker: 'Chain Guy',
    fact: "North Bend played the town of Twin Peaks in 1990 — Twede's Cafe on North Bend Way was the Double R Diner.",
    startNode: 'greet',
    nodes: {
      greet: {
        line: "You made it this far, but it's about to get tricky. Buy some chains and make the road less slippy.",
        choices: [
          { label: "\"Are you selling those tire chains?\" ($150)", exit: true, effects: { storeOffer: { shop: 'schwasted', item: 'chains', price: 150, note: "Chain Guy's price" }, dialogue: "\"I don't carry stock in my truck — I run the counter at Schwasted's. Ask for me; it's $150 with your luck.\"" }, end: true },
          { label: "\"Can you do any better on the price of those chains? Say $80?\"", next: 'haggle' },
          { label: "\"How bad can it be up there, really?\"", next: 'passInfo', effects: { dialogue: "\"If you have to ask, friend, here's my advice — stay in North Bend tonight and sleep on it twice.\"" } },
          { label: "\"I don't need chains. This isn't my first snowdeo.\"", exit: true, effects: { dialogue: "\"Snowdeo,\" he repeats, and spits in the slush. \"They all say that on the way up the brush.\"" }, end: true },
        ],
      },
      haggle: {
        line: "$120 — no receipt, no refund, no eye; that's my whole pitch, so buy or say bye.",
        choices: [
          {
            label: "\"Deal. Write it up before I think it through.\" ($120)",
            exit: true,
            effects: {
              storeOffer: { shop: 'schwasted', item: 'chains', price: 120, note: "haggled — no receipt" },
              dialogue: "\"$120, then. Tell the counter I sent you — and don't expect paperwork when you do.\"",
            },
            end: true,
          },
          { label: "\"Fine — full price, then. You win.\"", next: 'greet', effects: { dialogue: "\"You can pay full price here, or up there. It's much cheaper here.\"" } },
          { label: "\"I'll take my chances. Walk away.\"", exit: true, effects: { dialogue: "\"Suit yourself,\" he shrugs, already turned — \"the tow bill's steeper, but some folks like to learn.\"" }, end: true },
        ],
      },
      passInfo: {
        line: "Bad enough I'm here and not in bed — whiteout up top, and the plows are losing, it's said.",
        choices: [
          { label: "\"Not bad… if you have chains.\"", next: 'greet' },
          { label: "\"Appreciate the offer, but I think I got this.\"", exit: true, effects: { dialogue: "\"Everybody's got it,\" he says, \"'til they don't. I'd wish you luck, but honestly — I won't.\"" }, end: true },
        ],
      },
    },
  },

  // ── Snoqualmie Pass (SP) — ski bum warning ──────────────────────────────
  {
    id: 'pass_ski_bum',
    stopId: 'SP', weight: 2,
    portrait: 'ski_bum', speaker: 'Ski Bum',
    line: "Past the tunnel it's whiteout, thick and dread — slow is smooth, and smooth is not-dead.",
    fact: "The summit is 3,015 feet — the lowest major crossing of the Cascades, which tells you what the other ones are like.",
    choices: [
      { label: "\"Let me grab one of those thermoses off you.\" ($15)", cost: 15, conditions: { minCash: 15 }, effects: { buff: 'warm', timeSec: +100, tiredness: -25, generous: true, dialogue: "This coffee is so strong it could strip a door — you'll be wide awake and craving more." } },
      { label: "\"Is there a safer route to take? I don't want to end up in the lake.\"", effects: { dialogue: "\"It's crazy up there. Kind of storm only the bold would dare.\"" } },
      { label: "\"Thanks, but no thanks.\"", exit: true, effects: { dialogue: "\"No worries, my guy. Stay alert, keep the road in your eyes.\"" } },
    ],
  },

  // ── Vantage (V) — crosswind history ─────────────────────────────────────
  {
    id: 'vantage_wind_trucker',
    stopId: 'V', weight: 3,
    portrait: 'long_haul_mike', speaker: 'Long-Haul Mike',
    line: "My company card was just declined. Can you help me fill half the tank? My timeline is already behind.",
    fact: "The 1927 Vantage Bridge was taken apart in 1963 and rebuilt across the Snake River at Lyons Ferry, where it still carries traffic today.",
    choices: [
      { label: "\"I can't afford that kind of cash. Any idea what the road ahead holds? I'm hoping not to crash.\"", effects: { buff: 'wind_ready', dialogue: "\"It's going to be a wild ride. If the wind takes you, you wouldn't be the first who died.\"" } },
      {
        label: "\"It's your lucky day. My pockets are blessed and I'm willing to pay.\" ($100)",
        cost: 100, conditions: { minCash: 100 },
        effects: { generous: true },
        chance: [
          { p: 0.7, effects: { fuelMi: +40, dialogue: "He siphons you a fat share off his own tank — \"Company's problem now,\" he says, and you've got him to thank." } },
          { p: 0.3, effects: { fuelMi: +15, dialogue: "Half the diesel he swore he'd hand — that's trucker math, you understand." } },
        ],
      },
      { label: "\"Good luck with all that!\"", exit: true, effects: { dialogue: "\"Yeah,\" he says, to the wind and no one — \"luck. That's the one thing out here they don't run.\"" } },
    ],
  },

  // ── Othello (O) — dark basin, low gas ───────────────────────────────────
  {
    id: 'othello_farm_gas',
    stopId: 'O', weight: 2,
    portrait: 'farm_worker', speaker: 'Farm Worker',
    line: "You can fill up at any fuel stop. But I've got a mix that makes your mileage pop.",
    fact: "Othello got its name from a post office in Roane County, Tennessee. Nothing to do with Shakespeare.",
    choices: [
      {
        label: "\"I'll take you up on that rocket fuel.\" ($50)",
        cost: 50, conditions: { minCash: 50 },
        effects: { generous: true },
        chance: [
          { p: 0.8, effects: { fuelMi: +55, dialogue: "Dang! The tank reads impossibly full — whatever that was, it's got some pull." } },
          { p: 0.2, effects: { fuelMi: +25, hp: -3, dialogue: "That was NOT just gas, it's plain — the engine coughs and bucks in pain." } },
        ],
      },
      { label: "\"Anything I should expect to see on the road ahead?\"", effects: { dialogue: "\"Watch for tractors slow as tree pitch — they own the road, and every ditch.\"" } },
      { label: "\"You're very generous, but you make me nervous.\"", exit: true, effects: { dialogue: "He caps the can and grins with half a tooth — \"Smart man. Most folks can't handle the truth.\"" } },
    ],
  },

  // ── Bellevue (B) — tech-money hustle ────────────────────────────────────
  {
    id: 'bellevue_traffic_app',
    stopId: 'B', weight: 2,
    portrait: 'biz_founder', speaker: 'Startup Founder',
    line: "Our app dodges every speed trap in this state — the free tier is what the reviewers hate.",
    fact: "Until World War II an American whaling fleet wintered in Meydenbauer Bay — the lake's fresh water killed the barnacles off the hulls.",
    choices: [
      {
        label: "\"I'll support your vision. Sign me up for the annual subscription.\" ($100)",
        cost: 100, conditions: { minCash: 100 },
        effects: { generous: true },
        chance: [
          { p: 0.7, effects: { heatStars: -1, timeSec: +90, dialogue: "It actually works — two traps glide by unseen; she's already pitching a Series B, it seems." } },
          { p: 0.3, effects: { dialogue: "\"Servers are scaling!\" she chirps — then the app falls flat; and so does your hundred, just like that." } },
        ],
      },
      { label: "\"It's not the cops I dread, but more of the weather. Do you know what lies ahead…\"", effects: { dialogue: "\"The precip is mostly in the mountain heights, leaving Issaquah foggy AF. Might be worth upgrading to some fog lights.\"" } },
      { label: "\"You won't fool me. I know you collect info and track my location.\"", exit: true, effects: { dialogue: "\"We call it telemetry,\" she says, unbowed — \"and you agreed to it, out loud, in a crowd.\"" } },
    ],
  },

  // ── Issaquah (I) — hitchhiker toward the pass ───────────────────────────
  {
    id: 'issaquah_hitcher',
    stopId: 'I', weight: 2,
    portrait: 'hiker_woman', speaker: 'Hitchhiker',
    line: "I need a pass-bound lift, that's true — cash up front, I won't even talk to you.",
    fact: "The town incorporated as Gilman in 1892, then renamed itself Issaquah in 1899 to get closer to the Lushootseed word settlers had flattened into 'Squak.'",
    choices: [
      {
        label: "\"Lucky for you, I need the cash and have room for one more ass.\"",
        effects: { generous: true },
        chance: [
          { p: 0.6, effects: { cash: +80, dialogue: "She pays, reads the curves better than your GPS could, then's gone at the summit — a passenger good." } },
          { p: 0.4, effects: { cash: +20, heatStars: +1, dialogue: "Turns out she's on some watch-list, it seems — now you're right beside it, in the cops' bad dreams." } },
        ],
      },
      { label: "\"I don't really have the space. Do you know about the weather at the mountain's base?\"", effects: { dialogue: "\"I heard it's dumping buckets of rain in North Bend. Hope your wipers are prepared for full send.\"" } },
      { label: "\"Mom said not to talk to strangers.\"", exit: true, effects: { dialogue: "\"Your mom sounds smart,\" she says, thumb still out — \"shame she raised whatever this is about.\"" } },
    ],
  },

  // ── Cle Elum (C) — elk country ranger ───────────────────────────────────
  {
    id: 'cleelum_ranger',
    stopId: 'C', weight: 2,
    portrait: 'park_ranger', speaker: 'Park Ranger',
    line: "Elk cross at dusk and don't check their blind side — and neither, it seems, do you when you ride.",
    fact: "Cle Elum ran the last hand-operated telephone switchboard west of the Mississippi. The operators put through their final call on September 18, 1966.",
    choices: [
      { label: "\"Great advice. I'll keep my eyes out and my foot down.\"", effects: { buff: 'elk_ready', generous: true, dialogue: "\"Slow at the tree lines, mind your speed — they're bigger than your car's whole creed.\"" } },
      { label: "\"I heard you're looking for a lost hiker. I saw them at Commonwealth up at the pass.\"", effects: { heatStars: -1, dialogue: "She radios it in, thrown off the scent — your record breathes; the heat's misspent." } },
      { label: "\"Those elk better watch out for me!\"", exit: true, effects: { dialogue: "She writes nothing down, which is somehow worse — \"Seven hundred pounds,\" she says. \"You first.\"" } },
    ],
  },

  // ── Thorp (TH) — motel pool at the edge of nowhere ────────────────────
  {
    id: 'thorp_motel_pool',
    stopId: 'TH', weight: 2,
    portrait: 'swimsuit_girl', speaker: 'Swimsuit Girl',
    line: "Thorp goes dead quiet once the interstate clears — but the pool's still warm, and so are the beers.",
    fact: "The Thorp Mill started grinding Kittitas Valley wheat in April 1883 and didn't stop until 1946 — the oldest industrial artifact left in the county.",
    choices: [
      {
        label: "\"How much for a room? I'm running on fumes.\" ($40)",
        cost: 40, conditions: { minCash: 40 },
        effects: { tiredness: -40, timeSec: +45, dialogue: "She flips you the key with a wink, sly and slow — \"Shower's hot, bed's made… take it slow.\"" },
      },
      { label: "\"I won't say no to a drink by the water.\"", effects: { hydration: +10, dialogue: "Ice clinks in the glass she hands over, sincere — \"On the house, cowboy. Long roads breed thirst, I hear.\"" } },
      { label: "\"Is that old mill the only thing open around here?\"", effects: { dialogue: "\"That mill shut down in '46, my dear. You're two hundred miles from anything here.\"" } },
    ],
  },

  // ── Ellensburg (E) — rodeo-town diner (recurring NPC via npcMemory) ──────
  {
    id: 'ellensburg_diner',
    stopId: 'E', weight: 3,
    portrait: 'diner_waitress', speaker: 'Diner Waitress',
    fact: "Ellensburg was the front-runner to be state capital until a fire on the night of July 4, 1889 took out ten blocks of downtown. Investigators called it arson and never named anyone.",
    npcId: 'diner_waitress',
    // She remembers you — return visits open on a different greeting.
    startNode: (mem) => (mem?.met ? 'greetReturn' : 'greetFirst'),
    nodes: {
      greetFirst: {
        line: "Rodeo's in town, so the crowds are thick. But tip me well and I'll serve you quick.",
        choices: [
          { label: "\"Whatever's hot, and keep the coffee coming.\" ($40)", cost: 40, conditions: { minCash: 40 }, setMemory: { met: true, hadPie: true }, effects: { hp: +5, timeSec: +90, fullnessFloor: 60, tiredness: -18, generous: true, dialogue: "Best call you've made the whole trip long — low bar, sure, but it's not wrong." }, end: true },
          { label: "\"What's ahead of me?\"", next: 'roadTalk', setMemory: { met: true } },
          { label: "\"This place smells like an ashtray. I'll get food on the road.\"", exit: true, setMemory: { met: true }, effects: { dialogue: "\"Suit yourself, sugar,\" she says, unimpressed — \"the gas station sushi is what you like best.\"" }, end: true },
        ],
      },
      greetReturn: {
        line: "Well, look who survived the road's mean tricks — same booth's free, and you're getting pie; don't fight it, that's the fix.",
        choices: [
          { label: "\"I'll take the usual.\" ($40)", cost: 40, conditions: { minCash: 40 }, setMemory: { hadPie: true }, effects: { hp: +5, timeSec: +90, fullnessFloor: 60, tiredness: -18, generous: true, dialogue: "\"The usual,\" she repeats. \"Who ARE you?\" — then the plate lands hot, like she always knew." }, end: true },
          { label: "\"Any news up the road?\"", next: 'roadTalk' },
          { label: "\"Just passing through — take care!\"", exit: true, effects: { dialogue: "\"Take care yourself. And slower, if you're able — I'd hate to read your name across this table.\"" }, end: true },
        ],
      },
      roadTalk: {
        line: "Have you been to Vantage before? That wind can blow with the best of whores.",
        choices: [
          { label: "\"Then load me up first. I'm not fighting that hungry.\" ($40)", cost: 40, conditions: { minCash: 40 }, setMemory: { hadPie: true }, effects: { hp: +5, fullnessFloor: 60, tiredness: -18, generous: true, dialogue: "\"Smart — nobody fights the wind and wins when their stomach's thin.\"" }, end: true },
          { label: "\"Noted. Thanks for the warning.\"", exit: true, effects: { dialogue: "\"All morning the truckers came in white and green. Two hands on that wheel, and mind what's unseen.\"" }, end: true },
        ],
      },
    },
  },

  // ── Hatton (H) — the loneliest rest stop (dialogue tree) ────────────────
  {
    id: 'hatton_grandma',
    stopId: 'H', weight: 3,
    portrait: 'grandma', speaker: 'Roadside Grandma',
    fact: "Hatton peaked at 500 people in 1913, with three grain elevators, two hotels, a bank, and electric street lights. Count what's left.",
    startNode: 'greet',
    nodes: {
      greet: {
        line: "Few stop in Hatton, dear, it's true — I keep gas for the ones who do, and cookies… but the gas is safer for you.",
        choices: [
          { label: "\"I'll take the gas, ma'am. What's the damage?\" ($35)", cost: 35, conditions: { minCash: 35 }, effects: { fuelMi: +50, generous: true, dialogue: "\"Drive safe, or don't, my dear — either way, the news'll reach my ear.\"" }, end: true },
          { label: "\"Safer? What exactly is in those cookies?\"", next: 'cookies' },
          { label: "\"Why Hatton? There's nothing out here but wheat.\"", next: 'whyHatton' },
          { label: "\"You're sweet, ma'am, but I've seen this movie.\"", exit: true, effects: { dialogue: "\"Everyone has, dear,\" she says, and waves — \"and yet the road out here is still full of graves.\"" }, end: true },
        ],
      },
      cookies: {
        line: "Butter and sugar and a recipe old — one the county begged me to leave untold; one won't hurt you… or so I'm told.",
        choices: [
          {
            label: "\"One cookie. For the road. What could go wrong?\"",
            chance: [
              { p: 0.7, effects: { hp: +3, fullness: +14, dialogue: "Strangely restoring, warm to the bone — you feel watched, but not alone." } },
              { p: 0.3, effects: { fullness: +14, timeSec: -20, dialogue: "You blink, and twenty minutes have flown — that's one fine cookie you've been thrown." } },
            ],
            end: true,
          },
          { label: "\"On second thought — let's stick to the gas.\"", next: 'greet' },
          { label: "\"I'm allergic to whatever that is.\"", exit: true, effects: { dialogue: "\"To butter?\" she asks, and holds your eye too long — \"or to something you can't name, but know is wrong?\"" }, end: true },
        ],
      },
      whyHatton: {
        line: "Five hundred lived here once — two hotels, a bank, three elevators, electric light. Somebody's got to stay and mind what's left of the night.",
        choices: [
          { label: "\"Where'd everybody go?\"", next: 'greet', effects: { dialogue: "\"West, mostly. The rest the road took its due — I just tidy up after, and wait on the few.\"" } },
          { label: "\"…About that gas.\"", next: 'greet' },
          { label: "\"Thank you, ma'am. I'll be going now. Slowly.\"", exit: true, effects: { dialogue: "She watches you the whole way to the door — grandmothers in Hatton have done this before." }, end: true },
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
    fact: "Palouse Falls, twenty minutes south, drops 198 feet into a scabland gorge and has been the official state waterfall since 2014.",
    choices: [
      { label: "\"What's it cost to have you on call before I need you?\" ($50)", cost: 50, conditions: { minCash: 50 }, effects: { buff: 'tow_insurance', generous: true, dialogue: "\"Crash, and I'll judge you — but only a bit; call it a discount on your fit.\"" } },
      { label: "\"Can you bang this dent out before I head on?\" ($40)", cost: 40, conditions: { minCash: 40 }, effects: { hp: +12, dialogue: "A mallet, a grunt, a whack, a tad — and your car looks marginally less sad." } },
      { label: "\"Three a week? What's actually putting them in the ditch?\"", effects: { dialogue: "\"Straight road, no lights, and nothing to see — they nod off at seventy and wake up in a tree.\"" } },
      { label: "\"I don't plan on wrecking. That's the whole plan.\"", exit: true, effects: { dialogue: "She laughs once, hard, and turns to walk away — \"I'll leave the CB on anyway.\"" } },
    ],
  },

  // ── Ellensburg (E) — coolant before the desert (engine-heat hook) ────────
  {
    id: 'ellensburg_coolant',
    stopId: 'E', weight: 2,
    portrait: 'desert_mechanic', speaker: 'Shade-Tree Mechanic',
    line: "Basin-bound? Top your coolant off right here — past Vantage the shade quits and the gauge climbs, I fear.",
    fact: "The Ellensburg Rodeo has run since September 1923, when it was bolted onto the county fair just to draw a bigger crowd.",
    choices: [
      { label: "\"Top it off. I'd rather not boil over out there.\" ($25)", exit: true, effects: { storeOffer: { shop: 'fap', item: 'coolant', price: 25, note: "his price, not theirs" }, dialogue: "\"I don't keep jugs on me — I moonlight at Finesse. Ask inside, twenty-five, and say I said yes.\"" } },
      { label: "\"Mind if I fill my jug off your hose?\"", effects: { hydration: +15, dialogue: "Warm hose water — not cold, but wet; he waves off your coins, says you owe him no debt." } },
      { label: "\"What am I actually watching for — the gauge, or something else?\"", effects: { dialogue: "\"Smell comes first — sweet, like syrup on the breeze. By the time that needle climbs, you're already on your knees.\"" } },
      { label: "\"She's run this far. She'll run the rest.\"", exit: true, effects: { dialogue: "\"They all run fine 'til the needle goes red. Then they run hot. Then they run dead.\"" } },
    ],
  },

  // ── Othello (O) — Basin heat, the only lemonade for 50 miles (thirst) ────
  {
    id: 'othello_lemonade',
    stopId: 'O', weight: 2,
    portrait: 'lemonade_kids', speaker: 'Lemonade Kids',
    line: "Ice-cold lemonade, mister — best in the Basin, we swear! (It's also the ONLY one anywhere.)",
    fact: "Thousands of sandhill cranes stage here every March, and the town has thrown them a festival since 1998.",
    choices: [
      { label: "\"I'll take the whole pitcher. Keep the change.\" ($5)", cost: 5, conditions: { minCash: 5 }, effects: { hydration: +35, generous: true, dialogue: "Worth every cent that you're forgiving — your parched tongue rejoins the living." } },
      { label: "\"Just the one cup. I'm rationing.\" ($1)", cost: 1, conditions: { minCash: 1 }, effects: { hydration: +18, dialogue: "Cold and impossibly sweet, that sip — you smack your lips and resume the trip." } },
      { label: "\"Straight answer: is there anything at all between here and the next town?\"", effects: { dialogue: "\"Circles of corn and a whole lot of sun.\" The taller one shrugs. \"Dad says buy two. We only sell one.\"" } },
      { label: "\"Shouldn't you two be in school?\"", exit: true, effects: { dialogue: "\"It's August.\" They stare you flat down, unimpressed — you pull away feeling less than blessed." } },
    ],
  },
];

// ── Shop greeters (owner 2026-07-30, revised same day) ────────────────────
// One per business brand — NOT part of the random per-stop encounter pool
// above (no stopId/weight; keyed by SHOP key instead and shown deterministically
// by RestStopScene the first time that specific shop is entered, same
// `_showEncounterCard` renderer as everything above). `once: true` — after the
// first visit to a given shop the greeter is skipped and the storefront opens
// straight to the menu. Portrait is a close-up of the SAME character already
// visible in that shop's full-bleed storefront background (see
// `npcBusinesses:` in AssetManifest.js).
//
// REVISED (owner, same day): only 1-2 shops are meant to be actual mission
// contacts — "it's up to the player to find them." Everywhere else stays
// FILLER in function: no jobs, no branching, no memory, straight into the
// storefront on the first tap.
// `fact` is deliberately omitted below: `_showEncounterCard` already prefers
// `this._townFact` (the rotating per-stop fact) over a card's own `fact`, so
// leaving it unset means these automatically surface the SAME rotating facts
// every other card at this stop uses — no duplicate fact system needed.
//
// REVISED AGAIN (owner 2026-08-04): filler in FUNCTION is not the same as
// filler in VOICE. All 11 shared one verbatim "Welcome in! What can I help you
// with?", which is the single most-repeated line in the game. Each brand now
// gets one couplet in its own voice — still `once: true`, still three terminal
// choices, still zero mechanics. The three player choices stay shared: the
// action must read the same at every counter.
//
// STILL OPEN: which 1-2 shop keys are the real mission contacts, and what
// that card should actually show (presumably reusing `_buildMissionEncounter`
// / the existing NPC_NAMES mission-contact system in MissionSystem.js, rather
// than a new one) — do not guess a shop for this; ask.
const GENERIC_GREETER_CHOICES = [
  { label: "\"Let's see what you've got.\"", effects: {} },
  { label: "\"Just browsing. Don't hover.\"", exit: true, effects: { dialogue: "\"Wouldn't dream of it. Holler if you need me.\"" } },
  { label: "\"Anything I should know about the road ahead?\"", effects: { dialogue: "\"Same as it ever is — too fast, too dark, and full of folks like you.\"" } },
];
function greeter(shopKey, portrait, speaker, line) {
  return { id: `greeter_${shopKey}`, once: true, portrait, speaker, line, choices: GENERIC_GREETER_CHOICES };
}
export const SHOP_GREETERS = {
  gas:       greeter('gas',       'biz_huffs',     "Huff's Attendant",
    "Pump six is honest, pump four is a liar — pay inside or you'll stand here 'til you retire."),
  cargo:     greeter('cargo',     'biz_cargo',     'CarGo Dispatcher',
    "Freight's freight and the clock doesn't care — load's out back if you're headed there."),
  hunting:   greeter('hunting',   'biz_cowbellas', 'CowBella Shopkeeper',
    "Everything in here is orange, lethal, or both — pick one and I'll spare you the safety oath."),
  camp:      greeter('camp',      'biz_aok',       'AOK Camp Host',
    "Tents, tarps, and a stove that half-works — everything you need to regret the outdoors and its perks."),
  lord:      greeter('lord',      'biz_lord',      'Lord Motors Manager',
    "Every car on this lot runs. That's the pitch. Past that, we negotiate which."),
  suck:      greeter('suck',      'biz_suck',      "Sam's Owner",
    "Sam's not here. Sam is never here. I do the wrenching and Sam does the beer."),
  vices:     greeter('vices',     'biz_gasnsip',   'Gas-N-Sip Clerk',
    "Coolers on the left, regrets on the right — I quit judging people around midnight."),
  ambm:      greeter('ambm',      'biz_am_bm',     'AM/BM Clerk',
    "Whatever you're after, don't say it out loud. Point, pay, and go rejoin the crowd."),
  parkride:  greeter('parkride',  'biz_parkride',  'Metro Park & Ride Courier',
    "I move what fits in a trunk and don't ask — point me at yours and name the task."),
  schwasted: greeter('schwasted', 'biz_schwasted', 'Les Schwasted Tech',
    "Free beef with every set of tires. Long story. Don't ask about the fires."),
  fap:       greeter('fap',       'biz_fap',       'Finesse Technician',
    "You want it fast, or you want it pretty? Both costs double. That's the city."),
};

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
 *          grantUpgrade } — each optional; missing ones are
 *  skipped so this works before the upgrade/buff systems exist. */
export function applyEncounterEffects(effects = {}, ctx = {}) {
  if (effects.cash        != null) ctx.addCash?.(effects.cash);
  if (effects.fuelMi      != null) ctx.addFuelMi?.(effects.fuelMi);
  if (effects.hp          != null) ctx.addHp?.(effects.hp);
  if (effects.heatStars   != null) ctx.addHeat?.(effects.heatStars);
  if (effects.timeSec     != null) ctx.addTimeSec?.(effects.timeSec);
  if (effects.buff)                ctx.addBuff?.(effects.buff);
  if (effects.grantUpgrade)        ctx.grantUpgrade?.(effects.grantUpgrade);
  // Survival bars (0–100): a drink raises hydration, food raises fullness,
  // caffeine lowers tiredness (negative = more awake).
  if (effects.hydration   != null) ctx.addSurvival?.('hydration', effects.hydration);
  if (effects.fullness    != null) ctx.addSurvival?.('fullness',  effects.fullness);
  if (effects.tiredness   != null) ctx.addSurvival?.('tiredness', effects.tiredness);
  // A sit-down MEAL sets a floor rather than adding a delta — "fullness to
  // 60% if lower, leave it alone if higher" (owner 2026-08-04, diner). Adding
  // a flat +16 to an already-full player wasted the whole $40.
  if (effects.fullnessFloor != null) ctx.raiseSurvivalTo?.('fullness', effects.fullnessFloor);
  // Engine heat: positive coolEngine = degrees of temperature removed.
  if (effects.coolEngine  != null) ctx.coolEngine?.(effects.coolEngine);
  // Price quoted, not paid — the row is repriced on that shop's menu instead.
  if (effects.storeOffer)          ctx.storeOffer?.(effects.storeOffer);
}

// ── Dialogue-tree helpers (renderer-side; NO effect resolution here) ──────

/** Does this choice CLOSE the conversation (and open the storefront behind it),
 *  or does the NPC answer and the card stay up?  Owner 2026-08-05: "only some
 *  of the responses should go on to the next screen… player must select a
 *  sentence that moves off the conversation to get to the storefront."
 *
 *  The rule, in one line: **words are free, resources cost you the conversation.**
 *    • `next` — walks to another node, never an exit.
 *    • `exit: true` — explicit, always wins. Needed on the *leave* lines
 *      ("Time to dip", "Walk away"), which carry only a parting `dialogue` and
 *      are otherwise indistinguishable from a question.
 *    • a `cost` or a `chance` gamble — a transaction. Exits.
 *    • effects that are ONLY talk (`dialogue`, a prep `buff`, the `generous`
 *      karma flag) — a question. Stays open.
 *    • anything that moves cash / HP / fuel / heat / a survival bar — exits, so
 *      one NPC still pays out one resource per visit, exactly as before.
 *    • no effects at all ("Let's see what you've got") — exits.
 *  Repeats aren't a worry: the renderer strikes a question once it's asked. */
const INFO_ONLY_EFFECTS = new Set(['dialogue', 'buff', 'generous']);
export function isExitChoice(choice) {
  if (!choice) return true;
  if (typeof choice.exit === 'boolean') return choice.exit;
  if (typeof choice.next === 'string') return false;
  if (choice.cost || (Array.isArray(choice.chance) && choice.chance.length)) return true;
  const keys = Object.keys(choice.effects ?? {});
  return !(keys.length && keys.every(k => INFO_ONLY_EFFECTS.has(k)));
}

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
