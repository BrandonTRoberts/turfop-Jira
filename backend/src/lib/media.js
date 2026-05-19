import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const mimeToExtension = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
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

function validateMagicBytes(buffer, mimeType) {
  const validators = {
    'image/jpeg': isJpeg,
    'image/png': isPng,
    'image/gif': isGif,
    'image/webp': isWebp
  };

  const validator = validators[mimeType];
  if (!validator || !validator(buffer)) {
    throw new Error('Uploaded file content does not match the declared image type');
  }
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw new Error('Image payload must be a data URL');
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Unsupported image payload format');
  }

  const [, mimeType, encoded] = match;
  const extension = mimeToExtension[mimeType];
  if (!extension) {
    throw new Error('Only JPG, PNG, WEBP, and GIF images are supported');
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Each image must be 5 MB or smaller');
  }

  validateMagicBytes(buffer, mimeType);

  return { extension, buffer };
}

async function saveDataUrlImage(dataUrl, entityType = 'asset') {
  const { extension, buffer } = parseDataUrl(dataUrl);
  const directory = path.join(UPLOADS_DIR, entityType);
  await mkdir(directory, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), buffer, { mode: 0o644 });
  return `/uploads/${entityType}/${filename}`;
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
      if (item.startsWith('/uploads/')) {
        urls.push(item);
        continue;
      }

      if (item.startsWith('data:image/')) {
        urls.push(await saveDataUrlImage(item, entityType));
        continue;
      }
    }

    if (typeof item === 'object') {
      if (typeof item.url === 'string' && item.url.startsWith('/uploads/')) {
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

export async function persistSingleImage(input, { entityType = 'asset' } = {}) {
  if (!input) return null;
  const urls = await persistImageCollection([input], { entityType, maxCount: 1 });
  return urls[0] || null;
}
