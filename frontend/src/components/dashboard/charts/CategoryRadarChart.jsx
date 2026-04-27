import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'

const CATEGORY_DISPLAY = {
  anxiety: 'Anxiety',
  depression: 'Depression',
  self_harm: 'Self-harm',
  neutral: 'General',
}

export default function CategoryRadarChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No category data yet. Chat sessions will build your profile.
      </div>
    )
  }

  const chartData = Object.entries(data).map(([key, value]) => ({
    category: CATEGORY_DISPLAY[key] || key.charAt(0).toUpperCase() + key.slice(1),
    confidence: Math.round(value * 100),
    fullMark: 100,
  }))

  // Ensure all 4 categories are present
  const allCats = ['Anxiety', 'Depression', 'Self-harm', 'General']
  allCats.forEach((cat) => {
    if (!chartData.find((d) => d.category === cat)) {
      chartData.push({ category: cat, confidence: 0, fullMark: 100 })
    }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
        <defs>
          <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 12, fill: '#57534e', fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#a8a29e' }}
          tickCount={4}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fffef9',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '12px',
          }}
          formatter={(value) => [`${value}%`, 'Avg Confidence']}
        />
        <Radar
          name="Profile"
          dataKey="confidence"
          stroke="#6366f1"
          fill="url(#radarFill)"
          strokeWidth={2}
          dot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
