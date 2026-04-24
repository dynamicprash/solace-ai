import apiClient from './api'

export const chatService = {
  async startNewSession() {
    const response = await apiClient.post('/api/chat/start')
    return response.data
  },

  async getSessionList() {
    const response = await apiClient.get('/api/sessions')
    return response.data
  },

  async getSession(sessionId) {
    const response = await apiClient.get(`/api/sessions/${sessionId}`)
    return response.data
  },

  async deleteSession(sessionId) {
    return apiClient.delete(`/api/sessions/${sessionId}`)
  },

  async sendMessage(sessionId, message) {
    return `/api/chat/stream?session_id=${sessionId}&message=${encodeURIComponent(message)}`
  },

  async getDashboardWeekly() {
    const response = await apiClient.get('/api/dashboard/weekly')
    return response.data
  },
}
