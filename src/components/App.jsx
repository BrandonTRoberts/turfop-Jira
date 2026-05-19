import { useState } from "react";
import IssueBoard from "./IssueBoard";
import UsersPanel from "./UsersPanel";
import TimeTracker from "./TimeTracker";
import EquipmentPanel from "./EquipmentPanel";
import InventoryPanel from "./InventoryPanel";

import { Button } from "@/components/ui/button";
import { BarChart3, LayoutGrid, Users, Clock, Wrench, Package, List } from "lucide-react";

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "issues", label: "Issues Board", icon: LayoutGrid },
    { id: "users", label: "Team Members", icon: Users },
    { id: "time", label: "Time Tracking", icon: Clock },
    { id: "equipment", label: "Equipment", icon: Wrench },
    { id: "inventory", label: "Inventory", icon: Package },
  ];

  const renderView = () => {
    switch (currentView) {
      case "dashboard": return <div className="p-12 text-center"><h1 className="text-5xl font-bold">Welcome to TurfOp</h1><p className="mt-4 text-xl text-zinc-500">Select a section from the sidebar</p></div>;
      case "issues": return <IssueBoard />;
      case "users": return <UsersPanel />;
      case "time": return <TimeTracker />;
      case "equipment": return <EquipmentPanel />;
      case "inventory": return <InventoryPanel />;
      default: return <div>Coming Soon...</div>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Sidebar */}
      <div className="w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl font-bold text-black">T</div>
            <div>
              <p className="text-3xl font-semibold tracking-tighter">TurfOp</p>
              <p className="text-sm text-zinc-500">Operations Platform</p>
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 space-y-1">
          {menuItems.map(item => (
            <Button
              key={item.id}
              variant={currentView === item.id ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setCurrentView(item.id)}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        {renderView()}
      </div>
    </div>
  );
}
