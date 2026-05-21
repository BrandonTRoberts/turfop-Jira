#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/turfop',
});

async function seedDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to database. Seeding sample data...');

    // Clear existing data (for development only)
    await client.query('TRUNCATE TABLE work_orders, course_memberships, courses, employees, companies CASCADE;');

    // Create sample company
    const companyRes = await client.query(`
      INSERT INTO companies (name) VALUES ('Pine Valley Golf Club')
      RETURNING id;
    `);
    const companyId = companyRes.rows[0].id;

    // Create sample employees
    const employeeRes = await client.query(`
      INSERT INTO employees (company_id, email, full_name, password_hash, company_role, hourly_rate)
      VALUES 
        ($1, 'super@turfop.com', 'Brandon Roberts', '$2a$10$samplehash', 'company_super_user', 65.00),
        ($1, 'superintendent@turfop.com', 'Mike Thompson', '$2a$10$samplehash', null, 48.50),
        ($1, 'tech1@turfop.com', 'Sarah Chen', '$2a$10$samplehash', null, 32.00)
      RETURNING id, email;
    `, [companyId]);

    const employeeIds = employeeRes.rows.map(r => r.id);

    // Create sample course
    const courseRes = await client.query(`
      INSERT INTO courses (company_id, name, region, superintendent_name, course_areas_config)
      VALUES ($1, 'Pine Valley Course', 'Northeast', 'Mike Thompson', '["Fairways", "Greens", "Bunkers", "Rough"]'::jsonb)
      RETURNING id;
    `, [companyId]);
    const courseId = courseRes.rows[0].id;

    // Create course memberships
    await client.query(`
      INSERT INTO course_memberships (employee_id, course_id, role)
      VALUES 
        ($1, $2, 'admin'),
        ($3, $2, 'read_write'),
        ($4, $2, 'read_write')
    `, [employeeIds[0], courseId, employeeIds[1], employeeIds[2]]);

    // Create sample work orders (Jira-like)
    await client.query(`
      INSERT INTO work_orders (course_id, title, detail, status, assignee, due_at, technician_name)
      VALUES 
        ($1, 'Aerate Greens on Hole 7', 'Core aeration needed due to compaction. Target 3.5 inch depth.', 'In Progress', 'Mike Thompson', NOW() + INTERVAL '3 days', 'Sarah Chen'),
        ($1, 'Replace Broken Sprinkler Head - Hole 12', 'Head 12B is not rotating properly. Replace with Rain Bird 5000 series.', 'Open', 'Sarah Chen', NOW() + INTERVAL '1 day', 'Sarah Chen'),
        ($1, 'Topdress Fairways - Front 9', 'Apply 1/4 inch sand layer after verticutting.', 'Completed', 'Mike Thompson', NOW() - INTERVAL '2 days', 'Mike Thompson'),
        ($1, 'Inspect and Service Reel Mowers', 'Check all 5 Toro reels for blade sharpness and hydraulic fluid.', 'Open', null, NOW() + INTERVAL '5 days', null);
    `, [courseId]);

    console.log('✅ Seed completed successfully!');
    console.log(`   - Company: Pine Valley Golf Club`);
    console.log(`   - Course: Pine Valley Course`);
    console.log(`   - Employees seeded: 3`);
    console.log(`   - Work orders seeded: 4`);

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await client.end();
  }
}

seedDatabase();
