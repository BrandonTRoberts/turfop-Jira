import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import employeesRouter from './routes/employees.js';
import facilitiesRouter from './routes/facilities.js';
import workOrdersRouter from './routes/workOrders.js';
import equipmentRouter from './routes/equipment.js';
import partsInventoryRouter from './routes/partsInventory.js';
import reportsRouter from './routes/reports.js';
import auditLogsRouter from './routes/auditLogs.js';
import timeEntriesRouter from './routes/timeEntries.js';
import companiesRouter from './routes/companies.js';
import dashboardRouter from './routes/dashboard.js';
import serviceTemplatesRouter from './routes/serviceTemplates.js';
import { UPLOADS_DIR } from './lib/media.js';
import { env } from './config/env.js';
import { csrfCookieProtection } from './lib/csrf.js';

function buildContentSecurityPolicy() {
  const connectSrc = ["'self'", ...env.allowedCorsOrigins];

  if (!env.isProduction) {
    connectSrc.push('ws://localhost:*', 'ws://127.0.0.1:*');
  }

  return {
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc,
      formAction: ["'self'"],
      upgradeInsecureRequests: env.isProduction ? [] : null
    }
  };
}

function buildCorsOptions() {
  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (env.allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin denied'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
    maxAge: 600
  };
}

export function createApp() {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    contentSecurityPolicy: buildContentSecurityPolicy()
  }));
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '10mb' }));
  app.use(csrfCookieProtection);
  app.use('/uploads', express.static(UPLOADS_DIR, {
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'TurfOp API',
      status: 'running'
    });
  });

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/employees', employeesRouter);
  app.use('/facilities', facilitiesRouter);
  app.use('/work-orders', workOrdersRouter);
  app.use('/equipment', equipmentRouter);
  app.use('/parts-inventory', partsInventoryRouter);
  app.use('/reports', reportsRouter);
  app.use('/audit-logs', auditLogsRouter);
  app.use('/time-entries', timeEntriesRouter);
  app.use('/companies', companiesRouter);
  app.use('/dashboard', dashboardRouter);
  app.use('/service-templates', serviceTemplatesRouter);

  app.use((error, req, res, _next) => {
    if (error?.message === 'CORS origin denied') {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    const statusCode = Number(error?.statusCode || error?.status || 500);

    if (statusCode === 404) {
      if (req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'File not found' });
      }

      return res.status(404).json({ error: 'Not found' });
    }

    console.error(error);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
