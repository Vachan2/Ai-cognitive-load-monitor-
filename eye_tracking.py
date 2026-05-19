"""
eye_tracking.py — Core eye tracking using MediaPipe Tasks API (v0.10+).

MediaPipe 0.10+ dropped mp.solutions entirely.
This module uses mediapipe.tasks.python.vision.FaceLandmarker instead.

The FaceLandmarker model provides 478 facial landmarks including
detailed eye landmarks for accurate EAR calculation.
"""

import cv2
import ssl
import os
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.components.containers import landmark as mp_landmark

from utils import (
    LEFT_EYE, RIGHT_EYE,
    LEFT_EYE_FULL, RIGHT_EYE_FULL,
    calculate_ear,
    draw_eye_landmarks,
)

# ─── Model path ──────────────────────────────────────────────────────────────
MODEL_PATH = "face_landmarker.task"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)


def _download_model():
    """Download the FaceLandmarker model with SSL bypass (macOS fix)."""
    if os.path.exists(MODEL_PATH):
        return
    print("Downloading FaceLandmarker model (~30MB, one-time)...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(MODEL_URL, context=ctx) as resp, \
         open(MODEL_PATH, "wb") as f:
        f.write(resp.read())
    print("Model downloaded.")


class EyeTracker:
    """
    Real-time eye tracker using MediaPipe FaceLandmarker (Tasks API).

    Extracts 478 facial landmarks per frame, isolates eye points,
    and computes averaged EAR across both eyes.
    """

    # MediaPipe face mesh connection pairs for drawing (subset for eyes + face)
    # We'll draw these manually since mp.solutions.drawing_utils is gone
    FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
                 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
                 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
                 162, 21, 54, 103, 67, 109, 10]

    def __init__(self):
        _download_model()

        # Configure FaceLandmarker
        base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
        options = mp_vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.detector = mp_vision.FaceLandmarker.create_from_options(options)

    def process(self, frame):
        """
        Process a BGR frame: detect landmarks, draw mesh, calculate EAR.

        Args:
            frame: OpenCV BGR frame (drawn on in-place)

        Returns:
            ear (float | None): averaged EAR, or None if no face found
            left_pts (list): left eye (x,y) pixel coords
            right_pts (list): right eye (x,y) pixel coords
        """
        h, w = frame.shape[:2]

        # Convert BGR → RGB for MediaPipe
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        result = self.detector.detect(mp_image)

        if not result.face_landmarks:
            return None, [], []

        landmarks = result.face_landmarks[0]  # first face

        # ── Draw face mesh (tessellation) ────────────────────────────────────
        self._draw_mesh(frame, landmarks, w, h)

        # ── Extract eye landmark pixel coords ────────────────────────────────
        def to_px(idx):
            lm = landmarks[idx]
            return (int(lm.x * w), int(lm.y * h))

        left_pts  = [to_px(i) for i in LEFT_EYE]
        right_pts = [to_px(i) for i in RIGHT_EYE]
        left_full  = [to_px(i) for i in LEFT_EYE_FULL]
        right_full = [to_px(i) for i in RIGHT_EYE_FULL]

        # Draw eye highlights
        draw_eye_landmarks(frame, left_full,  color=(255, 255, 0))   # cyan-ish
        draw_eye_landmarks(frame, right_full, color=(0, 255, 255))   # yellow

        # Label eyes
        cv2.putText(frame, "L", (left_pts[0][0] - 20, left_pts[0][1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
        cv2.putText(frame, "R", (right_pts[0][0] + 5, right_pts[0][1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)

        # ── Calculate EAR ────────────────────────────────────────────────────
        left_ear  = calculate_ear(left_pts)  if len(left_pts)  == 6 else 0.0
        right_ear = calculate_ear(right_pts) if len(right_pts) == 6 else 0.0
        avg_ear   = round((left_ear + right_ear) / 2.0, 3)

        return avg_ear, left_pts, right_pts

    def _draw_mesh(self, frame, landmarks, w, h):
        """Draw a lightweight face mesh using landmark connections."""
        # Draw all landmark dots (small, subtle)
        for lm in landmarks:
            cx, cy = int(lm.x * w), int(lm.y * h)
            cv2.circle(frame, (cx, cy), 1, (0, 180, 0), -1)

        # Draw face oval outline
        pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h))
               for i in self.FACE_OVAL]
        for i in range(len(pts) - 1):
            cv2.line(frame, pts[i], pts[i + 1], (0, 200, 0), 1)

    def close(self):
        """Release MediaPipe resources."""
        self.detector.close()
