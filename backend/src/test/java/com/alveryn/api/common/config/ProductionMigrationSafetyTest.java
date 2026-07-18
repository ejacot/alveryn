package com.alveryn.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
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

  @Test
  void existingV16DatabaseWithWorkEntriesMigratesToLatestWithSimpleAddresses() throws Exception {
    String schema = "flyway_existing_" + UUID.randomUUID().toString().replace("-", "");
    String url = System.getenv().getOrDefault("DB_URL", "jdbc:postgresql://localhost:5432/alveryn");
    String username = System.getenv().getOrDefault("DB_USERNAME", "alveryn");
    String password = System.getenv().getOrDefault("DB_PASSWORD", "change-me");
    Flyway v16 =
        Flyway.configure()
            .dataSource(url, username, password)
            .schemas(schema)
            .defaultSchema(schema)
            .createSchemas(true)
            .cleanDisabled(false)
            .locations("classpath:db/migration")
            .target("16")
            .load();

    try {
      assertThat(v16.migrate().migrationsExecuted).isGreaterThan(0);
      insertLegacyWorkEntry(url, username, password, schema);

      Flyway latest =
          Flyway.configure()
              .dataSource(url, username, password)
              .schemas(schema)
              .defaultSchema(schema)
              .createSchemas(true)
              .cleanDisabled(false)
              .locations("classpath:db/migration")
              .load();

      latest.migrate();
      assertThat(latest.info().current().getVersion().getVersion()).isEqualTo(latestMigrationVersion());

      try (var connection = DriverManager.getConnection(url, username, password);
          var statement = connection.createStatement()) {
        statement.execute("set search_path to " + schema);
        try (var rs =
            statement.executeQuery(
                """
                select count(*)
                from information_schema.tables
                where table_schema = current_schema()
                  and table_name = 'work_entries'
                """)) {
          assertThat(rs.next()).isTrue();
          assertThat(rs.getInt(1)).isZero();
        }
        try (var rs =
            statement.executeQuery(
                """
                select count(*)
                from information_schema.tables
                where table_schema = current_schema()
                  and table_name = 'addresses'
                """)) {
          assertThat(rs.next()).isTrue();
          assertThat(rs.getInt(1)).isEqualTo(1);
        }
        try (var rs =
            statement.executeQuery(
                """
                select count(*)
                from information_schema.columns
                where table_schema = current_schema()
                  and table_name in ('work_entries', 'user_preferences')
                  and (column_name like 'address%' or column_name = 'default_address_id')
                """)) {
          assertThat(rs.next()).isTrue();
          assertThat(rs.getInt(1)).isZero();
        }
        try (var rs =
            statement.executeQuery(
                """
                select count(*)
                from information_schema.columns
                where table_schema = current_schema()
                  and table_name in ('user_profiles', 'work_records')
                  and column_name = 'address_id'
                """)) {
          assertThat(rs.next()).isTrue();
          assertThat(rs.getInt(1)).isEqualTo(2);
        }
      }
    } finally {
      Flyway.configure()
          .dataSource(url, username, password)
          .schemas(schema)
          .defaultSchema(schema)
          .cleanDisabled(false)
          .load()
          .clean();
    }
  }

  private void insertLegacyWorkEntry(String url, String username, String password, String schema)
      throws Exception {
    try (var connection = DriverManager.getConnection(url, username, password);
        var statement = connection.createStatement()) {
      statement.execute("set search_path to " + schema);
      statement.executeUpdate(
          """
          insert into user_accounts (id, email, password_hash, email_verified)
          values ('00000000-0000-0000-0000-000000000101', 'legacy-latest-migration@example.com', 'hash', true)
          """);
      statement.executeUpdate(
          """
          insert into user_preferences (id, user_id, language, timezone, currency, first_day_of_week, date_format, time_format, theme, default_break_minutes, preferred_daily_minutes, paid_sick_leave, paid_vacation)
          values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 'en', 'Europe/Berlin', 'EUR', 'MONDAY', 'DD.MM.YYYY', 'H24', 'SYSTEM', 30, 480, true, true)
          """);
      statement.executeUpdate(
          """
          insert into work_types (id, user_id, name, normalized_name, calculation_method, compensation_method, color, active, display_order)
          values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Legacy Shift', 'legacy shift', 'TIME_BASED', 'HOURLY', '#87C95A', true, 0)
          """);
      statement.executeUpdate(
          """
          insert into hourly_rate_periods (id, user_id, hourly_rate, currency, valid_from)
          values ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 20.00, 'EUR', '2026-01-01')
          """);
      statement.executeUpdate(
          """
          insert into work_entries (
            id, user_id, work_type_id, work_date, work_type_name_snapshot, calculation_method_snapshot,
            hourly_rate_snapshot, currency_snapshot, calculated_minutes, gross_amount, extra_pay_percentage,
            compensation_method_snapshot
          )
          values (
            '00000000-0000-0000-0000-000000000301',
            '00000000-0000-0000-0000-000000000101',
            '00000000-0000-0000-0000-000000000201',
            '2026-07-16',
            'Legacy Shift',
            'TIME_BASED',
            20.00,
            'EUR',
            480.000000000000000,
            160.000000000000000,
            0,
            'HOURLY'
          )
          """);
      statement.executeUpdate(
          """
          insert into time_entry_details (id, work_entry_id, start_time, end_time, break_minutes, total_interval_minutes)
          values ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000301', '08:00', '16:00', 0, 480)
          """);
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
