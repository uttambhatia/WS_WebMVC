import { useEffect, useMemo, useState } from "react";
import "./CompareEvaluations.css";

const METRICS = [
  { key: "masterRqsScore", label: "Master RQS Score" },
  { key: "answerCorrectness", label: "Answer Correctness" },
  { key: "faithfulness", label: "Faithfulness" },
  { key: "relevancy", label: "Relevancy" },
  { key: "contextPrecision", label: "Context Precision" },
  { key: "contextRecall", label: "Context Recall" },
];

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 2.4l2.3 4.66 5.14.75-3.72 3.63.88 5.12L10 14.2 5.4 16.56l.88-5.12L2.56 7.81l5.14-.75L10 2.4Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMetric(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(2);
}

function formatDifference(first, second) {
  if (typeof first !== "number" || typeof second !== "number") {
    return "-";
  }
  const diff = second - first;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}`;
}

function RatingStars({ value = 0, onRate }) {
  return (
    <div className="cev__rating-stars">
      {Array.from({ length: 5 }, (_, index) => {
        const nextValue = index + 1;
        return (
          <button
            key={nextValue}
            type="button"
            className={`cev__rating-btn${nextValue <= value ? " is-active" : ""}`}
            onClick={() => onRate(nextValue)}
            aria-label={`Rate ${nextValue} stars`}
          >
            <StarIcon filled={nextValue <= value} />
          </button>
        );
      })}
    </div>
  );
}

export default function CompareEvaluationsTable({
  evaluations,
  selectedCaseIds,
  loading,
  error,
  showRatingStars = false,
  ratingsByCaseId = {},
  onRate,
}) {
  const [differenceCaseIds, setDifferenceCaseIds] = useState([]);

  useEffect(() => {
    if (selectedCaseIds.length <= 2) {
      setDifferenceCaseIds(selectedCaseIds.slice(0, 2));
      return;
    }

    setDifferenceCaseIds((prev) => {
      const valid = prev.filter((caseId) => selectedCaseIds.includes(caseId));
      if (valid.length === 2) return valid;
      return selectedCaseIds.slice(0, 2);
    });
  }, [selectedCaseIds]);

  const activeDifferenceIds = selectedCaseIds.length > 2
    ? differenceCaseIds
    : selectedCaseIds.slice(0, 2);

  const activeDifferencePair = activeDifferenceIds.map((caseId) => evaluations[caseId]).filter(Boolean);

  const toggleDifferenceCase = (caseId, checked) => {
    setDifferenceCaseIds((prev) => {
      if (!checked) {
        return prev.filter((value) => value !== caseId);
      }
      if (prev.includes(caseId)) {
        return prev;
      }
      if (prev.length >= 2) {
        // Keep only two checked by replacing the oldest selected evaluation.
        return [prev[1], caseId];
      }
      return [...prev, caseId];
    });
  };

  const selectedEvaluations = selectedCaseIds.map((caseId) => evaluations[caseId]).filter(Boolean);

  const tableHeaders = useMemo(() => (
    selectedEvaluations.map((evaluation, index) => ({
      caseId: evaluation.caseId,
      title: `Evaluation ${index + 1}`,
      metadata: evaluation,
    }))
  ), [selectedEvaluations]);

  if (loading) {
    return <p className="cev__state">Loading comparison metrics…</p>;
  }

  if (error) {
    return <p className="cev__state cev__state--error">{error}</p>;
  }

  if (selectedEvaluations.length < 2) {
    return <p className="cev__state">Select at least 2 completed evaluations to compare.</p>;
  }

  return (
    <div className="cev__panel">
      <div className="cev__panel-header">
        <div>
          <h3 className="cev__title">Winner Metrics Comparision</h3>
          <p className="cev__subtitle">Compare evaluation quality metrics and metadata side by side.</p>
        </div>
        {selectedCaseIds.length > 2 && (
          <p className="cev__difference-hint">Choose any two evaluations to calculate the difference column.</p>
        )}
      </div>

      <div className="cev__table-wrap">
        <table className="cev__table">
          <thead>
            <tr>
              <th>Metrics</th>
              {tableHeaders.map(({ caseId, title, metadata }) => {
                return (
                  <th key={caseId}>
                    {selectedCaseIds.length > 2 && (
                      <label className="cev__diff-toggle">
                        <input
                          type="checkbox"
                          checked={activeDifferenceIds.includes(caseId)}
                          onChange={(event) => toggleDifferenceCase(caseId, event.target.checked)}
                        />
                        <span>Use for difference</span>
                      </label>
                    )}
                    <div className="cev__col-title">{title}</div>
                    <div className="cev__col-meta">{metadata.creationDate}</div>
                    <div className="cev__col-meta">Winner: {metadata.winner}</div>
                    <div className="cev__col-meta">Model: {metadata.model}</div>
                    {showRatingStars && (
                      <RatingStars value={ratingsByCaseId[caseId] ?? 0} onRate={(rating) => onRate(caseId, rating, metadata)} />
                    )}
                  </th>
                );
              })}
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const firstMetric = activeDifferencePair[0]?.metrics?.[metric.key];
              const secondMetric = activeDifferencePair[1]?.metrics?.[metric.key];
              return (
                <tr key={metric.key}>
                  <td className="cev__metric-name">{metric.label}</td>
                  {tableHeaders.map(({ caseId }) => (
                    <td key={caseId}>{formatMetric(evaluations[caseId]?.metrics?.[metric.key])}</td>
                  ))}
                  <td className="cev__difference-cell">{formatDifference(firstMetric, secondMetric)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
