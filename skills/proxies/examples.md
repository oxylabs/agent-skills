# Proxy Code Examples

Residential/Mobile examples use `OXY_RES_USERNAME`, `OXY_RES_PASSWORD`.
Datacenter, ISP, and dedicated examples use `OXY_DC_USERNAME`, `OXY_DC_PASSWORD`.

## Dedicated Datacenter (Self-Service)

**Sticky IP (port 8001):**
```bash
curl -x ddc.oxylabs.io:8001 -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  https://ip.oxylabs.io/location
```

**Rotation (port 8000) with country filter:**
```bash
curl -x ddc.oxylabs.io:8000 \
  -U "user-$OXY_DC_USERNAME-country-US:$OXY_DC_PASSWORD" \
  https://ip.oxylabs.io/location
```

```python
import os, requests

user, pwd = os.environ["OXY_DC_USERNAME"], os.environ["OXY_DC_PASSWORD"]
port = 8000  # 8001+ for sticky IP from proxy list

proxies = {
    "http": f"http://user-{user}:{pwd}@ddc.oxylabs.io:{port}",
    "https": f"http://user-{user}:{pwd}@ddc.oxylabs.io:{port}",
}
print(requests.get("https://ip.oxylabs.io/location", proxies=proxies).json())
```

## Dedicated ISP (Self-Service)

**Sticky IP (port 8001):**
```bash
curl -x disp.oxylabs.io:8001 -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  https://ip.oxylabs.io/location
```

**Rotation (port 8000):**
```bash
curl -x disp.oxylabs.io:8000 -U "user-$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  https://ip.oxylabs.io/location
```

```python
import os, requests

user, pwd = os.environ["OXY_DC_USERNAME"], os.environ["OXY_DC_PASSWORD"]
proxies = {
    "http": f"http://user-{user}:{pwd}@disp.oxylabs.io:8001",
    "https": f"http://user-{user}:{pwd}@disp.oxylabs.io:8001",
}
print(requests.get("https://ip.oxylabs.io/location", proxies=proxies).json())
```

## Dedicated Enterprise (Direct IP)

```bash
# Username/password on port 60000
curl -x 1.2.3.4:60000 -U "$OXY_DC_USERNAME:$OXY_DC_PASSWORD" \
  https://ip.oxylabs.io/location

# Whitelisted IP on port 65432 (no credentials)
curl -x 1.2.3.4:65432 https://ip.oxylabs.io/location
```

**Proxy Rotator with sticky session:**
```python
import os, requests

user = os.environ["OXY_DC_USERNAME"]
pwd = os.environ["OXY_DC_PASSWORD"]

class ProxyAdapter(requests.adapters.HTTPAdapter):
    def proxy_headers(self, proxy):
        headers = super().proxy_headers(proxy)
        headers["Proxy-Server"] = "s10"  # sticky to proxy #10
        return headers

s = requests.Session()
s.proxies = {"https": f"http://{user}:{pwd}@vm.oxylabs.io:60000"}
s.mount("https://", ProxyAdapter())
print(s.get("https://ip.oxylabs.io/location").text)
```

## cURL

**Residential proxy:**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME:$OXY_RES_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

**With geo-targeting:**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-cc-US-city-los_angeles:$OXY_RES_PASSWORD" \
  "https://ip.oxylabs.io/location"
```

**With sticky session:**
```bash
curl -x "pr.oxylabs.io:7777" \
  -U "customer-$OXY_RES_USERNAME-cc-DE-sessid-session123:$OXY_RES_PASSWORD" \
  "https://example.com"
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

## Python

**Residential proxy:**
```python
import requests
import os

username = os.environ["OXY_RES_USERNAME"]
password = os.environ["OXY_RES_PASSWORD"]

proxies = {
    "http": f"http://customer-{username}:{password}@pr.oxylabs.io:7777",
    "https": f"http://customer-{username}:{password}@pr.oxylabs.io:7777",
}

response = requests.get("https://ip.oxylabs.io/location", proxies=proxies)
print(response.json())
```

**With geo-targeting and session:**
```python
import requests
import os

username = os.environ["OXY_RES_USERNAME"]
password = os.environ["OXY_RES_PASSWORD"]

# US, New York, sticky session
proxy_user = f"customer-{username}-cc-US-city-new_york-sessid-abc123"

proxies = {
    "http": f"http://{proxy_user}:{password}@pr.oxylabs.io:7777",
    "https": f"http://{proxy_user}:{password}@pr.oxylabs.io:7777"
}

response = requests.get("https://example.com", proxies=proxies)
print(response.text)
```

**Datacenter proxy:**
```python
import requests
import os

username = os.environ["OXY_DC_USERNAME"]
password = os.environ["OXY_DC_PASSWORD"]

proxies = {
    "http": f"http://user-{username}:{password}@dc.oxylabs.io:8000",
    "https": f"http://user-{username}:{password}@dc.oxylabs.io:8000"
}

response = requests.get("https://ip.oxylabs.io/location", proxies=proxies)
print(response.json())
```

## Node.js

**Residential proxy:**
```javascript
const axios = require("axios");

const username = process.env.OXY_RES_USERNAME;
const password = process.env.OXY_RES_PASSWORD;

const proxy = {
  host: "pr.oxylabs.io",
  port: 7777,
  auth: {
    username: `customer-${username}`,
    password: password
  }
};

axios.get("https://ip.oxylabs.io/location", { proxy })
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
```

**With geo-targeting:**
```javascript
const axios = require("axios");

const username = process.env.OXY_RES_USERNAME;
const password = process.env.OXY_RES_PASSWORD;

const proxy = {
  host: "pr.oxylabs.io",
  port: 7777,
  auth: {
    username: `customer-${username}-cc-GB-city-london`,
    password: password
  }
};

axios.get("https://example.com", { proxy })
  .then(response => console.log(response.data));
```

## PHP

**Residential proxy:**
```php
<?php
$username = getenv('OXY_RES_USERNAME');
$password = getenv('OXY_RES_PASSWORD');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://ip.oxylabs.io/location");
curl_setopt($ch, CURLOPT_PROXY, "http://pr.oxylabs.io:7777");
curl_setopt($ch, CURLOPT_PROXYUSERPWD, "customer-$username:$password");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
```

**With geo-targeting:**
```php
<?php
$username = getenv('OXY_RES_USERNAME');
$password = getenv('OXY_RES_PASSWORD');

$proxyUser = "customer-$username-cc-US-city-chicago-sessid-mysession";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://example.com");
curl_setopt($ch, CURLOPT_PROXY, "http://pr.oxylabs.io:7777");
curl_setopt($ch, CURLOPT_PROXYUSERPWD, "$proxyUser:$password");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
```

## Go

```go
package main

import (
    "fmt"
    "io"
    "net/http"
    "net/url"
    "os"
)

func main() {
    username := os.Getenv("OXY_RES_USERNAME")
    password := os.Getenv("OXY_RES_PASSWORD")

    proxyURL, _ := url.Parse(fmt.Sprintf(
        "http://customer-%s:%s@pr.oxylabs.io:7777",
        username, password,
    ))

    client := &http.Client{
        Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
    }

    resp, _ := client.Get("https://ip.oxylabs.io/location")
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```

## Java

```java
import java.net.*;
import java.io.*;

public class OxylabsProxy {
    public static void main(String[] args) throws Exception {
        String username = System.getenv("OXY_RES_USERNAME");
        String password = System.getenv("OXY_RES_PASSWORD");

        Proxy proxy = new Proxy(Proxy.Type.HTTP,
            new InetSocketAddress("pr.oxylabs.io", 7777));

        Authenticator.setDefault(new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(
                    "customer-" + username,
                    password.toCharArray()
                );
            }
        });

        URL url = new URL("https://ip.oxylabs.io/location");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection(proxy);

        BufferedReader reader = new BufferedReader(
            new InputStreamReader(conn.getInputStream()));
        String line;
        while ((line = reader.readLine()) != null) {
            System.out.println(line);
        }
        reader.close();
    }
}
```

## Ruby

```ruby
require 'net/http'
require 'uri'

username = ENV['OXY_RES_USERNAME']
password = ENV['OXY_RES_PASSWORD']

proxy_host = 'pr.oxylabs.io'
proxy_port = 7777
proxy_user = "customer-#{username}"

uri = URI.parse('https://ip.oxylabs.io/location')

Net::HTTP.start(uri.host, uri.port,
  proxy_host, proxy_port, proxy_user, password,
  use_ssl: true) do |http|

  request = Net::HTTP::Get.new(uri)
  response = http.request(request)
  puts response.body
end
```
