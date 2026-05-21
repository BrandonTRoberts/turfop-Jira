import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { readFilesAsDataUrls } from "@/lib/files";

export default function CreateWorkOrderDialog({
  open,
  onOpenChange,
  course,
  form,
  setForm,
  users,
  equipment,
  inventory,
  statuses,
  saving,
  error,
  setError,
  onSubmit,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-border bg-background text-foreground sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create issue</DialogTitle>
          <DialogDescription>New work order issue in {course.name}.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
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
                  setError(uploadError.message);
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
                  setError(uploadError.message);
                }
              }}
            />
          </label>
          {form.attachments.length ? <p className="text-xs text-muted-foreground">{form.attachments.length} file(s) selected.</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
