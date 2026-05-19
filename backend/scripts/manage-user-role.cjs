const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');

const email = process.argv[2];
const newRole = process.argv[3];

if (!email || !newRole) {
  console.error('Usage: node scripts/manage-user-role.cjs <email> <newRole>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const updateUserRole = async () => {
  try {
    const res = await pool.query('UPDATE employees SET company_role = $1 WHERE email = $2 RETURNING *', [newRole, email]);
    if (res.rowCount === 0) {
      console.log(`User not found: ${email}`);
    } else {
      console.log(`Successfully updated role for ${email} to ${newRole}.`);
      console.log('Updated user:', res.rows[0]);
    }
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await pool.end();
  }
};

updateUserRole();
