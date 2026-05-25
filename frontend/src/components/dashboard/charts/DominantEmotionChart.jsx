import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts'

const EMOTION_COLORS = {
  anxiety: '#f59e0b',
  sadness: '#3b82f6',
  anger: '#ef4444',
  guilt: '#be185d',
  love: '#ec4899',
  joy: '#22c55e',
  neutral: '#94a3b8',
  grief: '#6366f1',
  fear: '#8b5cf6',
  shame: '#78716c',
  pride: '#10b981',
  relief: '#06b6d4',
  surprise: '#f97316',
  depression: '#1d4ed8',
  'self-harm': '#e11d48',
}

const DEFAULT_COLOR = '#94a3b8'

function getEmotionColor(emotion) {
  return EMOTION_COLORS[emotion.toLowerCase()] || DEFAULT_COLOR
}

export default function DominantEmotionChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No emotion distribution data yet. Start sharing to see your profile.
      </div>
    )
  }

  const total = Object.values(data).reduce((sum, val) => sum + val, 0)

  const chartData = Object.entries(data)
    .map(([emotion, count]) => ({
      name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      value: count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)

  // Find most dominant emotion
  const mostDominant = chartData[0]?.name || 'None'

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full" style={{ height: '260px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={getEmotionColor(entry.name)}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fffef9',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '12px',
              }}
              formatter={(value, name, props) => [
                `${value} session(s) (${props.payload.percentage}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Central Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-5px]">
          <span className="text-xs text-sage-400 font-medium uppercase tracking-wider">Most Dominant</span>
          <span className="text-lg font-bold text-sage-800 mt-0.5">{mostDominant}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3 px-4 max-h-24 overflow-y-auto w-full">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-sage-600 font-medium">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: getEmotionColor(item.name) }}
            />
            <span>{item.name}:</span>
            <span className="text-sage-900 font-bold">{item.value} ({item.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
