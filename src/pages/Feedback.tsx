import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquarePlus, Star, CheckCircle2, Lightbulb, Bug, Wand2 } from 'lucide-react'
import { feedbackApi } from '../api/client'
import toast from 'react-hot-toast'

const TYPES = [
  { key: 'suggestion', label: 'Suggestion', icon: <Lightbulb className="w-5 h-5" />, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
  { key: 'bug',        label: 'Bug Report', icon: <Bug className="w-5 h-5" />,        color: 'text-red-500',   bg: 'bg-red-50 border-red-200' },
  { key: 'feature',   label: 'Feature',    icon: <Wand2 className="w-5 h-5" />,       color: 'text-sifra-blue', bg: 'bg-blue-50 border-blue-200' },
]

export default function FeedbackPage() {
  const [type, setType] = useState('suggestion')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim() || text.length < 10) { toast.error('Please write at least 10 characters'); return }
    setSubmitting(true)
    try {
      await feedbackApi.submit({ type, rating: rating || undefined, text })
      setSubmitted(true)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="page-container max-w-xl text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card p-12 flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-sifra-navy">Thank you!</h2>
          <p className="text-sifra-muted">Your feedback has been recorded. We really appreciate it.</p>
          <button onClick={() => { setSubmitted(false); setText(''); setRating(0) }} className="btn-primary mt-2">
            Submit Another
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="page-container max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquarePlus className="w-6 h-6 text-sifra-blue" />
        <h1 className="section-title">Share Feedback</h1>
      </div>
      <p className="text-sifra-muted mb-6">Help us improve SIFRA. Your feedback shapes the platform.</p>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-6">
        {/* Type Selector */}
        <div>
          <label className="label mb-3">Type of Feedback</label>
          <div className="grid grid-cols-3 gap-3">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  type === t.key ? `${t.bg} ${t.color} border-current shadow-sm` : 'border-sifra-border text-sifra-muted hover:border-sifra-blue/30'
                }`}
              >
                {t.icon}
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Star Rating */}
        <div>
          <label className="label mb-2">Overall Rating (optional)</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(n === rating ? 0 : n)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-sifra-muted self-center">{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}</span>
            )}
          </div>
        </div>

        {/* Text */}
        <div>
          <label className="label">Your Message *</label>
          <textarea
            className="input min-h-[140px] resize-none"
            placeholder="Tell us what you think, what can be improved, or report a bug…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-sifra-muted mt-1">{text.length} / 500 characters</p>
        </div>

        <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </button>
      </motion.div>
    </div>
  )
}
