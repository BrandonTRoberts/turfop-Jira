import { useState, useMemo, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

import { Plus, Search, LayoutGrid, List, BarChart3, Sun, Moon } from "lucide-react";
import { format, isPast } from "date-fns";

const STORAGE_KEY = "turfop-issues";

export default function App() {
  const [issues, setIssues] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  const [view, setView] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const stats = useMemo(() => ({
    total: issues.length,
    inProgress: issues.filter(i => i.status === "In Progress").length,
    done: issues.filter(i => i.status === "Done").length,
    overdue: issues.filter(i => i.dueDate && isPast(new Date(i.dueDate))).length,
  }), [issues]);

  // Dynamic Burndown Data
  const burndownData = useMemo(() => {
    return [
      { day: "1", ideal: 42, actual: 42 },
      { day: "3", ideal: 35, actual: 38 },
      { day: "5", ideal: 28, actual: 32 },
      { day: "7", ideal: 21, actual: 25 },
      { day: "10", ideal: 14, actual: 18 },
      { day: "14", ideal: 0, actual: 9 },
    ];
  }, []);

  const filteredIssues = issues.filter(issue =>
    issue.title?.toLowerCase().includes(search.toLowerCase())
  );

  const issuesByStatus = useMemo(() => {
    const grouped = {};
    ["To Do", "In Progress", "Review", "Done"].forEach(status => {
      grouped[status] = filteredIssues.filter(i => i.status === status);
    });
    return grouped;
  }, [filteredIssues]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setIssues(prev => arrayMove(prev, prev.findIndex(i => i.id === active.id), prev.findIndex(i => i.id === over.id)));
  };

  function KanbanCard({ issue }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
      <Card 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-4 bg-zinc-900 border border-zinc-700 hover:border-blue-500 transition-all"
        onClick={() => setSelectedIssue(issue)}
      >
        <div className="font-mono text-xs text-blue-400 mb-2">{issue.id}</div>
        <p className="font-medium mb-4 line-clamp-3">{issue.title}</p>
        <div className="flex justify-between items-center">
          <Badge variant="outline">{issue.priority || "Medium"}</Badge>
          {issue.assignee && <Avatar className="w-7 h-7"><AvatarFallback>{issue.assignee[0]}</AvatarFallback></Avatar>}
        </div>
      </Card>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark bg-zinc-950 text-white' : 'bg-zinc-50'}`}>
      {/* Sidebar */}
      <div className="hidden md:flex w-72 border-r border-zinc-800 bg-zinc-950 flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl font-bold text-black">T</div>
            <div>
              <p className="text-3xl font-semibold tracking-tighter">TurfOp</p>
              <p className="text-sm text-zinc-500">Development</p>
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 space-y-1">
          {["dashboard", "board", "list"].map((v) => (
            <Button
              key={v}
              variant={view === v ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setView(v)}
            >
              {v === "dashboard" && <BarChart3 className="mr-3 h-5 w-5" />}
              {v === "board" && <LayoutGrid className="mr-3 h-5 w-5" />}
              {v === "list" && <List className="mr-3 h-5 w-5" />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </nav>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-zinc-800 bg-zinc-950 px-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            {view === "dashboard" && "Project Overview"}
            {view === "board" && "Sprint Board"}
            {view === "list" && "All Issues"}
          </h1>
          <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-8">
          {view === "dashboard" && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Total Issues</CardTitle></CardHeader>
                  <CardContent><p className="text-5xl font-bold">{stats.total}</p></CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>In Progress</CardTitle></CardHeader>
                  <CardContent><p className="text-5xl font-bold text-blue-500">{stats.inProgress}</p></CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Overdue</CardTitle></CardHeader>
                  <CardContent><p className="text-5xl font-bold text-red-500">{stats.overdue}</p></CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader><CardTitle>Completed</CardTitle></CardHeader>
                  <CardContent><p className="text-5xl font-bold text-emerald-500">{stats.done}</p></CardContent>
                </Card>
              </div>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle>Sprint Burndown</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={burndownData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis dataKey="day" stroke="#71717a" />
                      <YAxis stroke="#71717a" />
                      <Tooltip />
                      <Line type="monotone" dataKey="ideal" stroke="#52525b" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="actual" stroke="#22d3ee" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {view === "board" && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {["To Do", "In Progress", "Review", "Done"].map(status => (
                  <div key={status} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="font-semibold text-lg mb-5 flex justify-between">
                      {status}
                      <Badge variant="secondary">{issuesByStatus[status].length}</Badge>
                    </div>
                    <SortableContext items={issuesByStatus[status].map(i => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3 min-h-[500px]">
                        {issuesByStatus[status].map(issue => <KanbanCard key={issue.id} issue={issue} />)}
                      </div>
                    </SortableContext>
                  </div>
                ))}
              </div>
            </DndContext>
          )}

          {view === "list" && (
            <Card className="bg-zinc-900 border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map(issue => (
                    <TableRow key={issue.id} className="cursor-pointer hover:bg-zinc-800" onClick={() => setSelectedIssue(issue)}>
                      <TableCell className="font-mono text-blue-400">{issue.id}</TableCell>
                      <TableCell>{issue.title}</TableCell>
                      <TableCell><Badge>{issue.status}</Badge></TableCell>
                      <TableCell>{issue.priority}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
