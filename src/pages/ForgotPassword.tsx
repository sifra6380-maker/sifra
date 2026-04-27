import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import AuthLayout from '../components/AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch { toast.error('Something went wrong') }
    finally { setLoading(false) }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={`Reset code sent to ${email}`}>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail size={26} className="text-green-600" />
          </div>
          <p className="text-sifra-muted text-sm mb-6">
            If an account exists for <strong className="text-sifra-navy">{email}</strong>, a password reset code has been sent.
          </p>
          <button onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)} className="btn btn-primary w-full mb-3">
            Enter Reset Code
          </button>
          <button onClick={() => setSent(false)} className="text-sm text-sifra-muted hover:text-sifra-blue transition-colors">
            Try a different email
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="We'll send a reset code to your email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sifra-muted" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="you@example.com" required />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Send Reset Code'}
        </button>
      </form>
      <div className="mt-5 text-center">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-sifra-muted hover:text-sifra-blue transition-colors">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </AuthLayout>
  )
}
