# Error catalogue

## How errors reach you

```text
                     ┌─ HTTP status + plain-text body      (handshake refused, no session was created)
connect() ───────────┤
                     └─ 101 Switching Protocols ──┬─ WebSocket close 3000 + CDP_* reason  (session died)
                                                  └─ CDP error {code: 1337, message}     (one command failed)
page traffic ─────────── HTTP responses; X-Error-Description header present = Oxylabs network error
```

1. **Handshake** (`connectOverCDP` / `puppeteer.connect` throws). Body is a short text: either a `CDP_*` code
   or a human sentence. Playwright's message is `WebSocket error: <full URL incl. password> <status> <status
   text>` followed by the body on the next line; Puppeteer's is `Unexpected server response: <status>`; raw
   WebSocket clients get the HTTP response. **Redact the password before logging.** No session exists,
   nothing to close.
2. **Post-connect close** (`browser.on("disconnected")`, a pending command rejects with `Target closed`,
   `Browser has been closed` or similar). The close frame carries code `3000` and a `CDP_*` reason, but only
   raw WebSocket clients can read it; Playwright and Puppeteer do not expose the close reason. Anything
   unexpected is reported as `CDP_GENERAL_ERROR`. Reconnect with a fresh session and backoff; if you pinned
   `proxy_resi_ses_id` and the disconnect happened before the first navigation, rotate the id too.
3. **In-page CDP error** with code `1337`. The session is fine; the specific command was refused.
4. **Target traffic.** Ordinary HTTP responses inside the page. If a response carries `X-Error-Description`,
   the Oxylabs network produced the error and the header explains it. Without the header, the website itself
   answered (a block page, a 403): change approach instead of retrying.

Retry policy: retry `429`, `5xx`, `CDP_SESSION_IN_USE`, `CDP_NO_BROWSERS_AVAILABLE`, `CDP_BROWSER_OVERWORKED_*`,
`CDP_BAD_PROXY`, `CDP_GENERAL_ERROR` and unexpected disconnects with exponential backoff (1 s base, 60 s cap,
jitter). Retry `409` only after the conflicting session has had time to close (30 s or more). Never retry
`400`, `401`, `403` or `1337` without changing the request.

## Handshake errors

### 401 Unauthorized

| Body | Cause | Fix |
|------|-------|-----|
| `missing auth header` | Client sent no `Authorization` header because it ignores `user:pass@` in the URL (Node's built-in `WebSocket`, some proxies) | Build `Authorization: Basic base64("user:pass")` yourself |
| `invalid auth header` | Header is not `Basic …` (e.g. `Bearer`) | Use Basic auth |
| `not a valid base64 string` | Header value is not URL-safe base64 with padding (credentials containing bytes that encode to `+` or `/`) | Encode with the URL-safe alphabet (`-`, `_`) and keep `=` padding, or change the password |
| `missing credentials` | Decoded value is not exactly `user:pass` (password contains `:`) | Change the password, or send the header manually and ensure exactly one `:` |
| `invalid credentials` | Unknown/inactive user, wrong password, incomplete username, password percent-encoded by `new URL()` | Re-read env vars; use the full username from the dashboard; concatenate the raw password |

### 400 Bad Request

| Body | Fix |
|------|-----|
| `invalid_uri, failed to decode query` | Malformed query string; check `&`/`=` and encoding of values |
| `invalid_uri, invalid query: p_device must be one of [desktop mobile]` | Use `desktop` or `mobile` |
| `session_name must be 3-36 alphanumeric or '-' characters` | Only `[A-Za-z0-9-]`, 3 to 36 chars |
| `keep_alive requires session_name` | Add `session_name` or drop `keep_alive` |
| `unsupported proxy type "x", supported: resi, dc, ddc` | Use `resi` or `dc` |
| `proxy type "x" is not enabled for this user` | Drop `proxy` (defaults to `resi`) or ask support |
| `proxy=dc does not support [p_cc …] params` | Remove geo/sticky parameters or switch to `resi` |
| `ddc proxy is not supported` | Use `resi` or `dc` |
| `invalid p_cc, supported ISO-3166 2 letter codes` | Two-letter country code |
| `proxy_resi_ses_id must be 3–36 alphanumeric characters or underscores` | Start with a letter/digit; `[A-Za-z0-9_]`, 3 to 36 chars |
| `proxy_resi_ses_time must be between 1 and 1440` | Integer minutes in range |
| `o_profile must contain only letters, numbers, hyphens, and underscores (min 3, max 36 characters)` | Fix the profile name |
| `o_profile_save requires o_profile to be set` | Add `o_profile` |
| `o_profile_save should be boolean` | `true`/`false` |
| `record should be boolean` | `true`/`false` |
| `record_name requires record=true` | Add `record=true` |
| `record_name must contain only letters, numbers, hyphens, and underscores (max 64 characters)` | Fix the name |

### 403 Forbidden

| Body | Fix |
|------|-----|
| `browser profile feature is not enabled for your account` | Remove `o_profile`; contact support to enable |
| `profile limit reached (N profiles maximum)` | Reuse a stable profile name, delete unused profiles in the dashboard, or request a higher cap |
| `recordings are not enabled for this account` | Remove `record` |
| `recording limit reached (N recordings maximum)` | Delete old recordings in the dashboard |

### 409 Conflict

| Body | Fix |
|------|-----|
| `profile is already in use by another session` | A run with `o_profile_save=true` (the setup run) still holds this profile. Wait for it to close (30 s+), then retry. Consumers must send `o_profile` without `o_profile_save`; if a consumer hit this, it is saving when it should not |

### 429 Too Many Requests

| Body | Cause | Fix |
|------|-------|-----|
| `CDP_SESSION_RATE_LIMIT_REACHED` | More than 10 new sessions within one second (account default) | Serialise launches, 150 ms apart or slower; backoff |
| `CDP_MAX_CONCURRENT_SESSIONS_REACHED` | Concurrency cap (account default 100). Sessions you did not close still count for about 20 s, named ones for 10 min | Close idle sessions; fix missing `finally { browser.close() }`; wait and retry |
| `CDP_MAX_PERSISTENT_SESSIONS_REACHED` | Cap of named sessions (default 5) | Reuse a name, or let old sessions expire |
| `CDP_SESSION_IN_USE` | Reconnecting to a named session that still has a live connection | Close the earlier connection, retry |
| `max queue sessions reached` | Too many of your connections waiting for capacity | Lower parallelism, backoff |

### 5xx

| Status / body | Fix |
|---------------|-----|
| `500 CDP_GENERAL_ERROR` | Setup failed internally. Retry with backoff; if it persists more than a few minutes, contact support with the time and parameters |
| `502`, `504` (no `CDP_*` text) | Edge/network issue. Retry with backoff |
| `503 queue timeout` | Waited about a minute for capacity. Back off 30 to 60 s, reduce parallelism, retry |

## Post-connect close (code 3000)

| Reason | Meaning | Fix |
|--------|---------|-----|
| `CDP_NO_BROWSERS_AVAILABLE` | No browser could be allocated | Retry with backoff |
| `CDP_BROWSER_OVERWORKED_1` | Allocated host is saturated | Retry with backoff |
| `CDP_BAD_PROXY` | Proxy could not be established for the requested geo / sticky id | Retry; rotate `proxy_resi_ses_id`; drop `p_city` |
| `CDP_SESSION_NOT_FOUND` | Named session expired (10 min) before reconnect | Start a new session |
| `CDP_SESSION_IN_USE` | Another connection grabbed the named session first | Close it, retry |
| `CDP_GENERAL_ERROR` | Browser died or an internal step failed | New session with backoff |

## In-page CDP errors (code 1337)

| Message | Meaning | Fix |
|---------|---------|-----|
| `Invalid target` | The navigated host is not allowed for your account (restricted category) | Do not retry. Verify the URL, then ask your account manager to unlock the category |
| `Too many targets` | Over 1000 pages in one session | Close pages after use |
| `Proxy not allowed in this context` | `Target.createBrowserContext` with `proxyServer` | Use URL parameters for proxy selection |

## Viewer (VNC) errors

| Reason | Fix |
|--------|-----|
| `CDP_VNC_MAX_CONCURRENT_SESSIONS_REACHED` | Close other viewer tabs (default cap 10) |
| `SESSION_NOT_FOUND` / `INCORRECT_SESSION_ID` | Session ended or id mistyped; fetch it again with `__session_id` |

## Decision flow for an agent

```text
connect failed?
  ├─ 401 ............ fix credentials/scheme, do not retry
  ├─ 400/403/409 .... fix the named parameter, do not retry unchanged
  ├─ 429 ............ backoff; if MAX_CONCURRENT: hunt for unclosed sessions
  └─ 5xx/503 ........ backoff, up to ~2 min total
session dropped (close 3000)?
  └─ new session with backoff; rotate sticky id on CDP_BAD_PROXY
navigate failed with 1337 Invalid target?
  └─ stop; restricted target
page shows block / 403 wall?
  ├─ X-Error-Description present .... Oxylabs network issue: backoff + retry
  └─ absent ......................... target decision: change identity, geo, device, pacing (targets.md)
```
