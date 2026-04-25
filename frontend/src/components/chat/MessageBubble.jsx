export default function MessageBubble({ message, isUser, isConclusion }) {
  // Get user initials
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
  }

  if (isConclusion) {
    return (
      <div className="flex items-end gap-2.5 animate-fadeUp">
        <div className="w-8.5 h-8.5 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-green-300">
          🤖
        </div>
        <div className="max-w-[min(620px,90%)] p-3.5 px-4.5 rounded-3xl rounded-bl text-base leading-relaxed bg-gradient-to-br from-green-50 to-green-100 border-2 border-sage-400">
          <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider mb-2.5 pb-2.5 border-b border-sage-400">
            Session Summary
          </div>
          <div dangerouslySetInnerHTML={{ __html: message }} className="text-stone-800" />
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex items-end gap-2.5 justify-end animate-fadeUp">
        <div className="max-w-[min(480px,80%)] p-3.5 px-4.5 rounded-3xl rounded-br text-base leading-relaxed bg-sage-700 text-white">
          {message}
        </div>
        <div className="w-8.5 h-8.5 rounded-full bg-sage-700 text-white flex items-center justify-center text-xs font-semibold tracking-wide flex-shrink-0">
          U
        </div>
      </div>
    )
  }

  // Bot message
  return (
    <div className="flex items-end gap-2.5 animate-fadeUp">
      <div className="w-8.5 h-8.5 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0 border-2 border-green-300">
        🤖
      </div>
      <div className="max-w-[min(480px,80%)] p-3.5 px-4.5 rounded-3xl rounded-bl text-base leading-relaxed bg-warm-white text-stone-800 border-2 border-stone-300 shadow-card">
        {message}
      </div>
    </div>
  )
}
