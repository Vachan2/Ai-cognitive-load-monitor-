"""
stream_server.py — HTTP server that exposes the webcam + eye tracking pipeline
to the Next.js dashboard.

Endpoints
─────────
POST /session/start  Start camera-based monitoring
POST /session/stop   Stop camera-based monitoring and turn off LEDs
GET  /video_feed     MJPEG stream
GET  /metrics        JSON snapshot of the latest cognitive_data dict
GET  /health         Liveness check

ESP8266 / LED ring push
───────────────────────
When ESP8266_ENABLED=true, the capture loop pushes JSON to the configured
NodeMCU endpoint approximately once per second. Unchanged scores and colours
are suppressed. Low/Medium/High colours are green, yellow, and red.

Run with:
    python3 stream_server.py
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

# ─── ESP8266 config ──────────────────────────────────────────────────────────
_ESP8266_ENABLED  = os.environ.get('ESP8266_ENABLED', 'false').lower() == 'true'
_ESP8266_ENDPOINT = os.environ.get('ESP8266_ENDPOINT', 'http://10.31.8.171/load')
_ESP8266_INTERVAL = float(os.environ.get('ESP8266_INTERVAL_SEC', '1.0'))
_LED_COUNT        = int(os.environ.get('ESP8266_LED_COUNT', '12'))

_lock = threading.Lock()
_session_running = False
_capture_thread: threading.Thread | None = None
_latest_frame: bytes | None = None
_last_led_payload: tuple[int, int, int, int] | None = None
_cognitive_data: dict = {
    'blink_count': 0,
    'blink_rate': 0.0,
    'eye_closed': False,
    'eye_closure_duration': 0.0,
    'ear_value': 0.0,
    'eye_status': 'OPEN',
    'drowsy': False,
    'system_status': 'Stopped',
    'session_elapsed': 0.0,
    'cognitive_score': 0,
    'cognitive_level': 'LOW',
    'face_detected': False,
}


def _score_to_rgb(score: int) -> tuple[int, int, int]:
    """Map a 0–100 cognitive score to green, yellow, or red."""
    score = max(0, min(100, score))
    if score <= 33:
        return (0, 255, 0)
    if score <= 66:
        return (255, 255, 0)
    return (255, 0, 0)


def _send_led_payload(score: int, r: int, g: int, b: int) -> None:
    """Send an LED payload without allowing hardware failures to affect tracking."""
    if not _ESP8266_ENABLED:
        return

    payload = json.dumps({
        'load': score,
        'r': r,
        'g': g,
        'b': b,
        'leds': _LED_COUNT,
    }).encode('utf-8')

    def _send():
        try:
            req = urllib.request.Request(
                _ESP8266_ENDPOINT,
                data=payload,
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.getcode() != 200:
                    print(f"[ESP8266] Unexpected status {resp.getcode()}")
        except Exception as exc:
            print(f"[ESP8266] Push failed: {exc}")

    threading.Thread(target=_send, daemon=True).start()


def _push_to_esp8266(score: int) -> None:
    """Push only when the colour or score meaningfully changes."""
    global _last_led_payload

    r, g, b = _score_to_rgb(score)
    payload_key = (score, r, g, b)
    with _lock:
        if _last_led_payload == payload_key:
            return
        _last_led_payload = payload_key
    _send_led_payload(score, r, g, b)


def _turn_off_leds() -> None:
    global _last_led_payload
    _last_led_payload = None
    if _ESP8266_ENABLED:
        _send_led_payload(0, 0, 0, 0)


def capture_loop() -> None:
    """Run the camera pipeline only while a session is active."""
    global _latest_frame, _cognitive_data, _session_running

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[stream_server] ERROR: Could not open webcam.")
        with _lock:
            _session_running = False
            _cognitive_data['system_status'] = 'Camera Error'
        _turn_off_leds()
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    eye_tracker = EyeTracker()
    blink_tracker = BlinkTracker()
    scorer = CognitiveLoadScorer()
    logger = SessionLogger(interval_sec=1.0)
    _last_esp8266_push = 0.0

    print("[stream_server] Capture loop started.")
    if _ESP8266_ENABLED:
        print(f"[stream_server] ESP8266 push enabled → {_ESP8266_ENDPOINT} every {_ESP8266_INTERVAL}s")
    else:
        print("[stream_server] ESP8266 push disabled (set ESP8266_ENABLED=true to enable)")

    try:
        while True:
            with _lock:
                if not _session_running:
                    break

            success, frame = cap.read()
            if not success:
                print("[stream_server] WARNING: Failed to read frame.")
                time.sleep(0.05)
                continue

            frame = cv2.flip(frame, 1)
            ear, left_pts, right_pts = eye_tracker.process(frame)

            if ear is not None:
                result = blink_tracker.update(ear)
                score, level = scorer.update(
                    blink_rate=result['blink_rate'],
                    eye_closed=result['eye_closed'],
                    blink_timestamps=blink_tracker._blink_timestamps,
                )

                new_data = {
                    'blink_count': result['blink_count'],
                    'blink_rate': result['blink_rate'],
                    'eye_closed': result['eye_closed'],
                    'eye_closure_duration': result['closure_duration'],
                    'ear_value': ear,
                    'eye_status': result['eye_status'],
                    'drowsy': result['drowsy'],
                    'system_status': result['system_status'],
                    'session_elapsed': result['session_elapsed'],
                    'cognitive_score': score,
                    'cognitive_level': level,
                    'face_detected': True,
                }

                draw_overlay(frame, {
                    'blink_count': result['blink_count'],
                    'blink_rate': result['blink_rate'],
                    'ear': ear,
                    'eye_status': result['eye_status'],
                    'closure_duration': result['closure_duration'],
                    'drowsy': result['drowsy'],
                    'system_status': result['system_status'],
                    'session_elapsed': result['session_elapsed'],
                })
                draw_cognitive_load_indicator(frame, score, level)
            else:
                with _lock:
                    prev = dict(_cognitive_data)
                new_data = {**prev, 'system_status': 'No Face Detected', 'face_detected': False}
                draw_overlay(frame, {
                    'blink_count': prev['blink_count'],
                    'blink_rate': prev['blink_rate'],
                    'ear': 0.0,
                    'eye_status': '---',
                    'closure_duration': 0.0,
                    'drowsy': False,
                    'system_status': 'No Face Detected',
                    'session_elapsed': prev['session_elapsed'],
                })
                draw_cognitive_load_indicator(frame, prev['cognitive_score'], prev['cognitive_level'])

            logger.log(new_data)
            ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                with _lock:
                    _latest_frame = buf.tobytes()
                    _cognitive_data = new_data

            now = time.time()
            if _ESP8266_ENABLED and (now - _last_esp8266_push) >= _ESP8266_INTERVAL:
                _push_to_esp8266(new_data['cognitive_score'])
                _last_esp8266_push = now

    finally:
        eye_tracker.close()
        logger.close()
        cap.release()
        with _lock:
            _latest_frame = None
            _cognitive_data = {
                **_cognitive_data,
                'system_status': 'Stopped',
                'face_detected': False,
            }
        _turn_off_leds()
        print("[stream_server] Capture loop stopped.")


def _mjpeg_generator():
    while True:
        with _lock:
            frame = _latest_frame
            running = _session_running
        if frame is None or not running:
            time.sleep(0.033)
            continue
        yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
        time.sleep(0.033)


@app.route('/session/start', methods=['POST'])
def session_start():
    global _session_running, _capture_thread
    with _lock:
        _session_running = True
        already_running = _capture_thread is not None and _capture_thread.is_alive()
    if not already_running:
        _capture_thread = threading.Thread(target=capture_loop, daemon=True, name='camera-capture')
        _capture_thread.start()
    return Response(json.dumps({'status': 'started'}), mimetype='application/json')


@app.route('/session/stop', methods=['POST'])
def session_stop():
    global _session_running
    with _lock:
        _session_running = False
        _latest_frame = None
        _cognitive_data = {**_cognitive_data, 'system_status': 'Stopped', 'face_detected': False}
    _turn_off_leds()
    return Response(json.dumps({'status': 'stopped'}), mimetype='application/json')


@app.route('/session/status')
def session_status():
    with _lock:
        return Response(json.dumps({'running': _session_running}), mimetype='application/json')


@app.route('/video_feed')
def video_feed():
    return Response(_mjpeg_generator(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/metrics')
def metrics():
    with _lock:
        data = dict(_cognitive_data)
    return Response(json.dumps(data), mimetype='application/json', headers={'Access-Control-Allow-Origin': '*'})


@app.route('/health')
def health():
    with _lock:
        status = _cognitive_data.get('system_status', 'Unknown')
    return Response(json.dumps({'status': 'ok', 'pipeline': status}), mimetype='application/json')


if __name__ == '__main__':
    print("[stream_server] Serving on http://localhost:5001")
    print("[stream_server] Camera starts only after POST /session/start")
    app.run(host='0.0.0.0', port=5001, threaded=True, use_reloader=False)
