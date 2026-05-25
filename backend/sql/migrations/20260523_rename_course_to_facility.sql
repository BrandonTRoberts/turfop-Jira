-- Rename facility tables and columns to facility
ALTER TABLE IF EXISTS facilities RENAME TO facilities;
ALTER TABLE IF EXISTS facility_memberships RENAME TO facility_memberships;
ALTER TABLE IF EXISTS course_areas RENAME TO facility_areas;

-- Rename columns in employees, equipment, inventory, work orders, etc.
ALTER TABLE IF EXISTS employees RENAME COLUMN facility_id TO facility_id;
ALTER TABLE IF EXISTS employees RENAME COLUMN default_course_id TO default_facility_id;

-- Try to catch other common tables
DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'facility_id' AND table_schema = 'public' LOOP
    EXECUTE 'ALTER TABLE ' || t || ' RENAME COLUMN facility_id TO facility_id';
  END LOOP;
END $$;
