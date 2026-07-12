package com.roomly.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.roomly.api.auth.config.AuthProperties;
import com.roomly.api.auth.email.AuthenticationEmailService;
import com.roomly.api.auth.repository.PasswordResetTokenRepository;
import com.roomly.api.auth.repository.RefreshTokenRepository;
import com.roomly.api.user.repository.UserAccountRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
  @Autowired RefreshTokenRepository refreshTokens;
  @Autowired PasswordResetTokenRepository passwordResetTokens;
  @Autowired PasswordEncoder passwordEncoder;
  @Autowired TestAuthenticationEmailService emailService;
  @Autowired AuthProperties authProperties;
  @Autowired JdbcTemplate jdbcTemplate;
  @Autowired WebApplicationContext context;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    refreshTokens.deleteAll();
    passwordResetTokens.deleteAll();
    users.deleteAll();
    emailService.clear();
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
        .andExpect(jsonPath("$.email").value("newuser@example.com"))
        .andExpect(jsonPath("$.emailVerified").value(false));

    var user = users.findByEmailIgnoreCase("newuser@example.com").orElseThrow();
    assertThat(user.getPasswordHash()).isNotEqualTo("super-secret");
    assertThat(passwordEncoder.matches("super-secret", user.getPasswordHash())).isTrue();
    assertThat(user.getSecurityCodeHash()).isNotEqualTo(emailService.verificationCodeFor("newuser@example.com"));
    assertThat(passwordEncoder.matches(emailService.verificationCodeFor("newuser@example.com"), user.getSecurityCodeHash()))
        .isTrue();
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
    assertThat(extractJsonValue(successBody, "refreshToken")).isNotBlank();
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
  void jwtProtectsApiMeAndRejectsExpiredInvalidAndMalformedTokens() throws Exception {
    registerUser("jwt@example.com", "super-secret");
    verifyUser("jwt@example.com");
    String loginBody = login("jwt@example.com", "super-secret");
    String accessToken = extractJsonValue(loginBody, "accessToken");

    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.account.email").value("jwt@example.com"));

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
    String loginBody = login("refresh@example.com", "super-secret");
    String refreshToken = extractJsonValue(loginBody, "refreshToken");

    String refreshBody =
        mockMvc
            .perform(
                post("/api/auth/refresh")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String rotatedRefreshToken = extractJsonValue(refreshBody, "refreshToken");
    assertThat(rotatedRefreshToken).isNotEqualTo(refreshToken);

    mockMvc
        .perform(
            post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(
            post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(rotatedRefreshToken)))
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
            post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(rotatedRefreshToken)))
        .andExpect(status().isUnauthorized());

    var stored = refreshTokens.findByTokenHash(hash(rotatedRefreshToken)).orElseThrow();
    stored.revoke(OffsetDateTime.now().minusMinutes(1), stored.getReplacedByTokenId());
    refreshTokens.save(stored);
    mockMvc
        .perform(
            post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(rotatedRefreshToken)))
        .andExpect(status().isUnauthorized());

    mockMvc
        .perform(
            post("/api/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(rotatedRefreshToken)))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(rotatedRefreshToken)))
        .andExpect(status().isOk());
  }

  @Test
  void forgotAndResetPasswordRemainGenericAndRevokeSessions() throws Exception {
    registerUser("reset@example.com", "super-secret");
    verifyUser("reset@example.com");
    String loginBody = login("reset@example.com", "super-secret");
    String refreshToken = extractJsonValue(loginBody, "refreshToken");

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
            post("/api/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
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
            .max(java.util.Comparator.comparing(com.roomly.api.auth.entity.PasswordResetToken::getCreatedAt))
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
        .andReturn()
        .getResponse()
        .getContentAsString();
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

  @TestConfiguration
  static class AuthTestConfiguration {
    @Bean
    @Primary
    TestAuthenticationEmailService testAuthenticationEmailService() {
      return new TestAuthenticationEmailService();
    }
  }

  static class TestAuthenticationEmailService implements AuthenticationEmailService {
    private final Map<String, String> verificationCodes = new ConcurrentHashMap<>();
    private final Map<String, String> resetCodes = new ConcurrentHashMap<>();

    @Override
    public void sendVerificationCode(com.roomly.api.user.entity.UserAccount user, String code) {
      verificationCodes.put(user.getEmail(), code);
    }

    @Override
    public void sendPasswordResetCode(com.roomly.api.user.entity.UserAccount user, String code) {
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
