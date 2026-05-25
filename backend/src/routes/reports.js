import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForFacility, isAdmin } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/course-summary', requireAuth, async (req, res) => {
  const { facilityId } = req.query;

  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!role) {
      return res.status(403).json({ error: 'No access to this facility' });
    }
    if (!isAdmin(role)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
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
          where facility_id = $1
        `,
        [facilityId]
      ),
      query(
        `
          select
            count(*)::int as part_count,
            coalesce(sum(quantity_on_hand), 0) as quantity_on_hand_total,
            coalesce(sum(quantity_on_hand * unit_cost), 0) as inventory_value_total
          from parts_inventory
          where facility_id = $1
        `,
        [facilityId]
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
