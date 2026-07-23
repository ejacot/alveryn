package com.alveryn.api.schedule;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.employment.repository.EmploymentTermRepository;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import com.alveryn.api.schedule.repository.ShiftAssignmentRepository;
import com.alveryn.api.worktype.entity.CalculationMethod;
import com.alveryn.api.worktype.entity.WorkType;
import com.alveryn.api.worktype.repository.WorkTypeRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class ScheduleIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired EmploymentRepository employments;
  @Autowired EmploymentTermRepository terms;
  @Autowired ShiftAssignmentRepository assignments;
  @Autowired WorkTypeRepository workTypes;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    workTypes.deleteAll();
    employments.deleteAll();
    users.deleteAll();
  }

  @Test
  void recurringWeekCreatesVersionedConcreteShifts() throws Exception {
    UserAccount user = user("schedule@example.com");
    String employmentId = createEmployment(user);
    var employment = employments.findById(java.util.UUID.fromString(employmentId)).orElseThrow();
    WorkType workType = workTypes.save(new WorkType(user, employment, "Deliveries", CalculationMethod.TIME_BASED));
    LocalDate validFrom = LocalDate.now().plusDays(1);

    mockMvc.perform(put("/api/employments/{id}/schedule", employmentId)
            .header(HttpHeaders.AUTHORIZATION, token(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(scheduleBody(validFrom, workType.getId(), "08:00", "17:00")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.version").value(1))
        .andExpect(jsonPath("$.data.timezone").value("Europe/Berlin"))
        .andExpect(jsonPath("$.data.rules.length()").value(6))
        .andExpect(jsonPath("$.data.rules[0].workTypeName").value("Deliveries"));

    mockMvc.perform(get("/api/employments/{id}/schedule/shifts", employmentId)
            .param("from", validFrom.toString())
            .param("to", validFrom.plusWeeks(12).minusDays(1).toString())
            .header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(72))
        .andExpect(jsonPath("$.data[0].source").value("RECURRING_TEMPLATE"))
        .andExpect(jsonPath("$.data[0].assignmentStatus").value("ACCEPTED"));

    var firstAssignment = assignments.findRange(java.util.UUID.fromString(employmentId),
        validFrom.atStartOfDay(java.time.ZoneId.of("Europe/Berlin")).toOffsetDateTime(),
        validFrom.plusWeeks(12).atStartOfDay(java.time.ZoneId.of("Europe/Berlin")).toOffsetDateTime()).getFirst();
    LocalDate firstShiftDate = firstAssignment.getShift().getStartsAt().toLocalDate();
    mockMvc.perform(put("/api/employments/{id}/schedule/shifts/{assignmentId}",
            employmentId, firstAssignment.getId())
            .header(HttpHeaders.AUTHORIZATION, token(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"date":"%s","startTime":"10:00","endTime":"19:00"}
                """.formatted(firstShiftDate)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.startsAt").value(org.hamcrest.Matchers.containsString("T10:00")))
        .andExpect(jsonPath("$.data.endsAt").value(org.hamcrest.Matchers.containsString("T19:00")));

    LocalDate nextVersion = validFrom.plusDays(1);
    mockMvc.perform(put("/api/employments/{id}/schedule", employmentId)
            .header(HttpHeaders.AUTHORIZATION, token(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(scheduleBody(nextVersion, workType.getId(), "09:00", "18:00")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.version").value(2))
        .andExpect(jsonPath("$.data.validFrom").value(nextVersion.toString()));

    mockMvc.perform(get("/api/employments/{id}/schedule", employmentId)
            .header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.version").value(2));
  }

  @Test
  void scheduleCannotBeReadForAnotherUsersEmployment() throws Exception {
    UserAccount owner = user("schedule-owner@example.com");
    UserAccount stranger = user("schedule-stranger@example.com");
    String employmentId = createEmployment(owner);

    mockMvc.perform(get("/api/employments/{id}/schedule", employmentId)
            .header(HttpHeaders.AUTHORIZATION, token(stranger)))
        .andExpect(status().isNotFound());
  }

  private String scheduleBody(LocalDate validFrom, java.util.UUID workTypeId, String start, String end) {
    return """
        {"name":"Usual week","timezone":"Europe/Berlin","validFrom":"%s","rules":[
          {"itemType":"ACTIVITY","workTypeId":"%s","dayOfWeek":"MONDAY","startTime":"08:00","endTime":"10:00","breakMinutes":0},
          {"itemType":"ACTIVITY","workTypeId":"%s","dayOfWeek":"MONDAY","startTime":"10:30","endTime":"13:00","breakMinutes":0},
          {"itemType":"ACTIVITY","workTypeId":"%s","dayOfWeek":"TUESDAY","startTime":"%s","endTime":"%s","breakMinutes":30},
          {"itemType":"ACTIVITY","workTypeId":"%s","dayOfWeek":"WEDNESDAY","startTime":"%s","endTime":"%s","breakMinutes":30},
          {"itemType":"ACTIVITY","workTypeId":"%s","dayOfWeek":"THURSDAY","startTime":"%s","endTime":"%s","breakMinutes":30},
          {"itemType":"ACTIVITY","workTypeId":"%s","dayOfWeek":"FRIDAY","startTime":"%s","endTime":"%s","breakMinutes":30}
        ]}
        """.formatted(validFrom, workTypeId, workTypeId, workTypeId, start, end,
            workTypeId, start, end, workTypeId, start, end, workTypeId, start, end);
  }

  private String createEmployment(UserAccount user) throws Exception {
    String response = mockMvc.perform(post("/api/employments")
            .header(HttpHeaders.AUTHORIZATION, token(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"name":"Main job","employmentType":null,"trackingFocus":"TIME",
                 "hourBalanceEnabled":false,"termsValidFrom":"2026-01-01","active":true}
                """))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    int start = response.indexOf("\"id\":\"") + 6;
    return response.substring(start, response.indexOf('"', start));
  }

  private UserAccount user(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }

  private String token(UserAccount user) {
    return "Bearer " + jwtService.generateAccessToken(user);
  }
}
