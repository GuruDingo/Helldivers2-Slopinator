// leak_impact.js - how much does the "counter leak" quirk of the original fill loop change the odds?
//
// The original updates its running counters (has_support_regular, has_backpack...) BEFORE the later
// checks that can still reject a stratagem, so a rejected pick can still block later picks.
// engine.js now fixes that by default; create(data, {legacyCounterLeak: true}) brings it back.
// This script rolls many loadouts both ways and shows which items change appearance rate.
//
//   node tests/leak_impact.js [loadouts-per-engine, default 150000]
require("../../docs/gear-data.js");
const HD2Engine = require("../../docs/engine.js");
const N = parseInt(process.argv[2] || "150000", 10);

function sample(legacy) {
  const engine = HD2Engine.create(globalThis.HD2_DATA, { legacyCounterLeak: legacy });
  const counts = {}, cats = {};
  let attempts = 0;
  const origRandom = Math.random;
  for (let i = 0; i < N; i++) {
    const l = engine.generateLoadout({ faction: "any" });
    l.strategems.forEach((s) => { counts[s.name] = (counts[s.name] || 0) + 1; });
    const kinds = new Set(l.strategems.map((s) => (s.cat === "support" ? (HD2Engine.has(s, "backpack") ? "support (uses backpack slot)" : "support (no backpack)") : s.cat)));
    kinds.forEach((k) => { cats[k] = (cats[k] || 0) + 1; });
  }
  return { counts, cats };
}
const a = sample(true), b = sample(false); // a = legacy (original), b = fixed (current default)
function z(c1, c2) { const p = (c1 + c2) / (2 * N), se = Math.sqrt(p * (1 - p) * 2 / N); return se ? (c1 - c2) / N / se : 0; }

console.log(`Share of loadouts containing each stratagem TYPE (original vs fixed), ${N} loadouts each:`);
Object.keys(Object.assign({}, a.cats, b.cats)).sort().forEach((k) => {
  const pa = (a.cats[k] || 0) / N, pb = (b.cats[k] || 0) / N;
  console.log("  " + k.padEnd(32) + (pa * 100).toFixed(1).padStart(6) + "%  ->" + (pb * 100).toFixed(1).padStart(6) + "%   z=" + z(a.cats[k] || 0, b.cats[k] || 0).toFixed(1));
});
const rows = Object.keys(a.counts).map((n) => ({ n, pa: a.counts[n] / N, pb: (b.counts[n] || 0) / N, z: z(a.counts[n], b.counts[n] || 0) }));
rows.sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
console.log("\nBiggest individual stratagem shifts (appearance rate per loadout):");
rows.slice(0, 10).forEach((r) => console.log("  " + r.n.padEnd(36) + (r.pa * 100).toFixed(2).padStart(6) + "% ->" + (r.pb * 100).toFixed(2).padStart(6) + "%  z=" + r.z.toFixed(1)));
console.log("\nItems with |z|>4: " + rows.filter((r) => Math.abs(r.z) > 4).length + " of " + rows.length);
