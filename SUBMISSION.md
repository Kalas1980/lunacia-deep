# Axie Vibeathon — Round 1 submission draft

Status: **going for it.** Register at vibeathon.axieinfinity.ai by **September 7, 2026,
13:00 UTC** — that's just the registration deadline, not the submission one. The actual
submission window is **September 8–21, 13:00 UTC**, so there's real runway after
registering to finish anything still open below.

---

### Project title
Lunacia Deep

### One-sentence pitch
An idle mining game where Axies wear out real digging tools, and letting one hit zero
durability costs you a second tool, not just SLP.

### Short description (≤ ~40 words, for listing cards)
Assign Axies to NFT tools, send them on mining shifts, and keep an eye on durability — SLP
repairs work until a tool hits zero, then it's Broken and only Fusion (burning a second
same-rarity tool) brings it back. Collect the full 30-tool Codex to unlock the endgame.

### Full description
Lunacia Deep is an asynchronous idle mining game built for Ronin. Axies are assigned to
NFT digging tools — 30 collectible models across four rarities — and sent on mining shifts
to earn AXS, RON, and SLP. Every tool has durability that drains while it works.

The core tension: **SLP repair only works between 1 and 100 durability.** Let a tool run
all the way to zero and it goes Broken — SLP can't save it at any price. The only way back
is Fusion Repair: burn a second tool of the same rarity as fuel for a partial, deterministic
restore. That turns "keep an eye on durability" from a mild suggestion into something every
player actually has to act on, which is the whole point in a genre built around being
checked as little as possible.

Collecting all 30 tools in the Codex is the long-term chase — and in the full design, a
completed Codex earns a shot at Genesis, a 100-ever flagship tool minted through a
repeatable, provably-fair roll. This prototype implements the moment-to-moment loop that
chase is built on: shifts, blind boxes with a working commit-reveal verification demo,
repair, and Fusion Repair, end to end.

### Controls & first-play instructions
1. Open the page. You start with 2 Common tools, 300 ore, 500 SLP.
2. Click **"Send: Surface Quarry"** on a tool card to start a shift.
3. Wait for the countdown (compressed to seconds for this demo — the real design runs 8h
   shifts, see `docs/DESIGN.md` §1), then click **Collect**.
4. Watch the durability bar drop. Click **Repair** any time before it hits zero — the
   button shows the exact SLP cost and success chance before you commit.
5. If a tool ever does hit 0/100, it turns **Broken** (red tag). SLP repair disappears from
   its card; instead click **"Fuse to Repair"** and pick another same-rarity tool as fuel.
6. Open a **Blind Box** (bottom right) to get more tools — watch the commit hash appear
   before you click Open, then the reveal after. You can re-hash the revealed seed yourself
   to confirm it matches the commit shown earlier.
7. Once you own two of the same rarity, each tool card offers **Reforge** — burn both for a
   chance at a new one, including a real tier-up from Common to Rare.

No wallet, no blockchain, no login. Everything resets with the **Reset** button top-right.

### Playable game link
https://kalas1980.github.io/lunacia-deep/ — GitHub Pages, deployed via Actions on every
push to `main` (`.github/workflows/deploy-pages.yml`). Publishes only `web/`.

### Thumbnail image
`[ ]` — not yet created. Candidate: a durability bar mid-drain next to the "Broken" tag,
since that's the mechanic this submission is actually about.

### Repository link
https://github.com/Kalas1980/lunacia-deep — public. `docs/DESIGN.md` (the full tokenomics
business plan) is visible in the repo; only `web/` is what's actually deployed and playable.

### Fallback demo video
`[ ]` — record a ~90s screen capture of the first-play flow above once hosted, in case the
live link has issues during judging.

### AI tools disclosure
Built with Claude (Anthropic) — design document, game economy formulas, prototype code
(vanilla JS, no framework), and this submission draft were all produced in an AI-assisted
session. Formulas were unit-tested (`test/economy.test.js`) and manually verified in-browser
rather than taken on faith.

### Axie Core integration
This prototype currently uses **original, non-Axie placeholder assets** — no Sky Mavis IP
is shipped. That's deliberate: the Builder Resource Kit (Axie art, Origins Battle Kit, the
Axie Generator Tool Kit) is Sky Mavis IP provided to registered builders under Vibeathon
terms, not a public open-source asset pack, so we're not pulling it in before actually
registering. Once registered, swapping in real Axie assets and wiring up the Sky Mavis API
is a presentation-layer change — see `web/src/data.js` for where model data lives — not a
rearchitecture. The gameplay hook (Axies as labor, assigned to tools as capital, per
`docs/DESIGN.md` §3) is designed around Axie's class system from day one; only the art is
currently a placeholder.
