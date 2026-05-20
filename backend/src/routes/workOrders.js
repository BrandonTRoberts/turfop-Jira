import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { canWrite, getRoleForCourse, isAdmin } from '../lib/permissions.js';
import { persistAttachmentCollection, persistImageCollection } from '../lib/media.js';
import { handleUnexpectedError } from '../lib/http.js';
import { validateWorkOrderStatus, validateWorkOrderTransition } from '../lib/workOrderWorkflow.js';

const router = Router();

async function loadTechnician(client, technicianEmployeeId, courseId) {
  if (!technicianEmployeeId) {
    return null;
  }

  const result = await client.query(
    `
      select e.id, e.full_name, e.hourly_rate
      from employees e
      join courses c on c.company_id = e.company_id
      where e.id = $1 and c.id = $2
      limit 1
    `,
    [technicianEmployeeId, courseId]
  );

  return result.rows[0] || null;
}

async function loadPartsUsage(client, workOrderId) {
  const result = await client.query(
    `
      select
        wopu.id,
        wopu.part_inventory_id,
        wopu.quantity_used,
        wopu.unit_cost,
        wopu.total_cost,
        pi.sku,
        pi.part_description
      from work_order_parts_usage wopu
      join parts_inventory pi on pi.id = wopu.part_inventory_id
      where wopu.work_order_id = $1
      order by pi.sku asc
    `,
    [workOrderId]
  );

  return result.rows;
}

async function ensureEquipmentInCourse(client, equipmentId, courseId) {
  if (!equipmentId) {
    return null;
  }

  const result = await client.query(
    `
      select id, name
      from equipment
      where id = $1 and course_id = $2
      limit 1
    `,
    [equipmentId, courseId]
  );

  if (!result.rows[0]) {
    throw new Error('Selected equipment was not found for this course');
  }

  return result.rows[0];
}

async function loadWorkOrderActivity(client, workOrderId) {
  const result = await client.query(
    `
      select
        woa.id,
        woa.action,
        woa.from_status,
        woa.to_status,
        woa.detail,
        woa.created_at,
        e.id as actor_employee_id,
        e.full_name as actor_name,
        e.email as actor_email
      from work_order_activity woa
      left join employees e on e.id = woa.actor_employee_id
      where woa.work_order_id = $1
      order by woa.created_at desc
      limit 50
    `,
    [workOrderId]
  );

  return result.rows;
}

async function logWorkOrderActivity(client, { workOrderId, courseId, actorEmployeeId, action, fromStatus = null, toStatus = null, detail = {} }) {
  await client.query(
    `
      insert into work_order_activity (work_order_id, course_id, actor_employee_id, action, from_status, to_status, detail)
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [workOrderId, courseId, actorEmployeeId, action, fromStatus, toStatus, detail]
  );
}

function buildChangedFields(existing, next) {
  const comparisons = [
    ['course_id', existing.course_id, next.courseId],
    ['title', existing.title, next.title],
    ['detail', existing.detail, next.detail],
    ['assignee', existing.assignee, next.assignee],
    ['equipment_id', existing.equipment_id, next.equipmentId || null],
    ['due_at', existing.due_at, next.dueAt || null],
    ['technician_employee_id', existing.technician_employee_id, next.technicianEmployeeId || null],
    ['technician_name', existing.technician_name, next.technicianName || null],
    ['labor_hours', existing.labor_hours, next.laborHours ?? null],
    ['completed_work_notes', existing.completed_work_notes, next.completedWorkNotes || null],
    ['completed_at', existing.completed_at, next.completedAt || null]
  ];

  return comparisons
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([field]) => field);
}

async function restorePartInventory(client, workOrderId) {
  const existingUsage = await client.query(
    `
      select part_inventory_id, quantity_used
      from work_order_parts_usage
      where work_order_id = $1
    `,
    [workOrderId]
  );

  for (const usage of existingUsage.rows) {
    await client.query(
      `
        update parts_inventory
        set quantity_on_hand = quantity_on_hand + $2
        where id = $1
      `,
      [usage.part_inventory_id, usage.quantity_used]
    );
  }

  await client.query('delete from work_order_parts_usage where work_order_id = $1', [workOrderId]);
}

async function applyPartUsage(client, workOrderId, courseId, partUsages = []) {
  let partsCost = 0;

  for (const usage of partUsages) {
    const quantityUsed = Number(usage.quantityUsed || 0);
    if (!usage.partInventoryId || quantityUsed <= 0) continue;

    const partResult = await client.query(
      `
        select id, sku, part_description, quantity_on_hand, unit_cost
        from parts_inventory
        where id = $1 and course_id = $2
        limit 1
      `,
      [usage.partInventoryId, courseId]
    );

    const part = partResult.rows[0];
    if (!part) {
      throw new Error('Selected inventory part was not found for this course');
    }

    if (Number(part.quantity_on_hand) < quantityUsed) {
      throw new Error(`Not enough inventory for ${part.sku}`);
    }

    const unitCost = Number(part.unit_cost || 0);
    const totalCost = Number((quantityUsed * unitCost).toFixed(2));
    partsCost += totalCost;

    await client.query(
      `
        update parts_inventory
        set quantity_on_hand = quantity_on_hand - $2
        where id = $1
      `,
      [usage.partInventoryId, quantityUsed]
    );

    await client.query(
      `
        insert into work_order_parts_usage (work_order_id, part_inventory_id, quantity_used, unit_cost, total_cost)
        values ($1, $2, $3, $4, $5)
      `,
      [workOrderId, usage.partInventoryId, quantityUsed, unitCost, totalCost]
    );
  }

  return Number(partsCost.toFixed(2));
}

function sanitizePartUsageRow(row, canSeeFinancials) {
  if (canSeeFinancials) {
    return row;
  }

  return {
    ...row,
    unit_cost: null,
    total_cost: null
  };
}

function sanitizeWorkOrderRow(row, canSeeFinancials) {
  if (canSeeFinancials) {
    return row;
  }

  return {
    ...row,
    labor_rate: null,
    labor_cost: null,
    parts_cost: null,
    total_cost: null,
    part_usages: (row.part_usages || []).map((usage) => sanitizePartUsageRow(usage, false))
  };
}

async function hydrateWorkOrderRow(client, row, canSeeFinancials = true) {
  const partUsages = await loadPartsUsage(client, row.id);
  const activityLog = await loadWorkOrderActivity(client, row.id);
  return sanitizeWorkOrderRow({
    ...row,
    part_usages: partUsages,
    activity_log: activityLog
  }, canSeeFinancials);
}

async function deriveWorkOrderCosts(client, payload) {
  const laborHours = Number(payload.laborHours || 0);
  const technician = await loadTechnician(client, payload.technicianEmployeeId, payload.courseId);
  const laborRate = Number(technician?.hourly_rate ?? payload.laborRate ?? 0);
  const laborCost = Number((laborHours * laborRate).toFixed(2));

  return {
    technicianEmployeeId: technician?.id || null,
    technicianName: technician?.full_name || payload.technicianName || null,
    laborHours,
    laborRate,
    laborCost
  };
}

router.get('/', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  try {
    const role = await getRoleForCourse(req.employee, courseId);
    if (!role) {
      return res.status(403).json({ error: 'No access to this course' });
    }

    const canSeeFinancials = isAdmin(role);
    const result = await query(
      `
        select id, course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, completed_work_notes, completed_at, image_urls, attachments, created_at, updated_at
        from work_orders
        where course_id = $1
        order by created_at desc
      `,
      [courseId]
    );

    const client = await connect();
    try {
      const items = [];
      for (const row of result.rows) {
        items.push(await hydrateWorkOrderRow(client, row, canSeeFinancials));
      }
      res.json(items);
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { courseId, title, detail, status, assignee, equipmentId = null, dueAt = null, technicianEmployeeId, technicianName, laborHours, laborRate, completedWorkNotes, completedAt, partUsages = [], images = [], attachments = [] } = req.body;
  const nextStatus = validateWorkOrderStatus(status);
  if (!nextStatus.ok) {
    return res.status(400).json({ error: nextStatus.error, allowedStatuses: nextStatus.allowedStatuses });
  }

  try {
    const role = await getRoleForCourse(req.employee, courseId);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    const canSeeFinancials = isAdmin(role);
    const client = await connect();
    try {
      await client.query('begin');
      await ensureEquipmentInCourse(client, equipmentId, courseId);
      const imageUrls = await persistImageCollection(images, { entityType: 'work-orders', maxCount: 6 });
      const attachmentItems = await persistAttachmentCollection(attachments, { entityType: 'work-order-attachments', maxCount: 12 });
      const costs = await deriveWorkOrderCosts(client, { technicianEmployeeId, technicianName, laborHours, laborRate, courseId });
      const result = await client.query(
        `
          insert into work_orders (course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, completed_work_notes, completed_at, image_urls, attachments)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $12, $13, $14, $15, $16)
          returning id, course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, completed_work_notes, completed_at, image_urls, attachments, created_at, updated_at
        `,
        [courseId, title, detail, nextStatus.status, assignee, equipmentId || null, dueAt || null, costs.technicianEmployeeId, costs.technicianName, costs.laborHours, costs.laborRate, costs.laborCost, completedWorkNotes || null, completedAt || null, JSON.stringify(imageUrls), JSON.stringify(attachmentItems)]
      );

      const workOrder = result.rows[0];
      const partsCost = await applyPartUsage(client, workOrder.id, courseId, partUsages);
      const totalCost = Number((costs.laborCost + partsCost).toFixed(2));
      const updateTotals = await client.query(
        `
          update work_orders
          set parts_cost = $2,
              total_cost = $3
          where id = $1
          returning id, course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, completed_work_notes, completed_at, image_urls, attachments, created_at, updated_at
        `,
        [workOrder.id, partsCost, totalCost]
      );
      await logWorkOrderActivity(client, {
        workOrderId: workOrder.id,
        courseId,
        actorEmployeeId: req.employee.id,
        action: 'created',
        toStatus: nextStatus.status,
        detail: {
          title,
          assignee: assignee || null,
          technicianEmployeeId: costs.technicianEmployeeId,
          partUsageCount: partUsages.length
          , equipmentId: equipmentId || null
        }
      });
      await client.query('commit');

      res.status(201).json(await hydrateWorkOrderRow(client, updateTotals.rows[0], canSeeFinancials));
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

router.patch('/:workOrderId', requireAuth, async (req, res) => {
  const { workOrderId } = req.params;
  const { courseId, title, detail, status, assignee, equipmentId = null, dueAt = null, technicianEmployeeId, technicianName, laborHours, laborRate, completedWorkNotes, completedAt, partUsages = [], images = [], attachments = [], expectedUpdatedAt } = req.body;

  try {
    const existing = await query(
      `
        select id, course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, completed_work_notes, completed_at, updated_at
        from work_orders
        where id = $1
      `,
      [workOrderId]
    );
    const workOrder = existing.rows[0];
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const currentRole = await getRoleForCourse(req.employee, workOrder.course_id);
    const targetRole = await getRoleForCourse(req.employee, courseId);
    if (!canWrite(currentRole) || !canWrite(targetRole)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    if (expectedUpdatedAt && new Date(workOrder.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Work order was updated by someone else. Review the latest server version before retrying.', conflict: 'stale_update', currentUpdatedAt: workOrder.updated_at });
    }

    const transition = validateWorkOrderTransition(workOrder.status, status);
    if (!transition.ok) {
      return res.status(400).json({ error: transition.error, allowedStatuses: transition.allowedStatuses });
    }

    const canSeeFinancials = isAdmin(targetRole);
    const client = await connect();
    try {
      await client.query('begin');
      await restorePartInventory(client, workOrderId);
      await ensureEquipmentInCourse(client, equipmentId, courseId);
      const imageUrls = await persistImageCollection(images, { entityType: 'work-orders', maxCount: 6 });
      const attachmentItems = await persistAttachmentCollection(attachments, { entityType: 'work-order-attachments', maxCount: 12 });
      const costs = await deriveWorkOrderCosts(client, { technicianEmployeeId, technicianName, laborHours, laborRate, courseId });
      const result = await client.query(
        `
          update work_orders
          set course_id = $2,
              title = $3,
              detail = $4,
              status = $5,
              assignee = $6,
              equipment_id = $7,
              due_at = $8,
              technician_employee_id = $9,
              technician_name = $10,
              labor_hours = $11,
              labor_rate = $12,
              labor_cost = $13,
              parts_cost = 0,
              total_cost = $13,
              completed_work_notes = $14,
              completed_at = $15,
              image_urls = $16,
              attachments = $17,
              updated_at = now()
          where id = $1
          returning id, course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, completed_work_notes, completed_at, image_urls, attachments, created_at, updated_at
        `,
        [workOrderId, courseId, title, detail, transition.toStatus, assignee, equipmentId || null, dueAt || null, costs.technicianEmployeeId, costs.technicianName, costs.laborHours, costs.laborRate, costs.laborCost, completedWorkNotes || null, completedAt || null, JSON.stringify(imageUrls), JSON.stringify(attachmentItems)]
      );

      const partsCost = await applyPartUsage(client, workOrderId, courseId, partUsages);
      const totalCost = Number((costs.laborCost + partsCost).toFixed(2));
      const updateTotals = await client.query(
        `
          update work_orders
          set parts_cost = $2,
              total_cost = $3
          where id = $1
          returning id, course_id, title, detail, status, assignee, equipment_id, due_at, technician_employee_id, technician_name, labor_hours, labor_rate, labor_cost, parts_cost, total_cost, completed_work_notes, completed_at, image_urls, attachments, created_at, updated_at
        `,
        [workOrderId, partsCost, totalCost]
      );
      const changedFields = buildChangedFields(workOrder, {
        courseId,
        title,
        detail,
        assignee,
        equipmentId,
        dueAt,
        technicianEmployeeId: costs.technicianEmployeeId,
        technicianName: costs.technicianName,
        laborHours: costs.laborHours,
        completedWorkNotes,
        completedAt
      });
      if (transition.fromStatus !== transition.toStatus) {
        await logWorkOrderActivity(client, {
          workOrderId,
          courseId,
          actorEmployeeId: req.employee.id,
          action: 'status_changed',
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          detail: { changedFields, transition: { from: transition.fromStatus, to: transition.toStatus } }
        });
      } else if (changedFields.length || partUsages.length) {
        await logWorkOrderActivity(client, {
          workOrderId,
          courseId,
          actorEmployeeId: req.employee.id,
          action: 'updated',
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          detail: {
            changedFields,
            partUsageCount: partUsages.length
          }
        });
      }
      await client.query('commit');

      res.json(await hydrateWorkOrderRow(client, updateTotals.rows[0], canSeeFinancials));
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

router.post('/:workOrderId/comments', requireAuth, async (req, res) => {
  const { workOrderId } = req.params;
  const { courseId, comment } = req.body;

  try {
    if (typeof comment !== 'string' || comment.trim().length < 1 || comment.trim().length > 2000) {
      return res.status(400).json({ error: 'Comment must be between 1 and 2000 characters' });
    }

    const existing = await query('select id, course_id, status from work_orders where id = $1', [workOrderId]);
    const workOrder = existing.rows[0];
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    if (workOrder.course_id !== courseId) {
      return res.status(403).json({ error: 'Course scope mismatch' });
    }

    const role = await getRoleForCourse(req.employee, workOrder.course_id);
    if (!role) {
      return res.status(403).json({ error: 'No access to this course' });
    }

    const client = await connect();
    try {
      await client.query('begin');
      await logWorkOrderActivity(client, {
        workOrderId,
        courseId: workOrder.course_id,
        actorEmployeeId: req.employee.id,
        action: 'commented',
        fromStatus: workOrder.status,
        toStatus: workOrder.status,
        detail: { comment: comment.trim() }
      });
      const activity = await loadWorkOrderActivity(client, workOrderId);
      await client.query('commit');
      return res.status(201).json(activity[0]);
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

router.delete('/:workOrderId', requireAuth, async (req, res) => {
  const { workOrderId } = req.params;
  const { expectedUpdatedAt } = req.body || {};

  try {
    const existing = await query('select id, course_id, updated_at from work_orders where id = $1', [workOrderId]);
    const workOrder = existing.rows[0];
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const role = await getRoleForCourse(req.employee, workOrder.course_id);
    if (!canWrite(role)) {
      return res.status(403).json({ error: 'Write access denied for this course' });
    }

    if (expectedUpdatedAt && new Date(workOrder.updated_at).toISOString() !== new Date(expectedUpdatedAt).toISOString()) {
      return res.status(409).json({ error: 'Work order was updated by someone else. Review the latest server version before deleting.', conflict: 'stale_delete', currentUpdatedAt: workOrder.updated_at });
    }

    const client = await connect();
    try {
      await client.query('begin');
      await restorePartInventory(client, workOrderId);
      await client.query('delete from work_orders where id = $1', [workOrderId]);
      await client.query('commit');
      res.status(204).send();
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
