#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { UPLOADS_DIR } from '../src/lib/media.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const queries = [
  {
    name: 'employees.profile_image_url',
    sql: `select id::text as record_id, profile_image_url as media from employees where profile_image_url is not null and profile_image_url <> ''`
  },
  {
    name: 'work_orders.image_urls',
    sql: `select id::text as record_id, jsonb_array_elements_text(image_urls) as media from work_orders where jsonb_array_length(image_urls) > 0`
  },
  {
    name: 'equipment.image_urls',
    sql: `select id::text as record_id, jsonb_array_elements_text(image_urls) as media from equipment where jsonb_array_length(image_urls) > 0`
  },
  {
    name: 'parts_inventory.image_urls',
    sql: `select id::text as record_id, jsonb_array_elements_text(image_urls) as media from parts_inventory where jsonb_array_length(image_urls) > 0`
  }
];

function isLocalUpload(mediaUrl) {
  return typeof mediaUrl === 'string' && mediaUrl.startsWith('/uploads/');
}

function localPathFromUrl(mediaUrl) {
  const relative = mediaUrl.replace('/uploads/', '');
  return path.join(UPLOADS_DIR, relative);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  await client.connect();

  const missing = [];
  let checked = 0;
  let localChecked = 0;

  for (const q of queries) {
    const res = await client.query(q.sql);
    for (const row of res.rows) {
      const mediaUrl = row.media;
      checked += 1;
      if (!isLocalUpload(mediaUrl)) continue;

      localChecked += 1;
      const localPath = localPathFromUrl(mediaUrl);
      const ok = await exists(localPath);
      if (!ok) {
        missing.push({
          source: q.name,
          recordId: row.record_id,
          mediaUrl,
          localPath
        });
      }
    }
  }

  await client.end();

  console.log(JSON.stringify({
    checked,
    localChecked,
    uploadsDir: UPLOADS_DIR,
    missingCount: missing.length,
    missing
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error.message || error);
  try { await client.end(); } catch {}
  process.exit(1);
});
