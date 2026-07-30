package com.alveryn.api.dataimport.intelligence;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "alveryn.import-intelligence")
public record ImportIntelligenceProperties(
    boolean enabled,
    String apiKey,
    String baseUrl,
    String model,
    String visionModel,
    Duration timeout) {

  private static final String DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
  private static final String DEFAULT_MODEL = "openai/gpt-oss-20b";
  private static final String DEFAULT_VISION_MODEL = "qwen/qwen3.6-27b";
  private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);

  public ImportIntelligenceProperties {
    baseUrl = baseUrl == null || baseUrl.isBlank() ? DEFAULT_BASE_URL : baseUrl;
    model = model == null || model.isBlank() ? DEFAULT_MODEL : model;
    visionModel = visionModel == null || visionModel.isBlank()
        ? DEFAULT_VISION_MODEL : visionModel;
    timeout = timeout == null ? DEFAULT_TIMEOUT : timeout;
  }

  public boolean available() {
    return enabled && apiKey != null && !apiKey.isBlank();
  }
}
