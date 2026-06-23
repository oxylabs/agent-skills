---
name: oxylabs-web-scraper
description: Production-grade web scraping with automatic anti-bot bypass, structured JSON parsing for 40+ targets, and geo-targeting. Use when the user needs to scrape web pages, extract product data, get search results, or collect structured data from supported e-commerce and search platforms without worrying about getting blocked and when geo targeting is required.
---

# Oxylabs Web Scraper API

## Authentication

Requires HTTP Basic Auth with credentials from environment variables:

```bash
curl -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" ...
```

## Endpoint

```
POST https://realtime.oxylabs.io/v1/queries   # immediate response
POST https://data.oxylabs.io/v1/queries       # Push-Pull jobs, callbacks, storage
Content-Type: application/json
```

## Core Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `source` | Yes | Target scraper (e.g., `universal`, `amazon_product`, `google_search`) |
| `url` | Conditional | URL to scrape (for `universal` and `*_url` sources) |
| `query` | Conditional | Search query or product ID (for `*_search` and `*_product` sources) |
| `parse` | No | Enable structured data parsing (recommended for supported sources) |
| `render` | No | JavaScript rendering: `html` or `png` |
| `geo_location` | No | Geographic targeting: country/state/city, ZIP/postcode, coordinates, or Criteria ID where supported |
| `session_id` | No | Reuse the same proxy IP across multiple jobs |
| `content_encoding` | No | Set to `base64` when downloading image files via Realtime or Push-Pull |
| `user_agent_type` | No | Device/browser preset, e.g., `desktop_chrome`, `mobile_ios`, `tablet_android` |
| `locale` | No | Interface language / `Accept-Language`, e.g., `de-DE` |
| `callback_url` | No | Push-Pull callback endpoint |
| `storage_type`, `storage_url` | No | Push-Pull cloud upload target (`gcs`, `s3`, `tos`, `s3_compatible`) |
| `markdown`, `xhr` | No | Enable markdown or captured XHR result types |
| `browser_instructions` | No | Rendered browser actions; requires `render: "html"` |
| `parsing_instructions`, `parser_preset` | No | Custom parser rules or saved preset; pair with `parse: true` |
| `client_notes` | No | Client-side job tag saved with the job metadata |
| `domain`, `subdomain`, `start_page`, `pages`, `limit`, `store_id`, `delivery_zip`, `fulfillment_type` | Source-specific | Marketplace/search/store localization and pagination fields |

`user_agent_type` values: `desktop`, `desktop_chrome`, `desktop_edge`, `desktop_firefox`, `desktop_opera`, `desktop_safari`, `mobile`, `mobile_android`, `mobile_ios`, `tablet`, `tablet_android`, `tablet_ios`.

## Context Parameters

Add these as `{ "key": "...", "value": ... }` objects in `context`:

| Key | Use |
|-----|-----|
| `force_headers`, `headers` | Merge custom headers with managed headers |
| `force_cookies`, `cookies` | Merge custom cookies with managed cookies |
| `http_method`, `content` | Use `post` with Base64-encoded body content |
| `follow_redirects` | Follow 3xx redirect chains |
| `successful_status_codes` | Treat specific non-standard HTTP codes as successful |

For multi-format output, enable types in the payload (`parse`, `markdown`, `xhr`, `render: "png"`) and request them with `?type=raw,parsed,png,markdown,xhr`.

For batch Push-Pull jobs, use `POST /v1/queries/batch` with arrays only for `query` or `url`; keep all other parameters singular. Maximum batch size is 5,000 values.

## Quick Start

**Scrape any URL:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"source": "universal", "url": "https://example.com"}'
```

**Google search with parsing:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"source": "google_search", "query": "best laptops", "parse": true}'
```

**Amazon product by ASIN:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{"source": "amazon_product", "query": "B07FZ8S74R", "parse": true}'
```

## Choosing the Right Source

1. **Use specific sources when available** (`amazon_product`, `google_search`) - better parsing and reliability
2. **Use `universal` for unsupported sites** - works with any URL
3. **Enable `parse: true`** for structured JSON output on supported sources

## Response Structure

```json
{
  "results": [{
    "content": "...",
    "status_code": 200,
    "url": "https://..."
  }]
}
```

With `parse: true`, `content` contains structured data (title, price, reviews, etc.) instead of raw HTML.

## Available Sources

For the complete list of 40+ supported sources organized by category, see [sources.md](sources.md).

## More Examples

For detailed request/response examples including geo-location, JavaScript rendering, and custom headers, see [examples.md](examples.md).

## Error Handling

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid parameters |
| 401 | Authentication failed |
| 403 | Access denied |
| 429 | Rate limit exceeded |

## Key Guidelines

- Always set `parse: true` for supported sources to get structured data
- Use ZIP codes for US e-commerce geo-location (e.g., `"90210"`)
- Use country/state format for search engines (e.g., `"California,United States"`)
- Add `render: "html"` for JavaScript-heavy pages
- Use `render: ""` only to disable automatic forced rendering for force-rendered pages; set client timeouts near 180 seconds for rendered Realtime or Proxy Endpoint requests
- Add `content_encoding: "base64"` when scraping image URLs, then decode `results[0].content` before saving the file
