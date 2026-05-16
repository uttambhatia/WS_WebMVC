import {
  CASE_MANAGEMENT_VIEW,
  CONTRACT_MANAGEMENT_VIEW,
  DASHBOARD_VIEW,
  createMenuItem,
} from "../menuComponents";

export const TEST_PLATFORMS_MENU = {
  id: "test-platforms",
  label: "Test Platforms",
  iconName: "test-platforms",
  leftMenus: [
    createMenuItem({
      id: "dashboards",
      label: "Dashboard",
      iconName: "dashboard",
      view: DASHBOARD_VIEW,
    }),
    createMenuItem({
      id: "contracts2",
      label: "Contract Management",
      iconName: "contracts",
      view: CONTRACT_MANAGEMENT_VIEW,
    }),
    createMenuItem({
      id: "cases2",
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