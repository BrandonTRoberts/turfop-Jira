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
    token_version: 0,
    ...overrides
  };
}

test.afterEach(() => {
  resetDbTestOverrides();
});

test('platform admin can list companies', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'platform_admin' })] };
      }

      if (text.includes('from companies') && text.includes('order by name asc')) {
        return {
          rows: [
            { id: 'company-1', name: 'Augusta Operations', created_at: '2026-05-11T20:00:00.000Z' },
            { id: 'company-2', name: 'Pebble Operations', created_at: '2026-05-11T21:00:00.000Z' }
          ]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/companies')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].name, 'Augusta Operations');
});

test('company super user only sees their own company', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'company_super_user', company_id: 'company-1' })] };
      }

      if (text.includes('from companies') && text.includes('where id = $1')) {
        return {
          rows: [{ id: params[0], name: 'Augusta Operations', created_at: '2026-05-11T20:00:00.000Z' }]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/companies')
    .set('Authorization', authHeader())
;

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].name, 'Augusta Operations');
});

test('platform admin can create a company', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'platform_admin' })] };
      }

      if (text.includes('insert into companies')) {
        return {
          rows: [{ id: 'company-1', name: params[0], created_at: '2026-05-11T20:00:00.000Z' }]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/companies')
    .set('Authorization', authHeader())
    .send({ name: '  Augusta Operations  ' });

  assert.equal(response.status, 201);
  assert.equal(response.body.name, 'Augusta Operations');
});

test('company super user cannot create a facility (platform-admin only)', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'company_super_user', company_id: '6689c65a-7736-46af-b7f0-50008020be06' })] };
      }

      if (text.includes('from companies') && text.includes('where id = $1')) {
        return { rows: [{ id: params[0], name: 'Augusta Operations' }] };
      }

      if (text.includes('insert into facilities')) {
        return {
          rows: [{
            id: 'course-1',
            company_id: params[0],
            name: params[1],
            region: params[2],
            superintendent_name: params[3],
            course_areas_config: JSON.parse(params[4]),
            created_at: '2026-05-11T20:00:00.000Z'
          }]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/facilities')
    .set('Authorization', authHeader())
    .send({
      companyId: '6689c65a-7736-46af-b7f0-50008020be06',
      name: '  Augusta National  ',
      region: '  Georgia  ',
      superintendentName: '  Riley Grounds  ',
      courseAreas: [
        { name: 'Greens', trackedCount: 18, note: 'Daily cut and moisture logs' },
        { name: 'Tees', trackedCount: 36, note: 'Rotation and divot repair' }
      ]
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Only Platform Admins can add new facilities or businesses. Contact support or your account manager to expand your account.');
});

test('company super user cannot create a facility for another company', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'company_super_user', company_id: 'company-1' })] };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/facilities')
    .set('Authorization', authHeader())
    .send({
      companyId: '6689c65a-7736-46af-b7f0-50008020be06',
      name: 'Augusta National',
      region: 'Georgia',
      superintendentName: 'Riley Grounds'
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Only Platform Admins can add new facilities or businesses. Contact support or your account manager to expand your account.');
});

test('facility admin can update facility settings and area tracking', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow()] };
      }

      if (text.includes('select role') && text.includes('from facility_memberships')) {
        return { rows: [{ role: 'admin' }] };
      }

      if (text.includes('update facilities')) {
        return {
          rows: [{
            id: params[0],
            company_id: 'company-1',
            name: params[1],
            region: params[2],
            superintendent_name: params[3],
            course_areas_config: JSON.parse(params[4]),
            created_at: '2026-05-11T20:00:00.000Z'
          }]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .patch('/facilities/course-1')
    .set('Authorization', authHeader())
    .send({
      name: '  Augusta National  ',
      region: '  Georgia  ',
      superintendentName: '  Riley Grounds  ',
      courseAreas: [
        { name: 'Greens', trackedCount: 19, note: 'Double-cut on tournament prep days' },
        { name: 'Practice areas', trackedCount: 4, note: 'Range tee wear and divot recovery' }
      ]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.name, 'Augusta National');
  assert.equal(response.body.region, 'Georgia');
  assert.equal(response.body.superintendent_name, 'Riley Grounds');
  assert.equal(response.body.course_areas_config[0].trackedCount, 19);
  assert.equal(response.body.course_areas_config[1].name, 'Practice areas');
});

test('dashboard overview rejects inaccessible facility requests', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow()] };
      }

      if (text.includes('select role') && text.includes('from facility_memberships')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/dashboard/overview?facilityId=6689c65a-7736-46af-b7f0-50008020be06')
    .set('Authorization', authHeader());

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'No access to this facility');
});

test('dashboard overview returns scoped summary and rollups for company super users', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'company_super_user', company_id: 'company-1' })] };
      }

      if (text.includes('select id') && text.includes('from facilities') && text.includes('where company_id = $1')) {
        assert.deepEqual(params, ['company-1']);
        return {
          rows: [
            { id: '6689c65a-7736-46af-b7f0-50008020be06' },
            { id: '7c6c1941-b25f-4f0f-b6c9-bb8991170c2f' }
          ]
        };
      }

      if (text.includes('with scoped_facilities as')) {
        assert.deepEqual(params, [[
          '6689c65a-7736-46af-b7f0-50008020be06',
          '7c6c1941-b25f-4f0f-b6c9-bb8991170c2f'
        ]]);

        return {
          rows: [{
            open_work_orders: '4',
            overdue_work_orders: '1',
            completed_this_week: '6',
            mttr_hours: '3.25',
            clocked_in_now: '2',
            total_hours_this_week: '73.5',
            overtime_hours_this_week: '5.5',
            pending_approvals: '3',
            total_skus: '40',
            low_stock_items: '5',
            out_of_stock_items: '1',
            inventory_value: '12450.75',
            total_employees: '11',
            active_courses: '2',
            equipment_needing_attention: '3'
          }]
        };
      }

      if (text.includes('count(wo.id) filter')) {
        return {
          rows: [
            { facility_id: '6689c65a-7736-46af-b7f0-50008020be06', name: 'Augusta National', open_work_orders: 3, completed_this_week: 4 },
            { facility_id: '7c6c1941-b25f-4f0f-b6c9-bb8991170c2f', name: 'Pebble Beach', open_work_orders: 1, completed_this_week: 2 }
          ]
        };
      }

      if (text.includes('sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0)')) {
        return {
          rows: [
            { facility_id: '6689c65a-7736-46af-b7f0-50008020be06', name: 'Augusta National', total_hours: '41.5' },
            { facility_id: '7c6c1941-b25f-4f0f-b6c9-bb8991170c2f', name: 'Pebble Beach', total_hours: '32.0' }
          ]
        };
      }

      if (text.includes('from parts_inventory pi') && text.includes('low_stock_items')) {
        return {
          rows: [
            { facility_id: '6689c65a-7736-46af-b7f0-50008020be06', name: 'Augusta National', low_stock_items: 3 },
            { facility_id: '7c6c1941-b25f-4f0f-b6c9-bb8991170c2f', name: 'Pebble Beach', low_stock_items: 2 }
          ]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/dashboard/overview')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.summary.openWorkOrders, 4);
  assert.equal(response.body.summary.mttrHours, 3.25);
  assert.equal(response.body.summary.inventoryValue, 12450.75);
  assert.equal(response.body.rollups.workOrdersByFacility.length, 2);
  assert.equal(response.body.rollups.hoursByFacility[0].total_hours, '41.5');
  assert.equal(response.body.rollups.lowStockByFacility[1].low_stock_items, 2);
});

test('dashboard overview allows company super user to scope to a single course', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) {
        return { rows: [makeEmployeeRow({ company_role: 'company_super_user', company_id: 'company-1' })] };
      }

      if (text.includes('select id') && text.includes('from facilities') && text.includes('where id = $1 and company_id = $2')) {
        assert.deepEqual(params, ['6689c65a-7736-46af-b7f0-50008020be06', 'company-1']);
        return { rows: [{ id: params[0] }] };
      }

      if (text.includes('select role') && text.includes('from facility_memberships')) {
        throw new Error('Membership lookup should not run for company super user scoped requests');
      }

      if (text.includes('with scoped_facilities as')) {
        assert.deepEqual(params, [['6689c65a-7736-46af-b7f0-50008020be06']]);
        return {
          rows: [{
            open_work_orders: '2',
            overdue_work_orders: '1',
            completed_this_week: '3',
            mttr_hours: '2.5',
            clocked_in_now: '1',
            total_hours_this_week: '25.0',
            overtime_hours_this_week: '1.0',
            pending_approvals: '1',
            total_skus: '12',
            low_stock_items: '2',
            out_of_stock_items: '0',
            inventory_value: '5250.00',
            total_employees: '4',
            active_facilities: '1',
            equipment_needing_attention: '1'
          }]
        };
      }

      if (text.includes('count(wo.id) filter')) {
        return {
          rows: [
            { facility_id: '6689c65a-7736-46af-b7f0-50008020be06', name: 'Augusta National', open_work_orders: 2, completed_this_week: 3 }
          ]
        };
      }

      if (text.includes('sum(extract(epoch from (coalesce(te.clock_out_at, now()) - te.clock_in_at)) / 3600.0)')) {
        return {
          rows: [
            { facility_id: '6689c65a-7736-46af-b7f0-50008020be06', name: 'Augusta National', total_hours: '25.0' }
          ]
        };
      }

      if (text.includes('from parts_inventory pi') && text.includes('low_stock_items')) {
        return {
          rows: [
            { facility_id: '6689c65a-7736-46af-b7f0-50008020be06', name: 'Augusta National', low_stock_items: 2 }
          ]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/dashboard/overview?facilityId=6689c65a-7736-46af-b7f0-50008020be06')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.summary.openWorkOrders, 2);
  assert.equal(response.body.summary.activeFacilities, 1);
  assert.equal(response.body.rollups.workOrdersByFacility.length, 1);
});
