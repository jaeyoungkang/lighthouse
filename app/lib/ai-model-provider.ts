const OPENAI_MODEL_PREFIX_PATTERN = /^(?:gpt-|o\d|chatgpt-|ft:(?:gpt-|o\d|chatgpt-))/i;
const OPENAI_PROVIDER_PREFIX_PATTERN = /^openai\/(.+)$/i;

export function getOpenAiModelId(model: string): string | null {
  const trimmed = model.trim();
  const providerQualified = OPENAI_PROVIDER_PREFIX_PATTERN.exec(trimmed);
  const candidate = providerQualified?.[1] ?? trimmed;
  return OPENAI_MODEL_PREFIX_PATTERN.test(candidate) ? candidate : null;
}

export function isOpenAiModel(model: string): boolean {
  return getOpenAiModelId(model) !== null;
}
