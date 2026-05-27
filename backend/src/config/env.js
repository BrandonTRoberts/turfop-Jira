import dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

if (!isTest) {
  dotenv.config();
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === 'true';
}

function parseOrigins(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const jwtSecret = process.env.JWT_SECRET || (isTest ? 'test-jwt-secret-please-change' : '');
const databaseUrl = process.env.DATABASE_URL || (isTest ? 'postgresql://postgres:password@localhost:5432/greenkeeper_ops' : '');
const appBaseUrl = process.env.APP_BASE_URL || (isTest ? 'http://localhost:5173' : '');
const defaultOrigins = isProduction
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const allowedCorsOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS || '').length > 0
  ? parseOrigins(process.env.CORS_ALLOWED_ORIGINS)
  : defaultOrigins;

if (!isTest) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be configured');
  }

  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'replace-me-later') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }

  if (isProduction && allowedCorsOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production');
  }

  if (isProduction && !appBaseUrl) {
    throw new Error('APP_BASE_URL must be configured in production');
  }
}

export const env = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(process.env.PORT || 4000),
  databaseUrl,
  jwtSecret,
  jwtIssuer: process.env.JWT_ISSUER || 'turfops-api',
  jwtAudience: process.env.JWT_AUDIENCE || 'turfops-app',
  jwtTtl: process.env.JWT_TTL || '12h',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'turfops_session',
  appBaseUrl,
  allowPublicRegistration: parseBoolean(process.env.ALLOW_PUBLIC_REGISTRATION, false),
  allowManualTokenPreview: parseBoolean(process.env.ALLOW_MANUAL_TOKEN_PREVIEW, false),
  oneSignalAppId: process.env.ONESIGNAL_APP_ID || '',
  oneSignalApiKey: process.env.ONESIGNAL_API_KEY || '',
  allowedCorsOrigins
};
