# Reliable access on sites with bot management

Bot-management services score each visitor on the consistency of IP, browser configuration, cookies and
request pattern over time. The service handles the browser configuration and the proxy; the agent's job is
to keep everything it controls consistent and moderately paced.

## 1. Detect the block with the page handler

The remote browser's **page handler** is the detector. With `page_handler=true` it identifies every page
(on load and after in-page navigation), completes an access challenge when it finds one, and reports one
`oxylabs-page-status` message per state (`challenges.md` section 2). Read the verdict
from those states and from the page itself, never from vendor-specific markup:

| What you see | Meaning | Do |
|--------------|---------|----|
| Response carries `X-Error-Description` | Oxylabs network error, not the site | retry per `errors.md` |
| `identifying` → `open`, page shows the expected content | nothing stood in the way | continue |
| `identifying` → `closed` → `open` | an access challenge stood in the way and was handled | continue; keep `page_handler=true` for this target |
| `failed` (with `error`) | a challenge stood in the way and could not be completed | the site decided against this visitor: fresh identity (section 4, rung 2), `page_handler=true` still on |
| `open`, but the page is a block page: `403`/`503`, "access denied", "verify you are human", a redirect to a block path, an empty listing | a block the handler does not act on | fresh identity, then the ladder (section 4) |
| `open`, sign-in wall | the content is not public | stop (section 4, rung 0) |
| No state within 90 s | handler off (`page_handler=false`, or absent on an account where it is off) or the page never settled | check the parameter; inspect (section 4, rung 7) |

On the plain first attempt (`page_handler=false`) there is no state: judge the page by status code
and content, and reconnect with `page_handler=true` as soon as it is not the expected page.

```javascript
// Builds on scripts/playwright_scrape.js: watchPageStatus (installed on the context before the page exists)
// keeps the last state and whether a `closed` was seen since the last `identifying`; waitForPageStatus
// resolves with it on `open` and throws on `failed`.
async function pageVerdict(page, response) {
  if (response.headers()["x-error-description"]) return "oxylabs-network"; // retry per errors.md
  let terminal;
  try {
    terminal = await waitForPageStatus(page);                              // open
  } catch (err) {
    if (/CHALLENGE_HANDLING_ERROR/.test(err.message)) return "blocked";      // failed: fresh identity
    throw err;                                                              // no state in 90 s: inspect
  }
  if (terminal.challenged) return "challenged";                             // closed -> open: handled
  const status = response.status();
  const body = (await page.content()).slice(0, 4096);
  if (/\/(login|signin|sign-in)\b/.test(page.url())) return "not-public";   // rung 0
  if (status >= 400 || /access denied|verify you are human/i.test(body)) return "blocked"; // not acted on
  return "ok";
}
```

`ok` and `challenged` continue (with `page_handler=true` kept for that target). `blocked` means the site has
decided against this visitor: retrying the same session never helps; close it and work through the escalation
ladder (section 4) from a fresh identity. Confirm what the page actually shows (section 4, rung 7) before
spending more sessions.

## 2. Use an identity only when the target needs one

Start every target with `p_cc` only. Each session is already a new browser configuration on a new residential
IP, and for most pages that is the most reliable setup. The order of work is fixed: first write a plain script
and drive it through the escalation ladder (section 4); only if it still fails, recommend persistent profiles to
the user and implement them after they agree. Add persistence only for a concrete reason:

- **Sticky IP** (`proxy_resi_ses_id` + `proxy_resi_ses_time`): several connections must share one exit IP and
  cookie set (a cart, a multi-page flow that spans sessions).
- **Stored profile** (`o_profile`): cookies must survive between jobs. On sites that check the first visit, that
  is the cookie the site sets once its first-page check completes; elsewhere it is cookie consent or site
  preferences (language, currency, region).

Once you add them, the parameter set is one identity and must be identical on every connection:

```text
setup (exactly once):  ?o_profile=<name>&o_profile_save=true&p_cc=<CC>[&p_state=..][&p_city=..]&p_device=..[&p_src=oxybrowser&p_fp_tag=oxyfp_mac_optimized]&proxy_resi_ses_id=<id>&proxy_resi_ses_time=30..120
consumers           :  ?o_profile=<name>&p_cc=<CC>[&p_state=..][&p_city=..]&p_device=..[&p_src=oxybrowser&p_fp_tag=oxyfp_mac_optimized]&proxy_resi_ses_id=<id>&proxy_resi_ses_time=30..120
```

The browser engine and profile family (`p_src`, `p_fp_tag`) are part of the identity too: a profile written on one
engine is read back on the same engine. So is `page_handler`: if the target showed a supported challenge, it is
`true` on the setup run and every consumer run (`challenges.md` section 5).

- **Setup run**: the only connection that sends `o_profile_save=true`. It loads the entry page, waits for the
  real page to render (the page handler reporting `open` is the signal), optionally accepts
  cookie consent or sets site preferences, verifies the page is the real one, then closes so the profile is
  written. In production this is a small service that prepares profiles and re-checks them before handing them out.
- **Consumer runs**: `o_profile=<name>` without `o_profile_save`. Read-only, so they never take the write lock,
  never see `409`, and can start while others run. On sites with bot management still keep one active consumer per
  identity and pace it (section 3); parallelism comes from more identities, not more consumers on one.
- A profile that starts drawing block pages is stale: do not re-save it from a consumer. Run setup again under a
  new name with a new sticky id.
- Sticky time is a ceiling in minutes (max 1440). If the job outlives it, the exit IP changes while cookies stay,
  which bot-management services score as inconsistent. Prefer a fresh identity over an identity with a changed
  IP; after a sticky window closed, rotate **both** the profile and the id.
- Use the browser's default context (`browser.contexts()[0]`) so the profile actually backs the cookies.

## 3. Keep parameters consistent

| Do | Don't |
|----|-------|
| Keep `p_cc`/`p_state`/`p_city` fixed for the life of a profile | Change geo mid-job "to see if it helps" |
| Keep `p_src`/`p_fp_tag` fixed for the life of a profile; switch engine only on a fresh identity (ladder rung 4) | Reuse a profile or sticky id across engines, or pair `oxyfp_mac_optimized` with the default engine |
| Pass `page_handler=false` explicitly; switch to `true` on a fresh connection once the plain attempt showed a block or verification page, then keep it | Flap it between connections, or keep retrying a session the page handler reported `failed` on |
| Match interaction to `p_device`: mobile = taps, small scrolls, portrait flow; desktop = mouse moves, hover, wider pages | Use `p_device=mobile` and then hover, right-click, or open 10 tabs |
| Let the service own viewport and User-Agent | Call `setViewportSize`, `emulate`, `setUserAgent`, or CDP `Emulation.*` overrides |
| Use one page at a time per identity, 3 to 8 s between navigations, scroll before clicking | Fire 20 navigations in parallel from one identity |
| Wait for `domcontentloaded` plus a random 2 to 5 s before reading the DOM | Read immediately and retry in a tight loop when data is missing |
| Send `o_profile_save=true` from one setup run only; consumers use `o_profile` alone | Save the profile from consumers or on every connection (write lock, `409`, stale profiles re-saved) |

## 4. Escalation ladder

Apply one rung at a time, on a fresh connection, and stop at the first that works. Repeating the same
request with the same identity is never a rung.

0. **Is the content public?** A sign-in wall means the data is only available to signed-in users: only publicly
   available data is in scope, so stop and report instead of escalating.
1. **Let the page handler try.** If the plain attempt showed a block or verification page, reconnect with
   `page_handler=true`, same geo and device, and read the page state (section 1, `challenges.md`). `closed`
   then `open` means handled: done. `failed`, or `open` while the page is still a block page, means the handler
   cannot clear it: continue with rung 2, `page_handler=true` still on, at most 2 fresh identities.
2. **Fresh identity**: a new session already means a new IP and browser configuration. If you were using a
   profile or sticky id, also use a new `o_profile` name and a new `proxy_resi_ses_id`; same geo/device.
3. **Broader geo**: drop `p_city`, then `p_state`; keep the country the site serves.
4. **New browser engine**: `p_src=oxybrowser` together with `p_fp_tag=oxyfp_mac_optimized` (a macOS browser
   profile tuned for that engine), same geo, `p_device=desktop`. This is the first rung for a site whose block
   is about the browser configuration rather than the IP (the signature repeats across fresh identities). Keep
   the pair for every later connection to that target; drop both again before trying rung 5.
5. **Device switch**: `p_device=mobile` with a mobile interaction pattern (mobile layouts are often simpler and
   lighter). Mobile uses its own browser profile: do not send an `oxyfp_*` tag with it.
6. **Slow down**: double the pauses, one identity at a time, `<= 30` pages per identity.
7. **Inspect**: after 3 consecutive failures on the same target, fetch `__session_id` and watch the session
   at `https://hb.oxylabs.io/novnc/?id=<id>`, or add `record=true&record_name=<job>`; confirm what the page
   actually shows (block page, geo-fence, sign-in wall, empty state).
8. **Recommend persistent profiles to the user.** The plain script has now failed on every rung. Explain that the
   remaining option is to reuse the site's cookies across sessions via a stored profile (setup run plus
   consumers, section 2), optionally with a sticky IP, and what it costs: a setup step, the profile cap of 5, one
   more moving part. Implement it only after the user agrees; do not add it on your own.
9. **Stop and report** which rung failed, the block signature, the parameter set and the session id.

## 5. Starting point for a new site with bot management

Starting values, not measured guarantees. Tune pacing down if you see block pages on more than 1 in 20 pages.

| Setting | Start with | Why |
|---------|------------|-----|
| Geo | `p_cc` of the country the site serves; `p_state`/`p_city` only if results are geo-filtered that finely | Geo-filtered results need a matching exit country |
| Device | `p_device=desktop` (default); `mobile` only if the site is mobile-first or desktop keeps failing | Must match the interaction pattern you drive |
| Engine | Default engine and `p_fp_tag=oxyfp_win` (both implied). `p_src=oxybrowser&p_fp_tag=oxyfp_mac_optimized` once a fresh identity with the right geo is still blocked (section 4, rung 4) | The new engine presents a different browser configuration; keep it per target once it works |
| Challenge handling | `page_handler=false`, explicit; `true` on a fresh connection after the first supported challenge, then kept per target | Most pages never challenge; unnecessary handling only adds time |
| Identity | None. A profile (setup run + consumers, section 2) is what you recommend to the user once the plain script has failed the whole ladder, for example because the site sets a cookie on the first load and blocks more than 1 in 20 pages | Fresh sessions are the most reliable setup for most sites |
| Pacing | 1 page every 5 to 8 s, scroll a listing before opening a detail page, interleave detail and listing pages | Spreads load evenly across page types |
| Volume | <= 100 pages per identity, then a new identity | Keeps the per-identity request rate moderate |

## 6. Reporting a block

When escalation is exhausted, report: target URL, the page verdict from section 1, full parameter set (never
the password), session id, timestamps of each attempt, every `oxylabs-page-status` line with its timestamp,
which rung failed, and whether `X-Error-Description` was ever present. Send it to `support@oxylabs.io` if the
failure correlates with the Oxylabs network (header present, a `failed` status on every identity) rather than the target.

*This content is not intended to provide legal advice, and scraping activities may be subject to applicable laws and regulations.*
