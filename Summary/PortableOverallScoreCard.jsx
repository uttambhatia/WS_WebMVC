import "./PortableOverallScoreCard.css";

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function asDisplayValue(value) {
  if (value == null || value === "") return "-";
  return String(value);
}

function findOverallScoreValue(data) {
  const scoreItem = data.find((item) => {
    const label = String(item?.label ?? "").trim().toLowerCase();
    return label === "overall score" || label === "overallscore";
  });

  const scoreValue = Number(scoreItem?.value);
  return clampPercentage(scoreValue);
}

export default function PortableOverallScoreCard({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const score = findOverallScoreValue(data);
  const scoreDegrees = (score / 100) * 360;

  return (
    <section className="posc" aria-label="Overall score overview">
      <div
        className="posc__donut"
        style={{
          background: `conic-gradient(var(--ubs-c-red) 0deg ${scoreDegrees}deg, var(--ubs-c-idle-bg) ${scoreDegrees}deg 360deg)`,
        }}
      >
        <div className="posc__donut-center">
          <span className="posc__percent">{score}%</span>
          <span className="posc__title">Overall Score</span>
        </div>
      </div>

      <div className="posc__details" role="list" aria-label="Score details">
        {data.map((item, index) => (
          <div className="posc__detail-row" role="listitem" key={`${item?.label ?? "item"}-${index}`}>
            <span className="posc__label">{asDisplayValue(item?.label)}</span>
            <span className="posc__separator">:</span>
            <span className="posc__value">{asDisplayValue(item?.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
