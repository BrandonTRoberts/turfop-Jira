import { useCallback, useEffect, useMemo, useState } from "react";
import AppMainContent from "./AppMainContent";
import AppSidebar from "./AppSidebar";
import { api } from "@/services/api";
import { canUseAccountAdmin, useFacilityData } from "@/hooks/useCourseData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useSessionBootstrap } from "@/hooks/useSessionBootstrap";
import { useTimeEntries } from "@/hooks/useTimeEntries";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BarChart3, Clock, LayoutGrid, Loader2, LogOut, Menu, Package, Settings, ShieldCheck, Users, Wrench } from "lucide-react";
import { readFilesAsDataUrls } from "@/lib/files";
import NotificationBell from "@/components/common/NotificationBell";
import { setupPushNotifications } from "@/lib/pushNotifications";

function canWriteFacility(facility) {
  return facility?.role === "admin" || facility?.role === "read_write";
}

function selectedFacilityId(selectedFacility, payload = {}) {
  return (
    selectedFacility?.facility_id
    || selectedFacility?.course_id
    || selectedFacility?.id
    || payload?.facilityId
    || payload?.facility_id
    || payload?.courseId
    || payload?.course_id
    || payload?.id
    || null
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await api.login({ email, password });
      onLogin(session);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to TurfOp</CardTitle>
          <p className="text-sm text-muted-foreground">Use a TurfOp employee account to load only the companies and facilities you can access.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState("issues");
  const [notificationTarget, setNotificationTarget] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket");
    const facility = params.get("facility");
    if (!ticket) return null;
    return { ticketId: ticket, facilityId: facility || null };
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("turfop-sidebar-collapsed") === "true");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const rememberSidebarState = useCallback((collapsed) => {
    window.localStorage.setItem("turfop-sidebar-collapsed", String(collapsed));
    return collapsed;
  }, []);

  const {
    courses,
    companies,
    selectedFacility,
    setSelectedFacilityId,
    loadingFacilities,
    loadingCompanies,
    facilityError,
    companiesError,
    setCompanies,
    loadFacilities,
    loadCompanies,
    resetCourseData,
  } = useFacilityData({
    currentView,
    onAdminViewRevoked: useCallback(() => setCurrentView("dashboard"), []),
  });

  const {
    equipment,
    inventory,
    users,
    workOrders,
    dashboardOverview,
    loadingEquipment,
    loadingInventory,
    loadingWorkOrders,
    loadingDashboard,
    equipmentError,
    inventoryError,
    usersError,
    workOrdersError,
    dashboardError,
    setEquipment,
    setInventory,
    setUsers,
    setWorkOrders,
    resetDashboardData,
  } = useDashboardData(selectedFacility);

  const {
    timeEntries,
    timeSummary,
    loadingTime,
    timeError,
    reloadTimeEntries,
    resetTimeEntries,
  } = useTimeEntries(selectedFacility);

  const { session, setSession, booting, handleLogin, handleLogout } = useSessionBootstrap({
    loadFacilities,
    resetCourseData,
    resetDashboardData,
    resetTimeEntries,
  });

  const employeeRole = session?.employee?.company_role;
  const isAccountAdmin = canUseAccountAdmin(session?.employee);

  useEffect(() => {
    if (isAccountAdmin) {
      loadCompanies(employeeRole);
    } else {
      setCompanies([]);
      if (currentView === "admin") {
        setCurrentView("dashboard");
      }
    }
  }, [currentView, employeeRole, isAccountAdmin, loadCompanies, setCompanies]);

  useEffect(() => {
    if (!session?.employee?.id) return;
    setupPushNotifications({ employeeId: session.employee.id }).catch(() => {});
  }, [session?.employee?.id]);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "issues", label: "Issues Board", icon: LayoutGrid },
    { id: "users", label: "Team Members", icon: Users },
    { id: "templates", label: "Templates", icon: LayoutGrid },
    { id: "time", label: "Time Tracking", icon: Clock },
    { id: "equipment", label: "Equipment", icon: Wrench },
    { id: "inventory", label: "Inventory", icon: Package },
    ...(isAccountAdmin ? [{ id: "company-inventory", label: "Company Inventory", icon: Package }] : []),
    ...(isAccountAdmin ? [{ id: "time-clock-approval", label: "Time Clock Approval", icon: Clock }] : []),
    ...(isAccountAdmin ? [{ id: "admin", label: "Admin", icon: ShieldCheck }] : []),
    { id: "profile", label: "Settings", icon: Settings },
  ];

  async function createCompany(payload) {
    const created = await api.createCompany(payload);
    setCompanies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }

  async function createFacility(payload) {
    const created = await api.createFacility(payload);
    await loadFacilities();
    return created;
  }

  async function updateMyProfileImage(fileList) {
    const [profileImage] = await readFilesAsDataUrls(fileList, { maxFiles: 1 });
    const payload = {
      email: employee.email,
      fullName: employee.full_name || employee.email,
      phone: employee.phone,
      addressLine1: employee.address_line_1,
      addressLine2: employee.address_line_2,
      city: employee.city,
      state: employee.state,
      postalCode: employee.postal_code,
      profileImage,
    };
    const result = await api.updateProfile(payload);
    setSession((current) => ({ ...current, employee: { ...current.employee, ...result.employee } }));
  }

  async function createEquipment(payload) {
    const scopedPayload = {
      ...payload,
      facilityId: selectedFacilityId(selectedFacility, payload),
    };
    const created = await api.createEquipment(scopedPayload);
    setEquipment((current) => [created, ...current]);
  }

  async function updateEquipment(equipmentId, payload) {
    const scopedPayload = {
      ...payload,
      facilityId: selectedFacilityId(selectedFacility, payload),
    };
    const updated = await api.updateEquipment(equipmentId, scopedPayload);
    setEquipment((current) => current.map((item) => (item.id === equipmentId ? updated : item)));
    return updated;
  }

  async function createInventoryItem(payload) {
    const scopedPayload = {
      ...payload,
      facilityId: selectedFacilityId(selectedFacility, payload),
    };
    const created = await api.createInventoryItem(scopedPayload);
    setInventory((current) => [...current, created].sort((a, b) => a.sku.localeCompare(b.sku)));
  }

  async function updateInventoryItem(partId, payload) {
    const scopedPayload = {
      ...payload,
      facilityId: selectedFacilityId(selectedFacility, payload),
    };
    const updated = await api.updateInventoryItem(partId, scopedPayload);
    setInventory((current) =>
      current
        .map((item) => (item.id === partId ? updated : item))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    );
    return updated;
  }

  async function deleteInventoryItem(partId, payload) {
    const scopedPayload = {
      ...payload,
      facilityId: selectedFacilityId(selectedFacility, payload),
    };
    await api.deleteInventoryItem(partId, scopedPayload);
    setInventory((current) => current.filter((item) => item.id !== partId));
  }

  const activeFacilityId = selectedFacilityId(selectedFacility);

  async function loadEmployeeDetails(employeeId) {
    return api.employeeDetails(employeeId, activeFacilityId);
  }

  async function updateEmployee(employeeId, payload) {
    const updated = await api.updateEmployee(employeeId, {
      ...payload,
      facilityId: activeFacilityId,
    });

    if (payload.role) {
      await api.upsertMembership({ employeeId, facilityId: activeFacilityId, role: payload.role });
    }

    setUsers((current) => current.map((user) => (
      user.id === employeeId
        ? {
            ...user,
            name: updated.full_name || updated.email || user.name,
            email: updated.email,
            role: payload.role || user.role,
            status: updated.must_change_password ? "Invited" : "Active",
            profileImageUrl: updated.profile_image_url,
            hourlyRate: updated.hourly_rate,
          }
        : user
    )));

    return {
      ...updated,
      role: payload.role,
    };
  }

  async function upsertEmployeeMembership(employeeId, facilityId, role) {
    await api.upsertMembership({ employeeId, facilityId, role });
  }

  async function removeEmployeeMembership(employeeId, facilityId) {
    await api.removeMembership(employeeId, facilityId);
  }

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading TurfOp
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const employee = session.employee;
  const writable = canWriteFacility(selectedFacility);

  function selectView(viewId) {
    setCurrentView(viewId);
    setMobileNavOpen(false);
  }

  const handleOpenNotificationTicket = useCallback((notification) => {
    const facilityId = notification?.facility_id || notification?.payload?.facilityId || null;
    const ticketId = notification?.work_order_id || notification?.payload?.workOrderId || null;
    if (!ticketId) return;
    if (facilityId) {
      setSelectedFacilityId(facilityId);
    }
    setNotificationTarget({ ticketId, facilityId });
    setCurrentView("issues");
  }, [setSelectedFacilityId]);

  const renderView = () => (
    <AppMainContent
      currentView={currentView}
      selectedFacility={selectedFacility}
      isAccountAdmin={isAccountAdmin}
      employee={employee}
      writable={writable}
      facilities={courses}
      companies={companies}
      users={users}
      equipment={equipment}
      inventory={inventory}
      workOrders={workOrders}
      dashboardOverview={dashboardOverview}
      timeEntries={timeEntries}
      timeSummary={timeSummary}
      loadingFacilities={loadingFacilities}
      loadingCompanies={loadingCompanies}
      loadingDashboard={loadingDashboard}
      loadingWorkOrders={loadingWorkOrders}
      loadingTime={loadingTime}
      loadingEquipment={loadingEquipment}
      loadingInventory={loadingInventory}
      facilityError={facilityError}
      companiesError={companiesError}
      dashboardError={dashboardError}
      workOrdersError={workOrdersError}
      timeError={timeError}
      equipmentError={equipmentError}
      inventoryError={inventoryError}
      usersError={usersError}
      setWorkOrders={setWorkOrders}
      setUsers={setUsers}
      reloadTimeEntries={reloadTimeEntries}
      loadEmployeeDetails={loadEmployeeDetails}
      updateEmployee={updateEmployee}
      setEmployee={(updated) => setSession({ ...session, employee: updated })}
      createCompany={createCompany}
      createFacility={createFacility}
      createEquipment={createEquipment}
      updateEquipment={updateEquipment}
      createInventoryItem={createInventoryItem}
      updateInventoryItem={updateInventoryItem}
      deleteInventoryItem={deleteInventoryItem}
      onUpsertMembership={upsertEmployeeMembership}
      onRemoveMembership={removeEmployeeMembership}
      onSelectView={selectView}
      notificationTarget={notificationTarget}
      onHandledNotificationTarget={() => setNotificationTarget(null)}
    />
  );

  function renderSidebar(isMobile = false) {
    return (
      <AppSidebar
        employee={employee}
        selectedFacility={selectedFacility}
        facilities={courses}
        facilityError={facilityError}
        currentView={currentView}
        menuItems={menuItems}
        collapsed={sidebarCollapsed}
        isMobile={isMobile}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        onFacilityChange={setSelectedFacilityId}
        onLogout={handleLogout}
        onProfileImageChange={updateMyProfileImage}
        onSelectView={selectView}
        onToggleCollapsed={() => setSidebarCollapsed((current) => rememberSidebarState(!current))}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex lg:h-screen lg:overflow-hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <Button type="button" variant="outline" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-sm font-semibold">TurfOp</p>
          <p className="truncate text-xs text-muted-foreground">{selectedFacility?.name || "Operations"}</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell onOpenTicket={handleOpenNotificationTicket} />
          <Button type="button" variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative h-full">
            {renderSidebar(true)}
          </div>
        </div>
      ) : null}

      <div className="hidden lg:block">
        {renderSidebar(false)}
      </div>

      <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-4 hidden items-center justify-end lg:flex">
          <NotificationBell onOpenTicket={handleOpenNotificationTicket} />
        </div>
        {renderView()}
      </main>
    </div>
  );
}


