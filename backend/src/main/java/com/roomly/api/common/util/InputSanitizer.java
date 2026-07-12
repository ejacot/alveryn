package com.roomly.api.common.util;

import com.roomly.api.common.exception.ValidationException;
import java.time.ZoneId;
import java.util.Locale;

public final class InputSanitizer {
  private InputSanitizer() {}

  public static String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  public static String requireTrimmed(String value, String field) {
    String normalized = trimToNull(value);
    if (normalized == null) {
      throw new ValidationException(field + " is required");
    }
    return normalized;
  }

  public static String normalizeCurrency(String value) {
    String normalized = requireTrimmed(value, "currency");
    if (!normalized.matches("[A-Za-z]{3}")) {
      throw new ValidationException("currency must be exactly three letters");
    }
    return normalized.toUpperCase(Locale.ROOT);
  }

  public static String normalizeCountryCode(String value) {
    String normalized = trimToNull(value);
    if (normalized == null) {
      return null;
    }
    if (!normalized.matches("[A-Za-z]{2}")) {
      throw new ValidationException("countryCode must be a two-letter code");
    }
    return normalized.toUpperCase(Locale.ROOT);
  }

  public static void validateTimezone(String timezone) {
    try {
      ZoneId.of(timezone);
    } catch (RuntimeException ex) {
      throw new ValidationException("timezone must be a valid ZoneId");
    }
  }
}
