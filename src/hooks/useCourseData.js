import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";

export function canUseAccountAdmin(employee) {
  return employee?.company_role === "platform_admin" || employee?.company_role === "company_super_user";
}

export function useFacilityData({ employeeRole, currentView, onAdminViewRevoked }) {
  const [facilities, setFacilities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [facilityError, setFacilityError] = useState("");
  const [companiesError, setCompaniesError] = useState("");

  const selectedFacility = useMemo(
    () => facilities.find((facility) => (facility.facility_id || facility.course_id) === selectedFacilityId) || facilities[0] || null,
    [facilities, selectedFacilityId],
  );

  const loadFacilities = useCallback(async () => {
    setLoadingFacilities(true);
    setFacilityError("");

    try {
      const nextFacilities = await api.facilities();
      setFacilities(nextFacilities);
      setSelectedFacilityId((current) => {
        if (nextFacilities.some((facility) => (facility.facility_id || facility.course_id) === current)) return current;
        return nextFacilities[0]?.facility_id || nextFacilities[0]?.course_id || "";
      });
    } catch (error) {
      setFacilityError(error.message);
    } finally {
      setLoadingFacilities(false);
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

  const resetFacilityData = useCallback(() => {
    setFacilities([]);
    setCompanies([]);
    setSelectedFacilityId("");
  }, []);

  return {
    facilities,
    courses: facilities,
    companies,
    selectedFacility,
    selectedCourse: selectedFacility,
    selectedFacilityId,
    selectedCourseId: selectedFacilityId,
    setSelectedFacilityId,
    setSelectedCourseId: setSelectedFacilityId,
    loadingFacilities,
    loadingCourses: loadingFacilities,
    loadingCompanies,
    facilityError,
    courseError: facilityError,
    companiesError,
    setCompanies,
    loadFacilities,
    loadCourses: loadFacilities,
    loadCompanies,
    resetFacilityData,
    resetCourseData: resetFacilityData,
  };
}

export const useCourseData = useFacilityData;
