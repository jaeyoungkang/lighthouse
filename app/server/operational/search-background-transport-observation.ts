export type SearchBackgroundRoute = "enrichment" | "spelling_correction" | "term_discovery";
export type SearchBackgroundTransportVersion = "legacy" | "v1";
type SearchBackgroundTransportObservationSink = (
  message: string,
  fields: { route: SearchBackgroundRoute; transportVersion: SearchBackgroundTransportVersion },
) => void;

/**
 * Legacy retirement signal. Payload identity and user data are deliberately
 * excluded so the observation stays low-cardinality and privacy-safe.
 */
export function observeSearchBackgroundTransport(
  route: SearchBackgroundRoute,
  transportVersion: SearchBackgroundTransportVersion,
  sink: SearchBackgroundTransportObservationSink = console.info,
): void {
  try {
    sink("[search-background-transport]", {
      route,
      transportVersion,
    });
  } catch {
    return;
  }
}
