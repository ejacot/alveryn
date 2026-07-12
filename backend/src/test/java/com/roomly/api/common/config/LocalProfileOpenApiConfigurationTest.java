package com.roomly.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("local")
class LocalProfileOpenApiConfigurationTest {
  @Autowired Environment environment;

  @Test
  void swaggerIsEnabledInLocalProfile() {
    assertThat(environment.getProperty("springdoc.api-docs.enabled", Boolean.class)).isTrue();
    assertThat(environment.getProperty("springdoc.swagger-ui.enabled", Boolean.class)).isTrue();
  }
}
