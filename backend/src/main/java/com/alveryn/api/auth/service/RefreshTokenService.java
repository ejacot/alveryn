package com.alveryn.api.auth.service;

import com.alveryn.api.auth.config.AuthProperties;
import com.alveryn.api.auth.entity.RefreshToken;
import com.alveryn.api.auth.exception.AuthenticationFailureException;
import com.alveryn.api.auth.repository.RefreshTokenRepository;
import com.alveryn.api.auth.util.AuthTokenGenerator;
import com.alveryn.api.auth.util.TokenHashingService;
import com.alveryn.api.user.entity.UserAccount;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {
  private final RefreshTokenRepository repository;
  private final AuthTokenGenerator tokenGenerator;
  private final TokenHashingService hashingService;
  private final AuthProperties properties;
  private final Clock clock;

  @Transactional
  public IssuedRefreshToken issue(UserAccount user) {
    String token = tokenGenerator.generateRefreshToken();
    OffsetDateTime now = OffsetDateTime.now(clock);
    OffsetDateTime expiresAt = now.plus(properties.refreshTokenLifetime());
    RefreshToken refreshToken =
        repository.save(new RefreshToken(user, hashingService.sha256Hex(token), expiresAt));
    return new IssuedRefreshToken(token, refreshToken);
  }

  @Transactional(readOnly = true)
  public RefreshToken findByPlainToken(String token) {
    return repository.findByTokenHash(hashingService.sha256Hex(token)).orElse(null);
  }

  @Transactional
  public IssuedRefreshToken rotate(String plainToken, Predicate<UserAccount> userValidator) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    RefreshToken current =
        repository
            .findByTokenHashForUpdate(hashingService.sha256Hex(plainToken))
            .orElseThrow(() -> new AuthenticationFailureException("Invalid refresh token"));
    if (!current.isActive(now)) {
      throw new AuthenticationFailureException("Invalid refresh token");
    }
    if (!userValidator.test(current.getUser())) {
      throw new AuthenticationFailureException("Invalid refresh token");
    }

    IssuedRefreshToken replacement = issue(current.getUser());
    current.revoke(now, replacement.persistedToken().getId());
    repository.save(current);
    return replacement;
  }

  @Transactional
  public void revokeByPlainToken(String token) {
    RefreshToken refreshToken = findByPlainToken(token);
    if (refreshToken != null && refreshToken.getRevokedAt() == null) {
      refreshToken.revoke(OffsetDateTime.now(clock), refreshToken.getReplacedByTokenId());
      repository.save(refreshToken);
    }
  }

  @Transactional
  public void revokeAllActiveForUser(UserAccount user) {
    repository.revokeAllActiveByUserId(user.getId(), OffsetDateTime.now(clock));
  }

  public record IssuedRefreshToken(String plainToken, RefreshToken persistedToken) {}
}
