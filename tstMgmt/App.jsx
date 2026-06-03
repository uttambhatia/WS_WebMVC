import { useEffect, useMemo, useState } from "react";
import LeftNav from "./components/LeftNav";
import StageFlowPanelDemo from "./components/StageFlowPanel/StageFlowPanelDemo";
import CaseManagementPage from "./components/CaseManagement/CaseManagementPage";
import EditableDataTableLocalDemo from "./components/DataTable/EditableDataTableLocalDemo";
import EditableDataTableServiceDemo from "./components/DataTable/EditableDataTableServiceDemo";
import TreeHierarchyDemo from "./components/TreeHierarchy/TreeHierarchyDemo";
import ContractManagementPage from "./components/ContractManagement/ContractManagementPage";
import TestExecutionPage from "./components/TestExecution/TestExecutionPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import { APP_THEMES, APP_TOP_MENU_CONFIG } from "./config/appShellConfig";

function MenuIcon({ name }) {
  switch (name) {
    case "dashboard":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4v15" />
          <path d="M4 19h16" />
          <path d="M8 17v-3" />
          <path d="M13 17V8" />
          <path d="M18 17V6" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3.5 19a4.5 4.5 0 0 1 9 0" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 19a3.5 3.5 0 0 1 7 0" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="7" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="5" cy="17" r="1.5" />
          <rect x="9" y="6" width="11" height="2" rx="1" />
          <rect x="9" y="11" width="11" height="2" rx="1" />
          <rect x="9" y="16" width="11" height="2" rx="1" />
        </svg>
      );
    case "groups":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="8" height="6" rx="1.5" />
          <rect x="13" y="4" width="8" height="6" rx="1.5" />
          <rect x="8" y="14" width="8" height="6" rx="1.5" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "general":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="10" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9 10V8a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "stages":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 18V5" fill="none" />
          <path d="M15 13a4.17 4.17 0 0 1-3 4 4.17 4.17 0 0 1-3 4" fill="none" />
          <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" fill="none" />
          <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" fill="none" />
          <path d="M18 18a4 4 0 0 0 2-7.464" fill="none" />
          <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" fill="none" />
          <path d="M6 18a4 4 0 0 1-2-7.464" fill="none" />
          <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" fill="none" />
        </svg>
      );
    case "case-management":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.226 20.925A2 2 0 0 0 6 22h12a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v3.127" fill="none" />
          <path d="M14 2v5a1 1 0 0 0 1 1h5" fill="none" />
          <path d="m5 11-3 3" fill="none" />
          <path d="m5 17-3-3h10" fill="none" />
        </svg>
      );
    case "table-edit":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3 9h18M9 4v14" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M14 20l4.5-4.5 1.5 1.5L15.5 21.5H14z" fill="currentColor" />
        </svg>
      );
    case "tree-hierarchy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h7v4H4z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 4h7v4h-7z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 14h7v6h-7z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7.5 10v4h5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M16.5 8v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "contracts":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 8h8M8 12h8M8 16h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="16" r="2" fill="currentColor" />
        </svg>
      );
    case "test-execution":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g fill="none">
            <path d="M15 8a1 1 0 0 1-1-1V2a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8z" />
            <path d="M20 8v12a2 2 0 0 1-2 2h-4.182" />
            <path d="m3.305 19.53.923-.382" />
            <path d="M4 10.592V4a2 2 0 0 1 2-2h8" />
            <path d="m4.228 16.852-.924-.383" />
            <path d="m5.852 15.228-.383-.923" />
            <path d="m5.852 20.772-.383.924" />
            <path d="m8.148 15.228.383-.923" />
            <path d="m8.53 21.696-.382-.924" />
            <path d="m9.773 16.852.922-.383" />
            <path d="m9.773 19.148.922.383" />
            <circle cx="7" cy="18" r="3" />
          </g>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="8" r="1.2" />
          <rect x="11" y="11" width="2" height="7" rx="1" />
        </svg>
      );
  }
}

const TOP_MENU_CONFIG = APP_TOP_MENU_CONFIG;
const THEMES = APP_THEMES;

function withIcons(items = []) {
  return items.map((item) => ({
    ...item,
    icon: <MenuIcon name={item.iconName} />,
    children: Array.isArray(item.children) ? withIcons(item.children) : item.children,
  }));
}

function findDefaultLeftItem(items = []) {
  const first = items[0];
  if (!first) return "";
  if (Array.isArray(first.children) && first.children.length > 0) {
    return first.children[0].id;
  }
  return first.id;
}

function parseHashRoute(hash, topMenus) {
  const safeTopMenus = Array.isArray(topMenus) ? topMenus : [];
  const fallbackTop = safeTopMenus[0]?.id || "";
  const fallbackLeft = findDefaultLeftItem(safeTopMenus[0]?.leftMenus);

  const parts = String(hash || "")
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean);

  const topId = parts[0] || fallbackTop;
  const top = safeTopMenus.find((menu) => menu.id === topId) || safeTopMenus[0];
  const requestedLeftId = parts[1] || fallbackLeft;

  const allLeftIds = (top?.leftMenus || []).flatMap((item) => {
    if (Array.isArray(item.children) && item.children.length > 0) {
      return [item.id, ...item.children.map((child) => child.id)];
    }
    return [item.id];
  });

  const leftId = allLeftIds.includes(requestedLeftId)
    ? requestedLeftId
    : findDefaultLeftItem(top?.leftMenus);

  return {
    topId: top?.id || fallbackTop,
    leftId,
  };
}

function buildHash(topId, leftId) {
  return `#/${topId}/${leftId}`;
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
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
    case "data-tools":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h6" />
          <circle cx="13" cy="7" r="2" />
          <path d="M16 7h4" />
          <path d="M4 17h4" />
          <circle cx="11" cy="17" r="2" />
          <path d="M14 17h6" />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-.8.8a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-.8-.8a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.2a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l.8-.8a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l.8.8a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.2a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6z" />
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
    () => TOP_MENU_CONFIG.map((menu) => ({ ...menu, leftMenus: withIcons(menu.leftMenus || []) })),
    []
  );

  const initialRoute = useMemo(() => parseHashRoute(window.location.hash, shellTopMenus), [shellTopMenus]);
  const [selectedTopMenuId, setSelectedTopMenuId] = useState(initialRoute.topId);
  const [selectedLeftMenuId, setSelectedLeftMenuId] = useState(initialRoute.leftId);
  const [themeId, setThemeId] = useState(() => {
    const saved = window.localStorage.getItem("ubs-theme");
    return THEMES.some((theme) => theme.id === saved) ? saved : "classic";
  });

  const selectedTopMenu = useMemo(
    () => shellTopMenus.find((menu) => menu.id === selectedTopMenuId) || shellTopMenus[0],
    [selectedTopMenuId, shellTopMenus]
  );

  const leftMenus = selectedTopMenu?.leftMenus || [];

  const selectedItem = useMemo(() => {
    const firstMatch = leftMenus.find((item) => item.id === selectedLeftMenuId);
    if (firstMatch) return firstMatch;

    for (const item of leftMenus) {
      if (Array.isArray(item.children)) {
        const child = item.children.find((nested) => nested.id === selectedLeftMenuId);
        if (child) return child;
      }
    }

    return leftMenus[0] || null;
  }, [leftMenus, selectedLeftMenuId]);

  const contentTitle = useMemo(() => selectedItem?.label || "Home", [selectedItem]);

  useEffect(() => {
    const nextHash = buildHash(selectedTopMenuId, selectedLeftMenuId);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [selectedTopMenuId, selectedLeftMenuId]);

  useEffect(() => {
    const onHashChange = () => {
      const route = parseHashRoute(window.location.hash, shellTopMenus);
      setSelectedTopMenuId(route.topId);
      setSelectedLeftMenuId(route.leftId);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [shellTopMenus]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeId);
    window.localStorage.setItem("ubs-theme", themeId);
  }, [themeId]);

  const handleTopMenuClick = (topMenuId) => {
    const topMenu = shellTopMenus.find((menu) => menu.id === topMenuId);
    const nextLeftId = findDefaultLeftItem(topMenu?.leftMenus);
    setSelectedTopMenuId(topMenuId);
    setSelectedLeftMenuId(nextLeftId);
  };

  const renderMainContent = () => {
    switch (selectedItem?.id) {
      case "dashboard":
        return <DashboardPage />;
      case "stage-flow":
        return <StageFlowPanelDemo />;
      case "case-management":
        {
          const caseManagementProps = selectedItem?.componentProps || {};
        return (
          <CaseManagementPage
            showComparisonCheckboxes={caseManagementProps.showComparisonCheckboxes ?? true}
            maxComparisonCount={caseManagementProps.maxComparisonCount ?? 3}
            showEvaluationRating={caseManagementProps.showEvaluationRating ?? true}
            testGenerationEditorMode={caseManagementProps.testGenerationEditorMode ?? "inline"}
          />
        );
        }
      case "editable-datatable-local":
        return <EditableDataTableLocalDemo />;
      case "editable-datatable-service":
        return <EditableDataTableServiceDemo />;
      case "tree-hierarchy":
        return <TreeHierarchyDemo />;
      case "contract-management":
        return <ContractManagementPage />;
      case "test-execution":
        return <TestExecutionPage />;
      default:
        return (
          <>
            <h1>{contentTitle}</h1>
            <p>
              Select menu items from the top navigation and left sidebar. This shell supports
              route-like URL state, configurable menus, and theme preferences with low changes
              required in feature components.
            </p>
          </>
        );
    }
  };

  return (
    <div className="app-layout">
      <header className="app-topbar" role="banner">
        <div className="app-topbar__brand" aria-label="UBS">
          <span className="app-topbar__brand-logo">UBS</span>
          <span className="app-topbar__brand-name">Test Management Portal</span>
        </div>

        <nav className="app-topbar__menu" aria-label="Top navigation">
          {shellTopMenus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              className={`app-topbar__menu-item ${selectedTopMenuId === menu.id ? "is-active" : ""}`}
              onClick={() => handleTopMenuClick(menu.id)}
            >
              <span className="app-topbar__menu-item-icon" aria-hidden="true">
                <TopMenuIcon name={menu.iconName || menu.id} />
              </span>
              <span>{menu.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-topbar__actions">
          <label className="app-topbar__theme" htmlFor="topbar-theme-select">
            <span className="app-topbar__theme-label">Theme</span>
            <select
              id="topbar-theme-select"
              value={themeId}
              onChange={(event) => setThemeId(event.target.value)}
            >
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="app-topbar__user-btn" aria-label="User preferences">
            <UserIcon />
          </button>
        </div>
      </header>

      <div className="app-shell">
        <LeftNav
          key={selectedTopMenuId}
          items={leftMenus}
          initialSelectedId={selectedLeftMenuId}
          onChange={(item) => setSelectedLeftMenuId(item.id)}
          menuTitle={selectedTopMenu?.label || "Menu"}
          enableMobileOverlay
          enableMainMenuCollapse
          expandMainMenusByDefault={false}
          enableCollapseTooltip
          enableSelectedItemCustomStyling={true}
          selectedItemBgColor="var(--app-brand, #E2001A)"
          selectedItemTextColor="#ffffff"
        />

        <main className="app-content">{renderMainContent()}</main>
      </div>
    </div>
  );
}
