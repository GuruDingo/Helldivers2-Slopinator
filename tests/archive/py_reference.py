"""
py_reference.py - the ORIGINAL Python generation engine, kept only as the yardstick for tests/parity.py.

This is the generation logic copied from hd2loadout.py (version 6/22/26e) with the CLI, HTML
export and tracker removed. The logic itself is untouched; the only edits are:
  - the data is loaded from ../hd2gear.csv relative to this file
  - ALL_WARBONDS is read from ../hd2warbonds.csv instead of the WARBONDS dict
Do not "improve" this file: its whole purpose is to behave exactly like the old tool.

The one addition is FIX_COUNTER_LEAK (default False = the original loop, byte-for-byte). Setting it
True swaps in a second loop that only updates the running counters when a stratagem is accepted,
so parity.py can also check the fixed JavaScript against an independent Python implementation.
"""

import csv
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent.parent
FIX_COUNTER_LEAK = False


@dataclass
class Item:
    name: str
    nicknames: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    factions: list = field(default_factory=lambda: ["any"])
    warbond: str = "base"
    img_url: str = ""
    cat: str = ""

    def works_for(self, faction):
        if "none" in self.factions:
            return False
        return faction == "any" or self.factions == ["any"] or faction in self.factions

    def has(self, tag):
        return tag in self.tags

    def has_nickname(self, nickname):
        return nickname in self.nicknames


@dataclass
class Stratagem(Item):
    pass


STRATAGEM_CATEGORIES = {"support", "backpack", "vehicle", "eagle", "orbital", "sentry", "defensive"}


def load_gear(csv_path: Path):
    primaries, secondaries, throwables, strategems = [], [], [], []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            nicknames    = [n.strip() for n in row["nicknames"].split(",") if n.strip()]
            tags         = [t.strip() for t in row["tags"].split(",") if t.strip()]
            factions     = [f.strip() for f in row["factions"].split(",") if f.strip()]
            warbond      = row["warbond"] or "base"
            img_url      = row.get("img_url", "")
            cat          = row["category"]

            if cat in ("primary", "secondary", "throwable"):
                item = Item(row["name"], nicknames, tags, factions, warbond, img_url, cat)
                if cat == "primary":   primaries.append(item)
                elif cat == "secondary": secondaries.append(item)
                else:                  throwables.append(item)
            elif cat in STRATAGEM_CATEGORIES:
                strategems.append(Stratagem(
                    name=row["name"], nicknames=nicknames, tags=tags, factions=factions,
                    warbond=warbond, img_url=img_url, cat=cat,
                ))
    return primaries, secondaries, throwables, strategems


PRIMARIES, SECONDARIES, THROWABLES, STRATEGEMS = load_gear(ROOT / "hd2gear.csv")
ALL_ITEMS_BY_NAME = {i.name: i for i in PRIMARIES + SECONDARIES + THROWABLES + STRATEGEMS}

with open(ROOT / "hd2warbonds.csv", newline="", encoding="utf-8-sig") as _f:
    ALL_WARBONDS = [r["key"] for r in csv.DictReader(_f)]


def weighted_choice(pool: list, reduced_tags: dict) -> object:
    weights = []
    for item in pool:
        weight = 1.0
        for tag, multiplier in reduced_tags.items():
            if item.has(tag):
                weight *= multiplier
        weights.append(weight)
    return random.choices(pool, weights=weights, k=1)[0]


def try_build(faction: str, owned_warbonds: list, locks: dict, requirements: dict = None, excluded: set = None) -> Optional[dict]:
    if requirements is None:
        requirements = {}

    if excluded is None:
        excluded = set()

    def pool(items):
        return [x for x in items if x.works_for(faction) and x.warbond in owned_warbonds and x.name not in excluded]

    # ── Weapons ──────────────────────────────────────────────────────────
    primary   = locks.get("primary")   or random.choice(pool(PRIMARIES) or [None])
    sec_pool  = pool(SECONDARIES)
    secondary = locks.get("secondary") or (weighted_choice(sec_pool, {"melee": 0.333}) if sec_pool else None)
    throwable = locks.get("throwable") or random.choice(pool(THROWABLES) or [None])
    if None in (primary, secondary, throwable):
        return None

    # ── Stratagems ───────────────────────────────────────────────────────
    locked_strats = [locks.get(f"strat{i}") for i in range(1, 5)]

    has_support_regular  = any(s and s.cat == "support" and not s.has("expendable") for s in locked_strats)
    has_support_expend   = sum(1 for s in locked_strats if s and s.cat == "support" and s.has("expendable"))
    has_backpack         = any(s and s.has("backpack") for s in locked_strats)
    has_vehicle          = any(s and s.cat == "vehicle" for s in locked_strats)

    eagle_count = sum(1 for s in locked_strats if s and s.has("eagle"))
    mine_count  = sum(1 for s in locked_strats if s and s.has("mines"))

    locked_names = {s.name for s in locked_strats if s}
    free_slots = [i for i, s in enumerate(locked_strats) if s is None]
    strat_pool = shuffle_list([s for s in pool(STRATEGEMS) if s.name not in locked_names])

    chosen = list(locked_strats)  # copy; Nones will be filled

    if FIX_COUNTER_LEAK:
        # Patched loop: identical rules, but counters only change if the stratagem is accepted.
        for s in strat_pool:
            if not free_slots:
                break
            if s.cat == "support" and not s.has("expendable"):
                if has_support_regular or has_support_expend > 0:
                    continue
            elif s.cat == "support" and s.has("expendable"):
                if has_support_regular or has_support_expend >= 2:
                    continue
            if s.has("backpack") and has_backpack:
                continue
            if s.cat == "vehicle" and has_vehicle:
                continue
            if s.has("eagle") and eagle_count >= 2:
                continue
            if s.has("mines") and mine_count >= 1:
                continue
            # accepted: now update the counters
            if s.cat == "support" and not s.has("expendable"):
                has_support_regular = True
            elif s.cat == "support" and s.has("expendable"):
                has_support_expend += 1
            if s.has("backpack"):
                has_backpack = True
            if s.cat == "vehicle":
                has_vehicle = True
            if s.has("eagle"):
                eagle_count += 1
            if s.has("mines"):
                mine_count += 1
            chosen[free_slots.pop(0)] = s
        strat_pool = []  # the original loop below then has nothing left to do

    for s in strat_pool:
        if not free_slots:
            break

        if s.cat == "support" and not s.has("expendable"):
            if has_support_regular or has_support_expend > 0:
                continue  # non-expendable can't stack with anything
            has_support_regular = True

        elif s.cat == "support" and s.has("expendable"):
            if has_support_regular:
                continue  # can't mix with non-expendable
            if has_support_expend >= 2:
                continue  # max 2 expendables
            has_support_expend += 1

        if s.has("backpack"):
            if has_backpack:
                continue
            has_backpack = True

        if s.cat == "vehicle":
            if has_vehicle:
                continue
            has_vehicle = True

        if s.has("eagle"):
            if eagle_count >= 2:
                continue
            eagle_count += 1

        if s.has("mines"):
            if mine_count >= 1:
                continue
            mine_count += 1

        idx = free_slots.pop(0)
        chosen[idx] = s

    if any(s is None for s in chosen):
        return None

    actual_backpack_count = sum(
        1 for s in chosen
        if s.has("backpack")
    )
    locked_backpack_count = sum(
        1 for s in locked_strats
        if s and s.has("backpack")
    )
    if locked_backpack_count == 0 and actual_backpack_count != 1:
        return None

    actual_support_count = sum(
        1 for s in chosen
        if s.cat == "support"
    )
    all_strats_locked = all(s is not None for s in locked_strats)
    if not all_strats_locked and actual_support_count < 1:
        return None

    all_items    = [primary, secondary, throwable] + chosen
    chaff_items  = [primary, secondary]
    panic_items  = [primary, secondary, throwable]
    covers_armor = any(i.has("armor") for i in all_items)
    covers_med   = any(i.has("med")   for i in all_items)
    covers_chaff = any(i.has("chaff") for i in chaff_items)
    covers_demo  = any(i.has("demo")  for i in all_items)
    covers_panic = any(i.has("panic") for i in panic_items)

    req_tags = set(requirements.keys())
    if "armor" not in req_tags and not covers_armor: return None
    if "med"   not in req_tags and not covers_med:   return None
    if "chaff" not in req_tags and not covers_chaff: return None
    if "demo"  not in req_tags and not covers_demo:  return None
    if "panic" not in req_tags and not covers_panic: return None

    if requirements:
        for tag, min_count in requirements.items():
            actual = sum(1 for i in all_items if i.has(tag))
            if actual < min_count:
                return None

    chaff_n = sum(1 for i in all_items if i.has("chaff"))
    med_n   = sum(1 for i in all_items if i.has("med"))
    armor_n = sum(1 for i in all_items if i.has("armor"))

    if (abs(chaff_n - med_n)   > 3 or
        abs(chaff_n - armor_n) > 3 or
        abs(med_n   - armor_n) > 3):
        return None

    demo_items = [i for i in all_items if i.has("demo")]
    demo_from_weapons = [i for i in [primary, secondary, throwable] if i.has("demo")]

    if demo_items and not demo_from_weapons:
        if len(demo_items) < 2:
            return None

    has_shield_backpack = any(s.has("shield") for s in chosen)
    if has_shield_backpack:
        if not (primary.has("onehand") or secondary.has("onehand")):
            return None

    charge_count = sum(
        1 for i in [primary, secondary] + chosen
        if i.has("charge")
    )
    no_ammo_factor = charge_count + has_support_expend
    if no_ammo_factor >= 2:
        if any(s.has("supply") for s in chosen):
            return None

    return dict(
        primary=primary, secondary=secondary, throwable=throwable,
        strategems=chosen,
        covers_armor=covers_armor, covers_med=covers_med, covers_chaff=covers_chaff, covers_demo=covers_demo, covers_panic=covers_panic,
    )


def shuffle_list(lst):
    lst = list(lst)
    random.shuffle(lst)
    return lst


def generate_loadout(faction="any", owned_warbonds=None, locks=None, requirements=None, excluded=None, max_attempts=1000) -> dict:
    if owned_warbonds is None:
        owned_warbonds = ALL_WARBONDS
    if locks is None:
        locks = {}
    if excluded is None:
        excluded = set()
    if requirements is None:
        requirements = {}
    for _ in range(max_attempts):
        result = try_build(faction, owned_warbonds, locks, requirements, excluded)
        if result:
            return result
    raise RuntimeError(
        f"Could not build a valid loadout for faction='{faction}' with the given constraints "
        f"after {max_attempts} attempts."
    )


def generate_loadout_relaxed(faction="any", owned_warbonds=None, locks=None, requirements=None, excluded=None, max_attempts=1000) -> dict:
    try:
        result = generate_loadout(
            faction=faction, owned_warbonds=owned_warbonds, locks=locks,
            requirements=requirements, excluded=excluded, max_attempts=max_attempts,
        )
        result["faction_overridden"] = False
        result["suboptimal_names"] = set()
        return result
    except RuntimeError:
        if faction == "any":
            raise

    result = generate_loadout(
        faction="any", owned_warbonds=owned_warbonds, locks=locks,
        requirements=requirements, excluded=excluded, max_attempts=max_attempts,
    )
    all_items = [result["primary"], result["secondary"], result["throwable"]] + result["strategems"]
    result["faction_overridden"] = True
    result["suboptimal_names"] = {i.name for i in all_items if not i.works_for(faction)}
    return result
