import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ImagePlus, Loader2, Plus, Save, Wrench, QrCode, Download, Search } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";
import QRScanner from "@/components/common/QRScanner";
import { downloadCSV } from "@/lib/csv";

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
  const [showScanner, setShowScanner] = useState(false);
  const [search, setSearch] = useState("");

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return equipment;

    return equipment.filter((item) => {
      const haystack = [
        item.name,
        item.make,
        item.model,
        item.assigned_area,
        item.serial_number,
        item.vin,
        item.status,
        item.description,
        item.detail,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return query
        .split(/\s+/)
        .every((token) => haystack.includes(token));
    });
  }, [equipment, search]);

  const selectedItem = useMemo(
    () => equipment.find((item) => item.id === selectedId) || null,
    [equipment, selectedId],
  );

  function handleExport() {
    const data = equipment.map(item => ({
      Name: item.name || 'N/A',
      Make: item.make || '',
      Model: item.model || '',
      'Serial Number': item.serial_number || '',
      VIN: item.vin || '',
      'Assigned Area': item.assigned_area || '',
      Status: item.status || '',
      Hours: item.hours || 0,
      'Last Updated': item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'New'
    }));
    downloadCSV(`TurfOp_Equipment_${new Date().toISOString().split('T')[0]}.csv`, data);
  }

  useEffect(() => {
    if (!selectedItem) return;
    setEditForm(toEditForm(selectedItem));
    setEditError("");
  }, [selectedItem]);

  function handleScan(decodedText) {
    setShowScanner(false);
    
    // 1. Try parsing as JSON
    try {
      // Clean up string before parsing in case scanner caught stray characters
      const cleanText = decodedText.trim();
      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        const data = JSON.parse(cleanText);
        setForm(prev => ({
          ...prev,
          name: data.name || data.title || prev.name,
          make: data.make || data.manufacturer || prev.make,
          model: data.model || prev.model,
          serialNumber: data.serialNumber || data.serial_number || data.serial || prev.serialNumber,
          vin: data.vin || prev.vin,
          assignedArea: data.assignedArea || data.assigned_area || data.area || prev.assignedArea,
        }));
        return;
      }
    } catch (e) {
      // not JSON, continue
    }

    // 2. Try parsing as URL
    try {
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const potentialId = pathParts[pathParts.length - 1];
        setForm(prev => ({ ...prev, serialNumber: potentialId }));
      } else {
        setForm(prev => ({ ...prev, serialNumber: decodedText }));
      }
      return;
    } catch (e) {
      // not a URL, continue
    }

    // 3. Fallback to setting it as the serial number directly
    setForm(prev => ({ ...prev, serialNumber: decodedText }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      await onCreate({
        ...form,
        facilityId: course.facility_id || course.course_id,
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
        facilityId: selectedItem.facility_id || selectedItem.course_id,
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
            Facility-scoped equipment for {course.name}. Records from other facilities are never loaded into this view.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} className="shrink-0" disabled={!equipment.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Badge variant="outline">{course.company_name}</Badge>
        </div>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Add equipment
              <Button type="button" variant="outline" size="sm" onClick={() => setShowScanner(true)} className="ml-auto">
                <QrCode className="h-4 w-4 mr-2" />
                Scan QR
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-3 lg:grid-cols-9" onSubmit={handleSubmit}>
              <Input className="lg:col-span-2" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <Input placeholder="Make" value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
              <Input placeholder="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
              <Input placeholder="Serial #" value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} />
              <Input placeholder="VIN" value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value })} />
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
          <div className="border-b p-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search equipment (name, make, model, serial, area, status)..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading equipment
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-400">{error}</div>
          ) : equipment.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No equipment has been added for this facility.</div>
          ) : filteredEquipment.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No equipment matches your search.</div>
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
                {filteredEquipment.map((item) => (
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

      {showScanner && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
          title="Scan Equipment QR"
        />
      )}
    </div>
  );
}
