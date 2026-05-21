import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Package, Save, Wrench } from "lucide-react";
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
  course,
  addComment,
  saveSelectedTicket,
  updateSelectedStatus,
  setDetailError,
}) {
  return (
      <Dialog open={Boolean(selectedTicket)} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] overflow-y-auto border-border bg-background p-0 text-foreground sm:max-w-5xl">
          {selectedTicket ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6 p-4 sm:p-6">
                <DialogHeader>
                  <DialogDescription className="sr-only">
                    View and update work order details, attachments, parts, comments, and status.
                  </DialogDescription>
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
  );
}
