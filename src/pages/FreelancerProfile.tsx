import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, MapPin, Clock, DollarSign, MessageSquare, Heart, Award, CheckCircle2, ChevronRight } from 'lucide-react'
import { freelancersApi, reviewsApi, favoritesApi } from '../api/client'
import toast from 'react-hot-toast'

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  )
}

const availabilityLabel: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'text-green-600 bg-green-50' },
  busy: { label: 'Busy', color: 'text-amber-600 bg-amber-50' },
  offline: { label: 'Offline', color: 'text-gray-500 bg-gray-100' },
}

export default function FreelancerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [favorited, setFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchProfile()
  }, [id])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const { data: res } = await freelancersApi.getProfile(id!)
      setData(res)
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async () => {
    if (!id) return
    setFavLoading(true)
    try {
      await favoritesApi.add({ target_freelancer_id: id })
      setFavorited(true)
      toast.success('Added to favorites!')
    } catch {
      toast.error('Could not add to favorites')
    } finally {
      setFavLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container max-w-4xl">
        <div className="card p-8 space-y-4">
          <div className="flex gap-6">
            <div className="skeleton w-24 h-24 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-5 w-1/3" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-1/4" />
            </div>
          </div>
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    )
  }

  if (!data) return <div className="page-container text-center text-sifra-muted py-20">Freelancer not found.</div>

  const { profile, reviews, avg_rating, review_count } = data
  const avail = availabilityLabel[profile.availability] || availabilityLabel.offline

  return (
    <div className="page-container max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-sifra-muted">
        <Link to="/freelancers" className="hover:text-sifra-navy">Freelancers</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-sifra-navy font-medium">{profile.full_name}</span>
      </nav>

      {/* Hero Card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-28 h-28 rounded-2xl object-cover ring-4 ring-sifra-border shadow-md" />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-sifra-blue to-blue-400 flex items-center justify-center text-white text-4xl font-bold shadow-md">
                {profile.full_name?.[0]?.toUpperCase()}
              </div>
            )}
            {/* CTA Buttons */}
            <Link to={`/chat?with=${profile.id}`} className="btn-primary w-full text-center flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4" /> Contact
            </Link>
            <button
              onClick={toggleFavorite}
              disabled={favorited || favLoading}
              className={`btn-secondary w-full flex items-center justify-center gap-2 ${favorited ? 'text-red-500 border-red-200' : ''}`}
            >
              <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
              {favorited ? 'Saved' : 'Save'}
            </button>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-2xl font-bold text-sifra-navy flex items-center gap-2">
                  {profile.full_name}
                  {profile.is_verified && <CheckCircle2 className="w-5 h-5 text-sifra-blue" />}
                </h1>
                <p className="text-sifra-muted capitalize">{profile.role}</p>
              </div>
              <span className={`badge ${avail.color} font-medium`}>{avail.label}</span>
            </div>

            {/* Rating */}
            {avg_rating && (
              <div className="flex items-center gap-2 mb-3">
                <StarRating value={avg_rating} />
                <span className="font-semibold text-sifra-navy">{avg_rating}</span>
                <span className="text-sifra-muted text-sm">({review_count} review{review_count !== 1 ? 's' : ''})</span>
              </div>
            )}

            {/* Rate */}
            {profile.hourly_rate && (
              <div className="flex items-center gap-1 text-sifra-navy font-semibold mb-4">
                <DollarSign className="w-4 h-4" />₹{profile.hourly_rate} / hr
              </div>
            )}

            {/* Bio */}
            {profile.bio && <p className="text-sifra-muted text-sm leading-relaxed mb-4">{profile.bio}</p>}

            {/* Skills */}
            {profile.skills?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s: string) => (
                  <span key={s} className="badge-blue">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Reviews Section */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
        <h2 className="text-lg font-bold text-sifra-navy mb-5 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Reviews
          {avg_rating && <span className="ml-auto text-2xl font-bold">{avg_rating} <span className="text-sm font-normal text-sifra-muted">/ 5</span></span>}
        </h2>

        {reviews.length === 0 ? (
          <p className="text-sifra-muted text-sm text-center py-6">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r: any) => (
              <div key={r.id} className="border border-sifra-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sifra-blue to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                      {r.reviewer?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-medium text-sm text-sifra-navy">{r.reviewer?.full_name || 'Anonymous'}</span>
                  </div>
                  <StarRating value={r.rating} />
                </div>
                {r.comment && <p className="text-sm text-sifra-muted mt-1">{r.comment}</p>}
                <p className="text-xs text-sifra-muted mt-2">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
