import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Plus } from 'lucide-react'
import { chatApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import ConversationList from '../components/chat/ConversationList'
import ChatWindow from '../components/chat/ChatWindow'
import LoadingSpinner from '../components/LoadingSpinner'
import type { Conversation } from '../types/chat'

export default function ChatPage() {
  const { convId } = useParams<{ convId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')

  // Fetch conversation list
  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => chatApi.listConversations().then((r) => r.data),
    refetchInterval: 15000,  // poll for new conversations
  })

  // Select conversation from URL param or first in list
  useEffect(() => {
    if (!conversations) return
    if (convId) {
      const found = conversations.find((c) => c.id === convId)
      if (found) {
        setActiveConv(found)
        setMobileView('chat')
      } else {
        // Might be a new conversation not yet in list – fetch it
        chatApi.getConversation(convId).then((res) => {
          setActiveConv(res.data.conversation)
          setMobileView('chat')
        }).catch(() => navigate('/chat'))
      }
    } else if (conversations.length > 0 && !activeConv) {
      setActiveConv(conversations[0])
    }
  }, [conversations, convId])

  const handleSelectConv = (conv: Conversation) => {
    setActiveConv(conv)
    setMobileView('chat')
    navigate(`/chat/${conv.id}`, { replace: true })
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  if (!user) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-gray-50">

      {/* ─ Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`
          w-full sm:w-80 lg:w-96 flex flex-col border-r border-gray-200 bg-white
          ${mobileView === 'list' ? 'flex' : 'hidden sm:flex'}
        `}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <ConversationList
            conversations={conversations ?? []}
            activeId={activeConv?.id ?? null}
            currentUserId={user.id}
            onSelect={handleSelectConv}
          />
        )}
      </aside>

      {/* ─ Main chat panel ──────────────────────────────────────── */}
      <main
        className={`
          flex-1 flex flex-col overflow-hidden
          ${mobileView === 'chat' ? 'flex' : 'hidden sm:flex'}
        `}
      >
        {activeConv ? (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <ChatWindow
              conversation={activeConv}
              currentUserId={user.id}
              onBack={() => {
                setMobileView('list')
                navigate('/chat', { replace: true })
              }}
            />
          </div>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  )
}

function EmptyState() {
  const navigate = useNavigate()
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50">
      <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-5">
        <MessageCircle size={36} className="text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Your Messages</h2>
      <p className="text-gray-500 text-sm max-w-xs">
        Chat with clients and freelancers in real time. Start a conversation from any task or profile page.
      </p>
      <button
        onClick={() => navigate('/browse')}
        className="btn btn-primary mt-6 gap-2"
      >
        <Plus size={16} /> Browse Tasks to Connect
      </button>
    </div>
  )
}
