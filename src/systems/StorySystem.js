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
import { resolvePanelKey, panelKeyFor } from '../data/comicPanels.js';

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
        key: k,
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
        stopId: typeof e.stopId === 'string' ? e.stopId : null,
        speaker: typeof e.speaker === 'string' ? e.speaker : undefined,
        portrait: typeof e.portrait === 'string' ? e.portrait : undefined,
        panelKey: typeof e.panelKey === 'string' ? e.panelKey : undefined,
        strip: Array.isArray(e.strip) ? e.strip.filter(isObj).map(p => ({ speaker: String(p.speaker ?? ''), text: String(p.text ?? '') })) : undefined,
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

export function ledgerKey(storyId, attempt, nodeId, choiceId, stopId = null) {
  return `${storyId}#${attempt}:${nodeId}${stopId ? '@' + stopId : ''}:${choiceId}`;
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

  /** Read-modify-write the canon in one step (ComicSystem uses this for
   *  volumes).  `fn(canon)` returning false skips the write. */
  mutateCanon(fn) {
    const c = this.canon();
    if (fn(c) === false) return false;
    this._writeCanon(c);
    return true;
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

  /** Story nodes that fire at this stop right now.  A node is OPEN when the
   *  story is active (or this is its entry stop and it hasn't started), its
   *  `when(state, run)` predicate passes, and none of its consequential
   *  choices has been committed on this attempt — so a scene re-entry after
   *  a commit never re-prompts (18.5 idempotency), and skipping a stop simply
   *  leaves that stop's node behind.  Mandatory nodes come first — these
   *  block storefronts.  Nodes flagged `virtual` (ending-screen recoveries)
   *  are never listed. */
  pendingAt(stopId) {
    const c = this.canon();
    const out = [];
    for (const id of Object.keys(this._defs)) {
      const def = this._defs[id];
      const st  = c.stories[id] ?? emptyStoryState();
      const candidates = [];
      if (st.status === STORY_STATUS.ACTIVE) {
        for (const [nid, node] of Object.entries(def.nodes ?? {})) {
          if (node.virtual) continue;
          const here = node.repeatable
            ? (node.stops === '*' || (Array.isArray(node.stops) && node.stops.includes(stopId)))
            : node.stopId === stopId;
          if (here) candidates.push([nid, node]);
        }
      } else if (st.status === STORY_STATUS.AVAILABLE && def.entry?.stopId === stopId) {
        const node = def.nodes?.[def.startNode];
        if (node) candidates.push([def.startNode, node]);
      }
      for (const [nid, node] of candidates) {
        if (!this._nodeOpen(id, nid, node, st, c, stopId)) continue;
        out.push({ storyId: id, nodeId: nid, mandatory: !!node.mandatory, node });
      }
    }
    out.sort((a, b) => (b.mandatory ? 1 : 0) - (a.mandatory ? 1 : 0));
    return out;
  }

  _nodeOpen(storyId, nodeId, node, st, c, stopId = null) {
    try { if (typeof node.when === 'function' && !node.when(st, this._run)) return false; } catch (_) { return false; }
    const attempt = st.replayCount ?? 0;
    // A `repeatable` node (Brittney's needs) can fire at several stops; its
    // ledger keys carry the stop so each visit is its own beat.
    const sfx = node.repeatable ? (stopId ?? node.stopId) : null;
    for (const ch of node.choices ?? []) {
      if (ch.consequential === false) continue;
      if (c.ledger[ledgerKey(storyId, attempt, nodeId, ch.id, sfx)]) return false;
    }
    return true;
  }

  /** NPC line for a node — static string or `(state, run) => string`. */
  resolveLine(storyId, nodeId) {
    const node = this._node(storyId, nodeId);
    if (!node) return '';
    if (typeof node.line === 'function') { try { return String(node.line(this.story(storyId), this._run) ?? ''); } catch (_) { return ''; } }
    return node.line ?? '';
  }

  /** Reply for a choice — static string or `(state, run) => string`. */
  resolveReply(storyId, nodeId, choiceId) {
    const ch = this._choice(storyId, nodeId, choiceId);
    if (!ch) return '';
    if (typeof ch.reply === 'function') { try { return String(ch.reply(this.story(storyId), this._run) ?? ''); } catch (_) { return ''; } }
    return ch.reply ?? '';
  }

  /** Choices currently offered on a node (`when` on a choice hides it). */
  choicesFor(storyId, nodeId) {
    const node = this._node(storyId, nodeId);
    const st = this.story(storyId);
    return (node?.choices ?? []).filter(ch => {
      try { return typeof ch.when !== 'function' || !!ch.when(st, this._run); } catch (_) { return false; }
    });
  }

  /** Human label for a story's ending (e.g. "COMPLETE! SORT OF…"). */
  endingLabel(storyId) {
    const st = this.story(storyId);
    return this._defs[storyId]?.endings?.[st.endingId]?.label ?? null;
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
    st.relationship = clamp(num(def.startRelationship, st.relationship), 0, 100);
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
  commitChoice({ storyId, nodeId, choiceId, mile = 0, at = Date.now(), stopId = null }, hooks = {}) {
    const node   = this._node(storyId, nodeId);
    const choice = this._choice(storyId, nodeId, choiceId);
    if (!node || !choice) return { applied: false, entry: null, reason: 'unknown' };

    const c  = this.canon();
    const st = c.stories[storyId] ?? (c.stories[storyId] = emptyStoryState());
    if (TERMINAL.has(st.status)) return { applied: false, entry: null, reason: 'terminal' };
    const attempt = st.replayCount;
    if (node.repeatable && !stopId) return { applied: false, entry: null, reason: 'needs_stop' };
    const key = ledgerKey(storyId, attempt, nodeId, choiceId, node.repeatable ? stopId : null);
    if (c.ledger[key]) return { applied: false, entry: c.ledger[key], reason: 'duplicate', next: choice.next ?? null };

    // Casual exposition: navigate only, nothing irreversible.
    if (choice.consequential === false) {
      if (st.status === STORY_STATUS.ACTIVE && choice.next != null) st.nodeId = choice.next;
      this._writeCanon(c);
      return { applied: true, entry: null, effects: {}, next: choice.next ?? null };
    }

    // Authored beats that PRECEDE the choice in the book (e.g. Kyle's session
    // before the hand-over) — same canon, recorded before the choice entry.
    if (choice.beatsBefore?.length) this._emitAuthoredBeats(c, storyId, choice.beatsBefore, mile, at);

    // ── Persist FIRST (18.2: "committed synchronously … before its animation") ──
    // Effects may be authored as a function of (state, run) — e.g. a payout
    // that scales with surviving cargo — resolved ONCE here and stored
    // resolved, so the ledger records exactly what was applied.
    let effects = choice.effects;
    if (typeof effects === 'function') { try { effects = effects(st, this._run); } catch (_) { effects = {}; } }
    effects = isObj(effects) ? effects : {};
    const entry = {
      key,
      storyId, nodeId, choiceId, attempt, at, mile, stopId: stopId ?? node.stopId ?? null,
      runId: this._run.runId,
      // Stable keys + fallback copy so the comic can re-render this beat by
      // key later and still read if the key is ever renamed away (18.2).
      // Dynamic lines resolve to the copy the player actually saw.
      dialogueKeys: { line: lineKey(storyId, nodeId), label: labelKey(storyId, nodeId, choiceId), reply: replyKey(storyId, nodeId, choiceId) },
      // STABLE PANEL KEY (Ch.18 mapping contract).  Resolved once, HERE, and
      // stored — same discipline as dialogueKeys.  The comic must never
      // re-derive art from the node id (which silently dropped every
      // choice-level panel) or from a filename.  Persisting it also means a
      // later change to the resolution rules cannot repaint an old book.
      // `?? panelKeyFor(...)` is a stable IDENTIFIER, not a substitute image:
      // an unmapped key resolves to no art, so the renderers still show a
      // placeholder.  Recording it means art authored at that exact node key
      // later is picked up by books already on disk.
      panelKey: resolvePanelKey({ storyId, nodeId, choiceId, node, choice })
                ?? panelKeyFor(storyId, nodeId),
      fallbackText: { line: this.resolveLine(storyId, nodeId), label: choice.label ?? '', reply: this.resolveReply(storyId, nodeId, choiceId) },
      importance: node.importance ?? 'choice',
      effects: JSON.parse(JSON.stringify(effects)),
      cost: Math.max(0, num(choice.cost) | 0),
    };
    c.ledger[key] = entry;
    if (st.status === STORY_STATUS.AVAILABLE) {
      st.status = STORY_STATUS.ACTIVE;
      st.relationship = clamp(num(this._defs[storyId]?.startRelationship, st.relationship), 0, 100);
    }
    this._applyStoryEffects(c, storyId, effects, at);
    if (effects.relationship != null) this._run.flags.relFlashAt = mile;   // gameplay-only frame flash
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
    if (isObj(effects.cargo)) Object.assign(this._run.cargo, effects.cargo);
    if (typeof effects.radio === 'string') hooks.radio?.(effects.radio);
    if (typeof effects.meanwhile === 'string') this.mutateCanon((c2) => !!this._raiseMeanwhile(c2, storyId, effects.meanwhile, mile));
    hooks.panel?.(entry, node, choice);
    for (const fn of this._listeners) { try { fn(entry, { node, choice }); } catch (_) {} }
    // Authored FOLLOW-UP beats (special panels: pressing/loaded, evaluated
    // outcomes, reactions) — recorded AFTER the choice so the book reads
    // choice → consequence.  Choice-level first, then node-level.
    if (choice.beats?.length || node.beats?.length) {
      this.mutateCanon((c2) => (this._emitAuthoredBeats(c2, storyId, choice.beats, mile, at)
                              + this._emitAuthoredBeats(c2, storyId, node.beats, mile, at)) > 0);
    }
    return { applied: true, entry, effects, next: choice.next ?? null, leaveStop: effects.leaveStop === true };
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
    // Counters (Classic Rock): controlling choices steer the Broken Voice
    // route; solo shows grow an individual following, not the duet's.
    if (fx.controlling != null)   st.flags.controlling   = Math.max(0, (st.flags.controlling ?? 0) + num(fx.controlling));
    if (fx.soloFollowing != null) st.flags.soloFollowing = Math.max(0, (st.flags.soloFollowing ?? 0) + num(fx.soloFollowing));
    if (isObj(fx.contact) && fx.contact.id) {
      c.contacts[fx.contact.id] ??= { name: String(fx.contact.name ?? fx.contact.id), addedAt: at, storyId };
    }
    if (typeof fx.startStory === 'string' && this._defs[fx.startStory]) {
      const other = c.stories[fx.startStory] ?? (c.stories[fx.startStory] = emptyStoryState());
      if (other.status === STORY_STATUS.AVAILABLE) {
        other.status = STORY_STATUS.ACTIVE; other.nodeId = this._defs[fx.startStory].startNode;
        other.relationship = clamp(num(this._defs[fx.startStory].startRelationship, 0), 0, 100);
      }
    }
    if (typeof fx.endStory === 'string' && c.stories[fx.endStory] && !TERMINAL.has(c.stories[fx.endStory].status)) {
      c.stories[fx.endStory].status = fx.endStoryStatus === 'complete' ? STORY_STATUS.COMPLETE : STORY_STATUS.FAILED;
      c.stories[fx.endStory].endingId = fx.endStoryEnding ?? null;
      c.stories[fx.endStory].nodeId = null;
    }
    // Hand a story back to "not started" (Mercer's Country pick returns
    // Hip-Hop to the shelf for a later run).  Bumps the attempt so the
    // shelved attempt's ledger entries stay put and a fresh start can
    // re-commit the same nodes.
    if (typeof fx.resetStory === 'string' && c.stories[fx.resetStory]) {
      const o = c.stories[fx.resetStory];
      c.stories[fx.resetStory] = { ...emptyStoryState(), replayCount: (o.replayCount ?? 0) + 1 };
    }
    if (typeof fx.ending === 'string') {
      st.status = fx.status === 'failed' ? STORY_STATUS.FAILED : fx.status === 'dead' ? STORY_STATUS.DEAD : STORY_STATUS.COMPLETE;
      st.endingId = fx.ending;
      st.nodeId = null;
    } else if (typeof fx.status === 'string' && Object.values(STORY_STATUS).includes(fx.status)) {
      st.status = fx.status;
    }
  }

  // ── Choice-less beats + road events ─────────────────────────────────────

  /** AUTHORED special beats (Ch.18 special-beat emission, 2026-09-10).
   *  A spec: { id, panelKey (string | (st, run) => string|null), text
   *  (string | fn), importance?, speaker?, portrait?, when?(st, run) }.
   *  Idempotent per attempt through the ledger (beat key); an evaluated
   *  panelKey that returns null skips the beat for this playthrough.
   *  Used by node.intro (recorded when the node is first SHOWN),
   *  choice.beatsBefore (recorded just before the choice entry),
   *  choice.beats + node.beats (recorded after it). */
  _emitAuthoredBeats(c, storyId, specs, mile = 0, at = Date.now()) {
    if (!Array.isArray(specs) || !specs.length) return 0;
    const st = c.stories[storyId] ?? (c.stories[storyId] = emptyStoryState());
    let n = 0;
    for (const b of specs) {
      if (!b?.id) continue;
      try {
        if (typeof b.when === 'function' && !b.when(st, this._run)) continue;
        const pk = typeof b.panelKey === 'function' ? b.panelKey(st, this._run) : (b.panelKey ?? null);
        if (b.panelKey != null && pk == null) continue;
        const text = typeof b.text === 'function' ? String(b.text(st, this._run) ?? '') : String(b.text ?? '');
        if (this._beatInto(c, { storyId, beatId: b.id, panelKey: pk ?? null, importance: b.importance ?? 'consequence',
                                speaker: b.speaker ?? '', portrait: b.portrait ?? null, text, mile, at })) n++;
      } catch (_) {}
    }
    return n;
  }

  /** The scene is about to PRESENT this node (live tile built).  Records the
   *  node's authored `intro` beat(s) — establishing panels that precede the
   *  dialogue (the crew closing in, Dom'nique hearing the track…).  Idempotent. */
  noteNodeShown(storyId, nodeId, mile = 0) {
    const node = this._node(storyId, nodeId);
    const specs = node?.intro ? (Array.isArray(node.intro) ? node.intro : [node.intro]) : null;
    if (!specs) return 0;
    let n = 0;
    this.mutateCanon((c) => { n = this._emitAuthoredBeats(c, storyId, specs, mile); return n > 0; });
    return n;
  }

  /** A comic beat with no player choice (Brittney changing in the car, the
   *  kidnapping report, a roadside exit).  Idempotent per attempt + beatId;
   *  lands in the ledger like a choice so the comic and a rewind treat it
   *  the same.  Returns the entry, or null when already recorded. */
  recordBeat(beat) {
    const c = this.canon();
    const entry = this._beatInto(c, beat);
    if (entry) this._writeCanon(c);
    return entry;
  }

  /** Same, into a canon the caller is already mutating (roadEvent). */
  _beatInto(c, { storyId, beatId, importance = 'consequence', speaker = '', portrait = null, text = '', mile = 0, at = Date.now(), effects = null, strip = null, panelKey = null }) {
    const st = c.stories[storyId] ?? (c.stories[storyId] = emptyStoryState());
    const key = ledgerKey(storyId, st.replayCount, 'beat', beatId);
    if (c.ledger[key]) return null;
    const entry = {
      key, storyId, nodeId: 'beat', choiceId: beatId, attempt: st.replayCount, at, mile, runId: this._run.runId,
      dialogueKeys: { line: `${storyId}.beat.${beatId}.line` }, fallbackText: { line: text, label: '', reply: '' },
      // Explicit panelKey = an AUTHORED special panel (Ch.18 special beats:
      // `.intro`, `.arrival`, `.pressing`, evaluated outcomes…); default =
      // the generic beat key the road events use.
      importance, effects: isObj(effects) ? effects : {}, cost: 0, panelKey: panelKey ?? `${storyId}.beat.${beatId}`, speaker, portrait,
    };
    if (Array.isArray(strip)) entry.strip = strip.map(p => ({ speaker: String(p.speaker ?? ''), text: String(p.text ?? '') }));
    c.ledger[key] = entry;
    if (isObj(effects)) this._applyStoryEffects(c, storyId, effects, at);
    for (const fn of this._listeners) { try { fn(entry, { node: { speaker, portrait, importance }, choice: null }); } catch (_) {} }
    return entry;
  }

  /** A MEANWHILE… strip (18.4): a three-panel offscreen consequence from
   *  `def.meanwhile[stripId]`.  Recorded once per attempt as a beat and queued
   *  for a non-interrupting notification (GameScene polls pullMeanwhile()).
   *  Returns the entry, or null when already shown / unknown. */
  _raiseMeanwhile(c, storyId, stripId, mile) {
    const def = this._defs[storyId]?.meanwhile?.[stripId];
    if (!def) return null;
    const entry = this._beatInto(c, { storyId, beatId: 'mw_' + stripId, importance: 'meanwhile', speaker: def.speaker ?? '', portrait: def.portrait ?? null, text: def.title ?? 'MEANWHILE…', mile, strip: def.panels ?? [] });
    if (entry) (this._run.meanwhileQueue ??= []).push({ key: entry.key, storyId, stripId, title: def.title ?? 'MEANWHILE…' });
    return entry;
  }
  raiseMeanwhile(storyId, stripId, mile = 0) {
    let e = null;
    this.mutateCanon((c) => { e = this._raiseMeanwhile(c, storyId, stripId, mile); return !!e; });
    return e;
  }
  /** Next queued strip notification (FIFO), or null. */
  pullMeanwhile() { return (this._run.meanwhileQueue ?? []).shift() ?? null; }
  peekMeanwhile() { return (this._run.meanwhileQueue ?? [])[0] ?? null; }

  /** No generic hitchhiker while a featured passenger is aboard, nor at the
   *  stop where one could still board (18.4). */
  hitchhikerBlocked(stopId) {
    if (this._run.passenger) return true;
    const c = this.canon();
    for (const [id, def] of Object.entries(this._defs)) {
      if (typeof def.passengerJoinStop !== 'function') continue;
      try { if (def.passengerJoinStop(c.stories[id] ?? emptyStoryState(), this._run, c) === stopId) return true; } catch (_) {}
    }
    return false;
  }

  /** Something happened on the road ('damage' {hp, source}, 'pass', 'tick'
   *  {mile, dt, stopped, onShoulder}).  Each active story's `def.onRoad` may
   *  answer with lines to show / world effects, applied through `hooks`
   *  (say(text, storyId), wanted(n), passenger(p|null)).  Returns the
   *  responses. */
  roadEvent(type, payload = {}, hooks = {}) {
    const out = [];
    const c = this.canon();
    let changed = false;
    for (const [id, def] of Object.entries(this._defs)) {
      const st = c.stories[id];
      if (!st || st.status !== STORY_STATUS.ACTIVE || typeof def.onRoad !== 'function') continue;
      const api = {
        state: st, run: this._run,
        say: (text) => { hooks.say?.(text, id); out.push({ storyId: id, text }); },
        relationship: (d) => { st.relationship = clamp(st.relationship + num(d), 0, 100); changed = true; },
        flags: (o) => { Object.assign(st.flags, o); changed = true; },
        wanted: (n) => hooks.wanted?.(n),
        passenger: (p) => { this._run.passenger = p ?? null; hooks.passenger?.(this._run.passenger); },
        beat: (b) => { const e = this._beatInto(c, { storyId: id, mile: payload.mile ?? 0, ...b }); if (e) changed = true; return e; },
        meanwhile: (stripId) => { if (this._raiseMeanwhile(c, id, stripId, payload.mile ?? 0)) changed = true; },
        fail: (endingId) => { if (!TERMINAL.has(st.status)) { st.status = STORY_STATUS.FAILED; st.endingId = endingId ?? null; st.nodeId = null; changed = true; } },
      };
      try { def.onRoad(type, payload, api); } catch (_) {}
    }
    if (changed) this._writeCanon(c);
    return out;
  }

  /** Pulled into a rest stop (`def.onRestStop(stopId, api)`) — Nerve refills,
   *  a need is assigned.  Once per visit (the scene calls it from create). */
  restStopVisited(stopId, hooks = {}) {
    this.mutateCanon((c) => {
      let changed = false;
      for (const [id, def] of Object.entries(this._defs)) {
        const st = c.stories[id];
        if (!st || st.status !== STORY_STATUS.ACTIVE || typeof def.onRestStop !== 'function') continue;
        const api = {
          state: st, run: this._run,
          flags: (o) => { Object.assign(st.flags, o); changed = true; },
          say: (text) => hooks.say?.(text, id),
        };
        try { def.onRestStop(stopId, api); } catch (_) {}
      }
      return changed;
    });
  }

  // ── Run state (snapshot) ────────────────────────────────────────────────

  /** Fresh run: new run id, nothing in the seat, no radio grant — then
   *  whatever the plate canon says the player is still carrying is derived
   *  back in (the phone still grants radio on a new run; pressed records
   *  ride along at their last synced count). */
  resetRun(runId = null) {
    this._run = {
      runId: runId ?? genRunId(),
      radioGrant: null,     // culture string while a story grants temporary radio
      passenger:  null,     // { id, name } while a featured passenger is aboard
      nerve:      25,       // Brittney's Nerve (Phase 4)
      cargo:      {},       // { records: n, recordsMax, hpLost } (Phase 3)
      flags:      {},       // run-scoped story flags (warnings fired, miles at 0 Nerve…)
      meanwhileQueue: [],   // strips raised but not yet notified (Phase 6)
    };
    this.deriveRun();
  }

  /** Let each active story project durable canon (items) onto run state.
   *  Idempotent; safe after resetRun / restore / a slot switch. */
  deriveRun() {
    const c = this.canon();
    for (const [id, def] of Object.entries(this._defs)) {
      const st = c.stories[id];
      if (!st || st.status !== STORY_STATUS.ACTIVE || typeof def.deriveRun !== 'function') continue;
      try { def.deriveRun(st, this._run); } catch (_) {}
    }
  }

  /** The player drove PAST a rest-stop exit without taking it.  Stories
   *  react through `def.onPass[stopId](api)` — the api writes canon flags /
   *  items / relationship (idempotent by the flags each hook checks) and
   *  world effects through `hooks` (text, radioGrant).  Returns the story
   *  ids that reacted. */
  exitPassed(stopId, mile = 0, hooks = {}) {
    const reacted = [];
    this.mutateCanon((c) => {
      let changed = false;
      for (const [id, def] of Object.entries(this._defs)) {
        const st = c.stories[id];
        const fn = def.onPass?.[stopId];
        if (!st || st.status !== STORY_STATUS.ACTIVE || typeof fn !== 'function') continue;
        const api = {
          state: st, run: this._run, mile,
          flags: (o) => { Object.assign(st.flags, o); changed = true; },
          items: (o) => { for (const [k, v] of Object.entries(o)) { if (v === false || v == null) delete st.items[k]; else st.items[k] = v; } changed = true; },
          relationship: (d) => { st.relationship = clamp(st.relationship + num(d), 0, 100); changed = true; },
          radioGrant: (g) => { this._run.radioGrant = g ?? null; hooks.radioGrant?.(this._run.radioGrant); },
          text: (cid, from, msg) => hooks.text?.(cid, from, msg, id),
          meanwhile: (stripId) => { if (this._raiseMeanwhile(c, id, stripId, mile)) changed = true; },
          // Authored special panel from a pass event (e.g. the phone locking
          // past Issaquah) — same canon, explicit panelKey honoured.
          beat: (b) => { const e = this._beatInto(c, { storyId: id, mile, ...b }); if (e) changed = true; return e; },
          fail: (endingId) => { if (!TERMINAL.has(st.status)) { st.status = STORY_STATUS.FAILED; st.endingId = endingId ?? null; st.nodeId = null; changed = true; } },
        };
        let did = false;
        try { did = fn(api) !== false; } catch (_) { did = false; }
        if (did) reacted.push(id);
      }
      return changed;
    });
    return reacted;
  }

  /** The player REWOUND to before an exit they had passed (GameScene
   *  _doRewind): let each story reverse what its onPass did, via
   *  `def.onUnpass?.[stopId]`.  Mirrors exitPassed's api. */
  exitUnpassed(stopId, mile = 0, hooks = {}) {
    const reacted = [];
    this.mutateCanon((c) => {
      let changed = false;
      for (const [id, def] of Object.entries(this._defs)) {
        const st = c.stories[id];
        const fn = def.onUnpass?.[stopId];
        if (!st || st.status !== STORY_STATUS.ACTIVE || typeof fn !== 'function') continue;
        const api = {
          state: st, run: this._run, mile,
          flags: (o) => { Object.assign(st.flags, o); changed = true; },
          items: (o) => { for (const [k, v] of Object.entries(o)) { if (v === false || v == null) delete st.items[k]; else st.items[k] = v; } changed = true; },
          relationship: (d) => { st.relationship = clamp(st.relationship + num(d), 0, 100); changed = true; },
          radioGrant: (g) => { this._run.radioGrant = g ?? null; hooks.radioGrant?.(this._run.radioGrant); },
        };
        let did = false;
        try { did = fn(api) !== false; } catch (_) { did = false; }
        if (did) reacted.push(id);
      }
      return changed;
    });
    return reacted;
  }

  /** Vehicle HP damage → story cargo rules (`def.onDamage(run, amountHp)`).
   *  Pure run-state; synced to canon by syncCargo(). */
  onDamage(amountHp) {
    const a = Math.max(0, num(amountHp));
    if (!a) return;
    const c = this.canon();
    for (const [id, def] of Object.entries(this._defs)) {
      const st = c.stories[id];
      if (!st || st.status !== STORY_STATUS.ACTIVE || typeof def.onDamage !== 'function') continue;
      try { def.onDamage(st, this._run, a); } catch (_) {}
    }
  }

  /** Persist run cargo into canon items (called at save points, not per hit). */
  syncCargo() {
    this.mutateCanon((c) => {
      let changed = false;
      for (const [id, def] of Object.entries(this._defs)) {
        const st = c.stories[id];
        if (!st || st.status !== STORY_STATUS.ACTIVE || typeof def.syncCargo !== 'function') continue;
        try { if (def.syncCargo(st, this._run) !== false) changed = true; } catch (_) {}
      }
      return changed;
    });
  }

  /** Authored ambushes that should trigger at this mile on this run
   *  (`def.ambush = { mile, when(state, run) }`); each fires once per run. */
  ambushesAt(mile) {
    const c = this.canon();
    const out = [];
    for (const [id, def] of Object.entries(this._defs)) {
      const st = c.stories[id], am = def.ambush;
      if (!st || st.status !== STORY_STATUS.ACTIVE || !am) continue;
      if (this._run.flags['ambush_' + id]) continue;
      if (mile < am.mile) continue;
      let ok = false; try { ok = !!am.when(st, this._run); } catch (_) {}
      if (ok) out.push({ storyId: id, ...am });
    }
    return out;
  }
  markAmbush(storyId) { this._run.flags['ambush_' + storyId] = true; }

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
    r.meanwhileQueue = Array.isArray(snap.meanwhileQueue) ? snap.meanwhileQueue.filter(isObj) : [];
    this.reapplyLedger();
    this.deriveRun();
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
