package com.roomly.api.worktype.mapper;

import com.roomly.api.worktype.dto.*;
import com.roomly.api.worktype.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface WorkTypeMapper {
  WorkTypeResponse toWorkTypeResponse(WorkType e);

  @Mapping(target = "workTypeId", source = "workType.id")
  UnitTypeResponse toUnitTypeResponse(UnitType e);
}
