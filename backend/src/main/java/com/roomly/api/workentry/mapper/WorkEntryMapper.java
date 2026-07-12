package com.roomly.api.workentry.mapper;

import com.roomly.api.workentry.dto.TimeEntryDetailsResponse;
import com.roomly.api.workentry.dto.UnitEntryItemResponse;
import com.roomly.api.workentry.dto.WorkEntryResponse;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.WorkEntry;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.mapstruct.InjectionStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring", injectionStrategy = InjectionStrategy.CONSTRUCTOR)
public interface WorkEntryMapper {
  @Mapping(target = "workTypeId", source = "entry.workType.id")
  @Mapping(target = "workTypeName", source = "entry.workTypeNameSnapshot")
  @Mapping(target = "calculationMethod", source = "entry.calculationMethodSnapshot")
  @Mapping(target = "hourlyRateSnapshot", source = "entry.hourlyRateSnapshot")
  @Mapping(target = "currencySnapshot", source = "entry.currencySnapshot")
  @Mapping(target = "calculatedMinutes", source = "entry.calculatedMinutes")
  @Mapping(
      target = "workedHours",
      source = "entry.calculatedMinutes",
      qualifiedByName = "toWorkedHours")
  @Mapping(target = "grossAmount", source = "entry.grossAmount")
  @Mapping(target = "notes", source = "entry.notes")
  @Mapping(target = "timeEntry", source = "timeEntry")
  @Mapping(target = "unitItems", source = "unitItems")
  WorkEntryResponse toResponse(
      WorkEntry entry, TimeEntryDetailsResponse timeEntry, List<UnitEntryItemResponse> unitItems);

  @Mapping(target = "workedMinutes", expression = "java(entity.getWorkedMinutes())")
  TimeEntryDetailsResponse toResponse(TimeEntryDetails entity);

  @Mapping(target = "unitTypeId", source = "unitType.id")
  @Mapping(target = "unitName", source = "unitNameSnapshot")
  UnitEntryItemResponse toResponse(UnitEntryItem entity);

  List<UnitEntryItemResponse> toUnitItemResponses(List<UnitEntryItem> entities);

  @Named("toWorkedHours")
  default BigDecimal toWorkedHours(BigDecimal calculatedMinutes) {
    return calculatedMinutes.divide(BigDecimal.valueOf(60), WorkEntry.TIME_SCALE, RoundingMode.HALF_UP);
  }
}
