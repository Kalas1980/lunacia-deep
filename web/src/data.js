// Game data derived directly from docs/DESIGN.md — §2.1, §2.5, §4, §6, §7.
// Genesis (§2.6) and Ascension (§2.7) are out of scope for this prototype; see SCOPE.md.

export const RARITIES = ['common', 'rare', 'epic', 'mystic'];

// §2.1 tier table + §4.1 "Repair cost (SLP/pt)" column. directPriceUSDC is §7's
// direct-purchase alternative to gambling — priced above box EV on purpose (§14.1: boxes
// must always win on price) so it's a certainty option, not a cheaper route to the top.
export const TIER = {
  common: { yieldMult: 1.00, tierRate: 2, immortal: false, directPriceUSDC: 8 },
  rare: { yieldMult: 1.60, tierRate: 6, immortal: false, directPriceUSDC: 35 },
  epic: { yieldMult: 2.50, tierRate: 16, immortal: true, directPriceUSDC: 180 },
  mystic: { yieldMult: 3.50, tierRate: 30, immortal: true, directPriceUSDC: 650 },
};

export const MAX_DURABILITY_START = 100;
export const WORN_THRESHOLD = 40; // §2.1 retirement / §4.2 immortal floor

// §2.5 Tool Codex — 30 models (Genesis excluded, see above).
export const MODELS = {
  common: [
    'Hand Shovel', 'Field Spade', 'Rock Hammer', 'Stone Chisel', "Prospector's Pan",
    'Pry Bar', 'Hand Auger', 'Sifting Sieve', "Miner's Mallet", 'Hauling Bucket',
  ],
  rare: [
    'Steel Pickaxe', 'Reinforced Shovel', 'Twin-Blade Mattock', 'Crank Auger',
    'Spring Sledge', 'Ore Sluice', 'Cutting Torch', 'Ratchet Drill', 'Gear Winch',
    'Tempered Wedge Kit',
  ],
  epic: [
    'Jackhammer Rig', 'Pneumatic Drill Array', 'Rotary Core Borer', 'Arc Cutter',
    'Seismic Charge Pack',
  ],
  mystic: [
    'Lunacian Excavator', 'Moonwell Bore', 'Aether Resonator', 'Chimera Ripper',
    'Starfall Auger',
  ],
};

// §2.5 signature traits — one line per model, shown as a hover tooltip in the UI so tools
// can be displayed as icons (their "inventory type") rather than a wall of text.
export const TRAITS = {
  'Hand Shovel': 'Yield +6%',
  'Field Spade': 'Endurance −6% durability drain',
  'Rock Hammer': 'Affinity: +8% Dust',
  'Stone Chisel': 'Fortune +4%',
  "Prospector's Pan": 'Fortune +6% on Dust only',
  'Pry Bar': 'Tempo −5% (faster shifts)',
  'Hand Auger': 'Affinity: +8% Iron',
  'Sifting Sieve': 'Fortune +4%, Tempo +5% (slower)',
  "Miner's Mallet": 'Resilience +4pp repair success',
  'Hauling Bucket': 'Yield +4% and Endurance −4%',
  'Steel Pickaxe': 'Yield +12%',
  'Reinforced Shovel': 'Endurance −12% durability drain',
  'Twin-Blade Mattock': 'Yield +12%, Tempo −5%',
  'Crank Auger': 'Tempo −10% (faster shifts)',
  'Spring Sledge': 'Yield +18% on T1–T2 nodes only',
  'Ore Sluice': 'Fortune +8%',
  'Cutting Torch': 'Affinity: +15% Iron & Silver',
  'Ratchet Drill': 'Endurance −8%, Resilience +6pp',
  'Gear Winch': '+10% yield when all 3 Axies share a class',
  'Tempered Wedge Kit': 'Resilience +10pp repair success',
  'Jackhammer Rig': 'Fortune +10%, Yield +8%',
  'Pneumatic Drill Array': 'Yield +20%, but 2x durability drain',
  'Rotary Core Borer': 'Tempo −20% — the idle-optimiser’s pick',
  'Arc Cutter': 'Affinity: +25% Silver & Moonstone',
  'Seismic Charge Pack': '4% chance to double a shift’s yield',
  'Lunacian Excavator': 'Seismic Charge — 5% chance to double a shift',
  'Moonwell Bore': 'Moonlit — +40% Moonstone find rate',
  'Aether Resonator': 'Attunement — failed repairs never reduce maxDurability',
  'Chimera Ripper': 'Ravenous — +25% yield, 2x durability drain',
  'Starfall Auger': 'Starfall — 1.5% chance per shift to drop a Prime Core',
};

// §7 blind box odds and prices — priced in USDC exactly as designed. Boxes mint tools from
// external revenue; they are never bought with ore, which is mining OUTPUT, not input
// (§0: "no money printer" — ore must only flow toward AXS/RON/SLP via refineries, §5).
export const BOXES = {
  basic: {
    name: 'Basic Crate',
    flavor: 'Splintered wood, a rusted latch. Most miners start here.',
    priceUSDC: 5,
    odds: { common: 0.82, rare: 0.165, epic: 0.014, mystic: 0.001 },
  },
  prospector: {
    name: "Prospector's Case",
    flavor: 'Iron-banded and well-travelled. Something worth carrying.',
    priceUSDC: 20,
    odds: { common: 0.42, rare: 0.46, epic: 0.11, mystic: 0.01 },
  },
  deepvault: {
    name: 'Deep Vault',
    flavor: 'Sealed with Lunacian glyphs. It hums faintly when shaken.',
    priceUSDC: 75,
    odds: { common: 0, rare: 0.55, epic: 0.38, mystic: 0.07 },
  },
};

// §5.1 Refinery NFTs — smelted from ore, same odds shape as blind boxes (§7), just paid in
// ore instead of USDC. One shared rarity ladder (§13 open question 7), not per-token.
export const SMELTS = {
  basic: {
    name: 'Basic Smelt',
    flavor: 'A backyard bloomery. Mostly slag, occasionally something worth keeping.',
    oreCost: 150,
    odds: { common: 0.82, rare: 0.165, epic: 0.014, mystic: 0.001 },
  },
  refined: {
    name: 'Refined Smelt',
    flavor: 'Iron and dust, fed hot. Built for someone who plans to keep mining.',
    oreCost: 400,
    odds: { common: 0.42, rare: 0.46, epic: 0.11, mystic: 0.01 },
  },
  deep: {
    name: 'Deep Smelt',
    flavor: 'Silver and moonstone in the mix. It runs hotter than it should.',
    oreCost: 900,
    odds: { common: 0, rare: 0.55, epic: 0.38, mystic: 0.07 },
  },
};

// §5.1 — modest, deliberately: a Refinery bonus stacks on top of Tool yieldMult *and* Axie
// class bonuses (§3), so this multiplies shift ore yield directly rather than a whole new
// curve. Only the wallet's single best (highest-rarity, non-zero-durability) Refinery
// applies — owning several doesn't stack (§5.1 describes "your Refinery", singular).
export const REFINERY_MULT = { common: 1.00, rare: 1.15, epic: 1.35, mystic: 1.60 };
export const REFINERY_MAX_DURABILITY = 100;

// §5.1 repair — deterministic, no roll (a Refinery is a passive multiplier, not a piloted
// risk/reward asset like a Tool, §4.2). Reuses Tool tierRate for the SLP route rather than
// inventing a second rate table — no evidence yet that Refineries need to cost differently.
export function refineryRepairCostSLP(missing, rarity) {
  return Math.round(missing * TIER[rarity].tierRate);
}
export function refineryRepairCostOre(missing) {
  return missing * 4;
}

// §6 nodes — T1/T2 only in this prototype (T3+ need Depth Permits, out of scope for Round 1).
export const NODES = {
  t1: {
    name: 'Surface Quarry',
    flavor: 'Sun-bleached stone and switchback ladders. Where every miner starts.',
    image: 'assets/nodes/surface-quarry.jpg',
    durabilityDrain: 1,
    oreBase: 100,
    minRarity: null,
  },
  t2: {
    name: 'Iron Cut',
    flavor: 'A torchlit seam cut deep into the rock. The rails go further than the light does.',
    image: 'assets/nodes/iron-cut.jpg',
    durabilityDrain: 2,
    oreBase: 260,
    minRarity: 'rare',
  },
};

// Demo-only time compression. The real design runs 8h shifts (§1) — compressed here so a
// judge can see the full loop without waiting. Clearly labeled in the UI, never silently.
export const DEMO_SHIFT_MS = { t1: 12000, t2: 20000 };

// §4.5 Fusion Repair
export const FUSION_RESTORE_FRACTION = 0.5;
export function fusionFee(rarity) {
  return 20 * TIER[rarity].tierRate;
}

// §4.5 AXS/bAXS Fusion toll — Epic/Mystic only. Flat per fusion, not scaled by durability:
// Fusion already prices the fuel tool via fusionFee(SLP) above, this is a small scarce-token
// seal on top, not a second proportional cost. Common/Rare are excluded — they already lose
// the NFT outright at retirement (§2.1), so taxing their Fusion in a scarce, unmintable
// token (§0.2) would price out the exact players the free-starter-crew onboarding (§8) keeps.
export function fusionFeeAXS(rarity) {
  return { common: 0, rare: 0, epic: 0.05, mystic: 0.15 }[rarity];
}
