import { createElement } from "react";

export const EDITOR_MODE_INLINE = "inline";
export const EDITOR_MODE_MODAL = "modal";

export function createLocalRowId() {
  return `tg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeLines(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export function normalizeTestCaseRow(row) {
  return {
    __rowId: row?.__rowId || createLocalRowId(),
    testCaseId: String(row?.testCaseId ?? "").trim(),
    requirementId: String(row?.requirementId ?? "").trim(),
    testDescription: String(row?.testDescription ?? "").trim(),
    preconditions: normalizeLines(row?.preconditions),
    testStepAction: normalizeLines(row?.testStepAction),
  };
}

export function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(normalizeTestCaseRow);
}

export function validateArrayField(value, label) {
  const items = normalizeLines(value);
  if (items.length === 0) {
    return `Add at least one ${label.toLowerCase()} value.`;
  }
  return null;
}

export function validateTestCaseRow(row) {
  const normalized = normalizeTestCaseRow(row);
  const errors = {};

  if (!normalized.testCaseId) errors.testCaseId = "Test Case Id is required.";
  if (!normalized.requirementId) errors.requirementId = "Requirement Id is required.";
  if (!normalized.testDescription) errors.testDescription = "Test Description is required.";

  const preconditionsErr = validateArrayField(normalized.preconditions, "Pre-conditions");
  if (preconditionsErr) errors.preconditions = preconditionsErr;

  const testStepErr = validateArrayField(normalized.testStepAction, "Test Step Action");
  if (testStepErr) errors.testStepAction = testStepErr;

  return { normalized, errors };
}

export function createEmptyTestCaseRow() {
  return normalizeTestCaseRow({
    __rowId: createLocalRowId(),
    testCaseId: "",
    requirementId: "",
    testDescription: "",
    preconditions: [""],
    testStepAction: [""],
  });
}

export function buildTestCaseColumns({ editorMode, renderLines, ArrayLineEditor }) {
  const base = [
    {
      key: "testCaseId",
      label: "Test Case Id",
      width: "14%",
      required: true,
      validate: (value) => (!String(value ?? "").trim() ? "Test Case Id is required." : null),
    },
    {
      key: "requirementId",
      label: "Requirement Id",
      width: "16%",
      required: true,
      validate: (value) => (!String(value ?? "").trim() ? "Requirement Id is required." : null),
    },
    {
      key: "testDescription",
      label: "Test Description",
      width: "20%",
      truncate: 120,
      editType: "textarea",
      required: true,
      validate: (value) => (!String(value ?? "").trim() ? "Test Description is required." : null),
    },
    {
      key: "preconditions",
      label: "Pre-conditions",
      render: renderLines,
      width: "25%",
      verticalAlign: "top",
      truncate: 120,
      validate: (value) => validateArrayField(value, "Pre-conditions"),
    },
    {
      key: "testStepAction",
      label: "Test Step Action",
      render: renderLines,
      width: "25%",
      verticalAlign: "top",
      truncate: 120,
      validate: (value) => validateArrayField(value, "Test Step Action"),
    },
  ];

  if (editorMode !== EDITOR_MODE_INLINE) {
    return base;
  }

  return base.map((col) => {
    if (col.key !== "preconditions" && col.key !== "testStepAction") {
      return col;
    }

    return {
      ...col,
      editRender: ({ value, onChange, error }) => createElement(ArrayLineEditor, {
        label: col.label,
        value,
        onChange,
        error,
      }),
    };
  });
}
