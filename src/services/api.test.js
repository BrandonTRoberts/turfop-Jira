import { describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('api dashboard requests', () => {
  it('maps inventory courseId payloads to facilityId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'part-1' }),
    });

    await api.createInventoryItem({ courseId: 'course-123', sku: 'ABC-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/parts-inventory$/),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(requestOptions.body).toContain('"facilityId":"course-123"');
    expect(requestOptions.body).toContain('"sku":"ABC-1"');
  });

  it('maps equipment courseId payloads to facilityId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'eq-1' }),
    });

    await api.createEquipment({ courseId: 'course-123', name: 'Mower' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/equipment$/),
      expect.objectContaining({ method: 'POST' }),
    );
    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(requestOptions.body).toContain('"facilityId":"course-123"');
    expect(requestOptions.body).toContain('"name":"Mower"');
  });

  it('maps legacy facility_id payloads to facilityId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'part-legacy' }),
    });

    await api.createInventoryItem({ facility_id: 'fac-legacy-1', sku: 'LEG-1' });

    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(requestOptions.body).toContain('"facilityId":"fac-legacy-1"');
    expect(requestOptions.body).not.toContain('"facility_id"');
  });

  it('prefers facility-native IDs when mapping courses', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([{ id: 'fac-id-1', facility_id: 'fac-uuid-1', course_id: 'legacy-course-1', name: 'North' }]),
    });

    const courses = await api.courses();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/facilities$/),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(courses[0].course_id).toBe('fac-uuid-1');
    expect(courses[0].legacy_course_id).toBe('legacy-course-1');
  });

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
