import { useState } from "react";
import DataTable from "../../../DataTable/DataTable";
import { EDITOR_MODE_INLINE, EDITOR_MODE_MODAL } from "./testCaseEditingUtils";

export default function PluggableEditableTable({
  columns,
  rows,
  setRows,
  readOnly,
  editorMode,
  createEmptyRow,
  normalizeRows,
  normalizeRow,
  validateRow,
  ModalComponent,
  sortableColumns = ["testCaseId", "requirementId"],
  searchableColumns = ["testCaseId", "requirementId", "testDescription"],
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
}) {
  const [modalEdit, setModalEdit] = useState({
    open: false,
    rowId: null,
    draft: null,
    errors: {},
  });

  const closeModalEditor = () => {
    setModalEdit({
      open: false,
      rowId: null,
      draft: null,
      errors: {},
    });
  };

  const openModalEditor = (row) => {
    setModalEdit({
      open: true,
      rowId: row.__rowId,
      draft: { ...row },
      errors: {},
    });
  };

  const updateModalDraft = (key, value) => {
    setModalEdit((prev) => ({
      ...prev,
      draft: { ...prev.draft, [key]: value },
      errors: { ...prev.errors, [key]: "" },
    }));
  };

  const saveModalDraft = () => {
    const { normalized, errors } = validateRow(modalEdit.draft);
    if (Object.keys(errors).length) {
      setModalEdit((prev) => ({ ...prev, errors }));
      return;
    }

    setRows((prev) => prev.map((row) => (
      row.__rowId === modalEdit.rowId ? { ...normalized, __rowId: modalEdit.rowId } : row
    )));
    closeModalEditor();
  };

  const removeModalRow = (rowId) => {
    if (!window.confirm("Are you sure you want to remove this row?")) return;
    setRows((prev) => prev.filter((row) => row.__rowId !== rowId));
  };

  const addModalRow = () => {
    const row = createEmptyRow();
    setRows((prev) => [row, ...prev]);
    openModalEditor(row);
  };

  const modalRowActions = () => {
    if (readOnly) return [];
    return [
      { id: "edit", label: "Edit", variant: "primary" },
      { id: "remove", label: "Remove", variant: "danger" },
    ];
  };

  const onModalRowAction = (action, row) => {
    if (action === "edit") openModalEditor(row);
    if (action === "remove") removeModalRow(row.__rowId);
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        pageSize={pageSize}
        sortableColumns={sortableColumns}
        searchableColumns={searchableColumns}
        pageSizeOptions={pageSizeOptions}
        editable={!readOnly && editorMode === EDITOR_MODE_INLINE}
        editableOptions={
          !readOnly && editorMode === EDITOR_MODE_INLINE
            ? {
                rowKey: "__rowId",
                actionColumnLabel: "Edit Option",
                onRowsChange: (nextRows) => {
                  setRows(normalizeRows(nextRows));
                },
                createEmptyRow,
                onSaveRow: ({ row, previousRow }) => normalizeRow({
                  ...row,
                  __rowId: previousRow?.__rowId,
                }),
                onRemoveRow: () => Promise.resolve(),
              }
            : {}
        }
        rowActions={editorMode === EDITOR_MODE_MODAL ? modalRowActions : undefined}
        onRowAction={editorMode === EDITOR_MODE_MODAL ? onModalRowAction : undefined}
        rowActionsColumnLabel={editorMode === EDITOR_MODE_MODAL ? "Edit Option" : "Actions"}
        toolbarExtra={
          !readOnly && editorMode === EDITOR_MODE_MODAL ? (
            <button
              type="button"
              className="dt__action-btn dt__action-btn--ghost"
              onClick={addModalRow}
            >
              + Add
            </button>
          ) : null
        }
      />

      {ModalComponent ? (
        <ModalComponent
          open={!readOnly && editorMode === EDITOR_MODE_MODAL && modalEdit.open}
          rowDraft={modalEdit.draft}
          errors={modalEdit.errors}
          onChange={updateModalDraft}
          onCancel={closeModalEditor}
          onSave={saveModalDraft}
        />
      ) : null}
    </>
  );
}
