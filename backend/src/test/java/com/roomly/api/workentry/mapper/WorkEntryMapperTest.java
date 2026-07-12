package com.roomly.api.workentry.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

class WorkEntryMapperTest {
  private final WorkEntryMapper mapper = Mappers.getMapper(WorkEntryMapper.class);

  @Test
  void mapsSnapshotsAndCalculatedFields() {
    UserAccount user = new UserAccount("mapper@example.com", "hash");
    WorkType workType = new WorkType(user, "Rooms", CalculationMethod.UNIT_BASED);
    UnitType unitType = new UnitType(workType, "Suite", new BigDecimal("2.5000"));
    WorkEntry entry =
        new WorkEntry(
            user,
            workType,
            LocalDate.of(2026, 7, 1),
            new BigDecimal("20.00"),
            "eur",
            new BigDecimal("120.000000000000000"));
    UnitEntryItem item = new UnitEntryItem(entry, unitType, new BigDecimal("2.00"));

    var response = mapper.toResponse(entry, null, List.of(mapper.toResponse(item)));

    assertThat(response.workTypeName()).isEqualTo("Rooms");
    assertThat(response.workTypeId()).isEqualTo(workType.getId());
    assertThat(response.hourlyRateSnapshot()).isEqualByComparingTo("20.00");
    assertThat(response.calculatedMinutes()).isEqualByComparingTo("120.000000000000000");
    assertThat(response.workedHours()).isEqualByComparingTo("2.000000000000000");
    assertThat(response.unitItems()).singleElement().satisfies(unitItem -> {
      assertThat(unitItem.unitTypeId()).isEqualTo(unitType.getId());
      assertThat(unitItem.unitName()).isEqualTo("Suite");
    });
  }

  @Test
  void mapsTimeEntryDetailsWorkedMinutes() {
    UserAccount user = new UserAccount("time-mapper@example.com", "hash");
    WorkType workType = new WorkType(user, "Time", CalculationMethod.TIME_BASED);
    WorkEntry entry =
        new WorkEntry(
            user, workType, LocalDate.of(2026, 7, 1), new BigDecimal("18.50"), "EUR", 450);
    TimeEntryDetails details =
        new TimeEntryDetails(entry, LocalTime.of(8, 0), LocalTime.of(16, 0), 30);

    var response = mapper.toResponse(details);

    assertThat(response.totalIntervalMinutes()).isEqualTo(480);
    assertThat(response.workedMinutes()).isEqualTo(450);
  }
}
