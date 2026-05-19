export const WORK_ORDER_STATUSES = Object.freeze([
  'Open',
  'High',
  'Due today',
  'In Progress',
  'Blocked',
  'Completed',
  'Cancelled'
]);

const ACTIVE_STATUSES = new Set(['Open', 'High', 'Due today', 'In Progress', 'Blocked']);
const TERMINAL_STATUSES = new Set(['Completed', 'Cancelled']);

export function normalizeWorkOrderStatus(status) {
  const normalized = String(status || 'Open').trim();
  return normalized || 'Open';
}

export function isKnownWorkOrderStatus(status) {
  return WORK_ORDER_STATUSES.includes(normalizeWorkOrderStatus(status));
}

export function isTerminalWorkOrderStatus(status) {
  return TERMINAL_STATUSES.has(normalizeWorkOrderStatus(status));
}

export function validateWorkOrderStatus(status) {
  const normalized = normalizeWorkOrderStatus(status);
  if (!isKnownWorkOrderStatus(normalized)) {
    return {
      ok: false,
      status: normalized,
      error: `Invalid work order status: ${normalized}`,
      allowedStatuses: WORK_ORDER_STATUSES
    };
  }

  return { ok: true, status: normalized };
}

export function validateWorkOrderTransition(fromStatus, toStatus) {
  const target = validateWorkOrderStatus(toStatus);
  if (!target.ok) {
    return target;
  }

  const source = normalizeWorkOrderStatus(fromStatus);
  if (!isKnownWorkOrderStatus(source)) {
    return {
      ok: false,
      fromStatus: source,
      toStatus: target.status,
      error: `Invalid current work order status: ${source}`,
      allowedStatuses: WORK_ORDER_STATUSES
    };
  }

  if (source === target.status) {
    return { ok: true, fromStatus: source, toStatus: target.status };
  }

  const activeToActive = ACTIVE_STATUSES.has(source) && ACTIVE_STATUSES.has(target.status);
  const activeToTerminal = ACTIVE_STATUSES.has(source) && TERMINAL_STATUSES.has(target.status);
  const terminalToOpen = TERMINAL_STATUSES.has(source) && target.status === 'Open';

  if (activeToActive || activeToTerminal || terminalToOpen) {
    return { ok: true, fromStatus: source, toStatus: target.status };
  }

  return {
    ok: false,
    fromStatus: source,
    toStatus: target.status,
    error: `Invalid work order status transition: ${source} to ${target.status}`,
    allowedStatuses: WORK_ORDER_STATUSES
  };
}
