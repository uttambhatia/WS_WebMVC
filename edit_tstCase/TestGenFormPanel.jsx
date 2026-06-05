/**
 * TestGenFormPanel — Stage 5: display test generation results + export.
 *
 * StageFlowPanel interface: validate() / submit()
 * validate() and submit() are auto-success (read-only result panel).
 *
 * Initialization props:
 *   title          {string}
 *   exportService  {async fn(taskId, params) → blob download}  exportTestCases service.
 *
 * serviceData UI contract (mapped by StageFlowPanelDemo mapTestGenData):
 *   taskId     {string|null}
 *   testcases  {Array<{ testCaseId, requirementId, testDescription,
 *                       preconditions, testStepAction }>}
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import SaveToSquashPanel from "./SaveToSquashPanel";
import ArrayLineEditor from "./editing/ArrayLineEditor";
import TestCaseModalEditor from "./editing/TestCaseModalEditor";
import PluggableEditableTable from "./editing/PluggableEditableTable";
import {
  buildTestCaseColumns,
  createEmptyTestCaseRow,
  EDITOR_MODE_INLINE,
  EDITOR_MODE_MODAL,
  normalizeRows,
  normalizeTestCaseRow,
  validateTestCaseRow,
} from "./editing/testCaseEditingUtils";
import "../FormPanel.css";

const renderLines = (v) =>
  Array.isArray(v) ? (
    <ul className="dt__bullet-list">
      {v.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  ) : (v ?? "\u2014");

function SpinnerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42 14"/>
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2v7m0 0-3-3m3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const TestGenFormPanel = forwardRef(function TestGenFormPanel(
  {
    serviceData,
    stagesContext,
    stageStatus,
    onSubmitStart,
    onSubmitSuccess,
    onSubmitError,
    // Wiring-time
    title = "Test Case Generation",
    subtitle = "AI-generated test cases derived from the approved requirement document.",
    exportService,
    squashConfig = null,
    readOnly = false,
    testGenerationEditorMode = EDITOR_MODE_INLINE,
  },
  ref
) {
  /* Destructure mapped UI contract — all defaults provided by the mapper */
  const {
    taskId = null,
    testcases = [],
  } = serviceData ?? {};
  const caseId = stagesContext?.["case-id"] ?? null;
  const resolvedEditorMode = testGenerationEditorMode === EDITOR_MODE_MODAL
    ? EDITOR_MODE_MODAL
    : EDITOR_MODE_INLINE;

  /* Export panel state */
  const [exportOpen, setExportOpen]       = useState(false);
  const [squashOpen, setSquashOpen]       = useState(false);
  const [exportPath, setExportPath]       = useState("");
  const [exportEmail, setExportEmail]     = useState("");
  const [exportPrereq, setExportPrereq]   = useState("");
  const [exporting, setExporting]         = useState(false);
  const [exportStatus, setExportStatus]   = useState(null);
  const [exportErrors, setExportErrors]   = useState({});
  const [localRows, setLocalRows] = useState(() => normalizeRows(testcases));
  const [enableTableEditing, setEnableTableEditing] = useState(false);

  useEffect(() => {
    setLocalRows(normalizeRows(testcases));
  }, [testcases]);

  const editableColumns = useMemo(
    () => buildTestCaseColumns({
      editorMode: resolvedEditorMode,
      renderLines,
      ArrayLineEditor,
    }),
    [resolvedEditorMode]
  );

  const isReady   = readOnly || stageStatus === "ready" || stageStatus === "success";
  const isLoading = !readOnly && (stageStatus === "idle" || stageStatus === "loading");

  useImperativeHandle(ref, () => ({
    validate() { return true; },
    async submit(submitPayload) {
      const payload = submitPayload ?? {
        ...(serviceData ?? {}),
        testcases: localRows.map(({ __rowId, ...rest }) => rest),
      };
      onSubmitStart?.();
      onSubmitSuccess?.(payload);
      return { success: true };
    },
  }), [localRows, onSubmitStart, onSubmitSuccess, serviceData]);

  /* ---- StageFlowPanel contract ---- */
  const validateExport = () => {
    const errs = {};
    if (!exportPath.trim())  errs.path  = "Test Case Path is required.";
    if (!exportEmail.trim()) errs.email = "Created by Email Id is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(exportEmail)) errs.email = "Invalid email address.";
    setExportErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleExportClick = () => {
    if (!exportOpen) {
      setExportOpen(true);
      setSquashOpen(false);
      return;
    }
    // "Export Now" clicked
    if (!validateExport()) return;
    setExporting(true);
    setExportStatus(null);
    const params = {
      path: exportPath,
      email: exportEmail,
      prerequisites: exportPrereq,
      caseId,
    };
    (exportService ? exportService(taskId, params) : Promise.resolve())
      .then(() => setExportStatus({ type: "success", message: "Export completed successfully." }))
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err?.message ?? "Export failed.";
        setExportStatus({ type: "error", message: msg });
      })
      .finally(() => setExporting(false));
  };

  /* ---- Export ---- */

  return (
    <div className="fp">
      {/* Title bar */}
      <div className="fp__titlebar">
        <div className="fp__titlebar-top">
          <h2 className="fp__title">{title}</h2>
        </div>
        {subtitle && <p className="fp__subtitle">{subtitle}</p>}
      </div>
      {isReady && taskId && (
        <span className="fp__task-id">
          Task Id: <strong>{taskId}</strong>
        </span>
      )}

      {isLoading ? (
        <div className="fp__loading">
          <svg className="fp__loading-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray="42 14" />
          </svg>
          <span>Generating test cases…</span>
        </div>
      ) : !isReady ? null : (
        <div className="fp__body">
        {/* Export status */}
        {exportStatus && (
          <div className={`fp__status fp__status--${exportStatus.type}`} role="alert">
            {exportStatus.message}
          </div>
        )}

        <p className="fp__section-title">Test Generation Result</p>

    
        {/* Export bar */}
        <div className="fp__export-bar">
          {!exportOpen && (
            <SaveToSquashPanel
              taskId={taskId}
              tableTestCases={localRows.map(({ __rowId, ...row }) => row)}
              squashConfig={squashConfig}
              open={squashOpen}
              enableTableEditing={enableTableEditing}
              onEnableTableEditingChange={setEnableTableEditing}
              onOpenChange={(nextOpen) => {
                setSquashOpen(nextOpen);
                if (nextOpen) {
                  setExportOpen(false);
                }
              }}
            />
          )}

          {!squashOpen && exportOpen && (
            <div className="fp__export-fields">
              <div className="fp__field-block">
                <label className="fp__field-label" htmlFor="fp-export-path">Test Case Path *</label>
                <input
                  id="fp-export-path"
                  type="text"
                  className={`fp__input fp__export-input${exportErrors.path ? " fp__input--error" : ""}`}
                  placeholder="Enter test case path"
                  value={exportPath}
                  onChange={(e) => { setExportPath(e.target.value); if (exportErrors.path) setExportErrors((p) => ({ ...p, path: undefined })); }}
                  disabled={exporting}
                  aria-label="Test Case Path"
                />
              </div>
              <div className="fp__field-block">
                <label className="fp__field-label" htmlFor="fp-export-email">Created by Email Id *</label>
                <input
                  id="fp-export-email"
                  type="email"
                  className={`fp__input fp__export-input${exportErrors.email ? " fp__input--error" : ""}`}
                  placeholder="Enter creator email"
                  value={exportEmail}
                  onChange={(e) => { setExportEmail(e.target.value); if (exportErrors.email) setExportErrors((p) => ({ ...p, email: undefined })); }}
                  disabled={exporting}
                  aria-label="Created by Email Id"
                />
              </div>
              <div className="fp__field-block">
                <label className="fp__field-label" htmlFor="fp-export-prereq">Pre-requisites (optional)</label>
                <input
                  id="fp-export-prereq"
                  type="text"
                  className="fp__input fp__export-input"
                  placeholder="Enter pre-requisites"
                  value={exportPrereq}
                  onChange={(e) => setExportPrereq(e.target.value)}
                  disabled={exporting}
                  aria-label="Test Case Pre-requisites"
                />
              </div>
            </div>
          )}

          {!squashOpen && (
            <div className="fp__export-actions">
              <button
                type="button"
                className="fp__btn fp__btn--grey"
                onClick={handleExportClick}
                disabled={exporting}
                title={exportOpen ? "Click to export" : "Open export options"}
              >
                {exporting ? (
                  <SpinnerIcon className="fp__spinner" />
                ) : (
                  <ExportIcon />
                )}
                {exporting ? "Exporting…" : exportOpen ? "Export" : "Export"}
              </button>

              {exportOpen && (
                <button
                  type="button"
                  className="fp__btn fp__btn--ghost"
                  onClick={() => {
                    setExportOpen(false);
                    setExportPath("");
                    setExportEmail("");
                    setExportPrereq("");
                    setExportErrors({});
                    setExportStatus(null);
                  }}
                  disabled={exporting}
                  title="Cancel export"
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>

        {/* Export field validation errors */}
        {exportOpen && (exportErrors.path || exportErrors.email) && (
          <div className="fp__export-errors">
            {exportErrors.path  && <span className="fp__validation-error">{exportErrors.path}</span>}
            {exportErrors.email && <span className="fp__validation-error">{exportErrors.email}</span>}
          </div>
        )}

        {/* Test cases data table */}
        <PluggableEditableTable
          columns={editableColumns}
          rows={localRows}
          setRows={setLocalRows}
          readOnly={readOnly || !enableTableEditing}
          editorMode={resolvedEditorMode}
          createEmptyRow={createEmptyTestCaseRow}
          normalizeRows={normalizeRows}
          normalizeRow={normalizeTestCaseRow}
          validateRow={validateTestCaseRow}
          ModalComponent={TestCaseModalEditor}
        />
      </div>
      )}
    </div>
  );
});

export default TestGenFormPanel;
