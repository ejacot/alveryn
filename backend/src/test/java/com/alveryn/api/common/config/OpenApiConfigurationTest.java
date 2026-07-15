package com.alveryn.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

@SpringBootTest
class OpenApiConfigurationTest {
  @Autowired Environment environment;

  @Test
  void swaggerIsDisabledByDefaultInTests() {
    assertThat(environment.getProperty("springdoc.api-docs.enabled", Boolean.class)).isFalse();
    assertThat(environment.getProperty("springdoc.swagger-ui.enabled", Boolean.class)).isFalse();
  }
}
