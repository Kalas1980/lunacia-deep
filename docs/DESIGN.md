# Lunacia Deep — Ronin Mining Game
**Design & Build Plan v0.1**
Working title: *Lunacia Deep* (alt: *Deepdig*, *The Ronin Shaft*)

Genre: asynchronous idle/management RPG on Ronin. Players assign Axies to NFT digging
tools and run mining shifts. Tools wear out, SLP repairs them, USDC blind boxes mint them,
AXS / RON / SLP come out of the ground.

---

## 0. Hard constraints — read before designing anything else

These four kill naive versions of this game. Every mechanic below is shaped by them.

| # | Constraint | Consequence for design |
|---|---|---|
| 1 | **You cannot mint SLP.** SLP minting is controlled by Sky Mavis contracts. No third party can create SLP. | SLP is a **closed loop**: players pay SLP for repairs → that SLP is pooled → the pool *is* the SLP mining reward. Faucet ≤ sink, always. Ship a net burn (see §4). |
| 2 | **You cannot mint AXS or RON either.** "Mining" AXS/RON means *distributing tokens you already bought.* | The reward pool must be funded by **real revenue** (blind box USDC + marketplace fees). Emissions are a function of revenue, not a fixed constant. §5. |
| 3 | **Axie NFTs are Sky Mavis IP.** Using Axies as playable assets requires being inside the Ronin/Axie **Builders Program**. Not optional, not a "ship first, ask later." | Line item in Phase 0. Until approved, build against a generic "Miner NFT" interface so Axies are a *pluggable* asset type, not a hard dependency. |
| 4 | **Blind boxes are loot boxes.** PH, EU (BE/NL hard bans on paid loot boxes), Apple/Google odds-disclosure rules, and "play-to-earn" marketing edges toward securities/gambling scrutiny. | Publish odds on-chain, offer a **direct-purchase price for every item** (removes the "gambling" leg in most jurisdictions), geoblock BE/NL, never market fixed or projected returns. §12. |

The single most important design consequence: **this game has no money printer.** Every
token that leaves is a token that came in. Design the whole economy as a *revenue-share
machine wearing a mining-game costume*, and it survives a bear market. Design it as
"mine AXS forever" and it's dead in ninety days.

---

## 1. Core loop

```
Buy blind box (USDC)  →  mint Tool NFT (durability 100/100)
        ↓
Assign 3 Axies + 1 Tool  →  a CREW
        ↓
Send crew to a NODE for an 8h SHIFT   (durability drains)
        ↓
Collect ORE (off-chain balance)  →  ORE splits three ways:
        ├─ Refine → AXS / RON / SLP  (on-chain claim, pro-rata daily pool)
        ├─ Craft  → better tools, consumables, permits
        └─ Repair → pay SLP to restore durability   ← the sink that feeds the SLP faucet
        ↓
Tool max-durability degrades each repair → eventually retires → salvage for parts
        ↓
Buy another box / craft a replacement
```

Session length: **8 hours per shift, 3 shifts/day.** Asynchronous by design — no twitch
gameplay means no bot advantage, and it plays fine on a phone in the Philippines on 4G.

---

## 2. Assets

### 2.1 Tool NFTs (ERC-721)

**Rarity ladder — Axie-native, four box tiers plus one earned apex:**

| Rarity | Models | Base yield × | Max dur. | Retirement | Max-dur lost on failed repair | Repair cost (SLP/pt) | At 0 durability |
|---|---|---|---|---|---|---|---|
| **Common** | 10 | 1.00 | 100 | at ≤40 maxDur (§2.1) | 3 | 2 | **Broken — Fusion only (§4.5)** |
| **Rare** | 10 | 1.60 | 100 | at ≤40 maxDur (§2.1) | 2 | 6 | **Broken — Fusion only (§4.5)** |
| **Epic** | 5 | 2.50 | 100 | **never**, floors at 40 (§4.2) | 2 | 16 | **Broken — Fusion only (§4.5)** |
| **Mystic** | 5 | 3.50 | 100 | **never**, floors at 40 (§4.2) | 2 | 30 | **Broken — Fusion only (§4.5)** |
| **Genesis** | 1 (100 supply) | 5.00 | **150** | **never, cannot fail** | 0 | 45 | Exempt — cannot fail, cannot go Broken |

*One rule, all tiers: every repair attempt rolls `pSuccess` (§4.2); only a **failed** roll costs
`maxDurability`. The only difference between tiers is what happens once `maxDurability`
bottoms out at 40 — Common/Rare retire (Worn → salvage/reforge, §2.1), Epic/Mystic floor
there and keep going forever (§4.2), Genesis never fails so it never arrives.*

*Design note — I dropped "Uncommon" and renamed "Legendary" → "Mystic" to match Axie's own
part-rarity language (Common / Rare / Epic / Mystic). Four box tiers is also tighter than
five: it makes "one of every tool" a reachable goal, which is what the Genesis gate (§2.6)
is built on.* **30 tool models total.**

On-chain state per tool: `tier, durability, maxDurability, repairCount, perkSeed, boundNodeTier`.

**Retirement — Common / Rare only.** Every repair permanently lowers
`maxDurability`. At `maxDurability <= 40` the tool is **Worn** and can no longer be
repaired. A Worn tool has exactly two exits: **salvage** (burn for Gears + Alloy) or
**reforge** (§2.4). Both destroy the NFT. This is what stops infinite supply at the tiers
that blind boxes actually print.

**Epic, Mystic and Genesis never die.** They can always be repaired with SLP — but the repair
itself can **fail** (§4.2). Their sink is not destruction, it is a *permanent maintenance
tax*: an immortal asset that must be fed SLP forever. For an idle game that is a better
economic engine than a disposable one — the drip never stops, and the top of the ladder
stays worth climbing to.

### 2.4 Reforging — dead tools are feedstock, not garbage

**Two tools of the same tier are burned to forge one new tool of that same type, with the
rarity re-rolled.** Both inputs are destroyed regardless of outcome. Net tool supply still
falls by one per reforge, so the sink from §2.1 survives intact.

**Condition drives the odds.** A tool's fitness as feedstock:

```
condition_i  = 0.5 × (durability_i / 100) + 0.5 × (maxDurability_i / 100)
forgeScore   = (condition_A + condition_B) / 2          // 0.00 – 1.00

pUpgrade = 0.05 + 0.30 × forgeScore
pFlaw    = 0.60 − 0.52 × forgeScore
pMatch   = 1 − pUpgrade − pFlaw
```

| Outcome | Result |
|---|---|
| **Upgrade** | tier **+1**, fresh 100/100, `repairCount = 0` |
| **Match** | same tier, fresh 100/100, `repairCount = 0` |
| **Flaw** | same tier, 60/60 — born partly worn |

| forgeScore | Inputs look like | Upgrade | Match | Flaw |
|---|---|---|---|---|
| 0.00 | two dead Worn tools, 0/40 each | 5% | 35% | 60% |
| 0.20 | 0/40 + 40/60 | 11% | 39% | 50% |
| 0.50 | half-spent pair | 20% | 46% | 34% |
| 1.00 | two untouched 100/100 tools | 35% | 57% | 8% |

Continuous, no breakpoints — one line of contract code, and no cliff for players to game.

**Eligibility:** Common and Rare only. **Epic, Mystic and Genesis cannot be reforge
inputs** — they are immortal (§4.2) and have no death to salvage. `Rare + Rare → Epic`
additionally requires a
**Master Blueprint** (rare T4/T5 node drop). Top-tier scarcity stays tied to blind boxes,
which is where the revenue that funds §5 actually comes from.

**Cost:** SLP (routed through the same 65/25/10 split as repairs, §4) + Gears + Alloy,
scaling with input tier. Reforging is therefore *also* an SLP sink.

**The intended incentive — read this before tuning the constants.** Forging *fresh* tools
is deliberately bad value: two Rares bought via Prospector's Cases run ≈200 USDC for a 35%
Epic shot (≈570 USDC per Epic), while Deep Vaults produce an Epic at ≈200 USDC and can also
drop Mystic. Boxes must always win on price. Reforging is a **salvage-value floor** for
tools you have already fully used, not a cheaper path to the top. If a sim ever shows the
forge beating the box, the box economy is dead — cut `pUpgrade`, not the box odds.

The resulting decision is genuinely interesting: retire a tool at 0/40 and reforge at 5%
upgrade odds, or stop mining it early at 60/70 and reforge at ~24% — paying in unmined ore
for better odds. Both are defensible; neither dominates.

### 2.2 Consumables (ERC-1155)
- **Fuel Cell** — −50% durability drain for one shift.
- **Lubricant** — +15% yield for one shift.
- **Depth Permit (T3/T4/T5)** — one shift of access to a deep node. Crafted from ore, or bought with RON. Primary RON sink.
- **Repair Kit** — restores 25 durability, cannot fail, no `maxDurability` loss. Rare drop, deep nodes only.
- **Repair Flux** — **+15pp repair success chance** for one attempt (§4.2). Crafted from Alloy + Circuit. The most-consumed item in the game once Epics are common.
- **Prime Core** — restores **+10 `maxDurability`** (cap 100) on an Epic/Mystic. T5 node drop or direct USDC purchase. The premium item, and the recurring revenue that replaces top-tier tool churn (§14.1).

### 2.3 Materials (ERC-1155, minted on claim only)
Gears, Alloy Ingot, Circuit, Blueprint (tier-specific). Crafting a Rare tool ≈ the cost of
~3 Premium boxes, so crafting is a real alternative to gambling — which is also the
regulatory hedge from §0.4.

### 2.5 The Tool Codex — 30 models

Rarity sets the power band; the **model** sets the flavour. Every model carries exactly one
signature trait drawn from six axes, so 30 tools are meaningfully different without 30
special cases to balance:

**Yield** (+% ore) · **Endurance** (−durability drain) · **Fortune** (+rare-ore find) ·
**Tempo** (−shift length — more cycles per day, the idle player's stat) ·
**Resilience** (+pp repair success, §4.2) · **Affinity** (bonus on a specific ore or node tier)

#### Common — 10 models · hand tools · ×1.00
| # | Tool | Signature trait |
|---|---|---|
| C1 | Hand Shovel | Yield +6% |
| C2 | Field Spade | Endurance −6% drain |
| C3 | Rock Hammer | Affinity: +8% Dust |
| C4 | Stone Chisel | Fortune +4% |
| C5 | Prospector's Pan | Fortune +6% on Dust only |
| C6 | Pry Bar | Tempo −5% |
| C7 | Hand Auger | Affinity: +8% Iron |
| C8 | Sifting Sieve | Fortune +4%, Tempo +5% (slower) |
| C9 | Miner's Mallet | Resilience +4pp |
| C10 | Hauling Bucket | Yield +4% and Endurance −4% |

#### Rare — 10 models · mechanical · ×1.60
| # | Tool | Signature trait |
|---|---|---|
| R1 | Steel Pickaxe | Yield +12% |
| R2 | Reinforced Shovel | Endurance −12% |
| R3 | Twin-Blade Mattock | Yield +12%, Tempo −5% |
| R4 | Crank Auger | Tempo −10% |
| R5 | Spring Sledge | Yield +18% on T1–T2 nodes only |
| R6 | Ore Sluice | Fortune +8% |
| R7 | Cutting Torch | Affinity: +15% Iron & Silver |
| R8 | Ratchet Drill | Endurance −8%, Resilience +6pp |
| R9 | Gear Winch | +10% yield when all 3 Axies share a class |
| R10 | Tempered Wedge Kit | Resilience +10pp |

#### Epic — 5 models · powered · ×2.50
| # | Tool | Signature trait |
|---|---|---|
| E1 | Jackhammer Rig | Fortune +10%, Yield +8% |
| E2 | Pneumatic Drill Array | Yield +20%, but **2× durability drain** |
| E3 | Rotary Core Borer | **Tempo −20%** — the idle-optimiser's pick |
| E4 | Arc Cutter | Affinity: +25% Silver & Moonstone |
| E5 | Seismic Charge Pack | 4% chance to double a shift's yield |

#### Mystic — 5 models · Lunacian tech · ×3.50 · each has a named perk
| # | Tool | Perk |
|---|---|---|
| M1 | Lunacian Excavator | **Seismic Charge** — 5% chance to double a shift |
| M2 | Moonwell Bore | **Moonlit** — +40% Moonstone find rate |
| M3 | Aether Resonator | **Attunement** — failed repairs never reduce `maxDurability` |
| M4 | Chimera Ripper | **Ravenous** — +25% yield, 2× durability drain |
| M5 | Starfall Auger | **Starfall** — 1.5% chance per shift to drop a Prime Core |

**Duplicate protection:** when a box rolls a rarity, it picks a model the wallet does **not
already own** 80% of the time (if any remain). Without this the codex is a coupon-collector
nightmare and the Genesis gate becomes whale-only luck. With it, it becomes a grind — which
is what you want.

### 2.6 Genesis — *The Progenitor*

**100 ever. Not dropped, not first-come. You complete the Codex, then you roll it.**

### The gate

Hold, simultaneously, in one wallet — **10 distinct Commons, 10 distinct Rares, 5 distinct
Epics, 5 distinct Mystics.** That is *one of every tool in the game*: the complete 30-model
Codex.

### The roll

A complete Codex can be **rolled** for a **chance** at the right to buy a Genesis. It is not
a queue and there is no deadline — **the race stays open until the 100th Genesis is minted,
and anyone can keep trying the whole time.** When the counter hits 100 it closes forever.

| | |
|---|---|
| **Cost of one roll** | **Burns the Epic set + the Mystic set** (5 + 5 tools). Commons and Rares are verified as held, **not** burned. |
| **Base odds** | **40%** |
| **Pity** | Guaranteed on your **3rd** roll. Expected ≈ **2 Codex rolls per Genesis**. |
| **On failure** | **A tool back** — 1st failure returns a fresh **Epic**, 2nd failure returns a fresh **Mystic** — plus 2× Prime Core and a **Founder's Mark** (cosmetic, permanent, shown on your profile; people wear their failed attempts) |
| **On success** | 7 days to pay **1,000 USDC**. Miss it and the slot returns to the pool. |
| **Per-wallet cap** | **3 Genesis maximum.** One whale must not own 40% of the flagship supply. |
| **Randomness** | Same published commit–reveal as blind boxes (§7). This is the highest-stakes roll in the game; it must be independently verifiable. |

**The failure return is deterministic, not another roll.** Failure #1 hands back a fresh
Epic; failure #2 hands back a fresh Mystic; failure #3 cannot happen (pity). Both are
new mints, dupe-protected toward models you are missing, so the consolation actively
rebuilds you toward the next attempt.

Stacking RNG on top of a loss is the single most rage-inducing pattern in gacha — losing a
$5,000 roll and *then* losing a coin flip for the consolation is how you turn a disappointed
player into a hostile one. A guaranteed, legible ladder ("the second failure always returns
a Mystic") costs the sink almost nothing and is worth far more than the tools it gives away.

**What this costs the sink: about 6%.** Expected net burn per Genesis minted falls from
10 Epics + 10 Mystics to roughly **9.2 Epics + 9.4 Mystics** — the Mystic bottleneck, which
is what actually gates the race, barely moves. Cheap price for the difference between a
chase and a mugging. It is also not farmable: burning ten tools to recover one is
catastrophic EV as a strategy, so nobody will fail on purpose.

**Why it burns exactly the Epic and Mystic sets.** Epic and Mystic tools are immortal
(§4.2) — they can never retire, so absent this they have *no terminal sink at all* and
their floor price decays forever as supply accumulates. The Genesis roll is that sink. Now
every tier has one: Common and Rare die by retirement and reforge (§2.1, §2.4), Epic and
Mystic die by ascension. That symmetry is the best structural property in this document.

**Price of the ticket: 1,000 USDC**, deliberately modest. The real price is the Codex — and
at ~2 rolls per Genesis, that is roughly **10 Epics and 10 Mystics consumed per Genesis
minted**. Pricing the ticket high on top of that would leave slots unsold, and 60 minted
Genesis tools is a far weaker flagship than 100. You want all 100 claimed, loudly, with
names attached.

> `ponytail:` base odds and the burn set are the two knobs that decide whether this is a
> $500k or a $2M revenue engine, and whether it feels like a chase or a mugging. Both are
> timelocked config. Tune on the live Mystic floor price, not on this document.

**The Progenitor's stats:**

| Property | Value |
|---|---|
| Base yield | **×5.00** |
| Max durability | **150** (50% more idle uptime between check-ins) |
| Repair failure | **Never.** `pSuccess = 100%`, `maxDurability` never decays |
| Crew size | **4 Axies** instead of 3 — the only tool in the game that changes crew shape |
| *First Light* | One free full repair per week |
| Reforge / salvage | Forbidden. It cannot be destroyed. |
| Identity | Numbered **#1–#100** on-chain, engraved with the qualifying wallet's handle |
| Tradeable | **Yes** — this is the ecosystem's blue-chip asset, and it should have a market |

**What Genesis holders must NOT get: revenue share, dividends, or any claim on treasury
income.** That converts the NFT into a security in most jurisdictions and torches the
project. Give them power, scarcity, identity, and priority access to T5 slots (§6) —
never a cash flow. This is not a stylistic preference; it is the line between an NFT and
an unregistered offering.

**Why this mechanic is worth building:** the Genesis race creates standing, *renewing*
demand for every rarity including Commons — renewing because each roll destroys ten
top-tier tools and the loser has to rebuild. Common tools are otherwise economically worthless the
moment a player can afford Rares — the codex makes them permanently collectible, props up
the floor of the entire tool market, and routes enormous volume through your 4% royalty.
It is simultaneously the endgame goal, the marketplace engine, and the answer to the
top-tier-floor-decay risk in §12.

### 2.7 Ascension Seasons — the sink that outlives Genesis

**This closes the largest open item flagged in §14.4.** Genesis is capped at 100 and its
roll (§2.6) is the only burn Epic and Mystic tools have. When slot 100 mints, that burn
stops — permanently, unless something replaces it. It has to exist *before* that day, not
be improvised on it.

**The fix reuses machinery that already exists**, rather than adding a new system: the same
5+5 burn, the same commit–reveal roll, the same Seasons cadence from §8 — just uncapped and
recurring instead of a single 100-slot race.

**How it works, starting the season *after* Genesis slot 100 mints:**

| | |
|---|---|
| **Cadence** | Once per 8-week Season (§8), reusing the existing season clock |
| **Cost per attempt** | Burn one Epic set + one Mystic set (5 + 5) — identical to the Genesis roll |
| **Odds** | **60% base, guaranteed on 2nd attempt** — deliberately easier than Genesis ever was, because there is no scarcity left to protect |
| **On success** | Mint an **Ascendant** tool: same stat line as Genesis (×5.00 yield, 150 max dur., cannot fail repairs, 4-Axie crew) but **stamped with the season number**, not numbered #1–100, and visually distinct from the Progenitor line |
| **On failure** | Same deterministic return as §2.6 (fresh Epic, then fresh Mystic on 2nd try) |
| **Per-season cap** | **None on attempts. A soft cap of 150 mints/season**, throttled by lowering that season's odds toward 40% if mints are pacing to exceed it — publish the live count on the dashboard (§16), same pattern as the Genesis counter |

**Why Ascendants are not just more Genesis tools.** They carry full Progenitor-tier power —
anything less and top-tier players stop burning for them, the sink goes idle, and the
problem this section exists to solve comes right back. What they do *not* get is the
Progenitor's identity: no #1–100 numbering, no "first 100" story, no claim on being early.
Genesis stays the permanent, unrepeatable flex; Ascendants are the permanent, renewable
engine room. Collectors chase one; grinders feed the other. Different audiences, same
supply-and-demand mechanics, and the whole thing runs on code already shipped for §2.6 —
this is closer to a config change than new development.

**Why this is also good business, not just good economics.** A hard stop at Genesis slot
100 has an unpleasant side effect: the moment the counter hits 100, top-tier tool trading
volume — the thing paying your 4% royalty — has no reason to keep moving. Ascension Seasons
keep that market open indefinitely instead of ending it on a fixed date.

---

## 3. Axies: what actually matters

An Axie is **labour**; the tool is **capital**. Neither alone mines.

- **Crew = 3 Axies + 1 Tool** (4 Axies for Genesis, §2.6). (Mirrors the Axie battle team-of-3, instantly legible to existing players.)
- One Axie can be in one crew at a time. Assignment is a signature-based delegation — **do not escrow other people's Axies** if you can avoid it; scholarship/manager wallets already work this way and custody is a liability you don't want.

**Class → mining role** (derived read-only from Axie metadata):

| Class | Role | Effect |
|---|---|---|
| Beast, Bug | **Digger** | +12% base ore yield |
| Plant, Reptile | **Bracer** | −20% tool durability drain |
| Aquatic, Bird | **Prospector** | +15% rare-ore find chance |
| Dusk, Mech, Dawn | **Foreman** | +8% to *all* crew bonuses (multiplicative) |

**Synergies:** a 3-of-a-kind crew gets +10%; a Digger+Bracer+Prospector "balanced crew"
gets +6% to all three effects. Gives every Axie in the existing 10M+ supply a reason to
exist, including the cheap floor ones — which is the actual business case Sky Mavis cares about.

**Stamina:** each Axie has 3 shift-charges/day, refreshing at 00:00 UTC. Caps per-Axie
throughput without capping the whales who own more Axies.

---

## 4. Durability & the SLP loop

**The headline rule, stated once before the mechanics:** SLP repair only works between
1 and 100 durability. **At exactly 0, a tool is Broken — it cannot mine, and it cannot be
repaired with SLP at any price.** The only way back is Fusion (§4.5): burning a second
tool of the same rarity. Every player, at every tier, has to watch this number. That is
the intended pressure, not a bug to soften.

### 4.1 Cost

```
repairCost_SLP = (100 - durability) × tierRate × (1 + 0.02 × repairCount)
```

Cost rises with every repair. For Common–Rare it rises alongside a shrinking
`maxDurability` until retirement becomes the rational choice — a soft, chosen death rather
than a cliff. For Epic/Mystic it rises forever, which is the point: the maintenance tax
is the sink.

### 4.2 Repair is a roll, not a purchase

**Repairing can fail, and emptier tools are riskier to repair.**

```
pSuccess = 0.95 − 0.30 × (missingDurability / 100) − 0.005 × repairCount
           + 0.15 if Repair Flux used
           floored at 0.50
```

| Repairing at | Missing | pSuccess (fresh tool) |
|---|---|---|
| 90 / 100 | 10 | **92%** |
| 70 / 100 | 30 | **86%** |
| 50 / 100 | 50 | **80%** |
| 20 / 100 | 80 | **71%** |
| 0 / 100 | 100 | **65%** |

**On success:** durability restored to `maxDurability`. SLP consumed.
**On failure:** SLP consumed, **half** the intended durability restored, and
`maxDurability −2`. A setback, never a disaster — and for Epic/Mystic, `maxDurability`
floors at **40**. It can never go lower and the NFT is never destroyed. **Genesis never
rolls at all** (§2.6), and the Mystic *Aether Resonator* (M3) is immune to the decay.

**This roll only exists while durability is 1–100.** It is not a rescue from 0 — by the
time a tool is sitting at 0 it has already missed every chance to repair, including the
worst-odds 65% roll above. §4.5 covers what happens next.

So a heavily abused Mystic is still a Mystic: still tradeable, still 3.5× yield,
just carrying a 40-point tank instead of 100 — meaning it needs repairing ~2.5× as often.
It becomes a *more* expensive asset to run, forever. That is the sink. **Prime Cores**
(§2.2) are the only way back up, which is exactly where the top-tier revenue lives.

### 4.3 This is the core idle decision

An idle game's real currency is **player attention**, and this mechanic prices it:

> **Top up often** — cheap, ~92% safe, but you have to show up.
> **Run it close to empty** — maximum uptime per check-in, but the 65% roll at 1/100 is
> the last exit before the tool goes Broken. Miss that window and SLP can't save it —
> only Fusion can (§4.5), and Fusion costs a whole second tool.

Both are defensible **as long as the player stops before literal zero.** "Run it low" and
"run it to 0" now have very different consequences — the first is the intended
high-risk/high-reward idle play, the second is a mistake that costs a tool. That gap is
deliberate: it is what makes the durability number worth checking, in a game whose entire
genre is built on being checked as little as possible.

**Standing Orders** close the loop for players who genuinely never want to log in: set an
auto-repair threshold (e.g. "repair at 40%") and the backend executes it on schedule for a
**+10% SLP premium**. Convenience, not power — and another sink.

**Standing Orders now do double duty: they are the safety net against ever going Broken.**
A player who sets one never sees 0/100 — the backend repairs at the threshold before the
cliff in §4.5 is reachable. This is the honest, in-game answer to "how do I make sure my
tool never breaks," and it should be surfaced exactly that way in the UI (a one-tap
"never let this go Broken" toggle), not buried as an advanced option.

### 4.4 Where the SLP goes

| Split | Destination | Why |
|---|---|---|
| 65% | **SLP Reward Pool** — redistributed as mining rewards | This is the *entire* SLP faucet. Cannot exceed the sink by construction. |
| 25% | **Burn** (`0xdead`) | Net-deflationary on SLP. This is your headline number in the Sky Mavis pitch deck. |
| 10% | Treasury (ops) | Revenue. |

**Yield penalty:** below 30% durability, crew yield ×0.5. This is what makes running to
empty a real cost rather than free optimisation — the last 30 points of a tank are worth
half as much, so the risky play is already paying for itself before the dice are thrown.

> `ponytail:` every rate in this section is a config row, not a constant. SLP at $0.0015
> vs $0.006 completely changes whether a 3,000-SLP Mystic repair is trivial or brutal.
> Ship a `economy_params` table with an admin-timelocked setter and a public changelog.
> `pSuccess` in particular must be tuned on live data — repair failure is the most
> emotionally expensive event in the game, and the first thing players will rage about.

**Determinism:** repair rolls use the same published daily-seed scheme as shift resolution
(§9.5), so every failure is independently verifiable. Do not let "the repair RNG is rigged"
become an unanswerable accusation — it is the #1 trust attack on any game with paid RNG.

### 4.5 Broken tools & Fusion Repair

**A tool at 0/100 durability is Broken: it cannot be assigned to a crew, and SLP repair
(§4.1–4.2) is no longer offered as an option at any price.** The only path back is
**Fusion** — burn one other tool of the **same rarity** (any model, any condition, even
another Broken one) as fuel.

| | |
|---|---|
| **Fuel required** | 1 tool, same rarity as the Broken tool. Model doesn't matter — 10 Commons and 10 Rares are all valid fuel for each other; likewise the 5 Epics or 5 Mystics. |
| **SLP fee** | `20 × tierRate` — Common 40, Rare 120, Epic 320, Mystic 600. Small next to the value of the burned fuel tool; still routed through the 65/25/10 split (§4.4), so it's still an SLP sink. |
| **Result** | Current durability restored to **50% of the surviving tool's `maxDurability`.** Deterministic — no roll, no RNG. `maxDurability` is untouched by the fusion itself. |
| **Rarity** | Never changes. Fusion repairs the tool you have; it does not re-roll it. |
| **Genesis** | **Exempt.** Genesis repairs never fail (§2.6) and there are only ~100–130 of them ever (§2.6–§2.7) — requiring a second one as fuel would make the flagship asset occasionally undiggable by design. Genesis simply cannot go Broken. |

**Fusion Repair is not Reforge (§2.4) — same verb, different contract, deliberately kept
apart:**

| | **Fusion Repair (§4.5)** | **Reforge (§2.4)** |
|---|---|---|
| When | Mandatory — only when the tool is Broken (0 durability) | Voluntary — any time, any durability |
| Burns | 1 tool (fuel) | 2 tools (both inputs) |
| Keeps | The original tool, restored | Neither input — a **new** tool is minted |
| Rarity | Unchanged | Re-rolled (§2.4's odds table) |
| Outcome | Deterministic partial restore | Probabilistic — upgrade / match / flaw |
| Eligible tiers | **All tiers** (Genesis exempt) | Common/Rare only as inputs (§2.4) |

**Why Fusion applies to Epic and Mystic too, even though they're immortal.** Immortality
in §4.2 was always about `maxDurability` never bottoming out below 40 — it was never a
promise that a neglected tool stays usable. A Broken Epic still can't mine. And this closes
a gap flagged back in §12: Epic/Mystic previously had no sink outside the Genesis/Ascension
roll (§2.6, §2.7); Fusion adds a second, much more frequent one, since it triggers on
ordinary neglect rather than a deliberate high-stakes gamble.

**Why this is worth the harshness it introduces.** Without a hard floor, "run it to 0" was
free — the worst case was a 65% coin flip identical to running it to 1. Now 0 is a cliff:
miss the last SLP-repair window and the fix costs an entire second tool, not SLP. That is
what turns "keep an eye on durability" from a mild suggestion into something every player,
at every tier, actually has to act on — which is the whole point of the change. The blast
radius is bounded by two things already in the design: **Standing Orders** (§4.3) is a
one-toggle way to never see this state at all, and the **yield penalty below 30%** (§4.4)
already gives ample warning before the cliff arrives.

> `ponytail:` 50% restore and `20 × tierRate` are starting points, not settled numbers —
> tune both in the Phase 0.5 sim (§15) against how punishing early playtesters find it.
> If testers report feeling ambushed rather than warned, the fix is a louder low-durability
> alert in the UI, not a softer Fusion cost — the whole mechanic exists to be felt.

---

## 5. Reward pools — the anti-death-spiral valve

**Do not price ore in tokens.** Fixed conversion rates are how every P2E game dies.

Use a **pro-rata daily pool**:

```
your_payout = daily_pool × (your_shards_submitted / all_shards_submitted_today)
```

The pool is fixed for the day; player yield falls automatically as more players join and
rises when they leave. Over-emission becomes *arithmetically impossible*. Yield per shard
floats, and everyone can see why.

**Three refineries, three ore feedstocks** — this is what gives ore types meaning:

| Refinery | Feedstock ore | Pool funded by |
|---|---|---|
| **SLP Refinery** | Stone Dust (T1–T2 nodes, abundant) | 65% of all repair SLP (§4) |
| **RON Refinery** | Iron / Silver "Ronin Ore" (T2–T4) | 25% of trailing-7d net revenue, swapped to RON |
| **AXS Refinery** | Moonstone / *Axieite* (T4–T5 only, rare) | 10% of trailing-7d net revenue, swapped to AXS |

**The payout ratio is 35% of net revenue, published and capped.** Players in aggregate can
never extract more than 35% of what enters. This is the number that makes the business
solvent and the number that makes "play-to-earn income" a lie — see §14.2. Publish it
anyway. A game that is honest about being a game outlives every one that isn't.

**Daily pool size = f(trailing 7-day revenue), hard-capped**, with a 90-day reserve floor
that cannot be drained. Publish the formula and a live dashboard. Revenue sources:
blind box USDC, 4% marketplace royalty on tool trades, permit/consumable sales.

Deep ore is scarce *and* the only AXS feedstock — so AXS yield is gated behind Mystic
tools + Depth Permits + Prospector crews. AXS should feel like a jackpot, not a wage.

---

## 6. Nodes (mining sites)

| Tier | Node | Entry req. | Durability / shift | Base ore / shift | Ore mix |
|---|---|---|---|---|---|
| T1 | Surface Quarry | none | 1 | 100 | 100% Dust |
| T2 | Iron Cut | any Rare+ tool | 2 | 260 | 70% Dust / 30% Iron |
| T3 | Silver Vein | T3 Permit | 3 | 700 | 45/45 Dust-Iron / 10% Silver |
| T4 | Moonstone Hollow | T4 Permit + Rare+ tool | 4 | 1,800 | + 4% Moonstone |
| T5 | **The Deep** | T5 Permit + Epic+ tool + full 3-Axie crew | 6 | 4,500 | + 1.5% Axieite |

T5 nodes have **limited concurrent slots** (e.g. 500 crews globally), allocated by a RON
auction each season. Congestion pricing that doubles as a RON sink and a top-of-funnel
prestige goal.

**Hazards** (T3+): 8% chance per shift of a Cave-In — shift yields 40%, tool takes 2× drain.
Bracer-class Axies halve the chance. Gives Plant/Reptile Axies real value and adds variance
without adding a losing outcome.

---

## 7. Blind boxes

| Box | Price | Common | Rare | Epic | Mystic |
|---|---|---|---|---|---|
| **Basic Crate** | 5 USDC | 82% | 16.5% | 1.4% | 0.1% |
| **Prospector's Case** | 20 USDC | 42% | 46% | 11% | 1% |
| **Deep Vault** | 75 USDC | — | 55% | 38% | 7% |

Model within the rolled rarity is chosen by the duplicate-protection rule in §2.5 — 80%
weighted toward models the wallet is missing. This is what makes the Codex a grind instead
of a lottery, and it is the single highest-leverage retention knob in the game.

- **Pity:** guaranteed Epic+ on every 20th Prospector's Case; guaranteed Mystic within 40 Deep Vaults. Counters are per-wallet, on-chain, and visible.
- **Direct purchase:** every tool tier also has a fixed USDC price (~4–5× box EV). Kills the "no way to get it except gambling" argument and captures whales who hate RNG.
- **Odds are on-chain and immutable per box-series.** Publish them in the contract, not just the FAQ.

**Randomness on Ronin:** don't assume Chainlink VRF is available. Use **two-transaction
commit–reveal**: buy mints a sealed `Box` NFT storing `keccak(serverSeed)` and the buy
block; reveal ≥ N blocks later combines `serverSeed + blockhash + tokenId`. Server seed is
committed *before* the sale opens, so the operator cannot rig outcomes after the fact.
Anything single-transaction using `block.timestamp` is farmable and will be farmed.

---

## 8. Retention systems (the part P2E games always skip)

- **Seasons** (8 weeks): leaderboard by total refined shards, seasonal cosmetic tool skins, seasonal T5 slot auction reset.
- **Syndicates** (guilds, ≤50 members): pooled ore stockpile, +3% guild yield at 20+ active members, guild-vs-guild seasonal ranking. Guilds were Axie's real distribution engine in SEA — build for them on day one, not as a v2.
- **Tool mastery:** a tool that has completed 100 shifts gains +5% permanent yield. Rewards keeping and repairing over flipping.
- **Blueprint collection:** discovering all 5 tier blueprints unlocks a non-transferable crafting bonus. Account-bound progression that can't be bought.
- **Onboarding ramp — non-negotiable for an idle game.** A first session that ends in "come back in 8 hours" kills D1. First shift resolves in **5 minutes**, second in **30**, third in **2 hours**, then the normal 8h cadence. The player must see ore, a repair, and a reward before they close the tab.
- **Free starter crew.** Three non-NFT "Day Labourer" miners (×0.6 yield) and one bound Common shovel, granted on signup. Play immediately, no purchase, no Axie required — but **free-tier output cannot be withdrawn** until the account holds a real Tool NFT (§9.2). This resolves the worst funnel leak in the design: requiring three third-party NFT purchases before the first click.
- **Codex progress screen.** 30 slots, silhouettes for what you're missing, Genesis counter at the top showing how many of the 100 slots remain. This is the retention spine — always visible, always one tool away.
- **Daily contracts:** "mine 500 Iron today → 1 Fuel Cell." Cheap, effective D1/D7 lever.

---

## 9. Anti-abuse

The 8h async loop means **botting is not the threat — Sybil farming is.** Mitigations:

1. **Capital gating.** Rewards require an owned Tool NFT + 3 Axies. A thousand fake accounts costs a thousand tool purchases. The USDC blind box *is* the Sybil resistance.
2. **No free faucet.** There is no "free tier that earns." Free players can play; they can't withdraw. Non-negotiable.
3. **Pro-rata pools** (§5) mean Sybils dilute each other rather than extracting more.
4. **Merkle-root daily claims** — the backend computes shift outcomes and publishes one root per day. Server-authoritative outcomes with an on-chain audit trail. Cheap, and no per-claim gas spiral.
5. **Shift-resolution determinism:** every shift's RNG derives from `(shiftId, serverSeed_day, crewHash)` with the daily seed published after the day closes. Anyone can re-derive and verify every outcome.

---

## 10. Technical architecture

**Chain (Ronin, EVM — Foundry):**
- `MiningTool.sol` — ERC-721 + durability/repair/salvage state
- `Materials.sol` — ERC-1155 consumables & mats
- `BlindBox.sol` — USDC sale, commit–reveal, on-chain odds table, pity counters
- `RepairVault.sol` — SLP in, 65/25/10 split, burn
- `RewardDistributor.sol` — daily Merkle root, claims for AXS/RON/SLP, 90-day reserve floor
- `SeasonAuction.sol` — T5 slot auction (RON)
- Timelock + multisig on every admin setter. No EOA owner. Ever.

**Backend** (NestJS + Postgres/Prisma + BullMQ — matches your existing stack):
- Shift scheduler & resolver worker (the game's heart; must be idempotent and replayable)
- Ronin indexer (tool state, Axie ownership, transfers)
- Daily Merkle builder + root publisher
- Economy service: pool sizing from trailing revenue, param config, public dashboard API

**Client:** Next.js PWA + **Ronin Waypoint SDK** (embedded wallet / social login — the
onboarding gap is where SEA users churn). Mobile-web first, native app later.

**Observability from day one:** token flow dashboard (in vs out, per token, daily), tool
supply & retirement curve, pool coverage ratio, DAU/paying-user split. If you cannot see
faucet-vs-sink on one screen daily, you will not notice the economy breaking until it has.

---

## 11. Roadmap

| Phase | Weeks | Deliverable |
|---|---|---|
| **0 — Clearance** | 1–4 | Ronin/Axie Builders Program application (Appendix A). Legal review of blind boxes and the Genesis roll per target market (PH, VN, ID, BR). Entity formation. |
| **0.5 — Validation** *(parallel with Phase 0)* | 1–6 | The three tests in §15, run together: (a) free non-blockchain prototype of the Codex-chase loop in front of 30–50 testers, (b) landing page + live counter + 3 SEA guild conversations, (c) Phase-1 economy sim at 1k/10k/50k DAU. **Hard gate below.** |
| **1 — Contracts** | 6–10 | All contracts + Foundry invariant tests (`faucet ≤ sink` as a literal invariant). Two audits — one general, one economics-focused. Indexer/event schema for §16 dashboard built alongside, not bolted on after. |
| **2 — Vertical slice** | 8–12 | Saigon testnet: 1 tool tier, 2 nodes, full shift→refine→repair loop, **transparency dashboard (§16) live against testnet data**. Playable, ugly, correct, and auditable from day one. |
| **3 — Closed beta** | 6–8 | 500 invited players, real Axies on testnet, real economy telemetry. Tune every §4/§5/§2.6 constant here — this is the last cheap chance to move `pSuccess`, box odds, and Genesis roll odds before they're public commitments. |
| **4 — Mainnet launch** | 4 | Full 30-model Codex, all 4 box tiers, **Genesis race live from day one**, dashboard public, T1–T3 nodes. Deep + AXS refinery locked. |
| **5 — The Deep** | post-launch | T4/T5, seasons, syndicates, **Ascension Seasons (§2.7) live before Genesis slot 100 mints** — contract for it ships in Phase 1 alongside Genesis, just gated inactive until needed, Lunacia Land integration. |

**Hard gate: Phase 1 does not start until all three Phase 0.5 tests clear (§15).** That is
the point of running validation before contracts, not after — a failed test here costs a
rewrite of a Python script or a prototype; the same failure discovered in Phase 3 costs a
completed audit. If a test fails, fix *that thing* specifically; do not respond by adding
mechanics — that instinct produced two rounds of scope growth earlier in this plan and it
is exactly the failure mode to avoid now.

**The Codex and the Genesis race ship in Phase 4, not Phase 5.** Without them the launch
build is assign → wait → collect, which is not a game. They are the spine, not a content
drop. This is the single most important scheduling call in the plan.

Realistic time to mainnet: **7–9 months** with 4–6 engineers, assuming Phase 0.5 clears on
the first pass. Anyone quoting 3 months has not costed the audits, the Builders Program
timeline, or the validation gate.

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Builders Program rejected / delayed | **Critical** | Generic "Miner NFT" abstraction; game must be shippable with your own miner collection if Axies are unavailable. Do not build a game that is worthless without someone else's permission. |
| Revenue falls → pools shrink → players leave → revenue falls | **Critical** | Pro-rata pools (§5) make this a slow contraction rather than a collapse; 90-day reserve floor; publicly published emission formula so nobody is surprised. |
| Loot box regulation (BE/NL/PH/app stores) | High | Odds disclosure, direct-purchase alternative, geoblocking, no earnings claims in marketing. |
| Tool oversupply → floor to zero → box sales die | High | Retirement + salvage burn (§2.1); reforge is 2-in-1-out so it still contracts supply (§2.4). Monitor the supply curve weekly from launch. |
| Epic/Mystic supply is immortal → top-tier floor price decays | Low (was Medium) | **Further solved by Fusion Repair (§4.5):** every Broken Epic/Mystic now burns a second one on ordinary neglect, not just on a deliberate Genesis/Ascension gamble — a much higher-frequency sink than §2.6/§2.7 alone. Watch the Epic+ floor weekly. |
| Fusion Repair (§4.5) feels punishing rather than fair — a mistake destroys a whole tool | Medium | Standing Orders (§4.3) as a one-toggle prevention; the 30%-durability yield penalty as an early warning; loud low-durability UI alerts before the 0 cliff. Tune the 50%-restore and fee numbers on Phase 0.5 playtester reaction (§15), not in isolation. |
| Repair-failure rage / "RNG is rigged" accusations | Medium | Published daily seeds and verifiable rolls (§4.4); failure is partial, never total; `pSuccess` floored at 50%; show the odds in the UI *before* the player confirms. |
| Reforge cannibalises blind box sales | High | Epic/Mystic excluded as inputs; Rare→Epic gated behind Master Blueprint; forge EV per Epic kept above box EV (§2.4). Re-verify in the Phase 0.5 sim (§15). |
| Commit–reveal seed leak | High | Seed committed pre-sale, HSM/KMS-held, per-series rotation, published post-reveal for verification. |
| SLP price spike makes repairs unaffordable | Medium | Repair rates are timelocked config, not constants. Consider pegging repair cost to a USD-ish band. |
| Genesis NFT treated as a security | **Critical** | No revenue share, no dividends, no treasury claim — ever (§2.6). Utility and scarcity only. Legal sign-off before the Genesis contract ships. |
| Genesis gate is unreachable → the flagship never mints | Medium | Duplicate protection (§2.5), 40% base odds with 3-roll pity, liquid secondary market for every model, live 100-slot counter. If <15 Genesis have minted by month 6, raise base odds — do not shrink the Codex. |
| Race closes early; whales take most slots | Medium | 3-per-wallet cap; the 10-tool burn per roll is the real limiter. Model the race in the Phase 0.5 sim (§15) before setting odds. |
| **Genesis sink closes at slot 100** — top-tier burn stops permanently | Low (was Medium) | **Resolved:** Ascension Seasons (§2.7) reuse the Genesis roll contract, gated inactive until slot 100 mints, then activated at 60% odds/8-week cadence. Ships alongside Genesis in Phase 1, not improvised later. |
| Revenue is all front-loaded box sales; steady state collapses | **Critical** | Consumables must become the revenue backbone by month 6 (§14.1). Track box-share-of-revenue weekly as the primary health metric. |
| "Play-to-earn" framed as an investment offering | Medium | Legal review in Phase 0. Market it as a **game with rewards**, never as yield, APR, or ROI. |
| Backend seed-signer / shift-resolver compromise — attacker mints fraudulent rewards or rigs rolls | **Critical** | HSM/KMS-held keys, separated signer roles, deterministic re-derivable outcomes, anomaly monitoring. Full detail in **Appendix B.2**. |
| Admin multisig compromise or malicious signer collusion | **Critical** | Timelock on every setter, hardware-wallet-only signers, no single-org majority. Full detail in **Appendix B.3**. |
| AMM slippage/sandwich attack when swapping revenue → AXS/RON for the reward pools | Medium | TWAP pricing, slippage caps, size-gated OTC execution for large swaps. Full detail in **Appendix B.4**. |

**Full security threat model, controls, and phase-gated checklist: Appendix B.**

---

## 13. Open questions

1. ~~Is Axie ownership a barrier?~~ **Resolved:** free non-NFT starter crew, withdrawals gated on owning a Tool NFT (§8). It was the biggest funnel leak in the design.
2. Ore: fully off-chain until refined, or ERC-1155 from the start? Off-chain is cheaper and far more flexible for tuning — recommended, at the cost of some "true ownership" narrative.
3. Is Lunacia Land a Phase 5 feature or the *actual* wedge? Land holders are an underserved, wealthy, small audience with an unused asset.
4. Single global economy, or region-partitioned seasons?
5. Do broken/Worn tools stay tradeable? (Recommend yes — with reforging in §2.4, Worn tools have a real floor price as feedstock, and a scrap market emerges for ~zero engineering.)
6. Should reforge outcomes use the same commit–reveal randomness as blind boxes (§7)? Recommend yes — same contract path, same auditability, and it is the same trust problem.

---

# Appendix A — Constraint #3/#0.3: getting cleared to use Axies

*(This is the "Axie NFTs are Sky Mavis IP" constraint. It is a business gate, not an
engineering one, and it has the longest lead time of anything in the plan — start it in
week 1, in parallel with everything else.)*

## A.1 Separate what actually needs permission

People conflate four different gates. They have different owners and different answers:

| What | Permission needed? | Notes |
|---|---|---|
| **Reading Axie ownership + traits from Ronin** | **No.** | It is public chain state. Anyone can index it. |
| **Displaying Axie artwork / naming Axies in your UI** | **Yes — IP licence.** | Sky Mavis owns the art. NFT holder terms grant rights to *holders*, not to a third-party commercial game. |
| **Calling your game "Axie <anything>", using the brand in the name, domain, or store listing** | **Yes — trademark licence.** | The highest-risk one to get wrong, and the easiest to avoid. |
| **Deploying contracts to Ronin mainnet + getting listed in the Ronin ecosystem/app surfaces** | **Usually yes — ecosystem approval.** | Ronin has historically gated mainnet deployment and ecosystem listing. Verify the current policy before assuming permissionless deploy. |

The load-bearing insight: **you can build and test the entire game against real Axie
on-chain data without asking anyone.** What you cannot do unlicensed is *render their art
and use their name*. So the licence blocks your **art and marketing**, not your
**engineering**. Sequence accordingly.

⚠️ Program names, entry points, and terms change. Everything below is the shape of the
process, not a quote of current terms — confirm the live details with Sky Mavis BD via
roninchain.com / the official Ronin developer channels before you commit budget.

## A.2 Lead the pitch with the SLP burn

Sky Mavis' long-running structural problem has been **SLP oversupply** — too many faucets,
too few sinks. Your game is unusual: it is a **net SLP sink that mints nothing**.

Open the conversation with that, not with your game design:

> "We consume SLP for repairs and reforging, burn 25% of it outright, and recycle the rest
> as rewards. We mint zero SLP, zero AXS, zero RON. Our AXS and RON rewards are **bought
> off-market with USDC revenue**. At 10k DAU we project X SLP burned per month and Y USDC
> of AXS/RON buy pressure. We give utility to floor-priced Axies without creating new supply."

Four things that make this an easy yes for them, in priority order:

1. **Net SLP burn.** Quantify it. One number, from your Phase 0.5 sim (§15).
2. **Buy pressure on AXS and RON** funded by outside money (USDC), not by inflation.
3. **Utility for dormant floor Axies** — millions of them, currently doing nothing.
4. **No new NFT supply competing with theirs.** Your tools are a new asset class, not more Axies.

Do not lead with tokenomics theory, a whitepaper, or a roadmap. Lead with the burn number
and a link to a playable testnet build.

## A.3 What to have ready before you contact them

Ecosystem teams evaluate on evidence, not decks. Have all five:

- [ ] **Playable Saigon testnet build** — the Phase 2 vertical slice. Even ugly. This alone puts you ahead of most applicants.
- [ ] **One-page economy model**: sources, sinks, net flow per token, at 1k / 10k / 100k DAU. Output of the Phase 0.5 sim (§15).
- [ ] **Team page** — real names, prior shipped work, jurisdiction of the operating entity.
- [ ] **Contract addresses on testnet** + audit plan (who, when, budget).
- [ ] **Distribution plan** — which guilds/regions, how you reach them. SEA guild relationships are worth more here than the game itself.

Company formation and a real operating entity are a precondition for any licence, so start
that now too if it does not exist.

## A.4 Engineering: never be blocked on someone else's signature

Treat the miner asset as a **pluggable adapter**, chosen by config. This is ~60 lines, and
it is the difference between "the licence is late" and "the project is dead."

**Contracts stay dumb.** Shift resolution is already backend-authoritative with daily Merkle
roots (§10), so the chain never needs to know what an Axie *is*. It stores an opaque id:

```solidity
struct CrewSlot { uint8 adapterId; bytes32 minerId; }   // that's it
```

**The adapter lives in the backend**, where it is cheap to change:

```ts
type Role = 'digger' | 'bracer' | 'prospector' | 'foreman';

interface MinerAdapter {
  readonly id: number;                     // 1=axie, 2=ronin-nft, 3=native
  ownerOf(minerId: string): Promise<Address>;
  traits(minerId: string): Promise<{ role: Role; family: string; tier: number }>;
  eligible(minerId: string): Promise<boolean>;
}
```

Three implementations, gated by an env flag:

| Adapter | Miner asset | Art shown | Ships when |
|---|---|---|---|
| `AxieAdapter` | real Axies, class → role (§3) | Axie art | licence signed |
| `RoninNftAdapter` | any whitelisted Ronin NFT collection; role derived from a deterministic hash of the token id | **your own** miner art, generated per token id | anytime — no licence needed |
| `NativeAdapter` | your own Miner NFT collection | your own art | anytime |

Build and test against `AxieAdapter` on Saigon from day one — the data is public. Just do
not ship Axie *art* or the Axie *name* to production until the paper is signed. If the
licence lands, flip the flag. If it stalls, you launch on `RoninNftAdapter` and add Axies
later as an update, not a rescue.

## A.5 Hard don'ts

- **Do not sell a single blind box while advertising Axie integration you have not signed.** Taking USDC against an unsecured third-party licence is the fastest route to refunds, chargebacks and a regulator's attention. This is the one that ends projects.
- **Do not put "Axie" in the game name, the domain, the token ticker, or the app store listing.** "Built on Ronin. Works with your Axies." is a description of function; "Axie Miner" is trademark use.
- **Do not ship Axie artwork to mainnet before the licence.** Testnet with a closed tester group is a different risk profile than a public production build; treat them differently.
- **Do not take custody of players' Axies.** Signature-based delegation only (§3). Escrowing other people's high-value NFTs makes you a custodian — a security burden and, in several jurisdictions, a regulated activity.
- **Do not design any mechanic that requires burning, breeding, or mutating an Axie.** You will not get permission, and it hard-couples you to the licence.

## A.6 Sequencing

| When | Action |
|---|---|
| Week 1 | Entity formed. Contact Sky Mavis BD / Ronin ecosystem channel. Short intro: what you're building, the burn number, testnet ETA. |
| Weeks 1–6 | Build against `AxieAdapter` on Saigon with placeholder art. Run the Phase 0.5 economy sim (§15) — this produces the number your whole pitch rests on. |
| Weeks 6–10 | Follow up with the playable slice + economy one-pager. Ask specifically for the **IP licence terms**, not a vague "partnership". |
| Weeks 10+ | Licence signed → swap in Axie art and naming. Not signed → ship on `RoninNftAdapter`, keep the conversation open, revisit post-launch with real traction numbers. |

**Launching first and getting the licence later is a legitimate strategy.** A live game with
real users and a real SLP burn is a far stronger pitch than a deck. The abstraction in §A.4
is what makes that strategy available to you — build it early, when it is cheap.


---

# 14. Review: is this actually good, and does it earn?

I was asked not to hand this back unless I believed it. Here is the honest audit, with the
things that survived scrutiny and the three conditions without which it does not work.

## 14.1 The revenue model, examined

**Where money comes from:** blind boxes · consumables (Repair Flux, Prime Cores, Depth
Permits, Standing Order premiums) · 4% marketplace royalty · the 1,000 USDC Genesis ticket.

**Where it goes:** 35% of net revenue is bought as RON/AXS and paid out (§5). SLP costs
nothing — it is a closed loop. So gross margin before opex is **~65%**, and a 35% payout is
far leaner than any gambling comparison while still feeling generous inside the game.

**Break-even, roughly.** A 6-person team runs ~$45k/month fully loaded. At 65% margin that
needs **~$69k/month gross**. At a $30 monthly ARPPU and a 12% payer rate, that is roughly
**20,000 DAU**. Achievable on Ronin for a well-executed title, but it is a real number and
nobody should pretend otherwise — this is a venture-scale bet with a 7–9 month, ~$500–800k
pre-revenue build, not a side project.

**The Genesis race is the strongest revenue mechanic in this document**, and the roll
mechanic (§2.6) makes it roughly twice the engine a first-come queue would have been.

A queue is won once and then everyone else stops playing for it. A **repeatable roll that
stays open until the 100th mint** keeps every serious player buying boxes for the entire
race, and each failed roll destroys 5 Epics and 5 Mystics that have to be rebought.

Rough scale: ~2 rolls per Genesis × 100 Genesis ≈ **920 Epics and 940 Mystics consumed**,
net of the failure returns (§2.6).
Sourced fresh, 5 distinct Mystics is on the order of 70 Deep Vaults (~$5,300); most will
come cheaper via secondary, but every secondary trade still pays your 4% royalty. Call it
**$1M–$2M in box and marketplace volume** across the race, plus $100k in Genesis tickets.
Set-completion is the most reliable monetisation mechanic in the history of gacha; here it
is also the only terminal sink the immortal tiers have.

**Condition 1 — consumables must overtake boxes by month 6.** Box revenue is front-loaded
and follows acquisition. Repair Flux, Prime Cores and Standing Orders follow *retention*,
and retention is the only thing that compounds. Track box-share-of-revenue weekly as the
primary health metric; if it is still above 50% at month 6, the game is an acquisition
treadmill and will die when acquisition slows.

## 14.2 The uncomfortable truth that has to be said out loud

**At a 35% payout ratio, players in aggregate extract 35 cents for every dollar they put
in. The average player loses money. There is no configuration of this game where that is
not true**, because nothing here mints tokens — every reward is bought with player money.

That is completely fine. It is how every game with prizes works. But it means:

**Condition 2 — market this as a game with rewards, never as income.** No APR, no ROI, no
"earn $X/day", no yield calculators, no affiliate pitches to guilds framed as returns.
Publish the 35% ratio openly. The projects that lied about this are all dead, and several
of their founders are in litigation. The ones that were honest — and made the game good
enough that people paid anyway — are the ones still running.

**Condition 2a — the whale-concentration risk needs its own controls, not just honesty.**
Genesis-scale revenue (§14.1) comes from a small number of people spending thousands on
RNG, in a game where players collectively get back 35 cents on the dollar. That is legal
and it is how gacha works — but it is also the most volatile, most regulator-exposed part
of the revenue stack, and the likely audience (SEA players, several markets still bruised
from the 2021–22 P2E collapse) will notice if it feels exploitative. Four concrete,
enforceable rules, not just tone:

1. **Odds shown at the point of purchase, every time** — the box screen and the Genesis
   roll screen render live odds pulled from the same on-chain table a player could audit
   themselves. Not a link to a FAQ.
2. **Direct-purchase price displayed beside every box**, same screen, same font size. The
   "no way to get this except gambling" argument has to be visibly false at the moment of
   spend, not just true in principle.
3. **A visible personal spend tracker** — "You have spent $X on boxes this week/month,"
   opt-in cooldown after a self-set threshold. Costs little, defuses the single argument
   regulators and press reach for first, and it is good practice independent of regulation.
4. **No whale leaderboard, no "biggest spender" cosmetic, no marketing built around a
   single large purchase.** Rank by Codex completion or seasonal ore, never by USDC spent.
   Glorifying spend is the fastest way to turn "gacha game" into "predatory gacha game" in
   press coverage.

None of this caps revenue. It caps the *story* the revenue tells, which is the part that
actually kills projects — Axie itself is the nearest example of a good economy undone by a
trust and perception collapse, not a design flaw.

## 14.3 What genuinely works here

1. **It cannot over-emit.** Pro-rata daily pools (§5) make over-emission arithmetically impossible. This alone puts it ahead of ~90% of P2E designs, which die of exactly this.
2. **It mints nothing.** No new token, no new NFT class competing with Ronin's. Every reward is bought with real revenue. There is no death spiral to enter.
3. **Repair-as-a-roll prices attention** (§4.3). Top up often and safely, or run to empty and gamble — the idle genre's central resource made into an actual decision. I have not seen this done in an idle crypto game and it is the most original thing in the design.
4. **The immortal top tier is a better sink than destruction.** An Epic that must be fed SLP forever generates more lifetime revenue than one that dies and gets replaced, and it feels better to own.
5. **The Codex makes every rarity permanently valuable**, which fixes the standard collapse where low-tier NFTs go to zero and drag box EV down with them.
6. **Every tier has a terminal sink.** Common and Rare die by retirement and reforge; Epic and Mystic die by Genesis ascension (§2.6). Nothing accumulates forever — which is the failure mode that kills NFT game economies.
7. **Nothing requires anyone's permission to ship** (Appendix A), because the miner asset is an adapter.

## 14.4 What worries me

- **The core loop is thin without the Codex.** Assign → wait → collect is not a game. Hence the Phase 4 scheduling call in §11. If the Codex slips, do not launch.
- **You are renting Ronin's audience.** Ronin DAU has been volatile. Your ceiling is their traffic, and you do not control it.
- **Repair failure will produce genuine rage.** A failed 3,000-SLP Mystic repair is the most emotionally expensive event in the game. Verifiable seeds, visible odds before confirming, and a live-tunable `pSuccess` are mandatory, not polish.
- **~~The Genesis sink has an expiry date~~ — resolved.** Ascension Seasons (§2.7) pick up the burn the moment Genesis closes, built from the same contract, so there is no gap for the immortal tiers to sit unsunk.
- **Onboarding was nearly fatal and is now fixed** (§8): free starter crew, 5-minute first shift, no NFT purchase before the first reward. If anyone proposes reinstating "buy 3 Axies to start", refuse.

## 14.5 Verdict

**Yes — I would build this**, on three conditions, all of which are now in the document:

1. **Codex + Genesis ship at launch** (§11), because they are the game, not content.
2. **Consumables become the revenue backbone by month 6** (§14.1), because boxes only track acquisition.
3. **Honest marketing** (§14.2) — a game with rewards, never an income product.

Miss any one and this is another P2E corpse with good documentation. Hit all three and it
is a genuinely differentiated idle game with a sound economy, a structural partnership hook
(the SLP burn), and a monetisation engine — the Genesis race — that I would expect to work.

The riskiest assumption is not the economy. It is 20,000 DAU, whether the numbers hold once
they interact, and whether the moment-to-moment loop is actually fun — none of which a
document can prove. Sections 15–16 below are the concrete answer to that, not more design.

---

# 15. Validation plan — what happens before more design

**Three unvalidated claims, three cheap tests, gating Phase 1 (§11) before it spends audit money.** Total
cost under $15k against a $700k+ build. If any test fails, the fix is to fix *that thing*,
not to add more mechanics — more mechanics is not a lever that moves DAU, fun, or economy
soundness, and it's the trap this plan already fell into twice this conversation.

| # | Unvalidated claim | Test | Cost | Kill signal |
|---|---|---|---|---|
| **1** | The loop is fun | Build the Codex-chase loop as a **free browser prototype — no blockchain, no NFTs, no real tokens.** Fake currency, real durability/repair/roll math, real Codex grid. Put it in front of 30–50 people who are not crypto natives, ideally existing idle-game or gacha players. Watch, don't ask — session length, return-next-day rate, where they get confused or bored. | 1–2 weeks, 1 engineer | Sessions under 3 minutes, no unprompted return visits, or testers can't explain what they're working toward after 10 minutes |
| **2** | 20,000 DAU is reachable | Landing page with the Codex art and a **live counter (§16)** wired to a real number, waitlist, and conversations with 3 SEA guilds — the same guilds you'd need for distribution at scale. Ask what they'd need to bring 500 players each, not whether they "like it." | ~$5k, 2 weeks | Guilds noncommittal or ask for guaranteed-yield terms you can't honestly offer (§14.2) |
| **3** | The numbers hold once they interact | Run the economy sim (agent-based, already planned) at 1k / 10k / 50k simulated DAU, bull and bear token prices, realistic whale/dolphin/minnow spend distribution. Specifically stress-test: does the Genesis race stall or resolve in under a year at 40% base odds; does a median non-paying player see visible progress by day 14; does the 35% payout survive a 60%-in-90-days token price crash. | 1–2 weeks, 1 engineer | Genesis race takes >18 months or resolves in <2 months (both broken); median F2P player has near-zero visible progress at day 14; pool insolvent under a realistic bear case |

Run all three in parallel — they're independent and cheap. **Do not start Phase 1
(contracts, audits) until all three clear** — this is now the explicit gate in §11. A great economy behind a boring loop, or a
fun loop nobody hears about, both fail the same way: quietly, after the money is spent.

# 16. Public transparency dashboard

You asked for statistics on fused tools, Mystic holders, and the Genesis cap — correct
call, and it should be a first-class product surface, not an internal report. A live
public page, updated on every relevant on-chain event, is also the cheapest available
defense against the whale-concentration risk in §14.1: nothing rebuilds trust with a
SEA audience that got burned in 2021–22 like a number they can verify themselves instead
of a promise.

| Stat | Source | Why it has to be public |
|---|---|---|
| **Genesis minted / 100** | `SeasonAuction`/Genesis contract counter | The headline number for the whole endgame; drives the chase (§2.6) |
| **Genesis roll attempts, wins, and running win rate** | roll event log | Proves the published 40% + pity-on-3rd is real, not just claimed |
| **Genesis holders: count, and max held by one wallet** (cap 3, §2.6) | Genesis contract, token-holder query | Directly answers "is this whale-captured" with a number, not a promise |
| **Tools reforged, by input tier → output rarity** (§2.4) | `MiningTool` burn/mint events | Shows whether the forge is actually a salvage floor or is quietly beating the box (§2.4's own kill condition) |
| **Tools Fusion-repaired, by rarity** (§4.5) | fuel-burn events | Tracks the new Epic/Mystic sink and how often players are actually hitting the 0-durability cliff — a rising rate is an early signal to soften the UI warning, not the mechanic |
| **Tools retired / salvaged** (Common, Rare) | burn events | Tracks whether the supply sink is keeping pace with box minting |
| **Epic / Mystic in circulation, net burned via Genesis rolls (§2.6) and Ascension rolls (§2.7)** | mint/burn delta | Confirms the sink stays live across the Genesis→Ascension handoff — this is the number that would have caught the old gap before it became a crisis |
| **Daily reward pool size and payout ratio, SLP / RON / AXS** (§5) | `RewardDistributor` | The number that makes "35% payout, not income" a checkable fact instead of a claim |
| **SLP burned to date** (§4.4) | `RepairVault` burn total | The Sky Mavis pitch number (§A.2), kept honest by being public |
| **90-day reserve floor coverage ratio** (§5) | treasury balance vs. floor | Solvency, in the open, before anyone has to ask |

**Build this before mainnet, not after.** It's a read-only indexer view over events every
contract already emits — cheap relative to everything else in Phase 1 — and every number
in it is also exactly what a regulator, an auditor, or a skeptical guild leader would ask
for first. Publishing it pre-emptively is worth more than the same numbers handed over
defensively six months in.

---

# Appendix B — Security plan

*Companion to Appendix A: that one gets you permission to ship, this one keeps what you
ship from being stolen, rigged, or regulated out of existence. Read alongside §10
(architecture), §5 (treasury/pools), and §7 (commit–reveal) — this appendix is where their
security requirements are made explicit and checkable instead of implied.*

## B.0 What is actually at risk, in priority order

Get this ordering right before writing a line of Solidity — it decides where budget goes.

1. **The reward pools and treasury contracts** (§5) — real USDC-backed value sitting on-chain, the single largest theft target in the system.
2. **Game-state integrity** — durability, repair outcomes, blind box results, Genesis/Ascension rolls (§2.6, §2.7). All backend-computed then chain-published (§9.5). A compromised or dishonest backend can mint value out of thin air without ever touching a contract exploit.
3. **The commit–reveal seed pipeline** (§7) — the single point of failure behind every roll in the game, blind box through Genesis.
4. **Admin key material** — anyone who controls the multisig controls every economic parameter in §4.4's `economy_params`, including the payout ratio itself.
5. **Player custody — deliberately minimal.** The game never holds player Axies or tools (Appendix A.5); the main player-facing exposure is phishing and malicious signature requests, not fund custody.

Notice what is *not* on this list: a hacked player wallet draining the treasury. Because the
game never custodies player assets, the blast radius of a single compromised player account
is that player's own assets — not systemic. Preserve that property; it is the cheapest
security win in the whole design and it is already a design decision, not an afterthought.

## B.1 Smart contract security

| Control | Detail |
|---|---|
| **Two independent audits, minimum** | One general-purpose (reentrancy, access control, arithmetic) and one **economically focused** — the second one is non-standard and non-negotiable here, because §5's pro-rata pools and §2.6/§2.7's burn-and-roll mechanics are novel enough that a generic audit will miss game-theoretic exploits a standard DeFi audit checklist doesn't cover. |
| **Foundry invariant tests as executable spec, not an afterthought** | `faucet ≤ sink` for every token (§0) as a literal fuzzed invariant; `sum(tool.maxDurability) ` bounds; Genesis supply `≤ 100` under all code paths including reentrancy; reforge/roll outcome probabilities match §2.4/§2.6 formulas within tolerance across thousands of fuzzed calls. |
| **No EOA owner, anywhere, ever** | Every admin function behind a **Gnosis Safe multisig + timelock** (§10). A single compromised laptop must never be able to change a single economy parameter. |
| **Timelock delay scaled to blast radius** | 24h minimum on cosmetic/tuning params (box odds, drop rates); **72h+ on anything touching the treasury, payout ratio, or pool-funding formula** — enough time for the community (via the §16 dashboard, which should surface pending timelock actions) to notice and react before a change lands. |
| **Circuit breakers, narrowly scoped** | `RewardDistributor` and `RepairVault` get a pausable emergency stop, multisig-gated, **that halts new claims/repairs without freezing existing balances or enabling fund extraction.** A pause button that can also drain funds is not a safety feature, it's a second attack surface. |
| **Upgradeability: prefer immutable + migrate over proxy-upgradeable** | Proxy patterns (UUPS) add a permanent admin-key attack surface for the life of the contract. Where avoidable, ship immutable contracts and migrate state via a documented, publicly-announced migration path instead. Where a proxy is unavoidable (e.g. `RewardDistributor`, which will need iteration), the upgrade function gets the *longest* timelock in the system. |
| **Solidity ≥0.8.x**, checked arithmetic by default, `ReentrancyGuard` on every function that moves value, CEI (checks-effects-interactions) ordering enforced by lint rule, not just review. | Baseline hygiene — listed because skipping it is the single most common cause of NFT-game exploits, not because it's novel. |
| **Re-audit after Genesis/Ascension ship** | §2.6/§2.7 are new, high-value-per-transaction logic added after the initial audit. They get their own focused review before mainnet activation, not a footnote in the original audit. |

## B.2 Backend / server-authoritative trust security

This is the part most game-security writeups skip, and it is the part that matters most
*here* — because §9.5 makes the backend, not the chain, the source of truth for shift
outcomes, repair rolls, and box/Genesis reveals. **A dishonest or compromised backend is a
bigger threat than a smart contract bug**, because it doesn't need to break any contract
invariant — it just needs to publish a false Merkle root that the contracts will honor.

| Control | Detail |
|---|---|
| **Seed material lives in an HSM or cloud KMS, never in env vars, config files, or CI secrets.** | Already stated in §7 for blind boxes; extend identically to shift-resolution seeds and repair-roll seeds. |
| **Separation of duties across three distinct keys/roles** | (1) seed-commit signer, (2) seed-reveal publisher, (3) treasury multisig signer. No single person or service account holds more than one. A compromised reveal-publishing service should not be able to touch treasury funds, and vice versa. |
| **Resolution logic is deterministic and independently re-derivable** | Every shift, repair roll, and box/Genesis reveal must be reproducible by a third party from `(publishedSeed, blockhash, entityId)` alone. Publish the resolver's core logic (open-source the resolution module even if the wider backend stays closed) — this is what makes "the backend is rigging outcomes" a falsifiable claim instead of a trust exercise, and it's the technical backbone the §16 dashboard depends on. |
| **Daily Merkle root publication is itself rate- and anomaly-monitored** | Alert on: root published outside the expected daily window, claim volume outside historical variance, any single wallet claiming an outsized share of a daily pool. Tie these alerts to the same on-call rotation as production incidents, not a separate "data team" queue that gets checked weekly. |
| **Least-privilege infra** | Resolver workers get write access to nothing but their own job queue and a signing endpoint; database credentials scoped per-service; no service account with both "can compute outcomes" and "can publish to chain" in one blast radius where avoidable. |
| **Claim endpoints are rate-limited and Sybil-checked independently of the economic Sybil resistance in §9** | §9 stops Sybil *farming* (economic); this stops Sybil *DoS* (someone hammering the claim API to degrade service for everyone else). Different threat, needs its own rate limiter. |

## B.3 Treasury & key custody

| Control | Detail |
|---|---|
| **Three segregated multisigs, not one** | (1) Reward pool contracts — funds pledged to players, touched only by automated, audited flows. (2) Operational treasury — the 10% ops split from §4.4, day-to-day spend. (3) Team/founder allocation, if any — fully separate from both. Mixing these means one compromised signer set threatens player-owed funds and payroll simultaneously. |
| **Hardware-wallet signers only, geographically and organizationally distributed** | No two signers sharing a household, an office, or a cloud account. Standard practice, stated explicitly because it's the first thing skipped under launch-week time pressure. |
| **Threshold sized to team size, not a round number** | At a 6-person team, a bare 4-of-7 with only in-house signers means losing two people blocks the treasury. Include at least one independent (advisor/auditor) signer so the multisig survives a team dispute, not just a stolen laptop. |
| **Withdrawal size tiers with escalating delay** | Small operational spend: same-day. Anything above a published threshold (e.g. >$50k): mandatory 48–72h timelock, visible on the §16 dashboard as a pending action, so the community sees large treasury moves coming, not after the fact. |
| **The 90-day reserve floor (§5) is enforced on-chain, not by policy** | A contract-level minimum balance the multisig itself cannot withdraw below, short of the full timelocked governance path. Policy that "we won't drain the reserve" is worth nothing under founder financial distress; a contract that physically can't is worth everything. |

## B.4 Economic & oracle security

| Control | Detail |
|---|---|
| **RON/AXS purchasing (§5) uses TWAP pricing and hard slippage caps**, not spot-price market swaps | The reward pools convert trailing-revenue USDC into RON and AXS on a schedule (§5). Doing that via a naive spot-price DEX swap is a standing invitation for sandwich attacks — an attacker who knows your swap schedule (and a daily/weekly cadence is guessable) can front-run it every cycle. |
| **Size-gated execution** | Below a threshold: on-chain TWAP swap is fine. Above it: route through OTC/treasury-negotiated execution instead of a single on-chain trade, to avoid moving the market against yourself and telegraphing size. |
| **Commit–reveal integrity is the highest-value target in the game and gets isolated review** | Blind boxes (§7), repair rolls (§4.2), reforge (§2.4), and Genesis/Ascension rolls (§2.6/§2.7) all share this mechanism. A flaw here doesn't cost one player, it compromises every roll in the game retroactively-in-doubt. This earns a dedicated audit line item, not shared time with the general contract audit. |
| **Flash-loan / same-block manipulation** | Lower risk here than in DeFi generally, because Axies and Tools are NFTs (not flash-borrowable) and crew assignment already requires signature-based delegation (§3) rather than raw ownership at call-time. Still worth an explicit invariant test: no code path should let a single-block sequence of borrow→assign→claim→return produce a reward. |
| **Duplicate-protection and pity-timer logic (§2.5, §7) must be provably fair, not just probabilistically tuned** | These are player-trust-critical, not just balance-critical — an exploitable bias in "which model do I get" is a subtler and more damaging bug than a probability that's merely miscalibrated, because it's the kind of thing dedicated players will eventually detect and publicize themselves. |

## B.5 Player-facing security

| Control | Detail |
|---|---|
| **Never custody player Axies or tools** | Restated from Appendix A.5 because it's a security control, not just an IP-licensing one: no custody means no honeypot. |
| **Signature-based delegation uses EIP-712 typed data, never blind message signing** | Players must see a human-readable "Assign these 3 Axies to Crew #42 for mining, expires in 8h" in their wallet, not an opaque hex blob — the standard phishing vector in this asset class is tricking someone into blind-signing something that grants far more than they intend. Every delegation is scoped to a specific action and **carries a short expiry**, so a leaked or reused signature has a small window of harm. |
| **Official domain allowlisting, and train the team never to ask for it any other way** | Publish the canonical domain everywhere; the support playbook explicitly never DMs links, never asks for a seed phrase, and says so publicly and often — the standard NFT-game social-engineering vector is a fake support account, not a contract bug. |
| **Waypoint/embedded-wallet security is Sky Mavis's responsibility, but verify it, don't assume it** | Confirm session-key scoping and revocation behavior for the Waypoint SDK (§10) before launch; don't treat "we used their SDK" as itself a security control. |

## B.6 Operational security & incident response

| Control | Detail |
|---|---|
| **Bug bounty live from mainnet day one**, Immunefi or equivalent | Tiered payout, top tier scaled to a meaningful fraction of at-risk treasury/pool value — a bounty that pays less than a plausible exploit nets is an invitation to sell the bug elsewhere instead of reporting it. |
| **A written incident-response runbook, before launch, not authored during an incident** | Who can trigger the pause switches in B.1 and under what evidence threshold; the communication plan (what gets posted, where, how fast); a committed post-mortem policy (public, blameless, with concrete remediation dates). |
| **Key-ceremony documentation** | Every multisig signer onboarding and offboarding event logged: who, when, what hardware, witnessed by whom. This is what makes "was signer #4 compromised or did they leave the company" answerable after the fact. |
| **On-chain anomaly monitoring wired to the same dashboard players see (§16)** | Forta or an equivalent custom watcher on mint/burn/claim volume, feeding the *same* public numbers in §16 — internal monitoring and public transparency should be the same data pipe, not two systems that can silently disagree. |
| **Security review is a gate on the roadmap, not a milestone that can slip** | See B.8. |

## B.7 Compliance-adjacent data security

| Control | Detail |
|---|---|
| **Minimize what you collect** | Waitlist emails (§15 test #2) and any KYC-threshold data are the only PII this design currently needs. Don't collect more "in case it's useful later" — every field collected is a future breach liability and a data-protection compliance surface, in the Philippines (Data Privacy Act) and every other target market. |
| **KYC/AML thresholds** | If direct USDC purchases (§7, Genesis §2.6) exceed typical VASP/exchange thresholds in a given jurisdiction, KYC obligations may attach to *your* flow even if Ronin itself doesn't require it upstream — confirm with counsel per §0's Constraint #4, don't assume payment-rail compliance covers you. |
| **Data storage segregation** | PII in a separate, more restrictively-access-controlled store from gameplay telemetry; gameplay telemetry itself pseudonymized by wallet address where the analysis doesn't need real identity. |

## B.8 Security gates, mapped onto the roadmap

Mirrors the Phase 0.5 validation gate (§15) — security checkpoints that block phase
transitions, not a checklist to "get to eventually."

| Roadmap phase (§11) | Security gate before proceeding |
|---|---|
| **Phase 0.5 → Phase 1** | Key-ceremony plan drafted; multisig signer set identified (B.3); threat model (this appendix) reviewed by whoever will do the Phase 1 audits, so the audit scope is set with security context, not written blind. |
| **Phase 1 (Contracts)** | Two audits complete (general + economic, B.1) *before* any contract touches mainnet or handles real value; Foundry invariants passing in CI, not just passing once locally; HSM/KMS provisioned for all seed material (B.2) before the first commit–reveal box sale, even on testnet with fake value — build the habit before real value is on the line. |
| **Phase 2 (Vertical slice, testnet)** | Anomaly monitoring (B.6) live against testnet data, proven to fire on a deliberately injected fault before it's trusted against real mainnet data. |
| **Phase 3 (Closed beta)** | Incident-response runbook rehearsed at least once (a tabletop exercise, not just written); bug bounty scaffolding in place, even if payouts don't open until mainnet. |
| **Phase 4 (Mainnet launch)** | Bug bounty publicly live; re-audit of Genesis/Ascension logic (B.1) complete; treasury multisigs funded and tested with a real, small, deliberate transaction before the real launch volume arrives. |
| **Phase 5 (The Deep / Ascension Seasons)** | Ascension contract (§2.7) — already deployed alongside Genesis in Phase 1 per the roadmap note, but re-verify its activation path under a live multisig vote before slot 100 actually mints, not after. |

**The organizing principle, stated once:** every security control in this appendix earns
its place by mapping to a specific entry in B.0's threat list. If a proposed control doesn't
trace back to one of those five items, it's scope creep — the same discipline §15 already
applies to game mechanics applies here to security work too.
