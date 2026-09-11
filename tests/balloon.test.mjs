// Balloon placement — ranked zones, reading order, narrow routed tails, links
// (owner directive 2026-09-10) + the pilot's face-protection contract.
import { rectsIntersect, segmentCrossesRect, buildTail, layoutBalloon, readsAfter, readingOrder, migrateZones, TAIL_STANDOFF, TAIL_BASE_CEILING, TAIL_BASE_TARGET } from '../src/ui/balloonLayout.js';
import { bodyShape, tailShape, captionShape, seedFor, paddingFor, bulgeFor, excessBalloonArea, PAD_EM_X, PAD_LH_Y } from '../src/ui/balloonShapes.js';

let passed = 0, failed = 0;
const check = (name, ok) => { if (ok) passed++; else { failed++; console.log('  ✗ FAIL: ' + name); } };

const art = { x: 0, y: 0, w: 640, h: 360 }, bounds = { x: 0, y: 0, w: 640, h: 336 };
const face = { x: 300, y: 60, w: 120, h: 160, kind: 'face' };
const mouth = { x: 360, y: 180 };
const Z = migrateZones([face, { x: 280, y: 220, w: 160, h: 110, kind: 'body' }, { x: 120, y: 40, w: 100, h: 140, kind: 'hands' }], [{ level: 3, kind: 'sceneDetail', x: 0, y: 0, w: 640, h: 50 }]);

check('migrateZones classifies legacy kinds', Z[0].level === 1 && Z[1].level === 2 && Z[2].level === 2 && Z[3].level === 3);
check('rects intersect / touch is not overlap', rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) && !rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }));
check('segment through a rect / past a rect', segmentCrossesRect({ x: 0, y: 100 }, { x: 640, y: 100 }, face) && !segmentCrossesRect({ x: 0, y: 10 }, { x: 640, y: 10 }, face));

{ // Authored slot in negative space + Level 3: used; tail clipped outside the face.
  const r = layoutBalloon({ size: { w: 200, h: 40 }, box: { x: 440, y: 10, w: 200, h: 40 }, anchor: mouth, zones: Z, art, bounds, lineH: 16 });
  check('authored slot over sky (L3) is accepted and clean', r.slot === 'authored' && r.clean && r.l2 === 0 && r.l3 > 0 && !r.exception);
  check('tail tip stops OUTSIDE the face', r.tail.clipped && !(r.tail.tx > face.x && r.tail.tx < face.x + face.w && r.tail.ty > face.y && r.tail.ty < face.y + face.h));
  check('tail base width ≤ 1.25 × line-height (never widens with length)', r.tail.baseW <= TAIL_BASE_TARGET * 16 + 0.01 && r.tail.baseW <= TAIL_BASE_CEILING * 16);
}
{ // Authored slot ON the face: never used — moved to the best face-free candidate.
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 280, y: 80, w: 240, h: 90 }, anchor: mouth, zones: Z, art, bounds, lineH: 16 });
  check('a face is absolute: candidate rejected, alternate chosen', r.slot === 'grid' && !r.exception && !rectsIntersect(r.rect, face));
}
{ // Level 2 vs Level 3: the engine prefers covering scene detail over a story object.
  const zones = migrateZones([], [{ level: 2, kind: 'phone', x: 20, y: 20, w: 200, h: 60 }, { level: 3, kind: 'sceneDetail', x: 300, y: 20, w: 200, h: 60 }]);
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 20, y: 20, w: 200, h: 60 }, anchor: null, zones, art: { x: 0, y: 0, w: 520, h: 80 }, bounds: { x: 0, y: 0, w: 520, h: 80 }, lineH: 16 });
  check('prefers negative space / L3 over the L2 story object', r.l2 === 0 && r.clean);
}
{ // Only a Level-2 overlap remains: allowed, flagged not-clean, no exception.
  const zones = migrateZones([], [{ level: 2, kind: 'phone', x: 0, y: 0, w: 300, h: 80 }]);
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 10, y: 10, w: 200, h: 60 }, anchor: null, zones, art: { x: 0, y: 0, w: 300, h: 80 }, bounds: { x: 0, y: 0, w: 300, h: 80 }, lineH: 16 });
  check('small L2 overlap used only as a last resort (clean:false, no exception)', !r.exception && !r.clean && r.l2 > 0);
}
{ // Everything is a face: exception, never placed over it silently.
  const zones = migrateZones([{ x: 0, y: 0, w: 300, h: 80, kind: 'face' }]);
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 10, y: 10, w: 200, h: 60 }, anchor: null, zones, art: { x: 0, y: 0, w: 300, h: 80 }, bounds: { x: 0, y: 0, w: 300, h: 80 }, lineH: 16 });
  check('no face-free placement → exception (caller must split)', r.exception && r.slot === 'exception');
}
{ // Tail routing: a straight tail would cross another face → routed with a bend, never broadened.
  const other = { x: 200, y: 120, w: 90, h: 120, kind: 'face' };
  const zones = migrateZones([face, other]);
  const t = buildTail({ x: 20, y: 240, w: 150, h: 50 }, mouth, zones, [], 16);
  check('routed tail exists with a via point and stays narrow', !!t && !!t.via && t.baseW <= TAIL_BASE_TARGET * 16 + 0.01);
}
{ // Reading order.
  check('same band: right of the previous is fine; left is not', readsAfter({ x: 400, y: 20, w: 100, h: 40 }, { x: 100, y: 20, w: 100, h: 40 }) && !readsAfter({ x: 20, y: 20, w: 100, h: 40 }, { x: 400, y: 20, w: 100, h: 40 }));
  check('a lower band may start at the left again', readsAfter({ x: 20, y: 120, w: 100, h: 40 }, { x: 400, y: 20, w: 100, h: 40 }));
  check('never above the previous balloon', !readsAfter({ x: 400, y: 0, w: 100, h: 30 }, { x: 100, y: 100, w: 100, h: 40 }));
  check('geometric reading order: bands top→bottom, left→right', readingOrder([{ x: 400, y: 200, w: 50, h: 30 }, { x: 10, y: 10, w: 50, h: 30 }, { x: 300, y: 10, w: 50, h: 30 }]).join() === '1,2,0');
  const r = layoutBalloon({ size: { w: 120, h: 40 }, box: { x: 10, y: 10, w: 120, h: 40 }, anchor: null, zones: [], art, bounds, lineH: 16, after: { x: 400, y: 10, w: 100, h: 40 } });
  check('placement honours reading order over the authored slot', r.order && readsAfter(r.rect, { x: 400, y: 10, w: 100, h: 40 }));
}
{ // Linked balloons: a connector bridges two same-speaker balloons; it is collision geometry.
  const r = layoutBalloon({ size: { w: 150, h: 40 }, box: { x: 440, y: 70, w: 150, h: 40 }, anchor: null, zones: Z, art, bounds, lineH: 16, connectorFrom: { x: 440, y: 10, w: 200, h: 40 } });
  check('connector built, narrow (≤ 0.75 × line-height)', !!r.connector && r.connector.width <= 0.75 * 16 + 0.01);
  const polyT = tailShape('speech', { ax: 100, ay: 60, bx: 120, by: 60, tx: 300, ty: 300, baseW: 20, via: { x: 150, y: 200 } }, 4);
  check('routed tail renders as a bent ribbon polygon', polyT.polygon.length >= 8);
}
{ // Shapes: at least three clearly different families, deterministic by copy.
  const a = bodyShape('speech', { x: 0, y: 0, w: 100, h: 50 }, 1, seedFor('one')).outline;
  const b = bodyShape('player', { x: 0, y: 0, w: 100, h: 50 }, 1, 1).outline;
  const c = captionShape({ x: 0, y: 0, w: 100, h: 30 }, 1).outline;
  const d = bodyShape('shout', { x: 0, y: 0, w: 100, h: 50 }, 1, 1).outline;
  check('speech / player / caption / shout are different silhouettes', a.length !== c.length && c.length === 8 && d.length > a.length && JSON.stringify(a) !== JSON.stringify(b));
  check('shape seed is deterministic from the copy', seedFor('hello') === seedFor('hello') && seedFor('hello') !== seedFor('world'));
  check('tone families exist (flirt / hesitant / worried)', ['flirt', 'hesitant', 'worried'].every(k => bodyShape(k, { x: 0, y: 0, w: 120, h: 60 }, 1, 3).outline.length > 20));
}
check('tail standoff is a small positive margin', TAIL_STANDOFF > 0 && TAIL_STANDOFF < 8);

{ // Hug the lettering (owner 2026-09-11): padding in em / line-height, organic bulge, excess flag.
  const p = paddingFor('speech', 16, 19.2);
  check('speech padding inside 0.70–0.95 em × 0.42–0.65 lh', p.x / 16 >= PAD_EM_X[0] && p.x / 16 <= PAD_EM_X[1] && p.y / 19.2 >= PAD_LH_Y[0] && p.y / 19.2 <= PAD_LH_Y[1]);
  check('caption padding is the tight end of the range', paddingFor('caption', 13, 15.6).x / 13 <= 0.75);
  check('boxy families do not bulge; organic ones bulge a little', bulgeFor('player', 19.2) === 0 && bulgeFor('caption', 19.2) === 0 && bulgeFor('speech', 19.2) > 0 && bulgeFor('speech', 19.2) <= 0.35 * 19.2);
  const tight = excessBalloonArea('speech', 200, 40, 200 + 2 * 0.8 * 16 + 2 * bulgeFor('speech', 19.2), 40 + 2 * 0.5 * 19.2 + 2 * bulgeFor('speech', 19.2), 16, 19.2);
  const loose = excessBalloonArea('speech', 200, 40, 340, 110, 16, 19.2);
  check('a text-tight body is not flagged; a preset-sized body is', !tight.flagged && loose.flagged);
}

console.log(`balloon tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
