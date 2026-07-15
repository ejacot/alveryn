package com.alveryn.api.salary.mapper;

import com.alveryn.api.salary.dto.HourlyRatePeriodResponse;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface HourlyRatePeriodMapper {
  HourlyRatePeriodResponse toResponse(HourlyRatePeriod e);
}
