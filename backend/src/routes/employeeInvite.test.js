import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { createToken } from '../lib/auth.js';
import { resetDbTestOverrides, setDbTestOverrides } from '../lib/db.js';
import { resetEmailDeliveryTestOverride, setEmailDeliveryTestOverride } from '../lib/resetDelivery.js';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const COURSE_ID = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE_ID = '44444444-4444-4444-8444-444444444444';

function authHeader() {
  return `Bearer ${createToken({ id: ADMIN_ID, email: 'admin@example.com', token_version: 0 })}`;
}

function createInviteHarness({ failDelivery = false } = {}) {
  const clientQueries = [];
  const deliveries = [];

  const client = {
    query: async (text, params = []) => {
      clientQueries.push({ text, params });

      if (text === 'begin' || text === 'commit' || text === 'rollback') {
        return { rows: [] };
      }

      if (text.includes('from courses') && text.includes('where id = $1')) {
        return { rows: [{ id: COURSE_ID, company_id: COMPANY_ID, name: 'Test Course' }] };
      }

      if (text.includes('insert into employees')) {
        return {
          rows: [{
            id: EMPLOYEE_ID,
            company_id: COMPANY_ID,
            email: params[1],
            full_name: params[2],
            hourly_rate: params[3],
            profile_image_url: params[4],
            created_at: '2026-05-22T00:00:00.000Z',
            must_change_password: true,
            password_hash: null
          }]
        };
      }

      if (text.includes('insert into course_memberships')) {
        return {
          rows: [{
            id: '55555555-5555-4555-8555-555555555555',
            employee_id: EMPLOYEE_ID,
            course_id: COURSE_ID,
            role: params[2],
            created_at: '2026-05-22T00:00:00.000Z'
          }]
        };
      }

      if (text.includes('insert into invite_tokens') || text.includes('insert into audit_logs')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected client query: ${text}`);
    },
    release: () => {}
  };

  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return {
          rows: [{
            id: ADMIN_ID,
            company_id: COMPANY_ID,
            company_role: null,
            email: 'admin@example.com',
            full_name: 'Admin User',
            must_change_password: false,
            token_version: 0
          }]
        };
      }

      if (text.includes('from course_memberships') && text.includes('where employee_id = $1 and course_id = $2')) {
        return { rows: [{ role: 'admin' }] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
    connectImpl: async () => client
  });

  setEmailDeliveryTestOverride(async (payload) => {
    deliveries.push(payload);
    if (failDelivery) {
      throw new Error('SMTP delivery failed');
    }

    return { delivered: true, mode: 'test-smtp', actionUrl: payload.actionUrl };
  });

  return { clientQueries, deliveries };
}

test.afterEach(() => {
  resetDbTestOverrides();
  resetEmailDeliveryTestOverride();
});

test('inviting an employee creates the employee, stores an invite token, and sends a setup link', async () => {
  const { clientQueries, deliveries } = createInviteHarness();
  const app = createApp();

  const response = await request(app)
    .post('/employees')
    .set('Authorization', authHeader())
    .send({
      courseId: COURSE_ID,
      email: 'New.User@Example.COM',
      fullName: 'New User',
      role: 'read_write',
      hourlyRate: 22.5
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.employee.email, 'new.user@example.com');
  assert.equal(response.body.employee.account_status, 'invited_pending_setup');
  assert.equal(response.body.deliveryMode, 'test-smtp');
  assert.equal(response.body.membership.employee_id, EMPLOYEE_ID);
  assert.equal(response.body.membership.course_id, COURSE_ID);

  assert.ok(clientQueries.some(({ text }) => text.includes('insert into employees')));
  assert.ok(clientQueries.some(({ text }) => text.includes('insert into course_memberships')));
  assert.ok(clientQueries.some(({ text }) => text.includes('insert into invite_tokens')));
  assert.ok(clientQueries.some(({ text }) => text === 'commit'));

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, 'new.user@example.com');
  assert.equal(deliveries[0].purpose, 'invite');
  assert.match(deliveries[0].actionUrl, /^http:\/\/localhost:5173\/signin\?token=/);
  assert.match(deliveries[0].actionUrl, new RegExp(`courseId=${COURSE_ID}`));
});

test('inviting an employee rolls back the database work when setup email delivery fails', async () => {
  const { clientQueries } = createInviteHarness({ failDelivery: true });
  const app = createApp();

  const response = await request(app)
    .post('/employees')
    .set('Authorization', authHeader())
    .send({
      courseId: COURSE_ID,
      email: 'delivery.failure@example.com',
      fullName: 'Delivery Failure',
      role: 'read_only'
    });

  assert.equal(response.status, 500);
  assert.ok(clientQueries.some(({ text }) => text.includes('insert into employees')));
  assert.ok(clientQueries.some(({ text }) => text.includes('insert into invite_tokens')));
  assert.ok(clientQueries.some(({ text }) => text === 'rollback'));
  assert.equal(clientQueries.some(({ text }) => text === 'commit'), false);
});
