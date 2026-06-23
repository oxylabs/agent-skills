---
name: oxylabs-web-unblocker
description: Bypasses anti-bot protections using Oxylabs Web Unblocker, an AI-powered proxy that handles fingerprinting, JavaScript rendering, and retries automatically. Use when the user needs to scrape protected websites, bypass CAPTCHAs, access blocked content, or when regular proxies fail due to anti-bot measures.
---

# Oxylabs Web Unblocker

AI-powered proxy solution that automatically manages fingerprinting, headers, retries, and JavaScript rendering.

## Endpoint

```
https://unblock.oxylabs.io:60000
```

## Authentication

HTTP Basic Auth via proxy credentials:

```bash
curl -k -x "https://unblock.oxylabs.io:60000" \
  -U "$OXYLABS_USERNAME:$OXYLABS_PASSWORD" \
  "https://example.com"
```

## Quick Start

**Basic request:**
```bash
curl -k -x "https://unblock.oxylabs.io:60000" \
  -U "$OXYLABS_USERNAME:$OXYLABS_PASSWORD" \
  "https://ip.oxylabs.io/headers"
```

**With JavaScript rendering:**
```bash
curl -k -x "https://unblock.oxylabs.io:60000" \
  -U "$OXYLABS_USERNAME:$OXYLABS_PASSWORD" \
  -H "x-oxylabs-render: html" \
  "https://example.com/spa-page"
```

## Headers

| Header | Description |
|--------|-------------|
| `x-oxylabs-render` | `html` for rendered HTML, `png` for raw PNG bytes; empty value disables automatic forced rendering |
| `X-Oxylabs-Session-Id` | Reuse same IP across requests (any random string) |
| `X-Oxylabs-Geo-Location` | Target country, city/state, ZIP/postcode, or coordinates |
| `x-oxylabs-force-headers: 1` | Enable custom header passthrough |
| `x-oxylabs-force-cookies: 1` | Enable custom cookie passthrough |
| `X-Oxylabs-Successful-Status-Codes` | Define custom success codes to prevent retries |
| `x-oxylabs-browser-instructions` | JSON-escaped browser actions; requires `x-oxylabs-render: html` |

## Session Persistence

Reuse the same IP across multiple requests:

```bash
curl -k -x "https://unblock.oxylabs.io:60000" \
  -U "$OXYLABS_USERNAME:$OXYLABS_PASSWORD" \
  -H "X-Oxylabs-Session-Id: my-session-123" \
  "https://example.com/page1"
```

## Geo-Location Targeting

```bash
curl -k -x "https://unblock.oxylabs.io:60000" \
  -U "$OXYLABS_USERNAME:$OXYLABS_PASSWORD" \
  -H "X-Oxylabs-Geo-Location: Germany" \
  "https://example.com"
```

Use values such as `Germany`, `90210`, `California,United States`, `New York,New York,United States`, or `lat: 40.7128, lng: -74.0060, rad: 50`.

Use normal HTTP methods and request bodies through the proxy; Web Unblocker supports both GET and POST.

## When to Use Web Unblocker vs Regular Proxies

| Scenario | Use |
|----------|-----|
| Sites with anti-bot protection | Web Unblocker |
| CAPTCHAs, fingerprint detection | Web Unblocker |
| JavaScript-heavy SPAs | Web Unblocker with `x-oxylabs-render: html` |
| Simple requests, no protection | Regular Proxies |
| High volume, price sensitive | Regular Proxies |

## Key Guidelines

- Always use `-k` flag (or disable SSL verification) - the proxy uses its own certificates
- Add `x-oxylabs-render: html` if experiencing empty content or low success rates; set client timeouts near 180 seconds for rendered requests
- Check `X-Oxylabs-Final-Url` in response headers when redirects matter
- Avoid adding custom unblocking headers that may interfere with the AI
- Browser instruction header values must be JSON-escaped and compact; pair them with `x-oxylabs-render: html`

For code examples in Python, Node.js, PHP, Go, Java, and C#, see [examples.md](examples.md).
