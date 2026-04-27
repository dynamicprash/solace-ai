import { useEffect, useState } from 'react'

const COLORS = {
  improving: '#22c55e',
  stable: '#eab308',
  declining: '#ef4444',
  neutral: '#94a3b8',
}

const TREND_LABELS = {
  improving: '↗ Improving',
  stable: '→ Stable',
  declining: '↘ Declining',
  neutral: '— Not enough data',
}

export default function WellbeingPulse({ data }) {
  const [animatedScore, setAnimatedScore] = useState(0)

  const score = data?.score ?? 0
  const trend = data?.trend ?? 'neutral'
  const breakdown = data?.breakdown ?? {}

  useEffect(() => {
    let frame
    let start = 0
    const duration = 1200
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(eased * score))
      if (progress < 1) {
        frame = requestAnimationFrame(animate)
      }
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [score])

  const radius = 80
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (animatedScore / 100) * circumference
  const color = COLORS[trend] || COLORS.neutral

  const breakdownItems = [
    { label: 'Severity Trend', value: breakdown.severity_trend ?? 0, icon: '📉' },
    { label: 'Engagement', value: breakdown.engagement ?? 0, icon: '🔥' },
    { label: 'Completion', value: breakdown.completion_rate ?? 0, icon: '✅' },
    { label: 'Emotion Range', value: breakdown.emotional_diversity ?? 0, icon: '🌈' },
  ]

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Gauge */}
      <div className="relative">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {/* Background track */}
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.33, 1, 0.68, 1)',
              filter: `drop-shadow(0 0 6px ${color}40)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-sage-900">{animatedScore}</span>
          <span className="text-xs text-sage-500 mt-1">/ 100</span>
        </div>
      </div>

      {/* Trend badge */}
      <div
        className="px-4 py-1.5 rounded-full text-sm font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {TREND_LABELS[trend]}
      </div>

      {/* Breakdown bars */}
      <div className="w-full space-y-3 mt-2">
        {breakdownItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-sage-600">
                {item.icon} {item.label}
              </span>
              <span className="font-medium text-sage-900">{item.value}%</span>
            </div>
            <div className="h-2 bg-sage-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${item.value}%`,
                  backgroundColor: item.value >= 70 ? '#22c55e' : item.value >= 40 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
