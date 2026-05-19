import rateLimit from 'express-rate-limit';

function jsonRateLimit(handlerName, windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: `Too many ${handlerName} attempts. Please try again later.` }
  });
}

export const loginLimiter = jsonRateLimit('login', 15 * 60 * 1000, 10);
export const registerLimiter = jsonRateLimit('registration', 60 * 60 * 1000, 10);
export const passwordLimiter = jsonRateLimit('password change', 15 * 60 * 1000, 10);
export const passwordResetRequestLimiter = jsonRateLimit('password reset request', 15 * 60 * 1000, 10);
export const inviteAcceptLimiter = jsonRateLimit('invite acceptance', 15 * 60 * 1000, 20);
