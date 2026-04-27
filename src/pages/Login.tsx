import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import AuthLayout from '../components/AuthLayout'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { setTokens } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const from = (location.state as any)?.from?.pathname || '/dashboard'

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await authApi.login(data)
      setTokens(res.data.access_token, res.data.refresh_token)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (detail === 'Please verify your email first') {
        toast.error('Please verify your email first.')
        navigate(`/verify-email?email=${encodeURIComponent(data.email)}`)
      } else {
        toast.error(detail || 'Invalid credentials')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    const clientId   = import.meta.env.VITE_GOOGLE_CLIENT_ID
    const redirectUri = `${window.location.origin}/auth/google/callback`
    window.location.href =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile`
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Sifra account">
      {/* Google */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-3 border border-sifra-border rounded-xl py-2.5 px-4 text-sm font-medium text-sifra-navy hover:bg-sifra-bg transition-colors mb-6"
      >
        <GoogleSVG />
        Continue with Google
      </button>

      <Divider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sifra-muted" />
            <input {...register('email')} type="email" className={`input pl-10 ${errors.email ? 'input-error' : ''}`} placeholder="you@example.com" autoComplete="email" />
          </div>
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-sifra-blue hover:underline">Forgot?</Link>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sifra-muted" />
            <input {...register('password')} type={showPass ? 'text' : 'password'} className={`input pl-10 pr-10 ${errors.password ? 'input-error' : ''}`} placeholder="Your password" autoComplete="current-password" />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sifra-muted hover:text-sifra-navy">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-2">
          {loading ? <Spinner /> : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-sifra-muted mt-5">
        Don't have an account?{' '}
        <Link to="/register" className="text-sifra-blue font-semibold hover:underline">Create one free</Link>
      </p>

      <div className="mt-8 pt-6 border-t border-sifra-border text-center">
        <Link to="/admin/login" className="text-xs text-sifra-muted hover:text-sifra-blue transition-colors">
          Authorized Personnel Only — Admin Access
        </Link>
      </div>
    </AuthLayout>
  )
}

function GoogleSVG() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
function Divider() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex-1 h-px bg-sifra-border" />
      <span className="text-xs text-sifra-muted font-medium">OR</span>
      <div className="flex-1 h-px bg-sifra-border" />
    </div>
  )
}
function Spinner() {
  return <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}
