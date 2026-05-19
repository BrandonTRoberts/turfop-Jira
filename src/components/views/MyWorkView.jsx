import { EmptyState } from '../common/EmptyState';

function isTerminalWorkOrderStatus(status) {
  return status === 'Completed' || status === 'Cancelled';
}

export function MyWorkView({
  apiOnline,
  technicianEquipment,
  technicianWorkOrders,
  syncState,
  isSyncing,
  onOpenWorkOrders,
  onSyncNow,
  onStartWorkOrderEdit,
  onOpenCompletion,
  onStartEquipmentEdit,
  onOpenEquipmentNav,
  badgeClass,
  renderImagePreviewGrid,
  normalizeImageDrafts
}) {
  const openAssigned = technicianWorkOrders.filter((order) => !isTerminalWorkOrderStatus(order.status));
  const completedAssigned = technicianWorkOrders.filter((order) => order.status === 'Completed');

  return (
    <>
      <section className="panel technician-hero-panel">
        <div className="panel-header">
          <h3>Technician quick start</h3>
          <span className="panel-tag">{apiOnline ? 'Connected' : 'Offline mode'}</span>
        </div>
        <div className="technician-summary-grid">
          <div>
            <strong>{openAssigned.length}</strong>
            <p>Assigned work orders still open</p>
          </div>
          <div>
            <strong>{technicianEquipment.length}</strong>
            <p>Equipment records tied to your areas</p>
          </div>
          <div>
            <strong>{syncState.queuedCount}</strong>
            <p>Updates waiting to sync</p>
          </div>
        </div>
        <div className="form-actions top-spaced-list">
          <button className="primary-btn" type="button" onClick={onOpenWorkOrders}>
            Create or update work
          </button>
          <button className="secondary-btn" type="button" onClick={onSyncNow} disabled={isSyncing}>
            {isSyncing ? 'Syncing…' : 'Sync queued updates'}
          </button>
        </div>
      </section>

      <section className="content-grid form-grid">
        <article className="panel">
          <div className="panel-header">
            <h3>My assigned work</h3>
            <span className="panel-tag">Assigned work</span>
          </div>
          <div className="table-list">
            {openAssigned.map((order) => (
              <div key={order.id} className="table-row stacked-mobile technician-card">
                <div>
                  <strong>{order.title}</strong>
                  <p>{order.detail}</p>
                  <small>Assigned to: {order.assignee || 'Unassigned'}</small>
                  <small>Status: {order.status}</small>
                  <small>Photos: {order.imageUrls?.length || 0}</small>
                  {order.syncStatus === 'queued' ? <small>Saved offline and waiting to sync.</small> : null}
                </div>
                <div className="table-actions">
                  <span className={`badge ${badgeClass(order.status)}`}>{order.status}</span>
                  <div className="machine-actions">
                    <button className="secondary-btn" type="button" onClick={() => onStartWorkOrderEdit(order)}>
                      Open details
                    </button>
                    <button className="primary-btn" type="button" onClick={() => onOpenCompletion(order)}>
                      Complete with notes/photos
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {openAssigned.length === 0 ? (
              <EmptyState
                icon="work"
                title="No assigned work yet"
                message="No open technician work is assigned to you on this course right now."
                hint="New technician jobs, inspections, and follow-up tasks will appear here as they are assigned."
                action={<button className="primary-btn" type="button" onClick={onOpenWorkOrders}>Create first work order</button>}
              />
            ) : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Area-linked equipment</h3>
            <span className="panel-tag">Assigned areas</span>
          </div>
          <div className="machine-list">
            {technicianEquipment.map((machine) => (
              <div key={machine.id} className="machine-card stacked-mobile">
                <div>
                  <strong>{machine.name}</strong>
                  <p>{machine.description}</p>
                  <small>Assigned area: {machine.assignedArea || 'Not set'}</small>
                  <small>Status: {machine.status}</small>
                  <small>{machine.detail}</small>
                  {machine.syncStatus === 'queued' ? <small>Area or service changes are waiting to sync.</small> : null}
                </div>
                <div className="machine-actions">
                  <span className={`badge ${badgeClass(machine.status)}`}>{machine.status}</span>
                  <button className="secondary-btn" type="button" onClick={() => { onStartEquipmentEdit(machine); onOpenEquipmentNav(); }}>
                    Update equipment
                  </button>
                </div>
              </div>
            ))}
            {technicianEquipment.length === 0 ? <EmptyState icon="equipment" title="No equipment mapped yet" message="No equipment is currently mapped to your assigned areas." hint="Assign mowers, carts, or shop tools to an area and they will show up here for the crew." action={<button className="primary-btn" type="button" onClick={onOpenEquipmentNav}>Open equipment</button>} /> : null}
          </div>
        </article>
      </section>

      {completedAssigned.length ? (
        <section className="panel">
          <div className="panel-header">
            <h3>Recently completed</h3>
            <span className="panel-tag">Proof of work</span>
          </div>
          <div className="table-list">
            {completedAssigned.slice(0, 5).map((order) => (
              <div key={order.id} className="table-row stacked-mobile">
                <div>
                  <strong>{order.title}</strong>
                  <small>{order.completedAt ? new Date(order.completedAt).toLocaleString() : 'Completed'}</small>
                  <p>{order.completedWorkNotes || 'No completion notes yet.'}</p>
                  {order.imageUrls?.length ? renderImagePreviewGrid(normalizeImageDrafts(order.imageUrls)) : null}
                </div>
                <span className="badge">Completed</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
