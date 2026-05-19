import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

const mockUsers = [
  { id: 1, name: "Brandon Roberts", role: "Admin", status: "Active" },
  { id: 2, name: "Terry McBride", role: "Supervisor", status: "Active" },
  { id: 3, name: "Derek Hall", role: "Technician", status: "Active" },
];

export default function UsersPanel() {
  const [users] = useState(mockUsers);
  const [search, setSearch] = useState("");

  const filtered = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">Team Members</h2>
      <Input 
        placeholder="Search team..." 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(user => (
          <Card key={user.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar><AvatarFallback>{user.name[0]}</AvatarFallback></Avatar>
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  <p className="text-sm text-zinc-500">{user.role}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Badge>{user.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
