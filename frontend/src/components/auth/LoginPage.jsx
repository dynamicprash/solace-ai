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
      <div className="relative z-10 bg-warm-white border border-stone-200 rounded-3xl w-full max-w-96 animate-fadeUp shadow-card" style={{ padding: '48px 44px 40px' }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: '36px' }}>
          <div className="text-5xl" style={{ marginBottom: '10px' }}>🌿</div>
          <h1 className="font-display font-bold text-sage-700" style={{ fontSize: '2rem', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Mindful
          </h1>
          <p className="text-stone-500 italic" style={{ fontSize: '0.875rem' }}>
            Your safe space to be heard
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-md p-1" style={{ backgroundColor: '#f2f0ec', marginBottom: '28px' }}>
          <button
            onClick={() => handleTabSwitch('login')}
            className={`flex-1 py-2.5 px-4 rounded font-body font-medium transition-all ${
              isLogin 
                ? 'bg-warm-white text-sage-700 shadow-tab' 
                : 'bg-transparent text-stone-500'
            }`}
            style={{ fontSize: '0.875rem' }}
          >
            Sign In
          </button>
          <button
            onClick={() => handleTabSwitch('register')}
            className={`flex-1 py-2.5 px-4 rounded font-body font-medium transition-all ${
              !isLogin 
                ? 'bg-warm-white text-sage-700 shadow-tab' 
                : 'bg-transparent text-stone-500'
            }`}
            style={{ fontSize: '0.875rem' }}
          >
            Create Account
          </button>
        </div>

        {/* Forms */}
        {isLogin ? <LoginForm /> : <RegisterForm />}

        {/* Disclaimer */}
        <p className="font-body text-center leading-relaxed" style={{ marginTop: '24px', fontSize: '0.78125rem', color: '#a89f94' }}>
          This is a supportive tool, not a substitute for professional mental health care.
          <br />
          If you're in crisis, please call <strong style={{ color: '#958c7a' }}>988</strong>.
        </p>
      </div>
    </div>
  )
}

