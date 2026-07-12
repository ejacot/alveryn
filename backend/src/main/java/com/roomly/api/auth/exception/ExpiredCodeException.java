package com.roomly.api.auth.exception;

import com.roomly.api.common.exception.BusinessException;

public class ExpiredCodeException extends BusinessException {
  public ExpiredCodeException(String message) {
    super(message);
  }
}
