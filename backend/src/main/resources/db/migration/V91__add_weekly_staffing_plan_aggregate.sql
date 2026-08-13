DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM staffing_requirements requirement
        JOIN organization_units unit ON unit.id = requirement.unit_id
        WHERE unit.organization_id <> requirement.organization_id
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill cross-tenant staffing requirement units';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_requirements requirement
        JOIN organization_work_types work_type ON work_type.id = requirement.work_type_id
        WHERE work_type.organization_id <> requirement.organization_id
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill cross-tenant staffing requirement work types';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM organization_work_types work_type
        JOIN organization_units unit ON unit.id = work_type.unit_id
        WHERE unit.organization_id <> work_type.organization_id
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill cross-tenant staffing work type units';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_requirements requirement
        JOIN organization_memberships creator ON creator.id = requirement.created_by_membership_id
        WHERE creator.organization_id <> requirement.organization_id
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill cross-tenant staffing requirement creators';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_assignments assignment
        JOIN staffing_requirements requirement ON requirement.id = assignment.requirement_id
        JOIN organization_memberships member ON member.id = assignment.membership_id
        WHERE member.organization_id <> requirement.organization_id
    ) OR EXISTS (
        SELECT 1
        FROM staffing_assignments assignment
        JOIN staffing_requirements requirement ON requirement.id = assignment.requirement_id
        JOIN organization_memberships assigner ON assigner.id = assignment.assigned_by_membership_id
        WHERE assigner.organization_id <> requirement.organization_id
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill staffing plans with cross-tenant assignments';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_member_day_entries day_entry
        JOIN organization_memberships member ON member.id = day_entry.membership_id
        WHERE member.organization_id <> day_entry.organization_id
    ) OR EXISTS (
        SELECT 1
        FROM staffing_member_day_entries day_entry
        JOIN organization_memberships creator ON creator.id = day_entry.created_by_membership_id
        WHERE creator.organization_id <> day_entry.organization_id
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill staffing plans with cross-tenant member day entries';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_requirements requirement
        JOIN organizations organization ON organization.id = requirement.organization_id
        WHERE organization.timezone IS NULL
           OR BTRIM(organization.timezone) = ''
           OR NOT EXISTS (
               SELECT 1 FROM pg_timezone_names timezone
               WHERE timezone.name = organization.timezone
           )
    ) THEN
        RAISE EXCEPTION 'V91 cannot backfill staffing plans with missing or invalid organization timezone';
    END IF;
END $$;

ALTER TABLE organization_units
    ADD CONSTRAINT ux_organization_units_id_organization UNIQUE (id, organization_id);

ALTER TABLE organization_memberships
    ADD CONSTRAINT ux_organization_memberships_id_organization UNIQUE (id, organization_id);

CREATE TABLE staffing_plans (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL,
    week_start DATE NOT NULL,
    timezone VARCHAR(60) NOT NULL,
    plan_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    draft_revision BIGINT NOT NULL DEFAULT 0,
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_by_membership_id UUID,
    updated_by_membership_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staffing_plans_unit_tenant
        FOREIGN KEY (unit_id, organization_id)
        REFERENCES organization_units(id, organization_id) ON DELETE RESTRICT,
    CONSTRAINT fk_staffing_plans_created_by_tenant
        FOREIGN KEY (created_by_membership_id, organization_id)
        REFERENCES organization_memberships(id, organization_id)
        ON DELETE SET NULL (created_by_membership_id),
    CONSTRAINT fk_staffing_plans_updated_by_tenant
        FOREIGN KEY (updated_by_membership_id, organization_id)
        REFERENCES organization_memberships(id, organization_id)
        ON DELETE SET NULL (updated_by_membership_id),
    CONSTRAINT ck_staffing_plans_status CHECK (plan_status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_staffing_plans_week_start CHECK (EXTRACT(ISODOW FROM week_start) = 1),
    CONSTRAINT ck_staffing_plans_timezone CHECK (BTRIM(timezone) <> ''),
    CONSTRAINT ck_staffing_plans_draft_revision CHECK (draft_revision >= 0),
    CONSTRAINT ck_staffing_plans_lock_version CHECK (lock_version >= 0),
    CONSTRAINT ux_staffing_plans_scope UNIQUE (organization_id, unit_id, week_start),
    CONSTRAINT ux_staffing_plans_id_organization UNIQUE (id, organization_id)
);

CREATE INDEX ix_staffing_plans_scope_status
    ON staffing_plans(organization_id, unit_id, week_start, plan_status);

CREATE TABLE staffing_plan_days (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    work_date DATE NOT NULL,
    rooms_context INTEGER,
    notes VARCHAR(1000),
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staffing_plan_days_plan_tenant
        FOREIGN KEY (plan_id, organization_id)
        REFERENCES staffing_plans(id, organization_id) ON DELETE CASCADE,
    CONSTRAINT ck_staffing_plan_days_rooms CHECK (rooms_context IS NULL OR rooms_context >= 0),
    CONSTRAINT ck_staffing_plan_days_source
        CHECK (source IN ('MANUAL', 'TEMPLATE', 'IMPORT', 'LEGACY_BACKFILL')),
    CONSTRAINT ux_staffing_plan_days_date UNIQUE (plan_id, work_date),
    CONSTRAINT ux_staffing_plan_days_id_organization UNIQUE (id, organization_id)
);

CREATE INDEX ix_staffing_plan_days_tenant_date
    ON staffing_plan_days(organization_id, work_date, plan_id);

ALTER TABLE staffing_requirements ADD COLUMN plan_day_id UUID;

INSERT INTO staffing_plans (
    id,
    organization_id,
    unit_id,
    week_start,
    timezone,
    plan_status,
    draft_revision,
    lock_version,
    created_by_membership_id,
    updated_by_membership_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    requirement.organization_id,
    requirement.unit_id,
    DATE_TRUNC('week', requirement.work_date)::date,
    organization.timezone,
    'ACTIVE',
    0,
    0,
    (ARRAY_AGG(requirement.created_by_membership_id ORDER BY requirement.created_at, requirement.id)
        FILTER (WHERE requirement.created_by_membership_id IS NOT NULL))[1],
    (ARRAY_AGG(requirement.created_by_membership_id ORDER BY requirement.updated_at DESC, requirement.id)
        FILTER (WHERE requirement.created_by_membership_id IS NOT NULL))[1],
    MIN(requirement.created_at),
    MAX(requirement.updated_at)
FROM staffing_requirements requirement
JOIN organizations organization ON organization.id = requirement.organization_id
GROUP BY
    requirement.organization_id,
    requirement.unit_id,
    DATE_TRUNC('week', requirement.work_date)::date,
    organization.timezone;

INSERT INTO staffing_plan_days (
    id,
    plan_id,
    organization_id,
    work_date,
    source,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    plan.id,
    plan.organization_id,
    requirement.work_date,
    'LEGACY_BACKFILL',
    MIN(requirement.created_at),
    MAX(requirement.updated_at)
FROM staffing_requirements requirement
JOIN staffing_plans plan
  ON plan.organization_id = requirement.organization_id
 AND plan.unit_id = requirement.unit_id
 AND plan.week_start = DATE_TRUNC('week', requirement.work_date)::date
GROUP BY plan.id, plan.organization_id, requirement.work_date;

UPDATE staffing_requirements requirement
SET plan_day_id = plan_day.id
FROM staffing_plan_days plan_day
WHERE plan_day.organization_id = requirement.organization_id
  AND plan_day.work_date = requirement.work_date
  AND plan_day.plan_id = (
      SELECT plan.id
      FROM staffing_plans plan
      WHERE plan.organization_id = requirement.organization_id
        AND plan.unit_id = requirement.unit_id
        AND plan.week_start = DATE_TRUNC('week', requirement.work_date)::date
  );

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM staffing_requirements WHERE plan_day_id IS NULL) THEN
        RAISE EXCEPTION 'V91 weekly staffing plan backfill left orphan requirements';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM staffing_plan_days plan_day
        JOIN staffing_plans plan ON plan.id = plan_day.plan_id
        WHERE plan_day.work_date < plan.week_start
           OR plan_day.work_date > plan.week_start + 6
    ) THEN
        RAISE EXCEPTION 'V91 weekly staffing plan backfill created a day outside its plan week';
    END IF;
END $$;

ALTER TABLE staffing_requirements
    ADD CONSTRAINT fk_staffing_requirements_plan_day_tenant
    FOREIGN KEY (plan_day_id, organization_id)
    REFERENCES staffing_plan_days(id, organization_id) ON DELETE RESTRICT;

CREATE INDEX ix_staffing_requirements_plan_day
    ON staffing_requirements(plan_day_id);
