import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, User } from "lucide-react";
import { format } from "date-fns";

export default function TimeTracker() {
  const [currentUser, setCurrentUser] = useState("Brandon Roberts");
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [timeLogs, setTimeLogs] = useState([]);

  const handleClockIn = () => {
    const now = new Date();
    setClockInTime(now);
    setIsClockedIn(true);
    console.log(`Clocked in at ${format(now, "hh:mm a")}`);
  };

  const handleClockOut = () => {
    if (!clockInTime) return;
    const now = new Date();
    const duration = Math.round((now - clockInTime) / 1000 / 60); // minutes

    setTimeLogs(prev => [{
      id: Date.now(),
      user: currentUser,
      date: format(now, "MMM d"),
      clockIn: format(clockInTime, "hh:mm a"),
      clockOut: format(now, "hh:mm a"),
      duration: `${duration} min`
    }, ...prev]);

    setIsClockedIn(false);
    setClockInTime(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold">Time Tracking</h2>
        <Badge variant={isClockedIn ? "default" : "secondary"} className="text-lg px-4 py-1">
          {isClockedIn ? "🟢 Clocked In" : "⚪ Clocked Out"}
        </Badge>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Current Shift</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          {isClockedIn ? (
            <div>
              <p className="text-6xl font-mono mb-4 text-emerald-500">
                {clockInTime && format(new Date(), "hh:mm:ss a")}
              </p>
              <Button variant="destructive" size="lg" onClick={handleClockOut}>
                <Square className="mr-2 h-5 w-5" /> Clock Out
              </Button>
            </div>
          ) : (
            <Button size="lg" onClick={handleClockIn}>
              <Play className="mr-2 h-5 w-5" /> Clock In Now
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Recent Time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {timeLogs.length > 0 ? (
            <div className="space-y-3">
              {timeLogs.map(log => (
                <div key={log.id} className="flex justify-between items-center bg-zinc-950 p-4 rounded-lg">
                  <div>
                    <p className="font-medium">{log.user}</p>
                    <p className="text-sm text-zinc-500">{log.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{log.clockIn} → {log.clockOut}</p>
                    <p className="text-emerald-500 font-medium">{log.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 py-8 text-center">No time logs yet. Clock in to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
