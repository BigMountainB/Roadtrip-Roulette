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
export const PLATES = {
  mt_baker: {
    texture: 'tunnel_face_mt_baker',
    openL: 429 / 1600,
    openR: 1171 / 1600,
  },
  mercer_lid: {
    texture: 'tunnel_face_mercer_lid',
    openL: 320 / 1600,
    openR: 1276 / 1600,
  },
  // Twin openings with a solid pier between them. The fit uses the COMBINED
  // span so the pier lands on the road median; the two procedural arch masks
  // in Road._tunnelMouthShapes stay authoritative for interior clipping.
  wildlife: {
    texture: 'tunnel_face_wildlife',
    openL: 384 / 1600,
    openR: 1215 / 1600,
    pierL: 746 / 1600,
    pierR: 853 / 1600,
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
  }

  /** Can this plate be drawn at all? False → caller paints the procedural
   *  facade. Checked every frame: a texture can finish loading late, and the
   *  renderer type can differ per device. */
  usable(plateKey) {
    if (!this._enabled) return false;
    if (!this._webgl) return false;
    if (this._failed.has(plateKey)) return false;
    const plate = PLATES[plateKey];
    if (!plate) return false;
    return !!this.scene.textures?.exists(plate.texture);
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
      mesh.setScrollFactor?.(0);
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
   * @returns {boolean} true if the artwork drew — caller then SKIPS the
   *                    procedural facade so the two never stack.
   */
  update(plateKey, geom) {
    if (!this.usable(plateKey)) return false;

    const { outerL, outerR, groundY, sH, alpha = 1, depth = 9.82, curve = 0 } = geom;
    const mouthW = outerR - outerL;
    if (!(mouthW > 6) || !Number.isFinite(groundY) || !(sH > 0)) return false;

    const mesh = this._ensure(plateKey, depth);
    if (!mesh) return false;

    const plate = PLATES[plateKey];

    // ── Fit: the painted opening must land ON the projected mouth ──────────
    // The opening occupies openL..openR of the plate, so the full plate is
    // wider than the mouth by exactly that ratio. Aspect is preserved and the
    // plate is bottom-anchored to the tunnel ground line, per the art spec.
    const openSpan  = plate.openR - plate.openL;
    const plateW    = mouthW / openSpan;
    const plateH    = plateW * PLATE_ASPECT;
    const plateLeft = outerL - plate.openL * plateW;
    const plateTop  = groundY - plateH;

    // ── Curve skew ─────────────────────────────────────────────────────────
    // The facade is a vertical plane crossing the roadway. On a curve the road
    // meets the camera at an angle, so the far jamb sits fractionally deeper
    // than the near one and the plate should lean rather than stay a flat
    // rectangle. `curve` is the accumulated lateral displacement; a small
    // fraction of it, applied as a horizontal offset that grows with height,
    // reproduces that lean without needing a full 3D transform. Clamped so a
    // hairpin can't fold the plate over itself.
    const lean = Math.max(-0.35, Math.min(0.35, curve * 0.0016));

    // ── Write vertices ─────────────────────────────────────────────────────
    // Reuses the existing Vertex objects — no per-frame allocation.
    const verts = mesh.vertices;
    let i = 0;
    for (let r = 0; r <= ROWS; r++) {
      const v = r / ROWS;                 // 0 at plate top, 1 at ground line
      const y = plateTop + plateH * v;
      // Height above the road, normalised — drives the lean.
      const hAbove = 1 - v;
      for (let c = 0; c <= COLS; c++, i++) {
        const u = c / COLS;
        const x = plateLeft + plateW * u + lean * plateW * hAbove;
        const vert = verts[i];
        if (!vert) continue;
        vert.x = x;
        vert.y = -y;                      // Mesh flips Y (vy = -(ty/tw)*height)
        vert.alpha = alpha;
      }
    }

    mesh.setDepth(depth);
    mesh.setVisible(true);
    mesh.setAlpha(alpha);
    return true;
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
