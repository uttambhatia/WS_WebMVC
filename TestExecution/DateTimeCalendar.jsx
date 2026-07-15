import { useEffect, useRef, useState } from "react";
import "./DateTimeCalendar.css";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseLocalDateTimeParts(value) {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  const [datePart, timePart = "00:00:00"] = text.split("T");
  const [year, month, day] = datePart.split("-").map((part) => Number(part));
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map((part) => Number(part));

  if ([year, month, day, hour, minute, second].some((part) => Number.isNaN(part))) {
    return null;
  }

  return { year, month, day, hour, minute, second };
}

function getCurrentLocalDateTimeParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };
}

function formatLocalDateTimeParts(parts) {
  if (!parts) return "";
  const pad = (number) => String(number).padStart(2, "0");
  const year = String(parts.year).padStart(4, "0");
  return `${year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function formatTriggerLabel(parts) {
  if (!parts) return "Select date and time";
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(parts.day)} ${MONTHS[parts.month - 1]} ${parts.year}, ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function normalizeViewMonth(parts) {
  if (!parts) {
    const now = getCurrentLocalDateTimeParts();
    return { year: now.year, month: now.month };
  }
  return { year: parts.year, month: parts.month };
}

function getCalendarGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const leadingBlankDays = (firstDay.getDay() + 6) % 7;
  const cells = [];

  for (let index = 0; index < leadingBlankDays; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ year, month, day });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function isSameCalendarDay(left, right) {
  if (!left || !right) return false;
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export default function DateTimeCalendar({
  value = "",
  onChange,
  disabled = false,
  className = "",
  placeholder = "Select date and time",
  allowSeconds = true,
  density = "compact",
  maxPopoverWidth = 360,
  minYear = 1970,
  maxYear = 2099,
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeSelector, setActiveSelector] = useState(null);
  const [draft, setDraft] = useState(() => parseLocalDateTimeParts(value) || getCurrentLocalDateTimeParts());
  const [viewMonth, setViewMonth] = useState(() => normalizeViewMonth(parseLocalDateTimeParts(value)));

  useEffect(() => {
    const parsed = parseLocalDateTimeParts(value);
    if (parsed) {
      setDraft(parsed);
      setViewMonth(normalizeViewMonth(parsed));
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const onDocKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const parsed = parseLocalDateTimeParts(value) || getCurrentLocalDateTimeParts();
    setDraft(parsed);
    setViewMonth(normalizeViewMonth(parsed));
  }, [isOpen, value]);

  const triggerLabel = formatTriggerLabel(parseLocalDateTimeParts(value));
  const calendarCells = getCalendarGrid(viewMonth.year, viewMonth.month);
  const todayParts = getCurrentLocalDateTimeParts();
  const availableYears = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    availableYears.push(year);
  }

  const emitChange = (nextDraft) => {
    setDraft(nextDraft);
    onChange?.(formatLocalDateTimeParts(nextDraft));
  };

  const onSelectDay = (day) => {
    emitChange({ ...draft, year: viewMonth.year, month: viewMonth.month, day });
  };

  const onChangeTime = (field, rawValue) => {
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return;
    emitChange({ ...draft, [field]: numericValue });
  };

  const moveMonth = (delta) => {
    const nextDate = new Date(viewMonth.year, viewMonth.month - 1 + delta, 1);
    setViewMonth({ year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 });
    setActiveSelector(null);
  };

  const selectMonth = (month) => {
    setViewMonth((current) => ({ year: current.year, month }));
    setActiveSelector(null);
  };

  const selectYear = (year) => {
    setViewMonth((current) => ({ year, month: current.month }));
    setActiveSelector(null);
  };

  const resetToToday = () => {
    emitChange(getCurrentLocalDateTimeParts());
    const now = getCurrentLocalDateTimeParts();
    setViewMonth({ year: now.year, month: now.month });
  };

  return (
    <div
      className={`dtc${density === "compact" ? " dtc--compact" : ""}${className ? ` ${className}` : ""}`.trim()}
      ref={rootRef}
      style={{ "--dtc-popover-max-width": `${maxPopoverWidth}px` }}
    >
      <button
        type="button"
        className="dtc__trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={`dtc__trigger-value${value ? "" : " dtc__trigger-value--placeholder"}`}>
          {value ? triggerLabel : placeholder}
        </span>
        <span className="dtc__trigger-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div className="dtc__popover" role="dialog" aria-label="Select date and time">
          <div className="dtc__popover-head">
            <button type="button" className="dtc__nav-btn" onClick={() => moveMonth(-1)} aria-label="Previous month">
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M9 11 5 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="dtc__selector-group">
              <div className="dtc__selector-wrap">
                <button
                  type="button"
                  className="dtc__selector-btn"
                  onClick={() => setActiveSelector((current) => (current === "month" ? null : "month"))}
                  aria-haspopup="listbox"
                  aria-expanded={activeSelector === "month"}
                >
                  {MONTHS[viewMonth.month - 1]}
                  <span aria-hidden="true">▾</span>
                </button>
                {activeSelector === "month" ? (
                  <div className="dtc__selector-menu dtc__selector-menu--months" role="listbox" aria-label="Select month">
                    {MONTHS.map((monthName, index) => {
                      const month = index + 1;
                      const isActive = month === viewMonth.month;
                      return (
                        <button
                          key={monthName}
                          type="button"
                          className={`dtc__selector-item${isActive ? " is-active" : ""}`}
                          onClick={() => selectMonth(month)}
                          role="option"
                          aria-selected={isActive}
                        >
                          {monthName}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="dtc__selector-wrap">
                <button
                  type="button"
                  className="dtc__selector-btn"
                  onClick={() => setActiveSelector((current) => (current === "year" ? null : "year"))}
                  aria-haspopup="listbox"
                  aria-expanded={activeSelector === "year"}
                >
                  {viewMonth.year}
                  <span aria-hidden="true">▾</span>
                </button>
                {activeSelector === "year" ? (
                  <div className="dtc__selector-menu dtc__selector-menu--years" role="listbox" aria-label="Select year">
                    {availableYears.map((year) => {
                      const isActive = year === viewMonth.year;
                      return (
                        <button
                          key={year}
                          type="button"
                          className={`dtc__selector-item${isActive ? " is-active" : ""}`}
                          onClick={() => selectYear(year)}
                          role="option"
                          aria-selected={isActive}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            <button type="button" className="dtc__nav-btn" onClick={() => moveMonth(1)} aria-label="Next month">
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="dtc__weekdays" aria-hidden="true">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="dtc__grid" role="grid" aria-label="Calendar days">
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return <span key={`empty-${index}`} className="dtc__day dtc__day--empty" aria-hidden="true" />;
              }

              const selected = isSameCalendarDay(cell, draft);
              const current = isSameCalendarDay(cell, todayParts);

              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}`}
                  type="button"
                  className={`dtc__day${selected ? " is-selected" : ""}${current ? " is-current" : ""}`}
                  onClick={() => onSelectDay(cell.day)}
                  aria-pressed={selected}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="dtc__time-row">
            <label className="dtc__time-field">
              <span>Hour</span>
              <input
                type="number"
                min="0"
                max="23"
                step="1"
                value={draft.hour}
                onChange={(event) => onChangeTime("hour", event.target.value)}
                className="dtc__time-input"
              />
            </label>
            <label className="dtc__time-field">
              <span>Minute</span>
              <input
                type="number"
                min="0"
                max="59"
                step="1"
                value={draft.minute}
                onChange={(event) => onChangeTime("minute", event.target.value)}
                className="dtc__time-input"
              />
            </label>
            {allowSeconds ? (
              <label className="dtc__time-field">
                <span>Second</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  value={draft.second}
                  onChange={(event) => onChangeTime("second", event.target.value)}
                  className="dtc__time-input"
                />
              </label>
            ) : null}
          </div>

          <div className="dtc__actions">
            <button type="button" className="dtc__action-btn" onClick={resetToToday}>
              Today
            </button>
            <button type="button" className="dtc__action-btn dtc__action-btn--primary" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
