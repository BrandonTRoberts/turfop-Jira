import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";

const inventoryTemplate = "sku,part_description,quantity_on_hand,unit_cost,reorder_url,facility\nSKU-100,Fertilizer 16-4-8,12,39.99,https://supplier.example/fert16,Main Facility";
const equipmentTemplate = "name,make,model,assigned_area,status,detail,facility\nFairway Mower,John Deere,7500A,Fairway 1-9,Operational,Weekly service complete,Main Facility";
const IMPORT_SCHEMA = {
  inventory: {
    required: ['sku', 'part_description', 'quantity_on_hand', 'facility'],
    allowed: ['sku', 'part_description', 'quantity_on_hand', 'unit_cost', 'reorder_url', 'facility']
  },
  equipment: {
    required: ['name', 'facility', 'status'],
    allowed: ['name', 'make', 'model', 'assigned_area', 'status', 'detail', 'facility']
  }
};

function parseCsvHeader(csvText = '') {
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim().length);
  if (!firstLine) return [];
  return firstLine
    .split(',')
    .map((cell) => String(cell || '').trim().toLowerCase())
    .filter(Boolean);
}

function validateImportColumns(entityType, csvText) {
  const schema = IMPORT_SCHEMA[entityType];
  if (!schema) return { ok: true, errors: [], headers: [] };

  const headers = parseCsvHeader(csvText);
  if (!headers.length) {
    return { ok: false, errors: ['No header row found. Add a header row as the first line.'], headers };
  }

  const missing = schema.required.filter((key) => !headers.includes(key));
  const unsupported = headers.filter((key) => !schema.allowed.includes(key));
  const errors = [];
  if (missing.length) errors.push(`Missing required columns: ${missing.join(', ')}`);
  if (unsupported.length) errors.push(`Unsupported columns: ${unsupported.join(', ')}. Allowed columns: ${schema.allowed.join(', ')}`);

  return { ok: errors.length === 0, errors, headers };
}

export default function CsvImportPanel({ facility, canWrite }) {
  const [entityType, setEntityType] = useState('inventory');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createFacilities, setCreateFacilities] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);

  async function parseSpreadsheetFile(file) {
    const lowerName = (file?.name || '').toLowerCase();
    if (lowerName.endsWith('.csv')) {
      return file.text();
    }

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.ods')) {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        throw new Error('Spreadsheet has no sheets.');
      }
      const worksheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
    }

    throw new Error('Unsupported file type. Use .csv, .xlsx, .xls, or .ods.');
  }

  async function downloadTemplate(format = 'csv') {
    const templateText = entityType === 'inventory' ? inventoryTemplate : equipmentTemplate;
    const baseName = entityType === 'inventory' ? 'inventory-import-template' : 'equipment-import-template';

    if (format === 'csv') {
      const blob = new Blob([templateText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const rows = templateText.split('\n').map((line) => line.split(','));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Import');
    XLSX.writeFile(workbook, `${baseName}.${format}`);
  }

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setMessage('');
    setPreview(null);
    setUploadingFile(true);

    try {
      const parsedCsvText = await parseSpreadsheetFile(file);
      setCsvText(parsedCsvText);
      setMessage(`Loaded ${file.name}. Ready for preview/import.`);
    } catch (err) {
      setError(err.message || 'Failed to read file.');
    } finally {
      setUploadingFile(false);
    }
  }

  async function runPreview() {
    setError('');
    setMessage('');
    try {
      const validation = validateImportColumns(entityType, csvText);
      if (!validation.ok) {
        setError(validation.errors.join(' | '));
        return;
      }
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
      const validation = validateImportColumns(entityType, csvText);
      if (!validation.ok) {
        setError(validation.errors.join(' | '));
        return;
      }
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
        <CardTitle>Import Inventory/Equipment Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Bulk import inventory or equipment. Upload CSV/XLS/XLSX/ODS or paste CSV text. Include a facility column to map cross-facility records.</p>
        <Select value={entityType} onValueChange={setEntityType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inventory">Inventory</SelectItem><SelectItem value="equipment">Equipment</SelectItem></SelectContent></Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvText(entityType === 'inventory' ? inventoryTemplate : equipmentTemplate)}>Load sample template</Button>
          <Button variant="outline" onClick={() => downloadTemplate('csv')}>Download CSV template</Button>
          <Button variant="outline" onClick={() => downloadTemplate('xlsx')}>Download XLSX template</Button>
          <Button variant="outline" onClick={() => downloadTemplate('ods')}>Download ODS template</Button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createFacilities} onChange={(e)=>setCreateFacilities(e.target.checked)} /> Auto-create missing facilities</label>
        </div>
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground hover:bg-muted/30"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFile(event.dataTransfer?.files?.[0]);
          }}
        >
          <span className="font-medium text-foreground">Drop CSV/XLS/XLSX/ODS here or click to upload</span>
          <span className="text-xs">Supported: .csv, .xlsx, .xls, .ods</span>
          <input
            className="hidden"
            type="file"
            accept=".csv,.xlsx,.xls,.ods"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        <Input value={csvText} onChange={(e)=>setCsvText(e.target.value)} placeholder="Paste CSV content here" />
        <div className="flex gap-2"><Button onClick={runPreview} disabled={uploadingFile || !csvText.trim()}>Preview</Button><Button onClick={runImport} disabled={uploadingFile || !csvText.trim()}>Import</Button></div>
        {uploadingFile ? <p className="text-sm text-muted-foreground">Reading file…</p> : null}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {preview ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Rows: {preview.rowCount} | Header errors: {(preview.errors || []).length} | Row errors: {(preview.rowErrors || []).length}</p>
            {(preview.errors || []).length ? (
              <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                <p className="font-medium">Header validation issues</p>
                <ul className="list-disc pl-4">
                  {preview.errors.map((item, index) => (<li key={`header-error-${index}`}>{item}</li>))}
                </ul>
              </div>
            ) : null}
            {(preview.rowErrors || []).length ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                <p className="font-medium">Row validation issues (first 25)</p>
                <ul className="list-disc pl-4">
                  {preview.rowErrors.slice(0, 25).map((item, index) => (
                    <li key={`row-error-${index}`}>Line {item.line}: {item.error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(preview.importErrors || []).length ? (
              <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                <p className="font-medium">Import errors</p>
                <ul className="list-disc pl-4">
                  {preview.importErrors.slice(0, 25).map((item, index) => (
                    <li key={`import-error-${index}`}>Line {item.line}: {item.error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Table><TableHeader><TableRow>{(preview.headers || []).map((h)=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{(preview.preview || []).map((r,i)=><TableRow key={i}>{(preview.headers || []).map((h)=><TableCell key={h}>{String(r[h]||'')}</TableCell>)}</TableRow>)}</TableBody></Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
