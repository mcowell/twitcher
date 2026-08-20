import json
import logging
import os
from datetime import datetime, timedelta

import paho.mqtt.client as mqtt
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("bird-relay")

MQTT_HOST = os.environ["MQTT_HOST"]
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USER = os.environ["MQTT_USER"]
MQTT_PASSWORD = os.environ["MQTT_PASSWORD"]
TOPIC_PREFIX = os.environ.get("MQTT_TOPIC_PREFIX", "frigate")
COOLDOWN_MINUTES = float(os.environ.get("COOLDOWN_MINUTES", "15"))

FRIGATE_HOST = os.environ["FRIGATE_HOST"]
FRIGATE_PORT = int(os.environ.get("FRIGATE_PORT", "5000"))

API_BASE_URL = os.environ["API_BASE_URL"].rstrip("/")
INGEST_SECRET = os.environ["INGEST_SECRET"]

TOPIC = f"{TOPIC_PREFIX}/events"

# Per-camera cooldown state, in memory only — resets if the container
# restarts, which just means the next bird on each camera gets submitted
# again regardless of when the last one was.
last_sent: dict[str, datetime] = {}


def submit_for_staging(camera: str, event_id: str, score, box) -> None:
    # bbox=0 asks Frigate for the snapshot without its bounding-box overlay
    # burned in — a cleaner image for identification than the annotated
    # one Frigate's own review UI shows.
    snapshot_url = f"http://{FRIGATE_HOST}:{FRIGATE_PORT}/api/events/{event_id}/snapshot.jpg?bbox=0"

    try:
        snapshot = requests.get(snapshot_url, timeout=10)
        snapshot.raise_for_status()
    except requests.RequestException:
        logger.exception("Failed to fetch snapshot for event %s", event_id)
        return

    # The actual crop math lives on the API side, where it's testable —
    # this just forwards Frigate's own box coordinates as-is.
    data = {"camera": camera, "eventId": event_id, "score": score if score is not None else ""}
    if box:
        data["box"] = json.dumps(box)

    try:
        response = requests.post(
            f"{API_BASE_URL}/ingest/frigate",
            headers={"Authorization": f"Bearer {INGEST_SECRET}"},
            files={"image": ("snapshot.jpg", snapshot.content, "image/jpeg")},
            data=data,
            timeout=20,
        )
        response.raise_for_status()
        logger.info("STAGED camera=%s event=%s score=%s box=%s", camera, event_id, score, box)
    except requests.RequestException:
        logger.exception("Failed to submit event %s to ingestion endpoint", event_id)


def on_connect(client, userdata, flags, rc):
    if rc != 0:
        logger.error("Failed to connect to MQTT broker (rc=%s)", rc)
        return
    logger.info("Connected to MQTT broker, subscribing to %s", TOPIC)
    client.subscribe(TOPIC)


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload)
    except json.JSONDecodeError:
        logger.warning("Received non-JSON message on %s", msg.topic)
        return

    # "end" is the finalized event, once Frigate has settled on its best
    # snapshot for this tracked object — "new"/"update" fire earlier and
    # more often, before the best frame is necessarily chosen.
    if payload.get("type") != "end":
        return

    event = payload.get("after") or {}
    if event.get("label") != "bird":
        return

    camera = event.get("camera", "unknown")
    event_id = event.get("id", "unknown")
    score = event.get("top_score") or event.get("score")
    box = event.get("box")
    now = datetime.now()

    last = last_sent.get(camera)
    if last and now - last < timedelta(minutes=COOLDOWN_MINUTES):
        remaining = (timedelta(minutes=COOLDOWN_MINUTES) - (now - last)).total_seconds() / 60
        logger.info(
            "SKIP  camera=%s event=%s score=%s (cooldown active, %.1f min remaining)",
            camera,
            event_id,
            score,
            remaining,
        )
        return

    last_sent[camera] = now
    submit_for_staging(camera, event_id, score, box)


def main():
    client = mqtt.Client(client_id="twitcher-bird-relay")
    client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.on_connect = on_connect
    client.on_message = on_message

    logger.info(
        "Connecting to %s:%s as %s (topic=%s, cooldown=%s min)",
        MQTT_HOST,
        MQTT_PORT,
        MQTT_USER,
        TOPIC,
        COOLDOWN_MINUTES,
    )
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
