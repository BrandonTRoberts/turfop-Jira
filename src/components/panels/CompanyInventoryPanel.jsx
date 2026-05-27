import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";

export default function CompanyInventoryPanel({ facility }) {
  const [search, setSearch] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState("all");
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestingPartId, setRequestingPartId] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferQuantityInput, setTransferQuantityInput] = useState("1");

  const activeFacilityId = facility?.facility_id || facility?.course_id || "";

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await api.companyInventory(activeFacilityId);
        setInventory(data);
      } catch (err) {
        setError(err.message || "Failed to load company inventory.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeFacilityId]);

  function openTransferDialog(item) {
    setTransferError("");
    setTransferMessage("");
    setTransferItem(item);
    setTransferQuantityInput("1");
    setTransferDialogOpen(true);
  }

  async function handleSubmitTransferRequest() {
    if (!transferItem) return;

    const quantityRequested = Number(transferQuantityInput);
    const maxAvailable = Number(transferItem.quantity_on_hand || 0);
    if (!Number.isFinite(quantityRequested) || quantityRequested <= 0) {
      setTransferError("Quantity must be a positive number.");
      return;
    }
    if (quantityRequested > maxAvailable) {
      setTransferError(`Quantity cannot exceed available stock (${maxAvailable}).`);
      return;
    }

    try {
      setTransferError("");
      setTransferMessage("");
      setRequestingPartId(transferItem.id);
      await api.requestInventoryTransfer({
        sourcePartId: transferItem.id,
        destinationFacilityId: activeFacilityId,
        quantityRequested,
      });
      setTransferDialogOpen(false);
      setTransferItem(null);
      setTransferMessage(`Transfer request ticket created in ${transferItem.facility_name}. It will remain open until ${facility?.name || "your facility"} confirms receipt.`);
    } catch (err) {
      setTransferError(err.message || "Failed to create transfer request ticket.");
    } finally {
      setRequestingPartId("");
    }
  }


  const facilityOptions = useMemo(() => {
    const map = new Map();
    for (const item of inventory) {
      if (!item.facility_id) continue;
      if (!map.has(item.facility_id)) {
        map.set(item.facility_id, item.facility_name || "Unknown Facility");
      }
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);

    return inventory.filter((item) => {
      if (selectedFacilityId !== "all" && item.facility_id !== selectedFacilityId) {
        return false;
      }

      if (tokens.length === 0) return true;

      const haystack = [
        item.sku,
        item.part_description,
        item.facility_name,
        item.quantity_on_hand,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return tokens.every((token) => haystack.includes(token));
    });
  }, [inventory, search, selectedFacilityId]);

  useEffect(() => {
    if (selectedFacilityId === "all") return;
    const exists = facilityOptions.some((option) => option.id === selectedFacilityId);
    if (!exists) {
      setSelectedFacilityId("all");
    }
  }, [facilityOptions, selectedFacilityId]);

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
          {transferMessage ? <p className="mt-2 text-sm text-emerald-400">{transferMessage}</p> : null}
          {transferError ? <p className="mt-2 text-sm text-red-400">{transferError}</p> : null}
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4 pt-4">
          <CardTitle className="text-lg font-medium">Shared Database</CardTitle>
          <div className="flex w-full max-w-3xl items-center space-x-2">
            <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Filter by facility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {facilityOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-blue-600 hover:text-blue-700"
                          onClick={() => openTransferDialog(item)}
                          disabled={requestingPartId === item.id}
                        >
                          {requestingPartId === item.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
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
                    {inventory.length === 0
                      ? "No company inventory records found yet."
                      : "No parts match your current filters/search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Inventory Transfer</DialogTitle>
            <DialogDescription>
              This creates a pending ticket in the source facility. Inventory only moves after the ticket is completed by the source facility and receipt is confirmed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <p><span className="font-semibold">SKU:</span> {transferItem?.sku || "—"}</p>
              <p><span className="font-semibold">Source facility:</span> {transferItem?.facility_name || "—"}</p>
              <p><span className="font-semibold">Requesting facility:</span> {facility?.name || "Current facility"}</p>
              <p><span className="font-semibold">Available:</span> {Number(transferItem?.quantity_on_hand || 0)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-quantity">Quantity to request</Label>
              <Input
                id="transfer-quantity"
                type="number"
                min="1"
                max={String(Math.max(1, Number(transferItem?.quantity_on_hand || 1)))}
                value={transferQuantityInput}
                onChange={(event) => setTransferQuantityInput(event.target.value)}
              />
            </div>
            {transferError ? <p className="text-sm text-red-500">{transferError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTransferDialogOpen(false);
                setTransferItem(null);
              }}
              disabled={Boolean(requestingPartId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitTransferRequest}
              disabled={Boolean(requestingPartId)}
            >
              {requestingPartId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create transfer ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}