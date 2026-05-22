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
    ...overrides
  };
}

function makeClient(queryImpl) {
  return {
    query: queryImpl,
    release() {}
  };
}

test.afterEach(() => {
  resetDbTestOverrides();
});

test('read_only cannot create work orders', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_only' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/work-orders')
    .set('Authorization', authHeader())
    .send({ courseId: '6689c65a-7736-46af-b7f0-50008020be06', title: 'Test', detail: 'Detail', status: 'Open', assignee: 'Crew' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Write access denied for this course');
});

test('read_write can create work orders', async () => {
  const queryImpl = async (text) => {
    if (text.includes('from employees')) return { rows: [makeEmployeeRow()] };
    if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
    throw new Error(`Unexpected query: ${text}`);
  };

  const clientQueryImpl = async (text) => {
    if (text === 'begin' || text === 'commit' || text === 'rollback') return { rows: [] };
    if (text.includes('from employees') && text.includes('hourly_rate')) return { rows: [{ id: 'employee-2', full_name: 'Tech', hourly_rate: '40' }] };
    if (text.includes('insert into work_orders')) {
      return { rows: [{ id: 'wo-1', course_id: 'course-1', title: 'Test', detail: 'Detail', status: 'Completed', assignee: 'Crew', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_hours: '2.5', labor_rate: '40', labor_cost: '100', parts_cost: '0', total_cost: '100', completed_work_notes: 'Finished the repair and tested the unit.', completed_at: new Date().toISOString() }] };
    }
    if (text.includes('insert into work_order_activity')) return { rows: [] };
    if (text.includes('set parts_cost = $2')) {
      return { rows: [{ id: 'wo-1', course_id: 'course-1', title: 'Test', detail: 'Detail', status: 'Completed', assignee: 'Crew', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_hours: '2.5', labor_rate: '40', labor_cost: '100', parts_cost: '0', total_cost: '100', completed_work_notes: 'Finished the repair and tested the unit.', completed_at: new Date().toISOString() }] };
    }
    if (text.includes('from work_order_parts_usage')) return { rows: [] };
    if (text.includes('from work_order_activity')) {
      return { rows: [{ id: 'activity-1', action: 'created', from_status: null, to_status: 'Completed', detail: { title: 'Test' }, created_at: new Date().toISOString(), actor_employee_id: 'employee-1', actor_name: 'Test User', actor_email: 'test@example.com' }] };
    }
    throw new Error(`Unexpected client query: ${text}`);
  };

  setDbTestOverrides({
    queryImpl,
    connectImpl: async () => makeClient(clientQueryImpl)
  });

  const app = createApp();
  const response = await request(app)
    .post('/work-orders')
    .set('Authorization', authHeader())
    .send({ courseId: '6689c65a-7736-46af-b7f0-50008020be06', title: 'Test', detail: 'Detail', status: 'Completed', assignee: 'Crew', technicianEmployeeId: 'employee-2', laborHours: 2.5, completedWorkNotes: 'Finished the repair and tested the unit.', completedAt: new Date().toISOString() });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, 'Test');
  assert.equal(response.body.completed_work_notes, 'Finished the repair and tested the unit.');
  assert.equal(response.body.activity_log[0].action, 'created');
});

test('work order create rejects unknown workflow status', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees')) return { rows: [makeEmployeeRow()] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .post('/work-orders')
    .set('Authorization', authHeader())
    .send({ courseId: 'course-1', title: 'Test', detail: 'Detail', status: 'Waiting on vendor', assignee: 'Crew' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Invalid work order status: Waiting on vendor');
  assert.ok(response.body.allowedStatuses.includes('Blocked'));
});

test('non-admin cannot list course employees', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/employees?courseId=6689c65a-7736-46af-b7f0-50008020be06')
    .set('Authorization', authHeader());

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Admin access required for this course');
});

test('admin can list audit logs', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      if (text.includes('from audit_logs')) {
        return {
          rows: [
            {
              id: 'audit-1',
              action: 'membership.upsert',
              detail: { role: 'read_only' },
              created_at: new Date().toISOString(),
              actor_name: 'Admin',
              actor_email: 'admin@example.com',
              target_name: 'Brad',
              target_email: 'brad@example.com',
              total_count: '1'
            }
          ]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/audit-logs?courseId=6689c65a-7736-46af-b7f0-50008020be06')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items[0].action, 'membership.upsert');
});

test('non-admin directory responses hide hourly rate', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      if (text.includes('from employees e') && text.includes('join course_memberships cm')) {
        return {
          rows: [{ id: 'employee-2', email: 'tech@example.com', full_name: 'Tech', hourly_rate: '40', created_at: new Date().toISOString(), course_id: 'course-1' }]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/employees/directory?courseId=course-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body[0].hourly_rate, null);
});

test('admin company directory responses include company employees not yet on the selected course', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      if (text.includes('from employees e') && text.includes('join courses c on c.id = $1') && text.includes('left join course_memberships cm')) {
        return {
          rows: [{
            id: 'employee-2',
            company_id: 'company-1',
            email: 'newhire@example.com',
            full_name: 'New Hire',
            hourly_rate: '40',
            created_at: new Date().toISOString(),
            must_change_password: true,
            password_hash: null,
            role: null,
            course_id: null
          }]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/employees/company-directory?courseId=course-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].email, 'newhire@example.com');
  assert.equal(response.body[0].role, null);
  assert.equal(response.body[0].account_status, 'invited_pending_setup');
});

test('non-admin work order responses hide financial fields', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      if (text.includes('from work_orders')) {
        return {
          rows: [{ id: 'wo-1', course_id: 'course-1', title: 'Test', detail: 'Detail', status: 'Open', assignee: 'Crew', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_hours: '2.5', labor_rate: '40', labor_cost: '100', parts_cost: '20', total_cost: '120', created_at: new Date().toISOString() }]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
    connectImpl: async () => makeClient(async (text) => {
      if (text.includes('from work_order_parts_usage')) {
        return { rows: [{ id: 'usage-1', part_inventory_id: 'part-1', quantity_used: '1', unit_cost: '20', total_cost: '20', sku: 'SKU-1', part_description: 'Part' }] };
      }
      if (text.includes('from work_order_activity')) return { rows: [] };
      throw new Error(`Unexpected client query: ${text}`);
    })
  });

  const app = createApp();
  const response = await request(app)
    .get('/work-orders?courseId=course-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body[0].labor_rate, null);
  assert.equal(response.body[0].labor_cost, null);
  assert.equal(response.body[0].parts_cost, null);
  assert.equal(response.body[0].total_cost, null);
  assert.equal(response.body[0].part_usages[0].unit_cost, null);
  assert.equal(response.body[0].part_usages[0].total_cost, null);
});

test('read_write can update work orders across accessible courses', async () => {
  const queryImpl = async (text) => {
    if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
    if (text.includes('from work_orders') && text.includes('where id = $1')) return { rows: [{ id: 'wo-1', course_id: 'course-1' }] };
    if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
    throw new Error(`Unexpected query: ${text}`);
  };

  const clientQueryImpl = async (text, params) => {
    if (text === 'begin' || text === 'commit' || text === 'rollback') return { rows: [] };
    if (text.includes('delete from work_order_parts_usage')) return { rows: [] };
    if (text.includes('from work_order_parts_usage')) return { rows: [] };
    if (text.includes('insert into work_order_activity')) return { rows: [] };
    if (text.includes('from work_order_activity')) return { rows: [{ id: 'activity-2', action: 'status_changed', from_status: 'Open', to_status: 'Completed', detail: { changedFields: ['title'] }, created_at: new Date().toISOString() }] };
    if (text.includes('from employees') && text.includes('hourly_rate')) return { rows: [{ id: 'employee-2', full_name: 'Tech', hourly_rate: '40' }] };
    if (text.includes('update work_orders') && text.includes('set course_id = $2')) return { rows: [{ id: 'wo-1', course_id: params[1], title: 'Updated', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_rate: '40', labor_cost: '80', parts_cost: '0', total_cost: '80' }] };
    if (text.includes('set parts_cost = $2')) return { rows: [{ id: 'wo-1', course_id: params[1] || 'course-2', title: 'Updated', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_rate: '40', labor_cost: '80', parts_cost: '0', total_cost: '80' }] };
    throw new Error(`Unexpected client query: ${text}`);
  };

  setDbTestOverrides({
    queryImpl,
    connectImpl: async () => makeClient(clientQueryImpl)
  });

  const app = createApp();
  const response = await request(app)
    .patch('/work-orders/wo-1')
    .set('Authorization', authHeader())
    .send({ courseId: 'course-2', title: 'Updated', detail: 'D', status: 'Open', assignee: 'Crew', technicianEmployeeId: 'employee-2', laborHours: 2 });

  assert.equal(response.status, 200);
  assert.equal(response.body.course_id, 'course-2');
});

test('work order update rejects invalid terminal workflow transition', async () => {
  const queryImpl = async (text) => {
    if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
    if (text.includes('from work_orders') && text.includes('where id = $1')) {
      return {
        rows: [{
          id: 'wo-1',
          course_id: 'course-1',
          title: 'Test',
          detail: 'Detail',
          status: 'Completed',
          assignee: 'Crew',
          technician_employee_id: null,
          technician_name: null,
          labor_hours: '0',
          completed_work_notes: null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      };
    }
    if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
    throw new Error(`Unexpected query: ${text}`);
  };

  setDbTestOverrides({ queryImpl });

  const app = createApp();
  const response = await request(app)
    .patch('/work-orders/wo-1')
    .set('Authorization', authHeader())
    .send({ courseId: 'course-1', title: 'Test', detail: 'Detail', status: 'Cancelled', assignee: 'Crew' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Invalid work order status transition: Completed to Cancelled');
});

test('read_write can update and reassign equipment between accessible courses', async () => {
  const targetCourseId = '55555555-5555-4555-8555-555555555555';

  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from equipment') && text.includes('where id = $1')) return { rows: [{ id: 'eq-1', course_id: 'course-1' }] };
      if (text.includes('select role') && text.includes('from course_memberships')) {
        return { rows: [{ role: 'read_write' }] };
      }
      if (text.includes('update equipment')) {
        return { rows: [{ id: 'eq-1', course_id: params[1], name: 'Updated mower', assigned_area: 'Fairways 10-18', status: 'Scheduled' }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .patch('/equipment/eq-1')
    .set('Authorization', authHeader())
    .send({ courseId: targetCourseId, name: 'Updated mower', make: 'Toro', model: '5510', assignedArea: 'Fairways 10-18', vin: 'VIN', serialNumber: 'SER', description: 'Desc', hours: '100', detail: 'Note', status: 'Scheduled' });

  assert.equal(response.status, 200);
  assert.equal(response.body.course_id, targetCourseId);
  assert.equal(response.body.assigned_area, 'Fairways 10-18');
});

test('read_write cannot move inventory into an inaccessible course', async () => {
  const accessibleCourseId = '11111111-1111-4111-8111-111111111111';
  const inaccessibleCourseId = '22222222-2222-4222-8222-222222222222';

  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from parts_inventory') && text.includes('where id = $1')) return { rows: [{ id: 'part-1', course_id: accessibleCourseId, updated_at: '2026-05-19T12:00:00.000Z' }] };
      if (text.includes('select role') && text.includes('from course_memberships')) {
        if (params[1] === accessibleCourseId) return { rows: [{ role: 'read_write' }] };
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .patch('/parts-inventory/part-1')
    .set('Authorization', authHeader())
    .send({
      courseId: inaccessibleCourseId,
      sku: 'BEDKNIFE-22',
      partDescription: '22 inch bedknife',
      quantityOnHand: 12,
      unitCost: 45
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Write access denied for this course');
});

test('stale inventory update returns 409 conflict', async () => {
  const courseId = '11111111-1111-4111-8111-111111111111';
  const serverUpdatedAt = '2026-05-19T15:00:00.000Z';

  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from parts_inventory') && text.includes('where id = $1')) return { rows: [{ id: 'part-1', course_id: courseId, updated_at: serverUpdatedAt }] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .patch('/parts-inventory/part-1')
    .set('Authorization', authHeader())
    .send({
      courseId,
      sku: 'FILTER-100',
      partDescription: 'Hydraulic filter',
      quantityOnHand: 8,
      unitCost: 31,
      expectedUpdatedAt: '2026-05-19T14:00:00.000Z'
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.conflict, 'stale_update');
  assert.equal(response.body.currentUpdatedAt, serverUpdatedAt);
});

test('admin can fetch employee profile details', async () => {
  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1') && params?.[0] === 'employee-1') return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      if (text.includes('from employees e') && text.includes('where e.id = $1')) {
        return {
          rows: [{ id: 'employee-2', email: 'tech@example.com', full_name: 'Tech', hourly_rate: '40', profile_image_url: '/uploads/profiles/tech.jpg', phone: '555-222-3333', address_line_1: '100 Fairway', address_line_2: null, city: 'Denver', state: 'CO', postal_code: '80202', created_at: new Date().toISOString(), must_change_password: false }]
        };
      }
      if (text.includes('join courses c on c.id = cm.course_id')) {
        return { rows: [{ id: 'membership-1', course_id: 'course-1', role: 'read_write', name: 'Pine Ridge', region: 'AZ', superintendent_name: 'Dana' }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/employees/employee-2?courseId=course-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.email, 'tech@example.com');
  assert.equal(response.body.memberships.length, 1);
});

test('admin can remove an employee from a course membership', async () => {
  const employeeId = '11111111-1111-4111-8111-111111111111';
  const courseId = '22222222-2222-4222-8222-222222222222';

  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1') && params?.[0] === 'employee-1') return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      if (text.includes('insert into audit_logs')) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    },
    connectImpl: async () => makeClient(async (text, params) => {
      if (text.includes('begin') || text.includes('commit') || text.includes('rollback')) return { rows: [] };
      if (text.includes('from courses') && text.includes('where id = $1')) {
        return { rows: [{ id: courseId, company_id: 'company-1', name: 'Airport' }] };
      }
      if (text.includes('from employees') && text.includes('where id = $1 and company_id = $2')) {
        return { rows: [{ id: employeeId, company_id: 'company-1', email: 'tech@example.com', full_name: 'Tech', must_change_password: false, password_hash: 'hash' }] };
      }
      if (text.includes('delete from course_memberships')) {
        return { rows: [{ id: 'membership-2', employee_id: employeeId, course_id: params[1], role: 'read_write', created_at: new Date().toISOString() }] };
      }
      if (text.includes('insert into audit_logs')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected client query: ${text}`);
    })
  });

  const app = createApp();
  const response = await request(app)
    .delete(`/employees/${employeeId}/memberships/${courseId}`)
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.membership.course_id, courseId);
});

test('admin can delete an employee account entirely', async () => {
  const employeeId = '33333333-3333-4333-8333-333333333333';
  const courseId = '44444444-4444-4444-8444-444444444444';

  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1') && params?.[0] === 'employee-1') return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      throw new Error(`Unexpected query: ${text}`);
    },
    connectImpl: async () => makeClient(async (text, params) => {
      if (text === 'begin' || text === 'commit' || text === 'rollback') return { rows: [] };
      if (text.includes('from courses') && text.includes('where id = $1')) {
        return { rows: [{ id: courseId, company_id: 'company-1', name: 'North Course' }] };
      }
      if (text.includes('from employees') && text.includes('where id = $1 and company_id = $2')) {
        return { rows: [{ id: employeeId, company_id: 'company-1', email: 'former@example.com', full_name: 'Former Employee', must_change_password: false, password_hash: 'hash', company_role: null }] };
      }
      if (text.includes('insert into audit_logs')) {
        return { rows: [] };
      }
      if (text.includes('delete from employees')) {
        return { rows: [{ id: employeeId, email: 'former@example.com', full_name: 'Former Employee', company_role: null }] };
      }
      throw new Error(`Unexpected client query: ${text}`);
    })
  });

  const app = createApp();
  const response = await request(app)
    .delete(`/employees/${employeeId}?courseId=${courseId}`)
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.employee.id, employeeId);
});

test('read_only cannot delete equipment', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from equipment') && text.includes('where id = $1')) return { rows: [{ id: 'eq-1', course_id: 'course-1' }] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_only' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .delete('/equipment/eq-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Write access denied for this course');
});

test('read_only cannot delete work orders', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from work_orders') && text.includes('where id = $1')) return { rows: [{ id: 'wo-1', course_id: 'course-1' }] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_only' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .delete('/work-orders/wo-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Write access denied for this course');
});

test('employee can clock in and create a time entry', async () => {
  const queryImpl = async (text) => {
    if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
    if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
    throw new Error(`Unexpected query: ${text}`);
  };

  const clientQueryImpl = async (text) => {
    if (text === 'begin' || text === 'commit' || text === 'rollback') return { rows: [] };
    if (text.includes('from employee_time_entries') && text.includes('clock_out_at is null')) return { rows: [] };
    if (text.includes('insert into employee_time_entries')) return { rows: [{ id: 'time-1' }] };
    if (text.includes('insert into audit_logs')) return { rows: [] };
    if (text.includes('from employee_time_entries te') && text.includes('where te.id = $1')) {
      return { rows: [{ id: 'time-1', employee_id: 'employee-1', course_id: 'course-1', clock_in_at: new Date().toISOString(), clock_out_at: null, clock_in_note: 'Starting shift', clock_out_note: null, created_at: new Date().toISOString(), worked_hours: '0.00', employee_name: 'Test User', employee_email: 'test@example.com' }] };
    }
    throw new Error(`Unexpected client query: ${text}`);
  };

  setDbTestOverrides({
    queryImpl,
    connectImpl: async () => makeClient(clientQueryImpl)
  });

  const app = createApp();
  const response = await request(app)
    .post('/time-entries/clock-in')
    .set('Authorization', authHeader())
    .send({ courseId: '6689c65a-7736-46af-b7f0-50008020be06', note: 'Starting shift' });

  assert.equal(response.status, 201);
  assert.equal(response.body.course_id, 'course-1');
  assert.equal(response.body.clock_in_note, 'Starting shift');
});

test('employee cannot clock in twice for the same course', async () => {
  const queryImpl = async (text) => {
    if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
    if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
    throw new Error(`Unexpected query: ${text}`);
  };

  const clientQueryImpl = async (text) => {
    if (text === 'begin' || text === 'rollback') return { rows: [] };
    if (text.includes('from employee_time_entries') && text.includes('clock_out_at is null')) return { rows: [{ id: 'time-1' }] };
    throw new Error(`Unexpected client query: ${text}`);
  };

  setDbTestOverrides({
    queryImpl,
    connectImpl: async () => makeClient(clientQueryImpl)
  });

  const app = createApp();
  const response = await request(app)
    .post('/time-entries/clock-in')
    .set('Authorization', authHeader())
    .send({ courseId: '6689c65a-7736-46af-b7f0-50008020be06' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'You are already clocked in for this course.');
});

test('admin can list course time entries', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      if (text.includes('from employee_time_entries te')) {
        return { rows: [{ id: 'time-1', employee_id: 'employee-2', course_id: 'course-1', clock_in_at: new Date().toISOString(), clock_out_at: null, clock_in_note: 'Opening shift', clock_out_note: null, created_at: new Date().toISOString(), worked_hours: '1.25', employee_name: 'Tech', employee_email: 'tech@example.com' }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/time-entries?courseId=6689c65a-7736-46af-b7f0-50008020be06&scope=course')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.activeEntry.employee_name, 'Tech');
});

test('admin can request payroll summary with date range and approved filter', async () => {
  let summaryQueryCount = 0;

  setDbTestOverrides({
    queryImpl: async (text, params) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'admin' }] };
      if (text.includes('with entry_summary as (')) {
        summaryQueryCount += 1;
        assert.equal(params[1], '2026-05-01T00:00:00.000Z');
        assert.equal(params[2], '2026-05-14T23:59:59.999Z');
        assert.ok(text.includes('te.approved_at is not null'));
        assert.ok(text.includes('weekly_rollup'));
        return {
          rows: [{
            employee_id: 'employee-2',
            employee_name: 'Tech',
            employee_email: 'tech@example.com',
            hourly_rate: '20',
            entry_count: '10',
            active_entry_count: '0',
            approved_entry_count: '10',
            total_hours: '85.00',
            regular_hours: '80.00',
            overtime_hours: '5.00'
          }]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/time-entries/summary?courseId=6689c65a-7736-46af-b7f0-50008020be06&scope=course&startDate=2026-05-01T00:00:00.000Z&endDate=2026-05-14T23:59:59.999Z&approvedOnly=true')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(summaryQueryCount, 1);
  assert.equal(response.body.approvedOnly, true);
  assert.equal(response.body.items[0].regular_hours, 80);
  assert.equal(response.body.items[0].overtime_hours, 5);
  assert.equal(response.body.items[0].regular_pay, 1600);
  assert.equal(response.body.items[0].overtime_pay, 150);
  assert.equal(response.body.totals.totalPay, 1750);
});

test('stale work order update returns 409 conflict', async () => {
  const serverUpdatedAt = '2026-05-07T14:30:00.000Z';

  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from work_orders') && text.includes('where id = $1')) return { rows: [{ id: 'wo-1', course_id: 'course-1', updated_at: serverUpdatedAt }] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .patch('/work-orders/wo-1')
    .set('Authorization', authHeader())
    .send({ courseId: 'course-1', title: 'Updated', detail: 'D', status: 'Open', assignee: 'Crew', expectedUpdatedAt: '2026-05-07T13:00:00.000Z' });

  assert.equal(response.status, 409);
  assert.equal(response.body.conflict, 'stale_update');
  assert.equal(response.body.currentUpdatedAt, serverUpdatedAt);
});

test('stale equipment delete returns 409 conflict', async () => {
  const serverUpdatedAt = '2026-05-07T15:00:00.000Z';

  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('from equipment') && text.includes('where id = $1')) return { rows: [{ id: 'eq-1', course_id: 'course-1', updated_at: serverUpdatedAt }] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .delete('/equipment/eq-1')
    .set('Authorization', authHeader())
    .send({ expectedUpdatedAt: '2026-05-07T14:00:00.000Z' });

  assert.equal(response.status, 409);
  assert.equal(response.body.conflict, 'stale_delete');
  assert.equal(response.body.currentUpdatedAt, serverUpdatedAt);
});

test('non-admin cannot fetch reports course summary', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/reports/course-summary?courseId=course-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'Admin access required for this course');
});

test('non-admin directory responses hide parts inventory unit_cost', async () => {
  setDbTestOverrides({
    queryImpl: async (text) => {
      if (text.includes('from employees') && text.includes('where id = $1')) return { rows: [makeEmployeeRow()] };
      if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
      if (text.includes('from parts_inventory')) {
        return {
          rows: [
            { id: 'part-1', course_id: 'course-1', sku: 'SKU-1', part_description: 'Part Description', quantity_on_hand: 10, unit_cost: '25.50' }
          ]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const app = createApp();
  const response = await request(app)
    .get('/parts-inventory?courseId=course-1')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.body[0].unit_cost, null);
  assert.equal(response.body[0].sku, 'SKU-1');
});

test('non-admin creating work order ignores custom laborRate', async () => {
  const queryImpl = async (text) => {
    if (text.includes('from employees')) return { rows: [makeEmployeeRow()] };
    if (text.includes('select role') && text.includes('from course_memberships')) return { rows: [{ role: 'read_write' }] };
    throw new Error(`Unexpected query: ${text}`);
  };

  const clientQueryImpl = async (text) => {
    if (text === 'begin' || text === 'commit' || text === 'rollback') return { rows: [] };
    if (text.includes('from employees') && text.includes('hourly_rate')) {
      return { rows: [{ id: 'employee-2', full_name: 'Tech', hourly_rate: '30.00' }] };
    }
    if (text.includes('insert into work_orders')) {
      return { rows: [{ id: 'wo-1', course_id: 'course-1', title: 'Test', detail: 'Detail', status: 'Completed', assignee: 'Crew', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_hours: '2', labor_rate: '30.00', labor_cost: '60.00', parts_cost: '0', total_cost: '60.00' }] };
    }
    if (text.includes('insert into work_order_activity')) return { rows: [] };
    if (text.includes('set parts_cost = $2')) {
      return { rows: [{ id: 'wo-1', course_id: 'course-1', title: 'Test', detail: 'Detail', status: 'Completed', assignee: 'Crew', technician_employee_id: 'employee-2', technician_name: 'Tech', labor_hours: '2', labor_rate: '30.00', labor_cost: '60.00', parts_cost: '0', total_cost: '60.00' }] };
    }
    if (text.includes('from work_order_parts_usage')) return { rows: [] };
    if (text.includes('from work_order_activity')) return { rows: [] };
    throw new Error(`Unexpected client query: ${text}`);
  };

  setDbTestOverrides({
    queryImpl,
    connectImpl: async () => makeClient(clientQueryImpl)
  });

  const app = createApp();
  const response = await request(app)
    .post('/work-orders')
    .set('Authorization', authHeader())
    .send({ courseId: 'course-1', title: 'Test', detail: 'Detail', status: 'Completed', assignee: 'Crew', technicianEmployeeId: 'employee-2', laborHours: 2, laborRate: 99 });

  assert.equal(response.status, 201);
});
