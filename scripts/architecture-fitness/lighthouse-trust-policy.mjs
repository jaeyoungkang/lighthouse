export const LIGHTHOUSE_ATTESTATION_MODE = "unsigned-local";
export const LIGHTHOUSE_AUTHORITATIVE_REPOSITORY = "corca-ai/lighthouse";
export const LIGHTHOUSE_AUTHORITATIVE_REBIND_EVENT = "workflow_dispatch";
export const LIGHTHOUSE_AUTHORITATIVE_BASE_REF = "refs/heads/main";
export const LIGHTHOUSE_AUTHORITATIVE_WORKFLOW_REF =
  "corca-ai/lighthouse/.github/workflows/architecture-fitness-attestation.yml@refs/heads/main";
export const LIGHTHOUSE_AUTHORITATIVE_ATTESTOR_REF =
  "github-actions:corca-ai/lighthouse:architecture-fitness-attestation@v1";
export const LIGHTHOUSE_ATTESTATION_KEY_REF = "env:ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ACTOR_PATTERN = /^[A-Za-z0-9_.-]+(?:\[bot\])?$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;

export function resolveAttestationMode(_environment = process.env) {
  void _environment;
  return LIGHTHOUSE_ATTESTATION_MODE;
}

export function assertLighthouseCollectorAuthority(authority) {
  if (authority?.attestorRef !== LIGHTHOUSE_AUTHORITATIVE_ATTESTOR_REF) {
    throw new Error(`Unexpected Lighthouse authoritative attestor: ${authority?.attestorRef}`);
  }
  if (authority?.attestationKeyRef !== LIGHTHOUSE_ATTESTATION_KEY_REF) {
    throw new Error(`Unexpected Lighthouse attestation key ref: ${authority?.attestationKeyRef}`);
  }
}

export function unsignedEvaluationEnvironment(environment = process.env) {
  const keyName = LIGHTHOUSE_ATTESTATION_KEY_REF.slice("env:".length);
  const { [keyName]: removedKey, ...result } = environment;
  void removedKey;
  return result;
}

export function assertLighthouseAssessmentAuthority(assessment) {
  if (assessment?.collectorAttestation?.status !== "unverified") {
    throw new Error(
      "The local Lighthouse advisory accepts only unverified assessments; verified assessments must pass the protected bundle verifier",
    );
  }
}

function assertValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function authoritativeCollectorRunRef(invocation, subject, revision) {
  assertValue(subject === "base" || subject === "target", `Unsupported subject: ${subject}`);
  assertValue(SHA_PATTERN.test(revision), `Invalid ${subject} revision`);
  return `github-actions:${invocation.repository}:${invocation.runId}:${invocation.runAttempt}:${subject}:${revision}`;
}

export function assertAuthoritativeInvocation(invocation) {
  assertValue(
    invocation?.repository === LIGHTHOUSE_AUTHORITATIVE_REPOSITORY,
    `Authoritative repository must equal ${LIGHTHOUSE_AUTHORITATIVE_REPOSITORY}`,
  );
  assertValue(
    invocation?.event === LIGHTHOUSE_AUTHORITATIVE_REBIND_EVENT,
    `Authoritative event must equal ${LIGHTHOUSE_AUTHORITATIVE_REBIND_EVENT}`,
  );
  assertValue(
    invocation?.workflowRef === LIGHTHOUSE_AUTHORITATIVE_WORKFLOW_REF,
    `Authoritative workflow ref must equal ${LIGHTHOUSE_AUTHORITATIVE_WORKFLOW_REF}`,
  );
  assertValue(
    invocation?.baseRef === LIGHTHOUSE_AUTHORITATIVE_BASE_REF,
    `Authoritative base ref must equal ${LIGHTHOUSE_AUTHORITATIVE_BASE_REF}`,
  );
  assertValue(SHA_PATTERN.test(invocation?.workflowSha ?? ""), "Invalid workflow SHA");
  assertValue(SHA_PATTERN.test(invocation?.baseRevision ?? ""), "Invalid base revision");
  assertValue(SHA_PATTERN.test(invocation?.targetRevision ?? ""), "Invalid target revision");
  assertValue(
    invocation.targetRevision !== invocation.baseRevision,
    "Target revision must differ from the base revision",
  );
  assertValue(
    invocation?.targetRepository === LIGHTHOUSE_AUTHORITATIVE_REPOSITORY,
    `Authoritative target repository must equal ${LIGHTHOUSE_AUTHORITATIVE_REPOSITORY}`,
  );
  assertValue(ACTOR_PATTERN.test(invocation?.actor ?? ""), "Invalid workflow actor");
  assertValue(
    invocation.workflowSha === invocation.targetRevision,
    "Trusted workflow SHA must equal the protected main target revision",
  );
  assertValue(
    String(invocation?.pullRequestNumber ?? "") === "0",
    "Protected main rebind must not claim a pull request number",
  );
  assertValue(
    POSITIVE_INTEGER_PATTERN.test(String(invocation?.runId ?? "")),
    "Invalid workflow run id",
  );
  assertValue(
    POSITIVE_INTEGER_PATTERN.test(String(invocation?.runAttempt ?? "")),
    "Invalid workflow run attempt",
  );
  assertValue(
    POSITIVE_INTEGER_PATTERN.test(String(invocation?.rawArtifactId ?? "")),
    "Invalid raw artifact id",
  );
  assertValue(
    SHA256_PATTERN.test(invocation?.rawArtifactDigest ?? ""),
    "Invalid raw artifact digest",
  );
  return invocation;
}

export function resolveAuthoritativeAttestationKey(environment = process.env) {
  const keyName = LIGHTHOUSE_ATTESTATION_KEY_REF.slice("env:".length);
  const key = environment[keyName];
  if (typeof key !== "string" || Buffer.byteLength(key, "utf8") < 32) {
    throw new Error(`Protected attestation key ${keyName} is missing or shorter than 32 bytes`);
  }
  return key;
}

export function assertVerifiedLighthouseAssessment(assessment, expected) {
  if (assessment?.collectorAttestation?.status !== "verified") {
    throw new Error("Authoritative assessment collector attestation is not verified");
  }
  if (assessment?.revision !== expected.revision) {
    throw new Error("Authoritative assessment revision does not match the invocation");
  }
  if (assessment?.collectionRunRef !== expected.runRef) {
    throw new Error("Authoritative assessment run ref does not match the invocation");
  }
}
