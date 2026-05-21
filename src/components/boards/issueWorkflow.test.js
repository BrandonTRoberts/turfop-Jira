import { describe, expect, it } from 'vitest';
import { WORK_ORDER_COLUMNS, getWorkOrderColumnLabel, isPriorityStatus } from './issueWorkflow';

describe('issue workflow presentation', () => {
  it('keeps backend status values stable while making operational labels clearer', () => {
    expect(WORK_ORDER_COLUMNS.map((column) => column.status)).toEqual([
      'Open',
      'High',
      'Due today',
      'In Progress',
      'Blocked',
      'Completed',
    ]);
    expect(getWorkOrderColumnLabel('High')).toBe('High Priority');
    expect(getWorkOrderColumnLabel('Due today')).toBe('Due Today');
  });

  it('identifies priority-like status buckets used by the current backend workflow', () => {
    expect(isPriorityStatus('High')).toBe(true);
    expect(isPriorityStatus('Due today')).toBe(true);
    expect(isPriorityStatus('Open')).toBe(false);
  });
});
