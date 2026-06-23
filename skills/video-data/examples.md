# Video Data Code Examples

## Video Data API

### cURL

**Get video metadata:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "youtube_metadata",
    "query": "dQw4w9WgXcQ"
  }'
```

**Search YouTube:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "youtube_search",
    "query": "machine learning tutorial"
  }'
```

**Get video transcript:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "youtube_transcript",
    "query": "dQw4w9WgXcQ"
  }'
```

**Get subtitles:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "youtube_subtitles",
    "query": "dQw4w9WgXcQ"
  }'
```

**Get channel data:**
```bash
curl -X POST 'https://realtime.oxylabs.io/v1/queries' \
  -u "$OXY_WSA_USERNAME:$OXY_WSA_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{
    "source": "youtube_channel",
    "query": "@MrBeast"
  }'
```

### Python

**Video metadata:**
```python
import requests
import os

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]

response = requests.post(
    "https://realtime.oxylabs.io/v1/queries",
    auth=(username, password),
    json={
        "source": "youtube_metadata",
        "query": "dQw4w9WgXcQ"  # Video ID
    }
)

data = response.json()
metadata = data["results"][0]["content"]
print(f"Title: {metadata.get('title')}")
print(f"Views: {metadata.get('view_count')}")
print(f"Likes: {metadata.get('like_count')}")
```

**YouTube search:**
```python
import requests
import os

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]

response = requests.post(
    "https://realtime.oxylabs.io/v1/queries",
    auth=(username, password),
    json={
        "source": "youtube_search",
        "query": "python web scraping"
    }
)

data = response.json()
results = data["results"][0]["content"]

for video in results.get("videos", []):
    print(f"Title: {video.get('title')}")
    print(f"URL: {video.get('url')}")
    print("---")
```

**Get transcript:**
```python
import requests
import os

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]

response = requests.post(
    "https://realtime.oxylabs.io/v1/queries",
    auth=(username, password),
    json={
        "source": "youtube_transcript",
        "query": "dQw4w9WgXcQ"
    }
)

data = response.json()
transcript = data["results"][0]["content"]
print(transcript)
```

### Node.js

**Video metadata:**
```javascript
const axios = require("axios");

const username = process.env.OXY_WSA_USERNAME;
const password = process.env.OXY_WSA_PASSWORD;

async function getVideoMetadata(videoId) {
  const response = await axios.post(
    "https://realtime.oxylabs.io/v1/queries",
    {
      source: "youtube_metadata",
      query: videoId
    },
    {
      auth: { username, password }
    }
  );

  return response.data.results[0].content;
}

getVideoMetadata("dQw4w9WgXcQ")
  .then(metadata => console.log(metadata))
  .catch(err => console.error(err));
```

**Search and get transcripts:**
```javascript
const axios = require("axios");

const username = process.env.OXY_WSA_USERNAME;
const password = process.env.OXY_WSA_PASSWORD;

async function searchYouTube(query) {
  const response = await axios.post(
    "https://realtime.oxylabs.io/v1/queries",
    {
      source: "youtube_search",
      query: query
    },
    {
      auth: { username, password }
    }
  );

  return response.data.results[0].content;
}

async function getTranscript(videoId) {
  const response = await axios.post(
    "https://realtime.oxylabs.io/v1/queries",
    {
      source: "youtube_transcript",
      query: videoId
    },
    {
      auth: { username, password }
    }
  );

  return response.data.results[0].content;
}

// Example usage
(async () => {
  const results = await searchYouTube("nodejs tutorial");
  console.log("Search results:", results);

  const transcript = await getTranscript("VIDEO_ID");
  console.log("Transcript:", transcript);
})();
```

---

## High-Bandwidth Proxies (yt-dlp)

### Command Line

**With session rotation:**
```bash
# Each download gets a unique IP
yt-dlp --proxy $OXY_WSA_USERNAME-$((1 + RANDOM % 100000)):$OXY_WSA_PASSWORD@$OXY_HB_ENDPOINT:60000 \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Python with yt-dlp

**Basic download:**
```python
import yt_dlp
import os
import uuid

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]
endpoint = os.environ["OXY_HB_ENDPOINT"]
session_id = str(uuid.uuid4()).replace("-", "")

ydl_opts = {
    "proxy": f"http://{username}-{session_id}:{password}@{endpoint}:60000",
    "format": "best",
    "outtmpl": "downloads/%(title)s.%(ext)s"
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(["https://www.youtube.com/watch?v=VIDEO_ID"])
```

**Audio extraction:**
```python
import yt_dlp
import os
import uuid

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]
endpoint = os.environ["OXY_HB_ENDPOINT"]
session_id = str(uuid.uuid4()).replace("-", "")

ydl_opts = {
    "proxy": f"http://{username}-{session_id}:{password}@{endpoint}:60000",
    "format": "bestaudio/best",
    "postprocessors": [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": "mp3",
        "preferredquality": "192"
    }],
    "outtmpl": "audio/%(title)s.%(ext)s"
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(["https://www.youtube.com/watch?v=VIDEO_ID"])
```

**Batch download with IP rotation:**
```python
import yt_dlp
import os
import uuid

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]
endpoint = os.environ["OXY_HB_ENDPOINT"]

video_urls = [
    "https://www.youtube.com/watch?v=VIDEO_ID_1",
    "https://www.youtube.com/watch?v=VIDEO_ID_2",
    "https://www.youtube.com/watch?v=VIDEO_ID_3"
]

for url in video_urls:
    # New session ID for each video = new IP
    session_id = str(uuid.uuid4()).replace("-", "")

    ydl_opts = {
        "proxy": f"http://{username}-{session_id}:{password}@{endpoint}:60000",
        "format": "best",
        "outtmpl": "downloads/%(title)s.%(ext)s"
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            ydl.download([url])
            print(f"Downloaded: {url}")
        except Exception as e:
            print(f"Failed: {url} - {e}")
```

**Get video info without downloading:**
```python
import yt_dlp
import os
import uuid

username = os.environ["OXY_WSA_USERNAME"]
password = os.environ["OXY_WSA_PASSWORD"]
endpoint = os.environ["OXY_HB_ENDPOINT"]
session_id = str(uuid.uuid4()).replace("-", "")

ydl_opts = {
    "proxy": f"http://{username}-{session_id}:{password}@{endpoint}:60000",
    "skip_download": True
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(
        "https://www.youtube.com/watch?v=VIDEO_ID",
        download=False
    )
    print(f"Title: {info['title']}")
    print(f"Duration: {info['duration']} seconds")
    print(f"View count: {info['view_count']}")
```
