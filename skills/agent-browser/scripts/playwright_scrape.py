import os, random, re, time
from playwright.sync_api import sync_playwright

USERNAME = os.environ.get("OXY_UNBLOCKER_USERNAME") or os.environ["OXY_HB_USERNAME"]
PASSWORD = os.environ.get("OXY_UNBLOCKER_PASSWORD") or os.environ["OXY_HB_PASSWORD"]
ENDPOINT = "hb.oxylabs.io"

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


def scrape(target_url, params):
    with sync_playwright() as pw:
        browser = connect_with_backoff(pw, params)
        try:
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            page = context.new_page()
            page.set_default_timeout(30_000)
            block_heavy_resources(page)
            watch_oxylabs_errors(page, lambda e: print("Oxylabs-side error:", e))

            page.goto(target_url, wait_until="domcontentloaded")
            page.wait_for_timeout(2000 + random.random() * 3000)  # let late JS settle

            return page.content()
        finally:
            browser.close()  # always


if __name__ == "__main__":
    print(len(scrape("https://example.com", {"p_cc": "US"})), "bytes")
