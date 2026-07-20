package com.alveryn.api.config;

import java.util.Set;
import java.util.stream.Collectors;
import org.flywaydb.core.api.MigrationState;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayCompatibilityConfiguration {
  private static final Set<String> RETIRED_COMPATIBILITY_MIGRATIONS = Set.of("42", "43");

  @Bean
  FlywayMigrationStrategy flywayMigrationStrategy() {
    return flyway -> {
      Set<String> missing = java.util.Arrays.stream(flyway.info().all())
          .filter(info -> info.getState() == MigrationState.MISSING_SUCCESS)
          .map(info -> info.getVersion().getVersion())
          .collect(Collectors.toSet());
      if (!missing.isEmpty()) {
        if (!RETIRED_COMPATIBILITY_MIGRATIONS.containsAll(missing)) {
          throw new IllegalStateException("Unexpected missing Flyway migrations: " + missing);
        }
        flyway.repair();
      }
      flyway.migrate();
    };
  }
}
