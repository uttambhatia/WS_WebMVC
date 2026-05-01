import { useEffect, useMemo, useRef, useState } from "react";
import "./CompareEvaluations.css";

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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

function HoverList({ title, items, onClose, renderItem, emptyText, headerMeta }) {
  return (
    <div className="cev__hover-card">
      <div className="cev__hover-card-header">
        <div className="cev__hover-card-title-wrap">
          <span>{title}</span>
          {headerMeta ? <span className="cev__hover-card-meta">{headerMeta}</span> : null}
        </div>
        <button type="button" className="cev__hover-close" onClick={onClose} aria-label={`Close ${title}`}>
          <CloseIcon />
        </button>
      </div>
      <div className="cev__hover-card-body">
        {items.length === 0 ? <p className="cev__hover-empty">{emptyText}</p> : items.map(renderItem)}
      </div>
    </div>
  );
}

export default function CompareEvaluationsToolbar({
  selectedItems,
  selectedCaseIds,
  onSelectedCaseIdsChange,
  maxComparisonCount = 2,
  onCompare,
  validationMessage,
  favourites = [],
  showRatingStars = false,
}) {
  const [showSelectedList, setShowSelectedList] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleDocumentMouseDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setShowSelectedList(false);
        setShowFavourites(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  const openFavourites = () => {
    setShowSelectedList(false);
    setShowFavourites(true);
  };

  const openSelected = () => {
    setShowFavourites(false);
    setShowSelectedList(true);
  };

  const selectedCount = selectedCaseIds.length;
  const favouriteCount = favourites.length;

  const selectedItemsById = useMemo(
    () => new Map(selectedItems.map((item) => [item.caseId, item])),
    [selectedItems]
  );

  const removeSelectedCase = (caseId) => {
    onSelectedCaseIdsChange(selectedCaseIds.filter((value) => value !== caseId));
  };

  return (
    <div className="cev__toolbar" ref={rootRef}>
      {showRatingStars && (
        <div
          className="cev__hover-group"
          onMouseEnter={openFavourites}
        >
          <button type="button" className="cev__btn cev__btn--secondary">
            <span className="cev__btn-icon"><StarIcon filled={true} /></span>
            Favourites {favouriteCount > 0 ? `(${favouriteCount})` : ""}
          </button>

          {showFavourites && (
            <div>
              <HoverList
                title="Favourite Evaluations"
                items={favourites}
                onClose={() => setShowFavourites(false)}
                emptyText="No favourite evaluations yet."
                renderItem={(item) => (
                  <div key={item.caseId} className="cev__hover-row">
                    <div>
                      <strong>{item.caseId}</strong>
                      <div className="cev__hover-meta">{item.creationDate} · {item.model}</div>
                    </div>
                    <div className="cev__hover-rating" aria-label={`Rated ${item.rating} stars`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <span key={index} className={index < item.rating ? "cev__star cev__star--filled" : "cev__star"}>
                          <StarIcon filled={index < item.rating} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              />
            </div>
          )}
        </div>
      )}

      <div
        className="cev__hover-group"
        onMouseEnter={openSelected}
      >
        <button type="button" className="cev__btn cev__btn--primary" onClick={onCompare}>
          Compare {selectedCount > 0 ? `(${selectedCount})` : ""}
        </button>

        {showSelectedList && (
          <div>
            <HoverList
              title="Selected Evaluations"
              headerMeta={`Max ${maxComparisonCount} items`}
              items={selectedCaseIds}
              onClose={() => setShowSelectedList(false)}
              emptyText="No evaluations selected."
              renderItem={(caseId) => {
                const item = selectedItemsById.get(caseId);
                return (
                  <div key={caseId} className="cev__hover-row">
                    <div>
                      <strong>{caseId}</strong>
                      <div className="cev__hover-meta">{item?.creationDate ?? "Creation date unavailable"}</div>
                    </div>
                    <button
                      type="button"
                      className="cev__remove-btn"
                      onClick={() => removeSelectedCase(caseId)}
                      aria-label={`Remove ${caseId} from comparison`}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                );
              }}
            />
          </div>
        )}
      </div>
      {validationMessage ? <p className="cev__validation">{validationMessage}</p> : null}
    </div>
  );
}
