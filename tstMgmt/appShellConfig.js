export const APP_THEMES = [
  { id: "classic", label: "UBS Classic" },
  { id: "dark", label: "UBS Dark" },
  { id: "slate", label: "UBS Slate" },
  { id: "high-contrast", label: "UBS High Contrast" },
];

// Externalized app shell mapping.
// Update this file to configure top menus and their left-navigation trees.
// Each left menu item may include nested children and an iconName.
export const APP_TOP_MENU_CONFIG = [
  {
    id: "test-platform",
    label: "Test Platform",
    iconName: "test-platform",
    leftMenus: [
      { id: "dashboard", label: "Dashboard", iconName: "dashboard" },
      { id: "stage-flow", label: "AI Test Platform", iconName: "stages" },
      {
        id: "case-management",
        label: "Case Management",
        iconName: "case-management",
        componentProps: {
          showComparisonCheckboxes: true,
          maxComparisonCount: 3,
          showEvaluationRating: true,
          testGenerationEditorMode: "inline",
        },
      },
      { id: "test-execution", label: "Test Execution", iconName: "test-execution" },
    ],
  },
  {
    id: "data-tools",
    label: "Data Tools",
    iconName: "data-tools",
    leftMenus: [
      { id: "editable-datatable-local", label: "Editable DT Local", iconName: "table-edit" },
      { id: "editable-datatable-service", label: "Editable DT Service", iconName: "table-edit" },
      { id: "tree-hierarchy", label: "Tree Hierarchy", iconName: "tree-hierarchy" },
      { id: "contract-management", label: "Contract Management", iconName: "contracts" },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    iconName: "admin",
    leftMenus: [
      {
        id: "users",
        label: "Users",
        iconName: "users",
        children: [
          { id: "users-list", label: "User List", iconName: "list" },
          { id: "users-groups", label: "Groups", iconName: "groups" },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        iconName: "settings",
        children: [
          { id: "general-settings", label: "General", iconName: "general" },
          { id: "security-settings", label: "Security", iconName: "security" },
        ],
      },
      { id: "help", label: "Help", iconName: "help" },
    ],
  },
];
