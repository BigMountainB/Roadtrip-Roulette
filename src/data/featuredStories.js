// ── Featured genre stories — data-driven story definitions (Ch. 18) ─────────
//
// Three authored arcs ride ON TOP of the ordinary mission system, never in
// it: Hip-Hop "Malik's Phone" (A), Country "StageWagon or Bust" (B) and
// Classic Rock "ImprompTour" (C).  StorySystem walks these trees; the scenes
// only render whatever node StorySystem says is open.  Nothing in here is
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
//     stopId:      'M',            // rest stop where this node fires
//     mandatory:   true,           // runs BEFORE storefronts / ordinary NPCs (18.5)
//     business:    'traffapp',     // optional: hosted on a story-only placard instead
//     when:        (state, run) => bool,   // gate on flags / items / run state
//     virtual:     true,           // never listed at the stop (ending-screen recoveries)
//     speaker:     'Brittney',     // display name in the balloon
//     portrait:    'biz_gasnsip',  // npcPortraits key (panel art comes in Phase 8)
//     line:        '…' | (state, run) => '…',   // NPC copy (no baked dialogue in art)
//     importance:  'choice',       // comic event tag (18.3) — minor|choice|consequence|major|climax|ending|meanwhile
//     choices:     [ …choice ],
//   }
//
// CHOICE SHAPE
//   {
//     id:            'keepJob',    // stable within the node
//     label:         '…',          // the player's SPOKEN line (never Accept/Decline)
//     reply:         '…' | fn,     // NPC reaction shown before the tile slides away
//     when:          (state, run) => bool,  // optional: hide when false
//     consequential: true,         // false = casual exposition: same UI, NO ledger entry / panel
//     next:          'nodeId' | null,
//     cost:          0,            // $ debited on commit (disabled when unaffordable)
//     effects:       {…} | (state, run) => ({…}),   // applied EXACTLY ONCE by StorySystem.commitChoice
//   }
//
// EFFECTS VOCABULARY (story-state ones apply inside StorySystem; world-facing
// ones go out through the hooks the scene passes to commitChoice, exactly
// once):
//   story-state:  status, ending, flags:{}, items:{ key: value|false },
//                 relationship:±n (0–100 clamp), following:±n, nerve:±n,
//                 cargo:{ records:n … }, startStory:'country', endStory:'hiphop',
//                 resetStory:'hiphop' (back to not-started, attempt+1)
//   world-facing: cash:±n, unlockGenre:'country', contact:{ id, name },
//                 wanted:n, passenger:{ id, name, storyId } | null,
//                 radioGrant:'hiphop_phonk' | null, leaveStop:true (close the stop)
//
// STORY-LEVEL HOOKS (all optional, all pure data-driven):
//   businesses:  { key: { name, accent, cat } }   story-only storefront placards
//   onPass:      { [stopId]: (api) => bool }      player drove PAST that exit
//   onDamage:    (state, run, hp) => void          cargo rules per HP lost
//   deriveRun:   (state, run) => void              project canon items onto a fresh run
//   syncCargo:   (state, run) => bool              run cargo → canon at save points
//   ambush:      { mile, when(state, run), cars }  hostile-car trigger (GameScene)
//   endings:     { endingId: { label, unlock } }
//
// Copy in 18.6–18.8 is the source of truth; everything quoted there is used
// verbatim.  Connecting lines are ours.

export const STORY_DEFS_VERSION = 2;

/** Genre a story unlocks on success — the SAME permanent ownership a $25k
 *  dealership buy grants (owner 2026-09-06), written via the genre bridge. */
export const STORY_GENRE = {
  hiphop:      'hiphop_phonk',
  country:     'country',
  classicRock: 'classic_rock',
};

export const STORY_IDS = Object.keys(STORY_GENRE);

// ── Hip-Hop tunables (Ch. 18.6, owner 2026-09-06) ──────────────────────
export const VINYL_RECORDS      = 100;    // pressed at Snoqualmie Pass
export const VINYL_PAY_PRISTINE = 2500;   // full delivery; scales linearly per record
export const RECORDS_PER_HP     = 2;      // every HP of damage destroys two records…
export const PAYOUT_PCT_PER_HP  = 2;      // …and docks 2% of the payout (cap 100%)
export const FOUNDER_OFFER      = 1000;   // TraffApp's price for the phone
export const ISSAQUAH_EXIT_MILE = 18;     // REST_STOPS 'I'
export const ISSAQUAH_WARP_MILE = ISSAQUAH_EXIT_MILE - 0.5;   // recovery warp
export const VANTAGE_AMBUSH_MILE = 135.5; // 1.5 mi short of the Vantage exit (137)

const has = (st, k) => !!st.items?.[k];

/** Surviving records → outcome bucket (Cle Elum, 18.6). */
export function vinylOutcome(records) {
  const n = Math.max(0, Math.floor(records ?? 0));
  if (n >= VINYL_RECORDS) return 'pristine';
  if (n >= 50)            return 'damaged';
  if (n >= 2)             return 'almost_empty';
  if (n === 1)            return 'one_record';
  return 'zero';
}

/** Payout for n surviving records: linear, and additionally docked 2% per
 *  HP lost (both authored rules apply; the HP dock is capped at 100%). */
export function vinylPayout(records, hpLost = 0) {
  const n = Math.max(0, Math.min(VINYL_RECORDS, Math.floor(records ?? 0)));
  if (n <= 0) return 0;
  const linear = VINYL_PAY_PRISTINE * (n / VINYL_RECORDS);
  const dock   = Math.max(0, 1 - (PAYOUT_PCT_PER_HP * Math.max(0, hpLost)) / 100);
  return Math.round(linear * dock);
}

export const FEATURED_STORIES = {
  // ══ A — Hip-Hop: Malik's Phone (Ch. 18.6) ═══════════════════════════════
  hiphop: {
    id: 'hiphop', version: 2,
    title: "Malik's Phone",
    genre: STORY_GENRE.hiphop,
    entry: { stopId: 'S' },
    startNode: 'seattle_offer',
    businesses: {
      traffapp: { name: 'TraffApp', cat: 'TRAFFIC APP', accent: 0x4AC3B0 },
      vinyl:    { name: 'Spin Cycle Records', cat: 'RECORD STORE', accent: 0xA855F7 },
    },
    endings: {
      sold_out:      { label: 'COMPLETE! SORT OF…', unlock: false },
      pristine:      { label: 'PRISTINE DROP',      unlock: true },
      damaged:       { label: 'ROUGH DELIVERY',     unlock: true },
      almost_empty:  { label: 'ALMOST EMPTY CRATE', unlock: true },
      one_record:    { label: 'ONE RECORD LEFT',    unlock: true },
      zero:          { label: 'NOTHING TO SELL',    unlock: false },
      vantage_dead:  { label: "MALIK'S REGARDS",    unlock: false },
    },
    // A fresh run still carries whatever the plate says: the phone keeps
    // granting Hip-Hop until Issaquah; pressed records ride at their last
    // synced count.
    deriveRun: (st, run) => {
      if (has(st, 'phone') && !has(st, 'phoneLocked')) run.radioGrant = STORY_GENRE.hiphop;
      if (typeof st.items.records === 'number' && run.cargo.records == null) {
        run.cargo.records = st.items.records; run.cargo.recordsMax = VINYL_RECORDS;
        run.cargo.hpLost = typeof st.items.recordsHpLost === 'number' ? st.items.recordsHpLost : 0;
      }
    },
    // Every point of vehicle HP damage destroys two records (18.6).  Tracked
    // fractionally so scrapes add up exactly; never below zero.
    onDamage: (st, run, hp) => {
      if (run.cargo.records == null) return;
      run.cargo.hpLost = (run.cargo.hpLost ?? 0) + hp;
      run.cargo.records = Math.max(0, VINYL_RECORDS - Math.floor(run.cargo.hpLost * RECORDS_PER_HP));
    },
    syncCargo: (st, run) => {
      if (run.cargo.records == null) return false;
      if (st.items.records === run.cargo.records && st.items.recordsHpLost === run.cargo.hpLost) return false;
      st.items.records = run.cargo.records;
      st.items.recordsHpLost = run.cargo.hpLost ?? 0;   // the 2%/HP dock follows the crate
      return true;
    },
    onPass: {
      // Skipped Mercer: the phone stays live, Country is off the table for
      // this trip, Malik redirects you to Kyle and his trust drops.
      M: (api) => {
        const st = api.state;
        if (!has(st, 'phone') || has(st, 'phoneLocked') || st.flags.mercerDone || st.flags.skippedMercer) return false;
        api.flags({ skippedMercer: true, mercerDone: true, path: 'hiphop' });
        api.relationship(-15);
        api.text('malik', 'Malik Reed', "Yo, you blew right past Brittney?? Fine. Take it STRAIGHT to my boy Kyle at the Issaquah Park & Ride. Don't make me regret handing you my album.");
        return true;
      },
      // Passed Issaquah with the phone: it locks itself, the radio goes
      // dark, and Malik is done being polite.
      I: (api) => {
        const st = api.state;
        if (!has(st, 'phone') || has(st, 'phoneLocked')) return false;
        api.items({ phoneLocked: true });
        api.flags({ passedIssaquah: true });
        api.relationship(-30);
        api.radioGrant(null);
        api.text('malik', 'Malik Reed', "You PASSED Issaquah?? That phone just locked itself. One job. You had ONE job, and you're driving away from it. Turn around — or don't bother coming anywhere near Vantage.");
        return true;
      },
    },
    // Still carrying the locked phone into Vantage: three cars, no crew in
    // sight, rammed until dead (18.6 "Vantage punishment").
    ambush: {
      mile: VANTAGE_AMBUSH_MILE, cars: 3,
      when: (st) => has(st, 'phone') && has(st, 'phoneLocked'),
      tip: 'When Malik tells you to make the drop, make the drop.',
      headline: "MALIK'S REGARDS",
    },
    nodes: {
      // ── Seattle / Park & Ride ──────────────────────────────────────────
      seattle_offer: {
        stopId: 'S', mandatory: true,
        speaker: 'Malik Reed', portrait: 'biz_parkride',
        importance: 'major',
        line: "Yo — you headed east? My girl Brittney's working the Gas-N-Sip on Mercer Island. Run her my phone. The album's on it and I ain't trusting the mail.",
        choices: [
          {
            id: 'carry', consequential: true, next: null,
            label: "I'm going right past Mercer. Give me the phone.",
            reply: "Album's on the phone. As long as you're carrying it, you can play Hip-Hop on the radio. Just don't skip the stop—this thing locks itself when it thinks somebody ran off with it.",
            effects: { items: { phone: true }, flags: { carrying: true }, relationship: 50, radioGrant: STORY_GENRE.hiphop },
          },
          {
            id: 'pass', consequential: false, next: null,
            label: "I don't carry other people's problems. Good luck with the album.",
            reply: "Aight. Somebody else'll want the plug.",
            effects: {},
          },
        ],
      },

      // ── Mercer Island / Gas-N-Sip — the only early fork ────────────────
      mercer_fork: {
        stopId: 'M', mandatory: true,
        when: (st) => has(st, 'phone') && !has(st, 'phoneLocked') && !st.flags.mercerDone,
        speaker: 'Brittney', portrait: 'biz_gasnsip',
        importance: 'climax',
        line: "Malik sent you? Of course he did. They just put me on a double, and I was supposed to run that phone out to his engineer in Issaquah myself. So either I lose this job or he loses his album.",
        choices: [
          {
            id: 'keepJob', consequential: true, next: null,
            label: "You should keep your job. I'll deliver the phone like I promised.",
            reply: "You right. I'm done doing him favors anyway. You definitely missed out on a fun copilot to keep you awake. 😘",
            effects: { flags: { mercerDone: true, path: 'hiphop' }, relationship: 10 },
          },
          {
            id: 'ride', consequential: true, next: null,
            label: "You don't need this job or that boyfriend. I'll give you a ride to the concert.",
            reply: "My boyfriend can lick someone else's butt. Take me to StageWagon, babe!",
            // The phone stays on the counter: temp radio ends, Brittney is in
            // the car (Country, Phase 4), and Hip-Hop goes back on the shelf
            // for a later run.
            effects: {
              items: { phone: false }, flags: { mercerDone: true, path: 'country', phoneLeft: true },
              radioGrant: null, startStory: 'country',
              passenger: { id: 'brittney', name: 'Brittney', storyId: 'country' },
              resetStory: 'hiphop',
            },
          },
        ],
      },

      // ── Bellevue / TraffApp — the sellout offer (placard-hosted) ───────
      bellevue_founder: {
        stopId: 'B', mandatory: false, business: 'traffapp',
        when: (st) => has(st, 'phone') && !has(st, 'phoneLocked') && st.flags.mercerDone,
        speaker: 'Startup Founder', portrait: 'biz_founder',
        importance: 'choice',
        line: "Hold on — that's Malik Reed's phone. I'd know that cracked screen anywhere; his stuff is all over NoiseCloud. TraffApp is training a music model and we need real vocals. A thousand dollars, cash, right now, and the phone walks out with me.",
        choices: [
          {
            id: 'sell', consequential: true, next: null,
            label: "A thousand dollars for a phone that isn't mine? Deal.",
            reply: "Pleasure doing business. By the time the imitation drops, nobody will know which of us to blame.",
            effects: { cash: FOUNDER_OFFER, items: { phone: false }, flags: { soldPhone: true }, radioGrant: null, ending: 'sold_out', status: 'complete' },
          },
          {
            id: 'refuse', consequential: true, next: null,
            label: "It's not for sale. Some things you carry because you said you would.",
            reply: "Suit yourself. The offer stands until you leave the lot — after that it's a lawsuit, not a purchase.",
            effects: { flags: { refusedFounder: true }, relationship: 5 },
          },
        ],
      },

      // ── Issaquah / Park & Ride — Kyle ───────────────────────────────────
      issaquah_kyle: {
        stopId: 'I', mandatory: true,
        when: (st) => has(st, 'phone') && !has(st, 'phoneLocked'),
        speaker: 'Kyle', portrait: 'biz_parkride',
        importance: 'major',
        line: "Oh — you're the one Malik texted about. Sorry, I don't really… do people. Give me ten minutes with the phone. I'll back it up, remaster the vocals, and put the master on a drive you can actually trust.",
        choices: [
          {
            id: 'handOver', consequential: true, next: null,
            label: "Take your ten minutes. I'll wait right here.",
            reply: "Done. The phone stays with me — Malik wants it back. That drive IS the album now. Guard it like it owes you money.",
            effects: { items: { phone: false, thumbdrive: true }, flags: { delivered: true }, relationship: 15, radioGrant: null },
          },
        ],
      },

      // ── North Bend — Dom'nique claims the beat ─────────────────────────
      northbend_dom: {
        stopId: 'N', mandatory: true,
        when: (st) => has(st, 'thumbdrive') && !st.flags.domDone,
        speaker: "Dom'nique", portrait: 'biz_parkride',
        importance: 'climax',
        line: "That rap song I heard you bumping—that's my beat! Did you get that from Malik Reed? We need to talk… He holds up his phone: the NoiseCloud original, #1, his name on it, the same beat note for note.",
        choices: [
          {
            id: 'promise', consequential: true, next: null,
            label: "That's the same beat. I'll make sure you get credit.",
            reply: "That's all I'm asking. Keep that word and North Bend's got your back the whole way east.",
            effects: { flags: { credit: 'promised', domDone: true }, relationship: 5 },
          },
          {
            id: 'delay', consequential: true, next: null,
            label: "I believe you, but I'm not promising anything until I reach the presser.",
            reply: "Fair. But I'll be listening for my name on that record.",
            effects: { flags: { credit: 'delayed', domDone: true } },
          },
          {
            id: 'bagman', consequential: true, next: null,
            label: "Malik and Stank can settle this after I finish the delivery.",
            reply: "Piss off, then. If I catch you in North Bend again, it better be for your funeral.",
            effects: { flags: { credit: 'refused', domDone: true, ejectedNorthBend: true }, relationship: -10, leaveStop: true },
          },
        ],
      },

      // ── Snoqualmie Pass / AOK Camp — Tennessee presses the vinyl ───────
      pass_tennessee: {
        stopId: 'SP', mandatory: true,
        when: (st) => has(st, 'thumbdrive') && st.items.records == null,
        speaker: 'Tennessee', portrait: 'biz_aok',
        importance: 'major',
        line: "Well, look what the pass dragged in. Hand me that stick — I press vinyl out the back of the camp office, none of that streaming nonsense. A hundred records, and the name on the label is whatever you tell me it is.",
        choices: [
          {
            id: 'creditDom', consequential: true, next: null,
            when: (st) => st.flags.credit === 'promised' || st.flags.credit === 'delayed',
            label: "Put Dom'nique on the label as producer. It's his beat.",
            reply: "Producer credit it is. Hundred records, hot off the press — every pothole between here and Cle Elum costs you two of 'em. Drive like they're eggs.",
            effects: { items: { thumbdrive: false, records: VINYL_RECORDS }, flags: { creditOut: 'producer' }, cargo: { records: VINYL_RECORDS, recordsMax: VINYL_RECORDS, hpLost: 0 } },
          },
          {
            id: 'creditMalik', consequential: true, next: null,
            label: "Malik Reed. Just Malik.",
            reply: "Just Malik. Hundred records, hot off the press — every pothole between here and Cle Elum costs you two of 'em. Drive like they're eggs.",
            effects: { items: { thumbdrive: false, records: VINYL_RECORDS }, flags: { creditOut: 'malik' }, cargo: { records: VINYL_RECORDS, recordsMax: VINYL_RECORDS, hpLost: 0 } },
          },
          {
            id: 'creditStank', consequential: true, next: null,
            label: "Stank Records gets the credit. That's who's paying.",
            reply: "Stank it is — hope they're paying you too. Hundred records, hot off the press — every pothole between here and Cle Elum costs you two of 'em. Drive like they're eggs.",
            effects: { items: { thumbdrive: false, records: VINYL_RECORDS }, flags: { creditOut: 'stank' }, cargo: { records: VINYL_RECORDS, recordsMax: VINYL_RECORDS, hpLost: 0 } },
          },
        ],
      },

      // ── Cle Elum / Spin Cycle Records — the drop ───────────────────────
      cleelum_store: {
        stopId: 'C', mandatory: true,
        when: (st) => typeof st.items.records === 'number' && !st.flags.deliveredRecords,
        speaker: 'Spin Cycle Clerk', portrait: 'biz_gasnsip',
        importance: 'ending',
        line: (st, run) => {
          const n = Math.floor(run.cargo.records ?? st.items.records ?? 0);
          return `Spin Cycle. You're the Malik Reed drop? Let's see the crate… ${n} of a hundred. ${
            n >= VINYL_RECORDS ? "Not a scratch on 'em." :
            n >= 50 ? 'Somebody had a rough pass.' :
            n >= 2 ? 'That crate has seen things.' :
            n === 1 ? 'One. You brought me ONE.' : 'That crate is empty.'}`;
        },
        choices: [
          {
            id: 'deliver', consequential: true, next: null,
            label: "Delivery for Spin Cycle. Count 'em.",
            reply: (st, run) => {
              const n = Math.floor(run.cargo.records ?? st.items.records ?? 0);
              const o = vinylOutcome(n);
              return o === 'pristine'     ? "A hundred clean. That's the whole town's Friday. You just put Hip-Hop on every radio from here to Pullman." :
                     o === 'damaged'      ? "Half a crate's still a crate. It sells — and so does the story of how it got here." :
                     o === 'almost_empty' ? "Barely enough to fill the window display, but the song's out. That counts." :
                     o === 'one_record'   ? "One record. It'll be a collector's item by Tuesday. The song still gets out — that's the part that matters." :
                                            "Nothing to sell, nothing to spin. Malik's album died on I-90.";
            },
            effects: (st, run) => {
              const n = Math.floor(run.cargo.records ?? st.items.records ?? 0);
              const o = vinylOutcome(n);
              const pay = vinylPayout(n, run.cargo.hpLost ?? 0);
              const fx = { flags: { deliveredRecords: true, outcome: o }, items: { records: false, recordsHpLost: false }, cargo: { records: null, hpLost: null }, ending: o };
              if (pay > 0) fx.cash = pay;
              if (n >= 1) fx.unlockGenre = STORY_GENRE.hiphop; else fx.status = 'failed';
              return fx;
            },
          },
        ],
      },

      // ── Vantage recovery (ending screen, never listed at a stop) ───────
      vantage_recovery: {
        stopId: 'V', mandatory: false, virtual: true,
        speaker: 'Malik Reed', portrait: 'biz_parkride',
        importance: 'consequence',
        line: "Three cars. No crew in sight. The phone in your pocket buzzes once: 'told you.'",
        choices: [
          {
            id: 'warp', consequential: true, next: null,
            label: "I'm going back to Issaquah. Kyle gets his phone.",
            reply: "The phone unlocks the second you turn the car around.",
            effects: { items: { phoneLocked: false }, flags: { ambushed: true, ambushWarp: true } },
          },
          {
            id: 'continue', consequential: true, next: null,
            label: "Keep the phone. I'm done running Malik's errands.",
            reply: "Malik doesn't text back. He doesn't need to.",
            effects: { flags: { ambushed: true }, items: { phone: false }, radioGrant: null, ending: 'vantage_dead', status: 'dead' },
          },
        ],
      },
    },
  },

  // ══ B — Country: StageWagon or Bust (Ch. 18.7) ══════════════════════════
  country: {
    id: 'country', version: 1,
    title: 'StageWagon or Bust',
    genre: STORY_GENRE.country,
    // Started by the hiphop `mercer_fork` Country choice (effects.startStory),
    // never from a stop of its own.
    entry: null,
    startNode: 'ride_begins',
    endings: {},
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

  // ══ C — Classic Rock: ImprompTour (Ch. 18.8) ════════════════════════════
  classicRock: {
    id: 'classicRock', version: 1,
    title: 'ImprompTour',
    genre: STORY_GENRE.classicRock,
    entry: { stopId: 'V' },
    startNode: 'vantage_diner',
    endings: {},
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
 *  the key no longer exists (18.2).  Dynamic (function) lines are NOT
 *  indexed — their panels always read the copy saved at commit time. */
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
 *  duplicate choice ids, non-stub nodes with no choices, abstract labels,
 *  unknown businesses / endings.  Empty = valid. */
export function validateStories(defs = FEATURED_STORIES) {
  const errs = [];
  const isText = (v) => typeof v === 'string' || typeof v === 'function';
  for (const [sid, s] of Object.entries(defs)) {
    if (s.id !== sid) errs.push(`${sid}: id mismatch (${s.id})`);
    if (!s.nodes?.[s.startNode]) errs.push(`${sid}: startNode '${s.startNode}' missing`);
    if (!STORY_GENRE[sid]) errs.push(`${sid}: no genre mapping`);
    for (const [nid, node] of Object.entries(s.nodes ?? {})) {
      if (typeof node.stopId !== 'string' || !node.stopId) errs.push(`${sid}.${nid}: no stopId`);
      if (!isText(node.line)) errs.push(`${sid}.${nid}: no line`);
      if (node.business && !s.businesses?.[node.business]) errs.push(`${sid}.${nid}: business '${node.business}' unknown`);
      if (node.mandatory && node.business) errs.push(`${sid}.${nid}: a placard-hosted node can't be mandatory`);
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
        const fx = typeof c.effects === 'function' ? null : c.effects;
        if (fx?.startStory && !defs[fx.startStory]) errs.push(`${sid}.${nid}.${c.id}: startStory '${fx.startStory}' unknown`);
        if (fx?.resetStory && !defs[fx.resetStory]) errs.push(`${sid}.${nid}.${c.id}: resetStory '${fx.resetStory}' unknown`);
        if (typeof fx?.ending === 'string' && s.endings && !s.endings[fx.ending]) errs.push(`${sid}.${nid}.${c.id}: ending '${fx.ending}' unknown`);
      }
    }
  }
  return errs;
}
