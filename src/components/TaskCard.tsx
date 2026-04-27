import { Link } from 'react-router-dom'
import { MapPin, Clock, DollarSign, Users, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Task } from '../types'
import clsx from 'clsx'

const STATUS: Record<string, string> = {
  open:        'badge-green',
  in_progress: 'badge-blue',
  completed:   'badge-gray',
  cancelled:   'badge-red',
  disputed:    'badge-yellow',
}

export default function TaskCard({ task }: { task: Task }) {
  return (
    <Link to={`/tasks/${task.id}`}>
      <div className="card-hover p-5 group">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sifra-navy group-hover:text-sifra-blue transition-colors line-clamp-2 leading-snug text-sm">
              {task.title}
            </h3>
            <p className="text-xs text-sifra-muted mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
          </div>
          <span className={clsx('badge shrink-0', STATUS[task.status] || 'badge-gray')}>
            {task.status.replace('_', ' ')}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="badge badge-navy">{task.category}</span>
          {task.tags.slice(0, 2).map((t) => <span key={t} className="badge badge-gray">{t}</span>)}
        </div>

        <div className="flex items-center flex-wrap gap-3 text-xs text-sifra-muted">
          <span className="flex items-center gap-1 text-green-700 font-bold text-sm">
            <DollarSign size={12} />
            {task.budget_min === task.budget_max ? `$${task.budget_min}` : `$${task.budget_min}–$${task.budget_max}`}
          </span>
          {task.deadline && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDistanceToNow(new Date(task.deadline), { addSuffix: true })}
            </span>
          )}
          {task.location && <span className="flex items-center gap-1"><MapPin size={12} />{task.location}</span>}
          <span className="flex items-center gap-1"><Users size={12} />{task.applications_count}</span>
          <span className="flex items-center gap-1 ml-auto"><Eye size={12} />{task.views_count}</span>
        </div>

        {task.creator && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-sifra-border">
            {task.creator.avatar_url ? (
              <img src={task.creator.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 bg-sifra-blue rounded-full flex items-center justify-center">
                <span className="text-white text-[9px] font-bold">{task.creator.full_name[0]}</span>
              </div>
            )}
            <span className="text-xs text-sifra-muted">{task.creator.full_name}</span>
            <span className="text-xs text-sifra-muted/60 ml-auto">
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
