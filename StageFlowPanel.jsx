/**
 * StageFlowPanel — pluggable multi-stage workflow panel.
 *
 * Each `stage` in the `stages` array supports:
 *   id               {string}    Unique identifier
 *   name             {string}    Display label
 *   icon             {ReactNode} SVG/element shown inside the circle
 *   component        {Component} forwardRef component shown as the form pane.
 *                                Receives: serviceData, stagesContext, stageStatus,
 *                                          errorMessage, onSubmitStart, onSubmitSuccess,
 *                                          onSubmitError
 *                                Exposes via ref: validate(), submit()
 *   service          {Function}  Optional async fn called when entering the stage.
 *                                Receives a context object keyed by stage id containing
 *                                all prior stages' serviceData (immutable snapshot).
 *                                Return value becomes serviceData for the form.
 *   autoSubmit       {boolean}   When true, the stage is auto-completed immediately
 *                                after its service resolves successfully. The form's
 *                                submit() is called automatically (no user action
 *                                required). Use for display-only terminal stages.
 *                                Default: false.
 *   showReloadOnFailure {boolean} Override global flag per-stage.
 *
 * Panel props:
 *   stages              {Array}   Stage configuration array
 *   showReloadOnFailure {boolean} Global default (default: false)
 *   freezePaneWhileLoading {boolean} When true, the pane is inert (non-interactive)
 *                                    while its stage service is IDLE or LOADING.
 *                                    Default: false.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./StageFlowPanel.css";

/* ------------------------------------------------------------------ */
/*  Exported status constants — consumers can reference these          */
/* ------------------------------------------------------------------ */
export const STAGE_STATUS = {
  IDLE:         "idle",
  LOADING:      "loading",
  READY:        "ready",        // service loaded, awaiting form submission
  SUCCESS:      "success",      // form submitted — tick shown
  ERROR:        "error",        // stage SERVICE failed — shows reload ring
  SUBMIT_ERROR: "submit_error", // form SUBMISSION failed — service was fine, no reload ring
  REJECTED:     "rejected",
  SKIPPED:      "skipped",
};

/* ------------------------------------------------------------------ */
/*  Internal SVG Icons                                                 */
/* ------------------------------------------------------------------ */
function SpinnerIcon() {
  return (
    <svg
      className="sfp__spinner"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12" cy="12" r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42 14"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ReloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8
               c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4
               -3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4
               l-2.35 2.35z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  StageFlowPanel                                                     */
/* ------------------------------------------------------------------ */
export default function StageFlowPanel({
  stages = [],
  showReloadOnFailure = false,
  freezePaneWhileLoading = false,
  /** When true: read-only browse mode — no service calls, no submit, free navigation */
  viewMode = false,
  /**
   * When true: resume mode — completed stages are seeded read-only from initialStageStates,
   * first incomplete stage is active and editable with live services.
   */
  resumeMode = false,
  /**
   * Seed state for view/resume mode. Object keyed by stage id:
   *   { [stageId]: { status, serviceData } }
   */
  initialStageStates = {},
  /**
   * When false (default), a REJECTED stage blocks forward navigation to all subsequent
   * stages — their circles are disabled and the Next button is inert.
   * Set to true to allow free forward navigation past rejected stages (e.g. read-only audit views).
   */
  allowNavigatePastRejected = false,
  /**
   * When true, any stage that reaches SUCCESS in new mode is rendered read-only when revisited,
   * matching the behaviour of resume mode. Users can still navigate back to view the submitted
   * data but cannot re-edit or re-submit it.
   * Default: false (existing behaviour — form stays editable after submit).
   */
  lockCompletedStages = false,
  /** Called after a stage reaches SUCCESS/REJECTED: (stageId, serviceData, stageIndex) */
  onStageComplete = null,
}) {
  /* ---- Core state ---- */
  const [activeIndex, setActiveIndex] = useState(() => {
    if (!resumeMode) return 0;
    // Land on the first stage that has no saved snapshot entry
    const first = stages.findIndex((s) => !initialStageStates?.[s.id]);
    const firstIncomplete = first === -1 ? stages.length - 1 : first;
    // If rejection blocks forward navigation, don't land past a rejected stage
    if (!allowNavigatePastRejected) {
      const rejectedIdx = stages.findIndex(
        (s) => initialStageStates?.[s.id]?.status === STAGE_STATUS.REJECTED
      );
      if (rejectedIdx !== -1 && rejectedIdx < firstIncomplete) return rejectedIdx;
    }
    return firstIncomplete;
  });
  const [stageStates, setStageStates] = useState(() =>
    stages.map((s) => {
      const seeded = (viewMode || resumeMode) && initialStageStates?.[s.id];
      if (seeded) {
        return {
          status:       initialStageStates[s.id].status ?? STAGE_STATUS.IDLE,
          serviceData:  initialStageStates[s.id].serviceData ?? null,
          errorMessage: null,
        };
      }
      return {
        status:      STAGE_STATUS.IDLE,
        serviceData: null,
        errorMessage: null,
      };
    })
  );
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [submitWarning, setSubmitWarning] = useState(null);

  /* Refs for form components (expose validate / submit) */
  const formRefs = useRef([]);
  /* Flag: Next button triggered a submit and we should auto-navigate on success */
  const pendingNavigateRef = useRef(false);

  /* ---- State updater ---- */
  const updateStage = useCallback((index, patch) => {
    setStageStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  /* ---------------------------------------------------------------- */
  /* Service / load                                                    */
  /* ---------------------------------------------------------------- */
  const callLoadService = useCallback(
    async (index, snap) => {
      const stage = stages[index];
      if (!stage?.service) return;

      updateStage(index, { status: STAGE_STATUS.LOADING, errorMessage: null });
      try {
        // Build an immutable context object from all prior stages' serviceData
        const context = Object.fromEntries(
          stages.slice(0, index).map((s, i) => [s.id, snap[i]?.serviceData ?? null])
        );
        const data = await stage.service(context);
        // Service loaded — form not yet submitted; show green circle without tick
        updateStage(index, { status: STAGE_STATUS.READY, serviceData: data });
        // autoSubmit: stage needs no user action — complete immediately after service
        if (stage.autoSubmit) {
          // Defer one tick so the React state flush (serviceData) settles before
          // the form ref's submit() reads it
          setTimeout(() => formRefs.current[index]?.submit?.(), 0);
        }
      } catch (err) {
        updateStage(index, {
          status:       STAGE_STATUS.ERROR,
          errorMessage: err?.message || "Failed to load stage data.",
        });
      }
    },
    [stages, updateStage]
  );

  /* ---------------------------------------------------------------- */
  /* Navigation                                                        */
  /* ---------------------------------------------------------------- */
  const goToStage = useCallback(
    (index) => {
      if (index < 0 || index >= stages.length) return;
      pendingNavigateRef.current = false; // cancel any pending auto-navigate on manual nav
      setActiveIndex(index);
      // In view mode, skip service calls — data is already seeded from snapshot
      if (viewMode) return;
      // In resume mode, skip service calls for stages that are already seeded (SUCCESS/SKIPPED)
      const state = stageStates[index];
      if (resumeMode && state.status !== STAGE_STATUS.IDLE) return;
      // Call load service if stage is entering for the first time
      if (stages[index]?.service && state.status === STAGE_STATUS.IDLE) {
        // Defer so the activeIndex state has settled
        setTimeout(() => callLoadService(index, stageStates), 0);
      }
    },
    [stages, stageStates, callLoadService, viewMode, resumeMode]
  );

  /* In resume mode, auto-trigger the service for the initially-active stage.
   * No goToStage() is called on first render so this is the only entry point. */
  useEffect(() => {
    if (!resumeMode) return;
    const idx = activeIndex;
    // Don't start a service when a prior rejected stage blocks forward navigation
    if (!allowNavigatePastRejected) {
      const blocked = stageStates.some(
        (s, i) => i < idx && s?.status === STAGE_STATUS.REJECTED
      );
      if (blocked) return;
    }
    if (stages[idx]?.service && stageStates[idx]?.status === STAGE_STATUS.IDLE) {
      callLoadService(idx, stageStates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional mount-only

  /* Clear submit warning on stage navigation */
  useEffect(() => {
    setSubmitWarning(null);
  }, [activeIndex]);

  /* Clear submit warning when the service resolves (ready, success, or error) */
  useEffect(() => {
    if (!submitWarning) return;
    const s = stageStates[activeIndex]?.status;
    if (
      s === STAGE_STATUS.READY ||
      s === STAGE_STATUS.SUCCESS ||
      s === STAGE_STATUS.ERROR
    ) {
      setSubmitWarning(null);
    }
  }, [stageStates, activeIndex, submitWarning]);

  /* Auto-navigate after a Next-triggered submission succeeds */
  useEffect(() => {
    if (
      pendingNavigateRef.current &&
      stageStates[activeIndex]?.status === STAGE_STATUS.SUCCESS
    ) {
      pendingNavigateRef.current = false;
      const next = activeIndex + 1;
      if (next < stages.length) {
        setActiveIndex(next);
        const nextState = stageStates[next];
        if (stages[next]?.service && nextState?.status === STAGE_STATUS.IDLE) {
          setTimeout(() => callLoadService(next, stageStates), 0);
        }
      }
    }
  }, [stageStates, activeIndex, stages, callLoadService]);

  /* ---------------------------------------------------------------- */
  /* Derived state                                                     */
  /* ---------------------------------------------------------------- */
  const canGoNext = useMemo(() => {
    if (activeIndex >= stages.length - 1) return false;
    for (let i = 0; i <= activeIndex; i++) {
      const s = stageStates[i]?.status;
      if (s === STAGE_STATUS.REJECTED) {
        if (!allowNavigatePastRejected) return false;
        continue; // allowNavigatePastRejected=true → treat as passable
      }
      if (
        s !== STAGE_STATUS.SUCCESS &&
        s !== STAGE_STATUS.READY &&
        s !== STAGE_STATUS.SKIPPED
      ) return false;
    }
    return true;
  }, [activeIndex, stages.length, stageStates, allowNavigatePastRejected]);

  const canGoPrev = activeIndex > 0;

  const isStageAccessible = useCallback(
    (index) => {
      // In view mode every stage is freely browseable, unless rejection blocking is active
      if (viewMode) {
        if (!allowNavigatePastRejected) {
          for (let i = 0; i < index; i++) {
            if (stageStates[i]?.status === STAGE_STATUS.REJECTED) return false;
          }
        }
        return true;
      }
      // Already visited or current → ok
      if (index <= activeIndex) return true;
      // Forward circle-click: ALL prior stages must be fully submitted (SUCCESS) or skipped.
      // READY is intentionally excluded — it means the HTTP service loaded but the user
      // has not yet submitted the form. The form must reach SUCCESS before the next
      // stage's circle becomes clickable.
      // IDLE is allowed for the current active stage ONLY when it has no service
      // (service-less stage: user fills a form with no async load; clicking forward
      //  triggers handleNext which submits then navigates).
      for (let i = 0; i < index; i++) {
        const s = stageStates[i]?.status;
        if (s === STAGE_STATUS.REJECTED) {
          if (!allowNavigatePastRejected) return false;
          continue; // allowNavigatePastRejected=true → treat as passable
        }
        if (s !== STAGE_STATUS.SUCCESS && s !== STAGE_STATUS.SKIPPED) {
          if (i === activeIndex && s === STAGE_STATUS.IDLE && !stages[i]?.service) continue;
          return false;
        }
      }
      return true;
    },
    [activeIndex, stageStates, stages, viewMode, allowNavigatePastRejected]
  );

  /* Whether to show the reload ring for a given stage index */
  const shouldShowReload = useCallback(
    (index) => {
      const perStage = stages[index]?.showReloadOnFailure;
      return perStage !== undefined ? perStage : showReloadOnFailure;
    },
    [stages, showReloadOnFailure]
  );

  /* ---------------------------------------------------------------- */
  /* Handlers                                                          */
  /* ---------------------------------------------------------------- */
  const handlePrev = useCallback(() => {
    if (canGoPrev) goToStage(activeIndex - 1);
  }, [canGoPrev, activeIndex, goToStage]);

  const handleNext = useCallback(async () => {
    // In view mode, simply navigate forward — no validation or submit
    if (viewMode) {
      // Respect rejection blocking: don't advance past a rejected stage
      if (!allowNavigatePastRejected) {
        const blocked = stageStates.some(
          (s, i) => i <= activeIndex && s?.status === STAGE_STATUS.REJECTED
        );
        if (blocked) return;
      }
      goToStage(activeIndex + 1);
      return;
    }

    const formRef = formRefs.current[activeIndex];

    // 1. Validate mandatory fields
    if (formRef?.validate) {
      const valid = await formRef.validate();
      if (!valid) return;
    }

    // 2. Block submit while stage service is still in flight
    if (stages[activeIndex]?.service) {
      const s = stageStates[activeIndex]?.status;
      if (s === STAGE_STATUS.LOADING || s === STAGE_STATUS.IDLE) {
        setSubmitWarning("Stage data is still loading\u2014please wait before submitting.");
        return;
      }
    }

    // 3. If the stage is already fully submitted (SUCCESS) or skipped, navigate directly
    const curStatus = stageStates[activeIndex]?.status;
    if (curStatus === STAGE_STATUS.SUCCESS || curStatus === STAGE_STATUS.SKIPPED) {
      goToStage(activeIndex + 1);
      return;
    }
    // READY falls through: service is done but form not yet submitted — run submit()

    // 4. Submit the form and wait for result
    if (formRef?.submit) {
      pendingNavigateRef.current = true;
      const result = await formRef.submit(); // form calls onSubmitStart/Success/Error internally
      if (!result?.success) {
        pendingNavigateRef.current = false; // submission failed — stay on stage
      }
    }
  }, [activeIndex, stageStates, goToStage, viewMode]);

  // handleCircleClick is defined after handleNext so it can call it for IDLE (no-service) stages.
  const handleCircleClick = useCallback(
    async (index) => {
      const { status } = stageStates[index] || {};
      if (status === STAGE_STATUS.LOADING) return;
      if (!isStageAccessible(index)) return;
      // Forward click from a service-less IDLE stage: submit the form first (same as Next button).
      // READY stages are blocked by isStageAccessible — the user must use the Next button
      // to submit the form; only after SUCCESS does the forward circle become clickable.
      const curStatus = stageStates[activeIndex]?.status;
      if (
        index > activeIndex &&
        curStatus === STAGE_STATUS.IDLE &&
        !stages[activeIndex]?.service
      ) {
        await handleNext();
        return;
      }
      goToStage(index);
    },
    [stageStates, isStageAccessible, goToStage, activeIndex, handleNext, stages]
  );

  const handleRetry = useCallback(
    (index) => {
      const stage = stages[index];
      if (stage?.service) {
        callLoadService(index, stageStates);
      } else {
        // Delegate to form component
        formRefs.current[index]?.retry?.();
      }
    },
    [stages, stageStates, callLoadService]
  );

  const handleSkip = useCallback(() => {
    updateStage(activeIndex, { status: STAGE_STATUS.SKIPPED, errorMessage: null });
    const next = activeIndex + 1;
    if (next < stages.length) {
      pendingNavigateRef.current = false;
      setActiveIndex(next);
      const nextState = stageStates[next];
      if (stages[next]?.service && nextState?.status === STAGE_STATUS.IDLE) {
        setTimeout(() => callLoadService(next, stageStates), 0);
      }
    }
  }, [activeIndex, stages, stageStates, updateStage, callLoadService]);

  /* ---------------------------------------------------------------- */
  /* CSS class helpers                                                 */
  /* ---------------------------------------------------------------- */
  const circleClass = (index) => {
    const { status } = stageStates[index] || {};
    const isActive = index === activeIndex;
    return [
      "sfp__circle",
      isActive                                  && "sfp__circle--current",
      status === STAGE_STATUS.LOADING           && "sfp__circle--loading",
      status === STAGE_STATUS.READY             && "sfp__circle--ready",
      status === STAGE_STATUS.SUCCESS           && "sfp__circle--success",
      status === STAGE_STATUS.ERROR             && "sfp__circle--error",
      status === STAGE_STATUS.SUBMIT_ERROR      && "sfp__circle--error",
      status === STAGE_STATUS.REJECTED          && "sfp__circle--rejected",
      status === STAGE_STATUS.SKIPPED           && "sfp__circle--skipped",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const labelClass = (index) => {
    const { status } = stageStates[index] || {};
    const isActive = index === activeIndex;
    return [
      "sfp__stage-label",
      isActive                                                && "sfp__stage-label--active",
      (status === STAGE_STATUS.READY ||
       status === STAGE_STATUS.SUCCESS)                       && "sfp__stage-label--success",
      (status === STAGE_STATUS.ERROR ||
       status === STAGE_STATUS.SUBMIT_ERROR)                  && "sfp__stage-label--error",
      status === STAGE_STATUS.REJECTED                        && "sfp__stage-label--rejected",
      status === STAGE_STATUS.SKIPPED                         && "sfp__stage-label--skipped",
    ]
      .filter(Boolean)
      .join(" ");
  };

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
  if (!stages.length) return null;

  return (
    <div className="sfp" role="region" aria-label="Stage flow panel">
      {/* ======================================================= */}
      {/* Stage Track                                              */}
      {/* ======================================================= */}
      <div className="sfp__track" role="list" aria-label="Stages">
        {stages.map((stage, index) => {
          const { status, errorMessage } = stageStates[index] || {};
          const isActive    = index === activeIndex;
          const accessible  = isStageAccessible(index);
          const isLoading   = status === STAGE_STATUS.LOADING;
          const isError     = status === STAGE_STATUS.ERROR || status === STAGE_STATUS.SUBMIT_ERROR;
          // Reload ring only for service failures (ERROR); form submission failures (SUBMIT_ERROR)
          // do not restart the service — the user can retry via the Next button.
          const showReload  = status === STAGE_STATUS.ERROR && (stages[index]?.service ? true : shouldShowReload(index));

          return (
            <Fragment key={stage.id}>
              {/* Connector line before every stage except the first */}
              {index > 0 && (
                <div
                  className={[
                    "sfp__connector",
                    (stageStates[index - 1]?.status === STAGE_STATUS.SUCCESS ||
                     stageStates[index - 1]?.status === STAGE_STATUS.READY) &&
                      "sfp__connector--done",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
              )}

              {/* Stage node */}
              <div className="sfp__stage-slot" role="listitem">
                {/* Circle + optional retry ring */}
                <div className="sfp__node-wrap">
                  {showReload && (
                    <button
                      type="button"
                      className="sfp__retry-ring"
                      onClick={() => handleRetry(index)}
                      aria-label={`Retry ${stage.name}`}
                      title="Click to retry"
                    >
                      <span className="sfp__retry-badge">
                        <ReloadIcon />
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={circleClass(index)}
                    onClick={() => handleCircleClick(index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                    disabled={!accessible || isLoading}
                    aria-label={[
                      stage.name,
                      status === STAGE_STATUS.READY         ? "(Ready)"     : "",
                      status === STAGE_STATUS.SUCCESS       ? "(Completed)" : "",
                      status === STAGE_STATUS.REJECTED      ? "(Rejected)"  : "",
                      status === STAGE_STATUS.SKIPPED       ? "(Skipped)"   : "",
                      isError && errorMessage ? `— Error: ${errorMessage}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {status === STAGE_STATUS.LOADING ? (
                      <SpinnerIcon />
                    ) : status === STAGE_STATUS.REJECTED ||
                      status === STAGE_STATUS.ERROR ||
                      status === STAGE_STATUS.SUBMIT_ERROR ? (
                      <XIcon />
                    ) : (
                      // IDLE, READY, SUCCESS, SKIPPED — show stage icon
                      <span className="sfp__circle-icon" aria-hidden="true">
                        {stage.icon}
                      </span>
                    )}
                  </button>

                  {/* Success badge — small green tick at top-right of circle */}
                  {status === STAGE_STATUS.SUCCESS && (
                    <span className="sfp__success-badge" aria-hidden="true">
                      <CheckIcon />
                    </span>
                  )}
                </div>

                {/* Stage name label */}
                <span className={labelClass(index)}>{stage.name}</span>

                {/* Error tooltip on hover */}
                {hoveredIndex === index && isError && errorMessage && (
                  <div
                    className="sfp__tooltip"
                    role="tooltip"
                    id={`sfp-tooltip-${stage.id}`}
                  >
                    {errorMessage}
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* ======================================================= */}
      {/* Form Panes (all mounted, only one visible)               */}
      {/* ======================================================= */}
      <div className="sfp__content">
        {stages.map((stage, index) => {
          const { status, serviceData, errorMessage } = stageStates[index] || {};
          const FormComponent = stage.component;
          const isVisible = index === activeIndex;

          // Immutable snapshot of all prior stages' serviceData, keyed by stage id
          const stagesContext = Object.fromEntries(
            stages.slice(0, index).map((s, i) => [s.id, stageStates[i]?.serviceData ?? null])
          );

          const isPaneFrozen =
            freezePaneWhileLoading &&
            !!stage.service &&
            (status === STAGE_STATUS.IDLE || status === STAGE_STATUS.LOADING);

          return (
            <div
              key={stage.id}
              className={`sfp__pane${isVisible ? " sfp__pane--visible" : ""}`}
              aria-hidden={!isVisible}
              inert={isPaneFrozen ? "" : undefined}
            >
              {FormComponent && (
                <FormComponent
                  ref={(el) => {
                    formRefs.current[index] = el;
                  }}
                  serviceData={serviceData}
                  stagesContext={stagesContext}
                  stageStatus={status}
                  errorMessage={errorMessage}
                  readOnly={
                    viewMode ||
                    (resumeMode && stageStates[index]?.status === STAGE_STATUS.SUCCESS) ||
                    (lockCompletedStages && stageStates[index]?.status === STAGE_STATUS.SUCCESS)
                  }
                  onSubmitStart={() =>
                    updateStage(index, {
                      status: STAGE_STATUS.LOADING,
                      errorMessage: null,
                    })
                  }
                  onSubmitSuccess={(payload) => {
                    const stablePayload = payload ?? stageStates[index]?.serviceData ?? null;
                    updateStage(index, { status: STAGE_STATUS.SUCCESS, serviceData: stablePayload });
                    onStageComplete?.(stages[index].id, stablePayload, index);
                  }}
                  onSubmitRejected={(payload) => {
                    updateStage(index, { status: STAGE_STATUS.REJECTED, serviceData: payload ?? null, errorMessage: null });
                    onStageComplete?.(stages[index].id, payload ?? null, index, STAGE_STATUS.REJECTED);
                  }}
                  onSubmitError={(msg) =>
                    updateStage(index, {
                      status: STAGE_STATUS.SUBMIT_ERROR,
                      errorMessage: msg || "Submission failed.",
                    })
                  }
                />
              )}

              {/* Error message banner at bottom of form */}
              {isVisible &&
                (status === STAGE_STATUS.ERROR || status === STAGE_STATUS.SUBMIT_ERROR) &&
                errorMessage && (
                <div className="sfp__form-error" role="alert">
                  <strong>Error: </strong>
                  {errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ======================================================= */}
      {/* Submit-blocked warning                                   */}
      {/* ======================================================= */}
      {submitWarning && (
        <div className="sfp__submit-warning" role="alert">
          {submitWarning}
        </div>
      )}

      {/* ======================================================= */}
      {/* Navigation Bar                                           */}
      {/* ======================================================= */}
      <div className="sfp__nav">
        <button
          type="button"
          className="sfp__nav-btn sfp__nav-btn--prev"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Go to previous stage"
        >
          <span className="sfp__nav-icon">
            <ChevronLeftIcon />
          </span>
          <span>Previous</span>
        </button>

        <span className="sfp__step-indicator" aria-live="polite" aria-atomic="true">
          Step {activeIndex + 1} of {stages.length}
        </span>

        <div className="sfp__nav-right">
          {!viewMode && stages[activeIndex]?.skippable &&
            activeIndex < stages.length - 1 &&
            stageStates[activeIndex]?.status !== STAGE_STATUS.REJECTED && (
              <button
                type="button"
                className="sfp__nav-btn sfp__nav-btn--skip"
                onClick={handleSkip}
                aria-label="Skip this stage"
              >
                <span>Skip</span>
              </button>
            )}
          <button
            type="button"
            className="sfp__nav-btn sfp__nav-btn--next"
            onClick={handleNext}
            disabled={
              viewMode
                ? activeIndex >= stages.length - 1 ||
                  (!allowNavigatePastRejected &&
                    stageStates.some((s, i) => i <= activeIndex && s?.status === STAGE_STATUS.REJECTED))
                : (
                  !canGoNext &&
                  stageStates[activeIndex]?.status !== STAGE_STATUS.SUBMIT_ERROR &&
                  // IDLE only unlocks Next for service-less stages (user fills form, no async load).
                  // For stages with a service, Next stays disabled until service completes (READY).
                  (!!stages[activeIndex]?.service ||
                    stageStates[activeIndex]?.status !== STAGE_STATUS.IDLE)
                )
            }
            aria-label="Go to next stage"
          >
            <span>Next</span>
            <span className="sfp__nav-icon">
              <ChevronRightIcon />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
