---
name: oxylabs-headless-browser
description: Connects to Oxylabs remote headless browsers via Chrome DevTools Protocol (CDP) using Playwright or Puppeteer. Provides anti-detection, CAPTCHA handling, residential proxies, and geo-targeting built in. Use when browser automation needs remote execution, stealth capabilities, rendered pages, screenshots, PDFs, or complex JavaScript interaction.
---

# Oxylabs Headless Browser

Remote headless browser service with built-in anti-detection and proxy integration. Chrome supports Playwright, Puppeteer, and any CDP-compatible library. Firefox is legacy and uses Playwright's Firefox connection API.

## Environment Variables

Prefer `OXY_UNBLOCKER_USERNAME` and `OXY_UNBLOCKER_PASSWORD` for Headless Browser credentials. `OXY_HB_USERNAME` and `OXY_HB_PASSWORD` are supported aliases in older setups.

## Connection URLs

| Browser | Global endpoint | US endpoint |
|---------|-----------------|-------------|
| Chrome | `wss://USERNAME:PASSWORD@ubc.oxylabs.io` | `wss://USERNAME:PASSWORD@ubc-us.oxylabs.io` |
| Firefox (legacy) | `wss://USERNAME:PASSWORD@ubs.oxylabs.io` | `wss://USERNAME:PASSWORD@ubs-us.oxylabs.io` |

## Browser Types

| Type | Best For | Notes |
|------|----------|-------|
| **Chrome** | High performance, dedicated servers, residential proxies | Use `chromium.connect_over_cdp` / `connectOverCDP` |
| **Firefox (legacy)** | Alternative engine for targets that perform better outside Chrome | Use `firefox.connect`; supported Playwright versions are 1.51 and 1.56 via `?o_pw=1.56` |

## Quick Start

**Playwright (Python):**
```python
from playwright.sync_api import sync_playwright
import os

username = os.environ.get("OXY_UNBLOCKER_USERNAME") or os.environ["OXY_HB_USERNAME"]
password = os.environ.get("OXY_UNBLOCKER_PASSWORD") or os.environ["OXY_HB_PASSWORD"]
endpoint = "ubc.oxylabs.io"

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(
        f"wss://{username}:{password}@{endpoint}"
    )
    page = browser.new_page()
    page.goto("https://example.com")
    print(page.content())
    browser.close()
```

**Playwright (JavaScript):**
```javascript
const { chromium } = require("playwright");

const username = process.env.OXY_UNBLOCKER_USERNAME || process.env.OXY_HB_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD || process.env.OXY_HB_PASSWORD;
const endpoint = "ubc.oxylabs.io";

(async () => {
  const browser = await chromium.connectOverCDP(
    `wss://${username}:${password}@${endpoint}`
  );
  const page = await browser.newPage();
  await page.goto("https://example.com");
  console.log(await page.content());
  await browser.close();
})();
```

**Puppeteer:**
```javascript
const puppeteer = require("puppeteer");

const username = process.env.OXY_UNBLOCKER_USERNAME || process.env.OXY_HB_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD || process.env.OXY_HB_PASSWORD;
const endpoint = "ubc.oxylabs.io";

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://${username}:${password}@${endpoint}`
  });
  const page = await browser.newPage();
  await page.goto("https://example.com");
  console.log(await page.content());
  await browser.close();
})();
```

## Rate Limits

- **Concurrent sessions:** 100 per browser type
- **Launch rate:** up to 10 sessions per second per browser type
- **Higher limits:** Available upon request to support

## Features

- **Anti-detection:** Built-in fingerprint management
- **Residential proxies:** Automatic proxy rotation
- **Geo-targeting:** Country, city, and US state targeting via connection parameters
- **US endpoints:** Lower latency for US-based users; not the same as proxy geolocation
- **CAPTCHA handling:** Automatic load-time solving; manual trigger available with `window.postMessage({action: 'solve_captcha', type: '<captcha type>'}, '*')`
- **Session inspection:** Enable VNC debugging with `o_vnc=true`
- **No local browsers:** All execution happens remotely

## Connection Parameters

Append query parameters to the WebSocket URL:

| Parameter | Browser | Description |
|-----------|---------|-------------|
| `p_cc=US` | Chrome, Firefox | Route traffic through a 2-letter country code |
| `p_city=los_angeles` | Chrome, Firefox | Target a city; combine with `p_cc` or `p_state` |
| `p_state=texas` | Chrome, Firefox | Target a US state; takes priority over `p_cc` |
| `p_device=mobile` | Chrome | Emulate `desktop`, `mobile`, or `tablet` device fingerprints |
| `o_vnc=true` | Chrome, Firefox | Enable Session Inspection for visual debugging |
| `o_pw=1.56` | Firefox | Select supported Firefox Playwright version `1.51` or `1.56` |
| `bargs=disable-notifications` | Chrome | Pass supported Chrome browser arguments |

Supported Chrome `bargs` values: `force-color-profile:<profile>`, `window-position:X,Y`, `hide-scrollbars`, `enable-features:<feature1>,<feature2>`, `disable-notifications`.

Repeat `bargs` for multiple browser arguments, e.g., `?bargs=force-color-profile:srgb&bargs=window-position:100,100`. `p_city` requires `p_cc` or `p_state`; `p_state` overrides `p_cc`.

## CAPTCHA Handling

- Listen for `oxylabs-captcha-solve-start`, `oxylabs-captcha-solve-end`, and `oxylabs-captcha-solve-error` window messages.
- Register CAPTCHA listeners before navigation when possible so page-load challenges are captured.
- For CAPTCHAs shown after page load, trigger solving with `window.postMessage({action: 'solve_captcha', type: '<captcha type>'}, '*')`.
- Supported manual CAPTCHA types: `hcaptcha`, `recaptcha`, `turnstile`.

## When to Use

| Scenario | Use Headless Browser |
|----------|------------------------|
| Complex JavaScript sites | Yes |
| Anti-bot protected sites | Yes |
| Browser automation with stealth | Yes |
| Screenshot/PDF generation | Yes |
| Simple HTML scraping | Consider Web Scraper API instead |

## Supported Libraries

Any library supporting Chrome DevTools Protocol (CDP):
- Playwright (recommended)
- Puppeteer
- Selenium with CDP
- Custom CDP implementations

Firefox is legacy and should use Playwright `firefox.connect` with supported Playwright versions 1.51 or 1.56.

For more examples, see [examples.md](examples.md).
