package com.alveryn.api.auth.exception;

import com.alveryn.api.common.exception.BusinessException;

public class UnauthorizedException extends BusinessException {
  public UnauthorizedException(String message) {
    super(message);
  }
}
