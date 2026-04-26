import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { journalService } from '../../services/journal'
import { useAuthStore } from '../../store/authStore'

export default function JournalPage() {
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!userName) {
      navigate('/login')
    } else {
      loadJournals()
    }
  }, [userName, navigate])

  const loadJournals = async () => {
    setLoading(true)
    try {
      const data = await journalService.getJournals()
      setJournals(data.journals || [])
    } catch (err) {
      console.error('Failed to load journals', err)
      setError('Unable to load journals')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newContent.trim()) return

    setIsSubmitting(true)
    try {
      await journalService.createJournal({
        title: newTitle,
        content: newContent,
        is_anonymous: isAnonymous
      })
      setNewTitle('')
      setNewContent('')
      setIsAnonymous(false)
      await loadJournals() // Refresh list
    } catch (err) {
      console.error('Failed to post journal', err)
      alert('Failed to post journal')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream px-6 py-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate('/chat')}
              className="text-sm text-sage-600 hover:text-sage-800 mb-2 flex items-center gap-1"
            >
              ← Back to chat
            </button>
            <h1 className="text-4xl font-display font-semibold text-sage-900 mt-2">
              Public Journal
            </h1>
            <p className="text-sage-600 mt-2 text-lg">
              Share your thoughts and read others' reflections in a safe space.
            </p>
          </div>
        </div>

        {/* Create Journal Form */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-10">
          <h2 className="text-xl font-semibold text-sage-900 mb-4">Write a new entry</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Title (optional)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-slate-50 transition-colors"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <textarea
                placeholder="What's on your mind today?"
                rows="4"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-slate-50 transition-colors resize-none"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-sage-700 select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span className="text-sm font-medium">Post Anonymously</span>
              </label>
              <button
                type="submit"
                disabled={isSubmitting || !newContent.trim()}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#2f7a4e' }}
              >
                {isSubmitting ? 'Posting...' : 'Post Entry'}
              </button>
            </div>
          </form>
        </div>

        {/* Journal Feed */}
        <div className="space-y-6">
          <h2 className="text-2xl font-display font-semibold text-sage-900 mb-6">Recent Entries</h2>
          
          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mb-4"></div>
              <div className="text-sage-600">Loading journals...</div>
            </div>
          ) : error ? (
            <div className="rounded-3xl bg-rose-50 p-8 text-rose-700 shadow-sm text-center">
              {error}
            </div>
          ) : journals.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <p className="text-sage-600">No journals posted yet. Be the first!</p>
            </div>
          ) : (
            journals.map((journal) => (
              <div key={journal.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-sage-300 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-sage-200 text-sage-700 flex items-center justify-center text-lg font-semibold flex-shrink-0">
                    {journal.is_anonymous ? '?' : journal.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sage-900">
                      {journal.author_name}
                    </div>
                    <div className="text-xs text-sage-500">
                      {new Date(journal.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {journal.title && (
                  <h3 className="text-xl font-semibold text-sage-900 mb-2">{journal.title}</h3>
                )}
                <p className="text-sage-800 whitespace-pre-wrap leading-relaxed">
                  {journal.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
