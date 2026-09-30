---
name: hol-guard
description: Protect a supported local AI coding harness with HOL Guard before it runs credential-bearing, cost-bearing, or state-changing Oxylabs workflows. Use when an agent will operate Oxylabs proxies, Web Scraper API, Web Unblocker, Headless Browser, or Video Data and a local approval and evidence boundary is required.
license: Apache-2.0
---

# HOL Guard for Oxylabs agent workflows

Use HOL Guard at the local AI harness boundary before invoking the existing Oxylabs skills. HOL Guard does not run inside Oxylabs services and does not replace Oxylabs authentication, usage limits, billing controls, target legality, or normal request validation.

## Protect the local harness

Check the current Guard state first:

```bash
hol-guard status
hol-guard detect --json
```

If `hol-guard` is unavailable and the user wants runtime protection, prefer an isolated install:

```bash
pipx install hol-guard
hol-guard bootstrap
hol-guard detect --json
```

Choose the exact supported harness identifier reported by `hol-guard detect --json`, then run:

```bash
hol-guard install <harness>
hol-guard run <harness> --dry-run
hol-guard run <harness>
hol-guard doctor <harness> --json
```

Do not run the non-dry-run protection step if the dry run reports an unexpected mutation or error. Let HOL Guard own harness configuration changes rather than editing agent config files manually.

## Continue with the specific Oxylabs skill

Only after Guard proves the local harness is protected, route the actual work to the most specific existing Oxylabs skill:

- `proxies` for proxy authentication, rotation, sessions, and geo-targeting
- `web-unblocker` for protected-page retrieval
- `web-scraper-api` for structured scraping requests
- `headless-browser` for remote browser sessions and interactions
- `video-data` for video metadata, subtitles, search, channel data, or downloads

Follow that skill's Oxylabs-specific authentication and request guidance. Start with one small request before scaling. Never print Oxylabs credentials or read `.env` files just to prove Guard is active.

## Handle Guard decisions without bypassing them

If Guard queues or blocks work, inspect the request and evidence:

```bash
hol-guard approvals
hol-guard approvals open
hol-guard receipts
hol-guard diff <harness>
```

Never auto-approve a queued request. If Guard denies, requests review, errors, times out, or is unavailable, do not bypass the result by launching an unprotected harness for the same Oxylabs action.

## Verify the boundary

```bash
hol-guard status
hol-guard doctor <harness> --json
hol-guard receipts
```

Report the detected harness, the protection proof, and any remaining approval or error. Do not claim that HOL Guard protects Oxylabs' remote API or browser infrastructure; this skill establishes a local agent-runtime boundary before the Oxylabs workflow starts.

Canonical HOL Guard project: https://github.com/hashgraph-online/hol-guard
