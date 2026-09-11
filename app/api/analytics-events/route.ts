import { z } from "zod";
import { after } from "next/server";

import {
  getAnalyticsEventRouterForTrustedServer,
  isPublicClientAnalyticsEventNameAllowed,
} from "@/app/server/domain-access/analytics-event-access";
import { resolveCurrentUser } from "@/app/server/auth/identity";
import {
  consumePublicTelemetryIngressBudget,
  runPublicTelemetryDrain,
} from "@/app/server/operational/public-telemetry-ingress";
import { readBoundedJsonBody } from "@/app/server/lib/bounded-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";

export const maxDuration = 15;

const boundedRecord = <T extends z.ZodType>(valueSchema: T, maximumKeys: number) =>
  z.record(z.string().max(160), valueSchema).superRefine((value, context) => {
    if (Object.keys(value).length > maximumKeys) {
      context.addIssue({
        code: "custom",
        message: `record must contain at most ${String(maximumKeys)} keys`,
      });
    }
  });

const canonicalEventPayloadSchema = z
  .object({
    name: z.string().min(1).max(160),
    payload: z
      .object({
        actor: z
          .object({
            type: z.literal("user"),
            id: z.string().max(320).optional(),
          })
          .strict(),
        deviceId: z.string().max(256).optional(),
        sessionId: z.number().optional(),
        subject: boundedRecord(
          z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]),
          64,
        ).optional(),
        properties: boundedRecord(z.unknown(), 64),
      })
      .strict(),
  })
  .strict();

function summarizeZodIssues(issues: z.core.$ZodIssue[]): Array<{
  path: string;
  code: z.core.$ZodIssue["code"];
  message: string;
}> {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
    message: issue.message,
  }));
}

async function normalizePublicUserActor(
  payload: z.infer<typeof canonicalEventPayloadSchema>["payload"],
): Promise<z.infer<typeof canonicalEventPayloadSchema>["payload"]> {
  try {
    const user = await resolveCurrentUser();
    if (!user?.email) {
      return {
        ...payload,
        actor: { type: "user" },
      };
    }
    return {
      ...payload,
      actor: { type: "user", id: user.email },
    };
  } catch {
    return {
      ...payload,
      actor: { type: "user" },
    };
  }
}

function logAnalyticsTrackResult(
  result: Awaited<
    ReturnType<ReturnType<typeof getAnalyticsEventRouterForTrustedServer>["trackCanonicalEvent"]>
  >,
): void {
  if (!result.ok) console.error("[analytics-events] canonical event rejected:", result.error);
  if (result.storeError) {
    console.error("[analytics-events] canonical event store failed:", result.storeError);
  }
  if (result.sinkErrors?.length) {
    console.error(
      "[analytics-events] canonical event sink failed:",
      result.sinkErrors.map(summarizeAnalyticsErrorForLog),
    );
  }
}

function summarizeAnalyticsErrorForLog(error: Error): { name: string; message: string } {
  return {
    name: error.name || "Error",
    message: error.message || String(error),
  };
}

function scheduleAnalyticsDrain(drain: () => Promise<void>): void {
  const runDrain = async () => {
    const accepted = await runPublicTelemetryDrain(drain);
    if (!accepted) {
      console.warn("[analytics-events] canonical event drain dropped by public telemetry ceiling");
    }
  };
  try {
    after(runDrain);
  } catch {
    void runDrain();
  }
}

/** POST /api/analytics-events — canonical analytics event 저장 (fire-and-forget) */
export async function POST(req: Request) {
  try {
    const ingress = consumePublicTelemetryIngressBudget(req, "analytics-events");
    if (!ingress.allowed) {
      console.warn("[analytics-events] public telemetry ingress dropped:", ingress.reason);
      return new Response(null, { status: 204 });
    }

    const body = await readBoundedJsonBody(
      req,
      getRouteBodyLimit("app/api/analytics-events/route.ts"),
    ).catch((): unknown => null);
    const parsed = canonicalEventPayloadSchema.safeParse(body);
    if (!parsed.success) {
      console.error(
        "[analytics-events] invalid canonical event payload:",
        summarizeZodIssues(parsed.error.issues),
      );
      return new Response(null, { status: 204 });
    }

    if (!isPublicClientAnalyticsEventNameAllowed(parsed.data.name)) {
      console.error("[analytics-events] public route rejected non-client event:", parsed.data.name);
      return new Response(null, { status: 204 });
    }

    scheduleAnalyticsDrain(async () => {
      try {
        const payload = await normalizePublicUserActor(parsed.data.payload);
        const result = await getAnalyticsEventRouterForTrustedServer().trackCanonicalEvent(
          parsed.data.name,
          payload,
        );
        logAnalyticsTrackResult(result);
      } catch (error) {
        console.error("[analytics-events] canonical event drain failed:", error);
      }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[analytics-events] canonical event route failed:", error);
    return new Response(null, { status: 204 });
  }
}
