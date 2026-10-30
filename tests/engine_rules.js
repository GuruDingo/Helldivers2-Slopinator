// engine_rules.js - checks the behaviours that are NEW in the JS engine (the Python original can't be
// compared here because it simply gave up): best-effort builds, flagged unmet rules, lock exemptions.
//
//   node tests/engine_rules.js
const assert = require("assert");
require("../docs/gear-data.js");
const HD2Engine = require("../docs/engine.js");
const engine = HD2Engine.create(globalThis.HD2_DATA);
const pick = (n) => { const i = engine.resolve(n); assert(i, "unknown item " + n); return i; };

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}
const ids = (l) => l.unmet.map((u) => u.id);

test("unlocked builds are always strict (no unmet rules)", () => {
  for (let i = 0; i < 300; i++) assert.deepStrictEqual(engine.generateLoadoutRelaxed({ faction: "bot" }).unmet, []);
});

test("locking all 4 stratagem slots with no backpack builds and does NOT flag the backpack rule", () => {
  const locks = { strat1: pick("Eagle Airstrike"), strat2: pick("Orbital Gas Strike"), strat3: pick("Orbital Smoke Strike"), strat4: pick("Eagle Strafing Run") };
  for (let i = 0; i < 200; i++) {
    const l = engine.generateLoadoutRelaxed({ faction: "squid", locks });
    assert(!ids(l).includes("backpack"), "backpack flagged: " + ids(l));
    assert(!ids(l).includes("support"), "support flagged: " + ids(l));
    assert.strictEqual(l.strategems.length, 4);
  }
});

test("all 7 slots locked with nothing anti-tank: build completes and the armor rule is flagged", () => {
  const first = (list) => list.find((i) => !HD2Engine.has(i, "armor") && i.factions.indexOf("none") === -1);
  const P = engine.pools;
  const locks = { primary: first(P.primaries), secondary: first(P.secondaries), throwable: first(P.throwables) };
  const strats = [];
  P.strategems.forEach((s) => { if (strats.length < 4 && !HD2Engine.has(s, "armor") && s.factions.indexOf("none") === -1) strats.push(s); });
  strats.forEach((s, i) => { locks["strat" + (i + 1)] = s; });
  for (let i = 0; i < 20; i++) {
    const l = engine.generateLoadoutRelaxed({ faction: "any", locks });
    assert(ids(l).includes("armor"), "armor rule should be flagged, got " + JSON.stringify(ids(l)));
    assert.strictEqual(l.strategems.length, 4);
  }
});

test("free slots are used to satisfy rules the locks don't break (search still finds strict builds)", () => {
  const locks = { primary: pick("AR-23 Liberator"), strat1: pick("Eagle Strafing Run"), strat2: pick("Orbital Gas Strike") };
  for (let i = 0; i < 100; i++) assert.deepStrictEqual(engine.generateLoadoutRelaxed({ faction: "any", locks }).unmet, []);
});

// handheld:3 can never be met without locks: only one backpack-slot item is allowed and only backpacks carry "handheld".
test("unmeetable requirement: completes the build, flags only that requirement (almost always)", () => {
  let onlyRequire = 0;
  for (let i = 0; i < 60; i++) {
    const l = engine.generateLoadoutRelaxed({ faction: "any", requirements: { handheld: 3 } });
    const u = l.unmet.find((x) => x.id === "require");
    assert(u, "requirement should be flagged");
    assert(u.tag === "handheld" && u.min === 3 && u.actual < 3);
    if (ids(l).every((x) => x === "require")) onlyRequire++;
  }
  assert(onlyRequire >= 54, "other rules should still be met; only " + onlyRequire + "/60 were");
});

test("best-effort build gets as close to a hard requirement as it can (demo:7)", () => {
  const actuals = [];
  for (let i = 0; i < 40; i++) {
    const l = engine.generateLoadoutRelaxed({ faction: "any", requirements: { demo: 7 } });
    const u = l.unmet.find((x) => x.id === "require");
    actuals.push(u ? u.actual : 7);
  }
  const avg = actuals.reduce((a, b) => a + b, 0) / actuals.length;
  assert(avg >= 4, "average demo count " + avg.toFixed(1) + " is lower than expected");
});

test("faction relax still preferred over flagging rules (bug + no premium warbonds is strict, off-faction flagged)", () => {
  const l = engine.generateLoadoutRelaxed({ faction: "bug", ownedWarbonds: ["base","req_p","req_o","req_h","req_b","req_e","req_r","fomo"] });
  assert.deepStrictEqual(l.unmet, []);
  assert.strictEqual(l.factionOverridden, true);
});

test("a build with no eligible items at all throws a GenerationError", () => {
  assert.throws(() => engine.generateLoadoutRelaxed({ faction: "any", ownedWarbonds: [] }), HD2Engine.GenerationError);
});

test("strict generateLoadout() still refuses to return a build that breaks a rule", () => {
  assert.throws(() => engine.generateLoadout({ faction: "any", requirements: { handheld: 3 } }), HD2Engine.GenerationError);
});

test("locked backpack-type stratagems still waive the one-backpack rule without a flag", () => {
  const locks = { strat1: pick("B-1 Supply Pack"), strat2: pick("AC-8 Autocannon") };
  for (let i = 0; i < 100; i++) assert(!ids(engine.generateLoadoutRelaxed({ faction: "any", locks })).includes("backpack"));
});


// Tiny hand-made gear set. The only legal 4-stratagem builds are {Pack, Plain support, Filler 1, Filler 2}.
// "Heavy support" needs the backpack slot, so it is never legal here. Whether the Plain support survives
// depends on whether a REJECTED Heavy support blocks it - the counter-leak quirk of the original tool.
function leakFixture() {
  const mk = (cat, name, tags) => ({ id: name, cat, name, nicknames: [], tags, factions: ["any"], warbond: "base", imgUrl: "" });
  return {
    warbonds: [{ key: "base", name: "Base" }],
    items: [
      mk("primary", "P", ["chaff", "med", "armor", "demo", "panic"]), mk("secondary", "S", []), mk("throwable", "T", []),
      mk("backpack", "Pack", ["backpack"]), mk("support", "Heavy support", ["backpack"]), mk("support", "Plain support", []),
      mk("orbital", "Filler 1", []), mk("orbital", "Filler 2", []),
    ],
  };
}
function successRate(opts) {
  const e = HD2Engine.create(leakFixture(), opts);
  const owned = new Set(["base"]);
  let ok = 0; const N = 20000;
  for (let i = 0; i < N; i++) { const c = e.tryBuild("any", owned, {}, {}, new Set()); if (c && !c.unmet.length) ok++; }
  return ok / N;
}
test("counter-leak fix is the DEFAULT: a rejected backpack-slot support no longer blocks a legal support", () => {
  const fixed = successRate({}), legacy = successRate({ legacyCounterLeak: true });
  assert(fixed - legacy > 0.08, "fixed " + fixed.toFixed(3) + " vs legacy " + legacy.toFixed(3));
});

// ---- rule priority tiers (Boss's order, 2026-10-29) ----
test("tier table: require > backpack/shield/supply > armor/chaff/demo > support/med/panic > demoEscalation/balance", () => {
  const T = HD2Engine.RULE_TIER;
  assert.strictEqual(T.require, 0);
  ["backpack", "shield", "supply"].forEach((r) => assert.strictEqual(T[r], 1, r));
  ["armor", "chaff", "demo"].forEach((r) => assert.strictEqual(T[r], 2, r));
  ["support", "med", "panic"].forEach((r) => assert.strictEqual(T[r], 3, r));
  ["demoEscalation", "balance"].forEach((r) => assert.strictEqual(T[r], 4, r));
});
test("scoring: one higher-tier miss is worse than any number of lower-tier misses", () => {
  const u = (...ids) => ids.map((id) => ({ id }));
  const S = HD2Engine.scoreUnmet;
  assert(S(u("require"), 0) > S(u("backpack", "shield", "supply", "armor", "chaff", "demo", "support", "med", "panic", "demoEscalation", "balance"), 0));
  assert(S(u("backpack"), 0) > S(u("armor", "chaff", "demo", "support", "med", "panic", "demoEscalation", "balance"), 0));
  assert(S(u("armor"), 0) > S(u("support", "med", "panic", "demoEscalation", "balance"), 0));
  assert(S(u("support"), 0) > S(u("demoEscalation", "balance"), 0));
  assert(S(u("support", "med"), 0) > S(u("support"), 0), "same tier: fewer misses wins");
  assert(S(u("require"), 3) > S(u("require"), 1), "shortfall breaks ties");
  assert.strictEqual(S([], 0), 0);
});
test("best-effort build gives up the LOW-priority rule when it has to choose (backpack kept, support dropped)", () => {
  const mk = (cat, name, tags) => ({ id: name, cat, name, nicknames: [], tags, factions: ["any"], warbond: "base", imgUrl: "" });
  const e = HD2Engine.create({
    warbonds: [{ key: "base", name: "Base" }],
    items: [
      mk("primary", "P", ["chaff", "med", "armor", "demo", "panic"]), mk("secondary", "S", []), mk("throwable", "T", []),
      mk("orbital", "O1", []), mk("orbital", "O2", []), mk("orbital", "O3", []),
      mk("backpack", "Pack", ["backpack"]), mk("support", "Plain support", []),
    ],
  });
  const locks = { strat1: e.resolve("O1"), strat2: e.resolve("O2"), strat3: e.resolve("O3") };
  for (let i = 0; i < 100; i++) {
    const l = e.generateLoadoutRelaxed({ faction: "any", locks });
    assert.deepStrictEqual(l.strategems.map((s) => s.name).sort(), ["O1", "O2", "O3", "Pack"], "picked " + l.strategems.map((s) => s.name));
    assert.deepStrictEqual(ids(l), ["support"]);
    assert.strictEqual(l.unmet[0].tier, 3);
  }
});

// ---- requirements override item caps; in-game limits don't budge (Boss, 2026-10-29) ----
function countTag(l, tag) { return [l.primary, l.secondary, l.throwable].concat(l.strategems).filter((x) => HD2Engine.has(x, tag)).length; }
function builds(n, opts) { const out = []; for (let i = 0; i < n; i++) out.push(engine.generateLoadoutRelaxed(Object.assign({ faction: "any" }, opts))); return out; }

test("without a requirement the caps still hold (max 2 Eagles, 1 mine, 1 vehicle)", () => {
  builds(400, {}).forEach((l) => {
    assert(countTag(l, "eagle") <= 2, "eagles " + countTag(l, "eagle"));
    assert(countTag(l, "mines") <= 1, "mines " + countTag(l, "mines"));
    assert(l.strategems.filter((s) => s.cat === "vehicle").length <= 1);
  });
});
test("Require Eagle >= 3 overrides the 2-Eagle cap and is met", () => {
  builds(100, { requirements: { eagle: 3 } }).forEach((l) => {
    assert(countTag(l, "eagle") >= 3, "eagles " + countTag(l, "eagle"));
    assert(!ids(l).includes("require"), "requirement flagged: " + JSON.stringify(l.unmet));
  });
});
test("Require mines >= 2 overrides the 1-mine cap and is met", () => {
  builds(100, { requirements: { mines: 2 } }).forEach((l) => {
    assert(countTag(l, "mines") >= 2, "mines " + countTag(l, "mines"));
    assert(!ids(l).includes("require"));
  });
});
test("a requirement only overrides ITS OWN cap (Eagle >= 3 does not allow 2 mines or 2 vehicles)", () => {
  builds(200, { requirements: { eagle: 3 } }).forEach((l) => {
    assert(countTag(l, "mines") <= 1);
    assert(l.strategems.filter((s) => s.cat === "vehicle").length <= 1);
  });
  // chaff/demo requirements are not cap tags, so they never allow a 3rd Eagle
  builds(300, { requirements: { chaff: 3, demo: 2 } }).forEach((l) => assert(countTag(l, "eagle") <= 2, "eagles " + countTag(l, "eagle")));
});
test("Require vehicle >= 2 allows two vehicles - but never two of the same kind (FRV / tank / exosuit)", () => {
  let two = 0;
  builds(150, { requirements: { vehicle: 2 } }).forEach((l) => {
    const v = l.strategems.filter((s) => s.cat === "vehicle");
    if (v.length >= 2) two++;
    ["frv", "tank", "mech"].forEach((t) => assert(countTag(l, t) <= 1, "two of " + t));
  });
  assert(two >= 140, "only " + two + " of 150 had two vehicles");
});
test("IN-GAME limits beat requirements: Require frv/tank/mech >= 2 can't be met, and you never get two", () => {
  ["frv", "tank", "mech"].forEach((t) => {
    builds(60, { requirements: { [t]: 2 } }).forEach((l) => {
      assert(countTag(l, t) <= 1, "two of " + t);
      assert(l.unmet.some((u) => u.id === "require" && u.tag === t), t + " requirement should be flagged unmet");
    });
  });
});
test("Require vehicle >= 3 reaches one FRV + one tank + one exosuit and nothing more", () => {
  builds(100, { requirements: { vehicle: 3 } }).forEach((l) => {
    const v = l.strategems.filter((s) => s.cat === "vehicle");
    assert(v.length <= 3);
    ["frv", "tank", "mech"].forEach((t) => assert(countTag(l, t) <= 1));
  });
});
test("Require expendable >= 3 overrides the 2-expendable support cap", () => {
  const l = builds(200, { requirements: { expendable: 3 } }).find((x) => countTag(x, "expendable") >= 3);
  assert(l, "never got 3 expendable supports");
});

// ---- additional rules: at least / at most / exactly, and switchable default rules (Boss, 2026-10-29) ----
const reqFlag = (l) => l.unmet.filter((u) => u.id === "require");
const flaggedFor = (l, tag) => reqFlag(l).some((u) => u.tag === tag);

test("a bare number still means 'at least' (old form), and { min } is the same thing", () => {
  assert.deepStrictEqual(HD2Engine.normalizeRequirements({ eagle: 3, mines: { min: 2 } }), { eagle: { min: 3 }, mines: { min: 2 } });
  builds(60, { requirements: { eagle: { min: 3 } } }).forEach((l) => assert(countTag(l, "eagle") >= 3 && !flaggedFor(l, "eagle")));
});
test("At most 0 Eagles: never an Eagle", () => {
  builds(300, { requirements: { eagle: { max: 0 } } }).forEach((l) => {
    assert.strictEqual(countTag(l, "eagle"), 0);
    assert(!flaggedFor(l, "eagle"), JSON.stringify(l.unmet));
  });
});
test("At most 1 Eagle / at most 0 mines hold across many builds", () => {
  builds(300, { requirements: { eagle: { max: 1 }, mines: { max: 0 } } }).forEach((l) => {
    assert(countTag(l, "eagle") <= 1 && countTag(l, "mines") === 0, "eagles " + countTag(l, "eagle") + " mines " + countTag(l, "mines"));
  });
});
test("Exactly 3 Eagles: every build has exactly three (overrides the 2-Eagle cap)", () => {
  builds(150, { requirements: { eagle: { min: 3, max: 3 } } }).forEach((l) => {
    assert.strictEqual(countTag(l, "eagle"), 3, "eagles " + countTag(l, "eagle"));
    assert(!flaggedFor(l, "eagle"));
  });
});
test("Exactly 0 backpacks replaces the 'exactly one backpack' rule instead of fighting it", () => {
  builds(200, { requirements: { backpack: { min: 0, max: 0 } } }).forEach((l) => {
    assert.strictEqual(countTag(l, "backpack"), 0);
    assert.deepStrictEqual(ids(l), [], "unexpected flags " + JSON.stringify(l.unmet));
  });
});
test("At most N never loosens the default 'at least one' check for that tag (at most 2 anti-tank still has >= 1)", () => {
  let ok = 0;
  builds(300, { requirements: { armor: { max: 2 } } }).forEach((l) => {
    const n = countTag(l, "armor");
    if (n >= 1 && n <= 2) ok++; else assert(flaggedFor(l, "armor") || ids(l).includes("armor"), "armor " + n + " not flagged");
  });
  assert(ok >= 285, "only " + ok + "/300 met it");
});
test("A range: chaff between 2 and 3", () => {
  let ok = 0;
  builds(300, { requirements: { chaff: { min: 2, max: 3 } } }).forEach((l) => {
    const n = countTag(l, "chaff");
    if (n >= 2 && n <= 3) ok++; else assert(flaggedFor(l, "chaff"), "chaff " + n + " not flagged");
  });
  assert(ok >= 270, "only " + ok + "/300 met it");
});
test("Contradictory rules (at least 3 but at most 1 Eagle) still build, and are flagged", () => {
  builds(40, { requirements: { eagle: { min: 3, max: 1 } } }).forEach((l) => {
    assert.strictEqual(l.strategems.length, 4);
    assert(flaggedFor(l, "eagle"));
  });
});
test("An unmet 'at most' / 'exactly' rule is reported with how it was phrased", () => {
  const l = engine.generateLoadoutRelaxed({ faction: "any", locks: { strat1: pick("Eagle Airstrike"), strat2: pick("Eagle Strafing Run") }, requirements: { eagle: { max: 1 } } });
  const u = l.unmet.find((x) => x.id === "require");
  assert(u && u.tag === "eagle" && u.max === 1 && u.actual >= 2 && /at most 1/.test(u.how), JSON.stringify(u));
});
test("In-game limits still win over 'at least': a tank request never gives two tanks", () => {
  builds(80, { requirements: { tank: { min: 2 } } }).forEach((l) => { assert(countTag(l, "tank") <= 1); assert(flaggedFor(l, "tank")); });
});

test("Rules list: every default rule has an id, a label and a kind", () => {
  assert(HD2Engine.RULES.length === 15 && HD2Engine.RULES.every((r) => r.id && r.label && /^(guarantee|limit)$/.test(r.kind)));
  assert.deepStrictEqual(HD2Engine.RULES.filter((r) => r.kind === "guarantee").map((r) => r.id).sort(), ["armor", "backpack", "balance", "chaff", "demo", "demoEscalation", "med", "panic", "shield", "supply", "support"]);
});
test("A rule switched off is never flagged (locks that miss anti-tank, with the armor rule off)", () => {
  const first = (list) => list.find((i) => !HD2Engine.has(i, "armor") && i.factions.indexOf("none") === -1);
  const P = engine.pools;
  const locks = { primary: first(P.primaries), secondary: first(P.secondaries), throwable: first(P.throwables) };
  const strats = [];
  P.strategems.forEach((x) => { if (strats.length < 4 && !HD2Engine.has(x, "armor") && x.factions.indexOf("none") === -1) strats.push(x); });
  strats.forEach((x, i) => { locks["strat" + (i + 1)] = x; });
  for (let i = 0; i < 10; i++) {
    assert(ids(engine.generateLoadoutRelaxed({ faction: "any", locks })).includes("armor"));
    assert(!ids(engine.generateLoadoutRelaxed({ faction: "any", locks, disabledRules: ["armor"] })).includes("armor"));
  }
});
test("Turning a guarantee off lets builds drop it (no panic weapon rule -> builds without one appear)", () => {
  assert(builds(400, { disabledRules: ["panic"] }).some((l) => !l.coversPanic), "never saw a build without a panic weapon");
  builds(200, {}).forEach((l) => assert(l.coversPanic));
});
test("Caps switched off: 3+ Eagles, 2+ mines, 2+ vehicles and 2+ regular supports can appear", () => {
  const off = (rule, test) => assert(builds(3000, { disabledRules: [rule] }).some(test), "never saw it with " + rule + " off");
  // A 3rd Eagle is very rare at random (~1 in 1500), so test it with two Eagles locked in: cap on -> never a 3rd.
  const twoEagles = { strat1: pick("Eagle Airstrike"), strat2: pick("Eagle Strafing Run") };
  const withLocks = (disabledRules) => Array.from({ length: 400 }, () => engine.generateLoadoutRelaxed({ faction: "any", locks: twoEagles, disabledRules }));
  withLocks([]).forEach((l) => assert.strictEqual(countTag(l, "eagle"), 2));
  assert(withLocks(["capEagle"]).some((l) => countTag(l, "eagle") >= 3), "never saw a 3rd Eagle with capEagle off");
  off("capMine", (l) => countTag(l, "mines") >= 2);
  off("capVehicle", (l) => l.strategems.filter((x) => x.cat === "vehicle").length >= 2);
  off("capSupport", (l) => l.strategems.filter((x) => x.cat === "support" && !HD2Engine.has(x, "expendable")).length >= 2);
});
test("...and the in-game limits (one FRV / tank / exosuit) hold even with every cap off", () => {
  const all = HD2Engine.RULES.map((r) => r.id);
  builds(500, { disabledRules: all }).forEach((l) => ["frv", "tank", "mech"].forEach((t) => assert(countTag(l, t) <= 1, t + " " + countTag(l, t))));
});
test("Backpack rule off: a second backpack-slot item can be picked", () => {
  assert(builds(600, { disabledRules: ["backpack"] }).some((l) => countTag(l, "backpack") >= 2), "never saw two backpacks");
});
test("Switching nothing off changes nothing (default behaviour is unchanged)", () => {
  builds(200, { disabledRules: [] }).forEach((l) => assert.deepStrictEqual(l.unmet, []));
});

test("armor_pen: every weapon has valid armor-penetration data, and so does every stratagem that attacks", () => {
  // stratagems that do no damage (smoke, shields, supply, mobility) have no value
  const noAttack = new Set(["Eagle Smoke Strike", "Orbital Smoke Strike", "B-1 Supply Pack", "LIFT-850 Jump Pack", "SH-20 Ballistic Shield Backpack", "SH-32 Shield Generator Pack", "SH-51 Directional Shield", "LIFT-860 Hover Pack", "LIFT-182 Warp Pack", "FX-12 Shield Generator Relay"]);
  const weapon = new Set(["primary", "secondary", "throwable", "support"]);
  globalThis.HD2_DATA.items.forEach((i) => {
    if (weapon.has(i.cat)) {
      assert(Array.isArray(i.armorPen) && i.armorPen.length >= 1 && i.armorPen.length <= 2, i.name + " " + JSON.stringify(i.armorPen));
      i.armorPen.forEach((n) => assert(Number.isInteger(n) && n >= -1 && n <= 11, i.name + " " + n));
    } else if (noAttack.has(i.name)) assert.deepStrictEqual(i.armorPen, [], i.name);
    else {
      assert(i.armorPen.length >= 1 && i.armorPen.length <= 2, i.name + " " + JSON.stringify(i.armorPen));
      i.armorPen.forEach((n) => assert(Number.isInteger(n) && n >= 0 && n <= 11, i.name + " " + n));
    }
  });
  const by = (n) => globalThis.HD2_DATA.items.find((i) => i.name === n).armorPen;
  assert.deepStrictEqual([by("AR-23 Liberator"), by("AR-23P Liberator Penetrator"), by("RS-422 Railgun"), by("G-3 Smoke"), by("LAS-17 Double-Edge Sickle"), by("GR-8 Recoilless Rifle"), by("PLAS-45 Epoch"), by("CQC-9 Defoliation Tool")], [[2], [3], [5], [-1], [2, 4], [5, 6], [4, 5], [3, 5]]);
  assert.deepStrictEqual([by("Eagle Airstrike"), by("Eagle Strafing Run"), by("Orbital Railcannon Strike"), by("A/MG-43 Machine Gun Sentry"), by("EXO-45 Patriot Exosuit"), by("B-100 Portable Hellbomb")], [[5], [5], [7], [3], [3, 6], [10]]);
});

test("hand-held shields need a one-handed weapon, bubble shields do not", () => {
  const noOneHand = (l) => !HD2Engine.has(l.primary, "onehand") && !HD2Engine.has(l.secondary, "onehand");
  // lock a two-handed primary and secondary so the shield rule is what is being tested (unlocked, the generator picks a one-hander)
  const run = (name, n) => Array.from({ length: n }, () => engine.generateLoadoutRelaxed({ faction: "any", locks: { primary: pick("AR-23 Liberator"), secondary: pick("P-19 Redeemer"), strat1: pick(name) } }));
  const hand = run("SH-20 Ballistic Shield Backpack", 50);
  assert(hand.every(noOneHand), "the locked weapons should not be one-handed (pick other weapons for this test)");
  hand.forEach((l) => assert(l.unmet.some((u) => u.id === "shield"), "handheld shield without one-hander should be flagged"));
  // the bubble generator pack and the shield relay never trigger it
  ["SH-32 Shield Generator Pack", "FX-12 Shield Generator Relay"].forEach((n) => run(n, 50).forEach((l) => assert(!l.unmet.some((u) => u.id === "shield"), n + " should not need a one-hander")));
});

console.log("\n" + passed + " engine rule tests passed" + (process.exitCode ? " (with failures)" : ""));
