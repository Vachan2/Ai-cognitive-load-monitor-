"""
webcam_test.py — Main entry point for Developer Cognitive Load Monitoring System.

Real-time webcam pipeline:
  1. Capture frame from webcam
  2. Flip horizontally (mirror effect)
  3. Run FaceLandmarker to extract 478 facial landmarks
  4. Calculate EAR (Eye Aspect Ratio) from eye landmarks
  5. Detect blinks + track eye closure duration + compute blink rate
  6. Score cognitive load (LOW / MEDIUM / HIGH)
  7. Log metrics to CSV (1 row/sec)
  8. Render HUD overlay with all metrics

Press Q to quit.
"""

import cv2
from eye_tracking import EyeTracker
from blink_detection import BlinkTracker
from cognitive_load import CognitiveLoadScorer
from data_logger import SessionLogger
from utils import draw_overlay, draw_cognitive_load_indicator


# ─── Cognitive Load Data ─────────────────────────────────────────────────────
# Single source of truth — updated every frame.
# Plug this dict into Streamlit dashboard or alert system.
cognitive_data = {
    'blink_count':          0,
    'blink_rate':           0.0,
    'eye_closed':           False,
    'eye_closure_duration': 0.0,
    'ear_value':            0.0,
    'eye_status':           'OPEN',
    'drowsy':               False,
    'system_status':        'Monitoring',
    'session_elapsed':      0.0,
    'cognitive_score':      0,
    'cognitive_level':      'LOW',
}


def main():
    # ── Initialize webcam ────────────────────────────────────────────────────
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open webcam. Check camera permissions in System Settings.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    # ── Initialize all modules ───────────────────────────────────────────────
    eye_tracker  = EyeTracker()
    blink_tracker = BlinkTracker()
    scorer       = CognitiveLoadScorer()
    logger       = SessionLogger(interval_sec=1.0)

    print("Cognitive Load Monitor running. Press Q to quit.")

    while True:
        success, frame = cap.read()
        if not success:
            print("WARNING: Failed to read frame.")
            break

        # Mirror effect
        frame = cv2.flip(frame, 1)

        # ── Eye tracking ─────────────────────────────────────────────────────
        ear, left_pts, right_pts = eye_tracker.process(frame)

        if ear is not None:
            # ── Blink + closure tracking ──────────────────────────────────
            result = blink_tracker.update(ear)

            # ── Cognitive load scoring ────────────────────────────────────
            score, level = scorer.update(
                blink_rate=result['blink_rate'],
                eye_closed=result['eye_closed'],
                blink_timestamps=blink_tracker._blink_timestamps,
            )

            # ── Update cognitive_data dict ────────────────────────────────
            cognitive_data.update({
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
            })

            # ── HUD overlay ───────────────────────────────────────────────
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

            # ── Cognitive load indicator (top-right) ──────────────────────
            draw_cognitive_load_indicator(frame, score, level)

        else:
            # No face detected
            draw_overlay(frame, {
                'blink_count':      cognitive_data['blink_count'],
                'blink_rate':       cognitive_data['blink_rate'],
                'ear':              0.0,
                'eye_status':       '---',
                'closure_duration': 0.0,
                'drowsy':           False,
                'system_status':    'No Face Detected',
                'session_elapsed':  cognitive_data['session_elapsed'],
            })
            draw_cognitive_load_indicator(
                frame,
                cognitive_data['cognitive_score'],
                cognitive_data['cognitive_level']
            )

        # ── Log to CSV ────────────────────────────────────────────────────────
        logger.log(cognitive_data)

        # ── Display ───────────────────────────────────────────────────────────
        cv2.imshow("Developer Cognitive Load Monitor", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # ── Cleanup ──────────────────────────────────────────────────────────────
    eye_tracker.close()
    logger.close()
    cap.release()
    cv2.destroyAllWindows()

    print(f"\n── Session Summary ──────────────────────────")
    print(f"  Total Blinks      : {cognitive_data['blink_count']}")
    print(f"  Blink Rate        : {cognitive_data['blink_rate']:.1f} /min")
    print(f"  Last EAR          : {cognitive_data['ear_value']:.3f}")
    print(f"  Cognitive Level   : {cognitive_data['cognitive_level']} ({cognitive_data['cognitive_score']})")
    print(f"  Session Duration  : {cognitive_data['session_elapsed']:.0f} sec")


if __name__ == "__main__":
    main()
