package com.alveryn.api.auth.repository;

import com.alveryn.api.auth.entity.OAuthProvider;
import com.alveryn.api.auth.entity.UserOAuthIdentity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserOAuthIdentityRepository extends JpaRepository<UserOAuthIdentity, UUID> {
  Optional<UserOAuthIdentity> findByProviderAndProviderSubject(
      OAuthProvider provider, String providerSubject);
}
