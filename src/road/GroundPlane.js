import Phaser from 'phaser';
import { SCREEN_W, ROAD_WIDTH } from '../constants.js';
import * as C from '../constants.js';

/**
 * Textured roadside ground.
 *
 * The flat per-segment grass rect in Road._drawSegment stays exactly where it
 * was — it carries the biome / snow colour and is the fail-safe if the tile
 * can't repeat on this GPU.  This object paints a seamless ground tile OVER
 * that fill, in the depth slot the terrain/road split opened (terrainGfx 1 →
 * here 1.1 → nb plate 1.25 → roadGfx 1.5), and fades back to the flat colour
 * before the horizon.
 *
 * Geometry comes from the road's OWN per-segment projection rather than a
 * separate ground plane, which is what makes the texture track hills, crests
 * and curves instead of sliding against them.  Each segment contributes one
 * quad, subdivided by depth so the UVs stay perspective-correct (an
 * un-subdivided near-field quad interpolates UV affinely and gives the classic
 * PS1 texture warp).
 */

// ── World scale ───────────────────────────────────────────────────────────
// The pseudo-3D world is ANISOTROPIC — X and Z do NOT share a scale — so a
// square tile laid down at equal world sizes renders visibly stretched.  Both
// scales are pinned to real dimensions already baked into the game:
//
//   Z — LANE_DASH_LEN (3) segments x SEG_LENGTH (200) = 600 units per dash,
//       and the US standard highway dash is 10 ft   ->  60 units / ft.
//   X — the paved surface spans x +/- w, i.e. 2 x ROAD_WIDTH = 7200 units,
//       carrying LANES (3) at 12 ft = 36 ft         -> 200 units / ft.
//
// Z is therefore compressed ~3.3x relative to X.  Sizing the tile in FEET and
// converting through both scales is what keeps the ground reading as ground.
const UNITS_PER_FT_X = 200;
const UNITS_PER_FT_Z = 60;

/**
 * How much real ground one tile covers, in feet.  The one knob that matters.
 *
 * This is a RESOLUTION constraint as much as an art choice.  The game renders
 * at SCREEN_W x SCREEN_H (940x450 with the decoupled width) and is then
 * upscaled ~4.6x to a retina display.  At the screen bottom there are ~4.7
 * world units per rendered pixel, so:
 *
 *     tile width on screen = TILE_FT * UNITS_PER_FT_X / 4.7  px
 *
 * At 6 ft that is ~254 px drawn from a 1024 px source — 4x minification, so
 * the GPU samples mip level 2 and the upscale then magnifies the blur.  The
 * result read as a flat olive wash with no detail at all.  At 48 ft the tile
 * covers ~2030 px and is sampled at mip 0, which is what makes the art
 * legible.  Feature size stays honest: a clump in the tile lands around 3-4 ft,
 * which is right for eastern-WA bunchgrass and sage.
 *
 * Override live for tuning a new biome tile:  ?tile=48
 */
let TILE_FT = 48;
try {
  const o = Number(new URLSearchParams(window.location.search).get('tile'));
  if (Number.isFinite(o) && o > 0) TILE_FT = o;
} catch (_) {}
const TILE_X  = TILE_FT * UNITS_PER_FT_X;
const TILE_Z  = TILE_FT * UNITS_PER_FT_Z;

// Distance fade, in world Z units — full texture to FADE_Z0, gone by FADE_Z1.
//
// These now sit BEYOND the render distance (DRAW_DIST x SEG_LENGTH = 76,000),
// i.e. the ground stays fully opaque all the way to the horizon.  That is
// deliberate and load-bearing:
//
// The original 6k/22k fade revealed the flat terrain fill underneath, which
// was fine while this layer sat BELOW the North Bend plate.  Now that it sits
// ABOVE the plate (to kill the floating road), anything it fades out reveals
// the PLATE — so the mountains showed through the ground in the ~14 px band
// just under the horizon, where relZ exceeds 22,000.
//
// Shimmer was the reason for the fade, and mipmapping is the proper fix for
// it: a sub-pixel-compressed tile resolves to a high mip level, which is
// essentially its average colour and is stable frame to frame.  That is what
// the trilinear + anisotropic setup in enableRepeatWrap() buys.
const FADE_Z0 = 90000;
const FADE_Z1 = 140000;

/** Max height in px of one textured sub-row.  Smaller = more perspective-
 *  correct UVs in the near field, at ~1 extra quad per 12 px of screen. */
const SUB_H = 12;

/**
 * Per-biome ground tiles.  Every biome falls back to the PNW tile until real
 * art exists for it — drop a new tile in assets/scenery/ground_textures/final/,
 * register the key in AssetManifest.groundTextures, and add ONE line here.
 */
export const GROUND_TILES = {
  _default: 'ground_pnw_roadside',
};

export class GroundPlane extends Phaser.GameObjects.Image {
  constructor(scene, textureKey = GROUND_TILES._default) {
    super(scene, 0, 0, textureKey);
    this.setOrigin(0, 0).setScrollFactor(0);

    // Rows are pooled and reused — this runs every frame for every visible
    // segment, so allocating here would churn the GC.
    this._rows     = [];
    this._rowCount = 0;
    this._playerZ  = 0;
    this._vBase    = 0;

    // Same margin the road uses for its ground fills, so the texture reaches
    // the same edges the flat fill does under sway / tilt / a wide canvas.
    // Re-read each frame: HUD_OFFSET_X is mutable and tracks canvas resizes.
    this._margin = 150;

    this._ok = GroundPlane.enableRepeatWrap(scene, textureKey);
  }

  /**
   * Switch the active tile.  One texture per frame keeps the whole ground in a
   * single batch; a biome boundary is a hard cut until there is art worth
   * cross-fading between.
   */
  setTile(key) {
    if (!key || key === this.texture.key) return;
    if (!this.scene.textures.exists(key)) return;
    this.setTexture(key);
    this._ok = GroundPlane.enableRepeatWrap(this.scene, key);
  }

  /**
   * A ground tile has to wrap, and Phaser uploads textures CLAMP_TO_EDGE by
   * default — without this the tile would stretch its edge pixels across the
   * entire roadside.  GL_REPEAT needs a power-of-two texture on WebGL1, so a
   * non-POT tile disables the layer rather than rendering black.
   *
   * Trilinear filtering is set at the same time: Phaser auto-generates
   * mipmaps for POT textures, and without them the minified far field aliases
   * into crawling noise.
   */
  static enableRepeatWrap(scene, key) {
    const source = scene.textures.get(key)?.source?.[0];
    const gl     = scene.game.renderer?.gl;
    if (!source || !gl) return false;

    if (!source.isPowerOf2) {
      console.warn(`[GroundPlane] "${key}" is ${source.width}x${source.height} — ` +
                   'not power-of-two, so GL_REPEAT is unavailable. Ground texture disabled.');
      return false;
    }

    const t = source.glTexture;
    if (!t) return false;
    if (t.wrapS === gl.REPEAT && t.minFilter === gl.LINEAR_MIPMAP_LINEAR) return true;

    t.update(t.pixels, t.width, t.height, t.flipY,
             gl.REPEAT, gl.REPEAT,
             gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR, t.format);

    // Anisotropic filtering.  A ground plane is viewed at a grazing angle, so
    // the texture compresses far harder along the road than across it.  Plain
    // trilinear picks its mip from the WORST axis and blurs the near field to
    // mush; anisotropy samples the two axes independently and is the
    // difference between "ground" and "brown smear" here.
    const ext = gl.getExtension('EXT_texture_filter_anisotropic')
             || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
             || gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
    if (ext) {
      const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      const prev = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, t.webGLTexture);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
      gl.bindTexture(gl.TEXTURE_2D, prev);
    }
    return true;
  }

  /** Called once per frame by Road.render before any segment is drawn. */
  beginFrame(playerPos) {
    this._rowCount = 0;
    this._playerZ  = playerPos;
    this._margin   = 150 + Math.ceil(C.HUD_OFFSET_X);
    // Texture V is derived from ABSOLUTE world Z, which reaches ~9.4e7 at the
    // end of the route.  Anchoring it to a tile boundary near the camera keeps
    // the numbers small — the fragment shader is mediump on plenty of mobile
    // GPUs, where a raw world Z would quantise the UV into visible banding.
    this._vBase = Math.floor(playerPos / TILE_Z) * TILE_Z;
  }

  /**
   * One road segment's ground quad.  `far` is the segment's own projection,
   * `near` is the segment one closer — matching Road._drawSegment's curr/next.
   */
  pushRow(yFar, yNear, xFar, xNear, wFar, wNear, zFar, zNear, alphaMul = 1) {
    if (!this._ok) return;
    if (zFar <= 0 || zNear <= 0) return;
    if (wFar <= 0 || wNear <= 0) return;
    if (alphaMul <= 0.004) return;
    // Wholly past the fade — the flat fill already covers this, so emitting
    // the quad would just burn vertices on invisible geometry.
    if (zNear >= FADE_Z1) return;

    let r = this._rows[this._rowCount];
    if (!r) r = this._rows[this._rowCount] = {};
    r.yF = yFar;  r.yN = yNear;
    r.xF = xFar;  r.xN = xNear;
    r.wF = wFar;  r.wN = wNear;
    r.zF = zFar;  r.zN = zNear;
    r.a  = alphaMul;
    this._rowCount++;
  }

  renderWebGL(renderer, src, camera) {
    if (!this._ok || this._rowCount === 0) return;

    const glTexture = this.frame.glTexture;
    if (!glTexture) return;

    const pipeline = renderer.pipelines.set(this.pipeline, this);
    renderer.pipelines.preBatch(this);
    let unit = pipeline.setTexture2D(glTexture);

    // Screen-space coords go through the camera matrix by hand — the shake /
    // tilt the camera applies has to move the ground with everything else.
    const cm = camera.matrix;
    const ma = cm.a, mb = cm.b, mc = cm.c, md = cm.d, me = cm.e, mf = cm.f;

    const alphaMul = this.alpha * camera.alpha;
    const xL = -this._margin;
    const xR = SCREEN_W + this._margin;
    // Screen px -> world X: a segment's half-width `w` on screen spans
    // ROAD_WIDTH world units, measured out from the road centreline.  Anchoring
    // U to the centreline (not to the screen) is what makes the ground sweep
    // through curves with the road and slide sideways as the player steers.
    const kx = ROAD_WIDTH / TILE_X;
    const pz = this._playerZ - this._vBase;

    for (let i = 0; i < this._rowCount; i++) {
      const r = this._rows[i];
      const h = r.yN - r.yF;
      if (h <= 0) continue;

      const invF = 1 / r.zF;
      const invN = 1 / r.zN;
      const dInv = invN - invF;
      const dx   = r.xN - r.xF;
      const dw   = r.wN - r.wF;
      const steps = h > SUB_H ? Math.ceil(h / SUB_H) : 1;

      // Screen Y is linear in 1/z for ground-plane points, and the road's own
      // trapezoid edges are straight lines between far and near corners — so
      // interpolating invZ, centre X and half-width linearly in the sub-row
      // fraction reproduces the road's geometry exactly.
      let tPrev = 0;
      let yPrev = r.yF, xPrev = r.xF, wPrev = r.wF, zPrev = r.zF;

      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const y = r.yF + h * t;
        const x = r.xF + dx * t;
        const w = r.wF + dw * t;
        const z = 1 / (invF + dInv * t);

        const aTop = alphaMul * r.a * fadeAt(zPrev);
        const aBot = alphaMul * r.a * fadeAt(z);

        if (aTop > 0.002 || aBot > 0.002) {
          // V from absolute world Z, then rebased per quad so both edges land
          // in [0, 2).  A quad only ever spans a fraction of a tile, so this
          // is lossless — and it keeps mediump shaders from banding.
          let vTop = (pz + zPrev) / TILE_Z;
          let vBot = (pz + z) / TILE_Z;
          const vWrap = Math.floor(vBot);
          vTop -= vWrap;
          vBot -= vWrap;

          const uLT = (xL - xPrev) * kx / wPrev;
          const uRT = (xR - xPrev) * kx / wPrev;
          const uLB = (xL - x) * kx / w;
          const uRB = (xR - x) * kx / w;

          const tintTop = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(0xffffff, aTop);
          const tintBot = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(0xffffff, aBot);

          // Mirrors WebGLPipeline.batchQuad's flush handling — a flush drops
          // the current batch, so the texture unit has to be re-pushed.
          if (pipeline.shouldFlush(6)) {
            pipeline.flush();
            unit = pipeline.setTexture2D(glTexture);
          }

          const tlx = xL * ma + yPrev * mc + me, tly = xL * mb + yPrev * md + mf;
          const blx = xL * ma + y     * mc + me, bly = xL * mb + y     * md + mf;
          const brx = xR * ma + y     * mc + me, bry = xR * mb + y     * md + mf;
          const trx = xR * ma + yPrev * mc + me, try_ = xR * mb + yPrev * md + mf;

          pipeline.batchVert(tlx, tly, uLT, vTop, unit, 0, tintTop);
          pipeline.batchVert(blx, bly, uLB, vBot, unit, 0, tintBot);
          pipeline.batchVert(brx, bry, uRB, vBot, unit, 0, tintBot);
          pipeline.batchVert(tlx, tly, uLT, vTop, unit, 0, tintTop);
          pipeline.batchVert(brx, bry, uRB, vBot, unit, 0, tintBot);
          pipeline.batchVert(trx, try_, uRT, vTop, unit, 0, tintTop);
        }

        tPrev = t; yPrev = y; xPrev = x; wPrev = w; zPrev = z;
      }
    }

    renderer.pipelines.postBatch(this);
  }

  /** Canvas fallback paints nothing — the flat grass fill is the whole look. */
  renderCanvas() {}
}

function fadeAt(z) {
  if (z <= FADE_Z0) return 1;
  if (z >= FADE_Z1) return 0;
  const t = (z - FADE_Z0) / (FADE_Z1 - FADE_Z0);
  return 1 - t * t * (3 - 2 * t);   // smoothstep — no hard edge at either end
}
