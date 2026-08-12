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
// GROUND NOW RUNS TO THE DRAW CAP (owner 2026-08-11: "make it so the ground
// tiles extend to the horizon").  It used to fade 52k -> 70k against a 76,000
// unit cap, so the final 6,000 units of road that DID get drawn carried no
// ground texture at all, and 18k units handed off to the flat terrain fill.
// That handoff is the seam family chased all day: the flat fill is grass2
// blended toward skyFogMix, so wherever the two disagreed it read as a
// coloured bar tracking the sky.  Texturing to the cap removes the handoff
// rather than trying to colour-match across it.
//
// Derived from DRAW_DIST rather than hardcoded, so raising the draw distance
// automatically carries the ground with it instead of silently re-opening a
// 6k gap.
//
// The feather is kept, just short.  The original 18k fade existed because at
// grazing-angle compression the last one or two rows can sample outside the
// useful mip footprint and flash a pure-black horizon strip; FEATHER_Z is the
// insurance against that.  If a black line ever appears at the horizon, widen
// it — that is the knob, and it is the ONLY reason not to go flat to the cap.
const DRAW_CAP_Z = C.DRAW_DIST * C.SEG_LENGTH;   // 380 * 200 = 76,000
const FEATHER_Z  = 6000;
const FADE_Z0 = DRAW_CAP_Z - FEATHER_Z;          // 70,000 — full texture to here
const FADE_Z1 = DRAW_CAP_Z;                      // 76,000 — the last drawn row

/** Max height in px of one textured sub-row.  Smaller = more perspective-
 *  correct UVs in the near field, at ~1 extra quad per 12 px of screen. */
const SUB_H = 12;

/** Columns per sub-row on the CROSS-FADE pass only. The base pass stays one
 *  full-width quad. 8 is enough for the noise to read as patches rather than
 *  a stepped edge, and only costs anything while a transition is on screen. */
const X_STEPS = 8;

/**
 * Per-biome ground tiles.  Every biome falls back to the PNW tile until real
 * art exists for it — drop a new tile in assets/scenery/ground_textures/final/,
 * register the key in AssetManifest.groundTextures, and add ONE line here.
 */
export const GROUND_TILES = {
  _default: 'ground_pnw_roadside',

  // Keyed by BIOME key from src/road/Biomes.js.  `westside_forest_2` resolves
  // to `westside_forest` before it gets here (biomeAt returns texOf), so it
  // needs no entry of its own.
  // seattle_hills spans mi 0-20, crossing five region palettes (seattle_urban,
  // downtown_seattle, mercer_island, eastside_urban, eastside).  This tile
  // averages rgb(53,55,29), within delta 42 of every one of their grass2
  // values, so the GroundPlane->flat-fill handoff stays invisible across all
  // of them.  Before it existed the urban miles fell back to the PNW tile.
  seattle_hills:      'ground_seattle',
  westside_forest:    'ground_pnw_roadside',
  north_bend:         'ground_north_bend',
  pass_alpine:        'ground_pass_alpine',
  easton_transition:  'ground_easton',
  kittitas_foothills: 'ground_kittitas',
  vantage_basalt:     'ground_vantage_basalt',
  columbia_irrigated: 'ground_columbia',
  palouse_hills:      'ground_palouse',
};

/**
 * Texture key for a biome, falling back to the PNW tile.
 *
 * The fallback is load-bearing, not defensive politeness: `setTile` ignores a
 * key with no loaded texture, so a biome whose art hasn't shipped keeps
 * whatever tile was already up rather than going untextured.  Resolving to
 * `_default` here instead makes that case an explicit, visible choice.
 */
export function groundTileFor(biomeKey) {
  return GROUND_TILES[biomeKey] ?? GROUND_TILES._default;
}

// ── Snoqualmie roadside snow accumulation ────────────────────────────────
//
// Snow builds up on the terrain BESIDE the road across the climb, rather than
// the roadside flipping from bare to white at one mile. Four stages of the same
// ground, cross-faded a pair at a time.
//
// This is roadside ONLY. The roadway's own snow (Weather.state/intensity, the
// windshield build-up, traction) is untouched and keeps its own timing.
//
// MILES are chosen against what already exists: Weather puts snow on the road
// from mile 40, the `pass_alpine` biome runs 45-58, and the summit rest stop is
// at 53. The roadside therefore starts at 36 — deliberately BEFORE the road
// turns snowy, so the first patches appear in the verge while the asphalt is
// still wet, which is how a real climb reads.
//
// HOLD/END mirror the ROAD's blanket (Road.snowBlanketAt: full to 86, eased
// out 86-88).  An earlier version melted the roadside out at 68 to hand the
// east slope back to the easton tile — but the road stays an unbroken white
// sheet until 86, and bare dirt beside a fully snowed-over road read as a bug.
// The two systems stay decoupled in code, but they must agree on WHEN.
//
// A PURE FUNCTION OF MILE, deliberately: accumulation rises on the way up and
// falls on the way down with no stored state, so previewing, warping, or
// running the route backwards all behave correctly.
const SNOW_MI_START = 36;   // first patches (road snow starts at 40)
const SNOW_MI_FULL  = 50;   // fully accumulated by here
const SNOW_MI_HOLD  = 86;   // …held while the road blanket holds
const SNOW_MI_END   = 88;   // melted out with the road (snowBlanketAt 86→88)

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Normalised roadside accumulation, 0..1, from route mile. */
export function snowAmountAt(mile) {
  if (!(mile > SNOW_MI_START) || mile >= SNOW_MI_END) return 0;
  if (mile < SNOW_MI_FULL) {
    return smooth(clamp01((mile - SNOW_MI_START) / (SNOW_MI_FULL - SNOW_MI_START)));
  }
  if (mile <= SNOW_MI_HOLD) return 1;
  return smooth(clamp01((SNOW_MI_END - mile) / (SNOW_MI_END - SNOW_MI_HOLD)));
}

// Stage boundaries on the 0..1 accumulation. Between two stops the pair is
// cross-faded; at a stop a single texture is drawn on its own (no second pass).
const SNOW_STAGES = [
  { at: 0.00, key: 'ground_pass_alpine' },   // exposed alpine grass / gravel
  { at: 0.35, key: 'ground_snoq_light'   },  // scattered early accumulation
  { at: 0.60, key: 'ground_snoq_partial' },  // ~55-65% covered
  { at: 0.85, key: 'ground_snoq_full'    },  // continuous, twigs showing through
];

/**
 * Which two tiles to draw, and how far between them, for an accumulation and
 * the biome tile that would otherwise be showing.
 *
 * THE BASE IS NEVER OVERRIDDEN OUTSIDE pass_alpine, and that constraint drives
 * the whole shape of this function. The accumulation window (36-88) is wider
 * than the pass_alpine biome (45-58) on purpose — snow should appear before the
 * climb and hold as long as the road blanket does — but the lead-in crosses
 * north_bend and westside_forest, and the hold and melt-out cross
 * easton_transition and kittitas_foothills. Swapping the base to the alpine
 * tile at mile 36 would change the entire roadside in one frame, which is
 * precisely the pop this feature exists to remove.
 *
 * So there are two regimes:
 *   • ON the alpine tile — the full four-stage progression, cross-fading a pair
 *     at a time. Stage 1 IS the alpine tile, so the base already matches what
 *     the biome was drawing and nothing swaps.
 *   • ANYWHERE ELSE — the biome keeps its own tile and early/late snow is laid
 *     over it as a dusting of the LIGHT stage only, capped below full coverage.
 *     Patches of snow on forest ground on the way up, and lingering patches on
 *     the east slope, without either biome losing its identity.
 */
// Below this the biome keeps its own tile and snow is a dusting on top; above
// it the snow tiles own the base and run the four-stage progression.
//
// The threshold is what keeps the handoff AWAY from a biome boundary. The
// accumulation window (36-88) is deliberately wider than pass_alpine (45-58),
// so an earlier design that switched regime at the biome edge swapped the whole
// roadside at mile 45 (forest -> partial snow) and again at 58 (full snow ->
// bare easton) — the second one worse than the pop this feature exists to
// remove. Handing over on ACCUMULATION instead puts both swaps around a = 0.35,
// at roughly mi 41.5 on the climb and mi 87.2 in the melt-out, where each side
// is light-snow-dominant and the change is small.
const DUST_HANDOFF = 0.35;
// 1.0, not a partial value, and that is what makes the handoff INVISIBLE:
// just below the threshold the light tile is already at full coverage over the
// biome, so promoting it to the base with the next overlay at t=0 renders the
// identical image. Capping it lower (0.55 was tried) left a visible 45% step at
// the one place the regime changes.
const DUST_MAX     = 1.0;

export function snowGroundAt(amount, biomeTileKey = 'ground_pass_alpine') {
  const a = clamp01(amount);
  if (a <= 0) return { base: biomeTileKey, overlay: null, t: 0 };

  // Lead-in and melt-out: the biome keeps its identity, snow sits on top.
  if (a < DUST_HANDOFF) {
    return { base: biomeTileKey, overlay: 'ground_snoq_light',
             t: (a / DUST_HANDOFF) * DUST_MAX };
  }

  // Accumulated: the snow tiles own the base, cross-fading a pair at a time.
  for (let i = 1; i < SNOW_STAGES.length - 1; i++) {
    const lo = SNOW_STAGES[i], hi = SNOW_STAGES[i + 1];
    if (a < hi.at) {
      return { base: lo.key, overlay: hi.key, t: clamp01((a - lo.at) / (hi.at - lo.at)) };
    }
  }
  return { base: SNOW_STAGES[SNOW_STAGES.length - 1].key, overlay: null, t: 0 };
}

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
    // The Image can be constructed before Phaser has uploaded its source to
    // WebGL.  The old one-shot check then left `_ok` false forever, producing
    // flat-colour shoulders for the entire run (especially common on mobile).
    // Retry until the texture exists on the GPU; after success this is free.
    if (!this._ok) this._ok = GroundPlane.enableRepeatWrap(this.scene, this.texture.key);
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

  /** Swap in the SECOND tile of a cross-fade. `t` is 0..1 coverage of it.
   *  Passing a null key (or t<=0) puts the layer back to a single-texture draw,
   *  which costs exactly what it did before this feature existed. */
  setBlend(overlayKey, t) {
    if (!overlayKey || !(t > 0) || !this.scene.textures.exists(overlayKey)) {
      this._overlayKey = null;
      this._blendT = 0;
      return;
    }
    if (overlayKey !== this._overlayKey) {
      this._overlayKey = overlayKey;
      // Same GL_REPEAT + anisotropy the base tile gets — a cross-fade against
      // a clamped texture would show one stretched edge pixel smeared out.
      this._overlayOk = GroundPlane.enableRepeatWrap(this.scene, overlayKey);
    }
    if (!this._overlayOk) this._overlayOk = GroundPlane.enableRepeatWrap(this.scene, this._overlayKey);
    this._blendT = t > 1 ? 1 : t;
  }

  renderWebGL(renderer, src, camera) {
    if (!this._ok || this._rowCount === 0) return;
    const glTexture = this.frame.glTexture;
    if (!glTexture) return;

    const pipeline = renderer.pipelines.set(this.pipeline, this);
    renderer.pipelines.preBatch(this);

    // Base tile, exactly as before: one full-width quad per sub-row.
    this._batchLayer(pipeline, camera, glTexture, 0);

    // Second tile of a cross-fade, masked by world-space noise. Skipped
    // entirely outside a transition, so the common case is unchanged.
    if (this._overlayKey && this._overlayOk && this._blendT > 0.002) {
      const ovFrame = this.scene.textures.getFrame(this._overlayKey);
      if (ovFrame?.glTexture) {
        this._batchLayer(pipeline, camera, ovFrame.glTexture, this._blendT);
      }
    }

    renderer.pipelines.postBatch(this);
  }

  /**
   * Emit every queued row for one texture.
   *
   * `dissolve` 0 = the opaque base pass (one quad per sub-row, full width).
   * `dissolve` > 0 = the overlay pass, which additionally splits each sub-row
   * into X_STEPS columns so the mask can vary ACROSS the road as well as along
   * it. Without that split the alpha could only change with depth and every
   * transition would be a straight line running across the screen — exactly
   * the artefact this feature has to avoid.
   */
  _batchLayer(pipeline, camera, glTexture, dissolve) {
    let unit = pipeline.setTexture2D(glTexture);

    const cm = camera.matrix;
    const ma = cm.a, mb = cm.b, mc = cm.c, md = cm.d, me = cm.e, mf = cm.f;
    const sX = camera.scrollX, sY = camera.scrollY;

    const alphaMul = this.alpha * camera.alpha;
    const xL = -this._margin;
    const xR = SCREEN_W + this._margin;
    const kx = ROAD_WIDTH / TILE_X;
    const pz = this._playerZ - this._vBase;
    // Absolute tile-space Z of the camera, for the noise only. The drawn V is
    // still rebased per quad (mediump), but the MASK has to be keyed to
    // absolute world position or the patches would slide as _vBase steps.
    const vAbsBase = this._vBase / TILE_Z;

    const cols = dissolve > 0 ? X_STEPS : 1;

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
          let vTop = (pz + zPrev) / TILE_Z;
          let vBot = (pz + z) / TILE_Z;
          const vWrap = Math.floor(vBot);
          vTop -= vWrap;
          vBot -= vWrap;
          // Absolute equivalents, for the mask.
          const vAbsT = vAbsBase + (pz + zPrev) / TILE_Z;
          const vAbsB = vAbsBase + (pz + z) / TILE_Z;

          const yT = yPrev - sY, yB = y - sY;

          for (let c = 0; c < cols; c++) {
            const f0 = c / cols, f1 = (c + 1) / cols;
            const x0 = xL + (xR - xL) * f0;
            const x1 = xL + (xR - xL) * f1;

            const u0T = (x0 - xPrev) * kx / wPrev, u1T = (x1 - xPrev) * kx / wPrev;
            const u0B = (x0 - x)     * kx / w,     u1B = (x1 - x)     * kx / w;

            let a0T = aTop, a1T = aTop, a0B = aBot, a1B = aBot;
            if (dissolve > 0) {
              a0T *= dissolveAt(u0T, vAbsT, dissolve);
              a1T *= dissolveAt(u1T, vAbsT, dissolve);
              a0B *= dissolveAt(u0B, vAbsB, dissolve);
              a1B *= dissolveAt(u1B, vAbsB, dissolve);
              if (a0T < 0.002 && a1T < 0.002 && a0B < 0.002 && a1B < 0.002) continue;
            }

            const tintTL = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(0xffffff, a0T);
            const tintTR = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(0xffffff, a1T);
            const tintBL = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(0xffffff, a0B);
            const tintBR = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha(0xffffff, a1B);

            if (pipeline.shouldFlush(6)) {
              pipeline.flush();
              unit = pipeline.setTexture2D(glTexture);
            }

            const xLs = x0 - sX, xRs = x1 - sX;
            const tlx = xLs * ma + yT * mc + me, tly = xLs * mb + yT * md + mf;
            const blx = xLs * ma + yB * mc + me, bly = xLs * mb + yB * md + mf;
            const brx = xRs * ma + yB * mc + me, bry = xRs * mb + yB * md + mf;
            const trx = xRs * ma + yT * mc + me, try_ = xRs * mb + yT * md + mf;

            pipeline.batchVert(tlx, tly, u0T, vTop, unit, 0, tintTL);
            pipeline.batchVert(blx, bly, u0B, vBot, unit, 0, tintBL);
            pipeline.batchVert(brx, bry, u1B, vBot, unit, 0, tintBR);
            pipeline.batchVert(tlx, tly, u0T, vTop, unit, 0, tintTL);
            pipeline.batchVert(brx, bry, u1B, vBot, unit, 0, tintBR);
            pipeline.batchVert(trx, try_, u1T, vTop, unit, 0, tintTR);
          }
        }

        yPrev = y; xPrev = x; wPrev = w; zPrev = z;
      }
    }
  }

  /** Canvas fallback paints nothing — the flat grass fill is the whole look. */
  renderCanvas() {}
}

// ── World-space dissolve mask for the snow cross-fade ────────────────────
// Two neighbouring ground tiles are drawn on IDENTICAL UVs and mixed with this
// mask, so snow arrives as organic patches instead of a straight line sweeping
// down the road.
//
// Keyed on the SAME (u, v) the texture uses — u from the road centreline, v
// from absolute world Z — so the patches are pinned to the ground exactly like
// the texture is. That is what stops them crawling or swimming when the camera
// moves; nothing here reads screen space or frame count, so a paused frame and
// a moving one produce the same mask.
const NOISE_TILES = 2.5;    // cell size in ground tiles (~120 ft) — low frequency
const DISSOLVE_W  = 0.30;   // edge softness; 0 would be a hard crumbling edge

function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1), deterministic in world space. */
function groundNoise(u, v) {
  const x = u / NOISE_TILES, z = v / NOISE_TILES;
  const ix = Math.floor(x), iz = Math.floor(z);
  const sx = smooth(x - ix), sz = smooth(z - iz);
  const n00 = hash2(ix, iz),     n10 = hash2(ix + 1, iz);
  const n01 = hash2(ix, iz + 1), n11 = hash2(ix + 1, iz + 1);
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sz;
}

/** Coverage 0..1 of the OVERLAY tile at this point, for accumulation `t`.
 *  Saturates at both ends: t=0 shows none of it anywhere, t=1 shows all of it
 *  everywhere, so a completed transition leaves no residual patchiness. */
function dissolveAt(u, v, t) {
  const n  = groundNoise(u, v);
  const tt = t * (1 + 2 * DISSOLVE_W) - DISSOLVE_W;
  const lo = n - DISSOLVE_W, hi = n + DISSOLVE_W;
  if (tt <= lo) return 0;
  if (tt >= hi) return 1;
  return smooth((tt - lo) / (hi - lo));
}

function fadeAt(z) {
  if (z <= FADE_Z0) return 1;
  if (z >= FADE_Z1) return 0;
  const t = (z - FADE_Z0) / (FADE_Z1 - FADE_Z0);
  return 1 - t * t * (3 - 2 * t);   // smoothstep — no hard edge at either end
}
