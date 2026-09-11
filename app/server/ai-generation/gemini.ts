import { loadEnvConfig } from "@next/env";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_LITE_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_THINKING_LEVEL = "minimal";
export const GEMINI_GENERATE_CONTENT_THINKING_LEVEL = ThinkingLevel.MINIMAL;

let _client: GoogleGenAI | null = null;
let _envLoaded = false;

function ensureServerEnvLoaded() {
  if (_envLoaded || typeof window !== "undefined") return;
  loadEnvConfig(process.cwd());
  _envLoaded = true;
}

export function resolveGeminiApiKey(): string | null {
  ensureServerEnvLoaded();
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
}

export function hasGeminiApiKey(): boolean {
  return resolveGeminiApiKey() !== null;
}

function requireGeminiApiKey(): string {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("[gemini] Missing GEMINI_API_KEY");
  }

  return apiKey;
}

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: requireGeminiApiKey() });
  }
  return _client;
}
