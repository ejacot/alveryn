package com.alveryn.api.staffing;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class StaffingPlannerIntegrationTest {
  @Autowired WebApplicationContext context; @Autowired JwtService jwt;
  @Autowired UserAccountRepository users; @Autowired OrganizationRepository organizations;
  MockMvc mvc; UserAccount owner;
  @BeforeEach void setup() { mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build(); organizations.deleteAll(); users.deleteAll(); owner = new UserAccount("planner@example.com", "hash"); owner.verifyEmail(); owner = users.saveAndFlush(owner); }

  @Test void coverageMovesFromUnderstaffedToCoveredAndOverstaffed() throws Exception {
    String orgId = create("/api/organizations", "{\"name\":\"Hotel\",\"timezone\":\"Europe/Berlin\"}");
    String team = create("/api/organizations/" + orgId + "/units", "{\"name\":\"Housekeeping\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String first = create("/api/organizations/" + orgId + "/members", "{\"firstName\":\"Ana\",\"lastName\":\"Test\"}");
    String second = create("/api/organizations/" + orgId + "/members", "{\"firstName\":\"Maria\",\"lastName\":\"Test\"}");
    String third = create("/api/organizations/" + orgId + "/members", "{\"firstName\":\"Elena\",\"lastName\":\"Test\"}");
    String type = create("/api/organizations/" + orgId + "/staffing/work-types", "{\"unitId\":\"" + team + "\",\"code\":\"PF\",\"name\":\"Public early\",\"color\":\"#10B981\",\"defaultStartTime\":\"05:00\",\"defaultEndTime\":\"13:30\",\"defaultBreakMinutes\":30}");
    String requirementBody = createBody("/api/organizations/" + orgId + "/staffing/requirements", "{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type + "\",\"date\":\"2026-08-10\",\"requiredWorkers\":2}");
    String requirement = id(requirementBody);
    org.hamcrest.MatcherAssert.assertThat(requirementBody, org.hamcrest.Matchers.containsString("\"coverageStatus\":\"UNDERSTAFFED\""));
    assign(orgId, requirement, first, "UNDERSTAFFED", -1);
    assign(orgId, requirement, second, "COVERED", 0);
    assign(orgId, requirement, third, "OVERSTAFFED", 1);
    String overlapping = create("/api/organizations/" + orgId + "/staffing/requirements", "{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type + "\",\"date\":\"2026-08-10\",\"startTime\":\"06:00\",\"endTime\":\"10:00\",\"requiredWorkers\":1}");
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, overlapping).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"membershipId\":\"" + first + "\"}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.data.assignments[0].hasConflict").value(true));
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/bulk", orgId).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type + "\",\"dates\":[\"2026-08-11\",\"2026-08-12\"],\"requiredWorkers\":5}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.data.length()").value(2))
        .andExpect(jsonPath("$.data[0].date").value("2026-08-11")).andExpect(jsonPath("$.data[1].date").value("2026-08-12"));
    mvc.perform(put("/api/organizations/{org}/staffing/members/{member}/days/{date}", orgId, first, "2026-08-10").header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"VACATION\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.type").value("VACATION"))
        .andExpect(jsonPath("$.data.hasWorkConflict").value(true));
    mvc.perform(get("/api/organizations/{org}/staffing/day-entries", orgId).param("from", "2026-08-10").param("to", "2026-08-16").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
    mvc.perform(post("/api/organizations/{org}/staffing/publish", orgId).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"from\":\"2026-08-10\",\"to\":\"2026-08-16\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.publishedRequirements").value(4));
    mvc.perform(get("/api/my/business-schedule").param("from", "2026-08-10").param("to", "2026-08-16").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].organizationName").value("Hotel"))
        .andExpect(jsonPath("$.data[0].newPublication").value(true)).andExpect(jsonPath("$.data[0].requirements.length()").value(4));
    mvc.perform(get("/api/organizations/{org}/staffing/history", orgId).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].eventType").value("SCHEDULE_PUBLISHED"))
        .andExpect(jsonPath("$.data.length()", org.hamcrest.Matchers.greaterThan(4)));

    String membersBody = mvc.perform(get("/api/organizations/{org}/members", orgId).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    String ownerMembership = com.jayway.jsonpath.JsonPath.read(membersBody, "$.data[0].id");
    String ownAssignmentBody = mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, requirement)
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"membershipId\":\"" + ownerMembership + "\"}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    java.util.List<String> assignmentIds = com.jayway.jsonpath.JsonPath.read(ownAssignmentBody, "$.data.assignments[*].id");
    String ownAssignment = assignmentIds.get(assignmentIds.size() - 1);
    String resultBody = mvc.perform(put("/api/my/business-schedule/assignments/{assignment}/result", ownAssignment)
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"actualStartTime\":\"05:04\",\"actualEndTime\":\"13:42\",\"breakMinutes\":30,\"completedQuantity\":12,\"notes\":\"12 camere\",\"submit\":true}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.approvalStatus").value("SUBMITTED"))
        .andExpect(jsonPath("$.data.completedQuantity").value(12)).andReturn().getResponse().getContentAsString();
    String resultId = com.jayway.jsonpath.JsonPath.read(resultBody, "$.data.id");
    mvc.perform(get("/api/organizations/{org}/staffing/results/pending", orgId).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(resultId));
    mvc.perform(put("/api/organizations/{org}/staffing/results/{result}/approve", orgId, resultId)
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"actualStartTime\":\"05:00\",\"actualEndTime\":\"13:30\",\"breakMinutes\":30,\"completedQuantity\":11,\"notes\":\"corectat de manager\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.approvalStatus").value("APPROVED"))
        .andExpect(jsonPath("$.data.completedQuantity").value(11));
    String checkAssignmentBody = mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, overlapping)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + ownerMembership + "\"}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    java.util.List<String> checkAssignmentIds = com.jayway.jsonpath.JsonPath.read(checkAssignmentBody, "$.data.assignments[*].id");
    String checkAssignment = checkAssignmentIds.get(checkAssignmentIds.size() - 1);
    mvc.perform(post("/api/my/business-schedule/assignments/{assignment}/check-in", checkAssignment)
            .header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.timeCaptureSource").value("CHECK_IN"))
        .andExpect(jsonPath("$.data.checkedInAt").isNotEmpty())
        .andExpect(jsonPath("$.data.approvalStatus").value("DRAFT"));
    mvc.perform(post("/api/my/business-schedule/assignments/{assignment}/check-out", checkAssignment)
            .header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.checkedOutAt").isNotEmpty())
        .andExpect(jsonPath("$.data.actualEndTime").isNotEmpty())
        .andExpect(jsonPath("$.data.approvalStatus").value("SUBMITTED"));
    String absenceBody = mvc.perform(post("/api/my/business-schedule/absence-requests")
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"organizationId\":\"" + orgId + "\",\"type\":\"SICK\",\"startDate\":\"2026-08-14\",\"endDate\":\"2026-08-15\",\"notes\":\"medical\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING"))
        .andReturn().getResponse().getContentAsString();
    String absenceId = com.jayway.jsonpath.JsonPath.read(absenceBody, "$.data.id");
    mvc.perform(get("/api/organizations/{org}/staffing/absence-requests/pending", orgId).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(absenceId));
    mvc.perform(put("/api/organizations/{org}/staffing/absence-requests/{id}/decision", orgId, absenceId)
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"approve\":true}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
    mvc.perform(get("/api/organizations/{org}/staffing/day-entries", orgId).param("from", "2026-08-14").param("to", "2026-08-15").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
        .andExpect(jsonPath("$.data[*].type", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("SICK"))));
  }

  private void assign(String organizationId, String requirement, String member, String status, int difference) throws Exception {
    var result = mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", organizationId, requirement).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"membershipId\":\"" + member + "\"}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.data.coverageStatus").value(status)).andExpect(jsonPath("$.data.coverageDifference").value(difference));
    result.andExpect(jsonPath("$.data.assignments[*].hasConflict", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is(false))));
  }
  private String create(String path, String body) throws Exception { return id(createBody(path, body)); }
  private String createBody(String path, String body) throws Exception { return mvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(); }
  private String token() { return "Bearer " + jwt.generateAccessToken(owner); }
  private String id(String body) { int start = body.indexOf("\"id\":\"") + 6; return body.substring(start, body.indexOf('"', start)); }
}
