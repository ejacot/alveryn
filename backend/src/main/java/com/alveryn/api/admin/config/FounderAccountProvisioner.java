package com.alveryn.api.admin.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(100)
@RequiredArgsConstructor
public class FounderAccountProvisioner implements ApplicationRunner {
  private final JdbcTemplate jdbc;
  private final FounderProperties properties;

  @Override
  public void run(ApplicationArguments args) {
    if (!properties.configured()) return;
    jdbc.update("UPDATE user_accounts SET role = 'USER' WHERE role = 'ADMIN' AND LOWER(email) <> ?", properties.email());
    jdbc.update("UPDATE user_accounts SET role = 'ADMIN' WHERE LOWER(email) = ?", properties.email());
  }
}
