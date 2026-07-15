package com.alveryn.api.worktype.mapper;

import com.alveryn.api.worktype.dto.*;
import com.alveryn.api.worktype.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface WorkTypeMapper {
  WorkTypeResponse toWorkTypeResponse(WorkType e);

  @Mapping(target = "workTypeId", source = "workType.id")
  UnitTypeResponse toUnitTypeResponse(UnitType e);
}
