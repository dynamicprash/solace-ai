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

  async verifyEmail(payload) {
    const response = await apiClient.post('/api/verify-email', payload, {
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },

  async resendCode(payload) {
    const response = await apiClient.post('/api/resend-verification', payload, {
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },

  async checkUsername(username) {
    const response = await apiClient.get(`/api/check-username?username=${encodeURIComponent(username)}`)
    return response.data
  },

  async logout() {
    return apiClient.post('/api/logout')
  },

  async getCurrentUser() {
    return apiClient.get('/api/user')
  },
}
