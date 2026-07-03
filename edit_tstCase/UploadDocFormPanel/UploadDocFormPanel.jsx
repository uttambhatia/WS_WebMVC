/**
 * UploadDocFormPanel — Stage 2 form: upload via Gitlab URL or file.
 *
 * StageFlowPanel interface: validate() / submit()
 *
 * Initialization props:
 *   title              {string}
 *   gitlabService      {async fn(taskId, url, token) → any}
 *   documentService    {async fn(taskId, file, supportingFile, onProgress) → any}
 *   completeService    {async fn(taskId) → any}   Called after successful upload.
 *
 * serviceData from StageFlowPanel stage service is expected to be the taskId string.
 */

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import FileUploader from "../../FileUploader/FileUploader";
import "../FormPanel.css";

function SpinnerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42 14"/>
    </svg>
  );
}

const UploadDocFormPanel = forwardRef(function UploadDocFormPanel(
  {
    serviceData,       // taskId string from SFP stage service
    stageStatus,
    onSubmitStart,
    onSubmitSuccess,
    onSubmitError,
    // Wiring-time
    title = "Upload Requirement Document",
    subtitle = "Provide the requirement document via a GitLab URL or direct file upload.",
    gitlabService,
    documentService,
    completeService,
    readOnly = false,
  },
  ref
) {
  // serviceData may be a plain taskId string (from the stage entry service)
  // or an object { taskId, uploadSource, fileName|gitlabUrl } after submission / from snapshot.
  const taskId =
    serviceData && typeof serviceData === "object"
      ? serviceData.taskId ?? null
      : serviceData ?? null;

  const [source, setSource] = useState(null); // 'gitlab' | 'document'
  const [gitlabUrl, setGitlabUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [requirementFiles, setRequirementFiles] = useState([]);
  const [supportingFiles, setSupportingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [validationError, setValidationError] = useState(null);
  // submit() for the document path must not signal success if upload did not complete.
  const documentUploadedRef = useRef(false);
  // Tracks upload metadata (source + file name / gitlabUrl) to include in the success payload.
  const uploadInfoRef = useRef(null);

  /* ---- Validation logic ---- */
  const validate = () => {
    if (!source) {
      setValidationError("Please select a source of requirement.");
      return false;
    }
    if (source === "gitlab" && (!gitlabUrl.trim() || !gitlabToken.trim())) {
      setValidationError("Gitlab URL and Gitlab Token are required.");
      return false;
    }
    if (source === "document" && requirementFiles.length === 0) {
      setValidationError("Requirement Document is required.");
      return false;
    }
    setValidationError(null);
    return true;
  };

  /* ---- StageFlowPanel contract ---- */
  useImperativeHandle(ref, () => ({
    validate,
    async submit() {
      if (!validate()) return { success: false };
      if (source === "gitlab") {
        return handleGitlabUpload();
      }
      // Only signal success if that upload actually completed successfully.
      if (!documentUploadedRef.current) return { success: false };
      onSubmitSuccess?.({ taskId, ...(uploadInfoRef.current ?? { uploadSource: "document" }) });
      return { success: true };
    },
  }));

  /* Gitlab upload handler */
  const handleGitlabUpload = async () => {
    if (!validate() || uploading) return { success: false };
    onSubmitStart?.();
    setUploading(true);
    setStatus(null);
    try {
      await gitlabService?.(taskId, gitlabUrl, gitlabToken);
      await completeService?.(taskId);
      setStatus({ type: "success", message: "Upload completed successfully." });
      uploadInfoRef.current = { uploadSource: "gitlab", gitlabUrl };
      onSubmitSuccess?.({ taskId, uploadSource: "gitlab", gitlabUrl });
      return { success: true };
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Upload failed.";
      setStatus({ type: "error", message: msg });
      onSubmitError?.(msg);
      return { success: false };
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (!validate() || uploading || !taskId || requirementFiles.length === 0) {
      return;
    }

    onSubmitStart?.();
    setUploading(true);
    setStatus(null);
    documentUploadedRef.current = false;
    try {
      const requirementFile = requirementFiles[0];
      await documentService?.(taskId, requirementFile, supportingFiles, undefined);
      await completeService?.(taskId);
      documentUploadedRef.current = true;
      uploadInfoRef.current = {
        uploadSource: "document",
        fileName: requirementFile.name,
        supportingFileNames: supportingFiles.map((f) => f.name),
      };
      onSubmitSuccess?.({ taskId, ...uploadInfoRef.current });
      setStatus({ type: "success", message: "Upload completed successfully." });
    } catch (err) {
      documentUploadedRef.current = false;
      const msg = err?.response?.data?.message ?? err?.message ?? "Upload failed.";
      setStatus({ type: "error", message: msg });
      onSubmitError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fp">
      {/* Title bar */}
      <div className="fp__titlebar">
        <div className="fp__titlebar-top">
          <h2 className="fp__title">{title}</h2>
        </div>
        {subtitle && <p className="fp__subtitle">{subtitle}</p>}
      </div>
      {taskId && (
        <span className="fp__task-id">
          Task Id: <strong>{taskId}</strong>
        </span>
      )}

      {readOnly ? (
        <div className="fp__body">
          {serviceData?.uploadSource ? (
            <>
              <div className="fp__readonly-fields">
                <div className="fp__field">
                  <span className="fp__field-label">Source of Requirement</span>
                  <span className="fp__value">
                    {serviceData.uploadSource === "gitlab" ? "GitLab" : "Document"}
                  </span>
                </div>
                {serviceData.uploadSource === "document" && (
                  <>
                    <div className="fp__field">
                      <span className="fp__field-label">Requirement Document</span>
                      <span className="fp__value">{serviceData.fileName ?? "—"}</span>
                    </div>
                    <div className="fp__field">
                      <span className="fp__field-label">Application / Business Context Document(s)</span>
                      <span className="fp__value">
                        {Array.isArray(serviceData.supportingFileNames) && serviceData.supportingFileNames.length > 0
                          ? serviceData.supportingFileNames.join(", ")
                          : "—"}
                      </span>
                    </div>
                  </>
                )}
                {serviceData.uploadSource === "gitlab" && (
                  <>
                    <div className="fp__field">
                      <span className="fp__field-label">GitLab URL</span>
                      <span className="fp__value">{serviceData.gitlabUrl ?? "—"}</span>
                    </div>
                    <div className="fp__field">
                      <span className="fp__field-label">GitLab Token</span>
                      <span className="fp__value">••••••••••••</span>
                    </div>
                  </>
                )}
              </div>
              <div className="fp__status fp__status--success">Document uploaded successfully.</div>
            </>
          ) : (
            <p className="fp__hint">No document was uploaded for this stage.</p>
          )}
        </div>
      ) : (
        <div className="fp__body">
          {/* Source of requirement */}
          <div className="fp__field">
            <label className="fp__field-label">
              Source of Requirement <span className="fp__required">*</span>
            </label>
            <div className="fp__radio-group" role="radiogroup" aria-label="Source of Requirement">
              <label className="fp__radio-label">
                <input
                  type="radio"
                  name="source"
                  value="gitlab"
                  checked={source === "gitlab"}
                  onChange={() => {
                    setSource("gitlab");
                    setValidationError(null);
                    setStatus(null);
                    setRequirementFiles([]);
                    setSupportingFiles([]);
                    documentUploadedRef.current = false;
                  }}
                  disabled={uploading}
                />
                Gitlab
              </label>
              <label className="fp__radio-label">
                <input
                  type="radio"
                  name="source"
                  value="document"
                  checked={source === "document"}
                  onChange={() => {
                    setSource("document");
                    setValidationError(null);
                    setStatus(null);
                    documentUploadedRef.current = false;
                  }}
                  disabled={uploading}
                />
                Document
              </label>
            </div>
            {validationError && (
              <span className="fp__validation-error" role="alert">{validationError}</span>
            )}
          </div>

          {/* Gitlab branch */}
          {source === "gitlab" && (
            <div className="fp__branch">
              <h3 className="fp__branch-title">Gitlab</h3>
              <div className="fp__row-2">
                <div className="fp__field">
                  <label className="fp__field-label">
                    Gitlab URL <span className="fp__required">*</span>
                  </label>
                  <input
                    type="url"
                    className="fp__input"
                    placeholder="https://gitlab.com/…"
                    value={gitlabUrl}
                    onChange={(e) => setGitlabUrl(e.target.value)}
                    disabled={uploading}
                  />
                </div>
                <div className="fp__field">
                  <label className="fp__field-label">
                    Gitlab Token <span className="fp__required">*</span>
                  </label>
                  <input
                    type="password"
                    className="fp__input"
                    placeholder="glpat-…"
                    value={gitlabToken}
                    onChange={(e) => setGitlabToken(e.target.value)}
                    disabled={uploading}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="fp__form-actions">
                <button
                  type="button"
                  className="fp__btn fp__btn--primary"
                  onClick={handleGitlabUpload}
                  disabled={uploading || !taskId || !gitlabUrl.trim() || !gitlabToken.trim()}
                >
                  {uploading ? <SpinnerIcon className="fp__spinner" /> : null}
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          )}

          {/* Document branch */}
          {source === "document" && (
            <div className="fp__branch">
              <h3 className="fp__branch-title">Upload Document</h3>

              <div className="fp__field">
                <label className="fp__field-label">Requirement Document <span className="fp__required">*</span></label>
                <FileUploader
                  multiple={false}
                  accept=".pdf,.docx,.doc,.txt,.md"
                  files={requirementFiles}
                  onFilesChange={(nextFiles) => {
                    setRequirementFiles((nextFiles || []).slice(0, 1));
                    documentUploadedRef.current = false;
                    setStatus(null);
                    setValidationError(null);
                    if (!nextFiles || nextFiles.length === 0) {
                      setSupportingFiles([]);
                    }
                  }}
                  label={
                    <>
                      <strong>Click to browse</strong> or drag and drop requirement document here
                    </>
                  }
                  listLabel="Requirement Document"
                  showActions={false}
                  disabled={uploading || !taskId}
                />
              </div>

              {requirementFiles.length > 0 && (
                <div className="fp__supporting-slide-in">
                  <div className="fp__field">
                    <label className="fp__field-label">Application/Business Context for TC Generation (Optional)</label>
                    <FileUploader
                      multiple
                      accept=".pdf,.docx,.doc,.txt,.md"
                      files={supportingFiles}
                      onFilesChange={(nextFiles) => {
                        setSupportingFiles(nextFiles || []);
                        documentUploadedRef.current = false;
                        setStatus(null);
                      }}
                      label={
                        <>
                          <strong>Click to browse</strong> or drag and drop supporting document(s) here
                        </>
                      }
                      listLabel="Application / Business Context Document(s)"
                      showActions={false}
                      disabled={uploading || !taskId}
                    />
                  </div>
                </div>
              )}

              <div className="fp__form-actions">
                <button
                  type="button"
                  className="fp__btn fp__btn--primary"
                  onClick={handleDocumentUpload}
                  disabled={uploading || !taskId || requirementFiles.length === 0}
                >
                  {uploading ? <SpinnerIcon className="fp__spinner" /> : null}
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className={`fp__status fp__status--${status.type}`} role="alert">
              {status.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default UploadDocFormPanel;
