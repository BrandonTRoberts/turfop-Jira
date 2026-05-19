import { query } from './db.js';

export async function logAuditEvent({ actorEmployeeId, action, courseId = null, targetEmployeeId = null, detail = null }) {
  await query(
    `
      insert into audit_logs (actor_employee_id, action, course_id, target_employee_id, detail)
      values ($1, $2, $3, $4, $5)
    `,
    [actorEmployeeId, action, courseId, targetEmployeeId, detail]
  );
}
