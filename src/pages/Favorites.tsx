import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Trash2, User, Package, FileText, Inbox } from 'lucide-react'
import { favoritesApi } from '../api/client'
import toast from 'react-hot-toast'

type FavType = 'freelancer' | 'product' | 'task' | 'all'

function FavoriteBadge({ fav }: { fav: any }) {
  if (fav.target_freelancer_id) return (
    <span className="badge-blue">Freelancer</span>
  )
  if (fav.product_id) return (
    <span className="badge-green">Product</span>
  )
  if (fav.task_id) return (
    <span className="badge-yellow">Task</span>
  )
  return null
}

function FavLink({ fav }: { fav: any }) {
  if (fav.target_freelancer_id) {
    return (
      <Link to={`/freelancers/${fav.target_freelancer_id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sifra-blue to-blue-400 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sifra-navy text-sm truncate">Freelancer Profile</p>
          <p className="text-xs text-sifra-muted truncate">ID: {fav.target_freelancer_id.slice(0, 8)}…</p>
        </div>
      </Link>
    )
  }
  if (fav.product_id) {
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-green-600" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sifra-navy text-sm truncate">Saved Product</p>
          <p className="text-xs text-sifra-muted truncate">ID: {fav.product_id.slice(0, 8)}…</p>
        </div>
      </div>
    )
  }
  if (fav.task_id) {
    return (
      <Link to={`/tasks/${fav.task_id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sifra-navy text-sm truncate">Saved Task</p>
          <p className="text-xs text-sifra-muted truncate">ID: {fav.task_id.slice(0, 8)}…</p>
        </div>
      </Link>
    )
  }
  return null
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FavType>('all')

  useEffect(() => { fetchFavorites() }, [])

  const fetchFavorites = async () => {
    setLoading(true)
    try {
      const { data } = await favoritesApi.list()
      setFavorites(data)
    } catch {
      toast.error('Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (id: string) => {
    try {
      await favoritesApi.remove(id)
      setFavorites((prev) => prev.filter((f) => f.id !== id))
      toast.success('Removed from favorites')
    } catch {
      toast.error('Failed to remove')
    }
  }

  const filtered = favorites.filter((f) => {
    if (filter === 'freelancer') return !!f.target_freelancer_id
    if (filter === 'product') return !!f.product_id
    if (filter === 'task') return !!f.task_id
    return true
  })

  const TABS: { key: FavType; label: string }[] = [
    { key: 'all', label: `All (${favorites.length})` },
    { key: 'freelancer', label: `Freelancers` },
    { key: 'product', label: `Products` },
    { key: 'task', label: `Tasks` },
  ]

  return (
    <div className="page-container max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-6 h-6 text-red-500 fill-current" />
        <h1 className="section-title">My Favorites</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`btn-sm ${filter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-sifra-muted">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No favorites yet</p>
          <p className="text-sm">Save freelancers, tasks, or products to see them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fav, i) => (
            <motion.div
              key={fav.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card p-4 flex items-center gap-4"
            >
              <FavLink fav={fav} />
              <div className="flex items-center gap-2 flex-shrink-0">
                <FavoriteBadge fav={fav} />
                <button
                  onClick={() => removeFavorite(fav.id)}
                  className="p-1.5 rounded-lg text-sifra-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
