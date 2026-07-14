package com.roomly.api.common.exception;

import java.util.List;

public class ConflictException extends BusinessException {
  private final List<String> errors;

  public ConflictException(String message) {
    this(message, null, List.of());
  }

  public ConflictException(String message, String code) {
    this(message, code, List.of());
  }

  public ConflictException(String message, String code, List<String> errors) {
    super(message, code);
    this.errors = List.copyOf(errors);
  }

  public List<String> getErrors() {
    return errors;
  }
}
