# Challenge handling

The remote browser has a built-in **page handler** for the access challenges websites show. It is switched on
per connection with one URL parameter (`page_handler`, `parameters.md`), identifies every page, completes
the challenges it finds and reports the page state as one console line and one `window` message. Block
detection with those states and the escalation ladder live in `targets.md`; this file holds the rules for
the handler itself, and the code.

## 1. When to enable it

- **Start every target with `page_handler=false`.** Most pages never show a challenge, and unnecessary
  challenge handling only adds time. Always pass the parameter explicitly: when it is absent, your account's
  setting applies, and on many accounts that means handling is on.
- Switch to `page_handler=true` **on a fresh connection** as soon as the plain attempt shows a block or
  verification page instead of the expected content. A challenge is then completed inside the remote browser;
  the page state (section 2) says whether it was.
- Once enabled for a target, keep it on for every connection to that target. Every distinct parameter
  combination is provisioned separately, so a flapping `page_handler` also costs sessions.
- **Not every block is a challenge the handler acts on.** `failed`, or `open` while the page is still a block
  page (`403`, "access denied", a redirect to a block path), is the site's decision about this visitor: do not
  keep waiting on that session, move to a fresh identity (`targets.md` section 4, rung 2).

## 2. Wait for the page status

- With `page_handler=true`, every page reports its state as a `window` message
  `{ source: "oxylabs-runtime", type: "oxylabs-page-status", status, error? }` (the same fields are also printed
  as the console line `oxylabs-page-status - {json}`). `status` is one of the following; `failed` adds an `error`:
  - `{"status":"identifying"}`: the page is being checked. Logged at load, after an in-page navigation
    (`history.pushState` or a hash change, as single-page sites do on link clicks) and as the acknowledgement of a manual
    trigger (section 4).
  - `{"status":"closed"}`: a supported challenge was found and is being handled; the page is not usable yet.
  - `{"status":"open"}`: the page is usable. Without a challenge it arrives about 8 s after load; after a
    `closed` it arrives when handling ended (a widget challenge typically takes 30 to 45 s).
  - `{"status":"failed","error":"bad_token"}`: the challenge was not handled; `error` says why: `bad_token` (the
    page rejected the token), `token_not_applied` (the token found nothing to go to), `acceptance_inconclusive`
    (the page neither accepted nor rejected it in time), `challenge_params_timeout` (the challenge page's
    parameters never arrived) or `handling_failed` (anything else). A `failed` always follows a `closed`.
  `identifying` and `closed` are transient; wait for a terminal one: `open` or `failed`. A page that went
  `closed` then `open` had a challenge handled; one that went straight to `open` had none.
- All statuses come from the top frame, also for a challenge inside a nested frame: one
  `closed` when handling starts anywhere on the page, one `open`/`failed` when it has ended everywhere.
- Install the status init script **before the page exists** (`context.addInitScript`) so a page-load challenge
  is captured. The templates in `scripts/` do this: `watchPageStatus` / `watch_page_status` keep the latest
  status on `window.__oxyPageStatus`, `waitForPageStatus` / `wait_for_page_status` wait for a terminal one with
  `page.waitForFunction`.
- Wait up to **90 s** for the status. A page that navigates or changes content after it is normal: continue
  from the new state, do not reload.
- A later status replaces the earlier one: a widget that renders after an `open` closes the page again and
  is reported with further lines (`closed`, then `open` or `failed`). So keep the watcher installed while you
  work, and re-read `window.__oxyPageStatus` before trusting a page whose content changed after the first
  `open`.
- Read the status from the `window` message, never from the console: the remote browser stores console output
  but does not deliver it live to CDP clients (`page.on("console")`, `Runtime.consoleAPICalled`), whatever the
  client library, and it exposes no CDP bindings either. So an init script keeps the status on the page and the
  client reads it back with `page.waitForFunction` or a polled `evaluate` (section 6).

## 3. On a status with `error`

Do not keep hammering the same session. Close it, back off (10 s, doubling), reconnect as a **fresh
identity** (new session; if you used them, a new `proxy_resi_ses_id` and a new `o_profile` name or none), same
geo and device, `page_handler=true` still on. At most **2 more attempts**, then stop and report that the
challenge cannot be completed right now (`targets.md` section 6, with every `oxylabs-page-status` line and
its timestamp). Errors on every identity in a row point at the network or the target, not at your
parameters: that report goes to `support@oxylabs.io`.

## 4. Challenge appears late, or never renders

- A challenge that appears **after page load** (click, form submit) is not handled automatically. Trigger it
  from inside the page with `window.postMessage({ type: "oxylabs-page-handle" }, "*")` via `page.evaluate`:
  the browser acknowledges with `identifying`, identifies the page again and handles what it finds. Clear the
  stored status before posting (the request is only queued, so the earlier `open` is still stored when the
  wait starts), then wait for the next terminal status; `open` without a `closed` in between means no
  supported challenge was found (section 6, "Trigger challenge handling manually").
- If a challenge **never renders** (blank frame, `open` without a `closed` although the page looks challenged),
  resource blocking is the usual cause: the `scripts/` templates abort `image`, `stylesheet`, `media` and
  `font` requests by default. Disable that blocking for this target only and retry once.

## 5. With identities and profiles

- The parameter set is one identity. If the target needs challenge handling, `page_handler=true` goes on the
  setup run **and** every consumer run, identically:

```text
setup, exactly once :  ?o_profile=acme-us-01&o_profile_save=true&p_cc=US&proxy_resi_ses_id=acmeus01&proxy_resi_ses_time=30&page_handler=true
consumers, any number:  ?o_profile=acme-us-01&p_cc=US&proxy_resi_ses_id=acmeus01&proxy_resi_ses_time=30&page_handler=true
```

- The setup run loads the entry page, waits for the page to be `open`, verifies the real page rendered (not a
  block page), then closes so the cookies are written (section 6, "Profile setup with challenge handling").
- A profile that starts drawing challenges on consumer runs is stale. Do not re-save it from a consumer; run
  setup again under a new profile name and a new sticky id.
- Use the browser's default context (`browser.contexts()[0]`) so the site's cookies are actually stored.

## 6. Code

All snippets build on `scripts/playwright_scrape.js` (Python: `scripts/playwright_scrape.py`): `endpointUrl`,
`connectWithBackoff`, `blockHeavyResources`, `watchOxylabsErrors`, `watchPageStatus`, `waitForPageStatus`,
`clearPageStatus` and `scrape` are the helpers from there. Credentials and the `wss://USERNAME:PASSWORD@hb.oxylabs.io` endpoint are
handled there.

### Page status watcher (what the templates ship)

```javascript
// With page_handler=true every page reports its state as a window message
// { source: "oxylabs-runtime", type: "oxylabs-page-status", status, error? }, status one of
// identifying | closed (challenge being handled) | open (page usable) | failed (with error). The last message wins.
// An init script keeps the latest one on window.__oxyPageStatus; install it before the page exists.
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

// Resolves once the page is open (about 8 s after load without a challenge; a widget challenge: 30 to 45 s);
// throws on failed. identifying and closed are transient. Playwright re-runs the predicate after a navigation.
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
  if (terminal.status === "failed") throw new Error(`CHALLENGE_HANDLING_ERROR: ${terminal.error}`); // section 3
  return terminal; // { status: "open", challenged: true | false }
}

// Before a manual trigger (section 4): the earlier `open` must not satisfy the next wait.
async function clearPageStatus(page) {
  await page.evaluate(() => { window.__oxyPageStatus = null; });
}

// Inside scrape():
//   await watchPageStatus(context);            // before context.newPage()
//   const page = await context.newPage();
//   await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
//   await page.waitForTimeout(2000 + Math.random() * 3000);
//   if (params.page_handler === "true") await waitForPageStatus(page); // no status without page_handler
```

```python
from playwright.sync_api import TimeoutError as PlaywrightTimeout

PAGE_STATUS_INIT_SCRIPT = """
window.addEventListener("message", (e) => {
  const d = e.data;
  if (d?.source !== "oxylabs-runtime" || d.type !== "oxylabs-page-status") return;
  const prev = window.__oxyPageStatus;
  window.__oxyPageStatus = {
    status: d.status,
    error: d.error,
    challenged: d.status === "closed" || (d.status !== "identifying" && prev?.challenged === true),
  };
});
"""
TERMINAL_PAGE_STATUS = """() => {
  const s = window.__oxyPageStatus;
  return s && s.status !== "identifying" && s.status !== "closed" ? s : null;
}"""


def watch_page_status(context):
    context.add_init_script(PAGE_STATUS_INIT_SCRIPT)


def wait_for_page_status(page, timeout=90.0):
    try:
        handle = page.wait_for_function(TERMINAL_PAGE_STATUS, timeout=timeout * 1000, polling=500)
    except PlaywrightTimeout:
        raise RuntimeError("CHALLENGE_HANDLING_TIMEOUT") from None
    s = handle.json_value()
    if s["status"] == "failed":
        raise RuntimeError(f"CHALLENGE_HANDLING_ERROR: {s.get('error')}")
    return s


def clear_page_status(page):
    page.evaluate("() => { window.__oxyPageStatus = null; }")

# Inside scrape(): watch_page_status(context) before context.new_page(); after the settle wait:
#   if params.get("page_handler") == "true": wait_for_page_status(page)
```

### Puppeteer and Python async

The same init script and wait, with each library's own calls:

```javascript
const browser = await connect({ p_cc: "US", page_handler: "true" }); // connect() from the Puppeteer example in examples.md
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.source === "oxylabs-runtime" && d.type === "oxylabs-page-status") window.__oxyPageStatus = { status: d.status, error: d.error };
  });
});
await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 30000 });
const terminal = await page.waitForFunction(
  () => { const s = window.__oxyPageStatus; return s && s.status !== "identifying" && s.status !== "closed" ? s : null; },
  { timeout: 90000, polling: 500 },
);
console.log("page status:", await terminal.jsonValue());
```

```python
browser = await connect(pw, {"p_cc": "US", "page_handler": "true"})  # connect() from the Python async example in examples.md
context = browser.contexts[0]
await context.add_init_script(PAGE_STATUS_INIT_SCRIPT)  # from the sync template above
page = await context.new_page()
await page.goto("https://example.com", wait_until="domcontentloaded", timeout=30_000)
handle = await page.wait_for_function(TERMINAL_PAGE_STATUS, timeout=90_000, polling=500)
print("page status:", await handle.json_value())
```

### Raw CDP

Install the listener with `Page.addScriptToEvaluateOnNewDocument` before navigating, then poll
`Runtime.evaluate` (the `send` helper and session setup are in the "Raw CDP over WebSocket" example in
`examples.md`; add `page_handler=true` to the connection URL). `Runtime.consoleAPICalled` never carries the
status line on the remote browser; do not wait for it.

```javascript
await send("Page.enable", {}, cdpSession);
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.source === "oxylabs-runtime" && d.type === "oxylabs-page-status") window.__oxyPageStatus = { status: d.status, error: d.error };
  });`,
}, cdpSession);
await send("Page.navigate", { url: "https://example.com" }, cdpSession);
const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500));
  const { result } = await send("Runtime.evaluate", { expression: "window.__oxyPageStatus", returnByValue: true }, cdpSession);
  const s = result.value;
  if (s && s.status !== "identifying" && s.status !== "closed") { console.log("page status:", s); break; }
}
```

### Trigger challenge handling manually

Challenges present at page load are handled on their own. When a challenge appears later (after a click or
form submit), post the handle message into the page and wait for the next terminal status: `open` once
handling ended (after a `closed`), `open` at once when no supported challenge was found, or `failed`. The
runtime acknowledges the message with `identifying` immediately, which replaces the page-load status.

```javascript
await clearPageStatus(page); // the earlier "open" must not satisfy the wait: postMessage only queues the request
await page.evaluate(() => window.postMessage({ type: "oxylabs-page-handle" }, "*"));
await waitForPageStatus(page); // resolves once the page is open again
```

In-page code gets the same status as a `window` message:

```javascript
window.addEventListener("message", (ev) => {
  if (ev.data?.source !== "oxylabs-runtime" || ev.data.type !== "oxylabs-page-status") return;
  // ev.data.status: identifying | closed | open | failed; ev.data.error only with failed
});
```

### Retry on a challenge handling error with a fresh identity

```javascript
async function scrapeWithChallengeHandling(targetUrl, params, maxIdentities = 3) {
  for (let attempt = 0; attempt < maxIdentities; attempt++) {
    const identity = { ...params, page_handler: "true" };
    if (params.proxy_resi_ses_id) identity.proxy_resi_ses_id = `${params.proxy_resi_ses_id}_${attempt}`;
    if (params.o_profile) identity.o_profile = `${params.o_profile}-${attempt}`; // new name, never re-save the stale one
    try {
      return await scrape(targetUrl, identity); // scrape() from scripts/playwright_scrape.js
    } catch (err) {
      if (!/CHALLENGE_HANDLING_(ERROR|TIMEOUT)/.test(err.message) || attempt === maxIdentities - 1) throw err;
      await new Promise((r) => setTimeout(r, 10000 * 2 ** attempt)); // 10 s, 20 s
    }
  }
}
```

### Profile setup with challenge handling

Same setup/consumer split as "Profile setup and consumer runs" in `examples.md`; challenge handling is on for
every connection of the identity because the plain attempt on this target showed a challenge.

```javascript
const identity = {
  o_profile: "acme-us-01", p_cc: "US", p_device: "desktop",
  proxy_resi_ses_id: "acmeus01", proxy_resi_ses_time: "30",
  page_handler: "true", // identical on setup and consumers
};

async function setupProfile(entryUrl) {
  const browser = await connectWithBackoff({ ...identity, o_profile_save: "true" });
  try {
    const context = browser.contexts()[0];
    await watchPageStatus(context);
    const page = await context.newPage();
    await page.goto(entryUrl, { waitUntil: "domcontentloaded" });
    try {
      await waitForPageStatus(page);
    } catch (err) {
      throw new Error(`setup failed: ${err.message}, pick a new profile name`);
    }
    const html = await page.content();
    if (/access denied|verify you are human/i.test(html)) throw new Error("setup failed: block page, pick a new profile name and sticky id");
    if (!(await page.title())) throw new Error("setup failed: still challenged, pick a new profile name");
    // ... accept cookie consent or set site preferences here if the target needs it ...
  } finally {
    await browser.close(); // closing writes the profile
  }
}

await setupProfile("https://target.example/");
await scrape("https://target.example/listing/1", identity); // consumers: o_profile without o_profile_save
```

*This content is not intended to provide legal advice, and scraping activities may be subject to applicable laws and regulations.*
