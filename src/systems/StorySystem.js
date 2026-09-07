// ── StorySystem — featured-story state machine + irreversible ledger (Ch. 18) ──
//
// Owns the three featured arcs (featuredStories.js) SEPARATELY from
// MissionSystem: no mission slots, types, rep or business availability are
// touched.  Two kinds of state, deliberately split:
//
//   PLATE CANON  (`storyCanon` in the plate's GLOBAL save bucket)
//     The permanent record: per-story status / current node / ending /
//     replay count / flags / durable items / relationship, the choice
//     LEDGER, contacts, and the comic volume containers ComicSystem fills in
//     Phase 2.  Survives force-closes, checkpoint rewinds, deaths, restarts
//     and NEW RUNS.  Only a plate reset clears it (SaveSystem.resetProgress).
//
//   RUN STATE    (rides inside GameScene._collectSaveSnapshot via serialize())
//     Per-run transients: the run id, the temporary radio grant, the
//     passenger in the seat, Nerve, cargo counts.  Restored on exact
//     resumes.  After ANY restore the ledger is re-applied so a rewind can
//     never undo a committed choice.
//
// COMMIT CONTRACT.  `commitChoice` is the ONE door for consequential
// selections.  It writes the plate save synchronously BEFORE returning
// (the scene animates afterwards, 18.2), and it is idempotent: the ledger
// key includes the story's replay attempt, so a double tap, a scene
// re-entry, or a rewind-then-replay of the same node all resolve to "already
// committed" and apply NOTHING a second time — no cash, no unlock, no panel.
// World-facing effects (cash, genre unlock, contacts, wanted level,
// passenger, radio grant) go out through the `hooks` the caller passes, and
// only on the first commit.
//
// Sandbox: `storyCanon` is a SANDBOX_KEY, so a Custom run sees the plate's
// canon (seeded on setSandbox) but every write is discarded with the run
// (owner 2026-09-06: Custom runs are non-canonical).
//
// Pure JS, no Phaser — covered by tests/story.test.mjs.

import {
  FEATURED_STORIES, STORY_IDS, STORY_GENRE, STORY_DEFS_VERSION,
  lineKey, labelKey, replyKey,
} from '../data/featuredStories.js';

export const CANON_SCHEMA_VERSION = 1;

export const STORY_STATUS = Object.freeze({
  AVAILABLE: 'available',   // not started (or started on a past attempt that ended)
  ACTIVE:    'active',
  COMPLETE:  'complete',
  FAILED:    'failed',
  DEAD:      'dead',        // permanently dead for the current comic path (Vantage recovery "continue")
});

const TERMINAL = new Set([STORY_STATUS.COMPLETE, STORY_STATUS.FAILED, STORY_STATUS.DEAD]);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num   = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function emptyStoryState() {
  return {
    status: STORY_STATUS.AVAILABLE,
    nodeId: null,
    endingId: null,
    replayCount: 0,          // completed/failed attempts before the current one
    flags: {},
    items: {},               // durable story inventory (phone, thumb drive, records…)
    relationship: 0,         // 0–100 raw; shown as five stars (never rounded for thresholds)
    following: 0,
  };
}

export function emptyStoryCanon() {
  return {
    schemaVersion: CANON_SCHEMA_VERSION,
    defsVersion:   STORY_DEFS_VERSION,
    ledger:        {},       // { ledgerKey: { storyId, nodeId, choiceId, attempt, at, mile, runId, effects } }
    stories:       Object.fromEntries(STORY_IDS.map(id => [id, emptyStoryState()])),
    contacts:      {},       // { contactId: { name, addedAt, storyId } }
    activeVolumeId: null,    // ComicSystem (Phase 2)
    volumes:       [],       // ComicSystem (Phase 2)
  };
}

/** Coerce anything the save hands back into a full canon shape.  Unknown
 *  story ids are kept (a future arc / an older build's arc) so nothing a
 *  player earned is dropped by a build that doesn't know about it. */
export function normalizeStoryCanon(src) {
  const c = emptyStoryCanon();
  if (!isObj(src)) return c;
  if (isObj(src.ledger)) {
    for (const [k, e] of Object.entries(src.ledger)) {
      if (!isObj(e) || typeof e.storyId !== 'string' || typeof e.choiceId !== 'string') continue;
      c.ledger[k] = {
        storyId: e.storyId, nodeId: String(e.nodeId ?? ''), choiceId: e.choiceId,
        attempt: Math.max(0, num(e.attempt) | 0),
        at: Math.max(0, num(e.at) | 0), mile: Math.max(0, num(e.mile)),
        runId: typeof e.runId === 'string' ? e.runId : null,
        effects: isObj(e.effects) ? e.effects : {},
        // Comic beat payload (18.2): stable keys + the copy as it read when
        // committed.  MUST round-trip or the reader loses old panels' text.
        dialogueKeys: isObj(e.dialogueKeys) ? { ...e.dialogueKeys } : {},
        fallbackText: isObj(e.fallbackText) ? { ...e.fallbackText } : {},
        importance: typeof e.importance === 'string' ? e.importance : 'choice',
        cost: Math.max(0, num(e.cost) | 0),
      };
    }
  }
  if (isObj(src.stories)) {
    for (const [id, s] of Object.entries(src.stories)) {
      if (!isObj(s)) continue;
      const st = c.stories[id] ?? emptyStoryState();
      if (Object.values(STORY_STATUS).includes(s.status)) st.status = s.status;
      st.nodeId       = typeof s.nodeId === 'string' ? s.nodeId : null;
      st.endingId     = typeof s.endingId === 'string' ? s.endingId : null;
      st.replayCount  = Math.max(0, num(s.replayCount) | 0);
      st.flags        = isObj(s.flags) ? { ...s.flags } : {};
      st.items        = isObj(s.items) ? { ...s.items } : {};
      st.relationship = clamp(num(s.relationship), 0, 100);
      st.following    = Math.max(0, num(s.following));
      c.stories[id] = st;
    }
  }
  if (isObj(src.contacts)) {
    for (const [id, ct] of Object.entries(src.contacts)) {
      if (!isObj(ct)) continue;
      c.contacts[id] = { name: String(ct.name ?? id), addedAt: Math.max(0, num(ct.addedAt) | 0), storyId: typeof ct.storyId === 'string' ? ct.storyId : null };
    }
  }
  c.activeVolumeId = typeof src.activeVolumeId === 'string' ? src.activeVolumeId : null;
  c.volumes        = Array.isArray(src.volumes) ? src.volumes.filter(isObj) : [];
  return c;
}

function genRunId() {
  return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function ledgerKey(storyId, attempt, nodeId, choiceId) {
  return `${storyId}#${attempt}:${nodeId}:${choiceId}`;
}

export class StorySystem {
  constructor(save, defs = FEATURED_STORIES) {
    this._save = save ?? null;
    this._defs = defs;
    this._listeners = [];          // ComicSystem subscribes here (Phase 2)
    this.resetRun();
  }

  /** Node / choice lookups against THIS instance's definitions (tests inject
   *  throwaway trees; production uses FEATURED_STORIES). */
  _node(storyId, nodeId)             { return this._defs[storyId]?.nodes?.[nodeId] ?? null; }
  _choice(storyId, nodeId, choiceId) { return this._node(storyId, nodeId)?.choices?.find(c => c.id === choiceId) ?? null; }

  /** Late-bind / rebind the save (registry order safety, same as missions). */
  attachSave(save) { if (save) this._save = save; }

  /** `fn(entry, ctx)` after every FIRST-TIME commit — never on a duplicate. */
  onCommit(fn) { if (typeof fn === 'function') this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(f => f !== fn); }; }

  // ── Plate canon ─────────────────────────────────────────────────────────

  /** Live, normalized canon.  Always read through here — never cache it
   *  across a save-slot switch or a sandbox toggle. */
  canon() {
    return normalizeStoryCanon(this._save?.get?.('storyCanon', null));
  }

  _writeCanon(c) {
    c.schemaVersion = CANON_SCHEMA_VERSION;
    c.defsVersion   = STORY_DEFS_VERSION;
    this._save?.set?.('storyCanon', c);   // SaveSystem.set persists synchronously
  }

  story(storyId) { return this.canon().stories[storyId] ?? emptyStoryState(); }
  status(storyId) { return this.story(storyId).status; }
  isActive(storyId) { return this.status(storyId) === STORY_STATUS.ACTIVE; }
  isTerminal(storyId) { return TERMINAL.has(this.status(storyId)); }
  hasCommitted(storyId, nodeId, choiceId, attempt = null) {
    const c = this.canon();
    const a = attempt ?? (c.stories[storyId]?.replayCount ?? 0);
    return !!c.ledger[ledgerKey(storyId, a, nodeId, choiceId)];
  }

  /** Current node definition for a story, or null when it has none. */
  currentNode(storyId) {
    const st = this.story(storyId);
    return st.nodeId ? this._node(storyId, st.nodeId) : null;
  }

  /** Featured stories that (a) are active with their current node at this
   *  stop, or (b) can be entered here and have never been started on this
   *  attempt.  Mandatory ones come first — these block storefronts (18.5). */
  pendingAt(stopId) {
    const c = this.canon();
    const out = [];
    for (const id of Object.keys(this._defs)) {
      const def = this._defs[id];
      const st  = c.stories[id] ?? emptyStoryState();
      let nodeId = null;
      if (st.status === STORY_STATUS.ACTIVE && st.nodeId) {
        if (this._node(id, st.nodeId)?.stopId === stopId) nodeId = st.nodeId;
      } else if (st.status === STORY_STATUS.AVAILABLE && def.entry?.stopId === stopId) {
        nodeId = def.startNode;
      }
      if (!nodeId) continue;
      const node = this._node(id, nodeId);
      if (!node) continue;
      out.push({ storyId: id, nodeId, mandatory: !!node.mandatory, node });
    }
    out.sort((a, b) => (b.mandatory ? 1 : 0) - (a.mandatory ? 1 : 0));
    return out;
  }

  // ── Lifecycle (all idempotent) ──────────────────────────────────────────

  /** Begin (or re-enter) a story at its start node.  No-op if already
   *  active.  A terminal story is NOT restarted here — see beginReplay. */
  activate(storyId, { nodeId = null } = {}) {
    const def = this._defs[storyId];
    if (!def) return false;
    const c = this.canon();
    const st = c.stories[storyId] ?? (c.stories[storyId] = emptyStoryState());
    if (st.status === STORY_STATUS.ACTIVE) return false;
    if (TERMINAL.has(st.status)) return false;
    st.status = STORY_STATUS.ACTIVE;
    st.nodeId = nodeId ?? def.startNode;
    this._writeCanon(c);
    return true;
  }

  /** Move the current node WITHOUT a ledger entry — casual exposition and
   *  scene-driven transitions (arriving at the next stop).  Persistent, but
   *  not irreversible. */
  advance(storyId, nodeId) {
    const c = this.canon();
    const st = c.stories[storyId];
    if (!st || st.status !== STORY_STATUS.ACTIVE) return false;
    if (nodeId != null && !this._node(storyId, nodeId)) return false;
    if (st.nodeId === nodeId) return false;
    st.nodeId = nodeId;
    this._writeCanon(c);
    return true;
  }

  complete(storyId, endingId) { return this._end(storyId, STORY_STATUS.COMPLETE, endingId); }
  fail(storyId, endingId)     { return this._end(storyId, STORY_STATUS.FAILED,   endingId); }
  /** Permanently dead for the current comic path (Vantage "continue"). */
  kill(storyId, endingId = 'dead') { return this._end(storyId, STORY_STATUS.DEAD, endingId); }

  _end(storyId, status, endingId) {
    const c = this.canon();
    const st = c.stories[storyId];
    if (!st || TERMINAL.has(st.status)) return false;   // first terminal outcome wins
    st.status = status;
    st.endingId = endingId ?? null;
    st.nodeId = null;
    this._writeCanon(c);
    return true;
  }

  /** Replay a finished story for an alternate ending (18.1).  Bumps the
   *  attempt so old ledger entries stay untouched (prior comics keep their
   *  panels) and fresh commits get new keys.  Run-level economy (the $0 /
   *  no-upgrades rule) is the scene's job when it starts the replay run. */
  beginReplay(storyId) {
    const def = this._defs[storyId];
    if (!def) return false;
    const c = this.canon();
    const st = c.stories[storyId];
    if (!st || !TERMINAL.has(st.status)) return false;
    const keep = st.replayCount + 1;
    c.stories[storyId] = { ...emptyStoryState(), status: STORY_STATUS.ACTIVE, nodeId: def.startNode, replayCount: keep };
    this._writeCanon(c);
    return true;
  }

  // ── The one door: commit a consequential choice ─────────────────────────

  /**
   * Commit `choiceId` on `nodeId` of `storyId`.
   *
   * Returns { applied, entry, effects, next }.  `applied` is false when the
   * exact same selection was already committed on this attempt (double tap,
   * scene re-entry, rewind) — the caller must then apply NOTHING and just
   * re-sync its view.  Non-consequential choices navigate and return
   * `applied: true` with `entry: null` (nothing to record).
   *
   * `hooks` (all optional, fired once, only on a first commit):
   *   cash(n)                 credit (+) / debit (-) the wallet
   *   unlockGenre(culture)    permanent genre ownership (== dealership buy)
   *   contact({id,name})      Messages contact added
   *   wanted(n)               set/raise wanted stars
   *   passenger(p|null)       seat a passenger / drop them
   *   radioGrant(culture|null) temporary radio access on/off
   *   panel(entry, node, choice) comic event (ComicSystem, Phase 2)
   */
  commitChoice({ storyId, nodeId, choiceId, mile = 0, at = Date.now() }, hooks = {}) {
    const node   = this._node(storyId, nodeId);
    const choice = this._choice(storyId, nodeId, choiceId);
    if (!node || !choice) return { applied: false, entry: null, reason: 'unknown' };

    const c  = this.canon();
    const st = c.stories[storyId] ?? (c.stories[storyId] = emptyStoryState());
    if (TERMINAL.has(st.status)) return { applied: false, entry: null, reason: 'terminal' };
    const attempt = st.replayCount;
    const key = ledgerKey(storyId, attempt, nodeId, choiceId);
    if (c.ledger[key]) return { applied: false, entry: c.ledger[key], reason: 'duplicate', next: choice.next ?? null };

    // Casual exposition: navigate only, nothing irreversible.
    if (choice.consequential === false) {
      if (st.status === STORY_STATUS.ACTIVE && choice.next != null) st.nodeId = choice.next;
      this._writeCanon(c);
      return { applied: true, entry: null, effects: {}, next: choice.next ?? null };
    }

    // ── Persist FIRST (18.2: "committed synchronously … before its animation") ──
    const effects = isObj(choice.effects) ? choice.effects : {};
    const entry = {
      storyId, nodeId, choiceId, attempt, at, mile,
      runId: this._run.runId,
      // Stable keys + fallback copy so the comic can re-render this beat by
      // key later and still read if the key is ever renamed away (18.2).
      dialogueKeys: { line: lineKey(storyId, nodeId), label: labelKey(storyId, nodeId, choiceId), reply: replyKey(storyId, nodeId, choiceId) },
      fallbackText: { line: node.line ?? '', label: choice.label ?? '', reply: choice.reply ?? '' },
      importance: node.importance ?? 'choice',
      effects: JSON.parse(JSON.stringify(effects)),
      cost: Math.max(0, num(choice.cost) | 0),
    };
    c.ledger[key] = entry;
    if (st.status === STORY_STATUS.AVAILABLE) st.status = STORY_STATUS.ACTIVE;
    this._applyStoryEffects(c, storyId, effects, at);
    if (st.status === STORY_STATUS.ACTIVE) st.nodeId = choice.next ?? st.nodeId;
    this._writeCanon(c);

    // ── World-facing effects, exactly once ──
    const cost = entry.cost;
    const cash = num(effects.cash);
    if (cost || cash) hooks.cash?.(cash - cost);
    if (effects.unlockGenre) hooks.unlockGenre?.(effects.unlockGenre);
    if (isObj(effects.contact)) hooks.contact?.(effects.contact);
    if (effects.wanted != null) hooks.wanted?.(num(effects.wanted));
    if ('passenger' in effects) { this._run.passenger = effects.passenger ?? null; hooks.passenger?.(this._run.passenger); }
    if ('radioGrant' in effects) { this._run.radioGrant = effects.radioGrant ?? null; hooks.radioGrant?.(this._run.radioGrant); }
    if (effects.nerve != null) this._run.nerve = clamp(this._run.nerve + num(effects.nerve), 0, 25);
    hooks.panel?.(entry, node, choice);
    for (const fn of this._listeners) { try { fn(entry, { node, choice }); } catch (_) {} }
    return { applied: true, entry, effects, next: choice.next ?? null };
  }

  /** Story-state effects (flags / items / relationship / following / ending /
   *  cross-story start+end).  Mutates the canon passed in; caller writes. */
  _applyStoryEffects(c, storyId, fx, at) {
    const st = c.stories[storyId];
    if (isObj(fx.flags)) Object.assign(st.flags, fx.flags);
    if (isObj(fx.items)) {
      for (const [k, v] of Object.entries(fx.items)) {
        if (v === false || v == null) delete st.items[k]; else st.items[k] = v;
      }
    }
    if (fx.relationship != null) st.relationship = clamp(st.relationship + num(fx.relationship), 0, 100);
    if (fx.following != null)    st.following    = Math.max(0, st.following + num(fx.following));
    if (isObj(fx.contact) && fx.contact.id) {
      c.contacts[fx.contact.id] ??= { name: String(fx.contact.name ?? fx.contact.id), addedAt: at, storyId };
    }
    if (typeof fx.startStory === 'string' && this._defs[fx.startStory]) {
      const other = c.stories[fx.startStory] ?? (c.stories[fx.startStory] = emptyStoryState());
      if (other.status === STORY_STATUS.AVAILABLE) { other.status = STORY_STATUS.ACTIVE; other.nodeId = this._defs[fx.startStory].startNode; }
    }
    if (typeof fx.endStory === 'string' && c.stories[fx.endStory] && !TERMINAL.has(c.stories[fx.endStory].status)) {
      c.stories[fx.endStory].status = fx.endStoryStatus === 'complete' ? STORY_STATUS.COMPLETE : STORY_STATUS.FAILED;
      c.stories[fx.endStory].endingId = fx.endStoryEnding ?? null;
      c.stories[fx.endStory].nodeId = null;
    }
    if (typeof fx.ending === 'string') {
      st.status = fx.status === 'failed' ? STORY_STATUS.FAILED : fx.status === 'dead' ? STORY_STATUS.DEAD : STORY_STATUS.COMPLETE;
      st.endingId = fx.ending;
      st.nodeId = null;
    } else if (typeof fx.status === 'string' && Object.values(STORY_STATUS).includes(fx.status)) {
      st.status = fx.status;
    }
  }

  // ── Run state (snapshot) ────────────────────────────────────────────────

  /** Fresh run: new run id, nothing in the seat, no radio grant. */
  resetRun(runId = null) {
    this._run = {
      runId: runId ?? genRunId(),
      radioGrant: null,     // culture string while a story grants temporary radio
      passenger:  null,     // { id, name } while a featured passenger is aboard
      nerve:      25,       // Brittney's Nerve (Phase 4)
      cargo:      {},       // { records: n } (Phase 3)
      flags:      {},       // run-scoped story flags (warnings fired, miles at 0 Nerve…)
    };
  }

  get run() { return this._run; }
  get runId() { return this._run.runId; }

  /** Run-state snapshot — rides inside GameScene._collectSaveSnapshot(). */
  serialize() {
    return JSON.parse(JSON.stringify({ v: 1, ...this._run }));
  }

  /** Restore run state from a snapshot, then re-apply the irreversible plate
   *  ledger so a checkpoint rewind can't undo a choice (18.2).  The canon
   *  itself never lives in the snapshot; what "re-apply" means here is:
   *  anything the ledger says has happened wins over what the snapshot
   *  remembers — e.g. a snapshot taken while still carrying the phone, then
   *  a commit that handed it over, then a rewind: the item stays gone. */
  restore(snap) {
    if (!isObj(snap)) return;
    const r = this._run;
    if (typeof snap.runId === 'string' && snap.runId) r.runId = snap.runId;
    r.radioGrant = typeof snap.radioGrant === 'string' ? snap.radioGrant : null;
    r.passenger  = isObj(snap.passenger) ? { ...snap.passenger } : null;
    r.nerve      = clamp(num(snap.nerve, 25), 0, 25);
    r.cargo      = isObj(snap.cargo) ? { ...snap.cargo } : {};
    r.flags      = isObj(snap.flags) ? { ...snap.flags } : {};
    this.reapplyLedger();
  }

  /** Walk this run's ledger entries in commit order and force the run state
   *  to agree with them.  Safe to call any time; pure function of the ledger. */
  reapplyLedger() {
    const c = this.canon();
    const mine = Object.values(c.ledger)
      .filter(e => e.runId === this._run.runId)
      .sort((a, b) => a.at - b.at);
    for (const e of mine) {
      const fx = e.effects ?? {};
      if ('passenger'  in fx) this._run.passenger  = fx.passenger ?? null;
      if ('radioGrant' in fx) this._run.radioGrant = fx.radioGrant ?? null;
    }
    // A story that has ENDED can't still be granting radio or holding a seat.
    for (const [id, st] of Object.entries(c.stories)) {
      if (!TERMINAL.has(st.status)) continue;
      if (this._run.radioGrant && this._run.radioGrant === STORY_GENRE[id]) this._run.radioGrant = null;
      if (this._run.passenger?.storyId === id) this._run.passenger = null;
    }
    return mine.length;
  }
}
