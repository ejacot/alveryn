package com.alveryn.api.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workentry.entity.*;
import com.alveryn.api.workentry.repository.*;
import com.alveryn.api.worktype.entity.*;
import com.alveryn.api.worktype.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class PrecisionPersistenceTest {
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired UnitTypeRepository unitTypes;
  @Autowired WorkEntryRepository entries;
  @Autowired UnitEntryItemRepository items;
  @Autowired JdbcTemplate jdbc;

  @Test
  void persistsFractionalUnitMinutesAtScaleFifteen() {
    var user = users.save(new UserAccount("precision@example.com", "hash"));
    var type = workTypes.save(new WorkType(user, "Units", CalculationMethod.UNIT_BASED));
    var unit = unitTypes.save(new UnitType(type, "Sevenths", new BigDecimal("7")));
    var exact = UnitEntryItem.calculateMinutes(BigDecimal.ONE, unit.getUnitsPerHour());
    var entry =
        entries.save(
            new WorkEntry(user, type, LocalDate.now(), new BigDecimal("17.50"), "EUR", exact));
    var item = items.saveAndFlush(new UnitEntryItem(entry, unit, BigDecimal.ONE));
    assertThat(item.getCalculatedMinutes()).isEqualByComparingTo("8.571428571428571");
    Integer scale =
        jdbc.queryForObject(
            "select numeric_scale from information_schema.columns where"
                + " table_name='unit_entry_items' and column_name='calculated_minutes'",
            Integer.class);
    assertThat(scale).isEqualTo(15);
  }
}
