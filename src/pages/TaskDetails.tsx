import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Clock, DollarSign, Users, Eye, Calendar,
  Share2, Flag, ArrowLeft, Send, CheckCircle, MessageCircle
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'
import { tasksApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import LoadingSpinner from '../components/LoadingSpinner'
import StartChatModal from '../components/chat/StartChatModal'
import { TASK_STATUS_LABELS } from '../types'
import clsx from 'clsx'

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuthStore()
  const [applying, setApplying] = useState(false)
  const [showChatModal, setShowChatModal] = useState(false)
  const [proposal, setProposal] = useState({
    cover_letter: '',
    proposed_budget: '',
    proposed_timeline: '',
  })

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      tasksApi.apply(id!, {
        cover_letter: proposal.cover_letter,
        proposed_budget: Number(proposal.proposed_budget),
        proposed_timeline: proposal.proposed_timeline || undefined,
      }),
    onSuccess: () => {
      toast.success('Application submitted successfully!')
      setApplying(false)
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      queryClient.invalidateQueries({ queryKey: ['my-applications'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to submit application')
    },
  })

  const isOwner = user?.id === task?.creator_id
  const canApply = isAuthenticated && !isOwner && task?.status === 'open'

  if (isLoading) return <LoadingSpinner fullPage />
  if (!task) return (
    <div className="page-container text-center">
      <p className="text-gray-500">Task not found</p>
      <Link to="/browse" className="btn btn-primary mt-4">Browse Tasks</Link>
    </div>
  )

  const STATUS_COLORS: Record<string, string> = {
    open: 'badge-green',
    in_progress: 'badge-blue',
    completed: 'badge-gray',
    cancelled: 'badge-red',
    disputed: 'badge-yellow',
  }

  return (
    <div className="page-container max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back to tasks
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{task.title}</h1>
              <span className={clsx('badge shrink-0', STATUS_COLORS[task.status])}>
                {TASK_STATUS_LABELS[task.status]}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-5">
              <span className="flex items-center gap-1">
                <Eye size={14} /> {task.views_count} views
              </span>
              <span className="flex items-center gap-1">
                <Users size={14} /> {task.applications_count} applications
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> Posted {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
              </span>
              {task.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} /> {task.location}
                </span>
              )}
            </div>

            <div className="prose prose-sm max-w-none text-gray-700">
              <p className="whitespace-pre-wrap">{task.description}</p>
            </div>

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-100">
                <span className="badge badge-blue">{task.category}</span>
                {task.tags.map((tag: string) => (
                  <span key={tag} className="badge badge-gray">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          {task.images?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Reference Images</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {task.images.map((url: string, i: number) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Reference ${i + 1}`}
                    className="rounded-lg w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Apply Form */}
          {canApply && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Submit a Proposal</h3>
              <p className="text-sm text-gray-500 mb-5">Explain why you're the best fit for this task</p>

              {!applying ? (
                <button onClick={() => setApplying(true)} className="btn btn-primary btn-lg w-full">
                  <Send size={17} /> Apply for This Task
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label">Cover Letter * <span className="text-gray-400 font-normal">(min. 50 chars)</span></label>
                    <textarea
                      rows={5}
                      value={proposal.cover_letter}
                      onChange={(e) => setProposal((p) => ({ ...p, cover_letter: e.target.value }))}
                      className="input resize-none"
                      placeholder="Hi, I'm interested in this task because... My experience includes... I can deliver by..."
                    />
                    <p className="text-xs text-gray-400 mt-1">{proposal.cover_letter.length}/50+ characters</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Your Price ($) *</label>
                      <input
                        type="number"
                        min={1}
                        step={0.01}
                        value={proposal.proposed_budget}
                        onChange={(e) => setProposal((p) => ({ ...p, proposed_budget: e.target.value }))}
                        className="input"
                        placeholder={`${task.budget_min} – ${task.budget_max}`}
                      />
                    </div>
                    <div>
                      <label className="label">Delivery Timeline</label>
                      <input
                        type="text"
                        value={proposal.proposed_timeline}
                        onChange={(e) => setProposal((p) => ({ ...p, proposed_timeline: e.target.value }))}
                        className="input"
                        placeholder="e.g. 3 days, 1 week"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setApplying(false)}
                      className="btn btn-outline flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => applyMutation.mutate()}
                      disabled={
                        applyMutation.isPending ||
                        proposal.cover_letter.length < 50 ||
                        !proposal.proposed_budget
                      }
                      className="btn btn-primary flex-1"
                    >
                      {applyMutation.isPending ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Submit Proposal</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isAuthenticated && (
            <div className="card p-6 text-center bg-blue-50 border-blue-200">
              <p className="text-gray-700 font-medium mb-3">Sign in to apply for this task</p>
              <div className="flex gap-3 justify-center">
                <Link to="/login" className="btn btn-primary">Login</Link>
                <Link to="/register" className="btn btn-outline">Register</Link>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Budget */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Task Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <DollarSign size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Budget</p>
                  <p className="font-semibold text-gray-900">
                    ${task.budget_min} – ${task.budget_max}
                  </p>
                </div>
              </div>

              {task.deadline && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Calendar size={16} className="text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deadline</p>
                    <p className="font-semibold text-gray-900">
                      {format(new Date(task.deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Applications</p>
                  <p className="font-semibold text-gray-900">{task.applications_count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Creator */}
          {task.creator && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Posted by</h3>
              <Link to={`/users/${task.creator.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                {task.creator.avatar_url ? (
                  <img src={task.creator.avatar_url} alt={task.creator.full_name} className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">{task.creator.full_name[0]}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{task.creator.full_name}</p>
                  <p className="text-xs text-gray-500">
                    Member since {format(new Date(task.creator.created_at), 'MMM yyyy')}
                  </p>
                </div>
              </Link>
              {isAuthenticated && !isOwner && (
                <button
                  onClick={() => setShowChatModal(true)}
                  className="btn btn-outline w-full mt-3 gap-2"
                >
                  <MessageCircle size={15} /> Message {task.creator.full_name.split(' ')[0]}
                </button>
              )}
            </div>
          )}

          {/* Owner Actions */}
          {isOwner && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Manage Task</h3>
              <div className="space-y-2">
                <Link to={`/tasks/${id}/edit`} className="btn btn-outline w-full">Edit Task</Link>
                <Link to={`/tasks/${id}/applications`} className="btn btn-primary w-full">
                  View Applications ({task.applications_count})
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Modal */}
      {showChatModal && task.creator && (
        <StartChatModal
          recipient={task.creator}
          taskId={task.id}
          taskTitle={task.title}
          onClose={() => setShowChatModal(false)}
        />
      )}
    </div>
  )
}
