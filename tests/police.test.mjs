// Police agencies — jurisdiction selection, angle resolution, fallbacks.
// Run: node tests/police.test.mjs
import {
  POLICE_AGENCIES, POLICE_SPRITE_META, POLICE_ANGLES,
  agencyPoolAt, pickAgencyId, jurFrameKey, agencyTextureList,
  nearestPoliceAngle, resolvePoliceSprite, SPIN_LADDER_FULL, PIT_CONTACT_LADDER,
  SPIN_360_WRECK, SPIN_360_PIT,
} from '../src/data/policeAgencies.js';

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', name); }
};

// ── Sprite metadata covers every jurisdiction frame ─────────────────────
for (const a of Object.values(POLICE_AGENCIES)) {
  for (const deg of POLICE_ANGLES) {
    const m = POLICE_SPRITE_META[jurFrameKey(a.prefix, deg)];
    check(`meta exists ${a.prefix} ${deg}`, !!m);
    if (!m) continue;
    check(`meta canvas 768x512 ${a.prefix} ${deg}`, m.w === 768 && m.h === 512);
    check(`content box sane ${a.prefix} ${deg}`, m.cx1 > m.cx0 && m.cy1 > m.cy0 && m.cy1 <= 1);
    check(`lightbar anchored ${a.prefix} ${deg}`, !!m.lb && m.lb.y > m.cy0 && m.lb.y < m.cy1);
  }
  check(`texture list has 9 ${a.prefix}`, agencyTextureList(
    Object.keys(POLICE_AGENCIES).find(id => POLICE_AGENCIES[id] === a)).length === 9);
}

// ── Jurisdiction boundaries (representative miles per validation list) ──
const at = (mile) => agencyPoolAt(mile).map(p => p.id);
check('Seattle in Seattle (mi 3)',        at(3).includes('seattle_police'));
check('Bellevue on the eastside (mi 13)', at(13).includes('bellevue_police'));
check('Snoqualmie near North Bend (mi 33)', at(33).includes('snoqualmie_police'));
check('WSP everywhere (mi 3)',            at(3).includes('washington_state_patrol'));
check('WSP in the pass gap (mi 48)',      at(48).includes('washington_state_patrol'));
check('Kittitas rural (mi 90)',           at(90).includes('kittitas_county_sheriff'));
check('Ellensburg (mi 110)',              at(110).includes('ellensburg_police'));
check('Adams basin (mi 160)',             at(160).includes('adams_county_sheriff'));
check('Othello (mi 185)',                 at(185).includes('othello_police'));
check('Pullman (mi 285)',                 at(285).includes('pullman_police'));
check('no Seattle east of the lake (mi 33)', !at(33).includes('seattle_police'));
check('no Pullman in Seattle (mi 3)',        !at(3).includes('pullman_police'));
// Overlap: WSP rides alongside locals on the freeway.
check('WSP overlaps Bellevue (mi 13)', at(13).includes('washington_state_patrol'));
// Every mile of the route has at least one agency.
for (let m = 0; m <= 293; m += 1) check(`pool non-empty mi ${m}`, agencyPoolAt(m).length > 0);

// ── Weighted pick respects the pool + rng determinism ───────────────────
check('pick is from pool (mi 110)', at(110).includes(pickAgencyId(110, () => 0.0)));
check('rng=0 picks first-weighted', typeof pickAgencyId(3, () => 0.0) === 'string');
{
  // Local w3 vs WSP 1.3 → local should dominate a sweep.
  let local = 0;
  for (let i = 0; i < 200; i++) if (pickAgencyId(110, () => (i + 0.5) / 200) === 'ellensburg_police') local++;
  check('local outdraws WSP in town', local > 100);
}

// ── Angle snapping ──────────────────────────────────────────────────────
check('snap 0',   nearestPoliceAngle(2)   === 0);
check('snap 7',   nearestPoliceAngle(8)   === 7);
check('snap 12',  nearestPoliceAngle(15)  === 12);
check('snap 90',  nearestPoliceAngle(100) === 90);
check('snap 180', nearestPoliceAngle(179) === 180);

// ── Resolver + fallback chain ───────────────────────────────────────────
const hasAll  = () => true;
const hasNone = () => false;
const only = (...keys) => (k) => keys.includes(k);

const f1 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 12, has: hasAll });
check('jurisdiction angle hit', f1.key === 'jur_seattle_police_012');
check('frame never mirrored', f1.flipX === false);
check('widthScale content-stable', f1.widthScale > 1 && f1.widthScale < 4);
check('groundFrac from content bottom', Math.abs(f1.groundFrac - 0.9102) < 0.02);

const f2 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 12,
  has: only('jur_seattle_police_000', 'car_back_police') });
check('falls back to jurisdiction 000', f2.key === 'jur_seattle_police_000');

const f3 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 12, has: only('car_back_police_turn_012', 'car_back_police') });
check('falls back to generic equivalent angle', f3.key === 'car_back_police_turn_012');

const f4 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 12, has: only('car_back_police') });
check('falls back to generic back', f4.key === 'car_back_police');

check('nothing loaded → null (caller keeps last tex)', resolvePoliceSprite({ agencyId: 'seattle_police', angle: 0, has: hasNone }) === null);

const s1 = resolvePoliceSprite({ agencyId: 'swat', angle: 90, has: hasAll });
check('swat 90 broadside', s1.key === 'car_back_swat_spin_090');
check('swat is largest class', s1.widthScale * (POLICE_SPRITE_META[s1.key].cx1 - POLICE_SPRITE_META[s1.key].cx0) >
  f1.widthScale * (POLICE_SPRITE_META[f1.key].cx1 - POLICE_SPRITE_META[f1.key].cx0));
const s2 = resolvePoliceSprite({ agencyId: 'swat', angle: 180, has: hasAll });
check('swat front rendered', s2.key === 'car_front_swat_rendered');
const s3 = resolvePoliceSprite({ agencyId: 'swat', angle: 150, has: hasAll });
check('swat 150 snaps to available', s3.key === 'car_back_swat_spin_090' || s3.key === 'car_front_swat_rendered');

// Sheriff prefixes map as specced.
check('wsp prefix', POLICE_AGENCIES.washington_state_patrol.prefix === 'wsp');
check('kittitas prefix', POLICE_AGENCIES.kittitas_county_sheriff.prefix === 'kittitas_sheriff');
check('adams prefix', POLICE_AGENCIES.adams_county_sheriff.prefix === 'adams_sheriff');

// Spin ladders stop at 180 — no mirrored second half.
check('spin ladder capped at 180', SPIN_LADDER_FULL[SPIN_LADDER_FULL.length - 1] === 180
  && PIT_CONTACT_LADDER[PIT_CONTACT_LADDER.length - 1] === 180);

// ── 2026-08-29 pipeline review ──────────────────────────────────────────
// Left turns never mirror: with no dedicated left art the resolver falls
// back to the straight 0° frame, flipX stays false everywhere.
{
  const l7 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 7, dir: -1, has: hasAll });
  check('left 7° falls back to 000 (no left art)', l7.key === 'jur_seattle_police_000');
  check('left fallback never mirrors', l7.flipX === false);
  const l12 = resolvePoliceSprite({ agencyId: 'wsp' in POLICE_AGENCIES ? 'wsp' : 'washington_state_patrol', angle: 12, dir: -1, has: hasAll });
  check('left 12° falls back to 000', l12.key.endsWith('_000'));
  const r7 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 7, dir: 1, has: hasAll });
  check('right 7° keeps native art', r7.key === 'jur_seattle_police_007');
  const l90 = resolvePoliceSprite({ agencyId: 'seattle_police', angle: 90, dir: -1, has: hasAll });
  check('dir only affects the 7/12 steering frames', l90.key === 'jur_seattle_police_090');
}
// Full-revolution ping-pong ladders: reach 180 mid-spin, return through the
// same frames (no mirrored back half), and settle without a 180→0 snap
// (adjacent steps are always one ladder rung apart).
{
  const mono = (lad) => lad.every((v, i) => i === 0
    || Math.abs(POLICE_ANGLES.indexOf(v) - POLICE_ANGLES.indexOf(lad[i - 1])) === 1
    || Math.abs(v - lad[i - 1]) <= 30);
  check('wreck 360 passes through 180', SPIN_360_WRECK.includes(180));
  check('wreck 360 ends settled at 0', SPIN_360_WRECK[SPIN_360_WRECK.length - 1] === 0);
  check('wreck 360 has no angle jumps', mono(SPIN_360_WRECK));
  check('pit 360 passes through 180', SPIN_360_PIT.includes(180));
  check('pit 360 ends settled at 0', SPIN_360_PIT[SPIN_360_PIT.length - 1] === 0);
  check('pit 360 has no angle jumps', mono(SPIN_360_PIT));
}
// Solid-height normalization invariance: widthScale × solid content height
// is constant across a set's angles (tire-to-roof height never pops).
{
  for (const pfx of ['wsp', 'adams_sheriff', 'seattle_police']) {
    const id = Object.keys(POLICE_AGENCIES).find(k => POLICE_AGENCIES[k].prefix === pfx);
    const hs = POLICE_ANGLES.map(deg => {
      const f = resolvePoliceSprite({ agencyId: id, angle: deg, has: hasAll });
      const m = f.meta;
      return f.widthScale * (m.cy1 - (m.sy0 ?? m.cy0)) * (m.h / m.w);
    });
    const spread = (Math.max(...hs) - Math.min(...hs)) / hs[0];
    check(`solid-height invariant ${pfx} (spread ${spread.toFixed(3)})`, spread < 0.001);
  }
}

console.log(`police.test: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
