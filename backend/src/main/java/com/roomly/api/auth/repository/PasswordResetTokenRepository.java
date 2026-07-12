package com.roomly.api.auth.repository;

import com.roomly.api.auth.entity.PasswordResetToken;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
  List<PasswordResetToken> findAllByUser_IdOrderByCreatedAtDesc(UUID userId);

  @Modifying
  @Query(
      """
      update PasswordResetToken token
         set token.usedAt = :usedAt
       where token.user.id = :userId
         and token.usedAt is null
         and token.expiresAt > :usedAt
      """)
  int markAllActiveAsUsed(@Param("userId") UUID userId, @Param("usedAt") OffsetDateTime usedAt);
}
