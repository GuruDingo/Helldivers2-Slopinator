// Runs every scenario in scenarios.json through the JS engine and prints appearance counts as JSON.
// Usage: node js_samples.js [--legacy]     (--legacy = reproduce the original counter-leak quirk)
const fs = require("fs");
const path = require("path");
require("../../docs/gear-data.js");
const HD2Engine = require("../../docs/engine.js");

const legacy = process.argv.includes("--legacy");
const engine = HD2Engine.create(globalThis.HD2_DATA, { legacyCounterLeak: legacy });
const scenarioFile = process.env.HD2_SCENARIOS || path.join(__dirname, "..", "scenarios.json");
const scenarios = JSON.parse(fs.readFileSync(scenarioFile, "utf8"));

function runScenario(sc) {
  const locks = {};
  for (const [slot, name] of Object.entries(sc.locks || {})) {
    const item = engine.resolve(name);
    if (!item) throw new Error("Unknown lock item: " + name);
    locks[slot] = item;
  }
  const excluded = new Set((sc.exclude || []).map((n) => engine.resolve(n).name));
  const counts = { primary: {}, secondary: {}, throwable: {}, strat: {} };
  const tagStats = { chaff: 0, med: 0, armor: 0, demo: 0, panic: 0, backpack: 0 };
  let overridden = 0;
  let failures = 0;
  let unmetBuilds = 0;
  const bump = (bucket, name) => { bucket[name] = (bucket[name] || 0) + 1; };
  for (let i = 0; i < sc.n; i++) {
    let l;
    try {
      l = engine.generateLoadoutRelaxed({
        faction: sc.faction, ownedWarbonds: sc.warbonds || undefined,
        locks, requirements: sc.require || {}, excluded,
      });
    } catch (e) {
      if (!(e instanceof HD2Engine.GenerationError)) throw e;
      failures++;
      continue;
    }
    bump(counts.primary, l.primary.name);
    bump(counts.secondary, l.secondary.name);
    bump(counts.throwable, l.throwable.name);
    l.strategems.forEach((s) => bump(counts.strat, s.name));
    const all = [l.primary, l.secondary, l.throwable].concat(l.strategems);
    for (const t of Object.keys(tagStats)) tagStats[t] += all.filter((x) => HD2Engine.has(x, t)).length;
    if (l.factionOverridden) overridden++;
    if (l.unmet.length) unmetBuilds++;
  }
  return { name: sc.name, n: sc.n, counts, tagStats, overridden, failures, unmetBuilds };
}

const t0 = Date.now();
const out = scenarios.map(runScenario);
process.stderr.write(`JS: ${scenarios.length} scenarios in ${((Date.now() - t0) / 1000).toFixed(1)}s${legacy ? " (legacyCounterLeak)" : ""}\n`);
process.stdout.write(JSON.stringify(out));
