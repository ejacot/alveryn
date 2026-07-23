package com.alveryn.api.organization;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.employment.repository.EmploymentRepository;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.schedule.repository.*;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class OrganizationIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwt;
  @Autowired UserAccountRepository users;
  @Autowired OrganizationRepository organizations;
  @Autowired OrganizationMembershipRepository memberships;
  @Autowired OrganizationInvitationRepository invitations;
  @Autowired EmploymentRepository employments;
  @Autowired ShiftChangeRequestRepository changeRequests;
  @Autowired ShiftAssignmentRepository shiftAssignments;
  @Autowired ShiftBreakRepository shiftBreaks;
  @Autowired ScheduledShiftRepository shifts;
  @Autowired OrganizationActivityRepository activities;
  MockMvc mvc;

  @BeforeEach void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    cleanDatabase();
  }

  @AfterEach void tearDown() {
    cleanDatabase();
  }

  private void cleanDatabase() {
    changeRequests.deleteAll();
    shiftBreaks.deleteAll();
    shiftAssignments.deleteAll();
    shifts.deleteAll();
    invitations.deleteAll();
    employments.deleteAll();
    activities.deleteAll();
    memberships.deleteAll();
    organizations.deleteAll();
    users.deleteAll();
  }

  @Test void ownerCreatesCompanyAndManagesMemberWhileEmployeeCannot() throws Exception {
    UserAccount owner = user("owner@business.test");
    UserAccount employee = user("employee@business.test");
    String body = mvc.perform(post("/api/organizations").header(HttpHeaders.AUTHORIZATION, token(owner))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"Northstar Logistics\",\"timezone\":\"America/Chicago\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.type").value("BUSINESS"))
        .andExpect(jsonPath("$.data.role").value("OWNER"))
        .andReturn().getResponse().getContentAsString();
    String organizationId = value(body, "id");
    Organization organization = organizations.findById(java.util.UUID.fromString(organizationId)).orElseThrow();
    OrganizationMembership employeeMembership = memberships.save(
        new OrganizationMembership(organization, employee, MembershipRole.EMPLOYEE));

    mvc.perform(get("/api/organizations").header(HttpHeaders.AUTHORIZATION, token(employee)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("Northstar Logistics"));
    mvc.perform(get("/api/organizations/{id}/members", organizationId)
        .header(HttpHeaders.AUTHORIZATION, token(owner)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2));
    mvc.perform(put("/api/organizations/{id}/members/{membershipId}/role",
            organizationId, employeeMembership.getId())
        .header(HttpHeaders.AUTHORIZATION, token(employee))
        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"MANAGER\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(put("/api/organizations/{id}/members/{membershipId}/role",
            organizationId, employeeMembership.getId())
        .header(HttpHeaders.AUTHORIZATION, token(owner))
        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"MANAGER\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.role").value("MANAGER"));
  }

  @Test void managerSchedulesEmployeeAndApprovesDropRequest() throws Exception {
    UserAccount owner=user("planner@business.test");
    UserAccount employee=user("worker@business.test");
    Organization organization=organizations.save(new Organization("Northstar","Europe/Berlin"));
    OrganizationMembership ownerMembership=memberships.save(new OrganizationMembership(organization,owner,MembershipRole.OWNER));
    OrganizationMembership worker=memberships.save(new OrganizationMembership(organization,employee,MembershipRole.EMPLOYEE));
    String employmentBody=mvc.perform(post("/api/organizations/{id}/members/{membershipId}/employments",
            organization.getId(),worker.getId()).header(HttpHeaders.AUTHORIZATION,token(owner))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"Main job\",\"compensationType\":\"HOURLY\",\"trackingFocus\":\"TIME\","
            +"\"hourBalanceEnabled\":false,\"timerEnabled\":true,\"termsValidFrom\":\"2026-07-24\",\"active\":true}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    String employmentId=value(employmentBody,"id");
    String activityBody=mvc.perform(post("/api/organizations/{id}/activities",organization.getId())
        .header(HttpHeaders.AUTHORIZATION,token(owner)).contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"Delivery\",\"color\":\"#60A5FA\",\"defaultBreakMinutes\":30}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    String activityId=value(activityBody,"id");
    String shiftBody=mvc.perform(post("/api/organizations/{id}/shifts",organization.getId())
        .header(HttpHeaders.AUTHORIZATION,token(owner)).contentType(MediaType.APPLICATION_JSON)
        .content("{\"membershipId\":\""+worker.getId()+"\",\"employmentId\":\""+employmentId
            +"\",\"activityId\":\""+activityId+"\",\"date\":\"2026-07-27\","
            +"\"startTime\":\"08:00\",\"endTime\":\"17:00\",\"breakMinutes\":30}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.data.plannedMinutes").value(510))
        .andReturn().getResponse().getContentAsString();
    String assignmentId=value(shiftBody,"assignmentId");
    String requestBody=mvc.perform(post("/api/organizations/{id}/shift-requests/assignments/{assignmentId}",
            organization.getId(),assignmentId).header(HttpHeaders.AUTHORIZATION,token(employee))
        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"DROP\",\"reason\":\"Cannot attend\"}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("PENDING"))
        .andReturn().getResponse().getContentAsString();
    String requestId=value(requestBody,"id");
    mvc.perform(put("/api/organizations/{id}/shift-requests/{requestId}/decision",
            organization.getId(),requestId).header(HttpHeaders.AUTHORIZATION,token(owner))
        .contentType(MediaType.APPLICATION_JSON).content("{\"approved\":true}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
    mvc.perform(get("/api/organizations/{id}/shifts",organization.getId())
        .param("from","2026-07-27").param("to","2026-07-27")
        .header(HttpHeaders.AUTHORIZATION,token(employee)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].status").value("CANCELLED"));
  }

  private UserAccount user(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }
  private String token(UserAccount user) { return "Bearer " + jwt.generateAccessToken(user); }
  private String value(String json, String field) {
    String marker = "\"" + field + "\":\"";
    int start = json.indexOf(marker) + marker.length();
    return json.substring(start, json.indexOf('"', start));
  }
}
