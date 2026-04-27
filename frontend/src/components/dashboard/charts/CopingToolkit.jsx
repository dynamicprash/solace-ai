const CATEGORY_ICONS = {
  'Breathing': null,
  'Exercise': null,
  'Social': null,
  'Professional': null,
  'Mindfulness': null,
  'Journaling': null,
  'Sleep': null,
  'Self-care': null,
}

const CATEGORY_COLORS = {
  'Breathing': '#06b6d4',
  'Exercise': '#22c55e',
  'Social': '#f59e0b',
  'Professional': '#ef4444',
  'Mindfulness': '#8b5cf6',
  'Journaling': '#3b82f6',
  'Sleep': '#6366f1',
  'Self-care': '#ec4899',
}

const CATEGORY_TIPS = {
  'Breathing': 'Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.',
  'Exercise': 'Even a 10-minute walk can significantly reduce stress hormones.',
  'Social': 'Reaching out to one person today can make a big difference.',
  'Professional': 'Consider booking a session with a therapist or counselor.',
  'Mindfulness': 'Start with 5 minutes of guided meditation daily.',
  'Journaling': 'Write 3 things you\'re grateful for each morning.',
  'Sleep': 'Aim for consistent sleep/wake times, even on weekends.',
  'Self-care': 'Schedule one enjoyable activity for yourself this week.',
}

export default function CopingToolkit({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-sage-400 text-sm gap-2">
        <div className="w-10 h-10 bg-sage-50 rounded-full flex items-center justify-center mb-2">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
        <span>Complete some chat sessions to build your personal coping toolkit.</span>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.map((item) => {
        const icon = CATEGORY_ICONS[item.category] || null
        const color = CATEGORY_COLORS[item.category] || '#6366f1'
        const tip = CATEGORY_TIPS[item.category] || ''
        const barWidth = (item.count / maxCount) * 100

        return (
          <div
            key={item.category}
            className="group relative rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all duration-300 bg-white overflow-hidden"
          >
            {/* Subtle background bar */}
            <div
              className="absolute inset-y-0 left-0 opacity-[0.07] transition-all duration-500"
              style={{ width: `${barWidth}%`, backgroundColor: color }}
            />

            <div className="relative flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: `${color}18` }}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-sage-900">{item.category}</h4>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: color }}
                  >
                    {item.count}×
                  </span>
                </div>
                <p className="text-xs text-sage-500 mt-1 leading-relaxed line-clamp-2">{tip}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
