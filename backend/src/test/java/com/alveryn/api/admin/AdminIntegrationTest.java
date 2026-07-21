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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
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
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
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

  private UserAccount verified(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private String bearer(UserAccount user) {
    return "Bearer " + jwt.generateAccessToken(user);
  }
}
