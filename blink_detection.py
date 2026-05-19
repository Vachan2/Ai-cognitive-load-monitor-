"""
blink_detection.py — Blink and eye closure tracking logic.

Blink detection uses Eye Aspect Ratio (EAR):
- EAR drops below threshold → eye closing
- EAR rises back above threshold → blink complete, increment counter

Eye closure tracking:
- Tracks how long eyes stay closed continuously
- Triggers drowsiness warning if closure exceeds threshold
"""

import time
from collections import deque


# ─── Thresholds ──────────────────────────────────────────────────────────────

# EAR below this value = eye considered CLOSED
EAR_THRESHOLD = 0.20

# Number of consecutive frames EAR must be below threshold to count as a blink
CONSEC_FRAMES = 2

# Eye closure duration (seconds) that triggers drowsiness warning
DROWSY_THRESHOLD_SEC = 2.0

# Rolling window for blink rate calculation (seconds)
BLINK_RATE_WINDOW_SEC = 60.0


class BlinkTracker:
    """
    Stateful tracker for blink counting, blink rate, and eye closure duration.

    Blink rate uses a rolling 60-second window — timestamps of each blink
    are stored in a deque; stale entries are pruned on every update.
    """

    def __init__(self):
        self.blink_count = 0
        self.consec_closed_frames = 0
        self.eye_closed = False
        self.closure_start_time = None
        self.closure_duration = 0.0
        self.session_start = time.time()

        # Rolling window: stores timestamps of each blink event
        self._blink_timestamps: deque = deque()

    def update(self, ear: float) -> dict:
        """
        Process a new EAR value and update all tracking state.

        Returns dict with:
            ear, eye_status, blink_count, blink_rate,
            eye_closed, closure_duration, drowsy, system_status
        """
        now = time.time()

        if ear < EAR_THRESHOLD:
            self.consec_closed_frames += 1

            if not self.eye_closed:
                self.eye_closed = True
                self.closure_start_time = now

            self.closure_duration = now - self.closure_start_time

        else:
            if self.eye_closed and self.consec_closed_frames >= CONSEC_FRAMES:
                # Blink completed — record timestamp and increment counter
                self.blink_count += 1
                self._blink_timestamps.append(now)

            self.eye_closed = False
            self.consec_closed_frames = 0
            self.closure_duration = 0.0
            self.closure_start_time = None

        # ── Blink rate: prune timestamps older than the rolling window ───────
        cutoff = now - BLINK_RATE_WINDOW_SEC
        while self._blink_timestamps and self._blink_timestamps[0] < cutoff:
            self._blink_timestamps.popleft()

        # Blinks in last 60s → blinks per minute
        blink_rate = round(len(self._blink_timestamps) * (60.0 / BLINK_RATE_WINDOW_SEC), 1)

        # Session elapsed time
        elapsed = now - self.session_start

        drowsy = self.eye_closed and self.closure_duration >= DROWSY_THRESHOLD_SEC

        return {
            'ear': ear,
            'eye_status': 'CLOSED' if self.eye_closed else 'OPEN',
            'blink_count': self.blink_count,
            'blink_rate': blink_rate,           # blinks per minute (rolling 60s)
            'eye_closed': self.eye_closed,
            'closure_duration': self.closure_duration,
            'drowsy': drowsy,
            'session_elapsed': round(elapsed, 1),
            'system_status': 'DROWSY!' if drowsy else 'Monitoring',
        }

    def reset(self):
        """Reset all tracking state."""
        self.__init__()
