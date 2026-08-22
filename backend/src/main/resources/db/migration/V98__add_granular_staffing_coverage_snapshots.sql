ALTER TABLE staffing_plan_versions
    ADD COLUMN checksum_format_version SMALLINT NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_staffing_plan_versions_checksum_format
        CHECK (checksum_format_version IN (1, 2)),
    ADD CONSTRAINT ux_staffing_plan_versions_coverage_scope
        UNIQUE (id, organization_id, unit_id, week_start);

ALTER TABLE staffing_plan_versions
    DROP CONSTRAINT ck_staffing_plan_versions_basis,
    ADD CONSTRAINT ck_staffing_plan_versions_basis
        CHECK (coverage_basis IN ('LEGACY_V90', 'CANONICAL_REQUIREMENT_V1'));

CREATE TABLE staffing_plan_version_requirement_coverage (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    version_id UUID NOT NULL,
    week_start DATE NOT NULL,
    version_requirement_id UUID NOT NULL,
    source_requirement_id UUID NOT NULL,
    work_date DATE NOT NULL,
    required INTEGER NOT NULL,
    raw_assigned INTEGER NOT NULL,
    effective_assigned INTEGER NOT NULL,
    covered INTEGER NOT NULL,
    missing INTEGER NOT NULL,
    overstaffed INTEGER NOT NULL,
    percentage NUMERIC(8,2) NOT NULL,
    open_positions INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_version_requirement_coverage_scope
        FOREIGN KEY (version_id, organization_id, unit_id, week_start)
        REFERENCES staffing_plan_versions(id, organization_id, unit_id, week_start)
        ON DELETE CASCADE,
    CONSTRAINT fk_version_requirement_coverage_requirement
        FOREIGN KEY (version_requirement_id, version_id)
        REFERENCES staffing_plan_version_requirements(id, version_id)
        ON DELETE CASCADE,
    CONSTRAINT ck_version_requirement_coverage_week
        CHECK (work_date BETWEEN week_start AND week_start + 6),
    CONSTRAINT ck_version_requirement_coverage_values CHECK (
        required >= 0 AND raw_assigned >= 0 AND effective_assigned >= 0
        AND covered >= 0 AND missing >= 0 AND overstaffed >= 0
        AND percentage >= 0 AND percentage <= 100 AND open_positions >= 0
        AND covered + missing = required
        AND covered + overstaffed = effective_assigned
        AND effective_assigned <= raw_assigned
        AND open_positions = missing
        AND percentage = CASE WHEN required = 0 THEN 0
            ELSE ROUND(covered::numeric * 100 / required, 2) END
    ),
    CONSTRAINT ux_version_requirement_coverage_snapshot UNIQUE (version_id, version_requirement_id),
    CONSTRAINT ux_version_requirement_coverage_source UNIQUE (version_id, source_requirement_id)
);

CREATE INDEX ix_version_requirement_coverage_scope
    ON staffing_plan_version_requirement_coverage
       (organization_id, unit_id, version_id, work_date);

CREATE TABLE staffing_plan_version_day_coverage (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    version_id UUID NOT NULL,
    week_start DATE NOT NULL,
    work_date DATE NOT NULL,
    required INTEGER NOT NULL,
    raw_assigned INTEGER NOT NULL,
    effective_assigned INTEGER NOT NULL,
    covered INTEGER NOT NULL,
    missing INTEGER NOT NULL,
    overstaffed INTEGER NOT NULL,
    percentage NUMERIC(8,2) NOT NULL,
    open_positions INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_version_day_coverage_scope
        FOREIGN KEY (version_id, organization_id, unit_id, week_start)
        REFERENCES staffing_plan_versions(id, organization_id, unit_id, week_start)
        ON DELETE CASCADE,
    CONSTRAINT ck_version_day_coverage_week
        CHECK (work_date BETWEEN week_start AND week_start + 6),
    CONSTRAINT ck_version_day_coverage_values CHECK (
        required >= 0 AND raw_assigned >= 0 AND effective_assigned >= 0
        AND covered >= 0 AND missing >= 0 AND overstaffed >= 0
        AND percentage >= 0 AND percentage <= 100 AND open_positions >= 0
        AND covered + missing = required
        AND covered + overstaffed = effective_assigned
        AND effective_assigned <= raw_assigned
        AND open_positions = missing
        AND percentage = CASE WHEN required = 0 THEN 0
            ELSE ROUND(covered::numeric * 100 / required, 2) END
    ),
    CONSTRAINT ux_version_day_coverage_date UNIQUE (version_id, work_date)
);

CREATE INDEX ix_version_day_coverage_scope
    ON staffing_plan_version_day_coverage
       (organization_id, unit_id, version_id, work_date);

COMMENT ON COLUMN staffing_plan_versions.checksum_format_version IS
    'Format 1 protects the historical snapshot shape; format 2 additionally protects granular coverage.';
