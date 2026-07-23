import PortableOverallScoreCard from "./PortableOverallScoreCard";
import "./PortableOverallScoreCardDemo.css";

const SAMPLE_SCORE_DATA = [
  { label: "Overall score", value: 80 },
  { label: "Readiness", value: "Ready with warning" },
  { label: "Summary", value: "Uttamddkkd kkkd d" },
];

const SAMPLE_LOW_SCORE_DATA = [
  { label: "Overall score", value: 38 },
  { label: "Readiness", value: "Needs action" },
  { label: "Summary", value: "Data gaps found in requirements and edge-case coverage." },
];

export default function PortableOverallScoreCardDemo() {
  return (
    <section className="posc-demo" aria-label="Portable overall score demo">
      <header className="posc-demo__header">
        <h1 className="posc-demo__title">Portable Overall Score Demo</h1>
        <p className="posc-demo__subtitle">
          Shared verification view for the portable donut component using realistic sample data.
        </p>
      </header>

      <div className="posc-demo__grid">
        <article className="posc-demo__card">
          <h2 className="posc-demo__card-title">Sample A</h2>
          <PortableOverallScoreCard data={SAMPLE_SCORE_DATA} />
        </article>

        <article className="posc-demo__card">
          <h2 className="posc-demo__card-title">Sample B</h2>
          <PortableOverallScoreCard data={SAMPLE_LOW_SCORE_DATA} />
        </article>
      </div>
    </section>
  );
}
