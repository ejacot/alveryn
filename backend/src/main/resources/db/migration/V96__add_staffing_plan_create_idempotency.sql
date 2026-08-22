ALTER TABLE staffing_plan_draft_mutation_operations
    DROP CONSTRAINT ck_staffing_plan_draft_operations_family;

ALTER TABLE staffing_plan_draft_mutation_operations
    ADD CONSTRAINT ck_staffing_plan_draft_operations_family CHECK (
        operation_family IN (
            'PLAN_CREATE',
            'DEMAND_CREATE', 'DEMAND_BATCH',
            'ASSIGNMENT_CREATE', 'ASSIGNMENT_BATCH'
        )
    );

CREATE UNIQUE INDEX ux_staffing_plan_create_operations_key
    ON staffing_plan_draft_mutation_operations(
        organization_id, operation_family, idempotency_key)
    WHERE operation_family = 'PLAN_CREATE';
