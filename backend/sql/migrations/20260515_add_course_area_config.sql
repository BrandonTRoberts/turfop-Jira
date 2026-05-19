alter table courses
add column if not exists course_areas_config jsonb not null default '[]'::jsonb;
