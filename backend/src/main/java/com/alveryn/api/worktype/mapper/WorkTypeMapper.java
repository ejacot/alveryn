package com.alveryn.api.worktype.mapper;

import com.alveryn.api.worktype.dto.*;
import com.alveryn.api.worktype.entity.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface WorkTypeMapper {
  @Mapping(target = "parentId", source = "parent.id")
  @Mapping(target = "deletable", ignore = true)
  WorkTypeResponse toWorkTypeResponse(WorkType e);
}
