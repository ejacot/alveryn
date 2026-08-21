ALTER TABLE staffing_plan_versions
    ADD COLUMN coverage_raw_assigned INTEGER,
    ADD COLUMN coverage_effective_assigned INTEGER,
    ADD COLUMN coverage_covered INTEGER,
    ADD COLUMN coverage_missing INTEGER,
    ADD COLUMN coverage_overstaffed INTEGER,
    ADD CONSTRAINT ck_staffing_plan_versions_canonical_coverage CHECK (
        (
            coverage_raw_assigned IS NULL
            AND coverage_effective_assigned IS NULL
            AND coverage_covered IS NULL
            AND coverage_missing IS NULL
            AND coverage_overstaffed IS NULL
        )
        OR (
            coverage_raw_assigned >= 0
            AND coverage_effective_assigned >= 0
            AND coverage_covered >= 0
            AND coverage_missing >= 0
            AND coverage_overstaffed >= 0
            AND coverage_effective_assigned <= coverage_raw_assigned
            AND coverage_covered + coverage_missing = coverage_required
            AND coverage_covered + coverage_overstaffed = coverage_effective_assigned
        )
    );

COMMENT ON COLUMN staffing_plan_versions.coverage_assigned IS
    'Legacy compatibility value. LEGACY_V90 rows retain historical covered semantics; new ATOMIC_WEEKLY rows store effective assigned.';
COMMENT ON COLUMN staffing_plan_versions.coverage_raw_assigned IS
    'Canonical count of non-cancelled assignments at publication time.';
COMMENT ON COLUMN staffing_plan_versions.coverage_effective_assigned IS
    'Canonical count of assignments eligible for effective coverage at publication time.';
COMMENT ON COLUMN staffing_plan_versions.coverage_covered IS
    'Canonical sum of min(effective assigned, required) per requirement.';
COMMENT ON COLUMN staffing_plan_versions.coverage_missing IS
    'Canonical sum of max(required - effective assigned, 0) per requirement.';
COMMENT ON COLUMN staffing_plan_versions.coverage_overstaffed IS
    'Canonical sum of max(effective assigned - required, 0) per requirement.';
