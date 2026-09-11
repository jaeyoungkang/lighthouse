import { createHash } from "node:crypto";
import { z } from "zod";

const text = z.string().trim().min(1);
const opaqueRefId = z.string().regex(/^ref:[0-9a-f]{32}$/u);
const refVersion = z.string().regex(/^v[1-9][0-9]{0,8}$/u);
const sha256 = z
  .string()
  .regex(/^[0-9a-f]{64}$/u)
  .refine((value) => !/^0+$/u.test(value), "digest cannot be the all-zero sentinel");
const instant = z.iso
  .datetime({ offset: false, precision: 3 })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);

export const SEARCH_QUALITY_DECISION_CANONICALIZATION =
  "json-object-keys-lexicographic-utf8-v1" as const;
export const SEARCH_QUALITY_RESEARCH_BASIS = {
  repository: "corca-ai/moonlight-research",
  revision: "bbb2e0090fed2fc9c79e3cca82479d5e8320fc6e",
  path: "research/scholar-search-policy/2026-09-01-bounded-live-evaluation-policy-research.md",
  sha256: "b63e52b4980a397bdc54b017bc8730dd436cba4965214e8c7059f2436e849252",
} as const;

export const SEARCH_QUALITY_DECISION_KEYS = [
  "query-strata-distribution",
  "evaluation-source-privacy-sample",
  "canonical-paper-identity-alias-version",
  "topic-rubric-assessor-disagreement-coverage",
  "ranking-cutoffs-and-variation",
  "metric-threshold-method-and-values",
  "uncertainty-tie-missing-attrition",
  "provider-corpus-index-identity",
  "freshness-and-invalidation",
  "rollout-known-good-and-resume",
  "evidence-retention-and-disclosure",
] as const;

export const SEARCH_QUALITY_AUTHORITY_ROLES = [
  "human-product-owner",
  "operational-readiness-owner",
  "evaluation-methodology-responsibility",
  "privacy-security-responsibility",
  "pause-owner",
  "rollback-owner",
  "resume-owner",
] as const;

const SEARCH_QUALITY_SIGNOFF_ROLES = SEARCH_QUALITY_AUTHORITY_ROLES.slice(0, 4);
const decisionKey = z.enum(SEARCH_QUALITY_DECISION_KEYS);
const authorityRole = z.enum(SEARCH_QUALITY_AUTHORITY_ROLES);
const signoffRole = z.enum(SEARCH_QUALITY_SIGNOFF_ROLES);

const contentRef = z.object({ id: opaqueRefId, version: refVersion, sha256 }).strict();
const pendingDecision = z.object({ status: z.literal("pending") }).strict();
const resolvedDecision = z.object({ status: z.literal("resolved"), content: contentRef }).strict();
const decision = z
  .object({ key: decisionKey, resolution: z.union([pendingDecision, resolvedDecision]) })
  .strict();

const pendingAssignment = z.object({ role: authorityRole, status: z.literal("pending") }).strict();
const assignedPrincipal = z
  .object({
    role: authorityRole,
    status: z.literal("assigned"),
    principal: contentRef,
    assignedAt: instant,
  })
  .strict();
const assignment = z.union([pendingAssignment, assignedPrincipal]);

const overlapDecision = z
  .object({
    principal: contentRef,
    roles: z.array(authorityRole).min(2),
  })
  .strict()
  .superRefine((value, context) => {
    const indices = value.roles.map((role) => SEARCH_QUALITY_AUTHORITY_ROLES.indexOf(role));
    if (
      new Set(value.roles).size !== value.roles.length ||
      indices.some((index, position) => position > 0 && index <= (indices[position - 1] ?? -1))
    ) {
      context.addIssue({
        code: "custom",
        path: ["roles"],
        message: "overlap roles must be the unique canonical role set",
      });
    }
  });
const pendingOverlapReview = z.object({ status: z.literal("pending") }).strict();
const resolvedOverlapReview = z
  .object({
    status: z.literal("resolved"),
    policyDecisionSha256: sha256,
    assignmentGraphSha256: sha256,
    decisionRef: contentRef,
    decidedAt: instant,
    approverRole: signoffRole,
    approverPrincipal: contentRef,
    decisions: z.array(overlapDecision),
    approvalSha256: sha256,
  })
  .strict();

const pendingSignoff = z.object({ role: signoffRole, status: z.literal("pending") }).strict();
const approvedSignoff = z
  .object({
    role: signoffRole,
    status: z.literal("approved"),
    principal: contentRef,
    decisionRef: contentRef,
    approvedAt: instant,
    decisionBodySha256: sha256,
    approvalSha256: sha256,
  })
  .strict();
const signoff = z.union([pendingSignoff, approvedSignoff]);

const researchBasis = z
  .object({
    repository: z.literal(SEARCH_QUALITY_RESEARCH_BASIS.repository),
    revision: z.literal(SEARCH_QUALITY_RESEARCH_BASIS.revision),
    path: z.literal(SEARCH_QUALITY_RESEARCH_BASIS.path),
    sha256: z.literal(SEARCH_QUALITY_RESEARCH_BASIS.sha256),
  })
  .strict();

const decisionBodySchema = z
  .object({
    packetId: text,
    packetVersion: text,
    canonicalization: z.literal(SEARCH_QUALITY_DECISION_CANONICALIZATION),
    lifecycle: z.enum(["draft", "approval-pending", "approved", "superseded", "rejected"]),
    createdAt: instant,
    researchBasis,
    decisions: z.array(decision).length(SEARCH_QUALITY_DECISION_KEYS.length),
    authority: z
      .object({
        principalRegistry: z.union([pendingDecision, resolvedDecision]),
        revocationBasis: z.union([pendingDecision, resolvedDecision]),
        assignments: z.array(assignment).length(SEARCH_QUALITY_AUTHORITY_ROLES.length),
        overlapReview: z.union([pendingOverlapReview, resolvedOverlapReview]),
      })
      .strict(),
  })
  .strict()
  .superRefine((body, context) => {
    body.decisions.forEach((item, index) => {
      if (item.key !== SEARCH_QUALITY_DECISION_KEYS[index]) {
        context.addIssue({
          code: "custom",
          path: ["decisions", index, "key"],
          message: "decision slots must use the exact canonical order",
        });
      }
    });
    body.authority.assignments.forEach((item, index) => {
      if (item.role !== SEARCH_QUALITY_AUTHORITY_ROLES[index]) {
        context.addIssue({
          code: "custom",
          path: ["authority", "assignments", index, "role"],
          message: "authority assignments must use the exact canonical role order",
        });
      }
    });
  });

export const searchQualityDecisionPacketSchema = z
  .object({
    schemaVersion: z.literal("1"),
    decisionBody: decisionBodySchema,
    decisionBodySha256: sha256,
    signoffs: z.array(signoff).length(SEARCH_QUALITY_SIGNOFF_ROLES.length),
  })
  .strict()
  .superRefine((packet, context) => {
    packet.signoffs.forEach((item, index) => {
      if (item.role !== SEARCH_QUALITY_SIGNOFF_ROLES[index]) {
        context.addIssue({
          code: "custom",
          path: ["signoffs", index, "role"],
          message: "signoffs must use the exact canonical role order",
        });
      }
    });
  });

export type SearchQualityDecisionPacket = z.infer<typeof searchQualityDecisionPacketSchema>;
type DecisionBody = z.infer<typeof decisionBodySchema>;
type ContentRef = z.infer<typeof contentRef>;

export const parseSearchQualityDecisionPacket = (value: unknown) =>
  searchQualityDecisionPacketSchema.parse(value);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function getSearchQualityDecisionBodySha256(body: DecisionBody): string {
  return digest(decisionBodySchema.parse(body));
}

export function getSearchQualityPolicyDecisionSha256(body: DecisionBody): string {
  const parsed = decisionBodySchema.parse(body);
  return digest({
    schemaVersion: "1",
    canonicalization: parsed.canonicalization,
    packetId: parsed.packetId,
    packetVersion: parsed.packetVersion,
    researchBasis: parsed.researchBasis,
    decisions: parsed.decisions,
  });
}

export function getSearchQualityAssignmentGraphSha256(body: DecisionBody): string {
  const parsed = decisionBodySchema.parse(body);
  return digest({
    schemaVersion: "1",
    canonicalization: parsed.canonicalization,
    packetVersion: parsed.packetVersion,
    policyDecisionSha256: getSearchQualityPolicyDecisionSha256(parsed),
    roles: SEARCH_QUALITY_AUTHORITY_ROLES,
    principalRegistry: parsed.authority.principalRegistry,
    revocationBasis: parsed.authority.revocationBasis,
    assignments: parsed.authority.assignments,
  });
}

function refKey(ref: ContentRef): string {
  return canonicalJson(ref);
}

function sameRef(left: ContentRef, right: ContentRef): boolean {
  return refKey(left) === refKey(right);
}

type Finding = { code: string; message: string };
const finding = (code: string, message: string): Finding => ({ code, message });
type AssignedPrincipal = z.infer<typeof assignedPrincipal>;
type OverlapReview = DecisionBody["authority"]["overlapReview"];
type ResolvedOverlapReview = z.infer<typeof resolvedOverlapReview>;
type ApprovedSignoff = z.infer<typeof approvedSignoff>;

export function getSearchQualityOverlapApprovalSha256(
  body: DecisionBody,
  review: Omit<ResolvedOverlapReview, "approvalSha256">,
): string {
  const parsed = decisionBodySchema.parse(body);
  const decisionBodyProjectionSha256 = digest({
    ...parsed,
    authority: {
      ...parsed.authority,
      overlapReview: review,
    },
  });
  return digest({
    schemaVersion: "1",
    canonicalization: parsed.canonicalization,
    packetVersion: parsed.packetVersion,
    decisionBodyProjectionSha256,
    policyDecisionSha256: review.policyDecisionSha256,
    assignmentGraphSha256: review.assignmentGraphSha256,
    decisionRef: review.decisionRef,
    decidedAt: review.decidedAt,
    approverRole: review.approverRole,
    approverPrincipal: review.approverPrincipal,
    decisions: review.decisions,
  });
}

export function getSearchQualitySignoffApprovalSha256(
  body: DecisionBody,
  signoff: Omit<ApprovedSignoff, "approvalSha256">,
  assignmentGraphSha256: string,
): string {
  return digest({
    schemaVersion: "1",
    canonicalization: body.canonicalization,
    packetVersion: body.packetVersion,
    assignmentGraphSha256,
    role: signoff.role,
    principal: signoff.principal,
    decisionRef: signoff.decisionRef,
    approvedAt: signoff.approvedAt,
    decisionBodySha256: signoff.decisionBodySha256,
  });
}

function inspectAssignments(
  body: DecisionBody,
  createdAt: number,
  now: number,
  findings: Finding[],
): AssignedPrincipal[] {
  const assigned: AssignedPrincipal[] = [];
  for (const item of body.authority.assignments) {
    if (item.status === "pending") {
      findings.push(finding("pending-role-assignment", `${item.role} is pending`));
      continue;
    }
    assigned.push(item);
    const assignedAt = new Date(item.assignedAt).getTime();
    if (assignedAt < createdAt) {
      findings.push(finding("assignment-before-packet", `${item.role} predates the packet`));
    }
    if (assignedAt > now) {
      findings.push(finding("future-role-assignment", `${item.role} is future dated`));
    }
  }
  return assigned;
}

function groupPrincipalOverlaps(assigned: readonly AssignedPrincipal[]) {
  const groups = new Map<
    string,
    { principal: ContentRef; roles: Array<(typeof SEARCH_QUALITY_AUTHORITY_ROLES)[number]> }
  >();
  for (const item of assigned) {
    const key = refKey(item.principal);
    const group = groups.get(key) ?? { principal: item.principal, roles: [] };
    group.roles.push(item.role);
    groups.set(key, group);
  }
  return new Map([...groups].filter(([, group]) => group.roles.length > 1));
}

function inspectOverlapReview(
  body: DecisionBody,
  review: OverlapReview,
  assigned: readonly AssignedPrincipal[],
  assignmentGraphSha256: string,
  createdAt: number,
  now: number,
  findings: Finding[],
): void {
  if (review.status === "pending") {
    findings.push(finding("pending-overlap-review", "global authority overlap review is pending"));
    return;
  }
  if (review.assignmentGraphSha256 !== assignmentGraphSha256) {
    findings.push(
      finding("overlap-graph-digest-mismatch", "overlap review does not bind this graph"),
    );
  }
  if (review.policyDecisionSha256 !== getSearchQualityPolicyDecisionSha256(body)) {
    findings.push(
      finding("overlap-policy-digest-mismatch", "overlap review does not bind policy decisions"),
    );
  }
  const approverAssignment = assigned.find((item) => item.role === review.approverRole);
  if (
    approverAssignment === undefined ||
    !sameRef(approverAssignment.principal, review.approverPrincipal)
  ) {
    findings.push(
      finding("overlap-approver-mismatch", "overlap approver is not assigned to its role"),
    );
  }
  const approvalBody = {
    status: review.status,
    policyDecisionSha256: review.policyDecisionSha256,
    assignmentGraphSha256: review.assignmentGraphSha256,
    decisionRef: review.decisionRef,
    decidedAt: review.decidedAt,
    approverRole: review.approverRole,
    approverPrincipal: review.approverPrincipal,
    decisions: review.decisions,
  };
  if (review.approvalSha256 !== getSearchQualityOverlapApprovalSha256(body, approvalBody)) {
    findings.push(finding("overlap-approval-digest-mismatch", "overlap approval is not bound"));
  }
  const decidedAt = new Date(review.decidedAt).getTime();
  const latestAssignment = Math.max(
    createdAt,
    ...assigned.map((item) => Date.parse(item.assignedAt)),
  );
  if (decidedAt < latestAssignment) {
    findings.push(finding("overlap-before-assignment", "overlap review predates an assignment"));
  }
  if (decidedAt > now) {
    findings.push(finding("future-overlap-review", "overlap review is future dated"));
  }

  const duplicateGroups = groupPrincipalOverlaps(assigned);
  const declared = new Map(review.decisions.map((item) => [refKey(item.principal), item]));
  if (declared.size !== review.decisions.length) {
    findings.push(finding("duplicate-overlap-decision", "overlap principal is declared twice"));
  }
  for (const [key, group] of duplicateGroups) {
    const current = declared.get(key);
    const exactRoleSet =
      current !== undefined &&
      current.roles.length === group.roles.length &&
      current.roles.every((role, index) => role === group.roles[index]);
    if (!exactRoleSet) {
      findings.push(
        finding("undeclared-principal-overlap", "principal role set lacks an exact decision"),
      );
    }
    if (sameRef(review.approverPrincipal, group.principal)) {
      findings.push(finding("self-approved-overlap", "overlap principal cannot self-approve"));
    }
  }
  for (const key of declared.keys()) {
    if (!duplicateGroups.has(key)) {
      findings.push(
        finding("unused-overlap-decision", "overlap decision does not match the current graph"),
      );
    }
  }
}

function inspectSignoffs(
  packet: SearchQualityDecisionPacket,
  assigned: readonly AssignedPrincipal[],
  bodySha256: string,
  createdAt: number,
  now: number,
  findings: Finding[],
): void {
  const assignmentsByRole = new Map(assigned.map((item) => [item.role, item]));
  const review = packet.decisionBody.authority.overlapReview;
  const overlapDecidedAt =
    review.status === "resolved" ? new Date(review.decidedAt).getTime() : createdAt;
  for (const item of packet.signoffs) {
    if (item.status === "pending") {
      findings.push(finding("pending-signoff", `${item.role} signoff is pending`));
      continue;
    }
    const assignmentForRole = assignmentsByRole.get(item.role);
    if (assignmentForRole === undefined || !sameRef(item.principal, assignmentForRole.principal)) {
      findings.push(finding("signoff-principal-mismatch", `${item.role} signoff is not assigned`));
    }
    if (item.decisionBodySha256 !== bodySha256) {
      findings.push(finding("signoff-body-digest-mismatch", `${item.role} signoff is stale`));
    }
    const approvalBody = {
      role: item.role,
      status: item.status,
      principal: item.principal,
      decisionRef: item.decisionRef,
      approvedAt: item.approvedAt,
      decisionBodySha256: item.decisionBodySha256,
    };
    if (
      item.approvalSha256 !==
      getSearchQualitySignoffApprovalSha256(
        packet.decisionBody,
        approvalBody,
        getSearchQualityAssignmentGraphSha256(packet.decisionBody),
      )
    ) {
      findings.push(finding("signoff-approval-digest-mismatch", `${item.role} signoff is unbound`));
    }
    const approvedAt = new Date(item.approvedAt).getTime();
    if (approvedAt < overlapDecidedAt) {
      findings.push(finding("signoff-before-overlap-review", `${item.role} signoff is too early`));
    }
    if (approvedAt > now) {
      findings.push(finding("future-signoff", `${item.role} signoff is future dated`));
    }
  }
}

export function inspectSearchQualityDecisionPacket(
  packet: SearchQualityDecisionPacket,
  now = new Date(),
) {
  if (Number.isNaN(now.getTime())) throw new Error("inspection time is invalid");
  const parsed = parseSearchQualityDecisionPacket(packet);
  const body = parsed.decisionBody;
  const findings: Finding[] = [];
  const bodySha256 = getSearchQualityDecisionBodySha256(body);
  const assignmentGraphSha256 = getSearchQualityAssignmentGraphSha256(body);
  const createdAt = new Date(body.createdAt).getTime();
  const nowMs = now.getTime();

  if (parsed.decisionBodySha256 !== bodySha256) {
    findings.push(finding("decision-body-digest-mismatch", "decision body digest does not match"));
  }
  if (createdAt > nowMs) {
    findings.push(finding("future-packet", "decision packet is future dated"));
  }
  if (body.lifecycle !== "approved") {
    findings.push(finding("packet-not-approved", "decision packet lifecycle is not approved"));
  }

  for (const item of body.decisions) {
    if (item.resolution.status === "pending") {
      findings.push(finding("pending-decision", `${item.key} is pending`));
    }
  }

  if (body.authority.principalRegistry.status === "pending") {
    findings.push(finding("pending-principal-registry", "principal registry is pending"));
  }
  if (body.authority.revocationBasis.status === "pending") {
    findings.push(finding("pending-revocation-basis", "principal revocation basis is pending"));
  }
  const assigned = inspectAssignments(body, createdAt, nowMs, findings);
  const overlapReview = body.authority.overlapReview;
  inspectOverlapReview(
    body,
    overlapReview,
    assigned,
    assignmentGraphSha256,
    createdAt,
    nowMs,
    findings,
  );
  inspectSignoffs(parsed, assigned, bodySha256, createdAt, nowMs, findings);

  const inactive = body.lifecycle === "superseded" || body.lifecycle === "rejected";
  return {
    schemaVersion: "1" as const,
    status: inactive
      ? ("inactive" as const)
      : findings.length === 0
        ? ("structurally-complete-unverified" as const)
        : ("pending" as const),
    decisionBodySha256: bodySha256,
    assignmentGraphSha256,
    findings,
    verification: {
      referencedContent: "unavailable" as const,
      principalRegistry: "unavailable" as const,
      approvals: "unavailable" as const,
    },
    authority: {
      execution: false,
      currentness: false,
      attestation: false,
      release: false,
    },
  };
}
