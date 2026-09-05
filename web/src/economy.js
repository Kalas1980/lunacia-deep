// Pure functions implementing docs/DESIGN.md §2.4, §2.5, §4, §6, §7.
// No DOM, no I/O — importable directly by test/economy.test.js.

import { TIER, WORN_THRESHOLD, MODELS, FUSION_RESTORE_FRACTION, fusionFee, fusionFeeAXS } from './data.js?v=12';

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// §4.1
export function repairCostSLP(durability, rarity, repairCount) {
  return Math.round((100 - durability) * TIER[rarity].tierRate * (1 + 0.02 * repairCount));
}

// §4.2
export function repairSuccessChance(durability, repairCount, fluxUsed) {
  const missing = 100 - durability;
  const p = 0.95 - 0.30 * (missing / 100) - 0.005 * repairCount + (fluxUsed ? 0.15 : 0);
  return clamp(p, 0.50, 1.0);
}

/**
 * §4.2 repair roll. Throws if the tool is Broken (0 durability) — that's §4.5's job.
 * `roll` is a [0,1) number from the caller's RNG so this stays pure/deterministic-testable.
 */
export function rollRepair(tool, fluxUsed, roll) {
  if (tool.durability <= 0) {
    throw new Error('Broken tools cannot use SLP repair — see fusionRepair()');
  }
  const cost = repairCostSLP(tool.durability, tool.rarity, tool.repairCount);
  const pSuccess = repairSuccessChance(tool.durability, tool.repairCount, fluxUsed);
  const success = roll < pSuccess;

  const next = { ...tool, repairCount: tool.repairCount + 1 };
  if (success) {
    next.durability = tool.maxDurability;
  } else {
    const missing = tool.maxDurability - tool.durability;
    next.durability = tool.durability + Math.floor(missing / 2);
    const floor = TIER[tool.rarity].immortal ? WORN_THRESHOLD : 0;
    next.maxDurability = Math.max(floor, tool.maxDurability - 2);
  }
  return { tool: next, success, cost, pSuccess };
}

export function isBroken(tool) {
  return tool.durability <= 0;
}

export function isWorn(tool) {
  return !TIER[tool.rarity].immortal && tool.maxDurability <= WORN_THRESHOLD;
}

/**
 * §4.5 Fusion Repair — burn `fuel` (same rarity, any condition) to restore `tool`.
 * Deterministic: no roll. maxDurability of the survivor is untouched.
 */
export function fusionRepair(tool, fuel) {
  if (!isBroken(tool)) throw new Error('Fusion Repair is only for Broken (0 durability) tools');
  if (fuel.rarity !== tool.rarity) throw new Error('Fusion fuel must be the same rarity');
  const fee = fusionFee(tool.rarity);
  const feeAXS = fusionFeeAXS(tool.rarity);
  const restored = Math.floor(tool.maxDurability * FUSION_RESTORE_FRACTION);
  return { tool: { ...tool, durability: restored }, feeSLP: fee, feeAXS };
}

// Only Common→Rare is blueprint-free per §2.4. Rare→Epic needs a Master Blueprint, which
// this prototype doesn't model — so 'rare' is deliberately absent here, not an oversight;
// reforge() below falls through to a 'match' outcome when there's no entry for a rarity.
const TIER_UP = { common: 'rare' };

/**
 * §2.4 Reforge — burn two same-tier tools, mint one new tool. Common's "upgrade" mints a
 * Rare, matching the design directly (no Blueprint needed for Common→Rare). Rare's
 * "upgrade" would need a Master Blueprint per §2.4, which this prototype doesn't model
 * (see SCOPE.md) — so it degrades to "match" one tier down from a true upgrade, logged
 * distinctly rather than silently returning an identical tool.
 */
export function reforgeOdds(toolA, toolB) {
  const condition = (t) => 0.5 * (t.durability / 100) + 0.5 * (t.maxDurability / 100);
  const forgeScore = (condition(toolA) + condition(toolB)) / 2;
  const pUpgrade = 0.05 + 0.30 * forgeScore;
  const pFlaw = clamp(0.60 - 0.52 * forgeScore, 0, 1);
  const pMatch = 1 - pUpgrade - pFlaw;
  return { forgeScore, pUpgrade, pMatch, pFlaw };
}

export function reforge(toolA, toolB, roll, modelRoll = roll) {
  if (toolA.rarity !== toolB.rarity) throw new Error('Reforge inputs must share a rarity');
  if (TIER[toolA.rarity].immortal) throw new Error('Epic/Mystic cannot be reforge inputs (§2.4)');
  const { pUpgrade, pMatch } = reforgeOdds(toolA, toolB);
  let outcome;
  if (roll < pUpgrade) outcome = 'upgrade';
  else if (roll < pUpgrade + pMatch) outcome = 'match';
  else outcome = 'flaw';

  let mintRarity = toolA.rarity;
  if (outcome === 'upgrade') {
    const tierUp = TIER_UP[toolA.rarity];
    if (tierUp) mintRarity = tierUp;
    else outcome = 'match'; // Rare's real upgrade needs a Master Blueprint (§2.4) — not modeled here, see SCOPE.md
  }

  const models = MODELS[mintRarity];
  const model = models[Math.floor(((modelRoll * 997) % 1) * models.length)];
  if (outcome === 'flaw') {
    return { outcome, tool: { rarity: mintRarity, model, durability: 60, maxDurability: 60, repairCount: 0 } };
  }
  return { outcome, tool: { rarity: mintRarity, model, durability: 100, maxDurability: 100, repairCount: 0 } };
}

// §6 shift yield, including the §4.4 sub-30%-durability penalty.
export function shiftYield(tool, node) {
  const penalty = tool.durability < 30 ? 0.5 : 1.0;
  return Math.round(node.oreBase * TIER[tool.rarity].yieldMult * penalty);
}

export function drainDurability(tool, node) {
  return { ...tool, durability: Math.max(0, tool.durability - node.durabilityDrain) };
}

// §2.5 duplicate protection: 80% weighted toward models the wallet doesn't own yet.
export function pickModel(rarity, ownedModels, roll) {
  const all = MODELS[rarity];
  const missing = all.filter((m) => !ownedModels.includes(m));
  const pool = missing.length > 0 && roll < 0.8 ? missing : all;
  const idx = Math.floor(((roll * 9973) % 1) * pool.length);
  return pool[idx];
}
