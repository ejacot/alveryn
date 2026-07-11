package com.roomly.api.common.exception;

import com.roomly.api.common.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(NotFoundException.class)
  ResponseEntity<ApiErrorResponse> handleNotFound(NotFoundException e, HttpServletRequest r) {
    return response(HttpStatus.NOT_FOUND, e.getMessage(), r, List.of());
  }

  @ExceptionHandler(ConflictException.class)
  ResponseEntity<ApiErrorResponse> handleConflict(ConflictException e, HttpServletRequest r) {
    return response(HttpStatus.CONFLICT, e.getMessage(), r, List.of());
  }

  @ExceptionHandler({ValidationException.class, MethodArgumentNotValidException.class})
  ResponseEntity<ApiErrorResponse> handleValidation(Exception e, HttpServletRequest r) {
    List<String> errors =
        e instanceof MethodArgumentNotValidException v
            ? v.getBindingResult().getFieldErrors().stream()
                .map(x -> x.getField() + ": " + x.getDefaultMessage())
                .toList()
            : List.of(e.getMessage());
    return response(HttpStatus.BAD_REQUEST, "Validation failed", r, errors);
  }

  private ResponseEntity<ApiErrorResponse> response(
      HttpStatus s, String m, HttpServletRequest r, List<String> e) {
    return ResponseEntity.status(s)
        .body(new ApiErrorResponse(OffsetDateTime.now(), s.value(), m, r.getRequestURI(), e));
  }
}
