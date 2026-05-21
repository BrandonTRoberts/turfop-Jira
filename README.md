# TurfOp

TurfOp is an operations platform for golf-course and turf-maintenance teams. It combines work orders, equipment tracking, parts inventory, employee/course access, and time tracking in one web/mobile-ready app.

## Current Stack

- Frontend: React 18, Vite, Tailwind CSS, shadcn-style UI components
- Backend: Node.js, Express, PostgreSQL
- Auth: JWT/cookie-backed employee sessions with course-scoped permissions
- Deployment: Cloudflare frontend assets via Wrangler, separate Node API at `api.turfop.com`
- Mobile: Capacitor Android/iOS targets

## Main Product Areas

- Marketing/public site routes: `/`, `/pricing`, `/security`, `/book-demo`, `/privacy`, `/terms`, `/signin`, `/invite`
- Authenticated app routes and shell: dashboard, work orders, team, time, equipment, inventory, admin
- Multi-company / multi-course access control
- Backend dashboard rollups for operations metrics
- Work order activity, comments, attachments, equipment and parts linkage
- Inventory quantity/cost tracking
- Employee directory, invitations, profile images, and role management
- Clock-in/clock-out and payroll summaries

## Local Frontend Setup

```bash
cd /home/btr/Desktop/Turfop.com
npm install
npm run dev
```

The frontend dev server runs at `http://localhost:5173`.

Useful frontend environment variables:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_ENABLE_DEMO_MODE=true
```

For production builds, use:

```bash
npm run build:production
```

## Local Backend Setup

```bash
cd /home/btr/Desktop/Turfop.com/backend
npm install
cp .env.example .env
npm run dev
```

Required backend environment variables include:

- `DATABASE_URL`
- `JWT_SECRET` with at least 32 characters
- `APP_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- SMTP variables if invitation/reset email delivery is enabled

## Validation Commands

From the repo root:

```bash
npm run lint
npm run test
npm run build
npm run validate
```

From `backend/`:

```bash
npm test
```

`npm run validate` runs frontend lint, frontend tests, and the production frontend build.

## Frontend Architecture Notes

- `src/entry.jsx` chooses public marketing vs authenticated app based on `src/routes.js`.
- `src/components/App.jsx` owns the authenticated app shell, session state, selected course state, and course-scoped data loading.
- `src/components/views/DashboardView.jsx` renders backend dashboard metrics from `/dashboard/overview`.
- `src/components/boards/issueWorkflow.js` keeps current backend work-order status values stable while allowing friendlier column labels in the UI.
- `src/services/api.js` is the single frontend API client.

## Deployment Notes

Frontend SPA deployment is configured in `wrangler.jsonc`:

```jsonc
"assets": {
  "directory": "./dist",
  "not_found_handling": "single-page-application"
}
```

The production frontend should call:

```bash
VITE_API_BASE_URL=https://api.turfop.com
```

## Current Recommended Next Steps

1. Continue breaking `App.jsx` and `IssueBoard.jsx` into smaller hooks/components.
2. Add deeper frontend tests around login, role-gated controls, and work-order form behavior.
3. Add a migration/seed runner for local database setup.
4. Finish or remove the untracked Docker Compose setup.
5. Decide whether web production auth should rely on httpOnly cookies instead of localStorage tokens.
