import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatService } from '../../services/chat'
import { useAuthStore } from '../../store/authStore'

import WellbeingPulse from './charts/WellbeingPulse'
import EmotionTideChart from './charts/EmotionTideChart'
import TriggerBubbleChart from './charts/TriggerBubbleChart'
import SeverityJourneyChart from './charts/SeverityJourneyChart'
import CategoryRadarChart from './charts/CategoryRadarChart'
import EngagementHeatmap from './charts/EngagementHeatmap'
import SessionDepthChart from './charts/SessionDepthChart'
import CopingToolkit from './charts/CopingToolkit'

const TABS = [
  { id: 'overview', label: 'Overview', icon: null },
  { id: 'emotions', label: 'Emotions', icon: null },
  { id: 'patterns', label: 'Patterns', icon: null },
  { id: 'toolkit', label: 'Toolkit', icon: null },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [weekly, setWeekly] = useState([])
  const [sessions, setSessions] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

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

  useEffect(() => {
    const loadAnalytics = async () => {
      setAnalyticsLoading(true)
      try {
        const data = await chatService.getDashboardAnalytics()
        setAnalytics(data)
      } catch (err) {
        console.error('Analytics load failed', err)
      } finally {
        setAnalyticsLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  const ChartCard = ({ title, subtitle, children, className = '', noPadding = false }) => (
    <div className={`rounded-3xl bg-white shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold text-sage-900">{title}</h2>
        {subtitle && <p className="text-xs text-sage-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className={noPadding ? '' : 'px-5 pb-5'}>
        {analyticsLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-sage-400" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
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
              Your mental health insights
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
            {/* Stat Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
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

            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 mb-6 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-sage-700 text-white shadow-md'
                      : 'text-sage-600 hover:bg-sage-50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: Overview ─────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Wellbeing Pulse — hero card */}
                  <ChartCard
                    title="Wellbeing Pulse"
                    subtitle="Your composite mental health score"
                  >
                    <WellbeingPulse data={analytics?.wellbeing_pulse} />
                  </ChartCard>

                  {/* Severity Journey */}
                  <ChartCard
                    title="Severity Journey"
                    subtitle="How your mental health severity trends over sessions"
                    className="lg:col-span-2"
                  >
                    <SeverityJourneyChart data={analytics?.severity_journey} />
                  </ChartCard>
                </div>

                {/* Weekly + Severity distribution (existing) */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard title="📅 Weekly Chats" subtitle="Sessions per day this week">
                    <div className="space-y-3">
                      {weekly.map((item) => (
                        <div key={item.day} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-stone-600 min-w-[80px]">
                            {new Date(item.day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-1 bg-sage-100 rounded-full h-2.5">
                              <div
                                className="bg-sage-600 h-2.5 rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(
                                    (item.count / Math.max(...weekly.map((w) => w.count), 1)) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-sage-900 min-w-8 text-center">
                              {item.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>

                  <ChartCard title="Severity Distribution" subtitle="Across all sessions">
                    <div className="space-y-4">
                      {['high', 'medium', 'low', 'unknown'].map((level) => {
                        const count = summary?.severity_counts?.[level] ?? 0
                        const total = summary?.total_sessions || 1
                        const pct = Math.round((count / total) * 100)
                        const colors = {
                          high: '#ef4444',
                          medium: '#eab308',
                          low: '#22c55e',
                          unknown: '#94a3b8',
                        }
                        return (
                          <div key={level}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="capitalize text-stone-600 font-medium">{level}</span>
                              <span className="text-sage-900 font-semibold">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2.5 bg-sage-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: colors[level],
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ChartCard>
                </div>

                {/* Recent sessions */}
                <ChartCard title="Recent Sessions" subtitle="Your latest chat history">
                  <div className="space-y-3">
                    {sessions.length === 0 ? (
                      <div className="text-sm text-stone-500 py-6 text-center">
                        No sessions yet. Start a chat to see your history.
                      </div>
                    ) : (
                      sessions.slice(0, 5).map((session) => (
                        <div
                          key={session.session_id}
                          className="rounded-2xl border border-slate-200 p-4 hover:border-sage-300 transition cursor-pointer"
                          onClick={() => navigate('/chat')}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm text-sage-900 font-semibold">
                                {session.title || 'Untitled chat'}
                              </p>
                              <p className="text-xs text-stone-500 mt-1">
                                {new Date(session.created_at).toLocaleString()} •{' '}
                                {session.question_count} questions
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
                </ChartCard>
              </div>
            )}

            {/* ── Tab: Emotions ─────────────────────────────────── */}
            {activeTab === 'emotions' && (
              <div className="space-y-6">
                <ChartCard
                  title="Emotional Tide"
                  subtitle="How your emotions flow and layer across sessions over time"
                >
                  <EmotionTideChart data={analytics?.emotion_timeline} />
                </ChartCard>

                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard
                    title="Trigger Constellation"
                    subtitle="Your most frequent stress triggers — larger blocks = more mentions"
                  >
                    <TriggerBubbleChart data={analytics?.trigger_frequency} />
                  </ChartCard>

                  <ChartCard
                    title="Category Profile"
                    subtitle="Your mental health radar across detected categories"
                  >
                    <CategoryRadarChart data={analytics?.category_profile} />
                  </ChartCard>
                </div>
              </div>
            )}

            {/* ── Tab: Patterns ─────────────────────────────────── */}
            {activeTab === 'patterns' && (
              <div className="space-y-6">
                <ChartCard
                  title="Engagement Heatmap"
                  subtitle="When do you tend to reach out for support? Patterns by day and hour."
                >
                  <EngagementHeatmap data={analytics?.engagement_heatmap} />
                </ChartCard>

                <ChartCard
                  title="Session Depth"
                  subtitle="How deeply you reflected in each session — based on message length, vocabulary, and completion"
                >
                  <SessionDepthChart data={analytics?.session_depth_scores} />
                </ChartCard>
              </div>
            )}

            {/* ── Tab: Toolkit ──────────────────────────────────── */}
            {activeTab === 'toolkit' && (
              <div className="space-y-6">
                <ChartCard
                  title="Your Coping Toolkit"
                  subtitle="Personalized strategies recommended across your sessions — your living mental health toolkit"
                >
                  <CopingToolkit data={analytics?.coping_strategies} />
                </ChartCard>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
