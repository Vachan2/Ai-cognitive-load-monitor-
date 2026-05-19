"""
data_logger.py — CSV session logger for cognitive load monitoring.

Writes one row per second (not per frame) to avoid huge files.
Output: session_YYYYMMDD_HHMMSS.csv

Columns:
    timestamp, elapsed_sec, blink_count, blink_rate, ear,
    eye_status, closure_duration, cognitive_score, cognitive_level, drowsy
"""

import csv
import os
import time
from datetime import datetime


class SessionLogger:
    """
    Logs cognitive load metrics to a CSV file at a configurable interval.

    Usage:
        logger = SessionLogger(interval_sec=1.0)
        logger.log(cognitive_data)   # call every frame; writes at interval
        logger.close()
    """

    def __init__(self, interval_sec: float = 1.0, output_dir: str = "sessions"):
        self.interval_sec = interval_sec
        self.output_dir = output_dir
        self._last_write = 0.0
        self._row_count = 0

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Timestamped filename
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filepath = os.path.join(output_dir, f"session_{ts}.csv")

        # Open file and write header
        self._file = open(self.filepath, "w", newline="")
        self._writer = csv.DictWriter(self._file, fieldnames=[
            "timestamp", "elapsed_sec", "blink_count", "blink_rate",
            "ear", "eye_status", "closure_duration",
            "cognitive_score", "cognitive_level", "drowsy",
        ])
        self._writer.writeheader()
        self._file.flush()

        self._session_start = time.time()
        print(f"Logging session to: {self.filepath}")

    def log(self, data: dict):
        """
        Write a row if the logging interval has elapsed.

        Args:
            data: merged dict from BlinkTracker + CognitiveLoadScorer containing:
                  blink_count, blink_rate, ear, eye_status, closure_duration,
                  cognitive_score, cognitive_level, drowsy, session_elapsed
        """
        now = time.time()
        if now - self._last_write < self.interval_sec:
            return

        self._last_write = now
        self._row_count += 1

        row = {
            "timestamp":       datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "elapsed_sec":     round(now - self._session_start, 1),
            "blink_count":     data.get("blink_count", 0),
            "blink_rate":      data.get("blink_rate", 0.0),
            "ear":             round(data.get("ear_value", 0.0), 4),
            "eye_status":      data.get("eye_status", "OPEN"),
            "closure_duration": round(data.get("eye_closure_duration", 0.0), 2),
            "cognitive_score": data.get("cognitive_score", 0),
            "cognitive_level": data.get("cognitive_level", "LOW"),
            "drowsy":          int(data.get("drowsy", False)),
        }

        self._writer.writerow(row)
        self._file.flush()

    def close(self):
        """Flush and close the CSV file."""
        self._file.flush()
        self._file.close()
        print(f"Session saved: {self.filepath} ({self._row_count} rows)")
