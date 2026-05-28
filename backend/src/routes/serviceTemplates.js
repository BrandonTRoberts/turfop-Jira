import { Router } from 'express';
import { query, connect } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForFacility, canWrite, isAdmin } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

async function tableExists(tableName) {
  const result = await query('select to_regclass($1) as regclass', [tableName]);
  return Boolean(result.rows[0]?.regclass);
}

const router = Router();

async function ensureFacilityAccess(req, facilityId) {
  const role = await getRoleForFacility(req.employee, facilityId);
  if (!role) {
    const err = new Error('No access');
    err.status = 403;
    throw err;
  }
  return role;
}

router.get('/', requireAuth, async (req, res) => {
  const { facilityId, includeArchived = 'false' } = req.query;
  try {
    await ensureFacilityAccess(req, facilityId);
    console.info('service-templates:list:start', {
      employeeId: req.employee?.id,
      facilityId,
      includeArchived: includeArchived === 'true'
    });

    const templatesTableOk = await tableExists('service_templates');
    if (!templatesTableOk) {
      console.warn('service-templates:list:templates-table-missing', { facilityId });
      return res.json([]);
    }

    const rows = await query(`
      select st.*, f.name as facility_name
      from service_templates st
      join facilities f on f.id = st.facility_id
      where st.company_id = (select company_id from facilities where id = $1)
      and ($2::boolean = true or st.archived_at is null)
      order by st.name asc
    `, [facilityId, includeArchived === 'true']);

    const templateIds = rows.rows.map(r => r.id);

    let partsRows = [];
    let equipmentRows = [];

    if (templateIds.length > 0) {
      const [partsTableOk, equipmentTableOk] = await Promise.all([
        tableExists('service_template_parts'),
        tableExists('service_template_equipment')
      ]);

      console.info('service-templates:list:child-table-check', {
        facilityId,
        templateCount: templateIds.length,
        partsTableOk,
        equipmentTableOk
      });

      if (partsTableOk) {
        try {
          const parts = await query(`
            select tp.*, pi.sku, pi.part_description
            from service_template_parts tp
            left join parts_inventory pi on pi.id = tp.part_inventory_id
            where tp.template_id = any($1::uuid[])
          `, [templateIds]);
          partsRows = parts.rows;
        } catch (partsErr) {
          console.warn('service-templates:list:parts-query-failed', {
            facilityId,
            code: partsErr.code,
            message: partsErr.message
          });
          if (partsErr.code !== '42P01') throw partsErr;
        }
      }

      if (equipmentTableOk) {
        try {
          const equipment = await query(`
            select * from service_template_equipment where template_id = any($1::uuid[])
          `, [templateIds]);
          equipmentRows = equipment.rows;
        } catch (equipmentErr) {
          console.warn('service-templates:list:equipment-query-failed', {
            facilityId,
            code: equipmentErr.code,
            message: equipmentErr.message
          });
          if (equipmentErr.code !== '42P01') throw equipmentErr;
        }
      }
    }

    const templates = rows.rows.map(t => ({
      ...t,
      parts: partsRows.filter(p => p.template_id === t.id),
      equipment: equipmentRows.filter(e => e.template_id === t.id)
    }));

    res.json(templates);
  } catch (err) {
    console.error('service-templates:list:failed', {
      facilityId,
      includeArchived: includeArchived === 'true',
      code: err.code,
      status: err.status,
      message: err.message
    });
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { facilityId, name, description, parts = [], equipment = [], checklist = [], requiredTools = [], estimatedLaborHours = null, locationIds = [], metadata = {} } = req.body;
  try {
    const role = await ensureFacilityAccess(req, facilityId);
    if (!canWrite(role)) return res.status(403).json({ error: 'Write access denied' });

    const client = await connect();
    try {
      await client.query('begin');
      const facility = await client.query('select company_id from facilities where id=$1 limit 1', [facilityId]);
      const companyId = facility.rows[0]?.company_id;
      const insertRes = await client.query(
        `insert into service_templates (facility_id, company_id, name, description, checklist, required_tools, estimated_labor_hours, location_ids, metadata)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [facilityId, companyId, name, description || null, JSON.stringify(checklist), JSON.stringify(requiredTools), estimatedLaborHours, JSON.stringify(locationIds), JSON.stringify(metadata || {})]
      );
      const templateId = insertRes.rows[0].id;

      for (const p of parts) {
        if (!p.inventoryId) continue;
        await client.query(
          'insert into service_template_parts (template_id, part_inventory_id, quantity) values ($1, $2, $3)',
          [templateId, p.inventoryId, Number(p.quantity || 0)]
        );
      }

      for (const e of equipment) {
        if (!e.equipmentName && !e.equipmentId) continue;
        await client.query(
          'insert into service_template_equipment (template_id, equipment_id, equipment_name, quantity) values ($1, $2, $3, $4)',
          [templateId, e.equipmentId || null, e.equipmentName || 'Equipment', Number(e.quantity || 1)]
        );
      }

      await client.query('commit');
      res.status(201).json(insertRes.rows[0]);
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { facilityId, name, description, checklist = [], requiredTools = [], estimatedLaborHours = null, locationIds = [], metadata = {}, archived = false } = req.body;
  try {
    const role = await ensureFacilityAccess(req, facilityId);
    if (!isAdmin(role)) return res.status(403).json({ error: 'Admin access required' });

    const result = await query(`
      update service_templates
      set name=$3, description=$4, checklist=$5, required_tools=$6, estimated_labor_hours=$7, location_ids=$8, metadata=$9,
          archived_at = case when $10::boolean then now() else null end,
          archived_by_employee_id = case when $10::boolean then $11 else null end,
          updated_at=now()
      where id=$1 and company_id=(select company_id from facilities where id=$2)
      returning *
    `, [id, facilityId, name, description || null, JSON.stringify(checklist), JSON.stringify(requiredTools), estimatedLaborHours, JSON.stringify(locationIds), JSON.stringify(metadata || {}), archived, req.employee.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { facilityId } = req.query;
  try {
    const role = await ensureFacilityAccess(req, facilityId);
    if (!isAdmin(role)) return res.status(403).json({ error: 'Admin access required' });

    await query('delete from service_templates where id = $1 and company_id=(select company_id from facilities where id=$2)', [id, facilityId]);
    res.json({ success: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    handleUnexpectedError(res, err);
  }
});

export default router;
