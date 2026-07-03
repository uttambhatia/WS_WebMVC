/**
 * FileUploader — drag-and-drop / click-to-browse file upload component.
 *
 * Props:
 *   multiple       {boolean}          Allow multiple file selection (default: false)
 *   accept         {string}           File type filter e.g. ".pdf,.docx" (default: "*")
 *   maxSizeBytes   {number}           Per-file size limit in bytes (default: unlimited)
 *   service        {async fn}         Called with File (single) or File[] (multiple) on upload
 *   onSuccess      {fn(response)}     Called after successful upload
 *   onError        {fn(message)}      Called on validation or upload error
 *   label          {string}           Custom drop-zone label (optional)
 *   disabled       {boolean}          Disable all interactions
 *   className      {string}
 */

import { useCallback, useRef, useState } from "react";
import "./FileUploader.css";

/* ---- Icons (inline SVG, no deps) ---- */
function UploadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V8m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckCircleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ErrorIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 2l8 8M10 2 2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
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

/* ---- Helpers ---- */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFiles(files, { accept, maxSizeBytes, multiple }) {
  const errors = [];
  if (!multiple && files.length > 1) {
    return ["Only a single file is allowed."];
  }
  const acceptExts = accept && accept !== "*"
    ? accept.split(",").map((s) => s.trim().toLowerCase())
    : null;

  for (const file of files) {
    if (acceptExts) {
      const ext = "." + file.name.split(".").pop().toLowerCase();
      const mime = file.type.toLowerCase();
      const ok = acceptExts.some((a) => a === ext || mime.startsWith(a.replace("*", "")));
      if (!ok) errors.push(`"${file.name}" — unsupported file type (allowed: ${accept})`);
    }
    if (maxSizeBytes && file.size > maxSizeBytes) {
      errors.push(`"${file.name}" exceeds size limit (${formatBytes(maxSizeBytes)})`);
    }
  }
  return errors;
}

/* ---- Component ---- */
export default function FileUploader({
  multiple = false,
  accept = "*",
  maxSizeBytes,
  service,
  onSuccess,
  onError,
  label,
  listLabel,
  files: controlledFiles,
  onFilesChange,
  showActions = true,
  disabled = false,
  className = "",
}) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null); // null | { type: 'success'|'error', message }
  const inputRef = useRef(null);
  const dragCounter = useRef(0);

  const isControlled = Array.isArray(controlledFiles);
  const currentFiles = isControlled ? controlledFiles : files;

  const setCurrentFiles = useCallback((updater) => {
    const nextFiles = typeof updater === "function"
      ? updater(currentFiles)
      : updater;

    if (!isControlled) {
      setFiles(nextFiles);
    }
    onFilesChange?.(nextFiles);
  }, [currentFiles, isControlled, onFilesChange]);

  const addFiles = useCallback((incoming) => {
    const arr = Array.from(incoming);
    const errors = validateFiles(arr, { accept, maxSizeBytes, multiple });
    if (errors.length) {
      const msg = errors.join("; ");
      setStatus({ type: "error", message: msg });
      onError?.(msg);
      return;
    }
    setStatus(null);
    setCurrentFiles(multiple ? (prev) => [...prev, ...arr] : arr);
  }, [accept, maxSizeBytes, multiple, onError, setCurrentFiles]);

  /* Drag events */
  const onDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragging(false);
  };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (disabled || uploading) return;
    addFiles(e.dataTransfer.files);
  };

  const onInputChange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (idx) =>
    setCurrentFiles((prev) => prev.filter((_, i) => i !== idx));

  const onUpload = async () => {
    if (!currentFiles.length || !service || uploading) return;
    setUploading(true);
    setProgress(0);
    setStatus(null);
    try {
      const onUploadProgress = (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded * 100) / evt.total));
      };
      const payload = multiple ? currentFiles : currentFiles[0];
      const result = await service(payload, onUploadProgress);
      setProgress(100);
      setStatus({ type: "success", message: "Upload successful." });
      onSuccess?.(result);
      setCurrentFiles([]);
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Upload failed.";
      setStatus({ type: "error", message: msg });
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  /* Zone state class */
  const zoneClass = [
    "fu__zone",
    dragging ? "fu__zone--dragging" : "",
    uploading ? "fu__zone--uploading" : "",
    status?.type === "success" ? "fu__zone--success" : "",
    status?.type === "error" ? "fu__zone--error" : "",
  ].filter(Boolean).join(" ");

  const acceptAttr = accept === "*" ? undefined : accept;

  const hintParts = [];
  if (accept && accept !== "*") hintParts.push(accept);
  if (maxSizeBytes) hintParts.push(`max ${formatBytes(maxSizeBytes)}`);

  /* Zone icon */
  let ZoneIcon = UploadIcon;
  if (status?.type === "success") ZoneIcon = CheckCircleIcon;
  if (status?.type === "error") ZoneIcon = ErrorIcon;

  return (
    <div className={`fu${className ? ` ${className}` : ""}`}>
      {/* Drop zone */}
      <div
        className={zoneClass}
        onDragEnter={!disabled ? onDragEnter : undefined}
        onDragLeave={!disabled ? onDragLeave : undefined}
        onDragOver={!disabled ? onDragOver : undefined}
        onDrop={!disabled ? onDrop : undefined}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={label ?? "Upload file area — click or drag files here"}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !uploading)
            inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="fu__input"
          multiple={multiple}
          accept={acceptAttr}
          disabled={disabled || uploading}
          onChange={onInputChange}
          onClick={(e) => e.stopPropagation()}
          aria-hidden="true"
          tabIndex={-1}
        />
        <ZoneIcon className="fu__icon" />
        <p className="fu__label">
          {label ?? (
            <>
              <strong>Click to browse</strong> or drag &amp; drop files here
            </>
          )}
        </p>
        {hintParts.length > 0 && (
          <p className="fu__hint">{hintParts.join(" · ")}</p>
        )}
        {uploading && (
          <>
            <div className="fu__progress">
              <div className="fu__progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <span className="fu__progress-label">{progress}%</span>
          </>
        )}
      </div>

      {/* File list */}
      {currentFiles.length > 0 && (
        <>
          {listLabel ? <span className="fu__list-label">{listLabel}</span> : null}
        <ul className="fu__list">
          {currentFiles.map((f, i) => (
            <li key={i} className="fu__file-item">
              <span className="fu__file-name" title={f.name}>{f.name}</span>
              <span className="fu__file-size">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="fu__remove-btn"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${f.name}`}
                disabled={uploading}
              >
                <XIcon />
              </button>
            </li>
          ))}
        </ul>
        </>
      )}

      {/* Status message */}
      {status && (
        <div className={`fu__status fu__status--${status.type}`} role="alert">
          {status.message}
        </div>
      )}

      {/* Actions */}
      {showActions && (
      <div className="fu__actions">
        {currentFiles.length > 0 && !uploading && (
          <button
            type="button"
            className="fu__btn fu__btn--clear"
            onClick={() => { setCurrentFiles([]); setStatus(null); }}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          className="fu__btn fu__btn--primary"
          onClick={onUpload}
          disabled={!files.length || uploading || disabled || !service}
        >
          {uploading ? (
            <>
              <SpinnerIcon className="fu__spinner" />
              Uploading…
            </>
          ) : (
            "Upload"
          )}
        </button>
      </div>
      )}
    </div>
  );
}
