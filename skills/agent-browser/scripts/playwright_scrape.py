import os, random, re, time
from playwright.sync_api import TimeoutError as PlaywrightTimeout, sync_playwright

USERNAME = os.environ["OXY_AB_USERNAME"]
PASSWORD = os.environ["OXY_AB_PASSWORD"]
ENDPOINT = "hb.oxylabs.io"

# Connection parameters (parameters.md). Most jobs need only p_cc plus an explicit page_handler=false: every session
# already gets a fresh browser configuration (default engine, Windows profile family oxyfp_win) and a fresh residential IP.
PARAMS = {"p_cc": "US", "page_handler": "false"}
# Block or verification page instead of the expected content? Reconnect with this; the page handler then
# identifies every page and reports its state (challenges.md):
CHALLENGE_ESCALATION = {"page_handler": "true"}
# Escalation when a fresh identity with the right geo is still blocked (targets.md, section 4, rung 4):
# the new browser engine with its macOS profile family. Desktop only; keep the pair for every later connection.
ENGINE_ESCALATION = {"p_src": "oxybrowser", "p_fp_tag": "oxyfp_mac_optimized"}

# Error messages contain the connection URL, i.e. the password. Redact before logging anything.
redact = lambda text: str(text).replace(PASSWORD, "***")  # noqa: E731

# Retry only what the service can recover from. 400/401/403 mean the request is wrong: fix, don't retry.
RETRYABLE = re.compile(
    r"\b(429|50[0234]) [A-Z]|response: (429|50[0234])\b|CDP_SESSION_IN_USE|CDP_NO_BROWSERS_AVAILABLE|"
    r"CDP_BROWSER_OVERWORKED|CDP_BAD_PROXY|CDP_GENERAL_ERROR|[Tt]imeout|ECONNRESET")


def endpoint_url(params=None):
    # Concatenate with the raw password; do not urlencode or parse the full URL.
    q = "&".join(f"{k}={v}" for k, v in (params or {}).items())
    return f"wss://{USERNAME}:{PASSWORD}@{ENDPOINT}" + (f"?{q}" if q else "")


def connect_with_backoff(pw, params, attempts=6, base=1.0, cap=60.0):
    """Exponential backoff, 1s base, 60s cap, full jitter. Never retries 400/401/403."""
    last = None
    for attempt in range(attempts):
        try:
            return pw.chromium.connect_over_cdp(endpoint_url(params), timeout=60_000)
        except Exception as err:  # noqa: BLE001
            last = err
            if not RETRYABLE.search(str(err)):
                raise
            print(f"connect attempt {attempt + 1} failed: {redact(err).splitlines()[0]}")
            time.sleep(min(cap, base * 2 ** attempt) * (0.5 + random.random()))
    raise last


def block_heavy_resources(page):
    page.route("**/*", lambda route: route.abort()
               if route.request.resource_type in {"image", "stylesheet", "media", "font"}
               else route.continue_())


def watch_oxylabs_errors(page, on_infra_error):
    def handler(resp):
        desc = resp.headers.get("x-error-description")
        if desc:
            on_infra_error({"status": resp.status, "url": resp.url, "description": desc})
    page.on("response", handler)


# With page_handler=true the browser reports each page's state as a window message
# { source: "oxylabs-runtime", type: "oxylabs-page-status", status, error? }, status one of identifying |
# closed (challenge being handled) | open (page usable) | failed (with error); the last message wins
# (challenges.md). The same status is also a console line, but the remote browser does not deliver console
# output live to CDP clients, so an init script keeps the latest status on every document instead.
PAGE_STATUS_INIT_SCRIPT = """
window.addEventListener("message", (e) => {
  const d = e.data;
  if (d?.source !== "oxylabs-runtime" || d.type !== "oxylabs-page-status") return;
  const prev = window.__oxyPageStatus;
  window.__oxyPageStatus = {
    status: d.status,
    error: d.error,
    challenged: d.status === "closed" || (d.status !== "identifying" && prev?.challenged === true), // a closed since the last identifying
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
    """Wait for the page to be open (about 8 s after load without a challenge; a widget challenge usually 30 to 45 s);
    raises on failed. identifying and closed are transient. Playwright re-runs the predicate after a navigation,
    so a challenge page that turns into the real page is followed."""
    try:
        handle = page.wait_for_function(TERMINAL_PAGE_STATUS, timeout=timeout * 1000, polling=500)
    except PlaywrightTimeout:
        raise RuntimeError("CHALLENGE_HANDLING_TIMEOUT") from None
    s = handle.json_value()
    if s["status"] == "failed":
        raise RuntimeError(f"CHALLENGE_HANDLING_ERROR: {s.get('error')}")  # challenges.md section 3: fresh identity, max 2 retries
    return s  # {"status": "open", "challenged": True | False}


def clear_page_status(page):
    """Before a manual trigger (challenges.md section 4): forget the stored status, so the earlier open cannot
    satisfy the next wait while the handle request is still queued."""
    page.evaluate("() => { window.__oxyPageStatus = null; }")


def scrape(target_url, params):
    with sync_playwright() as pw:
        browser = connect_with_backoff(pw, params)
        try:
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            watch_page_status(context)  # before the page exists, so a page-load challenge is captured
            page = context.new_page()
            page.set_default_timeout(30_000)
            block_heavy_resources(page)
            watch_oxylabs_errors(page, lambda e: print("Oxylabs-side error:", e))

            page.goto(target_url, wait_until="domcontentloaded")
            page.wait_for_timeout(2000 + random.random() * 3000)  # let late JS settle
            if params.get("page_handler") == "true":
                wait_for_page_status(page)  # the status only exists with page_handler=true

            return page.content()
        finally:
            browser.close()  # always


if __name__ == "__main__":
    print(len(scrape("https://example.com", PARAMS)), "bytes")
    # challenge? scrape(url, {**PARAMS, **CHALLENGE_ESCALATION}); blocked? scrape(url, {**PARAMS, **ENGINE_ESCALATION})

# This content is not intended to provide legal advice, and scraping activities may be subject to applicable laws and regulations.
