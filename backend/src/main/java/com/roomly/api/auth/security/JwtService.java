package com.roomly.api.auth.security;

import com.roomly.api.auth.config.AuthProperties;
import com.roomly.api.user.entity.UserAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final SecretKey secretKey;
  private final AuthProperties properties;
  private final Clock clock;

  public JwtService(AuthProperties properties, Clock clock) {
    this.properties = properties;
    this.clock = clock;
    this.secretKey = Keys.hmacShaKeyFor(properties.jwtSecret().getBytes(StandardCharsets.UTF_8));
  }

  public String generateAccessToken(UserAccount user) {
    OffsetDateTime issuedAt = OffsetDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS);
    OffsetDateTime expiresAt = issuedAt.plus(properties.accessTokenLifetime());
    return Jwts.builder()
        .subject(user.getId().toString())
        .claim("email", user.getEmail())
        .issuedAt(Date.from(issuedAt.toInstant()))
        .expiration(Date.from(expiresAt.toInstant()))
        .signWith(secretKey)
        .compact();
  }

  public Claims parse(String token) {
    return Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token).getPayload();
  }

  public long getAccessTokenExpiresInSeconds() {
    return properties.accessTokenLifetime().toSeconds();
  }

  public UUID extractUserId(Claims claims) {
    return UUID.fromString(claims.getSubject());
  }
}
