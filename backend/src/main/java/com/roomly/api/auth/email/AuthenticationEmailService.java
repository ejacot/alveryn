package com.roomly.api.auth.email;

import com.roomly.api.user.entity.UserAccount;

public interface AuthenticationEmailService {
  void sendVerificationCode(UserAccount user, String code);

  void sendPasswordResetCode(UserAccount user, String code);
}
