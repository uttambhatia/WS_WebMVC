import { useEffect, useState } from "react";
import "./InlineFullscreenPanel.css";

function MaximizeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 10L6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 10L18 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 14L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 14L18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 9V6H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 9V6H15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 15V18H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 15V18H15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* top-left: line from corner inward + arrowhead pointing toward center */}
      <path d="M5 5L10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 10L10 10L10 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* top-right: line from corner inward + arrowhead pointing toward center */}
      <path d="M19 5L14 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 10L14 10L14 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom-left: line from corner inward + arrowhead pointing toward center */}
      <path d="M5 19L10 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14L10 14L10 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom-right: line from corner inward + arrowhead pointing toward center */}
      <path d="M19 19L14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 14L14 14L14 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InlineFullscreenPanel({
  isOpen,
  title,
  children,
  onBack,
  backLabel = "Back",
  enableFullscreenToggle = false,
  compact = false,
  className = "",
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isFullscreen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isFullscreen]);

  useEffect(() => {
    if (!isOpen || !isFullscreen || !enableFullscreenToggle) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullscreen, enableFullscreenToggle]);

  if (!isOpen) {
    return null;
  }

  return (
    <section
      className={`ifs-panel ${isFullscreen ? "ifs-panel--fullscreen" : ""} ${className}`.trim()}
      aria-label={typeof title === "string" ? title : "Inline panel"}
    >
      <header className={`ifs-panel__header${compact ? " ifs-panel__header--compact" : ""}`}>
        <button
          type="button"
          className="ifs-panel__back-btn"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </button>

        <div className="ifs-panel__header-right">
          {title ? <div className="ifs-panel__title">{title}</div> : null}
          {enableFullscreenToggle ? (
            <button
              type="button"
              className={`ifs-panel__toggle-btn ${isFullscreen ? "ifs-panel__toggle-btn--active" : ""}`.trim()}
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? "Minimize" : "Maximize"}
              aria-label={isFullscreen ? "Minimize panel" : "Maximize panel"}
            >
              {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
            </button>
          ) : null}
        </div>
      </header>

      <div className="ifs-panel__body">{children}</div>
    </section>
  );
}
