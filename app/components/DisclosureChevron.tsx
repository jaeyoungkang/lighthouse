// Shared disclosure/dropdown chevron. One source for the affordance arrow used
// by paper-card inspection, facet dropdowns, and the account menu so the icon
// never drifts per surface. Rotation (rotate-180 on open) is driven by the
// caller via className — either a state-bound `rotate-180` or `group-open:rotate-180`.
// See docs/design-standards.md (disclosure affordance).

interface DisclosureChevronProps {
  className?: string;
  testId?: string;
}

export function DisclosureChevron({ className, testId }: DisclosureChevronProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      data-testid={testId}
    >
      <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
