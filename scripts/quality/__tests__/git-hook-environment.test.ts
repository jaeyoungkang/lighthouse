import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const clearGitLocalEnvScript = join(repositoryRoot, "scripts/quality/clear-git-local-env.sh");

const git = (args: string[], cwd: string, env = process.env) =>
  execFileSync("git", args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const initializeRepository = (directory: string, message: string) => {
  git(["init", "--quiet"], directory);
  git(["config", "user.name", "Git Hook Test"], directory);
  git(["config", "user.email", "git-hook-test@example.com"], directory);
  writeFileSync(join(directory, "tracked.txt"), `${message}\n`);
  git(["add", "tracked.txt"], directory);
  git(["commit", "--quiet", "-m", message], directory);
};

describe("Git hook environment isolation", () => {
  it("clears repository-local Git variables before a fixture creates commits", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "lighthouse-git-hook-"));
    const protectedRepository = join(temporaryRoot, "protected");
    const fixtureRepository = join(temporaryRoot, "fixture");

    execFileSync("mkdir", ["-p", protectedRepository, fixtureRepository]);
    initializeRepository(protectedRepository, "protected baseline");

    const protectedHeadBefore = git(["rev-parse", "HEAD"], protectedRepository);
    const protectedIndexBefore = git(["write-tree"], protectedRepository);
    const pollutedEnvironment = {
      ...process.env,
      GIT_DIR: join(protectedRepository, ".git"),
      GIT_WORK_TREE: protectedRepository,
      GIT_INDEX_FILE: join(protectedRepository, ".git", "index"),
    };

    execFileSync(
      "sh",
      [
        "-c",
        [
          `. "${clearGitLocalEnvScript}"`,
          'git -C "$FIXTURE_REPOSITORY" init --quiet',
          'git -C "$FIXTURE_REPOSITORY" config user.name "Git Hook Test"',
          'git -C "$FIXTURE_REPOSITORY" config user.email "git-hook-test@example.com"',
          'printf "fixture\\n" > "$FIXTURE_REPOSITORY/tracked.txt"',
          'git -C "$FIXTURE_REPOSITORY" add tracked.txt',
          'git -C "$FIXTURE_REPOSITORY" commit --quiet -m "fixture commit"',
        ].join("\n"),
      ],
      {
        cwd: repositoryRoot,
        env: {
          ...pollutedEnvironment,
          FIXTURE_REPOSITORY: fixtureRepository,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    expect(git(["rev-parse", "HEAD"], protectedRepository)).toBe(protectedHeadBefore);
    expect(git(["write-tree"], protectedRepository)).toBe(protectedIndexBefore);
    expect(git(["log", "-1", "--format=%s"], fixtureRepository)).toBe("fixture commit");
  });

  it.each(["pre-commit", "pre-push"])(
    "loads the isolation helper before running the %s gate",
    (hookName) => {
      const hook = readFileSync(join(repositoryRoot, ".husky", hookName), "utf8");

      expect(hook.indexOf(". scripts/quality/clear-git-local-env.sh")).toBeGreaterThanOrEqual(0);
      expect(hook.indexOf(". scripts/quality/clear-git-local-env.sh")).toBeLessThan(
        hook.indexOf("npm run"),
      );
    },
  );
});
