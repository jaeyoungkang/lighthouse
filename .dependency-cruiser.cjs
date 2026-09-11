const PUBLIC_AUTH_SOURCE =
  "^app/(?:components/(?:BrandLogo|EmailGate|MoonlightAuthBootstrap)\\.tsx|i18n/(?:create-message-translator|public-auth-bootstrap-messages|public-client-messages|public-shared-messages)\\.ts|lib/(?:auth/request-magic-link|api-routes|supabase/auth-helpers)\\.ts)$";
const GLOBAL_MESSAGE_REGISTRY = "^app/i18n/(?:message-access\\.ts|messages(?:\\.ts|/))";
const ADMIN_ANALYTICS_TYPE_CONSUMERS =
  "^app/components/admin/(?:AnalyticsEventsDashboard\\.tsx|__tests__/AnalyticsEventsDashboard\\.test\\.tsx)$";
const RESEARCH_SHELL_TEST_TYPE_CONSUMER =
  "^app/components/research/__tests__/research-route-shell\\.test\\.tsx$";
const CLIENT_SERVER_TYPE_ONLY_EXCEPTIONS = `(?:${ADMIN_ANALYTICS_TYPE_CONSUMERS}|${RESEARCH_SHELL_TEST_TYPE_CONSUMER})`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "public-auth-must-not-import-global-messages",
      severity: "error",
      // type-only: forbidden. Public auth must not take any dependency on the global registry owner.
      from: { path: PUBLIC_AUTH_SOURCE },
      to: { path: GLOBAL_MESSAGE_REGISTRY },
    },
    {
      name: "no-client-to-server",
      severity: "error",
      // type-only: forbidden except the two documented contract consumers below.
      from: {
        path: "^app/(components|stores)/",
        pathNot: CLIENT_SERVER_TYPE_ONLY_EXCEPTIONS,
      },
      to: { path: "^app/server/" },
    },
    {
      name: "admin-analytics-server-type-contract-only",
      severity: "error",
      // reason: the server-loaded event catalog is rendered by this admin-only component and test.
      // accountable owner: docs/analytics/README.md and analytics-event-steward.
      // review trigger: move the display contract when analytics event types gain a neutral domain owner.
      from: { path: ADMIN_ANALYTICS_TYPE_CONSUMERS },
      to: {
        path: "^app/server/services/analytics/event-contract\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "admin-analytics-server-contract-target-only",
      severity: "error",
      // Keep the importer-level exception above from becoming access to any other server owner.
      from: { path: ADMIN_ANALYTICS_TYPE_CONSUMERS },
      to: {
        path: "^app/server/",
        pathNot: "^app/server/services/analytics/event-contract\\.ts$",
      },
    },
    {
      name: "research-shell-test-server-type-contract-only",
      severity: "error",
      // reason: this fixture names the server response status while exercising the client shell boundary.
      // accountable owner: promise:search-results-fast-window verification.
      // review trigger: remove when LibraryContextAccessStatus moves to a neutral response contract.
      from: { path: RESEARCH_SHELL_TEST_TYPE_CONSUMER },
      to: {
        path: "^app/server/services/library-context-source\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "research-shell-test-server-contract-target-only",
      severity: "error",
      // Keep the importer-level exception above from becoming access to any other server owner.
      from: { path: RESEARCH_SHELL_TEST_TYPE_CONSUMER },
      to: {
        path: "^app/server/",
        pathNot: "^app/server/services/library-context-source\\.ts$",
      },
    },
    {
      name: "no-shared-lib-to-server-runtime",
      severity: "error",
      // type-only: allowed. Shared runtime helpers may consume server-owned compile-time contracts.
      from: {
        path: "^app/lib/",
        pathNot: "(?:^|/)__tests__/|\\.test\\.",
      },
      to: {
        path: "^app/server/",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-server-to-ui",
      severity: "error",
      // type-only: forbidden. Live-judge tests are excluded as whole test adapters below.
      // Exempt live-judge tests — they deliberately render real UI components
      // through JSDOM to verify Intent under `docs/principles.md §0 핵심 철학`.
      // The boundary rule exists to stop production server code from importing
      // client code; tests that render the UI for Intent verification are not
      // that concern.
      from: {
        path: "^app/server/",
        pathNot: "\\.live\\.test\\.tsx$",
      },
      to: { path: "^app/(components|stores|\\([^/]+\\)/)" },
    },
    {
      name: "no-route-to-repository",
      severity: "error",
      // type-only: forbidden. Route contracts use neutral domain or lib owners.
      from: {
        path: "^app/api/|^app/\\([^/]+\\)/.*(page|layout)\\.tsx$",
      },
      to: { path: "^app/server/repository/" },
    },
    {
      name: "services-should-be-pure",
      severity: "error",
      // type-only: forbidden. Services must not inherit repository-owned vocabulary.
      from: { path: "^app/server/services/" },
      to: { path: "^app/server/repository/" },
    },
    {
      name: "no-repository-barrel",
      severity: "error",
      // type-only: forbidden. The retired repository barrel is not a contract owner.
      from: { path: "^app/" },
      to: { path: "^app/server/repository/index\\.ts$" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: "^(node_modules|\\.next|coverage|specs/report)",
    },
    exclude: {
      path: "^(node_modules|\\.next|coverage|specs/report)",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
