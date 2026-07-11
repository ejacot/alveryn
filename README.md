# Roomly

Roomly is organized as a Spring Boot backend with space reserved for a frontend and infrastructure code.

## Local development

1. Copy `.env.example` to `.env` if local overrides are needed.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Start the backend from `backend` with `mvnw.cmd spring-boot:run` on Windows or `./mvnw spring-boot:run` on Unix-like systems.

The backend uses Java 21, PostgreSQL, Flyway, Hibernate, and the Java package `com.roomly.api`.
