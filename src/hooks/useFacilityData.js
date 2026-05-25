import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";

export function canUseAccountAdmin(employee) {
  return employee?.company_role === "platform_admin" || employee?.company_role === "company_super_user";
}

export function useFacilityData({ employeeRole, currentView, onAdminViewRevoked }) {
  const [facilities, setCourses] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [companiesError, setCompaniesError] = useState("");

  const selectedCourse = useMemo(
    () => facilities.find((facility) => facility.facility_id === selectedCourseId) || facilities[0] || null,
    [facilities, selectedCourseId],
  );

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setCourseError("");

    try {
      const nextCourses = await api.facilities();
      setCourses(nextCourses);
      setSelectedCourseId((current) => {
        if (!current) {
          // Check local storage if no current selection is present yet
          const savedId = localStorage.getItem("turfop_selected_facility");
          if (savedId && nextCourses.some((facility) => facility.facility_id === savedId)) {
            return savedId;
          }
          return nextCourses[0]?.facility_id || "";
        }
        if (nextCourses.some((facility) => facility.facility_id === current)) return current;
        return nextCourses[0]?.facility_id || "";
      });
    } catch (error) {
      setCourseError(error.message);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  // Sync selection to local storage
  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("turfop_selected_facility", selectedCourseId);
    }
  }, [selectedCourseId]);

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
    facilities,
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
