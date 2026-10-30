# Helldivers 2 Slopinator

A loadout randomizer fan project for Helldivers 2.

**Use it online: https://gurudingo.github.io/Helldivers2-Slopinator/**

A static website: the loadout randomizer and warbond tracker run entirely in the visitor's browser.
No server, no accounts, nothing to host except the files in `docs/`.

## Layout

```
hd2gear.csv            gear database - you edit this (Excel is fine)
hd2warbonds.csv        warbond keys + display names + cover image URLs (img_url), in display order
tools/build_gear.py    validates both CSVs and writes docs/gear-data.js
tools/fetch_images.py  saves the wiki images into docs/img/ (see "Saved images")
docs/                  the website (this folder is what gets published)
  index.html  style.css  app.js        page + UI
  engine.js                            generation rules (port of try_build)
  gear-data.js                         GENERATED - don't edit by hand
  img/                                 saved copies of the wiki images + manifest.json (made by fetch_images.py)
tests/                 rule tests, seeded regression test, UI smoke test (run_all.js runs them all); archive/ = old Python parity test
TODO.md                pinned follow-ups and open decisions
```

## Updating the gear (new content from the wiki)

Do this when a release adds weapons, stratagems or a warbond. The wiki's page for each item has what you need.

1. **Collect the data for each new item**: name, category (`primary`, `secondary`, `throwable`, `support`, `backpack`, `vehicle`, `eagle`, `orbital`, `sentry`, `defensive`), the warbond it belongs to, its picture address (the weapon's "Render" image, or the stratagem icon image), and its armor penetration (below).
2. **Add a row to `hd2gear.csv`** (Excel is fine; keep the file's line endings). Columns: `id` (next number), `category`, `name`, `nicknames` (lower case, comma separated, each unique across the game), `tags`, `factions` (`any`, or a list of `bug`, `bot`, `squid`), `warbond` (a key from `hd2warbonds.csv`, or `base`), `img_url` (the wiki address) and `armor_pen`. Tags and factions are judgment calls; copy a similar item.
   - `armor_pen` is the main attack's armor-penetration icon number (-1 no hitbox, 0 unarmored, 2 light, 3 medium, 4 heavy, 5-10 anti-tank I-VI, 11 indestructible), two numbers joined by `/` for a two-mode weapon (`2/4`), blank for something that does no damage. For stratagems, use the AP icon the wiki page leads with, not the structure's own armor (`AV`) icons.
3. **If there is a new warbond**: add a row to `hd2warbonds.csv` (key, display name, cover image address; the key is what the items' `warbond` column uses), and add its title icon to `WARBOND_ICONS` in `docs/app.js`. Only a new Requisition shop needs more: add its key to `warbondPillName` and `WARBOND_GROUPS` in `docs/app.js` (ask me). The UI tests work out the item count from the data, but they still hard-code the number of warbonds (36) and top-level My Gear blocks (31), so those two numbers need updating when a warbond is added.
4. **Rebuild**: `python tools/build_gear.py`. It checks for typos (unknown category or warbond, duplicate names or nicknames, bad `armor_pen`) and rebuilds `docs/gear-data.js`; it writes nothing if it finds an error. Warnings about a missing picture or `armor_pen` are only reminders.
5. **Save the new pictures**: GitHub's Actions tab -> "Fetch images" -> Run workflow (or `python tools/fetch_images.py`), then merge the `images-fetched` branch it creates. Only missing files are downloaded. Until that is done the new items show their wiki pictures, so nothing breaks. See "Saved images".
6. **Check the tags** (this is a manual step, not part of the build): follow `TAG_CHECK.md` (`python tools/tag_checks.py`). It flags missing implied tags and tags used by fewer than three items; nothing is changed without your say-so.
   - A new **meme tag** (an elemental or themed build tag such as fire, arc, gas, stealth, explosive, laser or plasma) also needs a display title in `TAG_NAMES` and a pill colour in `TAG_COLORS` in `docs/app.js`; all meme tags get pills. Any other new tag only needs a title if it should appear in the Rules dropdown.
7. **Re-save the odds baseline and run every test**: `node tests/regression.js --update-baseline`, then `node tests/run_all.js`. New items change the odds, so the regression test's baseline needs refreshing after an intentional change like this.
8. **Publish**: commit the CSVs, `docs/gear-data.js`, `docs/img/` and `tests/baseline.json` on a branch, open a pull request (the test run attaches a downloadable build so you can try it first), merge it, and hard-refresh the live site.

Renaming an item changes the name your saved My Gear ticks and faction edits are keyed by, so those items will show as new (unticked) in a browser that had saved settings.

## Trying it locally

Open `docs/index.html` in a browser (double-click works - no server needed), or run
`python tools/build_gear.py --bundle` to get one self-contained file, `dist/hd2-randomizer.html`,
that you can send to a friend as-is.

## My Gear: warbond groups

The six Requisition shops are shown under one collapsible **Requisition** header (with the Requisition Slip icon and its own Own / Block buttons and count), and inside it each shop appears by its short name (Hangar, Bridge, ...). The data is unchanged: the CSV still calls them `Requisition: Hangar` etc., which is what search and the loadout-card pill use, so typing "requisition" still finds all of them. Which warbonds group together is the `WARBOND_GROUPS` list in `docs/app.js`.

## What the page stores

Everything stays in the visitor's browser (localStorage): `hd2_tracker` (items owned), `hd2_blocked` (items you have
blocked), `hd2_factions` (your edits to which factions each item is recommended against; only items that differ from the CSV) and `hd2_settings` (faction and any default rules you switched off). The randomizer rolls from owned items that are not blocked.
Base Game gear is always owned. A browser with no saved data starts with everything owned.

## Publishing on GitHub Pages

Repo -> Settings -> Pages -> Source: "Deploy from a branch" -> Branch `main`, folder `/docs` -> Save.
The site appears at `https://<your-user>.github.io/<repo-name>/` after a minute or so.

## Saved images (no more hotlinking)

The page shows pictures from the Helldivers wiki: item art (about 200), the faction emblems, the warbond title icons, the Requisition slip and the 13 armor-penetration icons. `tools/fetch_images.py` saves them all into `docs/img/` so the published site serves its own copies and keeps working if the wiki changes a file or blocks hotlinking.

```
pip install pillow                       # once, for resizing
python tools/fetch_images.py             # download what is missing (about 280 files, a few minutes; polite rate limit)
python tools/build_gear.py               # copies the list into docs/gear-data.js
python tools/fetch_images.py --list      # what is saved / still missing, no downloading
python tools/fetch_images.py --from-dir D   # use pictures you downloaded yourself into folder D (by wiki file name)
```

- The wiki address stays in the CSVs as the source. The fetch writes `docs/img/manifest.json` (wiki address -> saved file); the build copies it into `docs/gear-data.js` as `HD2_DATA.images`, and the page uses the saved copy of any picture that has one, otherwise the wiki link. So a half-finished run never breaks the site.
- Item art and warbond covers are shrunk (320 px / 480 px longest side) and saved as WebP; SVGs (all the stratagem icons) and the small icons are kept as they are. Files that already exist are skipped (`--force` redoes them).
- If a download fails (the script says which), the site keeps using that wiki link; run it again later.
- **No computer needed:** Actions tab -> "Fetch images" -> Run workflow. It runs the same script on GitHub, saves the pictures to a branch called `images-fetched` and attaches them to the run as a download; then open a pull request from that branch.
- The single-file build (`dist/hd2-randomizer.html`) embeds the saved pictures, so it works offline (several MB).
- When you add an item or warbond with a new `img_url`, or a new wiki image in `app.js`, run the fetch again.
- The pictures belong to Arrowhead Game Studios and come from the community-run [Helldivers Wiki](https://helldivers.wiki.gg/); this is an unofficial fan project.

## Tests

```
npm install jsdom                 # once, for the UI test (not needed to run the site)
node tests/run_all.js             # rebuild + every test, ~12 seconds
```

`run_all.js` runs, in order: the build (`tools/build_gear.py --bundle`), `fetch_images_test.py` (the image tool, offline; needs Pillow, skipped without it), `engine_rules.js` (best-effort builds, lock
exemptions, flagged rules), `regression.js` and `ui_smoke.js` (clicks through the page in jsdom).

`regression.js` draws 2000 seeded builds for each scenario in `tests/scenarios.json` and checks (1) invariants on
every build (4 distinct stratagems, locks kept, exclusions and unticked warbonds respected, no unmet rules on
plain unlocked builds, every scenario still feasible) and (2) per-item appearance rates against
`tests/baseline.json`. It catches rule-sized changes (loosening one rule moved some items by |z| ~ 15) but not
tiny tilts of a couple of percent. **After an intentional rule change, or after editing the CSVs**, re-save the baseline:
`node tests/regression.js --update-baseline` (if the CSVs changed the odds check is skipped with a notice until you do).

`tests/archive/` holds the one-off parity test against the original Python tool (slow, ~10 min); see its README.

## Editing faction recommendations

On the My Gear tab, the **Edit factions** switch (top right) shows three ticks on every item: **T**erminid, **A**utomaton, **I**lluminate. They show the faction emblems (the same emblems are on the faction buttons on the Randomizer tab; Any uses the Super Earth emblem, white) and start from the CSV's `factions` column (`any` = all three ticked). The emblems are linked from the Helldivers wiki like the item images and are flattened and tinted with CSS filters in the faction colours (dark on the selected faction button) - if you ever change a faction colour, regenerate its filter in `style.css`; if one can't load, the tick shows T / A / I and the button just shows its name. Change them and the randomizer, the pool counts and the Randomizer-tab pool line use your version. Details:
- All three ticked is the same as `any`. With none ticked an item only rolls when the faction is Any.
- Edited items get a coloured edge and a ↺ button that puts that one item back; **Reset to defaults** (only shown in this mode) resets everything, needs a second click to confirm, and while the search box is filtering it only resets the items shown.
- **Enable for all factions** (next to Reset) ticks all three for every item that isn't already for all factions, with the same second-click confirmation and the same "shown only" behaviour while searching. It counts as an edit for any item whose CSV default was narrower, and Reset to defaults undoes it.
- Only differences from the CSV are saved (`hd2_factions`), so when the CSV changes its defaults, items you haven't edited follow the new CSV. Edits are keyed by item name, so renaming an item in the CSV orphans its edit.
- Results already on screen are not changed; the next Generate or reroll uses the new lists.

## Locking and rerolling slots in the results

Each card in a generated loadout has a lock toggle (🔒/🔓) and a reroll button (🎲); each loadout has a **Reroll all unlocked** button.
- Locked slots are kept; the Locks panel's entries start out locked.
- 🎲 rerolls just that slot (always a different item when another choice exists) and keeps the other six exactly as they are, so the other six slots count as locked for that build. The usual rules still apply as far as the slot allows, and anything it can't meet is flagged.
- **Reroll all unlocked** keeps the locked slots and rebuilds the rest as a whole, so the rules can be met again.
- Locks on cards belong to that loadout only (they are not copied into the Locks panel, and Generate starts fresh). Rerolls use the faction, additional rules and default-rule switches the loadout was generated with, but your current My Gear pool.

## Rules panel (default rules and additional rules)

The **Rules** section of the randomizer page has two parts.

**Default rules** - one switch for every rule the engine checks, grouped by priority (the same ranking used when a build can't meet everything): backpack / shield / supply, then anti-tank / chaff / base breaker, then support / medium killer / panic weapon, then balance and base-breaker escalation. The fill-time **limits** (one regular support weapon or up to two expendable ones, one vehicle, two Eagles, one mine) have switches too. Switched-off rules are never enforced and never flagged. They are saved in this browser, and "Turn all default rules back on" (or Reset) restores them. The list comes from `Engine.RULES`, so the panel can't drift from the engine; the engine option is `disabledRules: ["armor", "capEagle", ...]`.

The **in-game limits** (one FRV, one tank, one exosuit) are shown with a lock and cannot be switched off.

**Additional rules** - your own count rule for a tag across the whole loadout: **at least**, **at most** or **exactly** N. Adding a rule for a tag replaces the default check for that tag, and a required count also lifts that tag's cap (see below). "At least" and "at most" on the same tag make a range (chip `Chaff Killer 2-3`); "exactly" sets both. An "at most 0" or "exactly 0" rule bans the tag - for the backpack tag it also replaces the "exactly one backpack" rule. A plain "at most N" (N of 1 or more) keeps the default "at least one" check for that tag. Rules that can't all hold (for example locks that break an "at most") are built as well as possible and listed above the loadout, like any other unmet rule. In code a rule is `{ min?, max? }`; a plain number still means "at least".

## Armor penetration (`armor_pen` column)

`hd2gear.csv` has an `armor_pen` column for every weapon (primaries, secondaries, throwables and support weapons) and for every stratagem that attacks (sentries, Eagles, orbitals, vehicles, mines, emplacements, the Hellbomb and the attacking Guard Dogs); stratagems that do no damage (smoke strikes, shields, supply, jump, hover and warp packs) are blank. It holds the main attack's armor-penetration level as the wiki's icons number it, and an item with two attacks lists both, e.g. `2/4`. For stratagems the value is the AP icon the wiki's page leads with (the strike's main projectile or the mounted weapon's direct hit), not the separate explosion or fire entries, and never the structure's own armor value (the wiki's `AV` icons). Where a strike's projectile and its explosion differ, the value follows what matters in play. Explosion-based strikes use the explosion's core AP (Eagle Airstrike 5, not the projectile's 7; Orbital EMS Strike 6, its EMS effect); the projectile-based ones keep the projectile (Eagle 110mm Rocket Pods 7, Orbital Precision Strike 8, Orbital Railcannon Strike 7), and a few items list two (Maelstrom `4/5`, EMS Mortar Sentry `3/6`). Exosuits and vehicles with two weapons list both (Patriot `3/6`, Lumberer `4/6`, Bastion `4/8`). On the card the icons sit at the right of the item name. `tools/build_gear.py` checks the format (whole numbers from -1 to 11 joined by `/`), warns about a weapon with no value, and writes it to `docs/gear-data.js` as `armorPen: [n, ...]`. Each weapon card on the Randomizer tab shows the icon for each level, side by side with a `/` between them for a two-mode weapon (hover for the name). If an icon can't load, the level's name is shown as text instead.

Values came from the wiki's Weapons page (primaries, secondaries, throwables) and each support weapon's own page, with a few single-attack support weapons taken from the wiki's Damage Comparison table (MGX-42, MG-206, LAS-98, CQC-1, TX-41, B/MD C4, CQC-9, B/FLAM-80, AMW-20). Where a weapon has several attacks (a rocket plus its explosion, a rifle plus an underbarrel launcher) the value is the weapon's main/highest attack as the wiki lists it, so a few explosive weapons are rated by the explosion. The three support weapons the wiki's Weapons page shows with two icons were set by hand from it: Recoilless Rifle `5/6`, Epoch `4/5` and Defoliation Tool `3/5`. Re-check a number against the wiki whenever it looks wrong; the game changes these in patches.

Icons come from the wiki (saved locally once `tools/fetch_images.py` has been run; see "Saved images"):

| n | Name | Icon |
|---|---|---|
| -1 | No Hitbox | `https://helldivers.wiki.gg/images/Armor_AP-1_Icon.png` |
| 0 | Unarmored | `https://helldivers.wiki.gg/images/Armor_AP0_Icon.png` |
| 1 | Very Light | `https://helldivers.wiki.gg/images/Armor_AP1_Icon.png` |
| 2 | Light | `https://helldivers.wiki.gg/images/Armor_AP2_Icon.png` |
| 3 | Medium | `https://helldivers.wiki.gg/images/Armor_AP3_Icon.png` |
| 4 | Heavy | `https://helldivers.wiki.gg/images/Armor_AP4_Icon.png` |
| 5 | Anti-Tank I | `https://helldivers.wiki.gg/images/Armor_AP5_Icon.png` |
| 6 | Anti-Tank II | `https://helldivers.wiki.gg/images/Armor_AP6_Icon.png` |
| 7 | Anti-Tank III | `https://helldivers.wiki.gg/images/Armor_AP7_Icon.png` |
| 8 | Anti-Tank IV | `https://helldivers.wiki.gg/images/Armor_AP8_Icon.png` |
| 9 | Anti-Tank V | `https://helldivers.wiki.gg/images/Armor_AP9_Icon.png` |
| 10 | Anti-Tank VI | `https://helldivers.wiki.gg/images/Armor_AP10_Icon.png` |
| 11 | Indestructible | `https://helldivers.wiki.gg/images/Armor_AP11_Icon.png` |

## Item caps and in-game limits

While filling stratagem slots the engine keeps a few balance caps: one non-expendable support weapon, two expendable ones (never mixed with a regular one), one backpack-slot item, one vehicle, two Eagles, one mine. A **required tag overrides the cap for its own tag** - e.g. `Eagle 3` allows three Eagles, `mines 2` allows two mines, `vehicle 3` allows several vehicles. Requiring one tag never loosens a different cap, and locks still bypass the caps.

The exception is the **in-game limits**: only one FRV, one tank and one exosuit can be brought. These always win, so `vehicle 4` is unmeetable (it is built as well as possible and flagged), and locking two FRVs/tanks/exosuits is rejected with an error. Note that `backpack 2` also relaxes the backpack cap (it is not an in-game limit yet), which can give a build the game would not allow; it is flagged as an unmet backpack rule.

## Tag consistency checks

Not part of the build. It is a manual procedure Claude runs when `hd2gear.csv` is updated; it only flags and never edits the CSV. See `TAG_CHECK.md`, `tools/tag_checks.py` and `tools/tag_rules.json`.

## When the rules can't all be met

Locks, warbond choices, exclusions or requirements can make some guarantees impossible. The engine then
tries, in order: (1) a build that follows every rule, (2) the same with the faction relaxed to "any"
(off-faction picks are flagged), (3) the build that misses the least important rules (priority tiers: your own requirements > one backpack / shield needs a one-hander / no supply with 2+ no-ammo > anti-tank, chaff, base breaker > support weapon, medium killer, panic weapon > two base breakers, balance), fewer misses breaking ties. Case 3 is completed anyway and
the missed rules are listed above the loadout. Locking all four stratagem slots waives the "exactly one
backpack" and "at least one support weapon" rules. Only a build with *no* eligible items for a slot is an error.

## The counter-leak fix (differs from the original Python tool)

In the stratagem fill loop the old Python code updated its running counters (support, backpack, vehicle,
eagle, mine) *before* the later checks that could still reject the pick, so a rejected stratagem could
block later, perfectly legal ones (e.g. a rejected Autocannon blocking a Quasar Cannon). It never produced
an illegal loadout, but it tilted the odds: loadouts whose backpack slot is a support weapon (Autocannon,
Recoilless, ...) came up ~41% of the time versus ~39% without the bug, and real backpacks slightly less.

`engine.js` now only updates the counters when a pick is accepted. `HD2Engine.create(data, { legacyCounterLeak: true })`
restores the old behaviour (used by the archived parity test). `node tests/archive/leak_impact.js` shows the size of the difference. The fixed loop is still a greedy first-fit over a shuffle, so it is not
perfectly uniform over all legal loadouts - it just no longer has this accidental tilt.
