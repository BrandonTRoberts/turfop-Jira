export const WORK_ORDER_COLUMNS = Object.freeze([
  { status: 'Open', label: 'Open' },
  { status: 'High', label: 'High Priority' },
  { status: 'Due today', label: 'Due Today' },
  { status: 'In Progress', label: 'In Progress' },
  { status: 'Blocked', label: 'Blocked' },
  { status: 'Completed', label: 'Completed' },
]);

export const WORK_ORDER_STATUSES = Object.freeze(WORK_ORDER_COLUMNS.map((column) => column.status));

const priorityStatuses = new Set(['High', 'Due today', 'Blocked']);

export function getWorkOrderColumnLabel(status) {
  return WORK_ORDER_COLUMNS.find((column) => column.status === status)?.label || status;
}

export function isPriorityStatus(status) {
  return priorityStatuses.has(status);
}
