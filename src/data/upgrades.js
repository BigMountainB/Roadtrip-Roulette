// ── Part-Upgrade Catalog (data) ──────────────────────────────────────────
//
// Small, part-by-part car upgrades — the commercial progression backbone.
// One install per SLOT (buying a higher tier replaces the lower).  Effects are
// plain deltas consumed by VehicleStats (display) and later by the handling
// hooks (Prompt 5).  Tradeoffs are real: almost nothing is a pure win.
//
// Effect keys (all optional, additive):
//   grip, steer, stability, braking            handling stat deltas (physics-scale)
//   hp                                          durability (durability stat)
//   cooling                                     cooling headroom (heat-scale, + = cooler)
//   visibility                                  visibility bars (0–5 scale)
//   rangeMi                                     fuel/electric range
//   topMph                                      top-speed delta (usually the tradeoff)
//   rainGrip, snowGrip, offroad                 contextual grip (hooked to weather later)
//   heatAtNight                                 + = draws more police attention at night
//   persistent (bool)                           true = permanent; false = temporary repair
//
// tradeoff: short human string shown in the garage preview.

export const UPGRADE_SLOTS = [
  'tires', 'brakes', 'suspension', 'engine',
  'cooling', 'fuel', 'body', 'visibility', 'police',
];

export const SLOT_LABELS = {
  tires: 'Tires', brakes: 'Brakes', suspension: 'Suspension', engine: 'Engine',
  cooling: 'Cooling', fuel: 'Fuel System', body: 'Body', visibility: 'Lights & Glass',
  police: 'Police Avoidance',
};

export const UPGRADE_CATALOG = {
  tires: [
    { id: 'tires_1', slot: 'tires', level: 1, label: 'Used All-Seasons', cost: 60,
      desc: 'Round-ish. Technically tires.', effects: { grip: +0.04, persistent: true },
      tradeoff: 'Wears faster' },
    { id: 'tires_2', slot: 'tires', level: 2, label: 'Good All-Seasons', cost: 150,
      desc: 'Real grip, real money.', effects: { grip: +0.08, rainGrip: +0.12, persistent: true } },
    { id: 'tires_3', slot: 'tires', level: 3, label: 'Snow Tires', cost: 280,
      desc: 'Ugly, loud, and technically round.', effects: { grip: +0.05, snowGrip: +0.22, topMph: -3, persistent: true },
      tradeoff: '−3 mph dry top speed' },
  ],
  brakes: [
    { id: 'brakes_1', slot: 'brakes', level: 1, label: 'New Pads', cost: 50,
      desc: 'They stop the car. Mostly.', effects: { braking: +0.05, persistent: true } },
    { id: 'brakes_2', slot: 'brakes', level: 2, label: 'Slotted Rotors', cost: 130,
      desc: 'Fade-resistant on the pass.', effects: { braking: +0.10, persistent: true } },
    { id: 'brakes_3', slot: 'brakes', level: 3, label: 'Big Brake Kit', cost: 260,
      desc: 'Overkill is a personality.', effects: { braking: +0.16, stability: +0.03, persistent: true } },
  ],
  suspension: [
    { id: 'susp_1', slot: 'suspension', level: 1, label: 'Fresh Shocks', cost: 70,
      desc: 'No longer a pogo stick.', effects: { stability: +0.05, persistent: true } },
    { id: 'susp_2', slot: 'suspension', level: 2, label: 'Rally Springs', cost: 160,
      desc: 'Soaks up the shoulder.', effects: { stability: +0.08, offroad: +0.10, persistent: true } },
    { id: 'susp_3', slot: 'suspension', level: 3, label: 'Lowering Kit', cost: 240,
      desc: 'Sharp on-road, scrapes everything else.', effects: { steer: +0.10, stability: +0.04, offroad: -0.15, persistent: true },
      tradeoff: 'Worse off-road / water approach' },
  ],
  engine: [
    { id: 'eng_1', slot: 'engine', level: 1, label: 'Tune-Up', cost: 80,
      desc: 'Runs like it means it.', effects: { topMph: +3, persistent: true } },
    { id: 'eng_2', slot: 'engine', level: 2, label: 'Cold Air Intake', cost: 170,
      desc: 'Louder, angrier, faster.', effects: { topMph: +5, cooling: -0.04, persistent: true },
      tradeoff: 'Runs a bit hotter' },
    { id: 'eng_3', slot: 'engine', level: 3, label: 'ECU Tune', cost: 320,
      desc: 'Warranty? Never heard of her.', effects: { topMph: +9, cooling: -0.08, persistent: true },
      tradeoff: 'Runs hot — pair with cooling' },
  ],
  cooling: [
    { id: 'cool_1', slot: 'cooling', level: 1, label: 'Coolant Flush', cost: 40,
      desc: 'Temporary peace of mind.', effects: { cooling: +0.06, persistent: false },
      tradeoff: 'Temporary — degrades over runs' },
    { id: 'cool_2', slot: 'cooling', level: 2, label: 'New Radiator', cost: 150,
      desc: 'Actually holds coolant now.', effects: { cooling: +0.14, persistent: true } },
    { id: 'cool_3', slot: 'cooling', level: 3, label: 'High-Flow + Aux Fan', cost: 300,
      desc: 'Boost all day in the desert.', effects: { cooling: +0.24, persistent: true } },
  ],
  fuel: [
    { id: 'fuel_1', slot: 'fuel', level: 1, label: 'Clean Filter', cost: 35,
      desc: 'Sips instead of guzzles.', effects: { rangeMi: +25, persistent: true } },
    { id: 'fuel_2', slot: 'fuel', level: 2, label: 'Efficiency Tune', cost: 120,
      desc: 'More miles per bad decision.', effects: { rangeMi: +55, persistent: true } },
    { id: 'fuel_3', slot: 'fuel', level: 3, label: 'Larger Tank', cost: 240,
      desc: 'Heavier, but you can skip a stop.', effects: { rangeMi: +110, grip: -0.02, persistent: true },
      tradeoff: 'Slightly heavier (−grip)' },
  ],
  body: [
    { id: 'body_1', slot: 'body', level: 1, label: 'Zip-Tied Bumper', cost: 30,
      desc: 'Held on by hope.', effects: { hp: +8, persistent: false },
      tradeoff: 'Temporary — falls off eventually' },
    { id: 'body_2', slot: 'body', level: 2, label: 'Reinforced Bumper', cost: 140,
      desc: 'Takes a hit, keeps rolling.', effects: { hp: +18, persistent: true } },
    { id: 'body_3', slot: 'body', level: 3, label: 'Bash Bar', cost: 280,
      desc: 'Now you are the hazard.', effects: { hp: +32, steer: -0.04, persistent: true },
      tradeoff: 'Heavier nose (−steering)' },
  ],
  visibility: [
    { id: 'vis_1', slot: 'visibility', level: 1, label: 'New Wiper Blades', cost: 20,
      desc: 'You can see the rain now.', effects: { visibility: +1, persistent: true } },
    { id: 'vis_2', slot: 'visibility', level: 2, label: 'LED Bulbs', cost: 90,
      desc: 'Not two dying candles anymore.', effects: { visibility: +1, persistent: true } },
    { id: 'vis_3', slot: 'visibility', level: 3, label: 'Rally Light Bar', cost: 200,
      desc: 'Turns night into slightly-less-night.', effects: { visibility: +2, heatAtNight: +0.05, persistent: true },
      tradeoff: 'More police attention at night' },
  ],
  police: [
    { id: 'pol_1', slot: 'police', level: 1, label: 'Radar Detector', cost: 60,
      desc: 'Beeps before the ticket.', effects: { persistent: true } },
    { id: 'pol_2', slot: 'police', level: 2, label: 'Police Scanner', cost: 160,
      desc: 'Know where the traps are.', effects: { persistent: true } },
    { id: 'pol_3', slot: 'police', level: 3, label: 'Fresh Paint + Plates', cost: 300,
      desc: 'A whole new terrible car.', effects: { persistent: true } },
  ],
};

/** Flat lookup of every upgrade by id. */
export const UPGRADES_BY_ID = Object.values(UPGRADE_CATALOG)
  .flat()
  .reduce((m, u) => { m[u.id] = u; return m; }, {});

export function getUpgradeById(id) { return UPGRADES_BY_ID[id] ?? null; }
export function getSlotTiers(slot) { return UPGRADE_CATALOG[slot] ?? []; }
