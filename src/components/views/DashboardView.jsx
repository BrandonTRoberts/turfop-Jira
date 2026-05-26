import { Activity, AlertTriangle, Clock, Database, Loader2, PackageSearch, TimerReset, Wrench, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TechnicianActivityFeed from '../TechnicianActivityFeed';

function numberValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatMetric(value, options = {}) {
  const numeric = numberValue(value);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(numeric);
}

function MetricCard({ title, value, helper, icon: Icon, tone = 'default', onClick }) {
  const toneClasses = {
    default: 'border-border',
    warning: 'border-amber-500/60 bg-amber-500/5',
    danger: 'border-red-500/60 bg-red-500/5',
    success: 'border-emerald-500/60 bg-emerald-500/5',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Card className={`${toneClasses[tone] || toneClasses.default} ${onClick ? 'hover:bg-muted/50 transition-colors text-left' : ''}`}>
      <Component onClick={onClick} className={`w-full h-full text-left ${onClick ? 'cursor-pointer' : ''}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="mt-2 text-3xl font-semibold sm:text-4xl">{value}</p>
            </div>
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Icon className="h-5 w-5" />
            </div>
          </div>
          {helper ? <p className="mt-3 text-xs text-muted-foreground">{helper}</p> : null}
        </CardContent>
      </Component>
    </Card>
  );
}

export default function DashboardView({ 
  employee, 
  selectedFacility, 
  overview, 
  loading, 
  error,
  users = [],
  workOrders = [],
  onSelectView,
}) {
  const summary = overview?.summary || {};
  const workOrdersByFacility = overview?.rollups?.workOrdersByFacility || overview?.rollups?.workOrdersByCourse || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-light sm:text-4xl">TurfOp Operations</h1>
          <p className="mt-3 text-muted-foreground">
            Signed in as {employee.full_name || employee.email}. Active facility scope is {selectedFacility.name}.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {selectedFacility.company_name ? `${selectedFacility.company_name} / ${selectedFacility.name}` : selectedFacility.name}
        </Badge>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard
        </Card>
      ) : error ? (
        <Card className="border-red-500/60 p-10 text-center text-red-400">{error}</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Open work orders"
              value={formatMetric(summary.openWorkOrders)}
              helper={`${formatMetric(summary.completedThisWeek)} completed this week`}
              icon={Activity}
              tone={numberValue(summary.openWorkOrders) > 0 ? 'warning' : 'success'}
              onClick={() => onSelectView?.('issues')}
            />
            <MetricCard
              title="Due / blocked work"
              value={formatMetric(summary.overdueWorkOrders)}
              helper="Items needing priority review"
              icon={AlertTriangle}
              tone={numberValue(summary.overdueWorkOrders) > 0 ? 'danger' : 'success'}
              onClick={() => onSelectView?.('issues')}
            />
            <MetricCard
              title="Clocked in now"
              value={formatMetric(summary.clockedInNow)}
              helper={`${formatMetric(summary.totalHoursThisWeek)} hours this week`}
              icon={Clock}
              onClick={() => onSelectView?.('time')}
            />
            <MetricCard
              title="Low stock items"
              value={formatMetric(summary.lowStockItems)}
              helper={`${formatMetric(summary.outOfStockItems)} out of stock`}
              icon={PackageSearch}
              tone={numberValue(summary.lowStockItems) > 0 ? 'warning' : 'success'}
              onClick={() => onSelectView?.('inventory')}
            />
            <MetricCard
              title="Equipment attention"
              value={formatMetric(summary.equipmentNeedingAttention)}
              helper="Needs service or overdue"
              icon={Wrench}
              tone={numberValue(summary.equipmentNeedingAttention) > 0 ? 'warning' : 'success'}
              onClick={() => onSelectView?.('equipment')}
            />
            <MetricCard
              title="MTTR hours"
              value={formatMetric(summary.mttrHours)}
              helper="Average completion time"
              icon={TimerReset}
              onClick={() => onSelectView?.('issues')}
            />
            <MetricCard
              title="Inventory value"
              value={`$${formatMetric(summary.inventoryValue)}`}
              helper={`${formatMetric(summary.totalSkus)} tracked SKUs`}
              icon={Database}
              onClick={() => onSelectView?.('inventory')}
            />
            <MetricCard
              title="Pending approvals"
              value={formatMetric(summary.pendingApprovals)}
              helper="Time entries awaiting admin review"
              icon={Clock}
              tone={numberValue(summary.pendingApprovals) > 0 ? 'warning' : 'success'}
              onClick={() => onSelectView?.('time')}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facility rollup</CardTitle>
            </CardHeader>
            <CardContent>
              {workOrdersByFacility.length === 0 ? (
                <p className="text-sm text-muted-foreground">No facility rollup data is available yet.</p>
              ) : (
                <div className="space-y-3">
                  {workOrdersByFacility.map((facility) => (
                    <div key={facility.facility_id || facility.course_id || facility.name} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{facility.name}</p>
                        <p className="text-xs text-muted-foreground">{formatMetric(facility.completed_this_week)} completed this week</p>
                      </div>
                      <Badge variant={numberValue(facility.open_work_orders) > 0 ? 'secondary' : 'outline'}>
                        {formatMetric(facility.open_work_orders)} open
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technician Activity Feed - Added for buyer requirement */}
          <TechnicianActivityFeed 
            course={selectedFacility}
            users={users}
            workOrders={workOrders}
            onRefresh={() => window.location.reload()} 
          />
        </>
      )}
    </div>
  );
}
