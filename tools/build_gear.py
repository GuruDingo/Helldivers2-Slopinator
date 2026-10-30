"""
build_gear.py - turns the two editable CSV files into the data file the website reads.

    hd2gear.csv        one row per item (you edit this in Excel)
    hd2warbonds.csv    warbond keys + display names + cover image URLs, in display order
        ->  docs/gear-data.js

Run it from anywhere after you change either CSV:

    python tools/build_gear.py            # validate + rebuild docs/gear-data.js
    python tools/build_gear.py --bundle   # also write dist/hd2-randomizer.html (everything in one file)

It refuses to write anything if it finds a real problem (unknown category, unknown
warbond key, duplicate names...), so a typo in the CSV can't silently break the site.

Tag consistency is NOT checked here; that is a separate manual procedure (see TAG_CHECK.md).
"""

import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEAR_CSV = ROOT / "hd2gear.csv"
WARBOND_CSV = ROOT / "hd2warbonds.csv"
OUT_JS = ROOT / "docs" / "gear-data.js"
DIST_HTML = ROOT / "dist" / "hd2-randomizer.html"

WEAPON_CATEGORIES = {"primary", "secondary", "throwable"}
STRATAGEM_CATEGORIES = {"support", "backpack", "vehicle", "eagle", "orbital", "sentry", "defensive"}
FACTION_VALUES = {"any", "bug", "bot", "squid", "none"}


def split_list(raw):
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


def load_warbonds():
    with open(WARBOND_CSV, newline="", encoding="utf-8-sig") as f:
        rows = [(r["key"].strip(), r["name"].strip(), (r.get("img_url") or "").strip())
                for r in csv.DictReader(f) if r["key"].strip()]
    keys = [k for k, _, _ in rows]
    dupes = {k for k in keys if keys.count(k) > 1}
    if dupes:
        sys.exit(f"ERROR: duplicate warbond keys in {WARBOND_CSV.name}: {sorted(dupes)}")
    if "base" not in keys:
        sys.exit(f"ERROR: {WARBOND_CSV.name} must contain a 'base' warbond.")
    return rows


def load_items(warbond_keys):
    errors, warnings, items = [], [], []
    with open(GEAR_CSV, newline="", encoding="utf-8-sig") as f:
        for line_no, row in enumerate(csv.DictReader(f), start=2):  # line 1 is the header
            name = (row.get("name") or "").strip()
            where = f"{GEAR_CSV.name} line {line_no} ({name or 'no name'})"
            cat = (row.get("category") or "").strip()
            factions = split_list(row.get("factions"))
            warbond = (row.get("warbond") or "").strip() or "base"

            if not name:
                errors.append(f"{where}: missing name")
                continue
            if cat not in WEAPON_CATEGORIES | STRATAGEM_CATEGORIES:
                errors.append(f"{where}: unknown category '{cat}'")
            if warbond not in warbond_keys:
                errors.append(f"{where}: warbond '{warbond}' is not listed in {WARBOND_CSV.name}")
            if not factions:
                errors.append(f"{where}: factions is empty (use 'any' for everything, 'none' to disable)")
            bad = [x for x in factions if x not in FACTION_VALUES]
            if bad:
                errors.append(f"{where}: unknown faction value(s) {bad}")
            if "any" in factions and len(factions) > 1:
                warnings.append(f"{where}: 'any' mixed with other factions is NOT treated as universal")
            if not (row.get("img_url") or "").strip():
                warnings.append(f"{where}: no img_url")

            # armor_pen: the main attack's armor-penetration level(s) as the wiki icons number them (-1 = no hitbox,
            # 0 = unarmored, 2 = light, 3 = medium, 4 = heavy, 5-10 = anti-tank I-VI, 11 = indestructible). Weapons with
            # two modes list both, "2/4". Blank is fine for stratagems that aren't weapons.
            armor_raw = (row.get("armor_pen") or "").strip()
            armor_pen = []
            if armor_raw:
                for part in armor_raw.split("/"):
                    try:
                        level = int(part.strip())
                    except ValueError:
                        level = None
                    if level is None or not -1 <= level <= 11:
                        errors.append(f"{where}: armor_pen '{armor_raw}' must be whole numbers from -1 to 11, joined by '/' (e.g. 3 or 2/4)")
                        armor_pen = []
                        break
                    armor_pen.append(level)
            elif cat in WEAPON_CATEGORIES or cat == "support":
                warnings.append(f"{where}: no armor_pen")

            items.append({
                "id": (row.get("id") or "").strip(),
                "cat": cat,
                "name": name,
                "nicknames": [n.lower() for n in split_list(row.get("nicknames"))],
                "tags": split_list(row.get("tags")),
                "factions": factions,
                "warbond": warbond,
                "imgUrl": (row.get("img_url") or "").strip(),
                "armorPen": armor_pen,
            })

    # duplicate names / nicknames (the lock + exclude boxes resolve by either one)
    seen_names = {}
    for it in items:
        key = it["name"].lower()
        if key in seen_names:
            errors.append(f"duplicate item name '{it['name']}'")
        seen_names[key] = it
    seen_nick = {}
    for it in items:
        for nick in it["nicknames"]:
            owner = seen_nick.get(nick)
            if owner and owner != it["name"]:
                errors.append(f"nickname '{nick}' is used by both '{owner}' and '{it['name']}'")
            elif nick in seen_names and seen_names[nick]["name"] != it["name"]:
                errors.append(f"nickname '{nick}' of '{it['name']}' is also the full name of '{seen_names[nick]['name']}'")
            seen_nick[nick] = it["name"]
    return items, errors, warnings


def write_data_js(warbonds, items):
    # One warbond / one item per line: compact, but still readable in a git diff.
    def lines(rows):
        return ",\n".join("  " + json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows)

    body = (
        "{\n"
        ' "warbonds": [\n' + lines([{"key": k, "name": n, "imgUrl": u} for k, n, u in warbonds]) + "\n ],\n"
        ' "items": [\n' + lines(items) + "\n ]\n"
        "}"
    )
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(
        "// AUTO-GENERATED by tools/build_gear.py from hd2gear.csv + hd2warbonds.csv - do not edit by hand.\n"
        f"globalThis.HD2_DATA = {body};\n",
        encoding="utf-8",
    )


def write_bundle():
    """Inline style.css, gear-data.js, engine.js and app.js into one self-contained HTML file."""
    docs = ROOT / "docs"
    html = (docs / "index.html").read_text(encoding="utf-8")

    def inline_css(match):
        return "<style>\n" + (docs / match.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def inline_js(match):
        code = (docs / match.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        return "<script>\n" + code + "\n</script>"

    html, n_css = re.subn(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html, n_js = re.subn(r'<script src="([^"]+)"></script>', inline_js, html)
    DIST_HTML.parent.mkdir(parents=True, exist_ok=True)
    DIST_HTML.write_text(html, encoding="utf-8")
    print(f"Bundled {n_css} stylesheet(s) + {n_js} script(s) -> {DIST_HTML.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bundle", action="store_true", help="also write dist/hd2-randomizer.html")
    args = ap.parse_args()

    warbonds = load_warbonds()
    items, errors, warnings = load_items({k for k, _, _ in warbonds})

    for w in warnings:
        print("warning:", w)
    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(f"\n{len(errors)} problem(s) found - nothing was written.")

    write_data_js(warbonds, items)
    live = sum(1 for i in items if "none" not in i["factions"])
    print(f"Wrote {OUT_JS.relative_to(ROOT)}: {len(items)} items ({live} active), {len(warbonds)} warbonds.")
    if args.bundle:
        write_bundle()


if __name__ == "__main__":
    main()
