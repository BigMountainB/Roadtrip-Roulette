// Balloon placement + face protection (comic dialogue workshop §D).
import { rectsIntersect, segmentCrossesRect, clipTail, layoutBalloon, TAIL_STANDOFF } from '../src/ui/balloonLayout.js';

let passed = 0, failed = 0;
const check = (name, ok) => { if (ok) passed++; else { failed++; console.log('  ✗ FAIL: ' + name); } };

const art = { x: 0, y: 0, w: 640, h: 360 }, bounds = { x: -40, y: 0, w: 720, h: 360 };
const face = { x: 300, y: 60, w: 120, h: 160, kind: 'face' };
const mouth = { x: 360, y: 180 };

check('rects intersect / touch is not overlap', rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) && !rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }));
check('segment through a rect / past a rect', segmentCrossesRect({ x: 0, y: 100 }, { x: 640, y: 100 }, face) && !segmentCrossesRect({ x: 0, y: 10 }, { x: 640, y: 10 }, face));

{ // Authored slot clear of the face: kept, tail clipped at the face edge.
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 20, y: 20, w: 240, h: 90 }, anchor: mouth, protect: [face], art, bounds });
  check('clean authored slot is used', r.clean && r.slot === 'authored' && r.rect.x === 20 && r.rect.y === 20);
  check('tail tip stops OUTSIDE the face (never reaches the mouth)', r.tail.clipped && !(r.tail.tx > face.x && r.tail.tx < face.x + face.w && r.tail.ty > face.y && r.tail.ty < face.y + face.h));
  const d = Math.hypot(r.tail.tx - mouth.x, r.tail.ty - mouth.y);
  check('tail still aims at the mouth (tip on the balloon→mouth line, short of it)', d > TAIL_STANDOFF && d < 120);
}
{ // Authored slot ON the face: moved to an alternate slot.
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 280, y: 80, w: 240, h: 90 }, anchor: mouth, protect: [face], art, bounds });
  check('authored slot over a face is rejected → alternate slot', r.clean && r.slot !== 'authored' && !rectsIntersect(r.rect, face));
}
{ // Tail would have to cross ANOTHER face to reach the speaker: that slot is rejected.
  const other = { x: 120, y: 40, w: 100, h: 140, kind: 'face' };
  const r = layoutBalloon({ size: { w: 90, h: 50 }, box: { x: 10, y: 80, w: 100, h: 60 }, anchor: mouth, protect: [face, other], art, bounds });
  check('slot whose tail crosses a second face is rejected', r.clean && r.slot !== 'authored' && !segmentCrossesRect({ x: r.tail.ax, y: r.tail.ay }, { x: r.tail.tx, y: r.tail.ty }, other));
}
{ // Existing balloon in the way: avoided.
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 20, y: 20, w: 240, h: 90 }, anchor: null, protect: [], art, bounds, avoid: [{ x: 0, y: 0, w: 260, h: 100 }] });
  check('overlapping an earlier balloon moves it', r.clean && r.slot !== 'authored' && !rectsIntersect(r.rect, { x: 0, y: 0, w: 260, h: 100 }));
}
{ // Everything covered: forced, flagged, tail still clipped at the face.
  const wall = { x: -40, y: 0, w: 720, h: 360 };
  const r = layoutBalloon({ size: { w: 200, h: 60 }, box: { x: 20, y: 20, w: 240, h: 90 }, anchor: mouth, protect: [wall], art, bounds });
  check('no clean slot → forced + clean:false', !r.clean && r.slot === 'forced');
}
{ // clipTail: anchor outside every protect rect → tail reaches the anchor untouched.
  const t = clipTail({ x: 20, y: 20, w: 200, h: 60 }, { x: 100, y: 300 }, [face]);
  check('unprotected anchor: tail reaches it', t && !t.clipped && t.tx === 100 && t.ty === 300);
  check('anchor beyond a face the path would cross: null (collision)', clipTail({ x: 20, y: 20, w: 200, h: 60 }, { x: 500, y: 300 }, [face]) === null);
}


{ // A tail may cross a torso / object / car, never a face, hands or the phone.
  const ct = clipTail;
  const body = { x: 300, y: 60, w: 120, h: 160, kind: 'body' };
  const t = ct({ x: 20, y: 20, w: 200, h: 60 }, { x: 500, y: 300 }, [body]);
  const chk = check;
  chk('tail may cross a body-kind rect', t && !t.clipped && t.tx === 500);
  chk('tail may not cross a hands-kind rect', ct({ x: 20, y: 20, w: 200, h: 60 }, { x: 500, y: 300 }, [{ ...body, kind: 'hands' }]) === null);
  chk('anchor ABOVE the balloon: tail leaves the top edge', ct({ x: 200, y: 200, w: 200, h: 60 }, { x: 300, y: 100 }, []).edge === 'top');
}

console.log(`balloon tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
