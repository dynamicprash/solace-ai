import apiClient from './api'

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_URL || ''

const parseSseChunk = (chunk) => {
  const dataLines = chunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))

  return dataLines
    .map((raw) => {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export const chatService = {
  async startNewSession() {
    const response = await apiClient.post('/api/start')
    return response.data
  },

  async getSessionList() {
    const response = await apiClient.get('/api/history')
    return response.data.sessions || []
  },

  async getSession(sessionId) {
    const response = await apiClient.get(`/api/session/${sessionId}`)
    return response.data
  },

  async deleteSession(sessionId) {
    const response = await apiClient.delete(`/api/session/${sessionId}`)
    return response.data
  },

  async sendMessage(sessionId, message, onEvent) {
    const response = await fetch(`${API_BASE_URL}/api/message`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId, message }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || 'Failed to send message')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()

      for (const part of parts) {
        const events = parseSseChunk(part)
        events.forEach((event) => onEvent(event))
      }
    }

    if (buffer.trim()) {
      const events = parseSseChunk(buffer)
      events.forEach((event) => onEvent(event))
    }
  },

  async getDashboardWeekly() {
    const response = await apiClient.get('/api/dashboard/weekly')
    return response.data
  },
}
