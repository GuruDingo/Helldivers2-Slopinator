"""Tag consistency checks for hd2gear.csv. Used by build_gear.py; run on its own with  python tools/tag_checks.py

Everything here only FLAGS problems. Nothing edits the CSV. The rules live in tools/tag_rules.json:
  implications          "if an item has tag A it must also have tag B" (optionally only for one category, with
                        a list of item names that are deliberate exceptions)
  min_items_per_tag     a tag used by fewer items than this is flagged, unless it is listed in ...
  acknowledged_rare_tags   tags Boss has already seen and accepted as rare
Also flagged: a tag listed twice on one item.
"""
import json
from pathlib import Path

RULES_JSON = Path(__file__).resolve().parent / "tag_rules.json"


def load_rules(path=RULES_JSON):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_tags(items, rules):
    """items: dicts with 'name', 'cat' and 'tags' (a list, repeats kept). Returns a list of flag messages."""
    flags = []

    for it in items:
        tags = it["tags"]
        dupes = sorted({t for t in tags if tags.count(t) > 1})
        if dupes:
            flags.append(f"'{it['name']}' lists the same tag twice: {', '.join(dupes)}")

    for rule in rules.get("implications", []):
        for it in items:
            if rule.get("category") and it["cat"] != rule["category"]:
                continue
            if rule["if"] in it["tags"] and rule["then"] not in it["tags"]:
                if it["name"] in rule.get("except", []):
                    continue
                scope = f" (for {rule['category']} items)" if rule.get("category") else ""
                flags.append(f"'{it['name']}' has '{rule['if']}' but not '{rule['then']}'{scope}")

    counts = {}
    for it in items:
        for t in set(it["tags"]):
            counts[t] = counts.get(t, 0) + 1
    known = set(rules.get("acknowledged_rare_tags", []))
    minimum = rules.get("min_items_per_tag", 3)
    for tag, n in sorted(counts.items()):
        if n < minimum and tag not in known:
            flags.append(
                f"NEW RARE TAG '{tag}' is used by only {n} item{'s' if n != 1 else ''} (fewer than {minimum}). "
                f"Is it intended, or a typo? If intended, add it to acknowledged_rare_tags in tools/tag_rules.json."
            )
    return flags


if __name__ == "__main__":  # python tools/tag_checks.py
    import csv
    root = Path(__file__).resolve().parent.parent
    with open(root / "hd2gear.csv", newline="", encoding="utf-8-sig") as f:
        rows = [
            {"name": r["name"].strip(), "cat": r["category"].strip(),
             "tags": [t.strip() for t in (r["tags"] or "").split(",") if t.strip()]}
            for r in csv.DictReader(f) if (r.get("name") or "").strip()
        ]
    out = check_tags(rows, load_rules())
    print("\n".join("flag: " + m for m in out) if out else "No tag inconsistencies.")
