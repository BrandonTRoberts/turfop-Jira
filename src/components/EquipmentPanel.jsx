import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";

const equipmentList = [
  { id: "EQ-001", name: "Toro Reelmaster", status: "Operational", location: "Shop" },
  { id: "EQ-002", name: "Jacobsen Turf King", status: "In Service", location: "Bay 2" },
  { id: "EQ-003", name: "John Deere Sprayer", status: "Operational", location: "Shed" },
];

export default function EquipmentPanel() {
  const [equipment] = useState(equipmentList);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">Equipment Management</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {equipment.map(item => (
          <Card key={item.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge>{item.status}</Badge>
              <p className="text-sm text-zinc-500 mt-2">{item.location}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
