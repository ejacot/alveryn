package com.alveryn.api.staffing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alveryn.api.auth.security.AuthenticatedUser;
import com.alveryn.api.common.exception.ConflictException;
import com.alveryn.api.common.exception.PreconditionFailedException;
import com.alveryn.api.common.exception.ValidationException;
import com.alveryn.api.organization.entity.*;
import com.alveryn.api.organization.repository.*;
import com.alveryn.api.staffing.entity.StaffingPlanDaySource;
import com.alveryn.api.staffing.repository.StaffingPlanRepository;
import com.alveryn.api.staffing.service.StaffingPlanFoundationService;
import com.alveryn.api.staffing.service.StaffingPlanPublicationService;
import com.alveryn.api.staffing.service.StaffingPlanPublicationService.PublishCommand;
import com.alveryn.api.staffing.service.StaffingPlanPublicationFaultProbe;
import com.alveryn.api.user.entity.*;
import com.alveryn.api.user.repository.UserAccountRepository;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.context.annotation.*;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.access.AccessDeniedException;
import com.alveryn.api.common.exception.NotFoundException;
import java.util.concurrent.*;
import jakarta.persistence.EntityManager;

@SpringBootTest
@Import(StaffingPlanPublicationIntegrationTest.FaultConfiguration.class)
class StaffingPlanPublicationIntegrationTest {
  private static final LocalDate WEEK = LocalDate.of(2026, 8, 10);
  @Autowired StaffingPlanPublicationService publication;
  @Autowired StaffingPlanFoundationService foundation;
  @Autowired StaffingPlanRepository plans;
  @Autowired OrganizationRepository organizations;
  @Autowired OrganizationUnitRepository units;
  @Autowired OrganizationMembershipRepository memberships;
  @Autowired UserAccountRepository users;
  @Autowired JdbcTemplate jdbc;
  @Autowired EntityManager entityManager;
  @Autowired TestFaultProbe faultProbe;

  @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }

  @Test void publishesReplaysAndKeepsEarlierVersionImmutable() {
    Fixture fixture = fixture("atomic");
    UUID requirementId = requirement(fixture);
    long revision = fixture.planRevision();
    var command = command(fixture, revision, Set.of("UNDERCOVERAGE:" + requirementId), "first", "key-1");
    var first = publication.publishPlan(command);
    var replay = publication.publishPlan(command);
    assertThat(first.versionNumber()).isEqualTo(1);
    assertThat(first.publicationKind()).isEqualTo("ATOMIC_WEEKLY");
    assertThat(first.legacyCoverage().assigned()).isZero();
    assertThat(replay.versionId()).isEqualTo(first.versionId());
    assertThat(replay.idempotentReplay()).isTrue();
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?", Integer.class,
        fixture.planId())).isEqualTo(1);

    String checksum = first.checksum();
    var plan = plans.findByIdAndOrganizationIdAndUnitId(fixture.planId(), fixture.organizationId(),
        fixture.unitId()).orElseThrow();
    plan.markDraftChanged(fixture.owner());
    plans.saveAndFlush(plan);
    var second = publication.publishPlan(command(fixture, revision + 1,
        Set.of("UNDERCOVERAGE:" + requirementId), "second", "key-2"));
    assertThat(second.versionNumber()).isEqualTo(2);
    assertThat(jdbc.queryForObject("select checksum from staffing_plan_versions where plan_id=? and version_number=1",
        String.class, fixture.planId())).isEqualTo(checksum);
    assertThatThrownBy(() -> publication.publishPlan(command(fixture, revision,
        Set.of("UNDERCOVERAGE:" + requirementId), "stale", "key-3")))
        .isInstanceOf(PreconditionFailedException.class);
  }

  @Test void firstAtomicPublicationAfterLegacyPartialBecomesVersionTwo() {
    Fixture fixture = fixture("legacy-partial");
    UUID requirementId = requirement(fixture);
    UUID legacyVersionId = UUID.randomUUID();
    jdbc.update("""
        insert into staffing_plan_versions(
          id,organization_id,unit_id,plan_id,version_number,source_draft_revision,
          published_at,timezone,week_start,coverage_required,coverage_assigned,
          coverage_percentage,coverage_basis,warning_count,checksum,publication_kind,
          source_draft_complete,created_at)
        values(?,?,?,?,1,?,current_timestamp,'Europe/Berlin',?,1,0,0,'LEGACY_V90',1,?,
          'LEGACY_PARTIAL',false,current_timestamp)
        """, legacyVersionId, fixture.organizationId(), fixture.unitId(), fixture.planId(),
        fixture.planRevision(), WEEK, "a".repeat(64));
    jdbc.update("""
        update staffing_plans set latest_published_version_id=?,published_revision=?,
          published_at=current_timestamp where id=?
        """, legacyVersionId, fixture.planRevision(), fixture.planId());
    entityManager.clear();

    var result = publication.publishPlan(command(fixture, fixture.planRevision(),
        Set.of("UNDERCOVERAGE:" + requirementId), null, "after-legacy"));

    assertThat(result.versionNumber()).isEqualTo(2);
    assertThat(result.publicationKind()).isEqualTo("ATOMIC_WEEKLY");
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?",
        Integer.class, fixture.planId())).isEqualTo(2);
    assertThat(jdbc.queryForList("""
        select publication_kind from staffing_plan_versions where plan_id=? order by version_number
        """, String.class, fixture.planId())).containsExactly("LEGACY_PARTIAL", "ATOMIC_WEEKLY");
  }

  @Test void invitedAssignmentIsSnapshottedButDoesNotCount() {
    Fixture fixture = fixture("invited");
    UUID requirementId = requirement(fixture);
    var invited = memberships.saveAndFlush(new OrganizationMembership(fixture.organization(), "Invited",
        "Worker", "invite-" + UUID.randomUUID() + "@example.com"));
    var activeUser = new UserAccount("active-" + UUID.randomUUID() + "@example.com", "hash");
    activeUser.verifyEmail();
    users.saveAndFlush(activeUser);
    var active = memberships.saveAndFlush(new OrganizationMembership(
        fixture.organization(), activeUser, MembershipRole.EMPLOYEE));
    UUID assignmentId = UUID.randomUUID();
    jdbc.update("insert into staffing_assignments(id,requirement_id,membership_id,assignment_status,assigned_by_membership_id,created_at,updated_at) values(?,?,?,'ASSIGNED',?,current_timestamp,current_timestamp)",
        assignmentId, requirementId, invited.getId(), fixture.owner().getId());
    jdbc.update("insert into staffing_assignments(id,requirement_id,membership_id,assignment_status,assigned_by_membership_id,created_at,updated_at) values(?,?,?,'ASSIGNED',?,current_timestamp,current_timestamp)",
        UUID.randomUUID(), requirementId, active.getId(), fixture.owner().getId());
    var result = publication.publishPlan(command(fixture, fixture.planRevision(), Set.of(
        "INVITATION_PENDING:" + assignmentId), null, "invite-key"));
    assertThat(result.legacyCoverage().assigned()).isEqualTo(1);
    assertThat(result.legacyCoverage().percentage()).isEqualByComparingTo("100.00");
    assertThat(jdbc.queryForObject("select membership_status_snapshot from staffing_plan_version_assignments where version_id=? and organization_membership_id=?",
        String.class, result.versionId(), invited.getId())).isEqualTo("INVITED");
  }

  @Test void warningsRequireAcknowledgementAndFailuresRollbackOperation() {
    Fixture fixture = fixture("warnings");
    UUID requirementId = requirement(fixture);
    assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(), Set.of(), null,
        "warning-key"))).isInstanceOf(ConflictException.class).hasMessageContaining("acknowledged");
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_publication_operations where plan_id=?",
        Integer.class, fixture.planId())).isZero();
    var original = command(fixture, fixture.planRevision(), Set.of("UNDERCOVERAGE:" + requirementId),
        null, "warning-key");
    publication.publishPlan(original);
    assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(),
        Set.of("UNDERCOVERAGE:" + requirementId), "different", "warning-key")))
        .isInstanceOf(ConflictException.class).hasMessageContaining("another request");
  }

  @Test void acknowledgementsMustMatchEveryCurrentWarningAndNeverAcknowledgeBlockers() {
    Fixture fixture = fixture("acknowledgements");
    UUID firstRequirement = requirement(fixture);
    UUID secondRequirement = additionalRequirement(fixture, firstRequirement, fixture.planDayId(), WEEK);
    String firstWarning = "UNDERCOVERAGE:" + firstRequirement;
    String secondWarning = "UNDERCOVERAGE:" + secondRequirement;

    assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(),
        Set.of("UNDERCOVERAGE:" + UUID.randomUUID()), null, "unknown-warning")))
        .isInstanceOf(ValidationException.class).hasMessageContaining("current review");
    assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(),
        Set.of(firstWarning), null, "incomplete-warnings")))
        .isInstanceOfSatisfying(ConflictException.class,
            exception -> assertThat(exception.getErrors()).containsExactly(secondWarning));

    var result = publication.publishPlan(command(fixture, fixture.planRevision(),
        Set.of(firstWarning, secondWarning), null, "complete-warnings"));
    assertThat(jdbc.queryForList("""
        select issue_key from staffing_plan_version_acknowledgements
        where version_id=? order by issue_key
        """, String.class, result.versionId())).containsExactlyInAnyOrder(firstWarning, secondWarning);

    Fixture blocker = fixture("acknowledge-blocker");
    UUID blockerRequirement = requirement(blocker);
    jdbc.update("""
        update organization_work_types set active=false
        where id=(select work_type_id from staffing_requirements where id=?)
        """, blockerRequirement);
    assertThatThrownBy(() -> publication.publishPlan(command(blocker, blocker.planRevision(),
        Set.of("INACTIVE_WORK_TYPE:" + blockerRequirement), null, "blocker-as-warning")))
        .isInstanceOf(ConflictException.class).hasMessageContaining("blocking");
    assertThat(jdbc.queryForObject("""
        select count(*) from staffing_plan_version_acknowledgements acknowledgement
        join staffing_plan_versions version on version.id=acknowledgement.version_id
        where version.plan_id=?
        """, Integer.class, blocker.planId())).isZero();
  }

  @Test void warningThatDisappearedBeforePublicationCannotBeAcknowledged() {
    Fixture fixture = fixture("disappeared-warning");
    UUID requirementId = requirement(fixture);
    OrganizationMembership worker = activeEmployee(fixture, "warning-resolved");
    assignment(fixture, requirementId, worker);

    assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(),
        Set.of("UNDERCOVERAGE:" + requirementId), null, "stale-warning")))
        .isInstanceOf(ValidationException.class).hasMessageContaining("current review");
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?",
        Integer.class, fixture.planId())).isZero();
  }

  @Test void blockerLeavesNoVersionOrOperation() {
    Fixture fixture = fixture("blocker");
    UUID requirementId = requirement(fixture);
    jdbc.update("update organization_work_types set active=false where id=(select work_type_id from staffing_requirements where id=?)",
        requirementId);
    assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(), Set.of(), null,
        "blocked-key"))).isInstanceOf(ConflictException.class).hasMessageContaining("blocking");
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?", Integer.class,
        fixture.planId())).isZero();
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_publication_operations where plan_id=?",
        Integer.class, fixture.planId())).isZero();
  }

  @Test void failuresAfterEachSnapshotBoundaryRollbackEverything() {
    for (var stage : StaffingPlanPublicationFaultProbe.Stage.values()) {
      Fixture fixture = fixture("rollback-" + stage);
      UUID requirementId = requirement(fixture);
      faultProbe.failAt = stage;
      assertThatThrownBy(() -> publication.publishPlan(command(fixture, fixture.planRevision(),
          Set.of("UNDERCOVERAGE:" + requirementId), null, "rollback-" + stage)))
          .isInstanceOf(InjectedPublicationFailure.class);
      faultProbe.failAt = null;
      assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?",
          Integer.class, fixture.planId())).isZero();
      assertThat(jdbc.queryForObject("select count(*) from staffing_plan_publication_operations where plan_id=?",
          Integer.class, fixture.planId())).isZero();
      assertThat(jdbc.queryForObject("select latest_published_version_id is null from staffing_plans where id=?",
          Boolean.class, fixture.planId())).isTrue();
    }
  }

  @Test void authorizationDistinguishesForbiddenFromHiddenScope() {
    Fixture fixture = fixture("authorization");
    UUID requirementId = requirement(fixture);
    var employeeUser = new UserAccount("employee-" + UUID.randomUUID() + "@example.com", "hash");
    employeeUser.verifyEmail(); users.saveAndFlush(employeeUser);
    var employee = memberships.saveAndFlush(new OrganizationMembership(
        fixture.organization(), employeeUser, MembershipRole.EMPLOYEE));
    authenticate(employeeUser);
    assertThatThrownBy(() -> publication.publishPlan(new PublishCommand(fixture.organizationId(),
        fixture.unitId(), fixture.planId(), fixture.planRevision(), employee.getId(),
        Set.of("UNDERCOVERAGE:" + requirementId), null, "forbidden")))
        .isInstanceOf(AccessDeniedException.class);

    Fixture other = fixture("other-tenant");
    authenticate(fixture.user());
    assertThatThrownBy(() -> publication.publishPlan(new PublishCommand(other.organizationId(),
        other.unitId(), fixture.planId(), fixture.planRevision(), fixture.owner().getId(), Set.of(),
        null, "hidden"))).isInstanceOf(NotFoundException.class);

    Fixture suspended = fixture("suspended-publisher");
    UUID suspendedRequirement = requirement(suspended);
    jdbc.update("update organization_memberships set membership_status='SUSPENDED' where id=?",
        suspended.owner().getId());
    entityManager.clear();
    authenticate(suspended.user());
    assertThatThrownBy(() -> publication.publishPlan(command(suspended, suspended.planRevision(),
        Set.of("UNDERCOVERAGE:" + suspendedRequirement), null, "suspended")))
        .isInstanceOf(NotFoundException.class);

    Fixture invitedPublisher = fixture("invited-publisher");
    UUID invitedRequirement = requirement(invitedPublisher);
    jdbc.update("update organization_memberships set membership_status='INVITED' where id=?",
        invitedPublisher.owner().getId());
    entityManager.clear();
    authenticate(invitedPublisher.user());
    assertThatThrownBy(() -> publication.publishPlan(command(invitedPublisher,
        invitedPublisher.planRevision(), Set.of("UNDERCOVERAGE:" + invitedRequirement), null,
        "invited-publisher"))).isInstanceOf(NotFoundException.class);
  }

  @Test void completedReplayStillRequiresCurrentActivePublisherAndPermission() {
    Fixture suspended = fixture("replay-suspended");
    UUID suspendedRequirement = requirement(suspended);
    PublishCommand suspendedCommand = command(suspended, suspended.planRevision(),
        Set.of("UNDERCOVERAGE:" + suspendedRequirement), null, "replay-suspended-key");
    publication.publishPlan(suspendedCommand);
    jdbc.update("update organization_memberships set membership_status='SUSPENDED' where id=?",
        suspended.owner().getId());
    entityManager.clear();
    authenticate(suspended.user());
    assertThatThrownBy(() -> publication.publishPlan(suspendedCommand))
        .isInstanceOf(NotFoundException.class);

    Fixture permissionLost = fixture("replay-permission-lost");
    UUID permissionRequirement = requirement(permissionLost);
    PublishCommand permissionCommand = command(permissionLost, permissionLost.planRevision(),
        Set.of("UNDERCOVERAGE:" + permissionRequirement), null, "replay-permission-key");
    publication.publishPlan(permissionCommand);
    jdbc.update("update organization_memberships set membership_role='EMPLOYEE' where id=?",
        permissionLost.owner().getId());
    entityManager.clear();
    authenticate(permissionLost.user());
    assertThatThrownBy(() -> publication.publishPlan(permissionCommand))
        .isInstanceOf(AccessDeniedException.class);
  }

  @Test void atomicSnapshotContainsTheCompleteExistingPlanWithoutChangingLegacyStatus() {
    Fixture fixture = fixture("complete-snapshot");
    UUID firstRequirement = requirement(fixture);
    UUID secondDay = foundation.createDay(fixture.organizationId(), fixture.unitId(), fixture.planId(),
        WEEK.plusDays(1), 40, "Tuesday context", StaffingPlanDaySource.MANUAL,
        fixture.owner().getId()).getId();
    UUID secondRequirement = additionalRequirement(fixture, firstRequirement, secondDay,
        WEEK.plusDays(1));
    OrganizationMembership worker = activeEmployee(fixture, "snapshot-worker");
    UUID assignmentId = assignment(fixture, firstRequirement, worker);
    UUID dayEntryId = UUID.randomUUID();
    jdbc.update("""
        insert into staffing_member_day_entries(id,organization_id,membership_id,work_date,
          entry_type,notes,created_by_membership_id,created_at,updated_at)
        values(?,?,?,?,'REST_DAY','Tuesday rest',?,current_timestamp,current_timestamp)
        """, dayEntryId, fixture.organizationId(), worker.getId(), WEEK.plusDays(1),
        fixture.owner().getId());
    long revision = jdbc.queryForObject("select draft_revision from staffing_plans where id=?",
        Long.class, fixture.planId());

    var result = publication.publishPlan(command(fixture, revision,
        Set.of("UNDERCOVERAGE:" + secondRequirement), "Complete snapshot", "complete-snapshot-key"));

    Map<String, Object> header = jdbc.queryForMap("""
        select publication_kind,coverage_basis,source_draft_complete,
          published_by_membership_id,publication_note
        from staffing_plan_versions where id=?
        """, result.versionId());
    assertThat(header.get("publication_kind")).isEqualTo("ATOMIC_WEEKLY");
    assertThat(header.get("coverage_basis")).isEqualTo("LEGACY_V90");
    assertThat(header.get("source_draft_complete")).isEqualTo(true);
    assertThat(header.get("published_by_membership_id")).isEqualTo(fixture.owner().getId());
    assertThat(header.get("publication_note")).isEqualTo("Complete snapshot");
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_version_days where version_id=?",
        Integer.class, result.versionId())).isEqualTo(2);
    assertThat(jdbc.queryForList("""
        select source_requirement_id from staffing_plan_version_requirements
        where version_id=? order by source_requirement_id
        """, UUID.class, result.versionId())).containsExactlyInAnyOrder(firstRequirement, secondRequirement);
    assertThat(jdbc.queryForList("""
        select source_assignment_id from staffing_plan_version_assignments where version_id=?
        """, UUID.class, result.versionId())).containsExactly(assignmentId);
    assertThat(jdbc.queryForList("""
        select source_day_entry_id from staffing_plan_version_member_days where version_id=?
        """, UUID.class, result.versionId())).containsExactly(dayEntryId);
    assertThat(jdbc.queryForList("""
        select distinct legacy_publication_status from staffing_plan_version_requirements where version_id=?
        """, String.class, result.versionId())).containsExactly("DRAFT");
    assertThat(jdbc.queryForList("""
        select distinct publication_status from staffing_requirements where id in (?,?)
        """, String.class, firstRequirement, secondRequirement)).containsExactly("DRAFT");
  }

  @Test void concurrentSameKeyReplaysAndDifferentKeysConflict() throws Exception {
    Fixture fixture = fixture("concurrent-same");
    UUID requirementId = requirement(fixture);
    PublishCommand same = command(fixture, fixture.planRevision(),
        Set.of("UNDERCOVERAGE:" + requirementId), null, "same-key");
    List<Object> sameResults = concurrent(fixture.user(), same, same);
    assertThat(sameResults).allMatch(value -> value instanceof StaffingPlanPublicationService.PublicationResult);
    var publications = sameResults.stream().map(StaffingPlanPublicationService.PublicationResult.class::cast).toList();
    assertThat(publications).extracting(StaffingPlanPublicationService.PublicationResult::versionId)
        .containsOnly(publications.getFirst().versionId());
    assertThat(publications).extracting(StaffingPlanPublicationService.PublicationResult::idempotentReplay)
        .containsExactlyInAnyOrder(false, true);

    Fixture different = fixture("concurrent-different");
    UUID differentRequirement = requirement(different);
    PublishCommand first = command(different, different.planRevision(),
        Set.of("UNDERCOVERAGE:" + differentRequirement), null, "different-1");
    PublishCommand second = command(different, different.planRevision(),
        Set.of("UNDERCOVERAGE:" + differentRequirement), null, "different-2");
    List<Object> results = concurrent(different.user(), first, second);
    assertThat(results.stream().filter(StaffingPlanPublicationService.PublicationResult.class::isInstance)).hasSize(1);
    assertThat(results.stream().filter(ConflictException.class::isInstance)).hasSize(1);
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?", Integer.class,
        different.planId())).isEqualTo(1);
  }

  @Test void differentPlansPublishIndependently() throws Exception {
    Fixture first = fixture("parallel-first");
    Fixture second = fixture("parallel-second");
    UUID firstRequirement = requirement(first);
    UUID secondRequirement = requirement(second);

    List<Object> results = concurrent(first.user(), command(first, first.planRevision(),
        Set.of("UNDERCOVERAGE:" + firstRequirement), null, "parallel-first"), second.user(),
        command(second, second.planRevision(), Set.of("UNDERCOVERAGE:" + secondRequirement), null,
            "parallel-second"));

    assertThat(results).allMatch(
        StaffingPlanPublicationService.PublicationResult.class::isInstance);
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?",
        Integer.class, first.planId())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from staffing_plan_versions where plan_id=?",
        Integer.class, second.planId())).isEqualTo(1);
  }

  private Fixture fixture(String label) {
    var user = new UserAccount(label + "-" + UUID.randomUUID() + "@example.com", "hash");
    user.verifyEmail(); users.saveAndFlush(user);
    var organization = organizations.saveAndFlush(new Organization("Business " + label, "Europe/Berlin"));
    var owner = memberships.saveAndFlush(new OrganizationMembership(organization, user, MembershipRole.OWNER));
    var unit = units.saveAndFlush(new OrganizationUnit(organization, null, "Hotel " + label,
        OrganizationUnitType.LOCATION, CheckInMode.OPTIONAL, 0));
    authenticate(user);
    var plan = foundation.getOrCreate(organization.getId(), unit.getId(), WEEK, owner.getId());
    var day = foundation.createDay(organization.getId(), unit.getId(), plan.getId(), WEEK, 50, null,
        StaffingPlanDaySource.MANUAL, owner.getId());
    long revision = jdbc.queryForObject("select draft_revision from staffing_plans where id=?",
        Long.class, plan.getId());
    return new Fixture(organization, owner, user, unit.getId(), plan.getId(), day.getId(), revision);
  }

  private UUID requirement(Fixture fixture) {
    UUID workType = UUID.randomUUID();
    jdbc.update("insert into organization_work_types(id,organization_id,unit_id,code,name,color,default_start_time,default_end_time,default_break_minutes,active,calculation_method,compensation_method,teamwork_enabled,extra_pay_enabled,composite_enabled,display_order,created_at,updated_at) values(?,?,?,'ROOM','Room cleaning','#10B981','09:00','16:30',30,true,'TIME_BASED','HOURLY',false,false,false,0,current_timestamp,current_timestamp)",
        workType, fixture.organizationId(), fixture.unitId());
    UUID id = UUID.randomUUID();
    jdbc.update("insert into staffing_requirements(id,organization_id,unit_id,work_type_id,work_date,start_time,end_time,required_workers,publication_status,created_by_membership_id,plan_day_id,created_at,updated_at) values(?,?,?,?,?,'09:00','16:30',1,'DRAFT',?,?,current_timestamp,current_timestamp)",
        id, fixture.organizationId(), fixture.unitId(), workType, WEEK, fixture.owner().getId(),
        fixture.planDayId());
    return id;
  }

  private UUID additionalRequirement(Fixture fixture, UUID existingRequirement, UUID planDayId,
      LocalDate workDate) {
    UUID workType = jdbc.queryForObject(
        "select work_type_id from staffing_requirements where id=?", UUID.class, existingRequirement);
    UUID id = UUID.randomUUID();
    jdbc.update("""
        insert into staffing_requirements(id,organization_id,unit_id,work_type_id,work_date,
          start_time,end_time,required_workers,publication_status,created_by_membership_id,
          plan_day_id,created_at,updated_at)
        values(?,?,?,?,?,'09:00','16:30',1,'DRAFT',?,?,current_timestamp,current_timestamp)
        """, id, fixture.organizationId(), fixture.unitId(), workType, workDate,
        fixture.owner().getId(), planDayId);
    return id;
  }

  private OrganizationMembership activeEmployee(Fixture fixture, String label) {
    var user = new UserAccount(label + "-" + UUID.randomUUID() + "@example.com", "hash");
    user.verifyEmail();
    users.saveAndFlush(user);
    return memberships.saveAndFlush(new OrganizationMembership(
        fixture.organization(), user, MembershipRole.EMPLOYEE));
  }

  private UUID assignment(Fixture fixture, UUID requirementId, OrganizationMembership member) {
    UUID id = UUID.randomUUID();
    jdbc.update("""
        insert into staffing_assignments(id,requirement_id,membership_id,assignment_status,
          assigned_by_membership_id,created_at,updated_at)
        values(?,?,?,'ASSIGNED',?,current_timestamp,current_timestamp)
        """, id, requirementId, member.getId(), fixture.owner().getId());
    return id;
  }

  private PublishCommand command(Fixture f, long revision, Set<String> acks, String note, String key) {
    return new PublishCommand(f.organizationId(), f.unitId(), f.planId(), revision, f.owner().getId(), acks,
        note, key);
  }

  private void authenticate(UserAccount user) {
    var principal = new AuthenticatedUser(user.getId(), user.getEmail(), true, UserStatus.ACTIVE, UserRole.USER);
    SecurityContextHolder.getContext().setAuthentication(
        UsernamePasswordAuthenticationToken.authenticated(principal, "", principal.getAuthorities()));
  }

  private List<Object> concurrent(UserAccount user, PublishCommand first, PublishCommand second)
      throws Exception {
    return concurrent(user, first, user, second);
  }

  private List<Object> concurrent(UserAccount firstUser, PublishCommand first,
      UserAccount secondUser, PublishCommand second) throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(2);
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    try {
      List<ConcurrentCall> calls = List.of(new ConcurrentCall(firstUser, first),
          new ConcurrentCall(secondUser, second));
      List<Future<Object>> futures = calls.stream().map(call -> executor.submit(() -> {
        authenticate(call.user()); ready.countDown(); start.await(10, TimeUnit.SECONDS);
        try { return publication.publishPlan(call.command()); }
        catch (RuntimeException exception) { return exception; }
        finally { SecurityContextHolder.clearContext(); }
      })).toList();
      assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue(); start.countDown();
      return List.of(futures.get(0).get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS));
    } finally { executor.shutdownNow(); }
  }

  private record Fixture(Organization organization, OrganizationMembership owner, UserAccount user, UUID unitId,
      UUID planId, UUID planDayId, long planRevision) {
    UUID organizationId() { return organization.getId(); }
  }

  private record ConcurrentCall(UserAccount user, PublishCommand command) {}

  @TestConfiguration
  static class FaultConfiguration {
    @Bean @Primary TestFaultProbe testFaultProbe() { return new TestFaultProbe(); }
  }

  static class TestFaultProbe implements StaffingPlanPublicationFaultProbe {
    volatile Stage failAt;
    @Override public void check(Stage stage) {
      if (stage == failAt) throw new InjectedPublicationFailure();
    }
  }

  static class InjectedPublicationFailure extends RuntimeException {}
}
