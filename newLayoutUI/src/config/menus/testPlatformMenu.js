import {
  CASE_MANAGEMENT_VIEW,
  CONTRACT_MANAGEMENT_VIEW,
  DASHBOARD_VIEW,
  createMenuItem,
} from "../menuComponents";

export const TEST_PLATFORM_MENU = {
  id: "test-platform",
  label: "Test Platform",
  iconName: "test-platform",
  leftMenus: [
    createMenuItem({
      id: "dashboard",
      label: "Dashboard",
      iconName: "dashboard",
      view: DASHBOARD_VIEW,
    }),
    createMenuItem({
      id: "contracts",
      label: "Contract Management",
      iconName: "contracts",
      view: CONTRACT_MANAGEMENT_VIEW,
    }),
    createMenuItem({
      id: "cases",
      label: "Case Management",
      iconName: "case-management",
      view: CASE_MANAGEMENT_VIEW,
      pageConfig: {
        flags: {
          showHeader: true,
          scrollBody: true,
        },
      },
    }),
  ],
};