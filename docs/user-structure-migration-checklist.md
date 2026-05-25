# User Structure Migration Checklist (Course -> Facility)

## Goal
Complete the user-management cutover so all active user flows are facility-native, while preserving runtime stability.

## Scope
- Backend auth + employee/user-management routes
- Frontend user-management API calls and UI copy
- Tests for reset/invite/auth membership behavior

## Done Criteria
- [ ] No user-management query uses `course_memberships`
- [ ] Password reset request flow accepts/uses `facilityId`
- [ ] Frontend user-management calls send `facilityId` (invite/reset/resend/membership updates)
- [ ] Users panel copy references "facility" (not "course") for roles/membership context
- [ ] Backend auth + employee invite/reset related tests pass
- [ ] No new lint/type/build errors introduced

## Verification Commands
Run from repo root unless noted.

### Backend focused test suite
```bash
cd backend
npm test -- --run src/routes/auth.test.js src/routes/access.test.js src/routes/companyScope.test.js src/routes/employeeInvite.test.js
```

### Optional full backend tests
```bash
cd backend
npm test
```

### Frontend build
```bash
npm run build
```

## Remaining Follow-up Items
- Sweep remaining legacy naming in non-user domains (`courseId` aliases still present in work-order/time/equipment panels).
- Consider DB-schema naming follow-up (e.g., `invite_tokens.course_id`) only if/when migration safety window is approved.
- Add dedicated API tests for Service Templates and Company Inventory routes (currently limited route-level coverage for those pilot-critical features).

## Notes
- Preserve backward compatibility in mixed modules where full rename is not yet complete.
- Prefer explicit migration steps over broad global text replacement to avoid accidental breakage.