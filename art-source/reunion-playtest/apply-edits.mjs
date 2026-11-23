#!/usr/bin/env node
// Apply /dialogue2 browser edits to story.json — the "Publish my edits" pipeline (owner 2026-11-22).
//
//   node art-source/reunion-playtest/apply-edits.mjs <edits.json> [...more]
//
// An edits file is what the page's Publish button sends (and what Export all embeds):
//   { version, edits: { [chapterId]: { [shownText]: {text, deleted?, note?, speaker} } },
//              adds:  { [chapterId]: [ {id, kind:'line'|'choice', anchor, onChoice, speaker, text,
//                                        replies?, children?, goto?, next?} ] } }
// Edits are keyed by a line's text AS SHOWN on the page (*italics* without asterisks, whitespace
// collapsed), exactly as the page's editor stores them; "changes apply everywhere this line appears
// in this chapter". Purely mechanical: no judgment, no rewording. Anything that no longer matches the
// script is reported and skipped. Prints a JSON report; exit 1 only on a malformed file.
import fs from 'node:fs';

const STORY = new URL('./story.json', import.meta.url);
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const shown = t => norm(String(t ?? '').replace(/\*([^*\n]+)\*/g, '$1'));
const artText = n => n.artDesc || ('[ARTWORK — ' + n.title + ': describe this panel]');
const cleanArt = t => norm(String(t).replace(/^\s*\[ARTWORK\s*[\]}]\s*/i, ''));
const speakerOf = s => (!s || s === 'Narration' ? 'Scene' : s);

export function applyEdits(story, files) {
  const report = { applied: [], skipped: [], notes: [] };
  const chapterIndex = Object.fromEntries(story.chapters.map((c, i) => [c.id, i]));
  for (const file of files) {
    for (const cid of new Set([...Object.keys(file.edits || {}), ...Object.keys(file.adds || {})])) {
      const ch = story.chapters[chapterIndex[cid]];
      if (!ch) { report.skipped.push({ chapter: cid, why: 'no such chapter' }); continue; }
      const nextChapter = story.chapters[chapterIndex[cid] + 1]?.id ?? null;
      // Where each piece of shown text lives right now.
      const find = key => {
        const hits = [];
        for (const [id, n] of Object.entries(ch.nodes)) {
          if (shown(artText(n)) === key) hits.push({ id, n, kind: 'art' });
          n.beats.forEach((b, i) => { if (shown(b.text) === key) hits.push({ id, n, kind: 'beat', b }); });
          (n.choices || []).forEach(c => { if (shown(c.label) === key) hits.push({ id, n, kind: 'choice', c }); });
        }
        return hits;
      };
      const titles = new Set(Object.values(ch.nodes).map(n => n.title));
      const uniqueTitle = text => {
        let t = norm(text).split(' ').slice(0, 6).join(' ').replace(/[.,!?…:;]+$/, '') || 'Added path';
        let k = t, i = 2; while (titles.has(k)) k = t + ' (' + i++ + ')';
        titles.add(k); return k;
      };
      // An added choice becomes a real panel: its replies, then its own choices or where it leads.
      const makeStep = (step, parent) => {
        const id = 'add-' + step.id;
        const node = { title: uniqueTitle(step.text), beats: (step.replies || []).map(r => ({ speaker: speakerOf(r.speaker), text: r.text })), art: parent.art };
        ch.nodes[id] = node;
        if (step.children?.length) node.choices = step.children.map(c => ({ id: 'add-' + c.id, label: c.text, to: makeStep(c, node) }));
        else if (step.goto === '__end') { node.end = 'Scene ends.'; if (nextChapter) node.nextChapter = nextChapter; }
        else if (step.goto === '__continue' && parent.next) node.next = parent.next;
        else if (step.goto && step.goto !== '__continue') {
          const target = find(shown(step.goto)).find(h => h.kind === 'choice');
          if (target) node.next = target.c.to; else node.end = 'This path stops here for now.';
        } else node.end = 'This path stops here for now.';
        if (norm(step.next)) report.notes.push({ chapter: cid, panel: node.title, note: norm(step.next) });
        return id;
      };
      const attachChoice = (n, item) => {
        const choice = { id: 'add-' + item.id, label: item.text, to: makeStep(item, n) };
        if (!n.choices) {
          // A panel that used to Continue keeps that path as a choice beside the new one.
          n.choices = n.next ? [{ id: 'continue', label: 'Continue', to: n.next }] : [];
          if (!n.next) { delete n.end; delete n.nextChapter; }
        }
        n.choices.push(choice);
      };

      // 1) Additions first: they are anchored to lines' ORIGINAL text.
      const after = new Map();   // node beats array position bookkeeping per anchor
      for (const item of file.adds?.[cid] || []) {
        const hits = find(shown(item.anchor));
        if (!hits.length) { report.skipped.push({ chapter: cid, why: 'anchor no longer in script', anchor: item.anchor, text: item.text }); continue; }
        const h = hits[0];
        if (item.kind === 'choice') {
          const parent = h.kind === 'choice' && item.onChoice ? h.n : (h.kind === 'choice' ? ch.nodes[h.c.to] : h.n);
          attachChoice(parent, item);
          report.applied.push({ chapter: cid, added: 'choice', text: item.text, panel: parent.title });
          continue;
        }
        const line = { speaker: speakerOf(item.speaker), text: item.text };
        let node, pos;
        if (h.kind === 'beat') { node = h.n; pos = node.beats.indexOf(h.b) + 1; }
        else if (h.kind === 'choice') { node = ch.nodes[h.c.to]; pos = 0; }      // said right after the player's choice
        else { node = h.n; pos = 0; }                                             // after the artwork line
        const k = node.title + '|' + item.anchor;
        if (after.has(k)) pos = after.get(k);
        node.beats.splice(pos, 0, line); after.set(k, pos + 1);
        report.applied.push({ chapter: cid, added: 'line', speaker: line.speaker, text: line.text, panel: node.title });
      }
      // 2) Edits to existing lines, choices and artwork.
      for (const [key, e] of Object.entries(file.edits?.[cid] || {})) {
        if (!e || typeof e !== 'object') continue;
        const hits = find(shown(key));
        if (!hits.length) { report.skipped.push({ chapter: cid, why: 'line no longer in script', was: key, now: e.deleted ? '(removed)' : e.text }); continue; }
        for (const h of hits) {
          if (h.kind === 'art') { if (e.deleted) delete h.n.artDesc; else if (!/^\[ARTWORK — .*: describe this panel\]$/.test(norm(e.text))) h.n.artDesc = cleanArt(e.text); }
          else if (h.kind === 'beat') { if (e.deleted) h.n.beats.splice(h.n.beats.indexOf(h.b), 1); else h.b.text = norm(e.text); }
          else if (h.kind === 'choice') {
            if (!e.deleted) h.c.label = norm(e.text);
            else { h.n.choices.splice(h.n.choices.indexOf(h.c), 1); if (!h.n.choices.length) { delete h.n.choices; if (!h.n.next) h.n.end = 'Scene ends.'; } }
          }
        }
        if (norm(e.note)) report.notes.push({ chapter: cid, line: key, note: norm(e.note) });
        report.applied.push({ chapter: cid, [e.deleted ? 'removed' : 'changed']: key, ...(e.deleted ? {} : { now: norm(e.text) }) });
      }
      // Panels no player can reach any more (their only way in was removed) are left out.
      const seen = new Set(), q = [ch.start];
      while (q.length) { const id = q.shift(); if (seen.has(id) || !ch.nodes[id]) continue; seen.add(id);
        const n = ch.nodes[id]; if (n.next) q.push(n.next); for (const c of n.choices || []) q.push(c.to); }
      for (const id of Object.keys(ch.nodes)) if (!seen.has(id)) { report.notes.push({ chapter: cid, dropped: ch.nodes[id].title }); delete ch.nodes[id]; }
    }
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const paths = process.argv.slice(2);
  if (!paths.length) { console.error('usage: apply-edits.mjs <edits.json> [...]'); process.exit(1); }
  const files = paths.map(p => {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j || typeof j !== 'object' || (typeof j.edits !== 'object' && typeof j.adds !== 'object')) { console.error('not an edits file: ' + p); process.exit(1); }
    return j;
  });
  const story = JSON.parse(fs.readFileSync(STORY, 'utf8'));
  const report = applyEdits(story, files);
  // New version: saved reading positions on the page start fresh with the new script.
  story.version = new Date().toISOString().slice(0, 10) + '-published-' + Date.now().toString(36);
  fs.writeFileSync(STORY, JSON.stringify(story, null, 1) + '\n');
  console.log(JSON.stringify({ version: story.version, ...report }, null, 1));
}
