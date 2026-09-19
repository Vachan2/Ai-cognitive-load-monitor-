"""
cognitive_load.py — Cognitive load scoring engine.

Estimates cognitive load level (LOW / MEDIUM / HIGH) from eye metrics.

Scoring model (research-informed, temporally smoothed):
────────────────────────────────────────────────────────
Metric               | High load signal
─────────────────────|──────────────────────────────────────────────
Blink rate (60s)     | Sustained low (<8/min) = intense focus/load
Blink burst (10s)    | Sudden spike >6 blinks/10s = stress response

Deliberate design choices
─────────────────────────
• EAR and drowsiness are NOT used for cognitive load scoring.
  Closing your eyes (intentionally or accidentally) must never raise
  the cognitive load score. EAR drops to ~0 while eyes are shut, which
  would poison the strain signal; drowsiness is a fatigue indicator,
  not a load indicator. Both are excluded.

• EAR history is only updated when eyes are OPEN (eye_closed=False) so
  the rolling average cannot be corrupted by blink frames.

• Score is EMA-smoothed so it drifts rather than spikes.

• Blink rate below normal (suppressed blinking) is the primary
  research-validated proxy for high cognitive load.
  A rapid blink burst separately catches the stress/anxiety signal.

Score range: 0–100
  0–33  → LOW
  34–66 → MEDIUM
  67–100 → HIGH

References:
  - Iqbal et al. (2004): blink rate decreases under high cognitive load
  - Stem et al. (1994): blink rate increases under stress/anxiety
"""

from collections import deque
import time

# ─── Blink rate thresholds ───────────────────────────────────────────────────
NORMAL_BLINK_RATE_MIN = 12.0   # blinks/min lower bound (relaxed)
NORMAL_BLINK_RATE_MAX = 20.0   # blinks/min upper bound (relaxed)

# EMA smoothing factor — lower = smoother / slower to react
EMA_ALPHA = 0.06

# Blink burst detection window
BURST_WINDOW_SEC = 10.0
BURST_HIGH_THRESHOLD = 6   # > 6 blinks in 10 s = stress burst


class CognitiveLoadScorer:
    """
    Computes a 0–100 cognitive load score from blink-rate metrics only.

    Eye closure (EAR, drowsiness, closure duration) is intentionally
    excluded — see module docstring for rationale.

    Usage:
        scorer = CognitiveLoadScorer()
        score, level = scorer.update(
            blink_rate, eye_closed=False, blink_timestamps=deque(...)
        )
    """

    def __init__(self):
        self._ema_score: float = 5.0
        self.score = 5
        self.level = 'LOW'

    def update(
        self,
        blink_rate: float,
        eye_closed: bool = False,
        blink_timestamps: deque | None = None,
        # legacy kwargs kept for call-site compatibility — not used
        ear: float = 0.28,
        drowsy: bool = False,
        closure_duration: float = 0.0,
    ) -> tuple:
        """
        Compute cognitive load score.

        Args:
            blink_rate:       blinks/min from the 60-second rolling window
            eye_closed:       True while eyes are currently closed —
                              scoring is suspended during closures so
                              a deliberate eye-rest cannot spike the score
            blink_timestamps: deque of recent blink epoch timestamps for
                              burst detection (passed from BlinkTracker)
            ear, drowsy, closure_duration: accepted but ignored

        Returns:
            (score: int, level: str)
        """
        # ── While eyes are closed, hold the current score steady ─────────────
        # This is the key fix: we simply skip updating the EMA during any
        # eye closure so there is zero feedback from intentional eye-rests.
        if eye_closed:
            return self.score, self.level

        raw = 0

        # ── 1. Sustained blink rate (0–55 pts) ───────────────────────────────
        # Primary load signal. Suppressed blinking = deep focus / high load.
        # Elevated blinking = stress / fatigue.
        if blink_rate < 5:
            raw += 55    # heavily suppressed — very high load
        elif blink_rate < NORMAL_BLINK_RATE_MIN:
            raw += 35    # below normal — elevated load
        elif blink_rate <= NORMAL_BLINK_RATE_MAX:
            raw += 5     # normal range — low load
        elif blink_rate < 30:
            raw += 25    # above normal — mild stress
        else:
            raw += 45    # very high — significant fatigue/stress

        # ── 2. Blink burst detection (0–30 pts) ──────────────────────────────
        # A sudden cluster in a short window signals stress before the
        # 60-second average has time to catch up.
        if blink_timestamps is not None:
            now = time.time()
            burst_cutoff = now - BURST_WINDOW_SEC
            burst_count = sum(1 for t in blink_timestamps if t >= burst_cutoff)
            if burst_count > BURST_HIGH_THRESHOLD:
                # 7 blinks/10s → ~8 pts; 13+ blinks/10s → 30 pts
                burst_pts = min(30, int((burst_count - BURST_HIGH_THRESHOLD) * 4.5))
                raw += burst_pts

        # ── Clamp ─────────────────────────────────────────────────────────────
        raw = max(0, min(100, raw))

        # ── EMA smoothing ─────────────────────────────────────────────────────
        self._ema_score = EMA_ALPHA * raw + (1.0 - EMA_ALPHA) * self._ema_score
        smoothed = int(round(self._ema_score))

        # ── Level mapping ─────────────────────────────────────────────────────
        if smoothed <= 33:
            level = 'LOW'
        elif smoothed <= 66:
            level = 'MEDIUM'
        else:
            level = 'HIGH'

        self.score = smoothed
        self.level = level
        return smoothed, level

    def reset(self):
        self.__init__()
