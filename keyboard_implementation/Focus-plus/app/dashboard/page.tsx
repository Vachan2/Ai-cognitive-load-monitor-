/**
 * Dashboard — Main cognitive load monitoring interface.
 */

'use client';

import { useSessionStore } from '@/store/sessionStore';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import MetricCard from '@/components/ui/MetricCard';
import AIInsightPanel from '@/components/ui/AIInsightPanel';
import LiveChart from '@/components/ui/LiveChart';
import { motion } from 'framer-motion';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { isRunning, metrics, startSession, stopSession, resetSession } = useSessionStore();

  // Drives metric updates + AI analysis
  useSessionTimer();

  const distractionColor =
    metrics.distractionLevel === 'High'
      ? 'red'
      : metrics.distractionLevel === 'Moderate'
      ? 'orange'
      : 'green';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              🧠 NeuroSync Dashboard
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Real-time cognitive load monitoring
            </p>
          </div>

          <div className="flex gap-3">
            {isRunning ? (
              <button
                onClick={stopSession}
                className="px-5 py-2 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-medium"
              >
                ⏹ Stop Session
              </button>
            ) : (
              <button
                onClick={startSession}
                className="px-5 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all text-sm font-medium"
              >
                ▶ Start Session
              </button>
            )}
            <button
              onClick={resetSession}
              className="px-5 py-2 rounded-xl bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all text-sm"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}
          />
          <span className="text-xs text-white/40">
            {isRunning
              ? `Monitoring active · ${formatDuration(metrics.sessionDuration)}`
              : 'Session stopped'}
          </span>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Focus Score"
            value={Math.round(metrics.focusScore)}
            unit="/100"
            score={metrics.focusScore}
            color="cyan"
            icon="🎯"
          />
          <MetricCard
            label="Cognitive Load"
            value={Math.round(metrics.cognitiveLoad)}
            unit="/100"
            score={metrics.cognitiveLoad}
            color="purple"
            icon="🧠"
          />
          <MetricCard
            label="Productivity"
            value={Math.round(metrics.productivityScore)}
            unit="/100"
            score={metrics.productivityScore}
            color="green"
            icon="⚡"
          />
          <MetricCard
            label="Session Time"
            value={formatDuration(metrics.sessionDuration)}
            color="blue"
            icon="⏱"
          />
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Typing Speed"
            value={Math.round(metrics.typingSpeed)}
            unit="WPM"
            score={metrics.typingSpeed}
            color="green"
            icon="⌨️"
          />
          <MetricCard
            label="Tab Switches"
            value={metrics.tabSwitches}
            color="orange"
            icon="🔀"
          />
          <MetricCard
            label="Blink Rate"
            value={metrics.blinkRate.toFixed(1)}
            unit="/min"
            score={Math.min(100, metrics.blinkRate * 5)}
            color="cyan"
            icon="👁"
          />
          <MetricCard
            label="Distraction"
            value={metrics.distractionLevel}
            color={distractionColor}
            icon="⚠️"
          />
        </div>

        {/* Charts + AI insight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Focus chart */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Focus History</p>
            <LiveChart data={metrics.focusHistory} color="#22d3ee" label="Focus" />
          </div>

          {/* Cognitive load chart */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Cognitive Load History</p>
            <LiveChart data={metrics.loadHistory} color="#a78bfa" label="Load" />
          </div>

          {/* Productivity chart */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Productivity History</p>
            <LiveChart data={metrics.productivityHistory} color="#34d399" label="Productivity" />
          </div>
        </div>

        {/* AI Insight panel */}
        <AIInsightPanel />

        {/* Footer note */}
        <p className="text-center text-white/20 text-xs mt-6">
          AI powered by Sarvam API · Mistral API fallback · Eye data from MediaPipe tracker
        </p>
      </div>
    </div>
  );
}
