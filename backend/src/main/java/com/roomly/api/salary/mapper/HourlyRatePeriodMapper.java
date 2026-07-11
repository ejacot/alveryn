package com.roomly.api.salary.mapper;

import com.roomly.api.salary.dto.HourlyRatePeriodDto;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface HourlyRatePeriodMapper {
  @Mapping(target = "userId", source = "user.id")
  HourlyRatePeriodDto toDto(HourlyRatePeriod e);
}
