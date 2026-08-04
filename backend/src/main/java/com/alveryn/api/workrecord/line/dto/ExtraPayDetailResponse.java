package com.alveryn.api.workrecord.line.dto;

import java.math.BigDecimal;

public record ExtraPayDetailResponse(
    String name,
    BigDecimal eligibleMinutes,
    BigDecimal percentage) {}
