# ADR 0002: Domain calculation and rounding ownership

Status: accepted

`WorkEntry` derives gross pay from its immutable snapshots and calculated minutes. It uses `hourlyRate × minutes ÷ 60`, monetary scale 2, and `RoundingMode.HALF_UP`.

`UnitEntryItem` derives whole calculated minutes from `quantity × 60 ÷ unitsPerHourSnapshot`, using `RoundingMode.HALF_UP`. Callers cannot supply either derived result independently.

Time intervals treat an end time equal to or earlier than the start as occurring the following day. This represents overnight work without adding dates to the detail row.

Flyway V3 adds matching database checks. From V3 onward, published migrations are immutable and later changes require a new migration.
