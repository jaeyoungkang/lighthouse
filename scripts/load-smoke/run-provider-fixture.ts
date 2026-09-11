import {
  DEFAULT_PROVIDER_PAPER_COUNT,
  MAX_PROVIDER_PAPER_COUNT,
  PROVIDER_FIXTURE_HOST,
  createLoadSmokeProviderFixture,
  parseProviderFixtureArgs,
} from "./provider-fixture";

function printUsage(): void {
  process.stdout.write(
    [
      "Light House local provider fixture for load-smoke",
      "",
      "Usage: npm run load-smoke:provider-fixture -- [options]",
      "",
      "  --profile <profile>  healthy (default), delay, 429, or 500",
      "  --delay-ms <n>       delay profile latency in ms (default 350)",
      `  --paper-count <n>     healthy result count, 1-${String(MAX_PROVIDER_PAPER_COUNT)} (default ${String(DEFAULT_PROVIDER_PAPER_COUNT)})`,
      "  --port <n>           loopback port (default 43123)",
      "  -h, --help           show this help",
      "",
      "The server always binds to 127.0.0.1 and exposes POST /api/v3/search/papers and GET /__stats.",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<number> {
  try {
    const options = parseProviderFixtureArgs(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return 0;
    }

    const fixture = createLoadSmokeProviderFixture(options);
    await new Promise<void>((resolve, reject) => {
      fixture.server.once("error", reject);
      fixture.server.listen(options.port, PROVIDER_FIXTURE_HOST, resolve);
    });
    process.stdout.write(
      `load-smoke provider fixture: http://${PROVIDER_FIXTURE_HOST}:${String(options.port)} | ` +
        `profile ${options.profile} | delay ${String(options.delayMs)}ms | ` +
        `papers ${String(options.paperCount)}\n`,
    );

    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      fixture.server.close(() => process.exit(0));
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    return await new Promise<number>(() => undefined);
  } catch (error) {
    process.stderr.write(
      `provider fixture aborted: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

void main().then((code) => {
  process.exit(code);
});
