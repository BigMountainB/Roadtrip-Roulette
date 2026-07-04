// ── Upgrade System (save-backed logic) ───────────────────────────────────
//
// Installs/queries part upgrades per vehicle, persisted in the existing save
// architecture under the 'upgrades' key:
//   save.upgrades = { [vehicleId]: { [slot]: upgradeId } }   // one per slot
//
// Temporary repairs (effects.persistent === false) are tracked separately so
// they can be cleared/decayed between runs without wiping permanent parts:
//   save.tempUpgrades = { [vehicleId]: { [slot]: upgradeId } }
//
// Bridges to the legacy `accessories` map where sensible (bumper ↔ body,
// tractionTires ↔ tires) so old saves and the NOS/bumper systems keep working.

import { getUpgradeById, UPGRADE_SLOTS } from '../data/upgrades.js';

function _read(save, key) {
  try { return save?.get?.(key) ?? {}; } catch (_) { return {}; }
}
function _write(save, key, val) {
  try { save?.set?.(key, val); } catch (_) {}
}

/** Installed permanent + temporary upgrades for a vehicle, merged
 *  ({ slot: upgradeId }).  Permanent wins if both a temp and perm occupy a
 *  slot (you upgraded past the patch). */
export function getInstalled(save, vehicleId) {
  const perm = _read(save, 'upgrades')[vehicleId] ?? {};
  const temp = _read(save, 'tempUpgrades')[vehicleId] ?? {};
  return { ...temp, ...perm };
}

/** The installed upgrade object in a given slot, or null. */
export function getInstalledUpgrade(save, vehicleId, slot) {
  const id = getInstalled(save, vehicleId)[slot];
  return id ? getUpgradeById(id) : null;
}

/** Is this exact upgrade id installed on the vehicle? */
export function hasUpgrade(save, vehicleId, upgradeId) {
  return Object.values(getInstalled(save, vehicleId)).includes(upgradeId);
}

/** Install an upgrade (payment handled by the caller / garage UI).  Replaces
 *  whatever occupied the slot.  Returns { ok, reason, replaced }. */
export function buyUpgrade(save, vehicleId, upgradeId) {
  const up = getUpgradeById(upgradeId);
  if (!up) return { ok: false, reason: 'unknown-upgrade' };
  if (!UPGRADE_SLOTS.includes(up.slot)) return { ok: false, reason: 'bad-slot' };

  const permKey = up.effects?.persistent === false ? 'tempUpgrades' : 'upgrades';
  const otherKey = permKey === 'upgrades' ? 'tempUpgrades' : 'upgrades';

  const all = _read(save, permKey);
  const veh = { ...(all[vehicleId] ?? {}) };
  const replaced = veh[up.slot] ?? null;
  veh[up.slot] = upgradeId;
  _write(save, permKey, { ...all, [vehicleId]: veh });

  // Clear any entry of the same slot in the OTHER tier map so a permanent
  // upgrade supersedes a temporary patch (and vice-versa) cleanly.
  const other = _read(save, otherKey);
  if (other[vehicleId]?.[up.slot]) {
    const ov = { ...other[vehicleId] };
    delete ov[up.slot];
    _write(save, otherKey, { ...other, [vehicleId]: ov });
  }
  return { ok: true, reason: '', replaced };
}

/** Aggregate the numeric effect deltas of everything installed on a vehicle.
 *  Consumed by VehicleStats (display) and, later, the handling hooks. */
export function getUpgradeEffects(save, vehicleId) {
  const totals = {};
  for (const slot of UPGRADE_SLOTS) {
    const up = getInstalledUpgrade(save, vehicleId, slot);
    if (!up?.effects) continue;
    for (const [k, v] of Object.entries(up.effects)) {
      if (k === 'persistent' || typeof v !== 'number') continue;
      totals[k] = (totals[k] ?? 0) + v;
    }
  }
  // Legacy accessory bridge — fold old bumper/tractionTires in if the new
  // system hasn't already occupied that slot.
  const acc = (_read(save, 'accessories')[vehicleId]) ?? {};
  const installed = getInstalled(save, vehicleId);
  if (acc.bumper && !installed.body)  totals.hp   = (totals.hp   ?? 0) + 12;
  if (acc.tractionTires && !installed.tires) totals.grip = (totals.grip ?? 0) + 0.06;
  return totals;
}

/** Clear temporary repairs for a vehicle (e.g. on a fresh run start). */
export function clearTempUpgrades(save, vehicleId) {
  const all = _read(save, 'tempUpgrades');
  if (all[vehicleId]) { const c = { ...all }; delete c[vehicleId]; _write(save, 'tempUpgrades', c); }
}
