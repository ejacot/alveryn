package com.alveryn.api.workrecord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.address.entity.Address;
import com.alveryn.api.address.repository.AddressRepository;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserProfileRepository;
import com.alveryn.api.user.repository.UserPreferencesRepository;
import com.alveryn.api.workrecord.line.entity.WorkLineCalculationMode;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
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
class WorkRecordIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired UserProfileRepository profiles;
  @Autowired UserPreferencesRepository preferences;
  @Autowired WorkTypeRepository workTypes;
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired WorkRecordRepository workRecords;
  @Autowired WorkRecordLineRepository workRecordLines;
  @Autowired AddressRepository addresses;
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
    profiles.deleteAll();
    addresses.deleteAll();
    preferences.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    users.deleteAll();
  }

  @Test
  void createsWorkRecordLinesFromWorkTypes() throws Exception {
    UserAccount user = createVerifiedUser("phase2-record@example.com");
    WorkType montage =
        createWorkType(user, "Montaj pardoseala", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    WorkType check = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType squareMeters =
        createChildWorkType(
            montage,
            "2 Lagen",
            WorkLineCalculationMode.UNITS_PER_UNIT,
            "Metru patrat",
            "m2",
            null,
            "50.0000",
            "EUR");
    WorkType checkHours =
        createChildWorkType(check, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");

    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-16",
                      "teamSize":2,
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "quantity":300
                        },
                        {
                          "workTypeId":"%s",
                          "startTime":"08:00:00",
                          "endTime":"16:00:00",
                          "unpaidBreakMinutes":0
                        }
                      ]
                    }
                    """
                        .formatted(squareMeters.getId(), checkHours.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.workLines.length()").value(2))
        .andExpect(jsonPath("$.data.workLines[0].configurationName").value("2 Lagen"))
        .andExpect(jsonPath("$.data.workLines[0].quantity").value(300.0000))
        .andExpect(jsonPath("$.data.workLines[0].grossAmount").value(15000.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].calculatedMinutes").value(0.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].calculatedMinutes").value(480.000000000000000))
        .andExpect(jsonPath("$.data.grossAmount").value(15160.000000000000000));

    assertThat(workRecords.findAll()).hasSize(1);
    assertThat(workRecordLines.findAll()).hasSize(2);
    var savedRecord = workRecords.findAll().getFirst();
    assertThat(savedRecord.getWorkDate()).isEqualTo(LocalDate.of(2026, 7, 16));
  }

  @Test
  void createsMultiDayProjectAndRejectsReversedDateRange() throws Exception {
    UserAccount user = createVerifiedUser("date-range-record@example.com");
    WorkType workType = createWorkType(user, "Project work", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    createRate(user, "20.00", "EUR");

    mockMvc.perform(post("/api/work-records")
            .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "workDate":"2026-07-16",
                  "workEndDate":"2026-07-20",
                  "lines":[{"workTypeId":"%s","durationMinutes":480}]
                }
                """.formatted(workType.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.workDate").value("2026-07-16"))
        .andExpect(jsonPath("$.data.workEndDate").value("2026-07-20"));

    assertThat(workRecords.findAll().getFirst().getWorkEndDate()).isEqualTo(LocalDate.of(2026, 7, 20));

    mockMvc.perform(post("/api/work-records")
            .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "workDate":"2026-07-20",
                  "workEndDate":"2026-07-16",
                  "lines":[{"workTypeId":"%s","durationMinutes":480}]
                }
                """.formatted(workType.getId())))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createsMixedRecordWithFixedAmountTimeAndPerUnitLines() throws Exception {
    UserAccount user = createVerifiedUser("fixed-mixed-record@example.com");
    WorkType roofRepair =
        createWorkType(user, "Reparare acoperis", CalculationMethod.FIXED_PRICE_BASED, CompensationMethod.HOURLY);
    WorkType cleaning = createWorkType(user, "Curatare", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType paving =
        createWorkType(user, "Spalare pavaj", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    paving.configureUnit("Metru patrat", "m2");
    paving.configureFormula(null, new BigDecimal("10.0000"), "EUR");
    workTypes.saveAndFlush(paving);
    createRate(user, "20.00", "EUR");

    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-18",
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "fixedAmount":500,
                          "currency":"EUR"
                        },
                        {
                          "workTypeId":"%s",
                          "durationMinutes":120
                        },
                        {
                          "workTypeId":"%s",
                          "quantity":30
                        }
                      ]
                    }
                    """
                        .formatted(roofRepair.getId(), cleaning.getId(), paving.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.workLines.length()").value(3))
        .andExpect(jsonPath("$.data.workLines[0].calculationMode").value("FIXED_AMOUNT"))
        .andExpect(jsonPath("$.data.workLines[0].fixedAmountSnapshot").value(500.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].calculatedMinutes").value(0.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].grossAmount").value(500.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].calculationMode").value("TIME_HOURLY"))
        .andExpect(jsonPath("$.data.workLines[1].grossAmount").value(40.000000000000000))
        .andExpect(jsonPath("$.data.workLines[2].calculationMode").value("UNITS_PER_UNIT"))
        .andExpect(jsonPath("$.data.workLines[2].grossAmount").value(300.000000000000000))
        .andExpect(jsonPath("$.data.calculatedMinutes").value(120.000000000000000))
        .andExpect(jsonPath("$.data.grossAmount").value(840.000000000000000));
  }

  @Test
  void dividesDirectPerUnitPayByTeamSizeWhenWorkTypeUsesTeamwork() throws Exception {
    UserAccount user = createVerifiedUser("teamwork-unit-record@example.com");
    WorkType montage =
        createWorkType(user, "Montaj pardoseala", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    montage.changeTeamworkEnabled(true);
    workTypes.saveAndFlush(montage);
    WorkType squareMeters =
        createChildWorkType(
            montage,
            "2 Lagen",
            WorkLineCalculationMode.UNITS_PER_UNIT,
            "Metru patrat",
            "m2",
            null,
            "50.0000",
            "EUR");

    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-16",
                      "teamSize":3,
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "quantity":300
                        }
                      ]
                    }
                    """
                        .formatted(squareMeters.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.teamSize").value(3))
        .andExpect(jsonPath("$.data.workLines[0].grossAmount").value(5000.000000000000000))
        .andExpect(jsonPath("$.data.grossAmount").value(5000.000000000000000));
  }

  @Test
  void createsTimeBasedWorkRecordLineFromDirectDurationWithoutStartEndTimes() throws Exception {
    UserAccount user = createVerifiedUser("duration-record@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType child =
        createChildWorkType(workType, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");

    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-16",
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "durationMinutes":360
                        }
                      ]
                    }
                    """
                        .formatted(child.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.workLines[0].startTime").doesNotExist())
        .andExpect(jsonPath("$.data.workLines[0].endTime").doesNotExist())
        .andExpect(jsonPath("$.data.workLines[0].durationMinutes").value(360))
        .andExpect(jsonPath("$.data.workLines[0].calculatedMinutes").value(360.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].grossAmount").value(120.000000000000000));
  }

  @Test
  void updatesGroupedWorkRecordAndReplacesLinesTransactionally() throws Exception {
    UserAccount user = createVerifiedUser("update-record@example.com");
    WorkType timeType = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType perUnitWorkType = createWorkType(user, "2 Lagen", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    WorkType squareMeter =
        createChildWorkType(
            perUnitWorkType,
            "Metru patrat",
            WorkLineCalculationMode.UNITS_PER_UNIT,
            "Metru patrat",
            "m2",
            null,
            "50.0000",
            "EUR");
    WorkType checkHours =
        createChildWorkType(timeType, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");

    String recordId = createTimeRecord(user, checkHours, "2026-07-16");

    mockMvc
        .perform(
            put("/api/work-records/" + recordId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-17",
                      "teamSize":3,
                      "notes":"updated job",
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "quantity":10
                        },
                        {
                          "workTypeId":"%s",
                          "startTime":"09:00:00",
                          "endTime":"11:00:00",
                          "unpaidBreakMinutes":0
                        }
                      ]
                    }
                    """
                        .formatted(squareMeter.getId(), checkHours.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.workDate").value("2026-07-17"))
        .andExpect(jsonPath("$.data.teamSize").value(3))
        .andExpect(jsonPath("$.data.notes").value("updated job"))
        .andExpect(jsonPath("$.data.workLines.length()").value(2))
        .andExpect(jsonPath("$.data.grossAmount").value(540.000000000000000));

    assertThat(workRecords.findAll()).hasSize(1);
    assertThat(workRecordLines.findAll()).hasSize(2);
    assertThat(workRecords.findById(java.util.UUID.fromString(recordId)).orElseThrow().getWorkDate())
        .isEqualTo(LocalDate.of(2026, 7, 17));
  }

  @Test
  void deletesGroupedWorkRecordWithItsLines() throws Exception {
    UserAccount user = createVerifiedUser("delete-record@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType child =
        createChildWorkType(workType, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");

    String recordId = createTimeRecord(user, child, "2026-07-16");

    mockMvc
        .perform(delete("/api/work-records/" + recordId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workRecords.findAll()).isEmpty();
    assertThat(workRecordLines.findAll()).isEmpty();
  }

  @Test
  void deletingWorkTypeUsedByWorkRecordLineKeepsItAsInactiveHistory() throws Exception {
    UserAccount user = createVerifiedUser("delete-used-work-type@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType child =
        createChildWorkType(workType, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");
    createTimeRecord(user, child, "2026-07-16");

    mockMvc
        .perform(delete("/api/work-types/" + child.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workTypes.findById(child.getId())).isPresent();
    assertThat(workTypes.findById(child.getId()).orElseThrow().isActive()).isFalse();
    assertThat(workRecordLines.findAll()).hasSize(1);
  }

  @Test
  void listsGroupedWorkRecordsForInclusiveRange() throws Exception {
    UserAccount user = createVerifiedUser("range-record@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType child =
        createChildWorkType(workType, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");
    createTimeRecord(user, child, "2026-07-14");
    createTimeRecord(user, child, "2026-07-16");
    createTimeRecord(user, child, "2026-07-21");

    mockMvc
        .perform(
            get("/api/work-records/range")
                .param("from", "2026-07-15")
                .param("to", "2026-07-20")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].workDate").value("2026-07-16"));
  }

  @Test
  void calendarActivityRangeUsesWorkRecordsWhenLegacyEntriesAreAbsent() throws Exception {
    UserAccount user = createVerifiedUser("calendar-range-record@example.com");
    workRecords.saveAndFlush(new com.alveryn.api.workrecord.entity.WorkRecord(
        user, null, LocalDate.of(2026, 7, 9), null, null));

    mockMvc
        .perform(get("/api/calendar/activity-range").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.firstActivityDate").value("2026-07-09"));
  }

  @Test
  void workRecordCanReferenceOwnedAddressAndRejectsForeignAddress() throws Exception {
    UserAccount user = createVerifiedUser("record-address@example.com");
    UserAccount otherUser = createVerifiedUser("record-address-other@example.com");
    WorkType workType = createWorkType(user, "Check", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType child =
        createChildWorkType(workType, "Ore check", WorkLineCalculationMode.TIME_HOURLY, null, null, null, null, null);
    createRate(user, "20.00", "EUR");
    Address ownedAddress =
        addresses.saveAndFlush(new Address(user, "Leopoldstrasse 120", "Etaj 2", "80802", "Munchen", "Bavaria", "DE"));
    Address foreignAddress =
        addresses.saveAndFlush(new Address(otherUser, "Other Street", null, "10115", "Berlin", null, "DE"));

    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-16",
                      "addressId":"%s",
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "startTime":"08:00:00",
                          "endTime":"16:00:00",
                          "unpaidBreakMinutes":0
                        }
                      ]
                    }
                    """
                        .formatted(ownedAddress.getId(), child.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.addressId").value(ownedAddress.getId().toString()))
        .andExpect(jsonPath("$.data.address.street").value("Leopoldstrasse 120"))
        .andExpect(jsonPath("$.data.address.street2").value("Etaj 2"))
        .andExpect(jsonPath("$.data.address.city").value("Munchen"))
        .andExpect(jsonPath("$.data.address.country").value("DE"));

    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"2026-07-17",
                      "addressId":"%s",
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "startTime":"08:00:00",
                          "endTime":"16:00:00",
                          "unpaidBreakMinutes":0
                        }
                      ]
                    }
                    """
                        .formatted(foreignAddress.getId(), child.getId())))
        .andExpect(status().isNotFound());
  }

  private String createTimeRecord(UserAccount user, WorkType workType, String workDate) throws Exception {
    String response =
        mockMvc
            .perform(
                post("/api/work-records")
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(timeRecordJson(workType, workDate)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return extractJsonValue(response, "id");
  }

  private String timeRecordJson(WorkType workType, String workDate) {
    return """
        {
          "workDate":"%s",
          "lines":[
            {
              "workTypeId":"%s",
              "startTime":"08:00:00",
              "endTime":"16:00:00",
              "unpaidBreakMinutes":0
            }
          ]
        }
        """
        .formatted(workDate, workType.getId());
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private WorkType createWorkType(
      UserAccount user, String name, CalculationMethod calculationMethod, CompensationMethod compensationMethod) {
    WorkType workType = new WorkType(user, name, calculationMethod);
    workType.changeCompensationMethod(compensationMethod);
    if (calculationMethod != CalculationMethod.TIME_BASED) {
      workType.changeCompositeEnabled(true);
    }
    workType.changeColor("#87C95A");
    return workTypes.saveAndFlush(workType);
  }

  private WorkType createChildWorkType(
      WorkType workType,
      String name,
      WorkLineCalculationMode mode,
      String unitLabel,
      String unitSymbol,
      String unitsPerHour,
      String ratePerUnit,
      String currency) {
    WorkType child = new WorkType(workType.getUser(), name, calculationMethod(mode));
    child.changeParent(workType);
    child.changeTeamworkEnabled(workType.isTeamworkEnabled());
    child.configureUnit(unitLabel, unitSymbol);
    child.configureFormula(
        unitsPerHour == null ? null : new BigDecimal(unitsPerHour),
        ratePerUnit == null ? null : new BigDecimal(ratePerUnit),
        currency);
    return workTypes.saveAndFlush(child);
  }

  private CalculationMethod calculationMethod(WorkLineCalculationMode mode) {
    return switch (mode) {
      case TIME_HOURLY -> CalculationMethod.TIME_BASED;
      case UNITS_PER_HOUR -> CalculationMethod.UNITS_PER_HOUR_BASED;
      case UNITS_PER_UNIT -> CalculationMethod.UNIT_BASED;
      case FIXED_AMOUNT -> CalculationMethod.FIXED_PRICE_BASED;
    };
  }

  private HourlyRatePeriod createRate(UserAccount user, String rate, String currency) {
    return hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, new BigDecimal(rate), currency, LocalDate.of(2026, 1, 1), null));
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
