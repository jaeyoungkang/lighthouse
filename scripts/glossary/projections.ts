import { format, resolveConfig } from "prettier";

import type { GlossaryRegistry } from "./model";

export const README_OUTPUT = "docs/glossary/README.md";
export const DOMAIN_OUTPUT = "app/domain/glossary-terms.generated.ts";
export const I18N_OUTPUT = "app/i18n/glossary-term-refs.generated.ts";

export async function renderProjections(
  registry: GlossaryRegistry,
): Promise<Readonly<Record<string, string>>> {
  return {
    [README_OUTPUT]: await renderReadme(registry),
    [DOMAIN_OUTPUT]: await renderDomain(registry),
    [I18N_OUTPUT]: await renderI18nReferences(registry),
  };
}

async function renderReadme(registry: GlossaryRegistry): Promise<string> {
  const rows = registry.terms
    .map((term) => {
      const aliases = term.aliases.length > 0 ? term.aliases.join(", ") : "—";
      const authorityLink = `../${term.authorityRef.slice("docs/".length)}`;
      return `| ${term.id} | ${term.ko} | ${term.en} | ${aliases} | ${term.kind} | [source](${authorityLink}) |`;
    })
    .join("\n");

  const source = `<!-- Generated from terms.json by npm run glossary -- generate. Do not edit. -->

# Light House Glossary

이 표는 기존 계약과 제품 표면의 정본 이름을 연결하는 파생 인덱스다. 용어의
제품 의미는 Authority가 가리키는 기존 계약이 계속 소유한다.

| Term ID | 한국어 | English | Aliases | Kind | Authority |
| --- | --- | --- | --- | --- | --- |
${rows}

Aliases are lookup-only. Use the canonical term id in code and generated artifacts.
`;

  return formatProjection(source, README_OUTPUT, "markdown");
}

async function renderDomain(registry: GlossaryRegistry): Promise<string> {
  const entries = registry.terms.map((term) => `  ${JSON.stringify(term.id)},`).join("\n");
  const source = `// Generated from docs/glossary/terms.json. Do not edit.

export const GLOSSARY_TERM_IDS = [
${entries}
] as const;

export type GlossaryTermId = (typeof GLOSSARY_TERM_IDS)[number];
`;

  return formatProjection(source, DOMAIN_OUTPUT, "typescript");
}

async function renderI18nReferences(registry: GlossaryRegistry): Promise<string> {
  const i18nRefs = registry.i18nRefs
    .map(
      (reference) => `  {
    termId: ${JSON.stringify(reference.termId)},
    key: ${JSON.stringify(reference.key)},
  },`,
    )
    .join("\n");
  const source = `// Generated from docs/glossary/terms.json. Do not edit.

import type { GlossaryTermId } from "@/app/domain/glossary-terms.generated";
import type { MessageKey } from "@/app/i18n/messages";

export const GLOSSARY_I18N_REFS = [
${i18nRefs}
] as const satisfies readonly {
  termId: GlossaryTermId;
  key: MessageKey;
}[];
`;

  return formatProjection(source, I18N_OUTPUT, "typescript");
}

async function formatProjection(
  source: string,
  filePath: string,
  parser: "markdown" | "typescript",
): Promise<string> {
  const config = (await resolveConfig(filePath)) ?? {};
  return format(source, { ...config, filepath: filePath, parser });
}
