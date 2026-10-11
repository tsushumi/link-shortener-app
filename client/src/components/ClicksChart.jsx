import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { weekday } from '../lib/format';

// Bar chart of clicks per day for the last 7 days. `data` is [{ date: 'YYYY-MM-DD', clicks }].
export default function ClicksChart({ data, height = 190 }) {
  const rows = data.map((d) => ({ ...d, label: weekday(d.date) }));
  const total = rows.reduce((sum, d) => sum + d.clicks, 0);
  const peak = Math.max(0, ...rows.map((d) => d.clicks));

  return (
    <figure className="m-0">
      <div style={{ height }} role="img" aria-label={`Clicks per day for the last 7 days: ${total} in total`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e3e7ee" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#667085', fontSize: 12 }} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#667085', fontSize: 12 }}
              domain={[0, Math.max(4, peak)]}
            />
            <Tooltip
              cursor={{ fill: '#eceeff' }}
              contentStyle={{ borderRadius: 10, border: '1px solid #e3e7ee', fontSize: 13 }}
              formatter={(value) => [value, value === 1 ? 'click' : 'clicks']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
            />
            <Bar dataKey="clicks" fill="#3447ff" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {total === 0 && (
        <figcaption className="mt-1 text-center text-sm text-ink-faint">No clicks in the last 7 days yet.</figcaption>
      )}
    </figure>
  );
}
