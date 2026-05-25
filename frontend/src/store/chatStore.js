import { create } from 'zustand'
import { chatService } from '../services/chat'

export const useChatStore = create((set, get) => ({
  currentSessionId: null,
  messages: [],
  predictions: [],
  isStreaming: false,
  questionCount: 0,
  pastSessions: [],
  currentAnalysis: null,
  isConcluded: false,

  addMessage: (message) => {
    const messages = get().messages
    const newMessages = [...messages, { ...message, id: `msg-${Date.now()}` }]
    set({ messages: newMessages })
  },

  setStreaming: (value) => set({ isStreaming: value }),

  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),

  setPastSessions: (sessions) => set({ pastSessions: sessions }),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  setConcluded: (value) => set({ isConcluded: value }),

  incrementQuestionCount: () => {
    const current = get().questionCount
    set({ questionCount: current + 1 })
  },

  resetChat: () => {
    set({
      messages: [],
      predictions: [],
      isStreaming: false,
      questionCount: 0,
      currentAnalysis: null,
      isConcluded: false,
    })
  },

  loadSessions: async () => {
    try {
      const response = await chatService.getSessionList()
      set({ pastSessions: response || [] })
    } catch (error) {
      console.error('Failed to load sessions', error)
    }
  },

  endSession: async () => {
    const sessionId = get().currentSessionId
    if (!sessionId) return
    try {
      set({ isStreaming: true })
      const response = await chatService.endSession(sessionId)
      if (response.ok && response.message) {
        const messages = get().messages
        set({
          messages: [
            ...messages,
            { id: `msg-end-${Date.now()}`, role: 'assistant', content: response.message }
          ],
          isConcluded: true,
          isStreaming: false,
        })
        await get().loadSessions()
      }
    } catch (error) {
      console.error('Failed to end session', error)
      set({ isStreaming: false })
    }
  },
}))
