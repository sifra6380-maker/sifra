import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token refresh on 401
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        processQueue(error, null)
        isRefreshing = false
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
        processQueue(null, data.access_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; full_name: string; role: string }) =>
    api.post('/api/auth/register', data),

  verifyEmail: (data: { email: string; otp: string }) =>
    api.post('/api/auth/verify-email', data),

  resendOtp: (email: string) =>
    api.post('/api/auth/resend-otp', { email }),

  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),

  googleLogin: (code: string) =>
    api.post('/api/auth/google', { code }),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (data: { email: string; code: string; new_password: string }) =>
    api.post('/api/auth/reset-password', data),

  getMe: () => api.get('/api/auth/me'),
}

// ─── Tasks API ───────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/api/tasks', { params }),

  get: (id: string) => api.get(`/api/tasks/${id}`),

  create: (data: Record<string, unknown>) => api.post('/api/tasks', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/tasks/${id}`, data),

  delete: (id: string) => api.delete(`/api/tasks/${id}`),

  uploadImages: (taskId: string, files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return api.post(`/api/tasks/${taskId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  apply: (taskId: string, data: Record<string, unknown>) =>
    api.post(`/api/tasks/${taskId}/apply`, data),

  getApplications: (taskId: string) =>
    api.get(`/api/tasks/${taskId}/applications`),

  updateApplicationStatus: (taskId: string, appId: string, status: string) =>
    api.put(`/api/tasks/${taskId}/applications/${appId}`, { status }),

  myTasks: () => api.get('/api/tasks/my/tasks'),

  myApplications: () => api.get('/api/tasks/my/applications'),
}

// ─── Store API ───────────────────────────────────────────────────────────────

export const storeApi = {
  create: (data: Record<string, unknown>) => api.post('/api/store/create', data),

  getMyStore: () => api.get('/api/store/me'),

  updateMyStore: (data: Record<string, unknown>) => api.put('/api/store/me', data),

  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/store/me/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadBanner: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/store/me/banner', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getBySlug: (slug: string) => api.get(`/api/store/${slug}`),

  list: (params?: Record<string, unknown>) => api.get('/api/store', { params }),

  addProduct: (data: Record<string, unknown>) =>
    api.post('/api/store/me/products', data),

  updateProduct: (productId: string, data: Record<string, unknown>) =>
    api.put(`/api/store/me/products/${productId}`, data),

  updateStock: (productId: string, stock: number) =>
    api.put(`/api/store/me/products/${productId}/stock`, { stock }),

  deleteProduct: (productId: string) =>
    api.delete(`/api/store/me/products/${productId}`),

  uploadProductImages: (productId: string, files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return api.post(`/api/store/me/products/${productId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getAnalytics: () => api.get('/api/store/me/analytics'),

  getStoreProducts: (slug: string, params?: Record<string, unknown>) =>
    api.get(`/api/store/${slug}/products`, { params }),
}

// ─── Users API ───────────────────────────────────────────────────────────────

export const usersApi = {
  getProfile: () => api.get('/api/users/me'),

  updateProfile: (data: Record<string, unknown>) => api.put('/api/users/me', data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  getWallet: () => api.get('/api/users/me/wallet'),

  getOrders: (params?: Record<string, unknown>) =>
    api.get('/api/users/me/orders', { params }),

  getEarnings: () => api.get('/api/users/me/earnings'),

  getUserById: (id: string) => api.get(`/api/users/${id}`),
}

// ─── Notifications API ───────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => api.get('/api/notifications'),

  unreadCount: () => api.get('/api/notifications/unread-count'),

  markRead: (id: string) => api.put(`/api/notifications/${id}/read`),

  markAllRead: () => api.put('/api/notifications/mark-all-read'),
}

// ─── Chat API ────────────────────────────────────────────────────────────────

export const chatApi = {
  startConversation: (data: {
    participant_id: string
    task_id?: string
    opening_message: string
  }) => api.post('/api/chat/conversations', data),

  listConversations: () => api.get('/api/chat/conversations'),

  getConversation: (id: string, page = 1) =>
    api.get(`/api/chat/conversations/${id}`, { params: { page, per_page: 50 } }),

  sendMessage: (convId: string, content: string) =>
    api.post(`/api/chat/conversations/${convId}/messages`, { content }),

  uploadFile: (convId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/api/chat/conversations/${convId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  markRead: (convId: string) =>
    api.put(`/api/chat/conversations/${convId}/read`),

  deleteMessage: (msgId: string) =>
    api.delete(`/api/chat/messages/${msgId}`),

  unreadCount: () => api.get('/api/chat/unread-count'),
}

// ─── Freelancers API ─────────────────────────────────────────────────────────

export const freelancersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/api/freelancers', { params }),

  getProfile: (userId: string) =>
    api.get(`/api/freelancers/${userId}`),

  updateSettings: (data: Record<string, unknown>) =>
    api.put('/api/freelancers/me/settings', data),
}

// ─── Reviews API ─────────────────────────────────────────────────────────────

export const reviewsApi = {
  create: (data: Record<string, unknown>) =>
    api.post('/api/reviews', data),

  getForFreelancer: (userId: string) =>
    api.get(`/api/reviews/freelancer/${userId}`),

  getForProduct: (productId: string) =>
    api.get(`/api/reviews/product/${productId}`),

  getForStore: (storeId: string) =>
    api.get(`/api/reviews/store/${storeId}`),

  delete: (reviewId: string) =>
    api.delete(`/api/reviews/${reviewId}`),
}

// ─── Favorites API ───────────────────────────────────────────────────────────

export const favoritesApi = {
  add: (data: Record<string, unknown>) =>
    api.post('/api/favorites', data),

  list: () => api.get('/api/favorites'),

  remove: (id: string) => api.delete(`/api/favorites/${id}`),
}

// ─── Payments API ─────────────────────────────────────────────────────────────

export const paymentsApi = {
  createOrder: (amount: number) =>
    api.post('/api/payments/order', { amount }),

  verifyPayment: (data: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
    transaction_id: string
  }) => api.post('/api/payments/verify', data),

  checkout: (productId: string, quantity: number) =>
    api.post(`/api/payments/checkout/${productId}`, { product_id: productId, quantity }),

  getHistory: () => api.get('/api/payments/history'),

  requestRefund: (txId: string) =>
    api.post(`/api/payments/refund/${txId}`),

  getKey: () => api.get('/api/payments/key'),
}

// ─── Tickets API ─────────────────────────────────────────────────────────────

export const ticketsApi = {
  create: (data: Record<string, unknown>) =>
    api.post('/api/tickets', data),

  list: () => api.get('/api/tickets'),

  get: (id: string) => api.get(`/api/tickets/${id}`),

  sendMessage: (ticketId: string, message: string) =>
    api.post(`/api/tickets/${ticketId}/messages`, { message }),
}

// ─── Feedback API ─────────────────────────────────────────────────────────────

export const feedbackApi = {
  submit: (data: Record<string, unknown>) =>
    api.post('/api/feedback', data),

  list: () => api.get('/api/feedback'),

  testimonials: (limit = 10) =>
    api.get('/api/feedback/testimonials', { params: { limit } }),
}

// ─── Admin API ───────────────────────────────────────────────────────────────

export const adminApi = {
  login: (data: { email: string; password: string; secret_key: string }) =>
    api.post('/api/admin/login', data),

  getDashboard: () => api.get('/api/admin/dashboard'),

  getUsers: (params?: Record<string, unknown>) =>
    api.get('/api/admin/users', { params }),

  banUser: (id: string) => api.put(`/api/admin/users/${id}/ban`),
  unbanUser: (id: string) => api.put(`/api/admin/users/${id}/unban`),
  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),
  verifyUser: (id: string) => api.put(`/api/admin/users/${id}/verify`),

  getTasks: (params?: Record<string, unknown>) =>
    api.get('/api/admin/tasks', { params }),

  deleteTask: (id: string) => api.delete(`/api/admin/tasks/${id}`),
  markSpam: (id: string) => api.put(`/api/admin/tasks/${id}/spam`),

  getStores: (params?: Record<string, unknown>) =>
    api.get('/api/admin/stores', { params }),

  suspendStore: (id: string) => api.put(`/api/admin/stores/${id}/suspend`),
  approveStore: (id: string) => api.put(`/api/admin/stores/${id}/approve`),
  deleteStore: (id: string) => api.delete(`/api/admin/stores/${id}`),

  getTickets: (params?: Record<string, unknown>) =>
    api.get('/api/admin/tickets', { params }),

  updateTicket: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/admin/tickets/${id}`, data),

  replyTicket: (id: string, message: string) =>
    api.post(`/api/admin/tickets/${id}/reply`, { message }),

  getFeedback: (params?: Record<string, unknown>) =>
    api.get('/api/admin/feedback', { params }),

  deleteFeedback: (id: string) =>
    api.delete(`/api/admin/feedback/${id}`),

  getReports: () => api.get('/api/admin/reports'),

  getCommissionSettings: () => api.get('/api/admin/commission-settings'),

  updateCommissionSettings: (data: Record<string, unknown>) =>
    api.put('/api/admin/commission-settings', data),

  // User approval
  approveUser: (id: string) => api.put(`/api/admin/users/${id}/approve`),
  rejectUser: (id: string) => api.put(`/api/admin/users/${id}/reject`),

  // Disputes
  getDisputes: (params?: Record<string, unknown>) =>
    api.get('/api/admin/disputes', { params }),

  resolveDispute: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/admin/disputes/${id}/resolve`, data),
}
