package com.alveryn.api.dashboard;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.workrecord.line.entity.WorkRecordLine;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class DashboardIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired WorkRecordRepository workRecords;
  @Autowired WorkRecordLineRepository workRecordLines;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    cleanDatabase();
  }

  @AfterEach
  void tearDown() {
    cleanDatabase();
  }

  private void cleanDatabase() {
    workRecordLines.deleteAll();
    workRecords.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    users.deleteAll();
  }

  @Test
  void dashboardUsesWorkRecordLinesAsPrimarySource() throws Exception {
    UserAccount user = createVerifiedUser("dashboard-records@example.com");
    WorkType timeType = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    WorkType unitType = new WorkType(user, "2 Lagen", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    unitType.changeColor("#87C95A");
    unitType.configureUnit("Metru patrat", "m2");
    unitType.configureFormula(null, new BigDecimal("50.0000"), "EUR");
    workTypes.saveAndFlush(unitType);

    WorkRecord record = workRecords.saveAndFlush(new WorkRecord(user, null, LocalDate.of(2026, 7, 16), null, null));
    workRecordLines.saveAndFlush(
        WorkRecordLine.timeHourlyDuration(
            record, timeType, 0, 480, new BigDecimal("20.00"), "EUR", 0, null));
    workRecordLines.saveAndFlush(WorkRecordLine.unitsPerUnit(record, unitType, 1, new BigDecimal("300"), null, null));

    mockMvc
        .perform(get("/api/dashboard").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentMonth").value("2026-07"))
        .andExpect(jsonPath("$.data.workedMinutes").value(480.000000000000000))
        .andExpect(jsonPath("$.data.workedHours").value(8.000000000000000))
        .andExpect(jsonPath("$.data.grossAmount").value(15160.000000000000000))
        .andExpect(jsonPath("$.data.entriesCount").value(1));
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private WorkType createWorkType(UserAccount user, String name, CalculationMethod calculationMethod) {
    WorkType workType = new WorkType(user, name, calculationMethod);
    workType.changeCompensationMethod(
        calculationMethod == CalculationMethod.UNIT_BASED ? CompensationMethod.PER_UNIT : CompensationMethod.HOURLY);
    workType.changeColor("#87C95A");
    return workTypes.saveAndFlush(workType);
  }

  private String bearerToken(UserAccount user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  @TestConfiguration
  static class DashboardClockConfiguration {
    @Bean
    @Primary
    Clock dashboardClock() {
      return Clock.fixed(Instant.parse("2026-07-17T12:00:00Z"), ZoneOffset.UTC);
    }
  }
}
