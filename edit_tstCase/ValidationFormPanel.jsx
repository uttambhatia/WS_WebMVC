/**
 * ValidationFormPanel — Stage 3: read-only validation result viewer.
 *
 * StageFlowPanel interface: validate() / submit()
 * validate() and submit() are auto-success (read-only panel).
 *
 * serviceData UI contract (mapped by StageFlowPanelDemo mapValidationData):
 *   taskId              {string|null}
 *   document            {string|null}
 *   quality_percentage  {string|null}
 *   rating              {string|null}
 *   rating_explanation  {string|null}
 *   action_items        {Array<{ requirementId, missingFields[], recommendation[] }>}
 *   user_story_criteria {Array<{ criterion, criterionMeets, explanation, recommendation }>}
 *   summary_report      {Array<{ requirementId, mandatoryFieldItems }>}
 *
 * Initialization props:
 *   title  {string}
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import DataTable from "../../DataTable/DataTable";
import "../FormPanel.css";

const ACTION_COLS = [
  { key: "requirementId",  label: "Requirement Id",  width: "20%"  },
  {
    key: "missingFields",
    label: "Missing Fields",
    width: "30%",
    truncate: 120,
    render: (v) =>
      Array.isArray(v) ? (
        <ul className="dt__bullet-list">
          {v.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      ) : (v ?? "\u2014"),
  },
  {
    key: "recommendation",
    label: "Recommendation",
    width: "50%",
    truncate: 120,
    render: (v) =>
      Array.isArray(v) ? (
        <ul className="dt__bullet-list">
          {v.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      ) : (v ?? "\u2014"),
  },
];
const USER_STORY_COLS = [
  { key: "criterion", label: "Criterion", width: "15%" },
  {
    key: "criterionMeets",
    label: "Criterion Meets",
    width: "18%",
    render: (v) => {
      if (v === true  || v === "true"  || v === "yes") return "Yes";
      if (v === false || v === "false" || v === "no")  return "No";
      return v ?? "—";
    },
  },
  { key: "explanation",    label: "Explanation",    width: "40%", truncate: 120 },
  { key: "recommendation", label: "Recommendation", width: "27%", truncate: 120 },
];
const SUMMARY_COLS   = [{ key: "requirementId", label: "Requirement Id", width: "60%" }, 
  { key: "mandatoryFieldItems", label: "Mandatory Field Items", width: "40%" }];

const ValidationFormPanel = forwardRef(function ValidationFormPanel(
  {
    serviceData,
    stageStatus,
    onSubmitStart,
    onSubmitSuccess,
    onSubmitRejected,
    onSubmitError,
    title = "Validation",
    subtitle = "Review the automated quality analysis and validation results for the uploaded document.",
    closeCaseService,
    readOnly = false,
  },
  ref
) {
  /* Destructure mapped UI contract — all defaults provided by the mapper */
  const {
    taskId             = null,
    document           = null,
    quality_percentage = null,
    rating             = null,
    rating_explanation = null,
    action_items       = [],
    user_story_criteria = [],
    summary_report     = [],
  } = serviceData ?? {};

  const isClosed = stageStatus === "rejected";
  const [closeChecked, setCloseChecked] = useState(isClosed);
  const [closeLocked, setCloseLocked] = useState(isClosed);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [submittingClose, setSubmittingClose] = useState(false);

  useEffect(() => {
    setCloseChecked(isClosed);
    setCloseLocked(isClosed);
  }, [isClosed, taskId]);

  const isEffectivelyClosed = isClosed || closeLocked;

  const actionItems   = action_items;
  const userStory     = user_story_criteria;
  const summaryReport = summary_report;

  /* ---- StageFlowPanel contract ---- */
  useImperativeHandle(ref, () => ({
    validate() { return true; },
    async submit() {
      onSubmitStart?.();
      onSubmitSuccess?.(serviceData);
      return { success: true };
    },
  }));

  const openCloseModal = () => {
    if (readOnly || isEffectivelyClosed || submittingClose) return;
    setCloseChecked(true);
    setCloseModalOpen(true);
  };

  const cancelClose = () => {
    setCloseModalOpen(false);
    setCloseChecked(false);
  };

  const markClosed = async () => {
    if (!closeCaseService || !taskId) {
      setCloseModalOpen(false);
      setCloseChecked(false);
      return;
    }

    setSubmittingClose(true);
    try {
      onSubmitStart?.();
      await closeCaseService(taskId);
      setCloseLocked(true);
      const rejectedPayload = {
        ...(serviceData ?? {}),
        _sfpStatus: "rejected",
        decision: "reject",
      };
      onSubmitRejected?.(rejectedPayload);
      setCloseModalOpen(false);
    } catch (error) {
      setCloseChecked(false);
      const message = error?.response?.data?.message ?? error?.message ?? "Failed to close the case.";
      onSubmitError?.(message);
    } finally {
      setSubmittingClose(false);
    }
  };

  const CARDS = [
    { label: "Document",           value: document },
    { label: "Quality Percentage", value: quality_percentage },
    { label: "Rating",             value: rating, subtitle: rating_explanation },
  ];

  const isReady   = readOnly || stageStatus === "ready" || stageStatus === "success" || stageStatus === "rejected";
  const isLoading  = !readOnly && (stageStatus === "idle" || stageStatus === "loading");
  const showCloseToggle = !readOnly && (stageStatus === "ready" || stageStatus === "success" || stageStatus === "rejected");

  return (
    <div className="fp">
      {/* Title bar */}
      <div className="fp__titlebar">
        <div className="fp__titlebar-top">
          <h2 className="fp__title">{title}</h2>
        </div>
        {subtitle && <p className="fp__subtitle">{subtitle}</p>}
      </div>
      {showCloseToggle && taskId && (
        <div className="fp__validation-task-row">
          <div className="fp__close-toggle-wrap">
            <div className="fp__close-control">
              <button
              type="button"
              className={`fp__close-switch${isEffectivelyClosed ? " fp__close-switch--closed" : ""}`}
              onClick={openCloseModal}
              disabled={readOnly || submittingClose || isEffectivelyClosed}
              aria-pressed={isEffectivelyClosed}
              aria-label={isEffectivelyClosed ? "Closed" : "Close"}
            >
                <span className="fp__close-switch-track">
                  <span className="fp__close-switch-thumb" />
                </span>
                <span className="fp__close-switch-text">{isEffectivelyClosed ? "Closed" : "Close"}</span>
            </button>
            </div>
            <span className="fp__close-desc">Test Generation not required; close the case</span>
          </div>
          <span className="fp__task-id">
            Task Id: <strong>{taskId}</strong>
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="fp__loading">
          <svg className="fp__loading-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray="42 14" />
          </svg>
          <span>Loading validation results…</span>
        </div>
      ) : !isReady ? null : (
        <div className="fp__body">
          {/* Summary cards */}
          <div className="fp__cards">
            {CARDS.map((c) => (
              <div key={c.label} className="fp__card">
                <span className="fp__card-label">{c.label}</span>
                <span className="fp__card-value">{c.value}</span>
                {c.subtitle && <span className="fp__card-sub">{c.subtitle}</span>}
              </div>
            ))}
          </div>

          <hr className="fp__divider" />

          {/* Action Items */}
          <p className="fp__section-title">Action Items</p>
          <DataTable
            columns={ACTION_COLS}
            data={actionItems}
            pageSize={10}
            pageSizeOptions={[5, 10, 25, 50]}
            sortableColumns={["requirementId"]}
            searchableColumns={["requirementId", "missingFields"]}
          />

          <hr className="fp__divider" />

          {/* User Story Criteria */}
          <p className="fp__section-title">User Story Criteria</p>
          <DataTable
            columns={USER_STORY_COLS}
            data={userStory}
            pageSize={10}
            pageSizeOptions={[5, 10, 25, 50]}
            sortableColumns={["criterion", "criterionMeets"]}
            searchableColumns={["criterion"]}
          />

          <hr className="fp__divider" />

          {/* Summary Report */}
          <p className="fp__section-title">Summary Report</p>
          <DataTable
            columns={SUMMARY_COLS}
            data={summaryReport}
            pageSize={10}
            pageSizeOptions={[5, 10, 25, 50]}
            sortableColumns={["requirementId"]}
            searchableColumns={["requirementId"]}
          />
        </div>
      )}

      {closeModalOpen && (
        <div className="fp__modal-backdrop" role="dialog" aria-modal="true" aria-label="Close validation case">
          <div className="fp__modal fp__modal--compact">
            <h3 className="fp__modal-title">Close case?</h3>
            <p className="fp__modal-message">
              Closing it will mark the case for auto-rejection and you'll not be able to generate test-cases.
            </p>
            <div className="fp__modal-actions">
              <button type="button" className="fp__btn fp__btn--ghost" onClick={cancelClose} disabled={submittingClose}>
                Cancel
              </button>
              <button type="button" className="fp__btn fp__btn--primary" onClick={markClosed} disabled={submittingClose}>
                Mark Closed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ValidationFormPanel;
