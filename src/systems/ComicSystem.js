// ── ComicSystem — comic events, page assignment, volume/chapter lifecycle ──
//
// Ch. 18.3.  Listens to StorySystem commits and turns every consequential
// beat into ONE compact comic event inside the plate's canon
// (`storyCanon.volumes`, owned by StorySystem's save bucket).  Nothing here
// stores pixels: an event is a ledger key, a panel key, the stable dialogue
// keys + fallback copy, and where/when it happened.  Pages are rebuilt from
// events + PAGE_TEMPLATES every time they're drawn (reader, PDF).
//
// STRUCTURE
//   volume  { id, n, status:'open'|'complete', startedAt, closedAt, closedBy,
//             chapters:[chapter], events:[event], pages:[page] }
//   chapter { id, n, runId, startedAt, status:'open'|'closed', eventIds:[] }
//   event   { id, key (ledger), storyId, nodeId, choiceId, importance, panelKey,
//             speaker, dialogueKeys, fallbackText, mile, at, runId, chapterId,
//             cost, cash, panels (meanwhile: 3) }
//   page    { id, n, templateId, slots:[eventId|null], locked, chapterId }
//
// RULES
//   • One event per ledger key — recording the same key twice is a no-op, so
//     a scene re-entry or a rewind can't duplicate a panel (18.12).
//   • A chapter is a TRIP: the first event of a new runId closes the open
//     chapter (locking its unfinished page) and opens the next one.
//   • Page layouts lock once complete; flow templates cycle deterministically
//     by page ordinal; major/climax/ending/meanwhile take their own page.
//   • A volume closes on PULLMAN ARRIVAL (owner 2026-09-06) — only if it holds
//     at least one event.  The next beat opens the next volume.  Past volumes
//     are never touched again.
//   • Plate reset wipes everything here (it lives in storyCanon); genre
//     ownership + achievements survive elsewhere.
//
// Pure JS, no Phaser — tests/comic.test.mjs.

import { PAGE_TEMPLATES, FLOW_CYCLE, panelKeyFor, resolvePanelKey, hasPanelArt } from '../data/comicPanels.js';
import { resolveDialogue } from '../data/featuredStories.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const FLOW = new Set(['minor', 'choice', 'consequence']);

export const IMPORTANCE = ['minor', 'choice', 'consequence', 'major', 'climax', 'ending', 'meanwhile'];

export class ComicSystem {
  /** @param story StorySystem — the canon owner.  Subscribes to its commits. */
  constructor(story) {
    this._story = story;
    this._unsub = story?.onCommit?.((entry, ctx) => this.record(entry, ctx)) ?? null;
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  volumes() { return this._story.canon().volumes; }
  activeVolume() {
    const c = this._story.canon();
    return c.volumes.find(v => v.id === c.activeVolumeId) ?? null;
  }
  volume(id) { return this.volumes().find(v => v.id === id) ?? null; }
  isToBeContinued(vol) { return !!vol && vol.status !== 'complete'; }

  /** Reader model for one volume: pages with their events resolved (dialogue
   *  by stable key, falling back to the copy saved at commit time). */
  pagesOf(volId) {
    const vol = typeof volId === 'string' ? this.volume(volId) : volId;
    if (!vol) return [];
    const byId = Object.fromEntries(vol.events.map(e => [e.id, e]));
    return vol.pages.map(p => ({
      id: p.id, n: p.n, templateId: p.templateId, locked: p.locked, chapterId: p.chapterId,
      chapterN: vol.chapters.find(ch => ch.id === p.chapterId)?.n ?? null,
      template: PAGE_TEMPLATES[p.templateId],
      panels: p.slots.map((eid, i) => {
        const e = eid ? byId[eid] : null;
        return { slot: PAGE_TEMPLATES[p.templateId].slots[i], event: e ? this.resolveEvent(e) : null };
      }),
    }));
  }

  /** Where a recorded beat lives: { volId, pageId, eventId } or null. */
  pageFor(key) {
    for (const v of this.volumes()) {
      const ev = v.events.find(e => e.key === key);
      if (!ev) continue;
      const pg = v.pages.find(p => p.slots.includes(ev.id));
      return { volId: v.id, pageId: pg?.id ?? null, eventId: ev.id };
    }
    return null;
  }

  /** An event with its current dialogue text attached. */
  resolveEvent(e) {
    const k = e.dialogueKeys ?? {}, f = e.fallbackText ?? {};
    // Deterministic LEGACY-KEY migration (working-notes comic finding #4,
    // 2026-09-09): books saved before choice-level mapping carry the generic
    // node key (`story.node`) even where a choice-level panel now exists.
    // Upgrade ONLY that generic default to `story.node.choice` when art for it
    // is mapped — a stored key that is anything else is an authored/explicit
    // choice and is never replaced.  Render-time only: the save is untouched.
    let panelKey = e.panelKey;
    if (e.choiceId && panelKey === panelKeyFor(e.storyId, e.nodeId)) {
      const choiceKey = `${e.storyId}.${e.nodeId}.${e.choiceId}`;
      if (hasPanelArt(choiceKey)) panelKey = choiceKey;
    }
    return {
      ...e,
      panelKey,
      text: {
        caption: resolveDialogue(k.caption, f.caption ?? ''),
        line:  resolveDialogue(k.line,  f.line  ?? ''),
        label: resolveDialogue(k.label, f.label ?? ''),
        reply: resolveDialogue(k.reply, f.reply ?? ''),
      },
    };
  }

  // ── Writes ──────────────────────────────────────────────────────────────

  /** Record a committed beat.  Idempotent per ledger key.  Returns the event
   *  (new or existing) or null when the entry isn't a comic beat. */
  record(entry, ctx = {}) {
    if (!isObj(entry) || typeof entry.key !== 'string') return null;
    let out = null;
    this._story.mutateCanon((c) => {
      // Already drawn?  (Any volume — a rewound run can't re-add it.)
      for (const v of c.volumes) {
        const hit = v.events.find(e => e.key === entry.key);
        if (hit) { out = hit; return false; }
      }
      const vol = this._openVolume(c, entry.at);
      const ch  = this._openChapter(c, vol, entry.runId, entry.at);
      const importance = IMPORTANCE.includes(entry.importance) ? entry.importance : 'choice';
      const ev = {
        id: `ev-${vol.n}-${vol.events.length + 1}`,
        key: entry.key,
        storyId: entry.storyId, nodeId: entry.nodeId, choiceId: entry.choiceId,
        importance,
        // New commits arrive with a resolved panelKey (StorySystem.commitChoice).
        // LEGACY events predate it, so run the SAME deterministic resolver here
        // rather than the old node-only fallback — that fallback is what made
        // every choice-level panel unreachable.  It may resolve to null, which
        // the renderers treat as "placeholder", never as a substitute image.
        panelKey: entry.panelKey ?? resolvePanelKey({
          storyId: entry.storyId, nodeId: entry.nodeId, choiceId: entry.choiceId,
          node: ctx?.node ?? null, choice: ctx?.choice ?? null,
        }) ?? panelKeyFor(entry.storyId, entry.nodeId),
        speaker: ctx?.node?.speaker ?? entry.speaker ?? '',
        portrait: ctx?.node?.portrait ?? entry.portrait ?? null,
        dialogueKeys: isObj(entry.dialogueKeys) ? { ...entry.dialogueKeys } : {},
        fallbackText: isObj(entry.fallbackText) ? { ...entry.fallbackText } : {},
        mile: Math.max(0, Number(entry.mile) || 0),
        at: Math.max(0, Number(entry.at) || 0),
        runId: entry.runId ?? null,
        chapterId: ch.id,
        cost: Math.max(0, Number(entry.cost) || 0),
        cash: Number(entry.effects?.cash) || 0,
        panels: importance === 'meanwhile' ? 3 : 1,
      };
      if (Array.isArray(entry.strip)) ev.strip = entry.strip.map(p => ({ speaker: String(p.speaker ?? ''), text: String(p.text ?? '') }));
      vol.events.push(ev);
      ch.eventIds.push(ev.id);
      this._placeEvent(vol, ev);
      out = ev;
      return true;
    });
    return out;
  }

  /** Pullman arrival (or any authored close).  No-op on an empty volume so a
   *  storyless trip never leaves a blank book behind. */
  closeVolume(reason = 'pullman', at = Date.now()) {
    let closed = false;
    this._story.mutateCanon((c) => {
      const vol = c.volumes.find(v => v.id === c.activeVolumeId);
      if (!vol || vol.status === 'complete' || vol.events.length === 0) return false;
      this._lockOpenPage(vol);
      for (const ch of vol.chapters) if (ch.status === 'open') ch.status = 'closed';
      vol.status = 'complete'; vol.closedAt = at; vol.closedBy = reason;
      c.activeVolumeId = null;
      closed = true;
      return true;
    });
    return closed;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  _openVolume(c, at) {
    let vol = c.volumes.find(v => v.id === c.activeVolumeId && v.status !== 'complete');
    if (vol) return vol;
    const n = c.volumes.length + 1;
    vol = { id: `vol-${n}`, n, status: 'open', startedAt: at ?? Date.now(), closedAt: null, closedBy: null,
            chapters: [], events: [], pages: [] };
    c.volumes.push(vol);
    c.activeVolumeId = vol.id;
    return vol;
  }

  _openChapter(c, vol, runId, at) {
    const open = vol.chapters.find(ch => ch.status === 'open');
    if (open && open.runId === runId) return open;
    if (open) { open.status = 'closed'; this._lockOpenPage(vol); }   // new trip → new chapter, fresh page
    const n = vol.chapters.length + 1;
    const ch = { id: `${vol.id}-ch-${n}`, n, runId: runId ?? null, startedAt: at ?? Date.now(), status: 'open', eventIds: [] };
    vol.chapters.push(ch);
    return ch;
  }

  _openPage(vol) { return vol.pages.find(p => !p.locked) ?? null; }

  _lockOpenPage(vol) {
    const p = this._openPage(vol);
    if (p) p.locked = true;
  }

  _newPage(vol, templateId, chapterId) {
    const t = PAGE_TEMPLATES[templateId];
    const n = vol.pages.length + 1;
    const p = { id: `${vol.id}-p-${n}`, n, templateId, slots: t.slots.map(() => null), locked: false, chapterId };
    vol.pages.push(p);
    return p;
  }

  _flowTemplateFor(vol) {
    return FLOW_CYCLE[vol.pages.length % FLOW_CYCLE.length];
  }

  _placeEvent(vol, ev) {
    const imp = ev.importance;
    if (imp === 'meanwhile') {
      this._lockOpenPage(vol);
      const p = this._newPage(vol, 'meanwhile', ev.chapterId);
      p.slots = [ev.id, ev.id, ev.id];   // one event, three sub-panels
      p.locked = true;
      return p;
    }
    if (imp === 'ending' || imp === 'climax' || imp === 'major') {
      let p = this._openPage(vol);
      // An untouched open page is reused (re-templated) rather than wasted.
      if (p && p.slots.every(s => s == null)) {
        vol.pages.pop();
      } else if (p) {
        p.locked = true;
      }
      const tid = imp === 'major' ? 'wide' : imp;
      p = this._newPage(vol, tid, ev.chapterId);
      p.slots[0] = ev.id;
      p.locked = true;
      return p;
    }
    // Flow events fill the open page, cycling templates by page ordinal.
    let p = this._openPage(vol);
    if (!p || p.chapterId !== ev.chapterId) {
      if (p) p.locked = true;
      p = this._newPage(vol, this._flowTemplateFor(vol), ev.chapterId);
    }
    const i = p.slots.indexOf(null);
    p.slots[i] = ev.id;
    if (p.slots.indexOf(null) === -1) p.locked = true;
    return p;
  }
}
