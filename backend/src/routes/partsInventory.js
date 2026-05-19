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
        select id, course_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, created_at
        from parts_inventory
        where course_id = $1
        order by sku asc
      `,
      [courseId]
    );

    res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { courseId, sku, partDescription, quantityOnHand, unitCost, reorderUrl, images = [] } = req.body;

  try {
    const role = await getRoleForCourse(req.employee, courseId);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'inventory', maxCount: 6 });
    const result = await query(
      `
        insert into parts_inventory (course_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, course_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, created_at
      `,
      [courseId, sku, partDescription, quantityOnHand || 0, unitCost || 0, reorderUrl || null, JSON.stringify(imageUrls)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:partId', requireAuth, async (req, res) => {
  const { partId } = req.params;
  const { courseId, sku, partDescription, quantityOnHand, unitCost, reorderUrl, images = [] } = req.body;

  try {
    const existing = await query('select id, course_id from parts_inventory where id = $1', [partId]);
    const part = existing.rows[0];
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const currentRole = await getRoleForCourse(req.employee, part.course_id);
    const targetRole = await getRoleForCourse(req.employee, courseId);
    if (!canWrite(currentRole) || !canWrite(targetRole)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    const imageUrls = await persistImageCollection(images, { entityType: 'inventory', maxCount: 6 });
    const result = await query(
      `
        update parts_inventory
        set course_id = $2,
            sku = $3,
            part_description = $4,
            quantity_on_hand = $5,
            unit_cost = $6,
            reorder_url = $7,
            image_urls = $8
        where id = $1
        returning id, course_id, sku, part_description, quantity_on_hand, unit_cost, reorder_url, image_urls, created_at
      `,
      [partId, courseId, sku, partDescription, quantityOnHand || 0, unitCost || 0, reorderUrl || null, JSON.stringify(imageUrls)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:partId', requireAuth, async (req, res) => {
  const { partId } = req.params;

  try {
    const existing = await query('select id, course_id from parts_inventory where id = $1', [partId]);
    const part = existing.rows[0];
    if (!part) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const role = await getRoleForCourse(req.employee, part.course_id);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    await query('delete from parts_inventory where id = $1', [partId]);
    res.status(204).send();
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
