#!/usr/bin/env node
/**
 * Road asphalt tiles → game-ready 1024x1024 POT textures.
 *
 * The delivered art is 1254x1254 at ~3.7 MB each.  Two problems for the
 * renderer:
 *
 *   1. GL_REPEAT needs a POWER-OF-TWO texture on WebGL1 (see
 *      GroundPlane.enableRepeatWrap, which disables itself and warns on a
 *      non-POT source).  A road tile that can't wrap is a road tile that
 *      can't tile, so 1254 has to come down to 1024.
 *   2. 11 MB of preload for three surfaces the player sees the whole run.
 *
 * Both fixed here.  Source art stays untouched in assets/scenery/roads/;
 * this writes the derived tiles into assets/scenery/roads/final/, matching
 * how ground_textures/ is laid out.
 *
 * The script also MEASURES each tile's mean luminance and prints it.  That
 * number matters: RoadPlane tints the texture by (regional asphalt colour /
 * mean), so the average rendered pixel lands exactly on the region's base
 * colour and the texture supplies only the deviation from it.  Paste any
 * changed values into ROAD_MATERIALS in src/road/RoadMaterial.js.
 *
 *   node scripts/buildRoadTextures.js
 */
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC    = resolve(ROOT, 'public/assets/scenery/roads');
const OUT    = resolve(SRC, 'final');
const SIZE   = 1024;

const TILES = [
  'road_asphalt_westside_wet_1024.png',
  'road_asphalt_mountain_1024.png',
  'road_asphalt_eastern_dry_1024.png',
];

/**
 * Mean luminance of the resized tile, 0..1, in the same linear-ish space the
 * GPU multiplies in (i.e. straight on the 8-bit values — the tint multiply is
 * per-channel on sRGB bytes, so this must be too).  Returned per channel as
 * well, so a tile with a colour cast doesn't get neutralised by a grey tint.
 */
async function measure(buf) {
  const { data, info } = await sharp(buf)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return { r: r / px / 255, g: g / px / 255, b: b / px / 255 };
}

await mkdir(OUT, { recursive: true });

const report = [];
for (const name of TILES) {
  const srcPath = resolve(SRC, name);
  const outPath = resolve(OUT, name.replace(/\.png$/, '.webp'));
  const srcBuf  = await readFile(srcPath);
  const meta    = await sharp(srcBuf).metadata();

  // Lanczos down to 1024.  A seamless tile stays seamless under a whole-image
  // resample — the wrap-around continuity is a property of the pixel content,
  // and every output pixel is a kernel over the same interior, so no edge
  // special-casing is needed.
  // WebP, not PNG.  Asphalt aggregate is high-entropy noise, so PNG barely
  // compresses it (2.2 MB per tile even after the downsample); WebP at q82
  // lands around a tenth of that with no visible loss on a surface that is
  // itself noise.  The project already ships cars/player.webp, so the format
  // is proven through the same Phaser loader on both web and Capacitor/iOS.
  const resized = await sharp(srcBuf)
    .resize(SIZE, SIZE, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();

  await writeFile(outPath, resized);

  const mean = await measure(resized);
  report.push({
    name,
    from: `${meta.width}x${meta.height}`,
    srcKB: Math.round(srcBuf.length / 1024),
    outKB: Math.round(resized.length / 1024),
    mean,
  });
}

console.log('\nRoad tiles → public/assets/scenery/roads/final/\n');
for (const r of report) {
  console.log(`  ${r.name}`);
  console.log(`      ${r.from} ${r.srcKB} KB  →  ${SIZE}x${SIZE} ${r.outKB} KB`);
  console.log(`      mean rgb  ${r.mean.r.toFixed(4)}, ${r.mean.g.toFixed(4)}, ${r.mean.b.toFixed(4)}`);
}
console.log('\n  Copy the mean values into ROAD_MATERIALS in src/road/RoadMaterial.js.\n');
