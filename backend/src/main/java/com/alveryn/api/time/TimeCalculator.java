package com.alveryn.api.time;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public final class TimeCalculator {
  private TimeCalculator() {}

  public static int intervalMinutes(LocalTime start, LocalTime end) {
    LocalDate day = LocalDate.of(2000, 1, 1);
    LocalDateTime from = LocalDateTime.of(day, start);
    LocalDateTime to = LocalDateTime.of(end.isAfter(start) ? day : day.plusDays(1), end);
    return Math.toIntExact(Duration.between(from, to).toMinutes());
  }
}
