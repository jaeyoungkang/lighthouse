import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { validateAuthorityReferences } from "./authority";
import {
  assertProjectionFile,
  assertRegistryFile,
  preflightProjectionTarget,
} from "./file-ownership";
import {
  findGlossaryTerm,
  parseGlossaryRegistry,
  type GlossaryRegistry,
  validateI18nReferences,
} from "./model";
import { renderProjections } from "./projections";

const REGISTRY_PATH = "docs/glossary/terms.json";

export async function runGlossaryCli(args: readonly string[]): Promise<void> {
  const [command, ...rest] = args;
  const registry = await loadRegistry();

  switch (command) {
    case "check":
      requireNoOperands(command, rest);
      await checkRegistry(registry);
      console.log("glossary: registry and projections are valid");
      return;
    case "generate":
      requireNoOperands(command, rest);
      await validateRegistry(registry);
      await writeProjections(registry);
      console.log("glossary: generated fixed projections");
      return;
    case "lookup":
      printLookup(registry, rest.join(" "));
      return;
    default:
      throw new Error("usage: npm run glossary -- <check|generate|lookup QUERY>");
  }
}

async function loadRegistry(): Promise<GlossaryRegistry> {
  await assertRegistryFile(REGISTRY_PATH);
  const source = await readFile(REGISTRY_PATH, "utf8");
  return parseGlossaryRegistry(JSON.parse(source) as unknown);
}

async function checkRegistry(registry: GlossaryRegistry): Promise<void> {
  await validateRegistry(registry);
  const projections = await renderProjections(registry);
  for (const [filePath, expected] of Object.entries(projections)) {
    await assertProjectionFile(filePath);
    const actual = await readFile(filePath, "utf8");
    if (actual !== expected) {
      throw new Error(`stale glossary projection: ${filePath}`);
    }
  }
}

async function validateRegistry(registry: GlossaryRegistry): Promise<void> {
  await validateAuthorityReferences(registry);
  const { default: messages } = await import("@/app/i18n/messages");
  validateI18nReferences(registry, messages);
}

async function writeProjections(registry: GlossaryRegistry): Promise<void> {
  const projections = await renderProjections(registry);
  await Promise.all(
    Object.keys(projections).map((filePath) => preflightProjectionTarget(filePath)),
  );
  await Promise.all(
    Object.entries(projections).map(([filePath, contents]) =>
      writeProjectionAtomically(filePath, contents),
    ),
  );
}

async function writeProjectionAtomically(filePath: string, contents: string): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function printLookup(registry: GlossaryRegistry, query: string): void {
  const term = requireTerm(registry, query);
  console.log(JSON.stringify(term, null, 2));
}

function requireTerm(registry: GlossaryRegistry, query: string) {
  if (!query) throw new Error("glossary query is required");
  const term = findGlossaryTerm(registry, query);
  if (!term) throw new Error(`unknown glossary term: ${query}`);
  return term;
}

function requireNoOperands(command: string, operands: readonly string[]): void {
  if (operands.length > 0) {
    throw new Error(`${command} does not accept operands`);
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  runGlossaryCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
