import { useEffect, useMemo, useRef, useState } from "react";
import "./MultiSelectDropdown.css";

export default function MultiSelectDropdown({
  label,
  placeholder = "Select",
  options = [],
  selected = [],
  onChange,
  allowCustom = false,
  showSearchInput = true,
  showClearButton = true,
  showNoOptionsLabel = true,
  searchPlaceholder = "Search",
  noOptionsText = "No options",
  clearText = "Clear",
  addText = "Add",
  customPlaceholder = "Add free text",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customText, setCustomText] = useState("");
  const panelRef = useRef(null);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!panelRef.current) {
        return;
      }
      if (!panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggleOption = (value) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  };

  const addCustom = () => {
    const value = customText.trim();
    if (!value) {
      return;
    }
    if (!selectedSet.has(value)) {
      onChange([...selected, value]);
    }
    setCustomText("");
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={`msd-filter ${className}`} ref={panelRef}>
      <label className="msd-filter-label">{label}</label>
      <button
        type="button"
        className="msd-filter-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
        <span className="msd-trigger-chevron">▾</span>
      </button>

      {isOpen ? (
        <div className="msd-filter-popover">
          {showSearchInput || showClearButton ? (
            <div className="msd-filter-popover-head">
              {showSearchInput ? (
                <input
                  className="msd-search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  type="text"
                />
              ) : null}
              {showClearButton ? (
                <button type="button" className="msd-clear-btn" onClick={clearAll}>
                  {clearText}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="msd-filter-options" role="listbox" aria-multiselectable="true">
            {filteredOptions.length === 0 ? (
              showNoOptionsLabel ? <div className="msd-empty-row">{noOptionsText}</div> : null
            ) : (
              filteredOptions.map((option) => (
                <label key={option} className="msd-option-row" role="option" aria-selected={selectedSet.has(option)}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option)}
                    onChange={() => toggleOption(option)}
                  />
                  <span>{option}</span>
                </label>
              ))
            )}
          </div>

          {allowCustom ? (
            <div className="msd-custom-entry">
              <input
                className="msd-search-input"
                value={customText}
                onChange={(event) => setCustomText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
                placeholder={customPlaceholder}
                type="text"
              />
              <button type="button" className="msd-add-btn" onClick={addCustom}>
                {addText}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="msd-filter-tags">
          {selected.map((item) => (
            <button
              key={item}
              type="button"
              className="msd-filter-tag"
              onClick={() => onChange(selected.filter((x) => x !== item))}
            >
              {item} ×
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
