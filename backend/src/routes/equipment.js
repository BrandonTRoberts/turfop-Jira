import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { canWrite, getRoleForCourse } from '../lib/permissions.js';
import { persistImageCollection } from '../lib/media.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  try {
    const role = await getRoleForCourse(req.employee, courseId);
    if (!role) {
      return res.status(403).json({ error: 'No access to this course' });
    }

    const result = await query(
      `
        select id, course_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, created_at, updated_at
        from equipment
        where course_id = $1
        order by created_at desc
      `,
      [courseId]
    );

    res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { courseId, name, make, model, assignedArea, vin, serialNumber, description, hours, detail, status, images = [] } = req.body;

  try {
    const role = await getRoleForCourse(req.employee, courseId);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'equipment', maxCount: 6 });
    const result = await query(
      `
        insert into equipment (course_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning id, course_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, created_at, updated_at
      `,
      [courseId, name, make, model, assignedArea || null, vin, serialNumber, description, hours, detail, status, JSON.stringify(imageUrls)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:equipmentId', requireAuth, async (req, res) => {
  const { equipmentId } = req.params;
  const { courseId, name, make, model, assignedArea, vin, serialNumber, description, hours, detail, status, images = [], expectedUpdatedAt } = req.body;

  try {
    const existing = await query(
      `
        select id, course_id, updated_at
        from equipment
        where id = $1
      `,
      [equipmentId]
    );

    const equipment = existing.rows[0];
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment record not found' });
    }

    const currentRole = await getRoleForCourse(req.employee, equipment.course_id);
    const targetRole = await getRoleForCourse(req.employee, courseId);
    if (!canWrite(currentRole) || !canWrite(targetRole)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    if (expectedUpdatedAt && new Date(equipment.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Equipment record was updated by someone else. Review the latest server version before retrying.', conflict: 'stale_update', currentUpdatedAt: equipment.updated_at });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'equipment', maxCount: 6 });
    const result = await query(
      `
        update equipment
        set course_id = $2,
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
            updated_at = now()
        where id = $1
        returning id, course_id, name, make, model, assigned_area, vin, serial_number, description, hours, detail, status, image_urls, created_at, updated_at
      `,
      [equipmentId, courseId, name, make, model, assignedArea || null, vin, serialNumber, description, hours, detail, status, JSON.stringify(imageUrls)]
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
        select id, course_id, updated_at
        from equipment
        where id = $1
      `,
      [equipmentId]
    );

    const equipment = existing.rows[0];
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment record not found' });
    }

    const role = await getRoleForCourse(req.employee, equipment.course_id);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
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
