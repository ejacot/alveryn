package com.roomly.api.salary.mapper;

import com.roomly.api.salary.dto.HourlyRatePeriodResponse;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface HourlyRatePeriodMapper {
  HourlyRatePeriodResponse toResponse(HourlyRatePeriod e);
}
