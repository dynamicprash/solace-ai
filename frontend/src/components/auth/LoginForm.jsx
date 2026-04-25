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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-1.5">
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

      <div className="flex flex-col gap-1.5">
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
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5 px-3.5 text-sm font-body">
          {displayError}
        </div>
      )}

      <Button type="submit" loading={isLoading}>
        Sign In
      </Button>

      <div className="text-center font-body mt-6 text-xs text-stone-500 leading-relaxed">
        Demo credentials:<br />
        Username: <strong>demo</strong> | Password: <strong>demo123</strong>
      </div>
    </form>
  )
}
