import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import { chatService } from '../../services/chat'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MessageList from './MessageList'
import InputArea from './InputArea'

export default function ChatPage() {
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  const {
    messages,
    currentSessionId,
    isStreaming,
    isConcluded,
    questionCount,
    currentAnalysis,
    loadSessions,
  } = useChatStore()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!userName) {
      navigate('/login')
    }
  }, [userName, navigate])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleNewChat = async () => {
    try {
      setIsLoading(true)
      const response = await chatService.startNewSession()
      useChatStore.setState({
        currentSessionId: response.session_id,
        messages: [{ role: 'bot', content: response.message }],
        isStreaming: false,
        isConcluded: response.concluded || false,
        questionCount: response.question_count || 0,
        currentAnalysis: null,
      })
      await loadSessions()
      setHasStarted(true)
    } catch (error) {
      console.error('Failed to create session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSession = async (sessionId) => {
    try {
      setIsLoading(true)
      const response = await chatService.getSession(sessionId)
      useChatStore.setState({
        currentSessionId: sessionId,
        messages: response.history || [],
        isStreaming: false,
        isConcluded: response.concluded || false,
        questionCount: response.question_count || 0,
        currentAnalysis: {
          severity: response.final_severity,
          category: response.final_category,
          confidence: null,
        },
      })
      setHasStarted(true)
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setIsLoading(false)
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
          useChatStore.setState({
            currentAnalysis: {
              severity: event.severity,
              category: event.category,
              confidence: event.sev_conf,
            },
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
            isConcluded: event.concluded || false,
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

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar
        isOpen={sidebarOpen}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {hasStarted && (
          <Topbar
            isSidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            severity={currentAnalysis?.severity}
            category={currentAnalysis?.category}
            confidence={currentAnalysis?.confidence}
            onNewChat={handleNewChat}
          />
        )}

        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          hasStarted={hasStarted}
          userName={userName}
          onStart={handleNewChat}
        />

        {hasStarted && (
          <InputArea
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isConcluded={isConcluded}
            questionCount={questionCount}
            maxQuestions={10}
          />
        )}
      </div>
    </div>
  )
}
