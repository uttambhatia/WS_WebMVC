import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_MAP_TEST_CASES = (json, targetFolderId) => {
  const details = json?.testGenerationResult?.details || [];
  let allTestCases = [];
  details.forEach((detail) => {
    if (Array.isArray(detail.test_cases)) {
      allTestCases = allTestCases.concat(detail.test_cases);
    }
  });

  return allTestCases.map((tc) => ({
    _type: "test-case",
    name: tc.testCaseId,
    parent: { id: targetFolderId, _type: "test-case-folder" },
    prerequisite: tc.preConditions,
    description: tc.testDescription,
    automated_test_technology: "Playwright",
    steps: (tc.testSteps || []).map((step) => ({
      _type: "action-step",
      action: `<p>${step.action}</p>`,
      expected_result: `<p>${step.expectedResult || "Success"}</p>`,
    })),
  }));
};

function TickBadge({ title = "Verified" }) {
  return (
    <span className="fp__squash-tick" title={title} aria-label={title}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M4.2 8.2 6.8 10.8 11.8 5.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const isPositiveInteger = (value) => /^\d+$/.test(String(value || "").trim());
const MIN_FOLDER_LOOKUP_DIGITS = 4;

const buildFolderSuggestions = (query, folders) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return folders.slice(0, 8);
  return folders
    .filter((folder) => {
      const idText = String(folder.id || "").toLowerCase();
      const nameText = String(folder.name || "").toLowerCase();
      return idText.includes(q) || nameText.includes(q);
    })
    .slice(0, 8);
};

export default function SaveToSquashPanel({
  taskId,
  rawTestGenerationJson,
  squashConfig,
  open,
  onOpenChange,
}) {
  const configReady = Boolean(
    squashConfig?.getFolderService &&
      squashConfig?.createFolderService &&
      squashConfig?.saveTestCasesService
  );

  const mapPayload = squashConfig?.mapPayload || DEFAULT_MAP_TEST_CASES;

  const [openInternal, setOpenInternal] = useState(false);
  const [mode, setMode] = useState("existing");

  const panelOpen = typeof open === "boolean" ? open : openInternal;
  const setPanelOpen = (nextOpen) => {
    if (typeof open !== "boolean") {
      setOpenInternal(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const [existingFolderId, setExistingFolderId] = useState("");
  const [existingFolder, setExistingFolder] = useState(null);
  const [existingFetching, setExistingFetching] = useState(false);
  const [existingError, setExistingError] = useState("");

  const [parentFolderId, setParentFolderId] = useState("");
  const [parentFolder, setParentFolder] = useState(null);
  const [parentFetching, setParentFetching] = useState(false);
  const [parentError, setParentError] = useState("");

  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [createdFolder, setCreatedFolder] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const [knownFolders, setKnownFolders] = useState([]);
  const existingLookupSeqRef = useRef(0);
  const parentLookupSeqRef = useRef(0);
  const [existingSuggestionsOpen, setExistingSuggestionsOpen] = useState(false);
  const [parentSuggestionsOpen, setParentSuggestionsOpen] = useState(false);

  const existingSuggestions = useMemo(
    () => buildFolderSuggestions(existingFolderId, knownFolders),
    [existingFolderId, knownFolders]
  );

  const parentSuggestions = useMemo(
    () => buildFolderSuggestions(parentFolderId, knownFolders),
    [parentFolderId, knownFolders]
  );

  const rememberFolder = (folder) => {
    if (!folder?.id) return;
    setKnownFolders((prev) => {
      if (prev.some((item) => String(item.id) === String(folder.id))) {
        return prev;
      }
      return [...prev, folder].slice(-15);
    });
  };

  const safeErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

  const clearModeErrors = () => {
    setExistingError("");
    setParentError("");
  };

  useEffect(() => {
    if (!panelOpen || mode !== "existing") return;

    const idText = String(existingFolderId || "").trim();

    if (!idText) {
      setExistingFolder(null);
      setExistingError("");
      setExistingFetching(false);
      return;
    }

    if (!isPositiveInteger(idText)) {
      setExistingFolder(null);
      setExistingError("Enter a valid existing folder id (integer).");
      setExistingFetching(false);
      return;
    }

    if (idText.length < MIN_FOLDER_LOOKUP_DIGITS) {
      setExistingFolder(null);
      setExistingError("");
      setExistingFetching(false);
      return;
    }

    if (String(existingFolder?.id) === idText) {
      setExistingError("");
      setExistingFetching(false);
      return;
    }

    const lookupSeq = ++existingLookupSeqRef.current;
    setExistingFetching(true);
    setExistingError("");

    const timerId = setTimeout(() => {
      squashConfig
        .getFolderService(Number(idText))
        .then((folder) => {
          if (existingLookupSeqRef.current !== lookupSeq) return;
          setExistingFolder(folder);
          setExistingError("");
          rememberFolder(folder);
        })
        .catch((error) => {
          if (existingLookupSeqRef.current !== lookupSeq) return;
          setExistingFolder(null);
          setExistingError(safeErrorMessage(error, "Folder not found."));
        })
        .finally(() => {
          if (existingLookupSeqRef.current !== lookupSeq) return;
          setExistingFetching(false);
        });
    }, 350);

    return () => {
      clearTimeout(timerId);
    };
  }, [existingFolderId, existingFolder?.id, mode, panelOpen, squashConfig]);

  useEffect(() => {
    if (!panelOpen || mode !== "new") return;

    const idText = String(parentFolderId || "").trim();

    if (!idText) {
      setParentFolder(null);
      setParentError("");
      setParentFetching(false);
      return;
    }

    if (!isPositiveInteger(idText)) {
      setParentFolder(null);
      setParentError("Enter a valid parent folder id (integer).");
      setParentFetching(false);
      return;
    }

    if (idText.length < MIN_FOLDER_LOOKUP_DIGITS) {
      setParentFolder(null);
      setParentError("");
      setParentFetching(false);
      return;
    }

    if (String(parentFolder?.id) === idText) {
      setParentError("");
      setParentFetching(false);
      return;
    }

    const lookupSeq = ++parentLookupSeqRef.current;
    setParentFetching(true);
    setParentError("");

    const timerId = setTimeout(() => {
      squashConfig
        .getFolderService(Number(idText))
        .then((folder) => {
          if (parentLookupSeqRef.current !== lookupSeq) return;
          setParentFolder(folder);
          setParentError("");
          rememberFolder(folder);
        })
        .catch((error) => {
          if (parentLookupSeqRef.current !== lookupSeq) return;
          setParentFolder(null);
          setParentError(safeErrorMessage(error, "Parent folder not found."));
        })
        .finally(() => {
          if (parentLookupSeqRef.current !== lookupSeq) return;
          setParentFetching(false);
        });
    }, 350);

    return () => {
      clearTimeout(timerId);
    };
  }, [parentFolderId, parentFolder?.id, mode, panelOpen, squashConfig]);

  const ensureFolderForSave = async () => {
    if (mode === "existing") {
      if (!existingFolder) {
        throw new Error("Fetch and validate an existing folder before saving.");
      }
      return existingFolder.id;
    }

    if (!parentFolder) {
      throw new Error("Validate a parent folder before creating a new folder.");
    }
    if (!newFolderName.trim()) {
      throw new Error("Folder name is required.");
    }
    if (!newFolderDescription.trim()) {
      throw new Error("Folder description is required.");
    }

    if (createdFolder?.id) {
      return createdFolder.id;
    }

    setCreatingFolder(true);
    const created = await squashConfig.createFolderService({
      name: newFolderName.trim(),
      description: newFolderDescription.trim(),
      parentId: Number(parentFolder.id),
    });
    setCreatedFolder(created);
    rememberFolder(created);
    setCreatingFolder(false);
    return created.id;
  };

  const handleSaveToSquash = async () => {
    if (!panelOpen) {
      setPanelOpen(true);
      return;
    }

    if (!configReady) {
      setStatus({
        type: "error",
        message: "Save to Squash is not configured.",
      });
      return;
    }

    if (!rawTestGenerationJson) {
      setStatus({
        type: "error",
        message: "Test generation payload is not available yet.",
      });
      return;
    }

    try {
      setStatus(null);
      setSaving(true);
      clearModeErrors();

      const targetFolderId = await ensureFolderForSave();
      const payload = mapPayload(rawTestGenerationJson, targetFolderId);

      if (!Array.isArray(payload) || payload.length === 0) {
        throw new Error("No test cases available to save.");
      }

      await squashConfig.saveTestCasesService(payload, {
        taskId,
        targetFolderId,
        mode,
      });

      setStatus({
        type: "success",
        message: `Saved ${payload.length} test case(s) to Squash folder ${targetFolderId}.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: safeErrorMessage(error, "Save to Squash failed."),
      });
    } finally {
      setSaving(false);
      setCreatingFolder(false);
    }
  };

  const handleClose = () => {
    setPanelOpen(false);
    setStatus(null);
    setExistingError("");
    setParentError("");
  };

  const showModeBusy = saving || existingFetching || parentFetching || creatingFolder;

  return (
    <div className="fp__squash-wrap">
      {panelOpen && (
        <div className="fp__squash-panel" role="group" aria-label="Save to Squash panel">
          <div className="fp__squash-mode-row">
            <label className="fp__squash-radio">
              <input
                type="radio"
                name="squash-save-mode"
                checked={mode === "existing"}
                onChange={() => {
                  setMode("existing");
                  setStatus(null);
                }}
                disabled={showModeBusy}
              />
              <span>Existing folder</span>
            </label>
            <label className="fp__squash-radio">
              <input
                type="radio"
                name="squash-save-mode"
                checked={mode === "new"}
                onChange={() => {
                  setMode("new");
                  setStatus(null);
                }}
                disabled={showModeBusy}
              />
              <span>New folder</span>
            </label>
          </div>

          {mode === "existing" ? (
            <div className="fp__squash-fields">
              <div className="fp__squash-field">
                <div className="fp__field-block fp__field-block--compact">
                  <label className="fp__field-label" htmlFor="fp-squash-existing-folder-id">Existing folder id *</label>
                  <input
                    id="fp-squash-existing-folder-id"
                    type="text"
                    className={`fp__input fp__squash-input${existingError ? " fp__input--error" : ""}`}
                    placeholder="Enter existing folder id"
                    value={existingFolderId}
                    onChange={(e) => {
                      setExistingFolderId(e.target.value);
                      setExistingFolder(null);
                      setExistingError("");
                      setStatus(null);
                    }}
                    onFocus={() => setExistingSuggestionsOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setExistingSuggestionsOpen(false), 120);
                    }}
                    disabled={showModeBusy}
                    aria-label="Existing folder id"
                  />

                  {existingSuggestionsOpen && existingSuggestions.length > 0 && (
                    <div className="fp__folder-suggest" role="listbox" aria-label="Existing folder suggestions">
                      {existingSuggestions.map((folder) => (
                        <button
                          key={`existing-${folder.id}`}
                          type="button"
                          className="fp__folder-suggest-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setExistingFolderId(String(folder.id));
                            setExistingFolder(folder);
                            setExistingError("");
                            setExistingSuggestionsOpen(false);
                          }}
                        >
                          {folder.id} - {folder.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {existingFolder && <TickBadge title={`Folder ${existingFolder.id} validated`} />}
              </div>
            </div>
          ) : (
            <div className="fp__squash-fields fp__squash-fields--new">
              <div className="fp__squash-field">
                <div className="fp__field-block fp__field-block--compact">
                  <label className="fp__field-label" htmlFor="fp-squash-parent-folder-id">Parent folder id *</label>
                  <input
                    id="fp-squash-parent-folder-id"
                    type="text"
                    className={`fp__input fp__squash-input${parentError ? " fp__input--error" : ""}`}
                    placeholder="Enter parent folder id"
                    value={parentFolderId}
                    onChange={(e) => {
                      setParentFolderId(e.target.value);
                      setParentFolder(null);
                      setCreatedFolder(null);
                      setParentError("");
                      setStatus(null);
                    }}
                    onFocus={() => setParentSuggestionsOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setParentSuggestionsOpen(false), 120);
                    }}
                    disabled={showModeBusy}
                    aria-label="Parent folder id"
                  />

                  {parentSuggestionsOpen && parentSuggestions.length > 0 && (
                    <div className="fp__folder-suggest" role="listbox" aria-label="Parent folder suggestions">
                      {parentSuggestions.map((folder) => (
                        <button
                          key={`parent-${folder.id}`}
                          type="button"
                          className="fp__folder-suggest-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setParentFolderId(String(folder.id));
                            setParentFolder(folder);
                            setCreatedFolder(null);
                            setParentError("");
                            setParentSuggestionsOpen(false);
                          }}
                        >
                          {folder.id} - {folder.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {parentFolder && <TickBadge title={`Parent folder ${parentFolder.id} validated`} />}
              </div>

              <div className="fp__squash-field">
                <div className="fp__field-block fp__field-block--compact">
                  <label className="fp__field-label" htmlFor="fp-squash-new-folder-name">New folder name *</label>
                  <input
                    id="fp-squash-new-folder-name"
                    type="text"
                    className="fp__input fp__squash-input"
                    placeholder="Enter new folder name"
                    value={newFolderName}
                    onChange={(e) => {
                      setNewFolderName(e.target.value);
                      setCreatedFolder(null);
                      setStatus(null);
                    }}
                    disabled={showModeBusy}
                    aria-label="New folder name"
                  />
                </div>
                {createdFolder && <TickBadge title="Folder name saved" />}
              </div>

              <div className="fp__squash-field">
                <div className="fp__field-block fp__field-block--compact">
                  <label className="fp__field-label" htmlFor="fp-squash-new-folder-description">New folder description *</label>
                  <input
                    id="fp-squash-new-folder-description"
                    type="text"
                    className="fp__input fp__squash-input"
                    placeholder="Enter new folder description"
                    value={newFolderDescription}
                    onChange={(e) => {
                      setNewFolderDescription(e.target.value);
                      setCreatedFolder(null);
                      setStatus(null);
                    }}
                    disabled={showModeBusy}
                    aria-label="New folder description"
                  />
                </div>
                {createdFolder && <TickBadge title="Folder description saved" />}
              </div>
            </div>
          )}

          {(existingError || parentError) && (
            <div className="fp__export-errors">
              {existingError && <span className="fp__validation-error">{existingError}</span>}
              {parentError && <span className="fp__validation-error">{parentError}</span>}
            </div>
          )}

          {status && (
            <div className={`fp__status fp__status--${status.type}`} role="alert">
              {status.message}
            </div>
          )}

        </div>
      )}

      <div className="fp__squash-actions">
        <button
          type="button"
          className="fp__btn fp__btn--grey"
          onClick={handleSaveToSquash}
          disabled={saving}
          title={panelOpen ? "Save generated test cases to Squash" : "Open Save to Squash options"}
        >
          {saving ? "Saving..." : "Save to Squash"}
        </button>
        {panelOpen && (
          <button
            type="button"
            className="fp__btn fp__btn--ghost"
            onClick={handleClose}
            disabled={saving}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}