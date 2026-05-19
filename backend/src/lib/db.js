import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl
});

let queryOverride = null;
let connectOverride = null;

export function setDbTestOverrides({ queryImpl = null, connectImpl = null } = {}) {
  queryOverride = queryImpl;
  connectOverride = connectImpl;
}

export function resetDbTestOverrides() {
  queryOverride = null;
  connectOverride = null;
}

export async function query(text, params = []) {
  if (queryOverride) {
    return queryOverride(text, params);
  }

  return pool.query(text, params);
}

export async function connect() {
  if (connectOverride) {
    return connectOverride();
  }

  return pool.connect();
}
