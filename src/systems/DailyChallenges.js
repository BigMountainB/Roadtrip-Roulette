// DailyChallenges.js — "Run of the Day" registry + pure helpers.
//
// This module is DATA + PURE FUNCTIONS only.  GameScene interprets each
// challenge's `objective` (detection) and applies its `mods` (the dailyStage
// config — all gated behind daily-stage mode so normal/custom runs are
// untouched).  Full design spec: PROJECT_OVERVIEW.md §8 (2026-06-06 entry).
//
// Reward economy (locked): unlimited tries; payout decays $1k per attempt from
// $5k, floored at $0 (try 6+ still completes).  Complete all 5 weekday dailies
// → +$5k weekly bonus.  Per-profile.  Even $0 completions count toward weekly.

import { VICES } from '../constants.js';

export const DAILY_BASE_REWARD = 5000;
export const DAILY_REWARD_STEP = 1000;
export const DAILY_WEEKLY_BONUS = 5000;

/** Payout for completing on attempt N (1-based): max(0, 5000 − 1000·(N−1)). */
export function rewardForAttempt(attempt) {
  const n = Math.max(1, attempt | 0);
  return Math.max(0, DAILY_BASE_REWARD - DAILY_REWARD_STEP * (n - 1));
}

// ── Challenge pool ────────────────────────────────────────────────────
// Each entry:
//   id, name, blurb       — display
//   from, to              — CHECKPOINT names (start city → end city); the
//                           stage spawns at `from` and completes at `to`
//   group                 — 1 (build first) | 2 (the rest)
//   mods                  — dailyStage spawn overrides (null-safe in GameScene):
//                           onlyODVices, pickupDensityMult, npcDensityMult,
//                           startViceLevels{id:0..1}, startingStars, startHP,
//                           trapCount, trapsRotate
//   objective             — detection spec interpreted by GameScene:
//                           { type, ...params }
export const DAILY_CHALLENGES = [
  // ── Build Group 1 ───────────────────────────────────────────────────
  {
    id: 'threshold', name: 'Threshold', group: 1,
    from: 'Cle Elum', to: 'Ellensburg',
    blurb: "Push a vice to the edge — and don't fall off.",
    mods: { onlyODVices: true },
    objective: { type: 'peak_vice', threshold: 0.90, noOD: true },
  },
  {
    id: 'comedown', name: 'Sober by the Line', group: 1,
    from: 'Issaquah', to: 'North Bend',
    blurb: 'You start lit. Roll in stone-cold sober.',
    mods: { startViceLevels: { [VICES.SUSHI]: 0.95 } },
    objective: { type: 'all_meters_zero_at_end' },
  },
  {
    id: 'cocktail', name: 'Cocktail', group: 1,
    from: 'Othello', to: 'Hatton',
    blurb: 'Keep a two-vice combo lit the whole way.',
    mods: { pickupDensityMult: 1.3 },
    objective: { type: 'combo_whole_segment' },
  },
  {
    id: 'bumper', name: 'Bumper Cars', group: 1,
    from: 'Bellevue', to: 'Issaquah',
    blurb: 'Total 15 cars. Arrive alive.',
    mods: { npcDensityMult: 2.0 },
    objective: { type: 'hit_cars', count: 15, surviveToEnd: true },
  },

  // ── Build Group 2 ───────────────────────────────────────────────────
  {
    id: 'ghost', name: 'Ghost', group: 2,
    from: 'Ellensburg', to: 'Vantage',
    blurb: 'Slip through — never let them put a star on you.',
    mods: { trapCount: 3, trapsRotate: true },
    objective: { type: 'never_starred' },
  },
  {
    id: 'outrun', name: 'Outrun', group: 2,
    from: 'West Seattle', to: 'Mercer Island',
    blurb: 'Start at five stars. Survive two cities.',
    mods: { startingStars: 5 },
    objective: { type: 'survive_cities', cities: 2 },
  },
  {
    id: 'lovers_quarrel', name: "Lover's Quarrel", group: 2,
    from: 'Seattle', to: 'Snoqualmie',
    blurb: 'Ghost the Crush for 3 stops, then win them back with 2 texts.',
    mods: {},
    objective: { type: 'crush_quarrel', ignoreStops: 3, winbackTexts: 2 },
  },
  {
    id: 'crosswind', name: 'Crosswind Crucible', group: 2,
    from: 'Vantage', to: 'Royal City',
    blurb: 'Hold your lane through the gusts — no scrapes, no shoulder.',
    mods: {},
    objective: { type: 'no_barrier_scrape', noOffroad: true },
  },

  // ── Trophy-derived (scoped to short stages) ─────────────────────────
  {
    id: 'teetotaler', name: 'Teetotaler', group: 2,
    from: 'La Crosse', to: 'Colfax',
    blurb: 'Reach the end without touching a thing.',
    mods: {}, objective: { type: 'no_vices' },
  },
  {
    id: 'defensive', name: 'Defensive Driver', group: 2,
    from: 'Hatton', to: 'Washtucna',
    blurb: 'Not a scratch — zero cars hit.',
    mods: {}, objective: { type: 'no_collisions' },
  },
  {
    id: 'collector', name: 'Collector', group: 2,
    from: 'Snoqualmie Pass', to: 'Cle Elum',
    blurb: 'Grab one of everything on offer.',
    mods: { pickupDensityMult: 0.8 }, objective: { type: 'all_available_vices' },
  },
  {
    id: 'purist', name: 'Purist', group: 2,
    from: 'Royal City', to: 'Othello',
    blurb: 'One vice — and at least five of it. Nothing else.',
    mods: { pickupDensityMult: 1.3 }, objective: { type: 'one_vice_only', minCount: 5 },
  },
  {
    id: 'most_wanted', name: 'Most Wanted', group: 2,
    from: 'Washtucna', to: 'La Crosse',
    blurb: 'Get the whole department after you — hit 5★.',
    mods: {}, objective: { type: 'reach_stars', stars: 5 },
  },
  {
    id: 'cop_killer', name: 'Cop Killer', group: 2,
    from: 'Colfax', to: 'Pullman',
    blurb: 'Take down five cruisers.',
    mods: { startingStars: 4 }, objective: { type: 'kill_cops', count: 5 },
  },
];

const _byId = Object.fromEntries(DAILY_CHALLENGES.map(c => [c.id, c]));
export function challengeById(id) { return _byId[id] ?? null; }

// ── Date helpers — weekday rotation (Mon–Fri); weekends have no daily ──
function _epochDay(d) {
  // Local-day index (offset-corrected) so the daily flips at local midnight.
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/** 'YYYY-MM-DD' for a date (local). */
export function dateKey(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** The challenge for a given date, or null on weekends.  Deterministic. */
export function challengeForDate(d = new Date()) {
  const dow = d.getDay();            // 0 Sun … 6 Sat
  if (dow === 0 || dow === 6) return null;
  return DAILY_CHALLENGES[_epochDay(d) % DAILY_CHALLENGES.length];
}

/** Monday's dateKey for the week containing `d` (the weekly-bonus key). */
export function weekKey(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // days since Monday
  return dateKey(monday);
}

/** The 5 weekday entries [{ dateKey, challenge }] of the week containing `d`. */
export function weekDailies(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const out = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    out.push({ dateKey: dateKey(day), challenge: challengeForDate(day) });
  }
  return out;
}

/** Build the GameScene `dailyStage` config object from a challenge.  This is
 *  what gets passed as `scene.start('Game', { dailyStage })`. */
export function stageConfigFor(challenge) {
  if (!challenge) return null;
  return {
    id:        challenge.id,
    startCity: challenge.from,
    endCity:   challenge.to,
    objective: challenge.objective,
    ...challenge.mods,
  };
}
