import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Search } from 'lucide-react'
import { useState } from 'react'
import type { Conversation } from '../../types/chat'
import clsx from 'clsx'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  currentUserId: string
  onSelect: (conv: Conversation) => void
}

export default function ConversationList({
  conversations,
  activeId,
  currentUserId,
  onSelect,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = conversations.filter((c) =>
    c.other_user?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.task_title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Messages</h2>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <MessageCircle size={22} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No conversations yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Apply to a task or contact a freelancer to start chatting
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeId
            const other = conv.other_user
            const lastMsg = conv.last_message
            const hasUnread = conv.unread_count > 0

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-gray-50',
                  isActive && 'bg-blue-50 hover:bg-blue-50 border-r-2 border-blue-600'
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {other?.avatar_url ? (
                    <img
                      src={other.avatar_url}
                      alt={other.full_name}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {other?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                  {/* Online dot – placeholder; could be wired up */}
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={clsx(
                        'text-sm truncate',
                        hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                      )}
                    >
                      {other?.full_name ?? 'Unknown User'}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 ml-1">
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <p
                      className={clsx(
                        'text-xs truncate flex-1',
                        hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'
                      )}
                    >
                      {lastMsg
                        ? lastMsg.is_deleted
                          ? 'Message deleted'
                          : lastMsg.type === 'image'
                          ? '📷 Image'
                          : lastMsg.sender_id === currentUserId
                          ? `You: ${lastMsg.content}`
                          : lastMsg.content
                        : 'No messages yet'}
                    </p>
                    {hasUnread && (
                      <span className="shrink-0 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>

                  {conv.task_title && (
                    <p className="text-[10px] text-blue-500 truncate mt-0.5">re: {conv.task_title}</p>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
