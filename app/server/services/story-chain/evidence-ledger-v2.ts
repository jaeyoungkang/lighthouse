import type { EvidenceLedger } from "@/app/domain/story-chain";

import {
  parseEvidenceLedgerRecord,
  serializeEvidenceLedgerRecord,
  type EvidenceLedgerRecord,
} from "./evidence-ledger-record";
import { resolveEvidenceLedgerRecord } from "./evidence-ledger-resolver";

export type EvidenceLedgerV2Data = EvidenceLedgerRecord;

export const serializeEvidenceLedgerV2 = serializeEvidenceLedgerRecord;

export function parseEvidenceLedgerV2(input: {
  source: string;
  file: string;
  requireCanonical?: boolean;
}): EvidenceLedger {
  return resolveEvidenceLedgerRecord(
    parseEvidenceLedgerRecord({
      source: input.source,
      file: input.file,
      canonical: input.requireCanonical,
    }),
    input.file,
  );
}
