# TurfOp Multi-Tenant Deployment Strategy

## Tenant Model

Use one shared application deployment and one shared Postgres database. Do not create a separate app or database per customer unless an enterprise customer contract requires physical isolation later.

The tenant hierarchy is:

1. Platform admin: TurfOp operator account. Can manage every company and course.
2. Company: customer business account.
3. Course: operational workspace owned by one company.
4. User membership: employee access to one or more courses in their company.

Operational records must always be scoped by `course_id`:

- `equipment.course_id`
- `parts_inventory.course_id`
- `work_orders.course_id`
- `employee_time_entries.course_id`
- `audit_logs.course_id`

Company-level access is derived through `courses.company_id`; user access is derived from `course_memberships`, `employees.company_id`, and `employees.company_role`.

## Authorization Rules

Every API route must resolve access from server-side identity, never from client-provided company names or route labels.

- Platform admins can access every company and course.
- Company super users can access all courses where `courses.company_id = employee.company_id`.
- Course admins can manage users and settings for that course.
- Read/write users can create and update operational records for courses where they have membership.
- Read-only users can view course records but cannot mutate them.

For no data leakage, every list query must include a course scope or a derived set of accessible courses. Every single-record update/delete must first load the record by id, then authorize against the record's existing `course_id` before changing it.

## Database Strategy

Recommended production baseline:

- Postgres as the system of record.
- Express API as the only database writer.
- UUID primary keys for all tenant and record identifiers.
- Foreign keys from course-owned tables to `courses(id)`.
- Unique constraints scoped by course, such as `unique (course_id, sku)` for inventory.
- Index every `course_id` and `company_id` used in authorization or dashboard rollups.
- Use `updated_at` optimistic concurrency on mutable operational records.

Row level security can be added later, but the current backend-owned connection model should first keep access control centralized in the API. If direct client-to-database access is introduced, RLS becomes mandatory before launch.

## Deployment Recommendation

Best path for this codebase:

- Frontend: static Vite build on Netlify or Cloudflare Pages.
- API: long-running Node service on a small VPS, Fly.io, Render, or Railway.
- Database: managed Postgres with automatic backups.
- Uploads: object storage for production media. Local `/uploads` is acceptable for development only.
- DNS:
  - `turfop.com` for the marketing/public app.
  - `app.turfop.com` for the authenticated app when routing is split.
  - `api.turfop.com` for the backend.

For the current stage, a single VPS with Nginx, systemd, Node, and managed Postgres is pragmatic and cheap. Before customer production data, move uploads to object storage and turn on daily database backups with restore testing.

## Implementation Priorities

1. Keep the backend course/company scoping as the source of truth.
2. Rebuild the frontend from API contracts instead of local seeded data.
3. Add integration tests for each new endpoint proving cross-company and cross-course access is denied.
4. Add audit logs for membership, inventory, equipment, work order, and time changes.
5. Add a company/course selector in the app that only displays courses returned by `/courses`.

## Non-Negotiables

- No operational query without course scope.
- No client-trusted company/course authorization.
- No global inventory or equipment tables.
- No employee access across companies.
- No production uploads on ephemeral local disk.
- No deployment without database backups and rollback notes.
