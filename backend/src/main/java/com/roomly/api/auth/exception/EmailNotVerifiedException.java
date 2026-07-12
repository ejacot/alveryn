package com.roomly.api.auth.exception;

import com.roomly.api.common.exception.BusinessException;

public class EmailNotVerifiedException extends BusinessException {
  public EmailNotVerifiedException(String message) {
    super(message);
  }
}
