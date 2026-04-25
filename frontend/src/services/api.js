import axios from 'axios'

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_URL || ''

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Let the app handle 401s explicitly, especially the auth check at startup.
    return Promise.reject(error)
  }
)

export default apiClient
