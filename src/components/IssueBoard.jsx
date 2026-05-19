import { useState, useMemo, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { Plus } from "lucide-react";

const STORAGE_KEY = "turfop-issues";

const defaultIssues = [
  { id: "TOP-101", title: "Build daily course readiness dashboard", status: "In Progress", priority: "High", assignee: "Brandon" },
  { id: "TOP-102", title: "Review inventory reorder workflow", status: "To Do", priority: "Medium", assignee: "Terry" },
  { id: "TOP-103", title: "Ship work order filtered exports", status: "Done", priority: "Medium", assignee: "Derek" },
];

export default function IssueBoard() {
  const [issues, setIssues] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultIssues;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  }, [issues]);

  const issuesByStatus = useMemo(() => {
    const grouped = {};
    ["To Do", "In Progress", "Review", "Done"].forEach(status => {
      grouped[status] = issues.filter(i => i.status === status);
    });
    return grouped;
  }, [issues]);

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
      <Card ref={setNodeRef} style={style} {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing p-4 bg-zinc-900 border border-zinc-700 hover:border-blue-500 transition-all"
      >
        <div className="font-mono text-xs text-blue-400 mb-2">{issue.id}</div>
        <p className="font-medium mb-3">{issue.title}</p>
        <div className="flex justify-between items-center">
          <Badge variant="outline">{issue.priority}</Badge>
          {issue.assignee && <Avatar className="w-6 h-6"><AvatarFallback>{issue.assignee[0]}</AvatarFallback></Avatar>}
        </div>
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {["To Do", "In Progress", "Review", "Done"].map(status => (
          <div key={status} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="font-semibold mb-4 flex justify-between">
              {status}
              <Badge variant="secondary">{issuesByStatus[status].length}</Badge>
            </div>
            <SortableContext items={issuesByStatus[status].map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 min-h-[400px]">
                {issuesByStatus[status].map(issue => <KanbanCard key={issue.id} issue={issue} />)}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
