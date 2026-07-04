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
};

/** Resolve a portrait descriptor by key, falling back to a generic card. */
export function getPortrait(key) {
  return NPC_PORTRAITS[key] ?? { texture: 'npc_generic', name: '???', placeholderTint: 0x555555 };
}
