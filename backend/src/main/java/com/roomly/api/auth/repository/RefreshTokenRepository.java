package com.roomly.api.auth.repository;

import com.roomly.api.auth.entity.RefreshToken;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
  Optional<RefreshToken> findByTokenHash(String tokenHash);

  @Modifying
  @Query(
      """
      update RefreshToken token
         set token.revokedAt = :revokedAt
       where token.user.id = :userId
         and token.revokedAt is null
         and token.expiresAt > :revokedAt
      """)
  int revokeAllActiveByUserId(@Param("userId") UUID userId, @Param("revokedAt") OffsetDateTime revokedAt);
}
