import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

export default function LoginPage({ mode: initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
  const navigate = useNavigate()

  const isLogin = mode === 'login'

  const handleTabSwitch = (newMode) => {
    setMode(newMode)
    navigate(newMode === 'login' ? '/login' : '/register', { replace: true })
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-cream px-6 py-12 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute rounded-full"
          style={{
            top: '20%',
            left: '20%',
            width: '600px',
            height: '600px',
            backgroundColor: 'rgba(106, 158, 105, 0.12)',
            filter: 'blur(120px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '0%',
            right: '20%',
            width: '600px',
            height: '600px',
            backgroundColor: 'rgba(74, 66, 56, 0.06)',
            filter: 'blur(120px)',
          }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 bg-white border border-slate-200 rounded-3xl w-full max-w-96 animate-fadeUp shadow-xl p-12 px-11 pb-10">
        {/* Logo */}
        <div className="text-center mb-9">
          <div className="text-5xl mb-2.5">🌿</div>
          <h1 className="font-display font-bold text-sage-700 text-2xl tracking-tight mb-1.5">
            Solace-AI
          </h1>
          <p className="text-stone-500 italic text-sm">
            Your safe space to be heard
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-md p-1 bg-slate-100 mb-7">
          <button
            onClick={() => handleTabSwitch('login')}
            className={`flex-1 py-2.5 px-4 rounded font-body font-medium transition-all text-sm ${isLogin
                ? 'bg-white text-sage-700 shadow-tab'
                : 'bg-transparent text-stone-500 hover:text-sage-700'
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => handleTabSwitch('register')}
            className={`flex-1 py-2.5 px-4 rounded font-body font-medium transition-all text-sm ${!isLogin
                ? 'bg-white text-sage-700 shadow-tab'
                : 'bg-transparent text-stone-500 hover:text-sage-700'
              }`}
          >
            Create Account
          </button>
        </div>

        {/* Forms */}
        <div key={mode} className="animate-fadeIn">
          {isLogin ? <LoginForm /> : <RegisterForm />}
        </div>

        {/* Disclaimer */}
        <p className="font-body text-center leading-relaxed mt-6 text-xs text-stone-500">
          This is a supportive tool, not a substitute for professional mental health care.
          <br />
          If you're in crisis, please call the Nepal National Helpline at <strong className="text-stone-600">1166</strong>.
        </p>
      </div>
    </div>
  )
}

