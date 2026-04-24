import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import Input from '../common/Input'
import Button from '../common/Button'

export default function LoginForm() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const { login, isLoading, error: authError } = useAuthStore()

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
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

    await login(formData)
  }

  const displayError = authError || Object.values(errors)[0]

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="flex flex-col" style={{ gap: '6px' }}>
        <Input
          name="username"
          label="Username"
          type="text"
          placeholder="Enter your username"
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
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          required
          autoComplete="current-password"
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
        Sign In
      </Button>

      <div className="text-center font-body" style={{ marginTop: '24px', fontSize: '0.78125rem', color: '#a89f94', lineHeight: '1.5' }}>
        Demo credentials:<br />
        Username: <strong>demo</strong> | Password: <strong>demo123</strong>
      </div>
    </form>
  )
}
