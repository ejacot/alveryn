package com.roomly.api.common.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("local")
class OpenApiDocsIntegrationTest {
  @Autowired WebApplicationContext context;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void apiDocsExposeWrappedResponseSchemas() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs").with(user("docs@example.com")))
        .andExpect(status().isOk())
        .andExpect(content().string(org.hamcrest.Matchers.containsString("UserProfileApiResponse")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("UserPreferencesApiResponse")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("ApiResponseHourlyRatePeriodResponse")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("ApiResponsePageResponseAbsenceResponse")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("OnboardingStatusApiResponse")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("WorkEntryPageApiResponse")));
  }
}
