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
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <WelcomeScreen userName={userName} onStart={onStart} />
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '28px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
    }}>
      <div style={{
        maxWidth: '820px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
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
          <div style={{
            textAlign: 'center',
            color: '#a89f94',
            padding: '40px 20px',
            fontSize: '0.9375rem',
          }}>
            Start typing to begin your session...
          </div>
        )}

        {isStreaming && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
