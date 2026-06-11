import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from './store/authStore'
import { authService } from './services/auth'
import LoginPage from './components/auth/LoginPage'
import VerifyEmailPage from './components/auth/VerifyEmailPage'
import ChatPage from './components/chat/ChatPage'
import DashboardPage from './components/dashboard/DashboardPage'
import JournalPage from './components/journal/JournalPage'
import LandingPage from './pages/LandingPage'

import Logo from './components/common/Logo'

export default function App() {
  const { setUser, setAuthenticated, isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authService.getCurrentUser()
        if (response.data?.ok) {
          setUser(response.data.user)
          setAuthenticated(true)
        } else {
          setAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [setUser, setAuthenticated])

  const router = useMemo(() => createBrowserRouter([
    {
      path: "/",
      element: <LandingPage />
    },
    {
      path: "/login",
      element: isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage mode="login" />
    },
    {
      path: "/register",
      element: isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage mode="register" />
    },
    {
      path: "/verify-email",
      element: isAuthenticated ? <Navigate to="/chat" replace /> : <VerifyEmailPage />
    },
    {
      path: "/chat",
      element: isAuthenticated ? <ChatPage /> : <Navigate to="/login" replace />
    },
    {
      path: "/dashboard",
      element: isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />
    },
    {
      path: "/journal",
      element: isAuthenticated ? <JournalPage /> : <Navigate to="/login" replace />
    }
  ]), [isAuthenticated])

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-4">
          <Logo className="w-10 h-10 animate-pulse" />
          <div className="text-lg font-display text-sage-600">Loading...</div>
        </div>
      </div>
    )
  }

  return <RouterProvider router={router} />
}
