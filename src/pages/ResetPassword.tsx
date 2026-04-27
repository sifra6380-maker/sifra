import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import AuthLayout from '../components/AuthLayout'

export default function ResetPasswordPage() {
  const navigate  = useNavigate()
  const emailParam = new URLSearchParams(window.location.search).get('email') || ''
  const [form, setForm] = useState({ email: emailParam, code: '', new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authApi.resetPassword({ email: form.email, code: form.code, new_password: form.new_password })
      toast.success('Password reset! Please sign in.')
      navigate('/login')
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Reset failed. Check your code.') }
    finally { setLoading(false) }
  }

  return (
    <AuthLayout title="Create new password" subtitle="Enter your reset code and choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input" placeholder="your@email.com" required />
        </div>
        <div>
          <label className="label">Reset Code</label>
          <input type="text" value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} className="input font-mono tracking-[0.3em] text-center text-lg uppercase" placeholder="XXXXXXXX" maxLength={8} required />
          <p className="text-xs text-sifra-muted mt-1">8-character code from your email</p>
        </div>
        <div>
          <label className="label">New Password</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={form.new_password} onChange={(e) => setForm({...form, new_password: e.target.value})} className="input pr-10" placeholder="At least 8 characters" required />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sifra-muted">
              {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Confirm Password</label>
          <input type={showPass ? 'text' : 'password'} value={form.confirm} onChange={(e) => setForm({...form, confirm: e.target.value})} className={`input ${form.confirm && form.new_password !== form.confirm ? 'input-error' : ''}`} placeholder="Repeat password" required />
          {form.confirm && form.new_password !== form.confirm && <p className="error-text">Passwords do not match</p>}
        </div>
        <button type="submit" disabled={loading || (!!form.confirm && form.new_password !== form.confirm)} className="btn btn-primary w-full btn-lg">
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Reset Password'}
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
