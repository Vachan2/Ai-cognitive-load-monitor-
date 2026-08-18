/**
 * useSessionTimer.ts — Drives metric simulation + periodic AI analysis.
 *
 * Every second: updates metrics with realistic fluctuation
 * Every 15 seconds: fires /api/analyze for AI insight
 */

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';

// Small random walk helper
const nudge = (val: number, range: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, val + (Math.random() - 0.5) * range));

export function useSessionTimer() {
  const { isRunning, metrics, updateMetrics, setAnalysis, setAnalysisLoading } =
    useSessionStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Metric simulation tick (1s) ──────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      useSessionStore.getState().updateMetrics({
        focusScore:        nudge(metrics.focusScore, 3),
        cognitiveLoad:     nudge(metrics.cognitiveLoad, 4),
        productivityScore: nudge(metrics.productivityScore, 2),
        typingSpeed:       nudge(metrics.typingSpeed, 5, 0, 120),
        sessionDuration:   metrics.sessionDuration + 1,
        tabSwitches:
          Math.random() < 0.05
            ? metrics.tabSwitches + 1
            : metrics.tabSwitches,
        distractionLevel:
          metrics.cognitiveLoad > 70
            ? 'High'
            : metrics.cognitiveLoad > 45
            ? 'Moderate'
            : 'Low',
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, metrics]);

  // ── AI analysis trigger (15s) ────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (analyzeRef.current) clearInterval(analyzeRef.current);
      return;
    }

    const runAnalysis = async () => {
      const m = useSessionStore.getState().metrics;
      setAnalysisLoading(true);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focusScore:        m.focusScore,
            cognitiveLoad:     m.cognitiveLoad,
            productivityScore: m.productivityScore,
            typingSpeed:       m.typingSpeed,
            tabSwitches:       m.tabSwitches,
            sessionDuration:   m.sessionDuration,
            distractionLevel:  m.distractionLevel,
            blinkRate:         m.blinkRate,
            earValue:          m.earValue,
          }),
        });
        const data = await res.json();
        setAnalysis(data);
      } catch (err) {
        console.error('[useSessionTimer] Analysis fetch failed:', err);
        setAnalysisLoading(false);
      }
    };

    // Run immediately on start, then every 15s
    runAnalysis();
    analyzeRef.current = setInterval(runAnalysis, 15000);

    return () => {
      if (analyzeRef.current) clearInterval(analyzeRef.current);
    };
  }, [isRunning]);
}
