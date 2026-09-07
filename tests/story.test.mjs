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
  vinylOutcome, vinylPayout, VINYL_RECORDS, VINYL_PAY_PRISTINE, FOUNDER_OFFER, VANTAGE_AMBUSH_MILE,
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
  check('Mercer fork opens (predicate) and Seattle closes', story.pendingAt('M').some(p => p.nodeId === 'mercer_fork') && story.pendingAt('S').length === 0);
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
  check('after reload: item survives + Mercer still pending', story2.story('hiphop').items.phone === true && story2.pendingAt('M').some(p => p.nodeId === 'mercer_fork'));
  const r3 = story2.commitChoice(sel, rec.hooks);
  check('after reload: re-commit is a no-op', r3.applied === false && rec.log.panels === 1);

  // Rewind: restore a snapshot taken BEFORE the commit (no grant, in the run).
  const before = { v: 1, runId: story.runId, radioGrant: null, passenger: null, nerve: 25, cargo: {}, flags: {} };
  story2.resetRun(story.runId);
  story2.restore(before);
  check('rewind: ledger re-applied, grant back', story2.run.radioGrant === 'hiphop_phonk');
  check('rewind: canon untouched', story2.story('hiphop').items.phone === true && story2.hasCommitted('hiphop', 'seattle_offer', 'carry'));
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
  check('new run: transient state cleared, radio re-derived from the phone', story.run.passenger === null && story.run.radioGrant === 'hiphop_phonk');
  check('new run: unfinished story state preserved', story.status('hiphop') === STORY_STATUS.ACTIVE && story.story('hiphop').items.phone === true);
  check('new run: ledger preserved', story.hasCommitted('hiphop', 'seattle_offer', 'carry'));
  check('new run: reapply ignores other runs\' grants; deriveRun re-grants radio from the phone', story.reapplyLedger() === 0 && story.run.radioGrant === 'hiphop_phonk');

  // Second plate sees nothing of the first.
  save.selectSlot(1);
  save.setSlotPlate(1, 'PLATE2');
  const story2 = new StorySystem(save);
  check('plate 2: canon empty', story2.status('hiphop') === STORY_STATUS.AVAILABLE && Object.keys(story2.canon().ledger).length === 0);
  story2.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'pass' }, {});
  check('plate 2: casual pass leaves it available', story2.status('hiphop') === STORY_STATUS.AVAILABLE);
  save.selectSlot(0);
  check('plate 1: unchanged by plate 2', story.story('hiphop').items.phone === true && story.status('hiphop') === STORY_STATUS.ACTIVE);
}

// ═══ 6. pendingAt / mandatory ordering / activate / kill ════════════════
{
  const story = new StorySystem(freshSave());
  const atS = story.pendingAt('S');
  check('Seattle offers the hiphop entry (mandatory)', atS.length === 1 && atS[0].storyId === 'hiphop' && atS[0].mandatory === true && atS[0].nodeId === 'seattle_offer');
  check('Mercer: nothing pending before the story starts', story.pendingAt('M').length === 0);
  check('Vantage offers classicRock entry', story.pendingAt('V').some(p => p.storyId === 'classicRock'));
  check('activate() starts at startNode', story.activate('hiphop') === true && story.story('hiphop').nodeId === 'seattle_offer');
  check('activate() idempotent', story.activate('hiphop') === false);
  check('activated-but-uncommitted: Seattle still open (scene re-entry re-prompts until a choice lands)', story.pendingAt('S').some(p => p.nodeId === 'seattle_offer'));
  story.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'carry' }, {});
  check('after commit: Seattle closed, Mercer open', story.pendingAt('S').length === 0 && story.pendingAt('M').some(p => p.nodeId === 'mercer_fork'));
  check('Bellevue founder not yet (Mercer unresolved)', story.pendingAt('B').length === 0);
  check('advance() rejects unknown node', story.advance('hiphop', 'nope') === false);
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
  check('sandbox: sees the plate canon', story.status('hiphop') === STORY_STATUS.ACTIVE && story.story('hiphop').items.phone === true);
  story.kill('hiphop', 'sandbox_death');      // pretend the Custom run ended the story
  check('sandbox: writes visible inside the run', story.status('hiphop') === STORY_STATUS.DEAD);
  save.setSandbox(false);
  check('sandbox off: plate canon untouched', story.status('hiphop') === STORY_STATUS.ACTIVE && story.story('hiphop').items.phone === true);
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

// ═══ 10. Hip-Hop — Malik's Phone (Ch. 18.6) ══════════════════════════════
const H = (storyId, nodeId, choiceId, story, hooks = {}, mile = 0) => story.commitChoice({ storyId, nodeId, choiceId, mile }, hooks);
{
  // Happy path: carry → keep job → refuse founder → Kyle → Dom promise → press (Dom credit) → damage → Cle Elum.
  const save = freshSave(); const story = new StorySystem(save); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  check('carry: radio grant + phone + Malik trust 50', story.run.radioGrant === 'hiphop_phonk' && story.story('hiphop').items.phone === true && story.story('hiphop').relationship === 50);
  H('hiphop', 'mercer_fork', 'keepJob', story, rec.hooks, 9);
  check('keepJob: Mercer done, still carrying, radio still on', story.story('hiphop').flags.mercerDone === true && story.run.radioGrant === 'hiphop_phonk');
  check('Bellevue founder flags you down on arrival (mandatory) only after Mercer', story.pendingAt('B').length === 1 && story.pendingAt('B')[0].nodeId === 'bellevue_founder' && story.pendingAt('B')[0].mandatory === true);
  H('hiphop', 'bellevue_founder', 'refuse', story, rec.hooks, 12);
  check('refuse: continues, no cash, Bellevue closed', rec.log.cashCalls === 0 && story.isActive('hiphop') && story.pendingAt('B').length === 0);
  check('Issaquah pending (mandatory)', story.pendingAt('I').some(p => p.nodeId === 'issaquah_kyle' && p.mandatory));
  H('hiphop', 'issaquah_kyle', 'handOver', story, rec.hooks, 18);
  check('Kyle: phone gone, thumb drive in hand, radio grant ends', story.story('hiphop').items.phone == null && story.story('hiphop').items.thumbdrive === true && story.run.radioGrant === null);
  check('passing Issaquah AFTER delivery does nothing', story.exitPassed('I', 18.2, {}).length === 0);
  check('North Bend pending', story.pendingAt('N').some(p => p.nodeId === 'northbend_dom'));
  const r = H('hiphop', 'northbend_dom', 'promise', story, rec.hooks, 32);
  check('Dom promise: no eject', r.leaveStop === false && story.story('hiphop').flags.credit === 'promised');
  const pressChoices = story.choicesFor('hiphop', 'pass_tennessee').map(c => c.id);
  check('press: producer credit offered after a promise', pressChoices.includes('creditDom') && pressChoices.length === 3);
  H('hiphop', 'pass_tennessee', 'creditDom', story, rec.hooks, 53);
  check('press: 100 records in cargo + canon', story.run.cargo.records === VINYL_RECORDS && story.story('hiphop').items.records === VINYL_RECORDS);
  check('press: no radio (drive, not phone)', story.run.radioGrant === null);
  // Damage: 2 records + 2% per HP, fractional scrapes accumulate, floor 0.
  story.onDamage(3);
  check('3 HP → 94 records', story.run.cargo.records === 94);
  story.onDamage(0.4); story.onDamage(0.6);
  check('two scrapes summing 1 HP → 92 records', story.run.cargo.records === 92);
  check('payout math: 92 records, 4 HP lost → linear × (1 − 8%)', vinylPayout(92, 4) === Math.round(VINYL_PAY_PRISTINE * 0.92 * 0.92));
  check('payout dock capped at 100%', vinylPayout(50, 80) === 0 && vinylPayout(0, 0) === 0 && vinylPayout(100, 0) === VINYL_PAY_PRISTINE);
  // Exact resume mid-haul keeps the crate.
  const snap = story.serialize();
  const s2 = new StorySystem(reload()); s2.restore(snap);
  check('resume: cargo count + hpLost survive', s2.run.cargo.records === 92 && s2.run.cargo.hpLost === 4);
  // Sync at a save point, then a NEW run derives the crate from canon.
  story.syncCargo();
  const s3 = new StorySystem(reload());
  check('new run after sync: records + HP dock derived from canon', s3.run.cargo.records === 92 && s3.run.cargo.hpLost === 4);
  check('Cle Elum line is dynamic and reads the count', s3.resolveLine('hiphop', 'cleelum_store').includes('92 of a hundred'));
  const rec3 = recorder();
  const d = H('hiphop', 'cleelum_store', 'deliver', s3, rec3.hooks, 84);
  const expectPay = vinylPayout(92, 4);
  check('deliver: pays once, unlocks Hip-Hop once, complete/damaged', rec3.log.cash === expectPay && rec3.log.cashCalls === 1 && rec3.log.unlocks.join() === 'hiphop_phonk' && s3.status('hiphop') === STORY_STATUS.COMPLETE && s3.story('hiphop').endingId === 'damaged');
  check('deliver: ledger stored the RESOLVED effects', d.entry.effects.cash === expectPay && d.entry.effects.ending === 'damaged');
  check('deliver: ledger fallback carries the dynamic line', d.entry.fallbackText.line.includes('92 of a hundred'));
  check('ending label', s3.endingLabel('hiphop') === 'ROUGH DELIVERY');
  H('hiphop', 'cleelum_store', 'deliver', s3, rec3.hooks, 84);
  check('deliver: double tap pays nothing', rec3.log.cashCalls === 1);
}
{
  // Mercer Country branch: phone left, radio off, Country starts, Hip-Hop back on the shelf.
  const story = new StorySystem(freshSave()); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  H('hiphop', 'mercer_fork', 'ride', story, rec.hooks, 9);
  check('ride: Country active, Brittney aboard, radio off', story.status('country') === STORY_STATUS.ACTIVE && story.run.passenger?.id === 'brittney' && story.run.radioGrant === null && rec.log.radio.at(-1) === null);
  check('ride: Hip-Hop back to AVAILABLE on attempt 1, ledger kept', story.status('hiphop') === STORY_STATUS.AVAILABLE && story.story('hiphop').replayCount === 1 && story.hasCommitted('hiphop', 'mercer_fork', 'ride', 0));
  check('ride: no phone', !story.story('hiphop').items.phone);
  story.resetRun();
  check('later run: Seattle offers Hip-Hop again', story.pendingAt('S').some(p => p.storyId === 'hiphop'));
  const r2 = H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  check('later run: carry commits again under attempt 1', r2.applied === true && story.story('hiphop').items.phone === true);
}
{
  // Skipped Mercer → Malik redirect; Country unavailable; then passed Issaquah → lock + ambush; recovery both ways.
  const story = new StorySystem(freshSave()); const texts = [];
  const hooks = { text: (cid, from, msg) => texts.push({ cid, from, msg }), radioGrant: () => {} };
  H('hiphop', 'seattle_offer', 'carry', story, {}, 4);
  check('pass Mercer: Malik texts, trust drops, Mercer closed', story.exitPassed('M', 9.7, hooks).join() === 'hiphop' && texts.length === 1 && texts[0].cid === 'malik' && story.story('hiphop').relationship === 35 && story.pendingAt('M').length === 0);
  check('pass Mercer twice: idempotent', story.exitPassed('M', 9.8, hooks).length === 0 && texts.length === 1);
  check('phone NOT locked yet, radio still on', !story.story('hiphop').items.phoneLocked && story.run.radioGrant === 'hiphop_phonk');
  check('Issaquah still deliverable', story.pendingAt('I').some(p => p.nodeId === 'issaquah_kyle'));
  check('no ambush while unlocked', story.ambushesAt(VANTAGE_AMBUSH_MILE + 1).length === 0);
  check('pass Issaquah: lock + angry text + radio off', story.exitPassed('I', 18.3, hooks).join() === 'hiphop' && story.story('hiphop').items.phoneLocked === true && story.run.radioGrant === null && texts.length === 2);
  check('locked: Kyle no longer pending', story.pendingAt('I').length === 0);
  check('ambush arms at Vantage approach, once per run', story.ambushesAt(VANTAGE_AMBUSH_MILE - 0.1).length === 0 && story.ambushesAt(VANTAGE_AMBUSH_MILE).length === 1);
  story.markAmbush('hiphop');
  check('ambush marked → not re-armed this run', story.ambushesAt(140).length === 0);
  check('new run after a lock: no radio derived', (story.resetRun(), story.run.radioGrant === null));
  check('new run: ambush re-arms (still carrying the locked phone)', story.ambushesAt(140).length === 1);
  // Recovery A: warp back — phone unlocks, Kyle deliverable again.
  const rw = H('hiphop', 'vantage_recovery', 'warp', story, {}, 137);
  check('recovery warp: phone unlocked, Kyle pending again, ledger once', rw.applied && !story.story('hiphop').items.phoneLocked && story.pendingAt('I').some(p => p.nodeId === 'issaquah_kyle'));
  check('recovery warp: double tap no-op', H('hiphop', 'vantage_recovery', 'warp', story, {}, 137).applied === false);
  check('recovery warp: recovery node never listed at Vantage', story.pendingAt('V').every(p => p.nodeId !== 'vantage_recovery'));
  // Recovery B on a fresh plate: continue → dead for this path, no loop.
  const st2 = new StorySystem(freshSave());
  H('hiphop', 'seattle_offer', 'carry', st2, {}, 4); st2.exitPassed('M', 9.7, {}); st2.exitPassed('I', 18.3, {});
  const rc = H('hiphop', 'vantage_recovery', 'continue', st2, {}, 137);
  check('recovery continue: story DEAD, no ambush ever again', rc.applied && st2.status('hiphop') === STORY_STATUS.DEAD && st2.ambushesAt(140).length === 0 && st2.pendingAt('S').length === 0);
}
{
  // Founder sellout → COMPLETE! SORT OF…, $1,000, no unlock, nothing further.
  const story = new StorySystem(freshSave()); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  H('hiphop', 'mercer_fork', 'keepJob', story, rec.hooks, 9);
  H('hiphop', 'bellevue_founder', 'sell', story, rec.hooks, 12);
  check('sell: $1000 once, no unlock, complete sort-of', rec.log.cash === FOUNDER_OFFER && rec.log.cashCalls === 1 && rec.log.unlocks.length === 0 && story.status('hiphop') === STORY_STATUS.COMPLETE && story.endingLabel('hiphop') === 'COMPLETE! SORT OF…');
  check('sell: radio off, Issaquah closed', story.run.radioGrant === null && story.pendingAt('I').length === 0);
}
{
  // Dom eject + zero-record delivery = failed, no pay, no unlock.
  const story = new StorySystem(freshSave()); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  H('hiphop', 'mercer_fork', 'keepJob', story, rec.hooks, 9);
  H('hiphop', 'issaquah_kyle', 'handOver', story, rec.hooks, 18);
  const e = H('hiphop', 'northbend_dom', 'bagman', story, rec.hooks, 32);
  check('bagman: leaveStop flagged, credit refused', e.leaveStop === true && story.story('hiphop').flags.credit === 'refused');
  check('press: no producer-credit option after a refusal', !story.choicesFor('hiphop', 'pass_tennessee').some(c => c.id === 'creditDom'));
  H('hiphop', 'pass_tennessee', 'creditStank', story, rec.hooks, 53);
  story.onDamage(60);
  check('60 HP → zero records (floor)', story.run.cargo.records === 0 && vinylOutcome(0) === 'zero');
  H('hiphop', 'cleelum_store', 'deliver', story, rec.hooks, 84);
  check('zero: failed, no pay, no unlock', story.status('hiphop') === STORY_STATUS.FAILED && rec.log.cashCalls === 0 && rec.log.unlocks.length === 0 && story.story('hiphop').endingId === 'zero');
  check('outcome buckets', vinylOutcome(100) === 'pristine' && vinylOutcome(99) === 'damaged' && vinylOutcome(50) === 'damaged' && vinylOutcome(49) === 'almost_empty' && vinylOutcome(2) === 'almost_empty' && vinylOutcome(1) === 'one_record');
}

console.log(`story tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
