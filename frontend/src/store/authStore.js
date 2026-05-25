import { create } from 'zustand'
import { authService } from '../services/auth'

export const useAuthStore = create((set) => ({
  userId: null,
  userName: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authService.login(payload)
      if (response.ok) {
        set({
          isLoading: false,
          isAuthenticated: true,
          userId: response.user?.id || null,
          userName: response.user?.name || null,
        })
        window.location.href = '/chat'
        return { success: true }
      } else {
        set({ error: response.error || 'Login failed', isLoading: false })
        return { success: false }
      }
    } catch (error) {
      if (error.response?.data?.verification_required) {
        set({ isLoading: false })
        return {
          verificationRequired: true,
          username: error.response.data.username,
          email: error.response.data.email,
        }
      }
      set({
        error: error.response?.data?.error || 'Login failed',
        isLoading: false,
      })
      return { success: false }
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authService.register(payload)
      if (response.ok) {
        if (response.verification_required) {
          set({ isLoading: false })
          return {
            verificationRequired: true,
            username: response.username,
            email: response.email,
          }
        }
        set({
          isLoading: false,
          isAuthenticated: true,
          userId: response.user?.id || null,
          userName: response.user?.name || null,
        })
        window.location.href = '/chat'
        return { success: true }
      } else {
        set({ error: response.error || 'Registration failed', isLoading: false })
        return { success: false }
      }
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Registration failed',
        isLoading: false,
      })
      return { success: false }
    }
  },

  verifyEmail: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authService.verifyEmail(payload)
      if (response.ok) {
        set({
          isLoading: false,
          isAuthenticated: true,
          userId: response.user?.id || null,
          userName: response.user?.name || null,
        })
        window.location.href = '/chat'
        return { success: true }
      } else {
        set({ error: response.error || 'Verification failed', isLoading: false })
        return { success: false }
      }
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Verification failed',
        isLoading: false,
      })
      return { success: false }
    }
  },

  resendCode: async (payload) => {
    try {
      const response = await authService.resendCode(payload)
      return { success: response.ok, message: response.message }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to resend code',
      }
    }
  },

  logout: async () => {
    try {
      await authService.logout()
      set({ userId: null, userName: null, isAuthenticated: false })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed', error)
    }
  },

  setUser: (user) => set({ userId: user.id, userName: user.name, isAuthenticated: true }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setError: (error) => set({ error }),
}))
