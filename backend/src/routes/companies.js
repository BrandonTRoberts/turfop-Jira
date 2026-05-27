import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { isCompanySuperUser, isGlobalSuperUser } from '../lib/permissions.js';
import { validateCompanyInput } from '../lib/validation.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    if (isGlobalSuperUser(req.employee)) {
      const result = await query(
        `
          select id, name, created_at
          from companies
          order by name asc
        `
      );

      return res.json(result.rows);
    }

    if (!isCompanySuperUser(req.employee) || !req.employee.company_id) {
      return res.status(403).json({ error: 'Company or platform admin access required' });
    }

    const result = await query(
      `
        select id, name, created_at
        from companies
        where id = $1
        limit 1
      `,
      [req.employee.company_id]
    );

    return res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body;

  try {
    if (!isGlobalSuperUser(req.employee)) {
      return res.status(403).json({ error: 'Only Platform Admins can add new facilities or businesses. Contact support or your account manager to expand your account.' });
    }

    const validationError = validateCompanyInput({ name });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await query(
      `
        insert into companies (name)
        values ($1)
        returning id, name, created_at
      `,
      [name.trim()]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:companyId', requireAuth, async (req, res) => {
  const { companyId } = req.params;
  const force = String(req.query?.force || '').toLowerCase() === 'true';

  try {
    if (!isGlobalSuperUser(req.employee)) {
      return res.status(403).json({ error: 'Only Platform Admins can remove businesses.' });
    }

    const client = await connect();
    try {
      await client.query('begin');

      const companyResult = await client.query('select id, name from companies where id = $1 limit 1', [companyId]);
      const company = companyResult.rows[0];
      if (!company) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Business not found' });
      }

      const facilitiesCountResult = await client.query('select count(*)::int as count from facilities where company_id = $1', [companyId]);
      const usersCountResult = await client.query('select count(*)::int as count from employees where company_id = $1', [companyId]);
      const facilitiesCount = Number(facilitiesCountResult.rows[0]?.count || 0);
      const usersCount = Number(usersCountResult.rows[0]?.count || 0);

      if (facilitiesCount > 0) {
        await client.query('rollback');
        return res.status(409).json({
          error: `Cannot delete business while facilities still exist (${facilitiesCount}). Remove facilities first.`,
          facilitiesCount,
          usersCount,
        });
      }

      if (usersCount > 0 && !force) {
        await client.query('rollback');
        return res.status(409).json({
          error: `Business still has ${usersCount} user account(s). Retry with force=true to remove users and delete the business.`,
          facilitiesCount,
          usersCount,
        });
      }

      if (usersCount > 0 && force) {
        await client.query('delete from employees where company_id = $1', [companyId]);
      }

      await client.query('delete from companies where id = $1', [companyId]);
      await client.query('commit');
      return res.status(204).send();
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error?.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete business while dependent records still exist. Remove facilities first, then retry with force delete for users if needed.' });
    }
    return handleUnexpectedError(res, error);
  }
});

export default router;
