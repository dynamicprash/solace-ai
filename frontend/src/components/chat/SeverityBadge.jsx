export default function SeverityBadge({ severity, category, confidence, visible = false }) {
  if (!visible || !severity) return null

  const severityConfig = {
    high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-600/30', progress: 'bg-red-600', icon: '⚠️', label: 'HIGH' },
    medium: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-600/30', progress: 'bg-orange-600', icon: '📌', label: 'MEDIUM' },
    low: { color: 'text-sage-600', bg: 'bg-green-50', border: 'border-sage-600/30', progress: 'bg-sage-600', icon: '✓', label: 'LOW' },
  }

  const config = severityConfig[severity] || severityConfig.low

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded-2xl p-2.5 px-3.5 block animate-fadeIn`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-lg">{config.icon}</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-stone-800">
            {category || 'Emotional Support Needed'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`text-xs font-medium uppercase tracking-wider ${config.color}`}>
          {config.label}
        </div>
        {confidence && (
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
