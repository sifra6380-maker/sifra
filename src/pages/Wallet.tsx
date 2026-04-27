import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, AlertCircle, RefreshCw, Plus } from 'lucide-react'
import { paymentsApi } from '../api/client'
import toast from 'react-hot-toast'

declare global {
  interface Window { Razorpay: any }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const txTypeIcon: Record<string, JSX.Element> = {
  deposit:    <ArrowDownLeft className="w-4 h-4 text-green-500" />,
  withdrawal: <ArrowUpRight className="w-4 h-4 text-red-500" />,
  escrow:     <Clock className="w-4 h-4 text-amber-500" />,
  release:    <CheckCircle2 className="w-4 h-4 text-blue-500" />,
  refund:     <RefreshCw className="w-4 h-4 text-purple-500" />,
}

const txColor: Record<string, string> = {
  deposit: 'text-green-600',
  release: 'text-blue-600',
  refund:  'text-purple-600',
  escrow:  'text-amber-600',
  withdrawal: 'text-red-600',
}

export default function WalletPage() {
  const [history, setHistory] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)

  useEffect(() => { fetchHistory() }, [])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data } = await paymentsApi.getHistory()
      setHistory(data)
    } catch {
      toast.error('Failed to load wallet')
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (!amount || amount < 1) { toast.error('Enter a valid amount'); return }
    setDepositing(true)

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) { toast.error('Failed to load payment gateway'); setDepositing(false); return }

      const { data: order } = await paymentsApi.createOrder(amount)

      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: 'SIFRA',
        description: 'Wallet Top-Up',
        order_id: order.order_id,
        handler: async (response: any) => {
          try {
            await paymentsApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              transaction_id: order.transaction_id,
            })
            toast.success(`₹${amount} added to wallet!`)
            setDepositAmount('')
            setShowDeposit(false)
            fetchHistory()
          } catch {
            toast.error('Payment verification failed')
          }
        },
        prefill: { name: 'SIFRA User' },
        theme: { color: '#3B5BDB' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch {
      toast.error('Failed to initiate payment')
    } finally {
      setDepositing(false)
    }
  }

  const handleRefund = async (txId: string) => {
    if (!confirm('Request a refund for this transaction?')) return
    try {
      await paymentsApi.requestRefund(txId)
      toast.success('Refund requested!')
      fetchHistory()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Refund failed')
    }
  }

  if (loading) {
    return (
      <div className="page-container max-w-3xl space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }

  const balance = history?.wallet_balance ?? 0
  const earnings = history?.total_earnings ?? 0
  const transactions = history?.transactions ?? []

  return (
    <div className="page-container max-w-3xl space-y-6">
      <h1 className="section-title">Wallet</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 bg-gradient-to-br from-sifra-blue to-blue-500 text-white border-none shadow-lg">
          <p className="text-blue-100 text-sm mb-1 font-medium">Available Balance</p>
          <p className="text-4xl font-bold">₹{balance.toFixed(2)}</p>
          <button
            onClick={() => setShowDeposit(!showDeposit)}
            className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Funds
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <p className="text-sifra-muted text-sm mb-1 font-medium">Total Earnings</p>
          <p className="text-4xl font-bold text-sifra-navy">₹{earnings.toFixed(2)}</p>
          <p className="text-xs text-sifra-muted mt-4">Cumulative earnings from all projects</p>
        </motion.div>
      </div>

      {/* Deposit Form */}
      <AnimatePresence>
        {showDeposit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-5 border-sifra-blue/30">
              <h3 className="font-semibold text-sifra-navy mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sifra-blue" /> Add Funds via Razorpay
              </h3>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sifra-muted font-medium">₹</span>
                  <input
                    type="number"
                    min="1"
                    className="input pl-7"
                    placeholder="Enter amount (e.g. 500)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                <button onClick={handleDeposit} disabled={depositing} className="btn-primary">
                  {depositing ? 'Processing…' : 'Pay Now'}
                </button>
              </div>
              <p className="text-xs text-sifra-muted mt-2">Powered by Razorpay. Your payment is secure.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction History */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-sifra-navy mb-5">Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-center text-sifra-muted py-8">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-sifra-border">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-sifra-bg flex items-center justify-center flex-shrink-0">
                    {txTypeIcon[tx.type] || <CreditCard className="w-4 h-4 text-sifra-muted" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-sifra-navy capitalize">{tx.type.replace('_', ' ')}</p>
                    {tx.description && <p className="text-xs text-sifra-muted truncate max-w-[200px]">{tx.description}</p>}
                    <p className="text-xs text-sifra-muted">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <span className={`font-semibold ${txColor[tx.type] || 'text-sifra-navy'}`}>
                      {tx.type === 'deposit' || tx.type === 'release' || tx.type === 'refund' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                    </span>
                    <p className="text-xs capitalize text-sifra-muted">{tx.status}</p>
                  </div>
                  {tx.status === 'completed' && (tx.type === 'deposit' || tx.type === 'escrow') && (
                    <button
                      onClick={() => handleRefund(tx.id)}
                      className="btn-sm btn-outline text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                      title="Request refund"
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
