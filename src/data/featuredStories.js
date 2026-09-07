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

// ── Country tunables (Ch. 18.7, owner 2026-09-06) ──────────────────────
export const NERVE_MAX          = 25;
export const NERVE_REST_REFILL  = 5;
export const NERVE_THRESHOLDS   = [20, 15, 10, 5];
export const KIDNAP_WARN_MI     = 1.0;    // "I'm calling the cops"
export const KIDNAP_REPORT_MI   = 1.5;    // five stars
export const ROADSIDE_STOP_SEC  = 1.5;    // stopped on the shoulder at 0 Nerve → she's out
export const GOOD_MOVE_EVERY    = 5;      // flirt every ~5th clean pass
export const LINE_COOLDOWN_MI   = 0.25;   // she doesn't narrate every move
export const COUNTRY_PAY_STANDARD = 1500;
export const COUNTRY_PAY_RIDE_EM  = 2500;
export const RIDE_EM_REL        = 80;     // raw 0–100 (four stars)
export const RIDE_EM_NERVE      = 10;
export const RIDE_EM_PASSES     = 5;
export const STANDARD_REL       = 40;
export const NEED_ROTATION      = ['hunger', 'bathroom', 'thirst'];
export const NEED_STOPS         = ['B', 'I', 'SQ', 'N', 'SP', 'EA', 'C', 'TH', 'E'];   // between Mercer and Vantage
export const NERVE_LINES = {
  20: "Okay. Okay. That was closer than I dress for.",
  15: "You know I have to be alive to see this concert, right?",
  10: "I'm holding the door handle now. That's where we are.",
  5:  "One more like that and I'm walking to Vantage.",
};
export const FLIRT_LINES = [
  "Keep threading gaps like that and you're gonna make me spill more than my drink.",
  "If you can keep the car riding that smooth, I might have another smooth ride for you.",
];
/** Continuous scrapes don't cost Nerve — impacts do (18.7 "collision HP"). */
export function isScrapeSource(source = '') {
  return source.startsWith('offroad') || source.endsWith('_rail') || source === 'water_shoulder' || source === 'tunnel_wall';
}
/** Vantage ending from raw relationship, Nerve at arrival, clean passes. */
export function countryOutcome(st, run) {
  const rel = st.relationship ?? 0, nerve = run.nerve ?? 0, passes = run.flags?.cleanPasses ?? 0;
  if (rel >= RIDE_EM_REL && nerve >= RIDE_EM_NERVE && passes >= RIDE_EM_PASSES) return 'ride_em';
  if (rel >= STANDARD_REL) return 'standard';
  return 'barely';
}

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

      // ── Bellevue off-ramp — the TraffApp founder flags you down ────────
      // Mandatory on arrival (owner 2026-09-06: "approaches you immediately
      // upon exit of the freeway"); panel art = the Bellevue exterior photo.
      bellevue_founder: {
        stopId: 'B', mandatory: true,
        when: (st) => has(st, 'phone') && !has(st, 'phoneLocked') && st.flags.mercerDone,
        speaker: 'Startup Founder', portrait: 'biz_founder',
        importance: 'choice',
        line: "Hey — HEY. Off the ramp, pull in a second. That's Malik Reed's phone, isn't it? I'd know that cracked screen anywhere; his stuff is all over NoiseCloud. I run TraffApp. We're training a music model and we need real vocals. A thousand dollars, cash, right now, and the phone rides with me.",
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
  //
  // Brittney boards at Mercer (hiphop.mercer_fork.ride → startStory).  Nerve
  // is RUN state (25, refilled 5 per rest stop, never on the road), debited
  // 1:1 by impact HP; relationship is canon (0–100, five stars, start 50).
  // Needs rotate hunger → bathroom → thirst, one per rest stop, as REPEATABLE
  // mandatory nodes (a "wait" leaves the need pending for the next stop).
  country: {
    id: 'country', version: 2,
    title: 'StageWagon or Bust',
    genre: STORY_GENRE.country,
    entry: null,                    // started by hiphop.mercer_fork.ride
    startNode: 'vantage_arrival',
    startRelationship: 50,
    endings: {
      ride_em:       { label: "RIDE 'EM",          unlock: true },
      standard:      { label: 'STAGEWAGON OR BUST', unlock: true },
      barely:        { label: 'BARELY MADE IT',    unlock: true },
      roadside_exit: { label: 'ROADSIDE EXIT',     unlock: false },
      kidnapping:    { label: 'KIDNAPPING REPORT', unlock: false },
    },
    // She is in the seat for as long as the story is active.
    deriveRun: (st, run) => { run.passenger = { id: 'brittney', name: 'Brittney', storyId: 'country' }; run.nerve = Math.max(0, Math.min(NERVE_MAX, run.nerve ?? NERVE_MAX)); },
    onRestStop: (stopId, api) => {
      const { run, state: st } = api;
      run.nerve = Math.min(NERVE_MAX, (run.nerve ?? NERVE_MAX) + NERVE_REST_REFILL);
      if (stopId === 'V' || stopId === 'M') return;
      if (!st.flags.pendingNeed) {
        const n = st.flags.needCount ?? 0;
        api.flags({ pendingNeed: NEED_ROTATION[n % NEED_ROTATION.length], needCount: n + 1 });
      }
    },
    onRoad: (type, ev, api) => {
      const { run, state: st } = api;
      if (!run.passenger) return;
      const mile = ev.mile ?? 0;
      const canTalk = () => (mile - (run.flags.lastLineMile ?? -9)) >= LINE_COOLDOWN_MI;
      const talk = (text) => { run.flags.lastLineMile = mile; api.say(text); };
      if (type === 'tick') {
        if (!st.flags.changed) {
          api.flags({ changed: true });
          api.beat({ beatId: 'changes', importance: 'consequence', speaker: 'Brittney', portrait: 'biz_gasnsip',
                     text: 'She kicks off the work shoes, wriggles out of the Gas-N-Sip polo and into road clothes right there in the passenger seat. "Eyes on the road, cowboy."' });
        }
        const n0 = run.flags.nerve0Mile;
        if (n0 != null) {
          if (!run.flags.copsWarned && mile - n0 >= KIDNAP_WARN_MI) { run.flags.copsWarned = true; talk("If you don't stop, I'm calling the cops."); }
          if (mile - n0 >= KIDNAP_REPORT_MI) {
            api.wanted(5);
            api.beat({ beatId: 'kidnap', importance: 'climax', speaker: 'Brittney', portrait: 'biz_gasnsip',
                       text: '"911? Yeah. I\'m in a car and the driver won\'t let me out." Five stars light up the mirror. StageWagon was never the point.' });
            api.fail('kidnapping');
            api.passenger(null);
            return;
          }
          // Roadside drop: stopped on the shoulder with her at 0 Nerve.
          if (ev.stopped && ev.onShoulder) {
            run.flags.shoulderSec = (run.flags.shoulderSec ?? 0) + (ev.dt ?? 0);
            if (run.flags.shoulderSec >= ROADSIDE_STOP_SEC) {
              api.beat({ beatId: 'roadside_exit', importance: 'ending', speaker: 'Brittney', portrait: 'biz_gasnsip',
                         text: 'She\'s out before the car fully stops, boots on gravel, thumb already up for the next truck. "Have a nice life, cowboy."' });
              api.fail('roadside_exit');
              api.passenger(null);
              return;
            }
          } else run.flags.shoulderSec = 0;
        }
        return;
      }
      if (type === 'damage') {
        const hp = Math.max(0, ev.hp ?? 0);
        if (!hp || isScrapeSource(ev.source)) return;
        const before = run.nerve ?? NERVE_MAX;
        run.nerve = Math.max(0, before - hp);
        run.flags.nerveFlashAt = mile;
        // 0 Nerve wins over every other line; then any 5+ HP accident speaks
        // immediately (two authored flavours); then threshold crossings.
        if (run.nerve === 0 && before > 0) { run.flags.nerve0Mile = mile; talk("Pull over. Now. I'm getting out."); return; }
        if (hp >= 5) {
          talk(/side|corner|swipe/i.test(ev.source ?? '') ? "Easy, cowboy. I said I liked it rough—not attached to another car."
                                                             : "You saved it. Good. I was halfway between screaming and being impressed.");
        } else {
          for (const t of NERVE_THRESHOLDS) if (before > t && run.nerve <= t && t > 0 && canTalk()) { talk(NERVE_LINES[t]); break; }
        }
        return;
      }
      if (type === 'pass') {
        run.flags.cleanPasses = (run.flags.cleanPasses ?? 0) + 1;
        if (run.flags.cleanPasses % GOOD_MOVE_EVERY === 0 && canTalk() && (run.nerve ?? 0) > 0) {
          const i = (run.flags.flirtIdx ?? 0); run.flags.flirtIdx = i + 1;
          talk(FLIRT_LINES[i % FLIRT_LINES.length]);
          api.relationship(+2);
        }
      }
    },
    nodes: {
      // ── Needs (repeatable, one per rest stop while pending) ────────────
      need_hunger: {
        stopId: null, repeatable: true, stops: NEED_STOPS, mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.pendingNeed === 'hunger',
        speaker: 'Brittney', portrait: 'biz_gasnsip', importance: 'choice',
        line: "🍆 I'm starving. I don't swallow much meat these days, but I'm always down for fish tacos.",
        choices: [
          { id: 'sushi', consequential: true, next: null, cost: 14,
            label: "Are you talking about food or…? I think I can find sushi.",
            reply: "Both, obviously. And look at you, finding the one decent roll east of the lake.",
            effects: { flags: { pendingNeed: null }, relationship: 10 } },
          { id: 'burrito', consequential: true, next: null, cost: 9,
            label: "This place has great pork burritos. I'll get you one.",
            reply: "…Pork. Sure. It's food. She eats half of it staring out the window.",
            effects: { flags: { pendingNeed: null }, relationship: -5 } },
          { id: 'wait', consequential: true, next: null,
            label: "You'll survive until a rest stop with better food.",
            reply: "I'll survive. I'll remember, too.",
            effects: { relationship: -5 } },
        ],
      },
      need_bathroom: {
        stopId: null, repeatable: true, stops: NEED_STOPS, mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.pendingNeed === 'bathroom',
        speaker: 'Brittney', portrait: 'biz_gasnsip', importance: 'choice',
        line: "🚻 I need a bathroom. A real one — I am not squatting behind a Les Schwasted.",
        choices: [
          { id: 'hold', consequential: true, next: null,
            label: "You can hold it another few miles, right?",
            reply: "There are two ways to make me wet, and pissing myself is my second favorite.",
            effects: {} },
          { id: 'waitInCar', consequential: true, next: null,
            label: "I'll wait in the car while you release your demons.",
            reply: "She gives you a long, blank stare, then goes.",
            effects: { flags: { pendingNeed: null }, relationship: -2 } },
          { id: 'goWith', consequential: true, next: null,
            label: "Do you want to play swords?",
            reply: "She laughs so hard the clerk looks up. \"Come on, then.\"",
            effects: { flags: { pendingNeed: null }, relationship: 10 } },
        ],
      },
      need_thirst: {
        stopId: null, repeatable: true, stops: NEED_STOPS, mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.pendingNeed === 'thirst',
        speaker: 'Brittney', portrait: 'biz_gasnsip', importance: 'choice',
        line: "💧 I'm parched. Something cold before we get back on that road?",
        choices: [
          { id: 'slushie', consequential: true, next: null, cost: 4,
            label: "Can I get you a slushie?",
            reply: "I was hoping to chug something salty, but sweet works just as well.",
            effects: { flags: { pendingNeed: null }, relationship: 5 } },
          { id: 'fountain', consequential: true, next: null,
            label: "Find a fountain or something. I don't have drinking money.",
            reply: "She blank-stares. \"What a gentleman.\"",
            effects: { flags: { pendingNeed: null }, relationship: -8 } },
        ],
      },

      // ── Vantage — her friends, her exit, the ending ─────────────────────
      vantage_arrival: {
        stopId: 'V', mandatory: true,
        when: (st, run) => !!run.passenger,
        speaker: 'Brittney', portrait: 'biz_gasnsip', importance: 'ending',
        line: (st, run) => "Those are my babes! I'm gonna go jump in with them. I wish you were coming with us. We would run you dry."
          + (countryOutcome(st, run) === 'ride_em' ? " Text me on your way back. I'd love to see you again." : ''),
        choices: [
          { id: 'sendOff', consequential: true, next: null,
            label: "Go on. Text me when you're back in Seattle.",
            reply: (st, run) => {
              const o = countryOutcome(st, run);
              return o === 'ride_em' ? "She kisses you like she means it, then she's gone into the crowd. Your phone buzzes: a new contact." :
                     o === 'standard' ? "A hug, a wink, and she's running for the gas-station door." :
                                        "A quick hug. She doesn't look back.";
            },
            effects: (st, run) => {
              const o = countryOutcome(st, run);
              const fx = { flags: { outcome: o, left: true }, passenger: null, ending: o, unlockGenre: STORY_GENRE.country };
              if (o === 'ride_em') { fx.cash = COUNTRY_PAY_RIDE_EM; fx.contact = { id: 'brittney', name: 'Brittney' }; }
              else if (o === 'standard') fx.cash = COUNTRY_PAY_STANDARD;
              return fx;
            } },
        ],
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
      if (node.repeatable) { if (node.stops !== '*' && !(Array.isArray(node.stops) && node.stops.length)) errs.push(`${sid}.${nid}: repeatable node needs stops`); }
      else if (typeof node.stopId !== 'string' || !node.stopId) errs.push(`${sid}.${nid}: no stopId`);
      if (!isText(node.line)) errs.push(`${sid}.${nid}: no line`);
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
