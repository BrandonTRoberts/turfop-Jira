import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(req) {
  const originHeader = req.headers.origin;
  if (originHeader) return normalizeOrigin(originHeader);

  const refererHeader = req.headers.referer;
  return normalizeOrigin(refererHeader);
}

function hasAuthCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) return false;
  return cookieHeader.split(';').some((part) => part.trim().startsWith(`${env.authCookieName}=`));
}

function getAllowedOrigins() {
  const configured = new Set(env.allowedCorsOrigins.map((origin) => normalizeOrigin(origin)).filter(Boolean));
  const appOrigin = normalizeOrigin(env.appBaseUrl);
  if (appOrigin) configured.add(appOrigin);
  return configured;
}

export function csrfCookieProtection(req, res, next) {
  if (env.isTest) return next();
  if (SAFE_METHODS.has(req.method)) return next();

  // CSRF matters when browser-managed auth cookies are in play.
  if (!hasAuthCookie(req)) return next();

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) {
    return res.status(403).json({ error: 'Missing request origin' });
  }

  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({ error: 'Invalid request origin' });
  }

  return next();
}
