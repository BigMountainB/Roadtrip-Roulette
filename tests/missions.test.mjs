// ── Mission ("Favors") system — node CLI unit tests ───────────────────────
// Run: node tests/missions.test.mjs   (also `npm test`)
//
// Pure-node tests against MissionSystem (no Phaser): offer generation and
// the Phase-4 type mix, acceptance guards, term failures (fragile /
// perishable / timed rush / passenger comfort), payout math per tier, the
// explicit drop-off flow (gradeArrivals at pull-in → collect per mission),
// paid-idempotency + outcome-ledger rewind rules, and per-type rep.

import {
  MissionSystem, MISSION_TIERS, tierFor, computePayout, riskBonus,
  contactIdFor, contactGreeting,
  PAYOUT_BASE, PAYOUT_PER_MI, PAYOUT_MULT, TERM_BONUS,
  FRAGILE_MAX_DAMAGE, TIMED_SEC_PER_MI, TIMED_GRACE_SEC,
  HARD_CRASH_HP, CARSICK_MAX_DAMAGE, FUGITIVE_MAX_STARS, THRILL_TIP,
  HEAT_ESCAPE_MIN_STARS, HEAT_ESCAPE_MILES, WEATHER_CONTRACTS,
  OFFERS_PER_STOP, ACTIVE_PER_BUSINESS,
} from '../src/systems/MissionSystem.js';
import { REST_STOPS } from '../src/constants.js';
import { BUSINESS_MISSIONS, BUSINESS_LABELS, templateReady } from '../src/data/businessMissions.js';
import { Difficulty } from '../src/systems/Difficulty.js';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

/** Minimal SaveSystem stand-in (missionRep / missionStats live here). */
function fakeSave() {
  const data = {};
  return {
    get: (k, d) => (k in data ? data[k] : d),
    set: (k, v) => { data[k] = v; },
    _data: data,
  };
}

function sys(seed = 1234) {
  const s = new MissionSystem(fakeSave());
  s.resetRun(seed);
  return s;
}

/** All offers across every stop for a fixed seed. */
function allOffers(m) {
  const out = [];
  for (const rs of REST_STOPS) out.push(...m.offersForStop(rs.id));
  return out;
}

/** Full drop-off flow: grade the pull-in, then collect every graded-ready
 *  mission (what GameScene + the RestStopScene gold buttons do together).
 *  Returns the newly PAID missions, like the old arriveAtStop did. */
function deliver(m, stopId, mile = 0, stars = 0) {
  return m.gradeArrivals(stopId, mile, stars)
    .map(r => m.collect(r.id))
    .filter(Boolean);
}

// ── Offer generation + Phase-4 type mix ───────────────────────────────────
{
  const m = sys(42);
  const offers = allOffers(m);
  const byType = { delivery: 0, timed: 0, passenger: 0 };
  for (const o of offers) byType[o.type] = (byType[o.type] ?? 0) + 1;
  check('offers exist', offers.length > 0);
  check('mix includes deliveries', byType.delivery > 0);
  check('mix includes timed jobs', byType.timed > 0);
  check('mix includes passengers', byType.passenger > 0);
  check('no unknown types', offers.every(o => ['delivery', 'timed', 'passenger', 'challenge'].includes(o.type)));
  check('2–3 offers per generating stop', Object.values(m._offersByStop).every(l => l.length === 0 || (l.length >= 1 && l.length <= 3)));
  // Superseded 2026-07-30: the contact pitches up to OFFERS_PER_STOP jobs,
  // each a DIFFERENT category, and the player takes one.  (The old rule was
  // "slot 0 is always a delivery"; there is no anchor type any more.)
  check('at most one offer per category at a stop',
    Object.values(m._offersByStop).every((l) => {
      const t = l.map(o => o.type);
      return new Set(t).size === t.length;
    }));
  check('no stop pitches more than OFFERS_PER_STOP',
    Object.values(m._offersByStop).every(l => l.length <= OFFERS_PER_STOP));
  check('Pullman is payoff-only', m.offersForStop('P').length === 0);
  // Challenges have no destination at all — they're excluded by design.
  check('targets are ahead of origin', offers.filter(o => o.type !== 'challenge')
    .every(o => o.targetMile > REST_STOPS.find(r => r.id === o.originStopId).mileage));
  // Budget is derived from route miles UNLESS the business template authors a
  // fixed one (Price War = 4 min, Hot Springs Water = 2 min, Cold Chain = 90s).
  check('timed offers carry a rush budget', offers.filter(o => o.type === 'timed')
    .every(o => o.terms.rush?.budgetSec > 0));
  check('generic timed budgets derive from route miles',
    offers.filter(o => o.type === 'timed' && !o.templateId?.includes('_'))
      .every(o => o.terms.rush.budgetSec === Math.round(o.routeMiles * TIMED_SEC_PER_MI + TIMED_GRACE_SEC)));
  check('passenger offers carry a quirk + lines', offers.filter(o => o.type === 'passenger')
    .every(o => o.passenger?.quirk && o.terms[o.passenger.quirk] === true
             && o.passenger.ask && o.passenger.pickup && o.passenger.mid && o.passenger.dropoff && o.passenger.portrait));

  // Determinism: same seed regenerates identical offers.
  const m2 = sys(42);
  check('offers deterministic per seed', JSON.stringify(allOffers(m2)) === JSON.stringify(offers));
  // Persistence: re-asking the same stop returns the SAME array (no reroll).
  check('offers persisted per stop', m.offersForStop('N') === m.offersForStop('N'));
}

// ── Payout math per tier ──────────────────────────────────────────────────
{
  const r5 = (x) => Math.max(5, Math.round(x / 5) * 5);
  // Plain delivery, Rookie: 20 mi, no risk, no terms.  (× PAYOUT_MULT global scalar.)
  check('rookie plain payout', computePayout({ routeMiles: 20 })
    === r5((PAYOUT_BASE + 20 * PAYOUT_PER_MI) * PAYOUT_MULT));
  // Timed rush, Known ×2.5: 30 mi + rush bonus.
  check('known rush payout', computePayout({ routeMiles: 30, terms: { rush: { budgetSec: 355 } }, repMult: 2.5 })
    === r5((PAYOUT_BASE + 30 * PAYOUT_PER_MI + TERM_BONUS.rush) * 2.5 * PAYOUT_MULT));
  // Rush premium beats a plain delivery on the same route/tier.
  check('rush pays a premium over plain', computePayout({ routeMiles: 30, terms: { rush: true } })
    > computePayout({ routeMiles: 30 }));
  // Fugitive passenger, Legend ×5: 40 mi + wind-corridor risk.
  const risk = riskBonus(109, 149);
  check('legend fugitive payout', computePayout({ routeMiles: 40, risk, terms: { fugitive: true }, repMult: 5 })
    === r5((PAYOUT_BASE + 40 * PAYOUT_PER_MI + risk + TERM_BONUS.fugitive) * 5 * PAYOUT_MULT));
  check('tier thresholds', tierFor(0).mult === 1 && tierFor(3).mult === 2.5 && tierFor(8).mult === 5
    && MISSION_TIERS.length === 3);
}

// Handles to one offer of each type (fixed seed → stable).
function firstOfType(m, type) {
  return allOffers(m).find(o => o.type === type) ?? null;
}

// One job per REST STOP (owner 2026-07-30), so any test that holds several
// actives at once has to hire at several different stops.  Returns one
// offerable mission per requested type, each from a stop that hasn't hired.
function acrossStops(m, types) {
  const used = new Set(Object.keys(m._acceptedAtStop ?? {}));
  const out = {};
  for (const t of types) {
    const o = allOffers(m).find(x => x.type === t && x.status === 'offered'
      && !used.has(x.originStopId));
    if (o) { used.add(o.originStopId); out[t] = o; }
  }
  return out;
}

// ── One active per type, simultaneous actives across types ───────────────
{
  const m = sys(42);
  const pick = acrossStops(m, ['delivery', 'timed', 'passenger']);
  const dlv = pick.delivery, rsh = pick.timed, pax = pick.passenger;
  check('one of each type found', !!(dlv && rsh && pax));
  check('accept delivery', m.accept(dlv.id, 0) === dlv && dlv.status === 'active');
  check('accept timed alongside delivery', m.accept(rsh.id, 0, 1000) === rsh);
  check('accept passenger alongside both', m.accept(pax.id, 0) === pax);
  check('three simultaneous actives', m.activeMissions().length === 3);
  // Drawn from UNHIRED stops so the type rule is what blocks them, not the
  // one-job-per-stop rule.
  const p2 = acrossStops(m, ['delivery', 'timed']);
  check('second delivery blocked while one is active', p2.delivery && m.accept(p2.delivery.id, 0) === null);
  check('second timed blocked while one is active', p2.timed && m.accept(p2.timed.id, 0, 1000) === null);
  check('re-accept is idempotent', m.accept(rsh.id, 5, 900) === rsh && rsh.acceptedAtMile === 0);
}

// ── Timed deadline: party-clock value, fail past the window ──────────────
{
  const m = sys(42);
  const rsh = firstOfType(m, 'timed');
  m.accept(rsh.id, 0, 1000);
  const budget = rsh.terms.rush.budgetSec;
  check('deadline fixed at accept (clock − budget)', rsh.deadlineClockSec === 1000 - budget);
  check('inside the window = alive', m.checkDeadlines(1, 1000 - budget + 1).length === 0 && rsh.status === 'active');
  const exp = m.checkDeadlines(2, 1000 - budget - 1);
  check('past the window = failed rush', exp.length === 1 && exp[0] === rsh
    && rsh.status === 'failed' && rsh.failReason === 'rush');
  check('failed rush never pays', deliver(m, rsh.targetStopId, rsh.targetMile).length === 0);

  // Lazy binding: accepted without a known clock → first tick binds it.
  const m3 = sys(42);
  const r3 = firstOfType(m3, 'timed');
  m3.accept(r3.id, 0);                       // no clockSec
  check('unbound deadline until first tick', r3.deadlineClockSec === null);
  m3.checkDeadlines(0, 800);
  check('deadline binds on first tick', r3.deadlineClockSec === 800 - r3.terms.rush.budgetSec);
}

// ── Timed completion pays through grade+collect, rep per type ────────────
{
  const m = sys(42);
  const rsh = firstOfType(m, 'timed');
  m.accept(rsh.id, 0, 5000);
  const done = deliver(m, rsh.targetStopId, rsh.targetMile);
  check('timed pays on arrival', done.length === 1 && rsh.status === 'completed' && rsh.paid);
  check('timed pays only once (paid guard)', deliver(m, rsh.targetStopId, rsh.targetMile).length === 0);
  const rep = m._save.get('missionRep', {});
  check('rep tracked under the timed key only', rep.timed === 1 && !rep.delivery && !rep.passenger);
}

// ── Passenger comfort failures ────────────────────────────────────────────
{
  // Find a passenger of each quirk via seed scan (roster is rng-picked).
  const byQuirk = (quirk) => {
    for (let seed = 1; seed < 400; seed++) {
      const m = sys(seed);
      const p = allOffers(m).find(o => o.type === 'passenger' && o.passenger.quirk === quirk);
      if (p) return { m, p };
    }
    return null;
  };

  // Nervous: one HARD crash and they bail; small dings are fine.
  const n = byQuirk('nervous');
  check('nervous passenger found', !!n);
  if (n) {
    n.m.accept(n.p.id, 0);
    check('nervous survives small dings', n.m.onDamage(HARD_CRASH_HP - 1).length === 0 && n.p.status === 'active');
    check('nervous ignores continuous scrapes', n.m.onDamage(99, 'offroad_bleed').length === 0);
    const f = n.m.onDamage(HARD_CRASH_HP);
    check('nervous bails on a hard crash', f.length === 1 && n.p.status === 'failed' && n.p.failReason === 'passenger_scared');
    check('failed passenger never pays', deliver(n.m, n.p.targetStopId).length === 0);
  }

  // Carsick: cumulative crash damage past the cap.
  const c = byQuirk('carsick');
  check('carsick passenger found', !!c);
  if (c) {
    c.m.accept(c.p.id, 0);
    for (let i = 0; i < 4; i++) c.m.onDamage(5);          // 20 = at the cap, still ok
    check('carsick holds at the cap', c.p.status === 'active'
      && c.p.progress.damageTaken === CARSICK_MAX_DAMAGE);
    const f = c.m.onDamage(5);                             // 25 > cap
    check('carsick bails past the cap', f.length === 1 && c.p.failReason === 'passenger_sick');
  }

  // Fugitive: bails at the heat cap via checkHeat.
  const g = byQuirk('fugitive');
  check('fugitive passenger found', !!g);
  if (g) {
    g.m.accept(g.p.id, 0);
    check('fugitive rides at 1 star', g.m.checkHeat(FUGITIVE_MAX_STARS - 1).length === 0 && g.p.status === 'active');
    const f = g.m.checkHeat(FUGITIVE_MAX_STARS);
    check('fugitive bails at the heat cap', f.length === 1 && g.p.failReason === 'passenger_heat');
  }

  // Thrill-seeker: never comfort-fails; tips when the ride saw any heat.
  const t = byQuirk('thrill_seeker');
  check('thrill-seeker passenger found', !!t);
  if (t) {
    t.m.accept(t.p.id, 0);
    t.m.onDamage(50);                                      // shrugs it off
    t.m.checkHeat(3);                                      // loves it
    check('thrill-seeker never comfort-fails', t.p.status === 'active');
    const done = deliver(t.m, t.p.targetStopId, t.p.targetMile);
    check('thrill-seeker tips a spicy ride', done.length === 1 && t.p.tip === THRILL_TIP);
    const rep = t.m._save.get('missionRep', {});
    check('rep tracked under the passenger key', rep.passenger === 1 && !rep.timed && !rep.delivery);
  }

  // Calm ride = base fare, no tip.
  const t2 = byQuirk('thrill_seeker');
  if (t2) {
    t2.m.accept(t2.p.id, 0);
    const done = deliver(t2.m, t2.p.targetStopId, t2.p.targetMile);
    check('no tip on a boring ride', done.length === 1 && t2.p.tip === 0);
  }
}

// ── Passenger mid-route comment fires once ────────────────────────────────
{
  const m = sys(42);
  const pax = firstOfType(m, 'passenger');
  m.accept(pax.id, 0);
  const half = pax.routeMiles * 0.5;
  check('no comment before halfway', m.checkComments(half - 1).length === 0);
  const say = m.checkComments(half + 0.1);
  check('one mid-route comment at halfway', say.length === 1 && say[0].line === pax.passenger.mid);
  check('comment fires only once', m.checkComments(half + 1).length === 0);
}

// ── Fragile/perishable regression + rewind ledger still hold ─────────────
{
  const m = sys(7);
  const frag = allOffers(m).find(o => o.terms.fragile && o.type === 'delivery');
  if (frag) {
    m.accept(frag.id, 0);
    const f = m.onDamage(FRAGILE_MAX_DAMAGE + 1);
    check('fragile still fails past the cap', f.length === 1 && frag.failReason === 'fragile');
    // Terminal failure survives a checkpoint rewind (ledger union).
    const pre = sys(7); allOffers(pre);                    // pre-failure run with the same offers
    m.restore({ ...pre.serialize(), outcomes: {} });
    check('failure survives rewind', m.byId(frag.id)?.status === 'failed');
  } else {
    check('fragile delivery found for seed 7', false);
  }
}

// ── Serialize / restore round-trips Phase-4 fields ────────────────────────
{
  const m = sys(42);
  const rsh = firstOfType(m, 'timed');
  const pax = firstOfType(m, 'passenger');
  m.accept(rsh.id, 3, 1200);
  m.accept(pax.id, 3);
  const snap = m.serialize();
  const m2 = new MissionSystem(fakeSave());
  m2.restore(snap);
  const r2 = m2.byId(rsh.id), p2 = m2.byId(pax.id);
  check('timed round-trips (deadlineClockSec)', r2?.deadlineClockSec === rsh.deadlineClockSec && r2?.status === 'active');
  check('passenger round-trips (quirk + comment)', p2?.passenger?.quirk === pax.passenger.quirk
    && p2?.commentAtMile === pax.commentAtMile);
}

// ── failAllActive covers every type ───────────────────────────────────────
{
  const m = sys(42);
  for (const o of Object.values(acrossStops(m, ['delivery', 'timed', 'passenger']))) m.accept(o.id, 0, 1000);
  const f = m.failAllActive('busted');
  check('run end fails all three actives', f.length === 3 && m.activeMissions().length === 0);
  check('rep untouched by failures', Object.keys(m._save.get('missionRep', {})).length === 0);
}

// ── Phase 5: Heat-escape lifecycle ────────────────────────────────────────
{
  const r5 = (x) => Math.max(5, Math.round(x / 5) * 5);
  const m = sys(42);
  check('no heat offer below 2 stars',
    !m.offersForStop('N', { stars: HEAT_ESCAPE_MIN_STARS - 1 }).some(o => o.type === 'heat'));
  const esc = m.offersForStop('N', { stars: HEAT_ESCAPE_MIN_STARS }).find(o => o.type === 'heat');
  check('heat offer spawns at 2+ stars', !!esc);
  check('heat offer persists once spawned (no ctx needed)',
    m.offersForStop('N').includes(esc));
  check('heat target is the nearest stop ≥20 mi out',
    esc.routeMiles >= HEAT_ESCAPE_MILES && esc.targetStopId === 'SP');
  check('heat payout math (heat_escape term + corridor risk)',
    esc.payout === computePayout({ routeMiles: esc.routeMiles,
      risk: riskBonus(32, esc.targetMile), terms: { heat_escape: true }, repMult: 1 }));

  // Arriving HOT at the target = terminal fail, never pays.
  m.accept(esc.id, 32);
  check('heat accept occupies its own type slot', m.hasActiveOfType('heat'));
  const hot = deliver(m, esc.targetStopId, esc.targetMile, 1);
  check('arriving hot fails, never pays', hot.length === 0
    && esc.status === 'failed' && esc.failReason === 'still_hot' && !esc.paid);

  // Clean arrival pays in full, rep under the heat key.
  const m2 = sys(42);
  const e2 = m2.offersForStop('N', { stars: 3 }).find(o => o.type === 'heat');
  m2.accept(e2.id, 32);
  const d2 = deliver(m2, e2.targetStopId, e2.targetMile, 0);
  check('clean arrival pays the full price', d2.length === 1 && e2.paid && e2.status === 'completed');
  check('rep tracked under the heat key', m2._save.get('missionRep', {}).heat === 1);

  // Paid star-clears do NOT touch the payout (2026-07-13 decision: their
  // price is penalty enough — no halving, and no halving hook exists).
  const m3 = sys(42);
  const e3 = m3.offersForStop('N', { stars: 2 }).find(o => o.type === 'heat');
  const full = e3.payout;
  m3.accept(e3.id, 32);
  check('no pay-clear halving hook exists', typeof m3.noteHeatClearPaid !== 'function');
  const d3 = deliver(m3, e3.targetStopId, e3.targetMile, 0);
  check('arrival after any star-clear pays in full', d3.length === 1 && d3[0].payout === full);

  // Busted = fail (failAllActive covers heat too).
  const m4 = sys(42);
  const e4 = m4.offersForStop('N', { stars: 2 }).find(o => o.type === 'heat');
  m4.accept(e4.id, 32);
  m4.failAllActive('busted');
  check('busted fails the escape', e4.status === 'failed' && !e4.paid);

  // Serialize/restore round-trips the conditional offer.
  const snap = m3.serialize();
  const m5 = new MissionSystem(fakeSave());
  m5.restore(snap);
  const e5 = m5.byId(e3.id);
  check('heat offer round-trips (payout + status)',
    e5?.payout === e3.payout && e5?.status === e3.status);
}

// ── Phase 5: authored weather-corridor contracts ──────────────────────────
{
  const m = sys(42);
  check('no pass contract without live weather',
    !m.offersForStop('N', {}).some(o => o.type === 'weather'));
  const wx = m.offersForStop('N', { weatherOk: true }).find(o => o.type === 'weather');
  check('pass contract spawns at North Bend in weather', !!wx && wx.targetStopId === 'C');
  check('corridor contract is authored (fixed route)',
    wx.routeMiles === 52 && wx.templateId === 'pass_run');
  check('damage-cap condition attached (≤15 HP, keep cargo intact)',
    wx.terms.fragile?.maxDamage === 15 && wx.terms.weather_run?.tag === 'pass');
  check('no-chains dare absent below Legend', !wx.terms.no_chains);
  check('corridor premium beats a plain haul on the same route',
    wx.payout > computePayout({ routeMiles: 52, risk: riskBonus(32, 84), repMult: 1 }));
  check('corridor payout math', wx.payout === computePayout({ routeMiles: 52,
    risk: riskBonus(32, 84), terms: wx.terms, repMult: 1 }));
  const wind = m.offersForStop('E', { windOk: true }).find(o => o.type === 'weather');
  check('wind contract spawns at Ellensburg', !!wind
    && wind.targetStopId === 'O' && wind.terms.weather_run?.tag === 'wind');
  check('contracts never spawn off their start stop',
    !m.offersForStop('V', { weatherOk: true, windOk: true }).some(o => o.type === 'weather'));
  check('two authored contracts exist', WEATHER_CONTRACTS.length === 2);

  // The damage cap fails the contract (cargo not intact).
  m.accept(wx.id, 32);
  const f = m.onDamage(16);
  check('corridor damage cap fails the contract', f.length === 1
    && wx.status === 'failed' && wx.failReason === 'fragile');

  // Legend tier carries the no-chains dare; chains void it.
  const mL = sys(42);
  mL._save.set('missionRep', { weather: 8 });
  const wL = mL.offersForStop('N', { weatherOk: true }).find(o => o.type === 'weather');
  check('Legend gets the no-chains dare', wL.terms.no_chains === true);
  check('dare pays a big bonus', wL.payout === computePayout({ routeMiles: 52,
    risk: riskBonus(32, 84), terms: wL.terms, repMult: 5 }));
  mL.accept(wL.id, 32);
  check('checkChains is a no-op without chains', mL.checkChains(false).length === 0);
  const fc = mL.checkChains(true);
  check('chains void the dare', fc.length === 1 && wL.failReason === 'chains');

  // Completion pays + rep under the weather key.
  const m2 = sys(42);
  const w2 = m2.offersForStop('E', { windOk: true }).find(o => o.type === 'weather');
  m2.accept(w2.id, 109);
  const d2 = deliver(m2, 'O', 184);
  check('wind contract pays on arrival at Othello', d2.length === 1 && w2.paid);
  check('rep tracked under the weather key', m2._save.get('missionRep', {}).weather === 1);
  check('weather pays only once (paid guard)', deliver(m2, 'O', 184).length === 0);
}

// ── Phase 6: tier-up detection at completion ──────────────────────────────
{
  // First completion (0→1) crosses no threshold — no tierUp tag.
  const m = sys(42);
  const d = firstOfType(m, 'delivery');
  m.accept(d.id, 0);
  deliver(m, d.targetStopId, d.targetMile);
  check('no tier-up on an ordinary completion', d.paid && !d.tierUp);

  // 2→3 crosses Rookie→Known.
  const mK = sys(42);
  mK._save.set('missionRep', { delivery: 2 });
  const dK = firstOfType(mK, 'delivery');
  mK.accept(dK.id, 0);
  deliver(mK, dK.targetStopId, dK.targetMile);
  check('Rookie→Known tier-up tagged at 3', dK.tierUp?.name === 'Known' && dK.tierUp?.mult === 2.5);

  // 7→8 crosses Known→Legend — and only on the crossing type.
  const mL = sys(42);
  mL._save.set('missionRep', { timed: 7, delivery: 5 });
  const rL = firstOfType(mL, 'timed');
  mL.accept(rL.id, 0, 9000);
  deliver(mL, rL.targetStopId, rL.targetMile);
  check('Known→Legend tier-up tagged at 8', rL.tierUp?.name === 'Legend' && rL.tierUp?.mult === 5);
  const dL = allOffers(mL).find(o => o.type === 'delivery' && o.status === 'offered'
    && !mL.acceptedAtStop(o.originStopId));
  mL.accept(dL.id, 0);
  deliver(mL, dL.targetStopId, dL.targetMile);
  check('mid-tier completion carries no tag', dL.paid && !dL.tierUp);
}

// ── Phase 6: NPC-contact memory (jobs counted, fail-ack set/cleared) ──────
{
  const m = sys(42);
  const d = firstOfType(m, 'delivery');
  const id = contactIdFor(d.originStopId);
  m.accept(d.id, 0);
  deliver(m, d.targetStopId, d.targetMile);
  let e = m._save.get('npcMemory', {})[id];
  check('completion counted for the origin contact', e?.jobsCompleted === 1
    && e.lastOutcome === 'completed' && e.failAckPending === false);

  // A failure arms the acknowledgment flag (flavor only — rep untouched).
  const r = allOffers(m).find(o => o.type === 'timed' && o.status === 'offered'
    && !m.acceptedAtStop(o.originStopId));
  const rId = contactIdFor(r.originStopId);
  m.accept(r.id, 0, 1000);
  m.failAllActive('busted');
  e = m._save.get('npcMemory', {})[rId];
  check('failure counted + fail-ack armed', e?.jobsFailed === 1
    && e.lastOutcome === 'failed' && e.failAckPending === true);

  // A later success for the same contact repairs it.  A stop only hires once
  // per run now, so the repair is exercised on a fresh run whose contact is
  // carrying the pending failure (identical code path in _noteNpcOutcome).
  const m3 = sys(42);
  const d3 = firstOfType(m3, 'delivery');
  const id3 = contactIdFor(d3.originStopId);
  m3._save.set('npcMemory', { [id3]: { jobsCompleted: 0, jobsFailed: 1,
    lastOutcome: 'failed', failAckPending: true } });
  m3.accept(d3.id, 0);
  deliver(m3, d3.targetStopId, d3.targetMile);
  const e3 = m3._save.get('npcMemory', {})[id3];
  check('next success clears the fail-ack flag', e3.failAckPending === false
    && e3.lastOutcome === 'completed');
}

// ── Phase 6: memory-driven greeting selection ─────────────────────────────
{
  check('fresh contact keeps the stock opener', contactGreeting({}) === null
    && contactGreeting() === null);
  check('one run remembered', /delivered last time/i.test(contactGreeting({ jobsCompleted: 1 })));
  check('run count called out at Known depth', /4 runs/.test(contactGreeting({ jobsCompleted: 4 })));
  check('legend greeting at 8+', /legend/i.test(contactGreeting({ jobsCompleted: 9 })));
  check('pending failure acknowledged first', /last one/i.test(
    contactGreeting({ jobsCompleted: 9, failAckPending: true })));
  check('cleared flag returns the tier greeting', /legend/i.test(
    contactGreeting({ jobsCompleted: 9, failAckPending: false })));
}

// ── Phase 7: rush window closes when the party clock is exhausted ─────────
// The party clock FLOORS at 0 in GameScene, so a rush accepted with less
// clock remaining than its budget got a NEGATIVE deadline the clock could
// never cross — a never-expiring rush premium.  Clock at 0 = window over.
{
  const m = sys(42);
  const rsh = firstOfType(m, 'timed');
  m.accept(rsh.id, 0, 10);                 // 10 s of party clock < any budget
  check('under-budget accept yields a negative deadline',
    rsh.deadlineClockSec === 10 - rsh.terms.rush.budgetSec && rsh.deadlineClockSec < 0);
  check('alive while the clock still runs', m.checkDeadlines(1, 5).length === 0 && rsh.status === 'active');
  const f = m.checkDeadlines(2, 0);        // clock floored at 0
  check('exhausted party clock fails the rush', f.length === 1 && f[0] === rsh
    && rsh.status === 'failed' && rsh.failReason === 'rush');
  check('clock-floored rush never pays', deliver(m, rsh.targetStopId, rsh.targetMile).length === 0);
}

// ── Explicit drop-off (2026-07-15): grade at pull-in, collect per mission ─
{
  const m = sys(42);
  const d = firstOfType(m, 'delivery');
  m.accept(d.id, 0);
  const ready = m.gradeArrivals(d.targetStopId, d.targetMile, 0);
  check('pull-in grades READY, not paid', ready.length === 1 && ready[0] === d
    && d.status === 'ready' && !d.paid);
  check('grading bumps no rep', Object.keys(m._save.get('missionRep', {})).length === 0);
  check('ready missions queryable per stop', m.readyMissions(d.targetStopId)[0] === d
    && m.readyMissions('ZZ').length === 0);
  check('re-grading is a no-op', m.gradeArrivals(d.targetStopId, d.targetMile, 0).length === 0);
  const paid = m.collect(d.id);
  check('collect pays the ready mission', paid === d && d.status === 'completed' && d.paid
    && d.completedAtMile === d.targetMile);
  check('rep bumps only on collect', m._save.get('missionRep', {}).delivery === 1);
  check('collect is idempotent (paid guard)', m.collect(d.id) === null);

  // A checkpoint rewind after collect can't double-pay (ledger union).
  const pre = sys(42); allOffers(pre);
  m.restore({ ...pre.serialize(), outcomes: {} });
  check('collect survives rewind (still paid)', m.byId(d.id)?.paid === true
    && m.byId(d.id)?.status === 'completed');
  check('rewound mission cannot re-collect', m.collect(d.id) === null);

  // Leaving the stop without collecting = terminal 'not_delivered' fail.
  const m2 = sys(42);
  const p2 = firstOfType(m2, 'passenger');
  m2.accept(p2.id, 0);
  m2.gradeArrivals(p2.targetStopId, p2.targetMile, 0);
  const gone = m2.failUncollected(p2.targetStopId);
  check('leaving fails uncollected as not_delivered', gone.length === 1
    && p2.status === 'failed' && p2.failReason === 'not_delivered' && !p2.paid);
  check('not_delivered leaves rep unchanged', Object.keys(m2._save.get('missionRep', {})).length === 0);
  check('failed drop-off cannot be collected', m2.collect(p2.id) === null);

  // collect refuses a merely-active mission (must be graded first).
  const m3 = sys(42);
  const d3 = firstOfType(m3, 'delivery');
  m3.accept(d3.id, 0);
  check('collect requires a graded arrival', m3.collect(d3.id) === null && d3.status === 'active');

  // The heat 0-star requirement is judged AT PULL-IN (terminal still_hot).
  const m4 = sys(42);
  const e4 = m4.offersForStop('N', { stars: 2 }).find(o => o.type === 'heat');
  m4.accept(e4.id, 32);
  check('hot pull-in fails at grading, never ready',
    m4.gradeArrivals(e4.targetStopId, e4.targetMile, 1).length === 0
    && e4.status === 'failed' && e4.failReason === 'still_hot');
}

// ── 2026-07-13: heat-escape pay is never halved — no scene may reintroduce
// the retired noteHeatClearPaid hook.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  check('no scene calls the retired halving hook',
    !src('../src/scenes/RestStopScene.js').includes('noteHeatClearPaid')
    && !src('../src/scenes/GameScene.js').includes('noteHeatClearPaid'));
}

// ── 2026-07-30: per-business pools, rotation, chain runs, one job per stop ──
{
  // Every template's business key must be a real amenity key, or it can never
  // be offered anywhere.
  const amenityKeys = new Set(REST_STOPS.flatMap(r => r.amenities ?? []));
  check('every business pool maps to a real amenity',
    Object.keys(BUSINESS_MISSIONS).every(b => amenityKeys.has(b)));
  check('every business is labelled',
    Object.keys(BUSINESS_MISSIONS).every(b => !!BUSINESS_LABELS[b]));
  check('template ids are unique',
    (() => { const all = Object.values(BUSINESS_MISSIONS).flat().map(t => t.id);
             return new Set(all).size === all.length; })());
  check('every business carries a pool of ~5',
    Object.values(BUSINESS_MISSIONS).every(l => l.length >= 5 && l.length <= 6));
  check('every template declares its needs + a pitch',
    Object.values(BUSINESS_MISSIONS).flat().every(t => Array.isArray(t.needs) && !!t.pitch && !!t.name));

  // Rotation: a business activates at most ACTIVE_PER_BUSINESS per run, the
  // pick is stable within a run, and different seeds pick differently.
  const mA = sys(42), mB = sys(1337);
  for (const biz of Object.keys(BUSINESS_MISSIONS)) {
    const a = mA._activeTemplates(biz);
    check(`${biz}: rotation capped`, a.length <= ACTIVE_PER_BUSINESS);
    check(`${biz}: rotation stable within a run`,
      JSON.stringify(a) === JSON.stringify(mA._activeTemplates(biz)));
    check(`${biz}: rotation only offers implemented work`, a.every(templateReady));
  }
  const rotA = Object.keys(BUSINESS_MISSIONS).map(b => mA._activeTemplates(b).map(t => t.id).join(','));
  const rotB = Object.keys(BUSINESS_MISSIONS).map(b => mB._activeTemplates(b).map(t => t.id).join(','));
  check('different seeds roll a different rotation', rotA.join('|') !== rotB.join('|'));

  // Business-sourced offers only come from businesses the stop actually has.
  const m = sys(42);
  const all = allOffers(m);
  const bizOffers = all.filter(o => o.biz);
  check('business offers exist', bizOffers.length > 0);
  check('offers only from businesses present at the stop', bizOffers.every((o) => {
    const stop = REST_STOPS.find(r => r.id === o.originStopId);
    return (stop.amenities ?? []).includes(o.biz);
  }));
  check('business offers carry pitch + label + name',
    bizOffers.every(o => o.pitch && o.bizLabel && o.missionName));

  // Chain runs land at a branch of the named business, ahead of the origin.
  const chains = all.filter(o => o.terms?.chain);
  check('chain runs generated', chains.length > 0);
  check('chain target actually carries that business', chains.every((o) => {
    const t = REST_STOPS.find(r => r.id === o.targetStopId);
    return (t.amenities ?? []).includes(o.terms.chain.biz) && t.mileage > REST_STOPS.find(r => r.id === o.originStopId).mileage;
  }));
  check('chain target is the NEXT such branch', chains.every((o) => {
    const origin = REST_STOPS.find(r => r.id === o.originStopId);
    const first = REST_STOPS.find(r => r.mileage > origin.mileage && (r.amenities ?? []).includes(o.terms.chain.biz));
    return first?.id === o.targetStopId;
  }));
  check('chain runs carry the chain term bonus', chains.every(o => o.terms.chain.label));
  // A chain run may exceed the tier window — that's the point (owner: further,
  // pays more).  Pay must beat the identical haul without the chain premium,
  // and must rise with the haul.
  check('chain beats the same haul with no chain', chains.every((o) => {
    const bare = { ...o.terms }; delete bare.chain;
    return computePayout({ routeMiles: o.routeMiles, terms: o.terms })
         > computePayout({ routeMiles: o.routeMiles, terms: bare });
  }));
  check('chain pay is monotonic in distance',
    computePayout({ routeMiles: 60, terms: { chain: { biz: 'ambm' } } })
    > computePayout({ routeMiles: 20, terms: { chain: { biz: 'ambm' } } }));
  check('a chain run can outrun the Rookie window',
    chains.some(o => o.routeMiles > MISSION_TIERS[0].milesMax));

  // ONE job per rest stop.
  const m5 = sys(42);
  const withThree = REST_STOPS.map(r => r.id).find(id =>
    (m5.offersForStop(id) ?? []).filter(o => o.status === 'offered').length >= 2);
  check('a stop pitches multiple categories', !!withThree);
  const list = m5.offersForStop(withThree).filter(o => o.status === 'offered');
  check('first hire at a stop succeeds', !!m5.accept(list[0].id, 0, 9000));
  check('second hire at the SAME stop is refused', m5.accept(list[1].id, 0, 9000) === null);
  check('the stop records who it hired', m5.acceptedAtStop(withThree) === list[0].id);
  check('passed-over offers stay offered (not burned)', list[1].status === 'offered');
  // …and it survives a snapshot round-trip, so a rewind can't re-hire.
  const m6 = new MissionSystem(fakeSave());
  m6.restore(m5.serialize());
  check('one-job-per-stop survives restore', m6.acceptedAtStop(withThree) === list[0].id
    && m6.accept(list[1].id, 0, 9000) === null);
}

// ── 2026-07-30 slice 2: condition clauses ─────────────────────────────────
{
  // Speed-band grace now scales with difficulty, so these tests pin it rather
  // than inheriting the module default (Easy) and silently getting 2× the
  // budget they were written against.  Hard = the raw authored graceSec.
  Difficulty.set('hard');

  // Build a live mission carrying an arbitrary clause, without depending on
  // which templates the rotation happened to activate.
  const withTerms = (terms, extra = {}) => {
    const m = sys(42);
    const o = firstOfType(m, 'delivery');
    o.terms = { ...terms };
    Object.assign(o, extra);
    m.accept(o.id, 0, 1000);
    return { m, o };
  };

  // noEating — any consumed pickup voids the haul.
  {
    const { m, o } = withTerms({ noEating: true });
    check('noEating survives an untouched run', m.noteEat.length >= 0 && o.status === 'active');
    const failed = m.noteEat();
    check('noEating fails on a bite', failed.length === 1 && o.status === 'failed'
      && o.failReason === 'ate_the_cargo');
    // A job without the clause is untouched.
    const { m: m2, o: o2 } = withTerms({});
    m2.noteEat();
    check('noEating leaves other jobs alone', o2.status === 'active');
  }

  // pacifist — firing anything voids the run.
  {
    const { m, o } = withTerms({ pacifist: true });
    check('pacifist fails on a shot', m.noteWeaponFired().length === 1
      && o.status === 'failed' && o.failReason === 'opened_fire');
    const { m: m2, o: o2 } = withTerms({});
    m2.noteWeaponFired();
    check('pacifist leaves other jobs alone', o2.status === 'active');
  }

  // speedFloor / speedCap — grace absorbs brief violations, sustained ones kill.
  {
    const { m, o } = withTerms({ speedFloor: { mph: 60, graceSec: 4 } });
    m.sampleSpeed(40, 2);                       // 2s under — inside grace
    check('brief dip under the floor is survivable', o.status === 'active');
    m.sampleSpeed(90, 2);                       // back in band, debt drains
    check('time in band repays the debt', (o.progress.speedDebt ?? 0) === 0);
    m.sampleSpeed(40, 5);                       // sustained
    check('sustained crawl fails the floor', o.status === 'failed' && o.failReason === 'too_slow');
  }
  {
    const { m, o } = withTerms({ speedCap: { mph: 70, graceSec: 4 } });
    m.sampleSpeed(100, 5);
    check('sustained speeding fails the cap', o.status === 'failed' && o.failReason === 'too_fast');
  }
  {
    const { m, o } = withTerms({});
    m.sampleSpeed(10, 60);
    check('speed sampling ignores jobs with no band', o.status === 'active');
  }

  // Arrival clauses.
  {
    const { m, o } = withTerms({ fuelFloor: { pct: 90 } });
    m.gradeArrivals(o.targetStopId, o.targetMile, 0, { fuelPct: 40 });
    check('fuelFloor fails a low tank', o.status === 'failed' && o.failReason === 'tank_too_low');
    const { m: m2, o: o2 } = withTerms({ fuelFloor: { pct: 90 } });
    m2.gradeArrivals(o2.targetStopId, o2.targetMile, 0, { fuelPct: 95 });
    check('fuelFloor passes a full tank', o2.status === 'ready');
    // A caller that doesn't know the tank must not fail the job.
    const { m: m3, o: o3 } = withTerms({ fuelFloor: { pct: 90 } });
    m3.gradeArrivals(o3.targetStopId, o3.targetMile, 0, {});
    check('missing arrival ctx skips the clause', o3.status === 'ready');
  }
  {
    const { m, o } = withTerms({ alertFloor: { pct: 50 } });
    m.gradeArrivals(o.targetStopId, o.targetMile, 0, { alertPct: 20 });
    check('alertFloor fails a drowsy arrival', o.status === 'failed' && o.failReason === 'rider_nodded_off');
  }
  {
    const { m, o } = withTerms({ cashExact: { amount: 2000, tol: 50 } });
    m.gradeArrivals(o.targetStopId, o.targetMile, 0, { cash: 2500 });
    check('cashExact fails when the books are off', o.status === 'failed'
      && o.failReason === 'books_dont_balance');
    const { m: m2, o: o2 } = withTerms({ cashExact: { amount: 2000, tol: 50 } });
    m2.gradeArrivals(o2.targetStopId, o2.targetMile, 0, { cash: 2040 });
    check('cashExact passes inside tolerance', o2.status === 'ready');
  }

  // Difficulty scales the grace budget, never the band (owner 2026-07-30):
  // Hard tightest, Normal more, Easy the most.
  {
    const survives = (mode, badSec) => {
      Difficulty.set(mode);
      const { m, o } = withTerms({ speedFloor: { mph: 60, graceSec: 4 } });
      m.sampleSpeed(30, badSec);
      return o.status === 'active';
    };
    check('Hard runs the tightest budget', !survives('hard', 5) && survives('hard', 3));
    check('Normal gives more room than Hard', survives('normal', 5));
    check('Easy gives more room than Normal', survives('easy', 7) && !survives('normal', 7));
    check('grace ordering is Easy > Normal > Hard', (() => {
      const g = (mode) => { Difficulty.set(mode); return Difficulty.speedGraceMul(); };
      return g('easy') > g('normal') && g('normal') > g('hard');
    })());
    // The BAND itself is difficulty-independent — only the budget moves.
    Difficulty.set('easy');
    const { m: mE, o: oE } = withTerms({ speedFloor: { mph: 60, graceSec: 4 } });
    mE.sampleSpeed(30, 30);
    check('enough time outside the band still fails on Easy', oE.status === 'failed');
    Difficulty.set('hard');            // back to the raw budget for what follows
  }

  // EFFECT clauses never fail on their own.
  {
    const { m, o } = withTerms({ heatCarried: { stars: 2 }, survivalDrain: { mult: 2 } });
    const fx = m.activeEffects();
    check('heatCarried reports its star floor', fx.heatStars === 2);
    check('survivalDrain reports its multiplier', fx.drainMult === 2);
    m.sampleSpeed(0, 30); m.noteEat(); m.noteWeaponFired();
    check('effect clauses never fail the job', o.status === 'active');
    check('no effects with nothing aboard', (() => {
      const e = sys(42).activeEffects();
      return e.heatStars === 0 && e.drainMult === 1;
    })());
  }

  // damageDock — pay shrinks with damage, floored at a quarter of the fee.
  {
    const { m, o } = withTerms({ damageDock: { perHp: 40 } });
    o.payout = 1000; o.progress.damageTaken = 0;
    check('undamaged run pays in full', m.payoutFor(o) === 1000);
    o.progress.damageTaken = 10;
    check('damage docks the fee', m.payoutFor(o) === 600);
    o.progress.damageTaken = 100;
    check('dock floors at 25% of the fee', m.payoutFor(o) === 250);
  }

  // tipBySpeed — beating par tips, par or worse doesn't.
  {
    const mk = (elapsed) => {
      const { m, o } = withTerms({ tipBySpeed: { maxTip: 400, parSecPerMi: 26 } });
      o.routeMiles = 20;                 // par = 520s
      o.acceptedClockSec = 10000;
      m.gradeArrivals(o.targetStopId, o.targetMile, 0, { clockSec: 10000 - elapsed });
      return o;
    };
    check('a fast run tips', (mk(260).tip ?? 0) === 200);
    check('an instant run tips the max', (mk(0).tip ?? 0) === 400);
    check('a slow run tips nothing', (mk(900).tip ?? 0) === 0);
  }

  // Clause premiums are real money, and the templates that declare a clause
  // actually carry it once built.
  {
    for (const k of ['noEating', 'pacifist', 'speedFloor', 'speedCap', 'fuelFloor',
                     'alertFloor', 'cashExact', 'heatCarried', 'survivalDrain',
                     'damageDock', 'tipBySpeed']) {
      check(`${k} pays a premium`, computePayout({ routeMiles: 20, terms: { [k]: true } })
        > computePayout({ routeMiles: 20 }));
    }
    const m = sys(42);
    const all = allOffers(m);
    const clauseOffers = all.filter(o => o.terms?.noEating || o.terms?.pacifist
      || o.terms?.speedFloor || o.terms?.speedCap || o.terms?.fuelFloor
      || o.terms?.alertFloor || o.terms?.cashExact || o.terms?.heatCarried);
    check('clause-bearing offers reach the road', clauseOffers.length > 0);
    check('clause defaults are filled in', clauseOffers.every(o =>
      !o.terms.speedFloor || (o.terms.speedFloor.mph > 0 && o.terms.speedFloor.graceSec > 0)));
  }
}

// ── 2026-07-30 slice 3: the CHALLENGE class ───────────────────────────────
{
  const challengeOf = (goal, pay = 250, grant = null) => {
    const m = sys(42);
    const o = firstOfType(m, 'delivery');          // recycle a live offer shell
    o.type = 'challenge'; o.goal = goal; o.payout = pay; o.grant = grant;
    o.targetStopId = null; o.targetMile = null; o.terms = {};
    m.accept(o.id, 0, 1000);
    return { m, o };
  };

  // The clock does NOT run until the player is back on the road.
  {
    const { m, o } = challengeOf({ kind: 'boostSeconds', sec: 5 });
    m.tickChallenges(10, { boosting: true });
    check('an unarmed challenge ignores the road feed', (o.progress.hold ?? 0) === 0
      && o.status === 'active');
    check('arming reports the challenge', m.armChallenges().length === 1 && o.progress.armed);
    check('arming is idempotent', m.armChallenges().length === 0);
  }

  // useItemsInTime — the owner's fireworks dare.
  {
    const { m, o } = challengeOf({ kind: 'useItemsInTime', item: 'fireworks', count: 3, limitSec: 45 });
    m.armChallenges();
    m.noteItemUsed('fireworks'); m.noteItemUsed('fireworks');
    check('partial burn does not pay', o.status === 'active' && o.progress.used === 2);
    check('wrong item does not count', (m.noteItemUsed('coal'), o.progress.used === 2));
    const done = m.noteItemUsed('fireworks');
    check('third one completes it', done.length === 1 && o.status === 'completed' && o.paid === true);
    check('completion counts rep', (m._save.get('missionRep', {}).challenge ?? 0) === 1);
  }
  {
    const { m, o } = challengeOf({ kind: 'useItemsInTime', item: 'fireworks', count: 3, limitSec: 45 });
    m.armChallenges();
    m.noteItemUsed('fireworks');
    const r = m.tickChallenges(46, {});
    check('running out of time fails it', r.failed.length === 1
      && o.status === 'failed' && o.failReason === 'challenge_expired');
    check('a failed challenge stops accepting item uses', m.noteItemUsed('fireworks').length === 0);
  }

  // speedBand — CONTINUOUS hold, and a band has a lid.
  {
    const { m, o } = challengeOf({ kind: 'speedBand', minMph: 100, holdSec: 30, limitSec: 120 });
    m.armChallenges();
    m.tickChallenges(20, { mph: 110 });
    check('holding builds progress', (o.progress.hold ?? 0) === 20 && o.status === 'active');
    m.tickChallenges(1, { mph: 80 });
    check('dropping out of the band RESETS the hold', o.progress.hold === 0);
    m.tickChallenges(30, { mph: 105 });
    check('a full continuous hold pays', o.status === 'completed' && o.paid === true);
  }
  {
    const { m, o } = challengeOf({ kind: 'speedBand', minMph: 70, maxMph: 80, holdSec: 10, limitSec: 120 });
    m.armChallenges();
    m.tickChallenges(20, { mph: 120 });
    check('over the band lid does not count', o.progress.hold === 0 && o.status === 'active');
    m.tickChallenges(10, { mph: 75 });
    check('inside the band completes', o.status === 'completed');
  }

  // boostSeconds — CUMULATIVE, so letting off is fine.
  {
    const { m, o } = challengeOf({ kind: 'boostSeconds', sec: 20 });
    m.armChallenges();
    m.tickChallenges(8, { boosting: true });
    m.tickChallenges(30, { boosting: false });
    check('boost time is cumulative, not continuous', o.progress.hold === 8 && o.status === 'active');
    m.tickChallenges(12, { boosting: true });
    check('cumulative boost completes', o.status === 'completed');
  }

  // A challenge has no destination — it must be invisible to the stop flow.
  {
    const { m, o } = challengeOf({ kind: 'boostSeconds', sec: 20 });
    m.armChallenges();
    check('challenges are never graded at a stop',
      m.gradeArrivals('N', 500, 0).every(r => r.id !== o.id));
    check('challenges are never failed for a missed target',
      m.checkMissedTargets(9999).every(f => f.id !== o.id) && o.status === 'active');
  }

  // Paying on the road still respects the rewind ledger.
  {
    const { m, o } = challengeOf({ kind: 'boostSeconds', sec: 5 });
    m.armChallenges();
    m.tickChallenges(6, { boosting: true });
    check('road payout writes the outcome ledger',
      m._outcomes[o.id]?.status === 'completed' && m._outcomes[o.id]?.paid === true);
    const m2 = new MissionSystem(fakeSave());
    m2.restore(m.serialize());
    check('a rewind cannot un-pay a challenge', m2.byId(o.id)?.paid === true
      && m2.byId(o.id)?.status === 'completed');
  }

  // The authored templates are well-formed: a goal the engine knows, a pay,
  // and a grant where the pitch promises one.
  {
    const chal = Object.values(BUSINESS_MISSIONS).flat().filter(t => t.type === 'challenge');
    check('challenge templates exist', chal.length >= 4);
    const live = chal.filter(templateReady);
    check('the fireworks dare is live', live.some(t => t.id === 'hunt_fireworks'));
    check('live challenges carry a known goal + pay', live.every(t =>
      t.pay > 0 && t.goal && ['useItemsInTime', 'speedBand', 'boostSeconds'].includes(t.goal.kind)));
    // A fuse is optional, but an item-burning dare MUST have one or it can
    // never be failed.
    check('item dares carry a fuse', live.every(t =>
      t.goal.kind !== 'useItemsInTime' || t.goal.limitSec > 0));
    check('item-burning challenges grant the items', live.every(t =>
      t.goal.kind !== 'useItemsInTime'
      || (t.grant?.item === t.goal.item && (t.grant?.count ?? 0) >= t.goal.count)));
    // …and they actually reach the road, with a payout and no destination.
    const m = sys(42);
    const offers = allOffers(m).filter(o => o.type === 'challenge');
    check('challenge offers generate', offers.length > 0);
    check('challenge offers have no destination',
      offers.every(o => o.targetStopId === null && o.routeMiles === 0));
    check('challenge offers carry pay + goal', offers.every(o => o.payout > 0 && o.goal?.kind));
    check('challenge pay scales with rep tier', (() => {
      const mL = sys(42);
      mL._save.set('missionRep', { challenge: 8 });     // Legend
      const legend = allOffers(mL).find(o => o.type === 'challenge');
      const rookie = offers.find(o => o.templateId === legend?.templateId);
      return !legend || !rookie || legend.payout > rookie.payout;
    })());
  }
}

// ── 2026-07-30: Custom is a SANDBOX — missions RUN, progression doesn't ────
{
  Difficulty.set('custom');
  const m = sys(42);
  const d = firstOfType(m, 'delivery');
  check('missions are acceptable in custom', m.accept(d.id, 0, 1000) === d);
  const paid = deliver(m, d.targetStopId, d.targetMile);
  check('missions complete + pay in custom', paid.length === 1 && d.paid === true
    && d.status === 'completed');
  check('custom banks NO rep', Object.keys(m._save.get('missionRep', {})).length === 0);
  check('custom banks NO lifetime stats', Object.keys(m._save.get('missionStats', {})).length === 0);
  // A challenge closes its own ledger on the road — same rule must hold there.
  const c = firstOfType(m, 'delivery');
  if (c && c.id !== d.id) {
    c.type = 'challenge'; c.goal = { kind: 'boostSeconds', sec: 5 };
    c.targetStopId = null; c.terms = {};
    m.accept(c.id, 0, 1000); m.armChallenges();
    m.tickChallenges(6, { boosting: true });
    check('a custom challenge still completes', c.status === 'completed');
    check('custom challenge banks no rep', (m._save.get('missionRep', {}).challenge ?? 0) === 0);
  }
  // …and the same run on a scored difficulty DOES bank both.
  Difficulty.set('normal');
  const m2 = sys(42);
  const d2 = firstOfType(m2, 'delivery');
  m2.accept(d2.id, 0, 1000);
  deliver(m2, d2.targetStopId, d2.targetMile);
  check('a scored run still banks rep', (m2._save.get('missionRep', {}).delivery ?? 0) === 1);
  check('a scored run still banks stats',
    (m2._save.get('missionStats', {}).delivery?.completed ?? 0) === 1);
  Difficulty.set('normal');
}

console.log(`\nmissions.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
