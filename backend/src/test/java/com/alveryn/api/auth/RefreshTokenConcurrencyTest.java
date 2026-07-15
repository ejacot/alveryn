package com.alveryn.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.auth.config.RefreshCookieProperties;
import com.alveryn.api.auth.repository.RefreshTokenRepository;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest(
    properties = {
      "alveryn.auth.jwt-secret=test-jwt-secret-012345678901234567890123"
    })
class RefreshTokenConcurrencyTest {
  private MockMvc mockMvc;
  @Autowired WebApplicationContext context;
  @Autowired UserAccountRepository users;
  @Autowired RefreshTokenRepository refreshTokens;
  @Autowired AuthIntegrationTest.TestAuthenticationEmailService emailService;
  @Autowired RefreshCookieProperties refreshCookieProperties;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    refreshTokens.deleteAll();
    users.deleteAll();
    emailService.clear();
  }

  @AfterEach
  void tearDown() {
    refreshTokens.deleteAll();
    users.deleteAll();
  }

  @Test
  void exactlyOneConcurrentRefreshSucceeds() throws Exception {
    registerUser("concurrency@example.com", "super-secret");
    verifyUser("concurrency@example.com");
    String refreshToken =
        extractCookieValue(loginResult("concurrency@example.com", "super-secret").getResponse().getHeader("Set-Cookie"));

    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);
    List<Future<Integer>> futures = new ArrayList<>();

    for (int i = 0; i < 2; i++) {
      futures.add(
          executor.submit(
              () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                MvcResult result =
                    mockMvc
                        .perform(
                            post("/api/auth/refresh")
                                .cookie(new Cookie(refreshCookieProperties.name(), refreshToken)))
                        .andReturn();
                return result.getResponse().getStatus();
              }));
    }

    assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
    start.countDown();

    int success = 0;
    int failure = 0;
    for (Future<Integer> future : futures) {
      int status = future.get(10, TimeUnit.SECONDS);
      if (status == 200) success++;
      if (status == 401) failure++;
    }
    executor.shutdownNow();

    assertThat(success).isEqualTo(1);
    assertThat(failure).isEqualTo(1);
    assertThat(refreshTokens.findAll().stream().filter(token -> token.getRevokedAt() == null).count())
        .isEqualTo(1);
    assertThat(refreshTokens.findAll().stream().filter(token -> token.getRevokedAt() != null).count())
        .isEqualTo(1);
  }

  @Test
  void rotatedOrRevokedRefreshTokenReturnsGenericFailure() throws Exception {
    registerUser("reuse@example.com", "super-secret");
    verifyUser("reuse@example.com");
    String refreshToken =
        extractCookieValue(loginResult("reuse@example.com", "super-secret").getResponse().getHeader("Set-Cookie"));

    String refreshCookieHeader =
        mockMvc
            .perform(
                post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), refreshToken)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getHeader("Set-Cookie");
    String newRefreshToken = extractCookieValue(refreshCookieHeader);

    mockMvc
        .perform(
            post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), refreshToken)))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(
            post("/api/auth/logout").cookie(new Cookie(refreshCookieProperties.name(), newRefreshToken)))
        .andExpect(status().isOk());

    MvcResult result =
        mockMvc
            .perform(
                post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), newRefreshToken)))
            .andExpect(status().isUnauthorized())
            .andReturn();

    assertThat(result.getResponse().getContentAsString()).contains("Invalid refresh token");
    assertThat(result.getResponse().getContentAsString()).doesNotContain("revoked");
    assertThat(result.getResponse().getContentAsString()).doesNotContain("expired");
  }

  private void registerUser(String email, String password) throws Exception {
    mockMvc
        .perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
        .andExpect(status().isCreated());
  }

  private void verifyUser(String email) throws Exception {
    mockMvc
        .perform(
            post("/api/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"%s","code":"%s"}
                    """
                        .formatted(email, emailService.verificationCodeFor(email))))
        .andExpect(status().isOk());
    refreshTokens.deleteAll();
  }

  private org.springframework.test.web.servlet.MvcResult loginResult(String email, String password)
      throws Exception {
    return mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
        .andExpect(status().isOk())
        .andReturn();
  }

  private String extractCookieValue(String setCookieHeader) {
    String marker = refreshCookieProperties.name() + "=";
    int start = setCookieHeader.indexOf(marker);
    int valueStart = start + marker.length();
    int valueEnd = setCookieHeader.indexOf(';', valueStart);
    return setCookieHeader.substring(valueStart, valueEnd);
  }

  @TestConfiguration
  static class ConcurrencyTestConfig {
    @Bean
    @Primary
    AuthIntegrationTest.TestAuthenticationEmailService testAuthenticationEmailService() {
      return new AuthIntegrationTest.TestAuthenticationEmailService();
    }
  }
}
