/**
 * sessionStore.ts — Global state for the monitoring session (Zustand).
 */

import { create } from 'zustand';
import type { AIAnalysis } from '@/services/ai';

export interface SessionMetrics {
  focusScore: number;
  cognitiveLoad: number;
  productivityScore: number;
  typingSpeed: number;
  tabSwitches: number;
  sessionDuration: number;
  distractionLevel: 'Low' | 'Moderate' | 'High';
  blinkRate: number;
  earValue: number;
  /** True when the Python eye tracker has a face in frame */
  faceDetected: boolean;
  // History for charts (last 60 data points)
  focusHistory: number[];
  loadHistory: number[];
  productivityHistory: number[];
  earHistory: number[];
}

interface SessionState {
  isRunning: boolean;
  metrics: SessionMetrics;
  analysis: AIAnalysis | null;
  analysisLoading: boolean;
  lastAnalysisAt: number;
  /** Rolling buffer of raw cognitiveLoad readings for 10-sample averaging */
  _loadBuffer: number[];

  startSession: () => void;
  stopSession: () => void;
  updateMetrics: (partial: Partial<SessionMetrics>) => void;
  setAnalysis: (analysis: AIAnalysis) => void;
  setAnalysisLoading: (loading: boolean) => void;
  resetSession: () => void;
}

const defaultMetrics: SessionMetrics = {
  focusScore: 72,
  cognitiveLoad: 35,
  productivityScore: 68,
  typingSpeed: 0,
  tabSwitches: 0,
  sessionDuration: 0,
  distractionLevel: 'Low',
  blinkRate: 15,
  earValue: 0.28,
  faceDetected: false,
  focusHistory: [],
  loadHistory: [],
  productivityHistory: [],
  earHistory: [],
};

export const useSessionStore = create<SessionState>((set) => ({
  isRunning: false,
  metrics: { ...defaultMetrics },
  analysis: null,
  analysisLoading: false,
  lastAnalysisAt: 0,
  _loadBuffer: [],

  startSession: () =>
    set({ isRunning: true, metrics: { ...defaultMetrics }, _loadBuffer: [] }),

  stopSession: () => set({ isRunning: false }),

  updateMetrics: (partial) =>
    set((state) => {
      // ── Cognitive load 10-sample rolling average ────────────────────────
      // When a real cognitiveLoad value arrives (from Python or simulation),
      // push it into the buffer (max 10 entries) and replace the displayed
      // value with the average — this smooths out frame-to-frame jumps
      // without hiding genuine trends.
      let loadBuffer = state._loadBuffer;
      let smoothedLoad = state.metrics.cognitiveLoad;

      if (typeof partial.cognitiveLoad === 'number') {
        loadBuffer = [...loadBuffer, partial.cognitiveLoad].slice(-10);
        smoothedLoad = Math.round(
          loadBuffer.reduce((a, b) => a + b, 0) / loadBuffer.length
        );
      }

      const updated = {
        ...state.metrics,
        ...partial,
        cognitiveLoad: smoothedLoad,
      };

      // Append to history (keep last 60 points)
      const push = (arr: number[], val: number) =>
        [...arr, val].slice(-60);

      updated.focusHistory = push(state.metrics.focusHistory, updated.focusScore);
      updated.loadHistory = push(state.metrics.loadHistory, updated.cognitiveLoad);
      updated.productivityHistory = push(
        state.metrics.productivityHistory,
        updated.productivityScore
      );
      // Only push real EAR values (when face is detected), skip 0 to avoid
      // poisoning the chart with closed-eye / no-face frames
      if (updated.faceDetected && updated.earValue > 0) {
        updated.earHistory = push(state.metrics.earHistory, updated.earValue);
      } else {
        updated.earHistory = state.metrics.earHistory;
      }

      return { metrics: updated, _loadBuffer: loadBuffer };
    }),

  setAnalysis: (analysis) =>
    set({ analysis, analysisLoading: false, lastAnalysisAt: Date.now() }),

  setAnalysisLoading: (loading) => set({ analysisLoading: loading }),

  resetSession: () =>
    set({ isRunning: false, metrics: { ...defaultMetrics }, analysis: null, _loadBuffer: [] }),
}));
