import { query } from './db.js';

export async function logAuditEvent({ actorEmployeeId, action, facilityId = null, targetEmployeeId = null, detail = null }) {
  await query(
    `
      insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
      values ($1, $2, $3, $4, $5)
    `,
    [actorEmployeeId, action, facilityId, targetEmployeeId, detail]
  );
}

// Hard cut-over: keep old argument name as an alias so any remaining callers still work
// after the facility migration (they should be updated to pass facilityId).
export async function logAuditEventCourseCompat({ actorEmployeeId, action, courseId = null, targetEmployeeId = null, detail = null }) {
  return logAuditEvent({ actorEmployeeId, action, facilityId: courseId, targetEmployeeId, detail });
}
