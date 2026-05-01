/**
 * CaseManagementPage
 *
 * Shows a searchable/sortable table of all test-case workflows (from /snapshots).
 * Above the table: comparison controls and a "New Test Case" action.
 * Per-row actions: View, Resume, Approve, Dashboard.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../DataTable/DataTable";
import StageFlowPanelDemo, {
  buildInitialStageStates,
} from "../StageFlowPanel/StageFlowPanelDemo";
import CompareEvaluationsTable from "../CompareEvaluations/CompareEvaluationsTable";
import CompareEvaluationsToolbar from "../CompareEvaluations/CompareEvaluationsToolbar";
import InlineFullscreenPanel from "../shared/InlineFullscreenPanel";
import {
  fetchEvaluationComparison,
  listSnapshots,
  loadSnapshot,
} from "../../services/testManagementService";
import "./CaseManagementPage.css";

const FAVOURITES_STORAGE_KEY = "ubs.compare.favourites";

function deriveCreationDate(caseId) {
  const hash = Array.from(caseId || "").reduce(
    (total, char) => total + char.charCodeAt(0),
    0
  );
  const baseDate = new Date(Date.UTC(2026, 0, 1));
  baseDate.setUTCDate(baseDate.getUTCDate() + (hash % 120));
  return baseDate.toISOString().slice(0, 10);
}

async function resolveStatus(summary) {
  const { completedUpTo } = summary;
  if (completedUpTo >= 4) return "Completed";
  if (completedUpTo === 2) return "Pending Approval";
  if (completedUpTo === 3) {
    try {
      const snap = await loadSnapshot(summary.caseId);
      const approvalData = snap.stageData?.approval;
      const isRejected =
        approvalData?._sfpStatus === "rejected" || approvalData?.decision === "reject";
      return isRejected ? "Rejected" : "In Progress";
    } catch {
      return "In Progress";
    }
  }
  return "In Progress";
}

const STATUS_META = {
  Completed: { cls: "cm__badge--green" },
  "Pending Approval": { cls: "cm__badge--yellow" },
  Rejected: { cls: "cm__badge--red" },
  "In Progress": { cls: "cm__badge--blue" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? {};
  return <span className={`cm__badge ${meta.cls ?? ""}`}>{status}</span>;
}

function ActionButtons({ row, onView, onResume, onApprove, onDashboard }) {
  const { caseId, status } = row;
  return (
    <div className="cm__row-actions">
      {status === "Completed" && (
        <button
          type="button"
          className="cm__act-btn cm__act-btn--dashboard"
          onClick={() => onDashboard(caseId)}
        >
          Dashboard
        </button>
      )}
      {status === "Pending Approval" && (
        <button
          type="button"
          className="cm__act-btn cm__act-btn--primary"
          onClick={() => onApprove(caseId)}
        >
          Approve
        </button>
      )}
      {(status === "In Progress" || status === "Pending Approval") && (
        <button
          type="button"
          className="cm__act-btn cm__act-btn--secondary"
          onClick={() => onResume(caseId)}
        >
          Resume
        </button>
      )}
      <button
        type="button"
        className="cm__act-btn cm__act-btn--ghost"
        onClick={() => onView(caseId)}
      >
        View
      </button>
    </div>
  );
}

function BackBar({ onBack, label }) {
  return (
    <div className="cm__back-bar">
      <button type="button" className="cm__back-btn" onClick={onBack}>
        ← Back to Cases
      </button>
      {label && <span className="cm__back-label">{label}</span>}
    </div>
  );
}

export default function CaseManagementPage({
  showComparisonCheckboxes = false,
  maxComparisonCount = 2,
  showEvaluationRating = false,
}) {
  const [pageMode, setPageMode] = useState("list");
  const [cases, setCases] = useState([]);
  const [loadingList, setLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [dashboardCaseId, setDashboardCaseId] = useState(null);
  const [activeCase, setActiveCase] = useState(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
  const [comparePanelOpen, setComparePanelOpen] = useState(false);
  const [compareValidationMessage, setCompareValidationMessage] = useState("");
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [comparisonByCaseId, setComparisonByCaseId] = useState({});
  const [favourites, setFavourites] = useState([]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const summaries = await listSnapshots();
      const enriched = await Promise.all(
        summaries.map(async (summary) => ({
          caseId: summary.caseId,
          completedUpTo: summary.completedUpTo,
          status: await resolveStatus(summary),
          creationDate: deriveCreationDate(summary.caseId),
        }))
      );
      setCases(enriched);
    } catch {
      setListError("Could not load cases. Check the API connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
      if (saved) {
        setFavourites(JSON.parse(saved));
      }
    } catch {
      setFavourites([]);
    }
  }, []);

  useEffect(() => {
    const caseIdSet = new Set(cases.map((item) => item.caseId));
    setSelectedCaseIds((prev) => prev.filter((caseId) => caseIdSet.has(caseId)));
  }, [cases]);

  useEffect(() => {
    if (!comparePanelOpen || selectedCaseIds.length < 2) {
      return undefined;
    }

    let cancelled = false;
    setComparisonLoading(true);
    setComparisonError("");

    Promise.all(selectedCaseIds.map((caseId) => fetchEvaluationComparison(caseId)))
      .then((responses) => {
        if (cancelled) return;
        const next = responses.reduce((accumulator, item) => {
          accumulator[item.caseId] = item;
          return accumulator;
        }, {});
        setComparisonByCaseId(next);
      })
      .catch(() => {
        if (!cancelled) {
          setComparisonError("Could not load evaluation comparison metrics.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setComparisonLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [comparePanelOpen, selectedCaseIds]);

  useEffect(() => {
    if (comparePanelOpen && selectedCaseIds.length < 2) {
      setComparePanelOpen(false);
    }
  }, [comparePanelOpen, selectedCaseIds]);

  const handleView = useCallback(async (caseId) => {
    try {
      const snap = await loadSnapshot(caseId);
      setActiveCase({
        caseId,
        completedUpTo: snap.completedUpTo ?? -1,
        initialStageStates: buildInitialStageStates(snap.stageData),
      });
      setPageMode("view");
    } catch {
      alert(`Could not load snapshot for case: ${caseId}`);
    }
  }, []);

  const handleResume = useCallback(async (caseId) => {
    try {
      const snap = await loadSnapshot(caseId);
      setActiveCase({
        caseId,
        completedUpTo: snap.completedUpTo ?? -1,
        initialStageStates: buildInitialStageStates(snap.stageData),
      });
      setPageMode("resume");
    } catch {
      alert(`Could not load snapshot for case: ${caseId}`);
    }
  }, []);

  const handleApprove = handleResume;

  const handleDashboard = useCallback((caseId) => {
    setDashboardCaseId(caseId);
  }, []);

  const closeDashboardPanel = useCallback(() => {
    setDashboardCaseId(null);
  }, []);

  const closeComparePanel = useCallback(() => {
    setComparePanelOpen(false);
  }, []);

  const handleBack = useCallback(() => {
    setPageMode("list");
    setActiveCase(null);
    loadCases();
  }, [loadCases]);

  const handleOpenCompare = useCallback(() => {
    if (selectedCaseIds.length < 2) {
      setCompareValidationMessage("Select at least 2 completed items for comparison.");
      return;
    }
    setCompareValidationMessage("");
    setComparePanelOpen(true);
  }, [selectedCaseIds]);

  const handleSelectedCaseIdsChange = useCallback((nextIds) => {
    setCompareValidationMessage("");
    setSelectedCaseIds(nextIds);
  }, []);

  const handleRateEvaluation = useCallback((caseId, rating, evaluation) => {
    const nextItem = {
      caseId,
      rating,
      creationDate: evaluation.creationDate,
      model: evaluation.model,
      winner: evaluation.winner,
    };

    setFavourites((prev) => {
      const filtered = prev.filter((item) => item.caseId !== caseId);
      const next = [nextItem, ...filtered].slice(0, 12);
      try {
        window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures and keep state in memory.
      }
      return next;
    });
  }, []);

  const selectedItems = useMemo(() => {
    const byId = new Map(cases.map((item) => [item.caseId, item]));
    return selectedCaseIds
      .map((caseId) => byId.get(caseId))
      .filter(Boolean);
  }, [cases, selectedCaseIds]);

  const ratingsByCaseId = useMemo(
    () => favourites.reduce((accumulator, item) => {
      accumulator[item.caseId] = item.rating;
      return accumulator;
    }, {}),
    [favourites]
  );

  const columns = useMemo(
    () => [
      { key: "caseId", label: "Case Id", width: "26%", sortable: true },
      {
        key: "status",
        label: "Status",
        width: "18%",
        render: (value) => <StatusBadge status={value} />,
      },
      {
        key: "creationDate",
        label: "Creation Date",
        width: "16%",
        sortable: true,
      },
      {
        key: "actions",
        label: "Actions",
        width: "40%",
        render: (_, row) => (
          <ActionButtons
            row={row}
            onView={handleView}
            onResume={handleResume}
            onApprove={handleApprove}
            onDashboard={handleDashboard}
          />
        ),
      },
    ],
    [handleApprove, handleDashboard, handleResume, handleView]
  );

  if (pageMode === "create") {
    return (
      <div className="cm">
        <BackBar onBack={handleBack} label="New Test Case" />
        <StageFlowPanelDemo mode="create" onSaved={loadCases} />
      </div>
    );
  }

  if (pageMode === "view" && activeCase) {
    return (
      <div className="cm">
        <BackBar
          onBack={handleBack}
          label={(
            <>
              Viewing case: <strong>{activeCase.caseId}</strong>
            </>
          )}
        />
        <StageFlowPanelDemo
          mode="view"
          initialCaseId={activeCase.caseId}
          initialStageStates={activeCase.initialStageStates}
        />
      </div>
    );
  }

  if (pageMode === "resume" && activeCase) {
    return (
      <div className="cm">
        <BackBar
          onBack={handleBack}
          label={(
            <>
              Resuming case: <strong>{activeCase.caseId}</strong>
            </>
          )}
        />
        <StageFlowPanelDemo
          mode="resume"
          initialCaseId={activeCase.caseId}
          initialCompletedUpTo={activeCase.completedUpTo}
          initialStageStates={activeCase.initialStageStates}
          onSaved={loadCases}
        />
      </div>
    );
  }

  return (
    <div className="cm">
      <div className="cm__header">
        <div>
          <h2 className="cm__title">Case Management</h2>
          <p className="cm__subtitle">
            View, resume, approve, compare, and review completed evaluations.
          </p>
        </div>

        <div className="cm__header-actions">
          <CompareEvaluationsToolbar
            selectedItems={selectedItems}
            selectedCaseIds={selectedCaseIds}
            onSelectedCaseIdsChange={handleSelectedCaseIdsChange}
            maxComparisonCount={maxComparisonCount}
            onCompare={handleOpenCompare}
            validationMessage={compareValidationMessage}
            favourites={favourites}
            showRatingStars={showEvaluationRating}
          />

          <button
            type="button"
            className="cm__btn cm__btn--new"
            onClick={() => setPageMode("create")}
          >
            + New Test Case
          </button>
        </div>
      </div>

      {comparePanelOpen && (
        <div className="cm__inline-panel-wrap">
          <InlineFullscreenPanel
            isOpen={comparePanelOpen}
            onBack={closeComparePanel}
            backLabel="Back to Cases"
            title="Compare Evaluations"
            enableFullscreenToggle
          >
            <CompareEvaluationsTable
              evaluations={comparisonByCaseId}
              selectedCaseIds={selectedCaseIds}
              loading={comparisonLoading}
              error={comparisonError}
              showRatingStars={showEvaluationRating}
              ratingsByCaseId={ratingsByCaseId}
              onRate={handleRateEvaluation}
            />
          </InlineFullscreenPanel>
        </div>
      )}

      {dashboardCaseId && (
        <div className="cm__inline-panel-wrap">
          <InlineFullscreenPanel
            isOpen={Boolean(dashboardCaseId)}
            onBack={closeDashboardPanel}
            backLabel="Back to Cases"
            title={`Dashboard: ${dashboardCaseId}`}
            enableFullscreenToggle
            compact
          />
        </div>
      )}

      {listError && <p className="cm__message cm__message--error">{listError}</p>}

      {loadingList && !listError && (
        <p className="cm__message">Loading cases…</p>
      )}

      {!loadingList && !listError && (
        <>
          <div className="cm__toolbar">
            <span className="cm__count">
              {cases.length} case{cases.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              className="cm__refresh-btn"
              onClick={loadCases}
              title="Refresh list"
            >
              ↺ Refresh
            </button>
          </div>

          <DataTable
            columns={columns}
            data={cases}
            pageSize={10}
            pageSizeOptions={[5, 10, 25, 50]}
            sortableColumns={["caseId", "status", "creationDate"]}
            searchableColumns={["caseId", "status", "creationDate"]}
            paginationPlacement="top"
            selection={{
              enabled: showComparisonCheckboxes,
              rowKey: "caseId",
              selectedRowIds: selectedCaseIds,
              onSelectedRowIdsChange: handleSelectedCaseIdsChange,
              isRowSelectable: (row) => row.status === "Completed",
              maxSelectable: maxComparisonCount,
            }}
          />
        </>
      )}
    </div>
  );
}
