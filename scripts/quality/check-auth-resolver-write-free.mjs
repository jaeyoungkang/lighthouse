// guard:auth-resolver-write-free — auth resolvers must not schedule DB writes.
//
// Why this gate exists: repository-seam correctly allows DB writes inside
// app/server/repository/, but that means a request-hot auth resolver can still
// import a sanctioned repository helper and create a live write storm. Auth
// identity resolution must stay read/verify-only; display/operational app_users
// snapshots belong to explicit low-frequency session boundaries.
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const IDENTITY_FILE = path.join(ROOT, "app", "server", "auth", "identity.ts");

const contents = await readFile(IDENTITY_FILE, "utf8");
const rel = path.relative(ROOT, IDENTITY_FILE);

const violations = [];
const lines = contents.split("\n");

const blockedLinePatterns = [
  {
    reason: "next-after-in-auth-resolver",
    pattern: /\bafter\s*\(/,
    message: "auth resolver에서 Next after()로 side-effect를 예약하지 마세요.",
  },
  {
    reason: "app-user-snapshot-scheduler-import",
    pattern: /app-user-snapshot|scheduleAppUserSnapshot/,
    message: "app_users snapshot scheduler는 session route/client boundary에서만 호출하세요.",
  },
  {
    reason: "app-users-write-helper",
    pattern: /\b(?:upsertAppUserSnapshot|backfillOwnerPrincipalForEmail)\b/,
    message: "identity.ts는 app_users write/backfill helper를 직접 참조할 수 없습니다.",
  },
];

for (let index = 0; index < lines.length; index += 1) {
  for (const blocked of blockedLinePatterns) {
    if (blocked.pattern.test(lines[index])) {
      violations.push({
        file: rel,
        line: index + 1,
        reason: blocked.reason,
        text: lines[index].trim(),
        message: blocked.message,
      });
    }
  }
}

for (const importMatch of contents.matchAll(
  /^import\s*\{(?<names>[^}]*?)\}\s*from\s*["']@\/app\/server\/repository\/app-users["'];/gm,
)) {
  const names = (importMatch.groups?.names ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const disallowed = names.filter((name) => name !== "normalizeEmail");
  if (disallowed.length > 0) {
    violations.push({
      file: rel,
      line: lineNumberAt(contents, importMatch.index ?? 0),
      reason: "app-users-import-scope",
      text: `import { ${names.join(", ")} } from "@/app/server/repository/app-users";`,
      message: "identity.ts에서 app-users repository import는 normalizeEmail만 허용됩니다.",
    });
  }
}

if (violations.length > 0) {
  console.error("[guard:auth-resolver-write-free] auth resolver write side-effect를 발견했습니다:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.reason}] ${violation.text}`);
    console.error(`  ${violation.message}`);
  }
  console.error(
    "  인증 resolver는 principal/email 해석만 하고, app_users snapshot/backfill은 app/server/auth/app-user-snapshot.ts를 명시적 session boundary에서 호출하세요.",
  );
  process.exit(1);
}

console.log("[guard:auth-resolver-write-free] OK (identity.ts write side-effect 0건).");

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}
