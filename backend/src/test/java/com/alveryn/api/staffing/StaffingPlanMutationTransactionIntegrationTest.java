package com.alveryn.api.staffing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alveryn.api.auth.security.AuthenticatedUser;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.organization.service.BusinessOrganizationService;
import com.alveryn.api.staffing.dto.StaffingDtos.RequirementRequest;
import com.alveryn.api.staffing.dto.StaffingDtos.BulkRequirementRequest;
import com.alveryn.api.staffing.entity.StaffingPlanDaySource;
import com.alveryn.api.staffing.service.*;
import com.alveryn.api.user.entity.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.Set;
import java.util.concurrent.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@SpringBootTest
@Import(StaffingPlanMutationTransactionIntegrationTest.FaultConfiguration.class)
class StaffingPlanMutationTransactionIntegrationTest {
  private static final LocalDate WEEK = LocalDate.of(2026, 8, 10);

  @Autowired StaffingPlannerService planner;
  @Autowired StaffingPlanFoundationService foundation;
  @Autowired BusinessOrganizationService organizationsService;
  @Autowired OrganizationRepository organizations;
  @Autowired OrganizationUnitRepository units;
  @Autowired OrganizationMembershipRepository memberships;
  @Autowired UserAccountRepository users;
  @Autowired JdbcTemplate jdbc;
  @Autowired TestMutationFaultProbe faultProbe;

  @AfterEach void cleanContext() {
    faultProbe.fail = false;
    SecurityContextHolder.clearContext();
  }

  @Test void plannerMutationRollsBackPlanDayRequirementAndRevisionTogether() {
    Fixture fixture = fixture("planner-rollback");
    UUID workTypeId = workType(fixture);
    faultProbe.fail = true;

    assertThatThrownBy(() -> planner.createRequirement(fixture.organizationId(),
        new RequirementRequest(fixture.unitId(), workTypeId, WEEK, null, null, 1,
            BigDecimal.ONE, "must roll back")))
        .isInstanceOf(InjectedMutationFailure.class);

    assertThat(jdbc.queryForObject("select count(*) from staffing_plans where organization_id=?",
        Integer.class, fixture.organizationId())).isZero();
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_days where organization_id=?",
        Integer.class, fixture.organizationId())).isZero();
    assertThat(jdbc.queryForObject("select count(*) from staffing_requirements where organization_id=?",
        Integer.class, fixture.organizationId())).isZero();
  }

  @Test void organizationMutationRollsBackMembershipAndPlanRevisionTogether() {
    Fixture fixture = fixture("member-rollback");
    var plan = foundation.getOrCreate(fixture.organizationId(), fixture.unitId(), WEEK,
        fixture.owner().getId());
    var day = foundation.createDay(fixture.organizationId(), fixture.unitId(), plan.getId(), WEEK,
        20, null, StaffingPlanDaySource.MANUAL, fixture.owner().getId());
    UUID workTypeId = workType(fixture);
    UUID requirementId = UUID.randomUUID();
    jdbc.update("""
        insert into staffing_requirements(id,organization_id,unit_id,work_type_id,work_date,
          start_time,end_time,required_workers,publication_status,created_by_membership_id,
          plan_day_id,created_at,updated_at)
        values(?,?,?,?,?,'09:00','16:30',1,'DRAFT',?,?,current_timestamp,current_timestamp)
        """, requirementId, fixture.organizationId(), fixture.unitId(), workTypeId, WEEK,
        fixture.owner().getId(), day.getId());
    var employeeUser = user("employee-" + UUID.randomUUID() + "@example.com");
    var employee = memberships.saveAndFlush(new OrganizationMembership(
        fixture.organization(), employeeUser, MembershipRole.EMPLOYEE));
    jdbc.update("""
        insert into staffing_assignments(id,requirement_id,membership_id,assignment_status,
          assigned_by_membership_id,created_at,updated_at)
        values(?,?,?,'ASSIGNED',?,current_timestamp,current_timestamp)
        """, UUID.randomUUID(), requirementId, employee.getId(), fixture.owner().getId());
    long revision = jdbc.queryForObject("select draft_revision from staffing_plans where id=?",
        Long.class, plan.getId());
    faultProbe.fail = true;

    assertThatThrownBy(() -> organizationsService.suspendMember(
        fixture.organizationId(), employee.getId()))
        .isInstanceOf(InjectedMutationFailure.class);

    assertThat(jdbc.queryForObject(
        "select membership_status from organization_memberships where id=?", String.class,
        employee.getId())).isEqualTo("ACTIVE");
    assertThat(jdbc.queryForObject("select draft_revision from staffing_plans where id=?",
        Long.class, plan.getId())).isEqualTo(revision);
  }

  @Test void concurrentFirstCreateAndBulkCreateShareOnePlanAndPlanDay() throws Exception {
    Fixture fixture = fixture("first-plan-race");
    UUID workTypeId = workType(fixture);
    var single = new RequirementRequest(fixture.unitId(), workTypeId, WEEK, null, null, 1,
        BigDecimal.ONE, "single");
    var bulk = new BulkRequirementRequest(fixture.unitId(), workTypeId, Set.of(WEEK), null, null,
        1, BigDecimal.ONE, "bulk");
    ExecutorService executor = Executors.newFixedThreadPool(2);
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    try {
      Future<?> first = executor.submit(() -> {
        authenticate(fixture.owner().getUser());
        ready.countDown();
        await(start);
        try { return planner.createRequirement(fixture.organizationId(), single); }
        finally { SecurityContextHolder.clearContext(); }
      });
      Future<?> second = executor.submit(() -> {
        authenticate(fixture.owner().getUser());
        ready.countDown();
        await(start);
        try { return planner.createRequirements(fixture.organizationId(), bulk); }
        finally { SecurityContextHolder.clearContext(); }
      });
      assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      first.get(20, TimeUnit.SECONDS);
      second.get(20, TimeUnit.SECONDS);
    } finally {
      start.countDown();
      executor.shutdownNow();
    }

    assertThat(jdbc.queryForObject("select count(*) from staffing_plans where organization_id=?",
        Integer.class, fixture.organizationId())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_days where organization_id=?",
        Integer.class, fixture.organizationId())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from staffing_requirements where organization_id=?",
        Integer.class, fixture.organizationId())).isEqualTo(2);
    assertThat(jdbc.queryForObject("""
        select count(*) from staffing_requirements
        where organization_id=? and plan_day_id is null
        """, Integer.class, fixture.organizationId())).isZero();
    assertThat(jdbc.queryForObject("""
        select count(distinct plan_day_id) from staffing_requirements where organization_id=?
        """, Integer.class, fixture.organizationId())).isEqualTo(1);
  }

  private Fixture fixture(String label) {
    var ownerUser = user(label + "-" + UUID.randomUUID() + "@example.com");
    var organization = organizations.saveAndFlush(
        new Organization("Business " + label, "Europe/Berlin"));
    var owner = memberships.saveAndFlush(
        new OrganizationMembership(organization, ownerUser, MembershipRole.OWNER));
    var unit = units.saveAndFlush(new OrganizationUnit(organization, null, "Hotel " + label,
        OrganizationUnitType.LOCATION, CheckInMode.OPTIONAL, 0));
    authenticate(ownerUser);
    return new Fixture(organization, owner, unit.getId());
  }

  private UserAccount user(String email) {
    var user = new UserAccount(email, "hash");
    user.verifyEmail();
    return users.saveAndFlush(user);
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
        """, id, fixture.organizationId(), fixture.unitId());
    return id;
  }

  private void authenticate(UserAccount user) {
    var principal = new AuthenticatedUser(user.getId(), user.getEmail(), true,
        UserStatus.ACTIVE, UserRole.USER);
    SecurityContextHolder.getContext().setAuthentication(
        UsernamePasswordAuthenticationToken.authenticated(principal, "", principal.getAuthorities()));
  }

  private static void await(CountDownLatch latch) {
    try {
      if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("latch timed out");
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("interrupted while awaiting test latch", exception);
    }
  }

  record Fixture(Organization organization, OrganizationMembership owner, UUID unitId) {
    UUID organizationId() { return organization.getId(); }
  }

  static class InjectedMutationFailure extends RuntimeException {}

  @TestConfiguration
  static class FaultConfiguration {
    @Bean @Primary TestMutationFaultProbe testMutationFaultProbe() {
      return new TestMutationFaultProbe();
    }
  }

  static class TestMutationFaultProbe implements StaffingPlanMutationFaultProbe {
    volatile boolean fail;
    @Override public void afterChildMutation() {
      if (fail) throw new InjectedMutationFailure();
    }
  }
}
