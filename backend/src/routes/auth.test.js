import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { createToken } from '../lib/auth.js';
import { resetDbTestOverrides, setDbTestOverrides } from '../lib/db.js';

function authHeader(employee = { id: 'employee-1', email: 'test@example.com' }) {
  return `Bearer ${createToken(employee)}`;
}

function makeEmployeeRow(overrides = {}) {
  return {
    id: 'employee-1',
    email: 'test@example.com',
    full_name: 'Test User',
    must_change_password: false,
    profile_image_url: '/uploads/profiles/test.jpg',
    phone: '555-111-2222',
    address_line_1: '100 Golf Club Dr',
    address_line_2: null,
    city: 'Denver',
    state: 'CO',
    postal_code: '80202',
    ...overrides
  };
}

test.afterEach(() => {
  resetDbTestOverrides();
});

test('public registration is disabled by default', async () => {
  const app = createApp();
  const response = await request(app)
    .post('/auth/register')
    .send({ email: 'user@example.com', fullName: 'User Example', password: 'verysecurepass' });

  assert.equal(response.status, 404);
});

test('auth me returns self-service profile fields', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow()] };
      }

      if (text.includes('from facility_memberships')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/auth/me')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.employee.phone, '555-111-2222');
  assert.equal(response.body.employee.address_line_1, '100 Golf Club Dr');
  assert.equal(response.body.employee.city, 'Denver');
});

test('employee can update own profile details', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow()] };
      }

      if (text.includes('update employees') && text.includes('address_line_1')) {
        return {
          rows: [
            makeEmployeeRow({
              email: params[1],
              full_name: params[2],
              phone: params[3],
              address_line_1: params[4],
              address_line_2: params[5],
              city: params[6],
              state: params[7],
              postal_code: params[8],
              profile_image_url: params[9]
            })
          ]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .patch('/auth/profile')
    .set('Authorization', authHeader())
    .send({
      email: 'updated@example.com',
      fullName: 'Updated User',
      phone: '555-333-4444',
      addressLine1: '200 Fairway Ln',
      addressLine2: 'Unit B',
      city: 'Aurora',
      state: 'CO',
      postalCode: '80014',
      profileImage: '/uploads/profiles/test.jpg'
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.employee.email, 'updated@example.com');
  assert.equal(response.body.employee.full_name, 'Updated User');
  assert.equal(response.body.employee.address_line_1, '200 Fairway Ln');
  assert.equal(response.body.employee.postal_code, '80014');
});

test('password reset request returns generic success when email is unknown', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where email = $1')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/auth/invitations/request-reset')
    .send({ email: 'missing@example.com' });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

test('invite acceptance consumes token and clears required password change', async () => {
  const queries = [];
  const client = {
    query: async (text, params = []) => {
      queries.push({ text, params });

      if (text === 'begin' || text === 'commit' || text === 'rollback') {
        return { rows: [] };
      }

      if (text.includes('update invite_tokens') && text.includes('returning it.id')) {
        return {
          rows: [
            {
              id: 'invite-token-1',
              employee_id: 'employee-1',
              course_id: '6689c65a-7736-46af-b7f0-50008020be06',
              email: 'test@example.com'
            }
          ]
        };
      }

      if (text.includes('update employees') && text.includes('must_change_password = false')) {
        return { rows: [] };
      }

      if (text.includes('insert into audit_logs')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
    release: () => {}
  };

  setDbTestOverrides({ connectImpl: async () => client });

  const app = createApp();
  const response = await request(app)
    .post('/auth/invitations/accept')
    .send({ token: 'invite-token-1234567890abcdef', password: 'new-secure-pass' });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(queries.some(({ text }) => text.includes('set used_at = now()')));
  assert.ok(queries.some(({ text }) => text.includes('must_change_password = false')));
  assert.ok(queries.some(({ text }) => text === 'commit'));
});

test('password reset request creates reset token for known employee', async () => {
  const calls = [];
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      calls.push(text);

      if (text.includes('from employees') && text.includes('where email = $1')) {
        return { rows: [{ id: 'employee-1', email: 'test@example.com', full_name: 'Test User' }] };
      }

      if (text.includes('from course_memberships') && text.includes('where employee_id = $1')) {
        return { rows: [{ course_id: '6689c65a-7736-46af-b7f0-50008020be06' }] };
      }

      if (text.includes('insert into invite_tokens')) {
        return { rows: [] };
      }

      if (text.includes('insert into audit_logs')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/auth/invitations/request-reset')
    .send({ email: 'test@example.com' });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.inviteToken);
  assert.ok(calls.some((text) => text.includes('insert into invite_tokens')));
});

test('test environment allows manual preview for reset flows', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where email = $1')) {
        return { rows: [{ id: 'employee-1', email: 'test@example.com', full_name: 'Test User' }] };
      }

      if (text.includes('from course_memberships') && text.includes('where employee_id = $1')) {
        return { rows: [{ course_id: '6689c65a-7736-46af-b7f0-50008020be06' }] };
      }

      if (text.includes('insert into invite_tokens') || text.includes('insert into audit_logs')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/auth/invitations/request-reset')
    .send({ email: 'test@example.com' });

  assert.equal(response.status, 200);
  assert.ok(response.body.inviteToken);
  assert.ok(response.body.inviteUrl);
  assert.equal(response.body.deliveryMode, 'manual-preview');
});
