# TurfOp Staging Release Checklist

Use this checklist before promoting any build to production.

## 1) Branch and environment controls

- [ ] Deploy staging from `staging` (or `develop`) only
- [ ] Protect `main` branch from direct pushes
- [ ] Use separate staging secrets (never reuse production secrets)
- [ ] Confirm staging uses its own database and storage

## 2) Pre-deploy quality gate (local/CI)

- [ ] `npm run validate` passes at repo root
- [ ] `cd backend && npm audit --json` reports 0 high/critical vulnerabilities
- [ ] Manual review of changed auth, permissions, and API routes for regressions

## 3) Deploy to staging

- [ ] Frontend deployed to staging URL
- [ ] Backend deployed to staging API URL
- [ ] Environment variables confirmed:
  - `CORS_ALLOWED_ORIGINS` includes staging frontend URL
  - `APP_BASE_URL` points to staging frontend URL
  - `JWT_SECRET` is set and >= 32 chars

## 4) Smoke test (required)

Run:

`STAGING_WEB_URL=https://<staging-web> STAGING_API_URL=https://<staging-api> npm run smoke:staging`

Pass criteria:

- [ ] Frontend home route returns 200
- [ ] Frontend sign-in route returns 200
- [ ] API root route returns 200 and expected service identity
- [ ] API health route returns 200
- [ ] Security headers present on API responses (CSP, HSTS in prod-like env)

## 5) Functional staging checks

- [ ] Sign in works
- [ ] Session persists after refresh (cookie-based auth)
- [ ] Logout clears session
- [ ] Invite acceptance flow works
- [ ] Password reset request flow works
- [ ] Work order create/update/comment works
- [ ] Inventory create/update/delete works
- [ ] Facility scoping behaves correctly across views

## 6) Security checks

- [ ] CSRF protection blocks unsafe cross-origin requests
- [ ] CORS blocks unauthorized origins
- [ ] No auth token in localStorage
- [ ] Backend audit logs written for critical auth/invite/reset actions

## 7) Promotion gate to production

- [ ] All checklist items complete
- [ ] Stakeholder sign-off recorded
- [ ] Rollback plan documented (previous stable deploy + rollback command)
- [ ] Production deploy approved and scheduled

## 8) Post-production validation

- [ ] Run smoke script against production URLs
- [ ] Confirm no P0/P1 errors in logs after release window
- [ ] Confirm critical user journeys working in live environment
