import { useState, useEffect, useRef } from 'react'

export default function InputArea({ 
  onSendMessage, 
  isLoading, 
  isConcluded,
  questionCount = 0,
  maxQuestions = 10
}) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px'
    }
  }, [message])

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const remainingQuestions = maxQuestions - questionCount

  if (isConcluded) {
    return (
      <div className="p-4 px-6 pb-5 bg-warm-white border-t border-stone-300 flex-shrink-0">
        <div className="max-w-4xl mx-auto text-center text-stone-600 text-sm p-3.5">
          <strong>Session Concluded</strong>
          <p className="mt-2 text-xs">
            Thank you for sharing. You can start a new chat or review your previous conversations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 px-6 pb-5 bg-warm-white border-t border-stone-300 flex-shrink-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-2.5 items-end bg-cream border-2 border-stone-400 rounded-3xl p-2.5 pl-4.5 transition-all duration-200 focus-within:border-sage-600 focus-within:ring-2 focus-within:ring-sage-600/10">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share your thoughts..."
            disabled={isLoading}
            className="flex-1 border-none bg-transparent font-body text-base text-stone-800 outline-none resize-none max-h-35 overflow-y-auto leading-relaxed min-h-6 disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !message.trim()}
            className="w-9.5 h-9.5 bg-sage-700 text-white border-none rounded-full text-lg cursor-pointer disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-60 hover:bg-sage-800 hover:scale-105 disabled:hover:bg-sage-700 disabled:hover:scale-100"
            title="Send message (Enter)"
          >
            {isLoading ? '⟳' : '→'}
          </button>
        </div>
        
        <div className="mt-1.5 text-xs text-stone-500 text-center">
          <kbd className="bg-stone-300 rounded px-1.5 py-0.5 font-mono text-xs">
            Enter
          </kbd>
          {' to send • '}
          <kbd className="bg-stone-300 rounded px-1.5 py-0.5 font-mono text-xs">
            Shift+Enter
          </kbd>
          {' for new line'}
          {remainingQuestions < maxQuestions && (
            <>
              {' • '}
              <span className={questionCount > maxQuestions * 0.8 ? 'text-red-600' : 'text-stone-500'}>
                {remainingQuestions} questions left
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
