import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
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
    pastSessions,
  } = useChatStore()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check if user is authenticated
  useEffect(() => {
    if (!userName) {
      navigate('/login')
    }
  }, [userName, navigate])

  const handleNewChat = async () => {
    try {
      setIsLoading(true)
      const response = await api.post('/chat/session')
      useChatStore.setState({
        currentSessionId: response.data.session_id,
        messages: [],
        isStreaming: false,
        isConcluded: false,
        questionCount: 0,
        currentAnalysis: null,
      })
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
      const response = await api.get(`/chat/session/${sessionId}`)
      useChatStore.setState({
        currentSessionId: sessionId,
        messages: response.data.messages || [],
        isStreaming: false,
        isConcluded: response.data.concluded || false,
        questionCount: response.data.question_count || 0,
        currentAnalysis: response.data.analysis || null,
      })
      setHasStarted(true)
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (messageText) => {
    if (!currentSessionId) return

    try {
      // Add user message to store
      useChatStore.setState({
        messages: [...messages, { role: 'user', content: messageText }],
      })

      setIsLoading(true)
      useChatStore.setState({ isStreaming: true })

      // Send message to backend
      const response = await api.post(`/chat/message`, {
        session_id: currentSessionId,
        message: messageText,
      })

      // Update with bot response
      const updatedMessages = [
        ...messages,
        { role: 'user', content: messageText },
      ]

      if (response.data.response) {
        updatedMessages.push({
          role: 'bot',
          content: response.data.response,
        })
      }

      if (response.data.analysis) {
        updatedMessages.push({
          role: 'bot',
          content: response.data.analysis,
          isConclusion: response.data.concluded,
        })
      }

      useChatStore.setState({
        messages: updatedMessages,
        isStreaming: false,
        isConcluded: response.data.concluded || false,
        questionCount: response.data.question_count || questionCount + 1,
        currentAnalysis: response.data.analysis || null,
      })
    } catch (error) {
      console.error('Failed to send message:', error)
      useChatStore.setState({ isStreaming: false })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#f7f4ee',
    }}>
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      {/* Main Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100vh',
      }}>
        {/* Topbar */}
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

        {/* Messages Area */}
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          hasStarted={hasStarted}
          userName={userName}
          onStart={handleNewChat}
        />

        {/* Input Area */}
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
