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
          c.id as course_id,
          c.company_id,
          coalesce(co.name, 'Unassigned company') as company_name,
          c.name,
          c.region,
          c.superintendent_name,
          c.course_areas_config
        from courses c
        left join companies co on co.id = c.company_id
        order by coalesce(co.name, 'Unassigned company') asc, c.name asc
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
          c.id as course_id,
          c.company_id,
          coalesce(co.name, 'Unassigned company') as company_name,
          c.name,
          c.region,
          c.superintendent_name,
          c.course_areas_config
        from courses c
        left join companies co on co.id = c.company_id
        where c.company_id = $1
        order by co.name asc, c.name asc
      `,
      [employee.company_id]
    );

    return result.rows;
  }

  const result = await query(
    `
        select
          cm.id,
          cm.role,
          cm.course_id,
          c.company_id,
          coalesce(co.name, 'Unassigned company') as company_name,
          c.name,
          c.region,
          c.superintendent_name,
          c.course_areas_config
      from course_memberships cm
      join courses c on c.id = cm.course_id
      left join companies co on co.id = c.company_id
      where cm.employee_id = $1
      order by c.name asc
    `,
    [employeeId]
  );

  return result.rows;
}

export async function getRoleForCourse(employeeOrId, courseId) {
  const employeeId = typeof employeeOrId === 'object' ? employeeOrId?.id : employeeOrId;
  const employee = typeof employeeOrId === 'object' ? employeeOrId : null;

  if (employee && isPlatformAdmin(employee)) {
    const courseResult = await query(
      `
        select id
        from courses
        where id = $1
        limit 1
      `,
      [courseId]
    );

    if (courseResult.rows[0]?.id) {
      return 'admin';
    }
  }

  if (employee && isCompanySuperUser(employee)) {
    const courseResult = await query(
      `
        select id
        from courses
        where id = $1 and company_id = $2
        limit 1
      `,
      [courseId, employee.company_id]
    );

    if (courseResult.rows[0]?.id) {
      return 'admin';
    }
  }

  const result = await query(
    `
      select role
      from course_memberships
      where employee_id = $1 and course_id = $2
      limit 1
    `,
    [employeeId, courseId]
  );

  return result.rows[0]?.role || null;
}

export function canWrite(role) {
  return role === 'admin' || role === 'read_write';
}

export function isAdmin(role) {
  return role === 'admin';
}
