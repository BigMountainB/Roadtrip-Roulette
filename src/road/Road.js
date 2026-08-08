import {
  SCREEN_W, SCREEN_H, ROAD_WIDTH, SEG_LENGTH, LANE_DASH_LEN, LANE_DASH_GAP,
  LANES, DRAW_DIST, CAM, FOG_DENSITY, ROUTE_SEGS, TOTAL_ROUTE_MILES,
  PLAYER_VIRTUAL_Z,
} from '../constants.js';
// WORLD_W / WORLD_CX are live mutable bindings (set once at boot from the
// device aspect) — import the module so the world reads the CURRENT value
// each frame rather than a snapshot taken before main.js widens the canvas.
import * as C from '../constants.js';
import { project, fillTrap, rumbleW, laneW, toInt, SeededRNG, clamp } from '../utils/Helpers.js';
import { getPaletteAtProgress, REGION_ORDER, REGION_PALETTES, lerpColor } from '../utils/Colors.js';
import { buildRoute } from './RouteData.js';
import { TimeOfDay } from '../world/TimeOfDay.js';
import { Weather }   from '../world/Weather.js';
import {
  roadDetail, surfaceColor, nightFalloff, wheelPaths, hash1, noise1, smoothstep, WHEEL_HALF,
} from './RoadMaterial.js';

// H() is no longer a constant — it's the screen-Y of the HORIZON
// LINE, which CAM.horizonY now controls per camera mode (chase = 225,
// cockpit = 175).  Read via the H() accessor so every horizon-anchored
// element (road projection, sky, mountains, water silhouette, haze
// band, ground decals) shifts together when the horizon moves.
//
// Anywhere you see SCREEN_H/2 still in this file, it's deliberately a
// vertical SCALING factor in projection math (always half the canvas
// height), NOT the horizon position.
const H = () => CAM.horizonY;

// ── Snow blanket (owner spec, 2026-07-27) ───────────────────────────────
// Ground snow starts at the weather zone edge (mile 40) and reaches TOTAL
// coverage at mile 55 — road, rumble strip and both shoulders all one
// unbroken white sheet with every lane marking buried.
const SNOW_START_MILE  = 40;
const SNOW_FULL_MILE   = 55;
const SNOW_BUILD_MILES = SNOW_FULL_MILE - SNOW_START_MILE;
// The single colour everything converges on.  Slightly off pure white so the
// windshield snow particles and the headlight cones still read against it.
export const SNOW_WHITE = 0xF4F6F8;

/**
 * Ground-snow coverage at a route mile, 0..1.  THE single source of truth —
 * the forward view (_drawSegment) and the rear-view mirror both read it, so a
 * whiteout can't end up rendering as summer in the glass.
 */
export function snowBlanketAt(mile) {
  if (!Weather.isSnow(mile)) return 0;
  const easeIn  = Math.min(1, Math.max(0, (mile - SNOW_START_MILE) / SNOW_BUILD_MILES));
  const easeOut = mile > 86 ? Math.max(0, (88 - mile) / 2) : 1;
  return easeIn * easeOut;
}

/** Miles at/after which lane markings are fully buried. */
export const SNOW_MARKINGS_GONE = 0.55;

// Both road edges, hoisted so the per-segment edge loops don't allocate an
// array per side per frame (this runs DRAW_DIST times every frame).
const EDGE_SIDES = Object.freeze([-1, 1]);


// Rumble-groove pitch in world Z units.  Z runs at 60 units per foot (see
// RoadPlane / GroundPlane), so 60 = the ~12 in spacing of a real milled
// shoulder rumble strip.  Grooves are placed at absolute multiples of this,
// NOT per segment — segment-strided grooves are what turn into a barcode.
const GROOVE_Z = 60;

// Road-paint distance fade, in world units.  Derived from the draw distance so
// the curve keeps its proportions if DRAW_DIST ever changes.
//   PAINT_FAR        the full visible road depth (draw cap)
//   PAINT_BASE_MAX   ceiling of the gentle atmospheric blend that accumulates
//                    across the near/middle field
//   PAINT_KNEE       where the terminal fade begins, as a fraction of the
//                    visible depth — everything past it is the horizon handoff
const PAINT_FAR      = DRAW_DIST * SEG_LENGTH;
// 0.25 still washed the paint more than the owner wanted on the long bridge
// sightlines (2026-08-04) — at 25% blend plus sub-pixel width, mid-deck paint
// sat right at the edge of legibility.  0.14 keeps a whisper of atmospheric
// softening while the paint itself stays clearly readable to the knee.
const PAINT_BASE_MAX = 0.14;
const PAINT_KNEE     = 0.90;

// Concrete sidewalk slab pitch in world Z units (60 u/ft), i.e. the ~5 ft
// joint spacing of a real poured walkway.
const SLAB_Z = 300;

// Nested feather profiles: [half-width multiplier, alpha multiplier].
// Hoisted so the per-segment wear loops don't allocate every frame.
const WHEEL_BANDS = Object.freeze([[2.0, 0.34], [1.0, 0.66]]);
const PATCH_BANDS = Object.freeze([[1.00, 0.30], [0.78, 0.34], [0.52, 0.36]]);

export class Road {
  constructor() {
    this.segments = [];
    this.length   = 0;
    this.build();

    // ── Per-frame caches, allocated ONCE here, mutated in render() ─
    // The earlier attempt at boundary samples allocated all of these on
    // every frame, producing ~1500 short-lived objects/frame and
    // periodic GC stalls.  Pre-allocating eliminates the churn entirely.
    this._slopeBnd       = new Float32Array(DRAW_DIST + 1);
    this._surfaceSamples = new Array(DRAW_DIST + 1);
    for (let n = 0; n <= DRAW_DIST; n++) {
      this._surfaceSamples[n] = {
        worldZ:  0, screenX: 0, screenY: 0,
        screenW: 0, scale:   0, valid:   false, visible: false,
      };
    }
    // Per-frame prefix-min of the terrain silhouette: crestMinY[n] = the
    // smallest screenY (highest painted ground) among VISIBLE surface
    // samples STRICTLY nearer than boundary n.  crestClipY() reads this so
    // a scenery structure beyond a hill crest gets its lower half clipped
    // at the crest line instead of floating.  Rebuilt each frame.
    this._crestMinY = new Float32Array(DRAW_DIST + 1);
    // ── Whole-dash emission ────────────────────────────────────────────
    // A lane dash spans LANE_DASH_LEN segments.  Drawing one quad per segment
    // gives each sliver only that segment's screen height, and on a long
    // sightline (bridge decks, where ~5 segments collapse into a single pixel
    // row at relZ ~75k) the paint goes sub-pixel VERTICALLY and the dash chain
    // disappears — while the solid centre line, which paints on every segment
    // and so accumulates coverage, survives.  That was the "markings stop
    // part-way up the bridge" report.
    //
    // Fix: emit ONE quad spanning the dash's full world length.  The render
    // loop runs far -> near, so by the time a dash's NEAREST segment is
    // reached its farthest segment has already been projected; this ring
    // caches the last few far boundaries so the span can be closed without
    // re-projecting or restructuring the loop.  Allocation-free.
    this._dashRingN = 16;
    this._dashRing  = new Float32Array(this._dashRingN * 4);   // idx, x, y, w
    this._dashRing.fill(-1);
    // Per-column top edge of the drawn ROAD (screen-x column → min screenY),
    // rebuilt each frame after the projection pass and read ONE FRAME STALE
    // by the city-silhouette painter to clip blocks behind a road that has
    // risen above the flat horizon line.  Lazily sized in render() (needs
    // MARGIN, which is frame-local there).
    this._roadTopCols = null;
    this._drawnByN = new Array(DRAW_DIST);
  }

  build() {
    this.segments = buildRoute(ROUTE_SEGS);
    this.length   = this.segments.length * SEG_LENGTH;
  }

  getSegment(position) {
    if (position < 0) position += this.length;
    const idx = Math.floor(position / SEG_LENGTH) % this.segments.length;
    return this.segments[idx];
  }

  /** Main render call — called every frame from GameScene */
  /**
   * @param terrainG  Optional separate Graphics for GROUND fills only, sat
   *   one depth below `g`.  Splitting ground from road opens a slot for a
   *   textured ground plate (the North Bend underlay) to be drawn between
   *   them.  Omit it and every ground fill falls back to `g`, restoring the
   *   original single-layer behaviour exactly.
   * @param groundP  Optional GroundPlane.  Sits in that same slot and paints a
   *   repeating ground tile over the flat fill, using each segment's own
   *   projection so it tracks hills and curves.  Omit it and the ground stays
   *   flat-coloured — nothing else changes.
   */
  render(g, ghostG, playerPos, playerX, palette, effects, propsG, frontG, terrainG, skyG, groundP, cityG,
         roadBaseG, roadP) {
    g.clear();
    // Flat asphalt base + its projected texture, in the slot between the
    // ground plane and the road layer.  Omit either and _drawSegment falls
    // back to painting the base straight onto `g` with no tile — the exact
    // pre-texture behaviour.
    this._roadBaseG = roadBaseG ?? null;
    this._roadP     = roadP ?? null;
    if (roadBaseG) roadBaseG.clear();
    if (roadP) roadP.beginFrame(playerPos);
    if (skyG) skyG.clear();
    if (cityG) cityG.clear();
    if (terrainG) terrainG.clear();
    // SKY / BACKDROP LAYER.  Everything above the horizon — sky gradient,
    // stars, skyline silhouettes, lake horizon, far shore — paints here
    // instead of into the road layer.  That is what lets the biome parallax
    // bands sit BENEATH the ground: previously the sky lived in roadGfx, so
    // any band had to outrank roadGfx to be visible at all, which also put
    // it on top of the terrain and left its base as a hard seam floating
    // over the grass.  With the sky on its own layer the order becomes
    // sky -> bands -> terrain -> road, and the ground occludes the band's
    // base the way real terrain would.
    const bg = skyG ?? g;
    this._terrainG = terrainG ?? null;
    this._cityG    = cityG ?? null;
    this._groundP  = groundP ?? null;
    if (groundP) groundP.beginFrame(playerPos);
    if (propsG) propsG.clear();
    if (frontG) frontG.clear();
    this._propsG = propsG ?? null;
    // Bridge "front overlay" — when present, bridge-segment guardrails
    // paint here (at a higher depth than the crane sprite band) so the
    // bridge railings properly occlude the West Seattle Bridge cranes
    // instead of letting the cranes show through the railing.
    this._frontG = frontG ?? null;
    // Stash so per-sprite draw can hide cop_roadblock when stars < 3.
    this._currentStars = effects?.currentStars ?? 0;
    // Stash so _drawSprites can render NPC cars at their correct depth
    // interleaved with the per-segment building sprites.
    this._playerPos    = playerPos;
    // Camera on a bridge?  Gates the bridgeFrontGfx routing below: the
    // depth-4 front overlay exists so the deck+railings occlude the crane
    // sprites (depth 2) while you're ON the bridge — but during the APPROACH
    // it also put the far deck's rails above the depth-1.5 road layer, where
    // the nearer normal road could never paint over them.  On a curved,
    // climbing entry the white railings showed straight through the roadway
    // (owner 2026-08-04 screenshot, mile 0.94).  Off-bridge frames draw
    // bridge geometry into the normal road layer instead, where far→near
    // painter order occludes it exactly like every other segment.
    const _camSeg = this.getSegment(playerPos);
    this._camOnBridge = !!_camSeg?.bridge;
    this._camOnSpan   = !!(_camSeg?.bridge || _camSeg?.water);
    this._lightFlash   = effects?.lightFlash ?? false;
    // Stash so _drawSprites can route sign frames to the high-depth
    // signGfx overlay (above tunnel walls).
    this._effects      = effects;

    // Render with margin so Sushi-sway, crash-shake, AND Slushie-tilt
    // (up to ~20°) on the main camera don't reveal the void past the
    // painted area.  150px covers sway + ket tilts; the dissociation quad-split
    // at peak ket replaces the old 80° rotation that needed more.
    // Base 150 covers Sushi-sway / crash-shake / Slushie-tilt past the painted
    // area; HUD_OFFSET_X extends it further so the decoupled-width canvas (the
    // world is scrolled −HUD_OFFSET_X to center) is filled edge-to-edge with no
    // bare strip on the widened side.  All sky/ground fills key off MARGIN.
    const MARGIN  = 150 + Math.ceil(C.HUD_OFFSET_X);
    const W       = SCREEN_W + MARGIN * 2;
    const SKY_TOP = -MARGIN;             // paint sky up past the rotated viewport corners

    // --- SKY gradient (8 bands, top-blue → haze, mile-based day/night) ---
    // Day-time palette is lerped toward a warm dusk band and a deep
    // night band as the player progresses past mile 120.  TimeOfDay
    // returns 0..1 amounts; we mix the originals against fixed dusk /
    // night colours so each region keeps its character but the sky
    // tracks the in-game clock.
    const _mileNow  = (playerPos / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
    const duskAmt   = TimeOfDay.duskAmount(_mileNow);
    const nightAmt  = TimeOfDay.nightAmount(_mileNow);
    const darknessAmt = TimeOfDay.darkness(_mileNow);
    const DUSK_TOP   = 0xC56B3D;   // burnt orange
    const DUSK_FOG   = 0xE8A06E;   // pink-orange near horizon
    const NIGHT_TOP  = 0x06080F;   // deep blue-black
    const NIGHT_FOG  = 0x0E1424;   // slightly lighter near horizon
    const skyTopMix = lerpColor(
      lerpColor(palette.sky, DUSK_TOP, duskAmt),
      NIGHT_TOP, nightAmt,
    );
    const skyFogMix = lerpColor(
      lerpColor(palette.fog, DUSK_FOG, duskAmt),
      NIGHT_FOG, nightAmt,
    );
    // Sky gradient — was 8 stepped bands, which read as visible
    // horizontal stripes (especially behind the tunnel embankment when
    // approaching from a distance).  Bumped to 64 thin slices so the
    // lerp reads as a smooth gradient instead of stripes.
    const skyBands = 64;
    const skyH     = H() + 14;
    // Cap the sky region with a solid block of the top-band colour so a
    // rotated camera (Slushie tilt) doesn't reveal black above the
    // gradient.
    bg.fillStyle(skyTopMix, 1);
    bg.fillRect(-MARGIN, SKY_TOP, W, -SKY_TOP);
    for (let b = 0; b < skyBands; b++) {
      const t   = b / skyBands;
      const col = lerpColor(skyTopMix, skyFogMix, t * 0.65);
      bg.fillStyle(col, 1);
      const bandY = Math.floor(t * skyH);
      const bandH = Math.ceil(skyH / skyBands) + 2;
      bg.fillRect(-MARGIN, bandY, W, bandH);
    }

    // --- Gummies rainbow (≥ 65%) — drawn AFTER the sky but BEFORE
    // any road / scenery, so the rainbow sits behind everything but
    // the sky bands.  Six ROYGBV arcs across the upper sky. ---
    const gummiesBar = effects?.gummiesBar ?? 0;
    if (gummiesBar >= 0.65) {
      const a = Math.min(1, (gummiesBar - 0.65) / 0.35) * 0.55;
      const cx = 400, cy = 300, baseR = 220;
      const arcCols = [0xFF3333, 0xFF8800, 0xFFEE00, 0x33CC33, 0x3388FF, 0x8833FF];
      for (let i = 0; i < arcCols.length; i++) {
        bg.lineStyle(7, arcCols[i], a);
        bg.beginPath();
        bg.arc(cx, cy, baseR + i * 8, Math.PI, Math.PI * 2);
        bg.strokePath();
      }
    }

    // --- Stars / Milky Way / planets / moon ---
    // Sky modelled after a user-supplied Stellarium screenshot: a
    // diagonal Milky Way arch, scattered field stars in three
    // brightness tiers, a few named bright stars (Vega, Arcturus,
    // Altair), the galactic-centre cluster (Sagittarius region) on
    // the right, planets sitting just above the horizon, and the
    // crescent moon near where the photo had it.
    //
    // Visibility ramp uses `darknessAmt` (combines dusk + night) so
    // stars start fading in around mile 110–120 instead of holding
    // until mile 180.
    const skyDark = Math.min(1, darknessAmt * 1.15);
    if (skyDark > 0.04) {
      // ── Astronomy helper ────────────────────────────────────────────
      // Driver faces roughly East along I-90 through this stretch
      // (Pacific NW night driving on I-90 / US-195 is mostly eastward
      // until the final Spokane → Pullman segment).  Project a body
      // at (azimuth°, altitude°) onto the windshield assuming an
      // East-facing observer.  azimuth is degrees clockwise from
      // North (so 90° = East = directly ahead).  Returns null when the
      // body is behind the viewer.
      // Vertical projection anchored to the ACTUAL drawn horizon line
      // (= H()).  altDeg=0° lands on the horizon, +90° at SKY_TOP_Y
      // near the top of the screen, negative altitudes project below
      // the horizon and are naturally clipped by the ground graphics
      // painted after the sky pass.  Previously this routine had a
      // leftover `* HORIZON_Y_FRAC (0.80)` multiplier from when H()
      // meant SCREEN HEIGHT, which placed altitude=0 about 20% of
      // horizon_Y ABOVE the actual horizon line — the Milky Way (and
      // the moon at phase ~0) appeared floating mid-sky instead of
      // rising over the horizon.
      const SKY_TOP_Y = SCREEN_H * 0.05;
      const azAlt = (azDeg, altDeg) => {
        let angleFromForward = azDeg - 90;
        while (angleFromForward >  180) angleFromForward -= 360;
        while (angleFromForward < -180) angleFromForward += 360;
        if (Math.abs(angleFromForward) > 92) return null;   // behind viewer
        const xt = Math.sin(angleFromForward * Math.PI / 180);
        const yt = Math.sin(altDeg * Math.PI / 180);
        return {
          x: SCREEN_W * 0.5 + xt * SCREEN_W * 0.55,
          y: H() - yt * (H() - SKY_TOP_Y),
        };
      };

      // ── Full Moon — 3× real azimuth rate, rises through horizon ─────
      // Real moon: ~15°/hour azimuth = ~1.25°/game-mile (at 1 Pullman
      // trip ≈ 1 game day).  3× that gives ~3.75°/mile, so the full
      // 180° rise → transit → set arc collapses from ~144 miles into
      // 48 miles.  Rise at mile 160 (ESE crosses horizon) → transit
      // Due South ~mile 184 (peak alt ≈55°) → set in the West at mile
      // 208, 7 miles before the Milky Way comes out at mile 215.
      //
      // Rendering starts ~5 miles BEFORE the rise mile so the disc
      // physically climbs through the horizon line — at phase=-0.10
      // the moon's center is ~17° below horizon (well under the road
      // graphics), and as the phase ramps from -0.10 to 0 the disc
      // visibly rises into view.  Past phase=1 the moon has set.
      const MOON_RISE = 160;
      const MOON_SET  = 208;
      const moonPhase = (_mileNow - MOON_RISE) / (MOON_SET - MOON_RISE);
      let moonOnScreen = false;
      let moonX = -9999, moonArcY = 0;
      if (moonPhase >= -0.10 && moonPhase <= 1) {
        const moonAzimuth  = 110 + moonPhase * 160;     // ESE (110°) → S (190°) → W (270°)
        const moonAltitude = Math.sin(moonPhase * Math.PI) * 55;
        const moonScreen   = azAlt(moonAzimuth, moonAltitude);
        if (moonScreen) {
          moonX = moonScreen.x;
          moonArcY = moonScreen.y;
          moonOnScreen = true;
        }
      }

      // Reusable integer-hash PRNG so star positions are deterministic
      // but look like actual scattered light (the previous golden-ratio
      // modulo aliased into faint horizontal rows).
      const starHash = (n) => {
        let v = (n * 2654435761) >>> 0;
        v ^= v >>> 16; v = (v * 0x85ebca6b) >>> 0;
        v ^= v >>> 13;
        return ((v * 0xc2b2ae35) >>> 0) / 4294967296;
      };

      // ── Slow celestial rotation ────────────────────────────────
      // Stars + Milky Way + constellations rotate together around a
      // virtual celestial pole as game time passes — mimics Earth's
      // rotation.  Tied to playerPos so the sky pauses when the game
      // does.  Pole is off-screen above + slightly left, like looking
      // south-east at the night sky from mid-latitudes.  Rate halved
      // from 1.5e-6 to 7.5e-7 per user — ~1 full revolution per 20 min
      // at 80 mph.
      const skyRot = playerPos * 7.5e-7;
      const rotCx  = SCREEN_W * 0.30;
      const rotCy  = -H() * 0.20;
      const cosR   = Math.cos(skyRot);
      const sinR   = Math.sin(skyRot);
      const rotX = (x, y) => rotCx + (x - rotCx) * cosR - (y - rotCy) * sinR;
      const rotY = (x, y) => rotCy + (x - rotCx) * sinR + (y - rotCy) * cosR;

      // ── Milky Way band ──────────────────────────────────────────
      // Diagonal soft glow from lower-left through upper-centre to the
      // right edge, matching the photo's curve.  Drawn as two overlaid
      // strokes (wide+dim, narrow+brighter) plus a sprinkle of extra
      // dim stars along the curve so it reads as a dense star field
      // rather than a flat painted line.
      //
      // Gating: the Milky Way is NOT visible while the sky is still
      // light (dusk / partial night) — per the real-life rule that you
      // can't see it until full astronomical darkness.  Comes out at
      // mile 215 (7 miles after the moon sets at mile 208) so the
      // night-sky focal point handoff is clean.  Fades in over 10
      // miles to mile 225.
      const mwReveal = Math.max(0, Math.min(1, (_mileNow - 215) / 10));
      // Bumped from 0.55 → 0.68 to restore the old band's vibrancy
      // after the new shape work flattened the overall brightness.
      const mwAlpha = mwReveal * 0.68;
      if (mwAlpha > 0.02) {
        // Astronomical Milky Way placement.  At first visibility (mile
        // ~200) the band lies as a LOW, FLAT arch from NNE (≈22°
        // azimuth — fainter end, left of windshield centre) down to
        // SE (≈135° azimuth — bright Sagittarius / galactic-core end,
        // right of centre).  As the night progresses (Earth's
        // rotation) the band tilts UPWARD and the core sweeps
        // clockwise toward Due South — by mid-Pullman the core is
        // close to the south (right window pane).
        const mwSky = clamp((_mileNow - 215) / 75, 0, 1);
        // mwRise drives the literal "rising over the horizon"
        // motion — separate from mwSky's azimuth sweep so the band
        // physically climbs out of the ground in the first ~25 miles
        // after first reveal, then keeps drifting up more gradually.
        const mwRise = clamp((_mileNow - 215) / 25, 0, 1);
        // Both endpoints start CLEARLY below horizon at mile 215 so
        // the entire arch is buried under the ground graphics at
        // first reveal.  Over the next ~25 miles (mwRise) the band
        // physically rises through the horizon; mwSky then keeps it
        // drifting up more gradually for the rest of the trip.
        const nneAz   = 22;
        const nneAlt  = -15 + mwRise * 25 + mwSky * 10;
        // SE → S (bright galactic core end) — climbs higher and
        // swings south as night progresses.
        const coreAz  = 135 + mwSky * 45;     // 135° → 180°
        const coreAlt = -12 + mwRise * 22 + mwSky * 28;
        const nneScreen  = azAlt(nneAz,  nneAlt)
                           ?? { x: -MARGIN - 40, y: H() * 0.84 };
        const coreScreen = azAlt(coreAz, coreAlt)
                           ?? { x: SCREEN_W + MARGIN + 40, y: H() * 0.40 };
        const mwP0 = { x: nneScreen.x,  y: nneScreen.y };
        const mwP2 = { x: coreScreen.x, y: coreScreen.y };
        // Bezier control: bow upward.  Mid-arc sits ABOVE the line
        // between P0 and P2 by an amount that GROWS with mwSky —
        // early-night the band is a low flat arch; late-night it
        // bulges higher (the band has effectively rotated up + over).
        const midX = (mwP0.x + mwP2.x) * 0.5;
        // Bezier arch bow — small at first reveal so the entire arch
        // sits below the horizon (buried in ground) at mile 215, then
        // grows along with the endpoint rise so the apex breaks above
        // horizon a few miles in, then the rest of the band follows.
        const midY = Math.min(mwP0.y, mwP2.y) - 50 - mwRise * 30 - mwSky * 40;
        const mwP1 = { x: midX, y: midY };
        // Bezier helper — returns the spine point at parameter t.
        const mwAt = (t) => {
          const oneT = 1 - t;
          return {
            x: oneT*oneT*mwP0.x + 2*oneT*t*mwP1.x + t*t*mwP2.x,
            y: oneT*oneT*mwP0.y + 2*oneT*t*mwP1.y + t*t*mwP2.y,
          };
        };
        // Tangent at parameter t (used to compute the band-perpendicular
        // direction so dust lanes / clusters offset across the band, not
        // along it).
        const mwTangent = (t) => {
          const dx = 2*(1-t)*(mwP1.x - mwP0.x) + 2*t*(mwP2.x - mwP1.x);
          const dy = 2*(1-t)*(mwP1.y - mwP0.y) + 2*t*(mwP2.y - mwP1.y);
          const len = Math.hypot(dx, dy) || 1;
          return { tx: dx/len, ty: dy/len, nx: -dy/len, ny: dx/len };
        };

        // ── Milky-Way-only sky rotation, anchored to first reveal ────
        // skyRot has been accumulating since mile 0, but the band only
        // first appears at mile 215.  Applying the full skyRot at
        // reveal placed the band already-rotated up into the top of
        // the sky.  Subtract the rotation that accrued before mile 215
        // so the band starts at the horizon at first sight, then
        // rises as the player drives further (i.e. only the elapsed
        // rotation since reveal applies).
        // Slow the band's celestial rotation to ~1/5 of the field-star
        // rate so it doesn't spin a full lap (or two) across the
        // visible mile window.  At ~26 mi/revolution the unscaled rate
        // would give ~3 revolutions over the 78 visible miles —
        // unrealistic; 0.20× drops that to ~0.6 of a revolution and
        // keeps the band's slow drift in line with real celestial
        // motion at a several-hour timescale.
        const MW_ROT_SCALE = 0.20;
        const mwRotRate  = _mileNow > 1 ? (skyRot / _mileNow) * MW_ROT_SCALE : 0;
        const mwRotAngle = Math.max(0, _mileNow - 215) * mwRotRate;
        const mwCosR    = Math.cos(mwRotAngle);
        const mwSinR    = Math.sin(mwRotAngle);
        const mwRotX = (x, y) => rotCx + (x - rotCx) * mwCosR - (y - rotCy) * mwSinR;
        const mwRotY = (x, y) => rotCy + (x - rotCx) * mwSinR + (y - rotCy) * mwCosR;

        // ── Band silhouette curves ────────────────────────────────
        // CORE_T fixes where the galactic centre sits along the spine
        // — offset from mid (0.5) so the band reads asymmetric.
        // mwBright(t): brightness curve, peaks at CORE_T and tails off
        //   slowly toward t=0 (NNE) and quickly past CORE_T toward t=1.
        // mwGirth(t):  perpendicular thickness; 3-5× wider at the core
        //   than at the horizon ends.
        const CORE_T     = 0.78;
        const CORE_SIGMA = 0.16;
        const mwBright = (tt) => {
          const peak = Math.exp(-Math.pow((tt - CORE_T) / CORE_SIGMA, 2));
          const tail = tt < CORE_T
            ? Math.pow(tt / CORE_T, 0.70)
            : Math.pow(Math.max(0, 1 - tt) / (1 - CORE_T), 1.40);
          return 0.18 * tail + 0.85 * peak;
        };
        const mwGirth = (tt) => {
          const peak = Math.exp(-Math.pow((tt - CORE_T) / (CORE_SIGMA * 1.25), 2));
          const tail = tt < CORE_T
            ? Math.pow(tt / CORE_T, 0.60)
            : Math.pow(Math.max(0, 1 - tt) / (1 - CORE_T), 1.20);
          return 0.22 * tail + 1.00 * peak;
        };

        // ── Cohesion wash ──────────────────────────────────────────
        // Large soft blobs along the spine that fill the band into a
        // continuous glow underneath the granular puff layer.  Without
        // this the dotted blobs read as disconnected speckles; the
        // wash gives the old version's "connected cloud" feel while
        // the tapered shape on top still flares at the core.  Drawn
        // FIRST so the granular layer sits on top of it.
        const MW_WASH = 150;
        for (let i = 0; i < MW_WASH; i++) {
          const t = (i + 0.5) / MW_WASH;
          const { x: cx, y: cy } = mwAt(t);
          const { nx, ny } = mwTangent(t);
          const bright = mwBright(t);
          const girth  = mwGirth(t);
          const noise  = 0.70 + starHash(i * 79 + 41) * 0.55;
          // Tighter perpendicular spread than the grain so the wash
          // stays inside the band silhouette and reinforces its centre.
          const wander = (starHash(i * 53 + 17) - 0.5) * 22
                       * (0.32 + girth * 1.30);
          const px = cx + nx * wander;
          const py = cy + ny * wander;
          const rx = mwRotX(px, py);
          const ry = mwRotY(px, py);
          if (rx < -MARGIN || rx > SCREEN_W + MARGIN) continue;
          if (ry < -60 || ry > H() + 30) continue;
          // Large soft puff, low alpha — radius scales with brightness
          // so the wash is fattest where the core flares.
          const radius = (9 + 17 * bright) * noise;
          const a = mwAlpha * (0.08 + 0.18 * bright);
          // Same warm/cool palette as the granular puffs so they blend.
          const color = bright > 0.55 ? 0xD8C8A0 : 0x7A92B5;
          bg.fillStyle(color, a);
          bg.fillCircle(rx, ry, radius);
        }

        // ── Soft puffy band ────────────────────────────────────────
        // 1000 small overlapping blobs along the spine, painted on
        // top of the wash.  Perpendicular spread, radius, and alpha
        // all scale with mwGirth/mwBright so the band fattens
        // dramatically through the core and tapers to a thin star-
        // rich ribbon at the horizons.
        const MW_PUFFS = 1000;
        for (let i = 0; i < MW_PUFFS; i++) {
          const t = i / (MW_PUFFS - 1);
          const { x: cx, y: cy } = mwAt(t);
          const { nx, ny } = mwTangent(t);
          const bright = mwBright(t);
          const girth  = mwGirth(t);
          const noise  = 0.40 + starHash(i * 91 + 13) * 0.95;
          // Perpendicular wander — tightened from `0.30 + girth*2.30`
          // so the same number of puffs cluster closer together at
          // the core (user feedback: bulge was too wide).
          const wander = (starHash(i * 137 + 29) - 0.5) * 30
                       * (0.28 + girth * 1.50);
          const px = cx + nx * wander;
          const py = cy + ny * wander;
          const rx = mwRotX(px, py);
          const ry = mwRotY(px, py);
          if (rx < -MARGIN || rx > SCREEN_W + MARGIN) continue;
          if (ry < -40 || ry > H() + 20)   continue;
          const radius = (2.4 + 6.5 * bright) * noise;
          // Brightness lifted so the tails read as a vivid star band
          // (was 0.35 + 1.05*bright → faded outers).  0.65 baseline
          // keeps the tail bands punchy while the core stays brighter.
          const brightMod = (0.40 + starHash(i * 113 + 7) * 0.65)
                          * (0.65 + 0.85 * bright);
          const baseA = mwAlpha * brightMod;
          // Warm cream tone at the core, vivid cool blue in the tails
          // — old palette restored for the "vibrant" look the user
          // wanted on top of the new tapered shape.
          const color = bright > 0.55 ? 0xD8C8A0 : 0x7A92B5;
          bg.fillStyle(color, baseA * 0.55);
          bg.fillCircle(rx, ry, radius);
        }

        // ── Galactic-core plume ────────────────────────────────────
        // Extra warm puffs clustered around CORE_T, distributed in an
        // ellipse stretched along the band axis with a mild swirl
        // twist, so the core reads as a swirling plume of stars rather
        // than a tidy disc.  Asymmetric: cloud leans toward the
        // trailing side (t < CORE_T) where the band is wider.
        const CORE_PUFFS = 380;
        for (let i = 0; i < CORE_PUFFS; i++) {
          // Triangular distribution biased slightly toward the
          // trailing (NNE) side of the core.
          const u1 = starHash(i * 11 + 3);
          const u2 = starHash(i * 13 + 7);
          const tBias = CORE_T - 0.04 + (u1 - u2) * 0.36;
          if (tBias < 0.02 || tBias > 0.98) continue;
          const { x: cx, y: cy } = mwAt(tBias);
          const { tx, ty, nx, ny } = mwTangent(tBias);
          const ang = starHash(i * 19 + 9) * Math.PI * 2;
          const ru  = Math.sqrt(starHash(i * 23 + 13));
          // Elongated ellipse — 1.7× along band, 0.75× across.
          // Plume radius tightened (110 → 78) so the core glow
          // doesn't read as a fat blob.
          const lx0 = Math.cos(ang) * ru * 78 * 1.70;
          const ly0 = Math.sin(ang) * ru * 78 * 0.75;
          // Swirl twist — outer cells lag, giving a plume silhouette.
          const tw  = ru * 0.85;
          const cT  = Math.cos(tw), sT = Math.sin(tw);
          const lx  = lx0 * cT - ly0 * sT;
          const ly  = lx0 * sT + ly0 * cT;
          const px = cx + tx * lx + nx * ly;
          const py = cy + ty * lx + ny * ly;
          const rx = mwRotX(px, py);
          const ry = mwRotY(px, py);
          if (rx < -MARGIN || rx > SCREEN_W + MARGIN) continue;
          if (ry < -40 || ry > H() + 20) continue;
          const falloff = Math.exp(-ru * ru * 1.6);
          const radius  = (2.6 + 7.0 * (1 - ru))
                        * (0.7 + starHash(i * 113 + 11) * 0.7);
          const a = mwAlpha * 0.52 * (0.40 + 0.85 * falloff);
          // Two-tone: warm cream at the plume centre, soft pale blue
          // at the edges — old vivid palette so the core glows rather
          // than reading grey.
          const color = falloff > 0.45 ? 0xEDD9A8 : 0xB4C2D8;
          bg.fillStyle(color, a);
          bg.fillCircle(rx, ry, radius);
        }

        // ── Dust lanes — scattered dark patches ────────────────────
        // Concentrated near the core (where the band is widest and
        // dust contrast reads best); patch size + count scale with
        // local girth so the horizons stay clean.
        const MW_DUST = 220;
        for (let i = 0; i < MW_DUST; i++) {
          // Bias toward CORE_T via two hashes (triangular distribution).
          const h1 = starHash(i * 173 + 5);
          const h2 = starHash(i * 197 + 11);
          const t = Math.max(0.02, Math.min(0.98,
                       CORE_T + (h1 - h2) * 0.55));
          const { x: cx, y: cy } = mwAt(t);
          const { nx, ny } = mwTangent(t);
          const girth = mwGirth(t);
          const off = (starHash(i * 211 + 3) - 0.5) * 28
                    * (0.36 + girth * 1.40);
          const dx = cx + nx * off;
          const dy = cy + ny * off;
          const rx = mwRotX(dx, dy);
          const ry = mwRotY(dx, dy);
          if (rx < -MARGIN || rx > SCREEN_W + MARGIN) continue;
          if (ry < -40 || ry > H() + 20)   continue;
          const radius = (3 + starHash(i * 251 + 11) * 13)
                       * (0.55 + girth * 0.90);
          bg.fillStyle(0x040810, 0.48 * mwAlpha);
          bg.fillCircle(rx, ry, radius);
        }

        // ── Dust rivers — long branching dark veins through the core
        // Three meandering streams that flow roughly parallel to the
        // band axis at slight perpendicular offsets, cutting cracks
        // and rivers into the bright star field.  Random skips create
        // branching voids; per-river sin wobble keeps the streams
        // visibly distinct rather than parallel rails.
        const DUST_RIVERS = 3;
        for (let r = 0; r < DUST_RIVERS; r++) {
          const tStart = Math.max(0.05, CORE_T - 0.36 - r * 0.03);
          const tEnd   = Math.min(0.97, CORE_T + 0.22 + r * 0.02);
          const trackOffset = (r - 1) * 12
                            + (starHash(r * 311 + 17) - 0.5) * 10;
          const RIVER_SEGS = 120;
          for (let j = 0; j < RIVER_SEGS; j++) {
            const u = j / (RIVER_SEGS - 1);
            const tt = tStart + u * (tEnd - tStart);
            const { x: cx, y: cy } = mwAt(tt);
            const { nx, ny } = mwTangent(tt);
            // Smooth meander + small per-segment jitter.
            const wobble = Math.sin(u * Math.PI * (2.3 + r * 0.7) + r * 1.3) * 15
                         + (starHash(r * 173 + j * 11) - 0.5) * 6;
            // Branching gaps — skip ~12% of segments so the river
            // breaks into discontinuous cracks rather than a solid line.
            if (starHash(r * 401 + j * 7) < 0.12) continue;
            const dx = cx + nx * (trackOffset + wobble);
            const dy = cy + ny * (trackOffset + wobble);
            const px = mwRotX(dx, dy);
            const py = mwRotY(dx, dy);
            if (px < -MARGIN || px > SCREEN_W + MARGIN) continue;
            if (py < -40 || py > H() + 20)   continue;
            const coreW = Math.exp(-Math.pow((tt - CORE_T) / 0.22, 2));
            const radius = (5 + starHash(r * 547 + j * 23) * 10)
                         * (0.50 + coreW * 1.00);
            bg.fillStyle(0x030610, 0.55 * mwAlpha * (0.45 + coreW * 0.85));
            bg.fillCircle(px, py, radius);
          }
        }

        // ── Bright cluster knots ───────────────────────────────────
        // Biased toward the core so the brightest knots appear in the
        // plume, with a few scattered along the tail bands.
        const MW_KNOTS = 60;
        for (let i = 0; i < MW_KNOTS; i++) {
          const h1 = starHash(i * 311 + 9);
          const h2 = starHash(i * 337 + 13);
          const t = Math.max(0.05, Math.min(0.95,
                       CORE_T + (h1 - h2) * 0.55));
          const { x: cx, y: cy } = mwAt(t);
          const { nx, ny } = mwTangent(t);
          const girth = mwGirth(t);
          const off = (starHash(i * 379 + 13) - 0.5) * 22
                    * (0.36 + girth * 1.30);
          const kx = cx + nx * off;
          const ky = cy + ny * off;
          const rx = mwRotX(kx, ky);
          const ry = mwRotY(kx, ky);
          if (rx < -MARGIN || rx > SCREEN_W + MARGIN) continue;
          if (ry < -40 || ry > H() + 20)   continue;
          const bright = mwBright(t);
          const radius = (2 + starHash(i * 421 + 17) * 8) * (0.6 + bright * 0.9);
          // Warm halo + bright core knot — old vivid yellow tones.
          bg.fillStyle(0xF0E6BC, 0.22 * mwAlpha);
          bg.fillCircle(rx, ry, radius * 1.5);
          bg.fillStyle(0xFFF3CE, 0.42 * mwAlpha);
          bg.fillCircle(rx, ry, radius);
        }

        // ── Sprinkled stars along the band (denser than the field) ─
        // Spread scales with local girth — narrow at the horizons,
        // wide through the core — so the granular star field follows
        // the same silhouette as the puffy band.
        const MW_STARS = 1400;
        for (let i = 0; i < MW_STARS; i++) {
          const t = (i + 0.5) / MW_STARS;
          const { x: cx, y: cy } = mwAt(t);
          const { nx, ny } = mwTangent(t);
          const girth = mwGirth(t);
          const ang = starHash(i * 41 + 13) * Math.PI * 2;
          const r   = Math.sqrt(starHash(i * 53 + 17))
                    * (10 + girth * 45);
          // Elliptical scatter — 1.5× along the band tangent, 1.0×
          // perpendicular — so the grain reads as flowing with the
          // stream rather than as a circular cloud.
          const { tx, ty } = mwTangent(t);
          const along  = Math.cos(ang) * r * 1.5;
          const across = Math.sin(ang) * r * 1.0;
          const baseSx = cx + tx * along + nx * across;
          const baseSy = cy + ty * along + ny * across;
          const sx = mwRotX(baseSx, baseSy);
          const sy = mwRotY(baseSx, baseSy);
          if (sx < -MARGIN || sx > SCREEN_W + MARGIN) continue;
          if (sy < -8 || sy > H() + 12)  continue;
          if (Math.abs(sx - moonX) < 28 && Math.abs(sy - moonArcY) < 28) continue;
          const bright = mwBright(t);
          // Sprinkle stars: hold a bright tail baseline so the band
          // glitters all the way out to the horizons (was 0.45 baseline,
          // dropped tail stars to near-invisible).
          const a = (0.30 + starHash(i * 67 + 23) * 0.55)
                  * (0.70 + bright * 0.55) * mwAlpha;
          bg.fillStyle(0xE8EEFF, a);
          bg.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
        }
      }

      // ── Background field stars ─────────────────────────────────
      // Spawned in POLAR coordinates around the rotation pole — every
      // star sits at a fixed (radius, angle) from the pole, so when we
      // rotate by skyRot the field is gap-free at any angle (rotation
      // preserves radius and just shifts angle).  Disc covers screen
      // diagonal + margin so the visible sky is always saturated.
      // Color variety: ~15% blue-white (hot), ~10% warm yellow (cool),
      // rest white — mirrors the reference Stellarium image.
      const STAR_COUNT = 1500;
      const STAR_R_MAX = Math.hypot(SCREEN_W, SCREEN_H) + 100;
      for (let i = 0; i < STAR_COUNT; i++) {
        // sqrt() on the radius hash gives uniform area density (otherwise
        // stars cluster near the pole because polar samples concentrate
        // toward the centre).
        const u   = starHash(i * 7 + 11);
        const ang = starHash(i * 13 + 19) * Math.PI * 2;
        const r   = Math.sqrt(u) * STAR_R_MAX;
        const baseSx = rotCx + Math.cos(ang) * r;
        const baseSy = rotCy + Math.sin(ang) * r;
        const sx = rotX(baseSx, baseSy);
        const sy = rotY(baseSx, baseSy);
        // Cull rotated stars that landed outside the visible sky band.
        if (sx < -MARGIN || sx > SCREEN_W + MARGIN) continue;
        if (sy < -8 || sy > H() + 12) continue;
        if (Math.abs(sx - moonX) < 32 && Math.abs(sy - moonArcY) < 32) continue;
        const baseBright = 0.30 + starHash(i * 17 + 31) * 0.55;
        const phase      = starHash(i * 23 + 41) * Math.PI * 2;
        const twinkle    = 0.60 + 0.40 * Math.sin(phase + playerPos * 0.0002);
        const a          = Math.min(1, baseBright * twinkle * Math.min(1, skyDark * 1.3));
        // Spectral colour variety — most stars white, some hot-blue, a
        // few cool-yellow.
        const cRoll = starHash(i * 29 + 47);
        const color = cRoll < 0.15 ? 0xC8D4FF
                    : cRoll < 0.25 ? 0xFFE8C0
                    :                0xFFFFFF;
        bg.fillStyle(color, a);
        const size = baseBright > 0.82 ? 3 : (baseBright > 0.60 ? 2 : 1);
        bg.fillRect(Math.floor(sx), Math.floor(sy), size, size);
      }

      // ── Named bright stars + photo-traced constellations ───────
      // Positions normalised to [0..1] of (W, H()), traced from the
      // Stellarium reference screenshot.  Each entry has a colour for
      // the named star (slight blue / yellow tint per real spectral
      // class) and an optional connecting-line list for the
      // constellation figure it anchors.
      if (skyDark > 0.20) {
        const conA = Math.min(1, skyDark * 1.2);
        const figures = [
          // Lyra (anchor: Vega) — small parallelogram below Vega.
          { name: 'Vega',
            stars: [[0.49, 0.32], [0.485, 0.40], [0.475, 0.43],
                    [0.500, 0.43], [0.510, 0.40]],
            lines: [[0,1],[1,2],[2,3],[3,4],[4,1]],
            tint:  0xE6F0FF, mainIdx: 0, mainSize: 5 },
          // Boötes (anchor: Arcturus) — kite shape rising from Arcturus.
          { name: 'Arcturus',
            stars: [[0.69, 0.10], [0.71, 0.16], [0.73, 0.13],
                    [0.685, 0.06], [0.66, 0.04]],
            lines: [[0,1],[1,2],[2,3],[3,4],[4,0]],
            tint:  0xFFE4B0, mainIdx: 0, mainSize: 5 },
          // Aquila (anchor: Altair) — small arrow shape mid-right.
          { name: 'Altair',
            stars: [[0.43, 0.50], [0.40, 0.54], [0.46, 0.54]],
            lines: [[0,1],[0,2]],
            tint:  0xFFFFFF, mainIdx: 0, mainSize: 4 },
          // Sagittarius "teapot" — galactic-centre cluster, photo-right.
          { name: 'Sagittarius',
            stars: [[0.74, 0.62], [0.79, 0.62], [0.76, 0.66],
                    [0.81, 0.66], [0.78, 0.70], [0.72, 0.66], [0.83, 0.70]],
            lines: [[0,1],[0,5],[5,2],[2,3],[3,4],[4,6],[1,3]],
            tint:  0xFFFFFF, mainIdx: -1, mainSize: 0 },
          // Cygnus (Northern Cross) — visible through Milky Way upper-left.
          { name: 'Cygnus',
            stars: [[0.30, 0.18], [0.34, 0.26], [0.38, 0.34],
                    [0.31, 0.30], [0.40, 0.27]],
            lines: [[0,1],[1,2],[3,1],[1,4]],
            tint:  0xFFFFFF, mainIdx: -1, mainSize: 0 },
        ];
        for (const f of figures) {
          // Faint constellation lines (rotated with the rest of the field).
          bg.lineStyle(1, 0x88AACC, 0.18 * conA);
          for (const [ai, bi] of f.lines) {
            const [ax, ay] = f.stars[ai];
            const [bx, by] = f.stars[bi];
            const bx1 = ax * W - MARGIN, by1 = ay * H();
            const bx2 = bx * W - MARGIN, by2 = by * H();
            const x1 = rotX(bx1, by1), y1 = rotY(bx1, by1);
            const x2 = rotX(bx2, by2), y2 = rotY(bx2, by2);
            if (Math.abs((x1 + x2) / 2 - moonX) < 28
                && Math.abs((y1 + y2) / 2 - moonArcY) < 28) continue;
            bg.beginPath();
            bg.moveTo(x1, y1);
            bg.lineTo(x2, y2);
            bg.strokePath();
          }
          // Star pips.  Anchor (mainIdx) gets a bigger glow + bigger pip.
          for (let j = 0; j < f.stars.length; j++) {
            const [nx, ny] = f.stars[j];
            const baseX = nx * W - MARGIN, baseY = ny * H();
            const x = rotX(baseX, baseY), y = rotY(baseX, baseY);
            if (Math.abs(x - moonX) < 32 && Math.abs(y - moonArcY) < 32) continue;
            const tw = 0.85 + 0.15 * Math.sin(j * 1.3 + playerPos * 0.00015);
            const isMain = j === f.mainIdx;
            const haloR  = isMain ? 7 : 3;
            const pipSz  = isMain ? f.mainSize : 2;
            bg.fillStyle(f.tint, (isMain ? 0.32 : 0.20) * conA);
            bg.fillCircle(x, y, haloR);
            bg.fillStyle(0xFFFFFF, Math.min(1, tw * conA));
            bg.fillRect(Math.floor(x) - Math.floor(pipSz / 2),
                       Math.floor(y) - Math.floor(pipSz / 2),
                       pipSz, pipSz);
          }
        }
      }

      // ── Planets near horizon (Mars, Saturn) ────────────────────
      // Solid coloured dots low on the screen, just above the
      // horizon line.  Photo had Mercury at the extreme edge — too
      // close to the screen border to read at game scale, dropped.
      if (skyDark > 0.40) {
        const planA = Math.min(1, (skyDark - 0.40) / 0.30);
        const planets = [
          { x: 0.18, y: 0.93, col: 0xFF7A4A, r: 2.5 },   // Mars (orange)
          { x: 0.26, y: 0.94, col: 0xE8C078, r: 2.0 },   // Saturn (pale yellow)
        ];
        for (const pl of planets) {
          const px = pl.x * W - MARGIN;
          const py = pl.y * H();
          // Soft halo
          bg.fillStyle(pl.col, 0.30 * planA);
          bg.fillCircle(px, py, pl.r * 2.4);
          // Solid body
          bg.fillStyle(pl.col, planA);
          bg.fillCircle(px, py, pl.r);
        }
      }

      // Moon — painted last so it sits above the Milky Way + stars.
      // Skipped once the body crosses behind the windshield (set in W).
      if (moonOnScreen) {
        bg.fillStyle(0xF6F2D8, 0.30 * skyDark);
        bg.fillCircle(moonX, moonArcY, 22);
        bg.fillStyle(0xFFF8E0, Math.min(1, 1.2 * skyDark));
        bg.fillCircle(moonX, moonArcY, 14);
        bg.fillStyle(0xFFFFFF, Math.min(1, skyDark));
        bg.fillCircle(moonX - 3, moonArcY - 3, 9);
      }
    }

    // --- DISTANT TERRAIN ---
    // The single procedural Cascade range that used to live here is gone.
    // It scaled one triangle silhouette by mile, unlocked snow caps at mile
    // 30 regardless of where you actually were, and zeroed its height
    // multiplier past mile 70 — leaving 223 of the route's 293 miles
    // rendering against bare sky.
    //
    // Replaced by the biome parallax bands: seven distinct terrain sets
    // driven from src/road/Biomes.js and drawn as TileSprites in
    // GameScene._renderBiomeBackdrop().  They live outside this Graphics
    // because they are textured, and at depth 0.5 so they sit above the
    // sky painted here and below everything else.

    // Horizon haze band REMOVED.  It was a 14px palette.horizon strip at
    // 0.82 alpha just above the horizon, but the sky gradient above already
    // paints down to H()+14 with the near-horizon fog colour (skyFogMix), so
    // the band was redundant — it only re-tinted an already-painted strip and
    // added a hard-edged "shelf" seam that cut across distant building/tree
    // bases (visible in West Seattle + the Vantage desert).  Dropping it
    // leaves the clean sky→ground horizon; the void-fill role it once had is
    // covered by the sky gradient above and the grass / water bands below.

    // (The old hardcoded Lake Sammamish horizon decal lived here — an 8 px
    //  water strip hand-placed at mile 14.9–16.2 in the left 40% of screen.
    //  Superseded by the seg.waterLeft / seg.waterRight lake system below,
    //  which paints Sammamish as real water with a real far shore.)

    // Fail-safe world fill. On steep descents the projected road can drop
    // below the horizon for a few frames, leaving the cleared Graphics
    // background visible as a black band. Paint a terrain/water backing
    // from the haze line down; actual road, bridge water, sidewalks, and
    // tunnel pieces still draw over this per segment.
    const startSegIdx = Math.floor(playerPos / SEG_LENGTH) % this.segments.length;
    const startSeg = this.segments[startSegIdx];
    // ── Upcoming tunnel embankment proximity ───────────────────────────
    // The generic city-skyline silhouette below is a flat, screen-space
    // backdrop that doesn't track the road's curve or perspective — it
    // was overlapping the REAL Mt Baker / Mercer Island Lid Tunnel
    // embankment hill (_drawTunnelFacade further down), which IS curve-
    // and perspective-correct.  Random skyline building blocks sat
    // outside the real hill's silhouette and read as buildings floating
    // above/beside it.  Peeked far enough to cover every distance the
    // embankment hill can already be visible at (DRAW_DIST + the same
    // 600-segment EXTRA_PEEK used for the hill's own far-out projection
    // below), so the generic backdrop switches off exactly when the real
    // hill can start covering that part of the horizon instead.
    let _tunnelDistSegs = Infinity;
    for (let _tn = 0; _tn <= DRAW_DIST + 600; _tn++) {
      if (this.segments[(startSegIdx + _tn) % this.segments.length]?.tunnel) {
        _tunnelDistSegs = _tn;
        break;
      }
    }
    // FADE, not a switch (owner 2026-08-03: "silhouettes are here at 6.78 mi
    // then disappear at 6.8 — fade them behind the hill instead").  Alpha 1
    // while the tunnel is still beyond the far peek, easing to 0 across the
    // outer 600-segment stretch of the approach window — the same span over
    // which the real embankment hill grows in to own the horizon.  Applied
    // to the WHOLE silhouette layer (it holds nothing else), so there are no
    // per-rect alpha seams where adjacent blocks overlap.
    const _citySilFade = Math.max(0, Math.min(1, (_tunnelDistSegs - DRAW_DIST) / 600));
    // waterLeft joins the gate (owner 2026-07-27): the West Seattle
    // approach (mile 0-1) is elevated, so the void beyond the draw cap is
    // tall — and this region's grass2 is city-pavement GREY, which rendered
    // the whole area as a blank grey wall where Elliott Bay should run to
    // the horizon.  The backing paints the bay + the downtown skyline
    // silhouette there instead (geographically right: downtown IS across
    // the water), and it also puts the skyline the owner liked on the
    // approach instead of popping in at the bridge.  Water bands are
    // width-limited on waterLeft so the right (homes) flank keeps land.
    // Urban cityscape backing (owner 2026-07-28): through Seattle/SoDo (to
    // the Mt Baker tunnel at 4.9) the void band beyond the draw cap showed
    // the raw haze-toned fill — the persistent "grey-blue line".  Paint the
    // bridge-style charcoal cityscape + downtown skyline there instead, so
    // the skyline persists through the whole urban stretch.
    // Keep Seattle's skyline present until the HUD/location handoff into
    // Bellevue. Previously the land-only fallback stopped at the Mt Baker
    // tunnel while water/bridge branches came and went, making the silhouette
    // pop out during the same urban drive.
    const _cityBack = _mileNow < 12.5 && !startSeg?.water && !startSeg?.bridge && !startSeg?.waterLeft;
    if (startSeg?.water || startSeg?.bridge || startSeg?.waterLeft || _cityBack) {
      // Full width even for waterLeft: the right-flank terrain and home
      // sprites paint over the backing wherever there is land, and a
      // width-limit just left an unpainted black notch between the water's
      // cut edge and the first sprite.
      const WATER_W  = W;
      // Start exactly at the horizon.  Starting five pixels above it exposed
      // the first dark backing stripe against the sky as a black/blue ruler
      // line, especially on the opening West Seattle descent.
      const waterTop = H();
      // ── Opaque backstop for the entire below-horizon void ──────────────
      // The LAND branch (see the else below) lays a fail-safe world fill; this
      // branch never did.  So wherever the water / port / city bands and the
      // segment loop failed to meet, the camera's black background showed
      // straight through as a hard horizontal rule — the "black horizon line".
      // Measured on the West Seattle Bridge as a 3 px band of pure 0x000000 at
      // y 247-249, still present with roadGfx, terrainGfx, bridgeFrontGfx and
      // cityBackdropGfx each hidden in turn, which is what identified it as an
      // unpainted gap rather than any art colour.
      //
      // One opaque fill beneath everything this branch draws makes the gap
      // structurally impossible.  Haze-toned so that if it ever IS the visible
      // pixel it reads as atmosphere at the draw cap, not as a shelf.
      bg.fillStyle(lerpColor(palette.grass2, skyFogMix, 0.5), 1);
      bg.fillRect(-MARGIN, waterTop, W, SCREEN_H - waterTop + 20 + MARGIN);
      // Bridge segments use a near-black charcoal tone instead of the
      // saturated blue used on plain water crossings (floating bridges,
      // lake spans).  The blue read as "lake under the bridge" and
      // made the port cranes look like they were floating in water;
      // dark charcoal reads as "shaded underbridge / cityscape" so
      // the cranes silhouette against an urban backdrop, with the
      // existing skyline silhouette painting on top at horizon level.
      const _charcoal = startSeg.bridge || _cityBack;   // urban mass, not open water
      // The West Seattle Bridge crosses port yards, not a black void.  Its
      // old near-black bridge backing produced the large horizontal shelf
      // visible behind the cranes around mile 1.25.  Use fogged urban-ground
      // tones through Seattle; later bridge/water segments keep their water
      // or charcoal treatment.
      const _seattleBridge = _mileNow < 2 && startSeg.bridge;
      const _seattlePort = _mileNow < 7 && _cityBack;
      const waterA = _seattleBridge
        ? lerpColor(palette.grass2, skyFogMix, 0.25)
        : _seattlePort
          ? lerpColor(palette.grass2, skyFogMix, 0.58)
        : (_charcoal ? 0x1A1E22 : 0x2D5B82);
      const waterB = _seattleBridge
        ? lerpColor(palette.grass2, 0x252B2D, 0.15)
        : _seattlePort
          ? lerpColor(palette.grass2, 0x252B2D, 0.28)
        : (_charcoal ? 0x0E1014 : 0x173A58);
      if (_cityBack) {
        // Land through Seattle uses the terrain layer, not a full-width sky
        // backing. Do not add the generic distance-haze ramp here: even a
        // short ramp remains visible beneath the skyline as a horizontal grey
        // shelf. The skyline itself hides the sky/ground seam; the real ground
        // colour should meet its base immediately.
        const tg = this._terrainG ?? g;
        // Downtown's palette uses pavement-grey grass slots. At the far cap
        // that becomes the exact grey bar the player sees, while the textured
        // verge immediately in front is olive/brown. Use the far-verge tone
        // here so the untextured projection cap visually joins that ground.
        const cityFarGround = lerpColor(palette.grass2, 0x465038, 0.78);
        tg.fillStyle(cityFarGround, 1);
        tg.fillRect(-MARGIN, H(), W, SCREEN_H - H() + 20 + MARGIN);
      } else {
        // Match the horizon row to atmospheric fog and transition to the real
        // water/bridge surface colour in fine steps.
        const transitionH = _seattleBridge ? 10 : 48;
        const transitionSteps = _seattleBridge ? 5 : 24;
        for (let b = 0; b < transitionSteps; b++) {
          const t = b / Math.max(1, transitionSteps - 1);
          const y = waterTop + Math.floor(t * transitionH);
          const h = Math.ceil(transitionH / transitionSteps) + 1;
          bg.fillStyle(lerpColor(waterA, skyFogMix, Math.pow(1 - t, 2)), 1);
          bg.fillRect(-MARGIN, y, WATER_W, h);
        }
        const bodyTop = waterTop + transitionH;
        const bodyBands = 7;
        for (let b = 0; b < bodyBands; b++) {
          const t = b / Math.max(1, bodyBands - 1);
          const y = bodyTop + Math.floor(t * (SCREEN_H - bodyTop));
          const h = Math.ceil((SCREEN_H - bodyTop) / bodyBands) + 2;
          bg.fillStyle(lerpColor(waterA, waterB, t), 1);
          bg.fillRect(-MARGIN, y, WATER_W, h);
        }
      }
      // Distant opposite shoreline — varied silhouette in two layers so
      // the horizon doesn't read as one flat blue bar.  Far hills behind,
      // closer warehouse / downtown building blocks in front.  Both
      // layers use deterministic pseudo-noise (sin-mix on x) so the
      // skyline stays stable across frames instead of flickering.
      //
      // The skyline ALSO parts as the player leaves Seattle (similar to
      // the Cascades pass-gap): full silhouette through the West Seattle
      // bridge crossing, growing center gap on the Murrow floating bridge
      // (looking back at the receding skyline), gone by the East Channel
      // bridge.  Implemented as `cityGap` — fraction of screen-width
      // around centre where peaks/blocks are skipped.
      const horizonY     = H();
      // The first 0.6 mi uses the lighter residential-West-Seattle palette.
      // Bias the procedural skyline farther toward navy so it is already a
      // readable silhouette at mile zero, before downtown sprite spawning.
      const farHillCol   = lerpColor(palette.horizon, 0x0B2034, 0.45);
      const buildingCol  = lerpColor(palette.horizon, 0x061426, 0.72);
      const buildingLit  = lerpColor(buildingCol, 0xFFE9A8, 0.18);   // warm window glow tint
      const cityMile = (playerPos / (ROUTE_SEGS * SEG_LENGTH)) * TOTAL_ROUTE_MILES;
      let cityGap;
      if      (cityMile < 10)   cityGap = 0;
      else if (cityMile < 12.5) cityGap = (cityMile - 10) / 2.5;  // fade after leaving Seattle
      else                       cityGap = 1;
      const gapHalfPx = SCREEN_W * 0.5 * cityGap;
      const inCityGap = (cx) => gapHalfPx > 0 && Math.abs(cx - SCREEN_W * 0.5) < gapHalfPx;
      // City silhouettes belong above the terrain fill but below the road.
      // Painting them into skyG let the green distance fill cut across their
      // bases as a horizontal haze line.
      const city = this._cityG ?? bg;

      // Layer 1 — far hills.  Stepped silhouette of varying heights
      // forming a low, rolling ridgeline.  Step width 24 px keeps the
      // shape readable but not blocky.  Also FADED OUT as a real tunnel
      // embankment approaches to own the horizon (see _citySilFade
      // above) — cityGap only opens a centered hole, which wouldn't
      // clear the flat-screen-space building blocks the real curved
      // hill doesn't reach at the edges.
      this._cityG?.setAlpha(_citySilFade);
      // Road-top clip (owner 2026-08-03): these blocks paint at depth 6.9,
      // necessarily ABOVE roadGfx — so wherever the pavement has risen
      // above the flat horizon line (bridge humps, crests) they stamped
      // straight over the roadway.  Clip every column's bottom at the
      // road's top edge (built after last frame's projection pass) so the
      // city emerges from BEHIND the rising road instead.
      const _rtCols = this._roadTopCols;
      const _rtW    = this._roadTopColW || 8;
      const _rtOff  = this._roadTopOff  || 0;
      const _roadTopAt = (x) => {
        if (!_rtCols) return Infinity;
        const c = Math.round((x + _rtOff) / _rtW);
        return (c < 0 || c >= _rtCols.length) ? Infinity : _rtCols[c];
      };
      const _clipBottom = (x0, x1) => Math.min(
        horizonY, _roadTopAt(x0), _roadTopAt((x0 + x1) * 0.5), _roadTopAt(x1));

      if (cityGap < 1 && _citySilFade > 0.01) {
        const farStep = 24;
        city.fillStyle(farHillCol, 0.95);
        for (let x = -MARGIN; x < SCREEN_W + MARGIN; x += farStep) {
          if (inCityGap(x + farStep * 0.5)) continue;
          const n = Math.sin(x * 0.013) + Math.sin(x * 0.041 + 1.7) * 0.6
                  + Math.sin(x * 0.087 + 3.1) * 0.4;
          const h = 8 + Math.max(0, n + 1.6) * 5;          // 8–23 px tall
          const hillTop = horizonY - h * 0.55;
          // Stop at (not one pixel below) the horizon. Adjacent rectangles
          // otherwise shared an opaque bottom row that read as a black line.
          const hillBot = _clipBottom(x, x + farStep);
          if (hillTop < hillBot) city.fillRect(x, hillTop, farStep + 1, hillBot - hillTop);
        }
        // Layer 2 — building blocks (warehouses + downtown skyline).
        // Deterministic per-block: width and height pseudo-randomised by
        // index so the row reads as a city silhouette, not a sawtooth.
        let bx = -MARGIN;
        let blockI = 0;
        while (bx < SCREEN_W + MARGIN) {
          const r1 = Math.sin(blockI * 12.9898) * 43758.5453;
          const r2 = Math.sin(blockI * 78.233 + 1.7) * 43758.5453;
          const r3 = Math.sin(blockI * 39.346 + 4.2) * 43758.5453;
          const w = 14 + Math.floor((r1 - Math.floor(r1)) * 36);     // 14–50 px wide
          const h = 7 + Math.floor((r2 - Math.floor(r2)) * 24);      // 7–31 px tall
          const tall = (r3 - Math.floor(r3)) > 0.82;                 // ~18% are skyscrapers
          const realH = tall ? h + 10 + Math.floor((r3 - Math.floor(r3)) * 14) : h;
          if (!inCityGap(bx + w * 0.5)) {
            const blockBot    = _clipBottom(bx, bx + w);
            const buildingTop = horizonY - realH + 6;
            if (buildingTop < blockBot) {
              city.fillStyle(buildingCol, 1);
              city.fillRect(bx, buildingTop, w, blockBot - buildingTop);
              // Sparse warm window dots on tall blocks — clipped with the
              // block so no lit window floats over the pavement.
              if (tall && realH > 14) {
                city.fillStyle(buildingLit, 0.7);
                const winRows = Math.max(1, Math.floor(realH / 6));
                for (let row = 0; row < winRows; row++) {
                  if ((blockI + row) % 3 === 0) {
                    const wy = horizonY - realH + 8 + row * 5;
                    if (wy + 2 <= blockBot) {
                      city.fillRect(bx + 2 + (row % 3) * 4, wy, 2, 2);
                    }
                  }
                }
              }
            }
          }
          bx += w + 2;
          blockI++;
        }
      }
      // Water surface foam + glint stripes.  Skipped on BRIDGE
      // segments — those use a charcoal "underbridge / cityscape"
      // tone now, and the light ripple stripes were reading as
      // water reflections behind the port cranes.  Plain water
      // crossings (floating bridges) keep the glints.
      if (!startSeg.bridge && !_cityBack) {
        bg.fillStyle(0xC8D8E0, 0.20);
        bg.fillRect(-MARGIN, H() + 16, W, 3);
        bg.fillStyle(0xFFFFFF, 0.18);
        for (let gl = 0; gl < 9; gl++) {
          const gx = ((gl * 173 + Math.floor(playerPos / 400)) % (SCREEN_W + MARGIN * 2)) - MARGIN;
          const gy = H() + 34 + (gl % 3) * 12;
          bg.fillRect(gx, gy, 26 + (gl % 4) * 12, 2);
        }
      }
      // ── Distant treeline along the far shore ──────────────────────
      // Floating bridge crossings have water on both sides, so the
      // tree-spawn system can't drop sprites there.  Paint a cheap
      // tree-silhouette horizon band across the FULL screen width so
      // the bridge view reads as "crossing the lake toward a wooded
      // shore" instead of bare water meeting sky on the sides.
      // Two layers: lower hill base in warm shore tone, then a
      // sin-mix tree-top silhouette in forest green.  ~250 fillRect
      // calls per frame max — well under the road's segment loop
      // budget.  Skipped on bridge segments because those have their
      // own foreground cranes filling the horizon area.
      if (!startSeg.bridge && !_cityBack) {
        this._paintFarShore(bg, -MARGIN, SCREEN_W + MARGIN, 1);
      }
    } else {
      // Extend grass past the screen bottom by MARGIN so a rotated camera
      // doesn't reveal void below the painted area.  Start the grass
      // AT the horizon line (not 10 px below it) so far building
      // sprites that anchor near the horizon visibly sit on ground
      // instead of floating in the haze band.
      // Terrain layer — see the per-segment grass fill in _drawSegment.
      // This fail-safe world fill is opaque below the horizon, so it has to
      // move too or it would hide any ground plate drawn above it.
      const _tg = this._terrainG ?? g;
      // Haze-toned, not raw grass2: every pixel of this fill is BEYOND the
      // last drawn segment, i.e. the farthest thing on screen — so it must
      // be at least as fogged as the far segments' own distance-fog veil
      // (palette.fog at 0.85 in _drawSegment).  Raw grass showed as an
      // unfogged band ABOVE that veil, which made the veil's edge read as a
      // hard light-blue line hugging the horizon on descents (pixel-matched
      // to palette.fog exactly).  Blending the fill toward skyFogMix makes
      // fill → far veil → defogging road one continuous recession, and
      // inherits dusk/night tinting for free.
      // GRADIENT, not a flat tone.  A single blend was tried at 0.72 (read as
      // a grey-blue band) and at 0.35 (read as a green band) — both failed for
      // the same structural reason: ANY flat colour here meets the horizon at
      // a hard edge, and an edge across the full screen width is a bar no
      // matter what colour it is.  That is the "green bar" the owner kept
      // circling, and it is the lowest-layer fill, which is why stripping
      // every other layer never removed it.
      //
      // Distance goes to INFINITY at the horizon, so atmospheric extinction
      // must be TOTAL there: ground colour has to equal the fog colour exactly
      // at H(), then recover toward grass over the near strip.  Matching at
      // the seam is what removes the band — there is nothing left to see an
      // edge against.  Stepped because Phaser's Graphics has no vertical
      // gradient fill; HAZE_STEPS bands over HAZE_H px is smooth at this size.
      const HAZE_H = 64, HAZE_STEPS = 16;
      for (let i = 0; i < HAZE_STEPS; i++) {
        const t0 = i / HAZE_STEPS;
        // ease-out: most of the recovery happens in the first few px below the
        // horizon, which is where the compression is worst.
        const mix = Math.pow(1 - t0, 1.8);
        _tg.fillStyle(lerpColor(palette.grass2, skyFogMix, mix), 1);
        _tg.fillRect(-MARGIN, H() + t0 * HAZE_H, W, HAZE_H / HAZE_STEPS + 1);
      }
      // Flat ground colour below the haze strip — still fail-safe cover for
      // anything the segment loop doesn't reach.
      _tg.fillStyle(lerpColor(palette.grass2, skyFogMix, 0.06), 1);
      _tg.fillRect(-MARGIN, H() + HAZE_H, W, SCREEN_H - H() - HAZE_H + 20 + MARGIN);
    }

    // ── Roadside lake horizon (one-sided water) ───────────────────────
    // Painted OVER the grass fill above, on the lake's side only, so the
    // land flank keeps its terrain.  Three stacked pieces read as a lake
    // rather than a blue rectangle: water surface, a sun glint stripe,
    // and the far shore with its treeline.
    //
    // `lakeShore` is how far across the screen half-width the water
    // reaches before the far shore — the thing that distinguishes a lake
    // from open ocean.  Sammamish (wide) gets more screen than Keechelus
    // (narrow), and Kachess/Easton are barely a sliver.
    // Gated on `lakeShore`, NOT on the water flags alone: the West Seattle
    // approach (mile 0–1) is also waterLeft, but that is Elliott Bay — open
    // water to the horizon, which must NOT get a far shore painted across
    // it.  Only segments tagged by the LAKES table carry lakeShore.
    //
    // `lakeDistant` covers lakes the road never reaches (Sammamish, Kachess).
    // They paint ONLY here, at the horizon — the roadside keeps its grass and
    // its trees and houses, and because those sprites draw at depth 7-9.5 they
    // occlude this band naturally.  That is what puts the lake behind them
    // instead of underneath them.
    const _lakeSide = startSeg?.lakeDistant
      ?? (startSeg?.waterLeft ? -1 : (startSeg?.waterRight ? 1 : 0));
    if (_lakeSide !== 0 && startSeg.lakeShore && !startSeg.water && !startSeg.bridge) {
      const frac  = startSeg.lakeShore;
      const halfW = SCREEN_W / 2;
      // Left lakes span from the screen edge inward toward centre; right
      // lakes from centre outward.  `frac` of the half-width either way.
      const x0 = _lakeSide < 0 ? -MARGIN          : halfW;
      const x1 = _lakeSide < 0 ? halfW * frac     : halfW + halfW * frac;
      const lakeY = H() - 5;
      bg.fillStyle(0x2D4F6C, 0.92);
      bg.fillRect(x0, lakeY, x1 - x0, 9);
      // Sun glint on the surface.
      bg.fillStyle(0xA9C4D6, 0.50);
      bg.fillRect(x0, lakeY + 3, x1 - x0, 1);
      // Far shore + treeline, clipped to the lake's span.
      this._paintFarShore(bg, x0, x1, 1);
    }

    // --- PROJECT VISIBLE SEGMENTS ---
    const cameraZ = playerPos - (Math.floor(playerPos / SEG_LENGTH) * SEG_LENGTH);
    this._cameraZ = cameraZ;
    // Camera lateral tracking. When enabled (default), the camera follows
    // the player's X so the road stays centered on the player's view.
    // When disabled (debug toggle F4), the camera stays at world X=0 so
    // the player visibly slides across the road and roadside scenery
    // doesn't appear to drift in the opposite direction.
    const cameraX = (this._cameraTracksPlayer === false ? 0 : playerX) * ROAD_WIDTH;
    // Camera Y interpolates across the segment boundary instead of
    // snapping to the current segment's elevation.  Sampling discretely
    // made the road jolt by (segB.y − segA.y) every time the player
    // crossed a boundary — at speed that's many times a second, which
    // reads as a constant bumpy ride even with smoothed hills[].  The
    // fractional position within the segment (cameraZ / SEG_LENGTH)
    // weights the interp so cameraY moves continuously.
    const _segLen = this.segments.length;
    const _segA   = this.segments[startSegIdx];
    const _segB   = this.segments[(startSegIdx + 1) % _segLen];
    const _tZ     = cameraZ / SEG_LENGTH;
    const _yA     = _segA?.y ?? 0;
    const _yB     = _segB?.y ?? _yA;
    // Cockpit view flattens road elevation by 50 % — Vantage's steep
    // descent stuffs the dashboard with sky in cockpit, so scale every
    // seg.y (and the local segY part of cameraY) by ELEV_MULT.  Chase
    // mode keeps full elevation.
    const ELEV_MULT = (CAM.mode === 'cockpit') ? 0.5 : 1.0;
    const cameraY = CAM.height + (_yA + (_yB - _yA) * _tZ) * ELEV_MULT;

    let screenX     = 0;   // accumulated lateral offset (for curves)
    let screenDX    = 0;
    let maxScreenY  = 0;  // clip Y — skip segments hidden behind hills (must increase far→near)

    // ── Accumulated slope offset across the visible window ──────────
    // Pseudo-3D projection compresses elevation, so use real grade percent
    // as a camera-pitch hint.  Positive grade lifts the far road toward
    // the horizon; negative grade drops it away.  The clamp keeps long
    // mountain grades dramatic without letting a steep keyframe fold the
    // visible road into the sky.
    const UPHILL_PITCH_BOOST   = 16;
    const DOWNHILL_PITCH_BOOST = 8;
    const SLOPE_DAMP           = 0.975;
    const MAX_UPHILL_OFFSET    = 88;
    const MAX_DOWNHILL_OFFSET  = 42;

    // ── Pre-compute slope offsets, pivot around PLAYER_VIRTUAL_Z ──
    // Old behavior: slopeOffset accumulated forward from n=0, so n=0
    // (camera plane) was the stable point and far segments pitched
    // around it.  Problem: the player CAR sits visually at
    // PLAYER_VIRTUAL_Z (~15 segments ahead), not at n=0, so on a
    // downhill the road under the visual car dropped while the sprite
    // tried to chase it — reading as "floating".
    //
    // New behavior: compute the raw slope offsets in a first pass,
    // then subtract the offset value at N_PIVOT so segment N_PIVOT
    // has offset = 0.  The road UNDER the car is planted, and the
    // horizon / near-camera ribbon pitches around the player.
    const slopeRaw = new Array(DRAW_DIST);
    {
      let so = 0;
      for (let n = 0; n < DRAW_DIST; n++) {
        slopeRaw[n] = so;
        const segIdx = (startSegIdx + n) % this.segments.length;
        const seg    = this.segments[segIdx];
        const gradePct   = clamp(seg.gradePct ?? 0, -0.075, 0.075);
        const pitchBoost = gradePct >= 0 ? UPHILL_PITCH_BOOST : DOWNHILL_PITCH_BOOST;
        so = clamp(so * SLOPE_DAMP - gradePct * pitchBoost,
                   -MAX_UPHILL_OFFSET, MAX_DOWNHILL_OFFSET);
      }
    }
    const _slopeAt = (fIdx) => {
      const idxA = Math.max(0, Math.min(DRAW_DIST - 1, Math.floor(fIdx)));
      const idxB = Math.max(0, Math.min(DRAW_DIST - 1, idxA + 1));
      const t    = Math.max(0, Math.min(1, fIdx - idxA));
      return (slopeRaw[idxA] || 0) + ((slopeRaw[idxB] || slopeRaw[idxA] || 0) - (slopeRaw[idxA] || 0)) * t;
    };
    // drawn[n] is projected at relative depth n*SEG + SEG/2 - cameraZ.
    // To pivot at PLAYER_VIRTUAL_Z in camera space, convert that relative
    // Z back into the matching fractional drawn index.  The previous
    // rounded index ignored cameraZ, so the pivot slid/snap-stepped as
    // the player crossed segment boundaries.
    const pivotFIdx = (PLAYER_VIRTUAL_Z + cameraZ - SEG_LENGTH / 2) / SEG_LENGTH;
    const pivotOffset = _slopeAt(pivotFIdx);

    // At high Gummies dosage, bend the projected world as one liquid
    // surface. Entity placement reads the matching surface cache below, so
    // traffic and pickups remain planted on the pavement while it ripples.
    const gummiesMelt = clamp(effects?.gummiesMelt ?? 0, 0, 1);
    const gummiesPhase = effects?.gummiesPhase ?? 0;
    const _meltStrengthAt = (depthIdx) => {
      const near = 1 - clamp(depthIdx / DRAW_DIST, 0, 1);
      return 0.24 + Math.pow(near, 0.72) * 0.76;
    };
    const _meltXAt = (depthIdx) => {
      if (gummiesMelt <= 0.001) return 0;
      const phase = gummiesPhase * 1.10 + depthIdx * 0.105;
      return (Math.sin(phase) + Math.sin(phase * 0.39 + 1.8) * 0.55)
        * 32 * gummiesMelt * _meltStrengthAt(depthIdx);
    };
    const _meltYAt = (depthIdx) => {
      if (gummiesMelt <= 0.001) return 0;
      const phase = gummiesPhase * 0.74 + depthIdx * 0.088 + 1.2;
      return (Math.sin(phase) + Math.sin(phase * 0.51 + 2.4) * 0.45)
        * 9 * gummiesMelt * _meltStrengthAt(depthIdx);
    };

    // We store projected data so we can draw far→near
    const drawn = [];

    // Issaquah valley fog (mile 14-25): pull the distance haze far closer
    // and lay a soft wash over even the nearest segments so the road melts
    // into a pale wall ahead — a strong sense-of-depth cue through the basin.
    // Zero outside the fog window, so distance fog is unchanged everywhere
    // else.  (_mileNow + Weather are already in scope from the top of render.)
    // Kept GENTLE on purpose: a hard exponent pull-in makes adjacent
    // per-segment fog rects (painted full-width at 3469) jump enough in
    // alpha to read as horizontal step-lines across the distant scenery.
    // The heavy "socked-in" look is carried by the SMOOTH screen-space haze
    // in EffectsSystem instead; here we only add a soft distant fade.
    const _fogZone  = (Weather.isFog(_mileNow) ? Weather.intensity(_mileNow) : 0)
                    * (Weather._fogClarityMul ?? 1);   // fog lights thin the distance fog too
    const _fogExp   = FOG_DENSITY - 1.5 * _fogZone;   // 4 → ~2.5 in full fog (step-safe; thickness via the floor below)
    const _fogFloor = 0.30 * _fogZone;                // stronger near-seg wash (50% thicker)

    for (let n = 0; n < DRAW_DIST; n++) {
      const segIdx = (startSegIdx + n) % this.segments.length;
      const seg    = this.segments[segIdx];

      // World z relative to camera
      const worldZ = n * SEG_LENGTH + SEG_LENGTH / 2;

      const p = project(
        0, seg.y * ELEV_MULT, worldZ,
        cameraX, cameraY, cameraZ,
        CAM.depth, SCREEN_W, SCREEN_H,
        ROAD_WIDTH * (seg.roadScale ?? 1),
        H()
      );

      if (!p || p.y < 0) continue;

      // Fog: 0 = no fog, 1 = fully fogged.  Exponent + floor lift in the
      // Issaquah fog zone (see _fogZone above) so the haze fills the basin.
      let fog = Math.min(1, Math.pow(n / DRAW_DIST, _fogExp));
      if (_fogFloor > 0) fog = Math.min(1, fog + _fogFloor * (1 - fog));

      // Slope offset — relative to the pivot at PLAYER_VIRTUAL_Z so
      // the road UNDER the visual player car stays planted on slopes.
      const slopeOffset = slopeRaw[n] - pivotOffset;
      const meltIdx = n + 0.5;
      drawn.push({
        seg, n, fog,
        relZ:    worldZ - cameraZ,
        screenX: p.x + screenX + _meltXAt(meltIdx),
        screenY: p.y + slopeOffset + _meltYAt(meltIdx),
        screenW: p.w,
        scale:   p.scale,
        visible: false,   // flipped to true in the render pass below if
                          // this segment actually paints (not crest-clipped,
                          // not below the screen bottom).  NPC cars / sprite
                          // pickups query this via getVehicleProjection() —
                          // a relZ that lands on an invisible segment
                          // returns null so the sprite is culled.
      });

      // (slope accumulation moved to the pre-pass above the loop)
      screenX  += screenDX;
      screenDX += seg.curve;
    }

    // No pre-pass dark fill — the tunnel is now rendered entirely
    // per-segment as wall + ceiling trapezoids that hug the road's
    // perspective.  This keeps the blue sky / horizon untouched
    // outside the tunnel structure (no more "dark consuming the
    // entire skyline").
    //
    // Stash the first visible tunnel segment for the post-pass
    // entrance-arch paint — only used when the player isn't already
    // inside (drawn[0] isn't tunnel).
    let _firstTunnelDrawn = null;
    let _firstTunnelIdx   = -1;
    for (let i = 0; i < drawn.length; i++) {
      if (drawn[i].seg?.tunnel) { _firstTunnelDrawn = drawn[i]; _firstTunnelIdx = i; break; }
    }

    // Render far → near so near overwrites far
    for (let i = drawn.length - 1; i >= 0; i--) {
      const curr = drawn[i];
      const next = i > 0 ? drawn[i - 1] : curr;

      if (curr.screenY < maxScreenY) continue;
      maxScreenY = curr.screenY;

      // Skip segments whose top edge is below the screen bottom.
      // Off-screen trapezoids with huge coordinates can corrupt the WebGL pipeline.
      if (curr.screenY > SCREEN_H) continue;

      curr.visible = true;
      this._drawSegment(g, curr, next, palette, effects);
    }

    // ── Tunnel entrance: hillside silhouette + portal arch ────────────
    // The tunnel is cut INTO a hill, so what the player sees on the
    // horizon is a SLOPED hillside with the tunnel mouth as a notch in
    // its base.  The hill is drawn as one concave polygon: peak above
    // the mouth, flanks dropping diagonally to ground level on each
    // side, with a rectangular cutout for the mouth opening.
    //
    // Crucially we look BEYOND DRAW_DIST for the next tunnel segment so
    // the hill grows naturally on the horizon as the player approaches,
    // rather than blinking in at full size when the tunnel road becomes
    // visible.
    let _embTunnelProj = null;
    // Only render the embankment hill when the tunnel mouth is at least
    // a few segments out — otherwise its base (anchored to the mouth's
    // projected road-Y) ends up near the bottom of the screen and the
    // hill polygon paints over the road in front of the player.  At a
    // distance of ~30 segs the hill silhouette sits cleanly above the
    // horizon and frames the approach.
    const EMB_MIN_DIST = 30;
    if (_firstTunnelDrawn && _firstTunnelIdx >= EMB_MIN_DIST) {
      _embTunnelProj = _firstTunnelDrawn;
    } else if (!_firstTunnelDrawn) {
      // Continue the curve accumulator past the draw loop so the
      // far-out projection inherits the right lateral offset.
      const EXTRA_PEEK = 600;
      let pSx  = screenX;
      let pSdx = screenDX;
      for (let n = DRAW_DIST; n < DRAW_DIST + EXTRA_PEEK; n++) {
        const segIdx = (startSegIdx + n) % this.segments.length;
        const s = this.segments[segIdx];
        if (!s) break;
        if (s.tunnel) {
          const worldZ = n * SEG_LENGTH + SEG_LENGTH / 2;
          const p = project(
            0, s.y * ELEV_MULT, worldZ,
            cameraX, cameraY, cameraZ,
            CAM.depth, SCREEN_W, SCREEN_H,
            ROAD_WIDTH * (s.roadScale ?? 1),
            H()
          );
          if (p) {
            _embTunnelProj = {
              seg: s, n, scale: p.scale,
              screenX: p.x + pSx + _meltXAt(n + 0.5),
              screenY: p.y + _meltYAt(n + 0.5),
              screenW: p.w,
            };
          }
          break;
        }
        pSx  += pSdx;
        pSdx += s.curve ?? 0;
      }
    }

    // Facade drawing MOVED into _drawTunnelFacade(), invoked from
    // renderTunnelOverlay() so it paints on tunnelGfx (depth 9.82) AFTER
    // scene sprites — that way buildings geographically behind the tunnel
    // can't bleed through the concrete face.  Store the projection so
    // the overlay pass can read it without re-walking the segments.
    this._embTunnelProj = _embTunnelProj;
    // Also publish the first-visible-tunnel segment N so the scenery
    // renderer can cull buildings whose segments sit past the mouth.
    this._firstTunnelN = _firstTunnelIdx >= 0
      ? _firstTunnelIdx
      : (_embTunnelProj?.n ?? -1);
    // If the camera itself is inside a tunnel (drawn[0] is tunnel),
    // also publish the index of the FIRST non-tunnel segment ahead —
    // i.e., where the tunnel ends.  Buildings past the exit are
    // visible through the mouth and must NOT be culled by the
    // past-tunnel rule in the scenery renderer.
    let _lastTunnelN = -1;
    if (drawn.length > 0 && drawn[0]?.seg?.tunnel) {
      for (let i = 0; i < drawn.length; i++) {
        if (!drawn[i]?.seg?.tunnel) {
          _lastTunnelN = drawn[i].n;
          break;
        }
      }
      // Camera fully inside the tunnel for the entire visible range —
      // every drawn segment is tunnel; far buildings stay culled.
      if (_lastTunnelN < 0) _lastTunnelN = drawn[drawn.length - 1]?.n ?? -1;
    }
    this._cameraInTunnel = drawn.length > 0 && !!drawn[0]?.seg?.tunnel;
    this._tunnelExitN    = _lastTunnelN;

    // Render sprites FAR → NEAR so close-up buildings paint over distant ones
    // (drawn[] is built near→far, so iterate backwards). Without this,
    // distant skyscrapers showed THROUGH closer houses.
    for (let i = drawn.length - 1; i >= 0; i--) {
      this._drawSprites(g, drawn[i]);
    }

    // Stash for vehicle-projection lookup (GameScene needs the curve-accumulated
    // screenX so traffic stays in its lane through bends).
    this._drawn = drawn;

    // ── Build boundary surface cache (no new allocations) ─────────
    // surfaceSamples[n] is the projected road position at the boundary
    // between segment n-1 and n (worldZ = n * SEG_LENGTH).  Players,
    // NPCs, shoulder polylines and shadows all read from this single
    // canonical source so road graphics and entities stay in sync.
    {
      const slopeBnd = this._slopeBnd;
      let so = 0;
      slopeBnd[0] = 0;
      for (let n = 0; n < DRAW_DIST; n++) {
        const segIdx = ((startSegIdx + n) % this.segments.length + this.segments.length) % this.segments.length;
        const seg = this.segments[segIdx];
        const gradePct   = clamp(seg.gradePct ?? 0, -0.075, 0.075);
        const pitchBoost = gradePct >= 0 ? UPHILL_PITCH_BOOST : DOWNHILL_PITCH_BOOST;
        so = clamp(so * SLOPE_DAMP - gradePct * pitchBoost,
                   -MAX_UPHILL_OFFSET, MAX_DOWNHILL_OFFSET);
        slopeBnd[n + 1] = so;
      }
      const _slopeBndAt = (fIdx) => {
        const idxA = Math.max(0, Math.min(DRAW_DIST, Math.floor(fIdx)));
        const idxB = Math.max(0, Math.min(DRAW_DIST, idxA + 1));
        const t    = Math.max(0, Math.min(1, fIdx - idxA));
        return (slopeBnd[idxA] || 0) + ((slopeBnd[idxB] || slopeBnd[idxA] || 0) - (slopeBnd[idxA] || 0)) * t;
      };
      // Boundary n is projected at camera-space depth n*SEG - cameraZ.
      // Convert PLAYER_VIRTUAL_Z into the corresponding fractional
      // boundary index so the pitch pivot is continuous within segments.
      const pivOff_B = _slopeBndAt((PLAYER_VIRTUAL_Z + cameraZ) / SEG_LENGTH);

      const samples = this._surfaceSamples;
      let bsx = 0, bsdx = 0;
      for (let n = 0; n <= DRAW_DIST; n++) {
        const segIdx = ((startSegIdx + Math.min(n, DRAW_DIST - 1)) % this.segments.length + this.segments.length) % this.segments.length;
        const seg = this.segments[segIdx];
        const worldZ = n * SEG_LENGTH;
        const cz = worldZ - cameraZ;
        const s = samples[n];
        if (cz <= 0) {
          // At/behind camera plane — mark invalid.  Boundary 0 typically
          // lands here right after a position update.
          s.valid = false;
        } else {
          const scale = CAM.depth / cz;
          const projX = (SCREEN_W / 2) + scale * (0 - cameraX) * SCREEN_W / 2;
          // H() is horizon Y; SCREEN_H/2 is the elevation scaling factor.
          const projY = H() - scale * (seg.y - cameraY) * SCREEN_H / 2;
          const projW = scale * (ROAD_WIDTH * (seg.roadScale ?? 1)) * SCREEN_W / 2;
          s.worldZ  = worldZ;
          s.screenX = projX + bsx + _meltXAt(n);
          s.screenY = projY + (slopeBnd[n] - pivOff_B) + _meltYAt(n);
          s.screenW = projW;
          s.scale   = scale;
          s.valid   = true;
        }
        if (n < DRAW_DIST) {
          bsx  += bsdx;
          bsdx += seg.curve ?? 0;
        }
      }
      // Visibility: cross-index drawn[] by .n once, then mark each
      // boundary visible if either adjacent segment painted.
      const dByN = this._drawnByN;
      for (let i = 0; i < DRAW_DIST; i++) dByN[i] = null;
      for (let i = 0; i < drawn.length; i++) {
        const d = drawn[i];
        if (d && d.n >= 0 && d.n < DRAW_DIST) dByN[d.n] = d;
      }
      for (let n = 0; n <= DRAW_DIST; n++) {
        const s = samples[n];
        if (!s.valid) { s.visible = false; continue; }
        const left  = n > 0         ? dByN[n - 1] : null;
        const right = n < DRAW_DIST ? dByN[n]     : null;
        s.visible = !!(left?.visible || right?.visible);
      }
      // Terrain-silhouette prefix-min for per-sprite crest occlusion.
      // crestMin[n] = highest painted ground (min screenY) among VISIBLE
      // FLAT-OR-CLIMBING samples strictly nearer than n.  On flat / climbing
      // ground nearer samples sit LOWER (larger Y) than a far structure, so
      // crestMin stays below the structure's base → nothing clips.  Only
      // BEYOND a real crest does a nearer sample rise above the structure,
      // and crestClipY hands that Y to the renderer, which clips the sprite's
      // bottom to it.
      //
      // GRADE GUARD (same lesson as the reverted band occluder): a steep
      // DESCENT — e.g. the West Seattle hilltop dropping toward the bridge —
      // gets a downhill pitch-boost that can project the nearer road HIGHER
      // on screen than the far road, a pure looking-down artifact, NOT a hill
      // in front.  Letting those samples lower crestMin would slice the bases
      // of houses down the slope (the prior bottom-crop failure).  So only
      // flat-or-climbing segments (grade > CREST_MIN_GRADE) form an occluder.
      const CREST_MIN_GRADE = -0.004;
      const crestMin = this._crestMinY;
      let _runMinY = Infinity;
      for (let n = 0; n <= DRAW_DIST; n++) {
        crestMin[n] = _runMinY;
        const s = samples[n];
        if (!s.valid || s.visible === false) continue;
        const d = dByN[n] ?? (n > 0 ? dByN[n - 1] : null);
        if ((d?.seg?.gradePct ?? 0) <= CREST_MIN_GRADE) continue;   // descent → not an occluder
        if (s.screenY < _runMinY) _runMinY = s.screenY;
      }

      // ── Per-column ROAD TOP EDGE for the city-silhouette clip ────────
      // screen-x column → min screenY among visible pavement samples at or
      // above the horizon band.  The procedural skyline paints at the TOP
      // of render() — before this frame's samples exist — so it reads this
      // ONE FRAME STALE; 16 ms of lag is invisible at horizon distance.
      // Why: the silhouette layer (depth 6.9) necessarily outranks roadGfx
      // (1.5), so on a bridge hump / crest, where the pavement rises above
      // the flat horizon line, the blocks stamped straight over the road
      // (owner 2026-08-03).  Samples well below the horizon are skipped —
      // the skyline lives entirely above horizonY and can never collide.
      {
        const colW  = 8;
        const nCols = Math.ceil((SCREEN_W + MARGIN * 2) / colW) + 2;
        if (!this._roadTopCols || this._roadTopCols.length !== nCols) {
          this._roadTopCols = new Float32Array(nCols);
        }
        this._roadTopColW = colW;
        this._roadTopOff  = MARGIN;
        const cols = this._roadTopCols;
        cols.fill(Infinity);
        const hY = H();
        // Ground/water rows span the FULL screen width at every segment
        // (terrain fills, lake bands, port-yard flanks all paint edge to
        // edge), so a row risen above the horizon occludes the skyline in
        // EVERY column — the floating-bridge "buildings on the water" case
        // (owner 2026-08-03), crest humps, and downhill looks alike.
        // Tracked as a scalar and applied once below.
        let rowMin = Infinity;
        for (let n = 0; n <= DRAW_DIST; n++) {
          const s = samples[n];
          if (!s.valid || s.visible === false) continue;
          if (s.screenY > hY + 24) continue;   // far below horizon — irrelevant
          if (s.screenY < rowMin) rowMin = s.screenY;
          // Guardrails ride a touch above the pavement sample; lift the
          // clip line slightly with on-screen size over the ROAD span so
          // rails clip too.
          const topY = s.screenY - s.screenW * 0.06 - 2;
          const x0 = Math.max(0, Math.floor((s.screenX - s.screenW + MARGIN) / colW));
          const x1 = Math.min(nCols - 1, Math.ceil((s.screenX + s.screenW + MARGIN) / colW));
          for (let c = x0; c <= x1; c++) if (topY < cols[c]) cols[c] = topY;
        }
        if (rowMin < Infinity) {
          for (let c = 0; c < nCols; c++) if (rowMin < cols[c]) cols[c] = rowMin;
        }
      }
    }

    // ── Horizon haze fade (terrain layer) ─────────────────────────────
    // The strip just under the horizon line belongs to the flat terrain
    // fill: the farthest projected segments stop a few px short of H(), so
    // between their top edge and the horizon the raw grass colour shows as
    // a dead-flat green band spanning the screen ("the flat green hill").
    // The old procedural mountain range happened to paint over it; the
    // biome bands and scenery plates end AT the horizon, so it surfaced.
    // Proven by layer isolation (hide terrainGfx → band vanishes).
    //
    // Fade the terrain's top ~22 px toward the sky-fog colour so the strip
    // reads as atmospheric haze under whatever backdrop art sits above it.
    // Painted into the TERRAIN layer, so the textured ground plane, the
    // North Bend plate and the road all still draw over it untouched.
    // (The 3-step horizon haze strip that lived here is gone: the fail-safe
    //  world fill above is now itself blended toward skyFogMix, which covers
    //  the whole void between the horizon and the farthest drawn segment —
    //  a fixed 22 px strip could not, and left an unfogged band on descents.)


    // ── Suspension bridge structure (towers + main cables + hangers) ──
    this._drawSuspensionBridge(g, drawn);

    // ── Overpasses (wildlife crossing + I-405 freeway overpass) ──
    this._drawOverpasses(g, drawn);

    // Double-vision ghost pass (Sushi effect).  Pass the lateral
    // offset as a parameter instead of cloning the drawn[] entries —
    // the old `{ ...curr, screenX: curr.screenX + offset }` allocated
    // 200-350 short-lived objects per frame at 60fps when impaired.
    if (ghostG && effects && effects.doubleVision > 0.01) {
      const offset = toInt(effects.doubleVision * 38);
      ghostG.clear();
      ghostG.setAlpha(effects.doubleVision * 0.62);
      for (let i = drawn.length - 1; i >= 0; i--) {
        const curr = drawn[i];
        const next = i > 0 ? drawn[i - 1] : curr;
        // isGhost=true → _drawSegment skips background fills (grass,
        // bridge water, tunnel walls) that would otherwise overlay
        // the player's road with green-tinted grass.
        this._drawSegment(ghostG, curr, next, palette, effects, offset, true);
      }
      // Include sprites in the ghost so trees/buildings also double-vision.
      // isGhost=true → signs are skipped (rendered by GameScene separately).
      for (let i = drawn.length - 1; i >= 0; i--) {
        this._drawSprites(ghostG, drawn[i], true, offset);
      }
    } else if (ghostG) {
      ghostG.clear();
    }
  }

  renderTunnelOverlay(g) {
    if (!g) return;
    g.clear();
    const drawn = this._drawn;
    if (!drawn?.length) return;
    const segLen = this.segments.length;
    const playerPos = this._playerPos ?? 0;
    const camIdx = ((Math.floor(playerPos / SEG_LENGTH)) % segLen + segLen) % segLen;
    const inTunnel = !!this.segments[camIdx]?.tunnel;
    // The opening mask limits the tunnel interior's shape, not its
    // draw order.  On approach, keep it at portal distance so a nearer
    // building can correctly occlude the mouth and interior.
    if (inTunnel) {
      g.setDepth(9.82);
    } else {
      let portalProjection = this._embTunnelProj;
      if (!portalProjection) {
        for (let i = 0; i < drawn.length; i++) {
          if (drawn[i]?.seg?.tunnel) {
            portalProjection = drawn[i];
            break;
          }
        }
      }
      if (portalProjection) {
        const tunnelRelZ = (portalProjection.n ?? DRAW_DIST) * SEG_LENGTH;
        const sceneDepthAtTunnel = 9.5 - Math.max(0, Math.min(1, tunnelRelZ / 76000)) * 2.5;
        g.setDepth(sceneDepthAtTunnel - 0.06);
      } else {
        g.setDepth(9.82);
      }
    }
    if (inTunnel) {
      let farthestTunnel = null;
      for (let k = 0; k < drawn.length; k++) {
        const d = drawn[k];
        if (d?.seg?.tunnel && d.screenY >= 0 && d.screenY <= SCREEN_H) {
          farthestTunnel = d;
        }
      }
      if (farthestTunnel) {
        const H_CEIL = 4500;
        const ceilDrop = farthestTunnel.scale * H_CEIL * SCREEN_H / 2;
        const coverBotY = Math.max(0, farthestTunnel.screenY - ceilDrop);
        if (coverBotY > -150) {
          // Extend X by HUD_OFFSET_X so the tunnel-mouth cover fills the
          // widened (decoupled) canvas instead of leaving bare side strips.
          g.fillStyle(0x6B665B, 1);
          g.fillRect(-150 - C.HUD_OFFSET_X, -150, SCREEN_W + 300 + C.HUD_OFFSET_X * 2, coverBotY + 150);
        }
      }
    }
    if (!inTunnel && this._tunnelMouthRect) {
      // A curved tunnel must close the sightline through its entrance.
      // Otherwise the unpainted centre of the shell exposes ordinary sky
      // behind the bend until enough nearby wall segments grow on screen.
      let entrance = null;
      let bendClosure = null;
      for (let k = 0; k < drawn.length; k++) {
        const d = drawn[k];
        if (!d?.seg?.tunnel) {
          if (entrance) break;
          continue;
        }
        if (!entrance) {
          entrance = d;
          continue;
        }
        const visibleShift = Math.abs(d.screenX - entrance.screenX);
        if (visibleShift > Math.max(4, entrance.screenW * 0.12)) {
          bendClosure = d;
          break;
        }
      }
      if (!entrance && this._embTunnelProj?.seg?.curvedTunnelClosure) {
        entrance = this._embTunnelProj;
      }
      if (entrance?.seg?.curvedTunnelClosure) {
        const r = this._tunnelMouthRect;
        // On the first distant frame of the Mercer lid, the tagged mouth
        // may be projected before any regular tunnel segment is drawn.
        // Use a recessed rear-wall cap until the bend supplies the edge.
        const capBottom = bendClosure
          ? Math.min(r.y + r.h, bendClosure.screenY + 2)
          : r.y + r.h * 0.82;
        if (capBottom > r.y) {
          // Draw before the nearer shell below; nearer walls/ceiling remain
          // visible in front of this far wall and describe the curve.
          g.fillStyle(0x8F8A7D, 1);
          g.fillRect(r.x, r.y, r.w, capBottom - r.y);
          g.fillStyle(0x6E6660, 0.32);
          g.fillRect(r.x, Math.max(r.y, capBottom - 3), r.w, 3);
        }
      }
    }
    for (let i = drawn.length - 1; i >= 0; i--) {
      const curr = drawn[i];
      if (!curr?.seg?.tunnel) continue;
      const next = i > 0 ? drawn[i - 1] : curr;
      this._drawTunnelShell(g, curr, next);
    }
  }

  /**
   * Tunnel entrance facade — invoked from GameScene._renderFrame() on
   * its own graphics layer (tunnelFacadeGfx).  Sets the layer's depth
   * DYNAMICALLY each frame so the facade slots into the same depth
   * band a scene sprite at the tunnel's distance would occupy:
   *   • sprites CLOSER than the tunnel (higher depth) render OVER the
   *     facade → correct perspective for houses in front of the tunnel
   *   • sprites AT or PAST the tunnel (≤ same depth) render UNDER the
   *     facade → correctly occluded
   *   • past-tunnel buildings are also culled in _renderSceneSprites
   * Skipped while the camera is inside the tunnel.
   */
  renderTunnelFacade(g) {
    // Mouth rect cleared by default; set by _drawTunnelFacade when
    // the facade is actually drawn (camera outside tunnel + valid
    // embankment projection + mouth resolvable at this distance).
    this._tunnelMouthRect = null;
    if (!g) return;
    g.clear();
    const segLen = this.segments.length;
    const playerPos = this._playerPos ?? 0;
    const camIdx = ((Math.floor(playerPos / SEG_LENGTH)) % segLen + segLen) % segLen;
    const inTunnel = !!this.segments[camIdx]?.tunnel;
    if (inTunnel) return;
    const e = this._embTunnelProj;
    if (!e) return;
    // Match scenery depth formula at the tunnel's distance, then nudge
    // down by 0.05 so any sprite AT exact tunnel distance still wins.
    // Formula mirrors _renderSceneSprites: depth = 9.5 - min(1, relZ/76000) * 2.5.
    const tunnelRelZ = (e.n ?? DRAW_DIST) * SEG_LENGTH;
    const sceneDepthAtTunnel = 9.5 - Math.max(0, Math.min(1, tunnelRelZ / 76000)) * 2.5;
    g.setDepth(sceneDepthAtTunnel - 0.05);
    this._drawTunnelFacade(g);
  }

  /**
   * Tunnel entrance facade — the hillside silhouette + portal mouth.
   *
   * Drawn as TWO explicit opaque pieces (left flank + right flank) that
   * meet along the vertical centerline above the mouth.  This is
   * deterministic occlusion: no concave polygons, no cutout edge cases.
   * The mouth opening is simply the rectangular area between the two
   * pieces, below the lintel — left undrawn so the tunnel interior
   * (drawn by _drawTunnelShell) shows through.
   *
   *      ┌─────crest─────┐
   *     /│               │\
   *    / │   LEFT  RIGHT │ \
   *   /  │   FLANK FLANK │  \
   *  /   │               │   \
   *  ──lintel─┐       ┌──lintel──
   *          │  mouth │
   *          │ (open) │
   *  ────────┴────────┴──────── ground
   *
   * The two flanks share the edge (centerX, crestY) → (centerX, lintelY)
   * so the area ABOVE the mouth (between lintel and crest) is filled by
   * the union of both pieces.  Below the lintel, the pieces step LEFT
   * and RIGHT to the mouth jambs and down to ground — leaving the mouth
   * opening empty.
   */
  _drawTunnelFacade(g) {
    const e = this._embTunnelProj;
    if (!e) return;
    // Wildlife twin-arch publishes TWO arch openings here (the interior shows
    // only through these, so the solid center pier stays opaque).  null on
    // every other facade → GameScene falls back to the _tunnelMouthRect.
    this._tunnelMouthShapes = null;

    const w2 = e.screenW;
    const x2 = e.screenX;
    const segLanes = e.seg?.lanes ?? 4;
    const rw2    = rumbleW(w2, segLanes);
    const wallW2 = w2 * 0.95;
    const outerL = x2 - w2 - rw2 - wallW2;
    const outerR = x2 + w2 + rw2 + wallW2;

    const sH = e.scale * SCREEN_H / 2;
    const sW = e.scale * SCREEN_W / 2;

    // Lintel + hill geometry, all in world units so they scale with
    // perspective.  Wildlife crossing — a low, compact concrete deck,
    // not a mountain — so HILL height and FLANK width are dialed down
    // significantly.  Mt Baker / Mercer Island keep their full
    // mountain-sized silhouette.
    const isWildlifeFacade = !!e.seg?.wildlife;
    const H_CEIL  = 4500;
    // Wildlife crossing — a low concrete deck, not a mountain.  Hill
    // needs to be wide enough that the flank ramps reach a crest
    // ABOVE the arch top (otherwise the silhouette ends partway up
    // and looks unfinished).  Crest height is sized to sit just
    // above the arch peak.
    const H_HILL  = isWildlifeFacade ? 20000 : 25000;
    // Wildlife flank — 4× wider than the previous 40 000 so the single
    // arch shape has room to read as a broad concrete dome instead of
    // a sharp peak directly over the road.
    const W_FLANK = isWildlifeFacade ? 160000 : 337500;

    const ceilDrop = H_CEIL * sH;
    const archTopY = e.screenY - ceilDrop;
    const archThk  = Math.max(3, ceilDrop * 0.42);
    const lintelY  = archTopY - archThk;
    const crestY   = e.screenY - H_HILL * sH;
    // Hill base = tunnel's projected road Y.  Previously this was
    // clamped to SCREEN_H * 0.55 (mid-screen) "to keep the polygon
    // from painting over the asphalt" — but that left a visible GAP
    // between the hill's bottom edge and the actual tunnel-road
    // surface on screen, through which the player could see the
    // tunnel interior / horizon / scenery that the front wall is
    // supposed to occlude.  The polygon doesn't actually overlap the
    // foreground road because the foreground road sits BELOW e.screenY
    // in screen space (closer to the bottom), while the hill polygon
    // sits ABOVE e.screenY (its upper bound is crestY).
    const groundY  = e.screenY;
    const flankX   = W_FLANK * sW;
    const baseLeftX  = outerL - flankX;
    const baseRightX = outerR + flankX;
    const centerX    = (outerL + outerR) / 2;
    const dropY      = groundY - crestY;

    const peekFog = clamp(e.n / DRAW_DIST, 0, 4);
    const baseAlpha = 1;
    const rimAlpha  = clamp(1 - Math.pow(peekFog * 0.45, 1.4), 0.30, 1);

    const cutMouth = (groundY - lintelY) > 4 && (outerR - outerL) > 6;

    // ════ Wildlife overpass — TWIN-ARCH (two carriageways + center pier) ════
    // A short, LOW cement overpass — a hill over the road so animals cross
    // safely — NOT a mountain or a wall.  Two segmental arches (one per
    // direction of travel) flank a SOLID central pier on the median, with a
    // low earthen mound on top sloping down to the forest on each side.
    // Solid cement everywhere except the two arch openings (you can't see
    // through the walls), narrow enough that sky/forest shows to the sides.
    // Drawn entirely here, then returns — the normal-tunnel code below is
    // UNTOUCHED (Mt Baker / Mercer lid render exactly as before).  Geometry
    // validated non-self-intersecting across the perspective range.
    if (isWildlifeFacade) {
      const mouthW = outerR - outerL;
      if (!cutMouth || mouthW < 8) {
        // Too far / too small to cut openings — a plain solid mound that
        // still occludes whatever is behind the crossing.
        const fX = mouthW * 0.32;
        const topY = e.screenY - 9000 * sH;
        g.fillStyle(0xB7B0A0, 1);
        g.fillPoints([
          { x: outerL - fX, y: groundY }, { x: outerL, y: topY },
          { x: outerR, y: topY }, { x: outerR + fX, y: groundY },
        ], true);
        this._tunnelMouthRect = null;
        return;
      }
      const pierHalf  = Math.max(2, mouthW * 0.05);   // center pier on the median
      const pierL     = centerX - pierHalf;
      const pierR     = centerX + pierHalf;
      const archHalfL = (pierL - outerL) * 0.5;
      const archHalfR = (outerR - pierR) * 0.5;
      const jambH     = Math.max(2, Math.min(archHalfL, archHalfR) * 0.30);
      const wSpringY  = groundY - jambH;              // arch springer line
      const riseL     = Math.max(2, archHalfL * 0.92);
      const riseR     = Math.max(2, archHalfR * 0.92);
      const crownYL   = wSpringY - riseL;
      const crownYR   = wSpringY - riseR;
      const deckBand  = Math.max(3, Math.min(archHalfL, archHalfR) * 0.45);
      const wCrestY   = Math.min(crownYL, crownYR) - deckBand;   // low mound top
      const wFlankX   = mouthW * 0.32;
      const wBaseL    = outerL - wFlankX;
      const wBaseR    = outerR + wFlankX;
      const wSlopeY   = groundY - (groundY - wCrestY) * 0.78;
      const A_N = 14;
      const archCurve = (x0, x1, rise) => {
        const pts = [];
        for (let s = 0; s <= A_N; s++) {
          const t = s / A_N;
          pts.push({ x: x0 + (x1 - x0) * t, y: wSpringY - rise * Math.sin(Math.PI * t) });
        }
        return pts;
      };
      const leftArch  = archCurve(outerL, pierL, riseL);   // outerL → pierL springers
      const rightArch = archCurve(pierR, outerR, riseR);   // pierR → outerR springers

      // SOLID cement — two pieces split at the centerline, each carving one
      // arch on its outer half and meeting at the solid pier in the middle.
      const leftPiece = [
        { x: wBaseL,                  y: groundY },
        { x: (wBaseL + outerL) * 0.5, y: wSlopeY },
        { x: outerL,                  y: wCrestY },
        { x: centerX,                 y: wCrestY },
        { x: centerX,                 y: groundY },
        { x: pierL,                   y: groundY },
        ...leftArch.slice().reverse(),
        { x: outerL,                  y: groundY },
      ];
      const rightPiece = [
        { x: wBaseR,                  y: groundY },
        { x: (wBaseR + outerR) * 0.5, y: wSlopeY },
        { x: outerR,                  y: wCrestY },
        { x: centerX,                 y: wCrestY },
        { x: centerX,                 y: groundY },
        { x: pierR,                   y: groundY },
        ...rightArch,
        { x: outerR,                  y: groundY },
      ];
      g.fillStyle(0xB7B0A0, 1);
      g.fillPoints(leftPiece, true);
      g.fillPoints(rightPiece, true);

      // Rim highlight tracing the mound silhouette.
      if (sH > 0.02) {
        const rimDrop = Math.max(2, (groundY - wCrestY) * 0.03);
        const top = [
          { x: wBaseL,                  y: groundY },
          { x: (wBaseL + outerL) * 0.5, y: wSlopeY },
          { x: outerL,                  y: wCrestY },
          { x: outerR,                  y: wCrestY },
          { x: (wBaseR + outerR) * 0.5, y: wSlopeY },
          { x: wBaseR,                  y: groundY },
        ];
        g.fillStyle(0xCFC9B6, rimAlpha);
        g.fillPoints([...top, ...top.slice().reverse().map(p => ({ x: p.x, y: p.y + rimDrop }))], true);
      }

      // Subtle vertical shading on the SOLID center pier so it reads as a
      // distinct column between the two arches.
      if (pierR - pierL > 1.5) {
        const pierTop = Math.min(crownYL, crownYR);
        g.fillStyle(0x9F988A, 0.30);
        g.fillRect(pierL, pierTop, pierR - pierL, groundY - pierTop);
      }

      // Arch ring + inner-recess shadow for each opening.
      if (sH > 0.03) {
        const ring = (arch, rise) => {
          const rw = Math.max(1.5, rise * 0.10);
          g.fillStyle(0xC4BFA8, 1);
          g.fillPoints([...arch.map(p => ({ x: p.x, y: p.y - rw })), ...arch.slice().reverse()], true);
          g.fillStyle(0x2A2620, 0.5);
          g.fillPoints([...arch, ...arch.slice().reverse().map(p => ({ x: p.x, y: p.y + Math.max(1, rise * 0.06) }))], true);
        };
        ring(leftArch, riseL);
        ring(rightArch, riseR);
      }

      // Publish the two arch OPENINGS (interior shows ONLY through these) +
      // a bounding rect for sprite culling.
      const opening = (arch) => ([
        ...arch,
        { x: arch[arch.length - 1].x, y: groundY },
        { x: arch[0].x,               y: groundY },
      ]);
      this._tunnelMouthShapes = [opening(leftArch), opening(rightArch)];
      const mTop = Math.min(crownYL, crownYR);
      this._tunnelMouthRect = { x: outerL, y: mTop, w: mouthW, h: groundY - mTop };
      return;
    }

    // Publish the tunnel-mouth screen rectangle so GameScene can:
    //   (a) mask the tunnel interior (tunnelGfx) to ONLY render
    //       inside the mouth opening — interior can't bleed past
    //       the facade anymore
    //   (b) cull scene sprites whose screen bounding box overlaps
    //       the mouth (their transparent PNG padding would otherwise
    //       let the masked interior peek through)
    if (cutMouth) {
      // Mask rect: rectangular tunnels mask from lintelY down; the
      // arched wildlife crossing extends the mask up to the arch peak.
      const mouthTopY = isWildlifeFacade
        ? (lintelY - (outerR - outerL) * 0.5)
        : lintelY;
      this._tunnelMouthRect = {
        x: outerL,
        y: mouthTopY,
        w: outerR - outerL,
        h: groundY - mouthTopY,
      };
    } else {
      this._tunnelMouthRect = null;
    }

    // ── Arched mouth ─────────────────────────────────────────────────
    // Replace the rectangular lintel + jambs with a semicircular arch.
    // Arch springers sit at (outerL, lintelY) / (outerR, lintelY); the
    // arch peaks at (centerX, lintelY - mouthRadius).  The flank
    // polygons trace this curve from the centerline DOWN to each
    // jamb.  Quarter-circle sampled at ARCH_STEPS points per side.
    const mouthRadius = (outerR - outerL) * 0.5;
    const archPeakY   = lintelY - mouthRadius;
    const ARCH_STEPS  = 14;
    // Left half of the arch — from peak (θ=0) down to left springer (θ=π/2).
    //   x = centerX - mouthRadius * sin(θ)
    //   y = lintelY - mouthRadius * cos(θ)
    const archLeftPoints = [];
    for (let s = 0; s <= ARCH_STEPS; s++) {
      const th = (s / ARCH_STEPS) * Math.PI * 0.5;
      archLeftPoints.push({
        x: centerX - mouthRadius * Math.sin(th),
        y: lintelY - mouthRadius * Math.cos(th),
      });
    }
    const archRightPoints = archLeftPoints.map(p => ({
      x: 2 * centerX - p.x,
      y: p.y,
    }));

    // ── Left flank polygon ────────────────────────────────────────────
    // Traced clockwise: base-left → up silhouette to crest → DOWN to
    // arch peak → along left half of arch curve → DOWN the jamb → back
    // along ground to base.  When cutMouth is false (far away), the
    // polygon simply closes at (centerX, groundY) with no mouth notch.
    //
    // Shape profile differs by structure type:
    //   - Normal tunnels (Mt Baker, Mercer Island): gentle 4-step
    //     hillside rising to a natural peak.
    //   - Wildlife crossing: near-vertical sides + flat top (concrete
    //     slab silhouette, not a mountain).
    // Shape profile differs by structure type:
    //   - Normal tunnels (Mt Baker, Mercer Island): single mountain
    //     rising to a peak above the centerline, with a rectangular
    //     mouth cut into its base.
    //   - Wildlife crossing: TWO sine-curve mounds, one on each side
    //     of the arch, each with its own peak.  The arch is the
    //     freestanding span connecting them, with its top BELOW the
    //     mound peaks.
    let leftFlankPoints, rightFlankPoints, leftMouthTrace, rightMouthTrace;
    if (isWildlifeFacade) {
      // ONE WIDE ARCH — single smooth half-dome silhouette from
      // (baseLeftX, groundY) sweeping up to (centerX, crestY) and back
      // down to (baseRightX, groundY).  The mouth (arched opening) is
      // cut into the base.  Per user spec, W_FLANK is now 4× the
      // previous mound layout so the dome reads broad, not pointed.
      const N_ARCH = 12;
      const leftHalf  = [];
      const rightHalf = [];
      for (let s = 0; s <= N_ARCH; s++) {
        const t = s / N_ARCH;                  // 0..1 across left half
        // Left half-arch: sin(t*π/2) → 0 at base, 1 at crest.
        leftHalf.push({
          x: baseLeftX + (centerX - baseLeftX) * t,
          y: groundY - dropY * Math.sin(t * Math.PI / 2),
        });
        // Right half-arch: cos(t*π/2) → 1 at crest, 0 at base.
        rightHalf.push({
          x: centerX + (baseRightX - centerX) * t,
          y: groundY - dropY * Math.cos(t * Math.PI / 2),
        });
      }
      leftFlankPoints  = leftHalf;        // baseLeft → crest at centerX
      rightFlankPoints = rightHalf;       // crest at centerX → baseRight
      // After flank arrives at (centerX, crestY), drop vertically along
      // the centerline to the arch peak, then trace the half-arch curve
      // down to the springer and DOWN the jamb to the ground.
      leftMouthTrace = [
        { x: centerX,                    y: archPeakY },
        ...archLeftPoints,                                 // peak → springer
        { x: outerL,                     y: groundY },
      ];
      rightMouthTrace = [
        { x: outerR,                     y: groundY },
        ...archRightPoints.slice().reverse(),              // springer → peak
        { x: centerX,                    y: archPeakY },
      ];
    } else {
      // Normal highway tunnel — single mountain to centerline.
      leftFlankPoints = [
        { x: baseLeftX,                  y: groundY },
        { x: baseLeftX + flankX * 0.30,  y: groundY - dropY * 0.28 },
        { x: baseLeftX + flankX * 0.62,  y: groundY - dropY * 0.62 },
        { x: baseLeftX + flankX * 0.88,  y: groundY - dropY * 0.92 },
        { x: centerX,                    y: crestY },
      ];
      rightFlankPoints = [
        { x: centerX,                    y: crestY },
        { x: baseRightX - flankX * 0.88, y: groundY - dropY * 0.92 },
        { x: baseRightX - flankX * 0.62, y: groundY - dropY * 0.62 },
        { x: baseRightX - flankX * 0.30, y: groundY - dropY * 0.28 },
        { x: baseRightX,                 y: groundY },
      ];
      // Rectangular mouth (centerline → lintel → jamb → ground).
      leftMouthTrace = [
        { x: centerX,                    y: lintelY },
        { x: outerL,                     y: lintelY },
        { x: outerL,                     y: groundY },
      ];
      rightMouthTrace = [
        { x: outerR,                     y: groundY },
        { x: outerR,                     y: lintelY },
        { x: centerX,                    y: lintelY },
      ];
    }

    const leftPiece = cutMouth ? [
      ...leftFlankPoints,
      ...leftMouthTrace,
    ] : [
      ...leftFlankPoints,
      { x: centerX,                      y: groundY },
    ];

    // ── Right flank polygon (mirror) ──────────────────────────────────
    const rightPiece = cutMouth ? [
      ...rightMouthTrace,
      ...rightFlankPoints,
    ] : [
      ...rightFlankPoints,
      { x: centerX,                      y: groundY },
    ];

    // Concrete face — both pieces solid-fill, no overlap issues since
    // they share only the centerline edge.
    g.fillStyle(0xB7B0A0, baseAlpha);
    g.fillPoints(leftPiece, true);
    g.fillPoints(rightPiece, true);

    // Lighter rim band along the upper silhouette — a thin highlight
    // strip hugging the top edge.  Built from the OUTER silhouette of
    // both pieces (base-left → peak → base-right) so the rim wraps
    // continuously across the structure.
    if (sH > 0.02) {
      const rimDrop = Math.max(2, dropY * 0.035);
      // Mirror the flank shape used by the main pieces (wildlife =
      // slab silhouette, normal tunnel = gentle ramp).  Without this
      // the rim band traced a soft mountain over a slab structure.
      const upper = [
        ...leftFlankPoints,
        ...rightFlankPoints,
      ];
      const rimBand = [
        ...upper,
        ...upper.slice().reverse().map(p => ({ x: p.x, y: p.y + rimDrop })),
      ];
      g.fillStyle(0xCFC9B6, rimAlpha);
      g.fillPoints(rimBand, true);
    }

    // Mouth decoration — arch ring for wildlife, rectangular lintel
    // beam for normal highway tunnels (Mt Baker, Mercer Island).
    if (cutMouth && archThk > 1 && isWildlifeFacade) {
      const stroke = Math.max(1.2, archThk * 0.10);
      // ── Arch RING — paint a band of slightly lighter concrete just
      // outside the arch opening (extruded outward by `ringW`). ─────
      const ringW = Math.max(3, archThk * 0.55);
      const outerArch = [];
      const innerArch = [];
      for (let s = 0; s <= ARCH_STEPS; s++) {
        const th = (s / ARCH_STEPS) * Math.PI;     // 0 → π across full arch
        const cosT = Math.cos(th);
        const sinT = Math.sin(th);
        innerArch.push({
          x: centerX - mouthRadius * cosT,
          y: lintelY - mouthRadius * sinT,
        });
        outerArch.push({
          x: centerX - (mouthRadius + ringW) * cosT,
          y: lintelY - (mouthRadius + ringW) * sinT,
        });
      }
      const ringPoly = [...outerArch, ...innerArch.slice().reverse()];
      g.fillStyle(0xC4BFA8, 1);
      g.fillPoints(ringPoly, true);
      g.fillStyle(0xCFC9B6, rimAlpha);
      const hiPoly = [
        ...outerArch,
        ...outerArch.slice().reverse().map(p => ({
          x: p.x,
          y: p.y + Math.max(1, archThk * 0.18),
        })),
      ];
      g.fillPoints(hiPoly, true);
      const shadowArch = [];
      for (let s = 0; s <= ARCH_STEPS; s++) {
        const th = (s / ARCH_STEPS) * Math.PI;
        shadowArch.push({
          x: centerX - mouthRadius * Math.cos(th),
          y: lintelY - mouthRadius * Math.sin(th),
        });
      }
      const innerShadow = [];
      for (let s = ARCH_STEPS; s >= 0; s--) {
        const th = (s / ARCH_STEPS) * Math.PI;
        const r2 = mouthRadius - stroke * 1.4;
        innerShadow.push({
          x: centerX - r2 * Math.cos(th),
          y: lintelY - r2 * Math.sin(th),
        });
      }
      g.fillStyle(0x2A2620, 0.55);
      g.fillPoints([...shadowArch, ...innerShadow], true);
      g.fillStyle(0x4A453B, 1);
      g.fillRect(outerL - stroke * 0.5, lintelY,
                 stroke, Math.max(0, groundY - lintelY));
      g.fillRect(outerR - stroke * 0.5, lintelY,
                 stroke, Math.max(0, groundY - lintelY));
      const innerInset = Math.max(2, stroke * 1.4);
      g.fillStyle(0x2A2620, 0.55);
      g.fillRect(outerL + stroke * 0.5, lintelY,
                 innerInset, Math.max(0, groundY - lintelY));
      g.fillRect(outerR - stroke * 0.5 - innerInset, lintelY,
                 innerInset, Math.max(0, groundY - lintelY));
    } else if (cutMouth && archThk > 1) {
      // ── Rectangular lintel beam (normal highway tunnels) ────────
      const archW = outerR - outerL;
      const lintelL = outerL - archThk * 0.4;
      const lintelW = archW + archThk * 0.8;
      const lintelTopY = archTopY - archThk;
      g.fillStyle(0xC4BFA8, 1);
      g.fillRect(lintelL, lintelTopY, lintelW, archThk);
      // Board-form imprints — vertical lines from the wood-form pour.
      const formSpacingPx = Math.max(3, 10000 * sW);
      if (formSpacingPx >= 3 && lintelW > formSpacingPx * 1.5) {
        const formAlpha = clamp(rimAlpha * 0.55, 0.15, 0.55);
        g.fillStyle(0x877F6C, formAlpha);
        for (let lx = lintelL + formSpacingPx; lx < lintelL + lintelW; lx += formSpacingPx) {
          g.fillRect(lx, lintelTopY, 1, archThk);
        }
        // Horizontal pour-seam — mid-height of beam.
        g.fillStyle(0x6F6655, formAlpha * 0.9);
        g.fillRect(lintelL, lintelTopY + Math.floor(archThk * 0.5), lintelW, 1);
      }
      // Lighter rim band along the lintel TOP.
      g.fillStyle(0xCFC9B6, rimAlpha);
      g.fillRect(lintelL, lintelTopY,
                 lintelW, Math.max(1, archThk * 0.22));
      // Darken only the opening so the tunnel reads deeper without
      // adding perspective-sensitive detail across the facade face.
      g.fillStyle(0x08090A, 0.32);
      g.fillRect(outerL, archTopY,
                 archW, Math.max(0, groundY - archTopY));
      // Soft shadow under the lintel.
      g.fillStyle(0x000000, 0.35);
      g.fillRect(outerL, archTopY,
                 archW, Math.max(1, archThk * 0.30));
      // Dark stroke on jamb edges + lintel underside.
      const stroke = Math.max(1.2, archThk * 0.10);
      g.fillStyle(0x4A453B, 1);
      g.fillRect(outerL - stroke * 0.5, archTopY,
                 stroke, Math.max(0, groundY - archTopY));
      g.fillRect(outerR - stroke * 0.5, archTopY,
                 stroke, Math.max(0, groundY - archTopY));
      g.fillRect(outerL - stroke * 0.5, archTopY - stroke * 0.3,
                 archW + stroke, stroke);
      // Inner-mouth darker frame.
      const innerInset = Math.max(2, stroke * 1.4);
      g.fillStyle(0x2A2620, 0.55);
      g.fillRect(outerL + stroke * 0.5, archTopY,
                 innerInset, Math.max(0, groundY - archTopY));
      g.fillRect(outerR - stroke * 0.5 - innerInset, archTopY,
                 innerInset, Math.max(0, groundY - archTopY));
      g.fillRect(outerL + stroke * 0.5, archTopY + stroke * 0.7,
                 archW - stroke, Math.max(1, innerInset * 0.7));
    }
  }

  /**
   * Sign overlay — drawn per-sign into a pool of Graphics objects so
   * each sign can have its OWN depth matching its world distance.
   * That way a close house/tree naturally occludes a distant sign,
   * instead of all signs being batched into one always-on-top layer.
   *
   * @param {Phaser.GameObjects.Graphics[]} pool - pre-allocated pool;
   *   each visible sign claims one slot.  Unused slots are hidden.
   */
  renderSignOverlay(pool) {
    if (!Array.isArray(pool) || pool.length === 0) return;
    const drawn = this._drawn;
    let used = 0;
    if (!drawn?.length) {
      for (let i = 0; i < pool.length; i++) pool[i].clear().setVisible(false);
      return;
    }
    // Iterate FAR → NEAR so the pool's draw order matches scene
    // sprites (close signs claim later pool slots = drawn last within
    // same-depth batches).  Depth is set per-slot below.
    for (let i = drawn.length - 1; i >= 0 && used < pool.length; i--) {
      const d = drawn[i];
      const seg = d?.seg;
      if (!seg?.sprites?.length) continue;
      const screenX = d.screenX;
      const spriteScale = d.scale * SCREEN_W / 2;
      // `n` is the segment offset from camera for this drawn entry.
      // Stored on d by render() — falls back to index reconstruction
      // if missing (older snapshots).
      const n = d.n ?? (drawn.length - 1 - i);
      const relZ = n * SEG_LENGTH + SEG_LENGTH / 2;
      // Mirror the scene-sprite depth ramp so signs land in the
      // same band as the buildings/trees that should occlude them.
      // Add +0.10 so when a sign and a scene sprite share the same
      // world distance, the sign sits slightly above (signs are
      // meant to be readable; tied scenery shouldn't beat them).
      const signDepth = (9.5 - Math.max(0, Math.min(1, relZ / 76000)) * 2.5) + 0.10;
      for (const sp of seg.sprites) {
        if (used >= pool.length) break;
        if (sp.collected) continue;
        if (sp.type !== 'mileage_sign'
         && sp.type !== 'exit_sign_green'
         && sp.type !== 'amenities_sign'
         && sp.type !== 'next_stops_sign'
         && sp.type !== 'rest_sign'
         && sp.type !== 'grade_sign'
         && sp.type !== 'sign') continue;
        const spriteX = toInt(screenX + d.screenW * sp.offset);
        const spriteH = toInt(sp.baseH * spriteScale * 0.5);
        const spriteW = toInt(sp.baseW * spriteScale * 0.5);
        if (spriteH < 1) continue;
        const g = pool[used++];
        g.clear();
        g.setDepth(signDepth).setVisible(true);
        this._drawSpriteShape(g, sp.type, spriteX, d.screenY - spriteH, spriteW, spriteH, sp.collected, sp);
      }
    }
    for (let i = used; i < pool.length; i++) {
      pool[i].clear().setVisible(false);
    }
  }

  _drawTunnelShell(g, curr, next, xOffset = 0) {
    const { screenW: w2, seg } = curr;
    const { screenW: w1 } = next;
    const x2 = curr.screenX + xOffset;
    const x1 = next.screenX + xOffset;
    const fy = Math.floor(curr.screenY) - 1;
    const ny = next ? Math.ceil(next.screenY) + 1 : Math.ceil(curr.screenY) + 5;
    const segH = Math.max(1, ny - fy);
    const segLanes = seg.lanes ?? LANES;
    const rw1 = rumbleW(w1, segLanes);
    const rw2 = rumbleW(w2, segLanes);

    const shoulder1 = Math.max(rw1 * 1.35, w1 * 0.10);
    const shoulder2 = Math.max(rw2 * 1.35, w2 * 0.10);
    const wallW1 = w1 * 0.78;
    const wallW2 = w2 * 0.78;
    const roadFar_L  = x2 - w2 - rw2;
    const roadFar_R  = x2 + w2 + rw2;
    const roadNear_L = x1 - w1 - rw1;
    const roadNear_R = x1 + w1 + rw1;
    const inFar_L   = roadFar_L - shoulder2;
    const inFar_R   = roadFar_R + shoulder2;
    const inNear_L  = roadNear_L - shoulder1;
    const inNear_R  = roadNear_R + shoulder1;
    const outFar_L  = inFar_L - wallW2;
    const outFar_R  = inFar_R + wallW2;
    const outNear_L = inNear_L - wallW1;
    const outNear_R = inNear_R + wallW1;

    const H_CEIL       = 4500;
    const ceilDropFar  = curr.scale * H_CEIL * SCREEN_H / 2;
    const ceilDropNear = next.scale * H_CEIL * SCREEN_H / 2;
    const ceilFy       = Math.max(0, fy - ceilDropFar);
    const ceilNy       = Math.max(0, ny - ceilDropNear);

    fillTrap(g, 0xA8A498,
      outFar_L,  ceilFy, outFar_R,  ceilFy,
      outNear_R, ceilNy, outNear_L, ceilNy);

    fillTrap(g, 0xB5B0A0,
      outFar_L,  ceilFy, inFar_L,   fy,
      inNear_L,  ny,     outNear_L, ny);
    fillTrap(g, 0xB5B0A0,
      inFar_R,   fy,     outFar_R,  ceilFy,
      outNear_R, ny,     inNear_R,  ny);

    fillTrap(g, 0x8F8A7D,
      roadFar_L,  fy, inFar_L,  fy,
      inNear_L,   ny, roadNear_L, ny);
    fillTrap(g, 0x8F8A7D,
      inFar_R,    fy, roadFar_R, fy,
      roadNear_R, ny, inNear_R,  ny);

    const shadowFy = fy + segH * 0.70;
    fillTrap(g, 0x6E6660,
      inFar_L - wallW2 * 0.35, shadowFy, inFar_L, shadowFy,
      inNear_L, ny, inNear_L - wallW1 * 0.35, ny);
    fillTrap(g, 0x6E6660,
      inFar_R, shadowFy, inFar_R + wallW2 * 0.35, shadowFy,
      inNear_R + wallW1 * 0.35, ny, inNear_R, ny);

    const curbW1 = Math.max(2, rw1 * 0.6);
    const curbW2 = Math.max(2, rw2 * 0.6);
    fillTrap(g, 0xD8D4C0,
      inFar_L - curbW2, ny - Math.max(1, segH * 0.20),
      inFar_L,          ny - Math.max(1, segH * 0.20),
      inNear_L,         ny,
      inNear_L - curbW1, ny);
    fillTrap(g, 0xD8D4C0,
      inFar_R, ny - Math.max(1, segH * 0.20),
      inFar_R + curbW2, ny - Math.max(1, segH * 0.20),
      inNear_R + curbW1, ny,
      inNear_R, ny);

    if (!seg.wildlife && (seg.index % 3) === 0) {
      const lightLenFar  = Math.max(2, wallW2 * 0.55);
      const lightLenNear = Math.max(2, wallW1 * 0.55);
      const lightThk     = Math.max(2, segH * 0.5);
      fillTrap(g, 0xFFD060,
        inFar_L - lightLenFar,   ceilFy,
        inFar_L,                 ceilFy,
        inNear_L,                ceilNy + lightThk,
        inNear_L - lightLenNear, ceilNy + lightThk);
      fillTrap(g, 0xFFD060,
        inFar_R,                 ceilFy,
        inFar_R + lightLenFar,   ceilFy,
        inNear_R + lightLenNear, ceilNy + lightThk,
        inNear_R,                ceilNy + lightThk);
    }

    // Wildlife crossing — a short, LOW overpass sitting in its OWN shadow,
    // not a long lit highway tunnel.  Shade the interior dark so the arch
    // openings read as a shaded recess you drive UNDER rather than a bright
    // see-through hole (and the sodium ceiling lights are skipped above).
    if (seg.wildlife) {
      fillTrap(g, 0x0E1118,
        outFar_L,  ceilFy, outFar_R,  ceilFy,
        outNear_R, ny,     outNear_L, ny, 0.62);
    }
  }

  /**
   * True when an inside-tunnel vehicle body point is hidden by a nearer
   * side wall around a bend. Vehicles render above the tunnel shell so
   * their bodies are not flattened by the floor/curb overlay; this narrow
   * visibility test restores only the real wall occlusion.
   */
  isTunnelVehicleOccluded(relativeZ, sx, bodyMidY) {
    const drawn = this._drawn;
    if (!drawn?.length) return false;

    const pointInQuad = (quad) => {
      let inside = false;
      for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
        const a = quad[i];
        const b = quad[j];
        const crosses = ((a.y > bodyMidY) !== (b.y > bodyMidY))
          && (sx < (b.x - a.x) * (bodyMidY - a.y) / ((b.y - a.y) || 1) + a.x);
        if (crosses) inside = !inside;
      }
      return inside;
    };

    for (let i = 1; i < drawn.length; i++) {
      const curr = drawn[i];
      const next = drawn[i - 1];
      if (!curr?.seg?.tunnel || !next?.seg?.tunnel) continue;
      // Only tunnel wall sections clearly between the camera and car
      // can block it; its own segment walls border its visible lane.
      if (curr.relZ >= relativeZ - SEG_LENGTH * 0.35) continue;

      const w2 = curr.screenW;
      const w1 = next.screenW;
      const x2 = curr.screenX;
      const x1 = next.screenX;
      const fy = Math.floor(curr.screenY) - 1;
      const ny = Math.ceil(next.screenY) + 1;
      const lanes = curr.seg.lanes ?? LANES;
      const rw1 = rumbleW(w1, lanes);
      const rw2 = rumbleW(w2, lanes);
      const shoulder1 = Math.max(rw1 * 1.35, w1 * 0.10);
      const shoulder2 = Math.max(rw2 * 1.35, w2 * 0.10);
      const wallW1 = w1 * 0.78;
      const wallW2 = w2 * 0.78;
      const inFarL = x2 - w2 - rw2 - shoulder2;
      const inFarR = x2 + w2 + rw2 + shoulder2;
      const inNearL = x1 - w1 - rw1 - shoulder1;
      const inNearR = x1 + w1 + rw1 + shoulder1;
      const outFarL = inFarL - wallW2;
      const outFarR = inFarR + wallW2;
      const outNearL = inNearL - wallW1;
      const outNearR = inNearR + wallW1;
      const ceilFar = Math.max(0, fy - curr.scale * 4500 * SCREEN_H / 2);
      const ceilNear = Math.max(0, ny - next.scale * 4500 * SCREEN_H / 2);

      if (pointInQuad([
        { x: outFarL, y: ceilFar }, { x: inFarL, y: fy },
        { x: inNearL, y: ny }, { x: outNearL, y: ceilNear },
      ]) || pointInQuad([
        { x: inFarR, y: fy }, { x: outFarR, y: ceilFar },
        { x: outNearR, y: ceilNear }, { x: inNearR, y: ny },
      ])) {
        return true;
      }
    }
    return false;
  }

  /** Two continuous white shoulder ribbons — the LEFT and RIGHT
   *  polylines that define the road's edges across all visible
   *  boundaries.  Everything between these lines is the playable road;
   *  cars / sprites / NPCs Y-position from the same _surfaceSamples
   *  cache so they stay glued to whichever segment they're over.
   *
   *  Drawn via beginPath / lineTo / fillPath instead of fillPoints to
   *  avoid the {x,y} object allocations that produced the prior GC
   *  stalls. */
  /** Paint towers + main suspension cables + vertical hangers over any
   *  visible suspension-bridge segments.  Hangers are per-segment;
   *  towers and the main cable arc are computed once across the
   *  visible span using the first/last drawn-suspension samples.
   *
   *  Visual layout (single side; mirrored to the other):
   *    Tower:   tall vertical bar with a horizontal crossbeam near top
   *    Cable:   catenary curve from one tower top, sagging mid-span
   *             down to ~deck height, back up to the next tower top
   *    Hanger:  thin vertical line from cable down to deck per segment
   */
  _drawSuspensionBridge(g, drawn) {
    if (!drawn?.length) return;
    // Collect visible suspension segments far → near.
    let firstSuspIdx = -1;
    let lastSuspIdx  = -1;
    let startTower   = null;
    let endTower     = null;
    for (let i = 0; i < drawn.length; i++) {
      const d = drawn[i];
      if (!d?.seg?.suspension) continue;
      if (firstSuspIdx < 0) firstSuspIdx = i;
      lastSuspIdx = i;
      if (d.seg.bridgeTowerStart) startTower = d;
      if (d.seg.bridgeTowerEnd)   endTower   = d;
    }
    if (firstSuspIdx < 0) return;

    // ── MAIN CABLE ARC ────────────────────────────────────────────
    // Determine the screen-space endpoints of the cable.  If a tower
    // segment is visible we use its screenX/Y; otherwise we estimate
    // from the nearest visible suspension segment.  The cable rises
    // ~140 px above the road deck at each tower and sags to deck +
    // 18 px mid-span (suspT 0.5).
    const farD  = drawn[lastSuspIdx];
    const nearD = drawn[firstSuspIdx];
    // Note: drawn[] is ordered far → near in the loop above (we iterate
    // i=0..length, but original drawn array is filled with far first).
    const TOWER_H        = 220;   // tower height above deck (screen px at near depth)
    const CABLE_RISE     = 140;   // cable peak above deck at tower
    const CABLE_DECK_PAD = 18;    // sag offset above deck mid-span
    const TOWER_WIDTH    = 7;     // half-width of each tower
    const HANGER_ALPHA   = 0.7;
    const CABLE_COL      = 0x444444;
    const TOWER_COL      = 0x2A2A2A;
    const TOWER_HILITE   = 0x4A4A4A;

    // Each suspension segment has suspT; use the half-road-width and
    // screen position of each visible suspension drawn entry to paint
    // the cable in screen space.  We approximate the cable Y at a
    // given t as: deckY(t) - CABLE_RISE * (1 - 4*t*(1-t)) (catenary-ish
    // parabola).  Hangers go from cableY down to deckY at each segment.
    // Cable spans both sides (left & right edges of road).
    g.lineStyle(2, CABLE_COL, 1);
    let prevL = null, prevR = null;
    for (let i = lastSuspIdx; i >= firstSuspIdx; i--) {
      const d = drawn[i];
      if (!d) continue;
      const t = d.seg.suspT ?? 0;
      const halfW = d.screenW;     // half-road-width at this depth
      const deckY = d.screenY;
      // Catenary-style sag: y_factor = 1 at t=0 or 1 (tower), 0 mid-span.
      const sagF  = 1 - 4 * t * (1 - t);
      const cableY = deckY - (CABLE_RISE * sagF + CABLE_DECK_PAD * (1 - sagF));
      // Cable anchors at the outside edge of the deck on each side.
      const cxL = d.screenX - halfW - 4;
      const cxR = d.screenX + halfW + 4;
      if (prevL) {
        g.beginPath();
        g.moveTo(prevL.x, prevL.y);
        g.lineTo(cxL, cableY);
        g.strokePath();
      }
      if (prevR) {
        g.beginPath();
        g.moveTo(prevR.x, prevR.y);
        g.lineTo(cxR, cableY);
        g.strokePath();
      }
      prevL = { x: cxL, y: cableY };
      prevR = { x: cxR, y: cableY };
      // Vertical hanger every ~3 segments — thin grey line from cable
      // down to deck on each side.
      if ((d.seg.index % 4) === 0) {
        g.lineStyle(1, CABLE_COL, HANGER_ALPHA);
        g.beginPath();
        g.moveTo(cxL, cableY);
        g.lineTo(cxL, deckY);
        g.strokePath();
        g.beginPath();
        g.moveTo(cxR, cableY);
        g.lineTo(cxR, deckY);
        g.strokePath();
        g.lineStyle(2, CABLE_COL, 1);  // restore for next cable seg
      }
    }

    // ── TOWERS ────────────────────────────────────────────────────
    // Paint each visible tower as a pair of vertical bars (left + right
    // of road) with a horizontal crossbeam near the top.
    const paintTower = (d) => {
      if (!d) return;
      const halfW = d.screenW;
      const deckY = d.screenY;
      const topY  = deckY - TOWER_H;
      const xL    = d.screenX - halfW - 4;
      const xR    = d.screenX + halfW + 4;
      // Left pylon
      g.fillStyle(TOWER_COL, 1);
      g.fillRect(xL - TOWER_WIDTH, topY, TOWER_WIDTH * 2, TOWER_H);
      g.fillStyle(TOWER_HILITE, 1);
      g.fillRect(xL - TOWER_WIDTH + 1, topY, 2, TOWER_H);   // hilite stripe
      // Right pylon
      g.fillStyle(TOWER_COL, 1);
      g.fillRect(xR - TOWER_WIDTH, topY, TOWER_WIDTH * 2, TOWER_H);
      g.fillStyle(TOWER_HILITE, 1);
      g.fillRect(xR - TOWER_WIDTH + 1, topY, 2, TOWER_H);
      // Crossbeam at upper third — connects the two pylons.
      const beamY = topY + TOWER_H * 0.18;
      g.fillStyle(TOWER_COL, 1);
      g.fillRect(xL - TOWER_WIDTH, beamY, (xR - xL) + TOWER_WIDTH * 2, 6);
      // Top finial dots
      g.fillStyle(0x999999, 1);
      g.fillCircle(xL, topY, 3);
      g.fillCircle(xR, topY, 3);
    };
    paintTower(startTower);
    paintTower(endTower);
  }

  /** Paint overpass structures — wildlife arch + freeway slab.
   *  Spec:
   *   - Thin horizontal deck anchored to the road's world-space
   *     perspective (height + thickness scale with seg.scale, not
   *     fixed pixels).
   *   - Width extends only modestly past the road edges — never
   *     stretches across the screen.
   *   - Two narrow abutment piers just outside the lanes.
   *   - Underside / front fascia clipped to live ABOVE the road plane
   *     so the structure never paints over the car, traffic, or HUD.
   *   - When the camera has passed the overpass, nothing renders
   *     (drawn[] no longer contains its segments — automatic). */
  _drawOverpasses(g, drawn) {
    if (!drawn?.length) return;
    // Group consecutive overpass segments into spans.  drawn[0] is
    // nearest, drawn[last] is farthest.  We need both edges of each
    // span (near + far) for the beam polygon.
    const spans = [];
    let current = null;
    for (let i = 0; i < drawn.length; i++) {
      const d = drawn[i];
      if (d?.seg?.overpass) {
        if (!current) {
          current = { kind: d.seg.overpassKind, near: d, far: d };
        } else if (current.kind === d.seg.overpassKind) {
          current.far = d;
        } else {
          spans.push(current);
          current = { kind: d.seg.overpassKind, near: d, far: d };
        }
      } else if (current) {
        spans.push(current);
        current = null;
      }
    }
    if (current) spans.push(current);
    if (!spans.length) return;

    // World-space dimensions (auto-scaled per segment via .scale so the
    // bridge stays anchored to a fixed real-world height as the camera
    // approaches — no fixed-pixel blowup at near distance).
    const DECK_HEIGHT_W   = 1800;   // deck underside above road plane (world units)
    const DECK_THICK_W    = 380;    // top → bottom of deck (world units)
    const OVERHANG_FRAC   = 0.35;   // deck extends this fraction of road half-width past road
    const PIER_FRAC       = 0.08;   // pier width as fraction of road half-width

    for (const span of spans) {
      const near = span.near;
      const far  = span.far;

      // ── Project deck rectangle in world space ───────────────────
      // The deck spans from far→near along Z, sits DECK_HEIGHT_W above
      // the road, and is DECK_THICK_W thick.  Per-vertex scale comes
      // from each end's own .scale so perspective is honest.
      const sH = SCREEN_H / 2;
      const nearLift = near.scale * DECK_HEIGHT_W * sH;
      const farLift  = far.scale  * DECK_HEIGHT_W * sH;
      const nearThk  = Math.max(2, near.scale * DECK_THICK_W * sH);
      const farThk   = Math.max(1, far.scale  * DECK_THICK_W * sH);
      // Width — modest overhang past the road edges, scaled with
      // perspective via screenW.  Capped to half-screen width so a
      // near-edge bridge never spans the whole canvas.
      const nearHalfW = Math.min(SCREEN_W * 0.45,
                                 near.screenW * (1 + OVERHANG_FRAC));
      const farHalfW  = far.screenW * (1 + OVERHANG_FRAC);

      const nxL = near.screenX - nearHalfW;
      const nxR = near.screenX + nearHalfW;
      const fxL = far.screenX  - farHalfW;
      const fxR = far.screenX  + farHalfW;

      const nyBot = near.screenY - nearLift;
      const nyTop = nyBot - nearThk;
      const fyBot = far.screenY  - farLift;
      const fyTop = fyBot - farThk;

      // Clip — bridge must NEVER paint below the road plane (the car
      // sits there).  If the underside dips below the road, raise it.
      const nearRoadY = near.screenY;
      const farRoadY  = far.screenY;
      const nyBotClipped = Math.min(nyBot, nearRoadY - 6);
      const fyBotClipped = Math.min(fyBot, farRoadY  - 4);

      const isArch = span.kind === 'wildlife';

      // ── 1. Front fascia (the face visible from far away) ────────
      // Far end of the bridge is the FRONT face the player sees on
      // approach.  Drawn as a thin trapezoid at the FAR depth.
      if (isArch) {
        // Curve the bottom of the front fascia into an arch.
        const ARCH_STEPS = 14;
        const archDip    = farThk * 1.8;
        const arcBot = [];
        for (let s = 0; s <= ARCH_STEPS; s++) {
          const t = s / ARCH_STEPS;
          const x = fxL + (fxR - fxL) * t;
          const y = fyBotClipped - Math.sin(t * Math.PI) * archDip;
          arcBot.push({ x, y });
        }
        g.fillStyle(0x7A766C, 1);
        g.fillPoints([
          { x: fxL, y: fyTop },
          { x: fxR, y: fyTop },
          ...arcBot.slice().reverse(),
        ], true);
      } else {
        fillTrap(g, 0x7A766C,
          fxL, fyTop,         fxR, fyTop,
          fxR, fyBotClipped,  fxL, fyBotClipped);
      }

      // ── 2. Underside (top of the visible deck looking up) ───────
      // Trapezoid from FAR bottom to NEAR bottom — only the bit
      // between the road and the deck's underside.  This is what
      // appears overhead briefly when the player drives under.
      fillTrap(g, 0x4A4640,
        fxL, fyBotClipped, fxR, fyBotClipped,
        nxR, nyBotClipped, nxL, nyBotClipped);

      // ── 3. Top of deck (visible when looking down at it from afar)
      // Thin band along the top — just enough to read as "top of
      // bridge."  Wildlife: dirt + grass layer; freeway: asphalt.
      const decorH_far  = Math.max(1, farThk * 0.5);
      const decorH_near = Math.max(2, nearThk * 0.4);
      if (isArch) {
        // Dirt
        fillTrap(g, 0x6A5040,
          fxL, fyTop - decorH_far * 0.5, fxR, fyTop - decorH_far * 0.5,
          nxR, nyTop - decorH_near * 0.5, nxL, nyTop - decorH_near * 0.5);
        // Grass
        fillTrap(g, 0x2E5832,
          fxL, fyTop - decorH_far,  fxR, fyTop - decorH_far,
          nxR, nyTop - decorH_near, nxL, nyTop - decorH_near);
      } else {
        // Asphalt strip on top
        fillTrap(g, 0x2A2A2A,
          fxL + 2, fyTop - decorH_far,  fxR - 2, fyTop - decorH_far,
          nxR - 4, nyTop - decorH_near, nxL + 4, nyTop - decorH_near);
        // Thin grey guardrail along the visible side
        g.lineStyle(Math.max(1, decorH_far * 0.4), 0xA0A09A, 0.9);
        g.beginPath();
        g.moveTo(fxL + 2, fyTop - decorH_far - 1);
        g.lineTo(fxR - 2, fyTop - decorH_far - 1);
        g.strokePath();
      }

      // ── 4. Abutment piers — narrow vertical bars just outside the
      // lanes, anchored to the road plane.  Scale with perspective so
      // they stay proportional. ────────────────────────────────────
      const pierWNear = Math.max(3, near.screenW * PIER_FRAC);
      const pierWFar  = Math.max(1, far.screenW  * PIER_FRAC);
      // Use a tapered trapezoid for each pier so it follows the
      // perspective from near→far (matches the deck's taper).
      // Left pier
      fillTrap(g, 0x4A4640,
        fxL - pierWFar,  fyBotClipped, fxL,             fyBotClipped,
        nxL,             nyBotClipped + (nearRoadY - nyBotClipped),
        nxL - pierWNear, nyBotClipped + (nearRoadY - nyBotClipped));
      // Right pier
      fillTrap(g, 0x4A4640,
        fxR,             fyBotClipped, fxR + pierWFar,  fyBotClipped,
        nxR + pierWNear, nyBotClipped + (nearRoadY - nyBotClipped),
        nxR,             nyBotClipped + (nearRoadY - nyBotClipped));
    }
  }


  _drawSegment(g, curr, next, palette, effects, xOffset = 0, isGhost = false) {
    // xOffset is added to the segment's screenX so the Sushi-ghost
    // pass can request a laterally-offset draw without cloning curr/next.
    // M: ground/flank fill margin.  150 (sway/tilt cover) + HUD_OFFSET_X so the
    // decoupled-width canvas (world scrolled −HUD_OFFSET_X to center) is filled
    // edge-to-edge on a wide screen instead of leaving bare strips on the sides.
    const M = 150 + Math.ceil(C.HUD_OFFSET_X);
    const { screenY: y2, screenW: w2, seg, fog } = curr;
    const { screenY: y1, screenW: w1 } = next; // "next" is one closer (lower y)
    const x2 = curr.screenX + xOffset;
    const x1 = next.screenX + xOffset;

    // For our loop (far→near), curr is further and next is closer.
    // But after reversing, curr.screenY < next.screenY (curr is higher on screen)
    // Re-label for clarity.  Float-precision edges with ±1 px overshoot
    // for hairline-gap insurance — Phaser's Graphics fill takes floats
    // and the GPU AA blends sub-pixel boundaries cleanly.
    const fy = curr.screenY - 1;
    const ny = next ? next.screenY + 1 : curr.screenY + 5;
    const segH = Math.max(1, ny - fy);

    // ── EXACT segment bounds, for ALPHA-BLENDED fills only ──────────────
    // fy/ny above carry a deliberate ±1 px overshoot as hairline-gap
    // insurance.  That is correct and harmless for an OPAQUE fill: two
    // opaque trapezoids overlapping by 2 px composite to exactly the same
    // result as one, so the insurance is free.
    //
    // It is NOT free for a translucent fill.  Alpha compositing is not
    // idempotent — a band covered twice at alpha a ends up at 1-(1-a)²
    // instead of a — so every overshot overlap paints a 2 px darker line at
    // EVERY segment boundary.  With the wear, shoulder tone, rumble band,
    // grit fringe and markings all now alpha-blended, that stacked up into
    // the uniformly-spaced horizontal ladder down the whole road.
    //
    // The segment loop passes curr = drawn[i], next = drawn[i-1], so
    // neighbouring segments share the SAME boundary float: using it
    // un-overshot makes the translucent quads tile exactly — no double
    // composite, and no gap either, since the shared edge is bit-identical.
    // Bridge/water STRUCTURE routing (owner 2026-08-05, second report).  The
    // first camera-gate fix moved off-span bridge draws from the depth-4
    // overlay down to roadGfx (1.5) — but since the texture split the nearer
    // NORMAL road's asphalt base lives on roadBaseGfx (1.35), so rails and
    // under-deck structure still floated over it.  Off the span they now go
    // all the way down to the BASE layer, where far→near painter order
    // occludes them exactly like any other distant geometry.  On the span the
    // original routing (roadGfx / bridgeFrontGfx) is untouched.
    const structG = (!isGhost && (seg.bridge || seg.water)
                     && !this._camOnSpan && this._roadBaseG)
      ? this._roadBaseG : null;

    const fyA   = curr.screenY;
    const nyA   = next ? next.screenY : curr.screenY + 4;
    const segHA = Math.max(1, nyA - fyA);

    // Single grass shade — lighter of the two — so the roadside reads as
    // a continuous field instead of striped bands (matches the road's
    // single-tone treatment).
    let grass    = palette.grass1;
    let laneCol  = palette.lane;
    // Lane dashes use a real-road ratio (short paint, long gap) so each
    // dash reads as a discrete stripe at perspective distance rather
    // than stacking into a vertical column of cream blocks.  Paint when
    // the segment lands inside the LANE_DASH_LEN window of the cycle.
    const dashCycle = LANE_DASH_LEN + LANE_DASH_GAP;
    // Per-segment flag — still what the snow burial and the ghost pass read.
    let   dashOn    = (seg.index % dashCycle) < LANE_DASH_LEN;
    // The main pass emits a dash ONCE, at its nearest segment, spanning back
    // to the far boundary cached below.  isGhost keeps the per-segment path:
    // the ghost draws at a lateral xOffset the cache doesn't carry.
    const dashHead  = !isGhost && (seg.index % dashCycle) === 0;

    // ── Snow blanket: dissolve the road / shoulder / grass toward white
    // and suppress lane markings entirely.  Intensity ramps with the
    // weather envelope so the transition into / out of the snow zone is
    // smooth instead of a hard color flip.
    //
    // Computed BEFORE the asphalt colour now: the surface colour folds
    // weather in itself (see RoadMaterial.surfaceColor) rather than being
    // built and then overwritten, so snow has to be known first.
    const segMile = (seg.index / this.segments.length) * TOTAL_ROUTE_MILES;
    // Ground-texture opacity.  Full outside the snow zone; inside it the tile
    // survives the accumulation and disappears under total cover (see below).
    let groundTexFade = 1;
    // Snow blanket strength, 0..1, hoisted so the paint markings further down
    // (double-yellow centre line) can be buried by it too.
    let snowBlanket = 0;
    if (Weather.isSnow(segMile)) {
      // Ground snow accumulates GRADUALLY, decoupled from the falling-snow
      // intensity (which is full from mile 40 with no fade-in, so the sky
      // hands off rain→snow with no clear gap).  Using intensity directly
      // snapped the road to full white right at mile 40 — a hard "line" on
      // the pavement.  Instead the blanket builds over SNOW_BUILD_MILES and
      // eases out over the last 2 mi (86→88).  (Sky precip unchanged.)
      //
      // Full coverage lands at mile 55 per owner spec (2026-07-27): by then
      // the road and both shoulders are a single unbroken white sheet with
      // every lane marking buried.
      const snowI = snowBlanketAt(segMile);
      snowBlanket = snowI;
      if (snowI > 0.001) {
        // Ground texture lingers through the ACCUMULATION (scrub still shows
        // through a partial blanket) then reaches zero at full cover, so the
        // whiteout is genuinely white rather than moss seen through gauze.
        groundTexFade = Math.pow(1 - snowI, 0.6);
        // Everything converges on ONE snow white — road, shoulder and roadside
        // alike.  Blending only 80-85% of the way (the old values) left the
        // pavement a readable grey ribbon, which is exactly the "you can still
        // see the road" look the whiteout is meant to remove.  (The road's own
        // convergence happens inside surfaceColor; only the roadside is here.)
        grass = lerpColor(grass, SNOW_WHITE, snowI);
        // Lane paint stops being drawn well before full cover — a dashed line
        // fading through grey reads as a rendering artefact, not as snow.
        if (snowI > SNOW_MARKINGS_GONE) dashOn = false;
      }
    }

    // ── Road material + surface colour ─────────────────────────────────
    // ONE stable colour for the whole segment.  What used to be here — an
    // `index / RUMBLE_SEGS % 2` stripe picking between road1 and road2, plus
    // an INDEPENDENT ±5% jitter per segment — is precisely what made the road
    // read as alternating horizontal bands: neighbouring segments were
    // uncorrelated samples, so every single boundary was a visible tone step.
    //
    // surfaceColor() replaces both with one regional base plus low-frequency
    // noise interpolated across 11-27 segments, so the tone gradient across
    // any one boundary is a fraction of a percent and no edge is visible.
    const rd  = roadDetail(seg);
    const mat = rd.mat;
    let road  = surfaceColor(seg, palette, snowBlanket);

    // Night: pavement past the headlight throw falls away toward black rather
    // than the whole texture being globally dimmed.  Distance-based and
    // smooth in relZ, so it grades away instead of stepping per segment.
    const nightMul = nightFalloff(curr.relZ, segMile);
    if (nightMul < 0.999) road = lerpColor(road, 0x02030A, 1 - nightMul);

    // Lanes vanish into the road on the same schedule the dashes do.
    if (snowBlanket > 0.001) {
      laneCol = lerpColor(laneCol, road, Math.min(1, snowBlanket / SNOW_MARKINGS_GONE));
    }

    const rainAmt = Weather.isRain(segMile) ? Weather.intensity(segMile) : 0;
    // Distance response shared by every painted marking.  Two smooth terms
    // (owner 2026-08-03, bridge-markings report):
    //
    //   1. A gentle atmospheric blend that saturates at PAINT_BASE_MAX (25%)
    //      by ~two-thirds of the visible depth — enough to soften the paint
    //      into the scene without erasing it.
    //   2. The terminal fade, confined to the last 12% of the draw distance
    //      (past PAINT_KNEE), where the paint fully dissolves into the
    //      pavement it hands off to the distance-fog veil.
    //
    // The previous single ramp — 62% blend building from relZ 5000 — combined
    // with perspective narrowing to sub-pixel width and wiped the markings out
    // at MIDDLE distance, which on a long flat sightline (the West Seattle and
    // Lake Washington bridges) read as the paint stopping halfway up the deck.
    // Markings now stay legible through ~88% of the visible road.  Both terms
    // are smoothsteps of relZ only, so there is no threshold and no segment
    // boundary in the response.
    const paintFade = Math.min(1,
      PAINT_BASE_MAX * smoothstep((curr.relZ - 8000) / (PAINT_FAR * 0.62)) +
      (1 - PAINT_BASE_MAX) * smoothstep((curr.relZ - PAINT_FAR * PAINT_KNEE)
                                        / (PAINT_FAR * (1 - PAINT_KNEE))));
    // Retroreflective response — glass beads in the paint throw light straight
    // back at the driver, so markings inside the headlight throw stay bright
    // while the pavement around them goes dark.  Outside the throw they get no
    // special treatment, which is what makes night driving read correctly.
    const reflectAmt = TimeOfDay.darkness(segMile) * (1 - smoothstep((curr.relZ - 3000) / 13000));
    // Wet paint picks up a little extra specular return.
    const wetPaint = rainAmt * 0.22;

    // Cache this segment's FAR boundary so the whole-dash span above can
    // close against it when the loop reaches the dash's nearest segment.
    if (!isGhost) {
      const _rn = this._dashRingN;
      const _ri = (seg.index % _rn) * 4;
      const _r  = this._dashRing;
      _r[_ri] = seg.index; _r[_ri + 1] = x2; _r[_ri + 2] = fy; _r[_ri + 3] = w2;
    }

    const segLanes = seg.lanes ?? LANES;

    const rw1 = rumbleW(w1, segLanes);
    const rw2 = rumbleW(w2, segLanes);
    const lw1 = laneW(w1, segLanes);
    const lw2 = laneW(w2, segLanes);

    // Grass — full-width regular grass for all segments, including
    // tunnel.  The tunnel structure (walls + ceiling) paints on top of
    // this, bounded to the road's screen-area, so the sky and grass
    // outside the tunnel structure stay visible.
    // For LAND segments (no water/bridge overpaint coming), enforce a
    // generous minimum slice height so distant land doesn't render as
    // a 1-2 px sliver that gets visually dominated by foreground
    // bridge/water.  This acts as a "shoreline apron" at bridge→land
    // transitions: when the player is on a bridge looking at the
    // upcoming island, the dry segments past the bridge end project
    // as thin horizon bands.  Extending those bands DOWN (toward
    // larger screen Y) by 60 px makes the green island shore clearly
    // visible underneath any homes spawned there.  Bridge segments
    // are iterated near-first and paint their water at smaller
    // screen Y (higher up they're not, smaller cz means LARGER fy
    // — closer to bottom), so the dry land's grass extends down
    // toward the bridge water and forms a visible shoreline edge.
    const isLandSeg = !seg.water && !seg.bridge;
    const grassH = isLandSeg ? Math.max(60, segH) : segH;
    if (!isGhost) {
      // TERRAIN LAYER, not the road layer.  This full-width opaque fill is
      // the only per-segment ground paint, so routing it to a separate
      // Graphics one depth below is the whole of the terrain/road split —
      // it opens a slot for a textured ground plate to sit between the two.
      //
      // Safe to move because hill occlusion does NOT depend on it: the
      // segment loop skips anything hidden behind a crest outright
      // (`if (curr.screenY < maxScreenY) continue`) rather than relying on
      // nearer grass painting over farther road.
      const tg = this._terrainG ?? g;
      tg.fillStyle(grass, 1);
      tg.fillRect(-M, fy, SCREEN_W + M * 2, grassH);

      // Textured ground, painted OVER that fill one depth up.  The flat fill
      // stays as the base — it carries the biome / snow colour and shows
      // through as the tile fades out toward the horizon.
      // Uses segH, not grassH: the 60 px apron above is a shoreline read for
      // the flat fill, and stretching the tile down into it would double-blend
      // the fade where consecutive segments overlap.
      // Water / bridge segments are skipped — g overpaints them with river and
      // port-yard fills anyway, so a ground tile there is invisible work.
      if (this._groundP && !seg.water && !seg.bridge) {
        this._groundP.pushRow(fy, ny, x2, x1, w2, w1, curr.relZ, next.relZ, groundTexFade);
      }
    }

    // ── Tunnel: concrete portal structure rendered per-segment ─────────
    // Walls + ceiling are concrete-coloured trapezoids that taper with
    // the road's perspective.  The ceiling extends UP from the road
    // by H_CEIL world-units, projected to screen-Y with the segment's
    // own scale.  Because every paint is bounded to the wall's outer
    // edges (which mirror the road's taper), the structure converges
    // to the road's vanishing point and never bleeds into the sky.
    if (seg.tunnel && !isGhost) {
      // Leave a 3-5 ft visual shoulder between the fog line and the
      // tunnel wall.  Wall edges still use the same near/far road
      // projection, so they stay parallel to the fog line through curves.
      // Wildlife crossing — thin compact tunnel.  Walls hug the road
      // shoulder (0.04 of road half-width); the deck is the width of
      // the road plus a small overhang on each side.
      const isWildlife = !!seg.wildlife;
      const shoulder1 = Math.max(rw1 * 1.35, w1 * 0.10);
      const shoulder2 = Math.max(rw2 * 1.35, w2 * 0.10);
      const wallW1 = w1 * (isWildlife ? 0.04 : 0.78);
      const wallW2 = w2 * (isWildlife ? 0.04 : 0.78);
      const roadFar_L  = x2 - w2 - rw2;
      const roadFar_R  = x2 + w2 + rw2;
      const roadNear_L = x1 - w1 - rw1;
      const roadNear_R = x1 + w1 + rw1;
      const inFar_L   = roadFar_L - shoulder2;
      const inFar_R   = roadFar_R + shoulder2;
      const inNear_L  = roadNear_L - shoulder1;
      const inNear_R  = roadNear_R + shoulder1;
      const outFar_L  = inFar_L - wallW2;
      const outFar_R  = inFar_R + wallW2;
      const outNear_L = inNear_L - wallW1;
      const outNear_R = inNear_R + wallW1;

      // CEILING — projects H_CEIL world-units above the road.  At far
      // depth the ceiling is just above the road on screen; at near
      // depth it's far above (often off-screen top, clamped).  The
      // ceiling trapezoid spans BETWEEN the wall outer edges so it
      // doesn't leak past the tunnel's perceived width.
      const H_CEIL       = 4500;
      const ceilDropFar  = curr.scale  * H_CEIL * SCREEN_H / 2;
      const ceilDropNear = next.scale  * H_CEIL * SCREEN_H / 2;
      const ceilFy       = Math.max(0, fy - ceilDropFar);
      const ceilNy       = Math.max(0, ny - ceilDropNear);
      // Concrete ceiling (pale grey, matches the entrance arch tone).
      fillTrap(g, 0xA8A498,
        outFar_L,  ceilFy, outFar_R,  ceilFy,
        outNear_R, ceilNy, outNear_L, ceilNy);
      // Wildlife crossing — paint a dirt + grass band ON TOP of the
      // concrete ceiling so the structure reads as a forested lid.
      if (isWildlife) {
        const dirtH  = Math.max(2, segH * 0.10);
        const grassH = Math.max(3, segH * 0.22);
        fillTrap(g, 0x6A5040,
          outFar_L,  ceilFy - dirtH,           outFar_R,  ceilFy - dirtH,
          outNear_R, ceilNy - dirtH,           outNear_L, ceilNy - dirtH);
        fillTrap(g, 0x2E5832,
          outFar_L,  ceilFy - dirtH - grassH,  outFar_R,  ceilFy - dirtH - grassH,
          outNear_R, ceilNy - dirtH - grassH,  outNear_L, ceilNy - dirtH - grassH);
        // Sparse tree silhouettes — every other segment so they don't pile up.
        if ((seg.index & 1) === 0) {
          const cx_far   = (outFar_L  + outFar_R)  * 0.5;
          const cx_near  = (outNear_L + outNear_R) * 0.5;
          const grassTopY_far  = ceilFy - dirtH - grassH;
          const grassTopY_near = ceilNy - dirtH - grassH;
          const treeH_near = Math.max(6, segH * 0.50);
          g.fillStyle(0x1A2D1A, 1);
          g.fillTriangle(
            cx_far  - 3, grassTopY_far,
            cx_far  + 3, grassTopY_far,
            cx_near,     grassTopY_near - treeH_near);
        }
      }

      // WALLS — pale concrete trapezoids flanking the road.  Each
      // wall extends from the ceiling line down to the road's outer
      // rumble at the segment's bottom edge, mirroring the road's
      // perspective taper.
      // Left wall (concrete)
      fillTrap(g, 0x7E7A70,
        outFar_L,  ceilFy, inFar_L,   fy,
        inNear_L,  ny,     outNear_L, ny);
      // Right wall (concrete)
      fillTrap(g, 0x7E7A70,
        inFar_R,   fy,     outFar_R,  ceilFy,
        outNear_R, ny,     inNear_R,  ny);

      // Concrete shoulder between fog line/rumble and wall.
      fillTrap(g, 0x8F8A7D,
        roadFar_L,  fy, inFar_L,  fy,
        inNear_L,   ny, roadNear_L, ny);
      fillTrap(g, 0x8F8A7D,
        inFar_R,    fy, roadFar_R, fy,
        roadNear_R, ny, inNear_R,  ny);

      // Wall-base shadow — bottom strip of each wall darker so it
      // reads as "shadow under the lights."  Trapezoid hugging the
      // road's outer rumble for the lower 30 % of the wall.
      const shadowFy = fy + segH * 0.70;
      // Left base shadow
      fillTrap(g, 0x6E6660,
        inFar_L - wallW2 * 0.35, shadowFy, inFar_L, shadowFy,
        inNear_L, ny, inNear_L - wallW1 * 0.35, ny);
      // Right base shadow
      fillTrap(g, 0x6E6660,
        inFar_R, shadowFy, inFar_R + wallW2 * 0.35, shadowFy,
        inNear_R + wallW1 * 0.35, ny, inNear_R, ny);

      // Concrete CURB — pale strip between road rumble and wall base.
      // Reads as "where the floor meets the wall" line.
      const curbW1 = Math.max(2, rw1 * 0.6);
      const curbW2 = Math.max(2, rw2 * 0.6);
      fillTrap(g, 0xD8D4C0,
        inFar_L - curbW2, ny - Math.max(1, segH * 0.20),
        inFar_L,          ny - Math.max(1, segH * 0.20),
        inNear_L,         ny,
        inNear_L - curbW1, ny);
      fillTrap(g, 0xD8D4C0,
        inFar_R, ny - Math.max(1, segH * 0.20),
        inFar_R + curbW2, ny - Math.max(1, segH * 0.20),
        inNear_R + curbW1, ny,
        inNear_R, ny);

      // Sodium-orange ceiling lights — narrow bands on the ceiling
      // corners every 3rd segment.  Width / thickness are clamped so
      // the near-end vertices don't sprawl across half the screen
      // when the camera is offset (e.g. wall-scraping in tunnel),
      // which used to turn into a giant yellow wedge.
      if ((seg.index % 3) === 0) {
        const lightLenFar  = Math.max(2, Math.min(wallW2 * 0.35, 18));
        const lightLenNear = Math.max(2, Math.min(wallW1 * 0.35, 60));
        const lightThk     = Math.max(2, Math.min(segH * 0.25, 8));
        // Left light strip — sits on the ceiling-meets-wall corner.
        fillTrap(g, 0xFFD060,
          inFar_L - lightLenFar,   ceilFy,
          inFar_L,                 ceilFy,
          inNear_L,                ceilNy + lightThk,
          inNear_L - lightLenNear, ceilNy + lightThk);
        // Right light strip
        fillTrap(g, 0xFFD060,
          inFar_R,                  ceilFy,
          inFar_R + lightLenFar,    ceilFy,
          inNear_R + lightLenNear,  ceilNy + lightThk,
          inNear_R,                 ceilNy + lightThk);
      }
    }

    // ── Water (Lake Washington floating bridge segments) ─────────────
    // Water sits ABOVE the grass fill but UNDER the road, so the road
    // still paints cleanly on top.  Drawn as horizontal stripes so the
    // segment animates as scrolling waves rather than a flat blue field.
    // West Seattle Bridge — most spans cross paved port yards, with two
    // short tagged Duwamish/slip channels underneath. Cranes belong on
    // the paved spans; painting water for the entire bridge made them
    // look as though they had been dropped into the river.
    if (seg.bridge && !isGhost) {
      const leftFlankW  = Math.max(0, x2 - w2 - rw2 + M);
      const rightFlankX = x2 + w2 + rw2;
      const rightFlankW = Math.max(0, SCREEN_W + M -rightFlankX);
      const portLot = (seg.index & 1) === 0 ? 0x4E4B45 : 0x484640;
      g.fillStyle(portLot, 1);
      g.fillRect(-M, fy, leftFlankW, segH);
      g.fillRect(rightFlankX, fy, rightFlankW, segH);

      // Sparse concrete yard seams keep the dry spans readable as port
      // pavement behind crane feet rather than as a flat terrain patch.
      if (!seg.bridgeWaterChannel && (seg.index % 8) === 0) {
        g.fillStyle(0x625E56, 0.75);
        g.fillRect(-M, fy + segH * 0.62, leftFlankW, Math.max(1, segH * 0.06));
        g.fillRect(rightFlankX, fy + segH * 0.62, rightFlankW, Math.max(1, segH * 0.06));
      }

      if (seg.bridgeWaterChannel) {
        const waterCol  = 0x1A3550;   // Duwamish at depth - dark steel blue
        const waterCol2 = 0x122438;   // shadow band
        g.fillStyle(waterCol, 1);
        g.fillRect(-M, fy, leftFlankW, segH);
        g.fillRect(rightFlankX, fy, rightFlankW, segH);
        // Wave streak every 2 segments, visible only while crossing water.
        if ((seg.index & 1) === 0) {
          g.fillStyle(waterCol2, 0.55);
          g.fillRect(-M, fy + segH * 0.55, leftFlankW, Math.max(1, segH * 0.08));
          g.fillRect(rightFlankX, fy + segH * 0.55, rightFlankW, Math.max(1, segH * 0.08));
        }
      }
      // Concrete piers at intervals across the span. On channel segments
      // the dark foot shadow reads as a reflection in the water.
      if ((seg.index % 10) === 0) {
        const pylonH = Math.max(16, segH * 4.8);
        const pylonW = Math.max(5, w2 * 0.15);
        const topY = fy + segH * 0.12;
        const botY = Math.min(SCREEN_H + 40, topY + pylonH);
        const leftX = x2 - w2 - rw2 - pylonW * 1.45;
        const rightX = x2 + w2 + rw2 + pylonW * 0.45;
        const flare = Math.max(2, pylonW * 0.28);
        fillTrap(g, 0x9A968C,
          leftX, topY, leftX + pylonW, topY,
          leftX + pylonW + flare, botY, leftX - flare, botY);
        fillTrap(g, 0x9A968C,
          rightX, topY, rightX + pylonW, topY,
          rightX + pylonW + flare, botY, rightX - flare, botY);
        fillTrap(g, 0x5A554C,
          leftX + pylonW * 0.72, topY, leftX + pylonW, topY,
          leftX + pylonW + flare, botY, leftX + pylonW * 0.72, botY);
        fillTrap(g, 0x5A554C,
          rightX + pylonW * 0.72, topY, rightX + pylonW, topY,
          rightX + pylonW + flare, botY, rightX + pylonW * 0.72, botY);
        // Dark foot/reflection directly below each pier.
        g.fillStyle(seg.bridgeWaterChannel ? 0x0A1E30 : 0x383630, 0.35);
        g.fillRect(leftX - flare, botY - Math.max(1, segH * 0.2), pylonW + flare * 2, Math.max(1, segH * 0.35));
        g.fillRect(rightX - flare, botY - Math.max(1, segH * 0.2), pylonW + flare * 2, Math.max(1, segH * 0.35));
      }
    }

    // Left-side-only water (Elliott Bay along the West Seattle approach).
    // Painted before the bilateral `seg.water` block so a future segment
    // that wants BOTH flags can still get bilateral water from the block
    // below.  Doesn't paint waves/streaks — bay water is just a flat field.
    // `lakeWaterEdgeX` (RouteData LAKES `setbackFt`) holds the lake back from
    // the roadway: it is the |p.x| where water begins, and p.x ±1 projects to
    // ±w2, so the near edge lands at x2 ± lakeWaterEdgeX * w2.  Unset (a
    // waterline lake, and every non-lake water flag such as the Elliott Bay
    // approach) leaves the fill exactly where it was — hard against the
    // pavement + rumble.  Math.max keeps a setback from ever pulling the
    // waterline back INSIDE the rumble strip.
    const _setbackPx = seg.lakeWaterEdgeX ? seg.lakeWaterEdgeX * w2 : 0;

    if (seg.waterLeft && !seg.water && !seg.bridge && !isGhost) {
      const wave = (Math.sin(seg.index * 0.18) * 0.5 + 0.5);
      const waterCol = lerpColor(0x224A6E, 0x4A7FA8, wave * 0.6);
      g.fillStyle(waterCol, 1);
      const edge = _setbackPx
        ? Math.min(x2 - w2 - rw2, x2 - _setbackPx)
        : x2 - w2 - rw2;
      g.fillRect(-M, fy, Math.max(0, edge + M), segH);
    }

    // Right-side-only water — the mirror of the block above.  The flag has
    // had guardrail and dunk handling in GameScene since the DUI fork, but
    // never had a renderer, so a waterRight segment would drown you in
    // invisible water.  Needed for Keechelus and Easton, which I-90 passes
    // on the right heading east.
    if (seg.waterRight && !seg.water && !seg.bridge && !isGhost) {
      const wave = (Math.sin(seg.index * 0.18) * 0.5 + 0.5);
      const waterCol = lerpColor(0x224A6E, 0x4A7FA8, wave * 0.6);
      g.fillStyle(waterCol, 1);
      // Lake Easton is held 75 ft back — see `_setbackPx` above.  The terrain
      // pass has already painted this flank, so simply starting the water fill
      // further out is what leaves real ground showing between road and lake.
      const edge = _setbackPx
        ? Math.max(x2 + w2 + rw2, x2 + _setbackPx)
        : x2 + w2 + rw2;
      g.fillRect(edge, fy, Math.max(0, SCREEN_W + M - edge), segH);
    }

    if (seg.water) {
      const wave = (Math.sin(seg.index * 0.18) * 0.5 + 0.5);
      const waterCol  = lerpColor(0x224A6E, 0x4A7FA8, wave * 0.6);
      const waterCol2 = lerpColor(0x1A3A58, 0x2D5B82, wave * 0.6);
      // Left water field
      g.fillStyle(waterCol, 1);
      g.fillRect(-M, fy, Math.max(0, x2 - w2 - rw2 + M), segH);
      // Right water field
      g.fillRect(x2 + w2 + rw2, fy, Math.max(0, SCREEN_W + M -(x2 + w2 + rw2)), segH);
      // Wave streaks every 2 segments — gives motion as the road scrolls
      if ((seg.index & 1) === 0) {
        g.fillStyle(waterCol2, 0.65);
        g.fillRect(-M, fy + segH * 0.45, Math.max(0, x2 - w2 - rw2 + M), Math.max(1, segH * 0.10));
        g.fillRect(x2 + w2 + rw2, fy + segH * 0.45, Math.max(0, SCREEN_W + M -(x2 + w2 + rw2)), Math.max(1, segH * 0.10));
      }
      // White-cap glints
      if ((seg.index % 7) === 0) {
        g.fillStyle(0xE8F4FA, 0.55);
        g.fillRect(-150 + ((seg.index * 13) % (SCREEN_W + 300)) - 150,
                   fy + segH * 0.30, 22, Math.max(1, segH * 0.06));
      }
    }

    // Under-bridge structure for both the high West Seattle bridge and
    // the Lake Washington floating bridge. Drawn before railings/road
    // edge details, so it tucks under the deck instead of sitting on top.
    if (seg.water || seg.bridge) {
      const gS = structG ?? g;
      const deckDrop1 = Math.max(2, segH * (seg.bridge ? 0.38 : 0.26));
      const deckDrop2 = Math.max(2, segH * (seg.bridge ? 0.42 : 0.28));
      const outerFarL  = x2 - w2 - rw2;
      const outerFarR  = x2 + w2 + rw2;
      const outerNearL = x1 - w1 - rw1;
      const outerNearR = x1 + w1 + rw1;

      // Dark fascia under the entire bridge deck, visible along both
      // road edges as the bridge bends away.
      fillTrap(gS, 0x3F423C,
        outerFarL, fy, outerFarR, fy,
        outerNearR, ny + deckDrop1, outerNearL, ny + deckDrop1);
      fillTrap(gS, 0x77746A,
        outerFarL, fy, outerFarR, fy,
        outerNearR, ny + Math.max(1, deckDrop1 * 0.35),
        outerNearL, ny + Math.max(1, deckDrop1 * 0.35));

      // Repeating paired supports/pontoons. On Lake Washington these read
      // as floating bridge pontoons; on the elevated bridge they read as
      // pier columns under the deck.
      if ((seg.index % (seg.bridge ? 10 : 8)) === 0) {
        const pierW2 = Math.max(3, w2 * (seg.bridge ? 0.13 : 0.18));
        const pierW1 = Math.max(5, w1 * (seg.bridge ? 0.15 : 0.20));
        const pierDrop = Math.max(10, segH * (seg.bridge ? 4.8 : 2.4));
        const pierTopFar = fy + Math.max(1, segH * 0.15);
        const pierTopNear = ny + deckDrop2 * 0.55;
        const pierBotNear = Math.min(SCREEN_H + 50, pierTopNear + pierDrop);
        const farInset = w2 * 0.58;
        const nearInset = w1 * 0.58;

        const drawPier = (side) => {
          const farX = x2 + side * farInset;
          const nearX = x1 + side * nearInset;
          fillTrap(gS, 0x9C988E,
            farX - pierW2 * 0.5, pierTopFar,
            farX + pierW2 * 0.5, pierTopFar,
            nearX + pierW1 * 0.5, pierBotNear,
            nearX - pierW1 * 0.5, pierBotNear);
          fillTrap(gS, 0x5C584F,
            farX + side * pierW2 * 0.12, pierTopFar,
            farX + side * pierW2 * 0.5,  pierTopFar,
            nearX + side * pierW1 * 0.5, pierBotNear,
            nearX + side * pierW1 * 0.12, pierBotNear);
          gS.fillStyle(0x0A1E30, 0.32);
          gS.fillRect(nearX - pierW1 * 0.65, pierBotNear - Math.max(1, segH * 0.18),
                     pierW1 * 1.3, Math.max(1, segH * 0.45));
        };
        drawPier(-1);
        drawPier(1);
      }
    }

    // ── Bridge guardrails (floating bridge water + West Seattle Bridge) ─
    // Solid concrete Jersey-barrier on each side of the road, painted
    // outboard of the rumble strip.  Tall enough that we draw the side
    // wall as a vertical strip extending UPWARD from the road surface
    // toward the horizon — looks like a real barrier, not a flat band.
    // The West Seattle Bridge gets a TALLER railing (1.8× width) since
    // you're 200 ft up over the Duwamish.
    if (seg.water || seg.bridge) {
      const railMul = seg.bridge ? 1.8 : 1.0;
      const railW1 = Math.max(2, w1 * 0.06 * railMul);
      const railW2 = Math.max(2, w2 * 0.06 * railMul);
      const RAIL_BASE = 0xC8C4BB;
      const RAIL_DARK = 0x6E6A60;
      const RAIL_TOP  = 0xE6E2D6;
      // Route bridge guardrails to the front-overlay layer so their edges
      // stay crisp.
      const rg = (seg.bridge && this._frontG && this._camOnBridge) ? this._frontG : (structG ?? g);
      // Left guardrail face
      fillTrap(rg, RAIL_BASE,
        x2 - w2 - rw2 - railW2, fy, x2 - w2 - rw2, fy,
        x1 - w1 - rw1,         ny, x1 - w1 - rw1 - railW1, ny);
      // Top edge highlight (thin)
      fillTrap(rg, RAIL_TOP,
        x2 - w2 - rw2 - railW2, fy, x2 - w2 - rw2 - railW2 + Math.max(1, railW2 * 0.30), fy,
        x1 - w1 - rw1 - railW1 + Math.max(1, railW1 * 0.30), ny, x1 - w1 - rw1 - railW1, ny);
      // Bottom shadow (thin)
      fillTrap(rg, RAIL_DARK,
        x2 - w2 - rw2 - Math.max(1, railW2 * 0.30), fy, x2 - w2 - rw2, fy,
        x1 - w1 - rw1, ny, x1 - w1 - rw1 - Math.max(1, railW1 * 0.30), ny);
      // Right guardrail face
      fillTrap(rg, RAIL_BASE,
        x2 + w2 + rw2,         fy, x2 + w2 + rw2 + railW2, fy,
        x1 + w1 + rw1 + railW1, ny, x1 + w1 + rw1,         ny);
      fillTrap(rg, RAIL_TOP,
        x2 + w2 + rw2 + railW2 - Math.max(1, railW2 * 0.30), fy, x2 + w2 + rw2 + railW2, fy,
        x1 + w1 + rw1 + railW1, ny, x1 + w1 + rw1 + railW1 - Math.max(1, railW1 * 0.30), ny);
      fillTrap(rg, RAIL_DARK,
        x2 + w2 + rw2,         fy, x2 + w2 + rw2 + Math.max(1, railW2 * 0.30), fy,
        x1 + w1 + rw1 + Math.max(1, railW1 * 0.30), ny, x1 + w1 + rw1, ny);
      // Reflector posts — every ~9 segments with a per-cell jittered offset,
      // so the chain reads as posts a crew actually planted rather than as a
      // perfectly uniform dotted line.  World-anchored, so they never crawl.
      const _rCell = Math.floor(seg.index / 9);
      if (seg.index === _rCell * 9 + Math.floor(hash1(_rCell, 61) * 4)) {
        const postH = Math.max(2, segH * 0.45);
        rg.fillStyle(0xFF8800, 1);
        rg.fillRect(x2 - w2 - rw2 - railW2 - 1, fy - postH * 0.4, 2, postH * 0.4);
        rg.fillRect(x2 + w2 + rw2 + railW2 - 1, fy - postH * 0.4, 2, postH * 0.4);
      }
    }

    // Urban sidewalk — wide concrete band immediately outboard of each
    // rumble strip. Drawn AFTER the grass and BEFORE the road so the road
    // paints over the inner edge cleanly. Only in urban segments.
    if (seg.urban) {
      // ~½-lane wide.  The earlier 10% was too thin to read and blended
      // with grass; 24% reads as a clear sidewalk band.
      const sidewalkW1 = Math.max(3, w1 * 0.24);
      const sidewalkW2 = Math.max(3, w2 * 0.24);
      // Darker concrete — visible against most palette grass colors.
      const SIDEWALK_DK = 0x9C968C;
      const SIDEWALK_LT = 0xB8B0A4;
      const CURB_SHADOW = 0x4E4A44;
      // Left sidewalk (concrete fill)
      fillTrap(g, SIDEWALK_DK,
        x2 - w2 - rw2 - sidewalkW2, fy, x2 - w2 - rw2, fy,
        x1 - w1 - rw1,             ny, x1 - w1 - rw1 - sidewalkW1, ny);
      // Right sidewalk
      fillTrap(g, SIDEWALK_DK,
        x2 + w2 + rw2,             fy, x2 + w2 + rw2 + sidewalkW2, fy,
        x1 + w1 + rw1 + sidewalkW1, ny, x1 + w1 + rw1,             ny);
      // Restrained tonal variation instead of a bright centre stripe.  The
      // old highlight was a hard, uniformly-bright band down the middle of
      // every sidewalk, and combined with a seam on every 3rd segment it read
      // as a row of glowing repeating slabs rather than as concrete.  A
      // low-frequency wander (interpolated across ~9 segments, so no boundary
      // is visible) does the job of giving the band volume.
      const swTone = (noise1(seg.index / 9) - 0.5) * 0.16;
      const swCol  = lerpColor(SIDEWALK_DK, swTone > 0 ? SIDEWALK_LT : 0x6E6A62,
                               Math.abs(swTone) * 2);
      for (const sd of EDGE_SIDES) {
        const oIn2 = x2 + sd * (w2 + rw2),            oIn1 = x1 + sd * (w1 + rw1);
        const oOut2 = oIn2 + sd * sidewalkW2,         oOut1 = oIn1 + sd * sidewalkW1;
        fillTrap(g, swCol, oIn2, fyA, oOut2, fyA, oOut1, nyA, oIn1, nyA, 0.55);
      }

      // Curb — thick dark line ALONGSIDE THE ROAD (between rumble and
      // sidewalk) — this is what reads as "step up to the sidewalk".
      const curbW1 = Math.max(1, sidewalkW1 * 0.16);
      const curbW2 = Math.max(1, sidewalkW2 * 0.16);
      fillTrap(g, CURB_SHADOW,
        x2 - w2 - rw2 - curbW2, fy, x2 - w2 - rw2, fy,
        x1 - w1 - rw1,         ny, x1 - w1 - rw1 - curbW1, ny);
      fillTrap(g, CURB_SHADOW,
        x2 + w2 + rw2,         fy, x2 + w2 + rw2 + curbW2, fy,
        x1 + w1 + rw1 + curbW1, ny, x1 + w1 + rw1,         ny);
      // Slab joints, anchored to ABSOLUTE world Z at a real ~5 ft pitch and
      // only drawn where that pitch actually resolves on screen — the same
      // rule the shoulder rumble grooves use.  A joint on every 3rd SEGMENT
      // was both the wrong spacing and, past the near field, sub-pixel, which
      // is what turned the walkway into a uniform barcode of blocks.
      const slabPitch = segHA * (SLAB_Z / SEG_LENGTH);
      if (slabPitch > 3.5) {
        const zF = curr.relZ, zN = next.relZ;
        const invF = 1 / zF, dInv = (1 / zN) - invF;
        if (dInv > 1e-9) {
          const farAbs = (seg.index + 1) * SEG_LENGTH;
          const k0 = Math.floor((farAbs - SEG_LENGTH) / SLAB_Z) + 1;
          const k1 = Math.floor(farAbs / SLAB_Z);
          const jA = 0.22 * smoothstep((slabPitch - 3.5) / 4);
          for (let k = k0; k <= k1; k++) {
            const zRel = zF - (farAbs - k * SLAB_Z);
            if (zRel <= 1) continue;
            const t = (1 / zRel - invF) / dInv;
            if (t < 0 || t > 1) continue;
            const jy = fyA + (nyA - fyA) * t;
            const wf = w2 + (w1 - w2) * t, rf = rw2 + (rw1 - rw2) * t;
            const sf = sidewalkW2 + (sidewalkW1 - sidewalkW2) * t;
            const cx = x2 + (x1 - x2) * t;
            g.fillStyle(CURB_SHADOW, jA);
            for (const sd of EDGE_SIDES) {
              const inX = cx + sd * (wf + rf);
              g.fillRect(Math.min(inX, inX + sd * sf), jy, sf, 1);
            }
          }
        }
      }
    }

    // For bridge segments, route the road surface + markings to the
    // front-overlay layer (bridgeFrontGfx, depth 4) so the asphalt
    // paints OVER cranes (depth 2) — they can't be seen "through" the
    // road — while NPCs / cops / vices / signs (depth ≥ 7) still paint
    // on top of the road as expected.
    const surfaceG = (seg.bridge && this._frontG && this._camOnBridge) ? this._frontG : (structG ?? g);

    // ── Where the flat asphalt goes ────────────────────────────────────
    // For ordinary land segments the base fill is routed one layer DOWN
    // (roadBaseGfx, depth 1.35) so the projected asphalt texture (RoadPlane,
    // 1.42) can sit between it and everything drawn on the road afterwards.
    // Wear, shoulders, markings, ramps and the distance fog all still paint
    // into roadGfx in exactly the order they always did — only the flat fill
    // moved, so nothing else needed re-layering.
    //
    // Water / bridge segments keep their base on the original layer: the deck
    // fascia, pontoons and piers are drawn BEFORE the surface there and are
    // meant to be painted over by it (drawPier insets to 0.58w, i.e. INSIDE
    // the carriageway), so dropping the fill below them would expose piers on
    // the road.  Those segments are concrete decks and get no asphalt tile.
    const texSeg = !isGhost && !seg.water && !seg.bridge;
    const baseG  = (texSeg && this._roadBaseG) ? this._roadBaseG : surfaceG;

    // Road surface (top edge = far/narrow = curr; bottom edge = near/wide = next)
    //
    // SKIPPED for the double-vision ghost.  The ghost layer sits at depth 1.55
    // — above both the asphalt texture (1.42) and the road (1.5) — so an
    // opaque flat repaint of the whole carriageway at 62% alpha wiped the
    // aggregate out and left the road reading as a separate flat slab laid
    // over the textured one.  Double vision should double what you can SEE —
    // the paint, the edges, the sprites — not repaint the surface.  The
    // markings, fog line and shoulder tone below still draw, so the ghost
    // still reads as a doubled roadway, and the real texture shows through.
    if (!isGhost) {
      fillTrap(baseG, road,
        x2 - w2, fy, x2 + w2, fy,
        x1 + w1, ny, x1 - w1, ny);
    }

    // Paved shoulder base, laid on the SAME layer so the asphalt tile runs
    // across road and shoulder as one continuous surface rather than stopping
    // at the fog line.  Tunnels keep concrete shoulders (drawn above).
    //
    // Deliberately the SAME colour as the carriageway here.  RoadPlane tints
    // the whole row — road and shoulder alike — with the carriageway colour,
    // so darkening the shoulder in the base fill would be cancelled by the
    // texture in the near field and survive only where the texture has faded
    // out, i.e. the shoulder would get progressively darker with distance.
    // The darkening is applied ON TOP instead (see the road-edge block), which
    // reads identically at every depth.
    const shoulderCol = seg.tunnel ? lerpColor(road, 0x8F8A7D, 0.55) : road;
    if (!isGhost) {
      fillTrap(baseG, shoulderCol,
        x2 - w2 - rw2, fy, x2 - w2, fy,
        x1 - w1,       ny, x1 - w1 - rw1, ny);
      fillTrap(baseG, shoulderCol,
        x2 + w2, fy, x2 + w2 + rw2, fy,
        x1 + w1 + rw1, ny, x1 + w1, ny);
    }

    // ── Projected asphalt texture ──────────────────────────────────────
    // World-anchored, driven by this segment's OWN projection, so it tracks
    // hills, crests and curves and slides with the road as you steer instead
    // of sitting on the screen.  Under snow the tile is nearly suppressed but
    // NOT removed: ~7% survives full cover, which is what keeps a whiteout
    // reading as compacted snow rather than as a blank white polygon.
    if (texSeg && this._roadP) {
      const texA = 1 - snowBlanket * 0.93;
      this._roadP.pushRow(
        fyA, nyA, x2, x1, w2, w1, rw2, rw1,
        curr.relZ, next.relZ,
        rd.mix.a, rd.mix.b, rd.mix.t,
        road, road, texA);
    }

    // ── Road crown ─────────────────────────────────────────────────────
    // Real carriageways are cambered so water runs off, so the surface is very
    // slightly brighter along the centreline and falls away toward each edge.
    // Rendered as two outer shadows plus a faint centre lift, all bounded by
    // this segment's OWN projection so the gradient sweeps with the roadway
    // through curves instead of sitting in screen space.  Deliberately at the
    // edge of perception — it should register as form, never as a stripe.
    if (texSeg && !seg.tunnel && w2 > 4) {
      const crownFade = 1 - smoothstep((curr.relZ - 9000) / 39000);
      const cA = 0.055 * crownFade * (1 - snowBlanket) * nightMul;
      if (cA > 0.004) {
        for (const sd of EDGE_SIDES) {
          fillTrap(surfaceG, 0x000000,
            x2 + sd * w2 * 0.50, fyA, x2 + sd * w2, fyA,
            x1 + sd * w1,        nyA, x1 + sd * w1 * 0.50, nyA, cA);
        }
        fillTrap(surfaceG, 0xFFFFFF,
          x2 - w2 * 0.22, fyA, x2 + w2 * 0.22, fyA,
          x1 + w1 * 0.22, nyA, x1 - w1 * 0.22, nyA, cA * 0.40);
      }
    }

    // ── Asphalt wear ───────────────────────────────────────────────────
    // All of it LONGITUDINAL and alpha-blended so the texture underneath
    // still reads through.  The old version painted an opaque tone over the
    // whole segment for a repair patch (a band across the road) and a dark
    // seam on a fixed `index % 10` stride (a ladder of rungs marching up the
    // carriageway); both are gone.  Everything here is anchored to world
    // position via roadDetail(), so it can never flicker or crawl.
    const wearFade = 1 - smoothstep((curr.relZ - 9000) / 39000);
    if (texSeg && !seg.tunnel && w2 > 6 && wearFade > 0.02) {
      // Broad, faint wheel-path darkening, one pair per travel lane.
      const wearA = mat.wearAmt * wearFade * (1 - snowBlanket);
      if (wearA > 0.008) {
        const paths = wheelPaths(segLanes);
        // TWO nested bands per track, wide+faint under narrow+stronger.  A
        // single hard-edged band at full strength was reading as a broad dark
        // rectangle down the lane rather than as tyre polish; the outer skirt
        // gives the edge a falloff so it fades into the surrounding asphalt.
        for (let i = 0; i < paths.length; i++) {
          const sC = paths[i];
          const bc2 = x2 + sC * w2, bc1 = x1 + sC * w1;
          for (const [mul, aMul] of WHEEL_BANDS) {
            const bw2 = w2 * WHEEL_HALF * mul, bw1 = w1 * WHEEL_HALF * mul;
            fillTrap(surfaceG, 0x000000,
              bc2 - bw2, fyA, bc2 + bw2, fyA,
              bc1 + bw1, nyA, bc1 - bw1, nyA, wearA * aMul);
          }
        }
      }

      // Repair patch — a longitudinal rectangle of newer/darker asphalt that
      // spans many segments, with wandering edges and tapered ends.
      const p = rd.patch;
      if (p && p.amt > 0.004) {
        // Feathered in from the outside: three nested bands, each a bit
        // narrower and darker.  The previous single opaque-edged trapezoid is
        // what produced the rectangular blocks on the pavement — a patch of
        // asphalt has a ragged, soft boundary, not a drawn rail.
        const pa = p.amt * wearFade * (1 - snowBlanket);
        const cx = (p.x0 + p.x1) * 0.5, hw = (p.x1 - p.x0) * 0.5;
        for (const [mul, aMul] of PATCH_BANDS) {
          const a0 = cx - hw * mul, a1 = cx + hw * mul;
          fillTrap(surfaceG, 0x0A0A0C,
            x2 + a0 * w2, fyA, x2 + a1 * w2, fyA,
            x1 + a1 * w1, nyA, x1 + a0 * w1, nyA, pa * aMul);
        }
      }

      // (Transverse seams removed from asphalt.  Even rare and jittered they
      // are the one wear feature that runs ACROSS the road, which is exactly
      // the read being eliminated — and a real asphalt overlay has no
      // transverse joints at all.  Concrete decks keep the expansion joints
      // drawn with their own bridge/tunnel structure.)
    }

    // ── Wet-asphalt sheen (rain) ───────────────────────────────────────
    // Wet aggregate reflects specularly, and specular reflection off a plane
    // climbs sharply toward grazing incidence — so the sheen belongs at mid
    // distance, not under the bumper.  A broad, low-alpha sky-coloured band
    // gives that without turning the road into a mirror or stamping repeated
    // puddles on it.
    if (rainAmt > 0.02 && texSeg) {
      const z = curr.relZ;
      // Bump peaking around 18k units, tailing off by ~50k.
      const grazing = Math.max(0, Math.min(1, z / 18000)) * (1 - smoothstep((z - 18000) / 32000));
      const a = rainAmt * grazing * 0.17 * nightMul;
      if (a > 0.004) {
        fillTrap(surfaceG, palette.fog ?? palette.sky ?? 0x9BB0C2,
          x2 - w2, fyA, x2 + w2, fyA,
          x1 + w1, nyA, x1 - w1, nyA, a);
      }
    }

    // ── Partial snow: cleared wheel tracks and slush ───────────────────
    // Peaks at half cover and vanishes at both ends: bare road has nothing to
    // clear, and a total whiteout is meant to BE total (owner spec
    // 2026-07-27), so the tracks must not survive into it and hand the player
    // back a readable ribbon.
    if (texSeg && snowBlanket > 0.02 && snowBlanket < 0.92 && w2 > 6) {
      const peak = 4 * snowBlanket * (1 - snowBlanket);   // 0 at both ends, 1 at 0.5
      const bare = surfaceColor(seg, palette, 0);         // the pavement under it
      const trackA = peak * 0.62 * wearFade;
      if (trackA > 0.01) {
        const paths = wheelPaths(segLanes);
        for (let i = 0; i < paths.length; i++) {
          const s   = paths[i];
          const bw2 = w2 * 0.14, bw1 = w1 * 0.14;
          const bc2 = x2 + s * w2, bc1 = x1 + s * w1;
          fillTrap(surfaceG, bare,
            bc2 - bw2, fyA, bc2 + bw2, fyA,
            bc1 + bw1, nyA, bc1 - bw1, nyA, trackA);
        }
        // Grey slush ridges between the lanes, where the tracks throw it.
        const slush = lerpColor(bare, SNOW_WHITE, 0.55);
        for (let lane = 1; lane < segLanes; lane++) {
          const c = (lane / segLanes) * 2 - 1;
          const sw2 = w2 * 0.07, sw1 = w1 * 0.07;
          fillTrap(surfaceG, slush,
            x2 + c * w2 - sw2, fyA, x2 + c * w2 + sw2, fyA,
            x1 + c * w1 + sw1, nyA, x1 + c * w1 - sw1, nyA, peak * 0.5 * wearFade);
        }
      }
    }

    // ── Exit ramp diverging right ─────────────────────────────────────
    // RouteData.js tags segments leading into a rest stop with
    // `rampStrength` ∈ (0,1].  We paint a paved trapezoid that grows
    // outward from the right edge of the road as the strength climbs,
    // giving the unmistakable visual of an off-ramp peeling away.
    if (seg.rampStrength > 0) {
      const rs = seg.rampStrength;
      // ── TRUE DIVERGING LANE — gore + width grow TOGETHER ──────────
      // The previous two-phase shape kept the ramp glued to the road
      // for the first half (gore=0 while width grew), which looked
      // like the road getting wider — exactly the "pullout" feel the
      // player kept calling out.  Real I-90/FHWA diverging exit ramps
      // open the grass GORE wedge from a single apex point WHILE the
      // ramp width grows.  Both 0 at apex, both reach max at the exit.
      //
      //  rs = 0:    width=0, gore=0      (single-point apex)
      //  rs = 0.5:  width=0.5w, gore=0.5w (half-divergence, clear fork)
      //  rs = 1.0:  width=w, gore=0.95w   (fully separate ramp)
      //
      // The grass between the road's right edge and the ramp's inner
      // edge IS the visible gore — no special draw, the underlying
      // grass shows through because we leave that band unpainted.
      // Per 2026-05-30 user direction the ramp WIDTH stays the SAME the
      // whole window — big enough to drive on, never tapering to a point.
      // But freezing the GORE GAP at full too (the t = 1 version) painted
      // the ramp as a detached parallel strip sitting in the grass the
      // entire window — it never touched the road, so it read as a
      // "dead-end behind the exit sign" instead of an off-ramp.
      //
      // Fix: keep width full, but grow the GORE GAP with rampStrength so
      // the ramp's inner edge starts AT the road's outer edge (thin gore)
      // and diverges outward as you near the exit — a true Y.  Because
      // rampStrength climbs 0→1 across the approach window, the gore opens
      // toward the exit; on the after-exit taper it runs 1→0, closing the
      // gore back into a clean merge.  Width is unchanged (t = 1).
      // Ramp width grows IN STEP with the gore — narrow throat (0.35w) at the
      // apex up to a full 1.25w drivable lane at the exit.  This is what makes
      // it read as a true diverging Y: a thin slip-lane peels off the road edge
      // and fans out.  Freezing width at full (the old `t=1`, rampW = 1.25w
      // everywhere) made the apex a blunt full-width strip flush to the road,
      // so it looked like the road simply WIDENING (the "pullout" the player
      // kept flagging) rather than forking.  The 0.35w floor honors the
      // 2026-05-30 "never taper to a point" call — the throat stays drivable,
      // and the lane is full width by the exit where you actually peel off.
      const rampW1 = w1 * (0.35 + 0.90 * rs);
      const rampW2 = w2 * (0.35 + 0.90 * rs);
      // Gore opens with rampStrength: 0 at the apex (ramp flush against
      // the road edge) → full ~2 road half-widths at the exit point.
      const goreFrac = rs;
      const gap1   = w1 * 2.05 * goreFrac;
      const gap2   = w2 * 2.05 * goreFrac;
      // Asphalt fill — same colour as the mainline so the ramp doesn't read
      // as a different road type, just a continuation.  Routed to the base
      // layer (and given its own texture row below) for the same reason: a
      // flat-shaded ramp peeling off a textured highway is an obvious seam,
      // and the ramp is the one place the player looks hardest.
      fillTrap(baseG, road,
        x2 + w2 + gap2,         fy, x2 + w2 + gap2 + rampW2, fy,
        x1 + w1 + gap1 + rampW1, ny, x1 + w1 + gap1,         ny);
      if (texSeg && this._roadP) {
        // Reuse the road's own U mapping at the ramp's narrower width.
        // pushRow lays the quad at centre ± (w + e) and maps U to
        // U_EDGE * (w + e) / w, so passing the mainline half-width as `w` and
        // the DIFFERENCE as `e` (negative here) puts the ramp edges in the
        // right place AND keeps the texel scale identical to the highway —
        // the aggregate matches across the gore instead of being squeezed
        // into the narrower lane.
        const rh2 = rampW2 * 0.5, rh1 = rampW1 * 0.5;
        this._roadP.pushRow(
          fyA, nyA,
          x2 + w2 + gap2 + rh2, x1 + w1 + gap1 + rh1,
          w2, w1, rh2 - w2, rh1 - w1,
          curr.relZ, next.relZ,
          rd.mix.a, rd.mix.b, rd.mix.t,
          road, road, 1 - snowBlanket * 0.93);
      }
      // Edge stripe along the OUTSIDE of the ramp — the unmistakable
      // "ramp shoulder" line.  Weathered, not pure white: the ramp edge is the
      // same worn
      // thermoplastic as the fog line on the mainline, so a 0xFFFFFF stripe
      // here made the exit glow next to a road whose paint no longer does.
      const rampEdgeCol = lerpColor(
        lerpColor(0xC8C5B8, mat.gritCol, 0.22),
        road, paintFade);
      const edgeW1 = Math.max(2, w1 * 0.025);
      const edgeW2 = Math.max(2, w2 * 0.025);
      fillTrap(g, rampEdgeCol,
        x2 + w2 + gap2 + rampW2 - edgeW2, fyA, x2 + w2 + gap2 + rampW2, fyA,
        x1 + w1 + gap1 + rampW1,         nyA, x1 + w1 + gap1 + rampW1 - edgeW1, nyA, nightMul);
      // (Gore chevrons removed — at the game's perspective scale the
      // tiny V-arrows read as glitchy white triangles in the ramp wedge
      // rather than as a readable "do-not-cross" zone.  The white edge
      // stripe + yellow RPM dots are enough to communicate the split.)
      // (Yellow RPM dots in the gore removed — they read as "lane
      // markings painted on grass" without the underlying pavement.)
      // (Right-shoulder delineator posts removed 2026-05-30 — at the
      // game's perspective they stack into hash-mark-looking artifacts
      // across consecutive segments rather than reading as discrete
      // posts.)
      // ── Edge stripe along the INSIDE of the ramp (next to the gore).
      // Pairs with the OUTSIDE edge stripe drawn earlier so the ramp has
      // a real lane boundary on both sides.
      const innerW1 = Math.max(2, w1 * 0.020);
      const innerW2 = Math.max(2, w2 * 0.020);
      fillTrap(g, rampEdgeCol,
        x2 + w2 + gap2,         fyA, x2 + w2 + gap2 + innerW2, fyA,
        x1 + w1 + gap1 + innerW1, nyA, x1 + w1 + gap1,         nyA, nightMul);
      // (EXIT chevron triangle removed 2026-05-30 — across consecutive
      // segments the per-segment triangles stacked into a row of white
      // hash marks on the ramp surface that didn't read as a chevron.)
    }

    // ── Road edge ──────────────────────────────────────────────────────
    // What used to be here was a PURE WHITE trapezoid spanning the whole
    // rumble width on both sides, plus a second solid-white ribbon painted
    // once per frame over the top of it.  Together they read as a glowing
    // kerb running the length of the route.  Both are gone; the band now
    // carries the real cross-section of a rural highway edge, outward:
    //
    //     carriageway → fog line → paved shoulder → rumble grooves → grit
    //
    // The paved-shoulder asphalt itself was already laid on the base layer
    // (and is textured with the same tile as the road), so only the paint,
    // the grooves and the outer fringe are drawn here.  Every band is a
    // fraction of rw, so the whole cross-section tapers correctly with
    // perspective and stays parallel through curves.
    //
    // Bridges and tunnels keep their concrete treatment (kerbs, barriers and
    // portal shoulders are drawn elsewhere in this method); a milled rumble
    // strip and a gravel fringe are wrong on a deck or inside a portal.
    if (!seg.tunnel) {
      const FOG_0 = 0.00, FOG_1 = 0.13;    // edge line
      const RMB_0 = 0.45, RMB_1 = 0.70;    // milled grooves
      const GRT_0 = 0.70;                  // gravel / dirt / vegetation

      // Band edge at fraction f of the shoulder, on side `sd` (-1 left / +1 right).
      const eF = (f, sd) => x2 + sd * (w2 + rw2 * f);
      const eN = (f, sd) => x1 + sd * (w1 + rw1 * f);

      // Shoulder tone.  Translucent over the shared asphalt texture, so the
      // shoulder reads as the same material as the carriageway — just dirtier
      // and less trafficked — instead of as a separately-coloured strip.
      const shA = mat.shoulderDark * (1 - snowBlanket) * nightMul;
      if (shA > 0.01) {
        for (const sd of EDGE_SIDES) {
          fillTrap(surfaceG, 0x000000,
            eF(FOG_1, sd), fyA, eF(1.00, sd), fyA,
            eN(1.00, sd), nyA, eN(FOG_1, sd), nyA, shA);
        }
      }

      // Fog line — narrow and weathered, never bright white.  Wears on its
      // own slow cycle (independent of the lane dashes) and fades toward the
      // pavement with distance so it doesn't stay a hard wire at the horizon.
      if (snowBlanket < SNOW_MARKINGS_GONE) {
        const fogWear = hash1(Math.floor(seg.index / 26), 41);
        let edgeCol = lerpColor(0xC8C5B8, mat.gritCol, 0.18 + fogWear * 0.30);
        edgeCol = lerpColor(edgeCol, road, Math.min(1, snowBlanket / SNOW_MARKINGS_GONE));
        edgeCol = lerpColor(edgeCol, road, 0.55 * smoothstep((curr.relZ - 6000) / 44000));
        // Retroreflective at night, but only inside the headlight throw.
        const reflect = TimeOfDay.darkness(segMile) * (1 - smoothstep((curr.relZ - 3000) / 13000));
        if (reflect > 0.01) edgeCol = lerpColor(edgeCol, 0xFFF4D2, reflect * 0.45);
        else if (rainAmt > 0.02) edgeCol = lerpColor(edgeCol, 0xE8E6DC, rainAmt * 0.25);
        // The odd washed-out stretch, held for ~26 segments so it reads as a
        // worn section of line rather than as per-segment noise.
        const edgeA = (fogWear > 0.90 ? 0.35 : 1) * nightMul;
        for (const sd of EDGE_SIDES) {
          fillTrap(surfaceG, edgeCol,
            eF(FOG_0, sd), fyA, eF(FOG_1, sd), fyA,
            eN(FOG_1, sd), nyA, eN(FOG_0, sd), nyA, edgeA);
        }
      }

      // Everything past the fog line is a RURAL edge.  A bridge deck or a
      // floating-bridge span has a barrier hard against the shoulder, not a
      // milled strip crumbling into gravel, so those keep the concrete
      // treatment drawn with their guardrails and take the fog line only.
      //
      // Urban segments are excluded for the same reason: they have a kerb and
      // a concrete sidewalk butted against the shoulder (drawn above, at
      // x ± (w + rw)), and the gravel fringe feathers out to 1.35 x rw — so
      // on an urban street it would spray dirt across the kerb line.
      const ruralEdge = !seg.water && !seg.bridge && !seg.urban;

      // Rumble grooves.  Milled depressions sit ~12 in apart, which is a
      // THIRD of a segment — drawing one per segment (or one every N) is what
      // produces a horizontal barcode, so they are anchored to ABSOLUTE world
      // Z and only resolved where the segment is tall enough on screen to
      // separate them.  Farther out they collapse into the slightly darker
      // band, which is exactly what a rumble strip looks like at distance.
      const bandA = ruralEdge ? 0.28 * (1 - snowBlanket) * nightMul : 0;
      if (bandA > 0.01) {
        for (const sd of EDGE_SIDES) {
          fillTrap(surfaceG, 0x000000,
            eF(RMB_0, sd), fyA, eF(RMB_1, sd), fyA,
            eN(RMB_1, sd), nyA, eN(RMB_0, sd), nyA, bandA * 0.5);
        }
      }
      // Grooves may only be drawn where they actually RESOLVE.  Their screen
      // pitch is segH x (GROOVE_Z / SEG_LENGTH) = segH x 0.3, so the old
      // `segH > 3` gate was emitting ticks 0.9 px apart — far under one pixel
      // per feature, which is not a rumble strip but an aliasing pattern, and
      // is what read as a pixelated barcode down both shoulders.  Gate on the
      // PITCH instead: nothing until ~3.5 px apart, full by ~7.5 px.  Beyond
      // that the strip is carried by its darker band alone, which is what a
      // real rumble strip looks like at distance anyway.
      const groovePitch = ruralEdge ? segHA * (GROOVE_Z / SEG_LENGTH) : 0;
      const grooveRes   = smoothstep((groovePitch - 3.5) / 4);
      if (grooveRes > 0.02 && snowBlanket < 0.7) {
        const zF = curr.relZ, zN = next.relZ;
        const invF = 1 / zF, invN = 1 / zN;
        const dInv = invN - invF;
        if (dInv > 1e-9) {
          const farAbs = (seg.index + 1) * SEG_LENGTH;
          const k0 = Math.floor((farAbs - SEG_LENGTH) / GROOVE_Z) + 1;
          const k1 = Math.floor(farAbs / GROOVE_Z);
          const gA = grooveRes * 0.42 * (1 - snowBlanket) * nightMul;
          for (let k = k0; k <= k1; k++) {
            const zRel = zF - (farAbs - k * GROOVE_Z);
            if (zRel <= 1) continue;
            const t = (1 / zRel - invF) / dInv;
            if (t < 0 || t > 1) continue;
            const gy = fyA + (nyA - fyA) * t;
            const gh = Math.max(1, segHA * (GROOVE_Z / SEG_LENGTH) * 0.45);
            const wf = w2 + (w1 - w2) * t;
            const rf = rw2 + (rw1 - rw2) * t;
            const cx = x2 + (x1 - x2) * t;
            for (const sd of EDGE_SIDES) {
              fillTrap(surfaceG, 0x000000,
                cx + sd * (wf + rf * RMB_0), gy,
                cx + sd * (wf + rf * RMB_1), gy,
                cx + sd * (wf + rf * RMB_1), gy + gh,
                cx + sd * (wf + rf * RMB_0), gy + gh, gA);
            }
          }
        }
      }

      // Grit fringe — the pavement's outer edge crumbling into gravel, dust
      // and then the biome ground.  Painted at partial alpha so the ground
      // texture beneath shows through and the two genuinely blend rather than
      // meeting at a line.
      const gritCol = snowBlanket > 0.1
        // Dirty plowed buildup: snow shoved off the carriageway picks up grit.
        ? lerpColor(lerpColor(mat.gritCol, SNOW_WHITE, 0.62), 0x6B6A66, 0.22)
        : mat.gritCol;
      if (ruralEdge) for (const sd of EDGE_SIDES) {
        fillTrap(surfaceG, gritCol,
          eF(GRT_0, sd), fyA, eF(1.00, sd), fyA,
          eN(1.00, sd), nyA, eN(GRT_0, sd), nyA, 0.72 * nightMul);
        // Soft outer feather past the paved edge, so there is no hard line
        // where the shoulder ends and the roadside begins.
        fillTrap(surfaceG, gritCol,
          eF(1.00, sd), fyA, x2 + sd * (w2 + rw2 * 1.35), fyA,
          x1 + sd * (w1 + rw1 * 1.35), nyA, eN(1.00, sd), nyA, 0.30 * nightMul);
      }
    }

    // Lane markers (dashed — short paint, long gap, independent of
    // the rumble parallax cycle).  Skip the centerline lane on
    // even-lane roads — the double yellow paints there instead, and
    // the white dashes were showing through the gap between the two
    // yellow lines.
    if (dashHead || (isGhost && dashOn)) {
      // Per-DASH paint wear (stable across the whole dash): faded brightness,
      // width jitter, and the odd near-gone dash — so lane paint reads as real
      // striping, not a uniform digital strip.
      const dashId = Math.floor(seg.index / dashCycle);
      const dw     = hash1(dashId, 78);                             // [0,1) per dash
      const gone   = dw > 0.94;                                     // ~6% missing/scuffed
      // Snow buries dashes UNEVENLY — each dash goes under at its own
      // threshold, so markings disappear raggedly instead of all at once.
      const buried = snowBlanket > SNOW_MARKINGS_GONE * (0.62 + dw * 0.60);
      let wornLane = lerpColor(laneCol, 0x8C8778, dw * 0.5);
      wornLane = lerpColor(wornLane, road, paintFade);
      if (reflectAmt > 0.01)    wornLane = lerpColor(wornLane, 0xFFF6DC, reflectAmt * 0.55);
      else if (wetPaint > 0.01) wornLane = lerpColor(wornLane, 0xEFEDE4, wetPaint);
      const skipLane = (segLanes % 2 === 0) ? segLanes / 2 : -1;

      // Far edge of the WHOLE dash.  The ring holds the far boundary of the
      // dash's last segment; if that segment was crest-culled or has scrolled
      // out, the entry won't match and we fall back to this segment's own far
      // edge — degrading to the old per-segment look rather than dropping the
      // dash entirely.
      let fxD = x2, fyD = fy, fwD = w2;
      if (dashHead) {
        const _rn   = this._dashRingN;
        const _want = seg.index + LANE_DASH_LEN - 1;
        const _ri   = (_want % _rn) * 4;
        const _r    = this._dashRing;
        if (_r[_ri] === _want && _r[_ri + 3] > 0) {
          fxD = _r[_ri + 1]; fyD = _r[_ri + 2]; fwD = _r[_ri + 3];
        }
      }
      // Chipping shortens the single quad instead of dropping whole segments,
      // so a chipped dash reads as paint worn through rather than a gap.
      if (dw > 0.80 && dw <= 0.94) {
        const keep = 0.35 + hash1(dashId, 79) * 0.45;
        fyD = nyA + (fyD - nyA) * keep;
        fxD = x1  + (fxD - x1)  * keep;
        fwD = w1  + (fwD - w1)  * keep;
      }
      // ~20% thinner than the old 0.82-1.14 band (owner 2026-08-03).  Safe to
      // narrow now that a dash is ONE quad spanning its full world length —
      // its visibility at distance no longer depends on per-segment width, so
      // trimming it doesn't reintroduce the vanishing-dash problem.
      // Floored at ~0.4 px half-width: far dashes keep a minimum perceptual
      // presence instead of dropping below the rasteriser entirely.  Sub-pixel
      // coverage + the weathered colour + the 25% atmospheric blend keep this
      // from reading as a bright pixel column.
      const jwF = Math.max(0.55, laneW(fwD, segLanes) * (0.66 + dw * 0.26));
      const jwN = Math.max(0.55, laneW(w1,  segLanes) * (0.66 + dw * 0.26));

      if (!gone && !buried) for (let lane = 1; lane < segLanes; lane++) {
        if (lane === skipLane) continue;
        const lxN = x1  + (lane / segLanes) * 2 * w1  - w1;
        const lxF = fxD + (lane / segLanes) * 2 * fwD - fwD;
        fillTrap(surfaceG, wornLane,
          lxF - jwF, fyD, lxF + jwF, fyD,
          lxN + jwN, nyA, lxN - jwN, nyA, nightMul);
      }
    }

    // Double solid yellow center line — only on multi-lane roads.  Worn
    // per-segment toward a duller, sun-faded yellow so it isn't a flat
    // fluorescent stripe.
    // Snow buries it: this stripe has its OWN colour and so ignored the snow
    // blend applied to `laneCol`, which left a bright yellow centre line
    // painted across an otherwise total whiteout.  It now dissolves into the
    // road on the same schedule the dashes do (gone by snowBlanket 0.55).
    if (segLanes >= 2 && snowBlanket < SNOW_MARKINGS_GONE) {
      // Widths stay float — rounding them to whole pixels was quantising the
      // centre line to integer widths per segment, which put a visible step
      // in the stripe every time the rounding flipped.
      const clw1 = Math.max(0.8, lw1 * 0.55);
      const clw2 = Math.max(0.8, lw2 * 0.55);
      const gap1 = lw1 * 1.1;
      const gap2 = lw2 * 1.1;
      // Highway centre-line yellow is a muted ochre, not a fluorescent
      // primary — 0xFFEE00 was reading as a neon strip laid on the asphalt.
      // Wear is keyed to a ~20-segment cell so the fading happens in stretches
      // rather than flickering segment to segment.
      const yWear = hash1(Math.floor(seg.index / 19), 31);
      // Desaturated 20% toward its own luminance and darkened 22% from the
      // previous C9B04A/9C8B45 pair.  Highway centre-line yellow is an ochre
      // that has spent years in UV; the brighter mix still read as a lit
      // strip laid on the asphalt rather than paint worn into it.
      let wornYellow = lerpColor(0x988949, 0x776C40, yWear * 0.55);
      wornYellow = lerpColor(wornYellow, road, paintFade);
      wornYellow = lerpColor(wornYellow, road, Math.min(1, snowBlanket / SNOW_MARKINGS_GONE));
      if (reflectAmt > 0.01)    wornYellow = lerpColor(wornYellow, 0xFFE9A0, reflectAmt * 0.50);
      else if (wetPaint > 0.01) wornYellow = lerpColor(wornYellow, 0xE0CE86, wetPaint);
      fillTrap(surfaceG, wornYellow,
        x2 - gap2 - clw2, fyA, x2 - gap2,       fyA,
        x1 - gap1,        nyA, x1 - gap1 - clw1, nyA, nightMul);
      fillTrap(surfaceG, wornYellow,
        x2 + gap2,        fyA, x2 + gap2 + clw2, fyA,
        x1 + gap1 + clw1, nyA, x1 + gap1,        nyA, nightMul);
    }

    // ── Raised median (divided highway through the wildlife crossing) ──
    // A low concrete divider down the centerline that carries the overpass
    // center pier, so the road visibly SPLITS into two carriageways.  Width
    // + height scale with seg.medianW (0→1→0 taper) so it eases up out of
    // the road and back down — no abrupt wall.  Drawn on surfaceG AFTER the
    // lane lines so it sits on top of the asphalt (and over the now-covered
    // center line).  The soft side-barrier in GameScene keeps the player off
    // it / out from under the pier (you still pick left or right).
    if (seg.medianZone && !isGhost && segLanes >= 2) {
      const mw = seg.medianW ?? 0;
      if (mw > 0.02) {
        const mWf = Math.max(1, w2 * 0.16 * mw);
        const mWn = Math.max(1, w1 * 0.16 * mw);
        const mHf = Math.max(1, w2 * 0.07 * mw);   // raised height, far
        const mHn = Math.max(2, w1 * 0.12 * mw);   // raised height, near
        const cf = x2, cn = x1;
        // Left side face (shadowed) and right side face (lit) of the curb.
        fillTrap(surfaceG, 0x5E5A52,
          cf - mWf, fy,        cf - mWf, fy - mHf,
          cn - mWn, ny - mHn,  cn - mWn, ny);
        fillTrap(surfaceG, 0x6E6A62,
          cf + mWf, fy - mHf,  cf + mWf, fy,
          cn + mWn, ny,        cn + mWn, ny - mHn);
        // Top surface (lighter concrete).
        fillTrap(surfaceG, 0xAEAAA0,
          cf - mWf, fy - mHf,  cf + mWf, fy - mHf,
          cn + mWn, ny - mHn,  cn - mWn, ny - mHn);
      }
    }

    // Fog overlay — same treatment for tunnel and non-tunnel segments
    // now that the tunnel structure is bounded to the road's screen
    // area.  Fog tints both the surrounding world and the tunnel
    // walls slightly toward the haze colour at distance.
    if (fog > 0.05) {
      // 0.35 cap (was 0.85): at 85% the last rows were repainted almost
      // fully in palette.fog — a hard light-blue stripe hugging the far
      // cap, absurd for a ~380 m view distance.  The biome bands above the
      // horizon carry "beyond the cap" scenery now; this veil only needs
      // to soften the last rows, matching the world fill's 0.35 blend so
      // fill → veil → clear road is one continuous ramp.
      // Exact bounds: this veil is translucent and per-segment, so the ±1
      // overshoot double-darkened a 2 px line at every boundary — the same
      // defect as the wear layers above, and pre-dating them.
      g.fillStyle(palette.fog ?? palette.sky, fog * 0.35);
      g.fillRect(-M, fyA, SCREEN_W + M * 2, segHA);
    }
  }

  _drawSprites(g, drawn, isGhost = false, xOffset = 0) {
    // xOffset is added to screenX so the ghost pass can request an
    // offset draw without cloning the drawn[] entry.
    const { seg, screenY, screenW, scale } = drawn;
    const screenX = drawn.screenX + xOffset;
    if (!seg.sprites || !seg.sprites.length) return;
    if (screenY > SCREEN_H + 100 || screenY < 0) return;  // skip off-screen segments

    for (const sp of seg.sprites) {
      // Roadblocks are gated on wanted level — under 3 stars they're not a
      // "thing yet" so we hide them entirely (and GameScene also skips the
      // collision in _onCollect).
      if (sp.type === 'cop_roadblock' && (this._currentStars ?? 0) < 3) continue;
      // Vice sprites that haven't been resolved to a real vice type yet
      // (out of GameScene's lazy-assign window) — skip until typed.
      if (sp.type === 'vice-pending') continue;
      // Signs are rendered EXCLUSIVELY by renderSignOverlay (high-depth
      // signGfx layer) so they paint on top of trees / buildings.  Drawing
      // them here too produced a stacked second copy at low depth, which
      // could read as "two signs, one smaller than the other" when
      // perspective interpolation diverged between the two passes.
      if (sp.type === 'mileage_sign'
       || sp.type === 'exit_sign_green'
       || sp.type === 'amenities_sign'
       || sp.type === 'next_stops_sign'
       || sp.type === 'rest_sign'
       || sp.type === 'grade_sign'
       || sp.type === 'sign') continue;
      // Scale sprites by depth
      const spriteScale = scale * SCREEN_W / 2;

      // Roadside offset: sp.offset > 1 = right side, < -1 = left side.
      // Procedural houses are wide enough that their footprint can bleed
      // into the sidewalk/road if the anchor is too close, so enforce a
      // minimum visual setback even for already-generated route segments.
      let visualOffset = sp.offset;
      if (sp.type === 'house' || sp.type === 'building') {
        const minOffset = sp.type === 'house' ? 2.35 : 2.10;
        const sign = visualOffset >= 0 ? 1 : -1;
        visualOffset = sign * Math.max(Math.abs(visualOffset), minOffset);
      }
      const spriteH = toInt(sp.baseH * spriteScale * 0.5);
      const spriteW = toInt(sp.baseW * spriteScale * 0.5);
      if (sp.type === 'house' || sp.type === 'building' || sp.type === 'tree'
          || sp.type === 'cactus' || sp.type === 'palm' || sp.type === 'shrub'
          || sp.type === 'landmark') {
        const sign = visualOffset >= 0 ? 1 : -1;
        const carPx = scale * 825 * SCREEN_W / 2;
        const neededOffset = 1 + (spriteW * 0.5 + carPx * 2) / Math.max(1, screenW);
        visualOffset = sign * Math.max(Math.abs(visualOffset), neededOffset);
      }
      const spriteX = toInt(screenX + screenW * visualOffset);
      const spriteTopY = screenY - spriteH;

      // Only skip if entirely below the screen or vanishingly small.
      // Allow sprites taller than the screen — Phaser clips them automatically.
      if (spriteTopY > SCREEN_H || spriteH < 1) continue;

      this._drawSpriteShape(g, sp.type, spriteX, spriteTopY, spriteW, spriteH, sp.collected, sp, isGhost);
    }
  }

  _drawSpriteShape(g, type, x, y, w, h, collected, sp, isGhost = false) {
    // Vice pickups and F12 weapon tokens are rendered by GameScene's
    // sprite pool (using the player's images). Skip procedural drawing.
    if (sp?.collectibleType === 'vice' || sp?.collectibleType === 'f12') return;
    // Buildings / trees that have an image texture are rendered by
    // GameScene._renderSceneSprites using Phaser Images.
    if (sp?.texKey) return;
    if (collected) return;

    // Houses + buildings paint to the dedicated props Graphics layer (if
    // provided) so they live in the higher-depth band and don't hide
    // behind image-based trees rendered by GameScene._renderSceneSprites.
    // Skipped during the ghost (Sushi double-vision) pass — that overlay
    // owns its own Graphics with a translucent global alpha; diverting
    // houses elsewhere would erase them from the doubled image.
    if ((type === 'house' || type === 'building') && this._propsG && !isGhost) {
      g = this._propsG;
    }
    switch (type) {
      case 'tree': {
        // Solid trunk
        g.fillStyle(0x5D3A1A, 1);
        g.fillRect(x - w * 0.09, y + h * 0.70, w * 0.18, h * 0.30);
        g.fillStyle(0x3D2510, 1);
        g.fillRect(x + w * 0.01, y + h * 0.70, w * 0.08, h * 0.30);
        // Three solid overlapping ellipses — no see-through gaps
        g.fillStyle(0x1A6E1A, 1);
        g.fillEllipse(x, y + h * 0.62, w * 1.0, h * 0.52);
        g.fillStyle(0x228B22, 1);
        g.fillEllipse(x, y + h * 0.42, w * 0.82, h * 0.46);
        g.fillStyle(0x2EA82E, 1);
        g.fillEllipse(x, y + h * 0.22, w * 0.60, h * 0.36);
        // Bright top
        g.fillStyle(0x44CC44, 1);
        g.fillEllipse(x, y + h * 0.08, w * 0.38, h * 0.20);
        // Left-side highlight (sun on upper-left)
        g.fillStyle(0x66EE66, 0.5);
        g.fillEllipse(x - w * 0.12, y + h * 0.06, w * 0.22, h * 0.14);
        break;
      }
      case 'shrub': {
        // Sagebrush — low, broad, dusty olive-green clump.  Sits ground-
        // level (no trunk) so it reads at a glance as "high-desert brush".
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(x + w * 0.05, y + h, w * 0.95, h * 0.10);
        // Three overlapping ellipses give it a tufted silhouette.
        g.fillStyle(0x6B7A48, 1);
        g.fillEllipse(x - w * 0.20, y + h * 0.55, w * 0.70, h * 0.55);
        g.fillStyle(0x7C8C58, 1);
        g.fillEllipse(x + w * 0.18, y + h * 0.50, w * 0.78, h * 0.65);
        g.fillStyle(0x8E9C68, 1);
        g.fillEllipse(x,             y + h * 0.30, w * 0.62, h * 0.55);
        // Sun-side highlight
        g.fillStyle(0xB7C088, 0.55);
        g.fillEllipse(x - w * 0.15, y + h * 0.18, w * 0.32, h * 0.22);
        break;
      }
      case 'cactus': {
        // (Legacy — Columbia Basin no longer spawns cactus, but kept so
        // any cached segments still render.)
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(x + w * 0.1, y + h, w * 0.4, h * 0.08);
        g.fillStyle(0x2E8B2E, 1);
        g.fillRect(x - w * 0.13, y, w * 0.26, h);
        g.fillStyle(0x1A6E1A, 1);
        g.fillRect(x + w * 0.02, y, w * 0.11, h);
        g.fillStyle(0x2E8B2E, 1);
        g.fillRect(x - w * 0.52, y + h * 0.28, w * 0.39, h * 0.2);
        g.fillRect(x + w * 0.13, y + h * 0.48, w * 0.4, h * 0.2);
        g.fillStyle(0x44BB44, 0.5);
        g.fillRect(x - w * 0.52, y + h * 0.28, w * 0.39, h * 0.07);
        g.fillRect(x + w * 0.13, y + h * 0.48, w * 0.4, h * 0.07);
        g.fillStyle(0x44BB44, 1);
        g.fillRect(x - w * 0.1, y - h * 0.06, w * 0.2, h * 0.1);
        break;
      }
      case 'palm': {
        // Shadow
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(x + w * 0.15, y + h, w * 0.6, h * 0.09);
        // Trunk (slightly curved look via two rects)
        g.fillStyle(0x9B7928, 1);
        g.fillRect(x - w * 0.09, y + h * 0.32, w * 0.18, h * 0.68);
        g.fillStyle(0x7A5E1A, 1);
        g.fillRect(x + w * 0.01, y + h * 0.32, w * 0.08, h * 0.68);
        // Trunk rings
        for (let r = 0; r < 4; r++) {
          g.fillStyle(0x7A5E1A, 0.4);
          g.fillRect(x - w * 0.09, y + h * (0.35 + r * 0.16), w * 0.18, h * 0.04);
        }
        // Fronds (5 leaf directions)
        const fColors = [0x2D9B2D, 0x3DBF3D, 0x22881A];
        const fronds = [[-0.7,-0.7],[-0.4,-0.5],[0,-0.6],[0.45,-0.5],[0.72,-0.65]];
        for (let f = 0; f < fronds.length; f++) {
          const [fx, fy_] = fronds[f];
          g.fillStyle(fColors[f % 3], 1);
          const baseX = x, baseY = y + h * 0.32;
          const tipX = x + w * fx * 0.9, tipY = baseY + h * fy_ * 0.45;
          const midX = (baseX + tipX) / 2, midY = (baseY + tipY) / 2;
          g.fillTriangle(baseX - w * 0.06, baseY, baseX + w * 0.06, baseY, tipX, tipY);
          g.fillStyle(0x88FF88, 0.15);
          g.fillTriangle(baseX - w * 0.02, baseY, midX, midY, tipX, tipY);
        }
        break;
      }
      case 'rest_sign': {
        // Highway-style green sign — text painted directly on the green
        // face by the GameScene overlay (no white inset plates).
        const POST_COL  = 0x6E665A;
        const FACE_COL  = 0x0E5C24;
        const FACE_HI   = 0x2A8E3F;
        const BORDER    = 0xFFFFFF;
        g.fillStyle(POST_COL, 1);
        g.fillRect(x - w * 0.36, y + h * 0.55, w * 0.07, h * 0.45);
        g.fillRect(x + w * 0.29, y + h * 0.55, w * 0.07, h * 0.45);
        // White-bordered green face
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.62, y - h * 0.02, w * 1.24, h * 0.60);
        g.fillStyle(FACE_COL, 1);
        g.fillRect(x - w * 0.58, y + h * 0.02, w * 1.16, h * 0.52);
        g.fillStyle(FACE_HI, 1);
        g.fillRect(x - w * 0.58, y + h * 0.02, w * 1.16, h * 0.06);
        // Yellow flag for the 1mi / exit subs
        if (sp?.sub === '1mi') {
          g.fillStyle(0xFFCC00, 1);
          g.fillRect(x - w * 0.30, y - h * 0.10, w * 0.60, h * 0.10);
        } else if (sp?.sub === 'exit') {
          g.fillStyle(0xFFEE00, 1);
          g.fillRect(x - w * 0.30, y - h * 0.10, w * 0.60, h * 0.10);
          // Right-pointing arrow on the green face
          g.fillStyle(BORDER, 0.95);
          g.fillTriangle(
            x + w * 0.10, y + h * 0.40,
            x + w * 0.40, y + h * 0.40,
            x + w * 0.40, y + h * 0.55,
          );
          g.fillRect(x + w * 0.10, y + h * 0.42, w * 0.30, h * 0.08);
        }
        break;
      }
      case 'exit_sign_green': {
        // Big I-90-style green overhead sign.  Text (REST STOP, EXIT label,
        // town name) is painted directly on the green face by the
        // GameScene text overlay; the highway-shield badge in the top-left
        // corner is overlaid as an Image by GameScene._renderSignDecals.
        const POST_COL = 0x6E665A;
        const FACE     = 0x0E5C24;     // interstate green
        const FACE_HI  = 0x2A8E3F;
        const BORDER   = 0xFFFFFF;
        // Two tall steel posts
        g.fillStyle(POST_COL, 1);
        g.fillRect(x - w * 0.40, y + h * 0.65, w * 0.07, h * 0.35);
        g.fillRect(x + w * 0.33, y + h * 0.65, w * 0.07, h * 0.35);
        // White-bordered green sign face
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.66, y - h * 0.02, w * 1.32, h * 0.72);
        g.fillStyle(FACE, 1);
        g.fillRect(x - w * 0.62, y + h * 0.02, w * 1.24, h * 0.64);
        g.fillStyle(FACE_HI, 1);
        g.fillRect(x - w * 0.62, y + h * 0.02, w * 1.24, h * 0.06);
        // Yellow plaque on top — header reads "REST STOP".  Pass-through
        // city signs (no rest stop at this exit) skip the plaque entirely
        // so the green face shows just EXIT + town, matching real WSDOT
        // freeway signs at non-rest-area interchanges.
        if (!sp?.passThrough) {
          g.fillStyle(0xFFEE00, 1);
          g.fillRect(x - w * 0.42, y - h * 0.18, w * 0.84, h * 0.18);
          g.fillStyle(0x000000, 1);
          g.fillRect(x - w * 0.40, y - h * 0.16, w * 0.80, h * 0.02);
        }
        // Down-arrow indicator (right-side exit)
        g.fillStyle(BORDER, 0.95);
        g.fillTriangle(
          x + w * 0.30, y + h * 0.66,
          x + w * 0.55, y + h * 0.66,
          x + w * 0.42, y + h * 0.74,
        );
        break;
      }
      case 'amenities_sign': {
        // White rectangle "frame" sized slightly larger than the pre-baked
        // PNG that GameScene._renderSignDecals overlays — the white halos
        // the artwork on every side.  Tall steel legs run from the bottom
        // of the white rect down to the road surface so the sign reads as
        // an overhead gantry, not a ground-mounted placard.  All
        // measurements are in `w` units (= signW in _renderSignDecals)
        // so the procedural frame and PNG overlay always align.
        //
        // PNG natural aspect 1277:840 ≈ 1.52:1.  PNG drawn at width
        // 1.20 w (height 0.789 w).  White frame is 1.30 w × 0.87 w —
        // 4 % padding all around.  Legs extend from frame bottom
        // (y + 0.83 w) down to the road (y + h).
        const POST_COL = 0x6E665A;
        const BORDER   = 0xFFFFFF;
        const frameTop    = y - w * 0.04;
        const frameBottom = y + w * 0.83;
        // White rectangle
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.65, frameTop, w * 1.30, frameBottom - frameTop);
        // Legs — only draw if there's room below the frame for them
        // (sprite height must be > frame bottom).
        const legBottom = y + h;
        if (legBottom > frameBottom) {
          g.fillStyle(POST_COL, 1);
          g.fillRect(x - w * 0.40, frameBottom, w * 0.07, legBottom - frameBottom);
          g.fillRect(x + w * 0.33, frameBottom, w * 0.07, legBottom - frameBottom);
        }
        break;
      }
      case 'grade_sign': {
        // Yellow regulatory warning sign — diamond-on-square aesthetic with
        // a black border.  Used for "STEEP GRADE" / "TRUCKS USE LOWER GEAR"
        // warnings before sustained 4 %+ descents/climbs.  Text is painted
        // by GameScene._renderSignText on top of the yellow face.
        const POST_COL = 0x6E665A;
        const FACE     = 0xFFCC22;
        const BORDER   = 0x000000;
        // Posts
        g.fillStyle(POST_COL, 1);
        g.fillRect(x - w * 0.25, y + h * 0.55, w * 0.06, h * 0.45);
        g.fillRect(x + w * 0.19, y + h * 0.55, w * 0.06, h * 0.45);
        // Black diamond border (rectangle, since fillTriangle math costs more)
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.50, y - h * 0.02, w * 1.00, h * 0.62);
        // Yellow face slightly inset
        g.fillStyle(FACE, 1);
        g.fillRect(x - w * 0.46, y + h * 0.02, w * 0.92, h * 0.54);
        break;
      }
      case 'mileage_sign': {
        // Highway green location sign — town + mile painted directly on
        // the green face by the GameScene overlay (no white inset plates).
        const POST_COL = 0x6E665A;
        const FACE     = 0x0E5C24;
        const FACE_HI  = 0x2A8E3F;
        const BORDER   = 0xFFFFFF;
        g.fillStyle(POST_COL, 1);
        g.fillRect(x - w * 0.30, y + h * 0.55, w * 0.06, h * 0.45);
        g.fillRect(x + w * 0.24, y + h * 0.55, w * 0.06, h * 0.45);
        // White-bordered green face
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.55, y - h * 0.02, w * 1.10, h * 0.62);
        g.fillStyle(FACE, 1);
        g.fillRect(x - w * 0.51, y + h * 0.02, w * 1.02, h * 0.54);
        g.fillStyle(FACE_HI, 1);
        g.fillRect(x - w * 0.51, y + h * 0.02, w * 1.02, h * 0.06);
        break;
      }
      case 'next_stops_sign': {
        // Tall green I-90-style upcoming-exits placard — a single big
        // green face listing the next three town names + mile counts.
        // Header band at top reads "NEXT EXITS" (painted by GameScene).
        const POST_COL = 0x6E665A;
        const FACE     = 0x0E5C24;
        const FACE_HI  = 0x2A8E3F;
        const BORDER   = 0xFFFFFF;
        g.fillStyle(POST_COL, 1);
        g.fillRect(x - w * 0.34, y + h * 0.65, w * 0.06, h * 0.35);
        g.fillRect(x + w * 0.28, y + h * 0.65, w * 0.06, h * 0.35);
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.62, y - h * 0.02, w * 1.24, h * 0.74);
        g.fillStyle(FACE, 1);
        g.fillRect(x - w * 0.58, y + h * 0.02, w * 1.16, h * 0.66);
        g.fillStyle(FACE_HI, 1);
        g.fillRect(x - w * 0.58, y + h * 0.02, w * 1.16, h * 0.06);
        break;
      }
      case 'sign': {
        // Legacy random sign (no longer spawned, kept for any old cached
        // segments).  Re-route to the new mileage_sign style for parity.
        const POST_COL = 0x6E665A;
        const FACE     = 0x0E5C24;
        const FACE_HI  = 0x2A8E3F;
        const BORDER   = 0xFFFFFF;
        g.fillStyle(POST_COL, 1);
        g.fillRect(x - w * 0.30, y + h * 0.55, w * 0.06, h * 0.45);
        g.fillRect(x + w * 0.24, y + h * 0.55, w * 0.06, h * 0.45);
        g.fillStyle(BORDER, 1);
        g.fillRect(x - w * 0.55, y - h * 0.02, w * 1.10, h * 0.62);
        g.fillStyle(FACE, 1);
        g.fillRect(x - w * 0.51, y + h * 0.02, w * 1.02, h * 0.54);
        g.fillStyle(FACE_HI, 1);
        g.fillRect(x - w * 0.51, y + h * 0.02, w * 1.02, h * 0.06);
        g.fillStyle(BORDER, 0.95);
        g.fillRect(x - w * 0.42, y + h * 0.10, w * 0.84, h * 0.16);
        g.fillRect(x - w * 0.18, y + h * 0.34, w * 0.36, h * 0.13);
        break;
      }
      case 'sushi': {
        // Shadow
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(x + w * 0.08, y + h, w * 0.55, h * 0.09);
        // Bottle body
        g.fillStyle(0xCC8800, 1);
        g.fillRoundedRect(x - w * 0.28, y + h * 0.32, w * 0.56, h * 0.64, w * 0.1);
        // Bottle neck
        g.fillStyle(0xBB7700, 1);
        g.fillRect(x - w * 0.15, y + h * 0.10, w * 0.3, h * 0.24);
        // Cap
        g.fillStyle(0xCC2222, 1);
        g.fillRect(x - w * 0.18, y + h * 0.06, w * 0.36, h * 0.08);
        // Label
        g.fillStyle(0xFFFFFF, 0.95);
        g.fillRect(x - w * 0.22, y + h * 0.44, w * 0.44, h * 0.32);
        g.fillStyle(0xCC4400, 1);
        g.fillRect(x - w * 0.16, y + h * 0.50, w * 0.32, h * 0.07);
        g.fillRect(x - w * 0.12, y + h * 0.62, w * 0.24, h * 0.05);
        // Highlight
        g.fillStyle(0xFFDD88, 0.38);
        g.fillRect(x - w * 0.08, y + h * 0.35, w * 0.1, h * 0.55);
        break;
      }
      case 'burrito': {
        // Shadow
        g.fillStyle(0x000000, 0.18);
        g.fillEllipse(x + w * 0.1, y + h, w * 0.7, h * 0.1);
        // Stem
        g.fillStyle(0x5B8C2A, 1);
        g.fillRect(x - w * 0.05, y + h * 0.55, w * 0.1, h * 0.45);
        // Leaf clusters
        g.fillStyle(0x33AA22, 1);
        g.fillCircle(x, y + h * 0.42, w * 0.36);
        g.fillStyle(0x28882A, 1);
        g.fillCircle(x - w * 0.28, y + h * 0.30, w * 0.27);
        g.fillCircle(x + w * 0.28, y + h * 0.30, w * 0.27);
        g.fillStyle(0x44CC33, 1);
        g.fillCircle(x, y + h * 0.22, w * 0.22);
        // Highlights
        g.fillStyle(0x88FF66, 0.22);
        g.fillCircle(x - w * 0.1, y + h * 0.35, w * 0.15);
        break;
      }
      case 'energy': {
        // Dark surface
        g.fillStyle(0x111122, 1);
        g.fillRect(x - w * 0.44, y + h * 0.3, w * 0.88, h * 0.45);
        // White powder lines
        g.fillStyle(0xFFFFFF, 1);
        g.fillRect(x - w * 0.38, y + h * 0.4, w * 0.76, h * 0.1);
        g.fillRect(x - w * 0.32, y + h * 0.55, w * 0.64, h * 0.09);
        // Shimmer
        g.fillStyle(0xDDDDFF, 0.6);
        g.fillRect(x - w * 0.38, y + h * 0.08, w * 0.76, h * 0.12);
        // Card/mirror reflection
        g.fillStyle(0x8888CC, 0.35);
        g.fillRect(x - w * 0.44, y + h * 0.3, w * 0.88, h * 0.05);
        break;
      }
      case 'hitchhiker': {
        // Shadow
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(x + w * 0.1, y + h, w * 0.55, h * 0.08);
        // Legs
        g.fillStyle(0x334488, 1); // jeans
        g.fillRect(x - w * 0.14, y + h * 0.62, w * 0.12, h * 0.38);
        g.fillRect(x + w * 0.02, y + h * 0.62, w * 0.12, h * 0.38);
        // Body / shirt
        g.fillStyle(0xDD4422, 1);
        g.fillRect(x - w * 0.18, y + h * 0.30, w * 0.36, h * 0.35);
        // Body shading
        g.fillStyle(0xAA2211, 0.5);
        g.fillRect(x + w * 0.02, y + h * 0.30, w * 0.16, h * 0.35);
        // Arms — one raised (thumb out)
        g.fillStyle(0xDD9966, 1); // skin
        g.fillRect(x - w * 0.36, y + h * 0.32, w * 0.18, h * 0.08); // left arm down
        g.fillRect(x + w * 0.18, y + h * 0.18, w * 0.08, h * 0.18); // right arm up
        // Thumb
        g.fillRect(x + w * 0.26, y + h * 0.18, w * 0.1, h * 0.06);
        // Head
        g.fillStyle(0xDD9966, 1);
        g.fillCircle(x, y + h * 0.16, w * 0.2);
        // Hair
        g.fillStyle(0x442211, 1);
        g.fillRect(x - w * 0.2, y + h * 0.04, w * 0.4, h * 0.1);
        break;
      }
      case 'f12_coal': {
        // Chrome exhaust stack belching a clump of black smoke — reads
        // "rolling coal" at road distance.
        g.fillStyle(0x999999, 1);                                       // stack pipe
        g.fillRect(x - w * 0.08, y + h * 0.35, w * 0.16, h * 0.6);
        g.fillStyle(0xCCCCCC, 1);                                       // chrome lip
        g.fillRect(x - w * 0.12, y + h * 0.32, w * 0.24, h * 0.08);
        g.fillStyle(0x1A1A1A, 1);                                       // smoke mass
        g.fillCircle(x,            y + h * 0.20, w * 0.22);
        g.fillCircle(x - w * 0.24, y + h * 0.14, w * 0.16);
        g.fillCircle(x + w * 0.24, y + h * 0.12, w * 0.17);
        g.fillStyle(0x333333, 0.9);                                     // lighter fringe
        g.fillCircle(x - w * 0.38, y + h * 0.04, w * 0.11);
        g.fillCircle(x + w * 0.40, y + h * 0.02, w * 0.12);
        g.fillCircle(x,            y - h * 0.02, w * 0.13);
        break;
      }
      case 'f12_fireworks': {
        // Bundle of bottle rockets — three leaning tubes on sticks with
        // star sparks above, so the pickup reads "fireworks" at a glance.
        const tubes = [
          { dx: -0.22, c: 0xE03A3A },   // red
          { dx:  0.00, c: 0xFFD24D },   // gold
          { dx:  0.22, c: 0x2EE6D6 },   // teal
        ];
        for (const tb of tubes) {
          const tx = x + w * tb.dx;
          g.fillStyle(0xC8A26A, 1);                                    // stick
          g.fillRect(tx - w * 0.02, y + h * 0.45, w * 0.04, h * 0.55);
          g.fillStyle(tb.c, 1);                                        // rocket body
          g.fillRect(tx - w * 0.07, y + h * 0.28, w * 0.14, h * 0.30);
          g.fillTriangle(tx, y + h * 0.12, tx - w * 0.09, y + h * 0.30, tx + w * 0.09, y + h * 0.30);
        }
        // Star sparks above the bundle
        g.fillStyle(0xFFF6C8, 0.9);
        g.fillCircle(x - w * 0.28, y + h * 0.06, w * 0.05);
        g.fillCircle(x + w * 0.30, y + h * 0.02, w * 0.05);
        g.fillCircle(x + w * 0.04, y - h * 0.04, w * 0.06);
        break;
      }
      case 'f12_paint': {
        g.fillStyle(0xFFEE00, 1);
        g.fillCircle(x, y + h * 0.55, w * 0.42);
        g.fillStyle(0xFF9900, 0.8);
        g.fillCircle(x + w * 0.28, y + h * 0.3, w * 0.22);
        g.fillCircle(x - w * 0.3,  y + h * 0.72, w * 0.18);
        g.fillStyle(0xFFCC00, 0.9);
        g.fillCircle(x - w * 0.22, y + h * 0.35, w * 0.16);
        break;
      }
      case 'f12_emp': {
        g.fillStyle(0x2244FF, 1);
        g.fillCircle(x, y + h * 0.5, w * 0.45);
        g.fillStyle(0xFFFFFF, 0.9);
        // Lightning bolt
        g.fillTriangle(x + w * 0.1, y + h * 0.1, x - w * 0.12, y + h * 0.52, x + w * 0.06, y + h * 0.52);
        g.fillTriangle(x - w * 0.06, y + h * 0.48, x + w * 0.12, y + h * 0.9, x - w * 0.1, y + h * 0.9);
        break;
      }
      case 'f12_disguise': {
        g.fillStyle(0xFFCC00, 1);
        g.fillCircle(x, y + h * 0.45, w * 0.42);
        g.fillStyle(0x000000, 1);
        g.fillEllipse(x - w * 0.14, y + h * 0.38, w * 0.14, h * 0.1);
        g.fillEllipse(x + w * 0.14, y + h * 0.38, w * 0.14, h * 0.1);
        g.fillStyle(0xCC3300, 1);
        g.fillEllipse(x, y + h * 0.58, w * 0.28, h * 0.1);
        break;
      }
      case 'house': {
        const wall      = sp?.wallColor || 0xC8B89A;
        const roof      = sp?.roofColor || 0x4A2E2A;
        const wallDark  = lerpColor(wall, 0x000000, 0.30);
        const wallLight = lerpColor(wall, 0xFFFFFF, 0.20);
        const roofDark  = lerpColor(roof, 0x000000, 0.35);
        const twoStory  = !!sp?.twoStory;
        const hasGarage = !!sp?.hasGarage;
        const hasChimney= !!sp?.hasChimney;
        const hasDormer = !!sp?.hasDormer;
        const flatRoof  = !!sp?.flatRoof;
        // Two-story homes have a taller body (smaller roof relative to body).
        const bodyTopY = y + h * (twoStory ? 0.20 : 0.32);
        const bodyH    = h * (twoStory ? 0.80 : 0.68);
        // Garage on the right side narrows the main body; otherwise full width.
        const bodyL    = -0.45;
        const bodyR    = hasGarage ?  0.18 :  0.45;
        const bodyW    = (bodyR - bodyL) * w;
        const bodyX    = x + bodyL * w;

        // Body rectangle (wall color).
        g.fillStyle(wall, 1);
        g.fillRect(bodyX, bodyTopY, bodyW, bodyH);
        // Side shadow on the right edge of the body
        g.fillStyle(wallDark, 1);
        g.fillRect(x + (bodyR - 0.07) * w, bodyTopY, w * 0.07, bodyH);
        // Top trim where wall meets roof
        g.fillStyle(wallLight, 1);
        g.fillRect(bodyX, bodyTopY, bodyW, h * 0.03);

        const ridgeY = bodyTopY - h * (twoStory ? 0.18 : 0.30);
        if (flatRoof) {
          // Modern / contemporary — flat parapet roof.  Just a short
          // band of roof color sitting on top of the body, plus a thin
          // dark line as the parapet edge.  No gable triangle.
          const flatTop = bodyTopY - h * 0.06;
          g.fillStyle(roof, 1);
          g.fillRect(bodyX - w * 0.02, flatTop, bodyW + w * 0.04, h * 0.06);
          g.fillStyle(roofDark, 1);
          g.fillRect(bodyX - w * 0.02, flatTop, bodyW + w * 0.04, Math.max(1, h * 0.014));
        } else {
          // Gable roof — triangle on top of the body.  Bottom edge
          // slightly wider than the body for an eaves overhang.
          g.fillStyle(roof, 1);
          g.fillTriangle(
            bodyX - w * 0.05,           bodyTopY,
            x + bodyR * w + w * 0.05,   bodyTopY,
            x + (bodyL + bodyR) / 2 * w, ridgeY
          );
          // Roof shadow side
          g.fillStyle(roofDark, 1);
          g.fillTriangle(
            x + (bodyL + bodyR) / 2 * w, ridgeY,
            x + bodyR * w + w * 0.05,    bodyTopY,
            x + bodyR * w - w * 0.10,    bodyTopY
          );
        }

        // Garage box + door (right side of house, single-story).
        if (hasGarage) {
          const garL = x + 0.20 * w;
          const garW = w * 0.28;
          const garTop = bodyTopY + h * 0.20;
          const garH = bodyTopY + bodyH - garTop;
          g.fillStyle(wall, 1);
          g.fillRect(garL, garTop, garW, garH);
          g.fillStyle(wallDark, 1);
          g.fillRect(garL + garW - w * 0.04, garTop, w * 0.04, garH);
          // Garage roof — gable on a gabled house, flat band on a
          // flat-roofed house so the garage matches the main roofline.
          if (flatRoof) {
            g.fillStyle(roof, 1);
            g.fillRect(garL - w * 0.02, garTop - h * 0.04, garW + w * 0.04, h * 0.04);
          } else {
            g.fillStyle(roof, 1);
            g.fillTriangle(
              garL - w * 0.02,        garTop,
              garL + garW + w * 0.02, garTop,
              garL + garW / 2,        garTop - h * 0.10
            );
          }
          // Garage door (lighter rectangle with horizontal lines)
          g.fillStyle(0xAAA39C, 1);
          g.fillRect(garL + w * 0.02, garTop + h * 0.06, garW - w * 0.04, garH - h * 0.10);
          g.fillStyle(wallDark, 0.6);
          for (let lineY = garTop + h * 0.10; lineY < garTop + garH - h * 0.06; lineY += h * 0.04) {
            g.fillRect(garL + w * 0.02, lineY, garW - w * 0.04, Math.max(1, h * 0.005));
          }
        }

        // Chimney — short brick stack.  Skipped on flat-roof homes
        // (modern houses don't have chimneys).
        if (hasChimney && !flatRoof) {
          const chX = x + (bodyL + 0.10) * w;
          const chW = w * 0.06;
          const chTop = ridgeY + h * 0.04;
          const chH = h * 0.14;
          g.fillStyle(0x6B4030, 1);
          g.fillRect(chX, chTop, chW, chH);
          g.fillStyle(0x4A2E22, 1);
          g.fillRect(chX, chTop, chW, h * 0.018);
        }

        // Dormer — small gable poking out of the main roof.  Skipped on
        // flat-roof homes (no roof to dormer).
        if (hasDormer && !flatRoof) {
          const dmX = x + (bodyL + bodyR) / 2 * w;
          const dmW = w * 0.18;
          const dmTop = bodyTopY - h * 0.10;
          g.fillStyle(wall, 1);
          g.fillRect(dmX - dmW / 2, dmTop, dmW, h * 0.10);
          g.fillStyle(roof, 1);
          g.fillTriangle(
            dmX - dmW / 2 - w * 0.01, dmTop,
            dmX + dmW / 2 + w * 0.01, dmTop,
            dmX,                      dmTop - h * 0.06
          );
          // Dormer window
          g.fillStyle(0x88AACC, 0.95);
          g.fillRect(dmX - dmW * 0.30, dmTop + h * 0.025, dmW * 0.60, h * 0.05);
        }

        // Door (centered on body, full-height-ish)
        const doorY = bodyTopY + bodyH * 0.45;
        const doorX = bodyX + bodyW * 0.45;
        g.fillStyle(0x3A2A1A, 1);
        g.fillRect(doorX, doorY, w * 0.10, bodyH * 0.50);
        g.fillStyle(0xCCAA22, 1);
        g.fillRect(doorX + w * 0.075, doorY + bodyH * 0.20, w * 0.018, h * 0.025);

        // Two windows flanking the door (on the body, not the garage)
        const winY = bodyTopY + bodyH * 0.20;
        const winH = bodyH * 0.22;
        for (const wxOff of [-0.18, 0.05]) {
          const wx = bodyX + bodyW * 0.50 + wxOff * w;
          g.fillStyle(wallDark, 1);
          g.fillRect(wx - w * 0.005, winY, w * 0.13, winH);
          g.fillStyle(0x88AACC, 0.95);
          g.fillRect(wx, winY + h * 0.005, w * 0.12, winH - h * 0.01);
          g.fillStyle(wallDark, 0.9);
          g.fillRect(wx + w * 0.058, winY + h * 0.005, w * 0.005, winH - h * 0.01);
          g.fillRect(wx, winY + winH * 0.5, w * 0.12, Math.max(1, h * 0.004));
        }

        // Second-story windows for two-story homes.
        if (twoStory) {
          const winY2 = bodyTopY + bodyH * 0.04;
          const winH2 = bodyH * 0.16;
          for (const wxOff of [-0.18, 0.05]) {
            const wx = bodyX + bodyW * 0.50 + wxOff * w;
            g.fillStyle(wallDark, 1);
            g.fillRect(wx - w * 0.005, winY2, w * 0.13, winH2);
            g.fillStyle(0x88AACC, 0.95);
            g.fillRect(wx, winY2 + h * 0.004, w * 0.12, winH2 - h * 0.008);
          }
        }
        break;
      }
      case 'building': {
        const floors    = sp?.floors || 3;
        const wall      = sp?.wallColor || 0xCC8844;
        const wallDark  = lerpColor(wall, 0x000000, 0.38);
        const wallLight = lerpColor(wall, 0xFFFFFF, 0.22);

        // Main facade
        g.fillStyle(wall, 1);
        g.fillRect(x - w * 0.5, y, w * 0.78, h);

        // Shadow side (right face — angled away)
        g.fillStyle(wallDark, 1);
        g.fillRect(x + w * 0.28, y, w * 0.22, h);

        // Top highlight strip
        g.fillStyle(wallLight, 1);
        g.fillRect(x - w * 0.5, y, w * 0.78, h * 0.04);

        // Bottom shadow strip
        g.fillStyle(wallDark, 0.6);
        g.fillRect(x - w * 0.5, y + h * 0.94, w * 0.78, h * 0.06);

        // Window grid
        const winRows = Math.max(2, floors);
        const winCols = 3;
        for (let r = 0; r < winRows; r++) {
          for (let c = 0; c < winCols; c++) {
            const wx = x - w * 0.38 + c * (w * 0.25);
            const wy = y + h * 0.10 + r * (h * 0.72 / winRows);
            const ww = w * 0.14;
            const wh = h * 0.60 / winRows;
            // Window frame
            g.fillStyle(wallDark, 1);
            g.fillRect(wx - w * 0.01, wy - h * 0.01, ww + w * 0.02, wh + h * 0.02);
            // Window glass — lit yellow/blue at random (seeded by position)
            const lit = ((r * 7 + c * 13 + floors) % 3) !== 0;
            g.fillStyle(lit ? 0xFFEEAA : 0x4488CC, 0.85);
            g.fillRect(wx, wy, ww, wh);
            // Window reflection
            g.fillStyle(0xFFFFFF, 0.18);
            g.fillRect(wx, wy, ww * 0.4, wh * 0.45);
          }
        }

        // Ground-floor awning / sign strip
        g.fillStyle(lerpColor(wall, 0x000000, 0.25), 1);
        g.fillRect(x - w * 0.5, y + h * 0.84, w * 0.78, h * 0.09);
        // Awning highlight
        g.fillStyle(wallLight, 0.5);
        g.fillRect(x - w * 0.5, y + h * 0.84, w * 0.78, h * 0.02);
        break;
      }
      case 'cop_roadblock': {
        // Large bright police barricade — unmissable
        // Orange/white road barrier strips
        g.fillStyle(0xFF6600, 1);
        g.fillRect(x - w * 0.55, y + h * 0.55, w * 1.1, h * 0.18);
        g.fillStyle(0xFFFFFF, 1);
        g.fillRect(x - w * 0.55, y + h * 0.73, w * 1.1, h * 0.12);
        g.fillStyle(0xFF6600, 1);
        g.fillRect(x - w * 0.55, y + h * 0.85, w * 1.1, h * 0.10);

        // Police car body (strong blue)
        g.fillStyle(0x1133CC, 1);
        g.fillRect(x - w * 0.42, y + h * 0.22, w * 0.84, h * 0.38);
        // Roof
        g.fillStyle(0x0A1A88, 1);
        g.fillRect(x - w * 0.28, y + h * 0.06, w * 0.56, h * 0.20);
        // Windshield
        g.fillStyle(0x88AAFF, 0.9);
        g.fillRect(x - w * 0.24, y + h * 0.08, w * 0.48, h * 0.15);

        // Flashing light bar — always-on vivid red+blue
        g.fillStyle(0xFF1111, 1);
        g.fillRect(x - w * 0.28, y, w * 0.26, h * 0.10);
        g.fillStyle(0x1144FF, 1);
        g.fillRect(x + w * 0.02, y, w * 0.26, h * 0.10);

        // POLICE text bar
        g.fillStyle(0xFFFFFF, 1);
        g.fillRect(x - w * 0.38, y + h * 0.28, w * 0.76, h * 0.06);

        // Wheels
        g.fillStyle(0x111111, 1);
        g.fillEllipse(x - w * 0.28, y + h * 0.58, w * 0.24, h * 0.14);
        g.fillEllipse(x + w * 0.28, y + h * 0.58, w * 0.24, h * 0.14);
        break;
      }
      case 'cop_light': {
        // Red/blue flashing — caller handles timing
        g.fillStyle(0x2244CC, 1);
        g.fillRect(x - w * 0.5, y, w, h * 0.5);
        g.fillStyle(0xCC2222, 1);
        g.fillRect(x - w * 0.5, y + h * 0.5, w, h * 0.5);
        break;
      }
      default:
        break;
    }
  }

  /** Draw on-road vehicles (traffic + cops) scaled by depth */
  /** Curve-aware projection for vehicles. Given a relative Z (units ahead
   *  of the player), return the segment's accumulated screenX/screenY/screenW
   *  so a vehicle at lateral lane-offset `laneOffset` stays glued to its lane
   *  through curves AND through the player's own lateral steering.
   *
   *  IMPORTANT: drawn[].screenX is already computed relative to the player's
   *  camera (Road.render() passes `cameraX = playerX * ROAD_WIDTH` into
   *  project()), so we MUST NOT subtract playerLatX again here. Doing so
   *  double-counted player lateral and made cars appear to "follow" the
   *  player's steering by 2× what they should. */

  /**
   *  Canonical road-surface query — every system that needs to know
   *  "where is the drivable pavement on screen at this depth?" should
   *  go through this one function.  Player car, NPC cars, vice pickups,
   *  cops, shadows, signage — all consume sampleSurface() so the road
   *  owns its own surface position and nothing else has to invent one.
   *
   *    relativeZ:  distance ahead of the camera, world units.
   *    laneOffset: ±0.5 normalized lane position (left/right of centre).
   *    opts.allowClipped (default false):
   *      when false, segments hidden by crest-clipping return null so
   *      NPC sprites get culled instead of floating over grass/sky.
   *      When true, the projection is returned regardless of visibility
   *      — used by the PLAYER car so it never loses road contact.
   *
   *  Returns { sx, sy, sw, scale, visible } or null.  Float coords —
   *  no integer rounding, so road geometry stays sub-pixel for clean AA.
   */
  sampleSurface(relativeZ, laneOffset, opts) {
    const allowClipped = opts && opts.allowClipped === true;
    const samples = this._surfaceSamples;
    if (samples) {
      // Boundary n is projected at camera-space depth n*SEG - cameraZ.
      // Convert requested camera-relative Z into the matching fractional
      // boundary index.  Ignoring cameraZ here made cars and shadows sample
      // the wrong surface for most of each segment, then snap at boundaries.
      const fIdx = (relativeZ + (this._cameraZ ?? 0)) / SEG_LENGTH;
      const idxA = Math.max(0, Math.min(DRAW_DIST, Math.floor(fIdx)));
      const idxB = Math.max(0, Math.min(DRAW_DIST, idxA + 1));
      const t    = Math.max(0, Math.min(1, fIdx - idxA));
      const a = samples[idxA];
      const b = samples[idxB];
      if (a && a.valid) {
        const useB = b && b.valid;
        const visible = (a.visible !== false) && (!useB || b.visible !== false);
        if (!visible && !allowClipped) return null;
        const bw = useB ? b.screenW : a.screenW;
        const bx = useB ? b.screenX : a.screenX;
        const by = useB ? b.screenY : a.screenY;
        const bs = useB ? b.scale   : a.scale;
        const screenW = a.screenW + (bw - a.screenW) * t;
        const sx = a.screenX + (bx - a.screenX) * t + screenW * laneOffset;
        const sy = a.screenY + (by - a.screenY) * t;
        const scale = a.scale + (bs - a.scale) * t;
        const sw = scale * 825 * SCREEN_W / 2;
        return { sx, sy, sw, scale, visible, roadHalfW: screenW };
      }
    }
    // First-frame fallback (samples not yet populated).
    const scale = CAM.depth / Math.max(1, relativeZ);
    return {
      sx: SCREEN_W / 2 + scale * laneOffset * ROAD_WIDTH * SCREEN_W / 2,
      sy: H() + scale * 1000 * SCREEN_H / 2,
      sw: scale * 825 * SCREEN_W / 2,
      roadHalfW: scale * ROAD_WIDTH * SCREEN_W / 2,
      scale,
      visible: true,
    };
  }

  /** Back-compat NPC projection — same shape as before (sx/sy/sw, no
   *  visible/scale).  Returns null on clipped segments so callers that
   *  currently `if (!proj) return` cull cleanly. */
  /** Far shore across a horizontal span: a soft shore band with a rolling
   *  treeline silhouette on top, sitting just under the horizon.
   *
   *  Extracted from the floating-bridge render so ONE-SIDED water can use
   *  it too.  Without a far shore a lake paints as a flat field running to
   *  the screen edge, which is correct for open water like Elliott Bay but
   *  makes Sammamish or Keechelus read as ocean — and makes anything drawn
   *  behind them look like it is rising out of the sea.
   *
   *  Painted once per frame at the horizon, NOT per segment: the far shore
   *  sits at a fixed world distance, so it belongs to the horizon band
   *  rather than to any one segment's projection. */
  _paintFarShore(g, xFrom, xTo, alpha = 1) {
    if (alpha <= 0.01 || xTo <= xFrom) return;
    const shoreY = H() - 2;
    // Soft shore band — slightly lighter than the water, so the treeline
    // has something to fade into rather than meeting water at a hard edge.
    g.fillStyle(0x5A6458, 0.55 * alpha);
    g.fillRect(xFrom, shoreY, xTo - xFrom, 3);

    // Treeline silhouette.  Originally stepped every 5 px at 4-14 px tall,
    // which was fine on the floating-bridge crossing it was written for —
    // seen small, far away, across open water.  Reused at lake scale on a
    // wide display it became ~500 hard-edged rectangles in a row and read
    // as a pixelated blocky slab across the horizon.
    //
    // Now: 3 px steps, a shorter 2-8 px profile, and a fourth
    // higher-frequency term so the crowns break up into something
    // tree-shaped instead of rolling mounds.  Colour is a desaturated
    // blue-green at low alpha rather than near-black, so it reads as
    // several miles away instead of sitting on top of the water.
    const treeStep = 3;
    g.fillStyle(0x3B4A42, 0.72 * alpha);
    for (let x = xFrom; x < xTo; x += treeStep) {
      const n = Math.sin(x * 0.041) + Math.sin(x * 0.097 + 1.1) * 0.55
              + Math.sin(x * 0.187 + 2.3) * 0.32
              + Math.sin(x * 0.409 + 0.7) * 0.22;
      const treeH = 2 + Math.max(0, n + 1.4) * 2.2;     // 2-8 px tall
      g.fillRect(x, shoreY - treeH + 2, Math.min(treeStep + 1, xTo - x), treeH);
    }
  }

  getVehicleProjection(relativeZ, laneOffset /* playerLatX not needed */) {
    const s = this.sampleSurface(relativeZ, laneOffset);
    if (!s) return null;
    return { sx: s.sx, sy: s.sy, sw: s.sw };
  }

  /** Screen-Y of the nearest hill-crest silhouette in FRONT of `relativeZ`
   *  — the highest painted ground (min screenY) among visible surface
   *  samples strictly nearer than this depth.  A scenery structure at this
   *  depth is hidden by that hill for everything BELOW this Y, so the
   *  renderer clips the sprite's lower portion to it instead of letting it
   *  float over the gap a crest-cull leaves (see _renderSceneSprites).
   *  Returns Infinity when nothing nearer is visible (no occluder, no clip). */
  crestClipY(relativeZ) {
    const arr = this._crestMinY;
    if (!arr) return Infinity;
    const fIdx = (relativeZ + (this._cameraZ ?? 0)) / SEG_LENGTH;
    const idx  = Math.max(0, Math.min(DRAW_DIST, Math.floor(fIdx)));
    return arr[idx];
  }

  renderVehicle(g, screenX, screenY, screenW, scale, isCop, color, flash) {
    const vw = toInt(screenW * 0.72);
    const vh = toInt(vw * 0.52);
    const vx = screenX - vw / 2;
    const vy = screenY - vh;

    if (vy + vh < 0 || vy > SCREEN_H || vw < 4) return;

    // Ground shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(screenX, screenY + 1, vw * 0.9, vh * 0.18);

    // Body — slightly lighter shade on top for shading
    const bodyLight = lerpColor(color, 0xFFFFFF, 0.15);
    const bodyShadow = lerpColor(color, 0x000000, 0.2);
    g.fillStyle(color, 1);
    g.fillRect(vx, vy + vh * 0.28, vw, vh * 0.52);
    // Top of body slightly lighter
    g.fillStyle(bodyLight, 1);
    g.fillRect(vx, vy + vh * 0.28, vw, vh * 0.14);
    // Side shadow
    g.fillStyle(bodyShadow, 0.45);
    g.fillRect(vx + vw * 0.72, vy + vh * 0.28, vw * 0.28, vh * 0.52);

    // Roof
    g.fillStyle(isCop ? 0x1A1A1A : lerpColor(color, 0x000000, 0.4), 1);
    g.fillRect(vx + vw * 0.14, vy + vh * 0.04, vw * 0.72, vh * 0.28);

    // Windshield
    g.fillStyle(0x99CCFF, 0.8);
    g.fillRect(vx + vw * 0.17, vy + vh * 0.06, vw * 0.66, vh * 0.2);
    // Windshield reflection
    g.fillStyle(0xFFFFFF, 0.25);
    g.fillRect(vx + vw * 0.17, vy + vh * 0.06, vw * 0.2, vh * 0.2);

    // Rear window
    g.fillStyle(0x6699BB, 0.7);
    g.fillRect(vx + vw * 0.20, vy + vh * 0.08, vw * 0.28, vh * 0.16);

    // Wheels + wheel arch
    g.fillStyle(0x1A1A1A, 1);
    g.fillEllipse(vx + vw * 0.2,  vy + vh * 0.78, vw * 0.26, vh * 0.28);
    g.fillEllipse(vx + vw * 0.8,  vy + vh * 0.78, vw * 0.26, vh * 0.28);
    // Hubcaps
    g.fillStyle(0xCCCCCC, 1);
    g.fillCircle(vx + vw * 0.2,  vy + vh * 0.78, vw * 0.07);
    g.fillCircle(vx + vw * 0.8,  vy + vh * 0.78, vw * 0.07);

    // Headlights
    g.fillStyle(0xFFFFCC, 0.9);
    g.fillRect(vx + vw * 0.06, vy + vh * 0.54, vw * 0.14, vh * 0.12);
    g.fillRect(vx + vw * 0.80, vy + vh * 0.54, vw * 0.14, vh * 0.12);
    // Headlight glow
    g.fillStyle(0xFFFFAA, 0.3);
    g.fillRect(vx + vw * 0.04, vy + vh * 0.52, vw * 0.18, vh * 0.16);

    if (isCop) {
      // Light bar housing
      g.fillStyle(0x333333, 1);
      g.fillRect(vx + vw * 0.18, vy, vw * 0.64, vh * 0.09);
      // Flashing lights
      g.fillStyle(flash ? 0xFF3333 : 0x440000, 1);
      g.fillRect(vx + vw * 0.19, vy + vh * 0.01, vw * 0.28, vh * 0.07);
      g.fillStyle(flash ? 0x2255FF : 0x000044, 1);
      g.fillRect(vx + vw * 0.53, vy + vh * 0.01, vw * 0.28, vh * 0.07);
    }
  }

  /** Absolute screen Y at road surface for a given depth index */
  roadScreenYAtDepth(n) {
    if (n <= 0) return H();
    const scale = CAM.depth / (n * SEG_LENGTH);
    // First H() is horizon Y; SCREEN_H/2 is the elevation→pixel
    // scaling factor (NOT horizon — stays fixed at half canvas).
    return toInt(H() - scale * CAM.height * (SCREEN_H / 2));
  }
}
