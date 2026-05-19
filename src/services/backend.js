import {
  courses as seedCourses,
  summaryStatsByCourse,
  seedWorkOrders,
  seedEquipment,
  inventory,
  defaultCourseAreaSettings
} from '../data/appData';
import { appConfig } from '../config/appConfig';
import { getStoredString, removeStoredString, setStoredString } from '../lib/tokenStorage';

const demoUser = {
  id: 'demo-user-001',
  email: 'demo@turfop.local',
  full_name: 'Demo Superintendent',
  must_change_password: false,
  profile_image_url: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: ''
};

const demoMemberships = [
  {
    id: 'membership-001',
    role: 'admin',
    course_id: 'course-001',
    name: 'Pine Ridge Golf Club',
    region: 'Scottsdale, AZ',
    superintendent_name: 'Dana Holt'
  },
  {
    id: 'membership-002',
    role: 'read_write',
    course_id: 'course-002',
    name: 'Red Canyon Links',
    region: 'St. George, UT',
    superintendent_name: 'Marco Ellis'
  },
  {
    id: 'membership-003',
    role: 'read_only',
    course_id: 'course-003',
    name: 'Silver Creek Country Club',
    region: 'Boise, ID',
    superintendent_name: 'Jamie Brooks'
  }
];

const storageKey = 'turfops_token';
const legacyStorageKey = 'greenkeeper_ops_token';
const offlineQueueKey = 'turfops_offline_queue';
const legacyOfflineQueueKey = 'greenkeeper_ops_offline_queue';
const cacheKey = 'turfops_offline_cache';
const legacyCacheKey = 'greenkeeper_ops_offline_cache';
const golfOpsSettingsKey = 'turfops_golfops_settings';
const legacyGolfOpsSettingsKey = 'greenkeeper_ops_golfops_settings';
const demoTimeEntriesKey = 'turfops_demo_time_entries';
const maxOfflineQueueItems = 60;

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function delay(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCourseAreas(courseAreas) {
  if (!Array.isArray(courseAreas) || courseAreas.length === 0) {
    return defaultCourseAreaSettings.map((area) => ({ ...area }));
  }

  return courseAreas.map((area, index) => ({
    name: area.name || defaultCourseAreaSettings[index]?.name || `Area ${index + 1}`,
    trackedCount: Number(area.trackedCount ?? area.tracked_count ?? 0),
    note: area.note || ''
  }));
}

function createRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDemoModeEnabled() {
  return Boolean(appConfig.backend.allowDemoMode);
}

function getApiUnavailableMessage() {
  return 'TurfOp API is unavailable. Check the API deployment and VITE_API_BASE_URL.';
}

function readJsonStorage(key, fallback) {
  if (!isBrowser()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readJsonStorageWithLegacy(key, legacyKey, fallback) {
  const current = readJsonStorage(key, undefined);
  if (current !== undefined) return current;

  const legacy = legacyKey ? readJsonStorage(legacyKey, undefined) : undefined;
  if (legacy !== undefined) {
    writeJsonStorage(key, legacy);
    return legacy;
  }

  return fallback;
}

function readDemoTimeEntries() {
  return readJsonStorage(demoTimeEntriesKey, []);
}

function writeDemoTimeEntries(entries) {
  writeJsonStorage(demoTimeEntriesKey, entries);
}

function readOfflineCache() {
  return readJsonStorageWithLegacy(cacheKey, legacyCacheKey, { workOrders: {}, equipment: {}, parts: {} });
}

function writeOfflineCache(cache) {
  writeJsonStorage(cacheKey, cache);
}

function replaceCachedCollection(bucket, courseId, items) {
  const cache = readOfflineCache();
  cache[bucket] = cache[bucket] || {};
  cache[bucket][courseId] = items;
  writeOfflineCache(cache);
  return items;
}

function readCachedCollection(bucket, courseId, fallback = []) {
  const cache = readOfflineCache();
  return cache[bucket]?.[courseId] || fallback;
}

function updateCachedCollection(bucket, courseId, updater) {
  const current = readCachedCollection(bucket, courseId, []);
  return replaceCachedCollection(bucket, courseId, updater(current));
}

function readOfflineQueue() {
  return readJsonStorageWithLegacy(offlineQueueKey, legacyOfflineQueueKey, []);
}

function writeOfflineQueue(queue) {
  writeJsonStorage(offlineQueueKey, queue);
}

function createOfflineId(prefix) {
  return `${prefix}-offline-${createRandomId().replace(/-/g, '').slice(0, 8)}`;
}

function queueOfflineMutation(item) {
  const queuedItem = {
    ...item,
    queuedAt: new Date().toISOString(),
    lastError: null,
    failedAt: null,
    conflictType: null,
    conflictStatus: null
  };
  const queue = readOfflineQueue();
  const existingIndex = queue.findIndex((entry) => (
    entry.bucket === queuedItem.bucket
    && entry.courseId === queuedItem.courseId
    && entry.entityId === queuedItem.entityId
  ));

  if (existingIndex >= 0) {
    const existing = queue[existingIndex];

    if (existing.operation === 'create' && queuedItem.operation === 'update') {
      queue[existingIndex] = {
        ...existing,
        record: { ...(existing.record || {}), ...(queuedItem.record || {}) },
        queuedAt: queuedItem.queuedAt
      };
      writeOfflineQueue(queue);
      return queue;
    }

    if (existing.operation === 'create' && queuedItem.operation === 'delete') {
      const nextQueue = queue.filter((_, index) => index !== existingIndex);
      writeOfflineQueue(nextQueue);
      return nextQueue;
    }

    if (existing.operation === 'update' && queuedItem.operation === 'update') {
      queue[existingIndex] = {
        ...existing,
        record: { ...(existing.record || {}), ...(queuedItem.record || {}) },
        queuedAt: queuedItem.queuedAt
      };
      writeOfflineQueue(queue);
      return queue;
    }

    if (existing.operation === 'update' && queuedItem.operation === 'delete') {
      queue[existingIndex] = {
        ...queuedItem,
        id: existing.id
      };
      writeOfflineQueue(queue);
      return queue;
    }
  }

  if (queue.length >= maxOfflineQueueItems) {
    throw new Error(`Offline queue is full (${maxOfflineQueueItems} pending changes). Sync before adding more updates.`);
  }

  const nextQueue = [...queue, queuedItem];
  writeOfflineQueue(nextQueue);
  return nextQueue;
}

function removeQueuedMutation(id) {
  writeOfflineQueue(readOfflineQueue().filter((item) => item.id !== id));
}

function updateQueuedMutation(id, updater) {
  const queue = readOfflineQueue();
  const nextQueue = queue.map((item) => (item.id === id ? updater(item) : item));
  writeOfflineQueue(nextQueue);
  return nextQueue;
}

function getQueuedCount() {
  return readOfflineQueue().length;
}

async function apiFetch(path, options = {}) {
  const token = await getStoredString(storageKey);
  const response = await fetch(`${appConfig.backend.apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // ignore parse issue
    }
    const error = new Error(`${message} [${options.method || 'GET'} ${path}]`);
    error.status = response.status;
    error.path = path;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const apiReachabilityCache = {
  value: null,
  checkedAt: 0,
  pending: null
};

function getApiHealthTimeoutSignal(timeoutMs = 2500) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
}

export async function isApiReachable({ force = false } = {}) {
  const now = Date.now();
  if (!force && apiReachabilityCache.value !== null && now - apiReachabilityCache.checkedAt < 15000) {
    return apiReachabilityCache.value;
  }

  if (apiReachabilityCache.pending) {
    return apiReachabilityCache.pending;
  }

  apiReachabilityCache.pending = (async () => {
    try {
      const response = await fetch(`${appConfig.backend.apiBaseUrl}/health`, {
        signal: getApiHealthTimeoutSignal()
      });
      apiReachabilityCache.value = response.ok;
      apiReachabilityCache.checkedAt = Date.now();
      return response.ok;
    } catch {
      apiReachabilityCache.value = false;
      apiReachabilityCache.checkedAt = Date.now();
      return false;
    } finally {
      apiReachabilityCache.pending = null;
    }
  })();

  return apiReachabilityCache.pending;
}

export async function getSessionUser(options = {}) {
  const online = options.assumeReachable ?? await isApiReachable();
  if (online) {
    const token = await getStoredString(storageKey) || await getStoredString(legacyStorageKey);
    if (token && !(await getStoredString(storageKey))) {
      await setStoredString(storageKey, token);
    }

    try {
      const data = await apiFetch('/auth/me');
      return {
        employee: data.employee,
        memberships: data.memberships,
        mustChangePassword: data.mustChangePassword
      };
    } catch (error) {
      if (error?.status === 401) {
        await removeStoredString(storageKey);
        await removeStoredString(legacyStorageKey);
        return null;
      }

      throw error;
    }
  }

  if (!isDemoModeEnabled()) {
    return null;
  }

  await delay(80);
  return {
    employee: demoUser,
    memberships: demoMemberships,
    mustChangePassword: false
  };
}

export async function signInWithPassword(email, password) {
  if (await isApiReachable()) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.token) {
      await setStoredString(storageKey, data.token);
      await removeStoredString(legacyStorageKey);
    }
    return {
      employee: data.employee,
      memberships: data.memberships,
      mustChangePassword: data.mustChangePassword
    };
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay(120);
  return {
    employee: { ...demoUser, email: email || demoUser.email },
    memberships: demoMemberships,
    mustChangePassword: false
  };
}

export async function acceptInvite(payload) {
  if (await isApiReachable()) {
    return apiFetch('/auth/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay(120);
  return { ok: true };
}

export async function signOutUser() {
  if (await isApiReachable()) {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout API failures and clear local state anyway
    }
  }

  await removeStoredString(storageKey);
  await removeStoredString(legacyStorageKey);
  await delay(60);
}

export async function updateMyProfile(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return data.employee;
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay(120);
  return {
    ...demoUser,
    email: payload.email,
    full_name: payload.fullName,
    phone: payload.phone || '',
    address_line_1: payload.addressLine1 || '',
    address_line_2: payload.addressLine2 || '',
    city: payload.city || '',
    state: payload.state || '',
    postal_code: payload.postalCode || '',
    profile_image_url: payload.profileImage?.dataUrl || payload.profileImage?.url || payload.profile_image_url || ''
  };
}

export async function changePassword(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data.token) {
      await setStoredString(storageKey, data.token);
      await removeStoredString(legacyStorageKey);
    }

    return data;
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay(120);
  return { ok: true };
}

export async function listMemberships() {
  if (await isApiReachable()) {
    const data = await apiFetch('/auth/me');
    return data.memberships;
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return demoMemberships;
}

export async function listCourses(tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/courses${params.toString() ? `?${params.toString()}` : ''}`);
    return data.map((course) => ({
      id: course.course_id || course.courseId || course.id,
      membershipId: course.id || '',
      companyId: course.company_id || course.companyId || '',
      companyName: course.company_name || course.companyName || '',
      name: course.name,
      region: course.region,
      superintendent: course.superintendent_name || course.superintendentName || '',
      courseAreas: normalizeCourseAreas(course.course_areas_config || course.courseAreas),
      role: course.role
    }));
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return seedCourses.map((course, index) => ({
    ...course,
    companyId: 'demo-company-001',
    companyName: 'Demo Turf Operations',
    courseAreas: normalizeCourseAreas(course.courseAreas),
    role: demoMemberships[index]?.role || 'admin'
  }));
}

export async function listCompanies() {
  if (await isApiReachable()) {
    return apiFetch('/companies');
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return [{ id: 'demo-company-001', name: 'Demo Turf Operations', created_at: new Date().toISOString() }];
}

export async function createCompany(payload) {
  if (await isApiReachable()) {
    return apiFetch('/companies', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return { id: `company-${createRandomId().slice(0, 8)}`, name: payload.name, created_at: new Date().toISOString() };
}

export async function createCourse(payload) {
  if (await isApiReachable()) {
    return apiFetch('/courses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    id: `course-${createRandomId().slice(0, 8)}`,
    company_id: payload.companyId,
    company_name: 'Demo Turf Operations',
    name: payload.name,
    region: payload.region || '',
    superintendent_name: payload.superintendentName || '',
    course_areas_config: normalizeCourseAreas(payload.courseAreas),
    created_at: new Date().toISOString()
  };
}

export async function updateCourse(courseId, payload) {
  if (await isApiReachable()) {
    return apiFetch(`/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    id: courseId,
    company_id: payload.companyId || 'demo-company-001',
    company_name: 'Demo Turf Operations',
    name: payload.name,
    region: payload.region || '',
    superintendent_name: payload.superintendentName || '',
    course_areas_config: normalizeCourseAreas(payload.courseAreas),
    created_at: new Date().toISOString()
  };
}

export async function getDashboardOverview(courseId = '', tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams();
    if (courseId) params.set('courseId', courseId);
    if (tenantId) params.set('tenantId', tenantId);
    return apiFetch(`/dashboard/overview${params.toString() ? `?${params.toString()}` : ''}`);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    summary: {
      openWorkOrders: 6,
      overdueWorkOrders: 2,
      completedThisWeek: 4,
      mttrHours: 18.5,
      clockedInNow: 3,
      totalHoursThisWeek: 96,
      overtimeHours: 8,
      pendingApprovals: 2,
      totalSkus: 42,
      lowStockItems: 5,
      outOfStockItems: 1,
      inventoryValue: 18450,
      totalEmployees: 9,
      activeCourses: 3,
      equipmentNeedingAttention: 4
    },
    rollups: {
      workOrdersByCourse: seedCourses.slice(0, 3).map((course, index) => ({ course_id: course.id, name: course.name, open_work_orders: [3, 2, 1][index], completed_this_week: [2, 1, 1][index] })),
      hoursByCourse: seedCourses.slice(0, 3).map((course, index) => ({ course_id: course.id, name: course.name, total_hours: [42, 31, 23][index] })),
      lowStockByCourse: seedCourses.slice(0, 3).map((course, index) => ({ course_id: course.id, name: course.name, low_stock_items: [3, 1, 1][index] }))
    }
  };
}

function readImageUrls(item) {
  return item.image_urls || item.imageUrls || item.images || [];
}

function mapWorkOrderRecord(item) {
  return {
    id: item.id,
    courseId: item.course_id || item.courseId,
    title: item.title,
    detail: item.detail,
    status: item.status,
    assignee: item.assignee,
    technicianEmployeeId: item.technician_employee_id || item.technicianEmployeeId || '',
    technicianName: item.technician_name || item.technicianName,
    laborHours: item.labor_hours ?? item.laborHours ?? '',
    laborRate: item.labor_rate ?? item.laborRate ?? '',
    laborCost: item.labor_cost ?? item.laborCost ?? '',
    partsCost: item.parts_cost ?? item.partsCost ?? '',
    totalCost: item.total_cost ?? item.totalCost ?? '',
    completedWorkNotes: item.completed_work_notes || item.completedWorkNotes || '',
    completedAt: item.completed_at || item.completedAt || '',
    updatedAt: item.updated_at || item.updatedAt || item.created_at || item.createdAt || '',
    imageUrls: readImageUrls(item),
    syncStatus: item.syncStatus || 'synced',
    activityLog: (item.activity_log || item.activityLog || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      fromStatus: entry.from_status || entry.fromStatus || '',
      toStatus: entry.to_status || entry.toStatus || '',
      detail: entry.detail || {},
      actorEmployeeId: entry.actor_employee_id || entry.actorEmployeeId || '',
      actorName: entry.actor_name || entry.actorName || '',
      actorEmail: entry.actor_email || entry.actorEmail || '',
      createdAt: entry.created_at || entry.createdAt || ''
    })),
    partUsages: (item.part_usages || item.partUsages || []).map((usage) => ({
      id: usage.id,
      partInventoryId: usage.part_inventory_id || usage.partInventoryId,
      sku: usage.sku,
      partDescription: usage.part_description || usage.partDescription,
      quantityUsed: usage.quantity_used ?? usage.quantityUsed ?? '',
      unitCost: usage.unit_cost ?? usage.unitCost ?? '',
      totalCost: usage.total_cost ?? usage.totalCost ?? ''
    }))
  };
}

function mapQueuedWorkOrderRecord(id, payload) {
  return mapWorkOrderRecord({
    id,
    ...payload,
    updatedAt: payload.expectedUpdatedAt || payload.updatedAt || new Date().toISOString(),
    imageUrls: payload.images || payload.imageUrls || [],
    syncStatus: 'queued'
  });
}

function queueCachedMutation(bucket, courseId, entityId, operation, record) {
  queueOfflineMutation({
    id: createOfflineId('queue'),
    bucket,
    courseId,
    entityId,
    operation,
    record
  });
}

function getCachedWorkOrderSeed(courseId) {
  return seedWorkOrders.filter((item) => item.courseId === courseId).map(mapWorkOrderRecord);
}

export async function listWorkOrders(courseId, tenantId) {
  if (await isApiReachable()) {
    try {
      const params = new URLSearchParams({ courseId });
      if (tenantId) params.set('tenantId', tenantId);
      const data = await apiFetch(`/work-orders?${params.toString()}`);
      return replaceCachedCollection('workOrders', courseId, data.map(mapWorkOrderRecord));
    } catch (error) {
      if (error?.status >= 500) {
        return readCachedCollection(
          'workOrders',
          courseId,
          isDemoModeEnabled() ? getCachedWorkOrderSeed(courseId) : []
        );
      }
      throw error;
    }
  }

  await delay();
  return readCachedCollection(
    'workOrders',
    courseId,
    isDemoModeEnabled() ? getCachedWorkOrderSeed(courseId) : []
  );
}

export async function listEquipment(courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/equipment?${params.toString()}`);
    return replaceCachedCollection('equipment', courseId, data.map(mapEquipmentRecord));
  }

  await delay();
  return readCachedCollection(
    'equipment',
    courseId,
    isDemoModeEnabled() ? seedEquipment.filter((item) => item.courseId === courseId).map(mapEquipmentRecord) : []
  );
}

export async function createWorkOrder(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch('/work-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const mapped = mapWorkOrderRecord(data);
    updateCachedCollection('workOrders', mapped.courseId, (items) => [mapped, ...items.filter((item) => item.id !== mapped.id)]);
    return mapped;
  }

  await delay();
  const offlineId = createOfflineId('wo');
  const mapped = mapQueuedWorkOrderRecord(offlineId, payload);
  updateCachedCollection('workOrders', payload.courseId, (items) => [mapped, ...items.filter((item) => item.id !== offlineId)]);
  queueCachedMutation('workOrders', payload.courseId, offlineId, 'create', payload);
  return mapped;
}

export async function updateWorkOrder(workOrderId, payload) {
  if (await isApiReachable()) {
    const data = await apiFetch(`/work-orders/${workOrderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    const mapped = mapWorkOrderRecord(data);
    updateCachedCollection('workOrders', payload.courseId || mapped.courseId, (items) => items.map((item) => (item.id === workOrderId ? mapped : item)));
    return mapped;
  }

  await delay();
  const mapped = mapQueuedWorkOrderRecord(workOrderId, payload);
  updateCachedCollection('workOrders', payload.courseId, (items) => items.map((item) => (item.id === workOrderId ? mapped : item)));
  queueCachedMutation('workOrders', payload.courseId, workOrderId, 'update', payload);
  return mapped;
}

export async function deleteWorkOrder(workOrderId, courseId = '', expectedUpdatedAt = '', tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    await apiFetch(`/work-orders/${workOrderId}${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'DELETE',
      body: JSON.stringify(expectedUpdatedAt ? { expectedUpdatedAt } : {})
    });
    if (courseId) {
      updateCachedCollection('workOrders', courseId, (items) => items.filter((item) => item.id !== workOrderId));
    }
    return;
  }

  await delay();
  if (courseId) {
    updateCachedCollection('workOrders', courseId, (items) => items.filter((item) => item.id !== workOrderId));
    queueCachedMutation('workOrders', courseId, workOrderId, 'delete', { courseId });
  }
}

function mapPartRecord(item) {
  return {
    id: item.id,
    courseId: item.course_id || item.courseId,
    sku: item.sku,
    partDescription: item.part_description || item.partDescription,
    quantityOnHand: item.quantity_on_hand ?? item.quantityOnHand ?? '',
    unitCost: item.unit_cost ?? item.unitCost ?? '',
    reorderUrl: item.reorder_url || item.reorderUrl || '',
    imageUrls: readImageUrls(item)
  };
}

export async function listPartsInventory(courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/parts-inventory?${params.toString()}`);
    return replaceCachedCollection('parts', courseId, data.map(mapPartRecord));
  }

  await delay();
  return readCachedCollection(
    'parts',
    courseId,
    isDemoModeEnabled() ? inventory.filter((item) => item.courseId === courseId).map(mapPartRecord) : []
  );
}

export async function createPart(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch('/parts-inventory', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapPartRecord(data);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return mapPartRecord({ id: `part-${crypto.randomUUID().slice(0, 8)}`, ...payload, imageUrls: payload.images || payload.imageUrls || [] });
}

export async function updatePart(partId, payload) {
  if (await isApiReachable()) {
    const data = await apiFetch(`/parts-inventory/${partId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return mapPartRecord(data);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return mapPartRecord({ id: partId, ...payload, imageUrls: payload.images || payload.imageUrls || [] });
}

export async function deletePart(partId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    await apiFetch(`/parts-inventory/${partId}${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'DELETE'
    });
    return;
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
}

export async function getCourseReport(courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    return apiFetch(`/reports/course-summary?${params.toString()}`);
  }

  await delay();
  const courseWorkOrders = isDemoModeEnabled()
    ? seedWorkOrders.filter((item) => item.courseId === courseId)
    : readCachedCollection('workOrders', courseId, []);
  const courseParts = isDemoModeEnabled()
    ? inventory.filter((item) => item.courseId === courseId)
    : readCachedCollection('parts', courseId, []);

  return {
    workOrders: {
      work_order_count: courseWorkOrders.length,
      labor_hours_total: courseWorkOrders.reduce((sum, item) => sum + Number(item.laborHours || 0), 0),
      labor_cost_total: courseWorkOrders.reduce((sum, item) => sum + Number(item.laborCost || 0), 0),
      parts_cost_total: courseWorkOrders.reduce((sum, item) => sum + Number(item.partsCost || 0), 0),
      total_cost_total: courseWorkOrders.reduce((sum, item) => sum + Number(item.totalCost || 0), 0)
    },
    parts: {
      part_count: courseParts.length,
      quantity_on_hand_total: courseParts.reduce((sum, item) => sum + Number(item.quantityOnHand || 0), 0),
      inventory_value_total: courseParts.reduce((sum, item) => sum + Number(item.quantityOnHand || 0) * Number(item.unitCost || 0), 0)
    }
  };
}

function mapEquipmentRecord(data) {
  return {
    id: data.id,
    courseId: data.course_id || data.courseId,
    name: data.name,
    make: data.make,
    model: data.model,
    assignedArea: data.assigned_area || data.assignedArea || '',
    vin: data.vin,
    serialNumber: data.serial_number || data.serialNumber,
    description: data.description || data.detail,
    hours: data.hours,
    detail: data.detail,
    status: data.status,
    updatedAt: data.updated_at || data.updatedAt || data.created_at || data.createdAt || '',
    imageUrls: readImageUrls(data),
    syncStatus: data.syncStatus || 'synced'
  };
}

function mapQueuedEquipmentRecord(id, payload) {
  return mapEquipmentRecord({
    id,
    ...payload,
    updatedAt: payload.expectedUpdatedAt || payload.updatedAt || new Date().toISOString(),
    imageUrls: payload.images || payload.imageUrls || [],
    syncStatus: 'queued'
  });
}

export async function createEquipment(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch('/equipment', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const mapped = mapEquipmentRecord(data);
    updateCachedCollection('equipment', mapped.courseId, (items) => [mapped, ...items.filter((item) => item.id !== mapped.id)]);
    return mapped;
  }

  await delay();
  const offlineId = createOfflineId('eq');
  const mapped = mapQueuedEquipmentRecord(offlineId, payload);
  updateCachedCollection('equipment', payload.courseId, (items) => [mapped, ...items.filter((item) => item.id !== offlineId)]);
  queueCachedMutation('equipment', payload.courseId, offlineId, 'create', payload);
  return mapped;
}

export async function updateEquipment(equipmentId, payload) {
  if (await isApiReachable()) {
    const data = await apiFetch(`/equipment/${equipmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    const mapped = mapEquipmentRecord(data);
    updateCachedCollection('equipment', payload.courseId || mapped.courseId, (items) => items.map((item) => (item.id === equipmentId ? mapped : item)));
    return mapped;
  }

  await delay();
  const mapped = mapQueuedEquipmentRecord(equipmentId, payload);
  updateCachedCollection('equipment', payload.courseId, (items) => items.map((item) => (item.id === equipmentId ? mapped : item)));
  queueCachedMutation('equipment', payload.courseId, equipmentId, 'update', payload);
  return mapped;
}

export async function deleteEquipment(equipmentId, courseId = '', expectedUpdatedAt = '', tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    await apiFetch(`/equipment/${equipmentId}${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'DELETE',
      body: JSON.stringify(expectedUpdatedAt ? { expectedUpdatedAt } : {})
    });
    if (courseId) {
      updateCachedCollection('equipment', courseId, (items) => items.filter((item) => item.id !== equipmentId));
    }
    return;
  }

  await delay();
  if (courseId) {
    updateCachedCollection('equipment', courseId, (items) => items.filter((item) => item.id !== equipmentId));
    queueCachedMutation('equipment', courseId, equipmentId, 'delete', { courseId });
  }
}

function mapTimeEntryRecord(item) {
  return {
    id: item.id,
    employee_id: item.employee_id || item.employeeId,
    employee_name: item.employee_name || item.employeeName || '',
    employee_email: item.employee_email || item.employeeEmail || '',
    course_id: item.course_id || item.courseId,
    clock_in_at: item.clock_in_at || item.clockInAt || '',
    clock_out_at: item.clock_out_at || item.clockOutAt || '',
    clock_in_note: item.clock_in_note || item.clockInNote || '',
    clock_out_note: item.clock_out_note || item.clockOutNote || '',
    clock_in_latitude: Number(item.clock_in_latitude ?? item.clockInLatitude ?? 0) || null,
    clock_in_longitude: Number(item.clock_in_longitude ?? item.clockInLongitude ?? 0) || null,
    clock_out_latitude: Number(item.clock_out_latitude ?? item.clockOutLatitude ?? 0) || null,
    clock_out_longitude: Number(item.clock_out_longitude ?? item.clockOutLongitude ?? 0) || null,
    approved_at: item.approved_at || item.approvedAt || '',
    approved_by_employee_id: item.approved_by_employee_id || item.approvedByEmployeeId || '',
    approved_by_name: item.approved_by_name || item.approvedByName || '',
    approved_by_email: item.approved_by_email || item.approvedByEmail || '',
    approval_note: item.approval_note || item.approvalNote || '',
    updated_at: item.updated_at || item.updatedAt || '',
    created_at: item.created_at || item.createdAt || '',
    worked_hours: Number(item.worked_hours ?? item.workedHours ?? 0)
  };
}

function mapTimeSummaryRecord(item) {
  return {
    employee_id: item.employee_id || item.employeeId || '',
    employee_name: item.employee_name || item.employeeName || '',
    employee_email: item.employee_email || item.employeeEmail || '',
    hourly_rate: Number(item.hourly_rate ?? item.hourlyRate ?? 0),
    entry_count: Number(item.entry_count ?? item.entryCount ?? 0),
    active_entry_count: Number(item.active_entry_count ?? item.activeEntryCount ?? 0),
    approved_entry_count: Number(item.approved_entry_count ?? item.approvedEntryCount ?? 0),
    total_hours: Number(item.total_hours ?? item.totalHours ?? 0),
    regular_hours: Number(item.regular_hours ?? item.regularHours ?? 0),
    overtime_hours: Number(item.overtime_hours ?? item.overtimeHours ?? 0),
    regular_pay: Number(item.regular_pay ?? item.regularPay ?? 0),
    overtime_pay: Number(item.overtime_pay ?? item.overtimePay ?? 0),
    total_pay: Number(item.total_pay ?? item.totalPay ?? 0)
  };
}

export async function listTimeEntries(courseId, options = {}, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({
      courseId,
      scope: options.scope || 'mine',
      limit: String(options.limit || 10)
    });
    if (options.employeeId) {
      params.set('employeeId', options.employeeId);
    }
    if (tenantId) {
      params.set('tenantId', tenantId);
    }

    const data = await apiFetch(`/time-entries?${params.toString()}`);
    return {
      items: (data.items || []).map(mapTimeEntryRecord),
      activeEntry: data.activeEntry ? mapTimeEntryRecord(data.activeEntry) : null
    };
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const scope = options.scope || 'mine';
  const limit = options.limit || 10;
  const employeeId = scope === 'mine' ? demoUser.id : options.employeeId || '';
  const items = readDemoTimeEntries()
    .filter((entry) => entry.course_id === courseId)
    .filter((entry) => (employeeId ? entry.employee_id === employeeId : true))
    .sort((a, b) => new Date(b.clock_in_at).getTime() - new Date(a.clock_in_at).getTime())
    .slice(0, limit)
    .map(mapTimeEntryRecord);

  return {
    items,
    activeEntry: items.find((entry) => !entry.clock_out_at) || null
  };
}

export async function listTimeSummary(courseId, options = {}, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({
      courseId,
      scope: options.scope || 'mine'
    });
    if (options.employeeId) params.set('employeeId', options.employeeId);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    if (options.approvedOnly) params.set('approvedOnly', 'true');
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/time-entries/summary?${params.toString()}`);
    return { ...data, items: (data.items || []).map(mapTimeSummaryRecord) };
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const scope = options.scope || 'mine';
  const employeeId = scope === 'mine' ? demoUser.id : options.employeeId || '';
  const fallbackStart = options.startDate ? new Date(options.startDate).getTime() : (Date.now() - (7 * 24 * 60 * 60 * 1000));
  const fallbackEnd = options.endDate ? new Date(options.endDate).getTime() : Number.POSITIVE_INFINITY;
  const buckets = new Map();
  const weeklyBuckets = new Map();
  for (const entry of readDemoTimeEntries()) {
    const clockInAt = new Date(entry.clock_in_at).getTime();
    if (entry.course_id !== courseId) continue;
    if (clockInAt < fallbackStart || clockInAt > fallbackEnd) continue;
    if (options.approvedOnly && !entry.approved_at) continue;
    if (employeeId && entry.employee_id !== employeeId) continue;
    const current = buckets.get(entry.employee_id) || {
      employee_id: entry.employee_id,
      employee_name: entry.employee_name,
      employee_email: entry.employee_email,
      hourly_rate: Number(entry.hourly_rate || 0),
      entry_count: 0,
      active_entry_count: 0,
      approved_entry_count: 0,
      total_hours: 0
    };
    current.entry_count += 1;
    current.active_entry_count += entry.clock_out_at ? 0 : 1;
    current.approved_entry_count += entry.approved_at ? 1 : 0;
    current.total_hours += Number(entry.worked_hours || 0);
    buckets.set(entry.employee_id, current);

    const weekStart = new Date(entry.clock_in_at);
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = weekStart.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysSinceMonday);
    const weeklyKey = `${entry.employee_id}:${weekStart.toISOString()}`;
    weeklyBuckets.set(weeklyKey, Number(weeklyBuckets.get(weeklyKey) || 0) + Number(entry.worked_hours || 0));
  }
  const items = Array.from(buckets.values()).map(mapTimeSummaryRecord);
  const normalizedItems = items.map((item) => {
    let regularHours = 0;
    let overtimeHours = 0;
    for (const [weeklyKey, weekHours] of weeklyBuckets.entries()) {
      if (!weeklyKey.startsWith(`${item.employee_id}:`)) continue;
      const safeWeekHours = Number(weekHours || 0);
      overtimeHours += Math.max(0, safeWeekHours - 40);
      regularHours += Math.min(safeWeekHours, 40);
    }
    const hourlyRate = Number(item.hourly_rate || 0);
    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.5;
    return {
      ...item,
      regular_hours: Number(regularHours.toFixed(2)),
      overtime_hours: Number(overtimeHours.toFixed(2)),
      regular_pay: Number(regularPay.toFixed(2)),
      overtime_pay: Number(overtimePay.toFixed(2)),
      total_pay: Number((regularPay + overtimePay).toFixed(2))
    };
  });
  return {
    scope,
    weekStartsAt: options.startDate || new Date().toISOString(),
    rangeEndAt: options.endDate || '',
    approvedOnly: Boolean(options.approvedOnly),
    items: normalizedItems,
    totals: {
      totalHours: Number(normalizedItems.reduce((sum, item) => sum + item.total_hours, 0).toFixed(2)),
      regularHours: Number(normalizedItems.reduce((sum, item) => sum + item.regular_hours, 0).toFixed(2)),
      overtimeHours: Number(normalizedItems.reduce((sum, item) => sum + item.overtime_hours, 0).toFixed(2)),
      regularPay: Number(normalizedItems.reduce((sum, item) => sum + item.regular_pay, 0).toFixed(2)),
      overtimePay: Number(normalizedItems.reduce((sum, item) => sum + item.overtime_pay, 0).toFixed(2)),
      totalPay: Number(normalizedItems.reduce((sum, item) => sum + item.total_pay, 0).toFixed(2)),
      totalEntries: normalizedItems.reduce((sum, item) => sum + item.entry_count, 0),
      activeEntries: normalizedItems.reduce((sum, item) => sum + item.active_entry_count, 0),
      approvedEntries: normalizedItems.reduce((sum, item) => sum + item.approved_entry_count, 0)
    }
  };
}

export async function clockInTimeEntry(courseId, note = '', location = null) {
  if (await isApiReachable()) {
    const data = await apiFetch('/time-entries/clock-in', {
      method: 'POST',
      body: JSON.stringify({ courseId, note, location })
    });
    return mapTimeEntryRecord(data);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const entries = readDemoTimeEntries();
  const existing = entries.find((entry) => entry.course_id === courseId && entry.employee_id === demoUser.id && !entry.clock_out_at);
  if (existing) {
    throw new Error('You are already clocked in for this course.');
  }

  const now = new Date().toISOString();
  const next = {
    id: `time-${crypto.randomUUID().slice(0, 8)}`,
    employee_id: demoUser.id,
    employee_name: demoUser.full_name,
    employee_email: demoUser.email,
    course_id: courseId,
    clock_in_at: now,
    clock_out_at: '',
    clock_in_note: note,
    clock_out_note: '',
    clock_in_latitude: location?.latitude ?? null,
    clock_in_longitude: location?.longitude ?? null,
    clock_out_latitude: null,
    clock_out_longitude: null,
    approved_at: '',
    approved_by_employee_id: '',
    approved_by_name: '',
    approved_by_email: '',
    approval_note: '',
    updated_at: now,
    created_at: now,
    worked_hours: 0
  };
  writeDemoTimeEntries([next, ...entries]);
  return mapTimeEntryRecord(next);
}

export async function clockOutTimeEntry(courseId, note = '', location = null) {
  if (await isApiReachable()) {
    const data = await apiFetch('/time-entries/clock-out', {
      method: 'POST',
      body: JSON.stringify({ courseId, note, location })
    });
    return mapTimeEntryRecord(data);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const entries = readDemoTimeEntries();
  const activeIndex = entries.findIndex((entry) => entry.course_id === courseId && entry.employee_id === demoUser.id && !entry.clock_out_at);
  if (activeIndex < 0) {
    throw new Error('No active clock-in was found for this course.');
  }

  const clockOutAt = new Date().toISOString();
  const updated = {
    ...entries[activeIndex],
    clock_out_at: clockOutAt,
    clock_out_note: note,
    clock_out_latitude: location?.latitude ?? null,
    clock_out_longitude: location?.longitude ?? null,
    updated_at: clockOutAt,
    worked_hours: Number((((new Date(clockOutAt).getTime() - new Date(entries[activeIndex].clock_in_at).getTime()) / 3600000)).toFixed(2))
  };
  const nextEntries = [...entries];
  nextEntries[activeIndex] = updated;
  writeDemoTimeEntries(nextEntries);
  return mapTimeEntryRecord(updated);
}

export async function updateTimeEntry(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch(`/time-entries/${payload.entryId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        courseId: payload.courseId,
        clockInAt: payload.clockInAt,
        clockOutAt: payload.clockOutAt,
        clockInNote: payload.clockInNote,
        clockOutNote: payload.clockOutNote
      })
    });
    return mapTimeEntryRecord(data);
  }

  if (!isDemoModeEnabled()) throw new Error(getApiUnavailableMessage());
  await delay();
  const entries = readDemoTimeEntries();
  const index = entries.findIndex((entry) => entry.id === payload.entryId && entry.course_id === payload.courseId);
  if (index < 0) throw new Error('Time entry not found');
  const next = {
    ...entries[index],
    clock_in_at: payload.clockInAt,
    clock_out_at: payload.clockOutAt || '',
    clock_in_note: payload.clockInNote || '',
    clock_out_note: payload.clockOutNote || '',
    approved_at: '',
    approved_by_employee_id: '',
    approved_by_name: '',
    approved_by_email: '',
    approval_note: '',
    updated_at: new Date().toISOString(),
    worked_hours: payload.clockOutAt ? Number((((new Date(payload.clockOutAt).getTime() - new Date(payload.clockInAt).getTime()) / 3600000)).toFixed(2)) : 0
  };
  const nextEntries = [...entries];
  nextEntries[index] = next;
  writeDemoTimeEntries(nextEntries);
  return mapTimeEntryRecord(next);
}

export async function approveTimeEntry(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch(`/time-entries/${payload.entryId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ courseId: payload.courseId, approvalNote: payload.approvalNote })
    });
    return mapTimeEntryRecord(data);
  }

  if (!isDemoModeEnabled()) throw new Error(getApiUnavailableMessage());
  await delay();
  const entries = readDemoTimeEntries();
  const index = entries.findIndex((entry) => entry.id === payload.entryId && entry.course_id === payload.courseId);
  if (index < 0) throw new Error('Time entry not found');
  const now = new Date().toISOString();
  const next = {
    ...entries[index],
    approved_at: now,
    approved_by_employee_id: demoUser.id,
    approved_by_name: demoUser.full_name,
    approved_by_email: demoUser.email,
    approval_note: payload.approvalNote || '',
    updated_at: now
  };
  const nextEntries = [...entries];
  nextEntries[index] = next;
  writeDemoTimeEntries(nextEntries);
  return mapTimeEntryRecord(next);
}

function mapEmployeeRecord(item) {
  return {
    id: item.id,
    company_id: item.company_id || item.companyId || '',
    company_role: item.company_role || item.companyRole || '',
    email: item.email,
    full_name: item.full_name || item.fullName,
    created_at: item.created_at,
    must_change_password: item.must_change_password,
    account_status: item.account_status || item.accountStatus || (item.must_change_password ? 'password_change_required' : 'active'),
    role: item.role,
    course_id: item.course_id || item.courseId,
    hourly_rate: item.hourly_rate ?? item.hourlyRate ?? '',
    profile_image_url: item.profile_image_url || item.profileImageUrl || '',
    phone: item.phone || '',
    address_line_1: item.address_line_1 || item.addressLine1 || '',
    address_line_2: item.address_line_2 || item.addressLine2 || '',
    city: item.city || '',
    state: item.state || '',
    postal_code: item.postal_code || item.postalCode || '',
    memberships: item.memberships || []
  };
}

export async function listEmployees(courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/employees?${params.toString()}`);
    return data.map(mapEmployeeRecord);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return demoMemberships.map((membership, index) => ({
    id: `employee-${index + 1}`,
    email: index === 0 ? 'demo@turfop.local' : `employee${index + 1}@turfop.local`,
    full_name: membership.superintendent_name,
    created_at: new Date().toISOString(),
    must_change_password: false,
    role: membership.role,
    course_id: membership.course_id,
    hourly_rate: [42, 38, 41][index] || 35,
    profile_image_url: ''
  }));
}

export async function listEmployeeDirectory(courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/employees/directory?${params.toString()}`);
    return data.map(mapEmployeeRecord);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return (await listEmployees(courseId)).filter((employee) => employee.course_id === courseId);
}

export async function listCompanyEmployeeDirectory(courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/employees/company-directory?${params.toString()}`);
    return data.map(mapEmployeeRecord);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return listEmployees(courseId);
}

export async function saveMembership(payload) {
  if (await isApiReachable()) {
    return apiFetch('/employees/memberships', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    id: `membership-${crypto.randomUUID().slice(0, 8)}`,
    employee_id: payload.employeeId,
    course_id: payload.courseId,
    role: payload.role,
    created_at: new Date().toISOString()
  };
}

export async function deleteMembership(employeeId, courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    return apiFetch(`/employees/${employeeId}/memberships/${courseId}${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'DELETE'
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    ok: true,
    membership: {
      employee_id: employeeId,
      course_id: courseId
    }
  };
}

export async function listAuditLogs(courseId, options = {}, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({
      courseId,
      limit: String(options.limit || 10),
      offset: String(options.offset || 0)
    });
    if (options.action) {
      params.set('action', options.action);
    }
    if (tenantId) {
      params.set('tenantId', tenantId);
    }

    return apiFetch(`/audit-logs?${params.toString()}`);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    items: [
      {
        id: `audit-${crypto.randomUUID().slice(0, 8)}`,
        action: 'membership.upsert',
        detail: { role: 'admin' },
        created_at: new Date().toISOString(),
        actor_name: 'Demo Superintendent',
        actor_email: 'demo@turfop.local',
        target_name: 'Dana Holt',
        target_email: 'dana@example.com'
      }
    ],
    total: 1,
    limit: options.limit || 10,
    offset: options.offset || 0
  };
}

export async function createEmployee(payload) {
  if (await isApiReachable()) {
    return apiFetch('/employees', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const inviteToken = createRandomId().replace(/-/g, '');
  return {
    employee: {
      id: `employee-${createRandomId().replace(/-/g, '').slice(0, 8)}`,
      email: payload.email,
      full_name: payload.fullName,
      hourly_rate: payload.hourlyRate ?? '',
      profile_image_url: payload.profileImage?.dataUrl || payload.profileImage?.url || '',
      created_at: new Date().toISOString()
    },
    membership: {
      id: `membership-${createRandomId().replace(/-/g, '').slice(0, 8)}`,
      course_id: payload.courseId,
      role: payload.role,
      created_at: new Date().toISOString()
    },
    inviteToken,
    inviteUrl: `/invite?token=${inviteToken}&courseId=${payload.courseId}`,
    expiresInHours: 72
  };
}

export async function getEmployeeProfile(employeeId, courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    const data = await apiFetch(`/employees/${employeeId}?${params.toString()}`);
    return mapEmployeeRecord(data);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return mapEmployeeRecord({
    id: employeeId,
    email: 'employee@example.com',
    full_name: 'Employee Profile',
    hourly_rate: 40,
    course_id: courseId,
    created_at: new Date().toISOString(),
    phone: '555-444-1212',
    address_line_1: '100 Golf Club Dr',
    city: 'Scottsdale',
    state: 'AZ',
    postal_code: '85251',
    memberships: demoMemberships
  });
}

export async function updateEmployeeProfile(payload) {
  if (await isApiReachable()) {
    const data = await apiFetch(`/employees/${payload.employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        courseId: payload.courseId,
        email: payload.email,
        fullName: payload.fullName,
        hourlyRate: payload.hourlyRate,
        phone: payload.phone,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        state: payload.state,
        postalCode: payload.postalCode,
        profileImage: payload.profileImage
      })
    });
    return mapEmployeeRecord(data);
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return mapEmployeeRecord({
    id: payload.employeeId,
    email: payload.email,
    full_name: payload.fullName,
    hourly_rate: payload.hourlyRate,
    phone: payload.phone || '',
    address_line_1: payload.addressLine1 || '',
    address_line_2: payload.addressLine2 || '',
    city: payload.city || '',
    state: payload.state || '',
    postal_code: payload.postalCode || '',
    profile_image_url: payload.profileImage?.dataUrl || payload.profileImage?.url || '',
    course_id: payload.courseId,
    created_at: new Date().toISOString()
  });
}

export async function deleteEmployee(employeeId, courseId, tenantId) {
  if (await isApiReachable()) {
    const params = new URLSearchParams({ courseId });
    if (tenantId) params.set('tenantId', tenantId);
    return apiFetch(`/employees/${employeeId}?${params.toString()}`, {
      method: 'DELETE'
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  return {
    ok: true,
    employee: {
      id: employeeId,
      course_id: courseId
    }
  };
}

export async function regenerateInvite(payload) {
  if (await isApiReachable()) {
    return apiFetch(`/employees/${payload.employeeId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ courseId: payload.courseId })
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const inviteToken = createRandomId().replace(/-/g, '');
  return {
    inviteToken,
    inviteUrl: `/invite?token=${inviteToken}&courseId=${payload.courseId}`,
    expiresInHours: 72
  };
}

export async function requestPasswordReset(payload) {
  if (await isApiReachable()) {
    return apiFetch('/auth/invitations/request-reset', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  if (!isDemoModeEnabled()) {
    throw new Error(getApiUnavailableMessage());
  }

  await delay();
  const inviteToken = createRandomId().replace(/-/g, '');
  return {
    ok: true,
    message: 'If an account matches that email, password reset instructions have been prepared.',
    inviteToken,
    inviteUrl: `/invite?token=${inviteToken}&courseId=${payload.courseId || demoMemberships[0].course_id}`,
    expiresInHours: 72
  };
}

export async function getCourseStats(courseId) {
  await delay(50);
  return summaryStatsByCourse[courseId] || [];
}

function getQueueEndpoint(bucket, entityId) {
  if (bucket === 'workOrders') {
    return entityId ? `/work-orders/${entityId}` : '/work-orders';
  }

  if (bucket === 'equipment') {
    return entityId ? `/equipment/${entityId}` : '/equipment';
  }

  throw new Error(`Unsupported offline bucket: ${bucket}`);
}

function getQueueMethod(operation) {
  if (operation === 'create') return 'POST';
  if (operation === 'update') return 'PATCH';
  if (operation === 'delete') return 'DELETE';
  throw new Error(`Unsupported queue operation: ${operation}`);
}

export function getOfflineSyncStatus() {
  const queue = readOfflineQueue();
  return {
    queuedCount: queue.length,
    maxQueuedCount: maxOfflineQueueItems,
    conflictCount: queue.filter((item) => item.lastError).length,
    isOfflineReady: true,
    lastQueuedAt: queue.length ? queue[queue.length - 1].queuedAt : '',
    items: queue
  };
}

export function removeOfflineQueueItem(id) {
  removeQueuedMutation(id);
  return getOfflineSyncStatus();
}

export function removeOfflineQueueItemsForEntity(bucket, entityId) {
  writeOfflineQueue(readOfflineQueue().filter((item) => !(item.bucket === bucket && item.entityId === entityId)));
  return getOfflineSyncStatus();
}

function classifyConflictType(status, message = '') {
  if (status === 404) return 'missing_on_server';
  if (status === 403) return 'access_denied';
  if (status === 401) return 'auth_required';
  if (status === 409 && String(message).toLowerCase().includes('updated by someone else')) return 'stale_server_version';
  if (status === 409) return 'duplicate_or_conflict';
  return 'sync_error';
}

export async function flushOfflineQueue() {
  if (!(await isApiReachable())) {
    return { synced: 0, remaining: getQueuedCount(), online: false, failed: 0 };
  }

  const queue = readOfflineQueue();
  const idMap = new Map();
  let synced = 0;
  let failedItem = null;
  let failureMessage = '';

  for (const item of queue) {
    try {
      const resolvedId = idMap.get(item.entityId) || item.entityId;
      const endpoint = getQueueEndpoint(item.bucket, item.operation === 'create' ? '' : resolvedId);
      const method = getQueueMethod(item.operation);
      const payload = item.record || {};

      let response = null;
      if (method === 'DELETE') {
        await apiFetch(endpoint, { method });
      } else {
        response = await apiFetch(endpoint, {
          method,
          body: JSON.stringify(payload)
        });
      }

      if (item.operation === 'create' && response?.id) {
        idMap.set(item.entityId, response.id);
      }

      synced += 1;
      removeQueuedMutation(item.id);
    } catch (error) {
      const conflictType = classifyConflictType(error.status, error.message);
      updateQueuedMutation(item.id, (current) => ({
        ...current,
        lastError: error.message || 'A queued update failed to sync.',
        failedAt: new Date().toISOString(),
        conflictType,
        conflictStatus: error.status || null
      }));
      failedItem = {
        ...item,
        lastError: error.message || 'A queued update failed to sync.',
        failedAt: new Date().toISOString(),
        conflictType,
        conflictStatus: error.status || null
      };
      failureMessage = error.message || 'A queued update failed to sync.';
      break;
    }
  }

  return {
    synced,
    remaining: getQueuedCount(),
    online: true,
    failed: failedItem ? 1 : 0,
    failedItem,
    failureMessage
  };
}

export function getGolfOpsSettings() {
  return readJsonStorageWithLegacy(golfOpsSettingsKey, legacyGolfOpsSettingsKey, {
    enabled: false,
    clubName: '',
    facilityCode: '',
    exportMode: 'csv',
    endpoint: '',
    notes: ''
  });
}

export function saveGolfOpsSettings(settings) {
  writeJsonStorage(golfOpsSettingsKey, settings);
  return settings;
}

export function buildGolfOpsExport({ course, workOrders = [], equipment = [] }) {
  return {
    generatedAt: new Date().toISOString(),
    source: 'TurfOp',
    course: course
      ? {
          id: course.id,
          name: course.name,
          region: course.region
        }
      : null,
    workOrders: workOrders.map((order) => ({
      id: order.id,
      title: order.title,
      status: order.status,
      assignee: order.assignee,
      technicianName: order.technicianName,
      completedAt: order.completedAt || null,
      completedWorkNotes: order.completedWorkNotes || '',
      imageUrls: order.imageUrls || []
    })),
    equipment: equipment.map((machine) => ({
      id: machine.id,
      name: machine.name,
      assignedArea: machine.assignedArea || '',
      status: machine.status,
      hours: machine.hours,
      detail: machine.detail,
      imageUrls: machine.imageUrls || []
    }))
  };
}
