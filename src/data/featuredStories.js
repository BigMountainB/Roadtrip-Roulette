// ── Featured genre stories — data-driven story definitions (Ch. 18) ─────────
//
// Three authored arcs ride ON TOP of the ordinary mission system, never in
// it: Hip-Hop "Malik's Phone" (A), Country "StageWagon or Bust" (B) and
// Classic Rock "ImprompTour" (C).  StorySystem walks these trees; the scenes
// only render whatever node StorySystem says is current.  Nothing in here is
// mutable at runtime — a story's progress lives in the plate's `storyCanon`
// (SaveSystem), keyed by the stable ids below.
//
// STABLE KEYS.  Every line of dialogue has a key the comic saves alongside
// its text (`dialogueKey` + `fallbackText`, Ch. 18.2).  Keys are derived from
// the tree position, so RENAMING a node or choice id changes its key and old
// comics fall back to the copy they saved.  Editing the TEXT of a node or
// choice in place is safe — old comics pick up the new copy by key.
//
//   `${storyId}.${nodeId}.line`                 the NPC's line on that node
//   `${storyId}.${nodeId}.${choiceId}.label`    the player's spoken line
//   `${storyId}.${nodeId}.${choiceId}.reply`    the NPC's reaction to it
//
// NODE SHAPE
//   {
//     stopId:      'M',            // rest stop where this node is reachable
//     mandatory:   true,           // runs BEFORE storefronts / ordinary NPCs (18.5)
//     speaker:     'Brittney',     // display name in the balloon
//     portrait:    'biz_gasnsip',  // npcPortraits key (panel art comes in Phase 8)
//     line:        '…',            // NPC copy (no baked dialogue in art)
//     importance:  'choice',       // comic event tag (18.3) — minor|choice|consequence|major|climax|ending|meanwhile
//     choices:     [ …choice ],
//   }
//
// CHOICE SHAPE
//   {
//     id:            'keepJob',    // stable within the node
//     label:         '…',          // the player's SPOKEN line (never Accept/Decline)
//     reply:         '…',          // NPC reaction shown before the tile slides away
//     consequential: true,         // false = casual exposition: same UI, NO ledger entry / panel
//     next:          'nodeId' | null,   // null = conversation ends on this node
//     cost:          0,            // $ debited on commit (disabled when unaffordable)
//     effects:       { …EFFECTS }, // applied EXACTLY ONCE by StorySystem.commitChoice
//   }
//
// EFFECTS VOCABULARY (all optional; the story-state ones are applied inside
// StorySystem, the world-facing ones go out through the hooks the scene
// passes to commitChoice so they also fire exactly once):
//   story-state:  status, ending, flags:{}, items:{ key: true|false|n },
//                 relationship:±n (0–100 clamp), following:±n, nerve:±n,
//                 startStory:'country' (activates another arc), endStory:'hiphop'
//   world-facing: cash:±n, unlockGenre:'country', contact:{ id, name },
//                 wanted:n, passenger:{ id, name } | null, radioGrant:'hiphop_phonk' | null
//
// PHASE 1 (2026-09-06): schema + shells only.  Each story carries its entry
// metadata and a single opening node so the state machine, ledger and tests
// have something real to walk.  The full trees land in Phases 3–5 and the
// authored copy in Ch. 18.6–18.8 is the source of truth for them.

export const STORY_DEFS_VERSION = 1;

/** Genre a story unlocks on success — the SAME permanent ownership a $25k
 *  dealership buy grants (owner 2026-09-06), written via the genre bridge. */
export const STORY_GENRE = {
  hiphop:      'hiphop_phonk',
  country:     'country',
  classicRock: 'classic_rock',
};

export const STORY_IDS = Object.keys(STORY_GENRE);

export const FEATURED_STORIES = {
  // ── A — Hip-Hop: Malik's Phone (Ch. 18.6) ─────────────────────────────
  hiphop: {
    id: 'hiphop', version: 1,
    title: "Malik's Phone",
    genre: STORY_GENRE.hiphop,
    // Where the arc can be picked up from scratch.  Country has no entry of
    // its own: it forks off this story at Mercer Island.
    entry: { stopId: 'S' },
    startNode: 'seattle_offer',
    nodes: {
      seattle_offer: {
        stopId: 'S', mandatory: true,
        speaker: 'Malik Reed', portrait: 'biz_parkride',
        importance: 'choice',
        line: "Yo — you headed east? My girl Brittney's working the Gas-N-Sip on Mercer Island. Run her my phone. The album's on it and I ain't trusting the mail.",
        choices: [
          {
            id: 'carry', consequential: true, next: 'mercer_fork',
            label: "I'm going right past Mercer. Give me the phone.",
            reply: "Album's on the phone. As long as you're carrying it, you can play Hip-Hop on the radio. Just don't skip the stop—this thing locks itself when it thinks somebody ran off with it.",
            effects: { items: { phone: true }, flags: { carrying: true }, radioGrant: 'hiphop_phonk' },
          },
          {
            id: 'pass', consequential: false, next: null,
            label: "I don't carry other people's problems. Good luck with the album.",
            reply: "Aight. Somebody else'll want the plug.",
            effects: {},
          },
        ],
      },
      // Stub — the Mercer Island fork (the ONLY early-story fork, must resolve
      // before Bellevue) is authored in Phase 3.
      mercer_fork: {
        stopId: 'M', mandatory: true, stub: true,
        speaker: 'Brittney', portrait: 'biz_gasnsip',
        importance: 'major',
        line: "[Phase 3] Brittney at the Gas-N-Sip.",
        choices: [],
      },
    },
  },

  // ── B — Country: StageWagon or Bust (Ch. 18.7) ────────────────────────
  country: {
    id: 'country', version: 1,
    title: 'StageWagon or Bust',
    genre: STORY_GENRE.country,
    // Started by the hiphop `mercer_fork` Country choice (effects.startStory),
    // never from a stop of its own.
    entry: null,
    startNode: 'ride_begins',
    nodes: {
      ride_begins: {
        stopId: 'M', mandatory: false, stub: true,
        speaker: 'Brittney', portrait: 'biz_gasnsip',
        importance: 'major',
        line: "[Phase 4] Brittney changes into road clothes in the first road panel.",
        choices: [],
      },
    },
  },

  // ── C — Classic Rock: ImprompTour (Ch. 18.8) ──────────────────────────
  classicRock: {
    id: 'classicRock', version: 1,
    title: 'ImprompTour',
    genre: STORY_GENRE.classicRock,
    entry: { stopId: 'V' },
    startNode: 'vantage_diner',
    nodes: {
      vantage_diner: {
        stopId: 'V', mandatory: true, stub: true,
        speaker: 'Diner Waitress', portrait: 'diner_waitress',
        importance: 'choice',
        line: "My nan was going to take me to Othello, but she forgot again. Last time she remembered her car but forgot which granddaughter to grab.",
        choices: [],
      },
    },
  },
};

// ── Lookups ─────────────────────────────────────────────────────────────

export function getStory(storyId) {
  return FEATURED_STORIES[storyId] ?? null;
}

export function getStoryNode(storyId, nodeId) {
  return FEATURED_STORIES[storyId]?.nodes?.[nodeId] ?? null;
}

export function getStoryChoice(storyId, nodeId, choiceId) {
  const node = getStoryNode(storyId, nodeId);
  return node?.choices?.find(c => c.id === choiceId) ?? null;
}

// ── Stable dialogue keys ────────────────────────────────────────────────

export function lineKey(storyId, nodeId)             { return `${storyId}.${nodeId}.line`; }
export function labelKey(storyId, nodeId, choiceId)  { return `${storyId}.${nodeId}.${choiceId}.label`; }
export function replyKey(storyId, nodeId, choiceId)  { return `${storyId}.${nodeId}.${choiceId}.reply`; }

/** Flat key → current copy, built once from the trees.  The comic renders by
 *  looking the key up here first and only falls back to its saved text when
 *  the key no longer exists (18.2). */
export const DIALOGUE_INDEX = (() => {
  const out = {};
  for (const s of Object.values(FEATURED_STORIES)) {
    for (const [nid, node] of Object.entries(s.nodes ?? {})) {
      if (typeof node.line === 'string') out[lineKey(s.id, nid)] = node.line;
      for (const c of node.choices ?? []) {
        if (typeof c.label === 'string') out[labelKey(s.id, nid, c.id)] = c.label;
        if (typeof c.reply === 'string') out[replyKey(s.id, nid, c.id)] = c.reply;
      }
    }
  }
  return out;
})();

/** Current copy for `key`, else the text the comic saved with it. */
export function resolveDialogue(key, fallbackText = '') {
  const cur = DIALOGUE_INDEX[key];
  return typeof cur === 'string' ? cur : (fallbackText ?? '');
}

// ── Authoring validation (tests + dev) ──────────────────────────────────

/** Structural problems in the trees: missing start nodes, dangling `next`,
 *  duplicate choice ids, non-stub nodes with no choices.  Empty = valid. */
export function validateStories(defs = FEATURED_STORIES) {
  const errs = [];
  for (const [sid, s] of Object.entries(defs)) {
    if (s.id !== sid) errs.push(`${sid}: id mismatch (${s.id})`);
    if (!s.nodes?.[s.startNode]) errs.push(`${sid}: startNode '${s.startNode}' missing`);
    if (!STORY_GENRE[sid]) errs.push(`${sid}: no genre mapping`);
    for (const [nid, node] of Object.entries(s.nodes ?? {})) {
      if (typeof node.stopId !== 'string' || !node.stopId) errs.push(`${sid}.${nid}: no stopId`);
      if (typeof node.line !== 'string') errs.push(`${sid}.${nid}: no line`);
      const choices = node.choices ?? [];
      if (!node.stub && choices.length === 0) errs.push(`${sid}.${nid}: no choices and not a stub`);
      const seen = new Set();
      for (const c of choices) {
        if (!c.id) { errs.push(`${sid}.${nid}: choice without id`); continue; }
        if (seen.has(c.id)) errs.push(`${sid}.${nid}.${c.id}: duplicate choice id`);
        seen.add(c.id);
        if (typeof c.label !== 'string' || !c.label) errs.push(`${sid}.${nid}.${c.id}: no label`);
        if (/^(accept|decline|yes|no|ok)$/i.test((c.label ?? '').trim())) errs.push(`${sid}.${nid}.${c.id}: abstract label`);
        if (c.next != null && !s.nodes[c.next]) errs.push(`${sid}.${nid}.${c.id}: next '${c.next}' missing`);
        if (c.effects?.startStory && !defs[c.effects.startStory]) errs.push(`${sid}.${nid}.${c.id}: startStory '${c.effects.startStory}' unknown`);
      }
    }
  }
  return errs;
}
