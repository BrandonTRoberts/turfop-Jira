import { Router } from 'express';
import { query } from '../lib/db.js';
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

export default router;
