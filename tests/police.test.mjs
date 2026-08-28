// Police agencies — jurisdiction selection, angle resolution, fallbacks.
// Run: node tests/police.test.mjs
import {
  POLICE_AGENCIES, POLICE_SPRITE_META, POLICE_ANGLES,
  agencyPoolAt, pickAgencyId, jurFrameKey, agencyTextureList,
  nearestPoliceAngle, resolvePoliceSprite, SPIN_LADDER_FULL, PIT_CONTACT_LADDER,
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

console.log(`police.test: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
