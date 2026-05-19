export function getCourseById(courses, courseId) {
  return courses.find((course) => course.id === courseId) || courses[0];
}

export function filterByCourse(records, courseId) {
  return records.filter((record) => record.courseId === courseId);
}
