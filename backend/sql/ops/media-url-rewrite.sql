-- Turfop media URL rewrite script
-- Usage example:
--   psql "$DATABASE_URL" -v OLD_BASE='/uploads' -v NEW_BASE='https://cdn.turfop.com/uploads' -f backend/sql/ops/media-url-rewrite.sql
--
-- Safety:
-- 1) run inside a transaction
-- 2) verify row counts in RETURNING clauses
-- 3) COMMIT only after sampling URLs

begin;

-- 1) Employees profile image URL
update employees
set profile_image_url = regexp_replace(profile_image_url, '^' || :'OLD_BASE', :'NEW_BASE')
where profile_image_url like :'OLD_BASE' || '/%';

-- 2) image_urls jsonb arrays (text URLs)
update work_orders w
set image_urls = mapped.new_arr
from (
  select id,
         jsonb_agg(to_jsonb(regexp_replace(value, '^' || :'OLD_BASE', :'NEW_BASE'))) as new_arr
  from work_orders,
       jsonb_array_elements_text(image_urls) as value
  group by id
) mapped
where w.id = mapped.id
  and exists (
    select 1
    from jsonb_array_elements_text(w.image_urls) v
    where v like :'OLD_BASE' || '/%'
  );

update equipment e
set image_urls = mapped.new_arr
from (
  select id,
         jsonb_agg(to_jsonb(regexp_replace(value, '^' || :'OLD_BASE', :'NEW_BASE'))) as new_arr
  from equipment,
       jsonb_array_elements_text(image_urls) as value
  group by id
) mapped
where e.id = mapped.id
  and exists (
    select 1
    from jsonb_array_elements_text(e.image_urls) v
    where v like :'OLD_BASE' || '/%'
  );

update parts_inventory p
set image_urls = mapped.new_arr
from (
  select id,
         jsonb_agg(to_jsonb(regexp_replace(value, '^' || :'OLD_BASE', :'NEW_BASE'))) as new_arr
  from parts_inventory,
       jsonb_array_elements_text(image_urls) as value
  group by id
) mapped
where p.id = mapped.id
  and exists (
    select 1
    from jsonb_array_elements_text(p.image_urls) v
    where v like :'OLD_BASE' || '/%'
  );

-- 3) attachments arrays (objects containing { url })
--    Rewrites only entries where attachment.url starts with OLD_BASE
update work_orders w
set attachments = mapped.new_attachments
from (
  select
    id,
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'object'
             and item ? 'url'
             and (item->>'url') like :'OLD_BASE' || '/%'
          then jsonb_set(item, '{url}', to_jsonb(regexp_replace(item->>'url', '^' || :'OLD_BASE', :'NEW_BASE')), false)
        else item
      end
    ) as new_attachments
  from work_orders,
       jsonb_array_elements(attachments) item
  group by id
) mapped
where w.id = mapped.id
  and exists (
    select 1
    from jsonb_array_elements(w.attachments) i
    where jsonb_typeof(i) = 'object'
      and i ? 'url'
      and (i->>'url') like :'OLD_BASE' || '/%'
  );

update equipment e
set attachments = mapped.new_attachments
from (
  select
    id,
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'object'
             and item ? 'url'
             and (item->>'url') like :'OLD_BASE' || '/%'
          then jsonb_set(item, '{url}', to_jsonb(regexp_replace(item->>'url', '^' || :'OLD_BASE', :'NEW_BASE')), false)
        else item
      end
    ) as new_attachments
  from equipment,
       jsonb_array_elements(attachments) item
  group by id
) mapped
where e.id = mapped.id
  and exists (
    select 1
    from jsonb_array_elements(e.attachments) i
    where jsonb_typeof(i) = 'object'
      and i ? 'url'
      and (i->>'url') like :'OLD_BASE' || '/%'
  );

update parts_inventory p
set attachments = mapped.new_attachments
from (
  select
    id,
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'object'
             and item ? 'url'
             and (item->>'url') like :'OLD_BASE' || '/%'
          then jsonb_set(item, '{url}', to_jsonb(regexp_replace(item->>'url', '^' || :'OLD_BASE', :'NEW_BASE')), false)
        else item
      end
    ) as new_attachments
  from parts_inventory,
       jsonb_array_elements(attachments) item
  group by id
) mapped
where p.id = mapped.id
  and exists (
    select 1
    from jsonb_array_elements(p.attachments) i
    where jsonb_typeof(i) = 'object'
      and i ? 'url'
      and (i->>'url') like :'OLD_BASE' || '/%'
  );

-- Optional verification samples
-- select id, profile_image_url from employees where profile_image_url like :'NEW_BASE' || '/%' limit 20;
-- select id, image_urls from work_orders where image_urls::text like '%' || :'NEW_BASE' || '/%' limit 20;

commit;
