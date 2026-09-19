"""
stream_server.py — HTTP server that exposes the webcam + eye tracking pipeline
to the Next.js dashboard.

Endpoints
─────────
GET /video_feed   MJPEG stream (use as <img src="http://localhost:5001/video_feed">)
GET /metrics      JSON snapshot of the latest cognitive_data dict
GET /health       Liveness check

ESP32 / LED ring push
──────────────────────
When ESP32_ENABLED=true, the capture loop pushes a JSON payload to the ESP32
once per second.  The payload includes the cognitive score AND the RGB colour
for the 12-LED ring so the firmware just calls strip.fill() with no extra logic:

  {"load": 85, "r": 255, "g": 80, "b": 0, "leds": 12}

Colour mapping:
  LOW    (0–33)  → green  (0, 200, 60)   — calm, in flow
  MEDIUM (34–66) → orange (255, 120, 0)  — elevated, pay attention
  HIGH   (67–100)→ red    (255, 20, 20)  — overloaded, take a break

Configure via environment variables (see .env.example).

Run with:
    python3 stream_server.py

The server runs on port 5001 to avoid conflicts with the Next.js dev server on 3000.
"""

import os
import threading
import time
import json
import cv2
import urllib.request
from flask import Flask, Response

from eye_tracking import EyeTracker
from blink_detection import BlinkTracker
from cognitive_load import CognitiveLoadScorer
from data_logger import SessionLogger
from utils import draw_overlay, draw_cognitive_load_indicator

app = Flask(__name__)

# ─── ESP32 config (read once at startup) ──────────────────────────────────────
_ESP32_ENABLED  = os.environ.get('ESP32_ENABLED', 'false').lower() == 'true'
_ESP32_ENDPOINT = os.environ.get('ESP32_ENDPOINT', 'http://10.213.16.171/load')
_ESP32_INTERVAL = float(os.environ.get('ESP32_INTERVAL_SEC', '1.0'))
_LED_COUNT      = int(os.environ.get('ESP32_LED_COUNT', '12'))

# ─── Shared state ─────────────────────────────────────────────────────────────
# Written by the capture thread, read by Flask route handlers.
# A plain dict + a lock is sufficient — no queue needed since we only ever
# want the *latest* frame and metrics, not a backlog.

_lock = threading.Lock()

_latest_frame: bytes | None = None          # JPEG-encoded bytes
_cognitive_data: dict = {
    'blink_count':          0,
    'blink_rate':           0.0,
    'eye_closed':           False,
    'eye_closure_duration': 0.0,
    'ear_value':            0.0,
    'eye_status':           'OPEN',
    'drowsy':               False,
    'system_status':        'Starting',
    'session_elapsed':      0.0,
    'cognitive_score':      0,
    'cognitive_level':      'LOW',
    'face_detected':        False,
}


# ─── LED colour mapping ────────────────────────────────────────────────────────

def _score_to_rgb(score: int) -> tuple[int, int, int]:
    """
    Map a 0–100 cognitive load score to an RGB colour for the 12-LED ring.

    LOW    (0–33)  → green  — calm / in flow
    MEDIUM (34–66) → orange — elevated, worth noticing
    HIGH   (67–100)→ red    — overloaded, take a break

    Within each band the brightness scales linearly with the score so the ring
    gets gradually more intense as load climbs — giving a smooth visual ramp
    rather than three hard steps.
    """
    score = max(0, min(100, score))

    if score <= 33:
        # Green: dim at 0, full brightness at 33
        intensity = int(80 + (score / 33) * 120)   # 80 → 200
        return (0, intensity, int(intensity * 0.3))

    elif score <= 66:
        # Orange: transitions from yellow-green to deep orange
        t = (score - 34) / 32                       # 0.0 → 1.0
        r = int(180 + t * 75)                       # 180 → 255
        g = int(120 - t * 60)                       # 120 → 60
        return (r, g, 0)

    else:
        # Red: grows more intense toward 100
        t = (score - 67) / 33                       # 0.0 → 1.0
        r = 255
        g = int(20 - t * 20)                        # 20 → 0
        return (r, g, 0)


# ─── ESP32 push ───────────────────────────────────────────────────────────────

def _push_to_esp32(score: int) -> None:
    """
    POST cognitive load score + LED colour to the ESP32 in a fire-and-forget
    daemon thread.

    Payload:
        {
          "load": 85,       // cognitive score 0-100
          "r": 255,         // red   channel 0-255
          "g": 20,          // green channel 0-255
          "b": 0,           // blue  channel 0-255
          "leds": 12        // total LEDs in the ring (all set to same colour)
        }

    The ESP32 firmware only needs to do:
        strip.fill((r, g, b))
        strip.show()

    Errors are logged but never propagate — hardware unavailability must not
    crash or slow the capture loop.
    """
    if not _ESP32_ENABLED:
        return

    r, g, b = _score_to_rgb(score)

    def _send():
        try:
            payload = json.dumps({
                'load': score,
                'r':    r,
                'g':    g,
                'b':    b,
                'leds': _LED_COUNT,
            }).encode('utf-8')

            req = urllib.request.Request(
                _ESP32_ENDPOINT,
                data=payload,
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.getcode() != 200:
                    print(f"[ESP32] Unexpected status {resp.getcode()}")
        except Exception as e:
            print(f"[ESP32] Push failed: {e}")

    threading.Thread(target=_send, daemon=True).start()


# ─── Capture thread ───────────────────────────────────────────────────────────

def capture_loop() -> None:
    """
    Runs the full eye-tracking pipeline in a background thread.
    Writes annotated JPEG frames and metric dicts to shared globals.
    """
    global _latest_frame, _cognitive_data

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[stream_server] ERROR: Could not open webcam.")
        with _lock:
            _cognitive_data['system_status'] = 'Camera Error'
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    eye_tracker   = EyeTracker()
    blink_tracker = BlinkTracker()
    scorer        = CognitiveLoadScorer()
    logger        = SessionLogger(interval_sec=1.0)

    _last_esp32_push: float = 0.0   # timestamp of last successful push

    print("[stream_server] Capture loop started.")
    if _ESP32_ENABLED:
        print(f"[stream_server] ESP32 push ENABLED → {_ESP32_ENDPOINT} every {_ESP32_INTERVAL}s")
    else:
        print("[stream_server] ESP32 push DISABLED (set ESP32_ENABLED=true to enable)")

    try:
        while True:
            success, frame = cap.read()
            if not success:
                print("[stream_server] WARNING: Failed to read frame.")
                time.sleep(0.05)
                continue

            frame = cv2.flip(frame, 1)

            ear, left_pts, right_pts = eye_tracker.process(frame)
            face_detected = ear is not None

            if ear is not None:
                result = blink_tracker.update(ear)
                score, level = scorer.update(
                    blink_rate=result['blink_rate'],
                    eye_closed=result['eye_closed'],
                    blink_timestamps=blink_tracker._blink_timestamps,
                )

                new_data = {
                    'blink_count':          result['blink_count'],
                    'blink_rate':           result['blink_rate'],
                    'eye_closed':           result['eye_closed'],
                    'eye_closure_duration': result['closure_duration'],
                    'ear_value':            ear,
                    'eye_status':           result['eye_status'],
                    'drowsy':               result['drowsy'],
                    'system_status':        result['system_status'],
                    'session_elapsed':      result['session_elapsed'],
                    'cognitive_score':      score,
                    'cognitive_level':      level,
                    'face_detected':        True,
                }

                draw_overlay(frame, {
                    'blink_count':      result['blink_count'],
                    'blink_rate':       result['blink_rate'],
                    'ear':              ear,
                    'eye_status':       result['eye_status'],
                    'closure_duration': result['closure_duration'],
                    'drowsy':           result['drowsy'],
                    'system_status':    result['system_status'],
                    'session_elapsed':  result['session_elapsed'],
                })
                draw_cognitive_load_indicator(frame, score, level)

            else:
                with _lock:
                    prev = dict(_cognitive_data)

                new_data = {**prev, 'system_status': 'No Face Detected', 'face_detected': False}

                draw_overlay(frame, {
                    'blink_count':      prev['blink_count'],
                    'blink_rate':       prev['blink_rate'],
                    'ear':              0.0,
                    'eye_status':       '---',
                    'closure_duration': 0.0,
                    'drowsy':           False,
                    'system_status':    'No Face Detected',
                    'session_elapsed':  prev['session_elapsed'],
                })
                draw_cognitive_load_indicator(
                    frame, prev['cognitive_score'], prev['cognitive_level']
                )

            logger.log(new_data)

            # Encode frame as JPEG
            ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                jpeg_bytes = buf.tobytes()
                with _lock:
                    _latest_frame = jpeg_bytes
                    _cognitive_data = new_data

            # ── ESP32 push (throttled to _ESP32_INTERVAL seconds) ─────────────
            now = time.time()
            if _ESP32_ENABLED and (now - _last_esp32_push) >= _ESP32_INTERVAL:
                _push_to_esp32(new_data['cognitive_score'])
                _last_esp32_push = now

    finally:
        eye_tracker.close()
        logger.close()
        cap.release()
        print("[stream_server] Capture loop stopped.")


# ─── MJPEG generator ──────────────────────────────────────────────────────────

def _mjpeg_generator():
    """Yields MJPEG multipart frames at ~30 fps."""
    while True:
        with _lock:
            frame = _latest_frame

        if frame is None:
            time.sleep(0.033)
            continue

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n'
            + frame +
            b'\r\n'
        )
        time.sleep(0.033)   # ~30 fps cap


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/video_feed')
def video_feed():
    return Response(
        _mjpeg_generator(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )


@app.route('/metrics')
def metrics():
    with _lock:
        data = dict(_cognitive_data)
    return Response(
        json.dumps(data),
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )


@app.route('/health')
def health():
    with _lock:
        status = _cognitive_data.get('system_status', 'Unknown')
    return Response(
        json.dumps({'status': 'ok', 'pipeline': status}),
        mimetype='application/json',
        headers={'Access-Control-Allow-Origin': '*'},
    )


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # Start capture in a daemon thread so it dies cleanly with the server
    t = threading.Thread(target=capture_loop, daemon=True)
    t.start()

    print("[stream_server] Serving on http://localhost:5001")
    print("[stream_server]   MJPEG stream : http://localhost:5001/video_feed")
    print("[stream_server]   Metrics JSON : http://localhost:5001/metrics")
    print("[stream_server]   Health check : http://localhost:5001/health")

    # use_reloader=False is critical — reloader forks the process and
    # would start a second capture thread that fights over the webcam.
    app.run(host='0.0.0.0', port=5001, threaded=True, use_reloader=False)
