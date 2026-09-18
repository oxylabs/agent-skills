# Connection parameters

All options are query parameters appended to the WebSocket URL:

```text
wss://USERNAME:PASSWORD@hb.oxylabs.io?p_cc=US&p_device=desktop&session_name=job-42
```

Validation happens after authentication. A failed check rejects the handshake with `400 Bad Request` and the
plain-text message listed below; nothing is retried automatically. Unknown parameters are ignored, but every
distinct parameter combination is provisioned separately, so keep the set stable across a job.

Most jobs need only `p_cc`. Sticky sessions, profiles and named sessions are opt-in for a specific need (see
`targets.md` section 2); do not add them by default.

## Session

| Parameter | Format | Default | Meaning and rules |
|-----------|--------|---------|-------------------|
| `session_name` | `^[A-Za-z0-9-]{3,36}$` | none | Names the session so it can be resumed by reconnecting with the same credentials and name. Resumable for 10 minutes after disconnect. Default cap 5 named sessions. `400 session_name must be 3-36 alphanumeric or '-' characters` |
| `keep_alive` | `true` / `false` | `true` when `session_name` is set, otherwise `false` | Keeps the browser alive after you disconnect. **Requires `session_name`**: `400 keep_alive requires session_name`. Set `false` with a name to make the named session non-resumable |

## Geo and proxy

| Parameter | Format | Default | Meaning and rules |
|-----------|--------|---------|-------------------|
| `proxy` | `resi` / `dc` | `resi` | Proxy type: residential (default) or datacenter. `dc` does not accept geo or sticky-session parameters: `400 proxy=dc does not support [p_cc …] params`. Unknown value: `400 unsupported proxy type "x", supported: resi, dc, ddc`. Not on your plan: `400 proxy type "dc" is not enabled for this user` |
| `p_cc` | ISO-3166 alpha-2, case-insensitive (`US`, `de`) | automatic | Exit country. `400 invalid p_cc, supported ISO-3166 2 letter codes` |
| `p_state` | lowercase US state, `texas` or `us_texas` | none | US state; overrides `p_cc`. The `us_` prefix is added for you if missing |
| `p_city` | lowercase, underscores for spaces (`los_angeles`) | none | City preference, best effort. Only applied when `p_cc` or `p_state` is also set; falls back to the wider area if no match |
| `proxy_resi_ses_id` | `^[a-zA-Z0-9][a-zA-Z0-9_]{2,35}$` | random per session | Opt-in. Sticky residential session: identical values on every connection keep the same exit IP. Disables automatic proxy retry (on `CDP_BAD_PROXY`, rotate the id). Residential only. `400 proxy_resi_ses_id must be 3–36 alphanumeric characters or underscores` |
| `proxy_resi_ses_time` | integer 1 to 1440 (minutes) | none | How long the sticky IP is held, counted from the first connection that used the id. Residential only. `400 proxy_resi_ses_time must be between 1 and 1440` |

## Fingerprint

| Parameter | Format | Default | Meaning and rules |
|-----------|--------|---------|-------------------|
| `p_device` | `desktop` / `mobile` | `desktop` | Device profile: viewport, touch APIs, platform headers, User-Agent and a matching residential pool. `tablet` is **not** accepted. Invalid value: `400 invalid_uri, invalid query: p_device must be one of [desktop mobile]`. Do not override viewport or device metrics yourself; the service ignores those CDP calls to keep the fingerprint coherent |

## Profiles

| Parameter | Format | Default | Meaning and rules |
|-----------|--------|---------|-------------------|
| `o_profile` | `^[a-zA-Z0-9][a-zA-Z0-9_-]{2,35}$` | none | Opt-in, for cookies that must survive between jobs. Restores cookies and localStorage saved under this name at session start. Missing profile is created empty (no error). Retained 14 days from last use. `400 o_profile must contain only letters, numbers, hyphens, and underscores (min 3, max 36 characters)`. Feature disabled: `403 browser profile feature is not enabled for your account` |
| `o_profile_save` | `true` / `false` (`1`/`0`, `on`/`off`) | `false` | Persists the profile when the session ends (also after errors, as long as the browser was closed). **Send it from exactly one setup run per profile name**; consumer runs use `o_profile` alone and never save. Requires `o_profile`: `400 o_profile_save requires o_profile to be set`. Non-boolean: `400 o_profile_save should be boolean`. Only saving sessions count toward the profile cap: `403 profile limit reached (N profiles maximum)`. The profile is write-locked while a saving session runs: `409 profile is already in use by another session` |

Use the browser's default context (`browser.contexts()[0]`) so cookies and storage are actually backed by the
profile; a fresh `newContext()` is isolated from it.

## Recording

| Parameter | Format | Default | Meaning and rules |
|-----------|--------|---------|-------------------|
| `record` | `true` / `false` | `false` | Records the session to video, viewable in the dashboard. Non-boolean: `400 record should be boolean`. Not on your plan: `403 recordings are not enabled for this account`. Cap: `403 recording limit reached (N recordings maximum)` (default 10) |
| `record_name` | `^[a-zA-Z0-9_-]{1,64}$` | none | Label for the recording. Requires `record=true`: `400 record_name requires record=true`. `400 record_name must contain only letters, numbers, hyphens, and underscores (max 64 characters)` |

## Other

| Parameter | Format | Default | Meaning and rules |
|-----------|--------|---------|-------------------|
| `bargs` | see docs | none | Chrome browser arguments (`disable-notifications`, `window-position:X,Y`, `hide-scrollbars`, `force-color-profile:<p>`, `enable-features:<f>`); repeat the key for several values. Rarely needed; do not use it to change the fingerprint |

## Combination rules

- `p_city` needs `p_cc` or `p_state`; `p_state` beats `p_cc`.
- `proxy=dc` rejects `p_cc`, `p_state`, `p_city`, `proxy_resi_ses_id`, `proxy_resi_ses_time`.
- `keep_alive=true` needs `session_name`; `o_profile_save=true` needs `o_profile`; `record_name` needs `record=true`.
- For one identity keep `p_cc`, `p_state`, `p_city`, `p_device`, `o_profile`, `proxy_resi_ses_id` and
  `proxy_resi_ses_time` identical on every connection.
