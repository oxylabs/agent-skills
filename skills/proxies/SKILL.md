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
| Datacenter (shared) | `dc.oxylabs.io` | `8000` rotation / `8001+` sticky | Speed, high volume |
| ISP (shared) | `isp.oxylabs.io` | `8000` rotation / `8001+` sticky | Speed + anonymity balance |
| Dedicated Datacenter | `ddc.oxylabs.io` | `8000` rotation / `8001+` sticky | Owned IPs, port-based access |
| Dedicated ISP | `disp.oxylabs.io` | `8000` rotation / `8001+` sticky | Owned ISP IPs, ASN locked |

Shared proxies rotate from a pool. Dedicated proxies use your purchased IPs — see [dedicated-datacenter.md](dedicated-datacenter.md) or [dedicated-isp.md](dedicated-isp.md).

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

With parameters:
```
customer-USERNAME-cc-US-city-new_york-sessid-abc123:PASSWORD
```

## Quick Start

**Residential/Mobile proxy:**
```bash
curl -x "http://pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME:$OXY_RES_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

**Datacenter proxy:**
```bash
curl -x "http://dc.oxylabs.io:8000" \
  -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

**ISP proxy:**
```bash
curl -x "http://isp.oxylabs.io:8001" \
  -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

## Geo-Targeting Parameters

For Residential/Mobile, append parameters to the username with hyphens:

| Parameter | Format | Example |
|-----------|--------|---------|
| `cc` | ISO 3166-1 alpha-2 | `-cc-US`, `-cc-DE`, `-cc-GB` |
| `city` | English, underscores for spaces | `-city-new_york`, `-city-los_angeles` |
| `st` | US states with `us_` prefix | `-st-us_california`, `-st-us_texas` |

**Example with geo-targeting:**
```bash
curl -x "http://pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-cc-US-city-new_york:$OXY_RES_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

For Shared Datacenter/ISP country rotation, use `-country-US` with `user-` credentials on the rotation port.

## Session Control

| Parameter | Description | Max Duration |
|-----------|-------------|--------------|
| `sessid` | Keep same IP across requests | 10 min default; ends after 60s inactivity |
| `sesstime` | Extend a `sessid` window | 5-1440 min (24 h) |

**Sticky session example:**
```bash
curl -x "http://pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-cc-US-sessid-mysession123:$OXY_RES_PASSWORD" \
  "https://example.com"
```

**Timed session (5 minutes):**
```bash
curl -x "http://pr.oxylabs.io:7777" \
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
| Geo-restricted content | Residential with `cc`/`city` |

## Default Behavior

- Without parameters: random IP for each request
- Residential/Mobile share the same endpoint but different IP pools
- Sessions auto-expire and get new IPs

## Additional Resources

- Shared proxy details (Residential, Mobile, Datacenter, ISP): [proxy-types.md](proxy-types.md)
- Dedicated Datacenter (Self-Service + Enterprise): [dedicated-datacenter.md](dedicated-datacenter.md)
- Dedicated ISP (Self-Service + Enterprise): [dedicated-isp.md](dedicated-isp.md)
- Code examples (all languages): [examples.md](examples.md)
