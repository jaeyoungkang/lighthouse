import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const installDir = path.join(repoRoot, ".agent-tools", "lsp-mcp");
const templatePath = path.join(scriptDir, "lsp-mcp.config.template.json");
const configPath = path.join(installDir, "lighthouse.lsp-mcp.json");
const packagePath = path.join(installDir, "package.json");
const binDir = path.join(installDir, "node_modules", ".bin");
const lspServerBin = path.join(binDir, binName("lsp-mcp-server"));
const tsLanguageServerBin = path.join(binDir, binName("typescript-language-server"));
const codexConfigPath = path.join(os.homedir(), ".codex", "config.toml");
const beginMarker = "# BEGIN LIGHTHOUSE LSP MCP";
const endMarker = "# END LIGHTHOUSE LSP MCP";

const flags = new Set(process.argv.slice(2));
const shouldCheck = flags.has("--check");
const shouldWriteCodexConfig = flags.has("--write-codex-config");

if (flags.has("--help")) {
  console.log(`Usage: npm run agent:lsp:install -- [--check] [--write-codex-config]

Installs the Light House LSP MCP tools into .agent-tools/lsp-mcp and writes a
repo-local LSP config. The install directory is intentionally git-ignored.

Options:
  --check                Verify the repo-local install without changing files.
  --write-codex-config   Append or refresh the Codex MCP block in ~/.codex/config.toml.
`);
  process.exit(0);
}

if (shouldCheck) {
  await checkInstall();
  process.exit(0);
}

await installTools();
await writeLspConfig();

if (shouldWriteCodexConfig) {
  await writeCodexConfig();
} else {
  console.log(
    "\nCodex MCP config block. Add this to ~/.codex/config.toml, or rerun with --write-codex-config:\n",
  );
  console.log(codexConfigBlock());
}

await checkInstall();

function binName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

async function installTools() {
  await fs.mkdir(installDir, { recursive: true });
  await fs.writeFile(
    packagePath,
    `${JSON.stringify(
      {
        private: true,
        name: "lighthouse-agent-lsp-mcp-tools",
        version: "0.0.0",
        dependencies: {
          "lsp-mcp-server": "^1.1.17",
          typescript: "^5",
          "typescript-language-server": "^5.3.0",
        },
      },
      null,
      2,
    )}\n`,
  );

  run("npm", ["install", "--prefix", installDir, "--no-audit", "--no-fund"]);
}

async function writeLspConfig() {
  const template = await fs.readFile(templatePath, "utf8");
  const rendered = template.replace(
    "__TYPESCRIPT_LANGUAGE_SERVER__",
    normalizePathForJson(tsLanguageServerBin),
  );
  await fs.writeFile(configPath, rendered);
  console.log(`Wrote ${path.relative(repoRoot, configPath)}`);
}

async function checkInstall() {
  const missing = [
    [lspServerBin, "lsp-mcp-server"],
    [tsLanguageServerBin, "typescript-language-server"],
    [configPath, "lighthouse.lsp-mcp.json"],
  ].filter(([filePath]) => !existsSync(filePath));

  if (missing.length > 0) {
    console.error("Missing Light House LSP MCP install artifacts:");
    for (const [, label] of missing) {
      console.error(`- ${label}`);
    }
    console.error("\nRun: npm run agent:lsp:install");
    process.exit(1);
  }

  console.log("Light House LSP MCP install is ready.");
  console.log(`- server: ${lspServerBin}`);
  console.log(`- config: ${configPath}`);
}

async function writeCodexConfig() {
  await fs.mkdir(path.dirname(codexConfigPath), { recursive: true });
  let current = "";
  try {
    current = await fs.readFile(codexConfigPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (current.includes("[mcp_servers.lsp]") && !current.includes(beginMarker)) {
    console.error(
      "Found an existing [mcp_servers.lsp] block outside the managed Light House block.",
    );
    console.error(
      "Not editing ~/.codex/config.toml automatically. Use this block after reconciling the existing LSP server:\n",
    );
    console.error(codexConfigBlock());
    process.exit(1);
  }

  const block = codexConfigBlock();
  const next = current.includes(beginMarker)
    ? current.replace(
        new RegExp(`${escapeRegExp(beginMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`),
        block.trimEnd(),
      )
    : `${current.trimEnd()}\n\n${block}`.trimStart();

  await fs.writeFile(codexConfigPath, `${next.trimEnd()}\n`);
  console.log(`Updated ${codexConfigPath}`);
}

function codexConfigBlock() {
  return `${beginMarker}
[mcp_servers.lsp]
command = "${normalizePathForToml(lspServerBin)}"
args = []
startup_timeout_sec = 120

[mcp_servers.lsp.env]
LSP_CONFIG_PATH = "${normalizePathForToml(configPath)}"
LSP_LOG_LEVEL = "info"
${endMarker}
`;
}

function normalizePathForJson(value) {
  return value.split(path.sep).join("/");
}

function normalizePathForToml(value) {
  return normalizePathForJson(value).replaceAll('"', '\\"');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
