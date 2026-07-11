package com.roomly.api.worktype.mapper;

import com.roomly.api.worktype.dto.*;
import com.roomly.api.worktype.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface WorkTypeMapper {
  @Mapping(target = "userId", source = "user.id")
  WorkTypeDto toDto(WorkType e);

  @Mapping(target = "workTypeId", source = "workType.id")
  UnitTypeDto toDto(UnitType e);
}
