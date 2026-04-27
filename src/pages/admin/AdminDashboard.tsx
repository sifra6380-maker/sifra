import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Users, Briefcase, Store, DollarSign, ShieldCheck,
  LogOut, Ban, Trash2, CheckCircle, AlertTriangle, Search,
  BarChart3, RefreshCw, MessageSquare, Star, Shield,
  ThumbsUp, ThumbsDown, Send, Clock, XCircle, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

type AdminTab = 'overview' | 'users' | 'tasks' | 'stores' | 'tickets' | 'feedback' | 'disputes' | 'reports' | 'settings'

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { adminLogout } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [taskPage, setTaskPage] = useState(1)
  const [storePage, setStorePage] = useState(1)
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketFilter, setTicketFilter] = useState('')
  const [feedbackPage, setFeedbackPage] = useState(1)
  const [feedbackFilter, setFeedbackFilter] = useState('')
  const [disputePage, setDisputePage] = useState(1)
  const [disputeFilter, setDisputeFilter] = useState('')
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [resolveDisputeId, setResolveDisputeId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')
  const [resolveStatus, setResolveStatus] = useState('resolved_client')

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getDashboard().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: commissionSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-commission-settings'],
    queryFn: () => adminApi.getCommissionSettings().then((r) => r.data),
    enabled: tab === 'settings',
  })

  const { data: usersData, isLoading: usersLoading } = useQuery<any>({
    queryKey: ['admin-users', userPage, userSearch],
    queryFn: () => adminApi.getUsers({ page: userPage, per_page: 15, search: userSearch || undefined }).then((r) => r.data),
    enabled: tab === 'users',
    placeholderData: keepPreviousData,
  })

  const { data: tasksData, isLoading: tasksLoading } = useQuery<any>({
    queryKey: ['admin-tasks', taskPage],
    queryFn: () => adminApi.getTasks({ page: taskPage, per_page: 15 }).then((r) => r.data),
    enabled: tab === 'tasks',
    placeholderData: keepPreviousData,
  })

  const { data: storesData, isLoading: storesLoading } = useQuery<any>({
    queryKey: ['admin-stores', storePage],
    queryFn: () => adminApi.getStores({ page: storePage, per_page: 15 }).then((r) => r.data),
    enabled: tab === 'stores',
    placeholderData: keepPreviousData,
  })

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery<any>({
    queryKey: ['admin-tickets', ticketPage, ticketFilter],
    queryFn: () => adminApi.getTickets({ page: ticketPage, per_page: 15, status: ticketFilter || undefined }).then((r) => r.data),
    enabled: tab === 'tickets',
    placeholderData: keepPreviousData,
  })

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<any>({
    queryKey: ['admin-feedback', feedbackPage, feedbackFilter],
    queryFn: () => adminApi.getFeedback({ page: feedbackPage, per_page: 15, type: feedbackFilter || undefined }).then((r) => r.data),
    enabled: tab === 'feedback',
    placeholderData: keepPreviousData,
  })

  const { data: disputesData, isLoading: disputesLoading } = useQuery<any>({
    queryKey: ['admin-disputes', disputePage, disputeFilter],
    queryFn: () => adminApi.getDisputes({ page: disputePage, per_page: 15, status: disputeFilter || undefined }).then((r) => r.data),
    enabled: tab === 'disputes',
    placeholderData: keepPreviousData,
  })

  const { data: reportsData, isLoading: reportsLoading } = useQuery<any>({
    queryKey: ['admin-reports'],
    queryFn: () => adminApi.getReports().then((r) => r.data),
    enabled: tab === 'reports',
  })

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const banUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.banUser(id),
    onSuccess: () => { toast.success('User banned'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); queryClient.invalidateQueries({ queryKey: ['admin-stats'] }) },
    onError: () => toast.error('Failed to ban user'),
  })

  const unbanUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => { toast.success('User unbanned'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: () => toast.error('Failed to unban user'),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => { toast.success('User deleted'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); queryClient.invalidateQueries({ queryKey: ['admin-stats'] }) },
    onError: () => toast.error('Failed to delete user'),
  })

  const verifyUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.verifyUser(id),
    onSuccess: () => { toast.success('User verified'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteTask(id),
    onSuccess: () => { toast.success('Task deleted'); queryClient.invalidateQueries({ queryKey: ['admin-tasks'] }); queryClient.invalidateQueries({ queryKey: ['admin-stats'] }) },
  })

  const markSpamMutation = useMutation({
    mutationFn: (id: string) => adminApi.markSpam(id),
    onSuccess: () => { toast.success('Marked as spam'); queryClient.invalidateQueries({ queryKey: ['admin-tasks'] }) },
  })

  const suspendStoreMutation = useMutation({
    mutationFn: (id: string) => adminApi.suspendStore(id),
    onSuccess: () => { toast.success('Store suspended'); queryClient.invalidateQueries({ queryKey: ['admin-stores'] }) },
  })

  const deleteStoreMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteStore(id),
    onSuccess: () => { toast.success('Store deleted'); queryClient.invalidateQueries({ queryKey: ['admin-stores'] }); queryClient.invalidateQueries({ queryKey: ['admin-stats'] }) },
  })

  const updateCommissionMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateCommissionSettings(data),
    onSuccess: () => { toast.success('Commission settings updated'); queryClient.invalidateQueries({ queryKey: ['admin-commission-settings'] }) },
    onError: () => toast.error('Failed to update settings'),
  })

  const approveUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveUser(id),
    onSuccess: () => { toast.success('User approved'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
  })

  const rejectUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectUser(id),
    onSuccess: () => { toast.success('User rejected'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }) },
  })

  const replyTicketMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => adminApi.replyTicket(id, message),
    onSuccess: () => { toast.success('Reply sent'); setReplyTicketId(null); setReplyText(''); queryClient.invalidateQueries({ queryKey: ['admin-tickets'] }) },
    onError: () => toast.error('Failed to send reply'),
  })

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateTicket(id, data),
    onSuccess: () => { toast.success('Ticket updated'); queryClient.invalidateQueries({ queryKey: ['admin-tickets'] }) },
  })

  const deleteFeedbackMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteFeedback(id),
    onSuccess: () => { toast.success('Feedback deleted'); queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }) },
  })

  const resolveDisputeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.resolveDispute(id, data),
    onSuccess: () => { toast.success('Dispute resolved'); setResolveDisputeId(null); setResolveNote(''); queryClient.invalidateQueries({ queryKey: ['admin-disputes'] }); queryClient.invalidateQueries({ queryKey: ['admin-reports'] }) },
    onError: () => toast.error('Failed to resolve dispute'),
  })

  const handleLogout = () => {
    adminLogout()
    navigate('/admin/login')
  }

  // ─── Stat cards ──────────────────────────────────────────────────────────────

  const statCards = stats ? [
    { label: 'Platform Earnings', value: `$${stats.platform_earnings?.toFixed(2) || '0.00'}`, sub: 'Total commission collected', icon: DollarSign, color: 'blue' },
    { label: 'Pending Payouts', value: `$${stats.pending_payouts?.toFixed(2) || '0.00'}`, sub: 'In user wallets', icon: Briefcase, color: 'yellow' },
    { label: 'Total Volume', value: `$${stats.total_transactions_volume?.toFixed(2) || '0.00'}`, sub: 'All transactions', icon: BarChart3, color: 'purple' },
    { label: 'Total Users', value: stats.total_users, sub: `+${stats.new_users_today} today`, icon: Users, color: 'green' },
    { label: 'Total Tasks', value: stats.total_tasks, sub: `${stats.open_tasks} open`, icon: Briefcase, color: 'indigo' },
    { label: 'Total Stores', value: stats.total_stores, sub: '', icon: Store, color: 'red' },
  ] : []

  const COLOR_MAP: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Admin Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">SIFRA Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-8 overflow-x-auto border border-gray-800">
          {(['overview', 'users', 'tasks', 'stores', 'tickets', 'feedback', 'disputes', 'reports', 'settings'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap',
                tab === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            {statsLoading ? (
              <LoadingSpinner fullPage />
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-white">Platform Overview</h2>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-stats'] })}
                    className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {statCards.map(({ label, value, sub, icon: Icon, color }) => (
                    <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-400 text-sm">{label}</span>
                        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', COLOR_MAP[color])}>
                          <Icon size={17} />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-white">{value}</div>
                      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
                    </div>
                  ))}
                </div>

                <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-3">Quick Stats</h3>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">New users today</span>
                      <span className="text-white font-semibold">{stats?.new_users_today}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">New tasks today</span>
                      <span className="text-white font-semibold">{stats?.new_tasks_today}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">Open tasks</span>
                      <span className="text-green-400 font-semibold">{stats?.open_tasks}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">Banned users</span>
                      <span className="text-red-400 font-semibold">{stats?.banned_users}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── USERS TAB ────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Users Management</h2>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-500 w-60"
                />
              </div>
            </div>

            {usersLoading ? <LoadingSpinner fullPage /> : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {usersData?.users?.map((user: any) => (
                        <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">{user.full_name[0]}</span>
                                </div>
                              )}
                              <span className="text-white font-medium truncate max-w-[120px]">{user.full_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 truncate max-w-[160px]">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-xs capitalize">{user.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {user.is_banned ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 text-xs">Banned</span>
                              ) : user.is_verified ? (
                                <span className="px-2 py-0.5 rounded-full bg-green-900/50 text-green-400 text-xs">Verified</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 text-xs">Unverified</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {!user.is_verified && (
                                <button
                                  onClick={() => verifyUserMutation.mutate(user.id)}
                                  title="Verify user"
                                  className="p-1.5 text-green-400 hover:bg-green-900/30 rounded transition-colors"
                                >
                                  <CheckCircle size={14} />
                                </button>
                              )}
                              {!user.is_approved && (
                                <button
                                  onClick={() => approveUserMutation.mutate(user.id)}
                                  title="Approve user"
                                  className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                                >
                                  <ThumbsUp size={14} />
                                </button>
                              )}
                              {user.is_approved && (
                                <button
                                  onClick={() => rejectUserMutation.mutate(user.id)}
                                  title="Reject/revoke approval"
                                  className="p-1.5 text-purple-400 hover:bg-purple-900/30 rounded transition-colors"
                                >
                                  <ThumbsDown size={14} />
                                </button>
                              )}
                              {user.is_banned ? (
                                <button
                                  onClick={() => unbanUserMutation.mutate(user.id)}
                                  title="Unban user"
                                  className="p-1.5 text-yellow-400 hover:bg-yellow-900/30 rounded transition-colors"
                                >
                                  <RefreshCw size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Ban ${user.full_name}?`)) banUserMutation.mutate(user.id)
                                  }}
                                  title="Ban user"
                                  className="p-1.5 text-orange-400 hover:bg-orange-900/30 rounded transition-colors"
                                >
                                  <Ban size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete ${user.full_name}? This is irreversible.`)) deleteUserMutation.mutate(user.id)
                                }}
                                title="Delete user"
                                className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {usersData?.total > 15 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                    <span className="text-gray-500 text-xs">
                      {usersData.total} users total
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUserPage((p) => p - 1)}
                        disabled={userPage === 1}
                        className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-xs text-gray-400">Page {userPage}</span>
                      <button
                        onClick={() => setUserPage((p) => p + 1)}
                        disabled={userPage * 15 >= usersData.total}
                        className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TASKS TAB ────────────────────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-5">Tasks Management</h2>

            {tasksLoading ? <LoadingSpinner fullPage /> : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {['Title', 'Category', 'Budget', 'Status', 'Posted', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {tasksData?.tasks?.map((task: any) => (
                        <tr key={task.id} className={clsx('hover:bg-gray-800/50 transition-colors', task.is_spam && 'opacity-50')}>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium truncate max-w-[200px]">{task.title}</p>
                            {task.is_spam && <span className="text-xs text-red-400">⚠ Spam</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{task.category}</td>
                          <td className="px-4 py-3 text-green-400 font-medium">${task.budget_min}–${task.budget_max}</td>
                          <td className="px-4 py-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-xs',
                              task.status === 'open' && 'bg-green-900/50 text-green-400',
                              task.status === 'in_progress' && 'bg-blue-900/50 text-blue-400',
                              task.status === 'completed' && 'bg-gray-700 text-gray-400',
                            )}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {!task.is_spam && (
                                <button
                                  onClick={() => markSpamMutation.mutate(task.id)}
                                  title="Mark as spam"
                                  className="p-1.5 text-yellow-400 hover:bg-yellow-900/30 rounded transition-colors"
                                >
                                  <AlertTriangle size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this task?')) deleteTaskMutation.mutate(task.id)
                                }}
                                title="Delete task"
                                className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {tasksData?.total > 15 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                    <span className="text-gray-500 text-xs">{tasksData.total} tasks total</span>
                    <div className="flex gap-2">
                      <button onClick={() => setTaskPage((p) => p - 1)} disabled={taskPage === 1}
                        className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40">Previous</button>
                      <span className="px-3 py-1 text-xs text-gray-400">Page {taskPage}</span>
                      <button onClick={() => setTaskPage((p) => p + 1)} disabled={taskPage * 15 >= tasksData.total}
                        className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── STORES TAB ───────────────────────────────────────────────────────── */}
        {tab === 'stores' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-5">Stores Management</h2>

            {storesLoading ? <LoadingSpinner fullPage /> : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {['Store', 'Owner', 'Category', 'Products', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {storesData?.stores?.map((store: any) => (
                        <tr key={store.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {store.logo_url ? (
                                <img src={store.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                              ) : (
                                <div className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center">
                                  <Store size={13} className="text-gray-400" />
                                </div>
                              )}
                              <span className="text-white font-medium truncate max-w-[150px]">{store.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[140px]">
                            {store.owner?.full_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{store.category || '—'}</td>
                          <td className="px-4 py-3 text-gray-300 font-medium">{store.products?.length || 0}</td>
                          <td className="px-4 py-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-xs',
                              store.status === 'active' && 'bg-green-900/50 text-green-400',
                              store.status === 'suspended' && 'bg-red-900/50 text-red-400',
                              store.status === 'pending' && 'bg-yellow-900/50 text-yellow-400',
                            )}>
                              {store.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {store.status === 'active' && (
                                <button
                                  onClick={() => {
                                    if (window.confirm('Suspend this store?')) suspendStoreMutation.mutate(store.id)
                                  }}
                                  title="Suspend store"
                                  className="p-1.5 text-orange-400 hover:bg-orange-900/30 rounded transition-colors"
                                >
                                  <Ban size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this store permanently?')) deleteStoreMutation.mutate(store.id)
                                }}
                                title="Delete store"
                                className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {storesData?.total > 15 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                    <span className="text-gray-500 text-xs">{storesData.total} stores total</span>
                    <div className="flex gap-2">
                      <button onClick={() => setStorePage((p) => p - 1)} disabled={storePage === 1}
                        className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40">Previous</button>
                      <span className="px-3 py-1 text-xs text-gray-400">Page {storePage}</span>
                      <button onClick={() => setStorePage((p) => p + 1)} disabled={storePage * 15 >= storesData.total}
                        className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TICKETS TAB ───────────────────────────────────────────────────────── */}
        {tab === 'tickets' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Support Tickets</h2>
              <select value={ticketFilter} onChange={(e) => { setTicketFilter(e.target.value); setTicketPage(1) }}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {ticketsLoading ? <LoadingSpinner fullPage /> : (
              <div className="space-y-3">
                {ticketsData?.tickets?.map((ticket: any) => (
                  <div key={ticket.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{ticket.subject}</p>
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{ticket.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs',
                          ticket.status === 'open' && 'bg-blue-900/50 text-blue-400',
                          ticket.status === 'pending' && 'bg-yellow-900/50 text-yellow-400',
                          ticket.status === 'resolved' && 'bg-green-900/50 text-green-400',
                          ticket.status === 'closed' && 'bg-gray-700 text-gray-400',
                        )}>{ticket.status}</span>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs capitalize',
                          ticket.priority === 'high' && 'bg-red-900/50 text-red-400',
                          ticket.priority === 'medium' && 'bg-yellow-900/50 text-yellow-400',
                          ticket.priority === 'low' && 'bg-gray-700 text-gray-400',
                        )}>{ticket.priority}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <select
                        defaultValue={ticket.status}
                        onChange={(e) => updateTicketMutation.mutate({ id: ticket.id, data: { status: e.target.value } })}
                        className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1"
                      >
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button onClick={() => setReplyTicketId(replyTicketId === ticket.id ? null : ticket.id)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                        <Send size={11} /> Reply
                      </button>
                      <span className="text-gray-600 text-xs ml-auto">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {replyTicketId === ticket.id && (
                      <div className="mt-3 flex gap-2">
                        <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type admin reply…"
                          className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                          onKeyDown={(e) => e.key === 'Enter' && replyText.trim() && replyTicketMutation.mutate({ id: ticket.id, message: replyText })}
                        />
                        <button onClick={() => replyText.trim() && replyTicketMutation.mutate({ id: ticket.id, message: replyText })}
                          disabled={replyTicketMutation.isPending || !replyText.trim()}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {(ticketsData?.tickets?.length ?? 0) === 0 && (
                  <div className="text-center py-12 text-gray-500">No tickets found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── FEEDBACK TAB ──────────────────────────────────────────────────────── */}
        {tab === 'feedback' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Feedback Management</h2>
              <select value={feedbackFilter} onChange={(e) => { setFeedbackFilter(e.target.value); setFeedbackPage(1) }}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="">All Types</option>
                <option value="suggestion">Suggestions</option>
                <option value="bug">Bug Reports</option>
                <option value="feature">Feature Requests</option>
              </select>
            </div>
            {feedbackLoading ? <LoadingSpinner fullPage /> : (
              <div className="space-y-3">
                {feedbackData?.feedback?.map((fb: any) => (
                  <div key={fb.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs capitalize',
                            fb.type === 'suggestion' && 'bg-amber-900/50 text-amber-400',
                            fb.type === 'bug' && 'bg-red-900/50 text-red-400',
                            fb.type === 'feature' && 'bg-blue-900/50 text-blue-400',
                          )}>{fb.type}</span>
                          {fb.rating && (
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} size={12} className={n <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-600'} />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm">{fb.text}</p>
                        <p className="text-gray-600 text-xs mt-1">
                          {fb.user_id ? `User: ${fb.user_id.slice(0, 8)}…` : 'Anonymous'} · {formatDistanceToNow(new Date(fb.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button onClick={() => { if (window.confirm('Delete this feedback?')) deleteFeedbackMutation.mutate(fb.id) }}
                        className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {(feedbackData?.feedback?.length ?? 0) === 0 && (
                  <div className="text-center py-12 text-gray-500">No feedback found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── DISPUTES TAB ──────────────────────────────────────────────────────── */}
        {tab === 'disputes' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">Dispute Management</h2>
              <select value={disputeFilter} onChange={(e) => { setDisputeFilter(e.target.value); setDisputePage(1) }}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="resolved_client">Resolved (Client)</option>
                <option value="resolved_freelancer">Resolved (Freelancer)</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {disputesLoading ? <LoadingSpinner fullPage /> : (
              <div className="space-y-3">
                {disputesData?.disputes?.map((d: any) => (
                  <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">Task: {d.task_id?.slice(0, 8)}…</p>
                        <p className="text-gray-400 text-xs mt-0.5">Client: {d.client_id?.slice(0, 8)}… vs Freelancer: {d.freelancer_id?.slice(0, 8)}…</p>
                        <p className="text-gray-300 text-sm mt-2">{d.reason}</p>
                        {d.resolution_note && <p className="text-green-400 text-xs mt-1 italic">Resolution: {d.resolution_note}</p>}
                      </div>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs whitespace-nowrap',
                        d.status === 'open' && 'bg-red-900/50 text-red-400',
                        d.status === 'under_review' && 'bg-yellow-900/50 text-yellow-400',
                        (d.status === 'resolved_client' || d.status === 'resolved_freelancer') && 'bg-green-900/50 text-green-400',
                        d.status === 'closed' && 'bg-gray-700 text-gray-400',
                      )}>{d.status.replace('_', ' ')}</span>
                    </div>
                    {(d.status === 'open' || d.status === 'under_review') && (
                      <div className="mt-3 border-t border-gray-800 pt-3">
                        {resolveDisputeId === d.id ? (
                          <div className="space-y-2">
                            <select value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value)}
                              className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 w-full">
                              <option value="resolved_client">Resolve in Client's favor</option>
                              <option value="resolved_freelancer">Resolve in Freelancer's favor</option>
                              <option value="closed">Close dispute</option>
                            </select>
                            <input value={resolveNote} onChange={(e) => setResolveNote(e.target.value)}
                              placeholder="Resolution note (optional)"
                              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => resolveDisputeMutation.mutate({ id: d.id, data: { status: resolveStatus, resolution_note: resolveNote || undefined } })}
                                disabled={resolveDisputeMutation.isPending}
                                className="px-4 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                                Confirm
                              </button>
                              <button onClick={() => setResolveDisputeId(null)}
                                className="px-4 py-1.5 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setResolveDisputeId(d.id)}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                            <Shield size={12} /> Resolve Dispute
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(disputesData?.disputes?.length ?? 0) === 0 && (
                  <div className="text-center py-12 text-gray-500">No disputes found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── REPORTS TAB ───────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div>
            <h2 className="text-xl font-bold text-white mb-5">Reports & Analytics</h2>
            {reportsLoading ? <LoadingSpinner fullPage /> : reportsData && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Total Revenue', value: `₹${reportsData.total_revenue_inr?.toFixed(0) || 0}`, icon: DollarSign, color: 'green' },
                  { label: 'Open Tickets', value: reportsData.open_support_tickets, icon: MessageSquare, color: 'blue' },
                  { label: 'Total Reviews', value: reportsData.total_reviews, icon: Star, color: 'yellow' },
                  { label: 'Avg Rating', value: reportsData.avg_platform_rating, icon: Star, color: 'purple' },
                  { label: 'Total Feedback', value: reportsData.total_feedback_submissions, icon: MessageSquare, color: 'indigo' },
                  { label: 'Open Disputes', value: reportsData.open_disputes, icon: AlertTriangle, color: 'red' },
                  { label: 'Resolved Disputes', value: reportsData.resolved_disputes, icon: CheckCircle, color: 'green' },
                  { label: 'Pending Approvals', value: reportsData.pending_approvals, icon: Clock, color: 'yellow' },
                  { label: 'Total Products', value: reportsData.total_products, icon: Store, color: 'blue' },
                  { label: 'Freelancers', value: reportsData.freelancer_count, icon: Users, color: 'purple' },
                  { label: 'Total Disputes', value: reportsData.total_disputes, icon: Shield, color: 'red' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">{label}</span>
                      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', COLOR_MAP[color] || 'bg-gray-700 text-gray-400')}>
                        <Icon size={17} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white">{value ?? 0}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── SETTINGS TAB ─────────────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-white mb-5">Platform Settings</h2>

            {settingsLoading ? <LoadingSpinner /> : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4">Commission Settings</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    updateCommissionMutation.mutate({
                      commission_enabled: fd.get('commission_enabled') === 'on',
                      default_commission_percent: parseFloat(fd.get('default_commission_percent') as string),
                    });
                  }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Enable Platform Commission</h4>
                      <p className="text-xs text-gray-400 mt-1">Deduct a percentage from every successful transaction</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="commission_enabled"
                        defaultChecked={commissionSettings?.commission_enabled} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Default Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      name="default_commission_percent"
                      step="0.1"
                      min="0"
                      max="100"
                      defaultValue={commissionSettings?.default_commission_percent}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <button
                      type="submit"
                      disabled={updateCommissionMutation.isPending}
                      className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {updateCommissionMutation.isPending ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
