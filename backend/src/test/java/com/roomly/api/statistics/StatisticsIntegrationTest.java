package com.roomly.api.statistics;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.roomly.api.auth.security.JwtService;
import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.entity.AbsenceType;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.workentry.repository.TimeEntryDetailsRepository;
import com.roomly.api.workentry.repository.UnitEntryItemRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.UnitTypeRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class StatisticsIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired UnitTypeRepository unitTypes;
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired WorkEntryRepository workEntries;
  @Autowired TimeEntryDetailsRepository timeEntryDetails;
  @Autowired UnitEntryItemRepository unitEntryItems;
  @Autowired AbsenceRepository absences;

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
  void overviewReturnsTotalsAndPreviousPeriodComparison() throws Exception {
    UserAccount user = createVerifiedUser("statistics-overview@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 1), "08:00:00", "12:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 7, 2), "08:00:00", "10:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 6, 30), "08:00:00", "11:00:00");

    mockMvc
        .perform(
            get("/api/statistics/overview")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-02"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.grossByCurrency.length()").value(1))
        .andExpect(jsonPath("$.data.grossByCurrency[0].currency").value("EUR"))
        .andExpect(jsonPath("$.data.workedDays").value(2))
        .andExpect(jsonPath("$.data.entries").value(2))
        .andExpect(content().string(containsString("\"workedMinutes\":360.000000000000000")))
        .andExpect(content().string(containsString("\"amount\":120.000000000000000")))
        .andExpect(content().string(containsString("\"averageMinutesPerDay\":180.000000000000000")))
        .andExpect(jsonPath("$.data.comparison.available").value(true))
        .andExpect(jsonPath("$.data.comparison.direction").value("UP"))
        .andExpect(jsonPath("$.data.comparison.percentage").value(100.00));
  }

  @Test
  void filtersTimeseriesAndWorkTypeBreakdownUseBackendAggregations() throws Exception {
    UserAccount user = createVerifiedUser("statistics-filter@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    WorkType rooms = createWorkType(user, "Rooms", CalculationMethod.UNIT_BASED);
    UnitType normalRoom = createUnitType(rooms, "Normal room", "2.0000");
    createRate(user, "30.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 3), "08:00:00", "10:00:00");
    createUnitEntry(user, rooms, normalRoom, LocalDate.of(2026, 7, 3), "4");
    createTimeEntry(user, check, LocalDate.of(2026, 7, 4), "08:00:00", "09:00:00");

    mockMvc
        .perform(
            get("/api/statistics/timeseries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-31")
                .param("calculationMethods", "UNIT_BASED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.granularity").value("DAILY"))
        .andExpect(jsonPath("$.data.metric").value("GROSS"))
        .andExpect(jsonPath("$.data.points.length()").value(31))
        .andExpect(jsonPath("$.data.points[0].bucketStart").value("2026-07-01"))
        .andExpect(jsonPath("$.data.points[0].value").value(0))
        .andExpect(jsonPath("$.data.points[2].bucketStart").value("2026-07-03"))
        .andExpect(jsonPath("$.data.points[2].currency").value("EUR"))
        .andExpect(content().string(containsString("\"value\":60.000000000000000")));

    mockMvc
        .perform(
            get("/api/statistics/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-31"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("Check"))
        .andExpect(jsonPath("$.data[0].calculationMethod").value("TIME_BASED"))
        .andExpect(jsonPath("$.data[0].entries").value(2))
        .andExpect(jsonPath("$.data[0].percentageBasis").value("MINUTES"))
        .andExpect(jsonPath("$.data[1].name").value("Rooms"))
        .andExpect(jsonPath("$.data[1].percentage").value(40.00));

    mockMvc
        .perform(
            get("/api/statistics/overview")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-31")
                .param("workTypeIds", rooms.getId().toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.entries").value(1))
        .andExpect(content().string(containsString("\"workedMinutes\":120.000000000000000")));
  }

  @Test
  void overviewPreservesMultipleCurrenciesAndDoesNotReturnFakeMixedGross() throws Exception {
    UserAccount user = createVerifiedUser("statistics-currency@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 7, 2));
    createRate(user, "25.00", "CHF", LocalDate.of(2026, 7, 3), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 1), "08:00:00", "13:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 7, 3), "08:00:00", "12:00:00");

    mockMvc
        .perform(
            get("/api/statistics/overview")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-03"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.grossByCurrency.length()").value(2))
        .andExpect(jsonPath("$.data.grossByCurrency[0].currency").value("EUR"))
        .andExpect(jsonPath("$.data.grossByCurrency[0].amount").value(100.00))
        .andExpect(jsonPath("$.data.grossByCurrency[1].currency").value("CHF"))
        .andExpect(jsonPath("$.data.grossByCurrency[1].amount").value(100.00))
        .andExpect(jsonPath("$.data.grossAmount").doesNotExist())
        .andExpect(jsonPath("$.data.currency").doesNotExist())
        .andExpect(jsonPath("$.data.comparison.available").value(false))
        .andExpect(jsonPath("$.data.comparison.direction").value("NEW"));
  }

  @Test
  void timeseriesSupportsMetricsAndGranularityWithoutMissingBuckets() throws Exception {
    UserAccount user = createVerifiedUser("statistics-series@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 1), "08:00:00", "10:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 7, 5), "08:00:00", "11:00:00");

    mockMvc
        .perform(
            get("/api/statistics/timeseries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-05")
                .param("metric", "WORKED_MINUTES"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.granularity").value("DAILY"))
        .andExpect(jsonPath("$.data.metric").value("WORKED_MINUTES"))
        .andExpect(jsonPath("$.data.points.length()").value(5))
        .andExpect(jsonPath("$.data.points[1].bucketStart").value("2026-07-02"))
        .andExpect(jsonPath("$.data.points[1].value").value(0))
        .andExpect(jsonPath("$.data.points[4].value").value(180.00));

    mockMvc
        .perform(
            get("/api/statistics/timeseries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-01-01")
                .param("to", "2026-04-30")
                .param("metric", "ENTRIES"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.granularity").value("WEEKLY"));

    mockMvc
        .perform(
            get("/api/statistics/timeseries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2025-01-01")
                .param("to", "2026-12-31")
                .param("metric", "WORKED_DAYS"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.granularity").value("MONTHLY"));
  }

  @Test
  void previousPeriodWithNoDataIsExplicitlyUnavailable() throws Exception {
    UserAccount user = createVerifiedUser("statistics-new@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 10), "08:00:00", "10:00:00");

    mockMvc
        .perform(
            get("/api/statistics/overview")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-10")
                .param("to", "2026-07-10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.comparison.available").value(false))
        .andExpect(jsonPath("$.data.comparison.percentage").doesNotExist())
        .andExpect(jsonPath("$.data.comparison.direction").value("NEW"));
  }

  @Test
  void invalidDateRangeReturnsStableStatisticsError() throws Exception {
    UserAccount user = createVerifiedUser("statistics-invalid@example.com");

    mockMvc
        .perform(
            get("/api/statistics/overview")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-10")
                .param("to", "2026-07-09"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("STATISTICS_INVALID_DATE_RANGE"));

    mockMvc
        .perform(
            get("/api/statistics/timeseries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("to", "2026-07-09"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("STATISTICS_INVALID_DATE_RANGE"));
  }

  @Test
  void comparisonSupportsPeriodTotalsSeriesAndMultiCurrencyDifferences() throws Exception {
    UserAccount user = createVerifiedUser("statistics-comparison@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 7, 2));
    createRate(user, "25.00", "CHF", LocalDate.of(2026, 7, 3), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 1), "08:00:00", "12:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 7, 3), "08:00:00", "12:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 6, 1), "08:00:00", "10:00:00");

    mockMvc
        .perform(
            post("/api/statistics/comparison")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "periodA":{"from":"2026-07-01","to":"2026-07-07"},
                      "periodB":{"from":"2026-06-01","to":"2026-06-07"},
                      "metric":"GROSS",
                      "workTypeIds":[],
                      "calculationMethods":[]
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.metric").value("GROSS"))
        .andExpect(jsonPath("$.data.periodA.entries").value(2))
        .andExpect(jsonPath("$.data.differences.length()").value(2))
        .andExpect(jsonPath("$.data.differences[0].currency").value("CHF"))
        .andExpect(jsonPath("$.data.differences[0].direction").value("NEW"))
        .andExpect(jsonPath("$.data.differences[1].currency").value("EUR"))
        .andExpect(jsonPath("$.data.series.alignment").value("DAY_OF_WEEK"))
        .andExpect(jsonPath("$.data.series.granularity").value("DAILY"))
        .andExpect(jsonPath("$.data.series.points.length()").value(14));
  }

  @Test
  void heatmapReturnsEveryDateAndAbsenceMetadata() throws Exception {
    UserAccount user = createVerifiedUser("statistics-heatmap@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 2), "08:00:00", "12:00:00");
    absences.saveAndFlush(new Absence(user, AbsenceType.VACATION, LocalDate.of(2026, 7, 3), LocalDate.of(2026, 7, 3)));

    mockMvc
        .perform(
            get("/api/statistics/heatmap")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-03")
                .param("metric", "WORKED_MINUTES"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.metric").value("WORKED_MINUTES"))
        .andExpect(jsonPath("$.data.days.length()").value(3))
        .andExpect(jsonPath("$.data.days[0].value").value(0))
        .andExpect(jsonPath("$.data.days[1].value").value(240.00))
        .andExpect(jsonPath("$.data.days[1].entries").value(1))
        .andExpect(jsonPath("$.data.days[2].hasAbsence").value(true));
  }

  @Test
  void heatmapRejectsTooLargeRangeAndAmbiguousGrossCurrency() throws Exception {
    UserAccount user = createVerifiedUser("statistics-heatmap-errors@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 7, 2));
    createRate(user, "25.00", "CHF", LocalDate.of(2026, 7, 3), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 1), "08:00:00", "12:00:00");
    createTimeEntry(user, check, LocalDate.of(2026, 7, 3), "08:00:00", "12:00:00");

    mockMvc
        .perform(
            get("/api/statistics/heatmap")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2025-01-01")
                .param("to", "2026-12-31"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("STATISTICS_HEATMAP_RANGE_TOO_LARGE"));

    mockMvc
        .perform(
            get("/api/statistics/heatmap")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-03")
                .param("metric", "GROSS"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("STATISTICS_GROSS_REQUIRES_CURRENCY_SELECTION"));
  }

  @Test
  void drilldownReturnsBucketTotalsAndWorkTypeBreakdown() throws Exception {
    UserAccount user = createVerifiedUser("statistics-drilldown@example.com");
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED);
    createRate(user, "20.00", "EUR", LocalDate.of(2026, 1, 1), null);
    createTimeEntry(user, check, LocalDate.of(2026, 7, 1), "08:00:00", "12:00:00");

    mockMvc
        .perform(
            get("/api/statistics/drilldown")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("from", "2026-07-01")
                .param("to", "2026-07-07"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totals.entries").value(1))
        .andExpect(jsonPath("$.data.workTypes[0].name").value("Check"))
        .andExpect(jsonPath("$.data.workTypes[0].percentageBasis").value("MINUTES"));
  }

  private void createTimeEntry(UserAccount user, WorkType workType, LocalDate workDate, String startTime, String endTime)
      throws Exception {
    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"%s",
                      "startTime":"%s",
                      "endTime":"%s"
                    }
                    """
                        .formatted(workType.getId(), workDate, startTime, endTime)))
        .andExpect(status().isCreated());
  }

  private void createUnitEntry(UserAccount user, WorkType workType, UnitType unitType, LocalDate workDate, String quantity)
      throws Exception {
    mockMvc
        .perform(
            post("/api/work-entries")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workTypeId":"%s",
                      "workDate":"%s",
                      "unitItems":[{"unitTypeId":"%s","quantity":%s}]
                    }
                    """
                        .formatted(workType.getId(), workDate, unitType.getId(), quantity)))
        .andExpect(status().isCreated());
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private WorkType createWorkType(UserAccount user, String name, CalculationMethod calculationMethod) {
    return workTypes.saveAndFlush(new WorkType(user, name, calculationMethod));
  }

  private UnitType createUnitType(WorkType workType, String name, String unitsPerHour) {
    return unitTypes.saveAndFlush(new UnitType(workType, name, new BigDecimal(unitsPerHour)));
  }

  private HourlyRatePeriod createRate(
      UserAccount user, String rate, String currency, LocalDate validFrom, LocalDate validTo) {
    return hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, new BigDecimal(rate), currency, validFrom, validTo));
  }

  private String bearerToken(UserAccount user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }
}
