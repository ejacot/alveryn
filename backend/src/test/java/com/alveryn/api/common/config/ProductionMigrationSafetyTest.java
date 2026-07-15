package com.alveryn.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class ProductionMigrationSafetyTest {
  private static final String LOCAL_ACCOUNT_EMAIL = "eusebiujacot@gmail.com";

  @Test
  void productionMigrationsDoNotContainPersonalDeveloperAccount() throws Exception {
    try (var paths = Files.walk(Path.of("src/main/resources/db/migration"))) {
      var sqlFiles = paths.filter(path -> path.toString().endsWith(".sql")).toList();

      assertThat(sqlFiles).isNotEmpty();
      for (Path sqlFile : sqlFiles) {
        assertThat(Files.readString(sqlFile))
            .as("Production migration must not reference personal local account: %s", sqlFile)
            .doesNotContain(LOCAL_ACCOUNT_EMAIL);
      }
    }
  }

  @Test
  void cleanDatabaseMigratesFromV1ToLatest() {
    String schema = "flyway_clean_" + UUID.randomUUID().toString().replace("-", "");
    Flyway flyway =
        Flyway.configure()
            .dataSource(
                System.getenv().getOrDefault("DB_URL", "jdbc:postgresql://localhost:5432/alveryn"),
                System.getenv().getOrDefault("DB_USERNAME", "alveryn"),
                System.getenv().getOrDefault("DB_PASSWORD", "change-me"))
            .schemas(schema)
            .defaultSchema(schema)
            .createSchemas(true)
            .cleanDisabled(false)
            .locations("classpath:db/migration")
            .load();

    try {
      assertThat(flyway.migrate().migrationsExecuted).isGreaterThan(0);
      assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo(latestMigrationVersion());
    } finally {
      flyway.clean();
    }
  }

  private String latestMigrationVersion() {
    try (var paths = Files.walk(Path.of("src/main/resources/db/migration"))) {
      return paths
          .map(path -> path.getFileName().toString())
          .filter(name -> name.matches("V\\d+__.*\\.sql"))
          .map(name -> name.substring(1, name.indexOf("__")))
          .max(Comparator.comparingInt(Integer::parseInt))
          .orElseThrow();
    } catch (Exception e) {
      throw new IllegalStateException("Could not determine latest migration version", e);
    }
  }
}
