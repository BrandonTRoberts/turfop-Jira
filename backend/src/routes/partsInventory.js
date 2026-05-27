import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { canWrite, getRoleForFacility, isAdmin } from '../lib/permissions.js';
import { persistAttachmentCollection, persistImageCollection } from '../lib/media.js';
import { handleUnexpectedError } from '../lib/http.js';
import { validatePartsInventoryInput } from '../lib/validation.js';
import { resolveFacilityId } from '../lib/facilityScope.js';

const router = Router();

// Company-wide inventory search ("global inventory" across all facilities in the same company)
router.get('/company', requireAuth, async (req, res) => {
  const facilityId = resolveFacilityId({ query: req.query, employee: req.employee }) || '';

  try {
    let scopedCompanyId = req.employee?.company_id || null;

    // If the request is scoped to a facility, always derive company context
    // from that facility after access validation. This prevents stale or
    // mismatched employee.company_id values from hiding inventory records.
    if (facilityId) {
      const role = await getRoleForFacility(req.employee, facilityId);
      if (!role) {
        return res.status(403).json({ error: 'No access to this facility' });
      }

      const facilityResult = await query(
        `
          select company_id
          from facilities
          where id = $1
          limit 1
        `,
        [facilityId]
      );

      scopedCompanyId = facilityResult.rows[0]?.company_id || null;
    }

    if (!scopedCompanyId) {
      return res.status(400).json({ error: 'Company context is required. Provide a facilityId or use an account associated with a company.' });
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
      [scopedCompanyId]
    );

    return res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/', requireAuth, async (req, res) => {
  const facilityId = resolveFacilityId({ query: req.query, employee: req.employee });

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
  const { sku, partDescription, quantityOnHand, unitCost, reorderUrl, images = [], attachments = [] } = req.body;
  const facilityId = resolveFacilityId({ body: req.body, employee: req.employee });

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
  const { sku, partDescription, quantityOnHand, unitCost, reorderUrl, images = [], attachments = [], expectedUpdatedAt } = req.body;
  const facilityId = resolveFacilityId({ body: req.body, employee: req.employee });

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

router.post('/transfer-requests', requireAuth, async (req, res) => {
  const { sourcePartId, destinationFacilityId, quantityRequested } = req.body || {};
  const selectedFacilityId = resolveFacilityId({ body: req.body, employee: req.employee });
  const qty = Number(quantityRequested || 0);

  try {
    if (!sourcePartId || !destinationFacilityId) {
      return res.status(400).json({ error: 'sourcePartId and destinationFacilityId are required' });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantityRequested must be a positive number' });
    }
    if (selectedFacilityId !== destinationFacilityId) {
      return res.status(400).json({ error: 'Transfer destination must match the currently selected facility' });
    }

    const destinationRole = await getRoleForFacility(req.employee, destinationFacilityId);
    if (!canWrite(destinationRole)) {
      return res.status(403).json({ error: 'Write access denied for destination facility' });
    }

    const client = await connect();
    try {
      await client.query('begin');

      const sourceResult = await client.query(
        `
          select pi.id, pi.facility_id, pi.sku, pi.part_description, pi.quantity_on_hand, f.company_id, f.name as facility_name
          from parts_inventory pi
          join facilities f on f.id = pi.facility_id
          where pi.id = $1
          for update
        `,
        [sourcePartId]
      );
      const sourcePart = sourceResult.rows[0];
      if (!sourcePart) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Source inventory item not found' });
      }
      if (sourcePart.facility_id === destinationFacilityId) {
        await client.query('rollback');
        return res.status(400).json({ error: 'Destination facility must be different from source facility' });
      }

      const sourceRole = await getRoleForFacility(req.employee, sourcePart.facility_id);
      if (!sourceRole) {
        await client.query('rollback');
        return res.status(403).json({ error: 'No access to source facility' });
      }

      const destinationFacilityResult = await client.query('select id, name, company_id from facilities where id = $1 limit 1', [destinationFacilityId]);
      const destinationFacility = destinationFacilityResult.rows[0];
      if (!destinationFacility) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Destination facility not found' });
      }
      if (destinationFacility.company_id !== sourcePart.company_id) {
        await client.query('rollback');
        return res.status(400).json({ error: 'Transfers can only be requested within the same business' });
      }

      const title = `Inventory Transfer Request: ${sourcePart.sku}`;
      const detail = `Requested by ${req.employee.full_name || req.employee.email} to transfer ${qty} of ${sourcePart.sku} (${sourcePart.part_description}) to ${destinationFacility.name}. Keep this ticket open until destination confirms receipt.`;
      const workOrderResult = await client.query(
        `
          insert into work_orders (facility_id, title, detail, status, assignee, parts_cost, total_cost)
          values ($1, $2, $3, 'Open', null, 0, 0)
          returning id
        `,
        [sourcePart.facility_id, title, detail]
      );
      const workOrderId = workOrderResult.rows[0].id;

      await client.query(
        `
          insert into inventory_transfer_requests (
            work_order_id,
            source_facility_id,
            destination_facility_id,
            source_part_inventory_id,
            sku,
            part_description,
            quantity_requested,
            status,
            created_by_employee_id
          )
          values ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
        `,
        [workOrderId, sourcePart.facility_id, destinationFacilityId, sourcePart.id, sourcePart.sku, sourcePart.part_description, qty, req.employee.id]
      );

      await client.query(
        `
          insert into work_order_activity (work_order_id, facility_id, actor_employee_id, action, from_status, to_status, detail)
          values ($1, $2, $3, 'transfer_request_created', null, 'Open', $4)
        `,
        [workOrderId, sourcePart.facility_id, req.employee.id, JSON.stringify({
          transferRequest: true,
          sourceFacilityId: sourcePart.facility_id,
          sourceFacilityName: sourcePart.facility_name,
          destinationFacilityId,
          destinationFacilityName: destinationFacility.name,
          sourcePartId: sourcePart.id,
          sku: sourcePart.sku,
          partDescription: sourcePart.part_description,
          quantityRequested: qty,
        })]
      );

      await client.query('commit');
      return res.status(201).json({ workOrderId, status: 'pending' });
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
