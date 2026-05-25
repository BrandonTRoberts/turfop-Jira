import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Package, Save, Wrench, Plus, Trash2 } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";
import { statusBadgeVariant, ticketKey } from "./issueBoardUtils";

export default function WorkOrderDetailDialog({
  selectedTicket,
  setSelectedTicket,
  detailDraft,
  setDetailDraft,
  canWrite,
  saving,
  detailError,
  statuses,
  users,
  equipment,
  inventory,
  _course,
  _addComment,
  saveSelectedTicket,
  updateSelectedStatus,
  setDetailError,
}) {
  const partUsages = Array.isArray(detailDraft.partUsages) ? detailDraft.partUsages : [];

  const addPartUsage = () => {
    setDetailDraft({
      ...detailDraft,
      partUsages: [
        ...partUsages,
        { partInventoryId: "none", quantityUsed: "" }
      ]
    });
  };

  const updatePartUsage = (index, field, value) => {
    const updatedUsages = [...partUsages];
    updatedUsages[index] = { ...updatedUsages[index], [field]: value };
    setDetailDraft({ ...detailDraft, partUsages: updatedUsages });
  };

  const removePartUsage = (index) => {
    const updatedUsages = partUsages.filter((_, i) => i !== index);
    setDetailDraft({ ...detailDraft, partUsages: updatedUsages });
  };

  const handleSave = () => {
    const validPartUsages = partUsages.filter(
      (usage) => usage.partInventoryId && usage.partInventoryId !== "none" && Number(usage.quantityUsed || 0) > 0
    );
    saveSelectedTicket({ ...detailDraft, partUsages: validPartUsages });
  };

  return (
    <Dialog open={Boolean(selectedTicket)} onOpenChange={(open) => !open && setSelectedTicket(null)}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto border-border bg-background p-0 text-foreground sm:max-w-5xl">
        {selectedTicket && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
            {/* Main Content */}
            <div className="space-y-6 p-4 sm:p-6">
              <DialogHeader>
                <DialogDescription className="sr-only">
                  View and update work order details, attachments, parts used, comments, and status.
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-blue-400">{ticketKey(selectedTicket)}</span>
                  <Badge variant="outline" className="rounded-md">Work Order</Badge>
                  <Badge variant={statusBadgeVariant(detailDraft.status)}>{detailDraft.status}</Badge>
                </div>
                <DialogTitle className="sr-only">{selectedTicket.title}</DialogTitle>
              </DialogHeader>

              {/* Title */}
              <Input
                className="h-auto border-transparent bg-transparent px-0 text-xl font-semibold leading-tight shadow-none focus-visible:ring-0 sm:text-2xl"
                value={detailDraft.title}
                onChange={(event) => setDetailDraft({ ...detailDraft, title: event.target.value })}
                disabled={!canWrite}
              />

              {/* Description */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Description</h4>
                <Textarea
                  className="min-h-40 border-border bg-card"
                  value={detailDraft.detail || ""}
                  onChange={(event) => setDetailDraft({ ...detailDraft, detail: event.target.value })}
                  disabled={!canWrite}
                  placeholder="Describe the issue..."
                />
              </section>

              {/* Images */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Images</h4>
                {(selectedTicket.image_urls || []).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {selectedTicket.image_urls.map((url) => (
                      <a key={url} href={getUploadUrl(url)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border bg-card">
                        <img src={getUploadUrl(url)} alt="" className="h-28 w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No images attached.</p>
                )}
                {canWrite && (
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
                )}
                {detailDraft.images && detailDraft.images.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {detailDraft.images.length} new image(s) ready to save.
                  </p>
                )}
              </section>

              {/* Attachments */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Attachments</h4>
                {(selectedTicket.attachments || []).length > 0 ? (
                  <div className="space-y-2">
                    {selectedTicket.attachments.map((file) => (
                      <a 
                        key={file.url} 
                        href={getUploadUrl(file.url)} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm hover:border-blue-500"
                      >
                        <span>{file.name || file.url.split("/").pop()}</span>
                        <Badge variant="outline">{file.mimeType || "file"}</Badge>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No files attached.</p>
                )}
                {canWrite && (
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
                )}
                {detailDraft.attachments && detailDraft.attachments.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {detailDraft.attachments.length} new file(s) ready to save.
                  </p>
                )}
              </section>

              {/* Parts Used - Multiple Support */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Parts Used (Auto-Deducts from Inventory)
                </h4>
                <div className="space-y-3 border border-border rounded-md p-4 bg-card">
                  {partUsages.map((usage, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Select 
                          value={usage.partInventoryId || "none"}
                          onValueChange={(val) => updatePartUsage(index, "partInventoryId", val)}
                          disabled={!canWrite}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select part" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No part used</SelectItem>
                            {inventory.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.sku} - {item.part_description} (Stock: {item.quantity_on_hand})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="Qty" 
                        value={usage.quantityUsed || ""} 
                        onChange={(event) => updatePartUsage(index, "quantityUsed", event.target.value)}
                        className="w-24"
                        disabled={!canWrite}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removePartUsage(index)}
                        disabled={!canWrite}
                        className="text-red-500 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {canWrite && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={addPartUsage}
                      className="w-full flex items-center justify-center gap-2 text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      Add Part Usage
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Parts will be automatically deducted from inventory on save. Over-deduct prevented by backend.
                </p>
              </section>

              {/* Work Completed - Mandatory for Buyer */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  Work Completed Description <span className="text-red-500 text-xs">(required for completion)</span>
                </h4>
                <Textarea
                  className="min-h-[100px] border-border bg-card focus-visible:ring-1"
                  value={detailDraft.completedWorkNotes || ""}
                  onChange={(event) => setDetailDraft({ ...detailDraft, completedWorkNotes: event.target.value })}
                  disabled={!canWrite}
                  placeholder="Describe exactly what was done, parts used, issues found, recommendations..."
                  required
                />
              </section>

              {/* Save */}
              {canWrite && (
                <Button onClick={handleSave} disabled={saving || (detailDraft.status === "Completed" && !detailDraft.completedWorkNotes?.trim())} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}

              {detailError && <p className="text-red-500 text-sm text-center">{detailError}</p>}

              {/* Activity Log */}
              <section>
                <h4 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Activity History
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-3 border border-border rounded-md p-3 bg-card">
                  {(selectedTicket.activity_log || []).length > 0 ? (
                    selectedTicket.activity_log.map((log) => {
                      const detailText = (() => {
                        if (log.detail == null || log.detail === '') return '';
                        if (typeof log.detail === 'string') return log.detail;
                        try {
                          return JSON.stringify(log.detail);
                        } catch {
                          return '[detail unavailable]';
                        }
                      })();

                      return (
                        <div key={log.id} className="text-xs border-l-2 border-blue-500 pl-3">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{log.actor_name || "System"}</span>
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                          <p className="mt-1 text-foreground">{detailText || log.action}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-4">No activity yet.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Sidebar */}
            <aside className="border-t border-border bg-card p-6 lg:border-l lg:border-t-0 space-y-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Status</div>
                <Select value={detailDraft.status} onValueChange={updateSelectedStatus} disabled={!canWrite}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Assigned To</div>
                <Select 
                  value={detailDraft.assignee || "unassigned"} 
                  onValueChange={(val) => setDetailDraft({ ...detailDraft, assignee: val === "unassigned" ? "" : val })} 
                  disabled={!canWrite}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.name || user.full_name}>
                        {user.name || user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Equipment</div>
                <Select 
                  value={detailDraft.equipmentId || "none"} 
                  onValueChange={(val) => setDetailDraft({ ...detailDraft, equipmentId: val === "none" ? "" : val })} 
                  disabled={!canWrite}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No equipment</SelectItem>
                    {equipment.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Due Date</div>
                <Input 
                  type="date" 
                  value={detailDraft.dueAt || ""} 
                  onChange={(event) => setDetailDraft({ ...detailDraft, dueAt: event.target.value })} 
                  disabled={!canWrite} 
                />
              </div>

              <div className="pt-6 border-t text-xs text-muted-foreground">
                All changes are logged for audit. Course-scoped permissions enforced by backend.
              </div>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
