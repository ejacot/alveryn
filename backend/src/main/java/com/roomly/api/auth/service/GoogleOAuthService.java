package com.roomly.api.auth.service;

import com.roomly.api.auth.dto.GoogleOAuthUserInfo;
import com.roomly.api.auth.dto.IssuedAuthSession;
import com.roomly.api.auth.entity.OAuthProvider;
import com.roomly.api.auth.entity.UserOAuthIdentity;
import com.roomly.api.auth.repository.UserOAuthIdentityRepository;
import com.roomly.api.common.exception.ValidationException;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.entity.UserPreferences;
import com.roomly.api.user.entity.UserProfile;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.user.repository.UserPreferencesRepository;
import com.roomly.api.user.repository.UserProfileRepository;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GoogleOAuthService {
  private final GoogleOAuthClient googleClient;
  private final UserOAuthIdentityRepository identities;
  private final UserAccountRepository users;
  private final UserProfileRepository profiles;
  private final UserPreferencesRepository preferences;
  private final PasswordEncoder passwordEncoder;
  private final AuthService authService;

  @Transactional
  public IssuedAuthSession authenticate(String code) {
    GoogleOAuthUserInfo googleUser = googleClient.exchangeCodeForUserInfo(code);
    if (!googleUser.emailVerified()) {
      throw new ValidationException("Google email must be verified", "GOOGLE_EMAIL_NOT_VERIFIED");
    }

    UserOAuthIdentity identity =
        identities
            .findByProviderAndProviderSubject(OAuthProvider.GOOGLE, googleUser.subject())
            .orElseGet(() -> linkOrCreateIdentity(googleUser));
    identity.updateEmail(googleUser.email(), googleUser.emailVerified());
    identities.save(identity);
    return authService.issueVerifiedSession(identity.getUser());
  }

  private UserOAuthIdentity linkOrCreateIdentity(GoogleOAuthUserInfo googleUser) {
    UserAccount user =
        users
            .findByEmailIgnoreCase(normalizeEmail(googleUser.email()))
            .orElseGet(() -> createGoogleUser(googleUser));
    return identities.save(
        new UserOAuthIdentity(
            user,
            OAuthProvider.GOOGLE,
            googleUser.subject(),
            googleUser.email(),
            googleUser.emailVerified()));
  }

  private UserAccount createGoogleUser(GoogleOAuthUserInfo googleUser) {
    UserAccount user =
        new UserAccount(
            normalizeEmail(googleUser.email()),
            passwordEncoder.encode(
                UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "")));
    user.verifyEmail();
    UserAccount saved = users.save(user);
    profiles.save(new UserProfile(saved));
    preferences.save(new UserPreferences(saved));
    return saved;
  }

  private String normalizeEmail(String email) {
    String normalized = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    if (normalized == null || normalized.isBlank()) {
      throw new ValidationException("email: must be a valid email address");
    }
    return normalized;
  }
}
