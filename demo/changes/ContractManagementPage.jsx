import { useCallback, useEffect, useState } from "react";
import DataTable from "../DataTable/DataTable";
import InlineFullscreenPanel from "../shared/InlineFullscreenPanel";
import {
  approveContract,
  downloadContract,
  fetchContractAudit,
  rejectContract,
  searchContracts,
  submitContractForReview,
  updateContract,
} from "../../services/contractManagementService";
import "./ContractManagementPage.css";

const STATUS_CLASS_MAP = {
  draft: "contract-page__status contract-page__status--draft",
  "in review": "contract-page__status contract-page__status--review",
  approved: "contract-page__status contract-page__status--approved",
  completed: "contract-page__status contract-page__status--approved",
  rejected: "contract-page__status contract-page__status--rejected",
};

function normalizeStatus(status) {
  if (status === "Approved") return "Completed";
  return status;
}

function renderStatus(value) {
  const text = normalizeStatus(value) || "Unknown";
  const className = STATUS_CLASS_MAP[String(text).toLowerCase()] || "contract-page__status contract-page__status--neutral";
  return <span className={className}>{text}</span>;
}

function renderDocName(value) {
  return <span className="contract-page__doc-name">{value || "-"}</span>;
}

function renderDocLink(value) {
  if (!value) return <span className="contract-page__text-muted">-</span>;
  return (
    <a className="contract-page__doc-link" href={value} target="_blank" rel="noreferrer">
      Open Link
    </a>
  );
}

const COLUMNS = [
  { key: "documentName", label: "Document Name", render: renderDocName },
  { key: "documentLink", label: "Document Link", render: renderDocLink },
  { key: "clientIdentifier", label: "Client Identifier" },
  { key: "cdokType", label: "CDOK Type" },
  { key: "status", label: "Status", render: renderStatus },
  { key: "editedBy", label: "Edited By" },
];

const SORTABLE_COLUMNS = COLUMNS.map((c) => c.key);
const SEARCHABLE_COLUMNS = COLUMNS.map((c) => c.key);

function getActions(status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === "Draft") {
    return ["edit", "view", "download", "audit"];
  }
  if (normalizedStatus === "In review") {
    return ["view", "approve", "reject", "download", "audit"];
  }
  if (normalizedStatus === "Completed") {
    return ["view", "download", "audit"];
  }
  return ["view", "download", "audit"];
}

function emptyGoverningLaw() {
  return {
    applicable: "",
    accuracy: "",
    snippet: "",
    page: "",
    country: "",
  };
}

function emptyJurisdiction() {
  return {
    applicable: "",
    accuracy: "",
    snippet: "",
    page: "",
    risk: "",
    reasoning: "",
  };
}

function normalizeGoverningLaw(item) {
  if (!item || typeof item !== "object") {
    return emptyGoverningLaw();
  }
  return {
    applicable: item.applicable || "",
    accuracy: item.accuracy || "",
    snippet: item.snippet || "",
    page: item.page || "",
    country: item.country || "",
  };
}

function normalizeJurisdiction(item) {
  if (!item || typeof item !== "object") {
    return emptyJurisdiction();
  }
  return {
    applicable: item.applicable || "",
    accuracy: item.accuracy || "",
    snippet: item.snippet || "",
    page: item.page || "",
    risk: item.risk || "",
    reasoning: item.reasoning || "",
  };
}

export default function ContractManagementPage() {
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditActorFilter, setAuditActorFilter] = useState("");

  const [enableRemotePaging, setEnableRemotePaging] = useState(true);
  const [enableRemoteSorting, setEnableRemoteSorting] = useState(true);
  const [enableRemoteFiltering, setEnableRemoteFiltering] = useState(true);
  const [statusTransitionEnabled, setStatusTransitionEnabled] = useState(true);
  const [auditingEnabled, setAuditingEnabled] = useState(true);

  const [panelMode, setPanelMode] = useState("");
  const [activeRecord, setActiveRecord] = useState(null);
  const [auditItems, setAuditItems] = useState([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [downloadOpenId, setDownloadOpenId] = useState("");
  const [decisionMenu, setDecisionMenu] = useState({
    rowId: "",
    action: "",
    comment: "",
    error: "",
    submitting: false,
  });

  useEffect(() => {
    if (!downloadOpenId && !decisionMenu.rowId) return;

    const handleDocumentMouseDown = (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest(".contract-page__download-menu") || target.closest(".contract-page__decision-menu"))
      ) {
        return;
      }
      setDownloadOpenId("");
      setDecisionMenu({ rowId: "", action: "", comment: "", error: "", submitting: false });
    };

    const handleDocumentKeyDown = (event) => {
      if (event.key === "Escape") {
        setDownloadOpenId("");
        setDecisionMenu({ rowId: "", action: "", comment: "", error: "", submitting: false });
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [downloadOpenId, decisionMenu.rowId]);

  // DataTable service: adapts DataTable result shape to { data, total }
  const contractTableService = useCallback(async (params) => {
    const result = await searchContracts(params);
    return {
      data: Array.isArray(result.content)
        ? result.content.map((row) => ({
            ...row,
            status: normalizeStatus(row.status),
          }))
        : [],
      total: result.totalElements ?? 0,
    };
  }, []);

  // Adapter: translates DataTable base params to backend query shape and injects toggle flags.
  // When toggle state changes this callback is recreated, causing DataTable to re-fetch.
  const buildServerQuery = useCallback(
    ({ page, pageSize, sort, filters }) => ({
      page: page - 1, // DataTable is 1-based; backend is 0-based
      size: pageSize,
      sortBy: sort?.[0]?.key || "documentName",
      sortDirection: sort?.[0]?.dir || "asc",
      filters,
      enableRemotePaging,
      enableRemoteSorting,
      enableRemoteFiltering,
    }),
    [enableRemotePaging, enableRemoteSorting, enableRemoteFiltering]
  );

  const openPanel = (mode, row) => {
    const legacyContainer = row.governingLawJurisdictionRows;
    const legacyRows = Array.isArray(legacyContainer) ? legacyContainer : [];
    const legacyGoverningRows =
      legacyContainer && !Array.isArray(legacyContainer) && Array.isArray(legacyContainer.governingLawRows)
        ? legacyContainer.governingLawRows
        : legacyRows.map((item) => item?.governingLaw);
    const legacyJurisdictionRows =
      legacyContainer && !Array.isArray(legacyContainer) && Array.isArray(legacyContainer.jurisdictionRows)
        ? legacyContainer.jurisdictionRows
        : legacyRows.map((item) => item?.jurisdiction);

    const next = {
      ...row,
      governingLawRows: Array.isArray(row.governingLawRows) && row.governingLawRows.length
        ? row.governingLawRows.map((item) => normalizeGoverningLaw(item))
        : legacyGoverningRows.length
          ? legacyGoverningRows.map((item) => normalizeGoverningLaw(item))
          : [emptyGoverningLaw()],
      jurisdictionRows: Array.isArray(row.jurisdictionRows) && row.jurisdictionRows.length
        ? row.jurisdictionRows.map((item) => normalizeJurisdiction(item))
        : legacyJurisdictionRows.length
          ? legacyJurisdictionRows.map((item) => normalizeJurisdiction(item))
          : [emptyJurisdiction()],
    };

    setActiveRecord(next);
    setPanelMode(mode);
  };

  const closePanel = () => {
    setActiveRecord(null);
    setAuditItems([]);
    setSaveConfirmOpen(false);
    setPanelMode("");
  };

  const updateActiveField = (key, value) => {
    setActiveRecord((prev) => ({ ...prev, [key]: value }));
  };

  const updateGoverningLawRow = (index, field, value) => {
    setActiveRecord((prev) => {
      const nextRows = [...(prev.governingLawRows || [])];
      const current = normalizeGoverningLaw(nextRows[index]);
      nextRows[index] = { ...current, [field]: value };
      return { ...prev, governingLawRows: nextRows };
    });
  };

  const updateJurisdictionRow = (index, field, value) => {
    setActiveRecord((prev) => {
      const nextRows = [...(prev.jurisdictionRows || [])];
      const current = normalizeJurisdiction(nextRows[index]);
      nextRows[index] = { ...current, [field]: value };
      return { ...prev, jurisdictionRows: nextRows };
    });
  };

  const addGoverningLawRow = () => {
    setActiveRecord((prev) => ({
      ...prev,
      governingLawRows: [...(prev.governingLawRows || []), emptyGoverningLaw()],
    }));
  };

  const addJurisdictionRow = () => {
    setActiveRecord((prev) => ({
      ...prev,
      jurisdictionRows: [...(prev.jurisdictionRows || []), emptyJurisdiction()],
    }));
  };

  const removeGoverningLawRow = (index) => {
    setActiveRecord((prev) => {
      const current = [...(prev.governingLawRows || [])];
      current.splice(index, 1);
      return {
        ...prev,
        governingLawRows: current.length ? current : [emptyGoverningLaw()],
      };
    });
  };

  const removeJurisdictionRow = (index) => {
    setActiveRecord((prev) => {
      const current = [...(prev.jurisdictionRows || [])];
      current.splice(index, 1);
      return {
        ...prev,
        jurisdictionRows: current.length ? current : [emptyJurisdiction()],
      };
    });
  };

  const persistSave = async (confirmSendForReview) => {
    if (!activeRecord) return;
    setError("");
    setSaveInProgress(true);
    try {
      await updateContract(activeRecord.id, activeRecord, {
        statusTransitionEnabled,
        auditingEnabled,
      });

      if (statusTransitionEnabled) {
        await submitContractForReview(activeRecord.id, {
          confirm: confirmSendForReview,
          statusTransitionEnabled,
          auditingEnabled,
          actor: activeRecord.editedBy || "ui-user",
        });
      }

      closePanel();
      setReloadToken((t) => t + 1);
    } catch (saveError) {
      setError(saveError?.response?.data?.message || saveError.message || "Failed to save record");
    } finally {
      setSaveInProgress(false);
    }
  };

  const onSaveClick = async () => {
    if (!activeRecord || saveInProgress) return;
    if (!statusTransitionEnabled) {
      await persistSave(false);
      return;
    }
    setSaveConfirmOpen(true);
  };

  const onConfirmSave = async (confirmSendForReview) => {
    setSaveConfirmOpen(false);
    await persistSave(confirmSendForReview);
  };

  const onApprove = async (row, comment) => {
    setError("");
    try {
      await approveContract(row.id, { statusTransitionEnabled, auditingEnabled, comment });
      setReloadToken((t) => t + 1);
      return true;
    } catch (approveError) {
      setError(approveError?.response?.data?.message || approveError.message || "Approve failed");
      return false;
    }
  };

  const onReject = async (row, comment) => {
    setError("");
    try {
      await rejectContract(row.id, { statusTransitionEnabled, auditingEnabled, comment });
      setReloadToken((t) => t + 1);
      return true;
    } catch (rejectError) {
      setError(rejectError?.response?.data?.message || rejectError.message || "Reject failed");
      return false;
    }
  };

  const openDecisionMenu = (row, action) => {
    setDownloadOpenId("");
    setDecisionMenu({
      rowId: row.id,
      action,
      comment: "",
      error: "",
      submitting: false,
    });
  };

  const closeDecisionMenu = () => {
    setDecisionMenu({ rowId: "", action: "", comment: "", error: "", submitting: false });
  };

  const handleDecisionCommentChange = (value) => {
    setDecisionMenu((prev) => ({ ...prev, comment: value, error: "" }));
  };

  const submitDecision = async (row) => {
    const comment = decisionMenu.comment.trim();
    if (!comment) {
      setDecisionMenu((prev) => ({ ...prev, error: "Comment is mandatory." }));
      return;
    }

    setDecisionMenu((prev) => ({ ...prev, submitting: true, error: "" }));
    const success =
      decisionMenu.action === "approve"
        ? await onApprove(row, comment)
        : await onReject(row, comment);

    if (success) {
      closeDecisionMenu();
      return;
    }

    setDecisionMenu((prev) => ({ ...prev, submitting: false }));
  };

  const onAudit = async (row) => {
    setError("");
    try {
      const audit = await fetchContractAudit(row.id);
      setAuditItems(audit || []);
      setAuditPage(1);
      setAuditActionFilter("all");
      setAuditActorFilter("");
      setActiveRecord(row);
      setPanelMode("audit");
    } catch (auditError) {
      setError(auditError?.response?.data?.message || auditError.message || "Failed to fetch audit");
    }
  };

  const onDownload = async (row, format) => {
    try {
      await downloadContract(row.id, format);
      setDownloadOpenId("");
    } catch (downloadError) {
      setError(downloadError?.response?.data?.message || downloadError.message || "Download failed");
    }
  };

  // Row actions renderer for DataTable — status-driven, with download submenu
  const renderRowActions = useCallback(
    ({ row }) => {
      const actions = getActions(row.status);
      const decisionOpenForRow = decisionMenu.rowId === row.id;

      const decisionMenuNode = (
        <div className="contract-page__decision-menu">
          <p className="contract-page__decision-title">
            {decisionMenu.action === "approve" ? "Approve" : "Reject"} Comment *
          </p>
          <textarea
            className="contract-page__decision-textarea"
            value={decisionMenu.comment}
            onChange={(e) => handleDecisionCommentChange(e.target.value)}
            placeholder="Enter mandatory comment"
            rows={3}
            disabled={decisionMenu.submitting}
          />
          {decisionMenu.error && <span className="contract-page__decision-error">{decisionMenu.error}</span>}
          <div className="contract-page__decision-actions">
            <button
              type="button"
              className="contract-page__action-btn"
              onClick={closeDecisionMenu}
              disabled={decisionMenu.submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`contract-page__action-btn ${decisionMenu.action === "approve" ? "contract-page__action-btn--success" : "contract-page__action-btn--danger"}`}
              onClick={() => submitDecision(row)}
              disabled={decisionMenu.submitting}
            >
              {decisionMenu.submitting
                ? (decisionMenu.action === "approve" ? "Approving..." : "Rejecting...")
                : (decisionMenu.action === "approve" ? "Confirm Approve" : "Confirm Reject")}
            </button>
          </div>
        </div>
      );

      return (
        <div className="contract-page__actions">
          {actions.includes("edit") && (
            <button type="button" className="contract-page__action-btn contract-page__action-btn--primary" onClick={() => openPanel("edit", row)}>Edit</button>
          )}
          {actions.includes("view") && (
            <button type="button" className="contract-page__action-btn" onClick={() => openPanel("view", row)}>View</button>
          )}
          {actions.includes("approve") && (
            <div className="contract-page__decision-anchor">
              <button
                type="button"
                className="contract-page__action-btn contract-page__action-btn--success"
                onClick={() => openDecisionMenu(row, "approve")}
              >
                Approve
              </button>
              {decisionOpenForRow && decisionMenu.action === "approve" ? decisionMenuNode : null}
            </div>
          )}
          {actions.includes("reject") && (
            <div className="contract-page__decision-anchor">
              <button
                type="button"
                className="contract-page__action-btn contract-page__action-btn--danger"
                onClick={() => openDecisionMenu(row, "reject")}
              >
                Reject
              </button>
              {decisionOpenForRow && decisionMenu.action === "reject" ? decisionMenuNode : null}
            </div>
          )}
          {actions.includes("audit") && auditingEnabled && (
            <button type="button" className="contract-page__action-btn" onClick={() => onAudit(row)}>Audit Detail</button>
          )}
          {actions.includes("download") && (
            <div className="contract-page__download-menu">
              <button
                type="button"
                className="contract-page__action-btn"
                onClick={() => setDownloadOpenId((prev) => (prev === row.id ? "" : row.id))}
              >
                Download
              </button>
              {downloadOpenId === row.id && (
                <div className="contract-page__download-options">
                  <button type="button" className="contract-page__download-option" onClick={() => onDownload(row, "excel")}>Excel</button>
                  <button type="button" className="contract-page__download-option" onClick={() => onDownload(row, "csv")}>CSV</button>
                  <button type="button" className="contract-page__download-option" onClick={() => onDownload(row, "pdf")}>PDF</button>
                </div>
              )}
            </div>
          )}

        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [downloadOpenId, auditingEnabled, decisionMenu]
  );

  const panelOpen = Boolean(activeRecord && panelMode);
  const panelTitle = panelMode === "audit" ? "Audit Timeline" : panelMode === "edit" ? "Edit Contract" : "View Contract";

  const auditActionMeta = {
    CREATE:   { label: "Created",   colorClass: "audit-action--create",  icon: "✦" },
    EDIT:     { label: "Edited",    colorClass: "audit-action--edit",    icon: "✎" },
    UPDATE:   { label: "Updated",   colorClass: "audit-action--edit",    icon: "✎" },
    SUBMIT:   { label: "Submitted", colorClass: "audit-action--submit",  icon: "➤" },
    APPROVE:  { label: "Approved",  colorClass: "audit-action--approve", icon: "✔" },
    REJECT:   { label: "Rejected",  colorClass: "audit-action--reject",  icon: "✖" },
    VIEW:     { label: "Viewed",    colorClass: "audit-action--view",    icon: "◉" },
    DOWNLOAD: { label: "Downloaded",colorClass: "audit-action--view",    icon: "⬇" },
  };

  function getAuditMeta(action = "") {
    return auditActionMeta[action.toUpperCase()] || { label: action, colorClass: "audit-action--default", icon: "•" };
  }

  function formatAuditTimestamp(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return ts; }
  }

  function getInitials(name = "") {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
  }

  const auditItemsDesc = [...auditItems].reverse();
  const filteredAuditItems = auditItemsDesc.filter((item) => {
    const matchesAction =
      auditActionFilter === "all" ||
      String(item.action || "").toUpperCase() === auditActionFilter;
    const actorValue = String(item.performedBy || "").toLowerCase();
    const matchesActor = !auditActorFilter.trim() || actorValue.includes(auditActorFilter.trim().toLowerCase());
    return matchesAction && matchesActor;
  });
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditItems.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, auditTotalPages);
  const auditStart = (safeAuditPage - 1) * auditPageSize;
  const pagedAuditItems = filteredAuditItems.slice(auditStart, auditStart + auditPageSize);
  const auditActions = Array.from(
    new Set(
      auditItems
        .map((item) => String(item.action || "").toUpperCase())
        .filter(Boolean)
    )
  );

  useEffect(() => {
    if (auditPage > auditTotalPages) {
      setAuditPage(auditTotalPages);
    }
  }, [auditPage, auditTotalPages]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditActorFilter]);

  const panelBody = panelMode === "audit" ? (
    <div className="contract-page__audit">
      {/* Summary strip */}
      <div className="contract-page__audit-summary">
        <span className="contract-page__audit-summary-item">
          <span className="contract-page__audit-summary-val">{auditItems.length}</span>
          <span className="contract-page__audit-summary-lbl">Events</span>
        </span>
        {auditItems.length > 0 && (
          <>
            <span className="contract-page__audit-summary-divider" />
            <span className="contract-page__audit-summary-item">
              <span className="contract-page__audit-summary-val">{getAuditMeta(auditItemsDesc[0]?.action).label}</span>
              <span className="contract-page__audit-summary-lbl">Latest Action</span>
            </span>
            <span className="contract-page__audit-summary-divider" />
            <span className="contract-page__audit-summary-item">
              <span className="contract-page__audit-summary-val">{formatAuditTimestamp(auditItemsDesc[0]?.timestamp)}</span>
              <span className="contract-page__audit-summary-lbl">Last Updated</span>
            </span>
          </>
        )}
      </div>

      {/* Empty state */}
      {!auditItems.length ? (
        <div className="contract-page__audit-empty">
          <span className="contract-page__audit-empty-icon">⟳</span>
          <p>No audit records found for this contract.</p>
        </div>
      ) : null}

      {/* Timeline */}
      {auditItems.length > 0 && (
        <div className="contract-page__audit-pagination">
          <div className="contract-page__audit-toolbar-left">
            <label htmlFor="audit-action-filter" className="contract-page__audit-filter-label">Action</label>
            <select
              id="audit-action-filter"
              className="contract-page__audit-filter-select"
              value={auditActionFilter}
              onChange={(event) => setAuditActionFilter(event.target.value)}
            >
              <option value="all">All</option>
              {auditActions.map((action) => (
                <option key={action} value={action}>
                  {getAuditMeta(action).label}
                </option>
              ))}
            </select>

            <label htmlFor="audit-actor-filter" className="contract-page__audit-filter-label">By</label>
            <input
              id="audit-actor-filter"
              className="contract-page__audit-filter-input"
              type="text"
              value={auditActorFilter}
              placeholder="Name"
              onChange={(event) => setAuditActorFilter(event.target.value)}
            />
          </div>

          <div className="contract-page__audit-pagination-controls">
            <label htmlFor="audit-page-size" className="contract-page__audit-page-size-label">Rows</label>
            <select
              id="audit-page-size"
              className="contract-page__audit-page-size"
              value={auditPageSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value) || 10;
                setAuditPageSize(nextSize);
                setAuditPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              type="button"
              className="contract-page__audit-page-btn"
              onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
              disabled={safeAuditPage <= 1}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="contract-page__audit-page-index">{safeAuditPage}/{auditTotalPages}</span>
            <button
              type="button"
              className="contract-page__audit-page-btn"
              onClick={() => setAuditPage((prev) => Math.min(auditTotalPages, prev + 1))}
              disabled={safeAuditPage >= auditTotalPages}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {auditItems.length > 0 && (
        <ol className="contract-page__audit-timeline">
          {filteredAuditItems.length === 0 && (
            <li className="contract-page__audit-filter-empty">No audit events match the selected filter.</li>
          )}
          {pagedAuditItems.map((item, index) => {
            const meta = getAuditMeta(item.action);
            const initials = getInitials(item.performedBy);
            const isLatest = safeAuditPage === 1 && index === 0;
            const sequence = filteredAuditItems.length - (auditStart + index);
            return (
              <li key={`${item.timestamp}-${auditStart + index}`} className={`contract-page__audit-event${isLatest ? " contract-page__audit-event--latest" : ""}`}>
                {/* Connector */}
                <div className="contract-page__audit-connector">
                  <div className={`contract-page__audit-dot ${meta.colorClass}`}>{meta.icon}</div>
                  {index < pagedAuditItems.length - 1 && <div className="contract-page__audit-line" />}
                </div>
                {/* Card */}
                <div className={`contract-page__audit-card ${meta.colorClass}`}>
                  <div className="contract-page__audit-card-header">
                    <div className="contract-page__audit-card-left">
                      <span className={`contract-page__audit-badge ${meta.colorClass}`}>{meta.label}</span>
                      {isLatest && <span className="contract-page__audit-latest-tag">Latest</span>}
                    </div>
                    <time className="contract-page__audit-time" dateTime={item.timestamp}>
                      {formatAuditTimestamp(item.timestamp)}
                    </time>
                  </div>
                  <div className="contract-page__audit-card-body">
                    {item.detail && <p className="contract-page__audit-detail">{item.detail}</p>}
                    {item.comment && (
                      <blockquote className="contract-page__audit-comment">
                        <span className="contract-page__audit-comment-icon">💬</span>
                        {item.comment}
                      </blockquote>
                    )}
                  </div>
                  <div className="contract-page__audit-card-footer">
                    <span className="contract-page__audit-avatar" title={item.performedBy}>{initials || "?"}</span>
                    <span className="contract-page__audit-by">{item.performedBy || "Unknown"}</span>
                    <span className="contract-page__audit-seq">#{sequence}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  ) : activeRecord ? (
    <div className={`contract-page__form ${panelMode === "view" ? "contract-page__form--view" : "contract-page__form--edit"}`}>
      <div className="contract-page__form-grid">
        <label className="contract-page__field">
          Document Name
          <input
            value={activeRecord.documentName || ""}
            onChange={(event) => updateActiveField("documentName", event.target.value)}
            disabled={panelMode === "view"}
          />
        </label>
        <label className="contract-page__field">
          Document Link
          <input
            value={activeRecord.documentLink || ""}
            onChange={(event) => updateActiveField("documentLink", event.target.value)}
            disabled={panelMode === "view"}
          />
        </label>
        <label className="contract-page__field">
          Client Identifier
          <input
            value={activeRecord.clientIdentifier || ""}
            onChange={(event) => updateActiveField("clientIdentifier", event.target.value)}
            disabled={panelMode === "view"}
          />
        </label>
        <label className="contract-page__field">
          CDOK Type
          <input
            value={activeRecord.cdokType || ""}
            onChange={(event) => updateActiveField("cdokType", event.target.value)}
            disabled={panelMode === "view"}
          />
        </label>
        <label className="contract-page__field">
          Edited By
          <input
            value={activeRecord.editedBy || ""}
            onChange={(event) => updateActiveField("editedBy", event.target.value)}
            disabled={panelMode === "view"}
          />
        </label>
      </div>

      <div className="contract-page__rules-head">
        <h3>Governing Law and Jurisdiction</h3>
      </div>

      <div className="contract-page__rules-sections">
        <section className="contract-page__rules-section">
          <div className="contract-page__rules-subhead">
            <h4>Governing Law</h4>
            {panelMode === "edit" ? (
              <button type="button" className="contract-page__mini-btn" onClick={addGoverningLawRow}>Add Governing Law Row</button>
            ) : null}
          </div>
          <div className="contract-page__rules-table-wrap">
            <table className="contract-page__rules-table contract-page__rules-table--governing">
              <thead>
                <tr>
                  <th>Applicable</th>
                  <th>Accuracy</th>
                  <th>Snippet</th>
                  <th>Page</th>
                  <th>Country</th>
                  {panelMode === "edit" ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {(activeRecord.governingLawRows || []).map((rawRow, index) => {
                  const row = normalizeGoverningLaw(rawRow);
                  return (
                    <tr key={`gl-${index}`}>
                      <td>
                        <input
                          value={row.applicable}
                          onChange={(event) => updateGoverningLawRow(index, "applicable", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.accuracy}
                          onChange={(event) => updateGoverningLawRow(index, "accuracy", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.snippet}
                          onChange={(event) => updateGoverningLawRow(index, "snippet", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.page}
                          onChange={(event) => updateGoverningLawRow(index, "page", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.country}
                          onChange={(event) => updateGoverningLawRow(index, "country", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      {panelMode === "edit" ? (
                        <td>
                          <button type="button" className="contract-page__mini-btn contract-page__mini-btn--danger" onClick={() => removeGoverningLawRow(index)}>Remove</button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="contract-page__rules-section">
          <div className="contract-page__rules-subhead">
            <h4>Jurisdiction</h4>
            {panelMode === "edit" ? (
              <button type="button" className="contract-page__mini-btn" onClick={addJurisdictionRow}>Add Jurisdiction Row</button>
            ) : null}
          </div>
          <div className="contract-page__rules-table-wrap">
            <table className="contract-page__rules-table contract-page__rules-table--jurisdiction">
              <thead>
                <tr>
                  <th>Applicable</th>
                  <th>Accuracy</th>
                  <th>Snippet</th>
                  <th>Page</th>
                  <th>Risk</th>
                  <th>Reasoning</th>
                  {panelMode === "edit" ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {(activeRecord.jurisdictionRows || []).map((rawRow, index) => {
                  const row = normalizeJurisdiction(rawRow);
                  return (
                    <tr key={`jur-${index}`}>
                      <td>
                        <input
                          value={row.applicable}
                          onChange={(event) => updateJurisdictionRow(index, "applicable", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.accuracy}
                          onChange={(event) => updateJurisdictionRow(index, "accuracy", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.snippet}
                          onChange={(event) => updateJurisdictionRow(index, "snippet", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.page}
                          onChange={(event) => updateJurisdictionRow(index, "page", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.risk}
                          onChange={(event) => updateJurisdictionRow(index, "risk", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.reasoning}
                          onChange={(event) => updateJurisdictionRow(index, "reasoning", event.target.value)}
                          disabled={panelMode === "view"}
                        />
                      </td>
                      {panelMode === "edit" ? (
                        <td>
                          <button type="button" className="contract-page__mini-btn contract-page__mini-btn--danger" onClick={() => removeJurisdictionRow(index)}>Remove</button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {panelMode === "edit" ? (
        <div className="contract-page__form-actions">
          <button type="button" onClick={closePanel} disabled={saveInProgress}>Cancel</button>
          <button type="button" onClick={onSaveClick} disabled={saveInProgress}>
            {saveInProgress ? "Saving..." : "Save"}
          </button>
        </div>
      ) : null}

      {panelMode === "edit" && saveConfirmOpen ? (
        <div className="contract-page__confirm-backdrop" role="dialog" aria-modal="true" aria-label="Save contract confirmation">
          <div className="contract-page__confirm-card">
            <h4>Confirm Save Action</h4>
            <p>
              Do you want to submit this contract for review now?
              You can also save the updates without sending it for review.
            </p>
            <div className="contract-page__confirm-actions">
              <button type="button" onClick={() => setSaveConfirmOpen(false)}>
                Continue Editing
              </button>
              <button type="button" onClick={() => onConfirmSave(false)}>
                Save Only
              </button>
              <button type="button" className="contract-page__confirm-primary" onClick={() => onConfirmSave(true)}>
                Save and Send for Review
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  if (panelOpen) {
    return (
      <section className="contract-page">
        <InlineFullscreenPanel
          isOpen={panelOpen}
          title={panelTitle}
          onBack={closePanel}
          enableFullscreenToggle
        >
          {panelBody}
        </InlineFullscreenPanel>
      </section>
    );
  }

  return (
    <section className="contract-page">
      <header className="contract-page__header">
        <div>
          <h1>Contract Management</h1>
          <p>Remote paging, sorting, filtering with workflow and audit controls.</p>
        </div>
      </header>



      {error ? <div className="contract-page__error">{error}</div> : null}
      <div className="contract-page__table-shell">
        <DataTable
          columns={COLUMNS}
          serverSide
          service={contractTableService}
          buildServerQuery={buildServerQuery}
          reloadToken={reloadToken}
          sortableColumns={SORTABLE_COLUMNS}
          searchableColumns={SEARCHABLE_COLUMNS}
          filterMode="manual"
          manualFilterDelayMs={650}
          pageSize={8}
          pageSizeOptions={[5, 8, 15, 25, 50]}
          toolbarExtra={
            <button type="button" className="dt__btn" onClick={() => setReloadToken((t) => t + 1)}>
              Refresh
            </button>
          }
          renderRowActions={renderRowActions}
          rowActionsColumnLabel="Action"
          rowActionsColumnWidth="200px"
        />
      </div>

    </section>
  );
}
