import { useEffect, useMemo, useState } from "react";
import IssueBoard from "./boards/IssueBoard";
import AdminPanel from "./panels/AdminPanel";
import EquipmentPanel from "./panels/EquipmentPanel";
import InventoryPanel from "./panels/InventoryPanel";
import TimeTracker from "./panels/TimeTracker";
import UsersPanel from "./panels/UsersPanel";
import ThemeToggle from "./common/ThemeToggle";
import { api, clearStoredToken, getStoredToken } from "@/services/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Clock, Database, LayoutGrid, Loader2, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, ShieldCheck, Users, Wrench, X } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";

function canWriteCourse(course) {
  return course?.role === "admin" || course?.role === "read_write";
}

function canUseAccountAdmin(employee) {
  return employee?.company_role === "platform_admin" || employee?.company_role === "company_super_user";
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
  const [currentView, setCurrentView] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [courses, setCourses] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [equipment, setEquipment] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [users, setUsers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [timeSummary, setTimeSummary] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("turfop-sidebar-collapsed") === "true");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [booting, setBooting] = useState(Boolean(getStoredToken()));
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [companiesError, setCompaniesError] = useState("");
  const [equipmentError, setEquipmentError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [workOrdersError, setWorkOrdersError] = useState("");
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);
  const [timeError, setTimeError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.course_id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId]
  );

  const isAccountAdmin = canUseAccountAdmin(session?.employee);
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "issues", label: "Issues Board", icon: LayoutGrid },
    { id: "users", label: "Team Members", icon: Users },
    { id: "time", label: "Time Tracking", icon: Clock },
    { id: "equipment", label: "Equipment", icon: Wrench },
    { id: "inventory", label: "Inventory", icon: Package },
    ...(isAccountAdmin ? [{ id: "admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  async function loadCourses() {
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
  }

  async function loadCompanies() {
    if (!canUseAccountAdmin(session?.employee)) {
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
  }

  async function hydrateFromToken() {
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
  }

  useEffect(() => {
    hydrateFromToken();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("turfop-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (canUseAccountAdmin(session?.employee)) {
      loadCompanies();
    } else {
      setCompanies([]);
      if (currentView === "admin") {
        setCurrentView("dashboard");
      }
    }
  }, [session?.employee?.id, session?.employee?.company_role]);

  useEffect(() => {
    if (!selectedCourse?.course_id) return;

    setLoadingEquipment(true);
    setEquipmentError("");
    api.equipment(selectedCourse.course_id)
      .then(setEquipment)
      .catch((error) => setEquipmentError(error.message))
      .finally(() => setLoadingEquipment(false));

    setLoadingInventory(true);
    setInventoryError("");
    api.inventory(selectedCourse.course_id)
      .then(setInventory)
      .catch((error) => setInventoryError(error.message))
      .finally(() => setLoadingInventory(false));

    setUsersError("");
    api.courseDirectory(selectedCourse.course_id)
      .then((rows) => {
        setUsers(rows.map((row) => ({
          id: row.id,
          name: row.full_name || row.email || "Unnamed user",
          email: row.email,
          courseId: row.course_id,
          role: row.role || "read_only",
          status: row.must_change_password ? "Invited" : "Active",
          profileImageUrl: row.profile_image_url,
          hourlyRate: row.hourly_rate,
        })));
      })
      .catch((error) => {
        setUsers([]);
        setUsersError(error.message);
      });

    setLoadingWorkOrders(true);
    setWorkOrdersError("");
    api.workOrders(selectedCourse.course_id)
      .then(setWorkOrders)
      .catch((error) => setWorkOrdersError(error.message))
      .finally(() => setLoadingWorkOrders(false));

    setLoadingTime(true);
    setTimeError("");
    const timeScope = selectedCourse.role === "admin" ? "course" : "mine";
    Promise.all([
      api.timeEntries(selectedCourse.course_id, timeScope),
      selectedCourse.role === "admin" ? api.timeSummary(selectedCourse.course_id).catch(() => null) : Promise.resolve(null),
    ])
      .then(([timePayload, summaryPayload]) => {
        setTimeEntries(timePayload.items || []);
        setTimeSummary(summaryPayload);
      })
      .catch((error) => setTimeError(error.message))
      .finally(() => setLoadingTime(false));
  }, [selectedCourse?.course_id]);

  async function handleLogin(nextSession) {
    setSession(nextSession);
    await loadCourses();
  }

  async function handleLogout() {
    await api.logout();
    setSession(null);
    setCourses([]);
    setCompanies([]);
    setSelectedCourseId("");
    setEquipment([]);
    setInventory([]);
    setUsers([]);
    setWorkOrders([]);
    setTimeEntries([]);
    setTimeSummary(null);
  }

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

  async function reloadTimeEntries() {
    if (!selectedCourse) return;
    const timeScope = selectedCourse.role === "admin" ? "course" : "mine";
    const [timePayload, summaryPayload] = await Promise.all([
      api.timeEntries(selectedCourse.course_id, timeScope),
      selectedCourse.role === "admin" ? api.timeSummary(selectedCourse.course_id).catch(() => null) : Promise.resolve(null),
    ]);
    setTimeEntries(timePayload.items || []);
    setTimeSummary(summaryPayload);
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

  const renderView = () => {
    if (currentView === "admin" && isAccountAdmin) {
      return (
        <AdminPanel
          employee={employee}
          companies={companies}
          courses={courses}
          loading={loadingCompanies || loadingCourses}
          error={companiesError || courseError}
          onCreateCompany={createCompany}
          onCreateCourse={createCourse}
        />
      );
    }

    if (!selectedCourse) {
      return (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {loadingCourses ? "Loading courses..." : courseError || "No courses are assigned to this account."}
          </CardContent>
        </Card>
      );
    }

    switch (currentView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-light sm:text-4xl">TurfOp Operations</h1>
              <p className="mt-3 text-muted-foreground">
                Signed in as {employee.full_name || employee.email}. Active course scope is {selectedCourse.name}.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Accessible courses</p>
                  <p className="mt-2 text-4xl font-semibold">{courses.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Equipment in scope</p>
                  <p className="mt-2 text-4xl font-semibold">{equipment.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Users in scope</p>
                  <p className="mt-2 text-4xl font-semibold">{users.length}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  Data boundary
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                This view only requests records for the selected course id. Company-level access is resolved by the API from your account and course memberships.
              </CardContent>
            </Card>
          </div>
        );
      case "issues":
        return (
          <IssueBoard
            course={selectedCourse}
            workOrders={workOrders}
            users={users}
            equipment={equipment}
            inventory={inventory}
            loading={loadingWorkOrders}
            error={workOrdersError}
            canWrite={writable}
            onCreate={async (payload) => {
              const created = await api.createWorkOrder(payload);
              setWorkOrders((current) => [created, ...current]);
              return created;
            }}
            onUpdate={async (workOrderId, payload) => {
              const updated = await api.updateWorkOrder(workOrderId, payload);
              setWorkOrders((current) => current.map((ticket) => ticket.id === workOrderId ? updated : ticket));
              return updated;
            }}
            onComment={async (workOrderId, payload) => {
              const activity = await api.addWorkOrderComment(workOrderId, payload);
              setWorkOrders((current) => current.map((ticket) => (
                ticket.id === workOrderId
                  ? { ...ticket, activity_log: [activity, ...(ticket.activity_log || [])] }
                  : ticket
              )));
              return activity;
            }}
          />
        );
      case "users":
        return (
          <div className="space-y-4">
            {usersError ? <p className="text-sm text-red-400">{usersError}</p> : null}
            <UsersPanel
              business={{ name: selectedCourse.name }}
              users={users}
              canAdmin={selectedCourse.role === "admin"}
              onLoadDetails={loadEmployeeDetails}
              onUpdate={updateEmployee}
              onInvite={async (invite) => {
                await api.inviteEmployee({
                  courseId: selectedCourse.course_id,
                  email: invite.email,
                  fullName: invite.fullName,
                  role: invite.role,
                  hourlyRate: invite.hourlyRate ? Number(invite.hourlyRate) : null,
                  profileImage: invite.profileImage,
                });
                const rows = await api.courseDirectory(selectedCourse.course_id);
                setUsers(rows.map((row) => ({
                  id: row.id,
                  name: row.full_name || row.email || "Unnamed user",
                  email: row.email,
                  courseId: row.course_id,
                  role: row.role || "read_only",
                  status: row.must_change_password ? "Invited" : "Active",
                  profileImageUrl: row.profile_image_url,
                  hourlyRate: row.hourly_rate,
                })));
              }}
              onRoleChange={async (employeeId, role) => {
                await api.upsertMembership({ employeeId, courseId: selectedCourse.course_id, role });
                setUsers((current) => current.map((user) => user.id === employeeId ? { ...user, role } : user));
              }}
            />
          </div>
        );
      case "time":
        return (
          <TimeTracker
            course={selectedCourse}
            entries={timeEntries}
            summary={timeSummary}
            activeEntry={timeEntries.find((entry) => !entry.clock_out_at && entry.employee_id === employee.id) || null}
            loading={loadingTime}
            error={timeError}
            canAdmin={selectedCourse.role === "admin"}
            onClockIn={async (note) => {
              await api.clockIn({ courseId: selectedCourse.course_id, note });
              await reloadTimeEntries();
            }}
            onClockOut={async (note) => {
              await api.clockOut({ courseId: selectedCourse.course_id, note });
              await reloadTimeEntries();
            }}
          />
        );
      case "equipment":
        return <EquipmentPanel course={selectedCourse} equipment={equipment} loading={loadingEquipment} error={equipmentError} canWrite={writable} onCreate={createEquipment} onUpdate={updateEquipment} />;
      case "inventory":
        return <InventoryPanel course={selectedCourse} inventory={inventory} loading={loadingInventory} error={inventoryError} canWrite={writable} onCreate={createInventoryItem} onUpdate={updateInventoryItem} />;
      default:
        return null;
    }
  };

  const sidebar = (isMobile = false) => {
    const collapsed = isMobile ? false : sidebarCollapsed;

    return (
      <aside className={`flex h-full shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${collapsed ? "w-20" : "w-72"} ${isMobile ? "w-80 max-w-[88vw]" : ""}`}>
        <div className={`border-b border-border ${collapsed ? "p-3" : "p-4 sm:p-6"}`}>
          {isMobile ? (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Navigation</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
          <div className={`flex items-center gap-4 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-bold text-black">T</div>
            {!collapsed ? <div>
              <p className="text-3xl font-semibold tracking-tighter">TurfOp</p>
              <p className="text-sm text-muted-foreground">Operations Platform</p>
            </div> : null}
          </div>

          {!collapsed ? <div className="mt-5 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{employee.full_name || employee.email}</p>
                <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
              </div>
              <label className="h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-muted" title="Upload profile picture">
                {employee.profile_image_url ? <img src={getUploadUrl(employee.profile_image_url)} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs">{(employee.full_name || employee.email || "?")[0]}</span>}
                <input className="hidden" type="file" accept="image/*" onChange={(event) => updateMyProfileImage(event.target.files)} />
              </label>
              <Button type="button" variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div> : null}

          {!collapsed ? <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              Course Scope
              {selectedCourse ? <Badge variant="outline">{selectedCourse.role}</Badge> : null}
            </div>
            <Select value={selectedCourse?.course_id || ""} onValueChange={setSelectedCourseId} disabled={courses.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.course_id} value={course.course_id}>
                    {course.company_name ? `${course.company_name} / ${course.name}` : course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {courseError ? <p className="text-xs text-red-400">{courseError}</p> : null}
          </div> : null}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? "default" : "ghost"}
              className={`w-full ${collapsed ? "justify-center px-0" : "justify-start"}`}
              onClick={() => selectView(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`h-5 w-5 ${collapsed ? "" : "mr-3"}`} />
              {!collapsed ? item.label : null}
            </Button>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {!isMobile ? (
            <Button
              type="button"
              variant="outline"
              className={`mb-2 w-full ${collapsed ? "justify-center px-0" : "justify-start"}`}
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="mr-3 h-5 w-5" />}
              {!collapsed ? "Collapse sidebar" : null}
            </Button>
          ) : null}
          <div className={`flex items-center gap-3 rounded-lg bg-muted/40 p-2 text-sm ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed ? <span className="text-muted-foreground">Appearance</span> : null}
            <ThemeToggle />
          </div>
        </div>
      </aside>
    );
  };

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
            {sidebar(true)}
          </div>
        </div>
      ) : null}

      <div className="hidden lg:block">
        {sidebar(false)}
      </div>

      <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {renderView()}
      </main>
    </div>
  );
}
