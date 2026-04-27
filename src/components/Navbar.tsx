import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell, Menu, X, ChevronDown, LogOut, User, Store,
  LayoutDashboard, Briefcase, MessageCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { notificationsApi, chatApi } from '../api/client'
import clsx from 'clsx'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const { data: unreadData } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  })
  const { data: chatUnreadData } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: () => chatApi.unreadCount().then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 20000,
  })
  const unreadCount = unreadData?.count || 0
  const chatUnread  = chatUnreadData?.count || 0

  const handleLogout = () => { logout(); navigate('/') }
  const isActive = (p: string) => location.pathname === p

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-sifra-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ─────────────────────────────────────────── */}
          <Link to="/" className="flex items-center">
            <span className="sifra-wordmark text-4xl leading-none tracking-tight">
              Sifra
            </span>
          </Link>

          {/* ── Desktop nav ──────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-7">
            <Link to="/browse"  className={clsx('nav-link', isActive('/browse')  && 'nav-link-active')}>Browse Tasks</Link>
            <Link to="/stores"  className={clsx('nav-link', isActive('/stores')  && 'nav-link-active')}>Stores</Link>
            {isAuthenticated && (
              <Link to="/tasks/create" className={clsx('nav-link', isActive('/tasks/create') && 'nav-link-active')}>Post a Task</Link>
            )}
          </div>

          {/* ── Right side ───────────────────────────────────── */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Chat icon */}
                <Link to="/chat" className="relative p-2 rounded-xl text-sifra-muted hover:text-sifra-navy hover:bg-sifra-bg transition-colors">
                  <MessageCircle size={19} />
                  {chatUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-sifra-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {chatUnread > 9 ? '9+' : chatUnread}
                    </span>
                  )}
                </Link>

                {/* Bell icon */}
                <Link to="/notifications" className="relative p-2 rounded-xl text-sifra-muted hover:text-sifra-navy hover:bg-sifra-bg transition-colors">
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Avatar dropdown */}
                <div className="relative ml-1">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-sifra-bg transition-colors border border-transparent hover:border-sifra-border"
                  >
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 bg-sifra-blue rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{user?.full_name?.[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-sifra-navy hidden sm:block max-w-[100px] truncate">
                      {user?.full_name?.split(' ')[0]}
                    </span>
                    <ChevronDown size={13} className="text-sifra-muted" />
                  </button>

                  {profileOpen && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-sifra-border shadow-soft py-1.5 z-20 animate-fade-in">
                        <div className="px-4 py-2.5 border-b border-sifra-border mb-1">
                          <p className="text-sm font-semibold text-sifra-navy truncate">{user?.full_name}</p>
                          <p className="text-xs text-sifra-muted truncate">{user?.email}</p>
                        </div>
                        {[
                          { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
                          { to: '/profile',         icon: User,            label: 'My Profile' },
                          { to: '/store/dashboard', icon: Store,           label: 'My Store' },
                          { to: '/chat',            icon: MessageCircle,   label: 'Messages', badge: chatUnread },
                          { to: '/applications',    icon: Briefcase,       label: 'Applications' },
                          { to: '/notifications',   icon: Bell,            label: 'Notifications', badge: unreadCount },
                        ].map(({ to, icon: Icon, label, badge }) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-sifra-text hover:bg-sifra-bg hover:text-sifra-navy transition-colors"
                          >
                            <Icon size={14} className="text-sifra-muted" />
                            {label}
                            {badge && badge > 0 ? (
                              <span className="ml-auto min-w-[18px] h-[18px] bg-sifra-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {badge}
                              </span>
                            ) : null}
                          </Link>
                        ))}
                        <div className="border-t border-sifra-border mt-1 pt-1">
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <LogOut size={14} /> Logout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login"    className="btn btn-ghost hidden sm:flex">Login</Link>
                <Link to="/register" className="btn btn-primary">Get Started</Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-sifra-muted hover:text-sifra-navy rounded-xl hover:bg-sifra-bg transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-sifra-border bg-white px-4 py-3 space-y-1 animate-slide-up">
          {[
            { to: '/browse', label: 'Browse Tasks' },
            { to: '/stores', label: 'Stores' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="block py-2.5 text-sm font-medium text-sifra-text hover:text-sifra-blue transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          ))}
          {!isAuthenticated && (
            <>
              <Link to="/login"    className="block py-2.5 text-sm text-sifra-muted" onClick={() => setMobileOpen(false)}>Login</Link>
              <Link to="/register" className="block py-2.5 text-sm font-semibold text-sifra-blue" onClick={() => setMobileOpen(false)}>Register →</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
