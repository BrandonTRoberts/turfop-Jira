# TurfOp Platform Architecture

TurfOp is moving from a single-operator operations app into a multi-tenant operations platform. The design target is closer to a Jira-style platform monolith than a collection of isolated screens.

## Product direction

- Multi-tenant by default: each corporation is a tenant with strict data isolation.
- Work-order centric operations: work orders evolve toward platform-grade issue records with workflow, assignment, history, comments, attachments, and reporting.
- Configurable enterprise administration: clear platform-level administration separated from tenant-level administration.
- Reliability first: operational correctness, auditability, and recoverability matter more than shipping loose convenience features.

## Tenant model

- platform_admin
  - Global platform operator.
  - Can create and manage companies.
  - Can see cross-tenant platform inventory only where explicitly required for support and onboarding.
- company_super_user
  - Tenant-level administrator.
  - Scoped to a single company via employees.company_id.
  - Can manage courses, users, and reporting inside that tenant only.
- course_memberships.role
  - Course-scoped access remains admin, read_write, and read_only.
  - These roles govern daily operational access within a course.

## Boundary rules

- No tenant admin should ever see another tenant's courses, users, dashboards, inventory, work orders, or audit logs.
- Global administration must be explicit and rare. It should never be implied by a tenant role.
- New routes and queries should answer: "what tenant scope is this operating under?"

## Jira-style evolution path

The current work-order system should evolve toward a more structured issue model:

- Canonical issue/work item model
  - status
  - priority
  - assignee
  - watchers
  - due dates
  - comments
  - attachments
  - activity history
  - linked assets / inventory / time entries
- Workflow engine
  - configurable transitions
  - role-aware permissions
  - validation rules per transition
- Views
  - list
  - board
  - timeline
  - queue / SLA-oriented operational views
- Reporting
  - tenant-wide rollups
  - per-course operational reports
  - time-to-resolution, backlog health, labor and parts cost insights

## Technical direction

- Frontend
  - Keep React for now.
  - Move toward TypeScript and smaller feature modules.
  - Replace giant single-surface state handling with feature boundaries and clearer domain hooks.
- Backend
  - Keep PostgreSQL.
  - Harden the Node service into a clearer domain-oriented monolith.
  - Enforce tenant scoping centrally, not ad hoc in each route.
  - Add background job infrastructure for notifications, reporting, imports, and async maintenance tasks.
- Operations
  - Strong migrations and rollback discipline.
  - Better observability: structured logs, request tracing, metrics, alerting.
  - Staged deployment and repeatable environment setup.

## Immediate priorities

1. Separate platform admin from company admin semantics.
2. Lock tenant boundaries down in route permissions and tests.
3. Break the frontend into maintainable modules.
4. Introduce a richer work-item/workflow model.
5. Add enterprise readiness layers: jobs, observability, SSO-ready auth, stronger exports/reporting.
