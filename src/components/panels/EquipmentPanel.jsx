import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ImagePlus, Loader2, Plus, Save, Wrench } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";

const emptyForm = {
  name: "",
  make: "",
  model: "",
  assignedArea: "",
  serialNumber: "",
  hours: "",
  status: "Operational",
  images: [],
  attachments: [],
};

function toEditForm(item) {
  return {
    name: item?.name || "",
    make: item?.make || "",
    model: item?.model || "",
    assignedArea: item?.assigned_area || "",
    serialNumber: item?.serial_number || "",
    vin: item?.vin || "",
    hours: item?.hours || "",
    status: item?.status || "Operational",
    description: item?.description || "",
    detail: item?.detail || "",
    images: item?.image_urls || [],
    attachments: item?.attachments || [],
  };
}

export default function EquipmentPanel({ course, equipment, loading, error, canWrite, onCreate, onUpdate }) {
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  const selectedItem = useMemo(
    () => equipment.find((item) => item.id === selectedId) || null,
    [equipment, selectedId],
  );

  useEffect(() => {
    if (!selectedItem) return;
    setEditForm(toEditForm(selectedItem));
    setEditError("");
  }, [selectedItem?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      await onCreate({
        ...form,
        courseId: course.course_id,
        vin: "",
        description: "",
        detail: "",
        images: form.images,
        attachments: form.attachments,
      });
      setForm(emptyForm);
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedItem) return;

    setEditError("");
    setSavingEdit(true);

    try {
      await onUpdate(selectedItem.id, {
        ...editForm,
        courseId: selectedItem.course_id,
        images: editForm.images,
        attachments: editForm.attachments,
        expectedUpdatedAt: selectedItem.updated_at,
      });
    } catch (submitError) {
      setEditError(submitError.message);
    } finally {
      setSavingEdit(false);
    }
  }

  if (selectedItem) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Button type="button" variant="ghost" className="mb-3 px-0" onClick={() => setSelectedId("")}>
              <ArrowLeft className="h-4 w-4" />
              Equipment
            </Button>
            <h2 className="text-3xl font-semibold">{selectedItem.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit equipment details, photos, files, and service status for {course.name}.
            </p>
          </div>
          <Badge variant={selectedItem.status === "Needs Repair" ? "destructive" : "outline"}>{selectedItem.status}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleUpdate}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input placeholder="Name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required disabled={!canWrite} />
                  <Select value={editForm.status} onValueChange={(status) => setEditForm({ ...editForm, status })} disabled={!canWrite}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operational">Operational</SelectItem>
                      <SelectItem value="In Service">In Service</SelectItem>
                      <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Make" value={editForm.make} onChange={(event) => setEditForm({ ...editForm, make: event.target.value })} disabled={!canWrite} />
                  <Input placeholder="Model" value={editForm.model} onChange={(event) => setEditForm({ ...editForm, model: event.target.value })} disabled={!canWrite} />
                  <Input placeholder="Area" value={editForm.assignedArea} onChange={(event) => setEditForm({ ...editForm, assignedArea: event.target.value })} disabled={!canWrite} />
                  <Input placeholder="Serial number" value={editForm.serialNumber} onChange={(event) => setEditForm({ ...editForm, serialNumber: event.target.value })} disabled={!canWrite} />
                  <Input placeholder="VIN" value={editForm.vin} onChange={(event) => setEditForm({ ...editForm, vin: event.target.value })} disabled={!canWrite} />
                  <Input placeholder="Hours" value={editForm.hours} onChange={(event) => setEditForm({ ...editForm, hours: event.target.value })} disabled={!canWrite} />
                </div>
                <Textarea placeholder="Description" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} disabled={!canWrite} />
                <Textarea placeholder="Notes / service detail" value={editForm.detail} onChange={(event) => setEditForm({ ...editForm, detail: event.target.value })} disabled={!canWrite} />

                {canWrite ? (
                  <div className="flex flex-wrap gap-3">
                    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
                      <ImagePlus className="h-4 w-4" />
                      Replace photos
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (event) => {
                          try {
                            const images = await readFilesAsDataUrls(event.target.files, { maxFiles: 6 });
                            setEditForm({ ...editForm, images });
                          } catch (uploadError) {
                            setEditError(uploadError.message);
                          }
                        }}
                      />
                    </label>
                    <label className="flex h-9 cursor-pointer items-center justify-center rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
                      Replace files
                      <input
                        className="hidden"
                        type="file"
                        multiple
                        accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,image/*,.heic,.heif"
                        onChange={async (event) => {
                          try {
                            const attachments = await readFilesAsDataUrls(event.target.files, { maxFiles: 12, imageOnly: false });
                            setEditForm({ ...editForm, attachments });
                          } catch (uploadError) {
                            setEditError(uploadError.message);
                          }
                        }}
                      />
                    </label>
                  </div>
                ) : null}

                {editError ? <p className="text-sm text-red-400">{editError}</p> : null}
                <Button type="submit" disabled={!canWrite || savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent>
                {editForm.images.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {editForm.images.map((image, index) => (
                      <img key={`${image}-${index}`} src={getUploadUrl(image)} alt="" className="aspect-square rounded-lg object-cover" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos attached.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {editForm.attachments.length ? editForm.attachments.map((attachment, index) => (
                  <a key={`${attachment.url}-${index}`} className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href={getUploadUrl(attachment.url)} target="_blank" rel="noreferrer">
                    {attachment.name || attachment.url}
                  </a>
                )) : <p className="text-sm text-muted-foreground">No files attached.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Equipment</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Course-scoped equipment for {course.name}. Records from other courses are never loaded into this view.
          </p>
        </div>
        <Badge variant="outline">{course.company_name}</Badge>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Add equipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-3 lg:grid-cols-7" onSubmit={handleSubmit}>
              <Input className="lg:col-span-2" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <Input placeholder="Make" value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
              <Input placeholder="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
              <Input placeholder="Area" value={form.assignedArea} onChange={(event) => setForm({ ...form, assignedArea: event.target.value })} />
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operational">Operational</SelectItem>
                  <SelectItem value="In Service">In Service</SelectItem>
                  <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
              <label className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input px-2.5 text-sm text-foreground hover:bg-muted">
                <ImagePlus className="h-4 w-4" />
                Photos
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
              <label className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-input px-2.5 text-sm text-foreground hover:bg-muted">
                Files
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
            </form>
            {form.images.length ? <p className="mt-2 text-xs text-muted-foreground">{form.images.length} photo(s) selected.</p> : null}
            {form.attachments.length ? <p className="mt-1 text-xs text-muted-foreground">{form.attachments.length} file attachment(s) selected.</p> : null}
            {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading equipment
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-400">{error}</div>
          ) : equipment.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No equipment has been added for this course.</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Make / Model</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {item.image_urls?.[0] ? <img src={getUploadUrl(item.image_urls[0])} alt="" className="h-9 w-9 rounded object-cover" /> : null}
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>{[item.make, item.model].filter(Boolean).join(" ") || "Unspecified"}</TableCell>
                    <TableCell>{item.assigned_area || "Unassigned"}</TableCell>
                    <TableCell><Badge variant={item.status === "Needs Repair" ? "destructive" : "outline"}>{item.status}</Badge></TableCell>
                    <TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "New"}</TableCell>
                    <TableCell>{item.attachments?.length || 0} files</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
