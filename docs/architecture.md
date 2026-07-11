# Roomly backend architecture

The backend is organized by feature under `com.roomly.api`: `user`, `salary`, `worktype`, `workentry`, and `absence`. Shared persistence infrastructure is limited to `common.persistence.BaseEntity`; empty controller, service, and DTO layers are not created in advance.

All persisted domain objects use UUID identifiers. `BaseEntity` is a mapped superclass that supplies the UUID plus immutable-from-the-domain `createdAt` and `updatedAt` values. Hibernate's UUID and timestamp annotations keep the implementation small and consistent while Flyway remains the schema authority (`ddl-auto: validate`).

Work types are personal user data, not global enums. `TIME_BASED` entries have one time-detail row; `UNIT_BASED` entries have one or more unit items. Hourly rates are dated periods, and work entries copy rate/configuration snapshots to preserve historical results.

The committed V2 development migration originally mixed BIGINT and UUID and could not execute. With no production data, V2 is explicitly rebased as an all-UUID development baseline and local databases must be recreated from V1/V2.

From V3 onward, published migrations are immutable and every schema change receives a new version. V3 adds database checks for paired security-code fields, ISO-style currency values, gross calculations, and unit-minute calculations.

`WorkEntry` owns gross calculation: `hourlyRate × calculatedMinutes ÷ 60`, rounded directly to monetary scale 2 with `HALF_UP`. `UnitEntryItem` derives minutes as `quantity × 60 ÷ unitsPerHour`, rounded to a whole minute with `HALF_UP`. A time interval whose end is equal to or earlier than its start crosses midnight into the following day.

Entities deliberately use Java identity semantics and do not generate `equals`/`hashCode` from mutable fields or lazy relationships. Equality policy can be revisited only when detached-entity comparison becomes a concrete requirement.

Hourly-rate overlap is queried with inclusive closed/open-ended interval semantics. The application service that creates or changes periods must enforce the query result transactionally; database-level exclusion is deferred until the concurrency strategy is designed.
