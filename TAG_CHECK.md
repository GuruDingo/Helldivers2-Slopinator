# Tag check procedure (for Claude, not part of the build)

Run this whenever `hd2gear.csv` is updated (Boss attaches a new version). It only FLAGS problems - never edit the
CSV to fix a flag unless Boss says to.

1. Run `python3 tools/tag_checks.py` (reads `hd2gear.csv`, rules in `tools/tag_rules.json`).
2. Report every `flag:` line to Boss, grouped as:
   - missing implied tags (beam -> fire; heal/taunt/stun/smoke -> assist; smoke -> stealth; mortar -> sentry;
     a secondary with demo -> explosive). Listed exceptions in `tag_rules.json` (e.g. Orbital Laser for beam -> fire)
     are not flagged.
   - duplicate tags on one item.
   - NEW RARE TAG: a tag used by fewer than 3 items (`min_items_per_tag`) that is not in `acknowledged_rare_tags`
     (currently heal, shield, supply, tank, taunt). Ask Boss whether to keep it; if yes, add it to the list.
3. Also check that no item has zero tags.
4. Wait for Boss's answer before changing any item.

`python3 tests/tag_checks_test.py` tests the checker itself (not run by `tests/run_all.js`).
New rules agreed with Boss go into `tools/tag_rules.json`.
