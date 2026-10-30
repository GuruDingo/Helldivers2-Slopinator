# Archived: parity test against the original Python tool

These compared the JS engine's loadout odds with the original `hd2loadout.py` logic (`py_reference.py`,
frozen) over thousands of samples per scenario. They proved the JS port (and the counter-leak fix) did not
change the odds - results on 2026-10-29: every scenario matched, worst |z| <= 3.5.

They are NOT part of the normal test run (the Python side is slow - roughly 10 minutes in total) and they will
fail whenever a rule is deliberately changed. Run by hand, from the repo root, only if you want to re-check
against the original: `python tests/archive/parity.py [--legacy] [--quick]`.
