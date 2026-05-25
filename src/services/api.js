import { appConfig } from "@/config/appConfig";

const TOKEN_KEY = "turfop.authToken";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, token = getStoredToken() } = {}) {
  const response = await fetch(`${appConfig.backend.apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function asFacilityId(value) {
  return value || "";
}

function withFacilityId(payload = {}) {
  const facilityId = payload.facilityId || payload.courseId || payload.course_id || null;
  const { courseId, course_id, ...rest } = payload;
  return {
    ...rest,
    facilityId,
  };
}

export const api = {
  async login({ email, password }) {
    const payload = await request("/auth/login", { method: "POST", body: { email, password }, token: null });
    storeToken(payload.token);
    return payload;
  },

  async acceptInvite({ token, password }) {
    return request("/auth/invitations/accept", {
      method: "POST",
      body: { token: token?.trim(), password },
      token: null,
    });
  },

  async requestPasswordReset({ email, courseId }) {
    return request("/auth/invitations/request-reset", {
      method: "POST",
      body: { email, courseId: courseId || null },
      token: null,
    });
  },

  async me() {
    return request("/auth/me");
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearStoredToken();
    }
  },

  async updateProfile(payload) {
    return request("/auth/profile", { method: "PATCH", body: payload });
  },

  async facilities() {
    const facilities = await request("/facilities");
    // Normalize shape so the UI can consistently use facility_id / facility_name
    return (facilities || []).map((f) => ({
      ...f,
      facility_id: f.facility_id || f.id,
      facility_name: f.facility_name || f.name,
    }));
  },

  async courses() {
    const facilities = await request("/facilities");
    // Backward-compatibility for course-scoped UI while backend pivots to facilities
    return (facilities || []).map((f) => ({
      ...f,
      course_id: f.course_id || f.facility_id || f.id,
      name: f.name || f.facility_name,
    }));
  },

  async companies() {
    return request("/companies");
  },

  async dashboardOverview(courseId) {
    const facilityId = asFacilityId(courseId);
    const queryString = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : "";
    return request(`/dashboard/overview${queryString}`);
  },

  async createCompany(payload) {
    return request("/companies", { method: "POST", body: payload });
  },

  async createCourse(payload) {
    return request("/facilities", { method: "POST", body: payload });
  },

  async equipment(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/equipment?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async createEquipment(payload) {
    return request("/equipment", { method: "POST", body: payload });
  },

  async updateEquipment(equipmentId, payload) {
    return request(`/equipment/${encodeURIComponent(equipmentId)}`, { method: "PATCH", body: payload });
  },

  async inventory(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/parts-inventory?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async companyInventory(courseId) {
    const facilityId = asFacilityId(courseId);
    const queryString = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : "";
    return request(`/parts-inventory/company${queryString}`);
  },

  async createInventoryItem(payload) {
    return request("/parts-inventory", { method: "POST", body: payload });
  },

  async updateInventoryItem(partId, payload) {
    return request(`/parts-inventory/${encodeURIComponent(partId)}`, { method: "PATCH", body: payload });
  },

  async deleteInventoryItem(partId, payload = {}) {
    return request(`/parts-inventory/${encodeURIComponent(partId)}`, { method: "DELETE", body: payload });
  },

  async courseDirectory(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/employees/directory?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async employeeDetails(employeeId, courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/employees/${encodeURIComponent(employeeId)}?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async updateEmployee(employeeId, payload) {
    return request(`/employees/${encodeURIComponent(employeeId)}`, { method: "PATCH", body: payload });
  },

  async workOrders(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/work-orders?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async createWorkOrder(payload) {
    return request("/work-orders", { method: "POST", body: withFacilityId(payload) });
  },

  async updateWorkOrder(workOrderId, payload) {
    return request(`/work-orders/${encodeURIComponent(workOrderId)}`, { method: "PATCH", body: payload });
  },

  async addWorkOrderComment(workOrderId, payload) {
    return request(`/work-orders/${encodeURIComponent(workOrderId)}/comments`, { method: "POST", body: payload });
  },

  async timeEntries(courseId, scope = "mine") {
    const facilityId = asFacilityId(courseId);
    return request(`/time-entries?facilityId=${encodeURIComponent(facilityId)}&scope=${encodeURIComponent(scope)}&limit=20`);
  },

  async timeSummary(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/time-entries/summary?facilityId=${encodeURIComponent(facilityId)}&scope=course`);
  },

  async clockIn(payload) {
    return request("/time-entries/clock-in", { method: "POST", body: withFacilityId(payload) });
  },

  async clockOut(payload) {
    return request("/time-entries/clock-out", { method: "POST", body: withFacilityId(payload) });
  },

  async companyDirectory(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/employees/company-directory?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async inviteEmployee(payload) {
    return request("/employees", { method: "POST", body: withFacilityId(payload) });
  },

  async resendInvite(employeeId, courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/employees/${encodeURIComponent(employeeId)}/resend-invite`, {
      method: "POST",
      body: { facilityId },
    });
  },

  async sendResetPassword(employeeId, courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/employees/${encodeURIComponent(employeeId)}/send-reset-password`, {
      method: "POST",
      body: { facilityId },
    });
  },

  async upsertMembership(payload) {
    return request("/employees/memberships", { method: "POST", body: withFacilityId(payload) });
  },
};
