import DataTable from "../DataTable/DataTable";
import PortableStackedDeckPanel from "./PortableStackedDeckPanel";
import "./PortableStackedDeckPanelDemo.css";

const SINGLE_COLUMN = [{ key: "script", label: "Script" }];

const SECTION_DECKS = [
  {
    id: "section-a",
    title: "Execute Tests",
    subtitle: "RiskLab controls for current run readiness and script clusters.",
    cards: [
      {
        id: "a-1",
        title: "Priority Batch",
        subtitle: "High risk coverage set",
        scripts: ["KYC_Validation_001", "Onboarding_Regression_004", "PaymentRules_Risk_009"],
      },
      {
        id: "a-2",
        title: "Eligibility Cluster",
        subtitle: "Retail eligibility scripts",
        scripts: ["Eligibility_Check_014", "IncomeBand_Assessment_019", "CreditFloor_Matrix_022"],
      },
    ],
  },
  {
    id: "section-b",
    title: "Schedule Tests",
    subtitle: "Future execution windows grouped by timezone and operation lane.",
    cards: [
      {
        id: "b-1",
        title: "Asia Morning Window",
        subtitle: "Early release smoke",
        scripts: ["APAC_Smoke_002", "TradeRules_APAC_007", "CoreJourneys_APAC_011"],
      },
      {
        id: "b-2",
        title: "Europe Midday Window",
        subtitle: "Functional and controls pass",
        scripts: ["EMEA_Functional_003", "SettlementFlow_008", "CrossBorder_015"],
      },
    ],
  },
];

function renderCardContent({ card, viewMode, deckState }) {
  const rows = (card.scripts || []).map((script) => ({ script }));
  const showDeckDots =
    viewMode === "deck" &&
    Array.isArray(deckState?.cards) &&
    deckState.cards.length > 1 &&
    typeof deckState?.onSelectCard === "function";

  return (
    <div className={`posc-demo__card-body${viewMode === "all" ? " posc-demo__card-body--all" : ""}`}>
      <div className="posc-demo__subtitle-row">
        {card.subtitle ? <p className="posc-demo__card-subtitle">{card.subtitle}</p> : null}
        {showDeckDots ? (
          <div className="posc-demo__dot-nav" role="tablist" aria-label="Container navigation">
            {deckState.cards.map((deckCard, cardIndex) => {
              const isActive = cardIndex === deckState.activeIndex;
              return (
                <button
                  key={deckCard.id || `dot-${cardIndex}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Show container ${cardIndex + 1}`}
                  className={`posc-demo__dot${isActive ? " posc-demo__dot--active" : ""}`}
                  onClick={() => deckState.onSelectCard(cardIndex)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      <DataTable
        columns={SINGLE_COLUMN}
        data={rows}
        pageSize={4}
        sortableColumns={["script"]}
        searchableColumns={["script"]}
        paginationPlacement="bottom"
      />
    </div>
  );
}

export default function PortableStackedDeckPanelDemo({ sections = SECTION_DECKS } = {}) {
  return (
    <div className="posc-demo" aria-label="Portable stacked deck demo page">
      <PortableStackedDeckPanel
        title="Portable Stacked Deck Demo"
        subtitle="Reusable deck sections with stepper controls, quick navigation, and a full-width section comparison view."
        sections={sections}
        viewAllLabel="View All"
        backLabel="Back to Deck View"
        renderCard={renderCardContent}
      />
    </div>
  );
}
