import { useCallback, useEffect, useRef, useState } from "react";
import DataTable from "../DataTable/DataTable";
import InlineFullscreenPanel from "../shared/InlineFullscreenPanel";
import {
  approveContract,
  createContract,
  downloadContract,
  fetchContractAudit,
  rejectContract,
  searchContracts,
  submitContractForReview,
  uploadContractsExcel,
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

const GOVERNING_BASE_COLUMN_DEFS = [
  { key: "applicable", label: "Applicable" },
  { key: "accuracy", label: "Accuracy" },
  { key: "snippet", label: "Snippet" },
  { key: "page", label: "Page" },
  { key: "country", label: "Country" },
];

const JURISDICTION_BASE_COLUMN_DEFS = [
  { key: "applicable", label: "Applicable" },
  { key: "accuracy", label: "Accuracy" },
  { key: "snippet", label: "Snippet" },
  { key: "page", label: "Page" },
  { key: "risk", label: "Risk" },
  { key: "reasoning", label: "Reasoning" },
];

const BASE_LAW_COLUMN_DEFS = GOVERNING_BASE_COLUMN_DEFS;

const GOVERNING_BASE_KEYS = GOVERNING_BASE_COLUMN_DEFS.map((column) => column.key);
const JURISDICTION_BASE_KEYS = JURISDICTION_BASE_COLUMN_DEFS.map((column) => column.key);
const GOVERNING_SECTION_NAME = "Governing Law";
const JURISDICTION_SECTION_NAME = "Jurisdiction";

const BASE_LAW_KEYS = BASE_LAW_COLUMN_DEFS.map((column) => column.key);

function humanizeColumnLabel(key) {
  return String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function toLawColumnKey(label) {
  const normalized = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "column";
}

function normalizeDynamicColumns(rawColumns, rows, baseKeys) {
  const explicit = Array.isArray(rawColumns)
    ? rawColumns
        .map((column) => {
          const label = typeof column === "string" ? column : column?.label || column?.name || column?.key || "";
          const key = typeof column === "string" ? toLawColumnKey(column) : toLawColumnKey(column?.key || label);
          if (!label || !key || baseKeys.includes(key)) {
            return null;
          }
          return { key, label: String(label).trim() };
        })
        .filter(Boolean)
    : [];

  if (explicit.length) {
    return explicit;
  }

  const derived = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== "object") {
      return;
    }
    Object.keys(row).forEach((key) => {
      if (baseKeys.includes(key) || derived.some((column) => column.key === key)) {
        return;
      }
      derived.push({ key, label: humanizeColumnLabel(key) || key });
    });
  });
  return derived;
}

function emptyGoverningLaw(columns = []) {
  const row = {
    applicable: "",
    accuracy: "",
    snippet: "",
    page: "",
    country: "",
  };
  columns.forEach((column) => {
    row[column.key] = "";
  });
  return row;
}

function emptyJurisdiction(columns = []) {
  const row = {
    applicable: "",
    accuracy: "",
    snippet: "",
    page: "",
    risk: "",
    reasoning: "",
  };
  columns.forEach((column) => {
    row[column.key] = "";
  });
  return row;
}

function normalizeGoverningLaw(item, columns = []) {
  const row = emptyGoverningLaw(columns);
  if (!item || typeof item !== "object") {
    return row;
  }

  Object.keys(item).forEach((key) => {
    row[key] = item[key] || "";
  });
  columns.forEach((column) => {
    if (!(column.key in row)) {
      row[column.key] = "";
    }
  });
  return row;
}

function normalizeJurisdiction(item, columns = []) {
  const row = emptyJurisdiction(columns);
  if (!item || typeof item !== "object") {
    return row;
  }

  Object.keys(item).forEach((key) => {
    row[key] = item[key] || "";
  });
  columns.forEach((column) => {
    if (!(column.key in row)) {
      row[column.key] = "";
    }
  });
  return row;
}

function normalizeLawColumns(item, rows) {
  const explicit = Array.isArray(item?.columns)
    ? item.columns
        .map((column) => {
          const label = typeof column === "string" ? column : column?.label || column?.name || column?.key || "";
          const key = typeof column === "string" ? toLawColumnKey(column) : toLawColumnKey(column?.key || label);
          if (!label || !key || BASE_LAW_KEYS.includes(key)) {
            return null;
          }
          return { key, label: String(label).trim() };
        })
        .filter(Boolean)
    : [];

  if (explicit.length) {
    return explicit;
  }

  const derived = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== "object") {
      return;
    }
    Object.keys(row).forEach((key) => {
      if (BASE_LAW_KEYS.includes(key) || derived.some((column) => column.key === key)) {
        return;
      }
      derived.push({ key, label: key });
    });
  });
  return derived;
}

function emptyLawRow(columns = []) {
  const row = emptyGoverningLaw();
  columns.forEach((column) => {
    row[column.key] = "";
  });
  return row;
}

function normalizeLawRow(item, columns = []) {
  const row = normalizeGoverningLaw(item);
  if (item && typeof item === "object") {
    columns.forEach((column) => {
      row[column.key] = item[column.key] || "";
    });
  } else {
    columns.forEach((column) => {
      row[column.key] = "";
    });
  }
  return row;
}

function emptyLawSection(name = "") {
  const columns = [];
  return {
    name,
    columns,
    rows: [emptyLawRow(columns)],
  };
}

function normalizeLawSection(item) {
  if (!item || typeof item !== "object") {
    return emptyLawSection();
  }

  const rows = Array.isArray(item.rows)
    ? item.rows
    : Array.isArray(item.governingLawRows)
      ? item.governingLawRows
      : [];

  const columns = normalizeLawColumns(item, rows);

  return {
    name: item.name || item.title || item.sectionName || "",
    columns,
    rows: rows.length ? rows.map((row) => normalizeLawRow(row, columns)) : [emptyLawRow(columns)],
  };
}

function normalizeSectionName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function splitLawSectionsByType(rawSections) {
  const sections = Array.isArray(rawSections) ? rawSections.map((item) => normalizeLawSection(item)) : [];
  let governingSection = null;
  let jurisdictionSection = null;
  const customSections = [];

  sections.forEach((section) => {
    const normalizedName = normalizeSectionName(section.name);
    if (!governingSection && normalizedName === normalizeSectionName(GOVERNING_SECTION_NAME)) {
      governingSection = section;
      return;
    }
    if (!jurisdictionSection && normalizedName === normalizeSectionName(JURISDICTION_SECTION_NAME)) {
      jurisdictionSection = section;
      return;
    }
    customSections.push(section);
  });

  return { governingSection, jurisdictionSection, customSections };
}

function buildSpecialLawSection(name, rows, columns) {
  return {
    name,
    columns: Array.isArray(columns) ? columns : [],
    rows: Array.isArray(rows) ? rows : [],
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
  const [sectionsExpanded, setSectionsExpanded] = useState({});
  const [lawPanelPage, setLawPanelPage] = useState(1);
  const [lawPanelPageSize, setLawPanelPageSize] = useState(4);
  const [auditItems, setAuditItems] = useState([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [isCreateFlow, setIsCreateFlow] = useState(false);
  const [uploadingContracts, setUploadingContracts] = useState(false);
  const [downloadOpenId, setDownloadOpenId] = useState("");
  const contractsUploadInputRef = useRef(null);
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

  const openPanel = (mode, row, options = {}) => {
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

    const { governingSection, jurisdictionSection, customSections } = splitLawSectionsByType(row.lawSections);

    const governingRowsSource = Array.isArray(row.governingLawRows) && row.governingLawRows.length
      ? row.governingLawRows
      : Array.isArray(governingSection?.rows) && governingSection.rows.length
        ? governingSection.rows
      : legacyGoverningRows;
    const jurisdictionRowsSource = Array.isArray(row.jurisdictionRows) && row.jurisdictionRows.length
      ? row.jurisdictionRows
      : Array.isArray(jurisdictionSection?.rows) && jurisdictionSection.rows.length
        ? jurisdictionSection.rows
      : legacyJurisdictionRows;

    const governingLawColumns = normalizeDynamicColumns(
      row.governingLawColumns || governingSection?.columns,
      governingRowsSource,
      GOVERNING_BASE_KEYS
    );
    const jurisdictionColumns = normalizeDynamicColumns(
      row.jurisdictionColumns || jurisdictionSection?.columns,
      jurisdictionRowsSource,
      JURISDICTION_BASE_KEYS
    );

    const next = {
      ...row,
      governingLawColumns,
      jurisdictionColumns,
      governingLawRows: governingRowsSource.length
        ? governingRowsSource.map((item) => normalizeGoverningLaw(item, governingLawColumns))
        : [emptyGoverningLaw(governingLawColumns)],
      jurisdictionRows: jurisdictionRowsSource.length
        ? jurisdictionRowsSource.map((item) => normalizeJurisdiction(item, jurisdictionColumns))
        : [emptyJurisdiction(jurisdictionColumns)],
      lawSections: customSections,
    };

    const initialExpanded = {
      governing: mode === "edit",
      jurisdiction: mode === "edit",
    };
    (next.lawSections || []).forEach((_, index) => {
      initialExpanded[`law-${index}`] = mode === "edit";
    });

    setSectionsExpanded(initialExpanded);
    setLawPanelPage(1);
    setActiveRecord(next);
    setIsCreateFlow(Boolean(options.isCreate));
    setPanelMode(mode);
  };

  const closePanel = () => {
    setActiveRecord(null);
    setSectionsExpanded({});
    setLawPanelPage(1);
    setAuditItems([]);
    setSaveConfirmOpen(false);
    setIsCreateFlow(false);
    setPanelMode("");
  };

  const setSectionExpanded = (sectionKey, isOpen) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [sectionKey]: isOpen,
    }));
  };

  const updateActiveField = (key, value) => {
    setActiveRecord((prev) => ({ ...prev, [key]: value }));
  };

  const updateGoverningLawRow = (index, field, value) => {
    setActiveRecord((prev) => {
      const nextRows = [...(prev.governingLawRows || [])];
      const current = normalizeGoverningLaw(nextRows[index], prev.governingLawColumns || []);
      nextRows[index] = { ...current, [field]: value };
      return { ...prev, governingLawRows: nextRows };
    });
  };

  const updateJurisdictionRow = (index, field, value) => {
    setActiveRecord((prev) => {
      const nextRows = [...(prev.jurisdictionRows || [])];
      const current = normalizeJurisdiction(nextRows[index], prev.jurisdictionColumns || []);
      nextRows[index] = { ...current, [field]: value };
      return { ...prev, jurisdictionRows: nextRows };
    });
  };

  const addGoverningLawRow = () => {
    setActiveRecord((prev) => ({
      ...prev,
      governingLawRows: [...(prev.governingLawRows || []), emptyGoverningLaw(prev.governingLawColumns || [])],
    }));
  };

  const addJurisdictionRow = () => {
    setActiveRecord((prev) => ({
      ...prev,
      jurisdictionRows: [...(prev.jurisdictionRows || []), emptyJurisdiction(prev.jurisdictionColumns || [])],
    }));
  };

  const removeGoverningLawRow = (index) => {
    setActiveRecord((prev) => {
      const current = [...(prev.governingLawRows || [])];
      current.splice(index, 1);
      return {
        ...prev,
        governingLawRows: current.length ? current : [emptyGoverningLaw(prev.governingLawColumns || [])],
      };
    });
  };

  const removeJurisdictionRow = (index) => {
    setActiveRecord((prev) => {
      const current = [...(prev.jurisdictionRows || [])];
      current.splice(index, 1);
      return {
        ...prev,
        jurisdictionRows: current.length ? current : [emptyJurisdiction(prev.jurisdictionColumns || [])],
      };
    });
  };

  const clearGoverningLawSection = () => {
    setActiveRecord((prev) => ({
      ...prev,
      governingLawColumns: [],
      governingLawRows: [emptyGoverningLaw([])],
    }));
  };

  const clearJurisdictionSection = () => {
    setActiveRecord((prev) => ({
      ...prev,
      jurisdictionColumns: [],
      jurisdictionRows: [emptyJurisdiction([])],
    }));
  };

  const addGoverningLawColumn = () => {
    setActiveRecord((prev) => {
      const columns = [...(prev.governingLawColumns || [])];
      const label = `Column ${columns.length + 1}`;
      const keyBase = toLawColumnKey(label);

      let key = keyBase;
      let suffix = 2;
      while (GOVERNING_BASE_KEYS.includes(key) || columns.some((column) => column.key === key)) {
        key = `${keyBase}_${suffix}`;
        suffix += 1;
      }

      const nextColumns = [...columns, { key, label }];
      const nextRows = (prev.governingLawRows || []).map((rawRow) => {
        const row = normalizeGoverningLaw(rawRow, columns);
        row[key] = "";
        return row;
      });

      return {
        ...prev,
        governingLawColumns: nextColumns,
        governingLawRows: nextRows.length ? nextRows : [emptyGoverningLaw(nextColumns)],
      };
    });
  };

  const removeGoverningLawColumn = (columnKey) => {
    setActiveRecord((prev) => {
      const columns = [...(prev.governingLawColumns || [])].filter((column) => column.key !== columnKey);
      const nextRows = (prev.governingLawRows || []).map((rawRow) => {
        const row = { ...normalizeGoverningLaw(rawRow, prev.governingLawColumns || []) };
        delete row[columnKey];
        return row;
      });

      return {
        ...prev,
        governingLawColumns: columns,
        governingLawRows: nextRows.length ? nextRows : [emptyGoverningLaw(columns)],
      };
    });
  };

  const addJurisdictionColumn = () => {
    setActiveRecord((prev) => {
      const columns = [...(prev.jurisdictionColumns || [])];
      const label = `Column ${columns.length + 1}`;
      const keyBase = toLawColumnKey(label);

      let key = keyBase;
      let suffix = 2;
      while (JURISDICTION_BASE_KEYS.includes(key) || columns.some((column) => column.key === key)) {
        key = `${keyBase}_${suffix}`;
        suffix += 1;
      }

      const nextColumns = [...columns, { key, label }];
      const nextRows = (prev.jurisdictionRows || []).map((rawRow) => {
        const row = normalizeJurisdiction(rawRow, columns);
        row[key] = "";
        return row;
      });

      return {
        ...prev,
        jurisdictionColumns: nextColumns,
        jurisdictionRows: nextRows.length ? nextRows : [emptyJurisdiction(nextColumns)],
      };
    });
  };

  const removeJurisdictionColumn = (columnKey) => {
    setActiveRecord((prev) => {
      const columns = [...(prev.jurisdictionColumns || [])].filter((column) => column.key !== columnKey);
      const nextRows = (prev.jurisdictionRows || []).map((rawRow) => {
        const row = { ...normalizeJurisdiction(rawRow, prev.jurisdictionColumns || []) };
        delete row[columnKey];
        return row;
      });

      return {
        ...prev,
        jurisdictionColumns: columns,
        jurisdictionRows: nextRows.length ? nextRows : [emptyJurisdiction(columns)],
      };
    });
  };

  const addLawSection = () => {
    setActiveRecord((prev) => {
      const nextIndex = (prev.lawSections || []).length;
      setSectionsExpanded((prevExpanded) => ({
        ...prevExpanded,
        [`law-${nextIndex}`]: true,
      }));
      return {
        ...prev,
        lawSections: [...(prev.lawSections || []), emptyLawSection(`Law ${nextIndex + 1}`)],
      };
    });
  };

  const removeLawSection = (sectionIndex) => {
    setActiveRecord((prev) => {
      const source = [...(prev.lawSections || [])];
      const current = [...source];
      current.splice(sectionIndex, 1);

      setSectionsExpanded((prevExpanded) => {
        const nextExpanded = {
          governing: prevExpanded.governing ?? panelMode === "edit",
          jurisdiction: prevExpanded.jurisdiction ?? panelMode === "edit",
        };

        let nextLawIndex = 0;
        source.forEach((_, oldIndex) => {
          if (oldIndex === sectionIndex) {
            return;
          }
          const oldKey = `law-${oldIndex}`;
          const newKey = `law-${nextLawIndex}`;
          nextExpanded[newKey] = prevExpanded[oldKey] ?? (panelMode === "edit");
          nextLawIndex += 1;
        });

        return nextExpanded;
      });

      return {
        ...prev,
        lawSections: current,
      };
    });
  };

  const updateLawSectionName = (sectionIndex, value) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      sections[sectionIndex] = { ...section, name: value };
      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const updateLawSectionRow = (sectionIndex, rowIndex, field, value) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      const rows = [...section.rows];
      const current = normalizeLawRow(rows[rowIndex], section.columns || []);
      rows[rowIndex] = { ...current, [field]: value };
      sections[sectionIndex] = { ...section, rows };
      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const addLawSectionRow = (sectionIndex) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      sections[sectionIndex] = {
        ...section,
        rows: [...section.rows, emptyLawRow(section.columns || [])],
      };
      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const removeLawSectionRow = (sectionIndex, rowIndex) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      const rows = [...section.rows];
      rows.splice(rowIndex, 1);
      sections[sectionIndex] = {
        ...section,
        rows: rows.length ? rows : [emptyLawRow(section.columns || [])],
      };
      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const addLawSectionColumn = (sectionIndex) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      const trimmed = `Column ${section.columns.length + 1}`;
      const keyBase = toLawColumnKey(trimmed);

      let key = keyBase;
      let suffix = 2;
      while (BASE_LAW_KEYS.includes(key) || section.columns.some((column) => column.key === key)) {
        key = `${keyBase}_${suffix}`;
        suffix += 1;
      }

      const columns = [...section.columns, { key, label: trimmed }];
      const rows = section.rows.map((rawRow) => {
        const row = normalizeLawRow(rawRow, section.columns);
        row[key] = "";
        return row;
      });

      sections[sectionIndex] = {
        ...section,
        columns,
        rows,
      };

      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const removeLawSectionColumn = (sectionIndex, columnKey) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      const columns = section.columns.filter((column) => column.key !== columnKey);
      const rows = section.rows.map((rawRow) => {
        const row = { ...normalizeLawRow(rawRow, section.columns) };
        delete row[columnKey];
        return row;
      });

      sections[sectionIndex] = {
        ...section,
        columns,
        rows: rows.length ? rows : [emptyLawRow(columns)],
      };

      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const updateLawSectionColumnLabel = (sectionIndex, columnKey, value) => {
    setActiveRecord((prev) => {
      const sections = [...(prev.lawSections || [])];
      const section = normalizeLawSection(sections[sectionIndex]);
      const columns = section.columns.map((column) => (
        column.key === columnKey ? { ...column, label: value } : column
      ));

      sections[sectionIndex] = {
        ...section,
        columns,
      };

      return {
        ...prev,
        lawSections: sections,
      };
    });
  };

  const persistSave = async (confirmSendForReview) => {
    if (!activeRecord) return;
    setError("");
    setSaveInProgress(true);
    try {
      const payload = {
        ...activeRecord,
        lawSections: [
          buildSpecialLawSection(GOVERNING_SECTION_NAME, activeRecord.governingLawRows, activeRecord.governingLawColumns),
          buildSpecialLawSection(JURISDICTION_SECTION_NAME, activeRecord.jurisdictionRows, activeRecord.jurisdictionColumns),
          ...(activeRecord.lawSections || []),
        ],
      };

      const savedRecord = isCreateFlow
        ? await createContract(payload, {
            statusTransitionEnabled,
            auditingEnabled,
          })
        : await updateContract(activeRecord.id, payload, {
            statusTransitionEnabled,
            auditingEnabled,
          });

      const savedRecordId = savedRecord?.id || activeRecord.id;

      if (statusTransitionEnabled) {
        await submitContractForReview(savedRecordId, {
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

  const triggerContractsUpload = () => {
    if (uploadingContracts) return;
    contractsUploadInputRef.current?.click();
  };

  const onContractsFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setUploadingContracts(true);
    try {
      await uploadContractsExcel(file);
      setReloadToken((token) => token + 1);
    } catch (uploadError) {
      setError(uploadError?.response?.data?.message || uploadError.message || "Failed to upload contracts Excel");
    } finally {
      setUploadingContracts(false);
    }
  };

  const handleCreateContract = () => {
    const newRecord = {
      id: "",
      documentName: "",
      documentLink: "",
      clientIdentifier: "",
      cdokType: "",
      editedBy: "",
      status: "Draft",
      governingLawRows: [emptyGoverningLaw()],
      governingLawColumns: [],
      jurisdictionRows: [emptyJurisdiction()],
      jurisdictionColumns: [],
      lawSections: [],
    };
    openPanel("edit", newRecord, { isCreate: true });
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
  const panelTitle = panelMode === "audit"
    ? "Audit Timeline"
    : panelMode === "edit"
      ? (isCreateFlow ? "Create Contract" : "Edit Contract")
      : "View Contract";
  const allRulePanels = activeRecord
    ? [
        { key: "governing", type: "governing", title: "Governing Law" },
        { key: "jurisdiction", type: "jurisdiction", title: "Jurisdiction" },
        ...(activeRecord.lawSections || []).map((rawSection, index) => {
          const section = normalizeLawSection(rawSection);
          return {
            key: `law-${index}`,
            type: "law",
            title: section.name?.trim() || `Law ${index + 1}`,
            sectionIndex: index,
            section,
          };
        }),
      ]
    : [];
  const totalRulePanels = allRulePanels.length;
  const lawPanelTotalPages = Math.max(1, Math.ceil(totalRulePanels / lawPanelPageSize));
  const safeLawPanelPage = Math.min(lawPanelPage, lawPanelTotalPages);
  const lawPanelStart = (safeLawPanelPage - 1) * lawPanelPageSize;
  const pagedRulePanels = allRulePanels.slice(lawPanelStart, lawPanelStart + lawPanelPageSize);
  const sectionKeys = allRulePanels.map((panel) => panel.key);
  const allSectionsExpanded = sectionKeys.length > 0 && sectionKeys.every((key) => Boolean(sectionsExpanded[key]));

  const toggleAllSections = () => {
    const nextOpen = !allSectionsExpanded;
    const nextExpanded = {};
    sectionKeys.forEach((key) => {
      nextExpanded[key] = nextOpen;
    });
    setSectionsExpanded(nextExpanded);
  };

  const hasLawPanelPagination = totalRulePanels > 0;

  const renderLawPanelPagination = (position) => {
    if (!hasLawPanelPagination) {
      return null;
    }

    return (
      <div className={`contract-page__panel-pagination contract-page__panel-pagination--${position}`}>
        <button
          type="button"
          className="contract-page__mini-btn"
          onClick={() => setLawPanelPage((prev) => Math.max(1, prev - 1))}
          disabled={safeLawPanelPage <= 1}
          aria-label="Previous law panels page"
        >
          Prev
        </button>
        <label htmlFor={`law-panel-page-size-${position}`} className="contract-page__panel-pagination-label"></label>
        <select
          id={`law-panel-page-size-${position}`}
          className="contract-page__panel-page-size"
          value={lawPanelPageSize}
          onChange={(event) => {
            const nextSize = Number(event.target.value) || 4;
            setLawPanelPageSize(nextSize);
            setLawPanelPage(1);
          }}
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={6}>6</option>
          <option value={10}>10</option>
        </select>
        <span className="contract-page__panel-pagination-index">{safeLawPanelPage}/{lawPanelTotalPages}</span>
        <button
          type="button"
          className="contract-page__mini-btn contract-page__mini-btn--primary"
          onClick={() => setLawPanelPage((prev) => Math.min(lawPanelTotalPages, prev + 1))}
          disabled={safeLawPanelPage >= lawPanelTotalPages}
          aria-label="Next law panels page"
        >
          Next
        </button>
      </div>
    );
  };

  useEffect(() => {
    if (!activeRecord) {
      return;
    }
    if (lawPanelPage > lawPanelTotalPages) {
      setLawPanelPage(lawPanelTotalPages);
    }
  }, [activeRecord, lawPanelPage, lawPanelTotalPages]);

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
        <div className="contract-page__rules-subhead-actions">
          {panelMode === "edit" ? (
            <button type="button" className="contract-page__mini-btn contract-page__mini-btn--primary" onClick={addLawSection}>
              <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
              <span>Add Law</span>
            </button>
          ) : null}
          <button type="button" className="contract-page__mini-btn" onClick={toggleAllSections}>
            <span className="contract-page__mini-btn-icon" aria-hidden="true">{allSectionsExpanded ? "-" : "+"}</span>
            <span>{allSectionsExpanded ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>
      </div>

      <div className="contract-page__rules-sections">
        {pagedRulePanels.map((panel) => {
          if (panel.type === "governing") {
            return (
              <details
                className="contract-page__rules-section contract-page__rules-collapsible"
                open={Boolean(sectionsExpanded.governing)}
                onToggle={(event) => setSectionExpanded("governing", event.currentTarget.open)}
                key={panel.key}
              >
                <summary className="contract-page__rules-summary">Governing Law</summary>
                {panelMode === "edit" ? (
                  <button
                    type="button"
                    className="contract-page__law-remove-icon-btn"
                    onClick={clearGoverningLawSection}
                    aria-label="Clear governing law"
                    title="Clear governing law"
                  >
                    <span aria-hidden="true">x</span>
                  </button>
                ) : null}
                <div className="contract-page__rules-subhead">
                  <h4>Governing Law</h4>
                  {panelMode === "edit" ? (
                    <div className="contract-page__rules-subhead-actions">
                      <button type="button" className="contract-page__mini-btn" onClick={addGoverningLawRow}>
                        <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
                        <span>Add Row</span>
                      </button>
                      <button type="button" className="contract-page__mini-btn" onClick={addGoverningLawColumn}>
                        <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
                        <span>Add Column</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="contract-page__rules-table-wrap">
                  <table className="contract-page__rules-table contract-page__rules-table--governing">
                    <thead>
                      <tr>
                        {GOVERNING_BASE_COLUMN_DEFS.map((column) => <th key={`gl-base-head-${column.key}`}>{column.label}</th>)}
                        {(activeRecord.governingLawColumns || []).map((column) => (
                          <th key={`gl-dynamic-head-${column.key}`}>
                            <div className="contract-page__dynamic-column-head">
                              <span>{column.label}</span>
                              {panelMode === "edit" ? (
                                <button
                                  type="button"
                                  className="contract-page__column-remove-btn"
                                  onClick={() => removeGoverningLawColumn(column.key)}
                                  aria-label={`Remove ${column.label} column`}
                                >
                                  x
                                </button>
                              ) : null}
                            </div>
                          </th>
                        ))}
                        {panelMode === "edit" ? <th>Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(activeRecord.governingLawRows || []).map((rawRow, index) => {
                        const row = normalizeGoverningLaw(rawRow, activeRecord.governingLawColumns || []);
                        return (
                          <tr key={`gl-${index}`}>
                            {GOVERNING_BASE_COLUMN_DEFS.map((column) => (
                              <td key={`gl-base-cell-${column.key}`}><input value={row[column.key] || ""} onChange={(event) => updateGoverningLawRow(index, column.key, event.target.value)} disabled={panelMode === "view"} /></td>
                            ))}
                            {(activeRecord.governingLawColumns || []).map((column) => (
                              <td key={`gl-dynamic-cell-${column.key}`}><input value={row[column.key] || ""} onChange={(event) => updateGoverningLawRow(index, column.key, event.target.value)} disabled={panelMode === "view"} /></td>
                            ))}
                            {panelMode === "edit" ? <td><button type="button" className="contract-page__mini-btn contract-page__mini-btn--danger" onClick={() => removeGoverningLawRow(index)}>Remove</button></td> : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          }

          if (panel.type === "jurisdiction") {
            return (
              <details
                className="contract-page__rules-section contract-page__rules-collapsible"
                open={Boolean(sectionsExpanded.jurisdiction)}
                onToggle={(event) => setSectionExpanded("jurisdiction", event.currentTarget.open)}
                key={panel.key}
              >
                <summary className="contract-page__rules-summary">Jurisdiction</summary>
                {panelMode === "edit" ? (
                  <button
                    type="button"
                    className="contract-page__law-remove-icon-btn"
                    onClick={clearJurisdictionSection}
                    aria-label="Clear jurisdiction"
                    title="Clear jurisdiction"
                  >
                    <span aria-hidden="true">x</span>
                  </button>
                ) : null}
                <div className="contract-page__rules-subhead">
                  <h4>Jurisdiction</h4>
                  {panelMode === "edit" ? (
                    <div className="contract-page__rules-subhead-actions">
                      <button type="button" className="contract-page__mini-btn" onClick={addJurisdictionRow}>
                        <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
                        <span>Add Row</span>
                      </button>
                      <button type="button" className="contract-page__mini-btn" onClick={addJurisdictionColumn}>
                        <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
                        <span>Add Column</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="contract-page__rules-table-wrap">
                  <table className="contract-page__rules-table contract-page__rules-table--jurisdiction">
                    <thead>
                      <tr>
                        {JURISDICTION_BASE_COLUMN_DEFS.map((column) => <th key={`jur-base-head-${column.key}`}>{column.label}</th>)}
                        {(activeRecord.jurisdictionColumns || []).map((column) => (
                          <th key={`jur-dynamic-head-${column.key}`}>
                            <div className="contract-page__dynamic-column-head">
                              <span>{column.label}</span>
                              {panelMode === "edit" ? (
                                <button
                                  type="button"
                                  className="contract-page__column-remove-btn"
                                  onClick={() => removeJurisdictionColumn(column.key)}
                                  aria-label={`Remove ${column.label} column`}
                                >
                                  x
                                </button>
                              ) : null}
                            </div>
                          </th>
                        ))}
                        {panelMode === "edit" ? <th>Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(activeRecord.jurisdictionRows || []).map((rawRow, index) => {
                        const row = normalizeJurisdiction(rawRow, activeRecord.jurisdictionColumns || []);
                        return (
                          <tr key={`jur-${index}`}>
                            {JURISDICTION_BASE_COLUMN_DEFS.map((column) => (
                              <td key={`jur-base-cell-${column.key}`}><input value={row[column.key] || ""} onChange={(event) => updateJurisdictionRow(index, column.key, event.target.value)} disabled={panelMode === "view"} /></td>
                            ))}
                            {(activeRecord.jurisdictionColumns || []).map((column) => (
                              <td key={`jur-dynamic-cell-${column.key}`}><input value={row[column.key] || ""} onChange={(event) => updateJurisdictionRow(index, column.key, event.target.value)} disabled={panelMode === "view"} /></td>
                            ))}
                            {panelMode === "edit" ? <td><button type="button" className="contract-page__mini-btn contract-page__mini-btn--danger" onClick={() => removeJurisdictionRow(index)}>Remove</button></td> : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          }

          const sectionIndex = panel.sectionIndex;
          const section = panel.section;
          const sectionTitle = panel.title;
          return (
            <details
              className="contract-page__rules-section contract-page__rules-collapsible"
              open={Boolean(sectionsExpanded[panel.key])}
              onToggle={(event) => setSectionExpanded(panel.key, event.currentTarget.open)}
              key={panel.key}
            >
              <summary className="contract-page__rules-summary">{sectionTitle}</summary>
              {panelMode === "edit" ? (
                <button
                  type="button"
                  className="contract-page__law-remove-icon-btn"
                  onClick={() => removeLawSection(sectionIndex)}
                  aria-label="Remove law"
                  title="Remove law"
                >
                  <span aria-hidden="true">x</span>
                </button>
              ) : null}
              <div className="contract-page__rules-subhead">
                <h4>{sectionTitle}</h4>
                {panelMode === "edit" ? (
                  <div className="contract-page__rules-subhead-actions">
                    <button type="button" className="contract-page__mini-btn" onClick={() => addLawSectionRow(sectionIndex)}>
                      <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
                      <span>Add Row</span>
                    </button>
                    <button type="button" className="contract-page__mini-btn" onClick={() => addLawSectionColumn(sectionIndex)}>
                      <span className="contract-page__mini-btn-icon" aria-hidden="true">+</span>
                      <span>Add Column</span>
                    </button>
                  </div>
                ) : null}
              </div>
              {panelMode === "edit" ? (
                <label className="contract-page__field contract-page__law-name-field">
                  Law Name
                  <input value={section.name} onChange={(event) => updateLawSectionName(sectionIndex, event.target.value)} placeholder="Enter law name" />
                </label>
              ) : null}
              <div className="contract-page__rules-table-wrap">
                <table className="contract-page__rules-table contract-page__rules-table--governing">
                  <thead>
                    <tr>
                      {BASE_LAW_COLUMN_DEFS.map((column) => <th key={`law-base-head-${column.key}`}>{column.label}</th>)}
                      {section.columns.map((column) => (
                        <th key={`law-dynamic-head-${column.key}`}>
                          <div className="contract-page__dynamic-column-head">
                            {panelMode === "edit" ? (
                              <input className="contract-page__column-header-input" value={column.label || ""} onChange={(event) => updateLawSectionColumnLabel(sectionIndex, column.key, event.target.value)} placeholder="Column name" />
                            ) : (
                              <span>{column.label}</span>
                            )}
                            {panelMode === "edit" ? <button type="button" className="contract-page__column-remove-btn" onClick={() => removeLawSectionColumn(sectionIndex, column.key)} aria-label={`Remove ${column.label} column`}>x</button> : null}
                          </div>
                        </th>
                      ))}
                      {panelMode === "edit" ? <th>Action</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((rawRow, rowIndex) => {
                      const row = normalizeLawRow(rawRow, section.columns);
                      return (
                        <tr key={`law-${sectionIndex}-${rowIndex}`}>
                          {BASE_LAW_COLUMN_DEFS.map((column) => <td key={`law-base-cell-${column.key}`}><input value={row[column.key] || ""} onChange={(event) => updateLawSectionRow(sectionIndex, rowIndex, column.key, event.target.value)} disabled={panelMode === "view"} /></td>)}
                          {section.columns.map((column) => <td key={`law-dynamic-cell-${column.key}`}><input value={row[column.key] || ""} onChange={(event) => updateLawSectionRow(sectionIndex, rowIndex, column.key, event.target.value)} disabled={panelMode === "view"} /></td>)}
                          {panelMode === "edit" ? <td><button type="button" className="contract-page__mini-btn contract-page__mini-btn--danger" onClick={() => removeLawSectionRow(sectionIndex, rowIndex)}>Remove</button></td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>

      {renderLawPanelPagination("bottom")}

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
        <div className="contract-page__header-actions">
          <button
            type="button"
            className="contract-page__btn contract-page__btn--primary"
            onClick={handleCreateContract}
          >
            + Create Contract
          </button>
          <input
            ref={contractsUploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="contract-page__file-input"
            onChange={onContractsFileSelected}
          />
          <button
            type="button"
            className="contract-page__btn contract-page__btn--secondary"
            onClick={triggerContractsUpload}
            disabled={uploadingContracts}
          >
            {uploadingContracts ? "Uploading..." : "Upload Contracts"}
          </button>
        </div>
      </header>



      {error ? <div className="contract-page__error">{error}</div> : null}
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

    </section>
  );
}
