# Proxy Types Reference

Each section lists endpoint, auth prefix, supported parameters, and best-fit use cases. Parameters append to username with hyphens: `customer-USER-cc-US-sessid-abc123:PASS`.

---

## Residential Proxies

Real IPs from ISPs attached to physical locations worldwide.

| Property | Value |
|----------|-------|
| Host | `pr.oxylabs.io` |
| Port | `7777` |
| Auth prefix | `customer-` |
| Locations | 140+ countries |

**Best for:** geo-restricted content, anti-bot evasion, social media automation, ad verification.

### Location parameters

| Param | Format | Example |
|-------|--------|---------|
| `cc` | ISO 3166-1 alpha-2 country | `-cc-US`, `-cc-DE` |
| `cn` | Continent code: `AF`, `AN`, `AS`, `EU`, `NA`, `OC`, `SA` | `-cn-EU` |
| `city` | Lowercase English, `_` for spaces | `-city-new_york`, `-city-los_angeles` |
| `st` | US state with `us_` prefix | `-st-us_california` |
| `postalcode` | US only, 5 digits, pair with `cc-US` | `-cc-US-postalcode-90210` |
| `ASN` | AS number, pair with `sessid`, KYC-gated, mutex with `cc` | `-ASN-21928-sessid-abc123` |

**Coordinates** use a request header instead of username:
```
X-Oxylabs-Geolocation: LAT:LON;RADIUS_MI
```
Minimum radius 10 mi. 502 if no IP in range.

**Country entry nodes:** `{cc}-pr.oxylabs.io:{port}` (e.g. `tr-pr.oxylabs.io:30000`). EU: `eu-pr.oxylabs.io:10000`. SOCKS5 has no country entry nodes — use `-cc-XX` in username.

### Session control

| Param | Behavior | Duration |
|-------|----------|----------|
| `sessid` | Sticky IP via random alphanumeric. Rotates if node drops. | 10 min default, ends after 60s inactivity |
| `sesstime` | Extends `sessid` window. | 5–1440 min (24 h) |
| `sessid_oneip` | Strict IP-bound. No rotation: 502 if node drops. Combinable with `sesstime`. | Until node unavailable |

### Advanced filters (KYC / AM-gated)

| Param | Values | Example |
|-------|--------|---------|
| `ipversion` | `4`, `6` | `-ipversion-6` |
| `platform` | `windows`, `macos`, `linux`, `android`, `ios` | `-platform-windows` |

### Protocols

| Protocol | Host | Port | Notes |
|----------|------|------|-------|
| HTTP | `pr.oxylabs.io` | 80 | Standard |
| HTTPS | `pr.oxylabs.io` | 443 | Encrypted |
| SOCKS5 | `pr.oxylabs.io` | 7777 | TCP. `socks5h://`. Firefox only (Chrome unsupported). |
| HTTP/3 (SOCKS5+UDP) | `socks.pr.oxylabs.io` | 7777 | Beta. AM must enable. UDP firewall required. |

Non-listed ports require compliance verification.

### Restricted targets

Blocked categories (some unblockable via KYC + AM). Non-exhaustive — confirm with support before purchase:

- Entertainment/streaming (Netflix, Spotify, Twitch, Disney)
- Banking/finance (PayPal, BofA, Binance)
- Government (usa.gov, canada.ca)
- Gaming (Playstation, Steam)
- Ticketing (Ticketmaster, Eventbrite)
- Mail (Outlook, Yahoo Mail)
- Ad platforms (Google Tag Manager, Doubleclick)
- IP-check sites (ipinfo.info, iplocation.net)

---

## Mobile Proxies

Real IPs from mobile carriers (3G/4G/5G).

| Property | Value |
|----------|-------|
| Host | `pr.oxylabs.io` |
| Port | `7777` |
| Auth prefix | `customer-` |
| Networks | 3G, 4G, 5G |

**Best for:** mobile app testing, mobile-only content, highest trust requirements, social platforms.

Shares the residential endpoint but a separate IP pool. Carrier/ASN targeting available (KYC). Natural mobile fingerprint.

---

## Datacenter Proxies

High-speed datacenter proxies with rotating and proxy-list access.

| Property | Value |
|----------|-------|
| Host | `dc.oxylabs.io` |
| Rotation port | `8000` |
| Assigned/static ports | `8001` and up |
| Auth prefix | `user-` |

**Best for:** high-volume scraping, cost-sensitive jobs, non-protected targets.

---

## Dedicated Datacenter Proxies

Dedicated datacenter IPs assigned to your account. Not the same as shared `dc.oxylabs.io`.

| Property | Self-Service | Enterprise |
|----------|-------------|------------|
| Gateway | `ddc.oxylabs.io` | Direct IP or Proxy Rotator |
| Auth prefix | `user-` | Username/password (no prefix) |
| Sticky port | `8001+` (per proxy list) | `60000` (per IP) |
| Rotation port | `8000` | Proxy Rotator on `60000` |
| Whitelist port | Dashboard only | `65432` |

Full reference: [dedicated-datacenter.md](dedicated-datacenter.md)

---

## ISP Proxies

ISP-registered proxies with rotating and proxy-list access.

| Property | Value |
|----------|-------|
| Host | `isp.oxylabs.io` |
| Rotation port | `8000` |
| Assigned/static ports | `8001` and up |
| Auth prefix | `user-` |

**Best for:** e-commerce, SEO monitoring, brand protection where shared rotation is acceptable.

---

## Dedicated ISP Proxies

Dedicated ISP-registered IPs with ASN chosen at purchase.

| Property | Self-Service | Enterprise |
|----------|-------------|------------|
| Gateway | `disp.oxylabs.io` | Direct IP or Proxy Rotator |
| Auth prefix | `user-` | Username/password (no prefix) |
| Sticky port | `8001+` (per proxy list) | `60000` (per IP) |
| Rotation port | `8000` (locked to chosen ASN) | Proxy Rotator on `60000` |
| Whitelist port | Dashboard only | `65432` |

Full reference: [dedicated-isp.md](dedicated-isp.md)

---

## Comparison Matrix

| Feature | Residential | Mobile | Datacenter | ISP |
|---------|-------------|--------|------------|-----|
| Speed | Medium | Medium | Fastest | Fast |
| Anonymity | Highest | Highest | Low | High |
| Trust Score | High | Highest | Low | High |
| Cost | Higher | Highest | Lowest | Medium |
| Best Volume | Medium | Low | Highest | High |
| Geo-targeting | Extensive | Country/ASN | Limited | Limited |
