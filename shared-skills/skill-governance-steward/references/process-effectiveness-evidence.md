# Process-effectiveness evidence

Use this block only when the Human or current `skill-governance-steward` process
session selects a workstream before implementation. Append it to that
workstream's existing durable issue or PR and update the same block. It is audit
evidence, not a merge checklist, review verdict, or new source of implementation
truth.

Before implementation, create a separate selection comment whose initial text
contains `workstream_root`, `sample_class`, `selected_at`, `selected_by`, the
sampling-frame candidates and inclusion rule, `selection_basis`, and the exact
eligibility evidence. Do not edit that comment. `selection_ref` points to it;
`sampling_frame_ref` and `eligibility_ref` must be exact commits or other
unedited comments, never mutable issue/PR bodies. At audit time, compare all
three refs' content and edit history with the first implementation commit or
measured authoring start. If the ordering or original content cannot be proved,
retain the sample with `selection_status: ineligible`; never backfill it into
the prospective cohort. `retrospective-dry` is also ineligible.

```yaml
process_effectiveness_evidence:
  version: 1
  workstream_root: "repo:owner/name#issue:NNN"
  sample_class: "multi-owner | ordinary-no-skill"
  selection_status: "eligible | ineligible | retrospective-dry"
  selected_at: "YYYY-MM-DDTHH:MM:SSZ | unknown"
  selected_by: "human:<identity> | skill-governance-steward-session:<identity>"
  selection_ref: "<unedited selection comment URL>"
  sampling_frame_ref: "<durable cohort candidate list and inclusion rule>"
  selection_basis: "<outcome-independent reason this candidate was selected>"
  eligibility_ref: "<planned scope and First-Route evidence available before implementation>"
  completion_status: "active | completed | abandoned | cancelled"
  authoring:
    status: "measured | measured-zero | unknown | not-applicable"
    completeness: "complete | partial | unknown"
    capture_window:
      start: "YYYY-MM-DDTHH:MM:SSZ | unknown"
      end: "YYYY-MM-DDTHH:MM:SSZ | unknown"
    active_segments:
      - start: "YYYY-MM-DDTHH:MM:SSZ"
        end: "YYYY-MM-DDTHH:MM:SSZ"
        owner: "<implementation owner>"
        evidence_ref: "<timer or session evidence>"
    unknown_reason: "none | not-instrumented | interrupted-history | <short reason>"
  machine_runs:
    status: "measured | measured-zero | unknown | not-applicable"
    completeness: "complete | partial | unknown"
    capture_window:
      start: "YYYY-MM-DDTHH:MM:SSZ | unknown"
      end: "YYYY-MM-DDTHH:MM:SSZ | unknown"
    items:
      - run_ref: "<stable local run ref or CI run id>"
        command: "<exact command or CI job name>"
        start: "YYYY-MM-DDTHH:MM:SSZ | unknown"
        end: "YYYY-MM-DDTHH:MM:SSZ | unknown"
        wall_seconds: "<measured nonnegative number | unknown>"
        parallel_group: "none | <stable group id>"
        outcome: "pass | fail | interrupted | cancelled | unknown"
        owner: "<execution owner>"
    unknown_reason: "none | not-instrumented | <short reason>"
  findings:
    status: "measured | measured-zero | unknown | not-applicable"
    completeness: "complete | partial | unknown"
    capture_window:
      start: "YYYY-MM-DDTHH:MM:SSZ | unknown"
      end: "YYYY-MM-DDTHH:MM:SSZ | unknown"
    items:
      - finding_id: "<stable causal finding id>"
        duplicate_of: "none | <canonical finding id>"
        finding_kind: "route-miss | propagation-miss | correctness | evidence-depth | record-binding"
        detection_phase: "early-scope | implementation | exact-head | ci | post-merge"
        classification_at_detection: "valid | invalid | duplicate | needs-human"
        disposition_at_sample_close: "valid | invalid | already-fixed | duplicate | needs-human"
        review_owner: "<review owner>"
        causal_owner: "<workflow or implementation owner>"
        hypothesis: "<short claim reviewed>"
        observed_route: "not-applicable | <route actually selected>"
        expected_route: "not-applicable | <route that should have been selected>"
        affected_pr: "repo:owner/name#pr:NNN | not-applicable"
        affected_head: "<full content SHA | not-applicable>"
        detection_ref: "<immutable comment, commit, test, or review ref | unknown>"
        review_record_ref: "<workstream-root + head + design-cycle + iteration + role>"
        rework_ref: "none | <material correction commit or diff ref>"
        rejection_evidence: "none | <required when detection classification is invalid>"
    unknown_reason: "none | not-instrumented | <short reason>"
  workflow_overlap:
    status: "measured | measured-zero | unknown | not-applicable"
    completeness: "complete | partial | unknown"
    capture_window:
      start: "YYYY-MM-DDTHH:MM:SSZ | unknown"
      end: "YYYY-MM-DDTHH:MM:SSZ | unknown"
    items:
      - overlap_id: "<stable overlap id>"
        overlap_kind: "required-propagation | repeated-authoring | repeated-command"
        workflows: ["cair", "story-chain", "runtime-flow", "architecture-fitness"]
        repeated_subject: "<same decision, prose, or heavy command>"
        owner: "<implementation owner for authoring | execution owner for commands>"
        segments:
          - start: "YYYY-MM-DDTHH:MM:SSZ | unknown"
            end: "YYYY-MM-DDTHH:MM:SSZ | unknown"
            evidence_ref: "<session, diff, or run ref>"
        elapsed_seconds: "<measured nonnegative number | unknown>"
    unknown_reason: "none | not-instrumented | <short reason>"
```

Rules:

- `ordinary-no-skill` means the implementation's specialist domain/workflow
  First Route was `null`, matching the routing corpus negative-control meaning.
  Common lifecycle or support use such as Project Knowledge, GitHub, and
  exact-head review does not change that class. This is a Human/process-owner
  classification, not a revived path classifier.
- Every collection declares its observation status, completeness, and capture
  window. `measured` means every in-scope item and required metric is complete
  for that window; `measured-zero` means complete observation found zero items;
  `unknown` may preserve known partial items but they are not a complete count
  or duration denominator; `not-applicable` means the metric does not apply and
  the list is empty. Empty lists never imply zero without `measured-zero`.
- Active authoring records only intervals spent producing or correcting the
  implementation. Human wait, interruption, machine wait, reviewer execution,
  and handoff are outside those segments. Merge overlapping authoring segments
  by time union; do not sum concurrent segments.
- Measure a local run from the host result or an exact timer such as
  `/usr/bin/time -p`; do not estimate from recollection. For parallel runs,
  report each run and the union of their intervals or the enclosing CI run wall
  time. Never sum parallel job durations as elapsed wall time.
- `finding_kind` names the cause and `detection_phase` names when it was found;
  they are orthogonal. Detection classification and final disposition are also
  separate. The block supplements, and never replaces, the exact review record.
- Use one item per unique causal defect. Reviewer confirmations point to the
  same `finding_id`; a genuine duplicate names `duplicate_of`. Every `invalid`
  detection includes its rejected `hypothesis` and `rejection_evidence`.
- A qualifying route miss names observed/expected routes, material
  `rework_ref`, canonical `affected_pr`, and exact `affected_head`. Audits count
  unique causal occurrences and affected distinct PR ids separately.
- Workflow overlap distinguishes required propagation from avoidable repeated
  authoring or commands. Compute each item's elapsed time from the union of its
  segments. Report raw items and a time union for any cross-item total; do not
  sum concurrent intervals or present required propagation as waste.
- `selected_at: unknown` is allowed only for `ineligible` or
  `retrospective-dry` entries. Eligible prospective entries require the exact
  timestamp and actual selector identity.
- The sampling frame retains every preselected workstream, including cancelled
  and abandoned work. Selection status can become ineligible but the entry is
  not deleted. This prevents completion- and outcome-only sampling.
- The block does not replace CAIR, Story Chain, runtime-flow, Architecture
  Fitness, Project Knowledge, or review records. Missing evidence is allowed;
  no quality gate reads this block or derives merge eligibility or process
  success from it.
- The owning skill's bounded decision protocol uses two prospective
  `ordinary-no-skill` samples and two differently shaped prospective
  `multi-owner` samples. One tie-breaker is allowed only when those four do not
  support a decision. The block records each sample; it does not calculate or
  publish the Human verdict.

## Dry examples

These retrospective examples exercise the shape against real workstream types.
They were not selected before implementation and are not admissible cohort
evidence.

### Multi-owner workstream

```yaml
process_effectiveness_evidence:
  version: 1
  workstream_root: "repo:jaeyoungkang/lighthouse#issue:414"
  sample_class: "multi-owner"
  selection_status: "retrospective-dry"
  selected_at: "unknown"
  selected_by: "skill-governance-steward-session:retrospective-replay"
  selection_ref: "retrospective-dry-replay"
  sampling_frame_ref: "retrospective-dry-replay"
  selection_basis: "schema replay across the known multi-owner sample type"
  eligibility_ref: "retrospective-dry-replay"
  completion_status: "completed"
  authoring:
    status: "unknown"
    completeness: "unknown"
    capture_window:
      start: "unknown"
      end: "unknown"
    active_segments: []
    unknown_reason: "retrospective-dry-replay"
  machine_runs:
    status: "unknown"
    completeness: "partial"
    capture_window:
      start: "2026-08-12T05:49:26Z"
      end: "2026-08-12T05:58:08Z"
    items:
      - run_ref: "github-actions:31567819639"
        command: "Quality"
        start: "2026-08-12T05:49:26Z"
        end: "2026-08-12T05:58:08Z"
        wall_seconds: 522
        parallel_group: "github-actions:31567819639"
        outcome: "pass"
        owner: "github-actions"
    unknown_reason: "one of five known Quality runs shown for schema replay"
  findings:
    status: "unknown"
    completeness: "partial"
    capture_window:
      start: "unknown"
      end: "2026-08-12T14:48:00Z"
    items:
      - finding_id: "issue-414-route-duration"
        duplicate_of: "none"
        finding_kind: "correctness"
        detection_phase: "exact-head"
        classification_at_detection: "valid"
        disposition_at_sample_close: "already-fixed"
        review_owner: "architecture-reviewer"
        causal_owner: "runtime-flow"
        hypothesis: "retry command lifetime can outlast its route envelope"
        observed_route: "not-applicable"
        expected_route: "not-applicable"
        affected_pr: "repo:jaeyoungkang/lighthouse#pr:623"
        affected_head: "2e140a4159dd331384c414eac9b209ea12501f80"
        detection_ref: "unknown"
        review_record_ref: "root=repo:jaeyoungkang/lighthouse#issue:414;head=4961008eacdb5da855e422e01a3f67377b123290;cycle=1;iteration=4;role=independent-review-panel/gap-enrichment-retry"
        rework_ref: "commit:dc867a36dde345b6efa9422061e0ad5e93afa5a8"
        rejection_evidence: "none"
    unknown_reason: "one of ten already-fixed defects shown; original detection record is not durable"
  workflow_overlap:
    status: "unknown"
    completeness: "unknown"
    capture_window:
      start: "unknown"
      end: "unknown"
    items: []
    unknown_reason: "retrospective-dry-replay"
```

### Ordinary/no-skill workstream

```yaml
process_effectiveness_evidence:
  version: 1
  workstream_root: "repo:jaeyoungkang/lighthouse#issue:605"
  sample_class: "ordinary-no-skill"
  selection_status: "retrospective-dry"
  selected_at: "unknown"
  selected_by: "skill-governance-steward-session:retrospective-replay"
  selection_ref: "retrospective-dry-replay"
  sampling_frame_ref: "retrospective-dry-replay"
  selection_basis: "schema replay across the routing negative-control sample type"
  eligibility_ref: "retrospective-dry-replay"
  completion_status: "completed"
  authoring:
    status: "unknown"
    completeness: "unknown"
    capture_window:
      start: "unknown"
      end: "unknown"
    active_segments: []
    unknown_reason: "retrospective-dry-replay"
  machine_runs:
    status: "unknown"
    completeness: "partial"
    capture_window:
      start: "unknown"
      end: "unknown"
    items:
      - run_ref: "review-record:issue-605-search-view-test-support"
        command: "npx vitest run app/components/research-route-renderers/__tests__/SearchView.citation-lineage.test.tsx app/components/research-route-renderers/__tests__/SearchView.library-action.test.tsx app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx"
        start: "unknown"
        end: "unknown"
        wall_seconds: "unknown"
        parallel_group: "none"
        outcome: "pass"
        owner: "reviewer"
    unknown_reason: "retrospective timing not instrumented"
  findings:
    status: "unknown"
    completeness: "partial"
    capture_window:
      start: "unknown"
      end: "2026-08-10T16:54:00Z"
    items:
      - finding_id: "issue-605-domain-fixture-inputs"
        duplicate_of: "none"
        finding_kind: "correctness"
        detection_phase: "exact-head"
        classification_at_detection: "valid"
        disposition_at_sample_close: "already-fixed"
        review_owner: "reviewer"
        causal_owner: "test-support"
        hypothesis: "domain fixture helpers receive the production input shape"
        observed_route: "ordinary implementation"
        expected_route: "ordinary implementation"
        affected_pr: "repo:jaeyoungkang/lighthouse#pr:608"
        affected_head: "not-applicable"
        detection_ref: "unknown"
        review_record_ref: "root=repo:jaeyoungkang/lighthouse#issue:605;head=51e7e5fbddfc43f3eefea8a205cfe00a85354a36;cycle=1;iteration=2;role=exact-head/search-view-test-support"
        rework_ref: "commit:51e7e5fbddfc43f3eefea8a205cfe00a85354a36"
        rejection_evidence: "none"
    unknown_reason: "final review records one already-fixed defect but not its immutable pre-fix detection state"
  workflow_overlap:
    status: "unknown"
    completeness: "unknown"
    capture_window:
      start: "unknown"
      end: "unknown"
    items: []
    unknown_reason: "retrospective overlap timing not instrumented"
```
