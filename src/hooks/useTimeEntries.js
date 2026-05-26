import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export function useTimeEntries(selectedFacility) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [timeSummary, setTimeSummary] = useState(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const [timeError, setTimeError] = useState("");

  const reloadTimeEntries = useCallback(async () => {
    if (!selectedFacility) return;
    const activeFacilityId = selectedFacility.facility_id || selectedFacility.course_id;
    if (!activeFacilityId) return;
    const timeScope = selectedFacility.role === "admin" ? "facility" : "mine";
    const [timePayload, summaryPayload] = await Promise.all([
      api.timeEntries(activeFacilityId, timeScope),
      selectedFacility.role === "admin" ? api.timeSummary(activeFacilityId).catch(() => null) : Promise.resolve(null),
    ]);
    setTimeEntries(timePayload.items || []);
    setTimeSummary(summaryPayload);
  }, [selectedFacility]);

  useEffect(() => {
    const activeFacilityId = selectedFacility?.facility_id || selectedFacility?.course_id;
    if (!activeFacilityId) return;

    setLoadingTime(true);
    setTimeError("");
    reloadTimeEntries()
      .catch((error) => setTimeError(error.message))
      .finally(() => setLoadingTime(false));
  }, [reloadTimeEntries, selectedFacility?.facility_id, selectedFacility?.course_id]);

  const resetTimeEntries = useCallback(() => {
    setTimeEntries([]);
    setTimeSummary(null);
  }, []);

  return {
    timeEntries,
    timeSummary,
    loadingTime,
    timeError,
    reloadTimeEntries,
    resetTimeEntries,
  };
}
