import { query } from './db.js';

export function isPlatformAdmin(employee) {
  return employee?.company_role === 'platform_admin';
}

export function isCompanySuperUser(employee) {
  return employee?.company_role === 'company_super_user';
}

export function isGlobalSuperUser(employee) {
  return isPlatformAdmin(employee);
}

export async function getMembershipsForEmployee(employeeId) {
  const employeeResult = await query(
    `
      select id, company_id, company_role
      from employees
      where id = $1
      limit 1
    `,
    [employeeId]
  );

  const employee = employeeResult.rows[0];
  if (!employee) {
    return [];
  }

  if (isPlatformAdmin(employee)) {
    const result = await query(
      `
        select
          null::uuid as id,
          'admin'::text as role,
          f.id as facility_id,
          f.company_id,
          coalesce(co.name, 'Unassigned company') as company_name,
          f.name,
          f.region,
          f.superintendent_name,
          f.course_areas_config
        from facilities f
        left join companies co on co.id = f.company_id
        order by coalesce(co.name, 'Unassigned company') asc, f.name asc
      `
    );

    return result.rows;
  }

  if (isCompanySuperUser(employee)) {
    const result = await query(
      `
        select
          null::uuid as id,
          'admin'::text as role,
          f.id as facility_id,
          f.company_id,
          coalesce(co.name, 'Unassigned company') as company_name,
          f.name,
          f.region,
          f.superintendent_name,
          f.course_areas_config
        from facilities f
        left join companies co on co.id = f.company_id
        where f.company_id = $1
        order by co.name asc, f.name asc
      `,
      [employee.company_id]
    );

    return result.rows;
  }

  const result = await query(
    `
        select
          fm.id,
          fm.role,
          fm.facility_id,
          f.company_id,
          coalesce(co.name, 'Unassigned company') as company_name,
          f.name,
          f.region,
          f.superintendent_name,
          f.course_areas_config
      from facility_memberships fm
      join facilities f on f.id = fm.facility_id
      left join companies co on co.id = f.company_id
      where fm.employee_id = $1
      order by f.name asc
    `,
    [employeeId]
  );

  return result.rows;
}

export async function getRoleForFacility(employeeOrId, facilityId) {
  const employeeId = typeof employeeOrId === 'object' ? employeeOrId?.id : employeeOrId;
  const employee = typeof employeeOrId === 'object' ? employeeOrId : null;

  if (employee && isPlatformAdmin(employee)) {
    const facilityResult = await query(
      `
        select id
        from facilities
        where id = $1
        limit 1
      `,
      [facilityId]
    );

    if (facilityResult.rows[0]?.id) {
      return 'admin';
    }
  }

  if (employee && isCompanySuperUser(employee)) {
    const facilityResult = await query(
      `
        select id
        from facilities
        where id = $1 and company_id = $2
        limit 1
      `,
      [facilityId, employee.company_id]
    );

    if (facilityResult.rows[0]?.id) {
      return 'admin';
    }
  }

  const result = await query(
    `
      select role
      from facility_memberships
      where employee_id = $1 and facility_id = $2
      limit 1
    `,
    [employeeId, facilityId]
  );

  return result.rows[0]?.role || null;
}

// Back-compat symbol name removed in hard cut-over: re-export under the old name so
// any remaining callers fail loudly when they pass courseId (now treated as facilityId).
export const getRoleForCourse = getRoleForFacility;

export function canWrite(role) {
  return role === 'admin' || role === 'read_write';
}

export function isAdmin(role) {
  return role === 'admin';
}
