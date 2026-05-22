import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardView from './DashboardView';

const baseCourse = { course_id: 'course-1', name: 'Pine Hills' };
const baseEmployee = { full_name: 'Brandon Roberts', email: 'brandon@example.com' };

describe('DashboardView', () => {
  it('renders operational metrics from the backend dashboard overview', () => {
    render(
      <DashboardView
        employee={baseEmployee}
        selectedCourse={baseCourse}
        loading={false}
        error=""
        overview={{
          summary: {
            openWorkOrders: 7,
            overdueWorkOrders: 2,
            clockedInNow: 4,
            lowStockItems: 3,
            equipmentNeedingAttention: 1,
            totalHoursThisWeek: 38.5,
          },
          rollups: {
            workOrdersByCourse: [{ course_id: 'course-1', name: 'Pine Hills', open_work_orders: 7, completed_this_week: 5 }],
          },
        }}
      />,
    );

    expect(screen.getByText('TurfOp Operations')).toBeInTheDocument();
    expect(screen.getByText('Open work orders')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Clocked in now')).toBeInTheDocument();
    expect(screen.getByText('38.5 hours this week')).toBeInTheDocument();
    expect(screen.getAllByText(/Pine Hills/).length).toBeGreaterThan(0);
  });

  it('navigates when dashboard metric cards are clicked', () => {
    const onSelectView = vi.fn();

    render(
      <DashboardView
        employee={baseEmployee}
        selectedCourse={baseCourse}
        loading={false}
        error=""
        overview={{ summary: { pendingApprovals: 2 }, rollups: { workOrdersByCourse: [] } }}
        onSelectView={onSelectView}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open work orders/i }));
    expect(onSelectView).toHaveBeenCalledWith('issues');

    fireEvent.click(screen.getByRole('button', { name: /pending approvals/i }));
    expect(onSelectView).toHaveBeenCalledWith('time');
  });

  it('shows loading and error states', () => {
    const { rerender } = render(
      <DashboardView employee={baseEmployee} selectedCourse={baseCourse} loading error="" overview={null} />,
    );

    expect(screen.getByText('Loading dashboard')).toBeInTheDocument();

    rerender(<DashboardView employee={baseEmployee} selectedCourse={baseCourse} loading={false} error="Dashboard failed" overview={null} />);

    expect(screen.getByText('Dashboard failed')).toBeInTheDocument();
  });
});
