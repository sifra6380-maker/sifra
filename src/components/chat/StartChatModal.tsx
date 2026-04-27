import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { chatApi } from '../../api/client'
import type { ChatUser } from '../../types/chat'
import clsx from 'clsx'

interface Props {
  recipient: ChatUser
  taskId?: string
  taskTitle?: string
  onClose: () => void
}

export default function StartChatModal({ recipient, taskId, taskTitle, onClose }: Props) {
  const navigate = useNavigate()
  const [message, setMessage] = useState(
    taskTitle ? `Hi! I'm interested in your task "${taskTitle}". ` : ''
  )
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await chatApi.startConversation({
        participant_id: recipient.id,
        task_id: taskId,
        opening_message: message.trim(),
      })
      toast.success('Conversation started!')
      onClose()
      navigate(`/chat/${res.data.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start conversation')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {recipient.avatar_url ? (
              <img src={recipient.avatar_url} alt={recipient.full_name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">{recipient.full_name[0]}</span>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 text-sm">{recipient.full_name}</p>
              {taskTitle && <p className="text-xs text-blue-500 truncate max-w-[180px]">re: {taskTitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Message input */}
        <div className="p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your message</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="Type your opening message…"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">{message.length} / 2000</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 btn btn-outline">Cancel</button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="flex-1 btn btn-primary"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Send size={14} /> Send Message</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
