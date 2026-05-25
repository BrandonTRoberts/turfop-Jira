import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getMembershipsForEmployee, getRoleForFacility, isCompanySuperUser, isGlobalSuperUser } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

async function resolveScopedFacilityIds(employee, facilityId) {
  if (facilityId) {
    const role = await getRoleForFacility(employee, facilityId);
    if (!role) {
      return null;
    }

    return [facilityId];
  }

  if (isGlobalSuperUser(employee)) {
    const companyFacilities = await query(
      `
        select id
        from facilities
        order by name asc
      `
    );

    return companyFacilities.rows.map((row) => row.id);
  }

  if (isCompanySuperUser(employee)) {
    const companyFacilities = await query(
      `
        select id
        from facilities
        where company_id = $1
        order by name asc
      `,
      [employee.company_id]
    );

    return companyFacilities.rows.map((row) => row.id);
  }

  const memberships = await getMembershipsForEmployee(employee.id);
  return memberships.map((membership) => membership.facility_id);
}

router.get('/overview', requireAuth, async (req, res) => {
  const { facilityId = '' } = req.query;

  try {
    const facilityIds = await resolveScopedFacilityIds(req.employee, facilityId);
    if (facilityIds === null) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    if (!facilityIds.length) {
      return res.json({
        summary: {
          openWorkOrders: 0,
          overdueWorkOrders: 0,
          completedThisWeek: 0,
          mttrHours: 0,
          clockedInNow: 0,
          totalHoursThisWeek: 0,
          overtimeHoursThisWeek: 0,
          pendingApprovals: 0,
          totalSkus: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          inventoryValue: 0,
          totalEmployees: 0,
          activeFacilities: 0,
          equipmentNeedingAttention: 0
        },
        rollups: {
          workOrdersByFacility: [],
          hoursByFacility: [],
          lowStockByFacility: []
        }
      });
    }

    const [summaryResult, workOrdersByFacilityResult, hoursByFacilityResult, lowStockByFacilityResult] = await Promise.all([
      query(
        `
          with scoped_facilities as (
            select unnest($1::uuid[]) as facility_id
          ), scoped_work_orders as (
            select wo.*
            from work_orders wo
            join scoped_facilities sf on sf.facility_id = wo.facility_id
          ), scoped_time_entries as (
            select te.*
            from employee_time_entries te
            join scoped_facilities sf on sf.facility_id = te.facility_id
          ), scoped_inventory as (
            select pi.*
            from parts_inventory pi
            join scoped_facilities sf on sf.facility_id = pi.facility_id
          ), scoped_equipment as (
            select eq.*
            from equipment eq
            join scoped_facilities sf on sf.facility_id = eq.facility_id
          ), scoped_employees as (
            select distinct e.id
            from employees e
            join facility_memberships fm on fm.employee_id = e.id
            join scoped_facilities sf on sf.facility_id = fm.facility_id
          ), weekly_time as (
            select
              coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0), 0) as total_hours,
              coalesce(sum(greatest((extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0) - 8, 0)), 0) as overtime_hours,
              count(*) filter (where te.approved_at is null) as pending_approvals,
              count(*) filter (where te.clock_out_at is null) as active_entries
            from scoped_time_entries te
            where te.clock_in_at >= date_trunc('week', now())
          )
          select
            count(*) filter (where wo.status != 'completed') as open_work_orders,
            count(*) filter (where wo.status != 'completed' and wo.due_date < current_date) as overdue_work_orders,
            count(*) filter (where wo.status = 'completed' and wo.completed_at >= date_trunc('week', now())) as completed_this_week,
            coalesce(avg(extract(epoch from (wo.completed_at - wo.created_at)) / 3600.0) filter (where wo.status = 'completed' and wo.completed_at >= date_trunc('week', now() - interval '4 weeks')), 0) as mttr_hours,
            (select active_entries from weekly_time) as clocked_in_now,
            (select total_hours from weekly_time) as total_hours_this_week,
            (select overtime_hours from weekly_time) as overtime_hours_this_week,
            (select pending_approvals from weekly_time) as pending_approvals,
            (select count(*) from scoped_inventory) as total_skus,
            (select count(*) from scoped_inventory where quantity_on_hand <= min_quantity_threshold) as low_stock_items,
            (select count(*) from scoped_inventory where quantity_on_hand = 0) as out_of_stock_items,
            (select coalesce(sum(unit_cost * quantity_on_hand), 0) from scoped_inventory) as inventory_value,
            (select count(*) from scoped_employees) as total_employees,
            (select count(*) from scoped_facilities) as active_facilities,
            (select count(*) from scoped_equipment where needs_attention = true) as equipment_needing_attention
          from scoped_work_orders wo
        `,
        [facilityIds]
      ),
      query(
        `
          select
            wo.facility_id,
            f.name,
            count(wo.id) filter (where wo.status != 'completed') as open_work_orders,
            count(wo.id) filter (where wo.status = 'completed' and wo.completed_at >= date_trunc('week', now())) as completed_this_week
          from work_orders wo
          join facilities f on f.id = wo.facility_id
          where wo.facility_id = any($1::uuid[])
          group by wo.facility_id, f.name
          order by f.name asc
        `,
        [facilityIds]
      ),
      query(
        `
          select
            te.facility_id,
            f.name,
            coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0), 0) as total_hours,
            coalesce(sum(greatest((extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0) - 8, 0)), 0) as overtime_hours
          from employee_time_entries te
          join facilities f on f.id = te.facility_id
          where te.facility_id = any($1::uuid[])
            and te.clock_in_at >= date_trunc('week', now())
          group by te.facility_id, f.name
          order by f.name asc
        `,
        [facilityIds]
      ),
      query(
        `
          select
            pi.facility_id,
            f.name,
            count(*) as low_stock_items
          from parts_inventory pi
          join facilities f on f.id = pi.facility_id
          where pi.facility_id = any($1::uuid[])
            and pi.quantity_on_hand <= pi.min_quantity_threshold
          group by pi.facility_id, f.name
          order by f.name asc
        `,
        [facilityIds]
      )
    ]);

    const summaryRow = summaryResult.rows[0] || {};

    return res.json({
      summary: {
        openWorkOrders: Number(summaryRow.open_work_orders || 0),
        overdueWorkOrders: Number(summaryRow.overdue_work_orders || 0),
        completedThisWeek: Number(summaryRow.completed_this_week || 0),
        mttrHours: Number(summaryRow.mttr_hours || 0),
        clockedInNow: Number(summaryRow.clocked_in_now || 0),
        totalHoursThisWeek: Number(summaryRow.total_hours_this_week || 0),
        overtimeHoursThisWeek: Number(summaryRow.overtime_hours_this_week || 0),
        pendingApprovals: Number(summaryRow.pending_approvals || 0),
        totalSkus: Number(summaryRow.total_skus || 0),
        lowStockItems: Number(summaryRow.low_stock_items || 0),
        outOfStockItems: Number(summaryRow.out_of_stock_items || 0),
        inventoryValue: Number(summaryRow.inventory_value || 0),
        totalEmployees: Number(summaryRow.total_employees || 0),
        activeFacilities: Number(summaryRow.active_facilities || 0),
        equipmentNeedingAttention: Number(summaryRow.equipment_needing_attention || 0)
      },
      rollups: {
        workOrdersByFacility: workOrdersByFacilityResult.rows,
        hoursByFacility: hoursByFacilityResult.rows,
        lowStockByFacility: lowStockByFacilityResult.rows
      }
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
