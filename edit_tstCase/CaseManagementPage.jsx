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

function normalizeCaseSortKey(sortKey) {
  if (sortKey === "creationDate") return "createdAt";
  return sortKey || "caseId";
}

function applyLocalCaseFilters(rows, filters) {
  const entries = Object.entries(filters || {}).filter(([, value]) => String(value || "").trim());
  if (entries.length === 0) return rows;

  return rows.filter((row) =>
    entries.every(([key, value]) =>
      String(row?.[key] ?? "")
        .toLowerCase()
        .includes(String(value).toLowerCase())
    )
  );
}

function applyLocalCaseSort(rows, sort) {
  const primary = Array.isArray(sort) ? sort[0] : null;
  if (!primary?.key) return rows;

  const direction = primary.dir === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = String(left?.[primary.key] ?? "");
    const rightValue = String(right?.[primary.key] ?? "");
    return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
}

async function resolveStatus(summary) {
  const { completedUpTo } = summary;
  if (completedUpTo >= 4) return "Completed";
  try {
    const snap = await loadSnapshot(summary.caseId);
    const validationData = snap.stageData?.validation;
    const approvalData = snap.stageData?.approval;
    const validationRejected =
      validationData?._sfpStatus === "rejected" || validationData?.decision === "reject";
    if (validationRejected) return "Rejected";
    const approvalRejected =
      approvalData?._sfpStatus === "rejected" || approvalData?.decision === "reject";
    if (approvalRejected) return "Rejected";
  } catch {
    // Fall through to the completedUpTo-based status below.
  }

  if (completedUpTo === 2) return "Pending Approval";
  if (completedUpTo === 3) {
    return "In Progress";
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
          className="cm__act-btn cm__act-btn--primary cm__act-btn--approve"
          onClick={() => onApprove(caseId)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21.801 10A10 10 0 1 1 17 3.335" />
            <path d="m9 11 3 3L22 4" />
          </svg>
          Approve
        </button>
      )}
      {(status === "In Progress" || status === "Pending Approval") && (
        <button
          type="button"
          className="cm__act-btn cm__act-btn--secondary cm__act-btn--resume"
          onClick={() => onResume(caseId)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Resume
        </button>
      )}
      <button
        type="button"
        className="cm__act-btn cm__act-btn--ghost cm__act-btn--view"
        onClick={() => onView(caseId)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
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
  testGenerationEditorMode = "inline",
}) {
  const [tableState, setTableState] = useState({
    filters: {},
    pageSize: 5,
  });
  const [pageMode, setPageMode] = useState("list");
  const [caseCount, setCaseCount] = useState(0);
  const [listError, setListError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [caseLookup, setCaseLookup] = useState({});
  const [dashboardCaseId, setDashboardCaseId] = useState(null);
  const [activeCase, setActiveCase] = useState(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
  const [comparePanelOpen, setComparePanelOpen] = useState(false);
  const [compareValidationMessage, setCompareValidationMessage] = useState("");
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [comparisonByCaseId, setComparisonByCaseId] = useState({});
  const [favourites, setFavourites] = useState([]);

  const toCaseRow = useCallback(async (summary) => ({
    caseId: summary.caseId,
    completedUpTo: summary.completedUpTo,
    status: summary.status ?? await resolveStatus(summary),
    creationDate: summary.creationDate ?? deriveCreationDate(summary.caseId),
  }), []);

  const caseTableService = useCallback(async (params) => {
    try {
      setListError(null);

      const page = Number(params?.page) || 1;
      const pageSize = Number(params?.pageSize) || 10;
      const sort = Array.isArray(params?.sort) ? params.sort : [];
      const filters = params?.filters || {};

      const remoteParams = {
        page: Math.max(0, page - 1),
        size: pageSize,
        sortBy: normalizeCaseSortKey(sort?.[0]?.key),
        sortDirection: sort?.[0]?.dir || "asc",
        filters,
        enableRemotePaging: true,
        enableRemoteSorting: true,
        enableRemoteFiltering: true,
      };

      const payload = await listSnapshots(remoteParams);

      const pagedContent = Array.isArray(payload?.content)
        ? payload.content
        : Array.isArray(payload?.data)
          ? payload.data
          : null;

      if (pagedContent) {
        const rows = await Promise.all(pagedContent.map((item) => toCaseRow(item)));
        const total = payload.totalElements ?? payload.total ?? rows.length;

        setCaseCount(total);
        setCaseLookup((prev) => {
          const next = { ...prev };
          rows.forEach((row) => {
            next[row.caseId] = row;
          });
          return next;
        });

        return { data: rows, total };
      }

      const summaries = Array.isArray(payload) ? payload : [];
      const enriched = await Promise.all(summaries.map((summary) => toCaseRow(summary)));
      const filtered = applyLocalCaseFilters(enriched, filters);
      const sorted = applyLocalCaseSort(filtered, sort);
      const start = (page - 1) * pageSize;
      const rows = sorted.slice(start, start + pageSize);
      const total = sorted.length;

      setCaseCount(total);
      setCaseLookup((prev) => {
        const next = { ...prev };
        rows.forEach((row) => {
          next[row.caseId] = row;
        });
        return next;
      });

      return { data: rows, total };
    } catch {
      setListError("Could not load cases. Check the API connection.");
      return { data: [], total: 0 };
    }
  }, [toCaseRow]);

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
    setReloadToken((prev) => prev + 1);
  }, []);

  const refreshTable = useCallback(() => {
    setListError(null);
    setReloadToken((prev) => prev + 1);
  }, []);

  const handleTableStateChange = useCallback((nextState) => {
    setTableState((prev) => {
      const nextFilters = nextState?.filters || {};
      const nextPageSize = Number(nextState?.pageSize) || prev.pageSize || 5;

      if (
        prev.pageSize === nextPageSize &&
        JSON.stringify(prev.filters || {}) === JSON.stringify(nextFilters)
      ) {
        return prev;
      }

      return {
        filters: nextFilters,
        pageSize: nextPageSize,
      };
    });
  }, []);

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
    return selectedCaseIds
      .map((caseId) => caseLookup[caseId] ?? { caseId, creationDate: "Creation date unavailable" });
  }, [caseLookup, selectedCaseIds]);

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
        <StageFlowPanelDemo
          mode="create"
          onSaved={refreshTable}
          testGenerationEditorMode={testGenerationEditorMode}
        />
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
          testGenerationEditorMode={testGenerationEditorMode}
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
          onSaved={refreshTable}
          testGenerationEditorMode={testGenerationEditorMode}
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

      <>
        <div className="cm__toolbar">
          <span className="cm__count">
            {caseCount} case{caseCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            className="cm__refresh-btn"
            onClick={refreshTable}
            title="Refresh list"
          >
            ↺ Refresh
          </button>
        </div>

        <DataTable
          columns={columns}
          serverSide
          service={caseTableService}
          reloadToken={reloadToken}
          pageSize={tableState.pageSize}
          initialFilters={tableState.filters}
          pageSizeOptions={[5, 10, 25, 50]}
          sortableColumns={["caseId", "status", "creationDate"]}
          searchableColumns={["caseId", "status", "creationDate"]}
          paginationPlacement="top"
          onStateChange={handleTableStateChange}
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
    </div>
  );
}
