import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ImagePlus, Loader2, PackagePlus, Save, Trash2, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";
import QRScanner from "@/components/common/QRScanner";

const emptyForm = {
  sku: "",
  partDescription: "",
  quantityOnHand: "",
  unitCost: "",
  reorderUrl: "",
  images: [],
  attachments: [],
};

function toEditForm(item) {
  return {
    sku: item?.sku || "",
    partDescription: item?.part_description || "",
    quantityOnHand: item?.quantity_on_hand ?? "",
    unitCost: item?.unit_cost ?? "",
    reorderUrl: item?.reorder_url || "",
    images: item?.image_urls || [],
    attachments: item?.attachments || [],
  };
}

export default function InventoryPanel({ course, inventory, loading, error, canWrite, onCreate, onUpdate, onDelete }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [scannerMode, setScannerMode] = useState(null); // null, 'add', 'search'

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === selectedId) || null,
    [inventory, selectedId],
  );

  useEffect(() => {
    if (!selectedItem) return;
    setEditForm(toEditForm(selectedItem));
    setEditError("");
  }, [selectedItem]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter((item) => [item.sku, item.part_description].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [inventory, search]);

  const lowStockCount = inventory.filter((item) => Number(item.quantity_on_hand) <= 0).length;

  function handleScan(decodedText) {
    const currentMode = scannerMode;
    setScannerMode(null);
    
    // If scanning for search, just dump the text/sku directly into the search bar
    if (currentMode === 'search') {
      try {
        const data = JSON.parse(decodedText);
        setSearch(data.sku || data.serialNumber || data.id || decodedText);
        return;
      } catch (e) {
        try {
          const url = new URL(decodedText);
          setSearch(url.pathname.split('/').filter(Boolean).pop() || decodedText);
          return;
        } catch (e2) {
          setSearch(decodedText);
          return;
        }
      }
    }

    // Otherwise, it's 'add' mode
    // 1. Try JSON
    try {
      const cleanText = decodedText.trim();
      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        const data = JSON.parse(cleanText);
        setForm(prev => ({
          ...prev,
          sku: data.sku || data.serialNumber || data.id || prev.sku,
          partDescription: data.partDescription || data.description || data.name || prev.partDescription,
          unitCost: data.unitCost || data.cost || data.price || prev.unitCost,
          reorderUrl: data.reorderUrl || data.url || prev.reorderUrl,
        }));
        return;
      }
    } catch (e) {
      // not JSON
    }

    // 2. Try URL
    try {
      const url = new URL(decodedText);
      setForm(prev => ({ 
        ...prev, 
        reorderUrl: decodedText, 
        sku: url.pathname.split('/').filter(Boolean).pop() || prev.sku 
      }));
      return;
    } catch (e) {
      // not URL
    }

    // 3. Plain text fallback
    setForm(prev => ({ ...prev, sku: decodedText }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      await onCreate({
        courseId: course.course_id,
        sku: form.sku,
        partDescription: form.partDescription,
        quantityOnHand: Number(form.quantityOnHand || 0),
        unitCost: Number(form.unitCost || 0),
        reorderUrl: form.reorderUrl,
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
        courseId: selectedItem.course_id,
        sku: editForm.sku,
        partDescription: editForm.partDescription,
        quantityOnHand: Number(editForm.quantityOnHand || 0),
        unitCost: Number(editForm.unitCost || 0),
        reorderUrl: editForm.reorderUrl,
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
              Inventory
            </Button>
            <h2 className="break-words text-2xl font-semibold sm:text-3xl">{selectedItem.part_description}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit SKU, stock, cost, reorder details, photos, and files for {course.name}.
            </p>
          </div>
          <Badge variant={Number(selectedItem.quantity_on_hand) <= 0 ? "destructive" : "outline"}>
            {Number(selectedItem.quantity_on_hand).toLocaleString()} on hand
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleUpdate}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input placeholder="SKU" value={editForm.sku} onChange={(event) => setEditForm({ ...editForm, sku: event.target.value })} required disabled={!canWrite} />
                  <Input placeholder="Description" value={editForm.partDescription} onChange={(event) => setEditForm({ ...editForm, partDescription: event.target.value })} required disabled={!canWrite} />
                  <Input type="number" min="0" step="0.01" placeholder="Quantity on hand" value={editForm.quantityOnHand} onChange={(event) => setEditForm({ ...editForm, quantityOnHand: event.target.value })} disabled={!canWrite} />
                  <Input type="number" min="0" step="0.01" placeholder="Unit cost" value={editForm.unitCost} onChange={(event) => setEditForm({ ...editForm, unitCost: event.target.value })} disabled={!canWrite} />
                  <Input className="md:col-span-2" placeholder="Reorder URL" value={editForm.reorderUrl} onChange={(event) => setEditForm({ ...editForm, reorderUrl: event.target.value })} disabled={!canWrite} />
                </div>

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

                {selectedItem.reorder_url ? (
                  <a className="inline-block text-sm text-emerald-500 hover:underline" href={selectedItem.reorder_url} target="_blank" rel="noreferrer">
                    Open current reorder URL
                  </a>
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
          <h2 className="text-2xl font-semibold sm:text-3xl">Inventory</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Parts inventory for {course.name}. SKU uniqueness is enforced inside this course only.
          </p>
        </div>
        <Badge variant="outline">{course.company_name}</Badge>
      </div>

      {lowStockCount > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-500 bg-red-950 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <span>{lowStockCount} inventory items have no stock on hand.</span>
        </div>
      ) : null}

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-4 w-4" />
              Add part
              <Button type="button" variant="outline" size="sm" onClick={() => setScannerMode('add')} className="ml-auto">
                <QrCode className="h-4 w-4 mr-2" />
                Scan QR
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-3 lg:grid-cols-7" onSubmit={handleSubmit}>
              <Input placeholder="SKU / Number" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
              <Input className="lg:col-span-2" placeholder="Description" value={form.partDescription} onChange={(event) => setForm({ ...form, partDescription: event.target.value })} required />
              <Input type="number" min="0" step="0.01" placeholder="Qty" value={form.quantityOnHand} onChange={(event) => setForm({ ...form, quantityOnHand: event.target.value })} />
              <Input type="number" min="0" step="0.01" placeholder="Unit cost" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} />
              <Input placeholder="Reorder URL" value={form.reorderUrl} onChange={(event) => setForm({ ...form, reorderUrl: event.target.value })} />
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
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

      <div className="flex gap-3 relative">
        <Input placeholder="Search inventory..." value={search} onChange={(event) => setSearch(event.target.value)} className="pr-10" />
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setScannerMode('search')}
          title="Scan barcode/QR to search"
        >
          <QrCode className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inventory
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-400">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No inventory items found for this course.</div>
          ) : (
            <div className="overflow-x-auto">
            <div className="divide-y divide-border md:hidden">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full p-4 text-left"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-start gap-3">
                    {item.image_urls?.[0] ? <img src={getUploadUrl(item.image_urls[0])} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.part_description}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                        <Badge variant={Number(item.quantity_on_hand) <= 0 ? "destructive" : "outline"}>
                          {Number(item.quantity_on_hand).toLocaleString()}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>${Number(item.unit_cost || 0).toFixed(2)} each</span>
                        <span>{item.attachments?.length || 0} files</span>
                        <span>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "New"}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {item.image_urls?.[0] ? <img src={getUploadUrl(item.image_urls[0])} alt="" className="h-9 w-9 rounded object-cover" /> : null}
                        {item.part_description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={Number(item.quantity_on_hand) <= 0 ? "destructive" : "outline"}>
                        {Number(item.quantity_on_hand).toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>${Number(item.unit_cost || 0).toFixed(2)}</TableCell>
                    <TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "New"}</TableCell>
                    <TableCell>{item.attachments?.length || 0} files</TableCell>
                    <TableCell>
                      {canWrite && typeof onDelete === "function" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Delete inventory item ${item.sku}?`)) {
                              onDelete(item.id, { expectedUpdatedAt: item.updated_at });
                            }
                          }}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scannerMode && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setScannerMode(null)} 
          title={scannerMode === 'search' ? "Scan to Search" : "Scan Inventory QR"}
        />
      )}
    </div>
  );
}
