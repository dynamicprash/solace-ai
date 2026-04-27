import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

function getScoreColor(score) {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#6366f1'
  if (score >= 30) return '#eab308'
  return '#ef4444'
}

function getScoreLabel(score) {
  if (score >= 75) return 'Deep'
  if (score >= 50) return 'Moderate'
  if (score >= 30) return 'Surface'
  return 'Brief'
}

export default function SessionDepthChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No session data yet. Complete sessions to measure reflection depth.
      </div>
    )
  }

  const chartData = data
    .slice(-10) // last 10 sessions
    .map((item, idx) => ({
      ...item,
      shortTitle: item.title?.length > 18
        ? item.title.substring(0, 18) + '…'
        : item.title || 'Untitled',
    }))

  // Calculate average
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length)

  return (
    <div>
      {/* Avg Score badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: getScoreColor(avgScore) }}
          >
            {avgScore}
          </div>
          <div>
            <span className="text-sm font-medium text-sage-900">Avg Depth</span>
            <span className="text-xs text-sage-500 ml-2">{getScoreLabel(avgScore)}</span>
          </div>
        </div>
        <span className="text-xs text-sage-400">Last {chartData.length} sessions</span>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#78716c' }}
            ticks={[0, 25, 50, 75, 100]}
          />
          <YAxis
            type="category"
            dataKey="shortTitle"
            width={120}
            tick={{ fontSize: 10, fill: '#57534e' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fffef9',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '12px',
            }}
            formatter={(value) => [`${value}/100`, 'Depth Score']}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getScoreColor(entry.score)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
