import test from 'node:test';
import assert from 'node:assert/strict';
import { canWrite, isAdmin } from './permissions.js';
import { validateMembershipInput, validateRegistrationInput, validateCourseRoleInput } from './validation.js';
// facility-native name for membership validation
import { validateFacilityRoleInput } from './validation.js';

test('canWrite allows admin and read_write only', () => {
  assert.equal(canWrite('admin'), true);
  assert.equal(canWrite('read_write'), true);
  assert.equal(canWrite('read_only'), false);
  assert.equal(canWrite(null), false);
});

test('isAdmin only allows admin', () => {
  assert.equal(isAdmin('admin'), true);
  assert.equal(isAdmin('read_write'), false);
  assert.equal(isAdmin('read_only'), false);
});

test('validateCourseRoleInput accepts valid ids and roles', () => {
  const result = validateCourseRoleInput({
    courseId: '6689c65a-7736-46af-b7f0-50008020be06',
    role: 'admin'
  });

  assert.equal(result, null);
});

test('validateMembershipInput accepts valid ids and roles', () => {
  const result = validateMembershipInput({
    employeeId: 'f00b5999-86b3-40e0-918e-a6177456b78d',
    facilityId: '6689c65a-7736-46af-b7f0-50008020be06',
    role: 'admin'
  });

  assert.equal(result, null);
});

test('validateMembershipInput rejects invalid input', () => {
  assert.equal(
    validateMembershipInput({ employeeId: 'bad', courseId: '6689c65a-7736-46af-b7f0-50008020be06', role: 'admin' }),
    'Valid employeeId is required'
  );
  assert.equal(
    validateMembershipInput({ employeeId: 'f00b5999-86b3-40e0-918e-a6177456b78d', facilityId: 'bad', role: 'admin' }),
    'Valid facilityId is required'
  );
  assert.equal(
    validateMembershipInput({ employeeId: 'f00b5999-86b3-40e0-918e-a6177456b78d', facilityId: '6689c65a-7736-46af-b7f0-50008020be06', role: 'owner' }),
    'Role must be one of admin, read_write, or read_only'
  );
});

test('validateRegistrationInput rejects weak registration data', () => {
  assert.equal(
    validateRegistrationInput({ email: 'nope', fullName: 'B', password: '123' }),
    'Valid email is required'
  );
  assert.equal(
    validateRegistrationInput({ email: 'test@example.com', fullName: 'B', password: '12345678' }),
    'Full name must be at least 2 characters'
  );
  assert.equal(
    validateRegistrationInput({ email: 'test@example.com', fullName: 'Brandon', password: '123' }),
    'Password must be at least 8 characters'
  );
});
