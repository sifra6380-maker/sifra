import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import { authApi } from './api/client'

// Public Pages
import HomePage from './pages/Home'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import VerifyEmailPage from './pages/VerifyEmail'
import { ForgotPasswordPage } from './pages/ForgotPassword'
import ResetPasswordPage from './pages/ResetPassword'
import GoogleCallbackPage from './pages/GoogleCallback'
import BrowseTasksPage from './pages/BrowseTasks'
import TaskDetailsPage from './pages/TaskDetails'
import BrowseFreelancersPage from './pages/BrowseFreelancers'
import FreelancerProfilePage from './pages/FreelancerProfile'
import FeedbackPage from './pages/Feedback'

// Protected Pages
import DashboardPage from './pages/Dashboard'
import CreateTaskPage from './pages/CreateTask'
import ApplicationsPage from './pages/Applications'
import ProfilePage from './pages/Profile'
import NotificationsPage from './pages/Notifications'
import CreateStorePage from './pages/CreateStore'
import StoreDashboardPage from './pages/StoreDashboard'
import ChatPage from './pages/Chat'
import WalletPage from './pages/Wallet'
import FavoritesPage from './pages/Favorites'
import SupportPage from './pages/Support'

// Admin Pages
import AdminLoginPage from './pages/admin/AdminLogin'
import AdminDashboardPage from './pages/admin/AdminDashboard'

// Pages that should not render the global Navbar
const NO_NAVBAR_ROUTES = ['/admin/login', '/admin/dashboard']

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isAdmin = NO_NAVBAR_ROUTES.some((r) =>
    location.pathname.startsWith(r)
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdmin && <Navbar />}
      <main className="flex-1">{children}</main>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, user, setUser, logout } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && !user) {
      authApi.getMe()
        .then((res) => setUser(res.data))
        .catch(() => logout())
    }
  }, [isAuthenticated, user])

  return (
    <Layout>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/browse" element={<BrowseTasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailsPage />} />
        <Route path="/freelancers" element={<BrowseFreelancersPage />} />
        <Route path="/freelancers/:id" element={<FreelancerProfilePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/tasks/create" element={<ProtectedRoute><CreateTaskPage /></ProtectedRoute>} />
        <Route path="/applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />

        {/* Store Routes */}
        <Route path="/stores" element={<ProtectedRoute><StoreDashboardPage /></ProtectedRoute>} />
        <Route path="/store/create" element={<ProtectedRoute><CreateStorePage /></ProtectedRoute>} />
        <Route path="/store/dashboard" element={<ProtectedRoute><StoreDashboardPage /></ProtectedRoute>} />

        {/* Chat Routes */}
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/chat/:convId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><AdminDashboardPage /></ProtectedRoute>} />

        {/* Redirects */}
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center text-center px-4">
      <div>
        <div className="text-8xl font-extrabold text-gray-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">The page you're looking for doesn't exist.</p>
        <a href="/" className="btn btn-primary">Go Home</a>
      </div>
    </div>
  )
}