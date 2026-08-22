package com.alveryn.api.common.exception;

public class PreconditionFailedException extends BusinessException {
  public PreconditionFailedException(String message) {
    super(message, "PRECONDITION_FAILED");
  }
}
