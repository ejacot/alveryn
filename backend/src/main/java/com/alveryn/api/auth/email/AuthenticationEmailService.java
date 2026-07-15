package com.alveryn.api.auth.email;

import com.alveryn.api.user.entity.UserAccount;

public interface AuthenticationEmailService {
  void sendVerificationCode(UserAccount user, String code);

  void sendPasswordResetCode(UserAccount user, String code);
}
