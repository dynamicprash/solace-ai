import SeverityBadge from './SeverityBadge'

export default function Topbar({ 
  isSidebarOpen, 
  onToggleSidebar, 
  severity, 
  category, 
  confidence,
  onNewChat 
}) {
  return (
    <div className="flex items-start gap-3 p-2.5 bg-warm-white border-b border-stone-200 min-h-15 flex-shrink-0 flex-wrap">
      {/* Menu Button */}
      <button
        onClick={onToggleSidebar}
        className="w-9 h-9 bg-stone-100 border border-stone-200 rounded-lg text-sm cursor-pointer flex items-center justify-center flex-shrink-0 hover:bg-stone-200 transition-colors"
        title="Toggle sidebar"
      >
        ☰
      </button>

      {/* Center Area - Title or empty */}
      <div className="flex-1" />

      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        className="px-4 py-2 bg-sage-600 text-white border-none rounded-lg font-body text-sm font-medium cursor-pointer whitespace-nowrap hover:bg-sage-700 transition-colors"
      >
        + New Chat
      </button>

      {/* Severity Badge */}
      {severity && (
        <div className="w-full">
          <SeverityBadge 
            severity={severity}
            category={category}
            confidence={confidence}
            visible={true}
          />
        </div>
      )}
    </div>
  )
}
