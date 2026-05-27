import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";

const inventoryTemplate = "sku,part_description,quantity_on_hand,unit_cost,reorder_url,facility\nSKU-100,Fertilizer 16-4-8,12,39.99,https://supplier.example/fert16,Main Facility";
const equipmentTemplate = "name,make,model,assigned_area,status,detail,facility\nFairway Mower,John Deere,7500A,Fairway 1-9,Operational,Weekly service complete,Main Facility";

export default function CsvImportPanel({ facility, canWrite }) {
  const [entityType, setEntityType] = useState('inventory');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createFacilities, setCreateFacilities] = useState(true);

  async function runPreview() {
    setError('');
    setMessage('');
    try {
      const result = await api.previewCsvImport({ facilityId: facility.facility_id, entityType, csvText });
      setPreview(result);
    } catch (err) {
      setError(err.message || 'Preview failed');
    }
  }

  async function runImport() {
    setError('');
    setMessage('');
    try {
      const result = await api.commitCsvImport({ facilityId: facility.facility_id, entityType, csvText, createFacilities });
      setMessage(`Imported ${result.inserted} rows${result.createdFacilityIds?.length ? `, created ${result.createdFacilityIds.length} facilities` : ''}.`);
      setPreview((current) => current ? { ...current, importErrors: result.errors || [] } : current);
    } catch (err) {
      setError(err.message || 'Import failed');
    }
  }

  if (!canWrite) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Bulk import inventory or equipment. Include a facility column to map cross-facility records.</p>
        <Select value={entityType} onValueChange={setEntityType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inventory">Inventory</SelectItem><SelectItem value="equipment">Equipment</SelectItem></SelectContent></Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvText(entityType === 'inventory' ? inventoryTemplate : equipmentTemplate)}>Load sample template</Button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createFacilities} onChange={(e)=>setCreateFacilities(e.target.checked)} /> Auto-create missing facilities</label>
        </div>
        <Input value={csvText} onChange={(e)=>setCsvText(e.target.value)} placeholder="Paste CSV content here" />
        <div className="flex gap-2"><Button onClick={runPreview}>Preview</Button><Button onClick={runImport}>Import</Button></div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {preview ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Rows: {preview.rowCount} | Errors: {(preview.errors || []).length}</p>
            <Table><TableHeader><TableRow>{(preview.headers || []).map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{(preview.preview || []).map((r,i)=><TableRow key={i}>{(preview.headers || []).map((h)=><TableCell key={h}>{String(r[h]||'')}</TableCell>)}</TableRow>)}</TableBody></Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
