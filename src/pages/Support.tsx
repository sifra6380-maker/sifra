import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Headphones, Plus, Send, ChevronRight, Clock, CheckCircle2, AlertCircle, XCircle, Tag, ArrowLeft } from 'lucide-react'
import { ticketsApi } from '../api/client'
import toast from 'react-hot-toast'

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
  open:     { label: 'Open',     cls: 'badge-blue',   icon: <Clock className="w-3 h-3" /> },
  pending:  { label: 'Pending',  cls: 'badge-yellow', icon: <AlertCircle className="w-3 h-3" /> },
  resolved: { label: 'Resolved', cls: 'badge-green',  icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:   { label: 'Closed',   cls: 'badge-gray',   icon: <XCircle className="w-3 h-3" /> },
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'badge-gray', medium: 'badge-yellow', high: 'badge-red',
}

type View = 'list' | 'create' | 'detail'

export default function SupportPage() {
  const [view, setView] = useState<View>('list')
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Create form
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchTickets() }, [])
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const { data } = await ticketsApi.list()
      setTickets(data)
    } catch {
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const openTicket = async (ticket: any) => {
    setSelectedTicket(ticket)
    setView('detail')
    try {
      const { data } = await ticketsApi.get(ticket.id)
      setMessages(data.messages || [])
    } catch {
      toast.error('Failed to load messages')
    }
  }

  const createTicket = async () => {
    if (!subject.trim() || !description.trim()) { toast.error('Fill in all fields'); return }
    setCreating(true)
    try {
      await ticketsApi.create({ subject, description, priority })
      toast.success('Ticket created!')
      setSubject(''); setDescription(''); setPriority('medium')
      setView('list')
      fetchTickets()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  const sendMessage = async () => {
    if (!msgText.trim() || !selectedTicket) return
    setSending(true)
    try {
      const { data } = await ticketsApi.sendMessage(selectedTicket.id, msgText)
      setMessages((prev) => [...prev, data])
      setMsgText('')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-container max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setSelectedTicket(null) }} className="p-2 rounded-lg hover:bg-sifra-bg">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Headphones className="w-6 h-6 text-sifra-blue" />
          <h1 className="section-title">
            {view === 'list' ? 'Support Center' : view === 'create' ? 'New Ticket' : `Ticket #${selectedTicket?.id?.slice(0, 6)}`}
          </h1>
        </div>
        {view === 'list' && (
          <button onClick={() => setView('create')} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        )}
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20 text-sifra-muted">
              <Headphones className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No support tickets</p>
              <p className="text-sm">Open a ticket if you need help.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t, i) => {
                const s = STATUS_STYLES[t.status] || STATUS_STYLES.open
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => openTicket(t)}
                    className="card-hover p-4 flex items-center gap-4 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sifra-navy text-sm truncate">{t.subject}</p>
                      <p className="text-xs text-sifra-muted mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge ${s.cls} flex items-center gap-1`}>{s.icon}{s.label}</span>
                      <span className={`badge ${PRIORITY_STYLES[t.priority] || 'badge-gray'} capitalize`}>{t.priority}</span>
                      <ChevronRight className="w-4 h-4 text-sifra-muted" />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* CREATE VIEW */}
      {view === 'create' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-4">
          <div>
            <label className="label">Subject *</label>
            <input className="input" placeholder="Briefly describe your issue" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea
              className="input min-h-[140px] resize-none"
              placeholder="Describe your issue in detail (min 20 characters)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={createTicket} disabled={creating} className="btn-primary">
              {creating ? 'Creating…' : 'Submit Ticket'}
            </button>
            <button onClick={() => setView('list')} className="btn-secondary">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* DETAIL VIEW */}
      {view === 'detail' && selectedTicket && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Ticket Info */}
          <div className="card p-4 flex flex-wrap gap-3 items-center">
            <div className="flex-1">
              <h2 className="font-semibold text-sifra-navy">{selectedTicket.subject}</h2>
              <p className="text-xs text-sifra-muted mt-0.5">{selectedTicket.description}</p>
            </div>
            <div className="flex gap-2">
              {(() => { const s = STATUS_STYLES[selectedTicket.status]; return <span className={`badge ${s.cls} flex items-center gap-1`}>{s.icon}{s.label}</span> })()}
              <span className={`badge ${PRIORITY_STYLES[selectedTicket.priority]} capitalize`}>{selectedTicket.priority}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-sifra-border bg-sifra-bg">
              <p className="text-sm font-medium text-sifra-navy">Conversation</p>
            </div>
            <div className="p-4 h-80 overflow-y-auto space-y-3">
              {messages.length === 0 && (
                <p className="text-sifra-muted text-sm text-center py-8">No messages yet.</p>
              )}
              {messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.is_admin ? 'bg-sifra-bg text-sifra-navy rounded-tl-sm' : 'bg-sifra-blue text-white rounded-tr-sm'
                  }`}>
                    {m.is_admin && <p className="text-xs font-semibold mb-0.5 text-sifra-muted">Support Team</p>}
                    <p>{m.message}</p>
                    <p className={`text-xs mt-1 ${m.is_admin ? 'text-sifra-muted' : 'text-blue-200'}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>
            {selectedTicket.status !== 'closed' && (
              <div className="p-3 border-t border-sifra-border flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Type a message…"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <button onClick={sendMessage} disabled={sending || !msgText.trim()} className="btn-primary p-2.5">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
