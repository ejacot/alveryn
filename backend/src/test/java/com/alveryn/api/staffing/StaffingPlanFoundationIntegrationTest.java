package com.alveryn.api.staffing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.NotFoundException;
import com.alveryn.api.organization.entity.CheckInMode;
import com.alveryn.api.organization.entity.MembershipRole;
import com.alveryn.api.organization.entity.Organization;
import com.alveryn.api.organization.entity.OrganizationMembership;
import com.alveryn.api.organization.entity.OrganizationUnit;
import com.alveryn.api.organization.entity.OrganizationUnitType;
import com.alveryn.api.organization.repository.OrganizationMembershipRepository;
import com.alveryn.api.organization.repository.OrganizationRepository;
import com.alveryn.api.organization.repository.OrganizationUnitRepository;
import com.alveryn.api.staffing.entity.StaffingPlanDaySource;
import com.alveryn.api.staffing.repository.StaffingPlanDayRepository;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import com.alveryn.api.staffing.repository.StaffingPlanVersionRepository;
import com.alveryn.api.staffing.service.StaffingPlanFoundationService;
import com.alveryn.api.user.entity.UserAccount;
import com.alveryn.api.user.repository.UserAccountRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.repository.CrudRepository;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class StaffingPlanFoundationIntegrationTest {
  private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 10);

  @Autowired StaffingPlanFoundationService service;
  @Autowired StaffingPlanRepository plans;
  @Autowired StaffingPlanDayRepository days;
  @Autowired StaffingPlanVersionRepository versions;
  @Autowired OrganizationRepository organizations;
  @Autowired OrganizationUnitRepository units;
  @Autowired OrganizationMembershipRepository memberships;
  @Autowired UserAccountRepository users;
  @Autowired JdbcTemplate jdbc;
  @Autowired EntityManager entityManager;

  @Test
  void planScopeIsUniquePerBusinessUnitAndWeek() {
    var first = business("First Business", "first-plan-owner@example.com");
    var firstUnit = unit(first.organization(), "Hotel Munich");
    var secondUnit = unit(first.organization(), "Hotel Augsburg");
    var second = business("Second Business", "second-plan-owner@example.com");
    var otherBusinessUnit = unit(second.organization(), "Hotel Munich");

    var created = service.getOrCreate(
        first.organization().getId(), firstUnit.getId(), WEEK_START, first.owner().getId());
    var repeated = service.getOrCreate(
        first.organization().getId(), firstUnit.getId(), WEEK_START, first.owner().getId());
    var otherUnit = service.getOrCreate(
        first.organization().getId(), secondUnit.getId(), WEEK_START, first.owner().getId());
    var otherBusiness = service.getOrCreate(
        second.organization().getId(), otherBusinessUnit.getId(), WEEK_START, second.owner().getId());

    assertThat(repeated.getId()).isEqualTo(created.getId());
    assertThat(otherUnit.getId()).isNotEqualTo(created.getId());
    assertThat(otherBusiness.getId()).isNotEqualTo(created.getId());
    assertThat(plans.findByOrganizationIdAndUnitIdAndWeekStart(
        first.organization().getId(), firstUnit.getId(), WEEK_START)).contains(created);
  }

  @Test
  void planAndDayRejectInvalidDatesDuplicatesAndCrossTenantAccess() {
    var first = business("Scoped Business", "scoped-plan-owner@example.com");
    var unit = unit(first.organization(), "Scoped Unit");
    var siblingUnit = unit(first.organization(), "Sibling Unit");
    var second = business("Other Business", "other-plan-owner@example.com");
    var otherUnit = unit(second.organization(), "Other Unit");

    assertThatThrownBy(() -> service.getOrCreate(
        first.organization().getId(), unit.getId(), WEEK_START.plusDays(1), first.owner().getId()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Monday");
    assertThatThrownBy(() -> service.getOrCreate(
        first.organization().getId(), otherUnit.getId(), WEEK_START, first.owner().getId()))
        .isInstanceOf(NotFoundException.class);

    var plan = service.getOrCreate(
        first.organization().getId(), unit.getId(), WEEK_START, first.owner().getId());
    var day = service.createDay(
        first.organization().getId(), unit.getId(), plan.getId(), WEEK_START, 50,
        "Demo context", StaffingPlanDaySource.MANUAL, first.owner().getId());
    var sunday = service.createDay(
        first.organization().getId(), unit.getId(), plan.getId(), WEEK_START.plusDays(6), null,
        null, StaffingPlanDaySource.MANUAL, first.owner().getId());

    assertThat(day.getOrganization().getId()).isEqualTo(first.organization().getId());
    assertThat(day.getRoomsContext()).isEqualTo(50);
    assertThat(days.findAllByPlanIdAndOrganizationIdOrderByDateAsc(
        plan.getId(), first.organization().getId())).containsExactly(day, sunday);
    assertThat(plan.getDraftRevision()).isEqualTo(2);
    assertThatThrownBy(() -> service.createDay(
        first.organization().getId(), unit.getId(), plan.getId(), WEEK_START, null,
        null, StaffingPlanDaySource.TEMPLATE, first.owner().getId()))
        .isInstanceOf(ConflictException.class);
    assertThatThrownBy(() -> service.createDay(
        first.organization().getId(), unit.getId(), plan.getId(), WEEK_START.minusDays(1), null,
        null, StaffingPlanDaySource.MANUAL, first.owner().getId()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("plan week");
    assertThatThrownBy(() -> service.createDay(
        first.organization().getId(), unit.getId(), plan.getId(), WEEK_START.plusDays(7), null,
        null, StaffingPlanDaySource.MANUAL, first.owner().getId()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("plan week");
    assertThatThrownBy(() -> service.getScoped(
        second.organization().getId(), otherUnit.getId(), plan.getId()))
        .isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.getScoped(
        first.organization().getId(), siblingUnit.getId(), plan.getId()))
        .isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service.createDay(
        first.organization().getId(), unit.getId(), plan.getId(), WEEK_START.plusDays(1), null,
        null, StaffingPlanDaySource.MANUAL, second.owner().getId()))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void immutableVersionReadsRequireOrganizationUnitAndPlanScope() {
    var first = business("Version Business", "version-plan-owner@example.com");
    var unit = unit(first.organization(), "Version Unit");
    var siblingUnit = unit(first.organization(), "Sibling Version Unit");
    var second = business("Other Version Business", "other-version-owner@example.com");
    var plan = service.getOrCreate(
        first.organization().getId(), unit.getId(), WEEK_START, first.owner().getId());
    UUID versionId = UUID.randomUUID();

    jdbc.update(
        """
        insert into staffing_plan_versions (
          id, organization_id, unit_id, plan_id, version_number, source_draft_revision,
          published_at, timezone, week_start, coverage_required, coverage_assigned,
          coverage_percentage, coverage_basis, warning_count, checksum, publication_kind,
          source_draft_complete, publication_note
        ) values (?, ?, ?, ?, 1, 0, current_timestamp, 'Europe/Berlin', ?, 0, 0,
          0, 'LEGACY_V90', 0, ?, 'LEGACY_PARTIAL', false, 'Scoped read fixture')
        """,
        versionId, first.organization().getId(), unit.getId(), plan.getId(), WEEK_START,
        "0".repeat(64));
    jdbc.update(
        "update staffing_plans set latest_published_version_id = ?, "
            + "published_revision = 0, published_at = current_timestamp where id = ?",
        versionId, plan.getId());
    entityManager.clear();

    assertThat(versions.findByOrganizationIdAndUnitIdAndPlanIdAndVersionNumber(
        first.organization().getId(), unit.getId(), plan.getId(), 1))
            .map(version -> version.getId())
            .contains(versionId);
    assertThat(versions.findByOrganizationIdAndUnitIdAndPlanIdAndVersionNumber(
        first.organization().getId(), siblingUnit.getId(), plan.getId(), 1)).isEmpty();
    assertThat(versions.findByOrganizationIdAndUnitIdAndPlanIdAndVersionNumber(
        second.organization().getId(), unit.getId(), plan.getId(), 1)).isEmpty();
    assertThat(service.getScoped(first.organization().getId(), unit.getId(), plan.getId())
        .hasUnpublishedChanges()).isTrue();

    jdbc.update("update staffing_plan_versions set source_draft_complete = true where id = ?",
        versionId);
    entityManager.clear();
    assertThat(service.getScoped(first.organization().getId(), unit.getId(), plan.getId())
        .hasUnpublishedChanges()).isFalse();
  }

  @Test
  void immutableVersionRepositoryExposesReadOnlyScopedQueries() {
    assertThat(CrudRepository.class.isAssignableFrom(StaffingPlanVersionRepository.class)).isFalse();
    assertThat(java.util.Arrays.stream(StaffingPlanVersionRepository.class.getDeclaredMethods())
        .map(java.lang.reflect.Method::getName))
            .allMatch(name -> name.startsWith("find"))
            .noneMatch(name -> name.startsWith("save") || name.startsWith("delete"));
  }

  private BusinessFixture business(String name, String email) {
    var user = new UserAccount(email, "hash");
    user.verifyEmail();
    user = users.saveAndFlush(user);
    var organization = organizations.saveAndFlush(new Organization(name, "Europe/Berlin"));
    var owner = memberships.saveAndFlush(
        new OrganizationMembership(organization, user, MembershipRole.OWNER));
    return new BusinessFixture(organization, owner);
  }

  private OrganizationUnit unit(Organization organization, String name) {
    return units.saveAndFlush(new OrganizationUnit(
        organization, null, name, OrganizationUnitType.LOCATION, CheckInMode.OPTIONAL, 0));
  }

  private record BusinessFixture(
      Organization organization, OrganizationMembership owner) {}
}
