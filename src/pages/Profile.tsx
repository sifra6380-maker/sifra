import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Plus, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [tagInput, setTagInput] = useState('')
  const [editMode, setEditMode] = useState(false)

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => usersApi.getWallet().then((r) => r.data),
  })

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    skills: user?.skills || [],
    role: user?.role || 'both',
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => usersApi.updateProfile(data),
    onSuccess: (res) => {
      setUser(res.data)
      toast.success('Profile updated successfully!')
      setEditMode(false)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update profile')
    },
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await usersApi.uploadAvatar(file)
      toast.success('Avatar updated!')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch {
      toast.error('Failed to upload avatar')
    }
  }

  const addSkill = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !form.skills.includes(trimmed) && form.skills.length < 15) {
      setForm((f) => ({ ...f, skills: [...f.skills, trimmed] }))
      setTagInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }))
  }

  return (
    <div className="page-container max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1">Manage your personal information and settings</p>
      </div>

      <div className="space-y-6">
        {/* Avatar + Basic Info */}
        <div className="card p-6">
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-20 h-20 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{user?.full_name?.[0]}</span>
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 w-7 h-7 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
                <Camera size={14} className="text-gray-600" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
              </label>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user?.full_name}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {user?.is_verified && (
                  <span className="badge badge-green text-xs">✓ Verified</span>
                )}
                <span className="badge badge-blue text-xs capitalize">{user?.role}</span>
              </div>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className="ml-auto btn btn-outline btn-sm"
            >
              {editMode ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {editMode ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="input"
                    placeholder="@username"
                  />
                </div>
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="input resize-none"
                  placeholder="Tell others about yourself..."
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  className="input"
                >
                  <option value="client">Client (Hire)</option>
                  <option value="freelancer">Freelancer (Work)</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="label">Skills</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.skills.map((skill) => (
                    <span key={skill} className="badge badge-blue gap-1.5">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                {form.skills.length < 15 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                      className="input flex-1"
                      placeholder="Add skill (e.g. React, Python)"
                    />
                    <button type="button" onClick={addSkill} className="btn btn-outline">
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setEditMode(false)} className="btn btn-outline">Cancel</button>
                <button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending}
                  className="btn btn-primary"
                >
                  {updateMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Save size={15} /> Save Changes</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {user?.bio && (
                <div>
                  <p className="text-sm text-gray-500 font-medium">Bio</p>
                  <p className="text-gray-700 text-sm mt-1">{user.bio}</p>
                </div>
              )}
              {user?.username && (
                <p className="text-sm text-gray-600">@{user.username}</p>
              )}
              {(user?.skills?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {user?.skills?.map((skill) => (
                      <span key={skill} className="badge badge-gray">{skill}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallet */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Wallet</h3>
          {walletLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Balance', value: `$${wallet?.balance?.toFixed(2) || '0.00'}`, color: 'text-green-600' },
                  { label: 'In Escrow', value: `$${wallet?.escrow_balance?.toFixed(2) || '0.00'}`, color: 'text-orange-600' },
                  { label: 'Earnings', value: `$${wallet?.total_earnings?.toFixed(2) || '0.00'}`, color: 'text-blue-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              {wallet?.transactions?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Recent Transactions</p>
                  <div className="space-y-2">
                    {wallet.transactions.slice(0, 5).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <div>
                          <span className="font-medium text-gray-900 capitalize">{tx.type}</span>
                          {tx.description && <span className="text-gray-500 ml-2">{tx.description}</span>}
                        </div>
                        <span className={`font-semibold ${tx.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.type === 'withdrawal' ? '-' : '+'}${tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
