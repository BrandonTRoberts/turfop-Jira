import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function createToken(employee) {
  return jwt.sign(
    {
      sub: employee.id,
      email: employee.email,
      tv: Number(employee.token_version || 0)
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtTtl,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience
    }
  );
}

export function createInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function hashInviteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function readBearerToken(header = '') {
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export function readCookieValue(cookieHeader = '', cookieName = env.authCookieName) {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.slice(cookieName.length + 1));
}

export function buildAuthCookie(token) {
  const parts = [
    `${env.authCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`
  ];

  if (env.isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildClearedAuthCookie() {
  const parts = [
    `${env.authCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];

  if (env.isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });
}
