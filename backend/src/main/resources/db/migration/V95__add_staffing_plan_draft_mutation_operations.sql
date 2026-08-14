CREATE TABLE staffing_plan_draft_mutation_operations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    actor_membership_id UUID NOT NULL,
    operation_family VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    base_draft_revision BIGINT NOT NULL,
    resulting_draft_revision BIGINT,
    response_payload TEXT,
    operation_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_staffing_plan_draft_operations_plan
        FOREIGN KEY (plan_id, organization_id, unit_id)
        REFERENCES staffing_plans(id, organization_id, unit_id) ON DELETE CASCADE,
    CONSTRAINT ux_staffing_plan_draft_operations_key
        UNIQUE (organization_id, plan_id, operation_family, idempotency_key),
    CONSTRAINT ck_staffing_plan_draft_operations_status
        CHECK (operation_status IN ('PROCESSING', 'COMPLETED')),
    CONSTRAINT ck_staffing_plan_draft_operations_family CHECK (
        operation_family IN (
            'DEMAND_CREATE', 'DEMAND_BATCH',
            'ASSIGNMENT_CREATE', 'ASSIGNMENT_BATCH'
        )
    ),
    CONSTRAINT ck_staffing_plan_draft_operations_key CHECK (
        idempotency_key ~ '^[!-~]{1,200}$'
    ),
    CONSTRAINT ck_staffing_plan_draft_operations_revision
        CHECK (base_draft_revision >= 0
            AND (resulting_draft_revision IS NULL OR resulting_draft_revision >= 0)),
    CONSTRAINT ck_staffing_plan_draft_operations_fingerprint
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_staffing_plan_draft_operations_completion CHECK (
        (operation_status = 'PROCESSING' AND resulting_draft_revision IS NULL
            AND response_payload IS NULL AND completed_at IS NULL)
        OR
        (operation_status = 'COMPLETED' AND resulting_draft_revision IS NOT NULL
            AND response_payload IS NOT NULL AND completed_at IS NOT NULL)
    ),
    CONSTRAINT ck_staffing_plan_draft_operations_response CHECK (
        response_payload IS NULL OR (
            OCTET_LENGTH(response_payload) <= 65536
            AND response_payload IS JSON
        )
    )
);

CREATE INDEX ix_staffing_plan_draft_operations_plan_status
    ON staffing_plan_draft_mutation_operations(
        organization_id, unit_id, plan_id, operation_status);

CREATE INDEX ix_staffing_plan_draft_operations_created
    ON staffing_plan_draft_mutation_operations(created_at);
