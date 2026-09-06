# Economy model — §15 Test #3

Generated 2026-09-06 by `sim/economy-sim.js`. This is the
one-page model Appendix A.3 asks for before contacting Sky Mavis BD — the output of the
Phase 0.5 validation gate (§15), not a final audited projection. Re-run whenever a formula
in `web/src/economy.js` or `docs/DESIGN.md` changes: `node sim/economy-sim.js`.

**Assumptions are load-bearing and stated in `sim/economy-sim.js`'s header** — spend-tier
shares/budgets, OPEX, and the bear-market spend pullback are industry-typical guesses, not
Lunacia Deep data (none exists pre-launch). Tune them there, not here.

---

## Kill signal 1 — does the Genesis race stall (>18mo) or resolve too fast (<2mo)?

| DAU | Scenario | 1st Genesis minted | 100th Genesis minted | Verdict |
|---|---|---|---|---|
| 1,000 | bull | day 150 (~5.0 months) | not reached in the simulation window | 🚨 FAIL |
| 1,000 | bear | day 158 (~5.3 months) | not reached in the simulation window | 🚨 FAIL |
| 10,000 | bull | day 106 (~3.5 months) | day 256 (~8.5 months) | ✅ PASS |
| 10,000 | bear | day 124 (~4.1 months) | day 275 (~9.2 months) | ✅ PASS |
| 50,000 | bull | day 87 (~2.9 months) | day 159 (~5.3 months) | ✅ PASS |
| 50,000 | bear | day 134 (~4.5 months) | day 184 (~6.1 months) | ✅ PASS |

*Kill signal: first Genesis before day 60 (race trivial) or the 100th still unminted past
day 540/~18mo (race dead). §2.6's 40% base odds + pity-on-3rd is the lever to retune if this fails.*

**The 1,000 DAU failure is a population problem, not a broken odds table** — the *first*
Genesis mints on a healthy timeline even there (~5 months), it's the *100th* that never
arrives, because only ~100 players (whale+dolphin share of 1,000 DAU) are ever eligible to
attempt it at all. 10,000+ DAU clears both bounds comfortably. Do not raise base odds off a
slow race at low launch DAU — that's exactly the wrong fix for this failure mode.

---

## Kill signal 2 — does a median non-paying player see progress by day 14?

| DAU | Scenario | Cohort | Median ore | Median tools owned | Verdict |
|---|---|---|---|---|---|
| 1,000 | bull | F2P (strict zero-spend) | 2,700 | 0 | ✅ PASS |
| 1,000 | bull | Minnow (light spender) | 4,500 | 2 | ✅ PASS |
| 1,000 | bear | F2P (strict zero-spend) | 2,700 | 0 | ✅ PASS |
| 1,000 | bear | Minnow (light spender) | 4,500 | 2 | ✅ PASS |
| 10,000 | bull | F2P (strict zero-spend) | 2,700 | 0 | ✅ PASS |
| 10,000 | bull | Minnow (light spender) | 4,500 | 2 | ✅ PASS |
| 10,000 | bear | F2P (strict zero-spend) | 2,700 | 0 | ✅ PASS |
| 10,000 | bear | Minnow (light spender) | 4,500 | 2 | ✅ PASS |
| 50,000 | bull | F2P (strict zero-spend) | 2,700 | 0 | ✅ PASS |
| 50,000 | bull | Minnow (light spender) | 4,500 | 2 | ✅ PASS |
| 50,000 | bear | F2P (strict zero-spend) | 2,700 | 0 | ✅ PASS |
| 50,000 | bear | Minnow (light spender) | 4,500 | 2 | ✅ PASS |

*F2P here is strict zero-spend (free starter crew only, §8 — can't withdraw by design,
so "progress" is ore/tool count, not claimable tokens). Minnow is the closest reading of
"non-paying" as "not a real spender." Reported separately since the doc's phrasing doesn't
disambiguate — see this file's header.*

---

## Kill signal 3 — does the payout survive a 60%-in-90-days token price crash?

| DAU | Scenario | Cumulative revenue | RON+AXS paid out | Payout ratio | Treasury ops min balance | Went negative? |
|---|---|---|---|---|---|---|
| 1,000 | bull | $661,831 | $231,647 | 35.0% ✅ PASS | $-49,157 | 🚨 day 0 |
| 1,000 | bear | $650,602 | $227,616 | 35.0% ✅ PASS | $-50,280 | 🚨 day 0 |
| 10,000 | bull | $6,417,690 | $2,243,064 | 35.0% ✅ PASS | $320 | ✅ never |
| 10,000 | bear | $6,269,595 | $2,191,383 | 35.0% ✅ PASS | $279 | ✅ never |
| 50,000 | bull | $32,002,194 | $11,190,499 | 35.0% ✅ PASS | $2,224 | ✅ never |
| 50,000 | bear | $31,176,702 | $10,895,352 | 34.9% ✅ PASS | $1,658 | ✅ never |

*The RON/AXS payout pools are funded fresh each day (25%/10% of trailing-7d average
revenue, converted at that day's price) and paid out same-day — there is no pre-purchased
token inventory for a price crash to drain, which is why the payout ratio holds at ~35%
regardless of scenario. The real solvency question is the **treasury ops cushion**
(10% of revenue, funding modeled infra/ops cost) — that one can genuinely go negative if a
price crash also spooks spend (modeled here as a 30% pullback in whale/dolphin budgets for
the 90-day crash window). If it fails above, the fix is opex discipline or a bigger ops
share, not the payout formula — see §14.2/§5.*

**Note what actually drove the 1,000 DAU failure above: bull and bear fail almost
identically** ($-49,157 vs $-50,280) — that's modeled fixed OPEX exceeding what 10% of a
small population's revenue can cover, not the price crash. The crash barely moves the
number. This is a launch-scale problem, not a bear-market problem, and it resolves itself
at 10,000+ DAU in every run here.

---

## Genesis attempt log (first 10 mints, largest DAU/scenario run)

| # | Day minted | ~Month |
|---|---|---|
| 1 | 87 | 2.9 |
| 2 | 102 | 3.4 |
| 3 | 106 | 3.5 |
| 4 | 107 | 3.6 |
| 5 | 109 | 3.6 |
| 6 | 109 | 3.6 |
| 7 | 115 | 3.8 |
| 8 | 116 | 3.9 |
| 9 | 116 | 3.9 |
| 10 | 117 | 3.9 |
