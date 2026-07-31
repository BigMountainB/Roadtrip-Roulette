import { ViceSystem } from '../src/systems/ViceSystem.js';

let pass = 0, fail = 0;
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const mk = () => {
  const v = new ViceSystem();
  for (const id of ['caffeine', 'coldbrew', 'energy']) v.unlocked[id] = true;
  return v;
};
const run = (v, secs, step = 1 / 60) => {
  for (let t = 0; t < secs; t += step) v.update(step);
};

// ── 1. One caffeine pill: 10% fill, gone at 60 s ──
{
  const v = mk();
  v.pickup('caffeine');
  ok('caffeine fills 10%', near(v.get('caffeine'), 0.10), `got ${v.get('caffeine')}`);
  run(v, 30);
  ok('caffeine half-life at 30 s', near(v.get('caffeine'), 0.05), `got ${v.get('caffeine').toFixed(4)}`);
  run(v, 30.5);
  ok('caffeine gone at 60 s', v.get('caffeine') === 0, `got ${v.get('caffeine')}`);
}

// ── 2. THE BUG: stacking must raise the bar, not extend its life ──
{
  const v = mk();
  for (let i = 0; i < 4; i++) v.pickup('caffeine');
  ok('4 pills = 40% bar', near(v.get('caffeine'), 0.40), `got ${v.get('caffeine')}`);
  run(v, 60.5);
  ok('4 simultaneous pills ALL expire at 60 s (was 204 s)', v.get('caffeine') === 0,
     `got ${v.get('caffeine').toFixed(4)}`);
}

// ── 3. Staggered doses expire on their OWN clocks ──
{
  const v = mk();
  v.pickup('caffeine');            // dose A at t=0
  run(v, 30);
  v.pickup('caffeine');            // dose B at t=30
  ok('at t=30: A half-gone + fresh B', near(v.get('caffeine'), 0.15), `got ${v.get('caffeine').toFixed(4)}`);
  run(v, 30.5);                    // t=60.5 — A expired, B half-gone
  ok('at t=60: A expired, B half-gone', near(v.get('caffeine'), 0.05), `got ${v.get('caffeine').toFixed(4)}`);
  run(v, 30);                      // t=90 — B expired too
  ok('at t=90: both expired', v.get('caffeine') === 0, `got ${v.get('caffeine').toFixed(4)}`);
}

// ── 4. Cold brew 45 s, energy 30 s ──
{
  const v = mk();
  v.pickup('coldbrew');
  ok('coldbrew fills 10%', near(v.get('coldbrew'), 0.10), `got ${v.get('coldbrew')}`);
  run(v, 45.5);
  ok('coldbrew gone at 45 s', v.get('coldbrew') === 0, `got ${v.get('coldbrew').toFixed(4)}`);

  const w = mk();
  w.pickup('energy');
  run(w, 29);
  ok('energy still live at 29 s', w.get('energy') > 0, `got ${w.get('energy').toFixed(4)}`);
  run(w, 1.5);
  ok('energy gone at 30 s', w.get('energy') === 0, `got ${w.get('energy').toFixed(4)}`);
}

// ── 5. External writes to levels[] must win (GameScene does this ~13×) ──
{
  const v = mk();
  for (let i = 0; i < 4; i++) v.pickup('caffeine');
  run(v, 10);
  v.levels.caffeine = 0;                       // Narcan-style flush
  run(v, 1);
  ok('external zero sticks', v.get('caffeine') === 0, `got ${v.get('caffeine').toFixed(4)}`);

  const w = mk();
  for (let i = 0; i < 4; i++) w.pickup('caffeine');
  w.levels.caffeine *= 0.5;                    // rest-stop "reduce vices" buy
  run(w, 1);
  ok('external halve sticks', near(w.get('caffeine'), 0.20, 0.02), `got ${w.get('caffeine').toFixed(4)}`);
  run(w, 60);
  ok('halved doses still expire on schedule', w.get('caffeine') === 0, `got ${w.get('caffeine').toFixed(4)}`);

  const x = mk();
  x.levels.caffeine = 0.60;                    // dev slider / save restore, no ledger
  run(x, 1);
  ok('level set from nothing survives', near(x.get('caffeine'), 0.59, 0.02), `got ${x.get('caffeine').toFixed(4)}`);
  run(x, 60);
  ok('synthesised dose decays away', x.get('caffeine') === 0, `got ${x.get('caffeine').toFixed(4)}`);
}

// ── 6. Bar caps at 1.0, ledger never over-banks ──
{
  const v = mk();
  for (let i = 0; i < 20; i++) v.pickup('caffeine');
  ok('bar caps at 1.0', near(v.get('caffeine'), 1.0), `got ${v.get('caffeine')}`);
  run(v, 60.5);
  ok('overfilled bar still empties in 60 s', v.get('caffeine') === 0, `got ${v.get('caffeine').toFixed(4)}`);
}

// ── 7. Speed impact — what this was all for ──
// Owner rule (2026-07-31): caffeine's speed effect is a flat ~4 mph per
// pickup, fading over that pill's own 60 s clock — NOT a percentage
// speedMult on an invisible bar (the old `1 + c*0.45` mechanism, which
// double-counted against this same flat bonus and was removed from
// EffectsSystem entirely). getCaffeineSpeedBonusMPH is now the only
// place caffeine touches speed.
{
  const v = mk();
  for (let i = 0; i < 4; i++) v.pickup('caffeine');
  const peakMph = v.getCaffeineSpeedBonusMPH();
  ok('4 pickups ≈ 16 mph peak (4 mph each, no dilution)', near(peakMph, 16, 0.5), `got ${peakMph.toFixed(2)} mph`);
  run(v, 60.5);
  ok('caffeine mph bonus back to 0 in 60 s', v.getCaffeineSpeedBonusMPH() === 0, `got ${v.getCaffeineSpeedBonusMPH()}`);
  console.log(`\n  caffeine speed bonus: peak +${peakMph.toFixed(1)} mph for <60 s (flat, was a x1.45 speedMult for 204 s)`);
}

// ── 8. One pickup alone is a real, visible bonus (the regression this
//      whole rework was chasing: "I ate a pill and saw no change") ──
{
  const v = mk();
  v.pickup('caffeine');
  const oneMph = v.getCaffeineSpeedBonusMPH();
  ok('one pickup ≈ 4 mph, not ~0.4', near(oneMph, 4, 0.2), `got ${oneMph.toFixed(2)} mph`);
}

console.log(`\ndose.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
