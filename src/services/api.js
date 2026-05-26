import { appConfig } from "@/config/appConfig";
async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${appConfig.backend.apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
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
  const facilityId = payload.facilityId || payload.facility_id || payload.courseId || payload.course_id || payload.id || null;
  const { facility_id: _facility_id, courseId: _courseId, course_id: _course_id, ...rest } = payload;
  return {
    ...rest,
    facilityId,
  };
}

export const api = {
  async login({ email, password }) {
    return request("/auth/login", { method: "POST", body: { email, password } });
  },

  async acceptInvite({ token, password }) {
    return request("/auth/invitations/accept", {
      method: "POST",
      body: { token: token?.trim(), password },
    });
  },

  async requestPasswordReset({ email, facilityId }) {
    return request("/auth/invitations/request-reset", {
      method: "POST",
      body: { email, facilityId: facilityId || null },
    });
  },

  async me() {
    return request("/auth/me");
  },

  async logout() {
    return request("/auth/logout", { method: "POST" });
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
    // Backward-compatibility for course-scoped UI while backend pivots to facilities.
    // IMPORTANT: prefer facility-native IDs first so downstream validators receive real facility UUIDs.
    return (facilities || []).map((f) => ({
      ...f,
      course_id: f.facility_id || f.id || f.course_id,
      legacy_course_id: f.course_id || null,
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

  async createFacility(payload) {
    return request("/facilities", { method: "POST", body: payload });
  },

  async createCourse(payload) {
    return api.createFacility(payload);
  },

  async equipment(courseId) {
    const facilityId = asFacilityId(courseId);
    return request(`/equipment?facilityId=${encodeURIComponent(facilityId)}`);
  },

  async createEquipment(payload) {
    return request("/equipment", { method: "POST", body: withFacilityId(payload) });
  },

  async updateEquipment(equipmentId, payload) {
    return request(`/equipment/${encodeURIComponent(equipmentId)}`, { method: "PATCH", body: withFacilityId(payload) });
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

  async serviceTemplates(courseId) {
    const facilityId = asFacilityId(courseId);
    const queryString = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : "";
    return request(`/service-templates${queryString}`);
  },

  async createServiceTemplate(payload) {
    return request("/service-templates", { method: "POST", body: withFacilityId(payload) });
  },

  async deleteServiceTemplate(templateId, facilityId) {
    const scopedFacilityId = asFacilityId(facilityId);
    const queryString = scopedFacilityId ? `?facilityId=${encodeURIComponent(scopedFacilityId)}` : "";
    return request(`/service-templates/${encodeURIComponent(templateId)}${queryString}`, { method: "DELETE" });
  },

  async createInventoryItem(payload) {
    return request("/parts-inventory", { method: "POST", body: withFacilityId(payload) });
  },

  async updateInventoryItem(partId, payload) {
    return request(`/parts-inventory/${encodeURIComponent(partId)}`, { method: "PATCH", body: withFacilityId(payload) });
  },

  async deleteInventoryItem(partId, payload = {}) {
    return request(`/parts-inventory/${encodeURIComponent(partId)}`, { method: "DELETE", body: withFacilityId(payload) });
  },

  async facilityDirectory(facilityId) {
    const scopedFacilityId = asFacilityId(facilityId);
    return request(`/employees/directory?facilityId=${encodeURIComponent(scopedFacilityId)}`);
  },

  async courseDirectory(courseId) {
    return api.facilityDirectory(courseId);
  },

  async employeeDetails(employeeId, facilityId) {
    const scopedFacilityId = asFacilityId(facilityId);
    return request(`/employees/${encodeURIComponent(employeeId)}?facilityId=${encodeURIComponent(scopedFacilityId)}`);
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

  async resendInvite(employeeId, facilityId) {
    const scopedFacilityId = asFacilityId(facilityId);
    return request(`/employees/${encodeURIComponent(employeeId)}/resend-invite`, {
      method: "POST",
      body: { facilityId: scopedFacilityId },
    });
  },

  async sendResetPassword(employeeId, facilityId) {
    const scopedFacilityId = asFacilityId(facilityId);
    return request(`/employees/${encodeURIComponent(employeeId)}/send-reset-password`, {
      method: "POST",
      body: { facilityId: scopedFacilityId },
    });
  },

  async upsertMembership(payload) {
    return request("/employees/memberships", { method: "POST", body: withFacilityId(payload) });
  },
};
