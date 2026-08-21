package com.alveryn.api.testsupport;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class IntegrationTestDatabaseCleaner {

  public static void cleanWorkspaceData(JdbcTemplate jdbc) {
    jdbc.execute("TRUNCATE TABLE organizations, user_accounts CASCADE");
  }
}
