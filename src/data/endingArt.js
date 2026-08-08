/**
 * Ending-plate art (owner 2026-08-04).
 *
 * Each ending is a photographic 800x450 PLATE — exactly the game canvas, so
 * every coordinate here is 1:1 with screen space — with the player's GENRE CAR
 * composited on top.  The car matches whatever genre the player was driving
 * when the run ended (window.__genre.get()).
 *
 * Two views ship per genre: `_rear3q` (parked) and `_rear3q_crashed` (wrecked,
 * smoking).  A head-on `endcar_<genre>.png` also exists but no plate uses it.
 *
 * ── Why the bbox table ──────────────────────────────────────────────────────
 * The car PNGs are all 560x400, but the vehicle inside that frame is NOT.  A
 * classic-rock coupe trims to 472x217; a metal van trims to 453x339; the
 * transparent padding around each is different again.  Scaling the raw frame
 * would leave cars floating above or sunk into the road at random, so every
 * car is placed by its TRIMMED content box instead: the bottom-centre of the
 * trimmed art (the wheels' contact point) lands on the plate's anchor.
 *
 * ENDING_CAR_BBOX is generated from the art — if the PNGs are re-exported,
 * regenerate it rather than hand-editing:
 *   node -e "const sharp=require('sharp'),fs=require('fs');const d='public/assets/ui/endings/cars';(async()=>{for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.png')).sort()){const{info}=await sharp(d+'/'+f).trim({threshold:1}).toBuffer({resolveWithObject:true});console.log(f,-info.trimOffsetLeft,-info.trimOffsetTop,info.width,info.height);}})()"
 */

/** Trimmed content box of each car PNG within its 560x400 frame. */
export const ENDING_CAR_BBOX = {
  endcar_classic_rock:                     { x:   0, y:  48, w: 560, h: 352 },
  endcar_classic_rock_rear3q:              { x:  44, y:  90, w: 472, h: 217 },
  endcar_classic_rock_rear3q_crashed:      { x:  33, y:  52, w: 482, h: 255 },
  endcar_country:                          { x:  70, y:   1, w: 420, h: 399 },
  endcar_country_rear3q:                   { x:  32, y:  13, w: 499, h: 362 },
  endcar_country_rear3q_crashed:           { x:  32, y:  15, w: 498, h: 365 },
  endcar_edm_rave:                         { x:   0, y:  61, w: 560, h: 339 },
  endcar_edm_rave_rear3q:                  { x:  19, y:  89, w: 522, h: 218 },
  endcar_edm_rave_rear3q_crashed:          { x:   9, y:  93, w: 528, h: 213 },
  endcar_hiphop_phonk:                     { x:   1, y:   0, w: 559, h: 399 },
  endcar_hiphop_phonk_rear3q:              { x:  13, y:  70, w: 531, h: 240 },
  endcar_hiphop_phonk_rear3q_crashed:      { x:  11, y:   2, w: 537, h: 307 },
  endcar_k_pop:                            { x:   7, y:   1, w: 545, h: 399 },
  endcar_k_pop_rear3q:                     { x:  47, y:  47, w: 462, h: 305 },
  endcar_k_pop_rear3q_crashed:             { x:  42, y:  47, w: 467, h: 303 },
  endcar_metal:                            { x:  49, y:   0, w: 462, h: 400 },
  endcar_metal_rear3q:                     { x:  53, y:  24, w: 453, h: 339 },
  endcar_metal_rear3q_crashed:             { x:  49, y:  24, w: 460, h: 340 },
  endcar_norteno:                          { x:   0, y:  64, w: 560, h: 336 },
  endcar_norteno_rear3q:                   { x:   9, y:  71, w: 544, h: 248 },
  endcar_norteno_rear3q_crashed:           { x:   9, y:  68, w: 544, h: 250 },
  endcar_pop_punk_emo:                     { x:  61, y:   0, w: 438, h: 400 },
  endcar_pop_punk_emo_rear3q:              { x:  39, y:  25, w: 481, h: 352 },
  endcar_pop_punk_emo_rear3q_crashed:      { x:  38, y:  27, w: 482, h: 349 },
  endcar_reggae:                           { x:  70, y:   0, w: 419, h: 400 },
  endcar_reggae_rear3q:                    { x:  34, y:  11, w: 492, h: 367 },
  endcar_reggae_rear3q_crashed:            { x:  27, y:  17, w: 509, h: 359 },
  endcar_reggaeton:                        { x:   1, y:  33, w: 558, h: 366 },
  endcar_reggaeton_rear3q:                 { x:  19, y:  58, w: 508, h: 258 },
  endcar_reggaeton_rear3q_crashed:         { x:  16, y:  60, w: 510, h: 251 },
};

/** Genres with ending-car art.  A genre missing from this list renders the
 *  plate alone rather than the wrong car. */
export const ENDING_CAR_GENRES = [
  'classic_rock', 'country', 'edm_rave', 'hiphop_phonk', 'k_pop',
  'metal', 'norteno', 'pop_punk_emo', 'reggae', 'reggaeton',
];

/**
 * Per-ending plate + car placement.  Anchors were set by compositing the real
 * art offline and eyeballing each one against its ground plane:
 *   x, y = where the car's contact point sits on the plate
 *   w    = on-plate width of the TRIMMED car
 */
export const ENDING_PLATES = {
  busted: {
    texture: 'ui_end_busted_plate',
    file:    'end_busted_dynamic_plate.png',
    // Pulled over ahead of the cruiser, cop at the driver's window.
    car: { view: 'rear3q', x: 360, y: 268, w: 300 },
  },
  crash: {
    texture: 'ui_end_crashed_plate',
    file:    'end_crashed_dynamic_plate.png',
    // Sits in the gap it punched through the guardrail, at the end of the skid.
    car: { view: 'rear3q_crashed', x: 450, y: 262, w: 300 },
  },
  passed_out: {
    texture: 'ui_end_passed_out_plate',
    file:    'end_passed_out_dynamic_plate.png',
    car: { view: 'rear3q', x: 300, y: 330, w: 330 },
  },
  out_of_gas: {
    texture: 'ui_end_out_of_gas_plate',
    file:    'end_out_of_gas_plate.png',
    // On the shoulder beside the player and the empty gas can.
    car: { view: 'rear3q', x: 330, y: 300, w: 300 },
  },
  demo_complete: {
    texture: 'ui_end_demo_plate',
    file:    'end_demo_complete_plate.png',
    car: { view: 'rear3q', x: 250, y: 414, w: 292 },
  },
  finish: {
    texture: 'ui_end_pullman_plate',
    file:    'end_pullman_comic_plate.png',
    // Parked on the wet street in the comic's LEFT panel (x 8-262), so it has
    // to stay small and inside the panel border.
    car: { view: 'rear3q', x: 112, y: 318, w: 145 },
  },
};

/** Pullman arrives under three cause strings; all three share the comic. */
ENDING_PLATES.finish_on_time = ENDING_PLATES.finish;
ENDING_PLATES.finish_late    = ENDING_PLATES.finish;

const CAR_DIR = 'assets/ui/endings/cars';
const PLATE_DIR = 'assets/ui/endings';

/** Texture key for a genre's ending car, or null when the genre has no art. */
export function endingCarKey(genre, view = 'rear3q') {
  if (!genre || !ENDING_CAR_GENRES.includes(genre)) return null;
  return `endcar_${genre}_${view}`;
}

export function endingCarPath(genre, view = 'rear3q') {
  return `${CAR_DIR}/endcar_${genre}_${view}.png`;
}

export function endingPlatePath(spec) {
  return `${PLATE_DIR}/${spec.file}`;
}

/** The genre the player was driving.  Falls back to the save, then null. */
export function activeEndingGenre(scene) {
  try {
    const g = window.__genre?.get?.();
    if (g) return g;
  } catch (_) {}
  try { return scene?.registry?.get?.('save')?.get?.('genre', null) ?? null; } catch (_) { return null; }
}

/**
 * Load a plate + its genre car if they aren't in the texture cache yet, then
 * call `done`.  Only ever one plate and one car (~850 KB) — loading all six
 * plates at boot would cost ~3.5 MB for art the player sees once, so these are
 * fetched at the moment the ending appears and faded in.
 *
 * `done` is called with (plateReady, carKeyOrNull) and ALWAYS runs, including
 * on load failure — an ending screen that never draws would strand the player.
 */
export function loadEndingArt(scene, spec, genre, done) {
  const carKey = endingCarKey(genre, spec.car?.view);
  const needPlate = spec.texture && !scene.textures.exists(spec.texture);
  const needCar   = carKey && !scene.textures.exists(carKey);

  if (!needPlate && !needCar) {
    done(scene.textures.exists(spec.texture), carKey && scene.textures.exists(carKey) ? carKey : null);
    return;
  }

  const finish = () => done(
    scene.textures.exists(spec.texture),
    carKey && scene.textures.exists(carKey) ? carKey : null,
  );

  if (needPlate) scene.load.image(spec.texture, endingPlatePath(spec));
  if (needCar)   scene.load.image(carKey, endingCarPath(genre, spec.car.view));
  // 'complete' fires even when individual files 404 — the exists() checks in
  // finish() are what decide whether each piece actually draws.
  scene.load.once('complete', finish);
  scene.load.once('loaderror', () => { /* handled by exists() in finish */ });
  scene.load.start();
}

/**
 * Draw the genre car onto a plate at its anchor.  Returns the Image, or null
 * if the car texture isn't available (plate then stands on its own).
 *
 * Placement is by trimmed content box: scale so the trimmed car is `w` wide,
 * then offset so the trimmed bottom-centre lands on (x, y).
 */
export function placeEndingCar(scene, carKey, car, depth = 1) {
  if (!carKey || !scene.textures.exists(carKey)) return null;
  const bb = ENDING_CAR_BBOX[carKey];
  if (!bb) return null;

  const scale = car.w / bb.w;
  const img = scene.add.image(0, 0, carKey).setOrigin(0, 0).setScale(scale).setDepth(depth);
  // Frame origin = anchor, minus the trimmed box's offset inside the frame.
  img.x = car.x - (bb.x + bb.w / 2) * scale;
  img.y = car.y - (bb.y + bb.h) * scale;
  return img;
}
