# Light House Implementation Notes

Use this reference when Light House needs a more directive, operational variant of the Vignelli family.

## Best-Fit Surfaces

- Search result action zones
- Research route orchestration
- Agent action clusters
- Alignment or operations dashboards
- Any flow where the next step must be unmistakable

This is not a browsing theme. It is an escalation and routing treatment.

## Start Here

1. `app/globals.css`
2. `app/components/research/ResearchRouteSearchBar.tsx`
3. `app/components/research-route-renderers/search-view-content.tsx`
4. `app/components/research-route-renderers/search-results-header.tsx`
5. `app/components/research-route-renderers/GapNetworkView.tsx`
6. `app/components/research/AgentPanel.tsx`

If this treatment needs runtime switching again, route it through Mission Control before adding new state, storage, or HTML classes.

## Token Strategy

Use the shared token ladder in `app/globals.css`, but increase command contrast.

Prioritize:

- `--surface-panel-strong`
- `--accent`
- `--accent-strong`
- `--accent-foreground`
- `--border-strong`
- `--chip-accent-bg`
- `--control-hover-bg`
- `--paper-panel-bg`

Recommended character:

- pale paper base
- black framing rules
- a stronger directive accent surface than a neutral Vignelli layout
- larger display moments
- tighter, more forceful hierarchy

## Class Hooks That Matter

- `.lh-control-accent`
- `button.lh-chip`
- `.lh-kicker`
- `.lh-panel`
- `.lh-panel-muted`

This variant should upgrade pressable surfaces first. Static display chips can remain quieter.

## Light House Mapping

### Research command layer

- `ResearchRouteSearchBar.tsx` owns the route search input and its commit action.
- Keep route kinds and operational modes out of the top bar unless Mission Control changes the product meaning first.

### Search result action layer

- In `search-view-content.tsx` and `search-results-header.tsx`, the primary CTA cluster should feel like routing decisions, not ordinary buttons.
- Promote the main action path. Compress the rest.

### Agent action layer

- `AgentPanel.tsx` is a strong fit for command treatment because the user is already choosing the next move.
- Wide, directive button surfaces are more appropriate here than decorative badges.

### Gap and operations layers

- `GapNetworkView.tsx` owns the gap report surface. Keep evidence reading quieter than the report's next-search actions.
- Mission Control verdicts are CLI-owned through `npm run mc:status`; there is no verdict dashboard surface to style in this reference.
- Do not turn internal audit lane identifiers into product navigation or invent destinations from domain types.

## Guardrails

- Do not apply command pressure to every paper card.
- Keep long-form evidence reading surfaces quieter than route and action surfaces.
- One dominant command zone per screen is enough.
- If the directive accent appears in multiple unrelated actions, collapse back to a single operational lane.
