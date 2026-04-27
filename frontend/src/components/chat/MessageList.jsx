import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import WelcomeScreen from './WelcomeScreen'

export default function MessageList({
  messages,
  isStreaming,
  hasStarted,
  userName,
  onStart
}) {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming])

  if (!hasStarted) {
    return (
      <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-4.5">
        <WelcomeScreen userName={userName} onStart={onStart} />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-4.5">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-4.5">
        {messages && messages.length > 0 ? (
          messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              message={msg.content}
              isUser={msg.role === 'user'}
              isConclusion={msg.isConclusion}
            />
          ))
        ) : (
          <div className="text-center text-stone-500 p-10 px-5 text-base">
            Start typing to begin your session...
          </div>
        )}

        {isStreaming && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
