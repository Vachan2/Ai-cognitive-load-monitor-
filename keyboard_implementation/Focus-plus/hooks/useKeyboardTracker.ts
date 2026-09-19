/**
 * useKeyboardTracker.ts
 *
 * Tracks two real browser signals and writes them into the session store:
 *
 *  WPM (words per minute)
 *  ──────────────────────
 *  Counts keydown events that produce a character (printable keys + Space).
 *  Every second, WPM = (keystroke_count / 5) * 60 / elapsed_minutes, where
 *  5 characters ≈ 1 word (standard typewriting convention).
 *  The count resets each minute so the value reflects the current pace, not
 *  a lifetime average.
 *
 *  Tab switches
 *  ────────────
 *  Increments whenever the user navigates away from the dashboard tab:
 *    • document visibilitychange  (tab hidden → another browser tab)
 *    • window blur                (switch to another application)
 *  Only the transition TO hidden/blur is counted (not the return), and only
 *  when the session is running.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';

export function useKeyboardTracker() {
  const isRunning = useSessionStore((s) => s.isRunning);

  // keystroke ring-buffer: timestamps of every printable keypress in the
  // last 60 seconds, used to compute a rolling WPM
  const keyTimestamps = useRef<number[]>([]);
  const wpmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── WPM tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (wpmIntervalRef.current) clearInterval(wpmIntervalRef.current);
      keyTimestamps.current = [];
      useSessionStore.getState().updateMetrics({ typingSpeed: 0 });
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only count printable characters — ignore modifier-only keys,
      // function keys, arrow keys, etc.
      if (e.key.length === 1 || e.key === 'Backspace') {
        keyTimestamps.current.push(Date.now());
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Calculate WPM every 250ms from a short 10-second rolling window.
    // Using 10s instead of 60s means the value responds within seconds
    // of typing activity rather than waiting a full minute to fill up.
    // Formula: (chars in window / 5) * (60 / window_secs) = WPM
    wpmIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const windowMs = 10_000; // 10-second rolling window for fast response
      keyTimestamps.current = keyTimestamps.current.filter(
        (t) => now - t <= windowMs
      );

      const keyCount = keyTimestamps.current.length;
      const windowSecs = windowMs / 1000;        // 10
      const wpm = Math.round((keyCount / 5) * (60 / windowSecs));

      useSessionStore.getState().updateMetrics({ typingSpeed: wpm });
    }, 250); // update 4× per second so it feels instant

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (wpmIntervalRef.current) clearInterval(wpmIntervalRef.current);
    };
  }, [isRunning]);

  // ── Tab switch tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;

    const increment = () => {
      const current = useSessionStore.getState().metrics.tabSwitches;
      useSessionStore.getState().updateMetrics({ tabSwitches: current + 1 });
    };

    // visibilitychange covers switching to another browser tab
    const handleVisibility = () => {
      if (document.hidden) increment();
    };

    // blur covers switching to another application entirely
    const handleBlur = () => {
      // Only count if the document itself is still visible (i.e. the user
      // focused a different app, not just another browser tab — that is
      // already caught by visibilitychange)
      if (!document.hidden) increment();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isRunning]);
}
