import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Search, ExternalLink, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";

export default function CompanyInventoryPanel({ facility }) {
  const [search, setSearch] = useState("");
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.companyInventory();
        setInventory(data);
      } catch (err) {
        setError(err.message || "Failed to load company inventory.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return inventory;
    
    return inventory.filter(
      (item) =>
        (item.sku && item.sku.toLowerCase().includes(query)) ||
        (item.part_description && item.part_description.toLowerCase().includes(query)) ||
        (item.facility_name && item.facility_name.toLowerCase().includes(query))
    );
  }, [inventory, search]);

  const outOfStockCount = useMemo(() => filtered.filter((i) => Number(i.quantity_on_hand) <= 0).length, [filtered]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="h-full flex-1 flex-col space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Inventory</h2>
          <p className="text-muted-foreground">
            Search parts across all facilities to request transfers or avoid duplicate ordering.
          </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4 pt-4">
          <CardTitle className="text-lg font-medium">Shared Database</CardTitle>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SKU, description, or facility..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur">
              <TableRow>
                <TableHead>Part / Description</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className={Number(item.quantity_on_hand) <= 0 ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{item.sku || "N/A"}</span>
                      <span className="text-sm text-muted-foreground">{item.part_description}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.facility_id === facility?.facility_id ? "default" : "outline"}>
                      {item.facility_name}
                      {item.facility_id === facility?.facility_id && " (Here)"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(item.quantity_on_hand)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      {Number(item.quantity_on_hand) > 0 && item.facility_id !== facility?.facility_id ? (
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-700" onClick={() => alert('Transfer request feature coming soon.')}>
                          Request
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    <Box className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    No parts found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}