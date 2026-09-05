// Tool and box art — AI-generated (Higgsfield/Recraft, pixel-art style) then background-
// removed, resized to 160x160, stored locally under web/assets/. Not Axie/Sky Mavis art:
// original mining-tool imagery only, per docs/DESIGN.md Appendix A.5.
// Currency icons stay hand-drawn inline SVG (too small at 16px for raster art to read well).

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function toolIconSVG(modelName, rarity = 'common', sizePx = 32) {
  const slug = slugify(modelName);
  return `<img src="assets/tools/${slug}.png" width="${sizePx}" height="${sizePx}" alt="${modelName}" style="object-fit:contain;" />`;
}

export function boxIconSVG(boxKey, sizePx = 40) {
  const FILE = { basic: 'basic-crate', prospector: 'prospectors-case', deepvault: 'deep-vault' };
  const slug = FILE[boxKey] || 'basic-crate';
  return `<img src="assets/boxes/${slug}.png" width="${sizePx}" height="${sizePx}" alt="${boxKey}" style="object-fit:contain;" />`;
}

const CURRENCY = {
  usdc: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M9 9.5a2.5 2.5 0 012.5-1h1a2.5 2.5 0 010 5h-1a2.5 2.5 0 000 5h1a2.5 2.5 0 002.5-1" stroke-width="1.25"/>',
  ore: '<path d="M12 2l7 5-2 9-5 4-5-4-2-9z"/><path d="M12 2v18M5 7l7 3 7-3" stroke-width="0.75"/>',
  slp: '<path d="M12 3c3 3.5 6 7 6 10.5A6 6 0 016 13.5C6 10 9 6.5 12 3z"/><path d="M9.5 14.5a2.5 2.5 0 003 1.8" stroke-width="1" stroke-linecap="round"/>',
};

export function currencyIconSVG(kind, sizePx = 16) {
  return `<svg viewBox="0 0 24 24" width="${sizePx}" height="${sizePx}" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:-3px; margin-right:4px;">${CURRENCY[kind]}</svg>`;
}
