import { query } from './db.js';
import { readBearerToken, readCookieValue, verifyToken } from './auth.js';

export async function requireAuth(req, res, next) {
  try {
    const token = readBearerToken(req.headers.authorization || '') || readCookieValue(req.headers.cookie || '');

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const payload = verifyToken(token);
    const result = await query(
      `
        select id, company_id, company_role, email, full_name, must_change_password, profile_image_url, phone, address_line_1, address_line_2, city, state, postal_code, token_version
        from employees
        where id = $1
        limit 1
      `,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Employee not found' });
    }

    const employee = result.rows[0];

    if (Number(employee.token_version || 0) !== Number(payload.tv || 0)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
