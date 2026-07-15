package com.alveryn.api.workentry.mapper;

import com.alveryn.api.workentry.dto.TimeEntryDetailsResponse;
import com.alveryn.api.workentry.dto.UnitEntryItemResponse;
import com.alveryn.api.workentry.dto.WorkEntryResponse;
import com.alveryn.api.workentry.entity.TimeEntryDetails;
import com.alveryn.api.workentry.entity.UnitEntryItem;
import com.alveryn.api.workentry.entity.WorkEntry;
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
  @Mapping(target = "compensationMethod", source = "entry.compensationMethodSnapshot")
  @Mapping(target = "hourlyRateSnapshot", source = "entry.hourlyRateSnapshot")
  @Mapping(target = "currencySnapshot", source = "entry.currencySnapshot")
  @Mapping(target = "calculatedMinutes", source = "entry.calculatedMinutes")
  @Mapping(
      target = "workedHours",
      source = "entry.calculatedMinutes",
      qualifiedByName = "toWorkedHours")
  @Mapping(target = "grossAmount", source = "entry.grossAmount")
  @Mapping(target = "extraPayPercentage", source = "entry.extraPayPercentage")
  @Mapping(target = "notes", source = "entry.notes")
  @Mapping(target = "timeEntry", source = "timeEntry")
  @Mapping(target = "unitItems", source = "unitItems")
  WorkEntryResponse toResponse(
      WorkEntry entry, TimeEntryDetailsResponse timeEntry, List<UnitEntryItemResponse> unitItems);

  @Mapping(target = "workedMinutes", expression = "java(entity.getWorkedMinutes())")
  TimeEntryDetailsResponse toResponse(TimeEntryDetails entity);

  @Mapping(target = "unitTypeId", source = "unitType.id")
  @Mapping(target = "unitName", source = "unitNameSnapshot")
  @Mapping(target = "unitSymbol", source = "unitSymbolSnapshot")
  @Mapping(target = "displayOrder", source = "unitType.displayOrder")
  UnitEntryItemResponse toResponse(UnitEntryItem entity);

  List<UnitEntryItemResponse> toUnitItemResponses(List<UnitEntryItem> entities);

  @Named("toWorkedHours")
  default BigDecimal toWorkedHours(BigDecimal calculatedMinutes) {
    return calculatedMinutes.divide(BigDecimal.valueOf(60), WorkEntry.TIME_SCALE, RoundingMode.HALF_UP);
  }
}
