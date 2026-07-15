# ADR 0003: Application services, DTO boundaries, and MapStruct

Status: accepted

Alveryn uses feature-owned application services as transactional boundaries. Until authentication exists, every ownership-sensitive operation receives `userId` explicitly. Repositories contain persistence queries only; cross-entity and conflict decisions belong to services.

Immutable Java records form the DTO boundary. Entities never leave services. MapStruct generates Spring-managed mappers with constructor injection, avoiding repetitive manual mapping.

The shared exception hierarchy distinguishes not-found, conflict, and validation outcomes. A reusable API error model and global handler are prepared for future controllers without adding endpoints in this milestone.
