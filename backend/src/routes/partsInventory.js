import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { canWrite, getRoleForFacility, isAdmin } from '../lib/permissions.js';
import { persistAttachmentCollection, persistImageCollection } from '../lib/media.js';
import { handleUnexpectedError } from '../lib/http.js';
import { validatePartsInventoryInput } from '../lib/validation.js';

const router = Router();

// Company-wide inventory search ("global inventory" across all facilities in the same company)
router.get('/company', requireAuth, async (req, res) => {
  try {
    if (!req.employee?.company_id) {
      return res.status(400).json({ error: 'Employee is not associated with a company' });
    }

    const result = await query(
      `
        select
          pi.id,
          pi.facility_id,
          f.name as facility_name,
          pi.sku,
          pi.part_description,
          pi.quantity_on_hand
        from parts_inventory pi
        join facilities f on f.id = pi.facility_id
        where f.company_id = $1
        order by pi.sku asc, f.name asc
      `,
      [req.employee.company_id]
    );

    return res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { facilityId } = req.query;

  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!role) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    const result = await query(
      `
        select id, facility_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, attachments, created_at, updated_at
        from parts_inventory
        where facility_id = $1
        order by sku asc
      `,
      [facilityId]
    );

    const isAdminUser = isAdmin(role);
    const rows = result.rows.map(row => {
      if (!isAdminUser) {
        return {
          ...row,
          unit_cost: null
        };
      }
      return row;
    });

    res.json(rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { facilityId, sku, partDescription, quantityOnHand, unitCost, reorderUrl, images = [], attachments = [] } = req.body;

  try {
    const validationError = validatePartsInventoryInput({ facilityId, sku, partDescription, quantityOnHand, unitCost, reorderUrl });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const role = await getRoleForFacility(req.employee, facilityId);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this facility' });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'inventory', maxCount: 6 });
    const attachmentItems = await persistAttachmentCollection(attachments, { entityType: 'inventory-attachments', maxCount: 12 });
    const result = await query(
      `
        insert into parts_inventory (facility_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, attachments)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, facility_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, attachments, created_at, updated_at
      `,
      [facilityId, sku, partDescription, quantityOnHand || 0, unitCost || 0, reorderUrl || null, JSON.stringify(imageUrls), JSON.stringify(attachmentItems)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:partId', requireAuth, async (req, res) => {
  const { partId } = req.params;
  const { facilityId, sku, partDescription, quantityOnHand, unitCost, reorderUrl, images = [], attachments = [], expectedUpdatedAt } = req.body;

  try {
    const validationError = validatePartsInventoryInput({ facilityId, sku, partDescription, quantityOnHand, unitCost, reorderUrl });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existing = await query('select id, facility_id, updated_at from parts_inventory where id = $1', [partId]);
    const part = existing.rows[0];
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const currentRole = await getRoleForFacility(req.employee, part.facility_id);
    const targetRole = await getRoleForFacility(req.employee, facilityId);
    if (!canWrite(currentRole) || !canWrite(targetRole)) {
      return res.status(403).json({ error: 'Write access denied for this facility' });
    }

    if (expectedUpdatedAt && new Date(part.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Inventory item was updated by someone else. Review the latest server version before retrying.', conflict: 'stale_update', currentUpdatedAt: part.updated_at });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'inventory', maxCount: 6 });
    const attachmentItems = await persistAttachmentCollection(attachments, { entityType: 'inventory-attachments', maxCount: 12 });
    const result = await query(
      `
        update parts_inventory
        set facility_id = $2,
            sku = $3,
            part_description = $4,
            quantity_on_hand = $5,
            unit_cost = $6,
            reorder_url = $7,
            image_urls = $8,
            attachments = $9,
            updated_at = now()
        where id = $1
        returning id, facility_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, attachments, created_at, updated_at
      `,
      [partId, facilityId, sku, partDescription, quantityOnHand || 0, unitCost || 0, reorderUrl || null, JSON.stringify(imageUrls), JSON.stringify(attachmentItems)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:partId', requireAuth, async (req, res) => {
  const { partId } = req.params;
  const { expectedUpdatedAt } = req.body || {};

  try {
    const existing = await query('select id, facility_id, updated_at from parts_inventory where id = $1', [partId]);
    const part = existing.rows[0];
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const role = await getRoleForFacility(req.employee, part.facility_id);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this facility' });
    }

    if (expectedUpdatedAt && new Date(part.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Inventory item was updated by someone else. Review the latest server version before deleting.', conflict: 'stale_delete', currentUpdatedAt: part.updated_at });
    }

    await query('delete from parts_inventory where id = $1', [partId]);
    res.status(204).send();
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
