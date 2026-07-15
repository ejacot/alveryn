package com.alveryn.api.auth.exception;

import com.alveryn.api.common.exception.BusinessException;

public class EmailNotVerifiedException extends BusinessException {
  public EmailNotVerifiedException(String message) {
    super(message);
  }
}
