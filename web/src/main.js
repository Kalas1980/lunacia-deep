// Cache-bust query on every local import: this environment's browser has repeatedly
// served a stale cached module (e.g. an old icons.js with a different function signature)
// even after the importing file itself was freshly fetched, since ES module caching is
// keyed per exact URL and nested imports don't inherit their importer's cache-bust. Bump
// this alongside style.css's ?v= in index.html whenever any web/src/*.js file changes.
import {
  RARITIES, MODELS, TRAITS, TIER, BOXES, NODES, DEMO_SHIFT_MS, fusionFee, fusionFeeAXS,
  SMELTS, REFINERY_MULT, REFINERY_MAX_DURABILITY, refineryRepairCostSLP, refineryRepairCostOre,
} from './data.js?v=22';
import {
  repairCostSLP, repairSuccessChance, rollRepair, isBroken, isWorn,
  fusionRepair, reforgeOdds, reforge, shiftYield, drainDurability, pickModel, bestRefineryMult,
} from './economy.js?v=22';
import { loadState, saveState, resetState, logEvent, getTool, ownedModels } from './state.js?v=22';
import { randomSeed, sha256Hex, makeRoller, weightedPick } from './rng.js?v=22';
import { toolIconSVG, boxIconSVG, refineryIconSVG } from './icons.js?v=22';

const RARITY_RANK = { common: 0, rare: 1, epic: 2, mystic: 3 };
let state = loadState();
let marketFilter = 'common'; // view-only, not persisted — which rarity tab is open

// Box-opening had a whole staged animation; everything else (repair, fuse, reforge) used to
// resolve silently. render() rebuilds tool cards from scratch every call (including the 1s
// interval tick below), so a persistent CSS class won't do — this is a short-lived hint,
// read once by renderToolCard and stale after 700ms, that says "this tool just did X, play
// the one-shot animation for it" without needing to touch how render() itself works.
let lastToolAction = null; // { toolId, type: 'repair-success' | 'repair-fail' | 'pop', at }
const lastBalanceText = {}; // id -> last-rendered string, so pills only pulse on real change
let openNodeKey = null; // which node's site screen is open, if any — kept live by render()

function roll() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Anticipation length escalates with rarity — Common/Rare are a quick beat, Mystic gets a
// real buildup. Durations here are the JS side of the CSS animations in style.css and must
// stay roughly in sync with them (chargeGlow / chargeGlowMystic).
const OPENING_DURATION_MS = { common: 500, rare: 650, epic: 1100, mystic: 1900 };

function burstParticlesHTML(count = 10, radius = 90) {
  let html = '';
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const px = Math.round(Math.cos(angle) * radius);
    const py = Math.round(Math.sin(angle) * radius);
    html += `<div class="burst-particle" style="--px:${px}px; --py:${py}px; animation-delay:${(i % 3) * 0.04}s;"></div>`;
  }
  return html;
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${s}s`;
}

// The mining shift is the one state a player watches longest — it was plain countdown text
// while every other action (repair, fuse, box-opening) got real motion. Shared by the
// Inventory tool card and the node site screen so both stay visually identical.
function miningProgressBarHTML(shift) {
  const elapsed = Date.now() - shift.startedAt;
  const pct = Math.max(0, Math.min(100, (elapsed / shift.durationMs) * 100));
  const remaining = shift.startedAt + shift.durationMs - Date.now();
  return `
    <div class="shift-bar-wrap">
      <div class="shift-bar-track"><div class="shift-bar-fill" style="width:${pct}%"></div></div>
      <span class="muted small">⏱ ${fmtTime(remaining)}</span>
    </div>`;
}

function durabilityClass(tool) {
  if (isBroken(tool)) return 'broken';
  if (tool.durability < 30) return 'crit';
  if (tool.durability < 60) return 'low';
  return 'ok';
}

function activeShiftFor(toolId) {
  return state.activeShifts.find((sh) => sh.toolId === toolId);
}

// ---------- rendering ----------

// Every action in the game touches at least one currency — this is the one feedback beat
// that's free to add everywhere at once. Only pulses on an actual value change (tracked via
// lastBalanceText), so the 1s interval tick in render() doesn't pulse idle, unchanged pills.
function updateBalance(id, value) {
  const text = String(value);
  const el = document.getElementById(id);
  el.textContent = text;
  if (lastBalanceText[id] !== undefined && lastBalanceText[id] !== text) {
    el.classList.remove('pulse');
    void el.offsetWidth; // force a reflow so re-adding the class restarts the animation
    el.classList.add('pulse');
  }
  lastBalanceText[id] = text;
}

function render() {
  updateBalance('ore-balance', state.ore);
  updateBalance('usdc-balance', state.usdc);
  updateBalance('slp-balance', state.slp);
  updateBalance('axs-balance', state.axs.toFixed(2));
  updateBalance('baxs-balance', state.baxs.toFixed(2));
  renderCodex();
  renderTools();
  renderFuseList();
  renderNodes();
  renderBoxes();
  renderRefinery();
  renderMarketplace();
  renderLog();
  if (openNodeKey) showModal(buildNodeSiteHTML(openNodeKey), 'site-view');
}

function renderCodex() {
  const grid = document.getElementById('codex-grid');
  const owned = new Set(state.tools.map((t) => t.model));
  let ownedCount = 0;
  // Grouped by rarity — three compact rows (10 / 10 / 5+5) instead of one long grid that
  // interleaves tiers, so it reads at a glance and takes a fraction of the vertical space.
  const rows = RARITIES.map((rarity) => {
    const chips = MODELS[rarity].map((model) => {
      const has = owned.has(model);
      if (has) ownedCount += 1;
      const tooltip = `${model} — ${rarity} — ${TRAITS[model] || ''}`;
      return `<div class="codex-chip ${rarity} ${has ? 'owned' : 'locked'}" ${has ? `title="${tooltip}"` : ''}>${toolIconSVG(model, rarity, 28)}</div>`;
    }).join('');
    return `<div class="codex-tier"><span class="codex-tier-label">${rarity}</span><div class="codex-tier-grid">${chips}</div></div>`;
  }).join('');
  grid.innerHTML = `<div class="codex-compact">${rows}</div>`;
  const total = RARITIES.reduce((n, r) => n + MODELS[r].length, 0);
  document.getElementById('codex-count').textContent = `${ownedCount} / ${total}`;
  if (ownedCount === total) {
    document.getElementById('codex-count').textContent += '  — Codex complete! (Genesis roll is §2.6, not in this prototype)';
  }
}

function renderTools() {
  const list = document.getElementById('tool-list');
  if (state.tools.length === 0) {
    list.innerHTML = '<p class="muted small">No tools left. Open a blind box below.</p>';
    return;
  }
  list.innerHTML = state.tools.map(renderToolCard).join('');
}

// Fuse used to only be reachable as a button buried on a Broken tool's own Inventory card
// (or a node's site screen) — this is the same action, just surfaced as its own Game
// sub-view so "I have something to fix" is visible without hunting for it.
function renderFuseList() {
  const list = document.getElementById('fuse-list');
  const broken = state.tools.filter((t) => isBroken(t));
  document.getElementById('fuse-count').textContent = broken.length > 0 ? `(${broken.length})` : '';

  if (broken.length === 0) {
    list.innerHTML = '<p class="muted small">No Broken tools right now — durability\'s holding up.</p>';
    return;
  }

  list.innerHTML = broken.map((tool) => {
    const fee = fusionFee(tool.rarity);
    const feeAXS = fusionFeeAXS(tool.rarity);
    const fuelCount = state.tools.filter((t) => t.id !== tool.id && t.rarity === tool.rarity && !isBroken(t)).length;
    const axsNote = feeAXS > 0 ? ` + ${feeAXS} AXS→bAXS` : '';
    let feedbackClass = '';
    if (lastToolAction && lastToolAction.toolId === tool.id && Date.now() - lastToolAction.at < 700) {
      feedbackClass = 'tile-pop';
    }
    return `
      <div class="item-tile ${tool.rarity} ${feedbackClass}">
        <span class="status-badge tag status-broken">Broken</span>
        <div class="icon-wrap ${tool.rarity} broken-icon" title="${tool.model}">${toolIconSVG(tool.model, tool.rarity, 28)}</div>
        <p class="fuse-row-name">${tool.model}</p>
        <p class="muted small">Fee: ${fee} SLP${axsNote}</p>
        <p class="muted small">${fuelCount} ${tool.rarity} tool${fuelCount === 1 ? '' : 's'} available as fuel</p>
        <div class="tile-actions">
          <button data-action="fuse" data-tool="${tool.id}" class="danger pill-btn" ${fuelCount === 0 ? 'disabled' : ''} title="Fusion Repair, §4.5">Fuse</button>
        </div>
      </div>`;
  }).join('');
}

function renderToolCard(tool) {
  const shift = activeShiftFor(tool.id);
  const broken = isBroken(tool);
  const worn = isWorn(tool);
  let statusBadge = '';
  if (shift) statusBadge = '<span class="status-badge tag status-mining">Mining</span>';
  else if (broken) statusBadge = '<span class="status-badge tag status-broken">Broken</span>';
  else if (worn) statusBadge = '<span class="status-badge tag status-worn">Worn</span>';

  const durClass = durabilityClass(tool);
  const durPct = Math.max(0, Math.min(100, tool.durability));

  let actions = '';
  const shiftReady = shift && Date.now() >= shift.startedAt + shift.durationMs;
  if (shift) {
    actions = shiftReady
      ? `<button data-action="collect" data-tool="${tool.id}" class="primary pill-btn">Collect</button>`
      : miningProgressBarHTML(shift);
  } else if (broken) {
    actions = `<button data-action="fuse" data-tool="${tool.id}" class="danger pill-btn" title="Fusion Repair, §4.5">Fuse</button>`;
  } else if (worn) {
    actions = `
      <button data-action="salvage" data-tool="${tool.id}" class="pill-btn">Salvage</button>
      <button data-action="reforge-start" data-tool="${tool.id}" class="pill-btn" title="Reforge, §2.4">Reforge</button>`;
  } else {
    const cost = repairCostSLP(tool.durability, tool.rarity, tool.repairCount);
    const p = Math.round(repairSuccessChance(tool.durability, tool.repairCount, false) * 100);
    const canRepair = tool.durability < 100;
    const nodeButtons = Object.entries(NODES)
      .filter(([, n]) => !n.minRarity || RARITY_RANK[tool.rarity] >= RARITY_RANK[n.minRarity])
      .map(([key, n], i) => `<button data-action="send" data-tool="${tool.id}" data-node="${key}" class="pill-btn" title="Send to ${n.name}">Mine T${i + 1}</button>`)
      .join('');
    actions = `
      ${nodeButtons}
      ${canRepair ? `<button data-action="repair" data-tool="${tool.id}" class="pill-btn" title="SLP cost ${cost}, ${p}% success">Repair</button>` : ''}
      ${tool.rarity === 'common' || tool.rarity === 'rare' ? `<button data-action="reforge-start" data-tool="${tool.id}" class="pill-btn" title="Reforge, §2.4">Reforge</button>` : ''}`;
  }

  const tooltip = `${tool.model} — ${TRAITS[tool.model] || ''}`;
  let feedbackClass = '';
  if (lastToolAction && lastToolAction.toolId === tool.id && Date.now() - lastToolAction.at < 700) {
    feedbackClass = lastToolAction.type === 'repair-success' ? 'repair-success'
      : lastToolAction.type === 'repair-fail' ? 'repair-fail'
      : 'tile-pop';
  }
  return `
    <div class="item-tile ${tool.rarity} ${feedbackClass}">
      ${statusBadge}
      <div class="icon-wrap ${tool.rarity} ${broken ? 'broken-icon' : ''} ${shift && !shiftReady ? 'mining' : ''}" title="${tooltip}">${toolIconSVG(tool.model, tool.rarity, 28)}</div>
      <div class="durbar-wrap" style="width:100%">
        <div class="durbar-track"><div class="durbar-fill ${durClass}" style="width:${durPct}%"></div></div>
        <div class="durbar-label"><span>${tool.durability}/${tool.maxDurability}</span></div>
      </div>
      <div class="tile-actions">${actions}</div>
    </div>`;
}

function renderNodes() {
  const list = document.getElementById('node-list');
  list.innerHTML = Object.entries(NODES).map(([key, n]) => {
    const workingCount = state.activeShifts.filter((sh) => sh.nodeKey === key).length;
    const stoppedCount = state.tools.filter((t) => isBroken(t) && t.lastNodeKey === key).length;
    return `
    <div class="card node-card" data-action="view-node" data-node="${key}" role="button" tabindex="0">
      <img class="node-art" src="${n.image}" alt="${n.name}" />
      <div class="node-body">
        <div class="card-head">
          <span class="card-title">${n.name}</span>
          ${workingCount > 0 ? `<span class="tag status-mining">${workingCount} working</span>` : ''}
          ${stoppedCount > 0 ? `<span class="tag status-broken">${stoppedCount} broken</span>` : ''}
        </div>
        <p class="node-flavor">${n.flavor}</p>
        <p class="node-req">Durability drain ${n.durabilityDrain}/shift · base ore ${n.oreBase} ·
        ${n.minRarity ? `requires ${n.minRarity}+ tool` : 'any tool'} ·
        demo shift length ${DEMO_SHIFT_MS[key] / 1000}s</p>
        <p class="node-click-hint muted small">Click to view this site →</p>
      </div>
    </div>`;
  }).join('');
}

// Pure string builder (no DOM writes) so it can be called both to open the site screen and
// to keep it live on every render() tick — the outer 1s interval doesn't reach into
// #modal-root on its own, so without this a countdown shown here would freeze at open-time.
// Shared by both sections below so the "greyscale icon + red name" broken treatment can't
// drift out of sync between "stopped here" and the ordinary idle-list row.
function siteRowHTML(tool, rightSideHTML, extraIconClass = '') {
  const broken = isBroken(tool);
  return `
      <div class="site-row ${broken ? 'broken' : ''}">
        <div class="icon-wrap ${tool.rarity} ${broken ? 'broken-icon' : ''} ${extraIconClass}" title="${tool.model}">${toolIconSVG(tool.model, tool.rarity, 26)}</div>
        <span class="site-row-name">${tool.model}</span>
        ${rightSideHTML}
      </div>`;
}

// A generic, original crew critter — not Axie art. Real Axie art can't ship before the
// Builders Program licence (docs/DESIGN.md Appendix A.5); this is the "your own miner art"
// placeholder §A.4's RoninNftAdapter already plans for, applied to the UI a turn early.
const CREW_CRITTER_SRC = 'assets/crew/miner-critter.png';

// Rendered directly inside the scene background (site-scene), not the plain-list style
// idle rows below it — the critter only appears for a genuinely active shift; a stopped
// (Broken) tool shows alone, since nobody's actively operating a tool that can't mine.
function sceneWorkerHTML(tool, statusHTML, showCritter) {
  const broken = isBroken(tool);
  return `
    <div class="scene-worker ${broken ? 'broken' : ''}">
      ${showCritter ? `<img class="scene-critter mining" src="${CREW_CRITTER_SRC}" alt="Crew" />` : ''}
      <div class="icon-wrap ${tool.rarity} ${broken ? 'broken-icon' : ''} ${showCritter ? 'mining' : ''} scene-tool-icon" title="${tool.model}">${toolIconSVG(tool.model, tool.rarity, 26)}</div>
      <div class="scene-worker-info">
        <span class="scene-worker-name">${tool.model}</span>
        ${statusHTML}
      </div>
    </div>`;
}

function buildNodeSiteHTML(nodeKey) {
  const node = NODES[nodeKey];
  const workingHere = state.activeShifts.filter((sh) => sh.nodeKey === nodeKey);
  // A tool that broke while working here has no active shift anymore (doCollect always
  // clears it), but it should still read as "stopped here", not just vanish — that's the
  // whole point of tracking lastNodeKey in doSend.
  const stoppedHere = state.tools.filter((t) => isBroken(t) && t.lastNodeKey === nodeKey);

  const workingWorkers = workingHere.map((sh) => {
    const tool = getTool(state, sh.toolId);
    if (!tool) return '';
    const ready = Date.now() >= sh.startedAt + sh.durationMs;
    return sceneWorkerHTML(tool, ready
      ? `<button data-action="collect" data-tool="${tool.id}" class="primary pill-btn">Collect</button>`
      : miningProgressBarHTML(sh), true);
  }).join('');

  const stoppedWorkers = stoppedHere.map((tool) => sceneWorkerHTML(tool,
    `<button data-action="fuse" data-tool="${tool.id}" class="danger pill-btn" title="Fusion Repair, §4.5">Fuse</button>`, false));

  const isEligible = (t) => !node.minRarity || RARITY_RANK[t.rarity] >= RARITY_RANK[node.minRarity];
  // Broken tools are shown above (stoppedWorkers) if they stopped at THIS node, or just live
  // in ordinary Inventory otherwise — either way they don't belong in "you can commit" too.
  const idleEligible = state.tools.filter((t) => isEligible(t) && !isBroken(t) && !activeShiftFor(t.id));
  const idleRows = idleEligible.map((tool) => siteRowHTML(tool,
    `<button data-action="send" data-tool="${tool.id}" data-node="${nodeKey}" class="pill-btn">Commit to mine here</button>`));

  const workingCount = workingHere.length + stoppedHere.length;

  return `
    <div class="site-scene" style="background-image:url('${node.image}')">
      <div class="site-scene-fade"></div>
      <div class="site-scene-content">
        <h3 class="site-scene-title">${node.name}</h3>
        <div class="scene-workers">
          ${workingCount ? workingWorkers + stoppedWorkers : '<p class="scene-empty-msg">Nobody working this node yet.</p>'}
        </div>
      </div>
    </div>
    <div class="site-panel">
      <p class="node-flavor">${node.flavor}</p>
      <p class="node-req">Durability drain ${node.durabilityDrain}/shift · base ore ${node.oreBase} ·
      ${node.minRarity ? `requires ${node.minRarity}+ tool` : 'any tool'}</p>

      <h4 class="site-section-head">Idle tools you can commit</h4>
      ${idleEligible.length === 0
        ? '<p class="muted small">No eligible idle tools — repair, Fuse a Broken one, or open a blind box.</p>'
        : idleRows}

      <div class="card-actions"><button data-action="close-modal" class="primary">Close</button></div>
    </div>`;
}

function openNodeSite(nodeKey) {
  openNodeKey = nodeKey;
  showModal(buildNodeSiteHTML(nodeKey), 'site-view');
}

function renderBoxes() {
  const list = document.getElementById('box-list');
  list.innerHTML = Object.entries(BOXES).map(([key, b]) => {
    const activeRarities = RARITIES.filter((r) => b.odds[r] > 0);
    const oddsStr = activeRarities.map((r) => `${r} ${(b.odds[r] * 100).toFixed(1)}%`).join(' · ');
    const segments = activeRarities
      .map((r) => `<div class="seg ${r}" style="flex-grow:${b.odds[r]}" title="${r} ${(b.odds[r] * 100).toFixed(1)}%"></div>`)
      .join('');
    const legend = activeRarities
      .map((r) => `<span><i class="dot ${r}"></i>${r} ${(b.odds[r] * 100).toFixed(1)}%</span>`)
      .join('');
    return `
    <div class="box-card ${key}">
      <div class="card-head">
        <div class="icon-wrap box ${key}" title="Exact odds — ${oddsStr}">${boxIconSVG(key, 30)}</div>
        <div>
          <div class="box-name">${b.name}</div>
        </div>
      </div>
      <p class="box-flavor">${b.flavor}</p>
      <div class="rarity-bar">${segments}</div>
      <div class="rarity-legend">${legend}</div>
      <div class="card-actions"><button data-action="buy-box" data-box="${key}" class="primary" ${state.usdc < b.priceUSDC ? 'disabled' : ''}>Open — $${b.priceUSDC}</button></div>
    </div>`;
  }).join('');
}

// §5.1 — smelting recipe cards (identical shape to renderBoxes, paid in ore not USDC) plus
// the wallet's owned Refineries with their durability + dual-currency repair.
function renderRefinery() {
  const smeltList = document.getElementById('smelt-list');
  smeltList.innerHTML = Object.entries(SMELTS).map(([key, s]) => {
    const activeRarities = RARITIES.filter((r) => s.odds[r] > 0);
    const oddsStr = activeRarities.map((r) => `${r} ${(s.odds[r] * 100).toFixed(1)}%`).join(' · ');
    const segments = activeRarities
      .map((r) => `<div class="seg ${r}" style="flex-grow:${s.odds[r]}" title="${r} ${(s.odds[r] * 100).toFixed(1)}%"></div>`)
      .join('');
    const legend = activeRarities
      .map((r) => `<span><i class="dot ${r}"></i>${r} ${(s.odds[r] * 100).toFixed(1)}%</span>`)
      .join('');
    const tint = { basic: 'common', refined: 'rare', deep: 'epic' }[key];
    return `
    <div class="box-card ${key}">
      <div class="card-head">
        <div class="icon-wrap box" title="Exact odds — ${oddsStr}">${refineryIconSVG(tint, 30)}</div>
        <div><div class="box-name">${s.name}</div></div>
      </div>
      <p class="box-flavor">${s.flavor}</p>
      <div class="rarity-bar">${segments}</div>
      <div class="rarity-legend">${legend}</div>
      <div class="card-actions"><button data-action="smelt" data-recipe="${key}" class="primary" ${state.ore < s.oreCost ? 'disabled' : ''}>Smelt — ${s.oreCost} ore</button></div>
    </div>`;
  }).join('');

  const list = document.getElementById('refinery-list');
  if (state.refineries.length === 0) {
    list.innerHTML = '<p class="muted small">No Refineries yet — smelt one above to boost every shift\'s ore yield.</p>';
    return;
  }
  const mult = bestRefineryMult(state.refineries);
  list.innerHTML = state.refineries.map((r) => {
    const idle = r.durability <= 0;
    const durClass = idle ? 'broken' : r.durability < 30 ? 'crit' : r.durability < 60 ? 'low' : 'ok';
    const isBest = !idle && REFINERY_MULT[r.rarity] === mult;
    const costSLP = refineryRepairCostSLP(REFINERY_MAX_DURABILITY - r.durability, r.rarity);
    const costOre = refineryRepairCostOre(REFINERY_MAX_DURABILITY - r.durability);
    const canRepair = r.durability < REFINERY_MAX_DURABILITY;
    return `
    <div class="item-tile ${r.rarity}">
      ${idle ? '<span class="status-badge tag status-broken">Idle</span>' : isBest ? `<span class="status-badge tag ${r.rarity}">Active ×${REFINERY_MULT[r.rarity].toFixed(2)}</span>` : ''}
      <div class="icon-wrap ${r.rarity}" title="${r.rarity} Refinery — ×${REFINERY_MULT[r.rarity].toFixed(2)} shift yield while active">${refineryIconSVG(r.rarity, 28)}</div>
      <div class="durbar-wrap" style="width:100%">
        <div class="durbar-track"><div class="durbar-fill ${durClass}" style="width:${Math.max(0, r.durability)}%"></div></div>
        <div class="durbar-label"><span>${r.durability}/${REFINERY_MAX_DURABILITY}</span></div>
      </div>
      <div class="tile-actions">
        ${canRepair ? `<button data-action="refinery-repair-slp" data-refinery="${r.id}" class="pill-btn" title="Deterministic, always succeeds">Repair (${costSLP} SLP)</button>` : ''}
        ${canRepair ? `<button data-action="refinery-repair-ore" data-refinery="${r.id}" class="pill-btn" title="Deterministic, always succeeds">Repair (${costOre} ore)</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function doSmelt(recipeKey) {
  const recipe = SMELTS[recipeKey];
  if (state.ore < recipe.oreCost) return;
  state.ore -= recipe.oreCost;
  const seed = randomSeed();
  const nonce = state.nextRefineryId;
  sha256Hex(`${seed}:${nonce}`).then((commit) => {
    showModal(`
      <h3>${recipe.name} — Seed committed</h3>
      <p>Commit hash (published before the roll, per §7's pattern):</p>
      <div class="hash">${commit}</div>
      <p class="muted small">Smelt to reveal the seed — you can re-hash it yourself and confirm it matches.</p>
      <div class="card-actions"><button id="smelt-btn" class="primary">Smelt</button></div>`);
    document.getElementById('smelt-btn').addEventListener('click', async () => {
      const roller = await makeRoller(seed, nonce);
      const rarity = weightedPick(recipe.odds, roller());
      const refinery = { id: state.nextRefineryId++, rarity, durability: REFINERY_MAX_DURABILITY, maxDurability: REFINERY_MAX_DURABILITY };
      state.refineries.push(refinery);
      logEvent(state, `${recipe.name} → ${rarity.toUpperCase()} Refinery (×${REFINERY_MULT[rarity].toFixed(2)} shift yield while active).`);
      showModal(`
        <h3>${recipe.name} — Revealed</h3>
        <div class="reveal-stage">
          <div class="reveal-glow ${rarity}" title="${rarity} Refinery">${refineryIconSVG(rarity, 40)}</div>
          <span class="tag ${rarity}">${rarity}</span>
        </div>
        <p class="muted small">Seed: <span class="hash">${seed}</span>nonce ${nonce} — hash this yourself to verify it matches the commit above.</p>
        <div class="card-actions"><button data-action="close-modal" class="primary">Nice</button></div>`);
      saveState(state);
      render();
    }, { once: true });
    saveState(state);
    render();
  });
}

function doRefineryRepair(refineryId, currency) {
  const r = state.refineries.find((x) => x.id === refineryId);
  if (!r) return;
  const missing = REFINERY_MAX_DURABILITY - r.durability;
  if (currency === 'slp') {
    const cost = refineryRepairCostSLP(missing, r.rarity);
    if (state.slp < cost) { logEvent(state, `Not enough SLP to repair Refinery (need ${cost}).`); saveState(state); render(); return; }
    state.slp -= cost;
    r.durability = REFINERY_MAX_DURABILITY;
    logEvent(state, `Repaired ${r.rarity} Refinery to full. (-${cost} SLP)`);
  } else {
    const cost = refineryRepairCostOre(missing);
    if (state.ore < cost) { logEvent(state, `Not enough ore to repair Refinery (need ${cost}).`); saveState(state); render(); return; }
    state.ore -= cost;
    r.durability = REFINERY_MAX_DURABILITY;
    logEvent(state, `Repaired ${r.rarity} Refinery to full. (-${cost} ore)`);
  }
  saveState(state);
  render();
}

function renderLog() {
  const log = document.getElementById('event-log');
  log.innerHTML = state.log.map((e) => `<li><time>${new Date(e.t).toLocaleTimeString()}</time>${e.message}</li>`).join('');
}

// §7's direct-purchase alternative to gambling: buy the exact model you want at a fixed
// USDC price. Priced above box EV on purpose (§14.1) — boxes must always win on price.
function renderMarketplace() {
  const tabs = document.getElementById('market-tabs');
  tabs.innerHTML = RARITIES.map((r) =>
    `<button class="market-tab ${r} ${r === marketFilter ? 'active' : ''}" data-action="market-tab" data-rarity="${r}">${r} — $${TIER[r].directPriceUSDC}</button>`
  ).join('');

  const grid = document.getElementById('market-grid');
  const owned = ownedModels(state, marketFilter);
  grid.innerHTML = MODELS[marketFilter].map((model) => {
    const price = TIER[marketFilter].directPriceUSDC;
    const have = owned.includes(model);
    return `
    <div class="market-listing">
      <div class="icon-wrap ${marketFilter}" title="${model} — ${TRAITS[model] || ''}">${toolIconSVG(model, marketFilter, 28)}</div>
      <div class="price">$${price}</div>
      <button data-action="buy-direct" data-model="${model}" data-rarity="${marketFilter}" class="primary pill-btn" ${state.usdc < price ? 'disabled' : ''}>${have ? 'Buy another' : 'Buy'}</button>
    </div>`;
  }).join('');
}

function doBuyDirect(model, rarity) {
  const price = TIER[rarity].directPriceUSDC;
  if (state.usdc < price) return;
  state.usdc -= price;
  const newTool = { id: state.nextToolId++, rarity, model, durability: 100, maxDurability: 100, repairCount: 0 };
  state.tools.push(newTool);
  logEvent(state, `Bought ${model} (${rarity}) direct for $${price} USDC — no gambling, §7.`);
  saveState(state);
  render();
}

// ---------- modal helper ----------

function showModal(html, extraModalClass = '') {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="modal ${extraModalClass}">${html}</div></div>`;
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  openNodeKey = null;
}

// ---------- actions ----------

function doSend(toolId, nodeKey) {
  const tool = getTool(state, toolId);
  const node = NODES[nodeKey];
  if (!tool || isBroken(tool) || activeShiftFor(toolId)) return;
  state.activeShifts.push({ toolId, nodeKey, startedAt: Date.now(), durationMs: DEMO_SHIFT_MS[nodeKey] });
  tool.lastNodeKey = nodeKey; // survives past collection so a Broken tool still shows
                              // "stopped here" in the node's site screen (openNodeSite)
  logEvent(state, `${tool.model} sent to ${node.name}.`);
  saveState(state);
  render();
}

// Highest-rarity idle tool that meets the node's requirement — a rational player would
// send their best available tool, so auto-replace does the same rather than picking
// arbitrarily.
function bestIdleEligibleTool(nodeKey, excludeToolId) {
  const node = NODES[nodeKey];
  const candidates = state.tools.filter((t) => t.id !== excludeToolId
    && !isBroken(t) && !activeShiftFor(t.id)
    && (!node.minRarity || RARITY_RANK[t.rarity] >= RARITY_RANK[node.minRarity]));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, t) => (RARITY_RANK[t.rarity] > RARITY_RANK[best.rarity] ? t : best));
}

function doCollect(toolId) {
  const tool = getTool(state, toolId);
  const shift = activeShiftFor(toolId);
  if (!tool || !shift) return;
  if (Date.now() < shift.startedAt + shift.durationMs) return;
  const nodeKey = shift.nodeKey;
  const node = NODES[nodeKey];
  const refineryMult = bestRefineryMult(state.refineries);
  const ore = shiftYield(tool, node, refineryMult);
  state.ore += ore;
  const drained = drainDurability(tool, node);
  Object.assign(tool, drained);
  state.activeShifts = state.activeShifts.filter((sh) => sh.toolId !== toolId);
  const boostNote = refineryMult > 1 ? ` (Refinery ×${refineryMult.toFixed(2)})` : '';
  logEvent(state, `${tool.model} finished at ${node.name}: +${ore} ore${boostNote}. Durability now ${tool.durability}/${tool.maxDurability}${isBroken(tool) ? ' — BROKEN, needs Fusion Repair' : ''}.`);

  // Auto-replace: the tool that just broke can't mine (§4 — that rule doesn't change), but
  // the node shouldn't just go silent because of it. Send the best idle eligible tool to
  // pick up where it left off, same as a player would do manually from the site screen.
  if (isBroken(tool)) {
    const replacement = bestIdleEligibleTool(nodeKey, tool.id);
    if (replacement) {
      state.activeShifts.push({ toolId: replacement.id, nodeKey, startedAt: Date.now(), durationMs: DEMO_SHIFT_MS[nodeKey] });
      replacement.lastNodeKey = nodeKey;
      logEvent(state, `${replacement.model} automatically sent to ${node.name} to replace the broken ${tool.model}.`);
    }
  }

  saveState(state);
  render();
}

function doRepair(toolId) {
  const tool = getTool(state, toolId);
  if (!tool || isBroken(tool)) return;
  const cost = repairCostSLP(tool.durability, tool.rarity, tool.repairCount);
  if (state.slp < cost) {
    logEvent(state, `Not enough SLP to repair ${tool.model} (need ${cost}).`);
    saveState(state);
    render();
    return;
  }
  state.slp -= cost;
  const { tool: next, success } = rollRepair(tool, false, roll());
  Object.assign(tool, next);
  lastToolAction = { toolId, type: success ? 'repair-success' : 'repair-fail', at: Date.now() };
  logEvent(state, success
    ? `Repair succeeded on ${tool.model}: full ${tool.durability}/${tool.maxDurability}. (-${cost} SLP)`
    : `Repair FAILED on ${tool.model}: ${tool.durability}/${tool.maxDurability} (maxDurability dropped 2). (-${cost} SLP)`);
  saveState(state);
  render();
}

function doSalvage(toolId) {
  const tool = getTool(state, toolId);
  if (!tool) return;
  state.tools = state.tools.filter((t) => t.id !== toolId);
  state.ore += 40; // stand-in for §2.3 Gears/Alloy materials — full crafting system out of scope, see SCOPE.md
  logEvent(state, `Salvaged ${tool.model} for materials (+40 ore equivalent).`);
  saveState(state);
  render();
}

function openFusionModal(toolId) {
  const tool = getTool(state, toolId);
  const fuelOptions = state.tools.filter((t) => t.rarity === tool.rarity && t.id !== tool.id);
  const fee = fusionFee(tool.rarity);
  const feeAXS = fusionFeeAXS(tool.rarity);
  if (fuelOptions.length === 0) {
    showModal(`
      <h3><span class="modal-icon">${toolIconSVG(tool.model, tool.rarity, 26)}</span>Fusion Repair — ${tool.model}</h3>
      <p>${tool.model} is Broken (0/100). SLP repair is unavailable (§4.5).</p>
      <p>You have no other <b>${tool.rarity}</b> tool to use as fuel. Open a blind box to get one.</p>
      <div class="card-actions"><button data-action="close-modal">Close</button></div>`);
    return;
  }
  const options = fuelOptions.map((f) => `<option value="${f.id}">${f.model} (${f.durability}/${f.maxDurability})</option>`).join('');
  // Epic/Mystic Fusion also charges bAXS — AXS bonded one-way, never unlocks — to keep AXS
  // scarce (§4.5). Common/Rare stay SLP-only, matching the Repair Cost table (§4.1).
  const axsLine = feeAXS > 0
    ? `<p>Also bonds <b>${feeAXS} AXS → bAXS</b> (one-way, never unlocks — §4.5's scarcity toll on ${tool.rarity} Fusion).</p>`
    : '';
  showModal(`
    <h3><span class="modal-icon">${toolIconSVG(tool.model, tool.rarity, 26)}</span>Fusion Repair — ${tool.model}</h3>
    <p>Burns one <b>${tool.rarity}</b> tool as fuel. Fee: <b>${fee} SLP</b>. Restores current
    durability to 50% of ${tool.model}'s max (${Math.floor(tool.maxDurability / 2)}/${tool.maxDurability}), deterministic.</p>
    ${axsLine}
    <label>Fuel tool: <select id="fuel-select">${options}</select></label>
    <div class="card-actions">
      <button data-action="fuse-confirm" data-tool="${toolId}" class="primary">Fuse</button>
      <button data-action="close-modal">Cancel</button>
    </div>`);
}

async function doFuseConfirm(toolId) {
  const tool = getTool(state, toolId);
  const fuelId = Number(document.getElementById('fuel-select').value);
  const fuel = getTool(state, fuelId);
  const fee = fusionFee(tool.rarity);
  const feeAXS = fusionFeeAXS(tool.rarity);
  if (state.slp < fee) {
    logEvent(state, `Not enough SLP for Fusion Repair (need ${fee}).`);
    closeModal();
    saveState(state);
    render();
    return;
  }
  // bAXS is bonded one-way from liquid AXS on demand — the wallet never needs to pre-bond,
  // but any AXS spent this way never comes back (§4.5).
  const baxsShortfall = Math.max(0, feeAXS - state.baxs);
  if (baxsShortfall > 0 && state.axs < baxsShortfall) {
    logEvent(state, `Not enough AXS to bond for Fusion (need ${baxsShortfall.toFixed(2)} more).`);
    closeModal();
    saveState(state);
    render();
    return;
  }

  // Fusion used to resolve silently the instant you clicked — boxes and smelting both get a
  // beat before the reveal, this didn't. Reuses the exact same opening/reveal machinery,
  // driven by the tool's own rarity (unchanged by Fusion, §4.5) — Common/Rare stay quick,
  // Epic/Mystic get the charged pre-reveal boxes already use for those tiers.
  const fuelModel = fuel.model;
  const dramaClass = tool.rarity !== 'common' && tool.rarity !== 'rare' ? tool.rarity : '';
  showModal(`
    <div class="opening-stage">
      <div class="opening-icon ${dramaClass}">${toolIconSVG(tool.model, tool.rarity, 40)}</div>
      <p class="opening-label">Fusing ${fuelModel} into ${tool.model}...</p>
    </div>`);
  await sleep(OPENING_DURATION_MS[tool.rarity]);

  const { tool: next } = fusionRepair(tool, fuel);
  state.slp -= fee;
  if (baxsShortfall > 0) {
    state.axs -= baxsShortfall;
    state.baxs += baxsShortfall;
  }
  state.baxs -= feeAXS;
  Object.assign(tool, next);
  state.tools = state.tools.filter((t) => t.id !== fuel.id);
  lastToolAction = { toolId: tool.id, type: 'pop', at: Date.now() };
  const axsNote = feeAXS > 0 ? `, -${feeAXS} bAXS` : '';
  logEvent(state, `Fused ${fuelModel} into ${tool.model}: restored to ${tool.durability}/${tool.maxDurability}. (-${fee} SLP${axsNote})`);

  showModal(`
    <div class="reveal-stage">
      <div class="reveal-glow ${tool.rarity}" title="${tool.model}">${toolIconSVG(tool.model, tool.rarity, 44)}</div>
      <span class="tag ${tool.rarity}">Restored</span>
    </div>
    <p class="muted small" style="text-align:center;">${tool.model} is back to ${tool.durability}/${tool.maxDurability}.</p>
    <div class="card-actions"><button data-action="close-modal" class="primary">Nice</button></div>`);

  saveState(state);
  render();
}

// The odds text used to claim "updates per the currently-selected pair" but was only ever
// computed once against partners[0] — picking a different partner in the dropdown silently
// left the wrong numbers on screen. A game whose whole pitch is "published, honest odds"
// (§7, §9) can't afford that gap, so this is now a live listener, not a one-time render.
function reforgeOddsBarHTML(tool, partner) {
  const { pUpgrade, pMatch, pFlaw } = reforgeOdds(tool, partner);
  const segs = [
    ['upgrade', 'Upgrade', pUpgrade], ['match', 'Match', pMatch], ['flaw', 'Flaw', pFlaw],
  ];
  const bar = segs.map(([cls, label, p]) => `<div class="seg outcome-${cls}" style="flex-grow:${p}" title="${label} ${Math.round(p * 100)}%"></div>`).join('');
  const legend = segs.map(([cls, label, p]) => `<span><i class="dot outcome-${cls}"></i>${label} ${Math.round(p * 100)}%</span>`).join('');
  return `<div class="rarity-bar">${bar}</div><div class="rarity-legend">${legend}</div>`;
}

function openReforgeModal(toolId) {
  const tool = getTool(state, toolId);
  const partners = state.tools.filter((t) => t.rarity === tool.rarity && t.id !== tool.id && !activeShiftFor(t.id));
  if (partners.length === 0) {
    showModal(`<h3>Reforge — ${tool.model}</h3><p>Need a second idle <b>${tool.rarity}</b> tool to reforge with.</p>
      <div class="card-actions"><button data-action="close-modal">Close</button></div>`);
    return;
  }
  const options = partners.map((p) => `<option value="${p.id}">${p.model} (${p.durability}/${p.maxDurability})</option>`).join('');
  showModal(`
    <h3><span class="modal-icon">${toolIconSVG(tool.model, tool.rarity, 26)}</span>Reforge — ${tool.model}</h3>
    <p>Burns <b>both</b> tools, mints one new ${tool.rarity} tool. Odds update live for
    whichever partner is selected below, per §2.4's condition formula.</p>
    <label>Partner tool: <select id="reforge-select">${options}</select></label>
    <div id="reforge-odds">${reforgeOddsBarHTML(tool, partners[0])}</div>
    <div class="card-actions">
      <button data-action="reforge-confirm" data-tool="${toolId}" class="primary">Reforge</button>
      <button data-action="close-modal">Cancel</button>
    </div>`);
  document.getElementById('reforge-select').addEventListener('change', (e) => {
    const partner = getTool(state, Number(e.target.value));
    document.getElementById('reforge-odds').innerHTML = reforgeOddsBarHTML(tool, partner);
  });
}

function doReforgeConfirm(toolId) {
  const tool = getTool(state, toolId);
  const partnerId = Number(document.getElementById('reforge-select').value);
  const partner = getTool(state, partnerId);
  const { outcome, tool: minted } = reforge(tool, partner, roll(), roll());
  state.tools = state.tools.filter((t) => t.id !== tool.id && t.id !== partner.id);
  const newTool = { ...minted, id: state.nextToolId++ };
  state.tools.push(newTool);
  lastToolAction = { toolId: newTool.id, type: 'pop', at: Date.now() };
  logEvent(state, `Reforged ${tool.model} + ${partner.model} → ${outcome.toUpperCase()}: ${newTool.model} (${newTool.durability}/${newTool.maxDurability}).`);
  closeModal();
  saveState(state);
  render();
}

async function doBuyBox(boxKey) {
  const box = BOXES[boxKey];
  if (state.usdc < box.priceUSDC) return;
  state.usdc -= box.priceUSDC;
  const seed = randomSeed();
  const nonce = state.nextToolId;
  const commit = await sha256Hex(`${seed}:${nonce}`);
  showModal(`
    <h3>${box.name} — Seed committed</h3>
    <p>Commit hash (published before the roll, per §7):</p>
    <div class="hash">${commit}</div>
    <p class="muted small">Open to reveal the seed — you'll be able to re-hash it yourself and confirm it matches.</p>
    <div class="card-actions"><button id="open-box-btn" class="primary">Open</button></div>`);
  document.getElementById('open-box-btn').addEventListener('click', async () => {
    // Roll first (deterministic from the already-committed seed), then let rarity drive
    // how long and how dramatic the anticipation is — the buildup is honest, not staged;
    // we already know the outcome, we're just pacing the reveal of it.
    const roller = await makeRoller(seed, nonce);
    const rarity = weightedPick(box.odds, roller());
    const model = pickModel(rarity, ownedModels(state, rarity), roller());
    const isMystic = rarity === 'mystic';

    showModal(`
      <div class="opening-stage">
        <div class="opening-icon ${rarity !== 'common' && rarity !== 'rare' ? rarity : ''}">${boxIconSVG(boxKey, 40)}</div>
        <p class="opening-label ${isMystic ? 'mystic-label' : ''}">${isMystic ? 'Something powerful stirs...' : 'Opening...'}</p>
      </div>`);
    if (isMystic) {
      // A second beat partway through the buildup — the escalation itself is part of what
      // makes a Mystic pull feel earned instead of identical to a Common with a bigger glow.
      await sleep(OPENING_DURATION_MS.mystic * 0.5);
      const label = document.querySelector('.opening-label');
      if (label) label.textContent = 'The case can barely hold it...';
    }
    await sleep(OPENING_DURATION_MS[rarity]);

    const newTool = { id: state.nextToolId++, rarity, model, durability: 100, maxDurability: 100, repairCount: 0 };
    state.tools.push(newTool);
    logEvent(state, `Opened ${box.name} → ${rarity.toUpperCase()} ${model}.`);

    const flash = isMystic ? '<div class="reveal-flash"></div>' : '';
    const particles = isMystic ? `<div class="burst-particles">${burstParticlesHTML()}</div>` : '';
    showModal(`
      <h3>${box.name} — Revealed</h3>
      ${flash}
      <div class="reveal-stage">
        <div class="reveal-glow ${rarity} ${isMystic ? 'mystic-grand' : ''}" title="${model} — ${TRAITS[model] || ''}">
          ${particles}${toolIconSVG(model, rarity, isMystic ? 52 : 34)}
        </div>
        <span class="tag ${rarity}">${rarity}</span>
      </div>
      <p class="muted small">Seed: <span class="hash">${seed}</span>nonce ${nonce} — hash this yourself to verify it matches the commit above.</p>
      <div class="card-actions"><button data-action="close-modal" class="primary">Nice</button></div>`,
      isMystic ? 'shake-hard' : '');
    saveState(state);
    render();
  }, { once: true });
  saveState(state);
  render();
}

// ---------- event delegation ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const toolId = el.dataset.tool ? Number(el.dataset.tool) : null;
  if (action === 'send') doSend(toolId, el.dataset.node);
  else if (action === 'view-node') openNodeSite(el.dataset.node);
  else if (action === 'collect') doCollect(toolId);
  else if (action === 'repair') doRepair(toolId);
  else if (action === 'salvage') doSalvage(toolId);
  else if (action === 'fuse') openFusionModal(toolId);
  else if (action === 'fuse-confirm') doFuseConfirm(toolId);
  else if (action === 'reforge-start') openReforgeModal(toolId);
  else if (action === 'reforge-confirm') doReforgeConfirm(toolId);
  else if (action === 'buy-box') doBuyBox(el.dataset.box);
  else if (action === 'market-tab') { marketFilter = el.dataset.rarity; renderMarketplace(); }
  else if (action === 'buy-direct') doBuyDirect(el.dataset.model, el.dataset.rarity);
  else if (action === 'smelt') doSmelt(el.dataset.recipe);
  else if (action === 'refinery-repair-slp') doRefineryRepair(Number(el.dataset.refinery), 'slp');
  else if (action === 'refinery-repair-ore') doRefineryRepair(Number(el.dataset.refinery), 'ore');
  else if (action === 'close-modal') { if (e.target === el) closeModal(); }
});

// node-card is the only element given a real role="button" (rest of the UI is native
// <button>s, which get this for free) — needs its own key handler or it's a keyboard trap.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-action="view-node"]');
  if (!el) return;
  e.preventDefault();
  openNodeSite(el.dataset.node);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Wipe local save and start over?')) return;
  state = resetState();
  render();
});

// Codex/Boxes/Refinery/Marketplace/Log are separate screens now, not panels on one long
// page — plain show/hide via .active, the DOM itself is the state, nothing to persist.
document.getElementById('view-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view-action="switch-view"]');
  if (!btn) return;
  document.querySelectorAll('.view-tab').forEach((t) => t.classList.toggle('active', t === btn));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.dataset.viewPanel === btn.dataset.view));
});

// Inventory as a sub-view under Game (Mine), same show/hide pattern one level deeper.
document.querySelector('.subview-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view-action="switch-subview"]');
  if (!btn) return;
  document.querySelectorAll('.subview-tab').forEach((t) => t.classList.toggle('active', t === btn));
  document.getElementById('subview-nodes').classList.toggle('active', btn.dataset.subview === 'nodes');
  document.getElementById('subview-inventory').classList.toggle('active', btn.dataset.subview === 'inventory');
});

setInterval(render, 1000); // countdown ticks + collect-button availability
render();
