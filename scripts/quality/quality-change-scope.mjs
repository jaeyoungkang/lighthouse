// Conservative execution scope for docs-only CI and Git hooks.
// This chooses commands, not product/contract meaning or merge eligibility.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const runtimeDocumentRoots = [
  "docs/contracts/",
  "docs/architecture-fitness/",
  "docs/analytics/",
  "docs/glossary/",
  "docs/runtime-flows/",
];
const rootDocuments = new Set(["README.md", "AGENTS.md", "CLAUDE.md"]);
const full = (reason) => ({ docsOnly: false, reason });

export function classifyChanges(records) {
  if (!Array.isArray(records) || records.length === 0) return full("no proven changes");
  for (const record of records) {
    const file = record.path;
    if (
      !["A", "M"].includes(record.status) ||
      (record.mode !== undefined && record.mode !== "100644") ||
      record.oldPath ||
      typeof file !== "string" ||
      /[\\\x00-\x1f]/.test(file) ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      !file.endsWith(".md") ||
      ["docs/mission-control.md", "docs/operational-readiness.md"].includes(file) ||
      runtimeDocumentRoots.some((root) => file.startsWith(root)) ||
      !(rootDocuments.has(file) || file.startsWith("docs/") || file.startsWith("shared-skills/"))
    ) {
      return full(`outside prose scope: ${file ?? "invalid record"}`);
    }
  }
  return { docsOnly: true, reason: `${records.length} regular prose additions/modifications` };
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

function commit(cwd, ref) {
  if (typeof ref !== "string" || !ref) throw new Error("missing comparison ref");
  return git(cwd, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).trim();
}

export function classifyGitRange({ cwd = process.cwd(), base, head = "HEAD" }) {
  try {
    const baseSha = commit(cwd, base);
    const args = ["diff", "--raw", "-z", "--no-renames", "--no-ext-diff"];
    args.push(baseSha, commit(cwd, head));
    args.push("--");
    const parts = git(cwd, args).split("\0");
    parts.pop();
    const records = [];
    for (let index = 0; index < parts.length; index += 2) {
      const match = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])$/.exec(parts[index]);
      if (!match || !parts[index + 1]) return full("unrecognized Git change record");
      if (!["000000", "100644"].includes(match[1])) return full("previous file mode is not prose");
      records.push({ mode: match[2], status: match[3], path: parts[index + 1] });
    }
    return classifyChanges(records);
  } catch {
    return full("comparison unavailable; run the complete gate");
  }
}

export function classifyPush({
  cwd = process.cwd(),
  input,
  defaultBase = "refs/remotes/origin/main",
}) {
  try {
    const head = commit(cwd, "HEAD");
    // Gates execute in this checkout; do not certify another ref or dirty bytes.
    if (git(cwd, ["status", "--porcelain", "--untracked-files=normal"]).trim()) {
      return full("push checkout is dirty");
    }
    if (typeof input !== "string" || !input.trim()) return full("missing push ref inventory");
    let count = 0;
    for (const line of input.trim().split("\n")) {
      const fields = line.trim().split(/\s+/);
      if (fields.length !== 4) return full("invalid push ref inventory");
      const [localRef, localSha, remoteRef, remoteSha] = fields;
      if (
        !localRef.startsWith("refs/heads/") ||
        !remoteRef.startsWith("refs/heads/") ||
        !/^[0-9a-f]{40}$/.test(localSha) ||
        !/^[0-9a-f]{40}$/.test(remoteSha) ||
        localSha !== head
      )
        return full("push includes deletion, tag, or another checkout");
      const base = /^0+$/.test(remoteSha)
        ? git(cwd, ["merge-base", commit(cwd, defaultBase), head]).trim()
        : remoteSha;
      const result = classifyGitRange({ cwd, base, head });
      if (!result.docsOnly) return result;
      count++;
    }
    return { docsOnly: true, reason: `${count} push ranges contain prose only` };
  } catch {
    return full("push comparison unavailable; run the complete gate");
  }
}

export function classifyCi({ cwd = process.cwd(), eventName, event }) {
  if (eventName === "pull_request" && event?.pull_request?.base?.sha) {
    return classifyGitRange({ cwd, base: event.pull_request.base.sha });
  }
  if (eventName === "push" && event?.before && !/^0+$/.test(event.before)) {
    return classifyGitRange({ cwd, base: event.before });
  }
  return full("manual or unknown event requires the complete gate");
}

export function hookCommands(kind, docsOnly) {
  if (kind === "push") return docsOnly ? ["quality:docs"] : ["quality:fast"];
  throw new Error("expected push hook; pre-commit retains quality:commit");
}

function runCommands(commands) {
  for (const name of commands) {
    const args = ["run", name];
    const result = spawnSync("npm", args, { stdio: "inherit", shell: false });
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

function main() {
  const [mode, kind] = process.argv.slice(2);
  if (mode === "--ci") {
    let result;
    try {
      result = classifyCi({
        eventName: process.env.GITHUB_EVENT_NAME,
        event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
      });
    } catch {
      result = full("event metadata unavailable; run the complete gate");
    }
    console.log(`quality scope: ${result.docsOnly ? "docs" : "full"} (${result.reason})`);
    if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
    appendFileSync(process.env.GITHUB_OUTPUT, `docs_only=${result.docsOnly}\n`);
    return;
  }
  if (mode === "--hook") {
    if (kind !== "push") throw new Error("pre-commit retains quality:commit");
    const result = classifyPush({ input: readFileSync(0, "utf8") });
    console.log(`quality scope: ${result.docsOnly ? "docs" : "full"} (${result.reason})`);
    process.exitCode = runCommands(hookCommands(kind, result.docsOnly));
    return;
  }
  throw new Error("usage: quality-change-scope.mjs --ci | --hook push");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
