export interface LinkedAbortSignal {
  signal: AbortSignal;
  cleanup: () => void;
}

export function linkSignals(...signals: AbortSignal[]): LinkedAbortSignal {
  const linked = new AbortController();
  const cleanupCallbacks: Array<() => void> = [];
  const cleanup = () => {
    for (const callback of cleanupCallbacks.splice(0)) callback();
  };
  const abort = () => {
    cleanup();
    linked.abort();
  };
  for (const s of signals) {
    if (s.aborted) {
      linked.abort();
      cleanup();
      return { signal: linked.signal, cleanup };
    }
    s.addEventListener("abort", abort, { once: true });
    cleanupCallbacks.push(() => {
      s.removeEventListener("abort", abort);
    });
  }
  return { signal: linked.signal, cleanup };
}
