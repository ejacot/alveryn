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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class StaffingPlannerIntegrationTest {
  @Autowired WebApplicationContext context; @Autowired JwtService jwt;
  @Autowired UserAccountRepository users; @Autowired OrganizationRepository organizations;
  @Autowired JdbcTemplate jdbc;
  MockMvc mvc; UserAccount owner;
  @BeforeEach void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    context.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
        .update("delete from staffing_plan_publication_operations");
    organizations.deleteAll();
    users.deleteAll();
    owner = new UserAccount("planner@example.com", "hash");
    owner.verifyEmail();
    owner = users.saveAndFlush(owner);
  }

  @Test void coverageMovesFromUnderstaffedToCoveredAndOverstaffed() throws Exception {
    String orgId = create("/api/organizations", "{\"name\":\"Hotel\",\"timezone\":\"Europe/Berlin\"}");
    String team = create("/api/organizations/" + orgId + "/units", "{\"name\":\"Housekeeping\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String first = create("/api/organizations/" + orgId + "/members", "{\"firstName\":\"Ana\",\"lastName\":\"Test\"}");
    String second = create("/api/organizations/" + orgId + "/members", "{\"firstName\":\"Maria\",\"lastName\":\"Test\"}");
    String third = create("/api/organizations/" + orgId + "/members", "{\"firstName\":\"Elena\",\"lastName\":\"Test\"}");
    jdbc.update("update organization_memberships set membership_status='ACTIVE' where id in (?,?,?)",
        java.util.UUID.fromString(first), java.util.UUID.fromString(second),
        java.util.UUID.fromString(third));
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
        .andExpect(jsonPath("$.data[0].newPublication").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments.length()").value(0))
        .andExpect(jsonPath("$.data[0].dayEntries.length()").value(0))
        .andExpect(jsonPath("$.data[0].requirements").doesNotExist());
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
    mvc.perform(post("/api/organizations/{org}/staffing/publish", orgId)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"from\":\"2026-08-10\",\"to\":\"2026-08-16\",\"requirementIds\":[\"" + requirement + "\"]}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/my/business-schedule").param("from", "2026-08-10").param("to", "2026-08-16")
            .header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].newPublication").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments.length()").value(1))
        .andExpect(jsonPath("$.data[0].assignments[0].id").value(ownAssignment))
        .andExpect(jsonPath("$.data[0].assignments[0].membershipId").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments[0].memberName").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments[0].requiredWorkers").doesNotExist())
        .andExpect(jsonPath("$.data[0].dayEntries.length()").value(0));
    long revisionBeforeActuals = planRevision(orgId, team, "2026-08-10");
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
    org.junit.jupiter.api.Assertions.assertEquals(
        revisionBeforeActuals, planRevision(orgId, team, "2026-08-10"));
    String checkAssignmentBody = mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, overlapping)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + ownerMembership + "\"}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    java.util.List<String> checkAssignmentIds = com.jayway.jsonpath.JsonPath.read(checkAssignmentBody, "$.data.assignments[*].id");
    String checkAssignment = checkAssignmentIds.get(checkAssignmentIds.size() - 1);
    long revisionBeforeCheckIn = planRevision(orgId, team, "2026-08-10");
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
    org.junit.jupiter.api.Assertions.assertEquals(
        revisionBeforeCheckIn, planRevision(orgId, team, "2026-08-10"));
    long revisionBeforeAbsence = planRevision(orgId, team, "2026-08-10");
    String fingerprintBeforeAbsence = sourceFingerprint(orgId, team, "2026-08-10");
    String absenceBody = mvc.perform(post("/api/my/business-schedule/absence-requests")
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
        .content("{\"organizationId\":\"" + orgId + "\",\"type\":\"SICK\",\"startDate\":\"2026-08-14\",\"endDate\":\"2026-08-15\",\"notes\":\"medical\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING"))
        .andReturn().getResponse().getContentAsString();
    org.junit.jupiter.api.Assertions.assertEquals(
        revisionBeforeAbsence + 1, planRevision(orgId, team, "2026-08-10"));
    org.junit.jupiter.api.Assertions.assertNotEquals(
        fingerprintBeforeAbsence, sourceFingerprint(orgId, team, "2026-08-10"));
    String absenceId = com.jayway.jsonpath.JsonPath.read(absenceBody, "$.data.id");
    mvc.perform(get("/api/organizations/{org}/staffing/absence-requests/pending", orgId).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(absenceId));
    mvc.perform(put("/api/organizations/{org}/staffing/absence-requests/{id}/decision", orgId, absenceId)
        .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"approve\":true}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
    org.junit.jupiter.api.Assertions.assertEquals(
        revisionBeforeAbsence + 2, planRevision(orgId, team, "2026-08-10"));
    mvc.perform(get("/api/organizations/{org}/staffing/day-entries", orgId).param("from", "2026-08-14").param("to", "2026-08-15").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
        .andExpect(jsonPath("$.data[*].type", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("SICK"))));
  }

  @Test void weeklyDraftRevisionTracksLogicalPlannerMutationsExactlyOnce() throws Exception {
    String orgId = create("/api/organizations", "{\"name\":\"Revision Hotel\",\"timezone\":\"Europe/Berlin\"}");
    String team = create("/api/organizations/" + orgId + "/units",
        "{\"name\":\"Housekeeping\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String member = create("/api/organizations/" + orgId + "/members",
        "{\"firstName\":\"Ana\",\"lastName\":\"Revision\"}");
    String type = create("/api/organizations/" + orgId + "/staffing/work-types",
        "{\"unitId\":\"" + team + "\",\"code\":\"ROOM\",\"name\":\"Room cleaning\","
            + "\"color\":\"#10B981\",\"defaultStartTime\":\"09:00\","
            + "\"defaultEndTime\":\"16:30\",\"defaultBreakMinutes\":30}");

    String requirement = create("/api/organizations/" + orgId + "/staffing/requirements",
        "{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type
            + "\",\"date\":\"2026-08-10\",\"requiredWorkers\":1}");
    assertPlanRevision(orgId, team, "2026-08-10", 1);
    org.junit.jupiter.api.Assertions.assertEquals(1, jdbc.queryForObject(
        "select count(*) from staffing_requirements where id=?::uuid and plan_day_id is not null",
        Integer.class, requirement));

    String sameWorkType = "{\"unitId\":\"" + team + "\",\"code\":\"ROOM\","
        + "\"name\":\"Room cleaning\",\"color\":\"#10B981\","
        + "\"defaultStartTime\":\"09:00\",\"defaultEndTime\":\"16:30\","
        + "\"defaultBreakMinutes\":30}";
    mvc.perform(put("/api/organizations/{org}/staffing/work-types/{type}", orgId, type)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content(sameWorkType))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 1);
    mvc.perform(put("/api/organizations/{org}/staffing/work-types/{type}", orgId, type)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content(sameWorkType.replace("Room cleaning", "Room service")))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Room service"));
    assertPlanRevision(orgId, team, "2026-08-10", 2);

    String unchanged = "{\"startTime\":\"09:00\",\"endTime\":\"16:30\","
        + "\"requiredWorkers\":1}";
    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content(unchanged))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 2);

    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"startTime\":\"09:00\",\"endTime\":\"17:00\",\"requiredWorkers\":2}"))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 3);

    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"date\":\"2026-08-17\",\"requiredWorkers\":2}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0]").value(org.hamcrest.Matchers.containsString(
            "date, unit and work type cannot be changed")));
    assertPlanRevision(orgId, team, "2026-08-10", 3);
    org.junit.jupiter.api.Assertions.assertEquals("2026-08-10", jdbc.queryForObject(
        "select work_date::text from staffing_requirements where id=?::uuid", String.class,
        requirement));

    mvc.perform(post("/api/organizations/{org}/staffing/requirements/bulk", orgId)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type
                + "\",\"dates\":[\"2026-08-11\",\"2026-08-12\"],\"requiredWorkers\":1}"))
        .andExpect(status().isCreated());
    assertPlanRevision(orgId, team, "2026-08-10", 4);

    mvc.perform(post("/api/organizations/{org}/staffing/requirements/bulk", orgId)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type
                + "\",\"dates\":[\"2026-08-16\",\"2026-08-17\"],\"requiredWorkers\":1}"))
        .andExpect(status().isCreated());
    assertPlanRevision(orgId, team, "2026-08-10", 5);
    assertPlanRevision(orgId, team, "2026-08-17", 1);

    String assignmentBody = mvc.perform(post(
            "/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + member + "\"}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    java.util.List<String> assignmentIds = com.jayway.jsonpath.JsonPath.read(
        assignmentBody, "$.data.assignments[*].id");
    String assignment = assignmentIds.getFirst();
    assertPlanRevision(orgId, team, "2026-08-10", 6);

    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}/assignments/{assignment}",
            orgId, requirement, assignment).header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 6);
    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}/assignments/{assignment}",
            orgId, requirement, assignment).header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"startTime\":\"10:00\",\"endTime\":\"17:00\"}"))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 7);

    mvc.perform(put("/api/organizations/{org}/staffing/members/{member}/days/{date}", orgId,
            member, "2026-08-10").header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"REST_DAY\"}"))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 8);
    mvc.perform(put("/api/organizations/{org}/staffing/members/{member}/days/{date}", orgId,
            member, "2026-08-10").header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"REST_DAY\"}"))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 8);

    mvc.perform(delete("/api/organizations/{org}/staffing/requirements/{req}/assignments/{assignment}",
            orgId, requirement, assignment).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 9);
    mvc.perform(delete("/api/organizations/{org}/staffing/requirements/{req}/assignments/{assignment}",
            orgId, requirement, assignment).header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk());
    assertPlanRevision(orgId, team, "2026-08-10", 9);

    mvc.perform(delete("/api/organizations/{org}/members/{member}", orgId, member)
            .header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("SUSPENDED"));
    assertPlanRevision(orgId, team, "2026-08-10", 10);
    mvc.perform(post("/api/organizations/{org}/members/{member}/reactivate", orgId, member)
            .header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("INVITED"));
    assertPlanRevision(orgId, team, "2026-08-10", 11);

    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"startTime\":\"09:00\",\"endTime\":\"17:00\",\"requiredWorkers\":0}"))
        .andExpect(status().isBadRequest());
    assertPlanRevision(orgId, team, "2026-08-10", 11);
  }

  @Test void employeeScheduleContainsOnlyTheCurrentMembersPublishedData() throws Exception {
    UserAccount employee = verifiedUser("employee@example.com");
    UserAccount colleague = verifiedUser("colleague@example.com");
    String orgId = create("/api/organizations", "{\"name\":\"Private Hotel\",\"timezone\":\"Europe/Berlin\"}");
    String team = create("/api/organizations/" + orgId + "/units",
        "{\"name\":\"Housekeeping\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String employeeMembership = create("/api/organizations/" + orgId + "/members",
        "{\"firstName\":\"Current\",\"lastName\":\"Worker\",\"email\":\"employee@example.com\"}");
    String colleagueMembership = create("/api/organizations/" + orgId + "/members",
        "{\"firstName\":\"Peer\",\"lastName\":\"Worker\",\"email\":\"colleague@example.com\"}");
    String type = create("/api/organizations/" + orgId + "/staffing/work-types",
        "{\"unitId\":\"" + team + "\",\"code\":\"ROOM\",\"name\":\"Room cleaning\",\"color\":\"#10B981\",\"defaultStartTime\":\"09:00\",\"defaultEndTime\":\"16:30\",\"defaultBreakMinutes\":30}");
    String requirement = create("/api/organizations/" + orgId + "/staffing/requirements",
        "{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type + "\",\"date\":\"2026-08-10\",\"requiredWorkers\":2}");

    String firstAssignmentBody = mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + employeeMembership + "\"}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    java.util.List<String> ownAssignmentIds = com.jayway.jsonpath.JsonPath.read(firstAssignmentBody,
        "$.data.assignments[?(@.membershipId == '" + employeeMembership + "')].id");
    String ownAssignmentId = ownAssignmentIds.getFirst();
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + colleagueMembership + "\"}"))
        .andExpect(status().isCreated());
    mvc.perform(put("/api/organizations/{org}/staffing/members/{member}/days/{date}", orgId,
            employeeMembership, "2026-08-11").header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"REST_DAY\",\"notes\":\"own confidential note\"}"))
        .andExpect(status().isOk());
    mvc.perform(put("/api/organizations/{org}/staffing/members/{member}/days/{date}", orgId,
            colleagueMembership, "2026-08-11").header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"SICK\",\"notes\":\"peer confidential note\"}"))
        .andExpect(status().isOk());
    mvc.perform(post("/api/organizations/{org}/staffing/publish", orgId)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"from\":\"2026-08-10\",\"to\":\"2026-08-16\"}"))
        .andExpect(status().isOk());
    mvc.perform(put("/api/my/business-schedule/assignments/{assignment}/result", ownAssignmentId)
            .header(HttpHeaders.AUTHORIZATION, token(employee)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"actualStartTime\":\"09:00\",\"actualEndTime\":\"16:30\",\"breakMinutes\":30,\"completedQuantity\":12,\"notes\":\"own result\",\"submit\":true}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.approvalStatus").value("SUBMITTED"));
    String unpublishedRequirement = create("/api/organizations/" + orgId + "/staffing/requirements",
        "{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type
            + "\",\"date\":\"2026-08-11\",\"requiredWorkers\":1}");
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId,
            unpublishedRequirement).header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + employeeMembership + "\"}"))
        .andExpect(status().isCreated());

    String body = mvc.perform(get("/api/my/business-schedule")
            .param("from", "2026-08-10").param("to", "2026-08-16")
            .header(HttpHeaders.AUTHORIZATION, token(employee)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(1))
        .andExpect(jsonPath("$.data[0].assignments.length()").value(1))
        .andExpect(jsonPath("$.data[0].assignments[0].id").value(ownAssignmentId))
        .andExpect(jsonPath("$.data[0].assignments[0].workTypeCode").value("ROOM"))
        .andExpect(jsonPath("$.data[0].assignments[0].result.approvalStatus").value("SUBMITTED"))
        .andExpect(jsonPath("$.data[0].assignments[0].result.notes").value("own result"))
        .andExpect(jsonPath("$.data[0].assignments[0].membershipId").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments[0].memberName").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments[0].requiredWorkers").doesNotExist())
        .andExpect(jsonPath("$.data[0].requirements").doesNotExist())
        .andExpect(jsonPath("$.data[0].dayEntries.length()").value(1))
        .andExpect(jsonPath("$.data[0].dayEntries[0].type").value("REST_DAY"))
        .andExpect(jsonPath("$.data[0].dayEntries[0].notes").value("own confidential note"))
        .andExpect(jsonPath("$.data[0].dayEntries[0].hasWorkConflict").value(false))
        .andExpect(jsonPath("$.data[0].dayEntries[0].membershipId").doesNotExist())
        .andReturn().getResponse().getContentAsString();
    for (String forbiddenField : java.util.List.of("requirements", "coverage", "coverageStatus",
        "coverageDifference", "requiredWorkers", "requiredQuantity", "assignedWorkers",
        "publicationStatus", "membershipId", "memberName", "memberEmail", "assignmentId",
        "hasConflict", "conflictingAssignmentIds", "viewed")) {
      org.hamcrest.MatcherAssert.assertThat(body,
          org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("\"" + forbiddenField + "\"")));
    }
    org.hamcrest.MatcherAssert.assertThat(body, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("colleague@example.com")));
    org.hamcrest.MatcherAssert.assertThat(body, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Peer Worker")));
    org.hamcrest.MatcherAssert.assertThat(body, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("peer confidential note")));
    org.hamcrest.MatcherAssert.assertThat(body, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(unpublishedRequirement)));

    String colleagueOnlyRequirement = create("/api/organizations/" + orgId + "/staffing/requirements",
        "{\"unitId\":\"" + team + "\",\"workTypeId\":\"" + type
            + "\",\"date\":\"2026-08-12\",\"requiredWorkers\":1}");
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", orgId,
            colleagueOnlyRequirement).header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + colleagueMembership + "\"}"))
        .andExpect(status().isCreated());
    mvc.perform(post("/api/organizations/{org}/staffing/publish", orgId)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"from\":\"2026-08-10\",\"to\":\"2026-08-16\",\"requirementIds\":[\""
                + colleagueOnlyRequirement + "\"]}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/my/business-schedule")
            .param("from", "2026-08-10").param("to", "2026-08-16")
            .header(HttpHeaders.AUTHORIZATION, token(employee)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].newPublication").doesNotExist())
        .andExpect(jsonPath("$.data[0].assignments.length()").value(1))
        .andExpect(jsonPath("$.data[0].assignments[0].id").value(ownAssignmentId));

    mvc.perform(delete("/api/organizations/{org}/members/{member}", orgId, employeeMembership)
            .header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("SUSPENDED"));
    mvc.perform(get("/api/my/business-schedule")
            .param("from", "2026-08-10").param("to", "2026-08-16")
            .header(HttpHeaders.AUTHORIZATION, token(employee)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));

    // Keep the colleague account live so the test also proves that filtering is membership-based,
    // not the accidental result of an unclaimed invitation.
    org.junit.jupiter.api.Assertions.assertNotNull(colleague.getId());
  }

  @Test void validIdentifiersCannotCrossOrganizationBoundaries() throws Exception {
    String firstOrg = create("/api/organizations", "{\"name\":\"First Hotel\",\"timezone\":\"Europe/Berlin\"}");
    String secondOrg = create("/api/organizations", "{\"name\":\"Second Hotel\",\"timezone\":\"Europe/Berlin\"}");
    String firstTeam = create("/api/organizations/" + firstOrg + "/units",
        "{\"name\":\"First Team\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String secondTeam = create("/api/organizations/" + secondOrg + "/units",
        "{\"name\":\"Second Team\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String firstType = create("/api/organizations/" + firstOrg + "/staffing/work-types",
        "{\"unitId\":\"" + firstTeam + "\",\"code\":\"PF\",\"name\":\"Public early\",\"color\":\"#10B981\",\"defaultStartTime\":\"05:00\"}");
    String secondType = create("/api/organizations/" + secondOrg + "/staffing/work-types",
        "{\"unitId\":\"" + secondTeam + "\",\"code\":\"PS\",\"name\":\"Public late\",\"color\":\"#10B981\",\"defaultStartTime\":\"13:30\"}");
    String firstRequirement = create("/api/organizations/" + firstOrg + "/staffing/requirements",
        "{\"unitId\":\"" + firstTeam + "\",\"workTypeId\":\"" + firstType + "\",\"date\":\"2026-08-10\",\"requiredWorkers\":1}");
    String secondRequirement = create("/api/organizations/" + secondOrg + "/staffing/requirements",
        "{\"unitId\":\"" + secondTeam + "\",\"workTypeId\":\"" + secondType + "\",\"date\":\"2026-08-10\",\"requiredWorkers\":1}");
    String secondMember = create("/api/organizations/" + secondOrg + "/members",
        "{\"firstName\":\"Other\",\"lastName\":\"Tenant\"}");

    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", firstOrg, firstRequirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + secondMember + "\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(put("/api/organizations/{org}/staffing/requirements/{req}", firstOrg, secondRequirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"startTime\":\"13:30\",\"endTime\":\"22:00\",\"requiredWorkers\":1}"))
        .andExpect(status().isNotFound());
  }

  @Test void membershipsInTwoBusinessesRemainSeparatedInTheSelfSchedule() throws Exception {
    UserAccount employee = verifiedUser("two-businesses@example.com");
    String firstOrg = create("/api/organizations", "{\"name\":\"First Business\",\"timezone\":\"Europe/Berlin\"}");
    String secondOrg = create("/api/organizations", "{\"name\":\"Second Business\",\"timezone\":\"Europe/Berlin\"}");
    createPublishedAssignment(firstOrg, "FIRST", "First shift", "two-businesses@example.com");
    createPublishedAssignment(secondOrg, "SECOND", "Second shift", "two-businesses@example.com");

    String body = mvc.perform(get("/api/my/business-schedule")
            .param("from", "2026-08-10").param("to", "2026-08-16")
            .header(HttpHeaders.AUTHORIZATION, token(employee)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
        .andReturn().getResponse().getContentAsString();
    java.util.List<String> firstCodes = com.jayway.jsonpath.JsonPath.read(body,
        "$.data[?(@.organizationId == '" + firstOrg + "')].assignments[*].workTypeCode");
    java.util.List<String> secondCodes = com.jayway.jsonpath.JsonPath.read(body,
        "$.data[?(@.organizationId == '" + secondOrg + "')].assignments[*].workTypeCode");
    org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of("FIRST"), firstCodes);
    org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of("SECOND"), secondCodes);
  }

  private void assign(String organizationId, String requirement, String member, String status, int difference) throws Exception {
    var result = mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", organizationId, requirement).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content("{\"membershipId\":\"" + member + "\"}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.data.coverageStatus").value(status)).andExpect(jsonPath("$.data.coverageDifference").value(difference));
    result.andExpect(jsonPath("$.data.assignments[*].hasConflict", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is(false))));
  }
  private String create(String path, String body) throws Exception { return id(createBody(path, body)); }
  private void createPublishedAssignment(String organizationId, String code, String name, String email)
      throws Exception {
    String unit = create("/api/organizations/" + organizationId + "/units",
        "{\"name\":\"" + name + " team\",\"type\":\"TEAM\",\"checkInMode\":\"OPTIONAL\"}");
    String member = create("/api/organizations/" + organizationId + "/members",
        "{\"firstName\":\"Shared\",\"lastName\":\"Worker\",\"email\":\"" + email + "\"}");
    String type = create("/api/organizations/" + organizationId + "/staffing/work-types",
        "{\"unitId\":\"" + unit + "\",\"code\":\"" + code + "\",\"name\":\"" + name
            + "\",\"color\":\"#10B981\",\"defaultStartTime\":\"09:00\"}");
    String requirement = create("/api/organizations/" + organizationId + "/staffing/requirements",
        "{\"unitId\":\"" + unit + "\",\"workTypeId\":\"" + type
            + "\",\"date\":\"2026-08-10\",\"requiredWorkers\":1}");
    mvc.perform(post("/api/organizations/{org}/staffing/requirements/{req}/assignments", organizationId, requirement)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"membershipId\":\"" + member + "\"}"))
        .andExpect(status().isCreated());
    mvc.perform(post("/api/organizations/{org}/staffing/publish", organizationId)
            .header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"from\":\"2026-08-10\",\"to\":\"2026-08-16\"}"))
        .andExpect(status().isOk());
  }
  private String createBody(String path, String body) throws Exception { return mvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, token()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(); }
  private String token() { return "Bearer " + jwt.generateAccessToken(owner); }
  private String token(UserAccount user) { return "Bearer " + jwt.generateAccessToken(user); }
  private void assertPlanRevision(String organizationId, String unitId, String weekStart,
      long expected) {
    org.junit.jupiter.api.Assertions.assertEquals(
        expected, planRevision(organizationId, unitId, weekStart));
  }
  private long planRevision(String organizationId, String unitId, String weekStart) {
    return jdbc.queryForObject(
        "select draft_revision from staffing_plans where organization_id=?::uuid "
            + "and unit_id=?::uuid and week_start=?::date",
        Long.class, organizationId, unitId, weekStart);
  }
  private String sourceFingerprint(String organizationId, String unitId, String weekStart) {
    java.util.UUID planId = jdbc.queryForObject(
        "select id from staffing_plans where organization_id=?::uuid and unit_id=?::uuid "
            + "and week_start=?::date",
        java.util.UUID.class, organizationId, unitId, weekStart);
    try {
      Object writer = context.getBean("staffingPlanPublicationWriter");
      var method = writer.getClass().getDeclaredMethod("sourceFingerprint",
          java.util.UUID.class, java.util.UUID.class, java.util.UUID.class);
      method.setAccessible(true);
      return (String) method.invoke(writer, java.util.UUID.fromString(organizationId),
          java.util.UUID.fromString(unitId), planId);
    } catch (ReflectiveOperationException exception) {
      throw new IllegalStateException("cannot inspect source fingerprint", exception);
    }
  }
  private UserAccount verifiedUser(String email) {
    UserAccount user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
  }
  private String id(String body) { int start = body.indexOf("\"id\":\"") + 6; return body.substring(start, body.indexOf('"', start)); }
}
