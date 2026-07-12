package com.roomly.api.auth.exception;

import com.roomly.api.common.exception.BusinessException;

public class UnauthorizedException extends BusinessException {
  public UnauthorizedException(String message) {
    super(message);
  }
}
