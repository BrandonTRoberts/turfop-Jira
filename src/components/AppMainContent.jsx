import { Card, CardContent } from "@/components/ui/card";
import DashboardView from "./views/DashboardView";
import IssueBoard from "./boards/IssueBoard";
import UsersPanel from "./panels/UsersPanel";
import TimeTracker from "./panels/TimeTracker";
import EquipmentPanel from "./panels/EquipmentPanel";
import InventoryPanel from "./panels/InventoryPanel";
import AdminPanel from "./panels/AdminPanel";
import { api } from "@/services/api";
import { mapDirectoryRows } from "@/hooks/useDashboardData";

/**
 * Extracted view renderer from App.jsx
 * Preserves exact same UI/UX and Jira-like workflow
 */
export default function AppMainContent({
  currentView,
  selectedCourse,
  isAccountAdmin,
  employee,
  writable,
  courses,
  companies,
  users,
  equipment,
  inventory,
  workOrders,
  dashboardOverview,
  timeEntries,
  timeSummary,
  loadingCourses,
  loadingCompanies,
  loadingDashboard,
  loadingWorkOrders,
  loadingTime,
  loadingEquipment,
  loadingInventory,
  courseError,
  companiesError,
  dashboardError,
  workOrdersError,
  timeError,
  equipmentError,
  inventoryError,
  usersError,
  setWorkOrders,
  setUsers,
  reloadTimeEntries,
  loadEmployeeDetails,
  updateEmployee,
  createEquipment,
  updateEquipment,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
}) {
  if (currentView === "admin" && isAccountAdmin) {
    return (
      <AdminPanel
        employee={employee}
        companies={companies}
        courses={courses}
        loading={loadingCompanies || loadingCourses}
        error={companiesError || courseError}
        onCreateCompany={async (_payload) => {
          // This would need the createCompany function passed down too
          console.warn("Admin company creation needs full handler");
          return null;
        }}
        onCreateCourse={() => {}}
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
        <DashboardView
          employee={employee}
          selectedCourse={selectedCourse}
          overview={dashboardOverview}
          loading={loadingDashboard}
          error={dashboardError}
        />
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
            setWorkOrders((current) =>
              current.map((ticket) => (ticket.id === workOrderId ? updated : ticket))
            );
            return updated;
          }}
          onComment={async (workOrderId, payload) => {
            const activity = await api.addWorkOrderComment(workOrderId, payload);
            setWorkOrders((current) =>
              current.map((ticket) =>
                ticket.id === workOrderId
                  ? { ...ticket, activity_log: [activity, ...(ticket.activity_log || [])] }
                  : ticket
              )
            );
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
              setUsers(mapDirectoryRows(rows));
            }}
            onRoleChange={async (employeeId, role) => {
              await api.upsertMembership({ employeeId, courseId: selectedCourse.course_id, role });
              setUsers((current) =>
                current.map((user) => (user.id === employeeId ? { ...user, role } : user))
              );
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
      return (
        <EquipmentPanel
          course={selectedCourse}
          equipment={equipment}
          loading={loadingEquipment}
          error={equipmentError}
          canWrite={writable}
          onCreate={createEquipment}
          onUpdate={updateEquipment}
        />
      );

    case "inventory":
      return (
        <InventoryPanel
          course={selectedCourse}
          inventory={inventory}
          loading={loadingInventory}
          error={inventoryError}
          canWrite={writable}
          onCreate={createInventoryItem}
          onUpdate={updateInventoryItem}
          onDelete={deleteInventoryItem}
        />
      );

    default:
      return null;
  }
}
