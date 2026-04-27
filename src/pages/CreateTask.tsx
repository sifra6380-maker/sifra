import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi } from '../api/client'
import { TASK_CATEGORIES } from '../types'

const schema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(200),
  description: z.string().min(30, 'Description must be at least 30 characters'),
  category: z.string().min(1, 'Select a category'),
  budget_min: z.number({ invalid_type_error: 'Enter a valid number' }).positive(),
  budget_max: z.number({ invalid_type_error: 'Enter a valid number' }).positive(),
  deadline: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

type FormData = z.infer<typeof schema>

export default function CreateTaskPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tags: [] },
  })

  const tags = watch('tags')

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed) && tags.length < 8) {
      setValue('tags', [...tags, trimmed])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setValue('tags', tags.filter((t) => t !== tag))
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = 5 - images.length
    const toAdd = files.slice(0, remaining)
    setImages((prev) => [...prev, ...toAdd])
    toAdd.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: FormData) => {
    if (data.budget_max < data.budget_min) {
      toast.error('Maximum budget must be ≥ minimum budget')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...data,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        budget_min: Number(data.budget_min),
        budget_max: Number(data.budget_max),
      }
      const res = await tasksApi.create(payload)
      const taskId = res.data.id

      if (images.length > 0) {
        await tasksApi.uploadImages(taskId, images)
      }

      toast.success('Task posted successfully!')
      navigate(`/tasks/${taskId}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Post a New Task</h1>
        <p className="text-gray-500 mt-1">Describe what you need and find the perfect freelancer</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Task Title *</label>
              <input
                {...register('title')}
                className={`input ${errors.title ? 'input-error' : ''}`}
                placeholder="e.g. Build a React landing page for my SaaS product"
              />
              {errors.title && <p className="error-text">{errors.title.message}</p>}
            </div>

            <div>
              <label className="label">Description *</label>
              <textarea
                {...register('description')}
                rows={5}
                className={`input resize-none ${errors.description ? 'input-error' : ''}`}
                placeholder="Describe the task in detail: what you need, requirements, deliverables, technology stack..."
              />
              {errors.description && <p className="error-text">{errors.description.message}</p>}
            </div>

            <div>
              <label className="label">Category *</label>
              <select {...register('category')} className={`input ${errors.category ? 'input-error' : ''}`}>
                <option value="">Select a category</option>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="error-text">{errors.category.message}</p>}
            </div>
          </div>
        </div>

        {/* Budget & Deadline */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Budget & Timeline</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Minimum Budget ($) *</label>
              <input
                {...register('budget_min', { valueAsNumber: true })}
                type="number"
                min={1}
                step={0.01}
                className={`input ${errors.budget_min ? 'input-error' : ''}`}
                placeholder="50"
              />
              {errors.budget_min && <p className="error-text">{errors.budget_min.message}</p>}
            </div>
            <div>
              <label className="label">Maximum Budget ($) *</label>
              <input
                {...register('budget_max', { valueAsNumber: true })}
                type="number"
                min={1}
                step={0.01}
                className={`input ${errors.budget_max ? 'input-error' : ''}`}
                placeholder="500"
              />
              {errors.budget_max && <p className="error-text">{errors.budget_max.message}</p>}
            </div>
            <div>
              <label className="label">Deadline</label>
              <input
                {...register('deadline')}
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="input"
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                {...register('location')}
                className="input"
                placeholder="Remote / New York / Worldwide"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Tags</h2>
          <p className="text-sm text-gray-500 mb-4">Add relevant skills or keywords (up to 8)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span key={tag} className="badge badge-blue gap-1.5">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-blue-900"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          {tags.length < 8 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag() }
                }}
                className="input flex-1"
                placeholder="e.g. react, nodejs, design..."
              />
              <button type="button" onClick={addTag} className="btn btn-outline">
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Images */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Images</h2>
          <p className="text-sm text-gray-500 mb-4">Upload up to 5 reference images (optional)</p>

          <div className="flex flex-wrap gap-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative group w-24 h-24">
                <img
                  src={src}
                  alt={`Preview ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Add Image</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageAdd}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-outline btn-lg"
          >
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg px-8">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Post Task'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
