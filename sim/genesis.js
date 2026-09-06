// §2.6 Genesis roll math. Not implemented in web/src — Genesis is explicitly out of the
// Round 1 prototype's scope (see SCOPE.md) — but the sim needs it to answer §15 Test #3's
// actual question: "does the Genesis race stall or resolve in under a year at 40% base odds."
// Kept separate from web/src/economy.js because it models something that code doesn't.

export const GENESIS_CAP = 100; // ever, across the whole simulated population
export const GENESIS_PER_WALLET_CAP = 3;
export const GENESIS_BASE_ODDS = 0.40;
export const GENESIS_PITY_ATTEMPT = 3; // guaranteed on the 3rd attempt
export const GENESIS_BURN = { common: 10, rare: 10, epic: 5 }; // Mystic is spared, §2.6

// Takes an explicit tool list rather than a player — the caller decides whether that means
// "everything owned" or just the benched Codex-holding copies (see economy-sim.js's
// codexBank / working-set split, and its header comment on why that split exists).
export function distinctModelsOwned(tools, rarity) {
  return new Set(tools.filter((t) => t.rarity === rarity).map((t) => t.model)).size;
}

// The gate: hold all 30 models simultaneously (Mystic verified held, never burned).
export function codexComplete(tools) {
  return distinctModelsOwned(tools, 'common') >= 10
    && distinctModelsOwned(tools, 'rare') >= 10
    && distinctModelsOwned(tools, 'epic') >= 5
    && distinctModelsOwned(tools, 'mystic') >= 5;
}

export function canAttemptGenesis(player, bank) {
  return (player.genesisWon || 0) < GENESIS_PER_WALLET_CAP && codexComplete(bank);
}

/**
 * One roll. `roll` is a [0,1) number from the caller's RNG so this stays deterministic-testable,
 * matching the pattern in web/src/economy.js. Burning the 25 tools and handling the
 * fresh-Epic/fresh-Rare mercy return is the caller's job (it needs the player's model pool),
 * this function only decides the outcome.
 */
export function rollGenesis(attemptNumber, roll) {
  const guaranteed = attemptNumber >= GENESIS_PITY_ATTEMPT;
  const success = guaranteed || roll < GENESIS_BASE_ODDS;
  return { success, guaranteed };
}

// §2.6's deterministic failure mercy: 1st failure → fresh Epic, 2nd → fresh Rare. Never a roll
// on top of a loss — "stacking RNG on top of a loss is the single most rage-inducing pattern."
export function failureMercyRarity(attemptNumber) {
  if (attemptNumber === 1) return 'epic';
  if (attemptNumber === 2) return 'rare';
  return null; // 3rd attempt is pity — can't fail
}
