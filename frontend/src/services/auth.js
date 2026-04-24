import apiClient from './api'

export const authService = {
  async login(payload) {
    const response = await apiClient.post('/login', payload, {
      headers: { 'Content-Type': 'application/json' }
    })
    return response.data
  },

  async register(payload) {
    const response = await apiClient.post('/register', payload, {
      headers: { 'Content-Type': 'application/json' }
    })
    return response.data
  },

  async logout() {
    return apiClient.post('/logout')
  },

  async getCurrentUser() {
    return apiClient.get('/api/user')
  },
}
