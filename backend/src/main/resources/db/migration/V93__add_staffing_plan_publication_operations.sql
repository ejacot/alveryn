ALTER TABLE staffing_plan_versions DROP CONSTRAINT ck_staffing_plan_versions_kind;
ALTER TABLE staffing_plan_versions DROP CONSTRAINT ux_staffing_plan_versions_revision;

UPDATE staffing_plan_versions
SET publication_kind = 'ATOMIC_WEEKLY'
WHERE publication_kind = 'ATOMIC';

ALTER TABLE staffing_plan_versions ADD CONSTRAINT ck_staffing_plan_versions_kind CHECK (
    publication_kind IN ('ATOMIC_WEEKLY', 'LEGACY_PARTIAL')
    AND (
        publication_kind = 'LEGACY_PARTIAL'
        OR (published_by_membership_id IS NOT NULL AND BTRIM(published_by_display_name) <> '')
    )
    AND (publication_kind <> 'ATOMIC_WEEKLY' OR source_draft_complete)
);

CREATE UNIQUE INDEX ux_staffing_plan_versions_atomic_revision
    ON staffing_plan_versions(plan_id, source_draft_revision)
    WHERE publication_kind = 'ATOMIC_WEEKLY';

CREATE TABLE staffing_plan_publication_operations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    source_fingerprint VARCHAR(64),
    expected_draft_revision BIGINT NOT NULL,
    operation_status VARCHAR(20) NOT NULL,
    resulting_version_id UUID,
    failure_code VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_staffing_plan_publication_operations_plan
        FOREIGN KEY (plan_id, organization_id, unit_id)
        REFERENCES staffing_plans(id, organization_id, unit_id) ON DELETE RESTRICT,
    CONSTRAINT fk_staffing_plan_publication_operations_result
        FOREIGN KEY (resulting_version_id, plan_id)
        REFERENCES staffing_plan_versions(id, plan_id) ON DELETE RESTRICT,
    CONSTRAINT ux_staffing_plan_publication_operations_key
        UNIQUE (organization_id, plan_id, idempotency_key),
    CONSTRAINT ck_staffing_plan_publication_operations_revision
        CHECK (expected_draft_revision >= 0),
    CONSTRAINT ck_staffing_plan_publication_operations_status
        CHECK (operation_status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_staffing_plan_publication_operations_fingerprints CHECK (
        request_fingerprint ~ '^[0-9a-f]{64}$'
        AND (source_fingerprint IS NULL OR source_fingerprint ~ '^[0-9a-f]{64}$')
    ),
    CONSTRAINT ck_staffing_plan_publication_operations_completion CHECK (
        (operation_status = 'PROCESSING' AND resulting_version_id IS NULL AND completed_at IS NULL)
        OR (operation_status = 'COMPLETED' AND resulting_version_id IS NOT NULL
            AND source_fingerprint IS NOT NULL AND completed_at IS NOT NULL AND failure_code IS NULL)
        OR (operation_status = 'FAILED' AND resulting_version_id IS NULL
            AND completed_at IS NOT NULL AND failure_code IS NOT NULL)
    )
);

CREATE INDEX ix_staffing_plan_publication_operations_plan_status
    ON staffing_plan_publication_operations(organization_id, unit_id, plan_id, operation_status);
CREATE INDEX ix_staffing_plan_publication_operations_diagnostics
    ON staffing_plan_publication_operations(operation_status, created_at);
