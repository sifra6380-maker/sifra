import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Briefcase, Store, Bell, Plus, TrendingUp,
  CheckCircle, Clock, DollarSign, ArrowRight, Users
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { tasksApi, notificationsApi } from '../api/client'
import TaskCard from '../components/TaskCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '../types'
import clsx from 'clsx'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: myTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => tasksApi.myTasks().then((r) => r.data),
  })

  const { data: myApps, isLoading: loadingApps } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => tasksApi.myApplications().then((r) => r.data),
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  })

  const stats = {
    openTasks: myTasks?.filter((t: any) => t.status === 'open').length || 0,
    inProgress: myTasks?.filter((t: any) => t.status === 'in_progress').length || 0,
    completedTasks: myTasks?.filter((t: any) => t.status === 'completed').length || 0,
    pendingApps: myApps?.filter((a: any) => a.status === 'pending').length || 0,
    acceptedApps: myApps?.filter((a: any) => a.status === 'accepted').length || 0,
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your account</p>
        </div>
        <Link to="/tasks/create" className="btn btn-primary btn-lg hidden sm:flex">
          <Plus size={18} /> Post a Task
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Open Tasks',
            value: stats.openTasks,
            icon: Briefcase,
            color: 'blue',
            link: '/tasks/my',
          },
          {
            label: 'In Progress',
            value: stats.inProgress,
            icon: Clock,
            color: 'yellow',
            link: '/tasks/my',
          },
          {
            label: 'Applications',
            value: myApps?.length || 0,
            icon: Users,
            color: 'purple',
            link: '/applications',
          },
          {
            label: 'Wallet',
            value: `$${(user?.wallet_balance || 0).toFixed(2)}`,
            icon: DollarSign,
            color: 'green',
            link: '/profile',
          },
        ].map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link}>
            <div className="card-hover p-5 cursor-pointer">
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                color === 'blue' && 'bg-blue-50',
                color === 'yellow' && 'bg-yellow-50',
                color === 'purple' && 'bg-purple-50',
                color === 'green' && 'bg-green-50',
              )}>
                <Icon size={20} className={clsx(
                  color === 'blue' && 'text-blue-600',
                  color === 'yellow' && 'text-yellow-600',
                  color === 'purple' && 'text-purple-600',
                  color === 'green' && 'text-green-600',
                )} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* My Tasks */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Tasks</h2>
            <Link to="/browse" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Browse all <ArrowRight size={13} />
            </Link>
          </div>

          {loadingTasks ? (
            <LoadingSpinner fullPage />
          ) : myTasks?.length > 0 ? (
            <div className="space-y-3">
              {myTasks.slice(0, 4).map((task: any) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {myTasks.length > 4 && (
                <Link to="/tasks/my" className="block text-center text-sm text-blue-600 py-2 hover:underline">
                  View all {myTasks.length} tasks →
                </Link>
              )}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <Briefcase size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium text-gray-900">No tasks yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Post your first task and start finding talent</p>
              <Link to="/tasks/create" className="btn btn-primary">
                <Plus size={15} /> Post a Task
              </Link>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { to: '/tasks/create', icon: Plus, label: 'Post a Task', color: 'text-blue-600' },
                { to: '/browse', icon: Briefcase, label: 'Browse Tasks', color: 'text-green-600' },
                { to: '/store/dashboard', icon: Store, label: 'My Store', color: 'text-purple-600' },
                { to: '/notifications', icon: Bell, label: 'Notifications', color: 'text-orange-600' },
              ].map(({ to, icon: Icon, label, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <Icon size={16} className={color} />
                  <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">{label}</span>
                  <ArrowRight size={13} className="ml-auto text-gray-400 group-hover:text-blue-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <Link to="/notifications" className="text-xs text-blue-600 hover:underline">View all</Link>
            </div>
            {notifications?.length > 0 ? (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((n: Notification) => (
                  <div
                    key={n.id}
                    className={clsx(
                      'flex items-start gap-3 p-2.5 rounded-lg',
                      !n.is_read && 'bg-blue-50'
                    )}
                  >
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      !n.is_read ? 'bg-blue-100' : 'bg-gray-100'
                    )}>
                      <Bell size={13} className={!n.is_read ? 'text-blue-600' : 'text-gray-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{n.message}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
