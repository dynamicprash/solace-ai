import { useState, useEffect } from 'react'
import { Plus, Trash2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { chatService } from '../../services/chat'
import Logo from '../common/Logo'

export default function Sidebar({ isOpen, onNewChat, onSelectSession, onLogout, onNavigate }) {
  const navigate = useNavigate()
  const { pastSessions, currentSessionId, loadSessions, resetChat } = useChatStore()
  const { userName } = useAuthStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleNewChat = async () => {
    onNewChat()
  }

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout()
    }
  }

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation()
    try {
      await chatService.deleteSession(sessionId)
      if (currentSessionId === sessionId) {
        resetChat()
      }
      await loadSessions()
    } catch (error) {
      console.error('Delete session error:', error)
    }
  }

  const getInitials = (name) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'
  }

  const severityClass = (severity) => {
    if (!severity) return 'bg-emerald-300'
    const value = severity.toLowerCase()
    return value === 'high'
      ? 'bg-red-500'
      : value === 'medium'
        ? 'bg-yellow-400'
        : 'bg-emerald-300'
  }

  return (
    <div className={`h-screen bg-emerald-950 text-white flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? 'w-64 opacity-100 min-w-[16rem]' : 'w-0 opacity-0 min-w-0 pointer-events-none'
      }`}>
      <div className="p-5 pb-4 border-b border-emerald-900">
        <div className="flex items-center gap-2">
          <Logo className="w-5 h-5" />
          <span className="font-display text-xl text-sage-200 font-medium">
            Solace
          </span>
        </div>
      </div>

      <div className="mx-3.5 my-3.5 space-y-3">
        <button
          onClick={handleNewChat}
          className="w-full p-3 bg-emerald-600 text-white rounded-xl text-sm font-body font-medium cursor-pointer flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all border border-emerald-600"
          style={{ backgroundColor: '#2f7a4e' }}
        >
          <Plus className="w-4.5 h-4.5" />
          <span>New Chat</span>
        </button>
        <button
          onClick={() => onNavigate ? onNavigate('/dashboard') : navigate('/dashboard')}
          className="w-full p-3 bg-emerald-600 text-white rounded-xl text-sm font-body font-medium hover:bg-emerald-700 transition-all border border-emerald-600"
          style={{ backgroundColor: '#2f7a4e' }}
        >
          Dashboard
        </button>
        <button
          onClick={() => onNavigate ? onNavigate('/journal') : navigate('/journal')}
          className="w-full p-3 bg-emerald-600 text-white rounded-xl text-sm font-body font-medium hover:bg-emerald-700 transition-all border border-emerald-600"
          style={{ backgroundColor: '#2f7a4e' }}
        >
          Public Journal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {pastSessions && pastSessions.length > 0 ? (
          <>
            <div className="text-xs uppercase tracking-wider text-white/60 px-2.5 py-2 pb-1.5 font-medium">
              Recent Chats
            </div>
            {pastSessions.map((session) => {
              const severity = session.final_severity || session.severity
              return (
                <div
                  key={session.session_id}
                  onClick={() => onSelectSession(session.session_id)}
                  className={`group p-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${currentSessionId === session.session_id
                    ? 'bg-emerald-900/40 border border-emerald-800'
                    : 'hover:bg-emerald-950/40'
                    }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityClass(severity)}`} />
                    <div className="flex-1 text-sm text-white whitespace-nowrap overflow-hidden text-ellipsis">
                      {session.title || 'Untitled Chat'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${severityClass(severity)}`} />
                      <button
                        onClick={(e) => handleDeleteSession(session.session_id, e)}
                        className={`bg-none border-none text-white/25 cursor-pointer rounded hover:text-red-300 transition-colors p-0.5 flex items-center justify-center ${currentSessionId === session.session_id ? 'block' : 'hidden group-hover:block'
                          }`}
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/50 pl-5.5">
                    <span>{new Date(session.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <div className="p-5 px-2.5 text-sm text-white/50 text-center">
            No chats yet
          </div>
        )}
      </div>

      <div className="p-3.5 border-t border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-sage-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
          {getInitials(userName)}
        </div>
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <div className="text-sm font-medium text-white/85 whitespace-nowrap overflow-hidden text-ellipsis">
            {userName}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-none border-none text-white/30 cursor-pointer p-1.5 rounded-lg hover:bg-white/10 hover:text-white/70 transition-all flex items-center justify-center"
          title="Logout"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  )
}
