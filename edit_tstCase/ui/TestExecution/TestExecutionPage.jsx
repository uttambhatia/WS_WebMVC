import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import DataTable from "../DataTable/DataTable";
import InlineFullscreenPanel from "../shared/InlineFullscreenPanel";
import MultiSelectDropdown from "../shared/MultiSelectDropdown";
import {
  downloadExecutionReport,
  executeTests,
  fetchExecutions,
  saveTestSchedule,
  fetchTestScripts,
  getTestExecutionStatus,
  searchFrequencies,
  searchTimezones,
  saveExecution,
} from "../../services/testExecutionService";
import "./TestExecutionPage.css";

const LIVE_STATUSES = new Set(["pending", "running"]);
const FINAL_STATUSES = new Set(["completed", "failed", "error"]);
const EXECUTION_RESULTS_PANEL_HEIGHT = 420;
const EXECUTION_STATS_COLORS = {
  passed: "#2f8f43",
  failed: "#b53746",
  skipped: "#d7a445",
  errors: "#5e6f82",
};

function FolderIcon({ open = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
        </>
      ) : (
        <>
          <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
        </>
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M10 13h6" />
      <path d="M10 17h6" />
    </svg>
  );
}

function normalizeStatus(status) {
  return String(status || "unknown").toLowerCase();
}

function statusClass(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "completed") return "te__status te__status--completed";
  if (normalized === "failed") return "te__status te__status--failed";
  if (normalized === "error") return "te__status te__status--error";
  if (normalized === "running") return "te__status te__status--running";
  if (normalized === "pending") return "te__status te__status--pending";
  return "te__status te__status--unknown";
}

function formatStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatScheduleDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function computeDurationSeconds(startedAt, finishedAt, fallbackSeconds) {
  if (typeof fallbackSeconds === "number" && Number.isFinite(fallbackSeconds)) {
    return Math.max(0, fallbackSeconds);
  }

  const startDate = parseDate(startedAt);
  const endDate = parseDate(finishedAt);
  if (!startDate || !endDate) return null;

  const diff = (endDate.getTime() - startDate.getTime()) / 1000;
  return diff >= 0 ? diff : null;
}

function formatDuration(seconds) {
  if (seconds == null) return "-";
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function normalizeSelectedScripts(raw) {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter(Boolean).map(String);
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function safeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function parseReportString(reportText) {
  if (typeof reportText !== "string" || !reportText.trim()) {
    return null;
  }

  const trimmed = reportText.trim();
  const asJsonLike = trimmed.replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3');
  const candidates = [trimmed, asJsonLike];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore malformed report payload and continue with next candidate.
    }
  }

  return null;
}

function normalizeExecutionReport(rawReport) {
  if (rawReport == null) {
    return null;
  }

  let source = rawReport;
  if (typeof rawReport === "string") {
    source = parseReportString(rawReport);
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  return {
    passed: safeNumber(source.passed),
    failed: safeNumber(source.failed),
    skipped: safeNumber(source.skipped),
    errors: safeNumber(source.errors),
    results: normalizeExecutionResults(source.results || source.result || source.items || source.data),
  };
}

function buildExecutionStats(report) {
  const normalized = normalizeExecutionReport(report);
  return [
    { key: "passed", label: "Passed", value: normalized?.passed ?? 0, color: EXECUTION_STATS_COLORS.passed },
    { key: "failed", label: "Failed", value: normalized?.failed ?? 0, color: EXECUTION_STATS_COLORS.failed },
    { key: "skipped", label: "Skipped", value: normalized?.skipped ?? 0, color: EXECUTION_STATS_COLORS.skipped },
    { key: "errors", label: "Errors", value: normalized?.errors ?? 0, color: EXECUTION_STATS_COLORS.errors },
  ];
}

function normalizeExecution(row) {
  // Extract scripts from execution_items if available
  let executionItemScripts = [];
  if (Array.isArray(row?.execution_items) && row.execution_items.length > 0) {
    executionItemScripts = row.execution_items
      .filter((item) => item?.execScript)
      .map((item) => item.execScript);
  }

  const selectedScripts = normalizeSelectedScripts(
    executionItemScripts.length > 0 
      ? executionItemScripts
      : (row?.script_paths || row?.selectedScripts || row?.scripts || row?.selected_tests || row?.script_path)
  );

  const startedAt = row?.started_at || row?.startedAt || null;
  const finishedAt = row?.finished_at || row?.finishedAt || null;
  const createdAt = row?.created_at || row?.createdAt || null;

  return {
    executionId: row?.execution_id || row?.executionId,
    scheduleId: row?.schedule_id || row?.scheduleId,
    testId: row?.test_id || row?.testId || "-",
    status: normalizeStatus(row?.status),
    createdAt,
    startedAt,
    finishedAt,
    durationSeconds: computeDurationSeconds(startedAt, finishedAt, row?.duration_seconds ?? row?.durationSeconds),
    reportPath: row?.report_path || row?.reportPath || "",
    stdout: row?.stdout ?? null,
    stderr: row?.stderr ?? null,
    returnCode: row?.return_code ?? row?.returnCode ?? null,
    errorMessage: row?.error_message || row?.errorMessage || null,
    passed: row?.passed ?? 0,
    failed: row?.failed ?? 0,
    error: row?.error ?? 0,
    skipped: row?.skipped ?? 0,
    total: row?.total ?? 0,
    report: normalizeExecutionReport(row?.report),
    results: normalizeExecutionResults(row?.results || row?.report?.results),
    executionItems: row?.execution_items || row?.executionItems || [],
    selectedScripts,
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function extractTotal(payload, fallbackLength) {
  if (typeof payload?.total === "number") return payload.total;
  if (typeof payload?.totalElements === "number") return payload.totalElements;
  if (typeof payload?.count === "number") return payload.count;
  return fallbackLength;
}

function normalizeExecutionResults(rawResults) {
  const rows = Array.isArray(rawResults) ? rawResults : [];

  return rows.map((row, index) => ({
    id: row?.test_case_id || row?.test_case_id || row?.testId || `row-${index}`,
    status: normalizeStatus(row?.status),
    testId: row?.test_case_id || row?.testId || "-",
    scriptName: row?.test_execution_script || row?.test_execution_script_path || row?.script_path || row?.scriptPath || "-",
    runDuration: computeDurationSeconds(null, null, row?.duration_seconds ?? row?.durationSeconds),
    errorMessage: row?.error_message || row?.errorMessage || "",
  }));
}

function formatExecutionResultsPayload(report) {
  if (!report || typeof report !== "object") {
    return [];
  }

  const rawResults = report.results || report.result || report.items || report.data;
  return normalizeExecutionResults(rawResults);
}

function ScriptNameCell({ value, limit = 20 }) {
  const text = value == null ? "" : String(value);
  const needsToggle = text.length > limit;
  const [expanded, setExpanded] = useState(false);

  if (!needsToggle) {
    return <span>{text || "-"}</span>;
  }

  const displayText = expanded ? text : `${text.slice(0, limit).trimEnd()}...`;

  return (
    <span className="te__script-name-cell">
      <span className="te__script-name-text">{displayText}</span>
      <button type="button" className="te__script-name-toggle" onClick={() => setExpanded((prev) => !prev)}>
        {expanded ? "less..." : "more..."}
      </button>
    </span>
  );
}

function ResultStatusCell({ status }) {
  const normalized = normalizeStatus(status);

  const visual = (() => {
    if (normalized === "failed") return { color: EXECUTION_STATS_COLORS.failed, key: "failed" };
    if (normalized === "error") return { color: EXECUTION_STATS_COLORS.errors, key: "error" };
    if (normalized === "skipped") return { color: EXECUTION_STATS_COLORS.skipped, key: "skipped" };
    if (normalized === "passed" || normalized === "completed") return { color: EXECUTION_STATS_COLORS.passed, key: "passed" };
    return { color: "#5e6f82", key: "default" };
  })();

  const renderIcon = () => {
    if (visual.key === "failed") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      );
    }

    if (visual.key === "passed") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    }

    if (visual.key === "error") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M4.929 4.929 19.07 19.071" />
        </svg>
      );
    }

    if (visual.key === "skipped") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    }

    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
      </svg>
    );
  };

  return (
    <span className="te__result-status-cell">
      <span className="te__result-status-icon" style={{ backgroundColor: visual.color }}>
        {renderIcon()}
      </span>
      <span>{formatStatus(status)}</span>
    </span>
  );
}

const TreeNode = memo(function TreeNode({ node, level, isExpanded, getIsExpanded, onToggleExpand, selectedSet, onToggleSelect, disabled }) {
  const isDirectory = node.type === "directory";

  const descendantFiles = useMemo(() => {
    if (!isDirectory) return [node.path];
    const files = [];
    const walk = (current) => {
      if (current.type === "file") {
        files.push(current.path);
        return;
      }
      current.children.forEach(walk);
    };
    walk(node);
    return files;
  }, [isDirectory, node]);

  const selectedCount = descendantFiles.reduce(
    (count, path) => (selectedSet.has(path) ? count + 1 : count),
    0
  );

  const checked = selectedCount > 0;
  const indeterminate = isDirectory && selectedCount > 0 && selectedCount < descendantFiles.length;

  return (
    <div className="te__tree-node">
      <div className="te__tree-node-row" style={{ paddingLeft: `${10 + level * 16}px` }}>
        {isDirectory ? (
          <button
            type="button"
            className="te__tree-expand"
            onClick={() => onToggleExpand(node.path)}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="te__tree-expand-placeholder" />
        )}

        <label className={`te__tree-label ${disabled ? "is-disabled" : ""}`}>
          <input
            type="checkbox"
            checked={checked}
            ref={(element) => {
              if (element) {
                element.indeterminate = indeterminate;
              }
            }}
            onChange={() => onToggleSelect(node, descendantFiles, checked)}
            disabled={disabled}
          />
          <span className={`te__tree-icon ${checked ? "is-selected" : ""} ${isDirectory && isExpanded ? "is-open" : ""}`.trim()} aria-hidden="true">
            {isDirectory ? <FolderIcon open={Boolean(isExpanded)} /> : <FileIcon />}
          </span>
          <span className="te__tree-text">{node.name}</span>
        </label>
      </div>

      {isDirectory && isExpanded && node.children?.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              isExpanded={getIsExpanded(child.path)}
              getIsExpanded={getIsExpanded}
              onToggleExpand={onToggleExpand}
              selectedSet={selectedSet}
              onToggleSelect={onToggleSelect}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function normalizeScriptNode(node, parentPath = "") {
  const name = node?.name || "";
  const type = node?.type === "directory" ? "directory" : "file";
  const candidatePath = node?.relative_path || node?.path || (parentPath ? `${parentPath}/${name}` : name);
  const path = String(candidatePath || "").replace(/^\/+/, "");

  if (type === "file") {
    return {
      type,
      name: name || path.split("/").pop() || "",
      path,
      children: [],
    };
  }

  const children = Array.isArray(node?.children)
    ? node.children.map((child) => normalizeScriptNode(child, path))
    : [];

  return {
    type,
    name: name || path.split("/").pop() || "",
    path,
    children,
  };
}

function normalizeScriptTree(payload) {
  if (Array.isArray(payload?.tree)) {
    return payload.tree.map((node) => normalizeScriptNode(node));
  }
  if (Array.isArray(payload)) {
    return payload.map((node) => normalizeScriptNode(node));
  }
  if (Array.isArray(payload?.data)) {
    return payload.data.map((node) => normalizeScriptNode(node));
  }
  return [];
}

function collectFilePaths(nodes) {
  const paths = [];
  const walk = (node) => {
    if (node.type === "file") {
      paths.push(node.path);
      return;
    }
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return paths;
}

function buildStatsConicGradient(stats) {
  const total = stats.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return "conic-gradient(#d5dde8 0deg, #d5dde8 360deg)";
  }

  let offset = 0;
  const segments = stats.map((item) => {
    const start = (offset / total) * 360;
    offset += item.value;
    const end = (offset / total) * 360;
    return `${item.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function TestExecutionPanel({
  mode,
  executionMode,
  onExecutionModeChange,
  selectedScripts,
  treeNodes,
  loadingTree,
  treeError,
  onRetryTree,
  onRun,
  running,
  execution,
  runError,
  scheduleDetails,
}) {
  const [expandedSet, setExpandedSet] = useState(new Set());
  const [selectedSet, setSelectedSet] = useState(() => new Set(selectedScripts || []));
  const [selectedStreams, setSelectedStreams] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [showMode, setShowMode] = useState("all");
  const [treeSearchText, setTreeSearchText] = useState("");
  const [resultsExpanded, setResultsExpanded] = useState(true);
  const [resultsPanelExpanded, setResultsPanelExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showStatsChart, setShowStatsChart] = useState(false);
  const [executionResults, setExecutionResults] = useState([]);
  const [resultsRefreshToken, setResultsRefreshToken] = useState(0);
  const [resultsPanelMaximized, setResultsPanelMaximized] = useState(false);
  const [resultsPanelBeforeMaximize, setResultsPanelBeforeMaximize] = useState(true);
  const [scheduleRunAt, setScheduleRunAt] = useState("");
  const [scheduleTimezoneQuery, setScheduleTimezoneQuery] = useState("");
  const [scheduleTimezoneOptions, setScheduleTimezoneOptions] = useState([]);
  const [selectedTimezone, setSelectedTimezone] = useState(null);
  const [scheduleRecurring, setScheduleRecurring] = useState(false);
  const [scheduleFrequencyQuery, setScheduleFrequencyQuery] = useState("");
  const [scheduleFrequencyOptions, setScheduleFrequencyOptions] = useState([]);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const statsPanelRef = useRef(null);
  const resultsDockRef = useRef(null);

  const scrollResultsDockIntoView = useCallback(() => {
    // Wait for React state updates + layout to settle before scrolling.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsDockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

  useEffect(() => {
    setSelectedSet(new Set(selectedScripts || []));
  }, [selectedScripts]);

  useEffect(() => {
    const nextResults = execution?.results?.length ? execution.results : formatExecutionResultsPayload(execution?.report);
    setExecutionResults(nextResults);
    if (nextResults.length > 0) {
      setResultsPanelExpanded(true);
    }
  }, [execution?.report, execution?.results]);

  useEffect(() => {
    if (mode !== "rerun") {
      return;
    }

    setExecutionResults([]);
    setResultsPanelExpanded(false);
    setResultsPanelMaximized(false);
    setResultsRefreshToken((prev) => prev + 1);
  }, [mode]);

  useEffect(() => {
    onExecutionModeChange("run");
    // Only clear schedule fields when not in view or rerun mode to preserve loaded values
    if (mode !== "view" && mode !== "rerun") {
      setScheduleRunAt("");
      setScheduleTimezoneQuery("");
      setSelectedTimezone(null);
      setScheduleRecurring(false);
      setScheduleFrequencyQuery("");
      setSelectedFrequency(null);
      setScheduleError("");
      setScheduleMessage("");
    }
  }, [mode, execution?.testId, onExecutionModeChange]);

  useEffect(() => {
    // Populate schedule form when viewing or rerunning execution with schedule details
    if ((mode === "view" || mode === "rerun") && scheduleDetails) {
      console.log('[Schedule] Populating form with scheduleDetails:', scheduleDetails, 'mode:', mode);
      console.log('[Schedule] Current executionMode:', executionMode);
      
      // Auto-switch to schedule tab if viewing an execution with schedule details
      // onExecutionModeChange("schedule");
      
      // Handle both camelCase and snake_case field names from backend
      const runAt = scheduleDetails.runAt || scheduleDetails.run_at;
      // Backend returns timezone_name, timezone_code for timezone field
      const timezone = scheduleDetails.timezone || scheduleDetails.timeZone || scheduleDetails.time_zone || scheduleDetails.timezone_name;
      const recurring = scheduleDetails.recurring !== undefined ? scheduleDetails.recurring : (scheduleDetails.is_recurring !== undefined ? scheduleDetails.is_recurring : false);
      // Backend returns frequency_name for frequency field
      const frequency = scheduleDetails.frequency || scheduleDetails.frequencyName || scheduleDetails.frequency_name;
      
      console.log('[Schedule] Extracted field values:');
      console.log('  - runAt:', runAt, '(type:', typeof runAt, ')');
      console.log('  - timezone:', timezone, '(type:', typeof timezone, ')');
      console.log('  - recurring:', recurring, '(type:', typeof recurring, ')');
      console.log('  - frequency:', frequency, '(type:', typeof frequency, ')');
      
      if (runAt) {
        try {
          // Convert ISO date to datetime-local format
          const date = new Date(runAt);
          const isoString = date.toISOString().slice(0, 16);
          console.log('[Schedule] Setting runAt input value to:', isoString);
          setScheduleRunAt(isoString);
        } catch (e) {
          console.error('[Schedule] Error parsing runAt:', e);
        }
      }
      
      if (timezone) {
        console.log('[Schedule] Setting timezone query to:', timezone);
        setScheduleTimezoneQuery(timezone);
        setSelectedTimezone({ timezoneCode: scheduleDetails.timezone_code || timezone, timezoneName: timezone });
      } else {
        console.log('[Schedule] No timezone value found, skipping timezone setup');
      }
      
      console.log('[Schedule] Setting recurring to:', recurring);
      setScheduleRecurring(recurring);
      
      if (recurring && frequency) {
        console.log('[Schedule] Setting frequency query to:', frequency);
        setScheduleFrequencyQuery(frequency);
        setSelectedFrequency({ frequencyCode: scheduleDetails.frequency_code || frequency, frequencyName: frequency });
      } else {
        console.log('[Schedule] Recurring is', recurring, '- frequency is', frequency, '- skipping frequency setup');
      }
    } else {
      console.log('[Schedule] Effect conditions not met - mode:', mode, 'scheduleDetails:', !!scheduleDetails);
    }
  }, [mode, scheduleDetails]);

  const maximizeResultsPanel = useCallback(() => {
    setResultsPanelBeforeMaximize(resultsPanelExpanded);
    setResultsPanelExpanded(true);
    setResultsPanelMaximized(true);
  }, [resultsPanelExpanded]);

  const restoreResultsPanel = useCallback(() => {
    setResultsPanelMaximized(false);
    setResultsPanelExpanded(resultsPanelBeforeMaximize);
  }, [resultsPanelBeforeMaximize]);

  useEffect(() => {
    scrollResultsDockIntoView();
  }, [resultsPanelExpanded, resultsPanelMaximized, scrollResultsDockIntoView]);

  useEffect(() => {
    const dirs = new Set();
    const walk = (node) => {
      if (node.type === "directory") {
        dirs.add(node.path);
        node.children.forEach(walk);
      }
    };
    treeNodes.forEach(walk);
    setExpandedSet(dirs);
  }, [treeNodes]);

  const isReadOnly = mode === "view";

  const allFilePaths = useMemo(() => collectFilePaths(treeNodes), [treeNodes]);

  const streamOptions = useMemo(() => {
    const values = new Set();
    allFilePaths.forEach((path) => {
      const parts = path.split("/").filter(Boolean);
      if (parts[1]) {
        values.add(parts[1]);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allFilePaths]);

  const regionOptions = useMemo(() => {
    const values = new Set();
    allFilePaths.forEach((path) => {
      const parts = path.split("/").filter(Boolean);
      // Region is the 3rd hierarchy segment; require at least one deeper segment so we don't pick filenames.
      if (parts.length >= 4 && parts[2]) {
        values.add(parts[2]);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allFilePaths]);

  useEffect(() => {
    setSelectedStreams((prev) => prev.filter((item) => streamOptions.includes(item)));
  }, [streamOptions]);

  useEffect(() => {
    setSelectedRegions((prev) => prev.filter((item) => regionOptions.includes(item)));
  }, [regionOptions]);

  useEffect(() => {
    if (executionMode !== "schedule") {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const items = await searchTimezones(scheduleTimezoneQuery.trim());
        setScheduleTimezoneOptions(Array.isArray(items) ? items : []);
      } catch {
        setScheduleTimezoneOptions([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [executionMode, scheduleTimezoneQuery]);

  useEffect(() => {
    if (executionMode !== "schedule" || !scheduleRecurring) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const items = await searchFrequencies(scheduleFrequencyQuery.trim());
        setScheduleFrequencyOptions(Array.isArray(items) ? items : []);
      } catch {
        setScheduleFrequencyOptions([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [executionMode, scheduleRecurring, scheduleFrequencyQuery]);

  const normalizedSearch = treeSearchText.trim().toLowerCase();

  const filteredTreeNodes = useMemo(() => {
    const hasStreamFilter = selectedStreams.length > 0;
    const hasRegionFilter = selectedRegions.length > 0;
    const hasSearch = normalizedSearch.length > 0;
    const selectedOnly = showMode === "selected";

    if (!hasStreamFilter && !hasRegionFilter && !hasSearch && !selectedOnly) {
      return treeNodes;
    }

    const matchesPath = (path) => {
      const parts = path.split("/").filter(Boolean);
      const stream = parts[1] || "";
      const region = parts[2] || "";
      if (selectedOnly && !selectedSet.has(path)) {
        return false;
      }
      if (hasStreamFilter && !selectedStreams.includes(stream)) {
        return false;
      }
      if (hasRegionFilter && !selectedRegions.includes(region)) {
        return false;
      }
      if (hasSearch && !path.toLowerCase().includes(normalizedSearch)) {
        return false;
      }
      return true;
    };

    const filterNode = (node) => {
      if (node.type === "file") {
        return matchesPath(node.path) ? node : null;
      }

      const children = node.children
        .map((child) => filterNode(child))
        .filter(Boolean);

      if (children.length > 0) {
        return { ...node, children };
      }

      return null;
    };

    return treeNodes
      .map((node) => filterNode(node))
      .filter(Boolean);
  }, [treeNodes, normalizedSearch, selectedStreams, selectedRegions, showMode, selectedSet]);

  const allFilteredDirPaths = useMemo(() => {
    const dirs = [];
    const walk = (node) => {
      if (node.type === "directory") {
        dirs.push(node.path);
        node.children?.forEach(walk);
      }
    };
    filteredTreeNodes.forEach(walk);
    return dirs;
  }, [filteredTreeNodes]);

  const isAllExpanded = allFilteredDirPaths.length > 0 && allFilteredDirPaths.every((p) => expandedSet.has(p));

  const getIsExpanded = useCallback((path) => expandedSet.has(path), [expandedSet]);

  const [isPending, startTransition] = useTransition();

  const onToggleExpand = useCallback((path) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const onToggleSelect = useCallback((node, descendantFiles, currentlyChecked) => {
    if (isReadOnly) return;
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (currentlyChecked) {
        descendantFiles.forEach((path) => next.delete(path));
      } else {
        descendantFiles.forEach((path) => next.add(path));
      }
      return next;
    });
  }, [isReadOnly]);

  const resultText = useMemo(() => {
    const stdout = execution?.stdout;
    if (stdout == null) return "No execution output yet.";
    if (typeof stdout === "string") return stdout;
    try {
      return JSON.stringify(stdout, null, 2);
    } catch {
      return String(stdout);
    }
  }, [execution?.stdout]);

  const status = normalizeStatus(execution?.status);
  const elapsed = execution?.elapsedSeconds ?? null;
  const canRun = mode === "new" || mode === "rerun";
  const hasSelectedScripts = selectedSet.size > 0;
  const showRunInDonut =
    executionMode === "run" &&
    canRun &&
    !running &&
    (status === "idle" || status === "unknown" || FINAL_STATUSES.has(status));
  const runButtonLabel = FINAL_STATUSES.has(status) ? "ReRun" : "Run";
  const isFinalStatus = FINAL_STATUSES.has(status);
  const executionStats = useMemo(() => buildExecutionStats(execution?.report), [execution?.report]);
  const statsTotal = executionStats.reduce((sum, item) => sum + item.value, 0);
  const statsConicGradient = useMemo(
    () => buildStatsConicGradient(executionStats),
    [executionStats]
  );

  useEffect(() => {
    if (!isFinalStatus && showStatsChart) {
      setShowStatsChart(false);
    }
  }, [isFinalStatus, showStatsChart]);

  useEffect(() => {
    if (!isFinalStatus) {
      return;
    }

    setShowStatsChart(true);
    setResultsExpanded(true);
    setResultsPanelExpanded(true);
  }, [isFinalStatus, execution?.testId]);

  useEffect(() => {
    if (!showStatsChart || !isFinalStatus) {
      return;
    }

    // Delay to ensure the stats panel has mounted before requesting scroll.
    const timer = window.setTimeout(() => {
      statsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [showStatsChart, isFinalStatus]);

  useEffect(() => {
    if (!resultsPanelExpanded || !showStatsChart || !isFinalStatus) {
      return;
    }

    const timer = window.setTimeout(() => {
      statsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [resultsPanelExpanded, showStatsChart, isFinalStatus]);

  const donutClass = useMemo(() => {
    if (status === "completed") return "te__donut te__donut--completed";
    if (status === "failed") return "te__donut te__donut--failed";
    if (status === "error") return "te__donut te__donut--error";
    if (status === "running") return "te__donut te__donut--running";
    if (status === "pending") return "te__donut te__donut--pending";
    return "te__donut te__donut--idle";
  }, [status]);

  const copyResults = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const handleScheduleCancel = () => {
    onExecutionModeChange("run");
    setScheduleError("");
    setScheduleMessage("");
  };

  const handleScheduleSave = async () => {
    if (!hasSelectedScripts) {
      setScheduleError("Select at least one test script before saving a schedule.");
      return;
    }
    if (!scheduleRunAt) {
      setScheduleError("Run at is required.");
      return;
    }
    if (!selectedTimezone) {
      setScheduleError("Timezone is required.");
      return;
    }
    if (scheduleRecurring && !selectedFrequency) {
      setScheduleError("Frequency is required for recurring schedules.");
      return;
    }

    setScheduleSaving(true);
    setScheduleError("");
    setScheduleMessage("");

    const payload = {
      run_type: "SCHEDULED",
      script_paths: Array.from(selectedSet),
      run_at: formatScheduleDateTime(scheduleRunAt),
      run_at_iso: new Date(scheduleRunAt).toISOString(),
      recurring: scheduleRecurring,
      timezone: {
        timezone_id: selectedTimezone.timezoneId,
        timezone_code: selectedTimezone.timezoneCode,
        timezone_name: selectedTimezone.timezoneName,
      },
      frequency: scheduleRecurring && selectedFrequency
        ? {
            frequency_id: selectedFrequency.frequencyId,
            frequency_code: selectedFrequency.frequencyCode,
            frequency_name: selectedFrequency.frequencyName,
          }
        : null,
    };

    try {
      await saveTestSchedule(payload);
      setScheduleMessage("Schedule saved successfully.");
    } catch (error) {
      setScheduleError(error?.message || "Unable to save schedule.");
    } finally {
      setScheduleSaving(false);
    }
  };

  return (
    <div className={`te__panel${resultsPanelMaximized ? " te__panel--results-maximized" : ""}`}>
      <div className="te__panel-grid">
        <section className="te__tree-card">
          <div className="te__card-head">
            <h3 className="te__scripts-title">
              <span className="te__scripts-title-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.15V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3.35" />
                  <path d="M14 2v5a1 1 0 0 0 1 1h5" />
                  <path d="m5 16-3 3 3 3" />
                  <path d="m9 22 3-3-3-3" />
                </svg>
              </span>
              <span>Select Test Scripts</span>
            </h3>
            <span className="te__card-head-meta"><span className="te__card-head-badge">{selectedSet.size}</span> Test selected</span>
          </div>

          {loadingTree && <div className="te__tree-message">Loading scripts...</div>}
          {!loadingTree && treeError && (
            <div className="te__tree-message te__tree-message--error">
              <p>{treeError}</p>
              <button type="button" className="te__btn te__btn--ghost" onClick={onRetryTree}>Retry</button>
            </div>
          )}
          {!loadingTree && !treeError && treeNodes.length === 0 && (
            <div className="te__tree-message">No scripts available.</div>
          )}

          {!loadingTree && !treeError && treeNodes.length > 0 && (
            <>
              <div className="te__tree-filters" role="group" aria-label="Tree filters">
                <div className="te__tree-filter-group">
                  <MultiSelectDropdown
                    label="Stream"
                    placeholder="All Streams"
                    options={streamOptions}
                    selected={selectedStreams}
                    onChange={setSelectedStreams}
                    className="te__tree-filter"
                  />
                  {selectedStreams.length > 0 && (
                    <div className="te__tree-filter-badges" aria-label="Selected stream filters">
                      {selectedStreams.map((stream) => (
                        <button
                          key={stream}
                          type="button"
                          className="te__tree-filter-badge"
                          onClick={() => setSelectedStreams((prev) => prev.filter((item) => item !== stream))}
                          aria-label={`Remove stream filter ${stream}`}
                        >
                          <span>{stream}</span>
                          <span className="te__tree-filter-badge-remove" aria-hidden="true">x</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="te__tree-filter-group">
                  <MultiSelectDropdown
                    label="Region"
                    placeholder="All Regions"
                    options={regionOptions}
                    selected={selectedRegions}
                    onChange={setSelectedRegions}
                    className="te__tree-filter"
                  />
                  {selectedRegions.length > 0 && (
                    <div className="te__tree-filter-badges" aria-label="Selected region filters">
                      {selectedRegions.map((region) => (
                        <button
                          key={region}
                          type="button"
                          className="te__tree-filter-badge"
                          onClick={() => setSelectedRegions((prev) => prev.filter((item) => item !== region))}
                          aria-label={`Remove region filter ${region}`}
                        >
                          <span>{region}</span>
                          <span className="te__tree-filter-badge-remove" aria-hidden="true">x</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="te__tree-search">
                  <span>Search</span>
                  <input
                    type="text"
                    value={treeSearchText}
                    onChange={(event) => setTreeSearchText(event.target.value)}
                    placeholder="Filter by file path"
                  />
                </label>
              </div>

              <div className={`te__tree${isPending ? " is-pending" : ""}`} role="tree" aria-label="Test script hierarchy">
                <div className="te__tree-show" role="group" aria-label="Tree visibility mode">
                  <button
                    type="button"
                    className="te__tree-expand-toggle"
                    disabled={allFilteredDirPaths.length === 0}
                    aria-label={isAllExpanded ? "Collapse all" : "Expand all"}
                    onClick={() =>
                      startTransition(() =>
                        setExpandedSet(isAllExpanded ? new Set() : new Set(allFilteredDirPaths))
                      )
                    }
                  >
                    <span className="te__tree-expand-toggle-text">{isAllExpanded ? "Collapse" : "Expand"}</span>
                    <span className="te__tree-expand-toggle-icon" aria-hidden="true">{isAllExpanded ? "\u2212" : "+"}</span>
                  </button>
                  <div className="te__tree-show-right">
                    <span className="te__tree-show-label">Show</span>
                    <button
                      type="button"
                      className={`te__tree-show-toggle ${showMode === "selected" ? "is-selected" : "is-all"}`.trim()}
                      onClick={() => startTransition(() => setShowMode((prev) => (prev === "all" ? "selected" : "all")))}
                      aria-label={showMode === "all" ? "Show selected only" : "Show all scripts"}
                      aria-pressed={showMode === "selected"}
                    >
                      <span className="te__tree-show-option">All</span>
                      <span className="te__tree-show-option">Selected</span>
                    </button>
                  </div>
                </div>
                {filteredTreeNodes.length === 0 ? (
                  <div className="te__tree-message">No scripts match selected filters.</div>
                ) : (
                  filteredTreeNodes.map((node) => (
                    <TreeNode
                      key={node.path}
                      node={node}
                      level={0}
                      isExpanded={expandedSet.has(node.path)}
                      getIsExpanded={getIsExpanded}
                      onToggleExpand={onToggleExpand}
                      selectedSet={selectedSet}
                      onToggleSelect={onToggleSelect}
                      disabled={isReadOnly}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <section className="te__runtime-card">
          <div className="te__card-head">
            <h3 className="te__execute-title">
              <span className="te__execute-title-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </span>
              <span>{executionMode === "schedule" ? "Schedule Tests" : "Execute Tests"}</span>
            </h3>

            <div className="te__runtime-head-controls">
              <div className="te__card-head-status" role="status" aria-live="polite">
                <span className="te__card-head-status-label">Status</span>
                <span className={statusClass(execution?.status || "idle")}>
                  {execution?.status ? formatStatus(execution.status) : "Idle"}
                </span>
              </div>
            </div>
          </div>

          {executionMode === "run" ? (
            <>
              <div className="te__runtime-top">
                <div className={donutClass}>
                  <div className="te__donut-center">
                    {showRunInDonut ? (
                      <button
                        type="button"
                        className={`te__run-btn-in-donut ${hasSelectedScripts ? "" : "te__run-btn-in-donut--idle"}`.trim()}
                        onClick={() => {
                          if (mode === "rerun") {
                            setExecutionResults([]);
                            setResultsPanelExpanded(false);
                            setResultsRefreshToken((prev) => prev + 1);
                          }
                          onRun(Array.from(selectedSet));
                        }}
                        disabled={!hasSelectedScripts}
                        aria-label={runButtonLabel === "ReRun" ? "Rerun test execution" : "Run test execution"}
                      >
                        {runButtonLabel}
                      </button>
                    ) : (
                      <>
                        <span className="te__donut-status">{execution?.status ? formatStatus(execution.status) : "Idle"}</span>
                        <span className="te__donut-time">{elapsed == null ? "00s" : formatDuration(elapsed)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="te__meta">
                  {runError && <div className="te__error">{runError}</div>}
                  <div><strong>Test Id:</strong> {execution?.testId || "-"}</div>
                  <div>
                    <strong>Time Taken:</strong>{" "}
                    {formatDuration(execution?.durationSeconds ?? elapsed)}
                  </div>
                </div>


              </div>

              <div className="te__results">
                <button
                  type="button"
                  className="te__results-toggle"
                  onClick={() => setResultsExpanded((prev) => !prev)}
                >
                  <span className="te__results-toggle-title">
                    <span className="te__results-toggle-icon" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z" />
                        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                      </svg>
                    </span>
                    <span>Test Execution Results</span>
                  </span>
                  <span>{resultsExpanded ? "▾" : "▸"}</span>
                </button>

                {resultsExpanded && (
                  <div className="te__results-body">
                    <div className="te__results-toolbar">
                      <div className="te__results-toolbar-left">
                        {isFinalStatus && (
                          <button
                            type="button"
                            className="te__btn te__btn--primary te__stats-toggle-btn"
                            onClick={() => {
                              setShowStatsChart((prev) => {
                                const next = !prev;
                                setResultsPanelExpanded(next);
                                return next;
                              });
                            }}
                          >
                            <span className="te__stats-toggle-icon" aria-hidden="true">
                              {showStatsChart ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                                  <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                                  <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                                  <path d="m2 2 20 20" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </span>
                            <span>{showStatsChart ? "Hide Stats" : "Show Stats"}</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`te__btn te__btn--ghost te__copy-btn${copied ? " te__copy-btn--copied" : ""}`}
                        onClick={copyResults}
                      >
                        <span className="te__copy-btn-icon" aria-hidden="true">
                          {copied ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                              <path d="m9 14 2 2 4-4" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            </svg>
                          )}
                        </span>
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>

                    {isFinalStatus && showStatsChart && (
                      <div className="te__stats-panel" role="region" aria-label="Execution stats overview" ref={statsPanelRef}>
                        <div className="te__stats-chart" style={{ background: statsConicGradient }} aria-hidden="true">
                          <div className="te__stats-chart-core">
                            <strong>{statsTotal}</strong>
                            <span>Checks</span>
                          </div>
                        </div>

                        <div className="te__stats-legend">
                          {executionStats.map((item) => (
                            <div key={item.key} className="te__stats-legend-item">
                              <span className="te__stats-dot" style={{ background: item.color }} aria-hidden="true" />
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <pre className="te__results-raw">{resultText}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="te__schedule-form">
              <div className="te__schedule-field">
                <label className="te__schedule-label">Run at</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={scheduleRunAt}
                  onChange={(event) => {
                    setScheduleRunAt(event.target.value);
                    setScheduleError("");
                    setScheduleMessage("");
                  }}
                  disabled={mode === "view"}
                  className="te__schedule-input"
                />
                <span className="te__schedule-hint">Format: dd-mm-yyyy hh:mm:ss</span>
              </div>

              <div className="te__schedule-field te__schedule-field--autocomplete">
                <label className="te__schedule-label">Timezone</label>
                <input
                  type="text"
                  value={scheduleTimezoneQuery}
                  onChange={(event) => {
                    setScheduleTimezoneQuery(event.target.value);
                    setSelectedTimezone(null);
                    setScheduleError("");
                    setScheduleMessage("");
                  }}
                  disabled={mode === "view"}
                  className="te__schedule-input"
                  placeholder="Search timezone"
                />
                {scheduleTimezoneOptions.length > 0 && (
                  <ul className="te__autocomplete-list">
                    {scheduleTimezoneOptions.map((timezone) => (
                      <li key={timezone.timezoneId}>
                        <button
                          type="button"
                          className="te__autocomplete-item"
                          onClick={() => {
                            setSelectedTimezone(timezone);
                            setScheduleTimezoneQuery(timezone.timezoneName || timezone.timezoneCode || "");
                            setScheduleTimezoneOptions([]);
                          }}
                        >
                          {timezone.timezoneName || timezone.timezoneCode}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="te__schedule-recurring">
                <input
                  type="checkbox"
                  checked={scheduleRecurring}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setScheduleRecurring(checked);
                    if (!checked) {
                      setSelectedFrequency(null);
                      setScheduleFrequencyQuery("");
                      setScheduleFrequencyOptions([]);
                    }
                    setScheduleError("");
                    setScheduleMessage("");
                  }}
                  disabled={mode === "view"}
                />
                Recurring
              </label>

              {scheduleRecurring && (
                <div className="te__schedule-field te__schedule-field--autocomplete">
                  <label className="te__schedule-label">Frequency</label>
                  <input
                    type="text"
                    value={scheduleFrequencyQuery}
                    onChange={(event) => {
                      setScheduleFrequencyQuery(event.target.value);
                      setSelectedFrequency(null);
                      setScheduleError("");
                      setScheduleMessage("");
                    }}
                    disabled={mode === "view"}
                    className="te__schedule-input"
                    placeholder="Search frequency"
                  />
                  {scheduleFrequencyOptions.length > 0 && (
                    <ul className="te__autocomplete-list">
                      {scheduleFrequencyOptions.map((frequency) => (
                        <li key={frequency.frequencyId}>
                          <button
                            type="button"
                            className="te__autocomplete-item"
                            onClick={() => {
                              setSelectedFrequency(frequency);
                              setScheduleFrequencyQuery(frequency.frequencyName || frequency.frequencyCode || "");
                              setScheduleFrequencyOptions([]);
                            }}
                          >
                            {frequency.frequencyName || frequency.frequencyCode}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {scheduleError ? <div className="te__error">{scheduleError}</div> : null}
              {scheduleMessage ? <div className="te__schedule-success">{scheduleMessage}</div> : null}
              {mode === "view" && scheduleDetails && <div className="te__schedule-readonly-notice">Viewing saved schedule details - Read only</div>}

              <div className="te__schedule-actions">
                <button
                  type="button"
                  className="te__btn te__btn--secondary"
                  onClick={handleScheduleCancel}
                  disabled={scheduleSaving || mode === "view"}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="te__btn te__btn--primary"
                  onClick={handleScheduleSave}
                  disabled={scheduleSaving || mode === "view"}
                >
                  {scheduleSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

        </section>

        {executionMode === "run" && (
          <div className="te__results-dock" ref={resultsDockRef}>
            <div className="te__results-dock-head">
              <button
                type="button"
                className="te__results-panel-toggle"
                onClick={() => setResultsPanelExpanded((prev) => !prev)}
                aria-expanded={resultsPanelExpanded}
              >
                <span>{resultsPanelExpanded ? "Collapse Results" : "Expand Results"}</span>
                <span aria-hidden="true">{resultsPanelExpanded ? "▾" : "▴"}</span>
              </button>

              {resultsPanelExpanded && (
                <div className="te__results-dock-controls">
                  {!resultsPanelMaximized ? (
                    <button
                      type="button"
                      className="te__results-dock-icon-btn"
                      onClick={maximizeResultsPanel}
                      aria-label="Expand results panel to full area"
                      title="Expand"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m18 9-6-6-6 6" />
                        <path d="M12 3v14" />
                        <path d="M5 21h14" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="te__results-dock-icon-btn"
                      onClick={restoreResultsPanel}
                      aria-label="Restore results panel"
                      title="Restore"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 17V3" />
                        <path d="m6 11 6 6 6-6" />
                        <path d="M19 21H5" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {resultsPanelExpanded && (
              <div className="te__results-panel te__results-panel--dock" style={{ maxHeight: `${EXECUTION_RESULTS_PANEL_HEIGHT}px` }}>
                <DataTable
                  key={resultsRefreshToken}
                  columns={[
                    { key: "status", label: "Status", render: (value) => <ResultStatusCell status={value} /> },
                    { key: "testId", label: "Test Id" },
                    { key: "scriptName", label: "Script Name", truncate: 20, render: (value) => <ScriptNameCell value={value} /> },
                    { key: "errorMessage", label: "Error", truncate: 15, render: (value) => <ScriptNameCell value={value} limit={15} /> },
                    { key: "runDuration", label: "Run Duration", render: (value) => formatDuration(value) },
                  ]}
                  data={executionResults}
                  searchableColumns={["status", "testId", "scriptName", "errorMessage", "runDuration"]}
                  pageSize={10}
                  pageSizeOptions={[10, 20, 50]}
                  paginationPlacement="bottom"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TestExecutionPage() {
  const [reloadToken, setReloadToken] = useState(0);
  const [panelMode, setPanelMode] = useState("");
  const [panelExecutionMode, setPanelExecutionMode] = useState("run");
  const [panelExecution, setPanelExecution] = useState(null);
  const [scheduleDetails, setScheduleDetails] = useState(null);
  const [panelRunError, setPanelRunError] = useState("");
  const [running, setRunning] = useState(false);

  const [treeNodes, setTreeNodes] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState("");

  const [liveExecutionIds, setLiveExecutionIds] = useState([]);

  const panelOpen = Boolean(panelMode);

  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    setTreeError("");
    try {
      const data = await fetchTestScripts();
      setTreeNodes(normalizeScriptTree(data));
    } catch (error) {
      setTreeError(error?.message || "Unable to fetch test scripts hierarchy.");
      setTreeNodes([]);
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    if (panelOpen) {
      loadTree();
    }
  }, [panelOpen, loadTree]);

  useEffect(() => {
    if (scheduleDetails) {
      console.log('[TestExecutionPage] scheduleDetails updated:', scheduleDetails);
    }
  }, [scheduleDetails]);

  useEffect(() => {
    if (!panelExecution?.testId) return undefined;
    const status = normalizeStatus(panelExecution.status);
    if (!LIVE_STATUSES.has(status)) return undefined;

    const timer = window.setInterval(async () => {
      try {
        const latest = await getTestExecutionStatus(panelExecution.testId);
        const normalized = normalizeExecution(latest);
        setPanelExecution((prev) => ({
          ...(prev || {}),
          ...normalized,
          selectedScripts: prev?.selectedScripts || normalized.selectedScripts || [],
          elapsedSeconds: prev?.elapsedSeconds ?? 0,
        }));

        if (FINAL_STATUSES.has(normalized.status)) {
          await saveExecution({
            test_id: normalized.testId,
            status: normalized.status,
            script_path: normalized.selectedScripts?.[0] || null,
            script_paths: normalized.selectedScripts || [],
            created_at: normalized.createdAt,
            started_at: normalized.startedAt,
            finished_at: normalized.finishedAt,
            stdout: normalized.stdout,
            stderr: normalized.stderr,
            report: normalized.report,
            report_path: normalized.reportPath,
            duration_seconds: normalized.durationSeconds,
            results: normalized.results || [],
          });
          setReloadToken((prev) => prev + 1);
        }
      } catch {
        // Keep panel alive on transient status polling errors.
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [panelExecution?.testId, panelExecution?.status]);

  useEffect(() => {
    if (!panelExecution?.testId) return undefined;
    const status = normalizeStatus(panelExecution.status);
    if (!LIVE_STATUSES.has(status)) return undefined;

    const timer = window.setInterval(() => {
      setPanelExecution((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          elapsedSeconds: (prev.elapsedSeconds || 0) + 1,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [panelExecution?.testId, panelExecution?.status]);

  useEffect(() => {
    if (liveExecutionIds.length === 0) return undefined;

    const timer = window.setInterval(async () => {
      try {
        await Promise.all(
          liveExecutionIds.map(async (testId) => {
            const latest = await getTestExecutionStatus(testId);
            const normalized = normalizeExecution(latest);
            if (FINAL_STATUSES.has(normalized.status)) {
              await saveExecution({
                test_id: normalized.testId,
                status: normalized.status,
                script_path: normalized.selectedScripts?.[0] || null,
                script_paths: normalized.selectedScripts || [],
                created_at: normalized.createdAt,
                started_at: normalized.startedAt,
                finished_at: normalized.finishedAt,
                stdout: normalized.stdout,
                stderr: normalized.stderr,
                report: normalized.report,
                report_path: normalized.reportPath,
                duration_seconds: normalized.durationSeconds,
                results: normalized.results || [],
              });
            }
          })
        );
        setReloadToken((prev) => prev + 1);
      } catch {
        // Keep table polling resilient to partial failures.
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [liveExecutionIds]);

  const openPanel = useCallback((mode, row = null) => {
    console.log('[openPanel] Called with mode:', mode, 'row executionId:', row?.executionId);
    setPanelMode(mode);
    setPanelExecutionMode("run");
    setPanelRunError("");
    setScheduleDetails(null); // Clear previous schedule details when opening new panel
    if (row) {
      setPanelExecution({
        ...row,
        selectedScripts: row.selectedScripts || [],
        elapsedSeconds: row.durationSeconds || 0,
      });
      // Fetch full execution details if viewing or rerunning
      if ((mode === "view" || mode === "rerun") && row.executionId) {
        (async () => {
          try {
            const { getExecutionDetails, getScheduleDetails } = await import('../../services/testExecutionService.js');
            const details = await getExecutionDetails(row.executionId);
            console.log('[openPanel] getExecutionDetails response - has schedule_id:', !!details?.schedule_id, 'schedule_id:', details?.schedule_id);
            console.log('[openPanel] Execution items:', details?.execution_items);
            if (details) {
              // Use normalizeExecution to properly extract selectedScripts from execution_items
              const normalized = normalizeExecution(details);
              console.log('[openPanel] Normalized selectedScripts:', normalized.selectedScripts);
              console.log('[openPanel] Mode:', mode, '- form fields will be', mode === 'view' ? 'disabled' : 'editable');
              setPanelExecution({
                ...normalized,
                elapsedSeconds: row.durationSeconds || 0,
              });
              // Fetch schedule details if execution has a schedule
              if (details.schedule_id) {
                console.log('[openPanel] Fetching schedule details for scheduleId:', details.schedule_id);
                try {
                  const schedule = await getScheduleDetails(details.schedule_id);
                  console.log('[openPanel] Raw API response:', schedule);
                  console.log('[openPanel] Response keys:', schedule ? Object.keys(schedule) : 'null');
                  if (schedule) {
                    console.log('[openPanel] Checking schedule fields:');
                    console.log('  - timezone/timeZone/time_zone:', schedule.timezone || schedule.timeZone || schedule.time_zone);
                    console.log('  - frequency/frequencyName:', schedule.frequency || schedule.frequencyName);
                    console.log('  - recurring/is_recurring:', schedule.recurring || schedule.is_recurring);
                    console.log('[openPanel] Setting scheduleDetails from API:', schedule);
                    setScheduleDetails(schedule);
                  } else {
                    // If endpoint returns null/404, create a basic schedule object from execution data
                    const fallbackSchedule = {
                      scheduleId: details.schedule_id,
                      runAt: details.started_at || details.created_at,
                      recurring: false,
                    };
                    console.log('[openPanel] API returned null, setting fallback scheduleDetails:', fallbackSchedule);
                    setScheduleDetails(fallbackSchedule);
                  }
                } catch (e) {
                  // Schedule details fetch failed, create basic object from execution data
                  const fallbackSchedule = {
                    scheduleId: details.schedule_id,
                    runAt: details.started_at || details.created_at,
                    recurring: false,
                  };
                  console.log('[openPanel] API call failed, setting fallback scheduleDetails:', fallbackSchedule, 'Error:', e);
                  setScheduleDetails(fallbackSchedule);
                }
              } else {
                console.log('[openPanel] No schedule_id in execution details, not fetching schedule');
              }
            }
          } catch {
            // Keep panel alive with table data if fetch fails
          }
        })();
      }
      return;
    }
    setPanelExecution({
      testId: "",
      status: "idle",
      selectedScripts: [],
      createdAt: null,
      startedAt: null,
      finishedAt: null,
      elapsedSeconds: 0,
      report: null,
      reportPath: "",
    });
  }, []);

  const closePanel = useCallback(() => {
    setPanelMode("");
    setPanelExecutionMode("run");
    setPanelExecution(null);
    setScheduleDetails(null);
    setPanelRunError("");
    setRunning(false);
  }, []);

  const handleRun = useCallback(async (selectedScripts) => {
    if (!selectedScripts.length) {
      setPanelRunError("Select at least one test script before running execution.");
      return;
    }

    setRunning(true);
    setPanelRunError("");

    try {
      const response = await executeTests({
        script_path: selectedScripts[0],
        script_paths: selectedScripts,
        pytest_args: [
            "-k",
            "test_nginx"
        ],
      });

      const execution = normalizeExecution({
        ...response,
        script_paths: selectedScripts,
      });

      setPanelExecution((prev) => ({
        ...(prev || {}),
        ...execution,
        selectedScripts,
        elapsedSeconds: 0,
      }));

      await saveExecution({
        test_id: execution.testId,
        status: execution.status,
        script_path: selectedScripts[0],
        script_paths: selectedScripts,
        created_at: execution.createdAt,
        started_at: execution.startedAt,
        finished_at: execution.finishedAt,
        stdout: execution.stdout,
        stderr: execution.stderr,
        report: execution.report,
        report_path: execution.reportPath,
        duration_seconds: execution.durationSeconds,
        results: execution.results || [],
      });

      setReloadToken((prev) => prev + 1);
    } catch (error) {
      setPanelRunError(error?.message || "Unable to execute selected tests.");
    } finally {
      setRunning(false);
    }
  }, []);

  const columns = useMemo(
    () => [
      { key: "testId", label: "Test Id", sortable: true },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (value) => <span className={statusClass(value)}>{formatStatus(value)}</span>,
      },
      {
        key: "createdAt",
        label: "Created At",
        sortable: true,
        render: (value) => formatDateTime(value),
      },
      {
        key: "startedAt",
        label: "Started At",
        sortable: true,
        render: (value) => formatDateTime(value),
      },
      {
        key: "finishedAt",
        label: "Finished At",
        sortable: true,
        render: (value) => formatDateTime(value),
      },
      {
        key: "durationSeconds",
        label: "Run Duration",
        sortable: true,
        render: (value) => formatDuration(value),
      },
    ],
    []
  );

  const buildServerQuery = useCallback(({ page, pageSize, sort, filters }) => ({
    page: page - 1,
    size: pageSize,
    sortBy: sort?.[0]?.key || "created_at",
    sortDirection: sort?.[0]?.dir || "desc",
    filters,
  }), []);

  const executionTableService = useCallback(async (params) => {
    const payload = await fetchExecutions(params);
    const rows = extractRows(payload).map(normalizeExecution);
    const total = extractTotal(payload, rows.length);

    setLiveExecutionIds(
      rows
        .filter((row) => LIVE_STATUSES.has(normalizeStatus(row.status)))
        .map((row) => row.testId)
        .filter(Boolean)
    );

    return {
      data: rows,
      total,
    };
  }, []);

  const renderRowActions = useCallback(
    ({ row }) => (
      <div className="te__actions">
        <button
          type="button"
          className="te__btn te__btn--ghost"
          onClick={() => openPanel("view", row)}
        >
          View
        </button>
        <button
          type="button"
          className="te__btn te__btn--secondary"
          onClick={() => openPanel("rerun", row)}
        >
          ReRun
        </button>
        <button
          type="button"
          className="te__btn te__btn--primary"
          onClick={async () => {
            try {
              await downloadExecutionReport(row.testId, row.reportPath || undefined);
            } catch {
              // Keep table interaction non-blocking.
            }
          }}
        >
          Report
        </button>
      </div>
    ),
    [openPanel]
  );

  const panelTitle =
    panelMode === "new"
      ? "New Test Execution"
      : panelMode === "rerun"
        ? "ReRun Test Execution"
        : "View Test Execution";

  const handleRefreshTable = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  return (
    <div className={`te-page${panelOpen ? " te-page--panel-open" : ""}`}>
      <div className="te-page__inline-panel-wrap">
          <InlineFullscreenPanel
            isOpen={panelOpen}
            title={panelTitle}
            onBack={closePanel}
            backLabel="Back to Executions"
            headerActions={(
              <div className="te__run-schedule-toggle" role="group" aria-label="Run or schedule mode">
                <button
                  type="button"
                  className={`te__run-schedule-toggle-btn ${panelExecutionMode === "run" ? "is-active" : ""}`.trim()}
                  onClick={() => setPanelExecutionMode("run")}
                >
                  Run
                </button>
                <button
                  type="button"
                  className={`te__run-schedule-toggle-btn ${panelExecutionMode === "schedule" ? "is-active" : ""}`.trim()}
                  onClick={() => setPanelExecutionMode("schedule")}
                >
                  Schedule
                </button>
              </div>
            )}
            enableFullscreenToggle
            transparent
          >
            <TestExecutionPanel
              mode={panelMode || "view"}
              executionMode={panelExecutionMode}
              onExecutionModeChange={setPanelExecutionMode}
              selectedScripts={panelExecution?.selectedScripts || []}
              treeNodes={treeNodes}
              loadingTree={loadingTree}
              treeError={treeError}
              onRetryTree={loadTree}
              onRun={handleRun}
              running={running}
              execution={panelExecution}
              runError={panelRunError}
              scheduleDetails={scheduleDetails}
            />
          </InlineFullscreenPanel>
        </div>

        <div className="te-page__content">
          <div className="te-page__title-row">
            <div>
              <h1>Test Execution Management</h1>
              <p>Create and monitor test executions with live status polling and execution outputs.</p>
            </div>
            <button type="button" className="te__btn te__btn--primary te__new-exec-btn" onClick={() => openPanel("new")}>
              <span className="te__new-exec-icon" aria-hidden="true">+</span>
              <span>New Test Execution</span>
            </button>
          </div>

          <section className="te-page__table-shell">
            <div className="te-page__table-toolbar">
              <button
                type="button"
                className="te__btn te__btn--secondary te__refresh-btn"
                onClick={handleRefreshTable}
                aria-label="Refresh execution table"
              >
                <span className="te__refresh-icon" aria-hidden="true">↻</span>
                <span>Refresh</span>
              </button>
            </div>

            <DataTable
              columns={columns}
              sortableColumns={[
                "testId",
                "status",
                "createdAt",
                "startedAt",
                "finishedAt",
                "durationSeconds",
              ]}
              searchableColumns={["testId", "status"]}
              serverSide
              pageSize={10}
              pageSizeOptions={[10, 20, 50]}
              service={executionTableService}
              buildServerQuery={buildServerQuery}
              reloadToken={reloadToken}
              renderRowActions={renderRowActions}
              rowActionsColumnWidth="22%"
            />
          </section>
        </div>
    </div>
  );
}
