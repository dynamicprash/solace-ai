import axios from 'axios'

export const journalService = {
  getJournals: async (limit = 50, offset = 0) => {
    const response = await axios.get(`/api/journals?limit=${limit}&offset=${offset}`, {
      withCredentials: true,
    })
    return response.data
  },

  createJournal: async (payload) => {
    // payload: { title, content, is_anonymous }
    const response = await axios.post('/api/journals', payload, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    })
    return response.data
  },
}
