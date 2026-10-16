const { chromium } = require("playwright");

const USERNAME = process.env.OXY_AB_USERNAME;
const PASSWORD = process.env.OXY_AB_PASSWORD;
const ENDPOINT = "hb.oxylabs.io";

// Connection parameters (parameters.md). Most jobs need only p_cc plus an explicit page_handler=false: every session
// already gets a fresh browser configuration (default engine, Windows profile family oxyfp_win) and a fresh residential IP.
const PARAMS = { p_cc: "US", page_handler: "false" };
// Block or verification page instead of the expected content? Reconnect with this; the page handler then
// identifies every page and reports its state (challenges.md):
const CHALLENGE_ESCALATION = { page_handler: "true" };
// Escalation when a fresh identity with the right geo is still blocked (targets.md, section 4, rung 4):
// the new browser engine with its macOS profile family. Desktop only; keep the pair for every later connection.
const ENGINE_ESCALATION = { p_src: "oxybrowser", p_fp_tag: "oxyfp_mac_optimized" };

// Concatenate; never round-trip the result through `new URL()` (re-encodes the password -> 401).
function endpointUrl(params = {}) {
  const q = new URLSearchParams(params).toString();
  return `wss://${USERNAME}:${PASSWORD}@${ENDPOINT}${q ? "?" + q : ""}`;
}

// Error messages contain the connection URL, i.e. the password. Redact before logging anything.
const redact = (text) => String(text).split(PASSWORD).join("***");

// Retry only what the service can recover from. 400/401/403 mean the request is wrong: fix, don't retry.
// Playwright: "... wss://user:***@hb.oxylabs.io/ 429 Too Many Requests\nCDP_SESSION_RATE_LIMIT_REACHED"
// Puppeteer:  "Unexpected server response: 429"
const RETRYABLE =
  /\b(429|50[0234]) [A-Z]|response: (429|50[0234])\b|CDP_SESSION_IN_USE|CDP_NO_BROWSERS_AVAILABLE|CDP_BROWSER_OVERWORKED|CDP_BAD_PROXY|CDP_GENERAL_ERROR|[Tt]imeout|ECONNRESET/;

// Exponential backoff: 1s base, 60s cap, full jitter. Six attempts span roughly two minutes.
// The service admits at most 10 new sessions per second per account, so space parallel launches >= 150 ms.
async function connectWithBackoff(params, { attempts = 6, baseMs = 1000, capMs = 60000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await chromium.connectOverCDP(endpointUrl(params), { timeout: 60000 });
    } catch (err) {
      lastErr = err;
      if (!RETRYABLE.test(String(err.message))) throw err; // 400/401/403: stop and fix the request
      console.warn(`connect attempt ${attempt + 1} failed: ${redact(err.message).split("\n")[0]}`);
      const delay = Math.min(capMs, baseMs * 2 ** attempt) * (0.5 + Math.random());
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Default on: images, styles, media and fonts are not needed for data extraction and cost time.
async function blockHeavyResources(page) {
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    return ["image", "stylesheet", "media", "font"].includes(type) ? route.abort() : route.continue();
  });
}

// X-Error-Description present => the error came from the Oxylabs network (retry / adjust per errors table).
// Absent on a 4xx/5xx => the target itself refused you (change approach, do not blindly retry).
function watchOxylabsErrors(page, onInfraError) {
  page.on("response", (resp) => {
    const description = resp.headers()["x-error-description"];
    if (description) onInfraError({ status: resp.status(), url: resp.url(), description });
  });
}

// With page_handler=true the browser reports each page's state as a window message
// { source: "oxylabs-runtime", type: "oxylabs-page-status", status, error? }, status one of identifying |
// closed (challenge being handled) | open (page usable) | failed (with error); the last message wins
// (challenges.md). The same status is also a console line, but the remote browser does not deliver console
// output live to CDP clients, so an init script keeps the latest status on every document instead.
async function watchPageStatus(context) {
  await context.addInitScript(() => {
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (d?.source !== "oxylabs-runtime" || d.type !== "oxylabs-page-status") return;
      const prev = window.__oxyPageStatus;
      window.__oxyPageStatus = {
        status: d.status,
        error: d.error,
        challenged: d.status === "closed" || (d.status !== "identifying" && prev?.challenged === true), // a `closed` since the last `identifying`
      };
    });
  });
}

// Resolves once the page is open (about 8 s after load without a challenge; a widget challenge usually 30 to 45 s);
// throws on failed. identifying and closed are transient. Playwright re-runs the predicate after a navigation,
// so a challenge page that turns into the real page is followed.
async function waitForPageStatus(page, timeoutMs = 90000) {
  const terminal = await page
    .waitForFunction(
      () => {
        const s = window.__oxyPageStatus;
        return s && s.status !== "identifying" && s.status !== "closed" ? s : null;
      },
      null,
      { timeout: timeoutMs, polling: 500 },
    )
    .then((handle) => handle.jsonValue(), () => null);
  if (!terminal) throw new Error("CHALLENGE_HANDLING_TIMEOUT");
  if (terminal.status === "failed") throw new Error(`CHALLENGE_HANDLING_ERROR: ${terminal.error}`); // challenges.md section 3: fresh identity, max 2 retries
  return terminal; // { status: "open", challenged: true | false }
}

// Before a manual trigger (challenges.md section 4): forget the stored status, so the earlier `open` cannot
// satisfy the next wait while the handle request is still queued.
async function clearPageStatus(page) {
  await page.evaluate(() => { window.__oxyPageStatus = null; });
}

async function scrape(targetUrl, params) {
  const browser = await connectWithBackoff(params);
  try {
    // Use the default context: it is the one backed by the device configuration, proxy and o_profile storage.
    const context = browser.contexts()[0] ?? (await browser.newContext());
    await watchPageStatus(context); // before the page exists, so a page-load challenge is captured
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    await blockHeavyResources(page);
    watchOxylabsErrors(page, (e) => console.warn("Oxylabs-side error:", e));

    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000 + Math.random() * 3000); // let late JS settle
    if (params.page_handler === "true") await waitForPageStatus(page); // the status only exists with page_handler=true

    return await page.content();
  } finally {
    await browser.close(); // always: an unclosed session keeps its concurrency slot
  }
}

scrape("https://example.com", PARAMS) // challenge? scrape(url, { ...PARAMS, ...CHALLENGE_ESCALATION }); blocked? { ...PARAMS, ...ENGINE_ESCALATION }
  .then((html) => console.log(html.length, "bytes"))
  .catch((err) => { console.error(redact(err.message)); process.exitCode = 1; });

// This content is not intended to provide legal advice, and scraping activities may be subject to applicable laws and regulations.
