# Live classes server — runbook (P12-07)

How to run the video server for IELTS live classes and recordings (spec IEL-14, IEL-15; design §9.10 "IELTS reformation"). Written on 17 Nov 2026, before any server exists. **Nothing here has been deployed yet.** The owner chooses the host and the sub-domain first, and the live-class code ships switched off (feature `live_classes`) until then.

Check every setting against the LiveKit documentation for the version you install. The names below are LiveKit's current ones, but they can change between releases.

## 1. What runs where

| Piece | What it does | Where |
| --- | --- | --- |
| **LiveKit server** (`livekit/livekit-server`, Apache 2.0) | The SFU: receives each camera, microphone and screen once and forwards it to everyone in the class; built-in TURN for networks that block UDP | Its own server, close to Bangladesh, with cheap or included outgoing traffic |
| **LiveKit Egress** (`livekit/egress`, Apache 2.0) | Records a class (composite layout) as HLS segments straight into our S3 bucket | Same server to start; its own server once several classes record at once |
| **Redis** | LiveKit and Egress talk through it | Same server (a small Redis just for LiveKit, not the API's) |
| **Our API** | Starts classes, gives join tokens, receives LiveKit's webhooks, marks attendance, counts usage | Unchanged (beta / AWS) |

The API never carries video. Browsers and phones connect to LiveKit directly with a short-lived token from our API.

## 2. Choosing the server

- **Outgoing traffic is the cost.** A 3-hour class with 30 students is roughly 40 GB sent; AWS charges for every GB. Prefer a provider whose price includes several TB of traffic, or a Bangladeshi host with BDIX.
- **Start size:** 4 vCPU, 8 GB RAM is enough for a few classes at once plus one recording. Each recording running at the same time needs about 2–4 more cores; move Egress to its own machine when recordings queue.
- **Network:** a public IPv4 address and these ports open:

| Port | Protocol | For |
| --- | --- | --- |
| 443 | TCP | Signalling over TLS (`wss://live.<domain>`) behind a reverse proxy |
| 7881 | TCP | Media over TCP when UDP is blocked |
| 50000–60000 | UDP | Media (the normal path) |
| 3478 | UDP | TURN |
| 5349 | TCP | TURN over TLS |

- **DNS:** `live.instructor.academy` (production) and `live-beta.instructor.academy` (beta) pointing at the server, plus a TURN name if TURN gets its own certificate (for example `turn.instructor.academy`).

## 3. Secrets (never in the repository)

Generate an API key and secret for LiveKit (`livekit-server generate-keys`). Then set:

- **On the LiveKit server**, in its own environment or config (not in git):
  - the key and secret;
  - the S3 access for Egress (an IAM user that may only write `org/*/live/*` in the bucket).
- **On the API**, in `.env.production` or the beta `.env`, by the owner (Claude Code never edits `.env`):
  - `LIVEKIT_URL` (the `wss://` address students connect to);
  - `LIVEKIT_API_URL` (the `https://` address the API calls);
  - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

  The names come with P12-08 and are listed in `env.example`.

## 4. Configuration sketch

`livekit.yaml` (values in `<>` come from section 3; the secret goes in through the environment, not this file in git):

```yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
redis:
  address: localhost:6379
keys:
  <api key>: <api secret>
turn:
  enabled: true
  domain: turn.instructor.academy
  tls_port: 5349
  udp_port: 3478
webhook:
  api_key: <api key>
  urls:
    - https://api.instructor.academy/api/v1/live/webhook
```

`egress.yaml`:

```yaml
api_key: <api key>
api_secret: <api secret>
ws_url: ws://localhost:7880
redis:
  address: localhost:6379
s3:
  region: ap-southeast-1
  bucket: <the files bucket>
  access_key: <egress IAM key>
  secret: <egress IAM secret>
```

Run both with Docker (`livekit/livekit-server` with `--network host`, `livekit/egress` with the config mounted) behind a reverse proxy (Caddy or nginx) that terminates TLS on 443 for the `live.` name and forwards to 7880.

## 5. Turning it on

1. Create the server, open the ports, point the DNS name, and start LiveKit, Egress and Redis.
2. Check from a laptop with LiveKit's connection test tool and a token from the LiveKit CLI: it must pass over UDP and over TCP.
3. Put the four `LIVEKIT_*` values in the API's environment and restart the API.
4. In Admin → Plans or Admin → Organisations, switch `live_classes` on for a test organisation (Bright Path IELTS on beta).
5. Start a live class from a test course, join from a second browser and a phone, record it, and check the recording plays and the attendance is marked.
6. Only then switch `live_classes` on in the plans that sell it.

## 6. Watching it

- **Health:** LiveKit answers `GET /` on 7880; add it to the uptime checks.
- **Load:** CPU on the Egress machine while recording, and outgoing traffic per day against the plan's included traffic.
- **Costs:** the usage report (P12-06) counts live minutes, recorded minutes and replay minutes per organisation, so each organisation's price can be compared with its use.

## 7. Recordings

- **Storage:** recordings go to `org/{orgId}/live/{classId}/` in the files bucket as HLS.
- **Viewing:** students watch through short-lived signed links (watch-only).
- **Retention:** recordings are kept as long as the organisation's plan allows (`recording_retention_days`).
- **Expired files:** whether their video files may be deleted from storage is **still the owner's decision** (asked on 16 Nov, not answered yet). Until then, expired recordings are hidden and their files are kept.
