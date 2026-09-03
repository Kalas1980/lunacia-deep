# Lunacia Deep

An asynchronous idle mining game on Ronin: Axies work NFT digging tools that wear out and
must be repaired (SLP) or, past a hard durability floor, fused with a same-rarity tool to
come back online. AXS, RON, and SLP are mined; tools are minted via USDC blind boxes.

- **Full design:** [docs/DESIGN.md](docs/DESIGN.md) — economy, tokenomics, the Genesis/
  Ascension endgame, security plan (Appendix B), Ronin/Axie licensing path (Appendix A).
- **What this repo currently builds, and what it doesn't yet:** [SCOPE.md](SCOPE.md).
- **Vibeathon submission draft:** [SUBMISSION.md](SUBMISSION.md).

## What's here

A no-blockchain, no-dependency browser prototype of the core loop — Codex chase, blind
boxes, shifts, durability, repair, and the Fusion Repair mechanic — built to be the
validation test that [DESIGN.md §15](docs/DESIGN.md) requires before any real contract or
audit spend happens. Plain HTML/CSS/JS, ES modules, no build step, no framework.

## Run it

```bash
npm run serve
```

Then open <http://localhost:8080>. (Any static file server works — it's plain HTML/CSS/JS.)

## Test it

```bash
npm test
```

Runs Node's built-in test runner against `web/src/economy.js` — the pure, side-effect-free
implementation of the design doc's repair/Fusion/Reforge/yield formulas. No test framework,
no fixtures; `node:assert` + `node:test` only.

## Repo layout

```
docs/DESIGN.md         the actual game design and business plan
SCOPE.md                what the prototype implements vs. simplifies vs. defers, and why
SUBMISSION.md           Vibeathon Round 1 submission draft
web/
  index.html
  style.css
  src/
    data.js             rarities, models, box odds, node stats — all pulled from DESIGN.md
    economy.js           pure functions: repair, Fusion Repair, Reforge, shift yield
    rng.js               local commit–reveal demo (Web Crypto SHA-256)
    state.js             localStorage-backed game state
    main.js               rendering + event handling, wires the above together
test/economy.test.js    self-check for the economy.js formulas
```

## Status

Core loop implemented and manually verified end-to-end (shift → collect → durability drain
→ repair roll → Broken → Fusion Repair; blind box commit–reveal; Reforge tier-up). 16/16
unit tests passing. Not yet registered for the Vibeathon — see the parent conversation for
the go/no-go call once this build is in front of the user.

## License

No LICENSE file — all rights reserved by default. This holds the game design and economy
(`docs/DESIGN.md`), not just code; if this repo is made public for Vibeathon judging, that
default stays in place unless a license is deliberately added.
