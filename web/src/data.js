// Game data derived directly from docs/DESIGN.md — §2.1, §2.5, §4, §6, §7.
// Genesis (§2.6) and Ascension (§2.7) are out of scope for this prototype; see SCOPE.md.

export const RARITIES = ['common', 'rare', 'epic', 'mystic'];

// §2.1 tier table + §4.1 "Repair cost (SLP/pt)" column.
export const TIER = {
  common: { yieldMult: 1.00, tierRate: 2, immortal: false },
  rare: { yieldMult: 1.60, tierRate: 6, immortal: false },
  epic: { yieldMult: 2.50, tierRate: 16, immortal: true },
  mystic: { yieldMult: 3.50, tierRate: 30, immortal: true },
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

// §7 blind box odds and prices — priced in USDC exactly as designed. Boxes mint tools from
// external revenue; they are never bought with ore, which is mining OUTPUT, not input
// (§0: "no money printer" — ore must only flow toward AXS/RON/SLP via refineries, §5).
export const BOXES = {
  basic: { name: 'Basic Crate', priceUSDC: 5, odds: { common: 0.82, rare: 0.165, epic: 0.014, mystic: 0.001 } },
  prospector: { name: "Prospector's Case", priceUSDC: 20, odds: { common: 0.42, rare: 0.46, epic: 0.11, mystic: 0.01 } },
  deepvault: { name: 'Deep Vault', priceUSDC: 75, odds: { common: 0, rare: 0.55, epic: 0.38, mystic: 0.07 } },
};

// §6 nodes — T1/T2 only in this prototype (T3+ need Depth Permits, out of scope for Round 1).
export const NODES = {
  t1: { name: 'Surface Quarry', durabilityDrain: 1, oreBase: 100, minRarity: null },
  t2: { name: 'Iron Cut', durabilityDrain: 2, oreBase: 260, minRarity: 'rare' },
};

// Demo-only time compression. The real design runs 8h shifts (§1) — compressed here so a
// judge can see the full loop without waiting. Clearly labeled in the UI, never silently.
export const DEMO_SHIFT_MS = { t1: 12000, t2: 20000 };

// §4.5 Fusion Repair
export const FUSION_RESTORE_FRACTION = 0.5;
export function fusionFee(rarity) {
  return 20 * TIER[rarity].tierRate;
}
