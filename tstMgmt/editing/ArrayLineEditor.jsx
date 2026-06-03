import { useRef, useState } from "react";

export default function ArrayLineEditor({ value, onChange, error, label }) {
  const [expandedByIndex, setExpandedByIndex] = useState({});
  const items = Array.isArray(value) && value.length > 0 ? value : [""];
  const COLLAPSED_HEIGHT_PX = 42;
  const textareaRefs = useRef({});

  const updateItem = (index, nextValue) => {
    const next = [...items];
    next[index] = nextValue;
    onChange(next);
  };

  const removeItem = (index) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.length ? next : [""]);
  };

  const addItem = () => {
    onChange([...items, ""]);
  };

  const toggleExpand = (index) => {
    setExpandedByIndex((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));

    const textarea = textareaRefs.current[index];
    if (textarea) {
      textarea.style.height = "";
    }
  };

  const syncExpandedFromResize = (index, event) => {
    const nextExpanded = event.currentTarget.offsetHeight > COLLAPSED_HEIGHT_PX;
    setExpandedByIndex((prev) => ({
      ...prev,
      [index]: nextExpanded,
    }));
  };

  return (
    <div className="fp__line-editor-wrap">
      <div className="fp__line-editor">
        {items.map((item, index) => (
          <div className="fp__line-editor-row" key={`${label}-${index}`}>
            <div className="fp__line-editor-input-shell">
              <textarea
                ref={(el) => {
                  if (el) {
                    textareaRefs.current[index] = el;
                  }
                }}
                className={`fp__line-editor-input fp__line-editor-textarea${expandedByIndex[index] ? " fp__line-editor-textarea--expanded" : ""}${error ? " fp__line-editor-input--error" : ""}`}
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                onMouseUp={(e) => syncExpandedFromResize(index, e)}
                placeholder={`Enter ${label.toLowerCase()} ${index + 1}`}
                rows={expandedByIndex[index] ? 4 : 1}
              />
              <button
                type="button"
                className="fp__line-editor-icon-toggle"
                onClick={() => toggleExpand(index)}
                title={expandedByIndex[index] ? "Collapse" : "Expand"}
                aria-label={`${expandedByIndex[index] ? "Collapse" : "Expand"} ${label} line ${index + 1}`}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {expandedByIndex[index] ? (
                    <>
                      <path d="m14 10 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 10h-6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="m3 21 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 14h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  ) : (
                    <>
                      <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="m21 3-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="m3 21 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 21H3v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
            <div className="fp__line-editor-row-actions">
              <button
                type="button"
                className="fp__line-editor-btn fp__line-editor-btn--danger fp__line-editor-btn--icon fp__tooltip-target"
                onClick={() => removeItem(index)}
                data-tooltip="Remove line"
                aria-label={`Remove ${label} line ${index + 1}`}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="fp__remove-icon-circle" cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path className="fp__remove-icon-cross" d="m15 9-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path className="fp__remove-icon-cross" d="m9 9 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="fp__line-editor-btn fp__line-editor-btn--icon fp__line-editor-btn--add-icon fp__tooltip-target"
        onClick={addItem}
        data-tooltip="Add line"
        aria-label={`Add ${label} line`}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="fp__add-icon-circle" cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path className="fp__add-icon-plus" d="M8 12h8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path className="fp__add-icon-plus" d="M12 8v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="fp__line-editor-add-text">Add New</span>
      </button>
      {error && <span className="dt__field-error">{error}</span>}
    </div>
  );
}
