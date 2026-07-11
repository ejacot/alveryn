# ADR 0001: UUID identifiers and BaseEntity

Status: accepted

Roomly uses PostgreSQL UUID for every entity identifier and relationship. UUIDs avoid coordination around integer sequences and are safe to create before persistence, which suits future distributed and offline-capable workflows.

All entities extend a JPA mapped superclass, `BaseEntity`, containing the UUID and creation/update timestamps. This removes duplicated mapping while keeping feature entities focused on domain state. Hibernate generates UUIDs and maintains timestamps; Flyway defines matching UUID and `TIMESTAMPTZ` columns.

Global soft deletion is deliberately excluded because deletion semantics vary by feature and historical work records must remain explicit. `createdBy` and `updatedBy` are also deferred until an authenticated actor model exists.
