import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

// Categorical palette. Colour is never the only cue: the legend list beside the chart repeats
// every name with its count and share.
const CHART_COLORS = ['#3447ff', '#0e9f8e', '#e0a100', '#d6336c', '#7a4dd8', '#667085', '#3b82f6', '#8a6d3b'];

// Pie chart of clicks by browser. `data` is [{ browser, clicks }].
export default function BrowserChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.clicks, 0);
  if (total === 0) return <p className="text-sm text-ink-faint">No browser data yet.</p>;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0" role="img" aria-label={`Clicks by browser: ${data.map((d) => `${d.browser} ${d.clicks}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="clicks" nameKey="browser" innerRadius={42} outerRadius={80} paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.browser} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #e3e7ee', fontSize: 13 }}
              formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="m-0 w-full list-none space-y-1.5 p-0 text-sm">
        {data.map((d, i) => (
          <li key={d.browser} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
              <span className="truncate">{d.browser}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-soft">
              {d.clicks} <span className="text-ink-faint">({Math.round((d.clicks / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
