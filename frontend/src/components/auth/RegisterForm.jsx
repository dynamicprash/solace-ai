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
      </div>

      <div className="flex flex-col gap-1.5">
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
