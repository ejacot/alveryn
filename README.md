# Roomly

Roomly is organized as a Spring Boot backend with space reserved for a frontend and infrastructure code.

## Local development

1. Copy `.env.example` to `.env` if local overrides are needed.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Set local mail variables if email delivery should work end-to-end: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_STARTTLS`.
4. Start the backend from `backend` with `SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run` on Unix-like systems or the equivalent local profile configuration in IntelliJ IDEA / Windows.

For local development, the backend defaults to `jdbc:postgresql://localhost:5432/roomly` with username `roomly` and password `change-me`. The `local` Spring profile also provides a development-only JWT secret so the application can start locally once PostgreSQL is running. Gmail SMTP defaults for host, port, username, and STARTTLS are supplied only in the `local` profile; the app password must still come from `MAIL_PASSWORD`.

The backend uses Java 21, PostgreSQL, Flyway, Hibernate, and the Java package `com.roomly.api`.

## Configuration

The backend accepts `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_STARTTLS`. `DB_URL` must be a JDBC URL such as `jdbc:postgresql://host:5432/roomly`. `JWT_SECRET` is required outside the `local` profile and must be a sufficiently long secret value. Local defaults are provided for database development only; deployment environments should supply their own values.

GitHub Actions provisions an isolated PostgreSQL 17 service and needs no repository secrets. Render deployment is described by `render.yaml`; set `DB_URL` once to the managed database's internal JDBC URL (`jdbc:postgresql://host:5432/database`), while username and password are linked automatically. Render builds with `backend/` as Docker context, checks `/actuator/health`, and provides `PORT` to Spring Boot.
