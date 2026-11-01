#!/usr/bin/env node
// Builds website/dialogue.html — the "Story Playtest" page at /dialogue.
//
//   node scripts/buildDialoguePage.mjs
//
// Chapters 1–3 (Hospital, Seattle, Mercer Island) are the hand-built
// illustrated playtests in scripts/dialogue/{seattle,mercer}.html, copied in
// unchanged.  Chapters 4–7 are GENERATED from the game's own data, so every
// line on them is the exact copy the game ships today — nothing here writes
// dialogue:
//
//   4 · Malik's Phone       src/data/featuredStories.js  hiphop  (Bellevue → Cle Elum)
//   5 · StageWagon or Bust  src/data/featuredStories.js  country (Mercer → Vantage)
//   6 · ImprompTour         src/data/featuredStories.js  classicRock (Vantage → Pullman)
//   7 · Roadside NPCs       npc_dialogue.csv + src/data/encounters.js
//
// Lines that change with game state (crate counts, relationship, Haylee's
// read…) are evaluated by calling the game's own functions for each case.
// Panel art comes from PANEL_META (src/data/comicPanels.js), resized to
// website/assets/dialogue/*.webp.  Re-run after editing story copy.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FEATURED_STORIES, NERVE_LINES, FLIRT_LINES, vinylPayout, VINYL_RECORDS, DOM_TAPE_BONUS,
  FOUNDER_OFFER, COUNTRY_PAY_RIDE_EM, COUNTRY_PAY_STANDARD, RIDE_EM_REL, RIDE_EM_NERVE,
  RIDE_EM_PASSES, STANDARD_REL, HAYLEE_WARM, HAYLEE_DRY, NAN_STAY_REL, SIXTY_FORTY_REL,
  BROKEN_VOICE_CONTROLLING, BROKEN_VOICE_REL, TRUE_ENDING_REL, PULLMAN_PAY, CLUE_LINES_MI,
  HAYLEE_LINES_MI, KIDNAP_WARN_MI, KIDNAP_REPORT_MI,
} from '../src/data/featuredStories.js';
import { PANEL_META } from '../src/data/comicPanels.js';
import { REST_STOP_ENCOUNTERS, BRITTNEY_MERCER_GREETER } from '../src/data/encounters.js';
import { REST_STOPS } from '../src/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'scripts/dialogue');
const OUT_HTML = path.join(ROOT, 'website/dialogue.html');
const ART_DIR = path.join(ROOT, 'website/assets/dialogue');
const ART_URL = '/assets/dialogue/';
const STOP = Object.fromEntries(REST_STOPS.map(r => [r.id, r.name.replace(/, WA$/, '')]));

// ── text helpers ────────────────────────────────────────────────────────
// A line of game copy can mix narration and quoted speech
// ('She looks at Nan, then at you. "I\'m going to Pullman…"') or carry
// several speakers ('Haylee: "…" Brittney: "…"').  Split it so the reader
// sees who says what; quoted text keeps its speaker, the rest is narration.
const NARRATION = /^(She |He |Nan |The |A beat|A hug|A quick hug|An |Three cars|Backstage|Malik doesn't|Ten minutes\. She|Pullman\. |Last chorus|Sixty-forty of|Five thousand,|Fifty-fifty, a full)/;
function split(text, speaker) {
  text = String(text ?? '').trim();
  if (!text) return [];
  if (!text.includes('"')) return [{ speaker: NARRATION.test(text) ? 'Scene' : speaker, text }];
  const out = []; let who = speaker, last = 0;
  const re = /(?:\b([A-Z][a-z]+): )?"([^"]*)"/g; let m;
  const scene = (t) => { t = t.trim().replace(/^[—–-]\s*/, '').trim(); if (t && /\w/.test(t)) out.push({ speaker: 'Scene', text: t }); };
  while ((m = re.exec(text))) {
    scene(text.slice(last, m.index));
    if (m[1]) who = m[1];
    out.push({ speaker: who, text: m[2] });
    last = re.lastIndex;
  }
  scene(text.slice(last));
  return out;
}
const scene = (text, extra = {}) => ({ speaker: 'Scene', text, ...extra });
const money = (n) => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US');
const signed = (n, what) => (n > 0 ? '+' : '−') + Math.abs(n) + ' ' + what;
function effectNote(c, extra = []) {
  const fx = typeof c.effects === 'object' && c.effects ? c.effects : {};
  const bits = [];
  if (c.cost) bits.push('Costs ' + money(c.cost));
  if (fx.cash) bits.push((fx.cash > 0 ? 'Earns ' : 'Costs ') + money(Math.abs(fx.cash)));
  if (fx.relationship) bits.push(signed(fx.relationship, 'relationship'));
  if (fx.relationshipFor?.country) bits.push(signed(fx.relationshipFor.country, 'Brittney'));
  if (fx.nerve) bits.push(signed(fx.nerve, 'Nerve'));
  if (fx.following) bits.push(signed(fx.following, 'duet following'));
  if (fx.soloFollowing) bits.push(signed(fx.soloFollowing, 'solo following'));
  if (fx.controlling) bits.push('controlling choice');
  if (fx.radioGrant === null) bits.push('Hip-Hop radio ends');
  return [...bits, ...extra].join(' · ');
}

// ── art ─────────────────────────────────────────────────────────────────
const images = {}, alts = {};
function art(panelKey) {
  const meta = PANEL_META[panelKey];
  if (!meta?.art) return null;
  const file = path.join(ROOT, 'public', meta.art);
  if (!fs.existsSync(file)) return null;
  const name = path.basename(meta.art).replace(/\.\w+$/, '.webp');
  images[panelKey] = ART_URL + name;
  alts[panelKey] = path.basename(meta.art).replace(/\.\w+$/, '').replace(/_/g, ' ');
  art.files.set(name, file);
  return panelKey;
}
art.files = new Map();
const firstArt = (...keys) => { for (const k of keys) if (k && art(k)) return k; return null; };

async function writeArt() {
  fs.mkdirSync(ART_DIR, { recursive: true });
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch { /* fall back to Python/Pillow */ }
  for (const [name, file] of art.files) {
    const out = path.join(ART_DIR, name);
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(file).mtimeMs) continue;
    if (sharp) await sharp(file).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 72 }).toFile(out);
    else execFileSync('python3', ['-c',
      'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");w=min(960,im.width);'
      + 'im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS);im.save(sys.argv[2],"WEBP",quality=72,method=6)', file, out]);
  }
}

// ── graph builder ───────────────────────────────────────────────────────
// Turns a story node into playtest nodes: optional intro caption panels →
// the node itself → one reply node per choice → optional after-panels →
// the next node.  `opts.to[choiceId]` says where each choice leads.
function makeBuilder(storyId) {
  const story = FEATURED_STORIES[storyId];
  const nodes = {};
  const B = {
    nodes,
    node(id, n) { nodes[id] = n; return id; },
    // Caption-only panels (intro / beats) chained in front of `to`.
    captions(prefix, list, to, stage, fallbackArt) {
      let next = to;
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        const text = typeof b.text === 'function' ? null : b.text;
        if (!text) continue;
        const id = `${prefix}.${b.id ?? i}`;
        // Panel captions are narration ("Mykenzie objects before you can
        // answer."); only a speaker's question is spoken ("Did we just swipe
        // right?").
        const beats = b.speaker && /\?$/.test(text) ? [{ speaker: b.speaker, text }] : split(text, b.speaker ?? 'Scene');
        nodes[id] = { stage, art: firstArt(typeof b.panelKey === 'string' ? b.panelKey : null, fallbackArt), beats: b.speaker && !/\?$/.test(text) && !text.includes('"') ? [scene(text)] : beats, next };
        next = id;
      }
      return next;
    },
    // `nodeBeats`: the node's own caption panels play after every choice.
    stop(nid, { stage, to = {}, next = null, choiceOpts = {}, lineBeats = null, skipIntro = false, prompt, nodeBeats = false } = {}) {
      const n = story.nodes[nid];
      const nodeArt = firstArt(n.panelKey, `${storyId}.${nid}`);
      const beats = [];
      if (n.caption) beats.push(scene(n.caption));
      for (const l of n.lines ?? []) beats.push(...split(l.text, l.speaker));
      if (lineBeats) beats.push(...lineBeats);
      else if (typeof n.line === 'string') beats.push(...split(n.line, n.speaker));
      const choices = (n.choices ?? []).map(c => {
        const o = choiceOpts[c.id] ?? {};
        if (o.omit) return null;
        const rid = `${nid}.${c.id}`;
        const target = to[c.id] ?? next;
        const replyArt = firstArt(`${storyId}.${nid}.${c.id}`, c.panelKey) ?? nodeArt;
        const afterList = [...(c.beats ?? []), ...(nodeBeats ? n.beats ?? [] : [])].filter(b => typeof b.text === 'string');
        const after = o.afterBeats === false ? target : B.captions(rid + '.after', afterList, target, stage, replyArt);
        const replyBeats = o.replyBeats ?? (typeof c.reply === 'string' ? split(c.reply, n.speaker) : []);
        for (const a of c.after ?? []) replyBeats.push(...split(a.text, a.speaker));
        let first = rid;
        nodes[rid] = { stage, art: replyArt, beats: replyBeats, next: after, ...(o.reply ?? {}) };
        if (!replyBeats.length && !o.reply?.ending) { delete nodes[rid]; first = after; }
        const before = (c.beatsBefore ?? []).filter(b => typeof b.text === 'string');
        if (before.length) first = B.captions(rid + '.before', before, first, stage, replyArt);
        return { id: c.id, label: c.label, to: first, note: o.note ?? effectNote(c, o.noteExtra ?? []), ...(o.choice ?? {}) };
      }).filter(Boolean);
      nodes[nid] = { stage, art: nodeArt, beats, ...(prompt ? { prompt } : {}), ...(choices.length ? { choices } : { next }) };
      const intro = (n.intro ?? []).filter(b => typeof b.text === 'string');
      return skipIntro || !intro.length ? nid : B.captions(nid + '.intro', intro, nid, stage, nodeArt);
    },
  };
  return B;
}
const ending = (story, id, extra = {}) => ({ ending: FEATURED_STORIES[story].endings[id].label, ...extra });

// Call a story-level hook with a stub api to capture the copy it emits.
function capture(fn, state, run = {}) {
  const out = [];
  const api = {
    state, run,
    flags: (f) => Object.assign(state.flags, f), items: (i) => Object.assign(state.items, i),
    relationship() {}, radioGrant() {}, wanted() {}, fail() {}, passenger() {},
    text: (id, name, msg) => out.push({ speaker: `${name} (text)`, text: msg }),
    say: (t) => out.push(...split(t, 'Brittney')),
    beat: (b) => out.push(...split(b.text, b.speaker ?? 'Scene').map(x => (x.speaker === b.speaker && /^"/.test(b.text) ? x : x))),
    meanwhile: (id) => out.push({ meanwhile: id }),
  };
  fn(api);
  return out;
}
function meanwhileBeats(storyId, id, when) {
  const strip = FEATURED_STORIES[storyId].meanwhile[id];
  return [scene(`MEANWHILE… ${strip.title}`, when ? { when } : {}),
    ...strip.panels.map(p => ({ speaker: p.speaker, text: p.text, ...(when ? { when } : {}) }))];
}

// ══ Chapter 4 · Malik's Phone (hiphop, Bellevue → Cle Elum) ═════════════
function hiphopChapter() {
  const H = FEATURED_STORIES.hiphop, B = makeBuilder('hiphop');
  const st = () => ({ flags: {}, items: { phone: true } });
  const skipped = capture(H.onPass.M, st());
  const passed = capture(H.onPass.I, st()).filter(b => !b.meanwhile);

  B.node('txtSkip', { stage: 'Mercer Island · drove past', beats: skipped, next: 'bellevue_founder', advanceLabel: 'On to Bellevue' });
  B.node('txtPass', { stage: 'Issaquah · drove past', art: firstArt('hiphop.vantage_recovery.locked_phone'),
    beats: [...passed, ...meanwhileBeats('hiphop', 'malik_cars')], next: 'ambush', advanceLabel: 'Keep driving east' });
  B.node('ambush', { stage: `Vantage · mile ${H.ambush.mile}`, art: firstArt('hiphop.vantage_recovery.first_tail'),
    beats: [scene(`${H.ambush.cars} hostile cars close in before the Vantage exit.`)],
    prompt: `In the game this is a driving fight. Lose it and the run ends on “${H.ambush.headline}” with the tip “${H.ambush.tip}” Survive it and the recovery screen below appears.`,
    next: 'vantage_recovery', review: 'ambush-ui' });

  // A choice whose reply IS the ending points at its own reply node; clear
  // that node's `next` so the route stops there.
  B.stop('bellevue_founder', { stage: 'Bellevue · off-ramp',
    to: { sell: 'bellevue_founder.sell', refuse: 'issaquah_kyle' },
    choiceOpts: { sell: { reply: ending('hiphop', 'sold_out', { endingNote: `${money(FOUNDER_OFFER)} cash · no genre unlock` }) } } });
  B.nodes['bellevue_founder.sell'].next = null;

  B.stop('issaquah_kyle', { stage: 'Issaquah · Park & Ride', next: 'northbend_dom.intro.dom_arrival' });
  B.stop('northbend_dom', { stage: 'North Bend',
    to: { promise: 'dom_tape', delay: 'pass_tennessee', bagman: 'pass_tennessee' },
    choiceOpts: { promise: { choice: { set: { credit: 'promised' } } }, delay: { choice: { set: { credit: 'delayed' } } },
      bagman: { choice: { set: { credit: 'refused' } }, noteExtra: ['thrown out of North Bend'] } } });
  B.stop('dom_tape', { stage: 'North Bend · side quest', next: 'pass_tennessee',
    choiceOpts: { take: { choice: { set: { tape: true } }, noteExtra: [`B-side pays +${money(DOM_TAPE_BONUS)} at Cle Elum`] } } });
  B.stop('pass_tennessee', { stage: 'Snoqualmie Pass · AOK Camp', next: 'cleelum_crate', nodeBeats: true,
    choiceOpts: {
      creditDom:   { choice: { when: { credit: ['promised', 'delayed'] }, set: { creditOut: 'producer' } }, note: 'Only if you promised or deferred Dom’nique’s credit' },
      creditMalik: { choice: { set: { creditOut: 'malik' } } },
      creditStank: { choice: { set: { creditOut: 'stank' } } },
      bside:       { choice: { when: { tape: true }, set: { creditOut: 'producer', bside: true } }, note: 'Only if you took Dom’nique’s tape' },
    } });

  // Cle Elum — the clerk's line and reply depend on how many records survived.
  const cases = [
    { id: 'pristine', n: 100, label: 'All 100 records survived' },
    { id: 'damaged', n: 74, label: 'Rough drive: 50–99 survived (shown as 74)' },
    { id: 'almost_empty', n: 23, label: 'Barely: 2–49 survived (shown as 23)' },
    { id: 'one_record', n: 1, label: 'One record left' },
    { id: 'zero', n: 0, label: 'Every record broke' },
  ];
  const clerk = H.nodes.cleelum_store, deliver = clerk.choices[0];
  B.node('cleelum_crate', { stage: 'Cle Elum · Spin Cycle Records', art: firstArt('hiphop.cleelum_store.pristine'),
    prompt: 'Every point of car damage breaks two records on the way here. How did the crate do?',
    choices: cases.map(c => ({ id: c.id, label: c.label, scenario: true, to: `cleelum.${c.id}` })) });
  for (const c of cases) {
    const run = { cargo: { records: c.n, hpLost: (VINYL_RECORDS - c.n) / 2 } };
    const pay = vinylPayout(c.n, run.cargo.hpLost);
    const outcomeArt = firstArt({ pristine: 'hiphop.cleelum_store.pristine', zero: null }[c.id] ?? 'hiphop.cleelum_store.damaged');
    B.node(`cleelum.${c.id}`, { stage: 'Cle Elum · Spin Cycle Records', art: outcomeArt,
      beats: split(clerk.line({ items: {}, flags: {} }, run), clerk.speaker),
      choices: [{ id: 'deliver', label: deliver.label, to: `cleelum.${c.id}.deliver`,
        note: pay ? `Earns ${money(pay)} (every HP of damage also docks 2%)` : 'Earns nothing' }] });
    const reply = (bside) => deliver.reply({ items: {}, flags: { bside } }, run);
    const result = deliver.beats[0].text({ flags: { outcome: c.id } });
    const beats = [
      ...split(reply(true), clerk.speaker).map(b => ({ ...b, when: { bside: true } })),
      ...split(reply(false), clerk.speaker).map(b => ({ ...b, when: { bside: { ne: true } } })),
    ];
    if (c.n) beats.push(scene(result));
    if (c.n) beats.push(...meanwhileBeats('hiphop', 'stank_legal', { creditOut: 'malik' }));
    B.node(`cleelum.${c.id}.deliver`, { stage: 'Cle Elum · the drop', art: outcomeArt, beats,
      ...ending('hiphop', c.id, { endingNote: c.n ? `Hip-Hop unlocked · ${money(pay)} (+${money(DOM_TAPE_BONUS)} with the B-side)` : 'Story failed · no unlock' }) });
  }

  B.stop('vantage_recovery', { stage: 'Vantage · Malik’s regards',
    to: { warp: 'issaquah_kyle', continue: 'vantage_recovery.continue' },
    choiceOpts: { continue: { reply: ending('hiphop', 'vantage_dead', { endingNote: 'Story over · no unlock' }) },
      warp: { noteExtra: ['Warps you back to the Issaquah exit'] } } });
  B.nodes['vantage_recovery.continue'].next = null;

  const issues = [
    { id: 'canon', title: 'Older canon than chapters 1–3', detail: 'This chapter is the delivery-run version in src/data/featuredStories.js. §18.5A (Master in the Beater, 2026-09-14) moves Kyle to the Vantage record shop and makes Malik’s signature the prize; Bellevue → Cle Elum has not been rewritten to match yet.' },
    { id: 'ambush-ui', title: 'Ambush is gameplay, not dialogue', detail: 'The three-car chase before Vantage has no lines; the one-sentence scene note and the prompt here describe what the game does.' },
    { id: 'meanwhile', title: 'Meanwhile strips are placeholders', detail: '“Malik dispatches three cars” and “Stank legal notices the NoiseCloud upload” have no captions yet (owner to write).' },
  ];
  return {
    id: 'hiphop', version: 'code-' + H.version, title: 'Malik’s Phone · Bellevue → Cle Elum',
    source: 'From the game code (src/data/featuredStories.js · hiphop). Every line is the copy the game ships today.',
    startStage: 'After Mercer Island', startPrompt: 'Ralphy is carrying Malik’s phone east. Pick how the trip got here.',
    startArt: firstArt('hiphop.bellevue_founder'),
    initial: {},
    entries: [
      { id: 'mercer', label: 'Left Mercer with the phone', detail: 'Brittney kept her job and sent Ralphy on to Issaquah.', to: 'bellevue_founder' },
      { id: 'skipMercer', label: 'Drove past Mercer with the phone', detail: 'Malik notices.', to: 'txtSkip' },
      { id: 'passIssaquah', label: 'Drove past Issaquah with the phone', detail: 'The phone locks. Malik sends three cars.', to: 'txtPass' },
    ],
    issues, nodes: B.nodes,
    extras: [],
  };
}

// ══ Chapter 5 · StageWagon or Bust (country, Mercer → Vantage) ══════════
function countryChapter() {
  const C = FEATURED_STORIES.country, B = makeBuilder('country');
  const N = C.nodes;

  B.stop('mercer_departure', { stage: 'Mercer Island · the car', next: 'need_hunger' });
  B.stop('need_hunger', { stage: 'Bellevue · Brittney is hungry', next: 'brittney_aux',
    choiceOpts: { wait: { noteExtra: ['the need stays open until the next stop'] } } });
  B.stop('brittney_aux', { stage: 'Bellevue · the aux cord', next: 'need_bathroom',
    choiceOpts: { give: { choice: { set: { aux: true } } } } });
  B.stop('need_bathroom', { stage: 'Issaquah · Brittney needs a bathroom', next: 'need_thirst',
    lineBeats: split(N.need_bathroom.line({ flags: { needCount: 1 } }, { flags: { atStop: 'I' } }), 'Brittney'),
    choiceOpts: { hold: { noteExtra: ['the need stays open until the next stop'] } } });
  B.stop('need_thirst', { stage: 'North Bend · Brittney is thirsty', next: 'roadE',
    choiceOpts: { fountain: {} } });

  const tick = (mile, flags = {}) => capture((api) => C.onRoad('tick', { mile, mph: 60, dt: 0.016 }, api),
    { flags: { ...flags }, items: {} }, { passenger: {}, nerve: 25, flags: {} });
  const clue1 = tick(CLUE_LINES_MI[0]), clue2 = tick(CLUE_LINES_MI[1], { clue1: true });
  B.node('roadE', { stage: `I-90 east · miles ${CLUE_LINES_MI[0]}–${CLUE_LINES_MI[1]}`, beats: [...clue1, ...clue2],
    prompt: 'Exit 109 is coming up.',
    choices: [
      { id: 'exit', label: 'Take Exit 109 (Ellensburg)', scenario: true, to: 'ellensburg_haylee' },
      { id: 'pass', label: 'Drive past Exit 109', scenario: true, to: 'skipE', note: '−5 relationship' },
    ] });
  B.node('skipE', { stage: 'I-90 east · past Exit 109', set: { haylee: 'skipped' },
    beats: capture(C.onPass.E, { flags: {}, items: {} }, { passenger: {} }), next: 'vantage_change.intro.vantage_spotted', advanceLabel: 'On to Vantage' });

  B.stop('ellensburg_haylee', { stage: 'Ellensburg · Exit 109', next: 'ellensburg_supply',
    choiceOpts: { welcome: { choice: { set: { haylee: 'aboard' } }, noteExtra: ['Haylee likes you (+15)'] },
      squeeze: { choice: { set: { haylee: 'aboard' } }, noteExtra: ['Haylee +5'] },
      noRoom: { choice: { set: { haylee: 'left' } } } } });
  const supplyLine = (haylee) => split(N.ellensburg_supply.line({ flags: { haylee } }), 'Brittney');
  B.stop('ellensburg_supply', { stage: 'Ellensburg · Huff’s supply run', next: 'roadV',
    lineBeats: [...supplyLine('aboard').map(b => ({ ...b, when: { haylee: 'aboard' } })),
                ...supplyLine('left').map(b => ({ ...b, when: { haylee: { ne: 'aboard' } } }))],
    choiceOpts: { fullRun: { choice: { set: { supplies: 'full' } } }, quickRun: { choice: { set: { supplies: 'partial' } } },
      noRun: { choice: { set: { supplies: 'none' } } } } });

  const h1 = tick(HAYLEE_LINES_MI[0], { haylee: 'aboard' });
  const h2 = (score) => tick(HAYLEE_LINES_MI[1], { haylee: 'aboard', hayleeLine1: true, hayleeScore: score });
  B.node('roadV', { stage: 'I-90 east · toward Vantage', route: [{ when: { haylee: 'aboard' }, to: 'roadV.haylee' }, { to: 'vantage_change.intro.vantage_spotted' }] });
  B.node('roadV.haylee', { stage: `I-90 east · mile ${HAYLEE_LINES_MI[0]}`, beats: h1,
    prompt: `Haylee keeps her own score of your driving: −5 per real crash, +2 per three clean passes.`,
    choices: [
      { id: 'warm', label: `Smooth driving: Haylee’s read is warm (${HAYLEE_WARM}+)`, scenario: true, set: { read: 'warm' }, to: 'roadV.smooth' },
      { id: 'dry', label: `Some bumps: her read is dry (${HAYLEE_DRY}–${HAYLEE_WARM - 1})`, scenario: true, set: { read: 'dry' }, to: 'roadV.smooth' },
      { id: 'cold', label: `Crashes: her read is cold (under ${HAYLEE_DRY})`, scenario: true, set: { read: 'cold' }, to: 'roadV.rough' },
    ] });
  B.node('roadV.smooth', { stage: `I-90 east · mile ${HAYLEE_LINES_MI[1]}`, beats: h2(HAYLEE_WARM), next: 'vantage_change.intro.vantage_spotted', advanceLabel: 'On to Vantage' });
  B.node('roadV.rough', { stage: `I-90 east · mile ${HAYLEE_LINES_MI[1]}`, beats: h2(HAYLEE_DRY - 1), next: 'vantage_change.intro.vantage_spotted', advanceLabel: 'On to Vantage' });

  B.stop('vantage_change', { stage: 'Vantage · five minutes', next: 'vantage_drive',
    choiceOpts: { guard: { choice: { set: { change: 'full' } } }, timed: { choice: { set: { change: 'partial' } } },
      asIs: { choice: { set: { change: 'none' } } } } });
  B.node('vantage_drive', { stage: 'Vantage · how did the drive go?', art: firstArt('country.vantage_arrival'),
    prompt: `Brittney’s ending depends on the drive. RIDE ’EM needs relationship ${RIDE_EM_REL}+, Nerve ${RIDE_EM_NERVE}+ on arrival, ${RIDE_EM_PASSES}+ clean passes and two of her three objectives (cooler, Haylee, the change). STAGEWAGON OR BUST needs relationship ${STANDARD_REL}+.`,
    choices: [
      { id: 'ride_em', label: 'RIDE ’EM', scenario: true, set: { outcome: 'ride_em' }, to: 'vantage_arrival' },
      { id: 'standard', label: 'STAGEWAGON OR BUST', scenario: true, set: { outcome: 'standard' }, to: 'vantage_arrival' },
      { id: 'barely', label: 'BARELY MADE IT', scenario: true, set: { outcome: 'barely' }, to: 'vantage_arrival' },
    ] });

  // Arrival line, reunion caption and send-off all read state — evaluate the
  // game's functions for every combination.
  const fakeRun = (o) => o === 'ride_em' ? { nerve: 25, flags: { cleanPasses: 9 } } : { nerve: 0, flags: { cleanPasses: 0 } };
  const relFor = { ride_em: 90, standard: 50, barely: 10 };
  const objFor = { ride_em: { supplies: 'full', haylee: 'aboard', changeChoice: 'full' }, standard: {}, barely: {} };
  const arrive = N.vantage_arrival, send = arrive.choices[0];
  const lineBeats = [];
  for (const o of ['ride_em', 'standard', 'barely']) {
    const s = { relationship: relFor[o], flags: objFor[o] };
    lineBeats.push(...split(arrive.line(s, fakeRun(o)), 'Brittney').map(b => ({ ...b, when: { outcome: o } })));
  }
  B.stop('vantage_arrival', { stage: 'Vantage · her babes', lineBeats, next: null,
    to: { sendOff: 'vantage_arrival.sendOff' }, choiceOpts: { sendOff: { afterBeats: false, replyBeats: [] } } });
  const reunion = [];
  const hayleeCases = [
    { when: { haylee: 'aboard', read: 'warm' }, flags: { haylee: 'aboard', hayleeScore: HAYLEE_WARM } },
    { when: { haylee: 'aboard', read: 'dry' }, flags: { haylee: 'aboard', hayleeScore: HAYLEE_DRY } },
    { when: { haylee: 'aboard', read: 'cold' }, flags: { haylee: 'aboard', hayleeScore: 0 } },
    { when: { haylee: 'left' }, flags: { haylee: 'left' } },
    { when: { haylee: 'skipped' }, flags: { haylee: 'skipped' } },
  ];
  const supplyCases = [{ v: 'full' }, { v: 'partial' }, { v: 'none', when: ['none', undefined] }];
  for (const s of supplyCases) for (const h of hayleeCases)
    reunion.push(scene(send.beats[0].text({ flags: { ...h.flags, supplies: s.v } }), { when: { ...h.when, supplies: s.when ?? s.v } }));
  const sendBeats = [];
  for (const o of ['ride_em', 'standard', 'barely']) for (const aux of [true, false]) {
    const s = { relationship: relFor[o], flags: { ...objFor[o], auxGiven: aux } };
    sendBeats.push(...split(send.reply(s, fakeRun(o)), 'Brittney').map(b => ({ ...b, when: { outcome: o, aux: aux ? true : { ne: true } } })));
  }
  const endNote = { ride_em: `Country unlocked · ${money(COUNTRY_PAY_RIDE_EM)} · Brittney’s number`, standard: `Country unlocked · ${money(COUNTRY_PAY_STANDARD)}`, barely: 'Country unlocked' };
  // One reunion node per ending so the status line can name it.
  B.node('vantage_arrival.sendOff', { stage: 'Vantage', route: ['ride_em', 'standard', 'barely'].map(o => ({ when: { outcome: o }, to: 'reunion.' + o })) });
  for (const o of ['ride_em', 'standard', 'barely'])
    B.node('reunion.' + o, { stage: 'Vantage · the reunion', art: firstArt('country.vantage_arrival.reunion'),
      beats: [...reunion, ...sendBeats.filter(b => b.when.outcome === o), ...(o === 'ride_em' ? meanwhileBeats('country', 'brittney_friends') : [])],
      ...ending('country', o, { endingNote: endNote[o] }) });

  // Road lines that fire from driving, not from a stop.
  const sim = (events, flags = {}) => {
    const s = { flags: { haylee: 'left', ...flags }, items: {} }, run = { passenger: {}, nerve: 25, flags: {} };
    return capture((api) => events.forEach(([t, ev]) => C.onRoad(t, ev, api)), s, run);
  };
  const crashSide = sim([['damage', { hp: 6, source: 'side_swipe', mile: 50 }]]);
  const crashFront = sim([['damage', { hp: 6, source: 'rear_end', mile: 50 }]]);
  const nerveText = new Set(Object.values(NERVE_LINES));
  const zero = sim([['damage', { hp: 4, mile: 50 }], ['damage', { hp: 4, mile: 51 }], ['damage', { hp: 4, mile: 52 }], ['damage', { hp: 4, mile: 53 }], ['damage', { hp: 4, mile: 54 }], ['damage', { hp: 4, mile: 55 }], ['damage', { hp: 4, mile: 56 }],
    ['tick', { mile: 56 + KIDNAP_WARN_MI, dt: 0.016 }], ['tick', { mile: 56 + KIDNAP_REPORT_MI, dt: 0.016 }]]).filter(b => !nerveText.has(b.text));
  const roadside = sim([['damage', { hp: 25, mile: 50 }], ['tick', { mile: 50.1, dt: 2, stopped: true, onShoulder: true }]]);
  const issues = [
    { id: 'placeholders', title: 'Her StageWagon friends’ strip has no captions', detail: 'The RIDE ’EM ending raises a three-panel Meanwhile strip; its captions are placeholders.' },
    { id: 'stops', title: 'Needs follow the stops you take', detail: 'In the game her needs rotate hunger → bathroom → thirst, one per rest stop between Mercer and Vantage. This walkthrough puts them at Bellevue, Issaquah and North Bend; the bathroom line names a business at whichever stop you are at.' },
    { id: 'canon', title: 'Older canon than chapters 1–3', detail: '§18.5A makes Brittney Wyatt’s daughter and moves the reveal to the Gorge; this ride still ends at Vantage the way the code does today.' },
  ];
  return {
    id: 'country', version: 'code-' + C.version, title: 'StageWagon or Bust · Mercer → Vantage',
    source: 'From the game code (src/data/featuredStories.js · country). Every line is the copy the game ships today.',
    startStage: 'Mercer Island', startPrompt: 'Brittney said yes at the Gas-N-Sip (chapter 3). She is clocking out.',
    startArt: firstArt('country.mercer_departure'),
    initial: {},
    entries: [{ id: 'aboard', label: 'Brittney is riding to StageWagon', detail: 'Picks up where chapter 3’s yes ends.', to: 'mercer_departure' }],
    issues, nodes: B.nodes,
    extras: [
      { title: 'When she gets rattled (Nerve)', note: 'She starts at 25 Nerve. Crashes cost Nerve; speeding, clean passes and near misses build it back. She comments as it falls.',
        items: Object.entries(NERVE_LINES).sort((a, b) => b[0] - a[0]).map(([t, text]) => ({ speaker: 'Brittney', text, note: `Nerve drops to ${t}` })) },
      { title: 'After a big crash (5+ HP)', items: [
        ...crashSide.map(b => ({ ...b, note: 'side-swipe or corner hit' })), ...crashFront.map(b => ({ ...b, note: 'any other big hit' })) ] },
      { title: 'Flirting on clean passes', note: 'Every fifth clean pass, +2 relationship.', items: FLIRT_LINES.map(text => ({ speaker: 'Brittney', text })) },
      { title: 'Zero Nerve', note: `If you keep driving after she asks to get out: a warning after ${KIDNAP_WARN_MI} mile, five stars and a failed story (KIDNAPPING REPORT) after ${KIDNAP_REPORT_MI}.`, items: zero },
      { title: 'Pulling over at zero Nerve', note: 'Stopping on the shoulder lets her out (ROADSIDE EXIT).', items: roadside.filter(b => !/^Pull over/.test(b.text)) },
    ],
  };
}

// ══ Chapter 6 · ImprompTour (classicRock, Vantage → Pullman) ════════════
function classicRockChapter() {
  const R = FEATURED_STORIES.classicRock, B = makeBuilder('classicRock'), N = R.nodes;
  // Numeric state the game tracks for this arc: relationship and controlling
  // choices decide Hatton, Colfax and the Pullman ending.
  const fx = (c) => {
    const e = typeof c.effects === 'object' ? c.effects : {};
    const add = {};
    if (e.relationship) add.rel = e.relationship;
    if (e.controlling) add.controlling = e.controlling;
    if (e.following) add.following = e.following;
    if (e.soloFollowing) add.soloFollowing = e.soloFollowing;
    return { add, set: { ...(e.flags ?? {}) } };
  };
  const opts = (node, extra = {}) => Object.fromEntries(N[node].choices.map(c => {
    const { add, set } = fx(c);
    for (const k of ['left', 'tour', 'othelloDone', 'nanDone', 'washtucnaDone', 'lacrosseDone', 'lacrosseAfter', 'setlistAsked', 'rideOffered', 'aboard', 'coverPaid', 'duetOffered']) delete set[k];
    return [c.id, { choice: { add, set }, ...(extra[c.id] ?? {}) }];
  }));

  B.stop('vantage_diner', { stage: 'Vantage · the diner', next: 'vantage_offer', nodeBeats: true, choiceOpts: opts('vantage_diner') });
  B.stop('vantage_offer', { stage: 'Vantage · the offer', next: 'toOthello', choiceOpts: opts('vantage_offer') });
  B.node('toOthello', { stage: 'Othello', route: [{ when: { show1: 'opener' }, to: 'othello_cover.intro.othello_arrival' }, { to: 'othello_watch' }] });
  B.stop('othello_cover', { stage: 'Othello · the door', to: { pay: 'othello_show.intro.othello_performance' }, choiceOpts: opts('othello_cover') });
  B.stop('othello_show', { stage: 'Othello · after the set', next: 'hatton_nan.intro.nan_offer',
    to: { reject: 'othello_show.reject' },
    choiceOpts: opts('othello_show', { reject: { reply: ending('classicRock', 'left_at_othello', { endingNote: 'Story over · no unlock' }) } }) });
  B.nodes['othello_show.reject'].next = null;
  B.stop('othello_watch', { stage: 'Othello · her set', next: 'hatton_nan.intro.nan_offer', choiceOpts: opts('othello_watch') });

  const nan = N.hatton_nan, herCall = nan.choices.find(c => c.id === 'herCall');
  const stay = { relationship: NAN_STAY_REL, flags: {} }, go = { relationship: 0, flags: { left: true } };
  B.stop('hatton_nan', { stage: 'Hatton · Nan’s Oldsmobile', next: 'washtucna_show.intro.washtucna_arrival',
    to: { take: 'hatton_nan.take', herCall: 'herCall' },
    choiceOpts: opts('hatton_nan', {
      take: { reply: ending('classicRock', 'nan_500', { endingNote: `${money(500)} · story over` }) },
      herCall: { replyBeats: [], afterBeats: false, note: `She stays if relationship is ${NAN_STAY_REL}+` },
      refuse: {}, demand: {},
    }) });
  B.nodes['hatton_nan.take'].next = null;
  const nanStrip = meanwhileBeats('classicRock', 'nan_wrong_town');
  B.nodes['hatton_nan.refuse'].beats.push(...nanStrip);
  B.node('herCall', { stage: 'Hatton · her call', route: [{ when: { rel: { gte: NAN_STAY_REL } }, to: 'herCall.stay' }, { to: 'herCall.leave' }] });
  B.node('herCall.stay', { stage: 'Hatton · her call', art: firstArt('classicRock.hatton_nan.herCall.stay'), add: { rel: 5 },
    beats: [...split(herCall.reply(stay), 'Mykenzie'), scene(herCall.beats[0].text(stay)), ...nanStrip], next: 'washtucna_show.intro.washtucna_arrival' });
  B.node('herCall.leave', { stage: 'Hatton · her call', art: firstArt('classicRock.hatton_nan.herCall.leave'),
    beats: [...split(herCall.reply(go), 'Mykenzie'), scene(herCall.beats[0].text(go))], ...ending('classicRock', 'nan_choice', { endingNote: 'Story over · no unlock' }) });

  const wLine = (aud) => split(N.washtucna_show.line({ flags: { auditionNext: aud } }), 'Mykenzie');
  B.stop('washtucna_show', { stage: 'Washtucna · show two', next: 'setlist',
    lineBeats: [...wLine(true).map(b => ({ ...b, when: { auditionNext: true } })), ...wLine(false).map(b => ({ ...b, when: { auditionNext: { ne: true } } }))],
    choiceOpts: opts('washtucna_show') });
  B.stop('setlist', { stage: 'Washtucna · the set list', next: 'lacrosse_show', choiceOpts: opts('setlist') });
  const lLine = (s) => split(N.lacrosse_show.line({ flags: { setlist: s } }), 'Mykenzie');
  B.stop('lacrosse_show', { stage: 'La Crosse · show three', next: 'colfax_deal', to: { duet: 'lacrosse_after' },
    lineBeats: [...lLine('hers').map(b => ({ ...b, when: { setlist: 'hers' } })), ...lLine('mine').map(b => ({ ...b, when: { setlist: 'mine' } })),
                ...lLine(undefined).map(b => ({ ...b, when: { setlist: [undefined, null] } }))],
    choiceOpts: opts('lacrosse_show') });
  B.stop('lacrosse_after', { stage: 'La Crosse · backstage', next: 'colfax_deal', choiceOpts: opts('lacrosse_after') });

  // Colfax — each answer reads relationship and controlling choices.
  const deal = N.colfax_deal;
  const broken = { flags: { controlling: BROKEN_VOICE_CONTROLLING }, relationship: 0 };
  const brokenWhen = { controlling: { gte: BROKEN_VOICE_CONTROLLING }, rel: { lt: BROKEN_VOICE_REL } };
  const ok = (rel) => ({ flags: {}, relationship: rel });
  B.stop('colfax_deal', { stage: 'Colfax · the title', choiceOpts: Object.fromEntries(deal.choices.map(c => [c.id, { replyBeats: [], afterBeats: false, note: '' }])),
    to: Object.fromEntries(deal.choices.map(c => [c.id, 'colfax.' + c.id])) });
  const variant = (id, s, set, add, to, extra = {}) => ({ stage: 'Colfax · the title', art: firstArt('classicRock.colfax_deal'),
    beats: split(deal.choices.find(c => c.id === id).reply(s), 'Mykenzie'), set, add, next: to, ...extra });
  B.node('colfax.fifty', { stage: 'Colfax', route: [{ when: brokenWhen, to: 'colfax.fifty.broken' }, { to: 'colfax.fifty.ok' }] });
  B.node('colfax.fifty.broken', variant('fifty', broken, { deal: 'broken' }, {}, 'pullman'));
  B.node('colfax.fifty.ok', variant('fifty', ok(50), { deal: '5050' }, { rel: 10 }, 'colfax_name'));
  B.node('colfax.sixty', { stage: 'Colfax', route: [{ when: brokenWhen, to: 'colfax.sixty.broken' }, { when: { rel: { gte: SIXTY_FORTY_REL } }, to: 'colfax.sixty.ok' }, { to: 'colfax.sixty.no' }] });
  B.node('colfax.sixty.broken', variant('sixty', broken, { deal: 'broken' }, { controlling: 1 }, 'pullman'));
  B.node('colfax.sixty.ok', variant('sixty', ok(SIXTY_FORTY_REL), { deal: '6040' }, { rel: -5, controlling: 1 }, 'colfax_name'));
  B.node('colfax.sixty.no', variant('sixty', ok(50), { deal: 'implode' }, { controlling: 1 }, null, ending('classicRock', 'band_implosion', { endingNote: 'No Pullman show · no unlock' })));
  B.node('colfax.flat', { stage: 'Colfax', route: [{ when: brokenWhen, to: 'colfax.flat.broken' }, { to: 'colfax.flat.ok' }] });
  B.node('colfax.flat.broken', variant('flat', broken, { deal: 'broken' }, { controlling: 1 }, 'pullman'));
  B.node('colfax.flat.ok', variant('flat', ok(50), { deal: 'flat' }, { rel: -15, controlling: 1 }, 'pullman'));
  B.node('colfax.refuse', { stage: 'Colfax', route: [{ when: brokenWhen, to: 'colfax.refuse.broken' }, { to: 'colfax.refuse.no' }] });
  B.node('colfax.refuse.broken', variant('refuse', broken, { deal: 'broken' }, { controlling: 1 }, 'pullman'));
  B.node('colfax.refuse.no', variant('refuse', ok(50), { deal: 'implode' }, { controlling: 1 }, null, ending('classicRock', 'band_implosion', { endingNote: 'No Pullman show · no unlock' })));
  const colfaxNotes = {
    fifty: 'Partnership', sixty: `She accepts only at relationship ${SIXTY_FORTY_REL}+; otherwise the band implodes`,
    flat: 'Hired voice: reaches Pullman, no unlock', refuse: 'The band implodes',
  };
  for (const c of B.nodes.colfax_deal.choices) c.note = colfaxNotes[c.id] + ` · a Broken Voice (${BROKEN_VOICE_CONTROLLING}+ controlling choices and relationship under ${BROKEN_VOICE_REL}) accepts anything`;
  B.stop('colfax_name', { stage: 'Colfax · the marquee', next: 'pullman',
    choiceOpts: Object.fromEntries(N.colfax_name.choices.map(c => [c.id, { choice: { set: { name: c.id === 'mine' ? 'player' : c.id }, add: fx(c).add } }])) });

  // Pullman — mirror classicRockOutcome() as routes (same order as the code).
  const outcomes = [
    ['broken_voice', { deal: 'broken' }], ['hired_voice', { deal: 'flat' }], ['solo_sellout', { l: 'solo' }],
    ['true_ending', { l: 'duet', rel: { gt: TRUE_ENDING_REL }, deal: ['5050', '6040'] }],
    ['marquee', { name: 'hers' }], ['business_6040', { deal: '6040' }], ['equal_partner', {}],
  ];
  const sampleFor = {
    broken_voice: { flags: { deal: 'broken' } }, hired_voice: { flags: { deal: 'flat' } }, solo_sellout: { flags: { l: 'solo', deal: '5050' } },
    true_ending: { flags: { l: 'duet', deal: '5050' }, relationship: 95 }, marquee: { flags: { name: 'hers', deal: '5050' } },
    business_6040: { flags: { deal: '6040' } }, equal_partner: { flags: { deal: '5050' } },
  };
  B.node('pullman', { stage: 'Pullman', route: outcomes.map(([o, when]) => ({ when, to: 'pullman.' + o })) });
  const fin = N.pullman_final, play = fin.choices[0];
  const unlockNote = { true_ending: 'Classic Rock unlocked', equal_partner: 'Classic Rock unlocked', marquee: 'Classic Rock unlocked', business_6040: 'Classic Rock unlocked', solo_sellout: 'Classic Rock unlocked', broken_voice: 'Classic Rock unlocked', hired_voice: 'No unlock' };
  for (const [o] of outcomes) {
    const s = { following: 0, ...sampleFor[o], flags: { ...sampleFor[o].flags } };
    const pay = o === 'true_ending' ? `${money(PULLMAN_PAY.true_ending)} (${money(PULLMAN_PAY.business_6040)} on a 60/40 deal)` : money(PULLMAN_PAY[o] ?? 0);
    B.node('pullman.' + o, { stage: 'Pullman · the final show', art: firstArt('classicRock.pullman_final', o === 'true_ending' ? 'classicRock.pullman_finale.partnership_kiss' : null),
      beats: split(fin.line(s), 'Mykenzie'), review: 'crowd',
      choices: [{ id: 'play', label: play.label, to: 'pullman.' + o + '.play' }] });
    const beats = split(play.reply(s), 'Mykenzie');
    if (o === 'true_ending') beats.push(scene(play.beats[0].text));
    B.node('pullman.' + o + '.play', { stage: 'Pullman · encore', art: firstArt(o === 'true_ending' ? 'classicRock.pullman_finale.partnership_kiss' : 'classicRock.pullman_final'),
      beats, ...ending('classicRock', o, { endingNote: `${unlockNote[o]} · ${pay}` }) });
  }
  const issues = [
    { id: 'crowd', title: 'Crowd count left out', detail: 'In the game the Pullman line can add “— N of them came for the tour” using your duet and solo following. This playtest shows it without the number.' },
    { id: 'meanwhile', title: '“Nan visits the wrong town” strip has no captions', detail: 'It fires when Mykenzie stays at Hatton; its captions are placeholders.' },
    { id: 'canon', title: 'Older canon than chapters 1–3', detail: '§18.5A mentions a later Mykenzie story; this is the ImprompTour arc as the code has it today.' },
  ];
  return {
    id: 'classicRock', version: 'code-' + R.version, title: 'ImprompTour · Vantage → Pullman',
    source: 'From the game code (src/data/featuredStories.js · classicRock). Every line is the copy the game ships today.',
    startStage: 'Vantage', startPrompt: 'Ralphy stops at the Vantage diner. The waitress’s shift just ended.',
    startArt: firstArt('classicRock.vantage_diner.shift_end'),
    initial: { rel: R.startRelationship, controlling: 0, following: 0, soloFollowing: 0 },
    entries: [{ id: 'diner', label: 'Stop at the Vantage diner', detail: 'Mykenzie’s nan forgot her again.', to: 'vantage_diner.intro.diner_shift_end' }],
    issues, nodes: B.nodes, extras: [],
  };
}

// ══ Chapter 7 · Roadside NPCs (CSV + encounters.js) ═════════════════════
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(Boolean));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
function roadsideData() {
  const rows = parseCSV(fs.readFileSync(path.join(ROOT, 'npc_dialogue.csv'), 'utf8'));
  const groups = [], byKey = new Map();
  for (const r of rows) {
    const key = r.Category + '|' + r.Speaker + '|' + r['Location/Stop'];
    let g = byKey.get(key);
    if (!g) { g = { category: r.Category, speaker: r.Speaker, where: r['Location/Stop'], rows: [] }; byKey.set(key, g); groups.push(g); }
    g.rows.push({ node: r['Node/Quirk'], type: r['Line Type'], text: r.Text, cost: r.Cost, effect: r.Effect, response: r['Result/Response'] });
  }
  // In the code but not in the sheet: Brittney's counter talk, the karma
  // payoffs for generous choices, and the per-stop town facts.
  groups.push({ category: 'Shop Greeter', speaker: BRITTNEY_MERCER_GREETER.speaker, where: 'Mercer Island Gas-N-Sip (story counter)', rows: [
    { type: 'Quote', text: BRITTNEY_MERCER_GREETER.line },
    ...BRITTNEY_MERCER_GREETER.choices.map(c => ({ type: 'Choice', text: c.label, response: (c.effects?.dialogue ?? '').replace(/^"|"$/g, '') })) ] });
  const enc = fs.readFileSync(path.join(ROOT, 'src/data/encounters.js'), 'utf8');
  const karma = [...enc.matchAll(/\{ e: \{ (\w+): \+(\d+) \},\s*d: "([^"]+)" \}/g)];
  groups.push({ category: 'Karma', speaker: 'Karma payoff', where: 'After any generous choice, about 30% of the time', rows:
    karma.map(m => ({ type: { cash: 'Cash', fuelMi: 'Fuel', hp: 'Repair', timeSec: 'Time' }[m[1]] ?? m[1], text: m[3], effect: `+${m[2]} ${{ cash: 'dollars', fuelMi: 'miles of fuel', hp: 'HP', timeSec: 'seconds' }[m[1]] ?? m[1]}` })) });
  const facts = REST_STOP_ENCOUNTERS.filter(e => e.fact).sort((a, b) => REST_STOPS.findIndex(r => r.id === a.stopId) - REST_STOPS.findIndex(r => r.id === b.stopId));
  groups.push({ category: 'Town Fact', speaker: 'Town facts', where: 'Shown on encounter cards at each stop', rows:
    facts.map(e => ({ type: STOP[e.stopId] ?? e.stopId, text: e.fact })) });
  return { source: 'From npc_dialogue.csv, plus Brittney’s counter lines, karma payoffs and town facts from src/data/encounters.js.', groups };
}

// ── assemble ────────────────────────────────────────────────────────────
const fill = (tpl, map) => Object.entries(map).reduce((s, [k, v]) => s.split(k).join(v), tpl);
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const memory = {
  credit: 'Dom’nique’s credit', tape: 'Dom’nique’s tape', creditOut: 'Name on the label', bside: 'B-side pressed',
  haylee: 'Haylee', supplies: 'Cooler supplies', aux: 'Aux cord given', read: 'Haylee’s read', change: 'Brittney’s change', outcome: 'Ending',
  rel: 'Relationship (0–100)', controlling: 'Controlling choices', following: 'Duet following', soloFollowing: 'Solo following',
  show1: 'Othello', auditionNext: 'Audition at Washtucna', setlist: 'La Crosse opener', deal: 'Colfax deal', name: 'Marquee name',
  w: 'Washtucna set', l: 'La Crosse set', duetOffered: 'Duet offered',
};
function storyPage(story) {
  const tpl = fs.readFileSync(path.join(SRC, 'story-player.html'), 'utf8');
  const usedArt = new Set([story.startArt, ...Object.values(story.nodes).map(n => n.art)].filter(Boolean));
  const imgs = Object.fromEntries([...usedArt].map(k => [k, images[k]]));
  const al = Object.fromEntries([...usedArt].map(k => [k, alts[k]]));
  return fill(tpl, { __TITLE__: story.title, __DATA__: json({ story, images: imgs, alts: al, memory, figcaption: 'Approved comic panel art' }) });
}
function validate(story) {
  const errs = [];
  const has = (id) => !id || story.nodes[id];
  for (const e of story.entries) if (!has(e.to)) errs.push(`${story.id}: entry ${e.id} → missing ${e.to}`);
  for (const [id, n] of Object.entries(story.nodes)) {
    if (n.next && !has(n.next)) errs.push(`${story.id}.${id}: next → missing ${n.next}`);
    for (const c of n.choices ?? []) if (!has(c.to)) errs.push(`${story.id}.${id}.${c.id}: → missing ${c.to}`);
    for (const r of n.route ?? []) if (!has(r.to)) errs.push(`${story.id}.${id}: route → missing ${r.to}`);
    if (!n.route && !n.ending && !n.next && !(n.choices ?? []).length) errs.push(`${story.id}.${id}: dead end`);
  }
  return errs;
}

const chapters = [hiphopChapter(), countryChapter(), classicRockChapter()];
const errs = chapters.flatMap(validate);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
await writeArt();

const pages = {
  seattle: fs.readFileSync(path.join(SRC, 'seattle.html'), 'utf8'),
  mercer: fs.readFileSync(path.join(SRC, 'mercer.html'), 'utf8'),
  hiphop: storyPage(chapters[0]),
  country: storyPage(chapters[1]),
  classicRock: storyPage(chapters[2]),
  roadside: fill(fs.readFileSync(path.join(SRC, 'roadside.html'), 'utf8'), { __DATA__: json(roadsideData()) }),
};
const CHAPTERS = [
  { id: 'hospital', title: 'Hospital', sub: 'Why the trip happens', page: 'seattle', start: null, key: 'rtr.seattle-illustrated-playtest.2026-10-30.hospital' },
  { id: 'seattle', title: 'Seattle', sub: 'Tire iron and Malik', page: 'seattle', start: 'blowout', key: 'rtr.seattle-illustrated-playtest.2026-10-30.seattle' },
  { id: 'mercer', title: 'Mercer Island', sub: 'Brittney at the Gas-N-Sip', page: 'mercer', start: null, key: null },
  { id: 'hiphop', title: 'Malik’s Phone', sub: 'Bellevue → Cle Elum', page: 'hiphop', start: null, key: null },
  { id: 'country', title: 'StageWagon', sub: 'Brittney rides to Vantage', page: 'country', start: null, key: null },
  { id: 'classicRock', title: 'ImprompTour', sub: 'Mykenzie, Vantage → Pullman', page: 'classicRock', start: null, key: null },
  { id: 'roadside', title: 'Roadside NPCs', sub: 'Encounters, shops, chatter', page: 'roadside', start: null, key: null },
];
// Pages ride as JSON strings inside <script type="application/json">; escape
// "</" so a page's own </script> can't close the carrier early.
const carrier = (id, html) => `<script type="application/json" id="page-${id}">${JSON.stringify(html).replace(/<\//g, '<\\/')}</script>\n`;
const wrapper = fs.readFileSync(path.join(SRC, 'wrapper.html'), 'utf8');
const out = fill(wrapper, {
  __CHAPTERS__: JSON.stringify(CHAPTERS),
  __PAGES__: Object.entries(pages).map(([id, html]) => carrier(id, html)).join(''),
});
fs.writeFileSync(OUT_HTML, out);
const lines = chapters.reduce((n, s) => n + Object.values(s.nodes).reduce((m, x) => m + (x.beats?.length ?? 0) + (x.choices?.length ?? 0), 0), 0);
console.log(`wrote ${path.relative(ROOT, OUT_HTML)} (${(out.length / 1024).toFixed(0)} KB) · ${CHAPTERS.length} chapters · ${lines} generated beats/choices · ${art.files.size} art files`);
