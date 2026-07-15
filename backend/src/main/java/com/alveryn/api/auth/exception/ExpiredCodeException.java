package com.alveryn.api.auth.exception;

import com.alveryn.api.common.exception.BusinessException;

public class ExpiredCodeException extends BusinessException {
  public ExpiredCodeException(String message) {
    super(message);
  }
}
