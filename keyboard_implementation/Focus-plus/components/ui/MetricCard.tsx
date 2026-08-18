/**
 * MetricCard — Glassmorphism card showing a single metric with animated bar.
 */

'use client';

import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  score?: number;       // 0–100 for the fill bar
  color?: string;       // Tailwind color class e.g. 'cyan'
  icon?: string;
}

const colorMap: Record<string, { bar: string; text: string; glow: string }> = {
  cyan:   { bar: 'bg-cyan-400',   text: 'text-cyan-400',   glow: 'shadow-cyan-500/30' },
  purple: { bar: 'bg-purple-400', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  green:  { bar: 'bg-emerald-400',text: 'text-emerald-400',glow: 'shadow-emerald-500/30' },
  orange: { bar: 'bg-orange-400', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
  red:    { bar: 'bg-red-400',    text: 'text-red-400',    glow: 'shadow-red-500/30' },
  blue:   { bar: 'bg-blue-400',   text: 'text-blue-400',   glow: 'shadow-blue-500/30' },
};

export default function MetricCard({
  label, value, unit, score, color = 'cyan', icon,
}: MetricCardProps) {
  const c = colorMap[color] ?? colorMap.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md
        p-5 shadow-lg ${c.glow}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/50 uppercase tracking-widest">
          {icon && <span className="mr-1">{icon}</span>}{label}
        </span>
      </div>

      {/* Value */}
      <div className={`text-3xl font-bold ${c.text} mb-3`}>
        {value}
        {unit && <span className="text-base font-normal text-white/40 ml-1">{unit}</span>}
      </div>

      {/* Score bar */}
      {score !== undefined && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${c.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}
    </motion.div>
  );
}
