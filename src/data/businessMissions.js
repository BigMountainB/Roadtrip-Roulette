// ── Per-business mission pools (owner draft 2026-07-28, built 2026-07-30) ──
//
// Five missions per business, ten businesses.  A run ACTIVATES only a subset
// of each pool (see MissionSystem._activeTemplates) so no two runs offer the
// same work — owner's "keeps things fresh".
//
// The business keys are the amenity keys in REST_STOPS (constants.js), so a
// stop can only offer work from businesses it actually has.
//
// ── `needs` — the staged-build contract ───────────────────────────────────
// Every template lists the condition clauses it requires.  A template is
// OFFERABLE only when every clause it needs is in IMPLEMENTED_CLAUSES below.
// That is why the whole 50 can live here from day one: the rotation draws
// from what the engine can actually enforce, and each clause added in a later
// slice widens the live pool automatically, with no edits to this file.
//
// Shipping a watered-down version of a mission whose CATCH isn't implemented
// would be worse than not offering it — "Bear Canister" without the smell
// mechanic is just another fragile crate.  So those wait.
//
// ── Template fields ───────────────────────────────────────────────────────
//   id        unique, prefixed by business key
//   name      display name (the owner's title)
//   type      delivery | timed | passenger | challenge | escort
//   cargo     "what am I hauling" line (passenger templates use `quirk`)
//   pitch     the contact's one-line offer, in-voice
//   needs     [] = ready now; otherwise the clauses that gate it
//   Terms shorthand, expanded by MissionSystem._termsFromTemplate:
//     fragile: <maxHpDamage>   perishable: true   illegal: true
//     rush: true (budget from route miles)   rushSec: <fixed seconds>
//     quirk: '<passenger quirk>'
//   targetStopId  pins an authored destination (else the tier window picks)

/** Clauses the engine can enforce TODAY.  Grow this as slices land; the
 *  rotation and the offer generator both read it. */
export const IMPLEMENTED_CLAUSES = new Set([
  // slice 1 — everything the shipped mission engine already enforces
  'fragile', 'perishable', 'illegal', 'rush', 'passengerQuirk', 'authoredTarget',
  // slice 1 — chain runs (owner 2026-07-30): a delivery aimed at the NEXT
  // branch of a named business rather than any stop in the tier window.
  'destBusiness',
  // slice 2 — condition clauses.  FAIL clauses kill the job on violation;
  // EFFECT clauses change the drive or the pay (see CLAUSE_DEFAULTS in
  // MissionSystem.js).
  'noEating', 'pacifist', 'speedFloor', 'speedCap',
  'fuelFloor', 'alertFloor', 'cashExact',
  'heatCarried', 'survivalDrain', 'damageDock', 'tipBySpeed',
  // slice 3 — the CHALLENGE class: reactive dares with their own clock, an
  // item grant, and payment on the road (no destination).
  'challenge', 'useItemsInTime', 'speedBand', 'boostSeconds',
]);

// ── Chain runs (`destBiz`) ────────────────────────────────────────────────
// `destBiz: 'same'` targets the next stop carrying the SAME business; a key
// targets that business ("take it to the next AM/BM").  The destination is
// dictated by the chain, so these IGNORE the rep-tier mileage window — they
// can run long, and the per-mile payout plus a chain bonus is the reward.
// Owner 2026-07-30: "make a lot of the deliveries business to like business."

export const BUSINESS_MISSIONS = {
  // ── Huff's Gas ──────────────────────────────────────────────────────────
  gas: [
    { id: 'gas_fuel_run', name: 'Fuel Run', type: 'timed', rush: true,
      cargo: 'a sloshing jerrycan',
      pitch: "Guy's dry on the shoulder and his engine's cooking. Run him this can before it seizes.",
      needs: [] },
    { id: 'gas_hitcher', name: 'Ride Along', type: 'passenger', quirk: 'nervous',
      pitch: "Kid's been out by the pumps for an hour. Take him as far as you're going.",
      needs: [] },
    { id: 'gas_grease_trap', name: 'Grease Trap', type: 'delivery', fragile: 15,
      cargo: 'four drums of used fryer oil',
      pitch: "Fryer oil, and the lids are a suggestion. Every bump you take, I smell it.",
      needs: [] },
    { id: 'gas_pump_dump', name: 'Pump & Dump', type: 'delivery', fuelFloor: true,
      cargo: 'a fuel-transfer manifest',
      pitch: "Roll into the next stop with the tank still above 90% and I'll buy the difference back off you.",
      needs: [] },
    { id: 'gas_price_war', name: 'Price War', type: 'timed', rushSec: 240, destBiz: 'same',
      cargo: "tomorrow's price list",
      pitch: "Get this to the next Huff's inside four minutes and we undercut them before they open.",
      needs: ['destBusiness'] },
  ],

  // ── Gas-N-Sip ───────────────────────────────────────────────────────────
  vices: [
    { id: 'vices_restock', name: 'Restock', type: 'delivery', destBiz: 'same',
      cargo: 'two crates of CowBella jerky',
      pitch: "Our other store is bare and we're stacked. Run these to the next Gas-N-Sip east.",
      needs: ['destBusiness'] },
    { id: 'vices_munchie_mule', name: 'Munchie Mule', type: 'delivery', noEating: true,
      cargo: 'a pallet of snacks, counted',
      pitch: "Counted, weighed, and I'll count it again. You eat one thing and the deal's off.",
      needs: [] },
    { id: 'vices_cold_chain', name: 'Cold Chain', type: 'timed', rushSec: 90,
      speedFloor: { mph: 60 },
      cargo: 'a slushie machine cartridge',
      pitch: "Ninety seconds before it's syrup. Don't crawl and don't stop.",
      needs: [] },
    { id: 'vices_stoner_hitcher', name: 'Bud Run', type: 'passenger', quirk: 'thrill_seeker',
      pitch: "He's got no money but he's got product. Ride him to his buddy's and he'll square up.",
      needs: ['vicePayout'] },
    { id: 'vices_sugar_rush', name: 'Sugar Rush', type: 'challenge',
      pay: 300, grant: { item: 'caffeine', count: 3 }, grantLabel: '3 espressos',
      goal: { kind: 'speedBand', minMph: 100, holdSec: 30, limitSec: 120 },
      pitch: "Three espressos, on me. Hold a hundred for thirty seconds and there's $300 in it.",
      needs: [] },
  ],

  // ── AM/BM ───────────────────────────────────────────────────────────────
  ambm: [
    // Owner's line, verbatim (2026-07-30) — the canonical chain run.
    { id: 'ambm_brother', name: "Brother's Package", type: 'delivery', illegal: true, destBiz: 'same',
      cargo: "a package you were told not to open",
      pitch: "Take this package to my brother. He's at the next AM/BM. Don't look inside. He'll know.",
      needs: ['destBusiness'] },
    { id: 'ambm_atm_parts', name: 'ATM Parts', type: 'delivery', fragile: 8,
      cargo: 'a crate of ATM internals',
      pitch: "Circuit boards. They don't bend, they break. Bring it in clean.",
      needs: [] },
    { id: 'ambm_armored', name: 'Armored Run', type: 'delivery', illegal: true,
      heatCarried: { stars: 2 },
      cargo: 'a canvas bag that clinks',
      pitch: "Don't count it, don't open it, and don't let them pull you over carrying it.",
      needs: [] },
    { id: 'ambm_repo', name: 'Repo Notice', type: 'delivery',
      cargo: 'a folder of repossession papers',
      pitch: "Serve these at the next stop. He'll run the second he sees your face.",
      needs: ['npcFlee'] },
    { id: 'ambm_loan_shark', name: 'Loan Shark', type: 'delivery',
      cargo: "someone else's money",
      pitch: "Five hundred in your hand right now. Nine hundred back to me two stops on. Do the math.",
      needs: ['cashAdvance'] },
    { id: 'ambm_audit', name: 'Audit Week', type: 'delivery', cashExact: true,
      cargo: 'a balanced ledger',
      pitch: "Show up with exactly the number on this slip in your pocket and I'll match it.",
      needs: [] },
  ],

  // ── CowBella ────────────────────────────────────────────────────────────
  hunting: [
    { id: 'hunt_trophy', name: 'Trophy Haul', type: 'delivery', illegal: true, destBiz: 'same',
      cargo: 'a rack of antlers, tagged by nobody',
      pitch: "These didn't come with paperwork. Next CowBella east knows what to do with them — a trooper sees them, that's on you.",
      needs: ['destBusiness'] },
    { id: 'hunt_fireworks', name: 'Fireworks Frenzy', type: 'challenge',
      pay: 250, grant: { item: 'fireworks', count: 3 }, grantLabel: '3 firework shows',
      goal: { kind: 'useItemsInTime', item: 'fireworks', count: 3, limitSec: 45 },
      pitch: "I'll load you to three. Burn all three inside forty-five seconds and there's $250 in it.",
      needs: [] },
    { id: 'hunt_ammo_run', name: 'Ammo Run', type: 'delivery', pacifist: true,
      cargo: 'a case of shells',
      pitch: "Carry it quiet. You fire anything on this run and I hear about it.",
      needs: [] },
    { id: 'hunt_decoy', name: 'Decoy Deploy', type: 'challenge',
      pitch: "Two boxes of donuts, two spots on the map. Drop them where I tell you.",
      needs: ['challenge', 'dropAtMiles'] },
    { id: 'hunt_wolf_scare', name: 'Wolf Scare', type: 'challenge',
      pitch: "Wolves are back in the timber. Roll three clouds through there and they'll move on.",
      needs: ['challenge', 'useItemsInZone'] },
  ],

  // ── AOK Camp ────────────────────────────────────────────────────────────
  camp: [
    { id: 'camp_hot_springs', name: 'Hot Springs Water', type: 'timed', rushSec: 120,
      cargo: 'a sealed drum of spring water',
      pitch: "It's only worth anything hot. Two minutes, then it's just water.",
      needs: [] },
    { id: 'camp_firewood', name: 'Firewood', type: 'delivery', speedCap: { mph: 70 },
      cargo: 'a cord of split fir',
      pitch: "Load's taller than your roof. You'll feel it — and you'll get paid by the mile.",
      needs: [] },
    { id: 'camp_lost_camper', name: 'Lost Camper', type: 'passenger', quirk: 'nervous',
      alertFloor: true,
      pitch: "She's been walking since dawn. Get her there awake and I'll make it worth it.",
      needs: [] },
    { id: 'camp_smores', name: "S'mores Kit", type: 'timed', rush: true,
      cargo: 'a melting box of chocolate',
      pitch: "Chocolate and sun don't mix. Beat the dark or bring me soup.",
      needs: ['duskTimer'] },
    { id: 'camp_bear_can', name: 'Bear Canister', type: 'delivery', fragile: 10,
      cargo: 'a bear canister, still ripe',
      pitch: "Seal's cracked and it reeks. Anything with a nose is going to find you.",
      needs: ['smelly'] },
  ],

  // ── Lord Motors ─────────────────────────────────────────────────────────
  lord: [
    { id: 'lord_battery', name: 'Battery Courier', type: 'delivery', fragile: 12,
      cargo: 'a pallet cell, dead weight',
      pitch: "Six hundred pounds of battery. You'll stop like a barge — plan for it.",
      needs: ['brakePenalty'] },
    { id: 'lord_test_drive', name: 'Test Drive', type: 'challenge',
      pay: 400,
      goal: { kind: 'speedBand', minMph: 70, maxMph: 80, holdSec: 60, limitSec: 240 },
      pitch: "Hold seventy to eighty for a solid minute, no crashes, and the data's worth $400 to us.",
      needs: [] },
    { id: 'lord_software_key', name: 'Software Key', type: 'delivery', pacifist: true,
      cargo: 'a signing key on a fob',
      pitch: "Quiet run. No horn, nothing fired, nobody remembers you were here.",
      needs: [] },
    { id: 'lord_exec', name: 'Exec Pickup', type: 'passenger', quirk: 'carsick',
      damageDock: { perHp: 40 },
      pitch: "He's important and he's insured. Every dent comes out of your end.",
      needs: [] },
    { id: 'lord_recall', name: 'Recall Notice', type: 'challenge',
      pitch: "Three of our cars are out there on a bad batch. Get close enough to tag them.",
      needs: ['challenge', 'tagTraffic'] },
  ],

  // ── Sam's Used Car Kingdom ──────────────────────────────────────────────
  suck: [
    { id: 'suck_sketchy_parts', name: 'Sketchy Parts', type: 'delivery', illegal: true,
      cargo: 'an unmarked crate, no invoice',
      pitch: "You don't ask, I don't tell, and neither of us talks to a trooper about it.",
      needs: [] },
    { id: 'suck_lot_rat', name: 'Lot Rat', type: 'delivery',
      cargo: 'a beater that has to survive',
      pitch: "Drive this heap one stop. It's got ten health in it and it cannot die.",
      needs: ['hpLock'] },
    { id: 'suck_tow_job', name: 'Tow Job', type: 'escort',
      cargo: 'a limping trade-in',
      pitch: "Stay with him. He can't do more than sixty and he'll panic if you leave.",
      needs: ['escort'] },
    { id: 'suck_plate_swap', name: 'Plate Swap', type: 'delivery', illegal: true,
      cargo: 'a stack of plates, various states',
      pitch: "Keep it legal the whole way. They stop you carrying these, you're done.",
      needs: ['bustOnSpeed'] },
    { id: 'suck_auction', name: 'Auction Sniper', type: 'timed', rush: true, destBiz: 'same',
      cargo: 'a sealed bid',
      pitch: "Rival's bidding at the next lot. Beat him there and the car's ours.",
      needs: ['destBusiness'] },
  ],

  // ── Les Schwasted ───────────────────────────────────────────────────────
  schwasted: [
    { id: 'schw_chain_run', name: 'Chain Run', type: 'timed', rush: true,
      targetStopId: 'SP',
      cargo: 'a pallet of tire chains',
      pitch: "Pass is about to close and they've got nothing up there. Beat the storm window.",
      needs: [] },
    { id: 'schw_warranty', name: 'Warranty Claim', type: 'delivery', illegal: true, destBiz: 'same',
      cargo: 'a "defective" tire, suspiciously heavy',
      pitch: "Customer wants a refund on this. Our next shop handles the paperwork — don't look inside it on the way.",
      needs: ['destBusiness'] },
    { id: 'schw_tire_stack', name: 'Tire Stack', type: 'delivery',
      cargo: 'a stack of tires roped to the roof',
      pitch: "Stacked high and roped bad. She'll fight you in the corners.",
      needs: ['steerPenalty'] },
    { id: 'schw_blowout', name: 'Blowout Rescue', type: 'timed', rush: true,
      cargo: 'a spare and a jack',
      pitch: "She's on the shoulder with a shredded tire. Get there before the law does.",
      needs: ['npcRescue'] },
    { id: 'schw_stud_test', name: 'Stud Test', type: 'challenge',
      pitch: "New studs. Take them through the snow and don't slide once — $350 says you can't.",
      needs: ['challenge', 'noSlide'] },
  ],

  // ── Finesse Autobody & Performance ──────────────────────────────────────
  fap: [
    { id: 'fap_show_car', name: 'Show Car', type: 'delivery', fragile: 0, destBiz: 'same',
      cargo: "a client's show car, on your bumper",
      pitch: "Zero new damage, not a scuff, all the way to our next shop. Longer you haul it clean, the better it pays.",
      needs: ['destBusiness'] },
    { id: 'fap_paint_job', name: 'Paint Job', type: 'delivery',
      cargo: 'panels with the clear coat still wet',
      pitch: "Paint's wet. One rain shower, one puddle, and you've bought me a repaint.",
      needs: ['wetPaint'] },
    { id: 'fap_chop_run', name: 'Chop Run', type: 'delivery', illegal: true,
      cargo: 'parts with somebody else\'s numbers',
      pitch: "These are hot but they cool. Sit on them a while, or run them now and risk it.",
      needs: ['decayHeat'] },
    { id: 'fap_dyno_dash', name: 'Dyno Dash', type: 'challenge',
      pay: 350,
      goal: { kind: 'boostSeconds', sec: 20 },
      pitch: "I need twenty seconds of full boost logged. Doesn't matter where you find it.",
      needs: [] },
    { id: 'fap_body_double', name: 'Body Double', type: 'delivery',
      cargo: "somebody else's car, and they've got yours",
      pitch: "Swap keys with me. You take his one leg, he takes yours. Don't scratch it.",
      needs: ['carSwap'] },
  ],

  // ── Metro Park & Ride ───────────────────────────────────────────────────
  parkride: [
    { id: 'park_left_luggage', name: 'Left Luggage', type: 'delivery', destBiz: 'same',
      cargo: "a bag nobody claimed",
      pitch: "Been in our lost-and-found a month. Run it to the next Park & Ride — could be socks, could be better.",
      needs: ['destBusiness'] },
    { id: 'park_commuter', name: 'Commuter', type: 'passenger', quirk: 'nervous',
      pitch: "Three of them, three different stops, and they'll tell you the order.",
      needs: ['multiDrop'] },
    { id: 'park_vanpool', name: 'Vanpool', type: 'passenger', quirk: 'carsick',
      survivalDrain: true,
      pitch: "Full car. They eat your snacks, they drink your water, they pay well.",
      needs: [] },
    { id: 'park_lost_found', name: 'Lost & Found', type: 'delivery', tipBySpeed: true,
      cargo: 'a phone still buzzing',
      pitch: "Owner's frantic. She tips on how fast it lands in her hand.",
      needs: [] },
    { id: 'park_meter_maid', name: 'Meter Maid', type: 'challenge',
      pitch: "Three cars in the lot are expired. Roll past close enough to shoot the plates.",
      needs: ['challenge', 'closePass'] },
  ],
};

/** Business key → display name, for the contact's pitch ("CowBella needs…"). */
export const BUSINESS_LABELS = {
  gas: "Huff's Gas", vices: 'Gas-N-Sip', ambm: 'AM/BM', hunting: 'CowBella',
  camp: 'AOK Camp', lord: 'Lord Motors', suck: "Sam's", schwasted: 'Les Schwasted',
  fap: 'Finesse Autobody', parkride: 'Park & Ride',
};

/** True when every clause a template needs is implemented. */
export function templateReady(t) {
  return (t.needs ?? []).every(c => IMPLEMENTED_CLAUSES.has(c));
}

/** Flat list of every template, business key attached. */
export function allTemplates() {
  const out = [];
  for (const [biz, list] of Object.entries(BUSINESS_MISSIONS)) {
    for (const t of list) out.push({ ...t, biz });
  }
  return out;
}
