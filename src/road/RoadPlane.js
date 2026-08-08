import Phaser from 'phaser';
import { ROAD_WIDTH } from '../constants.js';
import { ROAD_MATERIALS } from './RoadMaterial.js';

/**
 * Textured road surface.
 *
 * Direct sibling of GroundPlane, and deliberately so — the ground layer had
 * already solved every hard problem this one has (world-anchored UVs, per-
 * segment quads driven by the road's OWN projection, perspective-correct
 * sub-rows, a distance fade, anisotropic filtering for a grazing-angle
 * plane).  Reusing that approach is what keeps the pavement locked to the
 * road through curves, crests and steering instead of swimming against it.
 *
 * Two things this does that GroundPlane doesn't:
 *
 *   1. The quad is bounded by the ROAD's own edges (centre ± half-width,
 *      plus the shoulder) rather than running the full screen width, and U
 *      is pinned to those edges.  The paved surface is a constant
 *      2 x ROAD_WIDTH world units wide at every depth, so U at the edge is a
 *      constant — the texture cannot stretch or shear through a curve.
 *
 *   2. It cross-fades TWO materials.  A region handoff (North Bend → the
 *      pass, the pass → Kittitas) dissolves one asphalt into the other over
 *      ten-plus miles.  Switching tiles on a single segment would put a hard
 *      line across the road, which is the exact artefact this work removes.
 *
 * The flat per-segment asphalt fill underneath stays as the base — it
 * carries the regional colour, the low-frequency tone and the weather, and
 * it is what shows through as the texture fades out toward the horizon.
 */

// ── Tile scale ────────────────────────────────────────────────────────────
// Same anisotropic world as GroundPlane: X and Z do NOT share a scale.
//   X — 2 x ROAD_WIDTH world units carry the 36 ft carriageway → 200 u/ft
//   Z — LANE_DASH_LEN(3) x SEG_LENGTH(200) = 600 u per 10 ft dash → 60 u/ft
const UNITS_PER_FT_X = 200;
const UNITS_PER_FT_Z = 60;

/**
 * Road covered by one tile, in feet.  This is the aggregate-SIZE knob: the
 * art is a fixed 1024 px, so a smaller footprint means each stone covers
 * fewer screen pixels.
 *
 * 32 ft was too coarse — the chip read as enlarged noise rather than as
 * asphalt, because it put one texel at ~0.37 in and a visible stone at
 * something closer to gravel.  19 ft shrinks every feature by 41% (inside the
 * requested 35-50%), landing a texel at ~0.22 in and a chip at a believable
 * 1/2 in or so.
 *
 * The trade is resolution: at 19 ft a tile spans ~810 px along the bottom
 * edge from a 1024 px source, so the near field now sits just inside
 * minification rather than magnification.  That is fine — it is exactly the
 * regime mipmaps and anisotropy are for, and it is why the distance fade
 * below had to come in earlier as well.
 *
 * Override live while tuning:  ?roadtile=19
 */
let TILE_FT = 19;
/** ?noroadtex — drop back to the flat asphalt fill, matching the other
 *  ?nomirror / ?nosprites / ?noeffects perf probes in GameScene. */
let DISABLED = false;
/**
 * ?roaddebug=<mode> — diagnostic surfaces for this layer.  OFF unless the
 * parameter is present, so none of it can reach a player.
 *
 *   red     flat red tile at FULL opacity.  Opaque, so overlap is invisible
 *           and any horizontal line that shows is a genuine GEOMETRY GAP
 *           between rows.
 *   reda    the same red tile at the layer's REAL alpha.  Overlap between
 *           rows double-composites here, so a banded ladder means rows are
 *           overlapping rather than tiling.
 *   uv      V-ramp with a hard red line at every whole V.  A red line at each
 *           segment boundary means V is restarting per segment; evenly spaced
 *           red lines unrelated to segments are the texture tiling correctly.
 *   rows    alternate rows tinted red/green — shows the row structure itself.
 */
let DEBUG = '';
try {
  const q = new URLSearchParams(window.location.search);
  const o = Number(q.get('roadtile'));
  if (Number.isFinite(o) && o > 0) TILE_FT = o;
  DISABLED = q.has('noroadtex');
  DEBUG = q.get('roaddebug') || '';
} catch (_) {}
const TILE_X = TILE_FT * UNITS_PER_FT_X;
const TILE_Z = TILE_FT * UNITS_PER_FT_Z;

// U at the road edge.  Constant at every depth — the carriageway is the same
// world width all the way to the horizon.
const U_EDGE = ROAD_WIDTH / TILE_X;

// ── Distance response ─────────────────────────────────────────────────────
// The spec's three bands, expressed as one alpha curve over world Z:
//   near      full aggregate and mottling
//   middle    reduced contrast (alpha falling)
//   horizon   gone — the flat base colour underneath is all that remains
//
// Fading out THIS early is also the anti-moiré measure.  With a 19 ft tile
// the surface passes one texel per pixel along Z only a few thousand units
// out, which is where a repeating aggregate starts to beat against the pixel
// grid.  Handing off to the flat fill well before the draw cap means the
// interference pattern never has a chance to form, and costs nothing
// visually — by then the road is a few pixels tall.
// 5000/20000 was ~330 ft of textured road: far too short.  Everything past it
// rendered as flat base colour, so a diverging offramp — which sits exactly at
// that depth — got no aggregate at all, and the boundary between textured near
// road and flat far road read as a SECOND, separate slab of roadway laid
// alongside the first.  Pushed out to ~800 ft so the handoff happens over a
// long enough run that there is no perceptible edge; FADE_POW still biases the
// falloff early, so the last stretch to the horizon stays essentially clean.
const FADE_Z0 = 9000;
const FADE_Z1 = 48000;
/** Exponent on the fade ramp.  >1 biases the falloff EARLY, so aggregate
 *  leaves the middle distance quickly and the last stretch to the horizon is
 *  essentially pure regional base colour — which is both what the eye expects
 *  and the cheapest possible anti-aliasing. */
const FADE_POW = 1.7;

/** Peak texture strength.  0.92 let the raw aggregate contrast through almost
 *  undiluted, which is what made the near field read as coarse grain sitting
 *  ON the road rather than as the road's own material.  At 0.66 the regional
 *  base carries the value and the tile supplies texture, not noise — measured
 *  at -34% near-field contrast against the old 32 ft / 0.92 combination. */
const STRENGTH = 0.66;

/** Max height in px of one textured sub-row — smaller = more perspective-
 *  correct V in the near field.  Matches GroundPlane. */
const SUB_H = 12;

export class RoadPlane extends Phaser.GameObjects.Image {
  constructor(scene) {
    super(scene, 0, 0, ROAD_MATERIALS.westside.key);
    this.setOrigin(0, 0).setScrollFactor(0);

    // Rows are pooled — this runs for every visible segment every frame, so
    // allocating per row would churn the GC exactly the way the road's own
    // boundary samples used to.
    this._rows     = [];
    this._rowCount = 0;
    this._playerZ  = 0;
    this._vBase    = 0;

    this._ready = new Set();
    this._warned = new Set();
  }

  /**
   * Diagnostic tile, generated once on demand.  Returns null when ?roaddebug
   * is absent, which is the only path a player can ever reach.
   */
  _debugKey() {
    if (!DEBUG || DEBUG === 'rows') return null;
    const key = `__roaddbg_${DEBUG}`;
    if (this.scene.textures.exists(key)) return key;

    const S = 1024;
    const cv = this.scene.textures.createCanvas(key, S, S);
    const c  = cv.getContext();
    if (DEBUG === 'red' || DEBUG === 'reda') {
      c.fillStyle = '#FF0000';
      c.fillRect(0, 0, S, S);
    } else if (DEBUG === 'uv') {
      // Smooth V ramp so any slope kink shows, plus a hard red line at V = 0
      // so a per-segment V restart is unmistakable.
      const grad = c.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, '#FFFFFF');
      c.fillStyle = grad;
      c.fillRect(0, 0, S, S);
      c.fillStyle = '#FF0000';
      c.fillRect(0, 0, S, 6);
      // U reference: a blue line down the middle of the tile.
      c.fillStyle = '#0080FF';
      c.fillRect(S / 2 - 3, 0, 6, S);
    }
    cv.refresh();
    return key;
  }

  /**
   * Per-material GL setup.  Same requirements as GroundPlane:
   *
   *   GL_REPEAT   so the tile actually tiles.  Set on BOTH axes, not just the
   *               world-Z one: U runs to ±0.65 at the shoulder edge, so a
   *               CLAMP on S would smear the tile's edge texels across the
   *               left half of every road.  The art is seamless, so wrapping
   *               both ways is free and needs no edge bleed.
   *   mipmaps     so the compressed far field doesn't crawl.  Phaser 3.90
   *               calls gl.generateMipmap for any power-of-two upload (see
   *               WebGLTextureWrapper.createResource), so the chain exists;
   *               this just selects it with LINEAR_MIPMAP_LINEAR + LINEAR mag.
   *   anisotropy  because a road is viewed at a grazing angle and compresses
   *               far harder along Z than across X.  Plain trilinear picks
   *               its mip off the worst axis and blurs the near field to mush.
   *
   * Retried until the source is on the GPU — a one-shot check leaves the
   * layer dead for the whole run if it lands before upload.
   */
  _prepare(key) {
    if (this._ready.has(key)) return true;
    const source = this.scene.textures.get(key)?.source?.[0];
    const gl     = this.scene.game.renderer?.gl;
    if (!source || !gl) return false;

    if (!source.isPowerOf2) {
      if (!this._warned.has(key)) {
        this._warned.add(key);
        console.warn(`[RoadPlane] "${key}" is ${source.width}x${source.height} — ` +
                     'not power-of-two, so GL_REPEAT is unavailable. Road texture disabled ' +
                     'for this material. Re-run scripts/buildRoadTextures.js.');
      }
      return false;
    }

    const t = source.glTexture;
    if (!t) return false;
    if (t.wrapS !== gl.REPEAT || t.minFilter !== gl.LINEAR_MIPMAP_LINEAR) {
      t.update(t.pixels, t.width, t.height, t.flipY,
               gl.REPEAT, gl.REPEAT,
               gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR, t.format);
    }

    const ext = gl.getExtension('EXT_texture_filter_anisotropic')
             || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
             || gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
    if (ext) {
      const max  = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      const prev = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, t.webGLTexture);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
      gl.bindTexture(gl.TEXTURE_2D, prev);
    }

    this._ready.add(key);
    return true;
  }

  /** Called once per frame by Road.render before any segment is drawn. */
  beginFrame(playerPos) {
    this._rowCount = 0;
    this._playerZ  = playerPos;
    // V comes from ABSOLUTE world Z, which reaches ~9.4e7 by Pullman.
    // Rebasing to a tile boundary near the camera keeps the numbers small:
    // the fragment shader is mediump on plenty of mobile GPUs, where a raw
    // world Z quantises the UV into visible banding.
    this._vBase = Math.floor(playerPos / TILE_Z) * TILE_Z;
  }

  /**
   * One segment's road quad.  `far` is the segment's own projection, `near`
   * is the segment one closer — matching Road._drawSegment's curr/next.
   *
   * @param eFar/eNear  shoulder width in px outboard of the carriageway, so
   *                    the paved shoulder is textured with the same asphalt.
   * @param matA/matB   ROAD_MATERIALS entries; matB may be null.
   * @param blend       0..1 crossfade from matA to matB.
   * @param baseFar/baseNear  the flat asphalt colour under this row.  The
   *                    texture is tinted by (base / material mean) so the
   *                    AVERAGE rendered pixel lands on the base colour and
   *                    the tile contributes only its deviation from it.
   * @param alphaMul    external suppression (snow cover, ghost pass).
   */
  pushRow(yFar, yNear, xFar, xNear, wFar, wNear, eFar, eNear,
          zFar, zNear, matA, matB, blend, baseFar, baseNear, alphaMul = 1) {
    if (DISABLED) return;
    if (zFar <= 0 || zNear <= 0) return;
    if (wFar <= 0 || wNear <= 0) return;
    if (alphaMul <= 0.004) return;
    if (yNear <= yFar) return;
    // Wholly past the fade — the flat fill already covers it, so emitting the
    // quad would burn vertices on invisible geometry.
    if (zNear >= FADE_Z1) return;

    let r = this._rows[this._rowCount];
    if (!r) r = this._rows[this._rowCount] = {};
    r.yF = yFar;  r.yN = yNear;
    r.xF = xFar;  r.xN = xNear;
    r.wF = wFar;  r.wN = wNear;
    r.eF = eFar;  r.eN = eNear;
    r.zF = zFar;  r.zN = zNear;
    r.mA = matA;  r.mB = matB;  r.bl = matB ? blend : 0;
    r.cF = baseFar; r.cN = baseNear;
    r.a  = alphaMul;
    this._rowCount++;
  }

  renderWebGL(renderer, src, camera) {
    if (this._rowCount === 0) return;

    const pipeline = renderer.pipelines.set(this.pipeline, this);
    renderer.pipelines.preBatch(this);

    const DBG_KEY = this._debugKey();

    const camAlpha = this.alpha * camera.alpha;
    // Screen-space coords go through the camera matrix by hand — the shake /
    // tilt the camera applies has to move this layer with everything else.
    //
    // CAMERA SCROLL, TOO.  The world camera is scrolled by -HUD_OFFSET_X to
    // centre the world on a widened canvas, and every scrollFactor-1 object
    // (roadGfx, terrainGfx — all the Graphics) is shifted by that scroll when
    // it renders.  This custom pipeline applies only camera.matrix, which does
    // NOT carry scroll — scroll is a per-object factor — so without the terms
    // below the texture layer sat HUD_OFFSET_X px to the left of the road it
    // belongs to.  On the road tile that painted an untextured band down the
    // right side of every carriageway ("texture missing on half the road"),
    // sized by the device aspect: ~70 px on a 940 px canvas, wider on phones.
    // The ground tile had the same shift all along, invisible only because a
    // seamless roadside field has no reference edges.
    const cm = camera.matrix;
    const ma = cm.a, mb = cm.b, mc = cm.c, md = cm.d, me = cm.e, mf = cm.f;
    const sX = camera.scrollX, sY = camera.scrollY;

    // TWO PASSES, not two interleaved textures per row.
    //
    // Pass 0 lays every row's PRIMARY material; pass 1 lays the secondary on
    // top only where a crossfade is active.  Rows never overlap in screen Y,
    // so their relative order within a pass is irrelevant — which means each
    // pass binds at most a couple of textures for the whole frame instead of
    // thrashing the batch once per row.
    //
    // Alpha algebra for the crossfade.  Target is
    //     out = (1-a)*base + a*[ (1-t)*A + t*B ]
    // drawing A first at aA, then B over it at aB:
    //     aB = a*t          aA = a*(1-t) / (1 - a*t)
    // which reproduces the target exactly (the base coefficient falls out at
    // 1-a).  At t=0 that is plain A at a; at t=1 it is plain B at a.
    for (let pass = 0; pass < 2; pass++) {
      let boundKey = null;
      let unit = 0;
      let mean = null;

      for (let i = 0; i < this._rowCount; i++) {
        const r = this._rows[i];
        const t = r.bl;
        if (pass === 1 && t <= 0.001) continue;

        const mat = pass === 0 ? r.mA : r.mB;
        if (!mat) continue;
        // ?roaddebug swaps in a diagnostic tile; DBG_KEY is null in a normal run.
        const texKey = DBG_KEY ?? mat.key;
        if (!this._prepare(texKey)) continue;

        const h = r.yN - r.yF;
        if (h <= 0) continue;

        if (texKey !== boundKey) {
          if (boundKey !== null) pipeline.flush();
          const glTexture = this.scene.textures.get(texKey)?.source?.[0]?.glTexture;
          if (!glTexture) continue;
          unit = pipeline.setTexture2D(glTexture);
          boundKey = texKey;
          mean = mat.mean;
        }

        const invF = 1 / r.zF;
        const invN = 1 / r.zN;
        const dInv = invN - invF;
        const dx   = r.xN - r.xF;
        const dw   = r.wN - r.wF;
        const de   = r.eN - r.eF;
        const steps = h > SUB_H ? Math.ceil(h / SUB_H) : 1;

        // Screen Y is linear in 1/z for ground-plane points, and the road's
        // trapezoid edges are straight lines between far and near corners —
        // so interpolating invZ, centre X and half-width linearly in the
        // sub-row fraction reproduces the road's geometry exactly.
        let yPrev = r.yF, xPrev = r.xF, wPrev = r.wF, ePrev = r.eF, zPrev = r.zF;

        for (let s = 1; s <= steps; s++) {
          const f = s / steps;
          const y = r.yF + h * f;
          const x = r.xF + dx * f;
          const w = r.wF + dw * f;
          const e = r.eF + de * f;
          const z = 1 / (invF + dInv * f);

          const aRawT = camAlpha * r.a * STRENGTH * fadeAt(zPrev);
          const aRawB = camAlpha * r.a * STRENGTH * fadeAt(z);
          const aTop  = pass === 0 ? aRawT * (1 - t) / Math.max(1e-4, 1 - aRawT * t) : aRawT * t;
          const aBot  = pass === 0 ? aRawB * (1 - t) / Math.max(1e-4, 1 - aRawB * t) : aRawB * t;

          if (aTop > 0.002 || aBot > 0.002) {
            // V from absolute world Z, rebased per quad so both edges land in
            // [0, 2).  A quad only ever spans a fraction of a tile, so this is
            // lossless — and it keeps mediump shaders from banding.
            let vTop = (this._playerZ - this._vBase + zPrev) / TILE_Z;
            let vBot = (this._playerZ - this._vBase + z) / TILE_Z;
            const vWrap = Math.floor(vBot);
            vTop -= vWrap;
            vBot -= vWrap;

            // U at the painted edge scales with how far the shoulder reaches
            // past the carriageway, so shoulder asphalt is the same continuous
            // surface rather than a separately-mapped strip.
            const uT = U_EDGE * (wPrev + ePrev) / wPrev;
            const uB = U_EDGE * (w + e) / w;

            const xLT = xPrev - (wPrev + ePrev), xRT = xPrev + (wPrev + ePrev);
            const xLB = x - (w + e),             xRB = x + (w + e);

            let tintTop, tintBot;
            if (DEBUG) {
              // 'red' is opaque so only real geometry gaps show; every other
              // mode keeps the layer's true alpha so compositing is honest.
              const da = DEBUG === 'red' ? 1 : aTop;
              const db = DEBUG === 'red' ? 1 : aBot;
              const col = DEBUG === 'rows'
                ? ((i & 1) ? 0xFF3030 : 0x30FF30)
                : 0xFFFFFF;
              tintTop = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(col, da);
              tintBot = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(col, db);
            } else {
              tintTop = tintFor(r.cF, mean, aTop);
              tintBot = tintFor(r.cN, mean, aBot);
            }

            // Mirrors WebGLPipeline.batchQuad's flush handling — a flush drops
            // the current batch, so the texture unit has to be re-pushed.
            if (pipeline.shouldFlush(6)) {
              pipeline.flush();
              unit = pipeline.setTexture2D(
                this.scene.textures.get(texKey).source[0].glTexture);
            }

            const yT = yPrev - sY, yB = y - sY;
            const lT = xLT - sX, rT = xRT - sX, lB = xLB - sX, rB = xRB - sX;
            const tlx = lT * ma + yT * mc + me, tly = lT * mb + yT * md + mf;
            const blx = lB * ma + yB * mc + me, bly = lB * mb + yB * md + mf;
            const brx = rB * ma + yB * mc + me, bry = rB * mb + yB * md + mf;
            const trx = rT * ma + yT * mc + me, try_ = rT * mb + yT * md + mf;

            pipeline.batchVert(tlx, tly, -uT, vTop, unit, 0, tintTop);
            pipeline.batchVert(blx, bly, -uB, vBot, unit, 0, tintBot);
            pipeline.batchVert(brx, bry,  uB, vBot, unit, 0, tintBot);
            pipeline.batchVert(tlx, tly, -uT, vTop, unit, 0, tintTop);
            pipeline.batchVert(brx, bry,  uB, vBot, unit, 0, tintBot);
            pipeline.batchVert(trx, try_, uT, vTop, unit, 0, tintTop);
          }

          yPrev = y; xPrev = x; wPrev = w; ePrev = e; zPrev = z;
        }
      }
      if (boundKey !== null) pipeline.flush();
    }

    renderer.pipelines.postBatch(this);
  }

  /** Canvas fallback paints nothing — the flat asphalt fill is the whole look. */
  renderCanvas() {}
}

/**
 * Tint that makes the tile average out to `base`.
 *
 * The GPU multiplies texture RGB by tint RGB, so a tile whose mean is 0.29
 * rendered at tint 1.0 comes out at 29% of the intended asphalt value — near
 * black.  Dividing the target colour by the tile's measured mean cancels
 * that: mean texel x (base/mean) = base, and every texel above or below the
 * mean becomes proportional lightening or darkening around it.
 *
 * Channels are clamped at 1 because the tint is an 8-bit multiply and cannot
 * brighten past white; a base far above the tile mean simply saturates, which
 * is the correct behaviour for a snow-blanketed road.
 */
function tintFor(base, mean, alpha) {
  const r = Math.min(1, ((base >> 16) & 0xff) / 255 / mean.r);
  const g = Math.min(1, ((base >>  8) & 0xff) / 255 / mean.g);
  const b = Math.min(1, ( base        & 0xff) / 255 / mean.b);
  const c = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  return Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(c, alpha);
}

function fadeAt(z) {
  if (z <= FADE_Z0) return 1;
  if (z >= FADE_Z1) return 0;
  const t = (z - FADE_Z0) / (FADE_Z1 - FADE_Z0);
  const smooth = 1 - t * t * (3 - 2 * t);   // no hard edge at either end
  return Math.pow(smooth, FADE_POW);        // biased early — see FADE_POW
}
