import { useEffect, useMemo, useRef, useState } from "react";

const ARTICLE_STEPS = [
  {
    id: "upload",
    title: "Upload Requirements",
    subtitle: "Add requirement documents and supporting context.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="m17 8-5-5-5 5" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      </svg>
    ),
  },
  {
    id: "validation",
    title: "Validation",
    subtitle: "Run quality checks and business rule validations.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4" />
        <path d="M12 16h4" />
        <path d="M8 11h.01" />
        <path d="M8 16h.01" />
      </svg>
    ),
  },
  {
    id: "refinement",
    title: "Context Refinements",
    subtitle: "Sharpen prompts and scenario boundaries before generation.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
        <path d="M20 2v4" />
        <path d="M22 4h-4" />
        <circle cx="4" cy="20" r="2" />
      </svg>
    ),
  },
  {
    id: "hilt",
    title: "HILT",
    subtitle: "Apply human-in-the-loop triage and confidence scoring.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        <path d="M7 10v12" />
      </svg>
    ),
  },
  {
    id: "generation",
    title: "Test Generation",
    subtitle: "Generate executable tests with mapped coverage outputs.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 12h11" />
        <path d="m17 16 4-4-4-4" />
        <path d="M21 6.344V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.344" />
      </svg>
    ),
  },
  {
    id: "evaluation",
    title: "Evaluation",
    subtitle: "Review outputs, compare outcomes, and finalize decisions.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 5h8" />
        <path d="M13 12h8" />
        <path d="M13 19h8" />
        <path d="m3 17 2 2 4-4" />
        <path d="m3 7 2 2 4-4" />
      </svg>
    ),
  },
];

function GenieLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.852 14.772-.383.923" />
      <path d="m10.852 9.228-.383-.923" />
      <path d="m13.148 14.772.382.924" />
      <path d="m13.531 8.305-.383.923" />
      <path d="m14.772 10.852.923-.383" />
      <path d="m14.772 13.148.923.383" />
      <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 0 0-5.63-1.446 3 3 0 0 0-.368 1.571 4 4 0 0 0-2.525 5.771" />
      <path d="M17.998 5.125a4 4 0 0 1 2.525 5.771" />
      <path d="M19.505 10.294a4 4 0 0 1-1.5 7.706" />
      <path d="M4.032 17.483A4 4 0 0 0 11.464 20c.18-.311.892-.311 1.072 0a4 4 0 0 0 7.432-2.516" />
      <path d="M4.5 10.291A4 4 0 0 0 6 18" />
      <path d="M6.002 5.125a3 3 0 0 0 .4 1.375" />
      <path d="m9.228 10.852-.923-.383" />
      <path d="m9.228 13.148-.923.383" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function RiskLabLandingPage({ onGetStarted }) {
  const cardsRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useMemo(
    () => () => {
      const node = cardsRef.current;
      if (!node) return;
      const overflow = node.scrollWidth > node.clientWidth + 2;
      setCanScrollPrev(overflow && node.scrollLeft > 2);
      setCanScrollNext(overflow && node.scrollLeft + node.clientWidth < node.scrollWidth - 2);
    },
    []
  );

  useEffect(() => {
    updateScrollState();
    const node = cardsRef.current;
    if (!node) return undefined;

    const onScroll = () => updateScrollState();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scrollCards = (direction) => {
    const node = cardsRef.current;
    if (!node) return;
    const shift = Math.max(240, Math.floor(node.clientWidth * 0.75));
    node.scrollBy({ left: direction * shift, behavior: "smooth" });
  };

  return (
    <section className="cm-landing" aria-label="RiskLab landing page">
      <div className="cm-landing__watermark cm-landing__watermark--top-left" aria-hidden="true" />
      <div className="cm-landing__watermark cm-landing__watermark--top-right" aria-hidden="true" />
      <div className="cm-landing__watermark cm-landing__watermark--bottom-left" aria-hidden="true" />
      <div className="cm-landing__watermark cm-landing__watermark--bottom-right" aria-hidden="true" />

      <div className="cm-landing__hero">
        <div className="cm-landing__logo-wrap" aria-hidden="true">
          <GenieLogo />
        </div>
        <h2 className="cm-landing__title">RiskLab Test Design Assistant</h2>
        <p className="cm-landing__description">
          Move from requirement intake to test evaluation in one guided flow designed for UBS delivery teams.
        </p>
      </div>

      <div className="cm-landing__carousel">
        <button
          type="button"
          className="cm-landing__nav cm-landing__nav--prev"
          onClick={() => scrollCards(-1)}
          disabled={!canScrollPrev}
          aria-label="Show previous steps"
        >
          <span aria-hidden="true">&#8592;</span>
        </button>

        <div className="cm-landing__cards" ref={cardsRef}>
          {ARTICLE_STEPS.map((step) => (
            <article key={step.id} className="cm-landing__card">
              <div className="cm-landing__card-info" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <div className="cm-landing__card-icon" aria-hidden="true">
                {step.icon}
              </div>
              <h3 className="cm-landing__card-title">{step.title}</h3>
              <p className="cm-landing__card-subtitle">{step.subtitle}</p>
            </article>
          ))}
        </div>

        <button
          type="button"
          className="cm-landing__nav cm-landing__nav--next"
          onClick={() => scrollCards(1)}
          disabled={!canScrollNext}
          aria-label="Show next steps"
        >
          <span aria-hidden="true">&#8594;</span>
        </button>
      </div>

      <div className="cm-landing__actions">
        <button type="button" className="cm-landing__get-started" onClick={onGetStarted}>
          <span>Get Started</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
