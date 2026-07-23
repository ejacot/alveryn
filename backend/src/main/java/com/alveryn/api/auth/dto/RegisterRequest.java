package com.alveryn.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(max = 255) String email,
    @NotBlank @Size(min = 8, max = 128) String password,
    RegistrationAccountType accountType,
    @Size(max = 160) String companyName,
    @Size(max = 60) String timezone,
    @Size(max = 512) String invitationToken) {
  public RegisterRequest {
    accountType = accountType == null ? RegistrationAccountType.PERSONAL : accountType;
  }

  public RegisterRequest(String email, String password) {
    this(email, password, RegistrationAccountType.PERSONAL, null, null, null);
  }
}
