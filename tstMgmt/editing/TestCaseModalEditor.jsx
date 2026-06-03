import ArrayLineEditor from "./ArrayLineEditor";

export default function TestCaseModalEditor({
  open,
  rowDraft,
  errors,
  onChange,
  onCancel,
  onSave,
}) {
  if (!open || !rowDraft) {
    return null;
  }

  return (
    <div className="fp__modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit test case row">
      <div className="fp__modal">
        <h3 className="fp__modal-title">Edit Test Case</h3>
        <div className="fp__modal-grid">
          <label className="fp__field-block">
            <span className="fp__field-label">Test Case Id *</span>
            <input
              type="text"
              className={`fp__input${errors.testCaseId ? " fp__input--error" : ""}`}
              value={rowDraft.testCaseId}
              onChange={(e) => onChange("testCaseId", e.target.value)}
            />
            {errors.testCaseId && <span className="fp__validation-error">{errors.testCaseId}</span>}
          </label>

          <label className="fp__field-block">
            <span className="fp__field-label">Requirement Id *</span>
            <input
              type="text"
              className={`fp__input${errors.requirementId ? " fp__input--error" : ""}`}
              value={rowDraft.requirementId}
              onChange={(e) => onChange("requirementId", e.target.value)}
            />
            {errors.requirementId && <span className="fp__validation-error">{errors.requirementId}</span>}
          </label>

          <label className="fp__field-block fp__field-block--full">
            <span className="fp__field-label">Test Description *</span>
            <textarea
              className={`fp__input fp__textarea${errors.testDescription ? " fp__input--error" : ""}`}
              value={rowDraft.testDescription}
              onChange={(e) => onChange("testDescription", e.target.value)}
              rows={4}
            />
            {errors.testDescription && <span className="fp__validation-error">{errors.testDescription}</span>}
          </label>

          <div className="fp__field-block fp__field-block--full">
            <span className="fp__field-label">Pre-conditions *</span>
            <ArrayLineEditor
              label="Pre-conditions"
              value={rowDraft.preconditions}
              onChange={(next) => onChange("preconditions", next)}
              error={errors.preconditions}
            />
          </div>

          <div className="fp__field-block fp__field-block--full">
            <span className="fp__field-label">Test Step Action *</span>
            <ArrayLineEditor
              label="Test Step Action"
              value={rowDraft.testStepAction}
              onChange={(next) => onChange("testStepAction", next)}
              error={errors.testStepAction}
            />
          </div>
        </div>

        <div className="fp__modal-actions">
          <button type="button" className="fp__btn fp__btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="fp__btn fp__btn--primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
