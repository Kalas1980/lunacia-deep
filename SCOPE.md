# Prototype scope

What `web/` implements from [docs/DESIGN.md](docs/DESIGN.md), what it deliberately leaves
out, and why. Read this before assuming a gap is a bug.

## In scope — implemented and tested

- **Durability, repair-as-a-roll, and Fusion Repair** (§4.1–§4.5). This is the mechanic the
  whole prototype exists to prove out: SLP repair works 1–100 durability, a tool at exactly
  0 goes **Broken** and can only be fixed by burning a same-rarity tool as fuel. One rule,
  every rarity (Genesis excluded — not in this prototype at all, see below). Fusing an
  **Epic or Mystic** tool also bonds a small AXS toll into non-transferable **bAXS**
  (`web/src/data.js`'s `fusionFeeAXS`) on top of the SLP fee, auto-bonding the shortfall from
  liquid AXS if the wallet has none yet — see §4.5's "AXS/bAXS toll" for why this sits on
  Fusion specifically, not on routine SLP repair.
- **Reforge** (§2.4): burn two same-rarity tools, re-rolled outcome. Common's upgrade mints
  a Rare (blueprint-free per §2.4); Rare's upgrade degrades to a match — see "Deliberately
  simplified" below.
- **The 30-model Tool Codex** (§2.5): Common ×10, Rare ×10, Epic ×5, Mystic ×5, with
  duplicate protection (80% weighted toward missing models) on every box pull.
- **Blind boxes** (§7): Basic Crate / Prospector's Case / Deep Vault, real odds from the
  design doc, and a **working local commit–reveal demo** — a seed is hashed and shown
  before the roll, revealed after, independently re-hashable by the player. This proves the
  verifiability *shape* the on-chain version needs; see "Deliberately simplified" for what's
  different about the real thing.
- **Marketplace / direct purchase** (§7): buy a specific tool model at a fixed USDC price
  instead of gambling — `TIER.directPriceUSDC` in `web/src/data.js` ($8/$35/$180/$650 by
  rarity), priced above blind-box expected value on purpose so boxes still win on price
  (§14.1). This was designed in §7 from the start but not built until the visual pass.
- **Two mining nodes** (§6): Surface Quarry (T1, any tool) and Iron Cut (T2, Rare+ tool),
  including the sub-30%-durability yield penalty (§4.4), each with its own AI-generated
  scene art (`web/assets/nodes/`) instead of a bare text card.
- **Refinery NFTs** (§5.1): smelted from ore via the same commit–reveal odds shape as blind
  boxes (`SMELTS` in `web/src/data.js`, mirrors `BOXES` exactly, just priced in ore). Owning
  one applies its rarity's `REFINERY_MULT` (×1.00–×1.60) directly to shift ore yield — only
  the best *active* (non-zero-durability) Refinery counts, they don't stack. Own durability,
  repairable in SLP or ore, deterministic (no roll) — see "Deliberately simplified" for how
  this differs from §5.1's pro-rata-pool framing.
- **Ore economy**: shift yield by rarity multiplier, node, and Refinery multiplier; SLP
  costs for repair/Fusion; all pulled from the exact formulas in the design doc, not
  approximated.

## Deliberately simplified — and why that's fine for Round 1

| What | Simplified to | Why |
|---|---|---|
| **Shift length** | 12–20 seconds instead of 8 hours | So a judge sees the full loop in one sitting. Nothing about the durability/repair/Fusion math is compressed — only the clock. Labeled in the UI banner, not hidden. |
| **Commit–reveal** | Web Crypto SHA-256 in the browser, seed committed and revealed in the same session | There's no server or chain here to create a real time/block gap between commit and reveal. The prototype proves the pattern (hash shown before the roll, independently checkable after); §7's actual on-chain flow — commit before block N, reveal after block N+k, combined with blockhash — is a backend/contract concern for Phase 1, not a frontend one. |
| **Salvage** | Flat ore refund | §2.3's Gears/Alloy/Circuit crafting-material system isn't built. A Worn tool still has a real exit, just not the full materials economy. |
| **Rare's Reforge "upgrade"** | Degrades to a same-tier "match" | §2.4 requires a Master Blueprint (a rare T3/T4 drop) for Rare→Epic. There's no blueprint item in this prototype, so rather than silently minting a free Epic, the outcome honestly downgrades and says why in the code comment. |
| **Genesis, Ascension, Standing Orders, T3–T5 nodes, Materials/Permits, Axie crews** | Not implemented | Round 1 asks for a prototype and a vision, not the full game (§11's Phase 2–4 scope). These are meta/endgame systems layered on top of the loop this prototype proves; the design for all of them is already written in `docs/DESIGN.md`. |
| **Refinery's §5.1 pro-rata-pool boost** | Applied directly to shift ore yield instead | This prototype never implemented the daily pro-rata AXS/RON/SLP pool §5 describes — mining pays ore straight to the wallet. There's no pool to boost, so `REFINERY_MULT` multiplies shift yield instead (`bestRefineryMult()` in `web/src/economy.js`). Same economic shape (a personal efficiency multiplier that can't inflate total emission, since there's no pool here to inflate), applied to the one income mechanism that actually exists. |
| **Refinery durability drain** | Per shift collected, not per calendar day | §5.1 says "−1 per daily refine-claim," but this prototype has no daily cadence (shifts run in seconds, §1's compression). Draining on shift-collect is the closest existing event to "a claim." |

## Not implemented — deferred to registration, not to laziness

- **Real Axie art/assets.** Sky Mavis's Builder Resource Kit (Origins Battle Kit, the Axie
  Generator Tool Kit at `axieinfinity/cc-axie-gtk2d`) is IP without a public open-source
  license — it's provided to registered builders under the Vibeathon's terms, not freely
  redistributable. Per `docs/DESIGN.md` Appendix A.5 ("do not ship Axie artwork before the
  licence context is right"), this prototype uses only original, non-Axie visuals until
  we've actually registered. Swapping in the kit is a presentation change, not an
  architecture change — see `web/src/data.js` for where model/rarity data lives.
- ~~Generated visual art — deliberately lowest priority~~ **Done, and now in scope.** All
  **30 tool models** + **3 blind-box crates** are AI-generated (Higgsfield/Recraft,
  pixel-art style, backgrounds removed, `web/assets/tools/` and `web/assets/boxes/`), plus
  the **2 mining-node scenes** (`web/assets/nodes/`, full-scene JPEGs, no background removal
  needed), one hero banner (`web/assets/ui/banner.jpg`), and one **original crew critter**
  (`web/assets/crew/miner-critter.png`) standing in for an Axie in the node site screen —
  not Axie art, a generic non-derivative creature, per the same Appendix A.5 constraint.
  Refinery NFTs (§5.1) deliberately
  stay hand-drawn SVG, not raster — a simple rarity-tinted furnace icon
  (`refineryIconSVG` in `web/src/icons.js`) rather than spending generation credits on a
  fourth art pass for an abstract "efficiency booster" concept that doesn't need a scene or
  a collectible model. Original, non-Axie imagery throughout — readable as Lunacia Deep's
  own gear, not a copy of specific copyrighted Axie character art (same non-derivative-design
  principle already applied to CardChain PH). This isn't blocked on Vibeathon registration:
  **the Ronin/Axie Builders Program (Appendix A) is the real target** if the Vibeathon window
  closes, and this art is useful in that pitch regardless of which door we go through.
- **Ronin/blockchain integration.** No wallet connect, no on-chain contracts, no real
  tokens. `docs/DESIGN.md` §15 (the validation plan) explicitly calls for this exact kind
  of blockchain-free prototype as Test #1, before any contract or audit spend — this build
  *is* that test, not a shortcut around it.
