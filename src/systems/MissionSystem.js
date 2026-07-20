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
    ask: "I missed the last bus and finals don't care. I can pay — just… drive like my mom is watching.",
    pickup:  '"Seatbelt. Both hands. Great. Perfect. Love it."',
    mid:     '"You\'re doing great. I\'m saying that for both of us."',
    dropoff: '"We lived! Here — take it before I count it."',
  },
  {
    id: 'hitcher', name: 'Hitchhiker', portrait: 'hiker_woman', quirk: 'thrill_seeker',
    ask: "Need a lift up the road. I chip in for gas, I don't scream on curves, and I tip for a good story.",
    pickup:  '"Music\'s yours, pedal\'s yours. Impress me."',
    mid:     '"Is that all this thing does? Kidding. Mostly."',
    dropoff: '"Decent run. Here\'s the fare."',
  },
  {
    id: 'oddball', name: 'Desert Oddball', portrait: 'desert_oddball', quirk: 'fugitive',
    ask: "I need to be somewhere that isn't here, fast-ish, and I'd rather we not meet any police about it.",
    pickup:  '"If anyone asks, I\'ve been asleep since Tuesday."',
    mid:     'He checks the mirror more than you do.',
    dropoff: '"You never saw me. The money saw you, though."',
  },
  {
    id: 'grandma', name: 'Roadside Grandma', portrait: 'grandma', quirk: 'carsick',
    ask: "My grandson never calls and never drives me anywhere. You look sturdy. Smooth roads only, dear.",
    pickup:  '"I get queasy, dear. Pretend you\'re carrying soup."',
    mid:     '"My late husband drove like this. He\'s late for a reason."',
    dropoff: '"A gentleman. Or close enough. Here you are, dear."',
  },
  {
    id: 'skibum', name: 'Ski Bum', portrait: 'ski_bum', quirk: 'nervous',
    ask: "Board's waxed, ride fell through. Get me up the road and the lift-ticket money's yours.",
    pickup:  '"Powder day, man. Every minute counts. But like, safely."',
    mid:     '"Whoa. Okay. The mountain isn\'t going anywhere, right?"',
    dropoff: '"Righteous. Here\'s the cash — first run\'s for you."',
  },
  {
    id: 'oldtimer', name: 'Old-Timer', portrait: 'old_timer', quirk: 'carsick',
    ask: "Truck died. Doctor's expecting me down the road and my stomach's older than your car. Easy does it.",
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
    return "Heard how the last one ended. Cargo's gone, story's over — clean slate. Still got work, if you're still driving.";
  }
  const n = mem.jobsCompleted ?? 0;
  if (n >= 8) return "There's my legend. I quit offering the big runs to anyone else — they're yours if you want them.";
  if (n >= 3) return `Back again? That's ${n} runs you've made me. Starting to save the good stuff for you.`;
  if (n >= 1) return n === 1
    ? 'You delivered last time. I remember. Got more if you\'re hauling.'
    : `That's ${n} runs you've made me now. Keep this up and I'll start trusting you.`;
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
  }

  /** Run-state snapshot — rides inside GameScene._collectSaveSnapshot(). */
  serialize() {
    return {
      seed: this._seed,
      offersByStop: JSON.parse(JSON.stringify(this._offersByStop)),
      outcomes: { ...this._outcomes },
      failCounts: { ...this._failCounts },
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

  _generateOffers(stopId) {
    const origin = REST_STOPS.find(r => r.id === stopId);
    if (!origin) return [];
    const rng = mulberry32((this._seed ^ hashStr(stopId)) >>> 0);
    const npcName = NPC_NAMES[hashStr(stopId) % NPC_NAMES.length];
    // Phase 4 offer mix: 2–3 offers per stop across delivery/timed/passenger.
    // Slot 0 is always a delivery (the Ch. 8 "at least one persisted offer"
    // guarantee stays on the anchor type); slot 1 is timed OR passenger
    // (coin flip), slot 2 — when it rolls — is the other one, so every
    // multi-offer stop actually spreads across the types instead of leaving
    // the mix to a die that starves passengers at narrow Rookie windows.
    const count = 2 + (rng() < 0.35 ? 1 : 0);
    const slot1 = rng() < 0.5 ? 'timed' : 'passenger';
    const types = ['delivery', slot1, slot1 === 'timed' ? 'passenger' : 'timed'];
    const offers = [];
    const usedTargets = new Set();
    for (let i = 0; i < count; i++) {
      const type = types[i];
      const tier = tierFor(this._repOf(type));
      // Candidate targets ahead of this stop within the TYPE's tier window.
      const pool = REST_STOPS.filter(r =>
        r.id !== stopId && !usedTargets.has(r.id) &&
        r.mileage - origin.mileage >= tier.milesMin &&
        r.mileage - origin.mileage <= tier.milesMax);
      if (!pool.length) continue;
      const target = pool[Math.floor(rng() * pool.length)];
      usedTargets.add(target.id);
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
    return offers;
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
    // Passenger: schedule the one mid-route comment; start the heat tracker.
    if (m.type === 'passenger') {
      m.commentAtMile = mile + m.routeMiles * 0.5;
      m.progress.maxStars = 0;
    }
    m.progress.damageTaken = 0;
    this._bumpStat(m.type, 'accepted');
    return m;
  }

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

  /** Run-ending event (busted / crash / overdose / too-late): every active
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
  gradeArrivals(stopId, mile = 0, stars = 0) {
    const ready = [];
    for (const m of this.activeMissions()) {
      if (m.targetStopId !== stopId) continue;
      if (m.paid) continue;
      if (m.type === 'heat' && stars > 0) { this._fail(m, 'still_hot'); continue; }
      // Thrill-seeker tip condition: the ride actually got spicy (any heat).
      m.tip = (m.terms?.thrill_seeker && (m.progress?.maxStars ?? 0) >= 1) ? THRILL_TIP : 0;
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

  _bumpRep(type) {
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
    if (!this._save?.set) return;
    const stats = this._save.get('missionStats', {}) ?? {};
    const s = stats[type] ?? { accepted: 0, completed: 0, failed: 0 };
    s[key] = (s[key] ?? 0) + 1;
    stats[type] = s;
    this._save.set('missionStats', stats);
  }
}
