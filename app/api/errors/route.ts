import { z } from "zod";
import { after } from "next/server";

import { recordClientErrorReport } from "@/app/server/domain-access/error-access";
import {
  consumePublicTelemetryIngressBudget,
  runPublicTelemetryDrain,
} from "@/app/server/operational/public-telemetry-ingress";
import { readBoundedJsonBody } from "@/app/server/lib/bounded-json-body";
import {
  ERROR_LOG_METADATA_LIMITS,
  ERROR_LOG_METADATA_TRUNCATED_KEY,
  sanitizeErrorLogMetadata,
} from "@/app/server/lib/error-log-metadata";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";

export const maxDuration = 15;

const errorReportSchema = z
  .object({
    message: z.string().min(1).max(4000),
    metadata: z
      .record(z.string().max(ERROR_LOG_METADATA_LIMITS.maxKeyLength), z.unknown())
      .superRefine((metadata, context) => {
        if (Object.hasOwn(metadata, ERROR_LOG_METADATA_TRUNCATED_KEY)) {
          context.addIssue({
            code: "custom",
            message: `top-level ${ERROR_LOG_METADATA_TRUNCATED_KEY} is reserved for server truncation state`,
          });
        }
        if (Object.keys(metadata).length > ERROR_LOG_METADATA_LIMITS.maxObjectKeys) {
          context.addIssue({
            code: "custom",
            message: `metadata must contain at most ${String(ERROR_LOG_METADATA_LIMITS.maxObjectKeys)} keys`,
          });
        }
      })
      .optional(),
  })
  .strict();

function scheduleErrorReportDrain(drain: () => Promise<void>): void {
  const runDrain = async () => {
    const accepted = await runPublicTelemetryDrain(drain);
    if (!accepted) {
      console.warn("[errors] client error drain dropped by public telemetry ceiling");
    }
  };
  try {
    after(runDrain);
  } catch {
    void runDrain();
  }
}

export async function POST(req: Request) {
  try {
    const ingress = consumePublicTelemetryIngressBudget(req, "errors");
    if (!ingress.allowed) {
      console.warn("[errors] public telemetry ingress dropped:", ingress.reason);
      return new Response(null, { status: 204 });
    }

    const body = await readBoundedJsonBody(req, getRouteBodyLimit("app/api/errors/route.ts")).catch(
      (): unknown => null,
    );
    const parsed = errorReportSchema.safeParse(body);
    if (!parsed.success) return new Response(null, { status: 204 });

    scheduleErrorReportDrain(async () => {
      await recordClientErrorReport({
        message: parsed.data.message,
        metadata: parsed.data.metadata ? sanitizeErrorLogMetadata(parsed.data.metadata) : undefined,
      });
    });
  } catch {
    // fire-and-forget — 실패해도 204
  }

  return new Response(null, { status: 204 });
}
