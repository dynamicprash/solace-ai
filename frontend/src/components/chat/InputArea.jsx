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
      <div style={{
        padding: '16px 24px 20px',
        background: '#fdfcf9',
        borderTop: '1px solid #e4e0d8',
        flexShrink: 0,
      }}>
        <div style={{
          maxWidth: '820px',
          margin: '0 auto',
          textAlign: 'center',
          color: '#958c7a',
          fontSize: '0.9rem',
          padding: '14px',
        }}>
          <strong>Session Concluded</strong>
          <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>
            Thank you for sharing. You can start a new chat or review your previous conversations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: '16px 24px 20px',
      background: '#fdfcf9',
      borderTop: '1px solid #e4e0d8',
      flexShrink: 0,
    }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
          background: '#f7f4ee',
          border: '1.5px solid #cdc8bc',
          borderRadius: '22px',
          padding: '10px 10px 10px 18px',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={(e) => {
          if (!e.currentTarget.contains(document.activeElement)) return
          e.currentTarget.style.borderColor = '#6a9e69'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(106, 158, 105, 0.1)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#cdc8bc'
          e.currentTarget.style.boxShadow = 'none'
        }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share your thoughts..."
            disabled={isLoading}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              color: '#4a4238',
              outline: 'none',
              resize: 'none',
              maxHeight: '140px',
              overflowY: 'auto',
              lineHeight: '1.6',
              minHeight: '24px',
              opacity: isLoading ? 0.6 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !message.trim()}
            style={{
              width: '38px',
              height: '38px',
              background: '#3a6640',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              fontSize: '1.1rem',
              cursor: isLoading || !message.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
              opacity: isLoading || !message.trim() ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading && message.trim()) {
                e.currentTarget.style.background = '#2e5133'
                e.currentTarget.style.transform = 'scale(1.05)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#3a6640'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            title="Send message (Enter)"
          >
            {isLoading ? '⟳' : '→'}
          </button>
        </div>
        
        <div style={{
          marginTop: '7px',
          fontSize: '0.71875rem',
          color: '#a89f94',
          textAlign: 'center',
        }}>
          <kbd style={{
            background: '#e4e0d8',
            borderRadius: '3px',
            padding: '1px 5px',
            fontFamily: 'monospace',
            fontSize: '0.6875rem',
          }}>
            Enter
          </kbd>
          {' to send • '}
          <kbd style={{
            background: '#e4e0d8',
            borderRadius: '3px',
            padding: '1px 5px',
            fontFamily: 'monospace',
            fontSize: '0.6875rem',
          }}>
            Shift+Enter
          </kbd>
          {' for new line'}
          {remainingQuestions < maxQuestions && (
            <>
              {' • '}
              <span style={{ color: questionCount > maxQuestions * 0.8 ? '#c0444a' : '#a89f94' }}>
                {remainingQuestions} questions left
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
