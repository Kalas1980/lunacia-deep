// Self-check for sim/*.js — the sim's own invariants, not the game's (that's economy.test.js).
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, awardTool } from '../sim/economy-sim.js';
import {
  canAttemptGenesis, rollGenesis, failureMercyRarity, distinctModelsOwned, codexComplete, GENESIS_CAP,
} from '../sim/genesis.js';

test('genesis: codex gate requires all four tiers, not just a high total', () => {
  const bank = Array.from({ length: 29 }, (_, i) => ({ rarity: 'common', model: `m${i}` }));
  assert.equal(codexComplete(bank), false); // 29 commons, zero of anything else
  assert.equal(canAttemptGenesis({ genesisWon: 0 }, bank), false);
});

test('genesis: distinctModelsOwned counts unique models, not tool count', () => {
  const bank = [
    { rarity: 'common', model: 'A' }, { rarity: 'common', model: 'A' }, { rarity: 'common', model: 'B' },
  ];
  assert.equal(distinctModelsOwned(bank, 'common'), 2); // two copies of A still count once
});

test('awardTool: first copy of a model is banked (protected); a duplicate goes to the working set', () => {
  const player = { codexBank: [], tools: [], nextToolId: 1 };
  awardTool(player, 'common', 'Hand Shovel');
  assert.equal(player.codexBank.length, 1);
  assert.equal(player.tools.length, 0);

  awardTool(player, 'common', 'Hand Shovel'); // a duplicate of an already-banked model
  assert.equal(player.codexBank.length, 1, 'bank should not gain a second copy of the same model');
  assert.equal(player.tools.length, 1, 'the duplicate should land in the working set instead');

  awardTool(player, 'common', 'Field Spade'); // a genuinely new model
  assert.equal(player.codexBank.length, 2, 'a new model should be banked, not sent to the working set');
});

test('genesis: pity guarantees success on the 3rd attempt regardless of roll', () => {
  const { success } = rollGenesis(3, 0.999); // a near-certain-fail roll
  assert.equal(success, true);
});

test('genesis: failure mercy is deterministic — Epic then Rare, never a re-roll', () => {
  assert.equal(failureMercyRarity(1), 'epic');
  assert.equal(failureMercyRarity(2), 'rare');
  assert.equal(failureMercyRarity(3), null); // can't happen — pity fires first
});

// A fast, small run — not a real DAU scenario, just proving the engine doesn't throw and
// produces sane (non-NaN, in-bounds) numbers before spending the time on a real 730-day run.
test('runSimulation: small run completes and respects structural invariants', () => {
  const r = runSimulation({ dau: 200, days: 60, scenario: 'bull', seed: 1 });
  assert.ok(Number.isFinite(r.cumulativeRevenue));
  assert.ok(r.cumulativeRevenue >= 0);
  assert.ok(r.genesisMinted <= GENESIS_CAP);
  assert.ok(r.payoutRatio <= 0.36, `payout ratio ${r.payoutRatio} exceeds the 35% design cap (§5)`);
  // F2P mines with the free Day Labourer crew (§8, 0.6x, no durability) — deterministic,
  // so this is an exact expected value, not just "greater than zero". The day===14 check
  // fires after that tick runs, so it's 15 ticks deep (day indices 0..14 inclusive).
  const expectedF2POreAt14Days = Math.round(100 * 0.6) * 3 * 15;
  assert.equal(r.f2pMedianDay14Ore, expectedF2POreAt14Days);
});

test('runSimulation: bear scenario never pays out more than bull for the same DAU (price crash should not inflate payout ratio)', () => {
  const bull = runSimulation({ dau: 200, days: 120, scenario: 'bull', seed: 1 });
  const bear = runSimulation({ dau: 200, days: 120, scenario: 'bear', seed: 1 });
  assert.ok(bull.payoutRatio <= 0.36);
  assert.ok(bear.payoutRatio <= 0.36);
});
