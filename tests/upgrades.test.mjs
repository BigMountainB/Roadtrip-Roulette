// UpgradeSystem regression coverage — added 2026-07-30 after finding that a
// single tempUpgrades write (Custom-sandbox purchase, or any persistent:false
// item bought in a normal run) silently deleted the player's real permanent
// upgrade in the same slot. getInstalled()'s shadow model requires perm to
// stay intact underneath temp; buyUpgrade must never clear perm when writing
// to temp, only the reverse (a real purchase retires a temp patch).
import assert from 'node:assert/strict';
import { buyUpgrade, getInstalled } from '../src/systems/UpgradeSystem.js';

function mockSave() {
  const store = {};
  return { get: k => store[k] ?? {}, set: (k, v) => { store[k] = v; }, store };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}

test('Custom-mode (forceTemp) purchase does not wipe an owned permanent upgrade in the same slot', () => {
  const save = mockSave();
  buyUpgrade(save, 'beater', 'eng_1');
  buyUpgrade(save, 'beater', 'eng_2');
  buyUpgrade(save, 'beater', 'eng_3');
  buyUpgrade(save, 'beater', 'eng_1', { forceTemp: true });
  assert.equal(save.store.upgrades.beater.engine, 'eng_3', 'permanent eng_3 must survive a Custom-mode buy');
  assert.equal(save.store.tempUpgrades.beater.engine, 'eng_1', 'temp buy still lands in tempUpgrades');
  assert.equal(getInstalled(save, 'beater').engine, 'eng_1', 'temp shadows perm for gameplay effects');
});

test('a persistent:false shop item (e.g. cool_1) does not wipe an owned permanent tier in the same slot', () => {
  const save = mockSave();
  buyUpgrade(save, 'beater', 'cool_2');
  buyUpgrade(save, 'beater', 'cool_1');
  assert.equal(save.store.upgrades.beater.cooling, 'cool_2', 'permanent cool_2 must survive a temp-routed buy');
  assert.equal(save.store.tempUpgrades.beater.cooling, 'cool_1');
});

test('buying the real permanent tier still retires a temp patch in the same slot', () => {
  const save = mockSave();
  buyUpgrade(save, 'beater', 'eng_1', { forceTemp: true });
  buyUpgrade(save, 'beater', 'eng_2');
  assert.equal(save.store.upgrades.beater.engine, 'eng_2');
  assert.equal(save.store.tempUpgrades.beater.engine, undefined, 'the temp patch is cleared once the real part is installed');
});

console.log(`upgrades.test: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
