# Dedicated ISP Proxies

ISP-registered dedicated IPs assigned to your account. Access via gateway `disp.oxylabs.io` (Self-Service) or direct IPs (Enterprise). Distinct from ISP Proxies at `isp.oxylabs.io`.

Higher trust than datacenter; ASN/ISP chosen at purchase and locked for rotation.

## Self-Service

Purchased via [dashboard](https://dashboard.oxylabs.io/en/) — select locations and premium ASNs at checkout. Proxy list: **My Products → Dedicated ISP Proxies → Proxy list** (export JSON/CSV).

| Field | Value |
|-------|-------|
| Entry point | `disp.oxylabs.io` (fixed) |
| Auth prefix | `user-` (required, case-sensitive) |
| Sticky IP port | `8001` and up — one IP per port |
| Rotation port | `8000` — random IP from your list per request |

Proxy list fields: entry point, port, country, ISP (ASN), assigned IP.

**Port = access method.** IPs map to ports automatically; ports stay stable across IP replacements.

### Sticky IP (specific proxy)

```bash
curl -x disp.oxylabs.io:8001 -U "user-USERNAME:PASSWORD" https://ip.oxylabs.io/location
```

Use port from proxy list for other IPs (8002, 8003, …).

### Rotation (random IP from your pool)

```bash
curl -x disp.oxylabs.io:8000 -U "user-USERNAME:PASSWORD" https://ip.oxylabs.io/location
```

Rotation only selects IPs within the ASN chosen at setup — it will not switch ISP/ASN.

### Country-filtered rotation

```bash
curl -x disp.oxylabs.io:8000 -U "user-USERNAME-country-US:PASSWORD" https://ip.oxylabs.io/location
```

### Location targeting

No username params needed — use the port assigned to the desired location's IP in your proxy list.

### ASN verification

GeoIP databases may show original IP owner, not current ISP. For accurate ASN data, check [RIPEstat](https://stat.ripe.net/).

### Protocols

| Protocol | Example |
|----------|---------|
| HTTP | `http://disp.oxylabs.io:8001` |
| HTTPS | `https://disp.oxylabs.io:8001` |
| SOCKS5 (TCP+UDP) | `socks5h://user-USER:PASS@disp.oxylabs.io:8001` |

SOCKS5 may be detected by some sites — prefer HTTP/HTTPS if blocked.

### Python pattern

```python
import os, requests

user = os.environ["OXY_DC_USERNAME"]
pwd = os.environ["OXY_DC_PASSWORD"]
port = 8001  # 8000 for rotation

proxies = {
    "http": f"http://user-{user}:{pwd}@disp.oxylabs.io:{port}",
    "https": f"http://user-{user}:{pwd}@disp.oxylabs.io:{port}",
}
resp = requests.get("https://ip.oxylabs.io/location", proxies=proxies)
```

### Whitelisting (dashboard)

**Dedicated ISP Proxies → Whitelist** — up to 10 IPv4 addresses. Prefer username/password auth on cloud VMs.

### Fair usage (concurrent sessions)

Per proxy IP per billing cycle:
- Under 100 GB usage: 100 concurrent sessions per proxy
- Over 100 GB usage: 10 concurrent sessions per proxy (until cycle ends)

Exceeding limit → `429 Too Many Requests`.

---

## Enterprise

Same architecture as Dedicated Datacenter Enterprise. Credentials and proxy list URLs from Account Manager.

### Direct IP access

| Auth method | Port | Credentials |
|-------------|------|-------------|
| Username/password | `60000` | Required |
| Whitelisted IP | `65432` | None |

```bash
curl -x 1.2.3.4:60000 -U "USERNAME:PASSWORD" https://ip.oxylabs.io/location
curl -x 1.2.3.4:65432 https://ip.oxylabs.io/location  # whitelisted
```

### Proxy list retrieval

```bash
curl -u "USERNAME:PASSWORD" https://proxy.oxylabs.io/all
```

**REST API:**

| Endpoint | Purpose |
|----------|---------|
| `GET https://api.oxylabs.io/v1/proxies/lists` | List all proxy lists |
| `GET https://api.oxylabs.io/v1/proxies/lists/{uuid}` | Get specific list |

### Proxy Rotator (optional)

Contact Account Manager for domain. **Always port `60000`.** Rotation stays within selected ASNs.

```bash
curl -x vm.oxylabs.io:60000 -U "USERNAME:PASSWORD" https://ip.oxylabs.io/location
```

**Sticky session** — `Proxy-Server: s{N}` header:

```bash
curl -x vm.oxylabs.io:60000 -U "USER:PASS" https://ip.oxylabs.io/location \
  --proxy-header "Proxy-Server: s10"
```

### Whitelist REST API

| Method | Endpoint | Notes |
|--------|----------|-------|
| `GET` | `https://api.oxylabs.io/v1/whitelisted_ips` | List IPs + ids (`200`) |
| `POST` | `https://api.oxylabs.io/v1/whitelisted_ips` | Add one — body `{"address": "x.x.x.x"}` (`201`, `422` invalid) |
| `DELETE` | `https://api.oxylabs.io/v1/whitelisted_ips/{id}` | Remove by id (`204`) |
| `POST` | `https://api.oxylabs.io/v1/whitelisted_ips/upload_to_servers` | Apply changes to servers (`202`; 5-min cooldown → `429`) |

Add/delete changes only take effect after calling `upload_to_servers`.

### Proxy management API

OpenAPI spec: https://dc-api-spec.oxylabs.io/ — add/replace subnets, check offline IPs.

### Protocols (Enterprise)

Default: HTTP (80), HTTPS (443). SOCKS5 requires support activation.

---

## Response Codes

| Code | Meaning |
|------|---------|
| `400` | Bad request — malformed request |
| `403` | Forbidden — restricted target |
| `404` | Domain not found / resource unavailable |
| `407` | Missing/wrong credentials or IP not whitelisted |
| `429` | Concurrent session limit reached |
| `500` | Internal server error |
| `502` | Invalid upstream response |
| `503` | DNS failure to target |
| `504` | Gateway timeout (~60s) |

## Restricted Targets

Blocked by default (contact support@oxylabs.io): streaming, banking, government, gaming, ticketing, mail. Same categories as Dedicated Datacenter.

## Dedicated ISP vs Dedicated Datacenter

| | Dedicated Datacenter | Dedicated ISP |
|--|---------------------|---------------|
| Entry point | `ddc.oxylabs.io` | `disp.oxylabs.io` |
| IP type | Datacenter | ISP-registered |
| Trust/anonymity | Lower | Higher |
| ASN control | N/A | Chosen at purchase, locked |
| Best for | High-volume, speed | E-commerce, account mgmt, brand protection |
