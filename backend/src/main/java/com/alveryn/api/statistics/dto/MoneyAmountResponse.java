package com.alveryn.api.statistics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "Monetary amount preserved in its original currency")
public record MoneyAmountResponse(String currency, BigDecimal amount) {}
