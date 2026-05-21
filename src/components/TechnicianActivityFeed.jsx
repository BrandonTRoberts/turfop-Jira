import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, UserCircle2, CheckCircle2, AlertCircle } from "lucide-react";

export default function TechnicianActivityFeed({ course, users, workOrders, onRefresh }) {
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    if (!users || !workOrders) return;

    const activeTechnicians = users
      .filter(user => user.role !== "admin") // focus on field technicians
      .map(user => {
        const currentWork = workOrders.find(
          wo => wo.technician_name === user.name && 
                (wo.status === "In Progress" || wo.status === "Open")
        );

        return {
          id: user.id,
          name: user.name,
          currentWork: currentWork ? {
            id: currentWork.id,
            title: currentWork.title,
            status: currentWork.status,
            updatedAt: currentWork.updated_at
          } : null,
          isOnline: true, // TODO: replace with real heartbeat/last_seen logic
          lastActivity: currentWork ? currentWork.updated_at : null
        };
      });

    setTechnicians(activeTechnicians);
  }, [users, workOrders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5" />
          Technician Activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Live view of what your team is working on • {technicians.length} technicians
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {technicians.map(tech => (
            <div key={tech.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{tech.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{tech.name}</p>
                  {tech.currentWork ? (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {tech.currentWork.title}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Idle</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {tech.isOnline ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span>
                    Online
                  </Badge>
                ) : (
                  <Badge variant="outline">Offline</Badge>
                )}

                {tech.currentWork && (
                  <Badge variant="secondary">
                    {tech.currentWork.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {technicians.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No technicians found for this course yet.
            </p>
          )}
        </div>

        <button
          onClick={onRefresh}
          className="mt-4 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Clock className="h-3 w-3" />
          Refresh activity feed
        </button>
      </CardContent>
    </Card>
  );
}
