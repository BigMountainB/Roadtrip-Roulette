/**
 * "SHOPPING — NEXT RIGHT" freeway signs, composed at runtime (owner 2026-08-04).
 *
 * Each rest stop gets a blue placard advertising the businesses at that stop.
 * These used to be 19 baked PNGs built by `scripts/buildShoppingSigns.js`; they
 * are now assembled in-engine from two small images plus the brand logos the
 * game already loads for the rest-stop landing placards.
 *
 * ── Why this moved in-game ─────────────────────────────────────────────────
 * The baked signs had no way to know the shops had changed. The build script
 * carried its own copy of the rest-stop list, that copy went stale, and the
 * signs spent an unknown stretch of time advertising businesses that weren't
 * there — Mercer Island's sign offered camping while the stop actually sold
 * Gas-N-Sip / Lord Motors / Park & Ride. Composing from REST_STOPS at runtime
 * makes that class of bug impossible, and drops 2.4 MB of baked art to ~30 KB.
 *
 * VRAM is a wash: 19 composed RenderTextures cost what 19 loaded PNGs did, and
 * they're built lazily so only the stops a run actually reaches are paid for.
 *
 * Inputs (both shipped, both extracted from the original authored sign art so
 * the blue, header typography and plaque bevel are unchanged):
 *   sign_blank  — border + "SHOPPING - NEXT RIGHT" header + flat blue, no slots
 *   sign_plaque — one empty white slot including its bevel margin
 */

/** Authored placard size. Every coordinate below is in this space. */
export const SIGN_W = 768, SIGN_H = 505;

/** Plaque size as authored, and the bevel bleed baked into sign_plaque.png. */
const PLAQUE_W = 179, PLAQUE_H = 131, PLAQUE_MARGIN = 14;

/**
 * Plaques are drawn 20% larger than the authored art (owner 2026-08-04:
 * "the logos look smaller than I'd like"). Slot CENTRES stay put, so the grid
 * still reads as the original layout — the plaques just grow into the gutters,
 * which drop from ~61x50 px to ~25x24 px. This is the only lever left for logo
 * size: the logos already fill the plaque width almost edge to edge.
 */
const PLAQUE_SCALE = 1.20;

/** Slot centres of the authored 3x2 grid. */
const COL_CX = [144.5, 384.5, 624.5];
const ROW_CY = [201.5, 382.5];
export const MAX_SLOTS = COL_CX.length * ROW_CY.length;

/**
 * Logo padding inside a plaque, per axis. Asymmetric on purpose: most brand
 * logos are WIDE — FAP is 3.3:1, Les Schwasted 3.0:1 — against a 1.37:1
 * plaque, so width binds first. A tight horizontal pad lets them run nearly
 * edge to edge; the looser vertical pad keeps near-square logos (Huff's, at
 * 1.13:1) clear of the plaque's rounded corners.
 */
const LOGO_PAD_X = 0.05, LOGO_PAD_Y = 0.10;

/**
 * Amenity → brand logo texture, mirroring brandsForStop() in RestStopScene.js.
 * Keep the two in step: this sign is a promise about what's at the stop.
 * `dealer` is the vestigial regional fallback — Lord west, Sam's east.
 */
const LOGO_FOR = {
  gas:       'biz_huffs',
  hunting:   'biz_cowbellas',
  camp:      'biz_aok',
  lord:      'biz_lord',
  suck:      'biz_suck',
  vices:     'biz_gasnsip',
  ambm:      'biz_am_bm',
  parkride:  'biz_parkride',
  schwasted: 'biz_les_schwasted',
  fap:       'biz_fap',
};

export function logoKeyFor(amenity, mileage = 0) {
  if (amenity === 'dealer') return mileage < 100 ? 'biz_lord' : 'biz_suck';
  return LOGO_FOR[amenity] ?? null;
}

/**
 * Opaque content box of each logo PNG within its frame. Several carry a lot of
 * transparent padding — park-and-ride 283x129 of it, FAP 197x126 — so fitting
 * the raw frame would render those logos visibly smaller than the rest and
 * off-centre in their plaque. The baked pipeline got this for free from
 * sharp's trim(); in-engine it has to be measured up front.
 *
 * Regenerate if the logo art is re-exported:
 *   node -e "const sharp=require('sharp');const d='public/assets/businesses';
 *   (async()=>{for(const f of ['huffs.png','cowbellas.png','aok.png','lord.png','suck.png','gasnsip.png','am_bm.png','park-and-ride.png','les_schwasted.png','fap.png']){
 *   const{info}=await sharp(d+'/'+f).trim({threshold:1}).toBuffer({resolveWithObject:true});
 *   console.log(f,-info.trimOffsetLeft,-info.trimOffsetTop,info.width,info.height);}})()"
 */
export const LOGO_BBOX = {
  biz_huffs:           { x:    0, y:    0, w:  194, h:  171 },
  biz_cowbellas:       { x:    1, y:    0, w:  308, h:  164 },
  biz_aok:             { x:    0, y:    0, w:  307, h:  135 },
  biz_lord:            { x:    0, y:    0, w:  314, h:  151 },
  biz_suck:            { x:    3, y:    2, w:  347, h:  147 },
  biz_gasnsip:         { x:    6, y:   52, w:  756, h:  364 },
  biz_am_bm:           { x:   32, y:   28, w:  716, h:  315 },
  biz_parkride:        { x:  140, y:   80, w: 1407, h:  802 },
  biz_les_schwasted:   { x:   15, y:  115, w: 1892, h:  625 },
  biz_fap:             { x:  134, y:   59, w: 1975, h:  598 },
};

/** Which businesses actually make it onto a stop's sign, in order. */
export function signAmenities(stop) {
  return (stop?.amenities ?? [])
    .filter(a => logoKeyFor(a, stop?.mileage ?? 0))
    .slice(0, MAX_SLOTS);
}

/**
 * Compose (once) and return the texture key for a stop's sign, or null if the
 * source art isn't loaded. Safe to call every frame — after the first call it's
 * a texture-cache hit.
 */
export function ensureStopSign(scene, stop) {
  const key = `sign_${stop?.id}`;
  if (!stop?.id) return null;
  if (scene.textures.exists(key)) return key;
  if (!scene.textures.exists('sign_blank') || !scene.textures.exists('sign_plaque')) return null;

  const amenities = signAmenities(stop);
  const rt = scene.make.renderTexture({ width: SIGN_W, height: SIGN_H }, false);

  // Temporary, never added to the display list — drawn into the RT, then binned.
  const stamp = (texKey, x, y, w, h) => {
    const img = scene.make.image({ key: texKey, add: false }).setOrigin(0, 0);
    img.setDisplaySize(w, h);
    rt.draw(img, x, y);
    img.destroy();
  };

  stamp('sign_blank', 0, 0, SIGN_W, SIGN_H);

  const pw = PLAQUE_W * PLAQUE_SCALE, ph = PLAQUE_H * PLAQUE_SCALE;
  const mg = PLAQUE_MARGIN * PLAQUE_SCALE;
  amenities.forEach((amenity, i) => {
    const cx = COL_CX[i % COL_CX.length];
    const cy = ROW_CY[Math.floor(i / COL_CX.length)];
    // The plaque sprite includes its bevel margin on every side.
    stamp('sign_plaque', cx - pw / 2 - mg, cy - ph / 2 - mg, pw + mg * 2, ph + mg * 2);

    const logoKey = logoKeyFor(amenity, stop.mileage ?? 0);
    if (!logoKey || !scene.textures.exists(logoKey)) return;
    const bb = LOGO_BBOX[logoKey];
    const src = scene.textures.get(logoKey).getSourceImage();
    const box = bb ?? { x: 0, y: 0, w: src.width, h: src.height };

    // Contain-fit the OPAQUE box, then back out the full-frame size/position so
    // the transparent padding lands outside the plaque instead of shrinking the
    // logo inside it.
    const innerW = pw * (1 - LOGO_PAD_X * 2), innerH = ph * (1 - LOGO_PAD_Y * 2);
    const k = Math.min(innerW / box.w, innerH / box.h);
    stamp(
      logoKey,
      cx - (box.x + box.w / 2) * k,
      cy - (box.y + box.h / 2) * k,
      src.width * k,
      src.height * k,
    );
  });

  rt.saveTexture(key);
  return key;
}
