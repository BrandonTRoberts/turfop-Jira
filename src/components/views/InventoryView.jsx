import { EmptyState } from '../common/EmptyState';

export function InventoryView({
  selectedCourseId,
  selectedCourse,
  selectedRole,
  writableCourses,
  partForm,
  setPartForm,
  editingPartId,
  isSaving,
  visibleInventory,
  onPartSubmit,
  onResetPartForm,
  onPartDelete,
  onStartPartEdit,
  onImageCollectionChange,
  renderCollectionCaptureButton,
  renderImagePreviewGrid,
  removePartImage,
  normalizeImageDrafts
}) {
  return (
    <>
      <section className="panel course-switcher-panel page-intro-panel">
        <div className="panel-header">
          <h3>Inventory</h3>
          <span className="panel-tag">{selectedCourse?.name || 'Course scoped'}</span>
        </div>
      </section>

      <section className="content-grid lower-grid">
        <article className="panel">
          <div className="panel-header">
            <h3>{editingPartId ? 'Edit part' : 'Add part'}</h3>
            <span className="panel-tag">Stock item</span>
          </div>
          <form className="entry-form inventory-entry-form" onSubmit={onPartSubmit}>
            <div className="field-row inventory-form-grid">
              <label>
                Assigned golf course
                <select value={partForm.courseId} onChange={(event) => setPartForm({ ...partForm, courseId: event.target.value })} disabled={!selectedRole?.canWrite}>
                  {writableCourses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </label>
              <label>
                SKU
                <input value={partForm.sku} onChange={(event) => setPartForm({ ...partForm, sku: event.target.value })} type="text" placeholder="MOWER-BLD-22 or RNG-BALL-STD" required disabled={!selectedRole?.canWrite} />
              </label>
            </div>
            <div className="field-row inventory-form-grid">
              <label>
                Quantity on hand
                <input value={partForm.quantityOnHand} onChange={(event) => setPartForm({ ...partForm, quantityOnHand: event.target.value })} type="number" min="0" step="0.25" placeholder="12" required disabled={!selectedRole?.canWrite} />
              </label>
              <label>
                Unit cost
                <input value={partForm.unitCost} onChange={(event) => setPartForm({ ...partForm, unitCost: event.target.value })} type="number" min="0" step="0.01" placeholder="28.50" disabled={!selectedRole?.canWrite} />
              </label>
            </div>
            <label>
              Part description
              <textarea value={partForm.partDescription} onChange={(event) => setPartForm({ ...partForm, partDescription: event.target.value })} rows="3" placeholder="Hydraulic filter kit for fairway mower service, range picker tires, irrigation fittings, or fertilizer stock." required disabled={!selectedRole?.canWrite} />
            </label>
            <label>
              Reorder link
              <input value={partForm.reorderUrl} onChange={(event) => setPartForm({ ...partForm, reorderUrl: event.target.value })} type="url" placeholder="https://supplier-portal.example/item-123" disabled={!selectedRole?.canWrite} />
            </label>
            <label className="upload-dropzone">
              <span>Photos</span>
              <div className="capture-input-row inventory-upload-actions">
                <input type="file" accept="image/*" multiple onChange={(event) => onImageCollectionChange(event, setPartForm, 6)} disabled={!selectedRole?.canWrite} />
                {renderCollectionCaptureButton(setPartForm, 6, !selectedRole?.canWrite)}
              </div>
            </label>
            {renderImagePreviewGrid(partForm.images, removePartImage)}
            <div className="form-actions inventory-form-actions">
              <button className="primary-btn" type="submit" disabled={isSaving || !selectedRole?.canWrite}>
                {!selectedRole?.canWrite ? 'Read-only access at this course' : isSaving ? 'Saving...' : editingPartId ? 'Update part' : `Save part to ${selectedCourse?.name || 'course'}`}
              </button>
              {editingPartId ? (
                <button className="secondary-btn" type="button" onClick={() => onResetPartForm(selectedCourseId)} disabled={isSaving}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>On hand</h3>
            <span className="panel-tag">{visibleInventory.length} SKUs</span>
          </div>
          <div className="machine-list">
            {visibleInventory.map((item) => (
              <div key={item.id || item.sku} className="machine-card">
                <div className="card-row">
                  <strong>{item.sku}</strong>
                  <span className={`badge ${Number(item.quantityOnHand || 0) <= 2 ? 'warning' : ''}`}>{item.quantityOnHand} on hand</span>
                </div>
                <p>{item.partDescription}</p>
                {item.imageUrls?.length ? renderImagePreviewGrid(normalizeImageDrafts(item.imageUrls)) : null}
                <small>Unit cost: ${item.unitCost || 0}</small>
                <small>
                  Reorder: {item.reorderUrl ? <a href={item.reorderUrl} target="_blank" rel="noreferrer">Open supplier link</a> : 'Not set'}
                </small>
                {selectedRole?.canWrite ? (
                  <div className="machine-actions">
                    <button className="secondary-btn" type="button" onClick={() => onStartPartEdit(item)} disabled={isSaving}>
                      Edit
                    </button>
                    <button className="secondary-btn danger-btn" type="button" onClick={() => onPartDelete(item)} disabled={isSaving}>
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {visibleInventory.length === 0 ? (
              <EmptyState
                icon="inventory"
                title="No inventory records"
                message="Add the first part or supply for this course."
                action={<button className="primary-btn" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Add part</button>}
              />
            ) : null}
          </div>
        </article>
      </section>
    </>
  );
}
