# Protected targets playbook (DataDome and similar)

Anti-bot vendors such as DataDome, Cloudflare Bot Management and Akamai score each visitor on the consistency
of IP, TLS/browser fingerprint, cookies and behaviour over time. The service handles the fingerprint and the
proxy; the agent's job is to keep everything it controls consistent and human-paced.

## 1. Detect the block

Check these before changing anything. None of them carry `X-Error-Description`, which is how you know the
website decided, not the Oxylabs network.

| Vendor | Signature |
|--------|-----------|
| DataDome | HTTP `403`; body starts with a short HTML page containing `Contact: DataAccess@datadome.co`; cookie named `datadome` |
| Cloudflare | HTTP `403` or `503` with title `Just a moment...` or `Attention Required`; `cf-mitigated: challenge` response header; cookie `cf_clearance` after success |
| Akamai | HTTP `403` with `Access Denied` and a `Reference #` id; cookies `_abck`, `bm_sz` |
| Generic | Login wall, empty product grid, 200 with a "verify you are human" page, redirect loop to `/blocked` |

```javascript
async function classify(page, response) {
  if (response.headers()["x-error-description"]) return "oxylabs-network"; // retry per errors.md
  const status = response.status();
  const body = (await page.content()).slice(0, 4096);
  if (status === 403 && body.includes("DataAccess@datadome.co")) return "datadome";
  if ([403, 503].includes(status) && /Just a moment|Attention Required/.test(body)) return "cloudflare";
  if (status === 403 && /Access Denied/.test(body)) return "akamai-or-waf";
  return status >= 400 ? "target-error" : "ok";
}
```

`datadome`, `cloudflare` and `akamai-or-waf` all mean the site has decided against this visitor. Retrying the
same session never helps: close it and work through the escalation ladder (section 4), starting with a fresh
identity. Confirm what the page actually shows (section 4, rung 5) before spending more sessions.

## 2. Use an identity only when the target needs one

Start every target with `p_cc` only. Each session is already a new fingerprint on a new residential IP, and for
most pages that is the safest possible visitor. The order of work is fixed: first write a plain script and
drive it through the escalation ladder (section 4); only if it still fails, recommend persistent profiles to
the user and implement them after they agree. Add persistence only for a concrete reason:

- **Sticky IP** (`proxy_resi_ses_id` + `proxy_resi_ses_time`): several connections must look like one visitor
  (login, cart, a multi-page flow that spans sessions).
- **Stored profile** (`o_profile`): cookies must survive between jobs. On DataDome-class sites that is the
  clearance cookie earned on the first page; on authenticated sites it is the login.

Once you add them, the parameter set is one identity and must be identical on every connection:

```text
setup (exactly once):  ?o_profile=<name>&o_profile_save=true&p_cc=<CC>[&p_state=..][&p_city=..]&p_device=..&proxy_resi_ses_id=<id>&proxy_resi_ses_time=30..120
consumers           :  ?o_profile=<name>&p_cc=<CC>[&p_state=..][&p_city=..]&p_device=..&proxy_resi_ses_id=<id>&proxy_resi_ses_time=30..120
```

- **Setup run**: the only connection that sends `o_profile_save=true`. It loads the entry page, waits for the
  real page to render (the `datadome` or `cf_clearance` cookie appearing is a good signal), optionally logs in,
  verifies the page is the real one, then closes so the profile is written. In production this is a small service
  that prepares profiles and re-checks them before handing them out.
- **Consumer runs**: `o_profile=<name>` without `o_profile_save`. Read-only, so they never take the write lock,
  never see `409`, and can start while others run. On DataDome-class targets still keep one active consumer per
  identity and pace it (section 3); parallelism comes from more identities, not more consumers on one.
- A profile that starts drawing block pages is burned: do not re-save it from a consumer. Run setup again under a
  new name with a new sticky id.
- Sticky time is a ceiling in minutes (max 1440). If the job outlives it, the exit IP changes while cookies stay,
  which DataDome scores against you. Prefer a fresh identity over an identity with a changed IP; after a sticky
  window closed, rotate **both** the profile and the id.
- Use the browser's default context (`browser.contexts()[0]`) so the profile actually backs the cookies.

## 3. Behave consistently

| Do | Don't |
|----|-------|
| Keep `p_cc`/`p_state`/`p_city` fixed for the life of a profile | Change geo mid-job "to see if it helps" |
| Match interaction to `p_device`: mobile = taps, small scrolls, portrait flow; desktop = mouse moves, hover, wider pages | Use `p_device=mobile` and then hover, right-click, or open 10 tabs |
| Let the service own viewport and User-Agent | Call `setViewportSize`, `emulate`, `setUserAgent`, or CDP `Emulation.*` overrides |
| Use one page at a time per identity, 3 to 8 s between navigations, scroll before clicking | Fire 20 navigations in parallel from one identity |
| Wait for `domcontentloaded` plus a random 2 to 5 s before reading the DOM | Read immediately and retry in a tight loop when data is missing |
| Send `o_profile_save=true` from one setup run only; consumers use `o_profile` alone | Save the profile from consumers or on every connection (write lock, `409`, burned profiles re-saved) |

## 4. Escalation ladder

Apply one rung at a time, on a fresh connection, and stop at the first that works. Repeating the same
request with the same identity is never a rung.

1. **Fresh identity**: a new session already means a new IP and fingerprint. If you were using a profile or
   sticky id, also use a new `o_profile` name and a new `proxy_resi_ses_id`; same geo/device.
2. **Broader geo**: drop `p_city`, then `p_state`; keep the country the site serves.
3. **Device switch**: `p_device=mobile` with a mobile interaction pattern (many listing sites are more
   lenient on mobile).
4. **Slow down**: double the pauses, one identity at a time, `<= 30` pages per identity.
5. **Inspect**: after 3 consecutive failures on the same target, fetch `__session_id` and watch the session
   at `https://hb.oxylabs.io/novnc/?id=<id>`, or add `record=true&record_name=<job>`; confirm what the page
   actually shows (block page, geo-fence, login wall, empty state).
6. **Recommend persistent profiles to the user.** The plain script has now failed on every rung. Explain that the
   remaining option is to reuse a clearance cookie or login across sessions via a stored profile (setup run plus
   consumers, section 2), optionally with a sticky IP, and what it costs: a setup step, the profile cap of 5, one
   more moving part. Implement it only after the user agrees; do not add it on your own.
7. **Stop and report** which rung failed, the block signature, the parameter set and the session id.

## 5. Starting point for a new protected target

Starting values, not measured guarantees. Tune pacing down if you see block pages on more than 1 in 20 pages.

| Setting | Start with | Why |
|---------|------------|-----|
| Geo | `p_cc` of the country the site serves; `p_state`/`p_city` only if results are geo-filtered that finely | A foreign IP is the cheapest signal a vendor has |
| Device | `p_device=desktop` (default); `mobile` only if the site is mobile-first or desktop keeps failing | Must match the interaction pattern you drive |
| Identity | None. A profile (setup run + consumers, section 2) is what you recommend to the user once the plain script has failed the whole ladder, for example because the site sets a clearance cookie on the first load and blocks more than 1 in 20 pages | Fresh sessions are the safest visitor for most sites |
| Pacing | 1 page every 5 to 8 s, scroll a listing before opening a detail page, interleave detail and listing pages | Search-only or detail-only bursts are what bots do |
| Volume | <= 100 pages per identity, then a new identity | Keeps per-identity request rate ordinary |

## 6. Reporting a block

When escalation is exhausted, report: target URL, block signature from section 1, full parameter set (never
the password), session id, timestamps of each attempt, and whether `X-Error-Description` was ever present.
Send it to `support@oxylabs.io` if the block correlates with the Oxylabs network rather than the target.
