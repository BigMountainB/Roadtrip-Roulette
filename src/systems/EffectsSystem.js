/**
 * EffectsSystem — translates vice levels into visual + physics distortions.
 *
 * Visual effects (no shader required):
 *   - Screen sway / scrollX drift  (Sushi)
 *   - Double vision ghost pass     (Sushi > 0.8)
 *   - Green tint overlay           (burrito)
 *   - White flash pulse            (energy)
 *   - Hue-cycling color overlay    (gummies / hotdog)
 *   - Liquefying world projection  (gummies > 0.7)
 *   - Dark vignette + drooping lids (Combo / Coma)
 *   - Tunnel vision                (Coma)
 *   - Dissociation quad split      (Slushie > 0.8)
 *   - Screen shake                 (crash events)
 *
 * Physics effects (returned as an object read by Player):
 *   - steerDrift     – random sideways drift per frame
 *   - steerSensitivity – multiplier on player input
 *   - speedMult      – max speed multiplier
 *   - extraCurve     – adds phantom curve to road
 *   - inputDelay     – ms delay on steering (Slushie)
 */
import { VICES, CAM } from '../constants.js';
import { clamp, lerp } from '../utils/Helpers.js';
import { TimeOfDay } from '../world/TimeOfDay.js';
import { Weather }   from '../world/Weather.js';

export class EffectsSystem {
  constructor(scene) {
    this.scene    = scene;
    this.time     = 0;
    this.shakeTimer = 0;

    // Overlay graphics objects (created in GameScene.create)
    this.overlay     = null;  // semi-transparent color overlay
    this.vignetteGfx = null;  // dark vignette
    this.hudFlash    = null;  // bright flash

    // State exposed to Road renderer
    this.doubleVision = 0;
    this.gummiesMelt = 0;

    // Delayed input buffer for Slushie
    this._inputBuffer = [];
    this._inputDelay  = 0;

    // Hot Dog transient grayscale-flip scheduling
    this._hotdogGrayTimer = 0;
    this._hotdogNextGray  = 2 + Math.random() * 3;

    // Hot Dog pastel blob pool — pre-allocated, mutated in place to avoid
    // per-frame GC churn.  Same pattern as the Milky Way puff blobs.
    this._hotdogBlobs = [];
    for (let i = 0; i < 16; i++) {
      this._hotdogBlobs.push({
        active: false, x: 0, y: 0, color: 0,
        age: 0, lifetime: 0, radius: 0,
      });
    }
    this._hotdogBlobSpawnTimer = 0;

    // Cold Brew roulette
    this._coldbrewRoll       = -1;
    this._lastColdbrewBar    = 0;
    this._coldbrewRollExpire = 0;

    // Combo flags (re-derived per update)
    this._comboSnowCone     = false;
    this._comboTranq        = false;
    this._comboPsychedelic  = false;
    this._comboSpeedball    = false;
    this._comboApocalypse   = false;
  }

  setGraphics(overlay, vignetteGfx, hudFlash) {
    this.overlay     = overlay;
    this.vignetteGfx = vignetteGfx;
    this.hudFlash    = hudFlash;
  }

  update(dt, vices, camera, ctx = {}) {
    this.time += dt;
    const t = this.time;
    const d = vices;
    const mile = ctx.mile ?? 0;

    const sushi  = d.get(VICES.SUSHI);
    const burrito = d.get(VICES.BURRITO);
    const energy = d.get(VICES.ENERGY);
    const gummies = d.get(VICES.GUMMIES);
    const hotdog  = d.get(VICES.HOTDOG);
    const combo = d.get(VICES.COMBO);
    const coldbrew   = d.get(VICES.COLDBREW);
    const coma = d.get(VICES.COMA);
    const slushie  = d.get(VICES.SLUSHIE);
    const caffeine = d.get(VICES.CAFFEINE);

    // High-dose Gummies: smoothly feed a visual-only liquid-world warp
    // into Road.render(). Keeping this in the projection pass bends pavement,
    // scenery, and traffic together without a shader or extra textures.
    const meltRaw = clamp((gummies - 0.70) / 0.30, 0, 1);
    const meltTarget = meltRaw * meltRaw * (3 - 2 * meltRaw);
    this.gummiesMelt = lerp(this.gummiesMelt, meltTarget, clamp(dt * 3, 0, 1));

    // ── Cold Brew roulette ─────────────────────────────────────────────────
    // Detect a fresh pickup (coldbrew jumped > 0.05 vs last frame); roll a
    // new effect 0..4 and start a 12s window.  When the window expires
    // _coldbrewRoll = -1 and all coldbrew-roulette physics fields go to 0.
    if (coldbrew > (this._lastColdbrewBar ?? 0) + 0.05) {
      this._coldbrewRoll       = Math.floor(Math.random() * 5);
      this._coldbrewRollExpire = 12;
    }
    this._lastColdbrewBar = coldbrew;
    if (this._coldbrewRollExpire > 0) {
      this._coldbrewRollExpire -= dt;
      if (this._coldbrewRollExpire <= 0) {
        this._coldbrewRoll       = -1;
        this._coldbrewRollExpire = 0;
      }
    }

    // ── Combo detection ─────────────────────────────────────────────
    this._comboSnowCone    = (sushi > 0.3 && energy > 0.3);
    this._comboTranq       = (combo > 0.3 && slushie > 0.3);
    this._comboPsychedelic = (gummies > 0.3 && hotdog > 0.3);
    this._comboSpeedball   = (energy > 0.3 && combo > 0.3);
    let _activeCount = 0;
    if (sushi     > 0.3) _activeCount++;
    if (burrito    > 0.3) _activeCount++;
    if (energy    > 0.3) _activeCount++;
    if (gummies > 0.3) _activeCount++;
    if (hotdog     > 0.3) _activeCount++;
    if (combo    > 0.3) _activeCount++;
    if (coldbrew      > 0.3) _activeCount++;
    if (coma    > 0.3) _activeCount++;
    if (slushie     > 0.3) _activeCount++;
    if (caffeine    > 0.3) _activeCount++;
    this._comboApocalypse = (_activeCount >= 4);

    // ── Double Vision (energy partially cuts through it) ──────────────
    // Threshold lowered from 0.60 → 0.45 and the ramp tightened so the
    // effect peaks well before the bar is full — at 80%+ Sushi the
    // doubling should be unmistakable, not subtle.
    const sushiNet = Math.max(0, sushi - energy * 0.5);  // energy sobers you up some
    this.doubleVision = sushiNet > 0.45 ? clamp((sushiNet - 0.45) / 0.30, 0, 1) : 0;

    // ── Camera Sway (Sushi, reduced by energy) ─────────────────────
    const swayAlc = Math.max(0, sushi - energy * 0.6);
    if (swayAlc > 0.08) {
      const swayAmp  = swayAlc * 55;
      const swayFreq = 0.8 + swayAlc * 0.8;
      camera.setScroll(Math.sin(t * swayFreq) * swayAmp * swayAlc, 0);
    } else {
      camera.setScroll(lerp(camera.scrollX, 0, 0.1), 0);
    }

    // ── Screen Shake (energy burst / crash) ──────────────────────────
    if (energy > 0.7 && Math.random() < 0.02) {
      this.triggerShake(80, 0.006);
    }

    // ── Overlay effects ───────────────────────────────────────────────
    if (this.overlay) {
      this.overlay.clear();

      // Burrito: green tint that intensifies into a heavy haze ≥ 60%.
      // At burrito ≥ 0.5 the wash "breathes" at ~0.4 Hz — slow inhale/exhale
      // that reads as the hazy/floaty feel without any new visual layers.
      const burritoBreath = burrito >= 0.5
        ? 1 + Math.sin(t * Math.PI * 2 * 0.4) * 0.25
        : 1;
      if (burrito > 0.05) {
        this.overlay.fillStyle(0x224422, burrito * 0.22 * burritoBreath);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }
      if (burrito >= 0.60) {
        const haze = (burrito - 0.60) / 0.40;
        this.overlay.fillStyle(0x556b4a, (0.18 + haze * 0.18) * burritoBreath);
        this.overlay.fillRect(-150, -150, 1100, 750);
        this.overlay.fillStyle(0xCCDFC2, (0.06 + haze * 0.10) * burritoBreath);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Sushi: red tint at high levels
      if (sushi > 0.5) {
        this.overlay.fillStyle(0x440000, (sushi - 0.5) * 0.3);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Energy: pulsing white flash
      if (energy > 0.15) {
        const pulse = Math.abs(Math.sin(t * 4.5)) * energy * 0.18;
        this.overlay.fillStyle(0xFFFFFF, pulse);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Caffeine: subtle white contrast pop above 0.4 — sells the wired/sharp
      // feel without flashing the player.  Peaks at ~0.024 alpha.
      if (caffeine > 0.4) {
        this.overlay.fillStyle(0xFFFFFF, (caffeine - 0.4) * 0.04);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Gummies: saturation-pump per dose (8% per pickup, capped at 100%).
      // Implemented as a slow cycling hue overlay whose alpha grows with
      // pickup count — visually "the world's getting more saturated".
      // Alpha bumped 0.32 → 0.55 + a baseline term keyed off the bar
      // itself so saturation reads even on the first pickup.
      if (gummies > 0.05) {
        const gummiesPickups = d.pickupCounts?.[VICES.GUMMIES] ?? 0;
        const satBoost = Math.min(1, gummiesPickups * 0.08);
        const hue1 = Math.sin(t * 0.4)         * 0.5 + 0.5;
        const hue2 = Math.sin(t * 0.4 + 2.094) * 0.5 + 0.5;
        const hue3 = Math.sin(t * 0.4 + 4.188) * 0.5 + 0.5;
        const r = Math.round(hue1 * 255);
        const g = Math.round(hue2 * 255);
        const b = Math.round(hue3 * 255);
        const col = (r << 16) | (g << 8) | b;
        // satBoost grows with pickups (slow build), bar-baseline kicks
        // in immediately so a single gummy at 90% bar still tints.
        const a = satBoost * 0.55 + gummies * 0.18;
        this.overlay.fillStyle(col, a);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Gummies perceptual: sky rainbow gradient (5 hue bands across upper
      // half, low alpha, hue offset cycles over time).
      if (gummies > 0.4) {
        const SKY_TOP = -150;
        const SKY_H   = 225 + 150;          // upper half + top margin
        const BANDS   = 5;
        const BAND_W  = 1100 / BANDS;
        const hueShift = t * 0.35;
        for (let i = 0; i < BANDS; i++) {
          const phase = hueShift + i * (Math.PI * 2 / BANDS);
          const rr = Math.round((Math.sin(phase)         * 0.5 + 0.5) * 255);
          const gg = Math.round((Math.sin(phase + 2.094) * 0.5 + 0.5) * 255);
          const bb = Math.round((Math.sin(phase + 4.188) * 0.5 + 0.5) * 255);
          this.overlay.fillStyle((rr << 16) | (gg << 8) | bb, 0.06 * gummies);
          this.overlay.fillRect(-150 + i * BAND_W, SKY_TOP, BAND_W, SKY_H);
        }
      }

      // Gummies color-saturation pulse — warm-hue cycling wash, alpha
      // pulses with sin(time).  Pure overlay alpha pulse (no per-pixel sat).
      if (gummies > 0.3) {
        const pulseAlpha = Math.sin(t * 0.6) * 0.04 * gummies;
        if (pulseAlpha > 0) {
          const warmPhase = t * 0.25;
          const rr = Math.round((Math.sin(warmPhase)       * 0.3 + 0.7) * 255);
          const gg = Math.round((Math.sin(warmPhase + 1.0) * 0.25 + 0.45) * 255);
          const bb = Math.round((Math.sin(warmPhase + 2.0) * 0.15 + 0.20) * 255);
          this.overlay.fillStyle((rr << 16) | (gg << 8) | bb, pulseAlpha);
          this.overlay.fillRect(-150, -150, 1100, 750);
        }
      }
      // Gummies ≥ 65% rainbow is now drawn by Road.js immediately after
      // the sky bands so it sits BEHIND road / scenery / NPCs (per user
      // request).  Road.render reads `effects.gummiesBar` to gate it.

      // Hot Dog: per-hit brightness boost (8% per pickup) + geometric lines
      // at higher levels.  Above 90% the screen flips to a heavy grey
      // wash, reading as "everything's gone B&W".
      if (hotdog > 0.05) {
        const hotdogPickups = d.pickupCounts?.[VICES.HOTDOG] ?? 0;
        const brightness = Math.min(1, hotdogPickups * 0.08);
        // Flat white wash for the brightness lift.
        this.overlay.fillStyle(0xFFFFFF, brightness * 0.30);
        this.overlay.fillRect(-150, -150, 1100, 750);
        // Geometric lines remain at higher bar levels.
        if (hotdog > 0.3) {
          this.overlay.lineStyle(1, 0xFFFFFF, hotdog * 0.15);
          for (let i = 0; i < 6; i++) {
            const x = (Math.sin(t * 0.9 + i * 1.05) * 0.5 + 0.5) * 800;
            this.overlay.strokeRect(x - 40, 0, 80, 450);
          }
        }
      }
      if (hotdog >= 0.90) {
        // Heavy grey wash leans the world toward greyscale.  Real
        // desaturation needs a shader pipeline (deferred) — this is the
        // arcade-cheap version, and it still reads as "B&W trip".
        const a = Math.min(1, (hotdog - 0.90) / 0.10) * 0.60;
        this.overlay.fillStyle(0x808080, a);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Hot Dog transient grayscale flips — every 2-5 sec a 0.3s burst of
      // 0x808080 at 0.20 alpha.  Psychedelic combo halves the next-burst
      // window so flips fire ~2x as often.
      if (hotdog > 0.4) {
        if (this._hotdogGrayTimer > 0) {
          this._hotdogGrayTimer -= dt;
          this.overlay.fillStyle(0x808080, 0.20);
          this.overlay.fillRect(-150, -150, 1100, 750);
        } else {
          this._hotdogNextGray -= dt;
          if (this._hotdogNextGray <= 0) {
            this._hotdogGrayTimer = 0.3;
            const freqMul = this._comboPsychedelic ? 0.5 : 1.0;
            this._hotdogNextGray = (2 + Math.random() * 3) * freqMul;
          }
        }
      }

      // Hot Dog chromatic aberration — small red + blue offsets.
      if (hotdog > 0.5) {
        const aberrAlpha = (hotdog - 0.5) * 0.18;
        const offset = 4 + Math.sin(t * 1.3) * 2;
        // CB: swap the red/blue split for a warm/cool amber↔cyan one, which
        // survives protan/deutan/tritan (the red half washes out otherwise).
        const cb = this.scene?._colorblind;
        this.overlay.fillStyle(cb ? 0xFF8A00 : 0xFF2030, aberrAlpha);
        this.overlay.fillRect(-150 - offset, -150, 1100, 750);
        this.overlay.fillStyle(cb ? 0x00B7FF : 0x2040FF, aberrAlpha);
        this.overlay.fillRect(-150 + offset, -150, 1100, 750);
      }

      // Hot Dog slow brightness wash — cycles bright/dim (clamped at 0).
      if (hotdog > 0.3) {
        const brightAlpha = Math.sin(t * 0.4) * 0.04 * hotdog;
        if (brightAlpha > 0) {
          this.overlay.fillStyle(0xFFFFFF, brightAlpha);
          this.overlay.fillRect(-150, -150, 1100, 750);
        }
      }

      // Hot Dog ≥ 70%: translucent pastel blobs that fade in / hold / fade
      // out at random screen positions.  Same three-pass blob style as
      // the Milky Way puffs — outer halo, mid wash, bright core.  The
      // pool is pre-allocated; we just cycle entries between active
      // and idle so no objects are created per frame.
      if (hotdog > 0.7) {
        const hotdogMix = Math.min(1, (hotdog - 0.7) / 0.3);
        // Spawn cadence ramps with bar level — at hotdog=1.0 a new blob
        // every 0.3-0.8s; at hotdog=0.7 every 0.6-1.4s.
        this._hotdogBlobSpawnTimer -= dt;
        if (this._hotdogBlobSpawnTimer <= 0) {
          for (const b of this._hotdogBlobs) {
            if (b.active) continue;
            b.active   = true;
            // Spawn anywhere in the visible play area.  Slight bias
            // toward the upper half so blobs feel like they emerge
            // out of the sky / road perspective rather than the HUD.
            b.x        = Math.random() * 800;
            b.y        = Math.random() * 450 * 0.85;
            // Pastel palette — soft saturated tints, no primaries.
            const PASTELS = [
              0xFFB7C5,  // pink
              0xB7E5C9,  // mint
              0xC5B7FF,  // lavender
              0xFFD2B7,  // peach
              0xB7D8FF,  // sky-blue
              0xFFF5B7,  // lemon
              0xE5B7FF,  // orchid
              0xB7FFE0,  // aqua
            ];
            b.color    = PASTELS[Math.floor(Math.random() * PASTELS.length)];
            b.age      = 0;
            b.lifetime = 1.5 + Math.random() * 2.5;     // 1.5–4 s
            b.radius   = 60 + Math.random() * 110;      // 60–170 px
            break;
          }
          // Next-spawn delay — tighter at higher bar levels.
          const minDelay = 0.3 + (1 - hotdogMix) * 0.3;    // 0.3–0.6s
          const range    = 0.5 + (1 - hotdogMix) * 0.3;    // +0–0.8s
          this._hotdogBlobSpawnTimer = minDelay + Math.random() * range;
        }

        // Update + paint active blobs.  Three-pass for soft edges.
        for (const b of this._hotdogBlobs) {
          if (!b.active) continue;
          b.age += dt;
          if (b.age >= b.lifetime) { b.active = false; continue; }
          // Fade-in 25%, hold 50%, fade-out 25%.  Smooth via cosine.
          const t01 = b.age / b.lifetime;
          let env;
          if      (t01 < 0.25) env = t01 / 0.25;
          else if (t01 > 0.75) env = (1 - t01) / 0.25;
          else                 env = 1;
          // Smoothstep the envelope so the edges aren't linear.
          env = env * env * (3 - 2 * env);
          const a = env * 0.32 * hotdogMix;
          this.overlay.fillStyle(b.color, a * 0.32);
          this.overlay.fillCircle(b.x, b.y, b.radius * 1.4);
          this.overlay.fillStyle(b.color, a * 0.55);
          this.overlay.fillCircle(b.x, b.y, b.radius * 1.0);
          this.overlay.fillStyle(b.color, a * 0.85);
          this.overlay.fillCircle(b.x, b.y, b.radius * 0.45);
        }
      }

      // Combo: subtle dark-blue dreaminess.  Cut the alpha sharply (was
      // 0.35) so the screen isn't washed dim — the heavy lifting is done
      // by the vignette below, which gives a tunnel-vision closing-in
      // feel rather than a flat dark wash.
      // ── Combo: continuous "nodding off" envelope ──────────────
      // Replaced the random staged blackouts with a slow nod cycle.
      // (1 − cos(t·ω))/2 gives a smooth 0→1→0 wave; cubing biases the
      // envelope LOW most of the time and spikes high at peak nods, so
      // the player feels mostly heavy with periodic "head dips".
      // Frequency ramps with the combo level (slower nods at low doses,
      // faster as it builds).  Drives vignette boost, eyelid droop,
      // input lag, and throttle sag — exposed via getPhysics().
      const nodFreq = 0.45 + combo * 0.35;
      const nodRaw  = (1 - Math.cos(this.time * nodFreq)) * 0.5;
      const nod     = combo > 0.05
        ? Math.pow(nodRaw, 3) * Math.min(1, combo * 2)
        : 0;
      this._comboNodAmount = nod;

      // Warm dim wash — sedated/heavy room feel, not the prior chemical
      // blue wash.  Vignette + eyelid droop carry most of the visual
      // weight, so this layer stays subtle.
      if (combo > 0.05) {
        this.overlay.fillStyle(0x1A120C, combo * 0.10);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // Slushie "detachment" — neutral grey wash above 40% pulls the
      // world toward greyscale (cheap pseudo-desaturation).  Reads as
      // "everything's far away" — pairs with the existing tilt + static.
      if (slushie > 0.40) {
        this.overlay.fillStyle(0x808080, (slushie - 0.40) * 0.08);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // ── World darkness (TimeOfDay) ─────────────────────────────────
      // Drawn LAST in the overlay so it dims everything underneath: road,
      // scenery, NPCs, even the vice-effect washes.  HUD lives on the UI
      // camera so this doesn't dim it.  Easy mode only dims the sky;
      // Normal+ runs a full-world dim (TimeOfDay handles that gating).
      const darkness = TimeOfDay.darkness(mile);
      if (darkness > 0.02) {
        // Wash strength dropped 0.55 → 0.40 so the night sky stays
        // legible (stars + moon are 2×2 px at full alpha; a heavier
        // wash was muting them into the background).
        this.overlay.fillStyle(0x05080F, darkness * 0.40);
        this.overlay.fillRect(-150, -150, 1100, 750);
      }

      // ── Weather particles (rain / snow) ────────────────────────────
      const weatherState = Weather.state(mile);
      const weatherInt   = Weather.intensity(mile);
      if (weatherState === 'rain' && weatherInt > 0.05) {
        // Severity ramps 1.0 (storm leading edge) → 2.4 (deep in it); sevT
        // is the normalized 0..1 form.  Drives BOTH the falling-streak
        // density/opacity and the windshield-drop load so the rain visibly
        // builds into a hard-to-see-through downpour past mile ~35.
        const sev  = Weather.severity?.(mile) ?? 1;
        // sevT caps at 1.0 (owner 2026-07-16 revert): letting it ride to 2.0
        // doubled the windshield-drop count into a "wall" of ~600 beads all
        // creeping up in unison — unrealistic. Rain should BUILD UP gradually
        // (like the snow layer), so hold the pre-storm-wall load ceiling.
        const sevT = Math.max(0, Math.min(1, (sev - 1) / 1.4));
        // Slanted white streaks falling top → bottom-right.  Spawn area
        // extended into the 150-px margin so a rotated camera still sees
        // rain instead of a sharp boundary at x=0 / 800.  Count + opacity
        // scale with severity: a light sprinkle early, a heavy sheet later.
        const COUNT = Math.floor(110 * weatherInt * (1 + 1.4 * sevT));
        this.overlay.lineStyle(1, 0xC8DAE8, 0.45 + 0.30 * sevT);
        const SLANT  = 18;
        const HEIGHT = 22;
        for (let i = 0; i < COUNT; i++) {
          const seedX = (i * 53) % 1100;
          const seedY = (i * 91) % 750;
          const dropY = -150 + (seedY + t * 720) % 770;
          const x     = -150 + (seedX + (i * 7) % 60) % 1100;
          this.overlay.beginPath();
          this.overlay.moveTo(x,         dropY - HEIGHT);
          this.overlay.lineTo(x + SLANT, dropY);
          this.overlay.strokePath();
        }
        // Windshield droplets — slide UP the screen like raindrops on
        // a moving car's windshield (airflow pushes them up + back over
        // the glass).  Each drop has a stable x seed and a phase offset
        // so they're scattered, then y is animated by gameTime against a
        // fixed scroll period.  Wiper button suppresses the layer.
        // ── Persistent windshield-drop pool ──────────────────────────
        // Each drop has its own x/y/size/alpha and drifts UP the glass
        // toward the top of the windshield.  Wipers DO NOT instantly
        // clear all drops — instead each completed wiper cycle fires a
        // `ctx.wiperSweepPulse` that removes ~45 % of drops and shrinks
        // the survivors by ~35 % size + 30 % alpha.  After 3 sweeps,
        // residual drops are ~17 % count × ~27 % size of the original
        // — small leftovers that read like "fresh rain just started".
        // New drops keep spawning while it's raining, so leaving the
        // wipers off lets the storm build back up.
        if (!this._wsDrops) { this._wsDrops = []; this._wsSpawnT = 0; this._wsBigT = 0; }
        // WIPERS ON ⇒ keep the glass CLEAR (much easier to see): the fine
        // drizzle target + spawn rate are cut hard, and each sweep removes
        // most of what's there (the wipe pulse only fires while the wipers
        // run, so this never affects the wipers-OFF look).  WIPERS OFF ⇒ the
        // drizzle builds into the heavy, hard-to-see-through sheet.
        const wiperOn = !!ctx.wiperActive;
        // Wiper POWER (owner 2026-07-21): stock blades barely smear (0.2); the
        // "New Wiper Blades" upgrade restores full clearing (1.0).  Each wiper-on
        // clearing multiplier eases from its full-clear value toward 1 (= no
        // effect) as power drops.
        const wp  = Math.max(0, Math.min(1, ctx.wiperPower ?? 1));
        const wOn = (fullMul) => wiperOn ? (1 - (1 - fullMul) * wp) : 1;
        // Fine drizzle — the layer that actually fogs the glass.  Scales with
        // weatherInt/sevT so LIGHT rain stays light; gutted when wipers run.
        const TARGET_DROPS = Math.floor((40 + 320 * sevT) * weatherInt * wOn(0.12));
        const MAX_DROPS    = 380;
        const SPAWN_PER_SEC = (8 + 52 * sevT) * Math.max(0.2, weatherInt) * wOn(0.30);
        this._wsSpawnT += dt;
        const spawnInterval = 1 / Math.max(0.1, SPAWN_PER_SEC);
        // Full-screen coverage (was 110–420, which left a bare strip at
        // the top + bottom edges per user).  Slight overscan past 0/450
        // absorbs camera shake / rotation so no gap shows.
        const WS_TOP    = -40;
        const WS_BOTTOM = 490;
        const spawnCap  = Math.min(TARGET_DROPS, MAX_DROPS);
        while (this._wsSpawnT >= spawnInterval && this._wsDrops.length < spawnCap) {
          this._wsSpawnT -= spawnInterval;
          this._wsDrops.push({
            x:     Math.random() * 800,
            y:     WS_BOTTOM - Math.random() * (WS_BOTTOM - WS_TOP) * 0.45,
            r:     (1.8 + Math.random() * 2.6) * (1 + 0.5 * sevT),
            alpha: 0.55 + Math.random() * 0.30,
            vy:    -6 - Math.random() * 4 - 4 * sevT,    // slow up-drift
            big:   false,
            trail: 0,
          });
        }
        // BIG "runner" drops — fat beads that race UP the glass leaving a long
        // rivulet trail.  Spawned on their OWN cadence (not part of the drizzle
        // target) so they still streak through even with the wipers ON — they
        // last a fraction of a second and don't really block vision, so they
        // read as character, not as the thing that makes it hard to see.  A few
        // per second at the storm peak; slightly fewer while wiping.
        this._wsBigT += dt;
        const bigPerSec   = (1.0 + 3.5 * sevT) * Math.max(0.25, weatherInt) * wOn(0.7);
        const bigInterval = 1 / Math.max(0.05, bigPerSec);
        while (this._wsBigT >= bigInterval && this._wsDrops.length < MAX_DROPS) {
          this._wsBigT -= bigInterval;
          const rBase = 4.5 + Math.random() * 3.8;
          this._wsDrops.push({
            x:     Math.random() * 800,
            y:     WS_BOTTOM - Math.random() * (WS_BOTTOM - WS_TOP) * 0.45,
            r:     rBase * (1 + 0.5 * sevT),
            alpha: 0.62 + Math.random() * 0.30,
            vy:    -55 - Math.random() * 55 - 20 * sevT,    // fast runner
            big:   true,
            trail: 44 + Math.random() * 70,                 // rivulet length (px)
          });
        }
        // Wipe pulse — fires once per wiper cycle (wipers ON only).  Removes
        // most drops + shrinks/fades survivors so the glass clears fast and
        // stays clear (much easier to see).  Big runners get cleared too, but
        // their own spawner keeps a few streaking between sweeps.
        if (ctx.wiperSweepPulse) {
          const survivors = [];
          for (const d of this._wsDrops) {
            if (Math.random() < 0.80 * wp) continue;   // stock blades clear far fewer
            d.r     *= 0.55;
            d.alpha *= 0.60;
            d.trail  = (d.trail || 0) * 0.50;        // runners' tails shrink too
            if (d.r > 0.6 && d.alpha > 0.08) survivors.push(d);
          }
          this._wsDrops = survivors;
        }
        // Update + render.  Drops drift up and off the top edge (matches
        // WS_TOP) so they populate the full glass instead of vanishing at 110.
        const TOP_Y = -40;
        for (let i = this._wsDrops.length - 1; i >= 0; i--) {
          const d = this._wsDrops[i];
          d.y += d.vy * dt;
          // Keep runners alive until their trailing rivulet also clears the top.
          if (d.y < TOP_Y - (d.trail || 0)) {
            this._wsDrops.splice(i, 1);
            continue;
          }
          if (d.big) {
            // Long tapering rivulet trailing BELOW the head (the wet track the
            // bead leaves as it runs up).  Two stacked segments fade the tail.
            const tw = Math.max(0.8, d.r * 0.55);
            this.overlay.fillStyle(0xCFE0EE, Math.min(1, 0.20 * d.alpha));
            this.overlay.fillRect(d.x - tw * 0.5, d.y, tw, d.trail);
            this.overlay.fillStyle(0xCFE0EE, Math.min(1, 0.34 * d.alpha));
            this.overlay.fillRect(d.x - tw * 0.4, d.y, tw * 0.8, d.trail * 0.45);
          } else {
            // Short streak below the drizzle drop.
            this.overlay.fillStyle(0xCFE0EE, Math.min(1, 0.34 * d.alpha));
            this.overlay.fillRect(d.x - d.r * 0.30, d.y, d.r * 0.6, d.r * 2.4);
          }
          // Drop body.
          this.overlay.fillStyle(0xCFE0EE, Math.min(1, 0.62 * d.alpha));
          this.overlay.fillEllipse(d.x, d.y, d.r * 1.5, d.r * 1.9);
          // Specular highlight.
          this.overlay.fillStyle(0xFFFFFF, Math.min(1, 0.85 * d.alpha));
          this.overlay.fillCircle(d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.35);
        }
      } else if (weatherState === 'snow' && weatherInt > 0.05) {
        // Snowflakes — bigger + more varied per user spec.  Five size
        // buckets, alpha keyed to size (smaller = more transparent),
        // larger flakes get a cross sparkle.  Sway split across FOUR
        // distinct zigzag lanes (different frequencies + phases) so the
        // field doesn't read as a single duplicated waveform.
        const COUNT = Math.floor(165 * weatherInt);
        // Four zigzag lanes — distinct frequencies break the lockstep
        // uniform pattern; flakes from different lanes oscillate at
        // different rates so neighbors visibly diverge.
        const LANE_FREQ  = [0.45, 0.85, 1.30, 1.85];
        const LANE_PHASE = [0.0,  1.7,  3.1,  4.6];
        for (let i = 0; i < COUNT; i++) {
          const sizeBucket = i % 5;                   // 0..4
          const r          = 2 + sizeBucket * 1.0;     // 2..6 px
          const alpha      = 0.55 + sizeBucket * 0.10; // 0.55..0.95
          const fallSpeed  = 70 + (4 - sizeBucket) * 12; // 70..118
          const swayAmp    = 4 + sizeBucket * 1.5;     // 4..10 px

          // Pick a zigzag lane.  i*7 % 4 (instead of i % 4) so lane
          // assignment isn't aligned with size-bucket assignment.
          const laneId    = (i * 7) % 4;
          const swayFreq  = LANE_FREQ[laneId];
          const swayPhase = LANE_PHASE[laneId] + (i * 0.31) % (Math.PI * 2);

          const seedX = (i * 47 + (i % 13) * 91) % 1100;   // less grid-like
          const seedY = (i * 71 + (i % 17) * 53) % 800;
          const driftY = -150 + (seedY + t * fallSpeed + (i * 3 % 30)) % 820;
          // Two-octave sway — primary lane wave + a smaller secondary
          // wave at a different rate, so the trajectory isn't a clean
          // sine.  Reads as wind-buffeted drift.
          const sway = Math.sin(t * swayFreq        + swayPhase) * swayAmp
                     + Math.sin(t * swayFreq * 2.6 + swayPhase * 0.7) * swayAmp * 0.35;
          const x    = -150 + (seedX + sway + 1100) % 1100;

          this.overlay.fillStyle(0xFFFFFF, alpha);
          this.overlay.fillCircle(x, driftY, r);

          // Cross sparkle on the larger flakes — gives them an obvious
          // "snowflake" silhouette instead of a uniform dot field.
          if (sizeBucket >= 3) {
            const armL = r * 1.9;
            const armW = Math.max(0.8, r * 0.32);
            this.overlay.fillStyle(0xFFFFFF, alpha * 0.55);
            this.overlay.fillRect(x - armL * 0.5, driftY - armW * 0.5, armL, armW);
            this.overlay.fillRect(x - armW * 0.5, driftY - armL * 0.5, armW, armL);
          }
        }

        // ── Snow ACCUMULATION on windshield (real-snow 2026-06-01) ──────
        // Flakes LAND and STICK, and the pile keeps building the longer you
        // drive — growing in count + size — until the glass is FULLY white,
        // unless you run the wipers.  `_wsSnowCoverage` (0→1) tracks how
        // buried the glass is: it grows with miles in snow and is only
        // knocked back by wiper sweeps.  Coverage scales the flake count +
        // size.  NO uniform white fill — the whiteout is built ENTIRELY from
        // stacked opaque flakes (a flat white sheet reads as fake; per user).
        // At a full pile only thin cracks of glass show through.
        if (this._wsSnowCoverage == null) { this._wsSnowCoverage = 0; this._wsSnowMile = mile; }
        if (!this._wsStuck) { this._wsStuck = []; this._wsStuckT = 0; }
        const sevSn  = Weather.severity?.(mile) ?? 1;
        const sevSnT = Math.max(0, Math.min(1, (sevSn - 1) / 1.4));
        // CAP the per-frame mileage delta.  `_wsSnowMile` is only advanced
        // inside this snow branch, so it goes STALE across the preceding rain
        // stretch (mi 30-40 the rain branch runs, not this one) — and the
        // clear-weather branch's `coverage < 0.01 -> 0` flips the `== null`
        // init guard off, so on the first snow frame the raw delta is the whole
        // rain run (~10 mi) and coverage maxes to a full whiteout instantly.
        // Clamp to 0.1 mi/frame (far above the real per-frame mileage) so entry
        // builds gradually from 0 over ~6 mi, and warps don't cake on arrival.
        const mileDeltaSn = Math.max(0, Math.min(0.1, mile - (this._wsSnowMile ?? mile)));
        this._wsSnowMile = mile;
        // Full whiteout in ~6 mi at peak (faster in heavier snow); a light
        // flurry (low weatherInt) takes proportionally longer.
        const COVER_PER_MILE = 0.17 * weatherInt * (0.7 + 0.3 * sevSnT);
        this._wsSnowCoverage = Math.min(1, this._wsSnowCoverage + mileDeltaSn * COVER_PER_MILE);
        if (ctx.wiperSweepPulse) this._wsSnowCoverage = Math.max(0, this._wsSnowCoverage - 0.34);
        const cov = this._wsSnowCoverage;
        // Flake population grows with coverage (40 → 560); persistent so they
        // stack rather than recycle.  Topped up a few per tick toward target.
        const flakeTarget = Math.floor(40 + 860 * cov);
        this._wsStuckT += dt;
        if (this._wsStuckT >= 0.03) {
          this._wsStuckT = 0;
          const need = flakeTarget - this._wsStuck.length;
          for (let n = 0; n < need && n < 40; n++) {
            this._wsStuck.push({
              x: -40 + Math.random() * 880,   // overscan past 0..800 / 0..450
              y: -40 + Math.random() * 530,
              r: 1.6 + Math.random() * 2.6,
              a: 0.82 + Math.random() * 0.18,  // opaque specks — no haze
            });
          }
        }
        // Wiper sweep clears ~60% of the pile so a few sweeps reset the glass.
        if (ctx.wiperSweepPulse) {
          const survivors = [];
          for (const f of this._wsStuck) {
            if (Math.random() < 0.60) continue;
            f.a *= 0.8;
            if (f.a > 0.08) survivors.push(f);
          }
          this._wsStuck = survivors;
        }
        // Flakes clump LARGER as coverage builds (cov² curve) so by a full
        // pile they overlap into a near-solid snow cake — only thin cracks of
        // glass show through.  This IS the whole whiteout: no white rect fill.
        const grow = 1 + cov * cov * 6;
        for (const f of this._wsStuck) {
          const rr = f.r * grow;
          this.overlay.fillStyle(0xDDE8F2, f.a * 0.5);
          this.overlay.fillCircle(f.x, f.y, rr * 1.5);
          this.overlay.fillStyle(0xFFFFFF, f.a);
          this.overlay.fillCircle(f.x, f.y, rr);
        }
      } else if (weatherState === 'fog' && weatherInt > 0.02) {
        // ── Issaquah valley fog — horizon haze + drifting mist ─────────
        // A pale wall of fog sits on the horizon, thinning up into the sky
        // and down over the near road, with a few big soft wisps sliding
        // across it.  Paired with Road.js's gentle distance-fog lift through
        // the same mile window, the basin reads with real depth.
        // Fog lights thin the whole screen haze (owner 2026-07-22) — the
        // clarity factor is 1 without the upgrade, 0.5 with it installed.
        const fi      = weatherInt * (Weather._fogClarityMul ?? 1);
        const horizon = Math.round(CAM.horizonY ?? 200);
        const FOG_RGB = 0xC9D2DA;                 // cool pale grey

        // ── Fog-light beam clearing (owner 2026-08-03) ─────────────────
        // The global 0.5 clarity factor alone read as "no difference" — a
        // uniform change has nothing in-frame to compare against.  With the
        // upgrade installed, the haze is now additionally CLEARED inside a
        // headlight-shaped wedge running from the front of the car to the
        // road's vanishing point: fog inside the beam drops to BEAM_CLEAR of
        // its surrounding alpha, with a feathered edge so the wedge reads as
        // thrown light, not a cut-out.  Everything outside the wedge keeps
        // the normal haze, so the beam is visible BY CONTRAST — which is the
        // whole point of fog lights.
        const _ps  = this.scene?.playerSprite;
        // Beam shape per owner 2026-08-03: the NARROW end sits at the car's
        // nose and the fan WIDENS with distance, staying symmetrical about
        // the car's own axis — a flashlight cone sticking out of the car.
        // (An earlier cut converged toward the road's vanishing point, which
        // read as the beam leaning off-axis — the same off-centre look as the
        // widened-canvas road-texture bug.)  No road sampling, no lean: the
        // fan is centred on the car, full stop.
        // Apex sits at the TOP THIRD of the car sprite (owner 2026-08-03) —
        // that's where the car's nose reads in the chase view, so the fan
        // starts at the lamps instead of appearing to hang off the rear
        // bumper.  Computed from the sprite's own origin/height so it holds
        // for every vehicle's art.
        const _noseY = _ps
          ? (_ps.y - _ps.displayHeight * _ps.originY) + _ps.displayHeight / 3
          : 0;
        // The fan's FAR END locks to the ROAD'S LIVE VANISHING POINT
        // (owner 2026-08-14, third pass).  Neither previous anchor was it:
        //   • the 08-03 sample at 55000 units (~0.17 mi) pitched the fan
        //     down at nearby pavement on descents;
        //   • the fixed CAM.horizonY stopped short on descents too — the
        //     Issaquah downgrade shows MORE road, so the lanes converge
        //     well ABOVE the static horizon line and the beam visibly
        //     died below them.
        // Sampling the road at the FULL draw distance (DRAW_DIST 380 segs
        // × 200 = 76000) gives the actual on-screen convergence for every
        // grade: high on a descent, at the crest edge over a crest (which
        // retires the 08-03 "facing straight up" complaint properly), and
        // ≈ the static horizon on the flat.  Lightly smoothed so per-frame
        // grade changes can't make the wedge tip jitter.  Nose−24 remains
        // the hard guard; centreline stays the car's own x.
        const _farSy = this.scene?.road?.sampleSurface?.(76000, 0, { allowClipped: true })?.sy;
        const _tipTarget = Math.max(10, Math.min(_noseY - 24, _farSy ?? (horizon + 4)));
        this._fogBeamTipY = (this._fogBeamTipY == null)
          ? _tipTarget
          : this._fogBeamTipY + (_tipTarget - this._fogBeamTipY) * 0.15;
        const _yTop = this._fogBeamTipY;
        const beam = (this.scene?._hasFogLights && _ps) ? {
          x0: _ps.x,                 // centreline of the fan = centre of the car
          y0: _noseY,                // apex: the car's nose (top third)
          yTop: _yTop,               // far end: the road at the lamp's throw
          hwNear: 42,                // narrow end at the car's middle
          hwFar: 150,                // wide end — a proper fan, ~3 car widths
        } : null;
        const BEAM_CLEAR = 0.35;   // beam drops the haze 65% (owner 2026-08-03) — against full-density fog now, not the old pre-thinned 50%
        // Split one full-width haze slice into: full fog left | feather |
        // cleared beam core | feather | full fog right.  Slices at or above
        // the horizon (or with no beam) fall through to the single rect.
        // The wedge exists ONLY between the horizon and the car's nose —
        // above is sky-fog the lamps can't reach, and BELOW the bumper is
        // behind the light source, where clearing painted a bright column
        // trailing off the bottom of the screen in the first cut.
        const sliceFog = (y, h, rgb, a) => {
          if (!beam || y < beam.yTop || y > beam.y0 || a <= 0.002) {
            this.overlay.fillStyle(rgb, a);
            this.overlay.fillRect(-150, y, 1100, h);
            return;
          }
          const bt = Math.min(1, Math.max(0, (beam.y0 - y) / Math.max(1, beam.y0 - beam.yTop)));
          const c  = beam.x0;                          // symmetric about the car
          const hw = beam.hwNear + (beam.hwFar - beam.hwNear) * bt;
          const F  = Math.max(2, hw * 0.30);
          const L  = c - hw, R = c + hw;
          // Base fade: the clearing eases back to FULL fog over the last
          // ~28 px above the bumper, so the wedge grows out of the light
          // source instead of being chopped off at a hard horizontal line.
          const bfT = Math.min(1, (beam.y0 - y) / 28);
          const bf  = bfT * bfT * (3 - 2 * bfT);
          // Graduated long fade, rebalanced (owner 2026-08-14: "still
          // stopping very short") — the old curve dissolved to ZERO
          // clearing near the horizon, so the visible beam died ~2/3 of
          // the way up and never reached the vanishing point.  Full
          // clearing now holds through the first ~65% of the reach, and
          // the dissolve bottoms out at a 0.40 RESIDUAL instead of zero —
          // the beam visibly arrives at the horizon, just softer there
          // than at the nose, and the fog wall above the horizon line
          // still closes over it (no clearing ever paints in sky-fog).
          const ffT = Math.min(1, Math.max(0, (1 - bt) / 0.35));
          const ffS = ffT * ffT * (3 - 2 * ffT);
          const ff  = 0.40 + 0.60 * ffS;
          const mix = (m) => a * (1 - (1 - m) * bf * ff);
          this.overlay.fillStyle(rgb, a);
          this.overlay.fillRect(-150, y, L - F * 2 + 150, h);
          this.overlay.fillRect(R + F * 2, y, 950 - (R + F * 2), h);
          // Two feather bands per side so the wedge edge grades instead of
          // stepping — outer closer to full fog, inner closer to the core.
          this.overlay.fillStyle(rgb, mix(0.76));
          this.overlay.fillRect(L - F * 2, y, F, h);
          this.overlay.fillRect(R + F, y, F, h);
          this.overlay.fillStyle(rgb, mix(0.48));
          this.overlay.fillRect(L - F, y, F, h);
          this.overlay.fillRect(R, y, F, h);
          this.overlay.fillStyle(rgb, mix(BEAM_CLEAR));
          this.overlay.fillRect(L, y, R - L, h);
        };
        // Cap below 1.0 so no slice clamps to fully-opaque — clamping flattens
        // a band of slices to alpha 1.0 and reads as a hard horizontal stripe
        // that "breaks" the fog.  Extra thickness comes from the veil + floor
        // (uniform, no banding), NOT from over-driving this peak.
        const peak    = 0.95 * fi;                 // thicker wall, still a smooth gradient
        // Smooth vertical haze: peak alpha ON the horizon line, easing to
        // nothing UP px above and DN px below.  Drawn as many thin 2px
        // slices with a smootherstep alpha curve and exact, NON-overlapping
        // integer tiling — so adjacent slices differ by ~0.008 alpha and
        // there are NO visible horizontal step lines (the old chunky-band
        // version stepped ~0.07 per band, which read as hard lines).
        const UP = 170, DN = 300, STEP = 2;        // reaches further up the sky + down over the near road
        for (let y = horizon - UP; y < horizon + DN; y += STEP) {
          const dy = y - horizon;
          // distance-from-horizon → 0..1 (thins a touch faster below so the
          // near road stays readable), then smootherstep for a seamless fade.
          const f = dy <= 0 ? 1 - (-dy / UP) : (1 - dy / DN) * 0.85;
          if (f <= 0) continue;
          const s = f * f * f * (f * (f * 6 - 15) + 10);   // smootherstep
          sliceFog(y, STEP, FOG_RGB, peak * s);
        }
        // Overall milkiness so the whole frame sits behind a veil.  Trimmed a
        // touch so the foreground (incl. the player's own car, which only
        // catches this veil) reads a bit sharper; the horizon band still
        // carries the heavy fog ahead.
        // Above the horizon in one rect; below it in slices so the beam
        // wedge clears the veil too — otherwise the wedge would only reach
        // as deep as the horizon band and stop at a visible line.
        this.overlay.fillStyle(0xD2DAE1, 0.19 * fi);
        this.overlay.fillRect(-150, -150, 1100, horizon + 150);
        for (let vy = horizon; vy < 600; vy += 3) {
          sliceFog(vy, 3, 0xD2DAE1, 0.19 * fi);
        }
        // Drifting mist wisps — big soft ellipses sliding across the
        // horizon band at varied speeds / heights / directions so the fog
        // feels volumetric and alive, not a flat sheet.
        const WISPS = 8;
        for (let i = 0; i < WISPS; i++) {
          const dir   = (i % 2) ? -1 : 1;
          const speed = 14 + (i % 4) * 8;
          const phase = (i * 173) % 1100;
          const x     = -150 + (((phase + dir * t * speed) % 1100) + 1100) % 1100;
          const y     = horizon - 30 + ((i * 53) % 78);
          const w     = 220 + (i % 3) * 130;
          const h     = 24  + (i % 3) * 10;
          const a     = (0.12 + 0.06 * ((i * 7) % 3)) * fi;
          this.overlay.fillStyle(0xDBE1E7, a);
          this.overlay.fillEllipse(x, y, w, h);
          this.overlay.fillStyle(0xECF0F4, a * 0.5);
          this.overlay.fillEllipse(x, y, w * 0.55, h * 0.55);
        }
      } else {
        // Not snowing — the pile melts / blows off the glass over a few
        // seconds once you leave the zone.  Reset trackers for re-entry.
        this._wsSnowMile = mile;
        if (this._wsSnowCoverage > 0) this._wsSnowCoverage *= 0.95;
        if (this._wsSnowCoverage < 0.01) this._wsSnowCoverage = 0;
        if (this._wsStuck?.length) {
          for (const f of this._wsStuck) f.a *= 0.95;
          this._wsStuck = this._wsStuck.filter(f => f.a > 0.08);
        }
      }

      // ── Apocalypse combo: red-border flash — REMOVED per user (2026-06-20).
      // Previously a pulsing red (CB: amber + hazard-triangle) screen border
      // when 4+ vices were active above 30%.  Brendan found it intrusive, so
      // the over-stack warning is no longer drawn.  `_comboApocalypse` is still
      // computed (reported in getState) in case a quieter cue is wanted later.
    }

    // ── Vignette (Combo, Coma, Slushie dissociation) ───────────────────
    if (this.vignetteGfx) {
      this.vignetteGfx.clear();

      // Slushie vignette pulses on a 10s cycle: 4s dark / 6s lighter.
      // Base contribution dropped from 0.4 → 0.32 (20% lighter overall);
      // during the "lighter" phase it drops further to 0.13 so the dark
      // doesn't sit on the screen for minutes at a time.
      // Slushie contributes a SUBTLE screen-edge vignette — the heavy
      // dissociation signal is now the TV static layered below this block,
      // so we only need a mild edge-darkening to frame the noise.
      // (Old: slushie × 1.0 with pulse → too dark.  New: slushie × 0.45 max —
      // user wanted the rings 50% darker than the prior 0.30 setting.)
      const slushiePhase  = this.time % 10;
      const slushiePulse  = slushiePhase < 4 ? 1.0 : 0.7;
      const slushieCore   = Math.max(0, slushie - 0.20) * 0.45;
      const slushieVig    = slushieCore * slushiePulse;
      // Track nod cycles for the every-4th full-closure logic below.
      // nodFreq matches the envelope frequency: 0.45 + combo * 0.35.
      {
        const _nodFreq = 0.45 + combo * 0.35;
        const nodCycleIdx = Math.floor(this.time * _nodFreq / (Math.PI * 2));
        if (nodCycleIdx !== this._lastNodCycleIdx) {
          this._lastNodCycleIdx = nodCycleIdx;
          // Every 2nd nod is a "full close" — eyelids slam shut.
          // (Doubled from every-4th per user — full closes hit 50% more
          // often so the visual punctuation is more frequent.)
          this._fullCloseThisCycle = (nodCycleIdx % 2) === 1;
        }
      }
      // Combo no longer contributes to the rectangular ring-vignette —
      // the perimeter blobs below carry the entire Combo look, since
      // the rectangle in the centre of the screen was reading as a UI
      // artifact.  Fent/slushie/coldbrew/tranq still use the ring vignette.
      const coldbrewTunnelBoost = (this._coldbrewRoll === 3) ? 0.25 : 0;
      const tranqBoost    = this._comboTranq ? 0.20 : 0;
      const vigStrength   = clamp(
        coma * 1.8 + slushieVig + coldbrewTunnelBoost + tranqBoost,
        0, 1);
      if (vigStrength > 0.02) {
        this._drawVignette(this.vignetteGfx, vigStrength);
      }

      // Coma tunnel vision — extend past screen edges so a rotated
      // camera (Slushie tilt) doesn't reveal black corners outside.
      if (coma > 0.1) {
        const border = coma * 120;
        this.vignetteGfx.fillStyle(0x000000, coma * 0.85);
        this.vignetteGfx.fillRect(-150, -150, border + 150, 750);
        this.vignetteGfx.fillRect(800 - border, -150, border + 150, 750);
        this.vignetteGfx.fillRect(-150, -150, 1100, border * 0.6 + 150);
        this.vignetteGfx.fillRect(-150, 450 - border * 0.6, 1100, border * 0.6 + 150);
        // Flat coma dim — paints the FULL screen (including the otherwise-
        // clear vignette center) so the world goes visibly dimmer the
        // higher the bar climbs.  User feedback (twice): not dark enough.
        // Now ~0.70 black at coma=1.0, on top of the ring vignette.
        this.vignetteGfx.fillStyle(0x000000, coma * 0.70);
        this.vignetteGfx.fillRect(-150, -150, 1100, 750);
        // Center-only second dim — kills the visible "rectangle outline"
        // where the ring vignette's inner clear band meets the first ring.
        // Without this, the screen has a darker frame around a noticeably
        // brighter center pane.  Painted only inside the clear band
        // (matches _drawVignette's startHalfW=180, startHalfH=95 from
        // center 400,225 → roughly x∈[220,580], y∈[130,320]).
        // Center patch matches the innermost ring's alpha (0.50) so the
        // gradient transitions seamlessly from the clear band into the
        // ring zone — no visible "rectangle outline" boundary.
        this.vignetteGfx.fillStyle(0x000000, coma * 0.50);
        this.vignetteGfx.fillRect(220, 130, 360, 190);

        // Heartbeat (≥ 30%) — vignette-edge swell every beat.  Two-beat
        // lub-dub: primary thump + softer echo.  ~60 bpm (1 Hz primary).
        if (coma > 0.30) {
          const beat   = this.time * Math.PI * 2;
          const lub    = Math.max(0, Math.sin(beat));
          const dub    = Math.max(0, Math.sin(beat - 1.05)) * 0.55;
          const heart  = (lub + dub) * (coma - 0.30) / 0.70;
          const hb = 60 * heart;
          this.vignetteGfx.fillStyle(0x000000, Math.min(1, 0.35 + 0.45 * heart));
          this.vignetteGfx.fillRect(-150, -150, hb + 150, 750);
          this.vignetteGfx.fillRect(800 - hb, -150, hb + 150, 750);
          this.vignetteGfx.fillRect(-150, -150, 1100, hb * 0.6 + 150);
          this.vignetteGfx.fillRect(-150, 450 - hb * 0.6, 1100, hb * 0.6 + 150);
        }

        // Severe darkness (≥ 50%) — additional black wash on top.
        if (coma > 0.50) {
          this.vignetteGfx.fillStyle(0x000000, (coma - 0.50) * 0.30);
          this.vignetteGfx.fillRect(-150, -150, 1100, 750);
        }
      }

      // Combo "tunnel vision" — pulsing translucent grey blobs around
      // the screen perimeter instead of rectangular eyelid bars.  The
      // blobs grow + brighten during each nod, contracting between
      // them so the frame visibly breathes.  Every 4th nod the blobs
      // swell large enough to fully overlap and close the view.
      if (combo > 0.25) {
        const comboIntensity = Math.min(1, (combo - 0.25) / 0.75); // 0..1
        const nod           = this._comboNodAmount ?? 0;
        // Base radius scales with combo level + breathes with the nod.
        // Full-close cycle adds a big extra so the blobs slam shut.
        // Boost bumped from 130 → 195 (50% bigger blobs when fully
        // closing) so the closed state really constricts the view.
        const fullCloseBoost = this._fullCloseThisCycle ? 195 * nod : 0;
        const baseR = 70 + comboIntensity * 35 + nod * 75 + fullCloseBoost;

        // Perimeter blob count per side — top/bottom denser than sides
        // because the screen is wider than tall.
        const NUM_HORIZ = 13;
        const NUM_VERT  = 8;
        const SCR_W     = 800;
        const SCR_H     = 450;

        const drawBlob = (cx, cy, r, color, a) => {
          this.vignetteGfx.fillStyle(color, a);
          this.vignetteGfx.fillCircle(cx, cy, r);
        };

        const drawPerimeterBlob = (cx, cy, idxSeed) => {
          // Per-blob desync — each blob has its own micro-pulse so they
          // don't all expand in lockstep.  ~0.2 amplitude.
          const wobble = 1 + Math.sin(this.time * 1.6 + idxSeed * 1.7) * 0.18;
          const r = baseR * wobble;
          // Two-pass: outer translucent halo + smaller darker core.
          drawBlob(cx, cy, r,        0x1A1A1A, 0.42);
          drawBlob(cx, cy, r * 0.62, 0x2E2E2E, 0.38);
        };

        // Top edge — blobs sit slightly above screen so only their
        // lower halves intrude into the play area.
        for (let i = 0; i < NUM_HORIZ; i++) {
          const fx = (i + 0.5) / NUM_HORIZ;
          const x  = fx * SCR_W;
          drawPerimeterBlob(x, -25, i);
        }
        // Bottom edge.
        for (let i = 0; i < NUM_HORIZ; i++) {
          const fx = (i + 0.5) / NUM_HORIZ;
          const x  = fx * SCR_W;
          drawPerimeterBlob(x, SCR_H + 25, i + 17);
        }
        // Left edge.
        for (let i = 0; i < NUM_VERT; i++) {
          const fy = (i + 0.5) / NUM_VERT;
          const y  = fy * SCR_H;
          drawPerimeterBlob(-25, y, i + 31);
        }
        // Right edge.
        for (let i = 0; i < NUM_VERT; i++) {
          const fy = (i + 0.5) / NUM_VERT;
          const y  = fy * SCR_H;
          drawPerimeterBlob(SCR_W + 25, y, i + 47);
        }

        // EYES SHUT = BLIND.  Nodding off closes your eyes, so black the
        // screen out proportional to the nod on EVERY nod (per user: "how
        // would you see cars if your eyes are closed?").  The nod envelope
        // only climbs high once Combo is real (~0.4+), so light doses still
        // just droop; deep nods slam fully shut.  Full-close cycles go to pure
        // black; regular nods reach near-black at their peak, fading in/out
        // smoothly with the droop so it reads as eyelids, not a hard cut.
        const closeAlpha = (this._fullCloseThisCycle ? 1.30 : 1.05) * Math.pow(nod, 1.3);
        if (closeAlpha > 0.02) {
          this.vignetteGfx.fillStyle(0x000000, Math.min(1, closeAlpha));
          this.vignetteGfx.fillRect(-150, -150, 1100, 750);
        }
      }

      // Slushie TV static — old-CRT "snow" noise that ramps with the
      // bar.  Three bands:
      //    30–85%  → light to moderate snow (count + alpha grow)
      //    85–100% → OVERDRIVE: heavy snow that buries the road, plus
      //              big speck blocks so the screen is genuinely hard
      //              to see through (per user spec).
      if (slushie > 0.30) {
        const t01       = clamp((slushie - 0.30) / 0.70, 0, 1);    // 0 at 30%, 1 at 100%
        const overdrive = clamp((slushie - 0.85) / 0.15, 0, 1);    // 0 below 85%, 1 at 100%
        const COUNT  = Math.floor(150 + 750 * t01 + 2200 * overdrive); // up to ~3000 at peak
        const alpha  = clamp(0.45 + 0.45 * t01 + 0.20 * overdrive, 0, 1);
        const W = 1100, H = 750, X0 = -150, Y0 = -150;
        // Big-block bias grows in the overdrive band so the noise
        // CLUMPS into 4–6 px squares that visually obscure the road.
        const bigBias = overdrive * 0.45;
        for (let i = 0; i < COUNT; i++) {
          const x = X0 + Math.random() * W;
          const y = Y0 + Math.random() * H;
          const v = Math.random();
          const grey = Math.floor(v * 255);
          const col  = (grey << 16) | (grey << 8) | grey;
          // Speck size weighted by overdrive — at peak K, ~half the
          // specks become 4–6 px blocks instead of 1–3 px dots.
          let sz;
          if (Math.random() < bigBias) {
            sz = 4 + Math.floor(Math.random() * 3);             // 4–6 px clumps
          } else {
            sz = v > 0.95 ? 3 : (v > 0.7 ? 2 : 1);
          }
          this.vignetteGfx.fillStyle(col, alpha);
          this.vignetteGfx.fillRect(Math.floor(x), Math.floor(y), sz, sz);
        }
        // Above 85%, paint a few horizontal "roll bars" — wide grey
        // streaks that scroll down each frame.  Sells the dying-CRT vibe.
        if (overdrive > 0.05) {
          const ROLL_BARS = Math.floor(2 + 5 * overdrive);
          for (let i = 0; i < ROLL_BARS; i++) {
            const ry = Y0 + ((this.time * (60 + i * 23) + i * 137) % H);
            const rh = 4 + (i % 3) * 2;
            const rg = 120 + Math.floor(Math.random() * 100);
            const rcol = (rg << 16) | (rg << 8) | rg;
            this.vignetteGfx.fillStyle(rcol, 0.35 + 0.35 * overdrive);
            this.vignetteGfx.fillRect(X0, Math.floor(ry), W, rh);
          }
        }
      }
    }

    // ── Camera Zoom Pulse (burrito / gummies) ────────────────────────────
    // Pulse amplitude bumped — was 0.04 (4% sway, easy to miss).  Now
    // 0.10 base + frequency lifted slightly so the breathing reads as
    // an obvious "world inhaling" rather than a subliminal nudge.
    if (gummies > 0.15 || burrito > 0.3) {
      const zoomBase  = 1 + (gummies * 0.10 + burrito * 0.04);
      const zoomPulse = Math.sin(t * (0.6 + gummies * 0.9))
                      * (gummies * 0.10 + burrito * 0.02);
      camera.setZoom(clamp(zoomBase + zoomPulse, 0.85, 1.30));
    } else {
      const currZoom = camera.zoom;
      if (Math.abs(currZoom - 1) > 0.001) {
        camera.setZoom(lerp(currZoom, 1, 0.05));
      }
    }

    // ── Slushie camera tilt (≥ 40%, capped at 20°) ───────────────────
    // Above 40% the bar drives the camera tilt amplitude.  At 40% →
    // ±0°, 50% → ±5°, …, 80% → ±20° cap (margin around the viewport
    // is 150 px; going harder would reveal black corners).  The tilt
    // OSCILLATES between +amp and -amp instead of holding at +amp so
    // the dissociation reads as the head rolling, not just leaning.
    // Period ~6 s feels woozy without making the player nauseous.
    let targetTiltRad = 0;
    if (slushie >= 0.40) {
      const ampDeg = Math.min(20, (slushie - 0.40) / 0.10 * 5);
      const ampRad = ampDeg * Math.PI / 180;
      // sin(t * ω) gives -1..+1; multiply by amplitude.  Frequency
      // ~0.17 Hz (full +20 → -20 → +20 cycle every ~6 s).
      targetTiltRad = ampRad * Math.sin(this.time * (Math.PI * 2 * 0.17));
    }
    const currentRot = camera.rotation || 0;
    const newRot     = lerp(currentRot, targetTiltRad, 0.08);
    if (Math.abs(newRot - currentRot) > 0.0001) camera.setRotation(newRot);
  }

  _drawVignette(g, strength) {
    // Proper edge-darkening vignette: bright clear ellipse in the centre,
    // progressively darker concentric frame rings extending outward.
    // The OLD implementation paint slices that overlapped at the centre,
    // accidentally inverting the gradient (centre was darkest, edges
    // were lightest) — which is why Slushie "felt pitch black at 70%".
    //
    // Each ring is 4 thin frame strips (top/bottom/left/right) hugging
    // a clear-rect boundary that grows outward.  Outer rings hit fewer
    // strips → less alpha; the screen's outer edges sit inside ALL rings
    // and accumulate the most black.
    const cx = 400, cy = 225;
    // Lots of thin rings = visually smooth gradient (per user request:
    // "make it as smooth of a transition / blend as you can").  Each
    // ring is only a few px wide, so neighbouring alpha steps are too
    // small to read as distinct bands — the eye sees a smooth fade.
    const RINGS = 28;
    // Innermost clear band — the centre stays mostly visible.
    const startHalfW = 180;        // ~45% of screen width clear at minimum
    const startHalfH =  95;
    // Step sizes pick up where the old 7-ring × 60px vignette left off:
    // 28 × 15 = 420 horizontal extension matches the old 7 × 60 = 420.
    const stepHalfW  =  15;
    const stepHalfH  =  10;
    // Per-ring alpha — graduated from 0.50 (innermost) to 0.80 (outermost)
    // at full strength.  With 28 rings the per-step delta is ~0.011, so
    // the whole vignette reads as a smooth blend instead of discrete rings.
    if (strength < 0.05) return;
    const RING_INNER_ALPHA = 0.50;
    const RING_OUTER_ALPHA = 0.80;
    const ringStep = (RING_OUTER_ALPHA - RING_INNER_ALPHA) / Math.max(1, RINGS - 1);
    for (let r = 0; r < RINGS; r++) {
      const ringAlpha = strength * (RING_INNER_ALPHA + r * ringStep);
      g.fillStyle(0x000000, Math.min(1, ringAlpha));
      const innerHalfW = startHalfW + r * stepHalfW;
      const innerHalfH = startHalfH + r * stepHalfH;
      const outerHalfW = innerHalfW + stepHalfW;
      const outerHalfH = innerHalfH + stepHalfH;
      // Top strip — between (cy - outerHalfH) and (cy - innerHalfH),
      // spanning the full outer width.
      const topY    = cy - outerHalfH;
      const botY    = cy + innerHalfH;
      const leftX   = cx - outerHalfW;
      const stripeH = stepHalfH;
      const fullW   = outerHalfW * 2;
      const stripeW = stepHalfW;
      const innerH  = innerHalfH * 2;
      g.fillRect(leftX,           topY,                fullW,   stripeH);   // top strip
      g.fillRect(leftX,           botY,                fullW,   stripeH);   // bottom strip
      g.fillRect(leftX,           cy - innerHalfH,     stripeW, innerH);    // left strip
      g.fillRect(cx + innerHalfW, cy - innerHalfH,     stripeW, innerH);    // right strip
    }
    // Final outer "bleed" — paint solid black BEYOND the last ring out
    // to the painted-margin edge, so the corners get the maximum
    // darkening.  Slightly darker than the outermost ring (0.85 vs 0.80).
    const lastHalfW = startHalfW + RINGS * stepHalfW;
    const lastHalfH = startHalfH + RINGS * stepHalfH;
    g.fillStyle(0x000000, Math.min(1, strength * 0.85));
    // Top bleed
    g.fillRect(-150, -150, 1100, (cy - lastHalfH) - (-150));
    // Bottom bleed
    g.fillRect(-150, cy + lastHalfH, 1100, 600 - (cy + lastHalfH));
    // Left bleed
    g.fillRect(-150, cy - lastHalfH, (cx - lastHalfW) - (-150), lastHalfH * 2);
    // Right bleed
    g.fillRect(cx + lastHalfW, cy - lastHalfH, 950 - (cx + lastHalfW), lastHalfH * 2);
  }

  triggerShake(durationMs, intensity) {
    if (this.scene && this.scene.cameras) {
      this.scene.cameras.main.shake(durationMs, intensity);
    }
  }

  /** Physics modifiers returned as plain object for Player to read */
  getPhysics(vices) {
    const sushi   = vices.get(VICES.SUSHI);
    const burrito  = vices.get(VICES.BURRITO);
    const energy  = vices.get(VICES.ENERGY);
    const gummies = vices.get(VICES.GUMMIES);
    const hotdog   = vices.get(VICES.HOTDOG);
    const combo  = vices.get(VICES.COMBO);
    const coma  = vices.get(VICES.COMA);
    const slushie   = vices.get(VICES.SLUSHIE);
    const coldbrew    = vices.get(VICES.COLDBREW);
    const caffeine  = vices.get(VICES.CAFFEINE);

    const t = this.time;

    // Energy burns off some of Sushi's debuffs
    const sushiEnergyNet = Math.max(0, sushi - energy * 0.55);
    // Effective Sushi for STEER DRIFT only — the first hit (0.07) shouldn't
    // feel impaired.  Deadzone of 0.10 means drift kicks in around the 2nd
    // hit (0.14 → effective 0.04).  Overall magnitude reduced by ⅓
    // vs the pre-deadzone baseline (rescale 1/0.90 × 2/3 ≈ 0.741) so even
    // a full bar drifts gentler than before.
    const sushiDriftAmt = Math.max(0, sushiEnergyNet - 0.10) * (1 / 0.90) * (2 / 3);

    // Burrito only slows the car when it's the ONLY vice active
    const burritoAlone  = burrito > 0.05
      && sushi < 0.05 && energy < 0.05 && combo < 0.05 && coma < 0.05
      && gummies < 0.05 && hotdog < 0.05 && coldbrew < 0.05 && slushie < 0.05 && caffeine < 0.05;
    const burritoSpeedPenalty = burritoAlone ? burrito * 0.22 : 0;
    const burritoTimePenalty  = burritoAlone ? burrito * 0.18 : 0;

    // Coma: -10 mph per 10 % of bar (per spec).  Top speed reads
    // 120 mph at multiplier 1.0, so each 10 % coma should drop the
    // multiplier by ~0.083 (10/120).  Applied as a smooth proportional
    // subtraction — no hard cap.
    // Caffeine's AND energy's speed effects live ENTIRELY in ViceSystem
    // (getCaffeineSpeedBonusMPH / getEnergySpeedBonusMPH) as flat, visible
    // mph bonuses now — each used to ALSO add a percentage term here, which
    // double-counted the same pickup through two different, disagreeing
    // mechanisms (one visible, one an invisible bar-level multiplier the
    // player had no way to see or reason about; energy's ×1.55 was the
    // source of the "top speed climbed 150→177 with no pickup" mystery).
    // Only speed PENALTIES remain percentage-based here.
    const baseSpeedMult = clamp(
      1 - combo * 0.5
        - coma * (10 / 12)              // -10 mph per 10 % coma (from 120 mph cap)
        - burritoSpeedPenalty
        - slushie  * 0.35
        - coldbrew   * 0.15,
      0.1, 1.8
    );
    let _speedMult = baseSpeedMult;
    // Tranq combo (combo + slushie): final speed × 0.85.
    if (this._comboTranq) _speedMult *= 0.85;
    // Speedball combo (energy + combo): energy pulse fights Combo nod —
    // brief speed boost at nod TROUGH (when nodAmount low), no boost at
    // peak.  Drives the "fighting" sensation.
    if (this._comboSpeedball) {
      const _nod = this._comboNodAmount ?? 0;
      _speedMult += 0.25 * energy * (1 - _nod);
    }
    const speedMult = _speedMult;

    return {
      speedMult,
      // Raw contributions behind speedMult, for the F5 speed debugger — so
      // "why is speedMult 1.55" is answerable on-screen instead of grepping
      // this file.  Mirrors the terms above exactly (deltas, not vice
      // levels) so it can't drift from the real computation.
      speedMultParts: {
        combo: -combo * 0.5, coma: -coma * (10 / 12),
        burrito: -burritoSpeedPenalty, slushie: -slushie * 0.35, coldbrew: -coldbrew * 0.15,
        comboTranq: this._comboTranq ? -baseSpeedMult * 0.15 : 0,
        comboSpeedball: this._comboSpeedball
          ? 0.25 * energy * (1 - (this._comboNodAmount ?? 0)) : 0,
        clamped: baseSpeedMult <= 0.1 || baseSpeedMult >= 1.8,
      },

      // Energy bumped from +0.2 → +0.45 (sharper, brittle precision).
      steerSensitivity: clamp(
        1 - sushiEnergyNet * 0.4
          - combo * 0.6
          - coma * 0.8
          - slushie  * 0.5
          + energy * 0.45
          + caffeine * 0.35,
        0.1, 1.7
      ),

      // Snow-Cone (sushi + energy) suppresses Sushi's swerve 50% but adds
      // a high-freq tremor.  Cold Brew jitter roll bumps swerve too.
      steerDrift: (
          Math.sin(t * 2.1 + 0.5) * sushiDriftAmt * 0.80
            * (this._comboSnowCone ? 0.5 : 1.0)
        + Math.sin(t * 0.7 + 1.2) * combo  * 0.3
        + Math.sin(t * 3.2 + 0.9) * coma  * 0.4
        + Math.sin(t * 1.5 + 2.1) * slushie   * 0.25
        + Math.sin(t * 12.0 + 0.3) * caffeine * 0.55
        + Math.sin(t * 17.5 + 1.7) * caffeine * 0.35
        + (this._comboSnowCone ? Math.sin(t * 8) * 0.2 * sushi * energy : 0)
        + ((this._coldbrewRoll === 2) ? Math.sin(t * 9) * 0.4 * coldbrew : 0)
      ),

      // Gummies back at 0.005 (user wanted the higher road sway restored).
      // Snow-Cone suppresses Sushi curve; Psychedelic combo boosts
      // gummies 2x.
      extraCurve: Math.sin(t * 1.8) * sushiEnergyNet * 0.003
                    * (this._comboSnowCone ? 0.5 : 1.0)
                + Math.sin(t * 0.6) * gummies * 0.005
                    * (this._comboPsychedelic ? 2.0 : 1.0)
                + Math.sin(t * 9.0) * caffeine    * 0.004,

      invertSteering: hotdog > 0.72,

      dtMultiplier: clamp(1 - burritoTimePenalty - combo * 0.4, 0.3, 1.2),

      // ── Combo sedation (slushie also lags input, layered) ─────────
      nodAmount:       this._comboNodAmount ?? 0,
      inputLag:        combo * 0.45 + slushie * 0.30,
      steerReturnSlow: combo * 0.50 + slushie * 0.25,
      microsleep: (combo >= 0.65 && (this._comboNodAmount ?? 0) > 0.85),

      // ── Sushi overcorrection ─────────────────────────────────
      // After releasing input, steerVelocity holds in last direction
      // briefly — an overshoot feel.  Drives a snow-slip-style
      // holdover branch in _updatePlayer.  Uses the deadzoned sushiDriftAmt
      // and a reduced 0.30 scale so a heavy dose's drift isn't catastrophic.
      sushiHoldover: sushiDriftAmt * 0.30,

      // ── Energy wired ──────────────────────────────────────────
      cameraTremor:   energy * 1.5,           // tiny per-frame shake amplitude
      energyStarMul: 1 + energy * 0.5,       // CopSystem.addStar multiplier

      // ── Caffeine + Hot Dog HUD flicker (additive) ──────────────────────
      hudFlicker: (caffeine > 0.5 ? (caffeine - 0.5) * 0.20 : 0)
                + (hotdog  > 0.5 ? (hotdog  - 0.5) * 0.15 : 0),

      // ── Burrito cushion ───────────────────────────────────────────
      accelMul:           burritoAlone ? 1 - burrito * 0.30 : 1,
      collisionShakeDamp: burrito * 0.5,

      // ── Coma HUD fade ──────────────────────────────────────
      hudAlphaMul: 1 - coma * 0.45,

      // ── Slushie retinal drift (px lateral on tire shadow) ────
      slushieRetinalDrift: slushie * 4,

      // ── Gummies world-breathing (consumer not yet wired) ───────
      worldBreathing: gummies * 0.04,

      // ── Cold Brew roulette (only the active roll's field is non-zero) ─
      // _coldbrewRoll: 0=focus 1=drowsy 2=jitter 3=tunnel 4=traffic-boost
      coldbrewFocus:        (this._coldbrewRoll === 0) ? 0.15                          : 0,
      coldbrewLag:          (this._coldbrewRoll === 1) ? 0.10                          : 0,
      coldbrewJitter:       (this._coldbrewRoll === 2) ? Math.sin(t * 9) * 0.4 * coldbrew    : 0,
      coldbrewTunnel:       (this._coldbrewRoll === 3) ? 0.25                          : 0,
      coldbrewTrafficBoost: (this._coldbrewRoll === 4) ? 1.5                           : 1.0,

      // ── Combo flags ────────────────────────────────────────────
      comboSnowCone:    !!this._comboSnowCone,
      comboTranq:       !!this._comboTranq,
      comboPsychedelic: !!this._comboPsychedelic,
      comboSpeedball:   !!this._comboSpeedball,
      comboApocalypse:  !!this._comboApocalypse,
    };
  }
}
