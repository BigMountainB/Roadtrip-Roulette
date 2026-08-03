// ── Mission ("Favors") System — Chapter 8 rev. B, Phase 2 ─────────────────
//
// Owns the mission lifecycle: per-stop offer generation (persisted for the
// run so re-entering a stop shows the SAME offers), acceptance guards (one
// active mission per type), progress tracking, completion payout, and
// terminal failure.  Phase 2 shipped DELIVERY end-to-end; Phase 4 added the
// TIMED (rush, party-clock deadline) and PASSENGER (quirk/comfort) types;
// Phase 5 adds HEAT (escape a 2★+ tail, ≥20 mi, land clean) and WEATHER
// (authored corridor contracts) on the same instance shape.
//
// Presented to players as "Favors" / side work — shady character deals, not
// quests.  Failure = no payout only; rep NEVER decreases (Ch. 8).
//
// ── Mission instance shape (canonical, Ch. 8) ─────────────────────────────
//   { id, templateId, type, originStopId, targetStopId, targetName,
//     routeMiles, acceptedAtMile, targetMile, deadlineMile, payout, cargo,
//     npcName, status: 'offered'|'declined'|'active'|'ready'|'completed'|'failed',
//     terms: { fragile?, perishable?, illegal?, rush?, <passengerQuirk>? },
//     progress: { damageTaken, maxStars? }, paid }
//   Timed adds:     deadlineClockSec (party-clock value, Ch. 8)
//   Passenger adds: passenger { name, portrait, quirk, ask/pickup/mid/dropoff },
//                   commentAtMile, and tip (set at drop-off)
//
// `paid` is the double-award guard: collect() only pays a mission whose
// paid flag is still false, and the flag ALSO lives in the run-scoped
// `_outcomes` ledger, which restore() re-applies AFTER a snapshot load — so
// a checkpoint rewind to a pre-delivery snapshot can never pay twice, and a
// terminal failure survives the rewind (Ch. 8 "terminal state" rule).
//
// ── Save routing (Ch. 8, critical) ────────────────────────────────────────
//   missionRep / missionStats → SaveSystem GLOBAL_KEYS (slot-global,
//   lifetime).  activeMissions + persisted offers + outcomes = RUN state →
//   serialize()/restore() ride inside GameScene._collectSaveSnapshot().

import { REST_STOPS } from '../constants.js';
import { Difficulty } from './Difficulty.js';
import { BUSINESS_MISSIONS, BUSINESS_LABELS, templateReady } from '../data/businessMissions.js';

// ── Per-business pools (owner spec 2026-07-28, built 2026-07-30) ──────────
// Work is sourced from the BUSINESSES a stop actually has (REST_STOPS
// .amenities), not from the stop itself.  Each business activates only
// ACTIVE_PER_BUSINESS of its pool per run, rolled from the run seed, so the
// same stop offers different work run to run.
//
// The rotation draws from templates whose clauses the engine can enforce
// (see IMPLEMENTED_CLAUSES in businessMissions.js) — as later slices add
// clauses, the live pool widens with no change here.
export const ACTIVE_PER_BUSINESS = 2;
// The contact pitches this many jobs, each a DIFFERENT type, and the player
// may take exactly one per stop (owner 2026-07-30).
export const OFFERS_PER_STOP = 3;

// ── Reputation tiers (Brendan's override: ×1 / ×2.5 / ×5) ────────────────
// Tier is per TYPE, keyed off lifetime completions of that type.  The tier
// also widens the offer mileage window (longer hauls, bigger money).
export const MISSION_TIERS = [
  { name: 'Rookie', minDone: 0, mult: 1,   milesMin: 6,  milesMax: 22 },
  { name: 'Known',  minDone: 3, mult: 2.5, milesMin: 15, milesMax: 45 },
  { name: 'Legend', minDone: 8, mult: 5,   milesMin: 25, milesMax: 75 },
];

// ── Payout formula constants ──────────────────────────────────────────────
// payout = round5( (BASE + routeMiles×PER_MI + riskBonus + Σ termBonus) × repMult )
// Tuned against the 2026-07-13 upgrade reprice: Legend jobs ≈ $900–1,500.
export const PAYOUT_BASE   = 30;
export const PAYOUT_PER_MI = 3.5;
// Global payout scalar — bumps every mission's take (owner 2026-07-19: 5×).
export const PAYOUT_MULT   = 5;
export const TERM_BONUS    = {
  fragile: 40, perishable: 30, illegal: 60,
  // Phase 4 — Timed premium + passenger quirk bonuses (the quirk IS the term).
  rush: 70,
  nervous: 25, carsick: 25, fugitive: 70, thrill_seeker: 20,
  // Phase 5 — Heat-escape premium + authored weather-corridor premiums.
  // no_chains is the Legend dare (big bonus, never the default — Ch. 8).
  heat_escape: 100, weather_run: 90, no_chains: 150,
  // Chain runs (owner 2026-07-30) — hand-off at the next branch of the same
  // business.  The destination is dictated by the chain rather than the tier
  // window, so these often run LONG; the per-mile rate carries most of the
  // reward and this is the premium on top.
  chain: 80,
  // ── Slice 2 condition clauses ───────────────────────────────────────────
  // Priced by how much they constrain the DRIVE.  A clause you can satisfy by
  // paying attention (fuelFloor) is worth less than one that fights the way
  // the game wants you to play (pacifist, speedCap).
  noEating: 45, pacifist: 70, speedFloor: 55, speedCap: 65,
  fuelFloor: 35, alertFloor: 40, cashExact: 50,
  heatCarried: 90, survivalDrain: 55, damageDock: 30, tipBySpeed: 25,
};

// ── CHALLENGE class (slice 3, owner spec 2026-07-28) ──────────────────────
// "Reactive" work, and structurally unlike every other type: no cargo, no
// destination, no rest stop at the far end.  The NPC hands you something and
// starts a clock — "I'll load you to three; burn all three inside forty-five
// seconds and there's $250 in it" (the owner's canonical example).
//
// Consequences that shape the code below:
//   • It PAYS ON THE ROAD.  Every other type goes active → ready (graded at
//     pull-in) → collect (paid at the stop).  A challenge has no stop to pull
//     into, so completeChallenge() closes the ledger itself and GameScene
//     banks the cash where the player is standing.
//   • Its clock is REAL seconds, not party-clock seconds.  A 45-second dare is
//     a twitch challenge; running it on the 4×-compressed party clock would
//     make it an 11-second one.
//   • The clock starts on the ROAD, not at acceptance — you accept it in a
//     menu, and the timer must not burn while you're still shopping.
// `limitSec` is the FUSE (omit it and the dare is untimed); every other field
// is the goal itself.  Keeping those separate matters: `sec` used to mean both,
// so a 20-second boost goal was also a 20-second fuse and killed itself while
// the player wasn't boosting.
export const CHALLENGE_GOALS = {
  // Burn N of an item before the fuse runs out.
  useItemsInTime: { item: 'fireworks', count: 3, limitSec: 45 },
  // Hold a speed band for `holdSec` CONTINUOUS seconds (drop out and the
  // hold resets — that's the challenge).
  speedBand:      { minMph: 100, maxMph: null, holdSec: 30, limitSec: 120 },
  // Accumulate `sec` seconds of boost — cumulative, and untimed.
  boostSeconds:   { sec: 20 },
};

// ── Condition clauses (slice 2, owner pool 2026-07-28) ────────────────────
// Two kinds, and the difference matters:
//   FAIL clauses  — a violation kills the job (noEating, pacifist, speed
//                   bands, and the arrival checks).
//   EFFECT clauses — they change the DRIVE or the PAY, never fail on their own
//                   (heatCarried, survivalDrain, damageDock, tipBySpeed).
// Defaults live here so a template can say `noEating: true` and still be
// tunable in one place.
// `graceSec` is the HARD-mode budget; Difficulty.speedGraceMul() stretches it
// on Normal (×1.4) and Easy (×2).  The mph band never changes with difficulty
// — only how long you're allowed to sit outside it.
export const CLAUSE_DEFAULTS = {
  speedFloor:    { mph: 55, graceSec: 4 },   // brief dips are allowed…
  speedCap:      { mph: 70, graceSec: 4 },   // …so traffic doesn't auto-fail you
  fuelFloor:     { pct: 90 },
  alertFloor:    { pct: 50 },
  cashExact:     { amount: 2000, tol: 50 },
  heatCarried:   { stars: 2 },
  survivalDrain: { mult: 2 },
  damageDock:    { perHp: 25 },
  tipBySpeed:    { maxTip: 400, parSecPerMi: 26 },
};

// Fragile HP-damage cap and perishable deadline slack (deadline miles =
// routeMiles × slack + grace, measured from acceptance).
export const FRAGILE_MAX_DAMAGE   = 15;
export const PERISHABLE_SLACK     = 1.35;
export const PERISHABLE_GRACE_MI  = 4;

// ── Timed ("rush") jobs — Ch. 8: deadline stored as a PARTY-CLOCK value ────
// (deadline = clockSecAtAccept − budget, clock counts DOWN) so it survives
// pause / rest stops / reload.  Budget is tight: ~11 s of party clock per
// route mile + a small grace (at the 4× compression, 120 mph ≈ 7.5 s/mi —
// a rush job punishes dawdling, not driving).
export const TIMED_SEC_PER_MI = 11;
export const TIMED_GRACE_SEC  = 25;

// ── Passenger comfort thresholds (Ch. 8: temperament + ONE gameplay concern) ─
export const HARD_CRASH_HP      = 12;  // nervous: single crash hit this big → they bail
export const CARSICK_MAX_DAMAGE = 20;  // carsick: cumulative crash damage cap
export const FUGITIVE_MAX_STARS = 2;   // fugitive: this much heat → gone at the next ditch
export const THRILL_TIP         = 50;  // thrill-seeker tip when the ride got spicy (any heat)

// ── Heat-escape (Ch. 8) — offered ONLY at 2+ wanted stars, target ≥20 mi,
// arrive at the target with 0 stars.  ANY way of losing the stars counts,
// paid clears included (paint job / passport / disguise) — their price is
// penalty enough (2026-07-13 decision).  Busted = fail (failAllActive).
export const HEAT_ESCAPE_MIN_STARS = 2;
export const HEAT_ESCAPE_MILES     = 20;

// ── Weather runs — AUTHORED corridor contracts ONLY (Ch. 8) ──────────────
// Two contracts: the Snoqualmie pass run (North Bend→Cle Elum, rain→snow)
// and the Vantage wind run (Ellensburg→Othello).  Each spawns only at its
// corridor-start stop and only while the hazard is live (`hazard` names the
// ctx flag the caller must assert: 'pass' = weather enabled on this
// difficulty; 'wind' = the Vantage crosswind, always blowing).  Condition:
// ≤15 HP of crash damage (the fragile cap) — "keep cargo intact".  At
// Legend the contract carries the "no chains" dare for a big bonus.
export const WEATHER_CONTRACTS = [
  { id: 'pass_run', originStopId: 'N', targetStopId: 'C', hazard: 'pass',
    cargo: 'a pallet of pass-closure supplies', maxDamage: 15 },
  { id: 'wind_run', originStopId: 'E', targetStopId: 'O', hazard: 'wind',
    cargo: 'a strapped-down load of drywall sheets', maxDamage: 15 },
];

// Corridor risk bands (Ch. 8: scale by corridor hazard, not stop count).
// A route earns each band's bonus if it overlaps the band at all.
export const RISK_BANDS = [
  { from: 32,  to: 84,  bonus: 60, tag: 'pass'   },   // North Bend→Cle Elum snow
  { from: 109, to: 184, bonus: 50, tag: 'wind'   },   // Ellensburg→Othello Vantage wind
  { from: 184, to: 274, bonus: 40, tag: 'sparse' },   // dark-basin sparse services
];

// Delivery cargo templates — cargo IS a terms bundle (variety via terms,
// not more types).  Flags force that term onto the offer.
const DELIVERY_CARGO = [
  { id: 'pies',        cargo: 'a crate of rodeo pies',        perishable: true },
  { id: 'insulin',     cargo: 'a cooler marked MEDICAL',      perishable: true },
  { id: 'windshields', cargo: 'a stack of windshields',       fragile: true },
  { id: 'antiques',    cargo: 'boxed estate antiques',        fragile: true },
  { id: 'duffel',      cargo: "a duffel you don't open",      illegal: true },
  { id: 'crates',      cargo: 'unlabeled wooden crates',      illegal: true },
  { id: 'envelope',    cargo: 'a sealed manila envelope' },
  { id: 'carb',        cargo: 'a rebuilt carburetor' },
];

// Timed ("rush") cargo templates — the cargo is a story hook; the RUSH term
// itself is the catch.  A rush job may ALSO be fragile for a stacked bonus.
const TIMED_CARGO = [
  { id: 'court_docs',  cargo: 'a folder of court filings' },
  { id: 'hot_parts',   cargo: 'an engine part still warm from somewhere' },
  { id: 'wedding_cake',cargo: 'a three-tier wedding cake', fragile: true },
  { id: 'transplant',  cargo: 'a cooler stamped DO NOT DELAY' },
  { id: 'auction_bid', cargo: 'a sealed auction bid' },
];

// Passenger roster — temperament + ONE gameplay concern (the quirk), a
// portrait from the existing NPC pool, and three authored lines routed
// through the popup machinery (pickup / mid-route / drop-off).
const PASSENGERS = [
  {
    id: 'student', name: 'Nervous Student', portrait: 'college_kid', quirk: 'nervous',
    ask: "I missed the last bus and my finals won't wait — I can pay; just drive like my mom's at the gate.",
    pickup:  '"Seatbelt. Both hands. Great. Perfect. Love it."',
    mid:     '"You\'re doing great. I\'m saying that for both of us."',
    dropoff: '"We lived! Here — take it before I count it."',
  },
  {
    id: 'hitcher', name: 'Hitchhiker', portrait: 'hiker_woman', quirk: 'thrill_seeker',
    ask: "Need a lift up the road a spell — I chip in for gas, don't scream, ride well, and tip good coin for a story you tell.",
    pickup:  '"Music\'s yours, pedal\'s yours. Impress me."',
    mid:     '"Is that all this thing does? Kidding. Mostly."',
    dropoff: '"Decent run. Here\'s the fare."',
  },
  {
    id: 'oddball', name: 'Desert Oddball', portrait: 'desert_oddball', quirk: 'fugitive',
    ask: "I need to be gone from here, and swift — and skip any cops, if you catch my drift.",
    pickup:  '"If anyone asks, I\'ve been asleep since Tuesday."',
    mid:     'He checks the mirror more than you do.',
    dropoff: '"You never saw me. The money saw you, though."',
  },
  {
    id: 'grandma', name: 'Roadside Grandma', portrait: 'grandma', quirk: 'carsick',
    ask: "My grandson never calls or drives me a lick — you look sturdy, dear; smooth roads, and no tricks.",
    pickup:  '"I get queasy, dear. Pretend you\'re carrying soup."',
    mid:     '"My late husband drove like this. He\'s late for a reason."',
    dropoff: '"A gentleman. Or close enough. Here you are, dear."',
  },
  {
    id: 'skibum', name: 'Ski Bum', portrait: 'ski_bum', quirk: 'nervous',
    ask: "Board's waxed, but my ride just fell right through — get me up the road and the lift-ticket money's for you.",
    pickup:  '"Powder day, man. Every minute counts. But like, safely."',
    mid:     '"Whoa. Okay. The mountain isn\'t going anywhere, right?"',
    dropoff: '"Righteous. Here\'s the cash — first run\'s for you."',
  },
  {
    id: 'oldtimer', name: 'Old-Timer', portrait: 'old_timer', quirk: 'carsick',
    ask: "Truck died. There's a doctor waiting down the way, and my gut's older than your car — go easy, I pray.",
    pickup:  '"Drove this road before it had lines painted on it."',
    mid:     '"Mind the bumps, son. Breakfast is negotiating."',
    dropoff: '"Smoother than my nephew, and he does it for a living."',
  },
];

// Shady per-stop contact names (deterministic pick by stop id).
const NPC_NAMES = ['Marcy', 'Dale', 'Rhonda', 'Gus', 'Pep', 'Lorna', 'Sal', 'Tick'];

// ── Deterministic-ish helpers ─────────────────────────────────────────────
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable npcMemory id for a stop's mission contact (Ch. 8 NPC continuity —
 *  the contact remembers jobs done FOR THEM, keyed by their stop). */
export function contactIdFor(stopId) { return `contact_${stopId}`; }

/** Memory-driven contact greeting (Ch. 8 Phase 6, "the secret weapon").
 *  Returns a line keyed off the contact's npcMemory — a pending failure gets
 *  acknowledged first (flavor only, rep never decreases), then greetings
 *  scale with jobs completed FOR this contact (higher tiers tease the better
 *  work the widened mileage windows already deliver).  Returns null for a
 *  fresh contact so the caller keeps its stock opener. */
export function contactGreeting(mem = {}) {
  if (mem.failAckPending) {
    return "Heard how the last one hit the wall — cargo's gone, we'll square it all; clean slate, driver, no more said, if you're still rolling on ahead.";
  }
  const n = mem.jobsCompleted ?? 0;
  if (n >= 8) return "There's my legend, come to call — the big runs go to you, that's all; nobody else gets word of these, so take your pick of them with ease.";
  if (n >= 3) return `Back again? That's ${n} runs you've made — I'm saving the sweetest jobs for your trade.`;
  if (n >= 1) return n === 1
    ? "You delivered last time, I recall — got more to move, if you're up for the haul."
    : `That's ${n} runs you've run for me now — keep it up and I'll trust you somehow.`;
  return null;
}

/** Tier record for N lifetime completions of a type. */
export function tierFor(completions) {
  let t = MISSION_TIERS[0];
  for (const tier of MISSION_TIERS) if (completions >= tier.minDone) t = tier;
  return t;
}

/** Corridor risk bonus for a route [fromMile, toMile]. */
export function riskBonus(fromMile, toMile) {
  let sum = 0;
  for (const b of RISK_BANDS) {
    if (Math.max(fromMile, b.from) < Math.min(toMile, b.to)) sum += b.bonus;
  }
  return sum;
}

/** Ch. 8 payout: (base + miles×$/mi + risk + condition) × repMult, to $5. */
export function computePayout({ routeMiles, risk = 0, terms = {}, repMult = 1 }) {
  let cond = 0;
  for (const k of Object.keys(TERM_BONUS)) if (terms[k]) cond += TERM_BONUS[k];
  const raw = (PAYOUT_BASE + routeMiles * PAYOUT_PER_MI + risk + cond) * repMult * PAYOUT_MULT;
  return Math.max(5, Math.round(raw / 5) * 5);
}

export class MissionSystem {
  constructor(save = null) {
    this._save = save;                 // SaveSystem (missionRep/missionStats live there)
    this.resetRun();
  }

  /** Late-bind / rebind the save (registry order safety). */
  attachSave(save) { if (save) this._save = save; }

  // ── Run lifecycle ───────────────────────────────────────────────────────

  /** Fresh run: new offer seed, no offers, no actives, clean outcome ledger. */
  resetRun(seed = null) {
    this._seed = (seed ?? ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0)) >>> 0;
    this._offersByStop = {};           // { stopId: [mission, …] } (persisted offers)
    this._outcomes = {};               // { missionId: { status, paid } } — survives rewind
    this._failCounts = {};             // { type: n } — run-scoped; 3 fails of a type
                                       // lock that type's offers for the rest of the run
    this._acceptedAtStop = {};         // { stopId: missionId } — ONE job per stop
  }

  /** Run-state snapshot — rides inside GameScene._collectSaveSnapshot(). */
  serialize() {
    return {
      seed: this._seed,
      offersByStop: JSON.parse(JSON.stringify(this._offersByStop)),
      outcomes: { ...this._outcomes },
      failCounts: { ...this._failCounts },
      acceptedAtStop: { ...this._acceptedAtStop },
    };
  }

  /** Restore run state from a snapshot, then re-apply the terminal-outcome
   *  ledger so checkpoint rewinds can't resurrect a failed mission or pay a
   *  completed one twice (Ch. 8).  The ledger is merged (union) — outcomes
   *  recorded AFTER the snapshot was taken win over the snapshot's state. */
  restore(snap) {
    if (!snap || typeof snap !== 'object') return;
    if (Number.isFinite(snap.seed)) this._seed = snap.seed >>> 0;
    this._offersByStop = (snap.offersByStop && typeof snap.offersByStop === 'object')
      ? JSON.parse(JSON.stringify(snap.offersByStop)) : {};
    this._outcomes = { ...(snap.outcomes ?? {}), ...this._outcomes };
    // Union-max so a rewind can't un-count a lockout fail.
    for (const [t, n] of Object.entries(snap.failCounts ?? {})) {
      this._failCounts[t] = Math.max(this._failCounts[t] ?? 0, n | 0);
    }
    // One-job-per-stop ledger: union, snapshot first, so a rewind can't hand
    // the player a second job at a stop they already hired on at.
    this._acceptedAtStop = { ...(snap.acceptedAtStop ?? {}), ...this._acceptedAtStop };
    for (const m of this._allMissions()) {
      const o = this._outcomes[m.id];
      if (o) { m.status = o.status; m.paid = !!o.paid; }
    }
  }

  // ── Offers ──────────────────────────────────────────────────────────────

  /** Offers for a stop — generated once per run (deterministic from the run
   *  seed + stop id + current tier) and persisted, so re-entering the same
   *  stop shows the same offers.  Pullman is payoff-only (no new offers).
   *
   *  `ctx` gates the Phase-5 CONDITIONAL offers (Ch. 8): a heat-escape job
   *  spawns only while the player is wearing 2+ stars (`ctx.stars`), and
   *  the authored weather-corridor contracts spawn only at their corridor-
   *  start stop while the hazard is live (`ctx.weatherOk` for the pass,
   *  `ctx.windOk` for Vantage).  Once spawned they persist like any other
   *  offer (appended in place — same array identity, no reroll). */
  offersForStop(stopId, ctx = {}) {
    if (stopId === 'P') return this._offersByStop[stopId] ?? [];
    if (!this._offersByStop[stopId]) {
      this._offersByStop[stopId] = this._generateOffers(stopId);
    }
    this._appendConditionalOffers(stopId, ctx);
    // Type lockout: after 3 failed jobs of a type this run, contacts stop
    // offering it (still-offered entries of that type are hidden, not
    // mutated, so the underlying array stays deterministic).
    const list = this._offersByStop[stopId];
    const anyLock = list.some(o => o.status === 'offered' && this.typeLocked(o.type));
    return anyLock
      ? list.filter(o => o.status !== 'offered' || !this.typeLocked(o.type))
      : list;   // identity-stable when nothing is locked (persistence contract)
  }

  /** Heat-escape + weather-corridor offers — deterministic (no rng: the
   *  target and payout follow from the stop + tier alone), spawned lazily
   *  the first time their condition holds, then persisted for the run. */
  _appendConditionalOffers(stopId, ctx) {
    const list   = this._offersByStop[stopId];
    const origin = REST_STOPS.find(r => r.id === stopId);
    if (!list || !origin) return;
    const npcName = NPC_NAMES[hashStr(stopId) % NPC_NAMES.length];
    const base = (target) => ({
      originStopId: stopId,
      targetStopId: target.id,
      targetName:   target.name.replace(/, WA$/, ''),
      routeMiles:   Math.round(target.mileage - origin.mileage),
      acceptedAtMile: null,
      targetMile:   target.mileage,
      deadlineMile: null,
      npcName,
      status:  'offered',
      progress: { damageTaken: 0 },
      paid: false,
    });
    // Heat escape — only pitched while the player is actually hot (Ch. 8:
    // "offered only at 2+ stars").  Target = the NEAREST stop ≥20 mi out.
    if ((ctx.stars ?? 0) >= HEAT_ESCAPE_MIN_STARS) {
      const id = `esc_${stopId}`;
      if (!list.some(o => o.id === id)) {
        const target = REST_STOPS.find(r =>
          r.mileage - origin.mileage >= HEAT_ESCAPE_MILES);
        if (target) {
          const tier  = tierFor(this._repOf('heat'));
          const terms = { heat_escape: true };
          const b     = base(target);
          list.push({
            ...b,
            id,
            templateId: 'heat_escape',
            type: 'heat',
            payout: computePayout({ routeMiles: b.routeMiles,
              risk: riskBonus(origin.mileage, target.mileage), terms, repMult: tier.mult }),
            cargo: 'a clean getaway',
            terms,
            progress: { damageTaken: 0 },
          });
        }
      }
    }
    // Authored weather-corridor contracts — corridor-start stop only, and
    // only while the hazard is live (Ch. 8 "spawn only before the corridor
    // + when the hazard is active").
    for (const c of WEATHER_CONTRACTS) {
      if (c.originStopId !== stopId) continue;
      if (!(c.hazard === 'pass' ? ctx.weatherOk === true : ctx.windOk === true)) continue;
      const id = `wx_${c.id}`;
      if (list.some(o => o.id === id)) continue;
      const target = REST_STOPS.find(r => r.id === c.targetStopId);
      if (!target) continue;
      const tier  = tierFor(this._repOf('weather'));
      const terms = {
        weather_run: { tag: c.hazard },
        fragile:     { maxDamage: c.maxDamage },   // "keep cargo intact" (≤15 HP)
      };
      // "No chains" is a LEGEND dare with a big bonus, never the default.
      if (tier.name === 'Legend') terms.no_chains = true;
      const b = base(target);
      list.push({
        ...b,
        id,
        templateId: c.id,
        type: 'weather',
        payout: computePayout({ routeMiles: b.routeMiles,
          risk: riskBonus(origin.mileage, target.mileage), terms, repMult: tier.mult }),
        cargo: c.cargo,
        terms,
      });
    }
  }

  /** The slice of a business's pool that is LIVE this run — ACTIVE_PER_BUSINESS
   *  templates, drawn from the ones the engine can currently enforce, shuffled
   *  by the run seed.  Same seed → same rotation all run (and across a reload,
   *  since the seed is serialized), different seed → different work. */
  _activeTemplates(biz) {
    const pool = (BUSINESS_MISSIONS[biz] ?? []).filter(templateReady);
    if (pool.length <= ACTIVE_PER_BUSINESS) return pool;
    const rng = mulberry32((this._seed ^ hashStr('biz:' + biz)) >>> 0);
    const idx = pool.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {          // seeded Fisher-Yates
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, ACTIVE_PER_BUSINESS).sort((a, b) => a - b).map(i => pool[i]);
  }

  /** Nearest stop AHEAD of `origin` carrying `biz` — the "next AM/BM". */
  _nextStopWithBusiness(origin, biz) {
    return REST_STOPS.find(r => r.mileage > origin.mileage
                             && (r.amenities ?? []).includes(biz)) ?? null;
  }

  /** Template terms shorthand → engine terms object. */
  _termsFromTemplate(t, routeMiles, chainBiz = null) {
    const terms = {};
    if (t.fragile != null) terms.fragile = { maxDamage: t.fragile };
    if (t.perishable)      terms.perishable = true;
    if (t.illegal)         terms.illegal = true;
    if (t.rushSec)         terms.rush = { budgetSec: t.rushSec };
    else if (t.rush)       terms.rush = { budgetSec: Math.round(routeMiles * TIMED_SEC_PER_MI + TIMED_GRACE_SEC) };
    if (t.quirk)           terms[t.quirk] = true;
    if (chainBiz)          terms.chain = { biz: chainBiz, label: BUSINESS_LABELS[chainBiz] ?? chainBiz };
    // Slice-2 clauses: `true` takes the tuned default, an object overrides it.
    for (const k of Object.keys(CLAUSE_DEFAULTS)) {
      if (t[k] === true)              terms[k] = { ...CLAUSE_DEFAULTS[k] };
      else if (t[k] && typeof t[k] === 'object') terms[k] = { ...CLAUSE_DEFAULTS[k], ...t[k] };
    }
    // Flag-only clauses (no tunables).
    if (t.noEating) terms.noEating = true;
    if (t.pacifist) terms.pacifist = true;
    return terms;
  }

  /** Build a live offer from a business template, or null when this stop
   *  can't host it (no chain branch ahead, no target in the tier window). */
  _buildFromTemplate(t, origin, rng, usedTargets, npcName, i) {
    const tier = tierFor(this._repOf(t.type));
    // ── CHALLENGE: no target, no cargo, no tier window.  The pay is AUTHORED
    // (the owner's numbers: $250 for the fireworks dare, $300, $350, $400),
    // scaled by rep tier like everything else, and it pays on the road.
    if (t.type === 'challenge') {
      if (!t.goal) return null;                       // data error — never offer it
      return {
        id: `chl_${t.id}_${origin.id}_${i}`,
        templateId: t.id,
        type: 'challenge',
        biz: t.biz,
        bizLabel: BUSINESS_LABELS[t.biz] ?? t.biz,
        pitch: t.pitch,
        missionName: t.name,
        originStopId: origin.id,
        targetStopId: null,
        targetName:   null,
        routeMiles:   0,
        acceptedAtMile: null,
        targetMile:   null,
        deadlineMile: null,
        npcName,
        status: 'offered',
        progress: { damageTaken: 0, armed: false },
        paid: false,
        payout: Math.max(5, Math.round((t.pay ?? 250) * tier.mult / 5) * 5),
        cargo: t.grantLabel ?? null,
        grant: t.grant ?? null,                       // { item, count } handed over on accept
        goal:  { ...(CHALLENGE_GOALS[t.goal.kind] ?? {}), ...t.goal },
        terms: {},
      };
    }
    // Destination: authored stop → chain branch → tier window.
    let target = null, chainBiz = null;
    if (t.targetStopId) {
      const s = REST_STOPS.find(r => r.id === t.targetStopId);
      if (!s || s.mileage <= origin.mileage) return null;   // already past it
      target = s;
    } else if (t.destBiz) {
      chainBiz = t.destBiz === 'same' ? t.biz : t.destBiz;
      // Chain runs ignore the tier mileage window on purpose — the next branch
      // is where it is, and the extra miles are the point (owner 2026-07-30).
      target = this._nextStopWithBusiness(origin, chainBiz);
      if (!target) return null;                              // last branch on the route
    } else {
      const inWindow = REST_STOPS.filter(r =>
        r.id !== origin.id &&
        r.mileage - origin.mileage >= tier.milesMin &&
        r.mileage - origin.mileage <= tier.milesMax);
      const fresh = inWindow.filter(r => !usedTargets.has(r.id));
      const pool  = fresh.length ? fresh : inWindow;   // reuse before dropping
      if (!pool.length) return null;
      target = pool[Math.floor(rng() * pool.length)];
    }
    usedTargets.add(target.id);

    const routeMiles = Math.round(target.mileage - origin.mileage);
    const risk  = riskBonus(origin.mileage, target.mileage);
    const terms = this._termsFromTemplate(t, routeMiles, chainBiz);
    const pre   = t.type === 'timed' ? 'rsh' : t.type === 'passenger' ? 'pax' : 'dlv';
    const base = {
      id: `${pre}_${t.id}_${origin.id}_${i}`,
      templateId: t.id,
      type: t.type,
      biz: t.biz,
      bizLabel: BUSINESS_LABELS[t.biz] ?? t.biz,
      pitch: t.pitch,
      missionName: t.name,
      originStopId: origin.id,
      targetStopId: target.id,
      targetName:   target.name.replace(/, WA$/, ''),
      routeMiles,
      acceptedAtMile: null,
      targetMile:   target.mileage,
      deadlineMile: null,
      npcName,
      status:  'offered',
      progress: { damageTaken: 0 },
      paid: false,
      payout: computePayout({ routeMiles, risk, terms, repMult: tier.mult }),
      cargo: t.cargo,
      terms,
    };
    if (t.type === 'timed')     base.deadlineClockSec = null;
    if (t.type === 'passenger') {
      const p = PASSENGERS.find(x => x.quirk === t.quirk) ?? PASSENGERS[0];
      base.passenger = { id: p.id, name: p.name, portrait: p.portrait, quirk: p.quirk,
                         ask: p.ask, pickup: p.pickup, mid: p.mid, dropoff: p.dropoff };
      base.cargo = p.name;
      base.commentAtMile = null;
    }
    return base;
  }

  _generateOffers(stopId) {
    const origin = REST_STOPS.find(r => r.id === stopId);
    if (!origin) return [];
    const rng = mulberry32((this._seed ^ hashStr(stopId)) >>> 0);
    const npcName = NPC_NAMES[hashStr(stopId) % NPC_NAMES.length];

    // ── Business-sourced offers (owner 2026-07-28/30) ─────────────────────
    // Candidates = the live rotation of every business this stop actually has.
    // The contact pitches OFFERS_PER_STOP jobs, each a DIFFERENT type, and the
    // player may take one (see accept()).
    const cands = [];
    for (const biz of (origin.amenities ?? [])) {
      for (const t of this._activeTemplates(biz)) cands.push({ ...t, biz });
    }
    for (let i = cands.length - 1; i > 0; i--) {        // seeded shuffle
      const j = Math.floor(rng() * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    const offers = [];
    const usedTargets = new Set();
    const usedTypes   = new Set();
    for (const t of cands) {
      if (offers.length >= OFFERS_PER_STOP) break;
      if (usedTypes.has(t.type)) continue;              // one per category
      const built = this._buildFromTemplate(t, origin, rng, usedTargets, npcName, offers.length);
      if (!built) continue;
      usedTypes.add(t.type);
      offers.push(built);
    }
    // Backfill from the generic pool so the contact always has three DISTINCT
    // categories to pitch, even at a thin stop or when a business's rotation
    // rolled work it can't host (no chain branch left ahead, say).
    this._backfillOffers(offers, usedTypes, usedTargets, origin, rng, npcName);
    return offers;
  }

  /** Generic (non-business) offers — the original Ch. 8 pool, now used to top
   *  a stop up to OFFERS_PER_STOP distinct types. */
  _backfillOffers(offers, usedTypes, usedTargets, origin, rng, npcName) {
    const stopId = origin.id;
    for (const type of ['delivery', 'timed', 'passenger']) {
      if (offers.length >= OFFERS_PER_STOP) break;
      if (usedTypes.has(type)) continue;
      const tier = tierFor(this._repOf(type));
      const inWindow = REST_STOPS.filter(r =>
        r.id !== stopId &&
        r.mileage - origin.mileage >= tier.milesMin &&
        r.mileage - origin.mileage <= tier.milesMax);
      const fresh = inWindow.filter(r => !usedTargets.has(r.id));
      let pool = fresh.length ? fresh : inWindow;
      // Sparse-basin fallback: east of Vantage the stops are far enough apart
      // that a Rookie window (6-22 mi) can be EMPTY — Ellensburg's next
      // neighbour is 28 mi out.  Rather than leave a stop pitching one job,
      // fall back to the nearest stop ahead and let the haul run long.  The
      // per-mile rate already pays for the distance.
      if (!pool.length) {
        const ahead = REST_STOPS.filter(r => r.mileage > origin.mileage);
        if (ahead.length) pool = [ahead[0]];
      }
      if (!pool.length) continue;
      const target = pool[Math.floor(rng() * pool.length)];
      usedTargets.add(target.id);
      usedTypes.add(type);
      const i = offers.length;
      const routeMiles = Math.round(target.mileage - origin.mileage);
      const risk = riskBonus(origin.mileage, target.mileage);
      const base = {
        originStopId: stopId,
        targetStopId: target.id,
        targetName:   target.name.replace(/, WA$/, ''),
        routeMiles,
        acceptedAtMile: null,
        targetMile:   target.mileage,
        deadlineMile: null,
        npcName,
        status:  'offered',
        progress: { damageTaken: 0 },
        paid: false,
      };
      if (type === 'delivery') {
        const tmpl = DELIVERY_CARGO[Math.floor(rng() * DELIVERY_CARGO.length)];
        const terms = {};
        if (tmpl.fragile)    terms.fragile    = { maxDamage: FRAGILE_MAX_DAMAGE };
        if (tmpl.perishable) terms.perishable = true;   // deadline fixed at accept
        if (tmpl.illegal)    terms.illegal    = true;
        offers.push({
          ...base,
          id: `dlv_${stopId}_${target.id}_${i}`,
          templateId: tmpl.id,
          type: 'delivery',
          payout: computePayout({ routeMiles, risk, terms, repMult: tier.mult }),
          cargo: tmpl.cargo,
          terms,
        });
      } else if (type === 'timed') {
        const tmpl = TIMED_CARGO[Math.floor(rng() * TIMED_CARGO.length)];
        const terms = { rush: { budgetSec: Math.round(routeMiles * TIMED_SEC_PER_MI + TIMED_GRACE_SEC) } };
        if (tmpl.fragile) terms.fragile = { maxDamage: FRAGILE_MAX_DAMAGE };
        offers.push({
          ...base,
          id: `rsh_${stopId}_${target.id}_${i}`,
          templateId: tmpl.id,
          type: 'timed',
          payout: computePayout({ routeMiles, risk, terms, repMult: tier.mult }),
          cargo: tmpl.cargo,
          terms,
          deadlineClockSec: null,   // party-clock value, fixed at accept (Ch. 8)
        });
      } else {
        const p = PASSENGERS[Math.floor(rng() * PASSENGERS.length)];
        const terms = { [p.quirk]: true };
        offers.push({
          ...base,
          id: `pax_${stopId}_${target.id}_${i}`,
          templateId: p.id,
          type: 'passenger',
          payout: computePayout({ routeMiles, risk, terms, repMult: tier.mult }),
          cargo: p.name,            // uniform "what am I hauling" label
          passenger: { id: p.id, name: p.name, portrait: p.portrait, quirk: p.quirk,
                       ask: p.ask, pickup: p.pickup, mid: p.mid, dropoff: p.dropoff },
          terms,
          commentAtMile: null,      // mid-route flavor line, fixed at accept
        });
      }
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  _allMissions() {
    const out = [];
    for (const list of Object.values(this._offersByStop)) out.push(...list);
    return out;
  }
  byId(id)          { return this._allMissions().find(m => m.id === id) ?? null; }
  activeMissions()  { return this._allMissions().filter(m => m.status === 'active'); }
  /** READY = graded at pull-in, awaiting explicit drop-off (unpaid). */
  readyMissions(stopId = null) {
    return this._allMissions().filter(m => m.status === 'ready'
      && (stopId == null || m.targetStopId === stopId));
  }
  hasActiveOfType(type) { return this.activeMissions().some(m => m.type === type); }
  illegalCargoActive()  { return this.activeMissions().some(m => m.terms?.illegal); }

  // ── Acceptance (idempotent, one-active-per-type) ────────────────────────

  /** Accept an offered mission.  Returns the mission, or null when blocked
   *  (unknown id, not offered, or the type slot is occupied).  Idempotent:
   *  re-accepting an active mission returns it without side effects. */
  accept(missionId, mile = 0, clockSec = null) {
    const m = this.byId(missionId);
    if (!m) return null;
    if (m.status === 'active') return m;                 // double-tap safe
    if (m.status !== 'offered') return null;
    if (this.hasActiveOfType(m.type)) return null;       // one active per type
    // ONE job per rest stop (owner 2026-07-30): the contact pitches three
    // categories, you pick one.  The two you passed on are NOT burned — they
    // stay in the run's rotation and can resurface at a later stop.
    if (this.acceptedAtStop(m.originStopId)) return null;
    m.status = 'active';
    m.acceptedAtMile = mile;
    if (m.terms.perishable) {
      m.deadlineMile = mile + m.routeMiles * PERISHABLE_SLACK + PERISHABLE_GRACE_MI;
    }
    // Timed: deadline is a PARTY-CLOCK value (clock counts down; Ch. 8) so it
    // survives pause / rest stops / reload.  When the clock isn't known at
    // accept time, checkDeadlines binds it on the first tick back on the road.
    if (m.terms.rush) {
      m.deadlineClockSec = (clockSec != null) ? clockSec - m.terms.rush.budgetSec : null;
    }
    // Party clock at acceptance — the speed tip measures THIS job's leg
    // (clock counts DOWN, so elapsed = acceptedClockSec − now).
    m.acceptedClockSec = clockSec ?? null;
    // Passenger: schedule the one mid-route comment; start the heat tracker.
    if (m.type === 'passenger') {
      m.commentAtMile = mile + m.routeMiles * 0.5;
      m.progress.maxStars = 0;
    }
    m.progress.damageTaken = 0;
    if (m.originStopId) this._acceptedAtStop[m.originStopId] = m.id;
    this._bumpStat(m.type, 'accepted');
    return m;
  }

  /** The job (if any) already taken at this stop — the other offers there are
   *  unavailable for the rest of the run. */
  acceptedAtStop(stopId) { return this._acceptedAtStop?.[stopId] ?? null; }

  /** Decline an offer — stays declined for the rest of the run. */
  decline(missionId) {
    const m = this.byId(missionId);
    if (m && m.status === 'offered') m.status = 'declined';
  }

  // ── Progress / failure hooks (GameScene) ────────────────────────────────

  /** Damage feed — fails FRAGILE deliveries past their HP-damage cap.
   *  Continuous scrapes (offroad bleed, rail grind, overheat) don't count;
   *  the fragile term is about crash hits (Ch. 8).  Returns newly failed. */
  onDamage(amount, source = '') {
    if (!(amount > 0)) return [];
    if (source === 'offroad_bleed' || source === 'bridge_rail'
        || source === 'water_shoulder' || source === 'overheat') return [];
    const failed = [];
    for (const m of this.activeMissions()) {
      const wasHit = () => { m.progress.damageTaken = (m.progress.damageTaken ?? 0) + amount; };
      if (m.terms?.fragile) {
        wasHit();
        if (m.progress.damageTaken > m.terms.fragile.maxDamage) {
          this._fail(m, 'fragile');
          failed.push(m);
        }
      } else if (m.terms?.nervous) {
        // Nervous passenger: one HARD crash and they're out at the next shoulder.
        wasHit();
        if (amount >= HARD_CRASH_HP) { this._fail(m, 'passenger_scared'); failed.push(m); }
      } else if (m.terms?.carsick) {
        // Carsick passenger: cumulative rough ride past the cap = done.
        wasHit();
        if (m.progress.damageTaken > CARSICK_MAX_DAMAGE) { this._fail(m, 'passenger_sick'); failed.push(m); }
      }
    }
    return failed;
  }

  /** Wanted-stars feed — FUGITIVE passengers bail past the heat cap; every
   *  passenger tracks peak heat for the thrill-seeker tip.  Returns newly
   *  failed.  Cheap no-op when no passenger is aboard. */
  checkHeat(stars = 0) {
    const failed = [];
    for (const m of this.activeMissions()) {
      if (m.type !== 'passenger') continue;
      m.progress.maxStars = Math.max(m.progress.maxStars ?? 0, stars);
      if (m.terms?.fugitive && stars >= FUGITIVE_MAX_STARS) {
        this._fail(m, 'passenger_heat');
        failed.push(m);
      }
    }
    return failed;
  }

  // ── Slice-2 condition clauses ───────────────────────────────────────────

  /** Player ate or drank something.  Fails NO-EATING hauls ("counted, weighed,
   *  and I'll count it again").  Returns newly failed. */
  noteEat() {
    const failed = [];
    for (const m of this.activeMissions()) {
      if (m.terms?.noEating) { this._fail(m, 'ate_the_cargo'); failed.push(m); }
    }
    return failed;
  }

  /** Player fired a weapon / deployed anything.  Fails PACIFIST runs.
   *  Returns newly failed. */
  noteWeaponFired() {
    const failed = [];
    for (const m of this.activeMissions()) {
      if (m.terms?.pacifist) { this._fail(m, 'opened_fire'); failed.push(m); }
    }
    return failed;
  }

  /** Speed feed (called each tick with the live mph and the frame's dt).
   *  A speed FLOOR or CAP tolerates brief violations — `graceSec` of accrued
   *  time outside the band before the job dies — so ordinary traffic, a
   *  corner, or a rest-stop pull-in doesn't auto-fail an otherwise clean run.
   *  Time inside the band drains the accrued debt at the same rate.
   *  Returns newly failed. */
  sampleSpeed(mph = 0, dt = 0) {
    if (!(dt > 0)) return [];
    const failed = [];
    for (const m of this.activeMissions()) {
      const floor = m.terms?.speedFloor, cap = m.terms?.speedCap;
      if (!floor && !cap) continue;
      const bad = (floor && mph < floor.mph) || (cap && mph > cap.mph);
      // Grace scales with difficulty (owner 2026-07-30): Hard runs the raw
      // authored budget, Normal gets more time, Easy more still.  The band
      // itself (the mph) never moves — only how long you may sit outside it.
      const grace = (floor?.graceSec ?? cap?.graceSec ?? 4)
                  * (Difficulty.speedGraceMul?.() ?? 1);
      const acc = (m.progress.speedDebt ?? 0) + (bad ? dt : -dt);
      m.progress.speedDebt = Math.max(0, acc);
      if (m.progress.speedDebt > grace) {
        this._fail(m, floor && mph < floor.mph ? 'too_slow' : 'too_fast');
        failed.push(m);
      }
    }
    return failed;
  }

  // ── Challenge class (slice 3) ───────────────────────────────────────────

  /** Active challenges, newest first. */
  activeChallenges() { return this.activeMissions().filter(m => m.type === 'challenge'); }

  /** Called on the first ROAD tick after acceptance — starts the clock.  Kept
   *  separate from accept() so browsing the shop can't burn the timer. */
  armChallenges() {
    const armed = [];
    for (const m of this.activeChallenges()) {
      if (m.progress.armed) continue;
      m.progress.armed    = true;
      m.progress.timeLeft = m.goal?.limitSec ?? null;   // null = untimed dare
      m.progress.hold     = 0;
      m.progress.used     = 0;
      armed.push(m);
    }
    return armed;
  }

  /** Player used an F12 item — feeds `useItemsInTime`.  Returns any newly
   *  completed challenges (the caller pays them). */
  noteItemUsed(itemType) {
    const done = [];
    for (const m of this.activeChallenges()) {
      const g = m.goal;
      if (g?.kind !== 'useItemsInTime' || !m.progress.armed) continue;
      if (g.item && itemType !== g.item) continue;
      m.progress.used = (m.progress.used ?? 0) + 1;
      if (m.progress.used >= (g.count ?? 3)) { this._completeChallenge(m); done.push(m); }
    }
    return done;
  }

  /** Per-tick challenge feed.  `dt` in REAL seconds; ctx { mph, boosting }.
   *  Returns { done: [], failed: [] } — the caller pays the first and pops a
   *  message for the second. */
  tickChallenges(dt = 0, ctx = {}) {
    const done = [], failed = [];
    if (!(dt > 0)) return { done, failed };
    for (const m of this.activeChallenges()) {
      const g = m.goal;
      if (!g || !m.progress.armed) continue;
      if (g.kind === 'speedBand') {
        const inBand = (g.minMph == null || ctx.mph >= g.minMph)
                    && (g.maxMph == null || ctx.mph <= g.maxMph);
        // CONTINUOUS hold — dropping out resets it, which is the whole ask.
        m.progress.hold = inBand ? (m.progress.hold ?? 0) + dt : 0;
        if (m.progress.hold >= (g.holdSec ?? 30)) { this._completeChallenge(m); done.push(m); continue; }
      } else if (g.kind === 'boostSeconds') {
        if (ctx.boosting) m.progress.hold = (m.progress.hold ?? 0) + dt;
        if ((m.progress.hold ?? 0) >= (g.sec ?? 20)) { this._completeChallenge(m); done.push(m); continue; }
      }
      // The fuse burns only for dares that HAVE one.
      if (m.progress.timeLeft != null) {
        m.progress.timeLeft -= dt;
        if (m.progress.timeLeft <= 0) { this._fail(m, 'challenge_expired'); failed.push(m); }
      }
    }
    return { done, failed };
  }

  /** Close a challenge out on the road: completed + paid in one step, through
   *  the SAME ledger the stop-based flow uses so a rewind can't pay it twice. */
  _completeChallenge(m) {
    m.status = 'completed';
    m.paid   = true;
    this._outcomes[m.id] = { status: 'completed', paid: true };
    this._bumpRep(m.type);
    this._bumpStat(m.type, 'completed');
    this._noteNpcOutcome(m, 'completed');
    return m;
  }

  /** Live effects of the cargo currently aboard — GameScene applies these each
   *  tick.  `heatStars` is ADDITIVE wanted pressure while carrying; `drainMult`
   *  multiplies survival-bar drain.  Both default to the no-op values. */
  activeEffects() {
    let heatStars = 0, drainMult = 1;
    for (const m of this.activeMissions()) {
      if (m.terms?.heatCarried)   heatStars = Math.max(heatStars, m.terms.heatCarried.stars ?? 2);
      if (m.terms?.survivalDrain) drainMult = Math.max(drainMult, m.terms.survivalDrain.mult ?? 2);
    }
    return { heatStars, drainMult };
  }

  /** Final pay for a graded mission, after the EFFECT clauses that modify it:
   *  damageDock (docked per HP of crash damage) and tipBySpeed (tip scaled by
   *  how far under par the run landed).  Never drops below a quarter of the
   *  agreed price — a bad run still beats no run, and a zeroed payout reads as
   *  a bug to the player.  RestStopScene multiplies the genre trait on top. */
  payoutFor(m) {
    if (!m) return 0;
    let pay = (m.payout ?? 0) + (m.tip ?? 0);
    const dock = m.terms?.damageDock;
    if (dock) pay -= Math.round((m.progress?.damageTaken ?? 0) * (dock.perHp ?? 25));
    return Math.max(Math.round((m.payout ?? 0) * 0.25), Math.round(pay));
  }

  /** Odometer feed for passenger flavor — returns { mission, line } for each
   *  mid-route comment due at this mile (one per ride), clearing the trigger. */
  checkComments(mile) {
    const due = [];
    for (const m of this.activeMissions()) {
      if (m.commentAtMile == null || mile < m.commentAtMile) continue;
      m.commentAtMile = null;
      const line = m.passenger?.mid;
      if (line) due.push({ mission: m, line });
    }
    return due;
  }

  /** Odometer + party-clock feed — fails PERISHABLE deliveries past their
   *  deadline mile and TIMED jobs whose party clock (counts DOWN) has fallen
   *  below their deadline value.  A timed job accepted without a known clock
   *  binds its deadline on the first tick here (same party-clock semantics).
   *  Cheap no-op when nothing deadlined is active.  Returns newly failed. */
  checkDeadlines(mile, clockSec = null) {
    const failed = [];
    for (const m of this.activeMissions()) {
      if (m.deadlineMile != null && mile > m.deadlineMile) {
        this._fail(m, 'perishable'); failed.push(m); continue;
      }
      if (m.terms?.rush && clockSec != null) {
        if (m.deadlineClockSec == null) m.deadlineClockSec = clockSec - m.terms.rush.budgetSec;
        // The party clock FLOORS at 0 (GameScene never ticks it negative), so
        // a rush accepted with less clock than budget gets a negative
        // deadline the clock can never cross — a never-expiring rush premium.
        // Clock exhausted = the window is over, whatever the deadline says.
        else if (clockSec < m.deadlineClockSec || clockSec <= 0) { this._fail(m, 'rush'); failed.push(m); }
      }
    }
    return failed;
  }

  /** Chains feed — voids the Legend "no chains" weather dare the moment
   *  chains are on the car.  Cheap no-op otherwise.  Returns newly failed. */
  checkChains(hasChains = false) {
    if (!hasChains) return [];
    const failed = [];
    for (const m of this.activeMissions()) {
      if (m.terms?.no_chains) { this._fail(m, 'chains'); failed.push(m); }
    }
    return failed;
  }

  /** Run-ending event (busted / crash / passed out / too-late): every active
   *  mission terminally fails — no payout, rep untouched (Ch. 8). */
  failAllActive(reason = 'run_ended') {
    const failed = [];
    for (const m of this.activeMissions()) { this._fail(m, reason); failed.push(m); }
    return failed;
  }

  _fail(m, reason) {
    m.status = 'failed';
    m.failReason = reason;
    this._outcomes[m.id] = { status: 'failed', paid: !!m.paid };
    this._failCounts[m.type] = (this._failCounts[m.type] ?? 0) + 1;
    this._bumpStat(m.type, 'failed');
    this._noteNpcOutcome(m, 'failed');
  }

  /** Rep gate (2026-07-16): 3 failed jobs of a type this run = contacts stop
   *  offering that type for the rest of the run. */
  typeLocked(type) { return (this._failCounts[type] ?? 0) >= 3; }

  /** Drove PAST an active mission's destination without stopping — the job
   *  is now impossible: fail it terminally (frees the type slot so a new
   *  offer can be taken at the next stop).  `graceMi` forgives the pull-in
   *  window around the stop itself. */
  checkMissedTargets(mile, graceMi = 1.0) {
    const failed = [];
    for (const m of this.activeMissions()) {
      if (m.status !== 'active') continue;
      if (m.type === 'challenge') continue;      // no target to drive past
      if ((mile ?? 0) > (m.targetMile ?? Infinity) + graceMi) {
        this._fail(m, 'missed_stop');
        failed.push(m);
      }
    }
    return failed;
  }

  // ── Completion / payout ─────────────────────────────────────────────────

  /** Player pulled into a rest stop: GRADE every active mission targeting
   *  it (delivery / timed / passenger / heat / weather).  Deadline / heat
   *  conditions are judged HERE, at pull-in, so browsing the shop menu can
   *  never fail a job the player already earned — but nothing is paid yet.
   *  Qualifying missions become 'ready' (tip locked in) and await an
   *  explicit collect() from the rest-stop drop-off button.
   *
   *  `stars` = current wanted stars at pull-in: a HEAT-escape job must land
   *  at 0 stars (Ch. 8 "arrive at 0 stars") — arriving hot terminally fails
   *  it instead of grading ready.  Returns the newly-READY missions. */
  /** Pull-in grading.  `ctx` carries the arrival state the slice-2 clauses
   *  judge: { fuelPct, alertPct, cash, elapsedSec }.  Missing fields simply
   *  skip their clause, so older callers keep working. */
  gradeArrivals(stopId, mile = 0, stars = 0, ctx = {}) {
    const ready = [];
    for (const m of this.activeMissions()) {
      if (m.type === 'challenge') continue;      // no destination to arrive at
      if (m.targetStopId !== stopId) continue;
      if (m.paid) continue;
      if (m.type === 'heat' && stars > 0) { this._fail(m, 'still_hot'); continue; }
      // ── Arrival conditions (slice 2) ────────────────────────────────────
      // Judged HERE rather than en route: they're all "show up like this".
      const t = m.terms ?? {};
      if (t.fuelFloor && ctx.fuelPct != null && ctx.fuelPct < t.fuelFloor.pct) {
        this._fail(m, 'tank_too_low'); continue;
      }
      if (t.alertFloor && ctx.alertPct != null && ctx.alertPct < t.alertFloor.pct) {
        this._fail(m, 'rider_nodded_off'); continue;
      }
      if (t.cashExact && ctx.cash != null
          && Math.abs(ctx.cash - t.cashExact.amount) > (t.cashExact.tol ?? 50)) {
        this._fail(m, 'books_dont_balance'); continue;
      }
      // Thrill-seeker tip condition: the ride actually got spicy (any heat).
      m.tip = (m.terms?.thrill_seeker && (m.progress?.maxStars ?? 0) >= 1) ? THRILL_TIP : 0;
      // Speed tip: pay for beating par, pro-rated, never negative.
      if (t.tipBySpeed && ctx.clockSec != null && m.acceptedClockSec != null) {
        const elapsed = Math.max(0, m.acceptedClockSec - ctx.clockSec);
        const par  = (m.routeMiles ?? 0) * (t.tipBySpeed.parSecPerMi ?? 26);
        const frac = par > 0 ? Math.max(0, Math.min(1, (par - elapsed) / par)) : 0;
        m.tip = (m.tip ?? 0) + Math.round((t.tipBySpeed.maxTip ?? 400) * frac);
      }
      m.status = 'ready';
      m.arrivedAtMile = mile;
      ready.push(m);
    }
    return ready;
  }

  /** Explicit drop-off: pay ONE ready mission.  Returns the mission (the
   *  caller adds m.payout + m.tip to the wallet) or null when it isn't
   *  collectable.  The `paid` flag + outcome ledger make this idempotent
   *  across scene transitions, autosave/resume, and checkpoint rewinds. */
  collect(missionId) {
    const m = this.byId(missionId);
    if (!m || m.status !== 'ready' || m.paid) return null;
    m.status = 'completed';
    m.paid = true;
    m.completedAtMile = m.arrivedAtMile ?? 0;
    this._outcomes[m.id] = { status: 'completed', paid: true };
    this._bumpStat(m.type, 'completed');
    // Tier-up detection (Ch. 8 Phase 6): when THIS completion crosses a
    // tier threshold (Rookie→Known at 3, Known→Legend at 8), tag the
    // mission so the payoff screen can show the celebratory moment.
    const prevTier = tierFor(this._repOf(m.type));
    this._bumpRep(m.type);
    const newTier = tierFor(this._repOf(m.type));
    if (newTier !== prevTier) m.tierUp = { name: newTier.name, mult: newTier.mult };
    this._noteNpcOutcome(m, 'completed');
    return m;
  }

  /** Player drove off without dropping off — the route is one-way, so every
   *  uncollected READY mission (at this stop, or all when stopId is null)
   *  terminally fails as 'not_delivered': no payout, rep untouched (Ch. 8
   *  "rep never decreases").  Returns the newly failed missions. */
  failUncollected(stopId = null) {
    const failed = [];
    for (const m of this.readyMissions(stopId)) {
      this._fail(m, 'not_delivered');
      failed.push(m);
    }
    return failed;
  }

  // ── Reputation / lifetime stats (slot-GLOBAL via SaveSystem) ────────────

  _repOf(type)  { return (this._save?.get?.('missionRep', {}) ?? {})[type] ?? 0; }
  tierOf(type)  { return tierFor(this._repOf(type)); }

  /** Custom is a SANDBOX (owner 2026-07-30): missions run there so they can be
   *  playtested, but completions must not inflate real progression — no rep,
   *  no lifetime stats.  NPC contact memory is left alone; it's flavour, not
   *  progression, and a contact who forgets you mid-sandbox reads as broken. */
  _sandbox() { return Difficulty.noScore?.() === true; }

  _bumpRep(type) {
    if (this._sandbox()) return;
    if (!this._save?.set) return;
    const rep = this._save.get('missionRep', {}) ?? {};
    rep[type] = (rep[type] ?? 0) + 1;
    this._save.set('missionRep', rep);
  }

  /** NPC continuity (Ch. 8 Phase 6): the origin contact remembers every
   *  outcome — npcMemory[contact_<stop>] = { jobsCompleted, jobsFailed,
   *  lastOutcome, failAckPending }.  A failure arms failAckPending so the
   *  contact acknowledges it at the next meeting (flavor only — rep never
   *  decreases); a later success repairs it, and the greeting itself clears
   *  it via setMemory.  npcMemory is slot-GLOBAL like the waitress's. */
  _noteNpcOutcome(m, outcome) {
    if (!this._save?.set || !m.originStopId) return;
    const memAll = this._save.get('npcMemory', {}) ?? {};
    const id = contactIdFor(m.originStopId);
    const e = { jobsCompleted: 0, jobsFailed: 0, ...(memAll[id] ?? {}) };
    if (outcome === 'completed') {
      e.jobsCompleted = (e.jobsCompleted ?? 0) + 1;
      e.failAckPending = false;            // a success repairs the last stumble
    } else {
      e.jobsFailed = (e.jobsFailed ?? 0) + 1;
      e.failAckPending = true;             // acknowledged (and cleared) next meeting
    }
    e.lastOutcome = outcome;
    memAll[id] = e;
    this._save.set('npcMemory', memAll);
  }

  _bumpStat(type, key) {
    if (this._sandbox()) return;
    if (!this._save?.set) return;
    const stats = this._save.get('missionStats', {}) ?? {};
    const s = stats[type] ?? { accepted: 0, completed: 0, failed: 0 };
    s[key] = (s[key] ?? 0) + 1;
    stats[type] = s;
    this._save.set('missionStats', stats);
  }
}
