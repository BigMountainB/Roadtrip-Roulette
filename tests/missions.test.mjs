// ── Mission ("Favors") system — node CLI unit tests ───────────────────────
// Run: node tests/missions.test.mjs   (also `npm test`)
//
// Pure-node tests against MissionSystem (no Phaser): offer generation and
// the Phase-4 type mix, acceptance guards, term failures (fragile /
// perishable / timed rush / passenger comfort), payout math per tier, the
// paid-idempotency + outcome-ledger rewind rules, and per-type rep.

import {
  MissionSystem, MISSION_TIERS, tierFor, computePayout, riskBonus,
  contactIdFor, contactGreeting,
  PAYOUT_BASE, PAYOUT_PER_MI, TERM_BONUS,
  FRAGILE_MAX_DAMAGE, TIMED_SEC_PER_MI, TIMED_GRACE_SEC,
  HARD_CRASH_HP, CARSICK_MAX_DAMAGE, FUGITIVE_MAX_STARS, THRILL_TIP,
  HEAT_ESCAPE_MIN_STARS, HEAT_ESCAPE_MILES, WEATHER_CONTRACTS,
} from '../src/systems/MissionSystem.js';
import { REST_STOPS } from '../src/constants.js';
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
  check('no unknown types', offers.every(o => ['delivery', 'timed', 'passenger'].includes(o.type)));
  check('2–3 offers per generating stop', Object.values(m._offersByStop).every(l => l.length === 0 || (l.length >= 1 && l.length <= 3)));
  check('slot 0 is always a delivery (anchor guarantee)',
    Object.values(m._offersByStop).every(l => !l.length || l[0].type === 'delivery'));
  check('Pullman is payoff-only', m.offersForStop('P').length === 0);
  check('targets are ahead of origin', offers.every(o => o.targetMile > REST_STOPS.find(r => r.id === o.originStopId).mileage));
  check('timed offers carry a rush budget', offers.filter(o => o.type === 'timed')
    .every(o => o.terms.rush?.budgetSec === Math.round(o.routeMiles * TIMED_SEC_PER_MI + TIMED_GRACE_SEC)));
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
  // Plain delivery, Rookie: 20 mi, no risk, no terms.
  check('rookie plain payout', computePayout({ routeMiles: 20 })
    === r5(PAYOUT_BASE + 20 * PAYOUT_PER_MI));
  // Timed rush, Known ×2.5: 30 mi + rush bonus.
  check('known rush payout', computePayout({ routeMiles: 30, terms: { rush: { budgetSec: 355 } }, repMult: 2.5 })
    === r5((PAYOUT_BASE + 30 * PAYOUT_PER_MI + TERM_BONUS.rush) * 2.5));
  // Rush premium beats a plain delivery on the same route/tier.
  check('rush pays a premium over plain', computePayout({ routeMiles: 30, terms: { rush: true } })
    > computePayout({ routeMiles: 30 }));
  // Fugitive passenger, Legend ×5: 40 mi + wind-corridor risk.
  const risk = riskBonus(109, 149);
  check('legend fugitive payout', computePayout({ routeMiles: 40, risk, terms: { fugitive: true }, repMult: 5 })
    === r5((PAYOUT_BASE + 40 * PAYOUT_PER_MI + risk + TERM_BONUS.fugitive) * 5));
  check('tier thresholds', tierFor(0).mult === 1 && tierFor(3).mult === 2.5 && tierFor(8).mult === 5
    && MISSION_TIERS.length === 3);
}

// Handles to one offer of each type (fixed seed → stable).
function firstOfType(m, type) {
  return allOffers(m).find(o => o.type === type) ?? null;
}

// ── One active per type, simultaneous actives across types ───────────────
{
  const m = sys(42);
  const dlv = firstOfType(m, 'delivery');
  const rsh = firstOfType(m, 'timed');
  const pax = firstOfType(m, 'passenger');
  check('one of each type found', !!(dlv && rsh && pax));
  check('accept delivery', m.accept(dlv.id, 0) === dlv && dlv.status === 'active');
  check('accept timed alongside delivery', m.accept(rsh.id, 0, 1000) === rsh);
  check('accept passenger alongside both', m.accept(pax.id, 0) === pax);
  check('three simultaneous actives', m.activeMissions().length === 3);
  const dlv2 = allOffers(m).find(o => o.type === 'delivery' && o.status === 'offered');
  check('second delivery blocked while one is active', dlv2 && m.accept(dlv2.id, 0) === null);
  const rsh2 = allOffers(m).find(o => o.type === 'timed' && o.status === 'offered');
  check('second timed blocked while one is active', rsh2 && m.accept(rsh2.id, 0, 1000) === null);
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
  check('failed rush never pays', m.arriveAtStop(rsh.targetStopId, rsh.targetMile).length === 0);

  // Lazy binding: accepted without a known clock → first tick binds it.
  const m3 = sys(42);
  const r3 = firstOfType(m3, 'timed');
  m3.accept(r3.id, 0);                       // no clockSec
  check('unbound deadline until first tick', r3.deadlineClockSec === null);
  m3.checkDeadlines(0, 800);
  check('deadline binds on first tick', r3.deadlineClockSec === 800 - r3.terms.rush.budgetSec);
}

// ── Timed completion pays through arriveAtStop, rep per type ─────────────
{
  const m = sys(42);
  const rsh = firstOfType(m, 'timed');
  m.accept(rsh.id, 0, 5000);
  const done = m.arriveAtStop(rsh.targetStopId, rsh.targetMile);
  check('timed pays on arrival', done.length === 1 && rsh.status === 'completed' && rsh.paid);
  check('timed pays only once (paid guard)', m.arriveAtStop(rsh.targetStopId, rsh.targetMile).length === 0);
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
    check('failed passenger never pays', n.m.arriveAtStop(n.p.targetStopId).length === 0);
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
    const done = t.m.arriveAtStop(t.p.targetStopId, t.p.targetMile);
    check('thrill-seeker tips a spicy ride', done.length === 1 && t.p.tip === THRILL_TIP);
    const rep = t.m._save.get('missionRep', {});
    check('rep tracked under the passenger key', rep.passenger === 1 && !rep.timed && !rep.delivery);
  }

  // Calm ride = base fare, no tip.
  const t2 = byQuirk('thrill_seeker');
  if (t2) {
    t2.m.accept(t2.p.id, 0);
    const done = t2.m.arriveAtStop(t2.p.targetStopId, t2.p.targetMile);
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
  for (const t of ['delivery', 'timed', 'passenger']) m.accept(firstOfType(m, t).id, 0, 1000);
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
  const hot = m.arriveAtStop(esc.targetStopId, esc.targetMile, 1);
  check('arriving hot fails, never pays', hot.length === 0
    && esc.status === 'failed' && esc.failReason === 'still_hot' && !esc.paid);

  // Clean arrival pays in full, rep under the heat key.
  const m2 = sys(42);
  const e2 = m2.offersForStop('N', { stars: 3 }).find(o => o.type === 'heat');
  m2.accept(e2.id, 32);
  const d2 = m2.arriveAtStop(e2.targetStopId, e2.targetMile, 0);
  check('clean arrival pays the full price', d2.length === 1 && e2.paid && e2.status === 'completed');
  check('rep tracked under the heat key', m2._save.get('missionRep', {}).heat === 1);

  // Paid star-clears do NOT touch the payout (2026-07-13 decision: their
  // price is penalty enough — no halving, and no halving hook exists).
  const m3 = sys(42);
  const e3 = m3.offersForStop('N', { stars: 2 }).find(o => o.type === 'heat');
  const full = e3.payout;
  m3.accept(e3.id, 32);
  check('no pay-clear halving hook exists', typeof m3.noteHeatClearPaid !== 'function');
  const d3 = m3.arriveAtStop(e3.targetStopId, e3.targetMile, 0);
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
  const d2 = m2.arriveAtStop('O', 184);
  check('wind contract pays on arrival at Othello', d2.length === 1 && w2.paid);
  check('rep tracked under the weather key', m2._save.get('missionRep', {}).weather === 1);
  check('weather pays only once (paid guard)', m2.arriveAtStop('O', 184).length === 0);
}

// ── Phase 6: tier-up detection at completion ──────────────────────────────
{
  // First completion (0→1) crosses no threshold — no tierUp tag.
  const m = sys(42);
  const d = firstOfType(m, 'delivery');
  m.accept(d.id, 0);
  m.arriveAtStop(d.targetStopId, d.targetMile);
  check('no tier-up on an ordinary completion', d.paid && !d.tierUp);

  // 2→3 crosses Rookie→Known.
  const mK = sys(42);
  mK._save.set('missionRep', { delivery: 2 });
  const dK = firstOfType(mK, 'delivery');
  mK.accept(dK.id, 0);
  mK.arriveAtStop(dK.targetStopId, dK.targetMile);
  check('Rookie→Known tier-up tagged at 3', dK.tierUp?.name === 'Known' && dK.tierUp?.mult === 2.5);

  // 7→8 crosses Known→Legend — and only on the crossing type.
  const mL = sys(42);
  mL._save.set('missionRep', { timed: 7, delivery: 5 });
  const rL = firstOfType(mL, 'timed');
  mL.accept(rL.id, 0, 9000);
  mL.arriveAtStop(rL.targetStopId, rL.targetMile);
  check('Known→Legend tier-up tagged at 8', rL.tierUp?.name === 'Legend' && rL.tierUp?.mult === 5);
  const dL = allOffers(mL).find(o => o.type === 'delivery' && o.status === 'offered');
  mL.accept(dL.id, 0);
  mL.arriveAtStop(dL.targetStopId, dL.targetMile);
  check('mid-tier completion carries no tag', dL.paid && !dL.tierUp);
}

// ── Phase 6: NPC-contact memory (jobs counted, fail-ack set/cleared) ──────
{
  const m = sys(42);
  const d = firstOfType(m, 'delivery');
  const id = contactIdFor(d.originStopId);
  m.accept(d.id, 0);
  m.arriveAtStop(d.targetStopId, d.targetMile);
  let e = m._save.get('npcMemory', {})[id];
  check('completion counted for the origin contact', e?.jobsCompleted === 1
    && e.lastOutcome === 'completed' && e.failAckPending === false);

  // A failure arms the acknowledgment flag (flavor only — rep untouched).
  const r = allOffers(m).find(o => o.type === 'timed' && o.originStopId === d.originStopId
    && o.status === 'offered') ?? firstOfType(m, 'timed');
  const rId = contactIdFor(r.originStopId);
  m.accept(r.id, 0, 1000);
  m.failAllActive('busted');
  e = m._save.get('npcMemory', {})[rId];
  check('failure counted + fail-ack armed', e?.jobsFailed === 1
    && e.lastOutcome === 'failed' && e.failAckPending === true);

  // A later success for the same contact repairs it.
  const r2 = allOffers(m).find(o => o.originStopId === r.originStopId && o.status === 'offered');
  if (r2) {
    m.accept(r2.id, 0, 9000);
    m.arriveAtStop(r2.targetStopId, r2.targetMile);
    e = m._save.get('npcMemory', {})[rId];
    check('next success clears the fail-ack flag', e.failAckPending === false
      && e.lastOutcome === 'completed');
  } else {
    check('open offer left at the failed contact\'s stop', false);
  }
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
  check('clock-floored rush never pays', m.arriveAtStop(rsh.targetStopId, rsh.targetMile).length === 0);
}

// ── 2026-07-13: heat-escape pay is never halved — no scene may reintroduce
// the retired noteHeatClearPaid hook.
{
  const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  check('no scene calls the retired halving hook',
    !src('../src/scenes/RestStopScene.js').includes('noteHeatClearPaid')
    && !src('../src/scenes/GameScene.js').includes('noteHeatClearPaid'));
}

console.log(`\nmissions.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
