// Local demo of the commit-reveal pattern from docs/DESIGN.md §7.
// Production: server commits keccak(serverSeed) on-chain before sale opens, reveals after
// N blocks, combines with blockhash + tokenId. There is no server here — this module
// shows the same *shape* (seed committed before the roll, hash independently checkable)
// using Web Crypto instead of a chain. Swap for the real on-chain flow before mainnet.

const encoder = new TextEncoder();

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSeed() {
  return crypto.randomUUID();
}

// Deterministic PRNG seeded from a hex digest (mulberry32 — stdlib-simple, good enough
// for a demo; not cryptographically secure, which is fine, since only the *commitment*
// needs to be, and here that job is done by sha256Hex above).
function mulberry32(seedInt) {
  let a = seedInt >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function makeRoller(seed, nonce) {
  const digest = await sha256Hex(`${seed}:${nonce}`);
  const seedInt = parseInt(digest.slice(0, 8), 16);
  return mulberry32(seedInt);
}

// Picks a key from a { key: probability } map using a [0,1) roll. Probabilities need not
// sum to exactly 1 (floating point) — the last key absorbs any remainder.
export function weightedPick(oddsMap, roll) {
  const entries = Object.entries(oddsMap).filter(([, p]) => p > 0);
  let acc = 0;
  for (const [key, p] of entries) {
    acc += p;
    if (roll < acc) return key;
  }
  return entries[entries.length - 1][0];
}
