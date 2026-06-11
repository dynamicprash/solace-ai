import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import WelcomeScreen from './WelcomeScreen'
import Logo from '../common/Logo'

export default function MessageList({
  messages,
  predictions = [],
  isStreaming,
  hasStarted,
  userName,
  onStart,
  isConcluded,
}) {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming, isConcluded])

  if (!hasStarted) {
    return (
      <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-4.5">
        <WelcomeScreen userName={userName} onStart={onStart} />
      </div>
    )
  }

  let userMsgIndex = 0

  return (
    <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-4.5">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-4.5">
        {messages && messages.length > 0 ? (
          messages.map((msg, idx) => {
            let pred = null
            if (msg.role === 'user') {
              pred = predictions?.[userMsgIndex] || null
              userMsgIndex++
            }
            return (
              <MessageBubble
                key={idx}
                message={msg.content}
                isUser={msg.role === 'user'}
                prediction={pred}
              />
            )
          })
        ) : (
          <div className="text-center text-stone-500 p-10 px-5 text-base">
            Start typing to begin your session...
          </div>
        )}

        {isStreaming && <TypingIndicator />}

        {/* Session concluded banner */}
        {isConcluded && (
          <div className="flex items-center justify-center my-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 px-7 text-center max-w-md">
              <div className="flex justify-center mb-2">
                <Logo className="w-8 h-8" />
              </div>
              <p className="font-display font-semibold text-emerald-700 text-sm mb-1">
                Session Concluded
              </p>
              <p className="text-xs text-emerald-600/80 font-body leading-relaxed">
                Thank you for sharing. You can start a new chat whenever you're ready.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

