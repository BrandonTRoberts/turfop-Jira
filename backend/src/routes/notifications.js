import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getNotificationPreference, removeDeviceToken, updateNotificationPreference, upsertDeviceToken } from '../lib/notifications.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 30), 100);
  const unreadOnly = String(req.query.unreadOnly || 'false') === 'true';
  try {
    const where = unreadOnly ? 'and n.read_at is null' : '';

    // Backward compatibility: older schemas may not include assigned_by_employee_id.
    let itemsResult;
    try {
      itemsResult = await query(
        `
          select n.*, e.full_name as assigned_by_name
          from notifications n
          left join employees e on e.id = n.assigned_by_employee_id
          where n.employee_id = $1 ${where}
          order by n.created_at desc
          limit $2
        `,
        [req.employee.id, limit]
      );
    } catch (joinError) {
      if (joinError?.code !== '42703') {
        throw joinError;
      }

      itemsResult = await query(
        `
          select n.*
          from notifications n
          where n.employee_id = $1 ${where}
          order by n.created_at desc
          limit $2
        `,
        [req.employee.id, limit]
      );
    }

    const unread = await query('select count(*)::int as unread_count from notifications where employee_id = $1 and read_at is null', [req.employee.id]);
    return res.json({ items: itemsResult.rows, unreadCount: unread.rows[0]?.unread_count || 0 });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/mark-read', requireAuth, async (req, res) => {
  const { notificationIds = [] } = req.body || {};
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) return res.status(400).json({ error: 'notificationIds are required' });
  try {
    await query(
      `
        update notifications
        set read_at = coalesce(read_at, now())
        where employee_id = $1 and id = any($2::uuid[])
      `,
      [req.employee.id, notificationIds]
    );
    return res.json({ ok: true });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/mark-all-read', requireAuth, async (req, res) => {
  try {
    await query('update notifications set read_at = coalesce(read_at, now()) where employee_id = $1 and read_at is null', [req.employee.id]);
    return res.json({ ok: true });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const pref = await getNotificationPreference(req.employee.id);
    return res.json(pref);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/preferences', requireAuth, async (req, res) => {
  try {
    const pref = await updateNotificationPreference(req.employee.id, req.body || {});
    return res.json(pref);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/devices/register', requireAuth, async (req, res) => {
  const { provider = 'onesignal', deviceToken, deviceType = 'web', appVersion = null, metadata = {} } = req.body || {};
  if (!deviceToken) return res.status(400).json({ error: 'deviceToken is required' });
  try {
    const device = await upsertDeviceToken({ employeeId: req.employee.id, provider, deviceToken, deviceType, appVersion, metadata });
    return res.status(201).json(device);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/devices/:provider/:deviceToken', requireAuth, async (req, res) => {
  try {
    await removeDeviceToken({ employeeId: req.employee.id, provider: req.params.provider, deviceToken: req.params.deviceToken });
    return res.status(204).send();
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
