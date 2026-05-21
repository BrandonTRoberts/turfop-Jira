import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export function useTimeEntries(selectedCourse) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [timeSummary, setTimeSummary] = useState(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const [timeError, setTimeError] = useState("");

  const reloadTimeEntries = useCallback(async () => {
    if (!selectedCourse) return;
    const timeScope = selectedCourse.role === "admin" ? "course" : "mine";
    const [timePayload, summaryPayload] = await Promise.all([
      api.timeEntries(selectedCourse.course_id, timeScope),
      selectedCourse.role === "admin" ? api.timeSummary(selectedCourse.course_id).catch(() => null) : Promise.resolve(null),
    ]);
    setTimeEntries(timePayload.items || []);
    setTimeSummary(summaryPayload);
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedCourse?.course_id) return;

    setLoadingTime(true);
    setTimeError("");
    reloadTimeEntries()
      .catch((error) => setTimeError(error.message))
      .finally(() => setLoadingTime(false));
  }, [reloadTimeEntries, selectedCourse?.course_id]);

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
