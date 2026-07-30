package com.alveryn.api.workrecord;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.workrecord.calculation.WorkCalculation;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class WorkCalculationTest {

  @Test
  void appliesDecimalExtraPayPercentageWithoutRoundingItToAnInteger() {
    BigDecimal total = WorkCalculation.applyExtraPay(
        new BigDecimal("100.00"), new BigDecimal("3.75"));

    assertThat(total).isEqualByComparingTo(new BigDecimal("103.75"));
  }
}
