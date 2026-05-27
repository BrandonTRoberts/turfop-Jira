import { Card, CardContent } from "@/components/ui/card";
import DashboardView from "./views/DashboardView";
import IssueBoard from "./boards/IssueBoard";
import UsersPanel from "./panels/UsersPanel";
import TimeTracker from "./panels/TimeTracker";
import EquipmentPanel from "./panels/EquipmentPanel";
import InventoryPanel from "./panels/InventoryPanel";
import CompanyInventoryPanel from "./panels/CompanyInventoryPanel";
import ProfilePanel from "./panels/ProfilePanel";
import AdminPanel from "./panels/AdminPanel";
import ServiceTemplatesManager from "./panels/ServiceTemplatesManager";
import TimeClockApprovalPanel from "./panels/TimeClockApprovalPanel";
import CsvImportPanel from "./panels/CsvImportPanel";
import { api } from "@/services/api";
import { mapDirectoryRows } from "@/hooks/useDashboardData";

/**
 * Extracted view renderer from App.jsx
 * Preserves exact same UI/UX and Jira-like workflow
 */
export default function AppMainContent({
  currentView,
  selectedFacility,
  isAccountAdmin,
  employee,
  writable,
  facilities,
  companies,
  users,
  equipment,
  inventory,
  workOrders,
  dashboardOverview,
  timeEntries,
  timeSummary,
  loadingFacilities,
  loadingCompanies,
  loadingDashboard,
  loadingWorkOrders,
  loadingTime,
  loadingEquipment,
  loadingInventory,
  facilityError,
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
  setEmployee,
  onSelectView,
  createFacility,
  createCompany,
  deleteCompany,
  deleteFacility,
  createEquipment,
  updateEquipment,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  onUpsertMembership,
  onRemoveMembership,
  onDeleteUser,
  notificationTarget,
  onHandledNotificationTarget,
}) {
  if (currentView === "admin" && isAccountAdmin) {
    return (
      <AdminPanel
        employee={employee}
        companies={companies}
        facilities={facilities}
        loading={loadingCompanies || loadingFacilities}
        error={companiesError || facilityError}
        onCreateCompany={createCompany}
        onCreateFacility={createFacility}
        onDeleteCompany={deleteCompany}
        onDeleteFacility={deleteFacility}
      />
    );
  }

  if (!selectedFacility) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          {loadingFacilities ? "Loading facilities..." : facilityError || "No facilities are assigned to this account."}
        </CardContent>
      </Card>
    );
  }

  const activeFacilityId = selectedFacility.facility_id || selectedFacility.course_id || selectedFacility.id;

  switch (currentView) {
    case "dashboard":
      return (
        <DashboardView
          employee={employee}
          selectedFacility={selectedFacility}
          overview={dashboardOverview}
          loading={loadingDashboard}
          error={dashboardError}
          users={users}
          workOrders={workOrders}
          onSelectView={onSelectView}
        />
      );

    case "issues":
      return (
        <IssueBoard
          course={selectedFacility}
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
          notificationTarget={notificationTarget}
          onHandledNotificationTarget={onHandledNotificationTarget}
        />
      );

    case "templates":
      return <ServiceTemplatesManager course={selectedFacility} inventory={inventory} canWrite={selectedFacility.role === "admin"} />;

    case "time-clock-approval":
      return <TimeClockApprovalPanel facility={selectedFacility} canAdmin={selectedFacility.role === "admin"} />;

    case "users":
      return (
        <div className="space-y-4">
          {usersError ? <p className="text-sm text-red-400">{usersError}</p> : null}
          <UsersPanel
            business={{ name: selectedFacility.name }}
            users={users}
            facilities={facilities}
            activeFacilityId={activeFacilityId}
            canAdmin={selectedFacility.role === "admin"}
            onLoadDetails={loadEmployeeDetails}
            onUpdate={updateEmployee}
            onInvite={async (invite) => {
              await api.inviteEmployee({
                facilityId: activeFacilityId,
                email: invite.email,
                fullName: invite.fullName,
                role: invite.role,
                hourlyRate: invite.hourlyRate ? Number(invite.hourlyRate) : null,
                profileImage: invite.profileImage,
              });
              const rows = await api.facilityDirectory(activeFacilityId);
              setUsers(mapDirectoryRows(rows));
            }}
            onRoleChange={async (employeeId, role) => {
              await api.upsertMembership({ employeeId, facilityId: activeFacilityId, role });
              setUsers((current) =>
                current.map((user) => (user.id === employeeId ? { ...user, role } : user))
              );
            }}
            onUpsertMembership={onUpsertMembership}
            onRemoveMembership={onRemoveMembership}
            onDeleteUser={onDeleteUser}
            onResendInvite={async (employeeId) => {
              await api.resendInvite(employeeId, activeFacilityId);
            }}
            onSendResetPassword={async (employeeId) => {
              await api.sendResetPassword(employeeId, activeFacilityId);
            }}
          />
        </div>
      );

    case "time":
      return (
        <TimeTracker
          course={selectedFacility}
          entries={timeEntries}
          summary={timeSummary}
          activeEntry={timeEntries.find((entry) => !entry.clock_out_at && entry.employee_id === employee.id) || null}
          loading={loadingTime}
          error={timeError}
          canAdmin={selectedFacility.role === "admin"}
          onClockIn={async (note) => {
            await api.clockIn({ facilityId: activeFacilityId, note });
            await reloadTimeEntries();
          }}
          onClockOut={async (note) => {
            await api.clockOut({ facilityId: activeFacilityId, note });
            await reloadTimeEntries();
          }}
        />
      );

    case "equipment":
      return (
        <div className="space-y-4">
        <CsvImportPanel facility={selectedFacility} canWrite={selectedFacility.role === "admin"} />
        <EquipmentPanel
          course={selectedFacility}
          equipment={equipment}
          loading={loadingEquipment}
          error={equipmentError}
          canWrite={writable}
          onCreate={createEquipment}
          onUpdate={updateEquipment}
        />
        </div>
      );

    case "inventory":
      return (
        <div className="space-y-4">
        <CsvImportPanel facility={selectedFacility} canWrite={selectedFacility.role === "admin"} />
        <InventoryPanel
          course={selectedFacility}
          inventory={inventory}
          loading={loadingInventory}
          error={inventoryError}
          canWrite={writable}
          onCreate={createInventoryItem}
          onUpdate={updateInventoryItem}
          onDelete={deleteInventoryItem}
        />
        </div>
      );

    case "company-inventory":
      return <CompanyInventoryPanel facility={selectedFacility} />;

    case "profile":
      return (
        <ProfilePanel
          employee={employee}
          onUpdateProfile={async (payload) => {
            const updatedEmployee = await api.updateProfile(payload);
            setEmployee(updatedEmployee);
          }}
          onChangePassword={async (payload) => {
            await api.changePassword(payload);
          }}
        />
      );

    default:
      return null;
  }
}
