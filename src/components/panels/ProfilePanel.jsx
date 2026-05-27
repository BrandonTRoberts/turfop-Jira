import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { getUploadUrl, readFilesAsDataUrls } from "@/lib/files";
import { api } from "@/services/api";

export default function ProfilePanel({ employee, onUpdateProfile }) {
  const [fullName, setFullName] = useState(employee?.full_name || "");
  const [email, setEmail] = useState(employee?.email || "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [addressLine1, setAddressLine1] = useState(employee?.address_line_1 || "");
  const [addressLine2, setAddressLine2] = useState(employee?.address_line_2 || "");
  const [city, setCity] = useState(employee?.city || "");
  const [state, setState] = useState(employee?.state || "");
  const [postalCode, setPostalCode] = useState(employee?.postal_code || "");
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(employee?.profile_image_url ? getUploadUrl(employee.profile_image_url) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [notificationPrefs, setNotificationPrefs] = useState({
    notifications_enabled: true,
    assignment_notifications_enabled: true,
    push_enabled: true,
  });
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  useEffect(() => {
    async function loadPrefs() {
      try {
        const prefs = await api.notificationPreferences();
        setNotificationPrefs(prefs);
      } catch {
        setNotificationMessage("Could not load notification preferences.");
      } finally {
        setNotificationLoading(false);
      }
    }
    loadPrefs();
  }, []);

  async function handleImageChange(fileList) {
    if (!fileList || fileList.length === 0) return;
    try {
      const [dataUrl] = await readFilesAsDataUrls(fileList, { maxFiles: 1 });
      setProfileImage(dataUrl);
      setPreviewUrl(URL.createObjectURL(fileList[0]));
    } catch (err) {
      setError("Failed to read image file");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await onUpdateProfile({
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postalCode: postalCode.trim() || null,
        profileImage: profileImage || undefined, // undefined keeps the existing picture if unchanged
      });
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      setPasswordSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      setPasswordSaving(false);
      return;
    }

    try {
      await onUpdateProfile({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function saveNotificationPrefs(nextPrefs) {
    setNotificationSaving(true);
    setNotificationMessage("");
    try {
      const updated = await api.updateNotificationPreferences({
        notificationsEnabled: nextPrefs.notifications_enabled,
        assignmentNotificationsEnabled: nextPrefs.assignment_notifications_enabled,
        pushEnabled: nextPrefs.push_enabled,
      });
      setNotificationPrefs(updated);
      setNotificationMessage("Notification preferences saved.");
    } catch (err) {
      setNotificationMessage(err.message || "Failed to save notification preferences.");
    } finally {
      setNotificationSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light sm:text-4xl">My Profile</h1>
        <p className="mt-2 text-muted-foreground">Manage your personal information, address, and profile picture.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Profile Picture</CardTitle>
            <CardDescription>Upload a picture to help your team recognize you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-2 border-border">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <AvatarFallback className="text-3xl font-semibold">
                    {(fullName || email || "?")[0].toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <ImagePlus className="h-8 w-8 text-white" />
                <input className="hidden" type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files)} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Click picture to upload a new one.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Personal Details</CardTitle>
            <CardDescription>Keep your contact and address details up to date.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 555-0199" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street address" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Apartment, suite, unit, etc." />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State / Province</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>Control assignment alerts across mobile and web. Push delivery requires device permission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Tip: Keep assignment notifications on so field techs never miss new tickets.</p>
            <label className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">Enable all notifications</span>
              <input
                type="checkbox"
                checked={Boolean(notificationPrefs.notifications_enabled)}
                disabled={notificationLoading || notificationSaving}
                onChange={(event) => {
                  const next = { ...notificationPrefs, notifications_enabled: event.target.checked };
                  setNotificationPrefs(next);
                  saveNotificationPrefs(next);
                }}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">Assignment notifications</span>
              <input
                type="checkbox"
                checked={Boolean(notificationPrefs.assignment_notifications_enabled)}
                disabled={notificationLoading || notificationSaving || !notificationPrefs.notifications_enabled}
                onChange={(event) => {
                  const next = { ...notificationPrefs, assignment_notifications_enabled: event.target.checked };
                  setNotificationPrefs(next);
                  saveNotificationPrefs(next);
                }}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">Push notifications (mobile/web)</span>
              <input
                type="checkbox"
                checked={Boolean(notificationPrefs.push_enabled)}
                disabled={notificationLoading || notificationSaving || !notificationPrefs.notifications_enabled}
                onChange={(event) => {
                  const next = { ...notificationPrefs, push_enabled: event.target.checked };
                  setNotificationPrefs(next);
                  saveNotificationPrefs(next);
                }}
              />
            </label>
            {notificationSaving ? <p className="text-xs text-muted-foreground">Saving notification preferences...</p> : null}
            {notificationMessage ? <p className="text-xs text-muted-foreground">{notificationMessage}</p> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Change Password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
              </div>

              {passwordError ? <p className="text-sm text-red-400">{passwordError}</p> : null}
              {passwordSuccess ? <p className="text-sm text-emerald-400">{passwordSuccess}</p> : null}

              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
