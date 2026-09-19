/**
 * LiveChart — Recharts line chart for metric history.
 */

'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface LiveChartProps {
  data: number[];
  color?: string;
  label?: string;
  domain?: [number, number];
}

export default function LiveChart({
  data, color = '#22d3ee', label = 'Value', domain = [0, 100],
}: LiveChartProps) {
  const chartData = data.map((v, i) => ({ t: i, [label]: Math.round(v) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="t" hide />
        <YAxis domain={domain} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: 12,
          }}
          formatter={(val) => [val ?? 0, label]}
          labelFormatter={() => ''}
        />
        <Line
          type="monotone"
          dataKey={label}
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
