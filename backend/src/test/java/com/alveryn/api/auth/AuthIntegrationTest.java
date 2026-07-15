package com.alveryn.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.auth.config.AuthProperties;
import com.alveryn.api.auth.config.RefreshCookieProperties;
import com.alveryn.api.auth.dto.GoogleOAuthUserInfo;
import com.alveryn.api.auth.email.AuthenticationEmailService;
import com.alveryn.api.auth.repository.PasswordResetTokenRepository;
import com.alveryn.api.auth.repository.RefreshTokenRepository;
import com.alveryn.api.auth.repository.UserOAuthIdentityRepository;
import com.alveryn.api.auth.service.GoogleOAuthClient;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.http.Cookie;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest
class AuthIntegrationTest {
  private MockMvc mockMvc;
  @Autowired UserAccountRepository users;
  @Autowired UserPreferencesRepository preferences;
  @Autowired RefreshTokenRepository refreshTokens;
  @Autowired UserOAuthIdentityRepository oauthIdentities;
  @Autowired PasswordResetTokenRepository passwordResetTokens;
  @Autowired PasswordEncoder passwordEncoder;
  @Autowired TestAuthenticationEmailService emailService;
  @Autowired AuthProperties authProperties;
  @Autowired RefreshCookieProperties refreshCookieProperties;
  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired WebApplicationContext context;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    refreshTokens.deleteAll();
    passwordResetTokens.deleteAll();
    oauthIdentities.deleteAll();
    users.deleteAll();
    emailService.clear();
    TestGoogleOAuthClient.reset();
  }

  @Test
  void registrationSucceedsAndStoresHashedSecrets() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"  NewUser@Example.com ","password":"super-secret"}
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.email").value("newuser@example.com"))
        .andExpect(jsonPath("$.data.emailVerified").value(false));

    var user = users.findByEmailIgnoreCase("newuser@example.com").orElseThrow();
    assertThat(user.getPasswordHash()).isNotEqualTo("super-secret");
    assertThat(passwordEncoder.matches("super-secret", user.getPasswordHash())).isTrue();
    assertThat(user.getSecurityCodeHash()).isNotEqualTo(emailService.verificationCodeFor("newuser@example.com"));
    assertThat(passwordEncoder.matches(emailService.verificationCodeFor("newuser@example.com"), user.getSecurityCodeHash()))
        .isTrue();
    var savedPreferences = preferences.findByUserId(user.getId()).orElseThrow();
    assertThat(savedPreferences.getLanguage()).isEqualTo("en");
    assertThat(savedPreferences.getCurrency()).isEqualTo("EUR");
    assertThat(savedPreferences.getTimezone()).isEqualTo("UTC");
    assertThat(savedPreferences.getDefaultBreakMinutes()).isEqualTo(30);
    assertThat(savedPreferences.getPreferredDailyMinutes()).isEqualTo(480);
  }

  @Test
  void registrationRejectsDuplicateEmail() throws Exception {
    registerUser("duplicate@example.com", "super-secret");

    mockMvc
        .perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"DUPLICATE@example.com\",\"password\":\"super-secret\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void verifyEmailHandlesValidInvalidExpiredAndAlreadyVerifiedCases() throws Exception {
    registerUser("verify@example.com", "super-secret");
    String code = emailService.verificationCodeFor("verify@example.com");

    mockMvc
        .perform(
            post("/api/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"verify@example.com","code":"%s"}
                    """
                        .formatted(code)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"verify@example.com","code":"%s"}
                    """
                        .formatted(code)))
        .andExpect(status().isOk());

    registerUser("invalid@example.com", "super-secret");
    mockMvc
        .perform(
            post("/api/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"invalid@example.com\",\"code\":\"000000\"}"))
        .andExpect(status().isUnauthorized());

    registerUser("expired@example.com", "super-secret");
    String expiredCode = emailService.verificationCodeFor("expired@example.com");
    jdbcTemplate.update(
        "update user_accounts set security_code_expires_at = current_timestamp - interval '1 minute' where email = ?",
        "expired@example.com");
    mockMvc
        .perform(
            post("/api/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"expired@example.com\",\"code\":\"%s\"}".formatted(expiredCode)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void resendVerificationInvalidatesOldCode() throws Exception {
    registerUser("resend@example.com", "super-secret");
    String oldCode = emailService.verificationCodeFor("resend@example.com");
    var user = users.findByEmailIgnoreCase("resend@example.com").orElseThrow();
    user.assignSecurityCode(
        user.getSecurityCodeHash(), OffsetDateTime.now().plus(authProperties.verificationResendCooldown()).minusSeconds(5));
    users.save(user);

    mockMvc
        .perform(
            post("/api/auth/resend-verification")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"resend@example.com\"}"))
        .andExpect(status().isOk());

    String newCode = emailService.verificationCodeFor("resend@example.com");
    assertThat(newCode).isNotEqualTo(oldCode);
    mockMvc
        .perform(
            post("/api/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"resend@example.com","code":"%s"}
                    """
                        .formatted(oldCode)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void loginHandlesSuccessUnknownInvalidUnverifiedAndFailedAttempts() throws Exception {
    registerUser("login@example.com", "super-secret");
    verifyUser("login@example.com");

    String successBody =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"LOGIN@example.com\",\"password\":\"super-secret\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(extractJsonValue(successBody, "accessToken")).isNotBlank();
    assertThat(successBody).doesNotContain("\"refreshToken\"");
    assertThat(successBody).doesNotContain("\"refreshTokenExpiresAt\"");
    assertThat(users.findByEmailIgnoreCase("login@example.com").orElseThrow().getFailedLoginAttempts())
        .isZero();

    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"unknown@example.com\",\"password\":\"super-secret\"}"))
        .andExpect(status().isUnauthorized());

    registerUser("unverified@example.com", "super-secret");
    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"unverified@example.com\",\"password\":\"super-secret\"}"))
        .andExpect(status().isUnauthorized());

    for (int i = 0; i < authProperties.loginMaxFailedAttempts(); i++) {
      mockMvc
          .perform(
              post("/api/auth/login")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"email\":\"login@example.com\",\"password\":\"wrong-password\"}"))
          .andExpect(status().isUnauthorized());
    }
    assertThat(users.findByEmailIgnoreCase("login@example.com").orElseThrow().getFailedLoginAttempts())
        .isEqualTo(authProperties.loginMaxFailedAttempts());
  }

  @Test
  void corsAllowsConfiguredLocalAndLanDevelopmentOrigins() throws Exception {
    mockMvc
        .perform(
            options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
        .andExpect(status().isOk())
        .andExpect(
            result ->
                assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
                    .isEqualTo("http://localhost:5173"))
        .andExpect(
            result ->
                assertThat(
                        result
                            .getResponse()
                            .getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS))
                    .isEqualTo("true"));

    mockMvc
        .perform(
            options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "http://192.168.0.25:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
        .andExpect(status().isOk())
        .andExpect(
            result ->
                assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
                    .isEqualTo("http://192.168.0.25:5173"));
  }

  @Test
  void jwtProtectsApiMeAndRejectsExpiredInvalidAndMalformedTokens() throws Exception {
    registerUser("jwt@example.com", "super-secret");
    verifyUser("jwt@example.com");
    String loginBody = login("jwt@example.com", "super-secret");
    String accessToken = extractJsonValue(loginBody, "accessToken");

    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.account.email").value("jwt@example.com"));

    mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());

    SecretKey validKey =
        Keys.hmacShaKeyFor(authProperties.jwtSecret().getBytes(StandardCharsets.UTF_8));
    String expiredToken =
        Jwts.builder()
            .subject(users.findByEmailIgnoreCase("jwt@example.com").orElseThrow().getId().toString())
            .claim("email", "jwt@example.com")
            .issuedAt(Date.from(OffsetDateTime.now().minusMinutes(20).toInstant()))
            .expiration(Date.from(OffsetDateTime.now().minusMinutes(5).toInstant()))
            .signWith(validKey)
            .compact();
    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken))
        .andExpect(status().isUnauthorized());

    SecretKey wrongKey =
        Keys.hmacShaKeyFor(
            Base64.getEncoder()
                .encodeToString("another-dev-only-secret-that-is-long-enough".getBytes(StandardCharsets.UTF_8))
                .getBytes(StandardCharsets.UTF_8));
    String invalidSignatureToken =
        Jwts.builder()
            .subject(users.findByEmailIgnoreCase("jwt@example.com").orElseThrow().getId().toString())
            .claim("email", "jwt@example.com")
            .issuedAt(Date.from(OffsetDateTime.now().toInstant()))
            .expiration(Date.from(OffsetDateTime.now().plusMinutes(15).toInstant()))
            .signWith(wrongKey)
            .compact();
    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + invalidSignatureToken))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer malformed"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void refreshRotationAndLogoutWork() throws Exception {
    registerUser("refresh@example.com", "super-secret");
    verifyUser("refresh@example.com");
    var loginResult = loginResult("refresh@example.com", "super-secret");
    String refreshToken = extractCookieValue(loginResult.getResponse().getHeader(HttpHeaders.SET_COOKIE));

    var refreshResult =
        mockMvc
            .perform(post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), refreshToken)))
            .andExpect(status().isOk())
            .andReturn();
    String rotatedRefreshToken =
        extractCookieValue(refreshResult.getResponse().getHeader(HttpHeaders.SET_COOKIE));
    assertThat(rotatedRefreshToken).isNotEqualTo(refreshToken);

    mockMvc
        .perform(
            post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), refreshToken)))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(
            post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), rotatedRefreshToken)))
        .andExpect(status().isOk());

    jdbcTemplate.update(
        """
        update refresh_tokens
           set created_at = current_timestamp - interval '2 minute',
               expires_at = current_timestamp - interval '1 minute'
         where token_hash = ?
        """,
        hash(rotatedRefreshToken));
    mockMvc
        .perform(
            post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), rotatedRefreshToken)))
        .andExpect(status().isUnauthorized());

    var stored = refreshTokens.findByTokenHash(hash(rotatedRefreshToken)).orElseThrow();
    stored.revoke(OffsetDateTime.now().minusMinutes(1), stored.getReplacedByTokenId());
    refreshTokens.save(stored);
    mockMvc
        .perform(
            post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), rotatedRefreshToken)))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(post("/api/auth/logout").cookie(new Cookie(refreshCookieProperties.name(), rotatedRefreshToken)))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/auth/logout").cookie(new Cookie(refreshCookieProperties.name(), rotatedRefreshToken)))
        .andExpect(status().isOk());
  }

  @Test
  void googleOAuthStartRedirectsWithStateCookie() throws Exception {
    var result =
        mockMvc
            .perform(get("/api/auth/oauth/google/start"))
            .andExpect(status().is3xxRedirection())
            .andReturn();

    assertThat(result.getResponse().getRedirectedUrl())
        .startsWith("https://accounts.google.com/o/oauth2/v2/auth")
        .contains("client_id=test-google-client")
        .contains("scope=openid%20email%20profile")
        .contains("state=");
    assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
        .contains("alveryn_google_oauth_state=");
  }

  @Test
  void googleOAuthCallbackCreatesVerifiedAccountAndIssuesRefreshCookie() throws Exception {
    TestGoogleOAuthClient.nextUser =
        new GoogleOAuthUserInfo(
            "google-subject-1",
            "GoogleUser@example.com",
            true,
            "Google User",
            "Google",
            "User",
            null);
    var start =
        mockMvc.perform(get("/api/auth/oauth/google/start")).andExpect(status().is3xxRedirection()).andReturn();
    String state = extractCookieValue(start.getResponse().getHeader(HttpHeaders.SET_COOKIE), "alveryn_google_oauth_state");

    var callback =
        mockMvc
            .perform(
                get("/api/auth/oauth/google/callback")
                    .param("code", "valid-code")
                    .param("state", state)
                    .cookie(new Cookie("alveryn_google_oauth_state", state)))
            .andExpect(status().is3xxRedirection())
            .andReturn();

    assertThat(callback.getResponse().getRedirectedUrl())
        .isEqualTo("http://localhost:5173/auth/oauth/callback");
    assertThat(callback.getResponse().getHeader(HttpHeaders.SET_COOKIE))
        .contains(refreshCookieProperties.name() + "=");
    var user = users.findByEmailIgnoreCase("googleuser@example.com").orElseThrow();
    assertThat(user.isEmailVerified()).isTrue();
    assertThat(preferences.findByUserId(user.getId())).isPresent();
    assertThat(oauthIdentities.findByProviderAndProviderSubject(
            com.alveryn.api.auth.entity.OAuthProvider.GOOGLE, "google-subject-1"))
        .isPresent();
  }

  @Test
  void googleOAuthCallbackLinksExistingVerifiedEmail() throws Exception {
    registerUser("link-google@example.com", "super-secret");
    verifyUser("link-google@example.com");
    TestGoogleOAuthClient.nextUser =
        new GoogleOAuthUserInfo(
            "google-subject-2",
            "link-google@example.com",
            true,
            "Linked User",
            "Linked",
            "User",
            null);
    var start =
        mockMvc.perform(get("/api/auth/oauth/google/start")).andExpect(status().is3xxRedirection()).andReturn();
    String state = extractCookieValue(start.getResponse().getHeader(HttpHeaders.SET_COOKIE), "alveryn_google_oauth_state");

    mockMvc
        .perform(
            get("/api/auth/oauth/google/callback")
                .param("code", "valid-code")
                .param("state", state)
                .cookie(new Cookie("alveryn_google_oauth_state", state)))
        .andExpect(status().is3xxRedirection());

    assertThat(users.findAll().stream().filter(user -> user.getEmail().equals("link-google@example.com")).count())
        .isEqualTo(1);
    assertThat(oauthIdentities.findByProviderAndProviderSubject(
            com.alveryn.api.auth.entity.OAuthProvider.GOOGLE, "google-subject-2"))
        .isPresent();
  }

  @Test
  void forgotAndResetPasswordRemainGenericAndRevokeSessions() throws Exception {
    registerUser("reset@example.com", "super-secret");
    verifyUser("reset@example.com");
    var loginResult = loginResult("reset@example.com", "super-secret");
    String refreshToken = extractCookieValue(loginResult.getResponse().getHeader(HttpHeaders.SET_COOKIE));

    mockMvc
        .perform(
            post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"reset@example.com\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"missing@example.com\"}"))
        .andExpect(status().isOk());

    String resetCode = emailService.resetCodeFor("reset@example.com");
    mockMvc
        .perform(
            post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"reset@example.com","code":"%s","newPassword":"new-secret-pass"}
                    """
                        .formatted(resetCode)))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"reset@example.com","code":"%s","newPassword":"another-pass"}
                    """
                        .formatted(resetCode)))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"reset@example.com\",\"password\":\"super-secret\"}"))
        .andExpect(status().isUnauthorized());
    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"reset@example.com\",\"password\":\"new-secret-pass\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/auth/refresh").cookie(new Cookie(refreshCookieProperties.name(), refreshToken)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void resetPasswordRejectsExpiredAndInvalidCodes() throws Exception {
    registerUser("expired-reset@example.com", "super-secret");
    verifyUser("expired-reset@example.com");

    mockMvc
        .perform(
            post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"expired-reset@example.com\"}"))
        .andExpect(status().isOk());
    String expiredResetCode = emailService.resetCodeFor("expired-reset@example.com");
    jdbcTemplate.update(
        """
        update password_reset_tokens
           set created_at = current_timestamp - interval '2 minute',
               expires_at = current_timestamp - interval '1 minute'
         where user_id = ?
        """,
        users.findByEmailIgnoreCase("expired-reset@example.com").orElseThrow().getId());

    mockMvc
        .perform(
            post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"expired-reset@example.com","code":"%s","newPassword":"another-pass"}
                    """
                        .formatted(expiredResetCode)))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(
            post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"expired-reset@example.com\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"expired-reset@example.com","code":"invalid-token","newPassword":"another-pass"}
                    """))
        .andExpect(status().isUnauthorized());

    var token =
        passwordResetTokens.findAll().stream()
            .max(java.util.Comparator.comparing(com.alveryn.api.auth.entity.PasswordResetToken::getCreatedAt))
            .orElseThrow();
    token.markUsed(token.getCreatedAt().plusSeconds(1));
    passwordResetTokens.save(token);
    mockMvc
        .perform(
            post("/api/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"expired-reset@example.com","code":"%s","newPassword":"another-pass"}
                    """
                        .formatted(emailService.resetCodeFor("expired-reset@example.com"))))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void meResponseOmitsSensitiveFieldsAndFlywayMigrationExists() throws Exception {
    registerUser("me@example.com", "super-secret");
    verifyUser("me@example.com");
    String loginBody = login("me@example.com", "super-secret");
    String accessToken = extractJsonValue(loginBody, "accessToken");

    String body =
        mockMvc
            .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(body).doesNotContain("passwordHash");
    assertThat(body).doesNotContain("securityCodeHash");
    assertThat(body).doesNotContain("failedLoginAttempts");
    assertThat(body).doesNotContain("lockedUntil");
    assertThat(body).doesNotContain("tokenHash");

    Integer migrationCount =
        jdbcTemplate.queryForObject(
            "select count(*) from flyway_schema_history where version = '6'", Integer.class);
    assertThat(migrationCount).isEqualTo(1);
  }

  private void registerUser(String email, String password) throws Exception {
    mockMvc
        .perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"%s","password":"%s"}
                    """
                        .formatted(email, password)))
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
  }

  private String login(String email, String password) throws Exception {
    return loginResult(email, password).getResponse().getContentAsString();
  }

  private org.springframework.test.web.servlet.MvcResult loginResult(String email, String password)
      throws Exception {
    return mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"%s","password":"%s"}
                    """
                        .formatted(email, password)))
        .andExpect(status().isOk())
        .andReturn();
  }

  private String extractJsonValue(String body, String field) {
    String marker = "\"%s\":\"".formatted(field);
    int start = body.indexOf(marker);
    if (start < 0) {
      return "";
    }
    int valueStart = start + marker.length();
    int valueEnd = body.indexOf('"', valueStart);
    return body.substring(valueStart, valueEnd);
  }

  private String hash(String token) {
    try {
      var digest = java.security.MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(hash.length * 2);
      for (byte b : hash) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String extractCookieValue(String setCookieHeader) {
    return extractCookieValue(setCookieHeader, refreshCookieProperties.name());
  }

  private String extractCookieValue(String setCookieHeader, String cookieName) {
    String marker = cookieName + "=";
    int start = setCookieHeader.indexOf(marker);
    int valueStart = start + marker.length();
    int valueEnd = setCookieHeader.indexOf(';', valueStart);
    return setCookieHeader.substring(valueStart, valueEnd);
  }

  @TestConfiguration
  static class AuthTestConfiguration {
    @Bean
    @Primary
    TestAuthenticationEmailService testAuthenticationEmailService() {
      return new TestAuthenticationEmailService();
    }

    @Bean
    @Primary
    GoogleOAuthClient testGoogleOAuthClient() {
      return new TestGoogleOAuthClient();
    }
  }

  static class TestGoogleOAuthClient extends GoogleOAuthClient {
    static GoogleOAuthUserInfo nextUser;

    TestGoogleOAuthClient() {
      super(null);
    }

    @Override
    public GoogleOAuthUserInfo exchangeCodeForUserInfo(String code) {
      if (nextUser == null) {
        throw new IllegalStateException("No Google test user configured");
      }
      return nextUser;
    }

    static void reset() {
      nextUser = null;
    }
  }

  static class TestAuthenticationEmailService implements AuthenticationEmailService {
    private final Map<String, String> verificationCodes = new ConcurrentHashMap<>();
    private final Map<String, String> resetCodes = new ConcurrentHashMap<>();

    @Override
    public void sendVerificationCode(com.alveryn.api.user.entity.UserAccount user, String code) {
      verificationCodes.put(user.getEmail(), code);
    }

    @Override
    public void sendPasswordResetCode(com.alveryn.api.user.entity.UserAccount user, String code) {
      resetCodes.put(user.getEmail(), code);
    }

    String verificationCodeFor(String email) {
      return verificationCodes.get(email.trim().toLowerCase());
    }

    String resetCodeFor(String email) {
      return resetCodes.get(email.trim().toLowerCase());
    }

    void clear() {
      verificationCodes.clear();
      resetCodes.clear();
    }
  }
}
