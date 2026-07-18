# ADR 0002: Domain calculation and rounding ownership

Status: accepted

`WorkRecordLine` derives gross pay from immutable snapshots. Hourly formulas use `hourlyRate × minutes ÷ 60 × (100 + extraPayPercentage) ÷ 100`; direct-unit formulas use `quantity × ratePerUnit`; fixed-price formulas preserve the entered amount. Monetary calculations use `BigDecimal` and `RoundingMode.HALF_UP` at the final monetary boundary.

Units-per-hour record lines derive equivalent minutes from `quantity × 60 ÷ unitsPerHourSnapshot` with `MathContext.DECIMAL128`, persisted at high precision. Direct per-unit lines do not invent worked time. Callers cannot supply derived gross or calculated time independently.

Time intervals treat an end time equal to or earlier than the start as occurring the following day. This represents overnight work without adding dates to the detail row.

Time-based work remains exact integer minutes. Hours are derived from exact minutes and never persisted as a two-decimal display value. Gross pay uses the full precise minutes value.

Flyway V3 originally added integer-minute checks. V4 replaces only the affected column types and formulas with the precision model above. Published migrations remain immutable.
