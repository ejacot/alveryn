package com.alveryn.api.common.exception;
public class ForbiddenException extends BusinessException {
  public ForbiddenException(String message) { super(message, "FORBIDDEN"); }
}
