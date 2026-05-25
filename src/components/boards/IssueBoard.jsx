import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CreateWorkOrderDialog from "./CreateWorkOrderDialog";
import WorkOrderDetailDialog from "./WorkOrderDetailDialog";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, Clock3, Loader2, Plus, Search, TriangleAlert, UserCircle2 } from "lucide-react";
import { getWorkOrderColumnLabel, isPriorityStatus, WORK_ORDER_STATUSES } from "./issueWorkflow";

const statuses = WORK_ORDER_STATUSES;

const emptyTicket = {
  title: "",
  detail: "",
  status: "Open",
  assignee: "",
  equipmentId: "none",
  dueAt: "",
  partInventoryId: "none",
  quantityUsed: "",
  partUsages: [],
  completedWorkNotes: "",
  comment: "",
  images: [],
  attachments: [],
};

function ticketKey(ticket) {
  return `TOP-${String(ticket.id || "").slice(0, 8).toUpperCase()}`;
}

function statusBadgeVariant(status) {
  if (status === "Completed") return "default";
  if (isPriorityStatus(status)) return "destructive";
  return "outline";
}

function statusIcon(status) {
  if (status === "Completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (isPriorityStatus(status)) return <TriangleAlert className="h-3.5 w-3.5 text-red-400" />;
  if (status === "In Progress") return <Clock3 className="h-3.5 w-3.5 text-blue-400" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function buildUpdatePayload(ticket, draft) {
  return {
    courseId: ticket.course_id,
    title: draft.title,
    detail: draft.detail,
    status: draft.status,
    assignee: draft.assignee,
    equipmentId: draft.equipmentId === "none" ? null : draft.equipmentId,
    dueAt: draft.dueAt || null,
    technicianEmployeeId: ticket.technician_employee_id,
    technicianName: ticket.technician_name,
    laborHours: ticket.labor_hours,
    completedWorkNotes: draft.completedWorkNotes ?? ticket.completed_work_notes,
    completedAt: draft.status === "Completed" ? (ticket.completed_at || new Date().toISOString()) : ticket.completed_at,
    partUsages: Array.isArray(draft.partUsages)
      ? draft.partUsages
        .filter((usage) => usage.partInventoryId && usage.partInventoryId !== "none" && Number(usage.quantityUsed || 0) > 0)
        .map((usage) => ({ partInventoryId: usage.partInventoryId, quantityUsed: Number(usage.quantityUsed) }))
      : draft.partInventoryId && draft.partInventoryId !== "none" && Number(draft.quantityUsed || 0) > 0
        ? [{ partInventoryId: draft.partInventoryId, quantityUsed: Number(draft.quantityUsed) }]
        : ticket.part_usages?.map((usage) => ({ partInventoryId: usage.part_inventory_id, quantityUsed: Number(usage.quantity_used || 0) })) || [],
    images: draft.images?.length ? [...(ticket.image_urls || []), ...draft.images] : ticket.image_urls || [],
    attachments: draft.attachments?.length ? [...(ticket.attachments || []), ...draft.attachments] : ticket.attachments || [],
    expectedUpdatedAt: ticket.updated_at,
  };
}

function TicketCard({ ticket, canWrite, onOpen }) {
  return (
    <button
      type="button"
      draggable={canWrite}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", ticket.id)}
      onClick={() => onOpen(ticket)}
      className="w-full rounded-md border border-border bg-background p-3 text-left shadow-sm transition-colors hover:border-blue-500 hover:bg-muted"
    >
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="rounded-md">Task</Badge>
        <span className="font-mono text-xs text-blue-400">{ticketKey(ticket)}</span>
      </div>
      <p className="text-sm font-medium leading-5 text-foreground sm:min-h-10">{ticket.title}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant={statusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserCircle2 className="h-4 w-4" />
          <span className="max-w-20 truncate">{ticket.assignee || ticket.technician_name || "Open"}</span>
        </div>
      </div>
      {ticket.due_at || ticket.equipment_id ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {ticket.due_at ? <span>Due {new Date(ticket.due_at).toLocaleDateString()}</span> : null}
          {ticket.equipment_id ? <span>Equipment linked</span> : null}
        </div>
      ) : null}
    </button>
  );
}

function BoardColumn({ status, tickets, workOrders, canWrite, onMoveTicket, onOpenTicket }) {
  const label = getWorkOrderColumnLabel(status);

  return (
    <section
      aria-label={label}
      className="min-h-0 rounded-md bg-card xl:min-h-[560px]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const ticketId = event.dataTransfer.getData("text/plain");
        const ticket = workOrders.find((item) => String(item.id) === String(ticketId));
        if (ticket) onMoveTicket(ticket, status);
      }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          {statusIcon(status)}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
        </div>
        <Badge variant="secondary">{tickets.length}</Badge>
      </div>
      <div className="space-y-2 p-2">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} canWrite={canWrite} onOpen={onOpenTicket} />
        ))}
      </div>
    </section>
  );
}


export default function IssueBoard({ course, workOrders, users = [], equipment = [], inventory = [], loading, error, canWrite, onCreate, onUpdate, onComment }) {
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailDraft, setDetailDraft] = useState(emptyTicket);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyTicket);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!selectedTicket) return;
    setDetailDraft({
      title: selectedTicket.title || "",
      detail: selectedTicket.detail || "",
      status: selectedTicket.status || "Open",
      assignee: selectedTicket.assignee || "",
      equipmentId: selectedTicket.equipment_id || "none",
      dueAt: selectedTicket.due_at ? selectedTicket.due_at.slice(0, 10) : "",
      partInventoryId: "none",
      quantityUsed: "",
      partUsages: selectedTicket.part_usages?.map((usage) => ({
        partInventoryId: usage.part_inventory_id,
        quantityUsed: String(usage.quantity_used || ""),
      })) || [],
      completedWorkNotes: selectedTicket.completed_work_notes || "",
      comment: "",
      images: [],
      attachments: [],
    });
  }, [selectedTicket]);

  const filteredTickets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workOrders;
    return workOrders.filter((ticket) => (
      ticketKey(ticket).toLowerCase().includes(needle)
      || String(ticket.title || "").toLowerCase().includes(needle)
      || String(ticket.assignee || ticket.technician_name || "").toLowerCase().includes(needle)
      || String(ticket.status || "").toLowerCase().includes(needle)
    ));
  }, [query, workOrders]);

  const grouped = useMemo(() => {
    return statuses.reduce((acc, status) => {
      acc[status] = filteredTickets.filter((ticket) => ticket.status === status);
      return acc;
    }, {});
  }, [filteredTickets]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const created = await onCreate({
        courseId: course.course_id,
        title: form.title,
        detail: form.detail,
        status: form.status,
        assignee: form.assignee,
        equipmentId: form.equipmentId === "none" ? null : form.equipmentId,
        dueAt: form.dueAt || null,
        partUsages: form.partInventoryId && form.partInventoryId !== "none" && Number(form.quantityUsed || 0) > 0
          ? [{ partInventoryId: form.partInventoryId, quantityUsed: Number(form.quantityUsed) }]
          : [],
        images: form.images,
        attachments: form.attachments,
      });
      setSelectedTicket(created);
      setForm(emptyTicket);
      setCreateOpen(false);
    } catch (createError) {
      setFormError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedTicket(nextDraft = detailDraft) {
    if (!selectedTicket) return null;
    setSaving(true);
    setDetailError("");

    try {
      const updated = await onUpdate(selectedTicket.id, buildUpdatePayload(selectedTicket, nextDraft));
      setSelectedTicket(updated);
      return updated;
    } catch (updateError) {
      setDetailError(updateError.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function updateSelectedStatus(status) {
    if (status === "Completed" && !detailDraft.completedWorkNotes?.trim()) {
      setDetailError("Work completed description is required before marking a work order completed.");
      return;
    }

    const nextDraft = { ...detailDraft, status };
    setDetailDraft(nextDraft);
    await saveSelectedTicket(nextDraft);
  }

  async function moveTicket(ticket, status) {
    if (!canWrite || ticket.status === status) return;
    const nextDraft = {
      title: ticket.title || "",
      detail: ticket.detail || "",
      status,
      assignee: ticket.assignee || "",
      equipmentId: ticket.equipment_id || "none",
      dueAt: ticket.due_at ? ticket.due_at.slice(0, 10) : "",
      partInventoryId: "none",
      quantityUsed: "",
      comment: "",
      images: [],
      attachments: [],
    };
    await onUpdate(ticket.id, buildUpdatePayload(ticket, nextDraft));
  }

  async function addComment() {
    if (!selectedTicket || !detailDraft.comment.trim()) return;
    setSaving(true);
    setDetailError("");
    try {
      const activity = await onComment(selectedTicket.id, {
        courseId: selectedTicket.course_id,
        comment: detailDraft.comment,
      });
      setSelectedTicket({
        ...selectedTicket,
        activity_log: [activity, ...(selectedTicket.activity_log || [])],
      });
      setDetailDraft({ ...detailDraft, comment: "" });
    } catch (commentError) {
      setDetailError(commentError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Projects</span>
            <span>/</span>
            <span>{course.company_name}</span>
            <span>/</span>
            <span className="text-foreground">{course.name}</span>
          </div>
          <h2 className="text-2xl font-semibold sm:text-3xl">Board</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-full pl-8 sm:w-72" placeholder="Search tickets" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {canWrite ? (
            <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Work Order
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tickets
        </Card>
      ) : error ? (
        <Card className="border-border bg-card p-10 text-center text-red-400">{error}</Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-6">
          {statuses.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tickets={grouped[status]}
              workOrders={workOrders}
              canWrite={canWrite}
              onMoveTicket={moveTicket}
              onOpenTicket={setSelectedTicket}
            />
          ))}
        </div>
      )}

      <CreateWorkOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        course={course}
        form={form}
        setForm={setForm}
        users={users}
        equipment={equipment}
        inventory={inventory}
        statuses={statuses}
        saving={saving}
        error={formError}
        setError={setFormError}
        onSubmit={handleCreate}
      />

      <WorkOrderDetailDialog
        selectedTicket={selectedTicket}
        setSelectedTicket={setSelectedTicket}
        detailDraft={detailDraft}
        setDetailDraft={setDetailDraft}
        canWrite={canWrite}
        saving={saving}
        detailError={detailError}
        statuses={statuses}
        users={users}
        equipment={equipment}
        inventory={inventory}
        course={course}
        addComment={addComment}
        saveSelectedTicket={saveSelectedTicket}
        updateSelectedStatus={updateSelectedStatus}
        setDetailError={setDetailError}
      />
    </div>
  );
}



