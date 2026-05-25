import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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

export default function WeeklyEmotionTrends({ data }) {
  const [disabledEmotions, setDisabledEmotions] = useState([])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sage-400 text-sm">
        No weekly trend data yet. Complete sessions over multiple weeks to see trends.
      </div>
    )
  }

  // Extract all unique emotions mentioned across all weeks
  const allEmotions = new Set()
  data.forEach((entry) => {
    Object.keys(entry.emotions || {}).forEach((emo) => {
      allEmotions.add(emo.charAt(0).toUpperCase() + emo.slice(1))
    })
  })
  const emotionsList = Array.from(allEmotions).sort()

  // Format data for Recharts
  const chartData = data.map((entry) => {
    const formatted = { week: entry.week }
    emotionsList.forEach((emo) => {
      // Look up with flexible casing
      const val = entry.emotions?.[emo] || entry.emotions?.[emo.toLowerCase()] || 0
      formatted[emo] = val
    })
    return formatted
  })

  const handleLegendClick = (e) => {
    const { dataKey } = e
    if (disabledEmotions.includes(dataKey)) {
      setDisabledEmotions(disabledEmotions.filter((item) => item !== dataKey))
    } else {
      setDisabledEmotions([...disabledEmotions, dataKey])
    }
  }

  return (
    <div className="w-full">
      <div className="text-xs text-sage-500 mb-3 text-center italic">
        💡 Click on an emotion in the legend to show/hide its line
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickFormatter={(v) => {
              // Convert ISO week string "2026-W20" into something nicer like "W20" or "W20 (May)" if parsed
              return v.replace(/^\d{4}-/, '')
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
            labelFormatter={(v) => `Week: ${v}`}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px', cursor: 'pointer' }}
            onClick={handleLegendClick}
          />
          {emotionsList.map((emotion) => (
            <Line
              key={emotion}
              type="monotone"
              dataKey={emotion}
              stroke={getEmotionColor(emotion)}
              strokeWidth={disabledEmotions.includes(emotion) ? 1 : 2.5}
              dot={{ r: 4, stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 6 }}
              hide={disabledEmotions.includes(emotion)}
              opacity={disabledEmotions.includes(emotion) ? 0.2 : 1}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
