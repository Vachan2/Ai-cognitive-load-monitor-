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
  // History for charts (last 60 data points)
  focusHistory: number[];
  loadHistory: number[];
  productivityHistory: number[];
}

interface SessionState {
  isRunning: boolean;
  metrics: SessionMetrics;
  analysis: AIAnalysis | null;
  analysisLoading: boolean;
  lastAnalysisAt: number;

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
  focusHistory: [],
  loadHistory: [],
  productivityHistory: [],
};

export const useSessionStore = create<SessionState>((set) => ({
  isRunning: false,
  metrics: { ...defaultMetrics },
  analysis: null,
  analysisLoading: false,
  lastAnalysisAt: 0,

  startSession: () =>
    set({ isRunning: true, metrics: { ...defaultMetrics } }),

  stopSession: () => set({ isRunning: false }),

  updateMetrics: (partial) =>
    set((state) => {
      const updated = { ...state.metrics, ...partial };

      // Append to history (keep last 60 points)
      const push = (arr: number[], val: number) =>
        [...arr, val].slice(-60);

      updated.focusHistory = push(state.metrics.focusHistory, updated.focusScore);
      updated.loadHistory = push(state.metrics.loadHistory, updated.cognitiveLoad);
      updated.productivityHistory = push(
        state.metrics.productivityHistory,
        updated.productivityScore
      );

      return { metrics: updated };
    }),

  setAnalysis: (analysis) =>
    set({ analysis, analysisLoading: false, lastAnalysisAt: Date.now() }),

  setAnalysisLoading: (loading) => set({ analysisLoading: loading }),

  resetSession: () =>
    set({ isRunning: false, metrics: { ...defaultMetrics }, analysis: null }),
}));
