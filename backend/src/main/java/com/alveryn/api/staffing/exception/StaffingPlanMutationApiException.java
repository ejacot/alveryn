package com.alveryn.api.staffing.exception;

import com.alveryn.api.common.exception.BusinessException;
import org.springframework.http.HttpStatus;

public class StaffingPlanMutationApiException extends BusinessException {
  private final HttpStatus status;
  private final String etag;

  public StaffingPlanMutationApiException(HttpStatus status, String code, String message) {
    this(status, code, message, null);
  }

  public StaffingPlanMutationApiException(HttpStatus status, String code, String message,
      String etag) {
    super(message, code);
    this.status = status;
    this.etag = etag;
  }

  public HttpStatus getStatus() { return status; }
  public String getEtag() { return etag; }
}
