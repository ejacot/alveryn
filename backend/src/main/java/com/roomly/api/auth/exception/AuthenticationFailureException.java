package com.roomly.api.auth.exception;

import com.roomly.api.common.exception.BusinessException;

public class AuthenticationFailureException extends BusinessException {
  public AuthenticationFailureException(String message) {
    super(message);
  }
}
