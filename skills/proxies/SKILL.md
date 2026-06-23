---
name: oxylabs-proxies
description: >-
  Oxylabs proxy networks: Residential, Mobile, shared Datacenter/ISP, and
  Dedicated Datacenter/ISP proxies with geo-targeting, IP rotation, session
  persistence, and port-based sticky IPs. Use when routing traffic through
  proxies, building scrapers with proxy auth, rotating or sticky sessions,
  whitelisting IPs, or accessing geo-restricted content.
---

# Oxylabs Proxies

## Proxy Types Overview

| Type | Host | Port | Best For |
|------|------|------|----------|
| Residential | `pr.oxylabs.io` | `7777` | High anonymity, geo-targeting |
| Mobile | `pr.oxylabs.io` | `7777` | Mobile-specific content, highest trust |
| Datacenter (shared) | `dc.oxylabs.io` | `8000` rotation / `8001+` assigned/static | Speed, high volume |
| ISP (shared) | `isp.oxylabs.io` | `8000` rotation / `8001+` assigned/static | Speed + anonymity balance |
| Dedicated Datacenter | `ddc.oxylabs.io` | `8000` rotation / `8001+` assigned/static | Owned IPs, port-based access |
| Dedicated ISP | `disp.oxylabs.io` | `8000` rotation / `8001+` assigned/static | Owned ISP IPs, ASN locked |

Residential/Mobile use `pr.oxylabs.io:7777` with username session parameters. Datacenter/ISP and Dedicated self-service products use proxy-list ports starting at `8001` for assigned/static IPs and `8000` for automatic rotation.

## Environment Variables

Use credentials for the specific proxy product family:

| Product family | Variables | Username prefix |
|----------------|-----------|-----------------|
| Residential, Mobile | `OXY_RES_USERNAME`, `OXY_RES_PASSWORD` | `customer-` |
| Datacenter, ISP, Dedicated Datacenter, Dedicated ISP | `OXY_DC_USERNAME`, `OXY_DC_PASSWORD` | `user-` for self-service/shared |

## Authentication Format

```
customer-USERNAME:PASSWORD    # Residential, Mobile
user-USERNAME:PASSWORD          # Shared Datacenter, Shared ISP
```

Dedicated proxy auth (Self-Service vs Enterprise) is in [dedicated-datacenter.md](dedicated-datacenter.md) and [dedicated-isp.md](dedicated-isp.md).

Use separate credentials for Residential/Mobile (`OXY_RES_USERNAME`, `OXY_RES_PASSWORD`) and Datacenter/ISP (`OXY_DC_USERNAME`, `OXY_DC_PASSWORD`).

With parameters:
```
customer-USERNAME-cc-US-city-new_york-sessid-abc123:PASSWORD
```

## Quick Start

**Residential/Mobile proxy:**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME:$OXY_RES_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

**Datacenter proxy:**
```bash
curl -x "dc.oxylabs.io:8000" \
  -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

**ISP proxy:**
```bash
curl -x "isp.oxylabs.io:8001" \
  -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

For Datacenter, ISP, Dedicated Datacenter, and Dedicated ISP proxies, use dashboard proxy-list ports starting at `8001` for assigned/static IPs; the first listed IP uses `8001`. Switch to port `8000` only when the task calls for automatic rotation.

## Geo-Targeting Parameters

For Residential/Mobile, append username parameters with hyphens unless noted:

| Parameter | Format | Example |
|-----------|--------|---------|
| `cc` | ISO 3166-1 alpha-2 | `-cc-US`, `-cc-DE`, `-cc-GB` |
| `city` | English, underscores for spaces | `-city-new_york`, `-city-los_angeles` |
| `st` | US states with `us_` prefix | `-st-us_california`, `-st-us_texas` |
| `postalcode` | 5-digit US ZIP, pair with `cc-US` | `-cc-US-postalcode-90210` |
| `ASN` | Residential/Mobile carrier ASN | `-ASN-21928` |
| `X-Oxylabs-Geolocation` | Proxy header `lat:lon;radius_miles` | `49.9235:-97.0811;10` |

ZIP targeting is US-only. Coordinate radius cannot be lower than 10 miles. If both country and ASN are used, country applies.

**Example with geo-targeting:**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-cc-US-city-new_york:$OXY_RES_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

For Shared Datacenter/ISP country rotation, use `-country-US` with `user-` credentials on the rotation port.

## Session Control

| Parameter | Description | Notes |
|-----------|-------------|-------|
| `sessid` | Keep the same IP across requests | Standard session is 10 minutes or up to 60s of inactivity |
| `sessid_oneip` | Bind the session to one exact exit node | Returns `502` if that IP becomes unavailable |
| `sesstime` | Set session duration in minutes with `sessid` or `sessid_oneip` | Residential backconnect supports up to 1440 minutes; some entry modes cap lower |

**Sticky session example:**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-cc-US-sessid-mysession123:$OXY_RES_PASSWORD" \
  "https://example.com"
```

**Timed session (5 minutes):**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-sessid-abc123-sesstime-5:$OXY_RES_PASSWORD" \
  "https://example.com"
```

## Choosing the Right Proxy Type

| Need | Recommended |
|------|-------------|
| Highest anonymity | Residential |
| Mobile app content | Mobile |
| Speed & volume | Datacenter |
| Speed + anonymity | ISP |
| Owned dedicated IPs | Dedicated Datacenter or Dedicated ISP |
| Geo-restricted content | Residential/Mobile with `cc`/`city`/`postalcode`, or DC/ISP by country/assigned port where suitable |

## Default Behavior

- Without parameters: random IP for each request
- Residential/Mobile share the same endpoint but different IP pools
- Sessions auto-expire and get new IPs

## Additional Resources

- Shared proxy details (Residential, Mobile, Datacenter, ISP): [proxy-types.md](proxy-types.md)
- Dedicated Datacenter (Self-Service + Enterprise): [dedicated-datacenter.md](dedicated-datacenter.md)
- Dedicated ISP (Self-Service + Enterprise): [dedicated-isp.md](dedicated-isp.md)
- Code examples (all languages): [examples.md](examples.md)
