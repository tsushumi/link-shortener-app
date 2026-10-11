import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const clip = (label) => (label.length > 24 ? `${label.slice(0, 23)}…` : label);

// Horizontal bar chart of clicks by referring site. `data` is [{ source, clicks }].
export default function ReferrersChart({ data }) {
  if (data.length === 0) return <p className="text-sm text-ink-faint">No referrer data yet.</p>;
  const height = Math.max(120, data.length * 38 + 30);

  return (
    <div style={{ height }} role="img" aria-label={`Top referrers: ${data.map((d) => `${d.source} ${d.clicks}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#e3e7ee" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#667085', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="source"
            width={156}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#101828', fontSize: 13 }}
            tickFormatter={clip}
          />
          <Tooltip
            cursor={{ fill: '#eceeff' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e3e7ee', fontSize: 13 }}
            formatter={(value) => [value, value === 1 ? 'click' : 'clicks']}
          />
          <Bar dataKey="clicks" fill="#3447ff" radius={[0, 5, 5, 0]} barSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
