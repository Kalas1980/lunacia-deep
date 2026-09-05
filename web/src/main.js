import { RARITIES, MODELS, TRAITS, TIER, BOXES, NODES, DEMO_SHIFT_MS, fusionFee } from './data.js';
import {
  repairCostSLP, repairSuccessChance, rollRepair, isBroken, isWorn,
  fusionRepair, reforgeOdds, reforge, shiftYield, drainDurability, pickModel,
} from './economy.js';
import { loadState, saveState, resetState, logEvent, getTool, ownedModels } from './state.js';
import { randomSeed, sha256Hex, makeRoller, weightedPick } from './rng.js';
import { toolIconSVG, boxIconSVG } from './icons.js';

const RARITY_RANK = { common: 0, rare: 1, epic: 2, mystic: 3 };
let state = loadState();
let marketFilter = 'common'; // view-only, not persisted — which rarity tab is open

function roll() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${s}s`;
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

function render() {
  document.getElementById('ore-balance').textContent = state.ore;
  document.getElementById('usdc-balance').textContent = state.usdc;
  document.getElementById('slp-balance').textContent = state.slp;
  renderCodex();
  renderTools();
  renderNodes();
  renderBoxes();
  renderMarketplace();
  renderLog();
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
      return `<div class="codex-chip ${rarity} ${has ? 'owned' : ''}" ${has ? `title="${tooltip}"` : ''}>${has ? toolIconSVG(model, 18) : '?'}</div>`;
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
  if (shift) {
    const remaining = shift.startedAt + shift.durationMs - Date.now();
    if (remaining <= 0) {
      actions = `<button data-action="collect" data-tool="${tool.id}" class="primary pill-btn">Collect</button>`;
    } else {
      actions = `<span class="muted small">⏱ ${fmtTime(remaining)}</span>`;
    }
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
  return `
    <div class="item-tile ${tool.rarity}">
      ${statusBadge}
      <div class="icon-wrap ${tool.rarity}" title="${tooltip}">${toolIconSVG(tool.model, 28)}</div>
      <div class="durbar-wrap" style="width:100%">
        <div class="durbar-track"><div class="durbar-fill ${durClass}" style="width:${durPct}%"></div></div>
        <div class="durbar-label"><span>${tool.durability}/${tool.maxDurability}</span></div>
      </div>
      <div class="tile-actions">${actions}</div>
    </div>`;
}

function renderNodes() {
  const list = document.getElementById('node-list');
  list.innerHTML = Object.entries(NODES).map(([key, n]) => `
    <div class="card">
      <div class="card-head"><span class="card-title">${n.name}</span></div>
      <p class="node-req">Durability drain ${n.durabilityDrain}/shift · base ore ${n.oreBase} ·
      ${n.minRarity ? `requires ${n.minRarity}+ tool` : 'any tool'} ·
      demo shift length ${DEMO_SHIFT_MS[key] / 1000}s</p>
    </div>`).join('');
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
      <div class="icon-wrap ${marketFilter}" title="${model} — ${TRAITS[model] || ''}">${toolIconSVG(model, 28)}</div>
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

function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="modal">${html}</div></div>`;
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

// ---------- actions ----------

function doSend(toolId, nodeKey) {
  const tool = getTool(state, toolId);
  const node = NODES[nodeKey];
  if (!tool || isBroken(tool) || activeShiftFor(toolId)) return;
  state.activeShifts.push({ toolId, nodeKey, startedAt: Date.now(), durationMs: DEMO_SHIFT_MS[nodeKey] });
  logEvent(state, `${tool.model} sent to ${node.name}.`);
  saveState(state);
  render();
}

function doCollect(toolId) {
  const tool = getTool(state, toolId);
  const shift = activeShiftFor(toolId);
  if (!tool || !shift) return;
  if (Date.now() < shift.startedAt + shift.durationMs) return;
  const node = NODES[shift.nodeKey];
  const ore = shiftYield(tool, node);
  state.ore += ore;
  const drained = drainDurability(tool, node);
  Object.assign(tool, drained);
  state.activeShifts = state.activeShifts.filter((sh) => sh.toolId !== toolId);
  logEvent(state, `${tool.model} finished at ${node.name}: +${ore} ore. Durability now ${tool.durability}/${tool.maxDurability}${isBroken(tool) ? ' — BROKEN, needs Fusion Repair' : ''}.`);
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
  if (fuelOptions.length === 0) {
    showModal(`
      <h3>Fusion Repair — ${tool.model}</h3>
      <p>${tool.model} is Broken (0/100). SLP repair is unavailable (§4.5).</p>
      <p>You have no other <b>${tool.rarity}</b> tool to use as fuel. Open a blind box to get one.</p>
      <div class="card-actions"><button data-action="close-modal">Close</button></div>`);
    return;
  }
  const options = fuelOptions.map((f) => `<option value="${f.id}">${f.model} (${f.durability}/${f.maxDurability})</option>`).join('');
  showModal(`
    <h3>Fusion Repair — ${tool.model}</h3>
    <p>Burns one <b>${tool.rarity}</b> tool as fuel. Fee: <b>${fee} SLP</b>. Restores current
    durability to 50% of ${tool.model}'s max (${Math.floor(tool.maxDurability / 2)}/${tool.maxDurability}), deterministic.</p>
    <label>Fuel tool: <select id="fuel-select">${options}</select></label>
    <div class="card-actions">
      <button data-action="fuse-confirm" data-tool="${toolId}" class="primary">Fuse</button>
      <button data-action="close-modal">Cancel</button>
    </div>`);
}

function doFuseConfirm(toolId) {
  const tool = getTool(state, toolId);
  const fuelId = Number(document.getElementById('fuel-select').value);
  const fuel = getTool(state, fuelId);
  const fee = fusionFee(tool.rarity);
  if (state.slp < fee) {
    logEvent(state, `Not enough SLP for Fusion Repair (need ${fee}).`);
    closeModal();
    saveState(state);
    render();
    return;
  }
  const { tool: next } = fusionRepair(tool, fuel);
  state.slp -= fee;
  Object.assign(tool, next);
  state.tools = state.tools.filter((t) => t.id !== fuel.id);
  logEvent(state, `Fused ${fuel.model} into ${tool.model}: restored to ${tool.durability}/${tool.maxDurability}. (-${fee} SLP)`);
  closeModal();
  saveState(state);
  render();
}

function openReforgeModal(toolId) {
  const tool = getTool(state, toolId);
  const partners = state.tools.filter((t) => t.rarity === tool.rarity && t.id !== tool.id && !activeShiftFor(t.id));
  if (partners.length === 0) {
    showModal(`<h3>Reforge — ${tool.model}</h3><p>Need a second idle <b>${tool.rarity}</b> tool to reforge with.</p>
      <div class="card-actions"><button data-action="close-modal">Close</button></div>`);
    return;
  }
  const { pUpgrade, pMatch, pFlaw } = reforgeOdds(tool, partners[0]);
  const options = partners.map((p) => `<option value="${p.id}">${p.model} (${p.durability}/${p.maxDurability})</option>`).join('');
  showModal(`
    <h3>Reforge — ${tool.model}</h3>
    <p>Burns <b>both</b> tools, mints one new ${tool.rarity} tool. Odds shown are for the
    currently-selected pair and update per §2.4's condition formula.</p>
    <label>Partner tool: <select id="reforge-select">${options}</select></label>
    <p class="muted small">Upgrade-ish ${Math.round(pUpgrade * 100)}% · Match ${Math.round(pMatch * 100)}% · Flaw ${Math.round(pFlaw * 100)}%</p>
    <div class="card-actions">
      <button data-action="reforge-confirm" data-tool="${toolId}" class="primary">Reforge</button>
      <button data-action="close-modal">Cancel</button>
    </div>`);
}

function doReforgeConfirm(toolId) {
  const tool = getTool(state, toolId);
  const partnerId = Number(document.getElementById('reforge-select').value);
  const partner = getTool(state, partnerId);
  const { outcome, tool: minted } = reforge(tool, partner, roll(), roll());
  state.tools = state.tools.filter((t) => t.id !== tool.id && t.id !== partner.id);
  const newTool = { ...minted, id: state.nextToolId++ };
  state.tools.push(newTool);
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
    const roller = await makeRoller(seed, nonce);
    const rarity = weightedPick(box.odds, roller());
    const model = pickModel(rarity, ownedModels(state, rarity), roller());
    const newTool = { id: state.nextToolId++, rarity, model, durability: 100, maxDurability: 100, repairCount: 0 };
    state.tools.push(newTool);
    logEvent(state, `Opened ${box.name} → ${rarity.toUpperCase()} ${model}.`);
    showModal(`
      <h3>${box.name} — Revealed</h3>
      <div class="card-actions" style="justify-content:center; align-items:center; margin:8px 0;">
        <div class="icon-wrap ${rarity}" title="${model} — ${TRAITS[model] || ''}">${toolIconSVG(model, 26)}</div>
        <span class="tag ${rarity}">${rarity}</span>
      </div>
      <p class="muted small">Seed: <span class="hash">${seed}</span>nonce ${nonce} — hash this yourself to verify it matches the commit above.</p>
      <div class="card-actions"><button data-action="close-modal" class="primary">Nice</button></div>`);
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
  else if (action === 'close-modal') { if (e.target === el) closeModal(); }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Wipe local save and start over?')) return;
  state = resetState();
  render();
});

setInterval(render, 1000); // countdown ticks + collect-button availability
render();
