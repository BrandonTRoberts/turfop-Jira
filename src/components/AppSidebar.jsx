import ThemeToggle from "./common/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUploadUrl } from "@/lib/files";
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

export default function AppSidebar({
  employee,
  selectedCourse,
  courses,
  courseError,
  currentView,
  menuItems,
  collapsed = false,
  isMobile = false,
  onCloseMobileNav,
  onCourseChange,
  onLogout,
  onProfileImageChange,
  onSelectView,
  onToggleCollapsed,
}) {
  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <aside className={`flex h-full shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${effectiveCollapsed ? "w-20" : "w-72"} ${isMobile ? "w-80 max-w-[88vw]" : ""}`}>
      <div className={`border-b border-border ${effectiveCollapsed ? "p-3" : "p-4 sm:p-6"}`}>
        {isMobile ? (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Navigation</span>
            <Button type="button" variant="ghost" size="icon" onClick={onCloseMobileNav} aria-label="Close navigation">
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : null}
        <div className={`flex items-center gap-4 ${effectiveCollapsed ? "justify-center" : ""}`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-bold text-black">T</div>
          {!effectiveCollapsed ? (
            <div>
              <p className="text-3xl font-semibold tracking-tighter">TurfOp</p>
              <p className="text-sm text-muted-foreground">Operations Platform</p>
            </div>
          ) : null}
        </div>

        {!effectiveCollapsed ? (
          <>
            <Button
              variant="ghost"
              className="w-full justify-start px-3 py-6 mt-5 rounded-xl border border-border bg-muted/40"
              onClick={() => onSelectView('profile')}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                  {employee.profile_image_url ? (
                    <img src={getUploadUrl(employee.profile_image_url)} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs">{(employee.full_name || employee.email || "?")[0]}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold">{employee.full_name || employee.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                </div>
             </div>
            </Button>
            <div className="mt-2 text-right">
               <Button type="button" variant="ghost" size="icon" onClick={onLogout} title="Sign out" aria-label="Sign out">
                 <LogOut className="h-4 w-4" />
               </Button>
             </div>
          </>
         ) : null}

        {!effectiveCollapsed ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              Course Scope
              {selectedCourse ? <Badge variant="outline">{selectedCourse.role}</Badge> : null}
            </div>
            <Select value={selectedCourse?.course_id || ""} onValueChange={onCourseChange} disabled={courses.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.course_id} value={course.course_id}>
                    {course.company_name ? `${course.company_name} / ${course.name}` : course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {courseError ? <p className="text-xs text-red-400">{courseError}</p> : null}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={currentView === item.id ? "default" : "ghost"}
            className={`w-full ${effectiveCollapsed ? "justify-center px-0" : "justify-start"}`}
            onClick={() => onSelectView(item.id)}
            title={effectiveCollapsed ? item.label : undefined}
          >
            <item.icon className={`h-5 w-5 ${effectiveCollapsed ? "" : "mr-3"}`} />
            {!effectiveCollapsed ? item.label : null}
          </Button>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        {!isMobile ? (
          <Button
            type="button"
            variant="outline"
            className={`mb-2 w-full ${effectiveCollapsed ? "justify-center px-0" : "justify-start"}`}
            onClick={onToggleCollapsed}
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {effectiveCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="mr-3 h-5 w-5" />}
            {!effectiveCollapsed ? "Collapse sidebar" : null}
          </Button>
        ) : null}
        <div className={`flex items-center gap-3 rounded-lg bg-muted/40 p-2 text-sm ${effectiveCollapsed ? "justify-center" : "justify-between"}`}>
          {!effectiveCollapsed ? <span className="text-muted-foreground">Appearance</span> : null}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
