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

  async courses() {
    return request("/courses");
  },

  async companies() {
    return request("/companies");
  },

  async dashboardOverview(courseId) {
    const queryString = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
    return request(`/dashboard/overview${queryString}`);
  },

  async createCompany(payload) {
    return request("/companies", { method: "POST", body: payload });
  },

  async createCourse(payload) {
    return request("/courses", { method: "POST", body: payload });
  },

  async equipment(courseId) {
    return request(`/equipment?courseId=${encodeURIComponent(courseId)}`);
  },

  async createEquipment(payload) {
    return request("/equipment", { method: "POST", body: payload });
  },

  async updateEquipment(equipmentId, payload) {
    return request(`/equipment/${encodeURIComponent(equipmentId)}`, { method: "PATCH", body: payload });
  },

  async inventory(courseId) {
    return request(`/parts-inventory?courseId=${encodeURIComponent(courseId)}`);
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
    return request(`/employees/directory?courseId=${encodeURIComponent(courseId)}`);
  },

  async employeeDetails(employeeId, courseId) {
    return request(`/employees/${encodeURIComponent(employeeId)}?courseId=${encodeURIComponent(courseId)}`);
  },

  async updateEmployee(employeeId, payload) {
    return request(`/employees/${encodeURIComponent(employeeId)}`, { method: "PATCH", body: payload });
  },

  async workOrders(courseId) {
    return request(`/work-orders?courseId=${encodeURIComponent(courseId)}`);
  },

  async createWorkOrder(payload) {
    return request("/work-orders", { method: "POST", body: payload });
  },

  async updateWorkOrder(workOrderId, payload) {
    return request(`/work-orders/${encodeURIComponent(workOrderId)}`, { method: "PATCH", body: payload });
  },

  async addWorkOrderComment(workOrderId, payload) {
    return request(`/work-orders/${encodeURIComponent(workOrderId)}/comments`, { method: "POST", body: payload });
  },

  async timeEntries(courseId, scope = "mine") {
    return request(`/time-entries?courseId=${encodeURIComponent(courseId)}&scope=${encodeURIComponent(scope)}&limit=20`);
  },

  async timeSummary(courseId) {
    return request(`/time-entries/summary?courseId=${encodeURIComponent(courseId)}&scope=course`);
  },

  async clockIn(payload) {
    return request("/time-entries/clock-in", { method: "POST", body: payload });
  },

  async clockOut(payload) {
    return request("/time-entries/clock-out", { method: "POST", body: payload });
  },

  async companyDirectory(courseId) {
    return request(`/employees/company-directory?courseId=${encodeURIComponent(courseId)}`);
  },

  async inviteEmployee(payload) {
    return request("/employees", { method: "POST", body: payload });
  },

  async upsertMembership(payload) {
    return request("/employees/memberships", { method: "POST", body: payload });
  },
};
