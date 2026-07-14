package com.roomly.api.statistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record StatisticsHighlightResponse(
    HighlightType type,
    boolean available,
    String label,
    String value,
    LocalDate from,
    LocalDate to,
    BigDecimal numericValue,
    String currency,
    List<MoneyAmountResponse> grossByCurrency) {}
