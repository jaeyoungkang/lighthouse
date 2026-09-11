import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const STRYKER_CONFIG = readFileSync(resolve(ROOT, "stryker.config.mjs"), "utf8");
const STRYKER_BASE_CONFIG = readFileSync(resolve(ROOT, "stryker.base.mjs"), "utf8");
const STRYKER_AGENT_CONFIG = readFileSync(resolve(ROOT, "stryker.agent.config.mjs"), "utf8");
const STRYKER_CONTRACTS_CONFIG = readFileSync(
  resolve(ROOT, "stryker.contracts.config.mjs"),
  "utf8",
);
const STRYKER_DOMAIN_CONFIG = readFileSync(resolve(ROOT, "stryker.domain.config.mjs"), "utf8");
const STRYKER_RESEARCH_ROUTE_CONFIG = readFileSync(
  resolve(ROOT, "stryker.research-route.config.mjs"),
  "utf8",
);
const MUTATION_VITEST_CONFIG = readFileSync(resolve(ROOT, "vitest.config.mutation.mts"), "utf8");
const MUTATION_WORKFLOW = readFileSync(resolve(ROOT, ".github/workflows/mutation.yml"), "utf8");
const QUALITY_WORKFLOW = readFileSync(resolve(ROOT, ".github/workflows/quality.yml"), "utf8");
const RESPOND_LEDGER = readFileSync(
  resolve(ROOT, "docs/contracts/story-chain/evidence-ledgers/respond-contract.ledger.yaml"),
  "utf8",
);
const POLICY_DOC = readFileSync(
  resolve(ROOT, "docs/contracts/story-chain/hardening-tier-policy.md"),
  "utf8",
);
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("respond-contract mutation pilot wiring (promise:respond-contract-mutation-pilot)", () => {
  describe("AC stryker-wired", () => {
    it("npm run mutation invokes stryker", () => {
      expect(PACKAGE_JSON.scripts["mutation"]).toBe("stryker run stryker.agent.config.mjs");
      expect(PACKAGE_JSON.scripts["mutation:agent"]).toBe("stryker run stryker.agent.config.mjs");
      expect(PACKAGE_JSON.scripts["mutation:contracts"]).toBe(
        "stryker run stryker.contracts.config.mjs",
      );
      expect(PACKAGE_JSON.scripts["mutation:domain"]).toBe("stryker run stryker.domain.config.mjs");
      expect(PACKAGE_JSON.scripts["mutation:research-route"]).toBe(
        "stryker run stryker.research-route.config.mjs",
      );
      expect(PACKAGE_JSON.scripts["mutation:all"]).toBe(
        "npm run mutation:agent && npm run mutation:contracts && npm run mutation:domain && npm run mutation:research-route",
      );
    });

    it("Stryker devDependencies are pinned", () => {
      expect(PACKAGE_JSON.devDependencies["@stryker-mutator/core"]).toBeDefined();
      expect(PACKAGE_JSON.devDependencies["@stryker-mutator/vitest-runner"]).toBeDefined();
    });

    it("stryker config files target the current runtime contract slices via vitest runner with perTest coverage", () => {
      expect(STRYKER_CONFIG).toMatch(/stryker\.agent\.config\.mjs/);
      expect(STRYKER_BASE_CONFIG).toMatch(/testRunner:\s*"vitest"/);
      expect(STRYKER_AGENT_CONFIG).toMatch(
        /mutate:\s*\[\s*"app\/server\/agent\/route-ai-comment-generation\.ts"/,
      );
      expect(STRYKER_AGENT_CONFIG).toMatch(/"app\/server\/ai-generation\/gateway\.ts"/);
      expect(STRYKER_AGENT_CONFIG).toMatch(
        /"app\/components\/research\/route-ai-comment-generation-client\.ts"/,
      );
      expect(STRYKER_AGENT_CONFIG).toMatch(
        /"app\/components\/research\/route-ai-comment-generation-scheduler\.ts"/,
      );
      expect(STRYKER_CONTRACTS_CONFIG).toMatch(
        /"app\/server\/services\/analytics\/event-contract\.ts"/,
      );
      expect(STRYKER_DOMAIN_CONFIG).toMatch(/"app\/server\/domain-access\/gap-report-access\.ts"/);
      expect(STRYKER_DOMAIN_CONFIG).toMatch(
        /"app\/server\/domain-access\/gap-network-view-access\.ts"/,
      );
      expect(STRYKER_RESEARCH_ROUTE_CONFIG).toMatch(
        /"app\/stores\/research-route-store-internals\.ts"/,
      );
      expect(STRYKER_RESEARCH_ROUTE_CONFIG).toMatch(
        /"app\/stores\/research-route-store-search-visible-window\.ts"/,
      );
      expect(STRYKER_BASE_CONFIG).toMatch(/coverageAnalysis:\s*"perTest"/);
    });

    it("stryker uses the mutation-only vitest config that excludes *.live.test.* (no live LLM calls per mutant)", () => {
      // The dedicated config must stay wired and must exclude live tests so
      // route-view generation mutants do not trigger real provider calls.
      expect(STRYKER_BASE_CONFIG).toMatch(/configFile:\s*"vitest\.config\.mutation\.mts"/);
      expect(MUTATION_VITEST_CONFIG).toMatch(/["']\*\*\/\*\.live\.test\.\*["']/);
    });

    it("ignores static mutants to keep the expanded manual slice inside the CI budget", () => {
      expect(STRYKER_BASE_CONFIG).toMatch(/ignoreStatic:\s*true/);
      expect(STRYKER_BASE_CONFIG).toMatch(/coverageAnalysis:\s*"perTest"/);
    });
  });

  describe("AC manual-isolation", () => {
    it("mutation.yml triggers on workflow_dispatch only — no schedule, pull_request, or push", () => {
      expect(MUTATION_WORKFLOW).toMatch(/^on:\s*$/m);
      expect(MUTATION_WORKFLOW).toMatch(/workflow_dispatch:/);
      expect(MUTATION_WORKFLOW).not.toMatch(/^\s*schedule:/m);
      expect(MUTATION_WORKFLOW).not.toMatch(/^\s*pull_request:/m);
      expect(MUTATION_WORKFLOW).not.toMatch(/^\s*push:/m);
    });

    it("mutation.yml uploads a per-slice report artifact for inspection", () => {
      expect(MUTATION_WORKFLOW).toMatch(/actions\/upload-artifact@v4/);
      expect(MUTATION_WORKFLOW).toMatch(/name:\s*mutation-report-\$\{\{\s*matrix\.slice\s*\}\}/);
      expect(MUTATION_WORKFLOW).toMatch(
        /path:\s*reports\/mutation\/\$\{\{\s*matrix\.slice\s*\}\}\/?/,
      );
    });

    it("mutation.yml runs all configured mutation slices as a matrix, not only the agent default", () => {
      expect(MUTATION_WORKFLOW).toMatch(/strategy:/);
      expect(MUTATION_WORKFLOW).toMatch(/fail-fast:\s*false/);
      expect(MUTATION_WORKFLOW).toMatch(
        /matrix:\s*\n\s*slice:\s*\[agent,\s*contracts,\s*domain,\s*research-route\]/,
      );
      expect(MUTATION_WORKFLOW).toMatch(/run:\s*npm run mutation:\$\{\{\s*matrix\.slice\s*\}\}/);
      expect(MUTATION_WORKFLOW).not.toMatch(/run:\s*npm run mutation\s*$/m);
      expect(MUTATION_WORKFLOW).not.toMatch(/run:\s*npm run mutation:all/);
    });

    it("mutation.yml carries a per-slice timeout cap so one slow slice cannot consume the whole job budget", () => {
      // Each matrix leg is its own job; `timeout-minutes` here is the per-slice
      // cap, not a sequential sum. Locked to the exact tuning value so any
      // re-tune surfaces as an explicit PR diff against this AC instead of
      // sliding silently.
      const match = MUTATION_WORKFLOW.match(/timeout-minutes:\s*(\d+)/);
      expect(match).not.toBeNull();
      const minutes = Number(match?.[1]);
      expect(minutes).toBe(75);
    });

    it("PR gate (quality.yml) does not invoke npm run mutation", () => {
      expect(QUALITY_WORKFLOW).not.toMatch(/npm run mutation/);
      expect(QUALITY_WORKFLOW).not.toMatch(/stryker/i);
    });
  });

  describe("AC baseline-tracking", () => {
    it("respond-contract ledger carries the mutationScore threshold (≥ N%)", () => {
      expect(RESPOND_LEDGER).toMatch(/mutationScore:\s*≥\s*\d{1,3}%/);
    });

    it("each mutation slice locks the same threshold under thresholds.break", () => {
      // Catches drift between the ledger annotation and the actual gate that
      // fails the manual run. Without this, the ledger could claim ≥ 50%
      // while CI silently runs without any threshold and never fails.
      expect(STRYKER_AGENT_CONFIG).toMatch(/thresholds:\s*\{[^}]*break:\s*\d/);
      expect(STRYKER_CONTRACTS_CONFIG).toMatch(/thresholds:\s*\{[^}]*break:\s*\d/);
      expect(STRYKER_DOMAIN_CONFIG).toMatch(/thresholds:\s*\{[^}]*break:\s*\d/);
      expect(STRYKER_RESEARCH_ROUTE_CONFIG).toMatch(/thresholds:\s*\{[^}]*break:\s*\d/);
    });

    it("policy doc §2 names the active pilot ledger", () => {
      expect(POLICY_DOC).toMatch(/##\s+2\.\s+Mutation testing 발동/);
      expect(POLICY_DOC).toMatch(/적용 pilot:\s*runtime contract slices/);
      expect(POLICY_DOC).toMatch(/`respond-contract-mutation-pilot\.ledger\.yaml`가 소유/);
    });
  });
});
