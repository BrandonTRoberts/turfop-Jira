import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { createInviteToken, hashInviteToken } from '../lib/auth.js';
import { getRoleForFacility, isAdmin } from '../lib/permissions.js';
import {
  normalizeEmail,
  validateAdminEmployeeProfileInput,
  validateFacilityRoleInput,
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

function buildInvitePayload(token, facilityId) {
  if (!shouldAllowManualTokenPreview()) {
    return { expiresInHours: INVITE_TTL_HOURS };
  }

  return {
    inviteToken: token,
    inviteUrl: buildMagicLinkUrl(token, facilityId),
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

async function loadFacility(client, facilityId) {
  const result = await client.query(
    `
      select id, company_id, name
      from facilities
      where id = $1
      limit 1
    `,
    [facilityId]
  );

  return result.rows[0] || null;
}

// Back-compat alias: many routes still call this helper name.
// TODO: remove after the facility cut-over is complete.
const loadCourse = loadFacility;

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

async function ensureEmployeeEditableForFacility(client, facilityId, companyId, employeeId) {
  const companyEmployee = await ensureEmployeeInCompany(client, companyId, employeeId);
  if (companyEmployee) {
    return companyEmployee;
  }

  const result = await client.query(
    `
      select e.id, e.company_id, e.email, e.full_name, e.password_hash, e.must_change_password, e.company_role
      from employees e
      join facility_memberships fm on fm.employee_id = e.id
      where e.id = $1 and fm.facility_id = $2
      limit 1
    `,
    [employeeId, facilityId]
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
  const { email, fullName, facilityId, role, hourlyRate, profileImage } = req.body;

  try {
    const validationError = validateEmployeeInviteInput({ email, fullName, facilityId, role, hourlyRate });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (!ensureInviteDeliveryReady(res)) {
      return undefined;
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();

    try {
      await client.query('begin');

      const course = await loadCourse(client, facilityId);
      if (!course) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Facility not found' });
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
          insert into facility_memberships (employee_id, facility_id, role)
          values ($1, $2, $3)
          returning id, employee_id, facility_id, role, created_at
        `,
        [employee.id, facilityId, role]
      );

      const inviteToken = createInviteToken();
      const tokenHash = hashInviteToken(inviteToken);
      await client.query(
        `
          insert into invite_tokens (employee_id, course_id, token_hash, created_by_employee_id, expires_at)
          values ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)
        `,
        [employee.id, facilityId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.create', facilityId, employee.id, { email: employee.email, role }]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.invite', facilityId, employee.id, { email: employee.email }]
      );

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: inviteToken,
        facilityId,
        purpose: 'invite'
      });

      await client.query('commit');

      const { password_hash, ...safeEmployee } = employee;

      return res.status(201).json({
        employee: {
          ...safeEmployee,
          account_status: buildAccountStatus(employee)
        },
        membership: membershipResult.rows[0],
        deliveryMode: delivery.mode,
        ...buildInvitePayload(inviteToken, facilityId)
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
  const { facilityId } = req.body;

  try {
    const validationError = validateFacilityRoleInput({ facilityId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid facilityId is required' });
    }

    if (!ensureInviteDeliveryReady(res)) {
      return undefined;
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, facilityId);
      if (!course) {
        return res.status(404).json({ error: 'Facility not found' });
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
        [employeeId, facilityId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.invite',
        facilityId,
        targetEmployeeId: employeeId,
        detail: { email: employee.email }
      });

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: inviteToken,
        facilityId,
        purpose: 'invite'
      });

      return res.status(201).json({
        deliveryMode: delivery.mode,
        ...buildInvitePayload(inviteToken, facilityId)
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
  const { facilityId } = req.body;

  try {
    const validationError = validateFacilityRoleInput({ facilityId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid facilityId is required' });
    }

    if (!ensureInviteDeliveryReady(res)) {
      return undefined;
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, facilityId);
      if (!course) {
        return res.status(404).json({ error: 'Facility not found' });
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
        [employeeId, facilityId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.invite.resend',
        facilityId,
        targetEmployeeId: employeeId,
        detail: { email: employee.email }
      });

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: inviteToken,
        facilityId,
        purpose: 'invite'
      });

      return res.status(201).json({
        deliveryMode: delivery.mode,
        ...buildInvitePayload(inviteToken, facilityId)
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
  const { facilityId } = req.body;

  try {
    const validationError = validateFacilityRoleInput({ facilityId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid facilityId is required' });
    }

    if (!ensureInviteDeliveryReady(res)) { // Using the same email delivery check
      return undefined;
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, facilityId);
      if (!course) {
        return res.status(404).json({ error: 'Facility not found' });
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
        [employeeId, facilityId, tokenHash, req.employee.id, String(INVITE_TTL_HOURS)]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.password.reset.request',
        facilityId,
        targetEmployeeId: employeeId,
        detail: { email: employee.email }
      });

      const delivery = await deliverMagicLinkEmail({
        to: employee.email,
        fullName: employee.full_name,
        token: resetToken,
        facilityId,
        purpose: 'reset' // Indicate purpose is password reset
      });

      return res.status(201).json({
        deliveryMode: delivery.mode,
        // For security, don't expose the resetToken here in production
        ...buildInvitePayload(resetToken, facilityId) // Reusing for preview in dev
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/memberships', requireAuth, async (req, res) => {
  const { employeeId, facilityId, role } = req.body;

  try {
    const validationError = validateMembershipInput({ employeeId, facilityId, role });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, facilityId);
      if (!course) {
        return res.status(404).json({ error: 'Facility not found' });
      }

      const employee = await ensureEmployeeInCompany(client, course.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const result = await client.query(
        `
          insert into facility_memberships (employee_id, facility_id, role)
          values ($1, $2, $3)
          on conflict (employee_id, facility_id)
          do update set role = excluded.role
          returning id, employee_id, facility_id, role, created_at
        `,
        [employeeId, facilityId, role]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'membership.upsert',
        facilityId,
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

router.delete('/:employeeId/memberships/:facilityId', requireAuth, async (req, res) => {
  const { employeeId, facilityId } = req.params;

  try {
    const validationError = validateMembershipInput({ employeeId, facilityId, role: 'read_only' });
    if (validationError) {
      return res.status(400).json({ error: 'Valid employeeId and facilityId are required' });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      const facility = await loadCourse(client, facilityId);
      if (!facility) {
        return res.status(404).json({ error: 'Facility not found' });
      }

      const employee = await ensureEmployeeInCompany(client, facility.company_id, employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const result = await client.query(
        `
          delete from facility_memberships
          where employee_id = $1 and facility_id = $2
          returning id, employee_id, facility_id, role, created_at
        `,
        [employeeId, facilityId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Membership not found' });
      }

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'membership.remove',
        facilityId,
        targetEmployeeId: employeeId,
        detail: { removedFacilityId: facilityId }
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
  const { facilityId } = req.query;

  try {
    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!currentRole) {
      return res.status(403).json({ error: 'No access to this facility' });
    }

    const result = await query(
      `
        select e.id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.created_at, fm.facility_id, fm.role
        from employees e
        join facility_memberships cm on fm.employee_id = e.id
        join facilities f on f.id = fm.facility_id
        where fm.facility_id = $1
        order by coalesce(e.full_name, e.email) asc
      `,
      [facilityId]
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
  const { facilityId } = req.query;

  try {
    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const result = await query(
      `
        select e.id, e.company_id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.created_at, e.must_change_password, e.password_hash, fm.role, fm.facility_id
        from employees e
        join facilities f on f.id = $1
        left join facility_memberships fm on fm.employee_id = e.id and fm.facility_id = f.id
        where e.company_id = f.company_id
        order by coalesce(e.full_name, e.email) asc
      `,
      [facilityId]
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
  const { facilityId } = req.query;

  try {
    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const result = await query(
      `
        select e.id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.phone, e.address_line_1, e.address_line_2, e.city, e.state, e.postal_code, e.created_at, e.must_change_password, e.password_hash
        from employees e
        left join facility_memberships fm on fm.employee_id = e.id and fm.facility_id = $2
        where e.id = $1
          and (
            e.company_id = (select company_id from facilities where id = $2)
            or fm.id is not null
          )
        limit 1
      `,
      [employeeId, facilityId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const membershipsResult = await query(
      `
        select fm.id, fm.facility_id, fm.role, f.company_id, co.name as company_name, f.name, f.region, f.superintendent_name
        from facility_memberships fm
        join facilities f on f.id = fm.facility_id
        join companies co on co.id = f.company_id
        where fm.employee_id = $1 and f.company_id = (select company_id from facilities where id = $2)
        order by f.name asc
      `,
      [employeeId, facilityId]
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
  const { facilityId, email, fullName, hourlyRate, phone, addressLine1, addressLine2, city, state, postalCode, profileImage } = req.body;

  try {
    const validationError = validateAdminEmployeeProfileInput({ email, fullName, hourlyRate, phone, addressLine1, addressLine2, city, state, postalCode });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      const course = await loadCourse(client, facilityId);
      if (!course) {
        return res.status(404).json({ error: 'Facility not found' });
      }

      const employee = await ensureEmployeeEditableForFacility(client, facilityId, course.company_id, employeeId);
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
                from facility_memberships cm
                where fm.employee_id = employees.id and fm.facility_id = $13
              )
            )
          returning id, email, full_name, hourly_rate, profile_image_url, phone, address_line_1, address_line_2, city, state, postal_code, created_at, must_change_password, password_hash
        `,
        [employeeId, normalizeEmail(email), fullName.trim(), hourlyRate ?? null, phone?.trim() || null, addressLine1?.trim() || null, addressLine2?.trim() || null, city?.trim() || null, state?.trim() || null, postalCode?.trim() || null, profileImageUrl, course.company_id, facilityId]
      );

      await logAuditEvent({
        actorEmployeeId: req.employee.id,
        action: 'employee.profile.update',
        facilityId,
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
  const { facilityId } = req.query;

  try {
    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    if (employeeId === req.employee.id) {
      return res.status(400).json({ error: 'You cannot delete your own account from this screen.' });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const client = await connect();
    try {
      await client.query('begin');

      const course = await loadCourse(client, facilityId);
      if (!course) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Facility not found' });
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
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [req.employee.id, 'employee.delete', facilityId, employeeId, { email: employee.email, fullName: employee.full_name }]
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
  const { facilityId } = req.query;

  try {
    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const result = await query(
      `
        select distinct e.id, e.company_id, e.email, e.full_name, e.hourly_rate, e.profile_image_url, e.created_at, e.must_change_password, e.password_hash, fm.role, fm.facility_id
        from employees e
        join facility_memberships fm on fm.employee_id = e.id
        join facilities f on f.id = fm.facility_id
        where fm.facility_id = $1
        order by e.created_at desc
      `,
      [facilityId]
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
