package com.roomly.api.common.exception;

public class ValidationException extends BusinessException {
  public ValidationException(String message) {
    super(message);
  }

  public ValidationException(String message, String code) {
    super(message, code);
  }
}
