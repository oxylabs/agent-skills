# Examples

All examples read `OXY_UNBLOCKER_USERNAME` / `OXY_UNBLOCKER_PASSWORD` (aliases `OXY_HB_USERNAME` /
`OXY_HB_PASSWORD`) and connect to `wss://USERNAME:PASSWORD@hb.oxylabs.io`. The `endpointUrl`, `connectWithBackoff`,
`blockHeavyResources`, `watchOxylabsErrors` and `scrape` helpers are the ones from
`scripts/playwright_scrape.js`.

## Puppeteer

```javascript
const puppeteer = require("puppeteer");

const USERNAME = process.env.OXY_UNBLOCKER_USERNAME || process.env.OXY_HB_USERNAME;
const PASSWORD = process.env.OXY_UNBLOCKER_PASSWORD || process.env.OXY_HB_PASSWORD;
// Same policy as scripts/playwright_scrape.js: Puppeteer reports "Unexpected server response: <status>" without the body.
const RETRYABLE =
  /\b(429|50[0234]) [A-Z]|response: (429|50[0234])\b|CDP_SESSION_IN_USE|CDP_NO_BROWSERS_AVAILABLE|CDP_BROWSER_OVERWORKED|CDP_BAD_PROXY|CDP_GENERAL_ERROR|[Tt]imeout|ECONNRESET/;

async function connect(params, attempts = 6) {
  const q = new URLSearchParams(params).toString();
  const browserWSEndpoint = `wss://${USERNAME}:${PASSWORD}@hb.oxylabs.io${q ? "?" + q : ""}`;
  for (let i = 0; ; i++) {
    try {
      return await puppeteer.connect({ browserWSEndpoint, protocolTimeout: 60000 });
    } catch (err) {
      if (i >= attempts - 1 || !RETRYABLE.test(err.message)) throw err;
      await new Promise((r) => setTimeout(r, Math.min(60000, 1000 * 2 ** i) * (0.5 + Math.random())));
    }
  }
}

(async () => {
  const browser = await connect({ p_cc: "US" });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) =>
      ["image", "stylesheet", "media", "font"].includes(req.resourceType()) ? req.abort() : req.continue());
    page.on("response", (resp) => {
      const d = resp.headers()["x-error-description"];
      if (d) console.warn("Oxylabs-side error", resp.status(), resp.url(), d);
    });

    await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log(await page.title());
  } finally {
    await browser.close();
  }
})();
```

## Playwright (Python, async)

```python
import asyncio, os, random, re
from playwright.async_api import async_playwright

USERNAME = os.environ.get("OXY_UNBLOCKER_USERNAME") or os.environ["OXY_HB_USERNAME"]
PASSWORD = os.environ.get("OXY_UNBLOCKER_PASSWORD") or os.environ["OXY_HB_PASSWORD"]
RETRYABLE = re.compile(  # same policy as scripts/playwright_scrape.py
    r"\b(429|50[0234]) [A-Z]|response: (429|50[0234])\b|CDP_SESSION_IN_USE|CDP_NO_BROWSERS_AVAILABLE|"
    r"CDP_BROWSER_OVERWORKED|CDP_BAD_PROXY|CDP_GENERAL_ERROR|[Tt]imeout|ECONNRESET")


async def connect(pw, params, attempts=6):
    q = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"wss://{USERNAME}:{PASSWORD}@hb.oxylabs.io" + (f"?{q}" if q else "")
    for i in range(attempts):
        try:
            return await pw.chromium.connect_over_cdp(url, timeout=60_000)
        except Exception as err:  # noqa: BLE001
            if i == attempts - 1 or not RETRYABLE.search(str(err)):
                raise
            await asyncio.sleep(min(60, 2 ** i) * (0.5 + random.random()))


async def main():
    async with async_playwright() as pw:
        browser = await connect(pw, {"p_cc": "US"})
        try:
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = await context.new_page()
            await page.route("**/*", lambda r: r.abort()
                             if r.request.resource_type in {"image", "stylesheet", "media", "font"}
                             else r.continue_())
            page.on("response", lambda r: r.headers.get("x-error-description")
                    and print("Oxylabs-side error", r.status, r.url, r.headers["x-error-description"]))

            await page.goto("https://example.com", wait_until="domcontentloaded", timeout=30_000)
            await page.screenshot(path="page.png", full_page=True)
            print(await page.title())
        finally:
            await browser.close()

asyncio.run(main())
```

## Raw CDP over WebSocket (no library)

Node's built-in `WebSocket` (and many minimal clients) silently drop `user:pass@` from the URL, which the
service reports as `401 missing auth header`. Build the header yourself. The service decodes with the
URL-safe base64 alphabet and requires exactly one `:` in the decoded value.

```javascript
const USERNAME = process.env.OXY_UNBLOCKER_USERNAME || process.env.OXY_HB_USERNAME;
const PASSWORD = process.env.OXY_UNBLOCKER_PASSWORD || process.env.OXY_HB_PASSWORD;

if (PASSWORD.includes(":")) throw new Error("password may not contain ':' for Basic auth");
const token = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
if (/[+/]/.test(token)) console.warn("base64 contains + or /; use base64url encoding: " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64url"));

const ws = new WebSocket("wss://hb.oxylabs.io/?p_cc=US", { headers: { Authorization: `Basic ${token}` } });
let nextId = 1;
const pending = new Map();
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
  });

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.code} ${msg.error.message}`)) : resolve(msg.result);
  }
});
ws.addEventListener("close", (ev) => console.log("closed", ev.code, ev.reason)); // 3000 + CDP_* on failure
ws.addEventListener("open", async () => {
  try {
    const { value: sessionId } = await send("__session_id");
    console.log("session_id:", sessionId, "inspect: https://hb.oxylabs.io/novnc/?id=" + sessionId);
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId: cdpSession } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, cdpSession);
    await send("Page.navigate", { url: "https://example.com" }, cdpSession);
  } finally {
    setTimeout(() => ws.close(1000), 5000); // always close: the session holds a concurrency slot
  }
});
```

## Resume a named session

`session_name` alone keeps the remote browser alive for 10 minutes after you disconnect. What survives
depends on **how** you disconnect:

| Disconnect method | Session resumable | Open pages and their cookies kept |
|-------------------|-------------------|-----------------------------------|
| Puppeteer `browser.disconnect()` | yes | yes |
| Process exit / dropped connection | yes | yes |
| Playwright or Puppeteer `browser.close()` | yes | **no** (pages closed, cookies cleared) |

Puppeteer hand-over (process A):

```javascript
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.connect({ browserWSEndpoint: endpointUrl({ session_name: "job-42", p_cc: "US" }) });
const page = await browser.newPage();
await page.goto("https://example.com/login");
// ... log in ...
await browser.disconnect(); // NOT close(): keeps the page and cookies for the next connection
```

Resume (process B, within 10 minutes, same credentials; Playwright or Puppeteer):

```javascript
const browser = await connectWithBackoff({ session_name: "job-42", p_cc: "US" }); // 429 CDP_SESSION_IN_USE while A is still attached
try {
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes("example.com")) ?? (await ctx.newPage());
  await page.goto("https://example.com/account"); // still logged in
} finally {
  await browser.close(); // last user of the session: close for real
}
```

If every process uses Playwright, keep the first connection open until the process exits instead of calling
`close()`. For state that must outlive the 10-minute window use a profile (next example). To end a named
session early, connect once more with `keep_alive=false` and close.

## Profile setup and consumer runs

Most jobs need no profile: every session is a fresh fingerprint on a fresh IP. Use one when cookies must survive
between jobs (DataDome clearance, a login). Then split the work in two roles. **Setup** runs once per profile and is
the only connection that sends `o_profile_save=true`. **Consumers** send `o_profile` alone: read-only, no write lock,
so they can never hit `409` and can start while others run. In production these are two services: one prepares and
validates profiles, the other only uses them.

```javascript
const identity = {
  o_profile: "acme-us-01", p_cc: "US", p_device: "desktop",
  proxy_resi_ses_id: "acmeus01", proxy_resi_ses_time: "30",
};

// Setup service: run once per profile name. Earn the cookies, verify, close (closing writes the profile).
async function setupProfile(entryUrl) {
  const browser = await connectWithBackoff({ ...identity, o_profile_save: "true" });
  try {
    const page = await browser.contexts()[0].newPage();
    const response = await page.goto(entryUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000); // let late JS and cookies settle
    if ((await classify(page, response)) !== "ok") throw new Error("setup failed: block page, pick a new profile name"); // classify() from targets.md
    // ... log in here if the target needs it ...
  } finally {
    await browser.close();
  }
}

// Consumer service: any number of runs, never o_profile_save.
await setupProfile("https://target.example/");
await scrape("https://target.example/listing/1", identity);
await scrape("https://target.example/listing/2", identity);
```

Use `browser.contexts()[0]`; a `newContext()` is not backed by the profile. Keep every geo/device value identical
across setup and consumers. When consumers start seeing block pages, do not re-save the profile from a consumer: run
`setupProfile` again under a new profile name and a new sticky id.

## Session id, live inspection and recording

```javascript
const browser = await connectWithBackoff({ p_cc: "US", record: "true", record_name: "job-42" });
try {
  const context = browser.contexts()[0];
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const { value: sessionId } = await cdp.send("__session_id");
  console.log(`session_id: ${sessionId}`);
  console.log(`live view:  https://hb.oxylabs.io/novnc/?id=${sessionId}`);
  await page.goto("https://example.com");
} finally {
  await browser.close(); // the recording is finalised and appears in https://hb.oxylabs.io/dashboard
}
```

## Fan-out with launch pacing

```javascript
async function mapWithPacing(urls, params, concurrency = 8, launchGapMs = 150) {
  const results = new Array(urls.length);
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const i = next++;
      await new Promise((r) => setTimeout(r, launchGapMs)); // stay well under 10 launches/second
      try {
        results[i] = await scrape(urls[i], params);
      } catch (err) {
        results[i] = { error: err.message };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
```

Each `scrape` call opens and closes its own session, so `concurrency` is the number of concurrent sessions
(default account cap 100).
