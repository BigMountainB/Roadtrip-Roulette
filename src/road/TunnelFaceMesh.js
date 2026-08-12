// ── Tunnel facade artwork, drawn as a projected UV-mapped mesh ────────────
//
// The three tunnel plates (Mt Baker, Mercer lid, wildlife crossing) are
// 1600×900 RGBA images whose road openings are TRANSPARENT, so the procedural
// tunnel shell, road, lane lines and vehicles keep showing through them.
//
// WHY A MESH AND NOT AN IMAGE
// A Phaser Image has one x/y/scale/rotation. Drive it from the tunnel
// projection and it still reads as a cardboard cutout: the plate scales about
// a single point while the road beneath it shears, so the painted opening
// slides off the real mouth the moment the road curves or the player moves
// laterally. This builds a subdivided grid and positions EVERY vertex from the
// live projected geometry instead, so the plate tracks the mouth exactly.
//
// GEOMETRY IS PASSED IN, NEVER RE-DERIVED
// Road._drawTunnelFacade() computes outerL / outerR / groundY / sW / sH from
// _embTunnelProj and hands them here. Re-deriving them in this file would mean
// two copies of the facade maths that must be kept in step by hand — and the
// first time they drifted, the painted opening would silently stop matching
// the procedural mouth. The caller owns the geometry; this file owns the
// texture mapping.
//
// RENDERER SUPPORT — LOAD-BEARING, NOT DEFENSIVE
// Phaser 3.90's Mesh has NO canvas renderer (MeshCanvasRenderer.js is an empty
// stub: "There is no Canvas renderer for Mesh objects"). The game boots
// Phaser.AUTO, so any device that falls back to Canvas would render nothing at
// all where the facade should be. `usable()` gates on WebGL + a loaded texture
// and the caller paints the procedural facade instead. Both are never drawn
// together.
//
// PIXEL-SPACE VERTICES
// Mesh resolves vertices as `vx = (tx / tw) * mesh.width`, and auto-sizes to
// the renderer at construction. main.js drives Phaser.Scale.FIT and resizes the
// canvas to the device aspect, so renderer.width is NOT reliably SCREEN_W —
// left alone, the facade drifts whenever the phone rotates. setSize(1, 1) +
// setOrtho(1, 1) pins the transform to identity so a vertex's x/y ARE screen
// pixels, immune to canvas resizing.

// Phaser is a module import throughout this codebase, never a global — leaving
// it out here threw a ReferenceError from the constructor, BEFORE the feature
// flag was consulted, which killed the whole Mt Baker facade (artwork AND
// procedural) for every player. Shipped 2026-08-11, caught same day.
import Phaser from 'phaser';
import { tunnelArtEnabled } from '../constants.js';

/** Opening geometry of each 1600×900 master, normalised 0..1.
 *  `openL`/`openR` bracket the transparent road opening; the plate is fitted so
 *  that span lands exactly on the projected tunnel mouth. Keep in step with the
 *  table in TUNNEL_FACE_ART_SPEC.md and the manifest keys in AssetManifest.js. */
// MEASURED from each PNG's alpha channel (2026-08-11), not copied from the art
// spec's approximations. `openT` is the one that matters most and the spec
// never gave it: the opening's ceiling. Without it the plate was fitted on
// width alone and aspect ratio decided where the arch landed vertically, so
// the concrete beam floated above the tunnel mouth instead of framing it.
export const PLATES = {
  mt_baker: {
    texture: 'tunnel_face_mt_baker',
    openL: 0.2687, openR: 0.7319,
    openT: 0.6011,          // opening is the bottom 39.9% of the plate
    // Dialled in on the live approach, owner 2026-08-11.
    aboveScale: 1.00,       // deck/hillside at true scale — squashing it read as broken trees
    legsScale:  0.55,       // shorter columns; the portal was too tall
    spanScale:  0.85,       // legs pulled in to meet the interior walls
  },
  mercer_lid: {
    texture: 'tunnel_face_mercer_lid',
    openL: 0.2087, openR: 0.7887,
    openT: 0.7411,          // bottom 25.9% — a much lower, wider profile
  },
  // Twin openings with a solid pier between them. The fit uses the COMBINED
  // span so the pier lands on the road median; the two procedural arch masks
  // in Road._tunnelMouthShapes stay authoritative for interior clipping.
  // (The plate also carries ~5% transparent padding on each outer edge, which
  // is margin, not an opening — the measurement picked those up separately.)
  // The plate's pier is centred (0.4662..0.5337 → midpoint 0.4999), and the
  // fit is symmetric about the mouth centre, so the painted pier lands on the
  // procedural median automatically — no separate pier term needed.
  // Road passes mouthTopY = the arch crown, so openT binds to the real arches.
  wildlife: {
    texture: 'tunnel_face_wildlife',
    openL: 0.2469, openR: 0.7531,
    openT: 0.7867,          // bottom 21.3%
    pierL: 0.4662, pierR: 0.5337,
    // Dialled in on the live approach, owner 2026-08-11.
    aboveScale: 0.80,
    legsScale:  0.75,
    spanScale:  1.00,
    // TRACED FROM THE PNG'S ALPHA CHANNEL, not approximated from the
    // procedural arch. The interior shade is stencilled to these, so any
    // disagreement between this outline and the artwork's real holes shows up
    // as a bright sliver of road inside the opening — which is exactly what it
    // did while the stencil was cut from Road's sine arches instead. Both are
    // arches, but not the SAME arch: at half height the painted opening is 87%
    // of its full width where the sine curve is 84%, and the painted pier is
    // 13.3% of the mouth against the procedural 10%.
    //
    // Rows are sampled every ~15 px from the crown (v = openT, which the trace
    // confirms independently) down to the base, walked down the left jamb,
    // across the ground line and back up the right. Dilated outward by 3 px of
    // master: over-covering puts a hair of shadow on the arch ring, which reads
    // as the recess it is, while under-covering puts a hair of lit road inside
    // the opening, which reads as a hole in the bridge.
    openings: [
      // left arch
      [ [0.3431, 0.7867], [0.3075, 0.8029], [0.2919, 0.8191], [0.2794, 0.8354],
        [0.2706, 0.8516], [0.2631, 0.8679], [0.2575, 0.8841], [0.2531, 0.9003],
        [0.2494, 0.9166], [0.2469, 0.9328], [0.2456, 0.9491], [0.2450, 0.9653],
        [0.2450, 0.9815], [0.2444, 0.9978], [0.2444, 1.0000], [0.4681, 1.0000],
        [0.4681, 0.9978], [0.4688, 0.9815], [0.4681, 0.9653], [0.4675, 0.9491],
        [0.4662, 0.9328], [0.4637, 0.9166], [0.4606, 0.9003], [0.4562, 0.8841],
        [0.4506, 0.8679], [0.4437, 0.8516], [0.4356, 0.8354], [0.4238, 0.8191],
        [0.4081, 0.8029], [0.3713, 0.7867] ],
      // right arch
      [ [0.6288, 0.7867], [0.5931, 0.8029], [0.5769, 0.8191], [0.5650, 0.8354],
        [0.5563, 0.8516], [0.5494, 0.8679], [0.5437, 0.8841], [0.5394, 0.9003],
        [0.5356, 0.9166], [0.5331, 0.9328], [0.5319, 0.9491], [0.5312, 0.9653],
        [0.5312, 0.9815], [0.5312, 0.9978], [0.5312, 1.0000], [0.7594, 1.0000],
        [0.7594, 0.9978], [0.7550, 0.9815], [0.7550, 0.9653], [0.7550, 0.9491],
        [0.7531, 0.9328], [0.7506, 0.9166], [0.7469, 0.9003], [0.7431, 0.8841],
        [0.7369, 0.8679], [0.7294, 0.8516], [0.7206, 0.8354], [0.7087, 0.8191],
        [0.6925, 0.8029], [0.6575, 0.7867] ],
    ],
  },
};

const PLATE_ASPECT = 900 / 1600;   // all three masters share it

// Subdivision. Vertices sit at a single depth per column, so affine
// interpolation across a cell is very nearly correct; the grid exists so the
// plate can BEND with the projected geometry, and to keep any residual affine
// error inside a small cell. 6×4 is the spec's preferred density (48 triangles
// per facade — trivial next to the road itself).
const COLS = 6;
const ROWS = 4;

/** Gate lives in constants.tunnelArtEnabled(): ON by default on a local dev
 *  host, OFF in production, overridable with ?tunnelart=1 / ?tunnelart=0.
 *  AssetManifest reads the SAME function to decide whether to download the
 *  plates, so "can it draw" and "is the texture here" can never disagree. */
export class TunnelFaceMesh {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();       // plate key → Phaser Mesh
    this._failed = new Set();      // plate keys whose mesh construction threw
    this._webgl = scene.sys?.renderer?.type === Phaser.WEBGL;
    this._enabled = tunnelArtEnabled();
    // One line, always — so "is this build even live?" is answerable from the
    // console without driving to mile 4.6 first. This only runs the first time
    // a tunnel facade comes into range, so it costs one log per run.
    console.info(`[TunnelFaceMesh] ready — art=${this._enabled ? 'ON' : 'OFF (add ?tunnelart=1)'} ` +
                 `renderer=${this._webgl ? 'WEBGL' : 'CANVAS (mesh unsupported)'}`);
  }

  /** Can this plate be drawn at all? False → caller paints the procedural
   *  facade. Checked every frame: a texture can finish loading late, and the
   *  renderer type can differ per device. */
  usable(plateKey) {
    if (!this._enabled) return this._why('artwork off for this host (add ?tunnelart=1)');
    if (!this._webgl)   return this._why('renderer is CANVAS — Mesh cannot draw');
    if (this._failed.has(plateKey)) return this._why('mesh construction failed earlier');
    const plate = PLATES[plateKey];
    if (!plate) return this._why(`no plate declared for "${plateKey}"`);
    if (!this.scene.textures?.exists(plate.texture)) {
      return this._why(`texture "${plate.texture}" not loaded`);
    }
    return true;
  }

  /** Record why the artwork bailed and surface it, because chasing this by
   *  eye across a 3,100 ft approach window is not a debugging strategy.
   *  Only ever shown when ?tunnelart=1 is on, so players never see it. */
  _why(reason) {
    if (this._lastWhy !== reason) {
      this._lastWhy = reason;
      if (this._enabled) console.warn('[TunnelFaceMesh] not drawing —', reason);
    }
    this._status = reason;
    return false;
  }

  /** One line of on-screen truth: is the artwork drawing, and if not, why.
   *  Costs nothing when the flag is off (the text object is never created). */
  _hud(text) {
    if (!this._enabled) return;
    if (!this._hudText) {
      // Mid-left, NOT the top corner: the HUD buttons live up there and they
      // draw on _uiCam, which renders after the main camera — so no depth on
      // the main camera can put this in front of them (owner screenshot showed
      // it half-hidden behind the pause button).
      this._hudText = this.scene.add.text(6, 250, '', {
        fontSize: '10px', fontFamily: 'monospace',
        color: '#00ff88', backgroundColor: '#000000cc', padding: { x: 4, y: 2 },
        wordWrap: { width: 300 },
      }).setDepth(100000).setScrollFactor(0);
      this.scene._worldObjects?.push(this._hudText);
      this.scene._uiCam?.ignore?.(this._hudText);
    }
    this._lastHud = text;
    this._hudText.setText(text);
  }

  /** Build once, reuse forever. Returns null if the mesh can't be made, which
   *  latches the plate to the procedural fallback for the rest of the run. */
  _ensure(plateKey, depth) {
    let mesh = this.meshes.get(plateKey);
    if (mesh) return mesh;

    try {
      const plate = PLATES[plateKey];
      const verts = [];   // x, y pairs — filled per frame, values here are dummy
      const uvs   = [];
      const idx   = [];

      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          verts.push(0, 0);
          uvs.push(c / COLS, r / ROWS);
        }
      }
      const at = (c, r) => r * (COLS + 1) + c;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          // Two triangles per cell, counter-clockwise.
          idx.push(at(c, r), at(c + 1, r), at(c + 1, r + 1));
          idx.push(at(c, r), at(c + 1, r + 1), at(c, r + 1));
        }
      }

      mesh = this.scene.add.mesh(0, 0, plate.texture);
      mesh.addVertices(verts, uvs, idx);
      // Identity transform so vertex x/y are raw screen pixels (see header).
      mesh.setSize(1, 1);
      mesh.setOrtho(1, 1);
      mesh.setDepth(depth);
      // NO setScrollFactor(0). GameScene scrolls the main camera by
      // -HUD_OFFSET_X (GameScene.js ~2812), so every world object — the road,
      // the procedural facade graphics, all of it — renders shifted by that
      // amount. Pinning the mesh to the screen instead made it the ONE thing
      // that didn't move with the road: the plate sat ~HUD_OFFSET_X to the left
      // of the mouth it was fitted to, which also left the real mouth with no
      // concrete around it ("you can see through the front of the bridge").
      // The vertices are computed in the same space the road graphics use, so
      // the mesh must take the same camera transform they do.
      mesh.hideCCW = false;          // both windings visible; we never rotate away
      mesh.ignoreDirtyCache = true;  // vertices change every frame
      mesh.setVisible(false);

      // GameScene runs two cameras: main draws the world, _uiCam draws the HUD
      // scrolled by -HUD_OFFSET_X, and each ignores the other's list. An object
      // in NEITHER list is drawn by BOTH — the facade would render correctly on
      // main and again, offset, as a ghost over the HUD. Same registration the
      // scene does for every other world graphic it creates at runtime.
      this.scene._worldObjects?.push(mesh);
      this.scene._uiCam?.ignore?.(mesh);

      this.meshes.set(plateKey, mesh);
      return mesh;
    } catch (err) {
      console.warn(`[TunnelFaceMesh] ${plateKey} mesh construction failed — ` +
                   `falling back to the procedural facade.`, err);
      this._failed.add(plateKey);
      return null;
    }
  }

  /**
   * Position the plate against this frame's projected tunnel geometry.
   *
   * @param {string} plateKey  key into PLATES
   * @param {object} geom  live projection from Road._drawTunnelFacade():
   *   outerL, outerR  projected mouth edges in screen px (carry curve
   *                   displacement and lateral camera offset already)
   *   groundY         projected tunnel ground line — the plate's bottom anchor
   *   sW, sH          world→screen scale for this segment (e.scale × half-screen)
   *   curve           accumulated curve at the tunnel, for the skew term
   *   alpha           fade with distance
   *   depth           render depth
   * @returns {?{x:number,y:number,w:number,h:number,shapes:?Array}} the painted
   *   opening's screen rect when the artwork drew (the caller republishes it as
   *   _tunnelMouthRect so the interior mask matches the arch), plus `shapes` —
   *   the projected opening polygons for plates that declare `openings`, which
   *   the caller republishes as _tunnelMouthShapes. Null when it didn't draw —
   *   caller then paints the procedural facade instead.
   */
  update(plateKey, geom) {
    if (!this.usable(plateKey)) { this._hud('facade: ' + this._status); return null; }

    const { outerL, outerR, groundY, mouthTopY, sH, alpha = 1, depth = 9.82, curve = 0 } = geom;
    const mouthW = outerR - outerL;
    if (!(mouthW > 6) || !Number.isFinite(groundY) || !(sH > 0)) {
      this._hud(`facade: geometry rejected mouthW=${mouthW.toFixed(1)} ` +
                `groundY=${groundY} sH=${sH}`);
      return null;
    }

    const mesh = this._ensure(plateKey, depth);
    if (!mesh) { this._hud('facade: ' + (this._status ?? 'mesh build failed')); return null; }

    const plate = PLATES[plateKey];

    // ── Fit: the painted opening must land ON the projected mouth ──────────
    // The opening occupies openL..openR of the plate, so the full plate is
    // wider than the mouth by exactly that ratio. Aspect is preserved and the
    // plate is bottom-anchored to the tunnel ground line, per the art spec.
    // Horizontal span of the painted opening. Defaults to the full projected
    // mouth (outerL..outerR), but that span includes the procedural WALL band
    // on each side, so the painted jambs can land wide of where the tunnel's
    // interior walls actually are. Scaling about the mouth centre lets the legs
    // be brought in to meet them.
    const spanTune  = (globalThis.__facadeTune?.span ?? null) ?? plate.spanScale ?? 1;
    const mouthCx   = (outerL + outerR) / 2;
    const spanW     = mouthW * spanTune;
    const spanL     = mouthCx - spanW / 2;
    const openSpan  = plate.openR - plate.openL;
    const plateW    = spanW / openSpan;
    const plateLeft = spanL - plate.openL * plateW;

    // VERTICAL: preserve the art's true aspect, and let the ARTWORK define the
    // mouth — the reverse of what this did first.
    //
    // The two disagree by a fixed factor. The painted opening is 741×359 of the
    // master (h/w = 0.484); the procedural mouth is a much flatter letterbox
    // (h/w ≈ 0.262). Fitting the plate to BOTH squashed the concrete to 54% of
    // its true height at every distance — the constant `stretch=0.54` in the
    // owner's readouts, and the reason it never looked right at any range.
    //
    // The art spec is explicit that the plates must not be stretched, so the
    // geometry yields instead: fit width to the road, keep aspect, and then
    // publish the mask from where the painted arch actually lands. The tunnel
    // interior then fills the opening exactly, instead of stopping at the old
    // lintel and leaving sky in the top of the arch.
    // The plate's TRUE height at this width — what preserving aspect would give.
    const natH = plateW * PLATE_ASPECT;

    // PIECEWISE VERTICAL FIT (owner's idea: tie many points, don't scale a
    // rigid rectangle).
    //
    // The painted opening and the procedural mouth are both rectangles — the
    // measured column profile is dead flat for Mt Baker and Mercer — and their
    // proportions disagree by 1.85×. Scaling the whole plate to reconcile that
    // squashed the concrete to 54% everywhere. But the mismatch only has to be
    // absorbed by ONE band.
    //
    // So the plate is cut at the opening's ceiling and the two halves are
    // mapped independently:
    //   • the OPENING band is pinned exactly to the procedural mouth
    //     (lintel → ground). It is mostly transparent, so stretching it moves
    //     almost no visible pixels — just the jamb edges.
    //   • everything ABOVE keeps the art's true scale, so the concrete,
    //     hillside and trees are never distorted.
    // The seam is continuous because both halves share the lintel line.
    // The LEG band — opening ceiling down to the road, i.e. the columns either
    // side of the opening. Pinned to the procedural mouth by default, but
    // scalable: the owner would rather the legs carry any height reduction than
    // the hillside, because squashed concrete is invisible and squashed trees
    // are not. Shortening the legs lowers the opening's ceiling, and the
    // interior mask follows it (this function's return value becomes
    // _tunnelMouthRect), so the painted arch and the tunnel behind it stay
    // locked together at any setting.
    const legsTune = (globalThis.__facadeTune?.legs ?? null) ?? plate.legsScale ?? 1;
    const baseTopY = (mouthTopY != null && mouthTopY < groundY) ? mouthTopY
                                                                : groundY - natH * (1 - plate.openT);
    const openingTopY = groundY - (groundY - baseTopY) * legsTune;
    // Hillside above the opening, at the art's TRUE scale — times a live tuning
    // factor. The owner's read is that the concrete sits too tall/high above
    // the mouth, which is the art-vs-geometry proportion difference showing up
    // in the one band that is allowed to carry it. `__facadeTune.above` is
    // adjustable from the ?devtools=1 bar so the value can be dialled in on a
    // single drive instead of a rebuild per guess; bake the chosen number into
    // PLATES[key].aboveScale once it looks right.
    const aboveTune = (globalThis.__facadeTune?.above ?? null) ?? plate.aboveScale ?? 1;
    const aboveH   = plate.openT * natH * aboveTune;
    const plateTop = openingTopY - aboveH;
    const plateH   = groundY - plateTop;
    // Reported so the readout still shows how hard the opening band is working.
    const stretch  = (groundY - openingTopY) / ((1 - plate.openT) * natH);

    // ── Curve skew: REMOVED (owner screenshots, mi 4.78 / 4.82) ────────────
    // There was a `lean` term here that offset each vertex horizontally in
    // proportion to its height, meant to fake the facade leaning on a curve.
    // The coefficient was invented, not derived, and at its clamp it shifted
    // the top of a ~1048px plate by ±367px — the plate visibly slid left and
    // sheared away from the mouth on the approach.
    //
    // It was also unnecessary. The facade is a vertical plane crossing the
    // roadway at ONE distance, so its correct projection IS an upright
    // rectangle; the curve and the player's lateral position are already baked
    // into outerL/outerR/screenX by the road projection upstream. Any real lean
    // comes from the plane being perpendicular to the ROAD rather than the
    // camera, which needs per-column depth — a genuine change, not a fudge
    // factor. Left out until it can be derived and seen.
    const lean = 0;

    // ── Write vertices ─────────────────────────────────────────────────────
    // Driven off each vertex's OWN uv, never off a grid index. addVertices()
    // DE-INDEXES: it creates one Vertex per index entry — 3 per face, 144 for a
    // 6×4 grid — not the 35 shared corners the grid implies. Walking the array
    // as if it were the grid wrote 35 vertices and left 109 at the origin,
    // which drew the whole facade as slivers smeared to the top-left corner.
    // Reading u/v back makes this order- and topology-independent.
    // Reuses the existing Vertex objects — no per-frame allocation.
    const oT = plate.openT;
    // The ONE copy of plate-uv → screen. The vertices and the interior stencil
    // must agree exactly; two transcriptions of this drifted the moment `legs`
    // became tunable, which is how the shade ended up cut to a different arch
    // than the one the artwork paints.
    const projX = (u) => plateLeft + plateW * u;
    const projY = (v) => (v <= oT)
      ? plateTop    + (v / oT) * aboveH                                  // hillside, true scale
      : openingTopY + ((v - oT) / (1 - oT)) * (groundY - openingTopY);   // opening, pinned

    for (const vert of mesh.vertices) {
      const u = vert.u;
      const v = vert.v;                   // 0 at plate top, 1 at ground line
      // Horizontal stays linear — that alone pins openL/openR onto the mouth
      // edges, because plateW was derived from the opening's own span.
      vert.x = projX(u) + lean * plateW * (1 - v);
      vert.y = -projY(v);                 // Mesh flips Y (vy = -(ty/tw)*height)
      vert.alpha = alpha;
    }

    // Painted openings, projected into screen space. Road republishes these as
    // _tunnelMouthShapes so the interior stencil is the artwork's own hole
    // rather than a procedural approximation of it (see PLATES.wildlife).
    const shapes = plate.openings?.map(
      poly => poly.map(([u, v]) => ({ x: projX(u), y: projY(v) })));

    globalThis.__facadeLast = { plate: plateKey, above: aboveTune, legs: legsTune, span: spanTune };
    mesh.setDepth(depth);
    mesh.setVisible(true);
    mesh.setAlpha(alpha);
    // Optional bounds overlay (?devtools=1 → "outline"). Tells plate apart from
    // scenery at a glance: there is a real concrete overpass near Mt Baker, and
    // guessing which structure belongs to the artwork has cost several passes.
    this._outline(plateLeft, plateTop, plateW, plateH, outerL, openingTopY, mouthW, groundY);
    this._hud(`facade: DRAWING ${plateKey} mouth=${outerL.toFixed(0)}..${outerR.toFixed(0)}` +
              ` x ${mouthTopY != null ? mouthTopY.toFixed(0) : '?'}..${groundY.toFixed(0)}\n` +
              `plate=${plateLeft.toFixed(0)},${plateTop.toFixed(0)} ${plateW.toFixed(0)}x${plateH.toFixed(0)}` +
              ` openTop=${openingTopY.toFixed(0)} top=${aboveTune.toFixed(2)} legs=${legsTune.toFixed(2)}` +
              ` span=${spanTune.toFixed(2)}` +
              ` openingStretch=${stretch.toFixed(2)}`);
    return { x: spanL, y: openingTopY, w: spanW, h: groundY - openingTopY, shapes };
  }

  /** MAGENTA = the whole plate, GREEN = its transparent opening (which should
   *  sit exactly on the tunnel mouth). Drawn in world space, same as the mesh,
   *  so it takes the camera scroll too. */
  _outline(px, py, pw, ph, ox, oy, ow, groundY) {
    const on = !!globalThis.__facadeTune?.outline;
    if (!this._dbg) {
      if (!on) return;
      this._dbg = this.scene.add.graphics().setDepth(99999);
      this.scene._worldObjects?.push(this._dbg);
      this.scene._uiCam?.ignore?.(this._dbg);
    }
    this._dbg.clear();
    this._dbg.setVisible(on);
    if (!on) return;
    this._dbg.lineStyle(2, 0xff00ff, 0.9).strokeRect(px, py, pw, ph);
    this._dbg.lineStyle(2, 0x00ff66, 0.9).strokeRect(ox, oy, ow, groundY - oy);
  }

  /** Hide a plate without destroying it (out of range, or fell back). */
  hide(plateKey) {
    const mesh = this.meshes.get(plateKey);
    if (mesh) mesh.setVisible(false);
  }

  hideAll() {
    for (const mesh of this.meshes.values()) mesh.setVisible(false);
    this._dbg?.clear();
    // The readout is frozen text, not a live query — leaving the last DRAWING
    // line up made a hidden facade look like it was still rendering, which is
    // exactly what made the "stays until 6.8 mi" bug hard to read.
    if (this._hudText && this._lastHud !== '(no tunnel in range)') {
      this._lastHud = '(no tunnel in range)';
      this._hudText.setText('facade: (no tunnel in range)');
    }
  }

  destroy() {
    this._dbg?.destroy(); this._dbg = null;
    for (const mesh of this.meshes.values()) mesh.destroy();
    this.meshes.clear();
    this._failed.clear();
    this.scene = null;
  }
}
