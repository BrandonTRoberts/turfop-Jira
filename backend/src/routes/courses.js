import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/requireAuth.js';
import { getMembershipsForEmployee, getRoleForCourse, isAdmin, isCompanySuperUser, isGlobalSuperUser } from '../lib/permissions.js';
import { validateCourseCreateInput, validateCourseSettingsInput } from '../lib/validation.js';
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
    if (!isGlobalSuperUser(req.employee) && !isCompanySuperUser(req.employee)) {
      return res.status(403).json({ error: 'Company or platform admin access required' });
    }

    if (isCompanySuperUser(req.employee) && req.employee.company_id !== companyId) {
      return res.status(403).json({ error: 'Cannot create courses outside your company' });
    }

    const validationError = validateCourseCreateInput({ companyId, name, region, superintendentName });
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
        insert into courses (company_id, name, region, superintendent_name, course_areas_config)
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

router.patch('/:courseId', requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const { name, region, superintendentName, courseAreas } = req.body;

  try {
    const currentRole = await getRoleForCourse(req.employee, courseId);
    if (!isAdmin(currentRole)) {
      return res.status(403).json({ error: 'Admin access required for this course' });
    }

    const validationError = validateCourseSettingsInput({ name, region, superintendentName, courseAreas });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await query(
      `
        update courses
        set name = $2,
            region = $3,
            superintendent_name = $4,
            course_areas_config = $5::jsonb
        where id = $1
        returning id, company_id, name, region, superintendent_name, course_areas_config, created_at
      `,
      [courseId, name.trim(), region?.trim() || null, superintendentName?.trim() || null, JSON.stringify(normalizeCourseAreas(courseAreas))]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Course not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return handleUnexpectedError(res, error);
  }
});

export default router;
