package com.roomly.api.workentry;

import static org.assertj.core.api.Assertions.assertThat;
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
import com.roomly.api.salary.service.SalaryCalculationService;
import com.roomly.api.user.entity.UserAccount;
import com.roomly.api.user.repository.UserAccountRepository;
import com.roomly.api.workentry.entity.TimeEntryDetails;
import com.roomly.api.workentry.entity.UnitEntryItem;
import com.roomly.api.workentry.entity.WorkEntry;
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

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest
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
        .andExpect(jsonPath("$.calculationMethod").value("TIME_BASED"))
        .andExpect(jsonPath("$.timeEntry.workedMinutes").value(450));

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
        .andExpect(jsonPath("$.timeEntry.totalIntervalMinutes").value(480))
        .andExpect(jsonPath("$.timeEntry.workedMinutes").value(465));

    WorkEntry overnightEntry =
        workEntries.findAll().stream()
            .filter(entry -> entry.getWorkDate().equals(LocalDate.of(2026, 7, 11)))
            .findFirst()
            .orElseThrow();
    assertThat(overnightEntry.getCalculatedMinutes()).isEqualByComparingTo("465.000000000000000");
    assertThat(overnightEntry.getGrossAmount()).isEqualByComparingTo("120.125000000000000");
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
        .andExpect(jsonPath("$.calculationMethod").value("UNIT_BASED"))
        .andExpect(jsonPath("$.unitItems.length()").value(2));

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
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].workTypeId").value(daytime.getId().toString()));
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
        .andExpect(jsonPath("$.timeEntry.workedMinutes").value(240));

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
        .andExpect(jsonPath("$.notes").value("Updated"))
        .andExpect(jsonPath("$.timeEntry.workedMinutes").value(300));

    mockMvc
        .perform(delete("/api/work-entries/" + entryId).header(HttpHeaders.AUTHORIZATION, bearerToken(user)))
        .andExpect(status().isNoContent());

    assertThat(workEntries.findAll()).isEmpty();
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
    mockMvc
        .perform(
            post("/api/work-entries")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"workTypeId\":\"00000000-0000-0000-0000-000000000000\",\"workDate\":\"2026-07-10\"}"))
        .andExpect(status().isUnauthorized());
  }

  private void createTimeEntry(
      UserAccount user, WorkType workType, LocalDate workDate, String startTime, String endTime, int breakMinutes)
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
                      "endTime":"%s",
                      "unpaidBreakMinutes":%d
                    }
                    """
                        .formatted(workType.getId(), workDate, startTime, endTime, breakMinutes)))
        .andExpect(status().isCreated());
  }

  private UserAccount createVerifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private WorkType createWorkType(UserAccount user, String name, CalculationMethod calculationMethod) {
    WorkType workType = new WorkType(user, name, calculationMethod);
    workType.changeColor("#87C95A");
    return workTypes.saveAndFlush(workType);
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
