# ADR 0002: Domain calculation and rounding ownership

Status: accepted

`WorkEntry` derives gross pay from its immutable snapshots and calculated minutes. It uses `hourlyRate × minutes ÷ 60`, monetary scale 2, and `RoundingMode.HALF_UP`.

`UnitEntryItem` derives calculated minutes from `quantity × 60 ÷ unitsPerHourSnapshot` with `MathContext.DECIMAL128`, persisted as `NUMERIC(30,15)`. The final persistence boundary uses scale 15 with `HALF_UP`; this is a high-precision representation rule, not display or monetary rounding. Callers cannot supply the derived result independently.

Time intervals treat an end time equal to or earlier than the start as occurring the following day. This represents overnight work without adding dates to the detail row.

TIME_BASED work remains exact integer minutes, stored losslessly in the same decimal column. Hours are derived from exact minutes and never persisted as a two-decimal display value. Gross pay uses the full precise minutes value and rounds only the final monetary result to scale 2 with `HALF_UP`.

Flyway V3 originally added integer-minute checks. V4 replaces only the affected column types and formulas with the precision model above. Published migrations remain immutable.
