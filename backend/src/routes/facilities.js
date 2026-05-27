import { Router } from 'express';
import { connect, query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getMembershipsForEmployee, getRoleForFacility, isAdmin, isCompanySuperUser, isGlobalSuperUser } from '../lib/permissions.js';
import { validateCourseCreateInput as validateFacilityCreateInput, validateCourseSettingsInput as validateFacilitySettingsInput } from '../lib/validation.js';
import { handleUnexpectedError } from '../lib/http.js';

const router = Router();

const defaultCourseAreas = [
  { name: 'Greens', trackedCount: 18, note: 'Daily cut and moisture logs' },
  { name: 'Tees', trackedCount: 36, note: 'Rotation and divot repair' },
  { name: 'Fairways', trackedCount: 18, note: 'Mow and irrigation coverage' },
  { name: 'Bunkers', trackedCount: 42, note: 'Edges, sand depth, drainage' },
  { name: 'Practice areas', trackedCount: 3, note: 'High wear monitoring' }
];

function normalizeCourseAreas(courseAreas) {
  if (!Array.isArray(courseAreas) || courseAreas.length === 0) {
    return defaultCourseAreas;
  }

  return courseAreas.map((area) => ({
    name: area.name.trim(),
    trackedCount: Number(area.trackedCount),
    note: area.note?.trim() || ''
  }));
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const memberships = await getMembershipsForEmployee(req.employee.id);
    return res.json(memberships);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { companyId, name, region, superintendentName, courseAreas } = req.body;

  try {
    if (!isGlobalSuperUser(req.employee)) {
      return res.status(403).json({ error: 'Only Platform Admins can add new facilities or businesses. Contact support or your account manager to expand your account.' });
    }

    const validationError = validateFacilityCreateInput({ companyId, name, region, superintendentName });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const companyExists = await query(
      `
        select id, name
        from companies
        where id = $1
        limit 1
      `,
      [companyId]
    );

    if (!companyExists.rows.length) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const result = await query(
      `
        insert into facilities (company_id, name, region, superintendent_name, course_areas_config)
        values ($1, $2, $3, $4, $5::jsonb)
        returning id, company_id, name, region, superintendent_name, course_areas_config, created_at
      `,
      [companyId, name.trim(), region?.trim() || null, superintendentName?.trim() || null, JSON.stringify(normalizeCourseAreas(courseAreas))]
    );

    return res.status(201).json({
      ...result.rows[0],
      company_name: companyExists.rows[0].name
    });
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:facilityId', requireAuth, async (req, res) => {
  const { facilityId } = req.params;
  const { name, region, superintendentName, courseAreas } = req.body;

  try {
    const currentRole = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this facility' });
    }

    const validationError = validateFacilitySettingsInput({ name, region, superintendentName, courseAreas });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await query(
      `
        update facilities
        set name = $2,
            region = $3,
            superintendent_name = $4,
            course_areas_config = $5::jsonb
        where id = $1
        returning id, company_id, name, region, superintendent_name, course_areas_config, created_at
      `,
      [facilityId, name.trim(), region?.trim() || null, superintendentName?.trim() || null, JSON.stringify(normalizeCourseAreas(courseAreas))]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:facilityId', requireAuth, async (req, res) => {
  const { facilityId } = req.params;

  try {
    if (!isGlobalSuperUser(req.employee)) {
      return res.status(403).json({ error: 'Only Platform Admins can remove facilities.' });
    }

    const client = await connect();
    try {
      await client.query('begin');

      const facilityResult = await client.query('select id, company_id from facilities where id = $1 limit 1', [facilityId]);
      const facility = facilityResult.rows[0];
      if (!facility) {
        await client.query('rollback');
        return res.status(404).json({ error: 'Facility not found' });
      }

      const candidateEmployeesResult = await client.query(
        `
          select distinct fm.employee_id
          from facility_memberships fm
          where fm.facility_id = $1
        `,
        [facilityId]
      );
      const candidateEmployeeIds = candidateEmployeesResult.rows.map((row) => row.employee_id);

      await client.query('delete from facilities where id = $1', [facilityId]);

      if (candidateEmployeeIds.length) {
        await client.query(
          `
            delete from employees e
            where e.id = any($1::uuid[])
              and coalesce(e.company_role, '') <> 'platform_admin'
              and not exists (
                select 1
                from facility_memberships fm
                where fm.employee_id = e.id
              )
          `,
          [candidateEmployeeIds]
        );
      }

      await client.query('commit');
      return res.status(204).send();
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error?.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete facility while dependent records exist. Remove related data first.' });
    }
    return handleUnexpectedError(res, error);
  }
});



router.get('/:facilityId/locations', requireAuth, async (req, res) => {
  const { facilityId } = req.params;
  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!role) return res.status(403).json({ error: 'No access to this facility' });
    const result = await query('select * from facility_locations where facility_id=$1 and is_archived=false order by name asc', [facilityId]);
    return res.json(result.rows);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.post('/:facilityId/locations', requireAuth, async (req, res) => {
  const { facilityId } = req.params;
  const { name, locationType = 'section', notes = '' } = req.body;
  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(role)) return res.status(403).json({ error: 'Admin access required for this facility' });
    const result = await query('insert into facility_locations (facility_id, name, location_type, notes, created_by_employee_id, updated_by_employee_id) values ($1,$2,$3,$4,$5,$5) returning *', [facilityId, name, locationType, notes || null, req.employee.id]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.patch('/:facilityId/locations/:locationId', requireAuth, async (req, res) => {
  const { facilityId, locationId } = req.params;
  const { name, locationType = 'section', notes = '', isArchived = false } = req.body;
  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(role)) return res.status(403).json({ error: 'Admin access required for this facility' });
    const result = await query('update facility_locations set name=$3, location_type=$4, notes=$5, is_archived=$6, updated_by_employee_id=$7, updated_at=now() where id=$1 and facility_id=$2 returning *', [locationId, facilityId, name, locationType, notes || null, isArchived, req.employee.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Location not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

router.delete('/:facilityId/locations/:locationId', requireAuth, async (req, res) => {
  const { facilityId, locationId } = req.params;
  try {
    const role = await getRoleForFacility(req.employee, facilityId);
    if (!isAdmin(role)) return res.status(403).json({ error: 'Admin access required for this facility' });
    await query('delete from facility_locations where id=$1 and facility_id=$2', [locationId, facilityId]);
    return res.status(204).send();
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
