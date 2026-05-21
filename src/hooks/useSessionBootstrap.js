import { useCallback, useEffect, useState } from "react";
import { api, clearStoredToken, getStoredToken } from "@/services/api";

export function useSessionBootstrap({ loadCourses, resetCourseData, resetDashboardData, resetTimeEntries }) {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(Boolean(getStoredToken()));

  const hydrateFromToken = useCallback(async () => {
    if (!getStoredToken()) {
      setBooting(false);
      return;
    }

    try {
      const nextSession = await api.me();
      setSession(nextSession);
      await loadCourses();
    } catch {
      clearStoredToken();
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
