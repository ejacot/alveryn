package com.alveryn.api.user.repository;

import com.alveryn.api.user.entity.UserPreferences;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPreferencesRepository extends JpaRepository<UserPreferences, UUID> {
  Optional<UserPreferences> findByUserId(UUID userId);
}
