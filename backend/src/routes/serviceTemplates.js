import { Router } from 'express';
import { query, connect } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getRoleForCourse, canWrite } from '../lib/permissions.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { facilityId } = req.query;
  try {
    const role = await getRoleForCourse(req.employee, facilityId);
    if (!role) return res.status(403).json({ error: 'No access' });

    const templatesRes = await query('select * from service_templates where facility_id = $1 order by name asc', [facilityId]);
    
    const partsRes = await query(`
      select tp.*, pi.sku, pi.part_description
      from service_template_parts tp
      join service_templates t on t.id = tp.template_id
      join parts_inventory pi on pi.id = tp.part_inventory_id
      where t.facility_id = $1
    `, [facilityId]);

    const templates = templatesRes.rows.map(t => ({
      ...t,
      parts: partsRes.rows.filter(p => p.template_id === t.id)
    }));

    res.json(templates);
  } catch (err) {
    handleUnexpectedError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { facilityId, name, description, parts = [] } = req.body;
  try {
    const role = await getRoleForCourse(req.employee, facilityId);
    if (!canWrite(role)) return res.status(403).json({ error: 'Write access denied' });

    const client = await connect();
    try {
      await client.query('begin');
      const insertRes = await client.query(
        'insert into service_templates (facility_id, name, description) values ($1, $2, $3) returning *',
        [facilityId, name, description]
      );
      const templateId = insertRes.rows[0].id;
      
      const insertedParts = [];
      for (const p of parts) {
        const pRes = await client.query(
          'insert into service_template_parts (template_id, part_inventory_id, quantity) values ($1, $2, $3) returning *',
          [templateId, p.inventoryId, p.quantity]
        );
        insertedParts.push(pRes.rows[0]);
      }
      
      await client.query('commit');
      res.json({ ...insertRes.rows[0], parts: insertedParts });
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    handleUnexpectedError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { facilityId } = req.query;
  try {
    const role = await getRoleForCourse(req.employee, facilityId);
    if (!canWrite(role)) return res.status(403).json({ error: 'Write access denied' });
    
    // Deletes cascaded
    await query('delete from service_templates where id = $1 and facility_id = $2', [id, facilityId]);
    res.json({ success: true });
  } catch (err) {
    handleUnexpectedError(res, err);
  }
});

export default router;
