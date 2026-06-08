/**
 * ApproveReject — textarea + Approve/Reject action composite.
 *
 * Props:
 *   approveService  {async fn(text) → any}   Called on Approve click.
 *   rejectService   {async fn(text) → any}   Called on Reject click.
 *   maxLength       {number}                  Character limit (default: 500).
 *   placeholder     {string}                  Textarea placeholder.
 *   onApprove       {fn(result)}              Called after successful approve.
 *   onReject        {fn(result)}              Called after successful reject.
 *   disabled        {boolean}
 *   className       {string}
 */

import { useState } from "react";
import "./ApproveReject.css";

function SpinnerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="42 14"/>
    </svg>
  );
}

export default function ApproveReject({
  approveService,
  rejectService,
  maxLength = 500,
  placeholder = "Add a comment (optional)…",
  // Controlled textarea
  value,
  onChange,
  // Label / validation
  label = null,
  required = false,
  commentError = null,
  onApprove,
  onReject,
  disabled = false,
  className = "",
  middleSlot = null,
}) {
  const [internalText, setInternalText] = useState("");
  const isControlled = value !== undefined && onChange !== undefined;
  const text = isControlled ? value : internalText;
  const setText = isControlled ? onChange : setInternalText;
  const [loading, setLoading] = useState(null); // null | 'approve' | 'reject'
  const [status, setStatus] = useState(null);   // null | { type, message }

  const remaining = maxLength - text.length;
  const nearLimit = remaining <= 50 && remaining > 0;
  const atLimit = remaining <= 0;

  const handleAction = async (type) => {
    const service = type === "approve" ? approveService : rejectService;
    if (!service || loading) return;
    setLoading(type);
    setStatus(null);
    try {
      const result = await service(text);
      setStatus({ type: "success", message: `${type === "approve" ? "Approved" : "Rejected"} successfully.` });
      if (type === "approve") onApprove?.(result);
      else onReject?.(result);
    } catch (err) {
      const msg = err?.response?.data?.message ?? err?.message ?? `${type} failed.`;
      setStatus({ type: "error", message: msg });
    } finally {
      setLoading(null);
    }
  };

  const busy = loading !== null;
  const commentBlocking = required && !text.trim();

  return (
    <div className={`ar${className ? ` ${className}` : ""}`}>
      {/* Textarea */}
      <div className="ar__textarea-wrap">
        {label && (
          <label className="ar__label">
            {label}{required && <span className="ar__required"> *</span>}
          </label>
        )}
        <textarea
          className="ar__textarea"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) setText(e.target.value);
          }}
          disabled={disabled || busy}
          aria-label="Comment"
          maxLength={maxLength}
        />
        <span
          className={[
            "ar__counter",
            nearLimit ? "ar__counter--near-limit" : "",
            atLimit ? "ar__counter--at-limit" : "",
          ].filter(Boolean).join(" ")}
          aria-live="polite"
        >
          {text.length} / {maxLength}
        </span>
        {commentError && (
          <span className="ar__comment-error" role="alert">{commentError}</span>
        )}
      </div>

      {/* Status banner */}
      {status && (
        <div className={`ar__status ar__status--${status.type}`} role="alert">
          {status.message}
        </div>
      )}

      {/* Optional slot rendered between textarea and action buttons */}
      {middleSlot}

      {/* Action buttons */}
      <div className="ar__actions">
        <button
          type="button"
          className="ar__btn ar__btn--approve"
          onClick={() => handleAction("approve")}
          disabled={disabled || busy || commentBlocking}
        >
          {loading === "approve" ? (
            <SpinnerIcon className="ar__spinner" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.801 10A10 10 0 1 1 17 3.335" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          )}
          Approve
        </button>
        <button
          type="button"
          className="ar__btn ar__btn--reject"
          onClick={() => handleAction("reject")}
          disabled={disabled || busy || commentBlocking}
        >
          {loading === "reject" ? (
            <SpinnerIcon className="ar__spinner" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          )}
          Reject
        </button>
      </div>
    </div>
  );
}
