import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "@/services/api";

export default function ServiceTemplatesManager({ open, onOpenChange, facility }) {
  const [templates, setTemplates] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // list, create
  
  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parts, setParts] = useState([]); // { inventoryId, quantity }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && facility) {
      fetchData();
    }
  }, [open, facility]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [tpls, inv] = await Promise.all([
        api.get(`/service-templates?facilityId=${facility.facility_id}`),
        api.get(`/parts-inventory?facilityId=${facility.facility_id}`)
      ]);
      setTemplates(tpls);
      setInventory(inv);
    } catch (err) {
      setError(err.message || "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSaving(true);
    setError("");
    try {
      const created = await api.post('/service-templates', {
        facilityId: facility.facility_id,
        name,
        description,
        parts: parts.filter(p => p.inventoryId && p.quantity > 0)
      });
      setTemplates([...templates, created]);
      setView("list");
      setName("");
      setDescription("");
      setParts([]);
    } catch (err) {
      setError(err.message || "Failed to create template.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.delete(`/service-templates/${id}?facilityId=${facility.facility_id}`);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      alert("Failed to delete template: " + err.message);
    }
  };

  const addPart = () => setParts([...parts, { inventoryId: "", quantity: 1 }]);
  
  const updatePart = (index, key, value) => {
    const newParts = [...parts];
    newParts[index][key] = value;
    setParts(newParts);
  };

  const removePart = (index) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {view === "list" ? "Manage Service Templates" : "Create New Template"}
          </DialogTitle>
        </DialogHeader>

        {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : view === "list" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Service templates auto-populate work orders.</p>
              <Button onClick={() => setView("create")}><Plus className="w-4 h-4 mr-2" /> New Template</Button>
            </div>
            
            {templates.length === 0 ? (
              <div className="text-center p-8 border border-dashed rounded-lg text-gray-500">
                No templates found for this facility.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Parts Attached</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{t.description}</p>
                        </TableCell>
                        <TableCell>
                          {t.parts?.length || 0} items
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(t.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Template Name (e.g. Mower Belt Replacement)</label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Standard Work Detail / Instructions</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Required Parts (Auto-populated on ticket)</label>
                <Button type="button" variant="outline" size="sm" onClick={addPart}>
                  <Plus className="w-4 h-4 mr-2" /> Add Part
                </Button>
              </div>
              
              {parts.length === 0 ? (
                <div className="text-sm text-gray-500 italic p-3 border rounded">No parts attached.</div>
              ) : (
                <div className="space-y-2">
                  {parts.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select value={p.inventoryId} onValueChange={(val) => updatePart(idx, "inventoryId", val)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select an inventory part" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map(inv => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.sku} - {inv.part_description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        type="number" 
                        min="1" 
                        step="0.1"
                        className="w-24" 
                        value={p.quantity} 
                        onChange={e => updatePart(idx, "quantity", Number(e.target.value))} 
                        placeholder="Qty" 
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removePart(idx)}>
                        <Trash2 className="w-4 h-4 text-gray-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setView("list")} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || !name}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Template
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
