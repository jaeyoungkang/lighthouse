import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getSearchQualityAssignmentGraphSha256,
  getSearchQualityDecisionBodySha256,
  getSearchQualityOverlapApprovalSha256,
  getSearchQualityPolicyDecisionSha256,
  getSearchQualitySignoffApprovalSha256,
  inspectSearchQualityDecisionPacket,
  parseSearchQualityDecisionPacket,
  SEARCH_QUALITY_AUTHORITY_ROLES,
  SEARCH_QUALITY_DECISION_CANONICALIZATION,
  SEARCH_QUALITY_DECISION_KEYS,
  SEARCH_QUALITY_RESEARCH_BASIS,
  type SearchQualityDecisionPacket,
} from "../decision-packet";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const CREATED_AT = "2026-09-01T00:00:00.000Z";
const ASSIGNED_AT = "2026-09-01T01:00:00.000Z";
const OVERLAP_AT = "2026-09-01T02:00:00.000Z";
const APPROVED_AT = "2026-09-01T03:00:00.000Z";
const NOW = new Date("2026-09-02T00:00:00.000Z");
type AuthorityRole = (typeof SEARCH_QUALITY_AUTHORITY_ROLES)[number];

const ref = (label: string, sha256 = SHA_A) => ({
  id: `ref:${createHash("sha256").update(label).digest("hex").slice(0, 32)}`,
  version: "v1",
  sha256,
});
const principal = (role: string, sha256 = SHA_A) => ref(`principal:${role}`, sha256);
const roleSet = (...roles: AuthorityRole[]) => roles;

function completeBody(): SearchQualityDecisionPacket["decisionBody"] {
  const assignments = SEARCH_QUALITY_AUTHORITY_ROLES.map((role) => ({
    role,
    status: "assigned" as const,
    principal: principal(role),
    assignedAt: ASSIGNED_AT,
  }));
  const body: SearchQualityDecisionPacket["decisionBody"] = {
    packetId: "scholar-search-quality",
    packetVersion: "candidate-v1",
    canonicalization: SEARCH_QUALITY_DECISION_CANONICALIZATION,
    lifecycle: "approved" as const,
    createdAt: CREATED_AT,
    researchBasis: SEARCH_QUALITY_RESEARCH_BASIS,
    decisions: SEARCH_QUALITY_DECISION_KEYS.map((key) => ({
      key,
      resolution: { status: "resolved" as const, content: ref(`decision:${key}`) },
    })),
    authority: {
      principalRegistry: {
        status: "resolved",
        content: ref("registry:principals", SHA_B),
      },
      revocationBasis: {
        status: "resolved",
        content: ref("registry:revocations", SHA_C),
      },
      assignments,
      overlapReview: { status: "pending" },
    },
  };
  const approverRole = "operational-readiness-owner" as const;
  const approver = assignments.find((item) => item.role === approverRole);
  if (approver === undefined) throw new Error("missing overlap approver assignment");
  const overlapApproval = {
    status: "resolved" as const,
    policyDecisionSha256: getSearchQualityPolicyDecisionSha256(body),
    assignmentGraphSha256: getSearchQualityAssignmentGraphSha256(body),
    decisionRef: ref("decision:global-authority-overlap", SHA_B),
    decidedAt: OVERLAP_AT,
    approverRole,
    approverPrincipal: approver.principal,
    decisions: [],
  };
  body.authority.overlapReview = {
    ...overlapApproval,
    approvalSha256: getSearchQualityOverlapApprovalSha256(body, overlapApproval),
  };
  return body;
}

function packetForBody(
  body: SearchQualityDecisionPacket["decisionBody"],
): SearchQualityDecisionPacket {
  const decisionBodySha256 = getSearchQualityDecisionBodySha256(body);
  const assignmentGraphSha256 = getSearchQualityAssignmentGraphSha256(body);
  const assignments = new Map(
    body.authority.assignments.flatMap((assignment) =>
      assignment.status === "assigned" ? [[assignment.role, assignment.principal] as const] : [],
    ),
  );
  return parseSearchQualityDecisionPacket({
    schemaVersion: "1",
    decisionBody: body,
    decisionBodySha256,
    signoffs: SEARCH_QUALITY_AUTHORITY_ROLES.slice(0, 4).map((role) => {
      const assignedPrincipal = assignments.get(role);
      if (assignedPrincipal === undefined) throw new Error(`missing assignment for ${role}`);
      const approval = {
        role,
        status: "approved" as const,
        principal: assignedPrincipal,
        decisionRef: ref(`approval:${role}`, SHA_C),
        approvedAt: APPROVED_AT,
        decisionBodySha256,
      };
      return {
        ...approval,
        approvalSha256: getSearchQualitySignoffApprovalSha256(
          body,
          approval,
          assignmentGraphSha256,
        ),
      };
    }),
  });
}

function packetWithOverlap(roles: AuthorityRole[]) {
  const body = completeBody();
  const shared = ref("principal:shared", SHA_C);
  body.authority.assignments = body.authority.assignments.map((assignment) =>
    roles.includes(assignment.role) ? { ...assignment, principal: shared } : assignment,
  );
  const overlapReview = body.authority.overlapReview;
  if (overlapReview.status !== "resolved") throw new Error("expected resolved overlap review");
  const approverAssignment = body.authority.assignments.find(
    (item) => item.role === overlapReview.approverRole,
  );
  if (approverAssignment?.status !== "assigned") throw new Error("missing overlap approver");
  body.authority.overlapReview = {
    ...overlapReview,
    assignmentGraphSha256: getSearchQualityAssignmentGraphSha256(body),
    approverPrincipal: approverAssignment.principal,
    decisions: [{ principal: shared, roles }],
    approvalSha256: SHA_A,
  };
  const updatedReview = body.authority.overlapReview;
  const approvalBody = {
    status: updatedReview.status,
    policyDecisionSha256: updatedReview.policyDecisionSha256,
    assignmentGraphSha256: updatedReview.assignmentGraphSha256,
    decisionRef: updatedReview.decisionRef,
    decidedAt: updatedReview.decidedAt,
    approverRole: updatedReview.approverRole,
    approverPrincipal: updatedReview.approverPrincipal,
    decisions: updatedReview.decisions,
  };
  body.authority.overlapReview.approvalSha256 = getSearchQualityOverlapApprovalSha256(
    body,
    approvalBody,
  );
  return packetForBody(body);
}

describe("search-quality pre-approval decision packet", () => {
  it("accepts a structurally complete candidate without granting runtime authority", () => {
    const packet = packetForBody(completeBody());
    const result = inspectSearchQualityDecisionPacket(packet, NOW);

    expect(result).toMatchObject({
      status: "structurally-complete-unverified",
      findings: [],
      verification: {
        referencedContent: "unavailable",
        principalRegistry: "unavailable",
        approvals: "unavailable",
      },
      authority: { execution: false, currentness: false, attestation: false, release: false },
    });
    expect(JSON.stringify(result)).not.toContain("principal:");
  });

  it("keeps missing decisions, assignments, overlap review, and signoffs pending", () => {
    const complete = packetForBody(completeBody());
    const decisionBody = {
      ...complete.decisionBody,
      lifecycle: "approval-pending" as const,
      decisions: complete.decisionBody.decisions.map((item, index) =>
        index === 0 ? { key: item.key, resolution: { status: "pending" as const } } : item,
      ),
      authority: {
        ...complete.decisionBody.authority,
        principalRegistry: { status: "pending" as const },
        revocationBasis: { status: "pending" as const },
        assignments: complete.decisionBody.authority.assignments.map((item, index) =>
          index === 0 ? { role: item.role, status: "pending" as const } : item,
        ),
        overlapReview: { status: "pending" as const },
      },
    };
    const decisionBodySha256 = getSearchQualityDecisionBodySha256(decisionBody);
    const packet = parseSearchQualityDecisionPacket({
      schemaVersion: "1",
      decisionBody,
      decisionBodySha256,
      signoffs: complete.signoffs.map((item, index) =>
        index === 0 ? { role: item.role, status: "pending" } : { ...item, decisionBodySha256 },
      ),
    });

    expect(
      inspectSearchQualityDecisionPacket(packet, NOW).findings.map((item) => item.code),
    ).toEqual(
      expect.arrayContaining([
        "packet-not-approved",
        "pending-decision",
        "pending-principal-registry",
        "pending-revocation-basis",
        "pending-role-assignment",
        "pending-overlap-review",
        "pending-signoff",
      ]),
    );
  });

  it("requires one exact global decision for the principal's complete role set", () => {
    const roles = ["human-product-owner", "pause-owner"] as const;
    const valid = packetWithOverlap([...roles]);
    expect(inspectSearchQualityDecisionPacket(valid, NOW).status).toBe(
      "structurally-complete-unverified",
    );

    const missingBody = { ...valid.decisionBody, authority: { ...valid.decisionBody.authority } };
    const validOverlap = valid.decisionBody.authority.overlapReview;
    if (validOverlap.status !== "resolved") throw new Error("expected resolved overlap review");
    missingBody.authority.overlapReview = {
      ...validOverlap,
      decisions: [],
    };
    const missing = packetForBody(missingBody);
    expect(inspectSearchQualityDecisionPacket(missing, NOW).findings).toContainEqual(
      expect.objectContaining({ code: "undeclared-principal-overlap" }),
    );

    const threeRole = packetWithOverlap(["human-product-owner", "pause-owner", "rollback-owner"]);
    const partialBody = {
      ...threeRole.decisionBody,
      authority: {
        ...threeRole.decisionBody.authority,
        overlapReview: {
          ...threeRole.decisionBody.authority.overlapReview,
          decisions: [
            {
              principal: ref("principal:shared", SHA_C),
              roles: roleSet("human-product-owner", "pause-owner"),
            },
          ],
        },
      },
    };
    const partial = packetForBody(partialBody);
    expect(inspectSearchQualityDecisionPacket(partial, NOW).findings).toContainEqual(
      expect.objectContaining({ code: "undeclared-principal-overlap" }),
    );
  });

  it("rejects unused, stale, and self-approved overlap decisions", () => {
    const packet = packetWithOverlap(["operational-readiness-owner", "resume-owner"]);
    const overlap = packet.decisionBody.authority.overlapReview;
    if (overlap.status !== "resolved") throw new Error("expected resolved overlap review");
    const body = {
      ...packet.decisionBody,
      authority: {
        ...packet.decisionBody.authority,
        overlapReview: {
          ...overlap,
          assignmentGraphSha256: SHA_B,
          approverRole: "operational-readiness-owner" as const,
          approverPrincipal: ref("principal:shared", SHA_C),
          decisions: [
            ...overlap.decisions,
            {
              principal: ref("principal:unused", SHA_B),
              roles: roleSet("pause-owner", "rollback-owner"),
            },
          ],
        },
      },
    };
    const result = inspectSearchQualityDecisionPacket(packetForBody(body), NOW);
    expect(result.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "overlap-graph-digest-mismatch",
        "self-approved-overlap",
        "unused-overlap-decision",
      ]),
    );
  });

  it("binds every signoff to the current body, assigned principal, and chronology", () => {
    const packet = packetForBody(completeBody());
    const changed = parseSearchQualityDecisionPacket({
      ...packet,
      decisionBodySha256: SHA_B,
      signoffs: packet.signoffs.map((item, index) =>
        index === 0
          ? {
              ...item,
              principal: ref("principal:wrong", SHA_B),
              approvedAt: "2026-08-31T00:00:00.000Z",
              decisionBodySha256: SHA_B,
            }
          : index === 1
            ? { ...item, approvedAt: "2026-09-03T00:00:00.000Z" }
            : item,
      ),
    });
    const codes = inspectSearchQualityDecisionPacket(changed, NOW).findings.map(
      (item) => item.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "decision-body-digest-mismatch",
        "signoff-principal-mismatch",
        "signoff-body-digest-mismatch",
        "signoff-approval-digest-mismatch",
        "signoff-before-overlap-review",
        "future-signoff",
      ]),
    );
  });

  it("rejects an unassigned overlap approver and a mutated signoff decision reference", () => {
    const body = completeBody();
    const review = body.authority.overlapReview;
    if (review.status !== "resolved") throw new Error("expected resolved overlap review");
    const approvalBody = {
      status: review.status,
      policyDecisionSha256: review.policyDecisionSha256,
      assignmentGraphSha256: review.assignmentGraphSha256,
      decisionRef: review.decisionRef,
      decidedAt: review.decidedAt,
      approverRole: review.approverRole,
      approverPrincipal: ref("principal:unassigned", SHA_B),
      decisions: review.decisions,
    };
    body.authority.overlapReview = {
      ...approvalBody,
      approvalSha256: getSearchQualityOverlapApprovalSha256(body, approvalBody),
    };
    const packet = packetForBody(body);
    expect(inspectSearchQualityDecisionPacket(packet, NOW).findings).toContainEqual(
      expect.objectContaining({ code: "overlap-approver-mismatch" }),
    );

    const mutatedSignoff = parseSearchQualityDecisionPacket({
      ...packetForBody(completeBody()),
      signoffs: packetForBody(completeBody()).signoffs.map((item, index) =>
        index === 0 ? { ...item, decisionRef: ref("approval:attacker", SHA_B) } : item,
      ),
    });
    expect(inspectSearchQualityDecisionPacket(mutatedSignoff, NOW).findings).toContainEqual(
      expect.objectContaining({ code: "signoff-approval-digest-mismatch" }),
    );
  });

  it("prevents overlap approval replay after packet metadata changes", () => {
    const packet = packetForBody(completeBody());
    const changedBody = {
      ...packet.decisionBody,
      lifecycle: "superseded" as const,
      createdAt: "2026-08-31T23:00:00.000Z",
    };

    expect(
      inspectSearchQualityDecisionPacket(packetForBody(changedBody), NOW).findings,
    ).toContainEqual(expect.objectContaining({ code: "overlap-approval-digest-mismatch" }));
  });

  it("rejects missing, reordered, or implementation-shaped policy slots", () => {
    const packet = packetForBody(completeBody());
    expect(() =>
      parseSearchQualityDecisionPacket({
        ...packet,
        decisionBody: {
          ...packet.decisionBody,
          decisions: packet.decisionBody.decisions.slice(1),
        },
      }),
    ).toThrow();
    expect(() =>
      parseSearchQualityDecisionPacket({
        ...packet,
        decisionBody: {
          ...packet.decisionBody,
          researchBasis: { ...packet.decisionBody.researchBasis, revision: "a".repeat(40) },
        },
      }),
    ).toThrow();
    expect(() =>
      parseSearchQualityDecisionPacket({
        ...packet,
        decisionBody: {
          ...packet.decisionBody,
          decisions: packet.decisionBody.decisions.map((item, index) =>
            index === 0 && item.resolution.status === "resolved"
              ? {
                  ...item,
                  resolution: {
                    ...item.resolution,
                    content: { ...item.resolution.content, id: "someone@example.com" },
                  },
                }
              : item,
          ),
        },
      }),
    ).toThrow();
    expect(() =>
      parseSearchQualityDecisionPacket({
        ...packet,
        decisionBody: {
          ...packet.decisionBody,
          decisions: [...packet.decisionBody.decisions].reverse(),
        },
      }),
    ).toThrow("decision slots must use the exact canonical order");
    expect(() =>
      parseSearchQualityDecisionPacket({
        ...packet,
        decisionBody: { ...packet.decisionBody, threshold: 0.9 },
      }),
    ).toThrow();
    expect(() =>
      parseSearchQualityDecisionPacket({
        ...packet,
        decisionBody: {
          ...packet.decisionBody,
          authority: { ...packet.decisionBody.authority, allowPrincipalOverlap: true },
        },
      }),
    ).toThrow();
  });

  it("makes digesting independent of caller object-key order", () => {
    const body = completeBody();
    const reordered = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    const entries = Object.entries(reordered).reverse();
    expect(getSearchQualityDecisionBodySha256(Object.fromEntries(entries) as typeof body)).toBe(
      getSearchQualityDecisionBodySha256(body),
    );

    const nested = structuredClone(body);
    const first = nested.authority.assignments[0];
    if (first.status !== "assigned") throw new Error("expected assigned principal");
    first.principal = Object.fromEntries(
      Object.entries(first.principal).reverse(),
    ) as typeof first.principal;
    expect(getSearchQualityDecisionBodySha256(nested)).toBe(
      getSearchQualityDecisionBodySha256(body),
    );
  });
});
