import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const EMOTION_COLORS = {
  anxious: '#f59e0b',
  sad: '#3b82f6',
  hopeless: '#6366f1',
  angry: '#ef4444',
  stressed: '#f97316',
  lonely: '#8b5cf6',
  scared: '#ec4899',
  overwhelmed: '#14b8a6',
  frustrated: '#e11d48',
  worried: '#d97706',
  depressed: '#1d4ed8',
  happy: '#22c55e',
  hopeful: '#10b981',
  calm: '#06b6d4',
  relieved: '#84cc16',
  grateful: '#a3e635',
  confused: '#a78bfa',
  numb: '#94a3b8',
  exhausted: '#78716c',
  guilty: '#be185d',
}

const DEFAULT_COLOR = '#94a3b8'

function getEmotionColor(emotion) {
  return EMOTION_COLORS[emotion.toLowerCase()] || DEFAULT_COLOR
}

export default function EmotionTideChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No emotion data yet. Complete some chat sessions to see your emotional flow.
      </div>
    )
  }

  // Collect all unique emotions
  const allEmotions = new Set()
  data.forEach((entry) => {
    Object.keys(entry.emotions || {}).forEach((e) => allEmotions.add(e))
  })
  const emotions = Array.from(allEmotions)

  // Transform data for Recharts
  const chartData = data.map((entry) => {
    const point = { date: entry.date }
    emotions.forEach((e) => {
      point[e] = entry.emotions?.[e] || 0
    })
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {emotions.map((emotion) => (
            <linearGradient key={emotion} id={`grad-${emotion}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={getEmotionColor(emotion)} stopOpacity={0.7} />
              <stop offset="95%" stopColor={getEmotionColor(emotion)} stopOpacity={0.1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#78716c' }}
          tickFormatter={(v) => {
            const d = new Date(v)
            return `${d.getMonth() + 1}/${d.getDate()}`
          }}
        />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fffef9',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '12px',
          }}
          labelFormatter={(v) => new Date(v).toLocaleDateString()}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
        />
        {emotions.map((emotion) => (
          <Area
            key={emotion}
            type="monotone"
            dataKey={emotion}
            stackId="1"
            stroke={getEmotionColor(emotion)}
            fill={`url(#grad-${emotion})`}
            strokeWidth={2}
            name={emotion.charAt(0).toUpperCase() + emotion.slice(1)}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
