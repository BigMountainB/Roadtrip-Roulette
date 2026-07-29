# Road Trip Roulette — roadside ground tile spec

**This is NOT the same as the biome parallax bands** (see
`BIOME_BAND_ART_SPEC.md`). Those are distant mountain silhouettes on the
horizon, seen edge-on. These are the **ground surface itself** — the dirt,
grass and gravel immediately beside the road — seen from **straight above**.

The renderer takes this flat overhead tile and applies the road's own
perspective to it per segment, so it tracks hills and curves. Which means:

> **Do not draw any perspective into the tile.** No vanishing point, no
> receding ground, no horizon. If perspective is baked in, it gets applied
> twice and the ground shears.

Finished PNGs go in `public/assets/scenery/ground_textures/final/`.

---

## Non-negotiable technical rules

1. **1024 × 1024 px PNG. Power-of-two is mandatory.**
   The tile is uploaded with `GL_REPEAT`, which on WebGL1 requires
   power-of-two dimensions. A non-POT tile makes the code disable the whole
   ground layer and log a warning — it will not render at all. 1024 is the
   proven size; 512 or 2048 also work. 1000 or 1200 do **not**.

2. **Seamless in BOTH axes.** It tiles infinitely left-right *and*
   forward-back. Check by assembling a 2×2 and looking for edges or a cross.

3. **Straight-down orthographic view.** Camera directly overhead, no tilt,
   no perspective, no horizon.

4. **Flat, even, directionless lighting.**
   No cast shadows, no sun direction, no vignette, no darkened corners. Baked
   lighting repeats visibly across the tile grid and fights the game's own
   time-of-day and headlight system. Ambient, overcast, shadowless.

5. **Fully opaque.** No alpha channel needed.

6. **No dominant hero feature.** One distinctive boulder, log or bush will
   reappear on a regular grid and instantly read as wallpaper. Keep it evenly
   busy — many small features, no focal point.

---

## Scale — the thing that got this wrong the first time

Each tile covers roughly **48 feet of real ground** (`TILE_FT` in
`src/road/GroundPlane.js`). At 1024 px that is about **21 px per foot**:

| Real feature | Size in the tile |
|---|---|
| 3 ft grass clump | ~64 px |
| 1 ft weed tuft | ~21 px |
| 6 in stone | ~11 px |
| 2 in gravel | ~4 px |

Aim for detail at that scale. The first tile was authored assuming ~6 ft per
tile, which made every feature roughly 8× too small — the game renders at
940 × 450 internally, so it all averaged out to a flat olive wash with no
visible texture at all. **Err on the side of larger, bolder features.**

---

## The tiles

One per biome. All 8 currently fall back to the single PNW tile, so any
subset is useful — they can be added one at a time.

Naming: `<name>_ground_1024.png`, registered as texture key `ground_<name>`.

| File | Biome / miles | What it should be |
|---|---|---|
| `pnw_roadside_ground_1024.png` ✅ *exists* | West Side forest, mi 20–45 | Wet PNW roadside: mossy dirt, patchy grass, pine needles, small dark stones |
| `north_bend_ground_1024.png` | North Bend, mi 26–40 | Same wet greenery but coarser — fir needle litter, moss, damp gravel shoulder |
| `pass_alpine_ground_1024.png` | Snoqualmie Pass, mi 45–58 | Coarse alpine gravel, sparse tough grass, granite chips, bare wet rock. **No snow — the engine adds that.** |
| `easton_ground_1024.png` | Easton transition, mi 58–78 | Drying out: pine needles over dusty soil, sparse bunchgrass, more bare dirt |
| `kittitas_ground_1024.png` | Kittitas foothills, mi 78–122 | Dry tan bunchgrass, cracked pale soil, sage twigs, scattered pebbles |
| `vantage_basalt_ground_1024.png` | Vantage, mi 122–142 | Dark basalt scree and angular broken rock, sparse dry grass between |
| `columbia_ground_1024.png` | Columbia Basin, mi 142–210 | Irrigated-farm shoulder: silty pale soil, sparse green weeds, tyre-flattened grass |
| `palouse_ground_1024.png` | Palouse, mi 210–293 | Golden wheat stubble and dry straw over dark loess soil |

### Not needed

- **No snow variants.** Snow is applied by the engine — the tile fades out
  under the blanket and the road/roadside go pure white at mile 55.
- **No road surface.** The tarmac, lane lines and rumble strip are drawn
  procedurally. These tiles are the ground *beside* the road only.

---

## Delivery

PNG, 1024 × 1024, opaque, seamless both axes, overhead, flat lighting.
Drop into `public/assets/scenery/ground_textures/final/` — then it's one line
per tile in the `GROUND_TILES` table in `src/road/GroundPlane.js` to wire up.

Live scale check once a tile is in: `localhost:3000/?dev=1&tile=48` — change
the number to preview the tile at a different real-world size without a
rebuild.
