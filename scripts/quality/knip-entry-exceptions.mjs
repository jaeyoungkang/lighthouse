import { defineGuardExceptions } from "./guard-exception-policy.mjs";

const postgresIntegrationEntries = [
  "app/server/repository/__tests__/access-allowlist.postgres.integration.ts",
  "app/server/repository/__tests__/gap-build-principal-admissions.postgres.integration.ts",
  "app/server/repository/__tests__/gap-reports.postgres.integration.ts",
  "app/server/repository/__tests__/reviewed-papers.postgres.integration.ts",
];

export const KNIP_ENTRY_EXCEPTIONS = defineGuardExceptions(
  "knip-entry",
  [
    {
      id: "generated-glossary-domain-projection",
      entry: "app/domain/glossary-terms.generated.ts",
      reason: "the glossary gate writes and freshness-checks this generated TypeScript projection",
      owner: "glossary-steward",
      reviewWhen:
        "the glossary projection is imported by a discovered entry or its generator retires",
    },
    {
      id: "generated-glossary-i18n-projection",
      entry: "app/i18n/glossary-term-refs.generated.ts",
      reason: "the glossary gate writes and freshness-checks this generated TypeScript projection",
      owner: "glossary-steward",
      reviewWhen:
        "the glossary projection is imported by a discovered entry or its generator retires",
    },
    ...postgresIntegrationEntries.map((entry, index) => ({
      id: `postgres-integration-config-entry-${index + 1}`,
      entry,
      reason:
        "the db-integration runner selects this nonstandard filename through a dedicated Vitest include glob",
      owner: "PostgreSQL integration contract gate",
      reviewWhen:
        "Knip discovers the dedicated Vitest include or the integration filename convention changes",
    })),
    {
      id: "dormant-working-context-policy",
      entry: "app/server/reference/working-context.ts",
      reason:
        "current Operational Readiness and Q5 policy still declare this process-local buffer while issue #724 decides its lifecycle",
      owner: "Operational Readiness and Architecture Fitness Q5",
      reviewWhen:
        "Issue #724 restores a runtime consumer or retires the buffer and its current policy rows",
    },
    {
      id: "dormant-working-context-domain-contract",
      entry: "app/domain/working-context.ts",
      reason:
        "the dormant process-local buffer still owns this session contract while issue #724 decides the code and policy lifecycle together",
      owner: "Operational Readiness and Architecture Fitness Q5",
      reviewWhen:
        "Issue #724 restores a runtime consumer or retires the buffer and its current policy rows",
    },
    {
      id: "dormant-working-context-reference-contract",
      entry: "app/domain/reference.ts",
      reason:
        "the dormant WorkingContextEntry contract still carries these reference types while issue #724 decides the code and policy lifecycle together",
      owner: "Operational Readiness and Architecture Fitness Q5",
      reviewWhen:
        "Issue #724 restores a runtime consumer or retires the buffer and its current policy rows",
    },
    {
      id: "architecture-fitness-path-setup",
      entry: "scripts/architecture-fitness/path-vitest.setup.ts",
      reason: "the path-test runner passes this setup file to Vitest through a constructed config",
      owner: "Architecture Fitness path-test command",
      reviewWhen:
        "Knip discovers the constructed setupFiles reference or the path-test runner retires",
    },
    {
      id: "architecture-fitness-q2-probe",
      entry: "scripts/architecture-fitness/q2-process-isolation-probe.ts",
      reason: "the Q2 collector executes this probe by a source-path string in a child process",
      owner: "Architecture Fitness Q2 collector",
      reviewWhen: "Knip discovers the child-process target or the Q2 probe retires",
    },
    {
      id: "architecture-fitness-url-budget-probe",
      entry: "scripts/architecture-fitness/search-condition-url-budget-probe.ts",
      reason: "the serialized-input collector executes this probe by a source-path string",
      owner: "Architecture Fitness serialized-input collector",
      reviewWhen: "Knip discovers the child-process target or the URL-budget probe retires",
    },
    {
      id: "evidence-ledger-contract-check",
      entry: "scripts/evidence-ledger/helpers/contract-check.ts",
      reason:
        "structured Evidence Ledger commands execute this dispatcher from argv instead of importing it",
      owner: "Evidence Ledger execution registry",
      reviewWhen: "Knip discovers structured execution targets or the dispatcher retires",
    },
    {
      id: "project-knowledge-post-commit-hook",
      entry: "scripts/project-knowledge/post-commit-reminder.ts",
      reason: "the local agent hook executes this file from a settings command string",
      owner: "project-knowledge workflow",
      reviewWhen: "Knip discovers agent hook command strings or the hook retires",
    },
    {
      id: "post-merge-cleanup-hook",
      entry: "scripts/agent-hooks/post-merge-cleanup.ts",
      reason: "the local agent hook executes this file from a settings command string",
      owner: "post-merge automation workflow",
      reviewWhen: "Knip discovers agent hook command strings or the hook retires",
    },
  ],
  { requiredMatchFields: ["entry"] },
);
