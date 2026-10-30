# Tag check procedure (for Claude, not part of the build)

Run this whenever `hd2gear.csv` is updated (Boss attaches a new version). It only FLAGS problems - never edit the
CSV to fix a flag unless Boss says to (one standing exception: `panic` on a stratagem, see step 2).

1. Run `python3 tools/tag_checks.py` (reads `hd2gear.csv`, rules in `tools/tag_rules.json`).
2. Report every `flag:` line to Boss, grouped as:
   - missing implied tags (heal/taunt/stun/smoke -> assist; smoke -> stealth; mortar -> sentry;
     a secondary with demo -> explosive; handheld -> shield; beam -> laser; the old beam -> fire rule was dropped on 2026-10-30, beam items do not need fire). Listed exceptions in `tag_rules.json`
     are not flagged.
   - duplicate tags on one item.
   - WEAPON-ONLY TAG on the wrong item (`weapon_only_tags`; today `panic` on anything that is not a primary, secondary
     or throwable). This one is the exception to "never edit": Boss's standing order (2026-10-30) is to REMOVE `panic`
     from every stratagem tag list straight away, then tell him which items it was removed from. Rebuild
     (`python3 tools/build_gear.py`) and re-save the odds baseline afterwards.
   - NEW RARE TAG: a tag used by fewer than 3 items (`min_items_per_tag`) that is not in `acknowledged_rare_tags`
     (currently heal, handheld, supply, tank, taunt). Ask Boss whether to keep it; if yes, add it to the list.
3. Also check that no item has zero tags.
4. Wait for Boss's answer before changing any item (apart from the standing `panic` removal above).

`python3 tests/tag_checks_test.py` tests the checker itself (not run by `tests/run_all.js`).
New rules agreed with Boss go into `tools/tag_rules.json`.
