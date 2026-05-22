import { useCallback, useEffect, useState } from "react";
import AppMainContent from "./AppMainContent";
import AppSidebar from "./AppSidebar";
import { api } from "@/services/api";
import { canUseAccountAdmin, useCourseData } from "@/hooks/useCourseData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useSessionBootstrap } from "@/hooks/useSessionBootstrap";
import { useTimeEntries } from "@/hooks/useTimeEntries";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BarChart3, Clock, LayoutGrid, Loader2, LogOut, Menu, Package, ShieldCheck, Users, Wrench } from "lucide-react";
import { readFilesAsDataUrls } from "@/lib/files";

function canWriteCourse(course) {
  return course?.role === "admin" || course?.role === "read_write";
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
          <p className="text-sm text-muted-foreground">Use a TurfOp employee account to load only the companies and courses you can access.</p>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("turfop-sidebar-collapsed") === "true");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const rememberSidebarState = useCallback((collapsed) => {
    window.localStorage.setItem("turfop-sidebar-collapsed", String(collapsed));
    return collapsed;
  }, []);

  const {
    courses,
    companies,
    selectedCourse,
    setSelectedCourseId,
    loadingCourses,
    loadingCompanies,
    courseError,
    companiesError,
    setCompanies,
    loadCourses,
    loadCompanies,
    resetCourseData,
  } = useCourseData({
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
  } = useDashboardData(selectedCourse);

  const {
    timeEntries,
    timeSummary,
    loadingTime,
    timeError,
    reloadTimeEntries,
    resetTimeEntries,
  } = useTimeEntries(selectedCourse);

  const { session, setSession, booting, handleLogin, handleLogout } = useSessionBootstrap({
    loadCourses,
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

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "issues", label: "Issues Board", icon: LayoutGrid },
    { id: "users", label: "Team Members", icon: Users },
    { id: "time", label: "Time Tracking", icon: Clock },
    { id: "equipment", label: "Equipment", icon: Wrench },
    { id: "inventory", label: "Inventory", icon: Package },
    ...(isAccountAdmin ? [{ id: "admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  async function createCompany(payload) {
    const created = await api.createCompany(payload);
    setCompanies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }

  async function createCourse(payload) {
    const created = await api.createCourse(payload);
    await loadCourses();
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
    const created = await api.createEquipment(payload);
    setEquipment((current) => [created, ...current]);
  }

  async function updateEquipment(equipmentId, payload) {
    const updated = await api.updateEquipment(equipmentId, payload);
    setEquipment((current) => current.map((item) => (item.id === equipmentId ? updated : item)));
    return updated;
  }

  async function createInventoryItem(payload) {
    const created = await api.createInventoryItem(payload);
    setInventory((current) => [...current, created].sort((a, b) => a.sku.localeCompare(b.sku)));
  }

  async function updateInventoryItem(partId, payload) {
    const updated = await api.updateInventoryItem(partId, payload);
    setInventory((current) =>
      current
        .map((item) => (item.id === partId ? updated : item))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    );
    return updated;
  }

  async function deleteInventoryItem(partId, payload) {
    await api.deleteInventoryItem(partId, payload);
    setInventory((current) => current.filter((item) => item.id !== partId));
  }

  async function loadEmployeeDetails(employeeId) {
    return api.employeeDetails(employeeId, selectedCourse.course_id);
  }

  async function updateEmployee(employeeId, payload) {
    const updated = await api.updateEmployee(employeeId, {
      ...payload,
      courseId: selectedCourse.course_id,
    });

    if (payload.role) {
      await api.upsertMembership({ employeeId, courseId: selectedCourse.course_id, role: payload.role });
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
  const writable = canWriteCourse(selectedCourse);

  function selectView(viewId) {
    setCurrentView(viewId);
    setMobileNavOpen(false);
  }

  const renderView = () => (
    <AppMainContent
      currentView={currentView}
      selectedCourse={selectedCourse}
      isAccountAdmin={isAccountAdmin}
      employee={employee}
      writable={writable}
      courses={courses}
      companies={companies}
      users={users}
      equipment={equipment}
      inventory={inventory}
      workOrders={workOrders}
      dashboardOverview={dashboardOverview}
      timeEntries={timeEntries}
      timeSummary={timeSummary}
      loadingCourses={loadingCourses}
      loadingCompanies={loadingCompanies}
      loadingDashboard={loadingDashboard}
      loadingWorkOrders={loadingWorkOrders}
      loadingTime={loadingTime}
      loadingEquipment={loadingEquipment}
      loadingInventory={loadingInventory}
      courseError={courseError}
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
      createCourse={createCourse}
      createEquipment={createEquipment}
      updateEquipment={updateEquipment}
      createInventoryItem={createInventoryItem}
      updateInventoryItem={updateInventoryItem}
      deleteInventoryItem={deleteInventoryItem}
    />
  );

  function renderSidebar(isMobile = false) {
    return (
      <AppSidebar
        employee={employee}
        selectedCourse={selectedCourse}
        courses={courses}
        courseError={courseError}
        currentView={currentView}
        menuItems={menuItems}
        collapsed={sidebarCollapsed}
        isMobile={isMobile}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        onCourseChange={setSelectedCourseId}
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
          <p className="truncate text-xs text-muted-foreground">{selectedCourse?.name || "Operations"}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
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
        {renderView()}
      </main>
    </div>
  );
}


