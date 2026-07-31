// NPC portrait registry for the rest-stop encounter system.
//
// Each portrait is a static texture key.  Real art (semi-realistic,
// dark-comedy roadside-America busts) drops into public/assets/npc/ later;
// until then BootScene synthesizes a labelled placeholder card from the
// `placeholderTint` so encounters are fully playable without art.
//
// Keep this a flat data map — no scene refs, no logic.  The encounter cards
// in encounters.js reference these by key via `portrait`.

export const NPC_PORTRAITS = {
  street_weirdo:   { texture: 'npc_street_weirdo',   name: 'Street Weirdo',        placeholderTint: 0x8844CC },
  night_clerk:     { texture: 'npc_night_clerk',     name: 'Night Clerk',          placeholderTint: 0x3A7BD5 },
  chain_guy:       { texture: 'npc_chain_guy',       name: 'Chain Guy',            placeholderTint: 0x2E7A35 },
  long_haul_mike:  { texture: 'npc_long_haul_mike',  name: 'Long-Haul Mike',       placeholderTint: 0xC04A2E },
  ski_bum:         { texture: 'npc_ski_bum',         name: 'Ski Bum',              placeholderTint: 0x39A8FF },
  old_timer:       { texture: 'npc_old_timer',       name: 'Old-Timer',            placeholderTint: 0x7A6A4A },
  patrol_sympath:  { texture: 'npc_patrol_sympath',  name: 'Off-Duty Deputy',      placeholderTint: 0x455A7A },
  college_kid:     { texture: 'npc_college_kid',     name: 'Nervous Student',      placeholderTint: 0xCC1133 },
  chip_seller:     { texture: 'npc_chip_seller',     name: 'Chip Guy',             placeholderTint: 0xFFB52E },
  hiker_one_boot:  { texture: 'npc_hiker_one_boot',  name: 'Hiker (One Boot)',     placeholderTint: 0x6E8B3D },
  farm_worker:     { texture: 'npc_farm_worker',     name: 'Farm Worker',          placeholderTint: 0x9A6B2E },
  desert_oddball:  { texture: 'npc_desert_oddball',  name: 'Desert Oddball',       placeholderTint: 0xB5462E },
  // Women of the road.
  biz_founder:     { texture: 'npc_biz_founder',     name: 'Startup Founder',      placeholderTint: 0x4AC3B0 },
  hiker_woman:     { texture: 'npc_hiker_woman',     name: 'Hitchhiker',           placeholderTint: 0x7FA05A },
  park_ranger:     { texture: 'npc_park_ranger',     name: 'Park Ranger',          placeholderTint: 0x3E7D4F },
  diner_waitress:  { texture: 'npc_diner_waitress',  name: 'Diner Waitress',       placeholderTint: 0xD46A8A },
  grandma:         { texture: 'npc_grandma',         name: 'Roadside Grandma',     placeholderTint: 0xB59AC4 },
  tow_driver:      { texture: 'npc_tow_driver',      name: 'Tow Driver',           placeholderTint: 0xC98A3A },
  desert_mechanic: { texture: 'npc_desert_mechanic', name: 'Shade-Tree Mechanic',  placeholderTint: 0x5A7286 },
  lemonade_kids:   { texture: 'npc_lemonade_kids',   name: 'Lemonade Kids',        placeholderTint: 0xF2C14E },
  swimsuit_girl:   { texture: 'npc_swimsuit_girl',   name: 'Swimsuit Girl',        placeholderTint: 0xFF3D9A },

  // Shop-staff greeters (owner 2026-07-30) — one per business brand, shown by
  // SHOP_GREETERS in encounters.js the first time that shop is entered.  Each
  // texture is a close-up of the SAME character already visible in that
  // brand's full-bleed storefront background art.
  biz_huffs:       { texture: 'npc_biz_huffs',       name: "Huff's Attendant",     placeholderTint: 0xFFCC22 },
  biz_cargo:       { texture: 'npc_biz_cargo',       name: 'CarGo Dispatcher',     placeholderTint: 0x0E9488 },
  biz_cowbellas:   { texture: 'npc_biz_cowbellas',   name: 'CowBella Shopkeeper',  placeholderTint: 0x6E3F1A },
  biz_aok:         { texture: 'npc_biz_aok',         name: 'AOK Camp Host',        placeholderTint: 0x2E7A35 },
  biz_lord:        { texture: 'npc_biz_lord',        name: 'Lord Motors Manager',  placeholderTint: 0xCC1122 },
  biz_suck:        { texture: 'npc_biz_suck',        name: "Sam's Owner",         placeholderTint: 0x8A5A2B },
  biz_gasnsip:     { texture: 'npc_biz_gasnsip',     name: 'Gas-N-Sip Clerk',      placeholderTint: 0x9A36CC },
  biz_am_bm:       { texture: 'npc_biz_am_bm',       name: 'AM/BM Clerk',          placeholderTint: 0x455A7A },
  biz_parkride:    { texture: 'npc_biz_parkride',    name: 'Park & Ride Courier',  placeholderTint: 0x1E5BB8 },
  biz_schwasted:   { texture: 'npc_biz_schwasted',   name: 'Les Schwasted Tech',   placeholderTint: 0xC8102E },
  biz_fap:         { texture: 'npc_biz_fap',         name: 'Finesse Technician',   placeholderTint: 0x7A3FA0 },
};

/** Resolve a portrait descriptor by key, falling back to a generic card. */
export function getPortrait(key) {
  return NPC_PORTRAITS[key] ?? { texture: 'npc_generic', name: '???', placeholderTint: 0x555555 };
}
