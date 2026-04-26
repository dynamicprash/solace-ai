import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatService } from '../../services/chat'
import { useAuthStore } from '../../store/authStore'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [weekly, setWeekly] = useState([])
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (!userName) {
      navigate('/login')
    }
  }, [userName, navigate])

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)
      try {
        const data = await chatService.getDashboardWeekly()
        setSummary(data.summary)
        setWeekly(data.weekly || [])
        setSessions(data.sessions || [])
      } catch (err) {
        console.error('Dashboard load failed', err)
        setError(err.message || 'Unable to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  return (
    <div className="min-h-screen bg-cream px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => navigate('/chat')}
              className="text-sm text-sage-600 hover:text-sage-800 mb-2 flex items-center gap-1"
            >
              ← Back to chat
            </button>
            <p className="text-sm uppercase tracking-[0.3em] text-sage-800/70">
              Dashboard
            </p>
            <h1 className="text-3xl font-display font-semibold text-sage-900 mt-2">
              Your chat insights
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/journal')}
              className="px-4 py-2 bg-white text-sage-700 border border-sage-200 rounded-xl text-sm font-medium hover:bg-sage-50 transition"
            >
              Public Journal
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="px-4 py-2 bg-sage-700 text-white rounded-xl text-sm font-medium hover:bg-sage-800 transition"
            >
              Open Chat
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sage-900 shadow-sm">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mb-4"></div>
            <div>Loading your dashboard...</div>
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 p-8 text-rose-700 shadow-sm">
            {error}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <p className="text-sm text-sage-500">Total chats</p>
                <p className="text-3xl font-semibold text-sage-900 mt-3">
                  {summary?.total_sessions ?? 0}
                </p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <p className="text-sm text-sage-500">Concluded</p>
                <p className="text-3xl font-semibold text-sage-900 mt-3">
                  {summary?.concluded_sessions ?? 0}
                </p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <p className="text-sm text-sage-500">Active chats</p>
                <p className="text-3xl font-semibold text-sage-900 mt-3">
                  {summary?.active_sessions ?? 0}
                </p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <p className="text-sm text-sage-500">High severity</p>
                <p className="text-3xl font-semibold text-sage-900 mt-3">
                  {summary?.severity_counts?.high ?? 0}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 mb-6">
              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-sage-900">Weekly chats</h2>
                </div>
                <div className="space-y-3">
                  {weekly.map((item) => (
                    <div key={item.day} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-stone-600">{new Date(item.day).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-sage-100 rounded-full h-2">
                          <div
                            className="bg-sage-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((item.count / Math.max(...weekly.map(w => w.count))) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-sage-900 min-w-8 text-center">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-sage-900">Severity distribution</h2>
                </div>
                <div className="space-y-3">
                  {['high', 'medium', 'low', 'unknown'].map((level) => (
                    <div key={level} className="flex items-center justify-between gap-3">
                      <span className="text-sm capitalize text-stone-600">{level}</span>
                      <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-sage-900">
                        {summary?.severity_counts?.[level] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-sage-900">Recent sessions</h2>
                <button
                  onClick={() => navigate('/chat')}
                  className="text-sm text-sage-700 hover:text-sage-900"
                >
                  New chat
                </button>
              </div>

              <div className="space-y-3">
                {sessions.length === 0 ? (
                  <div className="text-sm text-stone-500 py-6 text-center">
                    No sessions yet. Start a chat to see your history.
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.session_id}
                      className="rounded-3xl border border-slate-200 p-4 hover:border-sage-300 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-sage-900 font-semibold">
                            {session.title || 'Untitled chat'}
                          </p>
                          <p className="text-xs text-stone-500 mt-1">
                            {new Date(session.created_at).toLocaleString()} • {session.question_count} questions
                          </p>
                        </div>
                        <div className="text-right text-xs text-stone-500">
                          <div>{session.concluded ? 'Completed' : 'Open'}</div>
                          <div className="mt-1 capitalize">
                            {session.final_severity || 'No severity'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
