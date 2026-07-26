import { useEffect, useMemo, useState } from "react";
import "./PortableStackedDeckPanel.css";

function buildInitialIndices(sections) {
  return (sections || []).reduce((acc, section) => {
    acc[section.id] = 0;
    return acc;
  }, {});
}

function ViewAllEyeIcon() {
  return (
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
      className="psdp__view-all-icon"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PortableStackedDeckPanel({
  title,
  subtitle,
  sections = [],
  renderCard,
  viewAllLabel = "View All",
  backLabel = "Back",
}) {
  const [activeCardIndices, setActiveCardIndices] = useState(() => buildInitialIndices(sections));
  const [allViewSectionId, setAllViewSectionId] = useState(null);
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === allViewSectionId) || null,
    [sections, allViewSectionId]
  );
  const selectedSectionCards = selectedSection?.cards || [];
  const allViewOpen = Boolean(selectedSection);

  useEffect(() => {
    setActiveCardIndices((prev) => {
      const next = buildInitialIndices(sections);
      return { ...next, ...prev };
    });
  }, [sections]);

  const handleNextCard = (sectionId, cardCount) => {
    if (cardCount < 2) {
      return;
    }
    setActiveCardIndices((prev) => ({
      ...prev,
      [sectionId]: ((prev[sectionId] ?? 0) + 1) % cardCount,
    }));
  };

  return (
    <section className="psdp" aria-label={title || "Portable stacked deck panel"}>
      <header className="psdp__header">
        <div className="psdp__header-copy">
          {title ? <h1 className="psdp__title">{title}</h1> : null}
          {subtitle ? <p className="psdp__subtitle">{subtitle}</p> : null}
        </div>

      </header>

      {allViewOpen ? (
        <section
          className="psdp__expanded"
          aria-label={`${selectedSection?.title || "Section"} containers view`}
        >
          <div className="psdp__overlay-topbar">
            <button type="button" className="psdp__back-btn" onClick={() => setAllViewSectionId(null)}>
              ← Back
            </button>
            <h2 className="psdp__overlay-title">All Containers: {selectedSection?.title}</h2>
          </div>

          <div
            className="psdp__overlay-row"
            style={{ "--psdp-card-count": Math.max(selectedSectionCards.length, 1) }}
          >
            {selectedSectionCards.map((card, cardIndex) => (
              <article key={`${selectedSection.id}-${card.id || cardIndex}`} className="psdp__overlay-card">
                <p className="psdp__overlay-section-name">{selectedSection.title}</p>
                <div className="psdp__overlay-card-head">
                  <h3 className="psdp__overlay-card-title">{card.title || `Container ${cardIndex + 1}`}</h3>
                  <p className="psdp__overlay-card-index">
                    {cardIndex + 1} / {selectedSectionCards.length}
                  </p>
                </div>
                {renderCard({ card, section: selectedSection, viewMode: "all" })}
              </article>
            ))}
          </div>

        </section>
      ) : null}

      {!allViewOpen ? (
        <div className="psdp__sections">
          {sections.map((section) => {
            const cards = section.cards || [];
            const activeIndex = Math.min(activeCardIndices[section.id] ?? 0, Math.max(cards.length - 1, 0));
            const activeCard = cards[activeIndex];
            const wrapsToStart = cards.length > 1 && activeIndex === cards.length - 1;
            const nextCard = cards.length > 0 ? cards[(activeIndex + 1) % cards.length] : null;
            const nextCardLabel =
              cards.length > 1
                ? nextCard?.title || nextCard?.subtitle || "Next Container"
                : "Next Container";
            const nextButtonLabel = wrapsToStart ? `← ${nextCardLabel}` : `${nextCardLabel} →`;
            const hasCards = cards.length > 0;

            return (
              <article key={section.id} className="psdp__section">
                <header className="psdp__section-header">
                  <div className="psdp__section-header-copy">
                    <h2 className="psdp__section-title">{section.title}</h2>
                    {section.subtitle ? <p className="psdp__section-subtitle">{section.subtitle}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="psdp__view-all-btn"
                    onClick={() => setAllViewSectionId(section.id)}
                    disabled={cards.length === 0}
                  >
                    <ViewAllEyeIcon />
                    {viewAllLabel}
                  </button>
                </header>

                <div className="psdp__deck-frame">
                  {hasCards ? (
                    <div className="psdp__card-shell" key={activeCard.id || activeIndex}>
                      <div className="psdp__card-head">
                        {activeCard.title ? <h3 className="psdp__card-title">{activeCard.title}</h3> : <span />}
                        <button
                          type="button"
                          className="psdp__step-btn psdp__step-btn--inline"
                          onClick={() => handleNextCard(section.id, cards.length)}
                          disabled={cards.length < 2}
                        >
                          {nextButtonLabel}
                        </button>
                      </div>
                      {renderCard({
                        card: activeCard,
                        section,
                        viewMode: "deck",
                        deckState: {
                          cards,
                          activeIndex,
                          onSelectCard: (cardIndex) =>
                            setActiveCardIndices((prev) => ({
                              ...prev,
                              [section.id]: cardIndex,
                            })),
                        },
                      })}
                    </div>
                  ) : (
                    <div className="psdp__empty">No containers configured.</div>
                  )}
                </div>

              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
