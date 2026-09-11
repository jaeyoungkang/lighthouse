import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GenerateContentParams = {
  model: string;
  contents: string;
  config?: {
    abortSignal?: AbortSignal;
    responseMimeType?: string;
    temperature?: number;
    topP?: number;
    seed?: number;
    thinkingConfig?: {
      thinkingLevel?: string;
    };
    httpOptions?: {
      timeout?: number;
      retryOptions?: { attempts?: number };
    };
  };
};

type GenerateContentMock = (params: GenerateContentParams) => Promise<{
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
  };
}>;

const gatewayMocks = vi.hoisted(() => {
  const openAiProvider = vi.fn((model: string) => ({ provider: "openai", model }));
  return {
    createOpenAI: vi.fn(() => openAiProvider),
    openAiProvider,
    generateText: vi.fn(),
    outputJson: vi.fn(() => ({ type: "json-output" })),
    generateContent: vi.fn<GenerateContentMock>(),
    loadEnvConfig: vi.fn(),
    observe: vi.fn(),
  };
});

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: gatewayMocks.createOpenAI,
}));

vi.mock("ai", () => ({
  generateText: gatewayMocks.generateText,
  Output: {
    json: gatewayMocks.outputJson,
  },
}));

vi.mock("@next/env", () => ({
  loadEnvConfig: gatewayMocks.loadEnvConfig,
}));

vi.mock("@/app/lib/observe", () => ({
  observe: gatewayMocks.observe,
}));

vi.mock("@/app/server/ai-generation/gemini", () => ({
  GEMINI_GENERATE_CONTENT_THINKING_LEVEL: "minimal",
  GEMINI_MODEL: "gemini-3-flash-preview",
  getGeminiClient: vi.fn(() => ({
    models: {
      generateContent: gatewayMocks.generateContent,
    },
  })),
}));

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

function restoreEnv(): void {
  if (originalOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiApiKey;
}

async function importGateway() {
  vi.resetModules();
  return import("../gateway");
}

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  gatewayMocks.createOpenAI.mockClear();
  gatewayMocks.openAiProvider.mockClear();
  gatewayMocks.generateText.mockReset();
  gatewayMocks.outputJson.mockClear();
  gatewayMocks.generateContent.mockReset();
  gatewayMocks.loadEnvConfig.mockClear();
  gatewayMocks.observe.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  restoreEnv();
});

describe("structured generation provider telemetry", () => {
  it("records complete provider-attempt telemetry for successful generation", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_025);
    const { executeStructuredGenerationWithUsage } = await importGateway();
    gatewayMocks.generateContent.mockResolvedValue({
      text: '{"title":"ok"}',
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 },
    });

    await executeStructuredGenerationWithUsage({
      prompt: "structured prompt",
      timeoutMs: 1_234,
    });

    expect(gatewayMocks.observe).toHaveBeenCalledTimes(2);
    expect(gatewayMocks.observe.mock.calls[0]?.[0]).toMatchObject({
      category: "ai-call",
      action: "structured-generation-provider-attempt",
      status: "start",
      metadata: {
        role: "selected",
        provider: "gemini",
        model: "gemini-3-flash-preview",
        timeoutMs: 1_234,
        breakerScope: "process_local",
        breakerState: null,
      },
    });
    expect(gatewayMocks.observe.mock.calls[1]?.[0]).toMatchObject({
      category: "ai-call",
      action: "structured-generation-provider-attempt",
      status: "success",
      duration: 25,
      metadata: {
        role: "selected",
        provider: "gemini",
        model: "gemini-3-flash-preview",
        breakerScope: "process_local",
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        costUsdMicros: 80,
      },
    });
    expect(JSON.stringify(gatewayMocks.observe.mock.calls)).not.toContain("structured prompt");
    now.mockRestore();
  });

  it("records failure classification and retry metadata for a failed provider attempt", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValueOnce(2_000).mockReturnValueOnce(2_040);
    const { executeStructuredGenerationWithUsage } = await importGateway();
    gatewayMocks.generateContent.mockRejectedValue(
      Object.assign(new Error("provider unavailable"), { status: 503, retryAfter: 12 }),
    );

    await expect(
      executeStructuredGenerationWithUsage({ prompt: "structured prompt", timeoutMs: 2_345 }),
    ).rejects.toThrow("provider unavailable");

    expect(gatewayMocks.observe).toHaveBeenCalledTimes(2);
    expect(gatewayMocks.observe.mock.calls[1]?.[0]).toMatchObject({
      category: "ai-call",
      action: "structured-generation-provider-attempt",
      status: "fail",
      duration: 40,
      metadata: {
        role: "selected",
        provider: "gemini",
        model: "gemini-3-flash-preview",
        failureClass: "provider_5xx",
        retryAfterSeconds: 12,
        breakerScope: "process_local",
      },
    });
    expect(JSON.stringify(gatewayMocks.observe.mock.calls)).not.toContain("structured prompt");
    now.mockRestore();
  });
});

describe("executeStructuredGeneration gateway", () => {
  it("uses JSON mode, request timeout, and no retry for structured generation", async () => {
    const { executeStructuredGeneration } = await importGateway();
    gatewayMocks.generateContent.mockResolvedValue({
      text: '{"title":"ok"}',
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 },
    });

    await expect(
      executeStructuredGeneration({
        prompt: "structured prompt",
        timeoutMs: 1234,
        temperature: 0,
        topP: 1,
        seed: 237,
      }),
    ).resolves.toBe('{"title":"ok"}');

    const generationCall = gatewayMocks.generateContent.mock.calls[0][0];
    expect(generationCall).toMatchObject({
      model: "gemini-3-flash-preview",
      contents: "structured prompt",
    });
    expect(generationCall.config).toBeDefined();
    const generationConfig = generationCall.config;
    if (!generationConfig) {
      throw new Error("expected structured generation config");
    }
    expect(generationConfig.abortSignal).toBeInstanceOf(AbortSignal);
    expect(generationConfig.responseMimeType).toBe("application/json");
    expect(generationConfig.temperature).toBe(0);
    expect(generationConfig.topP).toBe(1);
    expect(generationConfig.seed).toBe(237);
    expect(generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(generationConfig.httpOptions).toEqual({
      timeout: 1234,
      retryOptions: { attempts: 1 },
    });
  });

  it("routes GPT models through the OpenAI provider with JSON mode and deadline settings", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const { executeStructuredGeneration } = await importGateway();
    gatewayMocks.generateText.mockResolvedValue({
      text: '{"verdict":"ok"}',
      usage: {
        inputTokens: 200,
        inputTokenDetails: {},
        outputTokens: 20,
        outputTokenDetails: {},
        totalTokens: 220,
      },
    });

    await expect(
      executeStructuredGeneration({
        model: "gpt-5-mini",
        prompt: "judge prompt",
        maxOutputTokens: 321,
        timeoutMs: 2345,
        temperature: 0,
        topP: 1,
        seed: 237,
      }),
    ).resolves.toBe('{"verdict":"ok"}');

    expect(gatewayMocks.createOpenAI).toHaveBeenCalledWith({ apiKey: "openai-key" });
    expect(gatewayMocks.openAiProvider).toHaveBeenCalledWith("gpt-5-mini");
    expect(gatewayMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: "openai", model: "gpt-5-mini" },
        prompt: "judge prompt",
        output: { type: "json-output" },
        maxOutputTokens: 321,
        temperature: 0,
        topP: 1,
        seed: 237,
        maxRetries: 0,
        timeout: 2345,
      }),
    );
    expect(gatewayMocks.outputJson).toHaveBeenCalledWith();
    expect(gatewayMocks.generateContent).not.toHaveBeenCalled();
  });

  it("strips an OpenAI provider prefix before calling the OpenAI provider", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const { executeStructuredGeneration } = await importGateway();
    gatewayMocks.generateText.mockResolvedValue({ text: '{"verdict":"ok"}' });

    await expect(
      executeStructuredGeneration({
        model: "openai/gpt-5-mini",
        prompt: "judge prompt",
      }),
    ).resolves.toBe('{"verdict":"ok"}');

    expect(gatewayMocks.openAiProvider).toHaveBeenCalledWith("gpt-5-mini");
    expect(gatewayMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: "openai", model: "gpt-5-mini" },
      }),
    );
    expect(gatewayMocks.generateContent).not.toHaveBeenCalled();
  });

  it("returns measured Gemini usage and estimated cost from the usage-aware API", async () => {
    const { executeStructuredGenerationWithUsage } = await importGateway();
    gatewayMocks.generateContent.mockResolvedValue({
      text: '{"title":"ok"}',
      usageMetadata: {
        promptTokenCount: 1_000_000,
        candidatesTokenCount: 1_000_000,
        totalTokenCount: 2_000_000,
      },
    });

    await expect(
      executeStructuredGenerationWithUsage({
        model: "gemini-3.1-flash-lite",
        prompt: "structured prompt",
      }),
    ).resolves.toMatchObject({
      text: '{"title":"ok"}',
      model: "gemini-3.1-flash-lite",
      usage: {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      },
      costUsdMicros: 1_750_000,
      priced: true,
    });
  });

  it("keeps usage capture for OpenAI models while leaving cost null without an explicit price", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const { executeStructuredGenerationWithUsage } = await importGateway();
    gatewayMocks.generateText.mockResolvedValue({
      text: '{"verdict":"ok"}',
      usage: {
        inputTokens: 300,
        inputTokenDetails: { cacheReadTokens: 25 },
        outputTokens: 40,
        outputTokenDetails: { reasoningTokens: 10 },
        totalTokens: 350,
      },
    });

    await expect(
      executeStructuredGenerationWithUsage({
        model: "gpt-5-mini",
        prompt: "judge prompt",
      }),
    ).resolves.toMatchObject({
      text: '{"verdict":"ok"}',
      model: "gpt-5-mini",
      usage: {
        inputTokens: 300,
        outputTokens: 40,
        totalTokens: 350,
        reasoningTokens: 10,
        cachedInputTokens: 25,
      },
      costUsdMicros: null,
      priced: false,
    });
  });
});

describe("inline analysis failover gateway", () => {
  it("fails over once from a transient Gemini failure to the pinned OpenAI model", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const { executeStructuredGenerationWithUsage, INLINE_ANALYSIS_SECONDARY_MODEL } =
      await importGateway();
    gatewayMocks.generateContent.mockRejectedValue(
      Object.assign(new Error("unavailable"), { status: 503 }),
    );
    gatewayMocks.generateText.mockResolvedValue({ text: '{"status":"ok"}' });

    await expect(
      executeStructuredGenerationWithUsage({
        prompt: "inline analysis",
        providerPolicy: "inline_analysis_failover",
      }),
    ).resolves.toMatchObject({
      text: '{"status":"ok"}',
      provider: "openai",
      model: INLINE_ANALYSIS_SECONDARY_MODEL,
    });
    expect(gatewayMocks.generateContent).toHaveBeenCalledOnce();
    expect(gatewayMocks.openAiProvider).toHaveBeenCalledWith(INLINE_ANALYSIS_SECONDARY_MODEL);
    expect(gatewayMocks.generateText).toHaveBeenCalledOnce();
  });

  it("returns one exhausted error after both transient attempts without a third provider call", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const { executeStructuredGenerationWithUsage } = await importGateway();
    gatewayMocks.generateContent.mockRejectedValue(
      Object.assign(new Error("rate limited"), { status: 429, retryAfter: 15 }),
    );
    gatewayMocks.generateText.mockRejectedValue(
      Object.assign(new Error("unavailable"), { status: 503, retryAfter: 30 }),
    );

    await expect(
      executeStructuredGenerationWithUsage({
        prompt: "inline analysis",
        providerPolicy: "inline_analysis_failover",
      }),
    ).rejects.toMatchObject({
      name: "LlmFailoverExhaustedError",
      primaryFailureClass: "provider_429",
      secondaryFailureClass: "provider_5xx",
      retryAfterSeconds: 30,
    });
    expect(gatewayMocks.generateContent).toHaveBeenCalledOnce();
    expect(gatewayMocks.generateText).toHaveBeenCalledOnce();
  });

  it("bypasses Gemini only after the process-local circuit opens", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const { executeStructuredGenerationWithUsage } = await importGateway();
    gatewayMocks.generateContent.mockRejectedValue(
      Object.assign(new Error("down"), { status: 503 }),
    );
    gatewayMocks.generateText.mockResolvedValue({ text: '{"status":"ok"}' });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await executeStructuredGenerationWithUsage({
        prompt: "inline analysis",
        providerPolicy: "inline_analysis_failover",
      });
    }
    expect(gatewayMocks.generateContent).toHaveBeenCalledTimes(5);
    expect(gatewayMocks.generateText).toHaveBeenCalledTimes(6);
  });
});

describe("structured generation gateway deadlines and bounds", () => {
  it("throws before calling OpenAI when a GPT model is requested without OPENAI_API_KEY", async () => {
    const { executeStructuredGeneration } = await importGateway();

    await expect(
      executeStructuredGeneration({ model: "gpt-5-mini", prompt: "judge prompt" }),
    ).rejects.toThrow("[openai] Missing OPENAI_API_KEY");
    expect(gatewayMocks.generateText).not.toHaveBeenCalled();
  });

  it("aborts structured generation when the explicit deadline expires", async () => {
    vi.useFakeTimers();
    const { executeStructuredGeneration } = await importGateway();
    gatewayMocks.generateContent.mockImplementation(
      (params: { config?: { abortSignal?: AbortSignal } }) =>
        new Promise((_resolve, reject) => {
          const signal = params.config?.abortSignal;
          signal?.addEventListener("abort", () => {
            const reason: unknown = signal.reason;
            const error = Object.assign(
              new Error(reason instanceof DOMException ? reason.message : String(reason)),
              {
                name: reason instanceof DOMException ? reason.name : "AbortError",
              },
            );
            reject(error);
          });
        }),
    );

    const generation = executeStructuredGeneration({
      prompt: "structured prompt",
      timeoutMs: 5,
    });
    const expectation = expect(generation).rejects.toMatchObject({ name: "TimeoutError" });

    await vi.advanceTimersByTimeAsync(5);
    await expectation;
  });
});

describe("structured generation input byte budget", () => {
  it("rejects a multibyte prompt over its exact UTF-8 budget before provider dispatch", async () => {
    const { executeStructuredGeneration, StructuredGenerationInputTooLargeError } =
      await importGateway();

    await expect(
      executeStructuredGeneration({
        prompt: "논문".repeat(10),
        maxInputBytes: 59,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: StructuredGenerationInputTooLargeError.name,
        actualBytes: 60,
        maxBytes: 59,
      }),
    );

    expect(gatewayMocks.generateContent).not.toHaveBeenCalled();
    expect(gatewayMocks.generateText).not.toHaveBeenCalled();
  });

  it("allows a prompt exactly on its UTF-8 byte ceiling", async () => {
    const { executeStructuredGeneration } = await importGateway();
    gatewayMocks.generateContent.mockResolvedValue({ text: '{"status":"ok"}' });

    await expect(
      executeStructuredGeneration({
        prompt: "논문".repeat(10),
        maxInputBytes: 60,
      }),
    ).resolves.toBe('{"status":"ok"}');

    expect(gatewayMocks.generateContent).toHaveBeenCalledOnce();
  });
});
