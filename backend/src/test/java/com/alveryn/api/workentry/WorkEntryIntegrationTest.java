package com.alveryn.api.workentry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.salary.service.SalaryCalculationService;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.workentry.entity.TimeEntryDetails;
import com.alveryn.api.workentry.entity.UnitEntryItem;
import com.alveryn.api.workentry.entity.WorkEntry;
import com.alveryn.api.workentry.repository.TimeEntryDetailsRepository;
import com.alveryn.api.workentry.repository.UnitEntryItemRepository;
import com.alveryn.api.workentry.repository.WorkEntryRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.entity.UnitType;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.UnitTypeRepository;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class WorkEntryIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired UnitTypeRepository unitTypes;
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired AbsenceRepository absences;
  @Autowired WorkEntryRepository workEntries;
  @Autowired TimeEntryDetailsRepository timeEntryDetails;
  @Autowired UnitEntryItemRepository unitEntryItems;
  @Autowired SalaryCalculationService salaryCalculationService;
  @Autowired EntityManagerFactory entityManagerFactory;
  @Autowired Clock clock;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    unitEntryItems.deleteAll();
    timeEntryDetails.deleteAll();
    workEntries.deleteAll();
    absences.deleteAll();
    unitTypes.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    users.deleteAll();
  }

  @Test
  void timeBasedEntrySupportsBreaksOvernightAndExactPersistence() throws Exception {
    UserAccount user = createVerifiedUser("time@example.com");
    WorkType workType = createWorkType(user, "Housekeeping", CalculationMethod.TIME_BASED);
    workType.changeDefaultBreakMinutes(30);
    workTypes.saveAndFlush(workType);
    createRate(user, "15.50", "EUR", LocalDate.of(2026, 1, 1), null);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-10",
                      "startTime":"08:00:00",
                      "endTime":"16:00:00",
                      "notes":"Morning shift"
                    }
                    """
                        .formatted(workType.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.calculationMethod").value("TIME_BASED"))
        .andExpect(jsonPath("$.data.timeEntry.workedMinutes").value(450));

    WorkEntry firstEntry = workEntries.findAll().getFirst();
    TimeEntryDetails firstDetails = timeEntryDetails.findByWorkEntryId(firstEntry.getId()).orElseThrow();
    assertThat(firstEntry.getCalculatedMinutes()).isEqualByComparingTo("450.000000000000000");
    assertThat(firstEntry.getGrossAmount()).isEqualByComparingTo("116.250000000000000");
    assertThat(firstDetails.getBreakMinutes()).isEqualTo(30);
    assertThat(firstDetails.getTotalIntervalMinutes()).isEqualTo(480);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-11",
                      "startTime":"22:00:00",
                      "endTime":"06:00:00",
                      "unpaidBreakMinutes":15
                    }
                    """
                        .formatted(workType.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.timeEntry.totalIntervalMinutes").value(480))
        .andExpect(jsonPath("$.data.timeEntry.workedMinutes").value(465));

    WorkEntry overnightEntry =
        workEntries.findAll().stream()
            .filter(entry -> entry.getWorkDate().equals(LocalDate.of(2026, 7, 11)))
            .findFirst()
            .orElseThrow();
    assertThat(overnightEntry.getCalculatedMinutes()).isEqualByComparingTo("465.000000000000000");
    assertThat(overnightEntry.getGrossAmount()).isEqualByComparingTo("120.125000000000000");
  }

  @Test
  void extraPayPercentageIncreasesGrossWithoutChangingWorkedMinutes() throws Exception {
    UserAccount user = createVerifiedUser("extra-pay@example.com");
    WorkType workType = createWorkType(user, "Sunday", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-12",
                      "startTime":"08:00:00",
                      "endTime":"16:00:00",
                      "unpaidBreakMinutes":0,
                      "extraPayPercentage":100
                    }
                    """
                        .formatted(workType.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.calculatedMinutes").value(480.000000000000000))
        .andExpect(jsonPath("$.data.extraPayPercentage").value(100))
        .andExpect(jsonPath("$.data.grossAmount").value(320.000000000000000));

    WorkEntry entry = workEntries.findAll().getFirst();
    assertThat(entry.getCalculatedMinutes()).isEqualByComparingTo("480.000000000000000");
    assertThat(entry.getGrossAmount()).isEqualByComparingTo("320.000000000000000");
    assertThat(entry.getExtraPayPercentage()).isEqualTo(100);
  }

  @Test
  void unitBasedEntryPreservesPrecisionAndUsesHistoricalRate() throws Exception {
    UserAccount user = createVerifiedUser("unit@example.com");
    WorkType workType = createWorkType(user, "Rooms", CalculationMethod.UNIT_BASED);
    UnitType standardRoom = createUnitType(workType, "Standard Room", "2.5000");
    UnitType suite = createUnitType(workType, "Suite", "1.3333");
    createRate(user, "15.50", "EUR", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 4, 30));
    createRate(user, "17.50", "EUR", LocalDate.of(2026, 5, 1), null);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-02-10",
                      "unitItems":[
                        {"unitTypeId":"%s","quantity":3},
                        {"unitTypeId":"%s","quantity":2.25}
                      ]
                    }
                    """
                        .formatted(workType.getId(), standardRoom.getId(), suite.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.calculationMethod").value("UNIT_BASED"))
        .andExpect(jsonPath("$.data.unitItems.length()").value(2));

    WorkEntry entry = workEntries.findAll().getFirst();
    BigDecimal expectedMinutes =
        UnitEntryItem.calculateMinutes(new BigDecimal("3"), new BigDecimal("2.5000"))
            .add(UnitEntryItem.calculateMinutes(new BigDecimal("2.25"), new BigDecimal("1.3333")));
    BigDecimal expectedGross = WorkEntry.calculateGross(expectedMinutes, new BigDecimal("15.50"));
    assertThat(entry.getHourlyRateSnapshot()).isEqualByComparingTo("15.50");
    assertThat(entry.getCalculatedMinutes()).isEqualByComparingTo(expectedMinutes);
    assertThat(entry.getGrossAmount()).isEqualByComparingTo(expectedGross);
    assertThat(unitEntryItems.findAllByWorkEntryId(entry.getId())).hasSize(2);

    var historicalRate = salaryCalculationService.resolveHistoricalRate(user.getId(), LocalDate.of(2026, 2, 10));
    var currentRate = salaryCalculationService.resolveCurrentRate(user.getId());
    assertThat(historicalRate.getHourlyRate()).isEqualByComparingTo("15.50");
    assertThat(currentRate.getHourlyRate()).isEqualByComparingTo("17.50");
  }

  @Test
  void perUnitEntryUsesDirectRateSnapshotsWithoutAddingWorkedTime() throws Exception {
    UserAccount user = createVerifiedUser("per-unit@example.com");
    WorkType workType =
        createWorkType(
            user, "Montaj pardoseala", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    UnitType squareMeter = createPerUnitType(workType, "Metru patrat", "m2", "50.0000", "EUR", null);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-15",
                      "unitItems":[
                        {"unitTypeId":"%s","quantity":300}
                      ]
                    }
                    """
                        .formatted(workType.getId(), squareMeter.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.calculationMethod").value("UNIT_BASED"))
        .andExpect(jsonPath("$.data.compensationMethod").value("PER_UNIT"))
        .andExpect(jsonPath("$.data.calculatedMinutes").value(0.000000000000000))
        .andExpect(jsonPath("$.data.workedHours").value(0.000000000000000))
        .andExpect(jsonPath("$.data.grossAmount").value(15000.000000000000000))
        .andExpect(jsonPath("$.data.unitItems[0].ratePerUnitSnapshot").value(50.0000))
        .andExpect(jsonPath("$.data.unitItems[0].grossAmountSnapshot").value(15000.000000000000000));

    WorkEntry firstEntry = workEntries.findAll().getFirst();
    assertThat(firstEntry.getCalculatedMinutes()).isEqualByComparingTo("0.000000000000000");
    assertThat(firstEntry.getGrossAmount()).isEqualByComparingTo("15000.000000000000000");

    squareMeter.changeRatePerUnit(new BigDecimal("60.0000"));
    unitTypes.saveAndFlush(squareMeter);

    WorkEntry persistedFirstEntry = workEntries.findById(firstEntry.getId()).orElseThrow();
    UnitEntryItem firstItem = unitEntryItems.findAllByWorkEntryId(firstEntry.getId()).getFirst();
    assertThat(persistedFirstEntry.getGrossAmount()).isEqualByComparingTo("15000.000000000000000");
    assertThat(firstItem.getRatePerUnitSnapshot()).isEqualByComparingTo("50.0000");
    assertThat(firstItem.getCurrencySnapshot()).isEqualTo("EUR");

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-16",
                      "unitItems":[
                        {"unitTypeId":"%s","quantity":10}
                      ]
                    }
                    """
                        .formatted(workType.getId(), squareMeter.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.grossAmount").value(600.000000000000000))
        .andExpect(jsonPath("$.data.unitItems[0].ratePerUnitSnapshot").value(60.0000));
  }

  @Test
  void perUnitEntrySupportsDecimalQuantitiesAndMultipleUnits() throws Exception {
    UserAccount user = createVerifiedUser("per-unit-multiple@example.com");
    WorkType workType =
        createWorkType(user, "Finish work", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    UnitType squareMeter = createPerUnitType(workType, "Square meter", "m2", "50.0000", "EUR", "25.0000");
    UnitType linearMeter = createPerUnitType(workType, "Linear meter", "ml", "10.0000", "EUR", null);
    UnitType task = createPerUnitType(workType, "Task", "task", "40.0000", "EUR", null);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-17",
                      "unitItems":[
                        {"unitTypeId":"%s","quantity":100},
                        {"unitTypeId":"%s","quantity":20}
                      ]
                    }
                    """
                        .formatted(workType.getId(), squareMeter.getId(), linearMeter.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.grossAmount").value(5200.000000000000000))
        .andExpect(jsonPath("$.data.calculatedMinutes").value(0.000000000000000))
        .andExpect(jsonPath("$.data.unitItems[0].grossAmountSnapshot").value(5000.000000000000000))
        .andExpect(jsonPath("$.data.unitItems[1].grossAmountSnapshot").value(200.000000000000000));

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-18",
                      "unitItems":[
                        {"unitTypeId":"%s","quantity":12.5}
                      ]
                    }
                    """
                        .formatted(workType.getId(), task.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.grossAmount").value(500.000000000000000))
        .andExpect(jsonPath("$.data.unitItems[0].ratePerUnitSnapshot").value(40.0000))
        .andExpect(jsonPath("$.data.unitItems[0].grossAmountSnapshot").value(500.000000000000000));
  }

  @Test
  void listFiltersAndPaginationWorkForAuthenticatedUser() throws Exception {
    UserAccount user = createVerifiedUser("filter@example.com");
    WorkType daytime = createWorkType(user, "Daytime", CalculationMethod.TIME_BASED);
    WorkType nighttime = createWorkType(user, "Nighttime", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(user, daytime, LocalDate.of(2026, 7, 1), "08:00:00", "10:00:00", 0);
    createTimeEntry(user, daytime, LocalDate.of(2026, 7, 2), "08:00:00", "10:00:00", 0);
    createTimeEntry(user, nighttime, LocalDate.of(2026, 8, 2), "20:00:00", "22:00:00", 0);

    mockMvc
        .perform(
            get("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("year", "2026")
                .param("month", "7")
                .param("workTypeId", daytime.getId().toString())
                .param("size", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalElements").value(2))
        .andExpect(jsonPath("$.data.page").value(0))
        .andExpect(jsonPath("$.data.size").value(1))
        .andExpect(jsonPath("$.data.content.length()").value(1))
        .andExpect(jsonPath("$.data.content[0].workTypeId").value(daytime.getId().toString()));
  }

  @Test
  void dayAndRecentEndpointsReturnExactDayAndGlobalLatestEntries() throws Exception {
    UserAccount user = createVerifiedUser("day-recent@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(user, workType, LocalDate.of(2026, 7, 12), "08:00:00", "10:00:00", 0);
    createTimeEntry(user, workType, LocalDate.of(2026, 7, 13), "08:00:00", "11:00:00", 0);
    createTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "08:00:00", "12:00:00", 0);

    mockMvc
        .perform(
            get("/api/work-entries/day")
                .param("date", "2026-07-13")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].workDate").value("2026-07-13"))
        .andExpect(jsonPath("$.data[0].timeEntry.workedMinutes").value(180));

    mockMvc
        .perform(
            get("/api/work-entries/recent")
                .param("limit", "2")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(2))
        .andExpect(jsonPath("$.data[0].workDate").value("2026-07-14"))
        .andExpect(jsonPath("$.data[1].workDate").value("2026-07-13"));
  }

  @Test
  void paginationValidationRejectsOversizedPageRequests() throws Exception {
    UserAccount user = createVerifiedUser("page@example.com");

    mockMvc
        .perform(
            get("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("size", "101"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0]").value("list.size: must be less than or equal to 100"));
  }

  @Test
  void authenticatedCrudFlowSupportsGetUpdateAndDelete() throws Exception {
    UserAccount user = createVerifiedUser("crud@example.com");
    WorkType workType = createWorkType(user, "CRUD Work", CalculationMethod.TIME_BASED);
    createRate(user, "21.00", "EUR", LocalDate.of(2026, 1, 1), null);

    String createBody =
        mockMvc
            .perform(
                post("/api/work-entries")
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "workTypeId":"%s",
                          "workDate":"2026-07-21",
                          "startTime":"08:00:00",
                          "endTime":"12:00:00",
                          "unpaidBreakMinutes":0
                        }
                        """
                            .formatted(workType.getId())))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    String entryId = extractJsonValue(createBody, "id");

    mockMvc
        .perform(get("/api/work-entries/" + entryId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.timeEntry.workedMinutes").value(240));

    mockMvc
        .perform(
            put("/api/work-entries/" + entryId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-21",
                      "startTime":"09:00:00",
                      "endTime":"14:30:00",
                      "unpaidBreakMinutes":30,
                      "notes":"Updated"
                    }
                    """
                        .formatted(workType.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.notes").value("Updated"))
        .andExpect(jsonPath("$.data.timeEntry.workedMinutes").value(300));

    mockMvc
        .perform(delete("/api/work-entries/" + entryId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workEntries.findAll()).isEmpty();
  }

  @Test
  void timeOverlapValidationRejectsOverlappingIntervalsAndAllowsAdjacentOnes() throws Exception {
    UserAccount user = createVerifiedUser("overlap@example.com");
    WorkType workType = createWorkType(user, "Regular Shift", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "09:00:00", "17:00:00", 30);

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "14:00:00", "19:00:00", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORK_ENTRY_TIME_OVERLAP"))
        .andExpect(jsonPath("$.message").value("This work entry overlaps an existing activity from 09:00 to 17:00."));

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "10:00:00", "12:00:00", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORK_ENTRY_TIME_OVERLAP"));

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "08:00:00", "18:00:00", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORK_ENTRY_TIME_OVERLAP"));

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "17:00:00", "20:00:00", 0)
        .andExpect(status().isCreated());

    assertThat(workEntries.findAll()).hasSize(2);
  }

  @Test
  void concurrentOverlappingCreatesSerializePerUserAndOnlyOneSucceeds() throws Exception {
    UserAccount user = createVerifiedUser("overlap-concurrent@example.com");
    WorkType workType = createWorkType(user, "Regular Shift", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    var executor = Executors.newFixedThreadPool(2);

    Callable<Integer> request =
        () -> {
          ready.countDown();
          start.await(5, TimeUnit.SECONDS);
          return postTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "09:00:00", "17:00:00", 0)
              .andReturn()
              .getResponse()
              .getStatus();
        };

    try {
      var first = executor.submit(request);
      var second = executor.submit(request);
      assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();

      List<Integer> statuses = List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
      assertThat(statuses).contains(201, 409);
      assertThat(workEntries.findAll()).hasSize(1);
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void timeOverlapValidationUsesActualDateTimeIntervalsAcrossMidnight() throws Exception {
    UserAccount user = createVerifiedUser("overnight-overlap@example.com");
    WorkType workType = createWorkType(user, "Night Shift", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "22:00:00", "06:00:00", 0);

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 15), "05:00:00", "08:00:00", 0)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORK_ENTRY_TIME_OVERLAP"));

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 13), "23:00:00", "23:30:00", 0)
        .andExpect(status().isCreated());

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 15), "06:00:00", "08:00:00", 0)
        .andExpect(status().isCreated());
  }

  @Test
  void sameTimesOnDifferentDatesAndDifferentUsersAreAllowed() throws Exception {
    UserAccount user = createVerifiedUser("same-times@example.com");
    UserAccount other = createVerifiedUser("same-times-other@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    WorkType otherWorkType = createWorkType(other, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createRate(other, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "09:00:00", "17:00:00", 0);

    postTimeEntry(user, workType, LocalDate.of(2026, 7, 16), "09:00:00", "17:00:00", 0)
        .andExpect(status().isCreated());
    postTimeEntry(other, otherWorkType, LocalDate.of(2026, 7, 14), "09:00:00", "17:00:00", 0)
        .andExpect(status().isCreated());
  }

  @Test
  void updateExcludesCurrentEntryButRejectsOverlapWithAnotherEntry() throws Exception {
    UserAccount user = createVerifiedUser("update-overlap@example.com");
    WorkType workType = createWorkType(user, "Update Shift", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    String firstBody =
        postTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "08:00:00", "12:00:00", 0)
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String firstId = extractJsonValue(firstBody, "id");
    createTimeEntry(user, workType, LocalDate.of(2026, 7, 14), "13:00:00", "15:00:00", 0);

    mockMvc
        .perform(
            put("/api/work-entries/" + firstId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-14",
                      "startTime":"08:00:00",
                      "endTime":"12:00:00",
                      "unpaidBreakMinutes":0
                    }
                    """
                        .formatted(workType.getId())))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            put("/api/work-entries/" + firstId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-14",
                      "startTime":"14:00:00",
                      "endTime":"16:00:00",
                      "unpaidBreakMinutes":0
                    }
                    """
                        .formatted(workType.getId())))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORK_ENTRY_TIME_OVERLAP"));
  }

  @Test
  void unitBasedEntriesWithoutTimesDoNotParticipateInTimeOverlapValidation() throws Exception {
    UserAccount user = createVerifiedUser("unit-overlap-ignore@example.com");
    WorkType timeWork = createWorkType(user, "Time", CalculationMethod.TIME_BASED);
    WorkType unitWork = createWorkType(user, "Rooms", CalculationMethod.UNIT_BASED);
    UnitType room = createUnitType(unitWork, "Room", "2.0000");
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-14",
                      "unitItems":[{"unitTypeId":"%s","quantity":4}]
                    }
                    """
                        .formatted(unitWork.getId(), room.getId())))
        .andExpect(status().isCreated());

    postTimeEntry(user, timeWork, LocalDate.of(2026, 7, 14), "09:00:00", "17:00:00", 0)
        .andExpect(status().isCreated());
  }

  @Test
  void absenceConflictsAndInvalidRequestsAreRejected() throws Exception {
    UserAccount user = createVerifiedUser("validation@example.com");
    WorkType timeWork = createWorkType(user, "Validation Time", CalculationMethod.TIME_BASED);
    WorkType unitWork = createWorkType(user, "Validation Unit", CalculationMethod.UNIT_BASED);
    createRate(user, "18.00", "EUR", LocalDate.of(2026, 1, 1), null);
    absences.saveAndFlush(
        new Absence(user, AbsenceType.VACATION, LocalDate.of(2026, 7, 15), LocalDate.of(2026, 7, 15)));

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-15",
                      "startTime":"08:00:00",
                      "endTime":"16:00:00"
                    }
                    """
                        .formatted(timeWork.getId())))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-16"
                    }
                    """
                        .formatted(timeWork.getId())))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-16",
                      "startTime":"08:00:00",
                      "endTime":"10:00:00"
                    }
                    """
                        .formatted(unitWork.getId())))
        .andExpect(status().isBadRequest());
  }

  @Test
  void ownershipIsEnforcedForReadUpdateAndDelete() throws Exception {
    UserAccount owner = createVerifiedUser("owner@example.com");
    UserAccount otherUser = createVerifiedUser("other@example.com");
    WorkType ownerWorkType = createWorkType(owner, "Owner Work", CalculationMethod.TIME_BASED);
    createRate(owner, "19.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createRate(otherUser, "22.00", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(owner, ownerWorkType, LocalDate.of(2026, 7, 20), "08:00:00", "12:00:00", 0);
    WorkEntry ownerEntry = workEntries.findAll().getFirst();

    mockMvc
        .perform(get("/api/work-entries/" + ownerEntry.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser)))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(
            put("/api/work-entries/" + ownerEntry.getId())
                .header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"2026-07-20",
                      "startTime":"09:00:00",
                      "endTime":"11:00:00"
                    }
                    """
                        .formatted(ownerWorkType.getId())))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(delete("/api/work-entries/" + ownerEntry.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser)))
        .andExpect(status().isNotFound());
  }

  @Test
  void unauthorizedRequestsReturn401() throws Exception {
    mockMvc.perform(get("/api/work-entries")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/dashboard")).andExpect(status().isUnauthorized());
    mockMvc
        .perform(
            post("/api/work-entries")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"workTypeId\":\"00000000-0000-0000-0000-000000000000\",\"workDate\":\"2026-07-10\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void dashboardReturnsCurrentMonthSummary() throws Exception {
    UserAccount user = createVerifiedUser("dashboard@example.com");
    WorkType workType = createWorkType(user, "Dashboard Work", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    YearMonth currentMonth = YearMonth.now(clock);
    LocalDate firstWorkDate = currentMonth.atDay(2);
    LocalDate secondWorkDate = currentMonth.atDay(3);
    LocalDate absenceDate = currentMonth.atDay(4);

    createTimeEntry(user, workType, firstWorkDate, "08:00:00", "12:00:00", 0);
    createTimeEntry(user, workType, secondWorkDate, "09:00:00", "11:30:00", 0);
    absences.saveAndFlush(new Absence(user, AbsenceType.SICK_LEAVE, absenceDate, absenceDate.plusDays(1)));

    mockMvc
        .perform(get("/api/dashboard").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentMonth").value(currentMonth.toString()))
        .andExpect(jsonPath("$.data.entriesCount").value(2))
        .andExpect(jsonPath("$.data.absenceDays").value(2))
        .andExpect(content().string(containsString("\"workedMinutes\":390.000000000000000")))
        .andExpect(content().string(containsString("\"workedHours\":6.500000000000000")))
        .andExpect(content().string(containsString("\"grossAmount\":130.000000000000000")));
  }

  @Test
  void workEntryListingAvoidsPerEntryNPlusOneQueries() throws Exception {
    UserAccount user = createVerifiedUser("querycount@example.com");
    WorkType workType = createWorkType(user, "Query Count Work", CalculationMethod.TIME_BASED);
    createRate(user, "18.50", "EUR", LocalDate.of(2026, 1, 1), null);

    createTimeEntry(user, workType, LocalDate.of(2026, 7, 1), "08:00:00", "10:00:00", 0);
    createTimeEntry(user, workType, LocalDate.of(2026, 7, 2), "08:00:00", "10:00:00", 0);
    createTimeEntry(user, workType, LocalDate.of(2026, 7, 3), "08:00:00", "10:00:00", 0);

    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();

    mockMvc
        .perform(get("/api/work-entries").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.content.length()").value(3));

    assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(4);
  }

  private void createTimeEntry(
      UserAccount user, WorkType workType, LocalDate workDate, String startTime, String endTime, int breakMinutes)
      throws Exception {
    postTimeEntry(user, workType, workDate, startTime, endTime, breakMinutes).andExpect(status().isCreated());
  }

  private org.springframework.test.web.servlet.ResultActions postTimeEntry(
      UserAccount user, WorkType workType, LocalDate workDate, String startTime, String endTime, int breakMinutes)
      throws Exception {
    return mockMvc.perform(
        post("/api/work-entries")
            .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                """
                {
                  "workTypeId":"%s",
                  "workDate":"%s",
                  "startTime":"%s",
                  "endTime":"%s",
                  "unpaidBreakMinutes":%d
                }
                """
                    .formatted(workType.getId(), workDate, startTime, endTime, breakMinutes)));
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private WorkType createWorkType(UserAccount user, String name, CalculationMethod calculationMethod) {
    return createWorkType(user, name, calculationMethod, CompensationMethod.HOURLY);
  }

  private WorkType createWorkType(
      UserAccount user, String name, CalculationMethod calculationMethod, CompensationMethod compensationMethod) {
    WorkType workType = new WorkType(user, name, calculationMethod);
    workType.changeCompensationMethod(compensationMethod);
    workType.changeColor("#87C95A");
    return workTypes.saveAndFlush(workType);
  }

  private UnitType createUnitType(WorkType workType, String name, String unitsPerHour) {
    return unitTypes.saveAndFlush(new UnitType(workType, name, new BigDecimal(unitsPerHour)));
  }

  private UnitType createPerUnitType(
      WorkType workType, String name, String symbol, String ratePerUnit, String currency, String unitsPerHour) {
    UnitType unitType =
        new UnitType(workType, name, unitsPerHour == null ? null : new BigDecimal(unitsPerHour));
    unitType.changeSymbol(symbol);
    unitType.changeRatePerUnit(new BigDecimal(ratePerUnit));
    unitType.changeCurrency(currency);
    return unitTypes.saveAndFlush(unitType);
  }

  private HourlyRatePeriod createRate(
      UserAccount user, String rate, String currency, LocalDate validFrom, LocalDate validTo) {
    return hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, new BigDecimal(rate), currency, validFrom, validTo));
  }

  private String bearerToken(UserAccount user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private String extractJsonValue(String body, String field) {
    String marker = "\"%s\":\"".formatted(field);
    int start = body.indexOf(marker);
    if (start < 0) {
      return "";
    }
    int valueStart = start + marker.length();
    int valueEnd = body.indexOf('"', valueStart);
    return body.substring(valueStart, valueEnd);
  }
}
