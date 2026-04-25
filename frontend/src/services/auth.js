import apiClient from './api'

export const authService = {
  async login(payload) {
    const response = await apiClient.post('/api/login', payload, {
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },

  async register(payload) {
    const response = await apiClient.post('/api/register', payload, {
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },

  async logout() {
    return apiClient.post('/api/logout')
  },

  async getCurrentUser() {
    return apiClient.get('/api/user')
  },
}
