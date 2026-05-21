import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";

export function canUseAccountAdmin(employee) {
  return employee?.company_role === "platform_admin" || employee?.company_role === "company_super_user";
}

export function useCourseData({ employeeRole, currentView, onAdminViewRevoked }) {
  const [courses, setCourses] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [companiesError, setCompaniesError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.course_id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId],
  );

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setCourseError("");

    try {
      const nextCourses = await api.courses();
      setCourses(nextCourses);
      setSelectedCourseId((current) => {
        if (nextCourses.some((course) => course.course_id === current)) return current;
        return nextCourses[0]?.course_id || "";
      });
    } catch (error) {
      setCourseError(error.message);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const loadCompanies = useCallback(async (nextEmployeeRole) => {
    const roleToCheck = nextEmployeeRole || employeeRole;
    if (!canUseAccountAdmin({ company_role: roleToCheck })) {
      setCompanies([]);
      return;
    }

    setLoadingCompanies(true);
    setCompaniesError("");

    try {
      const nextCompanies = await api.companies();
      setCompanies(nextCompanies);
    } catch (error) {
      setCompaniesError(error.message);
    } finally {
      setLoadingCompanies(false);
    }
  }, [employeeRole]);

  useEffect(() => {
    if (employeeRole && !canUseAccountAdmin({ company_role: employeeRole }) && currentView === "admin") {
      onAdminViewRevoked();
    }
  }, [currentView, employeeRole, onAdminViewRevoked]);

  const resetCourseData = useCallback(() => {
    setCourses([]);
    setCompanies([]);
    setSelectedCourseId("");
  }, []);

  return {
    courses,
    companies,
    selectedCourse,
    selectedCourseId,
    setSelectedCourseId,
    loadingCourses,
    loadingCompanies,
    courseError,
    companiesError,
    setCompanies,
    loadCourses,
    loadCompanies,
    resetCourseData,
  };
}
