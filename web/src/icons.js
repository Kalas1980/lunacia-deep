// Hand-drawn inline SVG icon set — no external assets, no AI-generated art, no IP risk
// (see docs/DESIGN.md Appendix A.5: no Axie/Sky Mavis art ships until we're registered).
// A small set of archetypes, reused and tinted by rarity, stands in for 30 bespoke pieces
// of art — cheap, crisp at any size, and zero dependency.

const ARCHETYPES = {
  shovel: '<path d="M12 3v10" stroke-linecap="round"/><path d="M8 13l4 4 4-4-2-3H10z"/>',
  hammer: '<rect x="7" y="4" width="10" height="6" rx="1"/><path d="M12 10v10" stroke-linecap="round"/>',
  pickaxe: '<path d="M4 8c4-4 12-4 16 0" stroke-linecap="round"/><path d="M12 8v12" stroke-linecap="round"/>',
  auger: '<path d="M12 2v4M9 7l6 2M9 11l6 2M9 15l6 2M12 19v3" stroke-linecap="round"/>',
  torch: '<path d="M12 3c2 3 3 5 3 7a3 3 0 11-6 0c0-2 1-4 3-7z"/><path d="M12 13v8" stroke-linecap="round"/>',
  gear: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 7.8l1.7 1M18.1 15.2l1.7 1M4.2 16.2l1.7-1M18.1 8.8l1.7-1M3 12h2M19 12h2" stroke-linecap="round"/>',
  sieve: '<circle cx="12" cy="13" r="7"/><path d="M6 13h12M12 7v12M8 9l8 8M16 9l-8 8" stroke-width="0.75"/>',
  canister: '<rect x="8" y="7" width="8" height="13" rx="2"/><path d="M12 3l1.5 3h-3z"/>',
  crystal: '<path d="M12 2l6 6-6 14L6 8z"/><path d="M6 8h12M12 2v6" stroke-width="0.75"/>',
  crate: '<rect x="3" y="8" width="18" height="12" rx="1"/><path d="M3 12h18M12 8v12" stroke-width="0.75"/><path d="M3 8l9-4 9 4"/>',
};

const KEYWORD_MAP = [
  [/shovel|spade|bucket/i, 'shovel'],
  [/hammer|mallet|wedge/i, 'hammer'],
  [/pick|chisel|borer|mattock/i, 'pickaxe'],
  [/auger|drill/i, 'auger'],
  [/torch|cutter|arc/i, 'torch'],
  [/winch|gear|ratchet/i, 'gear'],
  [/sieve|pan|sluice/i, 'sieve'],
  [/pack|charge|rig|jackhammer/i, 'canister'],
];

export function archetypeFor(modelName) {
  for (const [re, key] of KEYWORD_MAP) {
    if (re.test(modelName)) return key;
  }
  return 'crystal'; // Lunacian/Mystic-flavoured names (Excavator, Resonator, Ripper...) and any leftover
}

export function toolIconSVG(modelName, sizePx = 32) {
  const key = archetypeFor(modelName);
  return `<svg viewBox="0 0 24 24" width="${sizePx}" height="${sizePx}" fill="none" stroke="currentColor" stroke-width="1.5">${ARCHETYPES[key]}</svg>`;
}

export function boxIconSVG(boxKey, sizePx = 40) {
  // Same crate glyph, scaled/ornamented slightly differently per tier so the three are
  // still visually distinct even though the base archetype repeats.
  const ornament = {
    basic: '',
    prospector: '<path d="M7 8h10" stroke-width="0.75"/>',
    deepvault: '<path d="M7 8h10M12 11v6" stroke-width="1"/><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/>',
  }[boxKey] || '';
  return `<svg viewBox="0 0 24 24" width="${sizePx}" height="${sizePx}" fill="none" stroke="currentColor" stroke-width="1.5">${ARCHETYPES.crate}${ornament}</svg>`;
}

const CURRENCY = {
  usdc: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M9 9.5a2.5 2.5 0 012.5-1h1a2.5 2.5 0 010 5h-1a2.5 2.5 0 000 5h1a2.5 2.5 0 002.5-1" stroke-width="1.25"/>',
  ore: '<path d="M12 2l7 5-2 9-5 4-5-4-2-9z"/><path d="M12 2v18M5 7l7 3 7-3" stroke-width="0.75"/>',
  slp: '<path d="M12 3c3 3.5 6 7 6 10.5A6 6 0 016 13.5C6 10 9 6.5 12 3z"/><path d="M9.5 14.5a2.5 2.5 0 003 1.8" stroke-width="1" stroke-linecap="round"/>',
};

export function currencyIconSVG(kind, sizePx = 16) {
  return `<svg viewBox="0 0 24 24" width="${sizePx}" height="${sizePx}" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:-3px; margin-right:4px;">${CURRENCY[kind]}</svg>`;
}
