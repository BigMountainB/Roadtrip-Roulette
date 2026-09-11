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
  countryOutcome, countryObjectives, hayleeRead, NERVE_MAX, COUNTRY_PAY_STANDARD, COUNTRY_PAY_RIDE_EM, KIDNAP_REPORT_MI, ROADSIDE_STOP_SEC,
  classicRockOutcome, isBrokenVoice, PULLMAN_PAY, OTHELLO_COVER, OTHELLO_PROPOSITION, NAN_OFFER, SHOW2_TOTAL, SHOW3_SOLO, SHOW3_DUET,
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
  check('Mercer fork opens (predicate) and Seattle closes', story.pendingAt('M').some(p => p.nodeId === 'mercer_counter') && story.pendingAt('S').length === 0);
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
  check('after reload: item survives + Mercer still pending', story2.story('hiphop').items.phone === true && story2.pendingAt('M').some(p => p.nodeId === 'mercer_counter'));
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
  check('Seattle offers the hiphop entry (mandatory)', atS.length === 1 && atS[0].storyId === 'hiphop' && atS[0].mandatory === true && atS[0].nodeId === 'seattle_lot');
  check('Mercer: nothing pending before the story starts', story.pendingAt('M').length === 0);
  check('Vantage offers classicRock entry', story.pendingAt('V').some(p => p.storyId === 'classicRock'));
  check('activate() starts at startNode', story.activate('hiphop') === true && story.story('hiphop').nodeId === 'seattle_lot');
  check('activate() idempotent', story.activate('hiphop') === false);
  check('activated-but-uncommitted: Seattle still open (scene re-entry re-prompts until a choice lands)', story.pendingAt('S').some(p => p.nodeId === 'seattle_lot'));
  story.commitChoice({ storyId: 'hiphop', nodeId: 'seattle_offer', choiceId: 'carry' }, {});
  check('after commit: Seattle closed, Mercer open', story.pendingAt('S').length === 0 && story.pendingAt('M').some(p => p.nodeId === 'mercer_counter'));
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
const H = (storyId, nodeId, choiceId, story, hooks = {}, mile = 0, stopId = null) => story.commitChoice({ storyId, nodeId, choiceId, mile, stopId }, hooks);
{
  // Happy path: carry → keep job → refuse founder → Kyle → Dom promise → press (Dom credit) → damage → Cle Elum.
  const save = freshSave(); const story = new StorySystem(save); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  check('carry: radio grant + phone + Malik trust 60 (owner 2026-09-10)', story.run.radioGrant === 'hiphop_phonk' && story.story('hiphop').items.phone === true && story.story('hiphop').relationship === 60);
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
  check('pass Mercer: Malik texts, trust drops, Mercer closed', story.exitPassed('M', 9.7, hooks).join() === 'hiphop' && texts.length === 1 && texts[0].cid === 'malik' && story.story('hiphop').relationship === 45 && story.pendingAt('M').length === 0);
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

// ═══ 11. Country — StageWagon or Bust (Ch. 18.7) ═════════════════════════
function board() {
  const save = freshSave(); const story = new StorySystem(save); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  H('hiphop', 'mercer_fork', 'ride', story, rec.hooks, 9);
  return { save, story, rec };
}
const roadHooks = () => { const log = { said: [], wanted: [] }; return { log, hooks: { say: (t) => log.said.push(t), wanted: (n) => log.wanted.push(n), passenger: () => {} } }; };
{
  const { story } = board();
  check('boarding: Country active, rel 55 (50 + ride\'s +5), Nerve 25, Brittney seated', story.status('country') === STORY_STATUS.ACTIVE && story.story('country').relationship === 55 && story.run.nerve === NERVE_MAX && story.run.passenger?.id === 'brittney');
  // Rest stop → need assigned (hunger first), Nerve refill capped.
  story.restStopVisited('B');
  check('first stop: hunger pending, Nerve capped at 25', story.story('country').flags.pendingNeed === 'hunger' && story.run.nerve === NERVE_MAX);
  check('hunger node pending at Bellevue (mandatory), not at Mercer', story.pendingAt('B').some(p => p.nodeId === 'need_hunger' && p.mandatory) && story.pendingAt('M').length === 0);
  const rec = recorder();
  check('repeatable node refuses a commit without its stop', H('country', 'need_hunger', 'wait', story, rec.hooks, 12).reason === 'needs_stop');
  H('country', 'need_hunger', 'wait', story, rec.hooks, 12, 'B');
  check('wait: no purchase, need persists, rel −5', rec.log.cashCalls === 0 && story.story('country').flags.pendingNeed === 'hunger' && story.story('country').relationship === 50);
  check('wait: closed at Bellevue, still open at Issaquah (repeatable)', !story.pendingAt('B').some(p => p.nodeId === 'need_hunger') && story.pendingAt('I').some(p => p.nodeId === 'need_hunger'));
  story.restStopVisited('I');
  check('second stop: need unchanged while pending', story.story('country').flags.pendingNeed === 'hunger');
  const r2 = H('country', 'need_hunger', 'sushi', story, rec.hooks, 18, 'I');
  check('sushi at Issaquah: separate ledger key, $14 once, satisfied, rel +10', r2.applied && r2.entry.key.includes('@I') && rec.log.cash === -14 && rec.log.cashCalls === 1 && story.story('country').flags.pendingNeed == null && story.story('country').relationship === 60);
  check('sushi double tap: nothing', H('country', 'need_hunger', 'sushi', story, rec.hooks, 18, 'I').applied === false && rec.log.cashCalls === 1);
  story.restStopVisited('SQ');
  check('third stop: bathroom next in rotation', story.story('country').flags.pendingNeed === 'bathroom' && story.pendingAt('SQ').some(p => p.nodeId === 'need_bathroom'));
  H('country', 'need_bathroom', 'hold', story, rec.hooks, 25, 'SQ');
  check('hold: need persists, rel unchanged', story.story('country').flags.pendingNeed === 'bathroom' && story.story('country').relationship === 60);
  story.restStopVisited('N');
  H('country', 'need_bathroom', 'goWith', story, rec.hooks, 32, 'N');
  check('play swords: satisfied, rel +10', story.story('country').flags.pendingNeed == null && story.story('country').relationship === 70);
  story.restStopVisited('SP');
  check('thirst next', story.story('country').flags.pendingNeed === 'thirst');
  H('country', 'need_thirst', 'fountain', story, rec.hooks, 53, 'SP');
  check('fountain: free, satisfied, rel −8', rec.log.cashCalls === 1 && story.story('country').flags.pendingNeed == null && story.story('country').relationship === 62);
  story.restStopVisited('V');
  check('Vantage assigns no need', story.story('country').flags.pendingNeed == null);
}
{
  // Nerve 1:1 on impacts, not scrapes; thresholds speak; 5+ HP accident speaks immediately; refill 5 per stop.
  const { story } = board(); const rh = roadHooks();
  story.roadEvent('damage', { hp: 3, source: 'bridge_rail', mile: 10 }, rh.hooks);
  check('rail scrape: no Nerve loss', story.run.nerve === 25);
  story.roadEvent('damage', { hp: 6, source: 'corner', mile: 10.1 }, rh.hooks);
  check('6 HP corner clip: Nerve 19, immediate authored line', story.run.nerve === 19 && rh.log.said.at(-1).startsWith('Easy, cowboy'));
  story.roadEvent('damage', { hp: 2, source: 'rear-end', mile: 10.2 }, rh.hooks);
  check('small hit inside cooldown: Nerve 17, no new line', story.run.nerve === 17 && rh.log.said.length === 1);
  story.roadEvent('damage', { hp: 3, source: 'rear-end', mile: 11 }, rh.hooks);
  check('crossing 15: threshold line', story.run.nerve === 14 && rh.log.said.length === 2);
  // Owner 2026-09-09: NO flat refill for parking — nerve is earned by
  // meeting her needs (choice effects) and by crash-free crazy driving.
  story.restStopVisited('B');
  check('rest stop alone grants NO nerve', story.run.nerve === 14);
  // Crash-free crazy driving builds it: 15 cumulative seconds above 115 mph.
  for (let i = 0; i < 15; i++) story.roadEvent('tick', { mile: 12 + i * 0.03, dt: 1, mph: 120, stopped: false, onShoulder: false }, rh.hooks);
  check('15 s above 115 mph: +1 nerve', story.run.nerve === 15);
  story.roadEvent('tick', { mile: 13, dt: 10, mph: 80, stopped: false, onShoulder: false }, rh.hooks);
  check('slow driving builds nothing', story.run.nerve === 15);
  // 3 clean overtakes = +1 (flirt cadence still every 5th).
  for (let i = 0; i < 3; i++) story.roadEvent('pass', { mile: 14 + i * 0.1 }, rh.hooks);
  check('3 clean passes: +1 nerve', story.run.nerve === 16);
  // A head-on near miss is an instant +1.
  story.roadEvent('nearMiss', { mile: 15 }, rh.hooks);
  check('head-on near miss: +1 nerve', story.run.nerve === 17);
  story.roadEvent('damage', { hp: 7, source: 'cop_head_on', mile: 20 }, rh.hooks);
  check('7 HP head-on-ish: "You saved it" flavour', rh.log.said.at(-1).startsWith('You saved it'));
  // Resume keeps Nerve.
  const snap = story.serialize(); const s2 = new StorySystem(reload()); s2.restore(snap);
  check('exact resume keeps Nerve + passenger', s2.run.nerve === 10 && s2.run.passenger?.id === 'brittney');
  // New run: Nerve back to 25, she is still aboard (story unfinished).
  story.resetRun();
  check('new run: Nerve 25, Brittney still aboard', story.run.nerve === 25 && story.run.passenger?.id === 'brittney');
}
{
  // Good driving: every 5th clean pass flirts (+2 rel), cooldown respected.
  const { story } = board(); const rh = roadHooks();
  for (let i = 0; i < 5; i++) story.roadEvent('pass', { mile: 10 + i * 0.5 }, rh.hooks);
  check('5th clean pass: flirt line + rel 52', rh.log.said.length === 1 && rh.log.said[0].startsWith('Keep threading') && story.story('country').relationship === 57);
  for (let i = 0; i < 5; i++) story.roadEvent('pass', { mile: 13 + i * 0.5 }, rh.hooks);
  check('10th: second flirt rotates', rh.log.said.length === 2 && rh.log.said[1].startsWith('If you can keep'));
  check('clean passes counted', story.run.flags.cleanPasses === 10);
}
{
  // 0 Nerve → pull over; +1.0 mi cops warning; +1.5 mi five stars + kidnapping fail; passenger gone.
  const { story } = board(); const rh = roadHooks();
  story.roadEvent('damage', { hp: 30, source: 'head_on', mile: 40 }, rh.hooks);
  check('0 Nerve: "Pull over" line, nerve0Mile set', story.run.nerve === 0 && rh.log.said.at(-1) === "Pull over. Now. I'm getting out." && story.run.flags.nerve0Mile === 40);
  story.roadEvent('tick', { mile: 40.5, dt: 0.016, stopped: false, onShoulder: false }, rh.hooks);
  check('0.5 mi on: nothing yet', rh.log.wanted.length === 0 && rh.log.said.length === 1);
  story.roadEvent('tick', { mile: 41.05, dt: 0.016, stopped: false, onShoulder: false }, rh.hooks);
  check('1.0 mi: cops warning', rh.log.said.at(-1) === "If you don't stop, I'm calling the cops.");
  story.roadEvent('tick', { mile: 41.5 + 0.01, dt: 0.016, stopped: false, onShoulder: false }, rh.hooks);
  check('1.5 mi: five stars, kidnapping fail, seat empty', rh.log.wanted.at(-1) === 5 && story.status('country') === STORY_STATUS.FAILED && story.story('country').endingId === 'kidnapping' && story.run.passenger === null);
  check('kidnap beat recorded once (climax)', Object.values(story.canon().ledger).filter(e => e.nodeId === 'beat' && e.choiceId === 'kidnap' && e.importance === 'climax').length === 1);
  story.roadEvent('tick', { mile: 42, dt: 0.016, stopped: false, onShoulder: false }, rh.hooks);
  check('after failure: no more stars/lines', rh.log.wanted.length === 1);
  check('Country failed: no unlock, Vantage arrival not pending', story.pendingAt('V').every(p => p.storyId !== 'country'));
}
{
  // Roadside exit: stopped on the shoulder at 0 Nerve for 1.5 s → she's out, story fails.
  const { story } = board(); const rh = roadHooks();
  story.roadEvent('damage', { hp: 30, source: 'head_on', mile: 40 }, rh.hooks);
  story.roadEvent('tick', { mile: 40.2, dt: 0.5, stopped: true, onShoulder: false }, rh.hooks);
  check('stopped ON the road: not a drop', story.status('country') === STORY_STATUS.ACTIVE);
  story.roadEvent('tick', { mile: 40.2, dt: 1.0, stopped: true, onShoulder: true }, rh.hooks);
  story.roadEvent('tick', { mile: 40.2, dt: 0.6, stopped: true, onShoulder: true }, rh.hooks);
  check('1.6 s on the shoulder: roadside exit, seat empty, no stars', story.status('country') === STORY_STATUS.FAILED && story.story('country').endingId === 'roadside_exit' && story.run.passenger === null && rh.log.wanted.length === 0);
  check('no first-drive "changes" beat (wardrobe lock: uniform until Vantage)', !Object.values(story.canon().ledger).some(e => e.nodeId === 'beat' && e.choiceId === 'changes'));
}
{
  // Vantage endings.
  // `objs` = how many of her three objectives landed (owner 2026-09-10: RIDE
  // 'EM needs two of three on top of rel / nerve / passes).
  const mk = (rel, nerve, passes, objs = 2) => { const { story } = board(); const rec = recorder();
    const c = story.canon(); c.stories.country.relationship = rel;
    if (objs >= 1) c.stories.country.flags.supplies = 'full';
    if (objs >= 2) { c.stories.country.flags.haylee = 'aboard'; c.stories.country.flags.hayleeScore = 70; }
    if (objs >= 3) c.stories.country.flags.changeChoice = 'partial';
    story._writeCanon(c);
    story.run.nerve = nerve; story.run.flags.cleanPasses = passes; return { story, rec }; };
  const two = { supplies: 'partial', haylee: 'aboard' };
  check('outcome thresholds use raw 0–100', countryOutcome({ relationship: 80, flags: two }, { nerve: 10, flags: { cleanPasses: 5 } }) === 'ride_em'
    && countryOutcome({ relationship: 79, flags: two }, { nerve: 25, flags: { cleanPasses: 50 } }) === 'standard'
    && countryOutcome({ relationship: 80, flags: two }, { nerve: 9, flags: { cleanPasses: 5 } }) === 'standard'
    && countryOutcome({ relationship: 39, flags: two }, { nerve: 25, flags: { cleanPasses: 9 } }) === 'barely');
  check('RIDE \'EM needs two of three objectives (flirt-only score caps at Standard)',
    countryOutcome({ relationship: 95, flags: {} }, { nerve: 25, flags: { cleanPasses: 50 } }) === 'standard'
    && countryOutcome({ relationship: 95, flags: { supplies: 'full' } }, { nerve: 25, flags: { cleanPasses: 50 } }) === 'standard'
    && countryOutcome({ relationship: 95, flags: { supplies: 'none', haylee: 'aboard', changeChoice: 'partial' } }, { nerve: 25, flags: { cleanPasses: 50 } }) === 'ride_em'
    && countryObjectives({ flags: { supplies: 'full', haylee: 'left', changeChoice: 'none' } }) === 1);
  let t = mk(85, 12, 6);
  check('Vantage: the CHANGE tile is pending first (mandatory); the ending waits behind it', t.story.pendingAt('V').some(p => p.nodeId === 'vantage_change' && p.mandatory) && !t.story.pendingAt('V').some(p => p.nodeId === 'vantage_arrival'));
  let r = H('country', 'vantage_change', 'guard', t.story, t.rec.hooks, 137);
  check('guard: +5, chains into the ending, ending now pending', r.applied && r.next === 'vantage_arrival' && t.story.story('country').relationship === 90 && t.story.story('country').flags.changeChoice === 'full' && t.story.pendingAt('V').some(p => p.nodeId === 'vantage_arrival'));
  check('Ride \'Em line adds "Text me on your way back"', t.story.resolveLine('country', 'vantage_arrival').includes('Text me on your way back'));
  r = H('country', 'vantage_arrival', 'sendOff', t.story, t.rec.hooks, 137);
  {
    const reunion = Object.values(t.story.canon().ledger).find(e => e.nodeId === 'beat' && e.choiceId === 'reunion');
    check('sendOff records the reunion beat: full-change art, cooler-trophy caption, Haylee warm', !!reunion && reunion.panelKey === 'country.vantage_arrival.reunion'
      && /cooler like a trophy/.test(reunion.fallbackText?.line ?? '') && /This one's okay/.test(reunion.fallbackText?.line ?? ''));
  }
  check('Ride \'Em: $2,500 once, Country owned, contact, complete, seat empty', r.applied && t.rec.log.cash === COUNTRY_PAY_RIDE_EM && t.rec.log.unlocks.join() === 'country' && t.rec.log.contacts.join() === 'brittney' && t.story.canon().contacts.brittney?.name === 'Brittney' && t.story.status('country') === STORY_STATUS.COMPLETE && t.story.run.passenger === null);
  check('Ride \'Em double tap: nothing', H('country', 'vantage_arrival', 'sendOff', t.story, t.rec.hooks, 137).applied === false && t.rec.log.cashCalls === 1);
  t = mk(60, 3, 0);
  check('Standard line has no "Text me"', !t.story.resolveLine('country', 'vantage_arrival').includes('Text me'));
  H('country', 'vantage_arrival', 'sendOff', t.story, t.rec.hooks, 137);
  check('Standard: $1,500 + Country, no contact', t.rec.log.cash === COUNTRY_PAY_STANDARD && t.rec.log.unlocks.join() === 'country' && t.rec.log.contacts.length === 0 && t.story.story('country').endingId === 'standard');
  t = mk(20, 25, 20);
  H('country', 'vantage_arrival', 'sendOff', t.story, t.rec.hooks, 137);
  check('Barely Made It: $0 but Country still unlocks', t.rec.log.cashCalls === 0 && t.rec.log.unlocks.join() === 'country' && t.story.story('country').endingId === 'barely');
  check('after she leaves: hiphop is shelved (available) and Country is done', t.story.status('hiphop') === STORY_STATUS.AVAILABLE && t.story.pendingAt('V').every(p => p.storyId !== 'country'));
}
{
  // Brittney's three StageWagon objectives (owner 2026-09-10).
  // Ellensburg: Haylee's pickup chains into the supply run; the pending need still fires after.
  const { story, rec } = board(); const rh = roadHooks();
  story.restStopVisited('E');
  const pend = story.pendingAt('E');
  check('Ellensburg: Haylee pickup pending first, supply run NOT yet, need still queued', pend[0]?.nodeId === 'ellensburg_haylee' && pend[0].mandatory && !pend.some(p => p.nodeId === 'ellensburg_supply') && pend.some(p => /^need_/.test(p.nodeId)));
  let r = H('country', 'ellensburg_haylee', 'welcome', story, rec.hooks, 109, 'E');
  // (board() leaves Brittney at 55: Mercer's `ride` carries +5 across.)
  check('welcome: +5, Haylee aboard at 65, chains into the supply run', r.applied && r.next === 'ellensburg_supply' && story.story('country').relationship === 60 && story.story('country').flags.haylee === 'aboard' && story.story('country').flags.hayleeScore === 65 && story.pendingAt('E').some(p => p.nodeId === 'ellensburg_supply'));
  check('supply line mentions Haylee\'s tent when she is aboard', story.resolveLine('country', 'ellensburg_supply').includes('Haylee brought the tent'));
  r = H('country', 'ellensburg_supply', 'fullRun', story, rec.hooks, 109, 'E');
  check('full run: $40, +5, supplies full, chain over', r.applied && rec.log.cash === -40 && story.story('country').relationship === 65 && story.story('country').flags.supplies === 'full' && !story.pendingAt('E').some(p => /^ellensburg_/.test(p.nodeId)));
  // Haylee's meter on the road: −5 per real impact, +2 per three clean passes; her two lines.
  story.roadEvent('damage', { hp: 6, source: 'npc_side', mile: 112 }, rh.hooks);
  check('impact with Haylee aboard: her meter 65 → 60', story.story('country').flags.hayleeScore === 60);
  story.roadEvent('damage', { hp: 2, source: 'offroad_left', mile: 113 }, rh.hooks);
  check('scrape does not touch her meter', story.story('country').flags.hayleeScore === 60);
  for (let i = 0; i < 3; i++) story.roadEvent('pass', { mile: 114 + i * 0.1 }, rh.hooks);
  check('three clean passes: +2 → 62', story.story('country').flags.hayleeScore === 62);
  story.roadEvent('tick', { mile: 118.5, dt: 1, mph: 70, stopped: false, onShoulder: false }, rh.hooks);
  story.roadEvent('tick', { mile: 128.5, dt: 1, mph: 70, stopped: false, onShoulder: false }, rh.hooks);
  const hl = rh.log.said.filter(s => s.startsWith('Haylee:'));
  check('Haylee speaks twice on the road (118, 128), dry read at 62', hl.length === 2 && hl[0].includes('pick the drivers') && hl[1].includes('That was smooth'));
  check('hayleeRead thresholds', hayleeRead({ flags: { hayleeScore: 65 } }) === 'warm' && hayleeRead({ flags: { hayleeScore: 45 } }) === 'dry' && hayleeRead({ flags: { hayleeScore: 44 } }) === 'cold' && hayleeRead({ flags: {} }) === null);
}
{
  // Set-up lines before Exit 109, and blowing past it: −5, remembered, reversible by rewind.
  const { story } = board(); const rh = roadHooks();
  story.roadEvent('tick', { mile: 92.2, dt: 1, mph: 70, stopped: false, onShoulder: false }, rh.hooks);
  story.roadEvent('tick', { mile: 104.2, dt: 1, mph: 70, stopped: false, onShoulder: false }, rh.hooks);
  check('two phone set-up lines (campsites moved; Haylee at Exit 109)', rh.log.said.length === 2 && rh.log.said[0].includes('moved campsites') && rh.log.said[1].includes('Exit 109'));
  const said = [];
  check('pass Ellensburg: −5 (55 → 50), haylee=skipped, she says so', story.exitPassed('E', 109.3, { say: (t) => said.push(t) }).join() === 'country' && story.story('country').relationship === 50 && story.story('country').flags.haylee === 'skipped' && said[0] === 'That was my best friend.');
  check('pass twice: idempotent', story.exitPassed('E', 109.4, {}).length === 0 && story.story('country').relationship === 50);
  check('skipped: no Ellensburg tiles, no Haylee lines, objective count 0', !story.pendingAt('E').some(p => /^ellensburg_/.test(p.nodeId)) && countryObjectives(story.story('country')) === 0);
  check('rewind before the exit undoes it exactly', story.exitUnpassed('E', 108.5, {}).join() === 'country' && story.story('country').relationship === 55 && story.story('country').flags.haylee == null && story.pendingAt('E').some(p => p.nodeId === 'ellensburg_haylee'));
  // No room → she's "left": objective 2 not counted, supply run still follows.
  const r = H('country', 'ellensburg_haylee', 'noRoom', story, {}, 109, 'E');
  check('no room: +0, haylee=left, supply run still chains', r.applied && story.story('country').relationship === 55 && story.story('country').flags.haylee === 'left' && r.next === 'ellensburg_supply');
  check('supply line without Haylee has no tent', !story.resolveLine('country', 'ellensburg_supply').includes('tent'));
  // Vantage as-is → uniform reunion art; no-run cooler caption; Haylee "left" caption.
  H('country', 'ellensburg_supply', 'noRun', story, {}, 109, 'E');
  H('country', 'vantage_change', 'asIs', story, {}, 137);
  H('country', 'vantage_arrival', 'sendOff', story, {}, 137);
  const reunion = Object.values(story.canon().ledger).find(e => e.nodeId === 'beat' && e.choiceId === 'reunion');
  check('as-is + empty cooler + Haylee left → uniform art, "You came empty?", "does not look at you"', reunion?.panelKey === 'country.vantage_arrival.reunion_uniform' && /You came empty/.test(reunion.fallbackText?.line ?? '') && /does not look at you/.test(reunion.fallbackText?.line ?? ''));
  check('objectives after all three answered: supplies none, haylee left, change none → 0; rel 55 still lands Standard', countryObjectives(story.story('country')) === 0 && story.story('country').endingId === 'standard');
}

// ═══ 12. Classic Rock — ImprompTour (Ch. 18.8) ═══════════════════════════
const CR = (node, choice, story, hooks = {}, mile = 137) => story.commitChoice({ storyId: 'classicRock', nodeId: node, choiceId: choice, mile }, hooks);
function tour(choices, seed = {}) {
  const story = new StorySystem(freshSave()); const rec = recorder();
  for (const [node, choice] of choices) CR(node, choice, story, rec.hooks);
  return { story, rec };
}
{
  // Entry + boarding; she waits behind Brittney.
  const story = new StorySystem(freshSave()); const rec = recorder();
  story.run.passenger = { id: 'brittney', name: 'Brittney', storyId: 'country' };
  check('Vantage: waitress not offered while Brittney is in the seat', story.pendingAt('V').every(p => p.storyId !== 'classicRock'));
  story.run.passenger = null;
  check('Vantage: waitress entry once the seat is empty (mandatory)', story.pendingAt('V').some(p => p.storyId === 'classicRock' && p.nodeId === 'vantage_diner' && p.mandatory));
  const r = CR('vantage_diner', 'east', story, rec.hooks);
  check('east: rel seeded 50 → 55, continues to the offer at the same stop', r.next === 'vantage_offer' && story.story('classicRock').relationship === 55 && story.pendingAt('V').some(p => p.nodeId === 'vantage_offer'));
  CR('vantage_offer', 'accept', story, rec.hooks);
  check('accept: aboard, opener planned, rel 60', story.run.passenger?.id === 'waitress' && story.story('classicRock').flags.show1 === 'opener' && story.story('classicRock').relationship === 60);
  check('new run: still aboard', (story.resetRun(), story.run.passenger?.id === 'waitress'));
  check('Othello: cover first, show gated behind it', story.pendingAt('O').map(p => p.nodeId).join() === 'othello_cover');
  const c1 = CR('othello_cover', 'pay', story, rec.hooks, 184);
  check('cover: $50 once, leads to the show', rec.log.cash === -OTHELLO_COVER && c1.next === 'othello_show' && story.pendingAt('O').map(p => p.nodeId).join() === 'othello_show');
  CR('othello_show', 'hearBoth', story, rec.hooks, 184);
  check('hear both: another $50, tour on, rel 70', rec.log.cash === -(OTHELLO_COVER + OTHELLO_PROPOSITION) && story.story('classicRock').flags.tour === true && story.story('classicRock').relationship === 70);
  check('Othello closed', story.pendingAt('O').length === 0);
}
{
  // Drive Only: no cover, she performs, jealous line makes Washtucna the audition.
  const { story, rec } = tour([['vantage_diner', 'reliable'], ['vantage_offer', 'driveOnly']]);
  check('drive only: aboard, no cover node', story.run.passenger?.id === 'waitress' && story.pendingAt('O').map(p => p.nodeId).join() === 'othello_watch');
  CR('othello_watch', 'jealous', story, rec.hooks, 184);
  check('jealous: audition next, no cash', story.story('classicRock').flags.auditionNext === true && rec.log.cashCalls === 0);
  check('Washtucna line opens with "Audition night."', story.resolveLine('classicRock', 'washtucna_show').startsWith('Audition night.'));
}
{
  // Othello rejection ends it.
  const { story, rec } = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'reject']]);
  check('reject: failed, left at Othello, seat empty, only the cover paid', story.status('classicRock') === STORY_STATUS.FAILED && story.story('classicRock').endingId === 'left_at_othello' && story.run.passenger === null && rec.log.cash === -OTHELLO_COVER);
}
{
  // Hatton: four choices, money/relationship exactly once.
  const base = [['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth']];
  let t = tour(base); CR('hatton_nan', 'take', t.story, t.rec.hooks, 205);
  check('take $500: +500 once, failed, seat empty', t.rec.log.cash === -100 + NAN_OFFER && t.story.status('classicRock') === STORY_STATUS.FAILED && t.story.story('classicRock').endingId === 'nan_500' && t.story.run.passenger === null);
  check('take $500 twice: nothing', CR('hatton_nan', 'take', t.story, t.rec.hooks, 205).applied === false && t.rec.log.cashCalls === 3);
  t = tour(base); CR('hatton_nan', 'herCall', t.story, t.rec.hooks, 205);
  check('her call at rel 70 (≥3 stars): she stays, +5', t.story.isActive('classicRock') && t.story.story('classicRock').relationship === 75);
  t = tour([['vantage_diner', 'better'], ['vantage_offer', 'driveOnly'], ['othello_watch', 'jealous']]);   // rel 50
  CR('hatton_nan', 'herCall', t.story, t.rec.hooks, 205);
  check('her call below 3 stars: she leaves with Nan', t.story.status('classicRock') === STORY_STATUS.FAILED && t.story.story('classicRock').endingId === 'nan_choice');
  t = tour(base); CR('hatton_nan', 'refuse', t.story, t.rec.hooks, 205);
  check('refuse outright: she likes it (+10)', t.story.story('classicRock').relationship === 80);
  t = tour(base); CR('hatton_nan', 'demand', t.story, t.rec.hooks, 205);
  check('demand $1,000: ATM maxed, −10, controlling +1, no cash', t.story.story('classicRock').relationship === 60 && t.story.story('classicRock').flags.controlling === 1 && t.rec.log.cash === -100);
}
{
  // Washtucna + La Crosse economics.
  const base = [['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'refuse']];
  let t = tour(base); CR('washtucna_show', 'solo', t.story, t.rec.hooks, 228);
  check('W solo: +$300, rel −10, no duet Following, solo following 10, controlling', t.rec.log.cash === -100 + SHOW2_TOTAL && t.story.story('classicRock').relationship === 70 && t.story.story('classicRock').following === 0 && t.story.story('classicRock').flags.soloFollowing === 10 && t.story.story('classicRock').flags.controlling === 1);
  t = tour(base); CR('washtucna_show', 'equal', t.story, t.rec.hooks, 228);
  check('W equal: +$150, rel +10, Following +10', t.rec.log.cash === -100 + SHOW2_TOTAL / 2 && t.story.story('classicRock').relationship === 90 && t.story.story('classicRock').following === 10);
  t = tour(base); const g = CR('washtucna_show', 'giveAll', t.story, t.rec.hooks, 228);
  check('W give all: $0, rel +20, Following +20, trio line', t.rec.log.cash === -100 && t.story.story('classicRock').relationship === 100 && t.story.story('classicRock').following === 20 && g.entry.fallbackText.reply.startsWith('Oh, boy.'));
  const base2 = [...base, ['washtucna_show', 'equal']];
  t = tour(base2); CR('lacrosse_show', 'solo', t.story, t.rec.hooks, 253);
  check('L solo: +$400, rel −25, solo following 15', t.rec.log.cash === -100 + 150 + SHOW3_SOLO && t.story.story('classicRock').relationship === 65 && t.story.story('classicRock').flags.soloFollowing === 15 && t.story.pendingAt('L').length === 0);
  t = tour(base2); const d = CR('lacrosse_show', 'duet', t.story, t.rec.hooks, 253);
  check('L duet: +$400 (of $800), rel +15, Following +20, partner beat next', t.rec.log.cash === -100 + 150 + SHOW3_DUET / 2 && t.story.story('classicRock').relationship === 100 && t.story.story('classicRock').following === 30 && d.next === 'lacrosse_after');
  const a = CR('lacrosse_after', 'partner', t.story, t.rec.hooks, 253);
  check('partner line → "put that word in writing"', a.entry.fallbackText.reply.includes('in writing'));
}
{
  // Colfax routes + Pullman endings.
  const happy = [['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'refuse'], ['washtucna_show', 'equal'], ['lacrosse_show', 'duet'], ['lacrosse_after', 'partner']];
  let t = tour(happy);
  const f = CR('colfax_deal', 'fifty', t.story, t.rec.hooks, 274);
  check('50/50: partnership, naming next', t.story.story('classicRock').flags.deal === '5050' && f.next === 'colfax_name' && t.story.pendingAt('CO').map(p => p.nodeId).join() === 'colfax_name');
  CR('colfax_name', 'together', t.story, t.rec.hooks, 274);
  check('Pullman pending (mandatory)', t.story.pendingAt('P').some(p => p.nodeId === 'pullman_final' && p.mandatory));
  check('outcome: true ending (duet + partnership + rel > 80)', classicRockOutcome(t.story.story('classicRock')) === 'true_ending');
  check('Pullman line mentions the crowd', /30 of them came/.test(t.story.resolveLine('classicRock', 'pullman_final')));
  const cashBefore = t.rec.log.cash;
  const p = CR('pullman_final', 'play', t.story, t.rec.hooks, 289);
  check('true ending: +$5,000 once, Classic Rock owned, complete, seat empty, kiss', t.rec.log.cash - cashBefore === PULLMAN_PAY.true_ending && t.rec.log.unlocks.join() === 'classic_rock' && t.story.status('classicRock') === STORY_STATUS.COMPLETE && t.story.run.passenger === null && /kisses you/.test(p.entry.fallbackText.reply));
  check('Pullman double tap: nothing', CR('pullman_final', 'play', t.story, t.rec.hooks, 289).applied === false && t.rec.log.unlocks.length === 1);
  // Her name on the marquee at rel ≤ 80 → marquee.
  // rel: 45 → 50 → 40 (paying only) → 30 (demand) → 40 (equal) → 55 (duet) → 60 → 70 (50/50) → 80 (hers); controlling 2 → not broken.
  t = tour([['vantage_diner', 'better'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'payingOnly'], ['hatton_nan', 'demand'], ['washtucna_show', 'equal'], ['lacrosse_show', 'duet'], ['lacrosse_after', 'partner'], ['colfax_deal', 'fifty'], ['colfax_name', 'hers']]);
  check('marquee route (rel 80 exactly is NOT > 80)', t.story.story('classicRock').relationship === 80 && t.story.story('classicRock').flags.controlling === 2 && classicRockOutcome(t.story.story('classicRock')) === 'marquee');
  // 60/40 accepted only at rel ≥ 75.
  t = tour(happy); CR('colfax_deal', 'sixty', t.story, t.rec.hooks, 274);
  check('60/40 at rel 100: accepted, −5, naming next', t.story.story('classicRock').flags.deal === '6040' && t.story.story('classicRock').relationship === 95 && t.story.pendingAt('CO').map(p => p.nodeId).join() === 'colfax_name');
  CR('colfax_name', 'mine', t.story, t.rec.hooks, 274);
  CR('pullman_final', 'play', t.story, t.rec.hooks, 289);
  check('60/40 true ending pays the 60 share ($6,000)', t.story.story('classicRock').endingId === 'true_ending' && t.rec.log.cash === -100 + 150 + 400 + PULLMAN_PAY.business_6040);
  t = tour([['vantage_diner', 'better'], ['vantage_offer', 'driveOnly'], ['othello_watch', 'jealous'], ['hatton_nan', 'demand'], ['washtucna_show', 'equal'], ['lacrosse_show', 'duet'], ['lacrosse_after', 'partner']]);   // rel 50-5+5-10+10+15+5 = 70
  CR('colfax_deal', 'sixty', t.story, t.rec.hooks, 274);
  check('60/40 at rel 70: she walks — band implosion, no Pullman', t.story.status('classicRock') === STORY_STATUS.FAILED && t.story.story('classicRock').endingId === 'band_implosion' && t.story.run.passenger === null && t.story.pendingAt('P').length === 0);
  // Flat fee → Hired Voice: reaches Pullman, $7,500, NO unlock.
  t = tour(happy); CR('colfax_deal', 'flat', t.story, t.rec.hooks, 274);
  check('flat: hired voice, rel −15, no naming', t.story.story('classicRock').flags.deal === 'flat' && t.story.story('classicRock').relationship === 85 && t.story.pendingAt('CO').length === 0);
  const before = t.rec.log.cash;
  CR('pullman_final', 'play', t.story, t.rec.hooks, 289);
  check('Hired Voice: +$7,500, complete, NO Classic Rock unlock', t.rec.log.cash - before === PULLMAN_PAY.hired_voice && t.story.status('classicRock') === STORY_STATUS.COMPLETE && t.rec.log.unlocks.length === 0);
  // Refuse ownership (healthy) → implosion.
  t = tour(happy); CR('colfax_deal', 'refuse', t.story, t.rec.hooks, 274);
  check('refuse ownership: band implosion', t.story.story('classicRock').endingId === 'band_implosion' && t.story.run.passenger === null);
  // Solo sellout: partnership but solo at La Crosse.
  t = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'refuse'], ['washtucna_show', 'equal'], ['lacrosse_show', 'solo'], ['colfax_deal', 'fifty'], ['colfax_name', 'together']]);
  CR('pullman_final', 'play', t.story, t.rec.hooks, 289);
  check('solo sellout: $5,000, unlocks', t.story.story('classicRock').endingId === 'solo_sellout' && t.rec.log.cash === -100 + 150 + SHOW3_SOLO + PULLMAN_PAY.solo_sellout && t.rec.log.unlocks.join() === 'classic_rock');
  // Broken Voice: ≥3 controlling AND rel < 25 → she accepts anything.
  t = tour([['vantage_diner', 'better'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'payingOnly'], ['hatton_nan', 'demand'], ['washtucna_show', 'solo'], ['lacrosse_show', 'solo']]);
  const stB = t.story.story('classicRock');
  check('dark route: rel 50-5+5-10-10-10-25 = −5 → 0, controlling 4 → Broken Voice', stB.relationship === 0 && stB.flags.controlling === 4 && isBrokenVoice(stB));
  const rr = CR('colfax_deal', 'refuse', t.story, t.rec.hooks, 274);
  check('Broken Voice: refusing ownership is ACCEPTED, framed dark', t.story.story('classicRock').flags.deal === 'broken' && /stopped arguing/.test(rr.entry.fallbackText.reply) && t.story.isActive('classicRock'));
  const b0 = t.rec.log.cash;
  CR('pullman_final', 'play', t.story, t.rec.hooks, 289);
  check('Broken Voice: +$10,000, unlocks Classic Rock, ending broken_voice', t.rec.log.cash - b0 === PULLMAN_PAY.broken_voice && t.rec.log.unlocks.join() === 'classic_rock' && t.story.story('classicRock').endingId === 'broken_voice' && t.story.endingLabel('classicRock') === 'BROKEN VOICE');
  // Not broken: 2 controlling + low rel → refuse still implodes.
  t = tour([['vantage_diner', 'better'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'payingOnly'], ['hatton_nan', 'refuse'], ['washtucna_show', 'solo'], ['lacrosse_show', 'solo']]);   // controlling 3, rel 50-5+5-10+10-10-25 = 15
  check('3 controlling + rel 15 → broken', isBrokenVoice(t.story.story('classicRock')));
  t = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'demand'], ['washtucna_show', 'solo'], ['lacrosse_show', 'solo']]);   // controlling 3, rel 50+5+5+10-10-10-25 = 25
  check('3 controlling + rel 25 → NOT broken (needs < 25)', !isBrokenVoice(t.story.story('classicRock')));
  check('thresholds use raw relationship, never rounded stars', classicRockOutcome({ relationship: 81, flags: { deal: '5050', l: 'duet' } }) === 'true_ending' && classicRockOutcome({ relationship: 80, flags: { deal: '5050', l: 'duet' } }) === 'equal_partner');
}

// ═══ 13. Phase 6 — Meanwhile strips, hitchhiker gating, side quests ══════
{
  // Meanwhile from a pass hook: once, queued, three captions, comic strip page.
  const save = freshSave(); const story = new StorySystem(save);
  const { ComicSystem } = await import('../src/systems/ComicSystem.js');
  const comic = new ComicSystem(story);
  H('hiphop', 'seattle_offer', 'carry', story, {}, 4);
  story.exitPassed('M', 9.7, {}); story.exitPassed('I', 18.3, {});
  const q = story.peekMeanwhile();
  check('phone lock raises "Malik dispatches three cars" once, queued', !!q && q.stripId === 'malik_cars' && story.run.meanwhileQueue.length === 1);
  const entry = Object.values(story.canon().ledger).find(e => e.choiceId === 'mw_malik_cars');
  check('strip beat: importance meanwhile, three placeholder captions', entry?.importance === 'meanwhile' && entry.strip?.length === 3 && /caption pending/.test(entry.strip[0].text));
  const where = comic.pageFor(entry.key);
  const page = comic.pagesOf(where.volId).find(p => p.id === where.pageId);
  check('comic: strip on its own 3-slot page, captions per slot', page?.templateId === 'meanwhile' && page.panels.every(p => p.event?.strip?.length === 3));
  check('pull dequeues; second pass raises nothing', story.pullMeanwhile()?.stripId === 'malik_cars' && story.peekMeanwhile() === null && story.exitPassed('I', 18.4, {}).length === 0 && story.run.meanwhileQueue.length === 0);
  // Survives an exact resume.
  story.raiseMeanwhile('hiphop', 'stank_legal', 84);
  const snap = story.serialize(); const s2 = new StorySystem(reload()); s2.restore(snap);
  check('queue rides the snapshot', s2.peekMeanwhile()?.stripId === 'stank_legal');
  check('re-raising a shown strip is a no-op', story.raiseMeanwhile('hiphop', 'stank_legal', 85) === null && story.run.meanwhileQueue.length === 1);
  check('unknown strip ignored', story.raiseMeanwhile('hiphop', 'nope', 1) === null);
}
{
  // Choice-effect strips: Nan refused → wrong town; Ride 'Em → Brittney's friends; Cle Elum credited to Malik → Stank legal.
  const t = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'refuse']]);
  check('Nan refused → "Nan visits the wrong town" queued', t.story.peekMeanwhile()?.stripId === 'nan_wrong_town');
  const b = board(); const c = b.story.canon(); c.stories.country.relationship = 90; Object.assign(c.stories.country.flags, { supplies: 'full', haylee: 'aboard', changeChoice: 'full' }); b.story._writeCanon(c);
  b.story.run.nerve = 20; b.story.run.flags.cleanPasses = 9;
  H('country', 'vantage_arrival', 'sendOff', b.story, b.rec.hooks, 137);
  check("Ride 'Em → Brittney's friends strip", b.story.peekMeanwhile()?.stripId === 'brittney_friends');
  const hh = new StorySystem(freshSave());
  H('hiphop', 'seattle_offer', 'carry', hh, {}, 4); H('hiphop', 'mercer_fork', 'keepJob', hh, {}, 9); H('hiphop', 'issaquah_kyle', 'handOver', hh, {}, 18);
  H('hiphop', 'northbend_dom', 'delay', hh, {}, 32); H('hiphop', 'pass_tennessee', 'creditMalik', hh, {}, 53); H('hiphop', 'cleelum_store', 'deliver', hh, {}, 84);
  check('Cle Elum credited to Malik alone → Stank legal strip', hh.peekMeanwhile()?.stripId === 'stank_legal');
}
{
  // Hitchhiker gating.
  const story = new StorySystem(freshSave());
  check('no story started: open everywhere except Vantage (the waitress could still board there)', !story.hitchhikerBlocked('M') && story.hitchhikerBlocked('V') && !story.hitchhikerBlocked('B'));
  H('hiphop', 'seattle_offer', 'carry', story, {}, 4);
  check('phone live, Mercer fork open: blocked at Mercer only', story.hitchhikerBlocked('M') && !story.hitchhikerBlocked('B'));
  check('waitress available: blocked at Vantage', story.hitchhikerBlocked('V'));
  H('hiphop', 'mercer_fork', 'ride', story, {}, 9);
  check('Brittney aboard: blocked everywhere', story.hitchhikerBlocked('B') && story.hitchhikerBlocked('SQ') && story.hitchhikerBlocked('E'));
  const c = story.canon(); c.stories.country.relationship = 60; story._writeCanon(c);
  H('country', 'vantage_arrival', 'sendOff', story, {}, 137);
  check('after she leaves: Vantage still blocked (waitress could board), later stops open', story.hitchhikerBlocked('V') && !story.hitchhikerBlocked('O'));
  H('classicRock', 'vantage_diner', 'east', story, {}, 137); H('classicRock', 'vantage_offer', 'accept', story, {}, 137);
  check('waitress aboard: blocked again', story.hitchhikerBlocked('O'));
  const t = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'reject']]);
  check('after she leaves for good: open (arc failed, nobody can board)', !t.story.hitchhikerBlocked('H') && !t.story.hitchhikerBlocked('V'));
}
{
  // Side quest A — Dom's tape: optional at North Bend after a promise, B-side at the press, bonus at Cle Elum.
  const story = new StorySystem(freshSave()); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4); H('hiphop', 'mercer_fork', 'keepJob', story, rec.hooks, 9); H('hiphop', 'issaquah_kyle', 'handOver', story, rec.hooks, 18);
  const r = H('hiphop', 'northbend_dom', 'promise', story, rec.hooks, 32);
  check('promise leads to the tape offer (optional, same stop)', r.next === 'dom_tape' && story.pendingAt('N').some(p => p.nodeId === 'dom_tape' && p.mandatory === false));
  check('no B-side option without the tape', !story.choicesFor('hiphop', 'pass_tennessee').some(ch => ch.id === 'bside'));
  H('hiphop', 'dom_tape', 'take', story, rec.hooks, 32);
  check('tape taken: item, rel +5 (95), Dom node closed', story.story('hiphop').items.domTape === true && story.story('hiphop').relationship === 95 && story.pendingAt('N').length === 0);
  check('B-side option now offered', story.choicesFor('hiphop', 'pass_tennessee').some(ch => ch.id === 'bside'));
  H('hiphop', 'pass_tennessee', 'bside', story, rec.hooks, 53);
  check('B-side pressed: producer credit, tape consumed, records 100', story.story('hiphop').flags.bside === true && story.story('hiphop').flags.creditOut === 'producer' && !story.story('hiphop').items.domTape && story.run.cargo.records === 100);
  H('hiphop', 'cleelum_store', 'deliver', story, rec.hooks, 84);
  check('Cle Elum: pristine + $250 B-side bonus, no Stank strip (credit went to Dom)', rec.log.cash === 2750 && story.peekMeanwhile() === null);
  // Declining is casual and leaves nothing behind.
  const s2 = new StorySystem(freshSave());
  H('hiphop', 'seattle_offer', 'carry', s2, {}, 4); H('hiphop', 'mercer_fork', 'keepJob', s2, {}, 9); H('hiphop', 'issaquah_kyle', 'handOver', s2, {}, 18); H('hiphop', 'northbend_dom', 'promise', s2, {}, 32);
  const d = H('hiphop', 'dom_tape', 'leave', s2, {}, 32);
  check('declining the tape: no ledger entry, no item', d.applied && d.entry === null && !s2.story('hiphop').items.domTape);
}
{
  // Side quest B — the aux cord: radio hook fires once, payoff line at Vantage.
  const { story } = board(); const radio = [];
  check('aux quest optional at Bellevue behind the need', story.pendingAt('B').some(p => p.nodeId === 'brittney_aux' && !p.mandatory) && story.pendingAt('B')[0].mandatory === true || story.pendingAt('B').length === 1);
  const r = story.commitChoice({ storyId: 'country', nodeId: 'brittney_aux', choiceId: 'give', mile: 12 }, { radio: (c) => radio.push(c) });
  check('give: radio → country once, rel +5', r.applied && radio.join() === 'country' && story.story('country').relationship === 60);
  story.commitChoice({ storyId: 'country', nodeId: 'brittney_aux', choiceId: 'give', mile: 12 }, { radio: (c) => radio.push(c) });
  check('give twice: radio not re-fired', radio.length === 1);
  const c = story.canon(); c.stories.country.relationship = 60; story._writeCanon(c);
  const v = H('country', 'vantage_arrival', 'sendOff', story, {}, 137);
  check('Vantage reply pays off the aux cord', /keeps your aux cord/.test(v.entry.fallbackText.reply));
}
{
  // Side quest C — the set list foreshadows Colfax and changes La Crosse.
  const t = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'refuse'], ['washtucna_show', 'equal']]);
  check('set list offered after show two (optional)', t.story.pendingAt('W').some(p => p.nodeId === 'setlist' && !p.mandatory));
  CR('setlist', 'mine', t.story, t.rec.hooks, 228);
  check('"mine": controlling +1, solo following +5, La Crosse line changes', t.story.story('classicRock').flags.controlling === 1 && t.story.story('classicRock').flags.soloFollowing === 5 && t.story.resolveLine('classicRock', 'lacrosse_show').startsWith('We open with yours.'));
  const t2 = tour([['vantage_diner', 'east'], ['vantage_offer', 'accept'], ['othello_cover', 'pay'], ['othello_show', 'hearBoth'], ['hatton_nan', 'refuse'], ['washtucna_show', 'equal'], ['setlist', 'hers']]);
  check('"hers": rel +5, La Crosse opens with hers', t2.story.story('classicRock').relationship === 95 && t2.story.resolveLine('classicRock', 'lacrosse_show').startsWith('We open with mine'));
}

console.log(`story tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

// ── Special beats (2026-09-10): intro / beatsBefore / beats emission ─────
{
  const save = freshSave(); const story = new StorySystem(save); const rec = recorder();
  const beats = () => Object.values(story.canon().ledger).filter(e => e.nodeId === 'beat');
  const n1 = story.noteNodeShown('hiphop', 'seattle_lot', 4);
  const n2 = story.noteNodeShown('hiphop', 'seattle_lot', 4);
  check('intro beat recorded once when the node is shown', n1 === 1 && n2 === 0);
  check('intro beat carries the AUTHORED panel key', beats().some(e => e.panelKey === 'hiphop.seattle_lot'));
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  const order = Object.values(story.canon().ledger).map(e => e.panelKey);
  const iIntro = order.indexOf('hiphop.seattle_lot'), iCarry = order.indexOf('hiphop.seattle_offer.carry'), iRadio = order.indexOf('hiphop.seattle_offer.carry.radio');
  check('follow-up beat recorded AFTER the choice (intro → choice → radio)', iIntro >= 0 && iCarry > iIntro && iRadio > iCarry);
  // beatsBefore: Kyle's session lands BEFORE the hand-over entry
  H('hiphop', 'mercer_fork', 'keepJob', story, rec.hooks, 9);
  H('hiphop', 'issaquah_kyle', 'handOver', story, rec.hooks, 18);
  const o2 = Object.values(story.canon().ledger).map(e => e.panelKey);
  check('beatsBefore lands before its choice (session → handOver)', o2.indexOf('hiphop.issaquah_kyle.session') >= 0 && o2.indexOf('hiphop.issaquah_kyle.session') < o2.indexOf('hiphop.issaquah_kyle.handOver'));
  // node-level beats after ANY choice at the node (pressing → loaded), and idempotent on replay of the same commit
  H('hiphop', 'northbend_dom', 'delay', story, rec.hooks, 30);
  H('hiphop', 'pass_tennessee', 'creditMalik', story, rec.hooks, 52);
  const o3 = Object.values(story.canon().ledger).map(e => e.panelKey);
  check('node beats follow the choice in authored order (pressing then loaded)', o3.indexOf('hiphop.pass_tennessee.pressing') > o3.indexOf('hiphop.pass_tennessee.creditMalik') && o3.indexOf('hiphop.pass_tennessee.loaded') > o3.indexOf('hiphop.pass_tennessee.pressing'));
  const before = beats().length; H('hiphop', 'pass_tennessee', 'creditMalik', story, rec.hooks, 52);
  check('replaying a commit adds no duplicate beats', beats().length === before);
  // explicit panelKey on api.beat / recordBeat
  story.recordBeat({ storyId: 'hiphop', beatId: 'first_tail', panelKey: 'hiphop.vantage_recovery.first_tail', text: 'x', mile: 130 });
  check('recordBeat honours an explicit panelKey', beats().some(e => e.panelKey === 'hiphop.vantage_recovery.first_tail'));
  story.recordBeat({ storyId: 'country', beatId: 'roadside_exit', text: 'y', mile: 40 });
  check('recordBeat without panelKey keeps the generic beat key', beats().some(e => e.panelKey === 'country.beat.roadside_exit'));
}


// ── Mercer handoff (2026-09-10): the "both" → ultimatum fork ─────────────
{
  const save = freshSave(); const story = new StorySystem(save); const rec = recorder();
  H('hiphop', 'seattle_offer', 'carry', story, rec.hooks, 4);
  const r1 = H('hiphop', 'mercer_fork', 'both', story, rec.hooks, 9);
  check('both: +3 banked, chains to the ultimatum, Mercer not done yet', r1.applied && r1.next === 'mercer_ultimatum' && story.story('hiphop').flags.mercerPressed === true && !story.story('hiphop').flags.mercerDone);
  H('hiphop', 'mercer_ultimatum', 'chooseBrittney', story, rec.hooks, 9);
  check('chooseBrittney: Country starts at 50 + 5, Malik −10 (60 → 50), phone left, Brittney seated',
    story.status('country') === STORY_STATUS.ACTIVE && story.story('country').relationship === 55
    && story.run.passenger?.id === 'brittney' && story.story('hiphop').items?.phone == null);
  const s2 = new StorySystem(freshSave()); const r2 = recorder();
  H('hiphop', 'seattle_offer', 'carry', s2, r2.hooks, 4);
  H('hiphop', 'mercer_fork', 'both', s2, r2.hooks, 9);
  H('hiphop', 'mercer_ultimatum', 'keepPromise', s2, r2.hooks, 9);
  check('keepPromise: Brittney stays, delivery continues, Malik +10 (70)', s2.story('hiphop').flags.mercerDone === true && s2.story('hiphop').flags.path === 'hiphop' && s2.story('hiphop').flags.brittneyRefused === true && s2.story('hiphop').relationship === 70 && !s2.run.passenger);
  check('Seattle chain is live-only: non-consequential tiles leave no ledger entry', !Object.values(s2.canon().ledger).some(e => ['seattle_lot', 'seattle_clock', 'seattle_route', 'mercer_counter', 'mercer_hook'].includes(e.nodeId)));
}
