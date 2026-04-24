import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './components/auth/LoginPage'
import ChatPage from './components/chat/ChatPage'

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/sessions', {
          credentials: 'include',
          timeout: 5000
        })
        setIsAuthenticated(response.ok)
      } catch (error) {
        console.error('Auth check error:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    // Set timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
        setIsAuthenticated(false)
      }
    }, 6000)

    checkAuth()
    
    return () => clearTimeout(timeout)
  }, [])

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">🌿</div>
          <div className="text-lg font-display text-sage-600">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage mode="login" />} />
        <Route path="/register" element={<LoginPage mode="register" />} />
        <Route
          path="/chat"
          element={isAuthenticated ? <ChatPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/chat' : '/login'} />}
        />
      </Routes>
    </BrowserRouter>
  )
}
