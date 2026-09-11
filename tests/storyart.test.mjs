// ── Ch.18 story-art mapping contract ──────────────────────────────────────
// Run: node tests/storyart.test.mjs   (also `npm test`)
//
// Story art is NEVER chosen from a filename or a node id alone.  A committed
// choice resolves its panel through an authored-first order, the winning key is
// PERSISTED on the ledger entry, and a beat with no approved art shows a
// placeholder — never a semantically-nearby or unrelated image.
//
// Resolution order (comicPanels.resolvePanelKey):
//   1. explicit choice.panelKey   (AUTHORITATIVE, terminal)
//   2. <storyId>.<nodeId>.<choiceId> if mapped
//   3. explicit node.panelKey     (AUTHORITATIVE, terminal)
//   4. <storyId>.<nodeId> if mapped
//   5. null → placeholder

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PANEL_META, panelMeta, panelKeyFor, resolvePanelKey, hasPanelArt }
  from '../src/data/comicPanels.js';
import { FEATURED_STORIES } from '../src/data/featuredStories.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log(`  ✗ FAIL: ${name}`); } };

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};

const { SaveSystem }  = await import('../src/systems/SaveSystem.js');
const { StorySystem } = await import('../src/systems/StorySystem.js');
const { ComicSystem } = await import('../src/systems/ComicSystem.js');

// ── 1. Resolution order, every step ──────────────────────────────────────
// Uses real mapped keys so the assertions can't pass against an empty table.
const NODE_KEY   = 'hiphop.mercer_fork';
const CHOICE_KEY = 'hiphop.mercer_fork.keepJob';
check('fixture: node key is mapped',   !!PANEL_META[NODE_KEY]);
check('fixture: choice key is mapped', !!PANEL_META[CHOICE_KEY]);

check('1: explicit choice.panelKey wins',
  resolvePanelKey({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'keepJob',
                    choice: { panelKey: 'country.mercer_fork.ride' } }) === 'country.mercer_fork.ride');
// Terminal on purpose: an authored key that lacks art must yield a placeholder,
// not fall through to a different picture.
check('1: explicit choice.panelKey is TERMINAL even when unmapped',
  resolvePanelKey({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'keepJob',
                    choice: { panelKey: 'nope.not.mapped' } }) === 'nope.not.mapped');
check('2: choice-level mapping beats the node mapping',
  resolvePanelKey({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'keepJob' }) === CHOICE_KEY);
check('3: explicit node.panelKey used when no choice mapping',
  resolvePanelKey({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'zzz',
                    node: { panelKey: 'country.mercer_fork.ride' } }) === 'country.mercer_fork.ride');
check('4: node mapping when nothing else matches',
  resolvePanelKey({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'zzz' }) === NODE_KEY);
check('5: unmapped everything → null (placeholder)',
  resolvePanelKey({ storyId: 'nope', nodeId: 'nope', choiceId: 'nope' }) === null);
check('5: null is not a string key', typeof resolvePanelKey({ storyId: 'x', nodeId: 'y' }) !== 'string');

// Establishing key is node-only and never carries a choice.
check('establishing key is node-only', panelKeyFor('hiphop', 'mercer_fork') === NODE_KEY);

// ── 2. The Mercer cross-story case ───────────────────────────────────────
{
  const node = FEATURED_STORIES.hiphop.nodes.mercer_fork;
  const ride = node.choices.find(c => c.id === 'ride');
  check('mercer ride choice exists', !!ride);
  check('mercer ride carries an explicit panelKey', ride.panelKey === 'country.mercer_fork.ride');
  check('mercer ride RESOLVES to the country panel',
    resolvePanelKey({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'ride', node, choice: ride })
      === 'country.mercer_fork.ride');
  check('country.mercer_fork.ride is mapped art', hasPanelArt('country.mercer_fork.ride'));
  // Ledger identity must NOT be rewritten to chase artwork.
  check('ride still belongs to the hiphop story', FEATURED_STORIES.hiphop.nodes.mercer_fork !== undefined);
}

// ── 3. Sweep: every consequential choice with approved choice art reaches it ─
{
  let reachable = 0, wrong = 0;
  for (const [storyId, def] of Object.entries(FEATURED_STORIES)) {
    for (const [nodeId, node] of Object.entries(def.nodes ?? {})) {
      for (const choice of node.choices ?? []) {
        if (choice.consequential === false) continue;
        const key = `${storyId}.${nodeId}.${choice.id}`;
        if (!PANEL_META[key] && !choice.panelKey) continue;
        const got = resolvePanelKey({ storyId, nodeId, choiceId: choice.id, node, choice });
        const want = choice.panelKey ?? key;
        if (got === want) reachable++;
        else { wrong++; console.log(`      ${key}: got ${got}, want ${want}`); }
      }
    }
  }
  check('every approved choice-level panel is reachable', wrong === 0);
  check('the sweep actually found choice panels (>10)', reachable > 10);
  console.log(`      → ${reachable} choice-level panels now reachable`);
}

// ── 4. Every mapped art path exists on disk ──────────────────────────────
{
  let missing = 0;
  for (const [key, m] of Object.entries(PANEL_META)) {
    if (!m.art) continue;
    if (!existsSync(ROOT + 'public/' + m.art)) { missing++; console.log(`      missing: ${key} → ${m.art}`); }
  }
  check('every mapped art file exists on disk', missing === 0);
}

// ── 5. No UNWIRED / REJECTED art mapped as production ────────────────────
// Status is authored in STORY_ART_CHECKLIST.md, NOT in the filename — names
// like `bellevue_03_reject_bribe.png` are legitimate story content (the player
// rejects the bribe).  Parse the checklist, which is the authority.
{
  const checklistPath = ROOT + 'public/assets/storylines/STORY_ART_CHECKLIST.md';
  if (!existsSync(checklistPath)) {
    check('STORY_ART_CHECKLIST.md is present', false);
  } else {
    const md = readFileSync(checklistPath, 'utf8');
    const rejected = new Set();
    for (const line of md.split('\n')) {
      if (!/UNWIRED/i.test(line)) continue;
      const m = line.match(/`([^`]+\.png)`/);
      if (m) rejected.add(m[1].replace(/^\/+/, ''));
    }
    check('checklist lists some UNWIRED/REJECTED art', rejected.size > 0);
    const mappedBad = Object.entries(PANEL_META).filter(([, m]) => {
      if (!m.art) return false;
      const rel = m.art.replace(/^assets\/storylines\//, '');
      return rejected.has(rel);
    });
    check('no UNWIRED/REJECTED art is mapped as production art', mappedBad.length === 0);
    if (mappedBad.length) for (const [k, m] of mappedBad) console.log(`      ${k} → ${m.art}`);
    console.log(`      → ${rejected.size} files marked UNWIRED/REJECTED in the checklist`);
  }
}

// ── 6. commitChoice PERSISTS the resolved key, and the comic uses it ─────
{
  store.clear();
  const save  = new SaveSystem();
  const story = new StorySystem(save);
  const comic = new ComicSystem(story);
  story.activate('hiphop', { nodeId: 'mercer_fork' });

  const r = story.commitChoice({ storyId: 'hiphop', nodeId: 'mercer_fork', choiceId: 'ride', mile: 10, stopId: 'M' });
  check('commit applied', r.applied === true);
  check('ledger entry carries a panelKey', typeof r.entry?.panelKey === 'string');
  check('persisted key is the CROSS-STORY one (not the node id)',
    r.entry?.panelKey === 'country.mercer_fork.ride');
  check('persisted key is NOT the node-only fallback',
    r.entry?.panelKey !== 'hiphop.mercer_fork');
  // Ledger identity is untouched — only the art key bridges stories.
  check('ledger keeps hiphop identity', r.entry?.storyId === 'hiphop');

  const ev = comic.activeVolume()?.events?.find(e => e.choiceId === 'ride');
  check('comic event exists', !!ev);
  check('comic event uses the persisted panelKey', ev?.panelKey === 'country.mercer_fork.ride');
  check('comic event resolves to real art', hasPanelArt(ev?.panelKey));

  // Survives a save round-trip (the book must re-render identically later).
  const reloaded = new ComicSystem(new StorySystem(new SaveSystem()));
  const ev2 = reloaded.activeVolume()?.events?.find(e => e.choiceId === 'ride');
  check('panelKey survives a save/load round-trip',
    ev2?.panelKey === 'country.mercer_fork.ride');
}

// ── 7. Missing art → placeholder, never a substitute ─────────────────────
{
  const m = panelMeta('definitely.not.a.panel');
  check('unmapped key yields no art', !m.art);
  check('unmapped key still yields usable balloon geometry',
    !!m.bubble && typeof m.bubble.x === 'number');
  check('panelMeta(null) is safe', !panelMeta(null).art);
}

// ── 8. The live tile: establishing → response, and no stand-in portrait ──
{
  const tileSrc = readFileSync(ROOT + 'src/ui/StoryTile.js', 'utf8');
  check('tile no longer imports the NPC portrait', !/^import \{ getPortrait \}/m.test(tileSrc));
  check('tile does not draw a portrait texture', !tileSrc.includes('port.texture'));
  check('tile starts from the ESTABLISHING node key',
    /let panelKey = panelKeyFor\(storyId, nodeId\)/.test(tileSrc));
  check('tile can swap panels', /setPanelKey\(key\)/.test(tileSrc));
  check('pick() swaps to the committed panel before the comic',
    /tile\.setPanelKey\([\s\S]{0,200}r\?\.entry\?\.panelKey/.test(tileSrc));
  check('tile draws meta.art', /scene\.add\.image\([^)]*url\)/.test(tileSrc));
  check('tile shows a placeholder when art is absent',
    tileSrc.includes('STORY ART PENDING'));
  // Authored coords are 16:9; the tile is 20:9 — they must map to the ART rect.
  // Strip comments first: the fix's own comment quotes the old expression, so a
  // raw source scan would fail on the explanation rather than on real code.
  const tileCode = tileSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/[^\n]*/g, '$1');
  check('balloons map to the art rect, not the whole tile',
    tileCode.includes('rectPx(meta.bubble)') && !/b\.x \* TILE_W/.test(tileCode));
  check('art is contain-fitted to a 16:9 box', /ART_H \* \(16 \/ 9\)/.test(tileSrc));

  // ── Tile persists until the player taps (owner 2026-09-07) ──
  check('tap gate exists', /function awaitTapThen\(fn\)/.test(tileCode));
  check('advance is routed through the tap gate',
    /awaitTapThen\(\(\) => \{[\s\S]{0,400}openNode\(storyId, nextId, nextNode\)/.test(tileCode));
  check('the tap gate can end the conversation too',
    /awaitTapThen\(\(\) => \{[\s\S]{0,500}finish\(\);/.test(tileCode));
  check('a drag is not a tap (movement threshold)', /moved > 12/.test(tileCode));
  check('gate requires a matching pointerdown first', /if \(!down\) return;/.test(tileCode));
  check('player is prompted', tileSrc.includes('TAP TO CONTINUE'));
  check('gate is one-shot', /if \(spent\) return; spent = true;/.test(tileCode));
  check('gate detaches its listeners', /off\('pointerup', onUpTap\)/.test(tileCode));
  // The gate MUST hook the scrim/dragZone objects, not scene.input: both call
  // _eatTap -> ev.stopPropagation(), which aborts Phaser's scene-level pointer
  // event, so a scene.input listener never fires and the prompt is dead.
  check('gate hooks the tap objects, not scene.input',
    /const taps = \[dragZone, scrim\]/.test(tileCode));
  check('gate does not listen for pointers on scene.input',
    !/scene\.input\.on\('pointer(down|up)', on(Down|UpTap)\)/.test(tileCode));
  // SPACE/ENTER must advance the conversation rather than falling through to
  // the rest stop's "leave" binding.
  check('gate consumes SPACE', /keyboard\?\.on\('keydown-SPACE', onKey\)/.test(tileCode));
  check('gate releases SPACE on cleanup', /keyboard\?\.off\('keydown-SPACE', onKey\)/.test(tileCode));
  check('conversation flags the scene as owning the screen',
    tileCode.includes('scene._storyTileOpen = true'));
  check('flag is cleared when the conversation ends',
    tileCode.includes('scene._storyTileOpen = false'));
  // The rest stop's leave shortcut must respect that flag.
  {
    const rs = readFileSync(ROOT + 'src/scenes/RestStopScene.js', 'utf8');
    const guarded = (rs.match(/if \(!this\._storyTileOpen\) this\._continue\(\)/g) || []).length;
    check('every SPACE/ENTER leave shortcut is guarded', guarded === 4);
    check('no unguarded leave shortcut remains',
      !/keydown-(SPACE|ENTER)', \(\) => this\._continue\(\)\)/.test(rs));
  }
  // The old fixed hand-off must be gone: nothing may advance on a bare timer.
  check('no timed auto-advance to the next node',
    !/delayedCall\([^)]*\)[\s\S]{0,120}openNode\(storyId, nextId/.test(tileCode)
    || /awaitTapThen/.test(tileCode));
  // Three timers: the reply beat, the prompt arm, and the AUTHORED PLAYER
  // LINE auto-play (a one-item choice list is a balloon, not a button —
  // workshop §A).  None of them advances to the next node.
  check('only the reply beat, the prompt arm and the authored-line play are timed',
    (tileCode.match(/scene\.time\.delayedCall\(/g) || []).length === 3);
  check('a one-item choice list plays as a balloon, never a button',
    /list\.length === 1 && !list\[0\]\._exit/.test(tileCode));
}

// ── 9. Reachability report (informational, plus a floor) ─────────────────
{
  const reachable = new Set();
  for (const [storyId, def] of Object.entries(FEATURED_STORIES)) {
    for (const [nodeId, node] of Object.entries(def.nodes ?? {})) {
      const est = resolvePanelKey({ storyId, nodeId, node });
      if (est) reachable.add(est);
      for (const choice of node.choices ?? []) {
        const k = resolvePanelKey({ storyId, nodeId, choiceId: choice.id, node, choice });
        if (k) reachable.add(k);
      }
    }
  }
  const mapped = Object.keys(PANEL_META).length;
  console.log(`      → ${reachable.size} of ${mapped} PANEL_META keys reachable via nodes/choices`);
  check('reachable key count beats the old node-only 11', reachable.size > 11);
}

// ── 6. Special beats: every PANEL_META key is now REACHABLE (2026-09-10) ──
// Authored `intro` / `beatsBefore` / `beats` (node or choice) carry explicit
// panel keys; evaluated ones declare their candidate `keys`.  A handful are
// emitted from code (the ambush + phone-lock road beats).  Only keys listed
// in FUTURE may stay unreachable, and each must be labeled here.
{
  const CODE_EMITTED = new Set([
    'hiphop.vantage_recovery.first_tail', 'hiphop.vantage_recovery.side_ram', 'hiphop.vantage_recovery.boxed_in',
    'hiphop.vantage_recovery.fatal', 'hiphop.vantage_recovery.special_delivery',   // GameScene._ambushBeat
    'hiphop.vantage_recovery.locked_phone',                                          // onPass.I api.beat
    'country.beat.roadside_exit', 'country.beat.kidnap',                             // onRoad api.beat
  ]);
  const FUTURE = new Set([
    'classicRock.othello_show.duetYes',   // no duet-yes choice in the final Othello tree (folded into Washtucna)
    'classicRock.othello_show.soloIntent',
    // Art created 2026-09-10, wired in PANEL_META ahead of their emission sites:
    'hiphop.vantage_hospital.wake',       // Ellensburg hospital beat — needs the hospital consequence code
  ]);
  const reach = new Set(CODE_EMITTED);
  const addSpecs = (specs) => { for (const b of (Array.isArray(specs) ? specs : specs ? [specs] : [])) {
    if (typeof b.panelKey === 'string') reach.add(b.panelKey);
    for (const k of (b.keys ?? [])) reach.add(k);
  } };
  for (const [storyId, def] of Object.entries(FEATURED_STORIES)) {
    for (const [nodeId, node] of Object.entries(def.nodes ?? {})) {
      reach.add(`${storyId}.${nodeId}`); if (node.panelKey) reach.add(node.panelKey);
      addSpecs(node.intro); addSpecs(node.beats);
      for (const ch of node.choices ?? []) {
        reach.add(`${storyId}.${nodeId}.${ch.id}`); if (ch.panelKey) reach.add(ch.panelKey);
        addSpecs(ch.beatsBefore); addSpecs(ch.beats);
      }
    }
  }
  const keys = Object.keys(PANEL_META);
  const unreachable = keys.filter(k => !reach.has(k) && !FUTURE.has(k));
  for (const k of unreachable) console.log(`      unreachable: ${k}`);
  check('every PANEL_META key is reachable or labeled FUTURE', unreachable.length === 0);
  check('FUTURE labels only real keys', [...FUTURE].every(k => keys.includes(k)));
  console.log(`      → ${keys.length - FUTURE.size} of ${keys.length} PANEL_META keys reachable (${FUTURE.size} labeled future)`);
}

console.log(`\nstory-art tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
