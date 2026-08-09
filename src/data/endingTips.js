/**
 * "NEXT RUN" advice for a failed run (owner 2026-08-09).
 *
 * When a run ends badly the ending screen explains what actually killed it and
 * what to do differently — keyed off the REAL cause, never a random generic
 * tip. Three concerns are kept apart on purpose:
 *
 *   1. CLASSIFICATION lives in GameScene, at the gameplay sites that already
 *      know why the run ended (_onArrested, the wreck handler, the survival
 *      terminal). It writes a FAIL_REASON onto the run and passes it through
 *      _endGame to the ending screen.
 *   2. SELECTION is this file: reason -> copy, plus the personalisation pass
 *      that decides whether to recommend BUYING a part or USING one already
 *      owned.
 *   3. RENDERING is src/ui/NextRunPanel.js, which knows nothing about causes.
 *
 * All copy is here so it can be read and edited in one place rather than
 * scattered through scene code.
 */
import { getInstalledUpgrade } from '../systems/UpgradeSystem.js';
import { SLOT_LABELS, getSlotTiers } from './upgrades.js';

/**
 * Failure reasons. Specific values are set at the trigger site; the two
 * `*_generic` values are the honest fallback for a run whose cause can't be
 * pinned down (an old save, a test, or a call site that didn't classify).
 */
export const FAIL_REASON = {
  BUSTED_PURSUIT:      'busted_pursuit',
  BUSTED_SPEED_TRAP:   'busted_speed_trap',
  BUSTED_FAILED_STOP:  'busted_failed_stop',
  BUSTED_GENERIC:      'busted_generic',
  CRASHED_MAJOR:       'crashed_major_impact',
  CRASHED_ACCUMULATED: 'crashed_accumulated_damage',
  CRASHED_GENERIC:     'crashed_generic',
  OUT_OF_GAS:          'out_of_gas',
  PASSED_OUT:          'passed_out',
};

/** Ending cause -> the generic reason to fall back to when nothing specific
 *  was recorded. Keeps old saves and existing call sites working. */
const GENERIC_FOR_CAUSE = {
  busted:     FAIL_REASON.BUSTED_GENERIC,
  crash:      FAIL_REASON.CRASHED_GENERIC,
  passed_out: FAIL_REASON.PASSED_OUT,
  out_of_gas: FAIL_REASON.OUT_OF_GAS,
};

/**
 * Copy per reason. `advice` is a function so a recommendation can react to what
 * the player already owns — it returns the RECOMMENDED/LISTEN line, or null to
 * print the technique alone.
 *
 * Keep each panel to roughly 35-55 words: one explanation, one technique, one
 * recommendation. Two short pieces of advice beat a list.
 */
export const TIP_COPY = {
  [FAIL_REASON.BUSTED_PURSUIT]: {
    why: 'The police stayed on you long enough to finish the bust.',
    technique: 'Break the tail — weapons or road hazards to shake pursuers, then change lanes and open up distance.',
    advice: (ctx) => upgradeAdvice(ctx, 'engine', {
      buy:  (label) => `RECOMMENDED: ${label} — more acceleration to break away.`,
      have: () => 'USE IT: fireworks and rolling coal break a tail faster than outrunning it.',
    }),
  },
  [FAIL_REASON.BUSTED_SPEED_TRAP]: {
    why: 'You hit a speed trap over the limit and the trooper took you down.',
    technique: 'Ease off before blind curves and rest-stop exits — that is where troopers sit.',
    advice: (ctx) => ctx.hasRadar
      ? { line: 'LISTEN: faster beeps mean the trap is closer. Slow down before you see the cruiser.', tone: 'own' }
      : { line: 'RECOMMENDED: buy a Radar Detector at CowBella — it beeps before the ticket.', tone: 'buy' },
  },
  [FAIL_REASON.BUSTED_FAILED_STOP]: {
    why: 'You never completed the traffic stop, and the trooper ran out of patience.',
    technique: 'Slow down, ease onto the shoulder and hold still until the stop ends. Running turns a ticket into a pursuit.',
    advice: () => null,
  },
  [FAIL_REASON.BUSTED_GENERIC]: {
    why: 'The police ended the run.',
    technique: 'Keep the wanted level down: crossing a town line sheds a star, and cops lose interest once you are clear.',
    advice: (ctx) => ctx.hasRadar
      ? { line: 'LISTEN: faster beeps mean a trap ahead. Slow down before you see the cruiser.', tone: 'own' }
      : { line: 'RECOMMENDED: buy a Radar Detector at CowBella — it beeps before the ticket.', tone: 'buy' },
  },

  [FAIL_REASON.CRASHED_MAJOR]: {
    why: 'One severe collision took out what was left of your car.',
    technique: 'Brake before hazards instead of steering around them, and never trade paint with anything heavier.',
    advice: (ctx) => upgradeAdvice(ctx, 'body', {
      buy:  (label) => `RECOMMENDED: ${label} — more maximum HP to survive a big hit.`,
      have: () => 'REPAIR IT: top the car up at a garage before a long stretch — HP does not regenerate.',
    }),
  },
  [FAIL_REASON.CRASHED_ACCUMULATED]: {
    why: 'A run of smaller hits wore your car down to nothing.',
    technique: 'Leave room around traffic and repair between stops — damage never heals on its own.',
    advice: (ctx) => upgradeAdvice(ctx, 'brakes', {
      buy:  (label) => `RECOMMENDED: ${label} — stop shorter, clip less.`,
      have: () => 'PULL IN EARLY: a repair costs less than the run you are about to lose.',
    }),
  },
  [FAIL_REASON.CRASHED_GENERIC]: {
    why: 'Your car ran out of health.',
    technique: 'Brake earlier, leave room around heavier traffic, and repair before damage stacks up.',
    advice: (ctx) => upgradeAdvice(ctx, 'body', {
      buy:  (label) => `RECOMMENDED: ${label} — more maximum HP.`,
      have: () => 'REPAIR IT: garages restore HP, and it never comes back on its own.',
    }),
  },

  [FAIL_REASON.OUT_OF_GAS]: {
    why: 'You drove past your last chance to fill up.',
    technique: 'Refuel before the needle reaches red — stops thin out badly east of the pass.',
    advice: (ctx) => upgradeAdvice(ctx, 'fuel', {
      buy:  (label) => `RECOMMENDED: ${label} — more range between fill-ups.`,
      have: () => 'WATCH THE GAUGE: even the big tank will not clear the long eastern gaps.',
    }),
  },
  [FAIL_REASON.PASSED_OUT]: {
    why: 'You fell asleep at the wheel.',
    technique: 'Sleep at a rest stop before tiredness turns critical. Caffeine buys time, it does not replace rest.',
    advice: () => ({ line: 'PLAN IT: line your stops up with the long empty stretches, not after them.', tone: 'own' }),
  },
};

/**
 * Recommend a part from an upgrade slot, personalised to what's installed:
 *   nothing installed -> buy tier 1
 *   partly upgraded   -> buy the next tier
 *   fully upgraded    -> no sale; return the "you already own it" line instead
 * A slot that's maxed is never recommended again (the whole point of checking).
 */
function upgradeAdvice(ctx, slot, copy) {
  const tiers = getSlotTiers(slot);
  if (!tiers.length) return copy.have ? { line: copy.have(), tone: 'own' } : null;

  const installed = ctx.save
    ? getInstalledUpgrade(ctx.save, ctx.vehicleId, slot)
    : null;
  const level = installed?.level ?? 0;
  const next  = tiers.find(t => (t.level ?? 0) > level);

  if (!next) return copy.have ? { line: copy.have(), tone: 'own' } : null;
  const label = level > 0 ? `${next.label} (${SLOT_LABELS[slot] ?? slot} upgrade)` : next.label;
  return { line: copy.buy(label), tone: 'buy' };
}

/** Does this run's ending get a tips panel at all? Wins don't. */
export function isFailureCause(cause) {
  return cause === 'busted' || cause === 'crash'
      || cause === 'passed_out' || cause === 'out_of_gas';
}

/**
 * Resolve the panel content for a run.
 *
 * @param {string}  reason   FAIL_REASON value recorded at the trigger site.
 * @param {string}  cause    Ending cause, used only to pick a generic fallback.
 * @param {object}  ctx      { save, vehicleId, hasRadar }
 * @returns {{why:string, lines:{line:string,tone:string}[]}|null}
 */
export function selectTip(reason, cause, ctx = {}) {
  const key  = TIP_COPY[reason] ? reason : (GENERIC_FOR_CAUSE[cause] ?? null);
  const copy = key ? TIP_COPY[key] : null;
  if (!copy) return null;

  const lines = [{ line: copy.technique, tone: 'technique' }];
  let advice = null;
  try { advice = copy.advice?.(ctx) ?? null; } catch (_) { advice = null; }
  if (advice) lines.push(advice);

  return { reason: key, why: copy.why, lines };
}

/**
 * Ownership/context lookup, kept here so scenes don't hand-roll save digging.
 *
 * The 'beater' fallback matters: the ending scene has no `player`, and the
 * registry's vehicleId can be unset by the time it runs. Resolving to null
 * there made getInstalled() return {} for everyone, so a player with a maxed
 * Body was still told to go buy the $25 Zip-Tied Bumper. Same resolution order
 * GameScene uses (registry -> player -> beater).
 */
export function tipContext(scene) {
  const save = scene?.registry?.get?.('save') ?? null;
  let vehicleId = 'beater';
  try {
    vehicleId = scene?.player?.vehicleId
      ?? scene?.registry?.get?.('vehicleId')
      ?? 'beater';
  } catch (_) { /* keep the default */ }
  return {
    save,
    vehicleId,
    hasRadar: !!(save?.get?.('radarDetector', false)),
  };
}
