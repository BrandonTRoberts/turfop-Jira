import { useRef, useState } from "react";
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

export default function UsersPanel({ business, users, facilities = [], activeFacilityId, canAdmin, onInvite, onRoleChange, onLoadDetails, onUpdate, onUpsertMembership, onRemoveMembership, onDeleteUser, onResendInvite, onSendResetPassword }) {
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
  const [deletingUser, setDeletingUser] = useState(false);
  const [membershipFacilityId, setMembershipFacilityId] = useState(activeFacilityId || "");
  const [membershipRole, setMembershipRole] = useState("read_only");
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [membershipError, setMembershipError] = useState("");
  const [membershipSuccess, setMembershipSuccess] = useState("");
  const [membershipBusyFacilityId, setMembershipBusyFacilityId] = useState("");
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  function showToast(type, message) {
    const id = `toast-${toastIdRef.current++}`;
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }

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
      const message = "Invite sent. The user has been added and emailed a password setup link.";
      setInviteSuccess(message);
      showToast("success", message);
    } catch (inviteError) {
      const message = inviteError.message;
      setError(message);
      showToast("error", message);
    } finally {
      setSaving(false);
    }
  }

  async function openUser(user) {
    setSelectedUser(user);
    setEditForm(toEditForm(user));
    setEditError("");
    setMembershipError("");
    setMembershipSuccess("");
    setMembershipFacilityId(activeFacilityId || "");
    setMembershipRole("read_only");

    if (!canAdmin || !onLoadDetails) {
      return;
    }

    setLoadingDetail(true);
    try {
      const details = await onLoadDetails(user.id);
      const currentMembership = details.memberships?.find((membership) => membership.facility_id === (user.facilityId || user.courseId)) || details.memberships?.[0];
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
      showToast("error", detailError.message);
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
      const message = "Invite sent successfully!";
      setResendInviteSuccess(message);
      showToast("success", message);
    } catch (err) {
      const message = err.message || "Failed to resend invite.";
      setResendInviteError(message);
      showToast("error", message);
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
      const message = "Password reset link sent successfully!";
      setResetPasswordSuccess(message);
      showToast("success", message);
    } catch (err) {
      const message = err.message || "Failed to send password reset link.";
      setResetPasswordError(message);
      showToast("error", message);
    } finally {
      setSendingReset(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser || !onDeleteUser) return;
    const confirmed = window.confirm(`Delete user ${selectedUser.name}? This removes their account.`);
    if (!confirmed) return;

    setDeletingUser(true);
    setEditError("");
    try {
      await onDeleteUser(selectedUser.id);
      showToast("success", "User removed.");
      setSelectedUser(null);
    } catch (err) {
      const message = err.message || "Failed to remove user.";
      setEditError(message);
      showToast("error", message);
    } finally {
      setDeletingUser(false);
    }
  }

  async function handleAddMembership() {
    if (!selectedUser || !membershipFacilityId || !onUpsertMembership) return;
    setMembershipSaving(true);
    setMembershipBusyFacilityId(membershipFacilityId);
    setMembershipError("");
    setMembershipSuccess("");
    try {
      await onUpsertMembership(selectedUser.id, membershipFacilityId, membershipRole);
      const facility = facilities.find((item) => (item.facility_id || item.id) === membershipFacilityId);
      setSelectedUser((current) => {
        const memberships = current?.memberships || [];
        const existing = memberships.find((m) => m.facility_id === membershipFacilityId);
        const nextMemberships = existing
          ? memberships.map((m) => (m.facility_id === membershipFacilityId ? { ...m, role: membershipRole } : m))
          : [...memberships, { facility_id: membershipFacilityId, role: membershipRole, name: facility?.name || "Facility" }];
        return { ...current, memberships: nextMemberships };
      });
      setMembershipSuccess(`Membership saved for ${facility?.name || "selected facility"}.`);
      showToast("success", `Membership saved for ${facility?.name || "selected facility"}.`);
    } catch (err) {
      const message = err.message || "Failed to update membership.";
      setMembershipError(message);
      showToast("error", message);
    } finally {
      setMembershipSaving(false);
      setMembershipBusyFacilityId("");
    }
  }

  async function handleRemoveMembership(facilityId) {
    if (!selectedUser || !facilityId || !onRemoveMembership) return;
    const membership = (selectedUser.memberships || []).find((item) => item.facility_id === facilityId);
    const membershipName = membership?.name || membership?.facility_name || "this facility";
    const confirmed = window.confirm(`Remove ${selectedUser.name} from ${membershipName}?`);
    if (!confirmed) return;

    setMembershipSaving(true);
    setMembershipBusyFacilityId(facilityId);
    setMembershipError("");
    setMembershipSuccess("");
    try {
      await onRemoveMembership(selectedUser.id, facilityId);
      setSelectedUser((current) => ({
        ...current,
        memberships: (current?.memberships || []).filter((currentMembership) => currentMembership.facility_id !== facilityId),
      }));
      setMembershipSuccess(`Removed access to ${membershipName}.`);
      showToast("success", `Removed access to ${membershipName}.`);
    } catch (err) {
      const message = err.message || "Failed to remove membership.";
      setMembershipError(message);
      showToast("error", message);
    } finally {
      setMembershipSaving(false);
      setMembershipBusyFacilityId("");
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
      showToast("success", "User profile updated successfully.");
    } catch (updateError) {
      setEditError(updateError.message);
      showToast("error", updateError.message);
    } finally {
      setSavingEdit(false);
    }
  }

  if (selectedUser) {
    return (
      <div className="space-y-6">
        <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg ${toast.type === "success" ? "border-emerald-600/40 bg-emerald-950/90 text-emerald-100" : "border-red-600/40 bg-red-950/90 text-red-100"}`}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Button type="button" variant="ghost" className="mb-3 px-0" onClick={() => setSelectedUser(null)}>
              <ArrowLeft className="h-4 w-4" />
              Team Members
            </Button>
            <h2 className="text-3xl font-semibold">{selectedUser.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Edit profile, contact details, and facility role for {business.name}.
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

            {canAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>Facility Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(selectedUser.memberships || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No facility memberships assigned yet.</p>
                  ) : (
                    (selectedUser.memberships || []).map((membership) => (
                      <div key={membership.facility_id} className="flex items-center gap-2">
                        <Badge variant="outline" className="min-w-[140px] justify-center">{membership.name || membership.facility_name || membership.facility_id}</Badge>
                        <Select
                          value={membership.role || "read_only"}
                          onValueChange={async (role) => {
                            setMembershipSaving(true);
                            setMembershipBusyFacilityId(membership.facility_id);
                            setMembershipError("");
                            setMembershipSuccess("");
                            try {
                              await onUpsertMembership(selectedUser.id, membership.facility_id, role);
                              setSelectedUser((current) => ({
                                ...current,
                                memberships: (current?.memberships || []).map((item) => (
                                  item.facility_id === membership.facility_id ? { ...item, role } : item
                                )),
                              }));
                              const membershipName = membership?.name || membership?.facility_name || "facility";
                              setMembershipSuccess(`Updated role in ${membershipName}.`);
                              showToast("success", `Updated role in ${membershipName}.`);
                            } catch (err) {
                              const message = err.message || "Failed to update membership.";
                              setMembershipError(message);
                              showToast("error", message);
                            } finally {
                              setMembershipSaving(false);
                              setMembershipBusyFacilityId("");
                            }
                          }}
                          disabled={membershipSaving}
                        >
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="read_write">Read/write</SelectItem>
                            <SelectItem value="read_only">Read-only</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleRemoveMembership(membership.facility_id)}
                          disabled={membershipSaving || (selectedUser.memberships || []).length <= 1}
                        >
                          {membershipSaving && membershipBusyFacilityId === membership.facility_id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Working...
                            </>
                          ) : (
                            "Remove"
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_auto]">
                    <Select value={membershipFacilityId} onValueChange={setMembershipFacilityId} disabled={membershipSaving}>
                      <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
                      <SelectContent>
                        {facilities.map((facility) => {
                          const id = facility.facility_id || facility.id;
                          return <SelectItem key={id} value={id}>{facility.name}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <Select value={membershipRole} onValueChange={setMembershipRole} disabled={membershipSaving}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="read_write">Read/write</SelectItem>
                        <SelectItem value="read_only">Read-only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddMembership} disabled={membershipSaving || !membershipFacilityId}>
                      {membershipSaving && membershipBusyFacilityId === membershipFacilityId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add / Update"}
                    </Button>
                  </div>
                  {membershipError ? <p className="text-sm text-red-400">{membershipError}</p> : null}
                  {membershipSuccess ? <p className="text-sm text-emerald-400">{membershipSuccess}</p> : null}
                </CardContent>
              </Card>
            ) : null}

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
                  <Button type="button" variant="destructive" className="w-full" onClick={handleDeleteUser} disabled={deletingUser}>
                    {deletingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Remove User Account
                  </Button>
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
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg ${toast.type === "success" ? "border-emerald-600/40 bg-emerald-950/90 text-emerald-100" : "border-red-600/40 bg-red-950/90 text-red-100"}`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-3xl font-semibold">Team Members</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Team access for {business.name}. Membership and roles are facility-specific.
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
