import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function findChrome() {
  return chromeCandidates.find((candidate) => existsSync(candidate));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not allocate a local debugging port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", resolve);
  });
}

async function terminateChild(child, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  const exited = await Promise.race([
    waitForExit(child).then(() => true),
    sleep(timeoutMs).then(() => false),
  ]);
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

async function waitForDebugEndpoint(port) {
  const url = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Chrome debug endpoint returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError ?? new Error("Chrome debug endpoint did not become ready");
}

async function createPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Could not create Chrome target: ${response.status} ${await response.text()}`);
  }
  const target = await response.json();
  if (!target.webSocketDebuggerUrl) {
    throw new Error("Chrome target did not expose a WebSocket debugger URL");
  }
  return target.webSocketDebuggerUrl;
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  let openedReject;
  let openedSettled = false;

  const rejectAll = (reason) => {
    if (!openedSettled && openedReject) {
      openedSettled = true;
      openedReject(reason);
    }
    for (const { reject } of pending.values()) {
      reject(reason);
    }
    pending.clear();
  };

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id) return;
    const callbacks = pending.get(payload.id);
    if (!callbacks) return;
    pending.delete(payload.id);
    if (payload.error) {
      callbacks.reject(new Error(`${payload.error.message}: ${payload.error.data ?? ""}`));
    } else {
      callbacks.resolve(payload.result);
    }
  });

  const opened = new Promise((resolve, reject) => {
    openedReject = reject;
    socket.addEventListener(
      "open",
      () => {
        openedSettled = true;
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      (event) => {
        rejectAll(new Error(`CDP socket errored before open: ${event.type}`));
      },
      { once: true },
    );
  });
  socket.addEventListener("close", () => {
    rejectAll(new Error("CDP socket closed before response"));
  });
  socket.addEventListener("error", (event) => {
    rejectAll(new Error(`CDP socket errored before response: ${event.type}`));
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId;
      nextId += 1;
      const result = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      socket.close();
    },
  };
}

function buildFixtureHtml() {
  // This fixture owns physical Chrome evidence: a real pointer activation must
  // create a visible, pinned receipt without unmounting the origin card. The
  // production React activation and identity lifecycle are covered separately
  // by search-followup-activation.test.tsx and research-route-shell.test.tsx.
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        --surface-app: rgb(247 247 244);
        --surface-panel: rgb(255 255 255);
        --border-subtle: rgb(210 208 202);
        --text: rgb(20 20 20);
        --muted: rgb(96 94 88);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--surface-app);
        color: var(--text);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .research-route {
        position: relative;
        display: flex;
        width: 900px;
        height: 420px;
        overflow: hidden;
        border: 1px solid var(--border-subtle);
      }
      .document-main {
        min-width: 0;
        flex: 1;
        overflow-y: auto;
        background: var(--surface-app);
        padding: 0 24px 40px;
      }
      .search-followup-receipt {
        position: sticky;
        top: 0;
        z-index: 70;
        height: 0;
        pointer-events: none;
      }
      .search-followup-receipt-surface {
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        background: var(--surface-panel);
        padding: 10px 12px;
        color: var(--muted);
        box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
      }
      .relationship-seed-title-card {
        position: sticky;
        top: 0;
        z-index: 20;
        margin-bottom: 24px;
        border-bottom: 1px solid var(--border-subtle);
        background: color-mix(in srgb, var(--surface-app) 95%, transparent);
        padding: 16px 4px;
        backdrop-filter: blur(8px);
      }
      .relationship-seed-title-card a {
        display: block;
        margin-top: 8px;
        color: var(--text);
        font-size: 20px;
        line-height: 28px;
        font-weight: 650;
        text-decoration: none;
      }
      .relationship-seed-title-card p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }
      .candidate-card {
        min-height: 112px;
        margin: 0 0 12px;
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        background: var(--surface-panel);
        padding: 16px;
      }
      .candidate-card button {
        margin-top: 16px;
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        background: var(--surface-panel);
        padding: 8px 12px;
        color: var(--text);
        cursor: pointer;
      }
      .agent-overlay {
        position: absolute;
        top: 128px;
        right: 8px;
        z-index: 30;
        width: 260px;
        min-height: 96px;
        border: 1px solid var(--border-subtle);
        background: var(--surface-panel);
      }
    </style>
  </head>
  <body>
    <section class="research-route">
      <main class="document-main" data-testid="document-panel-main">
        <div class="search-followup-receipt" role="status" aria-live="polite" aria-atomic="true" data-testid="search-followup-activation-announcer"></div>
        <header class="relationship-seed-title-card" data-testid="relationship-seed-title-card">
          <p>인용 관계</p>
          <a href="#">The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery</a>
          <p>이 논문과 관계된 논문을 탐색하고 있다</p>
        </header>
        ${Array.from(
          { length: 18 },
          (_, index) =>
            `<article class="candidate-card">후보 논문 ${index + 1}${
              index === 17
                ? '<button type="button" data-testid="search-followup-trigger" data-query="scientific discovery">scientific discovery 검색</button>'
                : ""
            }</article>`,
        ).join("")}
      </main>
      <aside class="agent-overlay" data-testid="document-panel-agent-overlay">AI comment</aside>
    </section>
    <script>
      const trigger = document.querySelector('[data-testid="search-followup-trigger"]');
      const announcer = document.querySelector('[data-testid="search-followup-activation-announcer"]');
      trigger.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const surface = document.createElement('div');
        surface.className = 'search-followup-receipt-surface';
        surface.dataset.testid = 'search-followup-activation-status';
        surface.textContent = \`‘\${trigger.dataset.query}’ 검색으로 이동 중\`;
        announcer.replaceChildren(surface);
        trigger.dataset.activated = 'true';
      });
    </script>
  </body>
</html>`;
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error(
      "Chrome/Chromium executable not found. Set CHROME_PATH to run sticky browser evidence.",
    );
  }

  const userDataDir = await mkdtemp(path.join(tmpdir(), "lh-sticky-browser-"));
  const port = await getFreePort();
  const child = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ]);

  child.stderr.on("data", () => undefined);
  child.stdout.on("data", () => undefined);

  let client;
  try {
    await waitForDebugEndpoint(port);
    const pageWs = await createPage(
      port,
      `data:text/html,${encodeURIComponent(buildFixtureHtml())}`,
    );
    client = createCdpClient(pageWs);
    await client.send("Runtime.enable");
    await sleep(500);
    const preparation = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const scroller = document.querySelector('[data-testid="document-panel-main"]');
        const header = document.querySelector('[data-testid="relationship-seed-title-card"]');
        const trigger = document.querySelector('[data-testid="search-followup-trigger"]');
        const before = header.getBoundingClientRect();
        const receiptBefore = document.querySelector('[data-testid="search-followup-activation-status"]');
        scroller.scrollTop = scroller.scrollHeight;
        return new Promise((resolve) => requestAnimationFrame(() => {
          const triggerBox = trigger.getBoundingClientRect();
          resolve({
            beforeTop: before.top,
            scrollTop: scroller.scrollTop,
            receiptBefore: receiptBefore !== null,
            clickX: triggerBox.left + triggerBox.width / 2,
            clickY: triggerBox.top + triggerBox.height / 2,
            triggerVisible: triggerBox.top >= 0 && triggerBox.bottom <= window.innerHeight
          });
        }));
      })()`,
      awaitPromise: true,
    });
    const prepared = preparation.result.value;
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: prepared.clickX,
      y: prepared.clickY,
      button: "left",
      clickCount: 1,
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: prepared.clickX,
      y: prepared.clickY,
      button: "left",
      clickCount: 1,
    });
    const result = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const scroller = document.querySelector('[data-testid="document-panel-main"]');
        const header = document.querySelector('[data-testid="relationship-seed-title-card"]');
        const overlay = document.querySelector('[data-testid="document-panel-agent-overlay"]');
        const receipt = document.querySelector('[data-testid="search-followup-activation-announcer"]');
        const receiptSurface = document.querySelector('[data-testid="search-followup-activation-status"]');
        const trigger = document.querySelector('[data-testid="search-followup-trigger"]');
        const originCard = document.querySelector('.candidate-card:last-of-type');
        const after = header.getBoundingClientRect();
        const overlayBox = overlay.getBoundingClientRect();
        const scrollerBox = scroller.getBoundingClientRect();
        const headerStyles = getComputedStyle(header);
        const receiptBox = receipt.getBoundingClientRect();
        const receiptStyles = getComputedStyle(receipt);
        const receiptSurfaceBox = receiptSurface?.getBoundingClientRect();
        const receiptSurfaceStyles = receiptSurface ? getComputedStyle(receiptSurface) : null;
        resolve({
          afterTop: after.top,
          scrollerTop: scrollerBox.top,
          scrollerBottom: scrollerBox.bottom,
          overlayTop: overlayBox.top,
          headerBottom: after.bottom,
          position: headerStyles.position,
          background: headerStyles.backgroundColor,
          receiptTop: receiptBox.top,
          receiptPosition: receiptStyles.position,
          receiptText: receiptSurface?.textContent ?? null,
          receiptRole: receipt.getAttribute('role'),
          receiptAriaLive: receipt.getAttribute('aria-live'),
          receiptAriaAtomic: receipt.getAttribute('aria-atomic'),
          receiptHasAriaBusy: receipt.hasAttribute('aria-busy'),
          receiptSurfaceDisplay: receiptSurfaceStyles?.display ?? null,
          receiptSurfaceVisibility: receiptSurfaceStyles?.visibility ?? null,
          receiptSurfaceOpacity: receiptSurfaceStyles?.opacity ?? null,
          receiptSurfaceTop: receiptSurfaceBox?.top ?? null,
          receiptSurfaceBottom: receiptSurfaceBox?.bottom ?? null,
          receiptSurfaceWidth: receiptSurfaceBox?.width ?? 0,
          receiptSurfaceHeight: receiptSurfaceBox?.height ?? 0,
          activationRaisedByClick: trigger.dataset.activated === 'true',
          originCardStillMounted: originCard?.isConnected === true
        });
      })))`,
      awaitPromise: true,
    });

    const value = result.result.value;
    const headerStayedPinned = Math.abs(value.afterTop - value.scrollerTop) <= 1;
    const scrolled = prepared.scrollTop >= 200;
    const overlayBelowHeader = value.overlayTop >= value.headerBottom - 1;
    const sticky = value.position === "sticky";
    const hasBackground = value.background !== "rgba(0, 0, 0, 0)";
    const receiptStayedPinned = Math.abs(value.receiptTop - value.scrollerTop) <= 1;
    const receiptSticky = value.receiptPosition === "sticky";
    const receiptCreatedByClick = !prepared.receiptBefore && value.activationRaisedByClick;
    const receiptNamesQuery = value.receiptText === "‘scientific discovery’ 검색으로 이동 중";
    const receiptAnnouncesImmediately =
      value.receiptRole === "status" &&
      value.receiptAriaLive === "polite" &&
      value.receiptAriaAtomic === "true" &&
      value.receiptHasAriaBusy === false;
    const receiptSurfaceVisible =
      value.receiptSurfaceDisplay !== "none" &&
      value.receiptSurfaceVisibility !== "hidden" &&
      value.receiptSurfaceOpacity !== "0" &&
      value.receiptSurfaceWidth > 0 &&
      value.receiptSurfaceHeight > 0 &&
      value.receiptSurfaceTop >= value.scrollerTop - 1 &&
      value.receiptSurfaceBottom <= value.scrollerBottom + 1;

    if (
      !headerStayedPinned ||
      !scrolled ||
      !prepared.triggerVisible ||
      !overlayBelowHeader ||
      !sticky ||
      !hasBackground ||
      !receiptStayedPinned ||
      !receiptSticky ||
      !receiptCreatedByClick ||
      !receiptSurfaceVisible ||
      !receiptNamesQuery ||
      !receiptAnnouncesImmediately ||
      !value.originCardStillMounted
    ) {
      throw new Error(`Sticky seed header browser check failed: ${JSON.stringify(value)}`);
    }

    console.log(`relationship seed sticky browser check passed: ${JSON.stringify(value)}`);
  } finally {
    client?.close();
    await terminateChild(child);
    await rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
