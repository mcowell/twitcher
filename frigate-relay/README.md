# frigate-relay

Watches a [Frigate](https://frigate.video) NVR's MQTT events for bird detections and forwards them to Twitcher's `POST /ingest/frigate` for review, instead of identifying every detection automatically. A feeder camera can easily produce hundreds of detections a day — mostly the same few birds visiting repeatedly — so this stages them for manual approve/delete at `/admin/queue` rather than spending a Claude call on each one.

This is a standalone service, not part of `web`/`api`. It's meant to run on your own network (a Synology via Container Manager, in this project's case), since it needs local access to Frigate's MQTT broker and HTTP API — neither of which are reachable from a publicly-deployed API.

## How it works

1. Subscribes to `<MQTT_TOPIC_PREFIX>/events`.
2. For each finalized event (`type: "end"`) labeled `bird`, checks a per-camera cooldown (`COOLDOWN_MINUTES`) — skips it if that camera already had a bird submitted more recently than that, so the same repeat visitor doesn't get resubmitted all day.
3. Otherwise, fetches the event's snapshot from Frigate with `?bbox=0` (the bounding-box overlay stripped out — a box drawn over the bird is worse input for identification than a clean photo) and `POST`s it to Twitcher's ingestion endpoint.

Cooldown state is in-memory only — a container restart just means the next bird per camera gets submitted again, which is harmless.

## Setup

### 1. A dedicated MQTT user

Don't reuse Frigate's own MQTT login for this — a separate credential means a leak only exposes read access to bird events, not whatever Frigate's own user can do. In the Home Assistant Mosquitto add-on: **Settings → Add-ons → Mosquitto broker → Configuration**, add a new entry under `logins`:

```yaml
logins:
  - username: frigate
    password: <frigate's existing password>
  - username: bird-relay
    password: <a new, different password>
```

Save and restart the add-on.

### 2. Environment

Copy `.env.example` to `.env` and fill in:

| Var | Notes |
|---|---|
| `MQTT_HOST` / `MQTT_PORT` | Your Mosquitto broker |
| `MQTT_USER` / `MQTT_PASSWORD` | The dedicated `bird-relay` login from step 1 |
| `MQTT_TOPIC_PREFIX` | Must match Frigate's `mqtt.topic_prefix` config |
| `COOLDOWN_MINUTES` | Minutes before the same camera can submit another bird |
| `FRIGATE_HOST` / `FRIGATE_PORT` | Frigate's own HTTP API — usually the same host as MQTT |
| `API_BASE_URL` | Twitcher API's base URL, e.g. `https://api.yourdomain.com` |
| `INGEST_SECRET` | Must exactly match `FRIGATE_INGEST_SECRET` in `api/.env` |

### 3. Deploy via Container Manager

1. Copy this folder onto the NAS (any location Container Manager can reach).
2. Lock down that folder so only your own account can read it — it holds `.env` with real credentials in plaintext. On Synology: Control Panel → Shared Folder → the folder containing this → Edit → Permissions → deny "Everyone", explicitly grant your own account Read/Write (a blanket "Everyone: No Access" with no override for your own account will lock you out too, not just other users). Container Manager's Docker daemon runs as root and is unaffected either way.
3. Container Manager → **Project** → **Create**, point it at the folder — it'll pick up `docker-compose.yml` and the adjacent `.env` automatically.
4. Check the container's logs: you should see `Connected to MQTT broker, subscribing to frigate/events`, then `STAGED`/`SKIP` lines as birds show up.

## Local development

```sh
pip install -r requirements.txt
MQTT_HOST=... MQTT_USER=... MQTT_PASSWORD=... FRIGATE_HOST=... API_BASE_URL=... INGEST_SECRET=... python relay.py
```
