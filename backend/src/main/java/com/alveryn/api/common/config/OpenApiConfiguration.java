package com.alveryn.api.common.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.media.Schema;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info =
        @Info(
            title = "Alveryn Backend API",
            version = "v1",
            description = "Authentication, work tracking, dashboard and user-facing backend APIs.",
            contact = @Contact(name = "Alveryn")),
    servers = @Server(url = "/", description = "Current server"))
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT",
    in = SecuritySchemeIn.HEADER)
public class OpenApiConfiguration {
  @Bean
  OpenApiCustomizer openApiCustomizer() {
    return openApi -> ensureResponseWrappers(openApi);
  }

  @Bean
  OpenAPI alverynOpenApi() {
    return new OpenAPI();
  }

  private void ensureResponseWrappers(OpenAPI openApi) {
    Components components = openApi.getComponents();
    if (components == null || components.getSchemas() == null) {
      return;
    }

    components.getSchemas().putIfAbsent("ApiResponse", new Schema<>().description("Success response wrapper"));
    components.getSchemas().putIfAbsent(
        "PageResponse", new Schema<>().description("Stable paginated response payload"));
  }
}
