import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarChart3, ShieldCheck } from "lucide-react";
import AppSidebar from "./AppSidebar";

const baseProps = {
  employee: {
    full_name: "Jamie Greenskeeper",
    email: "jamie@example.com",
    profile_image_url: "",
  },
  selectedCourse: {
    course_id: "course-1",
    name: "North Course",
    company_name: "TurfOp Demo",
    role: "admin",
  },
  courses: [
    {
      course_id: "course-1",
      name: "North Course",
      company_name: "TurfOp Demo",
      role: "admin",
    },
  ],
  courseError: "",
  currentView: "dashboard",
  menuItems: [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "admin", label: "Admin", icon: ShieldCheck },
  ],
  collapsed: false,
  isMobile: false,
  onCloseMobileNav: vi.fn(),
  onCourseChange: vi.fn(),
  onLogout: vi.fn(),
  onProfileImageChange: vi.fn(),
  onSelectView: vi.fn(),
  onToggleCollapsed: vi.fn(),
};

describe("AppSidebar", () => {
  it("renders employee, course scope, and available navigation items", () => {
    render(<AppSidebar {...baseProps} />);

    expect(screen.getByText("TurfOp")).toBeInTheDocument();
    expect(screen.getByText("Jamie Greenskeeper")).toBeInTheDocument();
    expect(screen.getByText("jamie@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /admin/i })).toBeInTheDocument();
  });

  it("selects a navigation item and toggles the desktop sidebar", async () => {
    const user = userEvent.setup();
    const onSelectView = vi.fn();
    const onToggleCollapsed = vi.fn();

    render(<AppSidebar {...baseProps} onSelectView={onSelectView} onToggleCollapsed={onToggleCollapsed} />);

    await user.click(screen.getByRole("button", { name: /admin/i }));
    expect(onSelectView).toHaveBeenCalledWith("admin");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});
