import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

export default function WellbeingPulseHistory({ sessions }) {
  const chartData = useMemo(() => {
    if (!sessions || sessions.length === 0) return []

    // 1. Group sessions by ISO Week (e.g. "2026-W20")
    const sessionsByWeek = {}
    
    // Sort sessions ascending by date first
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    sortedSessions.forEach(s => {
      if (!s.created_at) return
      const d = new Date(s.created_at)
      
      // Calculate ISO week number
      const target = new Date(d.valueOf())
      const dayNr = (d.getDay() + 6) % 7
      target.setDate(target.getDate() - dayNr + 3)
      const firstThursday = target.valueOf()
      target.setMonth(0, 1)
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
      }
      const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000)
      const weekKey = `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`
      
      if (!sessionsByWeek[weekKey]) {
        sessionsByWeek[weekKey] = []
      }
      sessionsByWeek[weekKey].push(s)
    })

    const weeks = Object.keys(sessionsByWeek).sort()
    const history = []
    
    // 2. Cumulative calculation for each week
    const cumulativeSessions = []
    
    weeks.forEach(weekKey => {
      cumulativeSessions.push(...sessionsByWeek[weekKey])
      
      // Compute Wellbeing Pulse Score
      const SEV_MAP = { low: 1, medium: 2, high: 3 }
      
      // Severity Trend
      const sevScoresList = cumulativeSessions
        .map(s => SEV_MAP[s.final_severity])
        .filter(v => v !== undefined)
        
      let severityTrendScore = 50
      if (sevScoresList.length >= 2) {
        const recent = sevScoresList.slice(-Math.min(3, sevScoresList.length))
        const older = sevScoresList.slice(0, Math.max(1, sevScoresList.length - 3))
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
        severityTrendScore = Math.max(0, Math.min(100, Math.round(100 - (recentAvg / 3) * 100 + 33)))
      } else if (sevScoresList.length === 1) {
        severityTrendScore = Math.max(0, Math.min(100, Math.round(100 - (sevScoresList[0] / 3) * 100 + 33)))
      }
      
      // Engagement
      const engagementScore = Math.min(100, cumulativeSessions.length * 15)
      
      // Completion
      const concludedCount = cumulativeSessions.filter(s => s.concluded).length
      const completionRate = cumulativeSessions.length ? Math.round((concludedCount / cumulativeSessions.length) * 100) : 0
      
      // Diversity
      const uniqueEmotions = new Set(cumulativeSessions.map(s => s.final_category).filter(Boolean))
      const emotionDiversity = Math.min(100, uniqueEmotions.size * 20)
      
      // Composite Pulse Score
      const pulseScore = Math.min(100, Math.max(0, Math.round(
        severityTrendScore * 0.35 +
        engagementScore * 0.20 +
        completionRate * 0.25 +
        emotionDiversity * 0.20
      )))
      
      history.push({
        week: weekKey.replace(/^\d{4}-/, ''), // e.g. "W20"
        score: pulseScore
      })
    })
    
    return history
  }, [sessions])

  if (chartData.length < 2) return null

  return (
    <div className="w-full mt-4 pt-4 border-t border-sage-100">
      <h4 className="text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-2 text-center">
        Weekly Trend (historical curve)
      </h4>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="pulseHistoryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fffef9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '11px',
                padding: '4px 8px',
              }}
              formatter={(value) => [`${value}/100`, 'Pulse Score']}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#pulseHistoryGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
