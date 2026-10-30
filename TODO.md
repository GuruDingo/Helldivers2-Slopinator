# Follow-ups (updated 2026-10-30)

Items we agreed to come back to. Nothing below is started unless marked.

## UI / design
- [x] ~~Show armor penetration on weapon cards~~ done 2026-10-30: `armor_pen` column in `hd2gear.csv` for all 141 weapons
      (main attack, `2/4` for two-mode weapons), validated by the build, exported as `armorPen`, and shown on the loadout
      cards as the wiki's icons (both, side by side, for two-mode weapons). Possible follow-ups: use it for the "anti-armor" tag/rules and sub-faction advice; check
      whether any other support weapon shows two icons on the wiki's Weapons page (Boss set Recoilless Rifle 5/6, Epoch
      4/5 and Defoliation Tool 3/5 on 2026-10-30; the page's support section didn't load for me, so the rest use one
      main value).
- [ ] **Colour the rest of the UI**: weapon tags (the pills only cover ~9 of the ~40 tags) and the faction buttons
      themselves (the selected one already takes the faction colour).
- [x] ~~Migrate images from wiki hotlinks to saved files~~ done 2026-10-30: `tools/fetch_images.py` + the "Fetch images" GitHub Action
      saved all 276 images (2.2 MB: 201 item pictures, 28 warbond covers, 47 icons) into `docs/img/`, `build_gear.py`
      exports them as `HD2_DATA.images`, the page prefers the saved copy (wiki link only as a fallback), and the
      single-file build embeds them (2.3 MB, works offline). Re-run the fetch (Actions -> Fetch images, or the script)
      when a new item / warbond / wiki image is added. The warbond covers are saved too, but not shown anywhere (header art is parked, 2026-10-30).
- [x] ~~Host the tool at a URL~~ done 2026-10-30: live at https://gurudingo.github.io/Helldivers2-Slopinator/ (GitHub Pages, `main` / `/docs`). Open choices still: custom domain, analytics/feedback, shareable-loadout links.
- [ ] **Proof the new stratagem AP values** (Boss, 2026-10-30; PR #3 is already merged and live, so this is now a correction pass). Wiki pages were summarised, not
      read in full, so check these against the wiki: K-9 (7), Orbital EMS Strike (7), EMS Mortar Sentry (6), Eagle
      Strafing Run (5) vs the other Eagles (7), Maelstrom (4, missiles 5), Rover (2, fire is 4), Incendiary Mines (4,
      explosion 3), Gas Mortar Sentry (6) and Mortar Sentry (3, headline is AV only), the three two-value ones (Patriot
      3/6, Lumberer 4/6, Bastion 4/8; Dog Breath is set to 5 by Boss), and whether the two smoke strikes should really be blank.
      ALSO (Boss, 2026-10-30): review EVERY multi-AP item, not just the three above - all 12 items that show two icons: AR/GL-21 One-Two (2/3), AR-11 Arbitrator (2/3), SMG/FLAM-34 Stoker (2/4), SG-20 Halt (2/3), LAS-17 Double-Edge Sickle (2/4), PLAS-15 Loyalist (2/3), GR-8 Recoilless Rifle (5/6), PLAS-45 Epoch (4/5), CQC-9 Defoliation Tool (3/5), EXO-45 Patriot Exosuit (3/6), EXO-51 Lumberer Exosuit (4/6), TD-220 Bastion MK XVI (4/8). Check that each really has two attacks worth showing and that the order and values match the wiki.
- [~] **Give every tag a display title.** 17 of 40 tags have titles now (the 9 old ones, "assist" is shown as
      "Team Assist", plus Fire, Stealth, Orbital, Eagle, Sentry, Gas, Vehicle, Arc). Only titled tags appear in the
      "Require tags" dropdown; the other 23 are hidden until they get a title. `hd2-tags.xlsx` (sent earlier) is now
      out of date. Possible next step: move tag titles/pill colours into a `hd2tags.csv` instead of `TAG_NAMES` in
      `docs/app.js`.
- [ ] **Check the "meme" elemental builds are tagged properly** (fire, arc, gas, explosive, stealth, laser/beam, ...),
      and explore which other meme tags are worth having. Then expand the pill options and colours to include the
      meme tags (today only 9 tags get pills).
- [ ] **"Crayon mode" setting**: swap tag names and pill colours for YouTuber CommissarKai's "crayon system" of
      enemy levels. Needs the exact crayon-to-tag mapping from Boss (or the reference video) before building.
- [x] ~~Tag consistency checks~~ done 2026-10-29 as a manual Claude procedure (`TAG_CHECK.md`), deliberately NOT in the build. Orbital Laser is a deliberate exception to beam -> fire.
- [x] ~~Reroll one slot~~ done 2026-10-29: every card has a lock toggle and a reroll button, and each loadout has a "Reroll all unlocked" button (see README). Possible follow-ups: lock/unlock-all buttons; one "reroll all loadouts" button when generating several; card locks are per-loadout and are NOT copied back into the Locks panel.
- [ ] **Shareable loadouts**: encode a build in the URL (`#...`) so it can be sent to a friend; maybe a
      copy-as-text button for Discord.
- [ ] **Odds transparency**: explain why a build was flagged or why the faction was relaxed (tooltips / details).

## Rules
- [ ] **Redo the rule priority list later, with MORE rules in it** (Boss, 2026-10-29). Today's tiers only cover the
      12 rules a finished build is checked against. To add to the ranking:
      - the fill-time caps, which are currently hard limits that only locks can break (and a lock breaks them silently):
        max 1 non-expendable support weapon; max 2 expendable support weapons; never mix regular + expendable
        supports; one backpack-slot item while filling (same idea as rule 1); max 1 vehicle; max 2 Eagles; max 1 mine;
      - faction fit (today the tool relaxes the faction to "any" BEFORE it drops any rule, so faction effectively
        outranks every rule - that is a ranking choice too);
      - things that are not really rules but could be: "no duplicate stratagem" (always enforced), melee secondaries
        rolled at ~1/3 odds (an odds tweak, not pass/fail).
      Partly done 2026-10-29: a required tag now overrides the cap for its own tag (Eagle 3, mines 2...), and FRV / tank /
      exosuit (max 1 each) are in-game limits that sit ABOVE the ranking. Still open: should the backpack join the in-game
      limits? Where do the other caps and faction fit rank?
- [~] **"Rules" menu** - first version done 2026-10-29: one Rules panel with a switch for every default rule (grouped by
      priority, caps included, in-game limits locked) and the "Additional rules" (at least / at most / exactly, ranges,
      bans). Possible follow-ups:
      - [ ] **Challenge mode**: presets such as "no support weapon" or "all Eagles", built from rule switches + rules.
      - [ ] Per-rule priority editing (drag to re-rank the tiers) - today the tiers are fixed in `RULE_TIER`.
      - [ ] Rules for item categories (e.g. "no Orbitals") rather than only tags.
      - [ ] Optional: let a tag with no title be chosen in Additional rules (the dropdown still lists only the 17 titled tags).
- [ ] **Faction rules: sub-factions.** Extend the faction rules (`works_for` / the `factions` column) to
      specify sub-factions (e.g. unit types within Terminids / Automatons / Illuminate).
- [x] ~~Editable faction recommendations~~ done 2026-10-29 (My Gear > "Edit factions"; see README). Possible follow-ups:
      - bulk faction buttons per warbond / per search result ("tick Automaton for everything shown"); "Enable for all factions" is done (2026-10-30);
      - export / import your edits (a small file or a copy-paste code) so friends can share faction lists, plus a
        "reset to the game-wide defaults" confirmation that lists what will change;
      - a "show edited only" filter and a way to see which edits the CSV has since made redundant;
      - faction presets such as "anti-armor first for Automatons";
      - when sub-factions arrive, the same grid could gain columns, or an item could carry per-sub-faction ticks;
      - lock/block-style undo for the last faction edit.

## Done 2026-10-30
- **Wiki scan decisions** (Boss): the two temporary Liberty Day 2026 stratagems (Orbital Confetti, Eagle Fly By) are skipped on purpose, because the game doesn't let you pick temporary stratagems in a loadout. The Halo: ODST warbond and the wiki's "Obedient Democracy Support Troopers" are the same warbond; no change needed. "G/40-K Meltamine" renamed "G/40-K Melta Mine" to match the wiki; "melta mine" and "meltamine" are both nicknames (saved ticks / faction edits under the old name are orphaned).
- **My Gear thumbnails confirmed working on the live site** (Boss). **Mobile layout** checked on Boss's phone: fine, closed for now. **Warbond header art** and **AP icons in My Gear rows** dropped from the list for now (Boss); the covers stay saved in `docs/img/warbonds/` in case we want them later.
- **LAS-12 Sai** added (primary, Superstore, `smg,chaff,onehand,med,panic,charge`, bug+squid, AP 3). Wiki scan the same day: no other permanent weapon or stratagem is missing from the CSV (primaries 57/57, secondaries 26/26, throwables 24/24, backpacks, vehicles, sentries, emplacements, Eagles, orbitals and support weapons all match), and the wiki's "Obedient Democracy Support Troopers" warbond is the same four items as our `odst` (Halo: ODST) warbond. The UI tests no longer hard-code the item count.
- **Armor penetration on stratagems** (icons moved to the right of the item name): 50 attacking stratagems now have `armor_pen` (page's lead AP icon; two values for Patriot, Lumberer, Bastion; Dog Breath counted as just 5 per Boss). Worth a second look on the wiki: K-9 (7), EMS Strike (7) and EMS Mortar Sentry (6) look high for what they do, Eagle Strafing Run (5) vs the other Eagles (7), and Maelstrom (4, missiles are 5).
- **Armor penetration data**: new `armor_pen` column in `hd2gear.csv` (141 weapons), build validation, `armorPen` in the exported data, and the wiki icon links in the README. The cards now show it (both icons for two-mode weapons).
- **Enable for all factions** button in Edit factions mode, next to Reset to defaults: ticks all three factions for the items shown (second click to confirm; respects the search filter). Reset to defaults undoes it.

## Done 2026-10-29
- **Rules panel**: the "Require tags" section is now "Rules" with **Default rules** (a switch per rule, grouped by priority, caps switchable, in-game limits locked, "Turn all default rules back on") and **Additional rules** (tag + at least / at most / exactly + count; at least + at most make a range; 0 bans a tag). Engine: requirements are `{min?, max?}`, `disabledRules` option, `Engine.RULES` list. Switched-off rules are saved in `hd2_settings` and cleared by Reset. 17 new engine tests and a UI section cover it.
- **Last three warbond icons** (PNG title icons: Still Standing for Warhammer 40k, Treadhead for Ironclad Democracy, Longshot for Scope of Authority). Every warbond now has an icon. All icons, SVG or PNG, are sized by one CSS rule (1.15em tall, capped width), so no image files needed resizing.
- **Four more warbond icons**: Redacted Regiment (Redacted), Siege Breakers (Bunker Buster), Entrenched Division (Mudskipper), Exo Experts (Exosuit Certified), matched by release order. Only Warhammer 40k, Ironclad Democracy and Scope of Authority still have no icon.
- **Ten more warbond icons** (title icons, checked against a wiki-derived title list): Urban Legends (Super Pedestrian), Servants of Freedom, Borderline Justice (Super Sheriff), Masters of Ceremony (Decorated Hero), Force of Law (Extra Judicial), Control Group (Exemplary Subject), Halo: ODST (Rookie), Dust Devils (Burier of Heads), Python Commandos, and Killzone (Assault Infantry; the wiki calls that warbond Righteous Revenants - the cover image in `hd2warbonds.csv` confirms it). 7 warbonds still have no icon: Redacted Regiment, Siege Breakers, Entrenched Division, Exo Experts, Warhammer 40k, Ironclad Democracy, Scope of Authority.
- **Three more warbond icons**: Freedom's Flame (Fire Safety Officer), Chemical Agents (Expert Exterminator), Truth Enforcers (Free of Thought) - matched by release order, since the links didn't name the warbonds. 17 warbonds still have no icon (Urban Legends onward).
- **More warbond icons** (own colours, hotlinked): Helldivers Mobilize, Steeled Veterans, Cutting Edge, Democratic Detonation, Polar Patriots (rank icons) and Viper Commandos (title icon). Shop titles inside the Requisition group are Super Credit Blue; the group title stays yellow. Still without an icon: the other warbonds.
- **Requisition group** in My Gear: the six Requisition shops sit under one collapsible header with short names (option 4 of the shortening ideas). If it doesn't work out, the fallback is option 1: drop the "Requisition:" prefix from the names and keep the icon (and shorten "Patriotic Administration Center").
- **Warbond icons** in My Gear (own colours, hotlinked): Requisition Slip on all six Requisition shops, Super Citizen title icon, Medal on Campaign/Event Rewards, Super Credit on Superstore, and the Super Earth emblem in white on Base Game. The Any faction button also uses the Super Earth emblem, white. The icon map lives in `WARBOND_ICONS` in `docs/app.js`; possible follow-up: move it into `hd2warbonds.csv` as an `icon_url` column.
- **Faction emblems** (Terminid / Automaton / Illuminate icons, hotlinked from helldivers.wiki.gg, falling back to letters/text) on the Edit factions ticks and legend and on the Randomizer's faction buttons. Possible follow-up: bundle the three SVGs locally (needs the files attached, since the sandbox can't download from the wiki) so they work offline and can use the faction colours.
- **Edit factions** on My Gear: per-item Terminid / Automaton / Illuminate ticks (defaults from the CSV), per-item revert, Reset to defaults (confirm click; honours the search filter), saved as `hd2_factions`, and the Randomizer pool line notes when edits are in use.
- **Slot lock / reroll** on the output cards (lock toggle, reroll one slot, reroll all unlocked, per loadout).
- Tags: gear CSV updated with Boss's tag rules (beam -> fire; heal/taunt/stun/smoke -> assist; smoke -> stealth;
  mortar -> sentry; secondary + demo -> explosive; 12 tags added). Every item has at least one titled tag and at
  least one pill tag. Note the `charge` tag was added to the Rover and Laser Cannon in the same CSV (it counts as a
  no-ammo item for the supply-pack rule).
- **Rule priority for best-effort builds** (Boss's order): Top = your own requirements; High = one backpack,
  shield needs one-hander, no supply with 2+ no-ammo; Medium = anti-armor, chaff killer, base breaker; Low =
  support weapon, medium killer, panic weapon; Bottom = two base breakers when none from weapons, chaff/med/armor
  balance. A build that misses only lower tiers beats one missing a higher tier; same tier -> fewer misses ->
  smaller shortfall. Lives in `RULE_TIER` in `docs/engine.js` (the future Rules menu can reuse it).
- Decisions (Boss): hotlinking the wiki's images is fine for now (free, friends-only project) - revisit before any
  public sharing. The Requisition shops, Campaign/Event Rewards and Superstore are NOT assumed owned (only Base Game is).
- **My Gear** replaces the Warbonds filter, Exclude gear and the Warbond Tracker: item-level ownership; per-warbond
  Own All / Own None / Block All / Block None; a per-item **Block** switch (owned + blocked = red strike-through);
  per-warbond counts "pool / total" (red "blocked / pool / total" once something is blocked); a search box that
  matches item names, nicknames and warbond names (while it filters, every Own/Block button only affects the rows
  shown); Base Game always owned; a new browser starts with everything owned. The Randomizer tab shows
  "Rolling from N of M <faction>-compatible items". Locking an item outside the pool is an error.
  Saved in localStorage: `hd2_tracker` (owned), `hd2_blocked`, `hd2_settings` (faction).
- Look: accent colour is Super Credit Blue #70F5FF and follows the faction (Terminid Yellow #FF8D1F, Automaton
  Red #FF6161, Illuminate Purple #CD8AEA); title in Helldiver Yellow #FFE900 with a "A Loadout Randomizer
  Fan-Project" tagline; footer disclaimers (trademarks, free/never monetized, AI vibe-code); Requisition-shop
  items show a short "Requisition" pill on loadout cards.
- Boss split Base Game in the CSVs (Requisition shops `req_p/o/h/b/e/r`, `fomo`, `superstore`; Base Game is
  6 items) and added warbond `img_url` (passed to the site as `imgUrl`). "M-102 Fast Recon Vehicle" was renamed
  "M-102 Gunner FRV", so a saved tick or block on the old name is orphaned.
- Test suite: parity vs the Python original retired to `tests/archive/`; new `tests/regression.js` (seeded, ~7 s)
  and `tests/run_all.js` (~12 s for build + everything). Re-save `tests/baseline.json` after rule or CSV changes.
  Some UI tests hard-code today's counts (200 items, 36 warbonds, 6 Base Game items).
- Port to a static JS site (`docs/`), CLI dropped.
- Locking all four stratagem slots waives the one-backpack rule; builds that can't meet every rule are completed
  anyway and the missed rules are listed above the loadout.
- Counter-leak quirk fixed in the engine (`legacyCounterLeak` option keeps the old behaviour for tests).
