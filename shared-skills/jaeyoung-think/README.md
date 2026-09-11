# jaeyoung-think

> Borrow the cognitive style of AI Product Producer 강재영(Jaeyoung) when a
> product-level choice is required.

This Agent Skill helps Claude Code, Codex, and people discuss product direction,
user-facing behavior, product policy, AI product autonomy and relationship
design, positioning, product scope, and product-level prioritization.

It does not make technical implementation decisions. Architecture, data flow,
DB access, repository boundaries, runtime or cache placement, refactoring,
debugging, API design, and quality gates belong to their owning engineering
workflows.

## Modes

### Mode A — Agent product-decision trace

An agent loads the skill when a human wants to form a scoped product choice or
explicitly reopens an existing product decision. The output is a proposal with
pending human approval. It names the product dimension, evidence, rejected
option, retained human authority, and validation signal. Nothing propagates
until the human explicitly approves it.

### Mode B — Product discussion

A person discusses a product choice with an agent borrowing Jaeyoung's cognitive
style. The conversation surfaces assumptions, product tradeoffs, rejected
options, and the user behavior that would validate the choice. It is not
counseling or technical consulting.

## Boundary

Use this skill for:

- product direction and product-principle application;
- user-facing behavior and product policy;
- AI autonomy, promises, relationship, and memory;
- positioning and staged product adoption;
- product scope and product-level priority;
- user workflow and interaction-model choices.

Do not use it for:

- architecture, data flow, DB, repository, runtime, provider, or cache choices;
- code structure, refactoring, debugging, naming, directories, or API design;
- test strategy, CI, validation gates, or engineering-process governance;
- locating or explaining an existing decision.

Existing decisions must be retrieved from Project Knowledge, canonical docs,
repository history, or issue and PR history. Technical decisions must be routed
to the relevant engineering workflow. Raw feedback and unclear product ideas go
through product discovery before this skill is used.

## Repository distribution

In Light House, this skill is sourced from `shared-skills/jaeyoung-think/`.
Package installation recreates the ignored Codex and Claude Code runtime copies
through the repository skill-sync owner. Do not install or edit a separate
user-level copy from this directory.

Host invocation after the repository dependencies are installed:

```text
Claude Code: /jaeyoung-think
Codex:       $jaeyoung-think
```

## Examples

Claude Code product-direction discussion:

```text
/jaeyoung-think "Should this research assistant answer on behalf of the user, or help the user compare evidence and decide?"
```

Codex AI autonomy discussion:

```text
$jaeyoung-think Should this action run automatically, be suggested, or require an explicit user choice?
```

Product-scope trace:

```text
/jaeyoung-think "Decide whether persistent memory belongs in the first product promise or a later stage."
```

Technical requests should not activate this skill:

```text
"Choose between a live DB read and a cache on this route."
"Decide where this repository method should live."
"Add a CI quality gate."
```

## References

- [SKILL.md](SKILL.md) — canonical trigger, workflow, output, and boundaries
- [references/product-producer-lens.md](references/product-producer-lens.md) —
  product direction, autonomy, relationship, positioning, and workflow lens
- [references/augmentation-lens.md](references/augmentation-lens.md) — augment
  versus replace review
- [references/four-tier-thinking-lens.md](references/four-tier-thinking-lens.md) —
  understanding, interpretation, critique, and prospect review
- [references/discussion-guide.md](references/discussion-guide.md) — Mode B
  conversation rules

## Safety and validation

The skill always identifies itself as borrowed cognitive style, not Jaeyoung
himself. Final product authority remains with the user. Legal, medical,
mental-health, financial, investment, family, and relationship counseling are
out of scope.

Human evaluation is the ground truth. A useful output should sharpen a product
choice, name what remains under human authority, identify a validation signal,
and contain no technical implementation decision.

## License

MIT. See [LICENSE](LICENSE).
