import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle } from "lucide-react";

const initialInventory = [
  { id: "INV-001", name: "16-4-8 Fertilizer", category: "Fertilizer", stock: 245, minStock: 100, unit: "bags" },
  { id: "INV-002", name: "Primo Maxx", category: "PGR", stock: 12, minStock: 24, unit: "gallons" },
  { id: "INV-003", name: "Toro Reel Blades", category: "Parts", stock: 42, minStock: 30, unit: "sets" },
  { id: "INV-004", name: "Bentgrass Seed", category: "Seed", stock: 8, minStock: 50, unit: "lbs" },
];

export default function InventoryPanel() {
  const [inventory] = useState(initialInventory);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filtered = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStock = inventory.filter(item => item.stock < item.minStock);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">Inventory</h2>

      <div className="flex gap-4">
        <Input 
          placeholder="Search inventory..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            <SelectItem value="Fertilizer">Fertilizer</SelectItem>
            <SelectItem value="PGR">PGR</SelectItem>
            <SelectItem value="Parts">Parts</SelectItem>
            <SelectItem value="Seed">Seed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-950 border border-red-500 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="text-red-500" />
          <span>{lowStock.length} items are low on stock!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(item => (
          <Card key={item.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
              <p className="text-sm text-zinc-500">{item.id}</p>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span>Stock</span>
                <Badge variant={item.stock < item.minStock ? "destructive" : "default"}>
                  {item.stock} {item.unit}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
