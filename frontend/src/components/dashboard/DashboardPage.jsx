import { useEffect, useState } from 'react'
import { Download, Mail, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
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

import DominantEmotionChart from './charts/DominantEmotionChart'
import WeeklyEmotionTrends from './charts/WeeklyEmotionTrends'
import StressCurveChart from './charts/StressCurveChart'
import EmotionIntensityHeatmap from './charts/EmotionIntensityHeatmap'
import EmotionComparisonCard from './charts/EmotionComparisonCard'
import WellbeingPulseHistory from './charts/WellbeingPulseHistory'

const EMOTION_BADGE_STYLE = {
  anxiety: 'bg-amber-50 text-amber-700 border-amber-100',
  sadness: 'bg-blue-50 text-blue-700 border-blue-100',
  anger: 'bg-rose-50 text-rose-700 border-rose-100',
  guilt: 'bg-pink-50 text-pink-700 border-pink-100',
  love: 'bg-pink-50 text-pink-700 border-pink-100',
  joy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  neutral: 'bg-slate-50 text-slate-700 border-slate-100',
  grief: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  fear: 'bg-violet-50 text-violet-700 border-violet-100',
  shame: 'bg-stone-50 text-stone-700 border-stone-100',
  pride: 'bg-teal-50 text-teal-700 border-teal-100',
  relief: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  surprise: 'bg-orange-50 text-orange-700 border-orange-100',
}

function getEmotionBadgeClass(emotion) {
  if (!emotion) return 'bg-slate-50 text-slate-600 border-slate-100'
  return EMOTION_BADGE_STYLE[emotion.toLowerCase()] || 'bg-sage-50 text-sage-700 border-sage-100'
}

function getSeverityColor(sev) {
  switch (sev?.toLowerCase()) {
    case 'high': return 'bg-rose-500'
    case 'medium': return 'bg-amber-500'
    case 'low': return 'bg-emerald-500'
    default: return 'bg-slate-400'
  }
}

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
  const [exporting, setExporting] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await chatService.exportAnalyticsCSV()
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `solace_ai_wellness_report_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      showToast('CSV downloaded successfully', 'success')
    } catch (err) {
      console.error('Export failed', err)
      showToast(err.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleEmailReport = async () => {
    setEmailing(true)
    try {
      const resp = await chatService.emailReport()
      showToast(resp.message || 'Report sent to your email!', 'success')
    } catch (err) {
      console.error('Email report failed', err)
      const msg = err.response?.data?.error || err.message || 'Failed to email report'
      showToast(msg, 'error')
    } finally {
      setEmailing(false)
    }
  }

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
    <div className="min-h-screen bg-cream px-4 sm:px-6 py-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl border text-sm font-medium shadow-lg animate-fadeUp flex items-center gap-2 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span className="flex items-center">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-white text-sage-700 border border-sage-200 rounded-xl text-sm font-medium hover:bg-sage-50 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {exporting ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-sage-600 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-sage-600" />
              )}
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleEmailReport}
              disabled={emailing}
              className="px-4 py-2 bg-white text-sage-700 border border-sage-200 rounded-xl text-sm font-medium hover:bg-sage-50 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {emailing ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-sage-600 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 text-sage-600" />
              )}
              <span>Email Report</span>
            </button>
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
                     <WellbeingPulseHistory sessions={sessions} />
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

                {/* Weekly Emotion Trends & Comparison */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <ChartCard
                    title="Weekly Emotion Trends"
                    subtitle="How your emotions trend week-over-week"
                    className="lg:col-span-2"
                  >
                    <WeeklyEmotionTrends data={analytics?.weekly_emotion_trends} />
                  </ChartCard>
                  <ChartCard
                    title="Weekly Comparison"
                    subtitle="Changes in your emotional patterns"
                    className="lg:col-span-1"
                  >
                    <EmotionComparisonCard data={analytics?.weekly_emotion_trends} />
                  </ChartCard>
                </div>

                {/* Weekly + Severity distribution */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard 
                    title={
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4.5 h-4.5 text-sage-600" />
                        <span>Weekly Chats</span>
                      </span>
                    } 
                    subtitle="Sessions per day this week"
                  >
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
                          className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-sage-300 transition cursor-pointer hover:shadow-sm"
                          onClick={() => navigate('/chat')}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-3 h-3 rounded-full flex-shrink-0 ${getSeverityColor(session.final_severity)}`}
                                title={`Severity: ${session.final_severity || 'Unknown'}`}
                              />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm text-sage-900 font-semibold">
                                    {session.title || 'Untitled chat'}
                                  </p>
                                  {session.final_category && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getEmotionBadgeClass(session.final_category)}`}>
                                      {session.final_category}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-500 mt-1">
                                  {new Date(session.created_at).toLocaleString()} •{' '}
                                  {session.question_count} questions
                                </p>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <span className={`px-2.5 py-1 rounded-full font-semibold ${session.concluded ? 'bg-sage-100 text-sage-800' : 'bg-amber-100 text-amber-800'}`}>
                                {session.concluded ? 'Completed' : 'Open'}
                              </span>
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

                <div className="grid gap-6 lg:grid-cols-3">
                  <ChartCard
                    title="Dominant Emotions"
                    subtitle="Distribution of primary emotions across all sessions"
                    className="lg:col-span-1"
                  >
                    <DominantEmotionChart data={analytics?.dominant_distribution} />
                  </ChartCard>
                  <ChartCard
                    title="Stress Curve"
                    subtitle="Distress level and composite index trends"
                    className="lg:col-span-2"
                  >
                    <StressCurveChart data={analytics?.stress_curve} />
                  </ChartCard>
                </div>

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
                  title="Emotion Intensity Heatmap"
                  subtitle="Average distress intensity patterns by day of week and hour of day"
                >
                  <EmotionIntensityHeatmap data={analytics?.emotion_intensity_heatmap} />
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
