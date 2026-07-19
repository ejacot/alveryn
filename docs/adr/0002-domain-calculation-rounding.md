# ADR 0002: Domain calculation and rounding ownership

Status: accepted

`WorkRecordLine` derives immutable base, extra and total snapshots. Hourly formulas first use `hourlyRate × minutes ÷ 60`; direct-unit formulas use `quantity × ratePerUnit`; fixed-price formulas use the entered amount. When enabled by the WorkType, `extraPayPercentage` is applied to that base result for every calculation mode. The line persists worked minutes, extra paid-equivalent minutes, total paid-equivalent minutes, base gross, extra gross and total gross independently. Monetary calculations use `BigDecimal` and `RoundingMode.HALF_UP` at the final monetary boundary.

Units-per-hour record lines derive equivalent minutes from `quantity × 60 ÷ unitsPerHourSnapshot` with `MathContext.DECIMAL128`, persisted at high precision. Direct per-unit and fixed-amount lines do not invent worked time, so their worked and paid-equivalent minute snapshots remain zero even when an extra monetary percentage applies. Callers cannot supply derived gross or calculated time independently.

Time intervals treat an end time equal to or earlier than the start as occurring the following day. This represents overnight work without adding dates to the detail row.

Time-based work remains exact integer minutes. Hours are derived from exact minutes and never persisted as a two-decimal display value. Gross pay uses the full precise minutes value.

Flyway V3 originally added integer-minute checks. V4 replaces only the affected column types and formulas with the precision model above. Published migrations remain immutable.
