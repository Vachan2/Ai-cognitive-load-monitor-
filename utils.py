"""
utils.py — Shared utility functions for cognitive load monitoring system.
Handles EAR calculation, landmark extraction, and overlay rendering.
"""

import cv2
import numpy as np
# Note: no mediapipe import needed here — utils is pure OpenCV + NumPy


# ─── MediaPipe Face Mesh Eye Landmark Indices ───────────────────────────────
# These indices correspond to the 468-point Face Mesh model.
# Each eye is defined by 6 key points used for EAR calculation.

# Left eye landmark indices (from MediaPipe Face Mesh topology)
LEFT_EYE = [362, 385, 387, 263, 373, 380]

# Right eye landmark indices
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# Full eye region indices for drawing (more points = better visual)
LEFT_EYE_FULL = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466,
                 388, 387, 386, 385, 384, 398]
RIGHT_EYE_FULL = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173,
                  157, 158, 159, 160, 161, 246]


def get_eye_landmarks(landmarks, eye_indices, frame_w, frame_h):
    """
    Extract (x, y) pixel coordinates for a set of eye landmark indices.

    Args:
        landmarks: MediaPipe face landmarks object
        eye_indices: list of landmark indices for the eye
        frame_w: frame width in pixels
        frame_h: frame height in pixels

    Returns:
        List of (x, y) tuples in pixel space
    """
    points = []
    for idx in eye_indices:
        lm = landmarks.landmark[idx]
        x = int(lm.x * frame_w)
        y = int(lm.y * frame_h)
        points.append((x, y))
    return points


def calculate_ear(eye_points):
    """
    Calculate Eye Aspect Ratio (EAR) for blink detection.

    EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

    Where p1..p6 are the 6 eye landmark points:
        p1 = outer corner
        p2 = upper outer
        p3 = upper inner
        p4 = inner corner
        p5 = lower inner
        p6 = lower outer

    EAR is ~0.25-0.35 when eye is open, drops near 0 when closed.

    Args:
        eye_points: list of 6 (x, y) tuples

    Returns:
        float: EAR value
    """
    p1, p2, p3, p4, p5, p6 = [np.array(p) for p in eye_points]

    # Vertical distances
    vertical_1 = np.linalg.norm(p2 - p6)
    vertical_2 = np.linalg.norm(p3 - p5)

    # Horizontal distance
    horizontal = np.linalg.norm(p1 - p4)

    if horizontal == 0:
        return 0.0

    ear = (vertical_1 + vertical_2) / (2.0 * horizontal)
    return round(ear, 3)


def draw_eye_landmarks(frame, eye_points, color=(0, 255, 0)):
    """
    Draw circles on each eye landmark point.

    Args:
        frame: OpenCV BGR frame
        eye_points: list of (x, y) tuples
        color: BGR color tuple
    """
    for (x, y) in eye_points:
        cv2.circle(frame, (x, y), 2, color, -1)


def draw_overlay(frame, data: dict):
    """
    Render the monitoring HUD overlay on the frame.

    Args:
        frame: OpenCV BGR frame
        data: dict with keys:
            blink_count, blink_rate, ear, eye_status, closure_duration,
            drowsy, system_status, session_elapsed
    """
    h, w = frame.shape[:2]

    # Semi-transparent dark panel background
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (330, 215), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

    # Panel border
    cv2.rectangle(frame, (10, 10), (330, 215), (0, 255, 100), 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.55
    thickness = 1
    line_h = 28
    x_start = 20
    y_start = 35

    # ── Blink Count ──
    cv2.putText(frame, f"Blink Count : {data.get('blink_count', 0)}",
                (x_start, y_start), font, font_scale, (0, 255, 100), thickness)

    # ── Blink Rate ──
    cv2.putText(frame, f"Blink Rate  : {data.get('blink_rate', 0.0):.1f} /min",
                (x_start, y_start + line_h), font, font_scale, (0, 255, 100), thickness)

    # ── EAR Value ──
    ear_val = data.get('ear', 0.0)
    cv2.putText(frame, f"EAR         : {ear_val:.3f}",
                (x_start, y_start + line_h * 2), font, font_scale, (0, 255, 100), thickness)

    # ── Eye Status (green = OPEN, red = CLOSED) ──
    status = data.get('eye_status', 'OPEN')
    status_color = (0, 255, 0) if status == 'OPEN' else (0, 0, 255)
    cv2.putText(frame, f"Eye Status  : {status}",
                (x_start, y_start + line_h * 3), font, font_scale, status_color, thickness)

    # ── Eye Closure Duration ──
    duration = data.get('closure_duration', 0.0)
    cv2.putText(frame, f"Eye Closed  : {duration:.1f} sec",
                (x_start, y_start + line_h * 4), font, font_scale, (0, 255, 100), thickness)

    # ── System Status ──
    sys_status = data.get('system_status', 'Monitoring')
    cv2.putText(frame, f"System      : {sys_status}",
                (x_start, y_start + line_h * 5), font, font_scale, (0, 255, 100), thickness)

    # ── Session elapsed (bottom-right corner) ──
    elapsed = data.get('session_elapsed', 0.0)
    mins, secs = divmod(int(elapsed), 60)
    cv2.putText(frame, f"Session: {mins:02d}:{secs:02d}",
                (w - 160, h - 15), font, 0.5, (180, 180, 180), 1)

    # ── Drowsiness Warning Banner ──
    if data.get('drowsy', False):
        warn_overlay = frame.copy()
        cv2.rectangle(warn_overlay, (0, h - 60), (w, h), (0, 0, 180), -1)
        cv2.addWeighted(warn_overlay, 0.6, frame, 0.4, 0, frame)
        cv2.putText(frame, "WARNING: DROWSINESS DETECTED - TAKE A BREAK",
                    (20, h - 20), font, 0.65, (255, 255, 255), 2)


def draw_cognitive_load_indicator(frame, score: int, level: str):
    """
    Draw a cognitive load gauge in the top-right corner.

    Shows:
    - Score bar (0–100) filled proportionally
    - Color: green (LOW) → orange (MEDIUM) → red (HIGH)
    - Level label

    Args:
        frame: OpenCV BGR frame
        score: 0–100 cognitive load score
        level: 'LOW', 'MEDIUM', or 'HIGH'
    """
    h, w = frame.shape[:2]

    bar_w = 160
    bar_h = 18
    x = w - bar_w - 20
    y = 20

    # Color by level
    color_map = {
        'LOW':    (0, 200, 0),      # green
        'MEDIUM': (0, 165, 255),    # orange
        'HIGH':   (0, 0, 220),      # red
    }
    color = color_map.get(level, (0, 200, 0))

    # Background bar
    cv2.rectangle(frame, (x, y), (x + bar_w, y + bar_h), (50, 50, 50), -1)

    # Filled portion
    filled = int(bar_w * score / 100)
    if filled > 0:
        cv2.rectangle(frame, (x, y), (x + filled, y + bar_h), color, -1)

    # Border
    cv2.rectangle(frame, (x, y), (x + bar_w, y + bar_h), (180, 180, 180), 1)

    font = cv2.FONT_HERSHEY_SIMPLEX

    # Score text inside bar
    cv2.putText(frame, f"{score}%", (x + bar_w // 2 - 18, y + bar_h - 4),
                font, 0.45, (255, 255, 255), 1)

    # Level label above bar
    cv2.putText(frame, f"Cognitive Load: {level}",
                (x - 10, y - 6), font, 0.5, color, 1)
