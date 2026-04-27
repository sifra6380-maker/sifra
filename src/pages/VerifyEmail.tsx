import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import AuthLayout from '../components/AuthLayout'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const { setTokens } = useAuthStore()

  const [otp, setOtp]         = useState(['','','','','',''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [timer, setTimer]     = useState(0)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { if (!email) navigate('/register') }, [email])
  useEffect(() => {
    if (timer > 0) { const t = setTimeout(() => setTimer(timer - 1), 1000); return () => clearTimeout(t) }
  }, [timer])

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (p.length === 6) { setOtp(p.split('')); refs.current[5]?.focus() }
    e.preventDefault()
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      const res = await authApi.verifyEmail({ email, otp: code })
      setTokens(res.data.access_token, res.data.refresh_token)
      toast.success('Email verified! Welcome to Sifra 🎉')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Verification failed')
      setOtp(['','','','','','']); refs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await authApi.resendOtp(email)
      toast.success('New OTP sent!')
      setTimer(60); setOtp(['','','','','','']); refs.current[0]?.focus()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to resend') }
    finally { setResending(false) }
  }

  return (
    <AuthLayout title="Check your email" subtitle={`We sent a 6-digit code to ${email}`}>
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <MailCheck size={26} className="text-sifra-blue" />
        </div>
      </div>

      {/* OTP boxes */}
      <div className="flex gap-2 justify-center mb-6">
        {otp.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl transition-colors focus:outline-none ${
              d ? 'border-sifra-blue bg-blue-50 text-sifra-blue' : 'border-sifra-border focus:border-sifra-blue'
            }`}
          />
        ))}
      </div>

      <button
        onClick={handleVerify}
        disabled={loading || otp.join('').length !== 6}
        className="btn btn-primary w-full btn-lg mb-4"
      >
        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify Email'}
      </button>

      <p className="text-center text-sm text-sifra-muted">
        Didn't get it?{' '}
        {timer > 0 ? (
          <span className="text-sifra-muted/70">Resend in {timer}s</span>
        ) : (
          <button onClick={handleResend} disabled={resending} className="text-sifra-blue font-semibold hover:underline inline-flex items-center gap-1">
            <RefreshCw size={13} className={resending ? 'animate-spin' : ''} /> Resend OTP
          </button>
        )}
      </p>

      <p className="text-center text-xs text-sifra-muted mt-4">
        Wrong email? <Link to="/register" className="text-sifra-blue hover:underline">Go back</Link>
      </p>
    </AuthLayout>
  )
}
