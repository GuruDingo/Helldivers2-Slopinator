// ui_smoke.js - loads the bundled page (dist/hd2-randomizer.html) in a fake browser (jsdom) and clicks through the main features.
//
//   npm install jsdom          (once, from the repo root; not needed to run the site itself)
//   python tools/build_gear.py --bundle && node tests/ui_smoke.js
//
// Not a visual test: it checks that the page builds, buttons do what they should, errors show up
// for bad input, and My Gear saves its state.
const FREE_SOURCES = ["base","req_p","req_o","req_h","req_b","req_e","req_r","fomo"];
const path = require("path");
const fs = require("fs");
const { JSDOM } = require("jsdom");

// The single-file bundle has every script inlined, so jsdom needs no file loading. Build it first:
//   python tools/build_gear.py --bundle
const indexFile = path.resolve(__dirname, "..", "dist", "hd2-randomizer.html");
// Once images are saved (docs/img), the bundle embeds them and every src would be a data: address. Most checks are about
// which picture goes where, so they run on the bundle with that list emptied (every src is then the wiki address);
// the "Saved images" section below covers the saved-copy behaviour, and the real bundle is checked at the end of it.
const rawBundle = fs.readFileSync(indexFile, "utf8");
const bundleHtml = rawBundle.replace(/"images": \{[\s\S]*?\n \}\n\};/, '"images": {}\n};');
let failed = 0;
function check(label, cond, extra) {
  console.log((cond ? "  ok   " : "  FAIL ") + label + (cond || !extra ? "" : "  -> " + extra));
  if (!cond) failed++;
}

(async function main() {
  const dom = new JSDOM(bundleHtml, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
  });
  await new Promise((resolve) => dom.window.addEventListener("load", resolve));
  const win = dom.window, doc = win.document;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.confirm = () => true;
  const $ = (id) => doc.getElementById(id);
  const ACTIVE = win.HD2_DATA.items.filter((i) => i.factions.indexOf("none") === -1).length; // every item that can roll (the tests used to hard-code this number)
  const click = (el) => el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  const generate = () => $("controls").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
  const setFaction = (v) => {
    doc.querySelector('input[name="faction"][value="' + v + '"]').checked = true;
    doc.querySelector('input[name="faction"][value="' + v + '"]').dispatchEvent(new win.Event("change", { bubbles: true }));
  };
  const change = () => new win.Event("change", { bubbles: true });
  const gearBox = (name) => doc.querySelector('#gear-list input[data-item="' + name + '"]');
  const blockBtn = (name) => doc.querySelector('#gear-list .block-btn[data-block="' + name + '"]');
  const rowOf = (name) => gearBox(name).closest(".gear-row");
  const nameStyle = (name) => win.getComputedStyle(rowOf(name).querySelector(".tr-name"));
  const blockBlock = (label) => Array.from(doc.querySelectorAll("#gear-list .wb-block")).find((b) => b.querySelector(".wb-name").textContent === label);
  // what a person sees: skips the red part while it is hidden
  const countText = (block) => Array.from(block.querySelector(".wb-count").childNodes)
    .filter((n) => !n.hidden).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
  const setOwnedItem = (name, on) => { const b = gearBox(name); b.checked = on; b.dispatchEvent(change()); };
  const poolText = () => $("pool-text").textContent;
  const ownOnly = (keys) => { click($("gear-clear")); keys.filter((k) => k !== "base").forEach((k) => click(doc.querySelector('[data-all="' + k + '"]'))); };
  const cards = () => doc.querySelectorAll("#results .item-card, #results .item-card2").length;
  const errors = () => Array.from(doc.querySelectorAll("#messages .msg.error")).map((e) => e.textContent);

  console.log("Page build");
  check("no script errors / HD2Engine loaded", typeof win.HD2Engine === "object");
  check("My Gear: 36 warbonds, the six Requisition shops grouped under one header (31 top-level blocks)", doc.querySelectorAll("#gear-list .wb-block:not(.wb-group)").length === 36 && doc.querySelectorAll("#gear-list .wb-group").length === 1 && doc.querySelectorAll("#gear-list > .wb-block").length === 31, doc.querySelectorAll("#gear-list .wb-block").length);
  check(ACTIVE + " gear rows (every active item)", doc.querySelectorAll("#gear-list .gear-row").length === ACTIVE);
  check("every gear row has a lazy thumbnail from the item's image link", Array.from(doc.querySelectorAll("#gear-list .gear-row")).every((r) => { const i = r.querySelector("img.gear-thumb"); return i && i.getAttribute("loading") === "lazy" && /^https:\/\//.test(i.getAttribute("src")); }));
  { const t = rowOf("AR-23 Liberator").querySelector("img.gear-thumb"); t.dispatchEvent(new win.Event("error"));
    check("a thumbnail that can't load becomes a blank square of the same size", !rowOf("AR-23 Liberator").querySelector("img.gear-thumb") && !!rowOf("AR-23 Liberator").querySelector(".gear-thumb-blank")); }
  check("new browser starts with everything owned", $("grand-total").textContent === ACTIVE + " / " + ACTIVE + " items owned", $("grand-total").textContent);
  check("pool line on the Randomizer tab", new RegExp("Rolling from " + ACTIVE + " of " + ACTIVE + " items\\.").test(poolText()), poolText());
  check("old Warbonds / Exclude sections are gone", !$("warbond-grid") && !$("exclude-input"));
  check("Base Game rows: checked and locked", (() => { const b = Array.from(doc.querySelectorAll("#gear-list .wb-block")).find((x) => /Base Game/.test(x.textContent)); const boxes = Array.from(b.querySelectorAll("input[data-item]")); return boxes.length === 6 && boxes.every((c) => c.checked && c.disabled) && !b.querySelector("[data-all]"); })());
  const DEFAULTS = {}; win.HD2_DATA.items.forEach((i) => { DEFAULTS[i.name] = i.factions.join(","); });
  const defaultOf = (name) => DEFAULTS[name];
  const customCount = () => doc.querySelectorAll("#gear-list .gear-row.fac-custom").length;
  check("first visit wrote the owned list to localStorage", Object.keys(JSON.parse(win.localStorage.getItem("hd2_tracker"))).length === ACTIVE - win.HD2_DATA.items.filter((i) => i.warbond === "base" && i.factions.indexOf("none") === -1).length); // everything except the always-owned Base Game items
  check("7 lock inputs", doc.querySelectorAll("#lock-grid input").length === 7);
  check("datalists filled", $("dl-primary").children.length > 40 && $("dl-strat").children.length > 60);
  check("require tag dropdown lists only titled tags (22), by title", (() => { const o = Array.from($("require-tag").children); const t = o.map((x) => x.textContent); return o.length === 22 && t.includes("Team Assist") && t.includes("Fire") && t.includes("Laser") && t.includes("Plasma") && t.includes("Hand-Held Shield") && t.includes("Explosive") && t.every((x, i) => i === 0 || t[i - 1].localeCompare(x) <= 0) && !o.some((x) => ["onehand", "stun", "smg", "mortar"].includes(x.value)) && o.some((x) => x.value === "assist"); })(), Array.from($("require-tag").children).map((x) => x.textContent).join(", "));
  check("autocomplete options carry names only (no category labels)",
    Array.from(doc.querySelectorAll("#dl-strat option")).every((o) => !o.hasAttribute("label")) &&
    $("dl-strat").querySelector("option[value='AC-8 Autocannon']") !== null);
  check("strike-through exists only on blocked rows", (doc.querySelector("style").textContent.match(/[^{}]+\{[^}]*line-through/g) || []).every((r) => /is-blocked/.test(r)));

  const css = doc.querySelector("style").textContent;
  check("tagline under the title", /A Loadout Randomizer Fan-Project/.test(doc.querySelector(".site-header .tagline").textContent));
  check("title is Helldiver Yellow; accent is Super Credit Blue", /color: #FFE900/i.test(css.match(/h1 \{[^}]*\}/)[0]) && /--accent: #70F5FF/.test(css));
  check("only the warning banner still uses the old yellow", (css.match(/[^{}]+\{[^}]*#f0c040/g) || []).every((r) => /rules-warning/.test(r)), (css.match(/[^{}]+\{[^}]*#f0c040/g) || []).join(" | "));
  check("faction colours defined", ["bug: #FF8D1F", "bot: #FF6161", "squid: #CD8AEA"].every((x) => new RegExp('data-faction="' + x.split(":")[0] + '"\\][^}]*' + x.split(" ")[1], "i").test(css)));
  check("My Gear view is always Helldiver Yellow, independent of faction", /#view-gear\s*\{[^}]*--accent:\s*#FFE900/i.test(css));
  check("Terminid Yellow is #FF8D1F", /data-faction="bug"\][^}]*#FF8D1F/i.test(css) && !/FFB901/i.test(css));
  check("theme starts at 'any'", doc.documentElement.getAttribute("data-faction") === "any");

  console.log("Generate");
  generate();
  check("default generate -> 7 cards", cards() === 7, cards());
  check("primary card is the wide one", doc.querySelectorAll("#results .item-card2").length === 1);
  check("no error banner", errors().length === 0, errors());
  $("count").value = "3"; generate();
  check("3 loadouts -> 21 cards + 3 headings", cards() === 21 && doc.querySelectorAll("#results h2").length === 3, cards());
  setFaction("bot"); $("count").value = "1"; generate();
  check("faction bot generates", cards() === 7);
  check("picking Automatons switches the page theme", doc.documentElement.getAttribute("data-faction") === "bot");
  check("results carry the faction's accent colour", $("results").style.getPropertyValue("--accent").toLowerCase() === "#ff6161", $("results").style.getPropertyValue("--accent"));
  setFaction("squid");
  check("switching faction later leaves existing results in their own colour", $("results").style.getPropertyValue("--accent").toLowerCase() === "#ff6161" && doc.documentElement.getAttribute("data-faction") === "squid");
  setFaction("any");

  console.log("Armor penetration icons");
  $("lock-primary").value = "SMG/FLAM-34 Stoker"; $("lock-strat1").value = "Eagle Airstrike"; $("lock-strat2").value = "AC-8 Autocannon";
  generate();
  const cardOf = (name) => Array.from(doc.querySelectorAll("#results .item-card, #results .item-card2")).find((c) => c.querySelector(".item-name").textContent === name);
  const apSrc = (name) => Array.from(cardOf(name).querySelectorAll(".ap-icon")).map((i) => i.getAttribute("src").replace(/^.*\//, ""));
  check("a two-mode weapon shows both icons, in order, with a separator", apSrc("SMG/FLAM-34 Stoker").join() === "Armor_AP2_Icon.png,Armor_AP4_Icon.png" && cardOf("SMG/FLAM-34 Stoker").querySelectorAll(".ap-sep").length === 1, apSrc("SMG/FLAM-34 Stoker").join());
  check("a single-mode weapon shows one icon (Autocannon = Heavy)", apSrc("AC-8 Autocannon").join() === "Armor_AP4_Icon.png" && cardOf("AC-8 Autocannon").querySelectorAll(".ap-sep").length === 0, apSrc("AC-8 Autocannon").join());
  check("icons come from the wiki and have a readable name", /^https:\/\/helldivers\.wiki\.gg\/images\/Armor_AP4_Icon\.png$/.test(cardOf("AC-8 Autocannon").querySelector(".ap-icon").getAttribute("src")) && /Heavy/.test(cardOf("AC-8 Autocannon").querySelector(".ap-icon").getAttribute("alt")));
  check("an attacking stratagem shows its icon too (Eagle Airstrike = Anti-Tank I)", apSrc("Eagle Airstrike").join() === "Armor_AP5_Icon.png");
  const ic = cardOf("SMG/FLAM-34 Stoker").querySelector(".ap-icon");
  ic.dispatchEvent(new win.Event("error"));
  check("an icon that fails to load is replaced by its name", cardOf("SMG/FLAM-34 Stoker").querySelector(".ap-text") && cardOf("SMG/FLAM-34 Stoker").querySelector(".ap-text").textContent === "Light", (cardOf("SMG/FLAM-34 Stoker").querySelector(".ap-row") || {}).textContent);
  // every weapon in the data produces an icon row on its card
  check("every weapon category has armor data to show", win.HD2_DATA.items.filter((i) => ["primary", "secondary", "throwable", "support"].includes(i.cat)).every((i) => i.armorPen.length >= 1));
  $("lock-primary").value = ""; $("lock-strat1").value = ""; $("lock-strat2").value = "";

  console.log("Pool line follows the faction");
  const validFor = (f) => win.HD2_DATA.items.filter((i) => win.HD2Engine.worksFor(i, f)).length;
  check("any -> 'of N items' with N = every active item", new RegExp("of " + validFor("any") + " items").test(poolText()) && validFor("any") === ACTIVE, poolText());
  for (const [f, adj] of [["bug", "Terminid"], ["bot", "Automaton"], ["squid", "Illuminate"]]) {
    setFaction(f);
    check(f + " -> denominator is the " + validFor(f) + " items valid for that faction", poolText().indexOf("of " + validFor(f) + " " + adj + "-compatible items") !== -1 && validFor(f) < ACTIVE, poolText());
  }
  setFaction("bug");
  click(blockBtn(win.HD2_DATA.items.find((i) => win.HD2Engine.worksFor(i, "bug") && i.warbond !== "base").name));
  check("a blocked bug-valid item shows in the faction line", /1 blocked/.test(poolText()), poolText());
  click($("gear-unblock-all"));
  const botOnly = win.HD2_DATA.items.find((i) => !win.HD2Engine.worksFor(i, "bug") && win.HD2Engine.worksFor(i, "bot") && i.warbond !== "base").name;
  click(blockBtn(botOnly));
  check("blocking an item the faction can't use doesn't change that faction's line", !/blocked/.test(poolText()), poolText());
  click($("gear-unblock-all"));
  check("My Gear's own totals ignore the faction", $("grand-total").textContent === ACTIVE + " / " + ACTIVE + " items owned");
  setFaction("any");

  console.log("Validation");
  $("count").value = "0"; generate();
  check("count 0 -> error", errors().some((e) => /Loadouts must be/.test(e)), errors());
  $("count").value = "1";
  click($("gear-clear"));
  check("own nothing -> only the 6 Base Game items left in the pool", new RegExp("Rolling from 6 of " + ACTIVE).test(poolText()), poolText());
  generate();
  check("pool too small -> error pointing at My Gear, no cards", errors().some((e) => /My Gear/.test(e)) && cards() === 0, errors());
  doc.querySelectorAll('#gear-list .gear-row').forEach((row) => { if (row.querySelector("input").disabled) click(row.querySelector(".block-btn")); });
  generate();
  check("empty pool -> clear error", errors().some((e) => /gear pool is empty/.test(e)), errors());
  click($("gear-unblock-all")); click($("gear-select-all"));
  check("Unblock all + Own everything -> back to everything", new RegExp("Rolling from " + ACTIVE + " of " + ACTIVE).test(poolText()), poolText());
  $("lock-primary").value = "definitely not a gun"; generate();
  check("unknown lock -> error", errors().some((e) => /unknown item/.test(e)), errors());
  $("lock-primary").value = "AC-8 Autocannon"; generate();
  check("wrong-slot lock -> error", errors().some((e) => /can't go in this slot/.test(e)), errors());
  $("lock-primary").value = "";
  $("lock-strat1").value = "Eagle Airstrike"; $("lock-strat2").value = "eagle airstrike"; generate();
  check("duplicate strat lock -> error", errors().some((e) => /more than one stratagem slot/.test(e)), errors());
  $("lock-strat2").value = "";
  $("lock-strat1").value = "M-102 Gunner FRV"; $("lock-strat2").value = "M-103 Supply FRV"; generate();
  check("two locked FRVs -> in-game limit error", errors().some((e) => /only bring one FRV/.test(e)), errors());
  $("lock-strat1").value = "EXO-45 Patriot Exosuit"; $("lock-strat2").value = "EXO-55 Breakthrough Exosuit"; generate();
  check("two locked exosuits -> in-game limit error", errors().some((e) => /only bring one exosuit/.test(e)), errors());
  $("lock-strat1").value = "M-102 Gunner FRV"; $("lock-strat2").value = "EXO-45 Patriot Exosuit"; generate();
  check("one FRV + one exosuit lock is fine", !errors().some((e) => /only bring one/.test(e)), errors());
  $("lock-strat1").value = ""; $("lock-strat2").value = "";

  console.log("Locks, exclusions, requirements");
  $("lock-primary").value = "liberator"; // nickname, lower case
  $("lock-strat1").value = "AC-8 Autocannon";
  generate();
  const names = Array.from(doc.querySelectorAll("#results .item-name")).map((e) => e.textContent);
  check("nickname lock resolved to AR-23 Liberator", names[0] === "AR-23 Liberator", names[0]);
  check("strat 1 locked to Autocannon", names[3] === "AC-8 Autocannon", names[3]);
  check("two slots show as locked", doc.querySelectorAll("#results .lock-btn[aria-pressed=\"true\"]").length === 2);
  $("lock-primary").value = ""; $("lock-strat1").value = "";

  console.log("Slot locks and rerolls");
  const loadoutEls = () => Array.from(doc.querySelectorAll("#results .loadout"));
  const slotNames = (i) => Array.from(loadoutEls()[i].querySelectorAll(".item-name")).map((e) => e.textContent);
  const slotCard = (i, n) => loadoutEls()[i].querySelectorAll(".item-card, .item-card2")[n];
  const lockBtnAt = (i, n) => slotCard(i, n).querySelector(".lock-btn");
  const rerollBtnAt = (i, n) => slotCard(i, n).querySelector(".reroll-btn");
  const rerollAll = (i) => loadoutEls()[i].querySelector(".reroll-all-btn");
  check("form locks come through as locked cards", lockBtnAt(0, 0).getAttribute("aria-pressed") === "true" && lockBtnAt(0, 3).getAttribute("aria-pressed") === "true");
  check("a locked card's reroll button is disabled", rerollBtnAt(0, 0).disabled === true && rerollBtnAt(0, 1).disabled === false);
  check("reroll-unlocked button counts the 5 free slots", /\(5\)/.test(rerollAll(0).textContent), rerollAll(0).textContent);
  let before = slotNames(0);
  click(rerollBtnAt(0, 1)); // secondary
  let after = slotNames(0);
  check("rerolling one slot changes only that slot", after[1] !== before[1] && after.every((n, i) => i === 1 || n === before[i]), before.join("|") + " -> " + after.join("|"));
  check("rerolled slot keeps the locks", lockBtnAt(0, 0).getAttribute("aria-pressed") === "true" && after[0] === "AR-23 Liberator" && after[3] === "AC-8 Autocannon");
  let changedAlways = true;
  for (let n = 0; n < 15; n++) { const b = slotNames(0)[6]; click(rerollBtnAt(0, 6)); if (slotNames(0)[6] === b) changedAlways = false; }
  check("rerolling a slot always picks a different item when others exist (15 rerolls)", changedAlways);
  check("a single-slot reroll still gives 7 distinct slots", new Set(slotNames(0).slice(3)).size === 4 && cards() === 7);
  click(lockBtnAt(0, 2)); // lock the throwable
  check("clicking the lock locks the card", lockBtnAt(0, 2).getAttribute("aria-pressed") === "true" && rerollBtnAt(0, 2).disabled);
  check("...and the free count drops to 4", /\(4\)/.test(rerollAll(0).textContent), rerollAll(0).textContent);
  before = slotNames(0);
  let lockedStayed = true, somethingMoved = false;
  for (let n = 0; n < 10; n++) {
    click(rerollAll(0));
    const now = slotNames(0);
    if ([0, 2, 3].some((i) => now[i] !== before[i])) lockedStayed = false;
    if ([1, 4, 5, 6].some((i) => now[i] !== before[i])) somethingMoved = true;
    before = now;
  }
  check("reroll all unlocked keeps every locked slot (10 rerolls)", lockedStayed);
  check("...and does reroll the free ones", somethingMoved);
  click(lockBtnAt(0, 2));
  check("clicking again unlocks", lockBtnAt(0, 2).getAttribute("aria-pressed") === "false" && rerollBtnAt(0, 2).disabled === false);
  [1, 2, 4, 5, 6].forEach((n) => { if (lockBtnAt(0, n).getAttribute("aria-pressed") !== "true") click(lockBtnAt(0, n)); });
  check("all 7 locked -> reroll all unlocked is disabled", rerollAll(0).disabled === true && /\(0\)/.test(rerollAll(0).textContent));
  before = slotNames(0); click(rerollAll(0));
  check("...and does nothing when clicked", slotNames(0).join("|") === before.join("|"));
  $("lock-primary").value = ""; $("lock-strat1").value = "";
  $("count").value = "3"; generate();
  check("3 loadouts each get their own reroll button", doc.querySelectorAll("#results .reroll-all-btn").length === 3);
  const l1 = loadoutEls()[0], l3 = loadoutEls()[2], ra = slotNames(0), rb = slotNames(1), rc = slotNames(2);
  click(lockBtnAt(1, 0));
  for (let n = 0; n < 5; n++) click(rerollAll(1));
  check("rerolling loadout 2 leaves loadouts 1 and 3 alone", slotNames(0).join("|") === ra.join("|") && slotNames(2).join("|") === rc.join("|") && loadoutEls()[0] === l1 && loadoutEls()[2] === l3);
  check("...and keeps loadout 2's locked slot", slotNames(1)[0] === rb[0]);
  check("...and it moved something", slotNames(1).join("|") !== rb.join("|"));
  check("locks on one loadout don't appear on the others", lockBtnAt(0, 0).getAttribute("aria-pressed") === "false");
  $("count").value = "1"; generate();
  check("generating again starts with nothing locked", doc.querySelectorAll("#results .lock-btn[aria-pressed=\"true\"]").length === 0);
  // the faction a loadout was made for travels with its rerolls, even if you switch faction afterwards
  setFaction("bot"); generate();
  setFaction("squid");
  const botOk = (name) => win.HD2_DATA.items.find((i) => i.name === name).factions.some((f) => f === "bot" || f === "any");
  let allBot = true;
  for (let n = 0; n < 8; n++) { click(rerollAll(0)); click(rerollBtnAt(0, 4)); if (!slotNames(0).every(botOk)) allBot = false; }
  check("rerolls keep the faction the loadout was generated for", allBot);
  check("...and its colour", $("results").style.getPropertyValue("--accent").toLowerCase() === "#ff6161");
  setFaction("any");

  click(blockBtn("AR-23 Liberator"));
  check("Block button pressed", blockBtn("AR-23 Liberator").getAttribute("aria-pressed") === "true");
  check("pool line counts it", new RegExp("Rolling from " + (ACTIVE - 1) + " of " + ACTIVE + ".*1 blocked").test(poolText()), poolText());
  check("block saved", JSON.parse(win.localStorage.getItem("hd2_blocked")).includes("AR-23 Liberator"));
  $("lock-primary").value = "AR-23 Liberator"; generate();
  check("locking a blocked item -> error", errors().some((e) => /isn't in your gear pool \(blocked\)/.test(e)), errors());
  $("lock-primary").value = "";
  let sawExcluded = false;
  for (let i = 0; i < 25; i++) {
    generate();
    if (Array.from(doc.querySelectorAll("#results .item-name")).some((e) => e.textContent === "AR-23 Liberator")) sawExcluded = true;
  }
  check("blocked item never rolls (25 tries)", !sawExcluded);
  click(blockBtn("AR-23 Liberator"));
  check("Block toggles back off", blockBtn("AR-23 Liberator").getAttribute("aria-pressed") === "false" && new RegExp("Rolling from " + ACTIVE + " of " + ACTIVE).test(poolText()));
  setOwnedItem("AC-8 Autocannon", false);
  $("lock-strat1").value = "AC-8 Autocannon"; generate();
  check("locking an item you don't own -> error", errors().some((e) => /not owned/.test(e)), errors());
  $("lock-strat1").value = "";
  setOwnedItem("AC-8 Autocannon", true);

  const addRule = (tag, op, n) => { $("require-tag").value = tag; $("require-op").value = op; $("require-op").dispatchEvent(new win.Event("change")); $("require-n").value = String(n); click($("require-add")); };
  const chips = () => Array.from(doc.querySelectorAll("#require-chips .chip"));
  const chipTexts = () => chips().map((c) => c.firstChild.textContent);
  const chipFor = (tag) => doc.querySelector('#require-chips .chip[data-tag="' + tag + '"]');
  const removeChip = (tag) => click(chipFor(tag).querySelector("button"));
  const DEFAULT_ROWS = ["Backpack = 1", "Anti-Tank ≥ 1", "Medium Killer ≥ 1", "Base Breaker ≥ 1", "Panic Weapon ≥ 1", "Vehicle ≤ 1", "Eagle ≤ 2", "Mines ≤ 1"];
  check("the eight plain-count default rules start as dim rows in Additional rules", chipTexts().join("|") === DEFAULT_ROWS.join("|") && chips().every((c) => c.classList.contains("preset")), chipTexts().join("|"));
  check("...with no 'reset to system defaults' button yet, and nothing counted in the summary", $("presets-reset").hidden && $("rules-summary").textContent === "");
  addRule("demo", "min", 3);
  check("adding a rule for a default row's tag edits that row (not a second chip)", chips().length === 8 && chipTexts()[3] === "Base Breaker ≥ 3" && !chipFor("demo").classList.contains("preset"), chipTexts().join("|"));
  check("...shows the reset button and counts one edited rule", !$("presets-reset").hidden && /1 edited/.test($("rules-summary").textContent), $("rules-summary").textContent);
  $("count").value = "4"; generate();
  check("require demo>=3 still generates", cards() === 28, cards() + " " + errors());
  $("count").value = "1";
  addRule("vehicle", "min", 4); // only one FRV, tank and exosuit exist -> max 3
  generate();
  check("unmeetable requirement still builds 7 cards (no error)", cards() === 28 || cards() === 7, cards() + " " + errors());
  check("...and lists the unmet requirement in a banner", /Rule: at least 4 Vehicle/.test((doc.querySelector("#results .rules-warning") || {}).textContent || ""),
    (doc.querySelector("#results .rules-warning") || {}).textContent);
  check("...with no red error message", errors().length === 0, errors());
  check("'at least 4 vehicles' replaced the default 'at most 1' (the default's side of the clash is dropped)", chipTexts()[5] === "Vehicle ≥ 4", chipTexts().join("|"));
  chips().forEach((c) => click(c.querySelector("button")));
  check("every row is removable, defaults included", chips().length === 0 && /8 off/.test($("rules-summary").textContent), $("rules-summary").textContent);
  click($("presets-reset"));
  check("'Reset to system defaults' brings the eight default rows back", chipTexts().join("|") === DEFAULT_ROWS.join("|") && chips().every((c) => c.classList.contains("preset")) && $("presets-reset").hidden && $("rules-summary").textContent === "", chipTexts().join("|"));

  console.log("Rules panel");
  check("rules panel replaces 'Require tags'", !/Require tags/.test(doc.body.textContent) && /Default rules/.test(doc.body.textContent) && /Additional rules/.test(doc.body.textContent));
  check("operator offers at least / at most / exactly", Array.from($("require-op").children).map((o) => o.textContent).join("|") === "at least|at most|exactly");
  const engRules = win.HD2Engine.RULES.filter((r) => !r.preset);   // the eight plain-count rules are rows, not switches
  const sw = (id) => doc.querySelector('#rules-default input[data-rule="' + id + '"]');
  check("one switch per engine rule that is not a plain count, all on", doc.querySelectorAll("#rules-default input[data-rule]").length === engRules.length && engRules.every((r) => sw(r.id) && sw(r.id).checked));
  check("in-game limits row is shown and has no switch", /1 FRV, 1 tank and 1 exosuit/.test($("rules-default").textContent) && doc.querySelectorAll("#rules-default .rule-row.locked input").length === 0);
  check("priority headings shown", /High priority/.test($("rules-default").textContent) && /Lowest priority/.test($("rules-default").textContent));
  check("'turn all back on' hidden while nothing is off", $("rules-reset").hidden);
  addRule("eagle", "max", 1); addRule("sentry", "eq", 0); addRule("chaff", "min", 2); addRule("chaff", "max", 3);
  check("chips: at most / exactly / range (Eagle edits its default row; the others are added after the defaults)", chipTexts().join("|") === DEFAULT_ROWS.join("|").replace("Eagle ≤ 2", "Eagle ≤ 1") + "|Sentry = 0|Chaff Killer 2–3", chipTexts().join("|"));
  check("summary counts added and edited rules", /2 added, 1 edited/.test($("rules-summary").textContent), $("rules-summary").textContent);
  addRule("chaff", "min", 5);
  check("a contradictory range is refused with a message", errors().some((e) => /can't both hold/.test(e)) && chipTexts().includes("Chaff Killer 2–3"), errors());
  addRule("chaff", "min", 0);
  check("'at least 0' is refused", errors().some((e) => /1 to 7/.test(e)), errors());
  addRule("chaff", "eq", 2);
  check("exactly replaces the range", chipTexts().includes("Chaff Killer = 2"), chipTexts().join("|"));
  $("count").value = "3"; generate();
  check("builds with added rules; no unmet rule banner for the ones that can be met", cards() === 21 && !/Rule: at most 1 Eagle|Rule: exactly 0 Sentry/.test((doc.querySelector("#results") || {}).textContent), cards() + " " + errors());
  $("count").value = "1";
  addRule("eagle", "min", 3);
  check("'at least 3' against the player's own 'at most 1' is refused (only a DEFAULT number gives way)", errors().some((e) => /can't both hold/.test(e)) && chipTexts().includes("Eagle ≤ 1"), errors().concat(chipTexts()).join("|"));
  addRule("eagle", "eq", 2); addRule("eagle", "max", 1);
  check("a clash with the player's own earlier rule is refused", errors().some((e) => /can't both hold/.test(e)) && chipTexts().includes("Eagle = 2"), errors().concat(chipTexts()).join("|"));
  addRule("armor", "max", 2);
  check("'at most 2' on a default 'at least 1' row makes the range 1–2", chipTexts().includes("Anti-Tank 1–2"), chipTexts().join("|"));
  addRule("vehicle", "max", 2); addRule("vehicle", "max", 1);
  check("editing a row back to its default makes it a dim default row again", chipFor("vehicle").classList.contains("preset") && chipTexts().includes("Vehicle ≤ 1"), chipTexts().join("|"));
  chips().forEach((c) => click(c.querySelector("button")));
  check("rule chips removable", chips().length === 0);
  addRule("armor", "min", 2); addRule("sentry", "min", 1);
  click($("presets-reset"));
  check("'Reset to system defaults' restores the defaults but keeps rules added for other tags", chipTexts().join("|") === DEFAULT_ROWS.join("|") + "|Sentry ≥ 1", chipTexts().join("|"));
  removeChip("sentry");
  check("...and removing the last extra rule leaves just the defaults, nothing counted", chipTexts().join("|") === DEFAULT_ROWS.join("|") && $("rules-summary").textContent === "");

  const sw2 = sw("capSupport"); sw2.checked = false; sw2.dispatchEvent(new win.Event("change", { bubbles: true }));
  check("switching a rule off greys the row, shows 'turn back on' and counts it", sw2.closest(".rule-row").classList.contains("off") && !$("rules-reset").hidden && /1 off/.test($("rules-summary").textContent), $("rules-summary").textContent);
  check("...and saves it", JSON.stringify(JSON.parse(win.localStorage.getItem("hd2_settings")).disabledRules) === '["capSupport"]', win.localStorage.getItem("hd2_settings"));
  const armorOff = sw("balance"); armorOff.checked = false; armorOff.dispatchEvent(new win.Event("change", { bubbles: true }));
  generate();
  check("builds still generate with rules off", cards() === 7 && errors().length === 0, cards() + " " + errors());
  click($("rules-reset"));
  check("'turn all back on' re-enables everything", engRules.every((r) => sw(r.id).checked) && $("rules-reset").hidden && $("rules-summary").textContent === "");
  check("...and saves that", JSON.parse(win.localStorage.getItem("hd2_settings")).disabledRules.length === 0);
  removeChip("panic");   // the Panic Weapon default row is removed; it must be saved as a switched-off rule

  console.log("Locks that break rules");
  $("lock-strat1").value = "Eagle Airstrike"; $("lock-strat2").value = "Orbital Gas Strike";
  $("lock-strat3").value = "Orbital Smoke Strike"; $("lock-strat4").value = "Eagle Strafing Run";
  generate();
  check("all 4 stratagems locked, no backpack -> builds", cards() === 7 && errors().length === 0, cards() + " " + errors());
  check("...and the backpack rule is not flagged", !/backpack/i.test((doc.querySelector("#results .rules-warning") || {}).textContent || ""));
  ["strat1", "strat2", "strat3", "strat4"].forEach((k) => ($("lock-" + k).value = ""));

  console.log("Faction fallback");
  setFaction("bug");
  ownOnly(FREE_SOURCES);
  check("free sources only -> small pool, premium warbonds not owned", (() => { const m = /Rolling from (\d+) of (\d+)/.exec(poolText()); return m && Number(m[1]) > 6 && Number(m[1]) < Number(m[2]) / 2; })(), poolText());
  generate();
  check("bug + free sources only (no premium warbonds) -> off-faction banner shown", !!doc.querySelector("#results .faction-warning"));

  console.log("Warbond pills");
  setFaction("any");
  $("count").value = "5"; generate();
  const pills = Array.from(doc.querySelectorAll("#results .warbond-row .tag-pill")).map((p) => p.textContent);
  check("Requisition sources show the short pill label", pills.length > 0 && pills.includes("Requisition") && pills.every((t) => !/^Requisition: /.test(t)), JSON.stringify(Array.from(new Set(pills))) + " errors=" + JSON.stringify(errors()) + " cards=" + cards());
  const reqGroup = doc.querySelector("#gear-list .wb-group");
  const reqSubNames = Array.from(reqGroup.querySelectorAll(".wb-group-body .wb-block .wb-name")).map((n) => n.textContent);
  check("the Requisition group lists the six shops by short name, in order", reqSubNames.join("|") === "Patriotic Administration Center|Orbital Cannons|Hangar|Bridge|Engineering Bay|Robotics Workshop", reqSubNames.join("|"));
  check("...and the group header is just 'Requisition'", reqGroup.querySelector(":scope > .wb-header .wb-name").textContent === "Requisition");
  check("...its count covers all the shops' items", (() => { const t = Number(reqGroup.querySelector(":scope > .wb-header .wb-count").getAttribute("data-total")); return t === reqGroup.querySelectorAll(".gear-row").length && t > 30; })());
  check("...the full 'Requisition: ...' names still drive search", Array.from(reqGroup.querySelectorAll(".gear-row")).every((r) => /requisition: /.test(r.getAttribute("data-search"))));
  $("count").value = "1";
  click($("gear-select-all"));
  setFaction("bug");

  console.log("Persistence");
  const saved = JSON.parse(win.localStorage.getItem("hd2_settings"));
  check("faction saved", saved && saved.faction === "bug", JSON.stringify(saved));
  check("a switched-off default rule is saved with the settings", saved && Array.isArray(saved.disabledRules) && saved.disabledRules.join() === "panic", JSON.stringify(saved));

  console.log("My Gear tab");
  click(doc.querySelector('.tab[data-view="gear"]'));
  check("gear view visible", !$("view-gear").hidden && $("view-randomizer").hidden);
  const firstBlock = Array.from(doc.querySelectorAll("#gear-list .wb-block")).find((b) => b.querySelector("[data-all]"));
  click(firstBlock.querySelector(".wb-header"));
  check("clicking a header opens that section", firstBlock.querySelector(".wb-items").classList.contains("open"));
  click($("gear-clear"));
  check("Own nothing -> 6 / everything (Base Game stays) and saves {}", $("grand-total").textContent === "6 / " + ACTIVE + " items owned" && win.localStorage.getItem("hd2_tracker") === "{}", $("grand-total").textContent + " " + win.localStorage.getItem("hd2_tracker"));
  const firstBox = firstBlock.querySelector("input[data-item]");
  firstBox.checked = true; firstBox.dispatchEvent(change());
  check("tick saves to localStorage", !!JSON.parse(win.localStorage.getItem("hd2_tracker"))[firstBox.getAttribute("data-item")]);
  click(firstBlock.querySelector("[data-none]"));
  click(firstBlock.querySelector("[data-all]"));
  const n1 = Number(firstBlock.querySelector(".pool-count").textContent);
  check("per-warbond All owns just that warbond", n1 === firstBlock.querySelectorAll("input[data-item]").length && $("grand-total").textContent === (6 + n1) + " / " + ACTIVE + " items owned", n1 + " / " + $("grand-total").textContent);
  click(firstBlock.querySelector("[data-none]"));
  check("per-warbond None clears it", firstBlock.querySelector(".pool-count").textContent === "0" && $("grand-total").textContent === "6 / " + ACTIVE + " items owned");
  click($("gear-select-all"));
  check("Own everything -> all owned", $("grand-total").textContent === ACTIVE + " / " + ACTIVE + " items owned");
  click(blockBtn("AC-8 Autocannon"));
  check("blocked item shown in the summary", /1 blocked/.test($("gear-detail").textContent), $("gear-detail").textContent);
  // Blocked-but-owned styling and the per-warbond counts
  const baseBlock = blockBlock("Base Game");
  click(blockBtn("AC-8 Autocannon")); // unblock it again so counts start clean
  check("Base Game starts at 6 / 6 (no red number)", countText(baseBlock) === "6 / 6" && baseBlock.querySelector(".blocked-part").hidden, countText(baseBlock));
  const baseName = baseBlock.querySelector("input[data-item]").getAttribute("data-item");
  click(blockBtn(baseName));
  check("blocking one Base Game item -> 1 / 5 / 6 with the red number", countText(baseBlock) === "1 / 5 / 6" && !baseBlock.querySelector(".blocked-part").hidden, countText(baseBlock));
  check("...and the red number really is red", baseBlock.querySelector(".blocked-count").textContent === "1");
  check("blocked + owned row is red and struck through", rowOf(baseName).classList.contains("is-blocked") && /line-through/.test(nameStyle(baseName).textDecoration || nameStyle(baseName).getPropertyValue("text-decoration")) , nameStyle(baseName).textDecoration);
  const otherBase = baseBlock.querySelectorAll("input[data-item]")[1].getAttribute("data-item");
  check("owned, unblocked rows are not struck through", !/line-through/.test(nameStyle(otherBase).textDecoration || ""), nameStyle(otherBase).textDecoration);
  click(baseBlock.querySelector("[data-block-all]"));
  check("Block All on Base Game -> 6 / 0 / 6", countText(baseBlock) === "6 / 0 / 6", countText(baseBlock));
  click(baseBlock.querySelector("[data-block-none]"));
  check("Block None -> back to 6 / 6", countText(baseBlock) === "6 / 6", countText(baseBlock));
  check("Base Game has Block All/None but no Own All/None", !baseBlock.querySelector("[data-all]") && !baseBlock.querySelector("[data-none]"));
  check("buttons are labelled Own All / Own None / Block All / Block None", (() => { const l = Array.from(firstBlock.querySelectorAll(".wb-tools button")).map((b) => b.textContent); return l.join("|") === "Own All|Own None|Block All|Block None"; })(), Array.from(firstBlock.querySelectorAll(".wb-tools button")).map((b) => b.textContent).join("|"));
  // an unowned, blocked item: pressed button, but no red strike-through and not counted in the red number
  click(firstBlock.querySelector("[data-none]"));
  const fbItem = firstBlock.querySelector("input[data-item]").getAttribute("data-item");
  click(blockBtn(fbItem));
  check("unowned + blocked: no strike-through, no red number", !rowOf(fbItem).classList.contains("is-blocked") && firstBlock.querySelector(".blocked-part").hidden && blockBtn(fbItem).getAttribute("aria-pressed") === "true");
  click(firstBlock.querySelector("[data-all]"));
  check("owning it now shows 1 red / rest / total", /^1 \/ \d+ \/ \d+$/.test(countText(firstBlock)), countText(firstBlock));
  click(firstBlock.querySelector("[data-block-none]"));
  click(blockBtn("AC-8 Autocannon"));
  const search = (q) => { $("gear-search").value = q; $("gear-search").dispatchEvent(new win.Event("input", { bubbles: true })); };
  const shownNames = () => Array.from(doc.querySelectorAll("#gear-list .gear-row")).filter((r) => !r.hidden).map((r) => r.querySelector("input[data-item]").getAttribute("data-item"));
  search("scope of authority");
  const soa = shownNames();
  check("searching a warbond name lists that warbond's items", soa.includes("R-40 Sightliner") && soa.includes("G-11 Caltrops") && soa.length === 5 && Array.from(doc.querySelectorAll("#gear-list .wb-block")).filter((b) => !b.hidden).length === 1, soa.join(", "));
  search("hangar eagle");
  check("words combine: 'hangar eagle' -> the Hangar's Eagles only", shownNames().length === 7 && shownNames().every((n) => /^Eagle/.test(n)), shownNames().join(", "));
  check("a filter note appears", !$("gear-filter-note").hidden && /7 items shown/.test($("gear-filter-note").textContent), $("gear-filter-note").textContent);
  search("eagle");
  const hangar = blockBlock("Hangar");
  click(hangar.querySelector("[data-block-all]"));
  check("Block All with a search active blocks only the shown Hangar items", blockBtn("Eagle Airstrike").getAttribute("aria-pressed") === "true" && blockBtn("LIFT-850 Jump Pack").getAttribute("aria-pressed") === "false" && blockBtn("M-102 Gunner FRV").getAttribute("aria-pressed") === "false");
  click(hangar.querySelector("[data-none]"));
  check("Own None with a search active unowns only the shown Hangar items", !gearBox("Eagle Airstrike").checked && gearBox("LIFT-850 Jump Pack").checked);
  click(hangar.querySelector("[data-all]"));
  click(blockBtn("LIFT-850 Jump Pack"));
  click($("gear-unblock-all"));
  check("Unblock all with a search active only clears the shown items", blockBtn("Eagle Airstrike").getAttribute("aria-pressed") === "false" && blockBtn("LIFT-850 Jump Pack").getAttribute("aria-pressed") === "true");
  click(blockBtn("LIFT-850 Jump Pack"));
  click($("gear-clear"));
  check("Own nothing with a search active only touches the shown items", !gearBox("Eagle Airstrike").checked && gearBox("LIFT-850 Jump Pack").checked);
  click($("gear-select-all"));
  search("");
  check("filter note hidden again when the search is cleared", $("gear-filter-note").hidden);
  click(hangar.querySelector("[data-block-all]"));
  check("Block All with no search blocks the whole warbond", hangar.querySelectorAll(".gear-row.is-blocked").length === 11);
  click(hangar.querySelector("[data-block-none]"));
  check("Block None with no search clears the whole warbond", hangar.querySelectorAll(".gear-row.is-blocked").length === 0);
  $("gear-search").value = "autocannon"; $("gear-search").dispatchEvent(new win.Event("input", { bubbles: true }));
  const shown = Array.from(doc.querySelectorAll("#gear-list .gear-row")).filter((r) => !r.hidden);
  check("search narrows to matching rows", shown.length >= 1 && shown.length < 10 && shown.every((r) => /autocannon/.test(r.getAttribute("data-search"))), shown.length);
  check("...and hides empty warbond blocks", Array.from(doc.querySelectorAll("#gear-list .wb-block")).filter((b) => !b.hidden).length < 5);
  $("gear-search").value = ""; $("gear-search").dispatchEvent(new win.Event("input", { bubbles: true }));
  check("clearing search shows everything again", doc.querySelectorAll("#gear-list .gear-row[hidden]").length === 0 && doc.querySelectorAll("#gear-list .wb-block[hidden]").length === 0);
  click(doc.querySelector('.tab[data-view="randomizer"]'));

  console.log("Requisition group");
  click(doc.querySelector('.tab[data-view="gear"]'));
  const grp = () => doc.querySelector("#gear-list .wb-group");
  const grpBtn = (attr) => grp().querySelector(':scope > .wb-header [' + attr + ']');
  // "pool/total", or "blocked/pool/total" when the red part is showing (hidden text still counts in textContent, so skip it)
  const grpCount = () => { const c = grp().querySelector(":scope > .wb-header .wb-count"); const bp = c.querySelector(".blocked-part"); return (bp.hidden ? "" : c.querySelector(".blocked-count").textContent + "/") + c.querySelector(".pool-count").textContent + "/" + c.getAttribute("data-total"); };
  const subCount = (b) => { const c = b.querySelector(".wb-count"); return c.querySelector(".pool-count").textContent; };
  const acWasBlocked = blockBtn("AC-8 Autocannon").getAttribute("aria-pressed") === "true"; // it lives in a Requisition shop; put it back at the end
  // earlier sections leave things blocked and open: start from a known state
  click(grpBtn("data-block-none")); click(grpBtn("data-all")); // (group only: later tests rely on other blocks staying as they are)
  grp().querySelectorAll(".wb-items.open").forEach((el) => el.classList.remove("open")); grp().querySelector(":scope > .wb-items").classList.remove("open");
  const grpOwned = () => Array.from(grp().querySelectorAll(".gear-row input[data-item]")).filter((c) => c.checked).length;
  const grpTotal = grp().querySelectorAll(".gear-row").length;
  check("group starts closed and everything is owned", !grp().querySelector(":scope > .wb-items").classList.contains("open") && grpOwned() === grpTotal && grpCount() === grpTotal + "/" + grpTotal, grpCount());
  click(grp().querySelector(":scope > .wb-header"));
  check("clicking the group header opens it", grp().querySelector(":scope > .wb-items").classList.contains("open"));
  check("...and the shops inside open on their own", (() => { const sub = grp().querySelector(".wb-group-body .wb-block"); click(sub.querySelector(".wb-header")); return sub.querySelector(".wb-items").classList.contains("open"); })());
  click(grpBtn("data-none"));
  check("group Own None clears every Requisition shop", grpOwned() === 0 && grpCount() === "0/" + grpTotal, grpOwned() + " " + grpCount());
  check("...and each shop's own count follows", Array.from(grp().querySelectorAll(".wb-group-body .wb-block")).every((b) => subCount(b) === "0"));
  click(grpBtn("data-all"));
  check("group Own All owns them all again", grpOwned() === grpTotal && grpCount() === grpTotal + "/" + grpTotal);
  click(grpBtn("data-block-all"));
  check("group Block All blocks every item (red count shown)", grp().querySelectorAll(".gear-row.is-blocked").length === grpTotal && /^\d+\/0\/\d+$/.test(grpCount()), grpCount());
  click(grpBtn("data-block-none"));
  check("group Block None unblocks them", grp().querySelectorAll(".gear-row.is-blocked").length === 0);
  search("hangar eagle");
  check("with a search, the group shows only the matching rows", Array.from(grp().querySelectorAll(".gear-row:not([hidden])")).length > 0 && Array.from(grp().querySelectorAll(".gear-row:not([hidden])")).every((r) => /hangar/.test(r.getAttribute("data-search")) && /eagle/.test(r.getAttribute("data-search"))) && grp().hidden === false);
  check("...and opens itself", grp().querySelector(":scope > .wb-items").classList.contains("open"));
  const shownN = grp().querySelectorAll(".gear-row:not([hidden])").length;
  click(grpBtn("data-block-all"));
  check("group Block All with a search only blocks the rows shown", grp().querySelectorAll(".gear-row.is-blocked").length === shownN && shownN < grpTotal, grp().querySelectorAll(".gear-row.is-blocked").length + " of " + shownN);
  click(grpBtn("data-block-none"));
  search("scope of authority");
  check("a search with no Requisition match hides the whole group", grp().hidden === true);
  search("requisition");
  check("searching 'requisition' shows all the shops' items", grp().hidden === false && grp().querySelectorAll(".gear-row:not([hidden])").length === grpTotal);
  search("");
  check("clearing the search brings it all back", grp().hidden === false && grp().querySelectorAll(".gear-row[hidden]").length === 0);
  if (acWasBlocked && blockBtn("AC-8 Autocannon").getAttribute("aria-pressed") !== "true") click(blockBtn("AC-8 Autocannon"));
  click(doc.querySelector('.tab[data-view="randomizer"]'));

  console.log("Edit factions");
  const facBox = (name, f) => doc.querySelector('input[data-fac-item="' + name + '"][data-fac="' + f + '"]');
  const facTicks = (name) => ["bug", "bot", "squid"].filter((f) => facBox(name, f).checked).join(",");
  const itemFactions = (name) => win.HD2_DATA.items.find((i) => i.name === name).factions.join(",");
  const tick = (box, on) => { box.checked = on; box.dispatchEvent(new win.Event("change", { bubbles: true })); };
  const denom = (f) => { setFaction(f); return Number(/of (\d+)/.exec(poolText())[1]); };
  const LIB = "AR-23 Liberator", CONC = "AR-23C Liberator Concussive";
  click(doc.querySelector('.tab[data-view="gear"]'));
  check("Edit factions switch exists and starts off", $("edit-factions").checked === false && $("fac-tools").hidden === true && !$("view-gear").classList.contains("edit-factions"));
  $("edit-factions").checked = true; $("edit-factions").dispatchEvent(new win.Event("change", { bubbles: true }));
  check("switching it on shows the faction ticks and tools", $("view-gear").classList.contains("edit-factions") && $("fac-tools").hidden === false);
  check("an 'any' item starts with all three ticked", facTicks(LIB) === "bug,bot,squid", facTicks(LIB));
  check("a Terminid-only item starts with just Terminid", facTicks(CONC) === "bug", facTicks(CONC));
  check("nothing is edited yet: reset is disabled and says so", $("fac-reset").disabled === true && /No edits/.test($("fac-count").textContent), $("fac-count").textContent);
  check("no row is marked as edited", doc.querySelectorAll("#gear-list .gear-row.fac-custom").length === 0);
  const botBefore = denom("bot");
  tick(facBox(CONC, "bot"), true);
  check("ticking Automaton on the Concussive Liberator changes its factions", itemFactions(CONC) === "bug,bot", itemFactions(CONC));
  check("...the row is marked edited with a revert button", rowOf(CONC).classList.contains("fac-custom") && rowOf(CONC).querySelector(".fac-revert").hidden === false);
  check("...the count says 1 item edited", /^1 item edited/.test($("fac-count").textContent), $("fac-count").textContent);
  check("...the Automaton pool grew by one", denom("bot") === botBefore + 1, botBefore + " -> " + denom("bot"));
  check("...and the Randomizer line mentions the edits", /Using your edited faction lists \(1 item\)/.test(poolText()), poolText());
  check("the edit is saved to localStorage", JSON.stringify(JSON.parse(win.localStorage.getItem("hd2_factions"))[CONC]) === '["bug","bot"]', win.localStorage.getItem("hd2_factions"));
  tick(facBox(CONC, "squid"), true);
  check("ticking all three stores 'any'", itemFactions(CONC) === "any" && rowOf(CONC).classList.contains("fac-custom"), itemFactions(CONC));
  tick(facBox(CONC, "bot"), false); tick(facBox(CONC, "squid"), false);
  check("ticking back to the defaults clears the edit", itemFactions(CONC) === "bug" && !rowOf(CONC).classList.contains("fac-custom") && win.localStorage.getItem("hd2_factions") === "{}", win.localStorage.getItem("hd2_factions"));
  check("...and the Randomizer line drops the note", !/edited faction/.test(poolText()));
  // unticking everything: the item only rolls when the faction is Any
  const anyBefore = denom("any"), botB2 = denom("bot");
  ["bug", "bot", "squid"].forEach((f) => tick(facBox(LIB, f), false));
  check("no ticks -> item has an empty faction list", itemFactions(LIB) === "", JSON.stringify(itemFactions(LIB)));
  check("...Any still counts every item, Automatons lose one", denom("any") === anyBefore && denom("bot") === botB2 - 1, anyBefore + " " + botB2);
  setFaction("bot"); $("count").value = "1";
  let libSeen = false;
  for (let n = 0; n < 40; n++) { generate(); if (Array.from(doc.querySelectorAll("#results .item-name")).some((e) => e.textContent === LIB)) libSeen = true; }
  check("...so it never rolls for Automatons (40 builds)", !libSeen);
  tick(facBox(LIB, "squid"), true);
  check("an item ticked for only one faction leaves the other pools", itemFactions(LIB) === "squid" && denom("bug") === Object.values(DEFAULTS).filter((f) => f !== "none" && (f === "any" || f.split(",").includes("bug"))).length - 1);
  click(rowOf(LIB).querySelector(".fac-revert"));
  check("the per-item revert button restores the default", itemFactions(LIB) === "any" && facTicks(LIB) === "bug,bot,squid" && !rowOf(LIB).classList.contains("fac-custom"));
  setFaction("any");
  // reset, with the search filter limiting what it touches
  tick(facBox(LIB, "bug"), false); tick(facBox("Eagle Airstrike", "bot"), false);
  check("two edits counted", /^2 items edited/.test($("fac-count").textContent), $("fac-count").textContent);
  search("eagle airstrike");
  check("with a search active the button says 'shown' and counts only those", /Reset shown to defaults \(1\)/.test($("fac-reset").textContent), $("fac-reset").textContent);
  click($("fac-reset"));
  check("first click only asks for confirmation", /Click again to reset 1/.test($("fac-reset").textContent) && itemFactions("Eagle Airstrike") !== defaultOf("Eagle Airstrike"), $("fac-reset").textContent);
  click($("fac-reset"));
  check("second click resets only the item on screen", itemFactions("Eagle Airstrike") === defaultOf("Eagle Airstrike") && itemFactions(LIB) !== "any", itemFactions(LIB));
  search("");
  click($("fac-reset"));
  check("with no search the button resets everything", /Click again to reset 1/.test($("fac-reset").textContent), $("fac-reset").textContent);
  click($("fac-reset"));
  check("...and everything is back on the defaults", customCount() === 0 && /No edits/.test($("fac-count").textContent) && itemFactions(LIB) === "any", $("fac-count").textContent);
  // "Enable for all factions": all three ticked for the items on screen, with the same two-click guard
  const narrow = Object.keys(DEFAULTS).filter((n) => DEFAULTS[n] !== "any" && DEFAULTS[n] !== "none" && DEFAULTS[n] !== "");
  const NARROW = narrow[0], NARROW2 = narrow[1];
  check("test items exist that aren't already for every faction", !!NARROW && !!NARROW2 && rowOf(NARROW) && rowOf(NARROW2));
  const allCount = () => Object.keys(DEFAULTS).filter((n) => DEFAULTS[n] !== "none" && itemFactions(n) !== "any").length;
  check("'Enable for all factions' is shown next to reset, counts the items that aren't already all-factions", /^Enable for all factions \(\d+\)$/.test($("fac-all").textContent) && !$("fac-all").disabled && $("fac-all").textContent === "Enable for all factions (" + allCount() + ")", $("fac-all").textContent);
  search(NARROW.toLowerCase());
  check("with a search active it says 'shown'", /^Enable shown for all factions \(\d+\)$/.test($("fac-all").textContent), $("fac-all").textContent);
  click($("fac-all"));
  check("first click only asks for confirmation", /^Click again to enable \d+$/.test($("fac-all").textContent) && itemFactions(NARROW) === DEFAULTS[NARROW] && itemFactions(NARROW2) === DEFAULTS[NARROW2], $("fac-all").textContent);
  click($("fac-all"));
  check("second click ticks all three for the item shown only", itemFactions(NARROW) === "any" && facTicks(NARROW) === "bug,bot,squid" && rowOf(NARROW).classList.contains("fac-custom") && rowOf(NARROW2).hidden && itemFactions(NARROW2) === DEFAULTS[NARROW2], itemFactions(NARROW) + " / " + itemFactions(NARROW2) + " hidden=" + rowOf(NARROW2).hidden);
  check("...saved as an edit, and the edit survives a reload of the saved data", JSON.parse(win.localStorage.getItem("hd2_factions"))[NARROW].join() === "any");
  check("...and the per-item revert puts it back", (click(rowOf(NARROW).querySelector(".fac-revert")), itemFactions(NARROW) === DEFAULTS[NARROW]));
  search("");
  click($("fac-all")); click($("fac-all"));
  check("with no search it enables every item", allCount() === 0 && $("fac-all").disabled && /^Enable for all factions$/.test($("fac-all").textContent), $("fac-all").textContent);
  check("...and every enabled item now counts as edited", customCount() > 0 && /items edited/.test($("fac-count").textContent), $("fac-count").textContent);
  click($("fac-reset"));
  check("reset to defaults still undoes it (after its own confirmation)", /Click again to reset/.test($("fac-reset").textContent));
  click($("fac-reset"));
  check("...everything back on the CSV defaults", customCount() === 0 && itemFactions(NARROW) === DEFAULTS[NARROW] && allCount() > 0, $("fac-count").textContent);
  tick(facBox(LIB, "bug"), false);   // gives Reset something to do
  click($("fac-all"));
  click($("fac-reset"));
  check("arming one button cancels the other's confirmation", /^Enable for all factions \(\d+\)$/.test($("fac-all").textContent) && /^Click again to reset 1$/.test($("fac-reset").textContent), $("fac-all").textContent + " | " + $("fac-reset").textContent);
  click($("fac-reset"));
  check("(cleanup) back on the defaults", customCount() === 0);
  check("faction emblems are tinted per faction (unselected buttons + ticks + legend), dark when selected", (() => {
    const c = css; return ["bug", "bot", "squid"].every((f) => new RegExp('input\\[value="' + f + '"\\]:not\\(:checked\\) \\+ span \\.fac-icon[^{]*\\.fac-' + f + ' \\.fac-icon\\s*\\{[^}]*hue-rotate').test(c)) && /input:checked \+ span \.fac-icon\s*\{\s*filter: brightness\(0\)/.test(c);
  })());
  // faction emblems (linked from the wiki), with a letter / plain-text fallback if one fails to load
  const ICON = { bug: "Terminid_Icon.svg", bot: "Automaton_Icon.svg", squid: "Illuminate_Icon.svg" };
  const btnSpan = (f) => doc.querySelector('input[name="faction"][value="' + f + '"]').nextElementSibling;
  check("Terminid / Automaton / Illuminate buttons show their emblems", ["bug", "bot", "squid"].every((f) => { const im = btnSpan(f).querySelector("img.fac-icon"); return im && im.getAttribute("src") === "https://helldivers.wiki.gg/images/" + ICON[f]; }));
  check("the Any button shows the Super Earth emblem and keeps its text", (() => { const im = btnSpan("any").querySelector("img.fac-icon"); return im && im.getAttribute("src") === "https://helldivers.wiki.gg/images/Super_Earth_Icon.svg" && btnSpan("any").textContent === "Any" && /Terminids/.test(btnSpan("bug").textContent); })());
  check("the Any emblem is plain white when unselected (no tint rule) and dark when selected", !/value="any"\]:not/.test(css) && /input:checked \+ span \.fac-icon\s*\{\s*filter: brightness\(0\)/.test(css));
  const IMG = "https://helldivers.wiki.gg/images/";
  const wbIcons = () => { const o = {}; doc.querySelectorAll("#gear-list .wb-block").forEach((b) => { const im = b.querySelector(".wb-name img.wb-icon"); o[b.querySelector(".wb-name").textContent] = im ? im.getAttribute("src").replace(IMG, "") + (im.classList.contains("wb-icon-white") ? " (white)" : "") : null; }); return o; };
  const wi = wbIcons();
  check("Base Game gets the Super Earth emblem in white", wi["Base Game"] === "Super_Earth_Icon.svg (white)", wi["Base Game"]);
  check("the Requisition group header gets the Requisition Slip, in its own colours", wi["Requisition"] === "Requisition_Slip.svg", JSON.stringify(wi));
  check("...and the shops inside it carry no icon of their own", ["Patriotic Administration Center", "Orbital Cannons", "Hangar", "Bridge", "Engineering Bay", "Robotics Workshop"].every((n) => wi[n] === null), JSON.stringify(wi));
  check("Super Citizen Edition, Superstore and Campaign/Event Rewards get their icons", wi["Super Citizen Edition"] === "Super_Citizen_Title_Icon.svg" && wi["Superstore"] === "Super_Credit.svg" && wi["Campaign/Event Rewards"] === "Medal.svg", JSON.stringify(wi));
  check("on phones the warbond header puts the title first and the buttons on their own line", /@media \(max-width: 640px\)[\s\S]*\.wb-header \.wb-tools\s*\{[^}]*grid-column:\s*1 \/ -1/.test(css));
  check("the first six premium warbonds get their rank / title icons", wi["Helldivers Mobilize"] === "Level_50_Skull_Admiral_Rank_Icon.svg" && wi["Steeled Veterans"] === "Level_70_Admirable_Admiral_Rank_Icon.svg" && wi["Cutting Edge"] === "Level_90_Galactic_Commander_Rank_Icon.svg" && wi["Democratic Detonation"] === "Level_120_5-Star_General_Rank_Icon.svg" && wi["Polar Patriots"] === "Level_150_Super_Private_Rank_Icon.svg" && wi["Viper Commandos"] === "Viper_Commando_Title_Icon.svg", JSON.stringify(wi));
  check("the shop titles inside Requisition are Super Credit Blue and the Requisition header stays yellow", /\.wb-group-body \.wb-header \.wb-name\s*\{[^}]*color:\s*#70F5FF/i.test(css) && !/\.wb-group > \.wb-header \.wb-name[^}]*#70F5FF/i.test(css));
  check("Freedom's Flame, Chemical Agents and Truth Enforcers get their title icons", wi["Freedom's Flame"] === "Fire_Safety_Officer_Title_Icon.svg" && wi["Chemical Agents"] === "Expert_Exterminator_Title_Icon.svg" && wi["Truth Enforcers"] === "Free_of_Thought_Title_Icon.svg", JSON.stringify(wi));
  check("the next ten warbonds get their title icons", (() => { const want = { "Urban Legends": "Super_Pedestrian", "Servants of Freedom": "Servant_of_Freedom", "Borderline Justice": "Super_Sheriff", "Masters of Ceremony": "Decorated_Hero", "Force of Law": "Extra_Judicial", "Control Group": "Exemplary_Subject", "Halo: ODST": "Rookie", "Dust Devils": "Burier_of_Heads", "Python Commandos": "Python_Commando", "Killzone": "Assault_Infantry" }; return Object.keys(want).every((n) => wi[n] === want[n] + "_Title_Icon.svg"); })(), JSON.stringify(wi));
  check("Redacted Regiment, Siege Breakers, Entrenched Division and Exo Experts get their title icons", wi["Redacted Regiment"] === "Redacted_Title_Icon.svg" && wi["Siege Breakers"] === "Bunker_Buster_Title_Icon.svg" && wi["Entrenched Division"] === "Mudskipper_Title_Icon.svg" && wi["Exo Experts"] === "Exosuit_Certified_Title_Icon.svg", JSON.stringify(wi));
  check("Warhammer 40k, Ironclad Democracy and Scope of Authority get their (PNG) title icons", wi["Warhammer 40k"] === "Still_Standing_Title_Icon.png" && wi["Ironclad Democracy"] === "Treadhead_Title_Icon.png" && wi["Scope of Authority"] === "thumb/Longshot_Title_Icon.png/600px-Longshot_Title_Icon.png", JSON.stringify(wi));
  check("every warbond (and the Requisition group) now has an icon; only the shops inside Requisition don't", Object.keys(wi).filter((n) => !wi[n]).sort().join("|") === "Bridge|Engineering Bay|Hangar|Orbital Cannons|Patriotic Administration Center|Robotics Workshop", Object.keys(wi).filter((n) => !wi[n]).join("|"));
  check("PNG and SVG icons share one size rule (same height)", /\.wb-icon\s*\{[^}]*height:\s*1\.15em/.test(css));
  check("no other warbond has an icon", Object.keys(wi).filter((n) => wi[n] && !/^Requisition$|^Base Game$|^Super Citizen Edition$|^Superstore$|^Campaign\/Event Rewards$|^Helldivers Mobilize$|^Steeled Veterans$|^Cutting Edge$|^Democratic Detonation$|^Polar Patriots$|^Viper Commandos$|^Freedom's Flame$|^Chemical Agents$|^Truth Enforcers$|^Urban Legends$|^Servants of Freedom$|^Borderline Justice$|^Masters of Ceremony$|^Force of Law$|^Control Group$|^Halo: ODST$|^Dust Devils$|^Python Commandos$|^Killzone$|^Redacted Regiment$|^Siege Breakers$|^Entrenched Division$|^Exo Experts$|^Warhammer 40k$|^Ironclad Democracy$|^Scope of Authority$/.test(n)).length === 0);
  check("...and only Base Game's icon is recoloured", Object.keys(wi).filter((n) => /\(white\)/.test(wi[n] || "")).join() === "Base Game");
  check("if an icon fails to load the title is just the name", (() => { const n = Array.from(doc.querySelectorAll("#gear-list .wb-name")).find((x) => x.textContent === "Superstore"); n.querySelector("img").dispatchEvent(new win.Event("error")); return !n.querySelector("img") && n.textContent === "Superstore"; })());
  check("every item's T/A/I ticks use the emblems", Array.from(doc.querySelectorAll("#gear-list .fac-chk")).every((c) => { const im = c.querySelector("img.fac-icon"); return im && im.getAttribute("src").endsWith(ICON[["bug", "bot", "squid"].find((f) => c.classList.contains("fac-" + f))]); }));
  check("the legend shows the emblems too", doc.querySelectorAll("#fac-tools .fac-legend img.fac-icon").length === 3);
  const chipImg = doc.querySelector("#gear-list .fac-chk.fac-bot img.fac-icon");
  const chipLabel = chipImg.closest(".fac-chk");
  chipImg.dispatchEvent(new win.Event("error"));
  check("if an emblem can't load, the tick falls back to its letter", chipLabel.textContent.trim() === "A" && !chipLabel.querySelector("img"), chipLabel.textContent);
  const btnImg = btnSpan("squid").querySelector("img.fac-icon");
  btnImg.dispatchEvent(new win.Event("error"));
  check("...and a faction button falls back to plain text", !btnSpan("squid").querySelector("img") && btnSpan("squid").textContent === "Illuminate", btnSpan("squid").textContent);
  check("the fallback doesn't break the checkbox", (() => { const b = chipLabel.querySelector("input"); const was = b.checked; tick(b, !was); const ok = b.checked === !was; tick(b, was); return ok; })());
  $("edit-factions").checked = false; $("edit-factions").dispatchEvent(new win.Event("change", { bubbles: true }));
  check("switching it off hides the tools again", $("fac-tools").hidden === true && !$("view-gear").classList.contains("edit-factions"));
  // edits survive a reload and are applied when the page starts
  const dom2 = new JSDOM(bundleHtml, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
    beforeParse(w) { w.localStorage.setItem("hd2_factions", JSON.stringify({ [CONC]: ["bot"], [LIB]: [], "No Such Item": ["bug"], "Eagle Airstrike": ["nonsense"] })); },
  });
  await new Promise((resolve) => dom2.window.addEventListener("load", resolve));
  const d2 = dom2.window.document, items2 = dom2.window.HD2_DATA.items;
  const f2 = (n) => items2.find((i) => i.name === n).factions.join(",");
  check("a reloaded page applies the saved edits", f2(CONC) === "bot" && f2(LIB) === "", f2(CONC) + " / " + f2(LIB));
  check("...ignores unknown items and invalid values", f2("Eagle Airstrike") === defaultOf("Eagle Airstrike"));
  check("...and notes the 2 edits on the Randomizer tab", /edited faction lists \(2 items\)/.test(d2.getElementById("pool-text").textContent), d2.getElementById("pool-text").textContent);
  dom2.window.close();
  // edited rules survive a reload too; damaged saved rules are skipped
  const dom4 = new JSDOM(bundleHtml, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
    beforeParse(w) {
      w.localStorage.setItem("hd2_settings", JSON.stringify({ faction: "any", disabledRules: ["capMine", "balance", "nonsense"],
        requirements: { eagle: { min: 3 }, sentry: { min: 0, max: 0 }, "no such tag": { min: 1 }, chaff: { min: 5, max: 2 }, med: { min: "x" }, armor: { min: 99 } } }));
    },
  });
  await new Promise((resolve) => dom4.window.addEventListener("load", resolve));
  const d4 = dom4.window.document;
  const texts4 = Array.from(d4.querySelectorAll("#require-chips .chip")).map((c) => c.firstChild.textContent);
  check("a reloaded page restores edited rows, the removed default and the added rules", texts4.join("|") === "Backpack = 1|Anti-Tank ≥ 1|Medium Killer ≥ 1|Base Breaker ≥ 1|Panic Weapon ≥ 1|Vehicle ≤ 1|Eagle ≥ 3|Sentry = 0", texts4.join("|"));
  check("...and skips damaged saved rules (unknown tag, min above max, not a number, too big)", !texts4.some((t) => /no such|Chaff|99/.test(t)) && texts4.filter((t) => /Medium/.test(t)).length === 1);
  check("...with the reset buttons and the summary showing what differs", !d4.getElementById("presets-reset").hidden && !d4.getElementById("rules-reset").hidden && /1 added, 1 edited, 2 off/.test(d4.getElementById("rules-summary").textContent), d4.getElementById("rules-summary").textContent);
  dom4.window.close();
  click(doc.querySelector('.tab[data-view="randomizer"]'));

  console.log("Saved images");
  {
    // a page whose data lists saved copies: those are used for every kind of picture; anything not listed keeps its wiki link
    const WIKI = "https://helldivers.wiki.gg/images/";
    const libUrl = win.HD2_DATA.items.find((i) => i.name === "AR-23 Liberator").imgUrl;
    const map = { [libUrl]: "img/items/lib.webp", [WIKI + "Armor_AP2_Icon.png"]: "img/icons/Armor_AP2_Icon.png", [WIKI + "Terminid_Icon.svg"]: "img/icons/Terminid_Icon.svg", [WIKI + "Super_Earth_Icon.svg"]: "img/icons/Super_Earth_Icon.svg" };
    const html = bundleHtml;
    check("(the bundle has an empty image list to swap)", html.includes('"images": {}'));
    const dom3 = new JSDOM(html.replace('"images": {}', '"images": ' + JSON.stringify(map)), { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
    await new Promise((resolve) => dom3.window.addEventListener("load", resolve));
    const w3 = dom3.window, d3 = w3.document;
    w3.HTMLElement.prototype.scrollIntoView = function () {};
    const srcs = (sel) => Array.from(d3.querySelectorAll(sel)).map((i) => i.getAttribute("src"));
    check("My Gear thumbnails use the saved copy when there is one", d3.querySelector('#gear-list input[data-item="AR-23 Liberator"]').closest(".gear-row").querySelector("img.gear-thumb").getAttribute("src") === "img/items/lib.webp");
    check("...and keep the wiki link for an item that isn't saved", d3.querySelector('#gear-list input[data-item="AR-23P Liberator Penetrator"]').closest(".gear-row").querySelector("img.gear-thumb").getAttribute("src").startsWith(WIKI));
    check("faction emblems and the Base Game icon use the saved copies", srcs(".fac-icon").some((x) => x === "img/icons/Terminid_Icon.svg") && srcs(".wb-icon").some((x) => x === "img/icons/Super_Earth_Icon.svg"), srcs(".fac-icon").join());
    w3.document.querySelector("#lock-primary").value = "SMG/FLAM-34 Stoker";
    w3.document.getElementById("controls").dispatchEvent(new w3.Event("submit", { bubbles: true, cancelable: true }));
    check("loadout cards use the saved armor-penetration icon", srcs("#results .ap-icon").includes("img/icons/Armor_AP2_Icon.png") && srcs("#results .ap-icon").some((x) => x.startsWith(WIKI)), srcs("#results .ap-icon").join());
    dom3.window.close();
    // the real bundle (nothing swapped): if images are saved, it carries them inside the file
    if (/"images": \{\n/.test(rawBundle)) {
      const domR = new JSDOM(rawBundle, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
      await new Promise((resolve) => domR.window.addEventListener("load", resolve));
      const dr = domR.window.document;
      const thumbs = Array.from(dr.querySelectorAll("#gear-list img.gear-thumb")).map((i) => i.getAttribute("src"));
      const saved = Object.keys(domR.window.HD2_DATA.images).length;
      check("the single-file build shows every saved picture from inside the file (no network needed)", saved > 0 && thumbs.length === ACTIVE && thumbs.filter((t) => t.startsWith("data:image/")).length >= 150, thumbs.filter((t) => t.startsWith("data:image/")).length + " of " + thumbs.length + " thumbnails are embedded");
      domR.window.close();
    }
  }

  console.log("Reset");
  click($("reset-all"));
  check("reset restores faction any + 1 loadout", doc.querySelector('input[name="faction"]:checked').value === "any" && $("count").value === "1");
  check("reset switches default rules back on, restores the default rows and clears added rules", engRules.every((r) => sw(r.id).checked) && chipTexts().join("|") === DEFAULT_ROWS.join("|") && JSON.parse(win.localStorage.getItem("hd2_settings")).disabledRules.length === 0);
  check("...but leaves My Gear alone", blockBtn("AC-8 Autocannon").getAttribute("aria-pressed") === "true" && $("grand-total").textContent === ACTIVE + " / " + ACTIVE + " items owned");

  console.log(failed ? "\n" + failed + " check(s) FAILED" : "\nAll UI checks passed");
  process.exit(failed ? 1 : 0);
})();
