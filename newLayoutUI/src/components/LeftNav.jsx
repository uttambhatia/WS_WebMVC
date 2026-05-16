import { useEffect, useState } from "react";
import "./left-nav.css";

const MOBILE_BREAKPOINT = 768;

export default function LeftNav({ items = [], selectedId, onSelect, menuTitle = "Menu" }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          className="left-nav__hamburger"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {mobileOpen ? (
              <>
                <line x1="4" y1="4" x2="20" y2="20" />
                <line x1="20" y1="4" x2="4" y2="20" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {mobileOpen && (
          <button
            type="button"
            className="left-nav__backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
        )}

        <aside className={`left-nav left-nav--mobile${mobileOpen ? " left-nav--mobile-open" : ""}`}>
          <div className="left-nav__header">
            <span className="left-nav__title">{menuTitle}</span>
            <button
              type="button"
              className="left-nav__mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="4" x2="20" y2="20" />
                <line x1="20" y1="4" x2="4" y2="20" />
              </svg>
            </button>
          </div>
          <nav className="left-nav__body" aria-label="Left navigation">
            <ul className="left-nav__list">
              {items.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <li className="left-nav__item" key={item.id}>
                    <button
                      type="button"
                      className={`left-nav__button ${isSelected ? "left-nav__button--selected" : ""}`}
                      onClick={() => { onSelect?.(item.id); setMobileOpen(false); }}
                    >
                      <span className="left-nav__icon" aria-hidden="true">{item.icon}</span>
                      <span className="left-nav__text">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </>
    );
  }

  return (
    <aside className={`left-nav${collapsed ? " left-nav--collapsed" : ""}`}>
      <div className="left-nav__header">
        {!collapsed && <span className="left-nav__title">{menuTitle}</span>}
        <button
          type="button"
          className={`left-nav__collapse-toggle${collapsed ? " left-nav__collapse-toggle--collapsed" : ""}`}
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <svg viewBox="0 0 10 14" aria-hidden="true" fill="currentColor" width="10" height="14">
            {collapsed
              ? <path d="M2 0 L10 7 L2 14 L0 12 L6 7 L0 2 Z" />
              : <path d="M8 0 L0 7 L8 14 L10 12 L4 7 L10 2 Z" />
            }
          </svg>
        </button>
      </div>
      <nav className="left-nav__body" aria-label="Left navigation">
        <ul className="left-nav__list">
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <li className="left-nav__item" key={item.id}>
                <button
                  type="button"
                  className={`left-nav__button ${isSelected ? "left-nav__button--selected" : ""}`}
                  onClick={() => onSelect?.(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="left-nav__icon" aria-hidden="true">{item.icon}</span>
                  {!collapsed && <span className="left-nav__text">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
