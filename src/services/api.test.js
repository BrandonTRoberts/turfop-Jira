import { describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('api dashboard requests', () => {
  it('requests a scoped dashboard overview for the selected course', async () => {
    const payload = { summary: { openWorkOrders: 3 }, rollups: { workOrdersByCourse: [] } };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    await expect(api.dashboardOverview('course-123')).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/dashboard\/overview\?facilityId=course-123$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('can request company-wide dashboard overview when no course is supplied', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ summary: {}, rollups: {} }),
    });

    await api.dashboardOverview();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/dashboard\/overview$/),
      expect.any(Object),
    );
  });
});
