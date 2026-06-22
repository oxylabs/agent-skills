---
name: oxylabs-headless-browser
description: Connects to Oxylabs remote headless browsers via Chrome DevTools Protocol (CDP) using Playwright or Puppeteer. Provides anti-detection, CAPTCHA handling, residential proxies, and geo-targeting built in. Use when browser automation needs remote execution, stealth capabilities, rendered pages, screenshots, PDFs, or complex JavaScript interaction.
---

# Oxylabs Headless Browser

Remote headless browser service with built-in anti-detection and proxy integration. Supports Playwright, Puppeteer, and any CDP-compatible library.

## Authentication

Use Headless Browser credentials from environment variables:

| Variable | Description |
|----------|-------------|
| `OXY_UNBLOCKER_USERNAME` | Headless Browser username |
| `OXY_UNBLOCKER_PASSWORD` | Headless Browser password |

Docs may also refer to `OXY_HB_USERNAME` and `OXY_HB_PASSWORD`; treat them as compatible aliases when the canonical variables are not set.

## Connection URLs

```
wss://USERNAME:PASSWORD@ubc.oxylabs.io
```

| Browser | Global endpoint | US-based endpoint |
|---------|-----------------|-------------------|
| Chrome | `wss://ubc.oxylabs.io` | `wss://ubc-us.oxylabs.io` |
| Firefox (legacy) | `wss://ubs.oxylabs.io` | `wss://ubs-us.oxylabs.io` |

## Browser Types

| Type | Best For |
|------|----------|
| **Chrome** | Fast, stable sessions; CDP; device emulation; browser arguments |
| **Firefox (legacy)** | Alternative browser engine when Chrome has lower success |

## Quick Start

**Playwright (Python):**
```python
from playwright.sync_api import sync_playwright
import os

username = os.environ["OXY_UNBLOCKER_USERNAME"]
password = os.environ["OXY_UNBLOCKER_PASSWORD"]

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(
        f"wss://{username}:{password}@ubc.oxylabs.io"
    )
    page = browser.new_page()
    page.goto("https://example.com")
    print(page.content())
    browser.close()
```

**Playwright (JavaScript):**
```javascript
const { chromium } = require("playwright");

const username = process.env.OXY_UNBLOCKER_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD;

(async () => {
  const browser = await chromium.connectOverCDP(
    `wss://${username}:${password}@ubc.oxylabs.io`
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

const username = process.env.OXY_UNBLOCKER_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD;

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://${username}:${password}@ubc.oxylabs.io`
  });
  const page = await browser.newPage();
  await page.goto("https://example.com");
  console.log(await page.content());
  await browser.close();
})();
```

## Rate Limits

- **Concurrent sessions:** 100 per browser type
- **Launch rate:** 10 sessions per second per browser type
- **Higher limits:** Available upon request to support

## Features

- **Anti-detection:** Built-in fingerprint management
- **CAPTCHA handling:** Automatic CAPTCHA detection and solving on page load
- **Residential proxies:** Automatic proxy rotation
- **Geo-targeting:** Country, city, and US state targeting via connection parameters
- **US optimization:** US entrypoints for shorter response times when running near US targets
- **Session inspection:** Add `o_vnc=true` to debug through the visual inspection tool
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

For more examples, see [examples.md](examples.md).
