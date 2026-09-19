/**
 * AIInsightPanel — Displays the latest AI-generated insight and recommendation.
 * Shows provider badge (Sarvam / Mistral / Fallback) and alert level.
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSessionStore } from '@/store/sessionStore';

const alertStyles = {
  info:     { border: 'border-cyan-500/40',   text: 'text-cyan-300',   bg: 'bg-cyan-500/10',   label: 'INFO' },
  warning:  { border: 'border-orange-500/40', text: 'text-orange-300', bg: 'bg-orange-500/10', label: 'WARNING' },
  critical: { border: 'border-red-500/40',    text: 'text-red-300',    bg: 'bg-red-500/10',    label: 'CRITICAL' },
};

const providerBadge = {
  sarvam:   { label: 'Sarvam AI',   color: 'bg-violet-500/20 text-violet-300' },
  mistral:  { label: 'Mistral AI',  color: 'bg-orange-500/20 text-orange-300' },
  ollama:   { label: 'Ollama',      color: 'bg-emerald-500/20 text-emerald-300' },
  fallback: { label: 'Rule-based',  color: 'bg-gray-500/20 text-gray-400' },
};

export default function AIInsightPanel() {
  const { analysis, analysisLoading } = useSessionStore();

  const style = alertStyles[analysis?.alertLevel ?? 'info'];
  const badge = providerBadge[analysis?.provider ?? 'fallback'];

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} backdrop-blur-md p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
          🤖 AI Insight
        </span>
        <div className="flex gap-2 items-center">
          {analysis && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.text} border ${style.border}`}>
            {style.label}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {analysisLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-white/40 text-sm"
          >
            <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
            Analysing cognitive state...
          </motion.div>
        ) : analysis ? (
          <motion.div
            key={analysis.insight}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className={`text-sm font-medium mb-2 ${style.text}`}>
              {analysis.insight}
            </p>
            <p className="text-xs text-white/50">
              💡 {analysis.recommendation}
            </p>
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-white/30"
          >
            Start a session to receive AI insights every 15 seconds.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
