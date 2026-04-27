import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, Briefcase, DollarSign, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { tasksApi } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import type { Application } from '../types'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'badge-yellow', icon: Clock },
  accepted: { label: 'Accepted', color: 'badge-green', icon: CheckCircle },
  rejected: { label: 'Not Selected', color: 'badge-red', icon: XCircle },
  withdrawn: { label: 'Withdrawn', color: 'badge-gray', icon: XCircle },
}

export default function ApplicationsPage() {
  const queryClient = useQueryClient()

  const { data: applications, isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => tasksApi.myApplications().then((r) => r.data),
  })

  if (isLoading) return <LoadingSpinner fullPage />

  const pending = applications?.filter((a: Application) => a.status === 'pending') || []
  const accepted = applications?.filter((a: Application) => a.status === 'accepted') || []
  const rejected = applications?.filter((a: Application) => a.status !== 'pending' && a.status !== 'accepted') || []

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
        <p className="text-gray-500 mt-1">Track all your job applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Pending', count: pending.length, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Accepted', count: accepted.length, color: 'bg-green-50 text-green-700' },
          { label: 'Rejected', count: rejected.length, color: 'bg-gray-50 text-gray-700' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-5 text-center">
            <div className={clsx('text-3xl font-bold mb-1', color.split(' ')[1])}>{count}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {applications?.length > 0 ? (
        <div className="space-y-3">
          {applications.map((app: Application) => {
            const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
            const StatusIcon = statusConfig.icon

            return (
              <div key={app.id} className="card p-5 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Link
                        to={`/tasks/${app.task_id}`}
                        className="font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                      >
                        {app.task?.title || 'Task'}
                      </Link>
                      <span className={clsx('badge', statusConfig.color)}>
                        <StatusIcon size={11} />
                        {statusConfig.label}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{app.cover_letter}</p>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1 text-green-700 font-semibold">
                        <DollarSign size={12} />
                        ${app.proposed_budget}
                      </span>
                      {app.proposed_timeline && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {app.proposed_timeline}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/tasks/${app.task_id}`}
                    className="btn btn-outline btn-sm shrink-0"
                  >
                    View Task
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          description="Browse tasks and submit proposals to get started"
          action={<Link to="/browse" className="btn btn-primary">Browse Tasks</Link>}
        />
      )}
    </div>
  )
}
