# Solar calculation methodology (engine v0.1.0)

Implemented in [`packages/solar-engine`](../packages/solar-engine/src). It is pure and deterministic, and each result carries `engineVersion`, `dataVersion` and the full resolved assumption set.

> **Status:** These are calculated estimates for planning. Every result is `ESTIMATED_REVIEW_REQUIRED`. Before engineering-grade use, a qualified solar engineer must review the benchmark scenarios in `tests/sizing.test.ts`, and the irradiation data must be replaced (see §6).

## Pipeline

`validate → energy → inverter → battery → solar array → charge controller → cost → engineering checks`

## 1. Energy (`energy.ts`)

```
E_daily  = Σ W_i × Q_i × H_i / 1000                  [kWh]
E_night  = Σ W_i × Q_i × Hnight_i / 1000             (default Hnight = H × catalogue night fraction, else 0.5)
E_backup = Σ W_i × Q_i × min(H_i, backupHours) / 1000
P_peak   = max(Σ simultaneous W_i × Q_i, largest non-simultaneous load)
P_surge  = P_peak + max_i W_i × (surge_i − 1)        (one motor starts at a time)
```

## 2. Inverter (`inverter.ts`)

```
continuous W = P_peak × design margin (1.25)
required kVA = continuous W / power factor (0.8) / 1000
surge VA     = P_surge / power factor
```

The recommendation is the smallest standard size (1, 1.5, 2.5, 3.5, 5, 6, 8, 10, 12, 15, 20, 25, 30 kVA) that meets both the continuous requirement and the surge requirement, where surge capability = rating × 2. Loads above 30 kVA are flagged CRITICAL (parallel or three-phase design needed).

## 3. Battery (`battery.ts`)

```
storage/day = grid ? E_backup : max(E_night, E_backup)
usable      = storage/day × autonomyDays
nominal     = usable / (DoD × η_inverter × √η_roundtrip)
```

| Chemistry | DoD | Round-trip η | Unit |
|---|---|---|---|
| LiFePO4 | 0.90 | 0.95 | 100 Ah module at bank voltage (12.8/25.6/51.2 V) |
| AGM / gel | 0.50 | 0.85 | 12 V 200 Ah |
| Tubular | 0.50 | 0.80 | 12 V 220 Ah |

Bank voltage: 48 V if inverter ≥ 3.5 kVA or nominal > 12 kWh. Otherwise 24 V if inverter ≥ 1.5 kVA or nominal > 2.5 kWh. Otherwise 12 V.

## 4. Solar array (`panels.ts`)

```
generation = (E_day / η_inv + E_night / (η_inv × η_roundtrip)) × target solar fraction
array kWp  = generation / (PSH × derating 0.8)
panels     = ceil(array W / panel W)               (default 550 W)
MPPT A     = array W / bank V × 1.25
```

PSH comes from the location, using either the annual mean or the worst month (`solarDesignBasis`). The engine also reports expected generation for both, and the **worst-month coverage**. Below 90% coverage it raises a warning.

## 5. Cost (`cost.ts`)

Equipment at reference unit prices, plus balance of system (12% of equipment), installation (10% of equipment + BOS), a ₦50,000 logistics flat fee, and 5% contingency. The result is shown with a ±15% range. **Prices are placeholders reviewed 2026-11.** Replace them with marketplace prices once vendor listings exist.

## 6. Data: TO DO before commercial launch

`ng-states-approx-2026.11` holds **approximate** state-capital irradiation values that follow the known north–south gradient. Replace them with per-coordinate monthly extracts from **NASA POWER** (`ALLSKY_SFC_SW_DWN`) or the **Global Solar Atlas**. Record the source and extraction date, then bump `SOLAR_DATA_VERSION`.

## 7. Versioning

- Bump `ENGINE_VERSION` minor when outputs can change for the same input, and major when the contract changes.
- Saved designs keep their original result. `POST /solar/designs/:id/recalculate` re-runs the design on the current engine and reports the previous version. Installer-approved designs are frozen.
