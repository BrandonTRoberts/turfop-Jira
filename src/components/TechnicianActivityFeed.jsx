import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, UserCircle2, Activity } from "lucide-react";

export default function TechnicianActivityFeed({ 
  course = { name: "Current Course" }, 
  users = [], 
  workOrders = [], 
  onRefresh = () => window.location.reload() 
}) {
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    if (!users || !users.length) {
      setTechnicians([]);
      return;
    }

    const activeTechnicians = users
      .filter(user => user && (user.role !== "admin"))
      .map(user => {
        const currentWork = workOrders.find(
          wo => wo && (wo.assignee === (user.name || user.full_name) || wo.technician_name === (user.name || user.full_name)) && 
                (wo.status === "In Progress" || wo.status === "Open")
        );

        const isOnline = Math.random() > 0.3; // 70% chance for demo - replace with real last_seen logic later

        return {
          id: user.id,
          name: user.name || user.full_name || "Unknown",
          currentWork: currentWork ? {
            id: currentWork.id,
            title: currentWork.title || "Untitled Work",
            status: currentWork.status,
            updatedAt: currentWork.updated_at || new Date().toISOString()
          } : null,
          isOnline,
          lastActivity: currentWork ? currentWork.updated_at : new Date(Date.now() - Math.random() * 3600000).toISOString()
        };
      })
      .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    setTechnicians(activeTechnicians);
  }, [users, workOrders]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Live Technician Activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Real-time view of field team • {technicians.length} technicians on {course?.name || "course"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {technicians.map(tech => (
            <div key={tech.id} className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {tech.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{tech.name}</p>
                  {tech.currentWork ? (
                    <p className="text-sm text-muted-foreground line-clamp-1 pr-8">
                      {tech.currentWork.title}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Idle - No active work</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <Badge variant={tech.isOnline ? "default" : "secondary"} className={tech.isOnline ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""}>
                  {tech.isOnline ? "● Online" : "Offline"}
                </Badge>
                
                {tech.currentWork && (
                  <Badge variant="outline" className="text-xs">
                    {tech.currentWork.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {technicians.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No field technicians found for this course yet.
            </div>
          )}
        </div>

        <button
          onClick={onRefresh}
          className="mt-6 w-full text-sm flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 py-2 border border-blue-200 rounded-md hover:bg-blue-50"
        >
          <Clock className="h-4 w-4" />
          Refresh Live Feed
        </button>
      </CardContent>
    </Card>
  );
}
