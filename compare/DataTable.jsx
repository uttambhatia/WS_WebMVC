/**
 * DataTable — responsive sortable, filterable, paginated data table.
 *
 * Props:
 *   columns            {Array<{key: string, label: string, width?: string, truncate?: number, verticalAlign?: string}>}  Column definitions.
 *                        width:         optional percentage width, e.g. "20%". Omit to let the browser size automatically.
 *                        truncate:      max character length before showing "more…" / "less…" toggle. Only applies to plain-text cells (no render fn).
 *                        verticalAlign: CSS vertical-align value for all cells in this column, e.g. "top".
 *   data               {Array<Object>}                        Row data (client mode).
 *   pageSize           {number}                               Rows per page (default: 10).
 *   pageSizeOptions    {number[]}                             Enables a per-page selector with these choices. Omit or pass [] to disable (default: disabled).
 *   sortableColumns    {string[]}                             Keys of sortable columns.
 *   searchableColumns  {string[]}                             Keys of searchable columns.
 *   serverSide         {boolean}                              Enable server-side mode.
 *   service            {async fn(params) → {data, total}}    Required when serverSide=true.
 *   downloadExcel      {boolean}                              Show Excel download button.
 *   loading            {boolean}                              External loading override.
 *   paginationPlacement {"top"|"bottom"|"both"}              Where to render the pagination bar (default: "bottom").
 *   className          {string}
 *
 * Server-side params shape:
 *   { page: number, pageSize: number,
 *     sort: Array<{key, dir: 'asc'|'desc'}>,
 *     filters: Object<key, string> }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./DataTable.css";

/* ---- Icons ---- */
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2v7m0 0-3-3m3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="dt__page-arrow" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 11 5 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="dt__page-arrow" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SpinnerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42 14"/>
    </svg>
  );
}

/* ---- Sort icon ---- */
function SortIcon({ dir }) {
  return (
    <span className="dt__sort-icon" aria-hidden="true">
      <span className={`dt__sort-arrow dt__sort-arrow--up${dir === "asc" ? " dt__sort-arrow--active" : ""}`} />
      <span className={`dt__sort-arrow dt__sort-arrow--down${dir === "desc" ? " dt__sort-arrow--active" : ""}`} />
    </span>
  );
}

/* ---- Truncated text cell ---- */
function TruncatedText({ value, limit }) {
  const [expanded, setExpanded] = useState(false);
  const text = value == null ? "" : String(value);
  if (text.length <= limit) return <>{text}</>;
  return expanded ? (
    <>{text}{" "}<button type="button" className="dt__toggle-text" onClick={() => setExpanded(false)}>less...</button></>
  ) : (
    <>{text.slice(0, limit).trimEnd()}&hellip;{" "}<button type="button" className="dt__toggle-text" onClick={() => setExpanded(true)}>more...</button></>
  );
}

/* ---- Helpers ---- */
function cellValue(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function buildEmptyRow(columns, createEmptyRow) {
  if (typeof createEmptyRow === "function") {
    return { ...createEmptyRow() };
  }

  return columns.reduce((acc, col) => {
    acc[col.key] = col.defaultValue ?? "";
    return acc;
  }, {});
}

function normalizeEditedValue(column, value) {
  if (typeof column.parseEditValue === "function") {
    return column.parseEditValue(value);
  }

  if (column.editType === "checkbox") {
    return Boolean(value);
  }

  if (column.editType === "number") {
    if (value === "") return "";
    return Number(value);
  }

  return value;
}

function validateRowDraft(columns, draftRow, currentRow) {
  return columns.reduce((errors, col) => {
    if (col.editable === false) {
      return errors;
    }

    const value = draftRow[col.key];
    if (col.required) {
      const isEmpty = col.editType === "checkbox"
        ? value !== true
        : value == null || String(value).trim() === "";
      if (isEmpty) {
        errors[col.key] = col.editType === "checkbox"
          ? `${col.label} must be checked.`
          : `${col.label} is required.`;
        return errors;
      }
    }

    if (typeof col.validate === "function") {
      const message = col.validate(value, draftRow, currentRow);
      if (message) {
        errors[col.key] = message;
      }
    }

    return errors;
  }, {});
}

function createInternalRows(rows, rowKey) {
  return (rows || []).map((row, index) => ({
    internalId: `existing-${String(row?.[rowKey] ?? index)}-${index}`,
    row: { ...row },
    draft: { ...row },
    isEditing: false,
    isNew: false,
    errors: {},
    actionError: "",
    pendingAction: "",
  }));
}

function toCommittedPublicRows(items) {
  return items
    .filter((item) => !item.isNew)
    .map((item) => ({ ...item.row }));
}

function getEditableDisplayRow(item) {
  return item.isEditing ? item.draft : item.row;
}

function filterEditableRows(items, filters) {
  const pinned = items.filter((item) => item.isNew);
  const rest = items.filter((item) => !item.isNew);
  const filtered = rest.filter((item) =>
    Object.entries(filters).every(([key, term]) => {
      if (!term) return true;
      return cellValue(getEditableDisplayRow(item), key).toLowerCase().includes(term.toLowerCase());
    })
  );
  return [...pinned, ...filtered];
}

function sortEditableRows(items, sort) {
  const pinned = items.filter((item) => item.isNew);
  const rest = items.filter((item) => !item.isNew);
  if (!sort.length) {
    return [...pinned, ...rest];
  }

  const sorted = [...rest].sort((a, b) => {
    const rowA = getEditableDisplayRow(a);
    const rowB = getEditableDisplayRow(b);
    for (const { key, dir } of sort) {
      const av = cellValue(rowA, key).toLowerCase();
      const bv = cellValue(rowB, key).toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (cmp !== 0) {
        return dir === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  });

  return [...pinned, ...sorted];
}

function applyClientFilters(data, filters) {
  return data.filter((row) =>
    Object.entries(filters).every(([key, term]) => {
      if (!term) return true;
      return cellValue(row, key).toLowerCase().includes(term.toLowerCase());
    })
  );
}

function applyClientSort(data, sort) {
  if (!sort.length) return data;
  return [...data].sort((a, b) => {
    for (const { key, dir } of sort) {
      const av = cellValue(a, key).toLowerCase();
      const bv = cellValue(b, key).toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

function downloadAsExcel(rows, columns, filename = "export") {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = row[c.key];
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return v.join(", ");
      return v;
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ---- Component ---- */
export default function DataTable({
  columns = [],
  data = [],
  pageSize: defaultPageSize = 10,
  pageSizeOptions = [],
  sortableColumns = [],
  searchableColumns = [],
  serverSide = false,
  service,
  downloadExcel = false,
  loading: externalLoading = false,
  paginationPlacement = "bottom",
  className = "",
  editable = false,
  editableOptions = {},
  selection = null,
}) {
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState([]); // [{key, dir}]
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const editableEnabled = editable && !serverSide;
  const {
    rowKey = "id",
    actionColumnLabel = "Edit Option",
    addActionLabel = "+ Add",
    editActionLabel = "Edit",
    saveActionLabel = "Save",
    removeActionLabel = "- Remove",
    createEmptyRow,
    confirmRemoveMessage = "Are you sure you want to remove this row?",
    onEditRow,
    onSaveRow,
    onRemoveRow,
    onRowsChange,
  } = editableOptions;
  const selectionEnabled = Boolean(selection?.enabled);
  const selectionRowKey = selection?.rowKey || rowKey;
  const selectedRowIds = selection?.selectedRowIds || [];
  const isRowSelectable = typeof selection?.isRowSelectable === "function"
    ? selection.isRowSelectable
    : () => true;
  const maxSelectable = Number.isFinite(selection?.maxSelectable)
    ? selection.maxSelectable
    : Number.POSITIVE_INFINITY;
  const onSelectedRowIdsChange = typeof selection?.onSelectedRowIdsChange === "function"
    ? selection.onSelectedRowIdsChange
    : null;
  const newRowCounterRef = useRef(0);
  const [editableRows, setEditableRows] = useState(() => createInternalRows(data, rowKey));

  // Server-side state
  const [serverData, setServerData] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverLoading, setServerLoading] = useState(false);
  const abortRef = useRef(null);

  /* ---- Server-side fetch ---- */
  const fetchServerData = useCallback(async () => {
    if (!serverSide || !service) return;
    abortRef.current?.();
    let cancelled = false;
    abortRef.current = () => { cancelled = true; };

    setServerLoading(true);
    try {
      const params = { page, pageSize, sort, filters };
      const result = await service(params);
      if (!cancelled) {
        setServerData(Array.isArray(result?.data) ? result.data : []);
        setServerTotal(typeof result?.total === "number" ? result.total : 0);
      }
    } catch (_) {
      if (!cancelled) { setServerData([]); setServerTotal(0); }
    } finally {
      if (!cancelled) setServerLoading(false);
    }
  }, [serverSide, service, page, pageSize, sort, filters]);

  useEffect(() => {
    if (serverSide) fetchServerData();
  }, [fetchServerData, serverSide]);

  useEffect(() => {
    if (!editableEnabled) {
      return;
    }

    setEditableRows((prev) => {
      const pendingNewRows = (prev || []).filter((item) => item.isNew);
      const editingRowsByKey = new Map(
        (prev || [])
          .filter((item) => !item.isNew && item.isEditing)
          .map((item) => [String(item.row?.[rowKey] ?? ""), item])
      );

      const syncedRows = createInternalRows(data, rowKey).map((item) => {
        const existingEditing = editingRowsByKey.get(String(item.row?.[rowKey] ?? ""));
        return existingEditing || item;
      });

      return [...pendingNewRows, ...syncedRows];
    });
  }, [data, editableEnabled, rowKey]);

  /* Reset page when filters/sort/pageSize change */
  useEffect(() => { setPage(1); }, [filters, sort, pageSize]);

  /* Sync pageSize when defaultPageSize prop changes */
  useEffect(() => { setPageSize(defaultPageSize); }, [defaultPageSize]);

  const updateEditableRows = useCallback((updater) => {
    setEditableRows((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const commitEditableRows = useCallback((updater) => {
    setEditableRows((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (typeof onRowsChange === "function") {
        onRowsChange(toCommittedPublicRows(next));
      }
      return next;
    });
  }, [onRowsChange]);

  const updateRowState = useCallback((internalId, updater) => {
    updateEditableRows((prev) => prev.map((item) => (
      item.internalId === internalId ? updater(item) : item
    )));
  }, [updateEditableRows]);

  const runRowService = useCallback(async (serviceFn, payload) => {
    if (typeof serviceFn !== "function") {
      return null;
    }
    return serviceFn(payload);
  }, []);

  const handleAddRow = useCallback(() => {
    const blankRow = buildEmptyRow(columns, createEmptyRow);
    const internalId = `new-${newRowCounterRef.current++}`;
    updateEditableRows((prev) => ([{
      internalId,
      row: { ...blankRow },
      draft: { ...blankRow },
      isEditing: true,
      isNew: true,
      errors: {},
      actionError: "",
      pendingAction: "",
    }, ...prev]));
    setPage(1);
  }, [columns, createEmptyRow, updateEditableRows]);

  const handleDraftChange = useCallback((internalId, key, value) => {
    updateRowState(internalId, (item) => ({
      ...item,
      draft: { ...item.draft, [key]: value },
      errors: { ...item.errors, [key]: "" },
      actionError: "",
    }));
  }, [updateRowState]);

  const handleEdit = useCallback(async (item) => {
    updateRowState(item.internalId, (current) => ({ ...current, pendingAction: "edit", actionError: "" }));

    try {
      const result = await runRowService(onEditRow, { row: { ...item.row }, isNew: item.isNew });
      const nextDraft = result && typeof result === "object" ? { ...item.row, ...result } : { ...item.row };
      updateRowState(item.internalId, (current) => ({
        ...current,
        row: { ...nextDraft },
        draft: { ...nextDraft },
        isEditing: true,
        errors: {},
        actionError: "",
        pendingAction: "",
      }));
    } catch (error) {
      updateRowState(item.internalId, (current) => ({
        ...current,
        pendingAction: "",
        actionError: error?.message || "Edit action failed.",
      }));
    }
  }, [onEditRow, runRowService, updateRowState]);

  const handleSave = useCallback(async (item) => {
    const validationErrors = validateRowDraft(columns, item.draft, item.row);
    if (Object.keys(validationErrors).length > 0) {
      updateRowState(item.internalId, (current) => ({
        ...current,
        errors: validationErrors,
        actionError: "Please correct the highlighted fields.",
      }));
      return;
    }

    updateRowState(item.internalId, (current) => ({ ...current, pendingAction: "save", actionError: "" }));

    try {
      const payloadRow = columns.reduce((acc, col) => {
        acc[col.key] = item.draft[col.key];
        return acc;
      }, {});
      const result = await runRowService(onSaveRow, {
        row: payloadRow,
        previousRow: { ...item.row },
        isNew: item.isNew,
      });
      const nextRow = result && typeof result === "object" ? result : payloadRow;
      commitEditableRows((prev) => (
        prev.map((current) => (
          current.internalId === item.internalId
            ? {
                ...current,
                row: { ...nextRow },
                draft: { ...nextRow },
                isEditing: false,
                isNew: false,
                errors: {},
                actionError: "",
                pendingAction: "",
              }
            : current
        ))
      ));
    } catch (error) {
      updateRowState(item.internalId, (current) => ({
        ...current,
        pendingAction: "",
        actionError: error?.message || "Save action failed.",
      }));
    }
  }, [columns, commitEditableRows, onSaveRow, runRowService, updateRowState]);

  const handleRemove = useCallback(async (item) => {
    if (!window.confirm(confirmRemoveMessage)) {
      return;
    }

    updateRowState(item.internalId, (current) => ({ ...current, pendingAction: "remove", actionError: "" }));

    try {
      await runRowService(onRemoveRow, { row: { ...item.row }, isNew: item.isNew });
      commitEditableRows((prev) => prev.filter((current) => current.internalId !== item.internalId));
    } catch (error) {
      updateRowState(item.internalId, (current) => ({
        ...current,
        pendingAction: "",
        actionError: error?.message || "Remove action failed.",
      }));
    }
  }, [commitEditableRows, confirmRemoveMessage, onRemoveRow, runRowService, updateRowState]);

  /* ---- Client-side derived data ---- */
  const clientSource = useMemo(() => {
    if (editableEnabled) {
      const pinned = editableRows.filter((item) => item.isNew);
      const rest = editableRows.filter((item) => !item.isNew);
      return [...pinned, ...rest];
    }
    return data;
  }, [data, editableEnabled, editableRows]);

  const clientFiltered = useMemo(() => {
    if (serverSide) return serverData;
    if (!editableEnabled) {
      return applyClientFilters(clientSource, filters);
    }
    return filterEditableRows(clientSource, filters);
  }, [serverSide, serverData, editableEnabled, clientSource, filters]);

  const clientSorted = useMemo(() => {
    if (serverSide) return clientFiltered;
    if (!editableEnabled) {
      return applyClientSort(clientFiltered, sort);
    }
    return sortEditableRows(clientFiltered, sort);
  }, [serverSide, clientFiltered, sort, editableEnabled]);

  const totalRows = serverSide ? serverTotal : clientSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    if (serverSide) return clientFiltered; // server already paged
    const start = (page - 1) * pageSize;
    return clientSorted.slice(start, start + pageSize);
  }, [serverSide, clientFiltered, clientSorted, page, pageSize]);

  const pageSelectableRowIds = useMemo(() => {
    if (!selectionEnabled) return [];
    return pageRows
      .map((row) => (editableEnabled ? getEditableDisplayRow(row) : row))
      .filter((row) => isRowSelectable(row))
      .map((row, index) => String(row?.[selectionRowKey] ?? `page-row-${index}`));
  }, [selectionEnabled, pageRows, editableEnabled, isRowSelectable, selectionRowKey]);

  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds.map((value) => String(value))),
    [selectedRowIds]
  );

  const selectedPageCount = useMemo(
    () => pageSelectableRowIds.filter((rowId) => selectedRowIdSet.has(rowId)).length,
    [pageSelectableRowIds, selectedRowIdSet]
  );

  const isHeaderChecked = pageSelectableRowIds.length > 0 && selectedPageCount === pageSelectableRowIds.length;
  const isHeaderIndeterminate = selectedPageCount > 0 && selectedPageCount < pageSelectableRowIds.length;

  const toggleRowSelection = useCallback((row, checked) => {
    if (!selectionEnabled || !onSelectedRowIdsChange) return;
    if (!isRowSelectable(row)) return;

    const rowId = String(row?.[selectionRowKey]);
    if (!rowId) return;

    if (checked) {
      if (selectedRowIdSet.has(rowId)) return;
      if (selectedRowIds.length >= maxSelectable) return;
      onSelectedRowIdsChange([...selectedRowIds, rowId]);
      return;
    }

    onSelectedRowIdsChange(selectedRowIds.filter((value) => String(value) !== rowId));
  }, [selectionEnabled, onSelectedRowIdsChange, isRowSelectable, selectionRowKey, selectedRowIdSet, selectedRowIds, maxSelectable]);

  const togglePageSelection = useCallback((checked) => {
    if (!selectionEnabled || !onSelectedRowIdsChange) return;

    if (!checked) {
      onSelectedRowIdsChange(
        selectedRowIds.filter((value) => !pageSelectableRowIds.includes(String(value)))
      );
      return;
    }

    const nextIds = [...selectedRowIds];
    for (const rowId of pageSelectableRowIds) {
      if (nextIds.some((value) => String(value) === rowId)) continue;
      if (nextIds.length >= maxSelectable) break;
      nextIds.push(rowId);
    }
    onSelectedRowIdsChange(nextIds);
  }, [selectionEnabled, onSelectedRowIdsChange, selectedRowIds, pageSelectableRowIds, maxSelectable]);

  /* ---- Sort toggle ---- */
  const toggleSort = (key) => {
    if (!sortableColumns.includes(key)) return;
    setSort((prev) => {
      const existing = prev.find((s) => s.key === key);
      if (!existing) return [...prev, { key, dir: "asc" }];
      if (existing.dir === "asc") return prev.map((s) => s.key === key ? { key, dir: "desc" } : s);
      return prev.filter((s) => s.key !== key);
    });
  };

  const getSortDir = (key) => sort.find((s) => s.key === key)?.dir;

  /* ---- Filter change ---- */
  const setFilter = (key, val) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  /* ---- Excel download ---- */
  const handleDownload = () => {
    const rows = serverSide
      ? clientFiltered
      : editableEnabled
        ? clientSorted.map((item) => getEditableDisplayRow(item))
        : clientSorted;
    downloadAsExcel(rows, columns);
  };

  const isLoading = externalLoading || serverLoading;
  const hasSearchRow = searchableColumns.length > 0;
  const hasPageSizeSelector = pageSizeOptions.length > 1;
  const displayColumns = useMemo(() => (
    [
      ...(selectionEnabled ? [{ key: "__dt_select", label: "", width: "6%", editable: false }] : []),
      ...columns,
      ...(editableEnabled ? [{ key: "__dt_actions", label: actionColumnLabel, width: "16%", editable: false }] : []),
    ]
  ), [actionColumnLabel, columns, editableEnabled, selectionEnabled]);

  const renderEditableCell = (item, col) => {
    const value = item.draft[col.key] ?? "";
    const error = item.errors[col.key];
    const onChange = (nextValue) => handleDraftChange(item.internalId, col.key, normalizeEditedValue(col, nextValue));

    if (typeof col.editRender === "function") {
      return col.editRender({
        column: col,
        value,
        row: item.draft,
        error,
        onChange,
      });
    }

    if (col.editType === "select") {
      return (
        <div className="dt__editor-wrap">
          <select
            className={`dt__editor dt__editor--select${error ? " dt__editor--error" : ""}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select</option>
            {(col.editOptions || []).map((option) => {
              const resolved = typeof option === "string" ? { label: option, value: option } : option;
              return (
                <option key={resolved.value} value={resolved.value}>
                  {resolved.label}
                </option>
              );
            })}
          </select>
          {error && <span className="dt__field-error">{error}</span>}
        </div>
      );
    }

    if (col.editType === "textarea") {
      return (
        <div className="dt__editor-wrap">
          <textarea
            className={`dt__editor dt__editor--textarea${error ? " dt__editor--error" : ""}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={col.editPlaceholder || `Enter ${col.label}`}
            rows={3}
          />
          {error && <span className="dt__field-error">{error}</span>}
        </div>
      );
    }

    if (col.editType === "date") {
      return (
        <div className="dt__editor-wrap">
          <input
            type="date"
            className={`dt__editor dt__editor--date${error ? " dt__editor--error" : ""}`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            max={col.maxDate}
            min={col.minDate}
          />
          {error && <span className="dt__field-error">{error}</span>}
        </div>
      );
    }

    if (col.editType === "checkbox") {
      return (
        <div className="dt__editor-wrap">
          <label className="dt__editor-checkbox-label">
            <input
              type="checkbox"
              className={`dt__editor-checkbox${error ? " dt__editor-checkbox--error" : ""}`}
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{col.checkboxLabel || col.label}</span>
          </label>
          {error && <span className="dt__field-error">{error}</span>}
        </div>
      );
    }

    return (
      <div className="dt__editor-wrap">
        <input
          type={col.editType || "text"}
          className={`dt__editor${error ? " dt__editor--error" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={col.editPlaceholder || `Enter ${col.label}`}
        />
        {error && <span className="dt__field-error">{error}</span>}
      </div>
    );
  };

  const renderActionCell = (item) => {
    const busy = Boolean(item.pendingAction);
    return (
      <div className="dt__row-actions">
        {item.isEditing ? (
          <>
            <button type="button" className="dt__action-btn dt__action-btn--primary" onClick={() => handleSave(item)} disabled={busy}>
              {busy && item.pendingAction === "save" ? "Saving..." : saveActionLabel}
            </button>
            <button type="button" className="dt__action-btn dt__action-btn--danger" onClick={() => handleRemove(item)} disabled={busy}>
              {busy && item.pendingAction === "remove" ? "Removing..." : removeActionLabel}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="dt__action-btn" onClick={() => handleEdit(item)} disabled={busy}>
              {busy && item.pendingAction === "edit" ? "Opening..." : editActionLabel}
            </button>
            <button type="button" className="dt__action-btn dt__action-btn--danger" onClick={() => handleRemove(item)} disabled={busy}>
              {busy && item.pendingAction === "remove" ? "Removing..." : removeActionLabel}
            </button>
          </>
        )}
        {item.actionError && <span className="dt__field-error">{item.actionError}</span>}
      </div>
    );
  };

  const paginationBar = !isLoading && totalRows > 0 ? (
    <div className="dt__pagination">
      <button
        type="button"
        className="dt__page-btn"
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
        Prev
      </button>

      <span className="dt__page-info">
        Page {page} of {totalPages}
        <span style={{ margin: "0 6px", color: "var(--ubs-c-text-faint)" }}>·</span>
        {totalRows} record{totalRows !== 1 ? "s" : ""}
      </span>

      {hasPageSizeSelector && (
        <label className="dt__page-size-label">
          Rows
          <select
            className="dt__page-size-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        className="dt__page-btn"
        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        Next
        <ChevronRightIcon />
      </button>
    </div>
  ) : null;

  const showTop    = paginationPlacement === "top"  || paginationPlacement === "both";
  const showBottom = paginationPlacement === "bottom" || paginationPlacement === "both";

  return (
    <div className={`dt${className ? ` ${className}` : ""}`}>
      {/* Toolbar */}
      {downloadExcel && (
        <div className="dt__toolbar">
          <button
            type="button"
            className="dt__btn"
            onClick={handleDownload}
            disabled={isLoading || totalRows === 0}
            title="Download as Excel"
          >
            <DownloadIcon />
            Download Excel
          </button>
        </div>
      )}

      {showTop && paginationBar}
      <div className="dt__wrap">
        {isLoading ? (
          <div className="dt__loading">
            <SpinnerIcon className="dt__spinner" />
            Loading…
          </div>
        ) : (
          <table className="dt__table" role="grid">
            {displayColumns.some((c) => c.width) && (
              <colgroup>
                {displayColumns.map((col) => (
                  <col key={col.key} style={col.width ? { width: col.width } : undefined} />
                ))}
              </colgroup>
            )}
            <thead className="dt__thead">
              {/* Header row */}
              <tr>
                {displayColumns.map((col) => {
                  const sortable = sortableColumns.includes(col.key);
                  const dir = getSortDir(col.key);
                  return (
                    <th
                      key={col.key}
                      className={`dt__th${sortable ? " dt__th--sortable" : ""}`}
                      scope="col"
                      onClick={sortable ? () => toggleSort(col.key) : undefined}
                      aria-sort={dir ? (dir === "asc" ? "ascending" : "descending") : undefined}
                      tabIndex={sortable ? 0 : undefined}
                      onKeyDown={sortable ? (e) => { if (e.key === "Enter") toggleSort(col.key); } : undefined}
                    >
                      {selectionEnabled && col.key === "__dt_select" ? (
                        <input
                          type="checkbox"
                          className="dt__selection-checkbox"
                          checked={isHeaderChecked}
                          ref={(node) => {
                            if (node) node.indeterminate = isHeaderIndeterminate;
                          }}
                          onChange={(e) => togglePageSelection(e.target.checked)}
                          disabled={pageSelectableRowIds.length === 0}
                          aria-label="Select rows on current page"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : editableEnabled && col.key === "__dt_actions" ? (
                        <button type="button" className="dt__action-btn dt__action-btn--ghost" onClick={handleAddRow}>
                          {addActionLabel}
                        </button>
                      ) : (
                        <span className="dt__th-inner">
                          {col.label}
                          {sortable && <SortIcon dir={dir} />}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>

              {/* Search row */}
              {hasSearchRow && (
                <tr className="dt__search-row">
                  {displayColumns.map((col) => (
                    <th key={col.key} className="dt__th" scope="col">
                      {searchableColumns.includes(col.key) ? (
                        <input
                          type="text"
                          className="dt__search-input"
                          placeholder={`Filter ${col.label}…`}
                          value={filters[col.key] ?? ""}
                          onChange={(e) => setFilter(col.key, e.target.value)}
                          aria-label={`Filter by ${col.label}`}
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody className="dt__tbody">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length} className="dt__empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, ri) => {
                  const item = editableEnabled ? row : null;
                  const displayRow = editableEnabled ? getEditableDisplayRow(item) : row;
                  return (
                  <tr key={editableEnabled ? item.internalId : ri}>
                    {selectionEnabled && (
                      <td className="dt__td dt__td--selection">
                        <input
                          type="checkbox"
                          className="dt__selection-checkbox"
                          checked={selectedRowIdSet.has(String(displayRow?.[selectionRowKey]))}
                          disabled={!isRowSelectable(displayRow) || (!selectedRowIdSet.has(String(displayRow?.[selectionRowKey])) && selectedRowIds.length >= maxSelectable)}
                          onChange={(e) => toggleRowSelection(displayRow, e.target.checked)}
                          aria-label={`Select row ${String(displayRow?.[selectionRowKey] ?? ri + 1)}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="dt__td"
                        style={col.verticalAlign ? { verticalAlign: col.verticalAlign } : undefined}>
                        {editableEnabled && item.isEditing && col.editable !== false
                          ? renderEditableCell(item, col)
                          : col.render
                            ? col.render(displayRow[col.key], displayRow)
                            : col.truncate
                              ? <TruncatedText value={displayRow[col.key]} limit={col.truncate} />
                              : (displayRow[col.key] ?? "—")}
                      </td>
                    ))}
                    {editableEnabled && (
                      <td className="dt__td dt__td--actions">
                        {renderActionCell(item)}
                      </td>
                    )}
                  </tr>
                );})
              )}
            </tbody>
          </table>
        )}
      </div>

      {showBottom && paginationBar}
    </div>
  );
}
