// Minimal game state + localStorage persistence. No framework — plain objects, one
// module-level store, explicit save() calls. Fine at this scale; a real client would
// swap this for whatever the chosen frontend stack uses, per docs/DESIGN.md §10.
import { MAX_DURABILITY_START } from './data.js?v=14';

const STORAGE_KEY = 'lunacia-deep-prototype-v1';

function starterState() {
  return {
    ore: 300, // mining OUTPUT only — never spends on boxes (§0's no-money-printer rule)
    usdc: 100, // buys blind boxes (§7) — external revenue stand-in, separate from ore
    slp: 500,
    axs: 0.5, // small starter balance — Fusion Repair's Epic/Mystic toll (§4.5), scarce by design
    baxs: 0, // AXS bonded one-way for the Fusion toll — never unlocks back to liquid AXS (§4.5)
    nextToolId: 3,
    tools: [
      { id: 1, rarity: 'common', model: 'Hand Shovel', durability: 100, maxDurability: MAX_DURABILITY_START, repairCount: 0 },
      { id: 2, rarity: 'common', model: 'Field Spade', durability: 100, maxDurability: MAX_DURABILITY_START, repairCount: 0 },
    ],
    nextRefineryId: 1,
    refineries: [], // §5.1 — { id, rarity, durability, maxDurability }, no model (one shared ladder)
    activeShifts: [], // { toolId, nodeKey, startedAt, durationMs }
    log: [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Backfill missing fields for saves from before a schema change (e.g. usdc, added
    // when boxes moved from an ore price to a USDC price) instead of corrupting into NaN.
    if (raw) return { ...starterState(), ...JSON.parse(raw) };
  } catch {
    // corrupt/missing storage falls through to a fresh game
  }
  return starterState();
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const fresh = starterState();
  saveState(fresh);
  return fresh;
}

export function logEvent(state, message) {
  state.log.unshift({ t: Date.now(), message });
  state.log = state.log.slice(0, 40);
}

export function getTool(state, toolId) {
  return state.tools.find((t) => t.id === toolId);
}

export function ownedModels(state, rarity) {
  return state.tools.filter((t) => t.rarity === rarity).map((t) => t.model);
}
