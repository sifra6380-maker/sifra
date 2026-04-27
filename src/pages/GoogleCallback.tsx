import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import LoadingSpinner from '../components/LoadingSpinner'

export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      toast.error('Google login failed. No code received.')
      navigate('/login')
      return
    }

    authApi
      .googleLogin(code)
      .then((res) => {
        setTokens(res.data.access_token, res.data.refresh_token)
        toast.success('Logged in with Google!')
        navigate('/dashboard')
      })
      .catch((err) => {
        toast.error(err.response?.data?.detail || 'Google login failed')
        navigate('/login')
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-500 text-sm">Logging you in with Google...</p>
      </div>
    </div>
  )
}
