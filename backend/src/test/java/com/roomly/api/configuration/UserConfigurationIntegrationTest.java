package com.roomly.api.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.roomly.api.absence.entity.Absence;
import com.roomly.api.absence.entity.AbsenceType;
import com.roomly.api.absence.repository.AbsenceRepository;
import com.roomly.api.auth.security.JwtService;
import com.roomly.api.salary.entity.HourlyRatePeriod;
import com.roomly.api.salary.repository.HourlyRatePeriodRepository;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.workentry.entity.WorkEntry;
import com.roomly.api.workentry.repository.UnitEntryItemRepository;
import com.roomly.api.workentry.repository.WorkEntryRepository;
import com.roomly.api.worktype.entity.CalculationMethod;
import com.roomly.api.worktype.entity.UnitType;
import com.roomly.api.worktype.entity.WorkType;
import com.roomly.api.worktype.repository.UnitTypeRepository;
import com.roomly.api.worktype.repository.WorkTypeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
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
class UserConfigurationIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired WorkTypeRepository workTypes;
  @Autowired UnitTypeRepository unitTypes;
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired AbsenceRepository absences;
  @Autowired WorkEntryRepository workEntries;
  @Autowired UnitEntryItemRepository unitEntryItems;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    unitEntryItems.deleteAll();
    workEntries.deleteAll();
    absences.deleteAll();
    unitTypes.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    users.deleteAll();
  }

  @Test
  void profileGetAutoCreatesAndProfileUpdateNormalizesValues() throws Exception {
    UserAccount user = createVerifiedUser("profile@example.com");

    mockMvc
        .perform(get("/api/profile").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").isNotEmpty())
        .andExpect(jsonPath("$.data.firstName").doesNotExist());

    mockMvc
        .perform(
            put("/api/profile")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "firstName":"  Ana  ",
                      "lastName":" Pop ",
                      "countryCode":"ro",
                      "city":"  Bucharest  ",
                      "employmentStartDate":"2026-01-10",
                      "employmentEndDate":"2026-01-31",
                      "apartment":"   "
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.firstName").value("Ana"))
        .andExpect(jsonPath("$.data.lastName").value("Pop"))
        .andExpect(jsonPath("$.data.countryCode").value("RO"))
        .andExpect(jsonPath("$.data.city").value("Bucharest"))
        .andExpect(jsonPath("$.data.apartment").doesNotExist());
  }

  @Test
  void preferencesUpdateValidatesTimezoneCurrencyAndIgnoresOnboardingFlag() throws Exception {
    UserAccount user = createVerifiedUser("preferences@example.com");

    mockMvc
        .perform(
            put("/api/preferences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "language":"ro",
                      "timezone":"Europe/Berlin",
                      "currency":"eur",
                      "firstDayOfWeek":"MONDAY",
                      "dateFormat":"DD.MM.YYYY",
                      "timeFormat":"H24",
                      "theme":"SYSTEM",
                      "defaultBreakMinutes":15,
                      "preferredDailyMinutes":420,
                      "onboardingCompleted":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currency").value("EUR"))
        .andExpect(jsonPath("$.data.onboardingCompleted").value(false));

    mockMvc
        .perform(
            put("/api/preferences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "language":"ro",
                      "timezone":"Mars/Olympus",
                      "currency":"EUR",
                      "firstDayOfWeek":"MONDAY",
                      "dateFormat":"DD.MM.YYYY",
                      "timeFormat":"H24",
                      "theme":"SYSTEM",
                      "defaultBreakMinutes":15
                    }
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0]").value("timezone must be a valid ZoneId"));

    mockMvc
        .perform(
            put("/api/preferences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "language":"ro",
                      "timezone":"Europe/Berlin",
                      "currency":"EURO",
                      "firstDayOfWeek":"MONDAY",
                      "dateFormat":"DD.MM.YYYY",
                      "timeFormat":"H24",
                      "theme":"SYSTEM",
                      "defaultBreakMinutes":15
                    }
                    """))
        .andExpect(status().isBadRequest());
  }

  @Test
  void hourlyRateCrudSupportsAdjacentButRejectsOverlapAndEnforcesOwnership() throws Exception {
    UserAccount user = createVerifiedUser("rates@example.com");
    UserAccount otherUser = createVerifiedUser("other-rates@example.com");

    String firstRateId =
        createHourlyRate(
            user,
            """
            {
              "hourlyRate":15.50,
              "currency":"EUR",
              "validFrom":"2026-01-01",
              "validTo":"2026-01-31"
            }
            """);

    mockMvc
        .perform(
            post("/api/hourly-rates")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "hourlyRate":17.50,
                      "currency":"EUR",
                      "validFrom":"2026-01-15",
                      "validTo":"2026-02-15"
                    }
                    """))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/hourly-rates")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "hourlyRate":17.50,
                      "currency":"EUR",
                      "validFrom":"2026-02-01",
                      "validTo":null
                    }
                    """))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            put("/api/hourly-rates/" + firstRateId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "hourlyRate":16.00,
                      "currency":"EUR",
                      "validFrom":"2026-01-01",
                      "validTo":"2026-01-31"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.hourlyRate").value(16.00));

    mockMvc
        .perform(get("/api/hourly-rates/" + firstRateId).header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser)))
        .andExpect(status().isNotFound());
  }

  @Test
  void workTypeCrudRejectsDuplicateNamesInvalidColorAndUnsafeCalculationMethodChange() throws Exception {
    UserAccount user = createVerifiedUser("worktypes@example.com");
    createOpenEndedRate(user, "18.00");

    mockMvc
        .perform(
            post("/api/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Rooms",
                      "calculationMethod":"UNIT_BASED",
                      "color":"#87C95A",
                      "displayOrder":1
                    }
                    """))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":" rooms ",
                      "calculationMethod":"TIME_BASED",
                      "color":"#87C95A",
                      "displayOrder":2
                    }
                    """))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Invalid Color",
                      "calculationMethod":"TIME_BASED",
                      "color":"green",
                      "displayOrder":2
                    }
                    """))
        .andExpect(status().isBadRequest());

    WorkType rooms = workTypes.findAll().getFirst();
    createUnitBasedWorkEntry(user, rooms, createUnitType(rooms, "Suite", "2.0000"));

    mockMvc
        .perform(
            put("/api/work-types/" + rooms.getId())
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Rooms",
                      "calculationMethod":"TIME_BASED",
                      "color":"#87C95A",
                      "displayOrder":1,
                      "active":true
                    }
                    """))
        .andExpect(status().isConflict());

    mockMvc
        .perform(delete("/api/work-types/" + rooms.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workTypes.findById(rooms.getId()).orElseThrow().isActive()).isFalse();
  }

  @Test
  void unitTypeCrudRequiresUnitBasedParentRejectsDuplicatesAndSoftDeletesHistoricalTypes() throws Exception {
    UserAccount user = createVerifiedUser("units@example.com");
    createOpenEndedRate(user, "18.00");
    WorkType unitBased = workTypes.saveAndFlush(new WorkType(user, "Rooms", CalculationMethod.UNIT_BASED));
    unitBased.changeColor("#87C95A");
    workTypes.saveAndFlush(unitBased);
    WorkType timeBased = workTypes.saveAndFlush(new WorkType(user, "Hours", CalculationMethod.TIME_BASED));
    timeBased.changeColor("#87C95A");
    workTypes.saveAndFlush(timeBased);

    String unitTypeId =
        mockMvc
            .perform(
                post("/api/work-types/" + unitBased.getId() + "/unit-types")
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "name":"Standard",
                          "unitsPerHour":2.5,
                          "displayOrder":1,
                          "active":true
                        }
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String parsedUnitTypeId = extractJsonValue(unitTypeId, "id");

    mockMvc
        .perform(
            post("/api/work-types/" + unitBased.getId() + "/unit-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":" standard ",
                      "unitsPerHour":3.0,
                      "displayOrder":2,
                      "active":true
                    }
                    """))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/work-types/" + timeBased.getId() + "/unit-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Invalid",
                      "unitsPerHour":1.0,
                      "displayOrder":0,
                      "active":true
                    }
                    """))
        .andExpect(status().isConflict());

    UnitType unitType = unitTypes.findById(UUID.fromString(parsedUnitTypeId)).orElseThrow();
    createUnitBasedWorkEntry(user, unitBased, unitType);

    mockMvc
        .perform(
            delete("/api/work-types/" + unitBased.getId() + "/unit-types/" + parsedUnitTypeId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(unitTypes.findById(unitType.getId()).orElseThrow().isActive()).isFalse();
    assertThat(unitEntryItems.existsByUnitTypeId(unitType.getId())).isTrue();
  }

  @Test
  void absencesRejectInvalidAndOverlappingRangesSupportFiltersAndOwnership() throws Exception {
    UserAccount user = createVerifiedUser("absences@example.com");
    UserAccount otherUser = createVerifiedUser("absences-other@example.com");
    WorkType workType = createTimeWorkType(user, "Shift");
    createOpenEndedRate(user, "20.00");
    createTimeBasedWorkEntry(user, workType, LocalDate.of(2026, 7, 10));

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceType":"VACATION",
                      "startDate":"2026-07-11",
                      "endDate":"2026-07-12",
                      "notes":" Summer "
                    }
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.notes").value("Summer"));

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceType":"VACATION",
                      "startDate":"2026-07-12",
                      "endDate":"2026-07-13"
                    }
                    """))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceType":"SICK_LEAVE",
                      "startDate":"2026-07-10",
                      "endDate":"2026-07-10"
                    }
                    """))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            get("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("year", "2026")
                .param("month", "7")
                .param("absenceType", "VACATION")
                .param("size", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalElements").value(1))
        .andExpect(jsonPath("$.data.content.length()").value(1));

    Absence ownedAbsence = absences.findAll().getFirst();
    mockMvc
        .perform(get("/api/absences/" + ownedAbsence.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser)))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(get("/api/absences").header(HttpHeaders.AUTHORIZATION, bearerToken(user)).param("size", "101"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void onboardingStatusAndCompletionAreBackendCalculatedAndIdempotent() throws Exception {
    UserAccount user = createVerifiedUser("onboarding@example.com");

    mockMvc
        .perform(get("/api/onboarding/status").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.preferencesConfigured").value(false))
        .andExpect(jsonPath("$.data.missingSteps.length()").value(3));

    mockMvc
        .perform(post("/api/onboarding/complete").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            put("/api/preferences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "language":"ro",
                      "timezone":"Europe/Berlin",
                      "currency":"EUR",
                      "firstDayOfWeek":"MONDAY",
                      "dateFormat":"DD.MM.YYYY",
                      "timeFormat":"H24",
                      "theme":"SYSTEM",
                      "defaultBreakMinutes":30,
                      "onboardingCompleted":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.onboardingCompleted").value(false));

    createHourlyRate(
        user,
        """
        {
          "hourlyRate":19.00,
          "currency":"EUR",
          "validFrom":"2026-01-01",
          "validTo":null
        }
        """);

    mockMvc
        .perform(
            post("/api/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"General",
                      "calculationMethod":"TIME_BASED",
                      "color":"#87C95A",
                      "displayOrder":0
                    }
                    """))
        .andExpect(status().isCreated());

    mockMvc
        .perform(post("/api/onboarding/complete").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.onboardingCompleted").value(true))
        .andExpect(jsonPath("$.data.missingSteps.length()").value(0));

    mockMvc
        .perform(post("/api/onboarding/complete").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.onboardingCompleted").value(true));
  }

  @Test
  void configurationEndpointsRequireAuthentication() throws Exception {
    mockMvc.perform(get("/api/profile")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/preferences")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/hourly-rates")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/work-types")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/absences")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/onboarding/status")).andExpect(status().isUnauthorized());
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private WorkType createTimeWorkType(UserAccount user, String name) {
    WorkType workType = new WorkType(user, name, CalculationMethod.TIME_BASED);
    workType.changeColor("#87C95A");
    return workTypes.saveAndFlush(workType);
  }

  private UnitType createUnitType(WorkType workType, String name, String unitsPerHour) {
    return unitTypes.saveAndFlush(new UnitType(workType, name, new BigDecimal(unitsPerHour)));
  }

  private void createOpenEndedRate(UserAccount user, String rate) {
    hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, new BigDecimal(rate), "EUR", LocalDate.of(2026, 1, 1), null));
  }

  private void createTimeBasedWorkEntry(UserAccount user, WorkType workType, LocalDate workDate)
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
                      "startTime":"08:00:00",
                      "endTime":"12:00:00",
                      "unpaidBreakMinutes":0
                    }
                    """
                        .formatted(workType.getId(), workDate)))
        .andExpect(status().isCreated());
  }

  private void createUnitBasedWorkEntry(UserAccount user, WorkType workType, UnitType unitType)
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
                      "workDate":"2026-07-01",
                      "unitItems":[{"unitTypeId":"%s","quantity":2}]
                    }
                    """
                        .formatted(workType.getId(), unitType.getId())))
        .andExpect(status().isCreated());
  }

  private String createHourlyRate(UserAccount user, String body) throws Exception {
    return extractJsonValue(
        mockMvc
            .perform(
                post("/api/hourly-rates")
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString(),
        "id");
  }

  private String bearerToken(UserAccount user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }

  private String extractJsonValue(String body, String field) {
    String marker = "\"%s\":\"".formatted(field);
    int start = body.indexOf(marker);
    int valueStart = start + marker.length();
    int valueEnd = body.indexOf('"', valueStart);
    return body.substring(valueStart, valueEnd);
  }
}
