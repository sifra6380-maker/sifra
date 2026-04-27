import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Star, Clock, DollarSign, Zap, ChevronDown, X } from 'lucide-react'
import { freelancersApi } from '../api/client'
import toast from 'react-hot-toast'

const SKILLS = ['React', 'Python', 'Design', 'Node.js', 'Writing', 'Marketing', 'Video', 'SEO', 'Mobile', 'DevOps']
const AVAILABILITY = ['available', 'busy', 'offline']

export default function BrowseFreelancersPage() {
  const [freelancers, setFreelancers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [search, setSearch] = useState('')
  const [skill, setSkill] = useState('')
  const [minRate, setMinRate] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [availability, setAvailability] = useState('')
  const [minRating, setMinRating] = useState('')

  const PER_PAGE = 12

  const fetchFreelancers = async (pg = 1) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: pg, per_page: PER_PAGE }
      if (search) params.search = search
      if (skill) params.skill = skill
      if (minRate) params.min_rate = minRate
      if (maxRate) params.max_rate = maxRate
      if (availability) params.availability = availability
      if (minRating) params.min_rating = minRating

      const { data } = await freelancersApi.list(params)
      setFreelancers(data.freelancers || [])
      setTotal(data.total || 0)
      setPage(pg)
    } catch {
      toast.error('Failed to load freelancers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFreelancers(1) }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchFreelancers(1)
  }

  const clearFilters = () => {
    setSkill(''); setMinRate(''); setMaxRate(''); setAvailability(''); setMinRating('')
    setTimeout(() => fetchFreelancers(1), 50)
  }

  const availabilityColor: Record<string, string> = {
    available: 'bg-green-400',
    busy: 'bg-amber-400',
    offline: 'bg-gray-300',
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title mb-2">Browse Freelancers</h1>
        <p className="text-sifra-muted">Find the perfect talent for your project</p>
      </div>

      {/* Search + Filter bar */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sifra-muted" />
          <input
            className="input pl-9"
            placeholder="Search by name or bio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">Search</button>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="btn-secondary flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </form>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-5 mb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Skill</label>
                <select className="input" value={skill} onChange={(e) => setSkill(e.target.value)}>
                  <option value="">Any skill</option>
                  {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Min Rate (₹/hr)</label>
                <input className="input" type="number" placeholder="0" value={minRate} onChange={(e) => setMinRate(e.target.value)} />
              </div>
              <div>
                <label className="label">Max Rate (₹/hr)</label>
                <input className="input" type="number" placeholder="Any" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} />
              </div>
              <div>
                <label className="label">Min Rating</label>
                <select className="input" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                  <option value="">Any</option>
                  {[4.5, 4, 3.5, 3].map((r) => <option key={r} value={r}>{r}+</option>)}
                </select>
              </div>
              <div>
                <label className="label">Availability</label>
                <select className="input" value={availability} onChange={(e) => setAvailability(e.target.value)}>
                  <option value="">Any</option>
                  {AVAILABILITY.map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2 col-span-2 md:col-span-3">
                <button onClick={() => fetchFreelancers(1)} className="btn-primary">Apply Filters</button>
                <button onClick={clearFilters} className="btn-secondary flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results info */}
      <p className="text-sm text-sifra-muted mb-5">
        Showing {freelancers.length} of {total} freelancers
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 space-y-3">
              <div className="skeleton h-16 w-16 rounded-full" />
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : freelancers.length === 0 ? (
        <div className="text-center py-20 text-sifra-muted">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No freelancers found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {freelancers.map((fl, i) => (
            <motion.div
              key={fl.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={`/freelancers/${fl.id}`} className="card-hover block p-6">
                {/* Avatar + status */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    {fl.avatar_url ? (
                      <img src={fl.avatar_url} alt={fl.full_name} className="w-14 h-14 rounded-full object-cover ring-2 ring-sifra-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sifra-blue to-blue-400 flex items-center justify-center text-white text-xl font-bold">
                        {fl.full_name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${availabilityColor[fl.availability] || 'bg-gray-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sifra-navy truncate">{fl.full_name}</h3>
                    <p className="text-xs text-sifra-muted capitalize">{fl.availability}</p>
                  </div>
                </div>

                {/* Bio */}
                {fl.bio && <p className="text-sm text-sifra-muted line-clamp-2 mb-3">{fl.bio}</p>}

                {/* Skills */}
                {fl.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {fl.skills.slice(0, 4).map((s: string) => (
                      <span key={s} className="badge-blue text-xs">{s}</span>
                    ))}
                    {fl.skills.length > 4 && <span className="badge-gray text-xs">+{fl.skills.length - 4}</span>}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-sm pt-3 border-t border-sifra-border">
                  {fl.hourly_rate ? (
                    <span className="flex items-center gap-1 text-sifra-navy font-semibold">
                      <DollarSign className="w-3.5 h-3.5" />₹{fl.hourly_rate}/hr
                    </span>
                  ) : <span className="text-sifra-muted text-xs">Rate on request</span>}
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="text-sifra-navy font-medium">New</span>
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex justify-center gap-2 mt-8">
          <button disabled={page === 1} onClick={() => fetchFreelancers(page - 1)} className="btn-secondary btn-sm">← Prev</button>
          <span className="btn-ghost btn-sm">Page {page} of {Math.ceil(total / PER_PAGE)}</span>
          <button disabled={page * PER_PAGE >= total} onClick={() => fetchFreelancers(page + 1)} className="btn-secondary btn-sm">Next →</button>
        </div>
      )}
    </div>
  )
}
