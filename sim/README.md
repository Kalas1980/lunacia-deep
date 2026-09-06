# Economy simulation

Implements `docs/DESIGN.md` §15 Test #3 — the agent-based economy sim gating Phase 1, and
the "one-page economy model" Appendix A.3 asks for before contacting Sky Mavis BD.

## Run it

```bash
node sim/economy-sim.js                          # default: 1k/10k/50k DAU, 730 days
node sim/economy-sim.js --dau=10000 --days=365   # override either
npm run sim                                      # same as the default above
```

Writes the report to [`docs/ECONOMY-MODEL.md`](../docs/ECONOMY-MODEL.md). Takes about
3 minutes for the default three-DAU, two-scenario (bull/bear), 730-day sweep.

## Files

- `economy-sim.js` — the simulation engine, player model, and report generator.
- `genesis.js` — §2.6 Genesis roll math. Not in `web/src` because Genesis is explicitly out
  of the Round 1 prototype's scope (see `../SCOPE.md`), but the sim needs it.

## What this is and isn't

This reuses the actual shipped formulas (`web/src/economy.js`, `web/src/data.js`) rather
than re-deriving them, so a passing result means the *implemented* math holds up, not a
paraphrase of it. It is **not** a final audited economic model — it's Phase 0.5 validation
per §15: cheap, fast, and meant to catch a broken assumption before contract/audit spend,
not to survive a VC's due-diligence review. Every behavioral assumption (spend tiers, OPEX,
bear-market spend pullback) is stated in `economy-sim.js`'s header comment, not buried in
the code — read it before trusting a specific number, and re-run after any change to the
formulas it imports or to the constants in that header.

Re-run whenever `web/src/economy.js`, `web/src/data.js`, or the Genesis numbers in
`docs/DESIGN.md` §2.6 change — the report is a generated artifact, not hand-maintained.
