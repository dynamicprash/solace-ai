import { create } from 'zustand'
import { authService } from '../services/auth'

export const useAuthStore = create((set) => ({
  userId: null,
  userName: null,
  isLoading: false,
  error: null,

  login: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authService.login(payload)
      if (response.ok || response.redirect === '/chat') {
        set({ isLoading: false })
        window.location.href = '/chat'
      } else {
        set({ error: response.error || 'Login failed', isLoading: false })
      }
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Login failed',
        isLoading: false,
      })
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authService.register(payload)
      if (response.ok || response.redirect === '/chat') {
        set({ isLoading: false })
        window.location.href = '/chat'
      } else {
        set({ error: response.error || 'Registration failed', isLoading: false })
      }
    } catch (error) {
      set({
        error: error.response?.data?.error || 'Registration failed',
        isLoading: false,
      })
    }
  },

  logout: async () => {
    try {
      await authService.logout()
      set({ userId: null, userName: null })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed', error)
    }
  },

  setError: (error) => set({ error }),
}))
