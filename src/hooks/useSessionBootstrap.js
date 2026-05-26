import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export function useSessionBootstrap({ loadCourses, resetCourseData, resetDashboardData, resetTimeEntries }) {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);

  const hydrateFromToken = useCallback(async () => {
    try {
      const nextSession = await api.me();
      setSession(nextSession);
      await loadCourses();
    } catch {
      setSession(null);
    } finally {
      setBooting(false);
    }
  }, [loadCourses]);

  useEffect(() => {
    hydrateFromToken();
  }, [hydrateFromToken]);

  async function handleLogin(nextSession) {
    setSession(nextSession);
    await loadCourses();
  }

  async function handleLogout() {
    await api.logout();
    setSession(null);
    resetCourseData();
    resetDashboardData();
    resetTimeEntries();
  }

  return {
    session,
    setSession,
    booting,
    handleLogin,
    handleLogout,
  };
}
