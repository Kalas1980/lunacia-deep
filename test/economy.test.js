// Self-check for the money/branching logic in web/src/economy.js.
// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  repairCostSLP,
  repairSuccessChance,
  rollRepair,
  isBroken,
  isWorn,
  fusionRepair,
  reforgeOdds,
  reforge,
  shiftYield,
  bestRefineryMult,
  drainDurability,
  pickModel,
} from '../web/src/economy.js';
import { NODES, MODELS } from '../web/src/data.js';

function freshTool(rarity, overrides = {}) {
  return { rarity, model: MODELS[rarity][0], durability: 100, maxDurability: 100, repairCount: 0, ...overrides };
}

test('repairCostSLP matches §4.1 formula at known points', () => {
  assert.equal(repairCostSLP(90, 'common', 0), Math.round(10 * 2 * 1));
  assert.equal(repairCostSLP(0, 'mystic', 5), Math.round(100 * 30 * 1.10));
});

test('repairSuccessChance is floored at 0.50 and capped at 1.0', () => {
  assert.ok(Math.abs(repairSuccessChance(0, 0, false) - 0.65) < 1e-9);
  assert.equal(repairSuccessChance(0, 200, false), 0.50); // heavy repairCount can't push below floor
  assert.equal(repairSuccessChance(90, 0, true), 1.0); // flux can't push above 100%
});

test('rollRepair: success restores to maxDurability and does not touch it', () => {
  const tool = freshTool('common', { durability: 50 });
  const { tool: next, success } = rollRepair(tool, false, 0); // roll=0 always beats pSuccess>0
  assert.equal(success, true);
  assert.equal(next.durability, 100);
  assert.equal(next.maxDurability, 100);
});

test('rollRepair: failure restores half missing durability and costs 2 maxDurability', () => {
  const tool = freshTool('common', { durability: 50 });
  const { tool: next, success } = rollRepair(tool, false, 0.999); // roll=0.999 always fails
  assert.equal(success, false);
  assert.equal(next.durability, 75); // 50 + floor(50/2)
  assert.equal(next.maxDurability, 98);
});

test('rollRepair: Epic/Mystic maxDurability floors at 40 and never goes lower', () => {
  let tool = freshTool('epic', { durability: 1, maxDurability: 41 });
  ({ tool } = rollRepair(tool, false, 0.999));
  assert.equal(tool.maxDurability, 40);
  ({ tool } = rollRepair(tool, false, 0.999));
  assert.equal(tool.maxDurability, 40); // floor holds, does not retire
});

test('rollRepair throws on a Broken (0-durability) tool — must use Fusion instead', () => {
  const tool = freshTool('common', { durability: 0 });
  assert.throws(() => rollRepair(tool, false, 0), /Broken tools cannot use SLP repair/);
});

test('isBroken / isWorn', () => {
  assert.equal(isBroken(freshTool('common', { durability: 0 })), true);
  assert.equal(isBroken(freshTool('common', { durability: 1 })), false);
  assert.equal(isWorn(freshTool('common', { maxDurability: 40 })), true);
  assert.equal(isWorn(freshTool('epic', { maxDurability: 40 })), false); // immortal tiers never "Worn"
});

test('fusionRepair: §4.5 — deterministic 50% restore, maxDurability untouched, rarity must match', () => {
  const broken = freshTool('mystic', { durability: 0, maxDurability: 80 });
  const fuel = freshTool('mystic', { durability: 10, maxDurability: 60 });
  const { tool, feeSLP, feeAXS } = fusionRepair(broken, fuel);
  assert.equal(tool.durability, 40); // floor(80 * 0.5)
  assert.equal(tool.maxDurability, 80); // unchanged
  assert.equal(feeSLP, 20 * 30); // 20 * mystic tierRate
  assert.equal(feeAXS, 0.15); // §4.5 bAXS toll — Mystic

  assert.throws(() => fusionRepair(freshTool('common', { durability: 5 }), fuel), /Broken/);
  assert.throws(() => fusionRepair(broken, freshTool('rare')), /same rarity/);
});

test('fusionRepair: §4.5 AXS/bAXS toll only applies to Epic/Mystic, not Common/Rare', () => {
  const commonFuel = freshTool('common');
  const commonBroken = freshTool('common', { durability: 0 });
  const { feeAXS: commonFee } = fusionRepair(commonBroken, commonFuel);
  assert.equal(commonFee, 0);

  const epicFuel = freshTool('epic');
  const epicBroken = freshTool('epic', { durability: 0 });
  const { feeAXS: epicFee } = fusionRepair(epicBroken, epicFuel);
  assert.equal(epicFee, 0.05);
});

test('reforgeOdds: probabilities sum to 1 and move the right direction with condition', () => {
  const dead = freshTool('common', { durability: 0, maxDurability: 40 });
  const fresh = freshTool('common', { durability: 100, maxDurability: 100 });

  const worst = reforgeOdds(dead, dead);
  const best = reforgeOdds(fresh, fresh);

  for (const o of [worst, best]) {
    assert.ok(Math.abs(o.pUpgrade + o.pMatch + o.pFlaw - 1) < 1e-9);
  }
  assert.ok(worst.pUpgrade < best.pUpgrade, 'better condition should raise upgrade odds');
  assert.ok(worst.pFlaw > best.pFlaw, 'worse condition should raise flaw odds');
});

test('reforge: Epic/Mystic cannot be reforge inputs (§2.4 eligibility)', () => {
  const e1 = freshTool('epic');
  const e2 = freshTool('epic');
  assert.throws(() => reforge(e1, e2, 0.5), /cannot be reforge inputs/);
});

test('reforge: mismatched rarity inputs rejected', () => {
  assert.throws(() => reforge(freshTool('common'), freshTool('rare'), 0.5), /must share a rarity/);
});

test('reforge: Common upgrade mints a Rare tool, not a same-rarity clone', () => {
  const fresh = freshTool('common', { durability: 100, maxDurability: 100 });
  const { outcome, tool } = reforge(fresh, fresh, 0, 0); // roll=0 always beats pUpgrade
  assert.equal(outcome, 'upgrade');
  assert.equal(tool.rarity, 'rare');
  assert.ok(MODELS.rare.includes(tool.model));
});

test('reforge: Rare "upgrade" degrades to match, one tier, not a silent no-op clone', () => {
  const fresh = freshTool('rare', { durability: 100, maxDurability: 100 });
  const { outcome, tool } = reforge(fresh, fresh, 0, 0);
  assert.equal(outcome, 'match'); // no Master Blueprint modeled in this prototype (§2.4)
  assert.equal(tool.rarity, 'rare');
});

test('shiftYield: applies §4.4 sub-30%-durability penalty', () => {
  const healthy = freshTool('rare', { durability: 100 });
  const low = freshTool('rare', { durability: 20 });
  const y1 = shiftYield(healthy, NODES.t1);
  const y2 = shiftYield(low, NODES.t1);
  assert.equal(y2, Math.round(y1 * 0.5));
});

test('shiftYield: §5.1 Refinery multiplier applies on top of the durability penalty', () => {
  const healthy = freshTool('rare', { durability: 100 });
  const base = shiftYield(healthy, NODES.t1);
  const boosted = shiftYield(healthy, NODES.t1, 1.35);
  assert.equal(boosted, Math.round(base * 1.35));
  assert.equal(shiftYield(healthy, NODES.t1), base); // default stays 1.0, no Refinery owned
});

test('bestRefineryMult: §5.1 — picks the highest-rarity ACTIVE Refinery, ignores idle (0-durability) ones', () => {
  assert.equal(bestRefineryMult([]), 1.0);
  assert.equal(bestRefineryMult([{ rarity: 'rare', durability: 50 }]), 1.15);
  assert.equal(
    bestRefineryMult([{ rarity: 'rare', durability: 50 }, { rarity: 'mystic', durability: 0 }]),
    1.15, // the Mystic is idle at 0 durability — Rare's bonus applies instead
  );
  assert.equal(
    bestRefineryMult([{ rarity: 'common', durability: 10 }, { rarity: 'epic', durability: 5 }]),
    1.35,
  );
});

test('drainDurability: never goes below 0', () => {
  const tool = freshTool('common', { durability: 1 });
  const drained = drainDurability(tool, { durabilityDrain: 5 });
  assert.equal(drained.durability, 0);
});

test('pickModel: duplicate protection favors missing models when roll < 0.8', () => {
  const owned = MODELS.common.slice(0, 9); // own everything except the last model
  const missingModel = MODELS.common[9];
  const picked = pickModel('common', owned, 0.1); // roll well under 0.8 -> missing pool
  assert.equal(picked, missingModel); // only one model missing, so it must be picked
});
