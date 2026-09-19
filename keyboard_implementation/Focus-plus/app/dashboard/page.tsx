/**
 * Dashboard — NeuroSync cognitive load monitoring interface.
 *
 * Layout (full viewport, no empty space):
 *   ┌─────────────────────────────┬──────────────────────┐
 *   │  Left panel (flex col)      │  Right panel (flex)  │
 *   │  · header + controls        │  · live webcam feed  │
 *   │  · cognitive load banner    │  · 4 metric pills    │
 *   │  · 4 primary metric cards   │  · AI insight        │
 *   │  · 4 secondary metric cards │    (stretches to fit)│
 *   │  · charts (flex-1, fills)   │                      │
 *   └─────────────────────────────┴──────────────────────┘
 */

'use client';

import { useSessionStore } from '@/store/sessionStore';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useKeyboardTracker } from '@/hooks/useKeyboardTracker';
import MetricCard from '@/components/ui/MetricCard';
import AIInsightPanel from '@/components/ui/AIInsightPanel';
import LiveChart from '@/components/ui/LiveChart';
import WebcamFeed from '@/components/ui/WebcamFeed';
import { motion } from 'framer-motion';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      )}
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
          active ? 'bg-emerald-400' : 'bg-white/20'
        }`}
      />
    </span>
  );
}

export default function DashboardPage() {
  const { isRunning, metrics, startSession, stopSession, resetSession } =
    useSessionStore();

  useSessionTimer();
  useKeyboardTracker();

  const distractionColor =
    metrics.distractionLevel === 'High'
      ? 'red'
      : metrics.distractionLevel === 'Moderate'
      ? 'orange'
      : 'green';

  const loadLevel =
    metrics.cognitiveLoad > 66
      ? 'HIGH'
      : metrics.cognitiveLoad > 33
      ? 'MED'
      : 'LOW';

  const loadAccent =
    loadLevel === 'HIGH'
      ? 'text-red-400'
      : loadLevel === 'MED'
      ? 'text-orange-400'
      : 'text-emerald-400';

  return (
    <div className="flex h-screen bg-[#070b14] text-white overflow-hidden">

      {/* ── Ambient glows ───────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-cyan-600/8 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        <div className="absolute -bottom-32 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-600/6 blur-[100px]" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANEL — full height flex column, charts stretch to fill
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Scrollable wrapper — only kicks in on very small heights */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-full flex flex-col p-5 gap-4">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 shrink-0">
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  NeuroSync
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <StatusDot active={isRunning} />
                  <span className="text-xs text-white/40 font-mono">
                    {isRunning
                      ? `MONITORING · ${formatDuration(metrics.sessionDuration)}`
                      : 'SESSION STOPPED'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    onClick={stopSession}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition-all text-sm font-medium"
                  >
                    <span className="w-2 h-2 rounded-sm bg-red-400" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={startSession}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-all text-sm font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Start Session
                  </button>
                )}
                <button
                  onClick={resetSession}
                  className="px-4 py-1.5 rounded-xl bg-white/5 text-white/40 border border-white/8 hover:bg-white/10 hover:text-white/60 transition-all text-sm"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* ── Cognitive load banner ──────────────────────────────── */}
            <motion.div
              layout
              className="relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden shrink-0"
            >
              <div
                className={`absolute left-0 inset-y-0 w-1 rounded-l-2xl ${
                  loadLevel === 'HIGH'
                    ? 'bg-red-400'
                    : loadLevel === 'MED'
                    ? 'bg-orange-400'
                    : 'bg-emerald-400'
                }`}
              />
              <div className="px-5 py-3.5 flex items-center justify-between gap-6">
                <div className="shrink-0">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-0.5">
                    Cognitive Load
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold font-mono ${loadAccent}`}>
                      {Math.round(metrics.cognitiveLoad)}
                    </span>
                    <span className="text-white/30 text-sm">/100</span>
                    <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      loadLevel === 'HIGH'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : loadLevel === 'MED'
                        ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}>
                      {loadLevel}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        loadLevel === 'HIGH'
                          ? 'bg-gradient-to-r from-orange-400 to-red-400'
                          : loadLevel === 'MED'
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                          : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                      }`}
                      animate={{ width: `${metrics.cognitiveLoad}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-white/20">Low</span>
                    <span className="text-xs text-white/20">Medium</span>
                    <span className="text-xs text-white/20">High</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-0.5">
                    Distraction
                  </p>
                  <p className={`text-base font-semibold ${
                    metrics.distractionLevel === 'High'
                      ? 'text-red-300'
                      : metrics.distractionLevel === 'Moderate'
                      ? 'text-orange-300'
                      : 'text-emerald-300'
                  }`}>
                    {metrics.distractionLevel}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Primary metrics ────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <MetricCard
                label="Focus Score"
                value={Math.round(metrics.focusScore)}
                unit="/100"
                score={metrics.focusScore}
                color="cyan"
                icon="🎯"
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
              <MetricCard
                label="Distraction"
                value={metrics.distractionLevel}
                color={distractionColor}
                icon="⚠️"
              />
            </div>

            {/* ── Secondary metrics ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <MetricCard
                label="Typing Speed"
                value={metrics.typingSpeed}
                unit=" WPM"
                score={Math.min(100, (metrics.typingSpeed * 100) / 120)}
                color="green"
                icon="⌨️"
              />
              <MetricCard
                label="Tab Switches"
                value={metrics.tabSwitches}
                color="orange"
                icon="⇄"
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
                label="EAR"
                value={metrics.earValue.toFixed(3)}
                score={Math.min(100, metrics.earValue * 250)}
                color="purple"
                icon="◎"
              />
            </div>

            {/* ── Charts — flex-1 so they fill whatever height is left ── */}
            <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
              <ChartPanel label="Focus History" dot="bg-cyan-400">
                <LiveChart
                  data={metrics.focusHistory}
                  color="#22d3ee"
                  label="Focus"
                />
              </ChartPanel>

              <ChartPanel label="Load History" dot="bg-violet-400">
                <LiveChart
                  data={metrics.loadHistory}
                  color="#a78bfa"
                  label="Load"
                />
              </ChartPanel>

              <ChartPanel label="EAR History" dot="bg-yellow-400">
                <LiveChart
                  data={metrics.earHistory}
                  color="#facc15"
                  label="EAR"
                  domain={[0.1, 0.45]}
                />
              </ChartPanel>
            </div>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <p className="text-center text-white/15 text-xs shrink-0">
              Eye tracking · MediaPipe · Sarvam AI · Mistral AI
            </p>

          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANEL — fixed 360px, full-height flex column, no gaps
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="w-[360px] shrink-0 border-l border-white/6 bg-white/2 backdrop-blur-sm flex flex-col overflow-hidden">
        <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-4">

          {/* Live webcam — fixed 4:3 ratio */}
          <div className="shrink-0">
            <WebcamFeed
              isRunning={isRunning}
              earValue={metrics.earValue}
              blinkRate={metrics.blinkRate}
              faceDetected={metrics.faceDetected}
            />
          </div>

          {/* Eye metric pills */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <EyePill
              label="Eye Aspect Ratio"
              value={metrics.earValue.toFixed(3)}
              sub={
                metrics.earValue < 0.2
                  ? 'Eyes closed'
                  : metrics.earValue < 0.25
                  ? 'Squinting'
                  : 'Open'
              }
              color={
                metrics.earValue < 0.2
                  ? 'red'
                  : metrics.earValue < 0.25
                  ? 'orange'
                  : 'emerald'
              }
            />
            <EyePill
              label="Blink Rate"
              value={metrics.blinkRate.toFixed(1)}
              sub="/min · normal 12–20"
              color={
                metrics.blinkRate < 8 || metrics.blinkRate > 25
                  ? 'orange'
                  : 'emerald'
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <EyePill
              label="Typing Speed"
              value={`${metrics.typingSpeed}`}
              sub="WPM · live"
              color="cyan"
            />
            <EyePill
              label="Tab Switches"
              value={`${metrics.tabSwitches}`}
              sub="this session"
              color={metrics.tabSwitches > 15 ? 'orange' : 'emerald'}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-white/8 shrink-0" />

          {/* AI insight — flex-1 so it fills the remaining sidebar height */}
          <div className="flex-1 flex flex-col min-h-0">
            <AIInsightPanel />
          </div>

        </div>
      </div>

    </div>
  );
}

/* ── Helper components ─────────────────────────────────────────────────────── */

function ChartPanel({
  label,
  dot,
  children,
}: {
  label: string;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <p className="text-xs text-white/40 uppercase tracking-widest">{label}</p>
      </div>
      {/* Chart fills remaining height inside the panel */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}

const eyeColorMap = {
  red:     { text: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20' },
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/20' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-400/10',    border: 'border-cyan-400/20' },
  purple:  { text: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/20' },
};

function EyePill({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: keyof typeof eyeColorMap;
}) {
  const c = eyeColorMap[color];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
      <p className="text-xs text-white/35 mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${c.text}`}>{value}</p>
      <p className="text-xs text-white/25 mt-0.5 truncate">{sub}</p>
    </div>
  );
}
