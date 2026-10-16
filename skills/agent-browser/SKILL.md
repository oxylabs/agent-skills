---
name: agent-browser
description: Connects to Oxylabs remote agent browsers over the Chrome DevTools Protocol (CDP) with Playwright or Puppeteer. Managed browser environment, residential proxies, geo-targeting, persistent sessions and profiles, session recording and live VNC inspection for debugging. Use instead of WebFetch or a local browser whenever a site renders with JavaScript, serves access challenges, verification interstitials or bot-management block pages, or needs a full browser session, screenshots or PDFs. Covers connection, retries, error recovery, built-in challenge handling (the page_handler parameter, the oxylabs-page-status page state reported by the page handler, manual triggering), telling a handled challenge from a block that needs a fresh identity, and reliable access to publicly available data without manual intervention.
---

# Oxylabs Agent Browser

Remote Chrome sessions in a managed browser environment with proxy rotation and geo-targeting built in.
Nothing runs locally: you connect over a WebSocket, drive the browser with the CDP library you already
use, and close the session when done. This file holds the rules; the detail lives next to it:
`scripts/` (copyable templates), `parameters.md`, `errors.md`, `examples.md`, `targets.md`, `challenges.md`.

## 1. Connect

| Item | Value |
|------|-------|
| Endpoint | `wss://USERNAME:PASSWORD@hb.oxylabs.io` |
| Credentials | `OXY_AB_USERNAME` / `OXY_AB_PASSWORD` |
| Options | URL query parameters only, e.g. `?p_cc=US&session_name=job-42` (see `parameters.md`) |
| Browser engine | Default engine with the `oxyfp_win` browser profile; `p_src=oxybrowser` selects the new engine (see `parameters.md`) |
| Libraries | Playwright `chromium.connectOverCDP` (recommended), Puppeteer `puppeteer.connect`, any CDP client |
| Dashboard / support | `https://hb.oxylabs.io/dashboard` · `support@oxylabs.io` |

Rules that prevent the most common `401`:

- Use `wss://`. Plain `ws://` is accepted but sends your password unencrypted.
- Build the URL by string concatenation with the **raw** password. Do not pass the finished URL through
  `new URL()` or `urllib.parse`: they percent-encode the password and authentication fails.
- Use the full username exactly as shown in the dashboard, including any suffix such as `_ab12`.
- A password containing `:` cannot be sent in the URL. Ask for a new password or send the
  `Authorization: Basic` header yourself (see `examples.md`).
- Authentication is checked before parameters: fix a `401` before looking at anything else.

## 2. Quick start

Minimal shape (Playwright, JavaScript):

```javascript
const { chromium } = require("playwright");
const url = `wss://${process.env.OXY_AB_USERNAME}:${process.env.OXY_AB_PASSWORD}@hb.oxylabs.io?p_cc=US`;
const browser = await chromium.connectOverCDP(url, { timeout: 60000 });
try {
  const page = await browser.contexts()[0].newPage(); // default context: backed by the device configuration, proxy, o_profile
  await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log(await page.content());
} finally {
  await browser.close(); // always: an unclosed session keeps its concurrency slot
}
```

For real work copy `scripts/playwright_scrape.js` or `scripts/playwright_scrape.py` whole instead of
reimplementing. They add the six behaviours everything else in this file assumes:

- **Connect with backoff** (1 s base, 60 s cap, jitter, 6 attempts) only on retryable errors: `429`, `5xx`,
  `CDP_SESSION_IN_USE`, `CDP_NO_BROWSERS_AVAILABLE`, `CDP_BROWSER_OVERWORKED`, `CDP_BAD_PROXY`,
  `CDP_GENERAL_ERROR`, timeouts. `400`/`401`/`403` mean the request is wrong: fix, never retry unchanged.
- **Redact the password** from every error message before logging; Playwright embeds the connection URL in it.
- **Block `image`, `stylesheet`, `media`, `font`** by default; they cost time and are not needed for data extraction.
- **Register listeners before navigating**: the `X-Error-Description` response header marks an Oxylabs-side
  error on page traffic.
- **Wait for the page status** (the `oxylabs-page-status` `window` message, kept on the page by an init script;
  `status` `open` or `failed`, `identifying` and `closed` are transient) when `page_handler=true`, up to 90 s; a
  connection sends `page_handler=false` until a target shows a challenge. The remote browser does not deliver
  console output live, so never wait on `page.on("console")`.
- **`browser.close()` in `finally`**, and wrap the job in an overall deadline so a wedged session still gets there.

Puppeteer, Python async, raw CDP, session hand-over, profiles, recording and fan-out: `examples.md`.

## 3. Sessions and limits

| Limit (account defaults) | Value | When exceeded |
|--------------------------|-------|---------------|
| New sessions per second | 10 | `429 CDP_SESSION_RATE_LIMIT_REACHED` (space launches >= 150 ms) |
| Concurrent sessions | 100 | `429 CDP_MAX_CONCURRENT_SESSIONS_REACHED` |
| Named (resumable) sessions | 5 | `429 CDP_MAX_PERSISTENT_SESSIONS_REACHED` |
| Stored profiles (`o_profile`) | 5 | `403 profile limit reached (5 profiles maximum)` |
| Recordings | 10 | `403 recording limit reached (10 recordings maximum)` |
| Concurrent inspection viewers | 10 | `CDP_VNC_MAX_CONCURRENT_SESSIONS_REACHED` |

- `session_name` (`^[A-Za-z0-9-]{3,36}$`) makes a session resumable for **10 minutes** after disconnect.
  `keep_alive` is implied by it; **never send `keep_alive=true` alone** (`400 keep_alive requires session_name`).
- Reconnecting while the old connection is still attached returns `429 CDP_SESSION_IN_USE`: close it first.
- Any session lives at most **1 hour**. Plan long jobs as several sessions.
- An abandoned session keeps its concurrency slot (about 20 s, or the full 10 min when named) and surfaces later
  as an unrelated `429 CDP_MAX_CONCURRENT_SESSIONS_REACHED`. Closing the Playwright/Puppeteer object is enough.
- `browser.close()` wipes open pages and cookies even though a named session stays resumable. To hand a session
  over use Puppeteer `browser.disconnect()` (see `examples.md`, "Resume a named session"). State that must
  outlive a session (cookie consent, site preferences, a cart) belongs in `o_profile`, not keep-alive.
- Every distinct parameter combination is provisioned separately: keep the set stable across a job.
- Under load a connection may queue and end with `503 queue timeout` after about a minute: back off and retry.
  Higher limits via support.

## 4. Errors

Three channels. **Handshake**: HTTP status plus a short body (Playwright: `WebSocket error: <URL with password>
<status>` then the body; Puppeteer: `Unexpected server response: <status>`). **Post-connect**: the WebSocket closes
with code `3000` and a `CDP_*` reason that only raw clients see; Playwright/Puppeteer just report `Target closed`,
so treat any disconnect in the first seconds of a session as retryable. **In-page**: CDP error `1337` for one
refused command. On page traffic, a response **with** `X-Error-Description` is an Oxylabs network error (retry);
a block page **without** it is the target's decision (change approach, do not retry).

```text
connect failed?
  ├─ 401 ............ fix credentials/scheme, do not retry
  ├─ 400/403/409 .... fix the named parameter, do not retry unchanged (409: wait 30 s+ for the other session)
  ├─ 429 ............ backoff; if MAX_CONCURRENT: hunt for unclosed sessions
  └─ 5xx/503 ........ backoff, up to ~2 min total
session dropped (close 3000)?
  └─ new session with backoff; rotate sticky id on CDP_BAD_PROXY
navigate failed with 1337 Invalid target?
  └─ stop; restricted target (section 8)
page shows block / 403 wall?
  ├─ X-Error-Description present .... Oxylabs network issue: backoff + retry
  ├─ block or verification page ..... reconnect with page_handler=true; the page handler reports the page state (section 6)
  └─ handler says failed, or open on a block page ... target decision: change identity, geo, device, pacing (section 5)
```

Every message text with cause and fix: `errors.md`.

## 5. Reliable access on sites with bot management

**Default parameter set for most jobs: `p_cc` and an explicit `page_handler=false`, nothing else.** Every session already gets a fresh browser
configuration and a fresh residential IP, which is what one-shot fetches and fan-outs of independent pages need.
Sticky IPs and stored profiles are opt-in tools for a specific need, never a baseline. The browser engine (`p_src`) and
browser profile family (`p_fp_tag`, default `oxyfp_win`) are escalation tools: leave them at their defaults until a
target blocks the plain script.

**Work order for a site with bot management.** First write a plain script and make it pass: one fresh session per
page, the right geo and device, moderate pacing, then the escalation ladder below. Only when that script still
fails after the ladder do you **recommend persistent profiles to the user** (the setup/consumer pattern below,
with why it should help and what it costs: a setup step, the profile cap of 5) and implement them only on their
go-ahead. Never add a profile or sticky id on your own initiative.

| Need | Add | Not for |
|------|-----|---------|
| Several connections must share one exit IP and cookie set (a cart, a multi-page flow that outlives one session) | `proxy_resi_ses_id` + `proxy_resi_ses_time` | one page per session |
| Cookies must survive between jobs (the cookie a site sets once its challenge completes, cookie consent, site preferences) | `o_profile`, prepared once by a setup run, after the user agreed | a first attempt; targets that serve without a block |
| Resume the same browser within 10 minutes | `session_name` | everything else |
| The target still blocks a fresh identity with the right geo | `p_src=oxybrowser` + `p_fp_tag=oxyfp_mac_optimized` (desktop only) | a first attempt; sites that serve without a block |

When you do use them, the combination is one identity. Keep it consistent:

```text
setup, exactly once :  ?o_profile=acme-us-01&o_profile_save=true&p_cc=US&proxy_resi_ses_id=acmeus01&proxy_resi_ses_time=30
consumers, any number:  ?o_profile=acme-us-01&p_cc=US&proxy_resi_ses_id=acmeus01&proxy_resi_ses_time=30
```

- **A profile is written by one run and read by the others.** The setup run is the only connection that ever sends
  `o_profile_save=true`: it loads the entry page, lets the site set its cookies (challenge completion, consent,
  preferences), verifies the page, closes. Consumer runs send `o_profile=<name>` alone: read-only, no write lock,
  no `409`. Never "top up" a profile from a consumer; when it stops working, run setup again under a new name. In
  production this is a setup service that prepares and validates profiles and a consumer service that only uses
  them (`examples.md`, "Profile setup and consumer runs").
- `proxy_resi_ses_id` + `proxy_resi_ses_time` pin the exit IP (max 1440 min). A pinned id disables automatic
  proxy retry: on `CDP_BAD_PROXY` rotate to a new id.
- **Never change `p_cc`/`p_city`/`p_state`, `p_src` or `p_fp_tag` for an identity** that has cookies. Start a new profile
  and sticky id.
- Match interaction to `p_device`: `mobile` = taps, small scrolls, no hover; `desktop` (default) = the opposite.
  Never set viewport or device metrics yourself; the service owns the device configuration.
- Pace requests: 3 to 8 s between page loads, scroll before clicking, one page at a time per identity.
  Run parallel identities, not parallel tabs.
- Escalation when blocked, one rung per fresh connection: let the page handler try with `page_handler=true` (section 6)
  → fresh session → broader geo (drop `p_city`) →
  new browser engine (`p_src=oxybrowser&p_fp_tag=oxyfp_mac_optimized`, keep `p_device=desktop`) → `p_device=mobile`
  (back on the default engine) → slow down → inspect (section 7) → recommend persistent profiles to the user → stop
  and report. Repeating an identical request is never a rung.

Block detection with the page handler, do/don't table and starting values for a new site with bot management: `targets.md`.

## 6. Challenge handling

Built into the remote browser as the **page handler**: one parameter, no extra code beyond the page state watcher
the templates already carry. It identifies every page, completes the access challenges it finds and reports the
page state. Rules, late-appearing challenges, profiles and code: `challenges.md`.

- **Start every target with `page_handler=false`**, passed explicitly. Switch to `page_handler=true` on a
  **fresh connection** as soon as the plain attempt shows a block or verification page instead of the expected
  content, then keep it identical on every connection to that target.
- The page handler is the detector (`targets.md` section 1). Its result is a `window` message per page,
  `{ source: "oxylabs-runtime", type: "oxylabs-page-status", status, error? }`, `status` one of `identifying`
  (checking), `closed` (a challenge was found and is being handled), `open` (the page is usable: about 8 s after
  load without a challenge, or once handled, typically 30 to 45 s), `failed` (with `error`). Install the init
  script before the page exists, wait up to 90 s for `open` or `failed`, continue from whatever the page shows
  after it.
- `closed` then `open` means a challenge was handled; `failed` always follows a `closed`. `failed`, or `open` while
  the page is still a block page, means the handler cannot clear this block: it is the site's decision about this
  visitor, go to a fresh identity (section 5). A challenge that appears after the first `open` closes the page
  again (`closed`, then `open` or `failed`), so keep the watcher installed and re-read the stored status before
  trusting a page whose content changed.
- On `failed`: close, back off 10 s doubling, reconnect as a fresh identity with `page_handler=true`
  still on, at most 2 more attempts, then stop and report with every status line and timestamp.
- A challenge that appears after a click or form submit is triggered from the page with
  `window.postMessage({ type: "oxylabs-page-handle" }, "*")` (acknowledged with `identifying`), then wait for the
  page to be `open` again (`open` without a `closed` means no supported challenge was found). A challenge that never renders is usually
  resource blocking: allow images, styles and fonts for that target and retry once.
- With profiles, `page_handler=true` goes on the setup run and every consumer run identically.

## 7. Operational hygiene

- **Debugging.** Two tools exist, and whenever the user asks how to debug, what the browser is doing, or why a run
  fails, tell them about both: **live inspection** (fetch the session id with the CDP command `__session_id`, open
  `https://hb.oxylabs.io/novnc/?id=<id>` and watch the session as it runs) and **recordings** (`record=true&
  record_name=<job>` saves a video of the session to replay later in `https://hb.oxylabs.io/dashboard`; cap 10,
  delete old ones there). Both are off by default. Use them yourself after **3 consecutive failures on one
  target** to confirm what the page actually shows. Snippet in `examples.md`, "Session id, live inspection and
  recording".
- **Timeouts.** Connect 60 s, navigation 30 s, plus an overall job deadline.
- **Logging.** Never log the connection URL or a raw error message; log the parameter set and session id.
- **Contexts.** Use `browser.contexts()[0]`. A `newContext()` is isolated from profile storage and the device configuration.

## 8. Restricted targets

Not available by default; access requires a short KYC via your account manager: entertainment and streaming,
banking and finance, government sites, gaming platforms, ticketing, webmail, ad networks, third-party IP
checkers. Use `https://ip.oxylabs.io/location` to verify your exit IP and geo. A restricted target fails
`Page.navigate` with CDP error `1337 Invalid target`.

See also: `scripts/` (full Playwright templates, JS and Python), `parameters.md` (every parameter and its
validation), `errors.md` (every message), `examples.md` (Puppeteer, Python async, raw CDP, reconnection,
profiles, recording, fan-out), `targets.md` (block detection with the page handler, escalation ladder), `challenges.md` (challenge handling
rules and code).

*This content is not intended to provide legal advice, and scraping activities may be subject to applicable laws and regulations.*
