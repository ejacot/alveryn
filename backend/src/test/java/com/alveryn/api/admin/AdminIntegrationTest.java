package com.alveryn.api.admin;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.entity.UserPreferences;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest
class AdminIntegrationTest {
  MockMvc mvc;
  @Autowired WebApplicationContext context;
  @Autowired UserAccountRepository users;
  @Autowired UserPreferencesRepository preferences;
  @Autowired JwtService jwt;
  @Autowired JdbcTemplate jdbc;

  @BeforeEach
  void setUp() {
    jdbc.update("DELETE FROM product_events");
    preferences.deleteAll();
    users.deleteAll();
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @AfterEach
  void tearDown() {
    jdbc.update("DELETE FROM product_events");
    preferences.deleteAll();
    users.deleteAll();
  }

  @Test
  void onlyAdminCanReadAggregatedFounderDashboard() throws Exception {
    UserAccount customer = verified("founder-customer@example.com");
    preferences.save(new UserPreferences(customer));
    UserAccount admin = verified("founder-admin@example.com");
    admin.promoteToAdmin();
    users.saveAndFlush(admin);

    mvc.perform(get("/api/admin/dashboard").header(HttpHeaders.AUTHORIZATION, bearer(customer)))
        .andExpect(status().isForbidden());

    mvc.perform(get("/api/admin/dashboard").header(HttpHeaders.AUTHORIZATION, bearer(admin)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.overview.totalUsers").isNumber())
        .andExpect(jsonPath("$.data.users[?(@.email == 'founder-customer@example.com')]").exists())
        .andExpect(jsonPath("$.data.users[?(@.email == 'founder-admin@example.com')]").doesNotExist());
  }

  @Test
  void productActivityAndPdfExportAreRecordedWithoutWorkContent() throws Exception {
    UserAccount customer = verified("analytics-customer@example.com");

    mvc.perform(post("/api/analytics/pdf-export").header(HttpHeaders.AUTHORIZATION, bearer(customer)))
        .andExpect(status().isCreated());

    Integer activityDays = jdbc.queryForObject(
        "SELECT COUNT(*) FROM user_activity_days WHERE user_id = ?", Integer.class, customer.getId());
    Integer exports = jdbc.queryForObject(
        "SELECT COUNT(*) FROM product_events WHERE user_id = ? AND event_type = 'PDF_EXPORTED'",
        Integer.class,
        customer.getId());
    org.assertj.core.api.Assertions.assertThat(activityDays).isEqualTo(1);
    org.assertj.core.api.Assertions.assertThat(exports).isEqualTo(1);
  }

  @Test
  void anonymousAcquisitionEventsArePublicAndDeduplicatedPerDay() throws Exception {
    String visitorId = "2afab16a-9e26-4dc0-9951-85ba16f624ee";
    String event = """
        {"eventType":"LANDING_VIEW","anonymousId":"%s"}
        """.formatted(visitorId);

    mvc.perform(post("/api/analytics/public-event")
            .contentType(MediaType.APPLICATION_JSON)
            .content(event))
        .andExpect(status().isCreated());
    mvc.perform(post("/api/analytics/public-event")
            .contentType(MediaType.APPLICATION_JSON)
            .content(event))
        .andExpect(status().isCreated());

    Integer views = jdbc.queryForObject(
        "SELECT COUNT(*) FROM product_events WHERE anonymous_id = ?::uuid AND event_type = 'LANDING_VIEW'",
        Integer.class,
        visitorId);
    org.assertj.core.api.Assertions.assertThat(views).isEqualTo(1);
  }

  private UserAccount verified(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private String bearer(UserAccount user) {
    return "Bearer " + jwt.generateAccessToken(user);
  }
}
