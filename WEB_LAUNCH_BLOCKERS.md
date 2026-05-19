# TurfOp web launch blocker checklist

_Last updated: 2026-05-07_

## Status legend
- [x] Fixed
- [ ] Open blocker
- [-] Verify before launch

## Launch blockers

- [x] Password reset could fail with HTTP 500 when SMTP was partially configured
  - Cause: reset delivery treated SMTP as ready when host/port/from were set, even if auth was incomplete.
  - Fix: `backend/src/lib/resetDelivery.js` now requires complete auth when `SMTP_USER` is present and avoids building SMTP auth with an empty password.
  - Verification: backend test suite now passes, including reset-flow tests.

- [x] Production build no longer silently falls back to seeded demo auth/data when the API is unavailable
  - Cause: frontend service layer previously returned demo users, demo courses, demo employees, and fake reset/invite success responses when the API could not be reached.
  - Fix: demo fallbacks are now development-only via `VITE_ENABLE_DEMO_MODE`; production/offline behavior now uses real cache/queue paths or throws a real API-unavailable error.
  - Verification: production build completed after the change.

- [ ] Production environment must be fully configured before launch
  - Required backend values: `DATABASE_URL`, `JWT_SECRET`, `APP_BASE_URL`, `CORS_ALLOWED_ORIGINS`
  - Required reset delivery decision:
    - either valid SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and if using auth both `SMTP_USER` + `SMTP_PASS`)
    - or explicitly defer password reset at launch
  - Why it blocks launch: auth and reset flows are core user journeys.

- [ ] Run a real production-path smoke test against deployed web + API
  - Sign in
  - Load memberships/courses
  - Create/edit/delete work order
  - Create/edit/delete equipment
  - Create employee + reset link flow
  - Offline queue save + later sync
  - Why it blocks launch: current verification is build/tests only, not deployed system behavior.

## High-priority prelaunch checks

- [-] Confirm `VITE_API_BASE_URL` points at the deployed API origin and `VITE_ENABLE_DEMO_MODE=false` for production builds
- [-] Confirm API `/health` is reachable from the deployed frontend origin
- [-] Confirm HTTPS is enabled for frontend and API
- [-] Confirm CORS only allows intended production origins
- [-] Confirm invite/reset links resolve to the production `APP_BASE_URL`
- [-] Confirm seeded demo credentials are not relied on in production operations

## Nice-to-have but not a hard blocker

- Add frontend smoke coverage for auth + work-order flows
- Add a scripted deploy/verify checklist
- Add productized empty/error states for degraded API scenarios
