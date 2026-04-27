import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine
} from 'recharts'

const SEV_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High' }
const SEV_COLORS = { 1: '#22c55e', 2: '#eab308', 3: '#ef4444' }

function CustomDot({ cx, cy, payload }) {
  const color = SEV_COLORS[payload.severity_num] || '#94a3b8'
  return (
    <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
  )
}

export default function SeverityJourneyChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No severity data yet. Complete sessions to track your trajectory.
      </div>
    )
  }

  const chartData = data.map((item, idx) => ({
    ...item,
    index: idx + 1,
    label: `#${idx + 1}`,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="sevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="50%" stopColor="#eab308" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.15} />
          </linearGradient>
        </defs>

        {/* Color zones */}
        <ReferenceArea y1={2.5} y2={3} fill="#ef4444" fillOpacity={0.08} />
        <ReferenceArea y1={1.5} y2={2.5} fill="#eab308" fillOpacity={0.06} />
        <ReferenceArea y1={0.5} y2={1.5} fill="#22c55e" fillOpacity={0.08} />

        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#78716c' }}
        />
        <YAxis
          domain={[0.5, 3.5]}
          ticks={[1, 2, 3]}
          tickFormatter={(v) => SEV_LABELS[v] || ''}
          tick={{ fontSize: 11, fill: '#78716c' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fffef9',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '12px',
          }}
          formatter={(value) => [SEV_LABELS[value] || value, 'Severity']}
          labelFormatter={(label) => {
            const item = chartData.find((d) => d.label === label)
            return item ? `${item.title} (${item.date})` : label
          }}
        />

        <Line
          type="monotone"
          dataKey="severity_num"
          stroke="#6366f1"
          strokeWidth={3}
          dot={<CustomDot />}
          activeDot={{ r: 7, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
        />

        {/* Trend line */}
        {chartData.length >= 3 && (
          <ReferenceLine
            segment={[
              { x: chartData[0].label, y: chartData[0].severity_num },
              { x: chartData[chartData.length - 1].label, y: chartData[chartData.length - 1].severity_num },
            ]}
            stroke="#6366f1"
            strokeDasharray="5 5"
            strokeOpacity={0.4}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
