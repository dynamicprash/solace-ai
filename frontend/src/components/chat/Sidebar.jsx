import { useState, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'

export default function Sidebar({ isOpen, onNewChat, onSelectSession }) {
  const { pastSessions, currentSessionId } = useChatStore()
  const { userName, logout } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const handleNewChat = async () => {
    onNewChat()
  }

  const handleLogout = async () => {
    await logout()
  }

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation()
    try {
      await api.delete(`/chat/session/${sessionId}`)
      // Reload sessions
      const response = await api.get('/chat/sessions')
      useChatStore.setState({ pastSessions: response.data })
    } catch (error) {
      console.error('Delete session error:', error)
    }
  }

  // Get user initials for avatar
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'
  }

  return (
    <div style={{
      width: '260px',
      height: '100vh',
      background: '#1e3121',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.25s, opacity 0.25s',
      opacity: isOpen ? 1 : 0,
      ...(!isOpen && { width: 0, pointerEvents: 'none' })
    }}>
      {/* Logo Header */}
      <div style={{
        padding: '22px 18px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '1.25em' }}>🌿</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            color: '#c5d9c4',
            fontWeight: '500',
          }}>Mindful</span>
        </div>
      </div>

      {/* New Chat Button */}
      <button
        onClick={handleNewChat}
        style={{
          margin: '14px 14px 8px',
          padding: '11px 16px',
          background: 'rgba(255,255,255,0.08)',
          border: '1.5px dashed rgba(255,255,255,0.2)',
          borderRadius: '14px',
          color: '#c5d9c4',
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: 'calc(100% - 28px)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.13)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
        }}
      >
        <span style={{ fontSize: '1.1em' }}>+</span>
        New Chat
      </button>

      {/* Session List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 8px',
      }}>
        {pastSessions && pastSessions.length > 0 ? (
          <>
            <div style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.3)',
              padding: '8px 10px 6px',
              fontWeight: '500',
            }}>
              Recent Chats
            </div>
            {pastSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  background: currentSessionId === session.id ? 'rgba(106,158,105,0.2)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (currentSessionId !== session.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentSessionId !== session.id) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                  <div style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: session.severity === 'high' ? '#c0444a' : session.severity === 'medium' ? '#c9843a' : '#6a9e69',
                    flexShrink: 0,
                  }} />
                  <div style={{
                    flex: 1,
                    fontSize: '0.8125rem',
                    color: 'rgba(255,255,255,0.8)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {session.title || 'Untitled Chat'}
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: currentSessionId === session.id ? 'block' : 'none',
                      padding: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'rgba(255,100,100,0.7)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'rgba(255,255,255,0.2)'
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.6875rem',
                  color: 'rgba(255,255,255,0.3)',
                  paddingLeft: '22px',
                }}>
                  <span>{new Date(session.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div style={{
            padding: '20px 10px',
            fontSize: '0.875rem',
            color: 'rgba(255,255,255,0.3)',
            textAlign: 'center',
          }}>
            No chats yet
          </div>
        )}
      </div>

      {/* User Footer */}
      <div style={{
        padding: '14px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#3a6640',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: '600',
          flexShrink: 0,
        }}>
          {getInitials(userName)}
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: 0,
        }}>
          <div style={{
            fontSize: '0.8125rem',
            fontWeight: '500',
            color: 'rgba(255,255,255,0.85)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {userName}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
          }}
          title="Logout"
        >
          ⎋
        </button>
      </div>
    </div>
  )
}
