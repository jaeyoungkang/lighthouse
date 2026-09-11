---
name: vignelli-command-ui
description: >
  Use when a Lighthouse surface should feel like an operational command board:
  directive, route-driven, and impossible to ignore. Best for action-priority
  visual treatments, decision points, escalation surfaces, and research
  operations screens where the workflow meaning is already settled.
metadata:
  compatibility: Designed for Claude Code and OpenAI Codex.
---

# Goal

Make the interface behave like a command system, not a neutral analysis board.

This is a harder variant of the Vignelli family. It keeps the same disciplined
grid logic, but increases pressure: larger type, clearer directive blocks, more
obvious route sequencing, and directive accent surfaces that feel operational
rather than decorative.

This is a visual treatment skill. It does not approve new workflow meaning,
action priority, Promise scope, Acceptance Checks, or Evidence Ledger coverage.
If the work changes what the user can do, which action matters most, or how a
contract is fulfilled, use `product-discovery-steward` or Mission Control before
using this style skill.

## Use When

- The user must decide, route, escalate, or act.
- A screen needs unmistakable next steps.
- Research operations, workflow routing, contradiction escalation, or queue control are central.

## Do Not Use When

- The task is mostly browsing or reflective reading. Keep the default interface language rather than applying the command variant.
- The surface should feel unstable, fractured, or antagonistic. This style wants a stable command voice, not tension.
- Multiple panels need equal weight. This style wants a dominant command voice.

## Application Reference

- For actual Light House application, read [references/lighthouse-implementation.md](references/lighthouse-implementation.md).

## Core Stance

1. Commands outrank ambience.
2. Every major section should answer: what is the next route?
3. The directive accent can occupy larger surfaces here, but only where directive force is needed.
4. The UI should feel like signage for action, not a gallery of options.

## Visual System

### Color

- Off-white paper and black rules remain the base.
- The directive accent tokens gain a larger physical footprint than in a neutral Vignelli layout: command surfaces, route codes, and rails.
- Gray stays subordinate. It should never compete with black and the directive accent.

### Typography

- Use the product's neutral sans family.
- Headlines are larger, more compressed, and more urgent.
- Labels remain uppercase and coded.
- Supporting copy stays short. The voice should be terse and operational.

### Geometry

- Use blocks and slabs rather than lightweight cards.
- Tight radii are acceptable, but geometry should still read as engineered.
- Visual weight should concentrate around the primary instruction area.

## Layout Rules

- Build around a dominant command surface plus one explicit route board.
- Left and right columns may support inputs and metrics, but the center must clearly issue direction.
- Route lists should read like operating instructions, not status summaries.
- Footer or edge labels can reinforce the idea of a system coordinate map.

## Component Patterns

- `command-hero`: oversized statement that sets the next action.
- `route-board`: stacked route entries with code, destination, and state.
- `directive-accent-surface`: urgent instruction block or active lane using the product accent tokens.
- `input-tower`: queued priorities or constraints.
- `metric-stack`: a small set of large operational counters.
- `footer-coordinates`: low-volume system context that anchors the board.

## Balance Rules

The danger here is turning the product into a poster. Keep it useful.

- One surface may shout; the rest must support it.
- Preserve scan logic even when the type gets large.
- If multiple directive accent elements start competing, collapse them into one clear command path.
- Do not let the interface become purely rhetorical. Every strong visual move must map to a real action or state.

## Avoid

- Soft onboarding language
- Equal emphasis across all panels
- Decorative accent use without behavioral meaning
- Long explanation blocks under giant headlines
- Excessive component variety
- Hidden next steps

## Implementation Checklist

1. Define the primary command sentence first.
2. Assign route codes to each major branch.
3. Give one directive accent surface ownership of urgency.
4. Collapse secondary options into quiet support panels.
5. Verify that the user can identify the next action immediately.
6. If urgency feels theatrical instead of operational, reduce headline count or directive accent coverage.
