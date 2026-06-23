# Headless Browser Code Examples

Examples prefer `OXY_UNBLOCKER_USERNAME` and `OXY_UNBLOCKER_PASSWORD`. `OXY_HB_USERNAME` and `OXY_HB_PASSWORD` are accepted aliases for older local setups.

## Playwright (Python)

**Basic usage:**
```python
from playwright.sync_api import sync_playwright
import os

username = os.environ["OXY_UNBLOCKER_USERNAME"]
password = os.environ["OXY_UNBLOCKER_PASSWORD"]
browser_url = f"wss://{username}:{password}@ubc.oxylabs.io"

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(browser_url)
    page = browser.new_page()
    page.goto("https://example.com")
    print(page.title())
    browser.close()
```

**Async version:**
```python
import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    username = os.environ["OXY_UNBLOCKER_USERNAME"]
    password = os.environ["OXY_UNBLOCKER_PASSWORD"]
    browser_url = f"wss://{username}:{password}@ubc.oxylabs.io"

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(browser_url)
        page = await browser.new_page()
        await page.goto("https://example.com")

        # Take screenshot
        await page.screenshot(path="screenshot.png")

        # Get page content
        content = await page.content()
        print(content)

        await browser.close()

asyncio.run(main())
```

**With interactions:**
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

    # Navigate
    page.goto("https://example.com/search")

    # Fill form
    page.fill('input[name="q"]', "search query")

    # Click button
    page.click('button[type="submit"]')

    # Wait for results
    page.wait_for_selector(".results")

    # Extract data
    results = page.query_selector_all(".result-item")
    for result in results:
        print(result.text_content())

    browser.close()
```

## Playwright (JavaScript)

**Basic usage:**
```javascript
const { chromium } = require("playwright");

const username = process.env.OXY_UNBLOCKER_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD;

(async () => {
  const browser = await chromium.connectOverCDP(
    `wss://${username}:${password}@ubc.oxylabs.io`
  );

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://example.com");
  console.log(await page.title());

  await browser.close();
})();
```

**With screenshot and PDF:**
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

  // Screenshot
  await page.screenshot({ path: "page.png", fullPage: true });

  // PDF
  await page.pdf({ path: "page.pdf", format: "A4" });

  await browser.close();
})();
```

**With data extraction:**
```javascript
const { chromium } = require("playwright");

const username = process.env.OXY_UNBLOCKER_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD;

(async () => {
  const browser = await chromium.connectOverCDP(
    `wss://${username}:${password}@ubc.oxylabs.io`
  );

  const page = await browser.newPage();
  await page.goto("https://example.com/products");

  // Wait for content
  await page.waitForSelector(".product");

  // Extract data
  const products = await page.$$eval(".product", items =>
    items.map(item => ({
      title: item.querySelector(".title")?.textContent,
      price: item.querySelector(".price")?.textContent,
      url: item.querySelector("a")?.href
    }))
  );

  console.log(JSON.stringify(products, null, 2));
  await browser.close();
})();
```

## Puppeteer

**Basic usage:**
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

  const title = await page.title();
  console.log(title);

  await browser.close();
})();
```

**With viewport and user agent:**
```javascript
const puppeteer = require("puppeteer");

const username = process.env.OXY_UNBLOCKER_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD;

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://${username}:${password}@ubc.oxylabs.io`
  });

  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto("https://example.com");

  // Screenshot
  await page.screenshot({ path: "screenshot.png" });

  await browser.close();
})();
```

**Handling dynamic content:**
```javascript
const puppeteer = require("puppeteer");

const username = process.env.OXY_UNBLOCKER_USERNAME;
const password = process.env.OXY_UNBLOCKER_PASSWORD;

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://${username}:${password}@ubc.oxylabs.io`
  });

  const page = await browser.newPage();
  await page.goto("https://example.com/infinite-scroll");

  // Scroll to load more content
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);
  }

  // Extract all loaded content
  const content = await page.content();
  console.log(content);

  await browser.close();
})();
```

## Firefox Browser (Legacy)

Try Firefox when a target performs better outside Chrome. Use the `ubs.oxylabs.io` endpoint and Playwright 1.51 or 1.56.

**Playwright with Firefox:**
```python
from playwright.sync_api import sync_playwright
import os

username = os.environ["OXY_UNBLOCKER_USERNAME"]
password = os.environ["OXY_UNBLOCKER_PASSWORD"]
endpoint = "ubs.oxylabs.io"
browser_url = f"wss://{username}:{password}@{endpoint}?o_pw=1.56"

with sync_playwright() as p:
    browser = p.firefox.connect(browser_url, timeout=60000)
    page = browser.new_page()
    page.goto("https://example.com")
    print(page.content())
    browser.close()
```

## Error Handling

```python
from playwright.sync_api import sync_playwright, TimeoutError
import os

username = os.environ["OXY_UNBLOCKER_USERNAME"]
password = os.environ["OXY_UNBLOCKER_PASSWORD"]
browser = None

with sync_playwright() as p:
    try:
        browser = p.chromium.connect_over_cdp(
            f"wss://{username}:{password}@ubc.oxylabs.io"
        )
        page = browser.new_page()

        # Set timeout
        page.set_default_timeout(30000)

        page.goto("https://example.com")
        content = page.content()

    except TimeoutError:
        print("Page load timed out")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if browser:
            browser.close()
```
