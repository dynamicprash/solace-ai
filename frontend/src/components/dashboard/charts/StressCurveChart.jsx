import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea
} from 'recharts'

const CRISIS_COLORS = {
  anxiety: '#f59e0b',
  sadness: '#3b82f6',
  anger: '#ef4444',
  guilt: '#be185d',
  avg_stress: '#475569',
}

export default function StressCurveChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No stress curve data yet. Start sharing to map your emotional state over time.
      </div>
    )
  }

  // Format date display for chart
  const chartData = data.map((entry) => ({
    ...entry,
    displayDate: entry.date ? new Date(entry.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }) : 'N/A',
  }))

  return (
    <div className="w-full flex flex-col">
      <div className="text-xs text-sage-500 mb-2 text-center">
        Crisis emotion intensities across consecutive chat sessions
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 11, fill: '#78716c' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#78716c' }}
            domain={[0, 1.0]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fffef9',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
            }}
            formatter={(value, name) => [
              `${Math.round(value * 100)}%`,
              name === 'avg_stress' ? 'Composite Stress Index' : name.charAt(0).toUpperCase() + name.slice(1)
            ]}
            labelFormatter={(label, items) => {
              const item = items[0]?.payload
              return `${item?.session_title || 'Session'} (${item?.date || label})`
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          
          {/* High Stress Zone Highlight */}
          <ReferenceArea
            y1={0.7}
            y2={1.0}
            fill="#fee2e2"
            fillOpacity={0.25}
            stroke="#fca5a5"
            strokeDasharray="3 3"
            label={{
              value: 'High Distress Zone',
              fill: '#b91c1c',
              fontSize: 10,
              position: 'insideTopLeft',
              fontWeight: 500,
            }}
          />
          
          <Line
            type="monotone"
            dataKey="anxiety"
            stroke={CRISIS_COLORS.anxiety}
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Anxiety"
          />
          <Line
            type="monotone"
            dataKey="sadness"
            stroke={CRISIS_COLORS.sadness}
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Sadness"
          />
          <Line
            type="monotone"
            dataKey="anger"
            stroke={CRISIS_COLORS.anger}
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Anger"
          />
          <Line
            type="monotone"
            dataKey="guilt"
            stroke={CRISIS_COLORS.guilt}
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Guilt"
          />
          <Line
            type="monotone"
            dataKey="avg_stress"
            stroke={CRISIS_COLORS.avg_stress}
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
            name="Composite Index"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
