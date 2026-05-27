import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, MapPinned, ShieldCheck } from "lucide-react";

function adminRoleLabel(role) {
  if (role === "platform_admin") return "Platform Admin";
  if (role === "company_super_user") return "Company Admin";
  return "Facility Admin";
}

export default function AdminPanel({
  employee,
  companies,
  facilities,
  loading,
  error,
  onCreateCompany,
  onCreateFacility,
  onDeleteCompany,
  onDeleteFacility,
}) {
  const isPlatformAdmin = employee?.company_role === "platform_admin";
  const [companyName, setCompanyName] = useState("");
  const [courseForm, setCourseForm] = useState({
    companyId: employee?.company_id || "",
    name: "",
    region: "",
    superintendentName: "",
  });
  const [submittingCompany, setSubmittingCompany] = useState(false);
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState("");
  const [deletingFacilityId, setDeletingFacilityId] = useState("");
  const [formError, setFormError] = useState("");

  const visibleCompanies = useMemo(() => {
    if (companies.length > 0) return companies;

    const companyMap = new Map();
    facilities.forEach((facility) => {
      if (facility.company_id && !companyMap.has(facility.company_id)) {
        companyMap.set(facility.company_id, {
          id: facility.company_id,
          name: facility.company_name || "Assigned company",
        });
      }
    });

    return Array.from(companyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, facilities]);

  const facilitiesByCompany = useMemo(() => {
    return visibleCompanies.map((company) => ({
      ...company,
      facilities: facilities.filter((facility) => facility.company_id === company.id),
    }));
  }, [facilities, visibleCompanies]);

  async function handleCreateCompany(event) {
    event.preventDefault();
    setFormError("");
    setSubmittingCompany(true);

    try {
      const created = await onCreateCompany({ name: companyName.trim() });
      setCompanyName("");
      setCourseForm((current) => ({ ...current, companyId: created.id }));
    } catch (createError) {
      setFormError(createError.message);
    } finally {
      setSubmittingCompany(false);
    }
  }

  async function handleCreateFacility(event) {
    event.preventDefault();
    setFormError("");
    setSubmittingCourse(true);

    try {
      await onCreateFacility({
        companyId: courseForm.companyId,
        name: courseForm.name.trim(),
        region: courseForm.region.trim() || null,
        superintendentName: courseForm.superintendentName.trim() || null,
      });
      setCourseForm((current) => ({
        ...current,
        name: "",
        region: "",
        superintendentName: "",
      }));
    } catch (createError) {
      setFormError(createError.message);
    } finally {
      setSubmittingCourse(false);
    }
  }

  async function handleDeleteCompany(company) {
    if (!onDeleteCompany) return;
    const confirmed = window.confirm(`Delete business "${company.name}"? This only works when it has no facilities or users.`);
    if (!confirmed) return;

    setDeletingCompanyId(company.id);
    setFormError("");
    try {
      await onDeleteCompany(company.id);
    } catch (deleteError) {
      setFormError(deleteError.message || "Failed to delete business.");
    } finally {
      setDeletingCompanyId("");
    }
  }

  async function handleDeleteFacility(facility) {
    if (!onDeleteFacility) return;
    const confirmed = window.confirm(`Delete facility "${facility.name}"? This only works when dependent records are removed first.`);
    if (!confirmed) return;

    const facilityId = facility.facility_id || facility.id || facility.course_id;
    setDeletingFacilityId(facilityId);
    setFormError("");
    try {
      await onDeleteFacility(facilityId);
    } catch (deleteError) {
      setFormError(deleteError.message || "Failed to delete facility.");
    } finally {
      setDeletingFacilityId("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-light">Admin</h1>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {adminRoleLabel(employee?.company_role)}
          </Badge>
        </div>
        <p className="mt-3 text-muted-foreground">
          Manage the companies and facilities available to this account.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {formError ? <p className="text-sm text-red-400">{formError}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Companies
            </p>
            <p className="mt-2 text-4xl font-semibold">{visibleCompanies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinned className="h-4 w-4" />
              Facilities
            </p>
            <p className="mt-2 text-4xl font-semibold">{facilities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="mt-2 truncate text-lg font-semibold">{employee?.full_name || employee?.email}</p>
            <p className="truncate text-sm text-muted-foreground">{employee?.email}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          {isPlatformAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Create Company</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleCreateCompany}>
                  <Input
                    placeholder="Company name"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={submittingCompany}>
                    {submittingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create company
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Business Creation Restricted</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-muted-foreground">
                  Only Platform Admins can add new facilities or businesses. Contact support or your account manager to expand your account.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Create Facility</CardTitle>
            </CardHeader>
            <CardContent>
              {isPlatformAdmin ? (
                <form className="space-y-3" onSubmit={handleCreateFacility}>
                  <Select
                    value={courseForm.companyId}
                    onValueChange={(companyId) => setCourseForm((current) => ({ ...current, companyId }))}
                    disabled={visibleCompanies.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Course name"
                    value={courseForm.name}
                    onChange={(event) => setCourseForm((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Region"
                    value={courseForm.region}
                    onChange={(event) => setCourseForm((current) => ({ ...current, region: event.target.value }))}
                  />
                  <Input
                    placeholder="Superintendent"
                    value={courseForm.superintendentName}
                    onChange={(event) => setCourseForm((current) => ({ ...current, superintendentName: event.target.value }))}
                  />
                  <Button type="submit" className="w-full" disabled={submittingCourse || !courseForm.companyId}>
                    {submittingCourse ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create facility
                  </Button>
                </form>
              ) : (
                <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-muted-foreground">
                  Only Platform Admins can add new facilities or businesses. Contact support or your account manager to expand your account.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading admin scope
              </div>
            ) : null}
            {facilitiesByCompany.map((company) => (
              <div key={company.id} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{company.name}</p>
                    <p className="text-sm text-muted-foreground">{company.facilities.length} facilities</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPlatformAdmin ? <Badge>Platform scope</Badge> : <Badge variant="outline">Company scope</Badge>}
                    {isPlatformAdmin ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCompany(company)}
                        disabled={deletingCompanyId === company.id}
                      >
                        {deletingCompanyId === company.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Delete business
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {company.facilities.map((facility) => (
                    <div key={facility.facility_id || facility.course_id || facility.id} className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                      <span>{facility.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{facility.role}</Badge>
                        {isPlatformAdmin ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteFacility(facility)}
                            disabled={deletingFacilityId === (facility.facility_id || facility.id || facility.course_id)}
                          >
                            {deletingFacilityId === (facility.facility_id || facility.id || facility.course_id) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Delete facility
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {company.facilities.length === 0 ? (
                    <p className="rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">No facilities yet.</p>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
