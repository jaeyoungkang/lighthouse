import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

type Severity = "ok" | "warn" | "fail";

type Check = {
  detail?: string;
  name: string;
  severity: Severity;
};

const repoRoot = process.cwd();
const checks: Check[] = [];

function record(severity: Severity, name: string, detail?: string): void {
  checks.push({ detail, name, severity });
}

function commandExists(command: string): boolean {
  try {
    execFileSync("which", [command], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function readCommand(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function parseMajor(version: string): number | null {
  const major = /^v?(\d+)/.exec(version)?.[1];
  return major ? Number.parseInt(major, 10) : null;
}

function readEnvLocal(): Map<string, string> | null {
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) {
    return null;
  }

  const entries = new Map<string, string>();
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    entries.set(key, value);
  }
  return entries;
}

function hasUsableEnvValue(env: Map<string, string>, key: string): boolean {
  const value = env.get(key);
  return Boolean(value && !value.includes("your-") && !value.includes("<"));
}

function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (isOpen: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(isOpen);
    };
    socket.setTimeout(800);
    socket.once("connect", () => {
      done(true);
    });
    socket.once("error", () => {
      done(false);
    });
    socket.once("timeout", () => {
      done(false);
    });
  });
}

function checkNode(): void {
  const nodeVersion = process.version;
  const nodeMajor = parseMajor(nodeVersion);
  if (nodeMajor !== null && nodeMajor >= 20) {
    record("ok", "Node.js", nodeVersion);
  } else {
    record("fail", "Node.js", `expected v20 or newer, found ${nodeVersion}`);
  }
}

function checkNpm(): void {
  const npmVersion = readCommand("npm", ["--version"]);
  if (npmVersion) {
    record("ok", "npm", npmVersion);
  } else {
    record("fail", "npm", "npm is not available");
  }
}

function checkDependencies(): void {
  if (existsSync(path.join(repoRoot, "node_modules"))) {
    record("ok", "dependencies", "node_modules exists");
  } else {
    record("fail", "dependencies", "run npm install");
  }
}

function checkDocker(): void {
  if (commandExists("docker")) {
    const dockerInfo = readCommand("docker", ["info"]);
    if (dockerInfo) {
      record("ok", "Docker daemon", "running");
    } else {
      record("fail", "Docker daemon", "Docker is installed but not running");
    }
  } else {
    record("fail", "Docker CLI", "install Docker Desktop or a compatible Docker runtime");
  }
}

function checkSupabaseCli(): void {
  if (commandExists("supabase")) {
    const supabaseVersion = readCommand("supabase", ["--version"]);
    record("ok", "Supabase CLI", supabaseVersion || "installed");
  } else {
    record("fail", "Supabase CLI", "install the Supabase CLI");
  }
}

function checkRequiredEnv(env: Map<string, string>): void {
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (hasUsableEnvValue(env, key)) {
      record("ok", key);
    } else {
      record("fail", key, "set this from supabase status");
    }
  }
}

function checkLocalSupabaseUrl(env: Map<string, string>): void {
  const supabaseUrl = env.get("NEXT_PUBLIC_SUPABASE_URL");
  if (supabaseUrl && !/https?:\/\/(127\.0\.0\.1|localhost):54321/.test(supabaseUrl)) {
    record("warn", "local Supabase URL", "not pointing at local Docker Supabase");
  }
}

function checkOptionalEnv(env: Map<string, string>): void {
  for (const key of ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"]) {
    if (!hasUsableEnvValue(env, key)) {
      record("warn", key, "optional, but some AI/search paths may be limited");
    }
  }
}

function checkEnv(): void {
  const env = readEnvLocal();
  if (!env) {
    record("fail", ".env.local", "copy .env.local.example to .env.local");
    return;
  }

  record("ok", ".env.local", "found");
  checkRequiredEnv(env);
  checkLocalSupabaseUrl(env);
  checkOptionalEnv(env);
}

async function checkSupabasePorts(): Promise<void> {
  const ports = [
    {
      closedDetail: "run supabase start",
      name: "Supabase API port 54321",
      port: 54321,
      severityWhenClosed: "fail" as const,
    },
    {
      closedDetail: "run supabase start",
      name: "Supabase Postgres port 54322",
      port: 54322,
      severityWhenClosed: "fail" as const,
    },
    {
      closedDetail: "Studio is not reachable; run supabase start if needed",
      name: "Supabase Studio port 54323",
      port: 54323,
      severityWhenClosed: "warn" as const,
    },
  ];

  for (const portCheck of ports) {
    const isOpen = await checkPort("127.0.0.1", portCheck.port);
    record(
      isOpen ? "ok" : portCheck.severityWhenClosed,
      portCheck.name,
      isOpen ? "open" : portCheck.closedDetail,
    );
  }
}

function printSummary(): void {
  for (const check of checks) {
    const icon = check.severity === "ok" ? "OK" : check.severity === "warn" ? "WARN" : "FAIL";
    console.log(`${icon} ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
  }

  const failCount = checks.filter((check) => check.severity === "fail").length;
  const warnCount = checks.filter((check) => check.severity === "warn").length;
  console.log("");
  console.log(`Onboarding check: ${String(failCount)} failed, ${String(warnCount)} warning(s).`);

  if (failCount > 0) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  checkNode();
  checkNpm();
  checkDependencies();
  checkDocker();
  checkSupabaseCli();
  checkEnv();
  await checkSupabasePorts();
  printSummary();
}

void main();
