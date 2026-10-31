# Release dates: where they came from (2026-10-30)

**Boss accepted the current dates as correct on 2026-10-30.** The notes below record how each date was found and are no longer a to-do list.

`hd2gear.csv` now has a `release_date` column (YYYY-MM-DD) and the rows are ordered oldest to newest: id 1 is the oldest item, the highest id the newest. Items released on the same day keep their previous relative order. The dates are a best effort; this file lists what was looked up and what is only assumed, so you can correct the assumed ones.

Source of truth for the order is the `release_date` column. To fix a date, change it in the CSV; to re-sort and renumber, sort the rows by `release_date` (then by the old id) and renumber `id` from 1.

## Warbond dates (every item in a warbond gets the warbond's date)

| Warbond | Date | Basis |
|---|---|---|
| Base Game, Super Citizen Edition, Helldivers Mobilize, Steeled Veterans | 2024-02-08 | launch day |
| Cutting Edge | 2024-03-12 | wiki, date its first item was added |
| Democratic Detonation | 2024-04-11 | wiki |
| Polar Patriots | 2024-05-09 | **estimate** (between the neighbours) |
| Viper Commandos | 2024-06-13 | wiki |
| Freedom's Flame | 2024-08-06 | wiki |
| Chemical Agents | 2024-09-19 | wiki (G-4 Gas page) |
| Truth Enforcers | 2024-10-31 | news article |
| Urban Legends | 2024-12-05 | **estimate** |
| Servants of Freedom | 2025-02-06 | wiki |
| Borderline Justice | 2025-03-18 | **estimate** |
| Masters of Ceremony | 2025-05-13 | wiki |
| Force of Law | 2025-06-12 | **estimate** |
| Control Group | 2025-07-15 | **estimate** |
| Halo: ODST | 2025-08-26 | wiki |
| Dust Devils | 2025-10-23 | **estimate** |
| Python Commandos | 2025-12-02 | wiki |
| Killzone | 2025-12-19 | **estimate** (the wiki page said 2024-12-19, which cannot be right for this position; assumed a typo) |
| Redacted Regiment | 2026-01-22 | wiki |
| Siege Breakers | 2026-02-10 | **estimate** |
| Entrenched Division | 2026-03-17 | wiki |
| Exo Experts | 2026-04-28 | wiki |
| Warhammer 40k | 2026-06-16 | **estimate** |
| Ironclad Democracy | 2026-09-22 | wiki |
| Scope of Authority | 2026-10-20 | wiki |

The wiki's "added to the game" date is also from item pages, so some of these are a day or so off the warbond's real release (mid-patch dates).

## Shop, Superstore, event and base items with a date from the wiki or news

- AR-23L Liberator Legacy: 2026-10-26
- R-2124 Constitution: 2024-10-27
- R-4 Hyena: 2026-07-13
- DBS-2 Double Freedom: 2025-12-02
- SG-97 Sweeper: 2026-03-17
- LAS-12 Sai: 2026-09-22
- P-92 Warrant: 2025-06-12
- CQC-30 Stun Baton: 2024-12-13
- CQC-5 Combat Hatchet: 2025-02-04
- CQC-42 Machete: 2025-09-04
- G-89 Smokescreen: 2026-01-22
- MLS-4X Commando: 2024-07-07
- MG-206 Heavy Machine Gun: 2024-03-28
- RL-77 Airburst Rocket Launcher: 2024-04-16
- StA-X3 W.A.S.P. Launcher: 2024-12-18
- LAS-99 Quasar Cannon: 2024-03-28
- M-102 Gunner FRV: 2024-12-13
- M-103 Supply FRV: 2026-06-16
- M-104 Incinerator FRV: 2026-06-16
- EXO-45 Patriot Exosuit: 2024-03-07
- EXO-49 Emancipator Exosuit: 2024-05-06
- TD-220 Bastion MK XVI: 2026-02-03
- TD-110 Maelstrom: 2026-09-22
- Eagle Gas Airstrike: 2026-09-07
- Orbital Napalm Barrage: 2024-09-04
- MD-17 Anti-Tank Mines: 2024-08-06
- MD-8 Gas Mines: 2025-03-02
- E/GL-21 Grenadier Battlement: 2025-03-25

Two of these look odd and are worth a second look: Eagle Gas Airstrike (2026-09-07, not a patch day) and Orbital Napalm Barrage (2024-09-04; it may have been in the game earlier).

## Shop and event items ASSUMED to be launch day (2024-02-08)

The wiki page had no "added to the game" entry (or would not load), so these were put at launch day. Anything that actually came later should get its real date. Base Game and Super Citizen items are launch items and are not listed.

- EAT-17 Expendable Anti-Tank (req_p)
- APW-1 Anti-Materiel Rifle (req_p)
- M-105 Stalwart (req_p)
- GR-8 Recoilless Rifle (req_p)
- FLAM-40 Flamethrower (req_p)
- AC-8 Autocannon (req_p)
- RS-422 Railgun (req_p)
- FAF-14 Spear (req_p)
- GL-21 Grenade Launcher (req_e)
- LAS-98 Laser Cannon (req_e)
- ARC-3 Arc Thrower (req_e)
- B-1 Supply Pack (req_e)
- LIFT-850 Jump Pack (req_h)
- SH-20 Ballistic Shield Backpack (req_e)
- AX/AR-23 Guard Dog (req_r)
- AX/LAS-5 Rover (req_e)
- SH-32 Shield Generator Pack (req_e)
- Eagle Strafing Run (req_h)
- Eagle Airstrike (req_h)
- Eagle Cluster Bomb (req_h)
- Eagle Smoke Strike (req_h)
- Eagle Napalm Airstrike (req_h)
- Eagle 110mm Rocket Pods (req_h)
- Eagle 500kg Bomb (req_h)
- Orbital Gatling Barrage (req_o)
- Orbital Gas Strike (req_b)
- Orbital 120mm HE Barrage (req_o)
- Orbital Airburst Strike (req_o)
- Orbital Smoke Strike (req_b)
- Orbital EMS Strike (req_b)
- Orbital 380mm HE Barrage (req_o)
- Orbital Walking Barrage (req_o)
- Orbital Laser (req_o)
- Orbital Railcannon Strike (req_o)
- A/MG-43 Machine Gun Sentry (req_r)
- A/G-16 Gatling Sentry (req_r)
- A/AC-8 Autocannon Sentry (req_r)
- A/M-12 Mortar Sentry (req_r)
- A/MLS-4X Rocket Sentry (req_r)
- A/ARC-3 Tesla Tower (req_b)
- A/M-23 EMS Mortar Sentry (req_r)
- MD-6 Anti-Personnel Minefield (req_e)
- MD-I4 Incendiary Mines (req_e)
- FX-12 Shield Generator Relay (req_b)
- E/MG-101 HMG Emplacement (req_b)
