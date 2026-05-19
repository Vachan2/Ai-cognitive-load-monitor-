"""
cognitive_load.py — Cognitive load scoring engine.

Estimates cognitive load level (LOW / MEDIUM / HIGH) from eye metrics.

Scoring model (rule-based, research-informed):
─────────────────────────────────────────────
Metric              | High load signal
────────────────────|──────────────────────────────────────────
Blink rate          | Very low (<8/min) or very high (>25/min)
EAR                 | Sustained low EAR (squinting / strain)
Eye closure events  | Frequent prolonged closures
Drowsiness          | Direct high-load / fatigue indicator

Score range: 0–100
  0–33  → LOW cognitive load
  34–66 → MEDIUM cognitive load
  67–100 → HIGH cognitive load

References:
  - Iqbal et al. (2004): blink rate decreases under high cognitive load
  - Recarte & Nunes (2003): EAR correlates with mental workload
"""

from collections import deque
import time


# ─── Baseline blink rate (normal relaxed state) ──────────────────────────────
NORMAL_BLINK_RATE_MIN = 12.0   # blinks/min lower bound (relaxed)
NORMAL_BLINK_RATE_MAX = 20.0   # blinks/min upper bound (relaxed)

# EAR baseline — below this sustained = squinting / strain
EAR_STRAIN_THRESHOLD = 0.22

# How many recent EAR samples to average for strain detection
EAR_HISTORY_LEN = 30


class CognitiveLoadScorer:
    """
    Computes a 0–100 cognitive load score from live eye metrics.

    Usage:
        scorer = CognitiveLoadScorer()
        score, level = scorer.update(blink_rate, ear, drowsy, closure_duration)
    """

    def __init__(self):
        self._ear_history: deque = deque(maxlen=EAR_HISTORY_LEN)
        self.score = 0
        self.level = 'LOW'

    def update(self, blink_rate: float, ear: float,
               drowsy: bool, closure_duration: float) -> tuple:
        """
        Compute cognitive load score from current metrics.

        Args:
            blink_rate:        blinks per minute (rolling 60s window)
            ear:               current averaged EAR
            drowsy:            True if prolonged eye closure detected
            closure_duration:  seconds eyes have been closed

        Returns:
            (score: int, level: str)  — score 0–100, level LOW/MEDIUM/HIGH
        """
        self._ear_history.append(ear)
        avg_ear = sum(self._ear_history) / len(self._ear_history)

        score = 0

        # ── Blink rate scoring (0–40 points) ─────────────────────────────────
        # Very low blink rate = high focus / high load
        # Very high blink rate = fatigue / stress
        if blink_rate < 5:
            score += 40    # very suppressed blinking = intense focus
        elif blink_rate < NORMAL_BLINK_RATE_MIN:
            score += 25    # below normal = elevated load
        elif blink_rate <= NORMAL_BLINK_RATE_MAX:
            score += 5     # normal range = low load
        elif blink_rate < 30:
            score += 20    # above normal = stress/fatigue
        else:
            score += 35    # very high = significant fatigue

        # ── EAR strain scoring (0–30 points) ─────────────────────────────────
        # Sustained low EAR = squinting = eye strain = high load
        if avg_ear < EAR_STRAIN_THRESHOLD:
            strain_ratio = max(0.0, (EAR_STRAIN_THRESHOLD - avg_ear) / EAR_STRAIN_THRESHOLD)
            score += int(strain_ratio * 30)

        # ── Drowsiness scoring (0–20 points) ─────────────────────────────────
        if drowsy:
            score += 20
        elif closure_duration > 0.5:
            score += 10    # partial closure

        # ── Clamp to 0–100 ───────────────────────────────────────────────────
        score = max(0, min(100, score))

        # ── Map to level ─────────────────────────────────────────────────────
        if score <= 33:
            level = 'LOW'
        elif score <= 66:
            level = 'MEDIUM'
        else:
            level = 'HIGH'

        self.score = score
        self.level = level
        return score, level

    def reset(self):
        self.__init__()
