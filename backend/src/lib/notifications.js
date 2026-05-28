import { query } from './db.js';
import { env } from '../config/env.js';

function compactBody({ detail, requiredTools = [], checklist = [] }) {
  const detailText = String(detail || '').trim();
  const tools = Array.isArray(requiredTools) ? requiredTools.filter(Boolean).slice(0, 3) : [];
  const tasks = Array.isArray(checklist) ? checklist.filter(Boolean).slice(0, 2) : [];
  const parts = [];
  if (detailText) parts.push(detailText.slice(0, 140));
  if (tools.length) parts.push(`Tools: ${tools.join(', ')}`);
  if (tasks.length) parts.push(`Checklist: ${tasks.join(', ')}`);
  return parts.join(' • ').slice(0, 400);
}

function defaultNotificationPreference(employeeId) {
  return {
    employee_id: employeeId,
    notifications_enabled: true,
    assignment_notifications_enabled: true,
    push_enabled: false,
    email_enabled: false,
    updated_at: null,
    degraded: 'notification_preferences_table_missing',
  };
}

export async function getNotificationPreference(employeeId) {
  try {
    const result = await query(
      `
        insert into notification_preferences (employee_id)
        values ($1)
        on conflict (employee_id) do update set employee_id = excluded.employee_id
        returning employee_id, notifications_enabled, assignment_notifications_enabled, push_enabled, email_enabled, updated_at
      `,
      [employeeId]
    );
    return result.rows[0];
  } catch (error) {
    if (error?.code === '42P01') {
      return defaultNotificationPreference(employeeId);
    }
    throw error;
  }
}

export async function updateNotificationPreference(employeeId, patch = {}) {
  const current = await getNotificationPreference(employeeId);
  const next = {
    notifications_enabled: patch.notificationsEnabled ?? current.notifications_enabled,
    assignment_notifications_enabled: patch.assignmentNotificationsEnabled ?? current.assignment_notifications_enabled,
    push_enabled: patch.pushEnabled ?? current.push_enabled,
    email_enabled: patch.emailEnabled ?? current.email_enabled,
  };

  if (current?.degraded === 'notification_preferences_table_missing') {
    return {
      ...current,
      ...next,
      updated_at: null,
    };
  }

  try {
    const result = await query(
      `
        update notification_preferences
        set notifications_enabled = $2,
            assignment_notifications_enabled = $3,
            push_enabled = $4,
            email_enabled = $5,
            updated_at = now()
        where employee_id = $1
        returning employee_id, notifications_enabled, assignment_notifications_enabled, push_enabled, email_enabled, updated_at
      `,
      [employeeId, next.notifications_enabled, next.assignment_notifications_enabled, next.push_enabled, next.email_enabled]
    );
    return result.rows[0];
  } catch (error) {
    if (error?.code === '42P01') {
      return {
        ...defaultNotificationPreference(employeeId),
        ...next,
      };
    }
    throw error;
  }
}

export async function upsertDeviceToken({ employeeId, provider = 'onesignal', deviceToken, deviceType = 'web', appVersion = null, metadata = {} }) {
  if (!deviceToken) return null;
  const result = await query(
    `
      insert into notification_device_tokens (employee_id, provider, device_token, device_type, app_version, metadata, last_seen_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, now())
      on conflict (employee_id, provider, device_token)
      do update set device_type = excluded.device_type,
                    app_version = excluded.app_version,
                    metadata = excluded.metadata,
                    last_seen_at = now()
      returning id, employee_id, provider, device_token, device_type, app_version, metadata, last_seen_at
    `,
    [employeeId, provider, deviceToken, deviceType, appVersion, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
}

export async function removeDeviceToken({ employeeId, provider = 'onesignal', deviceToken }) {
  await query('delete from notification_device_tokens where employee_id = $1 and provider = $2 and device_token = $3', [employeeId, provider, deviceToken]);
}

async function sendOneSignalPush({ heading, content, deepLink, externalUserId }) {
  if (!env.oneSignalAppId || !env.oneSignalApiKey || !externalUserId) return { skipped: true, reason: 'onesignal_not_configured' };

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${env.oneSignalApiKey}`,
    },
    body: JSON.stringify({
      app_id: env.oneSignalAppId,
      include_external_user_ids: [externalUserId],
      channel_for_external_user_ids: 'push',
      headings: { en: heading },
      contents: { en: content || heading },
      url: deepLink || null,
      data: { deepLink: deepLink || null },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, status: response.status, payload };
  }
  return { ok: true, payload };
}

export async function createAssignmentNotification({
  employeeId,
  facilityId,
  workOrderId,
  ticketTitle,
  detail,
  requiredTools,
  checklist,
  dueAt,
  assignedByEmployeeId,
  assignedByName,
}) {
  const pref = await getNotificationPreference(employeeId);
  if (!pref.notifications_enabled || !pref.assignment_notifications_enabled) return null;

  const dueText = dueAt ? new Date(dueAt).toLocaleDateString('en-US') : null;
  const body = compactBody({ detail, requiredTools, checklist });
  const heading = `Assigned: ${ticketTitle}`;
  const deepLink = `${env.appBaseUrl || ''}/?view=issues&ticket=${encodeURIComponent(workOrderId)}&facility=${encodeURIComponent(facilityId)}`;
  const row = await query(
    `
      insert into notifications (employee_id, facility_id, work_order_id, type, title, body, payload, deep_link, assigned_by_employee_id)
      values ($1, $2, $3, 'work_order_assignment', $4, $5, $6::jsonb, $7, $8)
      returning id, employee_id, facility_id, work_order_id, type, title, body, payload, deep_link, assigned_by_employee_id, read_at, created_at
    `,
    [
      employeeId,
      facilityId,
      workOrderId,
      heading,
      body,
      JSON.stringify({ ticketTitle, dueAt: dueAt || null, dueText, assignedByName: assignedByName || null }),
      deepLink,
      assignedByEmployeeId || null,
    ]
  );

  if (pref.push_enabled) {
    await sendOneSignalPush({
      heading,
      content: `${assignedByName || 'A teammate'} assigned you a ticket${dueText ? ` • Due ${dueText}` : ''}`,
      deepLink,
      externalUserId: employeeId,
    });
  }

  return row.rows[0];
}
