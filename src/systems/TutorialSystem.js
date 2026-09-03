// ── Contextual tutorial registry ──────────────────────────────────────────
//
// Replaces the three linear tours (portrait phone tour in index.html, the
// title-screen walk, and the paused HUD tour) as the SOURCE OF TRUTH for what
// can be explained. The tours may keep running for a while; this is the
// registry they and the new Tutorial Mode read from.
//
// STABLE IDS, NEVER INDICES
// Progress is stored as `{ [id]: true }`. Reordering, inserting or removing
// entries can never mark the wrong thing read. IDs are `<category>.<element>`
// — `gameplay.hp`, `phone.garage`, `game_menu.plates` — and the element part
// matches the key the live-bounds resolvers already use (GameScene's
// `_hudElementBounds`, the phone's `qhit(name)`), so an entry finds its own
// UI object with no lookup table in between.
//
// NO PHASER, NO DOM
// Plain data + plain functions. The scenes supply bounds; this module supplies
// what to say and whether it has been said. Testable headlessly.
//
// ROAD SCHOLAR
// 100% of the entries that APPLY to this player. `applies(ctx)` lets an entry
// opt out (platform-only, feature-locked); those never sit in the denominator,
// so completion is always reachable. Once earned it is never revoked — see
// `checkRoadScholar()`: it returns false whenever the achievement is already
// in the save, so it is a latch, not a live recomputation, and adding entries
// later cannot take it away.

export const CATEGORY = {
  PHONE:     'phone',
  GAME_MENU: 'game_menu',
  GAMEPLAY:  'gameplay',
};

export const CATEGORY_LABEL = {
  phone:     'iPhone',
  game_menu: 'Game Menu',
  gameplay:  'In Game',
};

/**
 * Every explainable element. Copy follows the audit format — Title / one
 * sentence on what it is / optional second on how to use it — and every entry
 * was checked against the code on 2026-09-03 (`audited: true`). Where the OLD
 * copy made a claim the code did not confirm, the claim was dropped from the
 * text and preserved as `review:` for the owner; grep for it.
 *
 * `counts` (default true): whether the entry is part of Road Scholar.
 * `applies(ctx)` (optional): return false to hide the entry AND drop it from
 *   the denominator for this player. ctx = { platform, custom, ... }.
 */
export const TUTORIAL_ENTRIES = [
  // ── PHONE (portrait menu) ── element = the phone hotspot name (`qhit`) ──
  { id: 'phone.garage',      cat: 'phone', el: 'garage',      title: 'Garage',
    desc: 'Buy upgrades for your car with the cash you earn.', audited: true },
  { id: 'phone.maps',        cat: 'phone', el: 'maps',        title: 'Maps',
    desc: 'Shows the rest stops along your route. In Custom mode you can also teleport to them.', audited: true },
  { id: 'phone.calendar',    cat: 'phone', el: 'calendar',    title: 'Calendar',
    desc: 'Daily tasks and your current missions. Complete them for cash bonuses.', audited: true },
  { id: 'phone.trophy',      cat: 'phone', el: 'trophy',      title: 'Trophies',
    desc: 'Your achievements and collections.', audited: true },
  { id: 'phone.stats',       cat: 'phone', el: 'stats',       title: 'Stats',
    desc: 'Miles driven, items collected, fastest trip, and more.', audited: true },
  { id: 'phone.messages',    cat: 'phone', el: 'messages',    title: 'Messages',
    desc: 'Texts from the people you meet on the road. A good friendship can pay off later.', audited: true },
  { id: 'phone.startover',   cat: 'phone', el: 'startover',   title: 'Start Over',
    desc: 'Restarts your trip from the beginning. Tilt the phone upright any time to pause and save.', audited: true },
  { id: 'phone.leaderboard', cat: 'phone', el: 'leaderboard', title: 'Leaderboard',
    desc: 'Compare your runs with friends and the world.', audited: true },
  { id: 'phone.settings',    cat: 'phone', el: 'settings',    title: 'Settings',
    desc: 'Options for sound, controls, and display. Under Gameplay, tap Edit to move and resize your on-screen controls.', audited: true },
  { id: 'phone.addiction',   cat: 'phone', el: 'addiction',   title: 'Help & Support',
    desc: 'Resources if the game hits close to home.', audited: true },
  { id: 'phone.music',       cat: 'phone', el: 'music',       title: 'Music',
    desc: "Choose your genre — each has its own car and item art. Tap a genre's ☆ to make it your default.", audited: true },

  // ── GAME MENU (title screen) ── element = a resolver key, not a rect ────
  { id: 'game_menu.plates',  cat: 'game_menu', el: 'plates',  title: 'Plates',
    desc: 'Your saved games, one per license plate. Pick a state and customize your plate.', audited: true },
  { id: 'game_menu.diff',    cat: 'game_menu', el: 'diff',    title: 'Difficulty',
    desc: 'Easy, Normal, or Hard. Tap to cycle.', audited: true, review: 'Old copy said Custom unlocks after completing the drive; no such gate found in code.' },
  { id: 'game_menu.drive',   cat: 'game_menu', el: 'drive',   title: 'Driving Type',
    desc: 'How you steer: Default, Thumbs, Tap, or Tilt. Tap to cycle.', audited: true },
  { id: 'game_menu.load',    cat: 'game_menu', el: 'load',    title: 'Load / Save',
    desc: 'Resumes your most recent saved run.', audited: true },
  { id: 'game_menu.start',   cat: 'game_menu', el: 'start',   title: 'Start',
    desc: 'Begins the drive.', audited: true },

  // ── IN GAME (HUD) ── element = GameScene._hudElementBounds key ──────────
  { id: 'gameplay.pedalGas',   cat: 'gameplay', el: 'pedalGas',   title: 'Gas Pedal',
    desc: 'Holds the car at boost speed while pressed. Tap on, tap off.', audited: true, review: "Old copy said '+20 mph'; boost is a per-car base × traits, not a fixed bump." },
  { id: 'gameplay.pedalBrake', cat: 'gameplay', el: 'pedalBrake', title: 'Brake',
    desc: 'Drops the car to 60 mph while pressed — handy at speed traps.', audited: true, review: "Old copy said 'under 100 mph you're losing money'; the cash bonus actually gates at 15% above the car's cruise baseline." },
  { id: 'gameplay.speed',      cat: 'gameplay', el: 'speed',      title: 'Speed',
    desc: "How fast you're going. Push well past your cruise speed for a cash bonus.", audited: true },
  { id: 'gameplay.hp',         cat: 'gameplay', el: 'hp',         title: 'Health',
    desc: "Your car's health — crashes, sideswipes, and cop rams chip it down, and at zero the trip is over. Repair at rest stops.", audited: true, review: 'Old copy said Food & Drink add health on Easy; no heal path found in code.' },
  { id: 'gameplay.engine',     cat: 'gameplay', el: 'engine',     title: 'Engine Temp',
    desc: 'Redline too long and the engine overheats. Ease off, or buy oil at a gas station.', audited: true },
  { id: 'gameplay.gas',        cat: 'gameplay', el: 'gas',        title: 'Fuel',
    desc: 'Your tank, F to E. Fill up at a gas station before you run dry.', audited: true },
  { id: 'gameplay.survB',      cat: 'gameplay', el: 'survB',      title: 'Drinks & Food',
    desc: 'Blue is drinks, orange is food — grab matching items off the road. Keep each near the middle; too empty or too full both hurt.', audited: true },
  { id: 'gameplay.survA',      cat: 'gameplay', el: 'survA',      title: 'Alertness & Bladder',
    desc: 'Let Alertness drain and you nod off; let Bladder fill and you swerve. Empty it at a rest stop.', audited: true },
  { id: 'gameplay.score',      cat: 'gameplay', el: 'score',      title: 'Cash',
    desc: "What you've earned driving, grabbing pickups, and clearing missions. Spend it on gas, repairs, upgrades, and rides.", audited: true },
  { id: 'gameplay.mult',       cat: 'gameplay', el: 'mult',       title: 'Multiplier',
    desc: 'Drinks and Food in the sweet spot, staying Alert, and an empty Bladder each add +1, and wanted stars stack on top.', audited: true },
  { id: 'gameplay.dist',       cat: 'gameplay', el: 'dist',       title: 'Miles',
    desc: "How far you've driven of the 293 to Pullman.", audited: true },
  { id: 'gameplay.region',     cat: 'gameplay', el: 'region',     title: 'Town',
    desc: 'Where you are right now. Each town has its own scenery and rest stops.', audited: true },
  { id: 'gameplay.stars',      cat: 'gameplay', el: 'stars',      title: 'Wanted Level',
    desc: 'Drive reckless near cops and it climbs; the higher it is, the harder they chase. Crossing a town line sheds one star, but not at 4★ or above.', audited: true },
  { id: 'gameplay.radio',      cat: 'gameplay', el: 'radio',      title: 'Now Playing',
    desc: "The station you're listening to.", audited: true },
  { id: 'gameplay.weapons',    cat: 'gameplay', el: 'weapons',    title: 'Stash',
    desc: 'Rolling coal, fireworks, and donuts — grab them off the road, three of each at most. Deploy one to shake the cops.', audited: true },
  { id: 'gameplay.btn_map',    cat: 'gameplay', el: 'btn_map',    title: 'Map',
    desc: 'Rest stops ahead on your route. Fast-travel in Custom mode.', audited: true },
  { id: 'gameplay.btn_genre',  cat: 'gameplay', el: 'btn_genre',  title: 'Genre',
    desc: 'Switches to the next station. Each genre has its own car and item art.', audited: true },
  { id: 'gameplay.btn_mute',   cat: 'gameplay', el: 'btn_mute',   title: 'Mute',
    desc: 'Mutes or unmutes the game.', audited: true },
  { id: 'gameplay.btn_ff',     cat: 'gameplay', el: 'btn_ff',     title: 'Skip Track',
    desc: 'Skips to the next song.', audited: true },
  { id: 'gameplay.wiper',      cat: 'gameplay', el: 'wiper',      title: 'Wipers',
    desc: 'Clear rain and snow off the windshield.', audited: true },
  { id: 'gameplay.popup',      cat: 'gameplay', el: 'popup',      title: 'Alerts',
    desc: 'Pickup and text-message alerts appear here.', audited: true },
  { id: 'gameplay.hpDamage',   cat: 'gameplay', el: 'hpDamage',   title: 'Damage Taken',
    desc: 'The HP you just lost flashes here.', audited: true },
  { id: 'gameplay.rearCop',    cat: 'gameplay', el: 'rearCop',    title: 'Cop Warning',
    desc: 'Shows when a cop is on your tail.', audited: true },
  { id: 'gameplay.btn_pause',  cat: 'gameplay', el: 'btn_pause',  title: 'Pause',
    desc: 'Pauses the game.', audited: true },
];

const BY_ID = new Map(TUTORIAL_ENTRIES.map(e => [e.id, e]));
export const entry = (id) => BY_ID.get(id) ?? null;

/** Entries visible to this player, optionally one category. */
export function entriesFor(ctx = {}, cat = null) {
  return TUTORIAL_ENTRIES.filter(e =>
    (!cat || e.cat === cat) && (typeof e.applies !== 'function' || e.applies(ctx)));
}

/**
 * Per-player read state. `store` is anything with get(key, default) / set(key,
 * value) — the game's SaveSystem — and the state lives under ONE key as an
 * id→true map. Held per plate, like every other progression value.
 */
export const SAVE_KEY = 'tutorialRead';
const ACH_KEY = 'road_scholar';

/** Per-button first-selection flags — one pulse life per Tutorial button.
 *  Keyed by button ('phone' | 'game_menu' | 'gameplay'), stored as one map so a
 *  future fourth button needs no save migration. Separate from the read map:
 *  these are about the "?" buttons themselves, not the entries. */
export const BTN_SEEN_KEY = 'tutorialBtnSeen';
export const TUT_BUTTONS = ['phone', 'game_menu', 'gameplay'];
export function btnSeen(store, which) {
  const m = store?.get?.(BTN_SEEN_KEY, null);
  return !!(m && typeof m === 'object' && m[which]);
}
export function setBtnSeen(store, which) {
  if (!store || !TUT_BUTTONS.includes(which)) return false;
  const cur = store.get(BTN_SEEN_KEY, null);
  const m = (cur && typeof cur === 'object') ? { ...cur } : {};
  if (m[which]) return false;
  m[which] = true;
  store.set(BTN_SEEN_KEY, m);
  return true;
}

export function readState(store) {
  const v = store?.get?.(SAVE_KEY, null);
  return (v && typeof v === 'object') ? v : {};
}

export function isRead(store, id) { return readState(store)[id] === true; }

/** Mark read. Returns true if this call changed anything. */
export function markRead(store, id) {
  if (!BY_ID.has(id)) return false;
  const st = readState(store);
  if (st[id] === true) return false;
  st[id] = true;
  store.set(SAVE_KEY, st);
  return true;
}

/** Progress for the hub: per category and overall, counting only entries
 *  that apply to this player and count toward completion. */
export function progress(store, ctx = {}) {
  const st = readState(store);
  const out = { byCat: {}, read: 0, total: 0 };
  for (const cat of Object.values(CATEGORY)) {
    const list = entriesFor(ctx, cat).filter(e => e.counts !== false);
    const read = list.filter(e => st[e.id] === true).length;
    out.byCat[cat] = { read, total: list.length };
    out.read += read; out.total += list.length;
  }
  return out;
}

/** True when every applicable, counting entry has been read. */
export function complete(store, ctx = {}) {
  const p = progress(store, ctx);
  return p.total > 0 && p.read === p.total;
}

/** Road Scholar is LATCHED: once in the achievements map it stays, so a
 *  future entry cannot un-earn it. Returns true only on the transition. */
export function checkRoadScholar(store, ctx = {}) {
  if (!store?.get) return false;
  const owned = store.get('achievements', null) ?? {};
  if (owned[ACH_KEY]) return false;
  if (!complete(store, ctx)) return false;
  return true;   // caller awards through AchievementSystem so the toast fires
}
export const ROAD_SCHOLAR_ID = ACH_KEY;
