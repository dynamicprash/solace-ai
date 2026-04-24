import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import Input from '../common/Input'
import Button from '../common/Button'

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState({})
  const { register, isLoading, error: authError } = useAuthStore()

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    }
    
    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'Passwords do not match'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    await register({
      name: formData.name,
      username: formData.username,
      password: formData.password,
    })
  }

  const displayError = authError || Object.values(errors)[0]

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="flex flex-col" style={{ gap: '6px' }}>
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

      <div className="flex flex-col" style={{ gap: '6px' }}>
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
      </div>

      <div className="flex flex-col" style={{ gap: '6px' }}>
        <Input
          name="password"
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          required
          autoComplete="new-password"
        />
      </div>

      <div className="flex flex-col" style={{ gap: '6px' }}>
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
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '0.875rem',
          fontFamily: 'var(--font-body)',
        }}>
          {displayError}
        </div>
      )}

      <Button type="submit" loading={isLoading}>
        Create Account
      </Button>

      <div className="text-center font-body" style={{ marginTop: '24px', fontSize: '0.78125rem', color: '#a89f94', lineHeight: '1.5' }}>
        This is a supportive tool, not a substitute for professional mental health care.<br />
        If you're in crisis, please call <strong style={{ color: '#958c7a' }}>988</strong>.
      </div>
    </form>
  )
}
