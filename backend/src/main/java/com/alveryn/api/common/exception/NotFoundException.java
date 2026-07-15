package com.alveryn.api.common.exception;

public class NotFoundException extends BusinessException {
  public NotFoundException(String resource, Object id) {
    super(resource + " not found: " + id);
  }
}
