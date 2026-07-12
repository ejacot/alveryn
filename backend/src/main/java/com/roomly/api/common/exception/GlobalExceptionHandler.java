package com.roomly.api.common.exception;

import com.roomly.api.auth.exception.AuthenticationFailureException;
import com.roomly.api.auth.exception.EmailNotVerifiedException;
import com.roomly.api.auth.exception.ExpiredCodeException;
import com.roomly.api.auth.exception.UnauthorizedException;
import com.roomly.api.common.response.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;

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

  @ExceptionHandler({
    ValidationException.class,
    MethodArgumentNotValidException.class,
    ConstraintViolationException.class,
    HandlerMethodValidationException.class
  })
  ResponseEntity<ApiErrorResponse> handleValidation(Exception e, HttpServletRequest r) {
    List<String> errors =
        e instanceof MethodArgumentNotValidException v
            ? v.getBindingResult().getFieldErrors().stream()
                .map(x -> normalizeFieldPath(x.getField()) + ": " + x.getDefaultMessage())
                .toList()
            : e instanceof ConstraintViolationException v
                ? v.getConstraintViolations().stream()
                    .map(x -> x.getPropertyPath() + ": " + x.getMessage())
                    .toList()
                : e instanceof HandlerMethodValidationException v
                    ? v.getParameterValidationResults().stream().flatMap(this::parameterMessages).toList()
            : List.of(e.getMessage());
    return response(HttpStatus.BAD_REQUEST, "Validation failed", r, errors);
  }

  @ExceptionHandler({ExpiredCodeException.class})
  ResponseEntity<ApiErrorResponse> handleExpiredCode(ExpiredCodeException e, HttpServletRequest r) {
    return response(HttpStatus.BAD_REQUEST, e.getMessage(), r, List.of());
  }

  @ExceptionHandler({
    AuthenticationFailureException.class,
    UnauthorizedException.class,
    EmailNotVerifiedException.class
  })
  ResponseEntity<ApiErrorResponse> handleUnauthorized(BusinessException e, HttpServletRequest r) {
    return response(HttpStatus.UNAUTHORIZED, e.getMessage(), r, List.of());
  }

  private ResponseEntity<ApiErrorResponse> response(
      HttpStatus s, String m, HttpServletRequest r, List<String> e) {
    return ResponseEntity.status(s)
        .body(new ApiErrorResponse(OffsetDateTime.now(), s.value(), m, r.getRequestURI(), e));
  }

  private java.util.stream.Stream<String> parameterMessages(ParameterValidationResult result) {
    if (result instanceof ParameterErrors errors) {
      String parameterName = result.getMethodParameter().getParameterName();
      return errors.getFieldErrors().stream().map(x -> parameterName + ": " + x.getDefaultMessage());
    }
    String parameterName = result.getMethodParameter().getParameterName();
    return result.getResolvableErrors().stream()
        .map(MessageSourceResolvable::getDefaultMessage)
        .map(message -> parameterName + ": " + message);
  }

  private String normalizeFieldPath(String field) {
    int separator = field.lastIndexOf('.');
    return separator >= 0 ? field.substring(separator + 1) : field;
  }
}
