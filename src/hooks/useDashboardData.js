import { useEffect, useState } from "react";
import { api } from "@/services/api";

function mapDirectoryRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name || row.email || "Unnamed user",
    email: row.email,
    facilityId: row.facility_id || row.course_id,
    courseId: row.course_id,
    role: row.role || "read_only",
    status: row.must_change_password ? "Invited" : "Active",
    profileImageUrl: row.profile_image_url,
    hourlyRate: row.hourly_rate,
  }));
}

export function useDashboardData(selectedFacility) {
  const [equipment, setEquipment] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [users, setUsers] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [equipmentError, setEquipmentError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [workOrdersError, setWorkOrdersError] = useState("");
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    const activeFacilityId = selectedFacility?.facility_id || selectedFacility?.course_id;
    if (!activeFacilityId) return;

    setLoadingDashboard(true);
    setDashboardError("");
    api.dashboardOverview(activeFacilityId)
      .then(setDashboardOverview)
      .catch((error) => {
        setDashboardOverview(null);
        setDashboardError(error.message);
      })
      .finally(() => setLoadingDashboard(false));

    setLoadingEquipment(true);
    setEquipmentError("");
    api.equipment(activeFacilityId)
      .then(setEquipment)
      .catch((error) => setEquipmentError(error.message))
      .finally(() => setLoadingEquipment(false));

    setLoadingInventory(true);
    setInventoryError("");
    api.inventory(activeFacilityId)
      .then(setInventory)
      .catch((error) => setInventoryError(error.message))
      .finally(() => setLoadingInventory(false));

    setUsersError("");
    api.facilityDirectory(activeFacilityId)
      .then((rows) => setUsers(mapDirectoryRows(rows)))
      .catch((error) => {
        setUsers([]);
        setUsersError(error.message);
      });

    setLoadingWorkOrders(true);
    setWorkOrdersError("");
    api.workOrders(activeFacilityId)
      .then(setWorkOrders)
      .catch((error) => setWorkOrdersError(error.message))
      .finally(() => setLoadingWorkOrders(false));
  }, [selectedFacility?.facility_id, selectedFacility?.course_id]);

  function resetDashboardData() {
    setEquipment([]);
    setInventory([]);
    setUsers([]);
    setWorkOrders([]);
    setDashboardOverview(null);
  }

  return {
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
  };
}

export { mapDirectoryRows };
