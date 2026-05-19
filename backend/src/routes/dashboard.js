import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getMembershipsForEmployee, getRoleForCourse, isCompanySuperUser, isGlobalSuperUser } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

async function resolveScopedCourseIds(employee, courseId) {
  if (courseId) {
    const role = await getRoleForCourse(employee, courseId);
    if (!role) {
      return null;
    }

    return [courseId];
  }

  if (isGlobalSuperUser(employee)) {
    const companyCourses = await query(
      `
        select id
        from courses
        order by name asc
      `
    );

    return companyCourses.rows.map((row) => row.id);
  }

  if (isCompanySuperUser(employee)) {
    const companyCourses = await query(
      `
        select id
        from courses
        where company_id = $1
        order by name asc
      `,
      [employee.company_id]
    );

    return companyCourses.rows.map((row) => row.id);
  }

  const memberships = await getMembershipsForEmployee(employee.id);
  return memberships.map((membership) => membership.course_id);
}

router.get('/overview', requireAuth, async (req, res) => {
  const { courseId = '' } = req.query;

  try {
    const courseIds = await resolveScopedCourseIds(req.employee, courseId);
    if (courseIds === null) {
      return res.status(403).json({ error: 'No access to this course' });
    }

    if (!courseIds.length) {
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
          activeCourses: 0,
          equipmentNeedingAttention: 0
        },
        rollups: {
          workOrdersByCourse: [],
          hoursByCourse: [],
          lowStockByCourse: []
        }
      });
    }

    const [summaryResult, workOrdersByCourseResult, hoursByCourseResult, lowStockByCourseResult] = await Promise.all([
      query(
        `
          with scoped_courses as (
            select unnest($1::uuid[]) as course_id
          ), scoped_work_orders as (
            select wo.*
            from work_orders wo
            join scoped_courses sc on sc.course_id = wo.course_id
          ), scoped_time_entries as (
            select te.*
            from employee_time_entries te
            join scoped_courses sc on sc.course_id = te.course_id
          ), scoped_inventory as (
            select pi.*
            from parts_inventory pi
            join scoped_courses sc on sc.course_id = pi.course_id
          ), scoped_equipment as (
            select eq.*
            from equipment eq
            join scoped_courses sc on sc.course_id = eq.course_id
          ), scoped_employees as (
            select distinct e.id
            from employees e
            join course_memberships cm on cm.employee_id = e.id
            join scoped_courses sc on sc.course_id = cm.course_id
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
            (select count(*)::int from scoped_work_orders where status <> 'Completed') as open_work_orders,
            (select count(*)::int from scoped_work_orders where status = 'Due today') as overdue_work_orders,
            (select count(*)::int from scoped_work_orders where status = 'Completed' and completed_at >= date_trunc('week', now())) as completed_this_week,
            (select round(coalesce(avg(extract(epoch from (completed_at - created_at)) / 3600.0), 0)::numeric, 2) from scoped_work_orders where status = 'Completed' and completed_at is not null) as mttr_hours,
            (select active_entries::int from weekly_time) as clocked_in_now,
            (select round(total_hours::numeric, 2) from weekly_time) as total_hours_this_week,
            (select round(overtime_hours::numeric, 2) from weekly_time) as overtime_hours_this_week,
            (select pending_approvals::int from weekly_time) as pending_approvals,
            (select count(*)::int from scoped_inventory) as total_skus,
            (select count(*)::int from scoped_inventory where coalesce(quantity_on_hand, 0) <= 2) as low_stock_items,
            (select count(*)::int from scoped_inventory where coalesce(quantity_on_hand, 0) <= 0) as out_of_stock_items,
            (select round(coalesce(sum(coalesce(quantity_on_hand, 0) * coalesce(unit_cost, 0)), 0)::numeric, 2) from scoped_inventory) as inventory_value,
            (select count(*)::int from scoped_employees) as total_employees,
            (select count(*)::int from scoped_courses) as active_courses,
            (select count(*)::int from scoped_equipment where status in ('Needs service', 'Overdue')) as equipment_needing_attention
        `,
        [courseIds]
      ),
      query(
        `
          select c.id as course_id, c.name,
                 count(wo.id) filter (where wo.status <> 'Completed')::int as open_work_orders,
                 count(wo.id) filter (where wo.status = 'Completed' and wo.completed_at >= date_trunc('week', now()))::int as completed_this_week
          from courses c
          join unnest($1::uuid[]) with ordinality as scoped(course_id, ord) on scoped.course_id = c.id
          left join work_orders wo on wo.course_id = c.id
          group by c.id, c.name, scoped.ord
          order by scoped.ord asc
        `,
        [courseIds]
      ),
      query(
        `
          select c.id as course_id, c.name,
                 round(coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0), 0)::numeric, 2) as total_hours
          from courses c
          join unnest($1::uuid[]) with ordinality as scoped(course_id, ord) on scoped.course_id = c.id
          left join employee_time_entries te on te.course_id = c.id and te.clock_in_at >= date_trunc('week', now())
          group by c.id, c.name, scoped.ord
          order by scoped.ord asc
        `,
        [courseIds]
      ),
      query(
        `
          select c.id as course_id, c.name,
                 count(pi.id) filter (where coalesce(pi.quantity_on_hand, 0) <= 2)::int as low_stock_items
          from courses c
          join unnest($1::uuid[]) with ordinality as scoped(course_id, ord) on scoped.course_id = c.id
          left join parts_inventory pi on pi.course_id = c.id
          group by c.id, c.name, scoped.ord
          order by scoped.ord asc
        `,
        [courseIds]
      )
    ]);

    const summary = summaryResult.rows[0] || {};

    return res.json({
      summary: {
        openWorkOrders: Number(summary.open_work_orders || 0),
        overdueWorkOrders: Number(summary.overdue_work_orders || 0),
        completedThisWeek: Number(summary.completed_this_week || 0),
        mttrHours: Number(summary.mttr_hours || 0),
        clockedInNow: Number(summary.clocked_in_now || 0),
        totalHoursThisWeek: Number(summary.total_hours_this_week || 0),
        overtimeHoursThisWeek: Number(summary.overtime_hours_this_week || 0),
        pendingApprovals: Number(summary.pending_approvals || 0),
        totalSkus: Number(summary.total_skus || 0),
        lowStockItems: Number(summary.low_stock_items || 0),
        outOfStockItems: Number(summary.out_of_stock_items || 0),
        inventoryValue: Number(summary.inventory_value || 0),
        totalEmployees: Number(summary.total_employees || 0),
        activeCourses: Number(summary.active_courses || 0),
        equipmentNeedingAttention: Number(summary.equipment_needing_attention || 0)
      },
      rollups: {
        workOrdersByCourse: workOrdersByCourseResult.rows,
        hoursByCourse: hoursByCourseResult.rows,
        lowStockByCourse: lowStockByCourseResult.rows
      }
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
