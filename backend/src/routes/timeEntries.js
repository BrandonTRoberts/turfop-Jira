import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForFacility, isAdmin } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';
import {
  validateTimeEntryActionInput,
  validateTimeEntryApprovalInput,
  validateTimeEntryQueryInput,
  validateTimeEntryUpdateInput
} from '../lib/validation.js';

const router = Router();

function addSummaryHours(row) {
  const totalHours = Number(row.total_hours || 0);
  const overtimeHours = Number(row.overtime_hours ?? Math.max(0, totalHours - 40));
  const regularHours = Number(row.regular_hours ?? Math.max(0, totalHours - overtimeHours));
  const hourlyRate = Number(row.hourly_rate || 0);
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * 1.5;
  return {
    ...row,
    hourly_rate: Number(hourlyRate.toFixed(2)),
    total_hours: Number(totalHours.toFixed(2)),
    regular_hours: Number(regularHours.toFixed(2)),
    overtime_hours: Number(overtimeHours.toFixed(2)),
    regular_pay: Number(regularPay.toFixed(2)),
    overtime_pay: Number(overtimePay.toFixed(2)),
    total_pay: Number((regularPay + overtimePay).toFixed(2))
  };
}

const timeEntrySelect = `
  select
    te.id,
    te.employee_id,
    te.facility_id,
    te.clock_in_at,
    te.clock_out_at,
    te.clock_in_note,
    te.clock_out_note,
    te.clock_in_latitude,
    te.clock_in_longitude,
    te.clock_out_latitude,
    te.clock_out_longitude,
    te.approved_at,
    te.approved_by_employee_id,
    te.approval_note,
    te.updated_at,
    te.created_at,
    round((extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0)::numeric, 2) as worked_hours,
    e.full_name as employee_name,
    e.email as employee_email,
    approver.full_name as approved_by_name,
    approver.email as approved_by_email
  from employee_time_entries te
  join employees e on e.id = te.employee_id
  left join employees approver on approver.id = te.approved_by_employee_id
`;

async function ensureFacilityRole(employee, facilityId) {
  const role = await getRoleForFacility(employee, facilityId);
  return role;
}

router.get('/', requireAuth, async (req, res) => {
  const { facilityId, employeeId = '' } = req.query;
  const scope = req.query.scope === 'course' ? 'course' : 'mine';
  const parsedLimit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 14;

  try {
    const validationError = validateTimeEntryQueryInput({ facilityId, employeeId, scope, limit: parsedLimit });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await ensureFacilityRole(req.employee, facilityId);
    if (!currentRole) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    if (scope === 'course' && !isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const params = [facilityId];
    let whereClause = 'where te.facility_id = $1';

    if (scope === 'mine') {
      params.push(req.employee.id);
      whereClause += ` and te.employee_id = $${params.length}`;
    } else if (employeeId) {
      params.push(employeeId);
      whereClause += ` and te.employee_id = $${params.length}`;
    }

    params.push(parsedLimit);

    const result = await query(
      `
        ${timeEntrySelect}
        ${whereClause}
        order by te.clock_in_at desc
        limit $${params.length}
      `,
      params
    );

    const items = result.rows;
    return res.json({
      items,
      activeEntry: items.find((entry) => !entry.clock_out_at) || null
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  const { facilityId, employeeId = '', startDate = '', endDate = '' } = req.query;
  const scope = req.query.scope === 'course' ? 'course' : 'mine';
  const approvedOnly = req.query.approvedOnly === 'true';

  try {
    const validationError = validateTimeEntryQueryInput({ facilityId, employeeId, scope, limit: 14, startDate, endDate, approvedOnly });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await ensureFacilityRole(req.employee, facilityId);
    if (!currentRole) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    if (scope === 'course' && !isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const params = [facilityId];
    let whereClause = 'where te.facility_id = $1';

    if (startDate) {
      params.push(startDate);
      whereClause += ` and te.clock_in_at >= $${params.length}::timestamptz`;
    } else {
      whereClause += ` and te.clock_in_at >= date_trunc('week', now())`;
    }

    if (endDate) {
      params.push(endDate);
      whereClause += ` and te.clock_in_at <= $${params.length}::timestamptz`;
    }

    if (approvedOnly) {
      whereClause += ' and te.approved_at is not null';
    }

    if (scope === 'mine') {
      params.push(req.employee.id);
      whereClause += ` and te.employee_id = $${params.length}`;
    } else if (employeeId) {
      params.push(employeeId);
      whereClause += ` and te.employee_id = $${params.length}`;
    }

    const summary = await query(
      `
        with entry_summary as (
          select
            te.employee_id,
            e.full_name as employee_name,
            e.email as employee_email,
            e.hourly_rate,
            count(*) as entry_count,
            count(*) filter (where te.clock_out_at is null) as active_entry_count,
            count(*) filter (where te.approved_at is not null) as approved_entry_count,
            round(coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0), 0)::numeric, 2) as total_hours
          from employee_time_entries te
          join employees e on e.id = te.employee_id
          ${whereClause}
          group by te.employee_id, e.full_name, e.email, e.hourly_rate
        ), weekly_hours as (
          select
            te.employee_id,
            date_trunc('week', te.clock_in_at) as week_start,
            round(coalesce(sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0), 0)::numeric, 2) as week_hours
          from employee_time_entries te
          ${whereClause}
          group by te.employee_id, date_trunc('week', te.clock_in_at)
        ), weekly_rollup as (
          select
            employee_id,
            round(sum(least(week_hours, 40))::numeric, 2) as regular_hours,
            round(sum(greatest(week_hours - 40, 0))::numeric, 2) as overtime_hours
          from weekly_hours
          group by employee_id
        )
        select
          es.employee_id,
          es.employee_name,
          es.employee_email,
          es.hourly_rate,
          es.entry_count,
          es.active_entry_count,
          es.approved_entry_count,
          es.total_hours,
          coalesce(wr.regular_hours, 0) as regular_hours,
          coalesce(wr.overtime_hours, 0) as overtime_hours
        from entry_summary es
        left join weekly_rollup wr on wr.employee_id = es.employee_id
        order by es.employee_name asc nulls last, es.employee_email asc
      `,
      params
    );

    const items = summary.rows.map(addSummaryHours);

    const totals = items.reduce((acc, row) => ({
      totalHours: Number(acc.totalHours || 0) + Number(row.total_hours || 0),
      regularHours: Number(acc.regularHours || 0) + Number(row.regular_hours || 0),
      overtimeHours: Number(acc.overtimeHours || 0) + Number(row.overtime_hours || 0),
      regularPay: Number(acc.regularPay || 0) + Number(row.regular_pay || 0),
      overtimePay: Number(acc.overtimePay || 0) + Number(row.overtime_pay || 0),
      totalPay: Number(acc.totalPay || 0) + Number(row.total_pay || 0),
      totalEntries: Number(acc.totalEntries || 0) + Number(row.entry_count || 0),
      activeEntries: Number(acc.activeEntries || 0) + Number(row.active_entry_count || 0),
      approvedEntries: Number(acc.approvedEntries || 0) + Number(row.approved_entry_count || 0)
    }), { totalHours: 0, regularHours: 0, overtimeHours: 0, regularPay: 0, overtimePay: 0, totalPay: 0, totalEntries: 0, activeEntries: 0, approvedEntries: 0 });

    return res.json({
      weekStartsAt: startDate || new Date().toISOString(),
      rangeEndAt: endDate || '',
      scope,
      approvedOnly,
      items,
      totals: {
        totalHours: Number(totals.totalHours.toFixed(2)),
        regularHours: Number(totals.regularHours.toFixed(2)),
        overtimeHours: Number(totals.overtimeHours.toFixed(2)),
        regularPay: Number(totals.regularPay.toFixed(2)),
        overtimePay: Number(totals.overtimePay.toFixed(2)),
        totalPay: Number(totals.totalPay.toFixed(2)),
        totalEntries: totals.totalEntries,
        activeEntries: totals.activeEntries,
        approvedEntries: totals.approvedEntries
      }
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/clock-in', requireAuth, async (req, res) => {
  const { facilityId, note = '', location = null } = req.body;

  try {
    const validationError = validateTimeEntryActionInput({ facilityId, note, location });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await ensureFacilityRole(req.employee, facilityId);
    if (!currentRole) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    const client = await connect();

    try {
      await client.query('begin');

      const existing = await client.query(
        `
          select id
          from employee_time_entries
          where employee_id = $1 and facility_id = $2 and clock_out_at is null
          limit 1
        `,
        [req.employee.id, facilityId]
      );

      if (existing.rows.length) {
        await client.query('rollback');
        return res.status(409).json({ error: 'You are already clocked in for this facility.' });
      }

      const insertResult = await client.query(
        `
          insert into employee_time_entries (
            employee_id,
            facility_id,
            clock_in_note,
            clock_in_latitude,
            clock_in_longitude
          )
          values ($1, $2, $3, $4, $5)
          returning id
        `,
        [req.employee.id, facilityId, note || null, location?.latitude ?? null, location?.longitude ?? null]
      );

      const entryId = insertResult.rows[0].id;

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.clock_in', facilityId, req.employee.id, { note: note || null, location: location || null }]
      );

      const entryResult = await client.query(`${timeEntrySelect} where te.id = $1 limit 1`, [entryId]);
      await client.query('commit');
      return res.status(201).json(entryResult.rows[0]);
    } catch (error) {
      await client.query('rollback');
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'You are already clocked in for this facility.' });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/clock-out', requireAuth, async (req, res) => {
  const { facilityId, note = '', location = null } = req.body;

  try {
    const validationError = validateTimeEntryActionInput({ facilityId, note, location });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await ensureFacilityRole(req.employee, facilityId);
    if (!currentRole) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    const client = await connect();

    try {
      await client.query('begin');

      const activeResult = await client.query(
        `
          select id
          from employee_time_entries
          where employee_id = $1 and facility_id = $2 and clock_out_at is null
          order by clock_in_at desc
          limit 1
          for update
        `,
        [req.employee.id, facilityId]
      );

      if (!activeResult.rows.length) {
        await client.query('rollback');
        return res.status(404).json({ error: 'No active clock-in was found for this facility.' });
      }

      const entryId = activeResult.rows[0].id;
      await client.query(
        `
          update employee_time_entries
          set clock_out_at = now(),
              clock_out_note = $2,
              clock_out_latitude = $3,
              clock_out_longitude = $4,
              updated_at = now()
          where id = $1
        `,
        [entryId, note || null, location?.latitude ?? null, location?.longitude ?? null]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.clock_out', facilityId, req.employee.id, { note: note || null, location: location || null }]
      );

      const entryResult = await client.query(`${timeEntrySelect} where te.id = $1 limit 1`, [entryId]);
      await client.query('commit');
      return res.json(entryResult.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:entryId', requireAuth, async (req, res) => {
  const { entryId } = req.params;
  const { facilityId, clockInAt, clockOutAt = null, clockInNote = '', clockOutNote = '' } = req.body;

  try {
    const validationError = validateTimeEntryUpdateInput({ entryId, facilityId, clockInAt, clockOutAt, clockInNote, clockOutNote });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await ensureFacilityRole(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      await client.query('begin');
      const existing = await client.query('select employee_id from employee_time_entries where id = $1 and facility_id = $2 limit 1', [entryId, facilityId]);
      if (!existing.rows.length) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Time entry not found' });
      }

      await client.query(
        `
          update employee_time_entries
          set clock_in_at = $2,
              clock_out_at = $3,
              clock_in_note = $4,
              clock_out_note = $5,
              approved_at = null,
              approved_by_employee_id = null,
              approval_note = null,
              updated_at = now()
          where id = $1
        `,
        [entryId, clockInAt, clockOutAt || null, clockInNote || null, clockOutNote || null]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.time_edit', facilityId, existing.rows[0].employee_id, { entryId }]
      );

      const result = await client.query(`${timeEntrySelect} where te.id = $1 limit 1`, [entryId]);
      await client.query('commit');
      return res.json(result.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/:entryId/approve', requireAuth, async (req, res) => {
  const { entryId } = req.params;
  const { facilityId, approvalNote = '' } = req.body;

  try {
    const validationError = validateTimeEntryApprovalInput({ entryId, facilityId, approvalNote });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await ensureFacilityRole(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      await client.query('begin');
      const existing = await client.query('select employee_id from employee_time_entries where id = $1 and facility_id = $2 limit 1', [entryId, facilityId]);
      if (!existing.rows.length) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Time entry not found' });
      }

      await client.query(
        `
          update employee_time_entries
          set approved_at = now(),
              approved_by_employee_id = $2,
              approval_note = $3,
              updated_at = now()
          where id = $1
        `,
        [entryId, req.employee.id, approvalNote || null]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.time_approved', facilityId, existing.rows[0].employee_id, { entryId, approvalNote: approvalNote || null }]
      );

      const result = await client.query(`${timeEntrySelect} where te.id = $1 limit 1`, [entryId]);
      await client.query('commit');
      return res.json(result.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
