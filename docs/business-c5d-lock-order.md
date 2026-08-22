# Business weekly-plan lock order (C5d)

The canonical pessimistic lock order for Business weekly planning is:

1. `Organization`
2. `OrganizationUnit`
3. `StaffingPlan` (UUID order when more than one plan is involved)
4. aggregate children

`StaffingPlanBootstrapService` is the only production flow that takes the organization creation
mutex. It takes `Organization` before delegating to `StaffingPlanFactory`, which takes the stable
`OrganizationUnit` row before looking up or inserting the natural key `(organization, unit,
weekStart)`. Bootstrap never locks an existing `StaffingPlan` and never creates children.

The existing aggregate mutation path (`StaffingPlanMutationCoordinator`) can take the unit mutex
only while creating a missing plan, then takes plan locks in UUID order. The publication path
(`StaffingPlanPublicationService`) takes only the scoped plan lock. Neither path tries to acquire an
organization lock after a unit or plan lock. The C4a/C5b production lock paths therefore have no
reverse edge back to `Organization`, and C5d does not introduce a lock cycle.

Any future production flow that needs more than one of these pessimistic locks must preserve the
same order. In particular, code holding a unit or plan lock must not subsequently acquire the
organization mutex.
