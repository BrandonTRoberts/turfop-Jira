import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForCourse, isAdmin } from '../lib/permissions.js';
import { validateAuditQueryInput } from '../lib/validation.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { courseId, action = '', limit = '10', offset = '0' } = req.query;
  const parsedLimit = Number.parseInt(limit, 10);
  const parsedOffset = Number.parseInt(offset, 10);

  try {
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const validationError = validateAuditQueryInput({
      action: action || undefined,
      limit: Number.isNaN(parsedLimit) ? undefined : parsedLimit,
      offset: Number.isNaN(parsedOffset) ? undefined : parsedOffset
    });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const params = [courseId];
    let actionClause = '';
    if (action) {
      params.push(action);
      actionClause = ` and al.action = $${params.length}`;
    }

    params.push(parsedLimit || 10);
    params.push(parsedOffset || 0);

    const result = await query(
      `
        select
          al.id,
          al.action,
          al.detail,
          al.created_at,
          actor.full_name as actor_name,
          actor.email as actor_email,
          target.full_name as target_name,
          target.email as target_email,
          count(*) over() as total_count
        from audit_logs al
        left join employees actor on actor.id = al.actor_employee_id
        left join employees target on target.id = al.target_employee_id
        where al.course_id = $1${actionClause}
        order by al.created_at desc
        limit $${params.length - 1}
        offset $${params.length}
      `,
      params
    );

    const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
    const items = result.rows.map(({ total_count, ...row }) => row);

    res.json({
      items,
      total,
      limit: parsedLimit || 10,
      offset: parsedOffset || 0
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
