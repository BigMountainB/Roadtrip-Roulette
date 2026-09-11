// ── ComicSystem (Ch. 18.3) — node CLI tests ───────────────────────────────
// Run: node tests/comic.test.mjs   (also `npm test`)
//
// Events are recorded exactly once per ledger key; chapters follow runs;
// page templates are deterministic and lock when complete; volumes close on
// Pullman arrival and the next beat opens the next volume; everything
// round-trips through SaveSystem; dialogue resolves by stable key with the
// saved fallback; plate reset wipes the book.

import { SaveSystem } from '../src/systems/SaveSystem.js';
import { StorySystem, STORY_STATUS } from '../src/systems/StorySystem.js';
import { ComicSystem } from '../src/systems/ComicSystem.js';
import { PAGE_TEMPLATES, FLOW_CYCLE, panelMeta, DEFAULT_PANEL_META } from '../src/data/comicPanels.js';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
function freshSave() { store.clear(); return new SaveSystem(); }

/** A long linear story: N flow nodes then a major, a climax and an ending. */
function linearDefs(n = 9) {
  const nodes = {};
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(`n${i}`);
  ids.push('big', 'peak', 'fin');
  const imp = (id) => id === 'big' ? 'major' : id === 'peak' ? 'climax' : id === 'fin' ? 'ending' : 'choice';
  ids.forEach((id, i) => {
    const next = ids[i + 1] ?? null;
    nodes[id] = { stopId: 'S', speaker: `NPC ${id}`, portrait: 'grandma', line: `Line ${id}`, importance: imp(id),
      choices: [{ id: 'go', label: `Go ${id}`, reply: `Reply ${id}`, consequential: true, next,
                  effects: next ? {} : { ending: 'done' } }] };
  });
  return { t: { id: 't', version: 1, title: 'T', genre: 'country', entry: { stopId: 'S' }, startNode: 'n0', nodes } };
}
function rig(defs = linearDefs()) {
  const save = freshSave();
  const story = new StorySystem(save, defs);
  const comic = new ComicSystem(story);
  return { save, story, comic };
}
const go = (story, node, mile = 1) => story.commitChoice({ storyId: 't', nodeId: node, choiceId: 'go', mile, at: Date.now() + mile }, {});

// ═══ 1. Templates + metadata defaults ═════════════════════════════════════
{
  check('all templates have slots inside the page', Object.values(PAGE_TEMPLATES).every(t => t.slots.every(s => s.x >= 0 && s.y >= 0 && s.x + s.w <= 1.0001 && s.y + s.h <= 1.4143)));
  check('flow cycle names real templates', FLOW_CYCLE.every(id => PAGE_TEMPLATES[id]?.kind === 'flow'));
  check('unknown panel key → default meta', JSON.stringify(panelMeta('nope.nope')) === JSON.stringify({ ...DEFAULT_PANEL_META }));
}

// ═══ 2. Record once per key; volume + chapter open on first beat ═════════
{
  const { story, comic } = rig();
  check('no volumes before any beat', comic.volumes().length === 0 && comic.activeVolume() === null);
  const r = go(story, 'n0');
  const vol = comic.activeVolume();
  check('first beat opens volume 1', vol?.n === 1 && vol.status === 'open' && vol.events.length === 1);
  check('first beat opens chapter 1 on this run', vol.chapters.length === 1 && vol.chapters[0].runId === story.runId && vol.chapters[0].eventIds.length === 1);
  check('event carries ledger key + panel key + speaker', vol.events[0].key === r.entry.key && vol.events[0].panelKey === 't.n0' && vol.events[0].speaker === 'NPC n0');
  check('TO BE CONTINUED while open', comic.isToBeContinued(vol));
  // Duplicate commit (double tap) → no second event.
  go(story, 'n0');
  check('duplicate commit adds no event', comic.activeVolume().events.length === 1);
  // Direct re-record of the same entry → same event back, still one.
  const again = comic.record(r.entry, {});
  check('record() is idempotent per key', again?.id === vol.events[0].id && comic.activeVolume().events.length === 1);
  check('junk record ignored', comic.record(null) === null && comic.record({ nope: 1 }) === null);
}

// ═══ 3. Deterministic page assignment + locking ══════════════════════════
{
  const { story, comic } = rig();
  for (let i = 0; i < 9; i++) go(story, `n${i}`, i + 1);
  let vol = comic.activeVolume();
  // 9 flow events: two_up(2) + one_wide_two_small(3) + four_grid(4) = 9 → 3 locked pages.
  check('flow pages cycle two_up → one_wide_two_small → four_grid', vol.pages.map(p => p.templateId).join(',') === 'two_up,one_wide_two_small,four_grid');
  check('all three pages full + locked', vol.pages.every(p => p.locked && p.slots.every(Boolean)));
  go(story, 'big', 10);
  vol = comic.activeVolume();
  // Corrective pass 2026-09-11: MAJOR and CLIMAX beats FLOW (no page of their own);
  // the 9 flow events filled 3 pages, so the major starts page 4 (two_up) and the
  // climax joins it; only the ENDING takes a full page.
  check('major flows onto the next page (no wide page of its own)', vol.pages[3].templateId === 'two_up' && vol.pages[3].slots[0] === vol.events[9].id);
  go(story, 'peak', 11);
  go(story, 'fin', 12);
  vol = comic.activeVolume() ?? comic.volumes()[0];
  check('climax shares the major\'s page; the ending takes its own', vol.pages[3].slots[1] === vol.events[10].id && vol.pages[4].templateId === 'ending');
  check('story complete, volume still OPEN (only Pullman closes it)', story.status('t') === STORY_STATUS.COMPLETE && vol.status === 'open');
  // Same events → same book (determinism).
  const r2 = rig();
  for (let i = 0; i < 9; i++) go(r2.story, `n${i}`, i + 1);
  go(r2.story, 'big', 10); go(r2.story, 'peak', 11); go(r2.story, 'fin', 12);
  const sig = (v) => v.pages.map(p => p.templateId + ':' + p.slots.map(s => s ? 1 : 0).join('')).join('|');
  check('identical sequence → identical layout', sig(r2.comic.volumes()[0]) === sig(vol));
  // A half-filled page gets locked (not reused) when a major lands.
  const r3 = rig();
  go(r3.story, 'n0', 1);
  r3.story.advance('t', 'big');
  go(r3.story, 'big', 2);
  const v3 = r3.comic.activeVolume();
  check('a major joins the open half page (no forced page break)', v3.pages[0].slots.filter(Boolean).length === 2);
}

// ═══ 4. Chapters follow runs; unfinished page locks at chapter end ═══════
{
  const { story, comic } = rig();
  go(story, 'n0', 1);
  const run1 = story.runId;
  story.resetRun();                 // new trip, same plate
  go(story, 'n1', 2);
  const vol = comic.activeVolume();
  check('second run → chapter 2', vol.chapters.length === 2 && vol.chapters[0].status === 'closed' && vol.chapters[1].runId === story.runId && vol.chapters[0].runId === run1);
  check('chapter 1 page locked with an empty slot', vol.pages[0].locked && vol.pages[0].slots.includes(null));
  check('chapter 2 starts its own page', vol.pages[1].chapterId === vol.chapters[1].id && !vol.pages[1].locked);
  const pages = comic.pagesOf(vol.id);
  check('pagesOf resolves chapter numbers + template + events', pages[0].chapterN === 1 && pages[1].chapterN === 2 && pages[0].template === PAGE_TEMPLATES.two_up && pages[0].panels[0].event?.text.line === 'Line n0' && pages[0].panels[1].event === null);
}

// ═══ 5. Pullman closes the volume; next beat opens volume 2 ══════════════
{
  const { story, comic } = rig();
  check('closing an empty/nonexistent volume is a no-op', comic.closeVolume('pullman') === false);
  go(story, 'n0', 1);
  check('close on Pullman', comic.closeVolume('pullman') === true);
  const v1 = comic.volumes()[0];
  check('volume 1 complete, pages + chapters locked', v1.status === 'complete' && v1.closedBy === 'pullman' && v1.pages.every(p => p.locked) && v1.chapters.every(c => c.status === 'closed'));
  check('no active volume after close', comic.activeVolume() === null && !comic.isToBeContinued(v1));
  check('double close is a no-op', comic.closeVolume('pullman') === false);
  go(story, 'n1', 2);
  check('next beat opens volume 2, volume 1 untouched', comic.volumes().length === 2 && comic.activeVolume().n === 2 && comic.volumes()[0].events.length === 1);
  // Replay after completion → still appends to the OPEN volume, never rewrites vol 1.
  for (const n of ['n2','n3','n4','n5','n6','n7','n8','big','peak','fin']) go(story, n, 3);
  check('story complete', story.status('t') === STORY_STATUS.COMPLETE);
  story.beginReplay('t');
  go(story, 'n0', 50);
  check('replay beat lands in volume 2 as a new event (attempt 1 key)', comic.activeVolume().n === 2 && comic.activeVolume().events.filter(e => e.nodeId === 'n0').length === 1 && comic.volumes()[0].events.length === 1);
}

// ═══ 6. Persistence round-trip + reset ═══════════════════════════════════
{
  const { save, story, comic } = rig();
  go(story, 'n0', 1); go(story, 'n1', 2);
  const before = JSON.stringify(comic.volumes());
  const s2 = new SaveSystem();
  const story2 = new StorySystem(s2, linearDefs());
  const comic2 = new ComicSystem(story2);
  check('volumes survive a reload byte-for-byte', JSON.stringify(comic2.volumes()) === before);
  // Dialogue: key present → current copy; key gone → fallback.
  const ev = comic2.activeVolume().events[0];
  check('resolve by key (custom defs aren\'t in the global index → fallback copy)', comic2.resolveEvent(ev).text.line === 'Line n0' && comic2.resolveEvent(ev).text.reply === 'Reply n0');
  // Reset wipes the book, keeps genres.
  s2.set('genresOwned', ['country']);
  s2.resetProgress();
  const s3 = new SaveSystem();
  check('reset: comic gone', new ComicSystem(new StorySystem(s3)).volumes().length === 0);
  check('reset: genre kept', JSON.stringify(s3.get('genresOwned')) === '["country"]');
  // Sandbox: a Custom run's panels never persist.
  const s4 = new SaveSystem(); const st4 = new StorySystem(s4, linearDefs()); const cm4 = new ComicSystem(st4);
  s4.setSandbox(true);
  go(st4, 'n0', 1);
  check('sandbox: panel visible in the run', cm4.volumes().length === 1);
  s4.setSandbox(false);
  check('sandbox: nothing persisted', cm4.volumes().length === 0);
}

// ═══ 7. Meanwhile strip page ═════════════════════════════════════════════
{
  const defs = linearDefs(2);
  defs.t.nodes.n1.importance = 'meanwhile';
  const { story, comic } = rig(defs);
  go(story, 'n0', 1); go(story, 'n1', 2);
  const vol = comic.activeVolume();
  check('meanwhile → its own 3-slot strip page, one event', vol.pages[1].templateId === 'meanwhile' && vol.pages[1].slots.every(s => s === vol.events[1].id) && vol.events[1].panels === 3);
}

console.log(`comic tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
