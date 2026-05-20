import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, Clock3, Loader2, MessageSquare, Package, Plus, Save, Search, TriangleAlert, UserCircle2, Wrench } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";

const statuses = ["Open", "High", "Due today", "In Progress", "Blocked", "Completed"];
const priorityStatuses = new Set(["High", "Due today", "Blocked"]);

const emptyTicket = {
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

function ticketKey(ticket) {
  return `TOP-${String(ticket.id || "").slice(0, 8).toUpperCase()}`;
}

function statusBadgeVariant(status) {
  if (status === "Completed") return "default";
  if (priorityStatuses.has(status)) return "destructive";
  return "outline";
}

function statusIcon(status) {
  if (status === "Completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (priorityStatuses.has(status)) return <TriangleAlert className="h-3.5 w-3.5 text-red-400" />;
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
            <section
              key={status}
              className="min-h-0 rounded-md bg-card xl:min-h-[560px]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const ticketId = event.dataTransfer.getData("text/plain");
                const ticket = workOrders.find((item) => item.id === ticketId);
                if (ticket) moveTicket(ticket, status);
              }}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  {statusIcon(status)}
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{status}</h3>
                </div>
                <Badge variant="secondary">{grouped[status].length}</Badge>
              </div>
              <div className="space-y-2 p-2">
                {grouped[status].map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    draggable={canWrite}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", ticket.id)}
                    onClick={() => setSelectedTicket(ticket)}
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create issue</DialogTitle>
            <DialogDescription>New work order issue in {course.name}.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <Input placeholder="Summary" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <Textarea placeholder="Description" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.assignee || "unassigned"} onValueChange={(assignee) => setForm({ ...form, assignee: assignee === "unassigned" ? "" : assignee })}>
                <SelectTrigger><SelectValue placeholder="Assignee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => <SelectItem key={user.id} value={user.name}>{user.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.equipmentId} onValueChange={(equipmentId) => setForm({ ...form, equipmentId })}>
                <SelectTrigger><SelectValue placeholder="Equipment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No equipment</SelectItem>
                  {equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
              <Select value={form.partInventoryId} onValueChange={(partInventoryId) => setForm({ ...form, partInventoryId })}>
                <SelectTrigger><SelectValue placeholder="Inventory part" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No part usage</SelectItem>
                  {inventory.map((item) => <SelectItem key={item.id} value={item.id}>{item.sku} - {item.part_description}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min="0" step="0.01" placeholder="Qty used" value={form.quantityUsed} onChange={(event) => setForm({ ...form, quantityUsed: event.target.value })} />
            </div>
            <label className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
              Add images
              <input
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={async (event) => {
                  try {
                    const images = await readFilesAsDataUrls(event.target.files, { maxFiles: 6 });
                    setForm({ ...form, images });
                  } catch (uploadError) {
                    setFormError(uploadError.message);
                  }
                }}
              />
            </label>
            {form.images.length ? <p className="text-xs text-muted-foreground">{form.images.length} image(s) selected.</p> : null}
            <label className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
              Add files
              <input
                className="hidden"
                type="file"
                multiple
                accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,image/*,.heic,.heif"
                onChange={async (event) => {
                  try {
                    const attachments = await readFilesAsDataUrls(event.target.files, { maxFiles: 12, imageOnly: false });
                    setForm({ ...form, attachments });
                  } catch (uploadError) {
                    setFormError(uploadError.message);
                  }
                }}
              />
            </label>
            {form.attachments.length ? <p className="text-xs text-muted-foreground">{form.attachments.length} file(s) selected.</p> : null}
            {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create issue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTicket)} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto border-border bg-background p-0 text-foreground sm:max-w-5xl">
          {selectedTicket ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6 p-4 sm:p-6">
                <DialogHeader>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-blue-400">{ticketKey(selectedTicket)}</span>
                    <Badge variant="outline" className="rounded-md">Task</Badge>
                    <Badge variant={statusBadgeVariant(detailDraft.status)}>{detailDraft.status}</Badge>
                  </div>
                  <DialogTitle className="sr-only">{selectedTicket.title}</DialogTitle>
                </DialogHeader>

                <Input
                  className="h-auto border-transparent bg-transparent px-0 text-xl font-semibold leading-tight shadow-none focus-visible:ring-0 sm:text-2xl"
                  value={detailDraft.title}
                  onChange={(event) => setDetailDraft({ ...detailDraft, title: event.target.value })}
                  disabled={!canWrite}
                />

                <section>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Description</h4>
                  <Textarea
                    className="min-h-40 border-border bg-card"
                    value={detailDraft.detail}
                    onChange={(event) => setDetailDraft({ ...detailDraft, detail: event.target.value })}
                    disabled={!canWrite}
                    placeholder="Add a description..."
                  />
                </section>

                <section>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Images</h4>
                  {(selectedTicket.image_urls || []).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {selectedTicket.image_urls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border bg-card">
                          <img src={getUploadUrl(url)} alt="" className="h-28 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No images attached.</p>
                  )}
                  {canWrite ? (
                    <label className="mt-3 flex h-9 cursor-pointer items-center justify-center rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
                      Add images
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (event) => {
                          try {
                            const images = await readFilesAsDataUrls(event.target.files, { maxFiles: 6 });
                            setDetailDraft({ ...detailDraft, images });
                          } catch (uploadError) {
                            setDetailError(uploadError.message);
                          }
                        }}
                      />
                    </label>
                  ) : null}
                  {detailDraft.images.length ? <p className="mt-2 text-xs text-muted-foreground">{detailDraft.images.length} new image(s) ready. Save changes to upload.</p> : null}
                </section>

                <section>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">Files</h4>
                  {(selectedTicket.attachments || []).length > 0 ? (
                    <div className="space-y-2">
                      {selectedTicket.attachments.map((file) => (
                        <a key={file.url} href={getUploadUrl(file.url)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm hover:border-blue-500">
                          <span>{file.name || file.url.split("/").pop()}</span>
                          <Badge variant="outline">{file.mimeType || "file"}</Badge>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No files attached.</p>
                  )}
                  {canWrite ? (
                    <label className="mt-3 flex h-9 cursor-pointer items-center justify-center rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
                      Add files
                      <input
                        className="hidden"
                        type="file"
                        multiple
                        accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,image/*,.heic,.heif"
                        onChange={async (event) => {
                          try {
                            const attachments = await readFilesAsDataUrls(event.target.files, { maxFiles: 12, imageOnly: false });
                            setDetailDraft({ ...detailDraft, attachments });
                          } catch (uploadError) {
                            setDetailError(uploadError.message);
                          }
                        }}
                      />
                    </label>
                  ) : null}
                  {detailDraft.attachments.length ? <p className="mt-2 text-xs text-muted-foreground">{detailDraft.attachments.length} new file(s) ready. Save changes to upload.</p> : null}
                </section>

                <section>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Package className="h-4 w-4" />
                    Parts used
                  </h4>
                  {(selectedTicket.part_usages || []).length > 0 ? (
                    <div className="space-y-2">
                      {selectedTicket.part_usages.map((usage) => (
                      <div key={usage.id} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <span>{usage.sku} - {usage.part_description}</span>
                          <Badge variant="outline">{Number(usage.quantity_used).toLocaleString()}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No inventory usage linked.</p>
                  )}
                </section>

                {canWrite ? (
                  <section>
                    <h4 className="mb-2 text-sm font-semibold text-foreground">Add comment</h4>
                    <Textarea
                      className="min-h-20 border-border bg-card"
                      value={detailDraft.comment}
                      onChange={(event) => setDetailDraft({ ...detailDraft, comment: event.target.value })}
                      placeholder="Leave a comment..."
                    />
                    <Button className="mt-2" variant="outline" onClick={addComment} disabled={saving || !detailDraft.comment.trim()}>
                      <MessageSquare className="h-4 w-4" />
                      Comment
                    </Button>
                  </section>
                ) : null}

                {canWrite ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button onClick={() => saveSelectedTicket()} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save changes
                    </Button>
                    {detailError ? <p className="text-sm text-red-400">{detailError}</p> : null}
                  </div>
                ) : null}

                <section>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquare className="h-4 w-4" />
                    Activity
                  </h4>
                  <div className="space-y-2">
                    {(selectedTicket.activity_log || []).length > 0 ? (
                      selectedTicket.activity_log.map((activity) => (
                        <div key={activity.id} className="rounded-md border border-border bg-card p-3 text-sm">
                          <p className="font-medium capitalize">{activity.actor_name || activity.actor_email || "System"} {activity.action.replace("_", " ")}</p>
                          <p className="text-xs text-muted-foreground">{new Date(activity.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No activity yet.</p>
                    )}
                  </div>
                </section>
              </div>

              <aside className="border-t border-border bg-card p-4 sm:p-6 lg:border-l lg:border-t-0">
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <Select value={detailDraft.status} onValueChange={updateSelectedStatus} disabled={!canWrite || saving}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignee</p>
                    <Select value={detailDraft.assignee || "unassigned"} onValueChange={(assignee) => setDetailDraft({ ...detailDraft, assignee: assignee === "unassigned" ? "" : assignee })} disabled={!canWrite}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users.map((user) => <SelectItem key={user.id} value={user.name}>{user.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Wrench className="h-3.5 w-3.5" />Equipment</p>
                    <Select value={detailDraft.equipmentId} onValueChange={(equipmentId) => setDetailDraft({ ...detailDraft, equipmentId })} disabled={!canWrite}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No equipment</SelectItem>
                        {equipment.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due date</p>
                    <Input type="date" value={detailDraft.dueAt} onChange={(event) => setDetailDraft({ ...detailDraft, dueAt: event.target.value })} disabled={!canWrite} />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add part usage</p>
                    <div className="space-y-2">
                      <Select value={detailDraft.partInventoryId} onValueChange={(partInventoryId) => setDetailDraft({ ...detailDraft, partInventoryId })} disabled={!canWrite}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No part selected</SelectItem>
                          {inventory.map((item) => <SelectItem key={item.id} value={item.id}>{item.sku} - {item.part_description}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min="0" step="0.01" placeholder="Qty used" value={detailDraft.quantityUsed} onChange={(event) => setDetailDraft({ ...detailDraft, quantityUsed: event.target.value })} disabled={!canWrite} />
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course</p>
                    <p className="mt-1 text-sm">{course.name}</p>
                    <p className="text-xs text-muted-foreground">{course.company_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                      <p className="mt-1">{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleDateString() : "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
                      <p className="mt-1">{selectedTicket.updated_at ? new Date(selectedTicket.updated_at).toLocaleDateString() : "Unknown"}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                    This issue is backed by a course-scoped work order. Backend permissions decide whether this account can see or edit it.
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
