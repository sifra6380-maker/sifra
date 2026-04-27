import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { notificationsApi } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import type { Notification } from '../types'
import clsx from 'clsx'

const TYPE_COLORS: Record<string, string> = {
  task_application: 'bg-blue-100 text-blue-600',
  application_accepted: 'bg-green-100 text-green-600',
  application_rejected: 'bg-red-100 text-red-600',
  task_completed: 'bg-purple-100 text-purple-600',
  message: 'bg-indigo-100 text-indigo-600',
  payment: 'bg-yellow-100 text-yellow-600',
  system: 'bg-gray-100 text-gray-600',
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success('All notifications marked as read')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-notifications'] })
    },
  })

  const unreadCount = notifications?.filter((n: Notification) => !n.is_read).length || 0

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="btn btn-outline btn-sm"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {notifications?.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n: Notification) => (
            <div
              key={n.id}
              className={clsx(
                'card p-4 transition-all cursor-pointer hover:shadow-card-hover',
                !n.is_read && 'bg-blue-50 border-blue-100'
              )}
              onClick={() => {
                if (!n.is_read) markReadMutation.mutate(n.id)
              }}
            >
              <div className="flex gap-3">
                <div className={clsx(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  TYPE_COLORS[n.type] || 'bg-gray-100 text-gray-600'
                )}>
                  <Bell size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={clsx('text-sm font-semibold', !n.is_read ? 'text-gray-900' : 'text-gray-700')}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-1" />
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  {n.link && (
                    <Link
                      to={n.link}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      View details →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="All caught up!"
          description="You have no notifications right now. We'll notify you when something happens."
        />
      )}
    </div>
  )
}
