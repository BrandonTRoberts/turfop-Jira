import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForFacility, isAdmin } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

function parseCSV(csvText = '') {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur.trim());
        rows.push(row);
      }
      cur = '';
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  if (!rows.length) return { headers: [], data: [] };
  const headers = rows[0].map(h => h.toLowerCase());
  const data = rows.slice(1).map(cols => Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ''])));
  return { headers, data };
}

function validateImportRow(entityType, row) {
  const issues = [];

  if (entityType === 'equipment') {
    if (!row.name) issues.push('Name required');
    if (!row.status) issues.push('Status required');
  } else {
    if (!row.sku) issues.push('SKU required');
    if (!row.part_description) issues.push('part_description required');
    if (row.quantity_on_hand === '' || Number.isNaN(Number(row.quantity_on_hand))) {
      issues.push('quantity_on_hand must be numeric');
    }
    if (row.unit_cost !== '' && Number.isNaN(Number(row.unit_cost))) {
      issues.push('unit_cost must be numeric');
    }
  }

  return issues;
}

async function ensureAdminForFacility(req, facilityId) {
  const role = await getRoleForFacility(req.employee, facilityId);
  if (!isAdmin(role)) {
    const err = new Error('Admin access required');
    err.status = 403;
    throw err;
  }
}

router.post('/import-csv/preview', requireAuth, async (req, res) => {
  const { facilityId, entityType, csvText } = req.body;
  try {
    await ensureAdminForFacility(req, facilityId);
    const parsed = parseCSV(csvText || '');
    const required = entityType === 'equipment'
      ? ['name', 'facility', 'status']
      : ['sku', 'part_description', 'quantity_on_hand', 'facility'];

    const missing = required.filter((key) => !parsed.headers.includes(key));
    const errors = [];
    if (missing.length) errors.push(`Missing required columns: ${missing.join(', ')}`);

    const rowErrors = [];
    for (const [idx, row] of parsed.data.entries()) {
      const issues = validateImportRow(entityType, row);
      if (issues.length) {
        rowErrors.push({ line: idx + 2, error: issues.join('; ') });
      }
    }

    const preview = parsed.data.slice(0, 25).map((row, idx) => ({ line: idx + 2, ...row }));
    res.json({ headers: parsed.headers, rowCount: parsed.data.length, errors, rowErrors, preview });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  }
});

router.post('/import-csv/commit', requireAuth, async (req, res) => {
  const { facilityId, entityType, csvText, createFacilities = false } = req.body;
  const client = await connect();
  try {
    await ensureAdminForFacility(req, facilityId);
    await client.query('begin');
    const parsed = parseCSV(csvText || '');
    const facRows = await client.query('select id, name, company_id from facilities where company_id=(select company_id from facilities where id=$1)', [facilityId]);
    const facilityMap = new Map(facRows.rows.map((f) => [String(f.name).toLowerCase(), f]));
    const createdFacilityIds = [];

    async function resolveFacility(name) {
      const key = String(name || '').trim().toLowerCase();
      if (!key) return facilityId;
      if (facilityMap.has(key)) return facilityMap.get(key).id;
      if (!createFacilities) return null;
      const current = facRows.rows[0];
      const created = await client.query('insert into facilities (company_id, name) values ($1,$2) returning id,name,company_id', [current.company_id, name]);
      facilityMap.set(key, created.rows[0]);
      createdFacilityIds.push(created.rows[0].id);
      return created.rows[0].id;
    }

    let inserted = 0;
    const errors = [];
    for (const [idx, row] of parsed.data.entries()) {
      const targetFacilityId = await resolveFacility(row.facility);
      if (!targetFacilityId) {
        errors.push({ line: idx + 2, error: `Unknown facility: ${row.facility}` });
        continue;
      }
      const issues = validateImportRow(entityType, row);
      if (issues.length) {
        errors.push({ line: idx + 2, error: issues.join('; ') });
        continue;
      }

      if (entityType === 'equipment') {
        await client.query('insert into equipment (facility_id, name, make, model, assigned_area, status, detail) values ($1,$2,$3,$4,$5,$6,$7)', [targetFacilityId, row.name, row.make || null, row.model || null, row.assigned_area || null, row.status || 'Scheduled', row.detail || null]);
      } else {
        await client.query('insert into parts_inventory (facility_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url) values ($1,$2,$3,$4,$5,$6) on conflict (facility_id,sku) do update set part_description=excluded.part_description, quantity_on_hand=excluded.quantity_on_hand, unit_cost=excluded.unit_cost, reorder_url=excluded.reorder_url', [targetFacilityId, row.sku, row.part_description, Number(row.quantity_on_hand || 0), Number(row.unit_cost || 0), row.reorder_url || null]);
      }
      inserted += 1;
    }

    await client.query('commit');
    res.json({ inserted, createdFacilityIds, errors });
  } catch (err) {
    await client.query('rollback');
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  } finally {
    client.release();
  }
});

router.get('/time-clock-approval', requireAuth, async (req, res) => {
  const { facilityId, userId = '', from = '', to = '' } = req.query;
  try {
    await ensureAdminForFacility(req, facilityId);
    const params = [facilityId];
    let where = 'where te.facility_id = $1';
    if (userId) { params.push(userId); where += ` and te.employee_id = $${params.length}`; }
    if (from) { params.push(from); where += ` and te.clock_in_at >= $${params.length}::timestamptz`; }
    if (to) { params.push(to); where += ` and te.clock_in_at <= $${params.length}::timestamptz`; }

    const result = await query(`
      select te.*, e.full_name as employee_name, f.name as facility_name
      from employee_time_entries te
      join employees e on e.id = te.employee_id
      join facilities f on f.id = te.facility_id
      ${where}
      order by te.clock_in_at desc
      limit 500
    `, params);
    res.json(result.rows);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  }
});

router.patch('/time-clock-approval/:entryId', requireAuth, async (req, res) => {
  const { entryId } = req.params;
  const { facilityId, clockInAt, clockOutAt = null, approvalState = 'approved', note = '' } = req.body;
  const client = await connect();
  try {
    await ensureAdminForFacility(req, facilityId);
    await client.query('begin');

    const existing = await client.query('select * from employee_time_entries where id=$1 and facility_id=$2 limit 1 for update', [entryId, facilityId]);
    if (!existing.rows.length) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Time entry not found' });
    }
    const old = existing.rows[0];
    const approvedAt = approvalState === 'rejected' ? null : new Date().toISOString();
    const approvedBy = approvalState === 'rejected' ? null : req.employee.id;

    const updated = await client.query(`
      update employee_time_entries
      set clock_in_at=$2, clock_out_at=$3, approved_at=$4, approved_by_employee_id=$5, approval_note=$6, updated_at=now()
      where id=$1
      returning *
    `, [entryId, clockInAt || old.clock_in_at, clockOutAt, approvedAt, approvedBy, note || null]);

    await client.query('insert into employee_time_entry_edits (time_entry_id, edited_by_employee_id, edit_action, old_value, new_value, edit_note) values ($1,$2,$3,$4,$5,$6)', [entryId, req.employee.id, approvalState, old, updated.rows[0], note || null]);

    await client.query('commit');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('rollback');
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  } finally {
    client.release();
  }
});

export default router;
