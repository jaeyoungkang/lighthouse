// @promise promise:story-chain-event-contract
// @aspect aspect:admin-access-control
// @aspect aspect:common-page-footer
// @check acceptance-check:story-chain-event-contract-admin-event-catalog

import { SiteFooter } from "@/app/components/SiteFooter";
import Link from "next/link";
import { t } from "@/app/i18n/message-access";
import type { AnalyticsEventDefinition } from "@/app/server/services/analytics/event-contract";

const SINK_DISPLAY_NAMES: Record<string, string> = {
  amplitude: "Amplitude",
};

function sinkLabel(definition: AnalyticsEventDefinition) {
  if (!definition.privacy.allowExternalSinks) return "internal only";
  const entries = Object.entries(definition.sinks);
  if (entries.length === 0) return "internal only";
  return entries
    .map(([vendor, name]) => `${SINK_DISPLAY_NAMES[vendor] ?? vendor} ${name}`)
    .join(", ");
}

function refsLabel(definition: AnalyticsEventDefinition) {
  const refs = [
    definition.storyRefs.experienceRef,
    definition.storyRefs.momentRef,
    definition.storyRefs.promiseRef,
    ...(definition.storyRefs.relatedPromiseRefs ?? []),
    ...definition.storyRefs.aspectRefs,
    ...definition.storyRefs.acceptanceCheckRefs,
    ...definition.storyRefs.scenarioRefs,
  ].filter(Boolean);
  return refs.length > 0 ? refs.join(", ") : "None";
}

function joinList(values: string[]) {
  return values.length === 0 ? "None" : values.join(", ");
}

function countExternalSink(definitions: AnalyticsEventDefinition[]) {
  return definitions.filter(
    (definition) =>
      definition.privacy.allowExternalSinks && Object.keys(definition.sinks).length > 0,
  ).length;
}

function countByOwner(definitions: AnalyticsEventDefinition[]) {
  return new Set(definitions.map((definition) => definition.owner)).size;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-border-subtle border-t py-4 first:border-t-0 sm:border-t-0 sm:border-l sm:px-4 sm:first:border-l-0">
      <div className="text-foreground font-display text-3xl font-semibold tracking-tight">
        {value}
      </div>
      <div className="text-text-muted mt-1 text-xs font-semibold tracking-[0.08em] uppercase">
        {label}
      </div>
    </div>
  );
}

export function AnalyticsEventsDashboard({
  eventDefinitions,
  requiredEventNames = [],
  userEmail,
}: {
  eventDefinitions: AnalyticsEventDefinition[];
  requiredEventNames?: string[];
  userEmail: string;
}) {
  const sorted = [...eventDefinitions].sort((left, right) => left.name.localeCompare(right.name));
  const requiredEvents = new Set(requiredEventNames);

  return (
    <main
      className="text-foreground h-full flex-1 overflow-y-auto"
      data-testid="analytics-events-dashboard"
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10" data-testid="analytics-events-header">
          <div>
            <p className="text-text-muted mb-3 font-mono text-xs tracking-[0.12em] uppercase">
              admin {userEmail}
            </p>
            <h1 className="text-foreground font-display text-4xl font-semibold tracking-tight">
              Analytics event catalog
            </h1>
            <p className="text-foreground mt-4 max-w-3xl text-base leading-[1.8]">
              Canonical event contract declared in docs/analytics/events.yaml. Each row shows the
              event identity, trigger source/phase/timing, Story Chain refs, subject and property
              allowlists, measurement purpose, emission boundary/cardinality, and privacy plus
              per-vendor sink policy.
            </p>
          </div>
          <div className="text-text-muted mt-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
            <span>Source docs/analytics/events.yaml</span>
            <span>Declared {String(sorted.length)} canonical events</span>
          </div>
          <nav
            aria-label={t("admin.access.nav.label")}
            className="mt-5 flex gap-4 font-mono text-xs font-semibold uppercase"
          >
            <Link className="text-text-muted hover:text-foreground pb-1" href="/admin/access">
              {t("admin.access.nav.access")}
            </Link>
            <Link className="text-foreground border-b border-current pb-1" href="/admin/analytics">
              {t("admin.access.nav.analytics")}
            </Link>
          </nav>
        </header>

        <section
          className="border-border-subtle mb-12 grid border-y sm:grid-cols-3"
          data-testid="analytics-events-summary"
        >
          <Metric label="declared events" value={sorted.length} />
          <Metric label="owners" value={countByOwner(sorted)} />
          <Metric label="external sink eligible" value={countExternalSink(sorted)} />
        </section>

        <section data-testid="analytics-events-catalog-section">
          <h2 className="text-foreground font-display mb-5 text-xl font-semibold tracking-tight">
            Event contract catalog
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-y text-left text-sm">
              <thead className="text-text-muted border-border-subtle border-b text-xs uppercase">
                <tr>
                  <th className="py-3 pr-4 font-semibold">Event</th>
                  <th className="py-3 pr-4 font-semibold">Trigger</th>
                  <th className="py-3 pr-4 font-semibold">Story refs</th>
                  <th className="py-3 pr-4 font-semibold">Payload allowlist</th>
                  <th className="py-3 pr-4 font-semibold">Sink policy</th>
                </tr>
              </thead>
              <tbody className="divide-border-subtle divide-y">
                {sorted.length === 0 ? (
                  <tr>
                    <td className="text-text-muted py-4" colSpan={5}>
                      No events declared in docs/analytics/events.yaml.
                    </td>
                  </tr>
                ) : (
                  sorted.map((definition) => (
                    <tr key={`${definition.name}-v${String(definition.version)}`}>
                      <td className="py-3 pr-4 align-top">
                        <div className="font-mono text-xs font-semibold">{definition.name}</div>
                        <div className="text-text-muted mt-1 text-xs">
                          v{definition.version} · {definition.owner} · {definition.actor} ·{" "}
                          {definition.surface}
                        </div>
                        {requiredEvents.has(definition.name) ? (
                          <div className="text-accent mt-1 text-xs font-semibold">
                            required event
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <div className="font-mono text-xs">
                          {definition.trigger.source}/{definition.trigger.phase}
                        </div>
                        <div className="text-text-muted mt-1 max-w-[18rem] text-xs leading-[1.5]">
                          {definition.trigger.timing}
                        </div>
                        {definition.emission ? (
                          <div className="text-text-muted mt-2 max-w-[18rem] font-mono text-xs leading-[1.5]">
                            {definition.emission.boundary}/{definition.emission.cardinality}
                            <br />
                            {definition.emission.emitter}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <div className="max-w-[24rem] font-mono text-xs leading-[1.5] break-words">
                          {refsLabel(definition)}
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <details>
                          <summary className="text-text-muted hover:text-accent cursor-pointer text-xs font-semibold">
                            Measurement and payload
                          </summary>
                          <div className="mt-3 max-w-[22rem] space-y-2 font-mono text-xs leading-[1.5]">
                            {definition.measurement ? (
                              <>
                                <div className="break-words">
                                  purpose {definition.measurement.purpose}
                                </div>
                                <div className="break-words">
                                  decision {definition.measurement.decisionUse}
                                </div>
                              </>
                            ) : null}
                            <div className="break-words">
                              subject {joinList(definition.subject.allowed)}
                            </div>
                            <div className="break-words">
                              required {joinList(definition.properties.required)}
                            </div>
                            <div className="break-words">
                              optional {joinList(definition.properties.optional)}
                            </div>
                            <div className="break-words">
                              forbidden {joinList(definition.properties.forbidden)}
                            </div>
                            {definition.measurement ? (
                              <div className="break-words">
                                property purposes{" "}
                                {joinList(Object.keys(definition.measurement.propertyPurposes))}
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <div className="font-mono text-xs">{sinkLabel(definition)}</div>
                        <div className="text-text-muted mt-1 text-xs">
                          {definition.privacy.level}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <SiteFooter testId="admin-analytics-footer" />
    </main>
  );
}
