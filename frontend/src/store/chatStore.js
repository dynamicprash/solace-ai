import { create } from 'zustand'
import { chatService } from '../services/chat'

export const useChatStore = create((set, get) => ({
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  isConcluded: false,
  questionCount: 0,
  pastSessions: [],
  currentAnalysis: null,

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
      isStreaming: false,
      isConcluded: false,
      questionCount: 0,
      currentAnalysis: null,
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
}))
