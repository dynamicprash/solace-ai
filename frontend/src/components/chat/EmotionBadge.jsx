const EMOTION_CONFIG = {
  Anxiety:        { emoji: '😰', color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-300', progress: 'bg-amber-500' },
  Sadness:        { emoji: '😢', color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-300',  progress: 'bg-blue-500' },
  Anger:          { emoji: '😠', color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-300',   progress: 'bg-red-500' },
  Guilt:          { emoji: '😔', color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-300', progress: 'bg-purple-500' },
  Disappointment: { emoji: '😞', color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-300', progress: 'bg-slate-500' },
  Confusion:      { emoji: '😵‍💫', color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-300', progress: 'bg-orange-500' },
  Hopefulness:    { emoji: '🌱', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300', progress: 'bg-emerald-500' },
  Joy:            { emoji: '😊', color: 'text-yellow-600',  bg: 'bg-yellow-50',  border: 'border-yellow-300', progress: 'bg-yellow-500' },
  Love:           { emoji: '💕', color: 'text-pink-600',    bg: 'bg-pink-50',    border: 'border-pink-300',  progress: 'bg-pink-500' },
  Gratitude:      { emoji: '🙏', color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-300',  progress: 'bg-teal-500' },
  Curiosity:      { emoji: '🤔', color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-300', progress: 'bg-indigo-500' },
  Surprise:       { emoji: '😮', color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-300',  progress: 'bg-cyan-500' },
  Neutral:        { emoji: '😐', color: 'text-stone-500',   bg: 'bg-stone-50',   border: 'border-stone-300', progress: 'bg-stone-400' },
}

const DEFAULT_CONFIG = { emoji: '🔵', color: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-300', progress: 'bg-stone-400' }

export default function EmotionBadge({ emotions = [], primaryEmotion, confidences = {}, visible = false }) {
  if (!visible || !emotions || emotions.length === 0) return null

  const primary = primaryEmotion || emotions[0]
  const config = EMOTION_CONFIG[primary] || DEFAULT_CONFIG
  const confidence = confidences[primary] || 0

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded-2xl p-2.5 px-3.5 block animate-fadeIn`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-lg">{config.emoji}</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-stone-800">
            {primary}
          </div>
          {emotions.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {emotions.slice(1, 4).map((emo) => {
                const emoConf = EMOTION_CONFIG[emo] || DEFAULT_CONFIG
                return (
                  <span
                    key={emo}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${emoConf.bg} ${emoConf.color} font-medium`}
                  >
                    {emoConf.emoji} {emo}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`text-xs font-medium uppercase tracking-wider ${config.color}`}>
          {emotions.length === 1 ? 'Detected' : `${emotions.length} emotions`}
        </div>
        {confidence > 0 && (
          <div className="text-xs text-stone-500 bg-stone-200 px-1.5 py-0.5 rounded-full">
            {Math.round(confidence * 100)}% confidence
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="h-1.25 bg-stone-300 rounded-full overflow-hidden">
          <div
            className={`h-full ${config.progress} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${(confidence || 0) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
