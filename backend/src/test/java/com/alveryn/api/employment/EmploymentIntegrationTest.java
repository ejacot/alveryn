package com.alveryn.api.employment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.employment.repository.EmploymentTermRepository;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
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
class EmploymentIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwtService;
  @Autowired UserAccountRepository users;
  @Autowired EmploymentRepository employments;
  @Autowired EmploymentTermRepository terms;
  @Autowired WorkTypeRepository workTypes;
  private MockMvc mockMvc;

  @BeforeEach void setUp() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    workTypes.deleteAll(); terms.deleteAll(); employments.deleteAll(); users.deleteAll();
  }

  @Test void unusedEmploymentIsPermanentlyDeleted() throws Exception {
    UserAccount user = user("employment-delete@example.com");
    String id = create(user, """
        {"name":"Clean contract","employmentType":"FULL_TIME","compensationType":"HOURLY",
         "termsValidFrom":"2026-01-01","startDate":"2026-01-01","active":true}
        """);
    mockMvc.perform(delete("/api/employments/{id}", id).header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isNoContent());
    assertThat(employments.findById(java.util.UUID.fromString(id))).isEmpty();
    assertThat(terms.findAll()).isEmpty();
  }

  @Test void employmentTypeIsOptionalUntilTheApplicationUsesIt() throws Exception {
    UserAccount user = user("employment-without-type@example.com");
    String id = create(user, """
        {"name":"Simple contract","employmentType":null,"trackingFocus":"TIME","hourBalanceEnabled":false,
         "termsValidFrom":"2026-01-01","startDate":"2026-01-01","active":true}
        """);

    mockMvc.perform(get("/api/employments/{id}", id).header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.employmentType").doesNotExist())
        .andExpect(jsonPath("$.data.trackingFocus").value("TIME"))
        .andExpect(jsonPath("$.data.hourBalanceEnabled").value(false));
    var employment = employments.findById(java.util.UUID.fromString(id)).orElseThrow();
    assertThat(employment.getEmploymentType()).isNull();
    assertThat(employment.getTrackingFocus().name()).isEqualTo("TIME");
    assertThat(employment.isHourBalanceEnabled()).isFalse();
  }

  @Test void trackingSetupIsVersionedAndRequiresAnActiveEmployment() throws Exception {
    UserAccount user = user("tracking-setup@example.com");

    mockMvc.perform(get("/api/tracking-setup/current").header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.requiredVersion").value(1))
        .andExpect(jsonPath("$.data.completedVersion").value(0))
        .andExpect(jsonPath("$.data.completed").value(false));

    mockMvc.perform(post("/api/tracking-setup/current/complete").header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isConflict());

    create(user, """
        {"name":"My employment","employmentType":null,"trackingFocus":"TIME","hourBalanceEnabled":false,
         "termsValidFrom":"2026-01-01","active":true}
        """);

    mockMvc.perform(post("/api/tracking-setup/current/complete").header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.trackingSetupVersionCompleted").value(1));

    mockMvc.perform(get("/api/tracking-setup/current").header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.completed").value(true));
  }

  @Test void changingTermsPreservesThePreviousContractPeriod() throws Exception {
    UserAccount user = user("employment-terms@example.com");
    String id = create(user, fixedBody("Contract", "2026-01-01", 9600));
    mockMvc.perform(put("/api/employments/{id}", id)
            .header(HttpHeaders.AUTHORIZATION, token(user)).contentType(MediaType.APPLICATION_JSON)
            .content(fixedBody("Contract", "2026-07-01", 7200)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.targetMinutes").value(7200))
        .andExpect(jsonPath("$.data.termsValidFrom").value("2026-07-01"));

    var history = terms.findAllByEmploymentIdOrderByValidFromAsc(java.util.UUID.fromString(id));
    assertThat(history).hasSize(2);
    assertThat(history.get(0).getValidFrom()).isEqualTo(LocalDate.of(2026, 1, 1));
    assertThat(history.get(0).getValidTo()).isEqualTo(LocalDate.of(2026, 6, 30));
    assertThat(history.get(0).getTargetMinutes()).isEqualTo(9600);
    assertThat(history.get(1).getTargetMinutes()).isEqualTo(7200);
  }

  @Test void monthlyBalanceUsesTermsEffectiveForThatMonth() throws Exception {
    UserAccount user = user("employment-balance@example.com");
    String id = create(user, fixedBody("Contract", "2026-01-01", 9600));
    mockMvc.perform(put("/api/employments/{id}", id)
            .header(HttpHeaders.AUTHORIZATION, token(user)).contentType(MediaType.APPLICATION_JSON)
            .content(fixedBody("Contract", "2026-07-01", 7200)))
        .andExpect(status().isOk());

    mockMvc.perform(get("/api/employments/{id}/hour-balance", id).param("year", "2026").param("month", "6")
            .header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.targetMinutes").value(9600));
    mockMvc.perform(get("/api/employments/{id}/hour-balance", id).param("year", "2026").param("month", "7")
            .header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.targetMinutes").value(7200));
  }

  @Test void hourBalanceUsesTheConfiguredRollingValidityWindow() throws Exception {
    UserAccount user = user("employment-validity@example.com");
    String id = create(user, """
        {"name":"Contract","employmentType":"FULL_TIME","compensationType":"FIXED_SALARY",
         "termsValidFrom":"2025-01-01","startDate":"2025-01-01","fixedSalaryAmount":2000,
         "currency":"EUR","targetMinutes":9600,"targetPeriod":"MONTHLY",
         "hourBalanceValidityMonths":3,"active":true}
        """);

    mockMvc.perform(get("/api/employments/{id}/hour-balance", id).param("year", "2026").param("month", "7")
            .header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.validityMonths").value(3))
        .andExpect(jsonPath("$.data.balancePeriodStart").value("2026-05-01"));
  }

  @Test void usedEmploymentIsArchivedAndItsHistoryRemainsLinked() throws Exception {
    UserAccount user = user("employment-archive@example.com");
    String id = create(user, fixedBody("Used contract", "2026-01-01", 9600));
    var employment = employments.findById(java.util.UUID.fromString(id)).orElseThrow();
    WorkType workType = workTypes.saveAndFlush(new WorkType(user, employment, "Regular shift", CalculationMethod.TIME_BASED));

    mockMvc.perform(delete("/api/employments/{id}", id).header(HttpHeaders.AUTHORIZATION, token(user)))
        .andExpect(status().isNoContent());

    var archived = employments.findById(java.util.UUID.fromString(id)).orElseThrow();
    assertThat(archived.isActive()).isFalse();
    assertThat(workTypes.findById(workType.getId()).orElseThrow().getEmployment().getId()).isEqualTo(archived.getId());
    assertThat(terms.findAllByEmploymentIdOrderByValidFromAsc(archived.getId())).hasSize(1);
  }

  @Test void employmentEndpointsDoNotExposeAnotherUsersEmployment() throws Exception {
    UserAccount owner = user("employment-owner@example.com");
    UserAccount stranger = user("employment-stranger@example.com");
    String id = create(owner, fixedBody("Private contract", "2026-01-01", 9600));

    mockMvc.perform(get("/api/employments/{id}", id).header(HttpHeaders.AUTHORIZATION, token(stranger)))
        .andExpect(status().isNotFound());
    mockMvc.perform(put("/api/employments/{id}", id).header(HttpHeaders.AUTHORIZATION, token(stranger))
            .contentType(MediaType.APPLICATION_JSON).content(fixedBody("Changed", "2026-07-01", 7200)))
        .andExpect(status().isNotFound());
    mockMvc.perform(delete("/api/employments/{id}", id).header(HttpHeaders.AUTHORIZATION, token(stranger)))
        .andExpect(status().isNotFound());

    assertThat(employments.findById(java.util.UUID.fromString(id)).orElseThrow().getName()).isEqualTo("Private contract");
  }

  private String fixedBody(String name, String validFrom, int target) {
    return """
        {"name":"%s","employmentType":"FULL_TIME","compensationType":"FIXED_SALARY",
         "termsValidFrom":"%s","startDate":"2026-01-01","fixedSalaryAmount":2000,
         "currency":"EUR","targetMinutes":%d,"targetPeriod":"MONTHLY","active":true}
        """.formatted(name, validFrom, target);
  }
  private String create(UserAccount user, String body) throws Exception {
    String response = mockMvc.perform(post("/api/employments").header(HttpHeaders.AUTHORIZATION, token(user))
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return response.substring(response.indexOf("\"id\":\"") + 6, response.indexOf('"', response.indexOf("\"id\":\"") + 6));
  }
  private UserAccount user(String email) { UserAccount user = new UserAccount(email, "hash"); user.verifyEmail(); return users.saveAndFlush(user); }
  private String token(UserAccount user) { return "Bearer " + jwtService.generateAccessToken(user); }
}
