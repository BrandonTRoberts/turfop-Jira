import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IssueBoard from "./IssueBoard";

const course = {
  course_id: "course-1",
  name: "North Course",
  company_name: "TurfOp Demo",
};

const workOrders = [
  {
    id: "order-open-1",
    course_id: "course-1",
    title: "Fix greens mower hydraulic leak",
    detail: "Leak under the left wheel motor.",
    status: "Open",
    assignee: "Alex",
    technician_name: "Alex",
    due_at: "2026-05-22T12:00:00.000Z",
    updated_at: "2026-05-21T12:00:00.000Z",
    created_at: "2026-05-21T12:00:00.000Z",
    activity_log: [],
    image_urls: [],
    attachments: [],
    part_usages: [],
  },
  {
    id: "order-high-1",
    course_id: "course-1",
    title: "Irrigation pump alarm",
    detail: "Pump station alerting overnight.",
    status: "High",
    assignee: "Morgan",
    technician_name: "Morgan",
    updated_at: "2026-05-21T12:00:00.000Z",
    created_at: "2026-05-21T12:00:00.000Z",
    activity_log: [],
    image_urls: [],
    attachments: [],
    part_usages: [],
  },
];

const baseProps = {
  course,
  workOrders,
  users: [],
  equipment: [],
  inventory: [],
  loading: false,
  error: "",
  canWrite: true,
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onComment: vi.fn(),
};

describe("IssueBoard", () => {
  it("groups work orders by workflow column with user-friendly labels", () => {
    render(<IssueBoard {...baseProps} />);

    const openColumn = screen.getByRole("region", { name: /open/i });
    const highColumn = screen.getByRole("region", { name: /high priority/i });

    expect(within(openColumn).getByText("Fix greens mower hydraulic leak")).toBeInTheDocument();
    expect(within(highColumn).getByText("Irrigation pump alarm")).toBeInTheDocument();
  });

  it("filters tickets by search query", async () => {
    const user = userEvent.setup();
    render(<IssueBoard {...baseProps} />);

    await user.type(screen.getByPlaceholderText(/search tickets/i), "pump");

    expect(screen.getByText("Irrigation pump alarm")).toBeInTheDocument();
    expect(screen.queryByText("Fix greens mower hydraulic leak")).not.toBeInTheDocument();
  });

  it("creates a work order with the current facility scope", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({
      ...workOrders[0],
      id: "order-created-1",
      title: "Replace bunker rake",
    });

    render(<IssueBoard {...baseProps} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: /new work order/i }));
    await user.type(screen.getByPlaceholderText(/summary/i), "Replace bunker rake");
    await user.type(screen.getByPlaceholderText(/description/i), "Broken handle by 12 green.");
    await user.click(screen.getByRole("button", { name: /create issue/i }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      facilityId: "course-1",
      title: "Replace bunker rake",
      detail: "Broken handle by 12 green.",
      status: "Open",
    }));
  });

  it("saves updates from the work order detail dialog", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue({
      ...workOrders[0],
      title: "Fix greens mower hydraulic hose",
    });

    render(<IssueBoard {...baseProps} onUpdate={onUpdate} />);

    await user.click(screen.getByText("Fix greens mower hydraulic leak"));
    const titleInput = screen.getByDisplayValue("Fix greens mower hydraulic leak");
    await user.clear(titleInput);
    await user.type(titleInput, "Fix greens mower hydraulic hose");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onUpdate).toHaveBeenCalledWith("order-open-1", expect.objectContaining({
      facilityId: "course-1",
      title: "Fix greens mower hydraulic hose",
      expectedUpdatedAt: "2026-05-21T12:00:00.000Z",
    }));
  });
});
