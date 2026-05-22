import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { createInviteToken, hashInviteToken } from '../lib/auth.js';
import { getRoleForCourse, isAdmin } from '../lib/permissions.js';
import {
  normalizeEmail,
  validateAdminEmployeeProfileInput,
  validateCourseRoleInput,
  validateEmployeeInviteInput,
  validateMembershipInput
} from '../lib/validation.js';
import { logAuditEvent } from '../lib/audit.js';
import { persistSingleImage } from '../lib/media.js';
import {
  buildMagicLinkUrl,
  deliverMagicLinkEmail,
  isEmailDeliveryReady,
  shouldAllowManualTokenPreview
} from '../lib/resetDelivery.js';
import { handleUnexpectedError } from '../lib/http.js';

const INVITE_TTL_HOURS = 72;
const router = Router();

function buildInvitePayload(token, courseId) {
  if (!shouldAllowManualTokenPreview()) {
    return { expiresInHours: INVITE_TTL_HOURS };
  }

  return {
    inviteToken: token,
    inviteUrl: buildMagicLinkUrl(token, courseId),
    expiresInHours: INVITE_TTL_HOURS
  };
}

function ensureInviteDeliveryReady(res) {
  if (!isEmailDeliveryReady() && !shouldAllowManualTokenPreview()) {
    res.status(503).json({ error: 'Account setup delivery is not configured.' });
    return false;
  }

  return true;
}

async function loadCourse(client, courseId) {
  const result = await client.query(
    `
      select id, company_id, name
      from courses
      where id = $1
      limit 1
    `,
    [courseId]
  );

  return result.rows[0] || null;
}

async function ensureEmployeeInCompany(client, companyId, employeeId) {
  const result = await client.query(
    `
      select id, company_id, email, full_name, password_hash, must_change_password, company_role
      from employees
      where id = $1 and company_id = $2
      limit 1
    `,
    [employeeId, companyId]
  );

  return result.rows[0] || null;
}

async function ensureEmployeeEditableForCourse(client, courseId, companyId, employeeId) {
  const companyEmployee = await ensureEmployeeInCompany(client, companyId, employeeId);
  if (companyEmployee) {
    return companyEmployee;
  }

  const result = await client.query(
    `
      select e.id, e.company_id, e.email, e.full_name, e.password_hash, e.must_change_password, e.company_role
      from employees e
      join course_memberships cm on cm.employee_id = e.id
      where e.id = $1 and cm.course_id = $2
      limit 1
    `,
    [employeeId, courseId]
  );

  return result.rows[0] || null;
}

function buildAccountStatus(employee) {
  if (!employee.password_hash && employee.must_change_password) {
    return 'invited_pending_setup';
  }

  if (employee.must_change_password) {
    return 'password_change_required';
  }

  return 'active';
}

router.post('/', requireAuth, async (req, res) => {
  const { email, fullName, courseId, role, hourlyRate, profileImage } = req.body;

  try {
    const validationError = validateEmployeeInviteInput({ email, fullName, courseId, role, hourlyRate });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (!ensureInviteDeliveryReady(res)) {
      return undefined;
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();

    try {
      await client.query('begin');

      const course = await loadCourse(client, courseId);
      if (!course) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Course not found' });
      }

      const profileImageUrl = await persistSingleImage(profileImage, { entityType: 'profiles' });
      const employeeResult = await client.query(
        `
          insert into employees (company_id, email, full_name, password_hash, must_change_password, hourly_rate, profile_image_url)
          values ($1, $2, $3, null, true, $4, $5)
          returning id, company_id, email, full_name, hourly_rate, profile_image_url, created_at, must_change_password, password_hash
        `,
        [course.company_id, normalizeEmail(email), fullName.trim(), hourlyRate ?? null, profileImageUrl]
      );

      const employee = employeeResult.rows[0];
      const membershipResult = await client.query(
        `
          insert into course_memberships (employee_id, course_id, role)
          values ($1, $2, $3)
          returning id, employee_id, course_id, role, created_at
        `,
        [employee.id, courseId, role]
      );

      const inviteToken = createInviteToken();
      const tokenHash = hashInviteToken(inviteToken);
      await client.query(
        `
          insert into invite_tokens (employee_id, course_id, token_hash, created_by_employee_id, expires_at)
          values ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
        `,
        [employee.id, courseId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, course_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.create', courseId, employee.id, { email: employee.email, role }]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, course_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.invite', courseId, employee.id, { email: employee.email }]
      );

      await client.query('commit');

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: inviteToken,
        courseId,
        purpose: 'invite'
      });

      const { password_hash, ...safeEmployee } = employee;

      return res.status(201).json({
        employee: {
          ...safeEmployee,
          account_status: buildAccountStatus(employee)
        },
        membership: membershipResult.rows[0],
        deliveryMode: delivery.mode,
        ...buildInvitePayload(inviteToken, courseId)
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An employee with that email already exists' });
    }

    return handleUnexpectedError(res, error);
  }
});

router.post('/:employeeId/invitations', requireAuth, async (req, res) => {
  const { employeeId } = req.params;
  const { courseId } = req.body;

  try {
    const validationError = validateCourseRoleInput({ courseId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid courseId is required' });
    }

    if (!ensureInviteDeliveryReady(res)) {
      return undefined;
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const inviteToken = createInviteToken();
      const tokenHash = hashInviteToken(inviteToken);
      await client.query(
        `
          insert into invite_tokens (employee_id, course_id, token_hash, created_by_employee_id, expires_at)
          values ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
        `,
        [employeeId, courseId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.invite',
        courseId,
        targetEmployeeId: employeeId,
        detail: { email: employee.email }
      });

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: inviteToken,
        courseId,
        purpose: 'invite'
      });

      return res.status(201).json({
        deliveryMode: delivery.mode,
        ...buildInvitePayload(inviteToken, courseId)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/:employeeId/resend-invite', requireAuth, async (req, res) => {
  const { employeeId } = req.params;
  const { courseId } = req.body;

  try {
    const validationError = validateCourseRoleInput({ courseId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid courseId is required' });
    }

    if (!ensureInviteDeliveryReady(res)) {
      return undefined;
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const inviteToken = createInviteToken();
      const tokenHash = hashInviteToken(inviteToken);
      await client.query(
        `
          insert into invite_tokens (employee_id, course_id, token_hash, created_by_employee_id, expires_at)
          values ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
        `,
        [employeeId, courseId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.invite.resend',
        courseId,
        targetEmployeeId: employeeId,
        detail: { email: employee.email }
      });

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: inviteToken,
        courseId,
        purpose: 'invite'
      });

      return res.status(201).json({
        deliveryMode: delivery.mode,
        ...buildInvitePayload(inviteToken, courseId)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/:employeeId/send-reset-password', requireAuth, async (req, res) => {
  const { employeeId } = req.params;
  const { courseId } = req.body;

  try {
    const validationError = validateCourseRoleInput({ courseId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid courseId is required' });
    }

    if (!ensureInviteDeliveryReady(res)) { // Using the same email delivery check
      return undefined;
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const resetToken = createInviteToken(); // Reusing invite token mechanism for reset
      const tokenHash = hashInviteToken(resetToken);

      await client.query(
        `
          insert into invite_tokens (employee_id, course_id, token_hash, created_by_employee_id, expires_at)
          values ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
        `,
        [employeeId, courseId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.password.reset.request',
        courseId,
        targetEmployeeId: employeeId,
        detail: { email: employee.email }
      });

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: resetToken,
        courseId,
        purpose: 'reset' // Indicate purpose is password reset
      });

      return res.status(201).json({
        deliveryMode: delivery.mode,
        // For security, don't expose the resetToken here in production
        ...buildInvitePayload(resetToken, courseId) // Reusing for preview in dev
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/memberships', requireAuth, async (req, res) => {
  const { employeeId, courseId, role } = req.body;

  try {
    const validationError = validateMembershipInput({ employeeId, courseId, role });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const result = await client.query(
        `
          insert into course_memberships (employee_id, course_id, role)
          values ($1, $2, $3)
          on conflict (employee_id, course_id)
          do update set role = excluded.role
          returning id, employee_id, course_id, role, created_at
        `,
        [employeeId, courseId, role]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'membership.upsert',
        courseId,
        targetEmployeeId: employeeId,
        detail: { role }
      });

      return res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:employeeId/memberships/:courseId', requireAuth, async (req, res) => {
  const { employeeId, courseId } = req.params;

  try {
    const validationError = validateMembershipInput({ employeeId, courseId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid employeeId and courseId are required' });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const result = await client.query(
        `
          delete from course_memberships
          where employee_id = $1 and course_id = $2
          returning id, employee_id, course_id, role, created_at
        `,
        [employeeId, courseId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Membership not found' });
      }

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'membership.remove',
        courseId,
        targetEmployeeId: employeeId,
        detail: { removedCourseId: courseId }
      });

      return res.json({ ok: true, membership: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/directory', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  try {
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!currentRole) {
      return res.status(403).json({ error: 'No access to this course' });
    }

    const result = await query(
      `
        select e.id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.created_at, cm.course_id, cm.role
        from employees e
        join course_memberships cm on cm.employee_id = e.id
        join courses c on c.id = cm.course_id
        where cm.course_id = $1
        order by coalesce(e.full_name, e.email) asc
      `,
      [courseId]
    );

    const canSeeAdminFields = isAdmin(currentRole);
    return res.json(result.rows.map((row) => (
      canSeeAdminFields
        ? row
        : { ...row, email: null, hourly_rate: null }
    )));
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/company-directory', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  try {
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const result = await query(
      `
        select e.id, e.company_id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.created_at, e.must_change_password, e.password_hash, cm.role, cm.course_id
        from employees e
        join courses c on c.id = $1
        left join course_memberships cm on cm.employee_id = e.id and cm.course_id = c.id
        where e.company_id = c.company_id
        order by coalesce(e.full_name, e.email) asc
      `,
      [courseId]
    );

    return res.json(result.rows.map((row) => {
      const { password_hash, ...safeEmployee } = row;
      return {
        ...safeEmployee,
        account_status: buildAccountStatus(row)
      };
    }));
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/:employeeId', requireAuth, async (req, res) => {
  const { employeeId } = req.params;
  const { courseId } = req.query;

  try {
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const result = await query(
      `
        select e.id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.phone, e.address_line_1, e.address_line_2, e.city, e.state, e.postal_code, e.created_at, e.must_change_password, e.password_hash
        from employees e
        left join course_memberships cm on cm.employee_id = e.id and cm.course_id = $2
        where e.id = $1
          and (
            e.company_id = (select company_id from courses where id = $2)
            or cm.id is not null
          )
        limit 1
      `,
      [employeeId, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const membershipsResult = await query(
      `
        select cm.id, cm.course_id, cm.role, c.company_id, co.name as company_name, c.name, c.region, c.superintendent_name
        from course_memberships cm
        join courses c on c.id = cm.course_id
        join companies co on co.id = c.company_id
        where cm.employee_id = $1 and c.company_id = (select company_id from courses where id = $2)
        order by c.name asc
      `,
      [employeeId, courseId]
    );

    const employee = result.rows[0];
    const { password_hash, ...safeEmployee } = employee;
    return res.json({
      ...safeEmployee,
      account_status: buildAccountStatus(employee),
      memberships: membershipsResult.rows
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:employeeId', requireAuth, async (req, res) => {
  const { employeeId } = req.params;
  const { courseId, email, fullName, hourlyRate, phone, addressLine1, addressLine2, city, state, postalCode, profileImage } = req.body;

  try {
    const validationError = validateAdminEmployeeProfileInput({ email, fullName, hourlyRate, phone, addressLine1, addressLine2, city, state, postalCode });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeEditableForCourse(client, courseId, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const profileImageUrl = await persistSingleImage(profileImage, { 
        entityType: 'profiles',
        existingUrl: employee.profile_image_url
      });
      const result = await client.query(
        `
          update employees
          set email = $2,
              full_name = $3,
              hourly_rate = $4,
              phone = $5,
              address_line_1 = $6,
              address_line_2 = $7,
              city = $8,
              state = $9,
              postal_code = $10,
              profile_image_url = $11
          where id = $1
            and (
              company_id = $12
              or exists (
                select 1
                from course_memberships cm
                where cm.employee_id = employees.id and cm.course_id = $13
              )
            )
          returning id, email, full_name, hourly_rate, profile_image_url, phone, address_line_1, address_line_2, city, state, postal_code, created_at, must_change_password, password_hash
        `,
        [employeeId, normalizeEmail(email), fullName.trim(), hourlyRate ?? null, phone?.trim() || null, addressLine1?.trim() || null, addressLine2?.trim() || null, city?.trim() || null, state?.trim() || null, postalCode?.trim() || null, profileImageUrl, course.company_id, courseId]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.profile.update',
        courseId,
        targetEmployeeId: employeeId,
        detail: { email: normalizeEmail(email), fullName: fullName.trim(), hourlyRate: hourlyRate ?? null }
      });

      const updatedEmployee = result.rows[0];
      const { password_hash, ...safeEmployee } = updatedEmployee;
      return res.json({
        ...safeEmployee,
        account_status: buildAccountStatus(updatedEmployee)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An employee with that email already exists' });
    }

    return handleUnexpectedError(res, error);
  }
});

router.delete('/:employeeId', requireAuth, async (req, res) => {
  const { employeeId } = req.params;
  const { courseId } = req.query;

  try {
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    if (employeeId === req.employee.id) {
      return res.status(400).json({ error: 'You cannot delete your own account from this screen.' });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const client = await connect();
    try {
      await client.query('begin');

      const course = await loadCourse(client, courseId);
      if (!course) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Course not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Employee not found' });
      }

      if (employee.company_role === 'company_super_user') {
        const superUserCount = await client.query(
          `
            select count(*)::int as total
            from employees
            where company_id = $1 and company_role = 'company_super_user' and id <> $2
          `,
          [course.company_id, employeeId]
        );

        if (Number(superUserCount.rows[0]?.total || 0) === 0) {
          await client.query('rollback');
          return res.status(400).json({ error: 'Add another company super user before deleting this account.' });
        }
      }

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, course_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.delete', courseId, employeeId, { email: employee.email, fullName: employee.full_name }]
      );

      const deleted = await client.query(
        `
          delete from employees
          where id = $1 and company_id = $2
          returning id, email, full_name, company_role
        `,
        [employeeId, course.company_id]
      );

      await client.query('commit');
      return res.json({ ok: true, employee: deleted.rows[0] || null });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { courseId } = req.query;

  try {
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const result = await query(
      `
        select distinct e.id, e.company_id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.created_at, e.must_change_password, e.password_hash, cm.role, cm.course_id
        from employees e
        join course_memberships cm on cm.employee_id = e.id
        join courses c on c.id = cm.course_id
        where cm.course_id = $1
        order by e.created_at desc
      `,
      [courseId]
    );

    return res.json(result.rows.map((row) => {
      const { password_hash, ...safeEmployee } = row;
      return {
        ...safeEmployee,
        account_status: buildAccountStatus(row)
      };
    }));
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
