import { Router } from 'express';
import { query } from '../lib/db.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'healthy'
  });
});

router.get('/db', async (_req, res) => {
  try {
    const result = await query('select now() as server_time');
    res.json({
      ok: true,
      database: 'connected',
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    return handleUnexpectedError(res, error, { ok: false });
  }
});

export default router;
