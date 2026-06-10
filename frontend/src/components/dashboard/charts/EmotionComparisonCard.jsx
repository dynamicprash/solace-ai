import { useMemo } from 'react'
import { Sparkles, Scale } from 'lucide-react'

const POSITIVE_EMOTIONS = ['joy', 'love', 'relief', 'pride', 'calm', 'hopeful', 'grateful', 'happy']
const NEGATIVE_EMOTIONS = ['anxiety', 'sadness', 'anger', 'guilt', 'grief', 'fear', 'shame', 'depression', 'self-harm', 'hopeless', 'lonely', 'scared', 'overwhelmed', 'frustrated', 'worried', 'numb', 'exhausted']

export default function EmotionComparisonCard({ data }) {
  const comparisons = useMemo(() => {
    if (!data || data.length < 2) return null

    const lastWeek = data[data.length - 2]
    const thisWeek = data[data.length - 1]

    // Gather all emotions mentioned in either week
    const allEmotions = new Set([
      ...Object.keys(lastWeek.emotions || {}),
      ...Object.keys(thisWeek.emotions || {}),
    ])

    return Array.from(allEmotions)
      .map((emo) => {
        const name = emo.charAt(0).toUpperCase() + emo.slice(1)
        const currentCount = thisWeek.emotions?.[emo] || 0
        const prevCount = lastWeek.emotions?.[emo] || 0
        const diff = currentCount - prevCount

        // Determine if change is positive or negative for wellness
        const emoLower = emo.toLowerCase()
        let type = 'neutral' // 'good', 'bad', 'neutral'
        
        if (diff > 0) {
          if (POSITIVE_EMOTIONS.includes(emoLower)) {
            type = 'good'
          } else if (NEGATIVE_EMOTIONS.includes(emoLower)) {
            type = 'bad'
          }
        } else if (diff < 0) {
          if (POSITIVE_EMOTIONS.includes(emoLower)) {
            type = 'bad'
          } else if (NEGATIVE_EMOTIONS.includes(emoLower)) {
            type = 'good'
          }
        }

        return {
          name,
          currentCount,
          prevCount,
          diff,
          type,
        }
      })
      .filter((item) => item.diff !== 0) // Only show emotions that changed
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)) // Order by biggest change magnitude
  }, [data])

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sage-400 text-sm italic bg-sage-50/50 rounded-2xl border border-sage-100">
        <Sparkles className="w-4 h-4 text-sage-400" />
        <span>Weekly emotional comparison will appear here once you have at least 2 weeks of activity.</span>
      </div>
    )
  }

  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sage-500 text-sm bg-sage-50/50 rounded-2xl border border-sage-100">
        <Scale className="w-4 h-4 text-sage-500" />
        <span>Your emotional distribution is identical to last week. Stable wellness!</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 w-full">
      {comparisons.slice(0, 6).map((item) => {
        const isIncrease = item.diff > 0
        const sign = isIncrease ? '+' : ''
        
        let borderClass = 'border-sage-100 bg-white'
        let textClass = 'text-sage-500'
        let badgeClass = 'bg-sage-100 text-sage-700'
        let arrow = '→'

        if (item.type === 'good') {
          borderClass = 'border-emerald-100 bg-emerald-50/20'
          textClass = 'text-emerald-600'
          badgeClass = 'bg-emerald-100 text-emerald-800'
          arrow = isIncrease ? '↑' : '↓'
        } else if (item.type === 'bad') {
          borderClass = 'border-rose-100 bg-rose-50/20'
          textClass = 'text-rose-600'
          badgeClass = 'bg-rose-100 text-rose-800'
          arrow = isIncrease ? '↑' : '↓'
        }

        return (
          <div
            key={item.name}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 hover:shadow-sm gap-2 ${borderClass}`}
          >
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-sage-800 truncate">{item.name}</h4>
              <p className="text-xs text-sage-400 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                Last week: {item.prevCount} • This week: {item.currentCount}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${badgeClass}`}>
              <span>{arrow}</span>
              <span>{sign}{item.diff}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
