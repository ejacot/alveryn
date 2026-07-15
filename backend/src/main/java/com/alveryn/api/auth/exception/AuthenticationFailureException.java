package com.alveryn.api.auth.exception;

import com.alveryn.api.common.exception.BusinessException;

public class AuthenticationFailureException extends BusinessException {
  public AuthenticationFailureException(String message) {
    super(message);
  }
}
