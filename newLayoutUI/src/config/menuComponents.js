import DashboardPage from "../../../src/components/dashboard/DashboardPage";
import ContractManagementPage from "../../../src/components/ContractManagement/ContractManagementPage";
import CaseManagementPage from "../../../src/components/CaseManagement/CaseManagementPage";

export const DASHBOARD_VIEW = {
  component: DashboardPage,
  pageConfig: {
    flags: {
      showHeader: true,
      scrollBody: true,
    },
  },
};

export const CONTRACT_MANAGEMENT_VIEW = {
  component: ContractManagementPage,
  pageConfig: {
    flags: {
      showHeader: false,
      scrollBody: true,
    },
  },
};

export const CASE_MANAGEMENT_VIEW = {
  component: CaseManagementPage,
  componentProps: {
    showComparisonCheckboxes: true,
    maxComparisonCount: 3,
    showEvaluationRating: true,
  },
  pageConfig: {
    flags: {
      showHeader: true,
      scrollBody: true,
    },
  },
};

export function createMenuItem({ id, label, iconName, view, pageConfig = {} }) {
  return {
    id,
    label,
    iconName,
    ...view,
    pageConfig: {
      flags: {
        showHeader: true,
        scrollBody: true,
        ...(view?.pageConfig?.flags || {}),
        ...(pageConfig.flags || {}),
      },
      ...(view?.pageConfig || {}),
      ...pageConfig,
    },
  };
}