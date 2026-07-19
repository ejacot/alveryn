package com.alveryn.api.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.absence.entity.Absence;
import com.alveryn.api.absence.entity.AbsenceType;
import com.alveryn.api.absence.entity.AbsenceTypeSetting;
import com.alveryn.api.absence.repository.AbsenceRepository;
import com.alveryn.api.absence.repository.AbsenceTypeSettingRepository;
import com.alveryn.api.address.repository.AddressRepository;
import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.salary.entity.HourlyRatePeriod;
import com.alveryn.api.salary.repository.HourlyRatePeriodRepository;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.user.repository.UserProfileRepository;
import com.alveryn.api.workrecord.entity.WorkRecord;
import com.alveryn.api.workrecord.line.repository.WorkRecordLineRepository;
import com.alveryn.api.workrecord.repository.WorkRecordRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
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
  @Autowired HourlyRatePeriodRepository hourlyRates;
  @Autowired AbsenceRepository absences;
  @Autowired AbsenceTypeSettingRepository absenceTypes;
  @Autowired WorkRecordRepository workRecords;
  @Autowired WorkRecordLineRepository workRecordLines;
  @Autowired AddressRepository addresses;
  @Autowired UserProfileRepository profiles;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    workRecordLines.deleteAll();
    workRecords.deleteAll();
    absences.deleteAll();
    absenceTypes.deleteAll();
    workTypes.deleteAll();
    hourlyRates.deleteAll();
    profiles.deleteAll();
    addresses.deleteAll();
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

    var profile = profiles.findByUserId(user.getId()).orElseThrow();
    assertThat(profile.getEmploymentStartDate()).isEqualTo(LocalDate.of(2026, 1, 10));
    assertThat(profile.getEmploymentEndDate()).isEqualTo(LocalDate.of(2026, 1, 31));
  }

  @Test
  void addressCrudIsUserOwnedAndCanBeAttachedToProfile() throws Exception {
    UserAccount user = createVerifiedUser("addresses@example.com");
    UserAccount otherUser = createVerifiedUser("addresses-other@example.com");

    String addressId =
        extractJsonValue(
            mockMvc
                .perform(
                    post("/api/addresses")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            """
                            {
                              "street":" Leopoldstrasse 120 ",
                              "street2":" Etaj 2 ",
                              "city":" Munchen ",
                              "region":" Bavaria ",
                              "country":"de"
                            }
                            """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.street").value("Leopoldstrasse 120"))
                .andExpect(jsonPath("$.data.street2").value("Etaj 2"))
                .andExpect(jsonPath("$.data.city").value("Munchen"))
                .andExpect(jsonPath("$.data.region").value("Bavaria"))
                .andExpect(jsonPath("$.data.country").value("DE"))
                .andReturn()
                .getResponse()
                .getContentAsString(),
            "id");

    mockMvc
        .perform(get("/api/addresses").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].id").value(addressId));

    mockMvc
        .perform(get("/api/addresses").header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(0));

    mockMvc
        .perform(
            put("/api/addresses/" + addressId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "street":"Leopoldstrasse 125",
                      "street2":null,
                      "city":"Munchen",
                      "region":"Bavaria",
                      "country":"DE"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.street").value("Leopoldstrasse 125"))
        .andExpect(jsonPath("$.data.street2").doesNotExist());

    mockMvc
        .perform(
            put("/api/profile")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "firstName":"Ana",
                      "lastName":"Pop",
                      "addressId":"%s"
                    }
                    """
                        .formatted(addressId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.addressId").value(addressId))
        .andExpect(jsonPath("$.data.address.street").value("Leopoldstrasse 125"));

    mockMvc
        .perform(
            put("/api/addresses/" + addressId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "street":"Other",
                      "city":"Berlin",
                      "country":"DE"
                    }
                    """))
        .andExpect(status().isNotFound());

    assertThat(addresses.findAll()).hasSize(1);
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
                      "dateFormat":"DD.MM.YYYY",
                      "timeFormat":"H24",
                      "theme":"SYSTEM",
                      "defaultBreakMinutes":15,
                      "preferredDailyMinutes":420,
                      "paidSickLeave":false,
                      "paidVacation":true,
                      "onboardingCompleted":true
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currency").value("EUR"))
        .andExpect(jsonPath("$.data.paidSickLeave").value(false))
        .andExpect(jsonPath("$.data.paidVacation").value(true))
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

    HourlyRatePeriod updatedRate = hourlyRates.findById(UUID.fromString(firstRateId)).orElseThrow();
    assertThat(updatedRate.getValidFrom()).isEqualTo(LocalDate.of(2026, 1, 1));
    assertThat(updatedRate.getValidTo()).isEqualTo(LocalDate.of(2026, 1, 31));

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
                      "calculationMethod":"TIME_BASED",
                      "color":"#87C95A",
                      "displayOrder":1
                    }
                    """))
        .andExpect(status().isCreated());

    WorkType rooms = workTypes.findAll().getFirst();
    assertThat(rooms.getName()).isEqualTo("Rooms");
    assertThat(rooms.getCalculationMethod()).isEqualTo(CalculationMethod.TIME_BASED);
    assertThat(rooms.getDefaultBreakMinutes()).isEqualTo(30);

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
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WORK_TYPE_NAME_EXISTS"))
        .andExpect(jsonPath("$.errors[0]").value("name: Work type name already exists"));

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

    createTimeBasedWorkRecord(user, rooms, LocalDate.of(2026, 7, 1));

    mockMvc
        .perform(
            put("/api/work-types/" + rooms.getId())
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Rooms",
                      "calculationMethod":"UNIT_BASED",
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
  void unusedWorkTypeWithoutChildrenIsDeletedInsteadOfDeactivated() throws Exception {
    UserAccount user = createVerifiedUser("delete-unused-worktype@example.com");
    WorkType unused = new WorkType(user, "Unused", CalculationMethod.TIME_BASED);
    unused.changeColor("#87C95A");
    workTypes.saveAndFlush(unused);

    mockMvc
        .perform(get("/api/work-types/" + unused.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.deletable").value(true));

    mockMvc
        .perform(delete("/api/work-types/" + unused.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workTypes.findById(unused.getId())).isEmpty();
  }

  @Test
  void unusedCategoryAndItsChildrenAreDeletedTogether() throws Exception {
    UserAccount user = createVerifiedUser("delete-unused-category@example.com");
    WorkType category = new WorkType(user, "Cleaning", CalculationMethod.TIME_BASED);
    category.changeColor("#87C95A");
    category.changeCompositeEnabled(true);
    workTypes.saveAndFlush(category);
    WorkType child = new WorkType(user, "Rooms", CalculationMethod.TIME_BASED);
    child.changeParent(category);
    child.changeColor("#87C95A");
    workTypes.saveAndFlush(child);

    mockMvc
        .perform(get("/api/work-types/" + category.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.deletable").value(true));

    mockMvc
        .perform(delete("/api/work-types/" + category.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workTypes.findById(category.getId())).isEmpty();
    assertThat(workTypes.findById(child.getId())).isEmpty();
  }

  @Test
  void categoryWithUsedChildIsDeactivatedAndPreserved() throws Exception {
    UserAccount user = createVerifiedUser("deactivate-used-category@example.com");
    createOpenEndedRate(user, "18.00");
    WorkType category = new WorkType(user, "Hotel", CalculationMethod.TIME_BASED);
    category.changeColor("#87C95A");
    category.changeCompositeEnabled(true);
    workTypes.saveAndFlush(category);
    WorkType child = new WorkType(user, "Rooms", CalculationMethod.TIME_BASED);
    child.changeParent(category);
    child.changeColor("#87C95A");
    workTypes.saveAndFlush(child);
    createTimeBasedWorkRecord(user, child, LocalDate.of(2026, 7, 2));

    mockMvc
        .perform(get("/api/work-types/" + category.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.deletable").value(false));

    mockMvc
        .perform(delete("/api/work-types/" + category.getId()).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workTypes.findById(category.getId()).orElseThrow().isActive()).isFalse();
    assertThat(workTypes.findById(child.getId())).isPresent();
  }

  @Test
  void childWorkTypeCrudRejectsDuplicatesAndDeletesUnusedTypes() throws Exception {
    UserAccount user = createVerifiedUser("work-formulas@example.com");
    createOpenEndedRate(user, "18.00");
    WorkType unitBased = new WorkType(user, "Rooms", CalculationMethod.UNIT_BASED);
    unitBased.changeColor("#87C95A");
    unitBased.changeCompositeEnabled(true);
    workTypes.saveAndFlush(unitBased);
    WorkType timeBased = workTypes.saveAndFlush(new WorkType(user, "Hours", CalculationMethod.TIME_BASED));
    timeBased.changeColor("#87C95A");
    workTypes.saveAndFlush(timeBased);

    String configurationResponse =
        mockMvc
            .perform(
                post("/api/work-types")
                    .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "parentId":"%s",
                          "name":"Standard",
                          "calculationMethod":"UNITS_PER_HOUR_BASED",
                          "compensationMethod":"HOURLY",
                          "unitLabel":"Room",
                          "unitsPerHour":2.5,
                          "displayOrder":1,
                          "active":true
                        }
                        """
                            .formatted(unitBased.getId())))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String parsedConfigurationId = extractJsonValue(configurationResponse, "id");

    mockMvc
        .perform(
            post("/api/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parentId":"%s",
                      "name":" standard ",
                      "calculationMethod":"UNITS_PER_HOUR_BASED",
                      "compensationMethod":"HOURLY",
                      "unitLabel":"Room",
                      "unitsPerHour":3.0,
                      "displayOrder":2,
                      "active":true
                    }
                    """
                        .formatted(unitBased.getId())))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/work-types")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "parentId":"%s",
                      "name":"Invalid",
                      "calculationMethod":"UNITS_PER_HOUR_BASED",
                      "compensationMethod":"HOURLY",
                      "unitsPerHour":1.0,
                      "displayOrder":0,
                      "active":true
                    }
                    """
                        .formatted(timeBased.getId())))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(
            delete("/api/work-types/" + parsedConfigurationId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workTypes.findById(UUID.fromString(parsedConfigurationId))).isEmpty();
  }

  @Test
  void absenceTypesAreUserOwnedConfigurableAndSnapshotAbsences() throws Exception {
    UserAccount user = createVerifiedUser("absence-types@example.com");
    UserAccount otherUser = createVerifiedUser("absence-types-other@example.com");

    mockMvc
        .perform(get("/api/absence-types").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(0));

    String customTypeId =
        extractJsonValue(
            mockMvc
                .perform(
                    post("/api/absence-types")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            """
                            {
                              "name":" Training ",
                              "code":null,
                              "paid":true,
                              "paidMinutesPerDay":120,
                              "color":"#123ABC",
                              "active":true,
                              "displayOrder":9
                            }
                            """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Training"))
                .andExpect(jsonPath("$.data.paidMinutesPerDay").value(120))
                .andReturn()
                .getResponse()
                .getContentAsString(),
            "id");

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceTypeId":"%s",
                      "startDate":"2026-08-01",
                      "endDate":"2026-08-01"
                    }
                    """
                        .formatted(customTypeId)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.absenceTypeId").value(customTypeId))
        .andExpect(jsonPath("$.data.absenceTypeName").value("Training"))
        .andExpect(jsonPath("$.data.paid").value(true))
        .andExpect(jsonPath("$.data.paidMinutesPerDay").value(120));

    String absenceId = absences.findAll().getFirst().getId().toString();

    mockMvc
        .perform(
            put("/api/absence-types/" + customTypeId)
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name":"Training changed",
                      "code":null,
                      "paid":true,
                      "paidMinutesPerDay":180,
                      "color":"#123ABC",
                      "active":true,
                      "displayOrder":9
                    }
                    """))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/api/absences/" + absenceId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.absenceTypeName").value("Training"))
        .andExpect(jsonPath("$.data.paidMinutesPerDay").value(120));

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(otherUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceTypeId":"%s",
                      "startDate":"2026-08-02",
                      "endDate":"2026-08-02"
                    }
                    """
                        .formatted(customTypeId)))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(delete("/api/absence-types/" + customTypeId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(absenceTypes.findById(UUID.fromString(customTypeId)).orElseThrow().isActive()).isFalse();
  }

  @Test
  void absencesRejectInvalidAndOverlappingRangesSupportFiltersAndOwnership() throws Exception {
    UserAccount user = createVerifiedUser("absences@example.com");
    UserAccount otherUser = createVerifiedUser("absences-other@example.com");
    WorkType workType = createTimeWorkType(user, "Shift");
    createOpenEndedRate(user, "20.00");
    createTimeBasedWorkRecord(user, workType, LocalDate.of(2026, 7, 10));
    workRecords.saveAndFlush(new WorkRecord(user, null, LocalDate.of(2026, 7, 14), null, null));
    AbsenceTypeSetting vacationType =
        absenceTypes.saveAndFlush(new AbsenceTypeSetting(user, "Vacation", null, true, 150, "#10B981", 0));

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceTypeId":"%s",
                      "startDate":"2026-07-11",
                      "endDate":"2026-07-12",
                      "notes":" Summer "
                    }
                    """.formatted(vacationType.getId())))
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
                      "absenceTypeId":"%s",
                      "startDate":"2026-07-12",
                      "endDate":"2026-07-13"
                    }
                    """.formatted(vacationType.getId())))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceTypeId":"%s",
                      "startDate":"2026-07-10",
                      "endDate":"2026-07-10"
                    }
                    """.formatted(vacationType.getId())))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            post("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "absenceTypeId":"%s",
                      "startDate":"2026-07-14",
                      "endDate":"2026-07-14"
                    }
                    """.formatted(vacationType.getId())))
        .andExpect(status().isConflict());

    mockMvc
        .perform(
            get("/api/absences")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .param("year", "2026")
                .param("month", "7")
                .param("absenceTypeId", vacationType.getId().toString())
                .param("size", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalElements").value(1))
        .andExpect(jsonPath("$.data.content.length()").value(1));

    Absence ownedAbsence = absences.findAll().getFirst();
    assertThat(ownedAbsence.getStartDate()).isEqualTo(LocalDate.of(2026, 7, 11));
    assertThat(ownedAbsence.getEndDate()).isEqualTo(LocalDate.of(2026, 7, 12));
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
        .andExpect(jsonPath("$.data.profileConfigured").value(false))
        .andExpect(jsonPath("$.data.preferencesConfigured").value(false))
        .andExpect(jsonPath("$.data.workTypeConfigured").value(false))
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
            put("/api/profile")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "firstName":"Ana",
                      "lastName":"Pop",
                      "phone":null,
                      "employmentStartDate":null
                    }
                    """))
        .andExpect(status().isOk());

    mockMvc
        .perform(post("/api/onboarding/complete").header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.onboardingCompleted").value(true))
        .andExpect(jsonPath("$.data.workTypeConfigured").value(false))
        .andExpect(jsonPath("$.data.missingSteps.length()").value(0));

    assertThat(workTypes.findAll()).isEmpty();

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

  private void createOpenEndedRate(UserAccount user, String rate) {
    hourlyRates.saveAndFlush(
        new HourlyRatePeriod(user, new BigDecimal(rate), "EUR", LocalDate.of(2026, 1, 1), null));
  }

  private void createTimeBasedWorkRecord(UserAccount user, WorkType workType, LocalDate workDate)
      throws Exception {
    mockMvc
        .perform(
            post("/api/work-records")
                .header(HttpHeaders.AUTHORIZATION, bearerToken(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workDate":"%s",
                      "lines":[
                        {
                          "workTypeId":"%s",
                          "startTime":"08:00:00",
                          "endTime":"12:00:00",
                          "unpaidBreakMinutes":0
                        }
                      ]
                    }
                    """
                        .formatted(workDate, workType.getId())))
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
