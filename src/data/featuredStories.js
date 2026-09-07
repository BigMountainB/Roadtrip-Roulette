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
//   meanwhile:   { stripId: { title, speaker, panels:[{speaker,text}×3] } }  18.4 strips —
//                raised by a choice effect `meanwhile:'id'` or api.meanwhile('id')
//   passengerJoinStop: (state, run, canon) => stopId|null   hitchhiker gating (18.4)
//
// ATTACHED SIDE QUESTS (18.4) are ordinary optional nodes on the story
// (`mandatory: false`, run after the mandatory tiles at that stop, always with
// a plain non-consequential way out) that change a later scene, develop a
// character, or pay off as comic relief.  They use no mission or story slot.
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
export const DOM_TAPE_BONUS     = 250;    // side quest: the B-side sells too
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
// ── Classic Rock tunables (Ch. 18.8, owner 2026-09-06) ─────────────────
export const OTHELLO_COVER        = 50;
export const OTHELLO_PROPOSITION  = 50;      // "another $50 expense"
export const NAN_OFFER            = 500;
export const NAN_STAY_REL         = 60;      // ≥ 3 stars she stays when it's her call
export const SHOW2_TOTAL          = 300;     // Washtucna
export const SHOW3_SOLO           = 400;     // La Crosse
export const SHOW3_DUET           = 800;
export const SIXTY_FORTY_REL      = 75;      // she accepts 60/40 only here
export const BROKEN_VOICE_CONTROLLING = 3;
export const BROKEN_VOICE_REL     = 25;
export const TRUE_ENDING_REL      = 80;      // > 80 raw → mutual onstage kiss
export const PULLMAN_TOTAL        = 10000;   // before the Colfax split
export const PULLMAN_PAY = {
  true_ending:   PULLMAN_TOTAL / 2,          // 50/50 (a 60/40 true ending pays 6000 — see classicRockOutcome)
  equal_partner: PULLMAN_TOTAL / 2,
  marquee:       PULLMAN_TOTAL / 2,
  business_6040: PULLMAN_TOTAL * 0.6,
  hired_voice:   7500,
  broken_voice:  10000,
  solo_sellout:  5000,
};
export const FEATURED_STORIES_ENDING_UNLOCK = {
  true_ending: true, equal_partner: true, marquee: true, business_6040: true, solo_sellout: true, broken_voice: true,
  hired_voice: false, band_implosion: false,
};
export function isBrokenVoice(st) {
  return (st.flags?.controlling ?? 0) >= BROKEN_VOICE_CONTROLLING && (st.relationship ?? 0) < BROKEN_VOICE_REL;
}
/** Pullman outcome from the Colfax deal, La Crosse choice, name and raw relationship. */
export function classicRockOutcome(st) {
  const f = st.flags ?? {};
  if (f.deal === 'broken') return 'broken_voice';
  if (f.deal === 'flat')   return 'hired_voice';
  if (f.l === 'solo')      return 'solo_sellout';
  if (f.l === 'duet' && (st.relationship ?? 0) > TRUE_ENDING_REL && (f.deal === '5050' || f.deal === '6040')) return 'true_ending';
  if (f.name === 'hers')   return 'marquee';
  if (f.deal === '6040')   return 'business_6040';
  return 'equal_partner';
}
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
/** Placeholder three-panel strip (owner will write the captions; keys are stable). */
const pendingStrip = (title, speakers) => ({
  title, speaker: speakers[0],
  panels: speakers.map((sp, i) => ({ speaker: sp, text: `[caption pending — ${title}, panel ${i + 1}]` })),
});

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
        api.meanwhile('malik_cars');
        return true;
      },
    },
    meanwhile: {
      malik_cars:  pendingStrip("Malik dispatches three cars", ['Malik Reed', 'The Crew', 'Malik Reed']),
      stank_legal: pendingStrip("Stank legal notices the NoiseCloud upload", ['Stank Legal', "Dom'nique", 'Stank Legal']),
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
            id: 'promise', consequential: true, next: 'dom_tape',
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

      // ── Side quest: Dom's tape (18.4) — develops Dom'nique, changes the
      // press scene, pays off at Cle Elum.  Optional; a plain way out. ──
      dom_tape: {
        stopId: 'N', mandatory: false,
        when: (st) => st.flags.credit === 'promised' && !st.flags.tapeAsked,
        speaker: "Dom'nique", portrait: 'biz_parkride', importance: 'minor',
        line: "If you're really getting me credit — take this too. Ten tracks, my beats, no Malik. Tennessee'll know what a B-side is.",
        choices: [
          { id: 'take', consequential: true, next: null,
            label: "Give it here. If they press yours, it's going on the record.",
            reply: "Man. Nobody's carried anything of mine past Snoqualmie. Don't scratch it.",
            effects: { items: { domTape: true }, flags: { tapeAsked: true }, relationship: 5 } },
          { id: 'leave', consequential: false, next: null,
            label: "I'm carrying enough of other people's music.",
            reply: "Fair. Credit's still credit.",
            effects: {} },
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
          {
            id: 'bside', consequential: true, next: null,
            when: (st) => has(st, 'domTape'),
            label: "Producer credit for Dom'nique — and press his tape as the B-side.",
            reply: "A B-side! Now THAT'S a record. Producer credit, Dom's ten on the flip. Every pothole between here and Cle Elum still costs you two of 'em.",
            effects: { items: { thumbdrive: false, domTape: false, records: VINYL_RECORDS }, flags: { creditOut: 'producer', bside: true }, cargo: { records: VINYL_RECORDS, recordsMax: VINYL_RECORDS, hpLost: 0 }, relationship: 5 },
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
              const tail = st.flags.bside ? " And a B-SIDE? The Dom'nique tracks alone would've sold. Extra for the flip." : '';
              return (o === 'pristine'     ? "A hundred clean. That's the whole town's Friday. You just put Hip-Hop on every radio from here to Pullman." :
                     o === 'damaged'      ? "Half a crate's still a crate. It sells — and so does the story of how it got here." :
                     o === 'almost_empty' ? "Barely enough to fill the window display, but the song's out. That counts." :
                     o === 'one_record'   ? "One record. It'll be a collector's item by Tuesday. The song still gets out — that's the part that matters." :
                                            "Nothing to sell, nothing to spin. Malik's album died on I-90.") + (o === 'zero' ? '' : tail);
            },
            effects: (st, run) => {
              const n = Math.floor(run.cargo.records ?? st.items.records ?? 0);
              const o = vinylOutcome(n);
              const pay = vinylPayout(n, run.cargo.hpLost ?? 0);
              const fx = { flags: { deliveredRecords: true, outcome: o }, items: { records: false, recordsHpLost: false }, cargo: { records: null, hpLost: null }, ending: o };
              if (pay > 0) fx.cash = pay;
              if (st.flags.bside) fx.cash = (fx.cash ?? 0) + DOM_TAPE_BONUS;   // side quest payoff
              if (n >= 1 && st.flags.creditOut === 'malik') fx.meanwhile = 'stank_legal';
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
    meanwhile: {
      brittney_friends: pendingStrip("Brittney's StageWagon friends read her messages", ['StageWagon Friend', 'StageWagon Friend', 'Brittney']),
    },
    // Brittney can only board at Mercer, off the live Hip-Hop fork.
    passengerJoinStop: (st, run, canon) => {
      const hh = canon.stories.hiphop;
      return (hh?.status === 'active' && hh.items?.phone && !hh.items?.phoneLocked && !hh.flags?.mercerDone) ? 'M' : null;
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

      // ── Side quest: the aux cord (18.4) — comic relief with a payoff at
      // Vantage.  Optional, once, at the first need stop after boarding. ──
      brittney_aux: {
        stopId: 'B', mandatory: false,
        when: (st, run) => !!run.passenger && !st.flags.auxAsked,
        speaker: 'Brittney', portrait: 'biz_gasnsip', importance: 'minor',
        line: "Give me the aux. If I hear one more phonk drop before Vantage I'm walking to StageWagon.",
        choices: [
          { id: 'give', consequential: true, next: null,
            label: "Fine. Aux is yours till Vantage. Country it is.",
            reply: "She has a playlist called ROAD TRIP BABES. It is ninety minutes long. You will hear all of it.",
            effects: { flags: { auxAsked: true, auxGiven: true }, relationship: 5, radio: 'country' } },
          { id: 'keep', consequential: true, next: null,
            label: "Driver picks the music. Passenger picks the snacks.",
            reply: "She puts one earbud in and stares out the window for eleven miles.",
            effects: { flags: { auxAsked: true }, relationship: -3 } },
          { id: 'later', consequential: false, next: null,
            label: "Ask me again after the pass.",
            reply: "Uh-huh.",
            effects: {} },
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
              const aux = st.flags.auxGiven ? " She keeps your aux cord. You notice a mile later." : '';
              return (o === 'ride_em' ? "She kisses you like she means it, then she's gone into the crowd. Your phone buzzes: a new contact." :
                     o === 'standard' ? "A hug, a wink, and she's running for the gas-station door." :
                                        "A quick hug. She doesn't look back.") + aux;
            },
            effects: (st, run) => {
              const o = countryOutcome(st, run);
              const fx = { flags: { outcome: o, left: true }, passenger: null, ending: o, unlockGenre: STORY_GENRE.country };
              if (o === 'ride_em') { fx.cash = COUNTRY_PAY_RIDE_EM; fx.contact = { id: 'brittney', name: 'Brittney' }; fx.meanwhile = 'brittney_friends'; }
              else if (o === 'standard') fx.cash = COUNTRY_PAY_STANDARD;
              return fx;
            } },
        ],
      },
    },
  },

  // ══ C — Classic Rock: ImprompTour (Ch. 18.8) ════════════════════════════
  //
  // The Vantage diner waitress rides along from Vantage to Pullman.  Every
  // town is a mandatory arrival tile.  Relationship 0–100 raw (five stars are
  // display only), duet Following in `following`, an individual following and a
  // count of CONTROLLING choices in flags.  Routes: Partnership (50/50, or 60/40
  // accepted at rel ≥ 75), Hired Voice (flat fee — reaches Pullman, no unlock),
  // Broken Voice (≥ 3 controlling choices AND rel < 25: she accepts anything —
  // framed as the bad outcome, unlocks), band implosion (refused ownership or a
  // rejected 60/40 — no Pullman show).
  classicRock: {
    id: 'classicRock', version: 2,
    title: 'ImprompTour',
    genre: STORY_GENRE.classicRock,
    entry: { stopId: 'V' },
    startNode: 'vantage_diner',
    startRelationship: 50,
    endings: {
      true_ending:     { label: 'ENCORE',                 unlock: true },
      equal_partner:   { label: 'EQUAL PARTNERS',         unlock: true },
      marquee:         { label: 'HER NAME ON THE MARQUEE', unlock: true },
      business_6040:   { label: 'SIXTY-FORTY',            unlock: true },
      solo_sellout:    { label: 'SOLO SELLOUT',           unlock: true },
      hired_voice:     { label: 'HIRED VOICE',            unlock: false },
      broken_voice:    { label: 'BROKEN VOICE',           unlock: true },
      band_implosion:  { label: 'BAND IMPLOSION',         unlock: false },
      left_at_othello: { label: 'LEFT AT OTHELLO',        unlock: false },
      nan_500:         { label: "NAN'S FIVE HUNDRED",     unlock: false },
      nan_choice:      { label: 'SHE WENT WITH NAN',      unlock: false },
    },
    meanwhile: {
      nan_wrong_town: pendingStrip("Nan visits the wrong town", ['Nan', 'A Stranger', 'Nan']),
    },
    // The waitress boards at Vantage while the arc is available or offered.
    passengerJoinStop: (st) => ((st.status === 'available' || (st.status === 'active' && !st.flags.aboard)) ? 'V' : null),
    deriveRun: (st, run) => { if (st.flags.aboard && !st.flags.left) run.passenger = { id: 'waitress', name: 'The Waitress', storyId: 'classicRock' }; },
    nodes: {
      // ── Vantage diner — she's changing out of her uniform ──────────────
      vantage_diner: {
        stopId: 'V', mandatory: true,
        when: (st, run) => !run.passenger && !st.flags.rideOffered,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'major',
        line: "My nan was going to take me to Othello, but she forgot again. Last time she remembered her car but forgot which granddaughter to grab.",
        choices: [
          { id: 'east', consequential: true, next: 'vantage_offer',
            label: "Oof… a lot to unpack there, but I'm headed east and can get you to Othello.",
            reply: "You're hired. Give me two minutes to stop looking like a menu.",
            effects: { flags: { rideOffered: true }, relationship: 5 } },
          { id: 'reliable', consequential: true, next: 'vantage_offer',
            label: "You don't have friends, coworkers or someone more reliable than a stranger who drives that?",
            reply: "Friends, sure. Reliable, no. And that car has four wheels, which already beats my nan's memory.",
            effects: { flags: { rideOffered: true } } },
          { id: 'better', consequential: true, next: 'vantage_offer',
            label: "Maybe she grabbed a better granddaughter? Heh…",
            reply: "…Wow. Okay. Drive me anyway — I've heard worse from family.",
            effects: { flags: { rideOffered: true }, relationship: -5 } },
        ],
      },
      vantage_offer: {
        stopId: 'V', mandatory: true,
        when: (st, run) => !run.passenger && !!st.flags.rideOffered && !st.flags.aboard,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'choice',
        line: "You sing at all? The Othello bar needs an opener. It's unpaid AND they charge the fifty-dollar cover, but it's surprisingly good exposure out here.",
        choices: [
          { id: 'accept', consequential: true, next: null,
            label: "So I pay them $50 to sing and dance?! …I've actually made worse investments.",
            reply: "That's the spirit. Worst case you bomb in a town nobody can find on a map.",
            effects: { flags: { aboard: true, show1: 'opener' }, relationship: 5, passenger: { id: 'waitress', name: 'The Waitress', storyId: 'classicRock' } } },
          { id: 'flirt', consequential: true, next: null,
            label: "For fifty bucks I'd sing anything you put in front of me.",
            reply: "Careful. I might put myself in front of you. Get in.",
            effects: { flags: { aboard: true, show1: 'opener', flirtAccept: true }, relationship: 10, passenger: { id: 'waitress', name: 'The Waitress', storyId: 'classicRock' } } },
          { id: 'driveOnly', consequential: true, next: null,
            label: "I'll drive you. Nobody needs to hear me sing.",
            reply: "Your loss. You can watch, then.",
            effects: { flags: { aboard: true, show1: 'drive' }, passenger: { id: 'waitress', name: 'The Waitress', storyId: 'classicRock' } } },
        ],
      },

      // ── Othello — show one ─────────────────────────────────────────────
      othello_cover: {
        stopId: 'O', mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.show1 === 'opener' && !st.flags.coverPaid,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'minor',
        line: "Fifty at the door. Told you. The cover's on you — the stage is on me.",
        choices: [
          { id: 'pay', consequential: true, next: 'othello_show', cost: OTHELLO_COVER,
            label: "Here's fifty. Let's see this stage.",
            reply: "The bar smells like decades. You open. It goes better than fifty dollars had any right to.",
            effects: { flags: { coverPaid: true } } },
        ],
      },
      othello_show: {
        stopId: 'O', mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.show1 === 'opener' && !!st.flags.coverPaid && !st.flags.othelloDone,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'climax',
        line: "Hearing you sing like that sent a rush down my body. I have a list of propositions for you, but here are two for now…",
        choices: [
          { id: 'hearBoth', consequential: true, next: null, cost: OTHELLO_PROPOSITION,
            label: "Both. Right now. And the drinks are on me.",
            reply: "One: we keep this ImprompTour rolling east. Two: you think about a duet in Washtucna. Don't answer yet.",
            effects: { flags: { othelloDone: true, tour: true, duetOffered: true }, relationship: 10 } },
          { id: 'payingOnly', consequential: true, next: null, cost: OTHELLO_PROPOSITION,
            label: "Just the one that pays. I'm not here for the rest.",
            reply: "…Just the paying one. Fine. Washtucna pays three hundred. Solo or duet — your call, apparently.",
            effects: { flags: { othelloDone: true, tour: true }, relationship: -10, controlling: 1 } },
          { id: 'reject', consequential: true, next: null,
            label: "No. I'm not spending another fifty dollars to hear a sales pitch.",
            reply: "Then this is where the tour ends. Thanks for the ride — really.",
            effects: { flags: { othelloDone: true, left: true }, passenger: null, ending: 'left_at_othello', status: 'failed' } },
        ],
      },
      othello_watch: {
        stopId: 'O', mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.show1 === 'drive' && !st.flags.othelloDone,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'major',
        line: "She sings. The bar goes quiet in the good way. Afterwards she finds you by the door, still buzzing.",
        choices: [
          { id: 'jealous', consequential: true, next: null,
            label: "I have to admit, I'm a little jealous I didn't give that show a chance. I'm definitely in on the next one if they'll have me.",
            reply: "Then Washtucna's your audition. Don't make me regret saying that.",
            effects: { flags: { othelloDone: true, tour: true, auditionNext: true }, relationship: 5 } },
        ],
      },

      // ── Hatton — Nan and the Oldsmobile ────────────────────────────────
      hatton_nan: {
        stopId: 'H', mandatory: true,
        when: (st, run) => !!run.passenger && !st.flags.nanDone,
        speaker: 'Nan', portrait: 'grandma', importance: 'climax',
        line: "An Oldsmobile the color of old teeth rolls up and Nan leans out. \"There she is! I'll give you a mild fortune for gas and your time — five hundred dollars — if you give me my granddaughter back.\"",
        choices: [
          { id: 'take', consequential: true, next: null,
            label: "Five hundred? Sold. She's all yours, ma'am.",
            reply: "Nan counts it out in twenties. The waitress doesn't say a word getting into the Oldsmobile.",
            effects: { cash: NAN_OFFER, flags: { nanDone: true, left: true }, passenger: null, ending: 'nan_500', status: 'failed' } },
          { id: 'herCall', consequential: true, next: null,
            label: "That's her call, not mine.",
            reply: (st) => st.relationship >= NAN_STAY_REL
              ? "She looks at Nan, then at you. \"I'm going to Pullman, Nan. Follow the tour if you want.\""
              : "She hugs Nan for a long time. \"Sorry. It was fun.\" And she's gone.",
            effects: (st) => st.relationship >= NAN_STAY_REL
              ? { flags: { nanDone: true }, relationship: 5, meanwhile: 'nan_wrong_town' }
              : { flags: { nanDone: true, left: true }, passenger: null, ending: 'nan_choice', status: 'failed' } },
          { id: 'refuse', consequential: true, next: null,
            label: "No deal. She's got shows to play.",
            reply: "Nan squints. The waitress hides a smile behind her hand.",
            effects: { flags: { nanDone: true }, relationship: 10, meanwhile: 'nan_wrong_town' } },
          { id: 'demand', consequential: true, next: null,
            label: "Make it a thousand and we'll talk.",
            reply: "Nan: \"I maxed the ATM at five hundred, sweetheart.\" The waitress stares at you the whole way back to the car.",
            effects: { flags: { nanDone: true }, relationship: -10, controlling: 1 } },
        ],
      },

      // ── Washtucna — show two (solo / duet decision) ────────────────────
      washtucna_show: {
        stopId: 'W', mandatory: true,
        when: (st, run) => !!run.passenger && !st.flags.washtucnaDone,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'major',
        line: (st) => (st.flags.auditionNext ? "Audition night. " : "") + "Washtucna pays three hundred for the set. Solo or duet — it's your stage, partner-to-be.",
        choices: [
          { id: 'solo', consequential: true, next: null,
            label: "Solo. I'll take the three hundred.",
            reply: "She watches from the bar. Claps. Doesn't come up.",
            effects: { cash: SHOW2_TOTAL, flags: { washtucnaDone: true, w: 'solo' }, relationship: -10, controlling: 1, soloFollowing: 10 } },
          { id: 'equal', consequential: true, next: null,
            label: "Duet, straight down the middle.",
            reply: "A hundred and fifty each, and the room sings the chorus back at us.",
            effects: { cash: SHOW2_TOTAL / 2, flags: { washtucnaDone: true, w: 'equal' }, relationship: 10, following: 10 } },
          { id: 'giveAll', consequential: true, next: null,
            label: "Take all of it. Your voice carried that room.",
            reply: "Oh, boy. You must be looking for a trio, talking that sweet.",
            effects: { flags: { washtucnaDone: true, w: 'gave' }, relationship: 20, following: 20 } },
        ],
      },

      // ── Side quest: tomorrow's set list (18.4) — foreshadows the Colfax
      // title fight; changes the La Crosse line.  Optional, after show two. ──
      setlist: {
        stopId: 'W', mandatory: false,
        when: (st, run) => !!run.passenger && !!st.flags.washtucnaDone && !st.flags.setlistAsked,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'minor',
        line: "La Crosse wants a set list by midnight. Opener: your song or mine?",
        choices: [
          { id: 'hers', consequential: true, next: null,
            label: "Yours. Open with the one that shut the room up tonight.",
            reply: "She writes it down before you can change your mind.",
            effects: { flags: { setlistAsked: true, setlist: 'hers' }, relationship: 5 } },
          { id: 'mine', consequential: true, next: null,
            label: "Mine. They should know whose tour this is.",
            reply: "\"Whose tour.\" She writes that down too, somewhere you can't see.",
            effects: { flags: { setlistAsked: true, setlist: 'mine' }, controlling: 1, soloFollowing: 5 } },
          { id: 'later', consequential: false, next: null,
            label: "Sleep on it. Ask me in the morning.",
            reply: "Midnight, cowboy. Not morning.",
            effects: {} },
        ],
      },

      // ── La Crosse — show three (money must not decide it) ──────────────
      lacrosse_show: {
        stopId: 'L', mandatory: true,
        when: (st, run) => !!run.passenger && !st.flags.lacrosseDone,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'major',
        line: (st) => (st.flags.setlist === 'hers' ? "We open with mine, like you said. " : st.flags.setlist === 'mine' ? "We open with yours. Whose tour, right? " : '')
          + "La Crosse is the big one. Solo pays you four hundred. Duet pays eight — four each — because they're coming to see both of us.",
        choices: [
          { id: 'solo', consequential: true, next: null,
            label: "Solo. Four hundred, my name on the poster.",
            reply: "Four hundred. Your name. She sings backup from the wings and doesn't look at you once.",
            effects: { cash: SHOW3_SOLO, flags: { lacrosseDone: true, l: 'solo' }, relationship: -25, controlling: 1, soloFollowing: 15 } },
          { id: 'duet', consequential: true, next: 'lacrosse_after',
            label: "Duet. Eight hundred, and they came for both of us.",
            reply: "Eight hundred, four each — and the encore's ours. She won't stop grinning.",
            effects: { cash: SHOW3_DUET / 2, flags: { lacrosseDone: true, l: 'duet' }, relationship: 15, following: 20 } },
        ],
      },
      lacrosse_after: {
        stopId: 'L', mandatory: true,
        when: (st, run) => !!run.passenger && st.flags.l === 'duet' && !st.flags.lacrosseAfter,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'choice',
        line: "Backstage, still sweating, she hands you the last of the water.",
        choices: [
          { id: 'partner', consequential: true, next: null,
            label: "Are we getting good at this or what? See you onstage… partner.",
            reply: "Careful. I might ask you to put that word in writing.",
            effects: { flags: { lacrosseAfter: true }, relationship: 5 } },
        ],
      },

      // ── Colfax — the title ──────────────────────────────────────────────
      colfax_deal: {
        stopId: 'CO', mandatory: true,
        when: (st, run) => !!run.passenger && !st.flags.deal,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'climax',
        line: "Othello cost us money. Washtucna tested us. La Crosse paid because people came to see both of us. I'm not walking into Pullman as your passenger or your backup singer. What are we? Because I need a title.",
        choices: [
          { id: 'fifty', consequential: true, next: 'colfax_name',
            label: "Partners. Fifty-fifty, on paper.",
            reply: (st) => isBrokenVoice(st) ? "\"…Okay.\" She doesn't look up. It isn't agreement; it's what's left of her." : "\"Partners.\" She says it twice, like she's checking it fits.",
            effects: (st) => ({ flags: { deal: isBrokenVoice(st) ? 'broken' : '5050' }, relationship: isBrokenVoice(st) ? 0 : 10 }) },
          { id: 'sixty', consequential: true, next: 'colfax_name',
            label: "Sixty-forty. I drive, I book, I front the gas.",
            reply: (st) => isBrokenVoice(st) ? "\"Whatever you want.\" She's already looking out the window."
              : st.relationship >= SIXTY_FORTY_REL ? "\"…Sixty-forty. Fine. But my name's on the door too.\""
              : "\"Sixty-forty.\" She laughs once, not kindly, and gets her bag out of the back seat.",
            effects: (st) => isBrokenVoice(st) ? { flags: { deal: 'broken' }, controlling: 1 }
              : st.relationship >= SIXTY_FORTY_REL ? { flags: { deal: '6040' }, relationship: -5, controlling: 1 }
              : { flags: { deal: 'implode', left: true }, passenger: null, controlling: 1, ending: 'band_implosion', status: 'failed' } },
          { id: 'flat', consequential: true, next: null,
            label: "A flat fee per show. You sing, I pay you.",
            reply: (st) => isBrokenVoice(st) ? "\"Fine.\" Flat. Nothing behind it." : "\"A fee. Sure. I've had bosses before.\" The word partner doesn't come up again.",
            effects: (st) => ({ flags: { deal: isBrokenVoice(st) ? 'broken' : 'flat' }, relationship: isBrokenVoice(st) ? 0 : -15, controlling: 1 }) },
          { id: 'refuse', consequential: true, next: null,
            label: "You're the singer. It's my car, my tour, my name.",
            reply: (st) => isBrokenVoice(st) ? "She nods. That's all. Somewhere between Vantage and here she stopped arguing with you."
              : "\"Then it's your Pullman, too.\" She's out of the car before you finish the sentence.",
            effects: (st) => isBrokenVoice(st) ? { flags: { deal: 'broken' }, controlling: 1 }
              : { flags: { deal: 'implode', left: true }, passenger: null, controlling: 1, ending: 'band_implosion', status: 'failed' } },
        ],
      },
      colfax_name: {
        stopId: 'CO', mandatory: true,
        when: (st, run) => !!run.passenger && (st.flags.deal === '5050' || st.flags.deal === '6040') && !st.flags.name,
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'choice',
        line: "Then the name goes on the Pullman marquee. Whose?",
        choices: [
          { id: 'hers', consequential: true, next: null,
            label: "Yours. It was always going to be yours.",
            reply: "She goes quiet, then: \"Okay. But you're on the poster.\"",
            effects: { flags: { name: 'hers' }, relationship: 10 } },
          { id: 'together', consequential: true, next: null,
            label: "Ours. We'll fight about the font in the van.",
            reply: "\"Ours.\" She tries it out loud. It holds.",
            effects: { flags: { name: 'together' }, relationship: 5 } },
          { id: 'mine', consequential: true, next: null,
            label: "Mine. I'm the one booking the rooms.",
            reply: "\"Sure. Yours.\" She doesn't argue, which is worse than arguing.",
            effects: { flags: { name: 'player' }, relationship: -10, controlling: 1 } },
        ],
      },

      // ── Pullman — the final show ────────────────────────────────────────
      pullman_final: {
        stopId: 'P', mandatory: true,
        when: (st, run) => !!run.passenger && !!st.flags.deal && st.flags.deal !== 'implode',
        speaker: 'Diner Waitress', portrait: 'diner_waitress', importance: 'ending',
        line: (st) => {
          const o = classicRockOutcome(st);
          const crowd = (st.following ?? 0) + (st.flags.soloFollowing ?? 0);
          return "Pullman. The marquee's lit, the room's full" + (crowd ? " — " + crowd + " of them came for the tour" : '') + ". " + (
            o === 'true_ending'   ? "She squeezes your hand behind the curtain. \"Whatever happens out there — thank you for the ride.\"" :
            o === 'marquee'       ? "Her name's up there in letters taller than she is. She can't stop looking at it." :
            o === 'business_6040' ? "\"Sixty-forty,\" she says, checking the door count. \"Let's earn it.\"" :
            o === 'hired_voice'   ? "\"Set list's on the amp,\" she says. \"Boss.\"" :
            o === 'broken_voice'  ? "She's already onstage, waiting, the way she's waited for everything since Colfax." :
            o === 'solo_sellout'  ? "\"Your name's on the poster,\" she says. \"I'll be at the bar.\"" :
                                    "\"Partners,\" she says, and means it.");
        },
        choices: [
          { id: 'play', consequential: true, next: null,
            label: "Let's play the show.",
            reply: (st) => {
              const o = classicRockOutcome(st);
              return o === 'true_ending'   ? "Last chorus, the whole room on its feet — and she kisses you, onstage, in front of all of them. You kiss her back. Classic Rock is yours. So, it turns out, is the tour." :
                     o === 'marquee'       ? "The encore is hers. She drags you out for it anyway. Classic Rock is yours." :
                     o === 'business_6040' ? "Sixty-forty of a sold-out room is still a sold-out room. Classic Rock is yours." :
                     o === 'hired_voice'   ? "She sings every note she's paid for and not one more. Seventy-five hundred, cash. She's gone before the lights come up." :
                     o === 'broken_voice'  ? "She sings like something's been taken out of her. The room loves it. You take all ten thousand. Nobody says anything on the drive." :
                     o === 'solo_sellout'  ? "Five thousand, your name on the poster, and a bar stool with her back to the stage." :
                                             "Fifty-fifty, a full room, and an encore neither of you planned. Classic Rock is yours.";
            },
            effects: (st) => {
              const o = classicRockOutcome(st);
              const pay = (o === 'true_ending' && st.flags.deal === '6040') ? PULLMAN_PAY.business_6040 : (PULLMAN_PAY[o] ?? 0);
              const fx = { flags: { outcome: o, left: true }, passenger: null, ending: o };
              if (pay > 0) fx.cash = pay;
              if (FEATURED_STORIES_ENDING_UNLOCK[o]) fx.unlockGenre = STORY_GENRE.classicRock;
              return fx;
            } },
        ],
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
