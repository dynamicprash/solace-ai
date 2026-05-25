import { useState, useEffect } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { chatService } from '../../services/chat'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MessageList from './MessageList'
import InputArea from './InputArea'

export default function ChatPage() {
  const navigate = useNavigate()
  const { userName, logout } = useAuthStore()
  const {
    messages,
    predictions,
    currentSessionId,
    isStreaming,
    questionCount,
    currentAnalysis,
    isConcluded,
    loadSessions,
    endSession,
    setConcluded,
  } = useChatStore()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [exitConfirm, setExitConfirm] = useState(null)

  // Block React Router navigation if session is active
  const blocker = useBlocker(
    ({ currentValue, nextLocation }) =>
      currentSessionId && !isConcluded && currentValue.location.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setExitConfirm({
        onProceed: async () => {
          setIsLoading(true)
          try {
            await handleEndSession()
          } catch (e) {
            console.error(e)
          } finally {
            setIsLoading(false)
            blocker.proceed()
            setExitConfirm(null)
          }
        },
        onCancel: () => {
          blocker.reset()
          setExitConfirm(null)
        }
      })
    }
  }, [blocker.state])

  // Handle closing website or reloading
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentSessionId && !isConcluded) {
        e.preventDefault()
        e.returnValue = 'do you like to end the current session before exiting or continue with the chat'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentSessionId, isConcluded])

  useEffect(() => {
    if (!userName) {
      navigate('/login')
    }
  }, [userName, navigate])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const performNewChat = async () => {
    try {
      setIsLoading(true)
      const response = await chatService.startNewSession()
      useChatStore.setState({
        currentSessionId: response.session_id,
        messages: [{ role: 'bot', content: response.message }],
        predictions: [],
        isStreaming: false,
        questionCount: response.question_count || 0,
        currentAnalysis: null,
        isConcluded: false,
      })
      await loadSessions()
      setHasStarted(true)
    } catch (error) {
      console.error('Failed to create session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewChat = async () => {
    if (currentSessionId && !isConcluded) {
      setExitConfirm({
        onProceed: async () => {
          setIsLoading(true)
          try {
            await handleEndSession()
            await performNewChat()
          } catch (error) {
            console.error(error)
          } finally {
            setIsLoading(false)
            setExitConfirm(null)
          }
        },
        onCancel: () => {
          setExitConfirm(null)
        }
      })
    } else {
      await performNewChat()
    }
  }

  const performSelectSession = async (sessionId) => {
    try {
      setIsLoading(true)
      const response = await chatService.getSession(sessionId)
      const sessionHistory = response.history || []
      useChatStore.setState({
        currentSessionId: sessionId,
        messages: sessionHistory,
        predictions: response.predictions || [],
        isStreaming: false,
        questionCount: response.question_count || 0,
        currentAnalysis: response.final_emotion ? {
          emotions: [response.final_emotion],
          primaryEmotion: response.final_emotion,
          confidences: {},
        } : null,
        isConcluded: response.concluded || false,
      })
      setHasStarted(true)
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSession = async (sessionId) => {
    if (currentSessionId && !isConcluded && currentSessionId !== sessionId) {
      setExitConfirm({
        onProceed: async () => {
          setIsLoading(true)
          try {
            await handleEndSession()
            await performSelectSession(sessionId)
          } catch (error) {
            console.error(error)
          } finally {
            setIsLoading(false)
            setExitConfirm(null)
          }
        },
        onCancel: () => {
          setExitConfirm(null)
        }
      })
    } else {
      await performSelectSession(sessionId)
    }
  }

  const handleSendMessage = async (messageText) => {
    if (!currentSessionId || !messageText.trim()) return

    const userMessage = { role: 'user', content: messageText }
    const botPlaceholder = { role: 'bot', content: '' }

    useChatStore.setState({
      messages: [...messages, userMessage, botPlaceholder],
      isStreaming: true,
    })
    setIsLoading(true)

    try {
      await chatService.sendMessage(currentSessionId, messageText, (event) => {
        if (event.type === 'analysis') {
          const currentPreds = useChatStore.getState().predictions || []
          const newPred = {
            emotions: event.emotions || [],
            primary_emotion: event.primary_emotion,
            emo_conf: event.emo_conf || 0.5,
            confidences: event.confidences || {},
          }
          useChatStore.setState({
            currentAnalysis: {
              emotions: event.emotions || [],
              primaryEmotion: event.primary_emotion,
              confidences: event.confidences || {},
            },
            predictions: [...currentPreds, newPred],
            questionCount: event.question_count,
          })
          return
        }

        if (event.type === 'token') {
          const currentMessages = useChatStore.getState().messages
          const lastMessage = currentMessages[currentMessages.length - 1]
          if (!lastMessage || lastMessage.role !== 'bot') return
          const updated = [
            ...currentMessages.slice(0, -1),
            { ...lastMessage, content: `${lastMessage.content}${event.content}` },
          ]
          useChatStore.setState({ messages: updated })
          return
        }

        if (event.type === 'done') {
          useChatStore.setState({
            isStreaming: false,
            questionCount: event.question_count || questionCount,
          })
          return
        }

        if (event.type === 'error') {
          useChatStore.setState({ isStreaming: false })
          console.error('Chat error:', event.message)
          return
        }
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      useChatStore.setState({ isStreaming: false })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async () => {
    await endSession()
  }

  const handleLogoutConfirm = async () => {
    if (currentSessionId && !isConcluded) {
      setExitConfirm({
        onProceed: async () => {
          setIsLoading(true)
          try {
            await handleEndSession()
            await logout()
          } catch (error) {
            console.error(error)
          } finally {
            setIsLoading(false)
            setExitConfirm(null)
          }
        },
        onCancel: () => {
          setExitConfirm(null)
        }
      })
    } else {
      await logout()
    }
  }

  const handleNavigateConfirm = (path) => {
    if (currentSessionId && !isConcluded) {
      setExitConfirm({
        onProceed: async () => {
          setIsLoading(true)
          try {
            await handleEndSession()
            navigate(path)
          } catch (error) {
            console.error(error)
          } finally {
            setIsLoading(false)
            setExitConfirm(null)
          }
        },
        onCancel: () => {
          setExitConfirm(null)
        }
      })
    } else {
      navigate(path)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar
        isOpen={sidebarOpen}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onLogout={handleLogoutConfirm}
        onNavigate={handleNavigateConfirm}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {hasStarted && (
          <Topbar
            isSidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            emotions={currentAnalysis?.emotions}
            primaryEmotion={currentAnalysis?.primaryEmotion}
            confidences={currentAnalysis?.confidences}
            onNewChat={handleNewChat}
            onEndSession={handleEndSession}
            isConcluded={isConcluded}
            hasActiveSession={!!currentSessionId}
          />
        )}

        <MessageList
          messages={messages}
          predictions={predictions}
          isStreaming={isStreaming}
          hasStarted={hasStarted}
          userName={userName}
          onStart={handleNewChat}
          isConcluded={isConcluded}
        />

        {hasStarted && !isConcluded && (
          <InputArea
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        )}
      </div>

      {exitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-[90%] border border-stone-200 shadow-xl animate-scaleUp">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🌿</span>
              <h3 className="text-lg font-display font-semibold text-sage-950">Active Session</h3>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed mb-6">
              do you like to end the current session before exiting or continue with the chat
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={exitConfirm.onCancel}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-600 bg-white hover:bg-stone-50 transition cursor-pointer"
              >
                Continue Chatting
              </button>
              <button
                onClick={exitConfirm.onProceed}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-sage-600 hover:bg-sage-700 transition border-none cursor-pointer shadow-sm"
              >
                End Session & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
