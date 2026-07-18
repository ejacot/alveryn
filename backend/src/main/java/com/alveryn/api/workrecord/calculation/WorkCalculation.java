package com.alveryn.api.workrecord.calculation;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

public final class WorkCalculation {
  public static final int RATE_SCALE = 2;
  public static final int GROSS_SCALE = 15;
  public static final RoundingMode RATE_ROUNDING = RoundingMode.HALF_UP;
  public static final MathContext TIME_MATH_CONTEXT = MathContext.DECIMAL128;
  public static final int TIME_SCALE = 15;

  private WorkCalculation() {}

  public static BigDecimal calculateGross(int minutes, BigDecimal hourlyRate) {
    return calculateGross(BigDecimal.valueOf(minutes), hourlyRate);
  }

  public static BigDecimal calculateGross(BigDecimal minutes, BigDecimal hourlyRate) {
    return calculateGross(minutes, hourlyRate, 0);
  }

  public static BigDecimal calculateGross(
      BigDecimal minutes, BigDecimal hourlyRate, int extraPayPercentage) {
    if (minutes == null || minutes.signum() <= 0 || hourlyRate == null || hourlyRate.signum() < 0) {
      throw new IllegalArgumentException("invalid calculation inputs");
    }
    BigDecimal multiplier =
        BigDecimal.valueOf(100L + normalizeExtraPayPercentage(extraPayPercentage))
            .divide(BigDecimal.valueOf(100), TIME_MATH_CONTEXT);
    return hourlyRate
        .multiply(minutes, TIME_MATH_CONTEXT)
        .divide(BigDecimal.valueOf(60), TIME_MATH_CONTEXT)
        .multiply(multiplier, TIME_MATH_CONTEXT)
        .setScale(GROSS_SCALE, RoundingMode.HALF_UP);
  }

  public static BigDecimal calculatePerUnitGross(BigDecimal quantity, BigDecimal ratePerUnit) {
    if (quantity == null || quantity.signum() <= 0 || ratePerUnit == null || ratePerUnit.signum() <= 0) {
      throw new IllegalArgumentException("invalid per-unit calculation inputs");
    }
    return quantity.multiply(ratePerUnit, TIME_MATH_CONTEXT).setScale(GROSS_SCALE, RoundingMode.HALF_UP);
  }

  public static int normalizeExtraPayPercentage(int value) {
    if (value < 0 || value > 1000) {
      throw new IllegalArgumentException("extraPayPercentage must be between 0 and 1000");
    }
    return value;
  }
}
