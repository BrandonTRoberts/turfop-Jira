import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configuredUploadsDir = process.env.UPLOADS_DIR;
export const UPLOADS_DIR = configuredUploadsDir
  ? path.resolve(configuredUploadsDir)
  : path.resolve(__dirname, '../../uploads');

const MEDIA_PUBLIC_BASE_URL = (process.env.MEDIA_PUBLIC_BASE_URL || '').replace(/\/$/, '');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const mimeToExtension = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
};

function isJpeg(buffer) {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer) {
  return buffer.length > 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
}

function isGif(buffer) {
  const header = buffer.subarray(0, 6).toString('ascii');
  return header === 'GIF87a' || header === 'GIF89a';
}

function isWebp(buffer) {
  return buffer.length > 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

function isHeifFamily(buffer) {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
    return false;
  }

  const brandBytes = buffer.subarray(8, Math.min(buffer.length, 64)).toString('ascii');
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heif'].some((brand) => brandBytes.includes(brand));
}

function isPdf(buffer) {
  return buffer.length > 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF';
}

function isZipBasedOffice(buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function isOleOffice(buffer) {
  return buffer.length > 8
    && buffer[0] === 0xd0
    && buffer[1] === 0xcf
    && buffer[2] === 0x11
    && buffer[3] === 0xe0
    && buffer[4] === 0xa1
    && buffer[5] === 0xb1
    && buffer[6] === 0x1a
    && buffer[7] === 0xe1;
}

function isTextLike(buffer) {
  return !buffer.subarray(0, Math.min(buffer.length, 512)).includes(0);
}

function validateMagicBytes(buffer, mimeType) {
  const validators = {
    'image/jpeg': isJpeg,
    'image/png': isPng,
    'image/gif': isGif,
    'image/webp': isWebp,
    'image/heic': isHeifFamily,
    'image/heif': isHeifFamily,
    'application/pdf': isPdf,
    'application/msword': isOleOffice,
    'application/vnd.ms-excel': isOleOffice,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': isZipBasedOffice,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': isZipBasedOffice,
    'text/plain': isTextLike,
    'text/csv': isTextLike
  };

  const validator = validators[mimeType];
  if (!validator || !validator(buffer)) {
    throw new Error('Uploaded file content does not match the declared file type');
  }
}

function isPersistedMediaUrl(value) {
  return typeof value === 'string' && (
    value.startsWith('/uploads/')
    || value.startsWith('http://')
    || value.startsWith('https://')
  );
}

function buildStoredMediaUrl(entityType, filename) {
  if (MEDIA_PUBLIC_BASE_URL) {
    return `${MEDIA_PUBLIC_BASE_URL}/${entityType}/${filename}`;
  }

  return `/uploads/${entityType}/${filename}`;
}

function parseDataUrl(dataUrl, { imageOnly = true } = {}) {
  if (typeof dataUrl !== 'string') {
    throw new Error('File payload must be a data URL');
  }

  const match = dataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Unsupported file payload format');
  }

  const [, mimeType, encoded] = match;
  const extension = mimeToExtension[mimeType];
  if (!extension) {
    throw new Error('Unsupported file type');
  }

  if (imageOnly && !mimeType.startsWith('image/')) {
    throw new Error('Only image files are supported here');
  }

  const buffer = Buffer.from(encoded, 'base64');
  const maxBytes = imageOnly ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_BYTES;
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Each file must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`);
  }

  validateMagicBytes(buffer, mimeType);

  return { extension, buffer, mimeType, size: buffer.byteLength };
}

async function saveDataUrlFile(dataUrl, entityType = 'asset', options = {}) {
  const { extension, buffer, mimeType, size } = parseDataUrl(dataUrl, options);
  const directory = path.join(UPLOADS_DIR, entityType);
  await mkdir(directory, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), buffer, { mode: 0o644 });
  return { url: buildStoredMediaUrl(entityType, filename), mimeType, size };
}

async function saveDataUrlImage(dataUrl, entityType = 'asset') {
  const file = await saveDataUrlFile(dataUrl, entityType, { imageOnly: true });
  return file.url;
}

export async function persistImageCollection(inputs, { entityType = 'asset', maxCount = 6 } = {}) {
  if (!inputs) return [];
  if (!Array.isArray(inputs)) {
    throw new Error('Image collection must be an array');
  }
  if (inputs.length > maxCount) {
    throw new Error(`You can upload up to ${maxCount} images`);
  }

  const urls = [];
  for (const item of inputs) {
    if (!item) continue;

    if (typeof item === 'string') {
      if (isPersistedMediaUrl(item)) {
        urls.push(item);
        continue;
      }

      if (item.startsWith('data:image/')) {
        urls.push(await saveDataUrlImage(item, entityType));
        continue;
      }
    }

    if (typeof item === 'object') {
      if (isPersistedMediaUrl(item.url)) {
        urls.push(item.url);
        continue;
      }

      if (typeof item.dataUrl === 'string') {
        urls.push(await saveDataUrlImage(item.dataUrl, entityType));
        continue;
      }
    }

    throw new Error('Unsupported image item');
  }

  return urls;
}

export async function persistSingleImage(input, { entityType = 'asset', existingUrl = null } = {}) {
  if (input === undefined) return existingUrl;
  if (!input) return null;
  const urls = await persistImageCollection([input], { entityType, maxCount: 1 });
  return urls[0] || null;
}

export async function persistAttachmentCollection(inputs, { entityType = 'attachments', maxCount = 12 } = {}) {
  if (!inputs) return [];
  if (!Array.isArray(inputs)) {
    throw new Error('Attachment collection must be an array');
  }
  if (inputs.length > maxCount) {
    throw new Error(`You can upload up to ${maxCount} attachments`);
  }

  const attachments = [];
  for (const item of inputs) {
    if (!item) continue;

    if (typeof item === 'object' && isPersistedMediaUrl(item.url)) {
      attachments.push(item);
      continue;
    }

    if (typeof item === 'object' && typeof item.dataUrl === 'string') {
      const file = await saveDataUrlFile(item.dataUrl, entityType, { imageOnly: false });
      attachments.push({
        url: file.url,
        name: typeof item.name === 'string' ? item.name.slice(0, 180) : path.basename(file.url),
        mimeType: file.mimeType,
        size: file.size
      });
      continue;
    }

    throw new Error('Unsupported attachment item');
  }

  return attachments;
}
