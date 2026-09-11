// guard:auth-hot-path - request-hot auth reads must stay bounded.
//
// Why this gate exists: guard:auth-resolver-write-free prevents auth identity
// resolution from scheduling DB writes, but it does not catch Supabase Auth
// server reads introduced before the resolver, such as Next proxy refreshes or
// browser analytics identity binding. Those paths can multiply into one
// /auth/v1/user call per page/API/RSC request.
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PROXY_FILE = path.join(ROOT, "proxy.ts");
const INSTRUMENTATION_CLIENT_FILE = path.join(ROOT, "instrumentation-client.ts");

const violations = [];

await checkProxy();
await checkInstrumentationClient();

if (violations.length > 0) {
  console.error("[guard:auth-hot-path] request-hot auth read drift detected:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.reason}] ${violation.text}`);
    console.error(`  ${violation.message}`);
  }
  console.error(
    "  Keep Supabase Auth getUser() off public first-render, telemetry, browser analytics, and behind the verified Moonlight session bypass in proxy.ts.",
  );
  process.exit(1);
}

console.log("[guard:auth-hot-path] OK (auth server reads stay off Moonlight hot paths).");

async function checkProxy() {
  const contents = await readFile(PROXY_FILE, "utf8");
  const rel = path.relative(ROOT, PROXY_FILE);

  if (/@\/app\/server\/auth\/moonlight-scholar-(?:token|session)(?=["'])/.test(contents)) {
    const match = contents.match(
      /@\/app\/server\/auth\/moonlight-scholar-(?:token|session)(?=["'])/,
    );
    violations.push({
      file: rel,
      line: lineNumberAt(contents, match?.index ?? 0),
      reason: "proxy-imports-heavy-moonlight-auth-module",
      text: match?.[0] ?? "moonlight auth import",
      message:
        "proxy.ts must import only lightweight cookie constants, not token/session modules that pull request headers, crypto, or JWT verification into the proxy hot path.",
    });
  }

  for (const match of contents.matchAll(/\.auth\.getUser\s*\(/g)) {
    const preceding = contents.slice(0, match.index ?? 0);
    if (/MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES/.test(contents)) {
      violations.push({
        file: rel,
        line: lineNumberAt(
          contents,
          contents.indexOf("MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES"),
        ),
        reason: "proxy-uses-clear-only-cookie-list",
        text: "MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES",
        message:
          "proxy.ts must use only the currently verified Moonlight session cookie list for auth bypass; stale/future cookie names are clear-only.",
      });
    }

    if (!/MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES/.test(contents)) {
      violations.push({
        file: rel,
        line: lineNumberAt(contents, match.index ?? 0),
        reason: "proxy-get-user-without-moonlight-cookie-list",
        text: "auth.getUser(",
        message:
          "proxy.ts may keep a legacy Supabase refresh, but it must key the bypass on MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES.",
      });
    }

    if (
      !/if\s*\(\s*hasMoonlightScholarSessionCookie\s*\(\s*request\s*\)\s*\)\s*\{\s*return\s+NextResponse\.next\s*\(/s.test(
        preceding,
      )
    ) {
      violations.push({
        file: rel,
        line: lineNumberAt(contents, match.index ?? 0),
        reason: "proxy-get-user-before-moonlight-bypass",
        text: "auth.getUser(",
        message:
          "Moonlight session requests must return before Supabase auth.getUser(), otherwise every matched request can call /auth/v1/user.",
      });
    }

    if (
      !/if\s*\(\s*!\s*hasSupabaseAuthSessionCookie\s*\(\s*request\s*\)\s*\)\s*\{\s*return\s+NextResponse\.next\s*\(/s.test(
        preceding,
      )
    ) {
      violations.push({
        file: rel,
        line: lineNumberAt(contents, match.index ?? 0),
        reason: "proxy-get-user-without-supabase-cookie-bypass",
        text: "auth.getUser(",
        message:
          "Proxy may refresh legacy Supabase sessions only when a Supabase auth-token cookie exists; unauthenticated Moonlight handoff requests must not call /auth/v1/user.",
      });
    }

    if (
      !/if\s*\(\s*shouldBypassSupabaseSessionRefresh\s*\(\s*request\s*\)\s*\)\s*\{\s*return\s+NextResponse\.next\s*\(/s.test(
        preceding,
      )
    ) {
      violations.push({
        file: rel,
        line: lineNumberAt(contents, match.index ?? 0),
        reason: "proxy-get-user-before-public-hot-path-bypass",
        text: "auth.getUser(",
        message:
          "Root, auth API, and public telemetry requests must bypass proxy Supabase refresh before auth.getUser(); their route/client code owns any background auth work.",
      });
    }
  }

  for (const requiredPath of [
    'pathname === "/"',
    'pathname.startsWith("/api/auth/")',
    'pathname === "/api/analytics-events"',
    'pathname === "/api/errors"',
  ]) {
    if (!contents.includes(requiredPath)) {
      violations.push({
        file: rel,
        line: 1,
        reason: "proxy-public-hot-path-bypass-missing-path",
        text: requiredPath,
        message:
          "proxy.ts must keep root, auth API, and public telemetry paths out of the Supabase refresh hot path.",
      });
    }
  }
}

async function checkInstrumentationClient() {
  const contents = await readFile(INSTRUMENTATION_CLIENT_FILE, "utf8");
  const rel = path.relative(ROOT, INSTRUMENTATION_CLIENT_FILE);

  for (const match of contents.matchAll(/\.auth\.getUser\s*\(/g)) {
    violations.push({
      file: rel,
      line: lineNumberAt(contents, match.index ?? 0),
      reason: "browser-instrumentation-auth-server-read",
      text: "auth.getUser(",
      message:
        "Browser analytics binding must not call Supabase auth.getUser(); use local session state or auth state change events instead.",
    });
  }
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}
