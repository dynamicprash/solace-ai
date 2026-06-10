import { useState, useEffect, useCallback } from 'react'
import { Check, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/auth'
import Input from '../common/Input'
import Button from '../common/Button'

const passwordRules = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

function PasswordStrength({ password }) {
  if (!password) return null

  const passed = passwordRules.filter((r) => r.test(password)).length
  const strength = passed <= 1 ? 'Weak' : passed <= 3 ? 'Fair' : passed <= 4 ? 'Good' : 'Strong'
  const color =
    passed <= 1
      ? 'bg-red-400'
      : passed <= 3
        ? 'bg-amber-400'
        : passed <= 4
          ? 'bg-emerald-400'
          : 'bg-emerald-600'

  return (
    <div className="mt-2">
      {/* Strength bar */}
      <div className="flex gap-1 mb-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= passed ? color : 'bg-stone-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-body font-medium mb-1.5 ${passed <= 1 ? 'text-red-500' : passed <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
        {strength}
      </p>

      {/* Individual rules */}
      <ul className="space-y-1 mt-2">
        {passwordRules.map((rule, idx) => (
          <li
            key={idx}
            className={`text-xs font-body flex items-center gap-2 transition-colors ${rule.test(password) ? 'text-emerald-600' : 'text-stone-400'}`}
          >
            <span className="flex-shrink-0 flex items-center justify-center w-3.5 h-3.5">
              {rule.test(password) ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <div className="w-2 h-2 rounded-full border border-stone-300" />
              )}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function RegisterForm() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState({})
  const [usernameStatus, setUsernameStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const { register, isLoading, error: authError, setError: setAuthError } = useAuthStore()

  // Debounced username availability check
  useEffect(() => {
    const username = formData.username.trim().toLowerCase()
    if (!username || username.length < 3) {
      setUsernameStatus(null)
      return
    }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const result = await authService.checkUsername(username)
        setUsernameStatus(result.available ? 'available' : 'taken')
      } catch {
        setUsernameStatus(null)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.username])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (usernameStatus === 'taken') {
      newErrors.username = 'Username is already taken'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else {
      const allPassed = passwordRules.every((r) => r.test(formData.password))
      if (!allPassed) {
        newErrors.password = 'Password does not meet all requirements'
      }
    }

    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Passwords do not match'
    }

    if (formData.email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(formData.email.trim())) {
        newErrors.email = 'Invalid email format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
    if (authError) {
      setAuthError(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const payload = {
      name: formData.name,
      username: formData.username,
      password: formData.password,
    }
    if (formData.email.trim()) {
      payload.email = formData.email.trim()
    }

    const result = await register(payload)
    if (result?.verificationRequired) {
      navigate('/verify-email', {
        state: {
          username: result.username,
          email: result.email,
        },
      })
    }
  }

  const displayError = authError || Object.values(errors).filter(Boolean)[0]

  const usernameHelper =
    usernameStatus === 'checking' ? (
      <span className="text-xs text-stone-400 font-body">Checking...</span>
    ) : usernameStatus === 'available' ? (
      <span className="text-xs text-emerald-600 font-body flex items-center gap-1.25">
        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
        <span>Username is available</span>
      </span>
    ) : usernameStatus === 'taken' ? (
      <span className="text-xs text-red-500 font-body flex items-center gap-1.25">
        <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        <span>Username is taken</span>
      </span>
    ) : null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-1.5">
        <Input
          name="name"
          label="Your Name"
          type="text"
          placeholder="How should we call you?"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          name="username"
          label="Username"
          type="text"
          placeholder="Choose a username"
          value={formData.username}
          onChange={handleChange}
          error={errors.username}
          required
          autoComplete="username"
        />
        {usernameHelper && <div className="mt-0.5 ml-0.5">{usernameHelper}</div>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          name="email"
          label="Email (optional)"
          type="email"
          placeholder="your@email.com"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />
        <p className="text-xs text-stone-400 font-body ml-0.5">
          Add email to receive weekly reflections and recovery check-ins.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          name="password"
          label="Password"
          type="password"
          placeholder="Create a strong password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          required
          autoComplete="new-password"
        />
        <PasswordStrength password={formData.password} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          name="passwordConfirm"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          value={formData.passwordConfirm}
          onChange={handleChange}
          error={errors.passwordConfirm}
          required
          autoComplete="new-password"
        />
      </div>

      {displayError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 px-3.5 text-sm font-body">
          {displayError}
        </div>
      )}

      <Button type="submit" loading={isLoading}>
        Create Account
      </Button>
    </form>
  )
}
