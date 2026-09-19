/**
 * useSessionTimer.ts — Drives metric simulation + periodic AI analysis
 *                      + live eye-metric polling from the Python server.
 *
 * Every second   : updates metrics with realistic fluctuation
 * Every 2 seconds: polls /api/eye-metrics and replaces blinkRate / earValue
 *                  with real data when the Python stream_server is running
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
  const eyeRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Metric simulation tick (1s) ──────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const current = useSessionStore.getState().metrics;
      useSessionStore.getState().updateMetrics({
        focusScore:        nudge(current.focusScore, 3),
        cognitiveLoad:     current.faceDetected ? current.cognitiveLoad : nudge(current.cognitiveLoad, 2),
        productivityScore: nudge(current.productivityScore, 2),
        // typingSpeed and tabSwitches are driven by useKeyboardTracker — not simulated
        sessionDuration:   current.sessionDuration + 1,
        distractionLevel: current.faceDetected
          ? current.distractionLevel
          : current.cognitiveLoad > 70
          ? 'High'
          : current.cognitiveLoad > 45
          ? 'Moderate'
          : 'Low',
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // ── Live eye-metrics polling (2s) ────────────────────────────────────────
  // Replaces the simulated blinkRate / earValue with real data from the
  // Python stream_server when it is running.  Silently falls back to
  // simulation when `available` is false.
  useEffect(() => {
    if (!isRunning) {
      if (eyeRef.current) clearInterval(eyeRef.current);
      return;
    }

    const pollEye = async () => {
      try {
        const res = await fetch('/api/eye-metrics', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        if (data.available) {
          // Map Python cognitive_level → dashboard distractionLevel
          const levelMap: Record<string, 'Low' | 'Moderate' | 'High'> = {
            LOW:    'Low',
            MEDIUM: 'Moderate',
            HIGH:   'High',
          };

          useSessionStore.getState().updateMetrics({
            blinkRate:        typeof data.blink_rate      === 'number'  ? data.blink_rate      : undefined,
            earValue:         typeof data.ear_value       === 'number'  ? data.ear_value       : undefined,
            faceDetected:     typeof data.face_detected   === 'boolean' ? data.face_detected   : false,
            // Replace simulated cognitive load + distraction with real Python scorer values
            cognitiveLoad:    typeof data.cognitive_score === 'number'  ? data.cognitive_score : undefined,
            distractionLevel: data.cognitive_level ? (levelMap[data.cognitive_level] ?? undefined) : undefined,
          });
        }
      } catch {
        // Python server offline — simulation keeps running, no action needed
      }
    };

    pollEye();
    eyeRef.current = setInterval(pollEye, 2000);

    return () => {
      if (eyeRef.current) clearInterval(eyeRef.current);
    };
  }, [isRunning]);

  // ── AI analysis trigger (15s) ────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) {
      if (analyzeRef.current) clearInterval(analyzeRef.current);
      // Clear loading state so the panel doesn't stay stuck on the spinner
      setAnalysisLoading(false);
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
        // Validate shape before storing — guards against partial/error responses
        if (data.insight && data.recommendation) {
          setAnalysis(data);
        } else {
          setAnalysisLoading(false);
        }
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
