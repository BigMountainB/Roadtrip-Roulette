// Rest-stop conversation rules (owner 2026-08-05).
//
// The card is a CONVERSATION now: a question is answered in place and the card
// stays up; only a choice that `isExitChoice()` calls an exit closes it and
// lets the storefront open. Two ways that breaks silently, both covered here:
//   1. a node where every choice is an exit — the NPC has nothing to say, the
//      card is a vending machine again;
//   2. a node with NO free unconditional exit — the player is trapped behind a
//      price they can't pay (the renderer appends a fallback, but a card that
//      needs the fallback is an authoring bug worth seeing).
import {
  REST_STOP_ENCOUNTERS, SHOP_GREETERS, isExitChoice, isDialogueTree,
  validateEncounterTrees, resolveChoice,
} from '../src/data/encounters.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };

const nodesOf = (enc) => (isDialogueTree(enc)
  ? Object.entries(enc.nodes)
  : [['(flat)', { choices: enc.choices ?? [] }]]);

const ALL = [...REST_STOP_ENCOUNTERS, ...Object.values(SHOP_GREETERS)];

// ── Tree integrity (the existing author-time check, run in CI now) ────────
ok(validateEncounterTrees().length === 0,
   'dialogue trees: ' + JSON.stringify(validateEncounterTrees()));

for (const enc of ALL) {
  for (const [nid, node] of nodesOf(enc)) {
    const choices = node.choices ?? [];
    const where = `${enc.id}.${nid}`;

    // Every node needs a way OUT that costs nothing and is never locked.
    const freeExit = choices.some(c => isExitChoice(c) && !c.cost && !c.conditions);
    const walksOn  = choices.some(c => typeof c.next === 'string');
    ok(freeExit || walksOn, `${where}: no free exit and nowhere to walk`);

    for (const c of choices) {
      // A choice must not both walk the tree and close the conversation.
      ok(!(typeof c.next === 'string' && isExitChoice(c)),
         `${where}: "${c.label}" both walks to a node and exits`);
      // Anything that stays open must actually have something to SAY, or the
      // player taps it and the card visibly does nothing.
      if (!isExitChoice(c) && typeof c.next !== 'string') {
        ok(!!c.effects?.dialogue, `${where}: "${c.label}" stays open with no reply`);
      }
      // A transaction always ends the conversation — that's what keeps one NPC
      // to one resource payout per visit.
      if (c.cost) ok(isExitChoice(c), `${where}: "${c.label}" costs money but stays open`);
    }
  }
}

// ── Quoted prices match what the choice actually charges ─────────────────
// Labels carry the price in the text ("…($150)"). A label that lies about the
// cost is the exact bug the 2026-08-04 pass found in the owner's sheet.
for (const enc of ALL) {
  for (const [nid, node] of nodesOf(enc)) {
    for (const c of node.choices ?? []) {
      const m = /\((\$[\d,]+)\)/.exec(c.label ?? '');
      if (!m) continue;
      const quoted = Number(m[1].replace(/[$,]/g, ''));
      const charged = c.cost ?? c.effects?.storeOffer?.price ?? null;
      ok(charged === quoted,
         `${enc.id}.${nid}: "${c.label}" quotes ${quoted} but charges ${charged}`);
    }
  }
}

// ── storeOffer choices must NOT also take the money ──────────────────────
for (const enc of ALL) {
  for (const [nid, node] of nodesOf(enc)) {
    for (const c of node.choices ?? []) {
      const off = c.effects?.storeOffer;
      if (!off) continue;
      ok(!c.cost, `${enc.id}.${nid}: "${c.label}" both quotes a store price and charges a cost`);
      ok(!!off.shop && !!off.item && off.price > 0,
         `${enc.id}.${nid}: "${c.label}" has a malformed storeOffer`);
    }
  }
}

// ── resolveChoice still applies cost as negative cash ────────────────────
{
  const rng = () => 0.99;   // above the 0.30 karma roll, so no random reward
  const { effects } = resolveChoice({ cost: 40, effects: { hp: +12 } }, rng);
  ok(effects.cash === -40 && effects.hp === 12, 'resolveChoice: cost → -cash');
}

console.log(`\nencounters.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
