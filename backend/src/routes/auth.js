import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import {
  buildAuthCookie,
  buildClearedAuthCookie,
  createInviteToken,
  createToken,
  hashInviteToken,
  hashPassword,
  verifyPassword
} from '../lib/auth.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getMembershipsForEmployee } from '../lib/permissions.js';
import {
  normalizeEmail,
  validatePasswordResetRequestInput,
  validateRegistrationInput,
  validateSelfProfileInput
} from '../lib/validation.js';
import {
  inviteAcceptLimiter,
  loginLimiter,
  passwordLimiter,
  passwordResetRequestLimiter,
  registerLimiter
} from '../lib/rateLimit.js';
import { persistSingleImage } from '../lib/media.js';
import {
  buildMagicLinkUrl,
  deliverMagicLinkEmail,
  isEmailDeliveryReady,
  shouldAllowManualTokenPreview
} from '../lib/resetDelivery.js';
import { handleUnexpectedError } from '../lib/http.js';
import { env } from '../config/env.js';

const INVITE_TTL_HOURS = 72;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, reset instructions have been prepared.';
const router = Router();

function buildPreviewPayload(token, facilityId) {
  if (!shouldAllowManualTokenPreview()) {
    return {};
  }

  return {
    inviteToken: token,
    inviteUrl: buildMagicLinkUrl(token, facilityId),
    expiresInHours: INVITE_TTL_HOURS
  };
}

function buildResetResponse({ delivered, token, facilityId, mode }) {
  return {
    ok: true,
    message: delivered
      ? 'If an account exists for that email, a reset email has been sent.'
      : GENERIC_RESET_MESSAGE,
    deliveryMode: mode,
    ...buildPreviewPayload(token, facilityId)
  };
}

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  try {
    const result = await query(
      `
        select id, company_id, company_role, email, full_name, password_hash, must_change_password, profile_image_url, phone, address_line_1, address_line_2, city, state, postal_code, token_version
        from employees
        where lower(email) = lower($1)
        limit 1
      `,
      [normalizedEmail]
    );

    const employee = result.rows[0];
    if (!employee) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = employee?.password_hash
      ? await verifyPassword(password, employee.password_hash || '')
      : false;
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const memberships = await getMembershipsForEmployee(employee.id);
    const token = createToken(employee);
    res.setHeader('Set-Cookie', buildAuthCookie(token));

    return res.json({
      token,
      employee: {
        id: employee.id,
        company_id: employee.company_id,
        company_role: employee.company_role,
        email: employee.email,
        full_name: employee.full_name,
        must_change_password: employee.must_change_password,
        profile_image_url: employee.profile_image_url,
        phone: employee.phone,
        address_line_1: employee.address_line_1,
        address_line_2: employee.address_line_2,
        city: employee.city,
        state: employee.state,
        postal_code: employee.postal_code
      },
      memberships,
      mustChangePassword: employee.must_change_password
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const memberships = await getMembershipsForEmployee(req.employee.id);
    return res.json({
      employee: req.employee,
      memberships,
      mustChangePassword: req.employee.must_change_password
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/register', registerLimiter, async (req, res) => {
  if (!env.allowPublicRegistration) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { email, fullName, password } = req.body;

  try {
    const validationError = validateRegistrationInput({ email, fullName, password });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      `
        insert into employees (email, full_name, password_hash, must_change_password)
        values ($1, $2, $3, false)
        returning id, email, full_name, profile_image_url, created_at
      `,
      [normalizeEmail(email), fullName, passwordHash]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An employee with that email already exists' });
    }

    return handleUnexpectedError(res, error);
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  const {
    email,
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    profileImage
  } = req.body;

  try {
    const validationError = validateSelfProfileInput({
      email,
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const profileImageUrl = await persistSingleImage(profileImage, {
      entityType: 'profiles',
      existingUrl: req.employee.profile_image_url
    });

    const result = await query(
      `
        update employees
        set email = $2,
            full_name = $3,
            phone = $4,
            address_line_1 = $5,
            address_line_2 = $6,
            city = $7,
            state = $8,
            postal_code = $9,
            profile_image_url = $10
        where id = $1
        returning id, email, full_name, must_change_password, profile_image_url, phone, address_line_1, address_line_2, city, state, postal_code
      `,
      [
        req.employee.id,
        normalizeEmail(email),
        fullName.trim(),
        phone?.trim() || null,
        addressLine1?.trim() || null,
        addressLine2?.trim() || null,
        city?.trim() || null,
        state?.trim() || null,
        postalCode?.trim() || null,
        profileImageUrl
      ]
    );

    return res.json({ employee: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An employee with that email already exists' });
    }

    return handleUnexpectedError(res, error);
  }
});

router.post('/change-password', requireAuth, passwordLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const result = await query(
      `
        select id, company_id, company_role, email, token_version, password_hash
        from employees
        where id = $1
        limit 1
      `,
      [req.employee.id]
    );

    const employee = result.rows[0];
    const valid = await verifyPassword(currentPassword || '', employee?.password_hash || '');
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await hashPassword(newPassword);
    const updateResult = await query(
      `
        update employees
        set password_hash = $2,
            must_change_password = false,
            token_version = coalesce(token_version, 0) + 1
        where id = $1
        returning id, email, token_version
      `,
      [req.employee.id, passwordHash]
    );

    const refreshedEmployee = updateResult.rows[0];
    const token = createToken(refreshedEmployee);
    res.setHeader('Set-Cookie', buildAuthCookie(token));

    return res.json({ ok: true, token });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/invitations/accept', inviteAcceptLimiter, async (req, res) => {
  const { token, password } = req.body;

  try {
    if (typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ error: 'Valid invite token is required' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = hashInviteToken(token);
    const passwordHash = await hashPassword(password);
    const client = await connect();

    try {
      await client.query('begin');

      const consumeResult = await client.query(
        `
          update invite_tokens it
          set used_at = now()
          from employees e
          where it.token_hash = $1
            and it.employee_id = e.id
            and it.used_at is null
            and it.expires_at > now()
          returning it.id, it.employee_id, it.facility_id, e.email
        `,
        [tokenHash]
      );

      const invite = consumeResult.rows[0];
      if (!invite) {
        const existingResult = await client.query(
          `
            select used_at, expires_at
            from invite_tokens
            where token_hash = $1
            limit 1
          `,
          [tokenHash]
        );

        await client.query('rollback');

        const existingInvite = existingResult.rows[0];
        if (!existingInvite) {
          return res.status(404).json({ error: 'Invite not found' });
        }

        if (existingInvite.used_at) {
          return res.status(400).json({ error: 'This invite has already been used' });
        }

        return res.status(400).json({ error: 'This invite has expired' });
      }

      await client.query(
        `
          update employees
          set password_hash = $2,
              must_change_password = false,
              token_version = coalesce(token_version, 0) + 1
          where id = $1
        `,
        [invite.employee_id, passwordHash]
      );

      await client.query(
        `
          insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
          values ($1, $2, $3, $4, $5)
        `,
        [invite.employee_id, 'invite.accept', invite.facility_id, invite.employee_id, { email: invite.email }]
      );

      await client.query('commit');
      return res.json({ ok: true });
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

router.post('/invitations/request-reset', passwordResetRequestLimiter, async (req, res) => {
  const { email, facilityId } = req.body;

  try {
    const validationError = validatePasswordResetRequestInput({ email });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (!isEmailDeliveryReady() && !shouldAllowManualTokenPreview()) {
      return res.status(503).json({ error: 'Password reset delivery is not configured.' });
    }

    const employeeResult = await query(
      `
        select id, email, full_name
        from employees
        where email = $1
        limit 1
      `,
      [normalizeEmail(email)]
    );

    const employee = employeeResult.rows[0];
    if (!employee) {
      return res.json({ ok: true, message: GENERIC_RESET_MESSAGE });
    }

    const membershipResult = await query(
      `
        select facility_id
        from facility_memberships
        where employee_id = $1
          and ($2::uuid is null or facility_id = $2::uuid)
        order by created_at asc
        limit 1
      `,
      [employee.id, facilityId || null]
    );

    const membership = membershipResult.rows[0];
    if (!membership) {
      return res.json({ ok: true, message: GENERIC_RESET_MESSAGE });
    }

    const inviteToken = createInviteToken();
    const tokenHash = hashInviteToken(inviteToken);

    await query(
      `
        insert into invite_tokens (employee_id, course_id, token_hash, created_by_employee_id, expires_at)
        values ($1, $2, $3, null, now() + ($4 || ' hours')::interval)
      `,
      [employee.id, membership.facility_id, tokenHash, String(INVITE_TTL_HOURS)]
    );

    await query(
    `
      insert into audit_logs (actor_employee_id, action, facility_id, target_employee_id, detail)
      values ($1, $2, $3, $4, $5)
    `,
    [employee.id, 'password.reset.request', membership.facility_id, employee.id, { email: employee.email }]
    );

    const delivery = await deliverMagicLinkEmail({
      to: employee.email,
      fullName: employee.full_name,
      token: inviteToken,
      facilityId: membership.facility_id,
      purpose: 'reset'
    });

    return res.json(buildResetResponse({
      delivered: delivery.delivered,
      token: inviteToken,
      facilityId: membership.facility_id,
      mode: delivery.mode
    }));
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', buildClearedAuthCookie());
  return res.json({ ok: true });
});

export default router;
