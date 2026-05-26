import { CheckCircle2, Circle, Clock3, TriangleAlert } from "lucide-react";
import { isPriorityStatus } from "./issueWorkflow";

export const emptyTicket = {
  title: "",
  detail: "",
  status: "Open",
  assignee: "",
  equipmentId: "none",
  dueAt: "",
  partInventoryId: "none",
  quantityUsed: "",
  comment: "",
  images: [],
  attachments: [],
};

export function ticketKey(ticket) {
  return `TOP-${String(ticket.id || "").slice(0, 8).toUpperCase()}`;
}

export function statusBadgeVariant(status) {
  if (status === "Completed") return "default";
  if (isPriorityStatus(status)) return "destructive";
  return "outline";
}

export function statusIcon(status) {
  if (status === "Completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (isPriorityStatus(status)) return <TriangleAlert className="h-3.5 w-3.5 text-red-400" />;
  if (status === "In Progress") return <Clock3 className="h-3.5 w-3.5 text-blue-400" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function buildUpdatePayload(ticket, draft) {
  return {
    facilityId: ticket.facility_id || ticket.course_id,
    title: draft.title,
    detail: draft.detail,
    status: draft.status,
    assignee: draft.assignee,
    equipmentId: draft.equipmentId === "none" ? null : draft.equipmentId,
    dueAt: draft.dueAt || null,
    technicianEmployeeId: ticket.technician_employee_id,
    technicianName: ticket.technician_name,
    laborHours: ticket.labor_hours,
    completedWorkNotes: ticket.completed_work_notes,
    completedAt: draft.status === "Completed" ? (ticket.completed_at || new Date().toISOString()) : ticket.completed_at,
    partUsages: draft.partInventoryId && draft.partInventoryId !== "none" && Number(draft.quantityUsed || 0) > 0
      ? [{ partInventoryId: draft.partInventoryId, quantityUsed: Number(draft.quantityUsed) }]
      : ticket.part_usages?.map((usage) => ({ partInventoryId: usage.part_inventory_id, quantityUsed: Number(usage.quantity_used || 0) })) || [],
    images: draft.images?.length ? [...(ticket.image_urls || []), ...draft.images] : ticket.image_urls || [],
    attachments: draft.attachments?.length ? [...(ticket.attachments || []), ...draft.attachments] : ticket.attachments || [],
    expectedUpdatedAt: ticket.updated_at,
  };
}
