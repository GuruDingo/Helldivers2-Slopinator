/*
 * Helldivers 2 Slopinator - browser UI.
 * Reads the gear (gear-data.js), asks the engine (engine.js) for loadouts, and draws them.
 * Everything runs in the visitor's browser; nothing is sent anywhere.
 */
(function () {
  "use strict";

  var DATA = globalThis.HD2_DATA;
  var Engine = globalThis.HD2Engine;
  var engine = Engine.create(DATA);

  // ---------------------------------------------------------------------------
  // Display configuration (the same labels/colours the Python HTML output used)
  // ---------------------------------------------------------------------------
  var FACTION_NAMES = { bug: "Terminids", bot: "Automatons", squid: "Illuminate", any: "Any" };
  var FACTION_ADJECTIVE = { bug: "Terminid", bot: "Automaton", squid: "Illuminate" };
  var TYPE_LABELS = {
    support: "Support Weapon", backpack: "Backpack", vehicle: "Vehicle", eagle: "Eagle",
    orbital: "Orbital", sentry: "Sentry", defensive: "Emplacement",
  };
  var WEAPON_CAT_LABELS = { primary: "Primary", secondary: "Secondary", throwable: "Throwable" };
  // Display titles. Only tags listed here appear in the "Additional rules" dropdown; a tag with no title here
  // still works in the data and the rules, it just isn't offered (and gets no pill).
  var TAG_NAMES = {
    melee: "Melee", expendable: "Expendable", chaff: "Chaff Killer", med: "Medium Killer", armor: "Anti-Tank",
    demo: "Base Breaker", panic: "Panic Weapon", assist: "Team Assist", backpack: "Backpack",
    fire: "Fire", stealth: "Stealth", orbital: "Orbital", eagle: "Eagle", sentry: "Sentry",
    gas: "Gas", vehicle: "Vehicle", arc: "Arc",
    explosive: "Explosive", laser: "Laser", plasma: "Plasma", handheld: "Hand-Held Shield", mines: "Mines",
  };
  // Order here = order of the pills on a card. Tags not listed here still work in the rules,
  // they just don't get a pill. (Pills need a title in TAG_NAMES above too.)
  // The three "crayon" pills follow the enemy-level colours: Chaff green, Medium blue, Anti-Tank red. They are deliberately
  // a little different from the green / blue / red of the stratagem icons (#699655 / #55b9d2 / #dc6455) so the two don't blur.
  var TAG_COLORS = {
    melee: "#382E02", expendable: "#0F0D02", chaff: "#27ae32", med: "#2f80ed", armor: "#c62828",
    demo: "#4b058d", panic: "#2943b9", assist: "#d6336c", backpack: "#555555",
    // The "meme" tags (elemental / themed builds) all get pills, and so do any meme tags added later: fire, gas, arc,
    // stealth, explosive, laser, plasma. Colours are first guesses, one hue family per tag.
    fire: "#c8541a", gas: "#7d8a1d", arc: "#0c8a96", stealth: "#37474f", explosive: "#a0700a",
    laser: "#8a8210", plasma: "#8f3fe0",
  };
  var TYPE_COLORS = {
    support: "#011419", backpack: "#011419", vehicle: "#011419",
    eagle: "#190301", orbital: "#190301", sentry: "#081901", defensive: "#081901",
  };
  // Accent colour per faction (the page's accent follows the selected faction; "any" is Super Credit Blue).
  var FACTION_COLORS = { any: "#70F5FF", bug: "#FF8D1F", bot: "#FF6161", squid: "#CD8AEA" };
  var MAX_COUNT = 20;
  var MAX_RULE_COUNT = 7;   // largest count a rule can ask for (a loadout has 7 slots)

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }

  // h("div", {class: "x"}, child, "text") -> element. Text is always added as text (never HTML),
  // so item names from the CSV can't inject markup.
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }

  // localStorage can be missing or blocked (private windows, strict settings): never let that break the page.
  var store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
    remove: function (key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };
  var SETTINGS_KEY = "hd2_settings";   // randomizer settings: { faction, disabledRules, requirements }
  var TRACKER_KEY = "hd2_tracker";     // items you own: { "Item Name": true }. Missing key = new browser = own everything.
  var FACTIONS_KEY = "hd2_factions";   // your faction edits: { "Item Name": ["bug","bot"] } (only items that differ from the CSV)
  var BLOCK_KEY = "hd2_blocked";       // items you have blocked: ["Item Name", ...]

  var warbondName = {};
  DATA.warbonds.forEach(function (w) { warbondName[w.key] = w.name; });
  // Shorter label for the pill on a loadout card (the warbond lists and the tracker keep the full names).
  var warbondPillName = {
    req_p: "Requisition", req_o: "Requisition", req_h: "Requisition",
    req_b: "Requisition", req_e: "Requisition", req_r: "Requisition"
  };

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  function showView(name) {
    ["randomizer", "gear"].forEach(function (v) { $("view-" + v).hidden = v !== name; });
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.getAttribute("data-view") === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { showView(t.getAttribute("data-view")); });
  });

  // ---------------------------------------------------------------------------
  // Loadout cards
  // ---------------------------------------------------------------------------
  // Every picture goes through here: the saved copy in docs/img/ (listed in HD2_DATA.images by
  // tools/fetch_images.py + build_gear.py) when there is one, otherwise the wiki address it was given.
  function imgSrc(url) {
    var saved = globalThis.HD2_DATA && HD2_DATA.images;
    return (saved && saved[url]) || url;
  }

  function imageNode(item) {
    if (!item.imgUrl) return h("div", { class: "img-placeholder" }, "No image");
    var img = h("img", {
      src: imgSrc(item.imgUrl), alt: item.name, class: "item-img", loading: "lazy", referrerpolicy: "no-referrer",
    });
    img.addEventListener("error", function () { img.replaceWith(h("div", { class: "img-placeholder" }, "No image")); });
    return img;
  }

  // Small picture for a My Gear row: lazy-loaded (rows inside a closed warbond don't fetch anything), and a blank
  // square of the same size if there is no image or it can't load, so the names stay lined up.
  function gearThumb(item) {
    if (!item.imgUrl) return h("span", { class: "gear-thumb gear-thumb-blank", "aria-hidden": "true" });
    var img = h("img", { src: imgSrc(item.imgUrl), alt: "", class: "gear-thumb", loading: "lazy", referrerpolicy: "no-referrer" });
    img.addEventListener("error", function () { img.replaceWith(h("span", { class: "gear-thumb gear-thumb-blank", "aria-hidden": "true" })); });
    return img;
  }

  function tagPills(item) {
    return Object.keys(TAG_COLORS)
      .filter(function (tag) { return Engine.has(item, tag); })
      .map(function (tag) {
        return h("span", { class: "tag-pill", style: "background:" + TAG_COLORS[tag] }, TAG_NAMES[tag] || tag.toUpperCase());
      });
  }

  // Armor penetration: the wiki's own icon for each level a weapon has, side by side when it has two (e.g. a
  // rifle and its underbarrel launcher). Linked from the wiki like the other images; if one can't load, the level's
  // name is shown as text instead.
  var AP_NAMES = {
    "-1": "No hitbox", 0: "Unarmored", 1: "Very light", 2: "Light", 3: "Medium", 4: "Heavy", 5: "Anti-tank I",
    6: "Anti-tank II", 7: "Anti-tank III", 8: "Anti-tank IV", 9: "Anti-tank V", 10: "Anti-tank VI", 11: "Indestructible",
  };
  function apIconUrl(n) { return "https://helldivers.wiki.gg/images/Armor_AP" + n + "_Icon.png"; }
  function apRow(item) {
    var levels = item.armorPen || [];
    if (!levels.length) return null;
    var row = h("div", { class: "ap-row", title: "Armor penetration: " + levels.map(function (n) { return AP_NAMES[n] || ("AP" + n); }).join(" / ") });
    levels.forEach(function (n, i) {
      var name = AP_NAMES[n] || ("AP" + n);
      if (i) row.appendChild(h("span", { class: "ap-sep", "aria-hidden": "true" }, "/"));
      var img = h("img", { src: imgSrc(apIconUrl(n)), alt: "Armor penetration: " + name, class: "ap-icon", loading: "lazy", referrerpolicy: "no-referrer" });
      img.addEventListener("error", function () { img.replaceWith(h("span", { class: "ap-text" }, name)); });
      row.appendChild(img);
    });
    return row;
  }

  function itemCard(item, slotLabel, opts) {
    var locked = opts.locked, suboptimal = opts.suboptimal;
    var cls = (opts.wide ? "item-card2" : "item-card") + (suboptimal ? " suboptimal" : "") + (locked ? " is-locked" : "");
    var warbondRow = item.warbond !== "base"
      ? h("div", { class: "warbond-row" },
          h("span", { class: "tag-pill", style: "background:#2a2a2a;border:1px solid #555" }, warbondPillName[item.warbond] || warbondName[item.warbond] || item.warbond))
      : null;
    // Lock and reroll controls only exist on cards that belong to a generated loadout (opts.onLock / opts.onReroll).
    var lockBtn = opts.onLock
      ? h("button", {
          type: "button", class: "slot-btn lock-btn", "aria-pressed": locked ? "true" : "false",
          title: locked ? "Unlock this slot" : "Lock this slot (kept when you reroll)",
          "aria-label": (locked ? "Unlock " : "Lock ") + slotLabel + ": " + item.name,
          onclick: opts.onLock,
        }, locked ? "\uD83D\uDD12" : "\uD83D\uDD13")
      : null;
    var rerollBtn = opts.onReroll
      ? h("button", {
          type: "button", class: "slot-btn reroll-btn", disabled: locked ? true : null,
          title: locked ? "Unlock this slot to reroll it" : "Reroll just this slot",
          "aria-label": "Reroll " + slotLabel + ": " + item.name,
          onclick: opts.onReroll,
        }, "\uD83C\uDFB2")
      : null;
    return h("div", { class: cls },
      h("div", { class: "card-header", style: "background:" + (TYPE_COLORS[item.cat] || "#363426") },
        h("span", { class: "slot-label" }, slotLabel),
        suboptimal ? h("span", { class: "suboptimal-badge" }, "\u26A0 OFF-FACTION") : null,
        h("span", { class: "slot-btns" }, rerollBtn, lockBtn)),
      imageNode(item),
      h("div", { class: "card-body" },
        h("div", { class: "name-row" }, h("div", { class: "item-name" }, item.name), apRow(item)),
        warbondRow,
        h("div", { class: "tag-row" }, tagPills(item))));
  }

  // Plain-language text for a rule the engine reported as unmet.
  function ruleText(u) {
    if (u.id === "require") {
      return "Rule: " + u.how + " " + (TAG_NAMES[u.tag] || u.tag) + " (this build has " + u.actual + ")";
    }
    return u.label;
  }

  // ---- Generated results: each loadout keeps its own per-slot locks ----
  // lastRun = { faction, requirements, disabledRules, entries: [{ lo, locks, node }] }. Locks start as whatever was typed into the
  // Locks panel; lock/unlock on a card only affects that loadout. Rerolls reuse the faction and requirements the
  // loadouts were generated with, but read your gear pool (My Gear) as it is now.
  var SLOT_KEYS = ["primary", "secondary", "throwable", "strat1", "strat2", "strat3", "strat4"];
  var lastRun = null;

  function itemAt(lo, key) {
    if (key.indexOf("strat") === 0) return lo.strategems[parseInt(key.slice(5), 10) - 1];
    return lo[key];
  }

  function loadoutNode(entry, idx, total) {
    var lo = entry.lo, locks = entry.locks, faction = lastRun.faction;
    var label = FACTION_NAMES[faction] || faction;
    function isOff(item) { return lo.suboptimalNames.has(item.name); }
    function card(key, slotLabel, extra) {
      var item = itemAt(lo, key);
      var opts = { locked: !!locks[key], suboptimal: isOff(item), wide: !!(extra && extra.wide),
        onLock: function () { toggleLock(entry, key); },
        onReroll: function () { rerollSlot(entry, key); } };
      return itemCard(item, slotLabel, opts);
    }
    var unlockedCount = SLOT_KEYS.filter(function (k) { return !locks[k]; }).length;

    var box = h("div", { class: "loadout", "data-idx": String(idx) });
    var title = total > 1 ? "Loadout " + (idx + 1) : "Loadout";
    box.appendChild(h("div", { class: "loadout-bar" },
      total > 1 ? h("h2", null, title) : h("span", { class: "loadout-bar-title" }, title),
      h("button", {
        type: "button", class: "ctrl-btn reroll-all-btn", disabled: unlockedCount ? null : true,
        title: unlockedCount ? "Keep the locked slots, reroll all the others" : "Every slot is locked",
        onclick: function () { rerollUnlocked(entry); },
      }, "\uD83C\uDFB2 Reroll all unlocked (" + unlockedCount + ")")));
    if (lo.factionOverridden) {
      box.appendChild(h("div", { class: "faction-warning" },
        "\u26A0 Couldn\u2019t build a valid " + label + " loadout with the current warbonds/locks, so the faction " +
        "restriction was relaxed to fill this one out. Items marked ",
        h("span", { class: "suboptimal-badge" }, "\u26A0 OFF-FACTION"),
        " below aren\u2019t ideal picks against " + label + "."));
    }
    if (lo.unmet && lo.unmet.length) {
      box.appendChild(h("div", { class: "rules-warning" },
        "\u26A0 This loadout couldn\u2019t meet every guarantee with the current locks and filters, so it was completed " +
        "without these (everything else still applies):",
        h("ul", null, lo.unmet.map(function (u) { return h("li", null, ruleText(u)); }))));
    }
    box.appendChild(h("h3", { class: "section-title" }, "Weapons"));
    box.appendChild(h("div", { class: "card-row" },
      card("primary", "Primary", { wide: true }),
      card("secondary", "Secondary"),
      card("throwable", "Throwable")));
    box.appendChild(h("h3", { class: "section-title" }, "Stratagems"));
    box.appendChild(h("div", { class: "card-row" },
      lo.strategems.map(function (st, i) { return card("strat" + (i + 1), TYPE_LABELS[st.cat] || st.cat); })));
    box.appendChild(h("hr", { class: "divider" }));
    return box;
  }

  function renderLoadouts(loadouts, faction, locks, requirements, disabledRules) {
    var results = $("results");
    results.textContent = "";
    // Results keep the colour of the faction they were generated for, even if you switch faction afterwards.
    results.style.setProperty("--accent", FACTION_COLORS[faction] || FACTION_COLORS.any);
    lastRun = { faction: faction, requirements: JSON.parse(JSON.stringify(requirements)), disabledRules: (disabledRules || []).slice(), entries: [] };
    loadouts.forEach(function (lo, idx) {
      var entry = { lo: lo, locks: Object.assign({}, locks), node: null };
      lastRun.entries.push(entry);
      entry.node = loadoutNode(entry, idx, loadouts.length);
      results.appendChild(entry.node);
    });
  }

  // Redraws one loadout in place (the page doesn't jump to the top).
  function redraw(entry) {
    var idx = lastRun.entries.indexOf(entry);
    var node = loadoutNode(entry, idx, lastRun.entries.length);
    entry.node.replaceWith(node);
    entry.node = node;
  }

  function toggleLock(entry, key) {
    if (entry.locks[key]) delete entry.locks[key]; else entry.locks[key] = itemAt(entry.lo, key);
    redraw(entry);
  }

  // `callLocks` = the slots to hold fixed for this one build; `avoid` = the item being replaced (so a reroll
  // actually changes it when another choice exists).
  function rebuild(entry, callLocks, avoid, what) {
    var excluded = excludedNames();
    // Anything held fixed stays even if you blocked it since (it's already on screen).
    Object.keys(callLocks).forEach(function (k) { excluded.delete(callLocks[k].name); });
    var base = { faction: lastRun.faction, locks: callLocks, requirements: lastRun.requirements, disabledRules: lastRun.disabledRules };
    var lo = null, note = null;
    try {
      var ex = new Set(excluded);
      if (avoid) ex.add(avoid.name);
      base.excluded = ex;
      lo = engine.generateLoadoutRelaxed(base);
    } catch (e) {
      if (!(e instanceof Engine.GenerationError)) throw e;
      if (!avoid) { showMessages([e.message]); return; }
      try {
        base.excluded = excluded;
        lo = engine.generateLoadoutRelaxed(base);
        note = "There is no other " + what + " available with your current gear, locks and requirements.";
      } catch (e2) {
        if (!(e2 instanceof Engine.GenerationError)) throw e2;
        showMessages([e2.message]); return;
      }
    }
    entry.lo = lo;
    showMessages(note ? [note] : [], "info");
    redraw(entry);
  }

  function rerollSlot(entry, key) {
    if (entry.locks[key]) return;
    var callLocks = {};
    SLOT_KEYS.forEach(function (k) { if (k !== key) callLocks[k] = itemAt(entry.lo, k); });
    rebuild(entry, callLocks, itemAt(entry.lo, key), "item for this slot");
  }

  function rerollUnlocked(entry) {
    var callLocks = Object.assign({}, entry.locks);
    if (Object.keys(callLocks).length === SLOT_KEYS.length) return;
    rebuild(entry, callLocks, null, "");
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  function showMessages(list, kind) {
    var box = $("messages");
    box.textContent = "";
    list.forEach(function (text) { box.appendChild(h("div", { class: "msg " + (kind || "error") }, text)); });
  }

  // ---------------------------------------------------------------------------
  // Control panel state
  // ---------------------------------------------------------------------------
  var state = {
    requirements: {},    // tag -> { min?, max? }  (the "Additional rules")
    disabledRules: {},   // default rule id -> true when switched off
  };

  // ---- My Gear model: what you own (item level) and what you have blocked ----
  // The randomizer's pool = owned and not blocked. Base Game gear is always owned.
  var ALL_ITEMS = [].concat(engine.pools.primaries, engine.pools.secondaries, engine.pools.throwables, engine.pools.strategems)
    .filter(function (i) { return i.factions.indexOf("none") === -1; });
  var owned = {};   // name -> true (doesn't hold Base Game items; they are always owned)
  var blocked = {}; // name -> true: never rolled, even if owned
  var gearRows = {}; // item name -> its row in the My Gear list (filled by buildGear)

  // ---- Editable faction lists ----
  // Each item's CSV "factions" are the defaults. "Edit factions" (My Gear tab) lets you tick which of Terminid /
  // Automaton / Illuminate an item is recommended against. We write the result straight into item.factions, which
  // the engine reads live. All three ticked is stored as ["any"]; none ticked is [] (the item then only rolls when
  // the faction is Any). Only items that differ from the defaults are saved.
  var FAC_KEYS = ["bug", "bot", "squid"];
  var FAC_LETTER = { bug: "T", bot: "A", squid: "I" };
  // Faction emblems, linked from the Helldivers wiki like the item images (same hotlinking decision). If one
  // can't load (offline, blocked), the chip falls back to a letter and the faction button to plain text.
  var FAC_ICON_URL = {
    bug: "https://helldivers.wiki.gg/images/Terminid_Icon.svg",
    bot: "https://helldivers.wiki.gg/images/Automaton_Icon.svg",
    squid: "https://helldivers.wiki.gg/images/Illuminate_Icon.svg",
    any: "https://helldivers.wiki.gg/images/Super_Earth_Icon.svg",
  };
  // Small icons beside warbond titles in My Gear (hotlinked from the wiki). They keep their own colours, except
  // Base Game, which uses the Super Earth emblem drawn flat white. A warbond not listed here has no icon.
  var WIKI_IMG = "https://helldivers.wiki.gg/images/";
  var REQ_ICON = WIKI_IMG + "Requisition_Slip.svg";
  var WARBOND_ICONS = {
    base:          { url: WIKI_IMG + "Super_Earth_Icon.svg", white: true },
    super_citizen: { url: WIKI_IMG + "Super_Citizen_Title_Icon.svg" },
    req_p: { url: REQ_ICON }, req_o: { url: REQ_ICON }, req_h: { url: REQ_ICON },
    req_b: { url: REQ_ICON }, req_e: { url: REQ_ICON }, req_r: { url: REQ_ICON },
    superstore:    { url: WIKI_IMG + "Super_Credit.svg" },
    fomo:          { url: WIKI_IMG + "Medal.svg" },
    helldivers_mobilize:   { url: WIKI_IMG + "Level_50_Skull_Admiral_Rank_Icon.svg" },
    steeled_veterans:      { url: WIKI_IMG + "Level_70_Admirable_Admiral_Rank_Icon.svg" },
    cutting_edge:          { url: WIKI_IMG + "Level_90_Galactic_Commander_Rank_Icon.svg" },
    democratic_detonation: { url: WIKI_IMG + "Level_120_5-Star_General_Rank_Icon.svg" },
    polar_patriots:        { url: WIKI_IMG + "Level_150_Super_Private_Rank_Icon.svg" },
    viper_commandos:       { url: WIKI_IMG + "Viper_Commando_Title_Icon.svg" },
    freedoms_flame:        { url: WIKI_IMG + "Fire_Safety_Officer_Title_Icon.svg" },
    chemical_agents:       { url: WIKI_IMG + "Expert_Exterminator_Title_Icon.svg" },
    truth_enforcers:       { url: WIKI_IMG + "Free_of_Thought_Title_Icon.svg" },
    urban_legends:         { url: WIKI_IMG + "Super_Pedestrian_Title_Icon.svg" },
    servants_of_freedom:   { url: WIKI_IMG + "Servant_of_Freedom_Title_Icon.svg" },
    borderline_justice:    { url: WIKI_IMG + "Super_Sheriff_Title_Icon.svg" },
    masters_of_ceremony:   { url: WIKI_IMG + "Decorated_Hero_Title_Icon.svg" },
    force_of_law:          { url: WIKI_IMG + "Extra_Judicial_Title_Icon.svg" },
    control_group:         { url: WIKI_IMG + "Exemplary_Subject_Title_Icon.svg" },
    odst:                  { url: WIKI_IMG + "Rookie_Title_Icon.svg" },
    dust_devils:           { url: WIKI_IMG + "Burier_of_Heads_Title_Icon.svg" },
    python_commandos:      { url: WIKI_IMG + "Python_Commando_Title_Icon.svg" },
    redacted_regiment:     { url: WIKI_IMG + "Redacted_Title_Icon.svg" },
    siege_breakers:        { url: WIKI_IMG + "Bunker_Buster_Title_Icon.svg" },
    entrenched_division:   { url: WIKI_IMG + "Mudskipper_Title_Icon.svg" },
    exo_experts:           { url: WIKI_IMG + "Exosuit_Certified_Title_Icon.svg" },
    "40k":                 { url: WIKI_IMG + "Still_Standing_Title_Icon.png" },
    ironclad_democracy:    { url: WIKI_IMG + "Treadhead_Title_Icon.png" },
    scope_of_authority:    { url: WIKI_IMG + "thumb/Longshot_Title_Icon.png/600px-Longshot_Title_Icon.png" },
    killzone:              { url: WIKI_IMG + "Assault_Infantry_Title_Icon.svg" }, // the Killzone collab warbond is the wiki's "Righteous Revenants"
  };
  function warbondIcon(key) {
    var def = WARBOND_ICONS[key];
    if (!def) return null;
    var img = h("img", { src: imgSrc(def.url), alt: "", class: "wb-icon" + (def.white ? " wb-icon-white" : ""), referrerpolicy: "no-referrer", "aria-hidden": "true" });
    img.addEventListener("error", function () { img.remove(); }); // can't load: the title is just its name
    return img;
  }
  function facIcon(f, fallbackText) {
    var img = h("img", { src: imgSrc(FAC_ICON_URL[f]), alt: "", class: "fac-icon", referrerpolicy: "no-referrer", "aria-hidden": "true" });
    img.addEventListener("error", function () {
      img.replaceWith(fallbackText ? h("span", { class: "fac-icon-fallback" }, fallbackText) : document.createTextNode(""));
    });
    return img;
  }
  var defaultFactions = {};  // name -> the CSV's factions list
  var facOverrides = {};     // name -> factions list that replaces the default
  ALL_ITEMS.forEach(function (i) { defaultFactions[i.name] = i.factions.slice(); });

  function facFlags(list) {  // [bug, bot, squid] booleans, same rule as Engine.worksFor
    if (list.length === 1 && list[0] === "any") return [true, true, true];
    return FAC_KEYS.map(function (f) { return list.indexOf(f) !== -1; });
  }
  function facList(flags) {
    return flags.every(Boolean) ? ["any"] : FAC_KEYS.filter(function (f, i) { return flags[i]; });
  }
  function isCustomised(item) { return Object.prototype.hasOwnProperty.call(facOverrides, item.name); }
  function customisedCount() { return ALL_ITEMS.filter(isCustomised).length; }
  function applyFactions() {
    ALL_ITEMS.forEach(function (i) {
      i.factions = isCustomised(i) ? facOverrides[i.name].slice() : defaultFactions[i.name].slice();
    });
  }
  function loadFactions() {
    facOverrides = {};
    var saved = store.get(FACTIONS_KEY, null);
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      ALL_ITEMS.forEach(function (i) {
        var v = saved[i.name];
        if (Array.isArray(v) && v.every(function (f) { return f === "any" || FAC_KEYS.indexOf(f) !== -1; })) {
          facOverrides[i.name] = facList(facFlags(v));
        }
      });
    }
    applyFactions();
  }
  function setItemFactions(item, flags) {
    var def = facFlags(defaultFactions[item.name]);
    if (flags.every(function (v, k) { return v === def[k]; })) delete facOverrides[item.name];
    else facOverrides[item.name] = facList(flags);
    applyFactions();
  }
  function saveFactions() { store.set(FACTIONS_KEY, facOverrides); }
  function onFactionEdit() { saveFactions(); refreshGear(); }
  // Back to the CSV defaults for items on screen (the search filter applies, like the other bulk buttons).
  function resetFactions(items) {
    shownOnly(items).forEach(function (i) { delete facOverrides[i.name]; });
    applyFactions();
    onFactionEdit();
  }

  function isBase(item) { return item.warbond === "base"; }
  function isOwned(item) { return isBase(item) || !!owned[item.name]; }
  function inPool(item) { return isOwned(item) && !blocked[item.name]; }

  function loadGear() {
    var saved = store.get(TRACKER_KEY, null);
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      owned = saved;
    } else {
      // First visit in this browser: start with everything owned (people untick what they lack).
      owned = {};
      ALL_ITEMS.forEach(function (i) { if (!isBase(i)) owned[i.name] = true; });
      store.set(TRACKER_KEY, owned);
    }
    blocked = {};
    var n = store.get(BLOCK_KEY, []);
    if (Array.isArray(n)) n.forEach(function (name) { blocked[name] = true; });
  }
  function saveGear() {
    store.set(TRACKER_KEY, owned);
    store.set(BLOCK_KEY, Object.keys(blocked));
  }
  // Counts over the items valid for a faction (omit the faction to count every item).
  function poolStats(faction) {
    var st = { total: 0, owned: 0, blocked: 0, pool: 0 };
    ALL_ITEMS.forEach(function (i) {
      if (faction && !Engine.worksFor(i, faction)) return;
      st.total++;
      if (isOwned(i)) { st.owned++; if (blocked[i.name]) st.blocked++; }
      if (inPool(i)) st.pool++;
    });
    return st;
  }
  // Names the engine must not roll: everything outside the pool.
  function excludedNames() {
    return new Set(ALL_ITEMS.filter(function (i) { return !inPool(i); }).map(function (i) { return i.name; }));
  }
  // The pool line on the Randomizer tab counts only what the selected faction can use
  // (items marked "any" included), so "of N" changes with the faction.
  function updatePoolLine() {
    var faction = selectedFaction();
    var st = poolStats(faction);
    var box = $("pool-text");
    box.textContent = "";
    box.appendChild(document.createTextNode("Rolling from "));
    box.appendChild(h("strong", null, String(st.pool)));
    box.appendChild(document.createTextNode(" of " + st.total + (faction === "any" ? "" : " " + FACTION_ADJECTIVE[faction] + "-compatible") + " items"));
    var bits = [];
    if (st.total - st.owned) bits.push((st.total - st.owned) + " not owned");
    if (st.blocked) bits.push(st.blocked + " blocked");
    if (bits.length) box.appendChild(document.createTextNode(" (" + bits.join(", ") + ")."));
    else box.appendChild(document.createTextNode("."));
    var custom = customisedCount();
    if (custom) box.appendChild(document.createTextNode(" Using your edited faction lists (" + custom + " item" + (custom === 1 ? "" : "s") + ")."));
  }

  // ---- Locks ----
  var LOCK_SLOTS = [
    { key: "primary", label: "Primary", list: "dl-primary", cats: ["primary"] },
    { key: "secondary", label: "Secondary", list: "dl-secondary", cats: ["secondary"] },
    { key: "throwable", label: "Throwable", list: "dl-throwable", cats: ["throwable"] },
    { key: "strat1", label: "Stratagem 1", list: "dl-strat", cats: Engine.STRATAGEM_CATEGORIES },
    { key: "strat2", label: "Stratagem 2", list: "dl-strat", cats: Engine.STRATAGEM_CATEGORIES },
    { key: "strat3", label: "Stratagem 3", list: "dl-strat", cats: Engine.STRATAGEM_CATEGORIES },
    { key: "strat4", label: "Stratagem 4", list: "dl-strat", cats: Engine.STRATAGEM_CATEGORIES },
  ];

  // Suggestion lists show item NAMES only. (An earlier version added the category as an option
  // "label", which some browsers display instead of the name.)
  function fillDatalist(id, items) {
    var dl = $(id);
    dl.textContent = "";
    items.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (i) {
      if (i.factions.indexOf("none") !== -1) return; // disabled items can't be picked
      dl.appendChild(h("option", { value: i.name }));
    });
  }

  function buildLockGrid() {
    var grid = $("lock-grid");
    grid.textContent = "";
    LOCK_SLOTS.forEach(function (slot) {
      var input = h("input", { type: "text", id: "lock-" + slot.key, list: slot.list, placeholder: "Random", "aria-label": slot.label + " lock" });
      input.addEventListener("input", updateLockSummary);
      var clear = h("button", { type: "button", class: "ctrl-btn lock-clear", title: "Clear", "aria-label": "Clear " + slot.label },
        "×");
      clear.addEventListener("click", function () { input.value = ""; updateLockSummary(); });
      grid.appendChild(h("div", { class: "lock-cell" },
        h("label", { for: "lock-" + slot.key }, slot.label),
        h("div", { class: "lock-input" }, input, clear)));
    });
  }
  function updateLockSummary() {
    var n = LOCK_SLOTS.filter(function (s) { return $("lock-" + s.key).value.trim() !== ""; }).length;
    $("lock-summary").textContent = n ? "(" + n + " locked)" : "";
  }

  // ---- Requirements ----
  function buildRequireSelect() {
    var tags = {};
    DATA.items.forEach(function (i) { i.tags.forEach(function (t) { tags[t] = true; }); });
    var sel = $("require-tag");
    sel.textContent = "";
    // Only tags that have a display title are offered, alphabetically by title.
    Object.keys(tags).filter(function (t) { return TAG_NAMES[t]; }).sort(function (a, b) {
      return TAG_NAMES[a].localeCompare(TAG_NAMES[b]);
    }).forEach(function (t) {
      sel.appendChild(h("option", { value: t }, TAG_NAMES[t]));
    });
  }
  function reqText(r) {
    if (r.min !== undefined && r.min === r.max) return "= " + r.min;
    if (r.min !== undefined && r.max !== undefined) return r.min + "–" + r.max;
    return r.min !== undefined ? "≥ " + r.min : "≤ " + r.max;
  }
  function reqWords(r) {
    if (r.min !== undefined && r.min === r.max) return "exactly " + r.min;
    if (r.min !== undefined && r.max !== undefined) return "between " + r.min + " and " + r.max;
    return r.min !== undefined ? "at least " + r.min : "at most " + r.max;
  }
  // ---- Preset rows ----
  // Eight of the default rules are plain counts of one tag (Engine.RULES entries with a `preset`: Anti-Tank >= 1,
  // Vehicle <= 1, ...). They are shown as editable rows in "Additional rules" instead of switches. A row still at its
  // default is handed to the engine as the default rule (it keeps its priority tier and wording). Once edited it is one
  // of the player's own requirements for that tag and the default is switched off for the engine. A removed row is
  // state.disabledRules[id]; "Reset to system defaults" brings all eight back.
  var PRESETS = Engine.RULES.filter(function (r) { return r.preset; });
  var PRESET_IDS = {};
  PRESETS.forEach(function (p) { PRESET_IDS[p.id] = true; });
  function presetForTag(tag) { return PRESETS.filter(function (p) { return p.preset.tag === tag; })[0] || null; }
  function presetDefault(p) {
    var d = {};
    if (p.preset.min !== undefined) d.min = p.preset.min;
    if (p.preset.max !== undefined) d.max = p.preset.max;
    return d;
  }
  function sameReq(a, b) { return a.min === b.min && a.max === b.max; }
  // The rows shown: the eight presets (default or edited) that haven't been removed, then the player's other rules.
  function ruleRows() {
    var rows = [];
    PRESETS.forEach(function (p) {
      var tag = p.preset.tag;
      if (state.requirements[tag]) rows.push({ tag: tag, req: state.requirements[tag], preset: p, pristine: false });
      else if (!state.disabledRules[p.id]) rows.push({ tag: tag, req: presetDefault(p), preset: p, pristine: true });
    });
    Object.keys(state.requirements).forEach(function (tag) {
      if (!presetForTag(tag)) rows.push({ tag: tag, req: state.requirements[tag], preset: null, pristine: false });
    });
    return rows;
  }
  // Rules handed to the engine: the player's switches, plus every preset that was removed or replaced by an edited row.
  function disabledList() {
    var ids = Object.keys(state.disabledRules);
    PRESETS.forEach(function (p) {
      if (state.requirements[p.preset.tag] && ids.indexOf(p.id) === -1) ids.push(p.id);
    });
    return ids;
  }
  function presetsChanged() {
    return PRESETS.some(function (p) { return state.disabledRules[p.id] || state.requirements[p.preset.tag]; });
  }
  function switchesOff() {
    return Object.keys(state.disabledRules).filter(function (id) { return !PRESET_IDS[id]; });
  }
  function renderRulesSummary() {
    var added = 0, edited = 0;
    Object.keys(state.requirements).forEach(function (tag) { if (presetForTag(tag)) edited++; else added++; });
    var off = switchesOff().length;
    PRESETS.forEach(function (p) { if (state.disabledRules[p.id] && !state.requirements[p.preset.tag]) off++; });
    var parts = [];
    if (added) parts.push(added + " added");
    if (edited) parts.push(edited + " edited");
    if (off) parts.push(off + " off");
    $("rules-summary").textContent = parts.length ? "(" + parts.join(", ") + ")" : "";
  }
  function renderRequireChips() {
    var box = $("require-chips");
    box.textContent = "";
    ruleRows().forEach(function (row) {
      var tag = row.tag, r = row.req, name = TAG_NAMES[tag] || tag;
      var what = row.pristine
        ? "Default rule (" + (Engine.RULE_TIER[row.preset.id] ? TIER_TITLES[Engine.RULE_TIER[row.preset.id]].toLowerCase() : "limit") + "): " + reqWords(r) + " " + name
        : reqWords(r);
      box.appendChild(h("span", { class: "chip" + (row.pristine ? " preset" : ""), "data-tag": tag, title: what }, name + " " + reqText(r),
        h("button", { type: "button", "aria-label": "Remove rule: " + reqWords(r) + " " + name, onclick: function () {
          delete state.requirements[tag];
          if (row.preset) state.disabledRules[row.preset.id] = true;   // a removed default stays removed until reset
          onRulesChanged();
        } }, "×")));
    });
    $("presets-reset").hidden = !presetsChanged();
    renderRulesSummary();
  }
  function resetPresets() {
    PRESETS.forEach(function (p) { delete state.disabledRules[p.id]; delete state.requirements[p.preset.tag]; });
    onRulesChanged();
  }
  function addRequirement() {
    var tag = $("require-tag").value;
    var op = $("require-op").value;
    var n = parseInt($("require-n").value, 10);
    if (!tag) return;
    if (!(n >= 0 && n <= 7) || (op === "min" && n < 1)) {
      showMessages([op === "min" ? "‘At least’ needs a whole number from 1 to 7." : "The count must be a whole number from 0 to 7."]);
      return;
    }
    // A new rule builds on the row already shown for that tag (the player's own rule, or the default row if it is still there).
    var p = presetForTag(tag);
    var dflt = p ? presetDefault(p) : {};
    var cur = Object.assign({}, state.requirements[tag] || (p && !state.disabledRules[p.id] ? dflt : {}));
    if (op === "min") cur.min = n;
    else if (op === "max") cur.max = n;
    else { cur.min = n; cur.max = n; }
    if (cur.min !== undefined && cur.max !== undefined && cur.min > cur.max) {
      // If the clash is with a number that is still the DEFAULT's (Eagle "at least 3" against the default "at most 2"),
      // the player's rule wins and that side is dropped. A clash with the player's own earlier rule is refused.
      if (op === "min" && dflt.max !== undefined && (state.requirements[tag] ? state.requirements[tag].max : dflt.max) === dflt.max) delete cur.max;
      else if (op === "max" && dflt.min !== undefined && (state.requirements[tag] ? state.requirements[tag].min : dflt.min) === dflt.min) delete cur.min;
      else {
        showMessages(["‘At least " + cur.min + "’ and ‘at most " + cur.max + "’ can't both hold for " + (TAG_NAMES[tag] || tag) + ". Remove the existing rule first."]);
        return;
      }
    }
    showMessages([]);
    if (p && sameReq(cur, dflt)) { delete state.requirements[tag]; delete state.disabledRules[p.id]; }   // back to the default row
    else state.requirements[tag] = cur;
    onRulesChanged();
  }

  // ---- Default rules (switches) ----
  // Generated from the engine's own list so the panel can't drift from what the engine enforces. Guarantees are
  // grouped by priority; the caps come after. The in-game limits (one FRV / tank / exosuit) can't be switched off.
  var TIER_TITLES = { 1: "High priority", 2: "Medium priority", 3: "Low priority", 4: "Lowest priority" };
  function buildDefaultRules() {
    var box = $("rules-default");
    box.textContent = "";
    function row(r) {
      var input = h("input", { type: "checkbox", role: "switch", "data-rule": r.id });
      input.checked = !state.disabledRules[r.id];
      var row = h("div", { class: "rule-row" + (input.checked ? "" : " off") },
        h("label", { class: "switch" }, input, h("span", { class: "switch-track", "aria-hidden": "true" }),
          h("span", null, r.label, r.note ? h("span", { class: "rule-note" }, r.note) : null)));
      input.addEventListener("change", function () {
        if (input.checked) delete state.disabledRules[r.id]; else state.disabledRules[r.id] = true;
        row.classList.toggle("off", !input.checked);
        onRulesChanged();
      });
      return row;
    }
    var guarantees = Engine.RULES.filter(function (r) { return r.kind === "guarantee" && !r.preset; });
    [1, 2, 3, 4].forEach(function (tier) {
      var group = guarantees.filter(function (r) { return Engine.RULE_TIER[r.id] === tier; });
      if (!group.length) return;
      box.appendChild(h("div", { class: "rule-tier" }, TIER_TITLES[tier]));
      group.forEach(function (r) { box.appendChild(row(r)); });
    });
    box.appendChild(h("div", { class: "rule-tier" }, "Limits"));
    Engine.RULES.filter(function (r) { return r.kind === "limit" && !r.preset; }).forEach(function (r) { box.appendChild(row(r)); });
    box.appendChild(h("div", { class: "rule-row locked" },
      h("span", { class: "lock-mark", "aria-hidden": "true" }, "🔒"),
      h("span", null, "At most 1 FRV, 1 tank and 1 exosuit ", h("span", { class: "rule-note" }, "Game rule, always on."))));
    $("rules-reset").hidden = !switchesOff().length;
  }
  // Called after any change to the rules: redraws the rows and the summary and saves the settings.
  function onRulesChanged() {
    $("rules-reset").hidden = !switchesOff().length;
    renderRequireChips();
    saveSettings();
  }

  // ---- Persistence (faction) ----
  function saveSettings() {
    store.set(SETTINGS_KEY, { faction: selectedFaction(), disabledRules: Object.keys(state.disabledRules), requirements: state.requirements });
    applyFactionTheme(); updatePoolLine();
  }
  function applyFactionTheme() { document.documentElement.setAttribute("data-faction", selectedFaction()); }
  function loadSettings() {
    var s = store.get(SETTINGS_KEY, null);
    if (!s || typeof s !== "object") return;
    if (s.faction && FACTION_NAMES[s.faction]) {
      var radio = document.querySelector('input[name="faction"][value="' + s.faction + '"]');
      if (radio) radio.checked = true;
    }
    if (Array.isArray(s.disabledRules)) {
      var known = {};
      Engine.RULES.forEach(function (r) { known[r.id] = true; });
      s.disabledRules.forEach(function (id) { if (known[id]) state.disabledRules[id] = true; });
    }
    // The player's own rules (and edited default rows). Anything that doesn't look right is skipped, not trusted.
    if (s.requirements && typeof s.requirements === "object") {
      var tagsInData = {};
      DATA.items.forEach(function (i) { i.tags.forEach(function (t) { tagsInData[t] = true; }); });
      var okNum = function (v) { return typeof v === "number" && v >= 0 && v <= MAX_RULE_COUNT && Math.floor(v) === v; };
      Object.keys(s.requirements).forEach(function (tag) {
        var v = s.requirements[tag], r = {};
        if (!tagsInData[tag] || !v || typeof v !== "object") return;
        if (okNum(v.min) && (v.min >= 1 || v.max === 0)) r.min = v.min;   // "at least 0" can only come from "exactly 0"
        if (okNum(v.max)) r.max = v.max;
        if (r.min === undefined && r.max === undefined) return;
        if (r.min !== undefined && r.max !== undefined && r.min > r.max) return;
        state.requirements[tag] = r;
      });
    }
  }
  function selectedFaction() {
    var r = document.querySelector('input[name="faction"]:checked');
    return r ? r.value : "any";
  }

  function resetAll() {
    document.querySelector('input[name="faction"][value="any"]').checked = true;
    $("count").value = 1;
    LOCK_SLOTS.forEach(function (s) { $("lock-" + s.key).value = ""; });
    state.requirements = {};
    state.disabledRules = {};
    buildDefaultRules();
    renderRequireChips(); updateLockSummary(); saveSettings();   // My Gear is left alone: it's your data, not an option
    showMessages([]);
    $("results").textContent = "";
  }

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------
  function readLocks(errors) {
    var locks = {};
    LOCK_SLOTS.forEach(function (slot) {
      var text = $("lock-" + slot.key).value.trim();
      if (!text) return;
      var item = engine.resolve(text);
      if (!item) { errors.push(slot.label + ": unknown item ‘" + text + "’. Pick a name from the suggestions."); return; }
      if (item.factions.indexOf("none") !== -1) { errors.push(slot.label + ": ‘" + item.name + "’ is currently disabled."); return; }
      if (slot.cats.indexOf(item.cat) === -1) {
        errors.push(slot.label + ": ‘" + item.name + "’ is a " + (WEAPON_CAT_LABELS[item.cat] || TYPE_LABELS[item.cat] || item.cat).toLowerCase() +
          " and can't go in this slot.");
        return;
      }
      locks[slot.key] = item;
    });
    return locks;
  }

  function onGenerate(evt) {
    if (evt) evt.preventDefault();
    var errors = [];
    var faction = selectedFaction();

    var count = parseInt($("count").value, 10);
    if (!(count >= 1 && count <= MAX_COUNT)) errors.push("Loadouts must be a whole number from 1 to " + MAX_COUNT + ".");

    var st = poolStats();
    if (!st.pool) errors.push("Your gear pool is empty. Tick some items in My Gear first.");

    var locks = readLocks(errors);

    // The same stratagem can't sit in two slots (the game won't allow it). Locks override the
    // balance rules, but not this one.
    var seen = {}, dupes = {};
    ["strat1", "strat2", "strat3", "strat4"].forEach(function (k) {
      if (!locks[k]) return;
      if (seen[locks[k].name]) dupes[locks[k].name] = true;
      seen[locks[k].name] = true;
    });
    Object.keys(dupes).forEach(function (n) { errors.push("‘" + n + "’ can't be locked into more than one stratagem slot."); });

    // The game allows one FRV, one tank and one exosuit per loadout. Unlike the balance caps, this is a hard
    // in-game limit, so locking two of the same kind is an error rather than something to override.
    [["frv", "FRV"], ["tank", "tank"], ["mech", "exosuit"]].forEach(function (kind) {
      var locked = ["strat1", "strat2", "strat3", "strat4"].filter(function (k) {
        return locks[k] && locks[k].tags.indexOf(kind[0]) !== -1;
      });
      if (locked.length > 1) errors.push("You can only bring one " + kind[1] + " in the game, but " + locked.length + " are locked.");
    });

    var excluded = excludedNames();
    Object.keys(locks).forEach(function (k) {
      if (excluded.has(locks[k].name)) {
        errors.push("‘" + locks[k].name + "’ isn't in your gear pool (" +
          (isOwned(locks[k]) ? "blocked" : "not owned") + "). Change it in My Gear, or lock something else.");
      }
    });

    if (errors.length) { showMessages(errors); return; }

    var loadouts = [], problems = [];
    for (var i = 0; i < count; i++) {
      try {
        loadouts.push(engine.generateLoadoutRelaxed({
          faction: faction, locks: locks,
          requirements: state.requirements, excluded: excluded, disabledRules: disabledList(),
        }));
      } catch (e) {
        if (!(e instanceof Engine.GenerationError)) throw e;
        problems.push(e.message);
        break;
      }
    }
    showMessages(problems);
    if (loadouts.length) {
      renderLoadouts(loadouts, faction, locks, state.requirements, disabledList());
      $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      $("results").textContent = "";
    }
  }

  // ---------------------------------------------------------------------------
  // My Gear tab
  // ---------------------------------------------------------------------------
  // Warbonds that are shown together under one collapsible header. The members keep their full names in the data
  // (so the Requisition pill, search and everything else are unchanged); only the My Gear titles drop the prefix.
  var WARBOND_GROUPS = [
    { name: "Requisition", iconKey: "req_p", keys: ["req_p", "req_o", "req_h", "req_b", "req_e", "req_r"], strip: /^Requisition:\s*/ },
  ];

  // A warbond's (or group's) header: title, bulk buttons, and the "pool / total" count. Clicking it opens or closes `body`.
  function makeHeader(o) {
    var items = o.items, tools = [];
    function toolBtn(label, attr, title, fn) {
      var attrs = { type: "button", class: "ctrl-btn", title: title };
      attrs[attr] = o.key;
      var btn = h("button", attrs, label);
      btn.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
      return btn;
    }
    if (o.fixedOwned) {
      tools.push(h("span", { class: "wb-fixed" }, "always owned"));
    } else {
      tools.push(
        toolBtn("Own All", "data-all", "Own every item in this " + o.noun, function () { setOwned(items, true); }),
        toolBtn("Own None", "data-none", "Own nothing in this " + o.noun, function () { setOwned(items, false); }));
    }
    tools.push(
      toolBtn("Block All", "data-block-all", "Block every item in this " + o.noun, function () { setBlocked(items, true); }),
      toolBtn("Block None", "data-block-none", "Unblock every item in this " + o.noun, function () { setBlocked(items, false); }));
    var header = h("div", { class: "wb-header" },
      h("span", { class: "wb-name" }, o.icon, o.label),
      h("span", { class: "wb-tools" }, tools),
      // "pool / total", or "blocked / pool / total" once something owned is blocked
      h("span", { class: "wb-count", "data-total": String(items.length) },
        h("span", { class: "blocked-part", hidden: true }, h("span", { class: "blocked-count" }, "0"), " / "),
        h("span", { class: "pool-count" }, "0"), " / " + items.length));
    header.addEventListener("click", function () { o.body.classList.toggle("open"); });
    return header;
  }

  function makeBlock(w, label, withIcon) {
    var items = ALL_ITEMS.filter(function (i) { return i.warbond === w.key; });
    var base = w.key === "base";
    var rows = items.map(function (item) {
      var cb = h("input", { type: "checkbox", "data-item": item.name, "aria-label": "I own " + item.name });
      if (base) { cb.disabled = true; cb.title = "Base Game gear is always owned"; }
      cb.addEventListener("change", function () {
        if (cb.checked) owned[item.name] = true; else delete owned[item.name];
        onGearChange();
      });
      var nv = h("button", { type: "button", class: "block-btn", "data-block": item.name, "aria-pressed": "false",
        title: "Block: never roll this item" }, "Block");
      nv.addEventListener("click", function () {
        if (blocked[item.name]) delete blocked[item.name]; else blocked[item.name] = true;
        onGearChange();
      });
      // Edit-factions controls (only visible while "Edit factions" is on): T / A / I ticks and a revert button.
      var facBoxes = FAC_KEYS.map(function (f) {
        var fb = h("input", { type: "checkbox", "data-fac": f, "data-fac-item": item.name,
          "aria-label": FACTION_ADJECTIVE[f] + ": " + item.name });
        fb.addEventListener("change", function () {
          setItemFactions(item, facBoxes.map(function (b) { return b.checked; }));
          onFactionEdit();
        });
        return fb;
      });
      var revert = h("button", { type: "button", class: "fac-revert", "data-fac-revert": item.name, hidden: true,
        title: "Back to the default factions", "aria-label": "Reset factions for " + item.name }, "\u21BA");
      revert.addEventListener("click", function () { resetFactions([item]); });
      var facSet = h("span", { class: "fac-set" },
        FAC_KEYS.map(function (f, k) {
          return h("label", { class: "fac-chk fac-" + f, title: FACTION_ADJECTIVE[f] },
            facBoxes[k], facIcon(f, FAC_LETTER[f]));
        }), revert);
      var row = h("div", { class: "gear-row", "data-search": [item.name].concat(item.nicknames || [], [w.name, w.key]).join(" ").toLowerCase() },
        h("label", { class: "gear-main" }, cb, gearThumb(item),
          h("span", { class: "tr-name" }, item.name),
          h("span", { class: "tr-type" }, TYPE_LABELS[item.cat] || WEAPON_CAT_LABELS[item.cat] || item.cat)),
        facSet, nv);
      gearRows[item.name] = row;
      return row;
    });
    var body = h("div", { class: "wb-items" }, rows);
    var header = makeHeader({ key: w.key, label: label, icon: withIcon ? warbondIcon(w.key) : null, items: items, body: body,
      fixedOwned: base, noun: "warbond" });
    return h("div", { class: "wb-block" }, header, body);
  }

  // One header (with its own Own / Block buttons and count) over several warbond blocks.
  function makeGroup(g, members) {
    var items = ALL_ITEMS.filter(function (i) { return g.keys.indexOf(i.warbond) !== -1; });
    var body = h("div", { class: "wb-items wb-group-body" },
      members.map(function (w) { return makeBlock(w, w.name.replace(g.strip, ""), false); }));
    var header = makeHeader({ key: "group_" + g.name.toLowerCase(), label: g.name, icon: warbondIcon(g.iconKey), items: items, body: body,
      fixedOwned: false, noun: g.name + " group" });
    return h("div", { class: "wb-block wb-group" }, header, body);
  }

  function buildGear() {
    var list = $("gear-list");
    list.textContent = "";
    var done = {};
    DATA.warbonds.forEach(function (w) {
      if (!ALL_ITEMS.some(function (i) { return i.warbond === w.key; })) return;
      var g = WARBOND_GROUPS.filter(function (x) { return x.keys.indexOf(w.key) !== -1; })[0];
      if (!g) { list.appendChild(makeBlock(w, w.name, true)); return; }
      if (done[g.name]) return; // the group goes where its first member is
      done[g.name] = true;
      var members = DATA.warbonds.filter(function (x) {
        return g.keys.indexOf(x.key) !== -1 && ALL_ITEMS.some(function (i) { return i.warbond === x.key; });
      });
      list.appendChild(makeGroup(g, members));
    });
    refreshGear();
  }

  // While the search box is filtering, every bulk button (per warbond or global) only touches the rows on screen.
  function shownOnly(items) {
    return items.filter(function (i) { var r = gearRows[i.name]; return r && !r.hidden; });
  }
  function gearFiltered() { return $("gear-search").value.trim() !== ""; }
  function setOwned(items, on) {
    shownOnly(items).forEach(function (i) { if (isBase(i)) return; if (on) owned[i.name] = true; else delete owned[i.name]; });
    onGearChange();
  }
  function setBlocked(items, on) {
    shownOnly(items).forEach(function (i) { if (on) blocked[i.name] = true; else delete blocked[i.name]; });
    onGearChange();
  }
  function onGearChange() { saveGear(); refreshGear(); }

  // Make the checkboxes, block buttons, counts and the randomizer's pool line match the model.
  function refreshGear() {
    var byName = {};
    ALL_ITEMS.forEach(function (i) { byName[i.name] = i; });
    document.querySelectorAll("#gear-list .gear-row").forEach(function (row) {
      var cb = row.querySelector("input[data-item]");
      var item = byName[cb.getAttribute("data-item")];
      cb.checked = isOwned(item);
      var isBlocked = !!blocked[item.name];
      // Red strike-through only for gear you own but have blocked (an unowned item is out of the pool anyway).
      row.classList.toggle("is-blocked", isBlocked && isOwned(item));
      row.querySelector(".block-btn").setAttribute("aria-pressed", isBlocked ? "true" : "false");
      var flags = facFlags(item.factions);
      row.querySelectorAll("input[data-fac]").forEach(function (fb, k) { fb.checked = flags[k]; });
      row.classList.toggle("fac-custom", isCustomised(item));
      row.querySelector(".fac-revert").hidden = !isCustomised(item);
    });
    document.querySelectorAll("#gear-list .wb-block").forEach(function (block) {
      var rows = Array.prototype.slice.call(block.querySelectorAll(".gear-row"));
      var pool = 0, lost = 0;
      rows.forEach(function (row) {
        var item = byName[row.querySelector("input[data-item]").getAttribute("data-item")];
        if (inPool(item)) pool++; else if (isOwned(item) && blocked[item.name]) lost++;
      });
      var count = block.querySelector(".wb-count");
      count.querySelector(".pool-count").textContent = pool;
      count.querySelector(".blocked-count").textContent = lost;
      count.querySelector(".blocked-part").hidden = lost === 0;
      count.title = lost + " blocked · " + pool + " in your pool · " + count.getAttribute("data-total") + " in this warbond";
    });
    var st = poolStats();
    $("grand-total").textContent = st.owned + " / " + st.total + " items owned";
    $("gear-detail").textContent = "Rolling from " + st.pool + (st.blocked ? " (" + st.blocked + " blocked)" : "");
    updateFacTools();
    updatePoolLine();
  }

  // ---- Edit factions: switch, count and the two bulk buttons ----
  // Both bulk buttons act on the items shown (the search filter applies, like the other bulk buttons) and need a
  // second click within 4 seconds, so a stray click can't overwrite your edits.
  var armed = null;   // { which: "reset" | "all", timer }
  function disarm() { if (armed) { clearTimeout(armed.timer); armed = null; } }
  function allTicked(item) { return facFlags(item.factions).every(Boolean); }
  function resetScope() { return shownOnly(ALL_ITEMS).filter(isCustomised); }
  function allScope() { return shownOnly(ALL_ITEMS).filter(function (i) { return !allTicked(i); }); }
  function updateFacTools() {
    var on = $("edit-factions").checked;
    $("view-gear").classList.toggle("edit-factions", on);
    $("fac-tools").hidden = !on;
    if (!on) { disarm(); return; }
    var total = customisedCount();
    var filtered = gearFiltered();
    $("fac-count").textContent = total ? total + " item" + (total === 1 ? "" : "s") + " edited" : "No edits: everything is on the default factions";
    function label(btn, which, scope, idle, idleShown) {
      btn.disabled = scope === 0;
      if (armed && armed.which === which) { btn.textContent = "Click again to " + (which === "reset" ? "reset " : "enable ") + scope; return; }
      btn.textContent = (filtered ? idleShown : idle) + (scope ? " (" + scope + ")" : "");
    }
    label($("fac-reset"), "reset", resetScope().length, "Reset to defaults", "Reset shown to defaults");
    label($("fac-all"), "all", allScope().length, "Enable for all factions", "Enable shown for all factions");
  }
  function onBulkFactionClick(which) {
    var scope = which === "reset" ? resetScope() : allScope();
    if (!scope.length) return;
    if (!armed || armed.which !== which) {
      disarm();
      armed = { which: which, timer: setTimeout(function () { armed = null; updateFacTools(); }, 4000) };
      updateFacTools();
      return;
    }
    disarm();
    if (which === "reset") { resetFactions(ALL_ITEMS); return; }
    scope.forEach(function (i) { setItemFactions(i, [true, true, true]); });
    onFactionEdit();
  }

  // Search: every word must appear in the item's name, a nickname, or its warbond's name/key
  // ("scope of authority" lists that whole warbond; "eagle hangar" lists the Hangar's Eagles).
  function filterGear() {
    var words = $("gear-search").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    document.querySelectorAll("#gear-list .gear-row").forEach(function (row) {
      var hay = row.getAttribute("data-search");
      var match = words.every(function (w) { return hay.indexOf(w) !== -1; });
      row.hidden = !match;
      if (match) shown++;
    });
    // Blocks include the group blocks and the warbond blocks inside them: hide any with no visible row, and open
    // the ones that match while a search is active.
    document.querySelectorAll("#gear-list .wb-block").forEach(function (block) {
      var any = !!block.querySelector(".gear-row:not([hidden])");
      block.hidden = !any;
      if (words.length && any) block.querySelector(".wb-items").classList.add("open");
    });
    var note = $("gear-filter-note");
    note.hidden = !words.length;
    note.textContent = words.length
      ? "Search active: the Own / Block buttons only apply to the " + shown + " item" + (shown === 1 ? "" : "s") + " shown."
      : "";
  }

  // ---------------------------------------------------------------------------
  // Wire everything up
  // ---------------------------------------------------------------------------
  function init() {
    fillDatalist("dl-primary", engine.pools.primaries);
    fillDatalist("dl-secondary", engine.pools.secondaries);
    fillDatalist("dl-throwable", engine.pools.throwables);
    fillDatalist("dl-strat", engine.pools.strategems);

    buildLockGrid();
    buildRequireSelect();
    loadSettings();
    buildDefaultRules();
    applyFactionTheme();
    // Faction emblems on the faction buttons and in the Edit factions legend.
    FAC_KEYS.concat(["any"]).forEach(function (f) {
      var radio = document.querySelector('input[name="faction"][value="' + f + '"]');
      if (radio && radio.nextElementSibling) radio.nextElementSibling.insertBefore(facIcon(f), radio.nextElementSibling.firstChild);
    });
    document.querySelectorAll("#fac-tools [data-fac-legend]").forEach(function (el) {
      el.insertBefore(facIcon(el.getAttribute("data-fac-legend"), FAC_LETTER[el.getAttribute("data-fac-legend")]), el.firstChild);
    });
    loadGear();
    loadFactions();
    renderRequireChips();
    updateLockSummary();
    buildGear();

    $("controls").addEventListener("submit", onGenerate);
    $("require-add").addEventListener("click", addRequirement);
    $("require-op").addEventListener("change", function () {
      // "At least" needs 1+; the other two accept 0 (a ban).
      $("require-n").min = $("require-op").value === "min" ? 1 : 0;
      if ($("require-op").value === "min" && parseInt($("require-n").value, 10) < 1) $("require-n").value = 1;
    });
    $("rules-reset").addEventListener("click", function () {
      switchesOff().forEach(function (id) { delete state.disabledRules[id]; });   // the default rows are restored by their own button
      buildDefaultRules(); onRulesChanged();
    });
    $("presets-reset").addEventListener("click", resetPresets);
    $("reset-all").addEventListener("click", resetAll);
    $("pool-edit").addEventListener("click", function () { showView("gear"); });
    document.querySelectorAll('input[name="faction"]').forEach(function (r) { r.addEventListener("change", saveSettings); });

    $("gear-search").addEventListener("input", function () { filterGear(); updateFacTools(); });
    $("edit-factions").addEventListener("change", updateFacTools);
    $("fac-reset").addEventListener("click", function () { onBulkFactionClick("reset"); });
    $("fac-all").addEventListener("click", function () { onBulkFactionClick("all"); });
    $("gear-expand").addEventListener("click", function () {
      document.querySelectorAll("#gear-list .wb-items").forEach(function (el) { el.classList.add("open"); });
    });
    $("gear-collapse").addEventListener("click", function () {
      document.querySelectorAll("#gear-list .wb-items").forEach(function (el) { el.classList.remove("open"); });
    });
    $("gear-select-all").addEventListener("click", function () { setOwned(ALL_ITEMS, true); });
    $("gear-unblock-all").addEventListener("click", function () { setBlocked(ALL_ITEMS, false); });
    $("gear-clear").addEventListener("click", function () {
      if (confirm("Mark " + (gearFiltered() ? "the items shown" : "everything except Base Game gear") + " as not owned?")) setOwned(ALL_ITEMS, false);
    });
  }

  init();
})();
