import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForCourse, isAdmin } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/course-summary', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  try {
    const role = await getRoleForCourse(req.employee, courseId);
    if (!role) {
      return res.status(403).json({ error: 'No access to this course' });
    }
    if (!isAdmin(role)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const [workOrderTotals, partsTotals] = await Promise.all([
      query(
        `
          select
            count(*)::int as work_order_count,
            coalesce(sum(labor_hours), 0) as labor_hours_total,
            coalesce(sum(labor_cost), 0) as labor_cost_total,
            coalesce(sum(parts_cost), 0) as parts_cost_total,
            coalesce(sum(total_cost), 0) as total_cost_total
          from work_orders
          where course_id = $1
        `,
        [courseId]
      ),
      query(
        `
          select
            count(*)::int as part_count,
            coalesce(sum(quantity_on_hand), 0) as quantity_on_hand_total,
            coalesce(sum(quantity_on_hand * unit_cost), 0) as inventory_value_total
          from parts_inventory
          where course_id = $1
        `,
        [courseId]
      )
    ]);

    res.json({
      workOrders: workOrderTotals.rows[0],
      parts: partsTotals.rows[0]
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
