import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Button from '../common/Button'
import Logo from '../common/Logo'

export default function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { username, email } = location.state || {}
  const { verifyEmail, resendCode, isLoading, error } = useAuthStore()

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [cooldown, setCooldown] = useState(0)
  const [resendMsg, setResendMsg] = useState(null)
  const inputRefs = useRef([])

  // If no state was passed, redirect to register
  useEffect(() => {
    if (!username) {
      navigate('/register')
    }
  }, [username, navigate])

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Start initial cooldown
  useEffect(() => {
    setCooldown(60)
  }, [])

  const handleDigitChange = (index, value) => {
    // Accept only digits
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto submit when all digits entered
    if (value && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerify(fullCode)
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('')
      setCode(digits)
      inputRefs.current[5]?.focus()
      handleVerify(pastedData)
    }
  }

  const handleVerify = async (fullCode) => {
    if (!fullCode || fullCode.length !== 6) return
    await verifyEmail({ username, code: fullCode })
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setResendMsg(null)
    const result = await resendCode({ username })
    if (result.success) {
      setResendMsg('A new verification code has been sent!')
      setCooldown(60)
    } else {
      setResendMsg(result.error || 'Failed to resend code.')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fullCode = code.join('')
    handleVerify(fullCode)
  }

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(b.length) + c)
    : ''

  if (!username) return null

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
        <div className="text-center mb-7">
          <div className="flex justify-center mb-2.5">
            <Logo className="w-12 h-12" />
          </div>
          <h1 className="font-display font-bold text-sage-700 text-2xl tracking-tight mb-1.5">
            Verify Your Email
          </h1>
          <p className="text-stone-500 text-sm font-body leading-relaxed mt-2">
            We sent a 6-digit code to
            <br />
            <span className="font-medium text-stone-600">{maskedEmail}</span>
          </p>
        </div>

        {/* OTP Input */}
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-11 h-13 text-center text-xl font-display font-bold border-2 border-stone-300 rounded-xl bg-white text-stone-800 focus:border-sage-600 focus:ring-2 focus:ring-sage-600/12 outline-none transition-all"
                autoFocus={idx === 0}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 px-3.5 text-sm font-body mb-4 text-center">
              {error}
            </div>
          )}

          {/* Resend message */}
          {resendMsg && (
            <div className="text-center text-sm font-body text-emerald-600 mb-4">
              {resendMsg}
            </div>
          )}

          <Button type="submit" loading={isLoading} disabled={code.join('').length !== 6}>
            Verify & Continue
          </Button>
        </form>

        {/* Resend */}
        <div className="text-center mt-5">
          {cooldown > 0 ? (
            <p className="text-xs text-stone-400 font-body">
              Resend available in <span className="font-medium text-stone-500">{cooldown}s</span>
            </p>
          ) : (
            <button
              onClick={handleResend}
              className="text-xs text-sage-600 font-body font-medium hover:text-sage-700 cursor-pointer bg-transparent border-none underline"
            >
              Didn't receive the code? Resend
            </button>
          )}
        </div>

        {/* Back link */}
        <div className="text-center mt-4">
          <Link
            to="/register"
            className="text-xs text-stone-400 font-body hover:text-stone-500 transition-colors"
          >
            ← Back to registration
          </Link>
        </div>
      </div>
    </div>
  )
}
