package com.roomly.api.common.exception;

public class ConflictException extends BusinessException {
  public ConflictException(String message) {
    super(message);
  }

  public ConflictException(String message, String code) {
    super(message, code);
  }
}
