import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Zap, Shield, Star, ArrowRight,
  Briefcase, Users, TrendingUp, CheckCircle, Sparkles,
} from 'lucide-react'
import { tasksApi } from '../api/client'
import TaskCard from '../components/TaskCard'
import { TASK_CATEGORIES } from '../types'

// ── Category icon map ─────────────────────────────────────────────
const CAT_ICONS: Record<string, string> = {
  'Web Development':    '💻',
  'Mobile Development':'📱',
  'UI/UX Design':       '🎨',
  'Graphic Design':     '✏️',
  'Content Writing':    '📝',
  'Digital Marketing':  '📣',
  'SEO':                '🔍',
  'Data Science':       '📊',
  'Machine Learning':   '🤖',
  'Video Editing':      '🎬',
  'Photography':        '📷',
  'Translation':        '🌐',
}

export default function HomePage() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data: tasksData } = useQuery({
    queryKey: ['recent-tasks'],
    queryFn: () => tasksApi.list({ per_page: 6, sort_by: 'newest' }).then((r) => r.data),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/browse?search=${encodeURIComponent(search)}`)
  }

  return (
    <div className="min-h-screen bg-sifra-gradient">

      {/* ══════════════════════════════════════════════════════ HERO */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-sifra-blue/5 rounded-full blur-3xl" />
          <div className="absolute top-40 -left-20 w-[300px] h-[300px] bg-indigo-300/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[200px] h-[200px] bg-blue-200/20 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">

          {/* Script wordmark */}
          <div className="mb-4">
            <span className="sifra-wordmark text-7xl sm:text-8xl leading-none">Sifra</span>
          </div>

          {/* Launch pill — matches screenshot exactly */}
          <div className="flex justify-center mb-10">
            <span className="pill animate-fade-in">
              <Sparkles size={14} className="text-sifra-blue" />
              Just Launched — Be Among the First!
            </span>
          </div>

          {/* Main headline — exact copy from screenshot */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-sifra-navy leading-[1.05] tracking-tight mb-6">
            Your Campus.
            <br />
            <span className="text-sifra-blue">Your Hustle.</span>
            <br />
            Your Platform.
          </h1>

          {/* Sub-headline — matches screenshot */}
          <p className="text-lg sm:text-xl text-sifra-muted max-w-2xl mx-auto leading-relaxed mb-12">
            Sifra connects students, freelancers &amp; local businesses — for
            assignments, projects, gigs, and everything in between. Skills meet
            opportunity, right where you are.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link to="/register" className="btn btn-primary btn-lg px-10 shadow-md hover:shadow-lg">
              Get Started Free
            </Link>
            <Link to="/browse" className="btn btn-secondary btn-lg px-8">
              Browse Tasks <ArrowRight size={16} />
            </Link>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="flex items-center bg-white border border-sifra-border rounded-2xl shadow-soft overflow-hidden focus-within:border-sifra-blue focus-within:ring-2 focus-within:ring-sifra-blue/20 transition-all">
              <Search size={18} className="ml-4 text-sifra-muted shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, skills, categories…"
                className="flex-1 py-3.5 px-3 text-sm bg-transparent text-sifra-navy placeholder-sifra-muted focus:outline-none"
              />
              <button
                type="submit"
                className="m-1.5 bg-sifra-blue text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-sifra-blueMid transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-8 mt-12 text-sm">
            {[
              { n: '10K+', label: 'Students' },
              { n: '5K+',  label: 'Tasks Posted' },
              { n: '98%',  label: 'Satisfaction' },
            ].map(({ n, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-black text-sifra-navy">{n}</div>
                <div className="text-sifra-muted text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ CATEGORIES */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-sifra-navy mb-2">Browse by Category</h2>
            <p className="text-sifra-muted">Find exactly what you need</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {TASK_CATEGORIES.slice(0, 12).map((cat) => (
              <Link
                key={cat}
                to={`/browse?category=${encodeURIComponent(cat)}`}
                className="group bg-white border border-sifra-border rounded-2xl p-4 text-center hover:border-sifra-blue hover:shadow-card-hover transition-all duration-200"
              >
                <div className="text-2xl mb-2">{CAT_ICONS[cat] ?? '🛠️'}</div>
                <span className="text-xs font-semibold text-sifra-navy group-hover:text-sifra-blue transition-colors leading-snug">
                  {cat}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════ LATEST TASKS */}
      <section className="py-16 px-4 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-sifra-navy mb-1">Latest Tasks</h2>
              <p className="text-sifra-muted">Fresh opportunities posted by clients</p>
            </div>
            <Link to="/browse" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-sifra-blue hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {tasksData?.tasks?.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tasksData.tasks.map((task: any) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-sifra-bg rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Briefcase size={28} className="text-sifra-muted" />
              </div>
              <p className="font-bold text-sifra-navy text-lg">No tasks yet</p>
              <p className="text-sifra-muted text-sm mt-1 mb-5">Be the first to post a task!</p>
              <Link to="/tasks/create" className="btn btn-primary">Post a Task</Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ WHY SIFRA */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-sifra-navy mb-2">Why Sifra?</h2>
            <p className="text-sifra-muted max-w-lg mx-auto">Built for campus life. Designed for real results.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Shield,
                color: 'bg-blue-50 text-sifra-blue',
                title: 'Secure Payments',
                desc: 'Escrow-protected transactions. Money is safe until the work is done.',
              },
              {
                icon: Zap,
                color: 'bg-amber-50 text-amber-500',
                title: 'Instant Matching',
                desc: 'Smart filters connect you with the right talent in minutes.',
              },
              {
                icon: Star,
                color: 'bg-green-50 text-green-600',
                title: 'Verified Community',
                desc: 'Real students, real businesses, real reviews.',
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-7">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${color}`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-bold text-sifra-navy text-lg mb-2">{title}</h3>
                <p className="text-sm text-sifra-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════ CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <span className="sifra-wordmark text-5xl block mb-4 text-sifra-navy">Sifra</span>
          <h2 className="text-3xl font-black text-sifra-navy mb-4">Ready to start hustling?</h2>
          <p className="text-sifra-muted mb-8">
            Join your campus community — post tasks, get hired, and grow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="btn btn-primary btn-lg px-10 shadow-md">
              Create Free Account
            </Link>
            <Link to="/browse" className="btn btn-secondary btn-lg">
              Browse Tasks
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-sifra-border bg-white/60 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="sifra-wordmark text-3xl text-sifra-navy">Sifra</span>
          <p className="text-sifra-muted text-sm">© {new Date().getFullYear()} Sifra. All rights reserved.</p>
          <div className="flex gap-5 text-sm text-sifra-muted">
            <a href="#" className="hover:text-sifra-navy transition-colors">Privacy</a>
            <a href="#" className="hover:text-sifra-navy transition-colors">Terms</a>
            <Link to="/admin/login" className="hover:text-sifra-navy transition-colors">Admin Access</Link>
            <a href="#" className="hover:text-sifra-navy transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
