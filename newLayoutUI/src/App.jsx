import { useEffect, useMemo, useState } from "react";
import LeftNav from "./components/LeftNav";
import { APP_THEMES, APP_TOP_MENU_CONFIG } from "./config/appShellConfig";

function MenuIcon({ name }) {
  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4v15" />
        <path d="M4 19h16" />
        <path d="M8 17v-3" />
        <path d="M13 17V8" />
        <path d="M18 17V6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function withIcons(items = []) {
  return items.map((item) => ({
    ...item,
    icon: <MenuIcon name={item.iconName} />,
  }));
}

function TopMenuIcon({ name }) {
  switch (name) {
    case "test-platform":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M3 9h18" />
          <path d="M8 19h8" />
        </svg>
      );
    case "test-platforms":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="8" height="6" rx="1.5" />
          <rect x="13" y="5" width="8" height="6" rx="1.5" />
          <rect x="8" y="13" width="8" height="6" rx="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}

export default function App() {
  const shellTopMenus = useMemo(
    () => APP_TOP_MENU_CONFIG.map((menu) => ({ ...menu, leftMenus: withIcons(menu.leftMenus || []) })),
    []
  );

  const [selectedTopMenuId, setSelectedTopMenuId] = useState(shellTopMenus[0]?.id || "");
  const [selectedLeftMenuId, setSelectedLeftMenuId] = useState(shellTopMenus[0]?.leftMenus?.[0]?.id || "");
  const [isLeftNavOpen, setIsLeftNavOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeId, setThemeId] = useState(() => {
    const saved = window.localStorage.getItem("portable-theme");
    return APP_THEMES.some((theme) => theme.id === saved) ? saved : "classic";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeId);
    window.localStorage.setItem("portable-theme", themeId);
  }, [themeId]);

  const selectedTopMenu = shellTopMenus.find((menu) => menu.id === selectedTopMenuId) || shellTopMenus[0];
  const leftMenus = selectedTopMenu?.leftMenus || [];
  const selectedLeftMenu = useMemo(
    () => leftMenus.find((item) => item.id === selectedLeftMenuId) || leftMenus[0] || null,
    [leftMenus, selectedLeftMenuId]
  );
  const ActiveContentComponent = selectedLeftMenu?.component || null;
  const activeContentProps = selectedLeftMenu?.componentProps || {};
  const activePageFlags = selectedLeftMenu?.pageConfig?.flags || {};

  const handleTopMenuClick = (menu) => {
    setSelectedTopMenuId(menu.id);
    setSelectedLeftMenuId(menu.leftMenus?.[0]?.id || "");
    setIsLeftNavOpen(true);
  };

  const handleToggleLeftNav = () => {
    setIsLeftNavOpen((current) => !current);
  };

  return (
    <div className="app-layout">
      <header className="app-topbar" role="banner">
        <div className="app-topbar__brand">
          <span className="app-topbar__brand-logo">UBS</span>
          <span>Portable Theme Demo</span>
        </div>

        <nav className="app-topbar__menu" aria-label="Top navigation">
          {shellTopMenus.map((menu) => {
            const isActive = menu.id === selectedTopMenuId;
            return (
              <button
                key={menu.id}
                type="button"
                className={`app-topbar__menu-item ${isActive ? "is-active" : ""}`.trim()}
                onClick={() => handleTopMenuClick(menu)}
              >
                <span className="app-topbar__menu-item-icon" aria-hidden="true">
                  <TopMenuIcon name={menu.iconName || menu.id} />
                </span>
                <span>{menu.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="app-topbar__actions">
          <div className="app-topbar__user-menu">
            <button
              type="button"
              className={`app-topbar__user-btn${userMenuOpen ? " is-open" : ""}`}
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label="User settings"
              aria-expanded={userMenuOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </button>
            {userMenuOpen && (
              <>
                <button
                  type="button"
                  className="app-topbar__user-backdrop"
                  onClick={() => setUserMenuOpen(false)}
                  aria-label="Close user menu"
                />
                <div className="app-topbar__user-dropdown" role="menu">
                  <div className="app-topbar__user-dropdown-label">Theme</div>
                  <div className="app-topbar__theme-list">
                    {APP_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        role="menuitem"
                        className={`app-topbar__user-dropdown-item${themeId === theme.id ? " is-active" : ""}`}
                        onClick={() => { setThemeId(theme.id); setUserMenuOpen(false); }}
                      >
                        <span className="app-topbar__theme-badge">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`app-shell ${isLeftNavOpen ? "" : "app-shell--left-nav-collapsed"}`.trim()}>
        <div
          id="left-navigation"
          className={`app-shell__left-nav ${isLeftNavOpen ? "" : "app-shell__left-nav--hidden"}`.trim()}
        >
          <LeftNav
            items={leftMenus}
            selectedId={selectedLeftMenuId}
            onSelect={setSelectedLeftMenuId}
            menuTitle={selectedTopMenu?.label || "Menu"}
          />
        </div>

        <main className="app-content">
          {activePageFlags.showHeader !== false && (
            <header className="app-content__header">
              <div>
                <h1 className="app-content__title">{selectedLeftMenu?.label || "Home"}</h1>
                <p className="app-content__subtitle">
                  {selectedTopMenu?.label || "Menu"}
                  {selectedLeftMenuId ? ` / ${selectedLeftMenuId}` : ""}
                </p>
              </div>
            </header>
          )}

          <section className={`app-content__body${activePageFlags.scrollBody === false ? " app-content__body--static" : ""}`.trim()}>
            {ActiveContentComponent ? (
              <ActiveContentComponent {...activeContentProps} />
            ) : (
              <section className="example-card">
                <h2>No Page Mapping</h2>
                <p>
                  Selected top menu: {selectedTopMenu?.label}. Selected left menu: {selectedLeftMenuId}. Add a
                  component mapping for this menu item in appShellConfig.js.
                </p>
              </section>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
