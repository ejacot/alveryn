# Roomly

Roomly is organized as a Spring Boot backend with space reserved for a frontend and infrastructure code.

## Local development

1. Copy `.env.example` to `.env` if local overrides are needed.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Start the backend from `backend` with `mvnw.cmd spring-boot:run` on Windows or `./mvnw spring-boot:run` on Unix-like systems.

The backend uses Java 21, PostgreSQL, Flyway, Hibernate, and the Java package `com.roomly.api`.

## Configuration

The backend requires `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. `DB_URL` must be a JDBC URL such as `jdbc:postgresql://host:5432/roomly`. No production credentials belong in Git.

GitHub Actions provisions an isolated PostgreSQL 17 service and needs no repository secrets. Render deployment is described by `render.yaml`; set `DB_URL` once to the managed database's internal JDBC URL (`jdbc:postgresql://host:5432/database`), while username and password are linked automatically. Render builds with `backend/` as Docker context, checks `/actuator/health`, and provides `PORT` to Spring Boot.
