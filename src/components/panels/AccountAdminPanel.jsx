import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AccountAdminPanel({
  platformAdmin,
  businessAccounts,
  selectedBusiness,
  businessUsers,
  businessEquipment,
  businessInventory,
  canManageBusiness,
  onSelectBusiness,
  onAddUser,
  onAddEquipment,
  onAddInventoryItem,
}) {
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "Technician" });
  const [equipmentForm, setEquipmentForm] = useState({ name: "", status: "Operational", location: "" });
  const [inventoryForm, setInventoryForm] = useState({ name: "", category: "Parts", stock: "", minStock: "", unit: "each" });
  const adminUsers = businessUsers.filter((user) => user.role === "Business Admin");
  const standardUsers = businessUsers.filter((user) => user.role !== "Business Admin");

  function handleAddUser(event) {
    event.preventDefault();
    if (!canManageBusiness) return;

    onAddUser({
      id: `user-${Date.now()}`,
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
      status: "Active",
    });
    setUserForm({ name: "", email: "", role: "Technician" });
  }

  function handleAddEquipment(event) {
    event.preventDefault();
    if (!canManageBusiness) return;

    onAddEquipment({
      id: `EQ-${Date.now().toString().slice(-5)}`,
      name: equipmentForm.name.trim(),
      status: equipmentForm.status,
      location: equipmentForm.location.trim() || "Unassigned",
    });
    setEquipmentForm({ name: "", status: "Operational", location: "" });
  }

  function handleAddInventoryItem(event) {
    event.preventDefault();
    if (!canManageBusiness) return;

    onAddInventoryItem({
      id: `INV-${Date.now().toString().slice(-5)}`,
      name: inventoryForm.name.trim(),
      category: inventoryForm.category.trim() || "Parts",
      stock: Number(inventoryForm.stock || 0),
      minStock: Number(inventoryForm.minStock || 0),
      unit: inventoryForm.unit.trim() || "each",
    });
    setInventoryForm({ name: "", category: "Parts", stock: "", minStock: "", unit: "each" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold">Account Admin</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Platform admin access is separate from every business account. Business admins and users are scoped only to the selected business.
        </p>
        {!canManageBusiness ? (
          <p className="mt-2 text-sm text-amber-400">Read-only account: create actions are disabled.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Platform Admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback>M</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">{platformAdmin.name}</p>
                <p className="text-sm text-zinc-500">{platformAdmin.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{platformAdmin.role}</Badge>
              <Badge variant="outline">{platformAdmin.scope}</Badge>
            </div>
            <p className="text-sm text-zinc-400">
              This account manages platform-wide business accounts and should not be mixed into any customer team roster.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Business Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {businessAccounts.map((business) => (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => onSelectBusiness(business.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selectedBusiness.id === business.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{business.name}</p>
                      <p className="text-sm text-zinc-500">{business.region}</p>
                    </div>
                    <Badge variant="outline">{business.status}</Badge>
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">{business.plan} plan</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Add User</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleAddUser}>
              <Input
                placeholder="Full name"
                value={userForm.name}
                onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
                required
                disabled={!canManageBusiness}
              />
              <Input
                type="email"
                placeholder="Email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                required
                disabled={!canManageBusiness}
              />
              <Select value={userForm.role} onValueChange={(role) => setUserForm({ ...userForm, role })} disabled={!canManageBusiness}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Business Admin">Business Admin</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="Technician">Technician</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={!canManageBusiness}>
                Add to {selectedBusiness.name}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Add Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleAddEquipment}>
              <Input
                placeholder="Equipment name"
                value={equipmentForm.name}
                onChange={(event) => setEquipmentForm({ ...equipmentForm, name: event.target.value })}
                required
                disabled={!canManageBusiness}
              />
              <Input
                placeholder="Location"
                value={equipmentForm.location}
                onChange={(event) => setEquipmentForm({ ...equipmentForm, location: event.target.value })}
                disabled={!canManageBusiness}
              />
              <Select value={equipmentForm.status} onValueChange={(status) => setEquipmentForm({ ...equipmentForm, status })} disabled={!canManageBusiness}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operational">Operational</SelectItem>
                  <SelectItem value="In Service">In Service</SelectItem>
                  <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={!canManageBusiness}>
                Add equipment
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Add Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleAddInventoryItem}>
              <Input
                placeholder="Item name"
                value={inventoryForm.name}
                onChange={(event) => setInventoryForm({ ...inventoryForm, name: event.target.value })}
                required
                disabled={!canManageBusiness}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Category"
                  value={inventoryForm.category}
                  onChange={(event) => setInventoryForm({ ...inventoryForm, category: event.target.value })}
                  disabled={!canManageBusiness}
                />
                <Input
                  placeholder="Unit"
                  value={inventoryForm.unit}
                  onChange={(event) => setInventoryForm({ ...inventoryForm, unit: event.target.value })}
                  disabled={!canManageBusiness}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  placeholder="Stock"
                  value={inventoryForm.stock}
                  onChange={(event) => setInventoryForm({ ...inventoryForm, stock: event.target.value })}
                  disabled={!canManageBusiness}
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Min stock"
                  value={inventoryForm.minStock}
                  onChange={(event) => setInventoryForm({ ...inventoryForm, minStock: event.target.value })}
                  disabled={!canManageBusiness}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!canManageBusiness}>
                Add inventory
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>{selectedBusiness.name} Admins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {adminUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg bg-zinc-950 p-4">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-zinc-500">{user.email}</p>
                </div>
                <Badge>{user.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>{selectedBusiness.name} Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {standardUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg bg-zinc-950 p-4">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-zinc-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{user.role}</Badge>
                  <Badge>{user.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>{selectedBusiness.name} Equipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessEquipment.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-zinc-950 p-4">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-zinc-500">{item.location}</p>
                </div>
                <Badge>{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>{selectedBusiness.name} Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {businessInventory.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-zinc-950 p-4">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-zinc-500">{item.category}</p>
                </div>
                <Badge variant={item.stock < item.minStock ? "destructive" : "default"}>
                  {item.stock} {item.unit}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
