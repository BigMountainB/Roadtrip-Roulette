import Phaser from 'phaser';
import {
  SCREEN_W, SCREEN_H, VICES, VICE_CONFIG,
  VEHICLES, REST_STOPS,
  GAS_USD_PER_MI, GAS_ROBBERY_CHANCE, GAS_ROBBERY_FRAC,
  HUD_OFFSET_X,
} from '../constants.js';
import { ITEM_FX } from '../systems/SurvivalSystem.js';
import { Difficulty } from '../systems/Difficulty.js';
import {
  pickEncounterForStop, resolveChoice, applyEncounterEffects,
  isDialogueTree, getStartNode, getEncounterNode, choiceLocked, isExitChoice,
  SHOP_GREETERS,
} from '../data/encounters.js';
import { getPortrait } from '../data/npcPortraits.js';
import { nextTownFact } from '../data/townFacts.js';
import { MISSION_TIERS, tierFor, contactIdFor, contactGreeting } from '../systems/MissionSystem.js';
import { getInstalled, buyUpgrade, getUpgradeEffects } from '../systems/UpgradeSystem.js';
import { UPGRADE_SLOTS, SLOT_LABELS, getSlotTiers,
         GARAGE_CATEGORIES, SHOP_CATEGORIES, categoryForSlot } from '../data/upgrades.js';

// Les Schwasted's free popcorn heals 1% of MAX health per serving, capped at
// this fraction of max per visit (owner 2026-07-28).  The cap is what keeps a
// free item from replacing the $1500 repair.
const POPCORN_MAX_PCT   = 0.05;
const POPCORN_PER_SERVE = 0.01;
import { GENRE_VEHICLE_TRAITS } from '../data/genreVehicleTraits.js';

const CX = SCREEN_W / 2;
const IMPACT = 'Impact, "Arial Black", Arial, sans-serif';
import * as Metal from '../ui/MetalUI.js';

// ── Menu tap gate (owner 2026-08-03) ─────────────────────────────────────
// One physical tap must never fire on two screens.  These menus mix event
// types by design: placards, dealer cards and dialog choices act on pointer
// DOWN, while shop buy buttons act on pointer UP (so a scroll swipe can't
// buy — see _makeButton).  A tap that opened a screen was therefore landing
// its UP on whatever button the NEW screen had just put under the finger.
// Every screen swap / popup now eats the remainder of the tap that caused it
// and ignores menu input for this long.  Short on purpose — long enough to
// swallow a stray release, short enough that tapping through screens still
// feels instant.  Raise it if a ghost click ever survives.
const MENU_GATE_MS = 300;

// Vice texture key — every vice's pickup asset is named vice_<id>.
const VICE_TEX = (id) => `vice_${id}`;

// Per-vice rest-stop pricing — each click adds +10 % to that bar, capped
// at 80 %.  Prices scaled so 8 clicks (0 → 80 %) costs roughly the same
// as the old single +50 % click did.
// Per-vice pharmacy base prices.  Camp / dealer / charge / hunting
// apply SHOP_VICE_MARKUP (2.5×) on top.  Cut ~70-90 % from the
// pre-rebalance numbers per the cost ladder so dealer trips are
// tempting but pharmacy is the budget option.
export const VICE_PRICE = {
  sushi:  5,   burrito:   5,    energy: 40,   gummies: 15,
  hotdog:     10,   combo: 15,   coldbrew:      10,   coma: 25,
  slushie:15,   caffeine:   15,
};

const VICE_DISPLAY = (id) => VICE_CONFIG[id]?.label?.replace(/^[^A-Za-z]+/, '').trim() ?? id;

// Restroom item — empties the BLADDER bar (nothing else). `gated` restrooms
// (the trash gas stations, ~50% of them) are customers-only: you must buy
// something at THAT stop first. Park & Ride / Camp restrooms are free.
// `freeDesc` overrides the flavor line for a specific free restroom.
const restroomItem = (gated, freeDesc) => ({
  id: 'restroom', emoji: '🚽', label: '🚽  USE RESTROOM', cost: 0,
  desc: gated ? 'Piss in bliss — customers only.'
              : (freeDesc ?? 'Piss in bliss — and it\'s free.'),
  payload: { restroom: true, gated: !!gated },
});

// Bottled water — refills the Drinks bar. Sold at gas stations and AOK
// campgrounds. Fill is a modest +3% (owner 2026-07-19): a single bottle is a
// sip, not a full tank — real hydration comes from stocking up over many stops.
const waterItem = (cost) => ({
  id: 'water', emoji: '💧', label: '💧  WATER', cost,
  desc: 'A cold bottle — a small Drinks top-up.',
  payload: { survivalDelta: { hydration: 3 } },
});

const viceItems = (unlocks /* { id: bool } | Set<id> | null */) => {
  const items = [
    { id: 'coffee',     label: 'COFFEE',           emoji: '☕',
      cost: 10, desc: 'A moderate Alertness bump. Brewed at some point this week.',
      payload: { coffee: true, survivalDelta: { tiredness: -15 } } },
    // TAKE A SNOOZE moved out of both trash gas stations to AOK Camp
    // (owner 2026-07-29) — you sleep it off at the campground, not in the
    // aisle of a convenience store.  See the `camp` section below.
  ];
  // Vice unlocks are stored in the registry by ViceSystem.snapshotUnlocks
  // as a PLAIN OBJECT { sushi: true, burrito: true, gummies: true, ... },
  // not a Set.  Accept either form so the filter works regardless.
  const isUnlocked = (id) => {
    if (unlocks instanceof Set) return unlocks.has(id);
    if (unlocks && typeof unlocks === 'object') return !!unlocks[id];
    return !!VICE_CONFIG[id]?.unlocked;
  };
  for (const id of Object.values(VICES)) {
    if (!isUnlocked(id)) continue;
    // Caffeine PILLS are the rare, premium alertness item (owner 2026-07-17):
    // stronger Alertness bump than coffee AND ~1.8× its price, so coffee is the
    // cheap-moderate option and pills are the pricey-strong one. (This overrides
    // the generic gas-station-food treatment for caffeine ONLY in the shop; the
    // road caffeine pickup keeps its own ITEM_FX balance.)
    if (id === 'caffeine') {
      items.push({
        id:    'vice_caffeine',
        label: 'CAFFEINE PILLS',
        icon:  VICE_TEX('caffeine'),
        cost:  18,   // ~1.8× the $10 coffee — rare + strong
        desc:  '+28 Alertness — the strong, rare stuff.',
        payload: { survivalDelta: { tiredness: -28 } },
      });
      continue;
    }
    // Gas-station food/drink: flat $25, fills the survival bars at HALF
    // the road-sprite amounts (2026-07-16 owner economy pass).
    const fx = ITEM_FX[id] ?? {};
    const half = (v) => (v ? Math.round(v * 5) / 10 : 0);   // half, 1dp
    const bits = [];
    if (half(fx.h)) bits.push(`+${half(fx.h)} Drinks`);
    if (half(fx.f)) bits.push(`+${half(fx.f)} Food`);
    if (fx.t && fx.t < 0) bits.push(`+${half(-fx.t)} Alertness`);
    items.push({
      id:    `vice_${id}`,
      label: VICE_DISPLAY(id).toUpperCase(),
      icon:  VICE_TEX(id),
      cost:  25,
      desc:  bits.length ? `${bits.join(' · ')} (half a road bite)` : 'A nibble.',
      payload: { survivalDelta: { hydration: half(fx.h), fullness: half(fx.f), tiredness: fx.t ? -half(-fx.t) : 0 } },
    });
  }
  return items;
};

// Per-shop vice allow-lists.  Each shop sells a small subset; the item
// only appears if the player has ALREADY sampled the vice at least
// once (pickupCounts[vice] > 0).  Camp / charging / gas / hunting /
// dealer each have their own personality (sketchy back-country deals,
// EV-station novelty gummies, gas-pump snacks, etc.).
//
// Gas-N-Sip's vices tab keeps the full menu (it's the dedicated vice
// shop and isn't gated by exposure).
const SHOP_VICES = {
  gas:     ['sushi', 'burrito'],                       // Sushi + Burrito at the pump
  hunting: [],                                       // Cowbellas = hunting gear only, no food
  camp:    ['coma', 'slushie', 'caffeine'],          // Sketchy back-country
  dealer:  ['energy'],                               // Dealership = energy shots
};
// Camp + charging + dealer charge a 2.5× markup over Gas-N-Sip.
const SHOP_VICE_MARKUP = 2.5;

function shopViceItems(shopKey, pickupCounts) {
  const allow = SHOP_VICES[shopKey] ?? [];
  const out = [];
  for (const id of allow) {
    if (!pickupCounts || (pickupCounts[id] ?? 0) <= 0) continue;
    const fx = ITEM_FX[id] ?? {};
    const half = (v) => (v ? Math.round(v * 5) / 10 : 0);
    out.push({
      id:    `shopvice_${id}`,
      label: VICE_DISPLAY(id).toUpperCase(),
      icon:  VICE_TEX(id),
      cost:  25,
      desc:  'Half a road bite, roadside prices.',
      payload: { survivalDelta: { hydration: half(fx.h), fullness: half(fx.f), tiredness: fx.t ? -half(-fx.t) : 0 } },
    });
  }
  return out;
}

// Genre-car catalog for the DEALER → CARS screen (owner 2026-07-23): every
// culture's starter car is on the lot at ANY dealership for a flat $25,000.
// Buying one unlocks that culture for the plate — its soundtrack identity,
// ride traits, and sprite art — and you drive it off the lot immediately.
// Already-owned cars swap in free; the active car lists as a YOUR RIDE row.
// (In Custom mode the save sandbox seeds + isolates ownership, so lot
// activity there never persists.)
const GENRE_CAR_PRICE = 25000;
const GENRE_LABELS = {
  hiphop_phonk: 'HIP-HOP / PHONK', country: 'COUNTRY', reggaeton: 'REGGAETON',
  k_pop: 'K-POP', metal: 'METAL', classic_rock: 'CLASSIC ROCK',
  edm_rave: 'EDM / RAVE', reggae: 'REGGAE', pop_punk_emo: 'POP-PUNK / EMO',
  norteno: 'NORTEÑO',
};
function genreCarItems() {
  const active = window.__genre?.get?.() ?? null;
  const owned  = window.__genre?.owned?.() ?? [];
  const out = [];
  for (const t of Object.values(GENRE_VEHICLE_TRAITS)) {
    const gLabel   = GENRE_LABELS[t.key] ?? t.key.toUpperCase();
    const isActive = t.key === active;
    const isOwned  = isActive || owned.includes(t.key);
    out.push({
      id: `gcar_${t.key}`,
      label: `🚗  ${t.vehicleName.toUpperCase()} — ${gLabel}`,
      cost: isOwned ? 0 : GENRE_CAR_PRICE,
      desc: isActive ? 'Your current ride.'
                     : `${t.topSpeedMph} mph top · ${t.strengths?.[0] ?? ''}`,
      disabled: isActive,
      disabledReason: 'Already driving it.',
      payload: isOwned ? { driveGenre: t.key } : { buyGenre: t.key },
    });
  }
  // Your ride first, then owned swaps, then the $25k showroom.
  out.sort((a, b) => (a.disabled ? -1 : b.disabled ? 1 : a.cost - b.cost));
  return out;
}

const SECTIONS = {
  // Existing vice menu — kept as a 5th tab; not part of the 4 sign panels
  // but it's been at rest stops since launch and the player still buys
  // vices from inside the brown sign.
  vices: {
    label: '💊  VICES',
    items: viceItems(null),
  },
  // AM/BM — a second trash gas station (toilet-demolition flavor).  Sells
  // the same road snacks as Gas-N-Sip plus its own restroom.  Items are
  // repopulated per-player in create().
  ambm: {
    label: '🚽  AM/BM',
    items: viceItems(null),
  },
  // ── 4-panel highway-services sections (match the rest stop sign) ──
  gas: {
    label: '⛽  GAS',
    // items[] populated dynamically in create() because refuel cost is
    // a function of the player's current gas tank.
    items: [],
  },
  hunting: {
    label: '🦌  HUNTING',
    items: [
      { id: 'coal',    label: 'DIESEL TUNE',      icon: 'weapon_coal',        cost:  350, desc: '+3 clouds — smoke out the law behind you',  payload: { f12: 'coal', f12Count: 3 } },
      // Fireworks ship 3 shows per purchase (full stack).  Triple-stacks
      // the F12 token via f12Count.
      { id: 'fireworks', label: 'FIREWORKS',      icon: 'weapon_fireworks',   cost: 500, desc: '+3 shows — scatters every cop on screen',   payload: { f12: 'fireworks', f12Count: 3 } },
      { id: 'paint',   label: 'DONUTS',           icon: 'weapon_paint_bomb',  cost:   50, desc: '+1 — all cops stop chasing 15s',            payload: { f12: 'paint_bomb' } },
      { id: 'camo',    label: '🥷  NEW PASSPORT', cost: 2000, desc: 'Single-use: clears 2 stars on resume',                                  payload: { camouflage: true } },
    ],
  },
  camp: {
    label: '🏕  CAMP',
    items: [
      { id: 'hitch',    label: '🧍  PICK UP HITCHHIKER',  cost:   0, desc: 'Free — but it\'s a gamble',                              payload: { hitchhike: true } },
      // TAKE A SNOOZE replaces the old free ad-gated NAP IT OFF (owner
      // 2026-07-29): one paid sleep at the campground instead of two sleep
      // items.  Keeps the nap's full Alertness restore — you don't sleep off
      // every vice in your system and wake up drowsy.
      { id: 'snooze',   label: '😴  TAKE A SNOOZE',       cost: 150, desc: 'Sleep it all off — every buzz back to zero, and you wake up sharp.', payload: { reduceVices: 0, survivalDelta: { tiredness: -100 } } },
      { id: 'coffee',   label: '☕  COFFEE',                cost:   7, desc: 'A moderate Alertness bump',                              payload: { coffee: true, survivalDelta: { tiredness: -15 } } },
      { id: 'campfix',  label: '🔧  CAMP REPAIR',          cost: 400, desc: 'Repair up to 65% HP (cheaper than dealership)',          payload: { campRepair: true } },
      // Hot Springs soak — a stacking +10 HP "bonus" (extra over max) that
      // carries into gameplay and is consumed by crash damage before regular HP.
      { id: 'hotsprings', label: '♨️  HOT SPRINGS SOAK', cost: 500, desc: '+10 bonus HP (above max, until used).', payload: { restHp: true, bonusHp: 10 } },
    ],
  },
  // DEALER's landing tile opens a chooser screen (see _showDealerChooser)
  // that branches to dealer_cars or dealer_acc.  The `dealer` section
  // here is intentionally items:[] — its placard is the entry point for
  // the chooser, not a sub-menu of its own.
  dealer: {
    label: '🏬  DEALER',
    items: [],
  },
  // Lord Motors / Sam's — two landing placards that both open ACCESSORIES
  // (dealer_acc) directly; items:[] since they're entry tiles, not menus.
  lord: {
    label: '🏬  DEALER',
    items: [],
  },
  suck: {
    label: '🏬  DEALER',
    items: [],
  },
  dealer_acc: {
    label: '🔧  ACCESSORIES',
    items: [],   // stays empty — Lord Motors is pure car sales
  },
  // Sam's-only Level 1 parts counter (owner 2026-07-30). A SEPARATE section
  // from dealer_acc, not a shared one — RestStopScene builds every section's
  // row objects ONCE at scene creation (see the "Sub-menus — built once"
  // loop), so a section's content can't legitimately differ by which dealer
  // tile got tapped; the two dealers needed genuinely different SECTIONS
  // entries. Items populated per-vehicle in create(), same as the garages.
  sam_acc: {
    label: '🔧  PARTS COUNTER',
    items: [],
  },
  dealer_cars: {
    label: '🚗  CARS',
    items: [],   // populated dynamically per-stop in create()
  },
  // Park & Ride — only at stops whose amenities include 'parkride'.  A free
  // public restroom stop; items populated in create().
  parkride: {
    label: '🅿️  PARK & RIDE',
    items: [],
  },
  // ── The two garages (owner 2026-07-28) ───────────────────────────────
  // Part-upgrades used to live entirely in dealer_acc, which meant the car
  // DEALERSHIPS sold tyres and paint.  They're split out here so the
  // dealerships go back to selling cars:
  //   Les Schwasted — tyre/brake/suspension specialist.  Cheap, quick,
  //     common.  Free popcorn + water (the Les Schwab gag).
  //   Finesse     — body & performance.  Expensive, rare, and the home of
  //     the PAINT JOB, which is what actually drops your wanted stars.
  schwasted: {
    label: '🛞  TIRES & BRAKES',
    items: [],   // populated per-vehicle in create()
  },
  fap: {
    label: '🎨  BODY & PERFORMANCE',
    items: [],   // populated per-vehicle in create()
  },
};

// SECTIONS is mutated per visit (dynamic pricing, restrooms, shop vices…) —
// but it's MODULE-level, so without a reset the mutations ACCUMULATED across
// visits: every camp added another restroom row, dynamic items duplicated,
// and a campfix disabled at one stop stayed disabled forever (2026-07-16
// owner reports: "3 restroom options at AOK", "no repair at Easton at 6 HP").
// Pristine per-section item lists, restored at the top of every create().
const SECTIONS_PRISTINE = Object.fromEntries(
  Object.entries(SECTIONS).map(([k, v]) => [k, Array.isArray(v.items) ? [...v.items] : v.items]),
);

// Landing tab order (brand placards).  dealer_acc / dealer_cars are
// reached via the Dealer chooser, not the landing.
// Storefront backdrop per shop section.  Keys that aren't here keep the blue
// highway-sign look (dealer chooser, sub-screens with no brand of their own).
const SHOP_BG = {
  gas:       'shop_bg_huffs',
  hunting:   'shop_bg_cowbellas',
  camp:      'shop_bg_aok',
  lord:      'shop_bg_lord',
  suck:      'shop_bg_suck',
  vices:     'shop_bg_gasnsip',
  ambm:      'shop_bg_am_bm',
  parkride:  'shop_bg_parkride',
  schwasted: 'shop_bg_les_schwasted',
  fap:       'shop_bg_fap',
};
/** Shops with toolbar categories (the two garages). */
const GARAGE_KEYS = new Set(['schwasted', 'fap']);

/** Shops whose menu is a single column over the storefront's empty left third. */
const FULL_BLEED = new Set([...Object.keys(SHOP_BG), 'dealer_acc', 'dealer_cars', 'sam_acc']);

// Direct paths let a shop recover its own backdrop on demand. Large storefront
// textures can be dropped during a memory-constrained mobile boot even though
// the smaller logo/menu assets survive; without this retry every shop silently
// fell back to the blue services-sign panel for the rest of the session.
const SHOP_BG_PATH = {
  shop_bg_huffs:         'assets/businesses/storefront_huffs.png',
  shop_bg_cowbellas:     'assets/businesses/storefront_cowbellas.png',
  shop_bg_aok:           'assets/businesses/storefront_aok.png',
  shop_bg_lord:          'assets/businesses/storefront_lord.png',
  shop_bg_suck:          'assets/businesses/storefront_suck.png',
  shop_bg_gasnsip:       'assets/businesses/storefront_gasnsip.png',
  shop_bg_am_bm:         'assets/businesses/storefront_am_bm.png',
  shop_bg_parkride:      'assets/businesses/storefront_park-and-ride.png',
  shop_bg_les_schwasted: 'assets/businesses/raw/les_schwasted_v2.png',
  shop_bg_fap:           'assets/businesses/storefront_fap.png',
};

const TAB_ORDER = ['gas', 'hunting', 'camp', 'lord', 'suck', 'schwasted', 'fap', 'parkride', 'vices', 'ambm'];
const ALL_SECTIONS = ['gas', 'hunting', 'camp', 'dealer', 'dealer_acc', 'dealer_cars', 'sam_acc', 'schwasted', 'fap', 'parkride', 'vices', 'ambm'];

// Per-stop brand catalog — west-side gets the cleaner brands (Lord Motors
// EV), east-side the dustier set (Huff's + Sam's gas).
// CowBella, AOK Camp, and Gas-N-Sip are universal.  Returned object
// has every brand key; the landing screen filters by stop.amenities to
// decide which placards actually render.
function brandsForStop(stop) {
  const isWest = (stop?.mileage ?? 0) < 100;
  return {
    gas:   { name: "Huff's Gas", logo: 'biz_huffs' },
    hunting: { name: 'CowBella',   logo: 'biz_cowbellas' },
    camp:    { name: 'AOK Camp',   logo: 'biz_aok' },
      // Two distinct dealerships now (owner 2026-07-22): a stop can carry
    // either or both, listed explicitly per-stop in REST_STOPS.amenities.
    // Lord Motors (EV) and Sam's Used Car Kingdom (gas) are no longer
    // auto-picked by region.  `dealer` (regional) kept only as a fallback
    // for the vestigial Cars chooser, which the landing tiles bypass.
    lord:    { name: 'Lord Motors',           logo: 'biz_lord', carFuel: 'electric' },
    suck:    { name: "Sam's Used Car Kingdom", logo: 'biz_suck', carFuel: 'gas' },
    dealer:  isWest
      ? { name: 'Lord Motors',          logo: 'biz_lord', carFuel: 'electric' }
      : { name: "Sam's Used Car Kingdom", logo: 'biz_suck', carFuel: 'gas' },
    vices:   { name: 'Gas-N-Sip', logo: 'biz_gasnsip' },
    ambm:    { name: 'AM/BM',     logo: 'biz_am_bm' },
    parkride:{ name: 'Metro Park & Ride', logo: 'biz_parkride' },
    // Logo keys are only registered in AssetManifest once the art exists —
    // the landing placard already falls back to an accent strip + name when
    // textures.exists() is false, so these render fine until then.
    schwasted:{ name: 'Les Schwasted', logo: 'biz_les_schwasted' },
    fap:{ name: 'Finesse Autobody & Performance', logo: 'biz_fap' },
  };
}

// Per-rest-stop NPC vignettes — 3 lines each, randomly picked on entry.
// Builds the "party crowd" lore as the player progresses east.  All ten
// rest stops keyed by their IDs (B, I, N, C, E, V, Y, O, W, L).
//
// VOICE (owner 2026-08-04): overheard fragments, NOT rhyme — the rhyming
// couplets belong to the NPCs you actually talk to (encounters.js). These are
// half a conversation you walk past. Each one should either be a joke or a
// piece of information; the ones that were neither got cut. Where a line can
// hang off something real about the town (Twede's, the Vantage horses, the
// Kittitas troopers), it does.
const VIGNETTES = {
  B: [   // Bellevue
    'Tell Mike I\'m leaving in five. I\'ve been leaving in five since noon.',
    'Parking garage at the Square, level six, 11pm. Nobody parks on six.',
    'My ex works at the bank downtown. No — the other one. No, the OTHER other one.',
  ],
  I: [   // Issaquah
    'Two cops sitting at the QFC on 17th. Take the back roads.',
    'Somebody put a whole salmon in a trunk. It is not on ice. It is not going to be okay.',
    'My cousin\'s couch is open if you blow the clock. It smells. But it\'s open.',
  ],
  N: [   // North Bend
    'Twede\'s is running Twin Peaks again. Order the pie. Do NOT order the coffee.',
    'Chains next door are marked up four hundred percent and every single person is buying them.',
    'Pass closes in three hours. MOVE.',
  ],
  C: [   // Cle Elum
    'You\'re DRIVING?? You are absolutely WASTED.',
    'Bakery\'s got the salted caramel ones. Ten minutes, tops. Ten.',
    'Town had a live switchboard operator until 1966. Still can\'t get anyone to pick up.',
  ],
  E: [   // Ellensburg
    'Rivalry game tonight — half of Pullman is already on this road ahead of you.',
    'Coffee\'s on. You look like hell. Both of those are facts.',
    'Troopers sit around Kittitas this time of night. They love a quota.',
  ],
  V: [   // Vantage
    'Somebody\'s climbing up to the steel horses. In flip-flops. At night.',
    'Last gas before the basin. I\'m not being dramatic. Last gas.',
    'Wind\'s up. If you\'ve got anything on the roof, it\'s already gone.',
  ],
  Y: [   // Royal City
    'Free apples in the orchard. Free-ish. Don\'t get caught.',
    'My uncle swears every cop in this town plays poker on Fridays. It\'s Friday.',
    'Desert sunset in twenty minutes and you\'re going to miss it. Floor it.',
  ],
  O: [   // Othello
    'Truck stop taqueria. Life-changing. I\'m not exaggerating and I\'m not eating anywhere else.',
    'You skipped Royal? They had the good energy drinks. The ones that are basically illegal.',
    'Combines on 26 tonight. Those things are rolling roadblocks with lights.',
  ],
  W: [   // Washtucna
    'Population two hundred. One cop. Do not test him.',
    'Somebody\'s grandma sent cookies for the party. Nobody can figure out whose grandma.',
    'Last shower for fifty miles. Consider that carefully.',
  ],
  L: [   // La Crosse
    'You\'re basically there. Do not blow it now.',
    'Everyone is asking where the f— you are. Everyone.',
    'Pullman\'s lit up like a Christmas tree. You can see it from the hill.',
  ],
};

function pickVignette(stopId) {
  const lines = VIGNETTES[stopId];
  if (!lines?.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

export class RestStopScene extends Phaser.Scene {
  constructor() { super({ key: 'RestStop' }); }

  init(data) {
    this._stop     = data?.stop     ?? { id: '?', name: 'Rest Stop' };
    this._score    = data?.score    ?? 0;
    this._stars    = data?.stars    ?? 0;
    this._position = data?.position ?? 0;
    this._odometer = data?.odometer ?? 0;
    // Party clock at pull-in — timed ("rush") mission deadlines are fixed at
    // acceptance as party-clock values (Ch. 8).
    this._partyClockSec = data?.partyClockSec ?? null;
    this._bladderAtEntry = data?.bladderAtEntry ?? 0;   // for the timed restroom cost
    // Full survival snapshot at pull-in — drives the compact (unlabeled)
    // status bars on the landing menu.  Live-updated from purchases
    // (restroom / encounter food+drink) via _drawSurvivalMini.
    this._survAtEntry = data?.survivalAtEntry ?? null;
    this._survMiniGfx = null;
    // Career stats — count this visit on entry; dwell time + spends are
    // recorded on exit (see the continue handler).
    this._stats = this.registry?.get?.('stats');
    this._stats?.restStopEnter(this._stop.id);
    try { window.__notif?.bump?.('maps'); } catch (_) {}   // new stop reached → Maps dot
    // Vice-bar snapshot — vice status pauses at the rest stop and resumes
    // from these levels.  COFFEE / SNOOZE multiply, vice top-ups stack on
    // top.  Just stopping doesn't change anything anymore.
    this._viceLevelsAtEntry = data?.viceLevelsAtEntry ?? {};
    this._weaponsAtEntry = data?.weaponsAtEntry ?? {};
    this._runStateAtEntry = data?.runStateAtEntry ?? null;
    this._messageStateAtEntry = data?.messageStateAtEntry ?? null;
    // Car durability — preserved by default so the rest stop doesn't
    // silently heal damage; REPAIR CAR sets it to 100.
    this._durabilityAtEntry = data?.durabilityAtEntry ?? 100;
    // Mutated as the player buys things; passed to GameScene on continue.
    this._purchases = {
      repair: false, restock: false, clearStars: false,
      scoreBonus: 0, upgrade: [], f12: [],
      // Sealed hitchhiker roll ({ roll }) — resolved by GameScene 5 mi out,
      // never here.  null when no rider was picked up at this stop.
      hitchhiker: null,
      // Default preserves the entry vice levels verbatim.
      viceLevelsOnResume: { ...this._viceLevelsAtEntry },
      // Default preserves carried weapons verbatim; purchases/hitchhiker
      // rewards layer on top via f12 below.
      weaponsOnResume: { ...this._weaponsAtEntry },
      // Default preserves run-level consequence/achievement timers.
      runStateOnResume: this._runStateAtEntry,
      // Phone conversations are per-run state. Preserve them across the
      // RestStopScene restart so Contacts doesn't look freshly reset.
      messageStateOnResume: this._messageStateAtEntry,
      // Default preserves the entry durability; REPAIR CAR overrides to 100.
      durabilityOnResume: this._durabilityAtEntry,
    };
    // Player's current vehicle + tank state — passed in by GameScene so
    // we can price refuel/charge based on missing range and gate dealer
    // vehicle purchases by what's already owned.
    this._vehicleId    = data?.vehicleId    ?? 'beater';
    this._gasMi        = data?.gasMi        ?? 0;
    this._gasMaxMi     = data?.gasMaxMi     ?? 250;
    this._ownedVehicles = data?.ownedVehicles ?? ['beater'];
    this._vicePickupCounts = data?.vicePickupCounts ?? {};
    this._activeTab     = 'gas';
    this._activeSection = null;
    this._screenStack   = ['landing'];
    this._tabContent    = {};
    this._sectionContainers = null;
    this._sectionScroll     = null;
    this._sectionContentH   = null;
    this._landingObjs       = null;
    this._dealerChooserObjs = null;
    this._buttonRefresh = [];
    // CRITICAL: Phaser reuses the RestStopScene instance, so we have to
    // explicitly clear stateful flags that survive between visits.
    // `_continuing` was leaking from the first stop's HIT THE ROAD click,
    // which made the second visit's button silently no-op.  Same kind of
    // bug as GameScene's `_takingExit`.
    this._continuing    = false;
    // Leave-confirm gate for uncollected READY drop-offs — must reset per
    // visit or a confirmed leave at stop 1 would skip the warning at stop 2.
    this._leaveConfirmed = false;
    this._statusTimer   = null;
    this._tabBgs        = null;
    this._tabLbs        = null;
    this._scoreText     = null;
    this._statusText    = null;
  }

  create() {
    // Stamp visit-start time so _continue() can compute the real-time
    // penalty (× 0.5 deducted from party clock) when the player leaves.
    this._sceneStartTime = Date.now();
    this.cameras.main.setBackgroundColor(0x110A05);
    // Decoupled-width: center the fixed 800-wide menu in the (possibly wider)
    // canvas via a camera viewport inset.  Re-applied on resize.  No-op when 0.
    const _applyVP = () => { try { this.cameras.main.setViewport(HUD_OFFSET_X, 0, SCREEN_W, SCREEN_H); } catch (_) {} };
    _applyVP();
    this.scale.on('resize', _applyVP, this);
    this.events.once('shutdown', () => this.scale.off('resize', _applyVP, this));

    // Rebuild the vices section using THIS player's unlock state — the
    // module-level SECTIONS.vices.items was computed at import time
    // before the registry existed, so it would show every vice.
    SECTIONS.vices.items = viceItems(this.registry?.get?.('viceUnlocks'));

    // ── Restroom availability ────────────────────────────────────────
    // Both trash gas stations (Gas-N-Sip + AM/BM) carry a restroom; ~50%
    // of stops are "customers only" (must buy something first).  The gate
    // is deterministic per stop id so it's stable across a visit.  Park &
    // Ride and Camp restrooms are always free.
    // Per-business purchase tracking (owner 2026-07-16): a customers-only
    // restroom unlocks ONLY if you bought something at THAT business this
    // visit — buying at AM/BM must NOT unlock Gas-N-Sip's restroom, etc.
    this._boughtAt = new Set();
    const _sid = String(this._stop?.id ?? '');
    let _h = 0; for (let i = 0; i < _sid.length; i++) _h = (_h * 31 + _sid.charCodeAt(i)) | 0;
    this._restroomGated = (Math.abs(_h) % 2) === 0;
    for (const _k of Object.keys(SECTIONS_PRISTINE)) {
      if (Array.isArray(SECTIONS_PRISTINE[_k])) SECTIONS[_k].items = [...SECTIONS_PRISTINE[_k]];
    }
    SECTIONS.vices.items = [...SECTIONS.vices.items, restroomItem(true)];
    SECTIONS.ambm.items  = [...viceItems(this.registry?.get?.('viceUnlocks')), restroomItem(true)];

    // ── GAS section: dynamic pricing ─────────────────────────────────
    // Refuel cost = missing miles × $0.333.  Pre-tax preview;
    // robbery roll happens on confirm.
    const _missingMi = Math.max(0, this._gasMaxMi - this._gasMi);
    // Per-gallon price DRIFTS along the trip (±14%, deterministic per stop —
    // hash of the stop id) around the base economy ($0.50/mi at 30 mpg =
    // $15/gal base).  Shown to the penny; total = gallons × price.
    const _basePerGal = GAS_USD_PER_MI * 30;
    let _gh = 0; const _gsid = String(this._stop?.id ?? 'x');
    for (let i = 0; i < _gsid.length; i++) _gh = (_gh * 33 + _gsid.charCodeAt(i)) | 0;
    const _perGal = Math.round(_basePerGal * (1 + (((Math.abs(_gh) % 29) - 14) / 100)) * 100) / 100;
    // Display gallons needed, rounded UP to the nearest 1/4 gal.
    const _galRaw     = _missingMi / 30;
    const _galDisplay = Math.ceil(_galRaw * 4) / 4;
    const _refuelCost = Math.max(1, Math.round(_galDisplay * _perGal));
    const gasItems = [];
    // Shared REFUEL item — added to the gas tab AND to Gas-N-Sip / AM/BM below
    // (owner 2026-07-19: those convenience stops pump gas too). ONE object so
    // topping off at any of them disables it at all of them (single-use / tank
    // fills once, per the buy handler that sets item.disabled).
    const refuelItem = (_missingMi > 0)
      ? { id: 'refuel', label: '⛽  REFUEL', cost: _refuelCost,
          desc: `${_galDisplay} gal @ $${_perGal.toFixed(2)}/gal`,
          payload: { refuel: true, refuelMi: _missingMi } }
      : { id: 'refuel', label: '⛽  TANK FULL', cost: 0,
          desc: 'No refuel needed.', payload: {} };
    gasItems.push(refuelItem);

    // ── Pint of oil — knocks 5% off the engine heat (2026-07-16). ──
    gasItems.push({
      id: 'oil_710', label: '🛢  ADD PINT OF OIL',
      cost: 20,
      desc: 'Reduces engine heat by 5%.',
      payload: { coolEngineFrac: 0.05 },
    });

    gasItems.push(waterItem(10));   // bottled water, $10 at every gas vendor (owner 2026-07-19)
    SECTIONS.gas.items = gasItems;

    // Gas-N-Sip (vices) and AM/BM pump gas too (owner 2026-07-19): give both the
    // SAME refuel item as the gas tab, plus a $10 water, at the top of their
    // menu, so the player can fill up (and grab a bottle) at those convenience-
    // store stops. Built here (after the fuel cost is known) since the vices/ambm
    // item lists were assembled earlier.
    SECTIONS.vices.items = [refuelItem, waterItem(10), ...(SECTIONS.vices.items ?? [])];
    SECTIONS.ambm.items  = [refuelItem, waterItem(10), ...(SECTIONS.ambm.items  ?? [])];

    // (CarGo removed 2026-07-29 — its hitchhiker offer was a mile-gated
    // DUPLICATE of the one AOK Camp already carries unconditionally, see
    // SECTIONS.camp's 'hitch' item above. Nothing to relocate: any stop
    // with a Camp tile still offers a rider, same as before CarGo existed.)

    // ── PARK & RIDE: a free public restroom stop. ──
    SECTIONS.parkride.items = [restroomItem(false, 'Nasty, but free.')];

    // (DEALER_CARS removed 2026-07-19 — no car sales; the Dealer tile opens
    // ACCESSORIES/upgrades directly. See the `dealer` tile handler.)

    // ── DEALER_ACC: per-vehicle accessory shop ──────────────────────
    // Repair + Paint are always available.  Bumper, Traction, and NOS
    // are filtered against the CURRENT vehicle's accessory state so
    // already-installed items disappear (and NOS shows the next tier's
    // price + a tier indicator).
    const _save = this.registry?.get?.('save');
    // ── Radar detector — buy-once GLOBAL gadget, sold in the HUNTING shop ──
    // Inject the item when unowned; remove it once bought so it can't be
    // re-purchased.  Idempotent against the module-level SECTIONS object.
    {
      const _hasRadar  = !!_save?.get?.('radarDetector', false);
      const _huntItems = SECTIONS.hunting?.items;
      if (_huntItems) {
        const _present = _huntItems.some(it => it.id === 'radar');
        if (_hasRadar && _present) {
          SECTIONS.hunting.items = _huntItems.filter(it => it.id !== 'radar');
        } else if (!_hasRadar && !_present) {
          _huntItems.push({
            id: 'radar', label: '📡  RADAR DETECTOR', cost: 1500,
            desc: 'Buy once — beeps + flashes before every speed trap, in any car',
            payload: { radar: true },
          });
        }
      }
    }
    const _accAll = _save?.get?.('accessories') ?? {};
    const _vAcc   = _accAll[this._vehicleId] ?? {};
    const _vHasBumper   = !!_vAcc.bumper;
    const _vHasTraction = !!_vAcc.traction;
    const _vNosTier     = Math.max(0, Math.min(3, _vAcc.nos ?? 0));
    const NOS_PRICES = [5000, 10000, 15000];

    // ── The two garages (owner 2026-07-28) ───────────────────────────────
    // Everything below used to pile into one dealer_acc list, which meant the
    // car DEALERSHIPS sold tyres and paint.  Items now route to whichever shop
    // would really carry them; the dealerships go back to selling cars.
    const schwastedItems = [];   // Les Schwasted — tyres / brakes / suspension
    const fapItems = [];   // Finesse (FAP) — body / performance / paint
    // Sam's Used Car Kingdom accessories (owner 2026-07-30): windshield,
    // headlights, wipers, bumper at their entry (Level 1) tier — a small,
    // budget parts counter for the used-car dealer, distinct from the two
    // full garages. Delivered through the shared dealer_acc screen, keyed
    // per-visit to whichever dealer tile was actually tapped (see the
    // 'suck' tile handler below) so Lord Motors stays pure car sales.
    const samItems = [];

    // Les Schwab's free popcorn and water, which is the whole joke.  Popcorn
    // is a genuine (if pitiful) repair: 1% of MAX health per serving, capped
    // at POPCORN_MAX_PCT per visit, so it's a top-up between stops and never
    // a substitute for a real repair.  Cost 0 — the cap is the limiter.
    const _repairMissingHp = Math.max(0,
      Math.ceil(this._vehMaxHp() - (this._durabilityAtEntry ?? this._vehMaxHp())));
    fapItems.push(
      { id: 'repair',  label: _repairMissingHp > 0 ? '🔧  REPAIR CAR' : '✓  NO REPAIRS NEEDED',
        cost: _repairMissingHp * 80,
        desc: _repairMissingHp > 0
          ? `Restore ${_repairMissingHp} HP to full health ($80 per HP).`
          : 'Car is already at full health.',
        disabled: _repairMissingHp === 0,
        disabledReason: 'Car is already at full health.',
        payload: { repair: true } },
      { id: 'paint',   label: '🎨  PAINT JOB',  cost: 3500,
        desc: 'Drops ALL stars — only way out from under a 5★ chopper.',
        payload: { clearStars: true } },
      // Stocked at every Finesse, list price $40. The Shade-Tree Mechanic
      // outside Ellensburg quotes $25 for the same jug — he doesn't sell it
      // to you, he reprices this row (see _applyStoreOffer).
      { id: 'coolant', label: '🧊  COOLANT TOP-OFF', cost: 40,
        desc: 'Drops engine temperature before the shadeless run east.',
        payload: { coolEngine: 55 } },
    );
    schwastedItems.push(
      { id: 'popcorn', label: '🍿  FREE POPCORN', cost: 0,
        desc: `Complimentary. +1% health a serving, up to +${Math.round(POPCORN_MAX_PCT * 100)}% a visit.`,
        payload: { popcorn: true, survivalDelta: { fullness: 4 } } },
      { ...waterItem(0), label: '💧  FREE WATER',
        desc: 'Complimentary. A small Drinks top-up.' },
      // A tire shop sells tire chains — list price $200 at every Les Schwasted.
      // The Chain Guy at North Bend is the counter guy on his break: he quotes
      // $150, or $120 if you haggle him down, and that reprices THIS row.
      { id: 'chains', label: '⛓  SNOW CHAINS', cost: 200,
        desc: 'Grip for the pass. Put them on before the snow, not after.',
        payload: { encounterBuff: 'snow_chains' } },
    );
    // NOS — now a THREE-ROW LADDER under the ENGINE tab (owner 2026-08-04),
    // matching how the tiered part-slots list below.  It used to be a single
    // "next tier" row with its price frozen at scene-build time AND no
    // post-purchase disable, so tapping "LV 1" three times in one visit bought
    // tier 3 for $15k instead of $30k.  One row per tier kills that: each row
    // names the exact tier it installs (payload.nosTier), owned tiers are
    // inert, and tiers past the next one are locked until their predecessor is
    // in.  `category: 'engine'` files it with the other go-fast parts (same
    // trick the traction tyres use to sit under TIRES).
    for (let _t = 1; _t <= 3; _t++) {
      const _owned  = _t <= _vNosTier;
      const _locked = _t > _vNosTier + 1;
      const _buyLbl = `⚡  NOS UPGRADE — LV ${_t}`;
      const _ownLbl = `✓  NOS UPGRADE — LV ${_t}`;
      fapItems.push({
        id: `nos_${_t}`,
        label: _owned ? _ownLbl : _locked ? `🔒  NOS UPGRADE — LV ${_t}` : _buyLbl,
        _buyLabel: _buyLbl, _ownedLabel: _ownLbl,
        cost: NOS_PRICES[_t - 1],
        desc: `+5 mph cruise & boost (total +${_t * 5}).`,
        category: 'engine', icon: 'garage_ico_engine',
        slot: 'nos', lvl: _t,
        disabled: _owned || _locked, _locked,
        disabledReason: _owned ? '✓ Already installed on this car.'
                               : `🔒 Install NOS LV ${_t - 1} first.`,
        showCost: _locked,                          // locked rows still quote a price
        disabledCostText: _owned ? 'OWNED' : undefined,
        payload: _owned ? {} : { vehicleAccessory: 'nos', nosTier: _t },
      });
    }
    if (!_vHasBumper) {
      const _bumperItem = {
        id: 'armor', label: '🛡  REINFORCED BUMPER', cost: 4000,
        desc: 'Take 20% less crash damage on this vehicle.',
        payload: { vehicleAccessory: 'bumper' },
      };
      fapItems.push(_bumperItem);
      // Sam's carries it too (owner 2026-07-30) — same part, same price;
      // it's not a tiered slot so there's no separate "Level 1" price point
      // to invent. Separate object: a purchase mutates the row's
      // disabled/receipt state, and the two rows must not share one.
      samItems.push({ ..._bumperItem, payload: { ..._bumperItem.payload } });
    }
    if (!_vHasTraction) {
      schwastedItems.push({
        id: 'traction', label: '❄️  TRACTION TIRES', cost: 1500,
        desc: '−40% slide penalty on any car (−100% with 4x4).',
        // category: 'tires' (owner 2026-07-29) — this is a legacy accessory
        // item, never given a toolbar category, so it fell into the
        // uncategorized-=-always-visible bucket meant for genuine
        // cross-category services (popcorn/water/repair). Being a TIRE
        // product that persisted under every tab — including BRAKES — is
        // exactly what read as "the tabs don't filter anything."
        category: 'tires',
        payload: { vehicleAccessory: 'traction' },
      });
    }
    // ── Slot part-upgrades (owner 2026-07-21): the CAR SHOP is now the ONLY
    // place to BUY tiered part-upgrades (tires / brakes / engine / …). The
    // phone Garage is read-only (browse tiers + "save for" goals). Buying
    // installs into the save and spends the single rest-stop wallet
    // (this._score), so the old dual-wallet double-spend is gone. Cost carries
    // the same genre discount the garage used to apply (see _repairMult below).
    //
    // FULL LADDER (owner 2026-08-04): every slot lists ALL of its tiers, not
    // just the next one.  Listing one row per category made each tab look
    // empty and hid the price of what you were saving toward.  Rows read:
    //   ✓ owned      inert, priced "OWNED"
    //   🔩 next       the one buyable tier
    //   🔒 locked     priced, but needs its predecessor installed first
    // Buying a tier flips it to ✓ and unlocks the row below it in place — see
    // _unlockTier.
    {
      const _installed = getInstalled(_save, this._vehicleId);
      for (const _slot of UPGRADE_SLOTS) {
        const _tiers = getSlotTiers(_slot);
        if (!_tiers.length) continue;
        const _curId  = _installed[_slot];
        const _curLvl = _curId ? (_tiers.find(t => t.id === _curId)?.level ?? 0) : 0;
        const _slotLbl = (SLOT_LABELS[_slot] ?? _slot).toUpperCase();
        // Which shop stocks this part is decided by its TOOLBAR CATEGORY, so
        // the tabs and the inventory can never disagree.  Untabbed slots
        // (body, police) fall through to Finesse as flat services.
        const _cat  = categoryForSlot(_slot);
        // The ladder is a TAB feature.  Untabbed slots (body, police) render as
        // uncategorized SERVICES, which _selectGarageCategory pins to the top of
        // every tab — laddering them would stack 6 permanent rows above the
        // parts you actually opened the tab for.  They keep the next-tier-only
        // listing until the toolbar art grows BODY / POLICE tabs of their own.
        const _rungs = _cat ? _tiers : _tiers.filter(t => t.level === _curLvl + 1);
        for (const _tier of _rungs) {
          const _owned  = _tier.level <= _curLvl;
          const _locked = _tier.level >  _curLvl + 1;
          const _prev   = _tiers.find(t => t.level === _tier.level - 1);
          const _buyLbl = `🔩  ${_slotLbl} — ${_tier.label}`;
          const _ownLbl = `✓  ${_slotLbl} — ${_tier.label}`;
          const _item = {
            id: `up_${_slot}_${_tier.level}`,
            label: _owned ? _ownLbl : _locked ? `🔒  ${_slotLbl} — ${_tier.label}` : _buyLbl,
            _buyLabel: _buyLbl, _ownedLabel: _ownLbl,
            cost: _tier.cost,
            desc: (_tier.desc ?? '') + (_tier.tradeoff ? `  ⚠ ${_tier.tradeoff}` : ''),
            lvl: _tier.level,   // read by _applyDealerTierGate (level-3 gate)
            slot: _slot,
            category: _cat?.id ?? null,   // drives the toolbar tab
            // Row thumbnail — the same 1254px hero shot the toolbar tab uses,
            // scaled down by _makeButton's existing icon path.  Untabbed slots
            // (body, police) have no category and fall back to their emoji.
            icon: _cat?.icon ?? undefined,
            disabled: _owned || _locked, _locked,
            disabledReason: _owned
              ? '✓ Already installed on this car.'
              : `🔒 Install ${_prev?.label ?? 'the previous tier'} first.`,
            showCost: _locked,                        // locked rows still quote a price
            disabledCostText: _owned ? 'OWNED' : undefined,
            // An owned row carries NO install payload: it must never charge, and
            // _applyDealerTierGate keys off payload.upgradeInstall, so a bought
            // level 3 can't be re-gated back into "Lord Motors exclusive".
            payload: _owned ? {} : { upgradeInstall: _tier.id },
          };
          // The two garages split the catalog by lane (SHOP_CATEGORIES); the
          // untabbed slots fall through to Finesse. Use separate row objects
          // because a purchase mutates the row's disabled/receipt state.
          if (_cat && SHOP_CATEGORIES.les_schwasted.includes(_cat.id)) {
            schwastedItems.push({ ..._item, payload: { ..._item.payload } });
          }
          if (!_cat || (_cat && SHOP_CATEGORIES.fap.includes(_cat.id))) {
            fapItems.push({ ..._item, payload: { ..._item.payload } });
          }
          // Sam's Used Car Kingdom (owner 2026-07-30): windshield, headlights,
          // wipers — Level 1 only. These three are single-tier slots (no
          // ladder past level 1 at all — see the à-la-carte comment on
          // UPGRADE_SLOTS), so the level check is really "the entry tier."
          if (['windshield', 'headlights', 'wipers'].includes(_slot) && _tier.level === 1) {
            samItems.push({ ..._item, payload: { ..._item.payload } });
          }
        }
      }
    }
    SECTIONS.schwasted.items = schwastedItems;
    SECTIONS.fap.items = fapItems;
    SECTIONS.sam_acc.items = samItems;
    // Lord Motors stays pure car sales.
    SECTIONS.dealer_acc.items = [];
    // Genre-car showroom — same catalog at every dealership (owner 2026-07-23).
    SECTIONS.dealer_cars.items = genreCarItems();

    // ── Per-shop vice menus (gated by pickupCounts on registry) ────
    // Each shop keeps its base items + appends the vices it sells (only
    // for vices the player has already sampled on the road).
    const _pickupCounts = this.registry.get('vicePickupCounts')
      ?? this._vicePickupCounts ?? {};
    SECTIONS.gas.items     = [...SECTIONS.gas.items,     ...shopViceItems('gas',     _pickupCounts)];
    // Cowbellas (hunting) sells hunting GEAR only — no food/vices (owner
    // 2026-07-16). Base items (Diesel Tune, Fireworks, Donuts, Passport) stand.
    // Camp repair guard — if the player's HP is already higher than
    // 65 % of this vehicle's max, the "repair to 65 %" purchase would
    // DOWN-tier their HP.  Mark it disabled so it shows "N/A" and the
    // tap returns a friendly status message instead of charging $.
    {
      const _vehMax65    = this._vehMaxHp();
      const _target65    = Math.round(_vehMax65 * 0.65);
      const _hpAtEntry65 = this._durabilityAtEntry ?? _vehMax65;
      SECTIONS.camp.items = SECTIONS.camp.items.map(it => {
        if (it.id !== 'campfix') return it;
        if (_hpAtEntry65 >= _target65) {
          return {
            ...it,
            disabled: true,
            disabledReason: `Already at ${Math.round(_hpAtEntry65)}/${_vehMax65} HP — above the 65 % target.`,
          };
        }
        return it;
      });
    }
    SECTIONS.camp.items    = [...SECTIONS.camp.items,    waterItem(7),    ...shopViceItems('camp',    _pickupCounts)];
    // Campgrounds always have a free restroom.
    SECTIONS.camp.items    = [...SECTIONS.camp.items,    restroomItem(false)];
    // Shop vices used to ride along in dealer_acc; that section is empty now,
    // so they hang off Finesse (the full-service garage you actually wait in).
    SECTIONS.fap.items = [...SECTIONS.fap.items, ...shopViceItems('dealer', _pickupCounts)];

    // ── Background — blue highway services sign ─────────────────────
    // Mimics the real-world blue services placard (the user's reference
    // image): big blue panel with a thick white border, an "EXIT N"
    // tab top-right, and white panel dividers between the four
    // service categories.  Brand-logo placards are rendered per-button
    // by _makeButton.
    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, 0x07111F).setOrigin(0);

    // ── Full-bleed storefront backdrop (owner 2026-07-28) ────────────────
    // One image, retextured per shop in _showSection.  Sits edge to edge with
    // no frame; the shop's menu is drawn over its LEFT THIRD, which is the
    // dead space the storefront art deliberately leaves empty.  Hidden on the
    // landing screen, where the blue highway sign still rules.
    this._shopBg = this.add.image(0, 0, '__DEFAULT').setOrigin(0)
      .setDisplaySize(SCREEN_W, SCREEN_H).setVisible(false);
    // Scrim over the menu column.  Storefronts vary hugely in brightness
    // (Les Schwasted is a night shot, others are daylight), so menu text
    // needs a guaranteed-dark bed rather than luck.
    this._shopScrim = this.add.rectangle(0, 0, Math.round(SCREEN_W / 3), SCREEN_H, 0x050A12, 0.62)
      .setOrigin(0).setVisible(false);

    // Main sign body — services blue.  Stashed so a storefront screen can
    // hide the sign entirely instead of showing a panel on top of a photo.
    this._signBody = this.add.rectangle(20, 18, SCREEN_W - 40, SCREEN_H - 36, 0x1E5BB8).setOrigin(0)
      .setStrokeStyle(4, 0xFFFFFF);
    // Subtle highlight band at the top edge of the sign for depth.
    this._signTopBand = this.add.rectangle(24, 22, SCREEN_W - 48, 4, 0x4789D8).setOrigin(0);
    // EXIT-NUMBER tab — small white-bordered panel sitting OUTSIDE the
    // top-right corner of the main sign, like the reference image.
    {
      // Whole number, nearest mile (owner 2026-07-29) — several stops sit at
      // a half-mile mark (Bellevue 12.5, Mercer Island 9.5) for on-road
      // ramp-placement reasons, but that precision has no business showing
      // up on a highway-sign-style EXIT tab. Rounds only the display; the
      // underlying stop.mileage (used for positioning/progress) is untouched.
      const _exitMile = Math.round(this._stop?.mileage ?? 0);
      const tabW = 130, tabH = 38;
      const tabX = SCREEN_W - 30 - tabW;
      const tabY = 0;
      this.add.rectangle(tabX, tabY, tabW, tabH, 0x1E5BB8).setOrigin(0)
        .setStrokeStyle(3, 0xFFFFFF);
      this.add.text(tabX + tabW / 2, tabY + tabH / 2, `EXIT ${_exitMile}`, {
        fontSize: '20px', fontFamily: IMPACT,
        color: '#FFFFFF', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // ── Title ────────────────────────────────────────────────────────────
    // Landing shows the LOCATION; shop sub-screens swap in the shop's
    // brand name (see _showSection / _showDealerChooser / _showLanding).
    this._titleText = this.add.text(CX, 30, `${this._stop.name.toUpperCase()}`, {
      fontSize: '18px', fontFamily: IMPACT,
      color: '#FFEEAA', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // (Portable save codes removed — same-device LAST/SAVED resume still works;
    // cross-device transfer will come from a future account login.)

    // ── Score header ─────────────────────────────────────────────────────
    this._scoreText = this.add.text(SCREEN_W - 30, 60, '', {
      fontSize: '15px', fontFamily: IMPACT, color: '#FFEE00',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0);
    this._refreshScore();

    // ── Car HP — durability remaining vs this vehicle's baseline max, so the
    //    player can see how beat-up the car is before deciding to repair.
    //    Colored green / amber / red by fraction. ──
    {
      const _maxHp   = this._vehMaxHp();
      const _curHp   = Math.round(this._durabilityAtEntry ?? _maxHp);
      const _frac    = _maxHp > 0 ? _curHp / _maxHp : 0;
      const _hpColor = _frac > 0.5 ? '#66FF99' : (_frac > 0.25 ? '#FFCC44' : '#FF5544');
      this.add.text(SCREEN_W - 30, 80, `🔧 HP ${_curHp} / ${_maxHp}`, {
        fontSize: '14px', fontFamily: IMPACT, color: _hpColor,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(1, 0);
    }

    // ── Survival status — compact UNLABELED bars upper-left, below BACK.
    //    Same colors + top→bottom order as the drive HUD (Alertness /
    //    Bladder gradient / Drinks / Food) so they read on recognition. ──
    this._survMiniGfx = this.add.graphics();
    this._drawSurvivalMini();

    // ── Active JOBS ("Favors", Ch. 8) — review commitments before rolling ──
    // Compact left-side list mirroring the HUD chip: destination · miles
    // left · payout · term flags.  Only renders when jobs are active.
    {
      const _missions = this.registry?.get?.('missions');
      const _jobs = _missions?.activeMissions?.() ?? [];
      if (_jobs.length) {
        const _flags = (m) => {
          const f = [];
          if (m.terms?.fragile)    f.push('FRAGILE');
          if (m.deadlineMile != null) f.push(`⏱ ${Math.max(0, m.deadlineMile - this._odometer).toFixed(1)} MI`);
          if (m.deadlineClockSec != null && this._partyClockSec != null) {
            const _s = Math.max(0, Math.floor(this._partyClockSec - m.deadlineClockSec));
            f.push(`RUSH ⏱ ${Math.floor(_s / 60)}:${String(_s % 60).padStart(2, '0')}`);
          } else if (m.terms?.rush) f.push('RUSH');
          if (m.terms?.illegal)    f.push('🚨 HOT');
          if (m.type === 'heat') {
            const _cov = Math.min(m.routeMiles, Math.max(0, this._odometer - (m.acceptedAtMile ?? this._odometer)));
            f.push(`ESCAPE ${_cov.toFixed(1)}/${m.routeMiles} MI · ${this._stars ?? 0}★`);
          }
          if (m.terms?.no_chains)  f.push('NO CHAINS');
          if (m.type === 'passenger' && m.passenger?.quirk) f.push(m.passenger.quirk.toUpperCase().replace('_', '-'));
          return f.length ? ` · ${f.join(' · ')}` : '';
        };
        const _icon = (m) => (m.type === 'passenger' ? '🧍'
          : m.type === 'timed' ? '⚡'
          : m.type === 'heat' ? '🔥'
          : m.type === 'weather' ? (m.terms?.weather_run?.tag === 'wind' ? '🌬' : '🌨')
          : '📦');
        const _lines = _jobs.map((m) => {
          // Challenges carry no destination (targetName/targetMile null) —
          // list them by name with no mileage leg.
          if (m.targetName == null) {
            return `🎯 ${m.missionName ?? 'CHALLENGE'} · $${m.payout.toLocaleString()}${_flags(m)}`;
          }
          const _left = Math.max(0, m.targetMile - this._odometer);
          const _mi   = _left < 10 ? _left.toFixed(1) : String(Math.round(_left));
          return `${_icon(m)} ${m.targetName} · ${_mi} MI · $${m.payout.toLocaleString()}${_flags(m)}`;
        });
        // Lower-RIGHT corner (2026-07-16 owner request), right-aligned,
        // anchored above the REP line.
        this.add.text(SCREEN_W - 30, SCREEN_H - 44, `JOBS\n${_lines.join('\n')}`, {
          fontSize: '11px', fontFamily: IMPACT, color: '#9FE0FF',
          stroke: '#000', strokeThickness: 3, lineSpacing: 3, align: 'right',
        }).setOrigin(1, 1);
      }
      // ── REPUTATION readout (Ch. 8 Phase 6) — per-type tier + progress
      // toward the next rung ("📦 Known 5/8"), matching the payoff popup's
      // REP string.  Compact one-liner under the JOBS block; only types the
      // player has actually worked show, so a fresh save stays clean.
      const _rep = this.registry?.get?.('save')?.get?.('missionRep', {}) ?? {};
      const _repIcon = { delivery: '📦', timed: '⚡', passenger: '🧍', heat: '🔥', weather: '🌨' };
      const _repBits = ['delivery', 'timed', 'passenger', 'heat', 'weather']
        .filter(t => (_rep[t] ?? 0) > 0)
        .map(t => {
          const n    = _rep[t];
          const tier = tierFor(n);
          const next = MISSION_TIERS[MISSION_TIERS.indexOf(tier) + 1];
          return `${_repIcon[t]} ${tier.name} ${next ? `${n}/${next.minDone}` : n}`;
        });
      if (_repBits.length) {
        this.add.text(SCREEN_W - 30, SCREEN_H - 28,
          `REP  ${_repBits.join(' · ')}`, {
            fontSize: '11px', fontFamily: IMPACT, color: '#FFD23D',
            stroke: '#000', strokeThickness: 3, align: 'right',
          }).setOrigin(1, 1);
      }
    }

    // ── NPC vignette — flavor one-liner picked from per-stop pool ──
    const vignette = pickVignette(this._stop?.id);
    if (vignette) {
      // Stacked directly under the big title (y=52) so it can never
      // collide with the section header at contentY-32; narrower wrap
      // keeps it clear of the left survival bars + right CASH/HP stack.
      this.add.text(SCREEN_W / 2, 52, `“${vignette}”`, {
        fontSize: '12px', fontFamily: 'Arial, sans-serif',
        color: '#CCCCCC', stroke: '#000', strokeThickness: 2,
        align: 'center', wordWrap: { width: SCREEN_W - 300 },
      }).setOrigin(0.5, 0);
    }

    // ── READY drop-offs (Ch. 8 explicit collect) ─────────────────────
    // One unmissable gold action button per graded-ready mission, at the
    // TOP of the menu area (the placard grid shifts down to make room).
    // Tapping it pays THAT job (wallet + payoff banner via collect());
    // hitting the road without tapping fails it as 'not_delivered'.
    const _missionsSys = this.registry?.get?.('missions');
    this._readyJobs = _missionsSys?.readyMissions?.(this._stop?.id) ?? [];
    const _readyRowH = 42, _readyGap = 6;
    const _readyBlockH = this._readyJobs.length * (_readyRowH + _readyGap);

    // ── Landing screen — 5 brand-style category placards ──────────────
    // Mimics the highway services sign: each section is a white-bordered
    // placard with the category title + brand name, laid out in a grid
    // inside the blue sign.  Click a placard → drill into its sub-menu.
    const contentY = 110 + _readyBlockH;
    const contentH = SCREEN_H - contentY - 60;
    this._contentX = 40;
    this._contentY = contentY;
    this._contentW = SCREEN_W - 80;
    this._contentH = contentH;

    // Genre-vehicle payout modifiers (owner 2026-07-19): reggaeton passenger
    // fares +30%, k-pop timed on-time +25%, norteño cargo +25%. Published to the
    // registry by GameScene._refreshGenreTrait; ×1 for non-genre vehicles.
    const _gtm = this.registry.get('genreTraitMods') ?? {};
    const _payMultFor = (type) => type === 'passenger' ? (_gtm.passengerPayMult ?? 1)
                                : type === 'timed'     ? (_gtm.timedPayMult ?? 1)
                                : type === 'heat'      ? 1
                                :                        (_gtm.cargoPayMult ?? 1);
    this._readyJobs.forEach((m, i) => {
      const ry    = 110 + i * (_readyRowH + _readyGap);
      // payoutFor() applies the slice-2 pay modifiers (damageDock, speed tip);
      // the genre trait multiplies on top of that.
      const total = Math.round((_missionsSys?.payoutFor?.(m) ?? (m.payout + (m.tip ?? 0))) * _payMultFor(m.type));
      const label = m.type === 'passenger'
        ? `🧍 DROP OFF ${(m.passenger?.name ?? 'PASSENGER').toUpperCase()} — $${total.toLocaleString()}`
        : m.type === 'heat'
          ? `🔥 COLLECT — LOST THE TAIL — $${total.toLocaleString()}`
          : `📦 DROP OFF PACKAGE — $${total.toLocaleString()}`;
      const bg = this.add.rectangle(this._contentX, ry, this._contentW, _readyRowH, 0xFFD23D)
        .setOrigin(0, 0).setStrokeStyle(3, 0xFFFFFF)
        .setInteractive({ useHandCursor: true });
      const lbl = this.add.text(this._contentX + this._contentW / 2, ry + _readyRowH / 2, label, {
        fontSize: '18px', fontFamily: IMPACT, color: '#3A2800',
      }).setOrigin(0.5);
      bg.on('pointerover', () => bg.setFillStyle(0xFFE585));
      bg.on('pointerout',  () => { if (bg.input?.enabled) bg.setFillStyle(0xFFD23D); });
      bg.on('pointerdown', (ptr, _x, _y, ev) => {
        this._eatTap(ptr, ev);
        if (this._tapBlocked(ptr)) return;
        const paid = _missionsSys?.collect?.(m.id);
        if (!paid) return;                       // double-tap / rewind safe
        const pay = Math.round((_missionsSys?.payoutFor?.(paid) ?? (paid.payout + (paid.tip ?? 0))) * _payMultFor(paid.type));
        this._score += pay;
        this._stats?.recordEarn?.(pay, 'mission');
        this._stats?.recordMissionComplete?.(paid.type, pay);
        this._refreshScore();
        // Bank immediately — pulling in is the "safe" moment, and the
        // GameScene entry-bank no longer includes uncollected mission pay.
        if (Difficulty.noScore?.() !== true) {
          { const _sv = this.registry.get('save');
            if (_sv?.walletStore) { _sv.walletStore.money = Math.round(Math.max(0, this._score)); _sv.save?.(); } }
        }
        this._buttonRefresh.forEach(fn => fn());   // shop affordability updates
        bg.disableInteractive().setFillStyle(0x8A7A3A);
        lbl.setText('✓ COLLECTED').setColor('#33301E');
        this._showPayoffBanner(paid);
        // Owner 2026-07-28: the spent bar shouldn't squat over the shop —
        // hold the ✓ COLLECTED receipt for 3 s, then fade it away.
        this.time.delayedCall(3000, () => {
          if (!bg.scene) return;   // scene already torn down (HIT THE ROAD)
          this.tweens.add({
            targets: [bg, lbl], alpha: 0, duration: 450,
            onComplete: () => { bg.destroy(); lbl.destroy(); },
          });
        });
      });
    });

    // Brand logo + label per landing tile, region-aware via brandsForStop.
    const stopBrands = brandsForStop(this._stop);
    // Kept on the scene so sub-screens can title themselves with the
    // shop's brand name (see _shopNameFor).
    this._brands = stopBrands;
    // Filter the landing tiles to only the amenities present at this
    // stop (per the REST_STOPS amenities field).  A camp-only stop now
    // shows just the Camp tile; Pullman shows all 5.  Falls back to
    // showing every tile if the stop doesn't carry an amenities list.
    const stopAmenities = this._stop?.amenities;
    const visibleTabs = Array.isArray(stopAmenities) && stopAmenities.length
      ? TAB_ORDER.filter(k => stopAmenities.includes(k))
      : TAB_ORDER;

    // Layout grid sizes to fit visible tile count (1-5 tiles).  Single-
    // tile stops get a big centered placard; multi-tile stays 3×2.
    const tileN = visibleTabs.length;
    const cols  = tileN <= 1 ? 1 : (tileN <= 4 ? 2 : 3);
    const rows  = Math.ceil(tileN / cols);
    const gap   = 14;
    const cellW = (this._contentW - gap * (cols - 1)) / cols;
    const cellH = (this._contentH - gap * (rows - 1)) / rows;
    this._landingObjs = [];
    visibleTabs.forEach((key, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cx = this._contentX + c * (cellW + gap);
      const cy = this._contentY + r * (cellH + gap);
      const brand = stopBrands[key] ?? { name: key, logo: null };
      // White-bordered placard (Olive Garden / Red Lobster style).
      const card = this.add.rectangle(cx, cy, cellW, cellH, 0xFFFFFF, 1)
        .setOrigin(0, 0).setStrokeStyle(3, 0xFFFFFF)
        .setInteractive({ useHandCursor: true });
      this._landingObjs.push(card);

      // Brand LOGO image — fills most of the placard, leaving room
      // below for the category label.  Falls back to a colored accent
      // strip + brand-name text when the logo asset isn't loaded.
      const logoArea = { x: cx + 3, y: cy + 3, w: cellW - 6, h: Math.round(cellH * 0.80) };
      if (brand.logo && this.textures.exists(brand.logo)) {
        const img = this.add.image(logoArea.x + logoArea.w / 2, logoArea.y + logoArea.h / 2, brand.logo)
          .setOrigin(0.5);
        const tex = this.textures.get(brand.logo).source[0];
        const baseW = tex?.width || logoArea.w;
        const baseH = tex?.height || logoArea.h;
        const k = Math.min(logoArea.w / baseW, logoArea.h / baseH);
        img.setDisplaySize(baseW * k, baseH * k);
        this._landingObjs.push(img);
      } else {
        const accentFor = { gas: 0xFFCC22, hunting: 0x6E3F1A, camp: 0x2E7A35, dealer: 0xCC1122, lord: 0xCC1122, suck: 0x8A5A2B, vices: 0x9A36CC, parkride: 0x1E5BB8, schwasted: 0xC8102E, fap: 0x7A3FA0 };
        const accent = accentFor[key] ?? 0x888888;
        const strip = this.add.rectangle(logoArea.x, logoArea.y, logoArea.w, logoArea.h, accent, 1)
          .setOrigin(0, 0);
        const t = this.add.text(logoArea.x + logoArea.w / 2, logoArea.y + logoArea.h / 2, brand.name, {
          fontSize: '17px', fontFamily: IMPACT, color: '#FFFFFF',
          stroke: '#000', strokeThickness: 3, wordWrap: { width: logoArea.w - 8 }, align: 'center',
        }).setOrigin(0.5);
        this._landingObjs.push(strip, t);
      }

      // Category label on the lower strip of the placard.
      const catLabel = this.add.text(cx + cellW / 2, cy + cellH - Math.round(cellH * 0.12),
        SECTIONS[key].label.replace(/^[^A-Za-z]+/, '').trim(), {
        fontSize: '16px', fontFamily: IMPACT,
        color: '#1E5BB8', stroke: '#FFFFFF', strokeThickness: 2,
      }).setOrigin(0.5);
      this._landingObjs.push(catLabel);

      card.on('pointerover', () => card.setFillStyle(0xF0E8C0));
      card.on('pointerout',  () => card.setFillStyle(0xFFFFFF));
      card.on('pointerdown', (ptr, _x, _y, ev) => {
        this._eatTap(ptr, ev);
        if (this._tapBlocked(ptr)) return;
        // Dealers sell CARS again (owner 2026-07-23 — the genre-car showroom),
        // so a dealer tile opens the Cars/Accessories chooser.  Remember which
        // brand was tapped: headers show it, and Sam's caps parts at level 2
        // (level 3 is Lord Motors exclusive).
        if (key === 'dealer' || key === 'lord' || key === 'suck') {
          this._activeDealerBrand = stopBrands[key]?.name ?? null;
          this._activeDealerKey   = key;
          this._applyDealerTierGate();
          this._showShopGreeter(key, () => this._showDealerChooser());
        } else {
          this._showShopGreeter(key, () => this._showSection(key));
        }
      });
    });

    // ── Sub-menus — built once, hidden until a placard is clicked ────
    // Each section's items live in a Phaser Container with a geometry
    // mask so long lists (DEALER) scroll INSIDE the sign instead of
    // bleeding past the border.  Includes dealer_acc and dealer_cars
    // (the two screens the DEALER chooser drills into).
    this._sectionContainers = {};
    this._sectionScroll     = {};
    this._sectionContentH   = {};
    for (const key of ALL_SECTIONS) {
      // Skip the chooser's own placeholder section (no items).
      if (key === 'dealer') continue;
      const container = this.add.container(0, 0).setVisible(false);
      const items = this._buildTabContent(key, this._contentX, this._contentY, this._contentW, this._contentH);
      for (const obj of items) {
        if (obj && obj.setVisible) obj.setVisible(true);
        container.add(obj);
      }
      // Mask must match the SAME rect the content was laid out in, or a
      // storefront shop's left-third column gets clipped by the sign's geometry.
      const _mr = this._contentRectFor(key);
      const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
      maskGfx.fillStyle(0xFFFFFF);
      maskGfx.fillRect(_mr.x - 4, _mr.y - 4, _mr.w + 8, _mr.h + 8);
      container.setMask(maskGfx.createGeometryMask());
      this._sectionContainers[key] = container;
      this._sectionScroll[key]     = 0;
      const itemCount = SECTIONS[key].items.length;
      const colsK = FULL_BLEED.has(key) ? 1 : ((key === 'vices' || itemCount > 6) ? 2 : 1);
      const rowsK = Math.ceil(itemCount / colsK);
      const itemH = FULL_BLEED.has(key)
        ? 52
        : Math.min(56, Math.max(30, (this._contentH - (rowsK - 1) * 6) / rowsK));
      this._sectionContentH[key] = rowsK * (itemH + 6) - 6;
    }

    // ── Garage category toolbar ──────────────────────────────────────
    // ONE 1672x220 strip holding seven tabs with their labels baked in, so it
    // gets sliced into seven equal frames rather than needing seven files.
    // Frame order is GARAGE_CATEGORIES order — see the warning on that array.
    this._garageTabs = [];
    if (this.textures.exists('ui_garage_toolbar')) {
      const _tex  = this.textures.get('ui_garage_toolbar');
      const _srcW = _tex.source[0].width, _srcH = _tex.source[0].height;
      const _tabW = _srcW / GARAGE_CATEGORIES.length;
      GARAGE_CATEGORIES.forEach((cat, i) => {
        const _fk = `tab_${cat.id}`;
        if (!_tex.has(_fk)) _tex.add(_fk, 0, Math.round(i * _tabW), 0, Math.round(_tabW), _srcH);
        const img = this.add.image(0, 0, 'ui_garage_toolbar', _fk)
          .setOrigin(0, 0).setVisible(false)
          .setInteractive({ useHandCursor: true });
        img.on('pointerdown', (ptr, _x, _y, ev) => {
          this._eatTap(ptr, ev);
          if (this._tapBlocked(ptr)) return;
          this._selectGarageCategory(this._activeSection, cat.id);
        });
        this._garageTabs.push({ cat, img });
      });
    }

    // ── DEALER chooser — two big tiles: Cars / Accessories ──────────
    this._dealerChooserObjs = [];
    {
      const tileW = (this._contentW - 14) / 2;
      const tileH = this._contentH * 0.6;
      const tileY = this._contentY + (this._contentH - tileH) / 2;
      const choices = [
        { key: 'dealer_cars', title: 'CARS',        sub: stopBrands.dealer.name, color: 0x1E5BB8 },
        // 'Repair · Paint · Tires' was stale — that content moved to the two
        // garages back on 2026-07-21 and dealer_acc sold nothing at all
        // until today.  This tile is built ONCE (not per-dealer), so it
        // can't safely claim contents that differ between Lord Motors
        // (still empty) and Sam's (Level 1 parts) — kept generic rather
        // than overclaiming either way.
        { key: 'dealer_acc',  title: 'ACCESSORIES', sub: 'Parts & Extras', color: 0x4A6E3F },
      ];
      choices.forEach((ch, i) => {
        const tx = this._contentX + i * (tileW + 14);
        const card = this.add.rectangle(tx, tileY, tileW, tileH, 0xFFFFFF, 1)
          .setOrigin(0, 0).setStrokeStyle(3, 0xFFFFFF)
          .setInteractive({ useHandCursor: true });
        const strip = this.add.rectangle(tx, tileY, tileW, Math.round(tileH * 0.55), ch.color, 1)
          .setOrigin(0, 0);
        const lbl = this.add.text(tx + tileW / 2, tileY + Math.round(tileH * 0.27), ch.title, {
          fontSize: '32px', fontFamily: IMPACT,
          color: '#FFFFFF', stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5);
        const sub = this.add.text(tx + tileW / 2, tileY + Math.round(tileH * 0.78), ch.sub, {
          fontSize: '14px', fontFamily: IMPACT,
          color: '#222222', stroke: '#FFFFFF', strokeThickness: 2,
        }).setOrigin(0.5);
        card.on('pointerover', () => card.setFillStyle(0xF0E8C0));
        card.on('pointerout',  () => card.setFillStyle(0xFFFFFF));
        card.on('pointerdown', (ptr, _x, _y, ev) => {
          this._eatTap(ptr, ev);
          if (this._tapBlocked(ptr)) return;
          // ACCESSORIES routes to Sam's own dedicated section when Sam's is
          // the active dealer — dealer_acc and sam_acc are genuinely
          // separate SECTIONS entries (see the sam_acc definition), not one
          // shared screen, because content is built once per section at
          // scene creation and can't differ by which dealer tile was tapped.
          const _dest = (ch.key === 'dealer_acc' && this._activeDealerKey === 'suck')
            ? 'sam_acc' : ch.key;
          this._showSection(_dest, /* parent: */ 'dealer');
        });
        // CARS tile subtitle re-brands to whichever dealer placard was tapped.
        if (ch.key === 'dealer_cars') this._dealerCarsSubLbl = sub;
        this._dealerChooserObjs.push(card, strip, lbl, sub);
      });
      for (const o of this._dealerChooserObjs) o.setVisible(false);
    }

    // ── BACK button (shown only on sub-menus) ────────────────────────
    // Moved to the top-LEFT corner (x=10, y=8) so it stops covering the
    // SAVE CODE / code text just below.  Section header still sits at
    // contentY - 32 since it belongs visually with the sub-menu content.
    {
      const bx = 8, by = 6;
      const headerY = contentY - 32;
      // Bigger target + padded hit area (owner 2026-08-05: "back button
      // ignores my tap, worse in some storefronts").  The old 80×26 box was
      // ~39×13 pt once the 800-wide design scales onto a phone — under half
      // Apple's 44 pt minimum, jammed in the corner nearest the status bar.
      // Visual box is 112×32; the INPUT rect pads ~12 px beyond it on every
      // side (rectangle hit areas are in local space, so negative x/y reach
      // outside the drawn box).  High depth so full-bleed shop art built
      // later in the display list can never sit over it — that stacking is
      // why some storefronts felt worse than others.
      this._backBtnBg = this.add.rectangle(bx, by, 112, 32, 0xFFFFFF, 1)
        .setOrigin(0, 0).setStrokeStyle(2, 0x000000)
        .setInteractive(new Phaser.Geom.Rectangle(-12, -8, 136, 52),
                        Phaser.Geom.Rectangle.Contains)
        .setDepth(60)
        .setVisible(false);
      this._backBtnBg.input.cursor = 'pointer';
      this._backBtnLbl = this.add.text(bx + 56, by + 16, '← BACK', {
        fontSize: '16px', fontFamily: IMPACT, color: '#1E5BB8',
      }).setOrigin(0.5).setDepth(61).setVisible(false);
      Metal.ensureNoise(this);
      this._backMetal = Metal.dress(this, this._backBtnBg,
        { tone: 'neutral', chamfer: 5, labels: [this._backBtnLbl] });
      this._backBtnLbl.setColor(Metal.TONE.neutral.text);
      // dress() paints immediately, but BACK starts hidden and is toggled by
      // _popScreen — the skin has to follow it or it lingers over the landing
      // screen as a floating plate.
      this._backMetal.gfx.setVisible(false);
      this._backBtnBg.on('pointerdown', (ptr, _x, _y, ev) => {
        this._eatTap(ptr, ev);
        if (this._tapBlocked(ptr)) return;
        this._popScreen();
      });
      // Section header text — repurposed when a sub-menu opens.
      this._sectionHeader = this.add.text(this._contentX + this._contentW / 2, headerY + 13, '', {
        fontSize: '15px', fontFamily: IMPACT,
        color: '#FFFFFF', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setVisible(false);
    }

    // ── Wheel + drag scroll for sub-menus ────────────────────────────
    this.input.on('wheel', (_p, _go, _dx, dy) => {
      if (!this._activeSection) return;
      this._scrollSection(this._activeSection, dy * 0.5);
    });
    let dragStartY = null;
    this.input.on('pointerdown', (ptr) => {
      if (!this._activeSection) return;
      // Only start drag if the press lands in the content area.
      if (ptr.x < this._contentX || ptr.x > this._contentX + this._contentW) return;
      if (ptr.y < this._contentY || ptr.y > this._contentY + this._contentH) return;
      dragStartY = ptr.y;
      this._dragStartScroll = this._sectionScroll[this._activeSection] ?? 0;
    });
    this.input.on('pointermove', (ptr) => {
      if (dragStartY == null || !this._activeSection) return;
      if (!ptr.isDown) { dragStartY = null; return; }
      const dy = ptr.y - dragStartY;
      this._setSectionScroll(this._activeSection, this._dragStartScroll - dy);
    });
    this.input.on('pointerup', () => { dragStartY = null; });

    this._showLanding();

    // ── HIT THE ROAD button ─────────────────────────────────────────────
    // This is a landing-screen action. Shop sub-screens hide it so their
    // category toolbar can use the full bottom edge; BACK returns here.
    const contY = SCREEN_H - 30;
    this._continueBtnBg = this.add.rectangle(CX, contY, 240, 36, 0x44AA44)
      .setStrokeStyle(3, 0xFFFFFF)
      .setInteractive({ useHandCursor: true });
    this._continueBtnLbl = this.add.text(CX, contY, '▶  HIT THE ROAD', {
      fontSize: '17px', fontFamily: IMPACT,
      color: '#FFFFFF', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    // Metal skin. The rectangle above stays the hit area — only its fill is
    // dropped — so the _eatTap / _tapBlocked path below is untouched.
    Metal.ensureNoise(this);
    Metal.dress(this, this._continueBtnBg, { tone: 'go', labels: [this._continueBtnLbl] });
    this._continueBtnLbl.setColor(Metal.TONE.go.text);
    this._continueBtnBg.on('pointerdown', (ptr, _x, _y, ev) => {
      this._eatTap(ptr, ev);
      if (this._tapBlocked(ptr)) return;
      this._continue();
    });

    // ── Status line ─────────────────────────────────────────────────────
    this._statusText = this.add.text(CX, SCREEN_H - 118, '', {
      fontSize: '34px', fontFamily: 'Arial', color: '#88FF88',
      align: 'center', wordWrap: { width: SCREEN_W - 60 },
    }).setOrigin(0.5);

    // Keyboard shortcuts
    this.input.keyboard?.once('keydown-ENTER', () => this._continue());
    this.input.keyboard?.once('keydown-SPACE', () => this._continue());

    // Roguelite character encounter — pops a portrait card over the shop on
    // arrival (guaranteed intro on first visit; chance thereafter).
    this._maybeShowEncounter();
  }

  // ── Rest-stop character encounters ──────────────────────────────────────
  /** Decide whether to surface an encounter card, then show it. */
  _maybeShowEncounter() {
    const save   = this.registry.get('save');
    const stopId = this._stop?.id;
    if (!stopId) return;
    // Rotating town fact for THIS visit — cycles through the town's 3-5 facts
    // (owner 2026-07-17) so pulling in repeatedly doesn't show the same line.
    // Shown on whatever card appears (welcome NPC or the job/mission card),
    // so every stop — even ones with no NPC encounter — surfaces a fact.
    this._townFact = nextTownFact(stopId, save);
    const visited    = new Set(save?.get?.('stopsVisited', []) ?? []);
    const firstVisit = !visited.has(stopId);
    if (firstVisit) { visited.add(stopId); save?.set?.('stopsVisited', [...visited]); }
    // Mission ("Favors") contact — every stop carries side work (Ch. 8;
    // Pullman is payoff-only, gated inside offersForStop).  Queued but NOT
    // shown on arrival: reachable ONLY by finding this stop's mission shop
    // (owner 2026-07-30 — see _missionShopKeyFor / _showShopGreeter; the old
    // automatic HIT THE ROAD pitch is gone), so any job COMPLETED here first
    // still frees its type slot for a re-take before the player goes looking.
    // Custom mode used to switch missions OFF entirely, which made the whole
    // system unreachable in the exact mode it gets playtested in.  It now runs
    // there; MissionSystem just refuses to bank rep or lifetime stats from a
    // sandbox run (owner 2026-07-30).
    this._pendingMissionCard = true;
    // First visit → guaranteed welcome intro; later visits → 60% chance.
    if (!firstVisit && Math.random() > 0.60) return;
    const seen = new Set(save?.get?.('encountersSeen', []) ?? []);
    const enc  = pickEncounterForStop(stopId, {
      firstVisit,
      seenIds: seen,
      mile:    this._odometer ?? 0,
      heat:    this._stars ?? 0,
    });
    if (enc) {
      // Remember the welcome NPC so the mission contact (found in their shop,
      // if the player goes looking) can pick a DIFFERENT face — owner
      // 2026-07-26: "another NPC", not the one who already greeted you here.
      this._welcomeNpc = { portrait: enc.portrait, speaker: enc.speaker };
      this._showEncounterCard(enc, save, seen);
    }
    // No welcome encounter this visit → nothing to show now; the mission
    // contact is still waiting in their shop for whoever goes looking.
  }

  // (The old HIT THE ROAD exit-mission pitch — _tryExitMissionCard — was
  // REMOVED 2026-07-30, owner directive: "if people wanna do missions, they
  // can go to the different shops and talk to the NPCs. And if they don't,
  // they can hit the road." Missions are now ONLY reachable by finding the
  // stop's mission shop (_missionShopKeyFor / _showShopGreeter) — hitting the
  // road is a clean, uninterrupted exit whether or not you found it.
  // _buildMissionEncounter() is UNCHANGED and still used by that shop path;
  // only the automatic exit interruption is gone.)

  /** Synthesize a Phase-1 dialogue-tree card from this stop's persisted
   *  mission offers — the ask · the destination · the catch · the money —
   *  with accept / decline / polite-exit choices.  Returns null when the
   *  stop has no open offers left (accepted/declined stay resolved for the
   *  run — offers are persisted, no reroll on re-entry). */
  _buildMissionEncounter(missions) {
    const stopId = this._stop?.id;
    // Conditional-offer context (Ch. 8 Phase 5): heat-escape jobs spawn only
    // while the player is wearing 2+ stars; the authored weather-corridor
    // contracts spawn only at their start stop while the hazard is live
    // (pass = weather enabled on this difficulty; Vantage wind always blows).
    const offers = missions.offersForStop(stopId, {
      stars:     this._stars ?? 0,
      weatherOk: !!Difficulty.weather?.(),
      windOk:    true,
    }) ?? [];
    const open   = offers.filter(o => o.status === 'offered');
    if (!open.length) return null;
    // A SEPARATE contact from the welcome NPC pitches the job on the way out
    // (owner 2026-07-26: "another NPC" approaches you as you leave).  Hash-pick
    // a stable face per stop; if it collides with the welcome NPC's face, step
    // to the next so it visibly reads as a different person.
    const portraits = ['long_haul_mike', 'tow_driver', 'farm_worker', 'street_weirdo'];
    let h = 0; for (let i = 0; i < String(stopId).length; i++) h = (h * 31 + String(stopId).charCodeAt(i)) | 0;
    let portrait = portraits[Math.abs(h) % portraits.length];
    if (this._welcomeNpc?.portrait && portrait === this._welcomeNpc.portrait) {
      portrait = portraits[(Math.abs(h) + 1) % portraits.length];
    }
    const npcName  = open[0].npcName ?? 'Shady Contact';

    // "The catch" line per offer, from its terms.
    const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const termLine = (o) => {
      const t = [];
      if (o.terms?.fragile)    t.push(`it's FRAGILE — over ${o.terms.fragile.maxDamage} HP of crash damage and it's trash`);
      if (o.terms?.perishable) t.push("it's PERISHABLE — dawdle and it spoils");
      if (o.terms?.illegal)    t.push("cops can't see it — heat comes down HARDER while you're carrying");
      if (o.terms?.rush)       t.push(`it's a RUSH — ${mmss(o.terms.rush.budgetSec)} on the clock from the second you say yes`);
      if (o.terms?.weather_run) t.push(o.terms.weather_run.tag === 'wind'
        ? 'the Vantage wind is HOWLING the whole way'
        : 'the pass is a mess — rain into snow, all of it');
      if (o.terms?.no_chains)  t.push("the DARE: no chains — strap them on and the deal's dead");
      if (o.terms?.chain)      t.push(`it's a hand-off — the next ${o.terms.chain.label} takes it, wherever that lands`);
      if (o.terms?.noEating)   t.push("you don't touch it — eat or drink ANYTHING on the road and it's void");
      if (o.terms?.pacifist)   t.push('a quiet run — fire so much as one thing and the deal is dead');
      if (o.terms?.speedFloor) t.push(`don't crawl — under ${o.terms.speedFloor.mph} mph for long and it's ruined`);
      if (o.terms?.speedCap)   t.push(`don't push it — over ${o.terms.speedCap.mph} mph for long and the load's gone`);
      if (o.terms?.fuelFloor)  t.push(`roll in with the tank still over ${o.terms.fuelFloor.pct}%`);
      if (o.terms?.alertFloor) t.push(`get them there awake — Alertness over ${o.terms.alertFloor.pct}%`);
      if (o.terms?.cashExact)  t.push(`arrive holding $${o.terms.cashExact.amount.toLocaleString()}, give or take $${o.terms.cashExact.tol}`);
      if (o.terms?.heatCarried) t.push(`the bag brings its own heat — ${o.terms.heatCarried.stars}★ the whole way`);
      if (o.terms?.survivalDrain) t.push('a full car drains your food and water twice as fast');
      if (o.terms?.damageDock) t.push(`every HP you lose costs you $${o.terms.damageDock.perHp} of the fee`);
      if (o.terms?.tipBySpeed) t.push('she tips on speed — the faster it lands, the better it pays');
      return t.length ? `The catch: ${t.join('; ')}.` : 'No strings. Easy money.';
    };
    // Condensed terms for the scannable deal-summary row (owner 2026-07-21):
    // the SAME terms as termLine, tagged + dot-separated so they read at a
    // glance instead of buried in prose.
    const catchLine = (o) => {
      const t = [];
      if (o.terms?.fragile)    t.push(`FRAGILE · over ${o.terms.fragile.maxDamage} dmg = trash`);
      if (o.terms?.perishable) t.push('PERISHABLE · dawdle and it spoils');
      if (o.terms?.illegal)    t.push('HOT · heat climbs harder while carrying');
      if (o.terms?.rush)       t.push(`RUSH · ${mmss(o.terms.rush.budgetSec)} on the clock`);
      if (o.terms?.weather_run) t.push(o.terms.weather_run.tag === 'wind'
        ? 'WIND · Vantage gusts the whole way'
        : 'STORM · rain into snow over the pass');
      if (o.terms?.no_chains)  t.push('DARE · no chains allowed');
      if (o.terms?.chain)      t.push(`HAND-OFF · the next ${o.terms.chain.label}`);
      if (o.terms?.noEating)   t.push('NO EATING · one bite = void');
      if (o.terms?.pacifist)   t.push('QUIET · fire nothing');
      if (o.terms?.speedFloor) t.push(`KEEP MOVING · over ${o.terms.speedFloor.mph} mph`);
      if (o.terms?.speedCap)   t.push(`EASY · under ${o.terms.speedCap.mph} mph`);
      if (o.terms?.fuelFloor)  t.push(`TANK · arrive over ${o.terms.fuelFloor.pct}%`);
      if (o.terms?.alertFloor) t.push(`AWAKE · Alertness over ${o.terms.alertFloor.pct}%`);
      if (o.terms?.cashExact)  t.push(`EXACT · hold $${o.terms.cashExact.amount.toLocaleString()} ±${o.terms.cashExact.tol}`);
      if (o.terms?.heatCarried) t.push(`HOT · ${o.terms.heatCarried.stars}★ while carrying`);
      if (o.terms?.survivalDrain) t.push('THIRSTY · 2× food/water drain');
      if (o.terms?.damageDock) t.push(`DOCKED · −$${o.terms.damageDock.perHp}/HP`);
      if (o.terms?.tipBySpeed) t.push('TIPS · faster pays more');
      return t.length ? t.join('  ·  ') : 'No strings — easy money';
    };
    // Drop-off callout.  A CHAIN run is aimed at a business, not just a town
    // ("the next AM/BM"), so name both — that's the whole flavor of the
    // business-to-business haul (owner 2026-07-30).
    const dropAt = (o) => (o.terms?.chain
      ? `${o.terms.chain.label} in ${o.targetName}`
      : o.targetName);
    // Passenger quirk warning — the rider states their own terms.
    const quirkLine = {
      nervous:       "One hard crash and I'm walking — deal's off; so drive it soft.",
      carsick:       'Keep it smooth as glass, no jolt, no bump — too much banging and I am DONE, you chump.',
      fugitive:      "If the stars start stacking, I'm out the door for sure — two's my limit, not one star more.",
      thrill_seeker: "Fare's flat and set, but thrill me a bit — make it fun and there's a tip in it.",
    };

    // Busy is PER TYPE (one active per type, Ch. 8) — an occupied slot still
    // shows the pitch, just without the accept button.
    // Busy = that TYPE is already running, or this STOP has already hired
    // (owner 2026-07-30: three categories pitched, exactly one taken here).
    const hiredHere = !!missions.acceptedAtStop?.(stopId);
    const busyType = (t) => hiredHere || missions.hasActiveOfType(t);
    const anyBusy  = open.some(o => busyType(o.type));

    // NPC continuity (Ch. 8 Phase 6): the contact remembers you — greeting
    // shifts with jobs done for them, and a pending failure gets a nod first
    // (flavor only, no rep loss).  Any reply clears the fail-ack flag.
    const npcId  = contactIdFor(stopId);
    const memAll = this.registry.get('save')?.get?.('npcMemory', {}) ?? {};
    const mem    = memAll[npcId] ?? {};
    const memLine = contactGreeting(mem);
    const ackFail = !!mem.failAckPending;

    // Offer flavor by tier (Ch. 8 Phase 6) — text only, the pitch changes
    // with your rep at that type: cautious Rookie ask → Legend trust.
    const tierIntro = (o) => {
      const t = missions.tierOf?.(o.type)?.name ?? 'Rookie';
      return t === 'Legend' ? "You're the one I'd trust with this, and none else on my list. "
        : t === 'Known' ? "You've earned the better work, no doubt — the kind of run I don't hand out. "
        : '';
    };

    const nodes = {};
    // The contact wants "a driver who doesn't ask questions", so the replies are
    // STATEMENTS, not questions (owner 2026-07-19 flagged the irony).
    const greetChoices = open.map((o, i) => ({
      label: o.type === 'challenge'
        ? `Hear the ${o.bizLabel ?? 'local'} dare`
        : o.type === 'passenger'
        ? `Size up the ${o.bizLabel ?? o.targetName} rider`
        : o.type === 'heat'
          ? "Bring up the heat you're wearing"
        : (o.bizLabel
            ? `Hear out the ${o.bizLabel} job`
            : (open.length > 1 ? `Hear out the ${o.targetName} job` : 'Hear the job out')),
      next:  `offer${i}`,
      ...(ackFail ? { setMemory: { failAckPending: false } } : {}),
    }));
    greetChoices.push({ label: 'Thank them and leave', effects: {}, end: true,
      ...(ackFail ? { setMemory: { failAckPending: false } } : {}) });
    // Varied opener so the contact isn't reciting the SAME line at every stop
    // (owner 2026-07-19). Stable per stop via the stopId hash `h`.
    const GREETS = [
      "Got a run that needs a driver, quick and mum — one who won't ask questions or where the cargo's from.",
      "You've got a trunk and a lead-foot walk; I've got a problem — so let's you and me talk.",
      "Word is you drive fast and forget every face — that's the whole of the job, and you've got the pace.",
      "No badge, no paperwork, no fuss, no jiver — no questions asked: now that's my kind of driver.",
      "You didn't hear this from me, understand — and we never met, once it's out of your hand.",
      "Quiet type? Good — that suits me fine; the loud ones end in a ditch off the line.",
      "I need a thing gone and clean off my plate — never to think of it again, or its weight.",
      "You look like a soul who needs cash in the hand far more than answers or a lay of the land.",
      "Don't nod too hard — there's always an eye; just listen close and let it slide by.",
      "Half up front? No, that's not my way — all of it lands on delivery day.",
    ];
    const _greet = GREETS[Math.abs(h) % GREETS.length];
    nodes.greet = {
      line: memLine ?? (hiredHere
        ? "You've taken your one from me already, friend — one job a stop, and that's where it ends."
        : anyBusy
          ? "You're hauling for someone — I can tell by your park; still, hear me out before you embark."
          : (open.length > 1 ? `${_greet} I've got ${open.length}, in fact — pick one and let's transact.` : _greet)),
      choices: greetChoices,
    };
    open.forEach((o, i) => {
      const busy = busyType(o.type);
      const choices = [];
      if (!busy) {
        // Acceptance is idempotent (MissionSystem.accept is double-tap safe).
        choices.push({
          label: o.type === 'passenger' ? `Take the rider — $${o.payout}`
               : o.type === 'challenge' ? `Take the dare — $${o.payout}`
               : `Take the job — $${o.payout}`,
          effects: {}, end: true, missionAccept: o.id,
        });
      }
      choices.push({ label: 'Not my problem', effects: {}, end: true, missionDecline: o.id });
      if (open.length > 1) choices.push({ label: 'What else you got?', next: 'greet' });
      choices.push({ label: 'Thank them and leave', effects: {}, end: true });
      if (o.type === 'passenger') {
        // ONE NPC per rest stop (owner 2026-07-19): the contact RELAYS the rider
        // instead of a second character (portrait/face) popping up. Keeps the
        // rider's own line + quirk for flavor, just in the contact's mouth.
        const p = o.passenger ?? {};
        const riderName = p.name ? `${p.name}` : 'A rider';
        nodes[`offer${i}`] = {
          line: (o.pitch
              ? `${tierIntro(o)}${o.pitch} ${quirkLine[p.quirk] ?? ''}`
              : `${tierIntro(o)}Here's a rider who needs a lift, you see. `
                + `"${p.ask ?? 'I need a ride — would you carry me?'}" ${quirkLine[p.quirk] ?? ''}`).trim()
              + (busy ? " …though your shotgun seat's already taken, it seems to me." : ''),
          deal: {
            head: o.missionName ? `RIDER · ${o.missionName.toUpperCase()}` : 'JOB · RIDER',
            rows: [
              ...(o.bizLabel ? [['For', o.bizLabel]] : []),
              ['Take',  `${riderName} → ${dropAt(o)}`],
              ['Trip',  `${o.routeMiles} mi`],
              ['Pay',   `$${o.payout} on arrival`],
              ['Catch', quirkLine[p.quirk] ? quirkLine[p.quirk] : 'No strings — easy money'],
            ],
          },
          choices,
        };
      } else if (o.type === 'heat') {
        // Heat escape — however you shed the stars counts (paid clears too;
        // their price is penalty enough — 2026-07-13 decision).
        nodes[`offer${i}`] = {
          line: `${tierIntro(o)}You're glowing, friend, lit up like a flare — shed 'em how you like, I don't much care; `
              + `get busted, though, and I was never there.`
              + (busy ? " …though you're already running hot for someone, I swear." : ''),
          deal: {
            head: 'JOB · SHAKE THE HEAT',
            rows: [
              ['Go',    `${o.targetName}`],
              ['Trip',  `${o.routeMiles} mi`],
              ['Pay',   `$${o.payout} on arrival`],
              ['Catch', 'land with ZERO stars — busted = deal off'],
            ],
          },
          choices,
        };
      } else if (o.type === 'challenge') {
        const g = o.goal ?? {};
        const goalLine = g.kind === 'useItemsInTime'
            ? `use all ${g.count} in ${g.sec}s`
          : g.kind === 'speedBand'
            ? `hold ${g.maxMph ? `${g.minMph}-${g.maxMph}` : `${g.minMph}+`} mph for ${g.holdSec}s`
          : g.kind === 'boostSeconds'
            ? `${g.sec}s of boost, cumulative`
            : 'pull it off';
        nodes[`offer${i}`] = {
          line: `${tierIntro(o)}${o.pitch}`
              + (busy ? " …though you've already got a dare running." : ''),
          deal: {
            head: `DARE · ${(o.missionName ?? 'CHALLENGE').toUpperCase()}`,
            rows: [
              ...(o.bizLabel ? [['For', o.bizLabel]] : []),
              ...(o.cargo ? [['Get', `${o.cargo} — free, right now`]] : []),
              ['Do',    goalLine],
              ['Pay',   `$${o.payout} the moment you do it`],
              ['Catch', 'the clock starts when you hit the road'],
            ],
          },
          choices,
        };
      } else {
        // Business-sourced work leads with that business's own pitch (owner
        // 2026-07-28 pool); the generic pool keeps the old rhyming opener.
        nodes[`offer${i}`] = {
          line: (o.pitch
                  ? `${tierIntro(o)}${o.pitch}`
                  : `${tierIntro(o)}Something needs up the road and off the books, no trace — you in for the run, and up for the pace?`)
              + (hiredHere ? " …but you've had your pick here; one job a stop, that's the trick."
                 : busy ? " …but your trunk's packed tight; come back when there's space." : ''),
          deal: {
            head: o.missionName
              ? `${o.type === 'timed' ? 'RUSH' : 'JOB'} · ${o.missionName.toUpperCase()}`
              : (o.type === 'timed' ? 'JOB · RUSH DELIVERY' : 'JOB · DELIVERY'),
            rows: [
              ...(o.bizLabel ? [['For', o.bizLabel]] : []),
              ['Haul',  `${o.cargo} → ${dropAt(o)}`],
              ['Trip',  `${o.routeMiles} mi`],
              ['Pay',   `$${o.payout} on delivery`],
              ['Catch', catchLine(o)],
            ],
          },
          choices,
        };
      }
    });

    return {
      id: `mission_offers_${stopId}`,
      stopId,
      npcId,                       // recurring contact — npcMemory continuity
      portrait,
      speaker: npcName,
      startNode: 'greet',
      nodes,
    };
  }

  /** Lazily synthesize a placeholder portrait texture (colored bust) so
   *  encounters are playable before real art exists. */
  _ensureNpcTexture(key, tint) {
    if (this.textures.exists(key)) return;
    const w = 200, h = 220;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x0A0F1A, 1); g.fillRoundedRect(0, 0, w, h, 10);
    g.fillStyle(tint, 1);
    g.fillCircle(w / 2, h * 0.36, 46);                 // head
    g.fillEllipse(w / 2, h * 1.02, 150, 120);          // shoulders/bust
    g.fillStyle(0xFFFFFF, 0.14);
    g.fillCircle(w / 2 - 16, h * 0.30, 12);            // light glint
    g.lineStyle(4, 0x39A8FF, 0.7); g.strokeRoundedRect(2, 2, w - 4, h - 4, 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  /** Build the portrait card overlay: portrait, speaker, line, optional fact,
   *  and 2–3 choice buttons.  Blocks the shop until the player picks.
   *  Handles BOTH flat legacy cards and multi-node dialogue trees — the
   *  renderer walks nodes (nodeId re-entry); effects still resolve only
   *  through resolveChoice/applyEncounterEffects when a choice is picked. */
  /**
   * Which shop at THIS stop is today's real mission contact (owner
   * 2026-07-30: "only 1-2 shops provide missions, it's up to the player to
   * find them" + "switch it up" — varies stop to stop, not a fixed brand).
   * Deterministic per stopId (same hash pattern as NPC_NAMES/portrait picks
   * elsewhere in this file) so it's stable for the whole visit but not
   * predictable across stops — restricted to shops this stop actually has
   * AND that carry a generic greeter, so it's never a tile the player can't
   * see or a screen with no fallback.
   */
  _missionShopKeyFor(stopId) {
    const present = (this._stop?.amenities ?? []).filter(k => SHOP_GREETERS[k]);
    if (!present.length) return null;
    let h = 0; for (let i = 0; i < String(stopId).length; i++) h = (h * 31 + String(stopId).charCodeAt(i)) | 0;
    return present[Math.abs(h) % present.length];
  }

  /**
   * Shop entry gate (owner 2026-07-30): "the shop-staff portraits take over
   * the original NPC images, same place same setup — after questions are
   * answered, then the storefront displays." First tap on a shop shows that
   * brand's staffer on the SAME `_showEncounterCard` used for roadside
   * encounters; `proceed` (open the actual shop screen) fires once any
   * choice resolves.
   *
   * Two card sources, in priority order:
   *  1. THE mission contact for this stop (`_missionShopKeyFor`) — reuses
   *     `_buildMissionEncounter`, gated on `_pendingMissionCard` (set once on
   *     arrival). This is the ONLY way to reach a mission offer as of
   *     2026-07-30 — the old automatic HIT THE ROAD pitch was removed,
   *     owner directive: "if people wanna do missions, they can go to the
   *     different shops and talk to the NPCs. And if they don't, they can
   *     hit the road" — clean exit either way, no forced interruption.
   *  2. Otherwise the generic `SHOP_GREETERS[shopKey]` — "once: true" means
   *     a one-time doorway per shop per save; after that `proceed` runs
   *     immediately so a shop you've already met isn't friction.
   */
  _showShopGreeter(shopKey, proceed) {
    const save = this.registry.get('save');
    const seen = new Set(save?.get?.('encountersSeen', []) ?? []);

    if (this._pendingMissionCard && shopKey === this._missionShopKeyFor(this._stop?.id)) {
      const missions = this.registry.get('missions');
      const enc = missions ? this._buildMissionEncounter(missions) : null;
      if (enc) {
        this._pendingMissionCard = false;
        this._pendingGreeterProceed = proceed;
        this._showEncounterCard(enc, save, seen);
        return;
      }
      // No real offers today (e.g. Custom/no-score mode) — fall through to
      // the ordinary greeter rather than leaving the shop looking broken.
    }

    const enc = SHOP_GREETERS[shopKey];
    if (!enc || (enc.once && seen.has(enc.id))) { proceed(); return; }
    this._pendingGreeterProceed = proceed;
    this._showEncounterCard(enc, save, seen);
  }

  /** @param convo  Conversation state carried across re-renders of the SAME
   *  conversation (owner 2026-08-05): `{ consumed:Set, reply:string|null }`.
   *  A question's answer used to be a 2.6s toast over a torn-down card, so you
   *  got exactly ONE interaction per NPC and the reply was easy to miss. Now an
   *  answer lands IN the card — it replaces the NPC's line, the question that
   *  earned it is struck from the list, and the conversation stays open. Only a
   *  choice flagged `exit: true` closes the card and lets the storefront open.
   *  `consumed` is keyed `nodeId::label` so walking to another node and back
   *  doesn't resurrect a spent question. */
  _showEncounterCard(enc, save, seen, nodeId = null, convo = null) {
    // Recurring-NPC memory (GLOBAL save bucket) + current node view.
    const memAll = save?.get?.('npcMemory', {}) ?? {};
    const mem    = enc.npcId ? (memAll[enc.npcId] ?? {}) : {};
    if (nodeId == null && isDialogueTree(enc)) nodeId = getStartNode(enc, mem);
    const node = getEncounterNode(enc, nodeId);
    if (!node) return;
    convo ??= { consumed: new Set(), reply: null };
    const ckey = (c) => `${nodeId ?? '_'}::${c.label}`;

    const D = 500;                       // above every shop element
    const objs = [];
    const add = (...n) => { objs.push(...n); return n[0]; };
    const dismiss = () => { for (const o of objs) o?.destroy?.(); };

    // Full-screen scrim that eats clicks to the shop underneath.  setInteractive
    // alone does NOT do that — Phaser keeps dispatching to the objects below
    // it — so the scrim has to stop propagation itself (_swallowTaps).
    this._gateTaps();
    add(this._swallowTaps(this.add.rectangle(CX, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.82)
      .setDepth(D)));

    // Big near-full-screen card, SPLIT: NPC portrait pane on the left
    // (fully uncovered), text + choices pane on the right.
    const pw = SCREEN_W - 16, ph = SCREEN_H - 16;
    const px = CX - pw / 2, py = SCREEN_H / 2 - ph / 2;
    const imgW = Math.round(pw * 0.44);          // left pane = portrait
    const txX  = px + imgW, txW = pw - imgW;     // right pane = text column

    // Right-pane backdrop (solid dark so text always reads).
    const pane = this.add.graphics().setDepth(D + 1);
    pane.fillStyle(0x060A14, 0.96); pane.fillRoundedRect(px, py, pw, ph, 14);
    add(pane);

    // Portrait — cover-fit into the LEFT pane (top-anchored so the face
    // stays), clipped to the pane by a geometry mask.  Nothing overlaps it.
    // A node may override the card portrait (e.g. a passenger making their
    // own ask inside the contact's conversation).
    const port = getPortrait(node.portrait ?? enc.portrait);
    this._ensureNpcTexture(port.texture, port.placeholderTint ?? 0x555555);
    const tex = this.textures.get(port.texture)?.source?.[0];
    const iw = tex?.width || 600, ih = tex?.height || 660;
    const scale = Math.max(imgW / iw, ph / ih);
    const portImg = this.add.image(px + imgW / 2, py, port.texture)
      .setOrigin(0.5, 0).setDisplaySize(iw * scale, ih * scale).setDepth(D + 2);
    const maskG = this.make.graphics(); maskG.fillStyle(0xffffff).fillRoundedRect(px, py, imgW + 14, ph, 14);
    maskG.fillRect(px + imgW - 14, py, 14, ph);   // square inner edge
    portImg.setMask(maskG.createGeometryMask());
    objs.push(portImg, { destroy: () => maskG.destroy() });
    // Card border + pane divider.
    const border = this.add.graphics().setDepth(D + 5);
    border.lineStyle(3, 0x39A8FF, 1); border.strokeRoundedRect(px, py, pw, ph, 14);
    border.lineStyle(2, 0x39A8FF, 0.5); border.lineBetween(txX, py + 2, txX, py + ph - 2);
    add(border);

    // ── Right pane: header → dialogue → speaker → fact (choices at bottom). ──
    const tx = txX + 16, tw = txW - 32;
    add(this.add.text(txX + txW / 2, py + 10,
      `${this._stop?.name ?? 'Rest Stop'}  ·  MILE ${Math.round(this._odometer ?? 0)}`, {
        fontSize: '12px', fontFamily: IMPACT, color: '#8FB7E6',
      }).setOrigin(0.5, 0).setDepth(D + 4));

    // ── Adaptive 2× type scale (2026-07-15) — dialogue/speaker/fact/choice
    // sizes DOUBLED from the original 16/14/10/13px; long dialogues (or tall
    // choice stacks) step down a tier so the column never overflows the
    // right pane.  Each tier is measured with the real wrapped text before
    // committing; the last tier is the original sizes (guaranteed fit).
    // Rotating town fact takes precedence over the encounter's own fact so the
    // same 3-5 town facts cycle across visits regardless of which NPC greets you.
    const fact = this._townFact ?? node.fact ?? enc.fact;
    const condCtx = { cash: this._score ?? 0, buffs: this._purchases.encounterBuffs ?? [], memory: mem };
    const choices = (node.choices ?? [{ label: 'Continue', effects: {}, end: true }])
      .filter(c => !(c.hideWhenLocked && choiceLocked(c, condCtx)))
      // A question you've already asked is struck from the list — otherwise the
      // conversation loops and a `generous`/paid branch could be farmed.
      .filter(c => !convo.consumed.has(ckey(c)));
    // Safety net: never strand the player. If nothing left on this node is a
    // free unconditional way OUT, append one. Authored exits are always
    // preferred — this only fires once they've all been spent.
    if (!choices.some(c => isExitChoice(c) && !c.cost && !c.conditions)) {
      choices.push({ label: "\"That's all I needed. Thanks.\"", effects: {}, end: true, exit: true });
    }
    // The NPC's answer to the last question REPLACES their opening line and is
    // printed verbatim — these lines are a mix of speech and narration ("He
    // salutes you with a cup he found on the ground"), so the card must not
    // wrap them in quotes the way it does an NPC's own line.
    const lineText = convo.reply ?? `"${node.line}"`;
    const TYPE_TIERS = [
      { dlg: 32, spk: 28, fct: 20, ch: 24, bh: 56 },   // full 2×
      { dlg: 26, spk: 22, fct: 16, ch: 20, bh: 46 },
      { dlg: 20, spk: 18, fct: 13, ch: 16, bh: 38 },
      { dlg: 16, spk: 14, fct: 10, ch: 13, bh: 28 },   // pre-2026-07-15 sizes
    ];

    // Deal-summary block (mission offers only) — a scannable "JOB · TYPE"
    // header plus label/value rows, rendered as its own boxed panel below the
    // contact's spoken line so the facts (what · where · pay · catch) read at
    // a glance instead of buried in prose.  Monospace keeps the columns aligned.
    const dealStr = node.deal
      ? node.deal.head + '\n'
        + node.deal.rows.map(([k, v]) => `${(k + '      ').slice(0, 6)}${v}`).join('\n')
      : null;

    // Choice labels are full spoken sentences as of 2026-08-04, so a button is
    // no longer a fixed `t.bh` slab — it grows to whatever its wrapped label
    // needs. Measured per tier alongside the dialogue, because a taller stack
    // is exactly what should push the type down a tier.
    const CH_PAD = 14;
    const measureChoiceHeights = (t) => choices.map((c) => {
      const probe = this.add.text(0, 0, c.label, {
        fontSize: `${t.ch}px`, fontFamily: IMPACT,
        wordWrap: { width: txW - 44 }, align: 'center',
      }).setVisible(false);
      const h = Math.max(t.bh, probe.height + CH_PAD);
      probe.destroy();
      return h;
    });

    // ── SPLIT tier selection (owner 2026-08-05: "lots of empty space and the
    // text is too small").  A single shared tier meant a tall choice stack —
    // five sentence-length buttons — failed the fit test at every big tier
    // and dragged the DIALOGUE down to the smallest sizes too, even when the
    // quote had half the pane free: tiny type at the top, a dead gap in the
    // middle.  The two blocks now size independently: the bottom block
    // (speaker + fact + choices) takes the largest tier that still leaves
    // room for at least a smallest-tier dialogue, then the dialogue takes the
    // largest tier that fits the space the bottom actually left.
    const mkDlg = (t) => this.add.text(tx, py + 34, lineText, {
      fontSize: `${t.dlg}px`, fontFamily: 'Georgia, serif', color: '#F4F7FF',
      wordWrap: { width: tw }, lineSpacing: Math.round(t.dlg * 0.2),
    }).setDepth(D + 4);
    const mkFact = (t) => fact ? this.add.text(0, 0, `📍 ${fact}`, {
      fontSize: `${t.fct}px`, fontFamily: 'Arial', color: '#9FB7D6',
      fontStyle: 'italic', wordWrap: { width: tw }, lineSpacing: 1,
    }).setDepth(D + 4).setVisible(false) : null;
    const mkDeal = (t) => dealStr ? this.add.text(0, 0, dealStr, {
      fontSize: `${t.fct + 3}px`, fontFamily: 'Menlo, Consolas, monospace',
      color: '#DCE9FB', lineSpacing: 4, wordWrap: { width: tw - 16 },
    }).setDepth(D + 5).setVisible(false) : null;
    const topHAt = (t) => {
      const d = mkDlg(t), dl = mkDeal(t);
      const h = 34 + d.height + (dl ? dl.height + 26 : 0) + 10;
      d.destroy(); dl?.destroy();
      return h;
    };

    const tMin = TYPE_TIERS[TYPE_TIERS.length - 1];
    const minTopH = topHAt(tMin);
    let TB = tMin, chHeights = measureChoiceHeights(tMin);
    for (const t of TYPE_TIERS) {
      const f = mkFact(t);
      const chH = measureChoiceHeights(t);
      const bot = (t.spk + 8) + (f ? f.height + 6 : 0)
                + chH.reduce((sum, h) => sum + h + 6, 0) + 8;
      f?.destroy();
      if (bot <= ph - minTopH || t === tMin) { TB = t; chHeights = chH; break; }
    }
    let factText = mkFact(TB);
    let botH = (TB.spk + 8) + (factText ? factText.height + 6 : 0)
             + chHeights.reduce((sum, h) => sum + h + 6, 0) + 8;

    let TD = tMin;
    for (const t of TYPE_TIERS) { if (topHAt(t) <= ph - botH) { TD = t; break; } }
    const dlgText = mkDlg(TD);
    const dealText = mkDeal(TD);
    const fits = 34 + dlgText.height + (dealText ? dealText.height + 26 : 0) + 10
               <= ph - botH;

    // Even the smallest tier can overflow — a long quirk line on a mission
    // offer pushes the deal panel down into the speaker label and the town
    // fact, which used to render as text stacked on text.  The fact is the
    // one droppable element here (pure flavour; the deal rows and the
    // speaker are load-bearing), so it is the pressure valve.
    if (!fits && factText) {
      factText.destroy();
      factText = null;
      botH = (TB.spk + 8) + chHeights.reduce((sum, h) => sum + h + 6, 0) + 8;
    }
    add(dlgText);
    let _dealBottom = 0;
    // Boxed panel behind the deal rows.
    if (dealText) {
      const dyTop = py + 34 + dlgText.height + 12;
      const dpad = 9;
      const dbg = this.add.rectangle(
        tx - dpad, dyTop - dpad,
        Math.min(tw, dealText.width + dpad * 2), dealText.height + dpad * 2,
        0x0C1A32, 0.94,
      // D + 3.6, NOT D + 4: at an equal depth this panel tied with the town
      // fact and the speaker label and, being created later, painted over
      // them at 0.94 alpha — the ghosted strikethrough on the fact line.
      ).setOrigin(0, 0).setStrokeStyle(1.5, 0x39A8FF, 0.7).setDepth(D + 3.6);
      add(dbg, dealText.setPosition(tx, dyTop).setVisible(true));
      _dealBottom = dyTop + dealText.height + dpad;
    }
    // The bottom block is bottom-anchored while the deal panel is
    // top-anchored, so on a tall card the two used to collide — this is what
    // put the yellow speaker label on top of the deal's last line.  Push the
    // block down past the panel whenever the panel reaches further.
    const _botY = Math.max(py + ph - botH, _dealBottom + 10);
    add(this.add.text(tx, _botY, (node.speaker ?? enc.speaker ?? port.name).toUpperCase(), {
      fontSize: `${TB.spk}px`, fontFamily: IMPACT, color: '#FFD23D',
    }).setDepth(D + 4));
    if (factText) add(factText.setPosition(tx, _botY + TB.spk + 6).setVisible(true));

    // Effect-application context — writes to _purchases (resumed by GameScene)
    // and to live _score/_stars for on-card display.
    const applyCtx = {
      // Custom: gains land normally, LOSSES are ignored — the sandbox wallet
      // never depletes (owner 2026-07-28).  Same rule as GameScene._cashLoss.
      addCash:   (n) => {
        const d = (this._infiniteMoney() && n < 0) ? 0 : n;
        this._score = Math.max(0, (this._score ?? 0) + d);
        this._refreshScore?.();
      },
      addFuelMi: (n) => { this._purchases.addGasMi = (this._purchases.addGasMi ?? 0) + n; },
      addHp:     (n) => {
        const vehMax = this._vehMaxHp();
        const cur = this._purchases.durabilityOnResume ?? this._durabilityAtEntry ?? vehMax;
        this._purchases.durabilityOnResume = Math.max(0, Math.min(vehMax, cur + n));
      },
      addHeat:   (n) => {
        if (n < 0) this._purchases.starsToDrop = (this._purchases.starsToDrop ?? 0) + (-n);
        else       this._purchases.bumpStarsOnResume = (this._purchases.bumpStarsOnResume ?? 0) + n;
        this._stars = Math.max(0, Math.min(5, (this._stars ?? 0) + n));
      },
      addTimeSec:   (n)  => { this._purchases.addPartyClockSec = (this._purchases.addPartyClockSec ?? 0) + n; },
      addBuff:      (id) => { this._purchases.encounterBuffs = [...(this._purchases.encounterBuffs ?? []), id]; },
      grantUpgrade: (id) => { this._purchases.encounterUpgrades = [...(this._purchases.encounterUpgrades ?? []), id]; },
      addSurvival:  (bar, n) => {
        const d = (this._purchases.survivalDelta ??= {});
        d[bar] = (d[bar] ?? 0) + n;
        this._drawSurvivalMini();
      },
      // Raise a bar UP TO a target and no further — a sit-down meal fills you
      // to "fed", it doesn't stack on top of an already-full stomach. Reads
      // through the entry snapshot plus everything banked this visit so two
      // meals in one stop don't double-count.
      raiseSurvivalTo: (bar, target) => {
        const e = this._survAtEntry ?? { tiredness: 0, hydration: 50, fullness: 50 };
        const d = (this._purchases.survivalDelta ??= {});
        const cur = (e[bar] ?? 0) + (d[bar] ?? 0);
        if (cur < target) {
          d[bar] = (d[bar] ?? 0) + (target - cur);
          this._drawSurvivalMini();
        }
      },
      coolEngine:   (n) => { this._purchases.coolEngine = (this._purchases.coolEngine ?? 0) + n; },
      storeOffer:   (o) => { this._applyStoreOffer(o); },
    };

    const choose = (choice) => {
      const { effects, dialogue } = resolveChoice(choice);
      applyEncounterEffects(effects, applyCtx);
      // Node-walker bookkeeping — SEPARATE from effect resolution above.
      if (enc.npcId && choice.setMemory) {
        memAll[enc.npcId] = { ...mem, ...choice.setMemory };
        save?.set?.('npcMemory', memAll);
      }
      // Mission offer accept/decline (Ch. 8 Favors) — routed to the
      // MissionSystem, never through the effects vocabulary.
      if (choice.missionAccept) {
        const m = this.registry.get('missions')?.accept?.(
          choice.missionAccept, this._odometer ?? 0, this._partyClockSec ?? null);
        // A CHALLENGE hands its kit over at acceptance ("I'll load you to
        // three") — routed through the same _purchases.f12 channel a shop
        // purchase uses, so GameScene's resume path needs no new case.
        if (m?.type === 'challenge' && m.grant?.item) {
          const _n = Math.max(1, Math.floor(m.grant.count ?? 1));
          this._purchases.f12 ??= [];
          for (let _i = 0; _i < _n; _i++) this._purchases.f12.push(m.grant.item);
        }
        // Job terms are a contract the player has to actually READ — they go
        // on a tap-to-dismiss card, not a fading toast (owner 2026-07-29).
        if (m?.type === 'passenger') {
          this._showMenuPopup(`🧍 ${m.passenger?.name} climbs in.\n\n${m.passenger?.pickup ?? ''}\n\n$${m.payout} at ${m.targetName}.`, '#88FF88');
        } else if (m?.type === 'timed') {
          this._showMenuPopup(`⚡ Rush job taken — ${m.cargo} to ${m.targetName}.\n\nClock's already running.`, '#88FF88');
        } else if (m?.type === 'heat') {
          this._showMenuPopup(`🔥 Deal — land at ${m.targetName} with ZERO stars.\n\n$${m.payout} clean, half if you pay your way out.`, '#88FF88');
        } else if (m?.type === 'weather') {
          this._showMenuPopup(`${m.terms?.weather_run?.tag === 'wind' ? '🌬' : '🌨'} Contract taken — ${m.cargo} to ${m.targetName}, intact.\n\n$${m.payout}.`, '#88FF88');
        } else if (m?.type === 'challenge') {
          // Dares have no destination — the fallback below printed "to null".
          this._showMenuPopup(`🎯 Dare's on — ${m.missionName ?? 'challenge'}.\n\n$${m.payout} the moment you pull it off.`, '#88FF88');
        } else if (m) {
          this._showMenuPopup(`📦 Job taken — ${m.cargo} to ${m.targetName}.\n\n$${m.payout} on delivery.`, '#88FF88');
        }
      }
      if (choice.missionDecline) {
        this.registry.get('missions')?.decline?.(choice.missionDecline);
      }
      dismiss();
      if (typeof choice.next === 'string') {
        // Walking to another node: the answer (if any) rides along as that
        // node's opening line, and `consumed` carries over so a question
        // spent on the way out stays spent on the way back.
        convo.reply = dialogue ?? null;
        this._showEncounterCard(enc, save, seen, choice.next, convo);
        return;
      }
      // ── Stay-open answer (owner 2026-08-05) ────────────────────────────
      // Not an exit and not a walk: the NPC answers IN the card. Strike the
      // question, put the reply where their line was, re-render the SAME node.
      // The storefront stays shut — only an `exit` choice opens it.
      if (!isExitChoice(choice)) {
        convo.consumed.add(ckey(choice));
        convo.reply = dialogue ?? convo.reply;
        this._showEncounterCard(enc, save, seen, nodeId, convo);
        return;
      }
      // ── Exit ───────────────────────────────────────────────────────────
      // The parting line still plays as a toast on the way out: the card is
      // closing by definition, so there is nothing left to print it into.
      if (dialogue) this._showEncounterResult(dialogue);
      if (enc.once) { seen.add(enc.id); save?.set?.('encountersSeen', [...seen]); }
      // Shop-greeter gate (owner 2026-07-30): _showShopGreeter stashes the
      // "now actually open the shop" callback here before showing the card.
      // As of 2026-08-05 this fires on the EXIT choice only — "player must
      // select a sentence that moves off the conversation to get to the
      // storefront" — not on the first tap of any kind.
      if (this._pendingGreeterProceed) {
        const proceed = this._pendingGreeterProceed;
        this._pendingGreeterProceed = null;
        proceed();
      }
    };

    // Choice buttons stacked at the bottom of the RIGHT pane, sized by the
    // committed type tier (2× at full scale).  Choices whose `conditions`
    // fail (cash / item / npcMemory) render grayed out like an unaffordable
    // cost, or vanish entirely with `hideWhenLocked` (filtered above).
    const gap = 6;
    const bcx = txX + txW / 2;
    let by = py + ph - chHeights.reduce((s, h) => s + h + gap, 0) - 6;
    for (let ci = 0; ci < choices.length; ci++) {
      const c = choices[ci];
      const bh = chHeights[ci] ?? TB.bh;
      const cost = c.cost ?? 0;
      const afford = cost <= (this._score ?? 0) && !choiceLocked(c, condCtx);
      const bg = this.add.rectangle(bcx, by + bh / 2, txW - 28, bh, afford ? 0x143A5A : 0x2A1010)
        .setStrokeStyle(2, afford ? 0x39A8FF : 0x662222).setDepth(D + 2);
      const lbl = this.add.text(bcx, by + bh / 2, c.label, {
        fontSize: `${TB.ch}px`, fontFamily: IMPACT, color: afford ? '#F4F7FF' : '#996666',
        wordWrap: { width: txW - 44 }, align: 'center',
      }).setOrigin(0.5).setDepth(D + 3);
      add(bg, lbl);
      if (afford) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x1E5280));
        bg.on('pointerout',  () => bg.setFillStyle(0x143A5A));
        bg.on('pointerdown', (p, _x, _y, ev) => {
          this._eatTap(p, ev);
          if (this._tapBlocked(p)) return;
          // Gate BEFORE resolving: dismiss() tears the scrim down, so without
          // this the same tap's release lands on the shop button underneath.
          this._gateTaps();
          choose(c);
        });
      }
      by += bh + gap;
    }
  }

  /** Brief follow-up line after a choice resolves, then fade out. */
  _showEncounterResult(text) {
    const D = 500;
    const t = this.add.text(CX, SCREEN_H * 0.82, text, {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: '#FFE0A0',
      backgroundColor: '#080C16', padding: { x: 14, y: 10 }, align: 'center',
      wordWrap: { width: SCREEN_W - 80 },
    }).setOrigin(0.5).setDepth(D + 4);
    this.time.delayedCall(2600, () => t.destroy());
  }

  // ── Hide-all helper ──────────────────────────────────────────────
  _hideAllScreens() {
    for (const obj of (this._landingObjs ?? [])) obj.setVisible?.(false);
    for (const obj of (this._dealerChooserObjs ?? [])) obj.setVisible?.(false);
    for (const c of Object.values(this._sectionContainers ?? {})) c.setVisible(false);
  }

  /** Brand (shop) name for a section key, or null where no brand exists
   *  (e.g. dealer_acc).  dealer_cars titles itself as the dealer brand. */
  _shopNameFor(key) {
    // ACCESSORIES + CARS are shared by both dealerships — title them with
    // whichever dealer placard was tapped (Lord Motors / Sam's), set on tap.
    if (key === 'dealer_acc' || key === 'dealer_cars' || key === 'dealer' || key === 'sam_acc') {
      return this._activeDealerBrand ?? this._brands?.dealer?.name ?? null;
    }
    return this._brands?.[key]?.name ?? null;
  }

  /** Show the landing screen (5 brand placards). */
  /** This vehicle's CURRENT max HP: base + installed part-upgrade HP,
   *  computed LIVE so a purchase made at this very stop raises the cap
   *  immediately.  Every HP clamp here used to read the raw VEHICLES base
   *  (beater 25), which silently discarded upgrade HP — repairs, restores
   *  and the header all capped at 25 until the next fresh run.  Raising the
   *  cap does NOT heal: current damage is tracked separately, which is what
   *  the owner wants ("that is what repairs are for"). */
  _vehMaxHp() {
    const base = VEHICLES[this._vehicleId]?.hp ?? 100;
    let upHp = 0;
    try { upHp = Math.max(0, getUpgradeEffects(this.registry.get('save'), this._vehicleId)?.hp ?? 0); }
    catch (_) {}
    return base + upHp;
  }

  _showLanding() {
    this._gateTaps();
    this._screenStack = ['landing'];
    this._activeSection = null;
    this._applyShopChrome(null);   // back to the blue highway sign
    this._hideAllScreens();
    for (const obj of (this._landingObjs ?? [])) obj.setVisible?.(true);
    this._backBtnBg?.setVisible(false);
    this._backMetal?.gfx.setVisible(false);
    this._backBtnLbl?.setVisible(false);
    this._sectionHeader?.setVisible(false);
    this._continueBtnBg?.setVisible(true);
    this._continueBtnLbl?.setVisible(true);
    // Landing shows the LOCATION; sub-screens swap in the shop name.
    this._titleText?.setText(this._stop.name.toUpperCase());
  }

  /** Show the dealer chooser (Cars / Accessories). */
  _showDealerChooser() {
    this._gateTaps();
    this._applyShopChrome(this._activeDealerKey);
    this._screenStack = ['landing', 'dealer'];
    this._activeSection = null;
    this._hideAllScreens();
    this._dealerCarsSubLbl?.setText?.(this._activeDealerBrand ?? this._brands?.dealer?.name ?? '');
    for (const obj of (this._dealerChooserObjs ?? [])) obj.setVisible?.(true);
    this._backBtnBg?.setVisible(true);
    this._backMetal?.gfx.setVisible(true);
    this._backBtnLbl?.setVisible(true);
    this._continueBtnBg?.setVisible(false);
    this._continueBtnLbl?.setVisible(false);
    const shopName = this._shopNameFor('dealer');
    if (this._sectionHeader) {
      this._sectionHeader.setText(shopName ?? '🏬  DEALER').setVisible(true);
    }
    this._titleText?.setText(shopName ?? this._stop.name.toUpperCase());
  }

  /** Sam's carries level-1/2 parts only — level 3 is Lord Motors exclusive
   *  (owner 2026-07-23).  Flips the LIVE `disabled` flag on the prebuilt
   *  dealer_acc buttons; `_tierGated` marks OUR disables so this never
   *  re-enables an item disabled for another reason (e.g. ✓ Installed). */
  _applyDealerTierGate() {
    // Level-3 parts stay premium.  They used to be gated on which DEALER you
    // walked in through, but parts moved to the two garages, so the gate now
    // keys off whether this stop carries Lord Motors at all — same rule
    // ("level 3 is Lord Motors exclusive"), re-homed rather than reinvented.
    const sam = !(this._stop?.amenities ?? []).includes('lord');
    const gated = [...(SECTIONS.schwasted.items ?? []), ...(SECTIONS.fap.items ?? [])];
    for (const it of gated) {
      if (!it?.payload?.upgradeInstall || (it.lvl ?? 0) < 3) continue;
      if (sam && !it.disabled) {
        it.disabled = true;
        it._tierGated = true;
        it.disabledReason = '⭐ Level-3 parts are Lord Motors exclusive.';
      } else if (!sam && it._tierGated) {
        it.disabled = false;
        it._tierGated = false;
        it.disabledReason = undefined;
      }
    }
    this._buttonRefresh?.forEach?.(fn => fn());
  }

  /** Turn a just-bought row into an inert "✓ OWNED" rung of the ladder.
   *  Emptying the payload is what actually kills the double-buy: the row can
   *  no longer charge, re-apply, or be picked up by _applyDealerTierGate. */
  _markRowOwned(item) {
    item.disabled = true;
    item.disabledReason = '✓ Already installed on this car.';
    item._locked = false;
    item.showCost = false;
    item.disabledCostText = 'OWNED';
    item.payload = {};
    item.label = item._ownedLabel ?? `✓  ${item.label.replace(/^[^\w]+\s*/, '')}`;
    const ui = item._ui;
    if (ui?.label?.scene) ui.label.setText(item.label);
    if (ui?.cost?.scene)  ui.cost.setText('OWNED');
    this._buttonRefresh?.forEach?.(fn => fn());
  }

  /** An NPC QUOTED a price — reprice that shop's row in place, this stop only.
   *  Owner 2026-08-05: "any discounted items should be priced in the store, not
   *  sold at that moment." The conversation never takes the money; it changes
   *  what the counter charges, and the player still has to walk in and buy it.
   *
   *  Repricing in place (rather than injecting a row) is what makes this work
   *  at all: the shop's buttons are built once in create() and live in
   *  pre-rendered containers, long before the encounter card ever appears — so
   *  a brand-new row would never get drawn. Every routed product is therefore
   *  a NORMAL item the shop always stocks, and the NPC only moves its price.
   *  Returns false when the stop has no such counter, so the caller can fall
   *  back to handing the thing over. */
  _applyStoreOffer(offer) {
    if (!offer?.shop || !offer.item) return false;
    if (!(this._stop?.amenities ?? []).includes(offer.shop)) return false;
    const item = (SECTIONS[offer.shop]?.items ?? []).find(it => it.id === offer.item);
    if (!item) return false;
    // Never let a "deal" cost MORE than the shelf price.
    if (offer.price != null && offer.price >= (item.cost ?? Infinity)) return false;
    item.cost = offer.price;
    item._offerNote = offer.note ?? null;
    if (offer.note) item.desc = `${item.desc} (${offer.note})`;
    if (item._ui?.cost?.scene) item._ui.cost.setText(`$${offer.price.toLocaleString()}`);
    if (item._ui?.desc?.scene) item._ui.desc.setText(item.desc);
    this._buttonRefresh?.forEach?.(fn => fn());
    return true;
  }

  /** Open the next rung of a slot's ladder without rebuilding the shop —
   *  called right after its predecessor is installed, so buying Lv1 and Lv2
   *  back to back works in a single visit. */
  _unlockTier(slot, level) {
    if (!slot || !level) return;
    for (const key of GARAGE_KEYS) {
      for (const it of (SECTIONS[key]?.items ?? [])) {
        if (it.slot !== slot || it.lvl !== level || !it._locked) continue;
        it._locked = false;
        it.disabled = false;
        it.disabledReason = undefined;
        it.showCost = false;
        it.label = it._buyLabel ?? it.label;
        if (it._ui?.label?.scene) it._ui.label.setText(it.label);
      }
    }
    // A newly unlocked level 3 is still Lord-Motors-only at a stop without one,
    // so re-run the gate rather than the plain refresh — it repaints every
    // button on its way out anyway.
    this._applyDealerTierGate();
  }

  /** Show a sub-menu for a section key.  parent (optional) = the
   *  intermediate screen to return to on BACK; defaults to 'landing'. */
  _showSection(key, parent = 'landing') {
    this._gateTaps();
    this._screenStack = parent === 'dealer'
      ? ['landing', 'dealer', key]
      : ['landing', key];
    this._activeSection = key;
    // Parts moved out of the dealership, so the level-3 gate has to re-evaluate
    // when a GARAGE opens rather than when a dealer placard is tapped.
    if (key === 'schwasted' || key === 'fap') this._applyDealerTierGate();
    this._applyShopChrome(key);
    this._hideAllScreens();
    if (this._sectionContainers?.[key]) {
      this._sectionContainers[key].setVisible(true);
    }
    this._backBtnBg?.setVisible(true);
    this._backMetal?.gfx.setVisible(true);
    this._backBtnLbl?.setVisible(true);
    this._continueBtnBg?.setVisible(false);
    this._continueBtnLbl?.setVisible(false);
    // Sub-screens brand themselves as the shop the player is IN — the
    // big title and section header both show the store's name (falling
    // back to the section label where no brand exists, e.g. ACCESSORIES).
    const shopName = this._shopNameFor(key);
    // On a full-bleed storefront the BUILDING already carries the brand on a
    // lit sign — printing the name twice more over the art just fights it.
    const _bleed = FULL_BLEED.has(key) && this._shopBg?.visible;
    if (this._sectionHeader) {
      this._sectionHeader
        .setText(shopName ?? SECTIONS[key]?.label ?? key.toUpperCase())
        .setVisible(!_bleed);
    }
    this._titleText?.setText(_bleed ? '' : (shopName ?? this._stop.name.toUpperCase()));
    this._subtitleText?.setVisible?.(!_bleed);
    this._setSectionScroll(key, 0);
  }

  /**
   * Swap the screen between the blue highway sign and a full-bleed storefront.
   * `null` restores the sign (landing / dealer chooser).
   */
  _applyShopChrome(key) {
    // Shared dealer sub-screens still belong to the outer dealer placard.
    // Resolve them back to Lord Motors / Sam's instead of dropping to the
    // blue services-sign fallback.
    const chromeKey = (key === 'dealer' || key === 'dealer_acc' || key === 'dealer_cars' || key === 'sam_acc')
      ? this._activeDealerKey
      : key;
    this._activeChromeKey = chromeKey ?? null;
    const bgKey = chromeKey ? SHOP_BG[chromeKey] : null;
    const on    = !!bgKey && this.textures.exists(bgKey);
    if (bgKey && !on) this._loadMissingShopBg(chromeKey, bgKey);
    if (on) this._shopBg.setTexture(bgKey).setDisplaySize(SCREEN_W, SCREEN_H);
    this._shopBg?.setVisible(on);
    // Menu-column scrim: FAP ONLY (owner 2026-07-30).  It runs the full screen
    // height while the menu column stops `bottomBand` short of the bottom, so
    // everywhere else its tail showed as a bare black block under the last row
    // — "covering some of the menu".  Finesse keeps it because its 7-tab
    // toolbar needs a dark bed down there.
    this._shopScrim?.setVisible(on && chromeKey === 'fap');
    // The sign and the storefront are mutually exclusive — a blue panel on top
    // of a photograph is the worst of both.
    this._signBody?.setVisible(!on);
    this._signTopBand?.setVisible(!on);
    this._layoutGarageTabs(key);
  }

  /** Retry one missing storefront instead of leaving the blue fallback up. */
  _loadMissingShopBg(sectionKey, bgKey) {
    const path = SHOP_BG_PATH[bgKey];
    if (!path) return;
    this._shopBgLoading ??= new Set();
    if (this._shopBgLoading.has(bgKey)) return;
    this._shopBgLoading.add(bgKey);

    const doneEvent = `filecomplete-image-${bgKey}`;
    const finish = () => {
      this._shopBgLoading.delete(bgKey);
      if (this._activeChromeKey === sectionKey && this.textures.exists(bgKey)) {
        this._applyShopChrome(sectionKey);
      }
    };
    this.load.once(doneEvent, finish);
    this.load.once('loaderror', file => {
      if (file?.key === bgKey) this._shopBgLoading.delete(bgKey);
    });
    this.load.image(bgKey, path);
    if (!this.load.isLoading()) this.load.start();
  }

  /** Place the stocked category tabs across the full bottom edge. */
  _layoutGarageTabs(key) {
    const tabs = this._garageTabs ?? [];
    const stocked = GARAGE_KEYS.has(key) ? (SHOP_CATEGORIES[key === 'schwasted' ? 'les_schwasted' : key] ?? []) : [];
    if (!stocked.length) { tabs.forEach(t => t.img.setVisible(false)); return; }

    const availW = SCREEN_W - 16;
    const shown  = tabs.filter(t => stocked.includes(t.cat.id));
    // Tab size is fixed at "all 7 categories share the width" REGARDLESS of
    // how many this particular shop stocks (owner 2026-07-29: Les Schwasted's
    // 3 tabs were stretching to fill the same total width Finesse's 7 do,
    // making them ~2.3x oversized — both wider AND taller, since height is
    // locked to width by the source art's aspect ratio). A shop with fewer
    // tabs now gets smaller, centered buttons instead of inflated ones —
    // the x0 centering math below already handles the leftover space.
    const tw = Math.floor((availW - (GARAGE_CATEGORIES.length - 1) * 4) / GARAGE_CATEGORIES.length);
    const th = Math.round(tw * (220 / (1672 / GARAGE_CATEGORIES.length)));
    const totalW = shown.length * (tw + 4) - 4;
    const x0 = 8 + Math.round((availW - totalW) / 2);
    const y0 = SCREEN_H - th - 4;

    tabs.forEach(t => t.img.setVisible(false));
    shown.forEach((t, i) => {
      t.img.setVisible(true).setDisplaySize(tw, th).setPosition(x0 + i * (tw + 4), y0);
      t.img.setDepth(6);
    });
    // Default to the first stocked category on entry.
    if (this._garageCat?.[key] == null) (this._garageCat ??= {})[key] = stocked[0];
    this._selectGarageCategory(key, this._garageCat[key]);
  }

  /**
   * Filter the shop column to one toolbar category.  Items with no category
   * (repair, paint, popcorn, the untabbed body/police slots) are SERVICES and
   * stay pinned above the parts, so a tab never hides the reason you stopped.
   */
  _selectGarageCategory(key, catId) {
    const rec = this._garageRows?.[key];
    if (!rec || !GARAGE_KEYS.has(key)) return;
    (this._garageCat ??= {})[key] = catId;
    this._garageTabs?.forEach(t => {
      if (!t.img.visible) return;
      // Unselected tabs 70% less transparent (owner 2026-07-29): was 0.45
      // alpha (55% transparent) -> transparency * 0.30 = 16.5% transparent
      // -> 0.84 alpha.
      t.img.setAlpha(t.cat.id === catId ? 1 : 0.84);
    });
    let row = 0;
    for (const r of rec.rows) {
      const cat = r.item.category ?? null;
      const show = cat === null || cat === catId;
      r.objs.forEach((o, k) => {
        o.setVisible?.(show);
        if (show) o.y = rec.y + row * (rec.cellH + 6) + r.dy[k];
      });
      if (show) row++;
    }
    this._sectionContentH[key] = Math.max(0, row * (rec.cellH + 6) - 6);
    this._setSectionScroll(key, 0);
  }

  /** Stop this tap here — in the DOM *and* in Phaser's own dispatch.
   *  `pointer.event` is the raw DOM event; stopping that does NOT stop Phaser
   *  walking on down its depth-sorted hit list to the objects underneath.
   *  That takes Phaser's OWN event object, handed to a game-object handler as
   *  the 4th arg — which is why an interactive scrim never actually blocked
   *  the shop buttons below it. */
  _eatTap(ptr, ev) {
    ptr?.event?.stopPropagation?.();
    ev?.stopPropagation?.();
  }

  /** Close the menus to further input for a beat.  Called on every screen
   *  swap and every popup open/close. */
  _gateTaps(ms = MENU_GATE_MS) {
    this._inputLockUntil = (this.time?.now ?? 0) + ms;
    const p = this.input?.activePointer;
    // Finger still down: this tap has already done its job.  Its release
    // belongs to the screen that's leaving, not the one arriving — remember
    // the press so the incoming screen can refuse the matching pointerup.
    // Keyed on downTime (unique per press) so it needs no clearing and
    // doesn't depend on handler ordering.
    if (p?.isDown) this._eatenTapAt = p.downTime;
  }

  /** True when a menu handler must ignore this pointer event. */
  _tapBlocked(ptr) {
    if ((this.time?.now ?? 0) < (this._inputLockUntil ?? 0)) return true;
    return ptr != null && this._eatenTapAt != null && ptr.downTime === this._eatenTapAt;
  }

  /** Make a full-screen scrim genuinely swallow the tap — both halves of it,
   *  so neither the press nor the release reaches the shop underneath.
   *  onTap (optional) is the scrim's own dismiss action. */
  _swallowTaps(obj, onTap = null) {
    obj.setInteractive({ useHandCursor: !!onTap });
    obj.on('pointerdown', (p, _x, _y, ev) => {
      this._eatTap(p, ev);
      if (onTap && !this._tapBlocked(p)) onTap();
    });
    obj.on('pointerup', (p, _x, _y, ev) => this._eatTap(p, ev));
    return obj;
  }

  /** BACK pops one screen off the stack. */
  _popScreen() {
    if (!this._screenStack || this._screenStack.length <= 1) {
      this._showLanding();
      return;
    }
    this._screenStack.pop();
    const next = this._screenStack[this._screenStack.length - 1];
    if (next === 'landing')      this._showLanding();
    else if (next === 'dealer')  this._showDealerChooser();
    else                          this._showSection(next);
  }

  _setSectionScroll(key, y) {
    // Viewport height differs per layout — the storefront column is taller
    // than the sign panel, so scroll clamping has to use its own rect.
    const _vh = this._contentRectFor(key).h;
    const max = Math.max(0, (this._sectionContentH[key] ?? 0) - _vh);
    const clamped = Math.max(0, Math.min(max, y));
    this._sectionScroll[key] = clamped;
    const c = this._sectionContainers[key];
    if (c) c.y = -clamped;
  }
  _scrollSection(key, dy) {
    this._setSectionScroll(key, (this._sectionScroll[key] ?? 0) + dy);
  }

  /**
   * Where a section's menu lives.  Storefront shops draw a single narrow column
   * over the art's empty LEFT THIRD; everything else keeps the full-width area
   * inside the blue sign.  Returned separately from _buildTabContent so the
   * scroll mask in create() can use the identical rect.
   */
  _contentRectFor(key) {
    if (!FULL_BLEED.has(key)) {
      return { x: this._contentX, y: this._contentY, w: this._contentW, h: this._contentH };
    }
    const colW = Math.round(SCREEN_W / 3) - 20;
    // The survival mini-bars run y 44..92 (see _drawSurvivalMini: by = 44,
    // 4 rows at gap 13, bar height 9).  Starting the item column at 74 put
    // the first button straight over the bottom two bars, so Drinks and Food
    // were unreadable in every storefront.  Clear them by starting below 92.
    //
    // The garage menus (FAP, Les Schwasted) are excluded per owner: they have
    // their own taller bottom band and category strip, and their first row
    // already sits clear.
    const garage = GARAGE_KEYS.has(key);
    const top    = garage ? 74 : 98;
    // Reclaim the dead strip under the column at the same time.  Nothing else
    // occupies the left third down here — the continue button (SCREEN_H-30),
    // the JOBS block and the status line are centred or right-aligned — so the
    // list can run lower and ends up TALLER than before despite starting later.
    const bottomBand = garage ? 108 : 52;
    return { x: 10, y: top, w: colW, h: SCREEN_H - top - bottomBand };
  }

  _buildTabContent(key, x, y, w, h) {
    const items = SECTIONS[key].items;
    if (FULL_BLEED.has(key)) {
      const r = this._contentRectFor(key);
      x = r.x; y = r.y; w = r.w; h = r.h;
    }
    // TWO columns whenever one column would squeeze rows unreadably thin
    // (2026-07-16: AM/BM + camp menus were cutting descriptions off) —
    // fewer, TALLER buttons beat many crushed ones.
    // Two-column shops (owner 2026-07-17): vices + the ones that were still
    // stretching buttons full-width — gas (Huff's), hunting (CowBella),
    // AM/BM, Park & Ride. Anything with >6 items also splits regardless.
    const TWO_COL = new Set(['vices', 'gas', 'hunting', 'ambm', 'parkride']);
    const cols  = FULL_BLEED.has(key) ? 1 : ((TWO_COL.has(key) || items.length > 6) ? 2 : 1);
    const rows  = Math.ceil(items.length / cols);
    const cellW = (w - (cols - 1) * 6) / cols;
    const cellH = FULL_BLEED.has(key)
      ? 52                                     // fixed row height; the column scrolls
      : Math.min(56, Math.max(30, (h - (rows - 1) * 6) / rows));
    const objs  = [];
    const rowRecs = [];
    items.forEach((item, i) => {
      const r  = Math.floor(i / cols);
      const c  = i % cols;
      const cx = x + c * (cellW + 6);
      const cy = y + r * (cellH + 6);
      const created = this._makeButton(cx, cy, cellW, cellH, item, key);
      created.forEach(o => objs.push(o));
      // Offsets from the row's top let a category filter restack the column
      // without rebuilding every button.
      rowRecs.push({ item, objs: created, dy: created.map(o => (o.y ?? 0) - cy) });
    });
    if (GARAGE_KEYS.has(key)) {
      (this._garageRows ??= {})[key] = { rows: rowRecs, x, y, cellH };
    }
    return objs;
  }

  _makeButton(x, y, w, h, item, bizKey) {
    const bg = this.add.rectangle(x, y, w, h, 0x2A1808)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const created = [bg];
    // Metal skin, dressed AFTER the labels exist so they can ride the lift —
    // see the Metal.dress call at the end of this method.
    this._pendingMetal = { bg, labels: [] };
    let textX = x + 12;

    // Icon image (vice or weapon texture).  Falls back to the emoji prefix
    // if the texture isn't loaded.
    const iconSize = Math.min(h - 10, 36);
    if (item.icon && this.textures.exists(item.icon)) {
      const img = this.add.image(x + 8 + iconSize / 2, y + h / 2, item.icon)
        .setOrigin(0.5);
      // Scale so the long edge fits iconSize.
      const tex   = this.textures.get(item.icon).source[0];
      const baseW = tex?.width  || iconSize;
      const baseH = tex?.height || iconSize;
      const k     = iconSize / Math.max(baseW, baseH);
      img.setDisplaySize(baseW * k, baseH * k);
      created.push(img);
      textX = x + 8 + iconSize + 8;
    } else if (item.emoji) {
      const emo = this.add.text(x + 8 + iconSize / 2, y + h / 2, item.emoji, {
        fontSize: `${Math.round(iconSize * 0.7)}px`, fontFamily: 'Arial',
      }).setOrigin(0.5);
      created.push(emo);
      textX = x + 8 + iconSize + 8;
    }

    const compact = h <= 40;
    const label = this.add.text(textX, y + (compact ? h / 2 - 6 : 6), item.label, {
      fontSize: compact ? '12px' : '14px', fontFamily: IMPACT,
      color: '#FFEEAA', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0);
    const desc = this.add.text(textX, y + (compact ? h / 2 + 7 : 28), item.desc, {
      fontSize: compact ? '9px' : '10px', fontFamily: 'Arial', color: '#CCBB88',
    }).setOrigin(0, 0);
    // Ride the 2 px hover lift with the plate; without this the plate moves and
    // the text stays put, which reads as the label peeling off the button.
    this._pendingMetal?.labels.push(label, desc);
    // Custom used to zero every shop price (`freeMode`).  Removed 2026-07-28
    // (owner): items COST MONEY in Custom, at their real price, and that price is
    // what's displayed.  The wallet just never depletes — see `_infiniteMoney` at
    // the charge site below — so everything stays affordable without the shop
    // pretending to be free.
    // Genre-vehicle repair discount (pop-punk −25%): applied to the effective
    // cost so display, affordability, and charge all stay consistent. Only
    // REPAIR items here; garage part-upgrades are discounted in UpgradeSystem.
    const _repairMult = (item.payload?.repair || item.payload?.campRepair || item.payload?.upgradeInstall)
      ? ((this.registry.get('genreTraitMods') ?? {}).repairUpgradeCostMult ?? 1)
      : 1;
    const effectiveCost = Math.max(0, Math.round((item.cost ?? 0) * _repairMult));
    const disabled = !!item.disabled;            // set per-item when the
                                                  // purchase would be a
                                                  // no-op or downgrade.

    // -5: the price sat on the baseline of the description text and collided
    // with long descriptions (and with the wider "FREE" string).
    //
    // A disabled row normally reads "N/A", but the upgrade ladder needs two
    // exceptions (owner 2026-08-04): a LOCKED tier still quotes its real price
    // (`showCost`) so you can see what you're saving toward, and an OWNED tier
    // says so outright (`disabledCostText: 'OWNED'`).
    const priceStr = effectiveCost > 0 ? `$${effectiveCost}` : 'FREE';
    // Stashed so the confirm modal shows the SAME number the row does — the
    // genre repair discount is applied here, and reading item.cost in the
    // modal would quote the undiscounted price.
    item._shownCost = effectiveCost;
    const cost = this.add.text(x + w - 8, y + h / 2 - 5,
      !disabled || item.showCost ? priceStr : (item.disabledCostText ?? 'N/A'), {
        fontSize: compact ? '11px' : '13px', fontFamily: IMPACT,
        color: '#FFEE00', stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0.5);
    created.push(label, desc, cost);
    // Handles for cross-row updates — installing a tier has to retitle the row
    // BELOW it (see _unlockTier), which can't reach these through its own
    // closure.  Rebuilt every time the row is built, and every reader checks
    // `.scene` first because a destroyed row keeps its stale refs.
    item._ui = { bg, label, desc, cost };

    // item.disabled is read LIVE (not the build-time `disabled` const) so a
    // purchase can flip it — e.g. REFUEL greys itself out after one buy.
    // Forward-declared: refresh() runs on every wallet change and needs to
    // restyle the plate, but the skin can only be built once the labels exist.
    let skin = null;
    const refresh = () => {
      // Row may have been DESTROYED (screen rebuild) while this callback stays
      // registered in _buttonRefresh — touching a destroyed Text crashes
      // Phaser in updateUVs (seen scrolling the FAP shop).  Destroyed objects
      // have no scene; bail for the whole row.
      if (!bg.scene || !label.scene || !cost.scene) return;
      const ok = !item.disabled && this._score >= effectiveCost;
      // Affordability now reads through the metal tone rather than a flat
      // fill on the hit rectangle — setting a fill there would paint a solid
      // plate straight over the skin.
      skin?.set(ok ? 'idle' : 'disabled');
      if (skin) skin.tone = ok ? 'gold' : 'off';
      label.setAlpha(ok ? 1 : 0.45);
      desc.setAlpha(ok ? 1 : 0.45);
      cost.setColor(item.disabled ? '#886622'
                   : effectiveCost === 0 ? '#88FFCC'
                   : (ok ? '#FFEE00' : '#886622'));
    };
    refresh();
    this._buttonRefresh.push(refresh);

    // Hover/press visuals are the metal skin's job now (Metal.dress wires
    // them). The old handlers set a solid fill on the hit rectangle, which
    // would paint straight over the plate. refresh() is still called on out so
    // affordability/label state stays live.
    bg.on('pointerout',  () => refresh());
    // Buy fires on pointerUP, not pointerdown (owner 2026-07-29: scrolling the
    // item list was instantly purchasing whatever sat under the finger at the
    // START of the swipe). The scene-global drag/scroll listener (create(),
    // ~line 1249) is a SEPARATE, scene-wide 'pointerdown' handler that fires
    // regardless of which object the touch lands on — it already tracks the
    // drag independently of this button, so this button needs no pointerdown
    // handler of its own at all. Gating on TAP_MAX_DRIFT distinguishes "tap
    // this button" from "started a scroll here": a real tap barely moves
    // between down and up; a scroll swipe moves well past this in every case.
    const TAP_MAX_DRIFT = 12;
    bg.on('pointerup', (ptr, _x, _y, ev) => {
      this._eatTap(ptr, ev);
      // The press that opened THIS screen doesn't get to buy on the way out
      // (see MENU_GATE_MS) — that's the tap landing on two screens at once.
      if (this._tapBlocked(ptr)) return;
      if (ptr.getDistance() > TAP_MAX_DRIFT) return;   // was a scroll, not a tap
      if (item.disabled) {
        this._flash(bg, 0xFF4444);
        this._setStatus(item.disabledReason ?? 'Not available right now.', '#FF6666');
        return;
      }
      if (this._score < effectiveCost) {
        this._flash(bg, 0xFF4444);
        this._setStatus(`Need $${effectiveCost - this._score} more!`, '#FF6666');
        return;
      }
      // Customers-only restroom gate — must buy something at this stop first.
      if (item.payload?.restroom && item.payload.gated
          && this._restroomGated && !this._boughtAt.has(bizKey)) {
        this._flash(bg, 0xFF4444);
        this._setStatus('🚻 CUSTOMERS ONLY', '#FF6666', true);
        return;
      }
      // Everything from here down is the COMMIT half of the tap — charging,
      // stats, applying the item, greying out single-use rows.  It now runs
      // only after the player confirms (owner 2026-08-03): the tap itself
      // just asks.  NO closes the popup with nothing bought or applied.
      const doBuy = () => {
        if (effectiveCost > 0) {
          // Custom: the purchase is REAL (price charged to stats, business
          // unlocked, item applied) but the wallet doesn't drain — money in the
          // sandbox is unlimited, not free.  Everything else about the buy is
          // untouched, so prices, affordability and spend tracking stay honest.
          if (!this._infiniteMoney()) this._score -= effectiveCost;
          if (bizKey) this._boughtAt.add(bizKey);   // unlocks THIS business's restroom only
          const _si = this._statsSpendInfo(item);
          this._stats?.recordSpend(effectiveCost, _si.category, _si.subId);
        }
        this._refreshScore();
        this._buyOutcomeMsg = null;   // _applyPurchase may stash one (see below)
        this._applyPurchase(item);
        // REFUEL fills the tank fully and is SINGLE-USE (owner 2026-07-17):
        // grey it out + relabel so it can't be bought again this visit.
        if (item.payload?.refuel) {
          item.disabled = true;
          item.disabledReason = '⛽ Tank\'s already full.';
          label.setText('⛽  TANK FULL');
          desc.setText('Topped off.');
          cost.setText('N/A');
        }
        if (item.payload?.repair) {
          item.disabled = true;
          item.disabledReason = 'Car is already at full health.';
          label.setText('✓  CAR REPAIRED');
          desc.setText('Restored to full health.');
          cost.setText('N/A');
        }
        // Part installed — the row becomes an inert ✓ OWNED rung and the tier
        // BELOW it unlocks in place (owner 2026-08-04).  It used to fade the
        // whole row out after 3 s, which made sense when the shop listed only
        // the next tier; in the full-ladder view that left a hole between
        // "✓ Lv1" and "🔒 Lv3", so the rung now stays put and just flips state.
        if (item.payload?.upgradeInstall || item.payload?.vehicleAccessory) {
          // Some parts are shelved at MORE THAN ONE storefront as separate row
          // objects (bumper at Finesse + Sam's; windshield/headlights/wipers L1
          // at Sam's too), so marking only the tapped row left the sibling
          // buyable — a second $4k bumper in the same visit bought nothing
          // (owner 2026-08-11). Flip every same-id row to ✓ OWNED.
          for (const _k of ['schwasted', 'fap', 'sam_acc']) {
            for (const _it of (SECTIONS[_k]?.items ?? [])) {
              if (_it.id === item.id) this._markRowOwned(_it);
            }
          }
          if (item.slot && item.lvl) this._unlockTier(item.slot, item.lvl + 1);
        }
        // Genre car bought/swapped — this row becomes YOUR RIDE for the visit.
        // (Other rows re-derive owned/active state on the next stop.)
        if (item.payload?.buyGenre || item.payload?.driveGenre) {
          item.disabled = true;
          item.disabledReason = 'Already driving it.';
          label.setText('✓  YOUR RIDE');
          desc.setText(item.payload?.buyGenre ? 'Keys in hand — drove it off the lot.' : 'Swapped in.');
          cost.setText('N/A');
        }
        this._showMenuPopup(this._purchaseConfirmation(item), '#88FF88');
        this._flash(bg, 0x44FF44);
        this._buttonRefresh.forEach(fn => fn());
      };
      this._confirmBuyPopup(item, doBuy);
    });

    // Gold tone for a buyable rung, flat 'off' for a disabled/owned one, so
    // affordability still reads at a glance the way the old blue/red did.
    Metal.ensureNoise(this);
    const affordNow = !item.disabled && this._score >= effectiveCost;
    skin = Metal.dress(this, bg, {
      tone: affordNow ? 'gold' : 'off',
      state: affordNow ? 'idle' : 'disabled',
      chamfer: 5,
      labels: this._pendingMetal?.labels ?? [],
    });
    this._pendingMetal = null;
    created.push(skin.gfx);

    return created;
  }

  /**
   * Purchase confirmation (owner 2026-08-03): tapping a storefront item asks
   * "You'd like a(n) X?" before anything is charged or applied.  YES runs the
   * exact buy path the tap used to run directly; NO closes the popup and the
   * item is neither purchased nor procured.  The affordability / disabled /
   * customers-only guards still run BEFORE this, so a row you can't buy keeps
   * its immediate red-flash feedback and never opens a popup.
   */
  _confirmBuyPopup(item, onYes) {
    if (this._confirmObjs) return;               // one popup at a time
    // Item name for the prompt — the row label minus its emoji prefix.
    const name = item.label.replace(/[^\w' ]/g, ' ').replace(/\s+/g, ' ').trim();
    const art  = /^[aeiou]/i.test(name) ? 'an' : 'a';
    const CX = SCREEN_W / 2, CY = SCREEN_H / 2, D = 900;
    const objs = this._confirmObjs = [];

    // Full-screen dim, interactive so taps can't reach the shop behind it.
    // Oversized so the widened-canvas margins (HUD_OFFSET_X) are covered too.
    objs.push(this.add.rectangle(CX, CY, SCREEN_W * 3, SCREEN_H * 3, 0x000000, 0.55)
      .setDepth(D).setInteractive());
    // ── Charcoal metal panel (Overview Ch.15) ───────────────────────────
    // Shorter than the old 400×158 flat blue box: the heading is one line and
    // the price sits under it, so the panel does not need the height.
    const PW = 400, PH = 124;
    Metal.ensureNoise(this);
    const panel = this.add.graphics().setDepth(D - 0.1);
    Metal.paint(panel, CX - PW / 2, CY - PH / 2, PW, PH,
                { tone: 'neutral', panel: true, chamfer: 10 });
    // Brushed grain, low alpha, clipped to the panel so it cannot bleed past
    // the chamfer. One shared 64×64 tile — see MetalUI.ensureNoise.
    const grain = this.add.tileSprite(CX, CY, PW - 4, PH - 4, '__metal_noise')
      .setAlpha(0.05).setDepth(D - 0.05);
    objs.push(panel, grain);

    // Per-item verb. The old copy was `You'd like a(n) X?` for everything —
    // this modal serves parts, food, fuel, hires and whole vehicles, so
    // "INSTALL NEW WINDSHIELD?" only fits some of them.
    const p = item.payload ?? {};
    const verb = (p.upgradeInstall || p.vehicleAccessory) ? 'INSTALL'
               : p.refuel   ? 'FILL'
               : p.repair   ? 'REPAIR'
               : (p.buyGenre || p.driveGenre) ? 'TAKE'
               : p.hitchhike ? 'PICK UP'
               : 'BUY';
    const heading = `${verb} ${name.toUpperCase()}?`;
    objs.push(this.add.text(CX, CY - 34, heading, {
      fontSize: '19px', fontFamily: IMPACT, color: '#E6F2FA',
      stroke: '#000', strokeThickness: 4,
      wordWrap: { width: 356 }, align: 'center',
    }).setOrigin(0.5).setDepth(D));
    // Price beneath the heading, per the brief.
    const shown = item._shownCost ?? item.cost ?? 0;
    objs.push(this.add.text(CX, CY - 10, shown > 0 ? `$${shown.toLocaleString()}` : 'FREE', {
      fontSize: '15px', fontFamily: IMPACT, color: '#C9A24A',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(D));

    const close = () => {
      (this._confirmObjs ?? []).forEach(o => o?.destroy());
      this._confirmObjs = null;
    };
    // Same tap discipline as the shop rows: buy on pointerUP with a drift
    // gate, and eat the tap so it can't fall through to whatever is behind.
    const TAP_MAX_DRIFT = 12;
    const mkBtn = (x, txt, tone, cb) => {
      const b = this.add.rectangle(x, CY + 26, 150, 40)
        .setDepth(D).setInteractive({ useHandCursor: true });
      const t = this.add.text(x, CY + 26, txt, {
        fontSize: '18px', fontFamily: IMPACT, color: Metal.TONE[tone].text,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(D + 0.1);
      const skin = Metal.dress(this, b, { tone, chamfer: 6, labels: [t] });
      skin.gfx.setDepth(D - 0.05);
      objs.push(b, t, skin.gfx);
      b.on('pointerup', (ptr, _x, _y, ev) => {
        this._eatTap(ptr, ev);
        if (ptr.getDistance() > TAP_MAX_DRIFT) return;
        cb();
      });
    };
    // INSTALL / CANCEL, not YES / NO (owner, 2026-08-12). The affirmative
    // tracks the per-item verb so a burrito never says INSTALL.
    mkBtn(CX - 88, verb, 'go', () => { close(); onYes(); });
    mkBtn(CX + 88, 'CANCEL', 'stop', close);
  }

  _purchaseConfirmation(item) {
    // An outcome stashed by _applyPurchase (robbed at the pump, bonus HP, a
    // detector installed) beats the generic "✓ BOUGHT X" line — one card per
    // purchase, and it's the one carrying the news.
    if (this._buyOutcomeMsg) return this._buyOutcomeMsg;
    if (item.payload?.popcorn) return this._popcornMsg ?? '🍿 Free popcorn.';
    if (item.payload?.hitchhike) {
      const outcome = this._rollHitchhiker();
      return outcome.message;
    }
    if (item.payload?.restroom) return this._restroomMsg ?? '🚽 Sweet relief.';
    return `✓ ${item.label.replace(/[^\w ]/g, '').trim()}`;
  }

  /**
   * Hitchhiker pickup — SEALS the outcome instead of resolving it here.
   *
   * The roll is made now but handed to GameScene unopened; it lands
   * HITCH_REVEAL_MILES down the road (owner spec, 2026-07-27), so the player
   * drives off not knowing whether they just helped themselves or got taken.
   * The outcome TABLE now lives in GameScene._applyRestStopHitchOutcome —
   * resolving it here would apply effects (and record stats) at purchase time,
   * which is exactly the reveal we're deferring.
   */
  _rollHitchhiker() {
    this._purchases.hitchhiker = { roll: Math.random() };
    return { message: '🧍 They hop in. Whatever this is, you\'ll find out down the road…' };
  }

  /** Map a shop item to its stats spend bucket.  Vice top-ups and weapon
   *  (f12) buys carry a sub-id for the per-item breakdown; vehicles and
   *  accessories roll up to their category total; everything else (repair,
   *  refuel, coffee, sleep, hot springs, clear-stars, …) is a service. */
  _statsSpendInfo(item) {
    const p = item?.payload ?? {};
    if (p.viceTopUp)        return { category: 'vices',       subId: p.viceTopUp };
    if (p.f12)              return { category: 'weapons',     subId: p.f12 };
    if (p.buyVehicle)       return { category: 'vehicles',    subId: p.buyVehicle };
    if (p.vehicleAccessory) return { category: 'accessories', subId: p.vehicleAccessory };
    // Split out of the old services catch-all (owner 2026-07-29, trip-summary
    // directive) — the three buckets a "% spent on gas/repairs/upgrades"
    // stat actually needs.  Everything else genuinely IS a grab-bag
    // (restroom, coffee, snooze, passport, radar, hitchhiker...) and stays
    // 'services'.
    if (p.refuel)         return { category: 'gas',      subId: 'refuel' };
    if (p.coolEngineFrac) return { category: 'gas',      subId: 'oil' };          // pint of oil, sold at the pump
    if (p.repair)         return { category: 'repairs',  subId: 'dealer' };
    if (p.campRepair)     return { category: 'repairs',  subId: 'camp' };
    if (p.restHp)         return { category: 'repairs',  subId: 'hotsprings' };   // bonus HP, same "kept the car alive" bucket
    if (p.upgradeInstall) return { category: 'upgrades', subId: p.upgradeInstall };
    return { category: 'services', subId: null };
  }

  _applyPurchase(item) {
    const p = item.payload;
    if (!p) return;
    if (p.restroom) {
      // Empties the bladder on resume, but relieving TAKES TIME: the fuller you
      // are, the more party-clock time it costs — 30s at a full bladder, scaled
      // down proportionally (half full = 15s).  Small chance of an "epic deuce"
      // wanted star.
      this._purchases.emptyBladder = true;
      const costSec = Math.round(30 * Math.max(0, Math.min(100, this._bladderAtEntry)) / 100);
      if (costSec > 0) this._purchases.partyClockPenalty = (this._purchases.partyClockPenalty ?? 0) + costSec;
      if (Math.random() < 0.08) {
        this._purchases.bumpStarsOnResume = (this._purchases.bumpStarsOnResume ?? 0) + 1;
        this._restroomMsg = `💩 EPIC DEUCE! Someone called the cops. +1★ — but sweet relief. (−${costSec}s)`;
      } else {
        this._restroomMsg = `🚽 Ahhh… sweet relief. Bladder emptied. (−${costSec}s)`;
      }
      this._drawSurvivalMini();   // bladder bar drains on the landing HUD
    }
    if (p.popcorn) {
      // Free popcorn heals 1% of MAX health a serving, capped at
      // POPCORN_MAX_PCT of max per visit.  Routed through the SAME
      // durabilityOnResume channel the paid repair uses, so it can never
      // stack past the vehicle's ceiling and GameScene needs no new case.
      const _max     = this._vehMaxHp();
      const _already = this._purchases.popcornHealed ?? 0;
      const _room    = Math.max(0, _max * POPCORN_MAX_PCT - _already);
      const _gain    = Math.min(_max * POPCORN_PER_SERVE, _room);
      if (_gain > 0) {
        this._purchases.popcornHealed = _already + _gain;
        const _cur = this._purchases.durabilityOnResume ?? this._durabilityAtEntry ?? _max;
        this._purchases.durabilityOnResume = Math.min(_max, _cur + _gain);
        this._popcornMsg = `🍿 +${_gain.toFixed(1)} HP. Free refills, tiny miracles.`;
      } else {
        this._popcornMsg = "🍿 You've had enough popcorn. Buy a real repair.";
      }
      this._refreshScore?.();
    }
    if (p.repair) {
      this._purchases.repair             = true;
      // Restore to the actual vehicle's max HP, not the legacy 100.
      // playdoutS3X has 125 HP, so a flat 100 silently capped a "full
      // repair" at 80 % of capacity for that vehicle.
      this._purchases.durabilityOnResume = this._vehMaxHp();
    }
    if (p.coffee) {
      // `coffee: true` on the payload used to do nothing at all — only
      // survivalDelta (the Alertness bump) actually fired. Owner 2026-07-31:
      // each cup should also add a real (if small, capped, fading) speed
      // bonus. Counted here so GameScene can start each cup's own 30s dose
      // clock fresh on resume (ViceSystem.noteCoffeePurchase), same as
      // every other "applies on resume" purchase in this function.
      this._purchases.coffeeCount = (this._purchases.coffeeCount ?? 0) + 1;
    }
    // ── Phase 2-4 payloads ────────────────────────────────────────
    if (p.refuel) {
      this._purchases.refuelToFull = true;
      // 10% robbery roll — drains a fraction of the player's cash.
      // Done here so the popup ("ROBBED!") fires alongside the refuel.
      // Skipped in Custom: it's a no-score sandbox where everything is free,
      // so a robbery would only chew into the $100k seed (owner 2026-07-27).
      if (Difficulty.noScore?.() !== true && Math.random() < GAS_ROBBERY_CHANCE) {
        const loss = Math.floor(this._score * GAS_ROBBERY_FRAC);
        this._score = Math.max(0, this._score - loss);
        this._stats?.recordRobbery(loss);
        this._refreshScore();
        this._buyOutcomeMsg =
          `⛽ Tank filled.\n\n💀 You were robbed when counting your cash.\n−$${loss.toLocaleString()}`;
      }
    }
    // (The ad-gated NAP IT OFF and its `sleep` payload are gone — TAKE A
    // SNOOZE is a paid item, so nothing sets sleepAdMs any more.  GameScene's
    // resume still honours the field if a future item wants an ad gate.)
    // COFFEE: alertness-only — its survivalDelta handles the boost; no
    // party-clock penalty and no vice reduction anymore.
    if (p.campRepair) {
      // Repair to 65 % of the CURRENT vehicle's max HP, not a flat 65
      // points — otherwise low-HP cars (Beater = 50 max) get clamped to
      // full when setDurability(65) caps against _max.  Never DECREASE
      // current durability.
      const vehMax = this._vehMaxHp();
      const target = Math.round(vehMax * 0.65);
      this._purchases.durabilityOnResume = Math.max(this._purchases.durabilityOnResume ?? 0, target);
    }
    // Buff bought over a counter rather than handed over in a conversation —
    // same channel the encounter cards use, so GameScene needs no new case.
    if (p.encounterBuff) {
      this._purchases.encounterBuffs = [...(this._purchases.encounterBuffs ?? []), p.encounterBuff];
    }
    // Absolute engine-temperature drop (coolant). The pint of oil below is the
    // fractional version; both land in _purchases and GameScene applies them.
    if (p.coolEngine) {
      this._purchases.coolEngine = (this._purchases.coolEngine ?? 0) + p.coolEngine;
    }
    if (p.coolEngineFrac) {
      // Pint of oil: −5% engine heat per pint; stacks additively (two pints
      // = −10%).  GameScene resume multiplies _engineTemp by (1 − total).
      this._purchases.coolEngineFrac =
        Math.min(0.9, (this._purchases.coolEngineFrac ?? 0) + p.coolEngineFrac);
    }
    if (p.tractionTires) {
      // Legacy payload (global flag) — kept so existing call sites don't
      // break, but the new per-vehicle path below is the real source.
      this._purchases.tractionTires = true;
    }
    if (p.vehicleAccessory) {
      // Per-vehicle accessory purchase (bumper / traction / nos).  Write
      // directly into the per-mode save profile under accessories[vid]
      // so the new VehicleId carries it across runs.
      const save = this.registry?.get?.('save');
      if (save) {
        const all = save.get('accessories') ?? {};
        const cur = all[this._vehicleId] ?? {};
        if (p.vehicleAccessory === 'bumper')   cur.bumper   = true;
        if (p.vehicleAccessory === 'traction') cur.traction = true;
        if (p.vehicleAccessory === 'nos') {
          // Install the tier the ROW names (p.nosTier), not "one more than
          // whatever's fitted".  The blind increment let a repeated tap on the
          // level-1 row walk up to tier 3 at the level-1 price; Math.max keeps
          // it a ratchet so a stale row can never demote an installed kit.
          cur.nos = Math.max(cur.nos ?? 0, Math.min(3, p.nosTier ?? ((cur.nos ?? 0) + 1)));
        }
        all[this._vehicleId] = cur;
        save.set('accessories', all);
      }
      // Stash a flag GameScene reads on resume so the HUD updates
      // immediately if needed.  Rebuilds shop card on next visit.
      this._purchases.accessoryRefresh = true;
    }
    if (p.camouflage) {
      // Single-shot star clear — implemented as "drop 2 stars on resume".
      // GameScene reads this and subtracts from the entry star count.
      this._purchases.starsToDrop = (this._purchases.starsToDrop ?? 0) + 2;
    }
    if (p.radar) {
      // Buy-once GLOBAL gadget — persist straight to the save's global bucket
      // so it carries across every run + vehicle.  GameScene reads
      // `radarDetector` on init to arm the speed-trap warning.
      this.registry?.get?.('save')?.set?.('radarDetector', true);
      this._purchases.radarBought = true;
      this._buyOutcomeMsg = '📡 RADAR DETECTOR installed — it\'ll warn you before speed traps.';
    }
    if (p.buyVehicle) {
      this._purchases.boughtVehicles = this._purchases.boughtVehicles ?? [];
      this._purchases.boughtVehicles.push(p.buyVehicle);
    }
    if (p.restHp) {
      // Grants +10 bonus HP — extra above the vehicle's max, consumed by crash
      // damage before regular HP (see DamageModel takeDamage).  Stacks across
      // multiple soaks.
      this._purchases.bonusHp = (this._purchases.bonusHp ?? 0) + (p.bonusHp ?? 10);
      this._buyOutcomeMsg = `♨️ +${p.bonusHp ?? 10} bonus HP. Relaxed and refreshed.`;
    }
    if (p.restock)    this._purchases.restock = true;
    if (p.clearStars) this._purchases.clearStars = true;
    if (p.scoreBonus) this._purchases.scoreBonus += p.scoreBonus;
    if (p.f12) {
      // f12Count lets a single purchase stack multiple tokens (Fireworks
      // ship 3 shows per buy).  Defaults to 1 for the rest.
      const _f12N = Math.max(1, Math.floor(p.f12Count ?? 1));
      for (let _i = 0; _i < _f12N; _i++) this._purchases.f12.push(p.f12);
    }
    if (p.upgrade)    this._purchases.upgrade.push(p.upgrade);
    if (p.upgradeInstall) {
      // Slot part-upgrade bought in the car shop — install straight into the
      // save (payment already deducted from this._score in the buy handler).
      // GameScene re-reads the save via _recomputeUpgradeFx on resume; the
      // flag forces that recompute so the upgrade affects the drive at once.
      const save = this.registry?.get?.('save');
      // Custom mode is a sandbox: route the install to tempUpgrades so it
      // works for the rest of THIS run but never persists into Easy/Normal.
      if (save) buyUpgrade(save, this._vehicleId, p.upgradeInstall,
                           { forceTemp: Difficulty.mode?.() === 'custom' });
      this._purchases.upgradeRecompute = true;
    }
    if (p.buyGenre || p.driveGenre) {
      // Genre car — a buy unlocks the culture for the plate; either way you
      // drive it off the lot NOW.  __genre.set persists the pick, swaps the
      // live art on the (sleeping) GameScene, and refreshes the ride traits.
      const culture = p.buyGenre ?? p.driveGenre;
      if (p.buyGenre) window.__genre?.own?.(culture);
      window.__genre?.set?.(culture);
      this._purchases.upgradeRecompute = true;   // top speed / HP re-derive on resume
    }
    if (p.viceTopUp) {
      // Per-vice top-up: each click ADDS p.amount (+10%) up to a cap of
      // 0.80.  Multiple clicks accumulate — the GameScene reads the
      // final amount on resume and bumps the bar to that level.
      this._purchases.viceTopUps = this._purchases.viceTopUps || {};
      const cur = this._purchases.viceTopUps[p.viceTopUp] ?? 0;
      this._purchases.viceTopUps[p.viceTopUp] = Math.min(0.80, cur + (p.amount ?? 0.10));
    }
    if (p.survivalDelta) {
      // Shop food/drink/coffee → survival bars (same channel the encounter
      // food uses); mini bars redraw immediately so the buy is VISIBLE.
      const d = (this._purchases.survivalDelta ??= {});
      for (const k of ['hydration', 'fullness', 'tiredness']) {
        if (p.survivalDelta[k]) d[k] = (d[k] ?? 0) + p.survivalDelta[k];
      }
      this._drawSurvivalMini?.();
    }
    if (typeof p.reduceVices === 'number') {
      // Multiplier on every vice bar at resume.  Multiple buys multiply
      // (so 2× coffee = ×0.25; coffee + snooze = ×0).  Lowest multiplier
      // wins effectively because they multiply.
      const cur = this._purchases.reduceVices ?? 1;
      this._purchases.reduceVices = cur * p.reduceVices;
    }
    // hitchhike outcome handled in _purchaseConfirmation → _rollHitchhiker
  }

  /** Custom mode: the wallet never depletes (owner 2026-07-28).  Prices are
   *  real and charged for display / stats / affordability — this only suppresses
   *  the actual subtraction.  Mirrors GameScene._cashLoss for the shop side. */
  _infiniteMoney() {
    return Difficulty.noScore?.() === true;
  }

  _refreshScore() {
    this._scoreText.setText(`CASH: $${this._score.toLocaleString()}`);
  }

  /** Compact survival bars for the landing menu — no labels, just the drive
   *  HUD's colors in its top→bottom order (Alertness / Bladder / Drinks /
   *  Food) at ~60% scale.  Values = entry snapshot + this visit's purchases
   *  (restroom empty, encounter food/drink survivalDelta), so the bars
   *  live-update while shopping. */
  _drawSurvivalMini() {
    const g = this._survMiniGfx;
    if (!g) return;
    const e = this._survAtEntry
      ?? { tiredness: 0, hydration: 50, fullness: 50, bladder: this._bladderAtEntry ?? 0 };
    const d  = this._purchases?.survivalDelta ?? {};
    const cl = (v) => Math.max(0, Math.min(100, v));
    // Same row colors as GameScene._drawSurvivalBars (danger recolors too).
    const rows = [
      { v: cl(100 - (e.tiredness + (d.tiredness ?? 0))), col: (e.tiredness + (d.tiredness ?? 0)) >= 70 ? 0xE0483C : 0x9A5FE8 },
      { v: this._purchases?.emptyBladder ? 0 : cl(e.bladder), grad: true },
      { v: cl(e.hydration + (d.hydration ?? 0)), col: 0x39C0D9, dual: true },
      { v: cl(e.fullness  + (d.fullness  ?? 0)), col: 0xE0902E, dual: true },
    ];
    const lerpRGB = (a, b, t) => {
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
      return (Math.round(ar + (br - ar) * t) << 16)
           | (Math.round(ag + (bg - ag) * t) << 8)
           |  Math.round(ab + (bb - ab) * t);
    };
    // ~60% of the drive-HUD block, upper-LEFT below the ← BACK button.
    // (Was right-aligned under the 🔧 HP readout, where wide phones
    // clipped it past the right screen edge.)
    const bw = 110, bh = 9, gap = 13;
    const bx = 30, by = 44;
    g.clear();
    rows.forEach((r, i) => {
      const y = by + i * gap;
      g.fillStyle(0x0A0F1A, 0.8); g.fillRoundedRect(bx, y, bw, bh, 2);
      const frac = r.v / 100;
      if (r.grad) {   // bladder: pee-yellow → poop-brown, position-based
        const SEG = 16;
        for (let sIdx = 0; sIdx < SEG; sIdx++) {
          const t0 = sIdx / SEG;
          if (t0 >= frac) break;
          const t1 = Math.min((sIdx + 1) / SEG, frac);
          g.fillStyle(lerpRGB(0xF2D338, 0x5A3212, t0), 1);
          g.fillRect(bx + 1 + t0 * (bw - 2), y + 1, Math.max(0.6, (t1 - t0) * (bw - 2)), bh - 2);
        }
      } else {
        g.fillStyle(r.col, 1); g.fillRoundedRect(bx + 1, y + 1, frac * (bw - 2), bh - 2, 2);
      }
      if (r.dual) {   // sweet-zone ticks at 25 / 75, like the drive HUD
        g.fillStyle(0x66FF99, 0.7);
        g.fillRect(bx + 1 + 0.25 * (bw - 2), y, 1.5, bh);
        g.fillRect(bx + 1 + 0.75 * (bw - 2), y, 1.5, bh);
      }
      g.lineStyle(1, 0x315173, 1); g.strokeRoundedRect(bx, y, bw, bh, 2);
    });
  }

  /** BIG celebratory payoff moment for an explicit drop-off (Ch. 8): a
   *  centered banner — flavor line, "YOU EARNED $X" at 40px, tip + REP
   *  progress ("Known 4/8"), and the tier-up copy when this collect crossed
   *  a rep threshold.  Auto-fades; tap anywhere to dismiss early. */
  _showPayoffBanner(m) {
    const D   = 620;
    const pay = m.payout + (m.tip ?? 0);
    const head = m.type === 'passenger'
      ? `🧍 ${m.passenger?.name ?? 'Passenger'} ${m.passenger?.dropoff ?? ''}`.trimEnd()
      : m.type === 'heat'
        ? '🔥 CLEAN GETAWAY — tail lost'
      : m.type === 'weather'
        ? `${m.terms?.weather_run?.tag === 'wind' ? '🌬 THROUGH THE WIND' : '🌨 OVER THE PASS'} — ${m.cargo}, intact`
      : (m.type === 'timed'
        ? `⚡ MADE IT — ${m.cargo}, inside the window`
        : `📦 DELIVERED — ${m.cargo}`);
    // REP progress toward the next rung; at Legend there's no next rung,
    // show the lifetime count (same string as the old drive-side payoff).
    const rep  = (this.registry.get('save')?.get?.('missionRep', {}) ?? {})[m.type] ?? 0;
    const tier = tierFor(rep);
    const next = MISSION_TIERS[MISSION_TIERS.indexOf(tier) + 1];
    const repStr = next ? `${tier.name} ${rep}/${next.minDone}` : `${tier.name} ${rep}`;
    const tipStr = (m.tip ?? 0) > 0 ? `+$${m.tip} tip  ·  ` : '';

    const objs = [];
    this._gateTaps();
    const scrim = this.add.rectangle(CX, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.72)
      .setDepth(D);
    objs.push(scrim);
    objs.push(this.add.text(CX, SCREEN_H * 0.28, head, {
      fontSize: '18px', fontFamily: IMPACT, color: '#F4F7FF',
      stroke: '#000', strokeThickness: 4, align: 'center',
      wordWrap: { width: SCREEN_W - 120 },
    }).setOrigin(0.5).setDepth(D + 1));
    objs.push(this.add.text(CX, SCREEN_H * 0.44, `YOU EARNED $${pay.toLocaleString()}`, {
      fontSize: '40px', fontFamily: IMPACT, fontStyle: 'bold', color: '#FFD23D',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(D + 1));
    objs.push(this.add.text(CX, SCREEN_H * 0.57, `${tipStr}REP ${repStr}`, {
      fontSize: '16px', fontFamily: IMPACT, color: '#66FF99',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(D + 1));
    // Tier-up moment (Ch. 8 Phase 6) — same celebratory copy as before:
    // "⭐ KNOWN COURIER — payouts ×2.5".  The REP line above already reads
    // the post-bump count, so "Known 3/8" and the banner agree.
    if (m.tierUp) {
      const job = { delivery: 'COURIER', timed: 'RUSH RUNNER', passenger: 'DRIVER',
                    heat: 'GETAWAY DRIVER', weather: 'STORM RUNNER' }[m.type] ?? 'COURIER';
      objs.push(this.add.text(CX, SCREEN_H * 0.68,
        `⭐ ${m.tierUp.name.toUpperCase()} ${job} — payouts ×${m.tierUp.mult}`, {
          fontSize: '22px', fontFamily: IMPACT, color: '#FFD23D',
          stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(D + 1));
    }
    let done = false;
    const dismiss = () => { if (done) return; done = true; this._gateTaps(); for (const o of objs) o?.destroy?.(); };
    this._swallowTaps(scrim, dismiss);
    this.time.delayedCall(3400, dismiss);
  }

  /** Two-button confirm before HIT THE ROAD abandons uncollected READY
   *  drop-offs — the route is one-way, so leaving fails them for good. */
  _showLeaveConfirm(ready) {
    const D = 640;
    const names = ready.map(m =>
      m.type === 'passenger' ? (m.passenger?.name ?? 'your passenger') : m.cargo).join(', ');
    const objs = [];
    const dismiss = () => { this._gateTaps(); for (const o of objs) o?.destroy?.(); };
    this._gateTaps();
    objs.push(this._swallowTaps(this.add.rectangle(CX, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.82)
      .setDepth(D)));
    const pw = 520, ph = 190;
    const panel = this.add.graphics().setDepth(D + 1);
    panel.fillStyle(0x060A14, 0.97); panel.fillRoundedRect(CX - pw / 2, SCREEN_H / 2 - ph / 2, pw, ph, 12);
    panel.lineStyle(3, 0xFFD23D, 1);  panel.strokeRoundedRect(CX - pw / 2, SCREEN_H / 2 - ph / 2, pw, ph, 12);
    objs.push(panel);
    objs.push(this.add.text(CX, SCREEN_H / 2 - ph / 2 + 24,
      `⚠️ You haven't dropped off ${names}!\nLeave anyway = job failed — no payout.`, {
        fontSize: '17px', fontFamily: IMPACT, color: '#FFEEAA',
        stroke: '#000', strokeThickness: 3, align: 'center',
        wordWrap: { width: pw - 40 }, lineSpacing: 6,
      }).setOrigin(0.5, 0).setDepth(D + 2));
    const btns = [
      { label: '← GO BACK', color: 0x44AA44, hover: 0x66CC66, act: () => {
          dismiss();
          // Re-arm the leave shortcuts the `once` handlers already consumed.
          this.input.keyboard?.once('keydown-ENTER', () => this._continue());
          this.input.keyboard?.once('keydown-SPACE', () => this._continue());
        } },
      { label: 'LEAVE ANYWAY', color: 0xAA3333, hover: 0xCC5555, act: () => {
          dismiss();
          this._leaveConfirmed = true;   // _continue fails them on the way out
          this._continue();
        } },
    ];
    btns.forEach((b, i) => {
      const bx = CX + (i === 0 ? -125 : 125);
      const byY = SCREEN_H / 2 + ph / 2 - 38;
      const bg = this.add.rectangle(bx, byY, 220, 40, b.color)
        .setStrokeStyle(3, 0xFFFFFF).setDepth(D + 2)
        .setInteractive({ useHandCursor: true });
      const lb = this.add.text(bx, byY, b.label, {
        fontSize: '17px', fontFamily: IMPACT, color: '#FFFFFF',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(D + 3);
      bg.on('pointerover', () => bg.setFillStyle(b.hover));
      bg.on('pointerout',  () => bg.setFillStyle(b.color));
      bg.on('pointerdown', (p, _x, _y, ev) => {
        this._eatTap(p, ev);
        if (this._tapBlocked(p)) return;
        b.act();
      });
      objs.push(bg, lb);
    });
  }

  /** Tap-to-dismiss message card — used for anything the player needs TIME to
   *  read: what they bought, a bonus they gained, a loss they took (owner
   *  2026-07-29).  The auto-fading `_setStatus` toast stays for rejections
   *  ("Need $40 more", "CUSTOMERS ONLY") so shopping doesn't cost a tap per
   *  mis-click.  This is menu-only — on the road, outcomes stay as GameScene's
   *  transient text, since there's nothing to pause for.
   *
   *  Queued: a purchase that reports both an outcome and a confirmation shows
   *  them in order rather than one card clobbering the other. */
  _showMenuPopup(msg, color = '#FFF6E0') {
    if (!msg) return;
    (this._menuPopupQueue ??= []).push({ msg, color });
    if (!this._menuPopupOpen) this._drainMenuPopup();
  }

  _drainMenuPopup() {
    const next = this._menuPopupQueue?.shift();
    if (!next) { this._menuPopupOpen = false; return; }
    this._menuPopupOpen = true;

    const D = 600;                     // above the encounter card (D = 500)
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    const dismiss = () => {
      this._gateTaps();
      for (const o of objs) { try { o.destroy(); } catch (_) {} }
      this._drainMenuPopup();          // show the next one, or close out
    };

    this._gateTaps();
    this._swallowTaps(add(this.add.rectangle(CX, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x02040B, 0.78)
      .setDepth(D)), dismiss);

    const pw = Math.min(660, SCREEN_W - 60);
    const txt = this.add.text(CX, 0, next.msg, {
      fontSize: '30px', fontFamily: '"Helvetica Neue", Arial, sans-serif',
      color: next.color, align: 'center', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
      wordWrap: { width: pw - 56 },
    }).setOrigin(0.5, 0).setDepth(D + 3);
    const hint = this.add.text(CX, 0, 'TAP TO CONTINUE', {
      fontSize: '18px', fontFamily: IMPACT, color: '#8FB7E6',
    }).setOrigin(0.5, 0).setDepth(D + 3);

    const ph = txt.height + hint.height + 62;
    const py = Math.max(20, SCREEN_H / 2 - ph / 2);
    const panel = add(this.add.graphics().setDepth(D + 1));
    panel.fillStyle(0x060A14, 0.96); panel.fillRoundedRect(CX - pw / 2, py, pw, ph, 14);
    panel.lineStyle(3, 0x39A8FF, 1);  panel.strokeRoundedRect(CX - pw / 2, py, pw, ph, 14);
    txt.setPosition(CX, py + 26);
    hint.setPosition(CX, py + ph - 30);
    add(txt); add(hint);
  }

  _setStatus(msg, color, big = false) {
    // `big` = attention-grabbing variant (e.g. CUSTOMERS ONLY): 40px, thicker
    // stroke, longer hold.  Normal buy/mission feedback is 34px — just under
    // the big variant and much larger than the old 11px (owner 2026-07-19).
    this._statusText.setText(msg).setColor(color)
      .setFontSize(big ? 40 : 34)
      .setFontStyle('bold')
      .setStroke('#000000', big ? 6 : 4);
    if (this._statusTimer) this._statusTimer.remove();
    this._statusTimer = this.time.delayedCall(big ? 3200 : 2400, () => {
      this._statusText.setText('').setFontSize(34).setFontStyle('normal').setStroke('#000000', 4);
    });
  }

  _flash(obj, color) {
    // Colorblind: the green (success) ↔ red (fail) buy-feedback pair is
    // unreadable for red-green CVD; remap to cyan (success) / amber (fail).
    if (this.registry.get('save')?.get?.('settings.colorblind', false) === true) {
      if      (color === 0x44FF44) color = 0x39C8FF;   // success → cyan
      else if (color === 0xFF4444) color = 0xFF8A00;   // fail → amber
    }
    const orig = obj.fillColor;
    obj.setFillStyle(color);
    this.time.delayedCall(120, () => obj.setFillStyle(orig));
  }

  _continue() {
    if (this._continuing) return;
    // No exit-mission pitch here anymore (removed 2026-07-30) — HIT THE ROAD
    // is a clean, uninterrupted exit. Missions are only found by walking into
    // this stop's mission shop; see _showShopGreeter / _missionShopKeyFor.
    // Uncollected READY drop-offs — the route is one-way, so leaving now
    // fails them for good.  Confirm first; LEAVE ANYWAY re-enters with the
    // flag set and fails them as 'not_delivered' (no payout, rep unchanged).
    const _ready = this.registry.get('missions')?.readyMissions?.(this._stop?.id) ?? [];
    if (_ready.length && !this._leaveConfirmed) { this._showLeaveConfirm(_ready); return; }
    this._continuing = true;
    if (_ready.length) this.registry.get('missions')?.failUncollected?.(this._stop?.id);
    this.registry.get('audio')?.setPaused?.(false);
    // Time penalty for visiting the stop — real seconds spent here ×
    // 0.5 deducted from the party clock.  Per spec: each stop costs
    // (real time × 0.5) of party-clock time.  Folded onto whatever
    // purchases already added (charge ad, sleep, coffee, etc.).
    const visitSec = this._sceneStartTime
      ? Math.max(0, (Date.now() - this._sceneStartTime) / 1000)
      : 0;
    const visitPenalty = Math.round(visitSec * 0.5);
    this._purchases.partyClockPenalty =
      (this._purchases.partyClockPenalty ?? 0) + visitPenalty;
    // Raw real seconds spent at the stop — GameScene scales this into in-world
    // minutes for the WORLD clock (time at stops counts toward arrival).
    this._purchases.restStopVisitSec =
      (this._purchases.restStopVisitSec ?? 0) + visitSec;
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const finalScore = this._score + (this._purchases.scoreBonus ?? 0);
      // Career stats: rest-stop cash bonuses (trucker tip / hitchhiker) are
      // earnings; log them, then record dwell time + flush on exit.
      if ((this._purchases.scoreBonus ?? 0) > 0) {
        this._stats?.recordEarn(this._purchases.scoreBonus, 'restStopBonus');
      }
      this._stats?.restStopExit(this._stop.id, visitSec);
      this.scene.start('Game', {
        resumeFromStop: this._stop.id,
        resumeScore:    finalScore,
        // Visiting a stop shaves ONE star (5★ is too hot — immune); paying
        // the clear-heat service wipes it fully.  GameScene honors this.
        resumeStars:    this._purchases.clearStars ? 0
                          : (this._stars >= 4.5 ? this._stars : Math.max(0, this._stars - 1)),
        purchases:      this._purchases,
      });
    });
  }
}
