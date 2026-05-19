import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function normalizeBaseUrl(url) {
  return (url || '').trim().replace(/\/$/, '');
}

export function buildMagicLinkUrl(token, courseId) {
  const baseUrl = normalizeBaseUrl(env.appBaseUrl || 'http://localhost:5173');
  const params = new URLSearchParams({ token });

  if (courseId) {
    params.set('courseId', courseId);
  }

  return `${baseUrl}/signin?${params.toString()}`;
}

export function isSmtpConfigured() {
  const hasCoreConfig = Boolean(
    process.env.SMTP_HOST
      && process.env.SMTP_PORT
      && process.env.SMTP_FROM
  );

  if (!hasCoreConfig) return false;

  const hasUser = Boolean(process.env.SMTP_USER);
  const hasPass = Boolean(process.env.SMTP_PASS);

  if (hasUser !== hasPass) {
    return false;
  }

  return true;
}

export function isEmailDeliveryReady() {
  return isSmtpConfigured();
}

export function shouldAllowManualTokenPreview() {
  return env.allowManualTokenPreview || env.isTest;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined
  });
}

function buildEmailBody({ recipientName, actionLabel, actionUrl }) {
  return {
    text: `Hi ${recipientName},\n\nUse this link to ${actionLabel} for TurfOp:\n\n${actionUrl}\n\nThis link expires in 72 hours. If you did not expect this email, you can ignore it.`,
    html: `<p>Hi ${recipientName},</p><p>Use this link to ${actionLabel} for TurfOp:</p><p><a href="${actionUrl}">${actionUrl}</a></p><p>This link expires in 72 hours. If you did not expect this email, you can ignore it.</p>`
  };
}

export async function deliverMagicLinkEmail({ to, fullName, token, courseId, purpose }) {
  const actionUrl = buildMagicLinkUrl(token, courseId);
  const recipientName = fullName?.trim() || 'there';

  if (!isEmailDeliveryReady()) {
    return {
      delivered: false,
      mode: shouldAllowManualTokenPreview() ? 'manual-preview' : 'unavailable',
      actionUrl
    };
  }

  const transporter = createTransport();
  const subject = purpose === 'invite'
    ? 'TurfOp account setup'
    : 'TurfOp password reset';
  const actionLabel = purpose === 'invite'
    ? 'finish setting up your account'
    : 'reset your password';
  const body = buildEmailBody({ recipientName, actionLabel, actionUrl });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: body.text,
    html: body.html
  });

  return {
    delivered: true,
    mode: 'smtp',
    actionUrl
  };
}
