import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ImagePlus, Loader2, Save, UserPlus } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";

const emptyInvite = { fullName: "", email: "", role: "read_write", hourlyRate: "", profileImage: null };

function toEditForm(user) {
  return {
    fullName: user?.full_name || user?.name || "",
    email: user?.email || "",
    role: user?.role || "read_only",
    hourlyRate: user?.hourly_rate ?? user?.hourlyRate ?? "",
    phone: user?.phone || "",
    addressLine1: user?.address_line_1 || "",
    addressLine2: user?.address_line_2 || "",
    city: user?.city || "",
    state: user?.state || "",
    postalCode: user?.postal_code || "",
    profileImage: user?.profile_image_url || user?.profileImageUrl || null,
  };
}

export default function UsersPanel({ business, users, canAdmin, onInvite, onRoleChange, onLoadDetails, onUpdate, onResendInvite, onSendResetPassword }) {
  const [search, setSearch] = useState("");
  const [invite, setInvite] = useState(emptyInvite);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyInvite);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [editError, setEditError] = useState("");
  const [resendInviteError, setResendInviteError] = useState("");
  const [resendInviteSuccess, setResendInviteSuccess] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState("");
  const [sendingResend, setSendingResend] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const filtered = users.filter((user) =>
    [user.name, user.email, user.role, user.status].some((value) =>
      String(value || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  async function handleInvite(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInviteSuccess("");

    try {
      await onInvite(invite);
      setInvite(emptyInvite);
      setInviteSuccess("Invite sent. The user has been added and emailed a password setup link.");
    } catch (inviteError) {
      setError(inviteError.message);
    } finally {
      setSaving(false);
    }
  }

  async function openUser(user) {
    setSelectedUser(user);
    setEditForm(toEditForm(user));
    setEditError("");

    if (!canAdmin || !onLoadDetails) {
      return;
    }

    setLoadingDetail(true);
    try {
      const details = await onLoadDetails(user.id);
      const currentMembership = details.memberships?.find((membership) => membership.facility_id === user.courseId) || details.memberships?.[0];
      const merged = {
        ...user,
        ...details,
        name: details.full_name || details.email || user.name,
        role: currentMembership?.role || user.role,
        status: details.must_change_password ? "Invited" : "Active",
        profileImageUrl: details.profile_image_url,
      };
      setSelectedUser(merged);
      setEditForm(toEditForm(merged));
    } catch (detailError) {
      setEditError(detailError.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleResendInvite() {
    if (!selectedUser || !canAdmin) return;
    setResendInviteError("");
    setResendInviteSuccess("");
    setSendingResend(true);
    try {
      await onResendInvite(selectedUser.id);
      setResendInviteSuccess("Invite sent successfully!");
    } catch (err) {
      setResendInviteError(err.message || "Failed to resend invite.");
    } finally {
      setSendingResend(false);
    }
  }

  async function handleSendResetPassword() {
    if (!selectedUser || !canAdmin) return;
    setResetPasswordError("");
    setResetPasswordSuccess("");
    setSendingReset(true);
    try {
      await onSendResetPassword(selectedUser.id);
      setResetPasswordSuccess("Password reset link sent successfully!");
    } catch (err) {
      setResetPasswordError(err.message || "Failed to send password reset link.");
    } finally {
      setSendingReset(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedUser) return;

    setSavingEdit(true);
    setEditError("");

    try {
      const updated = await onUpdate(selectedUser.id, {
        email: editForm.email,
        fullName: editForm.fullName,
        role: editForm.role,
        hourlyRate: editForm.hourlyRate === "" ? null : Number(editForm.hourlyRate),
        phone: editForm.phone,
        addressLine1: editForm.addressLine1,
        addressLine2: editForm.addressLine2,
        city: editForm.city,
        state: editForm.state,
        postalCode: editForm.postalCode,
        profileImage: editForm.profileImage,
      });
      const nextUser = {
        ...selectedUser,
        ...updated,
        name: updated.full_name || updated.email || selectedUser.name,
        role: editForm.role,
        status: updated.must_change_password ? "Invited" : "Active",
        profileImageUrl: updated.profile_image_url,
      };
      setSelectedUser(nextUser);
      setEditForm(toEditForm(nextUser));
    } catch (updateError) {
      setEditError(updateError.message);
    } finally {
      setSavingEdit(false);
    }
  }

  if (selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Button type="button" variant="ghost" className="mb-3 px-0" onClick={() => setSelectedUser(null)}>
              <ArrowLeft className="h-4 w-4" />
              Team Members
            </Button>
            <h2 className="text-3xl font-semibold">{selectedUser.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit profile, contact details, and course role for {business.name}.
            </p>
          </div>
          <Badge variant={selectedUser.status === "Active" ? "default" : "outline"}>{selectedUser.status}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleUpdate}>
                {loadingDetail ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading user details
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input placeholder="Full name" value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} required disabled={!canAdmin} />
                  <Input type="email" placeholder="Email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required disabled={!canAdmin} />
                  <Select value={editForm.role} onValueChange={(role) => setEditForm({ ...editForm, role })} disabled={!canAdmin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="read_write">Read/write</SelectItem>
                      <SelectItem value="read_only">Read-only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="0" step="0.01" placeholder="Hourly rate" value={editForm.hourlyRate} onChange={(event) => setEditForm({ ...editForm, hourlyRate: event.target.value })} disabled={!canAdmin} />
                  <Input placeholder="Phone" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} disabled={!canAdmin} />
                  <Input placeholder="Address line 1" value={editForm.addressLine1} onChange={(event) => setEditForm({ ...editForm, addressLine1: event.target.value })} disabled={!canAdmin} />
                  <Input placeholder="Address line 2" value={editForm.addressLine2} onChange={(event) => setEditForm({ ...editForm, addressLine2: event.target.value })} disabled={!canAdmin} />
                  <Input placeholder="City" value={editForm.city} onChange={(event) => setEditForm({ ...editForm, city: event.target.value })} disabled={!canAdmin} />
                  <Input placeholder="State" value={editForm.state} onChange={(event) => setEditForm({ ...editForm, state: event.target.value })} disabled={!canAdmin} />
                  <Input placeholder="Postal code" value={editForm.postalCode} onChange={(event) => setEditForm({ ...editForm, postalCode: event.target.value })} disabled={!canAdmin} />
                </div>

                {canAdmin ? (
                  <label className="flex h-9 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border border-input px-3 text-sm text-foreground hover:bg-muted">
                    <ImagePlus className="h-4 w-4" />
                    Replace photo
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*"
                      onChange={async (event) => {
                        try {
                          const [profileImage] = await readFilesAsDataUrls(event.target.files, { maxFiles: 1 });
                          setEditForm({ ...editForm, profileImage });
                        } catch (uploadError) {
                          setEditError(uploadError.message);
                        }
                      }}
                    />
                  </label>
                ) : null}

                {editError ? <p className="text-sm text-red-400">{editError}</p> : null}
                <Button type="submit" disabled={!canAdmin || savingEdit || loadingDetail}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {editForm.profileImage ? (
                      <img src={getUploadUrl(editForm.profileImage)} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback>{(editForm.fullName || editForm.email || "?")[0]}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{editForm.fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">{editForm.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={editForm.role === "admin" ? "default" : "outline"}>{editForm.role}</Badge>
                  <Badge variant="outline">{selectedUser.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {canAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Admin Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedUser.status === "Invited" && (
                    <>
                      <Button onClick={handleResendInvite} className="w-full" disabled={sendingResend}>
                        {sendingResend && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Resend Invite
                      </Button>
                      {resendInviteError && <p className="text-sm text-red-400">{resendInviteError}</p>}
                      {resendInviteSuccess && <p className="text-sm text-emerald-400">{resendInviteSuccess}</p>}
                    </>
                  )}
                  {selectedUser.status === "Active" && (
                    <>
                      <Button onClick={handleSendResetPassword} className="w-full" disabled={sendingReset}>
                        {sendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Password Reset
                      </Button>
                      {resetPasswordError && <p className="text-sm text-red-400">{resetPasswordError}</p>}
                      {resetPasswordSuccess && <p className="text-sm text-emerald-400">{resetPasswordSuccess}</p>}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold">Team Members</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Team access for {business.name}. Membership and roles are course-specific.
        </p>
      </div>

      {canAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" />Invite user</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-3 lg:grid-cols-7" onSubmit={handleInvite}>
              <Input className="lg:col-span-2" placeholder="Full name" value={invite.fullName} onChange={(event) => setInvite({ ...invite, fullName: event.target.value })} required disabled={saving} />
              <Input className="lg:col-span-2" type="email" placeholder="Email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} required disabled={saving} />
              <Select value={invite.role} onValueChange={(role) => setInvite({ ...invite, role })} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="read_write">Read/write</SelectItem>
                  <SelectItem value="read_only">Read-only</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Invite</Button>
              <label className={`flex h-8 items-center justify-center rounded-lg border border-input px-2.5 text-sm text-foreground ${saving ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"}`}>
                Photo
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={async (event) => {
                    try {
                      const [profileImage] = await readFilesAsDataUrls(event.target.files, { maxFiles: 1 });
                      setInvite({ ...invite, profileImage });
                    } catch (uploadError) {
                      setError(uploadError.message);
                    }
                  }}
                />
              </label>
            </form>
            {invite.profileImage ? <p className="mt-2 text-xs text-muted-foreground">Profile photo selected.</p> : null}
            {inviteSuccess ? <p className="mt-3 text-sm text-emerald-400">{inviteSuccess}</p> : null}
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Input
        placeholder={`Search ${business.name} users...`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No users found inside this facility.</div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => openUser(user)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {user.profileImageUrl ? <img src={getUploadUrl(user.profileImageUrl)} alt="" className="h-full w-full rounded-full object-cover" /> : <AvatarFallback>{user.name[0]}</AvatarFallback>}
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "Hidden by role"}</TableCell>
                    <TableCell>
                      {canAdmin ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <Select value={user.role} onValueChange={(role) => onRoleChange(user.id, role)}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="read_write">Read/write</SelectItem>
                            <SelectItem value="read_only">Read-only</SelectItem>
                          </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={user.status === "Active" ? "default" : "outline"}>{user.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
