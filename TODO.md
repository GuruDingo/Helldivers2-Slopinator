# Follow-ups (updated 2026-10-30)

Items we agreed to come back to. Nothing below is started unless marked.

## UI / design
- [x] ~~Show armor penetration on weapon cards~~ done 2026-10-30: `armor_pen` column in `hd2gear.csv` for all 141 weapons
      (main attack, `2/4` for two-mode weapons), validated by the build, exported as `armorPen`, and shown on the loadout
      cards as the wiki's icons (both, side by side, for two-mode weapons). Possible follow-ups: use it for the "anti-tank" tag/rules and sub-faction advice; check
      whether any other support weapon shows two icons on the wiki's Weapons page (Boss set Recoilless Rifle 5/6, Epoch
      4/5 and Defoliation Tool 3/5 on 2026-10-30; the page's support section didn't load for me, so the rest use one
      main value).
- [x] ~~Migrate images from wiki hotlinks to saved files~~ done 2026-10-30: `tools/fetch_images.py` + the "Fetch images" GitHub Action
      saved all 276 images (2.2 MB: 201 item pictures, 28 warbond covers, 47 icons) into `docs/img/`, `build_gear.py`
      exports them as `HD2_DATA.images`, the page prefers the saved copy (wiki link only as a fallback), and the
      single-file build embeds them (2.3 MB, works offline). Re-run the fetch (Actions -> Fetch images, or the script)
      when a new item / warbond / wiki image is added. The warbond covers are saved too, but not shown anywhere (header art is parked, 2026-10-30).
- [x] ~~Host the tool at a URL~~ done 2026-10-30: live at https://gurudingo.github.io/Helldivers2-Slopinator/ (GitHub Pages, `main` / `/docs`). Open choices still: custom domain, analytics/feedback, shareable-loadout links.
- [~] **Give every tag a display title.** 41 of 44 tags have titles now (2026-10-30 added Stun, Smoke, Jump, Mech, FRV, Tank,
      Rover, Mortar and Emplacement). Titles and pill colours now live in `hd2tags.csv` (done 2026-10-30; row order = pill
      order, blank colour = no pill). Only titled tags appear in the Rules dropdown; the 3 left without a title are heal,
      taunt and beam. `hd2-tags.xlsx` (sent earlier) is out of date: edit `hd2tags.csv` instead.
      Note: the tag "Emplacement" (3 items) shares its name with the Emplacement *category* (mines, relays, etc.) in the rule builder.
- [ ] **Check the "meme" elemental builds are tagged properly** (fire, arc, gas, explosive, stealth, laser/beam, ...),
      and explore which other meme tags are worth having. Then expand the pill options and colours to include the
      meme tags. (Done 2026-10-30 for the seven known meme tags, see Done; any new meme tag gets a pill from now on.)
      - [ ] `explosive` (Boss, 2026-10-30): go through ALL the throwables and stratagems and tag everything that is
            explosive (today it sits on a few weapons, plus the rule "secondary + demo -> explosive").
      - [x] `laser` and `plasma` tags added 2026-10-30 (see Done). Nova / Quasar Cannon keep `laser` (settled, Boss).
- [x] ~~Tag consistency checks~~ done 2026-10-29 as a manual Claude procedure (`TAG_CHECK.md`), deliberately NOT in the build. (The beam -> fire rule, and the Orbital Laser exception to it, were dropped 2026-10-30.)
- [x] ~~Reroll one slot~~ done 2026-10-29: every card has a lock toggle and a reroll button, and each loadout has a "Reroll all unlocked" button (see README). Possible follow-ups: lock/unlock-all buttons; one "reroll all loadouts" button when generating several; card locks are per-loadout and are NOT copied back into the Locks panel.
- [ ] **Shareable loadouts** (parked, Boss 2026-10-30: "not super important long term", do later): encode a build in the URL
      (`#...`) so it can be sent to a friend; maybe a copy-as-text button for Discord. Design notes from the discussion:
      link = faction + item ids per slot (ids are stable across renames), several loadouts joined with `~`, a version marker,
      placeholder for unknown ids; build and faction only (not the recipient's rules or My Gear); "Copy link" and "Copy as text"
      buttons per card. Open: include locks? one link for a whole batch? text format for Discord?
- [ ] **My Gear list order** (Boss, 2026-10-30): show the My Gear lists in the order the game does (menu / warbond /
      chronological order) instead of `hd2gear.csv` order. The CSV is in release order and has a `release_date` column
      (exposed to the page as `released`, accepted as correct by Boss). Waiting on Boss: he will define the menu order of the
      Requisition stratagems (2026-10-31). Plan: keep ids as release order and add a `menu_order` column for My Gear.
- [x] ~~**Odds transparency**~~ done 2026-10-30: the faction-relaxed and rules-not-met banners have a "Why?" detail (which rules the faction-only build broke, rule priority, locks as a possible cause, how to fix); OFF-FACTION badges say who the item is meant for.

## Rules
- [ ] **Redo the rule priority list later, with MORE rules in it** (Boss, 2026-10-29). Boss, 2026-10-30: assume a FULL RESET of rule priority when this is tackled, which also settles what tier an edited default row has (today it becomes one of the player's own requirements and ranks at the top). Today's tiers only cover the
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
- [x] ~~**More default rules as editable rows**~~ done 2026-10-30 (Boss: "all seven", if/then rules for players, locks win): all 17 default rules are rows; the engine has category / group selectors, slot scopes, if/then and balance rules (see README, Rules panel). Nine of them can be removed but not edited in place; edited rows rank as the player's own requirements until the full priority reset below. Two deliberate behaviour changes: a chaff requirement no longer replaces the chaff-in-primary/secondary default, and an expendable-support minimum no longer allows mixed supports. `capSupport` is now `capRegular` / `capExpend` / `capMixed` (old saved name still works).
- [~] **"Rules" menu** - first version done 2026-10-29, rebuilt 2026-10-30 as one list of rows (every default rule a row, no
      switches) with one "Add your own rule" builder (tags, categories, scopes, if/then, balance). Possible follow-ups:
      - [x] ~~Challenge mode~~ dropped (Boss, 2026-10-30): players make their own challenges with custom rules.
      - [ ] Per-rule priority editing (drag to re-rank the tiers) - today the tiers are fixed in `RULE_TIER`.
      - [x] Rules for item categories (e.g. "no Orbitals"): done 2026-10-30 via the rule builder.
      - [ ] Optional: let a tag with no title be chosen in the rule builder (the dropdown still lists only the 41 titled tags).
- [ ] **Faction rules: sub-factions.** Extend the faction rules (`works_for` / the `factions` column) to
      specify sub-factions (e.g. unit types within Terminids / Automatons / Illuminate).
- [x] ~~Editable faction recommendations~~ done 2026-10-29 (My Gear > "Edit factions"; see README). Possible follow-ups:
      - bulk faction buttons per warbond / per search result ("tick Automaton for everything shown"); "Enable for all factions" is done (2026-10-30);
      - export / import your edits (a small file or a copy-paste code) so friends can share faction lists, plus a
        "reset to the game-wide defaults" confirmation that lists what will change;
      - a "show edited only" filter and a way to see which edits the CSV has since made redundant;
      - faction presets such as "anti-tank first for Automatons";
      - when sub-factions arrive, the same grid could gain columns, or an item could carry per-sub-faction ticks;
      - lock/block-style undo for the last faction edit.

## Done 2026-10-30
- **Dropped from the list** (Boss, 2026-10-30): the weapon-lock UI restyle ("it's fine for now"); the Nova / Quasar `laser` question is settled (they keep `laser`).
- **CSV in release order + release_date column + game version note** (Boss, 2026-10-30): `hd2gear.csv` is sorted oldest to newest (id 1 = oldest, highest id = newest; same-day items keep their old relative order) with a new `release_date` column; `build_gear.py` reads it as `released` and warns on a missing or malformed date. Dates were best effort (wiki "added to the game" entries, news for Truth Enforcers, estimates for 11 warbonds, launch day assumed for 45 shop/event items; see `RELEASE_DATES_CHECK.md` for the basis of each); Boss accepted them as correct on 2026-10-30. The page shows "Updated for Helldivers 2 version 1.007.202" under the title (hand-edited line in `docs/index.html`). Also: rule builder selects narrowed so row 1 stays on one line; the collapsible heading is just "Add your own rule".
- **Shield rule, pistols and weapon-type tags** (Boss, 2026-10-30): the rule is now "A hand-held shield needs a one-handed primary or a melee weapon" (written as: if a hand-held shield and no one-handed primary, then a melee weapon in primary / secondary). Every secondary now carries `onehand` (20 pistols added; the 6 melee secondaries had it), but pistols deliberately do not satisfy the shield rule. The outcome of the rule is unchanged from before (the old rule was satisfied by exactly those same weapons), so the odds baseline did not move. Weapon-type tags: PLAS-101 Purifier got `assault rifle`; Eruptor, Exploding Crossbow, Evictor, Scythe and Torcher got `special`. New titles: Charge, Shield, Shotgun, Assault Rifle, SMG, Marksman Rifle, Special (32 of 42 titled).
- **Clear custom rules** button next to Reset to system defaults (Boss): removes the rules the player added for tags that have no default row; the default rows (edited or not) stay. Hidden while there are none.
- **Eight default rules are now editable rows** (Boss): Backpack = 1, Anti-Tank >= 1, Medium Killer >= 1, Base Breaker >= 1, Panic Weapon >= 1, Vehicle <= 1, Eagle <= 2 and Mines <= 1 moved from the (since replaced) Default rules switches to dim rows at the top of Additional rules. Adding a rule for the same tag edits the row (a clash with a default number lets the default give way); the x removes it; the new **Reset to system defaults** button restores all eight (rules added for other tags stay). An edited row is the player's own requirement, so it ranks as top priority; an untouched row is still the engine's default rule with its tier. Engine: `Engine.RULES` entries carry a `preset` ({tag, min, max}); no change to how builds are made (tests prove a preset handed over as a requirement behaves the same). Rules, edits and removals are now saved in `hd2_settings` (Additional rules used to be lost on reload). New title: Mines.
- **Pill colours swapped** (Boss): Team Assist is now laser pink (#d6336c) and Laser is a brighter version of the old Team Assist yellow (#8a8210, was #534e05). **Colour the rest of the UI** removed from the to-do list: the pill colours are good for now (the faction buttons keep the faction accent).
- **Meme-tag pills and three new titles** (Boss): pills for all the meme tags, Fire, Gas, Arc, Stealth, Explosive, Laser and Plasma, and laser / plasma count as meme tags from now on (any new meme tag gets a title and a pill). New titles: Laser, Plasma, Hand-Held Shield (`handheld`) and Explosive (needed for its pill). Pill colours are first guesses in `TAG_COLORS` (`docs/app.js`): fire #c8541a, gas #7d8a1d, arc #0c8a96, stealth #37474f, explosive #a0700a, laser #d6336c, plasma #8f3fe0. The `explosive` pass over all throwables and stratagems is saved for later (still open under the meme-tag item).
- **"Anti-Armor" is now "Anti-Tank"** (Boss): the pill title and the rule text in the Rules panel / unmet-rule messages now say Anti-Tank (README and test names too). The tag id stays `armor`, so saved settings and the CSV are unaffected. Boss also confirmed Quasar Cannon and Nova keep `laser`.
- **Talon and Dagger get `charge`** (Boss): every laser weapon now has `charge` (it feeds the "no supply with 2+ no-ammo" rule). Odds baseline re-saved.
- **Blitzer is `arc`** (Boss) and a new tag rule `laser` -> `charge` (laser weapons are assumed to be charge weapons; the tags otherwise stay separate). It applies to primaries, secondaries, support weapons and the Rover only: the Orbital Laser and Laser Sentry are not carried weapons, so they stay laser-only (`charge` on a stratagem would also count toward the no-supply rule). Note the Arc Thrower and Blitzer are `charge` but not `laser`, so charge does not imply laser.
- **Laser and plasma tags** (Boss): `laser` on LAS-5 Scythe, LAS-16 Sickle, LAS-17 Double-Edge Sickle, LAS-13 Trident, LAS-12 Sai, LAS-58 Talon, LAS-7 Dagger, LAS-98 Laser Cannon, LAS-99 Quasar Cannon, LAS-44 Nova, AX/LAS-5 Rover, Orbital Laser and A/LAS-98 Laser Sentry; `plasma` on SG-8P Punisher Plasma, PLAS-39 Accelerator Rifle, PLAS-1 Scorcher, PLAS-101 Purifier, PLAS-15 Loyalist and PLAS-45 Epoch. New tag rule: `beam` -> `laser`. Judgement calls to confirm: the wiki calls Quasar and Nova "energy-based" (Nova is "a laser weapon" in its tactics text, Quasar is never called a laser), so both got `laser` because of their LAS designation; the R-36 Eruptor and other non-LAS/PLAS energy weapons were left alone. Neither tag has a display title yet, so neither appears in the Rules dropdown.
- **Bubble + shield merged** (Boss): the old `bubble` tag is gone; every shield item has `shield`, and the two hand-held shield backpacks (SH-20 Ballistic, SH-51 Directional) also carry `handheld`. The "shield backpack needs a one-handed weapon" rule now keys on `handheld`, so the bubble packs and the relay no longer trigger it (rule id `shield` unchanged, so saved switches still work). Tag rule `handheld` -> `shield`; `handheld` is on the acknowledged-rare list.
- **Crayon colours instead of a Crayon mode** (Boss: the crayon system is already built into his tags, so no mode): the Chaff Killer pill is green (#27ae32), Medium Killer is now blue (#2f80ed, was orange) and Anti-Armor red (#c62828), each a little different from the green / blue / red of the stratagem icons (#699655 / #55b9d2 / #dc6455). Panic Weapon is still indigo (#2943b9), the closest neighbour of the new blue.
- **Panic is a weapon-only tag** (Boss): `panic` removed from the only two stratagems that had it (Orbital Smoke Strike, Orbital Laser), and a new `weapon_only_tags` check in `tools/tag_checks.py` / `tag_rules.json` flags it on any non-weapon item. Standing order in `TAG_CHECK.md`: Claude removes `panic` from stratagems whenever it finds it and reports which. The engine already only counted panic on weapons, so builds are unaffected.
- **beam no longer implies fire** (Boss changed his mind): `fire` removed from every item that has `beam` (LAS-5 Scythe, LAS-7 Dagger, LAS-98 Laser Cannon, AX/LAS-5 Rover, A/LAS-98 Laser Sentry), the beam -> fire rule removed from `tools/tag_rules.json` and `TAG_CHECK.md`. Heads-up for the meme-build tagging item: a "Fire" requirement no longer matches beam items.
- **AP proofing** (Boss checked every multi-icon and flagged item): PLAS-15 Loyalist 3, Orbital EMS Strike 6, A/M-23 EMS Mortar Sentry 3/6, Eagle Airstrike 5, TD-110 Maelstrom 4/5, MD-I4 Incendiary Mines 3; everything else confirmed as it was. Follow-up the same day: the explosion-based strikes now use the explosion's core AP (Eagle Gas Airstrike 6, Cluster Bomb 3, 500kg Bomb 6, Napalm Airstrike 3; Orbital Gas Strike 6, 120mm HE 5, Airburst 3, 380mm HE 6, Walking Barrage 6, Napalm Barrage 3); Eagle 110mm Rocket Pods (7), Orbital Precision Strike (8) and Orbital Railcannon Strike (7) stay projectile-based. Kept as they were by Boss: Eagle Strafing Run 5, Orbital Gatling Barrage 5, Orbital Laser 6.
- **Wiki scan decisions** (Boss): the two temporary Liberty Day 2026 stratagems (Orbital Confetti, Eagle Fly By) are skipped on purpose, because the game doesn't let you pick temporary stratagems in a loadout. The Halo: ODST warbond and the wiki's "Obedient Democracy Support Troopers" are the same warbond; no change needed. "G/40-K Meltamine" renamed "G/40-K Melta Mine" to match the wiki; "melta mine" and "meltamine" are both nicknames (saved ticks / faction edits under the old name are orphaned).
- **My Gear thumbnails confirmed working on the live site** (Boss). **Mobile layout** checked on Boss's phone: fine, closed for now. **Warbond header art** and **AP icons in My Gear rows** dropped from the list for now (Boss); the covers stay saved in `docs/img/warbonds/` in case we want them later.
- **LAS-12 Sai** added (primary, Superstore, `smg,chaff,onehand,med,panic,charge`, bug+squid, AP 3). Wiki scan the same day: no other permanent weapon or stratagem is missing from the CSV (primaries 57/57, secondaries 26/26, throwables 24/24, backpacks, vehicles, sentries, emplacements, Eagles, orbitals and support weapons all match), and the wiki's "Obedient Democracy Support Troopers" warbond is the same four items as our `odst` (Halo: ODST) warbond. The UI tests no longer hard-code the item count.
- **Armor penetration on stratagems** (icons moved to the right of the item name): 50 attacking stratagems got `armor_pen` (page's lead AP icon, later corrected by Boss's review, see the AP proofing entry above; Dog Breath counted as just 5 per Boss).
- **Armor penetration data**: new `armor_pen` column in `hd2gear.csv` (141 weapons), build validation, `armorPen` in the exported data, and the wiki icon links in the README. The cards now show it (both icons for two-mode weapons).
- **Enable for all factions** button in Edit factions mode, next to Reset to defaults: ticks all three factions for the items shown (second click to confirm; respects the search filter). Reset to defaults undoes it.

## Done 2026-10-29
- **Rules panel** (first version; rebuilt as one list of rows on 2026-10-30, see above): the "Require tags" section is now "Rules" with **Default rules** (a switch per rule, grouped by priority, caps switchable, in-game limits locked, "Turn all default rules back on") and **Additional rules** (tag + at least / at most / exactly + count; at least + at most make a range; 0 bans a tag). Engine: requirements are `{min?, max?}`, `disabledRules` option, `Engine.RULES` list. Switched-off rules are saved in `hd2_settings` and cleared by Reset. 17 new engine tests and a UI section cover it.
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
  smaller shortfall. Lives in `RULE_TIER` in `docs/engine.js` (the Rules list reads it to order the default rows).
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
