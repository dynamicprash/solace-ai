import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  Clock, BarChart3, ShieldCheck, ChevronDown,
  TrendingUp, Sparkles,
  Globe, ExternalLink, Send, Menu, X,
} from 'lucide-react'

/* ─── Mock data for the mini "Weekly Progress" chart ─── */
const MOCK_CHART_DATA = [
  { day: 'Mon', score: 42 },
  { day: 'Tue', score: 55 },
  { day: 'Wed', score: 48 },
  { day: 'Thu', score: 62 },
  { day: 'Fri', score: 58 },
  { day: 'Sat', score: 72 },
  { day: 'Sun', score: 68 },
]

/* ─── FAQ data ─── */
const FAQS = [
  {
    q: 'Is Solace AI a replacement for therapy?',
    a: 'No. Solace AI is a supportive tool, not a substitute for professional mental health care. If you are in crisis, please reach out to a qualified professional or call your local helpline.',
  },
  {
    q: 'How is my data kept private?',
    a: 'Your conversations are stored securely with end-to-end encryption. We use anonymous user profiles and never share your personal data with third parties.',
  },
  {
    q: 'Can I use Solace AI for free?',
    a: 'Yes! Solace AI offers a free tier that includes unlimited chat sessions, mood tracking, and access to your personal analytics dashboard.',
  },
  {
    q: 'Who can use Solace AI?',
    a: 'Anyone looking for a calm, supportive space to reflect on their emotions. Solace AI is designed for general wellbeing and is not intended to diagnose or treat clinical conditions.',
  },
]

/* ═══════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [mobileMenu, setMobileMenu] = useState(false)

  /* Smooth‑scroll to an anchor */
  const scrollTo = (id) => {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-cream font-body text-stone-800 overflow-x-hidden">
      {/* ═══ NAVBAR ════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-lg border-b border-stone-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <button onClick={() => scrollTo('hero')} className="flex items-center gap-2 cursor-pointer bg-transparent border-none p-0">
            <span className="text-2xl">🌿</span>
            <span className="font-display text-xl text-sage-700 font-semibold tracking-tight">Solace AI.</span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <button onClick={() => scrollTo('hero')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-stone-600">Home</button>
            <button onClick={() => scrollTo('features')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-stone-600">Features</button>
            <button onClick={() => scrollTo('about')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-stone-600">About</button>
            <button onClick={() => scrollTo('contact')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-stone-600">Contact</button>
            <button onClick={() => scrollTo('faqs')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm font-medium text-stone-600">FAQs</button>
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2 rounded-xl text-sm font-medium border border-stone-300 text-sage-700 bg-white hover:bg-sage-50 transition cursor-pointer"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/chat')}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-sage-600 hover:bg-sage-700 transition border-none cursor-pointer"
                >
                  Open Chat
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2 rounded-xl text-sm font-medium border border-stone-300 text-sage-700 bg-white hover:bg-sage-50 transition cursor-pointer"
                >
                  Log In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-sage-600 hover:bg-sage-700 transition border-none cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden bg-transparent border-none cursor-pointer text-stone-700 p-1"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle menu"
          >
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-stone-200 px-6 py-4 space-y-3 animate-fadeIn">
            {['hero:Home', 'features:Features', 'about:About', 'contact:Contact', 'faqs:FAQs'].map((item) => {
              const [id, label] = item.split(':')
              return (
                <button key={id} onClick={() => scrollTo(id)} className="block w-full text-left text-sm font-medium text-stone-600 hover:text-sage-700 bg-transparent border-none cursor-pointer p-2 rounded-lg hover:bg-sage-50 transition">
                  {label}
                </button>
              )
            })}
            <div className="flex gap-2 pt-2">
              {isAuthenticated ? (
                <>
                  <button onClick={() => navigate('/dashboard')} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-300 text-sage-700 bg-white cursor-pointer">Dashboard</button>
                  <button onClick={() => navigate('/chat')} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-sage-600 border-none cursor-pointer">Open Chat</button>
                </>
              ) : (
                <>
                  <button onClick={() => navigate('/login')} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-300 text-sage-700 bg-white cursor-pointer">Log In</button>
                  <button onClick={() => navigate('/register')} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-sage-600 border-none cursor-pointer">Sign Up</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO ══════════════════════════════════════ */}
      <section id="hero" className="relative py-20 md:py-28 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-sage-300/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-stone-300/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left copy */}
          <div className="animate-fadeUp">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-sage-100 text-sage-700 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="text-sm">🌿</span> Your Private Mental Health Companion
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-sage-900 leading-tight mb-6">
              Your Safe Space<br />
              To <span className="text-sage-500">Heal</span> and <span className="text-sage-500">Reflect.</span>
            </h1>
            <p className="text-stone-500 text-lg leading-relaxed mb-8 max-w-lg">
              Experience a judgmental-free zone where you can express your thoughts,
              track your emotional journey, and find peace with our specialized
              mental health AI. Available 24/7 whenever you need a listening ear.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(isAuthenticated ? '/chat' : '/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white bg-sage-600 hover:bg-sage-700 text-sm font-semibold transition-all shadow-md hover:shadow-lg cursor-pointer border-none"
              >
                Start Chatting <Send size={16} />
              </button>
              <button
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sage-700 bg-white border border-stone-300 hover:bg-sage-50 text-sm font-semibold transition cursor-pointer"
              >
                Track Your Mood <BarChart3 size={16} />
              </button>
            </div>
          </div>

          {/* Right — Chat mockup */}
          <div className="hidden md:block animate-fadeUp" style={{ animationDelay: '0.15s' }}>
            <ChatMockup />
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═════════════════════════════════ */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <SectionTag>Our Features</SectionTag>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-sage-900 mb-3">
            Designed For Your Wellbeing
          </h2>
          <p className="text-stone-500 max-w-xl mx-auto mb-14 text-base">
            Our AI provides a secure and supportive environment to help you manage your mental health every day with clinically-informed techniques.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Clock size={22} className="text-sage-600" />}
              title="24/7 Availability"
              description="Instant support whenever you need it. Whether it's 3 PM or 3 AM, our AI is always ready to listen and help you process your emotions."
            />
            <FeatureCard
              icon={<TrendingUp size={22} className="text-sage-600" />}
              title="Mood Analytics"
              description="Identify patterns in your emotional state with visual insights. See how your mood evolves over weeks and months to better understand your triggers."
            />
            <FeatureCard
              icon={<ShieldCheck size={22} className="text-sage-600" />}
              title="Private & Secure"
              description="Your conversations are your own. We use end-to-end encryption and anonymous profiles to ensure your personal reflections stay private."
            />
          </div>
        </div>
      </section>

      {/* ═══ ABOUT / ANALYTICS SHOWCASE ═══════════════ */}
      <section id="about" className="py-20 px-6 bg-sage-100/30">
        <div className="max-w-6xl mx-auto">
          <SectionTag>What Is Solace AI</SectionTag>
          <div className="grid md:grid-cols-2 gap-12 items-center mt-8">
            {/* Left — Mini chart card */}
            <div className="bg-white rounded-3xl shadow-card p-6 border border-stone-200 animate-fadeUp">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-stone-400 font-semibold">Your Weekly Progress</p>
                  <p className="text-lg font-display font-bold text-sage-900 mt-1">Calm & Balanced</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">+12% improvement</span>
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={MOCK_CHART_DATA} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6a9e69" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6a9e69" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d8" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#958c7a' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[30, 80]} tick={{ fontSize: 11, fill: '#958c7a' }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="score" stroke="#4d8050" strokeWidth={2.5} fill="url(#chartGrad)" dot={{ r: 3, fill: '#4d8050', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right — Copy */}
            <div className="animate-fadeUp" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-sage-900 leading-tight mb-5">
                Visualize Your Journey to Better Health
              </h2>
              <p className="text-stone-500 leading-relaxed mb-6">
                Solace AI is a web-based platform designed to provide users with a calm and supportive
                digital space focused on wellbeing and self-care. It offers simple and accessible tools
                that help users track their emotions, manage stress, and improve their overall mental
                wellness through an intuitive and user-friendly interface.
              </p>
              <ul className="space-y-3">
                {[
                  'Personalized daily reflection prompts',
                  'AI-powered trend identification & severity analysis',
                  'Interactive analytics dashboard with 8 chart types',
                  'Public journaling for community support',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-stone-600">
                    <span className="mt-0.5 text-sage-500 flex-shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ══════════════════════════════════ */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionTag>Get In Touch</SectionTag>
          <div className="mt-8 bg-white rounded-3xl shadow-card border border-stone-200 p-8 md:p-12 max-w-2xl mx-auto animate-fadeUp">
            <h2 className="text-2xl font-display font-bold text-sage-900 mb-6">Contact Details</h2>
            <div className="space-y-3 text-sm text-stone-600">
              <p><span className="font-semibold text-sage-700">Email:</span> support@solace.com</p>
              <p><span className="font-semibold text-sage-700">Phone:</span> +01-1234567</p>
              <p><span className="font-semibold text-sage-700">Address:</span> Nayabazar-16, Kathmandu, Nepal</p>
            </div>
            <div className="flex gap-3 mt-6">
              <SocialIcon><Globe size={18} /></SocialIcon>
              <SocialIcon><ExternalLink size={18} /></SocialIcon>
            </div>
            <p className="text-xs text-stone-400 mt-6">We're Here to Support You</p>
          </div>
        </div>
      </section>

      {/* ═══ CTA BANNER ═══════════════════════════════ */}
      <section className="px-6 py-10">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-sage-600 to-sage-700 rounded-3xl text-center py-14 px-8 shadow-xl">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Start Your Journey Today
          </h2>
          <p className="text-sage-200 max-w-lg mx-auto mb-8">
            Join thousands of others who use Solace AI as their primary support system.
            It's free to get started and completely anonymous.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate(isAuthenticated ? '/chat' : '/register')}
              className="px-7 py-3 rounded-xl text-sage-700 bg-white font-semibold text-sm hover:bg-sage-50 transition border-none cursor-pointer shadow-md"
            >
              Start Your First Chat
            </button>
            <button
              onClick={() => scrollTo('features')}
              className="px-7 py-3 rounded-xl text-white bg-sage-800 font-semibold text-sm hover:bg-sage-900 transition border-none cursor-pointer"
            >
              Explore Features
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FAQS ═════════════════════════════════════ */}
      <section id="faqs" className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <SectionTag>FAQs</SectionTag>
          <p className="text-stone-500 mb-10 text-base">
            Everything you need to know about Solace AI and your journey to wellbeing.
          </p>
          <div className="space-y-3 text-left">
            {FAQS.map((faq, i) => (
              <FaqItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════ */}
      <footer className="border-t border-stone-200 bg-white py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🌿</span>
              <span className="font-display text-lg text-sage-700 font-semibold">Solace AI</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Providing compassionate, AI-driven mental health support to everyone, everywhere.
              Your privacy and wellbeing are our top priority.
            </p>
            <div className="flex gap-2 mt-4">
              <SocialIcon small><Globe size={14} /></SocialIcon>
              <SocialIcon small><ExternalLink size={14} /></SocialIcon>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sage-700 text-xs uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-stone-500">
              <li><button onClick={() => navigate(isAuthenticated ? '/chat' : '/register')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm text-stone-500">Chatbot</button></li>
              <li><button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm text-stone-500">Dashboard</button></li>
              <li><button onClick={() => navigate(isAuthenticated ? '/journal' : '/register')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm text-stone-500">Journaling</button></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sage-700 text-xs uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-stone-500">
              <li><button onClick={() => scrollTo('about')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm text-stone-500">About Us</button></li>
              <li><button onClick={() => scrollTo('contact')} className="hover:text-sage-700 transition bg-transparent border-none cursor-pointer p-0 text-sm text-stone-500">Contact</button></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sage-700 text-xs uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-stone-500">
              <li className="hover:text-sage-700 transition cursor-pointer">Privacy Policy</li>
              <li className="hover:text-sage-700 transition cursor-pointer">Terms of Use</li>
              <li className="hover:text-sage-700 transition cursor-pointer">Ethics Policy</li>
              <li className="hover:text-sage-700 transition cursor-pointer">Security</li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-stone-200 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} Solace AI. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SUB‑COMPONENTS
   ═══════════════════════════════════════════════════════ */

/* Section label tag */
function SectionTag({ children }) {
  return (
    <p className="text-xs uppercase tracking-[0.3em] text-sage-600 font-semibold mb-4">
      {children}
    </p>
  )
}

/* Feature card */
function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white rounded-3xl border border-stone-200 p-8 text-left shadow-sm hover:shadow-card transition-all duration-300 group">
      <div className="w-11 h-11 rounded-xl bg-sage-100 flex items-center justify-center mb-5 group-hover:bg-sage-200 transition">
        {icon}
      </div>
      <h3 className="text-lg font-display font-semibold text-sage-900 mb-2">{title}</h3>
      <p className="text-sm text-stone-500 leading-relaxed">{description}</p>
    </div>
  )
}

/* FAQ accordion item */
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold text-sage-900 bg-transparent border-none cursor-pointer hover:bg-sage-50/50 transition"
      >
        {question}
        <ChevronDown size={18} className={`text-sage-400 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '200px' : '0', opacity: open ? 1 : 0 }}
      >
        <p className="px-5 pb-5 text-sm text-stone-500 leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

/* Social icon button */
function SocialIcon({ children, small }) {
  return (
    <div className={`${small ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-sage-100 text-sage-600 flex items-center justify-center hover:bg-sage-200 transition cursor-pointer`}>
      {children}
    </div>
  )
}

/* Chat mockup widget (hero right side) */
function ChatMockup() {
  return (
    <div className="relative max-w-md mx-auto">
      {/* Glow behind card */}
      <div className="absolute -inset-4 bg-sage-300/20 rounded-[2rem] blur-2xl pointer-events-none" />

      <div className="relative bg-white rounded-3xl shadow-card border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100 bg-sage-50/50">
          <div className="w-8 h-8 rounded-full bg-sage-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sage-900">Solace Guide</p>
            <p className="text-[10px] text-sage-400">Online</p>
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-3">
          {/* Bot */}
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-sage-600 flex items-center justify-center flex-shrink-0">
              <Sparkles size={10} className="text-white" />
            </div>
            <div className="bg-sage-50 text-sage-800 text-xs rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[75%] leading-relaxed">
              Hi there. How are you feeling today? I'm here to listen to whatever is on your mind.
            </div>
          </div>

          {/* User */}
          <div className="flex justify-end">
            <div className="bg-sage-600 text-white text-xs rounded-2xl rounded-br-md px-4 py-2.5 max-w-[75%] leading-relaxed">
              I've been feeling a bit overwhelmed with work lately. It's hard to switch off at night.
            </div>
          </div>

          {/* Bot */}
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full bg-sage-600 flex items-center justify-center flex-shrink-0">
              <Sparkles size={10} className="text-white" />
            </div>
            <div className="bg-sage-50 text-sage-800 text-xs rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[75%] leading-relaxed">
              I hear you. Work-life balance can be tough. Would you like to try a quick 5-minute grounding exercise together?
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-100">
          <div className="flex-1 bg-stone-50 rounded-full px-4 py-2 text-xs text-stone-400">
            Type your reflection…
          </div>
          <div className="w-8 h-8 rounded-full bg-sage-600 flex items-center justify-center cursor-pointer">
            <Send size={13} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
