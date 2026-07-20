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
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.absence.repository.AbsenceTypeSettingRepository;
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
import com.alveryn.api.workproject.repository.WorkProjectRepository;
import com.alveryn.api.worksession.repository.WorkSessionRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.CompensationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import com.alveryn.api.employment.entity.Employment;
import com.alveryn.api.employment.entity.CompensationType;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.employment.repository.EmploymentTermRepository;
import com.alveryn.api.user.entity.EmploymentType;
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
  @Autowired WorkSessionRepository workIntervals;
  @Autowired WorkProjectRepository workProjects;
  @Autowired AbsenceRepository absences;
  @Autowired AbsenceTypeSettingRepository absenceTypes;
  @Autowired AddressRepository addresses;
  @Autowired EmploymentRepository employments;
  @Autowired EmploymentTermRepository employmentTerms;
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
    workIntervals.deleteAll();
    workRecordLines.deleteAll();
    workRecords.deleteAll();
    workProjects.deleteAll();
    absences.deleteAll();
    absenceTypes.deleteAll();
    profiles.deleteAll();
    addresses.deleteAll();
    preferences.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    employmentTerms.deleteAll();
    employments.deleteAll();
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
            post("/api/work-records/sessions")
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
        .andExpect(jsonPath("$.data.entryKind").value("WORK_SESSION"))
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
        .andExpect(jsonPath("$.data.entryKind").value("WORK_RECORD"))
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
  void appliesExtraPayToEveryEnabledCalculationModeAndForcesZeroWhenDisabled() throws Exception {
    UserAccount user = createVerifiedUser("all-extra-pay-modes@example.com");
    WorkType time = createWorkType(user, "Shift", CalculationMethod.TIME_BASED, CompensationMethod.HOURLY);
    WorkType equivalent = createWorkType(user, "Rooms", CalculationMethod.UNITS_PER_HOUR_BASED, CompensationMethod.HOURLY);
    equivalent.changeCompositeEnabled(false);
    equivalent.configureUnit("Rooms", "room");
    equivalent.configureFormula(new BigDecimal("2.0000"), null, null);
    WorkType unit = createWorkType(user, "Paving", CalculationMethod.UNIT_BASED, CompensationMethod.PER_UNIT);
    unit.changeCompositeEnabled(false);
    unit.configureUnit("Square metre", "m2");
    unit.configureFormula(null, new BigDecimal("10.0000"), "EUR");
    WorkType fixed = createWorkType(user, "Roof repair", CalculationMethod.FIXED_PRICE_BASED, CompensationMethod.HOURLY);
    fixed.changeCompositeEnabled(false);
    time.changeExtraPayEnabled(true);
    equivalent.changeExtraPayEnabled(true);
    unit.changeExtraPayEnabled(true);
    fixed.changeExtraPayEnabled(true);
    workTypes.saveAllAndFlush(java.util.List.of(time, equivalent, unit, fixed));
    createRate(user, "20.00", "EUR");

    mockMvc.perform(post("/api/work-records")
            .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "workDate":"2026-07-18",
                  "lines":[
                    {"workTypeId":"%s","durationMinutes":480,"extraPayPercentage":100},
                    {"workTypeId":"%s","quantity":10,"extraPayPercentage":50},
                    {"workTypeId":"%s","quantity":3,"extraPayPercentage":100},
                    {"workTypeId":"%s","fixedAmount":500,"currency":"EUR","extraPayPercentage":25}
                  ]
                }
                """.formatted(time.getId(), equivalent.getId(), unit.getId(), fixed.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.workLines[0].extraPayPercentage").value(100))
        .andExpect(jsonPath("$.data.workLines[0].workedMinutes").value(480.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].extraPaidEquivalentMinutes").value(480.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].totalPaidEquivalentMinutes").value(960.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].baseGrossAmount").value(160.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].extraGrossAmount").value(160.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].totalGrossAmount").value(320.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].grossAmount").value(320.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].extraPayPercentage").value(50))
        .andExpect(jsonPath("$.data.workLines[1].workedMinutes").value(300.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].extraPaidEquivalentMinutes").value(150.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].totalPaidEquivalentMinutes").value(450.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].baseGrossAmount").value(100.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].extraGrossAmount").value(50.000000000000000))
        .andExpect(jsonPath("$.data.workLines[1].grossAmount").value(150.000000000000000))
        .andExpect(jsonPath("$.data.workLines[2].extraPayPercentage").value(100))
        .andExpect(jsonPath("$.data.workLines[2].workedMinutes").value(0.000000000000000))
        .andExpect(jsonPath("$.data.workLines[2].baseGrossAmount").value(30.000000000000000))
        .andExpect(jsonPath("$.data.workLines[2].extraGrossAmount").value(30.000000000000000))
        .andExpect(jsonPath("$.data.workLines[2].grossAmount").value(60.000000000000000))
        .andExpect(jsonPath("$.data.workLines[3].extraPayPercentage").value(25))
        .andExpect(jsonPath("$.data.workLines[3].workedMinutes").value(0.000000000000000))
        .andExpect(jsonPath("$.data.workLines[3].baseGrossAmount").value(500.000000000000000))
        .andExpect(jsonPath("$.data.workLines[3].extraGrossAmount").value(125.000000000000000))
        .andExpect(jsonPath("$.data.workLines[3].grossAmount").value(625.000000000000000))
        .andExpect(jsonPath("$.data.workedMinutes").value(780.000000000000000))
        .andExpect(jsonPath("$.data.extraPaidEquivalentMinutes").value(630.000000000000000))
        .andExpect(jsonPath("$.data.totalPaidEquivalentMinutes").value(1410.000000000000000))
        .andExpect(jsonPath("$.data.baseGrossAmount").value(790.000000000000000))
        .andExpect(jsonPath("$.data.extraGrossAmount").value(365.000000000000000))
        .andExpect(jsonPath("$.data.totalGrossAmount").value(1155.000000000000000))
        .andExpect(jsonPath("$.data.grossAmount").value(1155.000000000000000));

    fixed.changeExtraPayEnabled(false);
    workTypes.saveAndFlush(fixed);
    mockMvc.perform(post("/api/work-records")
            .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "workDate":"2026-07-19",
                  "lines":[
                    {"workTypeId":"%s","fixedAmount":500,"currency":"EUR","extraPayPercentage":100}
                  ]
                }
                """.formatted(fixed.getId())))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.workLines[0].extraPayPercentage").value(0))
        .andExpect(jsonPath("$.data.workLines[0].baseGrossAmount").value(500.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].extraGrossAmount").value(0.000000000000000))
        .andExpect(jsonPath("$.data.workLines[0].grossAmount").value(500.000000000000000));
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
    WorkType workType = new WorkType(user, employment(user), name, calculationMethod);
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
    WorkType child = new WorkType(workType.getUser(), workType.getEmployment(), name, calculationMethod(mode));
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
      case TIME_HOURLY, TIME_ONLY -> CalculationMethod.TIME_BASED;
      case UNITS_PER_HOUR -> CalculationMethod.UNITS_PER_HOUR_BASED;
      case UNITS_PER_UNIT -> CalculationMethod.UNIT_BASED;
      case FIXED_AMOUNT -> CalculationMethod.FIXED_PRICE_BASED;
    };
  }

  private HourlyRatePeriod createRate(UserAccount user, String rate, String currency) {
    return hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, employment(user), new BigDecimal(rate), currency, LocalDate.of(2026, 1, 1), null));
  }

  private Employment employment(UserAccount user) {
    var existing = employments.findAllByUserIdOrderByDisplayOrderAscNameAsc(user.getId());
    if (!existing.isEmpty()) return existing.getFirst();
    Employment employment = new Employment(user, "Test employment");
    employment.configure(EmploymentType.FULL_TIME, CompensationType.HOURLY, LocalDate.of(2026,1,1), null, null, null, null, null, true, 0);
    return employments.saveAndFlush(employment);
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
