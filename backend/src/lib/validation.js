const allowedRoles = new Set(['admin', 'read_write', 'read_only']);

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateCourseRoleInput({ courseId, role }) {
  if (!isUuid(courseId)) {
    return 'Valid courseId is required';
  }

  if (!allowedRoles.has(role)) {
    return 'Role must be one of admin, read_write, or read_only';
  }

  return null;
}

export function validateMembershipInput({ employeeId, courseId, role }) {
  if (!isUuid(employeeId)) {
    return 'Valid employeeId is required';
  }

  return validateCourseRoleInput({ courseId, role });
}

export function validateCompanyInput({ name }) {
  if (typeof name !== 'string' || name.trim().length < 2) {
    return 'Business name must be at least 2 characters';
  }

  if (name.trim().length > 160) {
    return 'Business name must be 160 characters or fewer';
  }

  return null;
}

export function validateCourseCreateInput({ companyId, name, region, superintendentName }) {
  if (!isUuid(companyId)) {
    return 'Valid companyId is required';
  }

  if (typeof name !== 'string' || name.trim().length < 2) {
    return 'Course name must be at least 2 characters';
  }

  const fieldErrors = [
    validateOptionalText(region, 'Region', 160),
    validateOptionalText(superintendentName, 'Superintendent name', 160)
  ].filter(Boolean);

  return fieldErrors[0] || null;
}

function validateCourseAreaSettings(courseAreas) {
  if (courseAreas === undefined) {
    return null;
  }

  if (!Array.isArray(courseAreas) || courseAreas.length === 0 || courseAreas.length > 12) {
    return 'Course areas must include between 1 and 12 entries';
  }

  for (const area of courseAreas) {
    if (!area || typeof area !== 'object') {
      return 'Each course area must be an object';
    }

    if (typeof area.name !== 'string' || area.name.trim().length < 2 || area.name.trim().length > 80) {
      return 'Each course area name must be between 2 and 80 characters';
    }

    if (!Number.isInteger(Number(area.trackedCount)) || Number(area.trackedCount) < 0 || Number(area.trackedCount) > 5000) {
      return 'Each course area tracked count must be a whole number between 0 and 5000';
    }

    const noteError = validateOptionalText(area.note, 'Course area note', 160);
    if (noteError) {
      return noteError;
    }
  }

  return null;
}

export function validateCourseSettingsInput({ name, region, superintendentName, courseAreas }) {
  if (typeof name !== 'string' || name.trim().length < 2) {
    return 'Course name must be at least 2 characters';
  }

  const fieldErrors = [
    validateOptionalText(region, 'Region', 160),
    validateOptionalText(superintendentName, 'Superintendent name', 160),
    validateCourseAreaSettings(courseAreas)
  ].filter(Boolean);

  return fieldErrors[0] || null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateEmail(email) {
  return emailPattern.test(normalizeEmail(email));
}

function validateFullName(fullName) {
  return typeof fullName === 'string' && fullName.trim().length >= 2;
}

function validateOptionalText(value, label, maxLength = 255) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return `${label} must be text`;
  }

  if (value.trim().length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer`;
  }

  return null;
}

export function validateRegistrationInput({ email, fullName, password }) {
  if (!validateEmail(email)) {
    return 'Valid email is required';
  }

  if (!validateFullName(fullName)) {
    return 'Full name must be at least 2 characters';
  }

  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }

  return null;
}

export function validateEmployeeInviteInput({ email, fullName, courseId, role, hourlyRate }) {
  if (!validateEmail(email)) {
    return 'Valid email is required';
  }

  if (!validateFullName(fullName)) {
    return 'Full name must be at least 2 characters';
  }

  if (hourlyRate !== undefined && hourlyRate !== null && Number(hourlyRate) < 0) {
    return 'Hourly rate must be zero or greater';
  }

  return validateCourseRoleInput({ courseId, role });
}

export function validateEmployeeProfileInput({ fullName, hourlyRate }) {
  if (!validateFullName(fullName)) {
    return 'Full name must be at least 2 characters';
  }

  if (hourlyRate !== undefined && hourlyRate !== null && Number(hourlyRate) < 0) {
    return 'Hourly rate must be zero or greater';
  }

  return null;
}

export function validateAdminEmployeeProfileInput({ email, fullName, hourlyRate, phone, addressLine1, addressLine2, city, state, postalCode }) {
  if (!validateEmail(email)) {
    return 'Valid email is required';
  }

  if (!validateFullName(fullName)) {
    return 'Full name must be at least 2 characters';
  }

  if (hourlyRate !== undefined && hourlyRate !== null && Number(hourlyRate) < 0) {
    return 'Hourly rate must be zero or greater';
  }

  const fieldErrors = [
    validateOptionalText(phone, 'Phone', 50),
    validateOptionalText(addressLine1, 'Address line 1'),
    validateOptionalText(addressLine2, 'Address line 2'),
    validateOptionalText(city, 'City', 120),
    validateOptionalText(state, 'State', 120),
    validateOptionalText(postalCode, 'Postal code', 32)
  ].filter(Boolean);

  return fieldErrors[0] || null;
}

export function validateSelfProfileInput({ email, fullName, phone, addressLine1, addressLine2, city, state, postalCode }) {
  if (!validateEmail(email)) {
    return 'Valid email is required';
  }

  if (!validateFullName(fullName)) {
    return 'Full name must be at least 2 characters';
  }

  const fieldErrors = [
    validateOptionalText(phone, 'Phone', 50),
    validateOptionalText(addressLine1, 'Address line 1'),
    validateOptionalText(addressLine2, 'Address line 2'),
    validateOptionalText(city, 'City', 120),
    validateOptionalText(state, 'State', 120),
    validateOptionalText(postalCode, 'Postal code', 32)
  ].filter(Boolean);

  return fieldErrors[0] || null;
}

export function validatePasswordResetRequestInput({ email }) {
  if (!validateEmail(email)) {
    return 'Valid email is required';
  }

  return null;
}

function isIsoDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateLocation(location) {
  if (location === undefined || location === null || location === '') {
    return null;
  }

  if (typeof location !== 'object') {
    return 'Location must be an object';
  }

  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    return 'Location latitude must be between -90 and 90';
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    return 'Location longitude must be between -180 and 180';
  }

  return null;
}

export function validateAuditQueryInput({ action, limit, offset }) {
  if (action && !['employee.create', 'employee.invite', 'invite.accept', 'membership.upsert', 'employee.profile.update', 'password.reset.request', 'employee.clock_in', 'employee.clock_out', 'employee.time_edit', 'employee.time_approved'].includes(action)) {
    return 'Unsupported audit action filter';
  }

  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    return 'limit must be an integer between 1 and 100';
  }

  if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
    return 'offset must be a non-negative integer';
  }

  return null;
}

export function validateTimeEntryQueryInput({ courseId, employeeId, scope, limit, startDate, endDate, approvedOnly }) {
  if (!isUuid(courseId)) {
    return 'Valid courseId is required';
  }

  if (employeeId && !isUuid(employeeId)) {
    return 'Valid employeeId is required';
  }

  if (scope && !['mine', 'course'].includes(scope)) {
    return 'scope must be either mine or course';
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return 'limit must be an integer between 1 and 100';
  }

  if (startDate && !isIsoDateTime(startDate)) {
    return 'startDate must be a valid ISO timestamp';
  }

  if (endDate && !isIsoDateTime(endDate)) {
    return 'endDate must be a valid ISO timestamp';
  }

  if (startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
    return 'endDate cannot be earlier than startDate';
  }

  if (approvedOnly !== undefined && typeof approvedOnly !== 'boolean') {
    return 'approvedOnly must be boolean when provided';
  }

  return null;
}

export function validateTimeEntryActionInput({ courseId, note, location }) {
  if (!isUuid(courseId)) {
    return 'Valid courseId is required';
  }

  const noteError = validateOptionalText(note, 'Note', 500);
  if (noteError) return noteError;

  return validateLocation(location);
}

export function validateTimeEntryUpdateInput({ entryId, courseId, clockInAt, clockOutAt, clockInNote, clockOutNote }) {
  if (!isUuid(entryId)) {
    return 'Valid entryId is required';
  }
  if (!isUuid(courseId)) {
    return 'Valid courseId is required';
  }
  if (!isIsoDateTime(clockInAt)) {
    return 'Valid clockInAt is required';
  }
  if (clockOutAt && !isIsoDateTime(clockOutAt)) {
    return 'clockOutAt must be a valid ISO timestamp';
  }
  if (clockOutAt && Date.parse(clockOutAt) < Date.parse(clockInAt)) {
    return 'clockOutAt cannot be earlier than clockInAt';
  }

  return validateOptionalText(clockInNote, 'Clock-in note', 500)
    || validateOptionalText(clockOutNote, 'Clock-out note', 500);
}

export function validateTimeEntryApprovalInput({ entryId, courseId, approvalNote }) {
  if (!isUuid(entryId)) {
    return 'Valid entryId is required';
  }
  if (!isUuid(courseId)) {
    return 'Valid courseId is required';
  }

  return validateOptionalText(approvalNote, 'Approval note', 500);
}
