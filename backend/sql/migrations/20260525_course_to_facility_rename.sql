-- 20260525_course_to_facility_rename.sql
-- Purpose: Real rename from course terminology to facility terminology.
-- Notes:
-- - Uses ALTER TABLE ... RENAME to preserve data.
-- - Keeps constraints intact (constraint names may still mention "course"; that's OK).
-- - Renames key foreign-key columns (course_id -> facility_id) across dependent tables.
-- - Safe to run once; includes IF EXISTS guards where possible.

begin;

-- 1) Core tables
-- Rename courses -> facilities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='courses')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='facilities') THEN
    EXECUTE 'ALTER TABLE courses RENAME TO facilities';
  END IF;
END $$;

-- Rename course_memberships -> facility_memberships
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='course_memberships')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='facility_memberships') THEN
    EXECUTE 'ALTER TABLE course_memberships RENAME TO facility_memberships';
  END IF;
END $$;

-- 2) Column renames (course_id -> facility_id)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND column_name='course_id'
      AND table_name IN (
        'facility_memberships',
        'work_orders',
        'equipment',
        'parts_inventory',
        'audit_logs',
        'employee_time_entries',
        'work_order_activity'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I RENAME COLUMN course_id TO facility_id', r.table_name);
  END LOOP;
END $$;

-- 3) Column renames on employees (default_course_id -> default_facility_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='employees' AND column_name='default_course_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='employees' AND column_name='default_facility_id'
  ) THEN
    EXECUTE 'ALTER TABLE employees RENAME COLUMN default_course_id TO default_facility_id';
  END IF;
END $$;

-- 4) Index renames (optional, cosmetic). Keep it minimal/safe.
-- Rename common indexes if present; ignore if they don't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_course_memberships_course_id') THEN
    EXECUTE 'ALTER INDEX idx_course_memberships_course_id RENAME TO idx_facility_memberships_facility_id';
  END IF;
EXCEPTION WHEN others THEN
  -- ignore
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_work_orders_course_id') THEN
    EXECUTE 'ALTER INDEX idx_work_orders_course_id RENAME TO idx_work_orders_facility_id';
  END IF;
EXCEPTION WHEN others THEN
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_equipment_course_id') THEN
    EXECUTE 'ALTER INDEX idx_equipment_course_id RENAME TO idx_equipment_facility_id';
  END IF;
EXCEPTION WHEN others THEN
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_parts_inventory_course_id') THEN
    EXECUTE 'ALTER INDEX idx_parts_inventory_course_id RENAME TO idx_parts_inventory_facility_id';
  END IF;
EXCEPTION WHEN others THEN
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_audit_logs_course_id_created_at') THEN
    EXECUTE 'ALTER INDEX idx_audit_logs_course_id_created_at RENAME TO idx_audit_logs_facility_id_created_at';
  END IF;
EXCEPTION WHEN others THEN
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_work_order_activity_course_id_created_at') THEN
    EXECUTE 'ALTER INDEX idx_work_order_activity_course_id_created_at RENAME TO idx_work_order_activity_facility_id_created_at';
  END IF;
EXCEPTION WHEN others THEN
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_employee_time_entries_course_id_clock_in_at') THEN
    EXECUTE 'ALTER INDEX idx_employee_time_entries_course_id_clock_in_at RENAME TO idx_employee_time_entries_facility_id_clock_in_at';
  END IF;
EXCEPTION WHEN others THEN
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='idx_employee_time_entries_open_shift') THEN
    EXECUTE 'ALTER INDEX idx_employee_time_entries_open_shift RENAME TO idx_employee_time_entries_open_shift_facility';
  END IF;
EXCEPTION WHEN others THEN
END $$;

commit;
