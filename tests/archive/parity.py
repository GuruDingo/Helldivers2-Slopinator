"""
parity.py - does the JavaScript engine behave like the original Python engine?

For every scenario in scenarios.json it draws N loadouts from BOTH engines and compares how often
each item shows up (two-proportion z-test per item), plus the average count of key tags.
Different random generators can never match draw-for-draw, so we compare distributions:
with ~200 items and N in the thousands, a faithful port keeps the biggest |z| around 3-4;
a real behavioural difference shows up as |z| of 6 or more.

    python tests/parity.py                 # JS engine (counter leak fixed) vs the Python reference with the same fix
    python tests/parity.py --legacy        # JS legacyCounterLeak vs the ORIGINAL Python, quirk and all
    python tests/parity.py --quick         # 1/4 of the samples, for a fast sanity check
"""

import argparse
import json
import math
import random
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import py_reference as ref  # noqa: E402

Z_LIMIT = 5.0          # max |z| we tolerate before calling a scenario a mismatch
MIN_EXPECTED = 30      # skip items too rare to test (expected count below this in either engine)


def run_python(scenario, n):
    by_name = ref.ALL_ITEMS_BY_NAME
    locks = {slot: by_name[name] for slot, name in scenario.get("locks", {}).items()}
    excluded = {by_name[n_].name for n_ in scenario.get("exclude", [])}
    counts = {"primary": {}, "secondary": {}, "throwable": {}, "strat": {}}
    tag_stats = {t: 0 for t in ("chaff", "med", "armor", "demo", "panic", "backpack")}
    overridden = failures = 0

    def bump(bucket, name):
        bucket[name] = bucket.get(name, 0) + 1

    for _ in range(n):
        try:
            loadout = ref.generate_loadout_relaxed(
                faction=scenario["faction"], owned_warbonds=scenario.get("warbonds"),
                locks=locks, requirements=scenario.get("require", {}), excluded=excluded,
            )
        except RuntimeError:
            failures += 1
            continue
        bump(counts["primary"], loadout["primary"].name)
        bump(counts["secondary"], loadout["secondary"].name)
        bump(counts["throwable"], loadout["throwable"].name)
        for s in loadout["strategems"]:
            bump(counts["strat"], s.name)
        items = [loadout["primary"], loadout["secondary"], loadout["throwable"]] + loadout["strategems"]
        for t in tag_stats:
            tag_stats[t] += sum(1 for i in items if i.has(t))
        overridden += loadout["faction_overridden"]
    return {"counts": counts, "tagStats": tag_stats, "overridden": overridden, "failures": failures}


def z_two_prop(c1, n1, c2, n2):
    p = (c1 + c2) / (n1 + n2)
    se = math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    return 0.0 if se == 0 else (c1 / n1 - c2 / n2) / se


def compare(py, js, n_py, n_js):
    worst = (0.0, "", "")
    tested = 0
    for bucket in ("primary", "secondary", "throwable", "strat"):
        names = set(py["counts"][bucket]) | set(js["counts"][bucket])
        for name in names:
            c1, c2 = py["counts"][bucket].get(name, 0), js["counts"][bucket].get(name, 0)
            if min(c1, c2) < MIN_EXPECTED and abs(c1 - c2) < 15:
                continue  # too rare to say anything
            tested += 1
            z = z_two_prop(c1, n_py, c2, n_js)
            if abs(z) > abs(worst[0]):
                worst = (z, bucket, name)
    return worst, tested


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--legacy", action="store_true")
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()

    ref.FIX_COUNTER_LEAK = not args.legacy
    print("Python reference:", "ORIGINAL loop (counter leak included)" if args.legacy else "patched loop (counter leak fixed)")
    scenarios = json.loads((HERE.parent / "scenarios.json").read_text())
    if args.quick:
        for s in scenarios:
            s["n"] = max(500, s["n"] // 4)
        (HERE / "_scenarios_quick.json").write_text(json.dumps(scenarios))

    # The JS sampler reads scenarios.json; for --quick we point it at the reduced copy via env var.
    cmd = ["node", str(HERE / "js_samples.js")] + (["--legacy"] if args.legacy else [])
    env = None
    if args.quick:
        import os
        env = dict(os.environ, HD2_SCENARIOS=str(HERE / "_scenarios_quick.json"))
    t0 = time.time()
    js_all = json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True, env=env).stdout)
    print(f"JS sampling done in {time.time() - t0:.0f}s\n")

    failed = 0
    for sc, js in zip(scenarios, js_all):
        t0 = time.time()
        py = run_python(sc, sc["n"])
        n_py, n_js = sc["n"] - py["failures"], js["n"] - js["failures"]
        # (Python raises where the new JS engine returns a best-effort build, so those cases are
        #  covered by tests/engine_rules.js instead - none of the scenarios here are like that.)
        if n_py == 0 or n_js == 0:
            ok = n_py == 0 and n_js == 0
            print(f"{'PASS' if ok else 'FAIL'}  {sc['name']}\n      impossible build: python failures={py['failures']}, js failures={js['failures']}")
            failed += not ok
            continue
        (z, bucket, name), tested = compare(py, js, n_py, n_js)
        tag_line = "  ".join(
            f"{t}:{py['tagStats'][t] / n_py:.2f}/{js['tagStats'][t] / n_js:.2f}" for t in py["tagStats"]
        )
        override_ok = abs(py["overridden"] / n_py - js["overridden"] / n_js) < 0.02
        strict_ok = js.get("unmetBuilds", 0) == 0  # Python only ever returns rule-following builds
        ok = abs(z) < Z_LIMIT and override_ok and strict_ok
        failed += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {sc['name']}")
        print(f"      items tested {tested}, worst |z| = {abs(z):.1f}" + (f" ({bucket}: {name})" if abs(z) >= 3 else ""))
        print(f"      avg tags per loadout (py/js)  {tag_line}")
        if not strict_ok:
            print(f"      JS returned {js['unmetBuilds']} build(s) with unmet rules where Python built them strictly")
        print(f"      faction fallback used: py {py['overridden'] / n_py:.1%}  js {js['overridden'] / n_js:.1%}"
              f"   build failures: py {py['failures']}  js {js['failures']}   ({time.time() - t0:.0f}s)")
    print(f"\n{'ALL SCENARIOS MATCH' if not failed else str(failed) + ' scenario(s) differ'}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
