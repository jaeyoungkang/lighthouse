import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const repoRoot = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("quality profile consolidation", () => {
  it("keeps the canonical purpose-specific profiles and components", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    const profiles = [
      "quality:commit",
      "quality:fast",
      "quality:contract",
      "quality:full",
      "quality:docs",
    ];
    const components = ["quality:guards", "quality:static", "quality:audit", "quality:pr"];

    for (const name of [...profiles, ...components]) {
      expect(packageJson.scripts[name]).toBeDefined();
    }
  });

  it("routes hooks through the scope selector and full CI directly to its profile", () => {
    expect(read(".husky/pre-push")).toMatch(/^\s*npm run quality:hook -- push\s*$/m);
    expect(read(".github/workflows/quality.yml")).toMatch(/^\s*run:\s*npm run quality:full\s*$/m);
  });

  it("keeps every GitHub Actions workflow free of scheduled triggers", () => {
    const workflowDirectory = path.join(repoRoot, ".github", "workflows");
    const workflowFiles = readdirSync(workflowDirectory).filter((file) => /\.ya?ml$/.test(file));

    expect(workflowFiles.length).toBeGreaterThan(0);
    for (const file of workflowFiles) {
      const workflow = parseYaml(read(path.join(".github", "workflows", file))) as {
        on?: Record<string, unknown>;
      };
      expect(workflow.on, file).not.toHaveProperty("schedule");
    }
  });

  it("owns the shared contract gate list in quality:contract only", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const contractGates = [
      "npm run mc:validate-story-chain",
      "npm run mc:validate-cair",
      "npm run mc:audit-surface",
      "npm run mc:audit-story-surface",
      "npm run mc:validate-events",
      "npm run mc:event-impact",
      "npm run evidence-ledger:dry",
      "npm run mc:check-critical-findings",
    ];

    for (const gate of contractGates) {
      expect(packageJson.scripts["quality:contract"]).toContain(gate);
      expect(packageJson.scripts["quality:static"]).not.toContain(gate);
      expect(packageJson.scripts["quality:full"]).not.toContain(gate);
    }
    expect(packageJson.scripts["quality:static"]).toContain("npm run quality:contract");
    expect(packageJson.scripts["quality:full"]).toContain("npm run quality:contract");
  });

  it("runs the CAIR validator against staged content in the commit profile", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["mc:validate-cair"]).toBe(
      "tsx scripts/mission-control/mc-validate-cair.ts",
    );
    expect(packageJson.scripts["quality:commit"]).toContain("npm run mc:validate-cair -- --staged");
    expect(packageJson.scripts["quality:contract"]).toContain("npm run mc:validate-cair");
    expect(packageJson.scripts["quality:contract"]).not.toContain(
      "npm run mc:validate-cair -- --staged",
    );
    expect(read(".github/workflows/quality.yml")).toContain(
      "CAIR_COMPARISON_BASE: ${{ github.event_name == 'push' && github.event.before || '' }}",
    );
  });

  it("owns dependency topology in the blocking static guard path", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["guard:landing-auth-source-boundary"]).toContain(
      "npm run deps:boundaries",
    );
    expect(packageJson.scripts["quality:guards"]).toContain(
      "npm run guard:landing-auth-source-boundary",
    );
    expect(packageJson.scripts["deps:audit"]).not.toContain("deps:boundaries");
  });

  it("runs structural change detection in local pre-push and CI static parity", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["structural-audit:check"]).toBe(
      "node shared-skills/structural-audit/references/check-topology.mjs",
    );
    expect(packageJson.scripts["quality:static"]).toContain("npm run structural-audit:check");
    expect(packageJson.scripts["quality:fast"]).toContain("npm run quality:static");
    expect(read(".husky/pre-push")).toMatch(/^\s*npm run quality:hook -- push\s*$/m);
    expect(read(".github/workflows/quality.yml")).toContain(
      "STRUCTURAL_AUDIT_BASE_REF: ${{ github.event_name == 'push' && github.event.before || '' }}",
    );
  });

  it("keeps state-boundary coverage in the shared guard profile", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["guard:state-boundaries"]).toBeDefined();
    expect(packageJson.scripts["quality:guards"]).toContain("npm run guard:state-boundaries");
  });

  it("routes current Sufficiency Review validation through the Story Chain owner", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["mc:validate-story-chain"]).toBeDefined();
    expect(packageJson.scripts["quality:contract"]).toContain("npm run mc:validate-story-chain");
  });

  it("blocks product PRs on the fast Architecture Fitness boundary guards", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const blockingGuards = packageJson.scripts["quality:guards"];

    expect(blockingGuards).toContain("npm run guard:least-authority-boundaries");
    expect(blockingGuards).toContain("npm run guard:state-boundaries");
  });

  it("keeps operational controls and inline-analysis cache compatibility in separate owners", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const blockingGuards = packageJson.scripts["quality:guards"];

    expect(packageJson.scripts["guard:operational-boundaries"]).toBe(
      "node scripts/quality/check-operational-boundary-register.mjs",
    );
    expect(packageJson.scripts["guard:inline-analysis-cache-contract"]).toBe(
      "node scripts/quality/check-inline-analysis-cache-contract.mjs",
    );
    expect(blockingGuards).toContain("npm run guard:operational-boundaries");
    expect(blockingGuards).toContain("npm run guard:inline-analysis-cache-contract");
  });

  it("documents prose scope and component-command distinction", () => {
    const gateMap = read("docs/contract-maps/quality-gates.md");

    expect(gateMap).toContain("quality:docs");
    expect(gateMap).toContain(
      "`quality:guards`, `quality:static`, `quality:audit`, `quality:pr`은",
    );
  });
});
