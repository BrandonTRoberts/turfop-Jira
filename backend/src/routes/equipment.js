import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { canWrite, getRoleForFacility } from '../lib/permissions.js';
import { persistAttachmentCollection, persistImageCollection } from '../lib/media.js';
import { handleUnexpectedError } from '../lib/http.js';
import { validateEquipmentInput } from '../lib/validation.js';
import { resolveFacilityId } from '../lib/facilityScope.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const facilityId = resolveFacilityId({ query: req.query, employee: req.employee });

  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!role) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    const result = await query(
      `
        select id, facility_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, attachments, created_at, updated_at
        from equipment
        where facility_id = $1
        order by created_at desc
      `,
      [facilityId]
    );

    res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, make, model, assignedArea, vin, serialNumber, description, hours, detail, status, images = [], attachments = [] } = req.body;
  const facilityId = resolveFacilityId({ body: req.body, employee: req.employee });

  try {
    const validationError = validateEquipmentInput({ facilityId, name, make, model, assignedArea, vin, serialNumber, description, hours, detail, status });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const role = await getRoleForFacility(req.employee, facilityId);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this facility' });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'equipment', maxCount: 6 });
    const attachmentItems = await persistAttachmentCollection(attachments, { entityType: 'equipment-attachments', maxCount: 12 });
    const result = await query(
      `
        insert into equipment (facility_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, attachments)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        returning id, facility_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, attachments, created_at, updated_at
      `,
      [facilityId, name, make, model, assignedArea || null, vin, serialNumber, description, hours, detail, status, JSON.stringify(imageUrls), JSON.stringify(attachmentItems)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:equipmentId', requireAuth, async (req, res) => {
  const { equipmentId } = req.params;
  const { name, make, model, assignedArea, vin, serialNumber, description, hours, detail, status, images = [], attachments = [], expectedUpdatedAt } = req.body;
  const facilityId = resolveFacilityId({ body: req.body, employee: req.employee });

  try {
    const validationError = validateEquipmentInput({ facilityId, name, make, model, assignedArea, vin, serialNumber, description, hours, detail, status });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existing = await query(
      `
        select id, facility_id, updated_at
        from equipment
        where id = $1
      `,
      [equipmentId]
    );

    const equipment = existing.rows[0];
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment record not found' });
    }

    const currentRole = await getRoleForFacility(req.employee, equipment.facility_id);
    const targetRole = await getRoleForFacility(req.employee, facilityId);
    if (!canWrite(currentRole) || !canWrite(targetRole)) {
      return res.status(403).json({ error: 'Write access denied for this facility' });
    }

    if (expectedUpdatedAt && new Date(equipment.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Equipment record was updated by someone else. Review the latest server version before retrying.', conflict: 'stale_update', currentUpdatedAt: equipment.updated_at });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'equipment', maxCount: 6 });
    const attachmentItems = await persistAttachmentCollection(attachments, { entityType: 'equipment-attachments', maxCount: 12 });
    const result = await query(
      `
        update equipment
        set facility_id = $2,
            name = $3,
            make = $4,
            model = $5,
            assigned_area = $6,
            vin = $7,
            serial_number = $8,
            description = $9,
            hours = $10,
            detail = $11,
            status = $12,
            image_urls = $13,
            attachments = $14,
            updated_at = now()
        where id = $1
        returning id, facility_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, attachments, created_at, updated_at
      `,
      [equipmentId, facilityId, name, make, model, assignedArea || null, vin, serialNumber, description, hours, detail, status, JSON.stringify(imageUrls), JSON.stringify(attachmentItems)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:equipmentId', requireAuth, async (req, res) => {
  const { equipmentId } = req.params;
  const { expectedUpdatedAt } = req.body || {};

  try {
    const existing = await query(
      `
        select id, facility_id, updated_at
        from equipment
        where id = $1
      `,
      [equipmentId]
    );

    const equipment = existing.rows[0];
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment record not found' });
    }

    const role = await getRoleForFacility(req.employee, equipment.facility_id);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this facility' });
    }

    if (expectedUpdatedAt && new Date(equipment.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Equipment record was updated by someone else. Review the latest server version before deleting.', conflict: 'stale_delete', currentUpdatedAt: equipment.updated_at });
    }

    await query('delete from equipment where id = $1', [equipmentId]);
    res.status(204).send();
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
