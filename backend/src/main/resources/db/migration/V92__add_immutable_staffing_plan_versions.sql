ALTER TABLE staffing_plans
    ADD CONSTRAINT ux_staffing_plans_id_scope UNIQUE (id, organization_id, unit_id);

CREATE TABLE staffing_plan_versions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    source_draft_revision BIGINT NOT NULL,
    previous_version_id UUID,
    published_by_membership_id UUID,
    published_by_display_name VARCHAR(220),
    published_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(60) NOT NULL,
    week_start DATE NOT NULL,
    coverage_required INTEGER NOT NULL,
    coverage_assigned INTEGER NOT NULL,
    coverage_percentage NUMERIC(8,2) NOT NULL,
    coverage_basis VARCHAR(30) NOT NULL,
    warning_count INTEGER NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    publication_kind VARCHAR(30) NOT NULL,
    source_draft_complete BOOLEAN NOT NULL,
    publication_note VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staffing_plan_versions_plan_scope
        FOREIGN KEY (plan_id, organization_id, unit_id)
        REFERENCES staffing_plans(id, organization_id, unit_id) ON DELETE RESTRICT,
    CONSTRAINT fk_staffing_plan_versions_unit_tenant
        FOREIGN KEY (unit_id, organization_id)
        REFERENCES organization_units(id, organization_id) ON DELETE RESTRICT,
    CONSTRAINT ck_staffing_plan_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_staffing_plan_versions_revision CHECK (source_draft_revision >= 0),
    CONSTRAINT ck_staffing_plan_versions_week_start CHECK (EXTRACT(ISODOW FROM week_start) = 1),
    CONSTRAINT ck_staffing_plan_versions_timezone CHECK (BTRIM(timezone) <> ''),
    CONSTRAINT ck_staffing_plan_versions_coverage CHECK (
        coverage_required >= 0
        AND coverage_assigned >= 0
        AND coverage_percentage >= 0
        AND warning_count >= 0
    ),
    CONSTRAINT ck_staffing_plan_versions_basis CHECK (coverage_basis IN ('LEGACY_V90')),
    CONSTRAINT ck_staffing_plan_versions_kind CHECK (
        publication_kind IN ('ATOMIC', 'LEGACY_PARTIAL')
        AND (
            publication_kind = 'LEGACY_PARTIAL'
            OR (published_by_membership_id IS NOT NULL AND BTRIM(published_by_display_name) <> '')
        )
        AND (publication_kind <> 'ATOMIC' OR source_draft_complete)
    ),
    CONSTRAINT ck_staffing_plan_versions_checksum CHECK (checksum ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ux_staffing_plan_versions_number UNIQUE (plan_id, version_number),
    CONSTRAINT ux_staffing_plan_versions_revision UNIQUE (plan_id, source_draft_revision),
    CONSTRAINT ux_staffing_plan_versions_identity_plan UNIQUE (id, plan_id)
);

ALTER TABLE staffing_plan_versions
    ADD CONSTRAINT fk_staffing_plan_versions_previous_same_plan
    FOREIGN KEY (previous_version_id, plan_id)
    REFERENCES staffing_plan_versions(id, plan_id) ON DELETE RESTRICT;

CREATE INDEX ix_staffing_plan_versions_scope
    ON staffing_plan_versions(organization_id, unit_id, plan_id, version_number DESC);

CREATE TABLE staffing_plan_version_days (
    id UUID PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES staffing_plan_versions(id) ON DELETE CASCADE,
    source_plan_day_id UUID NOT NULL,
    work_date DATE NOT NULL,
    rooms_context INTEGER,
    notes VARCHAR(1000),
    source VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_plan_version_days_rooms CHECK (rooms_context IS NULL OR rooms_context >= 0),
    CONSTRAINT ck_staffing_plan_version_days_source
        CHECK (source IN ('MANUAL', 'TEMPLATE', 'IMPORT', 'LEGACY_BACKFILL')),
    CONSTRAINT ux_staffing_plan_version_days_source UNIQUE (version_id, source_plan_day_id),
    CONSTRAINT ux_staffing_plan_version_days_date UNIQUE (version_id, work_date),
    CONSTRAINT ux_staffing_plan_version_days_identity_version UNIQUE (id, version_id)
);

CREATE TABLE staffing_plan_version_requirements (
    id UUID PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES staffing_plan_versions(id) ON DELETE CASCADE,
    version_day_id UUID NOT NULL,
    source_requirement_id UUID NOT NULL,
    source_plan_day_id UUID NOT NULL,
    work_date DATE NOT NULL,
    unit_id UUID NOT NULL,
    unit_name VARCHAR(160) NOT NULL,
    work_type_id UUID NOT NULL,
    work_type_code VARCHAR(20) NOT NULL,
    work_type_name VARCHAR(120) NOT NULL,
    start_time TIME,
    end_time TIME,
    break_minutes INTEGER NOT NULL,
    required_workers INTEGER NOT NULL,
    required_quantity NUMERIC(12,2),
    legacy_publication_status VARCHAR(20) NOT NULL,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staffing_plan_version_requirements_day
        FOREIGN KEY (version_day_id, version_id)
        REFERENCES staffing_plan_version_days(id, version_id) ON DELETE CASCADE,
    CONSTRAINT ck_staffing_plan_version_requirements_times
        CHECK (end_time IS NULL OR start_time IS NOT NULL),
    CONSTRAINT ck_staffing_plan_version_requirements_break CHECK (break_minutes >= 0),
    CONSTRAINT ck_staffing_plan_version_requirements_workers CHECK (required_workers > 0),
    CONSTRAINT ck_staffing_plan_version_requirements_quantity
        CHECK (required_quantity IS NULL OR required_quantity > 0),
    CONSTRAINT ck_staffing_plan_version_requirements_publication
        CHECK (legacy_publication_status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ux_staffing_plan_version_requirements_source UNIQUE (version_id, source_requirement_id),
    CONSTRAINT ux_staffing_plan_version_requirements_identity_version UNIQUE (id, version_id)
);

CREATE INDEX ix_staffing_plan_version_requirements_day
    ON staffing_plan_version_requirements(version_id, work_date, work_type_code);

CREATE TABLE staffing_plan_version_assignments (
    id UUID PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES staffing_plan_versions(id) ON DELETE CASCADE,
    version_requirement_id UUID NOT NULL,
    source_assignment_id UUID NOT NULL,
    source_requirement_id UUID NOT NULL,
    organization_membership_id UUID NOT NULL,
    member_display_name VARCHAR(220) NOT NULL,
    membership_status_snapshot VARCHAR(20) NOT NULL,
    work_date DATE NOT NULL,
    unit_id UUID NOT NULL,
    unit_name VARCHAR(160) NOT NULL,
    work_type_id UUID NOT NULL,
    work_type_code VARCHAR(20) NOT NULL,
    work_type_name VARCHAR(120) NOT NULL,
    start_time TIME,
    end_time TIME,
    assignment_status VARCHAR(20) NOT NULL,
    check_in_mode VARCHAR(20) NOT NULL,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staffing_plan_version_assignments_requirement
        FOREIGN KEY (version_requirement_id, version_id)
        REFERENCES staffing_plan_version_requirements(id, version_id) ON DELETE CASCADE,
    CONSTRAINT ck_staffing_plan_version_assignments_times
        CHECK (end_time IS NULL OR start_time IS NOT NULL),
    CONSTRAINT ck_staffing_plan_version_assignments_status
        CHECK (assignment_status IN ('ASSIGNED', 'CANCELLED')),
    CONSTRAINT ck_staffing_plan_version_assignments_membership_status
        CHECK (membership_status_snapshot IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
    CONSTRAINT ck_staffing_plan_version_assignments_check_in
        CHECK (check_in_mode IN ('DISABLED', 'OPTIONAL', 'REQUIRED')),
    CONSTRAINT ck_staffing_plan_version_assignments_checkout
        CHECK (checked_out_at IS NULL OR checked_in_at IS NOT NULL),
    CONSTRAINT ux_staffing_plan_version_assignments_source UNIQUE (version_id, source_assignment_id)
);

CREATE INDEX ix_staffing_plan_version_assignments_member
    ON staffing_plan_version_assignments(version_id, organization_membership_id, work_date);

CREATE TABLE staffing_plan_version_member_days (
    id UUID PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES staffing_plan_versions(id) ON DELETE CASCADE,
    source_day_entry_id UUID NOT NULL,
    organization_membership_id UUID NOT NULL,
    member_display_name VARCHAR(220) NOT NULL,
    work_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    notes VARCHAR(500),
    source VARCHAR(30) NOT NULL,
    source_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_plan_version_member_days_status
        CHECK (status IN ('REST_DAY', 'VACATION', 'SICK')),
    CONSTRAINT ck_staffing_plan_version_member_days_source
        CHECK (source IN ('LEGACY_DAY_ENTRY', 'APPROVED_REQUEST', 'MANUAL')),
    CONSTRAINT ux_staffing_plan_version_member_days_source UNIQUE (version_id, source_day_entry_id)
);

CREATE INDEX ix_staffing_plan_version_member_days_member
    ON staffing_plan_version_member_days(version_id, organization_membership_id, work_date);

CREATE TABLE staffing_plan_version_acknowledgements (
    id UUID PRIMARY KEY,
    version_id UUID NOT NULL REFERENCES staffing_plan_versions(id) ON DELETE CASCADE,
    issue_key VARCHAR(200) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    acknowledged_by_membership_id UUID,
    acknowledged_by_display_name VARCHAR(220) NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staffing_plan_version_acknowledgements_severity CHECK (
        severity IN ('BLOCKING_CONFLICT', 'WARNING', 'INFORMATION', 'PENDING_REQUEST', 'UNCONFIRMED_CHANGE')
    ),
    CONSTRAINT ux_staffing_plan_version_acknowledgements_issue UNIQUE (version_id, issue_key)
);

ALTER TABLE staffing_plans
    ADD COLUMN latest_published_version_id UUID,
    ADD COLUMN published_revision BIGINT,
    ADD COLUMN published_at TIMESTAMPTZ,
    ADD CONSTRAINT ck_staffing_plans_published_revision
        CHECK (published_revision IS NULL OR published_revision >= 0),
    ADD CONSTRAINT ck_staffing_plans_publication_pointer CHECK (
        (latest_published_version_id IS NULL AND published_revision IS NULL AND published_at IS NULL)
        OR (latest_published_version_id IS NOT NULL AND published_revision IS NOT NULL AND published_at IS NOT NULL)
    ),
    ADD CONSTRAINT fk_staffing_plans_latest_version_same_plan
        FOREIGN KEY (latest_published_version_id, id)
        REFERENCES staffing_plan_versions(id, plan_id) ON DELETE RESTRICT;

INSERT INTO staffing_plan_versions (
    id, organization_id, unit_id, plan_id, version_number, source_draft_revision,
    previous_version_id, published_by_membership_id, published_by_display_name,
    published_at, timezone, week_start,
    coverage_required, coverage_assigned, coverage_percentage, coverage_basis,
    warning_count, checksum, publication_kind, source_draft_complete,
    publication_note, created_at
)
SELECT
    gen_random_uuid(),
    plan.organization_id,
    plan.unit_id,
    plan.id,
    1,
    plan.draft_revision,
    NULL,
    NULL,
    NULL,
    COALESCE(
        MAX(requirement.published_at),
        MAX(requirement.updated_at),
        MAX(requirement.created_at)
    ),
    plan.timezone,
    plan.week_start,
    SUM(requirement.required_workers)::integer,
    COALESCE(SUM(assignment_count.assigned_workers), 0)::integer,
    CASE
        WHEN SUM(requirement.required_workers) = 0 THEN 0
        ELSE ROUND(
            COALESCE(SUM(assignment_count.assigned_workers), 0)::numeric
            * 100 / SUM(requirement.required_workers),
            2
        )
    END,
    'LEGACY_V90',
    COUNT(*) FILTER (
        WHERE COALESCE(assignment_count.assigned_workers, 0) < requirement.required_workers
    )::integer,
    REPEAT('0', 64),
    'LEGACY_PARTIAL',
    NOT EXISTS (
        SELECT 1
        FROM staffing_plan_days draft_day
        JOIN staffing_requirements draft_requirement
          ON draft_requirement.plan_day_id = draft_day.id
        WHERE draft_day.plan_id = plan.id
          AND draft_requirement.publication_status <> 'PUBLISHED'
    ),
    'Imported from per-requirement legacy publication; not evidence of an atomic weekly publication.',
    COALESCE(
        MAX(requirement.published_at),
        MAX(requirement.updated_at),
        MAX(requirement.created_at)
    )
FROM staffing_plans plan
JOIN staffing_plan_days plan_day ON plan_day.plan_id = plan.id
JOIN staffing_requirements requirement
  ON requirement.plan_day_id = plan_day.id
 AND requirement.publication_status = 'PUBLISHED'
LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (
        WHERE assignment.assignment_status = 'ASSIGNED'
          AND member.membership_status = 'ACTIVE'
    ) AS assigned_workers
    FROM staffing_assignments assignment
    JOIN organization_memberships member ON member.id = assignment.membership_id
    WHERE assignment.requirement_id = requirement.id
) assignment_count ON TRUE
GROUP BY plan.id, plan.organization_id, plan.unit_id, plan.draft_revision, plan.timezone, plan.week_start;

INSERT INTO staffing_plan_version_days (
    id, version_id, source_plan_day_id, work_date, rooms_context, notes, source, created_at
)
SELECT
    gen_random_uuid(), version.id, plan_day.id, plan_day.work_date,
    plan_day.rooms_context, plan_day.notes, plan_day.source, version.created_at
FROM staffing_plan_versions version
JOIN staffing_plan_days plan_day ON plan_day.plan_id = version.plan_id
WHERE version.publication_kind = 'LEGACY_PARTIAL'
  AND EXISTS (
      SELECT 1 FROM staffing_requirements requirement
      WHERE requirement.plan_day_id = plan_day.id
        AND requirement.publication_status = 'PUBLISHED'
  );

INSERT INTO staffing_plan_version_requirements (
    id, version_id, version_day_id, source_requirement_id, source_plan_day_id,
    work_date, unit_id, unit_name, work_type_id, work_type_code, work_type_name,
    start_time, end_time, break_minutes, required_workers, required_quantity,
    legacy_publication_status, notes, created_at
)
SELECT
    gen_random_uuid(), version.id, version_day.id, requirement.id, plan_day.id,
    requirement.work_date, requirement.unit_id, unit.name,
    requirement.work_type_id, work_type.code, work_type.name,
    requirement.start_time, requirement.end_time, work_type.default_break_minutes,
    requirement.required_workers, requirement.required_quantity,
    requirement.publication_status, requirement.notes, version.created_at
FROM staffing_plan_versions version
JOIN staffing_plan_days plan_day ON plan_day.plan_id = version.plan_id
JOIN staffing_plan_version_days version_day
  ON version_day.version_id = version.id
 AND version_day.source_plan_day_id = plan_day.id
JOIN staffing_requirements requirement
  ON requirement.plan_day_id = plan_day.id
 AND requirement.publication_status = 'PUBLISHED'
JOIN organization_units unit ON unit.id = requirement.unit_id
JOIN organization_work_types work_type ON work_type.id = requirement.work_type_id
WHERE version.publication_kind = 'LEGACY_PARTIAL';

INSERT INTO staffing_plan_version_assignments (
    id, version_id, version_requirement_id, source_assignment_id, source_requirement_id,
    organization_membership_id, member_display_name, membership_status_snapshot,
    work_date, unit_id, unit_name,
    work_type_id, work_type_code, work_type_name, start_time, end_time,
    assignment_status, check_in_mode, checked_in_at, checked_out_at, created_at
)
SELECT
    gen_random_uuid(), version.id, version_requirement.id, assignment.id, requirement.id,
    member.id,
    COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', member.first_name, member.last_name)), ''),
        'Member ' || LEFT(member.id::text, 8)
    ),
    member.membership_status,
    requirement.work_date, requirement.unit_id, unit.name,
    requirement.work_type_id, work_type.code, work_type.name,
    COALESCE(assignment.start_time, requirement.start_time),
    COALESCE(assignment.end_time, requirement.end_time),
    assignment.assignment_status, unit.check_in_mode,
    result.checked_in_at, result.checked_out_at, version.created_at
FROM staffing_plan_versions version
JOIN staffing_plan_version_requirements version_requirement ON version_requirement.version_id = version.id
JOIN staffing_requirements requirement ON requirement.id = version_requirement.source_requirement_id
JOIN staffing_assignments assignment ON assignment.requirement_id = requirement.id
JOIN organization_memberships member ON member.id = assignment.membership_id
JOIN organization_units unit ON unit.id = requirement.unit_id
JOIN organization_work_types work_type ON work_type.id = requirement.work_type_id
LEFT JOIN staffing_assignment_results result ON result.assignment_id = assignment.id
WHERE version.publication_kind = 'LEGACY_PARTIAL';

INSERT INTO staffing_plan_version_member_days (
    id, version_id, source_day_entry_id, organization_membership_id, member_display_name,
    work_date, status, notes, source, source_request_id, created_at
)
SELECT
    gen_random_uuid(), version.id, day_entry.id, member.id,
    COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', member.first_name, member.last_name)), ''),
        'Member ' || LEFT(member.id::text, 8)
    ),
    day_entry.work_date, day_entry.entry_type, day_entry.notes,
    'LEGACY_DAY_ENTRY', NULL, version.created_at
FROM staffing_plan_versions version
JOIN staffing_member_day_entries day_entry
  ON day_entry.organization_id = version.organization_id
 AND day_entry.work_date BETWEEN version.week_start AND version.week_start + 6
JOIN organization_memberships member ON member.id = day_entry.membership_id
WHERE version.publication_kind = 'LEGACY_PARTIAL'
  AND EXISTS (
      SELECT 1
      FROM staffing_plan_version_assignments version_assignment
      WHERE version_assignment.version_id = version.id
        AND version_assignment.organization_membership_id = day_entry.membership_id
  );

UPDATE staffing_plan_versions version
SET checksum = ENCODE(SHA256(CONVERT_TO(
    CONCAT(
        'header:', JSONB_BUILD_ARRAY(
            version.organization_id::text, version.unit_id::text, version.version_number::text,
            version.source_draft_revision::text, version.timezone,
            TO_CHAR(version.week_start, 'YYYY-MM-DD'),
            version.coverage_required::text, version.coverage_assigned::text,
            version.coverage_percentage::text, version.coverage_basis,
            version.warning_count::text, version.publication_kind,
            version.source_draft_complete, version.publication_note
        )::text,
        '|days:', COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_ARRAY(
                TO_CHAR(day.work_date, 'YYYY-MM-DD'), day.rooms_context::text,
                day.notes, day.source
            ) ORDER BY day.work_date)::text
            FROM staffing_plan_version_days day WHERE day.version_id = version.id
        ), '[]'),
        '|requirements:', COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_ARRAY(
                requirement.source_requirement_id::text,
                TO_CHAR(requirement.work_date, 'YYYY-MM-DD'), requirement.unit_id::text,
                requirement.unit_name, requirement.work_type_id, requirement.work_type_code,
                requirement.work_type_name,
                TO_CHAR(requirement.start_time, 'HH24:MI:SS.US'),
                TO_CHAR(requirement.end_time, 'HH24:MI:SS.US'),
                requirement.break_minutes::text, requirement.required_workers::text,
                requirement.required_quantity::text,
                requirement.legacy_publication_status, requirement.notes
            ) ORDER BY requirement.work_date, requirement.start_time,
                requirement.work_type_code, requirement.source_requirement_id)::text
            FROM staffing_plan_version_requirements requirement
            WHERE requirement.version_id = version.id
        ), '[]'),
        '|assignments:', COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_ARRAY(
                assignment.source_assignment_id::text, assignment.source_requirement_id::text,
                assignment.organization_membership_id::text, assignment.member_display_name,
                assignment.membership_status_snapshot,
                TO_CHAR(assignment.work_date, 'YYYY-MM-DD'), assignment.unit_id::text,
                assignment.unit_name, assignment.work_type_id::text,
                assignment.work_type_code, assignment.work_type_name,
                TO_CHAR(assignment.start_time, 'HH24:MI:SS.US'),
                TO_CHAR(assignment.end_time, 'HH24:MI:SS.US'),
                assignment.assignment_status, assignment.check_in_mode,
                TO_CHAR(assignment.checked_in_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                TO_CHAR(assignment.checked_out_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
            ) ORDER BY assignment.work_date, assignment.work_type_code,
                assignment.organization_membership_id, assignment.source_assignment_id)::text
            FROM staffing_plan_version_assignments assignment
            WHERE assignment.version_id = version.id
        ), '[]'),
        '|memberDays:', COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_ARRAY(
                member_day.source_day_entry_id::text,
                member_day.organization_membership_id::text,
                member_day.member_display_name, TO_CHAR(member_day.work_date, 'YYYY-MM-DD'),
                member_day.status, member_day.notes, member_day.source,
                member_day.source_request_id::text
            ) ORDER BY member_day.work_date, member_day.organization_membership_id,
                member_day.source_day_entry_id)::text
            FROM staffing_plan_version_member_days member_day
            WHERE member_day.version_id = version.id
        ), '[]'),
        '|acknowledgements:', COALESCE((
            SELECT JSONB_AGG(JSONB_BUILD_ARRAY(
                acknowledgement.issue_key, acknowledgement.severity,
                acknowledgement.acknowledged_by_membership_id::text,
                acknowledgement.acknowledged_by_display_name,
                TO_CHAR(acknowledgement.acknowledged_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                acknowledgement.note
            ) ORDER BY acknowledgement.issue_key)::text
            FROM staffing_plan_version_acknowledgements acknowledgement
            WHERE acknowledgement.version_id = version.id
        ), '[]')
    ),
    'UTF8'
)), 'hex')
WHERE version.publication_kind = 'LEGACY_PARTIAL';

UPDATE staffing_plans plan
SET latest_published_version_id = version.id,
    published_revision = version.source_draft_revision,
    published_at = version.published_at
FROM staffing_plan_versions version
WHERE version.plan_id = plan.id
  AND version.version_number = 1
  AND version.publication_kind = 'LEGACY_PARTIAL';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM staffing_plan_versions version
        JOIN staffing_plans plan ON plan.id = version.plan_id
        WHERE version.organization_id <> plan.organization_id
           OR version.unit_id <> plan.unit_id
           OR version.week_start <> plan.week_start
           OR version.timezone <> plan.timezone
    ) THEN
        RAISE EXCEPTION 'V92 created a cross-scope staffing plan version';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_plan_versions version
        WHERE version.publication_kind = 'LEGACY_PARTIAL'
          AND NOT EXISTS (
              SELECT 1 FROM staffing_plan_version_requirements requirement
              WHERE requirement.version_id = version.id
          )
    ) THEN
        RAISE EXCEPTION 'V92 created an empty legacy staffing plan version';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_plan_version_requirements requirement
        JOIN staffing_plan_versions version ON version.id = requirement.version_id
        WHERE requirement.unit_id <> version.unit_id
           OR requirement.work_date < version.week_start
           OR requirement.work_date > version.week_start + 6
    ) THEN
        RAISE EXCEPTION 'V92 created an out-of-scope requirement snapshot';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_plan_version_assignments assignment
        JOIN staffing_plan_versions version ON version.id = assignment.version_id
        JOIN organization_memberships member
          ON member.id = assignment.organization_membership_id
        WHERE assignment.unit_id <> version.unit_id
           OR member.organization_id <> version.organization_id
    ) THEN
        RAISE EXCEPTION 'V92 created a cross-tenant assignment snapshot';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_plan_version_member_days member_day
        JOIN staffing_plan_versions version ON version.id = member_day.version_id
        JOIN organization_memberships member
          ON member.id = member_day.organization_membership_id
        WHERE member.organization_id <> version.organization_id
           OR member_day.work_date < version.week_start
           OR member_day.work_date > version.week_start + 6
    ) THEN
        RAISE EXCEPTION 'V92 created a cross-tenant member-day snapshot';
    END IF;
END $$;
