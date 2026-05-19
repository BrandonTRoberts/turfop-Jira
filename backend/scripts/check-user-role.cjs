const path = require('path');
// This will load .env file from the backend directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/check-user-role.js <email>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const checkUserRole = async () => {
  try {
    const res = await pool.query('SELECT company_role FROM employees WHERE email = $1', [email]);
    if (res.rows.length === 0) {
      console.log(`User not found: ${email}`);
    } else {
      console.log(`Role for ${email}:`, res.rows[0].company_role);
    }
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await pool.end();
  }
};

checkUserRole();
