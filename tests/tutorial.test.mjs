// ── Contextual tutorial registry ───────────────────────────────────────────
// Headless: TutorialSystem is plain data + functions, so a fake store stands
// in for SaveSystem and no scene is constructed.

import {
  TUTORIAL_ENTRIES, CATEGORY, entry, entriesFor, readState, isRead, markRead,
  progress, complete, checkRoadScholar, SAVE_KEY, ROAD_SCHOLAR_ID,
  btnSeen, setBtnSeen, BTN_SEEN_KEY, TUT_BUTTONS,
} from '../src/systems/TutorialSystem.js';

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log(`  ✗ FAIL: ${name}`); } };

/** Minimal SaveSystem stand-in: get(key, default) / set(key, value). */
const mkStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { get: (k, d = undefined) => (m.has(k) ? m.get(k) : d), set: (k, v) => m.set(k, v), _m: m };
};

// ── Registry shape ────────────────────────────────────────────────────────
{
  check('39 entries (11 phone + 5 game menu + 23 in game)', TUTORIAL_ENTRIES.length === 39);
  const ids = TUTORIAL_ENTRIES.map(e => e.id);
  check('every id is unique', new Set(ids).size === ids.length);
  check('every id is <category>.<element>', ids.every(id => /^(phone|game_menu|gameplay)\.[A-Za-z_]+$/.test(id)));
  check('every entry has title + desc', TUTORIAL_ENTRIES.every(e => e.title && e.desc));
  check('category counts', entriesFor({}, CATEGORY.PHONE).length === 11
                         && entriesFor({}, CATEGORY.GAME_MENU).length === 5
                         && entriesFor({}, CATEGORY.GAMEPLAY).length === 23);
  // The element key must match what the live resolvers use — the HUD tour's
  // own step ids are the ground truth for gameplay.
  const hudIds = ['pedalGas','pedalBrake','speed','hp','engine','gas','survB','survA','score','mult',
                  'dist','region','stars','radio','weapons','btn_map','btn_genre',
                  'btn_mute','btn_ff','wiper','popup','hpDamage','btn_pause'];
  check('gameplay element keys match _hudElementBounds keys',
        hudIds.every(k => entry('gameplay.' + k)?.el === k));
}

// ── Read / unread persistence, keyed by id ────────────────────────────────
{
  const s = mkStore();
  check('fresh store: nothing read', Object.keys(readState(s)).length === 0 && !isRead(s, 'gameplay.hp'));
  check('markRead returns true on change', markRead(s, 'gameplay.hp') === true);
  check('isRead after mark', isRead(s, 'gameplay.hp'));
  check('markRead is idempotent', markRead(s, 'gameplay.hp') === false);
  check('unknown id is rejected', markRead(s, 'gameplay.nope') === false);
  check('persisted under ONE save key as an id map', s._m.get(SAVE_KEY)?.['gameplay.hp'] === true);
  // Survives a "reload": a new store seeded from the old one's saved value.
  const s2 = mkStore({ [SAVE_KEY]: s._m.get(SAVE_KEY) });
  check('read state survives a save round-trip', isRead(s2, 'gameplay.hp'));
}

// ── Reordering / inserting entries can never corrupt progress ─────────────
{
  // Progress is a map of ids, so it has no notion of position at all.
  const s = mkStore({ [SAVE_KEY]: { 'phone.garage': true, 'gameplay.btn_pause': true } });
  check('progress is positional-independent', isRead(s, 'phone.garage') && isRead(s, 'gameplay.btn_pause'));
  check('a stray unknown id in the save is harmless',
        (mkStore({ [SAVE_KEY]: { 'legacy.thing': true } }), progress(mkStore({ [SAVE_KEY]: { 'legacy.thing': true } })).read === 0));
}

// ── Progress + completion ─────────────────────────────────────────────────
{
  const s = mkStore();
  let p = progress(s);
  check('progress totals 39 / 0 read', p.total === 39 && p.read === 0);
  check('per-category totals', p.byCat.phone.total === 11 && p.byCat.game_menu.total === 5 && p.byCat.gameplay.total === 23);
  for (const e of entriesFor({}, CATEGORY.PHONE)) markRead(s, e.id);
  p = progress(s);
  check('phone 11/11 after reading the category', p.byCat.phone.read === 11 && p.read === 11);
  check('not complete with 28 unread', !complete(s));
  for (const e of TUTORIAL_ENTRIES) markRead(s, e.id);
  check('complete at 39/39', complete(s) && progress(s).read === 39);
}

// ── Road Scholar: applicable-only denominator, latched once earned ────────
{
  // An entry that does not apply must vanish from the denominator, so 100%
  // stays reachable for a player who can never see it.
  const optional = { id: 'gameplay.__test_locked', cat: 'gameplay', el: 'x', title: 't', desc: 'd',
                     applies: (ctx) => !!ctx.hasFeature };
  TUTORIAL_ENTRIES.push(optional);
  try {
    const s = mkStore();
    for (const e of TUTORIAL_ENTRIES) if (e !== optional) markRead(s, e.id);
    check('locked entry excluded: complete without it', complete(s, { hasFeature: false }));
    check('locked entry included when available: not complete', !complete(s, { hasFeature: true }));
    check('checkRoadScholar fires on completion', checkRoadScholar(s, { hasFeature: false }) === true);
    // Latch: once owned, a NEW unread entry must not revoke or re-trigger it.
    s.set('achievements', { [ROAD_SCHOLAR_ID]: 'gold' });
    check('already-owned → never re-fires', checkRoadScholar(s, { hasFeature: true }) === false);
    check('and is still owned with an unread entry present', s.get('achievements')[ROAD_SCHOLAR_ID] === 'gold');
  } finally {
    TUTORIAL_ENTRIES.pop();
  }
}

// ── Save migration: a save from before the tutorial system ────────────────
{
  // Old saves have no `tutorialRead` at all, and may hold junk under it from a
  // future/other build. Both must read as "nothing read", never throw, and
  // never be mistaken for completion.
  const legacy = mkStore({ achievements: { lifted: 'bronze' } });   // no SAVE_KEY
  check('legacy save: progress 0, no throw', progress(legacy).read === 0 && !complete(legacy));
  check('legacy save: Road Scholar does not fire', checkRoadScholar(legacy) === false);
  const junk = mkStore({ [SAVE_KEY]: 'not-an-object' });
  check('non-object read state is treated as empty', Object.keys(readState(junk)).length === 0);
  check('marking on a junk store repairs it to a map', markRead(junk, 'gameplay.hp') && isRead(junk, 'gameplay.hp'));
  // A stray id must not count toward completion even when every real id is read.
  const s = mkStore();
  for (const e of TUTORIAL_ENTRIES) markRead(s, e.id);
  s.set(SAVE_KEY, { ...readState(s), 'phone.removed_feature': true });
  check('an unknown read id never inflates the numerator', progress(s).read === TUTORIAL_ENTRIES.length);
}

// ── Per-button pulse life: three independent first-selection flags ────────
{
  const s = mkStore();
  check('no button seen on a fresh store', TUT_BUTTONS.every(b => !btnSeen(s, b)));
  check('setBtnSeen returns true on first selection', setBtnSeen(s, 'phone') === true);
  check('only that button is marked', btnSeen(s, 'phone') && !btnSeen(s, 'game_menu') && !btnSeen(s, 'gameplay'));
  check('second selection is a no-op', setBtnSeen(s, 'phone') === false);
  check('unknown button rejected', setBtnSeen(s, 'garage') === false);
  check('stored under ONE key as a map', s._m.get(BTN_SEEN_KEY)?.phone === true);
  const junk = mkStore({ [BTN_SEEN_KEY]: 'nope' });
  check('junk value reads as unseen and is repaired on write', !btnSeen(junk, 'gameplay') && setBtnSeen(junk, 'gameplay') && btnSeen(junk, 'gameplay'));
  // The intro card flag is separate: seeing the intro never silences a button.
  const s2 = mkStore({ tutorialIntroSeen: true });
  check('intro seen does not mark any button', TUT_BUTTONS.every(b => !btnSeen(s2, b)));
}

console.log(`\ntutorial.test: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
