export function resolveFacilityId({ body = {}, query = {}, employee = null } = {}) {
  return (
    body.facilityId
    || body.facility_id
    || body.courseId
    || body.course_id
    || body.id
    || query.facilityId
    || query.facility_id
    || query.courseId
    || query.course_id
    || query.id
    || employee?.default_facility_id
    || employee?.defaultFacilityId
    || null
  );
}
