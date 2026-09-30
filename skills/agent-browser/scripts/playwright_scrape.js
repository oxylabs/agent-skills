const { chromium } = require("playwright");

const USERNAME = process.env.OXY_UNBLOCKER_USERNAME || process.env.OXY_HB_USERNAME;
const PASSWORD = process.env.OXY_UNBLOCKER_PASSWORD || process.env.OXY_HB_PASSWORD;
const ENDPOINT = "hb.oxylabs.io";

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

async function scrape(targetUrl, params) {
  const browser = await connectWithBackoff(params);
  try {
    // Use the default context: it is the one backed by fingerprint, proxy and o_profile storage.
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    await blockHeavyResources(page);
    watchOxylabsErrors(page, (e) => console.warn("Oxylabs-side error:", e));

    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000 + Math.random() * 3000); // let late JS settle

    return await page.content();
  } finally {
    await browser.close(); // always: an unclosed session keeps its concurrency slot
  }
}

scrape("https://example.com", { p_cc: "US" })
  .then((html) => console.log(html.length, "bytes"))
  .catch((err) => { console.error(redact(err.message)); process.exitCode = 1; });
