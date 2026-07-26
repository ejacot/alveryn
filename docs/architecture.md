# Alveryn backend architecture

The backend is organized by feature under `com.alveryn.api`, including `user`, `employment`, `salary`, `worktype`, `workrecord`, `workproject`, `absence`, `calendar`, `dashboard`, `statistics`, and the isolated `admin` module. Shared persistence infrastructure is limited to `common.persistence.BaseEntity`; empty controller, service, and DTO layers are not created in advance.

The `admin` module exposes aggregate Founder metrics only under `/api/admin/**`, protected by the database-backed `ADMIN` authority. The sole Founder identity comes from the deployment environment. Customer activity uses one UTC-day heartbeat and a small allowlist of explicit product events; work content and financial values never enter analytics. Every Founder dashboard read creates an audit event.

All persisted domain objects use UUID identifiers. `BaseEntity` is a mapped superclass that supplies the UUID plus immutable-from-the-domain `createdAt` and `updatedAt` values. Hibernate's UUID and timestamp annotations keep the implementation small and consistent while Flyway remains the schema authority (`ddl-auto: validate`).

Work types are personal user data, not global enums. A work type can be a simple formula or a parent category containing child work types. It explicitly controls whether its record lines may receive extra pay. `WorkProject` owns the identity and boundaries of multi-day work. `WorkRecord` represents either a dated work session or the project-level totals, and owns one or more `WorkRecordLine` calculations. Creating a project with its initial totals is one transaction. Project attachment validates ownership, employment, and date boundaries. Hourly rates are dated periods, and record lines copy calculation inputs, rates, currency, time, quantity, and worked/extra/total result snapshots to preserve historical results.

Daily analytics include dated work sessions only. Project-total records describe the whole project and are deliberately excluded from a particular day's hours and earnings. Calendar classification distinguishes worked, absent, and explicit rest days; an unclassified past day remains unknown rather than silently becoming a rest day.

Organizations and versioned scheduling tables form an expansion boundary for future coordinated work. The current product UI remains personal-first, and each account is backfilled into a personal organization. This preserves a migration path without making business workflow concepts part of everyday personal tracking.

The committed V2 development migration originally mixed BIGINT and UUID and could not execute. With no production data, V2 is explicitly rebased as an all-UUID development baseline and local databases must be recreated from V1/V2.

From V3 onward, published migrations are immutable and every schema change receives a new version. V3 adds database checks for paired security-code fields, ISO-style currency values, gross calculations, and unit-minute calculations.

`WorkRecordLine` owns result calculation. It first derives base worked time and base gross: time-based and units-per-hour work use `hourlyRate × workedMinutes ÷ 60`, direct-unit work uses `quantity × ratePerUnit`, and fixed-price work uses the entered amount. When the WorkType enables extra pay, the percentage produces separate extra-time and extra-gross snapshots for every calculation mode; modes without derived worked time retain zero worked/extra minutes while still supporting an extra monetary amount. Total snapshots are the exact sum of their base and extra components. Calculations use `BigDecimal`, retain full time precision, and round only at the monetary boundary. Display precision is presentation-only. A time interval whose end is equal to or earlier than its start crosses midnight into the following day.

Entities deliberately use Java identity semantics and do not generate `equals`/`hashCode` from mutable fields or lazy relationships. Equality policy can be revisited only when detached-entity comparison becomes a concrete requirement.

Hourly-rate overlap is queried with inclusive closed/open-ended interval semantics. The application service that creates or changes periods must enforce the query result transactionally; database-level exclusion is deferred until the concurrency strategy is designed.

## Application layer

Application services form the transaction boundary and derive the authenticated user from the security context. They enforce ownership, uniqueness, cross-entity rules, and salary-period overlap before mapping entities to immutable DTO records. Entities never leave this layer. MapStruct mappers use Spring component model and constructor injection.

`CalculationMethod` is immutable after WorkType creation. Creation and update use separate request DTOs; the update contract cannot express a method change.

Repositories remain persistence-only. Feature packages own their DTOs, mappers, and services; shared exception and future API-error infrastructure lives under `common`.
