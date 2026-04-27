import {
  useEffect, useRef, useState, useCallback
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Send, Image, MoreVertical, Trash2, ChevronDown,
  Wifi, WifiOff, ArrowLeft, Paperclip
} from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { chatApi } from '../../api/client'
import { useChatSocket } from '../../hooks/useChatSocket'
import type { ChatMessage, Conversation } from '../../types/chat'
import clsx from 'clsx'
import toast from 'react-hot-toast'

interface Props {
  conversation: Conversation
  currentUserId: string
  onBack?: () => void   // mobile back button
}

function dateDivider(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

function shouldShowDivider(messages: ChatMessage[], index: number) {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].created_at).toDateString()
  const curr = new Date(messages[index].created_at).toDateString()
  return prev !== curr
}

export default function ChatWindow({ conversation, currentUserId, onBack }: Props) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})  // userId → name
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isTypingRef = useRef(false)

  // ── Fetch initial messages ───────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['chat-messages', conversation.id, 1],
    queryFn: () => chatApi.getConversation(conversation.id, 1).then((r) => r.data),
  })

  useEffect(() => {
    if (data) {
      setMessages(data.messages)
      setHasMore(data.has_more)
      setPage(1)
      chatApi.markRead(conversation.id).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50)
    }
  }, [data, conversation.id, queryClient])

  // ── WebSocket handlers ───────────────────────────────────────────────────
  const handleIncoming = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.find((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
    setTypingUsers((t) => {
      const copy = { ...t }
      delete copy[msg.sender_id]
      return copy
    })
    // Scroll to bottom if near bottom
    const el = containerRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
    }
    // Mark read if from other party
    if (msg.sender_id !== currentUserId) {
      chatApi.markRead(conversation.id).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  }, [conversation.id, currentUserId, queryClient])

  const handleDeleted = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, is_deleted: true, content: 'This message was deleted.' } : m)
    )
  }, [])

  const handleReadReceipt = useCallback((_readerId: string) => {
    setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })))
  }, [])

  const handleTyping = useCallback((userId: string, name: string) => {
    if (userId === currentUserId) return
    setTypingUsers((t) => ({ ...t, [userId]: name }))
  }, [currentUserId])

  const handleStopTyping = useCallback((userId: string) => {
    setTypingUsers((t) => { const c = { ...t }; delete c[userId]; return c })
  }, [])

  const { connected, sendMessage: wsSend, sendTyping, sendStopTyping } =
    useChatSocket({
      conversationId: conversation.id,
      onMessage: handleIncoming,
      onMessageDeleted: handleDeleted,
      onReadReceipt: handleReadReceipt,
      onTyping: handleTyping,
      onStopTyping: handleStopTyping,
    })

  // ── Scroll tracking ──────────────────────────────────────────────────────
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
  }

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setSending(true)
    stopTypingNow()

    // Optimistic message
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: text,
      type: 'text',
      is_read: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)

    try {
      wsSend(text)  // send via WebSocket — server will echo back the real message
    } catch {
      // Fallback to REST if WS fails
      try {
        const res = await chatApi.sendMessage(conversation.id, text)
        setMessages((prev) =>
          prev.map((m) => m.id === optimistic.id ? res.data : m)
        )
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        toast.error('Failed to send message')
        setInput(text)
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  }

  // ── Typing indicator ─────────────────────────────────────────────────────
  const stopTypingNow = () => {
    if (isTypingRef.current) {
      sendStopTyping()
      isTypingRef.current = false
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (!isTypingRef.current) {
      sendTyping()
      isTypingRef.current = true
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(stopTypingNow, 2000)

    // Auto-resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) { toast.error('File too large (max 5 MB)'); return }

    try {
      setSending(true)
      const res = await chatApi.uploadFile(conversation.id, file)
      setMessages((prev) => [...prev, res.data])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error('Failed to upload file')
    } finally {
      setSending(false)
    }
  }

  // ── Load older messages ──────────────────────────────────────────────────
  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const el = containerRef.current
    const prevScrollHeight = el?.scrollHeight || 0
    try {
      const nextPage = page + 1
      const res = await chatApi.getConversation(conversation.id, nextPage)
      setMessages((prev) => [...res.data.messages, ...prev])
      setHasMore(res.data.has_more)
      setPage(nextPage)
      // Preserve scroll position
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight
        })
      }
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Delete message ───────────────────────────────────────────────────────
  const deleteMessage = async (msgId: string) => {
    setActiveMenu(null)
    try {
      await chatApi.deleteMessage(msgId)
      handleDeleted(msgId)
    } catch {
      toast.error('Failed to delete message')
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => stopTypingNow(), [])

  // ── Render ───────────────────────────────────────────────────────────────
  const other = conversation.other_user
  const typingNames = Object.values(typingUsers)

  return (
    <div className="flex flex-col h-full bg-white" onClick={() => setActiveMenu(null)}>

      {/* ─ Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shadow-sm z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        {other?.avatar_url ? (
          <img src={other.avatar_url} alt={other.full_name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{other?.full_name?.[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{other?.full_name}</p>
          {conversation.task_title && (
            <p className="text-xs text-blue-500 truncate">re: {conversation.task_title}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Wifi size={12} /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <WifiOff size={12} /> Reconnecting…
            </span>
          )}
        </div>
      </div>

      {/* ─ Messages ───────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #f1f5f9 1px, transparent 0)', backgroundSize: '24px 24px' }}
      >
        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {loadingMore ? (
                <><div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" /> Loading…</>
              ) : 'Load older messages'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
              <Send size={22} className="text-blue-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Send the first message!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.sender_id === currentUserId
            const showDivider = shouldShowDivider(messages, i)
            const isOpt = msg.id.startsWith('opt-')

            return (
              <div key={msg.id}>
                {/* Date divider */}
                {showDivider && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-white rounded-full border border-gray-200">
                      {dateDivider(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                {/* Message bubble */}
                <div className={clsx('flex items-end gap-2 group', isMine ? 'justify-end' : 'justify-start')}>
                  {/* Other user avatar */}
                  {!isMine && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 mb-1">
                      <span className="text-white text-[9px] font-bold">
                        {msg.sender?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}

                  <div className={clsx('relative max-w-[72%] sm:max-w-[60%]', isMine ? 'items-end' : 'items-start')}>
                    {/* Context menu button */}
                    {!msg.is_deleted && isMine && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === msg.id ? null : msg.id) }}
                        className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical size={13} />
                      </button>
                    )}

                    {/* Context menu dropdown */}
                    {activeMenu === msg.id && (
                      <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-36 animate-fade-in">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id) }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={clsx(
                        'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-sm',
                        msg.is_deleted && 'opacity-60 italic',
                        isOpt && 'opacity-70',
                      )}
                    >
                      {msg.type === 'image' && msg.file_url && !msg.is_deleted ? (
                        <img
                          src={msg.file_url}
                          alt="Shared image"
                          className="rounded-xl max-w-[240px] max-h-[280px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.file_url, '_blank')}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Timestamp + read receipt */}
                    <div className={clsx(
                      'flex items-center gap-1 mt-0.5 px-1',
                      isMine ? 'justify-end' : 'justify-start'
                    )}>
                      <span className="text-[10px] text-gray-400">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </span>
                      {isMine && !isOpt && (
                        <span className={clsx('text-[10px]', msg.is_read ? 'text-blue-500' : 'text-gray-400')}>
                          {msg.is_read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">
                {other?.full_name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollDown && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-24 right-6 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-all z-10"
        >
          <ChevronDown size={16} className="text-gray-600" />
        </button>
      )}

      {/* ─ Input bar ──────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-gray-100 bg-white">
        <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-3 py-2.5">
          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors shrink-0 mb-0.5"
            title="Send image"
          >
            <Paperclip size={17} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="sr-only"
          />

          {/* Text area */}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-transparent text-sm text-gray-900 resize-none focus:outline-none placeholder-gray-400 max-h-[120px] leading-relaxed"
            style={{ height: '22px' }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={clsx(
              'p-2 rounded-xl transition-all shrink-0',
              input.trim() && !sending
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1.5">
          Press <kbd className="bg-gray-100 px-1 rounded text-gray-500">Enter</kbd> to send · <kbd className="bg-gray-100 px-1 rounded text-gray-500">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  )
}
