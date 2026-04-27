import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  secret_key: z.string().min(1, 'Admin secret key is required'),
})

type FormData = z.infer<typeof schema>

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { setAdminToken } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await adminApi.login(data)
      setAdminToken(res.data.access_token)
      // Patch admin token into axios default for admin calls
      localStorage.setItem('access_token', res.data.access_token)
      toast.success('Welcome, Admin!')
      navigate('/admin/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Admin login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-400 text-sm mt-1">SIFRA Administration</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Admin Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3.5 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                placeholder="admin@sifra.com"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3.5 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 pr-10"
                  placeholder="Admin password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Admin Secret Key
              </label>
              <input
                {...register('secret_key')}
                type="password"
                className={`w-full bg-gray-700 border text-white rounded-lg px-3.5 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 ${errors.secret_key ? 'border-red-500' : 'border-gray-600'}`}
                placeholder="Your admin secret key"
              />
              {errors.secret_key && <p className="text-red-400 text-xs mt-1">{errors.secret_key.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><ShieldCheck size={17} /> Sign In as Admin</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  )
}
