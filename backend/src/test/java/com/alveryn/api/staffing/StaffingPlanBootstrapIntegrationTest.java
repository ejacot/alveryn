package com.alveryn.api.staffing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.alveryn.api.auth.security.AuthenticatedUser;
import com.alveryn.api.auth.security.JwtService;
import com.alveryn.api.organization.entity.CheckInMode;
import com.alveryn.api.organization.entity.MembershipRole;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationUnit;
import com.alveryn.api.organization.entity.OrganizationUnitType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.organization.repository.OrganizationUnitRepository;
import com.alveryn.api.staffing.service.StaffingPlanBootstrapFaultProbe;
import com.alveryn.api.staffing.service.StaffingPlanBootstrapService;
import com.alveryn.api.staffing.service.StaffingPlanCoverageService;
import com.alveryn.api.staffing.service.StaffingPlanPublicationService;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.entity.UserRole;
import com.alveryn.api.user.entity.UserStatus;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(StaffingPlanBootstrapIntegrationTest.FaultConfiguration.class)
class StaffingPlanBootstrapIntegrationTest {
  private static final LocalDate WEEK = LocalDate.of(2026, 8, 10);

  @Autowired WebApplicationContext context;
  @Autowired JwtService jwt;
  @Autowired UserAccountRepository users;
  @Autowired OrganizationRepository organizations;
  @Autowired OrganizationMembershipRepository memberships;
  @Autowired OrganizationUnitRepository units;
  @Autowired StaffingPlanBootstrapService service;
  @Autowired StaffingPlanCoverageService coverage;
  @Autowired StaffingPlanPublicationService publication;
  @Autowired JdbcTemplate jdbc;
  @Autowired TestFaultProbe faultProbe;

  MockMvc mvc;

  @BeforeEach void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    faultProbe.fail = false;
  }

  @AfterEach void clearSecurity() {
    faultProbe.fail = false;
    SecurityContextHolder.clearContext();
  }

  @Test
  void createsExactlyOneEmptyAggregateAndReturnsStableDraftContract() throws Exception {
    Fixture fixture = fixture("create");
    String body = body(fixture.unit().getId(), WEEK);

    var created = mvc.perform(post("/api/organizations/{org}/staffing/plans",
            fixture.organization().getId()).header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "bootstrap-create").contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isCreated())
        .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
            org.hamcrest.Matchers.containsString("no-store")))
        .andExpect(jsonPath("$.data.organizationId").value(fixture.organization().getId().toString()))
        .andExpect(jsonPath("$.data.unitId").value(fixture.unit().getId().toString()))
        .andExpect(jsonPath("$.data.weekStart").value("2026-08-10"))
        .andExpect(jsonPath("$.data.timezone").value("Europe/Berlin"))
        .andExpect(jsonPath("$.data.status").value("ACTIVE"))
        .andExpect(jsonPath("$.data.draftRevision").value(0))
        .andExpect(jsonPath("$.data.created").value(true))
        .andExpect(jsonPath("$.data.idempotentReplay").value(false))
        .andExpect(jsonPath("$.data.capabilities.manage").value(true))
        .andReturn();
    String planId = jsonValue(created.getResponse().getContentAsString(), "planId");
    assertThat(created.getResponse().getHeader(HttpHeaders.ETAG))
        .isEqualTo("\"plan-" + planId + "-r0\"");
    assertThat(created.getResponse().getHeader(HttpHeaders.LOCATION))
        .endsWith("/staffing/plans/" + planId);
    assertThat(count("staffing_plans", fixture.organization().getId())).isEqualTo(1);
    assertThat(countByPlan("staffing_plan_days", planId)).isZero();
    assertThat(countByPlan("staffing_requirements", planId)).isZero();
    assertThat(countByPlan("staffing_assignments", planId)).isZero();
    assertThat(auditCount(planId)).isEqualTo(1);

    mvc.perform(get("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .param("unitId", fixture.unit().getId().toString()).param("weekStart", "2026-08-10")
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user())))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.found").value(true))
        .andExpect(jsonPath("$.data.plan.planId").value(planId));
  }

  @Test
  void replayAndExistingPlanAreExplicitWithoutChangingRevisionOrChildren() throws Exception {
    Fixture fixture = fixture("replay");
    String body = body(fixture.unit().getId(), WEEK);
    String first = mvc.perform(post("/api/organizations/{org}/staffing/plans",
            fixture.organization().getId()).header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "same-key").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isCreated()).andReturn().getResponse()
        .getContentAsString();
    String planId = jsonValue(first, "planId");

    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "same-key").contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isOk()).andExpect(header().string("Idempotent-Replay", "true"))
        .andExpect(jsonPath("$.data.planId").value(planId))
        .andExpect(jsonPath("$.data.created").value(true))
        .andExpect(jsonPath("$.data.idempotentReplay").value(true));

    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "new-key").contentType(MediaType.APPLICATION_JSON)
            .content(body))
        .andExpect(status().isOk()).andExpect(header().doesNotExist("Idempotent-Replay"))
        .andExpect(jsonPath("$.data.planId").value(planId))
        .andExpect(jsonPath("$.data.created").value(false))
        .andExpect(jsonPath("$.data.idempotentReplay").value(false));

    assertThat(count("staffing_plans", fixture.organization().getId())).isEqualTo(1);
    assertThat(countByPlan("staffing_plan_days", planId)).isZero();
    assertThat(revision(planId)).isZero();
    assertThat(auditCount(planId)).isEqualTo(1);
  }

  @Test
  void readLookupDoesNotCreateAndFirstDemandMutationCreatesOnlyItsNeededDay() throws Exception {
    Fixture fixture = fixture("flow");
    mvc.perform(get("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .param("unitId", fixture.unit().getId().toString()).param("weekStart", "2026-08-10")
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user())))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.found").value(false));
    assertThat(count("staffing_plans", fixture.organization().getId())).isZero();

    String response = mvc.perform(post("/api/organizations/{org}/staffing/plans",
            fixture.organization().getId()).header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "flow-create").contentType(MediaType.APPLICATION_JSON)
            .content(body(fixture.unit().getId(), WEEK)))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    String planId = jsonValue(response, "planId");
    UUID workType = workType(fixture);
    mvc.perform(post("/api/organizations/{org}/staffing/plans/{plan}/demand/requirements",
            fixture.organization().getId(), planId)
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header(HttpHeaders.IF_MATCH, "\"plan-" + planId + "-r0\"")
            .header("Idempotency-Key", "first-demand").contentType(MediaType.APPLICATION_JSON)
            .content("{\"date\":\"2026-08-11\",\"workTypeId\":\"" + workType
                + "\",\"requiredWorkers\":2}"))
        .andExpect(status().isCreated()).andExpect(header().string(HttpHeaders.ETAG,
            "\"plan-" + planId + "-r1\""));
    assertThat(countByPlan("staffing_plan_days", planId)).isEqualTo(1);
    assertThat(revision(planId)).isEqualTo(1);

    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "flow-existing").contentType(MediaType.APPLICATION_JSON)
            .content(body(fixture.unit().getId(), WEEK)))
        .andExpect(status().isOk()).andExpect(jsonPath("$.data.draftRevision").value(1));
    assertThat(countByPlan("staffing_plan_days", planId)).isEqualTo(1);
  }

  @Test
  void rejectsInvalidInputsAndIgnoresServerOwnedJsonFields() throws Exception {
    Fixture fixture = fixture("validation");
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .contentType(MediaType.APPLICATION_JSON).content(body(fixture.unit().getId(), WEEK)))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "bad-week").contentType(MediaType.APPLICATION_JSON)
            .content(body(fixture.unit().getId(), WEEK.plusDays(1))))
        .andExpect(status().isBadRequest());

    String withServerFields = "{\"unitId\":\"" + fixture.unit().getId()
        + "\",\"weekStart\":\"2026-08-10\",\"timezone\":\"Etc/Unknown\","
        + "\"status\":\"ARCHIVED\",\"draftRevision\":99,\"organizationId\":\""
        + UUID.randomUUID() + "\",\"createdBy\":\"attacker\"}";
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "server-fields").contentType(MediaType.APPLICATION_JSON)
            .content(withServerFields))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.timezone").value("Europe/Berlin"))
        .andExpect(jsonPath("$.data.status").value("ACTIVE"))
        .andExpect(jsonPath("$.data.draftRevision").value(0));
  }

  @Test
  void authorizationPrecedesExistenceAndReplayDisclosure() throws Exception {
    Fixture fixture = fixture("auth");
    String body = body(fixture.unit().getId(), WEEK);
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "private-key").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isCreated());

    UserAccount outsider = user("outsider-" + UUID.randomUUID() + "@example.com");
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(outsider))
            .header("Idempotency-Key", "private-key").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isNotFound());

    UserAccount employee = user("employee-" + UUID.randomUUID() + "@example.com");
    memberships.saveAndFlush(new OrganizationMembership(fixture.organization(), employee,
        MembershipRole.EMPLOYEE));
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(employee))
            .header("Idempotency-Key", "private-key").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isForbidden());

    UserAccount suspendedUser = user("suspended-" + UUID.randomUUID() + "@example.com");
    var suspended = new OrganizationMembership(fixture.organization(), suspendedUser,
        MembershipRole.EMPLOYEE);
    suspended.suspend();
    memberships.saveAndFlush(suspended);
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(suspendedUser))
            .header("Idempotency-Key", "private-key").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isNotFound());

    UserAccount invitedUser = user("invited-" + UUID.randomUUID() + "@example.com");
    var invited = memberships.saveAndFlush(new OrganizationMembership(fixture.organization(),
        invitedUser, MembershipRole.EMPLOYEE));
    jdbc.update("update organization_memberships set membership_status='INVITED' where id=?",
        invited.getId());
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(invitedUser))
            .header("Idempotency-Key", "private-key").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isNotFound());

    jdbc.update("update organization_units set active=false where id=?", fixture.unit().getId());
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "inactive").contentType(MediaType.APPLICATION_JSON)
            .content(body)).andExpect(status().isNotFound());
  }

  @Test
  void organizationScopedKeyCannotBeReusedForAnotherNaturalPlan() throws Exception {
    Fixture fixture = fixture("conflict");
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "one-org-key").contentType(MediaType.APPLICATION_JSON)
            .content(body(fixture.unit().getId(), WEEK)))
        .andExpect(status().isCreated());
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "one-org-key").contentType(MediaType.APPLICATION_JSON)
            .content(body(fixture.unit().getId(), WEEK.plusWeeks(1))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
    assertThat(count("staffing_plans", fixture.organization().getId())).isEqualTo(1);
  }

  @Test
  void concurrentIdenticalBootstrapCreatesOnePlanOneLedgerEntryAndOneAudit() throws Exception {
    Fixture fixture = fixture("concurrent");
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(() -> callService(fixture, "concurrent-key", WEEK, start));
      var second = executor.submit(() -> callService(fixture, "concurrent-key", WEEK, start));
      start.countDown();
      var left = first.get(20, TimeUnit.SECONDS);
      var right = second.get(20, TimeUnit.SECONDS);
      assertThat(left.response().planId()).isEqualTo(right.response().planId());
      assertThat(left.idempotentReplay() || right.idempotentReplay()).isTrue();
    }
    String planId = jdbc.queryForObject("select id::text from staffing_plans where organization_id=?",
        String.class, fixture.organization().getId());
    assertThat(count("staffing_plans", fixture.organization().getId())).isEqualTo(1);
    assertThat(ledgerCount(fixture.organization().getId())).isEqualTo(1);
    assertThat(auditCount(planId)).isEqualTo(1);
  }

  @Test
  void concurrentDifferentKeysCreateOnePlanAndCompleteBothOperations() throws Exception {
    Fixture fixture = fixture("concurrent-different-keys");
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(() -> callService(fixture, "concurrent-key-a", WEEK, start));
      var second = executor.submit(() -> callService(fixture, "concurrent-key-b", WEEK, start));
      start.countDown();
      var left = first.get(20, TimeUnit.SECONDS);
      var right = second.get(20, TimeUnit.SECONDS);
      assertThat(left.response().planId()).isEqualTo(right.response().planId());
      assertThat(java.util.List.of(left.response().created(), right.response().created()))
          .containsExactlyInAnyOrder(true, false);
      assertThat(left.idempotentReplay()).isFalse();
      assertThat(right.idempotentReplay()).isFalse();
    }
    String planId = jdbc.queryForObject("select id::text from staffing_plans where organization_id=?",
        String.class, fixture.organization().getId());
    assertThat(count("staffing_plans", fixture.organization().getId())).isEqualTo(1);
    assertThat(countByPlan("staffing_plan_days", planId)).isZero();
    assertThat(countByPlan("staffing_requirements", planId)).isZero();
    assertThat(countByPlan("staffing_assignments", planId)).isZero();
    assertThat(ledgerCount(fixture.organization().getId())).isEqualTo(2);
    assertThat(completedLedgerCount(fixture.organization().getId())).isEqualTo(2);
    assertThat(auditCount(planId)).isEqualTo(1);
  }

  @Test
  void existingPublishedPlanBootstrapPreservesDraftPublicationAndChildren() throws Exception {
    Fixture fixture = fixture("published-existing");
    String bootstrap = mvc.perform(post("/api/organizations/{org}/staffing/plans",
            fixture.organization().getId()).header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "published-create").contentType(MediaType.APPLICATION_JSON)
            .content(body(fixture.unit().getId(), WEEK)))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    String planId = jsonValue(bootstrap, "planId");
    UUID workType = workType(fixture);
    String demand = mvc.perform(post("/api/organizations/{org}/staffing/plans/{plan}/demand/requirements",
            fixture.organization().getId(), planId)
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header(HttpHeaders.IF_MATCH, "\"plan-" + planId + "-r0\"")
            .header("Idempotency-Key", "published-demand").contentType(MediaType.APPLICATION_JSON)
            .content("{\"date\":\"2026-08-11\",\"workTypeId\":\"" + workType
                + "\",\"requiredWorkers\":2}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    UUID requirementId = UUID.fromString(firstAffectedId(demand));

    authenticate(fixture.user());
    var review = coverage.calculate(fixture.organization().getId(), fixture.unit().getId(),
        UUID.fromString(planId));
    Set<String> acknowledgements = review.issues().stream()
        .filter(StaffingPlanCoverageService.PlanningIssue::acknowledgementRequired)
        .map(StaffingPlanCoverageService.PlanningIssue::issueKey)
        .collect(java.util.stream.Collectors.toSet());
    publication.publishPlan(new StaffingPlanPublicationService.PublishCommand(
        fixture.organization().getId(), fixture.unit().getId(), UUID.fromString(planId), 1,
        fixture.owner().getId(), acknowledgements, "Initial weekly plan", "published-v1"));
    SecurityContextHolder.clearContext();

    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
            "/api/organizations/{org}/staffing/plans/{plan}/demand/requirements/{requirement}",
            fixture.organization().getId(), planId, requirementId)
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header(HttpHeaders.IF_MATCH, "\"plan-" + planId + "-r1\"")
            .contentType(MediaType.APPLICATION_JSON).content("{\"requiredWorkers\":3}"))
        .andExpect(status().isOk()).andExpect(header().string(HttpHeaders.ETAG,
            "\"plan-" + planId + "-r2\""));

    Map<String, Object> before = aggregateState(planId);
    mvc.perform(post("/api/organizations/{org}/staffing/plans", fixture.organization().getId())
            .header(HttpHeaders.AUTHORIZATION, token(fixture.user()))
            .header("Idempotency-Key", "published-existing-key")
            .contentType(MediaType.APPLICATION_JSON).content(body(fixture.unit().getId(), WEEK)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.created").value(false))
        .andExpect(jsonPath("$.data.draftRevision").value(2));
    Map<String, Object> after = aggregateState(planId);

    assertThat(after).isEqualTo(before);
    assertThat(after.get("draft_revision")).isEqualTo(2L);
    assertThat(after.get("published_revision")).isEqualTo(1L);
    assertThat(after.get("latest_published_version_id")).isNotNull();
    assertThat(after.get("has_unpublished_changes")).isEqualTo(true);
    assertThat(after.get("days_count")).isEqualTo(1L);
    assertThat(after.get("requirements_count")).isEqualTo(1L);
    assertThat(after.get("assignments_count")).isEqualTo(0L);
  }

  @Test
  void failureRollsBackPlanLedgerAndAudit() {
    Fixture fixture = fixture("rollback");
    authenticate(fixture.user());
    faultProbe.fail = true;
    assertThatThrownBy(() -> service.create(fixture.organization().getId(), "rollback-key",
        new com.alveryn.api.staffing.dto.StaffingPlanBootstrapDtos.CreatePlanRequest(
            fixture.unit().getId(), WEEK)))
        .isInstanceOf(InjectedBootstrapFailure.class);
    assertThat(count("staffing_plans", fixture.organization().getId())).isZero();
    assertThat(ledgerCount(fixture.organization().getId())).isZero();
    assertThat(jdbc.queryForObject("select count(*) from staffing_change_events where organization_id=?",
        Integer.class, fixture.organization().getId())).isZero();
  }

  private com.alveryn.api.staffing.dto.StaffingPlanBootstrapDtos.BootstrapResult callService(
      Fixture fixture, String key, LocalDate week, CountDownLatch start) {
    try {
      start.await(10, TimeUnit.SECONDS);
      authenticate(fixture.user());
      return service.create(fixture.organization().getId(), key,
          new com.alveryn.api.staffing.dto.StaffingPlanBootstrapDtos.CreatePlanRequest(
              fixture.unit().getId(), week));
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(exception);
    } finally {
      SecurityContextHolder.clearContext();
    }
  }

  private Fixture fixture(String label) {
    UserAccount ownerUser = user(label + "-" + UUID.randomUUID() + "@example.com");
    Organization organization = organizations.saveAndFlush(
        new Organization("Bootstrap " + label, "Europe/Berlin"));
    OrganizationMembership owner = memberships.saveAndFlush(
        new OrganizationMembership(organization, ownerUser, MembershipRole.OWNER));
    OrganizationUnit unit = units.saveAndFlush(new OrganizationUnit(organization, null,
        "Hotel " + label, OrganizationUnitType.LOCATION, CheckInMode.OPTIONAL, 0));
    return new Fixture(ownerUser, organization, owner, unit);
  }

  private UserAccount user(String email) {
    UserAccount value = new UserAccount(email, "hash");
    value.verifyEmail();
    return users.saveAndFlush(value);
  }

  private UUID workType(Fixture fixture) {
    UUID id = UUID.randomUUID();
    jdbc.update("""
        insert into organization_work_types(id,organization_id,unit_id,code,name,color,
          default_start_time,default_end_time,default_break_minutes,active,calculation_method,
          compensation_method,teamwork_enabled,extra_pay_enabled,composite_enabled,display_order,
          created_at,updated_at)
        values(?,?,?,'ROOM','Room cleaning','#10B981','09:00','16:30',30,true,'TIME_BASED',
          'HOURLY',false,false,false,0,current_timestamp,current_timestamp)
        """, id, fixture.organization().getId(), fixture.unit().getId());
    return id;
  }

  private void authenticate(UserAccount user) {
    var principal = new AuthenticatedUser(user.getId(), user.getEmail(), true,
        UserStatus.ACTIVE, UserRole.USER);
    SecurityContextHolder.getContext().setAuthentication(
        UsernamePasswordAuthenticationToken.authenticated(principal, "",
            principal.getAuthorities()));
  }

  private String token(UserAccount user) {
    return "Bearer " + jwt.generateAccessToken(user);
  }

  private String body(UUID unitId, LocalDate weekStart) {
    return "{\"unitId\":\"" + unitId + "\",\"weekStart\":\"" + weekStart + "\"}";
  }

  private int count(String table, UUID organizationId) {
    return jdbc.queryForObject("select count(*) from " + table + " where organization_id=?",
        Integer.class, organizationId);
  }

  private int countByPlan(String table, String planId) {
    if (table.equals("staffing_assignments")) {
      return jdbc.queryForObject("""
          select count(*) from staffing_assignments a join staffing_requirements r
            on r.id=a.requirement_id where r.plan_day_id in
            (select id from staffing_plan_days where plan_id=?::uuid)
          """, Integer.class, planId);
    }
    return jdbc.queryForObject("select count(*) from " + table + " where "
        + (table.equals("staffing_requirements") ? "plan_day_id in "
            + "(select id from staffing_plan_days where plan_id=?::uuid)" : "plan_id=?::uuid"),
        Integer.class, planId);
  }

  private int ledgerCount(UUID organizationId) {
    return jdbc.queryForObject("""
        select count(*) from staffing_plan_draft_mutation_operations
        where organization_id=? and operation_family='PLAN_CREATE'
        """, Integer.class, organizationId);
  }

  private int completedLedgerCount(UUID organizationId) {
    return jdbc.queryForObject("""
        select count(*) from staffing_plan_draft_mutation_operations
        where organization_id=? and operation_family='PLAN_CREATE'
          and operation_status='COMPLETED'
        """, Integer.class, organizationId);
  }

  private Map<String, Object> aggregateState(String planId) {
    Map<String, Object> state = new LinkedHashMap<>();
    state.putAll(jdbc.queryForMap("""
        select p.draft_revision,p.published_revision,p.latest_published_version_id,
          (p.latest_published_version_id is null or p.draft_revision > p.published_revision)
            as has_unpublished_changes,
          v.version_number,v.checksum
        from staffing_plans p
        left join staffing_plan_versions v on v.id=p.latest_published_version_id
        where p.id=?::uuid
        """, planId));
    state.put("days_count", jdbc.queryForObject(
        "select count(*) from staffing_plan_days where plan_id=?::uuid", Long.class, planId));
    state.put("requirements_count", jdbc.queryForObject("""
        select count(*) from staffing_requirements where plan_day_id in
          (select id from staffing_plan_days where plan_id=?::uuid)
        """, Long.class, planId));
    state.put("assignments_count", jdbc.queryForObject("""
        select count(*) from staffing_assignments a join staffing_requirements r
          on r.id=a.requirement_id where r.plan_day_id in
          (select id from staffing_plan_days where plan_id=?::uuid)
        """, Long.class, planId));
    return state;
  }

  private int auditCount(String planId) {
    return jdbc.queryForObject("""
        select count(*) from staffing_change_events
        where entity_id=?::uuid and event_type='WEEKLY_PLAN_CREATED'
        """, Integer.class, planId);
  }

  private long revision(String planId) {
    return jdbc.queryForObject("select draft_revision from staffing_plans where id=?::uuid",
        Long.class, planId);
  }

  private String jsonValue(String json, String field) {
    String marker = "\"" + field + "\":\"";
    int start = json.indexOf(marker) + marker.length();
    return json.substring(start, json.indexOf('"', start));
  }

  private String firstAffectedId(String json) {
    String marker = "\"affectedResourceIds\":[\"";
    int start = json.indexOf(marker) + marker.length();
    return json.substring(start, json.indexOf('"', start));
  }

  private record Fixture(UserAccount user, Organization organization,
      OrganizationMembership owner, OrganizationUnit unit) {}

  static class InjectedBootstrapFailure extends RuntimeException {}

  @TestConfiguration
  static class FaultConfiguration {
    @Bean @Primary TestFaultProbe testFaultProbe() { return new TestFaultProbe(); }
  }

  static class TestFaultProbe implements StaffingPlanBootstrapFaultProbe {
    volatile boolean fail;
    @Override public void afterPlanCreated() {
      if (fail) throw new InjectedBootstrapFailure();
    }
  }
}
