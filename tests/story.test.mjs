// ── Featured stories (Ch. 18) — Phase 1 node CLI tests ───────────────────
// Run: node tests/story.test.mjs   (also `npm test`)
//
// Pure-node, no Phaser.  Covers the Phase-1 slice of the 18.12 acceptance
// matrix: save migration (an existing v3 plate loads with storyCanon
// backfilled, nothing else touched), the irreversible ledger (double tap /
// re-entry / rewind apply a choice exactly once — cash, unlock, panel), new
// run + plate isolation, replay attempts, the plate-reset contract (story /
// contacts / mission history go; genres + achievements stay), the Custom
// sandbox being non-canonical, and stable-key dialogue resolution.

import { SaveSystem } from '../src/systems/SaveSystem.js';
import {
  StorySystem, STORY_STATUS, emptyStoryCanon, normalizeStoryCanon, ledgerKey,
} from '../src/systems/StorySystem.js';
import {
  FEATURED_STORIES, STORY_IDS, STORY_GENRE, validateStories, resolveDialogue,
  lineKey, labelKey, replyKey, DIALOGUE_INDEX,
} from '../src/data/featuredStories.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// ── localStorage shim (SaveSystem reads/writes it synchronously) ──────────
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
const KEY = 'rtr.save.v3';
function freshSave() { store.clear(); return new SaveSystem(); }
function reload() { return new SaveSystem(); }   // same storage → simulates a force-close + relaunch

/** Hooks recorder — counts every world-facing effect a commit fires. */
function recorder() {
  const log = { cash: 0, cashCalls: 0, unlocks: [], contacts: [], panels: 0, radio: [] };
  const hooks = {
    cash: (n) => { log.cash += n; log.cashCalls++; },
    unlockGenre: (g) => log.unlocks.push(g),
    contact: (c) => log.contacts.push(c.id),
    radioGrant: (g) => log.radio.push(g),
    panel: () => { log.panels++; },
  };
  return { log, hooks };
}

// ═══ 1. Story definitions are structurally valid ══════════════════════════
{
  const errs = validateStories();
  check('story defs validate', errs.length === 0);
  if (errs.length) console.error(errs);
  check('three featured stories', STORY_IDS.length === 3 && STORY_IDS.every(id => FEATURED_STORIES[id]));
  check('every story maps to a genre', STORY_IDS.every(id => typeof STORY_GENRE[id] === 'string'));
  check('hiphop enters at Seattle', FEATURED_STORIES.hiphop.entry?.stopId === 'S');
  check('classicRock enters at Vantage', FEATURED_STORIES.classicRock.entry?.stopId === 'V');
  check('country has no entry of its own (forks off hiphop)', FEATURED_STORIES.country.entry == null);
}

// ═══ 2. Save migration — existing v3 plate loads, storyCanon backfilled ═══
{
  const save = freshSave();
  save.selectSlot(0);
  save.setSlotPlate(0, 'OLDPL8');
  save.set('money', 4321);
  save.set('genresOwned', ['country']);
  save.set('achievements', { first_trip: { at: 1 } });
  // Strip storyCanon from the raw JSON to simulate a save written by a build
  // that predates Ch. 18.
  const raw = JSON.parse(localStorage.getItem(KEY));
  for (const sl of raw.slots) delete sl.global.storyCanon;
  localStorage.setItem(KEY, JSON.stringify(raw));
  const s2 = reload();
  check('pre-Ch18 plate: not repaired-to-empty (money kept)', s2.get('money') === 4321);
  check('pre-Ch18 plate: plate kept', s2.plateOf(0) === 'OLDPL8');
  check('pre-Ch18 plate: genresOwned kept', JSON.stringify(s2.get('genresOwned')) === '["country"]');
  check('pre-Ch18 plate: storyCanon backfilled null', s2.get('storyCanon', 'MISSING') === null);
  const story = new StorySystem(s2);
  const c = story.canon();
  check('canon normalizes from null', c.schemaVersion === 1 && STORY_IDS.every(id => c.stories[id].status === STORY_STATUS.AVAILABLE));
  // Garbage canon → shape restored, nothing thrown.
  s2.set('storyCanon', { ledger: 'nope', stories: { hiphop: { status: 'bogus', relationship: 900 }, futureArc: { status: 'active', nodeId: 'x' } }, volumes: 'nope' });
  const c2 = new StorySystem(reload()).canon();
  check('bad status falls back to available', c2.stories.hiphop.status === STORY_STATUS.AVAILABLE);
  check('relationship clamped 0–100', c2.stories.hiphop.relationship === 100);
  check('unknown story id preserved (forward compat)', c2.stories.futureArc?.status === STORY_STATUS.ACTIVE);
  check('volumes coerced to array', Array.isArray(c2.volumes));
}

// ═══ 3. Commit: exactly once — double tap, re-entry, force-close, rewind ══
{
  const save = freshSave();
  const story = new StorySystem(save);
  const rec = recorder();
  const sel = { storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'carry', mile: 4 };

  const r1 = story.commitChoice(sel, rec.hooks);
  check('first commit applies', r1.applied === true && r1.entry != null);
  check('story auto-activates on first consequential choice', story.status('hiphop') === STORY_STATUS.ACTIVE);
  check('node advanced to next', story.story('hiphop').nodeId === 'mercer_fork');
  check('durable item recorded (phone)', story.story('hiphop').items.phone === true);
  check('radio grant hook fired once', rec.log.radio.length === 1 && rec.log.radio[0] === 'hiphop_phonk');
  check('run state carries the grant', story.run.radioGrant === 'hiphop_phonk');
  check('panel hook fired once', rec.log.panels === 1);
  check('ledger entry carries stable keys + fallback copy',
    r1.entry.dialogueKeys.line === lineKey('hiphop', 'seattle_offer')
    && r1.entry.fallbackText.reply.startsWith("Album's on the phone"));
  check('ledger entry carries runId', r1.entry.runId === story.runId);

  // Double tap.
  const r2 = story.commitChoice(sel, rec.hooks);
  check('double tap: not applied', r2.applied === false && r2.reason === 'duplicate');
  check('double tap: no hooks re-fired', rec.log.radio.length === 1 && rec.log.panels === 1);

  // Force-close immediately after the commit → relaunch → same canon.
  const story2 = new StorySystem(reload());
  check('after reload: choice is in the ledger', story2.hasCommitted('hiphop', 'seattle_offer', 'carry'));
  check('after reload: node + item survive', story2.story('hiphop').nodeId === 'mercer_fork' && story2.story('hiphop').items.phone === true);
  const r3 = story2.commitChoice(sel, rec.hooks);
  check('after reload: re-commit is a no-op', r3.applied === false && rec.log.panels === 1);

  // Rewind: restore a snapshot taken BEFORE the commit (no grant, in the run).
  const before = { v: 1, runId: story.runId, radioGrant: null, passenger: null, nerve: 25, cargo: {}, flags: {} };
  story2.resetRun(story.runId);
  story2.restore(before);
  check('rewind: ledger re-applied, grant back', story2.run.radioGrant === 'hiphop_phonk');
  check('rewind: canon untouched', story2.story('hiphop').nodeId === 'mercer_fork');
  const r4 = story2.commitChoice(sel, rec.hooks);
  check('rewind: choice still can\'t be re-taken', r4.applied === false);

  // Non-consequential choices never touch the ledger.
  const s3 = new StorySystem(freshSave());
  const rr = recorder();
  const p = s3.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'pass' }, rr.hooks);
  check('casual choice: applied but no entry / panel / status change',
    p.applied === true && p.entry === null && rr.log.panels === 0
    && Object.keys(s3.canon().ledger).length === 0 && s3.status('hiphop') === STORY_STATUS.AVAILABLE);
}

// ═══ 4. Cash / cost / unlock / contact fire once, through hooks ═══════════
{
  // A throwaway definition exercising the full effects vocabulary.
  const defs = {
    t: {
      id: 't', version: 1, title: 'T', genre: 'country', entry: { stopId: 'S' }, startNode: 'a',
      nodes: {
        a: { stopId: 'S', line: 'Hi', choices: [
          { id: 'buy', label: 'I will buy the sushi.', reply: 'ok', cost: 20, consequential: true, next: 'b',
            effects: { relationship: +15, following: +2, flags: { fed: true }, contact: { id: 'brit', name: 'Brittney' } } },
        ] },
        b: { stopId: 'S', line: 'End', choices: [
          { id: 'win', label: 'We made it.', reply: 'yay', consequential: true, next: null,
            effects: { cash: 500, unlockGenre: 'country', ending: 'ride_em', relationship: -200 } },
        ] },
      },
    },
  };
  const save = freshSave();
  const story = new StorySystem(save, defs);
  const rec = recorder();
  story.commitChoice({ storyId: 't', nodeId: 'a', choiceId: 'buy' }, rec.hooks);
  check('cost debited once', rec.log.cash === -20 && rec.log.cashCalls === 1);
  check('relationship/following/flags applied', story.story('t').relationship === 15 && story.story('t').following === 2 && story.story('t').flags.fed === true);
  check('contact added to canon + hook', story.canon().contacts.brit?.name === 'Brittney' && rec.log.contacts[0] === 'brit');
  story.commitChoice({ storyId: 't', nodeId: 'a', choiceId: 'buy' }, rec.hooks);
  check('cost never debited twice', rec.log.cashCalls === 1);
  story.commitChoice({ storyId: 't', nodeId: 'b', choiceId: 'win' }, rec.hooks);
  check('payout credited once', rec.log.cash === 480 && rec.log.cashCalls === 2);
  check('genre unlock hook once', rec.log.unlocks.length === 1 && rec.log.unlocks[0] === 'country');
  check('ending recorded, story complete', story.status('t') === STORY_STATUS.COMPLETE && story.story('t').endingId === 'ride_em');
  check('relationship floor 0', story.story('t').relationship === 0);
  story.commitChoice({ storyId: 't', nodeId: 'b', choiceId: 'win' }, rec.hooks);
  check('terminal story refuses further commits', rec.log.cashCalls === 2 && rec.log.unlocks.length === 1);
  check('complete() after complete is a no-op', story.complete('t', 'other') === false && story.story('t').endingId === 'ride_em');

  // Replay: new attempt, old ledger entries preserved, fresh commits allowed.
  const ledgerBefore = Object.keys(story.canon().ledger).length;
  check('beginReplay only on terminal', story.beginReplay('t') === true);
  check('replay resets state, bumps attempt', story.status('t') === STORY_STATUS.ACTIVE && story.story('t').replayCount === 1 && story.story('t').relationship === 0 && story.story('t').nodeId === 'a');
  const rec2 = recorder();
  const rp = story.commitChoice({ storyId: 't', nodeId: 'a', choiceId: 'buy' }, rec2.hooks);
  check('replay: same choice commits again under attempt 1', rp.applied === true && rec2.log.cashCalls === 1);
  check('replay: prior attempt ledger intact', Object.keys(story.canon().ledger).length === ledgerBefore + 1
    && !!story.canon().ledger[ledgerKey('t', 0, 'a', 'buy')] && !!story.canon().ledger[ledgerKey('t', 1, 'a', 'buy')]);
}

// ═══ 5. New run keeps canon; runs are distinguishable; plates isolated ════
{
  const save = freshSave();
  const story = new StorySystem(save);
  const rec = recorder();
  story.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'carry', mile: 4 }, rec.hooks);
  const run1 = story.runId;
  story.resetRun();
  check('new run: fresh run id', story.runId !== run1);
  check('new run: transient state cleared', story.run.radioGrant === null && story.run.passenger === null);
  check('new run: unfinished story state preserved', story.status('hiphop') === STORY_STATUS.ACTIVE && story.story('hiphop').nodeId === 'mercer_fork');
  check('new run: ledger preserved', story.hasCommitted('hiphop', 'seattle_offer', 'carry'));
  check('new run: reapply ignores other runs\' grants', story.reapplyLedger() === 0 && story.run.radioGrant === null);

  // Second plate sees nothing of the first.
  save.selectSlot(1);
  save.setSlotPlate(1, 'PLATE2');
  const story2 = new StorySystem(save);
  check('plate 2: canon empty', story2.status('hiphop') === STORY_STATUS.AVAILABLE && Object.keys(story2.canon().ledger).length === 0);
  story2.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'pass' }, {});
  save.selectSlot(0);
  check('plate 1: unchanged by plate 2', story.story('hiphop').nodeId === 'mercer_fork');
}

// ═══ 6. pendingAt / mandatory ordering / activate / advance ══════════════
{
  const story = new StorySystem(freshSave());
  const atS = story.pendingAt('S');
  check('Seattle offers the hiphop entry (mandatory)', atS.length === 1 && atS[0].storyId === 'hiphop' && atS[0].mandatory === true && atS[0].nodeId === 'seattle_offer');
  check('Mercer: nothing pending before the story starts', story.pendingAt('M').length === 0);
  check('Vantage offers classicRock entry', story.pendingAt('V').some(p => p.storyId === 'classicRock'));
  check('activate() starts at startNode', story.activate('hiphop') === true && story.story('hiphop').nodeId === 'seattle_offer');
  check('activate() idempotent', story.activate('hiphop') === false);
  check('advance() to a known node', story.advance('hiphop', 'mercer_fork') === true);
  check('advance() rejects unknown node', story.advance('hiphop', 'nope') === false);
  check('Mercer pending once the story is there', story.pendingAt('M').some(p => p.storyId === 'hiphop' && p.nodeId === 'mercer_fork'));
  check('Seattle no longer pending', story.pendingAt('S').length === 0);
  check('kill() marks dead + clears node', story.kill('hiphop', 'vantage_ram') === true && story.status('hiphop') === STORY_STATUS.DEAD && story.story('hiphop').nodeId === null);
  check('dead story: no pending anywhere', story.pendingAt('M').length === 0 && story.pendingAt('S').length === 0);
}

// ═══ 7. Plate reset contract (18.10) ══════════════════════════════════════
{
  const save = freshSave();
  save.selectSlot(0);
  save.setSlotPlate(0, 'RESETME');
  save.set('money', 999);
  save.set('genre', 'country');
  save.set('genresOwned', ['country', 'hiphop_phonk']);
  save.set('achievements', { trophy: { at: 5 } });
  save.set('missionRep', { delivery: 3 });
  save.set('missionStats', { delivery: { completed: 3 } });
  save.set('npcMemory', { diner_waitress: { met: true } });
  const story = new StorySystem(save);
  story.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'carry' }, {});
  const c = story.canon(); c.contacts.brit = { name: 'Brittney', addedAt: 1, storyId: 'country' }; c.volumes.push({ id: 'v1' });
  save.set('storyCanon', c);
  save.selectSlot(1); save.setSlotPlate(1, 'OTHER'); save.set('money', 7); save.selectSlot(0);

  save.resetProgress();
  const s2 = reload();
  check('reset: plate name freed', s2.plateOf(0) === '');
  check('reset: money wiped', s2.get('money', 0) === 0);
  check('reset: story canon wiped', s2.get('storyCanon', 'MISSING') === null);
  check('reset: story state available again', new StorySystem(s2).status('hiphop') === STORY_STATUS.AVAILABLE);
  check('reset: mission history wiped', Object.keys(s2.get('missionRep', {})).length === 0 && Object.keys(s2.get('missionStats', {})).length === 0);
  check('reset: npc memory wiped', Object.keys(s2.get('npcMemory', {})).length === 0);
  check('reset: achievements KEPT', s2.get('achievements')?.trophy?.at === 5);
  check('reset: genresOwned KEPT', JSON.stringify(s2.get('genresOwned')) === '["country","hiphop_phonk"]');
  check('reset: active genre KEPT', s2.get('genre') === 'country');
  s2.selectSlot(1);
  check('reset: other plate untouched', s2.plateOf(1) === 'OTHER' && s2.get('money') === 7);
}

// ═══ 8. Custom sandbox is non-canonical ══════════════════════════════════
{
  const save = freshSave();
  const story = new StorySystem(save);
  story.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'carry' }, {});
  save.setSandbox(true);
  check('sandbox: sees the plate canon', story.status('hiphop') === STORY_STATUS.ACTIVE && story.story('hiphop').nodeId === 'mercer_fork');
  story.advance('hiphop', 'seattle_offer');   // pretend the Custom run moved the story
  story.kill('hiphop', 'sandbox_death');
  check('sandbox: writes visible inside the run', story.status('hiphop') === STORY_STATUS.DEAD);
  save.setSandbox(false);
  check('sandbox off: plate canon untouched', story.status('hiphop') === STORY_STATUS.ACTIVE && story.story('hiphop').nodeId === 'mercer_fork');
  const s2 = reload();
  check('sandbox never persisted', new StorySystem(s2).status('hiphop') === STORY_STATUS.ACTIVE);
}

// ═══ 9. Stable dialogue keys resolve, with fallback ═══════════════════════
{
  const k = replyKey('hiphop', 'seattle_offer', 'carry');
  check('index holds current copy', DIALOGUE_INDEX[k]?.startsWith("Album's on the phone"));
  check('resolve by key returns current copy', resolveDialogue(k, 'OLD') === DIALOGUE_INDEX[k]);
  check('missing key falls back to saved text', resolveDialogue('hiphop.gone.node.reply', 'OLD COPY') === 'OLD COPY');
  check('label key present', typeof DIALOGUE_INDEX[labelKey('hiphop', 'seattle_offer', 'pass')] === 'string');
  // Big canon survives the SaveSystem whitelist (array cap above 250).
  const save = freshSave();
  const c = emptyStoryCanon();
  c.volumes.push({ id: 'v1', events: Array.from({ length: 600 }, (_, i) => ({ i })) });
  save.set('storyCanon', c);
  const back = reload().get('storyCanon');
  check('600-event volume survives reload intact', back?.volumes?.[0]?.events?.length === 600);
  check('normalizeStoryCanon keeps volumes', normalizeStoryCanon(back).volumes[0].events.length === 600);
}

console.log(`story tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
