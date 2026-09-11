import type * as AmplitudeUnified from "@amplitude/unified";

type AmplitudeUnifiedModule = typeof AmplitudeUnified;

let amplitudeUnifiedModule: AmplitudeUnifiedModule | null = null;
let amplitudeUnifiedPromise: Promise<AmplitudeUnifiedModule | null> | null = null;
let amplitudeInitializationPromise: Promise<AmplitudeUnifiedModule | null> | null = null;
let amplitudeInitialized = false;

const AMPLITUDE_INIT_OPTIONS = {
  analytics: {
    defaultTracking: false,
  },
  sessionReplay: { sampleRate: 0.1 },
} as const;

export function isAmplitudeUnifiedConfigured(): boolean {
  return typeof window !== "undefined" && Boolean(readAmplitudeKey());
}

export function readAmplitudeUnifiedModule(): AmplitudeUnifiedModule | null {
  if (typeof window === "undefined") return null;
  if (!readAmplitudeKey()) return null;
  if (!amplitudeUnifiedModule) void loadAmplitudeUnifiedModule();
  return amplitudeUnifiedModule;
}

export function loadAmplitudeUnifiedModule(): Promise<AmplitudeUnifiedModule | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!readAmplitudeKey()) return Promise.resolve(null);
  if (amplitudeUnifiedModule) return Promise.resolve(amplitudeUnifiedModule);
  amplitudeUnifiedPromise ??= import("@amplitude/unified")
    .then((module) => {
      amplitudeUnifiedModule = module;
      return module;
    })
    .catch(() => {
      amplitudeUnifiedPromise = null;
      return null;
    });
  return amplitudeUnifiedPromise;
}

export function initializeAmplitudeUnifiedModule(): Promise<AmplitudeUnifiedModule | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!readAmplitudeKey()) return Promise.resolve(null);
  amplitudeInitializationPromise ??= loadAmplitudeUnifiedModule()
    .then(async (module) => {
      if (!module) {
        amplitudeInitializationPromise = null;
        return null;
      }
      await initializeAmplitude(module);
      return module;
    })
    .catch(() => {
      amplitudeInitializationPromise = null;
      return null;
    });
  return amplitudeInitializationPromise;
}

export function resetLoadedAmplitudeModule(): void {
  if (!amplitudeUnifiedModule) return;

  try {
    amplitudeUnifiedModule.reset();
  } catch {
    // fire-and-forget
  }
}

async function initializeAmplitude(module: AmplitudeUnifiedModule): Promise<void> {
  const amplitudeKey = readAmplitudeKey();
  if (!amplitudeKey || amplitudeInitialized) return;
  await module.initAll(amplitudeKey, AMPLITUDE_INIT_OPTIONS);
  amplitudeInitialized = true;
}

function readAmplitudeKey(): string | undefined {
  return process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
}
