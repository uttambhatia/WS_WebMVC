import React from "react";
import "./stepper.css";

const IconUpload = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    <polyline points="7 9 12 4 17 9" />
    <line x1="12" y1="4" x2="12" y2="16" />
  </svg>
);

const IconClipboardList = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
    <line x1="7" y1="12" x2="7" y2="12" />
    <line x1="7" y1="16" x2="7" y2="16" />
  </svg>
);

const IconCheckCircle = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const IconWand = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 8V6" />
    <path d="M19 5h-2" />
    <path d="M13 5h-2" />
    <path d="M5 15l6-6 4 4-6 6-4-4z" />
    <path d="M18 18h.01" />
  </svg>
);

const IconFileCheck = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);

const IconFlask = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10 2v6.5l-5.2 9A2 2 0 0 0 6.54 21h10.92a2 2 0 0 0 1.74-3.5L14 8.5V2" />
    <path d="M8 2h8" />
    <path d="M7 15h10" />
  </svg>
);

const IconListChecks = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 5l2 2 3-3" />
    <path d="M3 11l2 2 3-3" />
    <path d="M3 17l2 2 3-3" />
    <line x1="13" y1="6" x2="21" y2="6" />
    <line x1="13" y1="12" x2="21" y2="12" />
    <line x1="13" y1="18" x2="21" y2="18" />
  </svg>
);

const IconDoneTick = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="10"
    height="10"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DEFAULT_STEPS = [
  "Upload / Input",
  "Requirement Validation",
  "Requirement Approval",
  "Context Refinement",
  "Context Approval",
  "Test Generation",
  "Test Case Evaluation",
];

const STEP_ICONS = {
  "Upload / Input": IconUpload,
  "Requirement Validation": IconClipboardList,
  "Requirement Approval": IconCheckCircle,
  "Context Refinement": IconWand,
  "Context Approval": IconFileCheck,
  "Test Generation": IconFlask,
  "Test Case Evaluation": IconListChecks,
};

export default function WorkflowStepper({
  currentStep = 1,
  steps = DEFAULT_STEPS,
  className = "",
}) {
  return (
    <div className={["workflow-stepper", className].filter(Boolean).join(" ")}>
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const isDone = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        const Icon = STEP_ICONS[label];

        return (
          <div key={label} className="workflow-stepper__item">
            <div className="workflow-stepper__circle-label">
              <div
                className={[
                  "workflow-stepper__circle",
                  isDone ? "workflow-stepper__circle--done" : "",
                  isActive ? "workflow-stepper__circle--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {Icon ? <Icon /> : stepNumber}
                {isDone && (
                  <span className="workflow-stepper__done-badge" aria-hidden="true">
                    <IconDoneTick />
                  </span>
                )}
              </div>

              <div
                className={[
                  "workflow-stepper__label",
                  isActive ? "workflow-stepper__label--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {label}
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div className="workflow-stepper__line-wrapper">
                <div
                  className={[
                    "workflow-stepper__line",
                    isDone ? "workflow-stepper__line--done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
