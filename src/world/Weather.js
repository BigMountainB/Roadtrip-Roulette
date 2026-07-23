// Weather — pure-function weather state keyed off route mileage.  Only
// runs on Normal+ difficulty (Easy short-circuits to 'clear').
//
//   clear     — default everywhere outside the weather windows
//   fog       — mile 14–25 (Issaquah valley / Eastside basin)
//   rain      — mile 30–40 (North Bend approach into the foothills)
//   snow      — mile 40–88 (Cascades / Snoqualmie Pass through Cle Elum)
//
// Each helper takes the player's mileage and returns a 0..1 intensity
// (eased at the edges so weather fades in / out cleanly), or pure flags.
//
// Traction / traffic / road-render overrides are applied by callers based
// on the state + intensity returned here.

import { Difficulty } from '../systems/Difficulty.js';

export const Weather = {
  // Timed fog-lift multiplier (0..1), driven by GameScene.  Holds at 1
  // while the player is in the Issaquah basin, then ramps to 0 over 5 s of
  // real time once they cross mile 23.6 — applied only to the FOG branch of
  // intensity() so the Preston cluster's pop-in is masked by lifting fog
  // instead of appearing in clear air.  Pure-function elsewhere; this one
  // mutable hook is deliberate (time-based, not mile-based).
  _fogLiftMul: 1,

  state(mile) {
    if (!Difficulty.weather()) return 'clear';
    if (mile >= 14 && mile < 25) return 'fog';
    if (mile >= 30 && mile < 40) return 'rain';
    if (mile >= 40 && mile < 88) return 'snow';
    return 'clear';
  },

  /** 0..1 intensity envelope.  Rain eases IN over the first 2 mi (30-32)
   *  then holds full RIGHT UP TO the snow handoff at mile 40 — it does NOT
   *  fade out beforehand.  Snow holds full FROM mile 40 (no fade-in) and
   *  eases out over the last 2 mi (86-88).  The shared full-intensity
   *  boundary at mile 40 means rain hands directly off to snow with no
   *  clear-weather gap in between (per user spec — it should never "clear
   *  up" between the storms). */
  intensity(mile) {
    if (!Difficulty.weather()) return 0;
    if (mile >= 14 && mile < 25) {
      // Issaquah valley fog: rolls in over 14-17, then sits THICK all the
      // way to mile 23.6 (was: lifted over 22-25).  The lift-out is now
      // TIME-based (Weather._fogLiftMul, ramped 1→0 over 5 s by GameScene
      // once the player crosses 23.6), so it masks the Preston pop-in.
      const f = (mile < 17) ? (mile - 14) / 3 : 1;   // ease in over 3 mi, else full
      return f * (this._fogLiftMul ?? 1) * this.fogPatch(mile);
    }
    if (mile >= 30 && mile < 40) {
      if (mile < 32) return (mile - 30) / 2;   // ease in over the first 2 mi
      return 1;                                 // hold full to the snow handoff
    }
    if (mile >= 40 && mile < 88) {
      if (mile > 86) return (88 - mile) / 2;    // ease out over the last 2 mi
      return 1;                                 // full from the rain handoff — no gap
    }
    return 0;
  },

  /** Grip multiplier on player steering / lateral physics.  1.0 = normal,
   *  rain trims 35%, snow chops 25% (per user spec). */
  gripMul(mile) {
    const s = this.state(mile);
    const i = this.intensity(mile);
    if (s === 'rain') return 1 - 0.35 * i;
    if (s === 'snow') return 1 - 0.25 * i;
    return 1;
  },

  /** Progressive severity multiplier: 1.0 at the start of the weather
   *  window, 2.4 at the end (140 % worse than start, per user spec).
   *  Linear ramp across the full window — combined with intensity()
   *  gives a storm that builds toward a peak.  Returns 1.0 outside any
   *  weather window so callers can safely multiply unconditionally. */
  severity(mile) {
    if (!Difficulty.weather()) return 1;
    // Rain ramps, then WALLS at mid-North Bend (2026-07-16 owner spec: "gets
    // worse halfway through North Bend — almost impossible to see without
    // wipers"): 1.0 → 2.0 approaching mile 32, then a DOUBLE-strength storm
    // (up to 4.8) from 32 to the snow handoff.  The windshield-drop load and
    // streak density scale straight off this; callers clamp what they must.
    if (mile >= 24 && mile < 32) return 1 + 1.0 * ((mile - 24) / 8);
    if (mile >= 32 && mile < 40) return 2.0 + 2.8 * Math.min(1, (mile - 32) / 4);
    if (mile >= 40 && mile < 88) return 1 + 1.4 * ((mile - 40) / 48);
    return 1;
  },

  /** NPC traffic spawn-cap multiplier.  Snow zones drop the cap by 30%
   *  (per user spec) on Normal AND Hard — Hard's +10% baseline still
   *  applies before this kicks in. */
  trafficMul(mile) {
    return this.state(mile) === 'snow' ? 0.70 : 1;
  },

  /** Intermittent-fog multiplier (0..1) applied to fog intensity so the bank
   *  rolls in and out along the road instead of sitting thick the whole zone.
   *  Smooth value-noise keyed on MILE (deterministic → no per-frame flicker,
   *  banks ~0.45 mi long), mapped to roughly: 70% full (1.0), 15% partial
   *  (~0.5), 15% clear (0).  Per user 2026-07-05. */
  fogPatch(mile) {
    const cell = mile / 0.45;                     // ~0.45-mi fog cells
    const i    = Math.floor(cell);
    const fr   = cell - i;
    const hash = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const a = hash(i), b = hash(i + 1);
    const u = fr * fr * (3 - 2 * fr);             // smoothstep interpolation
    const n = a + (b - a) * u;                    // smooth noise in [0,1)
    const t  = 0.04;
    const c01 = (x) => Math.max(0, Math.min(1, x));
    const ss  = (lo, hi, x) => { const v = c01((x - lo) / (hi - lo)); return v * v * (3 - 2 * v); };
    // n<0.15 → clear; 0.15–0.30 → partial; >0.30 → full (short smooth ramps).
    const partial = ss(0.15 - t, 0.15 + t, n);
    const full    = ss(0.30 - t, 0.30 + t, n);
    return 0.5 * partial + 0.5 * full;
  },

  isRain(mile) { return this.state(mile) === 'rain'; },
  isSnow(mile) { return this.state(mile) === 'snow'; },
  isFog(mile)  { return this.state(mile) === 'fog';  },

  /** Layered depth-fog parameters for the visibility system.  Derived from
   *  the fog-zone density (0..1).  Distances are in WORLD units (relZ): an
   *  object nearer than `nearClearDistance` stays clear; past that it fades
   *  exponentially toward the (time-of-day-tinted) fog backdrop, fully
   *  dissolving by `visibilityDistance`.  contrast/saturation/bloom are
   *  consumed by later light passes.  density 0 → everything clear. */
  /** Fog-lights clarity factor (owner 2026-07-22): the FOG LIGHTS upgrade
   *  thins every fog VISUAL to this fraction (0.5 = "50% more transparent",
   *  per the owner's spec).  Applied here in fogParams (all sprite-fade
   *  consumers) and read directly by the two intensity-driven fog visuals
   *  (EffectsSystem screen haze + Road.js distance fog).  VISUAL ONLY —
   *  Weather.intensity itself is untouched, so fog's grip physics and
   *  rain/snow severity are unaffected. */
  _fogClarityMul: 1,
  setFogClarity(m) {
    this._fogClarityMul = Math.max(0.1, Math.min(1, Number(m) || 1));
  },

  fogParams(mile) {
    const d = Math.max(0, Math.min(1, this.isFog(mile) ? this.intensity(mile) : 0))
            * (this._fogClarityMul ?? 1);
    const L = (a, b) => a + (b - a) * d;
    return {
      density:            d,
      visibilityDistance: L(90000, 9000),   // where objects fully vanish into fog
      nearClearDistance:  L(12000, 2500),   // within this, objects stay clear
      contrastMul:        L(1.0, 0.45),
      saturationMul:      L(1.0, 0.55),
      lightBloom:         L(0.0, 0.8),
    };
  },

  /** Alpha multiplier (1 = clear, 0 = vanished) for an object at world
   *  distance `relZ`, given fogParams `fp`.  Exponential falloff between
   *  nearClearDistance and visibilityDistance so near stays crisp, mid
   *  loses presence, far dissolves into the haze. */
  fogFade(relZ, fp) {
    if (!fp || fp.density <= 0) return 1;
    const span = Math.max(1, fp.visibilityDistance - fp.nearClearDistance);
    const t = (relZ - fp.nearClearDistance) / span;
    if (t <= 0) return 1;
    return Math.max(0, Math.exp(-t * 2.2));   // exp dissolve
  },
};
