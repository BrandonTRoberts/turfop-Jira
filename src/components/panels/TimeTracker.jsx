import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Loader2, Play, Square } from "lucide-react";

export default function TimeTracker({ course, entries, summary, activeEntry, loading, error, canAdmin, onClockIn, onClockOut }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  async function handleClockIn() {
    setSaving(true);
    setActionError("");
    try {
      await onClockIn(note);
      setNote("");
    } catch (clockError) {
      setActionError(clockError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClockOut() {
    setSaving(true);
    setActionError("");
    try {
      await onClockOut(note);
      setNote("");
    } catch (clockError) {
      setActionError(clockError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Time Tracking</h2>
          <p className="mt-2 text-sm text-muted-foreground">Clock activity for {course.name} is stored by course and employee.</p>
        </div>
        <Badge variant={activeEntry ? "default" : "secondary"} className="w-fit">
          {activeEntry ? "Clocked in" : "Clocked out"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Current shift
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeEntry ? (
            <div>
              <p className="text-sm text-muted-foreground">Clocked in</p>
              <p className="text-3xl font-semibold">{format(new Date(activeEntry.clock_in_at), "MMM d, h:mm a")}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active shift for this course.</p>
          )}
          <Input placeholder="Optional note" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button onClick={activeEntry ? handleClockOut : handleClockIn} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : activeEntry ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {activeEntry ? "Clock out" : "Clock in"}
          </Button>
          {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}
        </CardContent>
      </Card>

      {canAdmin && summary ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Weekly hours</p><p className="mt-2 text-3xl font-semibold">{summary.totals.totalHours}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Active shifts</p><p className="mt-2 text-3xl font-semibold">{summary.totals.activeEntries}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Pending approvals</p><p className="mt-2 text-3xl font-semibold">{summary.totals.totalEntries - summary.totals.approvedEntries}</p></CardContent></Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent time entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading time entries</div>
          ) : error ? (
            <div className="p-10 text-center text-red-400">{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No time entries yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.employee_name || entry.employee_email}</TableCell>
                    <TableCell>{format(new Date(entry.clock_in_at), "MMM d, h:mm a")}</TableCell>
                    <TableCell>{entry.clock_out_at ? format(new Date(entry.clock_out_at), "MMM d, h:mm a") : "Active"}</TableCell>
                    <TableCell>{Number(entry.worked_hours || 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={entry.approved_at ? "default" : "outline"}>{entry.approved_at ? "Approved" : "Open"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
