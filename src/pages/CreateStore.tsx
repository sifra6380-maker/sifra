import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Store, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { storeApi } from '../api/client'

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  description: z.string().optional(),
  category: z.string().optional(),
  contact_email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function CreateStorePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const cleanData = {
        ...data,
        contact_email: data.contact_email || undefined,
        website: data.website || undefined,
      }
      await storeApi.create(cleanData)
      toast.success('Store created successfully! 🎉')
      navigate('/store/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create store')
    } finally {
      setLoading(false)
    }
  }

  const STORE_CATEGORIES = [
    'Web Development', 'Design', 'Marketing', 'Writing', 'Video',
    'Photography', 'Consulting', 'Education', 'Other'
  ]

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store size={28} className="text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Store</h1>
        <p className="text-gray-500">Set up your storefront to sell services and products</p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Store Name *</label>
            <input
              {...register('name')}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Alex's Design Studio"
            />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
            <p className="text-xs text-gray-400 mt-1">Your store URL will be based on this name</p>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="input resize-none"
              placeholder="What do you offer? What makes your store unique?"
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select {...register('category')} className="input">
              <option value="">Select a category</option>
              {STORE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Contact Email</label>
              <input
                {...register('contact_email')}
                type="email"
                className={`input ${errors.contact_email ? 'input-error' : ''}`}
                placeholder="store@email.com"
              />
              {errors.contact_email && <p className="error-text">{errors.contact_email.message}</p>}
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input
                {...register('contact_phone')}
                className="input"
                placeholder="+1 234 567 8900"
              />
            </div>
          </div>

          <div>
            <label className="label">Website (optional)</label>
            <input
              {...register('website')}
              className={`input ${errors.website ? 'input-error' : ''}`}
              placeholder="https://yourwebsite.com"
            />
            {errors.website && <p className="error-text">{errors.website.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Create Store <ArrowRight size={16} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
