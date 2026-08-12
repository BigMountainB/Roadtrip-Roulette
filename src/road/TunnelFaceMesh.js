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
  wildlife: {
    texture: 'tunnel_face_wildlife',
    openL: 0.2469, openR: 0.7531,
    openT: 0.7867,          // bottom 21.3%
    pierL: 0.4662, pierR: 0.5337,
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

/** OPT-IN while the projection is being proved out (2026-08-11).
 *
 *  Load with `?tunnelart=1` to see the painted facades; without it the game
 *  renders exactly as it did before. This is deliberately default-OFF: the
 *  vertex→pixel mapping below (setSize(1,1) + setOrtho(1,1), vertex.y negated)
 *  is derived from Phaser's Mesh source but has NOT yet been confirmed against
 *  a running frame, and a wrong mapping paints a full-screen garbage quad over
 *  a tunnel that ships today. Flip the default to `true` once Mt Baker has been
 *  eyeballed across the approach, curve and lateral cases. */
function artEnabled() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('tunnelart') === '1';
  } catch (_) {
    return false;
  }
}

export class TunnelFaceMesh {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();       // plate key → Phaser Mesh
    this._failed = new Set();      // plate keys whose mesh construction threw
    this._webgl = scene.sys?.renderer?.type === Phaser.WEBGL;
    this._enabled = artEnabled();
    // One line, always — so "is this build even live?" is answerable from the
    // console without driving to mile 4.6 first. This only runs the first time
    // a tunnel facade comes into range, so it costs one log per run.
    console.info(`[TunnelFaceMesh] ready — flag=${this._enabled ? 'ON' : 'OFF (add ?tunnelart=1)'} ` +
                 `renderer=${this._webgl ? 'WEBGL' : 'CANVAS (mesh unsupported)'}`);
  }

  /** Can this plate be drawn at all? False → caller paints the procedural
   *  facade. Checked every frame: a texture can finish loading late, and the
   *  renderer type can differ per device. */
  usable(plateKey) {
    if (!this._enabled) return this._why('flag off (?tunnelart=1)');
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
   * @returns {?{x:number,y:number,w:number,h:number}} the painted opening's
   *   screen rect when the artwork drew (the caller republishes it as
   *   _tunnelMouthRect so the interior mask matches the arch), or null when it
   *   didn't draw — caller then paints the procedural facade instead.
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
    const openSpan  = plate.openR - plate.openL;
    const plateW    = mouthW / openSpan;
    const plateLeft = outerL - plate.openL * plateW;

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
    const openingTopY = (mouthTopY != null && mouthTopY < groundY) ? mouthTopY
                                                                  : groundY - natH * (1 - plate.openT);
    const aboveH   = plate.openT * natH;        // hillside above, at TRUE scale
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
    for (const vert of mesh.vertices) {
      const u = vert.u;
      const v = vert.v;                   // 0 at plate top, 1 at ground line
      // Horizontal stays linear — that alone pins openL/openR onto the mouth
      // edges, because plateW was derived from the opening's own span.
      vert.x = plateLeft + plateW * u + lean * plateW * (1 - v);
      // Vertical is piecewise about the opening ceiling (see the fit above).
      const y = (v <= oT)
        ? plateTop    + (v / oT) * aboveH                                  // hillside, true scale
        : openingTopY + ((v - oT) / (1 - oT)) * (groundY - openingTopY);   // opening, pinned
      vert.y = -y;                        // Mesh flips Y (vy = -(ty/tw)*height)
      vert.alpha = alpha;
    }

    mesh.setDepth(depth);
    mesh.setVisible(true);
    mesh.setAlpha(alpha);
    this._hud(`facade: DRAWING ${plateKey} mouth=${outerL.toFixed(0)}..${outerR.toFixed(0)}` +
              ` x ${mouthTopY != null ? mouthTopY.toFixed(0) : '?'}..${groundY.toFixed(0)}\n` +
              `plate=${plateLeft.toFixed(0)},${plateTop.toFixed(0)} ${plateW.toFixed(0)}x${plateH.toFixed(0)}` +
              ` openTop=${openingTopY.toFixed(0)} camScrollX=${(this.scene.cameras?.main?.scrollX ?? 0).toFixed(0)}` +
              ` openingStretch=${stretch.toFixed(2)} (concrete 1.00)`);
    return { x: outerL, y: openingTopY, w: mouthW, h: groundY - openingTopY };  // == the procedural mouth
  }

  /** Hide a plate without destroying it (out of range, or fell back). */
  hide(plateKey) {
    const mesh = this.meshes.get(plateKey);
    if (mesh) mesh.setVisible(false);
  }

  hideAll() {
    for (const mesh of this.meshes.values()) mesh.setVisible(false);
  }

  destroy() {
    for (const mesh of this.meshes.values()) mesh.destroy();
    this.meshes.clear();
    this._failed.clear();
    this.scene = null;
  }
}
