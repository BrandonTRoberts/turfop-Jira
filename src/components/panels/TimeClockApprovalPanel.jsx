import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";

export default function TimeClockApprovalPanel({ facility, canAdmin }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await api.timeClockApproval(facility.facility_id, { from, to });
      setEntries(data);
    } catch (err) {
      setError(err.message || "Failed to load time clock approvals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (canAdmin) load(); }, [facility?.facility_id]);

  async function approve(entry, approvalState) {
    const clockInAt = window.prompt("Clock-in (ISO)", entry.clock_in_at) || entry.clock_in_at;
    const clockOutAt = window.prompt("Clock-out (ISO, blank for open)", entry.clock_out_at || "") || null;
    const note = window.prompt("Audit note", "") || "";
    await api.updateTimeClockApproval(entry.id, { facilityId: facility.facility_id, clockInAt, clockOutAt, approvalState, note });
    await load();
  }

  if (!canAdmin) return <p className="text-sm text-muted-foreground">Admin only.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Time Clock Approval</h2>
        <p className="text-sm text-muted-foreground">Approve, reject, and edit clock-in/clock-out records with audit trail.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input type="datetime-local" value={from} onChange={(e)=>setFrom(e.target.value)} />
          <Input type="datetime-local" value={to} onChange={(e)=>setTo(e.target.value)} />
          <Button onClick={load} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : null}Refresh</Button>
        </CardContent>
      </Card>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Facility</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {entries.map((entry)=>(<TableRow key={entry.id}><TableCell>{entry.employee_name}</TableCell><TableCell>{entry.facility_name}</TableCell><TableCell>{new Date(entry.clock_in_at).toLocaleString()}</TableCell><TableCell>{entry.clock_out_at ? new Date(entry.clock_out_at).toLocaleString() : 'Open'}</TableCell><TableCell>{entry.approved_at ? 'Approved' : 'Pending'}</TableCell><TableCell className="flex gap-2"><Button size="sm" onClick={()=>approve(entry,'approved')}>Approve/Edit</Button><Button size="sm" variant="destructive" onClick={()=>approve(entry,'rejected')}>Reject</Button></TableCell></TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
