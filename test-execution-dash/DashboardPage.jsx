import { useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboardSummary, fetchDashboardTrends } from "../../services/dashboardService";
import "./DashboardPage.css";

const DATE_RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

const STREAM_OPTIONS = [
  { label: "Core Banking", value: "core-banking", applicationId: 5 },
  { label: "Wealth", value: "wealth", applicationId: 8 },
  { label: "Global Markets", value: "global-markets", applicationId: 11 },
  { label: "Payments", value: "payments", applicationId: 14 },
];

const CARD_ICONS = {
  flow: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  duration: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  steps: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="8" x="3" y="3" rx="2" />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" />
      <rect width="8" height="8" x="13" y="13" rx="2" />
    </svg>
  ),
};

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0%";
  return `${Math.round(num)}%`;
}

function formatDurationMins(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  if (num < 60) return `${Math.round(num)}m`;
  const hrs = Math.floor(num / 60);
  const mins = Math.round(num % 60);
  return `${hrs}h ${mins}m`;
}

function formatLabelDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatRangeForApi(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildRange(rangeType, customStart, customEnd) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result = {
    days: 1,
    startDate: undefined,
    endDate: undefined,
    rangeSubtitle: "1",
  };

  if (rangeType === "today") {
    result.days = 1;
    return result;
  }

  if (rangeType === "yesterday") {
    result.days = 1;
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    result.startDate = formatRangeForApi(y);
    result.endDate = formatRangeForApi(y);
    return result;
  }

  if (rangeType === "last7") {
    result.days = 7;
    result.rangeSubtitle = "7";
    return result;
  }

  if (rangeType === "last30") {
    result.days = 30;
    result.rangeSubtitle = "30";
    return result;
  }

  if (rangeType === "thisMonth") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = today;
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    result.days = diffDays;
    result.startDate = formatRangeForApi(start);
    result.endDate = formatRangeForApi(end);
    result.rangeSubtitle = String(diffDays);
    return result;
  }

  if (rangeType === "lastMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    result.days = diffDays;
    result.startDate = formatRangeForApi(start);
    result.endDate = formatRangeForApi(end);
    result.rangeSubtitle = String(diffDays);
    return result;
  }

  if (rangeType === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
      result.days = diffDays;
      result.startDate = formatRangeForApi(start);
      result.endDate = formatRangeForApi(end);
      result.rangeSubtitle = String(diffDays);
    }
  }

  return result;
}

function SearchableSelect({
  label,
  options,
  selectedValue,
  onChange,
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverShiftX, setPopoverShiftX] = useState(0);
  const dropdownRef = useRef(null);
  const popoverRef = useRef(null);

  const selected = useMemo(
    () => options.find((item) => item.value === selectedValue) || options[0],
    [options, selectedValue]
  );

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((item) => item.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPopoverShiftX(0);
      return;
    }

    function updatePopoverPosition() {
      if (!popoverRef.current) return;
      const rect = popoverRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      let shiftX = 0;

      if (rect.right > window.innerWidth - viewportPadding) {
        shiftX = (window.innerWidth - viewportPadding) - rect.right;
      }

      if (rect.left + shiftX < viewportPadding) {
        shiftX += viewportPadding - (rect.left + shiftX);
      }

      setPopoverShiftX(shiftX);
    }

    const rafId = window.requestAnimationFrame(updatePopoverPosition);
    window.addEventListener("resize", updatePopoverPosition);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePopoverPosition);
    };
  }, [open, filtered.length, searchable]);

  return (
    <div className="db__filter" ref={dropdownRef}>
      <label className="db__filter-label">{label}</label>
      <button
        type="button"
        className="db__select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label}</span>
        <span className="db__select-arrow">▾</span>
      </button>

      {open ? (
        <div
          className="db__select-popover"
          role="listbox"
          ref={popoverRef}
          style={{ transform: `translateX(${popoverShiftX}px)` }}
        >
          {searchable ? (
            <input
              className="db__search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stream"
              type="text"
            />
          ) : null}
          <div className="db__select-options">
            {filtered.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`db__select-option ${item.value === selectedValue ? "is-active" : ""}`.trim()}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ title, value, iconKey }) {
  return (
    <article className="db__summary-card">
      <div>
        <p className="db__summary-name">{title}</p>
        <h3 className="db__summary-value">{value}</h3>
      </div>
      <div className={`db__summary-icon db__summary-icon--${iconKey}`}>{CARD_ICONS[iconKey]}</div>
    </article>
  );
}

function DonutChart({ successRate = 0, failureRate = 0 }) {
  const [hoverState, setHoverState] = useState(null);
  const donutWrapRef = useRef(null);
  const safeSuccess = Math.max(0, Math.min(100, Number(successRate) || 0));
  const safeFailure = Math.max(0, Math.min(100, Number(failureRate) || 0));
  const totalRate = safeSuccess + safeFailure;
  const successShare = totalRate > 0 ? (safeSuccess / totalRate) * 100 : safeSuccess;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const successOffset = circumference - (successShare / 100) * circumference;

  const handleDonutHover = (event, label, value, color) => {
    if (!donutWrapRef.current) return;
    const rect = donutWrapRef.current.getBoundingClientRect();
    setHoverState({
      label,
      value,
      color,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div className="db__donut-wrap" ref={donutWrapRef}>
      <svg
        className="db__donut"
        viewBox="0 0 140 140"
        aria-label="Success rate donut chart"
        onMouseLeave={() => setHoverState(null)}
      >
        <circle
          className="db__donut-failure"
          cx="70"
          cy="70"
          r={radius}
          onMouseEnter={(event) => handleDonutHover(event, "Failure", safeFailure, "#b53746")}
          onMouseMove={(event) => handleDonutHover(event, "Failure", safeFailure, "#b53746")}
        />
        <circle
          className="db__donut-value"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={successOffset}
          onMouseEnter={(event) => handleDonutHover(event, "Success", safeSuccess, "#2f8f43")}
          onMouseMove={(event) => handleDonutHover(event, "Success", safeSuccess, "#2f8f43")}
        />
      </svg>
      {hoverState ? (
        <div
          className="db__donut-tooltip"
          role="status"
          aria-live="polite"
          style={{
            left: `${hoverState.x}px`,
            top: `${hoverState.y}px`,
          }}
        >
          <div className="db__tooltip-title">{hoverState.label}</div>
          <div className="db__donut-tooltip-row">
            <span className="db__donut-tooltip-swatch" style={{ background: hoverState.color }} />
            <span>{hoverState.label}: {formatPercent(hoverState.value)}</span>
          </div>
        </div>
      ) : null}
      <div className="db__donut-center">
        <span className="db__donut-value-text">{formatPercent(safeSuccess)}</span>
        <span className="db__donut-value-sub">Successful</span>
      </div>
      <div className="db__donut-legend">
        <div><span className="dot dot--success" />Success</div>
        <div><span className="dot dot--fail" />Failure</div>
      </div>
    </div>
  );
}

function StackedBarChart({ rows = [] }) {
  const maxY = 250;
  const gridValues = [0, 50, 100, 150, 200, 250];
  const [hoverState, setHoverState] = useState(null);

  const bars = useMemo(
    () =>
      rows.map((item) => ({
        label: formatLabelDate(item.date || item.period),
        passed: Number(item.passedCount) || 0,
        failed: Number(item.failedCount) || 0,
        cancelled: Number(item.cancelledCount) || 0,
        total: Number(item.totalCount) || 0,
        successRate: Number(item.successRate) || 0,
      })),
    [rows]
  );

  const shouldTiltLabels = bars.length >= 16;
  const smallCountClass = !shouldTiltLabels && bars.length > 0 && bars.length <= 4
    ? `db__row-count-${bars.length}`
    : "";

  const handleBarHover = (index, label, key, colorClass, total, successRate, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverState({
      index,
      label,
      key,
      colorClass,
      total,
      successRate,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      cursorX: event.clientX,
      cursorY: event.clientY,
    });
  };

  return (
    <div className={`db__stacked-chart ${shouldTiltLabels ? "db__stacked-chart--dense" : ""}`.trim()}>
      <div className="db__chart-legend-top">
        <span><i className="legend-swatch legend-swatch--pass" />Passed</span>
        <span><i className="legend-swatch legend-swatch--fail" />Failed</span>
      </div>

      <div className="db__stacked-plot">
        <div className="db__y-axis">
          {gridValues.slice().reverse().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className={`db__bars-area ${shouldTiltLabels ? "db__bars-area--dense" : ""}`.trim()}>
          {gridValues.slice(1).map((tick) => (
            <div key={tick} className="db__grid-line" style={{ bottom: `${(tick / maxY) * 100}%` }} />
          ))}

          <div className="db__x-axis" />

          <div className={`db__bars-row ${shouldTiltLabels ? "db__bars-row--dense" : ""} ${smallCountClass}`.trim()}>
            {bars.map((bar, index) => {
              const safeTotal = Math.max(bar.total, bar.passed + bar.failed);
              const totalHeight = Math.min(100, (safeTotal / maxY) * 100);
              const passHeight = safeTotal > 0 ? (bar.passed / safeTotal) * totalHeight : 0;
              const failHeight = safeTotal > 0 ? (bar.failed / safeTotal) * totalHeight : 0;
              const topSegmentKey =
                passHeight > 0 ? "pass" : failHeight > 0 ? "fail" : null;

              return (
                <div className="db__bar-group" key={`${bar.label}-${index}`}>
                  <div
                    className="db__bar-stack"
                    role="img"
                    aria-label={`${bar.label} total ${safeTotal}`}
                  >
                    <div
                      className={`db__bar-segment db__bar-segment--fail ${topSegmentKey === "fail" ? "db__bar-segment--top" : ""}`.trim()}
                      style={{ height: `${failHeight}%` }}
                      onMouseEnter={(e) =>
                        handleBarHover(index, bar.label, "Failed", "legend-swatch--fail", safeTotal, bar.successRate, e)
                      }
                      onMouseLeave={() => setHoverState(null)}
                    />
                    <div
                      className={`db__bar-segment db__bar-segment--pass ${topSegmentKey === "pass" ? "db__bar-segment--top" : ""}`.trim()}
                      style={{ height: `${passHeight}%` }}
                      onMouseEnter={(e) =>
                        handleBarHover(index, bar.label, "Passed", "legend-swatch--pass", safeTotal, bar.successRate, e)
                      }
                      onMouseLeave={() => setHoverState(null)}
                    />

                    {hoverState && hoverState.index === index ? (() => {
                      const tooltipX = hoverState.x;
                      const tooltipY = hoverState.y;

                      return (
                        <div
                          className="db__bar-tooltip"
                          role="status"
                          aria-live="polite"
                          style={{
                            left: `${tooltipX}px`,
                            top: `${tooltipY}px`,
                          }}
                        >
                          <div className="db__tooltip-title">
                            {hoverState.label}
                          </div>
                          <div className="db__tooltip-series">
                            <i className={`legend-swatch ${hoverState.colorClass}`} />
                            {hoverState.key}
                          </div>
                          <div>Total: {hoverState.total}</div>
                          <div>Success Rate: {formatPercent(hoverState.successRate)}</div>
                        </div>
                      );
                    })() : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`db__labels-row ${shouldTiltLabels ? "db__labels-row--dense" : ""} ${smallCountClass}`.trim()}>
            {bars.map((bar, index) => (
              <div className="db__label-cell" key={`${bar.label}-label-${index}`}>
                <span className={`db__bar-label ${shouldTiltLabels ? "db__bar-label--dense" : ""}`.trim()}>
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [streamValue, setStreamValue] = useState(STREAM_OPTIONS[0].value);
  const [dateRange, setDateRange] = useState("last7");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeStream = useMemo(
    () => STREAM_OPTIONS.find((option) => option.value === streamValue) || STREAM_OPTIONS[0],
    [streamValue]
  );

  const range = useMemo(
    () => buildRange(dateRange, customStartDate, customEndDate),
    [dateRange, customStartDate, customEndDate]
  );

  useEffect(() => {
    if (dateRange === "custom" && (!customStartDate || !customEndDate)) {
      return;
    }

    let mounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      fetchDashboardSummary({
        applicationId: activeStream.applicationId,
        startDate: range.startDate,
        endDate: range.endDate,
      }),
      fetchDashboardTrends({
        period: "day",
        days: range.days,
        applicationId: activeStream.applicationId,
        startDate: range.startDate,
        endDate: range.endDate,
      }),
    ])
      .then(([summaryRes, trendsRes]) => {
        if (!mounted) return;
        setSummary(summaryRes || {});
        setTrends(Array.isArray(trendsRes) ? trendsRes : []);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Unable to fetch dashboard data from backend.");
        setSummary({
          totalFlowExecution: 555,
          totalPipelineExecutions: 55,
          passedCount: 44,
          failedCount: 44,
          cancelCount: 4,
          successRate: 30,
          failureRate: 70,
          avgExecutionTimeMins: 507,
        });

        const fallback = Array.from({ length: range.days }, (_, index) => {
          const d = new Date();
          d.setDate(d.getDate() - (range.days - index - 1));
          const failed = Math.floor(12 + Math.random() * 80);
          const passed = Math.floor(8 + Math.random() * 70);
          const cancelled = Math.floor(Math.random() * 8);
          const total = failed + passed + cancelled;
          const successRate = total > 0 ? (passed / total) * 100 : 0;
          return {
            date: formatRangeForApi(d),
            period: formatRangeForApi(d),
            passedCount: passed,
            failedCount: failed,
            cancelledCount: cancelled,
            totalCount: total,
            successRate,
            avgDurationMins: null,
          };
        });
        setTrends(fallback);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeStream.applicationId, dateRange, customEndDate, customStartDate, range.days, range.endDate, range.startDate]);

  return (
    <section className="db__page">
      <header className="db__header-row">
        <div>
          <h1 className="db__title">Dashboard</h1>
          <p className="db__subtitle">Monitor your test executions and flows</p>
        </div>

        <div className="db__filters-row">
          <SearchableSelect
            label="Stream"
            options={STREAM_OPTIONS}
            selectedValue={streamValue}
            onChange={setStreamValue}
            searchable
          />

          <SearchableSelect
            label="Date range"
            options={DATE_RANGE_OPTIONS}
            selectedValue={dateRange}
            onChange={setDateRange}
          />

          {dateRange === "custom" ? (
            <div className="db__custom-range">
              <label>
                Start date
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <div className="db__error-banner">{error}</div> : null}

      <section className="db__summary-grid">
        <SummaryCard
          title="Flow Executions"
          value={summary?.totalFlowExecution ?? "-"}
          iconKey="flow"
        />
        <SummaryCard
          title="Success Rate"
          value={formatPercent(summary?.successRate)}
          iconKey="success"
        />
        <SummaryCard
          title="Avg Duration"
          value={formatDurationMins(summary?.avgExecutionTimeMins)}
          iconKey="duration"
        />
        <SummaryCard
          title="Step Executions"
          value={summary?.totalPipelineExecutions ?? "-"}
          iconKey="steps"
        />
      </section>

      <section className="db__chart-grid">
        <article className="db__chart-card db__chart-card--wide">
          <div className="db__card-head">
            <h2>Execution Trends</h2>
            <p>Pass/fail over the last {range.rangeSubtitle} day(s).</p>
          </div>
          {loading ? <div className="db__loading">Loading chart...</div> : <StackedBarChart rows={trends} />}
        </article>

        <article className="db__chart-card">
          <div className="db__card-head">
            <h2>Success Rate</h2>
            <p>Overall execution success rate.</p>
          </div>
          {loading ? (
            <div className="db__loading">Loading chart...</div>
          ) : (
            <DonutChart
              successRate={summary?.successRate}
              failureRate={summary?.failureRate}
            />
          )}
        </article>
      </section>
    </section>
  );
}
